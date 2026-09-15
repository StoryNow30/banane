#!/usr/bin/env node
'use strict';
/* Read-only audit of the actual 4.4.1 export. Its exploratory screens do not
 * alter eligibility or manufacture retroactive checkpoint receipts. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SIDES=['left','right'],sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const pose=(a,b)=>['railLocalToSceneRelative','profileLocalToSceneRelative'].every(key=>
 Array.isArray(a?.[key])&&Array.isArray(b?.[key])&&a[key].length===16&&b[key].length===16&&
 a[key].every((value,index)=>Math.abs(value-b[key][index])<=1e-7));
function extent(points){const useful=points.filter(p=>Math.abs(p[0])<=.5&&Math.abs(p[1])<=.18&&Math.abs(p[2])<=.10),xs=useful.map(p=>p[0]);
 const bins=new Set(xs.map(x=>Math.max(0,Math.min(9,Math.floor((x+.5)/.1))))),span=xs.length?Math.max(...xs)-Math.min(...xs):0;
 return {roi:points.length,useful:useful.length,bins:bins.size,span,passes:points.length>=128&&useful.length>=64&&bins.size>=6&&span>=.4};}
function audit(input){const bytes=fs.readFileSync(input),data=JSON.parse(bytes),records=data.records||[],events=data.events||[],clouds=data.clouds||[];
 const chunks=clouds.filter(item=>item.format==='banane-native-lidar-chunk-v1'),captures=clouds.filter(item=>item.format==='banane-native-lidar-capture-v2');
 const byVisit=new Map(records.map(r=>[r.visitId,r])),byCapture=new Map(captures.map(c=>[c.captureId,c]));
 const checkpoints=new Map(events.filter(e=>e.type==='native-capture-checkpoint').map(e=>[e.chunk?.chunkId,e]));
 const groups=new Map(),pointsByRail={left:0,right:0},visibility={true:0,false:0,unknown:0};let maximumTransformError=0;
 for(const chunk of chunks){const record=byVisit.get(chunk.visitId),capture=byCapture.get(chunk.captureId),event=checkpoints.get(chunk.chunkId);
  if(!record||!capture||!event||!SIDES.includes(chunk.side))throw Error('Association visite/capture/checkpoint invalide : '+chunk.chunkId);
  if(JSON.stringify(record.identity)!==JSON.stringify(chunk.identity)||JSON.stringify(capture.identity)!==JSON.stringify(chunk.identity))throw Error('Identité divergente : '+chunk.chunkId);
  const sizes=['pointsSceneRelative','pointsProfileLocal','pointSources','visibleByClipBoxes'].map(field=>chunk[field]?.length);
  if(!sizes.every(count=>count===sizes[0]))throw Error('Tailles de blocs divergentes : '+chunk.chunkId);
  const key=chunk.captureId+'|'+chunk.side;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(chunk);
  pointsByRail[chunk.side]+=sizes[0];const m=chunk.rail.sceneRelativeToProfileLocal;
  for(let index=0;index<sizes[0];index++){const p=chunk.pointsSceneRelative[index],q=chunk.pointsProfileLocal[index];
   if(!p.every(Number.isFinite)||!q.every(Number.isFinite))throw Error('Point non fini : '+chunk.chunkId);
   for(let axis=0;axis<3;axis++){const v=m[axis]*p[0]+m[axis+4]*p[1]+m[axis+8]*p[2]+m[axis+12];
    maximumTransformError=Math.max(maximumTransformError,Math.abs(v-q[axis]));}
   const visible=chunk.visibleByClipBoxes[index];visibility[visible===true?'true':visible===false?'false':'unknown']++;}}
 const screen=[{name:'numeric-only',groups:[],visits:new Map()},{name:'visible-only',groups:[],visits:new Map()},
  {name:'visible-and-initial-pose',groups:[],visits:new Map()}];
 for(const group of groups.values()){const chunksInOrder=group.slice().sort((a,b)=>checkpoints.get(a.chunkId).eventSeq-checkpoints.get(b.chunkId).eventSeq);
  const first=chunksInOrder[0],record=byVisit.get(first.visitId),intents=record.operatorIntents||[];
  if(intents.length!==1||intents[0].intent!=='VALIDATE')continue;
  const boundary=Date.parse(intents[0].observedAt),seq=intents[0].eventSeq;
  const prior=chunksInOrder.filter(chunk=>Date.parse(chunk.capturedAt)<boundary&&Date.parse(checkpoints.get(chunk.chunkId).timestamp)<boundary&&checkpoints.get(chunk.chunkId).eventSeq<seq);
  if(!prior.length)continue;
  const all=extent(prior.flatMap(c=>c.pointsProfileLocal)),visible=extent(prior.flatMap(c=>c.pointsProfileLocal.filter((_,i)=>c.visibleByClipBoxes[i]===true)));
  const matched=pose(prior[0].rail,record.beforeEstablished?.rails?.[first.side]);
  [all.passes,visible.passes,visible.passes&&matched].forEach((passes,index)=>{if(!passes)return;const row=screen[index];row.groups.push({visitId:first.visitId,side:first.side,cut:record.identity.cut,
    captureId:first.captureId,chunkIds:prior.map(c=>c.chunkId),termination:byCapture.get(first.captureId)?.termination?.code||'NONE'});
   if(!row.visits.has(first.visitId))row.visits.set(first.visitId,new Set());row.visits.get(first.visitId).add(first.side);});}
 return {format:'banane-native-v441-readonly-audit-v1',source:{file:path.basename(input),sha256:sha(bytes),version:data.version},
  counts:{visits:records.length,events:events.length,chunks:chunks.length,captures:captures.length,
   points:pointsByRail.left+pointsByRail.right,pointsByRail,visibility,maximumTransformError,
   exportedComparableRails:records.reduce((n,r)=>n+SIDES.filter(side=>r.usableForOfflineEvaluationByRail?.[side]).length,0),
   validationNoMovement:records.filter(r=>r.observedLabelCandidate==='VALIDATE_NO_MOVEMENT').length,
   terminations:Object.fromEntries([...new Set(captures.map(c=>c.termination?.code||'NONE'))].map(reason=>[reason,captures.filter(c=>(c.termination?.code||'NONE')===reason).length]))},
  counterfactualScreens:screen.map(row=>({filter:row.name,groups:row.groups.length,visitRails:new Set(row.groups.map(g=>g.visitId+'|'+g.side)).size,
   visitsWithBothRails:[...row.visits.values()].filter(sides=>sides.size===2).length,
   terminations:Object.fromEntries([...new Set(row.groups.map(g=>g.termination))].map(reason=>[reason,row.groups.filter(g=>g.termination===reason).length]))})),
  limits:['Ces filtres sont exploratoires : pas de preuve de stockage confirmé par bloc dans le format 4.4.1.',
   'Aucune référence ancienne promue et aucun export source modifié ; comparaison réelle 4.4.2 nécessite un nouvel essai ESV.',
   'Cohérence numérique interne des repères seulement, sans calibration physique ni certification humaine.']};}
function run(argv=process.argv.slice(2)){const index=argv.indexOf('--input'),output=argv.indexOf('--output');
 if(index<0||!argv[index+1]||output<0||!argv[output+1])throw Error('Usage : node tools/audit-native-v441.cjs --input export.json --output audit/result.json');
 const result=audit(path.resolve(argv[index+1]));fs.writeFileSync(path.resolve(argv[output+1]),JSON.stringify(result,null,2));return result;}
if(require.main===module)try{console.log(JSON.stringify(run(),null,2));}catch(error){console.error(error);process.exitCode=1;}
module.exports={audit,extent,pose,run};
