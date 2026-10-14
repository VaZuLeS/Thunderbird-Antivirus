"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Witness } = require("./witness.cjs");
function readJson(file, max = 64 * 1024 * 1024) {
  if (fs.statSync(file).size > max) throw new Error("INPUT_TOO_LARGE");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function readRegistry(file) {
  const value = readJson(file, 1024 * 1024);
  if (!Array.isArray(value?.registrations)) throw new Error("REGISTRY_INVALID");
  return value.registrations;
}
function parse(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.slice(2);
    if (
      !argv[index]?.startsWith("--") ||
      ![
        "directory",
        "server-public-key",
        "server-key-id",
        "witness-key-id",
        "export",
        "checkpoint",
        "expected-head",
        "out",
        "registry",
      ].includes(key) ||
      !argv[index + 1] ||
      Object.hasOwn(options, key)
    )
      throw new Error("ARGUMENT_INVALID");
    options[key] = argv[index + 1];
  }
  return options;
}
function writeNew(file, data) {
  fs.writeFileSync(file, data, { flag: "wx", mode: 0o600 });
}
async function main() {
  const command = process.argv[2],
    options = parse(process.argv.slice(3));
  if (!options.directory) throw new Error("WITNESS_DIRECTORY_REQUIRED");
  const directory = path.resolve(options.directory);
  const allowedOptions = {
    init: ["directory", "server-public-key", "server-key-id", "witness-key-id"],
    append: [
      "directory",
      "export",
      "checkpoint",
      "expected-head",
      "out",
      "registry",
    ],
  };
  if (!Object.hasOwn(allowedOptions, command))
    throw new Error("COMMAND_INVALID");
  if (
    Object.keys(options).some((key) => !allowedOptions[command].includes(key))
  )
    throw new Error("OPTION_NOT_SUPPORTED");
  if (command === "init") {
    if (!options["server-public-key"] || !options["server-key-id"])
      throw new Error("SERVER_TRUST_REQUIRED");
    const serverKey = crypto.createPublicKey(
      fs.readFileSync(options["server-public-key"]),
    );
    if (serverKey.asymmetricKeyType !== "ed25519")
      throw new Error("SERVER_KEY_INVALID");
    const witnessKeyId = options["witness-key-id"] || "local-witness-1";
    if (
      ![witnessKeyId, options["server-key-id"]].every((id) =>
        /^[A-Za-z0-9_-]{1,80}$/.test(id),
      )
    )
      throw new Error("KEY_ID_INVALID");
    fs.mkdirSync(directory, { mode: 0o700 });
    const keys = crypto.generateKeyPairSync("ed25519");
    writeNew(
      path.join(directory, "witness-private.pem"),
      keys.privateKey.export({ type: "pkcs8", format: "pem" }),
    );
    writeNew(
      path.join(directory, "witness-public.pem"),
      keys.publicKey.export({ type: "spki", format: "pem" }),
    );
    writeNew(
      path.join(directory, "config.json"),
      JSON.stringify(
        {
          mode: "local-witness",
          witnessKeyId,
          serverKeyId: options["server-key-id"],
          serverPublicKey: serverKey.export({ type: "spki", format: "pem" }),
        },
        null,
        2,
      ) + "\n",
    );
    process.stdout.write(
      JSON.stringify({ initialized: true, expectedHead: "genesis" }) + "\n",
    );
    return;
  }
  if (
    command !== "append" ||
    !options.export ||
    !options.checkpoint ||
    !options["expected-head"] ||
    !options.out
  )
    throw new Error("APPEND_INPUT_REQUIRED");
  // Refuse an existing output before modifying the witness log.
  if (fs.existsSync(options.out)) throw new Error("OUTPUT_EXISTS");
  const config = readJson(path.join(directory, "config.json"), 1024 * 1024);
  if (config.mode !== "local-witness") throw new Error("WITNESS_MODE_REQUIRED");
  const witness = new Witness({
    directory,
    witnessKeyId: config.witnessKeyId,
    witnessPrivateKey: fs.readFileSync(
      path.join(directory, "witness-private.pem"),
    ),
    serverKeyId: config.serverKeyId,
    serverPublicKey: config.serverPublicKey,
  });
  try {
    const registrations = options.registry
      ? readRegistry(options.registry)
      : null;
    const result = witness.append(
      readJson(options.export),
      readJson(options.checkpoint, 65536),
      { expectedHead: options["expected-head"], registrations },
    );
    writeNew(options.out, JSON.stringify(result.anchor, null, 2) + "\n");
    process.stdout.write(
      JSON.stringify({
        duplicate: result.duplicate,
        anchorHash: result.anchorHash,
        entryCount: result.anchor.payload.checkpoint.payload.entryCount,
        anchorIndex: result.anchor.payload.anchorIndex,
      }) + "\n",
    );
  } finally {
    witness.close();
  }
}
if (require.main === module)
  main().catch((error) => {
    process.stderr.write(
      (/^[A-Z][A-Z0-9_]+$/.test(error.code || "")
        ? error.code
        : /^[A-Z][A-Z0-9_]+$/.test(error.message || "")
          ? error.message
          : "WITNESS_COMMAND_FAILED") + "\n",
    );
    process.exitCode = 1;
  });
module.exports = { parse, readJson, readRegistry };
