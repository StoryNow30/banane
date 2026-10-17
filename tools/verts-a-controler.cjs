#!/usr/bin/env node
'use strict';
/*
 * verts-a-controler.cjs — étude et rejeu de la LISTE DES VERTS À CONTRÔLER (5.0, fiches/VERTS_A_CONTROLER.md), avec le module de
 * l'extension (src/verts-a-controler.js). Rien n'est envoyé à ESV : c'est une mesure.
 *
 * Trois étapes.
 *   EXTRAIRE : pour une partie, une table HORS DÉPÔT : chaque cut vu à l'Écho (pose de départ de la première visite, durée des
 *     visites), l'étiquette du jeu (correction de l'opérateur, règle « visité sans action = bon » comprise), les cuts du lot (journal Orbite :
 *     posé ou différé) et les PN reconnus par les règles métier (sortie de tools/regles-metier.cjs). La table porte les bords des
 *     rails : elle reste hors dépôt, comme les jeux.
 *   ÉTUDIER : signaux (AUC par partie), classement appris en validation croisée par partie (lots seulement : apprendre sur trois
 *     lots, juger le quatrième ; une partie ne sert jamais des deux côtés), courbe « erreurs de plus de 10 mm attrapées » en
 *     fonction de la part des verts relus, point de fonctionnement (seuil appris : meilleur compromis moyen entre erreurs
 *     attrapées et verts à relire, PRIX_VERT), et temps de relecture de l'opérateur (durées de l'Écho). Deux validations
 *     croisées : réglage complet (poids, zone morte, seuil) appris sans la partie jugée ; seuil seul, poids livrés.
 *   REJEU : la liste qu'Ariane aurait donnée avec les réglages livrés : plages, cuts, erreurs attrapées, minutes.
 *
 * Univers : les verts que l'opérateur a relus (étiquetés). Les verts de la fenêtre que l'opérateur n'a pas relus n'ont ni étiquette ni pose de
 * départ connue : ils manquent (le rejeu estime combien entreraient dans la liste sur leur seul contexte).
 *
 * Usage :
 *   node tools/verts-a-controler.cjs extraire --partie P:N --jeu JEU.jsonl --echo DOSSIER[,DOSSIER] [--journal J.json] [--regles R.json] --sortie T.json
 *   node tools/verts-a-controler.cjs etudier T1.json T2.json ... [--json S.json]
 *   node tools/verts-a-controler.cjs rejeu T1.json T2.json ... [--json S.json]
 *   node tools/verts-a-controler.cjs essai
 *   --juger-partie-reservee : une partie réservée du manifeste est lue malgré tout (jamais pour régler).
 * Sorties (texte et JSON) : comptes, millimètres, numéros de cut, minutes. Aucune coordonnée, aucun identifiant de projet.
 */
const fs=require('node:fs');
const V=require('../src/verts-a-controler.js');
const Manifeste=require('./manifeste-parties.cjs');

const FORMAT_TABLE='ariane-verts-table-v1',FORMAT='ariane-verts-a-controler-etude-v1';
const FAUX_MM=10,OBJET_MM=25,PRIX_VERT=0.3;
const CLES=['ecartement','denivele','hauteur','poses','voie','rouges','differe','pn'];
const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
const pct=v=>Number.isFinite(v)?Math.round(100*v)+' %':'—';
const med=a=>{const s=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!s.length)return null;const m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};

