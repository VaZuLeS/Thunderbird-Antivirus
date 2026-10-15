"use strict";
const path = require("node:path");
const { exact } = require("./durable_journal.cjs");
const { readJournal, publicKeyFile } = require("./storage_verify.cjs");
function loadHeartbeatPublicConfig(file) {
  const json = (file, max) =>
    JSON.parse(readJournal(file, max).toString("utf8"));
  const c = json(file, 65536);
  if (
    !exact(
      c,
      "schemaVersion,signerKeyId,signerPublicKeyFile,heartbeatConfigFile,cooldownMs,maxSnapshotAgeMs,maxPending",
    ) ||
    c.schemaVersion !== 1
  )
    throw new Error("HEARTBEAT_ALERT_CONFIG_INVALID");
  for (const k of ["signerPublicKeyFile", "heartbeatConfigFile"])
    if (typeof c[k] !== "string" || !path.isAbsolute(c[k]))
      throw new Error("HEARTBEAT_ALERT_CONFIG_PATH_INVALID");
  const h = json(c.heartbeatConfigFile, 65536);
  if (
    !exact(
      h,
      "schemaVersion,organizationId,signerKeyId,signerPublicKeyFile,registryFile,minimumExtensionVersion,lateAfterMs,unknownAfterMs,maxClockSkewMs",
    ) ||
    h.schemaVersion !== 1
  )
    throw new Error("HEARTBEAT_CONFIG_INVALID");
  for (const k of ["signerPublicKeyFile", "registryFile"])
    if (typeof h[k] !== "string" || !path.isAbsolute(h[k]))
      throw new Error("HEARTBEAT_CONFIG_PATH_INVALID");
  const registry = json(h.registryFile, 1024 * 1024);
  if (!exact(registry, "registrations"))
    throw new Error("HEARTBEAT_REGISTRY_INVALID");
  const source = {
    organizationId: h.organizationId,
    registrations: registry.registrations,
    minimumExtensionVersion: h.minimumExtensionVersion,
    lateAfterMs: h.lateAfterMs,
    unknownAfterMs: h.unknownAfterMs,
    maxClockSkewMs: h.maxClockSkewMs,
    signerKeyId: h.signerKeyId,
    signerPublicKey: publicKeyFile(h.signerPublicKeyFile),
  };
  return {
    source,
    signerKeyId: c.signerKeyId,
    signerPublicKey: publicKeyFile(c.signerPublicKeyFile),
    cooldownMs: c.cooldownMs,
    maxSnapshotAgeMs: c.maxSnapshotAgeMs,
    maxPending: c.maxPending,
  };
}
module.exports = { loadHeartbeatPublicConfig };
