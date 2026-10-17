#!/usr/bin/env node
'use strict';
/*
 * hauteur-apprise.cjs — la meilleure correction de HAUTEUR possible, en ombre (5.0, fiche fiches/HAUTEUR_APPRISE.md).
 *
 * 70 des 85 faux verts relus viennent de la hauteur du rail ; l'opérateur garde le minimum d'Ariane et ne corrige que la hauteur
 * (fiches/FAUX_VERTS.md). L'outil cherche, sur TOUS les cuts posés avec une référence, le modèle de correction verticale qui réduit
 * les faux verts sans en créer.
 *
 *   extraire : pour chaque cut POSÉ d'une partie, les signaux du moment de la décision, calculés PAR LE MODULE DE L'EXTENSION
 *              (`src/hauteur-apprise.js` `signaux`) sur la capture du lot, la science du cut du journal et la pose posée : groupe du
 *              rail (calage de convention appliqué ou refusé), décalages du calage, épaisseur et nombre de points du dessus, points
 *              de flanc ; plus l'étage, la version du lot et la forme du rail. La référence humaine (correction de l'opérateur) est
 *              rangée à part (`jugement`) : les signaux ne la lisent jamais (essai anti-fuite).
 *   etudier  : familles de modèles (aucun, P8 à 3,6 mm, P8 appris, linéaire « a + b × épaisseur » par groupe, par morceaux), chacune
 *              sous une ENVELOPPE (part de la correction appliquée par groupe, plafond) qui permet l'abstention. Validation croisée
 *              par partie : apprendre sur 3 parties (chacune pèse autant), juger la 4e. Deux lectures : IMBRIQUÉE (l'enveloppe est
 *              aussi choisie sur les 3 parties d'apprentissage : estimation honnête) et ENVELOPPE FIXE (celle choisie sur les
 *              4 parties, coefficients appris sur 3). Mesures par partie : faux verts avant et après, corrigés, nouveaux, transitions
 *              franches au-delà du bruit vertical de la référence (fiches/BRUIT_REFERENCE.md), cuts à plus de 5 mm, décalage vertical
 *              médian à la pose de l'opérateur, sensibilité au seuil (9 et 11 mm). Comparaison avec P8.
 *   preuve   : « l'ombre est sans effet », sur un lot réel : chaque cut redécidé dans l'ordre du lot avec les réglages livrés, puis
 *              sans `hauteurApprise` : décision (moins la clé) et commande identiques octet pour octet. Le chemin d'activation est
 *              aussi ouvert, POUR L'ESSAI SEULEMENT, pour vérifier qu'il ne change que la hauteur d'une commande qui pose.
 *
 * Usage :
 *   node tools/hauteur-apprise.cjs extraire --partie PROJET:PARTIE --jeu JEU.jsonl --journal JOURNAL.json --corpus SEG.json [...] [--sortie CAS.jsonl]
 *   node tools/hauteur-apprise.cjs etudier --cas CAS1.jsonl --cas CAS2.jsonl ... [--penalite 10] [--json SORTIE.json]
 *   node tools/hauteur-apprise.cjs preuve --partie PROJET:PARTIE --jeu JEU.jsonl --journal JOURNAL.json --corpus SEG.json [...] [--json SORTIE.json]
 *
 * Sorties : numéros de partie et de cut, millimètres, comptes. Jamais de coordonnée absolue ni d'identifiant de projet.
 * Les entrées (lots, jeux) restent hors du dépôt. Manifeste des parties (B1) : une partie réservée est refusée.
 */
const fs=require('node:fs');
const FVT=require('./faux-verts.cjs');
const HA=require('../src/hauteur-apprise.js');
const L=require('../src/lot-decision.js');
const K=require('../src/core.js');
const Shadow=require('../src/gcv1-shadow.js');
const Settings=require('../src/settings.js');
const Manifeste=require('./manifeste-parties.cjs');

const FORMAT_CAS='ariane-hauteur-apprise-cas-v1',FORMAT_ETUDE='ariane-hauteur-apprise-etude-v1';
const SIDES=['left','right'],FR={left:'gauche',right:'droite'};
const SEUIL_FAUX_MM=10;
/* Bruit vertical d'une pose de référence, par axe (fiches/BRUIT_REFERENCE.md : 2,0 à 2,1 mm parties 29 et 1 du second projet,
 * 3,8 à 4,1 mm parties 24 et 17 ; borne haute de la cohérence entre voisins, 2,3 mm, pour une partie non mesurée). */
