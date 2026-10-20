'use strict';
/* Version de test 4.9.6.1, nom « 4.9.6 test 1 (UI-L1) » : la 4.9.5 test 13 (profil du lot « L1 », D-219 à D-221 de la L1 ; fiches/L1_DIFFERES.md), plus
 * le PANNEAU HABILLÉ « Ariane » (src/ui5*.js, panel-ui5.css ; maquettes/ui-5.0/M-accueil.html, D-230, D-231). Le service worker, le moteur, la pose et
 * les exports sont ceux de la test 13 : l'habillage clique les boutons d'origine du panneau. Écrite comme les versions de test précédentes :
 * manifeste avec `version_name` et titre « Ouvrir Ariane … — V1 », même nom dans core, le repli du service worker, la pastille du pont et la
 * chaîne de version du panneau (posées par tools/ui5-paquets.cjs). Jamais deux paquets de même numéro et de comportement différent. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),manifest=require('../manifest.json'),K=require('../src/core.js');
const VERSION='4.9.6.1',NOM='4.9.6 test 1 (UI-L1)';
test('manifeste et core : 4.9.6.1 / « 4.9.6 test 1 (UI-L1) »',()=>{
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
  assert.ok(!/4\.9\.0\.\d+\b|4\.9\.0 test \d+\b|Ariane 4\.9\.0\b|"4\.9\.0"|4\.9\.5\.[1-9]\d*\b|4\.9\.5 test [1-9]\d*\b/.test(read(f).replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'')),f);
 /* background.js et panel.js gardent des commentaires datés (historique, comme dans src/core.js) ; seules leurs chaînes de version comptent. */
 assert.ok(!/VERSION\|\|'4\.9\.(0[.']|5\.[1-9]\d*')/.test(read('background.js')),'background.js');
 assert.ok(!/home:'4\.9\.(0|5 test [1-9]\d*)/.test(read('panel.js')),'panel.js');
});
test('lecture des anciens exports gardée : des journaux 4.9.0.2 à 4.9.0.20, 4.9.0, 4.9.5.1, 4.9.5.2, 4.9.5.3, 4.9.5.4, 4.9.5.5, 4.9.5.6, 4.9.5.7, 4.9.5.8, 4.9.5.9, 4.9.5.13 et 4.9.6.1 portent l’observateur',()=>{
 const {measure}=require('../tools/perf-phases.cjs');
 const versions=['4.9.0','4.9.5.1','4.9.5.2','4.9.5.3','4.9.5.4','4.9.5.5','4.9.5.6','4.9.5.7','4.9.5.8','4.9.5.9','4.9.5.13',VERSION];for(let n=2;n<=20;n++)versions.push(`4.9.0.${n}`);
 for(const v of versions)assert.equal(measure({version:v,events:[]}).observations.observerExpected,true,v);
 assert.equal(measure({version:'4.9.0.1',events:[]}).observations.observerExpected,undefined,'4.9.0.1 : avant l’observateur');
});
test('RM-11 : la raison de la correction ne demande rien de plus au navigateur (manifeste inchangé hors la version), son module est chargé par le service worker et le panneau ; test 13 : les modules L1 sont chargés par le service worker seulement',()=>{
 /* Empreinte du manifeste de la test 8, version et titre ramenés à « X » : permissions, hôtes, scripts de contenu, icônes, service worker : les mêmes. */
 const n=JSON.parse(JSON.stringify(manifest));n.version='X';n.version_name='X';n.action.default_title='X';
 assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(n)).digest('hex'),'db44abc982081f17c12c398ef52bbe1a43155d4b29d169d6becf99308d27efc0');
 assert.deepEqual(manifest.permissions,['storage','unlimitedStorage','scripting','downloads']);assert.ok(!('commands' in manifest),'aucun raccourci d\'extension : les touches de raison ne sont pas des commandes');
 assert.ok(read('background.js').includes("'src/raison-correction.js','src/native-session.js'"),'chargé avant la session Écho');
 assert.ok(read('panel.html').includes('<script src="src/raison-correction.js"></script><script src="panel.js">'));
 assert.ok(!manifest.content_scripts.some(c=>c.js.includes('src/raison-correction.js')),'jamais injecté dans la page ESV : rien ne lit la raison côté page');
 assert.ok(read('background.js').includes("'src/gcv2-parametres-l1.js','src/gcv2-l1.js');"),'modules L1 chargés après la voie recentrée et les règles métier');
 assert.ok(!manifest.content_scripts.some(c=>c.js.some(f=>/gcv2/.test(f))),'jamais dans la page ESV');
});

test('habillage : chargé après panel.js, dans la page du panneau seulement, jamais injecté dans ESV ; aucune permission de plus',()=>{
 const html=read('panel.html');
 assert.ok(html.includes('<script src="panel.js"></script><script src="src/ui5-variante.js"></script><script src="src/ui5-rendu.js"></script><script src="src/ui5.js"></script></body>'));
 assert.ok(html.includes('<link rel="stylesheet" href="panel.css"><link rel="stylesheet" href="panel-ui5.css">'));
 for(const f of ['src/ui5.js','src/ui5-rendu.js','src/ui5-variante.js'])assert.ok(!manifest.content_scripts.some(c=>c.js.includes(f)),f);
 assert.ok(!/ui5/.test(read('background.js').replace(/\/\*[\s\S]*?\*\//g,'')),'le service worker ne connaît pas l’habillage');
 assert.ok(fs.existsSync(path.join(root,'datasets/compteur-gcv2.json')));
 assert.equal(read('src/ui5-variante.js').match(/defaut: '([a-z]+)'/)[1],'ariane','la présentation « Ariane » par défaut');
});
test('habillage : aucun message au service worker, aucun export, aucune API Chrome hors stockage de son choix, taille de la fenêtre et adresse d’une ressource',()=>{
 for(const f of ['src/ui5.js','src/ui5-rendu.js','src/ui5-variante.js']){
  const s=read(f).replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/sendMessage|runtime\.connect|exportToutZip|exportComplet|saveBlob|downloads|BananeZip|api\(/.test(s),f);
  const apis=[...s.matchAll(/chrome\??\.[a-zA-Z]+(?:\??\.[a-zA-Z]+)*/g)].map(m=>m[0].replace(/\?/g,''));
  for(const a of apis)assert.ok(['chrome.storage.local.get','chrome.storage.local.set','chrome.windows','chrome.windows.getCurrent','chrome.windows.update','chrome.runtime.getURL','chrome.storage.local','chrome.storage','chrome.runtime','chrome'].includes(a)||/^chrome\.(storage|windows|runtime)/.test(a),f+' : '+a);
  assert.ok(!/chrome\??\.(tabs|downloads|scripting|webNavigation)/.test(s),f);
 }
});
