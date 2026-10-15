"use strict";
const {
  DurableJournal,
  need,
  exact,
  identifier,
  iso,
  hex,
  clone,
} = require("./durable_journal.cjs");
const { hash } = require("./ledger.cjs");
const count = (n) => Number.isSafeInteger(n) && n >= 0;
const knownErrors = new Set([
  "OUTBOX_EVENT_EXPIRED",
  "RETRY_LIMIT_REACHED",
  "DELIVERY_TIMEOUT",
  "DELIVERY_UNAVAILABLE",
  "RECEIPT_INVALID",
  "SIMULATION_UNAVAILABLE",
  "CLOUD_UNAVAILABLE",
  "JOBS_ATTEMPT_INTERRUPTED",
  "STORAGE_TIMEOUT",
  "STORAGE_UNAVAILABLE",
  "STORAGE_CONTENT_MISMATCH",
  "STORAGE_VERSION_OR_KEY_MISMATCH",
  "STORAGE_REGION_MISMATCH",
  "STORAGE_ACCOUNT_MISMATCH",
  "RETENTION_ALREADY_EXPIRED",
  "RETENTION_TOO_SHORT",
  "S3_COMPLIANCE_REQUIRED",
  "AZURE_IMMUTABILITY_OR_KEY_INVALID",
  "GCP_BUCKET_LOCK_REQUIRED",
  "STORAGE_PROVIDER_UNAVAILABLE",
  "OPERATOR_RETRY",
  "LOCAL_EXPORT_FAILED",
  "LOCAL_EXPORT_CONFLICT",
  "LOCAL_EXPORT_INTERRUPTED",
]);
const errorCode = (value) =>
  knownErrors.has(value) ? value : "UNCLASSIFIED_ERROR";
