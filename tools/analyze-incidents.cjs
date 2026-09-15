const fs=require('node:fs'),path=require('node:path'),K=require('../src/core.js'),G=require('../src/geometry.js');
const root=path.resolve(__dirname,'..'),read=name=>JSON.parse(fs.readFileSync(path.join(root,'tests/incidents',name)));
const journal=read('banane-journal-v3-1788955443422.json'),dataset=read('banane-dataset-v3-1788955914519.json');
const proposals=new Map(dataset.events.filter(e=>e.type==='proposed').map(e=>[e.proposal.identity.cut,e.proposal]));
const rows=[];for(const cloud of dataset.clouds.slice().sort((a,b)=>a.cut-b.cut))for(const side of ['left','right']){
 const previous=proposals.get(cloud.cut).rails[side],current=G.propose(cloud,side);
 const record=dataset.records.find(r=>r.lidarCaptureId===cloud.captureId);
 rows.push({part:cloud.part,cut:cloud.cut,side,previousDeltaMm:previous.delta.map(v=>v*1000),previousConfidence:previous.confidence,
   newStatus:current.status,newDeltaMm:current.delta?.map(v=>v*1000)||null,reasons:current.reasons,
   topPoints:current.metrics?.topCount,facePoints:current.metrics?.faceCount,rawFaceSlope:current.face?.rawSlope,
   commandReadbackDifferenceMm:Math.hypot(...previous.delta.map((v,i)=>(v-record.rails[side].displacementLocal[i])*1000)),manualAccuracyMm:null});
}
const parsed=K.pairCorpus([{name:'dataset',text:JSON.stringify(dataset)}]);
const report={sourceVersions:{journal:journal.version,dataset:dataset.version},originalIncident:{part:7,cut:62,stage:'capture',
 message:journal.events.find(e=>e.type==='batch-error'&&e.step==='capture').message,
 firstProcessed:journal.events.filter(e=>e.type==='validation-observation'&&e.identity.part===7&&e.timestamp<'2026-09-09T11:58:00').map(e=>e.identity.cut).sort((a,b)=>a-b),
 secondProcessed:journal.state.batch.processed.map(p=>p.cut)},
 dataset:{cuts:dataset.clouds.map(c=>c.cut).sort((a,b)=>a-b),clouds:dataset.clouds.length,points:dataset.clouds.reduce((s,c)=>s+c.pointsSceneRelative.length,0),
   pairedByMetadata:parsed.paired.length,pairingErrors:parsed.errors,manualReferences:dataset.records.filter(r=>r.source==='explicit-manual-session'||r.source==='explicit-before-after').length},
 rows,meaning:'Automatic positions are not independent manual truth. The two rejected estimates were used to design the support check; this is a regression check, not a held-out accuracy result.'};
fs.writeFileSync(path.join(root,'audit/part7-incidents.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({originalIncident:report.originalIncident,dataset:report.dataset,rejected:rows.filter(r=>!r.newDeltaMm).map(r=>[r.cut,r.side]),maxCommandDifferenceMm:Math.max(...rows.map(r=>r.commandReadbackDifferenceMm))}));
