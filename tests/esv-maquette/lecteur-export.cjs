'use strict';
/*
 * lecteur-export.cjs — construit un scénario de maquette à partir d'un VRAI
 * export d'Ariane, pour rejouer un lot réel sans ESV :
 *   - Orbite : bilan « banane-test-dataset-v4 » (+ `clouds`), corpus
 *     « banane-gcv1-lidar-corpus-v1 », ou journal « banane-test-journal-v4 »
 *     accompagné d'un fichier de nuages ; nuages = captures « banane-lidar-capture-v1 »
 *     (points des fenêtres, nœuds, découpe réelle), poses de départ = `rails.*.initial`
 *     ou `before.rails` des enregistrements ; référence = pose corrigée par Ariane ;
 *   - Écho : session « banane-native-session-v2 » complète, ou segments
 *     « banane-native-session-v3-compact » (dossier ; relus par tools/merge-segments.cjs) ;
 *     nuages = blocs « banane-native-lidar-chunk-v1 » (points des fenêtres par rail,
 *     visibles par la découpe) ; pose de départ = pose au moment de la lecture ;
 *     référence = pose finale humaine (`humanFinalReference.state`), intention VALIDATE / SKIP.
 *
 *   node tests/esv-maquette/lecteur-export.cjs FICHIER_OU_DOSSIER [--part N] [--valides K]
 *
 * Sortie : le même format que scenario.cjs (`banane-esv-maquette-scenario-v1`),
 * plus `provenance` et, par cut, `reference` (pose humaine ou d'Ariane, en scène)
 * et `exclus` (cuts sans nuage ou sans pose, avec la raison). Rien n'est écrit.
 * Les coordonnées monde sont factices ; les coordonnées scène sont celles de l'export.
 */
const fs=require('node:fs'),path=require('node:path');
const C=require('../../vendor/capture-core.js');
const S=require('./scenario.cjs');
const X=require('../../src/native-export.js');
const {mergeFiles}=require('../../tools/merge-segments.cjs');
const lireJson=f=>JSON.parse(fs.readFileSync(f,'utf8'));
/* Charge un fichier ou un dossier : un document unique {records, events, clouds, …}. */
function charger(entree){
  const st=fs.statSync(entree);
  const fichiers=st.isDirectory()?fs.readdirSync(entree).filter(f=>f.endsWith('.json')).sort().map(f=>path.join(entree,f)):[entree];
  /* Un fichier compact (`banane-native-session-v3-compact`, dictionnaires) se reconnaît une fois lu, pas à son en-tête :
   * le bilan allégé 4.9 porte sa clé `format` en fin de fichier. Les compacts sont relus et chaînés par mergeFiles (KI-060). */
  const compacts=[],docs=[];
  for(const f of fichiers){const d=lireJson(f);if(d&&(d.format===X.FORMAT||d.dictionaries))compacts.push(f);else docs.push(d);}
  if(compacts.length)docs.push(mergeFiles(compacts).merged);
  return fusionner(docs);
}
function fusionner(docs){const out={formats:[],records:[],events:[],clouds:[],state:null,session:null,doublons:0};
  for(const d of docs){out.formats.push(d.format||'?');for(const k of ['records','events','clouds'])if(Array.isArray(d[k]))out[k].push(...d[k]);
    if(d.state)out.state=d.state;if(d.session)out.session=d.session;}
  /* Un même enregistrement peut figurer dans plusieurs fichiers d'un export (journal et bilan) : une seule copie,
   * celle qui porte une identité. Idem pour les nuages (captureId) et les événements (eventId). */
  const dedup=(liste,cle,mieux)=>{const m=new Map();for(const x of liste){const k=cle(x);if(k===undefined||k===null){m.set(Symbol(),x);continue;}
    const prev=m.get(k);if(!prev||mieux&&mieux(x)&&!mieux(prev))m.set(k,x);else if(prev)out.doublons++;}return [...m.values()];};
  out.records=dedup(out.records,r=>r.recordId||r.id,r=>!!identite(r)?.cut);out.clouds=dedup(out.clouds,c=>c.chunkId||c.captureId); /* un bloc Écho a son chunkId ; une capture Orbite son captureId */out.events=dedup(out.events,e=>e.eventId);
  return out;}
