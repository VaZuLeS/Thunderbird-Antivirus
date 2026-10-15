"use strict";
const { HeartbeatAlerts } = require("./heartbeat_alerts.cjs"),
  { verifyPackage } = require("./review_package.cjs"),
  limits = require("./review_limits.cjs"),
  { need, exact, iso, hex } = require("./durable_journal.cjs");
const specs = [
  ["alarm_bytes", "bytes", limits.journalBytes, "reader"],
  ["alarm_actions", "actions", limits.journalActions, "reader"],
  ["source_bytes", "bytes", limits.journalBytes, "reader"],
  ["source_actions", "actions", limits.journalActions, "reader"],
  ["pending", "candidates", null, "signed_config"],
  ["observations", "observations", limits.observations, "reader"],
  ["comparisons", "comparisons", limits.deviceComparisons, "reader"],
  ["package_bytes", "bytes", limits.packageBytes, "package_format"],
  ["public_context_bytes", "bytes", limits.contextBytes, "package_format"],
];
function metric(id, unit, used, limit, basis, warningPercent) {
  need(
    Number.isSafeInteger(limit) &&
      limit > 0 &&
      (used === null ||
        (Number.isSafeInteger(used) && used >= 0 && used <= limit)),
    "CAPACITY_METRIC_INVALID",
  );
  const state =
    used === null
      ? "not_measured"
      : used === limit
        ? "reached"
        : used * 100 >= limit * warningPercent
          ? "warning"
          : "below";
  return {
    id,
    unit,
    used,
    limit,
    remaining: used === null ? null : limit - used,
    utilizationBasisPoints:
      used === null ? null : Math.floor((used * 10000) / limit),
    basis,
    state,
  };
}
function project(report) {
  need(
    report?.schemaVersion === 1 &&
      report.kind === "thundy-local-capacity" &&
      report.basisVersion === 1 &&
      iso(report.capturedAt) &&
      ["journals", "package"].includes(report.inputKind) &&
      Number.isSafeInteger(report.warningPercent) &&
      report.warningPercent > 0 &&
      report.warningPercent < 100 &&
      report.verification?.alarmJournalVerified === true &&
      report.verification.sourceJournalVerified === true &&
      report.verification.historicalStatesMatched === true &&
      report.verification.externalConfigurationUsed === true &&
      report.freeDiskMeasured === false &&
      report.deviceHealthMeasured === false &&
      report.writesPerformed === false &&
      report.externalDeliveryVerified === false &&
      report.sealed === false &&
      report.references &&
      [
        report.references.alarmHead,
        report.references.sourceHead,
        report.references.packageHash,
      ].every((v) => v === null || hex(v)) &&
      typeof report.pins?.alarm === "boolean" &&
      typeof report.pins.source === "boolean" &&
      (report.inputKind === "package"
        ? typeof report.pins.package === "boolean" &&
          hex(report.references.packageHash)
        : report.pins.package === null &&
          report.references.packageHash === null) &&
      Array.isArray(report.metrics) &&
      report.metrics.length === specs.length,
    "CAPACITY_REPORT_INVALID",
  );
  const metrics = specs.map(([id, unit, limit, basis], i) => {
    const expectedBasis =
      id === "pending" && report.metrics[1]?.used === 0
        ? "external_config"
        : basis;
    const m = report.metrics[i];
    need(
      m?.id === id &&
        m.unit === unit &&
        m.basis === expectedBasis &&
        (id === "pending"
          ? Number.isSafeInteger(m.limit) && m.limit > 0 && m.limit <= 10000
          : m.limit === limit),
      "CAPACITY_REPORT_INVALID",
    );
    const safe = metric(
      id,
      unit,
      m.used,
      m.limit,
      expectedBasis,
      report.warningPercent,
    );
    need(
      m.state === safe.state &&
        m.remaining === safe.remaining &&
        m.utilizationBasisPoints === safe.utilizationBasisPoints &&
        (i < 7
          ? m.used !== null
          : report.inputKind === "package"
            ? m.used !== null
            : m.used === null),
      "CAPACITY_REPORT_INVALID",
    );
    return safe;
  });
  return {
    schemaVersion: 1,
    kind: "thundy-local-capacity",
    basisVersion: 1,
    capturedAt: report.capturedAt,
    inputKind: report.inputKind,
    warningPercent: report.warningPercent,
    metrics,
    totals: Object.fromEntries(
      ["below", "warning", "reached", "not_measured"].map((s) => [
        s,
        metrics.filter((m) => m.state === s).length,
      ]),
    ),
    verification: {
      alarmJournalVerified: true,
      sourceJournalVerified: true,
      historicalStatesMatched: true,
      externalConfigurationUsed: true,
    },
    references: {
      alarmHead: report.references.alarmHead,
      sourceHead: report.references.sourceHead,
      packageHash: report.references.packageHash,
    },
    pins: {
      alarm: report.pins.alarm,
      source: report.pins.source,
      package: report.pins.package,
    },
    freeDiskMeasured: false,
    deviceHealthMeasured: false,
    writesPerformed: false,
    externalDeliveryVerified: false,
    sealed: false,
  };
}
function options({
  trustedContext,
  expectedHead,
  expectedSourceHead,
  warningPercent = 80,
  now = Date.now(),
  ...extra
} = {}) {
  need(
    Object.keys(extra).length === 0 &&
      exact(
        trustedContext,
        "source,signerKeyId,signerPublicKey,cooldownMs,maxSnapshotAgeMs,maxPending",
      ),
    "CAPACITY_OPTIONS_INVALID",
  );
  need(
    Number.isSafeInteger(warningPercent) &&
      warningPercent > 0 &&
      warningPercent < 100 &&
      Number.isSafeInteger(now) &&
      Math.abs(now) <= 8640000000000000,
    "CAPACITY_OPTIONS_INVALID",
  );
  for (const p of [expectedHead, expectedSourceHead])
    need(p === undefined || p === null || hex(p), "CAPACITY_PIN_INVALID");
  return {
    context: trustedContext,
    warningPercent,
    now,
    pins: {
      ...(expectedHead === undefined ? {} : { expectedHead }),
      ...(expectedSourceHead === undefined ? {} : { expectedSourceHead }),
    },
  };
}
function build(report, bytes, inputKind, o) {
  const used = [
    bytes.alarm,
    report.verification.actionCount,
    bytes.source,
    report.sourceComparison.sourceActionCount,
    report.pending,
    report.sourceComparison.observationCount,
    report.sourceComparison.deviceComparisonCount,
    bytes.package,
    bytes.publicContext,
  ];
  const metrics = specs.map(([id, unit, limit, basis], i) =>
    metric(
      id,
      unit,
      used[i],
      id === "pending" ? report.maxPending : limit,
      id === "pending" && report.verification.actionCount === 0
        ? "external_config"
        : basis,
      o.warningPercent,
    ),
  );
  return project({
    schemaVersion: 1,
    kind: "thundy-local-capacity",
    basisVersion: 1,
    capturedAt: new Date(o.now).toISOString(),
    inputKind,
    warningPercent: o.warningPercent,
    metrics,
    verification: {
      alarmJournalVerified: true,
      sourceJournalVerified: true,
      historicalStatesMatched: true,
      externalConfigurationUsed: true,
    },
    references: {
      alarmHead: report.journalHead,
      sourceHead: report.sourceComparison.sourceJournalHead,
      packageHash: report.packageVerification?.packageHash ?? null,
    },
    pins: {
      alarm: report.verification.headPinned,
      source: report.sourceComparison.sourceHeadPinned,
      package: report.packageVerification?.packageHashPinned ?? null,
    },
    freeDiskMeasured: false,
    deviceHealthMeasured: false,
    writesPerformed: false,
    externalDeliveryVerified: false,
    sealed: false,
  });
}
function capacityFromJournals(alarmContent, sourceContent, input) {
  const o = options(input),
    r = HeartbeatAlerts.verifyWithSource(alarmContent, sourceContent, {
      ...o.context,
      ...o.pins,
      maxBytes: limits.journalBytes,
      maxActions: limits.journalActions,
    });
  return build(
    r,
    {
      alarm: Buffer.byteLength(alarmContent),
      source: Buffer.byteLength(sourceContent),
      package: null,
      publicContext: null,
    },
    "journals",
    o,
  );
}
function capacityFromPackage(content, { expectedPackageHash, ...input } = {}) {
  const o = options(input),
    r = verifyPackage(content, {
      trustedContext: o.context,
      ...o.pins,
      ...(expectedPackageHash === undefined ? {} : { expectedPackageHash }),
    });
  return build(r, r.packageVerification.verifiedBytes, "package", o);
}
module.exports = { capacityFromJournals, capacityFromPackage, project };
