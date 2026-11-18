#!/usr/bin/env node
'use strict';
/* CH-068 : essais des deux correctifs de J3 (lot.rs), écrits rouges sur 2b1cbf7^ et verts après.
 *   node tools/ch068-essai-correctifs-j3.cjs        (fixtures : node tools/ch064-d-fixtures.cjs ; cœur : tools/ch064-construire.cjs)
 * Sur chaque appel decideCut relevé dans les essais du tronc :
 *   (1) un rail `ok` de la science sans `next` : le JS lève (TypeError), le cœur doit rendre hors domaine (la façade rejoue le JS) ;
 *   (2) `options.anchors` présent et `undefined` : `slice(0, undefined)` garde tous les voisins ; le cœur doit rendre la même décision.
 * Sortie : nombre de cas par essai, écarts ; code de sortie 1 au premier écart. */
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8');
const RACINE=path.resolve(__dirname,'..');
const Coeur=require('../ariane-rs/coquille/coeur.js'),F=require('../ariane-rs/coquille/facade-decision.js'),{comparer}=require('./ch064-comparer.cjs');
const {construire}=require('./ch064-construire.cjs');
const L=require('../src/lot-decision.js'),S=require('../src/gcv1-shadow.js'),P=require('../src/placement-convention.js');
const w=construire({silencieux:true});if(!w){console.error('cargo absent');process.exit(2);}
const coeur=Coeur.creer(fs.readFileSync(w)),fac=F.creer(coeur,{lotDecision:L,shadow:S,convention:P});
const FX=path.join(RACINE,'ariane-rs','dist','ch064-d-fixtures.v8');
if(!fs.existsSync(FX)){console.error('fixtures absentes : node tools/ch064-d-fixtures.cjs');process.exit(2);}
const cas=v8.deserialize(fs.readFileSync(FX)).filter(e=>e.module==='lotDecision'&&e.f==='decideCut').slice(0,40);
const SH='\u0000shadow',remettre=a=>{for(const x of a)if(x&&x.Shadow===SH)x.Shadow=S;return a;};
const jouer=(M,a)=>{try{return {ok:true,v:M.decideCut(...a)};}catch(e){return {ok:false,v:e};}};
const n={sansNext:0,anchorsIndefini:0},ecarts=[];
for(const e of cas){
 const base=remettre(v8.deserialize(e.args));
 const sci=base[0]?.science;
 for(const side of ['left','right'])if(sci?.rails?.[side]?.ok){
  const mk=()=>{const a=remettre(v8.deserialize(e.args));delete a[0].science.rails[side].next;return a;};
  const j=jouer(L,mk()),r=jouer(fac.lotDecision,mk());n.sansNext++;
  if(j.ok!==r.ok||(j.ok&&comparer(j.v,r.v).length)||(!j.ok&&(j.v.constructor!==r.v.constructor||j.v.message!==r.v.message)))ecarts.push({essai:e.essai,cas:'sans-next-'+side});}
 {const mk=()=>{const a=remettre(v8.deserialize(e.args));a[0].options={...(a[0].options||{}),anchors:undefined};return a;};
  const j=jouer(L,mk()),r=jouer(fac.lotDecision,mk());n.anchorsIndefini++;
  if(j.ok!==r.ok||(j.ok&&comparer(j.v,r.v).length))ecarts.push({essai:e.essai,cas:'anchors-undefined'});}
}
const c=fac.compteurs().lotDecision;
console.log(JSON.stringify({cas:n,ecarts:ecarts.slice(0,10),nEcarts:ecarts.length,facade:c},null,1));
if(!n.sansNext||!n.anchorsIndefini||ecarts.length)process.exit(1);
