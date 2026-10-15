"use strict";
const fs = require("node:fs");
const {
    createPackage,
    verifyPackage,
    MAX_BYTES,
  } = require("./review_package.cjs"),
  { loadHeartbeatPublicConfig } = require("./heartbeat_public_config.cjs"),
  { readJournal } = require("./storage_verify.cjs"),
  { reviewHtml, labels } = require("./heartbeat_alerts_review.cjs");
const { writeExclusive } = require("./write_exclusive.cjs");
function main() {
  const command = process.argv[2],
    args = process.argv.slice(3),
    options = {},
    required = {
      create: ["config", "journal", "source-journal", "out"],
      verify: ["config", "package", "out"],
      review: ["config", "package", "out"],
    },
    optional = {
      create: ["expected-head", "expected-source-head"],
      verify: [
        "expected-head",
        "expected-source-head",
        "expected-package-hash",
      ],
      review: [
        "expected-head",
        "expected-source-head",
        "expected-package-hash",
        "lang",
      ],
    };
  if (!Object.hasOwn(required, command))
    throw new Error("REVIEW_PACKAGE_COMMAND_INVALID");
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i]?.slice(2);
    if (
      !args[i]?.startsWith("--") ||
      ![...required[command], ...optional[command]].includes(k) ||
      !args[i + 1] ||
      Object.hasOwn(options, k)
    )
      throw new Error("REVIEW_PACKAGE_ARGUMENT_INVALID");
    options[k] = args[i + 1];
  }
  if (required[command].some((k) => !options[k]))
    throw new Error("REVIEW_PACKAGE_ARGUMENT_REQUIRED");
  if (command === "review" && !Object.hasOwn(labels, options.lang || "en"))
    throw new Error("REVIEW_PACKAGE_LANGUAGE_INVALID");
  for (const k of [
    "expected-head",
    "expected-source-head",
    "expected-package-hash",
  ])
    if (options[k] !== undefined && !/^[a-f0-9]{64}$/.test(options[k]))
      throw new Error("REVIEW_PACKAGE_PIN_INVALID");
  if (fs.existsSync(options.out))
    throw new Error("REVIEW_PACKAGE_OUTPUT_EXISTS");
  const context = loadHeartbeatPublicConfig(options.config),
    pins = {
      ...(options["expected-head"] === undefined
        ? {}
        : { expectedHead: options["expected-head"] }),
      ...(options["expected-source-head"] === undefined
        ? {}
        : { expectedSourceHead: options["expected-source-head"] }),
    };
  let output;
  if (command === "create")
    output = createPackage(
      readJournal(options.journal, 32 * 1024 * 1024),
      readJournal(options["source-journal"], 32 * 1024 * 1024),
      { trustedContext: context, ...pins },
    );
  else {
    const report = verifyPackage(readJournal(options.package, MAX_BYTES), {
      trustedContext: context,
      ...pins,
      ...(options["expected-package-hash"] === undefined
        ? {}
        : { expectedPackageHash: options["expected-package-hash"] }),
    });
    output =
      command === "review"
        ? reviewHtml(report, options.lang || "en")
        : JSON.stringify(report, null, 2) + "\n";
  }
  writeExclusive(options.out, output);
  process.stdout.write("REVIEW_PACKAGE_OUTPUT_CREATED\n");
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    const code = error.code || error.message;
    process.stderr.write(
      (/^[A-Z][A-Z0-9_]+$/.test(code) ? code : "REVIEW_PACKAGE_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
}
