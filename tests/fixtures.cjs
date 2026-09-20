const fs=require('node:fs'),path=require('node:path');
const K=require('../src/core.js');
const base=JSON.parse(fs.readFileSync(path.join(__dirname,'corpus/banane-lidar-part-23-cut-2855-1788941885642.json')));
class MemoryStore{
 /* `onSetState` permet à un essai de faire échouer UNE écriture d'état à une
  * frontière précise du protocole, ou d'en capturer l'image exacte pour
  * reconstruire le runtime depuis les seules données persistées. */
 constructor(){this.state=null;this.clouds=new Map();this.events=[];this.records=[];this.onSetState=null;}
 async getState(){return K.clone(this.state);}
 async setState(s){if(this.onSetState)await this.onSetState(K.clone(s));this.state=K.clone(s);}
 async putCloud(id,c){this.clouds.set(id,K.clone(c));}async getCloud(id){return this.clouds.has(id)?K.clone(this.clouds.get(id)):undefined;}
 async putEvent(e){this.events.push(K.clone(e));}async putRecord(r){const copy=K.clone(r),id=copy.recordId||copy.id,index=this.records.findIndex(x=>(x.recordId||x.id)===id);
  if(index<0)this.records.push(copy);else this.records[index]=copy;}
}
class SimulatedESV{
 constructor(){this.identity={pageId:'fixture-page',part:23,cut:100,shape:'U50',frameId:'fixture-frame',projectId:null};
  this.rails=K.clone(base.rails);this.order=['left','right'];this.calls=[];this.offset=false;this.server=false;this.noNavigation=false;this.noPoints=false;
  /* Navigation sans décision : par défaut un pas en avant sur la même page et
   * la même part, sans delta imposé. Les essais règlent `deferJump` pour un
   * saut, `deferOutcome` pour un refus, une absence de progression ou une
   * cible divergente. Aucun de ces chemins ne touche apply/validate/skip. */
  this.deferJump=1;this.deferOutcome='navigate';this.deferCalls=[];this.deferIdentity=null;}
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
 async nextWithoutDecision(identity,scope,operationId){
  this.calls.push('nextWithoutDecision');this.deferCalls.push({identity:K.clone(identity),operationId});
  const evidence={format:'banane-next-without-decision-v1',operationId:operationId??null,action:'NEXT_WITHOUT_DECISION',
   trigger:'observed-esv-next-invalid-rail-button',command:{id:'O2N3DCutNextInvalid3DRail',exists:true,disabled:false},
   shortcutEquivalence:{claimedShortcut:'Maj+Z',established:false},operatorDecision:null,
   commandScope:'banane-operation-only',bananeValidated:false,applyCommandSent:false,
   validationCommandSent:false,skipCommandSent:false,commandRequested:true,commandInvoked:true,commandSent:true,
   beforeNavigationIdentity:K.completeIdentity(identity),navigationObserved:false,serverConfirmed:false,
   afterObserved:false,nextIdentity:null,nextIdentityComplete:false,nextReady:null,navigationAfter:null,refusal:null};
  if(this.deferOutcome==='unavailable')return {...evidence,commandInvoked:false,commandSent:false,
   refusal:{code:'NAVIGATION_COMMAND_UNAVAILABLE',message:'Commande ESV indisponible : O2N3DCutNextInvalid3DRail'}};
  if(this.deferOutcome==='target-mismatch')return {...evidence,commandInvoked:false,commandSent:false,
   refusal:{code:'TARGET_MISMATCH_BEFORE_COMMAND',message:'Le cut affiché a changé avant la navigation sans décision.'}};
  if(this.deferOutcome==='no-navigation')return {...evidence,
   refusal:{code:'NO_NAVIGATION_OBSERVED',message:'Navigation sans décision transmise, cut inchangé.'}};
  if(this.deferOutcome==='throw')throw Error('Adaptateur ESV sans réponse pendant la navigation sans décision.');
  // Progression : ESV affiche la cible, Banane la constate — elle ne la calcule pas.
  const target=this.deferIdentity?K.clone(this.deferIdentity):{...K.clone(this.identity),cut:this.identity.cut+this.deferJump};
  this.identity=K.clone(target);this.rails=K.clone(base.rails);
  const next=K.completeIdentity(target);
  return {...evidence,navigationObserved:true,nextIdentity:next,nextIdentityComplete:true,
   nextReady:this.deferOutcome==='next-not-ready'?false:true,navigationAfter:{identity:next,label:{pageId:next.pageId,part:next.part,cut:next.cut}}};
 }
 async nativeSnapshot(){return this.state();}
 async nativeStart(){this.calls.push('nativeStart');return {active:true};}
 async nativePause(){this.calls.push('nativePause');return {active:false,paused:true,metrics:{}};}
 async nativeResume(){this.calls.push('nativeResume');return {active:true};}
 async nativeFinish(){this.calls.push('nativeFinish');return {active:false,metrics:{}};}
 async cancel(){this.calls.push('cancel');}
}
module.exports={MemoryStore,SimulatedESV,base,K};