/* ------------------------------------------------------------------ extraire */
function extraire(o){
  const J=require('./jointure-echo-orbite.cjs'),RM=require('./regles-metier.cjs');
  const d=o.partie[0],jeu=RM.lireJeu(o.jeu),L=J.lireEcho(o.echo),par=J.echoParCut(L.records,L.sessions),cuts=[];
  for(const c of par.values()){if(c.partie!==d.partie)continue;
    const v=c.visites[0],i=v&&(v.initialObserved||v.firstObserved),A=i?.rails?.left?.positionSceneRelative,B=i?.rails?.right?.positionSceneRelative;
    let duree=0;for(const w of c.visites){const t=(Date.parse(w.endedAt)-Date.parse(w.startedAt))/1000;if(Number.isFinite(t)&&t>=0)duree+=Math.min(t,120);}
    const x=jeu.cuts.get(c.cut),ok=Array.isArray(A)&&Array.isArray(B)&&A.length===3&&B.length===3;
    cuts.push({i:c.cut,classe:x?.classe??null,mm:x?.mm??null,dureeS:Math.round(duree*100)/100,visites:c.visites.length,bords:ok?{left:A,right:B}:null});}
  cuts.sort((a,b)=>a.i-b.i);
  let lot=null;if(o.journal){const j=RM.lireJournal(o.journal,d.partie);lot=j.decisions.map(x=>({cut:x.cut,differe:!j.valide.has(x.cut)}));}
  let zonesPN=[];if(o.regles){const z=JSON.parse(fs.readFileSync(o.regles,'utf8'));zonesPN=(z.zonesPN?.detectees||[]).map(x=>({debut:x.debut,fin:x.fin,controle:x.controle}));}
  return {format:FORMAT_TABLE,projet:d.projet,partie:d.partie,lot,zonesPN,cuts,note:'table de travail HORS DÉPÔT : elle porte les bords des rails'};
}

/* ------------------------------------------------------------------ préparation d'une table */
const ZONES=[0,2,4],FENETRES=[5];
const GEO=['ecartement','denivele','hauteur','poses','voie'],CTX=['rouges','differe','pn'];
/* Termes du score, poids 1, pour chaque zone morte essayée (même zone pour les signaux de pose). */
function termes(s){const o={};for(const z of ZONES){const t={};
    for(const k of CLES){const p=Object.fromEntries(CLES.map(j=>[j,j===k?1:0]));
      t[k]=V.noter(s,{poids:p,zonesMortes:{ecartementMm:z,deniveleMm:z,hauteurMm:z,posesMm:z,voieMm:z}}).score;}o[z]=t;}return o;}
function preparer(t,{fenetreIsoleCuts=V.DEFAULTS.fenetreIsoleCuts}={}){const fenetreCuts=V.DEFAULTS.fenetreCuts;
  const verts=t.cuts.filter(c=>c.classe==='hors-journal');
  const entree={partie:t.partie,lignes:verts.map(c=>({i:c.i,statut:'valid',operateur:false,bords:c.bords||null,...(c.bords?{}:{g:c.g??null,dz:c.dz??null})})),
    lot:(t.lot||[]).map(x=>({cut:x.cut,differe:x.differe===true||x.valide===false})),zonesPN:t.zonesPN||[]};
  /* Poses validées d'Ariane : pose de départ de l'Écho des cuts posés (l'Écho suit le lot : c'est la pose d'Ariane, avant l'opérateur). */
  const valides=new Set((t.lot||[]).filter(x=>!(x.differe===true||x.valide===false)).map(x=>x.cut));
  entree.posees=t.cuts.filter(c=>c.classe==='posee'&&valides.has(c.i)&&c.bords).map(c=>({i:c.i,bords:c.bords}));
  const sansLot=!Array.isArray(t.lot),opt=sansLot?{touteLaPartie:true}:{fenetreIsoleCuts};
  const S=V.signaux(entree,opt),lab=new Map(verts.filter(c=>c.mm!=null).map(c=>[c.i,c])),U=[...lab.values()];
  const cand=S.signaux.filter(s=>lab.has(s.i)).map(s=>({...s,mm:lab.get(s.i).mm,dureeS:lab.get(s.i).dureeS,T:termes(s)}));
  const visNonLab=S.signaux.filter(s=>!lab.has(s.i)).map(s=>({...s,T:termes(s)}));
  /* Cuts de la fenêtre que l'opérateur n'a pas relus, dans la zone qu'il a relue (à 10 cuts au plus d'un cut vu à l'Écho) : contexte seul. */
  const inconnus=[];
  if(!sansLot&&S.cutsLot.length){const vus=t.cuts.map(c=>c.i).sort((a,b)=>a-b),setVus=new Set(vus),setLot=new Set(S.cutsLot);
    const pres=(arr,c,r)=>arr.some(x=>Math.abs(x-c)<=r);
    for(let i=Math.max(0,S.cutsLot[0]-fenetreCuts);i<=S.cutsLot.at(-1)+fenetreCuts;i++){
      if(setVus.has(i)||setLot.has(i)||!pres(vus,i,10))continue;
      const pn=S.zones.find(z=>i>=z.controle[0]&&i<=z.controle[1])||null,n5=S.cutsLot.filter(c=>Math.abs(c-i)<=5).length;if(!pn&&!pres(S.cutsLot,i,n5>=2?fenetreCuts:Math.min(fenetreCuts,fenetreIsoleCuts)))continue;
      const s={i,ecartementMm:null,deniveleMm:null,voieVerticaleMm:null,voieLateraleMm:null,rouges:S.cutsLot.filter(c=>Math.abs(c-i)<=5).length,
        distDiffere:S.differes.length?Math.min(...S.differes.map(c=>Math.abs(c-i))):null,pn:pn?{debut:pn.debut,fin:pn.fin}:null};
      inconnus.push({...s,T:termes(s)});}}
  return {t,entree,opt,fenetreIsoleCuts,S,sansLot,U,cand,visNonLab,inconnus,nErr:U.filter(c=>c.mm>FAUX_MM).length,n25:U.filter(c=>c.mm>=OBJET_MM).length,
    designation:`${t.projet??'?'}:${t.partie}`};
}
const somme=(T,w,cles)=>cles.reduce((a,k)=>a+(w[k]||0)*T[k],0);
const scorer=(c,th)=>Math.round(100*somme(c.T[th.zone],th.poids,CLES))/100;
/* Un réglage θ = {poids, zone} appliqué à une partie : candidats relus classés, et de quoi estimer la taille de la liste au terrain
 * (verts non relus de la fenêtre : contexte connu, pose tirée des verts justes relus de la même partie). */
