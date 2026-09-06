"""Package source plus the already verified, referenced media. No credentials or caches."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
output = root / 'Shehraz_Portfolio_v6_GitHub_Ready.zip'
files = {}
for item in root.iterdir():
    if item.is_file() and (item.suffix == '.html' or item.name in {
        'style.css', 'package.json', 'README.md', 'QA.md', 'CHANGELOG.md',
        'START_HERE.txt', 'START_WINDOWS.bat', 'DOWNLOAD_IMAGES_AND_BUILD.bat',
        'server.mjs', '.gitignore', '.nojekyll'
    }):
        files[item.name] = item
for folder in ('src', 'js', 'css', 'data', 'docs', 'tools', 'tests', '.github'):
    for item in (root / folder).rglob('*'):
        if item.is_file() and '__pycache__' not in item.parts and item.name != 'browser_qa.py':
            files[item.relative_to(root).as_posix()] = item
for item in (root / 'dist' / 'assets').rglob('*'):
    if item.is_file():
        files[item.relative_to(root / 'dist').as_posix()] = item
for item in (root / 'qa').glob('v6-*'):
    if item.is_file() and item.suffix in ('.png', '.json', '.txt'):
        files['qa/' + item.name] = item
files['qa/static-http.json'] = root / 'qa/static-http.json'
assert 'index.html' in files and '.github/workflows/pages.yml' in files
data = json.loads((root / 'data/portfolio.json').read_text(encoding='utf-8'))
assert len(data['projects']) == len({p['packageId'] for p in data['projects']}) == 26
for project in data['projects']:
    assert project['media']['galleryComplete']
    for shot in project['media']['screenshots']:
        assert hashlib.sha256(files[shot['src']].read_bytes()).hexdigest() == shot['sha256']
        assert shot['preview'] in files
    for key in ('icon', 'iconPreview', 'cover', 'coverPreview'):
        assert project['media'][key] in files
hashes = []
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name, source in sorted(files.items()):
        content = source.read_bytes()
        archive.writestr(name, content)
        hashes.append(hashlib.sha256(content).hexdigest() + '  ' + name)
    archive.writestr('DELIVERY_CHECKSUMS.sha256', '\n'.join(hashes) + '\n')
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    names = set(archive.namelist())
    assert all(not n.startswith(('.work/', 'node_modules/', 'dist/')) for n in names)
    assert len([n for n in names if n.startswith('project-') and n.endswith('.html')]) == 26
report = {
    'zip': output.name, 'bytes': output.stat().st_size, 'entries': len(files) + 1,
    'projects': 26, 'icons': 26,
    'galleryImages': sum(len(p['media']['screenshots']) for p in data['projects']),
    'archivedGalleries': sum(bool(p['media'].get('archived')) for p in data['projects']),
    'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'validated': True
}
(root / 'qa' / 'package-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
