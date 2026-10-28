'use strict';
/* 5.0, revue de la relecture (D-175, correction 1) — LE RÔLE « VERT » N'EST JAMAIS PRÉSUMÉ. Un cut SKIPpé par l'opérateur, repris à la main,
 * une cible bloquée (résultat incertain archivé) sont des cuts du lot : traversés, jamais corrigés, même si la liste d'ESV les montrait
 * verts. Et une cible bloquée APRÈS le départ de la passe est refusée par la garde (`engine.writable`). Un vert d'ESV prouvé, dans la
 * même passe, est corrigé (contrôle). Données synthétiques, réglages d'essai complets (abords ouverts à 12 mm). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,j,PERMISSIF,apresLot}=require('./helpers/relecture-essais.cjs');

test('SKIP de l\'opérateur, reprise à la main, cible bloquée : cuts du lot, traversés, jamais posés ni validés ; cible bloquée en cours de passe : garde ; vert prouvé : corrigé',async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',decisions:{109:14,110:14,114:14,115:20,117:14},reglagesProposes:PERMISSIF,relecture:{departMs:150},
  esv:(a,bb)=>{a.surAller=async t=>{if(t.cut===117){const e=bb.get('engine');e.s.blockedTargets=[...(e.s.blockedTargets||[]),H.K.key(H.K.completeIdentity({...a.identity,cut:117}))];}};}});
 /* Pendant le lot (journal du lot) : l'opérateur a SKIPpé le cut 109, repris le cut 110 à la main ; le cut 115 a un résultat incertain archivé. */
 const e=b.get('engine'),bt=e.s.batch,id=c=>H.K.completeIdentity({...adapter.identity,cut:c});
 bt.skipped=[{key:H.K.key(id(109)),identity:id(109),cut:109,decisionRule:'operator-explicit-from-paused-cut'}];
 bt.manuallyCompleted=[{key:H.K.key(id(110)),identity:id(110),cut:110,bananeValidated:false}];bt.interrupted=[...(bt.interrupted||[]),{identity:id(110),status:'MANUAL_COMPLETION'}];
 e.s.blockedTargets=[H.K.key(id(115))];
 const p=await H.finPasse(b);
 assert.equal(p.etat,'finie',p.message);
 const ev=H.evenements(b,'relecture-ombre'),relus=ev.map(x=>x.identity.cut),de=c=>ev.find(x=>x.identity.cut===c);
 for(const c of [109,110,115])assert.ok(!relus.includes(c),`cut ${c} : cut du lot, traversé, pas relu`);
 const debut=H.evenements(b,'relecture-debut')[0];
 assert.deepEqual(j(debut.sourcesLot),{poses:2,skip:1,manuels:1,interrompus:1,finDeLotRouge:1,bloques:1},'d’où vient chaque cut du lot');
 /* Aucune pose ni validation sur 109, 110, 115 ; 117 (bloqué pendant la passe) refusé par la garde ; 114 (vert prouvé) corrigé. */
 const poses=apresLot(b,lot).filter(c=>c.action==='apply').map(c=>c.args[0].identity.cut);
 assert.deepEqual(poses,[114]);assert.deepEqual(adapter.majEspace.map(x=>x.cut),[114]);
 assert.equal(de(114).action,'corrige');assert.equal(de(117).action,'visite');assert.match(de(117).raisonAction,/correction écartée : cible bloquée/);assert.equal(de(117).garde.ok,false);
});
