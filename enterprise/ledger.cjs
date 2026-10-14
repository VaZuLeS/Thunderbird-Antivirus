"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const canonicalize = require("canonicalize");
const { validateEventPayload } = require("./contracts.cjs");
class LedgerError extends Error {
  constructor(code, status = 422) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
const requireThat = (condition, code, status) => {
  if (!condition) throw new LedgerError(code, status);
};
const hash = (value) =>
  crypto.createHash("sha256").update(canonicalize(value)).digest("hex");
function signed(payload, keyId, privateKey) {
  return {
    keyId,
    payload,
    signature: crypto
      .sign(null, Buffer.from(canonicalize({ keyId, payload })), privateKey)
      .toString("base64url"),
  };
}
function verifyEnvelope(envelope, publicKey) {
  requireThat(
    envelope &&
      typeof envelope === "object" &&
      !Array.isArray(envelope) &&
      Object.keys(envelope).sort().join(",") === "keyId,payload,signature",
    "ENVELOPE_INVALID",
    401,
  );
  requireThat(
    typeof envelope.keyId === "string" &&
      /^[A-Za-z0-9_-]{1,80}$/.test(envelope.keyId) &&
      typeof envelope.signature === "string" &&
      /^[A-Za-z0-9_-]{86}$/.test(envelope.signature),
    "SIGNATURE_INVALID",
    401,
  );
  const signature = Buffer.from(envelope.signature, "base64url");
  requireThat(
    signature.toString("base64url") === envelope.signature &&
      publicKey?.type === "public" &&
      publicKey.asymmetricKeyType === "ed25519" &&
      crypto.verify(
        null,
        Buffer.from(
          canonicalize({ keyId: envelope.keyId, payload: envelope.payload }),
        ),
        publicKey,
        signature,
      ),
    "SIGNATURE_INVALID",
    401,
  );
  return envelope.payload;
}
const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
function deviceRegistry(input) {
  requireThat(
    Array.isArray(input) && input.length > 0 && input.length <= 1000,
    "REGISTRY_INVALID",
  );
  const output = new Map(),
    identities = new Set();
  for (const registration of input) {
    requireThat(
      registration &&
        typeof registration.keyId === "string" &&
        /^[A-Za-z0-9_-]{1,80}$/.test(registration.keyId) &&
        !output.has(registration.keyId),
      "REGISTRY_INVALID",
    );
    requireThat(
      ["organizationId", "deviceId", "streamEpoch", "policyId"].every((key) =>
        uuid(registration[key]),
      ) &&
        Number.isSafeInteger(registration.policyVersion) &&
        registration.policyVersion > 0 &&
        typeof registration.revoked === "boolean",
      "REGISTRY_INVALID",
    );
    const identity =
      registration.organizationId +
      ":" +
      registration.deviceId +
      ":" +
      registration.streamEpoch;
    requireThat(!identities.has(identity), "REGISTRY_DUPLICATE_STREAM");
    identities.add(identity);
    let publicKey;
    try {
      publicKey = crypto.createPublicKey(registration.publicKey);
    } catch {
      throw new LedgerError("REGISTRY_KEY_INVALID");
    }
    requireThat(
      publicKey.asymmetricKeyType === "ed25519",
      "REGISTRY_KEY_INVALID",
    );
    output.set(
      registration.keyId,
      Object.freeze({ ...registration, publicKey }),
    );
  }
  return output;
}

function nextEventState(event, device, streams, interactions) {
  const stream =
    device.organizationId + ":" + event.deviceId + ":" + event.streamEpoch;
  requireThat(
    event.sequence === (streams.get(stream) || 0) + 1,
    "SEQUENCE_GAP_OR_REPLAY",
    409,
  );
  const key = stream + ":" + event.interactionId,
    previous = interactions.get(key);
  if (!previous) {
    requireThat(
      event.kind === "CLICKED" && event.attemptNumber === 0,
      "INTERACTION_CLICK_REQUIRED",
      409,
    );
    return {
      stream,
      key,
      state: {
        url: event.urlRedacted,
        attempt: 0,
        status: "PENDING",
        lastKind: "CLICKED",
        observedAt: event.observedAt,
        policyId: event.policyId,
        policyVersion: event.policyVersion,
      },
    };
  }
  requireThat(
    event.urlRedacted === previous.url &&
      event.policyId === previous.policyId &&
      event.policyVersion === previous.policyVersion,
    "INTERACTION_CONTEXT_CHANGED",
    409,
  );
  requireThat(
    Date.parse(event.observedAt) >= Date.parse(previous.observedAt),
    "INTERACTION_TIME_REVERSED",
    409,
  );
  const state = {
    ...previous,
    lastKind: event.kind,
    observedAt: event.observedAt,
  };
  if (event.kind === "OPEN_INTENT") {
    requireThat(
      ["PENDING", "OPEN_ERROR"].includes(previous.status) &&
        previous.lastKind !== "OPEN_INTENT" &&
        event.attemptNumber === previous.attempt + 1,
      "OPEN_INTENT_INVALID",
      409,
    );
    state.attempt = event.attemptNumber;
    state.status = "OPEN_INTENT";
  } else if (event.kind === "DECISION") {
    requireThat(
      ["PENDING", "OPEN_INTENT", "OPEN_ERROR"].includes(previous.status) &&
        event.attemptNumber === previous.attempt,
      "DECISION_INVALID",
      409,
    );
    if (["OPENED", "OPEN_ERROR"].includes(event.outcome))
      requireThat(
        previous.status === "OPEN_INTENT",
        "OPEN_INTENT_REQUIRED",
        409,
      );
    state.status = event.outcome;
  } else {
    requireThat(
      ["ASSESSMENT", "ASSESSMENT_UPDATED"].includes(event.kind) &&
        event.attemptNumber === previous.attempt,
      "ASSESSMENT_INVALID",
      409,
    );
    if (["OPENED", "ABORTED", "BLOCKED"].includes(previous.status))
      requireThat(
        event.kind === "ASSESSMENT_UPDATED",
        "TERMINAL_INTERACTION",
        409,
      );
  }
  return { stream, key, state };
}

class Ledger {
  constructor({
    directory,
    registrations,
    serverKeyId,
    serverPrivateKey,
    clock = Date.now,
    maxEvents = 10000,
    maxBytes = 16 * 1024 * 1024,
    io = fs,
  }) {
    this.registry = deviceRegistry(registrations);
    this.io = io;
    this.clock = clock;
    this.maxEvents = maxEvents;
    this.maxBytes = maxBytes;
    requireThat(
      Number.isSafeInteger(maxEvents) &&
        maxEvents > 0 &&
        maxEvents <= 100000 &&
        Number.isSafeInteger(maxBytes) &&
        maxBytes > 0 &&
        maxBytes <= 256 * 1024 * 1024,
      "LIMIT_INVALID",
    );
    requireThat(
      typeof serverKeyId === "string" &&
        /^[A-Za-z0-9_-]{1,80}$/.test(serverKeyId),
      "SERVER_KEY_INVALID",
    );
    this.serverKeyId = serverKeyId;
    this.privateKey = crypto.createPrivateKey(serverPrivateKey);
    this.publicKey = crypto.createPublicKey(this.privateKey);
    requireThat(
      this.privateKey.asymmetricKeyType === "ed25519",
      "SERVER_KEY_INVALID",
    );
    this.records = [];
    this.events = new Map();
    this.streams = new Map();
    this.interactions = new Map();
    this.nonces = new Map();
    this.closed = false;
    this.poisoned = false;
    const directoryPath = path.resolve(directory);
    fs.mkdirSync(directoryPath, { recursive: true, mode: 0o700 });
    const directoryStat = fs.lstatSync(directoryPath);
    requireThat(
      directoryStat.isDirectory() && !directoryStat.isSymbolicLink(),
      "DIRECTORY_INVALID",
    );
    requireThat(
      process.platform !== "win32" &&
        (directoryStat.mode & 0o077) === 0 &&
        directoryStat.uid === process.getuid(),
      "PRIVATE_DIRECTORY_REQUIRED",
      503,
    );
    this.lockPath = path.join(directoryPath, "writer.lock");
    this.journalPath = path.join(directoryPath, "events.jsonl");
    try {
      this.lockFd = fs.openSync(this.lockPath, "wx", 0o600);
    } catch {
      throw new LedgerError("WRITER_LOCKED", 503);
    }
    try {
      fs.writeSync(
        this.lockFd,
        JSON.stringify({
          pid: process.pid,
          createdAt: new Date().toISOString(),
        }) + "\n",
      );
      fs.fsyncSync(this.lockFd);
      // Refuse symlink journals; data-dir and parent directories must be operator-owned.
      if (fs.existsSync(this.journalPath))
        requireThat(
          fs.lstatSync(this.journalPath).isFile() &&
            !fs.lstatSync(this.journalPath).isSymbolicLink(),
          "JOURNAL_INVALID",
        );
      this.fd = fs.openSync(this.journalPath, "a+", 0o600);
      const stat = fs.fstatSync(this.fd);
      requireThat(
        (stat.mode & 0o077) === 0 && stat.uid === process.getuid(),
        "PRIVATE_JOURNAL_REQUIRED",
        503,
      );
      requireThat(stat.size <= maxBytes, "JOURNAL_CAPACITY", 503);
      const content = fs.readFileSync(this.fd, "utf8");
      this.bytes = Buffer.byteLength(content);
      requireThat(
        !content || content.endsWith("\n"),
        "JOURNAL_INCOMPLETE",
        503,
      );
      for (const line of content.split("\n").filter(Boolean))
        this.replay(JSON.parse(line));
      // Sync file and directory creation before any durable receipt can be returned.
      this.io.fsyncSync(this.fd);
      this.syncDirectory(directoryPath);
      this.syncDirectory(path.dirname(directoryPath));
    } catch (error) {
      this.close();
      throw error instanceof LedgerError
        ? error
        : new LedgerError("JOURNAL_INVALID", 503);
    }
  }
  syncDirectory(directory) {
    // Windows directory fsync is unavailable; this development server supports POSIX only.
    requireThat(process.platform !== "win32", "POSIX_STORAGE_REQUIRED", 503);
    const fd = fs.openSync(directory, "r");
    try {
      this.io.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }
  authenticate(envelope, { historical = false } = {}) {
    const device = this.registry.get(envelope?.keyId);
    requireThat(
      device && (historical || !device.revoked),
      "DEVICE_UNTRUSTED",
      401,
    );
    verifyEnvelope(envelope, device.publicKey);
    return device;
  }
  checkEvent(envelope, device) {
    requireThat(
      Buffer.byteLength(JSON.stringify(envelope)) <= 32768,
      "EVENT_TOO_LARGE",
      413,
    );
    const event = validateEventPayload(envelope.payload, device);
    requireThat(
      event.policyVersion === device.policyVersion,
      "POLICY_VERSION_MISMATCH",
      409,
    );
    return event;
  }
  nextState(event, device) {
    return nextEventState(event, device, this.streams, this.interactions);
  }
  replay(record) {
    requireThat(this.records.length < this.maxEvents, "JOURNAL_CAPACITY", 503);
    requireThat(
      record &&
        Object.keys(record).sort().join(",") === "eventEnvelope,receipt",
      "JOURNAL_INVALID",
      503,
    );
    const device = this.authenticate(record.eventEnvelope, {
        historical: true,
      }),
      event = this.checkEvent(record.eventEnvelope, device);
    requireThat(!this.events.has(event.eventId), "JOURNAL_DUPLICATE", 503);
    const state = this.nextState(event, device),
      payload = verifyEnvelope(record.receipt, this.publicKey);
    const previous = this.records.at(-1)?.receipt;
    requireThat(
      record.receipt.keyId === this.serverKeyId &&
        payload.schemaVersion === 1 &&
        payload.status === "STAGED" &&
        payload.organizationId === device.organizationId &&
        payload.deviceId === event.deviceId &&
        payload.streamEpoch === event.streamEpoch &&
        payload.eventId === event.eventId &&
        payload.sequence === event.sequence &&
        payload.payloadHash === hash(event) &&
        payload.envelopeHash === hash(record.eventEnvelope) &&
        payload.ingressIndex === this.records.length + 1 &&
        payload.previousReceiptHash === (previous ? hash(previous) : null) &&
        uuid(payload.ingressId) &&
        Number.isFinite(Date.parse(payload.receivedAt)),
      "JOURNAL_RECEIPT_INVALID",
      503,
    );
    this.commit(record, state);
  }
  commit(record, next) {
    // Copy internal records; callers cannot mutate signatures or the journal projection.
    const stored = JSON.parse(JSON.stringify(record));
    this.records.push(stored);
    this.events.set(stored.eventEnvelope.payload.eventId, stored);
    this.streams.set(next.stream, stored.eventEnvelope.payload.sequence);
    this.interactions.set(next.key, next.state);
  }
  accept(envelope) {
    requireThat(!this.closed && !this.poisoned, "STORAGE_UNAVAILABLE", 503);
    const device = this.authenticate(envelope),
      event = this.checkEvent(envelope, device),
      existing = this.events.get(event.eventId);
    if (existing) {
      requireThat(
        existing.receipt.payload.organizationId === device.organizationId &&
          existing.receipt.payload.deviceId === event.deviceId &&
          hash(existing.eventEnvelope.payload) === hash(event),
        "EVENT_ID_CONFLICT",
        409,
      );
      return {
        duplicate: true,
        receipt: JSON.parse(JSON.stringify(existing.receipt)),
      };
    }
    const next = this.nextState(event, device),
      previous = this.records.at(-1)?.receipt;
    const now = this.clock();
    requireThat(Number.isFinite(now), "SERVER_TIME_INVALID", 503);
    const receipt = signed(
      {
        schemaVersion: 1,
        status: "STAGED",
        organizationId: device.organizationId,
        deviceId: event.deviceId,
        streamEpoch: event.streamEpoch,
        eventId: event.eventId,
        sequence: event.sequence,
        payloadHash: hash(event),
        envelopeHash: hash(envelope),
        ingressIndex: this.records.length + 1,
        ingressId: crypto.randomUUID(),
        receivedAt: new Date(now).toISOString(),
        qualityWarnings:
          Math.abs(now - Date.parse(event.observedAt)) > 300000
            ? ["CLIENT_CLOCK_SKEW"]
            : [],
        previousReceiptHash: previous ? hash(previous) : null,
      },
      this.serverKeyId,
      this.privateKey,
    );
    const record = { eventEnvelope: envelope, receipt },
      line = Buffer.from(JSON.stringify(record) + "\n");
    requireThat(
      this.records.length < this.maxEvents &&
        this.bytes + line.length <= this.maxBytes,
      "JOURNAL_CAPACITY",
      503,
    );
    try {
      let offset = 0;
      while (offset < line.length) {
        const written = this.io.writeSync(
          this.fd,
          line,
          offset,
          line.length - offset,
        );
        if (written <= 0) throw new Error("SHORT_WRITE");
        offset += written;
      }
      this.io.fsyncSync(this.fd);
    } catch {
      this.poisoned = true;
      throw new LedgerError("STORAGE_UNAVAILABLE", 503);
    }
    this.bytes += line.length;
    this.commit(record, next);
    return { duplicate: false, receipt: JSON.parse(JSON.stringify(receipt)) };
  }
  readReceipt(eventId, envelope) {
    requireThat(!this.closed && !this.poisoned, "STORAGE_UNAVAILABLE", 503);
    const device = this.authenticate(envelope),
      request = envelope.payload;
    requireThat(
      request &&
        Object.keys(request).sort().join(",") ===
          "eventId,issuedAt,nonce,purpose" &&
        request.purpose === "receipt-read" &&
        request.eventId === eventId &&
        uuid(eventId) &&
        uuid(request.nonce),
      "RECEIPT_REQUEST_INVALID",
      401,
    );
    const now = this.clock(),
      time = Date.parse(request.issuedAt);
    requireThat(
      Number.isFinite(time) && Math.abs(now - time) <= 120000,
      "RECEIPT_REQUEST_EXPIRED",
      401,
    );
    for (const [key, expires] of this.nonces)
      if (expires < now) this.nonces.delete(key);
    const nonce = envelope.keyId + ":" + request.nonce;
    requireThat(!this.nonces.has(nonce), "RECEIPT_REQUEST_REPLAY", 409);
    requireThat(this.nonces.size < 10000, "AUTH_CAPACITY", 503);
    this.nonces.set(nonce, now + 240000);
    const record = this.events.get(eventId);
    requireThat(
      record &&
        record.receipt.payload.organizationId === device.organizationId &&
        record.receipt.payload.deviceId === device.deviceId &&
        record.receipt.payload.streamEpoch === device.streamEpoch,
      "RECEIPT_NOT_FOUND",
      404,
    );
    return JSON.parse(JSON.stringify(record.receipt));
  }
  exportRecords() {
    requireThat(!this.closed && !this.poisoned, "STORAGE_UNAVAILABLE", 503);
    return JSON.parse(JSON.stringify(this.records));
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
module.exports = {
  Ledger,
  LedgerError,
  signed,
  verifyEnvelope,
  hash,
  deviceRegistry,
  nextEventState,
};
