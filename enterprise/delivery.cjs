"use strict";
const crypto = require("node:crypto");
const { OutboxError, verifyStagedReceipt } = require("./outbox.cjs");
const { signed, hash } = require("./ledger.cjs");
function localOrigin(raw) {
  if (
    typeof raw !== "string" ||
    !/^http:\/\/127\.0\.0\.1:[1-9]\d{3,4}\/?$/.test(raw)
  )
    throw new OutboxError("LOCAL_ORIGIN_REQUIRED");
  const url = new URL(raw);
  if (Number(url.port) < 1024 || Number(url.port) > 65535)
    throw new OutboxError("LOCAL_ORIGIN_REQUIRED");
  return url.origin;
}
function retryDelay(
  attempt,
  { random = Math.random, retryAfter = null, now = Date.now() } = {},
) {
  const draw = random();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1)
    throw new OutboxError("RETRY_RANDOM_INVALID");
  const backoff = Math.ceil(
    Math.min(300000, 1000 * 2 ** Math.min(attempt - 1, 20)) *
      (0.5 + draw * 0.5),
  );
  let wait = 0;
  if (typeof retryAfter === "string") {
    if (/^\d+$/.test(retryAfter)) {
      const value = Number(retryAfter) * 1000;
      if (Number.isSafeInteger(value)) wait = value;
    } else {
      const value = Date.parse(retryAfter) - now;
      if (Number.isFinite(value)) wait = Math.max(0, value);
    }
  }
  return Math.max(backoff, Math.min(wait, Number.MAX_SAFE_INTEGER - now));
}
async function request(
  origin,
  route,
  options,
  { fetchImpl = fetch, deadlineMs = 10000 } = {},
) {
  if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 10000)
    throw new OutboxError("REQUEST_DEADLINE_INVALID");
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), deadlineMs);
  try {
    const response = await fetchImpl(origin + route, {
      ...options,
      redirect: "error",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400)
      throw new OutboxError("REDIRECT_DENIED");
    const chunks = [];
    let bytes = 0;
    if (!response.body) throw new OutboxError("RESPONSE_INVALID");
    const reader = response.body.getReader();
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 512 * 1024) {
          await reader.cancel();
          throw new OutboxError("RESPONSE_TOO_LARGE");
        }
        chunks.push(Buffer.from(part.value));
      }
    } finally {
      reader.releaseLock();
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new OutboxError("RESPONSE_INVALID");
    }
    return {
      status: response.status,
      body,
      retryAfter: response.headers.get("retry-after"),
    };
  } finally {
    clearTimeout(timer);
  }
}
const permanent = (status) =>
  [400, 401, 403, 404, 409, 413, 415, 422].includes(status);
