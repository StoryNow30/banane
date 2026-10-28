#!/usr/bin/env node
'use strict';
/*
 * regles-metier.cjs — rejeu hors ligne des RÈGLES MÉTIER DE MIC (5.0), avec le module de l'extension (src/regles-metier.js) :
 * ce que l'ombre `regles-metier-ombre` aurait consigné sur un lot réel, et ce que chaque règle aurait coûté et rapporté si elle
 * avait été activée. Rien n'est activé : c'est une mesure.
 *
 * Deux modes.
 *   LOT : le journal Orbite d'une partie (ordre des décisions, étage, commande, issue réelle, pose de départ et pose validée)
 *     et son corpus GCV1 (la capture de chaque décision, pour la surface au ras) sont rejoués dans l'ordre du lot. Les verts sont
 *     lus dans le jeu d'apprentissage (pose de départ de la première visite de l'Écho : écartement) comme le lot les lirait dans
 *     la fenêtre de B1 (±5 lignes autour de chaque cut du lot) ; un vert que l'opérateur n'a pas visité n'a pas d'écartement connu : il
 *     manque à la fenêtre (limite écrite dans la sortie).
 *   ÉCHO : sans lot (parties d'un opérateur humain), chaque cut visité par l'opérateur est lu sur la meilleure capture de sa première
 *     visite (surface au ras) et sur sa pose de départ (écartement), dans l'ordre des cuts, comme si un lot les avait tous vus.
 *
 * Jugement, après coup seulement, par l'étiquette du jeu (correction de l'opérateur, règle « visité sans action = bon » comprise) :
 *   - cut que le lot a validé et qu'une règle aurait différé : faux vert évité (correction > 10 mm), bon cut différé en plus
 *     (≤ 10 mm), ou sans référence ;
 *   - zones de PN reconnues contre la liste de l'opérateur (`--pn`) : PN retrouvés, zones reconnues sans PN, cuts de PN couverts ;
 *   - zones d'ADV reconnues (rail de plus, en ombre) contre les zones de l'opérateur (`--adv`, avec leurs aiguilles) : zones retrouvées,
 *     aiguilles couvertes, plages sans ADV, alertes par rôle du cut (noyau d'aiguille à ±10 cuts, marge, PN, hors zone) ;
 *   - verts signalés : corrections > 10 mm et ≥ 25 mm (mauvais objet) retrouvées, signalements sur des cuts corrigés de 5 mm au plus.
 * Temps de l'opérateur : un cut posé juste qui devient différé lui coûte la différence entre poser et relire (médianes de l'Écho, parties
 * 29 et 1 du second projet : +0,9 et +1,7 s ; moyennes : +4,1 et +1,1 s) ; un vert signalé, une visite (≈ 2 s).
 *
 * Usage :
 *   node tools/regles-metier.cjs lot --partie P:N --journal J.json --corpus SEG.json [...] --jeu JEU.jsonl [--pn a-b,...] [--adv a-b:aig[+aig],...] [--sortie S.json]
 *   node tools/regles-metier.cjs echo --partie P:N --echo DOSSIER|FICHIER [...] --jeu JEU.jsonl [--pn a-b,...] [--adv a-b:aig[+aig],...] [--sortie S.json]
 *   node tools/regles-metier.cjs rapport S1.json S2.json ...       (tables en Markdown)
 *   node tools/regles-metier.cjs essai                             (fixture synthétique, sans donnée)
 *   --juger-partie-reservee : une partie réservée du manifeste est jugée sans réglage.
 * Sorties : agrégats et numéros de cut seulement ; aucune coordonnée, aucun identifiant de projet. Les entrées restent hors dépôt.
 */
const fs=require('node:fs');
const C=require('../vendor/capture-core.js');
const M=require('../src/regles-metier.js');
const Manifeste=require('./manifeste-parties.cjs');

const FORMAT='ariane-regles-metier-rejeu-v1';
const SIDES=['left','right'];
const FAUX_MM=10,BON_FIN_MM=5,MAUVAIS_OBJET_MM=25;
/* Secondes de l'opérateur (Écho des parties 29 et 1 du second projet) : différé posé par l'opérateur contre posé juste relu. */
const TEMPS=Object.freeze({differeEnPlusMedianeS:1.3,differeEnPlusHauteS:4.1,vertSignaleS:2});
const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;

