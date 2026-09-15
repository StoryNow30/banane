const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('../tools/audit-native-geometry.cjs');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'datasets/native/reference/Banane');

test('the three read-only Terra exports reproduce the demonstrated geometry loss',()=>{
 const files=fs.readdirSync(directory).filter(name=>name.endsWith('.json')).sort().map(name=>path.join(directory,name));assert.equal(files.length,3);
 const result=A.aggregate(files.map(A.summarize));assert.equal(result.sessions,3);assert.equal(result.visits,426);assert.equal(result.captures,115);
 assert.equal(result.failedCaptureAttempts,311);assert.equal(result.pipeline.availableInBuffers,67206881);assert.equal(result.pipeline.read,685558);
 assert.equal(result.pipeline.retainedInRoi,4);assert.equal(result.pipeline.saved,4);assert.equal(result.pipeline.exported,4);
 assert.equal(result.evidence.capturesWithProbeRoiHit,103);assert.equal(result.evidence.capturesResourceLimited,114);
 assert.ok(result.conclusions.some(item=>item.code==='SEQUENTIAL_SCAN_EXHAUSTS_300MS'));
 assert.ok(result.conclusions.some(item=>item.code==='RESOURCE_LIMIT_MISLABELED_AS_NO_POINTS'));
});
