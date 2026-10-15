'use strict';
/* Version stable 4.9.0 (version candidate) : même code que la 4.9.0.17 (test 17,
 * validée sur le terrain) ; seuls la version et les documents changent. Une stable
 * s'écrit comme la 4.8.6 : manifeste `4.9.0` sans `version_name`, titre « Ouvrir
 * Ariane 4.9.0 », nom affiché « 4.9.0 » partout où la version de test apparaissait
 * (manifeste, core, repli du service worker, pastille du pont, chaîne de version du
 * panneau). Plus aucun nom ni numéro de version de test dans les chaînes de version
 * livrées. La LECTURE des anciens exports (4.9.0.2 et plus pour l'observateur,
 * tools/perf-phases.cjs) n'est pas une version posée : elle reste. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),manifest=require('../manifest.json'),K=require('../src/core.js');
const VERSION='4.9.0',NOM='4.9.0';
test('manifeste et core : 4.9.0 stable, sans nom de test',()=>{
 assert.deepEqual([manifest.version,K.VERSION,K.VERSION_NAME],[VERSION,VERSION,NOM]);
 assert.equal('version_name' in manifest,false,'une stable ne porte pas de nom de test');
 assert.equal(manifest.action.default_title,`Ouvrir Ariane ${NOM}`);
});
test('service worker, pont, panneau : chaîne de version seulement',()=>{
 assert.ok(read('background.js').includes(`BananeCore3?.VERSION||'${VERSION}',VERSION_NAME=globalThis.BananeCore3?.VERSION_NAME||'${NOM}'`));
 assert.ok(read('src/bridge.js').includes(`'Ariane ${NOM} · ouvrir'`));assert.ok(read('panel.js').includes(`home:'${NOM}'`));
 const html=read('panel.html');for(const t of [`<title>Ariane ${NOM}</title>`,`<span>${NOM}</span>`,`<footer>Ariane ${NOM} ·`])assert.ok(html.includes(t),t);
});
test('aucune trace d’un nom ou numéro de version de test dans les chaînes de version livrées',()=>{
 for(const f of ['manifest.json','src/core.js','src/bridge.js','panel.html'])
  assert.ok(!/4\.9\.0\.\d+\b|4\.9\.0 test \d+\b/.test(read(f)),f);
 /* background.js et panel.js gardent des commentaires datés « 4.9.0.17 : … » (historique) ; seules leurs chaînes de version comptent. */
 assert.ok(!/VERSION\|\|'[^']*\.\d+\.\d+\.\d+'|VERSION_NAME\|\|'[^']*test/.test(read('background.js')),'background.js');
 assert.ok(!/home:'[^']*test/.test(read('panel.js')),'panel.js');
});
test('lecture des anciens exports gardée : des journaux 4.9.0.2 à 4.9.0.17 portent encore l’observateur',()=>{
 const {measure}=require('../tools/perf-phases.cjs');
 for(const v of ['4.9.0.2','4.9.0.3','4.9.0.4','4.9.0.5','4.9.0.6','4.9.0.7','4.9.0.8','4.9.0.9','4.9.0.10','4.9.0.11','4.9.0.12','4.9.0.13','4.9.0.14','4.9.0.15','4.9.0.16','4.9.0.17'])assert.equal(measure({version:v,events:[]}).observations.observerExpected,true,v);
 assert.equal(measure({version:'4.9.0.1',events:[]}).observations.observerExpected,undefined,'4.9.0.1 : avant l’observateur');
});
