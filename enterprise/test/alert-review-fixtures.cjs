"use strict";
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { Heartbeats } = require("../heartbeats.cjs"),
  { HeartbeatAlerts } = require("../heartbeat_alerts.cjs"),
  { signed } = require("../ledger.cjs");
function fixture(empty = false, { maxPending = 1000 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-alert-review-")),
    writer = crypto.generateKeyPairSync("ed25519"),
    alerts = crypto.generateKeyPairSync("ed25519"),
    keys = Array.from({ length: 3 }, () =>
      crypto.generateKeyPairSync("ed25519"),
    ),
    organizationId = crypto.randomUUID();
  let now = Date.now() - 30000;
  const registrations = keys.map((k, i) => ({
    keyId: "device-" + i,
    organizationId,
    deviceId: crypto.randomUUID(),
    streamEpoch: crypto.randomUUID(),
    policyId: crypto.randomUUID(),
    policyVersion: 1,
    revoked: i === 2,
    publicKey: k.publicKey.export({ type: "spki", format: "pem" }),
  }));
  const source = {
    organizationId,
    registrations,
    minimumExtensionVersion: "1.22.0",
    lateAfterMs: 1000,
    unknownAfterMs: 2000,
    maxClockSkewMs: 100,
    signerKeyId: "source-writer",
    signerPublicKey: writer.publicKey,
  };
  const { signerPublicKey: unused, ...sourceConfig } = source;
  void unused;
  const store = new Heartbeats({
    ...sourceConfig,
    directory: path.join(root, "source"),
    signerPrivateKey: writer.privateKey,
    clock: () => now,
  });
  const context = {
      source,
      signerKeyId: "alerts-writer",
      cooldownMs: 900000,
      maxSnapshotAgeMs: 300000,
      maxPending,
    },
    monitor = new HeartbeatAlerts({
      ...context,
      directory: path.join(root, "alerts"),
      signerPrivateKey: alerts.privateKey,
      clock: () => now,
    });
  const content = () => fs.readFileSync(store.journal.logPath);
  const accept = (sequence) => {
    const r = registrations[0];
    store.accept(
      signed(
        {
          schemaVersion: 1,
          kind: "thundy-device-heartbeat",
          organizationId,
          deviceId: r.deviceId,
          streamEpoch: r.streamEpoch,
          sequence,
          observedAt: new Date(now).toISOString(),
          extensionVersion: "1.22.0",
          policyId: r.policyId,
          policyVersion: 1,
          brokerReady: true,
          queue: { pending: 0, retry: 0, deadLetter: 0, bytes: 0 },
        },
        r.keyId,
        keys[0].privateKey,
      ),
    );
  };
  const observe = () =>
    monitor.observe(
      content(),
      store.journal.head() === null
        ? {}
        : { expectedSourceHead: store.journal.head() },
    );
  if (!empty) {
    observe();
    now++;
    accept(1);
    observe();
    for (let i = 0; i < 10; i++) {
      now += 1000;
      observe();
      now += 1000;
      observe();
      now++;
      accept(i + 2);
      observe();
    }
    for (const n of monitor.pending().slice(0, 3))
      monitor.acknowledge(n.notificationId, { consumerId: "local-collector" });
  }
  const journal = monitor.journal.logPath,
    head = monitor.journal.head(),
    pub = { ...context, signerPublicKey: alerts.publicKey },
    report = HeartbeatAlerts.verifyJournal(fs.readFileSync(journal), {
      ...pub,
      ...(head === null ? {} : { expectedHead: head }),
    });
  const write = (name, value) =>
    fs.writeFileSync(
      path.join(root, name),
      typeof value === "string" ? value : JSON.stringify(value),
    );
  write(
    "source-public.pem",
    writer.publicKey.export({ type: "spki", format: "pem" }),
  );
  write(
    "alerts-public.pem",
    alerts.publicKey.export({ type: "spki", format: "pem" }),
  );
  write("registry.json", { registrations });
  const sourceFile = path.join(root, "source-config.json"),
    config = path.join(root, "alerts-config.json");
  write("source-config.json", {
    schemaVersion: 1,
    ...Object.fromEntries(
      Object.entries(sourceConfig).filter(([key]) => key !== "registrations"),
    ),
    signerPublicKeyFile: path.join(root, "source-public.pem"),
    registryFile: path.join(root, "registry.json"),
  });
  write("alerts-config.json", {
    schemaVersion: 1,
    signerKeyId: context.signerKeyId,
    signerPublicKeyFile: path.join(root, "alerts-public.pem"),
    heartbeatConfigFile: sourceFile,
    cooldownMs: context.cooldownMs,
    maxSnapshotAgeMs: context.maxSnapshotAgeMs,
    maxPending: context.maxPending,
  });
  return {
    root,
    deviceKeys: keys,
    accept,
    advance(ms) {
      now += ms;
    },
    report,
    journal,
    head,
    pub,
    config,
    monitor,
    store,
    cleanup() {
      monitor.close();
      store.close();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
module.exports = { fixture };
