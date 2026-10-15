"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  canonicalize = require("canonicalize"),
  { spawnSync } = require("node:child_process"),
  { JSDOM } = require("jsdom");
const { fixture } = require("./alert-review-fixtures.cjs"),
  {
    createPackage,
    verifyPackage,
    MAX_BYTES,
  } = require("../review_package.cjs"),
  { reviewHtml, project, labels } = require("../heartbeat_alerts_review.cjs");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex"),
  encode = (p) => Buffer.from(canonicalize(p) + "\n");
const make = (f) =>
  createPackage(
    fs.readFileSync(f.journal),
    fs.readFileSync(f.store.journal.logPath),
    { trustedContext: f.pub },
  );
const check = (f, b, options = {}) =>
  verifyPackage(b, { trustedContext: f.pub, ...options });
function mutate(b, fn) {
  const p = JSON.parse(b);
  fn(p);
  return encode(p);
}
function replace(p, i, bytes) {
  p.files[i].data = bytes.toString("base64");
  p.manifest.entries[i].bytes = bytes.length;
  p.manifest.entries[i].sha256 = sha(bytes);
}
test("deterministic package preserves exact original bytes and includes only a portable public context", () => {
  const f = fixture();
  try {
    const alarm = fs.readFileSync(f.journal),
      source = Buffer.concat([
        fs.readFileSync(f.store.journal.logPath),
        Buffer.from("\n"),
      ]),
      b = createPackage(alarm, source, { trustedContext: f.pub }),
      p = JSON.parse(b);
    assert.deepEqual(
      b,
      createPackage(alarm, source, { trustedContext: f.pub }),
    );
    assert.equal(p.files.length, 3);
    assert.deepEqual(Buffer.from(p.files[0].data, "base64"), alarm);
    assert.deepEqual(Buffer.from(p.files[1].data, "base64"), source);
    const context = Buffer.from(p.files[2].data, "base64").toString();
    assert.ok(!context.includes(f.root));
    assert.ok(!context.includes("PRIVATE KEY"));
    assert.ok(!context.includes("registryFile"));
    assert.equal(JSON.parse(context).context.source.registrations.length, 3);
    const report = check(f, b, {
      expectedPackageHash: sha(b),
      expectedHead: f.head,
      expectedSourceHead: f.store.journal.head(),
    });
    assert.equal(report.verification.sourceDeviceEvidenceReverified, true);
    assert.equal(report.packageVerification.externalConfigurationMatched, true);
    assert.equal(report.packageVerification.packageHashPinned, true);
    assert.equal(
      report.packageVerification.embeddedKeysTrustedAutomatically,
      false,
    );
    assert.equal(report.packageVerification.extracted, false);
    assert.equal(report.sealed, false);
    assert.deepEqual(report.notifications, f.report.notifications);
  } finally {
    f.cleanup();
  }
});
test("independent public trust is mandatory even when a package hash is supplied", () => {
  const f = fixture(),
    other = fixture();
  try {
    const b = make(f);
    assert.throws(() => verifyPackage(b), /TRUST_REQUIRED/);
    assert.throws(
      () => verifyPackage(b, { expectedPackageHash: sha(b) }),
      /TRUST_REQUIRED/,
    );
    assert.throws(
      () => verifyPackage(b, { trustedContext: other.pub }),
      /TRUST_MISMATCH/,
    );
    assert.throws(
      () => check(f, b, { expectedPackageHash: "0".repeat(64) }),
      /HASH_MISMATCH/,
    );
    assert.throws(
      () => check(f, b, { expectedPackageHash: "invalid" }),
      /PIN_INVALID/,
    );
    assert.throws(
      () => check(f, b, { expectedHead: "0".repeat(64) }),
      /HEAD_MISMATCH/,
    );
    assert.throws(
      () => check(f, b, { expectedSourceHead: "0".repeat(64) }),
      /HEAD_MISMATCH/,
    );
  } finally {
    f.cleanup();
    other.cleanup();
  }
});
test("rehashing substituted embedded keys or configuration cannot replace the trusted reference", () => {
  const f = fixture();
  try {
    const b = make(f),
      changed = mutate(b, (p) => {
        const c = JSON.parse(Buffer.from(p.files[2].data, "base64"));
        c.context.signerPublicKey = c.context.source.signerPublicKey;
        replace(p, 2, encode(c));
      });
    assert.throws(() => check(f, changed), /TRUST_MISMATCH/);
    const policy = mutate(b, (p) => {
      const c = JSON.parse(Buffer.from(p.files[2].data, "base64"));
      c.context.cooldownMs++;
      replace(p, 2, encode(c));
    });
    assert.throws(() => check(f, policy), /TRUST_MISMATCH/);
  } finally {
    f.cleanup();
  }
});
test("private keys and extra credential/configuration fields are rejected rather than packaged", () => {
  const f = fixture();
  try {
    assert.throws(
      () =>
        createPackage("", "", {
          trustedContext: {
            ...f.pub,
            signerPublicKey: f.monitor.journal.privateKey,
          },
        }),
      /PUBLIC_KEY_REQUIRED/,
    );
    assert.throws(
      () =>
        createPackage("", "", {
          trustedContext: { ...f.pub, secret: "SECRET_SENTINEL" },
        }),
      /CONTEXT_INVALID/,
    );
    assert.throws(
      () =>
        createPackage("", "", {
          trustedContext: {
            ...f.pub,
            source: {
              ...f.pub.source,
              signerPublicKey: f.store.journal.privateKey,
            },
          },
        }),
      /PUBLIC_KEY_REQUIRED/,
    );
    const b = make(f),
      bad = mutate(b, (p) => {
        const c = JSON.parse(Buffer.from(p.files[2].data, "base64"));
        c.context.source.registrations[0].publicKey =
          f.deviceKeys[0].privateKey.export({ type: "pkcs8", format: "pem" });
        replace(p, 2, encode(c));
      });
    assert.throws(() => check(f, bad), /REGISTRY_INVALID/);
  } finally {
    f.cleanup();
  }
});
test("fixed entry paths reject traversal, absolute paths, aliases, duplicates and extra files without extraction", () => {
  const f = fixture();
  try {
    const b = make(f),
      before = fs.readdirSync(f.root);
    for (const name of [
      "../escape",
      "/tmp/escape",
      "C:\\escape",
      "alarms/../escape",
      "%2e%2e/escape",
      "__proto__",
    ]) {
      const bad = mutate(b, (p) => {
        p.files[0].path = name;
        p.manifest.entries[0].path = name;
      });
      assert.throws(() => check(f, bad), /ENTRY_INVALID/);
    }
    assert.throws(
      () =>
        check(
          f,
          mutate(b, (p) => {
            p.files[1].path = p.files[0].path;
            p.manifest.entries[1].path = p.manifest.entries[0].path;
          }),
        ),
      /ENTRY_INVALID/,
    );
    assert.throws(
      () =>
        check(
          f,
          mutate(b, (p) => {
            p.files.push(p.files[0]);
            p.manifest.entries.push(p.manifest.entries[0]);
          }),
        ),
      /FORMAT_INVALID/,
    );
    assert.deepEqual(fs.readdirSync(f.root), before);
  } finally {
    f.cleanup();
  }
});
test("canonical container encoding rejects duplicate JSON keys and ambiguous serializations", () => {
  const f = fixture();
  try {
    const b = make(f);
    assert.throws(
      () => check(f, Buffer.concat([b, Buffer.from("\n")])),
      /CANONICAL_REQUIRED/,
    );
    assert.throws(
      () => check(f, '{"schemaVersion":1,' + b.toString().slice(1)),
      /CANONICAL_REQUIRED/,
    );
    assert.throws(
      () => check(f, JSON.stringify(JSON.parse(b), null, 2) + "\n"),
      /CANONICAL_REQUIRED/,
    );
    assert.throws(() => check(f, "not-json"), /JSON_INVALID/);
  } finally {
    f.cleanup();
  }
});
test("entry hashes, lengths and canonical base64 are checked before journal use", () => {
  const f = fixture();
  try {
    const b = make(f);
    assert.throws(
      () =>
        check(
          f,
          mutate(b, (p) => {
            const bytes = Buffer.from(p.files[0].data, "base64");
            bytes[3] ^= 1;
            p.files[0].data = bytes.toString("base64");
          }),
        ),
      /ENTRY_HASH_MISMATCH/,
    );
    assert.throws(
      () =>
        check(
          f,
          mutate(b, (p) => (p.files[0].data = "?" + p.files[0].data.slice(1))),
        ),
      /ENCODING_INVALID/,
    );
    assert.throws(
      () =>
        check(
          f,
          mutate(b, (p) => {
            p.files[0].data = "YR==";
            p.manifest.entries[0].bytes = 1;
            p.manifest.entries[0].sha256 = sha(Buffer.from("a"));
          }),
        ),
      /ENCODING_INVALID/,
    );
    assert.throws(
      () =>
        check(
          f,
          mutate(b, (p) => p.manifest.entries[0].bytes++),
        ),
      /ENCODING_INVALID/,
    );
    assert.throws(
      () =>
        check(
          f,
          mutate(b, (p) => (p.files[0].encoding = "gzip")),
        ),
      /ENTRY_INVALID/,
    );
    const deep = "[".repeat(20000) + "0" + "]".repeat(20000);
    const raw = b
      .toString()
      .replace(JSON.stringify(JSON.parse(b).files[0].data), deep);
    assert.throws(() => check(f, raw), /ENTRY_INVALID/);
  } finally {
    f.cleanup();
  }
});
test("consistent file hashes do not hide invalid signatures or false manifest heads", () => {
  const f = fixture();
  try {
    const b = make(f),
      bad = mutate(b, (p) =>
        replace(
          p,
          1,
          Buffer.from(
            Buffer.from(p.files[1].data, "base64")
              .toString()
              .replace("1.22.0", "1.20.0"),
          ),
        ),
      );
    assert.throws(() => check(f, bad), /JOURNAL/);
    assert.throws(
      () =>
        check(
          f,
          mutate(b, (p) => (p.manifest.alarmHead = "0".repeat(64))),
        ),
      /MANIFEST_MISMATCH/,
    );
    assert.throws(
      () =>
        check(
          f,
          mutate(b, (p) => (p.manifest.sourceHead = "0".repeat(64))),
        ),
      /MANIFEST_MISMATCH/,
    );
  } finally {
    f.cleanup();
  }
});
test("externally pinned package or journal heads detect a valid jointly shortened package", () => {
  const f = fixture();
  try {
    const full = make(f),
      first = fs.readFileSync(f.journal, "utf8").split("\n")[0] + "\n",
      short = createPackage(first, "", { trustedContext: f.pub });
    assert.equal(
      check(f, short).verification.sourceDeviceEvidenceReverified,
      false,
    );
    assert.equal(check(f, short).packageVerification.packageHashPinned, false);
    assert.throws(
      () => check(f, short, { expectedPackageHash: sha(full) }),
      /HASH_MISMATCH/,
    );
    assert.throws(
      () => check(f, short, { expectedHead: f.head }),
      /HEAD_MISMATCH/,
    );
  } finally {
    f.cleanup();
  }
});
test("entry and total byte budgets reject oversized packages without decompression", () => {
  const f = fixture(true);
  try {
    const b = make(f);
    assert.throws(
      () =>
        check(
          f,
          mutate(
            b,
            (p) => (p.manifest.entries[0].bytes = 32 * 1024 * 1024 + 1),
          ),
        ),
      /ENTRY_INVALID/,
    );
    assert.throws(
      () =>
        check(
          f,
          mutate(b, (p) => (p.manifest.entries[2].bytes = 2 * 1024 * 1024 + 1)),
        ),
      /ENTRY_INVALID/,
    );
    assert.throws(() => check(f, Buffer.alloc(MAX_BYTES + 1)), /CAPACITY/);
    assert.throws(
      () =>
        createPackage(Buffer.alloc(32 * 1024 * 1024 + 1), "", {
          trustedContext: f.pub,
        }),
      /CAPACITY/,
    );
  } finally {
    f.cleanup();
  }
});
for (const lang of Object.keys(labels))
  test(`package review ${lang}: external trust, hash pin and empty evidence remain distinct`, () => {
    const f = fixture(),
      empty = fixture(true);
    let dom, emptyDom;
    try {
      const b = make(f),
        report = check(f, b, { expectedPackageHash: sha(b) }),
        l = labels[lang];
      dom = new JSDOM(reviewHtml(report, lang), { runScripts: "dangerously" });
      const d = dom.window.document;
      assert.ok(d.querySelector("main").textContent.includes(l.packageTitle));
      assert.ok(d.querySelector("main").textContent.includes(l.packagePinned));
      assert.ok(
        d.querySelector("footer").textContent.includes(l.packageHeadsPinned),
      );
      assert.ok(!d.querySelector("main").textContent.includes("undefined"));
      const altered = structuredClone(report);
      altered.packageVerification.credential = "SECRET_SENTINEL";
      assert.ok(!JSON.stringify(project(altered)).includes("SECRET_SENTINEL"));
      assert.equal(project(report).packageVerification.packageHash, sha(b));
      assert.throws(
        () =>
          project({
            ...report,
            packageVerification: {
              ...report.packageVerification,
              embeddedKeysTrustedAutomatically: true,
            },
          }),
        /REVIEW_INVALID/,
      );
      const er = check(empty, make(empty));
      emptyDom = new JSDOM(reviewHtml(er, lang), { runScripts: "dangerously" });
      assert.ok(
        emptyDom.window.document
          .querySelector("main")
          .textContent.includes(l.packageUnpinned),
      );
      assert.ok(
        emptyDom.window.document
          .querySelector("header")
          .textContent.includes(l.scopeProofEmpty),
      );
      assert.equal(er.verification.sourceDeviceEvidenceReverified, false);
    } finally {
      dom?.window.close();
      emptyDom?.window.close();
      f.cleanup();
      empty.cleanup();
    }
  });
