"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { signed, verifyEnvelope, hash } = require("./ledger.cjs");
const { verifySignedPolicy, evaluateOpening } = require("./contracts.cjs");
class PolicyStateError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const need = (ok, code) => {
  if (!ok) throw new PolicyStateError(code);
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
class PolicyState {
  constructor({
    directory,
    signerKeyId,
    signerPrivateKey,
    context,
    clock = Date.now,
    maxBytes = 4 * 1024 * 1024,
    maxActions = 1000,
    expectedHead,
    io = fs,
  }) {
    need(process.platform !== "win32", "POLICY_STATE_POSIX_REQUIRED");
    need(
      typeof signerKeyId === "string" &&
        /^[A-Za-z0-9_-]{1,80}$/.test(signerKeyId),
      "POLICY_STATE_KEY_INVALID",
    );
    this.privateKey =
      signerPrivateKey?.type === "private"
        ? signerPrivateKey
        : crypto.createPrivateKey(signerPrivateKey);
    this.publicKey = crypto.createPublicKey(this.privateKey);
    need(
      this.privateKey.asymmetricKeyType === "ed25519",
      "POLICY_STATE_KEY_INVALID",
    );
    need(
      context?.trustedKeys instanceof Map &&
        context.trustedKeys.size > 0 &&
        context.trustedKeys.size <= 1000 &&
        Array.isArray(context.groupIds) &&
        Array.isArray(context.capabilities),
      "POLICY_STATE_TRUST_INVALID",
    );
    const roots = [...context.trustedKeys]
      .map(([keyId, key]) => {
        need(
          typeof keyId === "string" &&
            /^[A-Za-z0-9_-]{1,80}$/.test(keyId) &&
            key.publicKey?.type === "public" &&
            key.publicKey.asymmetricKeyType === "ed25519" &&
            key.organizationId === context.organizationId &&
            Number.isFinite(key.notBefore) &&
            Number.isFinite(key.notAfter) &&
            key.notAfter > key.notBefore &&
            (key.revokedAt == null || Number.isFinite(key.revokedAt)),
          "POLICY_STATE_TRUST_INVALID",
        );
        return {
          keyId,
          publicKey: key.publicKey.export({ type: "spki", format: "pem" }),
          organizationId: key.organizationId,
          notBefore: key.notBefore,
          notAfter: key.notAfter,
          revokedAt: key.revokedAt ?? null,
        };
      })
      .sort((a, b) => a.keyId.localeCompare(b.keyId));
    need(
      [context.organizationId, context.policyId].every(
        (v) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v),
      ) &&
        context.groupIds.every((v) => typeof v === "string") &&
        context.capabilities.every((v) => typeof v === "string") &&
        typeof context.clientVersion === "string",
      "POLICY_STATE_SCOPE_INVALID",
    );
    this.context = {
      organizationId: context.organizationId,
      policyId: context.policyId,
      groupIds: [...context.groupIds],
      capabilities: [...context.capabilities],
      clientVersion: context.clientVersion,
      trustedKeys: new Map(
        roots.map((key) => [
          key.keyId,
          { ...key, publicKey: crypto.createPublicKey(key.publicKey) },
        ]),
      ),
    };
    const initialHighestVersion = context.highestVersion ?? 0;
    need(
      Number.isSafeInteger(initialHighestVersion) && initialHighestVersion >= 0,
      "POLICY_STATE_FLOOR_INVALID",
    );
    this.trustId = hash({
      initialHighestVersion,
      ...this.context,
      trustedKeys: roots,
      groupIds: [...this.context.groupIds].sort(),
      capabilities: [...this.context.capabilities].sort(),
    });
    need(
      Number.isSafeInteger(maxBytes) &&
        maxBytes > 0 &&
        maxBytes <= 64 * 1024 * 1024 &&
        Number.isSafeInteger(maxActions) &&
        maxActions > 0 &&
        maxActions <= 10000,
      "POLICY_STATE_LIMIT_INVALID",
    );
    Object.assign(this, { signerKeyId, clock, maxBytes, maxActions, io });
    this.records = [];
    this.highestVersion = initialHighestVersion;
    this.latest = null;
    this.bytes = 0;
    this.poisoned = false;
    this.closed = false;
    this.directory = path.resolve(directory);
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(this.directory);
    need(
      stat.isDirectory() &&
        !stat.isSymbolicLink() &&
        stat.uid === process.getuid() &&
        (stat.mode & 0o077) === 0,
      "POLICY_STATE_DIRECTORY_INVALID",
    );
    this.lockPath = path.join(this.directory, "policy-state.lock");
    this.logPath = path.join(this.directory, "policy-state.jsonl");
    try {
      this.lockFd = fs.openSync(this.lockPath, "wx", 0o600);
    } catch {
      throw new PolicyStateError("POLICY_STATE_LOCKED");
    }
    try {
      fs.writeSync(this.lockFd, JSON.stringify({ pid: process.pid }) + "\n");
      this.io.fsyncSync(this.lockFd);
      if (fs.existsSync(this.logPath)) {
        const s = fs.lstatSync(this.logPath);
        need(s.isFile() && !s.isSymbolicLink(), "POLICY_STATE_LOG_INVALID");
      }
      this.fd = fs.openSync(this.logPath, "a+", 0o600);
      const s = fs.fstatSync(this.fd);
      need(
        s.uid === process.getuid() &&
          (s.mode & 0o077) === 0 &&
          s.size <= maxBytes,
        "POLICY_STATE_LOG_INVALID",
      );
      const text = fs.readFileSync(this.fd, "utf8");
      need(!text || text.endsWith("\n"), "POLICY_STATE_LOG_INCOMPLETE");
      this.bytes = Buffer.byteLength(text);
      for (const line of text.split("\n").filter(Boolean))
        this.apply(JSON.parse(line), true);
      if (expectedHead !== undefined)
        need(expectedHead === this.head(), "POLICY_STATE_HEAD_MISMATCH");
      this.io.fsyncSync(this.fd);
      for (const dir of [this.directory, path.dirname(this.directory)]) {
        const fd = fs.openSync(dir, "r");
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
    need(!this.closed && !this.poisoned, "POLICY_STATE_UNAVAILABLE");
    const now = this.clock();
    need(
      Number.isFinite(now) &&
        (!this.records.length ||
          now >= Date.parse(this.records.at(-1).payload.at)),
      "POLICY_STATE_CLOCK_ROLLBACK",
    );
  }
  head() {
    return this.records.length ? hash(this.records.at(-1)) : "genesis";
  }
  verify(envelope, now) {
    return verifySignedPolicy(envelope, {
      ...this.context,
      now,
      highestVersion: this.highestVersion,
    });
  }
  apply(record, commit) {
    need(record.keyId === this.signerKeyId, "POLICY_STATE_SIGNATURE_INVALID");
    verifyEnvelope(record, this.publicKey);
    const p = record.payload;
    need(
      p &&
        Object.keys(p).length === 7 &&
        [
          "schemaVersion",
          "trustId",
          "index",
          "previousHash",
          "at",
          "kind",
          "data",
        ].every((k) => Object.hasOwn(p, k)) &&
        p.schemaVersion === 1 &&
        p.trustId === this.trustId &&
        p.index === this.records.length + 1 &&
        p.previousHash === this.head() &&
        typeof p.at === "string" &&
        Number.isFinite(Date.parse(p.at)) &&
        new Date(p.at).toISOString() === p.at &&
        (!this.records.length || p.at >= this.records.at(-1).payload.at) &&
        this.records.length < this.maxActions,
      "POLICY_STATE_CHAIN_INVALID",
    );
    if (p.kind === "ACCEPTED") {
      const policy = this.verify(p.data, Date.parse(p.at));
      need(
        !this.latest || policy.version > this.highestVersion,
        "POLICY_STATE_VERSION_REUSE",
      );
      if (commit) {
        this.highestVersion = policy.version;
        this.latest = p.data;
      }
    } else if (p.kind === "KEY_REVOKED") {
      need(
        p.data &&
          Object.keys(p.data).length === 1 &&
          typeof p.data.keyId === "string",
        "POLICY_STATE_REVOCATION_INVALID",
      );
      const key = this.context.trustedKeys.get(p.data.keyId);
      need(
        key && (key.revokedAt === null || key.revokedAt > Date.parse(p.at)),
        "POLICY_STATE_REVOCATION_INVALID",
      );
      if (commit) key.revokedAt = Date.parse(p.at);
    } else throw new PolicyStateError("POLICY_STATE_ACTION_INVALID");
    if (commit) this.records.push(freeze(record));
  }
  append(kind, data) {
    this.ensure();
    const record = signed(
      {
        schemaVersion: 1,
        trustId: this.trustId,
        index: this.records.length + 1,
        previousHash: this.head(),
        at: new Date(this.clock()).toISOString(),
        kind,
        data,
      },
      this.signerKeyId,
      this.privateKey,
    );
    this.apply(record, false);
    const bytes = Buffer.from(JSON.stringify(record) + "\n");
    need(
      this.bytes + bytes.length <= this.maxBytes,
      "POLICY_STATE_CAPACITY_EXCEEDED",
    );
    try {
      let offset = 0;
      while (offset < bytes.length) {
        const n = this.io.writeSync(
          this.fd,
          bytes,
          offset,
          bytes.length - offset,
        );
        need(n > 0, "POLICY_STATE_WRITE_FAILED");
        offset += n;
      }
      this.io.fsyncSync(this.fd);
    } catch {
      this.poisoned = true;
      throw new PolicyStateError("POLICY_STATE_PERSIST_FAILED");
    }
    this.apply(record, true);
    this.bytes += bytes.length;
  }
  accept(envelope) {
    this.ensure();
    const copy = clone(envelope);
    this.verify(copy, this.clock());
    if (this.latest && copy.payload.version === this.highestVersion) {
      need(hash(copy) === hash(this.latest), "POLICY_STATE_VERSION_REUSE");
      return {
        duplicate: true,
        version: this.highestVersion,
        head: this.head(),
      };
    }
    this.append("ACCEPTED", copy);
    return {
      duplicate: false,
      version: this.highestVersion,
      head: this.head(),
    };
  }
  revoke(keyId) {
    this.ensure();
    const key = this.context.trustedKeys.get(keyId);
    need(key, "POLICY_STATE_KEY_UNKNOWN");
    if (key.revokedAt !== null && key.revokedAt <= this.clock())
      return { duplicate: true, head: this.head() };
    this.append("KEY_REVOKED", { keyId });
    return { duplicate: false, head: this.head() };
  }
  evaluate(assessment, state) {
    this.ensure();
    need(this.latest, "POLICY_STATE_EMPTY");
    const now = this.clock();
    // Fresh verification always consults the persisted version floor and revocations.
    const policy = this.verify(this.latest, now);
    return evaluateOpening(policy, assessment, { ...state, now });
  }
  status() {
    this.ensure();
    return {
      highestVersion: this.highestVersion,
      head: this.head(),
      actionCount: this.records.length,
      journalBytes: this.bytes,
      revokedKeyIds: [...this.context.trustedKeys]
        .filter(
          ([, key]) => key.revokedAt !== null && key.revokedAt <= this.clock(),
        )
        .map(([id]) => id),
      sealed: false,
    };
  }
  close() {
    if (this.fd !== undefined) {
      fs.closeSync(this.fd);
      this.fd = undefined;
    }
    if (this.lockFd !== undefined) {
      fs.closeSync(this.lockFd);
      this.lockFd = undefined;
      fs.unlinkSync(this.lockPath);
    }
    this.closed = true;
  }
}
module.exports = { PolicyState, PolicyStateError };