function summarize(
  { sourceId, capturedAt, outbox = null, storage = null, connectors = null },
  now,
  { staleAfterMs = 300000, deadlineWarningMs = 86400000 } = {},
) {
  need(
    identifier(sourceId) &&
      iso(capturedAt) &&
      Number.isFinite(now) &&
      Date.parse(capturedAt) <= now &&
      Number.isSafeInteger(staleAfterMs) &&
      staleAfterMs > 0 &&
      Number.isSafeInteger(deadlineWarningMs) &&
      deadlineWarningMs >= 0,
    "HEALTH_SNAPSHOT_INVALID",
  );
  need(
    outbox !== null || storage !== null || connectors !== null,
    "HEALTH_EMPTY",
  );
  const metrics = {},
    conditions = [],
    errors = new Map();
  const condition = (code, severity, countValue) => {
    if (countValue > 0) conditions.push({ code, severity, count: countValue });
  };
  const addError = (code) => {
    const safe = errorCode(code);
    errors.set(safe, (errors.get(safe) || 0) + 1);
  };
  if (outbox !== null) {
    need(
      outbox &&
        outbox.counts &&
        ["PENDING", "RETRY", "STAGED", "DEAD_LETTER"].every((k) =>
          count(outbox.counts[k]),
        ) &&
        [
          outbox.bytes,
          outbox.maxBytes,
          outbox.retainedEvents,
          outbox.maxEvents,
        ].every(count) &&
        outbox.maxBytes > 0 &&
        outbox.maxEvents > 0 &&
        outbox.bytes <= outbox.maxBytes &&
        outbox.retainedEvents <= outbox.maxEvents &&
        Object.values(outbox.counts).reduce((a, b) => a + b, 0) ===
          outbox.retainedEvents &&
        Array.isArray(outbox.errors) &&
        outbox.errors.length <= outbox.retainedEvents,
      "HEALTH_OUTBOX_INVALID",
    );
    const oldest = outbox.oldestQueuedAt;
    need(
      oldest === null ||
        (typeof oldest === "string" &&
          Number.isFinite(Date.parse(oldest)) &&
          Date.parse(oldest) <= Date.parse(capturedAt)),
      "HEALTH_OUTBOX_INVALID",
    );
    metrics.outbox = {
      counts: Object.fromEntries(
        ["PENDING", "RETRY", "STAGED", "DEAD_LETTER"].map((k) => [
          k,
          outbox.counts[k],
        ]),
      ),
      retainedEvents: outbox.retainedEvents,
      journalBytes: outbox.bytes,
      capacityRatio: Math.max(
        outbox.bytes / outbox.maxBytes,
        outbox.retainedEvents / outbox.maxEvents,
      ),
      oldestRetainedAgeMs:
        oldest === null ? null : Date.parse(capturedAt) - Date.parse(oldest),
    };
    condition("OUTBOX_DEAD_LETTER", "high", outbox.counts.DEAD_LETTER);
    condition(
      "OUTBOX_CAPACITY",
      "high",
      metrics.outbox.capacityRatio >= 0.8 ? 1 : 0,
    );
    for (const error of outbox.errors) addError(error?.error);
  }
  if (storage !== null) {
    need(
      storage?.kind === "thundy-storage-jobs-status" &&
        storage.schemaVersion === 1 &&
        storage.sealed === false &&
        [storage.journalBytes, storage.maxBytes, storage.maxJobs].every(
          count,
        ) &&
        storage.maxBytes > 0 &&
        storage.maxJobs > 0 &&
        storage.journalBytes <= storage.maxBytes &&
        Array.isArray(storage.jobs) &&
        storage.jobs.length <= storage.maxJobs,
      "HEALTH_STORAGE_INVALID",
    );
    const counts = {
      QUEUED: 0,
      WRITING: 0,
      RETRY: 0,
      DEAD_LETTER: 0,
      SIMULATION_COMPLETE: 0,
      CLOUD_OBSERVED: 0,
    };
    let retryDue = 0,
      retentionDue = 0,
      expired = 0;
    for (const job of storage.jobs) {
      need(
        job && Object.hasOwn(counts, job.status) && job.sealed === false,
        "HEALTH_STORAGE_INVALID",
      );
      counts[job.status]++;
      if (job.error) addError(job.error);
      if (job.nextAttemptAt !== null) {
        need(iso(job.nextAttemptAt), "HEALTH_STORAGE_INVALID");
        if (Date.parse(job.nextAttemptAt) <= Date.parse(capturedAt)) retryDue++;
      }
      // Successful observations still need refresh/live acceptance, never imply SEALED.
      const until = job.observedRetainUntil ?? job.requestedRetainUntil;
      if (until !== null) {
        need(iso(until), "HEALTH_STORAGE_INVALID");
        const remaining = Date.parse(until) - Date.parse(capturedAt);
        if (remaining <= 0) expired++;
        else if (remaining <= deadlineWarningMs) retentionDue++;
      }
    }
    metrics.storage = {
      counts,
      journalBytes: storage.journalBytes,
      capacityRatio: Math.max(
        storage.journalBytes / storage.maxBytes,
        storage.jobs.length / storage.maxJobs,
      ),
      retryDue,
      retentionDue,
      expiredRetention: expired,
    };
    condition("STORAGE_DEAD_LETTER", "high", counts.DEAD_LETTER);
    condition(
      "STORAGE_CAPACITY",
      "high",
      metrics.storage.capacityRatio >= 0.8 ? 1 : 0,
    );
    condition("STORAGE_RETRY_DUE", "medium", retryDue);
    condition("STORAGE_RETENTION_DUE", "medium", retentionDue);
    condition("STORAGE_RETENTION_EXPIRED", "high", expired);
  }
  if (connectors !== null) {
    need(
      connectors?.kind === "thundy-connector-status" &&
        connectors.schemaVersion === 1 &&
        connectors.sealed === false &&
        connectors.transportEnabled === false &&
        [
          connectors.journalBytes,
          connectors.maxBytes,
          connectors.maxJobs,
        ].every(count) &&
        connectors.maxBytes > 0 &&
        connectors.maxJobs > 0 &&
        connectors.journalBytes <= connectors.maxBytes &&
        Array.isArray(connectors.jobs) &&
        connectors.jobs.length <= connectors.maxJobs,
      "HEALTH_CONNECTOR_INVALID",
    );
    const counts = {
      QUEUED: 0,
      WRITING: 0,
      RETRY: 0,
      DEAD_LETTER: 0,
      EXPORTED: 0,
    };
    for (const job of connectors.jobs) {
      need(
        job && Object.hasOwn(counts, job.status),
        "HEALTH_CONNECTOR_INVALID",
      );
      counts[job.status]++;
      if (job.error) addError(job.error);
    }
    metrics.connectors = {
      counts,
      journalBytes: connectors.journalBytes,
      capacityRatio: Math.max(
        connectors.journalBytes / connectors.maxBytes,
        connectors.jobs.length / connectors.maxJobs,
      ),
      remoteDeliveryVerified: false,
    };
    condition("CONNECTOR_DEAD_LETTER", "high", counts.DEAD_LETTER);
    condition(
      "CONNECTOR_CAPACITY",
      "high",
      metrics.connectors.capacityRatio >= 0.8 ? 1 : 0,
    );
  }
  const stale = now - Date.parse(capturedAt) > staleAfterMs;
  condition("SNAPSHOT_STALE", "medium", stale ? 1 : 0);
  const groupedErrors = [...errors]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([code, n]) => ({ code, count: n }));
  return {
    schemaVersion: 1,
    kind: "thundy-local-health",
    sourceId,
    capturedAt,
    ageMs: now - Date.parse(capturedAt),
    stale,
    metrics,
    errors: groupedErrors,
    conditions,
    fleetCoverage: "not_measured",
    heartbeatStatus: "not_measured",
    sealed: false,
  };
}
class HealthMonitor {
  constructor({
    directory,
    signerKeyId,
    signerPrivateKey,
    sourceId,
    cooldownMs = 900000,
    staleAfterMs = 300000,
    deadlineWarningMs = 86400000,
    maxPending = 1000,
    clock = Date.now,
    ...options
  }) {
    need(
      identifier(sourceId) &&
        Number.isSafeInteger(maxPending) &&
        maxPending > 0 &&
        maxPending <= 10000 &&
        Number.isSafeInteger(cooldownMs) &&
        cooldownMs > 0 &&
        cooldownMs <= 86400000 &&
        Number.isSafeInteger(staleAfterMs) &&
        staleAfterMs > 0 &&
        Number.isSafeInteger(deadlineWarningMs) &&
        deadlineWarningMs >= 0,
      "HEALTH_CONFIG_INVALID",
    );
    Object.assign(this, {
      sourceId,
      cooldownMs,
      staleAfterMs,
      deadlineWarningMs,
      maxPending,
    });
    this.journal = new DurableJournal({
      directory,
      signerKeyId,
      signerPrivateKey,
      clock,
      ...options,
      scope: {
        kind: "health-v1",
        sourceId,
        cooldownMs,
        staleAfterMs,
        deadlineWarningMs,
      },
      initialState: {
        lastCapturedAt: null,
        lastSnapshotHash: null,
        lastStale: false,
        alerts: {},
        notifications: {},
        deliveryLimit: null,
        legacyObservations: 0,
      },
      reducer: (state, p) => {
        if (p.kind === "NOTIFICATION_ACKNOWLEDGED") {
          need(
            exact(p.data, "notificationId,consumerId") &&
              hex(p.data.notificationId) &&
              identifier(p.data.consumerId),
            "HEALTH_ACK_INVALID",
          );
          const notification = state.notifications[p.data.notificationId];
          need(
            notification && notification.status === "PENDING",
            "HEALTH_ACK_INVALID",
          );
          notification.status = "ACKNOWLEDGED";
          notification.acknowledgedAt = p.at;
          notification.consumerId = p.data.consumerId;
          return state;
        }
        const queued = p.kind === "OBSERVED_QUEUED";
        need(
          (p.kind === "OBSERVED" || queued) &&
            exact(
              p.data,
              queued
                ? "capturedAt,snapshotHash,conditions,maxPending"
                : "capturedAt,snapshotHash,conditions",
            ) &&
            iso(p.data.capturedAt) &&
            Date.parse(p.data.capturedAt) <= Date.parse(p.at) &&
            /^[a-f0-9]{64}$/.test(p.data.snapshotHash) &&
            Array.isArray(p.data.conditions) &&
            p.data.conditions.length <= 10,
          "HEALTH_ACTION_INVALID",
        );
        if (queued) {
          need(
            p.data.maxPending === maxPending &&
              (state.deliveryLimit === null ||
                state.deliveryLimit === maxPending),
            "HEALTH_DELIVERY_LIMIT_MISMATCH",
          );
          state.deliveryLimit = maxPending;
        } else {
          need(state.deliveryLimit === null, "HEALTH_LEGACY_AFTER_QUEUE");
          state.legacyObservations++;
        }
        const stale = p.data.conditions.some(
          (c) => c.code === "SNAPSHOT_STALE",
        );
        need(
          !state.lastCapturedAt ||
            Date.parse(p.data.capturedAt) > Date.parse(state.lastCapturedAt) ||
            (p.data.capturedAt === state.lastCapturedAt &&
              p.data.snapshotHash === state.lastSnapshotHash &&
              stale &&
              !state.lastStale),
          "HEALTH_SNAPSHOT_REPLAY",
        );
        const seen = new Set();
        for (const c of p.data.conditions) {
          need(
            exact(c, "code,severity,count") &&
              [
                "OUTBOX_DEAD_LETTER",
                "OUTBOX_CAPACITY",
                "STORAGE_DEAD_LETTER",
                "STORAGE_CAPACITY",
                "STORAGE_RETRY_DUE",
                "STORAGE_RETENTION_DUE",
                "CONNECTOR_DEAD_LETTER",
                "CONNECTOR_CAPACITY",
                "STORAGE_RETENTION_EXPIRED",
                "SNAPSHOT_STALE",
              ].includes(c.code) &&
              ["medium", "high"].includes(c.severity) &&
              count(c.count) &&
              c.count > 0 &&
              !seen.has(c.code),
            "HEALTH_ACTION_INVALID",
          );
          seen.add(c.code);
        }
        for (const [code, alert] of Object.entries(state.alerts))
          if (!seen.has(code) && (!stale || code === "SNAPSHOT_STALE")) {
            alert.active = false;
            alert.suppressed = 0;
          }
        for (const c of p.data.conditions) {
          const previous = state.alerts[c.code],
            emit =
              !previous?.active ||
              Date.parse(p.at) - Date.parse(previous.lastEmittedAt) >=
                cooldownMs;
          if (emit && queued) {
            const notificationId = hash({
              sourceId,
              observationIndex: p.index,
              snapshotHash: p.data.snapshotHash,
              code: c.code,
            });
            state.notifications[notificationId] = {
              notificationId,
              sourceId,
              ...c,
              capturedAt: p.data.capturedAt,
              generatedAt: p.at,
              observationIndex: p.index,
              repeatedObservations: previous?.active ? previous.suppressed : 0,
              status: "PENDING",
              acknowledgedAt: null,
              consumerId: null,
            };
          }
          state.alerts[c.code] = {
            active: true,
            lastEmittedAt: emit ? p.at : previous.lastEmittedAt,
            suppressed: emit ? 0 : previous.suppressed + 1,
          };
        }
        need(
          Object.values(state.notifications).filter(
            (n) => n.status === "PENDING",
          ).length <= maxPending,
          "HEALTH_NOTIFICATION_CAPACITY",
        );
        state.lastCapturedAt = p.data.capturedAt;
        state.lastSnapshotHash = p.data.snapshotHash;
        state.lastStale = stale;
        return state;
      },
    });
  }
  observe(input) {
    need(input.sourceId === this.sourceId, "HEALTH_SOURCE_MISMATCH");
    const now = this.journal.now(),
      report = summarize(input, now, this),
      state = this.journal.snapshot(),
      snapshotHash = hash(input);
    if (state.lastCapturedAt === input.capturedAt) {
      need(state.lastSnapshotHash === snapshotHash, "HEALTH_SNAPSHOT_CONFLICT");
      if (!report.stale || state.lastStale)
        return {
          ...report,
          duplicate: true,
          notifications: [],
          journalHead: this.journal.head(),
        };
    }
    const notifications = [],
      conditions = report.stale
        ? report.conditions.filter((c) => c.code === "SNAPSHOT_STALE")
        : report.conditions;
    const committed = this.journal.append("OBSERVED_QUEUED", {
      capturedAt: input.capturedAt,
      snapshotHash,
      conditions,
      maxPending: this.maxPending,
    });
    const durable = this.journal.snapshot();
    notifications.push(
      ...Object.values(durable.notifications).filter(
        (n) => n.observationIndex === committed.payload.index,
      ),
    );
    return {
      ...report,
      duplicate: false,
      notifications,
      journalHead: this.journal.head(),
    };
  }
  pending({ limit = 100 } = {}) {
    need(
      Number.isSafeInteger(limit) && limit > 0 && limit <= 1000,
      "HEALTH_PENDING_LIMIT_INVALID",
    );
    const state = this.journal.snapshot();
    return Object.values(state.notifications)
      .filter((n) => n.status === "PENDING")
      .slice(0, limit);
  }
  notificationStatus() {
    const state = this.journal.snapshot(),
      notifications = Object.values(state.notifications);
    return {
      schemaVersion: 1,
      kind: "thundy-health-notification-status",
      sourceId: this.sourceId,
      pending: notifications.filter((n) => n.status === "PENDING").length,
      acknowledged: notifications.filter((n) => n.status === "ACKNOWLEDGED")
        .length,
      maxPending: this.maxPending,
      legacyObservations: state.legacyObservations,
      journalHead: this.journal.head(),
      externalDeliveryVerified: false,
      sealed: false,
    };
  }
  acknowledge(notificationId, { consumerId } = {}) {
    need(hex(notificationId) && identifier(consumerId), "HEALTH_ACK_INVALID");
    const n = this.journal.snapshot().notifications[notificationId];
    need(n, "HEALTH_NOTIFICATION_UNKNOWN");
    if (n.status === "ACKNOWLEDGED") {
      need(n.consumerId === consumerId, "HEALTH_ACK_CONFLICT");
      return { duplicate: true, notification: clone(n) };
    }
    this.journal.append("NOTIFICATION_ACKNOWLEDGED", {
      notificationId,
      consumerId,
    });
    return {
      duplicate: false,
      notification: this.journal.snapshot().notifications[notificationId],
    };
  }
  close() {
    this.journal.close();
  }
}
function collectSnapshot({
  sourceId,
  outbox,
  storage,
  connectors,
  now = Date.now(),
}) {
  const result = { sourceId, capturedAt: new Date(now).toISOString() };
  for (const [name, queue] of Object.entries({ outbox, storage, connectors }))
    if (queue !== undefined) result[name] = queue.status();
  return result;
}
module.exports = { summarize, HealthMonitor, collectSnapshot };