const identite=r=>r.identity||r.before?.identity||(Number.isInteger(r.cut)?{part:r.part,cut:r.cut}:null);
const EDGES=['XLeftEdge','YLeftEdge','ZLeftEdge','XRightEdge','YRightEdge','ZRightEdge'];
/* T (monde − scène) par repère de scène, mesurée comme B1 (src/appuis-liste.js, 4.9) : corps d'une écriture
 * observée (monde, `esv-observation` kind `write`, `rowIndex` = cut) moins la pose corrigée du même cut (scène). */
function translationsParRepere(doc){const out=new Map();
  const ecrits=doc.events.filter(e=>e.type==='esv-observation'&&e.kind==='write'&&e.body&&EDGES.every(k=>Number.isFinite(e.body[k]))&&Number.isInteger(e.rowIndex));
  for(const e of ecrits){const r=doc.records.find(r=>identite(r)?.cut===e.rowIndex&&r.rails?.left?.corrected?.positionSceneRelative&&r.rails?.right?.corrected?.positionSceneRelative);
    if(!r)continue;const frame=identite(r).frameId||r.coordinateBridge?.sceneFrameId||'?';
    const dl=[0,1,2].map(i=>e.body[EDGES[i]]-r.rails.left.corrected.positionSceneRelative[i]),dr=[0,1,2].map(i=>e.body[EDGES[3+i]]-r.rails.right.corrected.positionSceneRelative[i]);
    const rigideMm=Math.hypot(...dl.map((v,i)=>v-dr[i]))*1000;if(rigideMm>2)continue;
    const T=[0,1,2].map(i=>(dl[i]+dr[i])/2),m=out.get(frame);if(!m)out.set(frame,{T,mesures:1,ecartMaxMm:0});
    else{m.ecartMaxMm=Math.max(m.ecartMaxMm,Math.hypot(...T.map((v,i)=>v-m.T[i]))*1000);m.mesures++;}}
  return out;}
