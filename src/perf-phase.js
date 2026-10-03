(function(root,factory){'use strict';const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.BananePhaseTiming=api;
  // Only the injected dependency is replaced. The frozen geometry and brain
  // objects, their state, and every original calculation remain untouched.
  if(root.BananeGeometryRuntimeV46)root.BananeGeometryRuntimeV46=api.runtimeFacade(root.BananeGeometryRuntimeV46);
 }
})(typeof globalThis!=='undefined'?globalThis:this,function(root){'use strict';
 const FIELDS=['pageId','part','cut','shape','frameId','projectId'];
 const identity=x=>Object.fromEntries(FIELDS.map(k=>[k,x?.[k]??(k==='projectId'&&x?.project!=='not-observed'?x?.project:null)??null]));
 const key=x=>JSON.stringify(FIELDS.map(k=>identity(x)[k]));
 const safe=fn=>{try{return fn();}catch{return undefined;}};
 let active=null;
 function runtimeFacade(runtime,get=()=>active){
  const facade={...runtime};
  function wrap(receiver,name,label){const original=receiver[name];return function(...args){
   const r=safe(get),c=safe(()=>r?.runtimeContext?r.runtimeContext():r?.context()),from=safe(()=>r?.now());let ok=false;
   try{const value=original.apply(receiver,args);ok=true;return value;}
   finally{safe(()=>r?.span(label,from,r.now(),c,{success:ok,side:label==='v46-scientific'?args[1]:null,
    inputKind:r.inputKind||'unattributed',inputId:r.inputId||null,captureId:args[0]?.captureId??null,
    inputIdentity:identity(args[0]?.identity),options:label==='v46-pair-complete'?r.options(args[1]):null}));}
  };}
  facade.proposeBoth=wrap(runtime,'proposeBoth','v46-pair-complete');
  if(runtime.frozen?.propose)facade.frozen={...runtime.frozen,propose:wrap(runtime.frozen,'propose','v46-scientific')};
  return facade;
 }
 class Recorder{
  constructor(engine,store,{now=()=>root.performance.now(),uid=()=>root.crypto.randomUUID(),origin=root.performance?.timeOrigin,maxPending=512,maxRequests=128,flushTimeoutMs=250}={}){
   this.engine=engine;this.store=store;this.now=now;this.uid=uid;this.origin=origin;this.clockId=uid();
   this.maxPending=maxPending;this.maxRequests=maxRequests;this.pending=new Set();this.requests=new Map();this.batches=new Map();
   this.batch=null;this.visit=null;this.next=null;this.seq=0;this.beforeCapture=false;this.finishing=null;this.analysisId=null;
   // Technical export budget, not a pose-quality threshold. Tests may shorten
   // it; production always uses 250 ms. Pending writes are never discarded.
   this.flushTimeoutMs=Number.isFinite(flushTimeoutMs)&&flushTimeoutMs>0&&flushTimeoutMs<=250?flushTimeoutMs:250;
   this.pendingBatches=new Map();this.flushWaiters=new Set();
  }
  options(x){const out={};for(const k of ['minConfidence','maxMoveMm','minTop','minFace','searchY','searchZ'])if(typeof x?.[k]==='number'&&Number.isFinite(x[k]))out[k]=x[k];return out;}
  context(v=this.visit){return v?{sessionId:v.sessionId,batchId:v.batchId,visitId:v.visitId,identity:v.identity,
   captureId:v.captureId??null,analysisId:v.analysisId??null,proposalId:v.proposalId??null,selector:this.selector??null}:null;}
  runtimeContext(){return this.engine.s.mode==='automatic-test'&&(!this.batch?.closed||this.engine.task)?this.context():null;}
  emit(kind,detail={},context=this.context()){return safe(()=>{
   if(!context?.sessionId||!context.batchId)return;
   const start=this.now(),b=this.batches.get(context.batchId);if(!b)return;
   const event={eventId:this.uid(),timestamp:new Date().toISOString(),type:'phase-timing',schema:1,clockId:this.clockId,
    timeOrigin:this.origin,seq:++this.seq,batchSeq:++b.seq,ms:start,kind,...context,...detail};
   const health=kind==='health'?{seq:event.batchSeq,state:'not-enqueued',finalSnapshot:event.finalSnapshot}:null;
   if(health)b.latestHealth=health;
   const size=new TextEncoder().encode(JSON.stringify(event)).length;
   if(size>4096||this.pending.size>=this.maxPending){b.lost++;return health;}
   b.emitted++;b.bytes+=size;b.maxEventBytes=Math.max(b.maxEventBytes,size);b.pendingPeak=Math.max(b.pendingPeak,this.pending.size+1);
   // Never awaited by the action. Both synchronous and asynchronous failures
   // are isolated; the next health record discloses loss, not a success.
   let p;try{if(health)health.state='pending';p=Promise.resolve(this.store.putEvent(event)).then(()=>{if(health)health.state='stored';},()=>{b.lost++;if(health)health.state='rejected';}).finally(()=>{
    this.pending.delete(p);this.pendingBatches.delete(p);for(const settled of this.flushWaiters)settled();});}
   catch{b.lost++;if(health)health.state='rejected';return health;}
   this.pending.add(p);this.pendingBatches.set(p,b.id);b.instrumentationMs+=Math.max(0,this.now()-start);return health;
  });}
  batchContext(b=this.batch){return b?{sessionId:b.sessionId,batchId:b.id,visitId:null,identity:null}:null;}
  syncBatch(knownStart=false){return safe(()=>{
   const s=this.engine.s,b=s.batch;if(!b?.id||!s.sessionId||s.mode!=='automatic-test'&&b.state!=='MANUAL_TAKEOVER')return;
   if(this.batch?.id===b.id)return;
   if(this.batch)this.emit('batch',{point:'replaced',knownBoundary:false},this.batchContext());
   const item={id:b.id,sessionId:s.sessionId,knownStart,seq:0,lost:0,emitted:0,bytes:0,maxEventBytes:0,pendingPeak:0,instrumentationMs:0,visits:0,closed:false};
   this.batch=item;this.batches.set(b.id,item);this.visit=null;this.next=null;
   this.lastHalt=null;
   // Bounded history. Evicted batches have already emitted their health;
   // absent health in a truncated export never certifies completeness.
   if(this.batches.size>32)this.batches.delete(this.batches.keys().next().value);
   this.emit('batch',{point:knownStart?'start':'restored',knownBoundary:knownStart},this.batchContext());
   if(!knownStart&&['STOPPED','COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS'].includes(b.state))this.batch.closed=true;
  });}
  ensureVisit(target,{recapture=false}={}){return safe(()=>{
   this.syncBatch();const b=this.engine.s.batch;if(!this.batch||b?.id!==this.batch.id||this.batch.closed||!Number.isInteger(target?.cut))return;
   if(target.part!==b.scope?.part||target.cut<b.scope?.start||target.cut>b.scope?.end){this.emit('observation',{point:'out-of-scope-target',target:identity(target)},this.batchContext());return;}
   const id=identity(target);if(this.visit&&key(this.visit.identity)===key(id)&&!recapture)return this.visit;
   const n=this.next&&key(this.next.identity)===key(id)?this.next:null;
   const visit={...this.batchContext(),visitId:this.uid(),identity:id,captureId:null,proposalId:null,captured:false};
   this.visit=visit;this.batch.visits++;this.next=null;
   this.emit('visit',{point:'open',navigationMs:n?.ms??null,navigationReason:recapture?'recapture':n?'observed-target':this.batch.knownStart&&this.batch.visits===1?'already-visible':'unobserved'},this.context(visit));
   return visit;
  });}
  point(point,detail={},v=this.visit){return this.emit('point',{point,...detail},this.context(v));}
  span(label,fromMs,toMs,context=this.context(),detail={}){if(Number.isFinite(fromMs)&&Number.isFinite(toMs))this.emit('span',{label,fromMs,toMs,...detail},context);}
  targetSeen(target,v=this.visit,ms=this.now()) {return safe(()=>{
   if(!v||!Number.isInteger(target?.cut)||key(v.identity)===key(target))return;
   if(!v.nextSeen){v.nextSeen=true;this.point('next-observed',{atMs:ms,nextIdentity:identity(target)},v);}
   if(v===this.visit)this.next={identity:identity(target),ms};
  });}
  startRequest(action,args){return safe(()=>{
   this.syncBatch();if(!this.visit||this.batch?.closed||this.engine.s.mode!=='automatic-test')return null;
   if(this.requests.size>=this.maxRequests){this.batch.lost++;return null;}
   const r={id:this.uid(),action,fromMs:this.now(),visit:this.visit,context:this.context(),expected:args[0]?.identity||args[0]};
   this.requests.set(r.id,r);return r;
  });}
  endRequest(r,result,error,diagnostic){return safe(()=>{
   if(!r||!this.requests.delete(r.id))return;const to=this.now();
   this.span('command:'+r.action,r.fromMs,to,r.context,{commandId:r.id,pageRequestId:diagnostic?.requestId??null,success:!error});
   if(error)return;
   const id=result?.identity;
   if(r.action==='capture'&&key(id)===key(r.visit.identity)){
    r.visit.captureId=result.captureId??null;r.visit.captured=true;this.point('capture-received',{atMs:to,commandId:r.id},r.visit);
   }
   if(r.action==='state'&&this.finishing?.visit===r.visit&&key(id)===key(r.visit.identity)){
    this.span('after-state-read',this.finishing.fromMs,to,r.context,{commandId:r.id});this.point('after-read',{atMs:to,commandId:r.id},r.visit);this.finishing=null;
   }
   if(result?.navigationObserved&&result.nextIdentity)this.targetSeen(result.nextIdentity,r.visit,to);
   else if(r.action==='state'&&id)this.targetSeen(id,r.visit,to);
   if(r.action==='validateInPlace'&&result?.serverConfirmed)this.point('in-place',{atMs:to,commandId:r.id},r.visit);
  });}
  progress(m){return safe(()=>{const r=this.requests.get(m?.traceId);if(!r||r.action!==m.action)return;
   // Receipt time only: elapsedMs belongs to the page and is never subtracted.
   this.emit('request',{point:'progress',commandId:r.id,pageRequestId:m.requestId??null,stage:String(m.lastStage||'').slice(0,80)},r.context);
  });}
  control(name,detail={}){return this.emit('control',{name,...detail});}
  event(type,detail={}){return safe(()=>{
   if(type==='batch-started'){this.syncBatch(true);this.ensureVisit(detail.batch?.activeIdentity||this.engine.s.current?.identity);return;}
   if(this.engine.s.mode!=='automatic-test'&&!type.startsWith('batch-manual-'))return;
   if(this.batch?.closed&&!this.engine.task&&!type.startsWith('batch-manual-'))return;
   this.syncBatch();if(!this.visit)return;
   const matches=!detail.identity||key(detail.identity)===key(this.visit.identity);
   if(type==='cut-target-changed'){this.targetSeen(detail.nextIdentity);this.ensureVisit(detail.nextIdentity);return;}
   if(!matches)return;
   const points={'before-captured':'capture-stored','proposed':'proposed','gcv1-shadow-observed':'decision','applied-verified':'pose-readback','after-captured':'after-stored','validation-accepted':'accepted'};
   if(points[type]){
    if(type==='proposed')this.visit.proposalId=detail.proposal?.id??this.engine.s.proposal?.id??null;
    const d=type==='gcv1-shadow-observed'?{selector:detail.shadow?.selection?.selector??null,selectedEngine:detail.shadow?.selection?.selectedEngine??null}:type==='validation-accepted'?{validationAttemptId:detail.validationAttemptId??null,validationProof:detail.validationProof??null}:{};
    this.point(points[type],d);
   }
   if(['defer-finalized','defer-confirmed','dernier-cut-differe'].includes(type))this.point('deferred',{reason:type});
   if(type==='batch-manual-takeover'){this.control('manual-takeover',{cause:'operator'});this.point('manual-takeover');}
   if(type==='batch-manual-completion'){this.control('manual-completed',{cause:'operator'});this.targetSeen(detail.nextIdentity);}
   if(type==='gauge-contract-violation')this.visit.haltCause='guard';
   if(type==='batch-stopped-at-end'){
    if(detail.applied===false||detail.reason==='dernier-cut-differe')this.point('deferred',{reason:'last-unresolved'});
    if(detail.applied===true)this.point('last-unvalidated',{reason:'lot-boundary'});
   }
   if(type==='batch-state'){
    const state=detail.state,b=this.engine.s.batch;
    if(state?.startsWith('PAUSED')||state==='ERROR'){
     const message=b?.error?.message||b?.pauseReason||'',cause=state==='PAUSED_ADAPTER_UNRESPONSIVE'?'adapter-unresponsive':this.visit.haltCause||(/muet|ne répond plus|sans progression/i.test(message)?'esv-silent':/guard|garde|gauge/i.test(message)?'guard':'protection');
     if(!this.operatorPending&&!this.lastHalt)this.control('halt',{cause,state});this.lastHalt=state;
    }else if(state==='RUNNING'){this.lastHalt=null;this.visit.haltCause=null;}
    if(['STOPPED','COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS'].includes(state)&&!this.batch.closed){
     this.emit('batch',{point:'end',knownBoundary:true,state},this.batchContext());this.batch.closed=true;
     this.health(this.batch);
    }
   }
  });}
  health(b=this.batch,final=false){if(b)return this.emit('health',{emitted:b.emitted,lost:b.lost,visits:b.visits,bytes:b.bytes,maxEventBytes:b.maxEventBytes,pendingPeak:b.pendingPeak,
   instrumentationMs:b.instrumentationMs,finalSnapshot:final&&b.closed,requestsPending:[...this.requests.values()].filter(r=>r.context.batchId===b.id).length},this.batchContext(b));}
  waitPending(deadline){if(!this.pending.size)return Promise.resolve(true);
   // Remove the waiter on timeout: repeated exports do not attach an endless
   // chain of observers to a Promise that may never settle.
   return new Promise(resolve=>{let timer;const finish=ok=>{this.flushWaiters.delete(settled);root.clearTimeout(timer);resolve(ok);};
    const settled=()=>{if(!this.pending.size)finish(true);};this.flushWaiters.add(settled);
    timer=root.setTimeout(()=>finish(false),Math.max(0,deadline-root.performance.now()));settled();});
  }
  async flush(){const start=root.performance.now(),deadline=start+this.flushTimeoutMs,health=new Map();
   let drained=await this.waitPending(deadline);
   if(drained){for(const b of this.batches.values())health.set(b.id,this.health(b,true));drained=await this.waitPending(deadline);}
   const lots=[...this.batches.values()].map(b=>{const h=health.get(b.id),pendingWrites=[...this.pendingBatches.values()].filter(id=>id===b.id).length;
    const requestsPending=[...this.requests.values()].filter(r=>r.context.batchId===b.id).length,healthStored=h?.state==='stored';
    return {sessionId:b.sessionId,batchId:b.id,clockId:this.clockId,pendingWrites,requestsPending,lost:b.lost,healthStored,healthSeq:h?.seq??null,
     healthState:h?.state??'not-attempted',complete:!!(drained&&b.closed&&healthStored&&h.finalSnapshot&&pendingWrites===0&&requestsPending===0&&b.lost===0)};});
   const flushComplete=drained&&this.pending.size===0&&lots.every(b=>b.healthStored);
   return {schema:1,status:!drained?'timeout':!flushComplete?'health-incomplete':lots.some(b=>b.lost)?'measurements-lost':'flushed',
    maxWaitMs:this.flushTimeoutMs,elapsedMs:root.performance.now()-start,flushComplete,pendingWrites:this.pending.size,lots};
  }
  trackTask(label,fn){const token=safe(()=>{const t={label,context:this.runtimeContext(),from:this.now(),previous:this.task};this.task=t;return t;});
   const done=error=>safe(()=>{if(!token)return;this.span(label,token.from,this.now(),token.context,{success:!error});if(this.task===token)this.task=token.previous;});
   let result;try{result=fn();}catch(e){done(e);throw e;}
   if(result&&typeof result.then==='function')void result.then(()=>done(null),done);else done(null);return result;
  }
 }
 function install(engine,store,options){return safe(()=>{
  const r=new Recorder(engine,store,options);active=r;
  // Attach observers while returning the ORIGINAL promise/object. An observer
  // failure cannot change its resolution or rejection, nor retry the action.
  function wrap(name,before,after){const original=engine[name];if(typeof original!=='function')return;
   engine[name]=function(...args){const token=safe(()=>before?.(args));let result;
    try{result=original.apply(this,args);}catch(e){safe(()=>after?.(null,e,token));throw e;}
    if(result&&typeof result.then==='function')void result.then(v=>safe(()=>after?.(v,null,token)),e=>safe(()=>after?.(null,e,token)));
    else safe(()=>after?.(result,null,token));return result;
   };
  }
  const event=engine.event;engine.event=function(type,...args){const p=event.call(this,type,...args);void p.then(()=>r.event(type,args[0]),()=>{});return p;};
  wrap('init',null,()=>{r.syncBatch();r.ensureVisit(engine.s.current?.identity);});
  wrap('observe',null,(v,e)=>{if(e)return;const same=r.visit&&key(r.visit.identity)===key(v.identity);r.ensureVisit(v.identity,{recapture:!!(r.beforeCapture&&same&&r.visit.captured)});});
  wrap('begin',()=>{r.beforeCapture=true;},()=>{r.beforeCapture=false;});
  wrap('finish',()=>{r.finishing={visit:r.visit,fromMs:r.now()};},()=>{r.finishing=null;});
  wrap('analyze',()=>{if(!r.runtimeContext())return null;r.analysisId=r.uid();if(r.visit)r.visit.analysisId=r.analysisId;const token={id:r.analysisId,from:r.now(),context:r.context()};return token;},(_,e,t)=>{r.span('analysis-envelope',t?.from,r.now(),t?.context,{success:!e});if(r.analysisId===t?.id)r.analysisId=null;});
  for(const name of ['pause','stop','resume','retryPaused'])wrap(name,()=>{const t={context:r.context(),wasRunning:engine.s.batch?.state==='RUNNING',wasStopped:engine.s.batch?.state==='STOPPED',wasClosed:r.batch?.closed};
   if(name==='resume'&&r.batch?.closed)r.batch.closed=false;
   r.operatorPending=name;return t;},(_,e,t)=>{
   if(e&&name==='resume'&&t?.wasClosed&&r.batch)r.batch.closed=true;
   r.operatorPending=null;if(!e){r.emit('control',{name,cause:name==='stop'?'permanent':'operator',wasRunning:t?.wasRunning,repeated:name==='stop'&&t?.wasStopped},t?.context);
    if(name==='resume'&&t?.wasClosed)r.emit('batch',{point:'reopened',knownBoundary:false},r.batchContext());
    r.lastHalt=name==='pause'||name==='stop'?name:null;if(name==='stop'&&!engine.task&&r.batch&&!r.batch.closed){r.emit('batch',{point:'end',knownBoundary:true,state:'STOPPED'},r.batchContext());r.batch.closed=true;r.health();}}
  });
  const geometry=root.BananeGeometry3,shadow=root.BananeGCV1Shadow;
  function inputBoundary(object,name,kind){if(!object||typeof object[name]!=='function')return;const original=object[name];
   object[name]=function(...args){const actualKind=kind==='public'?(r.task?.label==='observe-lot'&&r.task.context?.analysisId===r.visit?.analysisId?'seeded':'unattributed-public'):kind;
    const token=safe(()=>{const prev=[r.inputKind,r.inputId];r.inputKind=actualKind;r.inputId=r.uid();return {prev,from:r.now(),context:r.runtimeContext()};});let ok=false;
    try{const value=original.apply(this,args);ok=true;return value;}
    finally{safe(()=>{if(token)r.span(kind==='initial'?'facade-total':'science-public-total',token.from,r.now(),token.context,{success:ok,inputId:r.inputId,inputKind:actualKind,captureId:args[0]?.captureId??null});});
     if(token)[r.inputKind,r.inputId]=token.prev;}
   };
  }
  inputBoundary(geometry,'proposeBoth','initial');inputBoundary(shadow,'scientificProposeBoth','public');
  return r;
 });}
 return {Recorder,install,runtimeFacade,identity,key,safe};
});
