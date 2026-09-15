"""Compare the original workspace files with the pre-development inventory."""
import argparse
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('original_workspace', type=Path)
args = parser.parse_args()
inventory = json.loads((root / 'audit/inventory.json').read_text())
checked, problems = 0, []
for row in inventory['files']:
    path = args.original_workspace / row['path']
    if not path.is_file():
        problems.append({'path': row['path'], 'problem': 'missing'})
        continue
    current = hashlib.sha256(path.read_bytes()).hexdigest()
    checked += 1
    if current != row['sha256']:
        problems.append({'path': row['path'], 'problem': 'changed'})
result = {'files_compared': checked, 'problems': problems, 'method': 'SHA-256 against inventory made before V3 code'}
(root / 'audit/originals-preservation.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
raise SystemExit(bool(problems))
