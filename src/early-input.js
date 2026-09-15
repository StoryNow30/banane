// Register before ESV scripts. The guard stays inactive outside manual sessions.
(()=>{'use strict';if(window.__banane4InputGate)return;
 const gate=window.__banane4InputGate={active:false,phase:'IDLE',channel:null,held:null};
 const nativeGate=window.__banane4NativeGate={active:false,channel:null};
 const editingKeys=new Set(['d','a','q','s','g','arrowleft','arrowright','arrowup','arrowdown']);
 function input(e){
   if(nativeGate.active&&nativeGate.channel&&e.isTrusted!==false){const editable=!!e.target?.closest?.('input,textarea,select,[contenteditable="true"]');
     const targetKind=editable?'input':e.target?.closest?.('#O2N3DCutValidate3DRail')?'validation':e.target?.closest?.('canvas')?'canvas':e.target?.closest?.('button,a')?'control':'other';
     window.postMessage({kind:'banane4:native-input',channel:nativeGate.channel,input:{type:e.type,code:editable?null:e.code,key:editable?null:e.key,
       shiftKey:!!e.shiftKey,ctrlKey:!!e.ctrlKey,metaKey:!!e.metaKey,altKey:!!e.altKey,repeat:!!e.repeat,isTrusted:true,targetKind,editable,
       observedAt:new Date().toISOString(),eventTimeStamp:Number.isFinite(e.timeStamp)?e.timeStamp:null}},location.origin);
   }
   if(!gate.active||!gate.channel||e.isTrusted===false||e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
   const space=(e.code==='Space'||e.key===' ')&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey;
   const backspace=(e.code==='Backspace'||e.key==='Backspace')&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey;
   // Enter is advertised by the observed native ESV button's title.
   const enter=e.key==='Enter'&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey;
   const keyup=e.type==='keyup'&&(space||backspace||enter||gate.held&&(e.code===gate.held||e.key===gate.held));
   const targetKind=e.target?.closest?.('#O2N3DCutValidate3DRail')?'validation':e.target?.closest?.('canvas')?'canvas':'other';
   const decision=e.type==='keydown'&&(space||enter||backspace)||e.type==='click'&&targetKind==='validation';
   if(gate.phase==='ERROR'&&(decision||keyup)){
     e.preventDefault();e.stopImmediatePropagation();if(keyup)gate.held=null;return;
   }
   const preparing=['PREPARING','SAVING','AWAITING_NAV'].includes(gate.phase);
   const pointing=preparing&&(targetKind==='canvas'&&['pointerdown','mousedown','click'].includes(e.type)||e.type==='keydown'&&editingKeys.has(e.key?.toLowerCase())&&!e.ctrlKey&&!e.metaKey&&!e.altKey);
   if(!keyup&&!decision&&!pointing)return;
   e.preventDefault();e.stopImmediatePropagation();
   if(decision&&e.type==='keydown')gate.held=e.code||e.key;if(keyup)gate.held=null;
   window.postMessage({kind:'banane4:operator-input',channel:gate.channel,input:{type:e.type,code:e.code,key:e.key,
     shiftKey:!!e.shiftKey,ctrlKey:!!e.ctrlKey,metaKey:!!e.metaKey,altKey:!!e.altKey,repeat:!!e.repeat,
     isTrusted:true,targetKind}},location.origin);
 }
 for(const type of ['keydown','keyup','pointerdown','mousedown','click'])window.addEventListener(type,input,true);
})();
