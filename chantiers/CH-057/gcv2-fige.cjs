#!/usr/bin/env node
'use strict';
/* CH-057 — juge des paramètres GCV2 FIGÉS (ceux du tronc, ou un candidat) sur des jeux `gcv2-jeu`, partie par partie. Hors ligne, lecture seule.
 * Le modèle exporté (`gcv2-apprendre exporter` : normalisation, vocabulaires, coefficients, Platt, seuils par zone) est remis dans la forme d'un
 * pli de `tools/gcv2-apprendre.cjs`, puis chaque cas est décidé exactement comme dans la validation croisée (`jugerPli`, `decider`,
 * `resultatDeDecision`, `synthese`). Le modèle figé n'a vu aucune des parties jugées quand elles sont plus récentes que lui : c'est un jugement hors
 * échantillon, à comparer aux plis de la validation croisée (`gcv2-apprendre valider`).
 *   node chantiers/CH-057/gcv2-fige.cjs --parametres datasets/gcv2-parametres-h6.json --usage lot --jeu J.jsonl [--jeu …] [--garde-voie] [--json S.json]
 * Sorties : comptes et millimètres par partie et au total ; aucune coordonnée. */
const fs=require('node:fs');
const G=require('../../tools/gcv2-apprendre.cjs');

/* Reconstruit `fit` (codage des traits) depuis l'export et vérifie que les colonnes retrouvées sont celles de l'export, dans le même ordre. */
function pliDepuisExport(P,usage){
  const U=P.usages&&P.usages[usage];if(!U)throw Error(`usage « ${usage} » absent des paramètres`);
  const norm=new Map(U.normalisation.map(n=>[n.nom,n]));
  const num=G.NUM.map(t=>{const n=norm.get(t.nom);return n?{moy:n.moyenne,sd:n.ecartType,constant:false,manque:!!n.manque}:{moy:0,sd:1,constant:true,manque:false};});
  const cat=G.CAT.map(t=>U.categories[t.nom]||[]),multi=G.MULTI.map(t=>U.categories[t.nom]||[]);
  const noms=[];
  num.forEach((f,c)=>{if(f.constant)return;noms.push(G.NUM[c].nom);if(f.manque)noms.push(G.NUM[c].nom+':manque');});
  cat.forEach((v,c)=>{if(v.length>1)for(const x of v)noms.push(`${G.CAT[c].nom}=${x}`);});
  multi.forEach((v,c)=>{for(const x of v)noms.push(`${G.MULTI[c].nom}∋${x}`);});
  if(JSON.stringify(noms)!==JSON.stringify(U.colonnes))throw Error(`colonnes reconstruites ≠ colonnes de l'export (${noms.length} contre ${U.colonnes.length})`);
  const fit={num,cat,multi,noms,p:noms.length,accord:P.accord!==false};
  const seuils=Object.fromEntries(G.ZONES.map(z=>[z,{...(U.seuils[z]||{actif:false,tau:null,delta:null})}]));
  return {modele:{fit,m10:{intercept:U.modele10.intercept,coef:Float64Array.from(U.modele10.coefficients)},m5:{intercept:U.modele5.intercept,coef:Float64Array.from(U.modele5.coefficients)},n:U.nExemples},
    cal10:U.calibrage10,cal5:U.calibrage5,seuils};
}
function juger(P,jeux,{usage='lot',gardeVoie=false}={}){
  const pli=pliDepuisExport(P,usage),parPartie={},tous=[];
  for(const j of jeux){
    const test=G.construireCas(j,usage,{gardeVoie});if(!test.length){parPartie[j.partie]={nCas:0};continue;}
    const Jp=G.jugerPli(pli,test),rs=test.map((k,i)=>G.resultatDeDecision(k,G.decider(k,Jp.p10[i],pli.seuils)));
    tous.push(...rs);parPartie[j.partie]={nCas:test.length,gcv2:G.synthese(rs)};
  }
  return {usage,parametres:{date:P.date,parties:(P.parties||[]).map(x=>x.partie)},total:G.synthese(tous),parPartie};
}
module.exports={pliDepuisExport,juger};
if(require.main===module){
  const a=process.argv.slice(2),o={jeux:[],usage:'lot'};
  for(let i=0;i<a.length;i++){const k=a[i],v=()=>a[++i];if(k==='--parametres')o.p=v();else if(k==='--jeu')o.jeux.push(v());else if(k==='--usage')o.usage=v();else if(k==='--json')o.json=v();else if(k==='--garde-voie')o.gardeVoie=true;else throw Error('option inconnue '+k);}
  const P=JSON.parse(fs.readFileSync(o.p,'utf8')),r=juger(P,o.jeux.map(f=>G.lireJeuFichier(f)),o);
  const t=r.total.total;
  console.log(`paramètres du ${r.parametres.date} (${r.parametres.parties.length} parties), usage ${r.usage} : agit ${t.agit}, justes ${t.justes}, abîmés ${t.abimes}, erreurs ${t.erreurs}, mauvaise voie ${t.mauvaiseVoie}`);
  for(const [p,x] of Object.entries(r.parPartie))if(x.gcv2){const b=x.gcv2.total;console.log(`  ${p} : ${x.nCas} cuts, agit ${b.agit}, justes ${b.justes}, abîmés ${b.abimes}, erreurs ${b.erreurs}, mauvaise voie ${b.mauvaiseVoie}`);}
  if(o.json)fs.writeFileSync(o.json,JSON.stringify(r,null,1)+'\n');
}
