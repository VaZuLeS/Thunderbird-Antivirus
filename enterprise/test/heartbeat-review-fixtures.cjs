"use strict";
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { Heartbeats } = require("../heartbeats.cjs"),
  { signed } = require("../ledger.cjs");
function fixture(count = 31) {
  const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "thundy-heartbeat-review-"),
    ),
    now = Date.now(),
    writer = crypto.generateKeyPairSync("ed25519"),
    organizationId = crypto.randomUUID();
  const keys = Array.from({ length: count }, () =>
    crypto.generateKeyPairSync("ed25519"),
  );
  const registrations = keys.map((k, i) => ({
    keyId: `device-${String(i).padStart(3, "0")}`,
    organizationId,
    deviceId: crypto.randomUUID(),
    streamEpoch: crypto.randomUUID(),
    policyId: crypto.randomUUID(),
    policyVersion: 3,
    revoked: i % 5 === 4,
    publicKey: k.publicKey.export({ type: "spki", format: "pem" }),
  }));
  let clock = now - 1200001;
  const context = {
    organizationId,
    registrations,
    signerKeyId: "test-writer",
    minimumExtensionVersion: "1.22.0",
    lateAfterMs: 600000,
    unknownAfterMs: 1200000,
    maxClockSkewMs: 120000,
  };
  const store = new Heartbeats({
    ...context,
    directory: path.join(root, "state"),
    signerPrivateKey: writer.privateKey,
    clock: () => clock,
  });
  for (const type of [3, 2, 1]) {
    clock = now - (type === 3 ? 1200001 : type === 2 ? 600001 : 0);
    registrations.forEach((r, i) => {
      if (i % 5 !== type) return;
      store.accept(
        signed(
          {
            schemaVersion: 1,
            kind: "thundy-device-heartbeat",
            organizationId,
            deviceId: r.deviceId,
            streamEpoch: r.streamEpoch,
            sequence: 1,
            observedAt: new Date(clock).toISOString(),
            extensionVersion: type === 2 ? "1.21.0" : "1.22.0",
            policyId: r.policyId,
            policyVersion: type === 2 ? 2 : 3,
            brokerReady: type !== 2,
            queue: {
              pending: 1,
              retry: type === 2 ? 2 : 0,
              deadLetter: type === 2 ? 1 : 0,
              bytes: 128,
            },
          },
          r.keyId,
          keys[i].privateKey,
        ),
      );
    });
  }
  const journal = store.journal.logPath,
    head = store.journal.head();
  const options = { ...context, signerPublicKey: writer.publicKey, now };
  const report = Heartbeats.verifyJournal(fs.readFileSync(journal), {
    ...options,
    expectedHead: head,
  });
  fs.writeFileSync(
    path.join(root, "public.pem"),
    writer.publicKey.export({ type: "spki", format: "pem" }),
  );
  fs.writeFileSync(
    path.join(root, "registry.json"),
    JSON.stringify({ registrations }),
  );
  const { registrations: unused, ...config } = context;
  void unused;
  fs.writeFileSync(
    path.join(root, "config.json"),
    JSON.stringify({
      schemaVersion: 1,
      ...config,
      signerPublicKeyFile: path.join(root, "public.pem"),
      registryFile: path.join(root, "registry.json"),
    }),
  );
  return {
    root,
    journal,
    head,
    report,
    store,
    options,
    cleanup() {
      store.close();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
module.exports = { fixture };
