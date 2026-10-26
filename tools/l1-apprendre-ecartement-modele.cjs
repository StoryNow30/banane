'use strict';
/* Modèle ESSAYÉ puis ÉCARTÉ (fiches/L1_APPRENTISSAGE.md § 4) : sélection des paires par régression logistique sur tous les Échos, avec paires
 * ramenées à 1 435 mm. Gardé pour la reproductibilité de l'essai (tools/l1-apprendre-ecartement.cjs) ; l'extension ne le charge pas. */
module.exports=(function(){
 /* 4.9.5.14 (test 14, fiches/L1_APPRENTISSAGE.md) — DÉCISION « L1-e » D'UN DIFFÉRÉ, APPRISE SUR TOUS LES ÉCHOS. MODULE PUR : ni DOM, ni ESV.
  *
  * Constat (Échos des parties 2:17 à 2:19) : l'opérateur pose ses paires à un écartement presque fixe (médiane 1 433 à 1 437 mm, 80 % entre
  * 1 430 et 1 447 mm), alors que la GCV2 de la test 13 retient des paires jusqu'à 1 470 mm (contrat du moteur) ou à la médiane des cuts que le lot
  * vient de valider, médiane elle-même fausse quand la chaîne du lot s'est trompée de 30 mm sur un rail (2:19 : 1 465 mm). Sur 2:19, le rail droit de
  * la GCV2 est juste (médiane 1,8 mm) et le gauche faux de 28 mm, toujours du même côté : aucune hypothèse du nuage ne tombe sur la pose de
  * l'opérateur, qui est à l'écartement de convention depuis le rail droit.
  *
  * Décision L1-e, sur les MÊMES hypothèses et les MÊMES probabilités (modèle figé de la GCV2) que L1 :
  *   1. candidats : toutes les paires d'hypothèses (sauf la paire de départ) dont l'écartement est à `fenetreMm` au plus de la convention ; et la
  *      même paire RAMENÉE à l'écartement de convention en déplaçant en travers le rail le moins probable (`rameneeMaxMm` au plus) ;
  *   2. score : régression logistique apprise sur les Échos (étiquette : les deux rails à 10 mm au plus de l'opérateur) sur des traits lisibles
  *      (probabilités des deux rails, écart à la convention, rail ramené, zone, ampleur du déplacement, origines) ;
  *   3. on agit (pose ET validation) sur le meilleur candidat si son score atteint τ et s'il déplace la pose d'au moins `deplacementMinMm` ;
  *      sinon rien (le cut reste différé). Plus de « pose sans validation » : sur 2:19, 8 de ces 9 poses restaient à plus de 50 mm.
  * Un rail ramené n'est posé que si le nuage le soutient à sa nouvelle place (`soutien`, mêmes seuils que H6 : 5 points de dessus, 3 de flanc) :
  * aucune pose sans preuve dans le nuage. Paramètres figés : `datasets/gcv2-l1e-parametres.json` (copie `src/gcv2-parametres-l1e.js`). */
 const SIDES=['left','right'];
 const FORMAT='ariane-gcv2-l1e-parametres-v1',VERSION='gcv2-l1e-1';
 const REGLAGE_DEFAUT=Object.freeze({ecartementConventionMm:1435,fenetreMm:60,rameneeMaxMm:40,deplacementMinMm:2,soutienDessus:5,soutienFlanc:3});
 const NOMS_TRAITS=Object.freeze(['logPPaire','logPGarde','logPAutre','ecartConventionMm','horsContrat','ramenee','rameneeMm','rameneeElargit','adv','pn','logDeplMax',
   'avecDepart','avecH1','avecH6','avecH2','logDessusMin','logFlancMin','soutenue','concurrents']);
 const CONTRAT_MM=Object.freeze([1420,1470]);
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const logp=p=>Math.log(Math.max(fini(p)?p:0,1e-4));
 const sigmoide=z=>z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
 const estDepart=h=>(h.o||'').split('+').includes('H0')||h.decal.every(x=>Math.abs(x)<0.75);

 /* Sens de variation de l'écartement quand le rail `s` va en travers (+1 ou −1), lu sur les hypothèses : `g` est l'écartement de l'hypothèse avec
  * l'autre rail à sa pose de départ. */
 function signe(c,s){
   const hs=c.rails[s].hyps,h0=hs.find(estDepart);
   if(h0&&fini(h0.g))for(const h of hs){const dl=h.decal[1]-h0.decal[1];if(Math.abs(dl)>5&&fini(h.g))return Math.sign((h.g-h0.g)/dl)||1;}
   return s==='left'?1:-1;
 }
 const ecartementPaire=(c,hl,hr)=>fini(c.G0)&&fini(hl.g)&&fini(hr.g)?c.G0+(hl.g-c.G0)+(hr.g-c.G0):null;
 /* Écartement (approximation au premier ordre, en travers seulement) d'une paire de décalages depuis la pose de départ. */
 function ecartementDecal(c,decal){
   if(!fini(c.G0))return null;
   return c.G0+signe(c,'left')*decal.left[1]+signe(c,'right')*decal.right[1];
 }

 /* Candidats d'un cas. `c` : { G0, zone, rails:{left:{hyps:[{decal,p,o,g}]},right:{…}} }. Rend [{ i, j, paire:{left,right}, g, ramenee, rameneeMm, rail }]. */
 function candidats(c,reglage=REGLAGE_DEFAUT){
   const Gc=reglage.ecartementConventionMm,Lh=c.rails.left.hyps,Rh=c.rails.right.hyps,out=[];
   if(!fini(c.G0)||!Lh.length||!Rh.length)return out;
   const sg={left:signe(c,'left'),right:signe(c,'right')};
   for(let i=0;i<Lh.length;i++)for(let j=0;j<Rh.length;j++){
     const hl=Lh[i],hr=Rh[j];
     if(estDepart(hl)&&estDepart(hr))continue;
     const g=ecartementPaire(c,hl,hr);
     if(!fini(g)||Math.abs(g-Gc)>reglage.fenetreMm)continue;
     const base={i,j,g,pl:hl.p,pr:hr.p,ol:hl.o||'',or:hr.o||''};
     out.push({...base,paire:{left:hl.decal.slice(),right:hr.decal.slice()},ramenee:false,rameneeMm:0,rail:null});
     const dg=Gc-g;
     if(Math.abs(dg)>1&&Math.abs(dg)<=reglage.rameneeMaxMm){
       const s=hl.p<=hr.p?'left':'right',paire={left:hl.decal.slice(),right:hr.decal.slice()};
       paire[s][1]=Math.round((paire[s][1]+dg/sg[s])*100)/100;
       out.push({...base,paire,ramenee:true,rameneeMm:Math.abs(dg),rail:s});
     }
   }
   return out;
 }
 /* Traits d'un candidat. `sup` : soutien du nuage de chaque rail à sa place dans le candidat, { left:{dessus,flanc}, right:{…} } ; `ctx` : contexte
  * du cas (`contexte`). Le rail « gardé » d'une paire ramenée est celui qui n'a pas bougé (le plus probable) ; d'une paire brute, le plus probable. */
 function traits(c,k,reglage=REGLAGE_DEFAUT,sup,ctx=contexte(c,reglage)){
   const deplMax=Math.max(...SIDES.map(s=>Math.hypot(k.paire[s][1],k.paire[s][2])));
   const o=(k.ol+'+'+k.or).split('+');
   const d=Math.min(...SIDES.map(s=>sup[s].dessus)),f=Math.min(...SIDES.map(s=>sup[s].flanc));
   const lg=Math.max(logp(k.pl),logp(k.pr)),la=Math.min(logp(k.pl),logp(k.pr));
   return [logp(k.pl)+logp(k.pr),lg,la,Math.abs(k.g-reglage.ecartementConventionMm),k.g<CONTRAT_MM[0]||k.g>CONTRAT_MM[1]?1:0,k.ramenee?1:0,k.rameneeMm,
     k.ramenee&&k.g<reglage.ecartementConventionMm?1:0,c.zone==='adv'?1:0,c.zone==='pn'?1:0,Math.log1p(deplMax),
     o.includes('H0')?1:0,o.includes('H1')?1:0,o.includes('H6')?1:0,o.includes('H2')?1:0,Math.log1p(d),Math.log1p(f),d>=reglage.soutienDessus&&f>=reglage.soutienFlanc?1:0,
     concurrents(ctx,k)];
 }
 /* Contexte d'un cas : les paires brutes les plus probables (pour compter les concurrentes d'un candidat). */
 function contexte(c,reglage=REGLAGE_DEFAUT){
   const ks=candidats(c,reglage).filter(k=>!k.ramenee).map(k=>({k,v:logp(k.pl)+logp(k.pr)})).sort((a,b)=>b.v-a.v);
   return {top:ks.slice(0,12)};
 }
 /* Paires brutes au plus à 1 (log) de la meilleure et à plus de 30 mm du candidat : l'ambiguïté du cas pour ce candidat. */
 function concurrents(ctx,k){
   if(!ctx.top.length)return 0;
   const best=ctx.top[0].v;let n=0;
   for(const x of ctx.top){if(x.v<best-1)break;const e=Math.max(...SIDES.map(s=>Math.hypot(...x.k.paire[s].map((v,i)=>v-k.paire[s][i]))));if(e>30)n++;}
   return n;
 }
 /* Soutien des deux rails d'un candidat, par la fonction `soutien(rail, decal)` → { dessus, flanc }. */
 const soutienCandidat=(k,soutien)=>Object.fromEntries(SIDES.map(s=>[s,soutien(s,k.paire[s])||{dessus:0,flanc:0}]));
 function score(P,x){let z=P.modele.intercept;for(let j=0;j<x.length;j++)z+=P.modele.coefficients[j]*x[j];return sigmoide(z);}
 /* Choix d'un cas : meilleur candidat (score), agir si score ≥ τ et déplacement suffisant ; un rail ramené sans soutien du nuage à sa nouvelle place
  * n'est jamais candidat. `soutien(rail, decal)` → { dessus, flanc } : calculé sur la capture dans l'extension et au banc, lu dans le diagnostic
  * hors ligne (`soutienDuDiagnostic`). */
 function choisir(c,P,soutien){
   const R=P.reglage||REGLAGE_DEFAUT,ctx=contexte(c,R);
   const ks=candidats(c,R).map(k=>{const sup=soutienCandidat(k,soutien);return {k,sup,s:score(P,traits(c,k,R,sup,ctx))};}).sort((a,b)=>b.s-a.s);
   for(const x of ks){
     const k=x.k;
     if(k.ramenee){const m=x.sup[k.rail];if(!(m.dessus>=R.soutienDessus&&m.flanc>=R.soutienFlanc))continue;}
     const depl=Math.max(...SIDES.map(s=>Math.hypot(k.paire[s][1],k.paire[s][2])));
     const agir=x.s>=P.tau&&depl>=R.deplacementMinMm;
     return {candidat:k,score:Math.round(x.s*1e4)/1e4,agir,motif:agir?null:(x.s<P.tau?'sous-tau':'sous-deplacement')};
   }
   return {candidat:null,score:null,agir:false,motif:'aucun-candidat'};
 }
 /* Soutien lu dans une ligne de diagnostic (tools/l1-diag-hypotheses.cjs : `soutiens`, clé `rail|latéral|vertical`). */
 const soutienDuDiagnostic=c=>(s,d)=>{const v=c.soutiens&&c.soutiens[`${s}|${d[1].toFixed(2)}|${d[2].toFixed(2)}`];return v?{dessus:v[0],flanc:v[1]}:null;};
 /* Paramètres figés (fichier exporté par tools/l1-apprendre-ecartement.cjs) : contrôle de forme. */
 function parametres(P){
   if(!P||P.format!==FORMAT)throw Error(`paramètres L1-e : format ${FORMAT} attendu`);
   if(JSON.stringify(P.noms)!==JSON.stringify(NOMS_TRAITS))throw Error('paramètres L1-e : traits différents de ceux du module : refus');
   if(!P.modele||P.modele.coefficients.length!==NOMS_TRAITS.length||!fini(P.tau))throw Error('paramètres L1-e : modèle ou seuil absent');
   return {...P,reglage:{...REGLAGE_DEFAUT,...P.reglage}};
 }
 return {FORMAT,VERSION,REGLAGE_DEFAUT,NOMS_TRAITS,CONTRAT_MM,contexte,concurrents,signe,ecartementPaire,ecartementDecal,candidats,traits,score,choisir,parametres,estDepart,
   soutienCandidat,soutienDuDiagnostic};
})();
