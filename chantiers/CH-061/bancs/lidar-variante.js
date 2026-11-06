/* CH-061 : prototype de lecture du LiDAR. Le texte de vendor/lidar.js est repris tel quel, sauf la boucle par point d'un nœud
 * (Float32 non indexé, non normalisé, non entrelacé), remplacée par un appel au noyau `__CH061_SCAN` (JS sans allocation ou Rust/WASM).
 * Tout le reste (inventaire, sondes, contrôles d'intégrité, statut, avertissements) est le code d'origine.
 * Écart connu : l'horloge du budget (maxMillis, 15 s) est lue par tranche de yieldEvery points au lieu de chaque point. */
(function(root){
 'use strict';
 const DEBUT='      for(let di=drawStart;di<drawEnd;di++) {',FIN='      unchanged();\n      report.inspection="complete";';
 const NOYAU=`      const __meta=n.attribute.metadata,__src=n.position.array;
      if(!indexAttr&&__meta.arrayType==='Float32Array'&&!__meta.normalized&&!__meta.interleaved&&__src instanceof Float32Array&&typeof globalThis.__CH061_SCAN?.scan==='function'){
        const __mats=new Float64Array(131);[model,invModel,transforms[0],transforms[1],frames[0].profileLocalToSceneRelative,frames[1].profileLocalToSceneRelative,
          frames[0].sceneRelativeToProfileLocal,frames[1].sceneRelativeToProfileLocal].forEach((m,k)=>__mats.set(m,16*k));__mats.set(bounds,128);
        const __etat=new Float64Array(26);__etat[5]=Infinity;__etat[15]=Infinity;const __job=globalThis.__CH061_SCAN.preparer(__src);
        let di=drawStart;
        while(di<drawEnd){
          if(out.quality.inspected>=maxInspected||out.pointsSceneRelative.length>=maxPoints||Date.now()-started>maxMillis){report.inspection="partial-budget";finishedAll=false;globalThis.__CH061_SCAN.finir(__job);break outer;}
          if((di-drawStart)%yieldEvery===0){guard();unchanged();await pause();guard();unchanged();}
          const fin=Math.min(drawEnd,di+yieldEvery-((di-drawStart)%yieldEvery),di+(maxInspected-out.quality.inspected));
          const i0=__etat[0],nf0=__etat[1],l0=__etat[3],r0=__etat[4];__etat[2]=out.quality.roundTripMaxSceneUnits;
          const r=globalThis.__CH061_SCAN.scan(__job,__meta.stride,__meta.offset,di,fin,__mats,maxPoints-out.pointsSceneRelative.length,__etat);
          if(__etat[25])fail("Projection non finie.");
          out.quality.inspected+=__etat[0]-i0;report.inspected+=__etat[0]-i0;out.quality.nonFinitePositions+=__etat[1]-nf0;report.nonFinitePositions+=__etat[1]-nf0;
          out.quality.perRail.left+=__etat[3]-l0;out.quality.perRail.right+=__etat[4]-r0;out.quality.roundTripMaxSceneUnits=__etat[2];
          for(let k=0;k<r.n;k++){const i=r.retenus[k],p=[r.scene[3*k],r.scene[3*k+1],r.scene[3*k+2]];
            out.pointsSceneRelative.push(p);out.pointSources.push([nodeIndex,i]);out.quality.pointRoundTripsChecked++;
            out.visibleByClipBoxes.push(boxVisible(out.clouds[n.cloudIndex].clipping,p));
            for(const key of extras){const a=attrs[key],value=a&&i<a.count?a.get(i,0):null;out.attributes[key].push(finite(value)?value:null);}
            out.nodes[nodeIndex].retained++;}
          di+=__etat[0]-i0;
          if(r.n>0&&out.pointsSceneRelative.length>=maxPoints&&di<fin)continue;
        }
        for(let s=0;s<2;s++){const o=5+10*s;if(__etat[o]!==Infinity)report.nearestToRailOrigin[SIDES[s]]={sourceIndex:__etat[o+1],distanceProfileUnits:__etat[o],
          pointProfileLocal:[__etat[o+2],__etat[o+3],__etat[o+4]],pointSceneRelative:[__etat[o+5],__etat[o+6],__etat[o+7]]};}
        globalThis.__CH061_SCAN.finir(__job);
      } else
`;
 function variante(source){
  const a=source.indexOf(DEBUT),b=source.indexOf(FIN);if(a<0||b<0)throw Error('vendor/lidar.js a changé : boucle introuvable');
  return source.slice(0,a)+NOYAU+source.slice(a,b)+source.slice(b);
 }
 /* Noyau JS sans allocation : même arithmétique que C.point, inRoi, Math.hypot et C.distance. */
 function pt(m,x,y,z,o,k){const w=m[3+k]*x+m[7+k]*y+m[11+k]*z+m[15+k];o[0]=(m[0+k]*x+m[4+k]*y+m[8+k]*z+m[12+k])/w;o[1]=(m[1+k]*x+m[5+k]*y+m[9+k]*z+m[13+k])/w;o[2]=(m[2+k]*x+m[6+k]*y+m[10+k]*z+m[14+k])/w;return w;}
 const ok=(w,o)=>Number.isFinite(w)&&Math.abs(w)>=1e-15&&Number.isFinite(o[0])&&Number.isFinite(o[1])&&Number.isFinite(o[2]);
 function scanJs(){
  const L0=new Float64Array(3),L1=new Float64Array(3),P=new Float64Array(3),Q=new Float64Array(3),R=new Float64Array(3);let cap=0,ret,sc,co;
  return {preparer:src=>({src}),finir(){},
   scan(job,stride,offset,debut,fin,M,limite,e){
    const src=job.src,n0=fin-debut;if(n0>cap){cap=n0;ret=new Uint32Array(cap);sc=new Float64Array(3*cap);co=new Uint8Array(cap);}
    const b0=M[128],b1=M[129],b2=M[130];let n=0;
    for(let i=debut;i<fin;i++){if(n>=limite)break;const base=i*stride+offset,x=src[base],y=src[base+1],z=src[base+2];e[0]++;
     if(!(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z))){e[1]++;continue;}
     const w0=pt(M,x,y,z,L0,32),w1=pt(M,x,y,z,L1,48);if(!ok(w0,L0)||!ok(w1,L1)){e[25]=1;return {n,retenus:ret,scene:sc,cotes:co};}
     const in0=Math.abs(L0[0])<=b0&&Math.abs(L0[1])<=b1&&Math.abs(L0[2])<=b2,in1=Math.abs(L1[0])<=b0&&Math.abs(L1[1])<=b1&&Math.abs(L1[2])<=b2;
     for(let s=0;s<2;s++){const L=s?L1:L0,d=Math.hypot(L[0],L[1],L[2]),o=5+10*s;
      if(d<e[o]){pt(M,x,y,z,P,0);e[o]=d;e[o+1]=i;e[o+2]=L[0];e[o+3]=L[1];e[o+4]=L[2];e[o+5]=P[0];e[o+6]=P[1];e[o+7]=P[2];}}
     if(!(in0||in1))continue;
     pt(M,x,y,z,P,0);pt(M,P[0],P[1],P[2],Q,16);pt(M,Q[0],Q[1],Q[2],R,0);
     let rt=e[2];const d0=Math.hypot(R[0]-P[0],R[1]-P[1],R[2]-P[2]);if(d0>rt)rt=d0;
     for(let s=0;s<2;s++){pt(M,P[0],P[1],P[2],Q,s?112:96);pt(M,Q[0],Q[1],Q[2],R,s?80:64);const d=Math.hypot(R[0]-P[0],R[1]-P[1],R[2]-P[2]);if(d>rt)rt=d;
      if(s?in1:in0)e[3+s]++;}
     e[2]=rt;ret[n]=i;sc[3*n]=P[0];sc[3*n+1]=P[1];sc[3*n+2]=P[2];co[n]=(in0?1:0)|(in1?2:0);n++;}
    return {n,retenus:ret,scene:sc,cotes:co};}};
 }
 /* Noyau Rust : le tampon Float32 du nœud est COPIÉ une fois dans la mémoire WASM (Potree l'a alloué hors de cette mémoire). */
 function scanWasm(instance){
  const X=instance.exports;
  return {copieOctets:0,copieMs:0,
   preparer(src){const t=performance.now();const octets=src.length*4,p=X.reserver(octets);new Float32Array(X.memory.buffer,p,src.length).set(src);
    this.copieOctets+=octets;this.copieMs+=performance.now()-t;return {p,octets,n:src.length,sortie:null,cap:0};},
   finir(job){X.liberer(job.p,job.octets);if(job.sortie)X.liberer(job.sortie,job.cap*33+8*26+8*131);},
   scan(job,stride,offset,debut,fin,M,limite,e){
    const n0=fin-debut;if(n0>job.cap){if(job.sortie)X.liberer(job.sortie,job.cap*33+8*26+8*131);job.cap=n0;job.sortie=X.reserver(job.cap*33+8*26+8*131);}
    const pm=job.sortie,pe=pm+8*131,ps=pe+8*26,pr=ps+24*job.cap,pc=pr+4*job.cap;
    new Float64Array(X.memory.buffer,pm,131).set(M);new Float64Array(X.memory.buffer,pe,26).set(e);
    const n=X.lidar_scan(job.p,job.n,stride,offset,debut,fin,pm,pr,ps,pc,limite,pe)>>>0;
    e.set(new Float64Array(X.memory.buffer,pe,26));
    return {n,retenus:new Uint32Array(X.memory.buffer,pr,n),scene:new Float64Array(X.memory.buffer,ps,3*n),cotes:new Uint8Array(X.memory.buffer,pc,n)};}};
 }
 const api={variante,scanJs,scanWasm};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.CH061Lidar=api;
})(typeof globalThis!=='undefined'?globalThis:this);
