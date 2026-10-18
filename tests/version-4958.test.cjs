'use strict';
/* Version de test 4.9.5.8, nom « 4.9.5 test 8 » : tout ce qu'avait la test 7 (panneau rangé en groupes, départ de lot sur un cut vert sans écriture,
 * fiabilité du lot, PN confirmé par deux cœurs consécutifs, relecture après le lot coupée par défaut, ombre et corriger), plus la COUVERTURE de la
 * relecture d'après l'Écho de la partie 11 (D-185, D-186) : plus de plafond en ADV, ADV proches enchaînées, liste « À contrôler » et cuts « écartement »
 * jamais écartés, cut d'avant et d'après un cut « écartement », zone « écartement » corrigeable par réglage. Écrite comme les versions de test précédentes : manifeste avec `version_name` et
 * titre « Ouvrir Ariane … — V1 », même nom dans core, le repli du service worker, la pastille du pont et la
 * chaîne de version du panneau. Jamais deux paquets de même numéro et de comportement différent. La LECTURE des
 * anciens exports (4.9.0.2 et plus pour l'observateur, tools/perf-phases.cjs) n'est pas une version posée :
 * elle reste (tests/perf-observations.test.cjs). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),manifest=require('../manifest.json'),K=require('../src/core.js');
const VERSION='4.9.5.8',NOM='4.9.5 test 8';
test('manifeste et core : 4.9.5.8 / « 4.9.5 test 8 »',()=>{
 assert.deepEqual([manifest.version,manifest.version_name,K.VERSION,K.VERSION_NAME],[VERSION,NOM,VERSION,NOM]);
 assert.equal(manifest.action.default_title,`Ouvrir Ariane ${NOM} — V1`);
});
test('service worker, pont, panneau : chaîne de version seulement',()=>{
 assert.ok(read('background.js').includes(`BananeCore3?.VERSION||'${VERSION}',VERSION_NAME=globalThis.BananeCore3?.VERSION_NAME||'${NOM}'`));
 assert.ok(read('src/bridge.js').includes(`'Ariane ${NOM} · ouvrir'`));assert.ok(read('panel.js').includes(`home:'${NOM}'`));
 const html=read('panel.html');for(const t of [`<title>Ariane ${NOM}</title>`,`<span>${NOM}</span>`,`<footer>Ariane ${NOM} ·`])assert.ok(html.includes(t),t);
});
test('aucune trace d’une autre version de test dans les chaînes de version livrées',()=>{
 for(const f of ['manifest.json','src/core.js','src/bridge.js','panel.html'])
  assert.ok(!/4\.9\.0\.\d+\b|4\.9\.0 test \d+\b|Ariane 4\.9\.0\b|"4\.9\.0"|4\.9\.5\.[1-7]\b|4\.9\.5 test [1-7]\b/.test(read(f).replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'')),f);
 /* background.js et panel.js gardent des commentaires datés (historique, comme dans src/core.js) ; seules leurs chaînes de version comptent. */
 assert.ok(!/VERSION\|\|'4\.9\.(0[.']|5\.[1-7])/.test(read('background.js')),'background.js');
 assert.ok(!/home:'4\.9\.(0|5 test [1-7])/.test(read('panel.js')),'panel.js');
});
test('lecture des anciens exports gardée : des journaux 4.9.0.2 à 4.9.0.20, 4.9.0, 4.9.5.1, 4.9.5.2, 4.9.5.3, 4.9.5.4, 4.9.5.5, 4.9.5.6, 4.9.5.7 et 4.9.5.8 portent l’observateur',()=>{
 const {measure}=require('../tools/perf-phases.cjs');
 const versions=['4.9.0','4.9.5.1','4.9.5.2','4.9.5.3','4.9.5.4','4.9.5.5','4.9.5.6','4.9.5.7',VERSION];for(let n=2;n<=20;n++)versions.push(`4.9.0.${n}`);
 for(const v of versions)assert.equal(measure({version:v,events:[]}).observations.observerExpected,true,v);
 assert.equal(measure({version:'4.9.0.1',events:[]}).observations.observerExpected,undefined,'4.9.0.1 : avant l’observateur');
});