/* --- Jeu d'apprentissage : étiquette de l'opérateur par cut (correction 3D du pire rail, règle « visité sans action = bon »). --- */
function lireJeu(chemin){
  const lignes=fs.readFileSync(chemin,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
  const cuts=new Map();
  for(const c of lignes.filter(x=>x.type==='cut')){
    const e=c.etiquette||{},bon=c.regleVisiteBon?.appliquee===true||c.contexte?.regleVisiteBon===true;
    const mm=e.correctionMm?.maxDist3dMm??(bon?0:null);
    const g=c.contexte?.ecartementInitialMm;
    cuts.set(c.cut,{cut:c.cut,classe:c.classe,mm:Number.isFinite(mm)?mm:null,ecartementInitialMm:Number.isFinite(g)&&Math.abs(g-1500)>0.05?g:null});
  }
  return {entete:lignes[0]?.type==='entete'?lignes[0]:null,cuts};
}
const juger=x=>x?.mm==null?'sans-ref':x.mm>FAUX_MM?'faux':x.mm<=BON_FIN_MM?'bon-fin':'bon';
/* Zones d'ADV de l'opérateur : « début-fin:aiguille+aiguille », séparées par des virgules (ex. 6558-6678:6638,7954-8066:8003). */
const plagesADV=t=>t?String(t).split(',').filter(Boolean).map(s=>{const m=/^(\d+)-(\d+):(\d+(?:\+\d+)*)$/.exec(s.trim());if(!m)throw Error('zone d\'ADV attendue a-b:aiguille[+aiguille] : '+s);
  return {debut:Number(m[1]),fin:Number(m[2]),aiguilles:m[3].split('+').map(Number)};}):[];
const NOYAU_CUTS=10;
const plages=t=>t?String(t).split(',').filter(Boolean).map(s=>{const m=/^(\d+)-(\d+)$/.exec(s.trim());if(!m)throw Error('plage attendue a-b : '+s);return [Number(m[1]),Number(m[2])];}):[];

/* --- Mode LOT : décisions du journal, issue réelle, poses (départ, validée), captures du corpus. --- */
function lireJournal(chemin,partie){
  const j=JSON.parse(fs.readFileSync(chemin,'utf8')),ev=j.events||[];
  const dec=ev.filter(e=>e.type==='gcv1-shadow-observed'&&e.identity?.part===partie&&e.lotObservation).sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp)));
  const valide=new Set(ev.filter(e=>e.type==='validation-accepted'&&e.identity?.part===partie).map(e=>e.identity.cut));
  const poses=new Map();
  for(const r of j.records||[]){if((r.identity?.part??r.part)!==partie)continue;const c=r.identity?.cut??r.cut,L=r.rails?.left,R=r.rails?.right;
    if(L?.corrected&&R?.corrected&&L.initial&&R.initial)poses.set(c,{initiale:{left:L.initial.positionSceneRelative,right:R.initial.positionSceneRelative},finale:{left:L.corrected.positionSceneRelative,right:R.corrected.positionSceneRelative}});}
  return {version:j.version??null,decisions:dec.map(e=>({cut:e.identity.cut,part:e.identity.part,captureId:e.lidarCaptureId,lo:e.lotObservation})),valide,poses};
}
function surfacesDuCorpus(fichiers,ids){
  const out=new Map();
  for(const f of fichiers){const c=JSON.parse(fs.readFileSync(f,'utf8'));
    for(const cl of c.clouds||[])if(ids.has(cl.captureId)&&cl.rails?.left&&cl.rails?.right&&Array.isArray(cl.pointsSceneRelative))out.set(cl.captureId,M.surface(cl));}
  return out;
}
/* Fenêtre de B1 simulée : ±5 lignes ; verts du jeu (écartement de la pose de départ), rouges du lot à venir (« invalid »),
 * cuts déjà validés par le lot (traités : jamais signalés), différés du lot (« invalid »). */
function fenetre(c,jeu,lot,passes,valides,f=5){
  const rows=[];
  for(let i=c-f;i<=c+f;i++){
    if(lot.has(i)){const vu=passes.has(i);rows.push({i,statut:vu&&valides.has(i)?'valid':'invalid',operateur:vu&&valides.has(i),vu,fraiche:false,ecartementMm:null});continue;}
    const x=jeu.get(i);if(x&&x.classe==='hors-journal'&&x.ecartementInitialMm!=null)rows.push({i,statut:'valid',operateur:false,vu:false,fraiche:false,ecartementMm:x.ecartementInitialMm});}
  return rows;
}
function rejouerLot({journal,surfaces,jeu,options}){
  const mem=M.creerMemoire('rejeu'),lot=new Set(journal.decisions.map(d=>d.cut)),passes=new Set(),evals=[],verts=[];
  for(const d of journal.decisions){
    const valide=journal.valide.has(d.cut),p=journal.poses.get(d.cut);
    const r=M.resumer({identity:{part:d.part,cut:d.cut},decision:d.lo,action:d.lo.command?.action??null,valide,surface:surfaces.get(d.captureId)||null,
      initiale:valide?p?.initiale:null,finale:valide?p?.finale:null});
    const e=M.evaluer(mem,r,options);evals.push({e,r});M.noter(mem,r,{differe:!valide},options);passes.add(d.cut);
    const v=M.lignes(mem,fenetre(d.cut,jeu.cuts,lot,passes,journal.valide),{cut:d.cut},options);for(const x of v.verts)verts.push({...x,parCut:d.cut,reference:v.reference.mm});
  }
  return {mem,evals,verts};
}

