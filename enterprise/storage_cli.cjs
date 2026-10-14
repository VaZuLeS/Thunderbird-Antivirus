"use strict";
const fs = require("node:fs");
const {
  profiles,
  prepareArtifact,
  simulateStorage,
} = require("./immutable_storage.cjs");
const { readJson, readRegistry } = require("./witness_cli.cjs");
function parse(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.slice(2);
    if (
      !argv[index]?.startsWith("--") ||
      ![
        "provider",
        "export",
        "public-key",
        "server-key-id",
        "registry",
        "witness-anchor",
        "witness-public-key",
        "expected-anchor-hash",
        "directory",
        "out",
      ].includes(key) ||
      !argv[index + 1] ||
      Object.hasOwn(options, key)
    )
      throw new Error("ARGUMENT_INVALID");
    options[key] = argv[index + 1];
  }
  return options;
}
function main() {
  const command = process.argv[2],
    options = parse(process.argv.slice(3));
  if (command === "profile") {
    if (
      Object.keys(options).some((key) => !["provider", "out"].includes(key)) ||
      !Object.hasOwn(profiles, options.provider)
    )
      throw new Error("PROFILE_INVALID");
    const content =
      JSON.stringify(
        {
          schemaVersion: 1,
          kind: "thundy-storage-profile",
          provider: options.provider,
          enabled: false,
          allowCloudWrite: false,
          ...profiles[options.provider],
          settings: {},
          liveAcceptance: false,
          sealed: false,
        },
        null,
        2,
      ) + "\n";
    if (options.out)
      fs.writeFileSync(options.out, content, { flag: "wx", mode: 0o600 });
    else process.stdout.write(content);
    return;
  }
  if (
    command !== "simulate" ||
    Object.keys(options).some((key) => ["provider", "out"].includes(key))
  )
    throw new Error("COMMAND_OR_OPTION_INVALID");
  for (const key of [
    "export",
    "public-key",
    "server-key-id",
    "registry",
    "witness-anchor",
    "witness-public-key",
    "expected-anchor-hash",
    "directory",
  ])
    if (!options[key]) throw new Error("STORAGE_TRUST_REQUIRED");
  const trust = {
    serverPublicKey: fs.readFileSync(options["public-key"]),
    serverKeyId: options["server-key-id"],
    registrations: readRegistry(options.registry),
    witnessAnchor: readJson(options["witness-anchor"], 65536),
    witnessPublicKey: fs.readFileSync(options["witness-public-key"]),
    expectedAnchorHash: options["expected-anchor-hash"],
  };
  const artifact = prepareArtifact(readJson(options.export), trust),
    report = simulateStorage(artifact, options.directory);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
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
          : "STORAGE_COMMAND_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
module.exports = { parse };
