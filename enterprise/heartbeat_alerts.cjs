"use strict";
const crypto = require("node:crypto");
const {
  DurableJournal,
  need,
  exact,
  identifier,
  iso,
  hex,
  clone,
} = require("./durable_journal.cjs");
const { Heartbeats } = require("./heartbeats.cjs");
const { hash } = require("./ledger.cjs");
const statuses = ["NEVER_SEEN", "CURRENT", "LATE", "UNKNOWN", "REVOKED"];
const initialState = () => ({
  lastObservation: null,
  devices: {},
  notifications: {},
});
function setup({
  source,
  cooldownMs = 900000,
  maxSnapshotAgeMs = 300000,
  maxPending = 1000,
}) {
  need(
    exact(
      source,
      "organizationId,registrations,minimumExtensionVersion,lateAfterMs,unknownAfterMs,maxClockSkewMs,signerKeyId,signerPublicKey",
    ) &&
      Number.isSafeInteger(cooldownMs) &&
      cooldownMs > 0 &&
      cooldownMs <= 86400000 &&
      Number.isSafeInteger(maxSnapshotAgeMs) &&
      maxSnapshotAgeMs > 0 &&
      maxSnapshotAgeMs <= 3600000 &&
      Number.isSafeInteger(maxPending) &&
      maxPending > 0 &&
      maxPending <= 10000,
    "HEARTBEAT_ALERT_CONFIG_INVALID",
  );
  // Reuse the source verifier to validate the complete public trust context, even for an empty journal.
  Heartbeats.verifyJournal("", { ...source, now: 0 });
  const publicKey = crypto.createPublicKey(
    typeof source.signerPublicKey === "string"
      ? source.signerPublicKey
      : source.signerPublicKey.export({ type: "spki", format: "pem" }),
  );
  const normalized = {
    ...source,
    signerPublicKey: publicKey.export({ type: "spki", format: "pem" }),
    registrations: clone(source.registrations).sort((a, b) =>
      a.keyId < b.keyId ? -1 : a.keyId > b.keyId ? 1 : 0,
    ),
  };
  const scope = {
    kind: "heartbeat-alerts-v1",
    ruleVersion: 1,
    source: normalized,
    cooldownMs,
    maxSnapshotAgeMs,
    maxPending,
  };
  const reducer = (state, p) => {
    if (p.kind === "NOTIFICATION_ACKNOWLEDGED") {
      need(
        exact(p.data, "notificationId,consumerId") &&
          hex(p.data.notificationId) &&
          identifier(p.data.consumerId),
        "HEARTBEAT_ALERT_ACK_INVALID",
      );
      const n = state.notifications[p.data.notificationId];
      need(n && n.status === "PENDING", "HEARTBEAT_ALERT_ACK_INVALID");
      n.status = "ACKNOWLEDGED";
      n.acknowledgedAt = p.at;
      n.consumerId = p.data.consumerId;
      return state;
    }
    const o = p.data;
    need(
      p.kind === "HEARTBEATS_OBSERVED" &&
        exact(
          o,
          "evaluatedAt,sourceHead,sourceActionCount,sourceHeadPinned,devices",
        ) &&
        iso(o.evaluatedAt) &&
        Date.parse(o.evaluatedAt) <= Date.parse(p.at) &&
        Date.parse(p.at) - Date.parse(o.evaluatedAt) <= maxSnapshotAgeMs &&
        Number.isSafeInteger(o.sourceActionCount) &&
        o.sourceActionCount >= 0 &&
        o.sourceActionCount <= 10000 &&
        (o.sourceActionCount === 0
          ? o.sourceHead === null
          : hex(o.sourceHead)) &&
        typeof o.sourceHeadPinned === "boolean" &&
        Array.isArray(o.devices) &&
        o.devices.length === normalized.registrations.length,
      "HEARTBEAT_ALERT_OBSERVATION_INVALID",
    );
    const previous = state.lastObservation;
    need(
      !previous || Date.parse(o.evaluatedAt) > Date.parse(previous.evaluatedAt),
      "HEARTBEAT_ALERT_EVALUATION_REPLAY",
    );
    need(
      !previous ||
        (o.sourceActionCount >= previous.sourceActionCount &&
          (o.sourceActionCount !== previous.sourceActionCount ||
            o.sourceHead === previous.sourceHead)),
      "HEARTBEAT_ALERT_SOURCE_ROLLBACK",
    );
    o.devices.forEach((d, i) => {
      const r = normalized.registrations[i],
        old = state.devices[d.deviceId];
      need(
        exact(d, "keyId,deviceId,status,receivedAt,observedAt,sequence") &&
          d.keyId === r.keyId &&
          d.deviceId === r.deviceId &&
          statuses.includes(d.status) &&
          ((d.sequence === null &&
            d.receivedAt === null &&
            d.observedAt === null) ||
            (Number.isSafeInteger(d.sequence) &&
              d.sequence > 0 &&
              iso(d.receivedAt) &&
              iso(d.observedAt) &&
              Date.parse(d.receivedAt) <= Date.parse(o.evaluatedAt) &&
              Math.abs(Date.parse(d.observedAt) - Date.parse(d.receivedAt)) <=
                normalized.maxClockSkewMs)) &&
          (d.sequence === null || d.sequence <= o.sourceActionCount),
        "HEARTBEAT_ALERT_DEVICE_INVALID",
      );
      const age =
        d.sequence === null
          ? null
          : Math.max(
              Date.parse(o.evaluatedAt) - Date.parse(d.receivedAt),
              Date.parse(o.evaluatedAt) - Date.parse(d.observedAt),
              0,
            );
      const status = r.revoked
        ? "REVOKED"
        : age === null
          ? "NEVER_SEEN"
          : age >= normalized.unknownAfterMs
            ? "UNKNOWN"
            : age >= normalized.lateAfterMs
              ? "LATE"
              : "CURRENT";
      need(
        d.status === status &&
          (!old?.sequence ||
            (d.sequence >= old.sequence &&
              Date.parse(d.receivedAt) >= Date.parse(old.receivedAt) &&
              Date.parse(d.observedAt) >= Date.parse(old.observedAt) &&
              (d.sequence !== old.sequence ||
                (d.receivedAt === old.receivedAt &&
                  d.observedAt === old.observedAt)))),
        "HEARTBEAT_ALERT_DEVICE_REPLAY",
      );
      if (previous && o.sourceActionCount === previous.sourceActionCount)
        need(
          d.sequence === (old?.sequence ?? null) &&
            d.receivedAt === (old?.receivedAt ?? null) &&
            d.observedAt === (old?.observedAt ?? null),
          "HEARTBEAT_ALERT_SOURCE_CONFLICT",
        );
      const outage = ["LATE", "UNKNOWN"].includes(d.status),
        wasOutage = ["LATE", "UNKNOWN"].includes(old?.status),
        recovered = d.status === "CURRENT" && wasOutage;
      const firstDetectedAt = outage
        ? wasOutage
          ? old.firstDetectedAt
          : o.evaluatedAt
        : null;
      const code = outage
        ? `HEARTBEAT_${d.status}`
        : d.status === "NEVER_SEEN"
          ? "HEARTBEAT_NEVER_SEEN"
          : recovered
            ? "HEARTBEAT_RECOVERED"
            : null;
      const emit =
        code &&
        (recovered ||
          !old ||
          old.status !== d.status ||
          (outage &&
            Date.parse(o.evaluatedAt) - Date.parse(old.lastEmittedAt) >=
              cooldownMs));
      if (emit) {
        const notificationId = hash({
          scopeHash: hash(scope),
          observationIndex: p.index,
          evaluatedAt: o.evaluatedAt,
          deviceId: d.deviceId,
          code,
        });
        state.notifications[notificationId] = {
          notificationId,
          ruleVersion: 1,
          code,
          severity:
            d.status === "UNKNOWN"
              ? "high"
              : d.status === "LATE"
                ? "medium"
                : "info",
          keyId: d.keyId,
          deviceId: d.deviceId,
          observedStatus: d.status,
          evaluatedAt: o.evaluatedAt,
          generatedAt: p.at,
          firstDetectedAt: recovered ? old.firstDetectedAt : firstDetectedAt,
          lastReceivedAt: d.receivedAt,
          deviceObservedAt: d.observedAt,
          sequence: d.sequence,
          sourceHead: o.sourceHead,
          sourceActionCount: o.sourceActionCount,
          sourceHeadPinned: o.sourceHeadPinned,
          observationIndex: p.index,
          status: "PENDING",
          acknowledgedAt: null,
          consumerId: null,
        };
      }
      state.devices[d.deviceId] = {
        ...d,
        firstDetectedAt,
        lastEmittedAt: emit ? o.evaluatedAt : (old?.lastEmittedAt ?? null),
      };
    });
    need(
      Object.values(state.notifications).filter((n) => n.status === "PENDING")
        .length <= maxPending,
      "HEARTBEAT_ALERT_CAPACITY",
    );
    state.lastObservation = clone(o);
    return state;
  };
  return { source: normalized, scope, reducer, maxPending };
}
function status(state, head, maxPending, registeredDevices) {
  const counts = Object.fromEntries(
    statuses.map((s) => [
      s,
      Object.values(state.devices).filter((d) => d.status === s).length,
    ]),
  );
  const notifications = Object.values(state.notifications);
  return {
    schemaVersion: 1,
    kind: "thundy-local-heartbeat-alert-status",
    ruleVersion: 1,
    evaluatedAt: state.lastObservation?.evaluatedAt ?? null,
    counts,
    registeredDevices,
    notEvaluatedDevices: registeredDevices - Object.keys(state.devices).length,
    pending: notifications.filter((n) => n.status === "PENDING").length,
    acknowledged: notifications.filter((n) => n.status === "ACKNOWLEDGED")
      .length,
    maxPending,
    sourceHead: state.lastObservation?.sourceHead ?? null,
    sourceActionCount: state.lastObservation?.sourceActionCount ?? 0,
    journalHead: head,
    coverage: "explicit-test-registry-only",
    runtimeIntegrated: false,
    productionFleetVerified: false,
    externalDeliveryVerified: false,
    sealed: false,
  };
}
class HeartbeatAlerts {
  constructor({
    directory,
    signerKeyId,
    signerPrivateKey,
    source,
    cooldownMs,
    maxSnapshotAgeMs,
    maxPending,
    ...options
  }) {
    need(
      Object.keys(options).every((k) =>
        ["clock", "io", "maxActions", "maxBytes", "expectedHead"].includes(k),
      ),
      "HEARTBEAT_ALERT_OPTION_UNSUPPORTED",
    );
    this.config = setup({ source, cooldownMs, maxSnapshotAgeMs, maxPending });
    this.maxSnapshotAgeMs = maxSnapshotAgeMs ?? 300000;
    this.journal = new DurableJournal({
      directory,
      signerKeyId,
      signerPrivateKey,
      ...options,
      scope: this.config.scope,
      reducer: this.config.reducer,
      initialState: initialState(),
    });
  }
  observe(content, { evaluatedAt, expectedSourceHead } = {}) {
    const now = this.journal.now(),
      at = evaluatedAt ?? new Date(now).toISOString();
    need(
      iso(at) &&
        Date.parse(at) <= now &&
        now - Date.parse(at) <= this.maxSnapshotAgeMs,
      "HEARTBEAT_ALERT_SNAPSHOT_STALE_OR_FUTURE",
    );
    need(
      expectedSourceHead === undefined || hex(expectedSourceHead),
      "HEARTBEAT_ALERT_HEAD_INVALID",
    );
    const report = Heartbeats.verifyJournal(content, {
      ...this.config.source,
      now: Date.parse(at),
      ...(expectedSourceHead === undefined
        ? {}
        : { expectedHead: expectedSourceHead }),
    });
    const observation = {
      evaluatedAt: at,
      sourceHead: report.journalHead,
      sourceActionCount: report.verification.actionCount,
      sourceHeadPinned: report.verification.headPinned,
      devices: report.devices.map((d) =>
        Object.fromEntries(
          [
            "keyId",
            "deviceId",
            "status",
            "receivedAt",
            "observedAt",
            "sequence",
          ].map((k) => [k, d[k]]),
        ),
      ),
    };
    const state = this.journal.snapshot(),
      last = state.lastObservation;
    // A fully valid alternate branch or prefix must not replace the source history already processed.
    if (last?.sourceActionCount) {
      const records = content.toString().split("\n").filter(Boolean);
      need(
        records.length >= last.sourceActionCount &&
          hash(JSON.parse(records[last.sourceActionCount - 1])) ===
            last.sourceHead,
        "HEARTBEAT_ALERT_SOURCE_ROLLBACK",
      );
    }
    if (last?.evaluatedAt === at) {
      need(
        hash(last) === hash(observation),
        "HEARTBEAT_ALERT_SNAPSHOT_CONFLICT",
      );
      return { ...this.status(), duplicate: true, notifications: [] };
    }
    const record = this.journal.append("HEARTBEATS_OBSERVED", observation),
      durable = this.journal.snapshot();
    return {
      ...this.status(),
      duplicate: false,
      notifications: Object.values(durable.notifications).filter(
        (n) => n.observationIndex === record.payload.index,
      ),
    };
  }
  pending({ limit = 100 } = {}) {
    need(
      Number.isSafeInteger(limit) && limit > 0 && limit <= 1000,
      "HEARTBEAT_ALERT_LIMIT_INVALID",
    );
    return Object.values(this.journal.snapshot().notifications)
      .filter((n) => n.status === "PENDING")
      .slice(0, limit);
  }
  acknowledge(notificationId, { consumerId } = {}) {
    need(
      hex(notificationId) && identifier(consumerId),
      "HEARTBEAT_ALERT_ACK_INVALID",
    );
    const n = this.journal.snapshot().notifications[notificationId];
    need(n, "HEARTBEAT_ALERT_NOTIFICATION_UNKNOWN");
    if (n.status === "ACKNOWLEDGED") {
      need(n.consumerId === consumerId, "HEARTBEAT_ALERT_ACK_CONFLICT");
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
  status() {
    return status(
      this.journal.snapshot(),
      this.journal.head(),
      this.config.maxPending,
      this.config.source.registrations.length,
    );
  }
  static verifyJournal(
    content,
    { source, cooldownMs, maxSnapshotAgeMs, maxPending, ...options },
  ) {
    need(
      Object.keys(options).every((k) =>
        [
          "signerKeyId",
          "signerPublicKey",
          "maxActions",
          "maxBytes",
          "expectedHead",
        ].includes(k),
      ),
      "HEARTBEAT_ALERT_OPTION_UNSUPPORTED",
    );
    const config = setup({ source, cooldownMs, maxSnapshotAgeMs, maxPending });
    const v = DurableJournal.verify(content, {
      ...options,
      scope: config.scope,
      reducer: config.reducer,
      initialState: initialState(),
    });
    return {
      ...status(
        v.state,
        v.head,
        config.maxPending,
        config.source.registrations.length,
      ),
      devices: Object.values(v.state.devices),
      notifications: Object.values(v.state.notifications),
      verification: {
        journalSignaturesVerified: true,
        sourceDeviceEvidenceReverified: false,
        headPinned: v.headPinned,
        signerFingerprint: v.signerFingerprint,
        actionCount: v.actionCount,
      },
    };
  }
  close() {
    this.journal.close();
  }
}
module.exports = { HeartbeatAlerts };
