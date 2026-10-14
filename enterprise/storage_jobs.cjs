"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  signed,
  verifyEnvelope,
  hash,
  deviceRegistry,
} = require("./ledger.cjs");
const {
  prepareArtifact,
  simulateStorage,
  StorageError,
} = require("./immutable_storage.cjs");
class JobError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const need = (ok, code) => {
  if (!ok) throw new JobError(code);
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const pem = (key) =>
  (key?.type === "public" ? key : crypto.createPublicKey(key)).export({
    type: "spki",
    format: "pem",
  });
const exact = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const seal = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(seal);
    Object.freeze(value);
  }
  return value;
};
class StorageJobs {
  constructor({
    directory,
    signerKeyId,
    signerPrivateKey,
    trust,
    clock = Date.now,
    maxBytes = 128 * 1024 * 1024,
    maxJobs = 1000,
    maxAttempts = 5,
    io = fs,
    expectedHead,
  }) {
    need(process.platform !== "win32", "JOBS_POSIX_REQUIRED");
    need(
      typeof signerKeyId === "string" &&
        /^[A-Za-z0-9_-]{1,80}$/.test(signerKeyId),
      "JOBS_KEY_INVALID",
    );
    this.privateKey =
      signerPrivateKey?.type === "private"
        ? signerPrivateKey
        : crypto.createPrivateKey(signerPrivateKey);
    this.publicKey = crypto.createPublicKey(this.privateKey);
    need(this.privateKey.asymmetricKeyType === "ed25519", "JOBS_KEY_INVALID");
    need(
      Number.isSafeInteger(maxBytes) &&
        maxBytes > 0 &&
        maxBytes <= 256 * 1024 * 1024 &&
        Number.isSafeInteger(maxJobs) &&
        maxJobs > 0 &&
        maxJobs <= 10000 &&
        Number.isSafeInteger(maxAttempts) &&
        maxAttempts > 0 &&
        maxAttempts <= 100,
      "JOBS_LIMIT_INVALID",
    );
    // Roots come from the operator, never from an exported evidence bundle.
    this.trust = seal({
      serverPublicKey: pem(trust.serverPublicKey),
      serverKeyId: trust.serverKeyId,
      witnessPublicKey: pem(trust.witnessPublicKey),
      registrations: clone(trust.registrations),
    });
    need(
      typeof this.trust.serverKeyId === "string" &&
        Array.isArray(this.trust.registrations) &&
        this.trust.registrations.length > 0,
      "JOBS_TRUST_REQUIRED",
    );
    deviceRegistry(this.trust.registrations);
    need(
      [this.trust.serverPublicKey, this.trust.witnessPublicKey].every(
        (key) => crypto.createPublicKey(key).asymmetricKeyType === "ed25519",
      ),
      "JOBS_TRUST_INVALID",
    );
    this.trustId = hash(this.trust);
    Object.assign(this, {
      signerKeyId,
      clock,
      maxBytes,
      maxJobs,
      maxAttempts,
      io,
    });
    this.jobs = new Map();
    this.records = [];
    this.bytes = 0;
    this.closed = false;
    this.poisoned = false;
    this.directory = path.resolve(directory);
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(this.directory);
    need(
      stat.isDirectory() &&
        !stat.isSymbolicLink() &&
        stat.uid === process.getuid() &&
        (stat.mode & 0o077) === 0,
      "JOBS_DIRECTORY_INVALID",
    );
    this.lockPath = path.join(this.directory, "storage-jobs.lock");
    this.logPath = path.join(this.directory, "storage-jobs.jsonl");
    try {
      this.lockFd = fs.openSync(this.lockPath, "wx", 0o600);
    } catch {
      throw new JobError("JOBS_LOCKED");
    }
    try {
      fs.writeSync(this.lockFd, JSON.stringify({ pid: process.pid }) + "\n");
      this.io.fsyncSync(this.lockFd);
      if (fs.existsSync(this.logPath)) {
        const s = fs.lstatSync(this.logPath);
        need(s.isFile() && !s.isSymbolicLink(), "JOBS_LOG_INVALID");
      }
      this.fd = fs.openSync(this.logPath, "a+", 0o600);
      const s = fs.fstatSync(this.fd);
      need(
        s.uid === process.getuid() &&
          (s.mode & 0o077) === 0 &&
          s.size <= maxBytes,
        "JOBS_LOG_INVALID",
      );
      const content = fs.readFileSync(this.fd, "utf8");
      this.bytes = Buffer.byteLength(content);
      need(!content || content.endsWith("\n"), "JOBS_LOG_INCOMPLETE");
      for (const line of content.split("\n").filter(Boolean)) {
        const record = JSON.parse(line);
        this.apply(record, true);
      }
      if (expectedHead !== undefined)
        need(expectedHead === this.head(), "JOBS_HEAD_MISMATCH");
      this.io.fsyncSync(this.fd);
      for (const folder of [this.directory, path.dirname(this.directory)]) {
        const fd = fs.openSync(folder, "r");
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
    need(!this.closed && !this.poisoned, "JOBS_UNAVAILABLE");
  }
  head() {
    return this.records.length ? hash(this.records.at(-1)) : "genesis";
  }
  artifact(input) {
    return prepareArtifact(input.evidence, {
      ...this.trust,
      witnessAnchor: input.witnessAnchor,
      expectedAnchorHash: input.expectedAnchorHash,
    });
  }
  apply(record, commit) {
    need(
      record.keyId === this.signerKeyId &&
        verifyEnvelope(record, this.publicKey),
      "JOBS_SIGNATURE_INVALID",
    );
    const p = record.payload;
    need(
      exact(p, [
        "schemaVersion",
        "trustId",
        "index",
        "previousHash",
        "at",
        "kind",
        "jobId",
        "data",
      ]) &&
        p.schemaVersion === 1 &&
        p.trustId === this.trustId &&
        p.index === this.records.length + 1 &&
        p.previousHash === this.head() &&
        typeof p.at === "string" &&
        new Date(Date.parse(p.at)).toISOString() === p.at &&
        (!this.records.length || p.at >= this.records.at(-1).payload.at),
      "JOBS_CHAIN_INVALID",
    );
    const old = this.jobs.get(p.jobId);
    let next;
    if (p.kind === "QUEUED") {
      need(
        !old &&
          this.jobs.size < this.maxJobs &&
          exact(p.data, [
            "evidence",
            "witnessAnchor",
            "expectedAnchorHash",
            "destination",
          ]) &&
          exact(p.data.destination, ["provider", "directory"]) &&
          p.data.destination.provider === "local-simulation" &&
          typeof p.data.destination.directory === "string" &&
          path.isAbsolute(p.data.destination.directory) &&
          path.resolve(p.data.destination.directory) ===
            p.data.destination.directory,
        "JOBS_INPUT_INVALID",
      );
      const artifact = this.artifact(p.data);
      need(
        p.jobId ===
          hash({ sha256: artifact.sha256, destination: p.data.destination }),
        "JOBS_ID_INVALID",
      );
      next = {
        jobId: p.jobId,
        input: p.data,
        artifact,
        status: "QUEUED",
        queuedAt: p.at,
        updatedAt: p.at,
        attempts: 0,
        totalAttempts: 0,
        nextAttemptAt: null,
        error: null,
        observation: null,
      };
    } else {
      need(old, "JOBS_UNKNOWN");
      next = { ...old };
      if (p.kind === "ATTEMPT") {
        need(
          p.data === null &&
            ["QUEUED", "RETRY", "WRITING"].includes(old.status) &&
            old.attempts < this.maxAttempts &&
            (!old.nextAttemptAt ||
              Date.parse(p.at) >= Date.parse(old.nextAttemptAt)),
          "JOBS_TRANSITION_INVALID",
        );
        Object.assign(next, {
          status: "WRITING",
          attempts: old.attempts + 1,
          totalAttempts: old.totalAttempts + 1,
          nextAttemptAt: null,
          error: null,
        });
      } else if (p.kind === "SIMULATION_COMPLETE") {
        const o = p.data,
          a = old.artifact;
        need(
          old.status === "WRITING" &&
            exact(o, [
              "schemaVersion",
              "kind",
              "provider",
              "sourceId",
              "entryCount",
              "objectKey",
              "sha256",
              "byteLength",
              "observedAt",
              "immutablePropertiesObserved",
              "simulated",
              "liveAcceptance",
              "sealed",
            ]) &&
            o.kind === "thundy-storage-observation" &&
            o.schemaVersion === 1 &&
            o.provider === "local-simulation" &&
            o.sourceId === a.sourceId &&
            o.entryCount === a.entryCount &&
            o.objectKey === a.key &&
            o.sha256 === a.sha256 &&
            o.byteLength === a.byteLength &&
            Number.isFinite(Date.parse(o.observedAt)) &&
            o.immutablePropertiesObserved === false &&
            o.simulated === true &&
            o.liveAcceptance === false &&
            o.sealed === false,
          "JOBS_OBSERVATION_INVALID",
        );
        Object.assign(next, {
          status: "SIMULATION_COMPLETE",
          observation: o,
          error: null,
          nextAttemptAt: null,
        });
      } else if (p.kind === "RETRY" || p.kind === "DEAD_LETTER") {
        need(
          old.status === "WRITING" &&
            exact(p.data, ["error", "nextAttemptAt"]) &&
            /^[A-Z][A-Z0-9_]{0,79}$/.test(p.data.error),
          "JOBS_TRANSITION_INVALID",
        );
        need(
          p.kind === "RETRY"
            ? old.attempts < this.maxAttempts &&
                Number.isFinite(Date.parse(p.data.nextAttemptAt)) &&
                Date.parse(p.data.nextAttemptAt) > Date.parse(p.at)
            : p.data.nextAttemptAt === null,
          "JOBS_RETRY_INVALID",
        );
        Object.assign(next, { status: p.kind, ...p.data });
      } else if (p.kind === "RETRY_RESET") {
        need(
          old.status === "DEAD_LETTER" && p.data === null,
          "JOBS_TRANSITION_INVALID",
        );
        Object.assign(next, {
          status: "QUEUED",
          attempts: 0,
          nextAttemptAt: null,
          error: null,
        });
      } else throw new JobError("JOBS_ACTION_INVALID");
    }
    next.updatedAt = p.at;
    if (commit) {
      this.jobs.set(p.jobId, seal(next));
      this.records.push(seal(record));
    }
  }
  append(kind, jobId, data) {
    this.ensure();
    const record = signed(
      {
        schemaVersion: 1,
        trustId: this.trustId,
        index: this.records.length + 1,
        previousHash: this.head(),
        at: new Date(this.clock()).toISOString(),
        kind,
        jobId,
        data,
      },
      this.signerKeyId,
      this.privateKey,
    );
    this.apply(record, false);
    const bytes = Buffer.from(JSON.stringify(record) + "\n");
    need(this.bytes + bytes.length <= this.maxBytes, "JOBS_CAPACITY_EXCEEDED");
    try {
      let offset = 0;
      while (offset < bytes.length) {
        const n = this.io.writeSync(
          this.fd,
          bytes,
          offset,
          bytes.length - offset,
        );
        need(n > 0, "JOBS_WRITE_FAILED");
        offset += n;
      }
      this.io.fsyncSync(this.fd);
    } catch {
      this.poisoned = true;
      throw new JobError("JOBS_PERSIST_FAILED");
    }
    this.apply(record, true);
    this.bytes += bytes.length;
  }
  enqueue(evidence, { witnessAnchor, expectedAnchorHash, directory }) {
    this.ensure();
    const input = clone({
      evidence,
      witnessAnchor,
      expectedAnchorHash,
      destination: {
        provider: "local-simulation",
        directory: path.resolve(directory),
      },
    });
    const artifact = this.artifact(input),
      jobId = hash({ sha256: artifact.sha256, destination: input.destination });
    if (this.jobs.has(jobId))
      return { jobId, duplicate: true, status: this.jobs.get(jobId).status };
    this.append("QUEUED", jobId, input);
    return { jobId, duplicate: false, status: "QUEUED" };
  }
  runOne() {
    this.ensure();
    const job = [...this.jobs.values()].find(
      (j) =>
        ["QUEUED", "RETRY", "WRITING"].includes(j.status) &&
        (!j.nextAttemptAt || Date.parse(j.nextAttemptAt) <= this.clock()),
    );
    if (!job) return { processed: false, sealed: false };
    // A process may have died after its last permitted attempt was durably recorded.
    if (job.attempts >= this.maxAttempts) {
      this.append("DEAD_LETTER", job.jobId, {
        error: "JOBS_ATTEMPT_INTERRUPTED",
        nextAttemptAt: null,
      });
      return { processed: true, ...this.summary(this.jobs.get(job.jobId)) };
    }
    this.append("ATTEMPT", job.jobId, null);
    let report;
    try {
      report = simulateStorage(
        this.artifact(job.input),
        job.input.destination.directory,
      );
    } catch (error) {
      const attempts = this.jobs.get(job.jobId).attempts,
        final = attempts >= this.maxAttempts;
      const code =
        error instanceof StorageError ? error.code : "SIMULATION_UNAVAILABLE";
      this.append(final ? "DEAD_LETTER" : "RETRY", job.jobId, {
        error: code,
        nextAttemptAt: final
          ? null
          : new Date(
              this.clock() + Math.min(300000, 1000 * 2 ** (attempts - 1)),
            ).toISOString(),
      });
      return { processed: true, ...this.summary(this.jobs.get(job.jobId)) };
    }
    // Journal failure here is fatal; never acknowledge completion from memory.
    this.append("SIMULATION_COMPLETE", job.jobId, report);
    return { processed: true, ...this.summary(this.jobs.get(job.jobId)) };
  }
  retry(jobId) {
    this.append("RETRY_RESET", jobId, null);
    return this.summary(this.jobs.get(jobId));
  }
  summary(job) {
    return {
      jobId: job.jobId,
      status: job.status,
      queuedAt: job.queuedAt,
      updatedAt: job.updatedAt,
      observedAt: job.observation?.observedAt || null,
      evidenceStatus: "STAGED",
      provider: "local-simulation",
      sourceId: job.artifact.sourceId,
      sha256: job.artifact.sha256,
      entryCount: job.artifact.entryCount,
      attempts: job.attempts,
      totalAttempts: job.totalAttempts,
      nextAttemptAt: job.nextAttemptAt,
      error: job.error,
      simulated: true,
      sealed: false,
    };
  }
  status() {
    this.ensure();
    return {
      schemaVersion: 1,
      kind: "thundy-storage-jobs-status",
      head: this.head(),
      journalBytes: this.bytes,
      maxBytes: this.maxBytes,
      maxJobs: this.maxJobs,
      maxAttempts: this.maxAttempts,
      capacityWarning:
        this.bytes >= this.maxBytes * 0.8 ||
        this.jobs.size >= this.maxJobs * 0.8,
      jobs: [...this.jobs.values()].map((j) => this.summary(j)),
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
module.exports = { StorageJobs, JobError };
