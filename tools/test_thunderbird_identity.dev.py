"""Regression checks for the experimental probe, not a production MIME parser."""
import hashlib
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('thunderbird_live', Path(__file__).with_name('thunderbird-live.dev.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class IdentityProbeBytes(unittest.TestCase):
    def test_local_mixed_endings_do_not_remove_original_from_header(self):
        original = b'From: fixture@example.invalid\r\nSubject: example\r\n\r\nBody\r\n'
        before = runner.summarize_identity_bytes(b'X-Mozilla-Status: 0001\nX-Mozilla-Status2: 00000000\n' + original)
        after = runner.summarize_identity_bytes(b'X-Mozilla-Status: 0005\r\nX-Mozilla-Status2: 10000000\r\n' + original)
        expected = hashlib.sha256(original).hexdigest()
        self.assertEqual(before['withoutLocalStatusSha256'], expected)
        self.assertEqual(after['withoutLocalStatusSha256'], expected)
        self.assertNotEqual(before['rawSha256'], after['rawSha256'])
        changed = original.replace(b'fixture@', b'changed@')
        self.assertNotEqual(runner.summarize_identity_bytes(changed)['withoutLocalStatusSha256'], expected)

    def test_other_headers_continuations_and_binary_body_remain_exact(self):
        original = b'From: fixture@example.invalid\r\nX-Other: preserve\r\n continuation\r\n\r\n\x00\xff\nX-Mozilla-Status: body\r\n'
        local = b'x-mozilla-keys: label\n folded-local-label\n'
        result = runner.summarize_identity_bytes(local + original)
        self.assertEqual(result['withoutLocalStatusSha256'], hashlib.sha256(original).hexdigest())
        self.assertEqual(len(result['localStatusHeaders']), 2)

    def test_unexpected_fixture_header_boundary_is_rejected(self):
        with self.assertRaises(ValueError):
            runner.summarize_identity_bytes(b'From: fixture@example.invalid\n\nBody')


if __name__ == '__main__':
    unittest.main()
