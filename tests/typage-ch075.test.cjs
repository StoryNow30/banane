'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
test('CH-075 : périmètre strict et preuves de types',()=>{
 const r=spawnSync(process.execPath,['tools/typage-ch075.cjs'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
});
const {jetons,identite}=require('../tools/typage-ch075.cjs');
test('CH-075 : commentaires et parenthèses seules sont neutres',()=>{
 assert.equal(jetons('const x=a+b;'),jetons('const x=/** @type {number} */ (a+b);'));
 assert.deepEqual(identite().map(x=>x.fichier),require('../tools/typage-ch075.cjs').PERIMETRE);
});
test('CH-075 : la preuve refuse les mutations de comportement',()=>{
 for(const [a,b] of [
  ['x=a+b','x=a-b'],['x=1','x=2'],['x.a','x.b'],['a();b();','b();a();'],
  ['function f(){return a;}','function f(){return\na;}'],['x=(a+b)*c','x=a+b*c'],
  ["('use strict');","'use strict';"],['(a?.b).c','a?.b.c'],
  ["/** @type {string} */ ('use strict');","'use strict';"],
  ['/** @type {unknown} */ (a?.b).c','a?.b.c'],['x=+a','x=-a'],['x++','x--'],
  ['let x=1','const x=1'],['x=/a/','x=/b/'],['x="// texte"','x="texte"'],
  ['const x=1','var x=1'],['x?.a','x.a'],['x?.()','x()'],
  ['async function f(){}','function f(){}'],['({get x(){}})','({set x(v){}})'],
  ['const {a:b}=x','const {b:a}=x'],['const [a,b]=x','const [b,a]=x'],
  ['function* f(){yield x;}','function f(){yield x;}'],['x=`a${b}`','x=`a${c}`']
 ])assert.notEqual(jetons(a),jetons(b),a+' / '+b);
});
test('CH-075 : références d\'identité gelées pour chaque fichier du module 2',()=>{
 const T=require('../tools/typage-ch075.cjs');
 for(const f of ['src/appuis-liste.js','src/file-parties.js','src/file-prioritaire.js']){const r=T.REFERENCES[f];assert.ok(r&&r.base&&r.source&&r.ast,f);}
 assert.deepEqual(T.origine().map(x=>x.fichier),T.PERIMETRE);assert.ok(T.PERIMETRE.length>=2);
});
