/* Ariane 4.9 — RÉSUMÉ DE PARTIE (chantier U1, réécrit par la mission G).
 *
 * Module PUR : tout ce qu'il lit lui est passé en argument. Aucune lecture de
 * stockage, d'horloge, de variable globale ni de commande à ESV. Le panneau lit
 * l'historique (IndexedDB, en lecture seule), le projette avec `projectEvent`
 * et appelle `summarize`. Les outils lisent un export avec `fromJournal`.
 *
 * Ce que le module rend : les lots de la partie, ses coupes distinctes, les
 * différés restants, les inconnus — et si ces comptes sont COMPLETS. Un compte
 * qui n'est pas prouvé complet n'est jamais présenté comme exact par le panneau.
 *
 * RÈGLES (rapport de la mission G, § 2) :
 *  R1  Session. Un événement qui porte une autre session d'Ariane est écarté,
 *      et avec lui tout son lot. Les événements sans session sont ceux du moteur
 *      de cette session (il ne la renouvelle pas).
 *  R2  Lot. Un événement qui porte un identifiant de lot lui appartient. Les
 *      autres (lecture avant, état du lot, reprise manuelle, SKIP) vont au lot
 *      qui tournait à leur heure : le dernier lot commencé avant eux.
 *  R3  Partie. La partie résumée est celle du lot courant (comme le titre
 *      « Orbite · Partie N ») ; sans lot, celle qu'ESV affiche.
 *  R4  Contexte. Sans identifiant de projet, une partie se reconnaît à sa page,
 *      son repère et son profil. Deux pages ne sont la même partie que si Ariane
 *      l'a établi : un même lot y a des résultats, ou l'a rattaché à la nouvelle
 *      page après un rechargement d'ESV. Jamais par le seul numéro.
 *  R5  Coupe. Une coupe = son numéro dans ce contexte. Une identité incomplète
 *      n'est jamais une coupe (ni la coupe 0) : elle est comptée à part.
 *  R6  Issue dans un lot. Posée (validation acceptée), différée (différé
 *      finalisé et confirmé), reprise à la main (déclaration), SKIP (commande
 *      envoyée). Une visite sans aucune de ces preuves : issue inconnue.
 *  R7  Reprise. L'issue d'une coupe est celle de son DERNIER lot ; le lot
 *      courant est toujours le dernier. Une reprise n'ajoute pas de coupe ; un
 *      différé ensuite posé sort des différés restants.
 *  R8  En cours. Dans un lot ouvert, le cut actif sans issue est « en cours » :
 *      il n'est pas encore compté, sauf s'il l'était déjà par un lot précédent
 *      (son issue devient alors inconnue).
 *  R9  Complétude. Les comptes ne sont complets que si l'historique a été lu en
 *      entier, que chaque lot de la partie y a son début, et qu'aucun événement
 *      utile n'a d'identité incomplète. Le total de la partie reste inconnu.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArianePartSummary49=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const FORMAT='ariane-resume-partie-1';
 const SIDES=['left','right'];
 /* Les états d'un lot encore ouvert (panel.js, OUVERT). */
 const OPEN=new Set(['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','PAUSED_DEFER_NAVIGATION_UNCERTAIN','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE','MANUAL_TAKEOVER']);
 /* Événements utiles au résumé ; tous les autres sont ignorés à la lecture. */
 const TYPES=new Set(['batch-started','batch-state','batch-rebased-after-reload','before-captured','gcv1-shadow-observed',
   'validation-accepted','defer-finalized','batch-manual-completion','explicit-skip-observation']);
 /* Issues décisives (R6) et ordre de préférence à heure égale. */
 const DECISIVE={posed:4,deferred:3,manual:2,skipped:1};

 const present=v=>v!==null&&v!==undefined&&v!==''&&v!=='not-observed';
 const text=v=>present(v)?String(v):null;
 const time=v=>typeof v==='string'&&v?v:null;

 /* Identité normalisée, comme `completeIdentity` du cœur : `project` ancien
  * accepté pour le projet. Partie et coupe doivent être des entiers. */
 function identity(x){if(!x||typeof x!=='object')return null;
   return {projectId:text(x.projectId)??text(x.project),pageId:text(x.pageId),frameId:text(x.frameId),shape:text(x.shape),
     part:Number.isInteger(x.part)?x.part:null,cut:Number.isInteger(x.cut)?x.cut:null};}
 /* Anciens exports : une entrée de lot sans identité garde sa clé de coupe
  * (`pageId|part|cut|shape|frameId|projectId`, ou l'ancienne `pageId|part|cut`). */
 function identityOfEntry(p){if(p?.identity)return identity(p.identity);if(typeof p?.key!=='string')return null;
   const f=p.key.split('|'),n=v=>/^\d+$/.test(v??'')?Number(v):null;
   return identity({pageId:f[0],part:n(f[1]),cut:n(f[2]),shape:f[3],frameId:f[4],projectId:f[5]});}
 /* Contexte d'une partie (R4) ; null si l'identité ne le permet pas. */
 function contextOf(i){if(!i||!Number.isInteger(i.part))return null;
   if(i.projectId)return JSON.stringify(['projet',i.projectId,i.part]);
   return i.pageId&&i.frameId&&i.shape?JSON.stringify(['page',i.pageId,i.frameId,i.shape,i.part]):null;}

 const motifsOf=rails=>SIDES.map(s=>rails?.[s]?.gcv1?.motif??rails?.[s]?.next?.motif??null).filter(present).map(String);
 /* Motif d'un différé, dans l'ordre de l'outil d'analyse (acceptance-report,
  * `pilotOutcome`) : sans points d'abord, puis refus d'écartement, puis moteur. */
 function deferKind(motifs,gauge){
   if(motifs.includes('input'))return 'noInput';
   if(gauge===true||motifs.includes('gauge-out-of-contract'))return 'gaugeRejected';
   return motifs.length?'engineDeferred':'unclassifiedDeferred';}

 /* Projection : ce que le résumé garde d'un événement, sans nuage, pose,
  * matrice ni capture. L'objet source n'est jamais modifié. Idempotente. */
 function projectEvent(e){
   if(!e||typeof e!=='object')return null;
   if(e.projection===FORMAT)return e;
   if(!TYPES.has(e.type)||present(e.nativeSessionId)||present(e.manualSessionId))return null;
   const p={projection:FORMAT,eventId:text(e.eventId),type:e.type,timestamp:time(e.timestamp),sessionId:text(e.sessionId),
     batchId:text(e.batchId),identity:identity(e.identity)};
   if(e.type==='batch-started'){p.batchId=text(e.batch?.id)??p.batchId;p.startedAt=time(e.batch?.startedAt)??p.timestamp;}
   else if(e.type==='batch-state')p.state=text(e.state)??text(e.batch?.state);
   else if(e.type==='batch-rebased-after-reload')p.from=identity({...e.identity,pageId:e.dePageId,frameId:e.deFrameId});
   else if(e.type==='gcv1-shadow-observed'){p.gauge=e.shadow?.summary?.pairGaugeRejected===true;p.motifs=motifsOf(e.shadow?.rails);}
   else if(e.type==='validation-accepted')p.posed=e.action==='VALIDATE';
   else if(e.type==='defer-finalized'){p.confirmed=e.deferredConfirmed===true;p.motifs=motifsOf(e.rails);}
   else if(e.type==='explicit-skip-observation')p.commandSent=e.commandSent===true;
   return p;
 }

 const emptyCounts=()=>({distinct:0,posed:0,deferred:0,engineDeferred:0,gaugeRejected:0,noInput:0,unclassifiedDeferred:0,manual:0,skipped:0,unknown:0});
 function countRows(rows){const c=emptyCounts();
   for(const r of rows){c.distinct++;c[r.status]++;if(r.status==='deferred')c[r.kind]++;}
   return c;}

 /* Union de contextes (R4). */
 function unions(){const parent=new Map();
   const find=k=>{let r=k;while(parent.has(r)&&parent.get(r)!==r)r=parent.get(r);let x=k;while(x!==r){const n=parent.get(x);parent.set(x,r);x=n;}return r;};
   const add=k=>{if(!parent.has(k))parent.set(k,k);};
   return {find:k=>{add(k);return find(k);},join(a,b){add(a);add(b);const ra=find(a),rb=find(b);if(ra!==rb)parent.set(rb,ra);}};}

 /* Entrées d'un export (journal ou bilan) : historique entier, état figé. */
 function fromJournal(j){const s=j?.state||{};
   return {sessionId:s.sessionId??null,batch:s.batch??null,identity:s.current?.identity??null,
     events:[...(Array.isArray(j?.events)?j.events:[]),...(Array.isArray(s.events)?s.events:[])],historyStatus:'available'};}

 const chrono=(a,b)=>(a.timestamp??'').localeCompare(b.timestamp??'')||(a.eventId??'').localeCompare(b.eventId??'');

 /* Projection, dédoublonnage (un événement réémis garde son identifiant),
  * ordre chronologique : la clé de stockage n'ordonne rien. */
 function readEvents(events){const seen=new Set(),out=[];
   for(const raw of Array.isArray(events)?events:[]){const e=projectEvent(raw);if(!e)continue;
     if(e.eventId){if(seen.has(e.eventId))continue;seen.add(e.eventId);}out.push(e);}
   return out.sort(chrono);}

 /* Les lots (R1, R2). Chaque lot reçoit ses événements ; un lot d'une autre
  * session est gardé comme « écarté » pour que ses visites ne glissent pas
  * dans le lot précédent. */
 function buildLots(all,session,cur){
   const curId=cur?String(cur.id):null,lots=new Map();
   const lotOf=id=>{if(!lots.has(id))lots.set(id,{id,startedAt:null,startKnown:false,startIdentity:null,state:null,current:false,excluded:false,events:[],entries:[]});return lots.get(id);};
   for(const e of all)if(e.sessionId&&e.sessionId!==session&&e.batchId&&e.batchId!==curId)lotOf(e.batchId).excluded=true;
   for(const e of all)if(e.type==='batch-started'&&e.batchId){const l=lotOf(e.batchId);
     if(!l.startKnown){l.startKnown=true;l.startedAt=e.startedAt;l.startIdentity=e.identity;}}
   if(cur){const l=lotOf(curId);l.current=true;l.state=text(cur.state);l.startedAt=l.startedAt??time(cur.startedAt);}
   /* Début perdu : l'heure du premier événement du lot situe ses visites. */
   for(const e of all)if(e.batchId&&e.type!=='batch-started'){const l=lotOf(e.batchId);
     if(!l.startKnown&&!l.current&&e.timestamp&&(!l.startedAt||e.timestamp<l.startedAt))l.startedAt=e.timestamp;}
   /* Le lot courant est le dernier de la session, quelle que soit son heure. */
   const timeline=[...lots.values()].filter(l=>l.startedAt).sort((a,b)=>a.current-b.current||a.startedAt.localeCompare(b.startedAt));
   const running=t=>{let found=null;if(t)for(const l of timeline)if(l.startedAt<=t)found=l;return found;};
   for(const e of all){if(e.type==='batch-started'||e.sessionId&&e.sessionId!==session)continue;
     const l=e.batchId?lots.get(e.batchId):running(e.timestamp);if(l&&!l.excluded)l.events.push(e);}
   /* Le lot courant apporte ses listes durables, complètes pour ce lot. */
   if(cur){const l=lots.get(curId),entry=(p,status,at,extra={})=>l.entries.push({identity:identityOfEntry(p),status,at:time(at),...extra});
     const at=p=>p?.evidence?.startedAt??p?.evidence?.navigationAfter?.observedAt;
     for(const p of cur.processed||[])entry(p,'posed',at(p));
     for(const p of cur.deferred||[])entry(p,'deferred',p.deferredAt,{motifs:motifsOf(p.rails)});
     for(const p of cur.manuallyCompleted||[])entry(p,'manual',p.declaredAt);
     for(const p of cur.skipped||[])entry(p,'skipped',at(p));
     for(const p of [...(cur.paused||[]),...(cur.interrupted||[])])if(p&&p.status!=='MANUAL_COMPLETION')entry(p,'visit',p.at);}
   return lots;}

 /* R4 : contextes réunis par un même lot — résultats portant son identifiant,
  * listes du lot courant, rattachement explicite après rechargement d'ESV. */
 function linkContexts(lots,cur){const U=unions();
   for(const l of lots.values()){if(l.excluded)continue;const byPart=new Map();
     const link=i=>{const k=contextOf(i);if(!k)return;U.find(k);if(byPart.has(i.part))U.join(byPart.get(i.part),k);else byPart.set(i.part,k);};
     if(l.startIdentity)link(l.startIdentity);
     for(const e of l.events){
       if(e.type==='batch-rebased-after-reload'){const a=contextOf(e.from),b=contextOf(e.identity);if(a&&b&&e.from.part===e.identity.part)U.join(a,b);}
       else if(e.batchId)link(e.identity);}
     for(const x of l.entries)link(x.identity);
     if(l.current)link(identity(cur.activeIdentity));}
   return U;}

 /* R5, R6 : l'issue de chaque coupe de la partie dans un lot. */
 function outcomes(l,inGroup,part){
   const facts=[],rows=new Map();let identityUnknown=0,unlinked=0;
   for(const e of l.events){let f=null;
     if(e.type==='before-captured')f={status:'visit'};
     else if(e.type==='gcv1-shadow-observed')f={status:'visit',shadow:true,gauge:e.gauge===true};
     else if(e.type==='validation-accepted')f={status:e.posed?'posed':'visit'};
     else if(e.type==='defer-finalized')f={status:e.confirmed?'deferred':'visit',motifs:e.motifs};
     else if(e.type==='batch-manual-completion')f={status:'manual'};
     else if(e.type==='explicit-skip-observation')f={status:e.commandSent?'skipped':'visit'};
     if(f)facts.push({...f,identity:e.identity,at:e.timestamp});}
   facts.push(...l.entries);
   for(const f of facts){
     if(!contextOf(f.identity)||!Number.isInteger(f.identity.cut)){identityUnknown++;continue;}
     /* Même partie sur une page non rapprochée : non comptée, mais signalée. */
     if(!inGroup(f.identity)){if(f.identity.part===part)unlinked++;continue;}
     const k=f.identity.cut,r=rows.get(k)||{cut:k,decisive:null,gauge:false};rows.set(k,r);
     if(f.shadow)r.gauge=f.gauge;
     if(f.status==='visit')continue;
     const d=r.decisive,a=f.at??'',b=d?.at??'';
     if(!d||a>b||a===b&&DECISIVE[f.status]>=DECISIVE[d.status])r.decisive=f;}
   const cuts=new Map();
   for(const r of rows.values()){const d=r.decisive,status=d?d.status:'unknown';
     cuts.set(r.cut,{cut:r.cut,status,kind:status==='deferred'?deferKind(d.motifs||[],r.gauge):null});}
   const belongs=facts.some(f=>inGroup(f.identity)),placed=!!contextOf(l.startIdentity)||facts.some(f=>contextOf(f.identity));
   return {cuts,identityUnknown,unlinked,belongs,placed};}

 /* summarize — entrées explicites :
  *   sessionId      session d'Ariane (état du moteur) ;
  *   batch          lot courant ou dernier lot de l'état (null sans lot) ;
  *   identity       cut affiché par ESV (ne sert que sans lot) ;
  *   events         événements connus : historique lu et fenêtre récente de
  *                  l'état, bruts ou projetés, doublons admis ;
  *   historyStatus  'available' (historique lu en entier), 'loading' ou
  *                  'unavailable'.
  * `details: true` ajoute les coupes et leur issue (outils, essais). */
 function summarize({sessionId=null,batch=null,identity:shown=null,events=[],historyStatus='unavailable',details=false}={}){
   const status=['available','loading','unavailable'].includes(historyStatus)?historyStatus:'unavailable';
   const session=text(sessionId),result={format:FORMAT,scope:null,historyStatus:status,historyComplete:false,partTotal:null,lots:[],counts:null,
     deferredCuts:[],unknownCuts:[],inProgress:0,activeCut:null,identityUnknown:0,missingStarts:0,unlinked:0,otherPageLots:0,excludedLots:0};
   if(!session)return result;
   const cur=batch&&present(batch.id)?batch:null,all=readEvents(events),lots=buildLots(all,session,cur),U=linkContexts(lots,cur);
   result.excludedLots=[...lots.values()].filter(l=>l.excluded).length;

   /* R3 : la partie du lot courant ; sans lot (ou lot sans identité), celle d'ESV. */
   let anchor=null,source='esv';
   if(cur){const l=lots.get(String(cur.id)),part=Number.isInteger(cur.scope?.part)?cur.scope.part:null;
     anchor=[identity(cur.activeIdentity),l.startIdentity,...l.entries.map(x=>x.identity)].find(i=>contextOf(i)&&(part===null||i.part===part))||null;
     if(anchor)source='lot';}
   if(!anchor){const i=identity(shown);anchor=contextOf(i)?i:null;}
   if(!anchor)return result;
   const group=U.find(contextOf(anchor)),inGroup=i=>{const k=contextOf(i);return !!k&&U.find(k)===group;};
   result.scope={sessionId:session,source,part:anchor.part,projectId:anchor.projectId,pageId:anchor.pageId,frameId:anchor.frameId,shape:anchor.shape};

   const partLots=[];
   for(const l of lots.values()){if(l.excluded)continue;const o=outcomes(l,inGroup,anchor.part);
     const mine=l.current&&source==='lot'||l.startIdentity&&inGroup(l.startIdentity)||o.belongs;
     if(mine)partLots.push({lot:l,...o});
     /* Lot sans aucune identité exploitable : il pourrait être de cette partie. */
     else if(!o.placed&&o.identityUnknown)result.identityUnknown+=o.identityUnknown;
     /* Même numéro de partie sur une page non rapprochée (rechargement d'ESV
      * sans reprise du lot, ou autre projet) : non compté, et dit. */
     else if(o.unlinked||l.startIdentity?.part===anchor.part)result.otherPageLots++;}
   partLots.sort((a,b)=>a.lot.current-b.lot.current||(a.lot.startedAt??'').localeCompare(b.lot.startedAt??'')||a.lot.id.localeCompare(b.lot.id));

   /* R8 : le cut actif d'un lot ouvert, sans issue, est en cours. */
   const curLot=partLots.find(x=>x.lot.current);
   if(curLot&&OPEN.has(text(cur.state))){const a=identity(cur.activeIdentity),st=a&&curLot.cuts.get(a.cut)?.status;
     if(a&&Number.isInteger(a.cut)&&inGroup(a)&&(!st||st==='unknown')){result.inProgress=1;result.activeCut=a.cut;curLot.cuts.delete(a.cut);}}

   /* R7 : la dernière issue de chaque coupe ; une coupe déjà comptée et de
    * nouveau en cours garde sa place, issue inconnue. */
   const merged=new Map();
   for(const x of partLots)for(const [cut,row] of x.cuts)merged.set(cut,row);
   if(result.activeCut!==null&&merged.has(result.activeCut))merged.set(result.activeCut,{cut:result.activeCut,status:'unknown',kind:null});

   /* R9 : complétude, lot par lot puis pour la partie. */
   for(const x of partLots){const l=x.lot,rows=[...x.cuts.values()].sort((a,b)=>a.cut-b.cut);
     if(!l.startKnown)result.missingStarts++;result.identityUnknown+=x.identityUnknown;result.unlinked+=x.unlinked;
     /* État d'un lot passé : son dernier état consigné. */
     const state=l.current?l.state:l.events.filter(e=>e.type==='batch-state'&&e.state).at(-1)?.state??null;
     const lot={id:l.id,startedAt:l.startedAt,startKnown:l.startKnown,state,current:l.current,
       complete:status==='available'&&l.startKnown&&x.identityUnknown===0&&x.unlinked===0,counts:countRows(rows)};
     if(details)lot.cuts=rows;
     result.lots.push(lot);}
   const rows=[...merged.values()].sort((a,b)=>a.cut-b.cut);
   result.counts=countRows(rows);
   result.deferredCuts=rows.filter(r=>r.status==='deferred').map(r=>r.cut);
   result.unknownCuts=rows.filter(r=>r.status==='unknown').map(r=>r.cut);
   if(details)result.cuts=rows;
   result.historyComplete=status==='available'&&result.identityUnknown===0&&result.otherPageLots===0&&result.lots.every(l=>l.complete);
   return result;
 }

 return {FORMAT,projectEvent,summarize,fromJournal,contextOf,deferKind};
});
