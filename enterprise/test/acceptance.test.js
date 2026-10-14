"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const { plan, evaluate, CHECKS } = require("../acceptance.cjs"),
  { signed, hash } = require("../ledger.cjs");
const at = Date.parse("2026-10-14T10:00:00Z");
function fixture() {
  const p = plan({
      organizationId: crypto.randomUUID(),
      region: "eu-central-1",
      bundle: "cloud",
    }),
    keys = new Map(),
    authorities = [];
  for (const role of [
    "operator",
    "security-reviewer",
    "privacy-approver",
    "identity-reviewer",
    "platform-reviewer",
  ]) {
    const key = crypto.generateKeyPairSync("ed25519");
    keys.set(role, key);
    authorities.push({
      keyId: role,
      principalId: role,
      role,
      organizationId: p.organizationId,
      publicKey: key.publicKey.export({ type: "spki", format: "pem" }),
    });
  }
  const artifact = Buffer.from(
      "synthetic test evidence; not a real acceptance",
    ),
    digest = crypto.createHash("sha256").update(artifact).digest("hex");
  const attest = (checkId, role, result = "pass", changes = {}) =>
    signed(
      {
        schemaVersion: 1,
        kind: "thundy-acceptance-attestation",
        planHash: hash(p),
        checkId,
        result,
        environment: "live",
        observedAt: new Date(at).toISOString(),
        artifactHashes: [digest],
        ...changes,
      },
      role,
      keys.get(role).privateKey,
    );
  const attestations = CHECKS.flatMap((c) => [
    attest(c.id, "operator"),
    attest(c.id, c.reviewer),
  ]);
  const options = {
    plan: p,
    attestations,
    authorities,
    readArtifact: () => artifact,
    now: at,
  };
  return { p, attest, options, artifact, keys };
}
test("empty evidence exposes all eight blockers without granting production or SEALED", () => {
  const f = fixture(),
    r = evaluate({ ...f.options, attestations: [] });
  assert.equal(r.readyForManualReview, false);
  assert.equal(r.checks.length, 8);
  assert.ok(r.checks.every((c) => c.status === "missing"));
  assert.equal(r.productionAccepted, false);
  assert.equal(r.sealed, false);
});
test("complete signed declarations only enable manual review, never activation", () => {
  const f = fixture(),
    r = evaluate(f.options);
  assert.equal(r.readyForManualReview, true);
  assert.equal(r.extensionActivation, false);
  assert.equal(r.productionAccepted, false);
  assert.equal(r.sealed, false);
  assert.ok(!JSON.stringify(r).includes("synthetic test evidence"));
});
test("failure, missing reviewer and mismatched evidence block readiness", () => {
  const f = fixture();
  let r = evaluate({
    ...f.options,
    attestations: f.options.attestations.slice(1),
  });
  assert.equal(r.readyForManualReview, false);
  r = evaluate({
    ...f.options,
    attestations: [
      f.attest(CHECKS[0].id, "operator", "fail"),
      ...f.options.attestations.slice(1),
    ],
  });
  assert.equal(r.checks[0].status, "failed");
});
test("forged signatures, wrong scope, expired declarations and non-live evidence are rejected", () => {
  const f = fixture();
  for (const changes of [
    { planHash: "a".repeat(64) },
    { environment: "simulation" },
    { observedAt: new Date(at - 31 * 86400000).toISOString() },
    { observedAt: new Date(at + 1).toISOString() },
  ])
    assert.throws(() =>
      evaluate({
        ...f.options,
        attestations: [f.attest(CHECKS[0].id, "operator", "pass", changes)],
      }),
    );
  const forged = structuredClone(f.options.attestations);
  forged[0].signature = "A".repeat(86);
  assert.throws(() => evaluate({ ...f.options, attestations: forged }));
});
test("separation of roles, duplicate declarations and changed artifacts cannot be bypassed", () => {
  const f = fixture();
  assert.throws(
    () =>
      evaluate({
        ...f.options,
        attestations: [f.attest(CHECKS[0].id, "identity-reviewer")],
      }),
    /ACCEPTANCE_ROLE_DENIED/,
  );
  assert.throws(
    () =>
      evaluate({
        ...f.options,
        attestations: [f.options.attestations[0], f.options.attestations[0]],
      }),
    /ACCEPTANCE_ATTESTATION_DUPLICATE/,
  );
  assert.throws(
    () =>
      evaluate({ ...f.options, readArtifact: () => Buffer.from("changed") }),
    /ACCEPTANCE_ARTIFACT_MISMATCH/,
  );
  const authorities = structuredClone(f.options.authorities);
  authorities[1].principalId = authorities[0].principalId;
  assert.throws(
    () => evaluate({ ...f.options, authorities }),
    /ACCEPTANCE_AUTHORITY_NOT_INDEPENDENT/,
  );
  authorities[1].principalId = "other";
  authorities[1].publicKey = authorities[0].publicKey;
  assert.throws(
    () => evaluate({ ...f.options, authorities }),
    /ACCEPTANCE_AUTHORITY_NOT_INDEPENDENT/,
  );
});
test("optional system bundles do not activate services and check list cannot be weakened", () => {
  for (const bundle of ["local", "microsoft", "openSource", "cloud"]) {
    const p = plan({
      organizationId: crypto.randomUUID(),
      region: "eu",
      bundle,
    });
    assert.equal(
      evaluate({
        plan: p,
        attestations: [],
        authorities: [],
        readArtifact: () => Buffer.alloc(0),
        now: at,
      }).readyForManualReview,
      false,
    );
  }
  const f = fixture();
  f.p.requiredChecks.pop();
  assert.throws(() => evaluate(f.options), /ACCEPTANCE_PLAN_INVALID/);
});
test("same Ed25519 key with different PEM whitespace does not count as an independent reviewer", () => {
  const f = fixture(),
    authorities = structuredClone(f.options.authorities);
  authorities[1].publicKey = authorities[0].publicKey + "\n";
  assert.throws(
    () => evaluate({ ...f.options, authorities }),
    /ACCEPTANCE_AUTHORITY_NOT_INDEPENDENT/,
  );
});
test("reviewer must reference exactly the same artifact set as the operator", () => {
  const f = fixture(),
    other = Buffer.from("other evidence"),
    otherHash = crypto.createHash("sha256").update(other).digest("hex");
  const entries = f.options.attestations.slice();
  entries[1] = f.attest(CHECKS[0].id, CHECKS[0].reviewer, "pass", {
    artifactHashes: [otherHash],
  });
  const report = evaluate({
    ...f.options,
    attestations: entries,
    readArtifact: (digest) => (digest === otherHash ? other : f.artifact),
  });
  assert.equal(report.readyForManualReview, false);
  assert.equal(report.checks[0].matchingEvidence, false);
});
test("CLI emits concrete missing-evidence report with exit 2 and no activation", () => {
  const fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path"),
    { spawnSync } = require("node:child_process"),
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-acceptance-"));
  try {
    const file = (name) => path.join(directory, name);
    const draft = spawnSync(
      process.execPath,
      [
        "enterprise/acceptance_cli.cjs",
        "draft",
        "--organization-id",
        crypto.randomUUID(),
        "--region",
        "eu",
        "--bundle",
        "microsoft",
        "--out",
        file("plan.json"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(draft.status, 0);
    fs.writeFileSync(file("attestations.json"), "[]");
    fs.writeFileSync(file("authorities.json"), "[]");
    const result = spawnSync(
      process.execPath,
      [
        "enterprise/acceptance_cli.cjs",
        "check",
        "--input",
        file("plan.json"),
        "--attestations",
        file("attestations.json"),
        "--authorities",
        file("authorities.json"),
        "--evidence-directory",
        directory,
        "--out",
        file("report.json"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(fs.readFileSync(file("report.json")));
    assert.equal(report.checks.length, 8);
    assert.equal(report.productionAccepted, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test("evidence capacity is bounded and repeated hashes are verified only once", () => {
  const f = fixture();
  assert.throws(
    () => evaluate({ ...f.options, maxEvidenceBytes: 1 }),
    /ACCEPTANCE_ARTIFACT_CAPACITY/,
  );
  let reads = 0;
  const report = evaluate({
    ...f.options,
    readArtifact: () => {
      reads++;
      return f.artifact;
    },
  });
  assert.equal(report.readyForManualReview, true);
  assert.equal(reads, 1);
});
