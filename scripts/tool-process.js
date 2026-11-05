// Bounds for local development tools, not an isolation boundary for untrusted code.
const { spawnSync } = require('node:child_process');
const TOOL_TIMEOUT_MS = 120_000;
const TOOL_MAX_BUFFER = 8 * 1024 * 1024;

function runTool(command, args, { cwd, timeoutMs = TOOL_TIMEOUT_MS, maxBuffer = TOOL_MAX_BUFFER } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || !Number.isSafeInteger(maxBuffer) || maxBuffer <= 0) {
    throw new Error('Tool limits must be positive safe integers');
  }
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    // A tool stuck in synchronous work or ignoring SIGTERM must still stop.
    killSignal: 'SIGKILL',
    maxBuffer,
    windowsHide: true,
  });
}

module.exports = { runTool, TOOL_TIMEOUT_MS, TOOL_MAX_BUFFER };
