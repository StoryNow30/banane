"""Build an installable, source-readable extension ZIP with manifest.json at root."""
import argparse
import json
import re
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def build(destination, include_tests=False):
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    required = ['manifest.json', 'README.md', 'CHANGELOG.md', 'RESULTATS.md', 'NATIVE_MODE.md', 'NATIVE_GEOMETRY_ACCEPTANCE.md',
                'PROJECT_STATE.md', 'REQUIREMENTS.md', 'DECISIONS.md', 'KNOWN_ISSUES.md', 'TEST_REPORT.md', 'NEXT_TASKS.md',
                'OFFLINE_EVALUATION.md', 'BRAIN_V1.md', 'audit-corpus.md', 'audit/native-fluidity-v4.4.3.json', 'audit/native-geometry-loss-v4.4.0.json',
                'audit/native-geometry-loss-v4.4.0.md', 'audit/native-offline-evaluation-v4.4.0.json', 'audit/native-offline-evaluation-v4.4.0.md',
                'audit/native-v4.4.1-real-audit.json', 'audit/native-offline-v4.4.1-baseline.json',
                'tools/audit-native-v441.cjs',
                'panel.html', 'panel.js', 'panel.css',
                manifest['background']['service_worker']]
    required += [p for content in manifest['content_scripts'] for p in content['js']]
    for name in required:
        if not (ROOT / name).is_file():
            raise ValueError(f'Missing required file: {name}')
    destination = Path(destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in sorted(ROOT.rglob('*')):
            relative = file.relative_to(ROOT)
            if any(p.startswith('.') or p == '__pycache__' for p in relative.parts):
                continue
            if relative.parts[0] in {'archive', 'releases', 'design'} or relative.parts[0] == 'tests' and not include_tests or relative.parts[:2] == ('datasets', 'manual'):
                continue
            if relative.parts[:2] == ('datasets', 'native') and not (include_tests and relative.parts[:3] == ('datasets', 'native', 'reference') and relative.suffix == '.json'):
                continue
            if relative.parts[0] == 'audit' and (relative.parent != Path('audit') or relative.name not in {'verification.json', 'verification.txt', 'ingestion-certificate-v4.3.0.json', 'native-fluidity-v4.4.3.json',
                   'native-geometry-loss-v4.4.0.json', 'native-geometry-loss-v4.4.0.md', 'native-offline-evaluation-v4.4.0.json', 'native-offline-evaluation-v4.4.0.md',
                   'native-v4.4.1-real-audit.json', 'native-offline-v4.4.1-baseline.json', 'native-offline-v4.4.1-baseline.md',
                   'v4.2.1-geometry-hashes.json', 'v4.4.0-frozen-engine-hashes.json', 'v4.6.0-engine-baseline.json'}):
                continue
            if file.is_symlink():
                raise ValueError(f'Symlink refused: {relative}')
            if file.is_file() and file.suffix not in ('.zip', '.pyc') and file.resolve() != destination:
                archive.write(file, relative.as_posix())
    with zipfile.ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise ValueError('Archive CRC check failed')
        if archive.namelist().count('manifest.json') != 1:
            raise ValueError('Root manifest missing or duplicated')
    return destination


def nom_paquet(manifest):
    """D1 (4.8.5, D-061) : nom du paquet tiré du manifeste. Version de test :
    `4.8.5.N` et « 4.8.5 test N » -> `ariane-4.8.5-test.N.zip` ; stable :
    `ariane-vX.Y.Z.zip`. Un numéro de test qui ne concorde pas est refusé."""
    version, nom = manifest['version'], manifest.get('version_name')
    if not nom or nom == version:
        return f'ariane-v{version}.zip'
    m = re.fullmatch(r'(\d+\.\d+\.\d+) test (\d+)', nom)
    if not m or version != f'{m[1]}.{m[2]}':
        raise ValueError(f'version {version} et version_name « {nom} » ne concordent pas')
    return f'ariane-{m[1]}-test.{m[2]}.zip'


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=None, help='Défaut : ariane-<version>.zip à côté du dépôt (nom_paquet).')
    parser.add_argument('--source', action='store_true', help='Include runnable Node tests and fixtures for an auditable source archive.')
    args = parser.parse_args()
    output = args.output or str(ROOT.parent / nom_paquet(json.loads((ROOT / 'manifest.json').read_text())))
    result = build(output, include_tests=args.source)
    print(f'{result.name}: {result.stat().st_size} bytes; manifest.json at archive root; CRC OK')
