"use strict";
const crypto = require("node:crypto");
const {
    DurableJournal,
    need,
    exact,
    identifier,
    hex,
    clone,
  } = require("./durable_journal.cjs"),
  { hash } = require("./ledger.cjs"),
  { publicContext } = require("./review_package.cjs"),
  {
    capacityFromJournals,
    capacityFromPackage,
    project,
  } = require("./capacity.cjs");
const digest = (v) => crypto.createHash("sha256").update(v).digest("hex");
const initialState = () => ({
  lastObservation: null,
  metrics: {},
  notifications: {},
});
function setup({
  trustedContext,
  warningPercent = 80,
  recoveryPercent = 70,
  cooldownMs = 900000,
  maxPending = 1000,
  ...extra
}) {
  need(
    Object.keys(extra).length === 0 &&
      Number.isSafeInteger(warningPercent) &&
      warningPercent > 0 &&
      warningPercent < 100 &&
      Number.isSafeInteger(recoveryPercent) &&
      recoveryPercent >= 0 &&
      recoveryPercent < warningPercent &&
      Number.isSafeInteger(cooldownMs) &&
      cooldownMs > 0 &&
      cooldownMs <= 86400000 &&
      Number.isSafeInteger(maxPending) &&
      maxPending > 0 &&
      maxPending <= 10000,
    "CAPACITY_ALERT_CONFIG_INVALID",
  );
  const context = publicContext(trustedContext),
    scope = {
      kind: "capacity-alerts-v1",
      ruleVersion: 1,
      trustedContext: context,
      warningPercent,
      recoveryPercent,
      cooldownMs,
      maxPending,
    },
    scopeHash = hash(scope);
  const reducer = (state, p) => {
    if (p.kind === "NOTIFICATION_ACKNOWLEDGED") {
      need(
        exact(p.data, "notificationId,consumerId") &&
          hex(p.data.notificationId) &&
          identifier(p.data.consumerId),
        "CAPACITY_ALERT_ACK_INVALID",
      );
      const n = state.notifications[p.data.notificationId];
      need(n && n.status === "PENDING", "CAPACITY_ALERT_ACK_INVALID");
      Object.assign(n, {
        status: "ACKNOWLEDGED",
        acknowledgedAt: p.at,
        consumerId: p.data.consumerId,
      });
      return state;
    }
    need(
      p.kind === "CAPACITY_OBSERVED" &&
        exact(p.data, "report,inputHashes") &&
        exact(p.data.inputHashes, "alarm,source") &&
        Object.values(p.data.inputHashes).every(hex),
      "CAPACITY_ALERT_OBSERVATION_INVALID",
    );
    const o = p.data,
      report = project(o.report),
      previous = state.lastObservation;
    need(
      hash(report) === hash(o.report) &&
        report.warningPercent === warningPercent &&
        Date.parse(report.capturedAt) <= Date.parse(p.at) &&
        Date.parse(p.at) - Date.parse(report.capturedAt) <= 300000 &&
        report.metrics[4].limit === context.maxPending,
      "CAPACITY_ALERT_OBSERVATION_INVALID",
    );
    need(
      !previous ||
        Date.parse(report.capturedAt) > Date.parse(previous.report.capturedAt),
      "CAPACITY_ALERT_EVALUATION_REPLAY",
    );
    if (previous) {
      for (const [i, key] of [
        [0, "alarm"],
        [2, "source"],
      ]) {
        const old = previous.report.metrics[i].used,
          used = report.metrics[i].used;
        need(
          used >= old &&
            (used !== old ||
              (o.inputHashes[key] === previous.inputHashes[key] &&
                report.references[key + "Head"] ===
                  previous.report.references[key + "Head"])),
          "CAPACITY_ALERT_SOURCE_ROLLBACK",
        );
      }
      for (const i of [1, 3, 5, 6])
        need(
          report.metrics[i].used >= previous.report.metrics[i].used,
          "CAPACITY_ALERT_SOURCE_ROLLBACK",
        );
    }
    for (const m of report.metrics) {
      // Missing package measurements neither recover nor repeat an existing alert.
      if (m.used === null) continue;
      const old = state.metrics[m.id];
      const active = old?.active === true;
      const recovered = active && m.used * 100 <= m.limit * recoveryPercent;
      const level = m.state === "reached" ? "reached" : "warning";
      const emit =
        recovered ||
        (!active && ["warning", "reached"].includes(m.state)) ||
        (active &&
          ((level === "reached" && old.level !== "reached") ||
            Date.parse(p.at) - Date.parse(old.lastEmittedAt) >= cooldownMs));
      if (emit) {
        const notificationId = hash({
          scopeHash,
          observationIndex: p.index,
          previousHash: p.previousHash,
          observationHash: hash(o),
          metricId: m.id,
        });
        state.notifications[notificationId] = {
          notificationId,
          metric: clone(m),
          transition: recovered
            ? "RECOVERED"
            : active
              ? level === "reached" && old.level !== "reached"
                ? "ESCALATED"
                : "REMINDER"
              : "RAISED",
          capturedAt: report.capturedAt,
          generatedAt: p.at,
          observationIndex: p.index,
          references: clone(report.references),
          pins: clone(report.pins),
          inputHashes: clone(o.inputHashes),
          suppressedObservations: active ? old.suppressed : 0,
          status: "PENDING",
          acknowledgedAt: null,
          consumerId: null,
        };
      }
      state.metrics[m.id] = {
        active: recovered
          ? false
          : active || ["warning", "reached"].includes(m.state),
        level: active && !emit ? old.level : level,
        lastEmittedAt: emit ? p.at : (old?.lastEmittedAt ?? null),
        suppressed: !emit && active ? old.suppressed + 1 : 0,
        lastMeasuredAt: report.capturedAt,
        metric: clone(m),
      };
    }
    need(
      Object.values(state.notifications).filter((n) => n.status === "PENDING")
        .length <= maxPending,
      "CAPACITY_ALERT_NOTIFICATION_CAPACITY",
    );
    state.lastObservation = clone(o);
    return state;
  };
  return { context, scope, reducer, maxPending };
}
function status(state, head, maxPending) {
  const ns = Object.values(state.notifications);
  return {
    schemaVersion: 1,
    kind: "thundy-capacity-alert-status",
    pending: ns.filter((n) => n.status === "PENDING").length,
    acknowledged: ns.filter((n) => n.status === "ACKNOWLEDGED").length,
    maxPending,
    journalHead: head,
    lastObservation: state.lastObservation,
    metrics: Object.values(state.metrics),
    originalEvidenceReverified: false,
    externalDeliveryVerified: false,
    sealed: false,
  };
}
class CapacityAlerts {
  constructor({
    directory,
    signerKeyId,
    signerPrivateKey,
    trustedContext,
    warningPercent,
    recoveryPercent,
    cooldownMs,
    maxPending,
    ...options
  }) {
    need(
      Object.keys(options).every((k) =>
        ["clock", "io", "maxActions", "maxBytes", "expectedHead"].includes(k),
      ),
      "CAPACITY_ALERT_OPTION_UNSUPPORTED",
    );
    this.config = setup({
      trustedContext,
      warningPercent,
      recoveryPercent,
      cooldownMs,
      maxPending,
    });
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
  observeJournals(alarm, source, options = {}) {
    need(
      Object.keys(options).every((k) =>
        ["expectedHead", "expectedSourceHead"].includes(k),
      ),
      "CAPACITY_ALERT_OPTION_UNSUPPORTED",
    );
    const report = capacityFromJournals(alarm, source, {
      ...options,
      trustedContext: this.config.context,
      warningPercent: this.config.scope.warningPercent,
      now: this.journal.now(),
    });
    return this.#record(report, alarm, source);
  }
  observePackage(content, options = {}) {
    need(
      Object.keys(options).every((k) =>
        ["expectedHead", "expectedSourceHead", "expectedPackageHash"].includes(
          k,
        ),
      ),
      "CAPACITY_ALERT_OPTION_UNSUPPORTED",
    );
    // N17 validates the whole canonical package before its original bytes are used.
    const report = capacityFromPackage(content, {
      ...options,
      trustedContext: this.config.context,
      warningPercent: this.config.scope.warningPercent,
      now: this.journal.now(),
    });
    const p = JSON.parse(content.toString());
    return this.#record(
      report,
      Buffer.from(p.files[0].data, "base64"),
      Buffer.from(p.files[1].data, "base64"),
    );
  }
  #record(report, alarm, source) {
    const observation = {
        report,
        inputHashes: { alarm: digest(alarm), source: digest(source) },
      },
      last = this.journal.snapshot().lastObservation;
    if (last) {
      for (const [input, key, i] of [
        [alarm, "alarm", 0],
        [source, "source", 2],
      ]) {
        const b = Buffer.from(input),
          length = last.report.metrics[i].used;
        need(
          b.length >= length &&
            digest(b.subarray(0, length)) === last.inputHashes[key],
          "CAPACITY_ALERT_SOURCE_ROLLBACK",
        );
      }
      if (last.report.capturedAt === report.capturedAt) {
        need(
          hash(last) === hash(observation),
          "CAPACITY_ALERT_SNAPSHOT_CONFLICT",
        );
        return {
          ...this.status(),
          duplicate: true,
          notifications: [],
          originalEvidenceReverified: true,
        };
      }
    }
    const r = this.journal.append("CAPACITY_OBSERVED", observation);
    return {
      ...this.status(),
      duplicate: false,
      notifications: Object.values(
        this.journal.snapshot().notifications,
      ).filter((n) => n.observationIndex === r.payload.index),
      originalEvidenceReverified: true,
    };
  }
  pending({ limit = 100 } = {}) {
    need(
      Number.isSafeInteger(limit) && limit > 0 && limit <= 1000,
      "CAPACITY_ALERT_LIMIT_INVALID",
    );
    return Object.values(this.journal.snapshot().notifications)
      .filter((n) => n.status === "PENDING")
      .slice(0, limit);
  }
  acknowledge(notificationId, { consumerId } = {}) {
    need(
      hex(notificationId) && identifier(consumerId),
      "CAPACITY_ALERT_ACK_INVALID",
    );
    const n = this.journal.snapshot().notifications[notificationId];
    need(n, "CAPACITY_ALERT_NOTIFICATION_UNKNOWN");
    if (n.status === "ACKNOWLEDGED") {
      need(n.consumerId === consumerId, "CAPACITY_ALERT_ACK_CONFLICT");
      return { duplicate: true, notification: n };
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
    );
  }
  static verifyJournal(
    content,
    {
      trustedContext,
      warningPercent,
      recoveryPercent,
      cooldownMs,
      maxPending,
      ...options
    },
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
      "CAPACITY_ALERT_OPTION_UNSUPPORTED",
    );
    const c = setup({
        trustedContext,
        warningPercent,
        recoveryPercent,
        cooldownMs,
        maxPending,
      }),
      v = DurableJournal.verify(content, {
        ...options,
        scope: c.scope,
        reducer: c.reducer,
        initialState: initialState(),
      });
    return {
      ...status(v.state, v.head, c.maxPending),
      notifications: Object.values(v.state.notifications),
      verification: {
        journalSignaturesVerified: true,
        headPinned: v.headPinned,
        signerFingerprint: v.signerFingerprint,
        actionCount: v.actionCount,
        originalEvidenceReverified: false,
      },
    };
  }
  close() {
    this.journal.close();
  }
}
module.exports = { CapacityAlerts };
