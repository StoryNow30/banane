'use strict';
/* Test 7, suite (coordination) — PARTIE COMPLÈTE : RIEN N'EST ENVOYÉ À ESV SUR UN CUT DÉJÀ TRAITÉ.
 * Constaté au banc avant correction : sur une partie dont le compteur d'ESV « N on M treated » est complet (N = M), le lot
 * posait (`apply`) et validait (`validateAndNext`) le cut affiché, déjà traité, puis ESV chargeait la partie suivante. Un
 * opérateur ne fait pas cette écriture. Règle : au PREMIER cut du lot, avant toute commande, si le relevé du compteur de ce
 * cut dit la partie complète ET si la liste d'ESV (mémoire de la page, lecture B1) donne à ce cut un statut lu et non
 * « invalid », le lot se clôt sans rien envoyer. Toute information absente ou incertaine : commandes d'avant, à l'octet près.
 * Un cut rouge n'est jamais retenu. Service worker réel en VM, moteur et GCV1 réels, ESV simulé ; données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {scenario,fenetre,AVIS}=require('./helpers/partie-complete.cjs');

test('partie complète (compteur N = M) et cut affiché vert : 0 commande envoyée à ESV, lot clos avec l’avis',async()=>{
 for(const statut of ['valid','skipped']){
  const s=await scenario({mesure:{total:101,traites:101},liste:fenetre(50,statut)});
  assert.deepEqual(s.ecritures,[],`aucune écriture (${statut}) : ${s.calls}`);assert.deepEqual(s.trace,[]);
  assert.equal(s.view.batch.state,'STOPPED');assert.equal(s.view.notice,AVIS);
  assert.equal(s.view.batch.stoppedAtEnd.issue,'partie-sans-rouge');assert.equal(s.view.batch.stoppedAtEnd.applied,false);
  assert.equal(s.view.batch.processed.length,0);assert.equal(s.view.batch.deferred.length,0);
  const ev=s.b.store.events.filter(e=>e.type==='batch-stopped-at-end').at(-1);
  assert.equal(ev.reason,'partie-sans-rouge');assert.equal(ev.lastCut,50);assert.equal(ev.total,101);assert.equal(ev.statut,statut);
  /* « Reprendre » ne rejoue rien. */
  const v=await s.b.api('resume');assert.equal(v.batch.state,'STOPPED');assert.match(v.notice,/^Lot déjà terminé : partie sans cut rouge \(cut 50\)/);
  assert.deepEqual(s.b.adapter.calls.filter(c=>c!=='capture'),[]);}
});

test('la liste n’est lue que si le compteur dit la partie complète, et une seule fois, au premier cut',async()=>{
 const reste=await scenario({mesure:{total:101,traites:90},liste:fenetre(50,'valid')});
 assert.equal(reste.lectures.filter(c=>c===50).length,reste.lectures.length,'aucune lecture en plus d’un autre cut');
 const avant=await scenario({mesure:null,liste:fenetre(50,'valid')});
 const complet=await scenario({mesure:{total:101,traites:101},liste:fenetre(50,'invalid')});
 assert.equal(complet.lectures.length-avant.lectures.length,1,'une lecture de la liste, en mémoire de la page, pour le seul premier cut');
 assert.equal(reste.lectures.length,avant.lectures.length,'partie incomplète : aucune lecture ajoutée');
});
