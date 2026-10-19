#!/usr/bin/env node
'use strict';
/*
 * faux-verts.cjs — comprendre et réduire les faux verts (5.0, chantier « faux verts », fiche fiches/FAUX_VERTS.md).
 *
 * Un FAUX VERT est un cut qu'Ariane a posé et validé et que l'opérateur a corrigé de plus de 10 mm (3D, plus grand des deux
 * rails, repère profil ; même définition que G0). L'outil a deux étapes.
 *
 *   extraire : pour chaque cut POSÉ d'une partie, relit la science du cut dans le lot (journal Orbite : proposition du moteur,
 *              ombre GCV1 complète, décision sur le lot) et rejoue sur le nuage (corpus GCV1) ce qui ne s'y trouve pas :
 *              bande des points du dessus et du flanc à la pose posée, écart à la voie des cuts posés AVANT lui dans le lot,
 *              verdict de l'ombre `src/faux-vert-ombre.js` (le même calcul que l'extension). Ce sont les SIGNAUX : ils ne lisent
 *              que ce qu'Ariane avait au moment de la décision. Pour les faux verts seulement, l'outil relit ensuite la grille
 *              du moteur autour de la pose de l'opérateur (DIAGNOSTIC : où était la bonne pose, était-elle un minimum de la
 *              grille, dans la fenêtre, que disait le calage). Le jugement (référence humaine) vient du jeu d'apprentissage E5.
 *   etudier  : typologie des faux verts par cause, pouvoir de séparation de chaque signal (AUC par partie, rappel à taux fixe
 *              de bons verts différés en validation croisée par partie : appris sur les autres parties, jugé sur la dernière),
 *              et bilan de la règle de l'ombre (faux verts évités, bons verts différés en plus, bilan net), par partie.
 *
 * Usage :
 *   node tools/faux-verts.cjs extraire --partie PROJET:PARTIE --jeu JEU.jsonl --journal JOURNAL.json --corpus SEG.json [...]
 *        [--aiguilles 136,287,...] [--sortie CAS.jsonl] [--juger-partie-reservee]
 *   node tools/faux-verts.cjs etudier --cas CAS1.jsonl --cas CAS2.jsonl ... [--json SORTIE.json]
 *   node tools/faux-verts.cjs preuve --partie PROJET:PARTIE --jeu JEU.jsonl --journal JOURNAL.json --corpus SEG.json [...] [--json SORTIE.json]
 *
 *   preuve   : « l'ombre est sans effet », sur un lot réel. Chaque cut du lot est redécidé dans l'ordre du lot (science du journal,
 *              appuis = cuts déjà posés du lot), avec les réglages livrés puis sans le réglage `fauxVertOmbre` : la décision (moins
 *              la clé `fauxVertOmbre`) et la commande doivent être identiques, octet pour octet. Le chemin d'activation est aussi
 *              ouvert, POUR L'ESSAI SEULEMENT, pour vérifier qu'il ne fait que différer des cuts que la commande allait poser.
 *
 * Sorties : numéros de partie et de cut, millimètres, comptes. Jamais de coordonnée absolue ni d'identifiant de projet.
 * Les entrées (lots, jeux) restent hors du dépôt. Manifeste des parties (B1) : une partie réservée est refusée.
 */
const fs=require('node:fs');
const C=require('../vendor/capture-core.js');
const L=require('../src/lot-decision.js');
const O=require('../src/continuity-observer.js');
const Conv=require('../src/placement-convention.js');
const Cand=require('../src/geometry-candidate-v1.js');
const FV=require('../src/faux-vert-ombre.js');
const Manifeste=require('./manifeste-parties.cjs');
const K=require('../src/core.js');
const Shadow=require('../src/gcv1-shadow.js');
const Settings=require('../src/settings.js');

const FORMAT_CAS='ariane-faux-verts-cas-v1',FORMAT_ETUDE='ariane-faux-verts-etude-v1';
const SIDES=['left','right'],FR={left:'gauche',right:'droite'};
const SEUIL_FAUX_MM=10,VISITE_BONNE_S=0.8,FENETRE_MOTEUR_MM=80,ZONE_CONTROLE_CUTS=3,VOISINS_CUTS=10;
const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
const r2=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
const quantile=(a,p)=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(p*b.length))];};
const maxN=v=>{const w=v.filter(Number.isFinite);return w.length?Math.max(...w):null;};
const minN=v=>{const w=v.filter(Number.isFinite);return w.length?Math.min(...w):null;};

