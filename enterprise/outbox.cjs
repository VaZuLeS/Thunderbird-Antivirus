"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  signed,
  verifyEnvelope,
  hash,
  deviceRegistry,
  nextEventState,
} = require("./ledger.cjs");
const { validateEventPayload } = require("./contracts.cjs");
class OutboxError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const need = (condition, code) => {
  if (!condition) throw new OutboxError(code);
};
const clone = (value) => JSON.parse(JSON.stringify(value));
function verifyStagedReceipt(
  receipt,
  envelope,
  registration,
  serverKeyId,
  serverPublicKey,
) {
  const r = verifyEnvelope(receipt, serverPublicKey),
    event = envelope.payload;
  need(receipt.keyId === serverKeyId, "RECEIPT_KEY_UNTRUSTED");
  // SEALED needs its own evidence/anchor verifier. This stage cannot retire payloads.
  need(r.status === "STAGED", "RECEIPT_STATUS_UNSUPPORTED");
  need(
    r.schemaVersion === 1 &&
      r.organizationId === registration.organizationId &&
      r.deviceId === registration.deviceId &&
      r.streamEpoch === registration.streamEpoch &&
      r.eventId === event.eventId &&
      r.sequence === event.sequence &&
      r.payloadHash === hash(event) &&
      r.envelopeHash === hash(envelope),
    "RECEIPT_SCOPE_OR_HASH_INVALID",
  );
  need(
    Number.isSafeInteger(r.ingressIndex) &&
      r.ingressIndex > 0 &&
      typeof r.ingressId === "string" &&
      /^[0-9a-f-]{36}$/i.test(r.ingressId) &&
      typeof r.receivedAt === "string" &&
      Number.isFinite(Date.parse(r.receivedAt)),
    "RECEIPT_FORMAT_INVALID",
  );
  return clone(receipt);
}
class Outbox {
  constructor({
    directory,
    registration,
    devicePrivateKey,
    serverKeyId,
    serverPublicKey,
    clock = Date.now,
    maxEvents = 10000,
    maxBytes = 100 * 1024 * 1024,
    maxAttempts = 10,
    maxAgeMs = 7 * 86400000,
    io = fs,
  }) {
    this.registration = deviceRegistry([registration]).get(registration.keyId);
    need(!this.registration.revoked, "DEVICE_REVOKED");
    this.privateKey = crypto.createPrivateKey(devicePrivateKey);
    need(
      this.privateKey.asymmetricKeyType === "ed25519" &&
        crypto
          .createPublicKey(this.privateKey)
          .export({ format: "der", type: "spki" })
          .equals(
            this.registration.publicKey.export({ format: "der", type: "spki" }),
          ),
      "DEVICE_KEY_MISMATCH",
    );
    this.serverPublicKey = crypto.createPublicKey(serverPublicKey);
    this.serverKeyId = serverKeyId;
    need(
      this.serverPublicKey.asymmetricKeyType === "ed25519" &&
        typeof serverKeyId === "string" &&
        /^[A-Za-z0-9_-]{1,80}$/.test(serverKeyId),
      "SERVER_KEY_INVALID",
    );
    need(
      Number.isSafeInteger(maxEvents) &&
        maxEvents > 0 &&
        maxEvents <= 100000 &&
        Number.isSafeInteger(maxBytes) &&
        maxBytes > 0 &&
        maxBytes <= 256 * 1024 * 1024 &&
        Number.isSafeInteger(maxAttempts) &&
        maxAttempts > 0 &&
        maxAttempts <= 100 &&
        Number.isSafeInteger(maxAgeMs) &&
        maxAgeMs > 0,
      "OUTBOX_LIMIT_INVALID",
    );
    Object.assign(this, {
      clock,
      maxEvents,
      maxBytes,
      maxAttempts,
      maxAgeMs,
      io,
    });
    this.items = new Map();
    this.streams = new Map();
    this.interactions = new Map();
    this.index = 0;
    this.previousHash = null;
    this.closed = false;
    this.poisoned = false;
    this.busy = false;
    this.directory = path.resolve(directory);
    fs.mkdirSync(this.directory, { mode: 0o700, recursive: true });
    const stat = fs.lstatSync(this.directory);
    need(
      process.platform !== "win32" &&
        stat.isDirectory() &&
        !stat.isSymbolicLink() &&
        stat.uid === process.getuid() &&
        (stat.mode & 0o077) === 0,
      "PRIVATE_DIRECTORY_REQUIRED",
    );
    this.lockPath = path.join(this.directory, "outbox.lock");
    this.logPath = path.join(this.directory, "outbox.jsonl");
    try {
      this.lockFd = fs.openSync(this.lockPath, "wx", 0o600);
    } catch {
      throw new OutboxError("OUTBOX_LOCKED");
    }
    try {
      fs.writeSync(this.lockFd, JSON.stringify({ pid: process.pid }) + "\n");
      fs.fsyncSync(this.lockFd);
      if (fs.existsSync(this.logPath)) {
        const entry = fs.lstatSync(this.logPath);
        need(entry.isFile() && !entry.isSymbolicLink(), "OUTBOX_LOG_INVALID");
      }
      this.fd = fs.openSync(this.logPath, "a+", 0o600);
      const entry = fs.fstatSync(this.fd);
      need(
        entry.uid === process.getuid() && (entry.mode & 0o077) === 0,
        "PRIVATE_LOG_REQUIRED",
      );
      need(entry.size <= this.maxBytes, "OUTBOX_CAPACITY");
      const content = fs.readFileSync(this.fd, "utf8");
      this.bytes = Buffer.byteLength(content);
      need(!content || content.endsWith("\n"), "OUTBOX_LOG_INCOMPLETE");
      for (const line of content.split("\n").filter(Boolean)) {
        const record = JSON.parse(line),
          action = verifyEnvelope(record, this.registration.publicKey);
        need(
          record.keyId === this.registration.keyId &&
            action.index === this.index + 1 &&
            action.previousHash === this.previousHash,
          "OUTBOX_CHAIN_INVALID",
        );
        this.apply(action);
        this.index = action.index;
        this.previousHash = hash(record);
      }
      this.io.fsyncSync(this.fd);
      for (const directory of [this.directory, path.dirname(this.directory)]) {
        const fd = fs.openSync(directory, "r");
        try {
          this.io.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
      }
    } catch (error) {
      this.close();
      throw error;
    }
  }
  ensure() {
    need(!this.closed && !this.poisoned, "OUTBOX_UNAVAILABLE");
  }
  apply(action, dryRun = false) {
    need(
      action &&
        typeof action.at === "string" &&
        Number.isFinite(Date.parse(action.at)),
      "OUTBOX_ACTION_INVALID",
    );
    if (action.kind === "QUEUED") {
      need(
        Object.keys(action).sort().join(",") ===
          "at,envelope,index,kind,previousHash",
        "OUTBOX_ACTION_INVALID",
      );
      const event = validateEventPayload(
        action.envelope.payload,
        this.registration,
      );
      verifyEnvelope(action.envelope, this.registration.publicKey);
      need(
        action.envelope.keyId === this.registration.keyId &&
          event.policyVersion === this.registration.policyVersion &&
          !this.items.has(event.eventId) &&
          this.items.size < this.maxEvents &&
          Buffer.byteLength(JSON.stringify(action.envelope)) <= 32768,
        "OUTBOX_EVENT_INVALID",
      );
      const next = nextEventState(
        event,
        this.registration,
        this.streams,
        this.interactions,
      );
      if (dryRun) return;
      this.streams.set(next.stream, event.sequence);
      this.interactions.set(next.key, next.state);
      this.items.set(event.eventId, {
        envelope: clone(action.envelope),
        queuedAt: action.at,
        status: "PENDING",
        attempts: 0,
        totalAttempts: 0,
        nextAttemptAt: 0,
        error: null,
        receipt: null,
      });
      return;
    }
    need(
      Object.keys(action).sort().join(",") ===
        "at,error,eventId,index,kind,nextAttemptAt,previousHash,receipt",
      "OUTBOX_ACTION_INVALID",
    );
    const source = this.items.get(action.eventId),
      item = source ? clone(source) : null;
    need(
      item &&
        (item.status !== "DEAD_LETTER" || action.kind === "RETRY_RESET") &&
        Number.isFinite(action.nextAttemptAt) &&
        action.nextAttemptAt >= 0 &&
        (action.error === null ||
          (typeof action.error === "string" &&
            /^[A-Z][A-Z0-9_]{0,79}$/.test(action.error))),
      "OUTBOX_STATE_INVALID",
    );
    if (action.kind === "ATTEMPT") {
      need(
        ["PENDING", "RETRY"].includes(item.status) &&
          item.attempts < this.maxAttempts &&
          action.receipt === null,
        "OUTBOX_ATTEMPT_INVALID",
      );
      item.attempts++;
      item.totalAttempts++;
      item.status = "RETRY";
    } else if (action.kind === "RETRY_RESET") {
      need(
        item.status === "DEAD_LETTER" &&
          item.error === "RETRY_LIMIT_REACHED" &&
          Date.parse(action.at) - Date.parse(item.queuedAt) <= this.maxAgeMs &&
          action.error === "OPERATOR_RETRY" &&
          action.receipt === null &&
          action.nextAttemptAt === 0,
        "OUTBOX_RETRY_RESET_DENIED",
      );
      item.attempts = 0;
      item.status = "RETRY";
    } else if (action.kind === "RETRY") {
      need(
        item.status === "RETRY" && action.receipt === null,
        "OUTBOX_RETRY_INVALID",
      );
    } else if (action.kind === "STAGED") {
      need(
        ["RETRY", "STAGED"].includes(item.status) && action.error === null,
        "OUTBOX_RECEIPT_STATE_INVALID",
      );
      item.receipt = verifyStagedReceipt(
        action.receipt,
        item.envelope,
        this.registration,
        this.serverKeyId,
        this.serverPublicKey,
      );
      item.status = "STAGED";
    } else if (action.kind === "DEAD_LETTER") {
      need(
        ["PENDING", "RETRY"].includes(item.status) &&
          action.receipt === null &&
          action.error !== null,
        "OUTBOX_DEAD_LETTER_INVALID",
      );
      item.status = "DEAD_LETTER";
    } else throw new OutboxError("OUTBOX_ACTION_INVALID");
    item.nextAttemptAt = action.nextAttemptAt;
    item.error = action.error;
    if (!dryRun) this.items.set(action.eventId, item);
  }
  append(change) {
    this.ensure();
    const now = this.clock();
    need(Number.isFinite(now), "OUTBOX_TIME_INVALID");
    const action = {
        ...change,
        index: this.index + 1,
        previousHash: this.previousHash,
        at: new Date(now).toISOString(),
      },
      record = signed(action, this.registration.keyId, this.privateKey),
      line = Buffer.from(JSON.stringify(record) + "\n");
    need(this.bytes + line.length <= this.maxBytes, "OUTBOX_CAPACITY");
    this.apply(action, true);
    try {
      let offset = 0;
      while (offset < line.length) {
        const count = this.io.writeSync(
          this.fd,
          line,
          offset,
          line.length - offset,
        );
        if (count <= 0) throw new Error("SHORT_WRITE");
        offset += count;
      }
      this.io.fsyncSync(this.fd);
    } catch {
      this.poisoned = true;
      throw new OutboxError("OUTBOX_STORAGE_FAILED");
    }
    // All callers validate before append. A replay/apply failure must freeze the writer too.
    try {
      this.apply(action);
    } catch (error) {
      this.poisoned = true;
      throw error;
    }
    this.index = action.index;
    this.previousHash = hash(record);
    this.bytes += line.length;
  }
  enqueue(input) {
    this.ensure();
    need(
      input &&
        typeof input === "object" &&
        !Array.isArray(input) &&
        !Object.hasOwn(input, "sequence"),
      "BROKER_SEQUENCE_REQUIRED",
    );
    const r = this.registration,
      base = {
        ...input,
        schemaVersion: input.schemaVersion ?? 2,
        eventId: input.eventId ?? crypto.randomUUID(),
        deviceId: input.deviceId ?? r.deviceId,
        streamEpoch: input.streamEpoch ?? r.streamEpoch,
        policyId: input.policyId ?? r.policyId,
        policyVersion: input.policyVersion ?? r.policyVersion,
      };
    const existing = this.items.get(base.eventId);
    if (existing) {
      const original = { ...existing.envelope.payload };
      delete original.sequence;
      need(hash(original) === hash(base), "OUTBOX_EVENT_ID_CONFLICT");
      return clone(existing.envelope);
    }
    need(this.items.size < this.maxEvents, "OUTBOX_CAPACITY");
    const stream = r.organizationId + ":" + r.deviceId + ":" + r.streamEpoch;
    const event = validateEventPayload(
      { ...base, sequence: (this.streams.get(stream) || 0) + 1 },
      r,
    );
    need(event.policyVersion === r.policyVersion, "POLICY_VERSION_MISMATCH");
    nextEventState(event, r, this.streams, this.interactions);
    const envelope = signed(event, r.keyId, this.privateKey);
    need(
      Buffer.byteLength(JSON.stringify(envelope)) <= 32768,
      "EVENT_TOO_LARGE",
    );
    this.append({ kind: "QUEUED", envelope });
    return clone(envelope);
  }
  retry(eventId) {
    this.state(eventId, "RETRY_RESET", { error: "OPERATOR_RETRY" });
    return this.status();
  }
  state(
    eventId,
    kind,
    { error = null, nextAttemptAt = 0, receipt = null } = {},
  ) {
    this.append({ kind, eventId, error, nextAttemptAt, receipt });
  }
  batch(now = this.clock()) {
    this.ensure();
    const events = [];
    for (const [eventId, item] of this.items) {
      if (item.status === "STAGED") continue;
      if (item.status === "DEAD_LETTER") break;
      if (now - Date.parse(item.queuedAt) > this.maxAgeMs) {
        this.state(eventId, "DEAD_LETTER", { error: "OUTBOX_EVENT_EXPIRED" });
        break;
      }
      if (item.attempts >= this.maxAttempts) {
        this.state(eventId, "DEAD_LETTER", { error: "RETRY_LIMIT_REACHED" });
        break;
      }
      if (item.nextAttemptAt > now) break;
      const next = [...events, item.envelope];
      if (
        next.length > 100 ||
        Buffer.byteLength(JSON.stringify({ events: next })) > 256 * 1024
      )
        break;
      events.push(clone(item.envelope));
    }
    return events;
  }
  staged(limit = 100) {
    this.ensure();
    const now = this.clock();
    return [...this.items.values()]
      .filter((item) => item.status === "STAGED" && item.nextAttemptAt <= now)
      .slice(0, limit)
      .map(clone);
  }
  status() {
    this.ensure();
    const counts = { PENDING: 0, RETRY: 0, STAGED: 0, DEAD_LETTER: 0 };
    let oldest = null;
    const errors = [];
    for (const [eventId, item] of this.items) {
      counts[item.status]++;
      const time = Date.parse(item.queuedAt);
      oldest = oldest === null ? time : Math.min(oldest, time);
      if (item.error)
        errors.push({
          eventId,
          sequence: item.envelope.payload.sequence,
          status: item.status,
          attempts: item.attempts,
          totalAttempts: item.totalAttempts,
          error: item.error,
          nextAttemptAt: item.nextAttemptAt,
        });
    }
    const ratio = Math.max(
      this.items.size / this.maxEvents,
      this.bytes / this.maxBytes,
    );
    return {
      mode: "local-development",
      retirementSupported: false,
      counts,
      retainedEvents: this.items.size,
      bytes: this.bytes,
      maxEvents: this.maxEvents,
      maxBytes: this.maxBytes,
      capacityWarning: ratio >= 0.8,
      capacityFull: ratio >= 1,
      oldestQueuedAt: oldest === null ? null : new Date(oldest).toISOString(),
      deliveryBlocked: counts.DEAD_LETTER > 0,
      errors,
    };
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.fd !== undefined) fs.closeSync(this.fd);
    if (this.lockFd !== undefined) {
      fs.closeSync(this.lockFd);
      fs.unlinkSync(this.lockPath);
    }
  }
}
module.exports = { Outbox, OutboxError, verifyStagedReceipt };
