const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {K,base}=require('./fixtures.cjs'),G=require('../src/geometry.js');
const refs=JSON.parse(fs.readFileSync(path.join(__dirname,'corpus/references.json')));
test('parser returns the invalid-file name and does not salvage a truncated reference',()=>{
 assert.throws(()=>K.parse('{"records":[','broken.json'),/broken.json.*invalide/);assert.throws(()=>K.parse('[]'),/objet JSON/);});
test('metadata pairing ignores suffixes, deduplicates cumulative records and identifies 2867',()=>{
 const files=fs.readdirSync(path.join(__dirname,'corpus')).filter(n=>n.startsWith('banane-lidar')).map(n=>({name:n,text:fs.readFileSync(path.join(__dirname,'corpus',n),'utf8')}));
 files.push({name:'049',text:JSON.stringify(refs)},{name:'049-again',text:JSON.stringify(refs)});
 const result=K.pairCorpus(files);assert.equal(result.paired.length,10);assert.equal(result.uniqueRecords,11);assert.equal(result.duplicates.length,11);
 assert.equal(result.missing[0].data.cut,2867);assert.deepEqual(result.errors,[]);
 const altered=K.clone(refs);altered.records[0].cut=999;files.push({name:'bad',text:JSON.stringify(altered)});
 assert.ok(K.pairCorpus(files).errors.some(e=>e.includes('contradictoire')));
});
test('identity tolerates corrected coordinates and reordered rail maps; rejects changed page/part/cut',()=>{
 const a={pageId:'page',part:23,cut:2855,shape:'U50',frameId:'a'};
 K.assertTarget(a,{...a,coordinates:[1,2,3],objectOrder:['right','left']});
 for(const k of ['part','cut','pageId','shape','frameId'])assert.throws(()=>K.assertTarget(a,{...a,[k]:'changed'}),new RegExp(k));
});
test('one rail correction preserves the other rail and captures actual mutable rotations',()=>{
 const before={identity:{pageId:'p',part:23,cut:1,shape:'U50',frameId:'f'},rails:base.rails,capturedAt:'before'};
 const proposals={left:{delta:[0,.01,.003]},right:{delta:[0,0,0]}};
 const after={...before,rails:K.expectedPoses(before,proposals),capturedAt:'after'};
 const r=K.reference(before,after,'lidar','session');assert.ok(r.rails.left.positionChanged);assert.equal(r.rails.right.positionChanged,false);
 assert.ok(Math.abs(r.rails.left.displacementSceneMeters-Math.hypot(.01,.003))<1e-12);
});
test('geometry requires observed points and uses no manual after information',()=>{
 const a=G.propose(base,'left');const tainted=K.clone(base);tainted.manualReferences=[{rails:{left:{corrected:{positionSceneRelative:[999,999,999]}}}}];
 assert.deepEqual(G.propose(tainted,'left'),a);assert.equal(G.propose({...base,pointsSceneRelative:[]},'right').delta,null);
 assert.throws(()=>G.propose(base,'left',{grid:0}),/Paramètre/);
});
test('poor right-rail data is scored low; isolated far outliers do not decide the fit',()=>{
 const poor=JSON.parse(fs.readFileSync(path.join(__dirname,'corpus/banane-lidar-part-23-cut-2856-1788942234335.json')));
 assert.ok(G.propose(poor,'right').confidence<55);
 const modified=K.clone(base);modified.pointsSceneRelative.push([1e8,1e8,1e8]);modified.visibleByClipBoxes.push(true);
 assert.deepEqual(G.propose(modified,'left').delta,G.propose(base,'left').delta);
});
