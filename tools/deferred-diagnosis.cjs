#!/usr/bin/env node
'use strict';
/*
 * deferred-diagnosis.cjs — pourquoi la décision sur le lot laisse un cut différé
 * (étude hors ligne sur sessions Natif, 24/09).
 *
 *   node tools/deferred-diagnosis.cjs SORTIE.json SESSION|DOSSIER=libellé [...]
 *
 * Un seul passage, dans l'ordre des visites, ancres = cuts retenus par la
 * décision elle-même (comme `observeLot`). Pour chaque différé : rails dont le
 * repère échoue (et points autour de la vraie position, avant le premier geste
 * et sur toute la visite), minima près de la prédiction, vérité humaine
 * rapportée à la prédiction (jugement seulement), et, pour les cuts sans ancre,
 * l'ancre la plus proche en fin de session (deux passages).
 * Limite : l'entrée est celle du banc Natif (capture avant le premier geste) ;
 * le Pilote recentre la vue et attend le détail LiDAR, il manque moins de points.
 */
const B=require('node:path').resolve(__dirname,'..')+'/';
const Segments=require(B+'tools/merge-segments.cjs'),Lab=require(B+'tools/placement-lab.cjs');
const O=require(B+'src/continuity-observer.js'),Shadow=require(B+'src/gcv1-shadow.js'),LD=require(B+'src/lot-decision.js'),C=require(B+'vendor/capture-core.js');
const fs=require('node:fs');
const SIDES=['left','right'],EXCLUDED=new Set([9033,9241]),r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
function localOf(rail,pos){const M=rail.sceneRelativeToProfileLocal,a=C.point(M,pos),o=C.point(M,rail.positionSceneRelative);return [a[0]-o[0],a[1]-o[1],a[2]-o[2]];}
function countNear(points,rail,latMin,latMax){let n=0;const M=rail.sceneRelativeToProfileLocal,o=C.point(M,rail.positionSceneRelative);
  for(const p of points){const q=C.point(M,p);const y=q[1]-o[1],x=q[0]-o[0],z=q[2]-o[2];if(Math.abs(x)<=.5&&Math.abs(z)<.10&&y>=latMin&&y<latMax)n++;}return n;}
