"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { Ledger, signed, hash } = require("../ledger.cjs");
const { Witness } = require("../witness.cjs");
const {
  verifyRecords,
  makeCheckpoint,
  verifyEvidence,
  sourceId,
} = require("../evidence.cjs");
const copy = (value) => JSON.parse(JSON.stringify(value));
function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-evidence-")),
    server = crypto.generateKeyPairSync("ed25519"),
    device = crypto.generateKeyPairSync("ed25519"),
    witnessKeys = crypto.generateKeyPairSync("ed25519");
  let now = Date.now();
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
    clock: () => now,
  });
  const witnessConfig = {
    directory: path.join(root, "witness"),
    witnessKeyId: "witness-1",
    witnessPrivateKey: witnessKeys.privateKey,
    serverKeyId: "server-1",
    serverPublicKey: server.publicKey,
    clock: () => now,
    ...options,
  };
  let witness = new Witness(witnessConfig),
    sequence = 0;
  const interactionId = crypto.randomUUID();
  const emit = (changes = {}) =>
    ledger.accept(
      signed(
        {
          schemaVersion: 2,
          eventId: crypto.randomUUID(),
          interactionId,
          deviceId: registration.deviceId,
          streamEpoch: registration.streamEpoch,
          sequence: ++sequence,
          observedAt: new Date(now).toISOString(),
          kind: sequence === 1 ? "CLICKED" : "ASSESSMENT",
          outcome: null,
          attemptNumber: 0,
          policyId: registration.policyId,
          policyVersion: 1,
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
          ...changes,
        },
        registration.keyId,
        device.privateKey,
      ),
    );
  const data = () => ({
      kind: "thundy-staged-journal-export",
      schemaVersion: 1,
      records: ledger.exportRecords(),
    }),
    trust = {
      serverPublicKey: server.publicKey,
      serverKeyId: "server-1",
      registrations: [registration],
    };
  const checkpoint = (exportData = data()) =>
    makeCheckpoint(exportData, {
      serverPrivateKey: server.privateKey,
      serverKeyId: "server-1",
      now,
      registrations: [registration],
    });
  return {
    root,
    server,
    device,
    registration,
    ledger,
    trust,
    witnessKeys,
    witnessConfig,
    emit,
    data,
    checkpoint,
    get witness() {
      return witness;
    },
    get now() {
      return now;
    },
    advance: (ms) => (now += ms),
    restart() {
      witness.close();
      witness = new Witness(witnessConfig);
      return witness;
    },
    cleanup() {
      ledger.close();
      witness.close();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
const anchoredOptions = (f, result) => ({
  ...f.trust,
  witnessAnchor: result.anchor,
  witnessPublicKey: f.witnessKeys.publicKey,
  expectedAnchorHash: result.anchorHash,
});

test("full offline verification checks server and optional device signatures without claiming completeness", () => {
  const f = fixture();
  try {
    f.emit();
    f.emit();
    let report = verifyEvidence(f.data(), f.trust);
    assert.equal(report.entryCount, 2);
    assert.equal(report.deviceSignaturesVerified, true);
    assert.equal(report.witnessVerified, false);
    assert.equal(report.completeSnapshotWitnessed, false);
    assert.equal(report.sealed, false);
    report = verifyEvidence(f.data(), { serverPublicKey: f.server.publicKey });
    assert.equal(report.deviceSignaturesVerified, false);
    assert.equal(report.entryCount, 2);
  } finally {
    f.cleanup();
  }
});

test("independently pinned witness verifies a complete snapshot and catches valid tail truncation", () => {
  const f = fixture();
  try {
    f.emit();
    f.emit();
    const result = f.witness.append(f.data(), f.checkpoint(), {
        expectedHead: "genesis",
        registrations: [f.registration],
      }),
      options = anchoredOptions(f, result);
    const report = verifyEvidence(f.data(), options);
    assert.equal(report.completeSnapshotWitnessed, true);
    assert.equal(report.anchoredEntryCount, 2);
    assert.equal(report.sealed, false);
    const shortened = f.data();
    shortened.records.pop();
    assert.equal(verifyEvidence(shortened, f.trust).entryCount, 1);
    assert.throws(
      () => verifyEvidence(shortened, options),
      /EVIDENCE_TRUNCATED_OR_WRONG_SOURCE/,
    );
  } finally {
    f.cleanup();
  }
});

test("changed, omitted, duplicated and reordered records fail verification", () => {
  const f = fixture();
  try {
    f.emit();
    f.emit();
    f.emit();
    const changed = f.data();
    changed.records[1].eventEnvelope.payload.urlRedacted =
      "https://changed.example";
    assert.throws(() => verifyEvidence(changed, f.trust));
    const omitted = f.data();
    omitted.records.splice(1, 1);
    assert.throws(
      () => verifyEvidence(omitted, f.trust),
      /EVIDENCE_RECEIPT_INVALID/,
    );
    const duplicated = f.data();
    duplicated.records.push(duplicated.records[2]);
    assert.throws(() => verifyEvidence(duplicated, f.trust));
    const reordered = f.data();
    [reordered.records[0], reordered.records[1]] = [
      reordered.records[1],
      reordered.records[0],
    ];
    assert.throws(() => verifyEvidence(reordered, f.trust));
  } finally {
    f.cleanup();
  }
});

test("signed but semantically invalid server attestations cannot pass full verification", () => {
  const f = fixture();
  try {
    f.emit();
    const data = f.data(),
      record = data.records[0];
    record.eventEnvelope.payload.kind = "DECISION";
    record.eventEnvelope.payload.outcome = "OPENED";
    record.eventEnvelope.payload.attemptNumber = 1;
    record.eventEnvelope = signed(
      record.eventEnvelope.payload,
      f.registration.keyId,
      f.device.privateKey,
    );
    record.receipt = signed(
      {
        ...record.receipt.payload,
        payloadHash: hash(record.eventEnvelope.payload),
        envelopeHash: hash(record.eventEnvelope),
      },
      "server-1",
      f.server.privateKey,
    );
    assert.throws(
      () => verifyEvidence(data, f.trust),
      /INTERACTION_CLICK_REQUIRED/,
    );
  } finally {
    f.cleanup();
  }
});

test("witness advances only from its pinned head and proves extension of the older prefix", () => {
  const f = fixture();
  try {
    f.emit();
    const first = f.witness.append(f.data(), f.checkpoint(), {
      expectedHead: "genesis",
    });
    f.advance(1000);
    f.emit();
    const second = f.witness.append(f.data(), f.checkpoint(), {
      expectedHead: first.anchorHash,
    });
    assert.equal(second.anchor.payload.anchorIndex, 2);
    assert.equal(second.anchor.payload.previousWitnessHash, first.anchorHash);
    f.restart();
    assert.equal(f.witness.head(), second.anchorHash);
    assert.throws(
      () =>
        f.witness.append(f.data(), f.checkpoint(), { expectedHead: "genesis" }),
      /WITNESS_EXPECTED_HEAD_MISMATCH/,
    );
  } finally {
    f.cleanup();
  }
});

test("forks signed with the server key still cannot extend an already witnessed prefix", () => {
  const f = fixture();
  try {
    f.emit();
    const first = f.witness.append(f.data(), f.checkpoint(), {
      expectedHead: "genesis",
    });
    f.emit();
    const fork = f.data();
    let previous = null;
    for (const record of fork.records) {
      record.eventEnvelope.payload.urlRedacted = "https://fork.example";
      record.eventEnvelope = signed(
        record.eventEnvelope.payload,
        f.registration.keyId,
        f.device.privateKey,
      );
      record.receipt = signed(
        {
          ...record.receipt.payload,
          payloadHash: hash(record.eventEnvelope.payload),
          envelopeHash: hash(record.eventEnvelope),
          previousReceiptHash: previous,
        },
        "server-1",
        f.server.privateKey,
      );
      previous = hash(record.receipt);
    }
    assert.equal(verifyRecords(fork, f.trust).entryCount, 2);
    assert.throws(
      () =>
        f.witness.append(fork, f.checkpoint(fork), {
          expectedHead: first.anchorHash,
        }),
      /EVIDENCE_FORK_OR_CHECKPOINT_MISMATCH/,
    );
  } finally {
    f.cleanup();
  }
});

test("old valid anchors cannot replace the separately pinned latest witness hash", () => {
  const f = fixture();
  try {
    f.emit();
    const first = f.witness.append(f.data(), f.checkpoint(), {
      expectedHead: "genesis",
    });
    f.emit();
    const second = f.witness.append(f.data(), f.checkpoint(), {
      expectedHead: first.anchorHash,
    });
    assert.throws(
      () =>
        verifyEvidence(f.data(), {
          ...anchoredOptions(f, first),
          expectedAnchorHash: second.anchorHash,
        }),
      /WITNESS_HEAD_MISMATCH/,
    );
  } finally {
    f.cleanup();
  }
});

test("a newer export needs explicit prefix mode and exposes the unanchored suffix", () => {
  const f = fixture();
  try {
    f.emit();
    const first = f.witness.append(f.data(), f.checkpoint(), {
      expectedHead: "genesis",
    });
    f.emit();
    const options = anchoredOptions(f, first);
    assert.throws(
      () => verifyEvidence(f.data(), options),
      /EVIDENCE_SNAPSHOT_COUNT_MISMATCH/,
    );
    const report = verifyEvidence(f.data(), {
      ...options,
      allowExtension: true,
    });
    assert.equal(report.anchoredEntryCount, 1);
    assert.equal(report.unanchoredSuffixCount, 1);
    assert.equal(report.completeSnapshotWitnessed, false);
  } finally {
    f.cleanup();
  }
});

test("self-provided or incomplete witness trust and wrong public keys are rejected", () => {
  const f = fixture();
  try {
    f.emit();
    const first = f.witness.append(f.data(), f.checkpoint(), {
      expectedHead: "genesis",
    });
    assert.throws(
      () =>
        verifyEvidence(f.data(), { ...f.trust, witnessAnchor: first.anchor }),
      /WITNESS_TRUST_INCOMPLETE/,
    );
    const wrong = crypto.generateKeyPairSync("ed25519");
    assert.throws(
      () =>
        verifyEvidence(f.data(), {
          ...anchoredOptions(f, first),
          witnessPublicKey: wrong.publicKey,
        }),
      /SIGNATURE_INVALID/,
    );
    assert.throws(
      () =>
        verifyEvidence(f.data(), {
          ...f.trust,
          serverPublicKey: wrong.publicKey,
        }),
      /SIGNATURE_INVALID/,
    );
    assert.throws(
      () =>
        verifyEvidence(f.data(), {
          ...anchoredOptions(f, first),
          serverKeyId: "other-server",
        }),
      /EVIDENCE_SERVER_KEY_ID_MISMATCH/,
    );
  } finally {
    f.cleanup();
  }
});

test("witness log tail rollback is detected by the expected external head", () => {
  const f = fixture();
  try {
    f.emit();
    const first = f.witness.append(f.data(), f.checkpoint(), {
      expectedHead: "genesis",
    });
    f.emit();
    const second = f.witness.append(f.data(), f.checkpoint(), {
      expectedHead: first.anchorHash,
    });
    f.witness.close();
    const line = fs.readFileSync(f.witness.logPath, "utf8").split("\n")[0];
    fs.writeFileSync(f.witness.logPath, line + "\n");
    f.restart();
    assert.throws(
      () =>
        f.witness.append(f.data(), f.checkpoint(), {
          expectedHead: second.anchorHash,
        }),
      /WITNESS_EXPECTED_HEAD_MISMATCH/,
    );
  } finally {
    f.cleanup();
  }
});

test("lost witness response replays exactly the original anchor without a second append", () => {
  const f = fixture();
  try {
    f.emit();
    const checkpoint = f.checkpoint(),
      first = f.witness.append(f.data(), checkpoint, {
        expectedHead: "genesis",
      });
    f.restart();
    const second = f.witness.append(f.data(), checkpoint, {
      expectedHead: "genesis",
    });
    assert.equal(second.duplicate, true);
    assert.deepEqual(second.anchor, first.anchor);
    assert.equal(f.witness.anchors.length, 1);
  } finally {
    f.cleanup();
  }
});

test("witness fsync failure yields no acknowledgement and recovery supports the same request", () => {
  let fail = false;
  const io = {
      ...fs,
      fsyncSync: (fd) => {
        if (fail) throw new Error("disk");
        fs.fsyncSync(fd);
      },
    },
    f = fixture({ io });
  try {
    f.emit();
    const cp = f.checkpoint();
    fail = true;
    assert.throws(
      () => f.witness.append(f.data(), cp, { expectedHead: "genesis" }),
      /WITNESS_STORAGE_FAILED/,
    );
    assert.throws(
      () => f.witness.append(f.data(), cp, { expectedHead: "genesis" }),
      /WITNESS_UNAVAILABLE/,
    );
    fail = false;
    f.restart();
    const recovered = f.witness.append(f.data(), cp, {
      expectedHead: "genesis",
    });
    assert.equal(recovered.duplicate, true);
    assert.equal(f.witness.anchors.length, 1);
  } finally {
    f.cleanup();
  }
});

test("witness exclusive lock, damaged tail, capacity and private permissions fail safely", () => {
  const f = fixture();
  try {
    assert.throws(() => new Witness(f.witnessConfig), /WITNESS_LOCKED/);
    f.emit();
    f.witness.append(f.data(), f.checkpoint(), { expectedHead: "genesis" });
    f.witness.close();
    const original = fs.readFileSync(f.witness.logPath, "utf8");
    fs.appendFileSync(f.witness.logPath, "partial");
    assert.throws(() => new Witness(f.witnessConfig), /WITNESS_LOG_INCOMPLETE/);
    fs.writeFileSync(f.witness.logPath, original);
    fs.chmodSync(f.witnessConfig.directory, 0o755);
    assert.throws(
      () => new Witness(f.witnessConfig),
      /PRIVATE_WITNESS_DIRECTORY_REQUIRED/,
    );
    fs.chmodSync(f.witnessConfig.directory, 0o700);
  } finally {
    f.cleanup();
  }
  const small = fixture({ maxBytes: 10 });
  try {
    small.emit();
    assert.throws(
      () =>
        small.witness.append(small.data(), small.checkpoint(), {
          expectedHead: "genesis",
        }),
      /WITNESS_CAPACITY/,
    );
    assert.equal(small.witness.anchors.length, 0);
  } finally {
    small.cleanup();
  }
});

test("an empty snapshot is explicit and witness attestations never become SEALED evidence", () => {
  const f = fixture();
  try {
    const first = f.witness.append(f.data(), f.checkpoint(), {
        expectedHead: "genesis",
      }),
      report = verifyEvidence(f.data(), anchoredOptions(f, first));
    assert.equal(report.entryCount, 0);
    assert.equal(report.anchoredEntryCount, 0);
    assert.equal(report.sealed, false);
    assert.equal(report.evidenceStatus, "STAGED");
    assert.equal(report.completeSnapshotWitnessed, true);
    assert.equal(report.sourceId, sourceId(f.server.publicKey));
  } finally {
    f.cleanup();
  }
});

test("CLI checkpoint, independent witness and anchored verification detect a shortened valid export", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-anchor-cli-")),
    directory = path.join(root, "service"),
    witnessDir = path.join(root, "independent-witness"),
    exportPath = path.join(root, "events.json"),
    checkpointPath = path.join(root, "checkpoint.json"),
    anchorPath = path.join(root, "anchor.json");
  const run = (script, args) =>
    spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  try {
    assert.equal(
      run("enterprise/local.cjs", ["init", "--data-dir", directory]).status,
      0,
    );
    assert.equal(
      run("enterprise/local.cjs", ["demo", "--data-dir", directory]).status,
      0,
    );
    assert.equal(
      run("enterprise/local.cjs", [
        "export",
        "--data-dir",
        directory,
        "--out",
        exportPath,
      ]).status,
      0,
    );
    assert.equal(
      run("enterprise/local.cjs", [
        "checkpoint",
        "--data-dir",
        directory,
        "--out",
        checkpointPath,
      ]).status,
      0,
    );
    assert.equal(
      run("enterprise/witness_cli.cjs", [
        "init",
        "--directory",
        witnessDir,
        "--server-public-key",
        path.join(directory, "server-public.pem"),
        "--server-key-id",
        "local-server-1",
      ]).status,
      0,
    );
    const appended = run("enterprise/witness_cli.cjs", [
      "append",
      "--directory",
      witnessDir,
      "--export",
      exportPath,
      "--checkpoint",
      checkpointPath,
      "--expected-head",
      "genesis",
      "--out",
      anchorPath,
      "--registry",
      path.join(directory, "config.json"),
    ]);
    assert.equal(appended.status, 0);
    const anchorHash = JSON.parse(appended.stdout).anchorHash;
    const args = [
      "verify",
      "--out",
      exportPath,
      "--public-key",
      path.join(directory, "server-public.pem"),
      "--server-key-id",
      "local-server-1",
      "--registry",
      path.join(directory, "config.json"),
      "--witness-anchor",
      anchorPath,
      "--witness-public-key",
      path.join(witnessDir, "witness-public.pem"),
      "--expected-anchor-hash",
      anchorHash,
    ];
    const checked = run("enterprise/local.cjs", args);
    assert.equal(checked.status, 0);
    assert.equal(JSON.parse(checked.stdout).completeSnapshotWitnessed, true);
    const truncated = JSON.parse(fs.readFileSync(exportPath));
    truncated.records.pop();
    fs.writeFileSync(exportPath, JSON.stringify(truncated));
    assert.notEqual(run("enterprise/local.cjs", args).status, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("modified witness anchors, wrong-source checkpoints and incomplete prefix trust are rejected", () => {
  const f = fixture();
  try {
    f.emit();
    const result = f.witness.append(f.data(), f.checkpoint(), {
        expectedHead: "genesis",
      }),
      changed = copy(result.anchor);
    changed.payload.checkpoint.payload.entryCount = 0;
    assert.throws(
      () =>
        verifyEvidence(f.data(), {
          ...anchoredOptions(f, result),
          witnessAnchor: changed,
        }),
      /WITNESS_HEAD_MISMATCH/,
    );
    assert.throws(
      () => verifyEvidence(f.data(), { ...f.trust, allowExtension: true }),
      /EVIDENCE_PREFIX_REQUIRES_WITNESS/,
    );
    const cp = f.checkpoint();
    const forged = signed(
      { ...cp.payload, sourceId: "0".repeat(64) },
      "server-1",
      f.server.privateKey,
    );
    assert.throws(
      () =>
        f.witness.append(f.data(), forged, { expectedHead: result.anchorHash }),
      /CHECKPOINT_INVALID/,
    );
  } finally {
    f.cleanup();
  }
});

test("witness clock rollback and invalid checkpoint time cannot advance a pinned log", () => {
  const f = fixture();
  try {
    f.emit();
    const first = f.witness.append(f.data(), f.checkpoint(), {
      expectedHead: "genesis",
    });
    f.advance(-1000);
    f.emit({ observedAt: new Date(f.now + 1000).toISOString() });
    assert.throws(
      () =>
        f.witness.append(f.data(), f.checkpoint(), {
          expectedHead: first.anchorHash,
        }),
      /WITNESS_ROLLBACK_OR_TIME_INVALID/,
    );
  } finally {
    f.cleanup();
  }
  const future = fixture();
  try {
    future.emit();
    const cp = future.checkpoint(),
      forged = signed(
        {
          ...cp.payload,
          createdAt: new Date(future.now + 180000).toISOString(),
        },
        "server-1",
        future.server.privateKey,
      );
    assert.throws(
      () =>
        future.witness.append(future.data(), forged, {
          expectedHead: "genesis",
        }),
      /WITNESS_SERVER_TIME_INVALID/,
    );
  } finally {
    future.cleanup();
  }
});

test("short witness writes complete before acknowledgement and a process crash retains its anchor", () => {
  const io = {
      ...fs,
      writeSync: (fd, buffer, offset, length) =>
        fs.writeSync(fd, buffer, offset, Math.min(length, 23)),
    },
    f = fixture({ io });
  try {
    f.emit();
    const first = f.witness.append(f.data(), f.checkpoint(), {
      expectedHead: "genesis",
    });
    f.restart();
    assert.equal(f.witness.head(), first.anchorHash);
    f.witness.close();
    const config = {
      directory: f.witnessConfig.directory,
      witnessKeyId: "witness-1",
      witnessPrivateKey: f.witnessKeys.privateKey.export({
        type: "pkcs8",
        format: "pem",
      }),
      serverKeyId: "server-1",
      serverPublicKey: f.server.publicKey.export({
        type: "spki",
        format: "pem",
      }),
    };
    f.advance(1000);
    f.emit();
    const script =
      "const fs=require('fs');const {Witness}=require('./enterprise/witness.cjs');const input=JSON.parse(fs.readFileSync(0,'utf8'));const witness=new Witness(input.config);console.log(JSON.stringify(witness.append(input.data,input.checkpoint,{expectedHead:input.head})));process.exit(0);";
    const child = spawnSync(process.execPath, ["-e", script], {
      input: JSON.stringify({
        config,
        data: f.data(),
        checkpoint: f.checkpoint(),
        head: first.anchorHash,
      }),
      encoding: "utf8",
    });
    assert.equal(child.status, 0);
    const acknowledged = JSON.parse(child.stdout);
    assert.throws(() => new Witness(f.witnessConfig), /WITNESS_LOCKED/);
    fs.unlinkSync(f.witness.lockPath);
    f.restart();
    assert.equal(f.witness.head(), acknowledged.anchorHash);
  } finally {
    f.cleanup();
  }
});

test("CLI cannot silently skip an explicitly supplied malformed device registry", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-registry-check-"));
  try {
    const file = path.join(root, "registry.json");
    fs.writeFileSync(file, "{}");
    assert.throws(
      () => require("../witness_cli.cjs").readRegistry(file),
      /REGISTRY_INVALID/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("verification-only trust flags cannot be silently ignored by other CLI commands", () => {
  const run = (script, args) =>
    spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  let result = run("enterprise/local.cjs", [
    "review",
    "--witness-anchor",
    "unused.json",
    "--out",
    "unused.html",
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /OPTION_NOT_SUPPORTED/);
  result = run("enterprise/witness_cli.cjs", [
    "init",
    "--directory",
    "unused-directory",
    "--expected-head",
    "genesis",
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /OPTION_NOT_SUPPORTED/);
});
