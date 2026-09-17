(function(root,factory){const api=factory(typeof module==='object'?require('../vendor/capture-core.js'):root.BananeCaptureCore);
 if(typeof module==='object')module.exports=api;else root.BananeGeometry3=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 const median=a=>{if(!a.length)return NaN;const b=a.slice().sort((a,b)=>a-b),i=b.length>>1;return b.length%2?b[i]:(b[i-1]+b[i])/2;};
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const DEFAULTS=Object.freeze({searchY:.08,searchZ:.04,grid:.003,minTop:15,minFace:6,
   maxResidual:.004,minConfidence:55,topBand:.012,faceBand:.01,
   alternativeSeparation:.02,minTemplateLossRatio:1.5,maxSingleRailLateral:.06,pairedSupportLateral:.04,
   method:'template-surfaces-v3'});
 const MIN_TOP_ROWS=3;
 function robustLine(rows){
   if(rows.length<3)return null;
   const slopes=[];const stride=Math.max(1,Math.floor(rows.length/70));
   for(let i=0;i<rows.length;i+=stride)for(let j=i+stride;j<rows.length;j+=stride){
     const dx=rows[j][0]-rows[i][0];if(Math.abs(dx)>.01)slopes.push((rows[j][1]-rows[i][1])/dx);
   }
   const rawSlope=slopes.length?median(slopes):0,slope=clamp(rawSlope,-.5,.5);
   const intercept=median(rows.map(p=>p[1]-slope*p[0]));
   return {slope,rawSlope,slopeLimited:slope!==rawSlope,intercept,residual:median(rows.map(p=>Math.abs(p[1]-slope*p[0]-intercept))),count:rows.length};
 }
 function propose(capture,side,options={}){
   const lab=options.lab&&typeof options.lab==='object'?options.lab:null;
   const cfg={...DEFAULTS,...options,method:DEFAULTS.method};delete cfg.lab;
   const rail=capture.rails?.[side];
   for(const [k,lo,hi] of [['searchY',.005,.2],['searchZ',.005,.1],['grid',.001,.01],['minTop',3,500],['minFace',3,500],['minConfidence',0,100],
     ['alternativeSeparation',.005,.1],['minTemplateLossRatio',1,100],['maxSingleRailLateral',.01,.2],['pairedSupportLateral',.005,.2]])
     if(!Number.isFinite(cfg[k])||cfg[k]<lo||cfg[k]>hi)throw Error('Paramètre géométrique invalide : '+k);
   if(cfg.pairedSupportLateral>=cfg.maxSingleRailLateral)throw Error('Paramètres géométriques incohérents : appui pair >= déplacement isolé.');
   if(!rail)throw Error('Profil absent : '+side);
   const parameters=lab?{...cfg,lab:{...lab}}:cfg;
   const unresolved=reason=>({side,status:'unresolved',delta:null,confidence:0,reasons:[reason],
     method:cfg.method,source:'no-estimate',parameters});
   if(!capture.pointsSceneRelative?.length)return unresolved('Aucun point LiDAR disponible.');
   const contour=rail.profileContours?.reduce((a,b)=>(b.verticesSceneRelative?.length||0)>(a?.verticesSceneRelative?.length||0)?b:a,null);
   if(!contour)return unresolved('Contour du profil absent.');
   const shape=contour.verticesSceneRelative.map(p=>C.point(rail.sceneRelativeToProfileLocal,p));
   const sign=Math.sign(median(shape.map(p=>p[1])));
   if(!sign)return unresolved('Sens du profil ambigu.');
   const vertices=shape.map(p=>[sign*p[1],p[2]]),head=vertices.filter(p=>p[1]>-.04);
   if(head.length<6)return unresolved('Contour de champignon non reconnu.');
   const points=[];
   for(let i=0;i<capture.pointsSceneRelative.length;i++){
     if(capture.visibleByClipBoxes?.[i]===false)continue;
     if(!Array.isArray(capture.pointsSceneRelative[i])||!capture.pointsSceneRelative[i].every(Number.isFinite))continue;
     const q=C.point(rail.sceneRelativeToProfileLocal,capture.pointsSceneRelative[i]);
     if(q.every(Number.isFinite)&&Math.abs(q[0])<=.5&&Math.abs(q[1])<.18&&Math.abs(q[2])<.10)points.push([sign*q[1],q[2],q[0]]);
   }
   if(points.length<8)return unresolved('Trop peu de points autour du champignon.');
   const width=Math.max(...head.filter(p=>p[1]>-.012).map(p=>p[0]));
   if(!(width>.025&&width<.12))return unresolved('Dimensions du profil hors du domaine testé.');
   const topAnchors=[];for(let u=.012;u<width-.012;u+=.006){
     const near=head.filter(p=>Math.abs(p[0]-u)<.004);if(near.length)topAnchors.push([u,Math.max(...near.map(p=>p[1]))]);
   }
   const faceAnchors=[];for(let z=-.014;z>=-.033;z-=.004){
     const near=head.filter(p=>Math.abs(p[1]-z)<.004);if(near.length)faceAnchors.push([Math.min(...near.map(p=>p[0])),z]);
   }
   if(topAnchors.length<3||faceAnchors.length<3)return unresolved('Surfaces du profil non identifiées.');
   function loss(anchors,u,z){
     return median(anchors.map(a=>{let best=.025*.025;
       for(const p of points){const d=(p[0]-u-a[0])**2+(p[1]-z-a[1])**2;if(d<best)best=d;}return best;}));
   }
   let best={loss:Infinity,u:0,z:0};const coarse=[];
   function search(cu,cz,ry,rz,step,retain=false){
     for(let u=cu-ry;u<=cu+ry+1e-10;u+=step)for(let z=cz-rz;z<=cz+rz+1e-10;z+=step){
       const score=loss(topAnchors,u,z)+loss(faceAnchors,u,z)+1e-7*(Math.abs(u)+Math.abs(z));
       if(retain)coarse.push({loss:score,u,z});
       if(score<best.loss)best={loss:score,u,z};
     }
   }
   search(0,0,cfg.searchY,cfg.searchZ,cfg.grid,true);
   const lossMinCoarse={...best};
   const topRowsAt=(u,z)=>points.filter(p=>p[0]>u+.012&&p[0]<u+width-.012&&Math.abs(p[1]-z)<cfg.topBand);
   /* ---- lab-geometry-prototype-v1 : inactive unless options.lab is set ---- */
   if(lab){
     if(lab.cloudZSeed){
       const zMed=median(points.map(p=>p[1]));
       if(Number.isFinite(zMed))search(0,zMed,cfg.searchY,cfg.searchZ,cfg.grid,true);
     }
     if(Number.isFinite(lab.pairSeedZ))search(0,lab.pairSeedZ,cfg.searchY,cfg.searchZ,cfg.grid,true);
     if(lab.lockZToCloud){
       const zMed=median(points.map(p=>p[1]));
       if(Number.isFinite(zMed)){
         let pick=null;
         for(const c of coarse){
           if(Math.abs(c.z-zMed)>0.012)continue;
           if(!pick||c.loss<pick.loss)pick=c;
         }
         if(!pick){
           for(const c of coarse){
             if(!pick||Math.abs(c.z-zMed)<Math.abs(pick.z-zMed))pick=c;
           }
         }
         if(pick)best={loss:pick.loss,u:pick.u,z:pick.z};
       }
     }
     const penalty=Number.isFinite(lab.supportPenalty)?lab.supportPenalty:0;
     if(lab.preferSupported||penalty>0||lab.multiMinima){
       for(const c of coarse)c.topRows=topRowsAt(c.u,c.z).length;
       if(penalty>0){
         let pick=coarse[0];
         for(const c of coarse){c.score=c.loss+penalty*(c.topRows<MIN_TOP_ROWS?1:0);if(c.score<pick.score)pick=c;}
         best={loss:pick.loss,u:pick.u,z:pick.z};
       }
       if(lab.multiMinima){
         const minima=[];
         for(const c of coarse){
           let local=true;
           for(const o of coarse){
             if(o===c)continue;
             if(Math.hypot(o.u-c.u,o.z-c.z)>=cfg.alternativeSeparation)continue;
             if(o.loss<c.loss){local=false;break;}
           }
           if(local)minima.push(c);
         }
         minima.sort((a,b)=>a.loss-b.loss);
         const supported=minima.filter(c=>c.topRows>=MIN_TOP_ROWS);
         const pick=(lab.preferSupported&&supported.length)?supported[0]:minima[0];
         if(pick)best={loss:pick.loss,u:pick.u,z:pick.z};
       }else if(lab.preferSupported){
         let supported=null;
         for(const c of coarse)if(c.topRows>=MIN_TOP_ROWS&&(!supported||c.loss<supported.loss))supported=c;
         if(supported)best={loss:supported.loss,u:supported.u,z:supported.z};
       }
     }
   }
   const coarseBest={...best};let alternative=null;
   const alternativePool=lab&&lab.preferSupported
     ?coarse.filter(c=>(c.topRows??topRowsAt(c.u,c.z).length)>=MIN_TOP_ROWS)
     :coarse;
   for(const candidate of alternativePool){
     if(Math.hypot(candidate.u-coarseBest.u,candidate.z-coarseBest.z)<cfg.alternativeSeparation)continue;
     if(!alternative||candidate.loss<alternative.loss)alternative=candidate;
   }
   const templateLossRatio=alternative&&coarseBest.loss>0?alternative.loss/coarseBest.loss:Infinity;
   search(best.u,best.z,.004,.004,.001);
   if(lab&&lab.preserveCoarseSupport){
     const refinedN=topRowsAt(best.u,best.z).length,coarseN=topRowsAt(coarseBest.u,coarseBest.z).length;
     if(refinedN<MIN_TOP_ROWS&&coarseN>=MIN_TOP_ROWS)best={...coarseBest};
   }
   // Surface fits validate support and remain diagnostic. Placement itself uses
   // the full U50 head template because the fitted sheet intersection was less
   // stable on the manual passage-level-crossing references.
   const topRows=points.filter(p=>p[0]>best.u+.012&&p[0]<best.u+width-.012&&Math.abs(p[1]-best.z)<cfg.topBand).map(p=>[p[0],p[1]]);
   const top=robustLine(topRows);
   if(!top)return unresolved('Plan de roulement non estimable.');
   const faceRows=points.filter(p=>{const drop=top.slope*p[0]+top.intercept-p[1];
     return drop>.009&&drop<.034&&Math.abs(p[0]-best.u)<cfg.faceBand;}).map(p=>[p[1],p[0]]);
   const face=robustLine(faceRows);
   let surfaceU=best.u,surfaceZ=best.z,reasons=[];
   if(face){const denom=1-face.slope*top.slope;
     if(Math.abs(denom)>.5){surfaceU=(face.intercept+face.slope*top.intercept)/denom;surfaceZ=top.slope*surfaceU+top.intercept;}}
   if(!Number.isFinite(surfaceU)||!Number.isFinite(surfaceZ)||Math.abs(surfaceU)>cfg.searchY+.01||Math.abs(surfaceZ)>cfg.searchZ+.01)return unresolved('Intersection hors de la fenêtre expérimentale.');
   const faceCount=face?.count||0,residual=Math.max(top.residual,face?.residual||cfg.maxResidual*2);
   const binsTop=new Set(topRows.map(p=>Math.floor(p[0]/.006))).size;
   const binsFace=new Set(faceRows.map(p=>Math.floor(p[0]/.005))).size;
   const metrics={points:points.length,topCount:top.count,faceCount,residual,seed:[sign*best.u,best.z],
     surfaceIntersection:[sign*surfaceU,surfaceZ],topSpanBins:binsTop,faceSpanBins:binsFace,templateLoss:best.loss,
     templateAmbiguity:{coarseBestLoss:coarseBest.loss,alternativeLoss:alternative?.loss??null,
       lossRatio:Number.isFinite(templateLossRatio)?templateLossRatio:null,separation:alternative?Math.hypot(alternative.u-coarseBest.u,alternative.z-coarseBest.z):null,
       alternative:alternative?[sign*alternative.u,alternative.z]:null}};
   if(lab)metrics.lab={lossMinCoarse:[sign*lossMinCoarse.u,lossMinCoarse.z,lossMinCoarse.loss],
     selectedCoarse:[sign*coarseBest.u,coarseBest.z,coarseBest.loss],topRows:topRows.length,coarseCount:coarse.length,
     flank:{faceRows:faceRows.length,faceCount,topCount:top.count,topSlope:top.slope,topSlopeLimited:!!top.slopeLimited,
       faceSlope:face?face.slope:null,faceSlopeLimited:!!face?.slopeLimited,faceBand:cfg.faceBand,minTop:cfg.minTop,minFace:cfg.minFace}};
   // The first method returned a writable candidate even without both sheets,
   // or after forcing an implausible fitted slope to its numeric search limit.
   // These are missing geometric support, not merely a low confidence score.
   const unsupported=[];
   let minTopReq=cfg.minTop,minFaceReq=cfg.minFace,skipFaceGate=false;
   if(lab&&(lab.adaptiveFace||lab.relativeFace||lab.partialFaceKeep||lab.explicitFaceAbstain)){
     if(lab.adaptiveFace){
       const vis=points.filter(p=>Math.abs(p[0]-best.u)<cfg.faceBand&&p[1]<best.z-.006&&p[1]>best.z-.040).length;
       minFaceReq=vis<=0?cfg.minFace:Math.min(cfg.minFace,Math.max(3,vis));
       metrics.lab.adaptiveFace={visibleInZone:vis,minFaceReq};
     }
     if(lab.relativeFace){
       minFaceReq=Math.max(3,Math.round(DEFAULTS.minFace*top.count/DEFAULTS.minTop));
       metrics.lab.relativeFace={minFaceReq,topCount:top.count,ratio:DEFAULTS.minFace/DEFAULTS.minTop};
     }
     const strongRs=top.count>=DEFAULTS.minTop;
     const facePartial=!!face&&faceCount>=3&&faceCount<minFaceReq;
     skipFaceGate=!!(lab.partialFaceKeep&&strongRs&&facePartial&&!top.slopeLimited&&!face.slopeLimited);
     if(lab.partialFaceKeep)metrics.lab.partialFaceKeep={strongRs,facePartial,skipFaceGate,faceCount,minFaceReq};
     metrics.lab.minTopReq=minTopReq;metrics.lab.minFaceReq=minFaceReq;metrics.lab.skipFaceGate=skipFaceGate;
     if(top.count<minTopReq)unsupported.push('Plan de roulement insuffisamment observé.');
     if((!face||faceCount<minFaceReq)&&!skipFaceGate){
       if(lab.explicitFaceAbstain){
         if(!face||faceCount<3)unsupported.push(faceRows.length===0
           ?'Flanc interne absent de la fenêtre d’observation ; abstention.'
           :'Flanc interne trop clairsemé pour estimer une nappe ; abstention.');
         else unsupported.push('Flanc interne partiellement observé ; abstention plutôt que publication.');
       }else unsupported.push('Flanc interne insuffisamment observé.');
     }
     if(top.slopeLimited||face?.slopeLimited)unsupported.push('Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée.');
   }else{
     if(top.count<cfg.minTop)unsupported.push('Plan de roulement insuffisamment observé.');
     if(!face||faceCount<cfg.minFace)unsupported.push('Flanc interne insuffisamment observé.');
     if(top.slopeLimited||face?.slopeLimited)unsupported.push('Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée.');
   }
   if(unsupported.length)return {...unresolved(unsupported.join(' ')),metrics,top,face};
   if(templateLossRatio<cfg.minTemplateLossRatio)return {...unresolved('Plusieurs placements concurrents du champignon sont géométriquement plausibles.'),metrics,top,face};
   let confidence=100*Math.min(1,top.count/cfg.minTop,faceCount/cfg.minFace,binsTop/5,binsFace/3)*Math.exp(-residual/.006);
   confidence=Math.round(clamp(confidence,0,100));
   if(!capture.visibleByClipBoxes||capture.visibleByClipBoxes.some(v=>v===null)){confidence=Math.min(confidence,25);reasons.push('Découpe du nuage non vérifiée.');}
   if(top.count<cfg.minTop)reasons.push('Peu de points sur le dessus.');
   if(faceCount<cfg.minFace)reasons.push('Peu de points sur le flanc interne.');
   if(residual>cfg.maxResidual)reasons.push('Nappes dispersées.');
   if(confidence<cfg.minConfidence)reasons.push('Confiance heuristique faible.');
   return {side,status:'candidate',delta:[0,sign*best.u,best.z],confidence,reasons,method:cfg.method,source:'lidar-template-supported',
     parameters,metrics,top,face};
 }
 function enforcePairSupport(proposals,options={}){
   const cfg={...DEFAULTS,...options};delete cfg.lab;
   const candidates=['left','right'].filter(s=>proposals[s]?.delta);
   if(cfg.pairedSupportLateral>=cfg.maxSingleRailLateral)throw Error('Paramètres géométriques incohérents : appui pair >= déplacement isolé.');
   if(candidates.length!==2)return proposals;
   const lateral=Object.fromEntries(candidates.map(s=>[s,Math.abs(proposals[s].delta[1])]));
   const extreme=candidates.find(s=>lateral[s]>cfg.maxSingleRailLateral);
   const other=extreme&&candidates.find(s=>s!==extreme);
   if(extreme&&lateral[other]<cfg.pairedSupportLateral){
     const current=proposals[extreme];proposals[extreme]={...current,status:'unresolved',delta:null,confidence:0,source:'no-estimate',
       reasons:[...(current.reasons||[]),'Grand déplacement isolé : le second rail ne confirme pas ce placement.']};
   }
   return proposals;
 }
 function proposeBoth(capture,options={}){
   const lab=options.lab&&typeof options.lab==='object'?options.lab:null;
   const out=enforcePairSupport({left:propose(capture,'left',options),right:propose(capture,'right',options)},options);
   if(!lab||!lab.pairZTransfer)return out;
   const FAILURE='Plan de roulement non estimable.';
   for(const side of ['left','right']){
     const other=side==='left'?'right':'left';
     const fail=out[side]?.status==='unresolved'&&(out[side].reasons||[]).join(' ').includes(FAILURE);
     const ok=out[other]?.status==='candidate'&&Array.isArray(out[other].delta);
     if(!fail||!ok)continue;
     const retry=propose(capture,side,{...options,lab:{...lab,cloudZSeed:true,preferSupported:true,pairSeedZ:out[other].delta[2]}});
     out[side]=retry;
   }
   return enforcePairSupport(out,options);
 }
 return {DEFAULTS,median,robustLine,enforcePairSupport,propose,proposeBoth,MIN_TOP_ROWS};
});
