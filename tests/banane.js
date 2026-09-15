
(() => {
  "use strict";
  const ID = "__banane24", VERSION="2.4.2";
  if (window.__BANANE_V24) return;
  const C=window.BananeCaptureCore,L=window.BananeLidar;
  if(!C||!L){console.error("[Banane] Modules de capture absents.");return;}
  const uid=()=>window.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const sessionId=uid();

  const S = { before:null,records:[],incomplete:[],lastIncomplete:null,busy:false,notice:"Prêt",epoch:0,visit:null,last:null,
    cancelled:false,disposed:false,overlay:false,timer:null,observer:null,sequence:0,lastOperation:null,sceneFrames:new WeakMap() };
  const $ = id => document.getElementById(id);
  const fail = message => { throw new Error(message); };
  const status = (message, kind="info") => {
    S.notice = message;
    const e = $(ID+"-status");
    if (e) { e.textContent=message; e.dataset.kind=kind; }
  };

  function context() {
    if(S.disposed)fail("Extension arrêtée.");
    if(window.__BANANE_V2_LOADED__||window.__BANANE_V21_LOADED__||window.__BANANE_V22_LOADED__||
      window.__BANANE_V23||window.__BANANE_V231)
      fail("Une ancienne Banane est encore active sur cette page. Exporte ses références, désactive-la puis recharge ESV.");
    const v=window.viewer, root=v?.scene?.scene;
    if (!root) fail("Ouvre une coupe dans ESV 3D.");
    const label=$("O2N3DCutDescription")?.textContent?.trim()||"";
    const m=/Cut\s+(\d+)\s+of\s+part\s+(\d+)/i.exec(label);
    if(!m) fail("Numéro de coupe introuvable.");
    const shape=$("O2N3DCutShapeInfo")?.textContent?.trim()||"inconnu";
    const nodes=root.children.filter(o=>o?.type==="Object3D" &&
      o.children?.[0]?.type==="Mesh" &&
      o.children?.[1]?.children?.some?.(c=>c.type==="Line"));
    if(nodes.length!==2 || root.children[0]!==nodes[0] || root.children[1]!==nodes[1])
      fail("Identification des rails ambiguë. Aucune donnée capturée.");
    return {v,root,part:Number(m[2]),cut:Number(m[1]),partText:m[2],cutText:m[1],shape,nodes,epoch:S.epoch,
      key:`${m[2]}:${m[1]}`};
  }

  function state() {
    const c=context();
    const rails=c.nodes.map(C.railState);
    // Keep an explicit translation link when a new visit recentres its export.
    // A new scene root or changed root transform starts a new, unlinked frame.
    const rootMatrix=C.worldMatrix(c.root);
    let sceneFrame=S.sceneFrames.get(c.root);
    if(!sceneFrame||sceneFrame.rootMatrix.some((x,i)=>Math.abs(x-rootMatrix[i])>1e-9)) {
      sceneFrame={id:uid(),rootMatrix,origin:C.point(rails[0].railMatrix,[0,0,0])};
      S.sceneFrames.set(c.root,sceneFrame);
    }
    if(!S.visit||S.visit.key!==c.key||S.visit.shape!==c.shape||S.visit.root!==c.root||
      S.visit.epoch!==c.epoch||S.visit.sceneFrameId!==sceneFrame.id||S.visit.nodes.some((n,i)=>n!==c.nodes[i]))
      S.visit={id:uid(),key:c.key,shape:c.shape,root:c.root,epoch:c.epoch,nodes:c.nodes,
        origin:C.point(rails[0].railMatrix,[0,0,0]),sceneFrameId:sceneFrame.id};
    const coordinateBridge={format:"banane-scene-frame-link-v1",sceneFrameId:sceneFrame.id,
      captureSceneRelativeToSessionSceneRelative:C.translation(S.visit.origin.map((x,i)=>x-sceneFrame.origin[i])),
      scope:"Same session, same observed THREE scene-root object and unchanged root transform. No registration across different sceneFrameIds; application-level coordinate rebasing is not independently detectable."};
    return {...c,rails,visit:S.visit,coordinateBridge,capturedAt:new Date().toISOString()};
  }
  function same(a,b) {
    return a.key===b.key&&a.shape===b.shape&&a.root===b.root&&a.epoch===b.epoch&&
      a.visit.id===b.visit.id&&a.rails.every((r,i)=>r.object===b.rails[i].object&&r.profile===b.rails[i].profile);
  }

  function archiveBefore(reason) {
    const b=S.before;
    if(!b)return null;
    const item={format:"banane-incomplete-capture-v1",version:VERSION,captureId:uid(),sessionId,
      visitId:b.visit.id,part:b.part,cut:b.cut,shape:b.shape,startedAt:b.capturedAt,
      archivedAt:new Date().toISOString(),reason,status:"incomplete-no-after",usableForTraining:false,
      coordinateBridge:b.coordinateBridge,lidarCaptureId:b.lidarCaptureId||null,
      rails:{left:{initial:C.serialRail(b.rails[0],b.visit.origin)},
        right:{initial:C.serialRail(b.rails[1],b.visit.origin)}},
      note:"État avant conservé sans état après. Ne pas utiliser comme paire de correction."};
    S.incomplete.push(item);S.lastIncomplete=item;S.before=null;
    return item;
  }
  function reconcileBefore() {
    if(!S.before||S.disposed)return false;
    let now;
    try{now=state();}catch(e){return false;} // Wait for a readable ESV scene during loading.
    if(same(S.before,now))return false;
    const reason=S.before.key!==now.key?"cut-or-part-changed":
      "visit-profile-or-scene-changed";
    const item=archiveBefore(reason);
    if(S.busy)S.cancelled=true; // Keep busy until the old async export actually exits.
    S.overlay=false;clearOverlay();S.last=null;
    status(`Cut ${item.cut} : capture incomplète conservée, sans après. `+
      `Cut ${now.cut} : charge les deux côtés puis clique sur « 1. Enregistrer avant + LiDAR ».`,"error");
    return true;
  }
  function cancelBefore() {
    stop();
    const item=archiveBefore("operator-cancelled");
    render();
    status(item?`Capture du cut ${item.cut} conservée comme incomplète. Les références terminées sont conservées.`:
      "Aucune capture avant en cours. Les références sont conservées.");
  }

  function makeRecord(before,after,source,details={}) {
    if(!same(before,after)) fail("La coupe, le profil ou les objets ont changé. Recommence la capture.");
    const previous=S.lastOperation;
    const meta={format:"banane-manual-reference-v2",version:VERSION,recordId:uid(),sequence:++S.sequence,
      sessionId,visitId:before.visit.id,datasetIdentity:"not-observed",partText:before.partText,cutText:before.cutText,
      coordinateBridge:before.coordinateBridge,
      part:before.part,cut:before.cut,shape:before.shape,
      capturedAt:after.capturedAt,startedAt:before.capturedAt,source,
      lidarCaptureId:before.lidarCaptureId||null,
      continuesRecordId:source==="explicit-before-after"&&previous?.record.source===source&&
        same(previous.after,before)&&C.equalRails(previous.after.rails,before.rails)?previous.record.recordId:null,
      note:"Historique conservé par opération et par rail. Matrices vers une scène translatée ; origine absolue omise. Aucune validation envoyée.",...details};
    return C.reference(before.rails,after.rails,before.visit.origin,meta);
  }
  function save(record,current) {
    S.records.push(record);
    S.lastOperation={record,after:current};
    S.before=null;
    render();
  }
  async function before() {
    try{
      reconcileBefore();
      if(S.busy)fail("Un export est en cours.");
      if(S.before)fail("Une capture avant est déjà en cours. Enregistre l'après ou annule-la.");
      S.before=state();
      status(`État initial enregistré : cut ${S.before.cut}, part ${S.before.part}.`,"ok");
      render();
      await exportLidar();
    }catch(e){status(e.message,"error");}
  }
  function after() {
    try{
      if(S.busy)fail("Attends la fin de l'export.");
      if(!S.before) fail("Clique d'abord sur « Enregistrer avant ».");
      const current=state(),record=makeRecord(S.before,current,"explicit-before-after");
      save(record,current);
      status(`Opération ${record.sequence} enregistrée pour les deux rails. L'historique précédent est conservé.`,"ok");
    }catch(e){
      if(!reconcileBefore())status(e.message,"error");
      render();
    }
  }

  // ESV's original extracted-rail spheres are created by placeExtractedRails.
  // They remain at the loaded extraction while the operator moves the editable rails.
  // This recovery mode is deliberately labeled as an unverified displayed baseline.
  function originalMarkers(c) {
    const colors={left:16302520,right:10606282};
    const found={};
    for(const o of c.root.children){
      if(o?.type!=="Mesh" || o.geometry?.type!=="SphereGeometry") continue;
      if(Math.abs((o.geometry.parameters?.radius??0)-.0015)>1e-7) continue;
      const color=o.material?.color?.getHex?.();
      for(const side of ["left","right"]) if(color===colors[side]){
        if(found[side]) fail("Plusieurs repères d'extraction d'origine détectés.");
        found[side]=o;
      }
    }
    if(!found.left||!found.right)
      fail("Repères d'extraction d'origine indisponibles. Utilise « Enregistrer avant / après ».");
    return found;
  }
  function captureCurrent() {
    try{
      if(S.busy||S.before)fail("Termine ou annule la capture avant/après en cours.");
      const current=state(),markers=originalMarkers(current);
      const baseline={...current,rails:current.rails.map((r,i)=>{
        const marker=markers[i===0?"left":"right"];
        const original=C.point(C.worldMatrix(marker),[0,0,0]),actual=C.point(r.railMatrix,[0,0,0]);
        const delta=original.map((v,j)=>v-actual[j]);
        const shift=m=>C.multiply(C.translation(delta),m);
        return {...r,railMatrix:shift(r.railMatrix),profileMatrix:shift(r.profileMatrix),rotation:null,profileRotation:null};
      })};
      const record=makeRecord(baseline,current,"displayed-extraction-markers",{
        baselineWarning:"Repères d'extraction affichés par ESV. Leur correspondance avec l'extraction initiale n'a pas été vérifiée. Si la coupe a été rechargée après une validation, cette référence peut ne plus représenter l'état avant correction."
      });
      record.baselineOrientation="current-orientation-used-as-unverified-proxy";
      save(record,current);
      status("État actuel récupéré. Origine affichée non vérifiée : voir l'avertissement dans le JSON.","ok");
    }catch(e){status(e.message,"error");}
  }

  function exportJSON() {
    try{
      reconcileBefore();render();
      if(!S.records.length&&!S.incomplete.length) fail("Aucune référence ni capture incomplète enregistrée.");
      const data={format:"banane-manual-references-v2",version:VERSION,sessionId,
        exportedAt:new Date().toISOString(),units:"metres",
        note:"Historique append-only. Les records d'une même visite partagent la même scène translatée. Des visites distinctes sont comparables dans les coordonnées observées seulement si leur coordinateBridge porte le même sceneFrameId. Aucun jeton ni URL exporté.",
        records:S.records,incompleteCaptures:S.incomplete};
      download(data,`banane-references-v24-${Date.now()}.json`);
      status(`${S.records.length} référence(s) et ${S.incomplete.length} capture(s) incomplète(s) exportées.`,"ok");
    }catch(e){status(e.message,"error");}
  }
  function download(data,filename) {
    const blob=new Blob([JSON.stringify(data)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  async function exportLidar() {
    if(S.busy)return;
    S.busy=true;S.cancelled=false;S.last=null;S.overlay=false;clearOverlay();render();
    let start=null;
    try {
      start=state();
      status(`Lecture du LiDAR : cut ${start.cut}, part ${start.part}. Garde la vue immobile…`);
      const guard=()=>{
        if(S.cancelled||S.disposed)fail("Export interrompu.");
        const now=state();
        if(!same(start,now)||!C.equalRails(start.rails,now.rails))
          fail("La coupe, le profil ou les rails ont changé pendant l'export. Recommence sur une vue stable.");
      };
      const data=await L.capture({viewer:start.v,rails:start.rails,origin:start.visit.origin,guard,
        enums:window.Potree||{},meta:{captureId:uid(),sessionId,visitId:start.visit.id,
          part:start.part,cut:start.cut,partText:start.partText,cutText:start.cutText,shape:start.shape,
          coordinateBridge:start.coordinateBridge,
          datasetIdentity:"not-observed",railSideMapping:"existing ESV convention: root.children[0]=left, root.children[1]=right; visual verification pending",
          railStateProvenance:S.before&&same(S.before,start)&&C.equalRails(S.before.rails,start.rails)?"explicit-before":"current-state-not-certified-original"}});
      guard();
      data.manualReferences=S.records.filter(r=>r.visitId===start.visit.id);
      S.last={data,start};
      if(S.before&&same(S.before,start)&&C.equalRails(S.before.rails,start.rails))S.before.lidarCaptureId=data.captureId;
      download(data,`banane-lidar-part-${start.part}-cut-${start.cut}-${Date.now()}.json`);
      const q=data.quality;
      status(`${q.inspected} points lus, ${q.retained} exportés (G ${q.perRail.left}, D ${q.perRail.right}). ${data.status==="complete-loaded-roi"?"Vérifie la superposition.":"Export incomplet : joins le JSON pour diagnostic."}`,
        data.status==="complete-loaded-roi"?"ok":"error");
    } catch(e) {
      if(!S.cancelled&&!S.disposed) {
        let diagnostic;try{diagnostic=L.diagnostic(window.viewer);}catch(err){diagnostic={error:err.message};}
        download({format:"banane-lidar-diagnostic-v1",version:VERSION,sessionId,
          capturedAt:new Date().toISOString(),status:"capture-failed",error:e.message,
          part:start?.part??null,cut:start?.cut??null,diagnostic,
          note:"Aucune géométrie partielle n'est présentée comme un export cohérent."},`banane-lidar-diagnostic-${Date.now()}.json`);
      }
      status(e.message+(S.cancelled?"":" Un JSON de diagnostic a été téléchargé."),"error");
    } finally {S.busy=false;reconcileBefore();render();}
  }
  function stop(){S.cancelled=true;S.overlay=false;clearOverlay();status("Arrêt demandé.");}
  function clearOverlay(){$(ID+"-overlay")?.remove();}
  function drawOverlay() {
    if(!S.overlay||!S.last)return;
    try {
      const now=state(),{data,start}=S.last;
      if(!same(start,now)){S.overlay=false;clearOverlay();return;}
      const cam=L.cameraSnapshot(now.v,start.visit.origin),r=cam?.viewport;
      if(!r)fail("Caméra indisponible pour la superposition.");
      let canvas=$(ID+"-overlay");
      if(!canvas){canvas=document.createElement("canvas");canvas.id=ID+"-overlay";
        canvas.style.cssText="position:fixed;inset:0;pointer-events:none;z-index:2147483644";
        canvas.setAttribute("aria-hidden","true");document.documentElement.append(canvas);}
      canvas.width=window.innerWidth;canvas.height=window.innerHeight;
      const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);
      const matrix=C.multiply(cam.projection,cam.sceneRelativeToCamera);
      ctx.fillStyle="#00ffff";ctx.globalAlpha=.8;
      const points=data.pointsSceneRelative,stride=Math.max(1,Math.ceil(points.length/2000));
      for(let i=0;i<points.length;i+=stride) {
        if(data.visibleByClipBoxes[i]===false)continue;
        const p=points[i],w=matrix[3]*p[0]+matrix[7]*p[1]+matrix[11]*p[2]+matrix[15];
        if(w<=0)continue;
        const n=C.point(matrix,p);if(n.some(v=>v < -1 || v > 1))continue;
        ctx.fillRect(r.left+(n[0]+1)*r.width/2-1,r.top+(1-n[1])*r.height/2-1,2,2);
      }
    }catch(e){S.overlay=false;clearOverlay();status(e.message,"error");}
  }
  function toggleOverlay(){
    if(!S.last?.data.pointsSceneRelative.length){status("Exporte d'abord un cut contenant des points.","error");return;}
    S.overlay=!S.overlay;if(S.overlay){drawOverlay();status("Points cyan = échantillon exporté. Vérifie leur coïncidence avec le nuage. Reclique pour masquer.");}
    else clearOverlay();
  }
  function render() {
    const count=$(ID+"-count"),button=$(ID+"-export");
    if(count)count.textContent=`${S.records.length} opération(s) enregistrée(s), ${S.incomplete.length} capture(s) incomplète(s)`;
    if(button)button.disabled=S.records.length===0&&S.incomplete.length===0;
    for(const action of ["before","after","current","lidar"])if($(ID+"-"+action))
      $(ID+"-"+action).disabled=S.busy||(action==="before"&&!!S.before)||(action==="after"&&!S.before);
    const beforeButton=$(ID+"-before");
    if(beforeButton)beforeButton.title=S.busy?"Attends la fin de l'export, ou utilise Arrêter l'export.":
      S.before?`Termine la capture du cut ${S.before.cut} avec le bouton 2.`:"";
    if($(ID+"-overlay-toggle"))$(ID+"-overlay-toggle").disabled=S.busy||!S.last?.data.pointsSceneRelative.length;
    const pending=$(ID+"-pending");
    if(pending)pending.textContent=S.before
      ?`Capture en cours : cut ${S.before.cut}, part ${S.before.part}`
      :"Aucune capture en cours. Prêt pour le bouton 1.";
    const warning=$(ID+"-incomplete");
    if(warning){warning.hidden=!S.lastIncomplete;warning.textContent=S.lastIncomplete
      ?`Attention : capture du cut ${S.lastIncomplete.cut} (part ${S.lastIncomplete.part}) incomplète, sans après. Conservée dans l'export JSON.`:"";}
  }
  function destroy(){
    S.disposed=true;stop();clearInterval(S.timer);S.observer?.disconnect();
    document.removeEventListener("DOMContentLoaded",boot);
    $(ID)?.remove();$(ID+"-style")?.remove();
    delete window.__BANANE_V24;
  }
  function boot(){
    if(S.disposed||$(ID))return;
    const panel=document.createElement("section");panel.id=ID;
    panel.innerHTML=`
      <div class="b-head"><strong>Banane V2.4.2</strong><button id="${ID}-hide" type="button" aria-label="Réduire">−</button></div>
      <div id="${ID}-body">
        <div class="b-muted">LiDAR et références · lecture seule</div>
        <div id="${ID}-status" role="status">Prêt</div>
        <div id="${ID}-count">0 coupe(s) enregistrée(s)</div>
        <div id="${ID}-pending" class="b-muted">Aucune capture en cours.</div>
        <div id="${ID}-incomplete" class="b-muted" hidden></div>
        <button id="${ID}-lidar" type="button">Exporter le LiDAR de ce cut</button>
        <button id="${ID}-overlay-toggle" type="button" disabled>Superposer les points exportés</button>
        <div class="b-muted">Le JSON est téléchargé même si aucun point n'est accessible. Aucun pointage à refaire pour ce premier test.</div>
        <button id="${ID}-before" type="button">1. Enregistrer avant + LiDAR</button>
        <button id="${ID}-after" type="button">2. Enregistrer après correction</button>
        <div class="b-muted">Pour chaque cut : 1 → corriger les deux rails → 2 → valider dans ESV. Attends le message « Opération enregistrée » avant de changer de cut.</div>
        <button id="${ID}-cancel-before" type="button">Annuler la capture avant en cours</button>
        <button id="${ID}-current" type="button">Récupérer l'état actuel</button>
        <div class="b-muted">Utilise les repères d'extraction affichés, s'ils existent. Origine non vérifiée.</div>
        <button id="${ID}-export" type="button" disabled>Exporter les références JSON</button>
        <button id="${ID}-stop" type="button">Arrêter l'export / masquer les points</button>
        <div class="b-muted">Aucune analyse, aucun déplacement automatique et aucune validation.</div>
      </div>`;
    const css=document.createElement("style");css.id=ID+"-style";
    css.textContent=`
      #${ID}{position:fixed;right:16px;bottom:16px;z-index:2147483645;width:310px;max-width:calc(100vw - 32px);max-height:80vh;overflow:auto;padding:13px;background:#151515;color:#fff;border:1px solid #666;border-radius:10px;box-shadow:0 8px 25px #0006;font:13px/1.4 Arial,sans-serif}
      #${ID} *{box-sizing:border-box}#${ID} .b-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;font-size:16px}
      #${ID} button{font:inherit;background:#292929;color:#fff;border:1px solid #666;border-radius:6px;padding:8px;cursor:pointer}
      #${ID} button:focus-visible{outline:2px solid #fff;outline-offset:2px}
      #${ID}-body>button{display:block;width:100%;margin:7px 0}
      #${ID} button:disabled{opacity:.45;cursor:not-allowed}
      #${ID} .b-muted{font-size:11px;color:#bbb;line-height:1.45;margin:5px 0}
      #${ID}-status{padding:8px;background:#242424;border:1px solid #555;border-radius:5px;margin:10px 0;overflow-wrap:anywhere}
      #${ID}-status[data-kind=error]{border-color:#b75a5a}
      #${ID}-status[data-kind=ok]{border-color:#509770}
      #${ID}-count{font-weight:bold;margin:7px 0}
      #${ID}-hide{padding:0 8px}`;
    document.documentElement.append(css,panel);
    $(ID+"-before").onclick=before;
    $(ID+"-after").onclick=after;
    $(ID+"-current").onclick=captureCurrent;
    $(ID+"-export").onclick=exportJSON;
    $(ID+"-lidar").onclick=exportLidar;
    $(ID+"-overlay-toggle").onclick=toggleOverlay;
    $(ID+"-stop").onclick=stop;
    $(ID+"-cancel-before").onclick=cancelBefore;
    $(ID+"-hide").onclick=()=>{
      const body=$(ID+"-body");body.hidden=!body.hidden;
      $(ID+"-hide").textContent=body.hidden?"+":"−";
    };
    if(window.MutationObserver) {
      const cutKey=text=>{
        const m=/Cut\s+(\d+)\s+of\s+part\s+(\d+)/i.exec(text||"");
        return m?`${m[2]}:${m[1]}`:null;
      };
      let observedKey=cutKey($("O2N3DCutDescription")?.textContent);
      S.observer=new MutationObserver(mutations=>{
        const relevant=mutations.filter(m=>m.target?.id==="O2N3DCutDescription"||m.target?.parentElement?.closest?.("#O2N3DCutDescription")||
          [...(m.addedNodes||[]),...(m.removedNodes||[])].some(n=>n.id==="O2N3DCutDescription"||n.querySelector?.("#O2N3DCutDescription")));
        if(!relevant.length)return;
        const currentKey=cutKey($("O2N3DCutDescription")?.textContent);
        // Rewriting the same label must not invalidate a valid before/after.
        // Retain intermediate labels so a rapid away-and-back still invalidates it.
        const intermediateKeys=relevant.flatMap(m=>[m.oldValue,
          ...Array.from(m.removedNodes||[],n=>n.querySelector?.("#O2N3DCutDescription")?.textContent||n.textContent)])
          .map(cutKey).filter(k=>k!==null);
        if(currentKey!==observedKey||intermediateKeys.some(k=>k!==observedKey))S.epoch++;
        observedKey=currentKey;
      });
      S.observer.observe(document.body,{subtree:true,childList:true,characterData:true,characterDataOldValue:true});
    }
    S.timer=setInterval(()=>{if(reconcileBefore())render();if(S.overlay)drawOverlay();},200);
    render();
  }
  window.__BANANE_V24={version:VERSION,before,after,captureCurrent,exportJSON,exportLidar,stop,toggleOverlay,
    getIncompleteCaptures:()=>JSON.parse(JSON.stringify(S.incomplete)),
    getRecords:()=>JSON.parse(JSON.stringify(S.records)),getLastExport:()=>S.last?JSON.parse(JSON.stringify(S.last.data)):null,destroy};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
