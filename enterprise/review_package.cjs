"use strict";
const crypto = require("node:crypto"),
  canonicalize = require("canonicalize");
const { need, exact, hex, clone } = require("./durable_journal.cjs"),
  { HeartbeatAlerts } = require("./heartbeat_alerts.cjs");
const reviewLimits = require("./review_limits.cjs");
const paths = [
    "alarms/actions.jsonl",
    "heartbeats/actions.jsonl",
    "trust/public-context.json",
  ],
  limits = [
    reviewLimits.journalBytes,
    reviewLimits.journalBytes,
    reviewLimits.contextBytes,
  ],
  MAX_BYTES = reviewLimits.packageBytes;
const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const encode = (value) => Buffer.from(canonicalize(value) + "\n");
function publicKey(value) {
  need(
    value?.type === "public" ||
      (typeof value === "string" &&
        /^-----BEGIN PUBLIC KEY-----\r?\n/.test(value) &&
        !value.includes("PRIVATE KEY")),
    "REVIEW_PACKAGE_PUBLIC_KEY_REQUIRED",
  );
  const key = value?.type === "public" ? value : crypto.createPublicKey(value);
  need(
    key.asymmetricKeyType === "ed25519" && typeof key.export === "function",
    "REVIEW_PACKAGE_KEY_INVALID",
  );
  return key.export({ type: "spki", format: "pem" });
}
function publicContext(context) {
  need(
    exact(
      context,
      "source,signerKeyId,signerPublicKey,cooldownMs,maxSnapshotAgeMs,maxPending",
    ) &&
      exact(
        context.source,
        "organizationId,registrations,minimumExtensionVersion,lateAfterMs,unknownAfterMs,maxClockSkewMs,signerKeyId,signerPublicKey",
      ) &&
      Array.isArray(context.source.registrations),
    "REVIEW_PACKAGE_CONTEXT_INVALID",
  );
  need(
    context.source.registrations.every(
      (r) =>
        exact(
          r,
          "keyId,organizationId,deviceId,streamEpoch,policyId,policyVersion,revoked,publicKey",
        ) &&
        [
          "keyId",
          "organizationId",
          "deviceId",
          "streamEpoch",
          "policyId",
          "publicKey",
        ].every((k) => typeof r[k] === "string") &&
        Number.isSafeInteger(r.policyVersion) &&
        typeof r.revoked === "boolean",
    ),
    "REVIEW_PACKAGE_CONTEXT_INVALID",
  );
  const source = {
    ...context.source,
    signerPublicKey: publicKey(context.source.signerPublicKey),
    registrations: clone(context.source.registrations).sort((a, b) =>
      a.keyId < b.keyId ? -1 : a.keyId > b.keyId ? 1 : 0,
    ),
  };
  const result = {
    source,
    signerKeyId: context.signerKeyId,
    signerPublicKey: publicKey(context.signerPublicKey),
    cooldownMs: context.cooldownMs,
    maxSnapshotAgeMs: context.maxSnapshotAgeMs,
    maxPending: context.maxPending,
  };
  // Enforce the complete registry/scope and public-only contract even for empty journals.
  HeartbeatAlerts.verifyJournal("", result);
  return result;
}
function bytes(value, limit) {
  need(
    typeof value === "string" || Buffer.isBuffer(value),
    "REVIEW_PACKAGE_INPUT_INVALID",
  );
  need(Buffer.byteLength(value) <= limit, "REVIEW_PACKAGE_CAPACITY");
  return Buffer.from(value);
}
function pins(options) {
  need(
    exact(options, "expectedHead,expectedSourceHead"),
    "REVIEW_PACKAGE_OPTIONS_INVALID",
  );
  for (const value of Object.values(options))
    need(
      value === undefined || value === null || hex(value),
      "REVIEW_PACKAGE_PIN_INVALID",
    );
  return Object.fromEntries(
    Object.entries(options).filter(([, v]) => v !== undefined),
  );
}
function createPackage(
  alarmContent,
  sourceContent,
  { trustedContext, expectedHead, expectedSourceHead, ...extra } = {},
) {
  need(Object.keys(extra).length === 0, "REVIEW_PACKAGE_OPTIONS_INVALID");
  const context = publicContext(trustedContext),
    alarm = bytes(alarmContent, limits[0]),
    source = bytes(sourceContent, limits[1]);
  const report = HeartbeatAlerts.verifyWithSource(alarm, source, {
    ...context,
    ...pins({ expectedHead, expectedSourceHead }),
  });
  const config = encode({
    schemaVersion: 1,
    kind: "thundy-review-public-context",
    context,
  });
  need(config.length <= limits[2], "REVIEW_PACKAGE_CAPACITY");
  const content = [alarm, source, config],
    entries = content.map((b, i) => ({
      path: paths[i],
      bytes: b.length,
      sha256: sha256(b),
    }));
  const result = encode({
    schemaVersion: 1,
    kind: "thundy-local-review-package",
    manifest: {
      schemaVersion: 1,
      kind: "thundy-review-package-manifest",
      entries,
      alarmHead: report.journalHead,
      sourceHead: report.sourceComparison.sourceJournalHead,
    },
    files: content.map((b, i) => ({
      path: paths[i],
      encoding: "base64",
      data: b.toString("base64"),
    })),
  });
  need(result.length <= MAX_BYTES, "REVIEW_PACKAGE_CAPACITY");
  return result;
}
function verifyPackage(
  content,
  {
    trustedContext,
    expectedPackageHash,
    expectedHead,
    expectedSourceHead,
    ...extra
  } = {},
) {
  need(Object.keys(extra).length === 0, "REVIEW_PACKAGE_OPTIONS_INVALID");
  need(trustedContext !== undefined, "REVIEW_PACKAGE_TRUST_REQUIRED");
  need(
    expectedPackageHash === undefined || hex(expectedPackageHash),
    "REVIEW_PACKAGE_PIN_INVALID",
  );
  const reference = publicContext(trustedContext),
    pinOptions = pins({ expectedHead, expectedSourceHead }),
    raw = bytes(content, MAX_BYTES),
    packageHash = sha256(raw);
  need(
    expectedPackageHash === undefined || expectedPackageHash === packageHash,
    "REVIEW_PACKAGE_HASH_MISMATCH",
  );
  let p;
  try {
    p = JSON.parse(raw.toString("utf8"));
  } catch {
    need(false, "REVIEW_PACKAGE_JSON_INVALID");
  }
  need(
    exact(p, "schemaVersion,kind,manifest,files") &&
      p.schemaVersion === 1 &&
      p.kind === "thundy-local-review-package" &&
      exact(p.manifest, "schemaVersion,kind,entries,alarmHead,sourceHead") &&
      p.manifest.schemaVersion === 1 &&
      p.manifest.kind === "thundy-review-package-manifest" &&
      Array.isArray(p.manifest.entries) &&
      p.manifest.entries.length === 3 &&
      Array.isArray(p.files) &&
      p.files.length === 3,
    "REVIEW_PACKAGE_FORMAT_INVALID",
  );
  need(
    (p.manifest.alarmHead === null || hex(p.manifest.alarmHead)) &&
      (p.manifest.sourceHead === null || hex(p.manifest.sourceHead)),
    "REVIEW_PACKAGE_FORMAT_INVALID",
  );
  const decoded = p.files.map((f, i) => {
    const entry = p.manifest.entries[i];
    need(
      exact(f, "path,encoding,data") &&
        exact(entry, "path,bytes,sha256") &&
        f.path === paths[i] &&
        entry.path === paths[i] &&
        f.encoding === "base64" &&
        typeof f.data === "string" &&
        Number.isSafeInteger(entry.bytes) &&
        entry.bytes >= 0 &&
        entry.bytes <= limits[i] &&
        hex(entry.sha256),
      "REVIEW_PACKAGE_ENTRY_INVALID",
    );
    need(
      f.data.length <= 4 * Math.ceil(limits[i] / 3),
      "REVIEW_PACKAGE_CAPACITY",
    );
    need(
      f.data.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(f.data),
      "REVIEW_PACKAGE_ENCODING_INVALID",
    );
    const b = Buffer.from(f.data, "base64");
    need(
      b.length === entry.bytes &&
        b.length <= limits[i] &&
        b.toString("base64") === f.data,
      "REVIEW_PACKAGE_ENCODING_INVALID",
    );
    need(sha256(b) === entry.sha256, "REVIEW_PACKAGE_ENTRY_HASH_MISMATCH");
    return b;
  });
  // Validate scalar fields before canonicalization, excluding deep objects and duplicate JSON keys.
  need(raw.equals(encode(p)), "REVIEW_PACKAGE_CANONICAL_REQUIRED");
  let embedded;
  try {
    embedded = JSON.parse(decoded[2].toString("utf8"));
  } catch {
    need(false, "REVIEW_PACKAGE_CONTEXT_INVALID");
  }
  need(
    exact(embedded, "schemaVersion,kind,context") &&
      embedded.schemaVersion === 1 &&
      embedded.kind === "thundy-review-public-context",
    "REVIEW_PACKAGE_CONTEXT_INVALID",
  );
  const supplied = publicContext(embedded.context);
  need(
    decoded[2].equals(
      encode({
        schemaVersion: 1,
        kind: "thundy-review-public-context",
        context: supplied,
      }),
    ),
    "REVIEW_PACKAGE_CONTEXT_INVALID",
  );
  need(
    canonicalize(supplied) === canonicalize(reference),
    "REVIEW_PACKAGE_TRUST_MISMATCH",
  );
  const report = HeartbeatAlerts.verifyWithSource(decoded[0], decoded[1], {
    ...reference,
    ...pinOptions,
  });
  need(
    p.manifest.alarmHead === report.journalHead &&
      p.manifest.sourceHead === report.sourceComparison.sourceJournalHead,
    "REVIEW_PACKAGE_MANIFEST_MISMATCH",
  );
  return {
    ...report,
    packageVerification: {
      schemaVersion: 1,
      kind: "thundy-review-package-verification",
      packageHash,
      packageHashPinned: expectedPackageHash !== undefined,
      externalConfigurationMatched: true,
      entryHashesVerified: true,
      entryCount: 3,
      manifestHash: sha256(encode(p.manifest)),
      embeddedKeysTrustedAutomatically: false,
      extracted: false,
      sealed: false,
      verifiedBytes: {
        package: raw.length,
        alarm: decoded[0].length,
        source: decoded[1].length,
        publicContext: decoded[2].length,
      },
    },
  };
}
module.exports = { createPackage, verifyPackage, publicContext, MAX_BYTES };
