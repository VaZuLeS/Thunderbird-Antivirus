"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { CapacityAlerts } = require("./capacity_alerts.cjs"),
  { exact } = require("./durable_journal.cjs"),
  { readJournal, publicKeyFile } = require("./storage_verify.cjs"),
  { loadHeartbeatPublicConfig } = require("./heartbeat_public_config.cjs"),
  { writeExclusive } = require("./write_exclusive.cjs"),
  limits = require("./review_limits.cjs");
function main() {
  const command = process.argv[2],
    options = {},
    args = process.argv.slice(3),
    worker = ["config", "directory", "private-key"],
    required = {
      observe: [...worker, "journal", "source-journal", "out"],
      "observe-package": [...worker, "package", "out"],
      pending: [...worker, "out"],
      ack: [...worker, "notification-id", "consumer-id"],
      verify: ["config", "journal", "out"],
      review: ["config", "journal", "out"],
    },
    optional = {
      observe: ["expected-head", "expected-alarm-head", "expected-source-head"],
      "observe-package": [
        "expected-head",
        "expected-alarm-head",
        "expected-source-head",
        "expected-package-hash",
      ],
      pending: ["expected-head", "limit"],
      ack: ["expected-head"],
      verify: ["expected-head"],
      review: ["expected-head", "lang"],
    };
  if (!Object.hasOwn(required, command))
    throw new Error("CAPACITY_ALERT_COMMAND_INVALID");
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i]?.slice(2);
    if (
      !args[i]?.startsWith("--") ||
      ![...required[command], ...optional[command]].includes(k) ||
      !args[i + 1] ||
      Object.hasOwn(options, k)
    )
      throw new Error("CAPACITY_ALERT_ARGUMENT_INVALID");
    options[k] = args[i + 1];
  }
  if (required[command].some((k) => !options[k]))
    throw new Error("CAPACITY_ALERT_ARGUMENT_REQUIRED");
  for (const k of [
    "expected-head",
    "expected-alarm-head",
    "expected-source-head",
    "expected-package-hash",
  ])
    if (options[k] !== undefined && !/^[a-f0-9]{64}$/.test(options[k]))
      throw new Error("CAPACITY_ALERT_PIN_INVALID");
  const limit = options.limit === undefined ? 100 : Number(options.limit);
  if (
    options.limit !== undefined &&
    (!/^[1-9][0-9]*$/.test(options.limit) ||
      !Number.isSafeInteger(limit) ||
      limit > 1000)
  )
    throw new Error("CAPACITY_ALERT_LIMIT_INVALID");
  if (
    command === "review" &&
    !["en", "de", "fr", "es", "it", "pl"].includes(options.lang || "en")
  )
    throw new Error("CAPACITY_ALERT_LANGUAGE_INVALID");
  // lstat also catches dangling symlinks before any journal mutation.
  if (options.out) {
    try {
      fs.lstatSync(options.out);
      throw new Error("CAPACITY_ALERT_OUTPUT_EXISTS");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  const c = JSON.parse(readJournal(options.config, 65536));
  if (
    !exact(
      c,
      "schemaVersion,signerKeyId,signerPublicKeyFile,heartbeatAlertsConfigFile,warningPercent,recoveryPercent,cooldownMs,maxPending",
    ) ||
    c.schemaVersion !== 1 ||
    ![c.signerPublicKeyFile, c.heartbeatAlertsConfigFile].every(
      (v) => typeof v === "string" && path.isAbsolute(v),
    )
  )
    throw new Error("CAPACITY_ALERT_CONFIG_INVALID");
  const context = {
      trustedContext: loadHeartbeatPublicConfig(c.heartbeatAlertsConfigFile),
      warningPercent: c.warningPercent,
      recoveryPercent: c.recoveryPercent,
      cooldownMs: c.cooldownMs,
      maxPending: c.maxPending,
    },
    signerPublicKey = publicKeyFile(c.signerPublicKeyFile),
    head =
      options["expected-head"] === undefined
        ? {}
        : { expectedHead: options["expected-head"] };
  let monitor, report;
  try {
    if (["verify", "review"].includes(command)) {
      const content = readJournal(options.journal, limits.journalBytes),
        verification = {
          ...context,
          ...head,
          signerKeyId: c.signerKeyId,
          signerPublicKey,
        };
      report =
        command === "review"
          ? require("./capacity_alerts_review.cjs").reviewHtml(
              content,
              verification,
              options.lang || "en",
            )
          : CapacityAlerts.verifyJournal(content, verification);
    } else {
      const stat = fs.lstatSync(options["private-key"]);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.uid !== process.getuid() ||
        (stat.mode & 0o077) !== 0
      )
        throw new Error("CAPACITY_ALERT_KEY_PERMISSIONS");
      const signerPrivateKey = readJournal(
        options["private-key"],
        65536,
      ).toString("utf8");
      if (
        !crypto
          .createPublicKey(signerPrivateKey)
          .export({ type: "spki", format: "der" })
          .equals(signerPublicKey.export({ type: "spki", format: "der" }))
      )
        throw new Error("CAPACITY_ALERT_WRITER_KEY_MISMATCH");
      monitor = new CapacityAlerts({
        ...context,
        ...head,
        directory: options.directory,
        signerKeyId: c.signerKeyId,
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
      const pins = Object.fromEntries(
        [
          ["expected-alarm-head", "expectedHead"],
          ["expected-source-head", "expectedSourceHead"],
          ["expected-package-hash", "expectedPackageHash"],
        ]
          .filter(([k]) => options[k] !== undefined)
          .map(([k, v]) => [v, options[k]]),
      );
      report =
        command === "pending"
          ? { ...monitor.status(), notifications: monitor.pending({ limit }) }
          : command === "observe"
            ? monitor.observeJournals(
                readJournal(options.journal, limits.journalBytes),
                readJournal(options["source-journal"], limits.journalBytes),
                pins,
              )
            : monitor.observePackage(
                readJournal(options.package, limits.packageBytes),
                pins,
              );
    }
    writeExclusive(
      options.out,
      command === "review" ? report : JSON.stringify(report, null, 2) + "\n",
    );
    process.stdout.write("CAPACITY_ALERT_REPORT_CREATED\n");
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
      (/^[A-Z][A-Z0-9_]+$/.test(code) ? code : "CAPACITY_ALERT_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
}
