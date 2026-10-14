"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const { readJournal } = require("./storage_verify.cjs");
const { plan, evaluate } = require("./acceptance.cjs");
function main() {
  const command = process.argv[2],
    allowed = {
      draft: ["organization-id", "region", "bundle", "out"],
      probe: ["out"],
      check: [
        "input",
        "attestations",
        "authorities",
        "evidence-directory",
        "out",
      ],
    },
    options = {},
    argv = process.argv.slice(3);
  if (!Object.hasOwn(allowed, command))
    throw new Error("ACCEPTANCE_COMMAND_INVALID");
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]?.slice(2);
    if (
      !argv[i]?.startsWith("--") ||
      !allowed[command].includes(k) ||
      !argv[i + 1] ||
      Object.hasOwn(options, k)
    )
      throw new Error("ACCEPTANCE_ARGUMENT_INVALID");
    options[k] = argv[i + 1];
  }
  if (allowed[command].filter((k) => k !== "bundle").some((k) => !options[k]))
    throw new Error("ACCEPTANCE_ARGUMENT_REQUIRED");
  const json = (file, max) =>
    JSON.parse(readJournal(file, max).toString("utf8"));
  let report;
  if (command === "draft")
    report = plan({
      organizationId: options["organization-id"],
      region: options.region,
      bundle: options.bundle || "local",
    });
  else if (command === "probe") {
    const executable =
      process.platform === "win32" ? "thunderbird.exe" : "thunderbird";
    const found = (process.env.PATH || "")
      .split(path.delimiter)
      .some((directory) => {
        try {
          fs.accessSync(path.join(directory, executable), fs.constants.X_OK);
          return true;
        } catch {
          return false;
        }
      });
    report = {
      schemaVersion: 1,
      kind: "thundy-local-acceptance-probe",
      observedAt: new Date().toISOString(),
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      thunderbirdBinaryFound: found,
      thunderbirdLiveTestExecuted: false,
      windowsMacAcceptanceExecuted: false,
      cloudReadiness: "not_inspected",
      ssoReadiness: "not_inspected",
      productionAccepted: false,
      sealed: false,
    };
  } else {
    const directory = path.resolve(options["evidence-directory"]),
      stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("ACCEPTANCE_EVIDENCE_DIRECTORY_INVALID");
    report = evaluate({
      plan: json(options.input, 65536),
      attestations: json(options.attestations, 1024 * 1024),
      authorities: json(options.authorities, 1024 * 1024),
      readArtifact: (hash) =>
        readJournal(path.join(directory, hash + ".evidence"), 8 * 1024 * 1024),
    });
  }
  fs.writeFileSync(options.out, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  process.stdout.write("ACCEPTANCE_REPORT_CREATED\n");
  if (command === "check" && !report.readyForManualReview) process.exitCode = 2;
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    const code = error.code || error.message;
    process.stderr.write(
      (/^[A-Z][A-Z0-9_]+$/.test(code) ? code : "ACCEPTANCE_FAILED") + "\n",
    );
    process.exitCode = 1;
  }
}