/* --- Mode ÉCHO : meilleure capture de la première visite de chaque cut, pose de départ. --- */
function lireEcho(entrees,partie){
  const V=require('./lire-volumes.cjs');
  const ents=entrees.flatMap(f=>V.entrees(f)).filter(x=>/ariane-echo-|native-v\d+-/.test(x.nom||x.chemin));
  const lire=en=>{try{return JSON.parse(en.lire());}catch{return null;}};
  const resoudre=D=>v=>{if(v&&typeof v==='object'&&typeof v.__ref==='string'){const [k,i]=v.__ref.split(':');return D[k]?.[Number(i)];}return v;};
  const visites=new Map();
  for(const en of ents){const e=lire(en);if(!e)continue;const res=resoudre(e.dictionaries||{});
    for(const r of e.records||[]){const id=res(r.identity);if(id?.part!==partie||!Number.isInteger(id.cut))continue;visites.set(r.visitId,{cut:id.cut,debut:r.startedAt});}}
  const premiere=new Map();for(const v of visites.values()){const p=premiere.get(v.cut);if(!p||v.debut<p)premiere.set(v.cut,v.debut);}
  const parCut=new Map();
  for(const en of ents){const e=lire(en);if(!e)continue;const res=resoudre(e.dictionaries||{}),caps=new Map();
    for(const c of e.clouds||[]){const v=visites.get(c.visitId);if(!v||!Array.isArray(c.pointsSceneRelative))continue;
      const o=caps.get(c.captureId)||{v,rails:{},pts:[],vis:[]};o.rails[c.side]=res(c.rail);
      for(let i=0;i<c.pointsSceneRelative.length;i++){o.pts.push(c.pointsSceneRelative[i]);o.vis.push(Array.isArray(c.visibleByClipBoxes)?c.visibleByClipBoxes[i]===true:true);}
      caps.set(c.captureId,o);}
    for(const o of caps.values()){if(!o.rails.left||!o.rails.right)continue;
      let s=M.surface({rails:o.rails,pointsSceneRelative:o.pts,visibleByClipBoxes:o.vis});
      /* Captures de l'Écho : la visibilité n'est pas toujours relevée ; trop peu de points visibles, on prend tous les points. */
      if(s.sidePoints<M.DEFAULTS.surface.sidePointsMin)s=M.surface({rails:o.rails,pointsSceneRelative:o.pts});
      const cand={premiere:o.v.debut===premiere.get(o.v.cut),utile:s.sidePoints>=M.DEFAULTS.surface.sidePointsMin,debut:o.v.debut,s};
      const rang=x=>(x.utile?2:0)+(x.premiere?1:0),prev=parCut.get(o.v.cut);
      if(!prev||rang(cand)>rang(prev)||rang(cand)===rang(prev)&&(cand.debut<prev.debut||cand.debut===prev.debut&&cand.s.sidePoints>prev.s.sidePoints))parCut.set(o.v.cut,cand);}}
  return {visites:premiere.size,surfaces:new Map([...parCut].map(([c,x])=>[c,x.s]))};
}
function rejouerEcho({surfaces,jeu,options}){
  const mem=M.creerMemoire('rejeu-echo'),evals=[],verts=[];
  const cuts=[...new Set([...surfaces.keys(),...jeu.cuts.keys()])].sort((a,b)=>a-b);
  for(const c of cuts){const r=M.resumer({identity:{part:null,cut:c},decision:null,action:null,valide:null,surface:surfaces.get(c)||null});
    evals.push({e:M.evaluer(mem,r,options),r});M.noter(mem,r,{differe:false},options);}
  /* Verts : chaque cut visité est un vert (aucun rouge connu) ; fenêtre de ±5 dans l'ordre des cuts. */
  const rowsDe=c=>{const rows=[];for(let i=c-5;i<=c+5;i++){const x=jeu.cuts.get(i);if(x?.classe==='hors-journal'&&x.ecartementInitialMm!=null)rows.push({i,statut:'valid',operateur:false,vu:false,fraiche:false,ecartementMm:x.ecartementInitialMm});}return rows;};
  mem.cuts.length=0;   // aucun rouge : la mémoire des cuts du lot ne doit pas faire des cuts visités des « rouges »
  for(const c of cuts){const v=M.lignes(mem,rowsDe(c),{cut:c},options);for(const x of v.verts)verts.push({...x,parCut:c,reference:v.reference.mm});}
  return {mem,evals,verts};
}