function appliquer(p,th){
  const sc=p.cand.map(c=>({...c,score:scorer(c,th)})).sort((a,b)=>b.score-a.score||a.i-b.i);
  const nl=p.visNonLab.map(c=>scorer(c,th));
  const geoBons=p.cand.filter(c=>c.mm<=FAUX_MM).map(c=>somme(c.T[th.zone],th.poids,GEO)).sort((a,b)=>a-b);
  const ctx=p.inconnus.map(c=>somme(c.T[th.zone],th.poids,CTX));
  const auDessus=x=>{let lo=0,hi=geoBons.length;while(lo<hi){const m=(lo+hi)>>1;if(geoBons[m]<x-1e-9)lo=m+1;else hi=m;}return geoBons.length-lo;};
  const terrain=s=>nl.filter(x=>x>=s).length+(geoBons.length?ctx.reduce((a,c)=>a+auDessus(s-c)/geoBons.length,0):0);
  return {sc,terrain};}
function aSeuil(p,A,seuil){const L=A.sc.filter(c=>c.score>=seuil),t=A.terrain(seuil);
  return {verts:L.length,part:p.U.length?L.length/p.U.length:null,terrain:Math.round(L.length+t),partTerrain:p.U.length?(L.length+t)/p.U.length:null,
    erreurs:L.filter(c=>c.mm>FAUX_MM).length,rappel:p.nErr?L.filter(c=>c.mm>FAUX_MM).length/p.nErr:null,
    objets:L.filter(c=>c.mm>=OBJET_MM).length,fin5:L.filter(c=>c.mm<=5).length,minutes:r1(L.length*V.DEFAULTS.tempsParVertS/60),
    minutesTerrain:r1((L.length+t)*V.DEFAULTS.tempsParVertS/60),minutesEcho:r1(L.reduce((a,c)=>a+Math.min(c.dureeS,120),0)/60)};}
/* Rappel des erreurs > 10 mm pour une liste de terrain d'au plus la part `f` des verts relus par l'opérateur (taille estimée, non relus compris). */
function courbe(p,A,parts=[0.1,0.2,0.3,0.4,0.5,0.6]){
  const seuils=[...new Set(A.sc.map(c=>c.score))].sort((a,b)=>b-a);
  return parts.map(f=>{let best=null;for(const s of seuils){const q=aSeuil(p,A,s);if(q.partTerrain<=f+1e-9)best=q;else break;}
    return {part:f,rappel:best?best.rappel:0,verts:best?best.terrain:0};});}
