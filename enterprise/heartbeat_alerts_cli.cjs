"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { HeartbeatAlerts } = require("./heartbeat_alerts.cjs"),
  { exact } = require("./durable_journal.cjs"),
  { readJournal, publicKeyFile } = require("./storage_verify.cjs");
const { reviewHtml, labels } = require("./heartbeat_alerts_review.cjs");
function main() {
  const command = process.argv[2],
    args = process.argv.slice(3),
    options = {};
  const worker = ["directory", "config", "private-key"],
    required = {
      observe: [...worker, "journal", "out"],
      pending: [...worker, "out"],
      ack: [...worker, "notification-id", "consumer-id"],
      verify: ["config", "journal", "out"],
      review: ["config", "journal", "out"],
    };
  const optional = {
    observe: ["expected-head", "expected-source-head"],
    pending: ["expected-head", "limit"],
    ack: ["expected-head"],
    verify: ["expected-head", "source-journal", "expected-source-head"],
    review: ["expected-head", "lang", "source-journal", "expected-source-head"],
  };
  if (!Object.hasOwn(required, command))
    throw new Error("HEARTBEAT_ALERT_COMMAND_INVALID");
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i]?.slice(2);
    if (
      !args[i]?.startsWith("--") ||
      ![...required[command], ...optional[command]].includes(k) ||
      !args[i + 1] ||
      Object.hasOwn(options, k)
    )
      throw new Error("HEARTBEAT_ALERT_ARGUMENT_INVALID");
    options[k] = args[i + 1];
  }
  if (required[command].some((k) => !options[k]))
    throw new Error("HEARTBEAT_ALERT_ARGUMENT_REQUIRED");
  for (const k of ["expected-head", "expected-source-head"])
    if (options[k] !== undefined && !/^[a-f0-9]{64}$/.test(options[k]))
      throw new Error("HEARTBEAT_ALERT_HEAD_INVALID");
  if (command === "review" && !Object.hasOwn(labels, options.lang || "en"))
    throw new Error("HEARTBEAT_ALERT_LANGUAGE_INVALID");
  if (
    ["verify", "review"].includes(command) &&
    options["expected-source-head"] !== undefined &&
    !options["source-journal"]
  )
    throw new Error("HEARTBEAT_ALERT_SOURCE_REQUIRED");
  const limit = options.limit === undefined ? 100 : Number(options.limit);
  if (
    options.limit !== undefined &&
    (!/^[1-9][0-9]*$/.test(options.limit) ||
      !Number.isSafeInteger(limit) ||
      limit > 1000)
  )
    throw new Error("HEARTBEAT_ALERT_LIMIT_INVALID");
  if (options.out && fs.existsSync(options.out))
    throw new Error("HEARTBEAT_ALERT_OUTPUT_EXISTS");
  const json = (file, max) =>
    JSON.parse(readJournal(file, max).toString("utf8"));
  const c = json(options.config, 65536);
  if (
    !exact(
      c,
      "schemaVersion,signerKeyId,signerPublicKeyFile,heartbeatConfigFile,cooldownMs,maxSnapshotAgeMs,maxPending",
    ) ||
    c.schemaVersion !== 1
  )
    throw new Error("HEARTBEAT_ALERT_CONFIG_INVALID");
  for (const k of ["signerPublicKeyFile", "heartbeatConfigFile"])
    if (typeof c[k] !== "string" || !path.isAbsolute(c[k]))
      throw new Error("HEARTBEAT_ALERT_CONFIG_PATH_INVALID");
  const h = json(c.heartbeatConfigFile, 65536);
  if (
    !exact(
      h,
      "schemaVersion,organizationId,signerKeyId,signerPublicKeyFile,registryFile,minimumExtensionVersion,lateAfterMs,unknownAfterMs,maxClockSkewMs",
    ) ||
    h.schemaVersion !== 1
  )
    throw new Error("HEARTBEAT_CONFIG_INVALID");
  for (const k of ["signerPublicKeyFile", "registryFile"])
    if (typeof h[k] !== "string" || !path.isAbsolute(h[k]))
      throw new Error("HEARTBEAT_CONFIG_PATH_INVALID");
  const registry = json(h.registryFile, 1024 * 1024);
  if (!exact(registry, "registrations"))
    throw new Error("HEARTBEAT_REGISTRY_INVALID");
  const source = {
    organizationId: h.organizationId,
    registrations: registry.registrations,
    minimumExtensionVersion: h.minimumExtensionVersion,
    lateAfterMs: h.lateAfterMs,
    unknownAfterMs: h.unknownAfterMs,
    maxClockSkewMs: h.maxClockSkewMs,
    signerKeyId: h.signerKeyId,
    signerPublicKey: publicKeyFile(h.signerPublicKeyFile),
  };
  const signerPublicKey = publicKeyFile(c.signerPublicKeyFile),
    context = {
      source,
      signerKeyId: c.signerKeyId,
      cooldownMs: c.cooldownMs,
      maxSnapshotAgeMs: c.maxSnapshotAgeMs,
      maxPending: c.maxPending,
      ...(options["expected-head"] === undefined
        ? {}
        : { expectedHead: options["expected-head"] }),
    };
  let monitor, report;
  try {
    if (command === "verify" || command === "review")
      report =
        options["source-journal"] === undefined
          ? HeartbeatAlerts.verifyJournal(
              readJournal(options.journal, 32 * 1024 * 1024),
              { ...context, signerPublicKey },
            )
          : HeartbeatAlerts.verifyWithSource(
              readJournal(options.journal, 32 * 1024 * 1024),
              readJournal(options["source-journal"], 32 * 1024 * 1024),
              {
                ...context,
                signerPublicKey,
                ...(options["expected-source-head"] === undefined
                  ? {}
                  : { expectedSourceHead: options["expected-source-head"] }),
              },
            );
    else {
      const stat = fs.lstatSync(options["private-key"]);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.uid !== process.getuid() ||
        (stat.mode & 0o077) !== 0
      )
        throw new Error("HEARTBEAT_ALERT_KEY_PERMISSIONS");
      const signerPrivateKey = readJournal(
          options["private-key"],
          65536,
        ).toString("utf8"),
        derived = crypto
          .createPublicKey(signerPrivateKey)
          .export({ type: "spki", format: "der" });
      if (
        !derived.equals(signerPublicKey.export({ type: "spki", format: "der" }))
      )
        throw new Error("HEARTBEAT_ALERT_WRITER_KEY_MISMATCH");
      monitor = new HeartbeatAlerts({
        ...context,
        directory: options.directory,
        signerPrivateKey,
      });
      if (command === "ack") {
        const result = monitor.acknowledge(options["notification-id"], {
          consumerId: options["consumer-id"],
        });
        process.stdout.write(
          JSON.stringify({
            notificationId: result.notification.notificationId,
            duplicate: result.duplicate,
            journalHead: monitor.journal.head(),
            externalDeliveryVerified: false,
          }) + "\n",
        );
        return;
      }
      report =
        command === "pending"
          ? { ...monitor.status(), notifications: monitor.pending({ limit }) }
          : monitor.observe(
              readJournal(options.journal, 32 * 1024 * 1024),
              options["expected-source-head"] === undefined
                ? {}
                : { expectedSourceHead: options["expected-source-head"] },
            );
    }
    fs.writeFileSync(
      options.out,
      command === "review"
        ? reviewHtml(report, options.lang || "en")
        : JSON.stringify(report, null, 2) + "\n",
      {
        flag: "wx",
        mode: 0o600,
      },
    );
    process.stdout.write("HEARTBEAT_ALERT_REPORT_CREATED\n");
  } finally {
    monitor?.close();
  }
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    const code = error.code || error.message;
    process.stderr.write(
      (/^[A-Z][A-Z0-9_]+$/.test(code) ? code : "HEARTBEAT_ALERT_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
}