test("CLI creates a private portable package, verifies after original journals move, and never overwrites outputs", () => {
  const f = fixture();
  try {
    const file = (n) => path.join(f.root, n),
      bundle = file("review-package.json"),
      out = file("review.json"),
      run = (command, ...args) =>
        spawnSync(
          process.execPath,
          [
            "enterprise/review_package_cli.cjs",
            command,
            "--config",
            f.config,
            ...args,
          ],
          { encoding: "utf8" },
        );
    let r = run(
      "create",
      "--journal",
      f.journal,
      "--source-journal",
      f.store.journal.logPath,
      "--out",
      bundle,
    );
    assert.equal(r.status, 0, r.stderr);
    const b = fs.readFileSync(bundle);
    assert.equal(fs.statSync(bundle).mode & 0o777, 0o600);
    assert.equal(
      run(
        "create",
        "--journal",
        f.journal,
        "--source-journal",
        f.store.journal.logPath,
        "--out",
        bundle,
      ).status,
      1,
    );
    assert.deepEqual(fs.readFileSync(bundle), b);
    fs.renameSync(f.journal, file("saved-alarm.jsonl"));
    fs.renameSync(f.store.journal.logPath, file("saved-source.jsonl"));
    r = run(
      "verify",
      "--package",
      bundle,
      "--expected-package-hash",
      sha(b),
      "--out",
      out,
    );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      JSON.parse(fs.readFileSync(out)).packageVerification
        .externalConfigurationMatched,
      true,
    );
    assert.equal(fs.statSync(out).mode & 0o777, 0o600);
    assert.equal(run("verify", "--package", bundle, "--out", out).status, 1);
    fs.unlinkSync(out);
    r = run("review", "--package", bundle, "--lang", "pl", "--out", out);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(fs.readFileSync(out, "utf8").includes(labels.pl.packageTitle));
    fs.unlinkSync(out);
    assert.equal(
      run("review", "--package", bundle, "--lang", "xx", "--out", out).status,
      1,
    );
    assert.equal(
      run(
        "verify",
        "--package",
        bundle,
        "--expected-package-hash",
        "0".repeat(64),
        "--out",
        out,
      ).status,
      1,
    );
    assert.equal(
      run(
        "verify",
        "--package",
        bundle,
        "--private-key",
        "forbidden",
        "--out",
        out,
      ).status,
      1,
    );
    assert.ok(!fs.existsSync(out));
    assert.ok(
      !fs.readdirSync(f.root).some((n) => n.startsWith(".thundy-review-")),
    );
  } finally {
    f.cleanup();
  }
});
test("CLI rejects symlink inputs, preserves dangling output symlinks and sanitizes configuration failures", () => {
  const f = fixture(true);
  try {
    const bundle = path.join(f.root, "package.json"),
      alias = path.join(f.root, "alias.json"),
      out = path.join(f.root, "out.json"),
      run = (...extra) =>
        spawnSync(
          process.execPath,
          [
            "enterprise/review_package_cli.cjs",
            "verify",
            "--config",
            f.config,
            "--package",
            alias,
            "--out",
            out,
            ...extra,
          ],
          { encoding: "utf8" },
        );
    fs.writeFileSync(bundle, make(f));
    fs.symlinkSync(bundle, alias);
    assert.equal(run().status, 1);
    assert.ok(!fs.existsSync(out));
    fs.unlinkSync(alias);
    fs.copyFileSync(bundle, alias);
    const missing = path.join(f.root, "missing-target");
    fs.symlinkSync(missing, out);
    assert.equal(run().status, 1);
    assert.equal(fs.readlinkSync(out), missing);
    assert.ok(!fs.existsSync(missing));
    fs.unlinkSync(out);
    fs.writeFileSync(f.config, '{"secret":"SECRET_SENTINEL"}');
    const r = run();
    assert.equal(r.status, 1);
    assert.ok(!r.stderr.includes("SECRET_SENTINEL"));
    assert.ok(!fs.existsSync(out));
    assert.ok(
      !fs.readdirSync(f.root).some((n) => n.startsWith(".thundy-review-")),
    );
  } finally {
    f.cleanup();
  }
});
