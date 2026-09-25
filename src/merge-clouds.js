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
 /* 4.7.19 (KI-059) — UNE CAPTURE DOIT TENIR DANS UN MESSAGE CHROME.
  *
  * La capture passe de la page ESV au service worker par chrome.runtime, dont
  * un message est limité à 64 Mio (« Message exceeded maximum allowed size of
  * 64MiB »). Terrain du 25/09, partie 3, cut 8209 : lot suspendu, adaptateur
  * « sans réponse ». Sur 1 500 captures relues, une capture pèse 1,6 Mo au
  * plus (52 nœuds, 13 728 points) ; mais chaque nœud LiDAR chargé dans la vue
  * y laisse un rapport d'environ 12 Ko (échantillons de diagnostic), même sans
  * aucun point retenu. Une vue éloignée, qui charge des milliers de nœuds,
  * dépasse la limite.
  *
  * `compactNodes` : au-delà de `FULL_NODES` nœuds, un nœud sans point retenu
  * garde son identité et ses comptes, pas ses échantillons. Les indices de
  * `pointSources` ne bougent pas. Une capture ordinaire n'est pas touchée.
  * `messageBytes` : taille du message JSON (caractères ; le texte est ASCII
  * hors avertissements). Au-delà de `MESSAGE_BUDGET`, l'adaptateur refuse la
  * capture par une erreur explicite, reprenable, au lieu d'un envoi qui échoue
  * sans que le service worker reçoive rien. */
 const FULL_NODES=64,MESSAGE_LIMIT=64*1024*1024,MESSAGE_BUDGET=48*1024*1024;
 function compactNodes(data,fullNodes=FULL_NODES){
  if(!Array.isArray(data?.nodes)||data.nodes.length<=fullNodes||!data.pointsSceneRelative?.length)return 0;
  let compacted=0;
  data.nodes=data.nodes.map(n=>{if(n.retained>0)return n;compacted++;
   return {id:n.id,cloudIndex:n.cloudIndex,source:n.source,inspection:n.inspection,inspected:n.inspected,retained:0,reportCompacted:true};});
  (data.warnings||=[]).push(`${compacted} nœuds visibles sans point retenu sur ${data.nodes.length} : rapports réduits à leurs comptes (message Chrome limité à 64 Mo).`);
  return compacted;
 }
 function messageBytes(value){try{return JSON.stringify(value).length;}catch{return Infinity;}}
 return {merge,compactNodes,messageBytes,FULL_NODES,MESSAGE_LIMIT,MESSAGE_BUDGET};
});
