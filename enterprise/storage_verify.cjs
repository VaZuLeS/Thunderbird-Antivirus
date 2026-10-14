"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { StorageJobs } = require("./storage_jobs.cjs");
const { reviewHtml, labels } = require("./storage_review.cjs");
const { readJson, readRegistry } = require("./witness_cli.cjs");
const need = (ok, code) => {
  if (!ok) throw new Error(code);
};
function publicKeyFile(file) {
  const stat = fs.lstatSync(file);
  need(
    stat.isFile() && !stat.isSymbolicLink() && stat.size <= 65536,
    "VERIFY_PUBLIC_KEY_INVALID",
  );
  const value = fs.readFileSync(file, "utf8");
  need(
    /^-----BEGIN PUBLIC KEY-----\r?\n/.test(value) &&
      !value.includes("PRIVATE KEY"),
    "VERIFY_PUBLIC_KEY_REQUIRED",
  );
  const key = crypto.createPublicKey(value);
  need(key.asymmetricKeyType === "ed25519", "VERIFY_PUBLIC_KEY_INVALID");
  return key;
}
function loadConfig(file) {
  const config = readJson(file, 65536),
    keys = [
      "schemaVersion",
      "signerKeyId",
      "signerPublicKeyFile",
      "serverKeyId",
      "serverPublicKeyFile",
      "witnessPublicKeyFile",
      "registryFile",
    ];
  need(
    config &&
      typeof config === "object" &&
      Object.keys(config).length === keys.length &&
      keys.every((key) => Object.hasOwn(config, key)) &&
      config.schemaVersion === 1,
    "VERIFY_CONFIG_INVALID",
  );
  for (const key of [
    "signerPublicKeyFile",
    "serverPublicKeyFile",
    "witnessPublicKeyFile",
    "registryFile",
  ])
    need(
      typeof config[key] === "string" && path.isAbsolute(config[key]),
      "VERIFY_CONFIG_PATH_INVALID",
    );
  return {
    signerKeyId: config.signerKeyId,
    signerPublicKey: publicKeyFile(config.signerPublicKeyFile),
    trust: {
      serverKeyId: config.serverKeyId,
      serverPublicKey: publicKeyFile(config.serverPublicKeyFile),
      witnessPublicKey: publicKeyFile(config.witnessPublicKeyFile),
      registrations: readRegistry(config.registryFile),
    },
  };
}
function readJournal(file, maxBytes = 128 * 1024 * 1024) {
  const entry = fs.lstatSync(file);
  need(entry.isFile() && !entry.isSymbolicLink(), "VERIFY_JOURNAL_INVALID");
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd);
    need(before.isFile() && before.size <= maxBytes, "VERIFY_JOURNAL_INVALID");
    const chunks = [];
    let total = 0;
    while (true) {
      const buffer = Buffer.alloc(Math.min(65536, maxBytes - total + 1));
      const n = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!n) break;
      total += n;
      need(total <= maxBytes, "VERIFY_JOURNAL_TOO_LARGE");
      chunks.push(buffer.subarray(0, n));
    }
    const after = fs.fstatSync(fd);
    need(
      before.size === after.size &&
        before.mtimeMs === after.mtimeMs &&
        before.ctimeMs === after.ctimeMs &&
        total === before.size,
      "VERIFY_JOURNAL_CHANGED",
    );
    return Buffer.concat(chunks, total);
  } finally {
    fs.closeSync(fd);
  }
}
function parse(command, args) {
  need(["verify", "review"].includes(command), "VERIFY_COMMAND_INVALID");
  const required = [
      "journal",
      "config",
      ...(command === "review" ? ["out"] : []),
    ],
    allowed = [
      ...required,
      "expected-head",
      ...(command === "review" ? ["lang"] : []),
    ],
    options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.slice(2);
    need(
      args[i]?.startsWith("--") &&
        allowed.includes(key) &&
        args[i + 1] &&
        !Object.hasOwn(options, key),
      "VERIFY_ARGUMENT_INVALID",
    );
    options[key] = args[i + 1];
  }
  need(
    required.every((key) => options[key]),
    "VERIFY_ARGUMENT_REQUIRED",
  );
  return options;
}
function main() {
  const command = process.argv[2],
    o = parse(command, process.argv.slice(3));
  if (command === "review") {
    need(Object.hasOwn(labels, o.lang || "en"), "LANGUAGE_INVALID");
    need(!fs.existsSync(o.out), "VERIFY_OUTPUT_EXISTS");
  }
  const options = loadConfig(o.config),
    status = StorageJobs.verifyJournal(readJournal(o.journal), {
      ...options,
      expectedHead: o["expected-head"],
    });
  if (command === "review") {
    // Create only the requested report. No lock, journal append or signature operation.
    fs.writeFileSync(
      o.out,
      reviewHtml(status, o.lang || "en", {
        headPinned: status.verification.headPinned,
      }),
      { flag: "wx", mode: 0o600 },
    );
    process.stdout.write(
      JSON.stringify(
        {
          out: o.out,
          language: o.lang || "en",
          jobCount: status.jobs.length,
          verification: status.verification,
        },
        null,
        2,
      ) + "\n",
    );
  } else process.stdout.write(JSON.stringify(status, null, 2) + "\n");
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
          : "VERIFY_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
module.exports = { publicKeyFile, loadConfig, readJournal, parse };