const BRUIT_VERTICAL_MM=Object.freeze({'1:17':3.9,'1:24':3.9,'1:29':2.05,'2:1':2.05});
const BRUIT_DEFAUT_MM=2.3;
const P8_MM=3.6;
const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
const r2=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
const med=a=>{const b=a.filter(Number.isFinite).sort((x,y)=>x-y);return b.length?(b.length%2?b[b.length>>1]:(b[b.length/2-1]+b[b.length/2])/2):null;};
const cle=p=>p.projet+':'+p.partie;

/* ================================================================== lecture */
const lireJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const lireLignes=p=>fs.readFileSync(p,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
function chargerCaptures(fichiers,garder){
  const caps=new Map();
  for(const f of fichiers){const seg=lireJson(f);
    for(const c of seg.clouds||[])if((!garder||garder.has(c.cut))&&c.rails?.left&&c.rails?.right)
      caps.set(c.cut,{identity:c.identity,rails:c.rails,pointsSceneRelative:c.pointsSceneRelative,visibleByClipBoxes:c.visibleByClipBoxes,
        camera:c.camera,viewCaptures:(c.viewCaptures||[]).map(v=>({camera:v&&v.camera}))});}
  return caps;
}
const deplacement=x=>Object.fromEntries(SIDES.map(s=>{const d=x.traits?.deplacementAriane?.[FR[s]];return [s,d&&d.repere==='profil'?[d.lateralMm,d.verticalMm]:null];}));
const positionsDe=(cap,A)=>Object.fromEntries(SIDES.map(s=>[s,L.positionOf(cap.rails[s],[0,A[s][0]/1000,A[s][1]/1000])]));

/* ================================================================== extraire */
function extraire({designation,jeu,journal,captures}){
  const entete=jeu.find(l=>l.type==='entete')||null,J=FVT.lireJournal(journal);
  const rang=new Map(J.ordre.map((c,i)=>[c,i]));
  const cas=[];
  for(const x of jeu.filter(l=>l.type==='cut'&&l.classe==='posee')){
    const cut=x.cut,cap=captures.get(cut)||null,A=deplacement(x),sh=J.shadow.get(cut)||null,b1=J.b1.get(cut)||null;
    const etage=b1?.reel?.stage??null;
    let signaux=null,ombre=null;
    if(cap&&A.left&&A.right&&sh?.shadow?.rails){
      /* La décision telle que l'extension la voit : étage du journal, pose posée. */
      const decision={stage:etage,positions:positionsDe(cap,A)},science={rails:sh.shadow.rails};
      signaux=HA.signaux({capture:cap,science,decision})?.rails??null;
      const e=HA.evaluer({capture:cap,science,decision});
      ombre=e?Object.fromEntries(SIDES.map(s=>[s,{correctionMm:e.rails[s].correctionMm,abstention:e.rails[s].abstention}])):null;
    }
    const lab=FVT.reference(x);
    cas.push({format:FORMAT_CAS,partie:{...designation},cut,rang:rang.get(cut)??null,etage,version:entete?.source?.version??null,
      forme:cap?.identity?.shape??null,signaux,ombre,
      jugement:{avecReference:lab.avecReference,parRegleVisite:lab.parRegleVisite,fauxVert:lab.fauxVert,
        correctionMm:lab.avecReference?Object.fromEntries(SIDES.map(s=>[s,lab.corr[s]?lab.corr[s].map(r2):null])):null}});
  }
  const ent={format:FORMAT_CAS,type:'entete',partie:{...designation},version:entete?.source?.version??null,posesAuJeu:cas.length,
    avecSignaux:cas.filter(c=>c.signaux).length,avecReference:cas.filter(c=>c.jugement.avecReference).length,
    note:'signaux du moment de la décision (module src/hauteur-apprise.js) ; référence humaine à part ; aucune coordonnée absolue'};
  return {entete:ent,cas};
}

/* ================================================================== modèles */
/* Les rails d'étude : un par rail jugé d'un cut posé avec référence et signaux. */
function railsEtude(cas){
  const out=[];
  for(const c of cas){if(c.type==='entete'||!c.jugement?.avecReference||!c.signaux)continue;
    for(const s of SIDES){const k=c.jugement.correctionMm?.[s],g=c.signaux[s];if(!k||!g)continue;
      out.push({partie:cle(c.partie),cut:c.cut,side:s,etage:c.etage,groupe:g.groupe,ep:g.epaisseurDessusMm,n:g.pointsDessus,v:k[1],l:k[0],d3:k[2]});}}
  return out;
}
const parParties=cas=>{const o={};for(const c of cas){if(c.type==='entete')continue;(o[cle(c.partie)]=o[cle(c.partie)]||[]).push(c);}
  for(const p of Object.keys(o))o[p].sort((a,b)=>a.cut-b.cut);return o;};
/* Médiane des médianes par partie : chaque partie pèse autant. */
const medParPartie=(R,f)=>med([...new Set(R.map(r=>r.partie))].map(p=>med(R.filter(r=>r.partie===p).map(f))));
const utilisable=r=>r.groupe&&Number.isFinite(r.ep)&&Number.isFinite(r.n)&&r.n>=HA.MODELE.pointsDessusMin;
/* Droite « v = a + b × épaisseur » par groupe : pente des moindres carrés, ordonnée = médiane des résidus (robuste). */
function droite(X){
  if(X.length<5)return null;
  const mx=X.reduce((a,r)=>a+r.ep,0)/X.length,my=X.reduce((a,r)=>a+r.v,0)/X.length,sxx=X.reduce((a,r)=>a+(r.ep-mx)**2,0);
  const b=sxx?X.reduce((a,r)=>a+(r.ep-mx)*(r.v-my),0)/sxx:0;
  return {a:med(X.map(r=>r.v-b*r.ep)),b};
}
const BORNES_MORCEAUX=Object.freeze([0,8,10,12,14,Infinity]);
/* Familles : rails d'apprentissage -> modèle (objet pur). */
const FAMILLES={
  aucun:()=>({type:'aucun'}),
  /* P8 (D-140) : +3,6 mm sur les rails refusés, quel que soit l'étage, rien sur les rails calés. */
  p8:()=>({type:'constante',refuse:P8_MM,applique:0,tousEtages:true}),
  /* P8 appris : la médiane (par partie) de la correction des rails refusés. */
  p8Appris:R=>({type:'constante',refuse:r2(medParPartie(R.filter(r=>r.groupe==='refuse'),r=>r.v))??0,applique:0,tousEtages:true}),
  lineaire:R=>{const X=R.filter(utilisable),m={type:'lineaire'};for(const g of ['applique','refuse'])m[g]=droite(X.filter(r=>r.groupe===g))||{a:0,b:0};return m;},
  morceaux:R=>{const X=R.filter(utilisable),m={type:'morceaux',bornes:BORNES_MORCEAUX.slice()};
    for(const g of ['applique','refuse'])m[g]=BORNES_MORCEAUX.slice(0,-1).map((b,i)=>{const Y=X.filter(r=>r.groupe===g&&r.ep>=b&&r.ep<BORNES_MORCEAUX[i+1]);return Y.length>=5?r2(medParPartie(Y,r=>r.v)):0;});
    return m;},
};
const NOMS_FAMILLES=Object.freeze(Object.keys(FAMILLES));
/* Le modèle linéaire sous une enveloppe, au format du module de l'extension. */
const versModule=(m,env)=>({...HA.MODELE,plafondMm:env.plafondMm,applique:{a:m.applique.a,b:m.applique.b,part:env.partApplique},refuse:{a:m.refuse.a,b:m.refuse.b,part:env.partRefuse}});
/* Correction (mm) d'un rail d'étude par un modèle sous une enveloppe. Le linéaire passe par le module : même calcul que l'extension. */
function correcteur(m,env){
  if(m.type==='lineaire'||(!m.type&&m.applique&&Number.isFinite(m.applique.a))){
    const mod=versModule(m,env);
    return r=>HA.correctionRail({groupe:r.groupe,epaisseurDessusMm:r.ep,pointsDessus:r.n},r.etage,mod).correctionMm;
  }
  const borne=k=>{const v=Math.sign(k)*Math.min(Math.abs(k),env.plafondMm);return r1(v)||0;};
  return r=>{
    if(m.type==='aucun')return 0;
    const part=r.groupe==='refuse'?env.partRefuse:r.groupe==='applique'?env.partApplique:0;if(!part)return 0;
    if(m.type==='constante'){if(!m.tousEtages&&!HA.MODELE.etages.includes(r.etage))return 0;return borne(part*(m[r.groupe]||0));}
    if(m.type==='morceaux'){if(!HA.MODELE.etages.includes(r.etage)||!utilisable(r))return 0;
      const i=m.bornes.findIndex((b,j)=>r.ep>=b&&r.ep<m.bornes[j+1]);return i<0?0:borne(part*(m[r.groupe][i]||0));}
    return 0;
  };
}
/* Bilan d'une partie : faux verts avant/après (plus grand des deux rails, 3D, la latérale ne bouge pas), corrigés, nouveaux. */
function bilan(cas,corr,{bruitMm=BRUIT_DEFAUT_MM,seuilMm=SEUIL_FAUX_MM}={}){
  let avant=0,apres=0,corriges=0,nouveaux=0,corrigesFrancs=0,nouveauxFrancs=0,sup5Avant=0,sup5Apres=0,touches=0;const va=[],vb=[],m3a=[],m3b=[];
  for(const c of railsParCut(cas)){
    let m0=0,m1=0,touche=false;
    for(const r of c.rails){const k=corr(r)||0;if(k)touche=true;const v1=r.v-k;m0=Math.max(m0,r.d3);m1=Math.max(m1,Math.sqrt(Math.max(r.d3**2-r.v**2,0)+v1*v1));va.push(Math.abs(r.v));vb.push(Math.abs(v1));}
    touches+=touche;
    avant+=m0>seuilMm;apres+=m1>seuilMm;corriges+=m0>seuilMm&&m1<=seuilMm;nouveaux+=m0<=seuilMm&&m1>seuilMm;
    corrigesFrancs+=m0>seuilMm+bruitMm&&m1<seuilMm-bruitMm;nouveauxFrancs+=m0<seuilMm-bruitMm&&m1>seuilMm+bruitMm;
    sup5Avant+=m0>5;sup5Apres+=m1>5;m3a.push(m0);m3b.push(m1);
  }
  return {cuts:m3a.length,cutsTouches:touches,fauxVertsAvant:avant,fauxVertsApres:apres,corriges,nouveaux,corrigesFrancs,nouveauxFrancs,bruitMm,
    sup5Avant,sup5Apres,medianeVerticaleAvantMm:r2(med(va)),medianeVerticaleApresMm:r2(med(vb)),medianeCutAvantMm:r2(med(m3a)),medianeCutApresMm:r2(med(m3b))};
}
function railsParCut(cas){
  const R=railsEtude(cas),o=new Map();for(const r of R){const k=r.partie+'|'+r.cut;if(!o.has(k))o.set(k,{rails:[]});o.get(k).rails.push(r);}
  return [...o.values()];
}
/* Enveloppes essayées : part appliquée aux rails calés et aux rails refusés, plafond. Part 0 = abstention sur ce groupe. */
const GRILLE=Object.freeze((()=>{const g=[];for(const partApplique of [0,0.25,0.5,0.75,1])for(const partRefuse of [0,0.5,0.75,1])for(const plafondMm of [3,4,5,6,8,99])g.push({partApplique,partRefuse,plafondMm});return g;})());
const bruitDe=p=>BRUIT_VERTICAL_MM[p]??BRUIT_DEFAUT_MM;
/* Score d'apprentissage : faux verts après − avant + pénalité × nouveaux, somme sur les parties (chacune compte pour ses cuts). */
function choisirEnveloppe(pp,m,penalite){
  let best=null;
  for(const env of GRILLE){const f=correcteur(m,env);let score=0,nouveaux=0,apres=0,medV=0;
    for(const [p,X] of Object.entries(pp)){const b=bilan(X,f,{bruitMm:bruitDe(p)});score+=b.fauxVertsApres-b.fauxVertsAvant+penalite*b.nouveaux;nouveaux+=b.nouveaux;apres+=b.fauxVertsApres;medV+=b.medianeVerticaleApresMm;}
    if(!best||score<best.score-1e-9||(Math.abs(score-best.score)<1e-9&&medV<best.medV-1e-9))best={score,env,nouveaux,apres,medV};}
  return best;
}
const sommer=L=>{const t={};for(const b of L)for(const [k,v] of Object.entries(b))if(typeof v==='number'&&!/mediane|bruit/i.test(k))t[k]=(t[k]||0)+v;return t;};
/* Validation croisée par partie. `enveloppe` fixée : seuls les coefficients sont appris sur les 3 autres parties ; sinon elle est
 * aussi choisie sur elles (imbriquée). */
function validationCroisee(pp,famille,{penalite=10,enveloppe=null}={}){
  const parties=Object.keys(pp),parPartie=[];
  for(const p of parties){
    const autres=Object.fromEntries(parties.filter(q=>q!==p).map(q=>[q,pp[q]]));
    const m=FAMILLES[famille](railsEtude(Object.values(autres).flat()));
    const env=enveloppe||choisirEnveloppe(autres,m,penalite).env;
    const f=correcteur(m,env);
    parPartie.push({partie:p,modele:m,enveloppe:env,bilan:bilan(pp[p],f,{bruitMm:bruitDe(p)}),
      seuil9:bilan(pp[p],f,{bruitMm:bruitDe(p),seuilMm:9}),seuil11:bilan(pp[p],f,{bruitMm:bruitDe(p),seuilMm:11})});
  }
  return {parPartie,cumul:sommer(parPartie.map(x=>x.bilan)),cumul9:sommer(parPartie.map(x=>x.seuil9)),cumul11:sommer(parPartie.map(x=>x.seuil11))};
}
function enEchantillon(pp,m,env){
  const parPartie=Object.entries(pp).map(([p,X])=>({partie:p,bilan:bilan(X,correcteur(m,env),{bruitMm:bruitDe(p)})}));
  return {parPartie,cumul:sommer(parPartie.map(x=>x.bilan))};
}
function etudier(listes,{penalite=10}={}){
  const pp=parParties(listes.flat().filter(c=>c.type!=='entete'&&c.jugement?.avecReference));
  const parties=Object.keys(pp).sort();
  const tous=railsEtude(Object.values(pp).flat());
  const familles={};
  for(const f of NOMS_FAMILLES){
    const m=FAMILLES[f](tous),choix=choisirEnveloppe(pp,m,penalite);
    familles[f]={imbriquee:validationCroisee(pp,f,{penalite}),enveloppeFixe:{enveloppe:choix.env,...validationCroisee(pp,f,{enveloppe:choix.env})},
      quatreParties:{modele:m,enveloppe:choix.env,...enEchantillon(pp,m,choix.env)}};
  }
  /* Modèle retenu : la famille au meilleur score en validation croisée imbriquée (après − avant + pénalité × nouveaux), puis au plus
   * petit décalage vertical médian ; parmi celles qu'on sait poser en ombre (linéaire), sinon on le dit. */
  const score=f=>{const c=familles[f].imbriquee.cumul;return c.fauxVertsApres-c.fauxVertsAvant+penalite*c.nouveaux;};
  const medApres=f=>med(familles[f].imbriquee.parPartie.map(x=>x.bilan.medianeVerticaleApresMm));
  const classement=NOMS_FAMILLES.slice().sort((a,b)=>score(a)-score(b)||medApres(a)-medApres(b));
  const fam='lineaire',q=familles[fam].quatreParties;
  const modele={plafondMm:q.enveloppe.plafondMm,pointsDessusMin:HA.MODELE.pointsDessusMin,etages:[...HA.MODELE.etages],
    applique:{a:r2(q.modele.applique.a),b:r2(q.modele.applique.b),part:q.enveloppe.partApplique},
    refuse:{a:r2(q.modele.refuse.a),b:r2(q.modele.refuse.b),part:q.enveloppe.partRefuse}};
  /* Stabilité : coefficients et enveloppes des quatre plis. */
  const plis=familles[fam].imbriquee.parPartie.map(x=>({partie:x.partie,applique:{a:r2(x.modele.applique.a),b:r2(x.modele.applique.b)},refuse:{a:r2(x.modele.refuse.a),b:r2(x.modele.refuse.b)},enveloppe:x.enveloppe}));
  /* Le modèle figé (coefficients arrondis, tel que le module le porte), rejoué sur les quatre parties. */
  const fige={type:'lineaire',applique:{a:modele.applique.a,b:modele.applique.b},refuse:{a:modele.refuse.a,b:modele.refuse.b}};
  const envFige={partApplique:modele.applique.part,partRefuse:modele.refuse.part,plafondMm:modele.plafondMm};
  /* Comparaison avec P8 : P8 tel qu'il est consigné (3,6 mm sur les rails refusés, tous étages, sans plafond), et la hauteur apprise
   * restreinte à chacun de ses deux groupes (validation croisée, enveloppe retenue), pour voir d'où vient le gain. */
  const comparaisonP8={
    p8:enEchantillon(pp,FAMILLES.p8(),{partApplique:0,partRefuse:1,plafondMm:99}),
    hauteur:familles[fam].imbriquee,
    hauteurRefusesSeuls:validationCroisee(pp,fam,{enveloppe:{...envFige,partApplique:0}}),
    hauteurCalesSeuls:validationCroisee(pp,fam,{enveloppe:{...envFige,partRefuse:0}}),
  };
  return {format:FORMAT_ETUDE,parties,penalite,bruitVerticalMm:Object.fromEntries(parties.map(p=>[p,bruitDe(p)])),rails:tous.length,
    railsParGroupe:Object.fromEntries(['applique','refuse',null].map(g=>[String(g),tous.filter(r=>r.groupe===g).length])),
    familles,classement,retenu:{famille:fam,premierAuClassement:classement[0],modele,plis,figeEnEchantillon:enEchantillon(pp,fige,envFige)},comparaisonP8};
}
function texte(e){
  const T=[],b=x=>`${x.fauxVertsAvant}→${x.fauxVertsApres} (corrigés ${x.corriges}, nouveaux ${x.nouveaux} ; francs ${x.corrigesFrancs}/${x.nouveauxFrancs})`;
  const ligne=v=>v.parPartie.map(x=>`${x.partie} ${b(x.bilan)} vert. méd. ${x.bilan.medianeVerticaleAvantMm}→${x.bilan.medianeVerticaleApresMm}`).join(' | ');
  T.push('# Hauteur apprise : modèles de correction verticale','');
  T.push(`Parties : ${e.parties.join(', ')} ; ${e.rails} rails jugés (${Object.entries(e.railsParGroupe).map(([g,n])=>g+' '+n).join(', ')}) ; pénalité par nouveau faux vert : ${e.penalite}`);
  T.push(`Bruit vertical de la référence (transitions « franches » au-delà) : ${Object.entries(e.bruitVerticalMm).map(([p,v])=>p+' '+v+' mm').join(', ')}`,'');
  for(const [nom,f] of Object.entries(e.familles)){
    T.push(`## ${nom}`);
    const ci=f.imbriquee.cumul,cf=f.enveloppeFixe.cumul,cq=f.quatreParties.cumul;
    T.push(`  Validation croisée imbriquée : ${b(ci)} ; > 5 mm ${ci.sup5Avant}→${ci.sup5Apres} ; seuil 9 mm ${f.imbriquee.cumul9.fauxVertsAvant}→${f.imbriquee.cumul9.fauxVertsApres} (+${f.imbriquee.cumul9.nouveaux}), 11 mm ${f.imbriquee.cumul11.fauxVertsAvant}→${f.imbriquee.cumul11.fauxVertsApres} (+${f.imbriquee.cumul11.nouveaux})`);
    T.push('    '+ligne(f.imbriquee));
    T.push(`    enveloppes : ${f.imbriquee.parPartie.map(x=>x.partie+' '+JSON.stringify(x.enveloppe)).join(' ; ')}`);
    T.push(`  Validation croisée, enveloppe fixe ${JSON.stringify(f.enveloppeFixe.enveloppe)} : ${b(cf)}`);
    T.push('    '+ligne(f.enveloppeFixe));
    T.push(`  Quatre parties (en échantillon) : ${b(cq)} ; modèle ${JSON.stringify(f.quatreParties.modele)}`);
  }
  T.push('',`Classement (validation croisée imbriquée) : ${e.classement.join(' > ')}`);
  T.push('','## Modèle retenu (à figer, format du module)',JSON.stringify(e.retenu.modele));
  T.push('  plis : '+e.retenu.plis.map(x=>`${x.partie} appliqué ${x.applique.a}/${x.applique.b} refusé ${x.refuse.a}/${x.refuse.b} ${JSON.stringify(x.enveloppe)}`).join(' | '));
  T.push(`  modèle figé, quatre parties (en échantillon) : ${b(e.retenu.figeEnEchantillon.cumul)} — `+e.retenu.figeEnEchantillon.parPartie.map(x=>`${x.partie} ${b(x.bilan)}`).join(' | '));
  const c=e.comparaisonP8,lig=(nom,v)=>`  ${nom} : ${b(v.cumul)} ; > 5 mm ${v.cumul.sup5Avant}→${v.cumul.sup5Apres} ; cuts touchés ${v.cumul.cutsTouches} — `+v.parPartie.map(x=>`${x.partie} ${b(x.bilan)} vert. méd. ${x.bilan.medianeVerticaleApresMm}`).join(' | ');
  T.push('','## Comparaison avec P8 (3,6 mm constant sur les rails refusés)');
  T.push(lig('P8 tel que consigné (3,6 mm choisi sur 1:17, 1:24, 1:29)',c.p8));
  T.push(lig('hauteur apprise (validation croisée)',c.hauteur));
  T.push(lig('hauteur apprise, rails refusés seuls',c.hauteurRefusesSeuls));
  T.push(lig('hauteur apprise, rails calés seuls',c.hauteurCalesSeuls));
  return T.join('\n');
}

/* ================================================================== preuve « ombre sans effet » */
function avecGlobal(valeur,fn){
  const avant=Object.getOwnPropertyDescriptor(globalThis,'BananeSettings');globalThis.BananeSettings=valeur;
  try{return fn();}finally{if(avant)Object.defineProperty(globalThis,'BananeSettings',avant);else delete globalThis.BananeSettings;}
}
function preuve({jeu,journal,captures}){
  const J=FVT.lireJournal(journal),A=new Map(jeu.filter(x=>x.type==='cut'&&x.classe==='posee').map(x=>[x.cut,deplacement(x)]));
  const cache=new Map(),cleCap=c=>c.identity?.cut+'|'+SIDES.map(s=>c.rails[s].positionSceneRelative.map(v=>Math.round(v*1e6)).join(',')).join('|');
  const moteur={...Shadow,scientificProposeBoth(c){const k=cleCap(c);if(!cache.has(k))cache.set(k,Shadow.scientificProposeBoth(c));return cache.get(k);}};
  const livre={...Settings},sans={...Settings,hauteurApprise:undefined},ouvert={...Settings,hauteurApprise:{...Settings.hauteurApprise,appliquer:true}};
  const st={cuts:0,decisionsIdentiques:0,commandesIdentiques:0,consignes:0,railsCorriges:0,railsAbstenus:{},correctionsMm:[],etagesConformesAuJournal:0,
    activationOuverte:{hauteurSeulement:0,commandesInchangees:0,posesAjoutees:0,autres:0,ecartMaxMm:0},ecarts:[]};
  const anchors=[];
  for(const cut of J.ordre){
    const cap=captures.get(cut),sh=J.shadow.get(cut),prop=J.proposed.get(cut);
    if(!cap||!sh?.shadow?.rails||!prop?.proposal?.rails)continue;
    const identity=K.completeIdentity(cap.identity);
    const args={capture:{identity,rails:cap.rails,pointsSceneRelative:cap.pointsSceneRelative,visibleByClipBoxes:cap.visibleByClipBoxes},
      science:{rails:sh.shadow.rails,summary:sh.shadow.summary},anchors:anchors.slice(),Shadow:moteur};
    const dSans=avecGlobal(sans,()=>L.decideCut(args)),dAvec=avecGlobal(livre,()=>L.decideCut(args));
    const {hauteurApprise,...reste}=dAvec;
    st.cuts++;
    if(hauteurApprise){st.consignes++;for(const s of SIDES){const r=hauteurApprise.rails[s];if(r.correctionMm!==0){st.railsCorriges++;st.correctionsMm.push(r.correctionMm);}
      if(r.abstention)st.railsAbstenus[r.abstention]=(st.railsAbstenus[r.abstention]||0)+1;}}
    const memeD=JSON.stringify(reste)===JSON.stringify(dSans);if(memeD)st.decisionsIdentiques++;else if(st.ecarts.length<10)st.ecarts.push({cut,quoi:'decision'});
    if(dSans.stage===J.b1.get(cut)?.reel?.stage)st.etagesConformesAuJournal++;
    const cameras=L.viewCameras(cap);
    const cmd=(d,g)=>avecGlobal(g,()=>L.commandRails({decision:d,runtimeRails:prop.proposal.rails,before:cap.rails,expectedPoses:K.expectedPoses,cameras}));
    const cSans=JSON.stringify(cmd(dSans,sans)),cAvec=JSON.stringify(cmd(dAvec,livre));
    if(cSans===cAvec)st.commandesIdentiques++;else if(st.ecarts.length<10)st.ecarts.push({cut,quoi:'commande'});
    /* Chemin ouvert (essai seulement) : la même commande, seule la hauteur des rails d'une commande qui pose a pu bouger. */
    const o=cmd(dAvec,ouvert),cs=JSON.parse(cSans);
    const pose=c=>c.action==='lot'||(c.action==='engine'&&SIDES.every(x=>c.rails?.[x]?.status==='candidate'));
    if(JSON.stringify(o)===cSans)st.activationOuverte.commandesInchangees++;
    else if(pose(o)&&!pose(cs))st.activationOuverte.posesAjoutees++;
    else if(o.action===cs.action&&pose(cs)&&SIDES.every(s=>{const a=o.rails[s].delta,b=cs.rails[s].delta;return a[0]===b[0]&&a[1]===b[1]&&Math.abs(a[2]-b[2])<=HA.MODELE.plafondMm/1000+1e-12;})){
      st.activationOuverte.hauteurSeulement++;
      for(const s of SIDES)st.activationOuverte.ecartMaxMm=Math.max(st.activationOuverte.ecartMaxMm,r2(Math.abs(o.rails[s].delta[2]-cs.rails[s].delta[2])*1000));}
    else st.activationOuverte.autres++;
    const a=A.get(cut);
    if(J.poses.has(cut)&&a?.left&&a?.right)L.rememberAnchor(anchors,{identity:{part:identity.part,cut,frameId:identity.frameId??null},positions:positionsDe(cap,a),stage:'posee'},40);
  }
  const c=st.correctionsMm;st.correctionsMm={n:c.length,medianeMm:r2(med(c)),minMm:c.length?Math.min(...c):null,maxMm:c.length?Math.max(...c):null,
    vers_le_haut:c.filter(v=>v>0).length,vers_le_bas:c.filter(v=>v<0).length};
  st.sansEffet=st.decisionsIdentiques===st.cuts&&st.commandesIdentiques===st.cuts&&st.activationOuverte.posesAjoutees===0&&st.activationOuverte.autres===0;
  return st;
}

/* ================================================================== CLI */
function lireOptions(argv){
  const o={corpus:[],cas:[]};
  for(let i=0;i<argv.length;i++){const a=argv[i],v=()=>argv[++i];
    if(a==='--partie')o.partie=v();else if(a==='--jeu')o.jeu=v();else if(a==='--journal')o.journal=v();else if(a==='--corpus')o.corpus.push(v());
    else if(a==='--sortie')o.sortie=v();else if(a==='--cas')o.cas.push(v());else if(a==='--json')o.json=v();else if(a==='--penalite')o.penalite=Number(v());
    else if(a==='--juger-partie-reservee')o.jugerReservee=true;else if(!o.commande)o.commande=a;else throw Error('option inconnue : '+a);}
  return o;
}
function controlerPartie(o){
  const des=Manifeste.lireDesignations(o.partie);if(des.length!==1)throw Error(o.commande+' : une seule partie à la fois');
  const {avis}=Manifeste.controler(Manifeste.lire(),des,{outil:'hauteur-apprise',jugerReservee:!!o.jugerReservee});if(avis)console.error(avis);
  return des[0];
}
function main(argv){
  const o=lireOptions(argv);
  if(o.commande==='extraire'||o.commande==='preuve'){
    if(!o.partie||!o.jeu||!o.journal||!o.corpus.length)throw Error(o.commande+' : --partie, --jeu, --journal et --corpus sont obligatoires');
    const des=controlerPartie(o),jeu=lireLignes(o.jeu);
    if(o.commande==='extraire'){
      const cuts=new Set(jeu.filter(l=>l.type==='cut'&&l.classe==='posee').map(l=>l.cut));
      const r=extraire({designation:des,jeu,journal:lireJson(o.journal),captures:chargerCaptures(o.corpus,cuts)});
      const sortie=[r.entete,...r.cas].map(x=>JSON.stringify(x)).join('\n')+'\n';
      if(o.sortie)fs.writeFileSync(o.sortie,sortie);else process.stdout.write(sortie);
      console.error(`hauteur-apprise : partie ${o.partie}, ${r.cas.length} cuts posés, ${r.entete.avecReference} avec référence, ${r.entete.avecSignaux} avec signaux`);
      return;
    }
    const r=preuve({jeu,journal:lireJson(o.journal),captures:chargerCaptures(o.corpus,null)});
    const out={partie:des,...r};if(o.json)fs.writeFileSync(o.json,JSON.stringify(out,null,1));console.log(JSON.stringify(out));return;
  }
  if(o.commande==='etudier'){
    if(!o.cas.length)throw Error('etudier : --cas au moins une fois');
    const e=etudier(o.cas.map(lireLignes),{penalite:Number.isFinite(o.penalite)?o.penalite:10});
    if(o.json)fs.writeFileSync(o.json,JSON.stringify(e,null,1));
    console.log(texte(e));return;
  }
  throw Error('commande attendue : extraire, etudier ou preuve');
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exit(1);}}
module.exports={FORMAT_CAS,FORMAT_ETUDE,SEUIL_FAUX_MM,BRUIT_VERTICAL_MM,GRILLE,FAMILLES,extraire,railsEtude,parParties,correcteur,bilan,
  choisirEnveloppe,validationCroisee,etudier,texte,preuve,main};
