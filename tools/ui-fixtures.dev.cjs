"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { fixtures } = require("../enterprise/test/design-fixtures.cjs"),
  { fixture } = require("../enterprise/test/alert-review-fixtures.cjs"),
  { CapacityAlerts } = require("../enterprise/capacity_alerts.cjs"),
  { reviewHtml } = require("../enterprise/capacity_alerts_review.cjs");
const languages = ["en", "de", "fr", "es", "it", "pl"];
function createReviews() {
  const cleanup = [],
    pages = new Map(),
    kinds = [];
  try {
    for (const empty of [false, true]) {
      const f = fixtures(empty);
      cleanup.push(() => f.cleanup());
      for (const kind of Object.keys(f.data)) {
        if (!kinds.includes(kind)) kinds.push(kind);
        for (const lang of languages)
          pages.set(
            `/review/${kind}/${empty ? "empty" : "full"}/${lang}`,
            f.html(kind, lang),
          );
      }
    }
    const f = fixture(true, { maxPending: 5 });
    cleanup.push(() => f.cleanup());
    const source = () => fs.readFileSync(f.store.journal.logPath);
    f.monitor.observe(source());
    f.advance(1);
    f.accept(1);
    f.monitor.observe(source());
    f.advance(1000);
    f.monitor.observe(source());
    f.advance(1000);
    f.monitor.observe(source());
    const keys = crypto.generateKeyPairSync("ed25519"),
      policy = {
        trustedContext: f.pub,
        warningPercent: 80,
        recoveryPercent: 70,
        cooldownMs: 1000,
        maxPending: 100,
      },
      monitor = new CapacityAlerts({
        ...policy,
        directory: path.join(f.root, "capacity"),
        signerKeyId: "ui-capacity",
        signerPrivateKey: keys.privateKey,
        clock: () => f.monitor.journal.now(),
      });
    cleanup.push(() => monitor.close());
    monitor.observeJournals(fs.readFileSync(f.journal), source());
    monitor.acknowledge(monitor.pending()[0].notificationId, {
      consumerId: "synthetic-admin",
    });
    f.monitor.acknowledge(f.monitor.pending()[0].notificationId, {
      consumerId: "synthetic-collector",
    });
    f.advance(1);
    monitor.observeJournals(fs.readFileSync(f.journal), source());
    const content = fs.readFileSync(monitor.journal.logPath),
      context = {
        ...policy,
        signerKeyId: "ui-capacity",
        signerPublicKey: keys.publicKey,
      };
    kinds.push("capacity-alerts");
    for (const empty of [false, true])
      for (const lang of languages)
        pages.set(
          `/review/capacity-alerts/${empty ? "empty" : "full"}/${lang}`,
          reviewHtml(empty ? "" : content, context, lang),
        );
    return {
      pages,
      kinds,
      cleanup: () => cleanup.reverse().forEach((fn) => fn()),
    };
  } catch (error) {
    cleanup.reverse().forEach((fn) => fn());
    throw error;
  }
}
// Runs in an isolated browser context; only synthetic Thunderbird API responses.
function addonMock({ catalog, lang, mode = "system", version }) {
  const state = {
      thundyAppearance: mode,
      thundyAccent: "ocean",
      thundyDensity: "comfortable",
      externalAnalysisConsent: false,
    },
    callbacks = [];
  window.uiTest = {
    writes: [],
    failSave: false,
    failLoad: false,
    permissionRequests: 0,
  };
  const t = (key, values = []) => {
    const item = catalog[key];
    if (!item) return "";
    if (!Array.isArray(values)) values = [values];
    return item.message.replace(/\$([A-Z0-9_]+)\$/g, (all, name) => {
      const p = item.placeholders?.[name.toLowerCase()];
      return p
        ? p.content.replace(/\$(\d+)/g, (_, i) => values[Number(i) - 1] ?? "")
        : all;
    });
  };
  window.browser = {
    i18n: { getUILanguage: () => lang, getMessage: t },
    theme: {
      getCurrent: async () => ({}),
      onUpdated: { addListener: () => {} },
    },
    storage: {
      local: {
        get: async () => {
          if (uiTest.failLoad) throw Error("synthetic load failure");
          return { ...state };
        },
        set: async (p) => {
          if (uiTest.failSave) throw Error("synthetic save failure");
          uiTest.writes.push(p);
          Object.assign(state, p);
          const changes = Object.fromEntries(
            Object.entries(p).map(([k, newValue]) => [k, { newValue }]),
          );
          callbacks.forEach((fn) => fn(changes, "local"));
        },
        remove: async (k) => {
          delete state[k];
        },
      },
      onChanged: { addListener: (fn) => callbacks.push(fn) },
    },
    permissions: {
      getAll: async () => ({}),
      request: async () => {
        uiTest.permissionRequests++;
        return false;
      },
      remove: async () => true,
      contains: async () => false,
    },
    tabs: { query: async () => [{ id: 1 }] },
    messageDisplay: { getDisplayedMessages: async () => ({ messages: [] }) },
    runtime: {
      getURL: (p) => new URL(p, location.origin).href,
      getManifest: () => ({ version }),
      openOptionsPage: async () => {},
      onMessage: { addListener: () => {} },
      sendMessage: async (p) =>
        p.action === "getLinkAudit"
          ? {
              success: true,
              records: [],
              profileId: "synthetic-local",
              retentionDays: 30,
              maxRecords: 1000,
            }
          : { status: "success" },
    },
    downloads: { download: async () => 1 },
  };
}
module.exports = { languages, createReviews, addonMock };
