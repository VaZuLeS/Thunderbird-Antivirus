"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Ledger, signed, verifyEnvelope, hash } = require("./ledger.cjs");
const { createService } = require("./service.cjs");
const { reviewHtml } = require("./review.cjs");
function args(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]?.slice(2);
    if (
      !argv[i]?.startsWith("--") ||
      !["data-dir", "port", "out", "lang", "public-key"].includes(name) ||
      !argv[i + 1] ||
      Object.hasOwn(options, name)
    )
      throw new Error("ARGUMENT_INVALID");
    options[name] = argv[i + 1];
  }
  return options;
}
function writePrivate(file, value) {
  fs.writeFileSync(file, value, { flag: "wx", mode: 0o600 });
}
function load(directory) {
  const config = JSON.parse(
    fs.readFileSync(path.join(directory, "config.json"), "utf8"),
  );
  if (config.mode !== "local-development")
    throw new Error("LOCAL_MODE_REQUIRED");
  return config;
}
function open(directory) {
  const config = load(directory);
  return new Ledger({
    directory,
    registrations: config.registrations,
    serverKeyId: config.serverKeyId,
    serverPrivateKey: fs.readFileSync(
      path.join(directory, "server-private.pem"),
      "utf8",
    ),
  });
}
async function main() {
  const command = process.argv[2],
    options = args(process.argv.slice(3)),
    directory = path.resolve(options["data-dir"] || "enterprise/.local");
  if (command === "init") {
    // Atomic directory creation prevents accidental overwrites of existing operator data.
    fs.mkdirSync(directory, { mode: 0o700 });
    const server = crypto.generateKeyPairSync("ed25519"),
      device = crypto.generateKeyPairSync("ed25519");
    const pem = (key) =>
      key.export({
        format: "pem",
        type: key.type === "private" ? "pkcs8" : "spki",
      });
    const registration = {
      keyId: "local-device-1",
      organizationId: crypto.randomUUID(),
      deviceId: crypto.randomUUID(),
      streamEpoch: crypto.randomUUID(),
      policyId: crypto.randomUUID(),
      policyVersion: 1,
      revoked: false,
      publicKey: pem(device.publicKey),
    };
    writePrivate(
      path.join(directory, "server-private.pem"),
      pem(server.privateKey),
    );
    writePrivate(
      path.join(directory, "server-public.pem"),
      pem(server.publicKey),
    );
    writePrivate(
      path.join(directory, "device-private.pem"),
      pem(device.privateKey),
    );
    writePrivate(
      path.join(directory, "config.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          mode: "local-development",
          serverKeyId: "local-server-1",
          registrations: [registration],
        },
        null,
        2,
      ) + "\n",
    );
    process.stdout.write("LOCAL_INITIALIZED\n");
    return;
  }
  if (command === "serve") {
    const port = Number(options.port || 8766);
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw new Error("PORT_INVALID");
    const ledger = open(directory),
      server = createService(ledger);
    const stop = () =>
      server.close(() => {
        ledger.close();
        process.exitCode = 0;
      });
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    server.once("error", () => {
      ledger.close();
      process.stderr.write("SERVICE_BIND_FAILED\n");
      process.exitCode = 1;
    });
    server.listen(port, "127.0.0.1", () =>
      process.stdout.write("LOCAL_SERVICE_READY 127.0.0.1:" + port + "\n"),
    );
    return;
  }
  if (command === "demo") {
    const config = load(directory),
      registration = config.registrations[0],
      privateKey = crypto.createPrivateKey(
        fs.readFileSync(path.join(directory, "device-private.pem")),
      ),
      ledger = open(directory);
    try {
      const epochSequence =
        ledger.records
          .filter(
            (r) =>
              r.eventEnvelope.payload.deviceId === registration.deviceId &&
              r.eventEnvelope.payload.streamEpoch === registration.streamEpoch,
          )
          .at(-1)?.eventEnvelope.payload.sequence || 0;
      let sequence = epochSequence;
      const start = Date.now() - 10000;
      const emit = (
        interactionId,
        kind,
        outcome,
        attemptNumber,
        score,
        seconds,
        domain,
        reason = null,
      ) => {
        const event = {
          schemaVersion: 2,
          eventId: crypto.randomUUID(),
          interactionId,
          deviceId: registration.deviceId,
          streamEpoch: registration.streamEpoch,
          sequence: ++sequence,
          observedAt: new Date(start + seconds * 1000).toISOString(),
          kind,
          outcome,
          attemptNumber,
          policyId: registration.policyId,
          policyVersion: registration.policyVersion,
          extensionVersion: "1.21.0",
          urlMode: "domain_only",
          urlRedacted: domain,
          assessment: {
            localScore: score,
            modelVersion: score === null ? null : "synthetic-demo-v1",
            providerVerdict: "UNKNOWN",
            provider: "none",
            observedAt:
              score === null
                ? null
                : new Date(start + seconds * 1000).toISOString(),
            reasonCodes: [],
          },
          reason,
        };
        ledger.accept(signed(event, registration.keyId, privateKey));
      };
      const opened = crypto.randomUUID();
      emit(opened, "CLICKED", null, 0, 85, 0, "https://risk.example");
      emit(opened, "OPEN_INTENT", null, 1, 85, 1, "https://risk.example");
      emit(opened, "DECISION", "OPENED", 1, 85, 2, "https://risk.example");
      emit(
        opened,
        "ASSESSMENT_UPDATED",
        null,
        1,
        10,
        3,
        "https://risk.example",
      );
      const cancelled = crypto.randomUUID();
      emit(cancelled, "CLICKED", null, 0, null, 4, "https://unknown.example");
      emit(
        cancelled,
        "DECISION",
        "ABORTED",
        0,
        null,
        5,
        "https://unknown.example",
        "escape",
      );
      process.stdout.write("SYNTHETIC_DEMO_EVENTS_WRITTEN 6\n");
    } finally {
      ledger.close();
    }
    return;
  }
  if (command === "review" || command === "export") {
    if (!options.out) throw new Error("OUTPUT_REQUIRED");
    const ledger = open(directory);
    try {
      const records = ledger.exportRecords();
      writePrivate(
        options.out,
        command === "review"
          ? reviewHtml(records, options.lang || "en")
          : JSON.stringify(
              {
                kind: "thundy-staged-journal-export",
                schemaVersion: 1,
                records,
              },
              null,
              2,
            ) + "\n",
      );
      process.stdout.write("VERIFIED_LOCAL_EXPORT_WRITTEN\n");
    } finally {
      ledger.close();
    }
    return;
  }
  if (command === "verify") {
    if (!options.out || !options["public-key"])
      throw new Error("EXPORT_AND_PUBLIC_KEY_REQUIRED");
    const publicKey = crypto.createPublicKey(
        fs.readFileSync(options["public-key"]),
      ),
      data = JSON.parse(fs.readFileSync(options.out, "utf8"));
    let previous = null,
      index = 0;
    if (
      data.kind !== "thundy-staged-journal-export" ||
      data.schemaVersion !== 1 ||
      !Array.isArray(data.records)
    )
      throw new Error("EXPORT_INVALID");
    for (const record of data.records) {
      const receipt = verifyEnvelope(record.receipt, publicKey);
      if (
        receipt.status !== "STAGED" ||
        receipt.ingressIndex !== ++index ||
        receipt.previousReceiptHash !== previous ||
        receipt.payloadHash !== hash(record.eventEnvelope.payload) ||
        receipt.envelopeHash !== hash(record.eventEnvelope)
      )
        throw new Error("EXPORT_INVALID");
      previous = hash(record.receipt);
    }
    process.stdout.write("STAGED_EXPORT_SIGNATURES_VERIFIED " + index + "\n");
    return;
  }
  throw new Error("COMMAND_INVALID");
}
if (require.main === module)
  main().catch((error) => {
    process.stderr.write(
      (/^[A-Z][A-Z0-9_]+$/.test(error.code || "")
        ? error.code
        : /^[A-Z][A-Z0-9_]+$/.test(error.message || "")
          ? error.message
          : "LOCAL_COMMAND_FAILED") + "\n",
    );
    process.exitCode = 1;
  });
module.exports = { args };
