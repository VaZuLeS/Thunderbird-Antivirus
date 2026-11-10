#!/usr/bin/env python3
"""Generate isolated synthetic crypto fixtures and independently verify their bytes."""
import argparse
from email.message import EmailMessage
from email.policy import SMTP
import hashlib
import json
from pathlib import Path
import subprocess


def run(*args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, **kwargs).stdout


def generate(out):
    out.mkdir(mode=0o700, parents=True, exist_ok=False)
    home = out / 'gnupg'
    home.mkdir(mode=0o700)
    gpg = ('gpg', '--homedir', str(home), '--batch', '--pinentry-mode', 'loopback', '--passphrase', '')
    message = EmailMessage(policy=SMTP)
    message['From'] = 'fixture@example.invalid'
    message['To'] = 'receiver@example.invalid'
    message['Subject'] = 'Thundy crypto fixture'
    message['Message-ID'] = '<crypto-fixture@example.invalid>'
    message.set_content('Grüße — Français, Español, Italiano, Polski: żółć.', charset='utf-8')
    payload = bytes(range(256))
    message.add_attachment(payload, maintype='application', subtype='octet-stream', filename='binary.bin')
    # Only the MIME entity is signed/encrypted, preserving the independent plaintext fixture.
    # Keep entity headers, but keep outer address/subject headers outside the encrypted part.
    mime = message.as_bytes()[message.as_bytes().index(b'MIME-Version:'):]
    plain = out / 'plaintext.mime'
    plain.write_bytes(mime)
    run(*gpg, '--quick-generate-key', 'Thundy Fixture <receiver@example.invalid>', 'rsa2048', 'sign,encr', '0')
    listing = run(*gpg, '--with-colons', '--list-secret-keys').decode()
    fingerprint = next(line.split(':')[9] for line in listing.splitlines() if line.startswith('fpr:'))
    (out / 'openpgp-public.asc').write_bytes(run(*gpg, '--armor', '--export', fingerprint))
    (out / 'openpgp-secret.asc').write_bytes(run(*gpg, '--armor', '--export-secret-keys', fingerprint))
    encrypted = run(*gpg, '--armor', '--trust-model', 'always', '--recipient', fingerprint, '--output', '-', '--encrypt', str(plain))
    assert run(*gpg, '--decrypt', input=encrypted) == mime
    signature = run(*gpg, '--armor', '--output', '-', '--detach-sign', str(plain))
    (out / 'openpgp-signature.asc').write_bytes(signature)
    run(*gpg, '--verify', str(out / 'openpgp-signature.asc'), str(plain))
    outer = b'From: fixture@example.invalid\r\nTo: receiver@example.invalid\r\nSubject: Thundy crypto OpenPGP\r\nMessage-ID: <pgp-crypto@example.invalid>\r\nMIME-Version: 1.0\r\n'
    pgp = outer + b'Content-Type: multipart/encrypted; protocol="application/pgp-encrypted"; boundary="thundy-crypto"\r\n\r\n--thundy-crypto\r\nContent-Type: application/pgp-encrypted\r\n\r\nVersion: 1\r\n--thundy-crypto\r\nContent-Type: application/octet-stream\r\n\r\n' + encrypted.replace(b'\n', b'\r\n') + b'\r\n--thundy-crypto--\r\n'
    (out / 'openpgp-encrypted.eml').write_bytes(pgp)
    key, cert = out / 'smime-key.pem', out / 'smime-cert.pem'
    run('openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=Thundy Fixture/emailAddress=receiver@example.invalid', '-addext', 'subjectAltName=email:receiver@example.invalid', '-keyout', str(key), '-out', str(cert))
    smime = run('openssl', 'smime', '-encrypt', '-aes256', '-in', str(plain), str(cert))
    decrypted = run('openssl', 'smime', '-decrypt', '-recip', str(cert), '-inkey', str(key), input=smime)
    assert decrypted == mime
    signed = run('openssl', 'smime', '-sign', '-in', str(plain), '-signer', str(cert), '-inkey', str(key))
    assert run('openssl', 'smime', '-verify', '-noverify', input=signed) == mime
    for name, entity in [('smime-encrypted', smime), ('smime-signed', signed)]:
        (out / (name + '.eml')).write_bytes(outer.replace(b'OpenPGP', name.encode()).replace(b'pgp-crypto', name.encode()) + entity)
    run('openssl', 'pkcs12', '-export', '-inkey', str(key), '-in', str(cert), '-name', 'Thundy synthetic receiver', '-passout', 'pass:synthetic-fixture', '-out', str(out / 'smime-identity.p12'))
    result = {'schemaVersion': 1, 'synthetic': True, 'liveProviderCalls': False, 'independentVerification': {'openpgpDecrypt': True, 'openpgpSignature': True, 'smimeDecrypt': True, 'smimeSignature': True}, 'nativeThunderbirdVerified': False, 'mimeSha256': hashlib.sha256(mime).hexdigest(), 'attachmentSha256': hashlib.sha256(payload).hexdigest(), 'openpgpFingerprint': fingerprint}
    (out / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
    for p in out.rglob('*'):
        if p.is_file():
            p.chmod(0o600)
    run('gpgconf', '--homedir', str(home), '--kill', 'all')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True, help='New isolated directory outside the repository; includes synthetic private keys')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if args.out.resolve() == root or root in args.out.resolve().parents:
        parser.error('Fixture keys must be generated outside the repository')
    print(json.dumps(generate(args.out.resolve())))
