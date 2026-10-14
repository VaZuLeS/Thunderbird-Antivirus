"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { Ledger, signed } = require("../ledger.cjs");
const { Witness } = require("../witness.cjs");
const { makeCheckpoint } = require("../evidence.cjs");
const { prepareArtifact } = require("../immutable_storage.cjs");
const { StorageJobs } = require("../storage_jobs.cjs");
const { parse } = require("../storage_jobs_cli.cjs");
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-storage-")),
    server = crypto.generateKeyPairSync("ed25519"),
    device = crypto.generateKeyPairSync("ed25519"),
    keys = crypto.generateKeyPairSync("ed25519");
  const registration = {
    keyId: "device-1",
    organizationId: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
    streamEpoch: crypto.randomUUID(),
    policyId: crypto.randomUUID(),
    policyVersion: 1,
    revoked: false,
    publicKey: device.publicKey.export({ type: "spki", format: "pem" }),
  };
  const ledger = new Ledger({
      directory: path.join(root, "service"),
      registrations: [registration],
      serverKeyId: "server-1",
      serverPrivateKey: server.privateKey.export({
        type: "pkcs8",
        format: "pem",
      }),
    }),
    witness = new Witness({
      directory: path.join(root, "witness"),
      witnessKeyId: "witness-1",
      witnessPrivateKey: keys.privateKey,
      serverKeyId: "server-1",
      serverPublicKey: server.publicKey,
    });
  ledger.accept(
    signed(
      {
        schemaVersion: 2,
        eventId: crypto.randomUUID(),
        interactionId: crypto.randomUUID(),
        deviceId: registration.deviceId,
        streamEpoch: registration.streamEpoch,
        policyId: registration.policyId,
        policyVersion: 1,
        sequence: 1,
        observedAt: new Date().toISOString(),
        kind: "CLICKED",
        outcome: null,
        attemptNumber: 0,
        extensionVersion: "1.21.0",
        urlMode: "domain_only",
        urlRedacted: "https://example.org",
        assessment: {
          localScore: null,
          modelVersion: null,
          providerVerdict: "UNKNOWN",
          provider: "none",
          observedAt: null,
          reasonCodes: [],
        },
        reason: null,
      },
      registration.keyId,
      device.privateKey,
    ),
  );
  const data = {
      kind: "thundy-staged-journal-export",
      schemaVersion: 1,
      records: ledger.exportRecords(),
    },
    cp = makeCheckpoint(data, {
      serverPrivateKey: server.privateKey,
      serverKeyId: "server-1",
    }),
    anchored = witness.append(data, cp, { expectedHead: "genesis" });
  const trust = {
      serverPublicKey: server.publicKey,
      serverKeyId: "server-1",
      registrations: [registration],
      witnessAnchor: anchored.anchor,
      witnessPublicKey: keys.publicKey,
      expectedAnchorHash: anchored.anchorHash,
    },
    artifact = prepareArtifact(data, trust);
  return {
    root,
    data,
    trust,
    artifact,
    server,
    cleanup() {
      ledger.close();
      witness.close();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

function context(t, extra = {}) {
  const f = fixture();
  const signer = crypto.generateKeyPairSync("ed25519");
  const options = {
    directory: path.join(f.root, "jobs"),
    signerKeyId: "jobs-1",
    signerPrivateKey: signer.privateKey,
    trust: f.trust,
    ...extra,
  };
  let current;
  const open = (changes = {}) => {
    current = new StorageJobs({ ...options, ...changes });
    return current;
  };
  t.after(() => {
    current?.close();
    f.cleanup();
  });
  const enqueue = (q) =>
    q.enqueue(f.data, {
      witnessAnchor: f.trust.witnessAnchor,
      expectedAnchorHash: f.trust.expectedAnchorHash,
      directory: path.join(f.root, "objects"),
    });
  return { ...f, options, open, enqueue };
}
test("queued evidence and identity survive restart; completion never becomes SEALED", (t) => {
  const f = context(t),
    q = f.open(),
    id = f.enqueue(q).jobId,
    head = q.head();
  q.close();
  const recovered = f.open({ expectedHead: head });
  assert.equal(recovered.status().jobs[0].jobId, id);
  const result = recovered.runOne();
  assert.equal(result.status, "SIMULATION_COMPLETE");
  assert.equal(result.sealed, false);
  assert.equal(result.totalAttempts, 1);
  assert.deepEqual(recovered.runOne(), { processed: false, sealed: false });
  recovered.close();
  const again = f.open();
  assert.equal(f.enqueue(again).duplicate, true);
  assert.equal(again.status().jobs[0].status, "SIMULATION_COMPLETE");
});
test("invalid external witness pin writes no queue record or object", (t) => {
  const f = context(t),
    q = f.open();
  assert.throws(() =>
    q.enqueue(f.data, {
      witnessAnchor: f.trust.witnessAnchor,
      expectedAnchorHash: "0".repeat(64),
      directory: path.join(f.root, "objects"),
    }),
  );
  assert.equal(q.status().journalBytes, 0);
  assert.equal(fs.existsSync(path.join(f.root, "objects")), false);
});
test("queue snapshots trust and evidence before caller mutation", (t) => {
  const f = context(t),
    q = f.open();
  f.enqueue(q);
  f.trust.registrations[0].publicKey = "invalid";
  f.data.records.length = 0;
  assert.equal(q.runOne().status, "SIMULATION_COMPLETE");
});
test("destination is part of the durable job identity", (t) => {
  const f = context(t),
    q = f.open(),
    first = f.enqueue(q);
  const second = q.enqueue(f.data, {
    witnessAnchor: f.trust.witnessAnchor,
    expectedAnchorHash: f.trust.expectedAnchorHash,
    directory: path.join(f.root, "other"),
  });
  assert.notEqual(first.jobId, second.jobId);
  assert.equal(q.status().jobs.length, 2);
});
test("exclusive writer rejects concurrent worker", (t) => {
  const f = context(t);
  f.open();
  assert.throws(() => new StorageJobs(f.options), { code: "JOBS_LOCKED" });
});
test("changed trust roots cannot reinterpret existing signed jobs", (t) => {
  const f = context(t),
    q = f.open();
  f.enqueue(q);
  q.close();
  assert.throws(() => f.open({ trust: { ...f.trust, serverKeyId: "other" } }), {
    code: "JOBS_CHAIN_INVALID",
  });
});
test("journal tampering and partial tails fail closed", (t) => {
  const f = context(t),
    q = f.open();
  f.enqueue(q);
  q.close();
  const log = path.join(f.options.directory, "storage-jobs.jsonl"),
    original = fs.readFileSync(log, "utf8");
  fs.writeFileSync(log, original.replace('"QUEUED"', '"WRITING"'));
  assert.throws(() => f.open());
  fs.writeFileSync(log, original.slice(0, -1));
  assert.throws(() => f.open(), { code: "JOBS_LOG_INCOMPLETE" });
});
test("external queue head detects valid-prefix truncation", (t) => {
  const f = context(t),
    q = f.open();
  f.enqueue(q);
  const prefix = fs.readFileSync(q.logPath);
  q.runOne();
  const head = q.head();
  q.close();
  fs.writeFileSync(q.logPath, prefix);
  assert.throws(() => f.open({ expectedHead: head }), {
    code: "JOBS_HEAD_MISMATCH",
  });
});
test("capacity refusal retains accepted job and permits duplicate enqueue", (t) => {
  const f = context(t),
    q = f.open();
  f.enqueue(q);
  const size = q.bytes;
  q.close();
  const limited = f.open({ maxBytes: size });
  assert.equal(f.enqueue(limited).duplicate, true);
  assert.throws(() => limited.runOne(), { code: "JOBS_CAPACITY_EXCEEDED" });
  assert.equal(limited.status().jobs[0].status, "QUEUED");
});
test("failed readback persists backoff, dead letter, and operator redrive history", (t) => {
  let now = Date.now();
  const f = context(t, { clock: () => now, maxAttempts: 2 }),
    q = f.open();
  const id = f.enqueue(q).jobId;
  fs.mkdirSync(path.join(f.root, "objects"), { mode: 0o700 });
  fs.writeFileSync(
    path.join(f.root, "objects", f.artifact.sha256 + ".json"),
    "bad",
    { mode: 0o600 },
  );
  const failed = q.runOne();
  assert.equal(failed.status, "RETRY");
  assert.equal(failed.error, "STORAGE_CONTENT_MISMATCH");
  assert.equal(q.runOne().processed, false);
  q.close();
  now += 1001;
  const resumed = f.open();
  assert.equal(resumed.runOne().status, "DEAD_LETTER");
  assert.equal(resumed.retry(id).totalAttempts, 2);
  fs.unlinkSync(path.join(f.root, "objects", f.artifact.sha256 + ".json"));
  const done = resumed.runOne();
  assert.equal(done.status, "SIMULATION_COMPLETE");
  assert.equal(done.totalAttempts, 3);
  assert.equal(done.attempts, 1);
});
test("completion fsync failure acknowledges nothing; replay syncs and recovers written record", (t) => {
  const f = context(t),
    q = f.open();
  f.enqueue(q);
  q.io = {
    ...fs,
    fsyncSync(fd) {
      const text = fs.readFileSync(q.logPath, "utf8");
      if (text.includes('"kind":"SIMULATION_COMPLETE"'))
        throw new Error("disk");
      fs.fsyncSync(fd);
    },
  };
  assert.throws(() => q.runOne(), { code: "JOBS_PERSIST_FAILED" });
  assert.throws(() => q.status(), { code: "JOBS_UNAVAILABLE" });
  q.close();
  const resumed = f.open();
  assert.equal(resumed.status().jobs[0].status, "SIMULATION_COMPLETE");
  assert.equal(resumed.runOne().processed, false);
});
function files(f) {
  const keyFile = path.join(f.root, "signer.pem"),
    serverFile = path.join(f.root, "server.pem"),
    witnessFile = path.join(f.root, "witness.pem"),
    registryFile = path.join(f.root, "registry.json"),
    configFile = path.join(f.root, "config.json"),
    exportFile = path.join(f.root, "export.json"),
    anchorFile = path.join(f.root, "anchor.json");
  fs.writeFileSync(
    keyFile,
    f.options.signerPrivateKey.export({ type: "pkcs8", format: "pem" }),
    { mode: 0o600 },
  );
  fs.writeFileSync(
    serverFile,
    f.trust.serverPublicKey.export({ type: "spki", format: "pem" }),
  );
  fs.writeFileSync(
    witnessFile,
    f.trust.witnessPublicKey.export({ type: "spki", format: "pem" }),
  );
  fs.writeFileSync(
    registryFile,
    JSON.stringify({ registrations: f.trust.registrations }),
  );
  fs.writeFileSync(exportFile, JSON.stringify(f.data));
  fs.writeFileSync(anchorFile, JSON.stringify(f.trust.witnessAnchor));
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      schemaVersion: 1,
      signerKeyId: "jobs-1",
      signerPrivateKeyFile: keyFile,
      serverKeyId: f.trust.serverKeyId,
      serverPublicKeyFile: serverFile,
      witnessPublicKeyFile: witnessFile,
      registryFile,
    }),
  );
  return { configFile, exportFile, anchorFile };
}
test("real process exit after object readback resumes identical job without duplicate object", (t) => {
  const f = context(t),
    q = f.open();
  f.enqueue(q);
  q.close();
  const saved = files(f);
  const modulePath = path.resolve(__dirname, "../storage_jobs.cjs"),
    cliPath = path.resolve(__dirname, "../storage_jobs_cli.cjs");
  const script = `const {StorageJobs}=require(${JSON.stringify(modulePath)});const {loadConfig}=require(${JSON.stringify(cliPath)});const q=new StorageJobs({...loadConfig(process.argv[1]),directory:process.argv[2]});const append=q.append.bind(q);q.append=(kind,...args)=>{if(kind==='SIMULATION_COMPLETE')process.exit(23);return append(kind,...args)};q.runOne();`;
  const child = spawnSync(
    process.execPath,
    ["-e", script, saved.configFile, f.options.directory],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 23, child.stderr);
  // Only test harness removes lock after it has confirmed child exit.
  fs.unlinkSync(path.join(f.options.directory, "storage-jobs.lock"));
  const resumed = f.open();
  assert.equal(resumed.status().jobs[0].status, "WRITING");
  assert.equal(resumed.runOne().status, "SIMULATION_COMPLETE");
  assert.equal(resumed.status().jobs[0].totalAttempts, 2);
  assert.equal(fs.readdirSync(path.join(f.root, "objects")).length, 1);
});
test("interrupted final attempt becomes dead letter and remains retained", (t) => {
  const f = context(t, { maxAttempts: 1 }),
    q = f.open();
  const id = f.enqueue(q).jobId;
  q.append("ATTEMPT", id, null);
  q.close();
  const resumed = f.open();
  assert.equal(resumed.runOne().status, "DEAD_LETTER");
  assert.equal(resumed.status().jobs.length, 1);
});
test("fabricated SEALED observation is rejected before journal append", (t) => {
  const f = context(t),
    q = f.open(),
    id = f.enqueue(q).jobId;
  q.append("ATTEMPT", id, null);
  const bytes = q.bytes;
  assert.throws(() => q.append("SIMULATION_COMPLETE", id, { sealed: true }), {
    code: "JOBS_OBSERVATION_INVALID",
  });
  assert.equal(q.bytes, bytes);
  assert.equal(q.status().jobs[0].status, "WRITING");
});
test("status excludes evidence URLs, destinations, public roots and private keys", (t) => {
  const f = context(t),
    q = f.open();
  f.enqueue(q);
  q.runOne();
  const report = JSON.stringify(q.status());
  for (const value of [
    "example.org",
    f.root,
    "BEGIN",
    f.trust.registrations[0].deviceId,
  ])
    assert.equal(report.includes(value), false);
});
test("job limit retains accepted records while duplicates remain idempotent", (t) => {
  const f = context(t, { maxJobs: 1 }),
    q = f.open();
  f.enqueue(q);
  assert.equal(f.enqueue(q).duplicate, true);
  assert.throws(
    () =>
      q.enqueue(f.data, {
        witnessAnchor: f.trust.witnessAnchor,
        expectedAnchorHash: f.trust.expectedAnchorHash,
        directory: path.join(f.root, "second"),
      }),
    { code: "JOBS_INPUT_INVALID" },
  );
});
test("CLI validates command-specific options and executes separate enqueue/run/status processes", (t) => {
  assert.throws(() =>
    parse("run", ["--queue", "q", "--config", "c", "--export", "e"]),
  );
  assert.throws(() => parse("cloud", []));
  const f = context(t),
    saved = files(f),
    cli = path.resolve(__dirname, "../storage_jobs_cli.cjs"),
    common = ["--queue", f.options.directory, "--config", saved.configFile];
  const run = (command, args = []) => {
    const r = spawnSync(process.execPath, [cli, command, ...common, ...args], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  const queued = run("enqueue", [
    "--export",
    saved.exportFile,
    "--witness-anchor",
    saved.anchorFile,
    "--expected-anchor-hash",
    f.trust.expectedAnchorHash,
    "--directory",
    path.join(f.root, "objects"),
  ]);
  assert.equal(run("run").status, "SIMULATION_COMPLETE");
  const status = run("status");
  const out = path.join(f.root, "storage-review.html");
  assert.equal(
    run("review", [
      "--out",
      out,
      "--lang",
      "de",
      "--expected-head",
      status.head,
    ]).jobCount,
    1,
  );
  assert.equal(run("status").head, status.head);
  assert.equal(fs.statSync(out).mode & 0o077, 0);
  assert.ok(
    fs.readFileSync(out, "utf8").includes("Prüfung der Speicheraufträge"),
  );
  assert.equal(fs.readFileSync(out, "utf8").includes("example.org"), false);
  const repeated = spawnSync(
    process.execPath,
    [cli, "review", ...common, "--out", out],
    { encoding: "utf8" },
  );
  assert.equal(repeated.status, 1);
  assert.match(repeated.stderr, /JOBS_REVIEW_OUTPUT_EXISTS/);

  assert.equal(status.jobs[0].jobId, queued.jobId);
  assert.equal(
    run("status", ["--expected-head", status.head]).head,
    status.head,
  );
  const bad = spawnSync(
    process.execPath,
    [cli, "status", ...common, "--expected-head", "genesis"],
    { encoding: "utf8" },
  );
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /JOBS_HEAD_MISMATCH/);
});

test("partial journal write poisons writer and incomplete recovery never reports acceptance", (t) => {
  const f = context(t),
    q = f.open();
  q.io = {
    ...fs,
    writeSync(fd, bytes, offset, length) {
      fs.writeSync(fd, bytes, offset, Math.min(length, 17));
      throw new Error("disk failure");
    },
  };
  assert.throws(() => f.enqueue(q), { code: "JOBS_PERSIST_FAILED" });
  assert.throws(() => q.runOne(), { code: "JOBS_UNAVAILABLE" });
  q.close();
  assert.throws(() => f.open(), { code: "JOBS_LOG_INCOMPLETE" });
});
test("private queue permissions and symlink checks precede journal creation", (t) => {
  const f = context(t);
  fs.mkdirSync(f.options.directory, { mode: 0o755 });
  fs.chmodSync(f.options.directory, 0o755);
  assert.throws(() => f.open(), { code: "JOBS_DIRECTORY_INVALID" });
  fs.rmdirSync(f.options.directory);
  fs.symlinkSync(path.join(f.root, "service"), f.options.directory);
  assert.throws(() => f.open(), { code: "JOBS_DIRECTORY_INVALID" });
  assert.equal(
    fs.existsSync(path.join(f.root, "service", "storage-jobs.jsonl")),
    false,
  );
});
test("different signing key cannot recover journal or create a new acceptance", (t) => {
  const f = context(t),
    q = f.open();
  f.enqueue(q);
  q.close();
  assert.throws(() =>
    f.open({
      signerPrivateKey: crypto.generateKeyPairSync("ed25519").privateKey,
    }),
  );
});

const {
  s3Fixture,
  azureFixture,
  gcpFixture,
} = require("./storage-fixtures.cjs");
function cloudEnqueue(f, q, provider, settings) {
  return q.enqueueCloud(f.data, {
    witnessAnchor: f.trust.witnessAnchor,
    expectedAnchorHash: f.trust.expectedAnchorHash,
    provider,
    settings,
  });
}
const cloudOptions = (provider, port, extra = {}) => ({
  ports: { [provider]: port },
  authorization: { allowCloudWrite: true },
  ...extra,
});
for (const [provider, makePort] of [
  ["aws-s3", s3Fixture],
  ["azure-blob", azureFixture],
  ["gcp-bucket", gcpFixture],
]) {
  test(`${provider} durable job observes a version and replays without SEALED`, async (t) => {
    const f = context(t),
      q = f.open(),
      cloud = makePort(),
      id = cloudEnqueue(f, q, provider, cloud.config).jobId;
    q.close();
    const resumed = f.open();
    const result = await resumed.runCloudOne(
      cloudOptions(provider, cloud.port),
    );
    assert.equal(result.status, "CLOUD_OBSERVED");
    assert.equal(result.provider, provider);
    assert.ok(result.objectVersion);
    assert.equal(result.sealed, false);
    assert.equal(result.transportVerified, false);
    assert.equal(result.simulated, null);
    resumed.close();
    const replay = f.open();
    assert.equal(replay.status().jobs[0].jobId, id);
    assert.equal(replay.status().jobs[0].status, "CLOUD_OBSERVED");
    assert.equal(
      (await replay.runCloudOne(cloudOptions(provider, cloud.port))).processed,
      false,
    );
  });
}
test("cloud write authorization is checked before attempts; local runner skips cloud jobs", async (t) => {
  const f = context(t),
    q = f.open(),
    cloud = s3Fixture();
  cloudEnqueue(f, q, "aws-s3", cloud.config);
  await assert.rejects(q.runCloudOne({ ports: { "aws-s3": cloud.port } }), {
    code: "CLOUD_WRITE_DISABLED",
  });
  assert.equal(q.status().jobs[0].attempts, 0);
  assert.equal(q.runOne().processed, false);
  assert.equal(cloud.calls.length, 0);
  await assert.rejects(
    q.runCloudOne({ authorization: { allowCloudWrite: true }, ports: {} }),
    { code: "JOBS_STORAGE_PORT_REQUIRED" },
  );
  assert.equal(q.status().jobs[0].attempts, 0);
});
test("cloud identity includes retention, region, encryption and owner; rejects secret fields", (t) => {
  const f = context(t),
    q = f.open(),
    cloud = s3Fixture();
  const first = cloudEnqueue(f, q, "aws-s3", cloud.config);
  assert.equal(cloudEnqueue(f, q, "aws-s3", cloud.config).duplicate, true);
  for (const changed of [
    {
      retainUntil: new Date(
        Date.parse(cloud.config.retainUntil) + 1000,
      ).toISOString(),
    },
    { bucket: "other-bucket" },
    { kmsKeyArn: cloud.config.kmsKeyArn + "-2" },
  ])
    assert.notEqual(
      cloudEnqueue(f, q, "aws-s3", { ...cloud.config, ...changed }).jobId,
      first.jobId,
    );
  const before = q.bytes;
  assert.throws(
    () => cloudEnqueue(f, q, "aws-s3", { ...cloud.config, token: "secret" }),
    { code: "STORAGE_CONFIG_INVALID" },
  );
  assert.equal(q.bytes, before);
  const invalid = { ...cloud.config, region: "us-east-1" };
  assert.throws(() => cloudEnqueue(f, q, "aws-s3", invalid), {
    code: "S3_CONFIG_INVALID",
  });
  assert.equal(q.bytes, before);
});
test("timeout persists retry; late preflight cannot start an upload", async (t) => {
  const f = context(t),
    q = f.open();
  let resolve,
    uploads = 0;
  const cloud = s3Fixture({
    getBucketLocation: () =>
      new Promise((r) => {
        resolve = r;
      }),
    putObject: async () => {
      uploads++;
    },
  });
  cloudEnqueue(f, q, "aws-s3", cloud.config);
  const result = await q.runCloudOne(
    cloudOptions("aws-s3", cloud.port, { timeoutMs: 20 }),
  );
  assert.equal(result.status, "RETRY");
  assert.equal(result.error, "STORAGE_TIMEOUT");
  resolve({ LocationConstraint: cloud.config.region });
  await new Promise((r) => setImmediate(r));
  assert.equal(uploads, 0);
  q.close();
  const replay = f.open();
  assert.equal(replay.status().jobs[0].error, "STORAGE_TIMEOUT");
  assert.ok(replay.status().jobs[0].nextAttemptAt);
});
test("in-flight cloud worker rejects concurrent mutation and close", async (t) => {
  const f = context(t),
    q = f.open();
  let resolve;
  const cloud = s3Fixture({
    getBucketLocation: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  cloudEnqueue(f, q, "aws-s3", cloud.config);
  const pending = q.runCloudOne(
    cloudOptions("aws-s3", cloud.port, { timeoutMs: 1000 }),
  );
  await new Promise((r) => setImmediate(r));
  assert.equal(q.status().jobs[0].status, "WRITING");
  assert.throws(() => q.close(), { code: "JOBS_BUSY" });
  assert.throws(() => f.enqueue(q), { code: "JOBS_BUSY" });
  assert.throws(() => q.retry(q.status().jobs[0].jobId), { code: "JOBS_BUSY" });
  await assert.rejects(q.runCloudOne(cloudOptions("aws-s3", cloud.port)), {
    code: "JOBS_BUSY",
  });
  resolve({ LocationConstraint: cloud.config.region });
  assert.equal((await pending).status, "CLOUD_OBSERVED");
});
test("lost upload response restarts same conditional object and checks existing version", async (t) => {
  let now = Date.now();
  const f = context(t, { clock: () => now }),
    q = f.open();
  let exists = false,
    objects = 0,
    gets = 0;
  const cloud = s3Fixture();
  const originalPut = cloud.port.putObject;
  cloud.port.putObject = async (args) => {
    assert.equal(args.IfNoneMatch, "*");
    if (exists) throw { $metadata: { httpStatusCode: 412 } };
    await originalPut(args);
    exists = true;
    objects++;
    throw new Error("lost response token=never-print");
  };
  cloud.port.headObject = async () => {
    gets++;
    return { VersionId: "version-1" };
  };
  cloudEnqueue(f, q, "aws-s3", cloud.config);
  assert.equal(
    (await q.runCloudOne(cloudOptions("aws-s3", cloud.port))).status,
    "RETRY",
  );
  q.close();
  now += 1001;
  const replay = f.open();
  const done = await replay.runCloudOne(cloudOptions("aws-s3", cloud.port));
  assert.equal(done.status, "CLOUD_OBSERVED");
  assert.equal(objects, 1);
  assert.equal(gets, 1);
  assert.equal(done.totalAttempts, 2);
  assert.equal(JSON.stringify(replay.status()).includes("token="), false);
});
test("cloud completion fsync failure never acknowledges observation; replay preserves evidence", async (t) => {
  const f = context(t),
    q = f.open(),
    cloud = s3Fixture();
  cloudEnqueue(f, q, "aws-s3", cloud.config);
  q.io = {
    ...fs,
    fsyncSync(fd) {
      if (
        fs.readFileSync(q.logPath, "utf8").includes('"kind":"CLOUD_OBSERVED"')
      )
        throw new Error("disk");
      fs.fsyncSync(fd);
    },
  };
  await assert.rejects(q.runCloudOne(cloudOptions("aws-s3", cloud.port)), {
    code: "JOBS_PERSIST_FAILED",
  });
  assert.throws(() => q.status(), { code: "JOBS_UNAVAILABLE" });
  q.close();
  assert.equal(f.open().status().jobs[0].status, "CLOUD_OBSERVED");
});
test("cloud observation cannot alter destination, version or claim SEALED", async (t) => {
  const f = context(t),
    q = f.open(),
    cloud = s3Fixture();
  cloudEnqueue(f, q, "aws-s3", cloud.config);
  await q.runCloudOne(cloudOptions("aws-s3", cloud.port));
  const job = q.jobs.values().next().value,
    writing = { ...job, status: "WRITING" };
  for (const changes of [
    { sealed: true },
    { liveAcceptance: true },
    { transportVerified: true },
    { bucket: "other-bucket" },
    { objectVersion: "null" },
    { retainUntil: "2000-01-01T00:00:00.000Z" },
  ])
    assert.throws(
      () =>
        q.validateCloudObservation(writing, { ...job.observation, ...changes }),
      { code: "JOBS_OBSERVATION_INVALID" },
    );
});

test("cloud enqueue CLI saves an inactive destination without contacting provider", (t) => {
  const f = context(t),
    saved = files(f),
    cloud = s3Fixture(),
    destination = path.join(f.root, "destination.json"),
    cli = path.resolve(__dirname, "../storage_jobs_cli.cjs");
  fs.writeFileSync(
    destination,
    JSON.stringify({ provider: "aws-s3", settings: cloud.config }),
  );
  const r = spawnSync(
    process.execPath,
    [
      cli,
      "enqueue-cloud",
      "--queue",
      f.options.directory,
      "--config",
      saved.configFile,
      "--export",
      saved.exportFile,
      "--witness-anchor",
      saved.anchorFile,
      "--expected-anchor-hash",
      f.trust.expectedAnchorHash,
      "--destination",
      destination,
    ],
    { encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).status, "QUEUED");
  const q = f.open();
  assert.equal(q.runOne().processed, false);
  assert.equal(q.status().jobs[0].provider, "aws-s3");
  assert.equal(cloud.calls.length, 0);
});
test("expired cloud retention is rejected before accepting a new job", (t) => {
  const f = context(t),
    q = f.open(),
    cloud = s3Fixture();
  assert.throws(
    () =>
      cloudEnqueue(f, q, "aws-s3", {
        ...cloud.config,
        retainUntil: "2000-01-01T00:00:00.000Z",
      }),
    { code: "RETENTION_ALREADY_EXPIRED" },
  );
  assert.equal(q.bytes, 0);
});
test("cloud content mismatch retains snapshot as dead letter", async (t) => {
  const f = context(t, { maxAttempts: 1 }),
    q = f.open(),
    cloud = s3Fixture({
      getObject: async () => ({
        VersionId: "version-1",
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: "arn:aws:kms:eu-central-1:123456789012:key/test-key",
        Body: Buffer.from("tampered"),
      }),
    });
  cloudEnqueue(f, q, "aws-s3", cloud.config);
  const failed = await q.runCloudOne(cloudOptions("aws-s3", cloud.port));
  assert.equal(failed.status, "DEAD_LETTER");
  assert.equal(failed.error, "STORAGE_CONTENT_MISMATCH");
  q.close();
  const replay = f.open();
  assert.equal(
    replay.jobs.values().next().value.input.evidence.records.length,
    1,
  );
  assert.equal(replay.status().jobs[0].sealed, false);
});
test("cloud worker process exit after readback resumes the same conditional object", async (t) => {
  const f = context(t),
    q = f.open(),
    cloud = s3Fixture();
  cloudEnqueue(f, q, "aws-s3", cloud.config);
  q.close();
  const saved = files(f),
    objectFile = path.join(f.root, "fake-remote-object.json");
  const modulePath = path.resolve(__dirname, "../storage_jobs.cjs"),
    cliPath = path.resolve(__dirname, "../storage_jobs_cli.cjs"),
    fixturePath = path.resolve(__dirname, "storage-fixtures.cjs");
  const script = `const fs=require('node:fs');const {StorageJobs}=require(${JSON.stringify(modulePath)});const {loadConfig}=require(${JSON.stringify(cliPath)});const {s3Fixture}=require(${JSON.stringify(fixturePath)});const q=new StorageJobs({...loadConfig(process.argv[1]),directory:process.argv[2]});const c=s3Fixture();Object.assign(c.config,q.jobs.values().next().value.input.destination.settings);c.port.putObject=async a=>{fs.writeFileSync(process.argv[3],a.Body,{flag:'wx',mode:0o600});return {VersionId:'version-1'}};c.port.getObject=async()=>({VersionId:'version-1',ServerSideEncryption:'aws:kms',SSEKMSKeyId:c.config.kmsKeyArn,Body:fs.readFileSync(process.argv[3])});const append=q.append.bind(q);q.append=(kind,...args)=>{if(kind==='CLOUD_OBSERVED')process.exit(23);return append(kind,...args)};q.runCloudOne({ports:{'aws-s3':c.port},authorization:{allowCloudWrite:true}}).catch(()=>process.exit(99));`;
  const child = spawnSync(
    process.execPath,
    ["-e", script, saved.configFile, f.options.directory, objectFile],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 23, child.stderr);
  fs.unlinkSync(path.join(f.options.directory, "storage-jobs.lock"));
  const replay = f.open();
  assert.equal(replay.status().jobs[0].status, "WRITING");
  cloud.port.putObject = async () => {
    throw { $metadata: { httpStatusCode: 412 } };
  };
  cloud.port.getObject = async () => ({
    VersionId: "version-1",
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: cloud.config.kmsKeyArn,
    Body: fs.readFileSync(objectFile),
  });
  const done = await replay.runCloudOne(cloudOptions("aws-s3", cloud.port));
  assert.equal(done.status, "CLOUD_OBSERVED");
  assert.equal(done.totalAttempts, 2);
  assert.equal(done.objectVersion, "version-1");
});
