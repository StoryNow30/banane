'use strict';
/* CH-136 (relecture adverse de la Vision 19.1) : quand le DÉPART de l'écriture est vu, l'attente s'allonge jusqu'à `attenteEcritureEnRouteMs` ; le message
 * d'arrêt doit dire ce délai long et que l'écriture était partie, pas le délai court (avant : « aucune écriture de validation vue en 6 s » après 30 s d'attente).
 * Montage de tests/v191-ecriture-en-route-delai-sw.test.cjs. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,PERMISSIF}=require('./helpers/relecture-essais.cjs');
const RYTHME={attenteEcritureMs:1000,attenteEcritureEnRouteMs:3000};
async function monter(depart,finMs){
 const m=await H.lotRelecture({mode:'corriger',decisions:{109:14},reglagesProposes:PERMISSIF,relecture:RYTHME});
 const {b,adapter}=m;let seq=5000;
 adapter.surValidation=async cut=>{const t=Date.now();
  if(depart)b.raw({kind:'esv-observation',observer:'obs-relecture',entries:[{kind:'write-start',seq:++seq,method:'PUT',attempt:1,rowIndex:cut,railPairId:'ligne-'+cut,bodyKeys:12,body:{ExtractionStatus:'valid',TreatedByOperator:true},startedEpochMs:t}]});
  setTimeout(()=>b.raw({kind:'esv-observation',observer:'obs-relecture',entries:[{kind:'write',seq:++seq,method:'PUT',status:204,outcome:'ok',attempt:1,rowIndex:cut,railPairId:'ligne-'+cut,bodyKeys:12,
   body:{ExtractionStatus:'valid',TreatedByOperator:true},startedEpochMs:t,endedEpochMs:t+finMs,durationMs:finMs}]}),finMs);};
 return m;}
test('départ vu, aucune réponse dans le délai long : le message dit le délai long (3 s) et que l’écriture était partie',async()=>{
 const {b}=await monter(true,4500);
 const p=await H.finPasse(b);
 assert.equal(p.etat,'erreur');
 assert.match(p.message,/cut 109 : Maj\+Espace envoyé, écriture de validation partie mais sans réponse en 3 s/);
});
