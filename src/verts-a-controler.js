(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeVertsAControler=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* 5.0 — VERTS À CONTRÔLER (fiches/VERTS_A_CONTROLER.md). Une LISTE que l'opérateur consulte après un lot : les verts (cuts qu'ESV a
  * laissés valides et qu'Orbite ne visite pas) les plus suspects, classés par risque et groupés en plages comme il les parcourt.
  *
  * Module PUR, commun au service worker (action de panneau `verts-a-controler`, fichier joint à l'export) et à l'outil de rejeu
  * (tools/verts-a-controler.cjs). Il ne commande rien et ne lit rien : tout lui est passé. Il ne rend aucune position : des numéros
  * de cut, des millimètres, des scores. AUCUNE action dans ESV : ni clic, ni navigation, ni requête, ni changement d'état d'un cut.
  *
  * Entrée : `lignes` de la liste d'ESV (statut, traitée par un opérateur, bords des deux rails ; lues sur l'instantané E1, ou à
  * défaut écartement et dénivelé de la fenêtre de B1), `lot` (cuts du lot, différés ou non), `zonesPN` (PN reconnus par les
  * règles métier), `posees` (bords qu'Ariane a écrits sur les cuts qu'elle a validés, mémoire E1). Un vert : ligne `valid`, jamais
  * traitée par un opérateur, hors des cuts du lot.
  * Candidats : les verts à `fenetreCuts` cuts au plus d'un cut du lot (la fenêtre que B1 lit déjà), et ceux de la plage d'un PN.
  * Signaux (REGLES_METIER, FAUX_VERTS, G0) :
  *   - écartement : écart à la médiane des verts de la partie (le mauvais objet d'extraction, 54 sur 54 en parties 12 et 13) ;
  *   - dénivelé : hauteur gauche − droite contre la médiane des verts voisins (±10) : le saut vertical d'un seul rail ;
  *   - hauteur : chaque rail contre l'interpolation du même rail des verts voisins (un avant, un après, à 5 cuts au plus) ;
  *   - poses : la même chose contre les poses validées d'Ariane de part et d'autre (connue seulement entre deux cuts posés) ;
  *   - rouges : nombre de cuts du lot à 5 cuts au plus (grappe, noyau d'aiguille) ; différé du lot à 2 cuts au plus.
  *   Écart latéral à la voie et plage de PN sont calculés et rendus, avec un poids nul : en validation croisée ils n'apportaient
  *   rien de plus (la plage de PN reste dans le libellé).
  * Score : somme de termes bornés, chacun nul sous sa zone morte ; poids et zone morte appris sur les quatre lots (1:17, 1:24, 1:29,
  * 2:1, tools/verts-a-controler.cjs), seuil choisi d'après la validation croisée du seuil seul ; figés ici et dans
  * datasets/reglages-figes.json (`vertsAControler`). Un vert entre dans la liste si son score atteint `seuil`.
  * Temps : `tempsParVertS` par vert (partie 29 : 585 verts relus en 36 min, 3,7 s). */
 const DEFAULTS=Object.freeze({version:'verts-a-controler-v1',
  fenetreCuts:5,fenetreIsoleCuts:5,touteLaPartie:false,referenceLignesMin:20,voisinsDenivele:10,voisinsMin:3,voisinsVoie:5,
  pn:Object.freeze({margeAvant:4,margeApres:6}),
  poids:Object.freeze({ecartement:0.5,denivele:0.5,hauteur:1,poses:0.5,voie:0,rouges:1,differe:0.5,pn:0}),
  bornes:Object.freeze({ecartementMm:40,deniveleMm:40,hauteurMm:40,posesMm:40,voieMm:40,rouges:6}),
  echelles:Object.freeze({ecartementMm:10,deniveleMm:10,hauteurMm:10,posesMm:10,voieMm:10,rouges:5}),
  zonesMortes:Object.freeze({ecartementMm:2,deniveleMm:2,hauteurMm:2,posesMm:2,voieMm:2}),
  seuil:1,
  tempsParVertS:3.7,
  plage:Object.freeze({trouCuts:2,differeCuts:2}),
  plagesMax:200});
 const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
 const r2=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
 const med=v=>{const s=v.filter(Number.isFinite).sort((a,b)=>a-b);if(!s.length)return null;const m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
 const fusion=(a,b)=>{const o={...a};for(const [k,v] of Object.entries(b||{}))o[k]=v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'?{...a[k],...v}:v;return o;};
 const cfgDe=o=>o?fusion(DEFAULTS,o):DEFAULTS;
 const entier=v=>Number.isInteger(v)&&v>=0;

 /* Zones de PN : {debut,fin} (cœur) ou {controle:[a,b]} ou [a,b] (plage déjà marginée). */
 function plagesPN(zones,cfg){const out=[];
  for(const z of Array.isArray(zones)?zones:[]){
   if(Array.isArray(z)&&z.length===2&&z.every(entier))out.push({debut:z[0],fin:z[1],controle:[z[0],z[1]]});
   else if(z&&Array.isArray(z.controle)&&z.controle.every(entier))out.push({debut:entier(z.debut)?z.debut:z.controle[0],fin:entier(z.fin)?z.fin:z.controle[1],controle:[z.controle[0],z.controle[1]]});
   else if(z&&entier(z.debut)&&entier(z.fin))out.push({debut:z.debut,fin:z.fin,controle:[Math.max(0,z.debut-cfg.pn.margeAvant),z.fin+cfg.pn.margeApres]});}
  return out;}
 /* Lignes de la liste d'ESV depuis un instantané E1 décompacté (src/liste-memoire.js `decompacter`) : bords monde au dixième de mm,
  * gauche X Y Z puis droit X Y Z, rendus en mètres sous `bords`. Les bords ne servent qu'au calcul : aucune sortie n'en porte. */
 function lignesDeInstantane(dec){const out=[];if(!dec||!Number.isInteger(dec.n))return out;
  const ST=['valid','invalid','skipped','autre'];
  for(let i=0;i<dec.n;i++){const e=dec.ed.slice(6*i,6*i+6),ok=e.length===6&&e.every(Number.isFinite);
   out.push({i,statut:ST[dec.st[i]]||'autre',operateur:(dec.fl[i]&1)===1,bords:ok?{left:e.slice(0,3).map(v=>v/1e4),right:e.slice(3).map(v=>v/1e4)}:null});}
  return out;}
 const v3=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
 /* Écartement et dénivelé (mm) d'une ligne : donnés, ou tirés de ses bords. */
 function mesures(x){const b=x.bords,ok=b&&v3(b.left)&&v3(b.right);
  return {g:Number.isFinite(x.g)?x.g:ok?Math.hypot(b.left[0]-b.right[0],b.left[1]-b.right[1],b.left[2]-b.right[2])*1000:null,
   dz:Number.isFinite(x.dz)?x.dz:ok?(b.left[2]-b.right[2])*1000:null,bords:ok?b:null};}

 /* Signaux de chaque candidat. */
 function signaux(entree,options){const cfg=cfgDe(options);
  const lot=(entree?.lot||[]).filter(x=>entier(x?.cut)),cutsLot=[...new Set(lot.map(x=>x.cut))].sort((a,b)=>a-b),setLot=new Set(cutsLot);
  const differes=[...new Set(lot.filter(x=>x.differe===true).map(x=>x.cut))].sort((a,b)=>a-b);
  const zones=plagesPN(entree?.zonesPN,cfg);
  const parI=new Map();
  for(const x of entree?.lignes||[])if(entier(x?.i))parI.set(x.i,x);
  const verts=[...parI.values()].filter(x=>x.statut==='valid'&&x.operateur!==true&&!setLot.has(x.i)).sort((a,b)=>a.i-b.i).map(x=>({i:x.i,...mesures(x)}));
  const gs=verts.map(x=>x.g).filter(Number.isFinite);
  const reference={ecartementMm:gs.length>=cfg.referenceLignesMin?r1(med(gs)):null,lignes:gs.length};
  const dz=new Map(verts.filter(x=>Number.isFinite(x.dz)).map(x=>[x.i,x.dz])),pos=new Map(verts.filter(x=>x.bords).map(x=>[x.i,x.bords]));
  /* Poses validées par Ariane dans le lot (bords qu'elle a écrits, mémoire E1) : la voie juste autour d'un vert. */
  const poses=new Map();for(const x of entree?.posees||[])if(entier(x?.i)&&x.bords&&v3(x.bords.left)&&v3(x.bords.right))poses.set(x.i,x.bords);
  const proche=(arr,c)=>{let lo=0,hi=arr.length;while(lo<hi){const m=(lo+hi)>>1;if(arr[m]<c)lo=m+1;else hi=m;}
   let d=Infinity;if(lo<arr.length)d=Math.min(d,arr[lo]-c);if(lo>0)d=Math.min(d,c-arr[lo-1]);return d;};
  const compte=(arr,c,r)=>{let n=0;for(const x of arr){if(x<c-r)continue;if(x>c+r)break;n++;}return n;};
  /* Écart à la voie des verts voisins : chaque rail contre l'interpolation linéaire (par numéro de cut) du même rail des verts
   * voisins les plus proches, un avant et un après, à `voisinsVoie` cuts au plus ; vertical et horizontal, le pire des deux rails. */
  const voie=(c,ref=pos)=>{const b=pos.get(c);if(!b)return null;let a=null,z=null;
   for(let d=1;d<=cfg.voisinsVoie&&!a;d++)if(ref.has(c-d))a={i:c-d,b:ref.get(c-d)};
   for(let d=1;d<=cfg.voisinsVoie&&!z;d++)if(ref.has(c+d))z={i:c+d,b:ref.get(c+d)};
   if(!a||!z)return null;const w=(c-a.i)/(z.i-a.i);let v=0,h=0;
   for(const s of ['left','right']){const p=[0,1,2].map(k=>a.b[s][k]+w*(z.b[s][k]-a.b[s][k])),q=b[s];
    v=Math.max(v,Math.abs(q[2]-p[2])*1000);h=Math.max(h,Math.hypot(q[0]-p[0],q[1]-p[1])*1000);}
   return {v,h};};
  const out=[];
  for(const v of verts){
   const distLot=cutsLot.length?proche(cutsLot,v.i):Infinity,pn=zones.find(z=>v.i>=z.controle[0]&&v.i<=z.controle[1])||null;
   /* Hors d'une grappe (un seul cut du lot à 5 cuts), la fenêtre se réduit à `fenetreIsoleCuts` : la règle de l'opérateur pour un cut isolé
    * (« le cut d'avant et le cut d'après »). */
   const n5=compte(cutsLot,v.i,5);
   if(cfg.touteLaPartie!==true&&!pn&&!(distLot<=(n5>=2?cfg.fenetreCuts:Math.min(cfg.fenetreCuts,cfg.fenetreIsoleCuts))))continue;
   const vois=[];for(let d=-cfg.voisinsDenivele;d<=cfg.voisinsDenivele;d++){if(d&&dz.has(v.i+d))vois.push(dz.get(v.i+d));}
   const mdz=vois.length>=cfg.voisinsMin&&Number.isFinite(v.dz)?med(vois):null;
   const distDiff=differes.length?proche(differes,v.i):Infinity,vo=voie(v.i),vp=poses.size?voie(v.i,poses):null;
   out.push({i:v.i,
    ecartementMm:reference.ecartementMm!=null&&Number.isFinite(v.g)?r1(Math.abs(v.g-reference.ecartementMm)):null,
    deniveleMm:mdz!=null?r1(Math.abs(v.dz-mdz)):null,
    voieVerticaleMm:vo?r1(vo.v):null,voieLateraleMm:vo?r1(vo.h):null,hauteurPosesMm:vp?r1(vp.v):null,
    rouges:compte(cutsLot,v.i,5),distLot:Number.isFinite(distLot)?distLot:null,distDiffere:Number.isFinite(distDiff)?distDiff:null,
    pn:pn?{debut:pn.debut,fin:pn.fin}:null});}
  return {reference,signaux:out,cutsLot,differes,zones};}

 /* Score : points bornés, un terme par signal ; `raisons` dans l'ordre de leur poids dans le score. */
 function noter(s,options){const cfg=cfgDe(options),P=cfg.poids,B=cfg.bornes,E=cfg.echelles,Z=cfg.zonesMortes,t={};
  const terme=(x,k)=>Math.max(0,Math.min(x,B[k])-(Z[k]||0))/E[k];
  if(Number.isFinite(s.ecartementMm))t.ecartement=P.ecartement*terme(s.ecartementMm,'ecartementMm');
  if(Number.isFinite(s.deniveleMm))t.denivele=P.denivele*terme(s.deniveleMm,'deniveleMm');
  if(Number.isFinite(s.voieVerticaleMm))t.hauteur=P.hauteur*terme(s.voieVerticaleMm,'hauteurMm');
  if(Number.isFinite(s.hauteurPosesMm))t.poses=P.poses*terme(s.hauteurPosesMm,'posesMm');
  if(Number.isFinite(s.voieLateraleMm))t.voie=P.voie*terme(s.voieLateraleMm,'voieMm');
  if(s.rouges>0)t.grappe=P.rouges*Math.min(s.rouges,B.rouges)/E.rouges;
  if(Number.isFinite(s.distDiffere)&&s.distDiffere<=cfg.plage.differeCuts)t.differe=P.differe;
  if(s.pn)t.pn=P.pn;
  const score=Object.values(t).reduce((a,b)=>a+b,0);
  const raisons=Object.entries(t).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
  return {score:r2(score),raisons};}

 /* Classement des candidats, du plus suspect au moins suspect. */
 function classer(entree,options){const cfg=cfgDe(options),S=signaux(entree,cfg);
  const verts=S.signaux.map(s=>({...s,...noter(s,cfg)})).sort((a,b)=>b.score-a.score||a.i-b.i);
  return {...S,verts};}

 /* Plages groupées comme l'opérateur les parcourt (ordre des cuts) : des verts retenus à `trouCuts` cuts au plus les uns des
  * autres font une plage. Libellé : le PN qu'elle touche, sinon le différé du lot le plus proche, sinon la grappe de cuts du lot,
  * sinon le signal du cut. */
 function plages(retenus,S,options){const cfg=cfgDe(options),tri=retenus.slice().sort((a,b)=>a.i-b.i),out=[];
  for(const v of tri){const p=out.at(-1);if(p&&v.i-p.fin<=cfg.plage.trouCuts){p.fin=v.i;p.cuts.push(v.i);p.verts.push(v);}else out.push({debut:v.i,fin:v.i,cuts:[v.i],verts:[v]});}
  return out.map(p=>{const pn=p.verts.find(v=>v.pn)?.pn||null,d=cfg.plage.differeCuts;
   const diff=S.differes.filter(c=>c>=p.debut-d&&c<=p.fin+d);
   const lot=S.cutsLot.filter(c=>c>=p.debut-cfg.fenetreCuts&&c<=p.fin+cfg.fenetreCuts);
   const raisons=[...new Set(p.verts.flatMap(v=>v.raisons))];
   let motif,libelle;
   if(pn){motif='pn';libelle=`PN ${pn.debut}–${pn.fin}`;}
   else if(diff.length){motif='differe';libelle=diff.length===1?`autour du différé ${diff[0]}`:`autour des différés ${diff[0]}–${diff.at(-1)}`;}
   else if(lot.length>=3){motif='grappe';libelle=`grappe ${lot[0]}–${lot.at(-1)}`;}
   else if(raisons[0]==='ecartement'){motif='ecartement';libelle=p.cuts.length===1?`écartement, cut ${p.debut}`:`écartement, cuts ${p.debut}–${p.fin}`;}
   else if(raisons[0]==='denivele'||raisons[0]==='hauteur'){motif='hauteur';libelle=p.cuts.length===1?`hauteur, cut ${p.debut}`:`hauteur, cuts ${p.debut}–${p.fin}`;}
   else {motif='voisin';libelle=lot.length?`près du cut ${lot.reduce((a,c)=>Math.abs(c-p.debut)<Math.abs(a-p.debut)?c:a)}`:`cuts ${p.debut}–${p.fin}`;}
   return {debut:p.debut,fin:p.fin,cuts:p.cuts,nombre:p.cuts.length,motif,libelle,scoreMax:Math.max(...p.verts.map(v=>v.score)),raisons};})
   /* Deux plages voisines du même PN, du même différé ou de la même grappe n'en font qu'une : on les parcourt ensemble. */
   .reduce((acc,p)=>{const d=acc.at(-1);
    if(d&&d.libelle===p.libelle&&['pn','differe','grappe','voisin'].includes(p.motif)){d.fin=p.fin;d.cuts.push(...p.cuts);d.nombre=d.cuts.length;d.scoreMax=Math.max(d.scoreMax,p.scoreMax);d.raisons=[...new Set([...d.raisons,...p.raisons])];}
    else acc.push(p);return acc;},[]).map(p=>({...p,cutsTexte:compacter(p.cuts)}));}
 /* « 1655, 1664–1666 » : les cuts d'une plage, suites consécutives réunies. */
 function compacter(cuts){const t=[...new Set(cuts)].sort((a,b)=>a-b),out=[];
  for(const c of t){const d=out.at(-1);if(d&&c===d[1]+1)d[1]=c;else out.push([c,c]);}
  return out.map(([a,b])=>a===b?String(a):b===a+1?`${a}, ${b}`:`${a}–${b}`).join(', ');}

 /* La liste de fin de lot. `partie` : rendu tel quel. Aucun champ ne porte une position. */
 function liste(entree,options){const cfg=cfgDe(options),C=classer(entree,cfg);
  const retenus=C.verts.filter(v=>v.score>=cfg.seuil),P=plages(retenus,C,cfg);
  return {format:'ariane-verts-a-controler-1',version:cfg.version,partie:Number.isInteger(entree?.partie)?entree.partie:null,
   candidats:C.verts.length,aControler:retenus.length,tempsEstimeS:Math.round(retenus.length*cfg.tempsParVertS),tempsParVertS:cfg.tempsParVertS,
   seuil:cfg.seuil,reference:C.reference,cutsDuLot:C.cutsLot.length,differes:C.differes.length,zonesPN:C.zones.map(z=>({debut:z.debut,fin:z.fin,controle:z.controle})),
   plages:P.slice(0,cfg.plagesMax),plagesTronquees:P.length>cfg.plagesMax,
   verts:retenus.map(v=>({i:v.i,score:v.score,raisons:v.raisons,ecartementMm:v.ecartementMm,deniveleMm:v.deniveleMm,hauteurMm:v.voieVerticaleMm,rouges:v.rouges,distDiffere:v.distDiffere}))};}
 /* Durée lisible : « 2 min 20 s », « 45 s ». */
 function duree(s){if(!Number.isFinite(s)||s<0)return '';const m=Math.floor(s/60),r=Math.round(s-60*m);return m?`${m} min${r?` ${r} s`:''}`:`${r} s`;}
 return {DEFAULTS,plagesPN,lignesDeInstantane,signaux,noter,classer,plages,compacter,liste,duree};
});
