"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const { IncidentCases } = require("./incident_cases.cjs");
const { readJournal, publicKeyFile } = require("./storage_verify.cjs");
const { exact } = require("./durable_journal.cjs");
function main() {
  const command = process.argv[2],
    options = {},
    writer = ["directory", "config", "private-key", "actor-id"],
    caseOptions = [...writer, "case-id", "expected-revision"],
    allowed = {
      verify: ["journal", "config", "out", "expected-head"],
      ingest: [...writer, "export", "rules", "expected-head"],
      assign: [...caseOptions, "assignee-id"],
      ack: caseOptions,
      start: caseOptions,
      resolve: [...caseOptions, "resolution"],
      reopen: caseOptions,
    };
  if (!Object.hasOwn(allowed, command))
    throw new Error("CASES_COMMAND_INVALID");
  const argv = process.argv.slice(3);
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]?.slice(2);
    if (
      !argv[i]?.startsWith("--") ||
      !allowed[command].includes(name) ||
      !argv[i + 1] ||
      Object.hasOwn(options, name)
    )
      throw new Error("CASES_ARGUMENT_INVALID");
    options[name] = argv[i + 1];
  }
  if (
    allowed[command]
      .filter((k) => k !== "expected-head")
      .some((k) => !options[k])
  )
    throw new Error("CASES_ARGUMENT_REQUIRED");
  const json = (file, maxBytes) =>
      JSON.parse(readJournal(file, maxBytes).toString("utf8")),
    config = json(options.config, 65536);
  if (
    !exact(
      config,
      "schemaVersion,organizationId,signerKeyId,signerPublicKeyFile,serverKeyId,serverPublicKeyFile,registryFile,maxCases",
    ) ||
    config.schemaVersion !== 1
  )
    throw new Error("CASES_CONFIG_INVALID");
  for (const name of [
    "signerPublicKeyFile",
    "serverPublicKeyFile",
    "registryFile",
  ])
    if (typeof config[name] !== "string" || !path.isAbsolute(config[name]))
      throw new Error("CASES_CONFIG_PATH_INVALID");
  const registry = json(config.registryFile, 1024 * 1024);
  if (!exact(registry, "registrations"))
    throw new Error("CASES_REGISTRY_INVALID");
  const context = {
    organizationId: config.organizationId,
    maxCases: config.maxCases,
    signerKeyId: config.signerKeyId,
    trust: {
      serverKeyId: config.serverKeyId,
      serverPublicKey: publicKeyFile(config.serverPublicKeyFile),
      registrations: registry.registrations,
    },
  };
  const expectedHead = options["expected-head"];
  if (expectedHead !== undefined && !/^[a-f0-9]{64}$/.test(expectedHead))
    throw new Error("CASES_HEAD_INVALID");
  if (command === "verify") {
    const report = IncidentCases.verifyJournal(
      readJournal(options.journal, 32 * 1024 * 1024),
      {
        ...context,
        signerPublicKey: publicKeyFile(config.signerPublicKeyFile),
        ...(expectedHead !== undefined ? { expectedHead } : {}),
      },
    );
    fs.writeFileSync(options.out, JSON.stringify(report, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    process.stdout.write("CASES_REPORT_CREATED\n");
    return;
  }
  const stat = fs.lstatSync(options["private-key"]);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.uid !== process.getuid() ||
    (stat.mode & 0o077) !== 0
  )
    throw new Error("CASES_PRIVATE_KEY_PERMISSIONS");
  const privateKey = readJournal(options["private-key"], 65536).toString(
    "utf8",
  );
  const crypto = require("node:crypto");
  const derived = crypto
      .createPublicKey(privateKey)
      .export({ type: "spki", format: "der" }),
    pinned = publicKeyFile(config.signerPublicKeyFile).export({
      type: "spki",
      format: "der",
    });
  if (!derived.equals(pinned)) throw new Error("CASES_WRITER_KEY_MISMATCH");
  const store = new IncidentCases({
    ...context,
    directory: options.directory,
    signerPrivateKey: privateKey,
  });
  try {
    let result;
    const actorId = options["actor-id"];
    if (command === "ingest")
      result = store.ingest(
        json(options.export, 16 * 1024 * 1024),
        json(options.rules, 65536),
        { actorId, ...(expectedHead !== undefined ? { expectedHead } : {}) },
      );
    else {
      const expectedRevision = Number(options["expected-revision"]);
      if (
        !/^[1-9][0-9]*$/.test(options["expected-revision"]) ||
        !Number.isSafeInteger(expectedRevision)
      )
        throw new Error("CASES_REVISION_INVALID");
      const caseId = options["case-id"],
        action = { actorId, expectedRevision };
      if (command === "assign")
        store.assign(caseId, {
          ...action,
          assigneeId:
            options["assignee-id"] === "-" ? null : options["assignee-id"],
        });
      else if (command === "reopen") store.reopen(caseId, action);
      else
        store.transition(caseId, {
          ...action,
          to: {
            ack: "ACKNOWLEDGED",
            start: "IN_PROGRESS",
            resolve: "RESOLVED",
          }[command],
          resolutionCode: options.resolution || null,
        });
      const item = store.status().cases.find((c) => c.caseId === caseId);
      result = { caseId, status: item.status, revision: item.revision };
    }
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
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
      (/^[A-Z][A-Z0-9_]+$/.test(code) ? code : "CASES_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
}
