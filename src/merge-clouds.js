(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.BananeCore3);
 if(typeof module==='object')module.exports=api;else root.BananeMerge3=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(K){
 function merge(a,b){K.assertTarget(a.identity,b.identity);
  for(const s of ['left','right'])if(JSON.stringify(a.rails[s].profileLocalToSceneRelative)!==JSON.stringify(b.rails[s].profileLocalToSceneRelative))throw Error('Rails déplacés entre les deux lectures.');
  const out=K.clone(b);out.captureId=K.uid();out.pointsSceneRelative=[];out.pointSources=[];out.visibleByClipBoxes=[];out.attributes={};out.nodes=[];out.clouds=[];
  out.scope={...b.scope,kind:'union-of-left-and-right-loaded-views'};out.viewCaptures=[a,b].map(d=>({captureId:d.captureId,status:d.status,quality:d.quality,camera:d.camera}));
  const seen=new Map();
  for(const d of [a,b]){const nodeOffset=out.nodes.length,cloudOffset=out.clouds.length;
   out.clouds.push(...d.clouds.map(c=>({...K.clone(c),id:`capture-${cloudOffset}-${c.id}`})));
   out.nodes.push(...d.nodes.map(n=>({...K.clone(n),cloudIndex:n.cloudIndex+cloudOffset,id:`capture-${nodeOffset}-${n.id}`,retained:0})));
   for(let i=0;i<d.pointsSceneRelative.length;i++){
    const p=d.pointsSceneRelative[i],key=p.join('|');if(seen.has(key))continue;
    seen.set(key,out.pointsSceneRelative.length);out.pointsSceneRelative.push(p);const source=[d.pointSources[i][0]+nodeOffset,d.pointSources[i][1]];
    out.pointSources.push(source);out.nodes[source[0]].retained++;out.visibleByClipBoxes.push(d.visibleByClipBoxes?.[i]??null);
    for(const name of new Set([...Object.keys(a.attributes||{}),...Object.keys(b.attributes||{})]))(out.attributes[name]??=[]).push(d.attributes?.[name]?.[i]??null);
   }
  }
  out.quality={...b.quality,retained:out.pointsSceneRelative.length,inspected:a.quality.inspected+b.quality.inspected,
   durationMs:a.quality.durationMs+b.quality.durationMs,perRail:{},hasUnsupportedNodes:a.quality.hasUnsupportedNodes||b.quality.hasUnsupportedNodes};
  for(const s of ['left','right'])out.quality.perRail[s]=out.pointsSceneRelative.filter(p=>K.C.point(out.rails[s].sceneRelativeToProfileLocal,p).every((v,i)=>Math.abs(v)<=out.scope.halfExtentsProfileLocal[i])).length;
  out.status=a.status==='complete-loaded-roi'&&b.status==='complete-loaded-roi'?'complete-loaded-roi':'partial-multi-view';
  out.scope.completeLoadedRoi=out.status==='complete-loaded-roi';out.warnings=[...new Set([...(a.warnings||[]),...(b.warnings||[]),'Union des vues G/D ; les nœuds communs sont lus deux fois, les coordonnées de points identiques une seule fois.'])];
  return out;
 }
 return {merge};
});
