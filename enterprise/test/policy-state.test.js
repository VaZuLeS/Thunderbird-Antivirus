"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  canonicalize = require("canonicalize");
const { PolicyState } = require("../policy_state.cjs");
const example = require("../../docs/enterprise/policy.example.json");
function fixture(t, extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-policy-state-")),
    issuer = crypto.generateKeyPairSync("ed25519"),
    writer = crypto.generateKeyPairSync("ed25519");
  let now = Date.parse("2026-10-14T12:00:00Z"),
    current;
  const context = {
    organizationId: example.organizationId,
    policyId: example.policyId,
    groupIds: ["pilot"],
    capabilities: [...example.requiredCapabilities],
    clientVersion: "1.22.0",
    trustedKeys: new Map([
      [
        "issuer-1",
        {
          publicKey: issuer.publicKey,
          organizationId: example.organizationId,
          notBefore: now - 86400000,
          notAfter: now + 86400000,
          revokedAt: null,
        },
      ],
    ]),
  };
  const options = {
    directory: path.join(root, "state"),
    signerKeyId: "state-1",
    signerPrivateKey: writer.privateKey,
    context,
    clock: () => now,
    ...extra,
  };
  const open = (changes) => {
    current = new PolicyState({ ...options, ...changes });
    return current;
  };
  const sign = (version = 3, edit = () => {}) => {
    const payload = JSON.parse(JSON.stringify(example));
    payload.version = version;
    edit(payload);
    return {
      keyId: "issuer-1",
      payload,
      signature: crypto
        .sign(null, Buffer.from(canonicalize(payload)), issuer.privateKey)
        .toString("base64url"),
    };
  };
  t.after(() => {
    current?.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, options, context, open, sign, advance: (ms) => (now += ms) };
}
const assessment = { localScore: 0, providerVerdict: "CLEAN" },
  operational = { brokerReady: true, outboxDurable: true, intentSealed: true };
test("durable policy floor survives restart and rejects rollback or same-version equivocation", (t) => {
  const f = fixture(t),
    store = f.open(),
    policy = f.sign();
  store.accept(policy);
  assert.equal(store.accept(policy).duplicate, true);
  store.accept(f.sign(4));
  const head = store.head();
  store.close();
  const recovered = f.open({ expectedHead: head });
  assert.equal(recovered.status().highestVersion, 4);
  assert.throws(() => recovered.accept(policy), { code: "POLICY_ROLLBACK" });
  assert.throws(
    () => recovered.accept(f.sign(4, (p) => (p.openingRules.warnScore = 49))),
    { code: "POLICY_STATE_VERSION_REUSE" },
  );
  assert.equal(
    recovered.evaluate(assessment, operational).action,
    "allow_intent",
  );
});
test("revocation persists, is idempotent and blocks the decision model", (t) => {
  const f = fixture(t),
    store = f.open();
  store.accept(f.sign());
  store.revoke("issuer-1");
  assert.equal(store.revoke("issuer-1").duplicate, true);
  assert.throws(() => store.evaluate(assessment, operational), {
    code: "POLICY_KEY_INACTIVE",
  });
  store.close();
  const recovered = f.open();
  assert.deepEqual(recovered.status().revokedKeyIds, ["issuer-1"]);
  assert.throws(() => recovered.accept(f.sign(4)), {
    code: "POLICY_KEY_INACTIVE",
  });
});
test("historical expired policy preserves its floor but cannot authorize current opening", (t) => {
  const f = fixture(t),
    store = f.open();
  store.accept(f.sign());
  store.close();
  f.advance(24 * 3600 * 1000);
  const recovered = f.open();
  assert.equal(recovered.status().highestVersion, 3);
  assert.throws(
    () => recovered.evaluate(assessment, operational),
    (err) => ["POLICY_KEY_INACTIVE", "POLICY_EXPIRED"].includes(err.code),
  );
});
test("scope and signatures are verified before persistence", (t) => {
  const f = fixture(t),
    store = f.open();
  assert.throws(
    () =>
      store.accept(f.sign(3, (p) => (p.organizationId = crypto.randomUUID()))),
    { code: "POLICY_SCOPE_DENIED" },
  );
  const policy = f.sign();
  policy.payload.openingRules.warnScore = 49;
  assert.throws(() => store.accept(policy), {
    code: "POLICY_SIGNATURE_INVALID",
  });
  assert.equal(store.status().actionCount, 0);
});
test("fsync failure never activates a policy and poisons decisions until replay", (t) => {
  const f = fixture(t),
    store = f.open();
  store.io = {
    ...fs,
    fsyncSync() {
      throw new Error("disk");
    },
  };
  assert.throws(() => store.accept(f.sign()), {
    code: "POLICY_STATE_PERSIST_FAILED",
  });
  assert.throws(() => store.evaluate(assessment, operational), {
    code: "POLICY_STATE_UNAVAILABLE",
  });
  store.close();
  assert.equal(f.open().status().highestVersion, 3);
});
test("journal mutation, partial tails, changed trust and wrong external head fail closed", (t) => {
  const f = fixture(t),
    store = f.open();
  store.accept(f.sign());
  const original = fs.readFileSync(store.logPath, "utf8"),
    log = store.logPath;
  store.close();
  fs.writeFileSync(log, original.slice(0, -1));
  assert.throws(() => f.open(), { code: "POLICY_STATE_LOG_INCOMPLETE" });
  fs.writeFileSync(log, original.replace('"ACCEPTED"', '"IGNORED"'));
  assert.throws(() => f.open());
  fs.writeFileSync(log, original);
  assert.throws(() => f.open({ expectedHead: "genesis" }), {
    code: "POLICY_STATE_HEAD_MISMATCH",
  });
  assert.throws(
    () => f.open({ context: { ...f.context, groupIds: ["other"] } }),
    { code: "POLICY_STATE_CHAIN_INVALID" },
  );
});
test("exclusive writers and full capacity retain the current policy", (t) => {
  const f = fixture(t),
    store = f.open();
  store.accept(f.sign());
  assert.throws(() => new PolicyState(f.options), {
    code: "POLICY_STATE_LOCKED",
  });
  const size = store.bytes;
  store.close();
  const limited = f.open({ maxBytes: size });
  assert.throws(() => limited.accept(f.sign(4)), {
    code: "POLICY_STATE_CAPACITY_EXCEEDED",
  });
  assert.equal(limited.status().highestVersion, 3);
});
test("caller-supplied clock or mutation cannot bypass stored revocation or change accepted policy", (t) => {
  const f = fixture(t),
    store = f.open(),
    policy = f.sign();
  store.accept(policy);
  policy.payload.openingRules.blockScore = 1;
  assert.equal(store.evaluate(assessment, operational).action, "allow_intent");
  store.revoke("issuer-1");
  assert.throws(() => store.evaluate(assessment, { ...operational, now: 0 }), {
    code: "POLICY_KEY_INACTIVE",
  });
});

test("clock rollback cannot reactivate a persisted revoked key", (t) => {
  const f = fixture(t),
    store = f.open();
  store.accept(f.sign());
  store.revoke("issuer-1");
  f.advance(-1);
  assert.throws(() => store.evaluate(assessment, operational), {
    code: "POLICY_STATE_CLOCK_ROLLBACK",
  });
});

test("authenticated bootstrap version floor also rejects rollback in a new journal", (t) => {
  const f = fixture(t),
    context = { ...f.context, highestVersion: 4 },
    store = f.open({ context });
  assert.throws(() => store.accept(f.sign(3)), { code: "POLICY_ROLLBACK" });
  store.accept(f.sign(4));
  store.close();
  assert.equal(f.open({ context }).status().highestVersion, 4);
});
