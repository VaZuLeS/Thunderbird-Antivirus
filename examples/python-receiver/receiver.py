"""Standalone HTTPS receiver and durable SMTP outbox for Thundy events."""

import argparse
import asyncio
import hashlib
import ipaddress
import json
import logging
import os
import secrets
import smtplib
import sqlite3
import ssl
import time
import tomllib
from contextlib import closing, suppress
from dataclasses import dataclass
from datetime import datetime, timezone
from email.headerregistry import Address
from pathlib import Path

from aiohttp import web

from event import InvalidEvent, SHA256, TOKEN, UUID, build_mail, matches, parse_event


LOG = logging.getLogger("thundy-receiver")
PATH = "/thundy/events"
BODY_LIMIT = 16 * 1024
LEASE_SECONDS = 300


@dataclass(frozen=True)
class Relay:
    host: str
    port: int
    tls: str
    sender: Address
    recipient: Address
    username: str = ""
    password: str = ""


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    tls: ssl.SSLContext | None
    clients: dict[str, str]
    relay: Relay


def loopback(host):
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def load_settings(config, path):
    http = config["http"]
    tls = None
    ipaddress.ip_address(http["host"])
    cert, key = http.get("certificate"), http.get("key")
    if cert and key:
        tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        tls.minimum_version = ssl.TLSVersion.TLSv1_2
        tls.load_cert_chain(path.parent / cert, path.parent / key)
    elif cert or key or not loopback(http["host"]) or http.get("allow_loopback_http") is not True:
        raise ValueError("HTTPS requires certificate and key. Plain HTTP requires an explicit loopback setting.")
    smtp = config["smtp"]
    mode = smtp["tls"]
    username = smtp.get("username", "")
    password = os.environ.get(smtp.get("password_env", "THUNDY_SMTP_PASSWORD"), "")
    if mode not in ("starttls", "implicit", "local") or mode == "local" and (not loopback(smtp["host"]) or username):
        raise ValueError("SMTP needs TLS except for an unauthenticated loopback relay.")
    if username and not password:
        raise ValueError("The configured SMTP password environment variable is unset.")
    sender, recipient = (Address(addr_spec=smtp[field]) for field in ("from", "to"))
    if not all(value.username and value.domain and value.addr_spec.isascii() for value in (sender, recipient)):
        raise ValueError("Configure one complete ASCII mailbox each for SMTP from and to.")
    clients = config["clients"]
    if not clients or any(not matches(SHA256, digest) or not isinstance(label, str) or not label.strip() or len(label) > 80
                          for digest, label in clients.items()):
        raise ValueError("Configure a client token SHA-256 and device label under [clients].")
    if any(type(port) is not int or not 1 <= port <= 65535 for port in (http["port"], smtp["port"])):
        raise ValueError("HTTP and SMTP ports must be between 1 and 65535.")
    return Settings(http["host"], http["port"], tls, clients,
                    Relay(smtp["host"], smtp["port"], mode, sender, recipient, username, password))


def queue_settings(config, path):
    storage = config["storage"]
    retention = storage.get("retention_days", 30)
    limit = storage.get("queue_limit", 10000)
    if type(retention) is not int or retention < 2 or type(limit) is not int or limit < 1:
        raise ValueError("Retention must be at least 2 days and queue_limit must be positive.")
    return path.parent / storage["database"], limit, retention


