'use strict';
/* Version de test 2 (D-078) : 4.9.0.2, nom « 4.9.0 test 2 », partout où la
 * version de test 1 apparaissait. Le panneau ne change que sa chaîne de version
 * (le reste est à la mission G). Pas de numéro de test 1 résiduel. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),manifest=require('../manifest.json'),K=require('../src/core.js');
const VERSION='4.9.0.2',NOM='4.9.0 test 2';
test('manifeste et core : 4.9.0.2 / « 4.9.0 test 2 »',()=>{
 assert.deepEqual([manifest.version,manifest.version_name,K.VERSION,K.VERSION_NAME],[VERSION,NOM,VERSION,NOM]);
 assert.equal(manifest.action.default_title,`Ouvrir Ariane ${NOM} — V1`);
});
test('service worker, pont, panneau : chaîne de version seulement',()=>{
 assert.ok(read('background.js').includes(`BananeCore3?.VERSION||'${VERSION}',VERSION_NAME=globalThis.BananeCore3?.VERSION_NAME||'${NOM}'`));
 assert.ok(read('src/bridge.js').includes(`'Ariane ${NOM} · ouvrir'`));assert.ok(read('panel.js').includes(`home:'${NOM}'`));
 const html=read('panel.html');for(const t of [`<title>Ariane ${NOM}</title>`,`<span>${NOM}</span>`,`<footer>Ariane ${NOM} ·`])assert.ok(html.includes(t),t);
});
test('aucune trace de la version de test 1 dans le code livré',()=>{
 for(const f of ['manifest.json','src/core.js','src/bridge.js','background.js','panel.js','panel.html'])assert.ok(!/4\.9\.0\.1\b|4\.9\.0 test 1/.test(read(f)),f);
});
