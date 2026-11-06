#!/usr/bin/env node
/* CH-065 : parité au bit de la recherche de pose élaguée, sur les nuages réels de banane-data (tools/ch065-nuages.cjs).
 * Deux arbres sont chargés côte à côte (require) : la référence (tronc) et l'arbre patché (chantiers/CH-065/geometrie-elaguee.patch appliqué).
 * Pour chaque nuage, quatre entrées, chacune comparée champ par champ avec Object.is (−0, NaN compris), exceptions comprises :
 *   1. src/geometry.js proposeBoth (moteur V4.6 gelé) ;
 *   2. src/geometry-candidate-v1.js proposeBoth (sans lab) ;
 *   3. src/gcv1-shadow.js scientificProposeBoth (composition du lot : V4.6 + A_STAR avec lab, convention, écartement), grille grossière A_STAR comprise ;
 *   4. Candidate.propose avec le lab de src/lot-decision.js (uSeeds, recenterWindow, partialFaceKeep) et sa grille grossière (onCoarse).
 * Usage : node tools/ch065-parite-geometrie.cjs --reference RACINE --patche RACINE [--max N] [--sortie F.json]
 * Sortie 0 si tout est identique, 1 sinon. */
'use strict';
const path=require('path'),fs=require('fs'),crypto=require('crypto');
const {parcourir,PREFIXES}=require('./ch065-nuages.cjs');
function arg(n,d){const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:d;}
const REF=path.resolve(arg('--reference',path.join(__dirname,'..'))),PAT=path.resolve(arg('--patche','')),MAX=Number(arg('--max',Infinity)),SORTIE=arg('--sortie',null);
if(!arg('--patche'))throw Error('--patche RACINE manquant');
function charger(r){
  const G=require(path.join(r,'src/geometry.js')),Cand=require(path.join(r,'src/geometry-candidate-v1.js')),S=require(path.join(r,'src/gcv1-shadow.js'));
  if(G===require(path.join(REF,'src/geometry.js'))&&r!==REF)throw Error('même module chargé deux fois');
  return {G,Cand,S};
}
/* Sérialisation canonique : chaque nombre écrit avec son signe de zéro, NaN et infinis nommés ; fonctions écartées (onCoarse). */
function canon(v){
  if(typeof v==='number')return Object.is(v,-0)?'-0':Number.isNaN(v)?'NaN':v===Infinity?'Inf':v===-Infinity?'-Inf':String(v);
  if(v===null||v===undefined)return String(v);
  if(typeof v==='function')return 'fn';
  if(typeof v!=='object')return JSON.stringify(v);
  if(ArrayBuffer.isView(v))return '['+Array.from(v,canon).join(',')+']';
  if(Array.isArray(v))return '['+v.map(canon).join(',')+']';
  return '{'+Object.keys(v).map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
}
const essayer=f=>{try{return {ok:f()};}catch(e){return {erreur:{nom:e?.name,message:e?.message}};}};
function entrees(M,c){
  const out={};
  out.v46=essayer(()=>M.G.proposeBoth(c));
  out.candidat=essayer(()=>M.Cand.proposeBoth(c));
  out.composition=essayer(()=>M.S.scientificProposeBoth(c));
  for(const side of ['left','right']){let grille=null;
    const r=essayer(()=>M.Cand.propose(c,side,{lab:{uSeeds:[.02],replaceOrigin:false,recenterWindow:true,partialFaceKeep:true,onCoarse(cells){grille=cells;}}}));
    out['decision-'+side]={r,grille};}
  return out;
}
const A=charger(REF),B=charger(PAT);
const res={date:new Date().toISOString(),collections:PREFIXES,reference:REF,patche:PAT,nuages:0,ecarts:0,premiersEcarts:[],statuts:{},exceptions:0,sha:{},ms:{reference:0,patche:0}};
const hA=crypto.createHash('sha256'),hB=crypto.createHash('sha256');
parcourir((c,o)=>{
  let t=performance.now();const a=canon(entrees(A,c));res.ms.reference+=performance.now()-t;
  t=performance.now();const b=canon(entrees(B,c));res.ms.patche+=performance.now()-t;
  hA.update(a);hB.update(b);res.nuages++;
  if(a!==b){res.ecarts++;if(res.premiersEcarts.length<5)res.premiersEcarts.push({collection:o.collection,fichier:o.fichier,rang:o.rang});}
  const s=A.G.proposeBoth(c);for(const k of ['left','right']){const st=s[k].status+' / '+(s[k].reasons||[])[0];res.statuts[st]=(res.statuts[st]||0)+1;}
  if(a.includes('"erreur"'))res.exceptions++;
  if(res.nuages%250===0)console.error(res.nuages,'nuages, écarts',res.ecarts,'ms réf',Math.round(res.ms.reference),'patché',Math.round(res.ms.patche));
},MAX);
res.sha.reference=hA.digest('hex');res.sha.patche=hB.digest('hex');res.ms.reference=Math.round(res.ms.reference);res.ms.patche=Math.round(res.ms.patche);
console.log(JSON.stringify(res,null,1));
if(SORTIE)fs.writeFileSync(SORTIE,JSON.stringify(res,null,1)+'\n');
process.exit(res.ecarts||res.sha.reference!==res.sha.patche?1:0);
