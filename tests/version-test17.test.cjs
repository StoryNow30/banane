'use strict';
/* Version de test 17 : 4.9.0.17, nom « 4.9.0 test 17 », partout où la version de
 * test 16 apparaissait (même liste qu'aux tests 2 à 9 : manifeste, core, repli du
 * service worker, pastille du pont, chaîne de version du panneau). Jamais deux
 * paquets de même numéro et de comportement différent. Pas de numéro ni de nom
 * des tests 1 à 9 posés dans le code livré. La LECTURE des anciens exports
 * (4.9.0.2 et plus pour l'observateur, tools/perf-phases.cjs) n'est pas une
 * version posée : elle reste (tests/perf-observations.test.cjs). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),manifest=require('../manifest.json'),K=require('../src/core.js');
const VERSION='4.9.0.17',NOM='4.9.0 test 17';
test('manifeste et core : 4.9.0.17 / « 4.9.0 test 17 »',()=>{
 assert.deepEqual([manifest.version,manifest.version_name,K.VERSION,K.VERSION_NAME],[VERSION,NOM,VERSION,NOM]);
 assert.equal(manifest.action.default_title,`Ouvrir Ariane ${NOM} — V1`);
});
test('service worker, pont, panneau : chaîne de version seulement',()=>{
 assert.ok(read('background.js').includes(`BananeCore3?.VERSION||'${VERSION}',VERSION_NAME=globalThis.BananeCore3?.VERSION_NAME||'${NOM}'`));
 assert.ok(read('src/bridge.js').includes(`'Ariane ${NOM} · ouvrir'`));assert.ok(read('panel.js').includes(`home:'${NOM}'`));
 const html=read('panel.html');for(const t of [`<title>Ariane ${NOM}</title>`,`<span>${NOM}</span>`,`<footer>Ariane ${NOM} ·`])assert.ok(html.includes(t),t);
});
test('aucune trace des noms et numéros des tests 1 à 9 dans les chaînes de version livrées',()=>{
 for(const f of ['manifest.json','src/core.js','src/bridge.js','background.js','panel.js','panel.html'])
  assert.ok(!/4\.9\.0\.[123456789]\b|4\.9\.0 test [123456789]\b/.test(read(f)),f);
});
test('lecture des anciens exports gardée : des journaux 4.9.0.2 à 4.9.0.17 portent encore l’observateur',()=>{
 const {measure}=require('../tools/perf-phases.cjs');
 for(const v of ['4.9.0.2','4.9.0.3','4.9.0.4','4.9.0.5','4.9.0.6','4.9.0.7','4.9.0.8','4.9.0.9','4.9.0.10','4.9.0.11','4.9.0.12','4.9.0.13','4.9.0.14','4.9.0.15','4.9.0.16','4.9.0.17'])assert.equal(measure({version:v,events:[]}).observations.observerExpected,true,v);
 assert.equal(measure({version:'4.9.0.1',events:[]}).observations.observerExpected,undefined,'4.9.0.1 : avant l’observateur');
});
