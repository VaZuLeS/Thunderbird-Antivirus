"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { StorageJobs } = require("./storage_jobs.cjs");
const { reviewHtml, labels } = require("./storage_review.cjs");
const { readJson, readRegistry } = require("./witness_cli.cjs");
function parse(command, argv) {
  const commands = {
    enqueue: ["export", "witness-anchor", "expected-anchor-hash", "directory"],
    "enqueue-cloud": [
      "export",
      "witness-anchor",
      "expected-anchor-hash",
      "destination",
    ],
    run: [],
    status: [],
    review: ["out"],
    retry: ["job-id"],
  };
  if (!Object.hasOwn(commands, command))
    throw new Error("JOBS_COMMAND_INVALID");
  const allowed = ["queue", "config", ...commands[command]],
    options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.slice(2);
    if (
      !argv[i]?.startsWith("--") ||
      ![
        ...allowed,
        "expected-head",
        ...(command === "review" ? ["lang"] : []),
      ].includes(key) ||
      !argv[i + 1] ||
      Object.hasOwn(options, key)
    )
      throw new Error("JOBS_OPTION_INVALID");
    options[key] = argv[i + 1];
  }
  if (allowed.some((key) => !options[key]))
    throw new Error("JOBS_OPTION_REQUIRED");
  return options;
}
function loadConfig(file) {
  const config = readJson(file, 65536),
    keys = [
      "schemaVersion",
      "signerKeyId",
      "signerPrivateKeyFile",
      "serverKeyId",
      "serverPublicKeyFile",
      "registryFile",
      "witnessPublicKeyFile",
    ];
  if (
    !config ||
    Object.keys(config).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(config, key)) ||
    config.schemaVersion !== 1
  )
    throw new Error("JOBS_CONFIG_INVALID");
  for (const key of [
    "signerPrivateKeyFile",
    "serverPublicKeyFile",
    "registryFile",
    "witnessPublicKeyFile",
  ]) {
    if (typeof config[key] !== "string" || !path.isAbsolute(config[key]))
      throw new Error("JOBS_CONFIG_PATH_INVALID");
  }
  const s = fs.lstatSync(config.signerPrivateKeyFile);
  if (
    process.platform === "win32" ||
    !s.isFile() ||
    s.isSymbolicLink() ||
    s.uid !== process.getuid() ||
    (s.mode & 0o077) !== 0 ||
    s.size > 65536
  )
    throw new Error("JOBS_PRIVATE_KEY_INVALID");
  return {
    signerKeyId: config.signerKeyId,
    signerPrivateKey: fs.readFileSync(config.signerPrivateKeyFile),
    trust: {
      serverKeyId: config.serverKeyId,
      serverPublicKey: fs.readFileSync(config.serverPublicKeyFile),
      registrations: readRegistry(config.registryFile),
      witnessPublicKey: fs.readFileSync(config.witnessPublicKeyFile),
    },
  };
}
function main() {
  const command = process.argv[2],
    o = parse(command, process.argv.slice(3));
  if (command === "review") {
    if (!Object.hasOwn(labels, o.lang || "en"))
      throw new Error("LANGUAGE_INVALID");
    if (fs.existsSync(o.out)) throw new Error("JOBS_REVIEW_OUTPUT_EXISTS");
  }
  const jobs = new StorageJobs({
    ...loadConfig(o.config),
    directory: o.queue,
    expectedHead: o["expected-head"],
  });
  try {
    let report;
    if (command === "enqueue")
      report = jobs.enqueue(readJson(o.export), {
        witnessAnchor: readJson(o["witness-anchor"], 65536),
        expectedAnchorHash: o["expected-anchor-hash"],
        directory: o.directory,
      });
    else if (command === "enqueue-cloud") {
      const destination = readJson(o.destination, 65536);
      if (
        !destination ||
        Object.keys(destination).length !== 2 ||
        !Object.hasOwn(destination, "provider") ||
        !Object.hasOwn(destination, "settings")
      )
        throw new Error("STORAGE_DESTINATION_INVALID");
      report = jobs.enqueueCloud(readJson(o.export), {
        witnessAnchor: readJson(o["witness-anchor"], 65536),
        expectedAnchorHash: o["expected-anchor-hash"],
        provider: destination.provider,
        settings: destination.settings,
      });
    } else if (command === "run") report = jobs.runOne();
    else if (command === "retry") report = jobs.retry(o["job-id"]);
    else if (command === "review") {
      const status = jobs.status(),
        language = o.lang || "en";
      fs.writeFileSync(
        o.out,
        reviewHtml(status, language, {
          headPinned: o["expected-head"] !== undefined,
        }),
        { flag: "wx", mode: 0o600 },
      );
      report = {
        out: o.out,
        language,
        jobCount: status.jobs.length,
        sealed: false,
      };
    } else report = jobs.status();
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } finally {
    jobs.close();
  }
}
if (require.main === module)
  try {
    main();
  } catch (error) {
    process.stderr.write(
      (/^[A-Z][A-Z0-9_]+$/.test(error.code || "")
        ? error.code
        : /^[A-Z][A-Z0-9_]+$/.test(error.message || "")
          ? error.message
          : "JOBS_COMMAND_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
module.exports = { parse, loadConfig };
