"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { Heartbeats } = require("./heartbeats.cjs");
const { exact } = require("./durable_journal.cjs");
const { readJournal, publicKeyFile } = require("./storage_verify.cjs");
function main() {
  const command = process.argv[2],
    args = process.argv.slice(3),
    options = {},
    allowed = {
      accept: ["directory", "config", "private-key", "input"],
      verify: ["journal", "config", "out", "expected-head"],
    };
  if (!Object.hasOwn(allowed, command))
    throw new Error("HEARTBEAT_COMMAND_INVALID");
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i]?.slice(2);
    if (
      !args[i]?.startsWith("--") ||
      !allowed[command].includes(k) ||
      !args[i + 1] ||
      Object.hasOwn(options, k)
    )
      throw new Error("HEARTBEAT_ARGUMENT_INVALID");
    options[k] = args[i + 1];
  }
  if (
    allowed[command]
      .filter((k) => k !== "expected-head")
      .some((k) => !options[k])
  )
    throw new Error("HEARTBEAT_ARGUMENT_REQUIRED");
  const json = (file, max) =>
      JSON.parse(readJournal(file, max).toString("utf8")),
    c = json(options.config, 65536);
  if (
    !exact(
      c,
      "schemaVersion,organizationId,signerKeyId,signerPublicKeyFile,registryFile,minimumExtensionVersion,lateAfterMs,unknownAfterMs,maxClockSkewMs",
    ) ||
    c.schemaVersion !== 1
  )
    throw new Error("HEARTBEAT_CONFIG_INVALID");
  for (const key of ["signerPublicKeyFile", "registryFile"])
    if (typeof c[key] !== "string" || !path.isAbsolute(c[key]))
      throw new Error("HEARTBEAT_CONFIG_PATH_INVALID");
  const registry = json(c.registryFile, 1024 * 1024);
  if (!exact(registry, "registrations"))
    throw new Error("HEARTBEAT_REGISTRY_INVALID");
  const signerPublicKey = publicKeyFile(c.signerPublicKeyFile),
    context = {
      organizationId: c.organizationId,
      signerKeyId: c.signerKeyId,
      registrations: registry.registrations,
      minimumExtensionVersion: c.minimumExtensionVersion,
      lateAfterMs: c.lateAfterMs,
      unknownAfterMs: c.unknownAfterMs,
      maxClockSkewMs: c.maxClockSkewMs,
    };
  if (command === "verify") {
    if (
      options["expected-head"] !== undefined &&
      !/^[a-f0-9]{64}$/.test(options["expected-head"])
    )
      throw new Error("HEARTBEAT_HEAD_INVALID");
    const report = Heartbeats.verifyJournal(
      readJournal(options.journal, 32 * 1024 * 1024),
      {
        ...context,
        signerPublicKey,
        ...(options["expected-head"] !== undefined
          ? { expectedHead: options["expected-head"] }
          : {}),
      },
    );
    fs.writeFileSync(options.out, JSON.stringify(report, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    process.stdout.write("HEARTBEAT_REPORT_CREATED\n");
    return;
  }
  const stat = fs.lstatSync(options["private-key"]);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.uid !== process.getuid() ||
    (stat.mode & 0o077) !== 0
  )
    throw new Error("HEARTBEAT_KEY_PERMISSIONS");
  const signerPrivateKey = readJournal(options["private-key"], 65536).toString(
      "utf8",
    ),
    derived = crypto
      .createPublicKey(signerPrivateKey)
      .export({ type: "spki", format: "der" });
  if (!derived.equals(signerPublicKey.export({ type: "spki", format: "der" })))
    throw new Error("HEARTBEAT_WRITER_KEY_MISMATCH");
  const store = new Heartbeats({
    ...context,
    directory: options.directory,
    signerPrivateKey,
  });
  try {
    const result = store.accept(json(options.input, 16384));
    process.stdout.write(
      JSON.stringify({ duplicate: result.duplicate, receipt: result.receipt }) +
        "\n",
    );
  } finally {
    store.close();
  }
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    const code = error.code || error.message;
    process.stderr.write(
      (/^[A-Z][A-Z0-9_]+$/.test(code) ? code : "HEARTBEAT_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
}