function auc(xs,ys){const p=[],n=[];xs.forEach((v,i)=>{if(!Number.isFinite(v))return;(ys[i]?p:n).push(v);});if(p.length<3||n.length<3)return null;
  let w=0;for(const a of p)for(const b of n)w+=a>b?1:a===b?0.5:0;return Math.round(1000*w/(p.length*n.length))/1000;}

/* ------------------------------------------------------------------ étudier */
const GRILLE=(()=>{const g=[];
  for(const fenetre of FENETRES)for(const zone of ZONES)for(const ecartement of [0.5,1])for(const denivele of [0,0.5,1])for(const hauteur of [0.5,1])
    for(const poses of [0,0.5,1,2])for(const rouges of [0.5,1,2,3])for(const differe of [0.5])g.push({fenetre,zone,poids:{ecartement,denivele,hauteur,poses,voie:0,rouges,differe,pn:0}});
  return g;})();
/* Apprendre sur des lots : le réglage qui maximise le rappel moyen pour une liste de terrain de 20, 30 et 40 % des verts relus par
 * l'opérateur (chaque partie pèse autant), puis le seuil de `seuilAppris` sur ces mêmes lots. */
function seuilAppris(train,th){const As=train.map(p=>appliquer(p,th)),seuils=[...new Set(As.flatMap(A=>A.sc.map(c=>c.score)))].sort((a,b)=>b-a);
  let seuil=0,bestG=-Infinity;for(const s of seuils){const g=train.reduce((a,p,k)=>{const q=aSeuil(p,As[k],s);return a+q.rappel-PRIX_VERT*q.partTerrain;},0)/train.length;if(g>bestG+1e-9){bestG=g;seuil=s;}}
  return seuil;}
