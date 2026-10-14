"use strict";
const crypto = require("node:crypto");
const hash = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");
const at = "2026-10-14T12:00:00.000Z";
function fixture(count = 6) {
  const statuses = [
    "QUEUED",
    "WRITING",
    "RETRY",
    "DEAD_LETTER",
    "SIMULATION_COMPLETE",
    "CLOUD_OBSERVED",
  ];
  return {
    schemaVersion: 1,
    kind: "thundy-storage-jobs-status",
    head: hash("head"),
    journalBytes: 80,
    maxBytes: 100,
    maxJobs: 1000,
    maxAttempts: 5,
    capacityWarning: true,
    sealed: false,
    jobs: Array.from({ length: count }, (_, i) => ({
      jobId: hash(i),
      status: statuses[i % 6],
      queuedAt: at,
      updatedAt: at,
      observedAt: i % 6 >= 4 ? at : null,
      evidenceStatus: "STAGED",
      provider: i % 6 === 4 ? "local-simulation" : "aws-s3",
      objectVersion: i % 6 === 5 ? "v1" : null,
      requestedRetainUntil:
        i % 6 === 4
          ? null
          : i % 6 === 5
            ? "2026-10-13T00:00:00.000Z"
            : "2027-10-14T00:00:00.000Z",
      observedRetainUntil: i % 6 === 5 ? "2026-10-13T00:00:00.000Z" : null,
      transportVerified: false,
      sourceId: hash("source"),
      sha256: hash("object" + i),
      entryCount: 6,
      attempts: i % 6 === 0 ? 0 : 1,
      totalAttempts: i % 6 === 0 ? 0 : 2,
      nextAttemptAt: i % 6 === 2 ? "2026-10-14T12:01:00.000Z" : null,
      error:
        i % 6 === 2
          ? "STORAGE_TIMEOUT"
          : i % 6 === 3
            ? "STORAGE_CONTENT_MISMATCH"
            : null,
      simulated: i % 6 === 4 ? true : null,
      sealed: false,
    })),
  };
}

module.exports = { fixture, at, hash };
