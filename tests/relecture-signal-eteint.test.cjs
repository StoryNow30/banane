'use strict';
/* CH-060 — SIGNAL D'ESV ÉTEINT PENDANT LA RELECTURE (src/relecture-signal.js ; background.js `relecturePasse`, `relectureSignalRecharger`).
 * Module pur : classement d'une capture (signal, repli, neutre), série de lectures au repli, seuil, action selon le réglage.
 * Service worker réel (montage tests/helpers/relecture-pause.cjs : grappe 108–116, 7 cuts relus, 111 et 112 traversés) : l'ESV simulé marque ses
 * captures « rapide, repli » tant que sa page n'est pas rechargée, « rapide, signal » après. Réglage coupé : un seul événement, rien d'autre ;
 * allumé : pause au point de reprise, un rechargement de l'onglet, ré-équipement, reprise au cut suivant, aucun cut revu, aucun cut sauté. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../src/relecture-signal.js');
const {H,lotPause}=require('./helpers/relecture-pause.cjs');
const {esvSignal,REGLAGE,avec}=require('./helpers/relecture-signal.cjs');

const cap=(lecture,regles,{attempt=1}={})=>({readStrategy:{lecture,attempts:regles.map((regle,i)=>({side:i?'right':'left',attempt,status:'captured',regle}))}});

test('module : une capture se classe signal, repli ou neutre',()=>{
 assert.equal(S.lectureDe(cap('rapide',['stabilite','stabilite'])),'repli');
 assert.equal(S.lectureDe(cap('rapide',['signal','stabilite'])),'signal','une vue au signal : le signal vit');
 assert.equal(S.lectureDe(cap('reference',['stabilite','stabilite'])),'neutre','une référence n’attend jamais le signal');
 assert.equal(S.lectureDe(cap('rapide',['stabilite','stabilite'],{attempt:2})),'neutre','une deuxième tentative attend toujours au repli');
 assert.equal(S.lectureDe({}),'neutre');assert.equal(S.lectureDe(null),'neutre');
 assert.equal(S.lectureDe({readStrategy:{lecture:'rapide',attempts:[{status:'discarded',attempt:1,regle:'stabilite'}]}}),'neutre');
});
test('module : seuil de lectures au repli de suite ; la référence ne remet rien à zéro ; le signal si',()=>{
 const e=S.creer({actif:true,lectures:3});const R=cap('rapide',['stabilite','stabilite']);
 assert.equal(S.observer(e,R).action,'rien');assert.equal(S.observer(e,cap('reference',['stabilite','stabilite'])).serie,1);
 assert.equal(S.observer(e,R).action,'rien');
 const o=S.observer(e,R);assert.equal(o.action,'recharger');assert.equal(o.serie,3);
 assert.equal(S.observer(e,R).action,'rien','une seule action par série');
 S.recharge(e);assert.equal(e.serie,0);assert.equal(e.rechargements,1);
 S.observer(e,R);S.observer(e,cap('rapide',['signal','signal']));assert.equal(e.serie,0,'le signal remet la série à zéro');
});
test('module : coupé par défaut ; « signaler » quand coupé, sans pause permise ou au plafond',()=>{
 assert.equal(S.DEFAULTS.actif,false);assert.equal(S.DEFAULTS.lectures,8);
 const R=cap('rapide',['stabilite','stabilite']);
 const coupe=S.creer({lectures:1});const a=S.observer(coupe,R);assert.equal(a.action,'signaler');assert.match(a.raison,/coupé/);
 const sansPause=S.creer({actif:true,lectures:1});assert.equal(S.observer(sansPause,R,{peutRecharger:false}).action,'signaler');
 const plafond=S.creer({actif:true,lectures:1,rechargementsMax:1});assert.equal(S.observer(plafond,R).action,'recharger');S.recharge(plafond);
 const b=S.observer(plafond,R);assert.equal(b.action,'signaler');assert.match(b.raison,/1 rechargement déjà fait/);
 assert.equal(S.reglage({lectures:0}).lectures,8,'réglage invalide : défaut');
});

test('SW, réglage coupé : un seul événement « detecte / aucune », aucune pause, aucun rechargement ; la passe relit ses 7 cuts',async()=>{
 const {b,adapter}=await lotPause({esv:avec(esvSignal(),(a,b)=>REGLAGE({actif:false})(b))});
 const fin=await H.finPasse(b);
 assert.equal(fin.etat,'finie');assert.equal(fin.faits,7);assert.equal(adapter.rechargements,0);
 const ev=H.evenements(b,'relecture-signal-eteint');assert.equal(ev.length,1,'un seul événement');
 assert.equal(ev[0].etape,'detecte');assert.equal(ev[0].action,'aucune');assert.equal(ev[0].serie,3);assert.match(ev[0].raison,/coupé/);
 assert.equal(H.evenements(b,'relecture-pause').length,0);
});
test('SW, réglage allumé mais pause de la relecture éteinte : aucune pause, aucun rechargement, événement « aucune »',async()=>{
 const {b,adapter}=await lotPause({actif:false,esv:avec(esvSignal(),(a,b)=>REGLAGE({actif:true})(b))});
 const fin=await H.finPasse(b);assert.equal(fin.etat,'finie');assert.equal(fin.faits,7);assert.equal(adapter.rechargements,0);
 const ev=H.evenements(b,'relecture-signal-eteint');assert.equal(ev.length,1);assert.equal(ev[0].action,'aucune');assert.match(ev[0].raison,/pause et reprise/);
});