/* ================================================================== lecture */
const lireJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const lireLignes=p=>fs.readFileSync(p,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
function lireJeu(lignes){
  const entete=lignes.find(l=>l.type==='entete')||null;
  return {entete,cuts:lignes.filter(l=>l.type==='cut')};
}
/* Journal Orbite : ordre du lot (premières propositions), dernière proposition, dernière ombre GCV1, dernière décision (b1-ombre,
 * champ `reel`), cuts validés, cuts différés jamais validés. */
function lireJournal(J){
  const ev=(J.events||[]).slice().sort((a,b)=>String(a.timestamp)<String(b.timestamp)?-1:String(a.timestamp)>String(b.timestamp)?1:0);
  const proposed=new Map(),shadow=new Map(),b1=new Map(),ordre=[],vus=new Set(),poses=new Set(),differes=new Set();
  for(const e of ev){const c=e.identity?.cut;if(!Number.isInteger(c))continue;
    if(e.type==='proposed'){proposed.set(c,e);if(!vus.has(c)){vus.add(c);ordre.push(c);}}
    else if(e.type==='gcv1-shadow-observed')shadow.set(c,e);
    else if(e.type==='b1-ombre')b1.set(c,e);
    else if(e.type==='validation-accepted')poses.add(c);
    else if(e.type==='defer-finalized')differes.add(c);}
  for(const c of poses)differes.delete(c);
  return {ordre,proposed,shadow,b1,poses,differes};
}
function chargerCaptures(fichiers,garder){
  const caps=new Map();
  for(const f of fichiers){const seg=lireJson(f);
    for(const c of seg.clouds||[])if((!garder||garder.has(c.cut))&&c.rails?.left&&c.rails?.right)
      caps.set(c.cut,{identity:c.identity,rails:c.rails,pointsSceneRelative:c.pointsSceneRelative,visibleByClipBoxes:c.visibleByClipBoxes,
        camera:c.camera,viewCaptures:(c.viewCaptures||[]).map(v=>({camera:v&&v.camera}))});}
  return caps;
}

/* ================================================================== jugement (référence humaine) */
/* Avec référence : validation observée, ou « visité sans action = bon » sur une visite d'au moins 0,8 s (règle de l'opérateur, D-138). */
function reference(x){
  const e=x.etiquette||{},rg=x.regleVisiteBon||{};
  const regle=rg.appliquee===true&&(rg.dwellMaxS??0)>=VISITE_BONNE_S;
  const avec=e.referenceHumaine==='observee'||regle;
  const corr={};
  for(const s of SIDES){const c=e.correctionMm?.[FR[s]];corr[s]=c&&c.repere==='profil'?[c.lateralMm,c.verticalMm,c.dist3dMm]:regle?[0,0,0]:null;}
  const fauxVert=avec&&(e.fauxVert===true||(regle&&rg.fauxVert===true));
  return {avecReference:avec,parRegleVisite:regle&&e.referenceHumaine!=='observee',fauxVert,corrige5mm:avec&&(e.corrige5mm===true||rg.corrige5mm===true),corr};
}

/* ================================================================== géométrie */
const deplacement=x=>Object.fromEntries(SIDES.map(s=>{const d=x.traits?.deplacementAriane?.[FR[s]];return [s,d&&d.repere==='profil'?[d.lateralMm,d.verticalMm]:null];}));
const positionsDe=(cap,A)=>Object.fromEntries(SIDES.map(s=>[s,L.positionOf(cap.rails[s],[0,A[s][0]/1000,A[s][1]/1000])]));
function bande(cap,side,latMm,vertMm){
  const b=Conv.bandOffsets(cap,side,[0,latMm/1000,vertMm/1000]);if(!b.ok)return null;
  const t=b.top,f=b.face;
  return {pointsDessus:t.length,pointsFlanc:f.length,epaisseurDessusMm:t.length?r1(quantile(t,.9)-quantile(t,.1)):null,
    p10DessusMm:r1(quantile(t,.1)),p90DessusMm:r1(quantile(t,.9))};
}
/* Écart CAUSAL à la voie des cuts posés AVANT ce cut dans le lot (même cadre, à `fenetre` cuts au plus, les deux plus proches). */
function ecartVoisins(cap,positions,anterieurs){
  if(!anterieurs.length)return null;
  const anchors=anterieurs.map(a=>({positions:a.positions})),d={};
  for(const s of SIDES){const init=cap.rails[s],M=init.sceneRelativeToProfileLocal,o=C.point(M,init.positionSceneRelative);
    const p=O.predict(init,anchors,s),q=C.point(M,positions[s]);d[s]=[(q[1]-o[1]-p.lateral)*1000,(q[2]-o[2]-p.vertical)*1000];}
  const g=P=>C.distance(P.left,P.right)*1000;
  return {lateralMm:r1(Math.max(Math.abs(d.left[0]),Math.abs(d.right[0]))),verticalMm:r1(Math.max(Math.abs(d.left[1]),Math.abs(d.right[1]))),
    deniveleMm:r1(Math.abs(d.left[1]-d.right[1])),sautEcartementMm:r1(Math.abs(g(positions)-g(anterieurs[0].positions)))};
}

/* ================================================================== signaux (moment de la décision) */
/* Tout ce qui suit est lu dans la science du cut (journal), la décision sur le lot, le nuage et les cuts déjà posés : jamais dans
 * la référence humaine (essai `faux-verts.test.cjs`, frontière anti-fuite). */
function signauxCut({x,prop,sh,b1,cap,A,voisins}){
  const pr=s=>prop?.proposal?.rails?.[s]||null,sr=s=>sh?.shadow?.rails?.[s]||null,cal=s=>sr(s)?.conventionCalibration||pr(s)?.gcv1?.convention||null;
  const reel=b1?.reel||{};
  const bandes=Object.fromEntries(SIDES.map(s=>[s,cap&&A[s]?bande(cap,s,A[s][0],A[s][1]):null]));
  const ecartementPredit=sh?.shadow?.pairGauge?.predictedMm??reel.gaugeMm??null;
  const marges=[];
  for(const s of SIDES){const r=sr(s);if(!r?.frame||!A[s])continue;
    const u=r.frame.sign*A[s][0]/1000,cs=[0,r.frame.uSeed];marges.push((Math.min(Math.max(...cs)+FENETRE_MOTEUR_MM/1000-u,u-(Math.min(...cs)-FENETRE_MOTEUR_MM/1000)))*1000);}
  return {
    calageVerticalMm:maxN(SIDES.map(s=>Number.isFinite(cal(s)?.dzMm)?Math.abs(cal(s).dzMm):null)),
    calageRefuse:SIDES.some(s=>cal(s)?.reason==='shift-out-of-domain'&&cal(s)?.applied!==true)?1:0,
    epaisseurDessusMm:maxN(SIDES.map(s=>bandes[s]?.epaisseurDessusMm)),
    profondeurDessusMm:maxN(SIDES.map(s=>Number.isFinite(bandes[s]?.p10DessusMm)?-bandes[s].p10DessusMm:null)),
    pointsDessusMin:minN(SIDES.map(s=>bandes[s]?.pointsDessus)),
    pointsFlancMin:minN(SIDES.map(s=>bandes[s]?.pointsFlanc)),
    flancMoteurMin:minN(SIDES.map(s=>pr(s)?.gcv1?.faceCount)),
    flancPartiel:SIDES.some(s=>pr(s)?.gcv1?.partialFlankUsed===true)?1:0,
    confianceMin:minN(SIDES.map(s=>pr(s)?.confidence)),
    lignesDessusMin:minN(SIDES.map(s=>pr(s)?.gcv1?.topRows)),
    margeCandidatsMin:minN(SIDES.map(s=>sr(s)?.astar?.lossRatio)),
    concurrentsMax:maxN(SIDES.map(s=>sr(s)?.competitive?.nCompetitive)),
    concurrentsFortsMax:maxN(SIDES.map(s=>sr(s)?.competitive?.nStrongCompetitive)),
    desaccordMoteurs:SIDES.some(s=>sr(s)&&(sr(s).v46?.status!=='candidate'||(sr(s).deltaV46Next??0)*1000>3))?1:0,
    repecheS1:SIDES.some(s=>pr(s)?.gcv1?.changed===true)?1:0,
    etageAutre:(reel.stage||'first-pass')!=='first-pass'?1:0,
    ecartVoieMm:Number.isFinite(reel.guardMm)?reel.guardMm:null,
    appuis:(reel.anchorsUsed||[]).length,
    deplacementVerticalMm:maxN(SIDES.map(s=>A[s]?Math.abs(A[s][1]):null)),
    deplacementLateralMm:maxN(SIDES.map(s=>A[s]?Math.abs(A[s][0]):null)),
    poseEnPlace:SIDES.some(s=>A[s]&&Math.max(Math.abs(A[s][0]),Math.abs(A[s][1]))<=2)?1:0,
    pointsRailMin:minN(SIDES.map(s=>sr(s)?.frame?.pointsLocal)),
    ecartGabaritMm:Number.isFinite(ecartementPredit)?r1(Math.abs(ecartementPredit-1435)):null,
    margeBordMm:minN(marges.map(r1)),
    voisinsLateralMm:voisins?.lateralMm??null,voisinsVerticalMm:voisins?.verticalMm??null,
    voisinsDeniveleMm:voisins?.deniveleMm??null,sautEcartementMm:voisins?.sautEcartementMm??null,
    flushPct:Number.isFinite(x.traits?.s6?.flushPct)?x.traits.s6.flushPct:null};
}
/* Sens du risque de chaque signal (+1 : haut = risque ; −1 : bas = risque) et libellé. */
const SIGNAUX=Object.freeze([
  ['calageVerticalMm',1,'décalage vertical du calage de convention (|dz|, plus grand rail)'],
  ['calageRefuse',1,'calage refusé (hors domaine) sur un rail'],
  ['epaisseurDessusMm',1,'épaisseur de la bande du dessus à la pose (P90 − P10)'],
  ['profondeurDessusMm',1,'points du dessus sous le gabarit posé (−P10)'],
  ['pointsDessusMin',-1,'points du dessus à la pose'],
  ['pointsFlancMin',-1,'points de flanc à la pose'],
  ['flancMoteurMin',-1,'points de flanc du candidat publié'],
  ['flancPartiel',1,'flanc partiel accepté (3 à 5 points)'],
  ['confianceMin',-1,'confiance du moteur'],
  ['lignesDessusMin',-1,'lignes du dessus du candidat publié'],
  ['margeCandidatsMin',-1,'marge entre les deux meilleurs candidats (rapport de perte)'],
  ['concurrentsMax',1,'candidats compétitifs'],
  ['concurrentsFortsMax',1,'candidats forts compétitifs'],
  ['desaccordMoteurs',1,'désaccord V4.6 / GCV1 (> 3 mm ou V4.6 abstenu)'],
  ['repecheS1',1,'rail repêché par S1'],
  ['etageAutre',1,'posé hors premier passage (reprise, choix, ornière)'],
  ['ecartVoieMm',1,'écart à la voie prédite par les appuis (garde de continuité)'],
  ['appuis',1,'nombre d\'appuis de la décision'],
  ['deplacementVerticalMm',1,'écart vertical à la pose d\'extraction'],
  ['deplacementLateralMm',1,'écart latéral à la pose d\'extraction'],
  ['poseEnPlace',1,'pose à 2 mm au plus de la pose d\'extraction'],
  ['pointsRailMin',-1,'points autour du champignon'],
  ['ecartGabaritMm',1,'écartement prédit loin de 1 435 mm'],
  ['margeBordMm',-1,'marge au bord de la fenêtre de recherche du moteur'],
  ['voisinsLateralMm',1,'écart latéral à la voie des posés précédents (10 cuts)'],
  ['voisinsVerticalMm',1,'écart vertical à la voie des posés précédents'],
  ['voisinsDeniveleMm',1,'écart de dévers à la voie des posés précédents'],
  ['sautEcartementMm',1,'saut d\'écartement par rapport au posé précédent'],
  ['flushPct',1,'part des points au ras (contexte PN, règles métier)'],
]);

/* ================================================================== diagnostic (relecture avec la pose de l'opérateur) */
function grilleRail(cap,side,centres){
  const vu=new Set(),cells=[];
  for(const u of centres){const g=L.gridOf(cap,side,u);if(g)for(const c of g){const k=Math.round(c.u*1e6)+','+Math.round(c.z*1e6);if(!vu.has(k)){vu.add(k);cells.push(c);}}}
  return cells;
}
/* Pour un rail : la grille du moteur (A_STAR, mêmes centres que le moteur, plus la pose d'Ariane et celle de l'opérateur pour couvrir
 * les deux), ses minima locaux calés comme le moteur les aurait publiés, le minimum le plus proche de chaque pose, la perte et les
 * bandes de points à la pose de l'opérateur, et si cette pose était dans la fenêtre de recherche du moteur. */
function relireRail(cap,side,sr,A,H){
  if(!cap||!sr?.ok||!sr.frame||!A||!H)return null;
  const sign=sr.frame.sign,centres=[sr.frame.uSeed,sign*A[0]/1000,sign*H[0]/1000];
  const cells=grilleRail(cap,side,centres);if(!cells.length)return null;
  const lmin=Math.min(...cells.map(c=>c.loss));
  const mins=L.localMinima(cells,Cand.DEFAULTS.alternativeSeparation).slice(0,30).map((m,rang)=>{
    const delta=[0,sign*m.u,m.z],cal=Conv.calibrate(cap,side,delta),pub=cal.applied?cal.delta:delta;
    return {rang,latMm:r1(sign*m.u*1000),vertMm:r1(m.z*1000),pubLatMm:r1(pub[1]*1000),pubVertMm:r1(pub[2]*1000),rapportPerte:r2(m.loss/lmin)};
  });
  const d=(m,P)=>Math.hypot(m.pubLatMm-P[0],m.pubVertMm-P[1]);
  const proche=P=>mins.reduce((a,b)=>a==null||d(b,P)<d(a,P)?b:a,null);
  const mA=proche(A),mH=proche(H);
  let perteH=null;
  if(mH){const raw=[H[0]-(mH.pubLatMm-mH.latMm),H[1]-(mH.pubVertMm-mH.vertMm)];let best=null;
    for(const c of cells){const e=Math.hypot(sign*c.u*1000-raw[0],c.z*1000-raw[1]);if(!best||e<best.e)best={e,c};}
    perteH=best?r2(best.c.loss/lmin):null;}
  const cs=[0,sr.frame.uSeed],uH=sign*H[0]/1000;
  return {choisi:mA?{...mA,ecartMm:r1(d(mA,A))}:null,procheOperateur:mH?{...mH,ecartMm:r1(d(mH,H)),memeQueChoisi:mH===mA}:null,
    rapportPerteOperateur:perteH,operateurDansFenetre:cs.some(c=>Math.abs(uH-c)<=FENETRE_MOTEUR_MM/1000),
    bandePose:bande(cap,side,A[0],A[1]),bandeOperateur:bande(cap,side,H[0],H[1])};
}

/* ================================================================== extraire */
function extraire({designation,jeu,journal,captures,aiguilles=[]}){
  const {entete,cuts}=lireJeu(jeu),J=lireJournal(journal);
  const rang=new Map(J.ordre.map((c,i)=>[c,i]));
  const aig=new Set([...aiguilles,...((entete?.zonesFiche?.ADV)||[]).map(a=>a.aiguille).filter(Number.isInteger)]);
  const posesJeu=cuts.filter(x=>x.classe==='posee');
  const labels=new Map(posesJeu.map(x=>[x.cut,reference(x)]));
  const differes=[...J.differes].sort((a,b)=>a-b);
  /* Poses posées (repère scène de la capture) pour la voie causale. */
  const posees=new Map();
  for(const x of posesJeu){const cap=captures.get(x.cut),A=deplacement(x);
    if(cap&&A.left&&A.right)posees.set(x.cut,{frame:cap.identity?.frameId??null,rang:rang.get(x.cut),positions:positionsDe(cap,A)});}
  const cas=[];
  for(const x of posesJeu){
    const cut=x.cut,cap=captures.get(cut)||null,A=deplacement(x),prop=J.proposed.get(cut)||null,sh=J.shadow.get(cut)||null,b1=J.b1.get(cut)||null;
    const moi=posees.get(cut);
    let voisins=null;
    if(cap&&moi&&Number.isInteger(moi.rang)){
      const ant=[...posees.entries()].filter(([c,p])=>c!==cut&&p.frame===moi.frame&&Number.isInteger(p.rang)&&p.rang<moi.rang&&Math.abs(c-cut)<=VOISINS_CUTS)
        .sort((a,b)=>Math.abs(a[0]-cut)-Math.abs(b[0]-cut)).slice(0,2).map(([,p])=>p);
      voisins=ecartVoisins(cap,moi.positions,ant);
    }
    const signaux=signauxCut({x,prop,sh,b1,cap,A,voisins});
    /* L'ombre telle que l'extension la consigne : science du cut (journal), positions posées. */
    let ombre=null;
    try{if(cap&&moi&&sh?.shadow?.rails)ombre=FV.evaluer({capture:cap,science:{rails:sh.shadow.rails},decision:{positions:moi.positions},reglage:FV.REGLE});}catch{ombre=null;}
    const lab=labels.get(cut),z=x.zone||{};
    const distDiffere=differes.length?Math.min(...differes.map(c=>Math.abs(c-cut))):null;
    const enZone=!!(z.pn||z.adv);
    const reel=b1?.reel||{};
    const row={format:FORMAT_CAS,partie:{...designation},cut,rang:rang.get(cut)??null,
      etage:reel.stage??null,appuisUtilises:(reel.anchorsUsed||[]).slice(0,4),
      controle:{distDiffere,zonePnAdv:enZone,pn:z.pn?.id??null,adv:z.adv?.id??null,
        aiguilleCuts:aig.size?Math.min(...[...aig].map(a=>Math.abs(a-cut))):null,
        sousControle:(distDiffere!==null&&distDiffere<=ZONE_CONTROLE_CUTS)||enZone},
      signaux,ombre:ombre?{verdict:ombre.verdict,motif:ombre.motif,railsSuspects:ombre.railsSuspects,rails:ombre.rails}:null,
      jugement:{avecReference:lab.avecReference,parRegleVisite:lab.parRegleVisite,fauxVert:lab.fauxVert,corrige5mm:lab.corrige5mm,
        correctionMm:lab.avecReference?Object.fromEntries(SIDES.map(s=>[s,lab.corr[s]?lab.corr[s].map(r2):null])):null}};
    if(lab.fauxVert){
      const rails={};
      for(const s of SIDES){
        const co=lab.corr[s],H=A[s]&&co?[A[s][0]+co[0],A[s][1]+co[1]]:null,pr=prop?.proposal?.rails?.[s],cal=sh?.shadow?.rails?.[s]?.conventionCalibration||pr?.gcv1?.convention||null;
        rails[s]={correctionMm:co?co.map(r1):null,poseArianeMm:A[s]?A[s].map(r1):null,
          calage:cal?{applique:cal.applied===true,raison:cal.reason??null,dzMm:r1(cal.dzMm),duMm:r1(cal.duMm),
            bruteMm:Array.isArray(cal.rawDelta)?[r1(cal.rawDelta[1]*1000),r1(cal.rawDelta[2]*1000)]:null}:null,
          flancMoteur:pr?.gcv1?.faceCount??null,flancPartiel:pr?.gcv1?.partialFlankUsed===true,
          pointsRail:sh?.shadow?.rails?.[s]?.frame?.pointsLocal??null,
          relecture:relireRail(cap,s,sh?.shadow?.rails?.[s],A[s],H)};
      }
      const ricochet=['window','choice'].includes(reel.stage)&&(reel.anchorsUsed||[]).some(c=>labels.get(c)?.corrige5mm);
      row.diagnostic={rails,ricochet};
    }
    cas.push(row);
  }
  const ent={format:FORMAT_CAS,type:'entete',partie:{...designation},posesAuJeu:posesJeu.length,captures:[...captures.keys()].filter(c=>labels.has(c)).length,
    differesAuJournal:differes.length,aiguilles:[...aig].sort((a,b)=>a-b),
    note:'signaux du moment de la décision ; diagnostic (faux verts seulement) relu avec la pose de l\'opérateur ; aucune coordonnée absolue'};
  return {entete:ent,cas};
}

/* ================================================================== typologie */
const CAUSES=Object.freeze(['mauvais minimum','flanc partiel','convention verticale','extraction validée en place','voie décalée','nuage pauvre','autre']);
/* Cause d'un faux vert, d'après le rail le plus corrigé. `verifie` : le mécanisme est confirmé par la relecture de la science du
 * cut (grille, calage, compte de points) ; sinon la cause est SUPPOSÉE (direction et taille de la correction seulement). */
function classer(c){
  const d=c.diagnostic;if(!d)return null;
  let side=null;for(const s of SIDES){const k=d.rails[s]?.correctionMm;if(k&&(!side||k[2]>d.rails[side].correctionMm[2]))side=s;}
  if(!side)return {cause:'autre',sousCause:'sans correction lisible',verifie:false,rail:null};
  const r=d.rails[side],[cl,cv,c3]=r.correctionMm,A=r.poseArianeMm,H=[A[0]+cl,A[1]+cv],rel=r.relecture||{},po=rel.procheOperateur||{},cal=r.calage;
  const out=(cause,sousCause,verifie,note='')=>({cause,sousCause,verifie,rail:side,note:note+(d.ricochet?' ; ricochet : un appui de la décision a été corrigé de plus de 5 mm':'')});
  if(c.etage==='crossing')return out('autre','passage à niveau lu par l\'ornière',true,'étage « crossing » de la décision');
  if(c3>=50||rel.operateurDansFenetre===false){
    const v=rel.operateurDansFenetre===false&&Number.isFinite(po.ecartMm)&&po.ecartMm<=8&&po.rapportPerte<=1.5;
    return out('voie décalée',rel.operateurDansFenetre===false?'bonne pose hors de la fenêtre de recherche':'autre voie dans la fenêtre',v,
      `opérateur à ${r1(Math.hypot(cl,cv))} mm ; minimum de la grille recentrée à ${po.ecartMm??'?'} mm de lui, rapport ${po.rapportPerte??'?'}`);
  }
  const brute=cal?.bruteMm;
  if(A&&Math.max(Math.abs(A[0]),Math.abs(A[1]))<=2&&(!brute||Math.max(Math.abs(brute[0]),Math.abs(brute[1]))<=2))
    return out('extraction validée en place','moteur sur la pose d\'extraction',true);
  if(po.memeQueChoisi===false&&po.ecartMm<=5&&po.rapportPerte<=3)
    return out('mauvais minimum','minimum concurrent de la grille',true,`minimum de rang ${po.rang} à ${po.ecartMm} mm de l'opérateur, rapport ${po.rapportPerte}`);
  if(Number.isFinite(c.controle?.aiguilleCuts)&&c.controle.aiguilleCuts<=3)
    return out('autre','aiguille (profil d\'appareil de voie)',false,`à ${c.controle.aiguilleCuts} cut(s) d'une aiguille notée par l'opérateur`);
  if(Math.abs(cv)>=Math.abs(cl)&&Math.abs(cv)>7){
    if(cal&&cal.raison==='shift-out-of-domain'&&!cal.applique&&Number.isFinite(cal.dzMm)){
      const e=Math.abs(H[1]-(A[1]+cal.dzMm)),v=e<=5&&cv*cal.dzMm>0;
      return out('convention verticale',v?'calage refusé : l\'opérateur applique le décalage':'calage refusé, correction non expliquée par le calage',v,`dz ${cal.dzMm} mm ; calé, à ${r1(e)} mm de l'opérateur`);
    }
    if(cal&&cal.applique&&brute){
      const eB=Math.abs(H[1]-brute[1]),eA=Math.abs(cv),v=eB<=eA-3;
      return out('convention verticale',v?'calage appliqué : la pose brute était plus juste':'dessus ambigu (hors calage)',v,`dz ${cal.dzMm} mm ; brute à ${r1(eB)} mm de l'opérateur, posée à ${r1(eA)} mm`);
    }
    return out('convention verticale','calage non relu (reprise ou choix)',false);
  }
  if(r.flancPartiel||(Number.isFinite(r.flancMoteur)&&r.flancMoteur<6))return out('flanc partiel','flanc de 3 à 5 points',true,`flanc ${r.flancMoteur} points ; correction latérale ${r1(cl)} mm`);
  const bp=rel.bandePose||{};
  if((Number.isFinite(r.pointsRail)&&r.pointsRail<60)||(Number.isFinite(bp.pointsFlanc)&&bp.pointsFlanc<3)||(Number.isFinite(bp.pointsDessus)&&bp.pointsDessus<15))
    return out('nuage pauvre','peu de points',false);
  return out('autre',c.controle?.zonePnAdv?'zone d\'ADV ou de PN':'mixte',false,`latéral ${r1(cl)} mm, vertical ${r1(cv)} mm ; pose de l'opérateur ${rel.rapportPerteOperateur!=null?'à un rapport de perte de '+rel.rapportPerteOperateur:'non relue'}`);
}

/* ================================================================== étude */
function auc(pos,neg){
  pos=pos.filter(Number.isFinite);neg=neg.filter(Number.isFinite);
  if(pos.length<3||neg.length<3)return null;
  let s=0;for(const p of pos)for(const n of neg)s+=p>n?1:p===n?.5:0;
  return r2(s/pos.length/neg.length);
}
const cle=p=>`${p.projet}:${p.partie}`;
const valeur=(c,k,sens)=>{const v=c.signaux?.[k];return Number.isFinite(v)?sens*v:null;};
function seuils(cas,k,sens){
  const vs=[...new Set(cas.map(c=>valeur(c,k,sens)).filter(v=>v!==null))].sort((a,b)=>a-b);
  return vs.length>60?Array.from({length:60},(_,i)=>vs[Math.round(i*(vs.length-1)/59)]):vs;
}
/* Validation croisée par partie : seuil appris sur les autres parties (taux moyen de bons verts différés ≤ budget, rappel moyen
 * maximal, chaque partie pèse autant), jugé sur la partie laissée de côté. */
function cvSignal(parParties,k,sens,budget){
  const out=[];
  for(const p of Object.keys(parParties)){
    const app=Object.entries(parParties).filter(([q])=>q!==p).map(([,v])=>v);
    let best=null;
    for(const t of seuils(app.flat(),k,sens)){
      const st=app.map(X=>{const fv=X.filter(c=>c.jugement.fauxVert),bon=X.filter(c=>!c.jugement.fauxVert);
        const f=c=>{const v=valeur(c,k,sens);return v!==null&&v>=t;};
        return [fv.length?fv.filter(f).length/fv.length:0,bon.length?bon.filter(f).length/bon.length:0];});
      const rec=st.reduce((a,b)=>a+b[0],0)/st.length,fpr=st.reduce((a,b)=>a+b[1],0)/st.length;
      if(fpr<=budget&&(!best||rec>best.rec||(rec===best.rec&&fpr<best.fpr)))best={t,rec,fpr};
    }
    const X=parParties[p],fv=X.filter(c=>c.jugement.fauxVert),bon=X.filter(c=>!c.jugement.fauxVert);
    const f=c=>best&&(v=>v!==null&&v>=best.t)(valeur(c,k,sens));
    out.push({partie:p,seuil:best?r1(sens*best.t):null,evites:fv.filter(f).length,fauxVerts:fv.length,bonsDifferes:bon.filter(f).length,bons:bon.length});
  }
  return out;
}
function bilanRegle(parParties,flag){
  const out={};
  for(const [p,X] of Object.entries(parParties)){
    const tous=X,ref=X.filter(c=>c.jugement.avecReference),fv=ref.filter(c=>c.jugement.fauxVert);
    const marques=tous.filter(flag),setM=new Set(marques.map(c=>c.cut));
    const hc=fv.filter(c=>!c.controle?.sousControle);
    out[p]={fauxVerts:fv.length,evites:fv.filter(flag).length,bonsDifferes:ref.filter(c=>!c.jugement.fauxVert&&flag(c)).length,bons:ref.length-fv.length,
      differesSansReference:tous.filter(c=>!c.jugement.avecReference&&flag(c)).length,posesDuLot:tous.length,
      fauxVertsHorsControle:hc.length,evitesHorsControle:hc.filter(flag).length,
      ramenesSousControle:hc.filter(c=>!setM.has(c.cut)&&[...setM].some(m=>Math.abs(m-c.cut)<=1)).length};
    out[p].net=out[p].evites-out[p].bonsDifferes;
  }
  return out;
}
const SEUILS_DZ=[8,9,10,11,12],SEUILS_EP=[10,11,12,13,14,15,16,17,18,20];
const flagRegle=(dz,ep)=>c=>!!c.ombre&&SIDES.some(s=>{const r=c.ombre.rails?.[s];return r&&r.dzMm!==null&&Math.abs(r.dzMm)>=dz&&r.epaisseurDessusMm!==null&&r.epaisseurDessusMm>=ep;});
function cvRegle(parParties){
  const out=[];
  for(const p of Object.keys(parParties)){
    const app=Object.fromEntries(Object.entries(parParties).filter(([q])=>q!==p));
    let best=null;
    for(const dz of SEUILS_DZ)for(const ep of SEUILS_EP){
      const b=Object.values(bilanRegle(app,flagRegle(dz,ep)));const net=b.reduce((a,x)=>a+x.net,0),diff=b.reduce((a,x)=>a+x.bonsDifferes,0);
      if(!best||net>best.net||(net===best.net&&diff<best.diff))best={dz,ep,net,diff};
    }
    const j=bilanRegle({[p]:parParties[p]},flagRegle(best.dz,best.ep))[p];
    out.push({partie:p,appris:{dzMinMm:best.dz,epaisseurMinMm:best.ep,netApprentissage:best.net},juge:j});
  }
  return out;
}
/* LEVIER VERTICAL (mesure, jamais une règle de pose ici) : la correction verticale de l'opérateur suit-elle l'épaisseur du dessus ?
 * Par groupe de rails (calage appliqué, calage refusé), droite « correction = a + b × épaisseur » apprise sur les autres parties
 * (pente des moindres carrés, ordonnée = médiane des résidus), appliquée à la partie jugée : combien de faux verts restent, combien
 * sont corrigés, combien de cuts passent au-dessus de 10 mm. Ce serait une POSE différente : à mesurer en ombre et à décider avec l'opérateur. */
const groupeCalage=r=>r?.calage==='applique'?'applique':r?.calage==='shift-out-of-domain'?'refuse':null;
function railsLevier(c){return SIDES.map(s=>{const r=c.ombre?.rails?.[s],k=c.jugement.correctionMm?.[s];
  return k&&r&&Number.isFinite(r.epaisseurDessusMm)?{g:groupeCalage(r),ep:r.epaisseurDessusMm,lat:k[0],vert:k[1],d3:k[2]}:k?{g:null,lat:k[0],vert:k[1],d3:k[2]}:null;});}
function ajuster(pts){
  if(pts.length<5)return null;
  const mx=pts.reduce((a,p)=>a+p[0],0)/pts.length,my=pts.reduce((a,p)=>a+p[1],0)/pts.length,sxx=pts.reduce((a,p)=>a+(p[0]-mx)**2,0);
  const b=sxx?pts.reduce((a,p)=>a+(p[0]-mx)*(p[1]-my),0)/sxx:0,res=pts.map(p=>p[1]-b*p[0]).sort((x,y)=>x-y);
  return {a:r2(res[res.length>>1]),b:r2(b)};
}
function cvLevier(avecRef){
  const out={};
  for(const p of Object.keys(avecRef)){
    const app=Object.entries(avecRef).filter(([q])=>q!==p).flatMap(([,X])=>X.flatMap(railsLevier)).filter(r=>r&&r.g);
    const mod={applique:ajuster(app.filter(r=>r.g==='applique').map(r=>[r.ep,r.vert])),refuse:ajuster(app.filter(r=>r.g==='refuse').map(r=>[r.ep,r.vert]))};
    let avant=0,apres=0,corriges=0,nouveaux=0,s5a=0,s5b=0;
    for(const c of avecRef[p]){const rails=railsLevier(c).filter(Boolean);if(!rails.length)continue;
      const m0=Math.max(...rails.map(r=>r.d3)),m1=Math.max(...rails.map(r=>{const m=r.g&&mod[r.g];if(!m)return r.d3;const v=r.vert-(m.a+m.b*r.ep);return Math.sqrt(Math.max(r.d3**2-r.vert**2,0)+v*v);}));
      avant+=m0>SEUIL_FAUX_MM;apres+=m1>SEUIL_FAUX_MM;corriges+=m0>SEUIL_FAUX_MM&&m1<=SEUIL_FAUX_MM;nouveaux+=m0<=SEUIL_FAUX_MM&&m1>SEUIL_FAUX_MM;s5a+=m0>5;s5b+=m1>5;}
    out[p]={modele:mod,fauxVertsAvant:avant,fauxVertsApres:apres,corriges,nouveaux,sup5Avant:s5a,sup5Apres:s5b};
  }
  return out;
}
function etudier(listes){
  const parParties={};
  for(const cas of listes)for(const c of cas){if(c.type==='entete')continue;const p=cle(c.partie);(parParties[p]=parParties[p]||[]).push(c);}
  for(const p of Object.keys(parParties))parParties[p].sort((a,b)=>a.cut-b.cut);
  const avecRef=Object.fromEntries(Object.entries(parParties).map(([p,X])=>[p,X.filter(c=>c.jugement.avecReference)]));
  /* 1. Typologie. */
  const typologie={},faux=[];
  for(const [p,X] of Object.entries(avecRef)){
    const t={total:0,horsControle:0,parCause:{}};
    for(const c of X.filter(c=>c.jugement.fauxVert)){
      const k=classer(c);t.total++;if(!c.controle?.sousControle)t.horsControle++;
      const e=t.parCause[k.cause]=t.parCause[k.cause]||{verifies:0,supposes:0,horsControle:0,sousCauses:{}};
      e[k.verifie?'verifies':'supposes']++;if(!c.controle?.sousControle)e.horsControle++;e.sousCauses[k.sousCause]=(e.sousCauses[k.sousCause]||0)+1;
      faux.push({partie:p,cut:c.cut,etage:c.etage,sousControle:!!c.controle?.sousControle,...k});
    }
    typologie[p]=t;
  }
  /* 2. Signaux : AUC par partie (> 10 mm et > 5 mm), AUC par cause (toutes parties, faux verts de la cause contre tous les bons). */
  const parties=Object.keys(avecRef);
  const aucs=SIGNAUX.map(([k,sens,libelle])=>{
    const parPartie={},parPartie5={};
    for(const p of parties){const X=avecRef[p];
      parPartie[p]=auc(X.filter(c=>c.jugement.fauxVert).map(c=>valeur(c,k,sens)),X.filter(c=>!c.jugement.fauxVert).map(c=>valeur(c,k,sens)));
      parPartie5[p]=auc(X.filter(c=>c.jugement.corrige5mm).map(c=>valeur(c,k,sens)),X.filter(c=>!c.jugement.corrige5mm).map(c=>valeur(c,k,sens)));}
    const parCause={},bons=parties.flatMap(p=>avecRef[p].filter(c=>!c.jugement.fauxVert));
    for(const cause of CAUSES){const pos=parties.flatMap(p=>avecRef[p].filter(c=>c.jugement.fauxVert&&classer(c).cause===cause));
      if(pos.length>=3)parCause[cause]=auc(pos.map(c=>valeur(c,k,sens)),bons.map(c=>valeur(c,k,sens)));}
    const v=Object.values(parPartie).filter(x=>x!==null);
    return {signal:k,sens:sens>0?'haut = risque':'bas = risque',libelle,parPartie,parPartie5mm:parPartie5,parCause,
      signeStable:v.length>=2&&(v.every(x=>x>.52)||v.every(x=>x<.48))};
  });
  /* 3. Validation croisée : rappel à 5 % et 10 % de bons verts différés. */
  const validationCroisee=Object.fromEntries([.05,.10].map(b=>[String(b),SIGNAUX.map(([k,sens])=>{
    const r=cvSignal(avecRef,k,sens,b);const ev=r.reduce((a,x)=>a+x.evites,0),fv=r.reduce((a,x)=>a+x.fauxVerts,0),bd=r.reduce((a,x)=>a+x.bonsDifferes,0),bo=r.reduce((a,x)=>a+x.bons,0);
    return {signal:k,parPartie:r,cumul:{evites:ev,fauxVerts:fv,rappel:r2(ev/fv),bonsDifferes:bd,bons:bo,taux:r2(bd/bo)}};
  }).sort((a,b)=>b.cumul.evites-a.cumul.evites||a.cumul.bonsDifferes-b.cumul.bonsDifferes)]));
  /* 4. La règle de l'ombre (réglages figés), et ses seuils appris en validation croisée. */
  const regle={seuils:{dzMinMm:FV.REGLE.dzMinMm,epaisseurMinMm:FV.REGLE.epaisseurMinMm},
    parPartie:bilanRegle(parParties,c=>c.ombre?.verdict==='differer'),validationCroisee:cvRegle(parParties),
    grille:SEUILS_DZ.map(dz=>({dzMinMm:dz,parEpaisseur:SEUILS_EP.map(ep=>{const b=Object.values(bilanRegle(parParties,flagRegle(dz,ep)));
      return {epaisseurMinMm:ep,evites:b.reduce((a,x)=>a+x.evites,0),bonsDifferes:b.reduce((a,x)=>a+x.bonsDifferes,0)};})}))};
  return {format:FORMAT_ETUDE,parties,typologie,fauxVerts:faux,signaux:aucs,validationCroisee,regle,levierVertical:cvLevier(avecRef)};
}
function texte(e){
  const L2=[],f=v=>v===null||v===undefined?'  -  ':v.toFixed(2);
  L2.push('# Faux verts : typologie, signaux, règle de l\'ombre','');
  L2.push('## Typologie (faux verts > 10 mm, par cause : vérifiés / supposés ; hors zone de contrôle)');
  for(const p of e.parties){const t=e.typologie[p];L2.push(`partie ${p} : ${t.total} faux verts, ${t.horsControle} hors zone de contrôle`);
    for(const [cause,v] of Object.entries(t.parCause))L2.push(`  ${cause} : ${v.verifies} vérifiés, ${v.supposes} supposés (${v.horsControle} hors contrôle) — ${Object.entries(v.sousCauses).map(([k,n])=>k+' '+n).join(' ; ')}`);}
  L2.push('','## Faux verts un par un');
  for(const x of e.fauxVerts)L2.push(`  ${x.partie} cut ${x.cut} (${x.etage||'?'}${x.sousControle?', zone de contrôle':''}) : ${x.cause} — ${x.sousCause} [${x.verifie?'vérifié':'supposé'}]${x.note?' ; '+x.note:''}`);
  L2.push('','## Signaux : AUC par partie (> 10 mm) | > 5 mm | par cause');
  L2.push('signal'.padEnd(24)+e.parties.map(p=>p.padStart(7)).join('')+'  |'+e.parties.map(p=>p.padStart(7)).join(''));
  for(const s of e.signaux)L2.push(s.signal.padEnd(24)+e.parties.map(p=>f(s.parPartie[p]).padStart(7)).join('')+'  |'+e.parties.map(p=>f(s.parPartie5mm[p]).padStart(7)).join('')
    +'  | '+Object.entries(s.parCause).map(([k,v])=>k+' '+f(v)).join(', ')+(s.signeStable?'  (signe stable)':''));
  for(const [b,rows] of Object.entries(e.validationCroisee)){
    L2.push('',`## Validation croisée par partie, ${Math.round(Number(b)*100)} % de bons verts différés au plus (apprentissage) — 8 meilleurs`);
    for(const r of rows.slice(0,8))L2.push(`  ${r.signal} : ${r.cumul.evites}/${r.cumul.fauxVerts} évités, ${r.cumul.bonsDifferes}/${r.cumul.bons} bons différés — `+r.parPartie.map(x=>`${x.partie} ${x.evites}/${x.fauxVerts} (${x.bonsDifferes}) seuil ${x.seuil}`).join(' ; '));
  }
  L2.push('',`## Règle de l'ombre (|dz| ≥ ${e.regle.seuils.dzMinMm} mm et dessus ≥ ${e.regle.seuils.epaisseurMinMm} mm sur un même rail)`);
  for(const [p,b] of Object.entries(e.regle.parPartie))L2.push(`  ${p} : ${b.evites}/${b.fauxVerts} faux verts évités (${b.evitesHorsControle}/${b.fauxVertsHorsControle} hors contrôle), ${b.bonsDifferes}/${b.bons} bons verts différés, ${b.differesSansReference} posés sans référence différés, net ${b.net>=0?'+':''}${b.net} ; ${b.ramenesSousControle} faux verts hors contrôle à un cut d'un nouveau différé`);
  L2.push('  validation croisée (seuils appris sur les autres parties) :');
  for(const r of e.regle.validationCroisee)L2.push(`    ${r.partie} : appris dz ≥ ${r.appris.dzMinMm}, dessus ≥ ${r.appris.epaisseurMinMm} -> ${r.juge.evites}/${r.juge.fauxVerts} évités, ${r.juge.bonsDifferes} bons différés, net ${r.juge.net>=0?'+':''}${r.juge.net}`);
  L2.push('','## Levier vertical (mesure seulement) : correction = a + b × épaisseur du dessus, apprise sur les autres parties');
  for(const [p,v] of Object.entries(e.levierVertical||{}))L2.push(`  ${p} : faux verts ${v.fauxVertsAvant} -> ${v.fauxVertsApres} (corrigés ${v.corriges}, nouveaux ${v.nouveaux}) ; > 5 mm ${v.sup5Avant} -> ${v.sup5Apres} ; modèles appliqué ${JSON.stringify(v.modele.applique)}, refusé ${JSON.stringify(v.modele.refuse)}`);
  return L2.join('\n');
}

/* ================================================================== preuve « ombre sans effet » */
function avecGlobal(valeur,fn){
  const avant=Object.getOwnPropertyDescriptor(globalThis,'BananeSettings');globalThis.BananeSettings=valeur;
  try{return fn();}finally{if(avant)Object.defineProperty(globalThis,'BananeSettings',avant);else delete globalThis.BananeSettings;}
}
function preuve({jeu,journal,captures}){
  const J=lireJournal(journal),{cuts}=lireJeu(jeu),A=new Map(cuts.filter(x=>x.classe==='posee').map(x=>[x.cut,deplacement(x)]));
  const cache=new Map(),cleCap=c=>c.identity?.cut+'|'+SIDES.map(s=>c.rails[s].positionSceneRelative.map(v=>Math.round(v*1e6)).join(',')).join('|');
  const moteur={...Shadow,scientificProposeBoth(c){const k=cleCap(c);if(!cache.has(k))cache.set(k,Shadow.scientificProposeBoth(c));return cache.get(k);}};
  const livre={...Settings},sansOmbre={...Settings,fauxVertOmbre:undefined},ouvert={...Settings,fauxVertOmbre:{...Settings.fauxVertOmbre,differer:true}};
  const st={cuts:0,decisionsIdentiques:0,commandesIdentiques:0,consignes:0,verdictDifferer:0,etagesConformesAuJournal:0,
    activationOuverte:{differesEnPlus:0,commandesInchangees:0,posesAjoutees:0,autres:0},ecarts:[]};
  const anchors=[];
  for(const cut of J.ordre){
    const cap=captures.get(cut),sh=J.shadow.get(cut),prop=J.proposed.get(cut);
    if(!cap||!sh?.shadow?.rails||!prop?.proposal?.rails)continue;
    const identity=K.completeIdentity(cap.identity);
    const args={capture:{identity,rails:cap.rails,pointsSceneRelative:cap.pointsSceneRelative,visibleByClipBoxes:cap.visibleByClipBoxes},
      science:{rails:sh.shadow.rails,summary:sh.shadow.summary},anchors:anchors.slice(),Shadow:moteur};
    const dSans=avecGlobal(sansOmbre,()=>L.decideCut(args)),dAvec=avecGlobal(livre,()=>L.decideCut(args));
    const {fauxVertOmbre,...reste}=dAvec;
    st.cuts++;if(fauxVertOmbre){st.consignes++;if(fauxVertOmbre.verdict==='differer')st.verdictDifferer++;}
    const memeD=JSON.stringify(reste)===JSON.stringify(dSans);if(memeD)st.decisionsIdentiques++;else if(st.ecarts.length<10)st.ecarts.push({cut,quoi:'decision'});
    if(dSans.stage===J.b1.get(cut)?.reel?.stage)st.etagesConformesAuJournal++;
    const cmd=(d,g)=>avecGlobal(g,()=>L.commandRails({decision:d,runtimeRails:prop.proposal.rails,before:cap.rails,expectedPoses:K.expectedPoses,cameras:L.viewCameras(cap)}));
    const cSans=JSON.stringify(cmd(dSans,sansOmbre)),cAvec=JSON.stringify(cmd(dAvec,livre));
    if(cSans===cAvec)st.commandesIdentiques++;else if(st.ecarts.length<10)st.ecarts.push({cut,quoi:'commande'});
    const o=cmd(dAvec,ouvert),cs=JSON.parse(cSans);
    const pose=c=>c.action==='lot'||(c.action==='engine'&&SIDES.every(x=>c.rails?.[x]?.status==='candidate'));
    if(JSON.stringify(o)===cSans)st.activationOuverte.commandesInchangees++;
    else if(o.action==='defer'&&o.reason==='faux-vert-ombre'&&pose(cs))st.activationOuverte.differesEnPlus++;
    else if(pose(o)&&!pose(cs))st.activationOuverte.posesAjoutees++;else st.activationOuverte.autres++;
    const a=A.get(cut);
    if(J.poses.has(cut)&&a?.left&&a?.right)L.rememberAnchor(anchors,{identity:{part:identity.part,cut,frameId:identity.frameId??null},positions:positionsDe(cap,a),stage:'posee'},40);
  }
  st.sansEffet=st.decisionsIdentiques===st.cuts&&st.commandesIdentiques===st.cuts&&st.activationOuverte.posesAjoutees===0&&st.activationOuverte.autres===0;
  return st;
}

/* ================================================================== CLI */
function lireOptions(argv){
  const o={corpus:[],cas:[],aiguilles:[]};
  for(let i=0;i<argv.length;i++){const a=argv[i],v=()=>argv[++i];
    if(a==='--partie')o.partie=v();else if(a==='--jeu')o.jeu=v();else if(a==='--journal')o.journal=v();else if(a==='--corpus')o.corpus.push(v());
    else if(a==='--sortie')o.sortie=v();else if(a==='--cas')o.cas.push(v());else if(a==='--json')o.json=v();
    else if(a==='--aiguilles')o.aiguilles=v().split(',').map(Number).filter(Number.isInteger);
    else if(a==='--juger-partie-reservee')o.jugerReservee=true;else if(!o.commande)o.commande=a;else throw Error('option inconnue : '+a);}
  return o;
}
function main(argv){
  const o=lireOptions(argv);
  if(o.commande==='extraire'){
    if(!o.partie||!o.jeu||!o.journal||!o.corpus.length)throw Error('extraire : --partie, --jeu, --journal et --corpus sont obligatoires');
    const des=Manifeste.lireDesignations(o.partie);if(des.length!==1)throw Error('extraire : une seule partie à la fois');
    const {avis}=Manifeste.controler(Manifeste.lire(),des,{outil:'faux-verts',jugerReservee:!!o.jugerReservee});if(avis)console.error(avis);
    const jeu=lireLignes(o.jeu),cuts=new Set(jeu.filter(l=>l.type==='cut'&&l.classe==='posee').map(l=>l.cut));
    const r=extraire({designation:des[0],jeu,journal:lireJson(o.journal),captures:chargerCaptures(o.corpus,cuts),aiguilles:o.aiguilles});
    const sortie=[r.entete,...r.cas].map(x=>JSON.stringify(x)).join('\n')+'\n';
    if(o.sortie)fs.writeFileSync(o.sortie,sortie);else process.stdout.write(sortie);
    console.error(`faux-verts : partie ${o.partie}, ${r.cas.length} cuts posés, ${r.cas.filter(c=>c.jugement.fauxVert).length} faux verts`);
    return;
  }
  if(o.commande==='preuve'){
    if(!o.partie||!o.jeu||!o.journal||!o.corpus.length)throw Error('preuve : --partie, --jeu, --journal et --corpus sont obligatoires');
    const des=Manifeste.lireDesignations(o.partie);
    const {avis}=Manifeste.controler(Manifeste.lire(),des,{outil:'faux-verts',jugerReservee:!!o.jugerReservee});if(avis)console.error(avis);
    const r=preuve({jeu:lireLignes(o.jeu),journal:lireJson(o.journal),captures:chargerCaptures(o.corpus,null)});
    const out={partie:des[0],...r};if(o.json)fs.writeFileSync(o.json,JSON.stringify(out,null,1));console.log(JSON.stringify(out));return;
  }
  if(o.commande==='etudier'){
    if(!o.cas.length)throw Error('etudier : --cas au moins une fois');
    const e=etudier(o.cas.map(lireLignes));
    if(o.json)fs.writeFileSync(o.json,JSON.stringify(e,null,1));
    console.log(texte(e));return;
  }
  throw Error('commande attendue : extraire, etudier ou preuve');
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exit(1);}}
module.exports={FORMAT_CAS,FORMAT_ETUDE,SIGNAUX,CAUSES,SEUIL_FAUX_MM,reference,lireJournal,signauxCut,relireRail,extraire,classer,auc,cvSignal,bilanRegle,cvRegle,cvLevier,etudier,texte,preuve,main};
