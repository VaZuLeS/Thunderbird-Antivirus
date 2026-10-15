"use strict";
const crypto = require("node:crypto");
const {
  DurableJournal,
  need,
  clone,
  exact,
  identifier,
  iso,
} = require("./durable_journal.cjs");
const { deviceRegistry, verifyEnvelope, hash } = require("./ledger.cjs");
const { compareVersions } = require("./contracts.cjs");
const uuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
function setup({
  organizationId,
  registrations,
  minimumExtensionVersion = "1.22.0",
  lateAfterMs = 600000,
  unknownAfterMs = 1200000,
  maxClockSkewMs = 120000,
}) {
  need(
    uuid(organizationId) &&
      Number.isSafeInteger(lateAfterMs) &&
      lateAfterMs > 0 &&
      Number.isSafeInteger(unknownAfterMs) &&
      unknownAfterMs > lateAfterMs &&
      unknownAfterMs <= 7 * 86400000 &&
      Number.isSafeInteger(maxClockSkewMs) &&
      maxClockSkewMs >= 0 &&
      maxClockSkewMs < lateAfterMs,
    "HEARTBEAT_CONFIG_INVALID",
  );
  compareVersions(minimumExtensionVersion, minimumExtensionVersion);
  need(
    Array.isArray(registrations) &&
      registrations.every(
        (r) =>
          exact(
            r,
            "keyId,organizationId,deviceId,streamEpoch,policyId,policyVersion,revoked,publicKey",
          ) &&
          r.organizationId === organizationId &&
          typeof r.publicKey === "string" &&
          /^-----BEGIN PUBLIC KEY-----\r?\n/.test(r.publicKey) &&
          !r.publicKey.includes("PRIVATE KEY"),
      ),
    "HEARTBEAT_REGISTRY_INVALID",
  );
  const registry = deviceRegistry(registrations),
    devices = new Set(),
    keys = new Set();
  const normalized = [...registry.values()]
    .map((r) => {
      const fingerprint = crypto
        .createHash("sha256")
        .update(r.publicKey.export({ type: "spki", format: "der" }))
        .digest("hex");
      need(
        !devices.has(r.deviceId) && !keys.has(fingerprint),
        "HEARTBEAT_REGISTRY_DUPLICATE_DEVICE_OR_KEY",
      );
      devices.add(r.deviceId);
      keys.add(fingerprint);
      return {
        ...r,
        publicKey: r.publicKey.export({ type: "spki", format: "pem" }),
      };
    })
    .sort((a, b) => (a.keyId < b.keyId ? -1 : a.keyId > b.keyId ? 1 : 0));
  const validate = (envelope) => {
    need(
      Buffer.byteLength(JSON.stringify(envelope)) <= 16384,
      "HEARTBEAT_TOO_LARGE",
    );
    const registration = registry.get(envelope?.keyId);
    need(registration && !registration.revoked, "HEARTBEAT_DEVICE_UNTRUSTED");
    const p = verifyEnvelope(envelope, registration.publicKey);
    need(
      exact(
        p,
        "schemaVersion,kind,organizationId,deviceId,streamEpoch,sequence,observedAt,extensionVersion,policyId,policyVersion,queue,brokerReady",
      ) &&
        p.schemaVersion === 1 &&
        p.kind === "thundy-device-heartbeat" &&
        p.organizationId === organizationId &&
        p.deviceId === registration.deviceId &&
        p.streamEpoch === registration.streamEpoch &&
        p.policyId === registration.policyId &&
        Number.isSafeInteger(p.sequence) &&
        p.sequence > 0 &&
        iso(p.observedAt) &&
        Number.isSafeInteger(p.policyVersion) &&
        p.policyVersion > 0 &&
        p.policyVersion <= 2147483647 &&
        typeof p.brokerReady === "boolean" &&
        exact(p.queue, "pending,retry,deadLetter,bytes") &&
        ["pending", "retry", "deadLetter"].every(
          (k) =>
            Number.isSafeInteger(p.queue[k]) &&
            p.queue[k] >= 0 &&
            p.queue[k] <= 1000000,
        ) &&
        Number.isSafeInteger(p.queue.bytes) &&
        p.queue.bytes >= 0 &&
        p.queue.bytes <= 2 ** 40,
      "HEARTBEAT_PAYLOAD_INVALID",
    );
    compareVersions(p.extensionVersion, p.extensionVersion);
    return p;
  };
  const reducer = (state, record) => {
    need(
      record.kind === "HEARTBEAT_ACCEPTED" && exact(record.data, "envelope"),
      "HEARTBEAT_ACTION_INVALID",
    );
    const p = validate(record.data.envelope),
      previous = state.latest[record.data.envelope.keyId];
    need(
      p.sequence === (previous?.envelope.payload.sequence || 0) + 1,
      "HEARTBEAT_SEQUENCE_INVALID",
    );
    need(
      !previous ||
        Date.parse(p.observedAt) >=
          Date.parse(previous.envelope.payload.observedAt),
      "HEARTBEAT_TIME_REVERSED",
    );
    need(
      Math.abs(Date.parse(record.at) - Date.parse(p.observedAt)) <=
        maxClockSkewMs,
      "HEARTBEAT_CLOCK_SKEW",
    );
    state.latest[record.data.envelope.keyId] = {
      envelope: record.data.envelope,
      receivedAt: record.at,
      index: record.index,
    };
    return state;
  };
  const scope = {
    kind: "heartbeat-v1",
    organizationId,
    registrations: normalized,
    minimumExtensionVersion,
    lateAfterMs,
    unknownAfterMs,
    maxClockSkewMs,
  };
  return {
    scope,
    registry: new Map(
      [...registry].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
    validate,
    reducer,
    minimumExtensionVersion,
    lateAfterMs,
    unknownAfterMs,
  };
}
function project(state, config, now, head) {
  need(
    Number.isSafeInteger(now) && Math.abs(now) <= 8640000000000000,
    "HEARTBEAT_TIME_INVALID",
  );
  const counts = { NEVER_SEEN: 0, CURRENT: 0, LATE: 0, UNKNOWN: 0, REVOKED: 0 };
  const devices = [...config.registry.values()].map((r) => {
    const last = state.latest[r.keyId];
    need(
      !last || now >= Date.parse(last.receivedAt),
      "HEARTBEAT_CLOCK_ROLLBACK",
    );
    const p = last?.envelope.payload,
      ageMs = last
        ? Math.max(
            now - Date.parse(last.receivedAt),
            now - Date.parse(p.observedAt),
            0,
          )
        : null;
    const status = r.revoked
      ? "REVOKED"
      : !last
        ? "NEVER_SEEN"
        : ageMs >= config.unknownAfterMs
          ? "UNKNOWN"
          : ageMs >= config.lateAfterMs
            ? "LATE"
            : "CURRENT";
    counts[status]++;
    return {
      keyId: r.keyId,
      deviceId: r.deviceId,
      streamEpoch: r.streamEpoch,
      status,
      receivedAt: last?.receivedAt || null,
      observedAt: p?.observedAt || null,
      ageMs,
      sequence: p?.sequence || null,
      extensionVersion: p?.extensionVersion || null,
      extensionState: !p
        ? "not_reported"
        : compareVersions(p.extensionVersion, config.minimumExtensionVersion) <
            0
          ? "below_minimum"
          : "meets_minimum",
      policyVersion: p?.policyVersion || null,
      expectedPolicyVersion: r.policyVersion,
      policyState: !p
        ? "not_reported"
        : p.policyVersion < r.policyVersion
          ? "behind"
          : p.policyVersion > r.policyVersion
            ? "ahead"
            : "matches",
      brokerReady: p?.brokerReady ?? null,
      queue: p ? clone(p.queue) : null,
    };
  });
  return {
    schemaVersion: 1,
    kind: "thundy-local-heartbeat-status",
    evaluatedAt: new Date(now).toISOString(),
    coverage: "explicit-test-registry-only",
    registeredDevices: devices.length,
    counts,
    devices,
    journalHead: head,
    runtimeIntegrated: false,
    productionFleetVerified: false,
    sealed: false,
  };
}
class Heartbeats {
  constructor({
    directory,
    signerKeyId,
    signerPrivateKey,
    organizationId,
    registrations,
    minimumExtensionVersion,
    lateAfterMs,
    unknownAfterMs,
    maxClockSkewMs,
    ...options
  }) {
    need(
      Object.keys(options).every((k) =>
        ["clock", "io", "maxActions", "maxBytes", "expectedHead"].includes(k),
      ),
      "HEARTBEAT_OPTION_UNSUPPORTED",
    );
    this.config = setup({
      organizationId,
      registrations,
      minimumExtensionVersion,
      lateAfterMs,
      unknownAfterMs,
      maxClockSkewMs,
    });
    this.journal = new DurableJournal({
      directory,
      signerKeyId,
      signerPrivateKey,
      ...options,
      scope: this.config.scope,
      reducer: this.config.reducer,
      initialState: { latest: {} },
    });
  }
  accept(envelope) {
    this.journal.now();
    const p = this.config.validate(envelope),
      state = this.journal.snapshot(),
      previous = state.latest[envelope.keyId];
    if (previous && p.sequence <= previous.envelope.payload.sequence) {
      const old = this.journal.records.find(
        (record) =>
          record.payload.data.envelope.keyId === envelope.keyId &&
          record.payload.data.envelope.payload.sequence === p.sequence,
      );
      need(
        old && hash(old.payload.data.envelope) === hash(envelope),
        "HEARTBEAT_SEQUENCE_CONFLICT",
      );
      return { duplicate: true, receipt: clone(old) };
    }
    const receipt = this.journal.append("HEARTBEAT_ACCEPTED", { envelope });
    return { duplicate: false, receipt };
  }
  status() {
    return project(
      this.journal.snapshot(),
      this.config,
      this.journal.now(),
      this.journal.head(),
    );
  }
  static verifyJournal(
    content,
    {
      organizationId,
      registrations,
      minimumExtensionVersion,
      lateAfterMs,
      unknownAfterMs,
      maxClockSkewMs,
      now = Date.now(),
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
      "HEARTBEAT_OPTION_UNSUPPORTED",
    );
    const config = setup({
        organizationId,
        registrations,
        minimumExtensionVersion,
        lateAfterMs,
        unknownAfterMs,
        maxClockSkewMs,
      }),
      verified = DurableJournal.verify(content, {
        ...options,
        scope: config.scope,
        reducer: config.reducer,
        initialState: { latest: {} },
      });
    return {
      ...project(verified.state, config, now, verified.head),
      verification: {
        deviceSignaturesVerified: true,
        journalSignaturesVerified: true,
        headPinned: verified.headPinned,
        signerFingerprint: verified.signerFingerprint,
        actionCount: verified.actionCount,
      },
    };
  }
  close() {
    this.journal.close();
  }
}
module.exports = { Heartbeats };
