"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const { ConnectorQueue, profile } = require("./connectors.cjs");
const { readJournal, publicKeyFile } = require("./storage_verify.cjs");
const { exact } = require("./durable_journal.cjs");
function main() {
  const command = process.argv[2],
    options = {},
    allowed = {
      profile: ["profile"],
      enqueue: ["directory", "config", "export", "rules", "expected-head"],
      run: ["directory", "config"],
      status: ["directory", "config"],
      retry: ["directory", "config", "job-id"],
    };
  if (!Object.hasOwn(allowed, command))
    throw new Error("CONNECTOR_COMMAND_INVALID");
  const argv = process.argv.slice(3);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.slice(2);
    if (
      !argv[i]?.startsWith("--") ||
      !allowed[command].includes(key) ||
      !argv[i + 1] ||
      Object.hasOwn(options, key)
    )
      throw new Error("CONNECTOR_ARGUMENT_INVALID");
    options[key] = argv[i + 1];
  }
  if (
    allowed[command]
      .filter((k) => k !== "expected-head")
      .some((k) => !options[k])
  )
    throw new Error("CONNECTOR_ARGUMENT_REQUIRED");
  if (command === "profile") {
    process.stdout.write(
      JSON.stringify(profile(options.profile), null, 2) + "\n",
    );
    return;
  }
  const json = (file, max) =>
    JSON.parse(readJournal(file, max).toString("utf8"));
  const config = json(options.config, 65536);
  if (
    !exact(
      config,
      "schemaVersion,mode,organizationId,profileId,signerKeyId,signerPrivateKeyFile,serverKeyId,serverPublicKeyFile,registryFile,outputDirectory",
    ) ||
    config.schemaVersion !== 1 ||
    config.mode !== "offline-export-only"
  )
    throw new Error("CONNECTOR_CONFIG_INVALID");
  for (const name of [
    "signerPrivateKeyFile",
    "serverPublicKeyFile",
    "registryFile",
    "outputDirectory",
  ])
    if (typeof config[name] !== "string" || !path.isAbsolute(config[name]))
      throw new Error("CONNECTOR_CONFIG_PATH_INVALID");
  const keyStat = fs.lstatSync(config.signerPrivateKeyFile);
  if (
    !keyStat.isFile() ||
    keyStat.isSymbolicLink() ||
    (keyStat.mode & 0o077) !== 0 ||
    keyStat.uid !== process.getuid()
  )
    throw new Error("CONNECTOR_PRIVATE_KEY_PERMISSIONS");
  const registry = json(config.registryFile, 1024 * 1024);
  if (!exact(registry, "registrations"))
    throw new Error("CONNECTOR_REGISTRY_INVALID");
  const queue = new ConnectorQueue({
    directory: options.directory,
    outputDirectory: config.outputDirectory,
    signerKeyId: config.signerKeyId,
    signerPrivateKey: readJournal(config.signerPrivateKeyFile, 65536).toString(
      "utf8",
    ),
    organizationId: config.organizationId,
    profileId: config.profileId,
    trust: {
      serverKeyId: config.serverKeyId,
      serverPublicKey: publicKeyFile(config.serverPublicKeyFile),
      registrations: registry.registrations,
    },
  });
  try {
    let result;
    if (command === "enqueue")
      result = queue.enqueue(
        json(options.export, 16 * 1024 * 1024),
        json(options.rules, 65536),
        options["expected-head"] === undefined
          ? {}
          : { expectedHead: options["expected-head"] },
      );
    else if (command === "run") result = queue.exportOne();
    else if (command === "retry") result = queue.retry(options["job-id"]);
    else result = queue.status();
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } finally {
    queue.close();
  }
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    const code = error.code || error.message;
    process.stderr.write(
      (/^[A-Z][A-Z0-9_]+$/.test(code) ? code : "CONNECTOR_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
}
