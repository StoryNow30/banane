'use strict';
/* RM-11 (test 9, essai 7) — jamais bloquant, sous charge : 10 000 frappes de raison se traitent sans rien accumuler (état, historique et événements gardés bornés). La marge de temps est dans echo-raison-marge.test.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');

const {jouer,ON,chiffre,seance,visite,valider}=require('./helpers/echo-raison-outils.cjs'),R=require('../src/raison-correction.js'),K=require('../src/core.js');
test('jamais bloquant : 10 000 frappes de raison se traitent sans rien accumuler (état, historique, événements gardés bornés) et sans erreur',async t=>{
 const ms=[];
 await seance(async f=>{
  const a=await f.open('v1',100);f.engine.save=async()=>{};   // l'écriture de l'état est ailleurs (IndexedDB, mesurée plus bas) : ici on mesure le traitement
  for(let i=0;i<10000;i++){f.avancer(37);const t0=process.hrtime.bigint();const r=await f.touche('v1',a,i%2?chiffre(1+(i%6)):chiffre(0));ms.push(Number(process.hrtime.bigint()-t0)/1e6);if(r?.saved!==true)assert.fail('frappe '+i+' non enregistrée');}
  const n=f.engine.s.native,v=visite(f,'v1');
  assert.equal(n.raison.poses,5000,'les 5 000 raisons posées sont comptées');assert.equal(n.raison.series.length,0);assert.equal(n.raison.collante,null,'jamais deux appuis de suite sur la même touche : pas de collante');
  assert.ok(JSON.stringify(n.raison).length<400,'l\'état de la séance ne grossit pas : '+JSON.stringify(n.raison).length);
  assert.ok(v.operatorEvents.length<=128,'événements gardés bornés comme avant');assert.ok(v.raisonCorrection.historique.length<=6,'historique de 6 changements au plus');
  assert.equal(v.raisonCorrection.code,R.CODES[(1+(9999%6))-1],'la dernière touche est la 10 000e');
 },ON,{leger:true});
 ms.sort((x,y)=>x-y);t.diagnostic(`10 000 frappes : médiane ${ms[ms.length>>1].toFixed(3)} ms, p99 ${ms[Math.floor(ms.length*.99)].toFixed(3)} ms, plus lente ${ms.at(-1).toFixed(1)} ms`);
 assert.ok(ms[Math.floor(ms.length*.99)]<50,'le 99e centile d\'une frappe reste très en dessous d\'un cut (plusieurs secondes)');
});
