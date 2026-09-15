/* Banane 2.4.2: loaded Potree geometry only. No requests, picking or scene writes. */
(function(root,factory) {
  const api=factory(typeof module==="object"&&module.exports?require("./capture-core.js"):root.BananeCaptureCore);
  if(typeof module==="object"&&module.exports) module.exports=api; else root.BananeLidar=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(C) {
  "use strict";
  const SIDES=["left","right"],finite=Number.isFinite;
  const fail=s=>{throw new Error(s);};
  const list=x=>Array.isArray(x)?x:x instanceof Set?[...x]:null;
  const safeNumber=x=>finite(x)?x:null;
  const name=(e,x)=>Object.entries(e||{}).find(([,v])=>v===x)?.[0]||null;
  function visible(o) {
    const seen=new Set();
    for(let p=o;p;p=p.parent) {
      if(p.visible===false||seen.has(p))return false;
      seen.add(p);
    }
    return true;
  }
  function inventory(v) {
    const clouds=[],nodes=[],seen=new Set(),issues=[];
    for(const [ci,pc] of (v.scene.pointclouds||[]).entries()) {
      const entries=list(pc.visibleNodes),ciName=`cloud-${ci}`;
      const info={id:ciName,visible:visible(pc),visibleNodesAvailable:entries!==null,
        visibleNodeCount:entries?.length??null,acceptedNodes:0,unsupportedNodes:[],source:null};
      clouds.push(info);
      if(!info.visible)continue;
      let candidates;
      if(entries!==null) {candidates=entries;info.source="pointcloud.visibleNodes";}
      else {
        candidates=[];const todo=[pc],walked=new Set();
        while(todo.length) {
          const o=todo.pop();if(walked.has(o))continue;walked.add(o);
          if(walked.size>100000)fail("Arbre de nuage trop volumineux.");
          if(o.isPoints||o.type==="Points")candidates.push(o);
          if(visible(o))todo.push(...(o.children||[]));
        }
        info.source="visible Points descendants (visibleNodes absent)";
        issues.push("Liste visibleNodes absente : les descendants Points visibles sont utilisés, sans preuve de leur sélection par le rendu Potree.");
      }
      for(const [ni,n] of candidates.entries()) {
        const obj=n?.sceneNode||n,geometry=obj?.geometry;
        const nd={index:ni,hasSceneNode:!!n?.sceneNode,hasPosition:!!geometry?.attributes?.position,
          hasGeometryNodePosition:!!n?.geometryNode?.geometry?.attributes?.position,hasMatrixWorld:!!obj?.matrixWorld};
        if(!obj||!visible(obj))continue;
        // Geometry-node data alone have no proven rendered transform. Do not guess offsets.
        if(!nd.hasPosition||!nd.hasMatrixWorld) {info.unsupportedNodes.push(nd);continue;}
        if(seen.has(obj))continue;seen.add(obj);
        try {
          const a=C.attribute(geometry.attributes.position);
          if(a.itemSize<3)fail("Position avec moins de trois composantes.");
          const world=C.affine(obj.matrixWorld);C.inverse(world);
          nodes.push({id:`${ciName}-node-${ni}`,cloudIndex:ci,obj,geometry,position:geometry.attributes.position,
            attribute:a,world,source:n?.sceneNode?"visibleNodes[].sceneNode.geometry":"Points.geometry",
            pc,geometryNode:n?.geometryNode||null,drawRange:geometry.drawRange||{start:0,count:Infinity}});
          info.acceptedNodes++;
        } catch(e) {info.unsupportedNodes.push({...nd,reason:e.message});}
      }
    }
    return {clouds,nodes,issues};
  }
  function clipSnapshot(pc,origin,enums={}) {
    const mat=pc.material||{},issues=[];
    const task=name(enums.ClipTask,mat.clipTask),method=name(enums.ClipMethod,mat.clipMethod);
    const boxes=[];
    for(const b of mat.clipBoxes||[]) {
      try {
        // Potree clipBoxes[].inverse maps WORLD -> unit box [-.5,.5]^3.
        boxes.push(C.multiply(C.affine(b.inverse),C.translation(origin)));
      } catch(e) {issues.push("Matrice de boîte de découpe non reconnue.");}
    }
    const polygonCount=mat.clipPolygons?.length||0;
    if(polygonCount)issues.push("Découpe polygonale non reproduite.");
    if(mat.clipMode!==undefined&&!task)issues.push("Ancien clipMode non reproduit.");
    const canClassify=boxes.length===(mat.clipBoxes?.length||0)&&!polygonCount&&
      ["NONE","HIGHLIGHT","SHOW_INSIDE","SHOW_OUTSIDE"].includes(task)&&
      (!boxes.length||["INSIDE_ANY","INSIDE_ALL"].includes(method));
    if(!canClassify)issues.push("Visibilité exacte des points après shader non établie.");
    return {task,method,rawTask:safeNumber(mat.clipTask),rawMethod:safeNumber(mat.clipMethod),
      rawClipMode:safeNumber(mat.clipMode),boxesSceneRelativeToUnit:boxes,polygonCount,
      classificationAvailable:canClassify,issues,
      filtersReplayed:false,note:"Les points de la fenêtre sont conservés, y compris ceux hors découpe. Seule la visibilité par boîtes est annotée si les enums sont connus. Classification, filtres de retours, GPS, masquage et occlusion ne sont pas reproduits."};
  }
  function boxVisible(clip,p) {
    if(!clip.classificationAvailable)return null;
    if(!clip.boxesSceneRelativeToUnit.length||["NONE","HIGHLIGHT"].includes(clip.task))return true;
    const values=clip.boxesSceneRelativeToUnit.map(m=>C.point(m,p).every(x=>x>=-.5&&x<=.5));
    const inside=clip.method==="INSIDE_ALL"?values.every(Boolean):values.some(Boolean);
    return clip.task==="SHOW_INSIDE"?inside:!inside;
  }
  function cameraSnapshot(v,origin) {
    const cam=v.scene.getActiveCamera?.();if(!cam)return null;
    const rect=v.renderer?.domElement?.getBoundingClientRect?.();
    const world=C.rebase(C.worldMatrix(cam),origin);
    return {type:cam.type||"Camera",cameraToSceneRelative:world,
      sceneRelativeToCamera:C.inverse(world),projection:C.matrix(cam.projectionMatrix),
      viewport:rect?{left:rect.left,top:rect.top,width:rect.width,height:rect.height}:null};
  }
  function profileLines(r,origin) {
    const out=[],todo=[r.profile],seen=new Set();
    while(todo.length) {
      const n=todo.pop();if(seen.has(n))continue;seen.add(n);
      if(seen.size>1000)fail("Profil 3D trop volumineux.");
      if(["Line","LineLoop","LineSegments"].includes(n.type)&&n.geometry?.attributes?.position) {
        const a=C.attribute(n.geometry.attributes.position);
        if(a.count>20000)fail("Contour de profil trop volumineux.");
        const transform=C.rebase(C.worldMatrix(n),origin),vertices=[];
        for(let i=0;i<a.count;i++)vertices.push(C.point(transform,a.point(i)));
        out.push({type:n.type,verticesSceneRelative:vertices});
      }
      todo.push(...(n.children||[]));
    }
    return out;
  }
  function reportedBox(b) {
    if(!b)return null;
    try{return {min:C.vector(b.min),max:C.vector(b.max),frame:"as-reported-unverified"};}
    catch{return {unreadable:true,frame:"as-reported-unverified"};}
  }
  const inRoi=(p,bounds)=>p.every((x,i)=>Math.abs(x)<=bounds[i]);
  function inspectNode(n,origin,frames,bounds,nodeIndex) {
    const model=C.rebase(n.world,origin),transforms=frames.map(f=>C.multiply(f.sceneRelativeToProfileLocal,model));
    const indexAttr=n.geometry.index?C.attribute(n.geometry.index):null;
    const drawStart=Math.max(0,Math.floor(n.drawRange.start||0)),total=indexAttr?indexAttr.count:n.attribute.count;
    const drawEnd=Math.min(total,finite(n.drawRange.count)?drawStart+n.drawRange.count:total);
    const report={id:n.id,cloudIndex:n.cloudIndex,source:n.source,nodeToSceneRelative:model,
      matrixSource:"sceneNode.matrixWorld as observed; renderer use not independently verified",
      positionAttribute:n.attribute.metadata,drawRange:{start:drawStart,end:drawEnd},indexed:!!indexAttr,
      inspection:"not-scanned",inspected:0,retained:0,nonFinitePositions:0,
      reportedGeometryBoundingBox:reportedBox(n.geometry.boundingBox),
      reportedPotreeGeometryNodeBoundingBox:reportedBox(n.geometryNode?.boundingBox),
      boundingBoxesUsedForSelection:false,
      hierarchyNodeToSceneRelative:null,hierarchyMatrixMaxDifference:null,hierarchyMatrixIssue:null,
      probes:[],probeScope:"Up to 17 uniformly spaced vertices in drawRange, for diagnostics only; ROI collection still scans every vertex until an explicit budget limit.",
      nearestToRailOrigin:{left:null,right:null}};
    let hierarchyTransforms=null;
    try {
      report.hierarchyNodeToSceneRelative=C.rebase(C.worldMatrix(n.obj),origin);
      report.hierarchyMatrixMaxDifference=Math.max(...model.map((x,i)=>Math.abs(x-report.hierarchyNodeToSceneRelative[i])));
      hierarchyTransforms=frames.map(f=>C.multiply(f.sceneRelativeToProfileLocal,report.hierarchyNodeToSceneRelative));
    }catch(e){report.hierarchyMatrixIssue=e.message;}
    const count=Math.max(0,drawEnd-drawStart),ids=new Set();
    for(let j=0;j<Math.min(17,count);j++)ids.add(drawStart+Math.floor(j*(count-1)/Math.max(1,Math.min(17,count)-1)));
    for(const di of ids) {
      const i=indexAttr?indexAttr.get(di,0):di;
      if(!Number.isInteger(i)||i<0||i>=n.attribute.count)fail("Indice de point invalide.");
      const raw=n.attribute.point(i);
      if(!raw.every(finite)){report.probes.push({sourceIndex:i,finite:false});continue;}
      const local=transforms.map(m=>C.point(m,raw)),box=report.reportedGeometryBoundingBox;
      const probe={sourceIndex:i,finite:true,pointNodeLocal:raw,pointSceneRelative:C.point(model,raw),
        pointProfileLocal:{left:local[0],right:local[1]},roiHit:{left:inRoi(local[0],bounds),right:inRoi(local[1],bounds)},
        insideReportedGeometryBox:box?.min?raw.every((x,k)=>x>=box.min[k]&&x<=box.max[k]):null};
      if(hierarchyTransforms) {
        const h=hierarchyTransforms.map(m=>C.point(m,raw));
        probe.hierarchyPointProfileLocal={left:h[0],right:h[1]};
        probe.hierarchyRoiHit={left:inRoi(h[0],bounds),right:inRoi(h[1],bounds)};
      }
      report.probes.push(probe);
    }
    return {n,model,transforms,indexAttr,indexSource:n.geometry.index,drawStart,drawEnd,nodeIndex,report};
  }
  async function capture(options) {
    const {viewer:v,rails,origin,guard,meta}=options;
    const bounds=options.bounds||[.5,.4,.3];
    const maxPoints=options.maxPoints??350000,maxInspected=options.maxInspected??8000000;
    const maxMillis=options.maxMillis??15000,yieldEvery=options.yieldEvery??4096;
    const pause=options.pause||(()=>new Promise(r=>setTimeout(r,0)));
    guard();
    const started=Date.now(),inv=inventory(v),warnings=[...inv.issues];
    const frames=rails.map(r=>C.serialRail(r,origin));
    const out={format:"banane-lidar-capture-v1",version:"2.4.2",...meta,
      capturedAt:new Date().toISOString(),status:"complete-loaded-roi",units:"metres (ESV convention, not independently calibrated)",
      coordinateSystem:{name:"scene-relative",origin:"Position du rail gauche au premier relevé de cette visite du cut ; translation absolue omise.",
        axes:"Axes de la scène conservés. Axes des profils exportés sans supposer leur sens métier.",matrixLayout:"column-major; column vectors",
        equation:"pSceneRelative = nodeToSceneRelative * pNode ; pRailLocal = sceneRelativeToProfileLocal * pSceneRelative"},
      scope:{kind:"loaded-visible-nodes-and-two-profile-rois",halfExtentsProfileLocal:bounds,
        completeCloud:false,subsampling:false,boundingBoxPreFilter:false,maximumPoints:maxPoints,maximumInspected:maxInspected,
        note:"Union des deux fenêtres autour des profils, testées sur les positions lues. Les boîtes englobantes ne sont jamais utilisées pour écarter un nœud. Le LOD chargé dépend de la vue ; aucun nœud supplémentaire n'est demandé au serveur."},
      rails:Object.fromEntries(SIDES.map((s,i)=>[s,{...frames[i],profileContours:profileLines(rails[i],origin)}])),
      camera:null,clouds:inv.clouds.map((c,i)=>({...c,clipping:clipSnapshot(v.scene.pointclouds[i],origin,options.enums)})),
      nodes:[],pointsSceneRelative:[],pointSources:[],visibleByClipBoxes:[],attributes:{},
      quality:{roundTripMaxSceneUnits:0,worldRoundTripMaxSceneUnits:0,matrixIdentityMaxError:0,nonFinitePositions:0,inspected:0,
        retained:0,perRail:{left:0,right:0},skippedBoundingBoxes:0,probePointsRead:0,pointRoundTripsChecked:0,
        hasUnsupportedNodes:inv.clouds.some(c=>c.unsupportedNodes.length>0),
        visualCorrespondence:"not-verified",accuracyAssessment:"not-performed"},warnings};
    try{out.camera=cameraSnapshot(v,origin);}catch(e){warnings.push("Caméra non exportable : "+e.message);}
    for(const rail of rails)for(const m of [rail.railMatrix,rail.profileMatrix]) {
      const im=C.inverse(m);
      for(const p of [[0,0,0],[.17,-.12,.09]])
        out.quality.worldRoundTripMaxSceneUnits=Math.max(out.quality.worldRoundTripMaxSceneUnits,
          C.distance(C.point(im,C.point(m,p)),p));
    }
    if(out.quality.hasUnsupportedNodes)warnings.push("Certains nœuds visibles sont non reconnus ; voir clouds[].unsupportedNodes.");
    const extras=["intensity","classification","pointSourceID","pointSourceId","returnNumber","numberOfReturns"];
    // Explicit allowlist only; no URLs, object userData, credentials or source code.
    for(const key of extras)out.attributes[key]=[];
    let finishedAll=true;
    const integrityChecks=[];
    const prepared=[];
    // Keep every supported node's metadata, even when its ROI is empty or the
    // later full scan reaches a limit. V2.4 discarded the decisive evidence.
    for(const [i,n] of inv.nodes.entries()) {
      guard();
      const entry=inspectNode(n,origin,frames,bounds,i);prepared.push(entry);out.nodes.push(entry.report);
      integrityChecks.push(()=>{
        if(n.obj.geometry!==n.geometry||n.geometry.attributes.position!==n.position||!n.attribute.unchanged()||
          n.geometry.index!==entry.indexSource||(entry.indexAttr&&!entry.indexAttr.unchanged())||
          C.matrix(n.obj.matrixWorld).some((x,j)=>x!==n.world[j]))
          fail("Le nuage a changé pendant le relevé des échantillons de diagnostic. Recommence sur une vue stable.");
      });
      out.quality.probePointsRead+=entry.report.probes.length;
      if((i+1)%8===0){await pause();guard();}
    }
    outer:for(const entry of prepared) {
      guard();
      const {n,model,transforms,indexAttr,drawStart,drawEnd,nodeIndex,report}=entry;
      const attrs={};
      for(const key of extras)if(n.geometry.attributes[key]) {
        try{attrs[key]=C.attribute(n.geometry.attributes[key]);}catch{warnings.push(`Attribut ${key} non lisible sur ${n.id}.`);}
      }
      report.inspection="scanning";
      const invModel=C.inverse(model),identity=C.multiply(model,invModel);
      out.quality.matrixIdentityMaxError=Math.max(out.quality.matrixIdentityMaxError,
        ...identity.map((x,i)=>Math.abs(x-C.identity()[i])));
      function unchanged() {
        if(n.obj.geometry!==n.geometry||n.geometry.attributes.position!==n.position||
          !n.attribute.unchanged()||Object.values(attrs).some(a=>!a.unchanged())||
          (indexAttr&&!indexAttr.unchanged())||C.matrix(n.obj.matrixWorld).some((x,i)=>x!==n.world[i]))
          fail("Le nuage ou sa matrice a changé pendant l'export. Recommence lorsque la vue est stable.");
      }
      integrityChecks.push(unchanged);
      for(let di=drawStart;di<drawEnd;di++) {
        if(out.quality.inspected>=maxInspected||out.pointsSceneRelative.length>=maxPoints||Date.now()-started>maxMillis) {
          report.inspection="partial-budget";finishedAll=false;break outer;
        }
        if((di-drawStart)%yieldEvery===0) {guard();unchanged();await pause();guard();unchanged();}
        const i=indexAttr?indexAttr.get(di,0):di;
        if(!Number.isInteger(i)||i<0||i>=n.attribute.count)fail("Indice de point invalide.");
        out.quality.inspected++;report.inspected++;
        const raw=n.attribute.point(i);
        if(!raw.every(finite)){out.quality.nonFinitePositions++;report.nonFinitePositions++;continue;}
        const local=transforms.map(m=>C.point(m,raw)),inside=local.map(p=>inRoi(p,bounds));
        for(let s=0;s<2;s++) {
          const dist=Math.hypot(...local[s]),side=SIDES[s],last=report.nearestToRailOrigin[side];
          if(!last||dist<last.distanceProfileUnits)
            report.nearestToRailOrigin[side]={sourceIndex:i,distanceProfileUnits:dist,pointProfileLocal:local[s],pointSceneRelative:C.point(model,raw)};
        }
        if(!inside.some(Boolean))continue;
        const p=C.point(model,raw);
        const back=C.point(model,C.point(invModel,p));
        out.quality.roundTripMaxSceneUnits=Math.max(out.quality.roundTripMaxSceneUnits,C.distance(back,p));
        for(let s=0;s<2;s++) {
          const round=C.point(frames[s].profileLocalToSceneRelative,C.point(frames[s].sceneRelativeToProfileLocal,p));
          out.quality.roundTripMaxSceneUnits=Math.max(out.quality.roundTripMaxSceneUnits,C.distance(round,p));
          if(inside[s])out.quality.perRail[SIDES[s]]++;
        }
        out.pointsSceneRelative.push(p);out.pointSources.push([nodeIndex,i]);
        out.quality.pointRoundTripsChecked++;
        out.visibleByClipBoxes.push(boxVisible(out.clouds[n.cloudIndex].clipping,p));
        for(const key of extras) {
          const a=attrs[key],value=a&&i<a.count?a.get(i,0):null;
          out.attributes[key].push(finite(value)?value:null);
        }
        out.nodes[nodeIndex].retained++;
      }
      unchanged();
      report.inspection="complete";
    }
    guard();
    integrityChecks.forEach(check=>check());
    // Reject a snapshot that straddles LOD replacement/loading; do not mix epochs.
    const last=inventory(v);
    const originalNodes=new Map(inv.nodes.map(n=>[n.obj,n]));
    if(last.nodes.length!==inv.nodes.length||last.nodes.some(n=>{
      const old=originalNodes.get(n.obj);return !old||n.position!==old.position||n.world.some((x,j)=>x!==old.world[j]);
    }))
      fail("Les nœuds LiDAR visibles ont changé pendant l'export. Attends la fin du chargement puis réessaie.");
    if(out.clouds.some((cloud,i)=>JSON.stringify(cloud.clipping)!==JSON.stringify(clipSnapshot(v.scene.pointclouds[i],origin,options.enums))))
      fail("La découpe du nuage a changé pendant l'export. Recommence lorsque la vue est stable.");
    if(out.camera&&JSON.stringify(out.camera)!==JSON.stringify(cameraSnapshot(v,origin)))
      fail("La caméra a changé pendant l'export. Garde la vue immobile et réessaie.");
    out.quality.retained=out.pointsSceneRelative.length;
    out.quality.durationMs=Date.now()-started;
    for(const key of extras)if(!out.attributes[key].some(x=>x!==null))delete out.attributes[key];
    if(!finishedAll) {out.status="partial-limit";warnings.push("Limite de temps ou de volume atteinte : export partiel, sans sous-échantillonnage caché.");}
    out.scope.scanComplete=finishedAll&&out.nodes.length>0&&out.nodes.every(n=>n.inspection==="complete");
    out.scope.completeLoadedRoi=out.scope.scanComplete&&!out.quality.hasUnsupportedNodes&&!out.quality.nonFinitePositions&&
      out.quality.perRail.left>0&&out.quality.perRail.right>0;
    if(out.quality.hasUnsupportedNodes)out.status="partial-unsupported";
    if(out.quality.nonFinitePositions)out.status="partial-invalid-points";
    if(out.status==="complete-loaded-roi"&&out.quality.retained&&(!out.quality.perRail.left||!out.quality.perRail.right))out.status="one-rail-empty";
    if(!out.quality.retained){out.status="no-points";out.quality.roundTripMaxSceneUnits=null;}
    if(!out.nodes.length)out.quality.matrixIdentityMaxError=null;
    if(out.quality.roundTripMaxSceneUnits>1e-6||out.quality.worldRoundTripMaxSceneUnits>1e-6||out.quality.matrixIdentityMaxError>1e-6) {
      out.status="transform-check-failed";warnings.push("Le contrôle numérique des matrices dépasse 1e-6 unité scène. Ce seuil est numérique, pas une tolérance métier.");
    }
    if(!out.quality.perRail.left||!out.quality.perRail.right)warnings.push("Au moins une fenêtre de rail est vide.");
    if(!out.quality.retained&&out.quality.inspected)
      warnings.push("Des points ont été lus mais aucun n'entre dans les fenêtres avec sceneNode.matrixWorld. Les échantillons, boîtes et matrices alternatives sont conservés pour diagnostiquer le repère ; aucune transformation alternative n'est appliquée automatiquement.");
    if(out.nodes.some(n=>n.hierarchyMatrixMaxDifference>1e-6))
      warnings.push("Au moins une matrice sceneNode.matrixWorld diffère de la matrice reconstruite depuis sa hiérarchie. Les deux sont exportées pour diagnostic, sans substitution automatique.");
    warnings.push("La cohérence des matrices ne prouve ni la justesse du pointage ni la concordance avec le nuage affiché.");
    return out;
  }
  function diagnostic(v) {
    if(!v?.scene)return {viewerAvailable:!!v,sceneAvailable:false};
    const i=inventory(v);
    return {viewerAvailable:true,sceneAvailable:true,clouds:i.clouds,issues:i.issues,
      rootChildTypes:(v.scene.scene?.children||[]).map(o=>o.type||"unknown"),
      nodes:i.nodes.map(n=>({id:n.id,source:n.source,position:n.attribute.metadata})),
      nativeControls:["O2N3DCutLRClick","O2N3DCutRRClick","O2N3DCutValidate3DRail"].map(id=>({id,
        present:!!globalThis.document?.getElementById(id),disabled:globalThis.document?.getElementById(id)?.disabled??null}))};
  }
  return {capture,inventory,diagnostic,cameraSnapshot,boxVisible,clipSnapshot};
});
