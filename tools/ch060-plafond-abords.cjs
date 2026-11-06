#!/usr/bin/env node
'use strict';
/* CH-060 — Ce que coûterait de lever le plafond des abords (D-180, `plafondParZone.abords` 70) et d'agrandir les grappes (`grappe.trouCuts`).
 * REJOUE la sélection réelle (src/relecture-ombre.js `selection`) sur chaque relecture d'un journal : cuts du lot (validations acceptées, différés
 * finalisés de ce lot), zones PN et ADV de `relecture-debut`. La liste « À contrôler » et les écartements de la liste d'ESV ne sont pas au journal :
 * absents du rejeu (ils ne comptent pas dans les abords). Contrôle : les abords rejoués au plafond 70 sont comparés à ceux de `relecture-debut`.
 * Temps : s par cut relu de la relecture mesurée (signal vivant ou éteint de CETTE page) et s par cut des pages saines/éteintes du même journal.
 * Sortie : agrégats seulement (parties, comptes, secondes).
 * Usage : node --max-old-space-size=6000 tools/ch060-plafond-abords.cjs --journal J.json [...] [--sortie f.json] */
const fs=require('fs'),R=require('../src/relecture-ombre.js');
function rejouer(j){const ev=j.events||[],out=[];
 for(const d of ev.filter(e=>e.type==='relecture-debut'&&e.lotId)){
  const ro=ev.filter(e=>e.type==='relecture-ombre'&&e.lotId===d.lotId&&e.durees);if(!ro.length)continue;const part=ro[0].identity.part;
  const poses=new Set(ev.filter(e=>e.type==='validation-accepted'&&e.batchId===d.lotId&&e.identity?.part===part).map(e=>e.identity.cut));
  const diff=new Set(ev.filter(e=>e.type==='defer-finalized'&&e.batchId===d.lotId&&e.identity?.part===part).map(e=>e.identity.cut).filter(c=>!poses.has(c)));
  const lot=[...[...poses].map(cut=>({cut,differe:false})),...[...diff].map(cut=>({cut,differe:true}))];
  const entree={partie:part,total:null,lot,zonesPN:d.zones?.pn||[],zonesADV:d.zones?.adv||[],aControler:[],ecartement:[]};
  const sel=(o)=>R.selection(entree,o);
  const base=sel({plafondParZone:{abords:70}}),libre=sel({plafondParZone:{abords:null}});   /* base : le plafond de la test (70, D-180), levé par D-289 */
  const trous={};for(const t of [5,10,20,40]){const s=sel({plafondParZone:{abords:null},grappe:{trouCuts:t}});trous[t]={relus:s.total,abords:s.parZone.abords};}
  /* temps par cut relu de cette relecture, et état du signal (lectures rapides au repli / toutes) */
  const lecturesRapides=ev.filter(e=>e.lastStage==='capture-read'&&e.lastDetail?.lecture==='rapide'&&Date.parse(e.timestamp)>=Date.parse(d.timestamp)&&Date.parse(e.timestamp)<=Date.parse(ro.at(-1).timestamp));
  const repli=lecturesRapides.filter(e=>e.lastDetail.regle!=='signal').length/Math.max(1,lecturesRapides.length);
  const mur=ro.reduce((s,e)=>s+e.durees.totalMs,0)/1000;
  out.push({part,abordsMesures:d.parZone?.abords??null,abordsRejoues:base.parZone.abords,horsPlafondMesure:(d.horsPlafond||[]).length,
   abordsSansPlafond:libre.parZone.abords,ajoutSansPlafond:libre.total-base.total,relusMesures:ro.length,sParCut:Math.round(mur/ro.length*100)/100,signalEteint:repli>.5,trous});}
 return out;}
if(require.main===module){const a=process.argv.slice(2),js=[];let sortie=null;for(let i=0;i<a.length;i++){if(a[i]==='--journal')js.push(a[++i]);else if(a[i]==='--sortie')sortie=a[++i];}
 const res=js.map(f=>rejouer(JSON.parse(fs.readFileSync(f,'utf8'))));const t=JSON.stringify(res,null,1);if(sortie)fs.writeFileSync(sortie,t);else console.log(t);}
module.exports={rejouer};