function apprendre(train){
  if(!train.length)throw Error('aucune partie d\'apprentissage');
  let best=null;
  for(const th of GRILLE){const m=train.reduce((a,q)=>{const p=q[th.fenetre];const c=courbe(p,appliquer(p,th),[0.2,0.3,0.4]);return a+c.reduce((x,y)=>x+y.rappel,0)/3;},0)/train.length;
    if(!best||m>best.objectif+1e-9)best={...th,objectif:m};}
  train=train.map(q=>q[best.fenetre]);
  const As=train.map(p=>appliquer(p,best)),seuils=[...new Set(As.flatMap(A=>A.sc.map(c=>c.score)))].sort((a,b)=>b-a);
  /* Seuil : le meilleur compromis moyen sur l'apprentissage entre erreurs attrapées et verts à relire (liste de terrain) :
   * maximiser rappel − PRIX_VERT × part relue. PRIX_VERT = 0,3 : relire 10 % des verts de plus doit attraper au moins 3 % des erreurs de plus. */
  let seuil=0,bestG=-Infinity;for(const s of seuils){const g=train.reduce((a,p,k)=>{const q=aSeuil(p,As[k],s);return a+q.rappel-PRIX_VERT*q.partTerrain;},0)/train.length;if(g>bestG+1e-9){bestG=g;seuil=s;}}
  return {poids:best.poids,zone:best.zone,fenetre:best.fenetre,objectif:Math.round(1000*best.objectif)/1000,seuil};
}
function etudier(tables){
  const Q=tables.map(t=>Object.fromEntries(FENETRES.map(f=>[f,preparer(t,{fenetreIsoleCuts:f})]))),D=V.DEFAULTS.fenetreIsoleCuts;
  const P=Q.map(q=>q[FENETRES.includes(D)?D:FENETRES.at(-1)]),lotsQ=Q.filter(q=>!q[FENETRES[0]].sansLot),lots=lotsQ;
  const signauxAUC=P.map(p=>{const y=p.cand.map(c=>c.mm>FAUX_MM);const o={partie:p.designation,verts:p.U.length,erreurs:p.nErr,candidats:p.cand.length,nonRelus:p.inconnus.length};
    for(const [k,f] of [['ecartement',c=>c.ecartementMm],['denivele',c=>c.deniveleMm],['hauteur',c=>c.voieVerticaleMm],['poses',c=>c.hauteurPosesMm],['voie',c=>c.voieLateraleMm],['rouges',c=>c.rouges],['differe',c=>c.distDiffere==null?null:-c.distDiffere],['pn',c=>c.pn?1:0]])
      o[k]=auc(p.cand.map(f),y);return o;});
  const tous=lots.length?apprendre(lots):null;
  const croisee=Q.map(q=>{const p0=q[FENETRES[0]];const A=p0.sansLot?tous:lots.length>1?apprendre(lots.filter(x=>x!==q)):null;if(!A)return {partie:p0.designation,erreur:'pas assez de lots'};
    const p=q[A.fenetre],ap=appliquer(p,A);
    return {partie:p.designation,sansLot:p.sansLot,appris:p.sansLot?'tous les lots (partie sans lot)':'les autres lots',poids:A.poids,zone:A.zone,fenetre:A.fenetre,seuil:A.seuil,
      verts:p.U.length,erreurs:p.nErr,objets:p.n25,candidats:p.cand.length,nonRelus:p.inconnus.length,
      horsCandidats:{verts:p.U.length-p.cand.length,erreurs:p.nErr-p.cand.filter(c=>c.mm>FAUX_MM).length},
      courbe:courbe(p,ap),point:aSeuil(p,ap,A.seuil)};});
  /* Réglage livré (poids et zone morte appris sur tous les lots), seuil seul appris sans la partie jugée. */
  const thL={poids:V.DEFAULTS.poids,zone:V.DEFAULTS.zonesMortes.deniveleMm},lotsL=lots.map(q=>q[FENETRES[0]]);
  const croiseeSeuil=P.map(p=>{const train=lotsL.filter(q=>q!==p);if(!train.length)return {partie:p.designation,erreur:'pas assez de lots'};
    const seuil=seuilAppris(train,thL),ap=appliquer(p,thL);
    return {partie:p.designation,sansLot:p.sansLot,seuil,verts:p.U.length,erreurs:p.nErr,objets:p.n25,courbe:courbe(p,ap),point:aSeuil(p,ap,seuil)};});
  /* Temps de l'opérateur par vert relu (Écho) : total des visites des verts relus, plafonnées à 30 s puis à 120 s. */
  const temps=P.map(p=>{const d=p.U.map(c=>c.dureeS).filter(Number.isFinite),plaf=m=>d.reduce((a,x)=>a+Math.min(x,m),0);
    return {partie:p.designation,verts:d.length,minutes30:r1(plaf(30)/60),minutes120:r1(plaf(120)/60),sParVert30:r1(d.length?plaf(30)/d.length:null),sParVert120:r1(d.length?plaf(120)/d.length:null),medianeS:r1(med(d))};});
  return {format:FORMAT,mode:'etudier',module:V.DEFAULTS.version,prixVert:PRIX_VERT,signaux:signauxAUC,appris:tous,croisee,croiseeSeuil,temps,
    livre:{poids:V.DEFAULTS.poids,fenetre:V.DEFAULTS.fenetreIsoleCuts,zonesMortes:V.DEFAULTS.zonesMortes,seuil:V.DEFAULTS.seuil}};
}

