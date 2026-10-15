"use strict";
// Version 1 public-review contracts; these are not measured writer or filesystem limits.
module.exports = Object.freeze({
  journalBytes: 32 * 1024 * 1024,
  journalActions: 10000,
  contextBytes: 2 * 1024 * 1024,
  packageBytes: 92 * 1024 * 1024,
  observations: 10000,
  deviceComparisons: 200000,
});
