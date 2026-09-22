const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('../tools/audit-native-geometry.cjs');
const C=require('../tools/native-corpus.cjs');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'datasets/native/reference/Banane');

// Ignoré — jamais réussi — quand le corpus privé est absent du clone.
test('the three read-only Terra exports reproduce the demonstrated geometry loss',{skip:C.skip()},()=>{
 const files=fs.readdirSync(directory).filter(name=>name.endsWith('.json')).sort().map(name=>path.join(directory,name));assert.equal(files.length,3);
 const result=A.aggregate(files.map(A.summarize));assert.equal(result.sessions,3);assert.equal(result.visits,426);assert.equal(result.captures,115);
 assert.equal(result.failedCaptureAttempts,311);assert.equal(result.pipeline.availableInBuffers,67206881);assert.equal(result.pipeline.read,685558);
 assert.equal(result.pipeline.retainedInRoi,4);assert.equal(result.pipeline.saved,4);assert.equal(result.pipeline.exported,4);
 assert.equal(result.evidence.capturesWithProbeRoiHit,103);assert.equal(result.evidence.capturesResourceLimited,114);
 assert.ok(result.conclusions.some(item=>item.code==='SEQUENTIAL_SCAN_EXHAUSTS_300MS'));
 assert.ok(result.conclusions.some(item=>item.code==='RESOURCE_LIMIT_MISLABELED_AS_NO_POINTS'));
});

/* V4.6.0, revue Astra. Le `skip` ci-dessus ne doit dépendre QUE de la présence
 * réelle des fichiers. Sans ce contrôle, une régression qui renverrait toujours
 * une raison d'ignorer désactiverait ces tests pour de bon, en silence, et le
 * banc resterait vert. Vérifié dans les deux sens, sur une racine jetable. */
test('the native corpus detector drives the skip from the files actually present',()=>{
 const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'banane-corpus-'));
 try{
  assert.deepEqual(C.missing(temp),C.REQUIRED);assert.equal(C.present(temp),false);
  assert.equal(C.skip(temp),C.REASON);assert.equal(C.status(temp).mode,'partial');
  fs.mkdirSync(path.join(temp,C.DIRECTORY),{recursive:true});
  for(const name of C.REQUIRED)fs.writeFileSync(path.join(temp,C.DIRECTORY,name),'{}');
  assert.deepEqual(C.missing(temp),[]);assert.equal(C.present(temp),true);
  assert.equal(C.skip(temp),false,'corpus présent : plus aucune raison d’ignorer');
  assert.equal(C.status(temp).mode,'full');assert.equal(C.status(temp).reason,null);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
