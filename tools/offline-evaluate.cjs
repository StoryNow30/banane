#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Geometry=require('../src/geometry.js');

const CORPUS_VERSION='banane-human-reference-1';
const LABELS=['VALIDATE_CORRECTED_BOTH','VALIDATE_CORRECTED_LEFT_ONLY','VALIDATE_CORRECTED_RIGHT_ONLY','VALIDATE_NO_MOVEMENT'];
function args(argv){const out={};for(let i=0;i<argv.length;i+=2)out[argv[i]?.replace(/^--/,'')]=argv[i+1];return out;}
function read(file){return JSON.parse(fs.readFileSync(file));}
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function quantile(values,q){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const p=(a.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return a[lo]+(a[hi]-a[lo])*(p-lo);}
function round(n){return Number.isFinite(n)?Math.round(n*1e6)/1e6:null;}
function stats(values){const a=values.filter(Number.isFinite);return {count:a.length,medianMm:round(quantile(a,.5)),p90Mm:round(quantile(a,.9)),maximumMm:round(a.length?Math.max(...a):NaN)};}
function identity(r){return {sessionId:r.sessionId??r.manualSessionId??null,pageId:r.pageId??r.identity?.pageId??null,part:r.part??r.identity?.part??null,cut:r.cut??r.identity?.cut??null,shape:r.shape??r.identity?.shape??null,frameId:r.frameId??r.identity?.frameId??null,projectId:r.projectId??r.identity?.projectId??r.project??r.identity?.project??null};}
function key(r){const i=identity(r);return `${i.part}:${i.cut}`;}
function label(r){const l=!!r.rails?.left?.positionChanged,d=!!r.rails?.right?.positionChanged;return l&&d?LABELS[0]:l?LABELS[1]:d?LABELS[2]:LABELS[3];}
function vector(v){return Array.isArray(v)&&v.length>=3&&v.slice(0,3).every(Number.isFinite)?v.slice(0,3):null;}
function railResult(side,record,proposal){
 const human=vector(record.rails?.[side]?.displacementLocal),engine=vector(proposal?.delta);
 if(!human)return {status:'incomplete',reason:'Déplacement humain local absent.',confidence:proposal?.confidence??null};
 if(proposal?.status!=='candidate'||!engine)return {status:'unresolved',reason:(proposal?.reasons||['Proposition absente.']).join(' '),confidence:proposal?.confidence??0,humanDeltaLocal:human};
 const error=engine.map((v,i)=>(v-human[i])*1000),euclidean=Math.hypot(...error);
 return {status:'comparable',engineDeltaLocal:engine,humanDeltaLocal:human,errorMm:{longitudinal:round(error[0]),lateral:round(error[1]),vertical:round(error[2]),euclidean:round(euclidean)},confidence:proposal.confidence,reasons:proposal.reasons||[]};
}
function aggregate(rows){
 const comparable=rows.filter(r=>r.status==='comparable'),rails=['left','right'];
 const errors={};for(const side of rails){const rr=comparable.map(r=>r.rails[side]).filter(r=>r.status==='comparable');errors[side]={
  lateral:stats(rr.map(x=>Math.abs(x.errorMm.lateral))),vertical:stats(rr.map(x=>Math.abs(x.errorMm.vertical))),euclidean:stats(rr.map(x=>x.errorMm.euclidean))};}
 const noMove=rows.filter(r=>r.humanLabel==='VALIDATE_NO_MOVEMENT'),noMoveCorrect=noMove.filter(r=>rails.every(s=>r.rails[s]?.status==='comparable'&&Math.hypot(...r.rails[s].engineDeltaLocal)*1000<=1));
 let unchanged=0,unnecessary=0;for(const r of rows)for(const side of rails)if(r.initialRails?.[side]&&r.finalHumanRails?.[side]&&!r.positionChanged?.[side]){unchanged++;const p=r.rails[side];if(p?.status==='comparable'&&Math.hypot(...p.engineDeltaLocal)*1000>1)unnecessary++;}
 const pairs=[];for(const r of comparable)for(const side of rails){const x=r.rails[side];if(x.status==='comparable')pairs.push([x.confidence,x.errorMm.euclidean]);}
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;let correlation=null;if(pairs.length>1){const mx=mean(pairs.map(x=>x[0])),my=mean(pairs.map(x=>x[1])),num=pairs.reduce((s,x)=>s+(x[0]-mx)*(x[1]-my),0),dx=Math.sqrt(pairs.reduce((s,x)=>s+(x[0]-mx)**2,0)),dy=Math.sqrt(pairs.reduce((s,x)=>s+(x[1]-my)**2,0));correlation=dx&&dy?round(num/(dx*dy)):null;}
 const worst=comparable.map(r=>({identity:r.identity,leftMm:r.rails.left.errorMm?.euclidean??null,rightMm:r.rails.right.errorMm?.euclidean??null,maximumMm:Math.max(r.rails.left.errorMm?.euclidean??-Infinity,r.rails.right.errorMm?.euclidean??-Infinity)})).sort((a,b)=>b.maximumMm-a.maximumMm).slice(0,10);
 return {cutsRead:rows.length,cutsComparable:comparable.length,completeProposals:rows.filter(r=>r.rails.left.status==='comparable'&&r.rails.right.status==='comparable').length,
  unresolvedRails:rows.reduce((n,r)=>n+rails.filter(s=>r.rails[s]?.status==='unresolved').length,0),errors,
  noMovementReference:{cuts:noMove.length,engineNoMovementBothRails:noMoveCorrect.length,rate:noMove.length?round(noMoveCorrect.length/noMove.length):null,thresholdMm:1},
  unnecessaryRailModification:{unchangedReferenceRails:unchanged,modifiedByEngine:unnecessary,rate:unchanged?round(unnecessary/unchanged):null,thresholdMm:1},
  confidenceVsEuclideanError:{pairs:pairs.length,pearson:correlation,note:'Corrélation descriptive, pas une calibration probabiliste.'},worstDivergences:worst};
}
function explicitContextCount(records){const names=['crossing','levelCrossing','passageANiveau','contextType','objectType'];return records.filter(r=>names.some(k=>r[k]!=null||r.identity?.[k]!=null)).length;}
function buildCertificate(autoDocs,humanDocs,files){
 const humanRecords=humanDocs.flatMap(x=>x.doc.records||[]),humanClouds=humanDocs.flatMap(x=>x.doc.clouds||[]),autoRecords=autoDocs.flatMap(x=>x.doc.records||[]);
 const counts=Object.fromEntries(LABELS.map(x=>[x,humanRecords.filter(r=>label(r)===x).length]));
 const autoIds=new Set(autoRecords.map(key)),humanIds=new Set(humanRecords.map(key));
 const reserved=humanDocs.filter(x=>x.version==='4.2.0').flatMap(x=>x.doc.records||[]).filter(r=>r.cut>=9031&&r.cut<=9047).sort((a,b)=>a.cut-b.cut);
 let triplets=0;for(let i=0;i+2<reserved.length;i++)if(reserved[i+1].cut===reserved[i].cut+1&&reserved[i+2].cut===reserved[i].cut+2)triplets++;
 return {generatedAt:new Date().toISOString(),corpusVersion:CORPUS_VERSION,sources:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,{file:path.basename(v),sha256:sha(v)}])),
  recalculated:{humanCorrections:humanRecords.length,humanCorrectionsV40:humanDocs.filter(x=>x.version==='4.0.0').reduce((n,x)=>n+x.doc.records.length,0),humanCorrectionsV42:humanDocs.filter(x=>x.version==='4.2.0').reduce((n,x)=>n+x.doc.records.length,0),
   humanLidarClouds:humanClouds.length,humanLidarPoints:humanClouds.reduce((n,c)=>n+(c.pointsSceneRelative?.length||0),0),correctedBoth:counts[LABELS[0]],correctedLeftOnly:counts[LABELS[1]],correctedRightOnly:counts[LABELS[2]],validateNoMovement:counts[LABELS[3]],
   humanSkip:humanRecords.filter(r=>r.operatorDecision==='SKIP'||r.decision==='SKIP').length,rawGeominfoExported:[...humanRecords,...humanClouds].filter(x=>x.geominfo?.raw!=null).length,explicitLevelCrossing:explicitContextCount([...humanRecords,...humanClouds]),
   automaticHumanMatchingCuts:[...humanIds].filter(x=>autoIds.has(x)).length,reservedV42Cuts9031to9047:reserved.length,reservedContinuousTriplets:triplets},
  assertions:{humanCorrections:110,humanCorrectionsV40:26,humanCorrectionsV42:84,humanLidarClouds:110,humanLidarPoints:1314278,correctedBoth:80,correctedLeftOnly:13,correctedRightOnly:4,validateNoMovement:13,humanSkip:0,rawGeominfoExported:0,explicitLevelCrossing:0,automaticHumanMatchingCuts:0,reservedV42Cuts9031to9047:17,reservedContinuousTriplets:15}};
}
function main(){
 const a=args(process.argv.slice(2)),required=['auto-v40','auto-v41','manual-v40','manual-v42','output'];for(const k of required)if(!a[k])throw Error(`Argument requis : --${k}`);
 const files=Object.fromEntries(required.filter(k=>k!=='output').map(k=>[k,path.resolve(a[k])]));for(const [k,f] of Object.entries(files))if(!fs.existsSync(f))throw Error(`Fichier inaccessible (${k}) : ${f}`);
 const autoDocs=[{version:'4.0.0',doc:read(files['auto-v40'])},{version:'4.1.0',doc:read(files['auto-v41'])}],humanDocs=[{version:'4.0.0',doc:read(files['manual-v40'])},{version:'4.2.0',doc:read(files['manual-v42'])}];
 const certificate=buildCertificate(autoDocs,humanDocs,files),mismatches=Object.entries(certificate.assertions).filter(([k,v])=>certificate.recalculated[k]!==v);certificate.passed=mismatches.length===0;certificate.mismatches=mismatches.map(([field,expected])=>({field,expected,actual:certificate.recalculated[field]}));
 const engineFiles=['src/geometry.js','vendor/capture-core.js'].map(f=>path.join(__dirname,'..',f)),buildHash=crypto.createHash('sha256');for(const f of engineFiles)buildHash.update(fs.readFileSync(f));
 const engine={version:'4.3.0',method:Geometry.DEFAULTS.method,parameters:Geometry.DEFAULTS,buildHash:buildHash.digest('hex')},results=[];
 for(const source of humanDocs){const clouds=new Map((source.doc.clouds||[]).map(c=>[c.captureId,c]));for(const record of source.doc.records||[]){const cloud=clouds.get(record.lidarCaptureId),id=identity(record),base={identity:id,corpusVersion:CORPUS_VERSION,sourceVersion:source.version,engine,initialRails:{left:record.rails?.left?.initial??null,right:record.rails?.right?.initial??null},finalHumanRails:{left:record.rails?.left?.corrected??null,right:record.rails?.right?.corrected??null},positionChanged:{left:!!record.rails?.left?.positionChanged,right:!!record.rails?.right?.positionChanged},humanLabel:label(record),reservedFinalEvaluation:source.version==='4.2.0'&&record.cut>=9031&&record.cut<=9047,commandNative:null,serverConfirmation:null};
   if(!cloud){results.push({...base,status:'incomplete',exclusionReason:'Nuage LiDAR associé absent.',rails:{left:{status:'incomplete'},right:{status:'incomplete'}}});continue;}
   if(id.frameId&&cloud.identity?.frameId&&id.frameId!==cloud.identity.frameId){results.push({...base,status:'not-comparable',exclusionReason:'Frame du nuage différente de la référence humaine.',rails:{left:{status:'not-comparable'},right:{status:'not-comparable'}}});continue;}
   const capture={...cloud,rails:{left:{...(cloud.rails?.left||{}),...(record.rails?.left?.initial||{})},right:{...(cloud.rails?.right||{}),...(record.rails?.right?.initial||{})}}};let proposals;try{proposals=Geometry.proposeBoth(capture);}catch(error){results.push({...base,status:'incomplete',exclusionReason:error.message,rails:{left:{status:'incomplete'},right:{status:'incomplete'}}});continue;}
   const rails={left:railResult('left',record,proposals.left),right:railResult('right',record,proposals.right)},status=rails.left.status==='comparable'&&rails.right.status==='comparable'?'comparable':Object.values(rails).some(x=>x.status==='unresolved')?'unresolved':'incomplete';results.push({...base,status,exclusionReason:status==='comparable'?null:'Au moins un rail ne produit pas de proposition comparable.',proposal:{left:proposals.left,right:proposals.right},rails});}}
 const groups={global:aggregate(results),bySourceVersion:Object.fromEntries(['4.0.0','4.2.0'].map(v=>[v,aggregate(results.filter(r=>r.sourceVersion===v))])),byHumanLabel:Object.fromEntries(LABELS.map(l=>[l,aggregate(results.filter(r=>r.humanLabel===l))])),reservedFinalEvaluation:aggregate(results.filter(r=>r.reservedFinalEvaluation))};
 const report={format:'banane-offline-evaluation-v1',generatedAt:new Date().toISOString(),safety:{esvConnected:false,nativeCommandsSent:0,navigationActions:0,learningOrThresholdMutation:false},certificate,engine,results,metrics:groups,limits:['Corpus de 110 cuts décisionnels seulement ; les points LiDAR ne sont pas des exemples indépendants.','Aucun cut commun entre exports automatiques et humains : impossible de comparer V4.0/V4.1 et V4.3 sur les mêmes entrées.','Geominfo brute, ordre ESV certifié et contexte de voie/passage à niveau absents.','La réserve 9031–9047 est rapportée séparément et n’est utilisée pour aucun réglage.','Les erreurs locales reposent sur les repères de profil exportés ; longitudinal est conservé mais la décision vise surtout les axes latéral et vertical.']};
 const out=path.resolve(a.output);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));const cert=a.certificate?path.resolve(a.certificate):path.join(path.dirname(out),'ingestion-certificate-v4.3.0.json');fs.writeFileSync(cert,JSON.stringify(certificate,null,2));
 if(!certificate.passed)throw Error(`Certificat d’ingestion non conforme : ${JSON.stringify(certificate.mismatches)}`);console.log(JSON.stringify({output:out,certificate:cert,certificatePassed:true,metrics:groups.global},null,2));
}
if(require.main===module)main();else module.exports={aggregate,buildCertificate,identity,label,quantile,stats,CORPUS_VERSION,LABELS};
