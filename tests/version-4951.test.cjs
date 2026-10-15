'use strict';
/* Version de test 4.9.5.1, nom « 4.9.5 test 1 » (première version de test de la 4.9.5, partie de la 4.9.0 stable),
 * écrite comme les versions de test 4.9.0.N : manifeste avec `version_name` et titre « Ouvrir Ariane … — V1 », même
 * nom dans core, le repli du service worker, la pastille du pont et la chaîne de version du panneau. Jamais deux
 * paquets de même numéro et de comportement différent. La LECTURE des anciens exports (4.9.0.2 et plus pour
 * l'observateur, tools/perf-phases.cjs) n'est pas une version posée : elle reste. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),manifest=require('../manifest.json'),K=require('../src/core.js');
const VERSION='4.9.5.1',NOM='4.9.5 test 1';
test('manifeste et core : 4.9.5.1 / « 4.9.5 test 1 »',()=>{
 assert.deepEqual([manifest.version,manifest.version_name,K.VERSION,K.VERSION_NAME],[VERSION,NOM,VERSION,NOM]);
 assert.equal(manifest.action.default_title,`Ouvrir Ariane ${NOM} — V1`);
});
test('service worker, pont, panneau : chaîne de version seulement',()=>{
 assert.ok(read('background.js').includes(`BananeCore3?.VERSION||'${VERSION}',VERSION_NAME=globalThis.BananeCore3?.VERSION_NAME||'${NOM}'`));
 assert.ok(read('src/bridge.js').includes(`'Ariane ${NOM} · ouvrir'`));assert.ok(read('panel.js').includes(`home:'${NOM}'`));
 const html=read('panel.html');for(const t of [`<title>Ariane ${NOM}</title>`,`<span>${NOM}</span>`,`<footer>Ariane ${NOM} ·`])assert.ok(html.includes(t),t);
});
test('aucune trace d’une version de test 4.9.0.N ni de la stable 4.9.0 dans les chaînes de version livrées',()=>{
 for(const f of ['manifest.json','src/core.js','src/bridge.js','panel.html'])
  assert.ok(!/4\.9\.0\.\d+\b|4\.9\.0 test \d+\b|Ariane 4\.9\.0\b|"4\.9\.0"/.test(read(f)),f);
 /* background.js et panel.js gardent des commentaires datés « 4.9.0.17 : … » (historique) ; seules leurs chaînes de version comptent. */
 assert.ok(!/VERSION\|\|'4\.9\.0[.']/.test(read('background.js')),'background.js');
 assert.ok(!/home:'4\.9\.0/.test(read('panel.js')),'panel.js');
});
test('lecture des anciens exports gardée : des journaux 4.9.0.2 à 4.9.0.17, 4.9.0 et 4.9.5.1 portent l’observateur',()=>{
 const {measure}=require('../tools/perf-phases.cjs');
 for(const v of ['4.9.0.2','4.9.0.3','4.9.0.4','4.9.0.5','4.9.0.6','4.9.0.7','4.9.0.8','4.9.0.9','4.9.0.10','4.9.0.11','4.9.0.12','4.9.0.13','4.9.0.14','4.9.0.15','4.9.0.16','4.9.0.17','4.9.0','4.9.5.1'])assert.equal(measure({version:v,events:[]}).observations.observerExpected,true,v);
 assert.equal(measure({version:'4.9.0.1',events:[]}).observations.observerExpected,undefined,'4.9.0.1 : avant l’observateur');
});
