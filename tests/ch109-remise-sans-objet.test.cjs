'use strict';
/* CH-109 (patch chantiers/CH-109/remise.patch, chemin d'écriture : intégré par l'intégrateur) — « POSE REFUSÉE PAR LA PAGE … REMISE IMPOSSIBLE » QUAND RIEN N'A BOUGÉ.
 * Terrain du 11/11, partie 17, cut 338 : en `tout-recentre`, la pose commence chaque rail par un clic de SÉLECTION (aucun rail déplacé) puis attend le
 * recentrage ; « Vue ESV non recentrée sur le rail left » est levée avant tout clic de pose ; la remise refait le même recentrage et échoue de même.
 * Avant : « remise impossible », intention gardée, la relecture s'arrête en erreur (et la file en « ecriture-incertaine »).
 * Après : la remise impossible relit l'état (lecture seule) ; rails à moins de 1 mm de la pose d'avant ET aucune écriture vue pour ce cut depuis la pose :
 * rien à remettre, intention effacée, `correction-refusee`, la passe continue. Sinon (rail droit en échec : le gauche est déjà posé), l'arrêt reste.
 * Service worker réel, ESV simulé (tests/helpers/relecture-lot.cjs), données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,PERMISSIF}=require('./helpers/relecture-essais.cjs');

/* La pose du cut 110 échoue au recentrage du rail `cote` ; `gaucheDeja` : le rail gauche a été posé avant l'échec. La remise échoue de même. */
const recentrage=(cote,gaucheDeja)=>(a,bb)=>{const K=bb.ctx.BananeCore3,apply=a.apply.bind(a),restore=a.restore.bind(a);
 a.apply=async(before,proposals,...r)=>{if(a.identity.cut!==110)return apply(before,proposals,...r);
  if(gaucheDeja){const e=K.expectedPoses(before,proposals);a.rails={...a.rails,left:K.clone(e.left)};}
  throw Error('Vue ESV non recentrée sur le rail '+cote+'.');};
 a.restore=async(before,...r)=>{if(a.identity.cut===110)throw Error('Vue ESV non recentrée sur le rail left.');return restore(before,...r);};};
const montage=esv=>H.lotRelecture({mode:'corriger',decisions:{109:14,110:16},reglagesProposes:PERMISSIF,relecture:{plafondCuts:4},esv});

test('échec au recentrage du rail gauche, rien n’a bougé : intention effacée, cut quitté sans action, la passe continue', async () => {
  const {b,adapter}=await montage(recentrage('left',false));
  const p=await H.finPasse(b);
  assert.equal(p.etat,'finie',p.message);
  const e110=H.evenements(b,'relecture-ombre').find(e=>e.identity.cut===110);
  assert.equal(e110.action,'correction-refusee');assert.match(e110.raisonAction,/Vue ESV non recentrée sur le rail left.*rien à remettre/);
  const etat=await b.api('relecture-etat');assert.equal(etat.correctionInterrompue,null,'aucune correction en suspens : la file continuerait');
  assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109],'aucune validation sur 110');
  assert.equal(H.evenements(b,'remise-sans-objet').length,1);
});

test('échec au recentrage du rail droit, le gauche déjà posé : l’arrêt reste (intention gardée, à contrôler dans ESV)', async () => {
  const {b,adapter}=await montage(recentrage('right',true));
  const p=await H.finPasse(b);
  assert.equal(p.etat,'erreur');assert.match(p.message,/cut 110 : pose d’Ariane non conforme .*remise impossible/);
  const etat=await b.api('relecture-etat');assert.equal(etat.correctionInterrompue?.cut,110,'correction en suspens : la file s’arrête « ecriture-incertaine »');
  assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109]);
  assert.equal(H.evenements(b,'remise-sans-objet').length,0);
});
