import asyncio
import hashlib
import json
import os
import shutil
import socketserver
import ssl
import subprocess
import tempfile
import threading
import time
import unittest
from contextlib import closing
from email import policy
from email.headerregistry import Address
from email.parser import BytesParser
from pathlib import Path

from aiohttp import ClientSession, TCPConnector
from aiohttp.test_utils import TestServer

from event import InvalidEvent, build_mail, parse_event
from receiver import BODY_LIMIT, PATH, Queue, Relay, Settings, create_app, deliver_one, load_settings


TOKEN = "fixture-receiver-device-one"
OTHER_TOKEN = "fixture-receiver-device-two"
SENDER = Address(addr_spec="thundy@example.org")
RECIPIENT = Address(addr_spec="jan@myville.com")
EXAMPLE = {"schemaVersion": 1, "id": "a1c8080d-5c2e-491e-a163-000000000001",
           "observedAt": "2026-11-23T09:00:00.000Z", "action": "link_open", "finding": "suspicious",
           "decision": "warn", "policyRevision": 7, "hostname": "[2001:db8::1]",
           "details": {"reason": "threshold", "score": 50, "threshold": 50, "providers": []}}


def pack(event):
    return json.dumps(event).encode()


def parse(event):
    return parse_event(pack(event), event["id"])


class SMTPHandler(socketserver.StreamRequestHandler):
    def respond(self, response):
        self.wfile.write(response + b"\r\n")

    def handle(self):
        self.respond(b"220 localhost fake relay")
        recipient = b""
        while line := self.rfile.readline():
            verb = line.split(maxsplit=1)[0].upper()
            if verb == b"DATA":
                self.respond(b"354 End data with <CR><LF>.<CR><LF>")
                message = []
                while (line := self.rfile.readline()) not in (b".\r\n", b""):
                    message.append(line[1:] if line.startswith(b"..") else line)
                if self.server.fail_delivery:
                    self.respond(b"451 temporary failure")
                else:
                    self.server.delivered.append((recipient, b"".join(message)))
                    self.respond(b"250 accepted")
            elif verb in {b"HELO", b"EHLO", b"RSET", b"MAIL", b"RCPT"}:
                if verb == b"RCPT":
                    recipient = line.strip()
                self.respond(b"250 localhost")
            else:
                self.respond(b"221 closing")
                return


def fake_relay(cleanup):
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), SMTPHandler)
    server.daemon_threads = True
    server.delivered = []
    server.fail_delivery = False
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True)
    thread.start()
    cleanup(server.server_close)
    cleanup(server.shutdown)
    relay = Relay("127.0.0.1", server.server_address[1], "local", SENDER, RECIPIENT)
    return server, relay


def certificate(directory):
    openssl = shutil.which("openssl")
    if not openssl:
        raise unittest.SkipTest("OpenSSL is needed for the HTTPS integration test")
    cert, key = directory / "cert.pem", directory / "key.pem"
    subprocess.run([openssl, "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost",
                    "-addext", "subjectAltName=IP:127.0.0.1", "-keyout", str(key), "-out", str(cert)],
                   env={**os.environ, "MSYS2_ARG_CONV_EXCL": "*"}, check=True, capture_output=True, timeout=15)
    server_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    server_context.load_cert_chain(cert, key)
    return server_context, ssl.create_default_context(cafile=str(cert))


class ContractTest(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "Node is required to exercise incident_reporting.js")
    def test_messages_generated_by_the_thundy_sender_render_completely(self):
        specimens = json.loads(subprocess.check_output(["node", str(Path(__file__).with_name("test-contract.cjs"))], timeout=15))
        events = [parse_event(row["body"].encode(), row["key"]) for row in specimens]
        mails = [build_mail(event, "pilot-pc-01", SENDER, RECIPIENT) for event in events]
        for event, mail in zip(events, mails):
            self.assertTrue(mail.is_multipart())
            for body in (mail.get_body(preferencelist=("plain",)), mail.get_body(preferencelist=("html",))):
                self.assertIn(event["id"], body.get_content())
                self.assertIn("pilot-pc-01", body.get_content())
        base, threshold, link, file, save, indicator_only = [mail.get_body(("plain",)).get_content() for mail in mails]
        self.assertIn("Basismeldung", base)
        self.assertNotIn("example.org", base)
        self.assertIn("Firmenschwelle: 50 / 100", threshold)
        self.assertIn("example.org", threshold)
        for field in ("Hybrid Analysis", "urlscan.io", "sample-job_42", "Live-Abfrage", "Beobachtungszeit", "91 / 100"):
            self.assertIn(field, link)
        self.assertIn("https://urlscan.io/result/", link)
        self.assertNotIn("secret=canary", link)
        for field in ("VirusTotal", "Archivbefund", "Bösartige Erkennungen: 3", "Verdächtige Erkennungen: 0",
                      "https://www.hybrid-analysis.com/sample/", "Prüfung & <probe>.pdf", "Datei-SHA-256"):
            self.assertIn(field, file)
        self.assertIn("Anhang speichern", save)
        self.assertIn("Entscheidungsscore: 0 / 100", save)
        self.assertNotIn("Datei-SHA-256", save)
        self.assertIn("Datei-SHA-256", indicator_only)
        html = mails[3].get_body(("html",)).get_content()
        self.assertIn("Prüfung &amp; &lt;probe&gt;.pdf", html)
        self.assertIn('href="https://www.hybrid-analysis.com/sample/', html)

    def test_rejects_out_of_contract_data_and_foreign_report_links(self):
        self.assertEqual(parse(EXAMPLE), EXAMPLE)
        provider = {"provider": "urlscan", "verdict": "suspicious", "source": "stored", "reference": EXAMPLE["id"],
                    "reportUrl": "https://urlscan.io.invalid/result/" + EXAMPLE["id"] + "/"}
        for patch in ({"hostname": "example.org/path"}, {"schemaVersion": True}, {"policyRevision": 0},
                      {"originalUrl": "https://example.org/secret"}, {"observedAt": "2026-02-31T09:00:00.000Z"},
                      {"details": {"reason": "malicious", "providers": [provider]}},
                      {"details": {"reason": "malicious", "score": True, "providers": []}}):
            with self.subTest(patch=patch), self.assertRaises(InvalidEvent):
                parse({**EXAMPLE, **patch})
        with self.assertRaises(InvalidEvent):
            parse_event(pack(EXAMPLE).replace(b"{", b'{"finding":"phishing",', 1), EXAMPLE["id"])

    def test_config_allows_cleartext_only_on_explicit_loopback(self):
        base = {"http": {"host": "127.0.0.1", "port": 8443, "allow_loopback_http": True},
                "smtp": {"host": "127.0.0.1", "port": 1025, "tls": "local", "from": SENDER.addr_spec, "to": RECIPIENT.addr_spec},
                "clients": {"a" * 64: "test"}}
        self.assertIsNone(load_settings(base, Path("test.toml")).tls)
        with self.assertRaises(ValueError):
            load_settings({**base, "http": {**base["http"], "host": "0.0.0.0"}}, Path("test.toml"))
        with self.assertRaises(ValueError):
            load_settings({**base, "smtp": {**base["smtp"], "host": "smtp.example.org"}}, Path("test.toml"))


