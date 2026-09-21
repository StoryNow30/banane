(function(root,factory){
  if(typeof module==='object'&&module.exports){
    const api=factory(require('./geometry-brain.js'),require('./geometry-candidate-v1.js'),require('../vendor/capture-core.js'),require('./gauge.js'));
    Object.defineProperty(api,'_createForTest',{value:factory,enumerable:false});
    module.exports=api;
  }else{
    const runtime=root.BananeGeometryRuntimeV46;
    const candidate=root.BananeGeometry3;
    const api=factory(runtime,candidate,root.BananeCaptureCore,root.BananeGauge4);
    root.BananeGCV1Shadow=api;
    root.BananeGeometry3=api.geometry;
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(Runtime,Candidate,C,Gauge){
 'use strict';

 /* Le contrat d'écartement est injecté par l'enveloppe ; le repli garde les
  * appels historiques à trois arguments de `_createForTest` fonctionnels. */
 const GAUGE=Gauge||(typeof module==='object'&&typeof require==='function'?require('./gauge.js'):
   (typeof globalThis!=='undefined'?globalThis:this).BananeGauge4);

 if(!Runtime||typeof Runtime.proposeBoth!=='function')throw Error('GCV1 shadow : géométrie runtime V4.6 absente.');
 if(!Candidate||typeof Candidate.propose!=='function')throw Error('GCV1 shadow : Candidate V1 absent.');
 if(!C||typeof C.point!=='function'||typeof C.distance!=='function')throw Error('GCV1 shadow : capture-core absent ou incomplet.');
 if(!GAUGE||typeof GAUGE.classifyMm!=='function')throw Error('GCV1 shadow : contrat d’écartement absent.');

 const V46=Runtime.frozen&&typeof Runtime.frozen.propose==='function'?Runtime.frozen:Runtime;
 const RATIO=1.5,SEP=.02,GRID=.003;
 const CONTRACT=Object.freeze({
   id:'GEOMETRY_CANDIDATE_V1',
   mode:'shadow-only',
   candidateBase:'0dbcb7a32825031c122a14ffc44e13dea629d785',
   capsule:'2366d483b643bf8415f3d8ecba35938ac4c1d02e',
   geometrySha256:'77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503',
   baselineSha256:'3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53',
   aStarHash:'e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f',
   compositionHash:'0ea0824fb9e0b763d575ee95784475632f7fe2fd18e684b68e9f765106b6b27a',
   searchY:.08,searchZ:.04,grid:.003,minTop:15,minFace:6,
   minTemplateLossRatio:1.5,alternativeSeparation:.02,
 });

 if(Candidate.DEFAULTS.searchY!==CONTRACT.searchY||
    Candidate.DEFAULTS.searchZ!==CONTRACT.searchZ||
    Candidate.DEFAULTS.grid!==CONTRACT.grid||
    Candidate.DEFAULTS.minTop!==CONTRACT.minTop||
    Candidate.DEFAULTS.minFace!==CONTRACT.minFace||
    Candidate.DEFAULTS.minTemplateLossRatio!==CONTRACT.minTemplateLossRatio||
    Candidate.DEFAULTS.alternativeSeparation!==CONTRACT.alternativeSeparation)
   throw Error('GCV1 shadow : paramètres Candidate V1 dérivés du gel.');

 let enabled=false,activeAssistedEnabled=false,armedSelector=null,last=null;
 const round6=x=>Math.round(Number(x)*1e6)/1e6;
 const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));

 function configure(options={}){
   if(Object.prototype.hasOwnProperty.call(options,'enabled')){
     if(typeof options.enabled!=='boolean')throw Error('GCV1 shadow : enabled doit être un booléen.');
     enabled=options.enabled;
     if(!enabled)last=null;
   }
   if(Object.prototype.hasOwnProperty.call(options,'activeAssisted')){
     if(typeof options.activeAssisted!=='boolean')throw Error('GCV1 actif Assisté : activeAssisted doit être un booléen.');
     activeAssistedEnabled=options.activeAssisted;
     if(!activeAssistedEnabled)armedSelector=null;
   }
   return state();
 }
 function state(){
   return {enabled,activeAssistedEnabled,selector:armedSelector||'shadow',armedForNextCall:armedSelector!==null,
     mode:armedSelector||'shadow-only',contract:{...CONTRACT},hasPendingJournal:last!==null};
 }
 function journal(){return clone(last);}
 function consumeLast(){const out=clone(last);last=null;return out;}
 function armOnce(selector){
   if(!['active-assisted','active-pilot-test'].includes(selector))throw Error('GCV1 : sélecteur actif inconnu.');
   if(selector==='active-assisted'&&!activeAssistedEnabled)throw Error('GCV1 actif Assisté : gate fermée.');
   if(armedSelector!==null)throw Error('GCV1 : un sélecteur est déjà armé.');
   armedSelector=selector;return state();
 }
 function disarm(){armedSelector=null;return state();}

 function prepareFrame(capture,side){
   const rail=capture?.rails?.[side];
   if(!rail)return {ok:false,reason:'Profil absent.'};
   if(!capture.pointsSceneRelative?.length)return {ok:false,reason:'Aucun point LiDAR disponible.'};
   const contour=rail.profileContours?.reduce(
     (a,b)=>(b.verticesSceneRelative?.length||0)>(a?.verticesSceneRelative?.length||0)?b:a,null);
   if(!contour)return {ok:false,reason:'Contour du profil absent.'};
   const shape=contour.verticesSceneRelative.map(p=>C.point(rail.sceneRelativeToProfileLocal,p));
   const sign=Math.sign(Candidate.median(shape.map(p=>p[1])));
   if(!sign)return {ok:false,reason:'Sens du profil ambigu.'};
   const vertices=shape.map(p=>[sign*p[1],p[2]]);
   const head=vertices.filter(p=>p[1]>-.04);
   if(head.length<6)return {ok:false,reason:'Contour de champignon non reconnu.'};
   const points=[];
   for(let i=0;i<capture.pointsSceneRelative.length;i++){
     if(capture.visibleByClipBoxes?.[i]===false)continue;
     const src=capture.pointsSceneRelative[i];
     if(!Array.isArray(src)||!src.every(Number.isFinite))continue;
     const q=C.point(rail.sceneRelativeToProfileLocal,src);
     if(!q.every(Number.isFinite))continue;
     if(Math.abs(q[0])<=.5&&Math.abs(q[1])<.18&&Math.abs(q[2])<.10)points.push([sign*q[1],q[2],q[0]]);
   }
   if(points.length<8)return {ok:false,reason:'Trop peu de points autour du champignon.',pointsLocal:points.length};
   const width=Math.max(...head.filter(p=>p[1]>-.012).map(p=>p[0]));
   if(!(width>.025&&width<.12))return {ok:false,reason:'Dimensions du profil hors du domaine testé.',width};
   const topAnchors=[];
   for(let u=.012;u<width-.012;u+=.006){
     const near=head.filter(p=>Math.abs(p[0]-u)<.004);
     if(near.length)topAnchors.push([u,Math.max(...near.map(p=>p[1]))]);
   }
   const faceAnchors=[];
   for(let z=-.014;z>=-.033;z-=.004){
     const near=head.filter(p=>Math.abs(p[1]-z)<.004);
     if(near.length)faceAnchors.push([Math.min(...near.map(p=>p[0])),z]);
   }
   if(topAnchors.length<3||faceAnchors.length<3)return {ok:false,reason:'Surfaces du profil non identifiées.'};
   const us=points.map(p=>p[0]).slice().sort((a,b)=>a-b);
   const zs=points.map(p=>p[1]).slice().sort((a,b)=>a-b);
   return {ok:true,sign,width,points,topAnchors,faceAnchors,head,
     uMedian:us[us.length>>1],zMedian:zs[zs.length>>1],pointsLocal:points.length};
 }

 function hypothesesA(points){
   const u=Candidate.median(points.map(p=>p[0]));
   return Number.isFinite(u)?[{u:round6(u),source:'median-all',score:points.length}]:[];
 }
 function aStarLab(frame){
   const h=hypothesesA(frame.points);
   const uMed=h[0]&&Number.isFinite(h[0].u)?h[0].u:frame.uMedian;
   return {uSeeds:[uMed],replaceOrigin:false,recenterWindow:true};
 }

 function compactProposal(p){
   if(!p)return {status:'absent',reason:null,delta:null,loss:null,topRows:null,faceCount:null,seed:null,confidence:null,lossRatio:null,uCenters:null,slopeLimited:false};
   const reason=p.status==='candidate'?null:(p.reasons||[]).join(' ');
   return {status:p.status,reason,delta:p.delta||null,
     loss:p.metrics?.templateLoss??null,
     topRows:p.top?.count??p.metrics?.topCount??null,
     faceCount:p.face?.count??p.metrics?.faceCount??null,
     seed:p.metrics?.seed||null,confidence:p.confidence??null,
     lossRatio:p.metrics?.templateAmbiguity?.lossRatio??null,
     alternative:p.metrics?.templateAmbiguity?.alternative??null,
     uCenters:p.metrics?.lab?.uCenters??null,
     coarseCount:p.metrics?.lab?.coarseCount??null,
     slopeLimited:!!(p.top?.slopeLimited||p.face?.slopeLimited)};
 }
 function motifOf(p){
   if(!p||p.status==='absent')return 'absent';
   if(p.status==='candidate')return 'candidate';
   const r=p.reason||'';
   if(r.includes('Plan de roulement non estimable'))return 'rsf';
   if(r.includes('Plan de roulement insuffisamment observé'))return 'minTop';
   if(r.includes('Flanc interne'))return 'flank';
   if(r.includes('Plusieurs placements concurrents'))return 'ambiguity';
   if(r.includes('Intersection hors de la fenêtre'))return 'window';
   if(r.includes('Inclinaison'))return 'slope';
   if(r.includes('Grand déplacement isolé'))return 'pair-lateral';
   return 'other';
 }

 function faceTier(faceCount){
   const n=faceCount||0;
   if(n>=Candidate.DEFAULTS.minFace)return 'STRONG_FACE';
   if(n>=3)return 'PARTIAL_FACE';
   return 'WEAK_FACE';
 }
 function topRowsAt(frame,u,z){
   const lo=u+.012,hi=u+frame.width-.012;
   if(!(hi>lo))return 0;
   let n=0;
   for(const p of frame.points)if(p[0]>lo&&p[0]<hi&&Math.abs(p[1]-z)<Candidate.DEFAULTS.topBand)n++;
   return n;
 }
 function characterize(frame,u,z,uCenters,knownLoss){
   const cfg=Candidate.DEFAULTS,topPts=[];
   for(const p of frame.points)
     if(p[0]>u+.012&&p[0]<u+frame.width-.012&&Math.abs(p[1]-z)<cfg.topBand)topPts.push([p[0],p[1]]);
   const top=Candidate.robustLine(topPts),topRows=topPts.length;
   const loss=knownLoss!=null?knownLoss:null;
   if(!top)return {u:round6(u),z:round6(z),loss,topRows,faceCount:0,slope:null,slopeLimited:false,
     windowOk:false,tier:'WEAK_FACE',motif:'rsf',distU:round6(Math.abs(u-(frame.uMedian||0))),distOrigin:round6(Math.abs(u))};
   const facePts=[];
   for(const p of frame.points){
     const drop=top.slope*p[0]+top.intercept-p[1];
     if(drop>.009&&drop<.034&&Math.abs(p[0]-u)<cfg.faceBand)facePts.push([p[1],p[0]]);
   }
   const face=Candidate.robustLine(facePts),faceCount=face?.count||0;
   let surfaceU=u,surfaceZ=z;
   if(face){
     const denom=1-face.slope*top.slope;
     if(Math.abs(denom)>.5){surfaceU=(face.intercept+face.slope*top.intercept)/denom;surfaceZ=top.slope*surfaceU+top.intercept;}
   }
   const uWindowOk=(uCenters||[0]).some(cu=>Math.abs(surfaceU-cu)<=cfg.searchY+.01);
   const zWindowOk=Math.abs(surfaceZ)<=cfg.searchZ+.01;
   const windowOk=uWindowOk&&zWindowOk&&Number.isFinite(surfaceU)&&Number.isFinite(surfaceZ);
   const slopeLimited=!!(top.slopeLimited||face?.slopeLimited);
   let motif='candidate';
   if(top.count<cfg.minTop)motif='minTop';
   else if(!face||faceCount<cfg.minFace)motif='flank';
   else if(slopeLimited)motif='slope';
   else if(!windowOk)motif='window';
   return {u:round6(u),z:round6(z),loss,topRows,faceCount,slope:top.slope,slopeLimited,windowOk,
     tier:faceTier(faceCount),motif,distU:round6(Math.abs(u-(frame.uMedian||0))),distOrigin:round6(Math.abs(u)),seed:[frame.sign*u,z]};
 }
 function localMinima(coarse,grid=GRID){
   const key=(u,z)=>round6(u)+','+round6(z),map=new Map();
   for(const c of coarse)map.set(key(c.u,c.z),c);
   const mins=[];
   for(const c of coarse){
     let ok=true;
     for(let du=-grid;du<=grid+1e-12;du+=grid){
       for(let dz=-grid;dz<=grid+1e-12;dz+=grid){
         if(Math.abs(du)<1e-12&&Math.abs(dz)<1e-12)continue;
         const o=map.get(key(c.u+du,c.z+dz));
         if(o&&o.loss<c.loss-1e-15){ok=false;break;}
       }
       if(!ok)break;
     }
     if(ok)mins.push(c);
   }
   return mins;
 }
 function qualifyStrong(c){
   return !!c&&c.topRows>=Candidate.DEFAULTS.minTop&&c.faceCount>=Candidate.DEFAULTS.minFace&&!c.slopeLimited&&c.windowOk;
 }
 function reducePool(coarse,frame,uCenters,extras=[]){
   if(!coarse||!coarse.length)return {pool:[],nCoarse:0,nLocalMin:0,nKept:0,nDense:0,nStrongDense:0};
   const mins=localMinima(coarse),keep=new Map();
   const add=(c,tag)=>{
     if(!c||!Number.isFinite(c.u)||!Number.isFinite(c.z))return;
     const k=round6(c.u)+','+round6(c.z);
     if(!keep.has(k))keep.set(k,{u:c.u,z:c.z,loss:c.loss,tags:new Set()});
     keep.get(k).tags.add(tag);
   };
   let minLoss=coarse[0],minLossSupported=null;
   for(const c of coarse){
     if(c.loss<minLoss.loss)minLoss=c;
     const n=topRowsAt(frame,c.u,c.z);c.topRows=n;
     if(n>=Candidate.DEFAULTS.minTop&&(!minLossSupported||c.loss<minLossSupported.loss))minLossSupported=c;
   }
   add(minLoss,'min-loss');
   if(minLossSupported)add(minLossSupported,'min-loss-supported');
   for(const c of mins)add(c,'local-min');
   for(const e of extras)add(e,e.tag||'extra');

   const dense=[];
   for(const c of coarse){
     if((c.topRows||0)<Candidate.DEFAULTS.minTop)continue;
     const ch=characterize(frame,c.u,c.z,uCenters,c.loss);ch.loss=c.loss;ch.tags=['top>=15'];dense.push(ch);
   }
   const strongDense=dense.filter(qualifyStrong);
   if(strongDense.length){
     const sMins=localMinima(strongDense.map(c=>({u:c.u,z:c.z,loss:c.loss})));
     for(const c of sMins)add(c,'strong-local-min');
     add(strongDense.reduce((a,b)=>b.loss<a.loss?b:a),'min-loss-strong');
   }
   const partialDense=dense.filter(c=>c.tier==='PARTIAL_FACE'&&c.topRows>=Candidate.DEFAULTS.minTop&&c.windowOk&&!c.slopeLimited);
   if(partialDense.length){
     const pMins=localMinima(partialDense.map(c=>({u:c.u,z:c.z,loss:c.loss})));
     for(const c of pMins)add(c,'partial-local-min');
     add(partialDense.reduce((a,b)=>b.loss<a.loss?b:a),'min-loss-partial');
   }
   const characterized=[];
   for(const c of keep.values()){
     const fromDense=dense.find(d=>round6(d.u)===round6(c.u)&&round6(d.z)===round6(c.z));
     const ch=fromDense||characterize(frame,c.u,c.z,uCenters,c.loss);
     const merged={...ch,loss:c.loss,tags:[...c.tags]};
     if(fromDense)merged.tags=[...new Set([...(fromDense.tags||[]),...c.tags])];
     characterized.push(merged);
   }
   characterized.sort((a,b)=>a.loss-b.loss);
   return {pool:characterized,nCoarse:coarse.length,nLocalMin:mins.length,nKept:characterized.length,
     nDense:dense.length,nStrongDense:strongDense.length};
 }

 function lossRatio(loss,lmin){
   if(!Number.isFinite(loss)||!Number.isFinite(lmin))return Infinity;
   if(lmin<=0)return loss<=0?1:Infinity;
   return loss/lmin;
 }
 const inCompetitive=(c,lmin)=>Number.isFinite(c?.loss)&&lossRatio(c.loss,lmin)<=RATIO;
 function alreadyQualified(astar){
   return !!(astar&&astar.status==='candidate'&&(astar.topRows??0)>=Candidate.DEFAULTS.minTop&&
     (astar.faceCount??0)>=Candidate.DEFAULTS.minFace&&!astar.slopeLimited);
 }
 function spatialClusters(cells,sep=SEP){
   const n=cells.length;if(!n)return [];
   const parent=cells.map((_,i)=>i);
   const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
   const union=(i,j)=>{const a=find(i),b=find(j);if(a!==b)parent[a]=b;};
   for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)
     if(Math.hypot(cells[i].u-cells[j].u,cells[i].z-cells[j].z)<sep)union(i,j);
   const map=new Map();
   for(let i=0;i<n;i++){const r=find(i);if(!map.has(r))map.set(r,[]);map.get(r).push(cells[i]);}
   return [...map.values()];
 }
 function cellFromAstar(astar,frame){
   if(!astar||!astar.seed)return null;
   return {u:round6(frame.sign*astar.seed[0]),z:round6(astar.seed[1]),loss:astar.loss,
     topRows:astar.topRows,faceCount:astar.faceCount,slopeLimited:!!astar.slopeLimited,
     windowOk:astar.status==='candidate',tier:faceTier(astar.faceCount),motif:astar.motif,tags:['astar-published']};
 }
 function lminOf(pool,astar){
   let m=null;
   for(const c of pool||[])if(Number.isFinite(c.loss)&&(m==null||c.loss<m))m=c.loss;
   if(m==null&&Number.isFinite(astar?.loss))m=astar.loss;
   return m;
 }
 function competitiveView(pool,lmin){
   const competitive=(pool||[]).filter(c=>inCompetitive(c,lmin));
   const strong=competitive.filter(qualifyStrong),clusters=spatialClusters(strong);
   return {lmin,ratioLimit:RATIO,nPool:(pool||[]).length,nCompetitive:competitive.length,
     nStrongPool:(pool||[]).filter(qualifyStrong).length,nStrongCompetitive:strong.length,nClusters:clusters.length};
 }
 const pickMinLoss=cells=>cells.reduce((a,b)=>a==null||b.loss<a.loss?b:a,null);
 function policyKeepAstar(astar,frame,extra={}){
   return {status:astar.status,motif:astar.motif,reason:astar.reason||null,pick:cellFromAstar(astar,frame),
     policy:'S1',changed:false,activated:false,...extra};
 }
 function policyS1(astar,pool,frame,view){
   if(alreadyQualified(astar))return policyKeepAstar(astar,frame,{
     nStrongCompetitive:view.nStrongCompetitive,nClusters:view.nClusters,note:'A_STAR déjà STRONG ; pas d’arbitrage.'});
   const strong=(pool||[]).filter(c=>inCompetitive(c,view.lmin)&&qualifyStrong(c));
   const clusters=spatialClusters(strong);
   if(clusters.length===1){
     const pick=pickMinLoss(clusters[0]);
     return {status:'candidate',motif:'candidate',reason:null,pick,policy:'S1',changed:true,activated:true,
       nStrongCompetitive:strong.length,nClusters:1,note:'Un cluster STRONG compétitif ; min-loss du cluster.'};
   }
   if(clusters.length>1)return {status:'unresolved',motif:'ambiguity',
     reason:'Plusieurs placements STRONG compétitifs spatialement distincts.',pick:null,policy:'S1',
     changed:false,activated:true,nStrongCompetitive:strong.length,nClusters:clusters.length};
   return {status:astar.status,motif:astar.motif,reason:astar.reason||null,pick:cellFromAstar(astar,frame),
     policy:'S1',changed:false,activated:true,nStrongCompetitive:0,nClusters:0,
     note:'Aucun STRONG dans le competitive set ; motif A_STAR conservé.'};
 }
 /* Garde d'ambiguïté S1. Quand A_STAR s'abstient POUR AMBIGUÏTÉ et que S1
  * publierait malgré tout un candidat appartenant à une hypothèse spatialement
  * distincte de celle d'un candidat V4.6 géométriquement STRONG, les deux
  * placements concurrents sont réellement soutenus : l'ambiguïté constatée par
  * A_STAR n'est pas levée, elle est préservée. Aucun repli automatique sur
  * V4.6, aucun candidat publié, aucune décision d'application ici — le Pilote
  * suit son chemin DEFERRED_UNRESOLVED habituel. Aucun seuil nouveau : le
  * motif vient de motifOf, la qualification géométrique de qualifyStrong, et
  * la distinction spatiale de spatialClusters/SEP (alternativeSeparation).
  *
  * `v46.status` est testé explicitement, et pas seulement la cellule du pool :
  * un V4.6 UNRESOLVED porte encore `metrics.seed`, `top` et `face` sur ses deux
  * sorties non soutenues (`src/geometry.js`, branches `unsupported` et ratio de
  * perte). La cellule `engine-published` qui en découle peut donc être STRONG
  * alors que V4.6 ne propose rien — en particulier sur sa propre abstention
  * d'ambiguïté, où minTop, minFace, la pente et la fenêtre sont déjà tous
  * satisfaits. Sans ce test, la garde serait plus large que la règle ablatée. */
 function preserveAmbiguity(astar,s1,v46,v46Cell){
   if(!astar||astar.status==='candidate'||astar.motif!=='ambiguity')return false;
   if(!s1||!s1.changed||s1.status!=='candidate'||!s1.pick)return false;
   if(v46?.status!=='candidate')return false;
   if(!qualifyStrong(v46Cell))return false;
   return spatialClusters([v46Cell,s1.pick]).length>1;
 }
 function deltaOf(pub,sign){
   if(!pub||pub.status!=='candidate'||!pub.pick)return null;
   return [0,sign*pub.pick.u,pub.pick.z];
 }
 function compactCell(c){
   if(!c)return null;
   return {u:c.u,z:c.z,loss:c.loss,topRows:c.topRows,faceCount:c.faceCount,slopeLimited:!!c.slopeLimited,
     windowOk:!!c.windowOk,tier:c.tier,motif:c.motif,tags:c.tags||[]};
 }
 function hypotDelta(a,b){
   if(!a&&!b)return 0;
   if(!a||!b)return null;
   return Math.hypot((a[0]||0)-(b[0]||0),(a[1]||0)-(b[1]||0),(a[2]||0)-(b[2]||0));
 }

 function scientificRail(capture,side){
   const v46p=V46.propose(capture,side),v46=compactProposal(v46p);v46.motif=motifOf(v46);
   const frame=prepareFrame(capture,side);
   if(!frame.ok)return {ok:false,side,reason:frame.reason,v46,astar:null,next:null,s1Activated:false,s1Changed:false,publishedWeak:false};
   let coarse=[],meta={uCenters:[0]};
   const astarP=Candidate.propose(capture,side,{lab:{...aStarLab(frame),onCoarse(c,m){coarse=c;meta=m;}}});
   const astar=compactProposal(astarP);astar.motif=motifOf(astar);
   astar.uCenters=astarP.metrics?.lab?.uCenters||meta.uCenters;
   const extras=[];
   if(meta?.best)extras.push({u:meta.best.u,z:meta.best.z,loss:meta.best.loss,tag:'coarse-best'});
   if(astar.seed)extras.push({u:frame.sign*astar.seed[0],z:astar.seed[1],loss:astar.loss,tag:'astar-published'});
   if(v46.seed)extras.push({u:frame.sign*v46.seed[0],z:v46.seed[1],loss:v46.loss,tag:'engine-published'});
   const reduced=reducePool(coarse,frame,meta.uCenters||[0,frame.uMedian],extras);
   const lmin=lminOf(reduced.pool,astar),view=competitiveView(reduced.pool,lmin);
   const s1=policyS1(astar,reduced.pool,{sign:frame.sign},view);
   const v46Cell=reduced.pool.find(c=>(c.tags||[]).includes('engine-published'))||null;
   const ambiguityPreserved=preserveAmbiguity(astar,s1,v46,v46Cell);
   const pub=ambiguityPreserved?{status:'unresolved',motif:'ambiguity',reason:astar.reason||null,pick:null,
     policy:'S1',changed:false,activated:true,nStrongCompetitive:s1.nStrongCompetitive??null,
     nClusters:s1.nClusters??null,note:'Ambiguïté A_STAR préservée : le candidat S1 et un candidat V4.6 STRONG occupent des hypothèses spatialement distinctes.'}:s1;
   const nextDelta=deltaOf(pub,frame.sign);
   const next={status:pub.status,motif:pub.motif,reason:pub.reason||null,delta:nextDelta,
     loss:pub.pick?.loss??null,topRows:pub.pick?.topRows??null,faceCount:pub.pick?.faceCount??null,
     slopeLimited:!!pub.pick?.slopeLimited,activated:!!pub.activated,changed:!!pub.changed,
     nClusters:pub.nClusters??null,nStrongCompetitive:pub.nStrongCompetitive??null,pick:compactCell(pub.pick)};
   const publishedWeak=!!(next.status==='candidate'&&pub.pick&&!qualifyStrong(pub.pick));
   return {ok:true,side,
     frame:{sign:frame.sign,width:round6(frame.width),pointsLocal:frame.pointsLocal,uMedian:round6(frame.uMedian),
       uSeed:aStarLab(frame).uSeeds[0],zMedian:frame.zMedian},
     v46,astar,next,
     competitive:{lmin:view.lmin,nPool:view.nPool,nCompetitive:view.nCompetitive,
       nStrongPool:view.nStrongPool,nStrongCompetitive:view.nStrongCompetitive,nClusters:view.nClusters},
     poolMeta:{nCoarse:reduced.nCoarse,nLocalMin:reduced.nLocalMin,nKept:reduced.nKept,nDense:reduced.nDense,nStrongDense:reduced.nStrongDense},
     s1Activated:!!pub.activated,s1Changed:!!pub.changed,publishedWeak,s1AmbiguityPreserved:ambiguityPreserved,
     deltaV46Next:hypotDelta(v46.delta,nextDelta)};
 }
 /* ÉTAGE A — garde d'écartement de la PAIRE PUBLIÉE.
  *
  * Un candidat peut être excellent seul et faux en paire : c'est le défaut
  * constaté en lot réel, où dix paires ont été appliquées puis validées entre
  * 1503,5 et 1564,0 mm. La science mono-rail n'y est pour rien et n'est pas
  * touchée — ni la perte, ni la fenêtre de recherche, ni le support, ni S1.
  *
  * La contrainte porte sur l'APRÈS PRÉDIT, jamais sur l'AVANT : l'écartement
  * AVANT vaut couramment 1480–1500 mm et c'est l'état que Banane corrige.
  *
  * Hors contrat, les DEUX rails du cut deviennent unresolved, avec le motif
  * `gauge-out-of-contract`. Aucun apply partiel n'est donc possible, et le
  * cut suit le chemin DEFERRED_UNRESOLVED existant. Aucun SKIP, aucune
  * décision : une paire hors contrat est une abstention.
  *
  * Ce lot ne choisit PAS un autre couple de candidats ; il sécurise la paire
  * finalement publiée. Les candidats initiaux restent dans le diagnostic. */
 function assessPublishedPair(capture,rails){
   const left=rails.left,right=rails.right;
   if(!left||!right||left.ok!==true||right.ok!==true)return null;
   if(left.next?.status!=='candidate'||right.next?.status!=='candidate')return null;
   if(!Array.isArray(left.next.delta)||!Array.isArray(right.next.delta))return null;
   return GAUGE.assessPair(capture.rails,{left:left.next.delta,right:right.next.delta},C);
 }
 function rejectPairForGauge(rail,report){
   const published=rail.next;
   rail.pairGauge={...report,rejected:true,publishedBeforeGate:{status:published.status,motif:published.motif,
     delta:published.delta,loss:published.loss,topRows:published.topRows,faceCount:published.faceCount,
     pick:published.pick,changed:published.changed,activated:published.activated}};
   rail.next={...published,status:'unresolved',motif:'gauge-out-of-contract',
     reason:'Écartement de paire hors contrat : '+report.predictedMm.toFixed(1)+' mm ('+report.gaugeClass+
       ', admissible '+report.lowMm+'–'+report.maximumMm+' mm).',
     delta:null,pick:null,changed:false};
   rail.s1Changed=false;rail.publishedWeak=false;rail.deltaV46Next=hypotDelta(rail.v46.delta,null);
 }
 function scientificProposeBoth(capture){
   const rails={};
   for(const side of ['left','right']){
     try{rails[side]=scientificRail(capture,side);}
     catch(e){rails[side]={ok:false,side,error:e?.message||String(e)};}
   }
   const pairGauge=assessPublishedPair(capture,rails);
   /* Une paire dont l'écartement n'est pas MESURABLE n'est pas rejetée ici :
    * fabriquer une abstention depuis un champ absent serait une décision
    * scientifique inventée. Le dernier garde du moteur, lui, refuse de
    * commander ce qu'il ne peut pas vérifier. */
   if(pairGauge){
     if(pairGauge.measurable&&!pairGauge.admissible)for(const side of ['left','right'])rejectPairForGauge(rails[side],pairGauge);
     else for(const side of ['left','right'])rails[side].pairGauge={...pairGauge,rejected:false};
   }
   return {rails,pairGauge,summary:{
     nextCandidates:Object.values(rails).filter(r=>r?.next?.status==='candidate').length,
     nextUnresolved:Object.values(rails).filter(r=>r?.next&&r.next.status!=='candidate').length,
     s1Activated:Object.values(rails).filter(r=>r?.s1Activated).length,
     s1Changed:Object.values(rails).filter(r=>r?.s1Changed).length,
     publishedWeak:Object.values(rails).filter(r=>r?.publishedWeak).length,
     pairGaugeRejected:!!(pairGauge&&pairGauge.measurable&&!pairGauge.admissible),
     pairGaugeMm:pairGauge?pairGauge.predictedMm:null,
     pairGaugeClass:pairGauge?pairGauge.gaugeClass:null,
   }};
 }

  /* Frontière pure entre le résultat scientifique et le contrat historique
   * consommé par Engine.apply(). Elle ne connaît ni l'adaptateur, ni ESV. Un
   * `unresolved` reste une abstention et ne reçoit jamais un delta V4.6. */
  function toRuntimeRails(science){
    if(!science||!science.rails||typeof science.rails!=='object')throw Error('GCV1 : résultat scientifique absent.');
    const parameters={contractId:CONTRACT.id,geometrySha256:CONTRACT.geometrySha256,
      aStarHash:CONTRACT.aStarHash,compositionHash:CONTRACT.compositionHash,
      searchY:CONTRACT.searchY,searchZ:CONTRACT.searchZ,grid:CONTRACT.grid,
      minTop:CONTRACT.minTop,minFace:CONTRACT.minFace,minTemplateLossRatio:CONTRACT.minTemplateLossRatio,
      alternativeSeparation:CONTRACT.alternativeSeparation,policy:'S1'};
    const rails={};
    for(const side of ['left','right']){
      const rail=science.rails[side];
      if(!rail)throw Error('GCV1 : résultat absent pour '+side+'.');
      if(rail.error)throw Error('GCV1 '+side+' : '+rail.error);
      const next=rail.next;
      const unresolvedReason=rail.reason||next?.reason||'GCV1 ne publie pas de position exploitable.';
      if(rail.ok!==true||!next||next.status!=='candidate'){
        rails[side]={side,status:'unresolved',delta:null,confidence:0,reasons:[unresolvedReason],
          method:Candidate.DEFAULTS.method,source:'geometry-candidate-v1-abstention',parameters:{...parameters},
          geometryEngine:'geometry-candidate-v1',gcv1:{motif:next?.motif||'input',activated:!!next?.activated,
            changed:!!next?.changed,confidenceStatus:next?.confidenceStatus||'not-applicable'}};
        continue;
      }
      if(!Array.isArray(next.delta)||next.delta.length!==3||!next.delta.every(Number.isFinite))
        throw Error('GCV1 '+side+' : delta candidate invalide.');
      /* Une sélection S1 n'a pas de confiance calibrée propre. Zéro décrit ce
       * statut sans invalider la publication Candidate ; le lot Pilote TEST
       * décide de l'admissibilité à sa frontière. A_STAR conserve son indice. */
      const confidence=next.changed?0:(Number.isFinite(rail.astar?.confidence)?rail.astar.confidence:0);
      const confidenceStatus=next.changed?'non-calibrated-s1-selection':'candidate-v1';
      rails[side]={side,status:'candidate',delta:next.delta.slice(),confidence,
        reasons:next.reason?[next.reason]:[],method:Candidate.DEFAULTS.method,
        source:next.changed?'geometry-candidate-v1-s1':'geometry-candidate-v1-astar',parameters:{...parameters},
        geometryEngine:'geometry-candidate-v1',gcv1:{motif:next.motif,activated:!!next.activated,changed:!!next.changed,
          confidenceStatus,topRows:next.topRows??null,faceCount:next.faceCount??null,
          nClusters:next.nClusters??null,nStrongCompetitive:next.nStrongCompetitive??null}};
    }
    return rails;
  }

  function compactRuntimeRails(rails){
    return Object.fromEntries(['left','right'].map(side=>{const p=rails?.[side];return [side,p?{
      status:p.status,delta:p.delta||null,confidence:p.confidence??null,reasons:p.reasons||[],method:p.method||null,source:p.source||null,
    }:null];}));
  }

  function proposeBoth(capture,options={}){
    /* Consommé avant tout calcul : même une exception V4.6 ne peut laisser
     * l'appel suivant armé par accident. background.js désarme aussi en finally,
     * ce qui protège les erreurs survenues avant d'entrer dans cette façade. */
    const selector=armedSelector;armedSelector=null;
    const runtime=Runtime.proposeBoth(capture,options);
    const activeAssisted=selector==='active-assisted',activePilot=selector==='active-pilot-test';
    const active=activeAssisted||activePilot;
    if(!enabled&&!active){last=null;return runtime;}
    try{
      const science=scientificProposeBoth(capture);
      let selected=runtime,selectedEngine='v4.6',fallback=false,fallbackReason=null,runtimeRails=null;
      if(active){
        try{runtimeRails=toRuntimeRails(science);selected=runtimeRails;selectedEngine='geometry-candidate-v1';}
        catch(e){if(activePilot)throw e;fallback=true;fallbackReason=e?.message||String(e);}
      }
      last={format:'banane-gcv1-shadow-v1',observedAt:new Date().toISOString(),
        contract:{...CONTRACT},runtimeDecisionUntouched:selectedEngine==='v4.6',commandsByShadow:0,...science,
        selection:{selector:active?selector:'shadow',requestedEngine:active?'geometry-candidate-v1':'v4.6',
          selectedEngine,fallback,fallbackReason},
        comparison:{v46:compactRuntimeRails(runtime),gcv1:runtimeRails?compactRuntimeRails(runtimeRails):null,
          selectedEngine,fallback}};
      return selected;
    }catch(e){
      const selectedEngine=activePilot?null:'v4.6';
      last={format:'banane-gcv1-shadow-v1',observedAt:new Date().toISOString(),
        contract:{...CONTRACT},runtimeDecisionUntouched:true,commandsByShadow:0,
        error:e?.message||String(e),selection:{selector:active?selector:'shadow',
          requestedEngine:active?'geometry-candidate-v1':'v4.6',selectedEngine,fallback:activeAssisted,
          technicalError:activePilot,fallbackReason:activeAssisted?(e?.message||String(e)):null},
        comparison:{v46:compactRuntimeRails(runtime),gcv1:null,selectedEngine,fallback:activeAssisted}};
      if(activePilot){const error=Error('GCV1 Pilote TEST : '+(e?.message||String(e)));error.code='GCV1_PILOT_TECHNICAL_ERROR';throw error;}
      return runtime;
    }
  }

 const geometry={...Runtime,proposeBoth};
  const api={CONTRACT,geometry,configure,state,journal,consumeLast,armOnce,disarm,scientificProposeBoth,toRuntimeRails};
 if(typeof module==='object'&&module.exports)Object.defineProperty(api,'_test',{value:{
   round6,lossRatio,inCompetitive,spatialClusters,qualifyStrong,alreadyQualified,policyS1,preserveAmbiguity,hypotDelta,
   assessPublishedPair,GAUGE,
 },enumerable:false});
 return api;
});
