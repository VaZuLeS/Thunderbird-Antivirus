"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const {
  DurableJournal,
  need,
  clone,
  exact,
  hex,
  identifier,
  iso,
  syncDirectory,
} = require("./durable_journal.cjs");
const { deriveIncidents } = require("./incidents.cjs");
const { hash, deviceRegistry } = require("./ledger.cjs");
const { readJournal } = require("./storage_verify.cjs");
const profiles = require("../enterprise_profiles.js");
const FORMATS = {
  splunk: "splunk-hec",
  elastic: "elasticsearch-bulk",
  sentinel: "azure-monitor-logs",
  "generic-https": "https-json",
};
function recordFor(incident, report) {
  return {
    schemaVersion: 1,
    incidentId: incident.incidentId,
    ruleId: incident.ruleId,
    severity: incident.severity,
    organizationId: incident.organizationId,
    decisionAt: incident.decisionAt,
    outcome: incident.outcome,
    attemptNumber: incident.attemptNumber,
    urlMode: "domain_only",
    urlRedacted: incident.urlRedacted,
    scoreAtDecision: incident.assessmentAtDecision.localScore,
    provider: incident.assessmentAtDecision.provider,
    providerVerdict: incident.assessmentAtDecision.providerVerdict,
    modelVersion: incident.assessmentAtDecision.modelVersion,
    assessmentAt: incident.assessmentAtDecision.observedAt,
    policyId: incident.policyId,
    policyVersion: incident.policyVersion,
    decisionEventId: incident.decisionEventId,
    eventEnvelopeHash: incident.eventEnvelopeHash,
    receiptHash: incident.receiptHash,
    sourceId: report.evidence.sourceId,
    ruleSetId: report.ruleSet.ruleSetId,
    ruleSetVersion: report.ruleSet.version,
    ruleSetHash: report.ruleSet.hash,
    evidenceStatus: "STAGED",
    sealed: false,
  };
}
function encode(record, profileId) {
  if (profileId === "splunk")
    return (
      JSON.stringify({
        time: Date.parse(record.decisionAt) / 1000,
        source: "thundy-av",
        sourcetype: "thundy:incident",
        event: record,
      }) + "\n"
    );
  if (profileId === "elastic")
    return (
      JSON.stringify({ create: { _id: record.incidentId } }) +
      "\n" +
      JSON.stringify(record) +
      "\n"
    );
  if (profileId === "sentinel")
    return (
      JSON.stringify([{ TimeGenerated: record.decisionAt, ...record }]) + "\n"
    );
  if (profileId === "generic-https") return JSON.stringify(record) + "\n";
  throw new Error("CONNECTOR_PROFILE_UNSUPPORTED");
}
function validateRecord(r) {
  need(
    exact(
      r,
      "schemaVersion,incidentId,ruleId,severity,organizationId,decisionAt,outcome,attemptNumber,urlMode,urlRedacted,scoreAtDecision,provider,providerVerdict,modelVersion,assessmentAt,policyId,policyVersion,decisionEventId,eventEnvelopeHash,receiptHash,sourceId,ruleSetId,ruleSetVersion,ruleSetHash,evidenceStatus,sealed",
    ) &&
      r.schemaVersion === 1 &&
      r.urlMode === "domain_only" &&
      r.evidenceStatus === "STAGED" &&
      r.sealed === false &&
      [
        r.incidentId,
        r.eventEnvelopeHash,
        r.receiptHash,
        r.sourceId,
        r.ruleSetHash,
      ].every(hex) &&
      identifier(r.ruleId) &&
      identifier(r.ruleSetId) &&
      Number.isSafeInteger(r.ruleSetVersion) &&
      r.ruleSetVersion > 0,
    "CONNECTOR_RECORD_INVALID",
  );
  // Internal records originate in verified decision exports; replay also enforces minimization.
  const { redactUrl } = require("./contracts.cjs");
  need(
    redactUrl(r.urlRedacted).urlRedacted === r.urlRedacted,
    "CONNECTOR_URL_INVALID",
  );
}
function exportFormats(data, rules, trust, profileId) {
  need(Object.hasOwn(FORMATS, profileId), "CONNECTOR_PROFILE_UNSUPPORTED");
  const report = deriveIncidents(data, rules, trust);
  return report.incidents.map((i) => encode(recordFor(i, report), profileId));
}
class ConnectorQueue {
  constructor({
    directory,
    outputDirectory,
    signerKeyId,
    signerPrivateKey,
    trust,
    organizationId,
    profileId = "none",
    clock = Date.now,
    maxJobs = 1000,
    maxAttempts = 5,
    retryBaseMs = 1000,
    ...options
  }) {
    need(
      Object.keys(options).every((key) =>
        ["maxBytes", "maxActions", "expectedHead", "io"].includes(key),
      ),
      "CONNECTOR_OPTION_UNSUPPORTED",
    );
    need(
      profileId === "none" || Object.hasOwn(FORMATS, profileId),
      "CONNECTOR_PROFILE_UNSUPPORTED",
    );
    need(
      typeof organizationId === "string" &&
        /^[a-f0-9-]{36}$/i.test(organizationId) &&
        trust &&
        identifier(trust.serverKeyId) &&
        Array.isArray(trust.registrations),
      "CONNECTOR_TRUST_INVALID",
    );
    deviceRegistry(trust.registrations);
    need(
      trust.serverPublicKey?.type === "public" ||
        (typeof trust.serverPublicKey === "string" &&
          /^-----BEGIN PUBLIC KEY-----\r?\n/.test(trust.serverPublicKey) &&
          !trust.serverPublicKey.includes("PRIVATE KEY")),
      "CONNECTOR_PUBLIC_KEY_REQUIRED",
    );
    const publicKey =
      trust.serverPublicKey?.type === "public"
        ? trust.serverPublicKey
        : crypto.createPublicKey(trust.serverPublicKey);
    need(
      publicKey.asymmetricKeyType === "ed25519" &&
        trust.registrations.every(
          (r) =>
            r.organizationId === organizationId &&
            typeof r.publicKey === "string" &&
            /^-----BEGIN PUBLIC KEY-----\r?\n/.test(r.publicKey) &&
            !r.publicKey.includes("PRIVATE KEY"),
        ),
      "CONNECTOR_TRUST_INVALID",
    );
    need(
      Number.isSafeInteger(maxJobs) &&
        maxJobs > 0 &&
        maxJobs <= 10000 &&
        Number.isSafeInteger(maxAttempts) &&
        maxAttempts > 0 &&
        maxAttempts <= 20 &&
        Number.isSafeInteger(retryBaseMs) &&
        retryBaseMs > 0 &&
        retryBaseMs <= 3600000,
      "CONNECTOR_LIMIT_INVALID",
    );
    this.trust = {
      serverKeyId: trust.serverKeyId,
      serverPublicKey: publicKey,
      registrations: clone(trust.registrations),
    };
    this.organizationId = organizationId;
    this.profileId = profileId;
    this.maxJobs = maxJobs;
    this.maxAttempts = maxAttempts;
    this.retryBaseMs = retryBaseMs;
    this.outputDirectory = path.resolve(outputDirectory);
    fs.mkdirSync(this.outputDirectory, { recursive: true, mode: 0o700 });
    this.checkOutputDirectory();
    const trustId = hash({
      ...this.trust,
      serverPublicKey: publicKey.export({ type: "spki", format: "pem" }),
    });
    this.journal = new DurableJournal({
      directory,
      signerKeyId,
      signerPrivateKey,
      clock,
      ...options,
      scope: {
        kind: "connector-v1",
        organizationId,
        profileId,
        trustId,
        outputDirectory: this.outputDirectory,
        maxJobs,
        maxAttempts,
        retryBaseMs,
      },
      initialState: { jobs: {} },
      reducer: (state, p) => {
        const d = p.data;
        if (p.kind === "QUEUED") {
          need(
            exact(d, "jobId,record,artifactHash") &&
              hex(d.jobId) &&
              hex(d.artifactHash) &&
              !Object.hasOwn(state.jobs, d.jobId) &&
              Object.keys(state.jobs).length < maxJobs,
            "CONNECTOR_QUEUE_INVALID",
          );
          validateRecord(d.record);
          need(
            d.record.organizationId === organizationId &&
              d.jobId ===
                hash({ profileId, incidentId: d.record.incidentId }) &&
              d.artifactHash === this.artifactHash(encode(d.record, profileId)),
            "CONNECTOR_BINDING_INVALID",
          );
          state.jobs[d.jobId] = {
            ...d,
            status: "QUEUED",
            attempts: 0,
            totalAttempts: 0,
            nextAttemptAt: null,
            error: null,
            queuedAt: p.at,
            updatedAt: p.at,
          };
        } else {
          need(
            d && hex(d.jobId) && Object.hasOwn(state.jobs, d.jobId),
            "CONNECTOR_JOB_UNKNOWN",
          );
          const job = state.jobs[d.jobId];
          if (p.kind === "ATTEMPT") {
            need(
              exact(d, "jobId") &&
                ["QUEUED", "RETRY"].includes(job.status) &&
                job.attempts < maxAttempts &&
                (!job.nextAttemptAt ||
                  Date.parse(job.nextAttemptAt) <= Date.parse(p.at)),
              "CONNECTOR_ATTEMPT_INVALID",
            );
            job.status = "WRITING";
            job.attempts++;
            job.totalAttempts++;
            job.nextAttemptAt = null;
            job.error = null;
          } else if (p.kind === "EXPORTED") {
            need(
              exact(d, "jobId") && job.status === "WRITING",
              "CONNECTOR_TRANSITION_INVALID",
            );
            job.status = "EXPORTED";
            job.error = null;
          } else if (p.kind === "FAILED") {
            need(
              exact(d, "jobId,error") &&
                job.status === "WRITING" &&
                [
                  "LOCAL_EXPORT_FAILED",
                  "LOCAL_EXPORT_CONFLICT",
                  "LOCAL_EXPORT_INTERRUPTED",
                ].includes(d.error),
              "CONNECTOR_TRANSITION_INVALID",
            );
            job.status = job.attempts >= maxAttempts ? "DEAD_LETTER" : "RETRY";
            job.error = d.error;
            job.nextAttemptAt =
              job.status === "RETRY"
                ? new Date(
                    Date.parse(p.at) +
                      Math.min(retryBaseMs * 2 ** (job.attempts - 1), 3600000),
                  ).toISOString()
                : null;
          } else if (p.kind === "RETRY_RESET") {
            need(
              exact(d, "jobId") && job.status === "DEAD_LETTER",
              "CONNECTOR_TRANSITION_INVALID",
            );
            job.status = "QUEUED";
            job.attempts = 0;
            job.error = null;
            job.nextAttemptAt = null;
          } else throw new Error("CONNECTOR_ACTION_INVALID");
          job.updatedAt = p.at;
        }
        return state;
      },
    });
  }
  artifactHash(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
  checkOutputDirectory() {
    const stat = fs.lstatSync(this.outputDirectory);
    need(
      process.platform !== "win32" &&
        stat.isDirectory() &&
        !stat.isSymbolicLink() &&
        stat.uid === process.getuid() &&
        (stat.mode & 0o077) === 0,
      "CONNECTOR_OUTPUT_DIRECTORY_INVALID",
    );
  }
  enqueue(data, rules, { expectedHead } = {}) {
    need(this.profileId !== "none", "CONNECTOR_DISABLED");
    need(
      rules.organizationId === this.organizationId,
      "CONNECTOR_ORGANIZATION_MISMATCH",
    );
    this.journal.now();
    const report = deriveIncidents(data, rules, {
      ...this.trust,
      ...(expectedHead !== undefined ? { expectedHead } : {}),
    });
    const records = report.incidents.map((i) => recordFor(i, report));
    const results = [];
    // Capacity/conflicts checked for the complete batch before any append.
    const state = this.journal.snapshot(),
      newJobs = [];
    for (const record of records) {
      const jobId = hash({
          profileId: this.profileId,
          incidentId: record.incidentId,
        }),
        artifactHash = this.artifactHash(encode(record, this.profileId)),
        old = state.jobs[jobId];
      need(!old || old.artifactHash === artifactHash, "CONNECTOR_JOB_CONFLICT");
      if (!old) newJobs.push({ jobId, record, artifactHash });
      results.push({ jobId, duplicate: !!old });
    }
    need(
      Object.keys(state.jobs).length + newJobs.length <= this.maxJobs,
      "CONNECTOR_CAPACITY",
    );
    const estimated = newJobs.reduce(
      (n, j) => n + Buffer.byteLength(JSON.stringify(j)) + 1024,
      0,
    );
    need(
      this.journal.bytes + estimated <= this.journal.maxBytes &&
        this.journal.records.length + newJobs.length <= this.journal.maxActions,
      "JOURNAL_CAPACITY",
    );
    for (const job of newJobs) this.journal.append("QUEUED", job);
    return results;
  }
  outputPath(jobId) {
    return path.join(
      this.outputDirectory,
      jobId +
        "." +
        FORMATS[this.profileId] +
        (this.profileId === "elastic" ? ".ndjson" : ".json"),
    );
  }
  exportOne() {
    need(this.profileId !== "none", "CONNECTOR_DISABLED");
    const now = this.journal.now(),
      state = this.journal.snapshot();
    const job = Object.values(state.jobs).find(
      (j) =>
        j.status === "WRITING" ||
        (["QUEUED", "RETRY"].includes(j.status) &&
          (!j.nextAttemptAt || Date.parse(j.nextAttemptAt) <= now)),
    );
    if (!job) return null;
    if (job.status !== "WRITING")
      this.journal.append("ATTEMPT", { jobId: job.jobId });
    const artifact = encode(job.record, this.profileId),
      file = this.outputPath(job.jobId);
    try {
      this.checkOutputDirectory();
      if (
        fs.existsSync(file) ||
        fs.lstatSync(this.outputDirectory).isSymbolicLink()
      ) {
        const stat = fs.lstatSync(file);
        need(
          stat.isFile() &&
            !stat.isSymbolicLink() &&
            stat.uid === process.getuid() &&
            (stat.mode & 0o077) === 0 &&
            readJournal(file, 65536).toString("utf8") === artifact,
          "LOCAL_EXPORT_CONFLICT",
        );
        const fd = fs.openSync(
          file,
          fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
        );
        try {
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
      } else {
        const fd = fs.openSync(file, "wx", 0o600);
        try {
          fs.writeFileSync(fd, artifact);
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
      }
      syncDirectory(this.outputDirectory);
      syncDirectory(path.dirname(this.outputDirectory));
    } catch (error) {
      this.journal.append("FAILED", {
        jobId: job.jobId,
        error:
          error.code === "LOCAL_EXPORT_CONFLICT"
            ? "LOCAL_EXPORT_CONFLICT"
            : "LOCAL_EXPORT_FAILED",
      });
      return this.summary(this.journal.snapshot().jobs[job.jobId]);
    }
    // If journaling fails, leave a complete file for matching-content recovery.
    this.journal.append("EXPORTED", { jobId: job.jobId });
    return this.summary(this.journal.snapshot().jobs[job.jobId]);
  }
  retry(jobId) {
    this.journal.append("RETRY_RESET", { jobId });
    return this.status();
  }
  summary(job) {
    return {
      jobId: job.jobId,
      status: job.status,
      attempts: job.attempts,
      totalAttempts: job.totalAttempts,
      nextAttemptAt: job.nextAttemptAt,
      error: job.error,
      queuedAt: job.queuedAt,
      updatedAt: job.updatedAt,
      artifactHash: job.artifactHash,
    };
  }
  status() {
    const state = this.journal.snapshot();
    return {
      schemaVersion: 1,
      kind: "thundy-connector-status",
      profileId: this.profileId,
      format: FORMATS[this.profileId] || null,
      mode: "offline-export-only",
      transportEnabled: false,
      remoteDeliveryVerified: false,
      sealed: false,
      head: this.journal.head(),
      journalBytes: this.journal.bytes,
      maxBytes: this.journal.maxBytes,
      maxJobs: this.maxJobs,
      jobs: Object.values(state.jobs).map((j) => this.summary(j)),
    };
  }
  close() {
    this.journal.close();
  }
}
function profile(profileId) {
  need(
    profileId === "none" || Object.hasOwn(FORMATS, profileId),
    "CONNECTOR_PROFILE_UNSUPPORTED",
  );
  return {
    schemaVersion: 1,
    kind: "thundy-connector-profile",
    profileId,
    format: FORMATS[profileId] || null,
    enabled: false,
    transportEnabled: false,
    requiredSettings: profiles.categories.siem
      .find((p) => p.id === profileId)
      .requiredSettings.slice(),
    secretReferences: profiles.categories.siem
      .find((p) => p.id === profileId)
      .secretRefs.slice(),
  };
}
module.exports = { ConnectorQueue, exportFormats, profile };
