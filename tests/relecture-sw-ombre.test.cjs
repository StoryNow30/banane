'use strict';
/* 5.0 (D-170 à D-176) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : ombre : visite, capture,
 * calcul, note ; Ariane n'envoie jamais de pose, de validation, de SKIP ni d'écriture ; ESV, lui, écrit « vu » sur chaque cut affiché
 * pour la première fois : la passe les annonce et les compte (revue, correction 9). Départ juste après le lot, sans pause ajoutée
 * (D-176). Chaîne d'appuis vide au départ, sans les poses du lot (correction 8). Le lot avant la passe est celui de la base, et ses
 * commandes ne portent aucune marque de la relecture (R7). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinteLot,j,sansRelecture,PERMISSIF,apresLot,LECTURES}=require('./helpers/relecture-essais.cjs');

test('ombre : chaque cut choisi est visité, capturé, calculé et noté ; aucune pose, validation, SKIP ni écriture d’Ariane ; « vu » d’ESV compté ; chaîne vide',async()=>{
 const {b,adapter,lot,local}=await H.lotRelecture({mode:'ombre',decisions:{109:14,115:20},reglagesProposes:PERMISSIF,esv:a=>{a.sansPoints.add(114);}});
 const p=await H.finPasse(b);
 assert.equal(empreinteLot(sansRelecture(lot)),GOLDEN.empreinteCommandes,'le lot avant la passe est celui de la base');
 assert.equal(/relecture/i.test(JSON.stringify(lot)),false,'R7 : le choix de relecture ne part pas vers la page avec les commandes du lot');
 assert.equal(b.store.events.find(e=>e.type==='batch-started').batch.scope.relecture,'ombre','choix consigné dans batch-started');
 assert.equal(p.etat,'finie');assert.equal(p.faits,7);assert.equal(p.corriges,0);
 assert.match(p.message,/^Relecture finie : 7 cuts relus, rien de modifié ; ESV a marqué 6 cuts « vu »\.$/);
 /* Ordre de l'opérateur, par plage : 108, 109, 110, le différé 113, 114, 115, 116 ; 111 et 112 (posés par le lot) traversés. */
 assert.deepEqual(adapter.allees.map(a=>a.cut),[108,109,110,113,114,115,116]);
 assert.deepEqual(adapter.allees.map(a=>a.chemin),['auto','pas','pas','pas','pas','pas','pas'],'boutons « cut suivant » dans la plage');
 const apres=apresLot(b,lot);
 assert.deepEqual([...new Set(apres.map(c=>c.action??null))].filter(a=>!LECTURES.has(a)),[],'que des lectures et des navigations');
 for(const a of H.ECRITURES)assert.equal(apres.some(c=>c.action===a),false,a);
 assert.equal(adapter.majEspace.length,0);assert.equal(adapter.enPlace.length,0);assert.equal(adapter.applyArgs.length,2,'les deux poses du lot seulement');
 assert.equal(H.CLE+'Intention' in local.m,false,'aucune intention de correction');
 const ev=H.evenements(b,'relecture-ombre');assert.equal(ev.length,7);
 const e109=ev.find(e=>e.identity.cut===109);
 assert.equal(e109.action,'visite');assert.equal(e109.verdict,'je corrigerais');assert.equal(e109.critere.corriger,true,'la règle dirait « corriger »');assert.equal(e109.garde,null,'ombre : aucune garde, aucune correction');
 assert.deepEqual(j(e109.ecartMm.left),{long:0,lat:14,vert:0});assert.equal(e109.zone,'abords');assert.equal(e109.role,'vert');
 assert.deepEqual(j(e109.statutEsv),{statut:'valid',operateur:false,vu:false},'statut lu dans la liste d’ESV à l’arrivée');assert.equal(e109.arrivee,'pas');
 assert.ok(Array.isArray(e109.poseEsv.left)&&Array.isArray(e109.poseCalculee.right));assert.ok(e109.confiance&&'left' in e109.confiance);
 assert.match(e109.raison,/rail gauche, latéral 14 mm/);assert.deepEqual(j(e109.skipOmbre),{raison:null,points:{left:2322,right:2442},captures:1,capturesVides:0});
 /* Correction 8 : le cut 113, différé par le lot, est calculé pour de vrai SANS les poses du lot (111, 112) pour appuis, et sa pose
  * n'entre jamais dans la chaîne, même au premier passage. */
 const e113=ev.find(e=>e.identity.cut===113);assert.equal(e113.role,'differe','le dernier cut laissé sans commande est relu comme un différé');
 assert.equal(e113.etage,'first-pass');assert.deepEqual(j(e113.appuis),[],'aucune pose du lot pour appui');assert.equal(e113.enChaine,false,'un différé n’entre jamais dans la chaîne');
 for(const e of ev){assert.ok(!e.appuis.some(c=>[111,112].includes(c)),`cut ${e.identity.cut} : aucune pose du lot pour appui`);assert.equal(e.chaineCuts,0,'chaîne vide : aucun vert posé en chaîne dans cet essai');}
 assert.deepEqual(j(e113.statutEsv),{statut:'invalid',operateur:false,vu:true});
 /* D-172 : aucun point affiché au cut 114, relu une seconde fois, toujours vide : SKIP en ombre, consigné ; aucun SKIP envoyé. */
 assert.deepEqual(j(ev.find(e=>e.identity.cut===114).skipOmbre),{raison:'aucun-point',points:{left:0,right:0},captures:2,capturesVides:2});
 for(const e of ev)for(const k of ['navigationMs','captureMs','calculMs','totalMs'])assert.ok(Number.isFinite(e.durees[k]),k);
 const debut=H.evenements(b,'relecture-debut')[0],fin=H.evenements(b,'relecture-fin')[0];
 assert.equal(debut.mode,'ombre');assert.equal(debut.total,7);assert.equal(debut.variante,'chaine+h');assert.equal(debut.chaine,'vide');
 assert.deepEqual(j(debut.parZone),{pn:0,adv:0,abords:7,'vert-hors-zone':0,ecartement:0});assert.equal(debut.reglages.source,'propose');assert.equal(debut.reglages.statut,'essai');
 /* Correction 9 : annoncés au départ, les cuts neufs (jamais vus) que la passe affichera : 108, 109, 110, 114, 115, 116 ; comptés à la fin. */
 assert.equal(debut.cutsNeufsAnnonces,6);assert.equal(fin.vus,6);assert.equal(fin.cutsNeufs,6);assert.equal(fin.issue,'fin');assert.equal(fin.corriges,0);
 /* D-176 : départ juste après le lot, sans compte à rebours ni pause ajoutée. */
 const finLot=b.store.events.filter(e=>e.type==='batch-stopped-at-end'||e.type==='batch-state').at(-1);
 assert.ok(Date.parse(debut.timestamp)-Date.parse(finLot.timestamp)<3000,'départ juste après la fin du lot');
 const etat=await b.api('relecture-etat');assert.equal(etat.passe.etat,'finie');assert.equal(etat.lot.mode,'ombre');assert.equal(etat.passe.vus,6);
 assert.deepEqual(j((await b.api('view')).relecture),{etat:'finie',mode:'ombre',faits:7,total:7,corriges:0,vus:6,cut:null,message:p.message});
});
