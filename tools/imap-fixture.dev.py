#!/usr/bin/env python3
"""Start a loopback-only disposable Dovecot fixture and verify real IMAP operations."""
import argparse
import hashlib
import imaplib
import json
from pathlib import Path
import subprocess
import time

DOCKER = ['env', '-u', 'DOCKER_HOST', '-u', 'DOCKER_CONTEXT', '-u', 'DOCKER_TLS', '-u', 'DOCKER_TLS_VERIFY', '-u', 'DOCKER_CERT_PATH', 'docker', '--host=unix:///var/run/docker.sock']


def docker(*args):
    return subprocess.run(DOCKER + list(args), check=True, capture_output=True).stdout.decode().strip()


def start(out):
    out.mkdir(parents=True, exist_ok=False)
    (out / 'Dockerfile').write_text('FROM debian:bookworm\nRUN apt-get update && apt-get install -y --no-install-recommends dovecot-imapd && rm -rf /var/lib/apt/lists/*\nRUN useradd --create-home --uid 1000 fixture\nCOPY dovecot.conf /etc/dovecot/fixture.conf\nCMD ["dovecot","-F","-c","/etc/dovecot/fixture.conf"]\n')
    (out / 'dovecot.conf').write_text('''protocols = imap
listen = *
ssl = no
disable_plaintext_auth = no
mail_location = maildir:/home/fixture/Maildir
log_path = /dev/stderr
info_log_path = /dev/stderr
passdb {
 driver = static
 args = password=synthetic-fixture
}
userdb {
 driver = static
 args = uid=1000 gid=1000 home=/home/fixture
}
namespace inbox {
 inbox = yes
}
service imap-login {
 inet_listener imap {
  port = 143
 }
}
''')
    docker('info', '--format', '{{.ServerVersion}}')
    build = subprocess.run(DOCKER + ['build', '--quiet', '-t', 'thundy-imap-fixture:local', str(out)], capture_output=True)
    (out / 'build.log').write_bytes(build.stdout + build.stderr)
    build.check_returncode()
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::143', 'thundy-imap-fixture:local')
    try:
        port = int(docker('port', container, '143/tcp').rsplit(':', 1)[1])
        client = None
        for _ in range(60):
            try:
                client = imaplib.IMAP4('127.0.0.1', port, timeout=5)
                break
            except (OSError, imaplib.IMAP4.abort):
                time.sleep(0.5)
        if client is None:
            raise RuntimeError('Dovecot did not become ready')
        client.login('fixture', 'synthetic-fixture')
        message = b'From: fixture@example.invalid\r\nTo: receiver@example.invalid\r\nSubject: Thundy IMAP fixture\r\nMessage-ID: <imap-fixture@example.invalid>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSynthetic IMAP body.\r\n'
        assert client.append('INBOX', None, None, message)[0] == 'OK'
        assert client.select('INBOX')[0] == 'OK'
        status, rows = client.fetch('1', '(RFC822)')
        assert status == 'OK' and rows[0][1] == message
        assert client.create('Copied')[0] == 'OK'
        assert client.copy('1', 'Copied')[0] == 'OK'
        assert client.store('1', '+FLAGS', '\\Seen')[0] == 'OK'
        client.logout()
        result = {'schemaVersion': 1, 'synthetic': True, 'containerId': container, 'host': '127.0.0.1', 'port': port, 'realImapServer': True, 'appendFetchBytesMatch': True, 'copyAndFlags': True, 'messageSha256': hashlib.sha256(message).hexdigest(), 'nativeThunderbirdVerified': False, 'retentionVerified': False}
        (out / 'server.json').write_text(json.dumps(result, indent=2) + '\n')
        return result
    except BaseException:
        docker('stop', container)
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--stop', action='store_true', help='Stop only the fixture recorded in this output directory')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if args.out.resolve() == root or root in args.out.resolve().parents:
        parser.error('Server state must be stored outside the repository')
    if args.stop:
        state = json.loads((args.out / 'server.json').read_text())
        if docker('inspect', '--format', '{{.Config.Image}}', state['containerId']) != 'thundy-imap-fixture:local':
            parser.error('The recorded container is not the IMAP fixture')
        docker('stop', state['containerId'])
    else:
        print(json.dumps(start(args.out.resolve())))
