'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
test('CH-075 : les outils de typage restent hors du paquet',()=>{
 const programme=`import importlib.util, json
from pathlib import Path
spec = importlib.util.spec_from_file_location('paquet', 'tools/package.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
exclus = ['node_modules/typescript/lib/typescript.js', 'outils/node_modules/x/index.js', 'package.json', 'package-lock.json', 'tsconfig.ch075.json', 'types/ch075.d.ts', 'tools/typage-ch075.cjs']
inclus = ['src/appuis-liste.js', 'vendor/ariane-lidar-wasm.js', 'manifest.json', 'tools/audit-native-v441.cjs']
print(json.dumps({'exclus': [module.developpement_seul(Path(p)) for p in exclus], 'inclus': [module.developpement_seul(Path(p)) for p in inclus], 'source': [module.developpement_seul(Path(p), include_tests=True) for p in exclus]}))
`;
 const r=spawnSync('python3',['-B','-c',programme],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
 const resultat=JSON.parse(r.stdout);
 assert.ok(resultat.exclus.every(Boolean),'dépendances et vérificateur exclus');
 assert.ok(resultat.inclus.every(x=>!x),'fichiers utiles du paquet conservés');
 assert.deepEqual(resultat.source,[true,true,false,false,false,false,false],
  'archive source : recettes pour réinstaller et lancer les essais, sans dépendances embarquées');
});
