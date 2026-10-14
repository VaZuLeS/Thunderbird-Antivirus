"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Ledger, signed } = require("./ledger.cjs");
const { createService } = require("./service.cjs");
const { reviewHtml } = require("./review.cjs");
const { makeCheckpoint, verifyEvidence } = require("./evidence.cjs");
const { readJson, readRegistry } = require("./witness_cli.cjs");
function args(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]?.slice(2);
    if (
      !argv[i]?.startsWith("--") ||
      ![
        "data-dir",
        "port",
        "out",
        "lang",
        "public-key",
        "server-key-id",
        "registry",
        "witness-anchor",
        "witness-public-key",
        "expected-anchor-hash",
        "coverage",
      ].includes(name) ||
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
  const allowedOptions = {
    init: ["data-dir"],
    serve: ["data-dir", "port"],
    demo: ["data-dir"],
    review: ["data-dir", "out", "lang"],
    export: ["data-dir", "out"],
    checkpoint: ["data-dir", "out"],
    verify: [
      "out",
      "public-key",
      "server-key-id",
      "registry",
      "witness-anchor",
      "witness-public-key",
      "expected-anchor-hash",
      "coverage",
    ],
  };
  if (!Object.hasOwn(allowedOptions, command))
    throw new Error("COMMAND_INVALID");
  if (
    Object.keys(options).some((key) => !allowedOptions[command].includes(key))
  )
    throw new Error("OPTION_NOT_SUPPORTED");
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
  if (command === "checkpoint") {
    if (!options.out) throw new Error("OUTPUT_REQUIRED");
    const ledger = open(directory);
    try {
      const data = {
          kind: "thundy-staged-journal-export",
          schemaVersion: 1,
          records: ledger.exportRecords(),
        },
        config = load(directory);
      const checkpoint = makeCheckpoint(data, {
        serverPrivateKey: ledger.privateKey,
        serverKeyId: ledger.serverKeyId,
        registrations: config.registrations,
      });
      writePrivate(options.out, JSON.stringify(checkpoint, null, 2) + "\n");
      process.stdout.write("STAGED_CHECKPOINT_WRITTEN\n");
    } finally {
      ledger.close();
    }
    return;
  }
  if (command === "verify") {
    if (!options.out || !options["public-key"])
      throw new Error("EXPORT_AND_PUBLIC_KEY_REQUIRED");
    const trustOptions = {
      serverPublicKey: fs.readFileSync(options["public-key"]),
      serverKeyId: options["server-key-id"] || null,
    };
    if (options.registry)
      trustOptions.registrations = readRegistry(options.registry);
    if (options["witness-anchor"])
      trustOptions.witnessAnchor = readJson(options["witness-anchor"], 65536);
    if (options["witness-public-key"])
      trustOptions.witnessPublicKey = fs.readFileSync(
        options["witness-public-key"],
      );
    if (options["expected-anchor-hash"])
      trustOptions.expectedAnchorHash = options["expected-anchor-hash"];
    if (options.coverage && !["snapshot", "prefix"].includes(options.coverage))
      throw new Error("COVERAGE_INVALID");
    trustOptions.allowExtension = options.coverage === "prefix";
    const report = verifyEvidence(readJson(options.out), trustOptions);
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
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
