"use strict";
const fs = require("node:fs");
const { capacityFromJournals, capacityFromPackage } = require("./capacity.cjs"),
  { loadHeartbeatPublicConfig } = require("./heartbeat_public_config.cjs"),
  { readJournal } = require("./storage_verify.cjs"),
  { writeExclusive } = require("./write_exclusive.cjs"),
  { reviewHtml, labels } = require("./capacity_review.cjs"),
  limits = require("./review_limits.cjs");
function main() {
  const command = process.argv[2],
    args = process.argv.slice(3),
    options = {},
    required = {
      journals: ["config", "journal", "source-journal", "out"],
      package: ["config", "package", "out"],
    },
    common = [
      "expected-head",
      "expected-source-head",
      "format",
      "lang",
      "warning-percent",
    ];
  if (!Object.hasOwn(required, command))
    throw new Error("CAPACITY_COMMAND_INVALID");
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i]?.slice(2);
    if (
      !args[i]?.startsWith("--") ||
      ![
        ...required[command],
        ...common,
        ...(command === "package" ? ["expected-package-hash"] : []),
      ].includes(k) ||
      !args[i + 1] ||
      Object.hasOwn(options, k)
    )
      throw new Error("CAPACITY_ARGUMENT_INVALID");
    options[k] = args[i + 1];
  }
  if (required[command].some((k) => !options[k]))
    throw new Error("CAPACITY_ARGUMENT_REQUIRED");
  const format = options.format || "json";
  if (!["json", "html"].includes(format))
    throw new Error("CAPACITY_FORMAT_INVALID");
  if (options.lang !== undefined && format !== "html")
    throw new Error("CAPACITY_LANGUAGE_REQUIRES_HTML");
  if (format === "html" && !Object.hasOwn(labels, options.lang || "en"))
    throw new Error("CAPACITY_LANGUAGE_INVALID");
  for (const k of [
    "expected-head",
    "expected-source-head",
    "expected-package-hash",
  ])
    if (options[k] !== undefined && !/^[a-f0-9]{64}$/.test(options[k]))
      throw new Error("CAPACITY_PIN_INVALID");
  const warningPercent =
    options["warning-percent"] === undefined
      ? 80
      : Number(options["warning-percent"]);
  if (
    options["warning-percent"] !== undefined &&
    (!/^[1-9][0-9]?$/.test(options["warning-percent"]) || warningPercent >= 100)
  )
    throw new Error("CAPACITY_THRESHOLD_INVALID");
  if (fs.existsSync(options.out)) throw new Error("CAPACITY_OUTPUT_EXISTS");
  const input = {
    trustedContext: loadHeartbeatPublicConfig(options.config),
    warningPercent,
    ...(options["expected-head"] === undefined
      ? {}
      : { expectedHead: options["expected-head"] }),
    ...(options["expected-source-head"] === undefined
      ? {}
      : { expectedSourceHead: options["expected-source-head"] }),
  };
  const report =
    command === "journals"
      ? capacityFromJournals(
          readJournal(options.journal, limits.journalBytes),
          readJournal(options["source-journal"], limits.journalBytes),
          input,
        )
      : capacityFromPackage(readJournal(options.package, limits.packageBytes), {
          ...input,
          ...(options["expected-package-hash"] === undefined
            ? {}
            : { expectedPackageHash: options["expected-package-hash"] }),
        });
  writeExclusive(
    options.out,
    format === "html"
      ? reviewHtml(report, options.lang || "en")
      : JSON.stringify(report, null, 2) + "\n",
  );
  process.stdout.write("CAPACITY_REPORT_CREATED\n");
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    const code = error.code || error.message;
    process.stderr.write(
      (/^[A-Z][A-Z0-9_]+$/.test(code) ? code : "CAPACITY_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
}
