'use strict';
/* Contre-revue de 9c03da5 : le statut du cut est relu juste avant la pose. Si l'opérateur valide ou SKIP le cut pendant la capture,
 * les rails n'ont pas bougé mais le cut n'est plus un vert d'ESV : la passe ne pose ni ne valide rien. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,PERMISSIF}=require('./helpers/relecture-essais.cjs');
for(const [nom,ligne] of [['L\'opérateur le valide sur place (valid + opérateur)',{s:'valid',t:true,v:true}],['L\'opérateur le SKIP (skipped)',{s:'skipped',t:true,v:true}]])
test(`statut relu avant la pose : ${nom} pendant la capture, rien n'est posé ni validé`,async()=>{
 const {b,adapter}=await H.lotRelecture({mode:'corriger',decisions:{108:13,109:14},reglagesProposes:PERMISSIF,relecture:{departMs:0},
  esv:a=>{const cap=a.capture.bind(a);a.capture=async e=>{const d=await cap(e);if(a.apresLot&&a.identity.cut===109)a.lignes[109]=ligne;return d;};}});
 await H.finPasse(b);
 assert.ok(!adapter.majEspace.some(x=>x.cut===109),`aucune validation sur le cut 109, vu : ${JSON.stringify(adapter.majEspace.map(x=>x.cut))}`);
 const e=H.evenements(b,'relecture-ombre').find(x=>x.identity.cut===109);
 assert.notEqual(e?.action,'corrige');
});