/* ------------------------------------------------------------------ rejeu (réglages livrés) */
function rejeu(tables){
  const th={poids:V.DEFAULTS.poids,zone:V.DEFAULTS.zonesMortes.deniveleMm};
  return {format:FORMAT,mode:'rejeu',module:V.DEFAULTS.version,reglages:{poids:V.DEFAULTS.poids,zonesMortes:V.DEFAULTS.zonesMortes,seuil:V.DEFAULTS.seuil,tempsParVertS:V.DEFAULTS.tempsParVertS},
    parties:tables.map(t=>{const p=preparer(t),L=V.liste(p.entree,p.opt),lab=new Map(p.U.map(c=>[c.i,c])),retenus=L.verts;
      if(!ZONES.includes(th.zone))throw Error('zone morte livrée hors de la grille de l\'outil');
      const ap=appliquer(p,th),q=aSeuil(p,ap,V.DEFAULTS.seuil);
      const err=retenus.filter(v=>lab.get(v.i)?.mm>FAUX_MM),obj=retenus.filter(v=>lab.get(v.i)?.mm>=OBJET_MM);
      return {partie:p.designation,sansLot:p.sansLot,versRelusOperateur:p.U.length,minutesOperateur:r1(p.U.length*V.DEFAULTS.tempsParVertS/60),
        minutesOperateurEcho:r1(p.U.reduce((a,c)=>a+Math.min(c.dureeS,120),0)/60),erreurs:p.nErr,objets:p.n25,
        candidats:L.candidats,aControler:L.aControler,relusDansLaListe:retenus.filter(v=>lab.has(v.i)).length,
        part:p.U.length?r1(100*retenus.filter(v=>lab.has(v.i)).length/p.U.length):null,
        attrapees:err.length,objetsAttrapes:obj.length,fin5:retenus.filter(v=>lab.get(v.i)?.mm<=5).length,minutes:r1(L.tempsEstimeS/60),
        minutesEcho:r1(retenus.reduce((a,v)=>a+Math.min(lab.get(v.i)?.dureeS??0,120),0)/60),
        terrain:{nonRelusDansFenetre:p.inconnus.length,listeEstimee:Math.round(q.terrain+(L.aControler-q.verts-p.visNonLab.filter(c=>scorer(c,th)>=V.DEFAULTS.seuil).length)),minutes:q.minutesTerrain},
        plages:L.plages.length,apercu:L.plages.slice(0,12).map(x=>({libelle:x.libelle,debut:x.debut,fin:x.fin,nombre:x.nombre,erreurs:x.cuts.filter(i=>lab.get(i)?.mm>FAUX_MM).length})),
        manquees:p.U.filter(c=>c.mm>FAUX_MM&&!retenus.some(v=>v.i===c.i)).map(c=>({cut:c.i,mm:r1(c.mm)}))};})};
}

