#!/usr/bin/env node
'use strict';
/* CH-057 — rassemble les sorties des outils (dossier de travail HORS DÉPÔT) en un fichier d'AGRÉGATS versable : comptes, parts, millimètres,
 * numéros de partie et de cut. AUCUNE coordonnée : l'écartement de l'opérateur est une distance (mm), calculée ici, et les poses ne sont pas
 * recopiées. Un champ inattendu n'est jamais recopié tel quel : chaque valeur est choisie à la main ci-dessous.
 *   node chantiers/CH-057/agregats.cjs --travail DOSSIER --sortie chantiers/CH-057/agregats.json
 * DOSSIER contient : taux/{strict,assouplie,causes}-P.json, res/{rappel,gcv2-valider-lot,gcv2-valider-rel,gcv2-fige-lot,gcv2-fige-rel,
 * synthese-voie,synthese-garde,garde-reelle,hauteur-etudier}.json, jointure/tableP.json (P = « 11-10 »…). */
const fs=require('node:fs'),path=require('node:path');
const PARTIES=['11-10','11-13','11-14','11-15','12-8','12-9','12-10','12-11','12-12'];
const r1=v=>v==null?null:Math.round(v*10)/10;
function lire(d,f){const p=path.join(d,f);return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null;}
/* Écartement des poses finales de l'opérateur (validations) : distance 3D entre les deux points de rail, en mm. Approximation (dévers, biais du
 * point de pose) : PROBABLE, pas une mesure de gabarit. */