function run(file,label){
  const s=Segments.loadSession(file);
  const records=(s.records||[]).slice().sort((a,b)=>a.visitIndex-b.visitIndex);
  const chunksByVisit=new Map();for(const c of s.clouds||[])if(c.pointsSceneRelative)(chunksByVisit.get(c.visitId)||chunksByVisit.set(c.visitId,[]).get(c.visitId)).push(c);
  const anchors=[],rows=[],seen=new Set();
  for(const record of records){
    const id=record.identity||{},key=id.part+'|'+id.cut;if(seen.has(key))continue;seen.add(key);
    if(EXCLUDED.has(id.cut)||!record.beforeEstablished?.rails)continue;
    const chunks=chunksByVisit.get(record.visitId)||[],input=O.gatherInput(record,chunks);
    if(!SIDES.every(x=>input.contours[x])||!input.points.length){rows.push({cut:id.cut,stage:'no-input'});continue;}
    const rails=O.startRails(record,input,null).rails;
    const capture={identity:id,rails,pointsSceneRelative:input.points,visibleByClipBoxes:input.visible};
    const science=Shadow.scientificProposeBoth(capture);
    const d=LD.decideCut({capture,science,anchors,Shadow});
    if(d.anchor)anchors.push({identity:id,positions:d.positions});
    const row={cut:id.cut,stage:d.stage,reason:d.reason||null,anchorsUsed:d.anchorsUsed||[]};
    // Référence humaine stricte (jugement seulement).
    const through=chunks.filter(c=>input.chunkIds.includes(c.chunkId)).map(c=>c.acquisition?.endedAt||c.capturedAt).filter(Boolean).sort().at(-1)||null;
    const refs=Object.fromEntries(SIDES.map(x=>[x,Lab.referenceFor(record,x,record.beforeEstablished.rails[x],through)]));
    row.referenced=SIDES.every(x=>refs[x].status==='candidate');
    if(d.stage==='deferred'&&d.anchorsUsed?.length){
      const nb=LD.neighbours(id,anchors.filter(a=>a.identity.cut!==id.cut),LD.DEFAULTS).map(a=>({positions:a.positions}));
      const seeded=LD.minimalCapture(capture,LD.seededRails(rails,nb.length?nb:[]));
      const again=Shadow.scientificProposeBoth(seeded);
      row.sides={};
      for(const x of SIDES){
        const r=again.rails[x],sd=seeded.rails[x],esvToSeed=localOf(rails[x],sd.positionSceneRelative);
        const info={predFromEsvLatMm:r1(esvToSeed[1]*1000),predFromEsvVertMm:r1(esvToSeed[2]*1000)};
        if(!r?.ok){info.frame=r?.reason||r?.error||'?';info.pointsLocal=r?.pointsLocal??null;
          info.pointsInBoxAtSeed=countNear(input.points,sd,-.18,.18);info.pointsInBoxAtEsv=countNear(input.points,rails[x],-.18,.18);}
        else{info.motif=r.next.status==='candidate'?'candidate':r.next.motif;info.ownLatMm=r.next.delta?r1(r.next.delta[1]*1000):null;
          const list=LD.candidatesOf(seeded,x,again);info.minima=list.slice(0,8).map(c=>({u:c.uMm,z:c.zMm,top:c.top,face:c.face,rank:c.rank}));}
        if(refs[x].status==='candidate'){const t=localOf(sd,refs[x].finalRail.positionSceneRelative),sign=r?.frame?.sign??1;
          info.truthLatMm=r1(sign*t[1]*1000);info.truthVertMm=r1(t[2]*1000);
          if(info.minima){const near=info.minima.map(c=>({...c,d:Math.hypot(c.u-info.truthLatMm,c.z-info.truthVertMm)})).sort((a,b)=>a.d-b.d)[0];info.truthNearestMinimum=near||null;}}
        row.sides[x]=info;
      }
    }
    // Points autour de la VRAIE position (jugement seulement) : entrée avant geste, puis toute la visite.
    if(row.referenced){const all=[];for(const c of chunks)for(let i=0;i<c.pointsSceneRelative.length;i++)if(c.visibleByClipBoxes?.[i]===true)all.push(c.pointsSceneRelative[i]);
      row.truthBox={};for(const x of SIDES){const t={...rails[x],positionSceneRelative:refs[x].finalRail.positionSceneRelative};
        row.truthBox[x]={input:countNear(input.points,t,-.18,.18),visit:countNear(all,t,-.18,.18),truthFromEsvLatMm:r1(localOf(rails[x],refs[x].finalRail.positionSceneRelative)[1]*1000)};}}
    rows.push(row);
  }
  // Ancres disponibles en fin de session (deux passages) pour les différés sans ancre.
  for(const row of rows)if(row.reason==='no-anchor'){const d=anchors.map(a=>a.identity.cut-row.cut).filter(v=>v!==0);
    row.nearestAnchorBelow=Math.min(...d.filter(v=>v<0).map(v=>-v),Infinity);row.nearestAnchorAbove=Math.min(...d.filter(v=>v>0),Infinity);}
  return {label,rows};
}
if(require.main===module){
const out=[];for(const arg of process.argv.slice(3)){const [f,l]=arg.split('=');const t=Date.now();const r=run(f,l);out.push(r);
  const st={};for(const x of r.rows)st[x.stage]=(st[x.stage]||0)+1;console.log(l,r.rows.length,'cuts',JSON.stringify(st),Math.round((Date.now()-t)/1000)+' s');}
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1));
}
module.exports={run};
