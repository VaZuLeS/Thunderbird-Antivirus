"use strict";
const fs = require("node:fs");
const { readJournal, publicKeyFile } = require("./storage_verify.cjs");
const { deriveIncidents } = require("./incidents.cjs");
function main(argv = process.argv.slice(2)) {
  const options = {},
    required = [
      "export",
      "rules",
      "server-public-key",
      "server-key-id",
      "registry",
      "out",
    ];
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]?.slice(2);
    if (
      !argv[i]?.startsWith("--") ||
      ![...required, "expected-head"].includes(name) ||
      !argv[i + 1] ||
      Object.hasOwn(options, name)
    )
      throw new Error("INCIDENT_ARGUMENT_INVALID");
    options[name] = argv[i + 1];
  }
  if (required.some((name) => !options[name]))
    throw new Error("INCIDENT_ARGUMENT_REQUIRED");
  const json = (file, maxBytes) =>
    JSON.parse(readJournal(file, maxBytes).toString("utf8"));
  const registry = json(options.registry, 1024 * 1024);
  if (!registry || Object.keys(registry).join(",") !== "registrations")
    throw new Error("INCIDENT_REGISTRY_INVALID");
  const trust = {
    serverPublicKey: publicKeyFile(options["server-public-key"]),
    serverKeyId: options["server-key-id"],
    registrations: registry.registrations,
  };
  if (options["expected-head"] !== undefined) {
    if (!/^[a-f0-9]{64}$/.test(options["expected-head"]))
      throw new Error("INCIDENT_HEAD_INVALID");
    trust.expectedHead = options["expected-head"];
  }
  const report = deriveIncidents(
    json(options.export, 16 * 1024 * 1024),
    json(options.rules, 65536),
    trust,
  );
  fs.writeFileSync(options.out, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  process.stdout.write("INCIDENT_REPORT_CREATED\n");
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    const code = error.code || error.message;
    process.stderr.write(
      (/^[A-Z][A-Z0-9_]+$/.test(code) ? code : "INCIDENT_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
}
module.exports = { main };