function ecartements(table){
  const v=[];for(const r of table.table||[]){const h=r.poseHumaineFinale;if(!h||!h.gauche||!h.droite||!/^VALIDATE/.test(r.etiquetteEcho||''))continue;
    v.push(Math.hypot(h.gauche.x-h.droite.x,h.gauche.y-h.droite.y,h.gauche.z-h.droite.z)*1000);}
  v.sort((a,b)=>a-b);const q=p=>v.length?r1(v[Math.floor(p*(v.length-1))]):null;
  return {n:v.length,medianeMm:q(.5),p10Mm:q(.1),p90Mm:q(.9),dans1430a1447:v.filter(x=>x>=1430&&x<=1447).length,hors1420a1470:v.filter(x=>x<1420||x>1470).length};
}
const bilan=b=>b&&{visites:b.visites,micSup10:b.micSup10,agit:b.agit,justes:b.justes,justes5:b.justes5,abimes:b.abimes,mauvaiseVoie:b.mauvaiseVoie,erreurs:b.erreurs};
function agreger(d){
  const out={format:'ch057-agregats-v1',date:'2026-11-05',parties:PARTIES.map(p=>p.replace('-',':')),note:'Agrégats seulement : comptes, parts, mm, numéros de partie et de cut. Aucune coordonnée.'};
  out.apprenables={};
  for(const p of PARTIES){const s=lire(d,`taux/strict-${p}.json`),a=lire(d,`taux/assouplie-${p}.json`),c=lire(d,`taux/causes-${p}.json`);
    out.apprenables[p.replace('-',':')]={valides:s?.cutsValides??null,strict:s?.cutsApprenables??null,assouplie:a?.assouplie?.cutsApprenablesAssouplie??null,
      pertesCascade:s?.pertesCascade??null,causesEtatInitial:c?.parCause??null,captureTardiveQualifiee:c?.avecCaptureTardiveQualifiee??null};}
  const t=Object.values(out.apprenables).reduce((o,x)=>({valides:o.valides+(x.valides||0),strict:o.strict+(x.strict||0),assouplie:o.assouplie+(x.assouplie||0)}),{valides:0,strict:0,assouplie:0});
  out.apprenablesTotal=t;
  const R=lire(d,'res/rappel.json');
  if(R)out.rappel={jugeables:R.jugeables,grosses:R.comptes?.grosses,paireA10:R.global?.['plus-de-10-mm']?.paire?.a10&&{k:R.global['plus-de-10-mm'].paire.a10.k,n:R.global['plus-de-10-mm'].paire.a10.n}};
  out.gcv2={};
  for(const [k,f] of [['cvLot','res/gcv2-valider-lot.json'],['cvRelecture','res/gcv2-valider-rel.json']]){const v=lire(d,f);if(v)out.gcv2[k]={total:bilan(v.total.gcv2.total),prudente:bilan(v.total.prudente.total),h0:bilan(v.total.h0.total),
    parPartie:Object.fromEntries(Object.entries(v.parPartie).map(([p,x])=>[p,{gcv2:bilan(x.gcv2.total),seuilsActifs:Object.entries(x.seuils).filter(([,s])=>s.actif).map(([z])=>z)}]))};}
  for(const [k,f] of [['figeLot','res/gcv2-fige-lot.json'],['figeRelecture','res/gcv2-fige-rel.json']]){const v=lire(d,f);if(v)out.gcv2[k]={parametres:v.parametres,total:bilan(v.total.total),
    parPartie:Object.fromEntries(Object.entries(v.parPartie).map(([p,x])=>[p,bilan(x.gcv2?.total)]))};}
  const V=lire(d,'res/synthese-voie.json');
  if(V){out.voie={variantes:V.variantes,perimetres:{},lot:{}};
    for(const [perim,P] of Object.entries(V.perimetres))out.voie.perimetres[perim]={total:Object.fromEntries(Object.entries(P.total).map(([v,x])=>[v,{n:x.n,poses:x.poses,justes:x.justes,faux:x.faux,plus50:x.plus50,justesIC:x.justesIC,fautes:x.fautes}])),
      atteignableApres:P.atteignableApres,validationCroisee:{total:P.validationCroisee.total,choix:Object.fromEntries(Object.entries(P.validationCroisee.parPartie).map(([p,x])=>[p,{choisie:x.choisie,n:x.n,justes:x.justes,faux:x.faux,plus50:x.plus50}]))}};
    for(const [v,x] of Object.entries(V.lot))out.voie.lot[v]={poses:x.poses,posesJuges:x.posesJuges,justes:x.justes,plus10:x.plus10,plus50:x.plus50,plus50IC:x.plus50IC,fautes50:x.fautes50,differes:x.differes};}
  const G=lire(d,'res/synthese-garde.json');
  if(G)out.garde=Object.fromEntries(Object.entries(G).map(([v,x])=>[v,{retenus:x.retenus,retenusJuges:x.retenusJuges,retenusJustes:x.retenusJustes,retenusFaux:x.retenusFaux,retenus50:x.retenus50,retenusCuts:x.retenusCuts,differes:x.differes,posesJuges:x.posesJuges,poses50:x.poses50,borne50:x.borne50}]));
  const GR=lire(d,'res/garde-reelle.json');
  if(GR)out.gardeReelle=GR.synthese;
  const H=lire(d,'res/hauteur-etudier.json');
  if(H)out.hauteur={parties:H.parties,rails:H.rails&&(H.rails.total??H.rails),classement:H.classement,retenu:H.retenu};
  out.ecartementOperateur={};for(const p of PARTIES){const t=lire(d,`jointure/table${p}.json`);if(t)out.ecartementOperateur[p.replace('-',':')]=ecartements(t);}
  return out;
}
module.exports={agreger,ecartements};
if(require.main===module){const a=process.argv.slice(2),o={};for(let i=0;i<a.length;i++){if(a[i]==='--travail')o.d=a[++i];else if(a[i]==='--sortie')o.s=a[++i];}
  const r=agreger(o.d),txt=JSON.stringify(r,null,1)+'\n';
  /* Garde-fou : aucune coordonnée (nombre à 5 chiffres ou plus avant la virgule, hors comptes entiers) ne doit sortir. */
  if(/-?\d{5,}\.\d+/.test(txt))throw Error('agrégats : une valeur ressemble à une coordonnée, rien n’est écrit');
  fs.writeFileSync(o.s,txt);console.error(`écrit ${o.s} (${txt.length} octets)`);}
