"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { signed, hash } = require("./ledger.cjs");
const {
  EvidenceError,
  verifyRecords,
  verifyCheckpoint,
  matchCheckpoint,
  verifyWitness,
} = require("./evidence.cjs");
const need = (condition, code) => {
  if (!condition) throw new EvidenceError(code);
};
const clone = (value) => JSON.parse(JSON.stringify(value));
class Witness {
  constructor({
    directory,
    witnessKeyId,
    witnessPrivateKey,
    serverKeyId,
    serverPublicKey,
    clock = Date.now,
    io = fs,
    maxBytes = 16 * 1024 * 1024,
  }) {
    this.privateKey =
      witnessPrivateKey?.type === "private"
        ? witnessPrivateKey
        : crypto.createPrivateKey(witnessPrivateKey);
    this.publicKey = crypto.createPublicKey(this.privateKey);
    this.serverPublicKey =
      serverPublicKey?.type === "public"
        ? serverPublicKey
        : crypto.createPublicKey(serverPublicKey);
    need(
      this.privateKey.asymmetricKeyType === "ed25519" &&
        this.serverPublicKey.asymmetricKeyType === "ed25519" &&
        [witnessKeyId, serverKeyId].every(
          (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id),
        ),
      "WITNESS_KEY_INVALID",
    );
    need(
      Number.isSafeInteger(maxBytes) &&
        maxBytes > 0 &&
        maxBytes <= 64 * 1024 * 1024,
      "WITNESS_LIMIT_INVALID",
    );
    Object.assign(this, { witnessKeyId, serverKeyId, clock, io, maxBytes });
    this.anchors = [];
    this.closed = false;
    this.poisoned = false;
    this.directory = path.resolve(directory);
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(this.directory);
    need(
      process.platform !== "win32" &&
        stat.isDirectory() &&
        !stat.isSymbolicLink() &&
        stat.uid === process.getuid() &&
        (stat.mode & 0o077) === 0,
      "PRIVATE_WITNESS_DIRECTORY_REQUIRED",
    );
    this.lockPath = path.join(this.directory, "witness.lock");
    this.logPath = path.join(this.directory, "anchors.jsonl");
    try {
      this.lockFd = fs.openSync(this.lockPath, "wx", 0o600);
    } catch {
      throw new EvidenceError("WITNESS_LOCKED");
    }
    try {
      fs.writeSync(this.lockFd, JSON.stringify({ pid: process.pid }) + "\n");
      fs.fsyncSync(this.lockFd);
      if (fs.existsSync(this.logPath)) {
        const entry = fs.lstatSync(this.logPath);
        need(entry.isFile() && !entry.isSymbolicLink(), "WITNESS_LOG_INVALID");
      }
      this.fd = fs.openSync(this.logPath, "a+", 0o600);
      const entry = fs.fstatSync(this.fd);
      need(
        entry.uid === process.getuid() &&
          (entry.mode & 0o077) === 0 &&
          entry.size <= maxBytes,
        "WITNESS_LOG_INVALID",
      );
      const content = fs.readFileSync(this.fd, "utf8");
      this.bytes = Buffer.byteLength(content);
      need(!content || content.endsWith("\n"), "WITNESS_LOG_INCOMPLETE");
      for (const line of content.split("\n").filter(Boolean)) {
        const anchor = JSON.parse(line);
        this.validateNext(anchor);
        this.anchors.push(anchor);
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
    need(!this.closed && !this.poisoned, "WITNESS_UNAVAILABLE");
  }
  head() {
    return this.anchors.length ? hash(this.anchors.at(-1)) : "genesis";
  }
  validateNext(anchor) {
    const verified = verifyWitness(anchor, {
        witnessPublicKey: this.publicKey,
        expectedAnchorHash: hash(anchor),
        serverPublicKey: this.serverPublicKey,
        serverKeyId: this.serverKeyId,
      }),
      previous = this.anchors.at(-1);
    need(
      anchor.keyId === this.witnessKeyId &&
        verified.payload.anchorIndex === this.anchors.length + 1 &&
        verified.payload.previousWitnessHash ===
          (previous ? hash(previous) : null) &&
        this.anchors.length < 10000,
      "WITNESS_CHAIN_INVALID",
    );
    need(
      Date.parse(verified.checkpoint.createdAt) <=
        Date.parse(verified.payload.witnessedAt) + 120000,
      "WITNESS_SERVER_TIME_INVALID",
    );
    if (previous) {
      const old = previous.payload.checkpoint.payload;
      need(
        verified.checkpoint.sourceId === old.sourceId &&
          verified.checkpoint.entryCount > old.entryCount &&
          Date.parse(verified.payload.witnessedAt) >=
            Date.parse(previous.payload.witnessedAt) &&
          Date.parse(verified.checkpoint.createdAt) >=
            Date.parse(old.createdAt),
        "WITNESS_ROLLBACK_OR_TIME_INVALID",
      );
    }
    return verified;
  }
  append(data, checkpoint, { expectedHead, registrations = null } = {}) {
    this.ensure();
    const latest = this.anchors.at(-1),
      lostResponseReplay =
        latest &&
        (latest.payload.previousWitnessHash || "genesis") === expectedHead &&
        hash(checkpoint) === hash(latest.payload.checkpoint);
    need(
      expectedHead === this.head() || lostResponseReplay,
      "WITNESS_EXPECTED_HEAD_MISMATCH",
    );
    const report = verifyRecords(data, {
      serverPublicKey: this.serverPublicKey,
      serverKeyId: this.serverKeyId,
      registrations,
    });
    const p = verifyCheckpoint(checkpoint, {
      serverPublicKey: this.serverPublicKey,
      serverKeyId: this.serverKeyId,
    });
    matchCheckpoint(report, p);
    const previous = this.anchors.at(-1);
    if (lostResponseReplay)
      return {
        duplicate: true,
        anchor: clone(previous),
        anchorHash: this.head(),
      };
    if (previous) {
      const old = previous.payload.checkpoint.payload;
      matchCheckpoint(report, old, { allowExtension: true });
      if (p.entryCount === old.entryCount)
        return {
          duplicate: true,
          anchor: clone(previous),
          anchorHash: this.head(),
        };
    }
    const now = this.clock();
    need(Number.isFinite(now), "WITNESS_TIME_INVALID");
    const anchor = signed(
      {
        schemaVersion: 1,
        kind: "thundy-staged-witness-anchor",
        anchorIndex: this.anchors.length + 1,
        previousWitnessHash: previous ? hash(previous) : null,
        witnessedAt: new Date(now).toISOString(),
        checkpoint: clone(checkpoint),
      },
      this.witnessKeyId,
      this.privateKey,
    );
    this.validateNext(anchor);
    const line = Buffer.from(JSON.stringify(anchor) + "\n");
    need(this.bytes + line.length <= this.maxBytes, "WITNESS_CAPACITY");
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
      throw new EvidenceError("WITNESS_STORAGE_FAILED");
    }
    this.anchors.push(anchor);
    this.bytes += line.length;
    return {
      duplicate: false,
      anchor: clone(anchor),
      anchorHash: hash(anchor),
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
module.exports = { Witness };
