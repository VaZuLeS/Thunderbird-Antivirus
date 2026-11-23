"""Build the standalone Thundy Python receiver release asset."""

import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


root = Path(__file__).resolve().parents[1]
receiver = root / 'examples' / 'python-receiver'
version = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))['version']
output = root / 'build' / f'thundy-python-receiver-{version}.zip'
files = {name: (receiver / name).read_bytes() for name in (
    'event.py', 'receiver.py', 'receiver.example.toml', 'requirements.txt',
)}
files['LICENSE'] = (root / 'LICENSE').read_bytes()
files['README.md'] = (receiver / 'README.md').read_text(encoding='utf-8').replace(
    '../../docs/UNTERNEHMENSRICHTLINIE.md', 'UNTERNEHMENSRICHTLINIE.md').encode('utf-8')
files['UNTERNEHMENSRICHTLINIE.md'] = (root / 'docs' / 'UNTERNEHMENSRICHTLINIE.md').read_text(encoding='utf-8').replace(
    '../examples/python-receiver/README.md', 'README.md').encode('utf-8')

output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w') as archive:
    for name, contents in sorted(files.items()):
        member = ZipInfo(name)
        member.create_system = 3
        member.external_attr = 0o100644 << 16
        archive.writestr(member, contents, compress_type=ZIP_DEFLATED, compresslevel=9)
print(output)
