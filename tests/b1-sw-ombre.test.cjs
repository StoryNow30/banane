'use strict';
/* B1 (D-095), service worker réel en VM (montage : tests/helpers/b1-montage.cjs), repère déjà
 * calibré : en OMBRE (réglage livré), rien ne change — commandes, poses, enregistrements,
 * événements métier — et l'hypothèse est consignée ; en ACTIF (non livré), elle devient la
 * décision, sur la règle d'emploi seulement. Un cut par lot : le premier d'un lot n'a pas
 * d'appui du lot (premier passage sans voie) ; c'est aussi le dernier du lot, laissé sans commande
 * quand il est différé. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {montage,lot,evts,voieAriane,prerégler,deq,normalize}=require('./helpers/b1-montage.cjs');
let voie;before(async()=>{voie=await voieAriane();});
const decision=(s,cut)=>s.b.store.events.filter(e=>e.type==='gcv1-shadow-observed'&&e.identity?.cut===cut).at(-1).lotObservation;
async function un(mode,decalageMm,vider=true){const s=montage({mode,decalageMm});prerégler(s,voie);await lot(s,110,110,{vider});return s;}

test('ombre : mêmes commandes, mêmes poses, mêmes enregistrements qu’avec le réglage coupé ; premier passage sans voie gardé en hypothèse seulement',{timeout:60000},async()=>{
  const a=await un('off',100),c=await un('ombre',100,false);
  deq(normalize(c.b.commands),normalize(a.b.commands),'mêmes commandes ESV, même ordre');deq(normalize(c.adapter.rails),normalize(a.adapter.rails));deq(c.adapter.calls,a.adapter.calls);
  const rec=b=>b.store.records.map(r=>[r.identity?.cut,r.status,r.validationProof??null,r.commandSent??null]);deq(rec(c.b),rec(a.b));
  const metier=b=>b.store.events.filter(e=>!['b1-ombre','regles-metier-ombre','esv-observation','phase-timing'].includes(e.type)).map(e=>e.type);deq(metier(c.b),metier(a.b),'mêmes événements métier');
  assert.equal(evts(a.b).length,0,'réglage coupé : aucun calcul, aucune demande');assert.equal(a.demandes.length,0);
  deq([decision(c,110).stage,decision(c,110).anchorsUsed,decision(c,110).appuisListe],['first-pass',[],undefined],'décision réelle : premier passage sans appui, inchangée');
  /* L'hypothèse lourde (reprise depuis la voie) attend que la page travaille : capture suivante, ou 4 s. */
  assert.equal(evts(c.b).find(x=>x.identity.cut===110),undefined,'pas encore conclue');assert.equal(c.b.get('b1File').length,1);
  c.b.get('b1Vider')();await new Promise(r=>setTimeout(r,10));
  const h=evts(c.b).find(x=>x.identity.cut===110);
  deq([h.etat,h.regle,h.hypothese.stage,h.hypothese.guardMm>=95,h.changement],['calcule','garde-premier-passage','deferred',true,'pose-retiree'],'hypothèse : voisins à 100 mm, la garde retire la paire');
});
test('actif : voisins à 100 mm, l’hypothèse devient la décision (différé par Orbite)',{timeout:60000},async()=>{
  const s=await un('actif',100),lo=decision(s,110);
  deq([lo.stage,lo.guardDeferred,lo.appuisListe.regle,lo.command.action],['deferred',true,'garde-premier-passage','defer']);
  assert.ok(!s.adapter.calls.includes('apply'),'rien n’est posé (dernier cut du lot : laissé sans commande)');
});
test('actif, voisins sur la voie : le premier passage sans appui est confirmé et posé comme aujourd’hui',{timeout:60000},async()=>{
  const s=await un('actif',0),lo=decision(s,110);
  deq([lo.stage,lo.command.action,lo.validatedAnchors.length>=3,lo.guardMm<1],['first-pass','engine',true,true],'voisins sur la voie : premier passage confirmé, posé');
});
