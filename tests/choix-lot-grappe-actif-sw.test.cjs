'use strict';
/* 4.9.5 test 6 (D-164, demande de Mic) — L'INTERRUPTEUR « GRAPPE DE DIFFÉRÉS » DU PANNEAU : ACTIVÉ.
 * (Coupé, et changé en cours de lot : tests/choix-lot-grappe-sw.test.cjs.) Service worker réel en VM
 * (tests/helpers/regles-metier-lot.cjs : cuts 112 et 113 sans point, différés ; 114 et 115 posés juste après la grappe),
 * chrome.storage.local en mémoire.
 *  - Coupé (défaut, ou rien de gardé) : commandes identiques à la base, octet pour octet (tests/fixtures/choix-lot-50-base.json).
 *  - Activé : le chemin d'activation existant s'ouvre pour `grappe-differes` SEULEMENT, exactement comme le réglage
 *    `reglesMetier.actif` + `regles['grappe-differes']` : des validations deviennent des différés, sans aucune pose nouvelle ni
 *    type d'appel nouveau ; `pn-chaque-cut` et `zone-validation-en-place` restent coupées.
 *  - Lu au démarrage du lot et figé : un changement pendant le lot attend le lot suivant.
 *  - Consigné : `regleGrappeDifferes:true` dans le scope du lot (`batch-started`, état exporté) ; chaque cut mis en attente par la
 *    règle : son événement `regles-metier-ombre` (`actif:{applique:true,regles:['grappe-differes']}`) et le motif `regles-metier`. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lot,neutre,decisions,ombres,deq,rec,S}=require('./helpers/regles-metier-lot.cjs');
const {memoire}=require('./helpers/perf-production.cjs');
const GOLDEN=require('./fixtures/choix-lot-50-base.json');
const garder=choix=>async b=>{const local=memoire();Object.assign(local.m,choix);b.ctx.chrome.storage.local=local;b.local=local;};
const scope=b=>b.get('engine').s.batch.scope;
/* Chaque lot est joué à la première demande (deux lots par fichier : loin de la limite de 20 s du banc). */
const memo=f=>{let p=null;return ()=>p||(p=f());};
const L={
 actifReglage:memo(()=>lot({...S.reglesMetier,actif:true,regles:{...S.reglesMetier.regles,'grappe-differes':true}})),
 actifPanneau:memo(()=>lot(undefined,{avant:garder({banane50GrappeDifferes:true})}))};

test('activé dans le panneau : exactement le chemin d\'activation de la règle seule ; validations changées en différés, aucune pose nouvelle',async()=>{
 const actifReglage=await L.actifReglage(),actifPanneau=await L.actifPanneau();
 const dr=decisions(actifReglage.b),dp=decisions(actifPanneau.b),appelsBase=GOLDEN.grappe.appels;
 assert.equal(JSON.stringify(neutre(dp)),JSON.stringify(neutre(dr)),'mêmes décisions que le réglage ouvert pour cette règle');
 assert.deepEqual(actifPanneau.adapter.calls,actifReglage.adapter.calls);
 deq(dp.map(([c,x])=>[c,x.stage,x.command?.action]),[[112,'deferred','engine'],[113,'deferred','engine'],[114,'first-pass','defer'],[115,'first-pass','defer']]);
 for(const k of [2,3])assert.equal(dp[k][1].command.reason,'regles-metier');
 /* Rien de neuf vers ESV : aucun type d'appel nouveau, moins de poses et de validations. */
 for(const c of new Set(actifPanneau.adapter.calls))assert.ok(appelsBase.includes(c),'aucun type d\'appel nouveau : '+c);
 const n=(l,c)=>l.filter(y=>y===c).length;
 assert.ok(n(actifPanneau.adapter.calls,'validate')<n(appelsBase,'validate'),'une validation de moins');assert.equal(n(actifPanneau.adapter.calls,'apply'),0);assert.equal(n(appelsBase,'apply'),2);
 assert.ok(!actifPanneau.b.commands.some(c=>c.action==='apply'),'aucune pose');
 /* Ce qui n'est pas mis en attente : les deux premiers cuts, différés par le moteur, comme sans la règle. */
 deq(dp.slice(0,2).map(([c,x])=>[c,x.stage,x.command?.action,x.command?.reason??null]),[[112,'deferred','engine','deferred'],[113,'deferred','engine','deferred']]);
 assert.deepEqual(actifPanneau.adapter.calls.slice(0,4),appelsBase.slice(0,4),'cuts 112 et 113 : mêmes appels');
 assert.ok(rec(actifPanneau.b).some(r=>r[0]===114&&r[1]==='deferred-unresolved'),'114 mis en attente');
});

test('consigné : le lot porte l\'interrupteur ; chaque cut mis en attente a son événement ; les autres règles restent coupées',async()=>{
 const b=(await L.actifPanneau()).b;
 assert.equal(scope(b).regleGrappeDifferes,true);
 assert.deepEqual(b.store.events.filter(e=>e.type==='batch-started').map(e=>e.batch.scope.regleGrappeDifferes),[true]);
 const appliques=ombres(b).filter(e=>e.actif?.applique);
 assert.deepEqual(appliques.map(e=>e.identity.cut),[114,115]);
 for(const e of appliques)deq(e.actif,{applique:true,regles:['grappe-differes']});
 const r=b.get('reglesReglage')();
 deq(r.regles,{'zone-validation-en-place':false,'pn-chaque-cut':false,'grappe-differes':true});assert.equal(r.actif,true);
 /* Le réglage livré, lui, n'est pas touché. */
 assert.equal(b.ctx.BananeSettings.reglesMetier.actif,false);assert.equal(b.ctx.BananeSettings.reglesMetier.regles['grappe-differes'],false);
});

