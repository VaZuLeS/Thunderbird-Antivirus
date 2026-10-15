"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { spawnSync } = require("node:child_process"),
  { JSDOM } = require("jsdom");
const { fixture } = require("./alert-review-fixtures.cjs"),
  { Heartbeats } = require("../heartbeats.cjs"),
  { HeartbeatAlerts } = require("../heartbeat_alerts.cjs"),
  { signed, hash } = require("../ledger.cjs"),
  { reviewHtml, project, labels } = require("../heartbeat_alerts_review.cjs");
const parse = (content) =>
  content
    .toString()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
const read = (f) => fs.readFileSync(f.journal),
  source = (f) => fs.readFileSync(f.store.journal.logPath);
const check = (f, alarm = read(f), src = source(f), options = {}) =>
  HeartbeatAlerts.verifyWithSource(alarm, src, { ...f.pub, ...options });
function resign(records, keyId, privateKey) {
  let previousHash = null;
  return records
    .map((r) => {
      const payload = { ...r.payload, previousHash },
        record = signed(payload, keyId, privateKey);
      previousHash = hash(record);
      return JSON.stringify(record) + "\n";
    })
    .join("");
}
function forgedAlarm(f, change) {
  const records = parse(read(f));
  for (const r of records)
    if (r.payload.kind === "HEARTBEATS_OBSERVED") change(r.payload.data);
  const forged = resign(
    records,
    f.pub.signerKeyId,
    f.monitor.journal.privateKey,
  );
  HeartbeatAlerts.verifyJournal(forged, f.pub);
  return forged;
}
test("independent comparison matches historical prefixes, aging and acknowledgement using both public keys", () => {
  const f = fixture();
  try {
    const alarm = read(f),
      src = source(f),
      alarmLock = fs.readFileSync(f.monitor.journal.lockPath),
      sourceLock = fs.readFileSync(f.store.journal.lockPath);
    const r = check(f, alarm, src, {
      expectedHead: f.head,
      expectedSourceHead: f.store.journal.head(),
    });
    assert.equal(r.verification.sourceDeviceEvidenceReverified, true);
    assert.equal(r.verification.headPinned, true);
    assert.equal(r.sourceComparison.sourceHeadPinned, true);
    assert.equal(r.sourceComparison.observationCount, 32);
    assert.equal(r.sourceComparison.deviceComparisonCount, 96);
    assert.equal(r.sourceComparison.sourceActionCount, 11);
    assert.equal(r.sourceComparison.referencedSourceActionCount, 11);
    assert.equal(r.sourceComparison.unreferencedSourceActions, 0);
    assert.deepEqual(r.notifications, f.report.notifications);
    assert.deepEqual(r.devices, f.report.devices);
    assert.equal(r.externalDeliveryVerified, false);
    assert.equal(r.sealed, false);
    assert.deepEqual(read(f), alarm);
    assert.deepEqual(source(f), src);
    assert.deepEqual(fs.readFileSync(f.monitor.journal.lockPath), alarmLock);
    assert.deepEqual(fs.readFileSync(f.store.journal.lockPath), sourceLock);
  } finally {
    f.cleanup();
  }
});
test("source signatures are checked once despite many observations at repeated source prefixes", () => {
  const f = fixture(),
    verify = crypto.verify;
  try {
    let calls = 0;
    crypto.verify = (...args) => {
      calls++;
      return verify(...args);
    };
    check(f);
    assert.equal(calls, parse(read(f)).length + 2 * parse(source(f)).length);
  } finally {
    crypto.verify = verify;
    f.cleanup();
  }
});
test("missing source history, truncated input, forged signatures and JSON snapshot imports are rejected", () => {
  const f = fixture();
  try {
    assert.throws(() => check(f, read(f), ""), /PREFIX_MISSING/);
    assert.throws(
      () =>
        check(
          f,
          read(f),
          parse(source(f))
            .slice(0, 3)
            .map((r) => JSON.stringify(r) + "\n")
            .join(""),
        ),
      /PREFIX_MISSING/,
    );
    assert.throws(
      () => check(f, read(f), source(f).subarray(0, -1)),
      /INCOMPLETE/,
    );
    assert.throws(
      () => check(f, read(f), source(f).toString().replace("1.22.0", "1.20.0")),
      /JOURNAL/,
    );
    assert.throws(
      () => check(f, read(f), JSON.stringify(f.report) + "\n"),
      /JOURNAL/,
    );
    assert.throws(
      () => HeartbeatAlerts.verifyWithSource(read(f), undefined, f.pub),
      /JOURNAL_INPUT_INVALID/,
    );
  } finally {
    f.cleanup();
  }
});
test("both independent external pins and the configured source trust context are enforced", () => {
  const f = fixture();
  try {
    assert.throws(
      () => check(f, read(f), source(f), { expectedHead: "0".repeat(64) }),
      /HEAD_MISMATCH/,
    );
    assert.throws(
      () =>
        check(f, read(f), source(f), { expectedSourceHead: "0".repeat(64) }),
      /HEAD_MISMATCH/,
    );
    assert.throws(
      () =>
        check(f, read(f), source(f), {
          source: {
            ...f.pub.source,
            signerPublicKey: crypto.generateKeyPairSync("ed25519").publicKey,
          },
        }),
      /JOURNAL_ACTION_INVALID/,
    );
    assert.throws(
      () =>
        check(f, read(f), source(f), {
          source: { ...f.pub.source, lateAfterMs: 1100 },
        }),
      /JOURNAL_ACTION_INVALID/,
    );
    assert.throws(
      () =>
        check(f, read(f), source(f), {
          signerPublicKey: f.monitor.journal.privateKey,
        }),
      /PUBLIC_KEY_REQUIRED/,
    );
    assert.throws(
      () =>
        check(f, read(f), source(f), {
          source: {
            ...f.pub.source,
            signerPublicKey: f.store.journal.privateKey,
          },
        }),
      /PUBLIC_KEY_REQUIRED/,
    );
  } finally {
    f.cleanup();
  }
});
test("a signed alarmwriter can lie about an intermediate head while the final head matches; source comparison rejects it", () => {
  const f = fixture();
  try {
    const forged = forgedAlarm(f, (o) => {
      if (o.sourceActionCount === 1) o.sourceHead = "0".repeat(64);
    });
    const report = HeartbeatAlerts.verifyJournal(forged, f.pub);
    assert.equal(report.sourceHead, f.report.sourceHead);
    assert.throws(() => check(f, forged), /HISTORY_HEAD_MISMATCH/);
  } finally {
    f.cleanup();
  }
});
test("signed but false historical device timestamps fail even with matching source heads and valid alarm transitions", () => {
  const f = fixture();
  try {
    const forged = forgedAlarm(f, (o) => {
      for (const d of o.devices)
        if (d.sequence !== null)
          d.observedAt = new Date(Date.parse(d.observedAt) - 1).toISOString();
    });
    assert.throws(() => check(f, forged), /HISTORY_DEVICE_MISMATCH/);
  } finally {
    f.cleanup();
  }
});
test("a valid alternate device journal with identical projected states cannot substitute the referenced chain", () => {
  const f = fixture();
  try {
    const records = parse(source(f)),
      envelope = records[0].payload.data.envelope;
    envelope.payload.brokerReady = false;
    records[0].payload.data.envelope = signed(
      envelope.payload,
      envelope.keyId,
      f.deviceKeys[0].privateKey,
    );
    const branch = resign(
      records,
      f.pub.source.signerKeyId,
      f.store.journal.privateKey,
    );
    const alternative = Heartbeats.verifyJournal(branch, {
      ...f.pub.source,
      now: Date.now(),
    });
    assert.equal(alternative.devices[0].sequence, 11);
    assert.throws(() => check(f, read(f), branch), /HISTORY_HEAD_MISMATCH/);
  } finally {
    f.cleanup();
  }
});
test("even a freshly signed source writer cannot hide an invalid original device signature", () => {
  const f = fixture();
  try {
    const records = parse(source(f));
    records[0].payload.data.envelope.signature = "A".repeat(86);
    const forged = resign(
      records,
      f.pub.source.signerKeyId,
      f.store.journal.privateKey,
    );
    assert.throws(() => check(f, read(f), forged), /JOURNAL_INVALID/);
  } finally {
    f.cleanup();
  }
});
test("additional valid source actions are verified without changing historical alarm states; corrupt unused tails fail", () => {
  const f = fixture();
  try {
    f.advance(1);
    f.accept(12);
    const r = check(f);
    assert.equal(r.sourceComparison.sourceActionCount, 12);
    assert.equal(r.sourceComparison.unreferencedSourceActions, 1);
    assert.equal(r.sourceComparison.referencedSourceActionCount, 11);
    assert.deepEqual(r.devices, f.report.devices);
    const lines = source(f).toString().trimEnd().split("\n");
    lines[lines.length - 1] = lines.at(-1).replace("1.22.0", "1.20.0");
    assert.throws(() => check(f, read(f), lines.join("\n") + "\n"), /JOURNAL/);
  } finally {
    f.cleanup();
  }
});
test("empty journals and never-reported observations never invent verified device contact", () => {
  const f = fixture(true);
  try {
    let r = check(f);
    assert.equal(r.sourceComparison.comparisonComplete, true);
    assert.equal(r.sourceComparison.observationCount, 0);
    assert.equal(r.sourceComparison.deviceComparisonCount, 0);
    assert.equal(r.verification.sourceDeviceEvidenceReverified, false);
    f.monitor.observe(source(f));
    r = check(f);
    assert.equal(r.sourceComparison.observationCount, 1);
    assert.equal(r.sourceComparison.deviceComparisonCount, 3);
    assert.equal(r.sourceComparison.referencedSourceActionCount, 0);
    assert.equal(r.verification.sourceDeviceEvidenceReverified, false);
    f.advance(1);
    f.accept(1);
    r = check(f);
    assert.equal(r.sourceComparison.unreferencedSourceActions, 1);
    assert.equal(r.verification.sourceDeviceEvidenceReverified, false);
    assert.equal(r.counts.NEVER_SEEN, 2);
  } finally {
    f.cleanup();
  }
});
test("checkpoint shape, chronological order, scope, byte and comparison budgets fail explicitly", () => {
  const f = fixture();
  try {
    const checkpoints = parse(read(f))
      .filter((r) => r.payload.kind === "HEARTBEATS_OBSERVED")
      .map((r) => ({
        actionCount: r.payload.data.sourceActionCount,
        head: r.payload.data.sourceHead,
        evaluatedAt: r.payload.data.evaluatedAt,
        devices: r.payload.data.devices,
      }));
    const verify = (c, src = source(f)) =>
      Heartbeats.verifyCheckpoints(src, { ...f.pub.source, checkpoints: c });
    assert.throws(
      () => verify([checkpoints[1], checkpoints[0]]),
      /CHECKPOINT_INVALID/,
    );
    assert.throws(
      () => verify([{ ...checkpoints[0], head: "0".repeat(64) }]),
      /CHECKPOINT_INVALID/,
    );
    assert.throws(
      () =>
        verify([
          {
            ...checkpoints[1],
            evaluatedAt: new Date(
              Date.parse(checkpoints[1].evaluatedAt) - 1,
            ).toISOString(),
          },
        ]),
      /CLOCK_ROLLBACK/,
    );
    assert.throws(
      () => verify(Array(10001).fill(checkpoints[0])),
      /HISTORY_CAPACITY/,
    );
    const c = {
      ...checkpoints[0],
      devices: Array(1000).fill(checkpoints[0].devices[0]),
    };
    assert.throws(() => verify(Array(201).fill(c)), /HISTORY_CAPACITY/);
    assert.throws(
      () => verify([], Buffer.alloc(32 * 1024 * 1024 + 1)),
      /JOURNAL_CAPACITY/,
    );
    assert.throws(
      () =>
        Heartbeats.verifyCheckpoints(source(f), {
          ...f.pub.source,
          checkpoints: [],
          unsafe: true,
        }),
      /OPTION_UNSUPPORTED/,
    );
  } finally {
    f.cleanup();
  }
});
for (const lang of Object.keys(labels))
  test(`source-aware review ${lang} distinguishes full, absent and empty original evidence`, () => {
    const f = fixture(),
      empty = fixture(true);
    let dom, emptyDom;
    try {
      const full = check(f),
        l = labels[lang];
      dom = new JSDOM(reviewHtml(full, lang), { runScripts: "dangerously" });
      const d = dom.window.document;
      assert.ok(
        d.querySelector("header").textContent.includes(l.scopeProofVerified),
      );
      assert.ok(d.querySelector("main").textContent.includes(l.sourceReview));
      assert.ok(!d.querySelector("main").textContent.includes("undefined"));
      const p = project(full);
      assert.equal(p.proof.sourceDeviceEvidenceReverified, true);
      assert.equal(p.sourceComparison.deviceComparisonCount, 96);
      assert.equal(p.notifications.length, 32);
      const raw = structuredClone(full);
      raw.sourceComparison.secret = "SECRET_SENTINEL";
      assert.ok(!JSON.stringify(project(raw)).includes("SECRET_SENTINEL"));
      emptyDom = new JSDOM(reviewHtml(check(empty), lang), {
        runScripts: "dangerously",
      });
      assert.ok(
        emptyDom.window.document
          .querySelector("header")
          .textContent.includes(l.scopeProofEmpty),
      );
      assert.equal(
        project(check(empty)).proof.sourceDeviceEvidenceReverified,
        false,
      );
      assert.throws(
        () =>
          project({
            ...full,
            sourceComparison: {
              ...full.sourceComparison,
              deviceComparisonCount: 999,
            },
          }),
        /REVIEW_INVALID/,
      );
    } finally {
      dom?.window.close();
      emptyDom?.window.close();
      f.cleanup();
      empty.cleanup();
    }
  });