/* --- Bilan commun --- */
function bilan({evals,verts,mem,jeu,pnMic,advMic=[],mode}){
  const parRegle={},tous={signales:0,faux:0,bon:0,bonFin:0,sansRef:0,cuts:[]};
  const compter=(o,x,c)=>{o.signales++;const j=juger(x);if(j==='faux')o.faux++;else if(j==='sans-ref')o.sansRef++;else{o.bon++;if(j==='bon-fin')o.bonFin++;}o.cuts.push({cut:c,jugement:j,mm:r1(x?.mm)});};
  for(const id of M.REGLES)parRegle[id]={signales:0,faux:0,bon:0,bonFin:0,sansRef:0,cuts:[]};
  let poses=0,fauxVerts=0,avecRef=0;
  for(const {e,r} of evals){if(r.valide!==true)continue;poses++;const x=jeu.cuts.get(r.cut),j=juger(x);if(j!=='sans-ref')avecRef++;if(j==='faux')fauxVerts++;
    for(const id of e.regles)compter(parRegle[id],x,r.cut);if(e.aurait==='differer')compter(tous,x,r.cut);}
  const temps=o=>({medianeMin:r1((o.bon+o.sansRef)*TEMPS.differeEnPlusMedianeS/60),hauteMin:r1((o.bon+o.sansRef)*TEMPS.differeEnPlusHauteS/60)});
  for(const o of [...Object.values(parRegle),tous])o.tempsMic=temps(o);
  /* Zones de PN. */
  const zones=mem.zones.map(z=>({debut:z.debut,fin:z.fin,controle:[z.debut-M.DEFAULTS.pn.margeAvant,z.fin+M.DEFAULTS.pn.margeApres]}));
  const croise=([a,b],[c,d])=>a<=d&&c<=b;
  const pn={mic:pnMic,detectees:zones,
    micRetrouves:pnMic.filter(p=>zones.some(z=>croise(p,z.controle))).length,
    zonesSansPN:zones.filter(z=>!pnMic.some(p=>croise(p,z.controle))).map(z=>z.controle),
    coeursNonConfirmes:evals.filter(({e})=>e.zone.pn==='coeur-non-confirme').map(({r})=>r.cut),
    cutsMicCouverts:pnMic.reduce((n,[a,b])=>n+Array.from({length:b-a+1},(_,k)=>a+k).filter(c=>zones.some(z=>c>=z.controle[0]&&c<=z.controle[1])).length,0),
    cutsMic:pnMic.reduce((n,[a,b])=>n+b-a+1,0)};
  /* Verts signalés. */
  const etiq=[...jeu.cuts.values()].filter(x=>x.classe==='hors-journal'&&x.mm!=null);
  const v={signales:0,etiquetes:0,plus10:0,objet25:0,fin5:0,parRaison:{},
    total:{etiquetes:etiq.length,plus10:etiq.filter(x=>x.mm>FAUX_MM).length,objet25:etiq.filter(x=>x.mm>=MAUVAIS_OBJET_MM).length}};
  const union=new Map();for(const s of verts){const u=union.get(s.i)||new Set();for(const k of s.raisons)u.add(k);union.set(s.i,u);}
  v.signales=union.size;
  for(const [i,raisons] of union){const x=jeu.cuts.get(i);const lab=x?.classe==='hors-journal'&&x.mm!=null;
    for(const raison of raisons){const o=v.parRaison[raison]||(v.parRaison[raison]={signales:0,etiquetes:0,plus10:0,objet25:0,fin5:0});o.signales++;
      if(lab){o.etiquetes++;if(x.mm>FAUX_MM)o.plus10++;if(x.mm>=MAUVAIS_OBJET_MM)o.objet25++;if(x.mm<=BON_FIN_MM)o.fin5++;}}
    if(lab){v.etiquetes++;if(x.mm>FAUX_MM)v.plus10++;if(x.mm>=MAUVAIS_OBJET_MM)v.objet25++;if(x.mm<=BON_FIN_MM)v.fin5++;}}
  v.tempsMicMin=r1(union.size*TEMPS.vertSignaleS/60);
  /* Détecteurs comparés sur les mêmes cuts : `flushPct` seul (30 ou 50 %, un cœur suffit), quarts sans confirmation, détecteur retenu
   * (deux cœurs consécutifs parmi les cuts vus) et règle d'avant (deux cœurs à 3 cuts au plus, `sans-consecutifs` ; fiches/PN_ROBUSTE.md). */
  const variantes={};
  for(const [id,coeur,confirmation,consecutifs] of [['flushPct-30',r=>r.flushPct!=null&&r.flushPct>=30,1],['flushPct-50',r=>r.flushPct!=null&&r.flushPct>=50,1],
    ['quarts-sans-confirmation',r=>r.coeurPN,1],['retenu',r=>r.coeurPN,M.DEFAULTS.pn.confirmation],['sans-consecutifs',r=>r.coeurPN,M.DEFAULTS.pn.confirmation,false]]){
    const m=M.creerMemoire('variante'),opt={pn:{confirmation,...(consecutifs===false?{consecutifs:false}:{})}};
    for(const {r} of evals){const x={...r,coeurPN:coeur(r)};M.noter(m,x,{differe:r.valide===false},opt);}
    const zs=m.zones.map(z=>[z.debut-M.DEFAULTS.pn.margeAvant,z.fin+M.DEFAULTS.pn.margeApres]);
    variantes[id]={zones:zs.length,micRetrouves:pnMic.filter(p=>zs.some(z=>croise(p,z))).length,zonesSansPN:zs.filter(z=>!pnMic.some(p=>croise(p,z))).length,
      cutsEnZone:zs.reduce((n,[a,b])=>n+b-a+1,0)};}
  pn.variantes=variantes;
  /* Règle d'écartement sur tous les verts étiquetés de la partie (pose de départ) : seuil fixe autour de 1 435 mm, seuil autour
   * de la médiane de la partie, seuil autour de la médiane des voisins visités (±5 cuts). Mesure, pas une règle de plus. */
  const gv=[...jeu.cuts.values()].filter(x=>x.classe==='hors-journal'&&x.mm!=null&&x.ecartementInitialMm!=null);
  const mediane=t=>{const s=t.slice().sort((a,b)=>a-b),k=s.length>>1;return s.length?(s.length%2?s[k]:(s[k-1]+s[k])/2):null;};
  const medPartie=mediane(gv.map(x=>x.ecartementInitialMm)),parCutG=new Map(gv.map(x=>[x.cut,x.ecartementInitialMm]));
  const voisins=c=>{const t=[];for(let d=-5;d<=5;d++){if(d&&parCutG.has(c+d))t.push(parCutG.get(c+d));}return t.length>=2?mediane(t):null;};
  const ecartement={verts:gv.length,medianePartieMm:r1(medPartie),plus10:gv.filter(x=>x.mm>FAUX_MM).length,objet25:gv.filter(x=>x.mm>=MAUVAIS_OBJET_MM).length,variantes:{}};
  for(const [id,f] of [['fixe-1435-10',x=>Math.abs(x.ecartementInitialMm-1435)>10],['fixe-1435-15',x=>Math.abs(x.ecartementInitialMm-1435)>15],
    ['partie-10',x=>Math.abs(x.ecartementInitialMm-medPartie)>10],['partie-15',x=>Math.abs(x.ecartementInitialMm-medPartie)>15],
    ['voisins-10',x=>{const m=voisins(x.cut);return m!=null&&Math.abs(x.ecartementInitialMm-m)>10;}]]){
    const sg=gv.filter(f);ecartement.variantes[id]={signales:sg.length,plus10:sg.filter(x=>x.mm>FAUX_MM).length,objet25:sg.filter(x=>x.mm>=MAUVAIS_OBJET_MM).length,fin5:sg.filter(x=>x.mm<=BON_FIN_MM).length};}
  /* Zones d'ADV : zones reconnues (plages à contrôler) contre les zones de l'opérateur ; aiguilles couvertes ; alertes par rôle du cut
   * (noyau : à 10 cuts au plus d'une aiguille ; marge : reste de la zone de l'opérateur ; PN ; hors zone). */
  /* Plages lues sur les évaluations (comme la liste des verts les lit sur les événements) : la mémoire du lot ne garde que les 8 dernières. */
  const zA=[];for(const {e} of evals){const c=e.zone?.advControle;if(Array.isArray(c)&&!zA.some(z=>z[0]===c[0]&&z[1]===c[1]))zA.push(c.slice());}
  const fondues=[];for(const z of zA.map(z=>z.slice()).sort((a,b)=>a[0]-b[0])){const d=fondues.at(-1);if(d&&z[0]<=d[1]+1)d[1]=Math.max(d[1],z[1]);else fondues.push(z);}
  const dansMic=c=>advMic.find(a=>c>=a.debut&&c<=a.fin),aig=advMic.flatMap(a=>a.aiguilles);
  const role=c=>{const d=aig.length?Math.min(...aig.map(x=>Math.abs(c-x))):Infinity;if(d<=NOYAU_CUTS)return 'noyau';if(dansMic(c))return 'marge';
    if(pnMic.some(([a,b])=>c>=a&&c<=b))return 'pn';return 'hors';};
  const parRole={noyau:{cuts:0,alertes:0},marge:{cuts:0,alertes:0},pn:{cuts:0,alertes:0},hors:{cuts:0,alertes:0,cutsAlerte:[]}};
  for(const {r} of evals){if(!Number.isInteger(r.advRails))continue;const k=role(r.cut),o=parRole[k];o.cuts++;if(r.advRails>0){o.alertes++;if(k==='hors')o.cutsAlerte.push(r.cut);}}
  const cutsDe=zs=>zs.reduce((n,[a,b])=>n+b-a+1,0);
  const adv={mic:advMic.map(a=>({debut:a.debut,fin:a.fin,aiguilles:a.aiguilles,vus:evals.filter(({r})=>r.cut>=a.debut&&r.cut<=a.fin&&Number.isInteger(r.advRails)).length})),
    plages:fondues,
    micRetrouvees:advMic.filter(a=>fondues.some(([x,y])=>croise([a.debut,a.fin],[x,y]))).length,
    aiguilles:aig.length,aiguillesCouvertes:aig.filter(c=>fondues.some(([x,y])=>c>=x&&c<=y)).length,
    aiguillesManquees:aig.filter(c=>!fondues.some(([x,y])=>c>=x&&c<=y)),
    plagesSansADV:fondues.filter(([x,y])=>!advMic.some(a=>croise([a.debut,a.fin],[x,y]))),
    cutsMic:advMic.reduce((n,a)=>n+a.fin-a.debut+1,0),
    cutsMicCouverts:advMic.reduce((n,a)=>{let k=0;for(let c=a.debut;c<=a.fin;c++)if(fondues.some(([x,y])=>c>=x&&c<=y))k++;return n+k;},0),
    cutsPlages:cutsDe(fondues),
    cutsPlagesHorsMic:fondues.reduce((n,[x,y])=>{let k=0;for(let c=x;c<=y;c++)if(!dansMic(c))k++;return n+k;},0),
    alertesNonConfirmees:evals.filter(({e})=>e.zone.adv==='alerte-non-confirmee').map(({r})=>r.cut),
    parRole};
  return {mode,lot:{decisions:evals.length,poses,posesAvecRef:avecRef,fauxVerts},regles:parRegle,combine:tous,zonesPN:pn,zonesADV:adv,verts:v,ecartement};
}

