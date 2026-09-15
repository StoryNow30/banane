const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const F=require('./fixtures.cjs');
const C=require('../capture-core.js');

function app() {
  const registry=new Map(),downloads=[],blobs=new Map(),f=F.scene();
  class E {
    constructor(tag='div',id=''){this.tagName=tag;this.id=id;this.children=[];this.dataset={};this.style={};this.textContent='';this.disabled=false;}
    set innerHTML(html){for(const m of html.matchAll(/id="([^"]+)"/g))registry.set(m[1],new E('div',m[1]));}
    append(...items){for(const x of items){this.children.push(x);if(x.id)registry.set(x.id,x);}}
    remove(){registry.delete(this.id);}
    setAttribute(){}
    click(){if(this.tagName==='a')downloads.push({href:this.href,download:this.download});else throw Error('Unexpected native click');}
  }
  const document={readyState:'complete',documentElement:new E('html'),body:new E('body'),
    getElementById:id=>registry.get(id)||null,createElement:tag=>new E(tag),
    addEventListener(){},removeEventListener(){}};
  for(const [id,text] of [['O2N3DCutDescription','Cut 0 of part 20'],['O2N3DCutShapeInfo','U50']]) {
    const e=new E('div',id);e.textContent=text;registry.set(id,e);
  }
  for(const id of ['O2N3DCutLRClick','O2N3DCutRRClick','O2N3DCutValidate3DRail'])registry.set(id,new E('button',id));
  const forbidden=()=>{throw Error('Network or storage access forbidden in test');};
  let observation,tick;
  const context={window:null,document,viewer:f.viewer,Potree:F.enums,console,Date,Math,Number,JSON,Error,
    Float32Array,ArrayBuffer,Set,Map,Blob,fetch:forbidden,XMLHttpRequest:forbidden,WebSocket:forbidden,
    localStorage:{getItem:forbidden,setItem:forbidden},sessionStorage:{getItem:forbidden,setItem:forbidden},
    URL:{createObjectURL:b=>{const id='blob:'+blobs.size;blobs.set(id,b);return id;},revokeObjectURL(){}},
    setTimeout:(fn,ms)=>{if(ms===0)fn();return 1;},clearTimeout(){},setInterval:fn=>{tick=fn;return 1;},clearInterval(){},
    MutationObserver:class{constructor(fn){observation=fn;}observe(){}disconnect(){}}};
  context.window=context;vm.createContext(context);
  for(const file of ['capture-core.js','lidar.js','banane.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  return {...f,context,document,registry,downloads,blobs,api:context.__BANANE_V24,
    status:()=>registry.get('__banane24-status').textContent,
    tick:()=>tick(),mutate:mutations=>observation(mutations),
    cutChanged:()=>observation([{target:registry.get('O2N3DCutDescription'),oldValue:'Cut 999 of part 20'}]),
    changeCut:(cut,part=20)=>{
      const e=registry.get('O2N3DCutDescription'),oldValue=e.textContent;
      e.textContent=`Cut ${cut} of part ${part}`;observation([{target:e,oldValue}]);
    }};
}

test('left then right capture retains both operations and complete coordinate frames',async()=>{
  const f=app();
  await f.api.before();f.left.position.y+=.03;f.api.after();
  const first=f.api.getRecords()[0];
  await f.api.before();f.right.position.z+=.01;f.api.after();
  const records=f.api.getRecords();assert.equal(records.length,2);
  assert.equal(JSON.stringify(records[0]),JSON.stringify(first));
  assert.equal(records[1].continuesRecordId,records[0].recordId);
  assert.ok(Math.abs(records[0].rails.left.displacementSceneMeters-.03)<1e-8);
  assert.equal(records[1].rails.left.positionChanged,false);
  assert.ok(Math.abs(records[1].rails.right.displacementSceneMeters-.01)<1e-8);
  assert.equal(records[0].rails.left.initial.profileLocalToSceneRelative.length,16);
  assert.equal(records[0].lidarCaptureId.length>0,true);
  assert.equal(records[0].cut,0);
  f.api.exportJSON();
  const d=f.downloads.at(-1),json=JSON.parse(await f.blobs.get(d.href).text());
  assert.equal(json.records.length,2);assert.equal(json.format,'banane-manual-references-v2');
  assert.equal(json.records[0].sessionId,json.sessionId);
  assert.ok(!JSON.stringify(json).includes('6638161'));
});

test('existing before is not overwritten; cut change away and back invalidates baseline',async()=>{
  const f=app();await f.api.before();f.left.position.y+=.02;
  await f.api.before();assert.match(f.status(),/déjà en cours/);
  f.api.after();assert.ok(Math.abs(f.api.getRecords()[0].rails.left.displacementSceneMeters-.02)<1e-8);
  await f.api.before();f.cutChanged();f.api.after();
  assert.equal(f.api.getRecords().length,1);assert.match(f.status(),/incomplète/);
  assert.equal(f.api.getIncompleteCaptures().length,1);
});

test('completed cut followed by next cut enables before and preserves both complete references',async()=>{
  const f=app(),button=f.registry.get('__banane24-before');
  await f.api.before();assert.equal(button.disabled,true);
  f.left.position.y+=.01;f.api.after();assert.equal(button.disabled,false);
  const first=JSON.stringify(f.api.getRecords()[0]);
  f.changeCut(1);f.tick();assert.equal(button.disabled,false);
  await f.api.before();f.right.position.z+=.02;f.api.after();
  assert.equal(f.api.getRecords().length,2);
  assert.equal(JSON.stringify(f.api.getRecords()[0]),first);
  assert.equal(f.api.getRecords()[1].cut,1);
  assert.equal(f.api.getRecords()[1].continuesRecordId,null);
  assert.equal(f.api.getIncompleteCaptures().length,0);
});

test('next cut archives unfinished before, unlocks UI and never labels it as a completed pair',async()=>{
  const f=app();await f.api.before();f.left.position.y+=.01;
  f.changeCut(1);f.tick();
  assert.equal(f.registry.get('__banane24-before').disabled,false);
  assert.equal(f.registry.get('__banane24-after').disabled,true);
  assert.equal(f.registry.get('__banane24-export').disabled,false);
  const incomplete=f.api.getIncompleteCaptures()[0];
  assert.equal(incomplete.cut,0);assert.equal(incomplete.usableForTraining,false);
  assert.ok(incomplete.lidarCaptureId);
  assert.equal(incomplete.rails.left.corrected,undefined);
  assert.equal(f.api.getRecords().length,0);
  f.tick();assert.equal(f.api.getIncompleteCaptures().length,1);
  await f.api.before();f.right.position.z+=.02;f.api.after();
  assert.equal(f.api.getRecords()[0].cut,1);
  f.api.exportJSON();const download=f.downloads.at(-1);
  const data=JSON.parse(await f.blobs.get(download.href).text());
  assert.equal(data.records.length,1);assert.equal(data.incompleteCaptures.length,1);
  assert.equal(data.incompleteCaptures[0].cut,0);
});

test('same label redraw and same-cut rail edits retain a usable pending capture',async()=>{
  const f=app();await f.api.before();
  const e=f.registry.get('O2N3DCutDescription');
  f.mutate([{target:e,oldValue:e.textContent,removedNodes:[{textContent:e.textContent}]}]);
  f.left.position.z+=.02;f.tick();f.right.position.y+=.01;f.tick();f.api.after();
  assert.equal(f.api.getRecords().length,1);assert.equal(f.api.getIncompleteCaptures().length,0);
  assert.equal(f.registry.get('__banane24-before').disabled,false);
});

test('rapid away-and-back and part changes cannot pair different visits',async()=>{
  const f=app();await f.api.before();
  f.changeCut(1);f.changeCut(0);f.tick();
  assert.equal(f.api.getIncompleteCaptures().length,1);
  await f.api.before();f.changeCut(0,21);f.api.after();
  assert.equal(f.api.getRecords().length,0);assert.equal(f.api.getIncompleteCaptures().length,2);
  assert.equal(f.registry.get('__banane24-before').disabled,false);
});

test('loading without rail objects waits; replacing the scene archives the pending baseline',async()=>{
  const f=app();await f.api.before();const root=f.viewer.scene.scene;
  f.viewer.scene.scene=null;f.tick();assert.equal(f.api.getIncompleteCaptures().length,0);
  assert.equal(f.registry.get('__banane24-before').disabled,true);
  f.viewer.scene.scene=F.scene().root;f.tick();
  assert.equal(f.api.getIncompleteCaptures().length,1);
  assert.equal(f.registry.get('__banane24-before').disabled,false);
  assert.equal(f.api.getRecords().length,0);
});

test('manual cancel preserves unfinished initial state and all completed records',async()=>{
  const f=app();await f.api.before();f.api.after();
  await f.api.before();f.registry.get('__banane24-cancel-before').onclick();
  assert.equal(f.api.getRecords().length,1);
  assert.equal(f.api.getIncompleteCaptures()[0].reason,'operator-cancelled');
  assert.equal(f.registry.get('__banane24-before').disabled,false);
});

test('cut change during export retains busy lock until cancellation exits and permits next capture',async()=>{
  const f=app();let release;
  const original=f.context.BananeLidar.capture;
  f.context.BananeLidar.capture=async options=>{
    await new Promise(resolve=>{release=resolve;});
    options.guard();return original(options);
  };
  const running=f.api.before();f.changeCut(1);f.tick();
  assert.equal(f.api.getIncompleteCaptures().length,1);
  assert.equal(f.registry.get('__banane24-before').disabled,true);
  await f.api.before();assert.match(f.status(),/export est en cours/);
  release();await running;
  assert.equal(f.registry.get('__banane24-before').disabled,false);
  assert.equal(f.downloads.length,0);
  f.context.BananeLidar.capture=original;
  await f.api.before();f.api.after();
  assert.equal(f.api.getRecords()[0].cut,1);
});

test('marker recovery stays unverified and never replaces explicit references',async()=>{
  const f=app();await f.api.before();f.left.position.y+=.02;f.api.after();f.api.captureCurrent();
  const records=f.api.getRecords();assert.equal(records.length,2);
  assert.equal(records[0].source,'explicit-before-after');
  assert.equal(records[1].source,'displayed-extraction-markers');
  assert.equal(records[1].rails.left.initialRotation,null);
  assert.ok(records[1].baselineWarning);assert.equal(records[1].continuesRecordId,null);
});

test('standalone export works without manual correction and preserves ESV positions',async()=>{
  const f=app(),positions=JSON.stringify([f.left.position,f.right.position]);
  await f.api.exportLidar();
  assert.equal(f.api.getRecords().length,0);assert.equal(f.downloads.length,1);
  const json=JSON.parse(await f.blobs.get(f.downloads[0].href).text());
  assert.equal(json.quality.retained,4);assert.equal(json.part,20);assert.equal(json.cut,0);
  assert.equal(json.railStateProvenance,'current-state-not-certified-original');
  assert.equal(JSON.stringify([f.left.position,f.right.position]),positions);
});

test('failure exports actionable diagnostic; empty cloud is not reported as usable',async()=>{
  const f=app();f.pc.visibleNodes=[];await f.api.exportLidar();
  assert.equal(f.api.getLastExport().status,'no-points');assert.match(f.status(),/incomplet/);
  f.left.scale.x=0;await f.api.exportLidar();
  assert.equal(f.api.getLastExport(),null);assert.match(f.status(),/singulière/);
  const d=f.downloads.at(-1),json=JSON.parse(await f.blobs.get(d.href).text());
  assert.equal(json.status,'capture-failed');assert.equal(json.diagnostic.viewerAvailable,true);
});

test('coexisting old extensions are diagnosed, not destroyed or invoked',async()=>{
  const f=app();f.context.__BANANE_V231={destroy(){throw Error('Do not erase old session');}};
  await f.api.exportLidar();assert.match(f.status(),/ancienne Banane/);
  assert.equal(f.api.getLastExport(),null);f.api.destroy();
  assert.equal(f.context.__BANANE_V24,undefined);assert.ok(f.context.__BANANE_V231);
});

test('a new visit exports a frame bridge so a recentered left rail is not mistaken for no motion',async()=>{
  const f=app();await f.api.exportLidar();const a=f.api.getLastExport();
  f.left.position.y+=.03;f.right.position.z+=.01;f.cutChanged();
  await f.api.exportLidar();const b=f.api.getLastExport();
  assert.notEqual(a.visitId,b.visitId);
  assert.equal(a.coordinateBridge.sceneFrameId,b.coordinateBridge.sceneFrameId);
  assert.deepEqual(b.rails.left.positionSceneRelative,[0,0,0]);
  const common=(d,side)=>C.point(d.coordinateBridge.captureSceneRelativeToSessionSceneRelative,d.rails[side].positionSceneRelative);
  const deltaL=common(b,'left').map((x,i)=>x-common(a,'left')[i]);
  const deltaR=common(b,'right').map((x,i)=>x-common(a,'right')[i]);
  assert.ok(C.distance(deltaL,[0,.03,0])<1e-8);
  assert.ok(C.distance(deltaR,[0,0,.01])<1e-8);
});

test('a changed scene root never shares a frame identifier by assumption',async()=>{
  const f=app();await f.api.exportLidar();const a=f.api.getLastExport();
  f.viewer.scene.scene=F.scene().root;
  await f.api.exportLidar();const b=f.api.getLastExport();
  assert.notEqual(a.coordinateBridge.sceneFrameId,b.coordinateBridge.sceneFrameId);
});
