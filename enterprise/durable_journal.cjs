"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { signed, verifyEnvelope, hash } = require("./ledger.cjs");
class JournalError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const need = (ok, code) => {
  if (!ok) throw new JournalError(code);
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const exact = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(",") === keys.split(",").sort().join(",");
const identifier = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const hex = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const iso = (value) =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(Date.parse(value)).toISOString() === value;
function syncDirectory(directory, io = fs) {
  const fd = fs.openSync(directory, "r");
  try {
    io.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
class DurableJournal {
  constructor({
    directory,
    signerKeyId,
    signerPrivateKey,
    scope,
    initialState,
    reducer,
    clock = Date.now,
    maxBytes = 32 * 1024 * 1024,
    maxActions = 10000,
    expectedHead,
    io = fs,
  }) {
    need(process.platform !== "win32", "JOURNAL_POSIX_REQUIRED");
    need(
      identifier(signerKeyId) &&
        typeof reducer === "function" &&
        typeof clock === "function",
      "JOURNAL_CONFIG_INVALID",
    );
    need(
      Number.isSafeInteger(maxBytes) &&
        maxBytes > 0 &&
        maxBytes <= 128 * 1024 * 1024 &&
        Number.isSafeInteger(maxActions) &&
        maxActions > 0 &&
        maxActions <= 100000,
      "JOURNAL_LIMIT_INVALID",
    );
    const privateKey =
      signerPrivateKey?.type === "private"
        ? signerPrivateKey
        : crypto.createPrivateKey(signerPrivateKey);
    need(privateKey.asymmetricKeyType === "ed25519", "JOURNAL_KEY_INVALID");
    Object.assign(this, {
      signerKeyId,
      privateKey,
      publicKey: crypto.createPublicKey(privateKey),
      clock,
      io,
      maxBytes,
      maxActions,
      reducer,
      state: clone(initialState),
      scopeHash: hash(scope),
      records: [],
      bytes: 0,
      poisoned: false,
      closed: false,
    });
    this.directory = path.resolve(directory);
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(this.directory);
    need(
      stat.isDirectory() &&
        !stat.isSymbolicLink() &&
        stat.uid === process.getuid() &&
        (stat.mode & 0o077) === 0,
      "JOURNAL_DIRECTORY_INVALID",
    );
    this.lockPath = path.join(this.directory, "writer.lock");
    this.logPath = path.join(this.directory, "actions.jsonl");
    try {
      this.lockFd = fs.openSync(this.lockPath, "wx", 0o600);
    } catch {
      throw new JournalError("JOURNAL_WRITER_LOCKED");
    }
    try {
      fs.writeSync(this.lockFd, JSON.stringify({ pid: process.pid }) + "\n");
      io.fsyncSync(this.lockFd);
      this.fd = fs.openSync(
        this.logPath,
        fs.constants.O_RDWR |
          fs.constants.O_APPEND |
          fs.constants.O_CREAT |
          fs.constants.O_NOFOLLOW,
        0o600,
      );
      const journal = fs.fstatSync(this.fd);
      need(
        journal.isFile() &&
          journal.uid === process.getuid() &&
          (journal.mode & 0o077) === 0 &&
          journal.size <= maxBytes,
        "JOURNAL_FILE_INVALID",
      );
      const content = fs.readFileSync(this.fd, "utf8");
      this.bytes = Buffer.byteLength(content);
      need(!content || content.endsWith("\n"), "JOURNAL_INCOMPLETE");
      for (const line of content.split("\n").filter(Boolean)) {
        const record = JSON.parse(line),
          next = this.check(record);
        this.records.push(record);
        this.state = next;
      }
      if (expectedHead !== undefined)
        need(expectedHead === this.head(), "JOURNAL_HEAD_MISMATCH");
      io.fsyncSync(this.fd);
      syncDirectory(this.directory, io);
      syncDirectory(path.dirname(this.directory), io);
    } catch (error) {
      this.close();
      throw error instanceof JournalError
        ? error
        : new JournalError("JOURNAL_INVALID");
    }
  }
  head() {
    return this.records.length ? hash(this.records.at(-1)) : null;
  }
  check(record) {
    need(this.records.length < this.maxActions, "JOURNAL_CAPACITY");
    const p = verifyEnvelope(record, this.publicKey);
    need(
      record.keyId === this.signerKeyId &&
        exact(p, "schemaVersion,scopeHash,index,previousHash,at,kind,data") &&
        p.schemaVersion === 1 &&
        p.scopeHash === this.scopeHash &&
        p.index === this.records.length + 1 &&
        p.previousHash === this.head() &&
        iso(p.at) &&
        (!this.records.length ||
          Date.parse(p.at) >= Date.parse(this.records.at(-1).payload.at)) &&
        identifier(p.kind),
      "JOURNAL_ACTION_INVALID",
    );
    return this.reducer(clone(this.state), clone(p));
  }
  now() {
    need(!this.closed && !this.poisoned, "JOURNAL_UNAVAILABLE");
    const now = this.clock();
    need(
      Number.isFinite(now) &&
        Math.abs(now) <= 8640000000000000 &&
        (!this.records.length ||
          now >= Date.parse(this.records.at(-1).payload.at)),
      "JOURNAL_CLOCK_ROLLBACK",
    );
    return now;
  }
  append(kind, data) {
    const at = new Date(this.now()).toISOString();
    const record = signed(
        {
          schemaVersion: 1,
          scopeHash: this.scopeHash,
          index: this.records.length + 1,
          previousHash: this.head(),
          at,
          kind,
          data: clone(data),
        },
        this.signerKeyId,
        this.privateKey,
      ),
      next = this.check(record),
      line = Buffer.from(JSON.stringify(record) + "\n");
    need(this.bytes + line.length <= this.maxBytes, "JOURNAL_CAPACITY");
    try {
      let offset = 0;
      while (offset < line.length) {
        const n = this.io.writeSync(
          this.fd,
          line,
          offset,
          line.length - offset,
        );
        if (n <= 0) throw new Error("SHORT_WRITE");
        offset += n;
      }
      this.io.fsyncSync(this.fd);
    } catch {
      this.poisoned = true;
      throw new JournalError("JOURNAL_UNAVAILABLE");
    }
    this.records.push(record);
    this.state = next;
    this.bytes += line.length;
    return clone(record);
  }
  snapshot() {
    this.now();
    return clone(this.state);
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
  DurableJournal,
  JournalError,
  need,
  clone,
  exact,
  identifier,
  hex,
  iso,
  syncDirectory,
};
