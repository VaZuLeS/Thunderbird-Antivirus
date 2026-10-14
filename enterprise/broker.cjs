"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Outbox } = require("./outbox.cjs");
const { deliverOnce, pollOnce } = require("./delivery.cjs");
function parse(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]?.slice(2);
    if (
      !argv[index]?.startsWith("--") ||
      !["data-dir", "input", "origin", "event-id"].includes(name) ||
      !argv[index + 1] ||
      Object.hasOwn(options, name)
    )
      throw new Error("ARGUMENT_INVALID");
    options[name] = argv[index + 1];
  }
  return options;
}
function open(directory) {
  const config = JSON.parse(
    fs.readFileSync(path.join(directory, "config.json"), "utf8"),
  );
  if (config.mode !== "local-development")
    throw new Error("LOCAL_MODE_REQUIRED");
  return new Outbox({
    directory: path.join(directory, "outbox"),
    registration: config.registrations[0],
    devicePrivateKey: fs.readFileSync(
      path.join(directory, "device-private.pem"),
    ),
    serverKeyId: config.serverKeyId,
    serverPublicKey: fs.readFileSync(path.join(directory, "server-public.pem")),
  });
}
async function main() {
  const command = process.argv[2],
    options = parse(process.argv.slice(3)),
    outbox = open(path.resolve(options["data-dir"] || "enterprise/.local"));
  try {
    let result;
    if (command === "enqueue") {
      if (!options.input) throw new Error("INPUT_REQUIRED");
      const stat = fs.statSync(options.input);
      if (stat.size > 32768) throw new Error("EVENT_TOO_LARGE");
      const envelope = outbox.enqueue(
        JSON.parse(fs.readFileSync(options.input, "utf8")),
      );
      result = {
        queued: true,
        eventId: envelope.payload.eventId,
        sequence: envelope.payload.sequence,
        ...outbox.status(),
      };
    } else if (command === "demo") {
      const started = Date.now() - 10000,
        version = require("../manifest.json").version;
      const emit = (
        interactionId,
        kind,
        outcome,
        attemptNumber,
        score,
        seconds,
        domain,
        reason = null,
      ) =>
        outbox.enqueue({
          interactionId,
          observedAt: new Date(started + seconds * 1000).toISOString(),
          kind,
          outcome,
          attemptNumber,
          extensionVersion: version,
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
                : new Date(started + seconds * 1000).toISOString(),
            reasonCodes: [],
          },
          reason,
        });
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
      const aborted = crypto.randomUUID();
      emit(aborted, "CLICKED", null, 0, null, 4, "https://unknown.example");
      emit(
        aborted,
        "DECISION",
        "ABORTED",
        0,
        null,
        5,
        "https://unknown.example",
        "escape",
      );
      result = { syntheticEventsQueued: 6, ...outbox.status() };
    } else if (command === "retry") {
      if (!options["event-id"]) throw new Error("EVENT_ID_REQUIRED");
      result = outbox.retry(options["event-id"]);
    } else if (command === "status") result = outbox.status();
    else if (command === "deliver")
      result = await deliverOnce(outbox, {
        serviceOrigin: options.origin || "http://127.0.0.1:8766",
      });
    else if (command === "poll")
      result = await pollOnce(outbox, {
        serviceOrigin: options.origin || "http://127.0.0.1:8766",
      });
    else throw new Error("COMMAND_INVALID");
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } finally {
    outbox.close();
  }
}
if (require.main === module)
  main().catch((error) => {
    process.stderr.write(
      (/^[A-Z][A-Z0-9_]+$/.test(error.code || "")
        ? error.code
        : /^[A-Z][A-Z0-9_]+$/.test(error.message || "")
          ? error.message
          : "BROKER_COMMAND_FAILED") + "\n",
    );
    process.exitCode = 1;
  });
module.exports = { open, parse };