function fail(outbox, eventId, error, status, retryAfter, random) {
  const item = outbox.items.get(eventId),
    code = /^[A-Z][A-Z0-9_]{0,79}$/.test(error || "")
      ? error
      : "DELIVERY_FAILED";
  if (permanent(status) || item.attempts >= outbox.maxAttempts)
    outbox.state(eventId, "DEAD_LETTER", {
      error: permanent(status) ? code : "RETRY_LIMIT_REACHED",
    });
  else
    outbox.state(eventId, "RETRY", {
      error: code,
      nextAttemptAt:
        outbox.clock() +
        retryDelay(item.attempts, { random, retryAfter, now: outbox.clock() }),
    });
}
async function deliverOnce(outbox, options = {}) {
  const origin = localOrigin(options.serviceOrigin),
    random = options.random || Math.random;
  outbox.ensure();
  if (outbox.busy) throw new OutboxError("OUTBOX_DELIVERY_BUSY");
  outbox.busy = true;
  try {
    const batch = outbox.batch();
    if (!batch.length) return { sent: 0, ...outbox.status() };
    // Persist attempts before transmitting; crashes resume with the exact signed envelopes.
    for (const envelope of batch) {
      const item = outbox.items.get(envelope.payload.eventId);
      outbox.state(envelope.payload.eventId, "ATTEMPT", {
        error: "DELIVERY_IN_FLIGHT",
        nextAttemptAt:
          outbox.clock() +
          retryDelay(item.attempts + 1, { random, now: outbox.clock() }),
      });
    }
    let response;
    try {
      response = await request(
        origin,
        "/v1/device/events:batch",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ events: batch }),
        },
        options,
      );
    } catch (error) {
      for (const envelope of batch)
        fail(
          outbox,
          envelope.payload.eventId,
          error.code || "NETWORK_ERROR",
          503,
          null,
          random,
        );
      return { sent: batch.length, ...outbox.status() };
    }
    if (
      ![200, 207, 409].includes(response.status) ||
      !Array.isArray(response.body.results) ||
      response.body.results.length !== batch.length
    ) {
      for (const envelope of batch)
        fail(
          outbox,
          envelope.payload.eventId,
          "BATCH_RESPONSE_INVALID",
          response.status === 200 ? 503 : response.status,
          response.retryAfter,
          random,
        );
      return { sent: batch.length, ...outbox.status() };
    }
    for (let index = 0; index < batch.length; index++) {
      const envelope = batch[index],
        result = response.body.results[index],
        id = envelope.payload.eventId;
      if (result?.status === 200) {
        let receipt;
        try {
          receipt = verifyStagedReceipt(
            result.receipt,
            envelope,
            outbox.registration,
            outbox.serverKeyId,
            outbox.serverPublicKey,
          );
        } catch (error) {
          fail(outbox, id, error.code || "RECEIPT_INVALID", 503, null, random);
          continue;
        }
        outbox.state(id, "STAGED", {
          receipt,
          nextAttemptAt: outbox.clock() + 60000,
        });
      } else
        fail(
          outbox,
          id,
          result?.error,
          Number.isInteger(result?.status) ? result.status : 503,
          response.retryAfter,
          random,
        );
    }
    return { sent: batch.length, ...outbox.status() };
  } finally {
    outbox.busy = false;
  }
}
async function pollOnce(outbox, options = {}) {
  const origin = localOrigin(options.serviceOrigin);
  outbox.ensure();
  if (outbox.busy) throw new OutboxError("OUTBOX_DELIVERY_BUSY");
  outbox.busy = true;
  try {
    let checked = 0,
      failed = 0;
    const pollErrors = [];
    if (
      options.limit !== undefined &&
      (!Number.isInteger(options.limit) ||
        options.limit < 1 ||
        options.limit > 100)
    )
      throw new OutboxError("POLL_LIMIT_INVALID");
    for (const item of outbox.staged(options.limit || 100)) {
      const id = item.envelope.payload.eventId,
        auth = signed(
          {
            purpose: "receipt-read",
            eventId: id,
            issuedAt: new Date(outbox.clock()).toISOString(),
            nonce: crypto.randomUUID(),
          },
          outbox.registration.keyId,
          outbox.privateKey,
        );
      try {
        const response = await request(
          origin,
          "/v1/device/receipts/" + id,
          {
            method: "GET",
            headers: {
              authorization:
                "Thundy-Signature " +
                Buffer.from(JSON.stringify(auth)).toString("base64url"),
            },
          },
          options,
        );
        if (response.status !== 200)
          throw new OutboxError("RECEIPT_POLL_FAILED");
        const receipt = verifyStagedReceipt(
          response.body.receipt,
          item.envelope,
          outbox.registration,
          outbox.serverKeyId,
          outbox.serverPublicKey,
        );
        if (hash(receipt) !== hash(item.receipt))
          throw new OutboxError("RECEIPT_CHANGED");
      } catch (error) {
        failed++;
        pollErrors.push({
          eventId: id,
          error: error.code || "RECEIPT_POLL_FAILED",
        });
      }
      // Poll scheduling is intentionally process-local; verified payload/receipt stays durable.
      outbox.items.get(id).nextAttemptAt = outbox.clock() + 60000;
      checked++;
    }
    return { checked, failed, pollErrors, ...outbox.status() };
  } finally {
    outbox.busy = false;
  }
}
module.exports = { deliverOnce, pollOnce, localOrigin, retryDelay };
