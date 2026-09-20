const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('../../vendor/capture-core.js'),K=require('../../src/core.js'),F=require('../v242/fixtures.cjs');
function page(){
 const left=F.rail(0,[0,0,0],0),right=F.rail(1.435,[0,0,0],0);right.children[1].children[0].geometry.attributes.position=F.buffer([[0,0,0],[0,-.035,0],[0,-.035,-.05]]);
 const root=F.object([0,0,0],'Scene');F.add(root,left);F.add(root,right);
 const camera=F.object([.2,0,0],'OrthographicCamera');camera.quaternion={x:.5,y:.5,z:.5,w:.5};camera.projectionMatrix={elements:C.identity()};
 let selected='left',clock=0,listener;const nodes=new Map(),responses=new Map(),progress=[],keyboard=[];
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),dispatchEvent:e=>{
  const rail=selected==='left'?left:right;const world=C.point(C.worldMatrix(camera),[e.clientX/400-1,1-e.clientY/300,-.2]);
  [rail.position.x,rail.position.y,rail.position.z]=world;
 }};
 for(const [id,text] of [['O2N3DCutDescription','Cut 100 of part 23'],['O2N3DCutShapeInfo','U50']])nodes.set(id,{textContent:text});
 for(const [id,side] of [['O2N3DCutLRClick','left'],['O2N3DCutRRClick','right']])nodes.set(id,{click(){selected=side;const p=side==='left'?left.position:right.position;camera.position={x:p.x+.2,y:p.y,z:p.z};}});
 nodes.set('O2N3DCutValidate3DRail',{title:'Press ↵ to validate both rails (Load next non validated cut)',click(){nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';}});
 nodes.set('O2N3DCutNextInvalid3DRail',{click(){nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';}});
 const ctx={console,window:null,location:{origin:'https://esv.lidar.altametris.xyz'},document:{getElementById:id=>nodes.get(id),dispatchEvent:e=>{
   keyboard.push(e);if(e.type==='keydown'&&e.key==='Backspace'&&e.shiftKey)nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';return true;}},
  BananeCaptureCore:C,BananeCore3:K,BananeSettings:require('../../src/settings.js'),BananeLodSignature:require('../../src/lod-signature.js'),BananeLidar:{...require('../../vendor/lidar.js')},BananeNativeLidar4:require('../../src/native-lidar.js'),BananeMerge3:require('../../src/merge-clouds.js'),
  viewer:{scene:{scene:root,pointclouds:[],getActiveCamera:()=>camera},renderer:{domElement:canvas}},
  Date:class extends Date{static now(){return clock;}},setTimeout:(fn,ms=0)=>{clock+=ms;queueMicrotask(()=>{ctx.onTick?.();fn();});},
  MouseEvent:class{constructor(type,args){this.type=type;Object.assign(this,args);}},KeyboardEvent:class{constructor(type,args){this.type=type;Object.assign(this,args);}},
  addEventListener:(event,fn)=>listener=fn,postMessage:m=>{if(m.kind==='banane3:progress')progress.push(m);else responses.get(m.id)(m);},crypto:{randomUUID:K.uid}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/adapter-page.js'),'utf8'),ctx);
 async function call(action,...args){const id=K.uid();return new Promise((resolve,reject)=>{responses.set(id,m=>m.error?reject(Error(m.error)):resolve(m.result));listener({source:vm.runInContext('window',ctx),origin:ctx.location.origin,data:{kind:'banane3:command',channel:'fixture',id,action,args}});});}
 return {ctx,left,right,root,nodes,call,progress,keyboard,advance:ms=>{clock+=ms;},clock:()=>clock};
}

module.exports={page};
