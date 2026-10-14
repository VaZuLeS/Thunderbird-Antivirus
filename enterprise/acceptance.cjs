"use strict";
const crypto = require("node:crypto");
const { exact, need, identifier, hex, iso } = require("./durable_journal.cjs");
const { hash, verifyEnvelope } = require("./ledger.cjs");
const profiles = require("../enterprise_profiles.js");
const CHECKS = Object.freeze([
  { id: "operator-region", reviewer: "security-reviewer", packages: ["F01"] },
  {
    id: "data-retention-rules",
    reviewer: "privacy-approver",
    packages: ["F02", "F04"],
  },
  {
    id: "cloud-lock-iam-kms-restore",
    reviewer: "security-reviewer",
    packages: ["E02", "E03"],
  },
  {
    id: "sealed-evidence-commit",
    reviewer: "security-reviewer",
    packages: ["E01"],
  },
  {
    id: "sso-session-mfa-logout",
    reviewer: "identity-reviewer",
    packages: ["A01"],
  },
  {
    id: "roles-org-export-denials",
    reviewer: "identity-reviewer",
    packages: ["A02", "A03"],
  },
  {
    id: "native-broker-os-deployment",
    reviewer: "platform-reviewer",
    packages: ["F03", "Q02"],
  },
  {
    id: "thunderbird-live-six-languages",
    reviewer: "platform-reviewer",
    packages: ["Q01", "Q02"],
  },
]);
const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
function plan({
  organizationId,
  region,
  bundle = "local",
  extensionVersion = "1.22.0",
}) {
  need(
    uuid(organizationId) &&
      typeof region === "string" &&
      /^[A-Za-z0-9_-]{1,80}$/.test(region) &&
      Object.hasOwn(profiles.bundles, bundle) &&
      typeof extensionVersion === "string" &&
      /^\d+\.\d+\.\d+$/.test(extensionVersion),
    "ACCEPTANCE_PLAN_INVALID",
  );
  return {
    schemaVersion: 1,
    kind: "thundy-enterprise-acceptance-plan",
    organizationId,
    region,
    extensionVersion,
    selection: profiles.normalizeSelection(profiles.bundles[bundle]),
    requiredChecks: CHECKS.map((c) => c.id),
  };
}
function validatePlan(p) {
  need(
    exact(
      p,
      "schemaVersion,kind,organizationId,region,extensionVersion,selection,requiredChecks",
    ) &&
      p.schemaVersion === 1 &&
      p.kind === "thundy-enterprise-acceptance-plan" &&
      uuid(p.organizationId) &&
      typeof p.region === "string" &&
      /^[A-Za-z0-9_-]{1,80}$/.test(p.region) &&
      typeof p.extensionVersion === "string" &&
      /^\d+\.\d+\.\d+$/.test(p.extensionVersion) &&
      Array.isArray(p.requiredChecks) &&
      p.requiredChecks.join(",") === CHECKS.map((c) => c.id).join(","),
    "ACCEPTANCE_PLAN_INVALID",
  );
  const selection = profiles.normalizeSelection(p.selection);
  need(hash(selection) === hash(p.selection), "ACCEPTANCE_PLAN_INVALID");
  return p;
}
function evaluate({
  plan: input,
  attestations,
  authorities,
  readArtifact,
  now = Date.now(),
  maxAgeMs = 30 * 86400000,
  maxEvidenceBytes = 64 * 1024 * 1024,
}) {
  const p = validatePlan(input),
    planHash = hash(p);
  need(
    Array.isArray(attestations) &&
      attestations.length <= 100 &&
      Array.isArray(authorities) &&
      authorities.length <= 100 &&
      typeof readArtifact === "function" &&
      Number.isFinite(now) &&
      Number.isSafeInteger(maxAgeMs) &&
      maxAgeMs > 0 &&
      maxAgeMs <= 90 * 86400000,
    "ACCEPTANCE_INPUT_INVALID",
  );
  need(
    Number.isSafeInteger(maxEvidenceBytes) &&
      maxEvidenceBytes > 0 &&
      maxEvidenceBytes <= 64 * 1024 * 1024,
    "ACCEPTANCE_LIMIT_INVALID",
  );
  const roots = new Map(),
    identities = new Set();
  for (const authority of authorities) {
    need(
      exact(authority, "keyId,organizationId,role,principalId,publicKey") &&
        identifier(authority.keyId) &&
        identifier(authority.principalId) &&
        authority.organizationId === p.organizationId &&
        ["operator", ...CHECKS.map((c) => c.reviewer)].includes(
          authority.role,
        ) &&
        typeof authority.publicKey === "string" &&
        /^-----BEGIN PUBLIC KEY-----\r?\n/.test(authority.publicKey) &&
        !authority.publicKey.includes("PRIVATE KEY") &&
        !roots.has(authority.keyId),
      "ACCEPTANCE_AUTHORITY_INVALID",
    );
    const publicKey = crypto.createPublicKey(authority.publicKey);
    need(
      publicKey.asymmetricKeyType === "ed25519",
      "ACCEPTANCE_AUTHORITY_INVALID",
    );
    // One principal / public key cannot masquerade as independent roles.
    const fingerprint = crypto
      .createHash("sha256")
      .update(publicKey.export({ type: "spki", format: "der" }))
      .digest("hex");
    need(
      !identities.has(authority.principalId) && !identities.has(fingerprint),
      "ACCEPTANCE_AUTHORITY_NOT_INDEPENDENT",
    );
    identities.add(authority.principalId);
    identities.add(fingerprint);
    roots.set(authority.keyId, { ...authority, publicKey });
  }
  const checkedArtifacts = new Set();
  let evidenceBytes = 0;
  const verified = [],
    seen = new Set();
  for (const attestation of attestations) {
    const authority = roots.get(attestation?.keyId);
    need(authority, "ACCEPTANCE_SIGNER_UNTRUSTED");
    const a = verifyEnvelope(attestation, authority.publicKey);
    need(
      exact(
        a,
        "schemaVersion,kind,planHash,checkId,result,environment,observedAt,artifactHashes",
      ) &&
        a.schemaVersion === 1 &&
        a.kind === "thundy-acceptance-attestation" &&
        a.planHash === planHash &&
        CHECKS.some((c) => c.id === a.checkId) &&
        ["pass", "fail"].includes(a.result) &&
        a.environment === "live" &&
        iso(a.observedAt) &&
        Date.parse(a.observedAt) <= now &&
        now - Date.parse(a.observedAt) <= maxAgeMs &&
        Array.isArray(a.artifactHashes) &&
        a.artifactHashes.length > 0 &&
        a.artifactHashes.length <= 10 &&
        a.artifactHashes.every(hex) &&
        new Set(a.artifactHashes).size === a.artifactHashes.length,
      "ACCEPTANCE_ATTESTATION_INVALID",
    );
    const identity = attestation.keyId + ":" + a.checkId;
    need(!seen.has(identity), "ACCEPTANCE_ATTESTATION_DUPLICATE");
    seen.add(identity);
    const check = CHECKS.find((c) => c.id === a.checkId);
    need(
      ["operator", check.reviewer].includes(authority.role),
      "ACCEPTANCE_ROLE_DENIED",
    );
    for (const digest of a.artifactHashes) {
      if (checkedArtifacts.has(digest)) continue;
      need(checkedArtifacts.size < 100, "ACCEPTANCE_ARTIFACT_CAPACITY");
      const bytes = readArtifact(digest);
      need(
        Buffer.isBuffer(bytes) &&
          bytes.length <= 8 * 1024 * 1024 &&
          crypto.createHash("sha256").update(bytes).digest("hex") === digest,
        "ACCEPTANCE_ARTIFACT_MISMATCH",
      );
      evidenceBytes += bytes.length;
      need(evidenceBytes <= maxEvidenceBytes, "ACCEPTANCE_ARTIFACT_CAPACITY");
      checkedArtifacts.add(digest);
    }
    verified.push({
      checkId: a.checkId,
      role: authority.role,
      principalId: authority.principalId,
      result: a.result,
      hashes: a.artifactHashes,
    });
  }
  const checks = CHECKS.map((c) => {
    const entries = verified.filter((v) => v.checkId === c.id),
      operator = entries.find((v) => v.role === "operator"),
      reviewer = entries.find((v) => v.role === c.reviewer);
    const independent =
      operator && reviewer && operator.principalId !== reviewer.principalId;
    const sameEvidence =
      independent &&
      operator.hashes.slice().sort().join(",") ===
        reviewer.hashes.slice().sort().join(",");
    return {
      checkId: c.id,
      packages: c.packages.slice(),
      status: entries.some((v) => v.result === "fail")
        ? "failed"
        : sameEvidence
          ? "evidence_ready_for_manual_review"
          : "missing",
      missingRoles: ["operator", c.reviewer].filter(
        (role) => !entries.some((v) => v.role === role),
      ),
      matchingEvidence: !!sameEvidence,
    };
  });
  const productionProfile =
    p.selection.hosting !== "local-development" &&
    p.selection.sso !== "none" &&
    p.selection.devices !== "none";
  return {
    schemaVersion: 1,
    kind: "thundy-acceptance-readiness",
    planHash,
    checkedAt: new Date(now).toISOString(),
    productionProfile,
    checks,
    readyForManualReview:
      productionProfile &&
      checks.every((c) => c.status === "evidence_ready_for_manual_review"),
    productionAccepted: false,
    sealed: false,
    extensionActivation: false,
    limitations: [
      "SIGNED_DECLARATIONS_REQUIRE_MANUAL_EVIDENCE_REVIEW",
      "NO_LIVE_PROBES_EXECUTED",
      "NO_SEALED_COMMIT_IMPLEMENTED",
    ],
  };
}
module.exports = { plan, evaluate, CHECKS, validatePlan };
