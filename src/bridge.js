(()=>{'use strict';if(window.__banane3Bridge)return;window.__banane3Bridge=true;
 const channel=crypto.randomUUID(),pending=new Map(),allowed=new Set(['ping','state','nativeSnapshot','capture','apply','restore','next','nextWithoutDecision','validateAndNext','skipAndNext','manualStart','manualPause','manualResume','manualFinish','nativeStart','nativePause','nativeResume','nativeFinish','cancel']);
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
 function diagnostic(p){return {requestId:p.id,action:p.action,elapsedMs:Date.now()-p.startedAt,acknowledged:p.acknowledged,lastStage:p.stage,lastDetail:p.detail};}
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
 window.addEventListener('message',e=>{if(e.source!==window||e.origin!==location.origin||e.data?.channel!==channel)return;
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
   const id=crypto.randomUUID(),p={id,action:m.action,startedAt:Date.now(),respond,acknowledged:false,stage:'sent',detail:null};
   p.timer=setTimeout(()=>{pending.delete(id);
     if(['manualStart','manualFinish'].includes(m.action)&&window.__banane4InputGate)window.__banane4InputGate.active=false;
     if(['nativeStart','nativePause','nativeResume','nativeFinish'].includes(m.action)&&window.__banane4NativeGate)window.__banane4NativeGate.active=false;
     if(!passive.has(m.action))window.postMessage({kind:'banane3:command',id:crypto.randomUUID(),channel,action:'cancel',args:[]},location.origin);
     const error=p.acknowledged?'Délai dépassé dans ESV à l’étape '+p.stage+' ; résultat à contrôler.':'Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
     respond({error,diagnostic:diagnostic(p)});},['state','ping','nativeSnapshot'].includes(m.action)?4000:['capture','manualFinish'].includes(m.action)?90000:45000);
   pending.set(id,p);window.postMessage({kind:'banane3:command',id,channel,action:m.action,args:m.args||[]},location.origin);return true;});
 pill=document.createElement('button');pill.textContent='Banane 4.7.21 · ouvrir';pill.type='button';pill.hidden=true;
 /* 4.8.0 (direction, 26/09) : bouton blanc et discret, plein seulement au survol. */
 const repos='0 1px 2px rgba(15,23,42,.10),0 2px 8px rgba(15,23,42,.08)',survol='0 2px 4px rgba(15,23,42,.12),0 6px 18px rgba(15,23,42,.14)';
 pill.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483646;background:#fff;color:#1f2328;border:1px solid rgba(15,23,42,.12);border-radius:999px;padding:6px 12px;font:500 12px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;letter-spacing:.01em;cursor:pointer;opacity:.92;box-shadow:'+repos+';transition:opacity .16s ease,box-shadow .16s ease,transform .16s ease';
 pill.onmouseenter=pill.onfocus=()=>Object.assign(pill.style,{opacity:'1',boxShadow:survol,transform:'translateY(-1px)'});
 pill.onmouseleave=pill.onblur=()=>Object.assign(pill.style,{opacity:'.92',boxShadow:repos,transform:'none'});
 pill.onclick=()=>{launcherGeneration++;setLauncherVisible(false);chrome.runtime.sendMessage({kind:'open-panel'}).then(reply=>{if(reply?.error)void refreshLauncher();},()=>refreshLauncher());};void refreshLauncher();
 // A heartbeat also makes interrupted background work observable; it never resumes a lot.
 setInterval(()=>{chrome.runtime.sendMessage({kind:'heartbeat'}).catch(()=>{});void refreshLauncher();},15000);
})();
