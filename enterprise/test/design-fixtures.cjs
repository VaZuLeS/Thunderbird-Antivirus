"use strict";
const fs = require("node:fs");
const { fixture: heartbeat } = require("./heartbeat-review-fixtures.cjs"),
  { fixture: alerts } = require("./alert-review-fixtures.cjs"),
  { fixture: cases } = require("./cases-review-fixtures.cjs"),
  { fixture: storage, at } = require("./storage-review-fixtures.cjs");
const { summarize } = require("../health.cjs"),
  { capacityFromJournals } = require("../capacity.cjs");
function fixtures(empty = false) {
  const h = heartbeat(empty ? 1 : 3),
    a = alerts(empty);
  const outbox = {
    counts: { PENDING: 0, RETRY: empty ? 0 : 1, STAGED: 0, DEAD_LETTER: 0 },
    bytes: empty ? 0 : 10,
    maxBytes: 100,
    retainedEvents: empty ? 0 : 1,
    maxEvents: 100,
    oldestQueuedAt: null,
    errors: [],
  };
  const event = (id, score, outcome, time) => ({
    eventEnvelope: {
      payload: {
        interactionId: id,
        deviceId: "test-device",
        streamEpoch: "test-epoch",
        urlRedacted: "https://" + id + ".example.invalid/path",
        observedAt: time,
        assessment: { localScore: score, providerVerdict: "NOT_CHECKED" },
        kind: "DECISION",
        outcome,
      },
    },
    receipt: { payload: { organizationId: "test-org" }, receivedAt: time },
  });
  const data = {
    events: empty
      ? []
      : [
          event("earlier", 80, "OPENED", "2026-10-15T07:00:00Z"),
          event("later", 18, "ABORTED", "2026-10-15T08:00:00Z"),
        ],
    storage: storage(empty ? 0 : 6),
    cases: cases(empty ? 0 : 3),
    health: summarize(
      { sourceId: "design-test", capturedAt: at, outbox },
      Date.parse(at),
    ),
    heartbeats: h.report,
    alerts: a.report,
    capacity: capacityFromJournals(
      fs.readFileSync(a.journal),
      fs.readFileSync(a.store.journal.logPath),
      { trustedContext: a.pub },
    ),
  };
  const modules = {
    events: "review",
    storage: "storage_review",
    cases: "cases_review",
    health: "health_review",
    heartbeats: "heartbeats_review",
    alerts: "heartbeat_alerts_review",
    capacity: "capacity_review",
  };
  return {
    data,
    html: (kind, lang) =>
      require("../" + modules[kind] + ".cjs").reviewHtml(data[kind], lang),
    cleanup() {
      h.cleanup();
      a.cleanup();
    },
  };
}
module.exports = { fixtures };