class Queue:
    def __init__(self, path, limit, retention_days):
        self.path = path
        self.limit = limit
        self.retention_seconds = retention_days * 86400
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with closing(self.connect()) as conn, conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS outbound_events (
                    id TEXT PRIMARY KEY, device TEXT NOT NULL, fingerprint TEXT NOT NULL,
                    payload TEXT, received_at INTEGER NOT NULL, next_at INTEGER NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0, sent_at INTEGER, last_error TEXT,
                    lease TEXT, lease_until INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS due_events ON outbound_events(next_at, received_at) WHERE sent_at IS NULL;
                CREATE INDEX IF NOT EXISTS sent_events ON outbound_events(sent_at) WHERE sent_at IS NOT NULL;
            """)

    def connect(self):
        conn = sqlite3.connect(self.path, timeout=2)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA synchronous=FULL")
        conn.execute("PRAGMA secure_delete=ON")
        return conn

    def accept(self, event, device, now):
        payload = json.dumps(event, sort_keys=True, separators=(",", ":"), allow_nan=False)
        fingerprint = hashlib.sha256(payload.encode("ascii")).hexdigest()
        identifier = event["id"].lower()
        with closing(self.connect()) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            existing = conn.execute("SELECT device, fingerprint FROM outbound_events WHERE id=?", (identifier,)).fetchone()
            if existing:
                return "duplicate" if (existing["device"], existing["fingerprint"]) == (device, fingerprint) else "conflict"
            if conn.execute("SELECT count(*) FROM outbound_events WHERE sent_at IS NULL").fetchone()[0] >= self.limit:
                return "full"
            conn.execute("INSERT INTO outbound_events(id, device, fingerprint, payload, received_at, next_at) VALUES(?,?,?,?,?,?)",
                         (identifier, device, fingerprint, payload, now, now))
        return "accepted"

    def claim(self, now):
        lease = secrets.token_hex(16)
        with closing(self.connect()) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("""SELECT id, payload, device, attempts FROM outbound_events
                WHERE sent_at IS NULL AND next_at<=? AND lease_until<=? ORDER BY next_at, received_at LIMIT 1""",
                               (now, now)).fetchone()
            if not row:
                return None
            conn.execute("UPDATE outbound_events SET lease=?, lease_until=? WHERE id=?", (lease, now + LEASE_SECONDS, row["id"]))
            return dict(row, lease=lease)

    def complete(self, item, now, failure=None):
        with closing(self.connect()) as conn, conn:
            args = (item["id"], item["lease"])
            if failure is None:
                conn.execute("""UPDATE outbound_events SET sent_at=?, payload=NULL, last_error=NULL, lease=NULL, lease_until=0
                    WHERE id=? AND lease=?""", (now, *args))
            else:
                delay = min(3600, 30 * 2 ** min(item["attempts"], 7))
                conn.execute("""UPDATE outbound_events SET next_at=?, attempts=attempts+1, last_error=?, lease=NULL, lease_until=0
                    WHERE id=? AND lease=?""", (now + delay, failure, *args))

    def prune(self, now):
        with closing(self.connect()) as conn, conn:
            conn.execute("DELETE FROM outbound_events WHERE sent_at <= ?", (now - self.retention_seconds,))

    def status(self):
        with closing(self.connect()) as conn:
            pending, oldest, retries = conn.execute("""SELECT count(*), min(received_at), count(last_error)
                FROM outbound_events WHERE sent_at IS NULL""").fetchone()
            sent, latest = conn.execute("SELECT count(*), max(sent_at) FROM outbound_events WHERE sent_at IS NOT NULL").fetchone()
        def utc(value):
            return datetime.fromtimestamp(value, timezone.utc).isoformat() if value is not None else None
        return {"pending": pending, "pending_with_errors": retries, "oldest_pending_at": utc(oldest),
                "smtp_accepted": sent, "last_smtp_accepted_at": utc(latest)}


def send_mail(relay, message):
    context = ssl.create_default_context()
    if relay.tls == "implicit":
        client = smtplib.SMTP_SSL(relay.host, relay.port, context=context, timeout=8)
    else:
        client = smtplib.SMTP(relay.host, relay.port, timeout=8)
    try:
        if relay.tls == "starttls":
            client.starttls(context=context)
        if relay.username:
            client.login(relay.username, relay.password)
        client.send_message(message, from_addr=relay.sender.addr_spec, to_addrs=[relay.recipient.addr_spec])
    finally:
        client.close()


def deliver_one(queue, relay, now):
    item = queue.claim(now)
    if item is None:
        return False
    message = build_mail(json.loads(item["payload"]), item["device"], relay.sender, relay.recipient)
    try:
        send_mail(relay, message)
    except (smtplib.SMTPException, OSError) as error:
        code = getattr(error, "smtp_code", None)
        failure = f"SMTP {code}" if isinstance(code, int) else type(error).__name__
        queue.complete(item, int(time.time()), failure)
        LOG.warning("SMTP deferred for %s (%s)", item["id"], failure)
    else:
        queue.complete(item, int(time.time()))
        LOG.info("SMTP accepted %s", item["id"])
    return True


def create_app(settings, queue, *, run_worker=True):
    app = web.Application(client_max_size=BODY_LIMIT, handler_args={"auto_decompress": False})
    changed, stopping = asyncio.Event(), asyncio.Event()
    active = asyncio.Semaphore(32)

    async def receive(request):
        authorization = request.headers.getall("Authorization", [])
        credential = authorization[0].split() if len(authorization) == 1 else []
        device = None
        if len(credential) == 2 and credential[0].lower() == "bearer" and matches(TOKEN, credential[1]):
            device = settings.clients.get(hashlib.sha256(credential[1].encode("ascii")).hexdigest())
        if device is None:
            raise web.HTTPUnauthorized(headers={"WWW-Authenticate": 'Bearer realm="Thundy"'})
        keys = request.headers.getall("Idempotency-Key", [])
        if len(keys) != 1 or not matches(UUID, keys[0]):
            raise web.HTTPBadRequest(text="Invalid Idempotency-Key")
        if request.content_type != "application/json" or request.headers.get("Content-Encoding", "identity").lower() != "identity":
            raise web.HTTPUnsupportedMediaType()
        if active.locked():
            raise web.HTTPServiceUnavailable(headers={"Retry-After": "30"})
        async with active:
            try:
                async with asyncio.timeout(5):
                    raw = await request.read()
            except TimeoutError as error:
                raise web.HTTPRequestTimeout() from error
            try:
                event = parse_event(raw, keys[0])
            except InvalidEvent as error:
                raise web.HTTPUnprocessableEntity(text="Invalid Thundy event v1") from error
            try:
                result = await asyncio.to_thread(queue.accept, event, device, int(time.time()))
            except sqlite3.Error as error:
                LOG.error("Queue write failed (%s)", type(error).__name__)
                raise web.HTTPServiceUnavailable(headers={"Retry-After": "30"}) from error
        if result == "conflict":
            raise web.HTTPConflict(text="Event ID conflict")
        if result == "full":
            raise web.HTTPServiceUnavailable(headers={"Retry-After": "60"})
        if result == "accepted":
            LOG.info("Stored event %s", event["id"])
            changed.set()
        return web.Response(status=204, headers={"Cache-Control": "no-store"})

    async def worker():
        next_cleanup = 0
        while not stopping.is_set():
            now = int(time.time())
            changed.clear()
            try:
                if now >= next_cleanup:
                    await asyncio.to_thread(queue.prune, now)
                    next_cleanup = now + 3600
                if await asyncio.to_thread(deliver_one, queue, settings.relay, now):
                    continue
            except sqlite3.Error as error:
                LOG.error("Queue worker failed (%s)", type(error).__name__)
            with suppress(TimeoutError):
                await asyncio.wait_for(changed.wait(), 5)

    async def lifetime(_app):
        task = asyncio.create_task(worker())
        yield
        stopping.set()
        changed.set()
        await task

    if run_worker:
        app.cleanup_ctx.append(lifetime)
    app.router.add_post(PATH, receive)
    return app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", nargs="?", choices=("serve", "status", "token"), default="serve")
    parser.add_argument("--config", type=Path, default=Path("receiver.toml"))
    args = parser.parse_args()
    if args.command == "token":
        token = secrets.token_hex(32)
        print(f"Token für Thunderbird: {token}\nSHA-256 für [clients]: {hashlib.sha256(token.encode('ascii')).hexdigest()}")
        return
    os.umask(0o077)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        path = args.config.resolve()
        with path.open("rb") as handle:
            config = tomllib.load(handle)
        settings = load_settings(config, path) if args.command == "serve" else None
        queue = Queue(*queue_settings(config, path))
    except (OSError, ValueError, sqlite3.Error, KeyError, TypeError) as error:
        parser.exit(2, f"Konfiguration oder Datenspeicher konnte nicht geöffnet werden ({type(error).__name__}).\n")
    if args.command == "status":
        print(json.dumps(queue.status(), indent=2))
    else:
        web.run_app(create_app(settings, queue), host=settings.host, port=settings.port, ssl_context=settings.tls,
                    access_log=None, keepalive_timeout=15)


if __name__ == "__main__":
    main()
