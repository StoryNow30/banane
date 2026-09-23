(()=>{'use strict';if(window.__banane3Bridge)return;window.__banane3Bridge=true;
 const channel=crypto.randomUUID(),pending=new Map(),allowed=new Set(['ping','state','nativeSnapshot','capture','apply','restore','next','nextWithoutDecision','validateAndNext','skipAndNext','manualStart','manualPause','manualResume','manualFinish','nativeStart','nativePause','nativeResume','nativeFinish','cancel']);
 let pill=null,launcherGeneration=0;
 function setLauncherVisible(visible){if(!pill)return;const shown=visible===true;pill.hidden=!shown;
  if(shown){if(!pill.isConnected)document.documentElement.append(pill);}else if(pill.isConnected)pill.remove();}
 async function refreshLauncher(){const generation=++launcherGeneration;
  try{const state=await chrome.runtime.sendMessage({kind:'launcher-status'});if(generation===launcherGeneration)setLauncherVisible(state?.visible===true);}
  catch{if(generation===launcherGeneration)setLauncherVisible(false);}}
 const passive=new Set(['ping','state','nativeSnapshot','nativeStart','nativePause','nativeResume','nativeFinish']);
 function diagnostic(p){return {requestId:p.id,action:p.action,elapsedMs:Date.now()-p.startedAt,acknowledged:p.acknowledged,lastStage:p.stage,lastDetail:p.detail};}
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
     p.respond({...(e.data.error?{error:e.data.error}:{result:e.data.result}),diagnostic:diagnostic(p)});}});
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
 pill=document.createElement('button');pill.textContent='Banane 4.7.8 · ouvrir';pill.type='button';pill.hidden=true;
 pill.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483646;background:#f5d65c;color:#172026;border:1px solid #7d712f;border-radius:9px;padding:10px 15px;font:600 13px Arial;cursor:pointer';
 pill.onclick=()=>{launcherGeneration++;setLauncherVisible(false);chrome.runtime.sendMessage({kind:'open-panel'}).then(reply=>{if(reply?.error)void refreshLauncher();},()=>refreshLauncher());};void refreshLauncher();
 // A heartbeat also makes interrupted background work observable; it never resumes a lot.
 setInterval(()=>{chrome.runtime.sendMessage({kind:'heartbeat'}).catch(()=>{});void refreshLauncher();},15000);
})();