/* ------------------------------------------------------------------ texte */
function texte(r){const L=[];
  if(r.mode==='etudier'){
    L.push('Signaux (AUC, erreurs > 10 mm parmi les candidats) :','| Partie | Verts relus | > 10 mm | Candidats | écartement | dénivelé | hauteur | poses | voie | rouges | différé | PN |','|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|');
    for(const s of r.signaux)L.push(`| ${s.partie} | ${s.verts} | ${s.erreurs} | ${s.candidats} | ${['ecartement','denivele','hauteur','poses','voie','rouges','differe','pn'].map(k=>s[k]??'—').join(' | ')} |`);
    L.push('','Validation croisée par partie (réglage et seuil appris sans la partie jugée) ; liste « terrain » : relus de la liste + estimation des non relus de la fenêtre :','| Partie | Appris sur | Fenêtre, zone morte, seuil | Rappel pour une liste de 10 / 20 / 30 / 40 / 50 / 60 % des verts | Liste relue (part) | Liste terrain (part) | Attrapées | ≥ 25 mm | ≤ 5 mm | Minutes terrain (3,7 s) | Minutes réelles (relus) | Hors candidats (erreurs) |','|---|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|');
    for(const c of r.croisee){if(c.erreur){L.push(`| ${c.partie} | ${c.erreur} |`);continue;}const q=c.point;
      L.push(`| ${c.partie} | ${c.appris} | isolé ±${c.fenetre}, ${c.zone} mm, ${c.seuil} | ${c.courbe.map(x=>pct(x.rappel)).join(' / ')} | ${q.verts} (${pct(q.part)}) | ${q.terrain} (${pct(q.partTerrain)}) | ${q.erreurs}/${c.erreurs} (${pct(q.rappel)}) | ${q.objets}/${c.objets} | ${q.fin5} | ${q.minutesTerrain} | ${q.minutesEcho} | ${c.horsCandidats.verts} (${c.horsCandidats.erreurs}) |`);}
    L.push('','Réglage livré (poids et zone morte appris sur tous les lots), seuil seul appris sans la partie jugée :','| Partie | Seuil | Rappel pour une liste de 10 / 20 / 30 / 40 / 50 / 60 % des verts | Liste relue (part) | Liste terrain (part) | Attrapées | ≥ 25 mm | ≤ 5 mm | Minutes relue – terrain (3,7 s) |','|---|--:|---|--:|--:|--:|--:|--:|---|');
    for(const c of r.croiseeSeuil||[]){if(c.erreur){L.push(`| ${c.partie} | ${c.erreur} |`);continue;}const q=c.point;
      L.push(`| ${c.partie} | ${c.seuil} | ${c.courbe.map(x=>pct(x.rappel)).join(' / ')} | ${q.verts} (${pct(q.part)}) | ${q.terrain} (${pct(q.partTerrain)}) | ${q.erreurs}/${c.erreurs} (${pct(q.rappel)}) | ${q.objets}/${c.objets} | ${q.fin5} | ${q.minutes} – ${q.minutesTerrain} |`);}
    if(r.appris)L.push('',`Appris sur tous les lots : poids ${JSON.stringify(r.appris.poids)}, fenêtre d'un isolé ±${r.appris.fenetre}, zone morte ${r.appris.zone} mm, seuil ${r.appris.seuil}. Livré : poids ${JSON.stringify(r.livre.poids)}, fenêtre d'un isolé ±${r.livre.fenetre}, zones mortes ${JSON.stringify(r.livre.zonesMortes)}, seuil ${r.livre.seuil}.`);
    L.push('','Temps de l\'opérateur par vert relu (Écho) :','| Partie | Verts | Minutes (visites ≤ 30 s) | s par vert | Minutes (≤ 120 s) | s par vert | Médiane (s) |','|---|--:|--:|--:|--:|--:|--:|');
    for(const t of r.temps)L.push(`| ${t.partie} | ${t.verts} | ${t.minutes30} | ${t.sParVert30} | ${t.minutes120} | ${t.sParVert120} | ${t.medianeS} |`);}
  else{
    L.push('| Partie | Verts relus par l\'opérateur (min réelles) | Candidats | À contrôler (relus ; part) | > 10 mm attrapées | ≥ 25 mm | ≤ 5 mm | Minutes (3,7 s) | Minutes réelles | Terrain : non relus de la fenêtre, liste estimée, minutes |','|---|---|--:|--:|--:|--:|--:|--:|--:|---|');
    for(const p of r.parties)L.push(`| ${p.partie}${p.sansLot?' (sans lot)':''} | ${p.versRelusOperateur} (${p.minutesOperateurEcho}) | ${p.candidats} | ${p.aControler} (${p.relusDansLaListe} ; ${p.part} %) | ${p.attrapees}/${p.erreurs} (${pct(p.erreurs?p.attrapees/p.erreurs:null)}) | ${p.objetsAttrapes}/${p.objets} | ${p.fin5} | ${p.minutes} | ${p.minutesEcho} | ${p.sansLot?'—':`${p.terrain.nonRelusDansFenetre} ; ${p.terrain.listeEstimee} ; ${p.terrain.minutes}`} |`);
    for(const p of r.parties){L.push('',`Partie ${p.partie} : ${p.plages} plages ; aperçu :`);for(const x of p.apercu)L.push(`  ${x.libelle} · ${x.debut === x.fin ? 'cut '+x.debut : x.debut+'–'+x.fin} · ${x.nombre} cut${x.nombre>1?'s':''}${x.erreurs?` (${x.erreurs} > 10 mm)`:''}`);}}
  return L.join('\n');}

