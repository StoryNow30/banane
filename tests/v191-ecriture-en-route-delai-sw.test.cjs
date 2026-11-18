'use strict';
/* Un essai par fichier : chacun monte un lot complet (plus de 20 s à trois sous le verify). */
/* Vision 19.1, terrain du 17/11 (partie 3, cut 2475) : la relecture a envoyé Maj+Espace, ESV a dit le cut « valid », mais l'écriture n'était vue qu'à la RÉPONSE
 * du serveur (src/esv-observer.js, `loadend`) ; un serveur lent (plus de 6 s) arrêtait la relecture sur une « correction incertaine ». Désormais la page note le
 * DÉPART d'une écriture de validation (`write-start`) ; tant qu'elle est en route, la relecture attend jusqu'à `attenteEcritureEnRouteMs` (30 s livrés).
 * Rien n'est relâché : sans écriture vue à la fin de ce délai, l'arrêt et l'intention sont les mêmes. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,PERMISSIF}=require('./helpers/relecture-essais.cjs');
const RYTHME={attenteEcritureMs:300,attenteEcritureEnRouteMs:2000};
async function monter(depart,finMs){
 const m=await H.lotRelecture({mode:'corriger',decisions:{109:14},reglagesProposes:PERMISSIF,relecture:RYTHME});
 const {b,adapter}=m;let seq=5000;
 adapter.surValidation=async cut=>{const t=Date.now();
  if(depart)b.raw({kind:'esv-observation',observer:'obs-relecture',entries:[{kind:'write-start',seq:++seq,method:'PUT',attempt:1,rowIndex:cut,railPairId:'ligne-'+cut,bodyKeys:12,body:{ExtractionStatus:'valid',TreatedByOperator:true},startedEpochMs:t}]});
  setTimeout(()=>b.raw({kind:'esv-observation',observer:'obs-relecture',entries:[{kind:'write',seq:++seq,method:'PUT',status:204,outcome:'ok',attempt:1,rowIndex:cut,railPairId:'ligne-'+cut,bodyKeys:12,
   body:{ExtractionStatus:'valid',TreatedByOperator:true},startedEpochMs:t,endedEpochMs:t+finMs,durationMs:finMs}]}),finMs);};
 return m;}
test('départ vu mais aucune réponse dans le délai long : arrêt, rien n’est relâché',async()=>{
 const {b}=await monter(true,2600);
 const p=await H.finPasse(b);
 assert.equal(p.etat,'erreur');assert.match(p.message,/cut 109 : Maj\+Espace envoyé, écriture de validation partie mais sans réponse en 2 s/);   /* CH-136 : le texte dit le délai long */
});
