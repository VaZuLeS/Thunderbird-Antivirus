"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const canonicalize = require("canonicalize");
const { verifyEvidence } = require("./evidence.cjs");
class StorageError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const need = (condition, code) => {
  if (!condition) throw new StorageError(code);
};
const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const artifacts = new WeakMap();
const profiles = Object.freeze({
  "aws-s3": Object.freeze({
    enabled: false,
    sdkPackages: ["@aws-sdk/client-s3"],
    requiredSettings: [
      "bucket",
      "ownerAccountId",
      "region",
      "kmsKeyArn",
      "retainUntil",
    ],
  }),
  "azure-blob": Object.freeze({
    enabled: false,
    sdkPackages: ["@azure/storage-blob", "@azure/arm-storage"],
    requiredSettings: [
      "subscriptionId",
      "resourceGroup",
      "account",
      "container",
      "region",
      "encryptionScope",
      "retainUntil",
    ],
  }),
  "gcp-bucket": Object.freeze({
    enabled: false,
    sdkPackages: ["@google-cloud/storage"],
    requiredSettings: [
      "bucket",
      "projectNumber",
      "region",
      "kmsKeyName",
      "retainUntil",
    ],
  }),
  "local-simulation": Object.freeze({
    enabled: false,
    sdkPackages: [],
    requiredSettings: ["directory"],
  }),
});
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
freeze(profiles);
function prepareArtifact(data, trust) {
  const verified = verifyEvidence(data, trust);
  need(
    verified.completeSnapshotWitnessed && verified.deviceSignaturesVerified,
    "COMPLETE_DEVICE_WITNESS_REQUIRED",
  );
  const bytes = Buffer.from(
    canonicalize({
      kind: "thundy-immutable-evidence-object",
      schemaVersion: 1,
      evidence: data,
      witnessAnchor: trust.witnessAnchor,
    }),
  );
  need(bytes.length <= 64 * 1024 * 1024, "STORAGE_OBJECT_TOO_LARGE");
  const sha256 = digest(bytes),
    artifact = Object.freeze({
      sourceId: verified.sourceId,
      entryCount: verified.entryCount,
      sha256,
      byteLength: bytes.length,
      key:
        "evidence/" +
        verified.sourceId +
        "/" +
        String(verified.entryCount).padStart(12, "0") +
        "-" +
        sha256 +
        ".json",
    });
  artifacts.set(artifact, bytes);
  return artifact;
}
function bytesFor(artifact) {
  need(artifacts.has(artifact), "ARTIFACT_NOT_VERIFIED");
  return Buffer.from(artifacts.get(artifact));
}
async function readBounded(body, limit) {
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    need(body.byteLength <= limit, "STORAGE_READ_TOO_LARGE");
    return Buffer.from(body);
  }
  need(
    body && typeof body[Symbol.asyncIterator] === "function",
    "STORAGE_BODY_INVALID",
  );
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of body) {
      need(
        Buffer.isBuffer(chunk) || chunk instanceof Uint8Array,
        "STORAGE_BODY_INVALID",
      );
      size += chunk.byteLength;
      need(size <= limit, "STORAGE_READ_TOO_LARGE");
      chunks.push(Buffer.from(chunk));
    }
  } catch (error) {
    body.destroy?.();
    throw error;
  }
  return Buffer.concat(chunks);
}
// One total deadline covers preflight, write, metadata and the complete body.
function operationContext(runtime = {}) {
  const timeoutMs = runtime.timeoutMs ?? 30000;
  need(
    Number.isSafeInteger(timeoutMs) && timeoutMs >= 10 && timeoutMs <= 300000,
    "STORAGE_TIMEOUT_INVALID",
  );
  need(
    !runtime.signal ||
      (typeof runtime.signal.addEventListener === "function" &&
        typeof runtime.signal.removeEventListener === "function" &&
        typeof runtime.signal.aborted === "boolean"),
    "STORAGE_SIGNAL_INVALID",
  );
  const controller = new AbortController(),
    streams = new Set();
  const expires = performance.now() + timeoutMs;
  let failure, rejectDeadline;
  const deadline = new Promise((_, reject) => {
    rejectDeadline = reject;
  });
  // The deadline can expire before the first asynchronous request.
  deadline.catch(() => {});
  const stop = (code) => {
    if (failure) return;
    failure = new StorageError(code);
    controller.abort();
    for (const body of streams) body.destroy?.();
    rejectDeadline(failure);
  };
  const abort = () => stop("STORAGE_ABORTED");
  const timer = setTimeout(() => stop("STORAGE_TIMEOUT"), timeoutMs);
  runtime.signal?.addEventListener("abort", abort, { once: true });
  if (runtime.signal?.aborted) abort();
  const check = () => {
    if (performance.now() >= expires) stop("STORAGE_TIMEOUT");
    if (failure) throw failure;
  };
  const call = async (thunk) => {
    check();
    const request = Promise.resolve().then(() => {
      check();
      return thunk();
    });
    request.then(
      (value) => {
        if (failure) {
          value?.Body?.destroy?.();
          value?.readableStreamBody?.destroy?.();
        }
      },
      () => {},
    );
    const value = await Promise.race([request, deadline]);
    check();
    if (value?.Body) streams.add(value.Body);
    if (value?.readableStreamBody) streams.add(value.readableStreamBody);
    return value;
  };
  return {
    signal: controller.signal,
    check,
    call,
    async read(body, limit) {
      streams.add(body);
      try {
        return await call(() => readBounded(body, limit));
      } finally {
        streams.delete(body);
      }
    },
    close() {
      for (const body of streams) body.destroy?.();
      streams.clear();
      clearTimeout(timer);
      runtime.signal?.removeEventListener("abort", abort);
    },
  };
}
function until(value) {
  const time =
    value instanceof Date
      ? value.getTime()
      : typeof value === "string"
        ? Date.parse(value)
        : NaN;
  need(Number.isFinite(time), "RETENTION_TIME_INVALID");
  return time;
}
function validateRequest(artifact, config, authorization) {
  const bytes = bytesFor(artifact);
  need(authorization?.allowCloudWrite === true, "CLOUD_WRITE_DISABLED");
  need(config && typeof config === "object", "STORAGE_CONFIG_INVALID");
  const now = Date.now(),
    retainUntil = until(config.retainUntil);
  need(retainUntil > now, "RETENTION_ALREADY_EXPIRED");
  return { bytes, retainUntil };
}
function checkRead(bytes, artifact) {
  need(
    bytes.length === artifact.byteLength && digest(bytes) === artifact.sha256,
    "STORAGE_CONTENT_MISMATCH",
  );
}
function report(provider, artifact, config, version, retainUntil) {
  need(retainUntil > Date.now(), "RETENTION_ALREADY_EXPIRED");
  return {
    schemaVersion: 1,
    kind: "thundy-storage-observation",
    provider,
    sourceId: artifact.sourceId,
    entryCount: artifact.entryCount,
    objectKey: artifact.key,
    objectVersion: version,
    sha256: artifact.sha256,
    byteLength: artifact.byteLength,
    region: config.region,
    retainUntil: new Date(retainUntil).toISOString(),
    observedAt: new Date().toISOString(),
    immutablePropertiesObserved: true,
    simulated: null,
    transportVerified: false,
    liveAcceptance: false,
    sealed: false,
  };
}
function bucketName(value) {
  return (
    typeof value === "string" &&
    /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value) &&
    !value.includes("..") &&
    !/^\d+\.\d+\.\d+\.\d+$/.test(value)
  );
}
function version(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1024 &&
    value !== "null" &&
    !/[\u0000-\u0020\u007f]/.test(value)
  );
}
function validateDestination(destination) {
  need(
    destination &&
      typeof destination === "object" &&
      !Array.isArray(destination) &&
      Object.hasOwn(destination, "provider"),
    "STORAGE_DESTINATION_INVALID",
  );
  const { provider } = destination;
  if (provider === "local-simulation") {
    need(
      Object.keys(destination).length === 2 &&
        typeof destination.directory === "string" &&
        path.isAbsolute(destination.directory) &&
        path.resolve(destination.directory) === destination.directory,
      "STORAGE_DESTINATION_INVALID",
    );
    return;
  }
  need(
    ["aws-s3", "azure-blob", "gcp-bucket"].includes(provider) &&
      Object.keys(destination).length === 2 &&
      Object.hasOwn(destination, "settings"),
    "STORAGE_DESTINATION_INVALID",
  );
  const config = destination.settings,
    required = profiles[provider].requiredSettings;
  need(
    config &&
      typeof config === "object" &&
      !Array.isArray(config) &&
      Object.keys(config).length === required.length &&
      required.every(
        (key) =>
          Object.hasOwn(config, key) &&
          typeof config[key] === "string" &&
          config[key].length > 0 &&
          config[key].length <= 1024,
      ),
    "STORAGE_CONFIG_INVALID",
  );
  need(
    new Date(until(config.retainUntil)).toISOString() === config.retainUntil,
    "RETENTION_TIME_INVALID",
  );
  if (provider === "aws-s3")
    need(
      bucketName(config.bucket) &&
        /^\d{12}$/.test(config.ownerAccountId) &&
        /^[a-z]{2}-[a-z]+-\d$/.test(config.region) &&
        config.kmsKeyArn.startsWith(
          "arn:aws:kms:" +
            config.region +
            ":" +
            config.ownerAccountId +
            ":key/",
        ) &&
        config.kmsKeyArn.length >
          (
            "arn:aws:kms:" +
            config.region +
            ":" +
            config.ownerAccountId +
            ":key/"
          ).length,
      "S3_CONFIG_INVALID",
    );
  if (provider === "azure-blob")
    need(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        config.subscriptionId,
      ) &&
        /^[A-Za-z0-9_.()-]{1,90}$/.test(config.resourceGroup) &&
        /^[a-z0-9]{3,24}$/.test(config.account) &&
        /^[a-z0-9](?:[a-z0-9-]{1,61})[a-z0-9]$/.test(config.container) &&
        !config.container.includes("--") &&
        /^[a-z0-9]+$/.test(config.region) &&
        /^[A-Za-z0-9_-]{1,63}$/.test(config.encryptionScope),
      "AZURE_CONFIG_INVALID",
    );
  if (provider === "gcp-bucket")
    need(
      bucketName(config.bucket) &&
        /^[1-9]\d{5,19}$/.test(config.projectNumber) &&
        /^[A-Z0-9-]+$/.test(config.region) &&
        /^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+$/.test(
          config.kmsKeyName,
        ),
      "GCP_CONFIG_INVALID",
    );
}
async function storeS3(artifact, config, port, authorization, context) {
  const { bytes, retainUntil } = validateRequest(
    artifact,
    config,
    authorization,
  );
  need(
    bucketName(config.bucket) &&
      /^\d{12}$/.test(config.ownerAccountId || "") &&
      typeof config.region === "string" &&
      /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(config.region) &&
      typeof config.kmsKeyArn === "string" &&
      config.kmsKeyArn.startsWith(
        "arn:aws:kms:" + config.region + ":" + config.ownerAccountId + ":key/",
      ),
    "S3_CONFIG_INVALID",
  );
  const bucket = {
    Bucket: config.bucket,
    ExpectedBucketOwner: config.ownerAccountId,
  };
  const location = await context.call(() =>
      port.getBucketLocation(bucket, { abortSignal: context.signal }),
    ),
    region =
      location.LocationConstraint === "EU"
        ? "eu-west-1"
        : location.LocationConstraint || "us-east-1";
  need(region === config.region, "STORAGE_REGION_MISMATCH");
  const versioning = await context.call(() =>
      port.getBucketVersioning(bucket, { abortSignal: context.signal }),
    ),
    lock = await context.call(() =>
      port.getObjectLockConfiguration(bucket, { abortSignal: context.signal }),
    );
  need(
    versioning.Status === "Enabled" &&
      lock.ObjectLockConfiguration?.ObjectLockEnabled === "Enabled",
    "S3_LOCK_NOT_ENABLED",
  );
  let id;
  try {
    const written = await context.call(() =>
      port.putObject(
        {
          ...bucket,
          Key: artifact.key,
          Body: bytes,
          ContentType: "application/json",
          IfNoneMatch: "*",
          ChecksumSHA256: Buffer.from(artifact.sha256, "hex").toString(
            "base64",
          ),
          ServerSideEncryption: "aws:kms",
          SSEKMSKeyId: config.kmsKeyArn,
          ObjectLockMode: "COMPLIANCE",
          ObjectLockRetainUntilDate: new Date(retainUntil),
        },
        { abortSignal: context.signal },
      ),
    );
    id = written.VersionId;
  } catch (error) {
    context.check();
    if (error?.$metadata?.httpStatusCode !== 412)
      throw new StorageError("STORAGE_WRITE_FAILED");
    const existing = await context.call(() =>
      port.headObject(
        { ...bucket, Key: artifact.key },
        { abortSignal: context.signal },
      ),
    );
    id = existing.VersionId;
  }
  need(version(id), "STORAGE_VERSION_MISSING");
  const target = { ...bucket, Key: artifact.key, VersionId: id };
  const retention = await context.call(() =>
    port.getObjectRetention(target, { abortSignal: context.signal }),
  );
  need(retention.Retention?.Mode === "COMPLIANCE", "S3_COMPLIANCE_REQUIRED");
  const observedUntil = until(retention.Retention.RetainUntilDate);
  need(observedUntil >= retainUntil, "RETENTION_TOO_SHORT");
  const object = await context.call(() =>
    port.getObject(target, { abortSignal: context.signal }),
  );
  need(
    object.VersionId === id &&
      object.ServerSideEncryption === "aws:kms" &&
      object.SSEKMSKeyId === config.kmsKeyArn,
    "STORAGE_VERSION_OR_KEY_MISMATCH",
  );
  checkRead(await context.read(object.Body, artifact.byteLength), artifact);
  return {
    ...report("aws-s3", artifact, config, id, observedUntil),
    bucket: config.bucket,
    ownerAccountId: config.ownerAccountId,
    kmsKeyArn: config.kmsKeyArn,
  };
}
async function storeAzure(artifact, config, port, authorization, context) {
  const { bytes, retainUntil } = validateRequest(
    artifact,
    config,
    authorization,
  );
  need(
    typeof config.subscriptionId === "string" &&
      /^[0-9a-f-]{36}$/i.test(config.subscriptionId) &&
      typeof config.resourceGroup === "string" &&
      /^[A-Za-z0-9_.()-]{1,90}$/.test(config.resourceGroup) &&
      /^[a-z0-9]{3,24}$/.test(config.account || "") &&
      /^[a-z0-9](?:[a-z0-9-]{1,61})[a-z0-9]$/.test(config.container || "") &&
      !config.container.includes("--") &&
      typeof config.region === "string" &&
      /^[a-z0-9]+$/.test(config.region) &&
      typeof config.encryptionScope === "string" &&
      /^[A-Za-z0-9_-]{1,63}$/.test(config.encryptionScope),
    "AZURE_CONFIG_INVALID",
  );
  const account = await context.call(() =>
      port.getAccountProperties(config.resourceGroup, config.account, {
        abortSignal: context.signal,
      }),
    ),
    expectedId =
      "/subscriptions/" +
      config.subscriptionId +
      "/resourceGroups/" +
      config.resourceGroup +
      "/providers/Microsoft.Storage/storageAccounts/" +
      config.account;
  need(
    typeof account.id === "string" &&
      account.id.toLowerCase() === expectedId.toLowerCase(),
    "STORAGE_ACCOUNT_MISMATCH",
  );
  need(
    account.location?.toLowerCase() === config.region,
    "STORAGE_REGION_MISMATCH",
  );
  const container = port.getContainerClient(config.container),
    expectedUrl =
      "https://" +
      config.account +
      ".blob.core.windows.net/" +
      config.container;
  need(container.url === expectedUrl, "STORAGE_ENDPOINT_MISMATCH");
  const properties = await context.call(() =>
    container.getProperties({ abortSignal: context.signal }),
  );
  need(
    properties.isImmutableStorageWithVersioningEnabled === true,
    "AZURE_VERSION_WORM_REQUIRED",
  );
  const blob = container.getBlockBlobClient(artifact.key);
  need(
    blob.url === expectedUrl + "/" + artifact.key,
    "STORAGE_ENDPOINT_MISMATCH",
  );
  let id;
  try {
    const written = await context.call(() =>
      blob.uploadData(bytes, {
        abortSignal: context.signal,
        conditions: { ifNoneMatch: "*" },
        blobHTTPHeaders: { blobContentType: "application/json" },
        encryptionScope: config.encryptionScope,
        immutabilityPolicy: {
          expiriesOn: new Date(retainUntil),
          policyMode: "Locked",
        },
      }),
    );
    id = written.versionId;
  } catch (error) {
    context.check();
    if (error?.statusCode !== 412)
      throw new StorageError("STORAGE_WRITE_FAILED");
    const existing = await context.call(() =>
      blob.getProperties({ abortSignal: context.signal }),
    );
    id = existing.versionId;
  }
  need(version(id), "STORAGE_VERSION_MISSING");
  const pinned = blob.withVersion(id),
    url = new URL(pinned.url);
  need(
    url.origin === "https://" + config.account + ".blob.core.windows.net" &&
      url.pathname === "/" + config.container + "/" + artifact.key &&
      url.searchParams.get("versionid") === id &&
      [...url.searchParams.keys()].every((key) => key === "versionid"),
    "STORAGE_ENDPOINT_MISMATCH",
  );
  const locked = await context.call(() =>
    pinned.getProperties({ abortSignal: context.signal }),
  );
  need(
    locked.versionId === id &&
      locked.blobType === "BlockBlob" &&
      locked.immutabilityPolicyMode === "Locked" &&
      locked.serverEncrypted === true &&
      locked.encryptionScope === config.encryptionScope,
    "AZURE_IMMUTABILITY_OR_KEY_INVALID",
  );
  const observedUntil = until(locked.immutabilityPolicyExpiresOn);
  need(observedUntil >= retainUntil, "RETENTION_TOO_SHORT");
  const object = await context.call(() =>
    pinned.download(0, undefined, { abortSignal: context.signal }),
  );
  need(object.versionId === id, "STORAGE_VERSION_OR_KEY_MISMATCH");
  checkRead(
    await context.read(object.readableStreamBody, artifact.byteLength),
    artifact,
  );
  return {
    ...report("azure-blob", artifact, config, id, observedUntil),
    accountId: expectedId,
    container: config.container,
    encryptionScope: config.encryptionScope,
  };
}
async function storeGcp(artifact, config, port, authorization, context) {
  const { bytes, retainUntil } = validateRequest(
    artifact,
    config,
    authorization,
  );
  need(
    bucketName(config.bucket) &&
      /^[1-9]\d{5,19}$/.test(String(config.projectNumber || "")) &&
      typeof config.region === "string" &&
      /^[A-Z0-9-]+$/.test(config.region) &&
      typeof config.kmsKeyName === "string" &&
      /^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+$/.test(
        config.kmsKeyName,
      ),
    "GCP_CONFIG_INVALID",
  );
  const bucket = port.bucket(config.bucket),
    [metadata] = await context.call(() => bucket.getMetadata());
  need(
    metadata.name === config.bucket &&
      String(metadata.projectNumber) === String(config.projectNumber),
    "STORAGE_ACCOUNT_MISMATCH",
  );
  need(metadata.location === config.region, "STORAGE_REGION_MISMATCH");
  const period = Number(metadata.retentionPolicy?.retentionPeriod);
  need(
    metadata.retentionPolicy?.isLocked === true &&
      Number.isSafeInteger(period) &&
      period > 0,
    "GCP_BUCKET_LOCK_REQUIRED",
  );
  const file = bucket.file(artifact.key, { kmsKeyName: config.kmsKeyName });
  let id;
  try {
    await context.call(() =>
      file.save(bytes, {
        resumable: false,
        validation: false,
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: "application/json" },
      }),
    );
    id = file.metadata?.generation;
  } catch (error) {
    context.check();
    if (error?.code !== 412) throw new StorageError("STORAGE_WRITE_FAILED");
    const [existing] = await context.call(() => file.getMetadata());
    id = existing.generation;
  }
  need(
    typeof id === "string" && /^[1-9]\d*$/.test(id),
    "STORAGE_VERSION_MISSING",
  );
  const pinned = bucket.file(artifact.key, { generation: id }),
    [object] = await context.call(() => pinned.getMetadata());
  need(
    object.name === artifact.key &&
      object.bucket === config.bucket &&
      object.generation === id &&
      typeof object.kmsKeyName === "string" &&
      object.kmsKeyName.startsWith(config.kmsKeyName + "/cryptoKeyVersions/") &&
      /^\d+$/.test(
        object.kmsKeyName.slice(
          (config.kmsKeyName + "/cryptoKeyVersions/").length,
        ),
      ),
    "STORAGE_VERSION_OR_KEY_MISMATCH",
  );
  const observedUntil = until(object.retentionExpirationTime);
  const bucketProtectedUntil = until(object.timeCreated) + period * 1000;
  need(
    Number.isSafeInteger(period * 1000) &&
      observedUntil >= retainUntil &&
      bucketProtectedUntil >= retainUntil,
    "RETENTION_TOO_SHORT",
  );
  checkRead(
    await context.read(pinned.createReadStream(), artifact.byteLength),
    artifact,
  );
  // Recheck bucket identity/lock after the write, not just before it.
  const [after] = await context.call(() => bucket.getMetadata());
  need(
    after.name === config.bucket &&
      String(after.projectNumber) === String(config.projectNumber) &&
      after.location === config.region &&
      after.retentionPolicy?.isLocked === true &&
      Number(after.retentionPolicy.retentionPeriod) >= period,
    "GCP_LOCK_CHANGED",
  );
  return {
    ...report(
      "gcp-bucket",
      artifact,
      config,
      id,
      Math.min(observedUntil, bucketProtectedUntil),
    ),
    bucket: config.bucket,
    projectNumber: String(config.projectNumber),
    kmsKeyName: object.kmsKeyName,
  };
}
function simulateStorage(artifact, directory) {
  const bytes = bytesFor(artifact),
    root = path.resolve(directory);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(root);
  need(
    process.platform !== "win32" &&
      stat.isDirectory() &&
      !stat.isSymbolicLink() &&
      stat.uid === process.getuid() &&
      (stat.mode & 0o077) === 0,
    "PRIVATE_SIMULATION_DIRECTORY_REQUIRED",
  );
  const file = path.join(root, artifact.sha256 + ".json");
  let fd;
  try {
    fd = fs.openSync(file, "wx", 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
      need(written > 0, "SIMULATION_WRITE_FAILED");
      offset += written;
    }
    fs.fsyncSync(fd);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const entry = fs.lstatSync(file);
    need(
      entry.isFile() && !entry.isSymbolicLink() && (entry.mode & 0o077) === 0,
      "SIMULATION_FILE_INVALID",
    );
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  const directoryFd = fs.openSync(root, "r");
  try {
    fs.fsyncSync(directoryFd);
  } finally {
    fs.closeSync(directoryFd);
  }
  need(
    fs.statSync(file).size === artifact.byteLength,
    "STORAGE_CONTENT_MISMATCH",
  );
  checkRead(fs.readFileSync(file), artifact);
  return {
    schemaVersion: 1,
    kind: "thundy-storage-observation",
    provider: "local-simulation",
    sourceId: artifact.sourceId,
    entryCount: artifact.entryCount,
    objectKey: artifact.key,
    sha256: artifact.sha256,
    byteLength: artifact.byteLength,
    observedAt: new Date().toISOString(),
    immutablePropertiesObserved: false,
    simulated: true,
    liveAcceptance: false,
    sealed: false,
  };
}
function createAwsSdkPort(client, sdk) {
  const map = {
    getBucketLocation: "GetBucketLocationCommand",
    getBucketVersioning: "GetBucketVersioningCommand",
    getObjectLockConfiguration: "GetObjectLockConfigurationCommand",
    putObject: "PutObjectCommand",
    headObject: "HeadObjectCommand",
    getObjectRetention: "GetObjectRetentionCommand",
    getObject: "GetObjectCommand",
  };
  return Object.fromEntries(
    Object.entries(map).map(([method, command]) => [
      method,
      (args, options) => client.send(new sdk[command](args), options),
    ]),
  );
}
function createAzureSdkPort(blobServiceClient, managementClient) {
  return {
    getAccountProperties: (group, account, options) =>
      managementClient.storageAccounts.getProperties(group, account, options),
    getContainerClient: (name) => blobServiceClient.getContainerClient(name),
  };
}
function sanitized(operation) {
  return async (...args) => {
    let context;
    try {
      need(
        args[1] && typeof args[1] === "object" && !Array.isArray(args[1]),
        "STORAGE_CONFIG_INVALID",
      );
      args[1] = { ...args[1] };
      context = operationContext(args[4]);
      args[4] = context;
      const result = await operation(...args);
      context.check();
      return result;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("STORAGE_PROVIDER_UNAVAILABLE");
    } finally {
      context?.close();
    }
  };
}
module.exports = {
  StorageError,
  validateDestination,
  profiles,
  prepareArtifact,
  readBounded,
  storeS3: sanitized(storeS3),
  storeAzure: sanitized(storeAzure),
  storeGcp: sanitized(storeGcp),
  simulateStorage,
  createAwsSdkPort,
  createAzureSdkPort,
};
