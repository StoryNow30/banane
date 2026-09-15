#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function countBy(values){
 const counts=new Map();for(const value of values)counts.set(value,(counts.get(value)||0)+1);
 return [...counts].map(([value,count])=>({value,count})).sort((a,b)=>b.count-a.count||String(a.value).localeCompare(String(b.value)));
}
function identityKey(identity={}){return ['pageId','part','cut','shape','frameId','projectId'].map(k=>identity[k]??'not-observed').join('|');}
function timestampInversions(events){
 let inversions=0,previous=-Infinity;for(const event of events){const now=Date.parse(event.timestamp||event.observedAt||'');if(Number.isFinite(now)){if(now<previous)inversions++;previous=now;}}
 return inversions;
}
function captureProfile(cloud){
 const nodes=Array.isArray(cloud.nodes)?cloud.nodes:[],quality=cloud.quality||{},scope=cloud.scope||{};
 const available=nodes.reduce((sum,node)=>sum+Math.max(0,(node.drawRange?.end||0)-(node.drawRange?.start||0)),0);
 const notScanned=nodes.filter(node=>node.inspection==='not-scanned').length;
 const partialBudget=nodes.filter(node=>node.inspection==='partial-budget').length;
 const probeRoiHits=nodes.reduce((sum,node)=>sum+(node.probes||[]).reduce((n,probe)=>n+Object.values(probe.roiHit||{}).filter(Boolean).length,0),0);
 const hierarchyMismatch=nodes.some(node=>(node.hierarchyMatrixMaxDifference||0)>1e-6);
 const retained=quality.retained??cloud.pointsSceneRelative?.length??0;
 const resourceLimited=!scope.scanComplete||partialBudget>0||notScanned>0;
 let outcome='read-complete-with-points';
 if(resourceLimited)outcome=retained?'partial-resource-limit-with-points':'partial-resource-limit-empty';
 else if(!retained)outcome='read-complete-empty';
 if(cloud.status==='transform-check-failed')outcome='invalid-transform';
 else if(cloud.status==='partial-invalid-points')outcome='invalid-points';
 return {captureId:cloud.captureId,visitId:cloud.visitId,identity:cloud.identity,status:cloud.status,outcome,
  pipeline:{availableInBuffers:available,diagnosticProbesRead:quality.probePointsRead||0,read:quality.inspected||0,
   finiteTransformed:Math.max(0,(quality.inspected||0)-(quality.nonFinitePositions||0)),retainedInRoi:retained,
   saved:cloud.pointsSceneRelative?.length||0,exported:cloud.pointsSceneRelative?.length||0},
  nodes:{available:nodes.length,notScanned,partialBudget},probeRoiHits,hierarchyMismatch,durationMs:quality.durationMs??null,
  scanComplete:scope.scanComplete===true,completeLoadedRoi:scope.completeLoadedRoi===true};
}
function summarize(file){
 const doc=read(file),records=doc.records||[],events=doc.events||[],clouds=doc.clouds||[],profiles=clouds.map(captureProfile);
 const failures=events.filter(event=>event.type==='native-capture-failed');
 const periods=doc.session?.observationPeriods||[];
 return {file:path.basename(file),sha256:sha256(file),version:doc.version??doc.session?.version??null,sessionId:doc.session?.id??null,
  grain:{visits:records.length,distinctVisitIds:new Set(records.map(record=>record.visitId)).size,
   distinctIdentities:new Set(records.map(record=>identityKey(record.identity))).size,events:events.length,captures:clouds.length},
  chronology:{eventTimestampInversions:timestampInversions(events),eventsWithExplicitSequence:events.filter(event=>Number.isInteger(event.eventSeq)||Number.isInteger(event.event_seq)).length,
   periods:periods.length,periodsWithoutEnd:periods.filter(period=>!period.endedAt).length,interruptedPeriodsWithoutEnd:periods.filter(period=>period.status==='INTERRUPTED'&&!period.endedAt).length},
  captureFailures:countBy(failures.map(event=>event.reason||'reason-missing')).map(x=>({reason:x.value,count:x.count})),
  captureOutcomes:countBy(profiles.map(profile=>profile.outcome)).map(x=>({outcome:x.value,count:x.count})),
  pipeline:{availableInBuffers:profiles.reduce((n,p)=>n+p.pipeline.availableInBuffers,0),diagnosticProbesRead:profiles.reduce((n,p)=>n+p.pipeline.diagnosticProbesRead,0),
   read:profiles.reduce((n,p)=>n+p.pipeline.read,0),finiteTransformed:profiles.reduce((n,p)=>n+p.pipeline.finiteTransformed,0),
   retainedInRoi:profiles.reduce((n,p)=>n+p.pipeline.retainedInRoi,0),saved:profiles.reduce((n,p)=>n+p.pipeline.saved,0),exported:profiles.reduce((n,p)=>n+p.pipeline.exported,0)},
  evidence:{capturesWithProbeRoiHit:profiles.filter(profile=>profile.probeRoiHits>0).length,probeRoiHits:profiles.reduce((n,p)=>n+p.probeRoiHits,0),
   capturesResourceLimited:profiles.filter(profile=>profile.outcome.startsWith('partial-resource-limit')).length,
   nodesAvailable:profiles.reduce((n,p)=>n+p.nodes.available,0),nodesNotScanned:profiles.reduce((n,p)=>n+p.nodes.notScanned,0),
   nodesPartialBudget:profiles.reduce((n,p)=>n+p.nodes.partialBudget,0),capturesWithHierarchyMismatch:profiles.filter(profile=>profile.hierarchyMismatch).length,
   completeScans:profiles.filter(profile=>profile.scanComplete).length,completeLoadedRoi:profiles.filter(profile=>profile.completeLoadedRoi).length},
  profiles};
}
function aggregate(sources){
 const records=sources.reduce((n,s)=>n+s.grain.visits,0),captures=sources.reduce((n,s)=>n+s.grain.captures,0);
 const failureRows=sources.flatMap(s=>s.captureFailures.flatMap(row=>Array(row.count).fill(row.reason)));
 const outcomeRows=sources.flatMap(s=>s.captureOutcomes.flatMap(row=>Array(row.count).fill(row.outcome)));
 const pipeline=Object.fromEntries(['availableInBuffers','diagnosticProbesRead','read','finiteTransformed','retainedInRoi','saved','exported'].map(k=>[k,sources.reduce((n,s)=>n+s.pipeline[k],0)]));
 const evidence=Object.fromEntries(['capturesWithProbeRoiHit','probeRoiHits','capturesResourceLimited','nodesAvailable','nodesNotScanned','nodesPartialBudget','capturesWithHierarchyMismatch','completeScans','completeLoadedRoi'].map(k=>[k,sources.reduce((n,s)=>n+s.evidence[k],0)]));
 const conclusions=[];
 if(captures&&evidence.capturesResourceLimited===captures-1&&evidence.capturesWithProbeRoiHit>0)
  conclusions.push({severity:'critical',confidence:'high',code:'SEQUENTIAL_SCAN_EXHAUSTS_300MS',
   evidence:`${evidence.capturesResourceLimited}/${captures} captures sont limitées ; ${evidence.capturesWithProbeRoiHit}/${captures} contiennent pourtant des sondes situées dans une ROI de rail ; ${evidence.nodesNotScanned}/${evidence.nodesAvailable} nœuds n'ont jamais été balayés.`,
   cause:'Le lecteur prépare tous les nœuds puis les balaie dans l’ordre de visibleNodes avec un budget mural de 300 ms. Les nœuds grossiers et éloignés consomment le budget avant les nœuds portant la zone du rail.'});
 if(outcomeRows.filter(x=>x==='partial-resource-limit-empty').length&&sources.some(s=>s.profiles.some(p=>p.status==='no-points'&&p.outcome==='partial-resource-limit-empty')))
  conclusions.push({severity:'high',confidence:'high',code:'RESOURCE_LIMIT_MISLABELED_AS_NO_POINTS',
   evidence:'Le statut `no-points` écrase `partial-limit` lorsque zéro point a été retenu, même si le balayage est incomplet.',
   cause:'Ordre de priorité des statuts dans le lecteur V4.4.'});
 return {sessions:sources.length,visits:records,captures,failedCaptureAttempts:failureRows.length,
  captureFailures:countBy(failureRows).map(x=>({reason:x.value,count:x.count})),captureOutcomes:countBy(outcomeRows).map(x=>({outcome:x.value,count:x.count})),pipeline,evidence,
  eventTimestampInversions:sources.reduce((n,s)=>n+s.chronology.eventTimestampInversions,0),eventsWithExplicitSequence:sources.reduce((n,s)=>n+s.chronology.eventsWithExplicitSequence,0),conclusions};
}
function markdown(report){
 const a=report.aggregate,p=a.pipeline,e=a.evidence,lines=['# Audit de la perte géométrique du Mode Natif V4.4','',`Généré le ${report.generatedAt}. Les trois exports sont lus sans modification.`,'',
  '## Résultat démontré','',
  `Le défaut principal est un épuisement du budget de lecture, pas une absence générale de points dans ESV. Sur ${a.captures} captures sauvegardées, ${e.capturesResourceLimited} ont été interrompues par la limite. Les sondes légères trouvent des points dans la ROI sur ${e.capturesWithProbeRoiHit} captures, alors que ${e.nodesNotScanned} nœuds sur ${e.nodesAvailable} n’ont jamais été balayés complètement.`,
  '',`Le second défaut est un statut trompeur : une lecture incomplète sans point retenu finit en \`no-points\`, ce qui masque la limite de ressources.`,'','## Traçage cumulé','',
  '| Étape | Nombre |','|---|---:|',`| Points déclarés disponibles dans les buffers | ${p.availableInBuffers} |`,`| Sondes diagnostiques lues | ${p.diagnosticProbesRead} |`,`| Points balayés | ${p.read} |`,`| Points transformés finis | ${p.finiteTransformed} |`,`| Points retenus dans les ROI | ${p.retainedInRoi} |`,`| Points sauvegardés | ${p.saved} |`,`| Points présents dans les exports | ${p.exported} |`,'','## Échecs avant sauvegarde d’un nuage','',
  '| Cause | Nombre |','|---|---:|',...a.captureFailures.map(row=>`| ${row.reason.replaceAll('|','\\|')} | ${row.count} |`),'','## Limites','',
  '- Les buffers bruts ne sont plus disponibles dans les JSON : le correctif doit être validé par une nouvelle session ESV.','- Les sondes prouvent que des points utiles existaient dans les buffers chargés ; elles ne reconstituent pas une ROI complète.','- Une distance entre rails observés ne constitue pas une mesure ESV certifiée de l’écartement du champignon.',''];
 return lines.join('\n');
}
function parseArgs(argv){const out={files:[],output:null,markdown:null};for(let i=0;i<argv.length;i++){const value=argv[i];if(value==='--output')out.output=argv[++i];else if(value==='--markdown')out.markdown=argv[++i];else out.files.push(value);}return out;}
function run(argv=process.argv.slice(2)){
 const args=parseArgs(argv),root=path.resolve(__dirname,'..');
 const files=(args.files.length?args.files:fs.readdirSync(path.join(root,'datasets/native/reference/Banane')).filter(name=>name.endsWith('.json')).map(name=>path.join(root,'datasets/native/reference/Banane',name))).map(file=>path.resolve(file));
 if(files.length!==3)throw Error(`Trois exports Natif sont requis ; ${files.length} trouvé(s).`);
 const sources=files.map(summarize),report={format:'banane-native-geometry-audit-v1',generatedAt:new Date().toISOString(),sources:sources.map(({profiles,...source})=>source),aggregate:aggregate(sources),
  immutability:{sourceFilesModified:false},limits:['Les points non exportés ne peuvent pas être rejoués depuis les JSON seuls.','La validation finale nécessite une courte session ESV avec le lecteur corrigé.']};
 const output=path.resolve(args.output||path.join(root,'audit/native-geometry-loss-v4.4.0.json'));
 const md=path.resolve(args.markdown||path.join(root,'audit/native-geometry-loss-v4.4.0.md'));
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.mkdirSync(path.dirname(md),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));fs.writeFileSync(md,markdown(report));
 return {output,markdown:md,aggregate:report.aggregate};
}
if(require.main===module){try{console.log(JSON.stringify(run(),null,2));}catch(error){console.error(error.stack||error);process.exitCode=1;}}
module.exports={aggregate,captureProfile,countBy,identityKey,run,summarize,timestampInversions};
