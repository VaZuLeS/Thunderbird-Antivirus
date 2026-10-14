"use strict";
const fs = require("node:fs");
const { readJournal } = require("./storage_verify.cjs");
const { HealthMonitor, summarize } = require("./health.cjs");
const { reviewHtml, labels } = require("./health_review.cjs");
function main() {
  const command = process.argv[2],
    args = process.argv.slice(3),
    options = {};
  if (!["report", "observe"].includes(command))
    throw new Error("HEALTH_COMMAND_INVALID");
  const allowed =
    command === "report"
      ? ["input", "out"]
      : ["input", "out", "directory", "key-id", "private-key"];
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i]?.slice(2);
    if (
      !args[i]?.startsWith("--") ||
      ![...allowed, "format", "lang"].includes(k) ||
      !args[i + 1] ||
      Object.hasOwn(options, k)
    )
      throw new Error("HEALTH_ARGUMENT_INVALID");
    options[k] = args[i + 1];
  }
  if (allowed.some((k) => !options[k]))
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
  if (fs.existsSync(options.out)) throw new Error("HEALTH_OUTPUT_EXISTS");
  const input = JSON.parse(
    readJournal(options.input, 4 * 1024 * 1024).toString("utf8"),
  );
  let monitor, report;
  try {
    if (command === "observe") {
      const stat = fs.lstatSync(options["private-key"]);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.uid !== process.getuid() ||
        (stat.mode & 0o077) !== 0
      )
        throw new Error("HEALTH_PRIVATE_KEY_PERMISSIONS");
      const privateKey = readJournal(options["private-key"], 65536).toString(
        "utf8",
      );
      monitor = new HealthMonitor({
        directory: options.directory,
        signerKeyId: options["key-id"],
        signerPrivateKey: privateKey,
        sourceId: input.sourceId,
      });
      report = monitor.observe(input);
    } else report = summarize(input, Date.now());
    fs.writeFileSync(
      options.out,
      options.format === "html"
        ? reviewHtml(report, options.lang || "en")
        : JSON.stringify(report, null, 2) + "\n",
      {
        flag: "wx",
        mode: 0o600,
      },
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
