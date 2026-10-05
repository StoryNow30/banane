/* V1 (4.9) — chronométrage par phase, observateur passif du service worker.
 *
 * Ce module ne commande rien. Il enveloppe quelques méthodes du moteur, la
 * façade V4.6 injectée et deux entrées scientifiques, puis écrit des jalons
 * dans le journal : `type:'phase-timing'`, `schema:1`.
 *
 * Invariants tenus partout :
 *  - chaque appel enveloppé rend la valeur, l'exception, l'objet Promise et le
 *    receveur de l'original ; une panne de mesure n'atteint jamais l'action
 *    (`safe`) et ne relance rien ;
 *  - aucune écriture de mesure n'est attendue par l'action ; une écriture
 *    perdue est comptée (`lost`), jamais présentée comme stockée ;
 *  - horloge : `performance.now()` du service worker (`ms`), une horloge par
 *    démarrage (`clockId`) ; le temps de la page n'est jamais soustrait.
 *
 * Le moteur (src/engine.js), la géométrie et le cerveau gelés ne sont pas
 * modifiés : seule la dépendance injectée `BananeGeometryRuntimeV46` est
 * remplacée par une façade qui appelle les originaux.
 */
(function(root,factory){'use strict';const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.BananePhaseTiming=api;
  if(root.BananeGeometryRuntimeV46)root.BananeGeometryRuntimeV46=api.runtimeFacade(root.BananeGeometryRuntimeV46);
 }
})(typeof globalThis!=='undefined'?globalThis:this,function(root){'use strict';

 /* ---------------------------------------------------------------- repères */
 const MAX_EVENT_BYTES=4096;          // un jalon plus gros est perdu, et compté
 const FLUSH_BUDGET_MS=250;           // budget technique d'export, pas un seuil de pose
 const MAX_BATCHES=32;                // historique borné des lots suivis
 const CLOSED_STATES=new Set(['STOPPED','COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS']);
 /* Événement du moteur → jalon de la visite. */
 const ENGINE_POINTS=new Map([['before-captured','capture-stored'],['proposed','proposed'],['gcv1-shadow-observed','decision'],
  ['applied-verified','pose-readback'],['after-captured','after-stored'],['validation-accepted','accepted']]);
 const DEFER_EVENTS=new Set(['defer-finalized','defer-confirmed','dernier-cut-differe']);
 const OPTION_KEYS=['minConfidence','maxMoveMm','minTop','minFace','searchY','searchZ'];

 /* ---------------------------------------------------------------- outils */
 const FIELDS=['pageId','part','cut','shape','frameId','projectId'];
 /* projectId : repli sur `project`, sauf « not-observed » ; jamais inventé. */
 const field=(x,k)=>x?.[k]??(k==='projectId'&&x?.project!=='not-observed'?x?.project:null)??null;
 function identity(x){const out={};for(const k of FIELDS)out[k]=field(x,k);return out;}
 const key=x=>JSON.stringify(FIELDS.map(k=>field(x,k)));
 const safe=fn=>{try{return fn();}catch{return undefined;}};
 /* Taille UTF-8 sans allocation : exacte jusqu'à MAX_EVENT_BYTES, au-delà
  * seule compte la réponse « trop gros ». Créé au premier jalon, dans `safe` :
  * le chargement du module ne dépend pas de TextEncoder. */
 let encoder=null,probe=null;
 function utf8Size(text){if(!encoder){encoder=new TextEncoder();probe=new Uint8Array(MAX_EVENT_BYTES+1);}
  const r=encoder.encodeInto(text,probe);return r.read<text.length?MAX_EVENT_BYTES+1:r.written;}
 function haltCause(message){
  return /muet|ne répond plus|sans progression/i.test(message)?'esv-silent':/guard|garde|gauge/i.test(message)?'guard':'protection';}

 /* Enveloppe passive d'une méthode : `before(args)` donne un jeton, `after`
  * reçoit (valeur, erreur, jeton) au règlement. L'objet rendu est celui de
  * l'original ; un observateur en panne ne change ni sa résolution ni son rejet. */
 function observeMethod(target,name,before,after){const original=target[name];if(typeof original!=='function')return;
  target[name]=function(...args){const token=safe(()=>before?.(args));let result;
   try{result=original.apply(this,args);}catch(e){safe(()=>after?.(null,e,token));throw e;}
   if(result&&typeof result.then==='function')void result.then(v=>safe(()=>after?.(v,null,token)),e=>safe(()=>after?.(null,e,token)));
   else safe(()=>after?.(result,null,token));
   return result;
  };
 }

 /* ------------------------------------------------- façade V4.6 (injectée) */
 let active=null;
 function runtimeFacade(runtime,get=()=>active){
  const facade={...runtime};
  function wrap(receiver,name,label){const original=receiver[name];return function(...args){
   const r=safe(get),context=safe(()=>r?.runtimeContext?r.runtimeContext():r?.context()),from=safe(()=>r?.now());let ok=false;
   try{const value=original.apply(receiver,args);ok=true;return value;}
   finally{safe(()=>r?.span(label,from,r.now(),context,{success:ok,side:label==='v46-scientific'?args[1]:null,
    inputKind:r.inputKind||'unattributed',inputId:r.inputId||null,captureId:args[0]?.captureId??null,
    inputIdentity:identity(args[0]?.identity),options:label==='v46-pair-complete'?r.options(args[1]):null}));}
  };}
  facade.proposeBoth=wrap(runtime,'proposeBoth','v46-pair-complete');
  if(runtime.frozen?.propose)facade.frozen={...runtime.frozen,propose:wrap(runtime.frozen,'propose','v46-scientific')};
  return facade;
 }

 /* ------------------------------------------------------------ enregistreur */
 class Recorder{
  constructor(engine,store,{now=()=>root.performance.now(),uid=()=>root.crypto.randomUUID(),origin=root.performance?.timeOrigin,
   maxPending=512,maxRequests=128,flushTimeoutMs=FLUSH_BUDGET_MS}={}){
   this.engine=engine;this.store=store;this.now=now;this.uid=uid;this.origin=origin;this.clockId=uid();
   this.maxPending=maxPending;this.maxRequests=maxRequests;
   // Production : toujours 250 ms. Un essai peut raccourcir, jamais allonger.
   this.flushTimeoutMs=Number.isFinite(flushTimeoutMs)&&flushTimeoutMs>0&&flushTimeoutMs<=FLUSH_BUDGET_MS?flushTimeoutMs:FLUSH_BUDGET_MS;
   this.pending=new Set();this.pendingBatches=new Map();this.flushWaiters=new Set();   // écritures en cours
   this.batches=new Map();this.batch=null;this.visit=null;this.next=null;               // lots et visites
   this.requests=new Map();this.task=undefined;                                         // commandes et tâches
   this.seq=0;this.beforeCapture=false;this.finishing=null;this.analysisId=null;
  }

  /* -- contextes ------------------------------------------------------- */
  context(v=this.visit){return v?{sessionId:v.sessionId,batchId:v.batchId,visitId:v.visitId,identity:v.identity,
   captureId:v.captureId??null,analysisId:v.analysisId??null,proposalId:v.proposalId??null,selector:this.selector??null}:null;}
  batchContext(b=this.batch){return b?{sessionId:b.sessionId,batchId:b.id,visitId:null,identity:null}:null;}
  /* Contexte d'un calcul : seulement dans un lot ouvert, ou pendant sa tâche. */
  runtimeContext(){return this.engine.s.mode==='automatic-test'&&(!this.batch?.closed||this.engine.task)?this.context():null;}
  options(x){const out={};for(const k of OPTION_KEYS)if(typeof x?.[k]==='number'&&Number.isFinite(x[k]))out[k]=x[k];return out;}

  /* -- émission -------------------------------------------------------- */
  /* Rend le suivi de santé quand le jalon est une santé (`kind:'health'`). */
  emit(kind,detail={},context=this.context()){return safe(()=>{
   if(!context?.sessionId||!context.batchId)return;
   const start=this.now(),b=this.batches.get(context.batchId);if(!b)return;
   const event={eventId:this.uid(),timestamp:new Date().toISOString(),type:'phase-timing',schema:1,clockId:this.clockId,
    timeOrigin:this.origin,seq:++this.seq,batchSeq:++b.seq,ms:start,kind,...context,...detail};
   const health=kind==='health'?{seq:event.batchSeq,state:'not-enqueued',finalSnapshot:event.finalSnapshot}:null;
   const size=utf8Size(JSON.stringify(event));
   if(size>MAX_EVENT_BYTES||this.pending.size>=this.maxPending){b.lost++;return health;}
   b.emitted++;b.bytes+=size;b.maxEventBytes=Math.max(b.maxEventBytes,size);b.pendingPeak=Math.max(b.pendingPeak,this.pending.size+1);
   if(!this.enqueue(event,b,health))return health;
   b.instrumentationMs+=Math.max(0,this.now()-start);return health;
  });}
  /* Écriture jamais attendue par l'action : échec synchrone ou asynchrone
   * compté comme perte ; la santé suivante le dit. */
  enqueue(event,b,health){let p;
   try{if(health)health.state='pending';
    p=Promise.resolve(this.store.putEvent(event)).then(()=>{if(health)health.state='stored';},()=>{b.lost++;if(health)health.state='rejected';}).finally(()=>{
     this.pending.delete(p);this.pendingBatches.delete(p);for(const settled of this.flushWaiters)settled();});}
   catch{b.lost++;if(health)health.state='rejected';return false;}
   this.pending.add(p);this.pendingBatches.set(p,b.id);return true;
  }
  point(point,detail={},v=this.visit){return this.emit('point',{point,...detail},this.context(v));}
  span(label,fromMs,toMs,context=this.context(),detail={}){if(Number.isFinite(fromMs)&&Number.isFinite(toMs))this.emit('span',{label,fromMs,toMs,...detail},context);}
  control(name,detail={}){return this.emit('control',{name,...detail});}

  /* -- lots ------------------------------------------------------------ */
  /* Suit le lot courant du moteur (Orbite, ou reprise manuelle de ce lot). */
  syncBatch(knownStart=false){return safe(()=>{
   const s=this.engine.s,b=s.batch;
   if(!b?.id||!s.sessionId||s.mode!=='automatic-test'&&b.state!=='MANUAL_TAKEOVER')return;
   if(this.batch?.id===b.id)return;
   if(this.batch)this.emit('batch',{point:'replaced',knownBoundary:false},this.batchContext());
   const item={id:b.id,sessionId:s.sessionId,knownStart,seq:0,lost:0,emitted:0,bytes:0,maxEventBytes:0,pendingPeak:0,instrumentationMs:0,visits:0,closed:false};
   this.batch=item;this.batches.set(b.id,item);this.visit=null;this.next=null;this.lastHalt=null;
   // Historique borné : un lot sorti a déjà émis sa santé ; une santé absente
   // d'un export tronqué ne certifie jamais la complétude.
   if(this.batches.size>MAX_BATCHES)this.batches.delete(this.batches.keys().next().value);
   this.emit('batch',{point:knownStart?'start':'restored',knownBoundary:knownStart},this.batchContext());
   if(!knownStart&&CLOSED_STATES.has(b.state))this.batch.closed=true;
  });}
  closeBatch(state){this.emit('batch',{point:'end',knownBoundary:true,state},this.batchContext());this.batch.closed=true;this.health(this.batch);}
  health(b=this.batch,final=false){if(b)return this.emit('health',{emitted:b.emitted,lost:b.lost,visits:b.visits,bytes:b.bytes,maxEventBytes:b.maxEventBytes,
   pendingPeak:b.pendingPeak,instrumentationMs:b.instrumentationMs,finalSnapshot:final&&b.closed,requestsPending:this.requestsPendingFor(b.id)},this.batchContext(b));}
  requestsPendingFor(batchId){let n=0;for(const r of this.requests.values())if(r.context.batchId===batchId)n++;return n;}

  /* -- visites --------------------------------------------------------- */
  ensureVisit(target,{recapture=false}={}){return safe(()=>{
   this.syncBatch();const b=this.engine.s.batch;
   if(!this.batch||b?.id!==this.batch.id||this.batch.closed||!Number.isInteger(target?.cut))return;
   if(target.part!==b.scope?.part||target.cut<b.scope?.start||target.cut>b.scope?.end){
    this.emit('observation',{point:'out-of-scope-target',target:identity(target)},this.batchContext());return;}
   const id=identity(target),idKey=key(id);
   if(this.visit&&key(this.visit.identity)===idKey&&!recapture)return this.visit;
   const seen=this.next&&key(this.next.identity)===idKey?this.next:null;
   const visit={...this.batchContext(),visitId:this.uid(),identity:id,captureId:null,proposalId:null,captured:false};
   this.visit=visit;this.batch.visits++;this.next=null;
   const reason=recapture?'recapture':seen?'observed-target':this.batch.knownStart&&this.batch.visits===1?'already-visible':'unobserved';
   this.emit('visit',{point:'open',navigationMs:seen?.ms??null,navigationReason:reason},this.context(visit));
   return visit;
  });}
  /* Première cible différente vue pendant une visite : `next-observed`, et
   * départ de navigation de la visite suivante. */
  targetSeen(target,v=this.visit,ms=this.now()){return safe(()=>{
   if(!v||!Number.isInteger(target?.cut)||key(v.identity)===key(target))return;
   if(!v.nextSeen){v.nextSeen=true;this.point('next-observed',{atMs:ms,nextIdentity:identity(target)},v);}
   if(v===this.visit)this.next={identity:identity(target),ms};
  });}

  /* -- commandes adressées à la page ----------------------------------- */
  startRequest(action,args){return safe(()=>{
   this.syncBatch();if(!this.visit||this.batch?.closed||this.engine.s.mode!=='automatic-test')return null;
   if(this.requests.size>=this.maxRequests){this.batch.lost++;return null;}
   const r={id:this.uid(),action,fromMs:this.now(),visit:this.visit,context:this.context()};
   this.requests.set(r.id,r);return r;
  });}
  /* Session, lot et visite restent ceux du départ de la commande. */
  endRequest(r,result,error,diagnostic){return safe(()=>{
   if(!r||!this.requests.delete(r.id))return;const to=this.now(),v=r.visit;
   this.span('command:'+r.action,r.fromMs,to,r.context,{commandId:r.id,pageRequestId:diagnostic?.requestId??null,success:!error});
   if(error)return;
   const id=result?.identity,sameTarget=()=>key(id)===key(v.identity);
   if(r.action==='capture'&&sameTarget()){v.captureId=result.captureId??null;v.captured=true;this.point('capture-received',{atMs:to,commandId:r.id},v);}
   if(r.action==='state'&&this.finishing?.visit===v&&sameTarget()){
    this.span('after-state-read',this.finishing.fromMs,to,r.context,{commandId:r.id});this.point('after-read',{atMs:to,commandId:r.id},v);this.finishing=null;}
   if(result?.navigationObserved&&result.nextIdentity)this.targetSeen(result.nextIdentity,v,to);
   else if(r.action==='state'&&id)this.targetSeen(id,v,to);
   if(r.action==='validateInPlace'&&result?.serverConfirmed)this.point('in-place',{atMs:to,commandId:r.id},v);
  });}
  /* Heure de réception seulement : `elapsedMs` appartient à la page. */
  progress(m){return safe(()=>{const r=this.requests.get(m?.traceId);if(!r||r.action!==m.action)return;
   this.emit('request',{point:'progress',commandId:r.id,pageRequestId:m.requestId??null,stage:String(m.lastStage||'').slice(0,80)},r.context);
  });}

  /* -- événements du moteur (après leur écriture) ---------------------- */
  event(type,detail={}){return safe(()=>{
   if(type==='batch-started'){this.syncBatch(true);this.ensureVisit(detail.batch?.activeIdentity||this.engine.s.current?.identity);return;}
   const manual=type.startsWith('batch-manual-');
   if(this.engine.s.mode!=='automatic-test'&&!manual)return;
   if(this.batch?.closed&&!this.engine.task&&!manual)return;
   this.syncBatch();if(!this.visit)return;
   if(type==='cut-target-changed'){this.targetSeen(detail.nextIdentity);this.ensureVisit(detail.nextIdentity);return;}
   if(detail.identity&&key(detail.identity)!==key(this.visit.identity))return;
   this.visitEvent(type,detail);
  });}
  visitEvent(type,detail){
   const point=ENGINE_POINTS.get(type);
   if(point){
    if(type==='proposed')this.visit.proposalId=detail.proposal?.id??this.engine.s.proposal?.id??null;
    this.point(point,type==='gcv1-shadow-observed'?{selector:detail.shadow?.selection?.selector??null,selectedEngine:detail.shadow?.selection?.selectedEngine??null}
     :type==='validation-accepted'?{validationAttemptId:detail.validationAttemptId??null,validationProof:detail.validationProof??null}:{});
   }
   if(DEFER_EVENTS.has(type))this.point('deferred',{reason:type});
   switch(type){
    case 'batch-manual-takeover':this.control('manual-takeover',{cause:'operator'});this.point('manual-takeover');break;
    case 'batch-manual-completion':this.control('manual-completed',{cause:'operator'});this.targetSeen(detail.nextIdentity);break;
    case 'gauge-contract-violation':this.visit.haltCause='guard';break;
    case 'batch-stopped-at-end':
     if(detail.applied===false||detail.reason==='dernier-cut-differe')this.point('deferred',{reason:'last-unresolved'});
     if(detail.applied===true)this.point('last-unvalidated',{reason:'lot-boundary'});
     break;
    case 'batch-state':this.batchState(detail.state);break;
   }
  }
  /* Arrêt : une seule cause comptée par interruption ; une action opérateur
   * en cours (pause, stop…) a sa propre ligne `control`. */
  batchState(state){
   if(state?.startsWith('PAUSED')||state==='ERROR'){
    const b=this.engine.s.batch,message=b?.error?.message||b?.pauseReason||'';
    const cause=state==='PAUSED_ADAPTER_UNRESPONSIVE'?'adapter-unresponsive':this.visit.haltCause||haltCause(message);
    if(!this.operatorPending&&!this.lastHalt)this.control('halt',{cause,state});
    this.lastHalt=state;
   }else if(state==='RUNNING'){this.lastHalt=null;this.visit.haltCause=null;}
   if(CLOSED_STATES.has(state)&&!this.batch.closed)this.closeBatch(state);
  }

  /* -- export ---------------------------------------------------------- */
  /* Attente bornée ; l'observateur est retiré à l'expiration, si bien que des
   * exports répétés n'accrochent pas une chaîne sans fin à une Promise figée. */
  waitPending(deadline){if(!this.pending.size)return Promise.resolve(true);
   return new Promise(resolve=>{let timer;const finish=ok=>{this.flushWaiters.delete(settled);root.clearTimeout(timer);resolve(ok);};
    const settled=()=>{if(!this.pending.size)finish(true);};this.flushWaiters.add(settled);
    timer=root.setTimeout(()=>finish(false),Math.max(0,deadline-root.performance.now()));settled();});
  }
  /* Écritures en attente, puis une santé finale par lot suivi, dans le même
   * budget. Rien n'est jeté : une écriture lente reste pendante et le dit. */
  async flush(){const start=root.performance.now(),deadline=start+this.flushTimeoutMs,health=new Map();
   let drained=await this.waitPending(deadline);
   if(drained){for(const b of this.batches.values())health.set(b.id,this.health(b,true));drained=await this.waitPending(deadline);}
   const writes=new Map();for(const id of this.pendingBatches.values())writes.set(id,(writes.get(id)||0)+1);
   const lots=[...this.batches.values()].map(b=>{const h=health.get(b.id),pendingWrites=writes.get(b.id)||0,requestsPending=this.requestsPendingFor(b.id),healthStored=h?.state==='stored';
    return {sessionId:b.sessionId,batchId:b.id,clockId:this.clockId,pendingWrites,requestsPending,lost:b.lost,healthStored,healthSeq:h?.seq??null,
     healthState:h?.state??'not-attempted',complete:!!(drained&&b.closed&&healthStored&&h.finalSnapshot&&pendingWrites===0&&requestsPending===0&&b.lost===0)};});
   const flushComplete=drained&&this.pending.size===0&&lots.every(b=>b.healthStored);
   return {schema:1,status:!drained?'timeout':!flushComplete?'health-incomplete':lots.some(b=>b.lost)?'measurements-lost':'flushed',
    maxWaitMs:this.flushTimeoutMs,elapsedMs:root.performance.now()-start,flushComplete,pendingWrites:this.pending.size,lots};
  }

  /* -- tâches du service worker (observe-lot, command-lot) ------------- */
  trackTask(label,fn){const token=safe(()=>{const t={label,context:this.runtimeContext(),from:this.now(),previous:this.task};this.task=t;return t;});
   const done=error=>safe(()=>{if(!token)return;this.span(label,token.from,this.now(),token.context,{success:!error});if(this.task===token)this.task=token.previous;});
   let result;try{result=fn();}catch(e){done(e);throw e;}
   if(result&&typeof result.then==='function')void result.then(()=>done(null),done);else done(null);
   return result;
  }
 }

 /* ------------------------------------------------------------ installation */
 function install(engine,store,options){return safe(()=>{
  const r=new Recorder(engine,store,options);active=r;
  // Événements : observés APRÈS leur écriture, sur la Promise originale.
  const event=engine.event;
  engine.event=function(type,...args){const p=event.call(this,type,...args);void p.then(()=>r.event(type,args[0]),()=>{});return p;};
  observeMethod(engine,'init',null,()=>{r.syncBatch();r.ensureVisit(engine.s.current?.identity);});
  observeMethod(engine,'observe',null,(v,e)=>{if(e)return;const same=r.visit&&key(r.visit.identity)===key(v.identity);
   r.ensureVisit(v.identity,{recapture:!!(r.beforeCapture&&same&&r.visit.captured)});});
  observeMethod(engine,'begin',()=>{r.beforeCapture=true;},()=>{r.beforeCapture=false;});
  observeMethod(engine,'finish',()=>{r.finishing={visit:r.visit,fromMs:r.now()};},()=>{r.finishing=null;});
  observeMethod(engine,'analyze',()=>{if(!r.runtimeContext())return null;r.analysisId=r.uid();if(r.visit)r.visit.analysisId=r.analysisId;
   return {id:r.analysisId,from:r.now(),context:r.context()};},
   (_,e,t)=>{r.span('analysis-envelope',t?.from,r.now(),t?.context,{success:!e});if(r.analysisId===t?.id)r.analysisId=null;});
  for(const name of ['pause','stop','resume','retryPaused'])observeMethod(engine,name,()=>operatorBefore(r,engine,name),(_,e,t)=>operatorAfter(r,engine,name,e,t));
  const geometry=root.BananeGeometry3,shadow=root.BananeGCV1Shadow;
  inputBoundary(r,geometry,'proposeBoth','initial');inputBoundary(r,shadow,'scientificProposeBoth','public');
  return r;
 });}
 /* Action opérateur : un lot fermé qu'on reprend est rouvert pendant l'appel,
  * refermé si la reprise échoue. */
 function operatorBefore(r,engine,name){const state=engine.s.batch?.state;
  const t={context:r.context(),wasRunning:state==='RUNNING',wasStopped:state==='STOPPED',wasClosed:r.batch?.closed};
  if(name==='resume'&&r.batch?.closed)r.batch.closed=false;
  r.operatorPending=name;return t;
 }
 function operatorAfter(r,engine,name,e,t){
  if(e&&name==='resume'&&t?.wasClosed&&r.batch)r.batch.closed=true;
  r.operatorPending=null;if(e)return;
  r.emit('control',{name,cause:name==='stop'?'permanent':'operator',wasRunning:t?.wasRunning,repeated:name==='stop'&&t?.wasStopped},t?.context);
  if(name==='resume'&&t?.wasClosed)r.emit('batch',{point:'reopened',knownBoundary:false},r.batchContext());
  r.lastHalt=name==='pause'||name==='stop'?name:null;
  // Stop hors tâche : fin connue ici ; pendant une tâche, à l'état STOPPED.
  if(name==='stop'&&!engine.task&&r.batch&&!r.batch.closed)r.closeBatch('STOPPED');
 }
 /* Frontière d'entrée scientifique : nomme l'entrée (initiale, semée par la
  * décision du lot, ou publique non attribuée) des spans V4.6 qu'elle contient. */
 function inputBoundary(r,object,name,kind){if(!object||typeof object[name]!=='function')return;const original=object[name];
  object[name]=function(...args){
   const actualKind=kind==='public'?(r.task?.label==='observe-lot'&&r.task.context?.analysisId===r.visit?.analysisId?'seeded':'unattributed-public'):kind;
   const token=safe(()=>{const prev=[r.inputKind,r.inputId];r.inputKind=actualKind;r.inputId=r.uid();return {prev,from:r.now(),context:r.runtimeContext()};});let ok=false;
   try{const value=original.apply(this,args);ok=true;return value;}
   finally{safe(()=>{if(token)r.span(kind==='initial'?'facade-total':'science-public-total',token.from,r.now(),token.context,{success:ok,inputId:r.inputId,inputKind:actualKind,captureId:args[0]?.captureId??null});});
    if(token)[r.inputKind,r.inputId]=token.prev;}
  };
 }
 return {Recorder,install,runtimeFacade,identity,key,safe};
});
