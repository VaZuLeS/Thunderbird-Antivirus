"use strict";
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const retainUntil = () => new Date(Date.now() + 86400000).toISOString();
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

module.exports = { s3Fixture, azureFixture, gcpFixture };
