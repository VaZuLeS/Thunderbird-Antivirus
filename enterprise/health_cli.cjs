"use strict";
const fs = require("node:fs");
const { readJournal } = require("./storage_verify.cjs");
const { HealthMonitor, summarize } = require("./health.cjs");
const { reviewHtml, labels } = require("./health_review.cjs");
function main() {
  const command = process.argv[2],
    args = process.argv.slice(3),
    options = {},
    worker = ["directory", "key-id", "private-key"];
  const required = {
    report: ["input", "out"],
    observe: ["input", "out", ...worker],
    pending: [...worker, "source-id", "out"],
    ack: [...worker, "source-id", "notification-id", "consumer-id"],
  };
  const optional = {
    report: ["format", "lang"],
    observe: ["format", "lang", "expected-head"],
    pending: ["limit", "expected-head"],
    ack: ["expected-head"],
  };
  if (!Object.hasOwn(required, command))
    throw new Error("HEALTH_COMMAND_INVALID");
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i]?.slice(2);
    if (
      !args[i]?.startsWith("--") ||
      ![...required[command], ...optional[command]].includes(k) ||
      !args[i + 1] ||
      Object.hasOwn(options, k)
    )
      throw new Error("HEALTH_ARGUMENT_INVALID");
    options[k] = args[i + 1];
  }
  if (required[command].some((k) => !options[k]))
    throw new Error("HEALTH_ARGUMENT_REQUIRED");
  if (
    options.format !== undefined &&
    !["json", "html"].includes(options.format)
  )
    throw new Error("HEALTH_FORMAT_INVALID");
  if (options.lang !== undefined && options.format !== "html")
    throw new Error("HEALTH_LANGUAGE_REQUIRES_HTML");
  if (options.format === "html" && !Object.hasOwn(labels, options.lang || "en"))
    throw new Error("HEALTH_LANGUAGE_INVALID");
  if (options.out && fs.existsSync(options.out))
    throw new Error("HEALTH_OUTPUT_EXISTS");
  if (
    options["expected-head"] !== undefined &&
    !/^[a-f0-9]{64}$/.test(options["expected-head"])
  )
    throw new Error("HEALTH_HEAD_INVALID");
  let limit = 100;
  if (options.limit !== undefined) {
    limit = Number(options.limit);
    if (
      !/^[1-9][0-9]*$/.test(options.limit) ||
      !Number.isSafeInteger(limit) ||
      limit > 1000
    )
      throw new Error("HEALTH_PENDING_LIMIT_INVALID");
  }
  const input = options.input
    ? JSON.parse(readJournal(options.input, 4 * 1024 * 1024).toString("utf8"))
    : null;
  let monitor, report;
  try {
    if (command !== "report") {
      const stat = fs.lstatSync(options["private-key"]);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.uid !== process.getuid() ||
        (stat.mode & 0o077) !== 0
      )
        throw new Error("HEALTH_PRIVATE_KEY_PERMISSIONS");
      monitor = new HealthMonitor({
        directory: options.directory,
        signerKeyId: options["key-id"],
        signerPrivateKey: readJournal(options["private-key"], 65536).toString(
          "utf8",
        ),
        sourceId: input?.sourceId || options["source-id"],
        ...(options["expected-head"] !== undefined
          ? { expectedHead: options["expected-head"] }
          : {}),
      });
    }
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
    if (command === "pending")
      report = {
        ...monitor.notificationStatus(),
        notifications: monitor.pending({ limit }),
      };
    else
      report =
        command === "observe"
          ? monitor.observe(input)
          : summarize(input, Date.now());
    fs.writeFileSync(
      options.out,
      options.format === "html"
        ? reviewHtml(report, options.lang || "en")
        : JSON.stringify(report, null, 2) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    process.stdout.write("HEALTH_REPORT_CREATED\n");
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
      (/^[A-Z][A-Z0-9_]+$/.test(code) ? code : "HEALTH_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
}
