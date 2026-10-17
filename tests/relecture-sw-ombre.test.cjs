'use strict';
/* 5.0 (D-170 à D-173) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : ombre : visite, capture, calcul, note ; jamais de pose, de validation, de SKIP ni d'écriture ; le lot avant la passe est celui de la base. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinte,j,sansRelecture,PERMISSIF,apresLot,LECTURES,coupee}=require('./helpers/relecture-essais.cjs');

test('ombre : chaque cut choisi est visité, capturé, calculé et noté ; aucune pose, validation, SKIP ni écriture, même quand la règle dirait « corriger »',async()=>{
 const {b,adapter,lot,local}=await H.lotRelecture({mode:'ombre',decisions:{109:14,115:20},reglagesProposes:PERMISSIF,esv:a=>{a.sansPoints.add(114);}});
 const p=await H.finPasse(b);
 assert.equal(empreinte(H.neutre(sansRelecture(lot))),GOLDEN.empreinteCommandes,'le lot avant la passe est celui de la base');
 assert.equal(b.store.events.find(e=>e.type==='batch-started').batch.scope.relecture,'ombre','choix consigné dans batch-started');
 assert.equal(p.etat,'finie');assert.equal(p.faits,7);assert.equal(p.corriges,0);assert.match(p.message,/7 cuts relus, rien de modifié/);
 /* Ordre de Mic, par plage : 108, 109, 110, le différé 113, 114, 115, 116 ; 111 et 112 (posés par le lot) traversés. */
 assert.deepEqual(adapter.allees.map(a=>a.cut),[108,109,110,113,114,115,116]);
 assert.deepEqual(adapter.allees.map(a=>a.chemin),['auto','pas','pas','pas','pas','pas','pas'],'boutons « cut suivant » dans la plage');
 const apres=apresLot(b,lot);
 assert.deepEqual([...new Set(apres.map(c=>c.action??null))].filter(a=>!LECTURES.has(a)),[],'que des lectures et des navigations');
 for(const a of H.ECRITURES)assert.equal(apres.some(c=>c.action===a),false,a);
 assert.equal(adapter.enPlace.length,0);assert.equal(adapter.applyArgs.length,2,'les deux poses du lot seulement');
 assert.equal(H.CLE+'Intention' in local.m,false,'aucune intention de correction');
 const ev=H.evenements(b,'relecture-ombre');assert.equal(ev.length,7);
 const e109=ev.find(e=>e.identity.cut===109);
 assert.equal(e109.action,'visite');assert.equal(e109.verdict,'je corrigerais');assert.equal(e109.critere.corriger,true,'la règle dirait « corriger »');
 assert.deepEqual(j(e109.ecartMm.left),{long:0,lat:14,vert:0});assert.equal(e109.zone,'abords');assert.equal(e109.role,'vert');
 assert.ok(Array.isArray(e109.poseEsv.left)&&Array.isArray(e109.poseCalculee.right));assert.ok(e109.confiance&&'left' in e109.confiance);
 assert.match(e109.raison,/rail gauche, latéral 14 mm/);assert.deepEqual(j(e109.skipOmbre),{raison:null,points:{left:2322,right:2442},captures:1,capturesVides:0});
 const e113=ev.find(e=>e.identity.cut===113);assert.equal(e113.role,'differe','le dernier cut laissé sans commande est relu comme un différé');
 /* Le cut 113 est calculé pour de vrai (moteur, décision avec les appuis 111 et 112 du lot, hauteur apprise) : reprise depuis la voie,
  * à 268 mm de la pose d'ESV, dont la commande tombe hors de la vue : rien à corriger. */
 assert.equal(e113.etage,'window');assert.ok(e113.pireMm>200);assert.deepEqual(j(e113.appuis).sort(),[111,112]);assert.equal(e113.critere.regle,'commande');
 /* D-172 : aucun point affiché au cut 114, relu une seconde fois, toujours vide : SKIP en ombre, consigné ; aucun SKIP envoyé. */
 assert.deepEqual(j(ev.find(e=>e.identity.cut===114).skipOmbre),{raison:'aucun-point',points:{left:0,right:0},captures:2,capturesVides:2});
 assert.equal(apres.some(c=>c.action==='skipAndNext'),false);
 for(const e of ev)for(const k of ['navigationMs','captureMs','calculMs','totalMs'])assert.ok(Number.isFinite(e.durees[k]),k);
 const debut=H.evenements(b,'relecture-debut')[0],fin=H.evenements(b,'relecture-fin')[0];
 assert.equal(debut.mode,'ombre');assert.equal(debut.total,7);assert.equal(debut.variante,'chaine+h');assert.deepEqual(j(debut.parZone),{pn:0,adv:0,abords:7,'vert-hors-zone':0,ecartement:0});assert.deepEqual(j(debut.reglages),{source:'propose',statut:'essai'});
 assert.equal(fin.issue,'fin');assert.equal(fin.corriges,0);
 const etat=await b.api('relecture-etat');assert.equal(etat.passe.etat,'finie');assert.equal(etat.lot.mode,'ombre');
 assert.deepEqual(j((await b.api('view')).relecture),{etat:'finie',mode:'ombre',faits:7,total:7,corriges:0,cut:null,message:p.message});
});
