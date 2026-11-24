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
docs = root / 'docs'
site = 'https://vazules.github.io/Thunderbird-Antivirus/'
manuals = {
    'python-receiver.md': 'README.md',
    'python-receiver.en.md': 'README.en.md',
    'UNTERNEHMENSRICHTLINIE.md': 'UNTERNEHMENSRICHTLINIE.md',
    'enterprise-policy.en.md': 'enterprise-policy.en.md',
    'LOCAL_SCORE.md': 'LOCAL_SCORE.md',
}
links = {
    **manuals,
    'guide-de.md': site + 'guide-de.html',
    'guide-en.md': site + 'guide-en.html',
    'privacy_policy.md': site + 'privacy_policy.html',
    'https://github.com/VaZuLeS/Thunderbird-Antivirus/blob/main/examples/python-receiver/receiver.example.toml': 'receiver.example.toml',
}
for source, member in manuals.items():
    text = (docs / source).read_text(encoding='utf-8')
    if text.startswith('---\n'):
        _, _, text = text.split('---\n', 2)
        text = text.lstrip('\n')
    for old, new in links.items():
        text = text.replace(f']({old})', f']({new})').replace(f']({old}#', f']({new}#')
    files[member] = text.encode('utf-8')

output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w') as archive:
    for name, contents in sorted(files.items()):
        member = ZipInfo(name)
        member.create_system = 3
        member.external_attr = 0o100644 << 16
        archive.writestr(member, contents, compress_type=ZIP_DEFLATED, compresslevel=9)
print(output)