class DeliveryTest(unittest.IsolatedAsyncioTestCase):
    async def test_https_intake_and_smtp_delivery_are_idempotent(self):
        folder = Path(self.enterContext(tempfile.TemporaryDirectory()))
        server_tls, client_tls = certificate(folder)
        smtp, relay = fake_relay(self.addCleanup)
        queue = Queue(folder / "inbox.sqlite3", 10, 30)
        clients = {hashlib.sha256(token.encode()).hexdigest(): label
                   for token, label in [(TOKEN, "pilot-pc-01"), (OTHER_TOKEN, "pilot-pc-02")]}
        settings = Settings("127.0.0.1", 8443, server_tls, clients, relay)
        server = TestServer(create_app(settings, queue), scheme="https")
        await server.start_server(ssl=server_tls)
        self.addAsyncCleanup(server.close)
        async with ClientSession(connector=TCPConnector(ssl=client_tls)) as client:
            async def post(event, token=TOKEN, key=EXAMPLE["id"], content_type="application/json"):
                headers = {"Authorization": "Bearer " + token, "Idempotency-Key": key, "Content-Type": content_type}
                async with client.post(server.make_url(PATH), data=pack(event), headers=headers) as response:
                    return response.status
            self.assertEqual(await post(EXAMPLE, token="incorrect-device-one-token"), 401)
            self.assertEqual(await post(EXAMPLE, key="invalid"), 400)
            self.assertEqual(await post(EXAMPLE, content_type="text/plain"), 415)
            self.assertEqual(await post("X" * BODY_LIMIT), 413)
            self.assertEqual(await post({**EXAMPLE, "schemaVersion": 2}), 422)
            self.assertEqual(await asyncio.gather(*(post(EXAMPLE) for _ in range(8))), [204] * 8)
            self.assertEqual(await post({**EXAMPLE, "policyRevision": 8}), 409)
            self.assertEqual(await post(EXAMPLE, token=OTHER_TOKEN), 409)
            async with asyncio.timeout(5):
                while queue.status()["smtp_accepted"] != 1:
                    await asyncio.sleep(0.02)
            self.assertEqual(await post(EXAMPLE), 204)
        self.assertEqual(queue.status()["pending"], 0)
        self.assertEqual(len(smtp.delivered), 1)
        recipient, raw = smtp.delivered[0]
        self.assertIn(b"jan@myville.com", recipient)
        mail = BytesParser(policy=policy.default).parsebytes(raw)
        self.assertIn("Verdachtsfall", mail["Subject"])
        self.assertIn(EXAMPLE["id"], mail["Message-ID"])
        self.assertIn("Link-Hostname: [2001:db8::1]", mail.get_body(("plain",)).get_content())
        with closing(queue.connect()) as conn:
            self.assertIsNone(conn.execute("SELECT payload FROM outbound_events").fetchone()[0])

    async def test_retry_survives_reopening_sqlite_and_lease_is_exclusive(self):
        folder = Path(self.enterContext(tempfile.TemporaryDirectory()))
        smtp, relay = fake_relay(self.addCleanup)
        queue = Queue(folder / "inbox.sqlite3", 1, 30)
        now = int(time.time())
        queue.accept(EXAMPLE, "pilot-pc-01", now)
        self.assertEqual(queue.accept({**EXAMPLE, "id": EXAMPLE["id"][:-1] + "2"}, "pilot-pc-01", now), "full")
        smtp.fail_delivery = True
        self.assertTrue(deliver_one(queue, relay, now))
        self.assertEqual(queue.status()["pending_with_errors"], 1)
        queue = Queue(queue.path, 1, 30)
        self.assertFalse(deliver_one(queue, relay, now))
        item = queue.claim(now + 60)
        self.assertIsNotNone(item)
        self.assertIsNone(queue.claim(now + 61))
        smtp.fail_delivery = False
        self.assertTrue(deliver_one(queue, relay, now + 400))
        self.assertEqual(queue.status()["smtp_accepted"], 1)
        self.assertEqual(len(smtp.delivered), 1)
        self.assertEqual(queue.accept(EXAMPLE, "pilot-pc-01", now + 401), "duplicate")


if __name__ == "__main__":
    unittest.main()