test("source-aware CLI verifies both original files without private keys, overwrites or partial-success fallback", () => {
  const f = fixture();
  try {
    const out = path.join(f.root, "source-review.json"),
      run = (command, ...extra) =>
        spawnSync(
          process.execPath,
          [
            "enterprise/heartbeat_alerts_cli.cjs",
            command,
            "--config",
            f.config,
            "--journal",
            f.journal,
            "--out",
            out,
            ...extra,
          ],
          { encoding: "utf8" },
        ),
      args = [
        "--source-journal",
        f.store.journal.logPath,
        "--expected-source-head",
        f.store.journal.head(),
        "--expected-head",
        f.head,
      ];
    let r = run("verify", ...args);
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(fs.readFileSync(out));
    assert.equal(report.verification.sourceDeviceEvidenceReverified, true);
    assert.equal(fs.statSync(out).mode & 0o777, 0o600);
    assert.equal(run("verify", ...args).status, 1);
    fs.unlinkSync(out);
    r = run("review", ...args, "--lang", "de");
    assert.equal(r.status, 0, r.stderr);
    assert.ok(
      fs.readFileSync(out, "utf8").includes(labels.de.scopeProofVerified),
    );
    fs.unlinkSync(out);
    assert.equal(
      run("verify", "--expected-source-head", f.store.journal.head()).status,
      1,
    );
    assert.equal(
      run("verify", "--source-journal", path.join(f.root, "missing")).status,
      1,
    );
    assert.equal(
      run(
        "verify",
        "--source-journal",
        f.store.journal.logPath,
        "--expected-source-head",
        "0".repeat(64),
      ).status,
      1,
    );
    assert.equal(
      run("review", ...args, "--private-key", "not-allowed").status,
      1,
    );
    assert.ok(!fs.existsSync(out));
    const corrupt = path.join(f.root, "bad-source.jsonl");
    fs.writeFileSync(corrupt, source(f).toString().replace("1.22.0", "1.20.0"));
    assert.equal(run("review", "--source-journal", corrupt).status, 1);
    assert.ok(!fs.existsSync(out));
    assert.equal(f.monitor.pending().length, 29);
  } finally {
    f.cleanup();
  }
});
