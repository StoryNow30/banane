'use strict';
/* Contre-revue de 9c03da5 : un vert hors zone (liste « À contrôler ») reste en ombre même si un fichier de réglages ouvre cette zone (D-180). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,j,PERMISSIF}=require('./helpers/relecture-essais.cjs');
for(const ouvert of [false,true])
test(`vert hors zone (liste « À contrôler », cut 150), interrupteur vert-hors-zone=${ouvert} : jamais corrigé`,async()=>{
 const f=j(PERMISSIF);f.zones['vert-hors-zone'].corriger=ouvert;
 const {b,adapter}=await H.lotRelecture({mode:'corriger',decisions:{150:14},reglagesProposes:f,relecture:{departMs:0},
  esv:(a,bb)=>{const prev=bb.ctx.vertsAControler;bb.ctx.vertsAControler=async x=>({...(await prev(x)),actif:true,verts:[{i:150}]});}});
 await H.finPasse(b);
 assert.ok(!adapter.majEspace.some(x=>x.cut===150),`aucune validation sur le cut 150, vu : ${JSON.stringify(adapter.majEspace.map(x=>x.cut))}`);
});
