"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const { spawnSync } = require("node:child_process");
const { Ledger, signed } = require("../ledger.cjs");
const { Witness } = require("../witness.cjs");
const { makeCheckpoint } = require("../evidence.cjs");
const {
  profiles,
  prepareArtifact,
  storeS3,
  storeAzure,
  storeGcp,
  simulateStorage,
  readBounded,
  createAwsSdkPort,
  createAzureSdkPort,
} = require("../immutable_storage.cjs");
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
    cleanup() {
      ledger.close();
      witness.close();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
const retainUntil = () => new Date(Date.now() + 86400000).toISOString();
const permit = { allowCloudWrite: true };
function s3Fixture(changes = {}) {
  const config = {
      bucket: "test-evidence-bucket",
      ownerAccountId: "123456789012",
      region: "eu-central-1",
      kmsKeyArn: "arn:aws:kms:eu-central-1:123456789012:key/test-key",
      retainUntil: retainUntil(),
    },
    calls = [];
  let bytes;
  const port = {
    getBucketLocation: async (args) => {
      calls.push(args);
      return { LocationConstraint: "eu-central-1" };
    },
    getBucketVersioning: async () => ({ Status: "Enabled" }),
    getObjectLockConfiguration: async () => ({
      ObjectLockConfiguration: { ObjectLockEnabled: "Enabled" },
    }),
    putObject: async (args) => {
      calls.push(args);
      bytes = Buffer.from(args.Body);
      return { VersionId: "version-1" };
    },
    headObject: async () => ({ VersionId: "version-1" }),
    getObjectRetention: async (args) => {
      calls.push(args);
      return {
        Retention: {
          Mode: "COMPLIANCE",
          RetainUntilDate: new Date(config.retainUntil),
        },
      };
    },
    getObject: async (args) => {
      calls.push(args);
      return {
        VersionId: "version-1",
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: config.kmsKeyArn,
        Body: Readable.from([bytes]),
      };
    },
    ...changes,
  };
  return { config, port, calls, getBytes: () => bytes };
}
function azureFixture(changes = {}) {
  const config = {
      subscriptionId: crypto.randomUUID(),
      resourceGroup: "test-rg",
      account: "testevidence",
      container: "audit-evidence",
      region: "westeurope",
      encryptionScope: "audit-scope",
      retainUntil: retainUntil(),
    },
    calls = [];
  let bytes, key;
  const root =
    "https://" + config.account + ".blob.core.windows.net/" + config.container;
  const blob = {
    get url() {
      return root + "/" + key;
    },
    uploadData: async (data, options) => {
      bytes = Buffer.from(data);
      calls.push(options);
      return { versionId: "version-1" };
    },
    getProperties: async () => ({ versionId: "version-1" }),
    withVersion: (id) => ({
      url: root + "/" + key + "?versionid=" + id,
      getProperties: async () => ({
        versionId: id,
        immutabilityPolicyMode: "Locked",
        immutabilityPolicyExpiresOn: new Date(config.retainUntil),
        serverEncrypted: true,
        blobType: "BlockBlob",
        encryptionScope: config.encryptionScope,
      }),
      download: async () => ({
        versionId: id,
        readableStreamBody: Readable.from([bytes]),
      }),
    }),
    ...changes.blob,
  };
  const container = {
    url: root,
    getProperties: async () => ({
      isImmutableStorageWithVersioningEnabled: true,
    }),
    getBlockBlobClient: (name) => {
      key = name;
      return blob;
    },
    ...changes.container,
  };
  const port = {
    getAccountProperties: async () => ({
      id:
        "/subscriptions/" +
        config.subscriptionId +
        "/resourceGroups/" +
        config.resourceGroup +
        "/providers/Microsoft.Storage/storageAccounts/" +
        config.account,
      location: config.region,
    }),
    getContainerClient: () => container,
    ...changes.port,
  };
  return { config, port, calls, blob, container };
}
function gcpFixture(changes = {}) {
  const config = {
      bucket: "test-evidence-bucket",
      projectNumber: "123456789012",
      region: "EUROPE-WEST1",
      kmsKeyName:
        "projects/test-project/locations/europe-west1/keyRings/audit/cryptoKeys/evidence",
      retainUntil: retainUntil(),
    },
    calls = [];
  let bytes, key;
  const bucket = {
    getMetadata: async () => [
      {
        name: config.bucket,
        projectNumber: config.projectNumber,
        location: config.region,
        retentionPolicy: { isLocked: true, retentionPeriod: "172800" },
      },
    ],
    file: (name, options) => {
      key = name;
      calls.push(options);
      return {
        metadata: { generation: "10001" },
        save: async (data, settings) => {
          bytes = Buffer.from(data);
          calls.push(settings);
        },
        getMetadata: async () => [
          {
            name: key,
            bucket: config.bucket,
            generation: "10001",
            kmsKeyName: config.kmsKeyName + "/cryptoKeyVersions/1",
            retentionExpirationTime: config.retainUntil,
            timeCreated: new Date().toISOString(),
          },
        ],
        createReadStream: () => Readable.from([bytes]),
        ...changes.file,
      };
    },
    ...changes.bucket,
  };
  return { config, port: { bucket: () => bucket }, calls, bucket };
}

test("artifact construction requires a complete externally witnessed and device-verified snapshot", () => {
  const f = fixture();
  try {
    assert.equal(Object.isFrozen(f.artifact), true);
    assert.ok(f.artifact.key.includes(f.artifact.sha256));
    assert.throws(
      () =>
        prepareArtifact(f.data, {
          serverPublicKey: f.trust.serverPublicKey,
          serverKeyId: "server-1",
          registrations: f.trust.registrations,
        }),
      /COMPLETE_DEVICE_WITNESS_REQUIRED/,
    );
    assert.throws(
      () => prepareArtifact(f.data, { ...f.trust, registrations: null }),
      /COMPLETE_DEVICE_WITNESS_REQUIRED/,
    );
    const tampered = JSON.parse(JSON.stringify(f.data));
    tampered.records[0].eventEnvelope.payload.urlRedacted =
      "https://changed.example";
    assert.throws(() => prepareArtifact(tampered, f.trust));
  } finally {
    f.cleanup();
  }
});

test("all optional cloud profiles default to disabled and none writes without explicit activation", async () => {
  const f = fixture();
  try {
    for (const profile of Object.values(profiles))
      assert.equal(profile.enabled, false);
    let calls = 0;
    for (const [store, config] of [
      [storeS3, s3Fixture().config],
      [storeAzure, azureFixture().config],
      [storeGcp, gcpFixture().config],
    ])
      await assert.rejects(
        () =>
          store(
            f.artifact,
            config,
            new Proxy(
              {},
              {
                get: () => () => {
                  calls++;
                },
              },
            ),
            {},
          ),
        /CLOUD_WRITE_DISABLED/,
      );
    assert.equal(calls, 0);
    await assert.rejects(
      () => storeS3({ ...f.artifact }, s3Fixture().config, {}, permit),
      /ARTIFACT_NOT_VERIFIED/,
    );
  } finally {
    f.cleanup();
  }
});

test("S3 pins owner, version, encryption, compliance retention and actual readback bytes", async () => {
  const f = fixture(),
    s = s3Fixture();
  try {
    const result = await storeS3(f.artifact, s.config, s.port, permit);
    assert.equal(result.immutablePropertiesObserved, true);
    assert.equal(result.sealed, false);
    assert.equal(result.liveAcceptance, false);
    assert.equal(result.objectVersion, "version-1");
    const write = s.calls.find((call) => call.Body);
    assert.equal(write.IfNoneMatch, "*");
    assert.equal(write.ObjectLockMode, "COMPLIANCE");
    assert.equal(write.ExpectedBucketOwner, s.config.ownerAccountId);
    assert.equal(s.calls.at(-1).VersionId, "version-1");
  } finally {
    f.cleanup();
  }
});

test("S3 governance, missing versions, wrong keys, short retention and tampered bytes fail", async () => {
  const mutations = [
    {
      getObjectRetention: async () => ({
        Retention: {
          Mode: "GOVERNANCE",
          RetainUntilDate: new Date(Date.now() + 86400000),
        },
      }),
    },
    { putObject: async () => ({ VersionId: "null" }) },
    {
      getObjectRetention: async () => ({
        Retention: { Mode: "COMPLIANCE", RetainUntilDate: new Date() },
      }),
    },
    {
      getObject: async () => ({
        VersionId: "version-1",
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: "wrong-key",
        Body: Buffer.from("bad"),
      }),
    },
    { getObject: async () => ({ VersionId: "wrong-version" }) },
  ];
  const f = fixture();
  try {
    for (const mutation of mutations) {
      const s = s3Fixture(mutation);
      await assert.rejects(() => storeS3(f.artifact, s.config, s.port, permit));
    }
    const s = s3Fixture();
    s.port.getObject = async () => ({
      VersionId: "version-1",
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: s.config.kmsKeyArn,
      Body: Buffer.alloc(f.artifact.byteLength),
    });
    await assert.rejects(
      () => storeS3(f.artifact, s.config, s.port, permit),
      /STORAGE_CONTENT_MISMATCH/,
    );
  } finally {
    f.cleanup();
  }
});

test("S3 rejects suspended versioning, unavailable lock and wrong data region before write", async () => {
  const f = fixture();
  try {
    for (const mutation of [
      { getBucketVersioning: async () => ({ Status: "Suspended" }) },
      { getObjectLockConfiguration: async () => ({}) },
      { getBucketLocation: async () => ({ LocationConstraint: "us-west-2" }) },
    ]) {
      const s = s3Fixture(mutation);
      await assert.rejects(() => storeS3(f.artifact, s.config, s.port, permit));
      assert.equal(s.getBytes(), undefined);
    }
  } finally {
    f.cleanup();
  }
});

test("Azure uses the documented expiriesOn option and pins version, locked policy and encryption scope", async () => {
  const f = fixture(),
    a = azureFixture();
  try {
    const result = await storeAzure(f.artifact, a.config, a.port, permit);
    assert.equal(result.provider, "azure-blob");
    assert.equal(result.objectVersion, "version-1");
    assert.equal(result.sealed, false);
    assert.equal(
      a.calls[0].immutabilityPolicy.expiriesOn.toISOString(),
      a.config.retainUntil,
    );
    assert.equal(a.calls[0].immutabilityPolicy.policyMode, "Locked");
    assert.equal(a.calls[0].conditions.ifNoneMatch, "*");
  } finally {
    f.cleanup();
  }
});

test("Azure wrong account, custom endpoint and missing version WORM prevent upload", async () => {
  const f = fixture();
  try {
    const fixtures = [
      azureFixture({
        port: {
          getAccountProperties: async () => ({
            id: "wrong",
            location: "westeurope",
          }),
        },
      }),
      azureFixture({ container: { url: "https://evil.example" } }),
      azureFixture({
        container: {
          getProperties: async () => ({
            isImmutableStorageWithVersioningEnabled: false,
          }),
        },
      }),
    ];
    for (const a of fixtures) {
      await assert.rejects(() =>
        storeAzure(f.artifact, a.config, a.port, permit),
      );
      assert.equal(a.calls.length, 0);
    }
  } finally {
    f.cleanup();
  }
});

test("Azure unlocked policy, wrong versions and encryption or retention mismatches reject observations", async () => {
  const f = fixture();
  try {
    for (const change of [
      { immutabilityPolicyMode: "Unlocked" },
      { encryptionScope: "other" },
      { serverEncrypted: false },
      { versionId: "other" },
      { immutabilityPolicyExpiresOn: new Date() },
    ]) {
      const a = azureFixture();
      const original = a.blob.withVersion;
      a.blob.withVersion = (id) => {
        const pinned = original(id),
          get = pinned.getProperties;
        return {
          ...pinned,
          getProperties: async () => ({ ...(await get()), ...change }),
        };
      };
      await assert.rejects(() =>
        storeAzure(f.artifact, a.config, a.port, permit),
      );
    }
  } finally {
    f.cleanup();
  }
});

test("GCP pins generation, locked bucket identity, encryption key version and readback", async () => {
  const f = fixture(),
    g = gcpFixture();
  try {
    const result = await storeGcp(f.artifact, g.config, g.port, permit);
    assert.equal(result.objectVersion, "10001");
    assert.equal(result.immutablePropertiesObserved, true);
    assert.equal(result.sealed, false);
    assert.equal(
      g.calls.find((call) => call.preconditionOpts).preconditionOpts
        .ifGenerationMatch,
      0,
    );
    assert.equal(g.calls.at(-1).generation, "10001");
  } finally {
    f.cleanup();
  }
});

test("GCP rejects unlocked buckets, foreign projects and wrong region before upload", async () => {
  const f = fixture();
  try {
    for (const change of [
      { projectNumber: "999999999999" },
      { location: "US" },
      { retentionPolicy: { isLocked: false, retentionPeriod: "172800" } },
    ]) {
      const g = gcpFixture(),
        original = g.bucket.getMetadata;
      g.bucket.getMetadata = async () => [
        { ...(await original())[0], ...change },
      ];
      await assert.rejects(() =>
        storeGcp(f.artifact, g.config, g.port, permit),
      );
      assert.equal(g.calls.length, 0);
    }
  } finally {
    f.cleanup();
  }
});

test("GCP wrong generations, short retention and changed post-write lock cannot succeed", async () => {
  const f = fixture();
  try {
    for (const change of [
      { generation: "10002" },
      { retentionExpirationTime: new Date().toISOString() },
      { kmsKeyName: "projects/foreign/key/1" },
    ]) {
      const g = gcpFixture(),
        original = g.bucket.file;
      g.bucket.file = (name, options) => {
        const file = original(name, options),
          get = file.getMetadata;
        return {
          ...file,
          getMetadata: async () => [{ ...(await get())[0], ...change }],
        };
      };
      await assert.rejects(() =>
        storeGcp(f.artifact, g.config, g.port, permit),
      );
    }
    const g = gcpFixture(),
      get = g.bucket.getMetadata;
    let calls = 0;
    g.bucket.getMetadata = async () => {
      const result = await get();
      if (++calls > 1) result[0].retentionPolicy.isLocked = false;
      return result;
    };
    await assert.rejects(
      () => storeGcp(f.artifact, g.config, g.port, permit),
      /GCP_LOCK_CHANGED/,
    );
  } finally {
    f.cleanup();
  }
});

test("local storage simulation is repeatable but never claims immutability or SEALED", () => {
  const f = fixture();
  try {
    const directory = path.join(f.root, "simulation"),
      first = simulateStorage(f.artifact, directory),
      second = simulateStorage(f.artifact, directory);
    assert.equal(first.sha256, second.sha256);
    assert.equal(first.simulated, true);
    assert.equal(first.immutablePropertiesObserved, false);
    assert.equal(first.sealed, false);
    fs.writeFileSync(
      path.join(directory, f.artifact.sha256 + ".json"),
      "changed",
    );
    assert.throws(
      () => simulateStorage(f.artifact, directory),
      /STORAGE_CONTENT_MISMATCH/,
    );
  } finally {
    f.cleanup();
  }
});

test("bounded readback rejects oversized or invalid streams rather than trusting metadata digests", async () => {
  await assert.rejects(
    () => readBounded(Buffer.alloc(20), 10),
    /STORAGE_READ_TOO_LARGE/,
  );
  await assert.rejects(
    () => readBounded(Readable.from([Buffer.alloc(5), Buffer.alloc(10)]), 10),
    /STORAGE_READ_TOO_LARGE/,
  );
  await assert.rejects(
    () => readBounded(Readable.from(["text"]), 10),
    /STORAGE_BODY_INVALID/,
  );
  assert.deepEqual(
    await readBounded(Readable.from([Buffer.from("ok")]), 2),
    Buffer.from("ok"),
  );
});

test("SDK bridges retain externally initialized clients and map only documented operations", async () => {
  const commands = {};
  for (const name of [
    "GetBucketLocationCommand",
    "GetBucketVersioningCommand",
    "GetObjectLockConfigurationCommand",
    "PutObjectCommand",
    "HeadObjectCommand",
    "GetObjectRetentionCommand",
    "GetObjectCommand",
  ])
    commands[name] = class {
      constructor(input) {
        this.input = input;
      }
    };
  let sent;
  const port = createAwsSdkPort(
    {
      send: async (command) => {
        sent = command;
        return { ok: true };
      },
    },
    commands,
  );
  await port.getObject({ VersionId: "pinned" });
  assert.equal(sent.input.VersionId, "pinned");
  const azure = createAzureSdkPort(
    { getContainerClient: (name) => name },
    {
      storageAccounts: {
        getProperties: async (group, account) => ({ group, account }),
      },
    },
  );
  assert.deepEqual(await azure.getAccountProperties("rg", "account"), {
    group: "rg",
    account: "account",
  });
  assert.equal(azure.getContainerClient("container"), "container");
});

test("profile CLI exports disabled blueprints and refuses overwrites or cloud execution", () => {
  const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "thundy-storage-cli-"),
    ),
    output = path.join(directory, "profile.json"),
    run = (args) =>
      spawnSync(process.execPath, ["enterprise/storage_cli.cjs", ...args], {
        encoding: "utf8",
      });
  try {
    const result = run(["profile", "--provider", "aws-s3", "--out", output]);
    assert.equal(result.status, 0);
    const profile = JSON.parse(fs.readFileSync(output));
    assert.equal(profile.enabled, false);
    assert.equal(profile.allowCloudWrite, false);
    assert.notEqual(
      run(["profile", "--provider", "aws-s3", "--out", output]).status,
      0,
    );
    assert.notEqual(run(["cloud-write", "--provider", "aws-s3"]).status, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("GCP cannot substitute a longer mutable object retention for the locked bucket horizon", async () => {
  const f = fixture(),
    g = gcpFixture();
  try {
    const metadata = g.bucket.getMetadata;
    g.bucket.getMetadata = async () => {
      const result = await metadata();
      result[0].retentionPolicy.retentionPeriod = "1";
      return result;
    };
    const file = g.bucket.file;
    g.bucket.file = (name, options) => {
      const target = file(name, options),
        get = target.getMetadata;
      return {
        ...target,
        getMetadata: async () => {
          const result = await get();
          result[0].timeCreated = new Date(Date.now() - 86400000).toISOString();
          result[0].retentionExpirationTime = new Date(
            Date.now() + 365 * 86400000,
          ).toISOString();
          return result;
        },
      };
    };
    await assert.rejects(
      () => storeGcp(f.artifact, g.config, g.port, permit),
      /RETENTION_TOO_SHORT/,
    );
  } finally {
    f.cleanup();
  }
});

test("conditional retry inspects the existing pinned object instead of overwriting evidence", async () => {
  const f = fixture();
  try {
    const s = s3Fixture();
    await storeS3(f.artifact, s.config, s.port, permit);
    s.port.putObject = async () => {
      throw { $metadata: { httpStatusCode: 412 } };
    };
    const sResult = await storeS3(f.artifact, s.config, s.port, permit);
    assert.equal(sResult.objectVersion, "version-1");
    const a = azureFixture();
    await storeAzure(f.artifact, a.config, a.port, permit);
    a.blob.uploadData = async () => {
      throw { statusCode: 412 };
    };
    const aResult = await storeAzure(f.artifact, a.config, a.port, permit);
    assert.equal(aResult.objectVersion, "version-1");
    const g = gcpFixture();
    await storeGcp(f.artifact, g.config, g.port, permit);
    const original = g.bucket.file;
    g.bucket.file = (name, options) => ({
      ...original(name, options),
      save: async () => {
        throw { code: 412 };
      },
    });
    const gResult = await storeGcp(f.artifact, g.config, g.port, permit);
    assert.equal(gResult.objectVersion, "10001");
  } finally {
    f.cleanup();
  }
});

test("expired retention and provider errors produce no successful or sensitive observation", async () => {
  const f = fixture();
  try {
    const s = s3Fixture();
    s.config.retainUntil = new Date(Date.now() - 1).toISOString();
    await assert.rejects(
      () => storeS3(f.artifact, s.config, s.port, permit),
      /RETENTION_ALREADY_EXPIRED/,
    );
    assert.equal(s.calls.length, 0);
    const failing = s3Fixture({
      getBucketLocation: async () => {
        throw new Error("SECRET_TOKEN=not-for-output");
      },
    });
    await assert.rejects(
      () => storeS3(f.artifact, failing.config, failing.port, permit),
      (error) =>
        error.message === "STORAGE_PROVIDER_UNAVAILABLE" &&
        !error.message.includes("SECRET_TOKEN"),
    );
  } finally {
    f.cleanup();
  }
});

test("local simulation CLI verifies the full witness chain before storing a canonical object", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-storage-e2e-")),
    directory = path.join(root, "service"),
    witness = path.join(root, "witness"),
    events = path.join(root, "events.json"),
    checkpoint = path.join(root, "checkpoint.json"),
    anchor = path.join(root, "anchor.json");
  const run = (file, args) =>
    spawnSync(process.execPath, [file, ...args], { encoding: "utf8" });
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
        events,
      ]).status,
      0,
    );
    assert.equal(
      run("enterprise/local.cjs", [
        "checkpoint",
        "--data-dir",
        directory,
        "--out",
        checkpoint,
      ]).status,
      0,
    );
    assert.equal(
      run("enterprise/witness_cli.cjs", [
        "init",
        "--directory",
        witness,
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
      witness,
      "--export",
      events,
      "--checkpoint",
      checkpoint,
      "--expected-head",
      "genesis",
      "--out",
      anchor,
      "--registry",
      path.join(directory, "config.json"),
    ]);
    assert.equal(appended.status, 0);
    const args = [
      "simulate",
      "--export",
      events,
      "--public-key",
      path.join(directory, "server-public.pem"),
      "--server-key-id",
      "local-server-1",
      "--registry",
      path.join(directory, "config.json"),
      "--witness-anchor",
      anchor,
      "--witness-public-key",
      path.join(witness, "witness-public.pem"),
      "--expected-anchor-hash",
      JSON.parse(appended.stdout).anchorHash,
      "--directory",
      path.join(root, "objects"),
    ];
    const saved = run("enterprise/storage_cli.cjs", args);
    assert.equal(saved.status, 0);
    const report = JSON.parse(saved.stdout);
    assert.equal(report.entryCount, 6);
    assert.equal(report.simulated, true);
    assert.equal(report.sealed, false);
    assert.equal(fs.readdirSync(path.join(root, "objects")).length, 1);
    const wrong = [...args];
    wrong[wrong.indexOf("--expected-anchor-hash") + 1] = "0".repeat(64);
    assert.notEqual(run("enterprise/storage_cli.cjs", wrong).status, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("SDK metadata observations do not establish a live transport and append blobs cannot masquerade as frozen snapshots", async () => {
  const f = fixture();
  try {
    const s = s3Fixture();
    const report = await storeS3(f.artifact, s.config, s.port, permit);
    assert.equal(report.simulated, null);
    assert.equal(report.transportVerified, false);
    assert.equal(report.liveAcceptance, false);
    assert.equal(report.sealed, false);
    const a = azureFixture(),
      original = a.blob.withVersion;
    a.blob.withVersion = (id) => {
      const pinned = original(id),
        get = pinned.getProperties;
      return {
        ...pinned,
        getProperties: async () => ({
          ...(await get()),
          blobType: "AppendBlob",
        }),
      };
    };
    await assert.rejects(
      () => storeAzure(f.artifact, a.config, a.port, permit),
      /AZURE_IMMUTABILITY_OR_KEY_INVALID/,
    );
  } finally {
    f.cleanup();
  }
});

test("destination settings are snapshotted before asynchronous SDK calls", async () => {
  const f = fixture(),
    s = s3Fixture(),
    original = s.port.getBucketLocation;
  try {
    const initialOwner = s.config.ownerAccountId,
      initialKey = s.config.kmsKeyArn;
    s.port.getBucketLocation = async (args) => {
      s.config.ownerAccountId = "999999999999";
      s.config.kmsKeyArn = "foreign-key";
      return original(args);
    };
    s.port.getObject = async () => ({
      VersionId: "version-1",
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: initialKey,
      Body: s.getBytes(),
    });
    const result = await storeS3(f.artifact, s.config, s.port, permit);
    assert.equal(result.ownerAccountId, initialOwner);
    assert.equal(result.kmsKeyArn, initialKey);
    assert.equal(
      s.calls.find((call) => call.Body).ExpectedBucketOwner,
      initialOwner,
    );
  } finally {
    f.cleanup();
  }
});
