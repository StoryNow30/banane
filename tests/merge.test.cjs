const {test}=require('node:test'),assert=require('node:assert/strict');
const {merge}=require('../src/merge-clouds.js'),{base,K}=require('./fixtures.cjs');
test('two loaded views merge exact points once, preserve provenance and recalculate retained counts',()=>{
 const a=K.clone(base),b=K.clone(base);a.identity=b.identity={pageId:'p',part:23,cut:2855,shape:'U50',frameId:'f'};
 const out=merge(a,b);assert.equal(out.pointsSceneRelative.length,a.pointsSceneRelative.length);
 assert.equal(out.nodes.reduce((s,n)=>s+n.retained,0),out.pointsSceneRelative.length);
 assert.equal(out.quality.inspected,a.quality.inspected*2);assert.equal(out.viewCaptures.length,2);
 assert.equal(new Set(out.pointSources.map(p=>p.join(','))).size,out.pointsSceneRelative.length);
});
test('view merge rejects different cuts and rail states',()=>{
 const a=K.clone(base),b=K.clone(base);a.identity={pageId:'p',part:23,cut:2855,shape:'U50',frameId:'f'};b.identity={...a.identity,cut:2856};
 assert.throws(()=>merge(a,b),/Cible différente/);b.identity=a.identity;b.rails.left.profileLocalToSceneRelative[12]+=.1;assert.throws(()=>merge(a,b),/Rails déplacés/);
});