function lireArguments(argv){
  const o={mode:argv[0],corpus:[],echo:[],fichiers:[]};
  for(let i=1;i<argv.length;i++){const a=argv[i],val=()=>argv[++i];
    if(a==='--partie')o.partie=Manifeste.lireDesignations(val());else if(a==='--juger-partie-reservee')o.jugerReservee=true;
    else if(a==='--journal')o.journal=val();else if(a==='--corpus')o.corpus.push(val());else if(a==='--echo')o.echo.push(val());
    else if(a==='--jeu')o.jeu=val();else if(a==='--pn')o.pn=plages(val());else if(a==='--adv')o.adv=plagesADV(val());else if(a==='--sortie')o.sortie=val();
    else if(!a.startsWith('--'))o.fichiers.push(a);else throw Error('option inconnue : '+a);}
  return o;
}
function executer(o){
  if(!o.partie||o.partie.length!==1)throw Error('--partie PROJET:PARTIE attendu (une seule partie)');
  const m=Manifeste.lire(),d=o.partie[0];const {avis}=Manifeste.controler(m,o.partie,{outil:'regles-metier',jugerReservee:!!o.jugerReservee});if(avis)console.error(avis);
  const jeu=lireJeu(o.jeu),pn=o.pn||[];let r,source;
  if(o.mode==='lot'){const journal=lireJournal(o.journal,d.partie);const ids=new Set(journal.decisions.map(x=>x.captureId));
    const surfaces=surfacesDuCorpus(o.corpus,ids);r=rejouerLot({journal,surfaces,jeu});
    source={version:journal.version,decisions:journal.decisions.length,surfaces:surfaces.size,validesAuJournal:journal.valide.size};}
  else if(o.mode==='echo'){const e=lireEcho(o.echo,d.partie);r=rejouerEcho({surfaces:e.surfaces,jeu});source={visites:e.visites,surfaces:e.surfaces.size};}
  else throw Error('mode lot ou echo attendu');
  const b=bilan({...r,jeu,pnMic:pn,advMic:o.adv||[],mode:o.mode});
  return {format:FORMAT,module:M.DEFAULTS.version,projet:d.projet,partie:d.partie,manifeste:Manifeste.statut(m,d.projet,d.partie),source,seuils:JSON.parse(JSON.stringify(M.DEFAULTS)),temps:TEMPS,...b,
    limites:o.mode==='lot'?['verts : seuls ceux que l\'opérateur a visités ont un écartement connu','activation : effet du premier ordre (les décisions suivantes ne sont pas recalculées)']:['aucun lot : les règles du lot (différer) ne s\'appliquent pas ; zones et verts seulement']};
}
function rapport(sorties){
  const L=[],pct=(a,b)=>b?Math.round(100*a/b)+' %':'—';
  L.push('| Partie | Manifeste | Mode | Posés / avec réf. (faux verts) | Règle | Différés en plus | dont faux verts évités | bons différés (≤ 5 mm) | sans réf. | Minutes de l\'opérateur (méd. – haute) |','|---|---|---|---|---|--:|--:|--:|--:|---|');
  for(const s of sorties){if(s.mode!=='lot')continue;
    for(const [id,o] of [...Object.entries(s.regles),['toutes',s.combine]])
      L.push(`| ${s.projet}:${s.partie} | ${s.manifeste} | ${s.mode} | ${s.lot.poses} / ${s.lot.posesAvecRef} (${s.lot.fauxVerts}) | ${id} | ${o.signales} | ${o.faux} | ${o.bon} (${o.bonFin}) | ${o.sansRef} | ${o.tempsMic.medianeMin} – ${o.tempsMic.hauteMin} |`);}
  L.push('','| Partie | Mode | PN de Mic retrouvés | Zones reconnues sans PN | Cœurs non confirmés | Cuts de PN couverts |','|---|---|--:|--:|--:|--:|');
  for(const s of sorties){const z=s.zonesPN;L.push(`| ${s.projet}:${s.partie} | ${s.mode} | ${z.mic.length?z.micRetrouves+'/'+z.mic.length:'liste absente'} | ${z.zonesSansPN.length} | ${z.coeursNonConfirmes.length} | ${z.cutsMic?z.cutsMicCouverts+'/'+z.cutsMic:'—'} |`);}
  L.push('','| Partie | Mode | Détecteur | Zones | PN de Mic retrouvés | Zones sans PN | Cuts en zone |','|---|---|---|--:|--:|--:|--:|');
  for(const s of sorties)for(const [id,v] of Object.entries(s.zonesPN.variantes||{}))L.push(`| ${s.projet}:${s.partie} | ${s.mode} | ${id} | ${v.zones} | ${s.zonesPN.mic.length?v.micRetrouves+'/'+s.zonesPN.mic.length:'liste absente'} | ${v.zonesSansPN} | ${v.cutsEnZone} |`);
  L.push('','| Partie | Mode | Zones d\'ADV de l\'opérateur retrouvées | Aiguilles couvertes | Plages sans ADV | Cuts des zones de l\'opérateur couverts | Cuts des plages hors zones de l\'opérateur | Alertes : noyau / marge / PN / hors zone |','|---|---|--:|--:|--:|--:|--:|---|');
  for(const s of sorties){const z=s.zonesADV;if(!z)continue;const R=z.parRole,t=k=>`${R[k].alertes}/${R[k].cuts}`;
    L.push(`| ${s.projet}:${s.partie} | ${s.mode} | ${z.mic.length?z.micRetrouvees+'/'+z.mic.length:'liste absente'} | ${z.aiguilles?z.aiguillesCouvertes+'/'+z.aiguilles:'—'} | ${z.plagesSansADV.length} | ${z.cutsMic?z.cutsMicCouverts+'/'+z.cutsMic:'—'} | ${z.cutsPlagesHorsMic} | ${t('noyau')} / ${t('marge')} / ${t('pn')} / ${t('hors')} |`);}
  L.push('','| Partie | Mode | Verts signalés | étiquetés | > 10 mm retrouvés | ≥ 25 mm retrouvés | ≤ 5 mm (fausses alertes) | Minutes de l\'opérateur |','|---|---|--:|--:|--:|--:|--:|--:|');
  for(const s of sorties){const v=s.verts;L.push(`| ${s.projet}:${s.partie} | ${s.mode} | ${v.signales} | ${v.etiquetes} | ${v.plus10}/${v.total.plus10} (${pct(v.plus10,v.total.plus10)}) | ${v.objet25}/${v.total.objet25} | ${v.fin5} | ${v.tempsMicMin} |`);}
  L.push('','| Partie | Verts étiquetés (> 10 mm ; ≥ 25 mm) | Médiane de la partie | Variante | Signalés | > 10 mm | ≥ 25 mm | ≤ 5 mm |','|---|---|--:|---|--:|--:|--:|--:|');
  const vues=new Set();
  for(const s of sorties){const e=s.ecartement,cle=s.projet+':'+s.partie;if(!e||vues.has(cle))continue;vues.add(cle);
    for(const [id,v] of Object.entries(e.variantes))L.push(`| ${cle} | ${e.verts} (${e.plus10} ; ${e.objet25}) | ${e.medianePartieMm} | ${id} | ${v.signales} | ${v.plus10} | ${v.objet25} | ${v.fin5} |`);}
  return L.join('\n');
}

