"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const { readJournal, publicKeyFile } = require("./storage_verify.cjs");
const { exact, iso } = require("./durable_journal.cjs");
const { simulate } = require("./policy_simulation.cjs");
function main() {
  const options = {},
    required = ["baseline", "candidate", "export", "config", "out"],
    argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]?.slice(2);
    if (
      !argv[i]?.startsWith("--") ||
      ![...required, "expected-head", "scenario"].includes(k) ||
      !argv[i + 1] ||
      Object.hasOwn(options, k)
    )
      throw new Error("SIMULATION_ARGUMENT_INVALID");
    options[k] = argv[i + 1];
  }
  if (required.some((k) => !options[k]))
    throw new Error("SIMULATION_ARGUMENT_REQUIRED");
  const json = (file, max) =>
      JSON.parse(readJournal(file, max).toString("utf8")),
    c = json(options.config, 65536);
  if (
    !exact(
      c,
      "schemaVersion,organizationId,policyId,groupIds,capabilities,clientVersion,highestVersion,policyKeys,serverKeyId,serverPublicKeyFile,registryFile",
    ) ||
    c.schemaVersion !== 1 ||
    !Array.isArray(c.policyKeys) ||
    c.policyKeys.length > 1000
  )
    throw new Error("SIMULATION_CONFIG_INVALID");
  const keyFile = (file) => {
    if (typeof file !== "string" || !path.isAbsolute(file))
      throw new Error("SIMULATION_CONFIG_PATH_INVALID");
    return publicKeyFile(file);
  };
  const trustedKeys = new Map();
  for (const key of c.policyKeys) {
    if (
      !exact(key, "keyId,publicKeyFile,notBefore,notAfter,revokedAt") ||
      trustedKeys.has(key.keyId) ||
      !iso(key.notBefore) ||
      !iso(key.notAfter) ||
      (key.revokedAt !== null && !iso(key.revokedAt))
    )
      throw new Error("SIMULATION_KEY_CONFIG_INVALID");
    trustedKeys.set(key.keyId, {
      publicKey: keyFile(key.publicKeyFile),
      organizationId: c.organizationId,
      notBefore: Date.parse(key.notBefore),
      notAfter: Date.parse(key.notAfter),
      revokedAt: key.revokedAt === null ? null : Date.parse(key.revokedAt),
    });
  }
  if (typeof c.registryFile !== "string" || !path.isAbsolute(c.registryFile))
    throw new Error("SIMULATION_CONFIG_PATH_INVALID");
  const registry = json(c.registryFile, 1024 * 1024);
  if (!exact(registry, "registrations"))
    throw new Error("SIMULATION_REGISTRY_INVALID");
  if (
    options["expected-head"] !== undefined &&
    !/^[a-f0-9]{64}$/.test(options["expected-head"])
  )
    throw new Error("SIMULATION_HEAD_INVALID");
  const report = simulate({
    baseline: json(options.baseline, 65536),
    candidate: json(options.candidate, 65536),
    data: json(options.export, 16 * 1024 * 1024),
    scenario: options.scenario || "healthy_unacknowledged",
    policyContext: {
      organizationId: c.organizationId,
      policyId: c.policyId,
      groupIds: c.groupIds,
      capabilities: c.capabilities,
      clientVersion: c.clientVersion,
      highestVersion: c.highestVersion,
      trustedKeys,
    },
    eventTrust: {
      serverKeyId: c.serverKeyId,
      serverPublicKey: keyFile(c.serverPublicKeyFile),
      registrations: registry.registrations,
      ...(options["expected-head"] !== undefined
        ? { expectedHead: options["expected-head"] }
        : {}),
    },
  });
  fs.writeFileSync(options.out, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  process.stdout.write("SIMULATION_REPORT_CREATED\n");
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    const code = error.code || error.message;
    process.stderr.write(
      (/^[A-Z][A-Z0-9_]+$/.test(code) ? code : "SIMULATION_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
}