/* ------------------------------------------------------------------ essai synthétique */
function essai(){
  /* Voie droite inventée, cuts tous les mètres ; un rouge isolé (20), une grappe de différés (40–44), un PN (60–63) ; des verts
   * dont trois mal extraits (écartement +30 mm en 47, rail gauche haut de 35 mm en 21, dénivelé en 61). Aucune donnée de terrain. */
  const bords=(i,{dg=0,dzL=0}={})=>({left:[i,-0.7175-dg/2000,dzL/1000],right:[i,0.7175+dg/2000,0]});
  const cuts=[],mm={47:30,21:35,61:18,58:2};
  for(let i=0;i<80;i++){if([20,40,41,42,43,44,59,60,62,63].includes(i))continue;
    cuts.push({i,classe:'hors-journal',mm:mm[i]??1,dureeS:3,visites:1,bords:bords(i,{dg:i===47?30:0,dzL:i===21?35:i===61?18:0})});}
  const lot=[{cut:20,differe:false},{cut:40,differe:true},{cut:41,differe:true},{cut:42,differe:false},{cut:43,differe:true},{cut:44,differe:false},{cut:59,differe:false},{cut:60,differe:false},{cut:62,differe:false},{cut:63,differe:false}];
  const t={format:FORMAT_TABLE,projet:0,partie:0,lot,zonesPN:[{debut:59,fin:63,controle:[55,69]}],cuts};
  return {table:t,rejeu:rejeu([t]),etude:etudier([t,{...t,partie:1},{...t,partie:2}])};
}

function lireArguments(argv){
  const o={mode:argv[0],echo:[],fichiers:[]};
  for(let i=1;i<argv.length;i++){const a=argv[i],val=()=>argv[++i];
    if(a==='--partie')o.partie=Manifeste.lireDesignations(val());else if(a==='--jeu')o.jeu=val();else if(a==='--echo')o.echo.push(...val().split(','));
    else if(a==='--journal')o.journal=val();else if(a==='--regles')o.regles=val();else if(a==='--sortie')o.sortie=val();else if(a==='--json')o.json=val();
    else if(a==='--juger-partie-reservee')o.jugerReservee=true;else if(!a.startsWith('--'))o.fichiers.push(a);else throw Error('option inconnue : '+a);}
  return o;}
function lireTables(fichiers,o){const m=Manifeste.lire();
  return fichiers.map(f=>{const t=JSON.parse(fs.readFileSync(f,'utf8'));if(t.format!==FORMAT_TABLE)throw Error(f+' : table attendue ('+FORMAT_TABLE+')');
    const {avis}=Manifeste.controler(m,[{projet:t.projet,partie:t.partie}],{outil:'verts-a-controler',jugerReservee:!!o.jugerReservee});if(avis)console.error(avis);return t;});}

if(require.main===module){
  try{const o=lireArguments(process.argv.slice(2));let out;
    if(o.mode==='essai'){out=essai();console.log(texte(out.rejeu));console.log(texte(out.etude));process.exit(0);}
    if(o.mode==='extraire'){if(!o.partie||o.partie.length!==1)throw Error('--partie PROJET:PARTIE attendu');
      const m=Manifeste.lire(),{avis}=Manifeste.controler(m,o.partie,{outil:'verts-a-controler',jugerReservee:!!o.jugerReservee});if(avis)console.error(avis);
      out=extraire(o);if(!o.sortie)throw Error('--sortie attendu (la table porte des bords : jamais sur la sortie standard)');
      fs.writeFileSync(o.sortie,JSON.stringify(out));console.log(`partie ${out.projet}:${out.partie} : ${out.cuts.length} cuts à l'Écho, ${out.cuts.filter(c=>c.classe==='hors-journal').length} verts, lot ${out.lot?out.lot.length:'—'}, PN ${out.zonesPN.length}`);process.exit(0);}
    const tables=lireTables(o.fichiers,o);
    if(o.mode==='etudier')out=etudier(tables);else if(o.mode==='rejeu')out=rejeu(tables);else throw Error('mode extraire, etudier, rejeu ou essai attendu');
    if(o.json)fs.writeFileSync(o.json,JSON.stringify(out,null,1));console.log(texte(out));
  }catch(e){console.error(e.message);process.exit(2);}
}
module.exports={FORMAT,FORMAT_TABLE,CLES,GRILLE,ZONES,PRIX_VERT,seuilAppris,extraire,preparer,termes,appliquer,courbe,aSeuil,apprendre,etudier,rejeu,texte,essai,lireArguments};