/* Fixture synthétique (essai) : une voie droite, un PN de 4 cœurs, une grappe de différés, des verts dont un mal extrait. */
function essai(){
  const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],rail=y=>({positionSceneRelative:[0,y,0],sceneRelativeToProfileLocal:I,profileLocalToSceneRelative:I});
  const cap=z=>{const pts=[];for(let x=-0.5;x<=0.5001;x+=0.1)for(let y=-1.3;y<=1.3001;y+=0.02)pts.push([x,y,z]);return {rails:{left:rail(-0.7175),right:rail(0.7175)},pointsSceneRelative:pts,visibleByClipBoxes:pts.map(()=>true)};};
  const surfaces=new Map(),decisions=[],valide=new Set(),poses=new Map(),cuts=new Map();
  const pose=d=>({initiale:{left:[0,-0.7175,0],right:[0,0.7175,0]},finale:{left:[0,-0.7175,d/1000],right:[0,0.7175,0]}});
  const lotCuts=[[10,'v',-0.16],[20,'v',-0.01],[21,'v',-0.01],[22,'v',-0.01],[23,'v',-0.01],[26,'v',-0.16],[40,'d',-0.16],[41,'d',-0.16],[42,'v',-0.16],[60,'v',-0.16]];
  for(const [c,k,z] of lotCuts){const id='cap'+c;surfaces.set(id,M.surface(cap(z)));decisions.push({cut:c,part:9,captureId:id,lo:{stage:k==='v'?'first-pass':'deferred',command:{action:k==='v'?'engine':'defer'}}});
    if(k==='v'){valide.add(c);poses.set(c,pose(5));}cuts.set(c,{cut:c,classe:k==='v'?'posee':'differee',mm:k==='v'?(c===42||c===22?14:3):40,ecartementInitialMm:null});}
  for(let c=0;c<70;c++)if(!cuts.has(c))cuts.set(c,{cut:c,classe:'hors-journal',mm:c===24?33:c===59?2:1,ecartementInitialMm:c===24?1470:1437});
  const r=rejouerLot({journal:{decisions,valide,poses},surfaces,jeu:{cuts}});
  return {format:FORMAT,module:M.DEFAULTS.version,projet:0,partie:0,manifeste:'essai',...bilan({...r,jeu:{cuts},pnMic:[[18,27]],mode:'lot'})};
}

if(require.main===module){
  const argv=process.argv.slice(2);
  try{
    let out;
    if(argv[0]==='essai')out=essai();
    else if(argv[0]==='rapport'){console.log(rapport(argv.slice(1).map(f=>JSON.parse(fs.readFileSync(f,'utf8')))));process.exit(0);}
    else{const o=lireArguments(argv);out=executer(o);if(o.sortie)fs.writeFileSync(o.sortie,JSON.stringify(out,null,1));}
    if(!argv.includes('--sortie'))console.log(JSON.stringify(out,null,1));
    else console.log(rapport([out]));
  }catch(e){console.error(e.message);process.exit(2);}
}
module.exports={FORMAT,TEMPS,lireJeu,lireJournal,rejouerLot,rejouerEcho,bilan,rapport,essai,executer,lireArguments,fenetre};
