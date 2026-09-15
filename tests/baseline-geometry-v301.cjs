(function(root,factory){const api=factory(typeof module==='object'?require('../vendor/capture-core.js'):root.BananeCaptureCore);
 if(typeof module==='object')module.exports=api;else root.BananeGeometry3=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 const median=a=>{if(!a.length)return NaN;const b=a.slice().sort((a,b)=>a-b),i=b.length>>1;return b.length%2?b[i]:(b[i-1]+b[i])/2;};
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const DEFAULTS=Object.freeze({searchY:.08,searchZ:.04,grid:.003,minTop:15,minFace:6,
   maxResidual:.004,minConfidence:55,topBand:.012,faceBand:.01,method:'surfaces-v1'});
 function robustLine(rows){
   if(rows.length<3)return null;
   const slopes=[];const stride=Math.max(1,Math.floor(rows.length/70));
   for(let i=0;i<rows.length;i+=stride)for(let j=i+stride;j<rows.length;j+=stride){
     const dx=rows[j][0]-rows[i][0];if(Math.abs(dx)>.01)slopes.push((rows[j][1]-rows[i][1])/dx);
   }
   const slope=slopes.length?clamp(median(slopes),-.5,.5):0;
   const intercept=median(rows.map(p=>p[1]-slope*p[0]));
   return {slope,intercept,residual:median(rows.map(p=>Math.abs(p[1]-slope*p[0]-intercept))),count:rows.length};
 }
 function propose(capture,side,options={}){
   const cfg={...DEFAULTS,...options},rail=capture.rails?.[side];
   for(const [k,lo,hi] of [['searchY',.005,.2],['searchZ',.005,.1],['grid',.001,.01],['minTop',3,500],['minFace',3,500],['minConfidence',0,100]])
     if(!Number.isFinite(cfg[k])||cfg[k]<lo||cfg[k]>hi)throw Error('Paramètre géométrique invalide : '+k);
   if(!rail)throw Error('Profil absent : '+side);
   const unresolved=reason=>({side,status:'unresolved',delta:null,confidence:0,reasons:[reason],
     method:cfg.method,source:'no-estimate',parameters:cfg});
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
   let best={loss:Infinity,u:0,z:0};
   function search(cu,cz,ry,rz,step){
     for(let u=cu-ry;u<=cu+ry+1e-10;u+=step)for(let z=cz-rz;z<=cz+rz+1e-10;z+=step){
       const score=loss(topAnchors,u,z)+loss(faceAnchors,u,z)+1e-7*(Math.abs(u)+Math.abs(z));
       if(score<best.loss)best={loss:score,u,z};
     }
   }
   search(0,0,cfg.searchY,cfg.searchZ,cfg.grid);search(best.u,best.z,.004,.004,.001);
   // Estimate the centres of the observed top and gauge-face sheets, not a drawing vertex.
   const topRows=points.filter(p=>p[0]>best.u+.012&&p[0]<best.u+width-.012&&Math.abs(p[1]-best.z)<cfg.topBand).map(p=>[p[0],p[1]]);
   const top=robustLine(topRows);
   if(!top)return unresolved('Plan de roulement non estimable.');
   const faceRows=points.filter(p=>{const drop=top.slope*p[0]+top.intercept-p[1];
     return drop>.009&&drop<.034&&Math.abs(p[0]-best.u)<cfg.faceBand;}).map(p=>[p[1],p[0]]);
   const face=robustLine(faceRows);
   let u=best.u,z=best.z,source='lidar-template',reasons=[];
   if(face){const denom=1-face.slope*top.slope;
     if(Math.abs(denom)>.5){u=(face.intercept+face.slope*top.intercept)/denom;z=top.slope*u+top.intercept;source='lidar-surface-intersection';}}
   if(!Number.isFinite(u)||!Number.isFinite(z)||Math.abs(u)>cfg.searchY+.01||Math.abs(z)>cfg.searchZ+.01)return unresolved('Intersection hors de la fenêtre expérimentale.');
   const faceCount=face?.count||0,residual=Math.max(top.residual,face?.residual||cfg.maxResidual*2);
   const binsTop=new Set(topRows.map(p=>Math.floor(p[0]/.006))).size;
   const binsFace=new Set(faceRows.map(p=>Math.floor(p[0]/.005))).size;
   let confidence=100*Math.min(1,top.count/cfg.minTop,faceCount/cfg.minFace,binsTop/5,binsFace/3)*Math.exp(-residual/.006);
   confidence=Math.round(clamp(confidence,0,100));
   if(!capture.visibleByClipBoxes||capture.visibleByClipBoxes.some(v=>v===null)){confidence=Math.min(confidence,25);reasons.push('Découpe du nuage non vérifiée.');}
   if(top.count<cfg.minTop)reasons.push('Peu de points sur le dessus.');
   if(faceCount<cfg.minFace)reasons.push('Peu de points sur le flanc interne.');
   if(residual>cfg.maxResidual)reasons.push('Nappes dispersées.');
   if(source==='lidar-template')reasons.push('Intersection non résolue : estimation par le contour U50.');
   if(confidence<cfg.minConfidence)reasons.push('Confiance heuristique faible.');
   return {side,status:'candidate',delta:[0,sign*u,z],confidence,reasons,method:cfg.method,source,
     parameters:cfg,metrics:{points:points.length,topCount:top.count,faceCount,residual,seed:[sign*best.u,best.z],
       topSpanBins:binsTop,faceSpanBins:binsFace,templateLoss:best.loss},top,face};
 }
 function proposeBoth(capture,options={}){return {left:propose(capture,'left',options),right:propose(capture,'right',options)};}
 return {DEFAULTS,median,robustLine,propose,proposeBoth};
});
