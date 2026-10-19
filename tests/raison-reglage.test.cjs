'use strict';
/* RM-11 (test 9) — le RÉGLAGE de la raison de la correction et son chemin jusqu'à la séance : coupé par défaut ; le choix du panneau (allumée ou non, rangée de
 * touches : le repli si ESV réagit à un chiffre) est gardé par le service worker, lu au démarrage d'Écho et figé dans la séance ; il ne touche pas au choix du lot.
 * Service worker réel en VM (tests/helpers/perf-production.cjs, importScripts réels), chrome.storage.local en mémoire. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,memoire}=require('./helpers/perf-production.cjs');
const S=require('../src/settings.js'),R=require('../src/raison-correction.js');
const CLE='banane50Raison',plat=x=>JSON.parse(JSON.stringify(x));   // les objets du contexte `vm` n'ont pas le prototype de ce fichier

test('réglages : echo.raison est coupé par défaut et recopie les valeurs du module ; la ligne des réglages affichés le dit',()=>{
 assert.deepEqual({...S.echo.raison},{...R.REGLAGE_DEFAUT});assert.equal(Object.isFrozen(S.echo.raison),true);assert.equal(Object.isFrozen(S.echo),true);
 assert.equal(S.echo.raison.actif,false);assert.equal(S.echo.raison.touches,'chiffres');assert.equal(S.echo.raison.graceMs,500);assert.equal(S.echo.raison.doubleAppuiMs,600);
 assert.equal(S.echo.raison.sautCuts,30);assert.equal(S.echo.raison.rappelCollanteCuts,40);
 const ligne=S.describe().find(l=>l.nom==='Raison de la correction');assert.ok(ligne);assert.equal(ligne.groupe,'Écho');assert.match(ligne.valeur,/^coupée/);assert.match(ligne.pourquoi,/jamais dans les traits/);
});
test('le service worker charge le module avant la session Écho (importScripts) et le garde en global',async()=>{
 const b=production({local:memoire()});
 assert.equal(typeof b.ctx.BananeRaisonCorrection?.lireFrappe,'function');assert.equal(b.ctx.BananeRaisonCorrection.FORMAT,'ariane-raison-v1');
 const liste=require('node:fs').readFileSync(require('node:path').join(__dirname,'../background.js'),'utf8').match(/importScripts\(([^)]*)\)/s)[1],rang=f=>liste.indexOf("'"+f+"'");
 assert.ok(rang('src/raison-correction.js')>=0&&rang('src/raison-correction.js')<rang('src/native-session.js'));
});
test('choix du panneau : coupé et « chiffres » par défaut ; gardé sous sa clé ; refusé s\'il est inconnu ; illisible = coupé',async()=>{
 const local=memoire(),b=production({local});await b.api('connect',{tabId:1});
 assert.deepEqual(plat(await b.api('raison-choix-etat')),{actif:false,touches:'chiffres'});
 assert.deepEqual(plat(await b.api('raison-choix',{actif:true})),{actif:true,touches:'chiffres'});
 assert.deepEqual(plat(await b.api('raison-choix',{touches:'pave'})),{actif:true,touches:'pave'});
 assert.deepEqual(plat(local.m[CLE]),{actif:true,touches:'pave'});assert.deepEqual(Object.keys(local.m).filter(k=>/^banane50/.test(k)),[CLE],'aucune autre clé touchée (le choix du lot est à part)');
 await assert.rejects(()=>b.api('raison-choix',{actif:'oui'}),/oui ou non/);await assert.rejects(()=>b.api('raison-choix',{touches:'azerty'}),/Rangée de touches inconnue/);
 assert.deepEqual(plat(local.m[CLE]),{actif:true,touches:'pave'},'un refus ne change rien');
 for(const illisible of ['x',42,{actif:'oui',touches:'azerty'},{actif:true,touches:'azerty'}]){local.m[CLE]=illisible;
  const c=await b.api('raison-choix-etat');assert.equal(c.actif,typeof illisible==='object'&&illisible.actif===true,JSON.stringify(illisible));assert.equal(c.touches,'chiffres');}
});
test('démarrer Écho avec le choix coupé : exactement comme avant (aucun état, rien de plus envoyé à la page)',async()=>{
 const b=production({local:memoire()});await b.api('connect',{tabId:1});await b.api('native-start');
 const n=b.get('engine').s.native;assert.equal('raison' in n,false);
 const depart=b.commands.find(c=>c.action==='nativeStart');assert.ok(depart);assert.deepEqual(Object.keys(depart.args[0]).sort().map(String),['observationPeriodId','sessionId']);
 assert.equal('raison' in depart.args[0],false);
 /* le secours du panneau ne fait rien quand la lecture est coupée */
 const r=await b.api('native-raison',{code:'adv'});assert.equal(r.pris,false);
});
test('démarrer Écho avec le choix allumé : la séance garde le choix (état, page), et le changer ensuite ne change pas la séance ouverte',async()=>{
 const local=memoire();local.m[CLE]={actif:true,touches:'alt-chiffres'};const b=production({local});await b.api('connect',{tabId:1});await b.api('native-start');
 const n=b.get('engine').s.native;assert.equal(n.raison.actif,true);assert.equal(n.raison.touches,'alt-chiffres');
 assert.equal(b.commands.find(c=>c.action==='nativeStart').args[0].raison,true);
 await b.api('raison-choix',{actif:false,touches:'pave'});
 assert.equal(b.get('engine').s.native.raison.touches,'alt-chiffres','la séance ouverte garde son choix');
 const r=await b.api('native-raison',{code:'adv'});assert.equal(r.pris,false,'aucun cut en cours (aucune visite encore ouverte par la page)');
 /* la pause puis la reprise redonnent l'indication à la page */
 await b.api('native-pause');await b.api('native-resume');assert.equal(b.commands.filter(c=>c.action==='nativeResume').at(-1).args[0].raison,true);
});
