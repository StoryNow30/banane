const fs=require('node:fs'),path=require('node:path');
const K=require('../src/core.js');
const base=JSON.parse(fs.readFileSync(path.join(__dirname,'corpus/banane-lidar-part-23-cut-2855-1788941885642.json')));
class MemoryStore{
 constructor(){this.state=null;this.clouds=new Map();this.events=[];this.records=[];}
 async getState(){return K.clone(this.state);}async setState(s){this.state=K.clone(s);}
 async putCloud(id,c){this.clouds.set(id,K.clone(c));}async getCloud(id){return this.clouds.has(id)?K.clone(this.clouds.get(id)):undefined;}
 async putEvent(e){this.events.push(K.clone(e));}async putRecord(r){const copy=K.clone(r),id=copy.recordId||copy.id,index=this.records.findIndex(x=>(x.recordId||x.id)===id);
  if(index<0)this.records.push(copy);else this.records[index]=copy;}
}
class SimulatedESV{
 constructor(){this.identity={pageId:'fixture-page',part:23,cut:100,shape:'U50',frameId:'fixture-frame',projectId:null};
  this.rails=K.clone(base.rails);this.order=['left','right'];this.calls=[];this.offset=false;this.server=false;this.noNavigation=false;this.noPoints=false;}
 async state(){return {identity:K.clone(this.identity),rails:K.clone(this.rails),capturedAt:new Date().toISOString()};}
 async ping(){return {version:K.VERSION,pageId:this.identity.pageId};}
 async capture(expected){K.assertTarget(expected.identity,this.identity);this.calls.push('capture');
  const d=K.clone(base);d.identity=K.clone(this.identity);Object.assign(d,this.identity);d.captureId=K.uid();d.rails=K.clone(this.rails);if(this.noPoints)d.pointsSceneRelative=[];return d;}
 async apply(before,proposals){this.calls.push('apply');this.rails=K.expectedPoses(before,proposals);
  if(this.offset){this.rails.left.positionSceneRelative[1]+=.1;this.rails.left.railLocalToSceneRelative[13]+=.1;}
  return this.state();}
 async restore(before){this.calls.push('restore');this.rails=K.clone(before.rails);return this.state();}
 async next(){this.calls.push('next');this.identity.cut++;this.rails=K.clone(base.rails);return this.state();}
 async validateAndNext(){this.calls.push('validate');if(this.noNavigation)throw Error('Validation ambiguë : délai dépassé.');
  const after=await this.state();await this.next();return {commandSent:true,afterObserved:true,afterStateStatus:'OBSERVED_SAME_TARGET',afterState:after,
   navigationObserved:true,serverConfirmed:this.server,nextIdentity:K.clone(this.identity),navigationAfter:{identity:K.clone(this.identity)}};}
 async skipAndNext(){this.calls.push('skip');if(this.noNavigation)throw Error('SKIP ambigu : délai dépassé.');
  const after=await this.state();await this.next();return {commandSent:true,afterObserved:true,afterStateStatus:'OBSERVED_SAME_TARGET',afterState:after,
   navigationObserved:true,serverConfirmed:this.server,nextIdentity:K.clone(this.identity),navigationAfter:{identity:K.clone(this.identity)}};}
 async nativeSnapshot(){return this.state();}
 async nativeStart(){this.calls.push('nativeStart');return {active:true};}
 async nativePause(){this.calls.push('nativePause');return {active:false,paused:true,metrics:{}};}
 async nativeResume(){this.calls.push('nativeResume');return {active:true};}
 async nativeFinish(){this.calls.push('nativeFinish');return {active:false,metrics:{}};}
 async cancel(){this.calls.push('cancel');}
}
module.exports={MemoryStore,SimulatedESV,base,K};
