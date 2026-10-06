(()=>{'use strict';if(window.__banane3Bridge)return;window.__banane3Bridge=true;
 const channel=crypto.randomUUID(),pending=new Map(),allowed=new Set(['ping','state','nativeSnapshot','capture','apply','restore','next','nextWithoutDecision','validateAndNext','validateInPlace','skipAndNext','manualStart','manualPause','manualResume','manualFinish','nativeStart','nativePause','nativeResume','nativeFinish','cancel']);
 let pill=null,strip=null,launcherGeneration=0;
 /* 4.7.20 (piste H) — bandeau d'état en bas de la page ESV, activé depuis le
  * panneau. Il ne capte aucun clic (pointer-events: none) : le Pilote clique
  * dans la vue d'ESV, rien ne doit s'interposer. Texte seulement, jamais de HTML. */
 function setBandeau(b){
  if(!b||!b.text){if(strip?.isConnected)strip.remove();return;}
  if(!strip){strip=document.createElement('div');strip.setAttribute('aria-live','polite');
   strip.style.cssText='position:fixed;left:16px;bottom:16px;z-index:2147483645;pointer-events:none;max-width:62vw;padding:7px 12px;border-radius:6px;background:rgba(0,0,0,.84);color:#fff;font:500 12px/1.3 ui-monospace,Consolas,monospace;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:3px solid #8a8a8a';}
  strip.textContent=String(b.text);strip.style.borderLeftColor=b.ton==='vert'?'#2fd07a':b.ton==='ambre'?'#f5a524':b.ton==='rouge'?'#ff4d4d':'#8a8a8a';
  if(!strip.isConnected)document.documentElement.append(strip);}
 function setLauncherVisible(visible){if(!pill)return;const shown=visible===true;pill.hidden=!shown;
  if(shown){if(!pill.isConnected)document.documentElement.append(pill);}else if(pill.isConnected)pill.remove();}
 async function refreshLauncher(){const generation=++launcherGeneration;
  try{const state=await chrome.runtime.sendMessage({kind:'launcher-status'});if(generation===launcherGeneration){setLauncherVisible(state?.visible===true);setBandeau(state?.bandeau||null);}}
  catch{if(generation===launcherGeneration){setLauncherVisible(false);setBandeau(null);}}}
 const passive=new Set(['ping','state','nativeSnapshot','nativeStart','nativePause','nativeResume','nativeFinish']);
 function diagnostic(p){return {requestId:p.id,...(p.traceId?{traceId:p.traceId}:{}),action:p.action,elapsedMs:Date.now()-p.startedAt,acknowledged:p.acknowledged,lastStage:p.stage,lastDetail:p.detail};}
 /* 4.7.19 (KI-059) : un message chrome.runtime est limité à 64 Mio. Une réponse
  * plus grosse échouait ici, dans la page, sans que le service worker reçoive
  * rien : le lot restait suspendu. On mesure avant d'envoyer, et un envoi qui
  * échoue quand même est remplacé par une erreur courte et explicite. Pour une
  * capture, l'erreur est une « Lecture LiDAR instable » : le lot se met en
  * pause reprenable, sans commande envoyée. */
 const MESSAGE_BUDGET=56*1024*1024;
 function tooBig(action,detail){return (action==='capture'?'Lecture LiDAR instable : ':'')+
   `réponse de l’adaptateur trop grosse pour un message Chrome (${action}, ${detail} ; limite 64 Mo).`+(action==='capture'?' Attends la fin du chargement ou rapproche la vue du cut, puis clique sur Reprendre.':'');}
 function reply(p,payload){
   let size=0;try{size=JSON.stringify(payload).length;}catch{size=Infinity;}
   if(size>MESSAGE_BUDGET)payload={error:tooBig(p.action,Number.isFinite(size)?Math.round(size/1048576)+' Mo':'taille illisible'),diagnostic:payload.diagnostic};
   try{p.respond(payload);}catch(e){p.respond({error:tooBig(p.action,e.message),diagnostic:payload.diagnostic});}}
 /* V1 (test 2, D-077/D-078) — RELAIS DE L'OBSERVATEUR PASSIF DE LA PAGE. L'observateur
  * (src/esv-observer.js, monde principal) poste ce qu'il voit ; ce message vient de la
  * PAGE, donc d'une source NON AUTHENTIFIÉE : copie profonde, schéma et tailles bornés,
  * jamais utilisé pour une décision. Le service worker ne range que pendant une séance ;
  * sinon (`accept:false`) la file est vidée ici, sans rien garder. Trous de numérotation
  * et file pleine sont dits par un jalon « gap », jamais passés sous silence. */
 const OBS={maxQueue:100,maxEntryChars:4096,maxPerMessage:50,maxMessageChars:65536,flushMs:250};
 const obs={observer:null,last:0,queue:[],timer:null,lost:0};
 function obsCopy(x){
  if(!x||typeof x!=='object'||!Number.isInteger(x.seq)||x.seq<0||typeof x.kind!=='string'||x.kind.length>24)return null;
  try{const json=JSON.stringify(x);return json.length>OBS.maxEntryChars?null:JSON.parse(json);}catch{return null;}}
 function relayObservation(d){
  if(d.v!==1||typeof d.observer!=='string'||d.observer.length>80)return;
  if(obs.observer!==d.observer){obs.observer=d.observer;obs.last=0;}
  const x=obsCopy(d.entry);if(!x||x.seq<1||x.seq<=obs.last)return;
  if(x.seq>obs.last+1)obs.queue.push({seq:0,kind:'gap',lost:x.seq-obs.last-1,reason:'ring-overflow'});
  obs.last=x.seq;obs.queue.push(x);
  while(obs.queue.length>OBS.maxQueue){obs.queue.shift();obs.lost++;}
  if(!obs.timer)obs.timer=setTimeout(obsFlush,OBS.flushMs);}
 async function obsFlush(){
  obs.timer=null;const entries=[];
  if(obs.lost){entries.push({seq:0,kind:'gap',lost:obs.lost,reason:'bridge-queue'});obs.lost=0;}
  let chars=0;
  while(obs.queue.length&&entries.length<OBS.maxPerMessage){const n=JSON.stringify(obs.queue[0]).length;if(entries.length&&chars+n>OBS.maxMessageChars)break;chars+=n;entries.push(obs.queue.shift());}
  if(!entries.length)return;
  if(obs.queue.length)obs.timer=setTimeout(obsFlush,OBS.flushMs);
  try{const r=await chrome.runtime.sendMessage({kind:'esv-observation',observer:obs.observer,entries});
   if(r&&r.accept===false)obs.queue.length=0;
   if(r&&r.enabled===false)window.postMessage({kind:'banane5:config',enabled:false},location.origin);
  }catch{}}
 try{window.postMessage({kind:'banane5:hello',afterSeq:0},location.origin);}catch{}
 window.addEventListener('message',e=>{if(e.source!==window||e.origin!==location.origin)return;
   if(e.data?.kind==='banane5:esv-observation'){relayObservation(e.data);return;}
   if(e.data?.channel!==channel)return;
   if(e.data.kind==='banane4:manual-phase'){
     const gate=window.__banane4InputGate;if(gate){gate.phase=e.data.phase;if(e.data.phase==='FINISHED')gate.active=false;}return;
   }
   if(e.data.kind==='banane4:manual-event'){
     const {requestId,type,payload}=e.data;
     chrome.runtime.sendMessage({kind:'manual-event',requestId,type,payload}).then(reply=>{
       window.postMessage({kind:'banane4:manual-ack',channel,requestId,...(reply?.error?{error:reply.error}:{result:reply?.result})},location.origin);
     },error=>window.postMessage({kind:'banane4:manual-ack',channel,requestId,error:error.message},location.origin));return;
   }
   if(e.data.kind==='banane4:native-event'){
     const {requestId,type,payload}=e.data;
     chrome.runtime.sendMessage({kind:'native-event',requestId,type,payload}).then(reply=>{
       window.postMessage({kind:'banane4:native-ack',channel,requestId,...(reply?.error?{error:reply.error}:{result:reply?.result})},location.origin);
     },error=>window.postMessage({kind:'banane4:native-ack',channel,requestId,error:error.message},location.origin));return;
   }
   /* D4 (4.8.5) : relevé passif d'ESV, après la réponse d'une capture ; transmis tel quel au journal. */
   if(e.data.kind==='banane3:releve'){if(e.data.releve&&typeof e.data.releve==='object')chrome.runtime.sendMessage({kind:'esv-releve',releve:e.data.releve}).catch(()=>{});return;}
   const p=pending.get(e.data.id);if(!p)return;
   if(e.data.kind==='banane3:progress'){
     p.acknowledged=true;p.stage=e.data.stage;p.detail=e.data.detail;
     if(!['state','ping'].includes(p.action))chrome.runtime.sendMessage({kind:'adapter-trace',...diagnostic(p)}).catch(()=>{});return;
   }
   if(e.data.kind==='banane3:result'){pending.delete(e.data.id);clearTimeout(p.timer);
     if(p.action==='manualFinish'||p.action==='manualStart'&&e.data.error){if(window.__banane4InputGate)window.__banane4InputGate.active=false;}
     if(['nativePause','nativeFinish'].includes(p.action)||['nativeStart','nativeResume'].includes(p.action)&&e.data.error){if(window.__banane4NativeGate)window.__banane4NativeGate.active=false;}
     reply(p,{...(e.data.error?{error:e.data.error}:{result:e.data.result}),diagnostic:diagnostic(p)});}});
 chrome.runtime.onMessage.addListener((m,sender,respond)=>{if(sender.id!==chrome.runtime.id)return;
   if(m.kind==='launcher-visibility'){
     // A delayed push may describe an earlier window set. Keep the pill absent
     // until the current background state answers this fresh read.
     launcherGeneration++;setLauncherVisible(false);void refreshLauncher();respond({ok:true});return;}
   if(m.kind!=='page-command'||!allowed.has(m.action))return;
   if(m.action==='manualStart'){
     const gate=window.__banane4InputGate;if(!gate){respond({error:'Recharge ESV pour activer l’enregistrement de session V4.'});return;}
     Object.assign(gate,{active:true,phase:'PREPARING',channel});
   }
   if(['nativeStart','nativeResume'].includes(m.action)){
     const gate=window.__banane4NativeGate;if(!gate){respond({error:'Recharge ESV pour activer l’observation native V4.'});return;}
     Object.assign(gate,{active:true,channel});
   }
   const id=crypto.randomUUID(),p={id,traceId:typeof m.traceId==='string'&&m.traceId.length<=80?m.traceId:null,action:m.action,startedAt:Date.now(),respond,acknowledged:false,stage:'sent',detail:null};
   p.timer=setTimeout(()=>{pending.delete(id);
     if(['manualStart','manualFinish'].includes(m.action)&&window.__banane4InputGate)window.__banane4InputGate.active=false;
     if(['nativeStart','nativePause','nativeResume','nativeFinish'].includes(m.action)&&window.__banane4NativeGate)window.__banane4NativeGate.active=false;
     /* 4.8.0 (KI-063) : l'annulation d'un délai vise la SEULE requête expirée ;
      * la page l'ignore si cette requête ne tourne plus. Un `cancel` expiré
      * n'en déclenche pas un autre : terrain du 26/09, un « Arrêter » resté sans
      * réponse pendant qu'ESV changeait de partie a coupé 45 s plus tard la
      * lecture du lot suivant (« Export interrompu. »). */
     if(!passive.has(m.action)&&m.action!=='cancel')window.postMessage({kind:'banane3:command',id:crypto.randomUUID(),channel,proprietaire:chrome.runtime.id,action:'cancel',args:[{requestId:id,reason:'bridge-timeout'}],sentAt:Date.now()},location.origin);
     const error=p.acknowledged?'Délai dépassé dans ESV à l’étape '+p.stage+' ; résultat à contrôler.':'Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
     respond({error,diagnostic:diagnostic(p)});},['state','ping','nativeSnapshot'].includes(m.action)?4000:['capture','apply','manualFinish'].includes(m.action)?90000:45000);
   /* D1 (4.8.5) : l'adaptateur n'obéit qu'à l'extension qui l'a installé. */
   pending.set(id,p);window.postMessage({kind:'banane3:command',id,channel,proprietaire:chrome.runtime.id,action:m.action,args:m.args||[],sentAt:Date.now()},location.origin);return true;});
 pill=document.createElement('button');pill.textContent='Ariane 4.9.0 test 1 · ouvrir';pill.type='button';pill.hidden=true;
 /* 4.8.0 (direction, 26/09) : bouton blanc et discret, plein seulement au survol. */
 const repos='0 1px 2px rgba(15,23,42,.10),0 2px 8px rgba(15,23,42,.08)',survol='0 2px 4px rgba(15,23,42,.12),0 6px 18px rgba(15,23,42,.14)';
 pill.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483646;background:#fff;color:#1f2328;border:1px solid rgba(15,23,42,.12);border-radius:999px;padding:6px 12px;font:500 12px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;letter-spacing:.01em;cursor:pointer;opacity:.92;box-shadow:'+repos+';transition:opacity .16s ease,box-shadow .16s ease,transform .16s ease';
 pill.onmouseenter=pill.onfocus=()=>Object.assign(pill.style,{opacity:'1',boxShadow:survol,transform:'translateY(-1px)'});
 pill.onmouseleave=pill.onblur=()=>Object.assign(pill.style,{opacity:'.92',boxShadow:repos,transform:'none'});
 pill.onclick=()=>{launcherGeneration++;setLauncherVisible(false);chrome.runtime.sendMessage({kind:'open-panel'}).then(reply=>{if(reply?.error)void refreshLauncher();},()=>refreshLauncher());};void refreshLauncher();
 // A heartbeat also makes interrupted background work observable; it never resumes a lot.
 setInterval(()=>{chrome.runtime.sendMessage({kind:'heartbeat'}).catch(()=>{});void refreshLauncher();},15000);
})();
