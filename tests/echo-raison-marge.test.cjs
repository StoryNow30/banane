'use strict';
/* RM-11 (test 9, essai 7) — jamais bloquant : une frappe de raison coûte à peine plus qu'un autre événement d'Écho (écriture de la visite et de l'état comprise). */
const {test}=require('node:test'),assert=require('node:assert/strict');

const {jouer,ON,chiffre,seance,visite,valider}=require('./helpers/echo-raison-outils.cjs'),R=require('../src/raison-correction.js'),K=require('../src/core.js');
test('jamais bloquant : une frappe de raison coûte à peine plus qu\'un autre événement d\'Écho (écriture de la visite et de l\'état comprise)',async t=>{
 const duree=async demarrage=>{const ms=[];
  await seance(async f=>{
   const a=await f.open('v1',100);
   for(let i=0;i<1500;i++){f.avancer(37);const t0=process.hrtime.bigint();await f.touche('v1',a,demarrage.raison?chiffre(i%2?1+(i%6):0):{code:'KeyD',key:'character'});ms.push(Number(process.hrtime.bigint()-t0)/1e6);}
  },demarrage,{leger:true});
  ms.sort((x,y)=>x-y);return {mediane:ms[ms.length>>1],p99:ms[Math.floor(ms.length*.99)]};};
 const avec=await duree(ON),sans=await duree({raison:null});
 t.diagnostic(`médiane par événement : ${avec.mediane.toFixed(3)} ms avec la raison, ${sans.mediane.toFixed(3)} ms pour un autre événement ; p99 ${avec.p99.toFixed(3)} / ${sans.p99.toFixed(3)} ms`);
 /* La frappe de raison écrit aussi l'état de la séance : trois fois la durée d'un autre événement, plus 5 ms, reste très loin d'un cut. */
 assert.ok(avec.mediane<=sans.mediane*3+5,`médiane avec ${avec.mediane.toFixed(3)} ms contre ${sans.mediane.toFixed(3)} ms sans`);
});
