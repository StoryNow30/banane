(function(root,factory){const api=factory(typeof module==='object'?require('../vendor/capture-core.js'):root.BananeCaptureCore);
 if(typeof module==='object')module.exports=api;else root.BananeCore3=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 const VERSION='4.7.19';
 const clone=x=>JSON.parse(JSON.stringify(x)),uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
 const key=x=>`${x.pageId}|${x.part}|${x.cut}`;
 const identityFields=['pageId','part','cut','shape','frameId','projectId'];
 const identityValue=(x,k)=>k==='projectId'?(x?.projectId??(x?.project&&x.project!=='not-observed'?x.project:null)):x?.[k];
 const cutId=x=>identityFields.map(k=>identityValue(x,k)??'not-observed').join('|');
 function completeIdentity(x){return Object.fromEntries(identityFields.map(k=>[k,identityValue(x,k)??null]));}
 function differences(a,b){return identityFields.filter(k=>identityValue(a,k)!==identityValue(b,k));}
 function assertTarget(a,b){const changed=differences(a,b);if(changed.length)throw Error('Cible différente : '+changed.join(', '));}
 // Only these errors from the bundled, read-only exporter describe replaceable
 // LOD data. Camera, clipping, target, cancellation and write errors stay fatal.
 const TRANSIENT_CAPTURE_ERRORS=new Set([
   "Les nœuds LiDAR visibles ont changé pendant l'export. Attends la fin du chargement puis réessaie.",
   "Le nuage ou sa matrice a changé pendant l'export. Recommence lorsque la vue est stable.",
   'Le nuage a changé pendant le relevé des échantillons de diagnostic. Recommence sur une vue stable.',
   'Niveau de détail non stabilisé.'
 ]);
 function transientCaptureError(error){const message=typeof error==='string'?error:error?.message;
   return TRANSIENT_CAPTURE_ERRORS.has(message)||typeof message==='string'&&message.startsWith('Lecture LiDAR instable :');}
 function equalPoses(a,b,tolerance=1e-7){return ['left','right'].every(s=>['railLocalToSceneRelative','profileLocalToSceneRelative'].every(k=>
   Array.isArray(a?.[s]?.[k])&&Array.isArray(b?.[s]?.[k])&&a[s][k].length===16&&b[s][k].length===16&&
   a[s][k].every((v,i)=>Number.isFinite(v)&&Number.isFinite(b[s][k][i])&&Math.abs(v-b[s][k][i])<=tolerance)));}
 function reference(before,after,lidarId,sessionId){
   assertTarget(before.identity,after.identity);const rails={};
   for(const s of ['left','right']){const a=before.rails[s],b=after.rails[s],inv=a.sceneRelativeToProfileLocal;
     const from=C.point(inv,a.positionSceneRelative),to=C.point(inv,b.positionSceneRelative);
     const delta=to.map((v,i)=>v-from[i]);rails[s]={initial:clone(a),corrected:clone(b),
       displacementLocal:delta,displacementSceneMeters:C.distance(a.positionSceneRelative,b.positionSceneRelative),
       positionChanged:C.distance(a.positionSceneRelative,b.positionSceneRelative)>1e-8,
       rotationChanged:JSON.stringify([a.rotation,a.profileRotation])!==JSON.stringify([b.rotation,b.profileRotation])};}
   return {format:'banane-manual-reference-v3',version:VERSION,recordId:uid(),sessionId,
     visitId:`${before.identity.frameId}:${before.identity.part}:${before.identity.cut}`,
     coordinateBridge:{sceneFrameId:before.identity.frameId,captureSceneRelativeToSessionSceneRelative:C.identity()},
     ...before.identity,identity:clone(before.identity),startedAt:before.capturedAt,capturedAt:after.capturedAt,
     source:'explicit-before-after',lidarCaptureId:lidarId,rails};
 }
 function expectedPoses(before,proposals){
   const out=clone(before.rails);
   for(const s of ['left','right']){const p=proposals[s];if(!p?.delta)throw Error('Proposition absente : '+s);
     const world=C.point(before.rails[s].profileLocalToSceneRelative,p.delta);
     const origin=C.point(before.rails[s].profileLocalToSceneRelative,[0,0,0]);
     const d=world.map((v,i)=>v-origin[i]),r=out[s];
     for(const name of ['railLocalToSceneRelative','profileLocalToSceneRelative'])r[name]=C.multiply(C.translation(d),r[name]);
     r.sceneRelativeToProfileLocal=C.inverse(r.profileLocalToSceneRelative);
     r.positionSceneRelative=C.point(r.railLocalToSceneRelative,[0,0,0]);
     r.profileOriginSceneRelative=C.point(r.profileLocalToSceneRelative,[0,0,0]);
   }return out;
 }
 function parse(text,name='fichier'){
   let d;try{d=JSON.parse(text);}catch(e){throw Error(name+' : JSON invalide : '+e.message);}
   if(!d||typeof d!=='object'||Array.isArray(d))throw Error(name+' : objet JSON attendu.');return d;
 }
 function pairCorpus(files){
   const captures=new Map(),records=new Map(),errors=[],duplicates=[];
   for(const f of files){let d;try{d=parse(f.text,f.name);}catch(e){errors.push(e.message);continue;}
     const arrays={};for(const name of ['clouds','records','manualReferences']){
       if(d[name]!==undefined&&!Array.isArray(d[name]))errors.push(f.name+' : '+name+' doit être une liste.');
       arrays[name]=Array.isArray(d[name])?d[name]:[];
     }
     for(const cloud of [d,...arrays.clouds])if(cloud?.captureId&&Array.isArray(cloud.pointsSceneRelative)){
       if(captures.has(cloud.captureId)&&JSON.stringify(captures.get(cloud.captureId).data)!==JSON.stringify(cloud))errors.push('captureId contradictoire : '+cloud.captureId);
       else captures.set(cloud.captureId,{name:f.name,data:cloud});
     }
     for(const r of [...arrays.records,...arrays.manualReferences]){if(!r?.recordId)continue;
       if(records.has(r.recordId)){if(JSON.stringify(records.get(r.recordId).data)!==JSON.stringify(r))errors.push('recordId contradictoire : '+r.recordId);else duplicates.push(r.recordId);}
       else records.set(r.recordId,{name:f.name,data:r});}
   }
   const paired=[],missing=[];
   for(const r of records.values()){
     const c=captures.get(r.data.lidarCaptureId);if(!c){missing.push(r);continue;}
     const fields=['part','cut','shape','sessionId','visitId'];
     const bad=fields.filter(k=>r.data[k]===undefined||c.data[k]===undefined||r.data[k]!==c.data[k]);
     if(r.data.coordinateBridge?.sceneFrameId!==c.data.coordinateBridge?.sceneFrameId)bad.push('sceneFrameId');
     for(const s of ['left','right']){const initial=r.data.rails?.[s]?.initial,rail=c.data.rails?.[s];
       if(!initial||!rail||JSON.stringify(initial.profileLocalToSceneRelative)!==JSON.stringify(rail.profileLocalToSceneRelative))bad.push(s+'.initial');}
     if(bad.length)errors.push('Association refusée '+r.data.recordId+' : '+bad.join(', '));else paired.push({reference:r,capture:c});
   }
   return {paired,missing,errors,duplicates,uniqueRecords:records.size,uniqueCaptures:captures.size};
 }
 function manualDecision(rails,operatorDecision){
   if(operatorDecision==='SKIP')return 'SKIP';
   if(operatorDecision!=='VALIDATE')return null;
   const left=!!rails?.left?.positionChanged,right=!!rails?.right?.positionChanged;
   return left&&right?'VALIDATE_CORRECTED_BOTH':left?'VALIDATE_CORRECTED_LEFT_ONLY':right?'VALIDATE_CORRECTED_RIGHT_ONLY':'VALIDATE_NO_MOVEMENT';
 }
 return {C,VERSION,identityFields,clone,uid,key,cutId,completeIdentity,differences,assertTarget,transientCaptureError,equalPoses,reference,expectedPoses,manualDecision,parse,pairCorpus};
});