const poseRail=(r,side)=>r.rails?.[side]?.initial||r.before?.rails?.[side]||r.initialObserved?.rails?.[side]||null;
const reference=(r,side)=>r.rails?.[side]?.corrected||null;
/* ---------- Orbite ---------- */
function cutsOrbite(doc){
  const captures=new Map(doc.clouds.filter(c=>c.format==='banane-lidar-capture-v1'&&c.captureId).map(c=>[c.captureId,c]));
  const parCut=new Map(),exclus=[];
  for(const r of doc.records){const id=identite(r);if(!id||!Number.isInteger(id.cut)){exclus.push({raison:'enregistrement sans identité',format:r.format});continue;}
    const cle=`${id.part}|${id.cut}`;if(parCut.has(cle))continue; /* premier passage : pose de départ d'ESV */
    const captureId=r.lidarCaptureId||r.lidarId||r.captureId||null,capture=captureId?captures.get(captureId):null;
    if(!capture){exclus.push({part:id.part,cut:id.cut,raison:captureId?'nuage absent de l’export':'enregistrement sans identifiant de nuage',format:r.format});continue;}
    const rails={};for(const s of ['left','right']){const p=poseRail(r,s)||capture.rails?.[s];if(!p){exclus.push({part:id.part,cut:id.cut,raison:'pose de départ absente : '+s});break;}
      rails[s]={...p,profileContours:p.profileContours?.length?p.profileContours:capture.rails?.[s]?.profileContours||[]};}
    if(!rails.left||!rails.right)continue;
    const ref={};for(const s of ['left','right']){const c=reference(r,s);if(c)ref[s]=c.positionSceneRelative;}
    parCut.set(cle,{part:id.part,cut:id.cut,frame:id.frameId||r.coordinateBridge?.sceneFrameId||capture.identity?.frameId||capture.coordinateBridge?.sceneFrameId||'?',capture:{...capture,rails},status:'invalid',reference:Object.keys(ref).length===2?{source:'ariane',positions:ref}:null,
      intent:r.decision||r.operatorDecision||(r.rails?'POSE':null),format:r.format});}
  /* Nuages sans enregistrement (dernier cut d'un lot, par exemple) : rejouables avec la pose de la capture. */
  for(const c of captures.values()){const id=identite(c);if(!id||!Number.isInteger(id.cut))continue;const cle=`${id.part}|${id.cut}`;if(parCut.has(cle))continue;
    parCut.set(cle,{part:id.part,cut:id.cut,frame:id.frameId||c.coordinateBridge?.sceneFrameId||'?',capture:c,status:'invalid',reference:null,intent:null,format:c.format});}
  return {cuts:[...parCut.values()],exclus};
}
/* ---------- Écho ---------- */
function cutsEcho(doc){
  const blocs=doc.clouds.filter(c=>c.format==='banane-native-lidar-chunk-v1'),captures=new Map(doc.clouds.filter(c=>c.format==='banane-native-lidar-capture-v2').map(c=>[c.captureId,c]));
  const parVisite=new Map();for(const b of blocs){const cle=b.visitId||b.captureId;if(!parVisite.has(cle))parVisite.set(cle,[]);parVisite.get(cle).push(b);}
  const parCut=new Map(),exclus=[];
  const visites=doc.records.filter(r=>r.format==='banane-native-visit-v2').sort((a,b)=>(a.visitIndex??0)-(b.visitIndex??0));
  for(const v of visites){const id=v.identity;if(!Number.isInteger(id?.cut)){exclus.push({raison:'visite sans identité'});continue;}
    const cle=`${id.part}|${id.cut}`;if(parCut.has(cle))continue;
    const mes=parVisite.get(v.visitId)||blocs.filter(b=>(v.lidarChunkIds||[]).includes(b.chunkId));
    if(!mes.length){exclus.push({part:id.part,cut:id.cut,raison:'aucun bloc de points pour cette visite'});continue;}
    const rails={},noeuds=[],captureId=mes[0].captureId;
    for(const s of ['left','right']){const bs=mes.filter(b=>b.side===s);const pose=bs[0]?.rail||poseRail(v,s)||v.beforeEstablished?.rails?.[s];
      if(!pose){exclus.push({part:id.part,cut:id.cut,raison:'pose de départ absente : '+s});break;}
      rails[s]={...pose,profileContours:pose.profileContours||[]};
      bs.forEach((b,i)=>{const pts=[];b.pointsSceneRelative.forEach((p,k)=>{if(b.visibleByClipBoxes?.[k]!==false)pts.push(p);});
        noeuds.push({id:`${s}-${i}`,points:pts});});}
    if(!rails.left||!rails.right)continue;
    const humain=v.humanFinalReference?.state?.rails||(v.operatorIntent==='VALIDATE'?v.finalObserved?.rails:null);
    const ref=humain&&humain.left&&humain.right?{source:'humaine',positions:{left:humain.left.positionSceneRelative,right:humain.right.positionSceneRelative},statut:v.humanFinalReference?.status||'finalObserved'}:null;
    /* Capture au format de scenario.cjs : un nœud par bloc, points des fenêtres visibles par la découpe. */
    const capture={captureId,part:id.part,cut:id.cut,shape:id.shape||'U50',rails,clouds:captures.get(captureId)?.clouds||[],
      nodes:noeuds.map(n=>({id:n.id})),pointsSceneRelative:noeuds.flatMap(n=>n.points),pointSources:noeuds.flatMap((n,ni)=>n.points.map((_,k)=>[ni,k])),attributes:{}};
    parCut.set(cle,{part:id.part,cut:id.cut,frame:id.frameId||'?',capture,status:'invalid',reference:ref,intent:v.operatorIntent||null,format:v.format});}
  return {cuts:[...parCut.values()],exclus};
}
/* ---------- scénario ---------- */
/* Placement : tous les cuts d'un même repère de scène (`frameId`, une page d'ESV) partagent une origine, car
 * Ariane exprime leurs poses et leurs points dans ce repère commun (mesuré : cut 105 à 2 m du cut 103 dans le
 * même repère). Origine = T réelle (monde = scène + T) si une écriture observée la donne (export 4.9),
 * sinon une origine factice par repère, décalée pour que deux pages ne se superposent pas. */
