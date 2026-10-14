"use strict";
const http = require("node:http");
const { LedgerError } = require("./ledger.cjs");
function createService(ledger) {
  const server = http.createServer(async (req, res) => {
    const reply = (status, data) => {
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };
    try {
      // No browser-facing API, CORS or external bind; admin access is offline/OS-controlled.
      if (req.headers.origin)
        throw new LedgerError("BROWSER_ORIGIN_DENIED", 403);
      if (req.headers.host !== `127.0.0.1:${server.address().port}`)
        throw new LedgerError("HOST_DENIED", 403);
      if (req.method === "POST" && req.url === "/v1/device/events:batch") {
        if (
          req.headers["content-type"]?.split(";")[0].trim() !==
          "application/json"
        )
          throw new LedgerError("JSON_REQUIRED", 415);
        if (Number(req.headers["content-length"]) > 256 * 1024) {
          req.resume();
          reply(413, { error: "BATCH_TOO_LARGE" });
          return;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 256 * 1024) {
            reply(413, { error: "BATCH_TOO_LARGE" });
            return;
          }
          chunks.push(chunk);
        }
        let body;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          throw new LedgerError("JSON_INVALID", 400);
        }
        if (
          !body ||
          Object.keys(body).join(",") !== "events" ||
          !Array.isArray(body.events) ||
          body.events.length < 1 ||
          body.events.length > 100
        )
          throw new LedgerError("BATCH_INVALID", 400);
        const results = body.events.map((envelope) => {
          try {
            return { status: 200, ...ledger.accept(envelope) };
          } catch (error) {
            return {
              status: error.status || 422,
              error: error.code || "EVENT_INVALID",
            };
          }
        });
        reply(
          results.some((item) => item.status === 409)
            ? 409
            : results.some((item) => item.status !== 200)
              ? 207
              : 200,
          { results },
        );
        return;
      }
      const match =
        req.method === "GET" &&
        /^\/v1\/device\/receipts\/([0-9a-f-]{36})$/i.exec(req.url);
      if (match) {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Thundy-Signature ") || auth.length > 8192)
          throw new LedgerError("AUTH_REQUIRED", 401);
        let envelope;
        try {
          envelope = JSON.parse(
            Buffer.from(auth.slice(17), "base64url").toString("utf8"),
          );
        } catch {
          throw new LedgerError("AUTH_INVALID", 401);
        }
        reply(200, { receipt: ledger.readReceipt(match[1], envelope) });
        return;
      }
      reply(404, { error: "NOT_FOUND" });
    } catch (error) {
      reply(error.status || 500, {
        error: error.code || "SERVICE_UNAVAILABLE",
      });
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 1000;
  server.maxHeadersCount = 30;
  return server;
}
module.exports = { createService };
