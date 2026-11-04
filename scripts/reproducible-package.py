#!/usr/bin/env python3
"""Canonicalize a fresh, unsigned web-ext build into a NEW candidate archive.

Run only before testing/signing. Input bytes are never changed; output creation
is exclusive. Reproducibility includes the Python/zlib toolchain (DEFLATE level 9).
"""
import json
from pathlib import Path
import stat
import sys
import zipfile
import zlib

TIMESTAMP = (1980, 1, 1, 0, 0, 0)
MAX_BYTES = 1000 * 1024
MAX_ENTRIES = 1024


def canonicalize(source, destination):
    entries = {}
    with zipfile.ZipFile(source) as archive:
        members = archive.infolist()
        if not members or len(members) > MAX_ENTRIES:
            raise ValueError('Empty or excessive archive entry list')
        if sum(item.file_size for item in members) > MAX_BYTES:
            raise ValueError('Archive exceeds package size budget')
        seen = set()
        for item in members:
            name = item.filename
            parts = name.rstrip('/').split('/')
            if (not name or '\\' in name or '\x00' in name or ':' in name
                    or any(part in ('', '.', '..') for part in parts)):
                raise ValueError('Unsafe archive path')
            if parts[0].lower() == 'meta-inf':
                raise ValueError('Refusing signature metadata; never rewrite a signed archive')
            if name in seen or item.flag_bits & 1:
                raise ValueError('Duplicate or encrypted archive entry')
            seen.add(name)
            kind = stat.S_IFMT(item.external_attr >> 16)
            if kind not in (0, stat.S_IFREG, stat.S_IFDIR):
                raise ValueError('Non-regular archive entry')
            if item.is_dir():
                continue
            entries[name] = archive.read(item)  # Also validates the original CRC.
    if not entries:
        raise ValueError('Archive contains no files')
    created = False
    try:
        # No in-place mode and no overwrite, even for a caller-selected output.
        with Path(destination).open('xb') as output:
            created = True
            with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED,
                                 compresslevel=9, allowZip64=False) as archive:
                for name in sorted(entries):
                    item = zipfile.ZipInfo(name, TIMESTAMP)
                    item.create_system = 3
                    item.external_attr = (stat.S_IFREG | 0o644) << 16
                    item.compress_type = zipfile.ZIP_DEFLATED
                    archive.writestr(item, entries[name], compresslevel=9)
        with zipfile.ZipFile(destination) as archive:
            if ({item.filename: archive.read(item) for item in archive.infolist()}
                    != entries):
                raise ValueError('Canonical archive payload mismatch')
    except BaseException:
        if created:
            Path(destination).unlink(missing_ok=True)
        raise
    return {'files': len(entries), 'payloadBytes': sum(map(len, entries.values())),
            'timestamp': TIMESTAMP, 'compression': 'DEFLATE-9',
            'python': sys.version.split()[0], 'zlib': zlib.ZLIB_RUNTIME_VERSION}


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('Usage: reproducible-package.py FRESH_UNSIGNED_BUILD NEW_CANDIDATE')
    try:
        print(json.dumps(canonicalize(sys.argv[1], sys.argv[2])))
    except (OSError, ValueError, zipfile.BadZipFile, RuntimeError) as error:
        sys.exit('Package canonicalization rejected: ' + str(error))