function construire(entree,options={}){
  const doc=charger(entree);const echo=doc.records.some(r=>r.format==='banane-native-visit-v2');
  const {cuts,exclus}=echo?cutsEcho(doc):cutsOrbite(doc);
  const parts=[...new Set(cuts.map(c=>c.part))].sort((a,b)=>a-b).filter(p=>!Number.isInteger(options.part)||p===options.part);
  if(!parts.length)throw Error('Aucun cut rejouable dans '+entree+(exclus.length?` (${exclus.length} exclus : ${exclus[0].raison})`:''));
  const Ts=translationsParRepere(doc),reperes=new Map();let nFactice=0;
  const origineDe=frame=>{if(!reperes.has(frame)){const t=Ts.get(frame);
    reperes.set(frame,t?{origine:t.T.map(v=>S.arrondi(v,6)),monde:'reel',mesures:t.mesures,ecartMaxMm:S.arrondi(t.ecartMaxMm,1)}:{origine:S.ORIGINE_MONDE.map((v,j)=>v+(j===0?100*nFactice++:0)),monde:'factice'});}
    return reperes.get(frame);};
  const valides=Number(options.valides)||0;let rang=0;
  const parties=parts.map(part=>{const liste=cuts.filter(c=>c.part===part).sort((a,b)=>a.cut-b.cut);
    return {part,table:`maquette-${part}`,cuts:liste.map((c,i)=>{const rep=origineDe(c.frame),origine=rep.origine;
      /* --valides K : un cut rejouable sur K, s'il a une référence, est servi déjà validé À la pose de référence (appui pour B1, sauté par le lot). */
      const preValide=valides>0&&c.reference&&(++rang)%valides===0;
      const capture=preValide?{...c.capture,rails:Object.fromEntries(['left','right'].map(s=>{const r=c.capture.rails[s],d=c.reference.positions[s].map((v,j)=>v-r.positionSceneRelative[j]);
        const tr=C.translation(d);return [s,{...r,railLocalToSceneRelative:C.multiply(tr,r.railLocalToSceneRelative),profileLocalToSceneRelative:C.multiply(tr,r.profileLocalToSceneRelative),
          sceneRelativeToProfileLocal:C.inverse(C.multiply(tr,r.profileLocalToSceneRelative)),positionSceneRelative:c.reference.positions[s]}];}))}:c.capture;
      return {cut:c.cut,index:i,status:preValide?'valid':c.status,preValide,origine,frame:c.frame,monde:rep.monde,source:`${c.format}:${c.capture.captureId}`,shape:c.capture.shape||'U50',
        rails:{left:S.rail(capture,'left',origine),right:S.rail(capture,'right',origine)},noeuds:S.noeuds(c.capture),decoupe:S.decoupe(c.capture),
        reference:c.reference?{...c.reference,monde:{left:c.reference.positions.left.map((v,j)=>v+origine[j]),right:c.reference.positions.right.map((v,j)=>v+origine[j])}}:null,
        intent:c.intent,origineSceneDansExport:c.capture.rails.left.positionSceneRelative||[0,0,0]};})};});
  const direction=cuts.find(c=>c.part===parts[0]).capture.rails.left.railLocalToSceneRelative.slice(0,3);
  return {format:'banane-esv-maquette-scenario-v1',monde:{origine:S.ORIGINE_MONDE,pas:S.PAS_M,direction,reperes:Object.fromEntries(reperes)},camera:{echelle:5,profondeur:1e-4},decoupe:{dimensions:[7,5,1.2]},
    provenance:{entree:path.basename(entree),formats:[...new Set(doc.formats)],nature:echo?'echo':'orbite',records:doc.records.length,nuages:doc.clouds.length,rejouables:cuts.length,
      reperes:reperes.size,mondeReel:[...reperes.values()].filter(r=>r.monde==='reel').length,preValides:valides,doublons:doc.doublons,
      exclus:{total:exclus.length,parRaison:exclus.reduce((a,x)=>(a[x.raison]=(a[x.raison]||0)+1,a),{}),exemples:exclus.slice(0,20)}},parties};
}
module.exports={construire,charger,cutsOrbite,cutsEcho};
if(require.main===module){const a=process.argv.slice(2),i=a.indexOf('--part'),v=a.indexOf('--valides');const s=construire(a[0],{part:i>=0?Number(a[i+1]):undefined,valides:v>=0?Number(a[v+1]):0});
  console.log(JSON.stringify({provenance:s.provenance,parties:s.parties.map(p=>({part:p.part,cuts:p.cuts.map(c=>({cut:c.cut,status:c.status,monde:c.monde,noeuds:c.noeuds.length,points:c.noeuds.reduce((n,x)=>n+x.positions.length/3,0),decoupe:!!c.decoupe,reference:c.reference?.source||null,intent:c.intent}))}))},null,1));}
