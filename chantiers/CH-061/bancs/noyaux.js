/* CH-061 : noyaux interchangeables pour `search` de src/geometry.js, et colle WASM.
 * Chargé tel quel dans Node (vm) et dans Chromium (balise script). Aucune dépendance. */
(function(root){
 'use strict';
 const B0=.025*.025;
 function med(b){if(!b.length)return NaN;if(Array.isArray(b))b=b.slice().sort((x,y)=>x-y);else b.sort();const i=b.length>>1;return b.length%2?b[i]:(b[i-1]+b[i])/2;}
 /* Variante « JS réécrit » : mêmes opérations que l'original, points en Float64Array entrelacé, aucune allocation par case. */
 function versPlat(points){const P=new Float64Array(points.length*2);for(let i=0;i<points.length;i++){P[2*i]=points[i][0];P[2*i+1]=points[i][1];}return P;}
 function ancresPlat(a){const A=new Float64Array(a.length*2);for(let i=0;i<a.length;i++){A[2*i]=a[i][0];A[2*i+1]=a[i][1];}return A;}
 function jsOpt(){
  return function search(ctx,cu,cz,ry,rz,step,retain){
   const P=ctx.P||(ctx.P=versPlat(ctx.points)),T=ctx.T||(ctx.T=ancresPlat(ctx.top)),F=ctx.F||(ctx.F=ancresPlat(ctx.face));
   const nt=T.length>>1,nf=F.length>>1,bt=new Float64Array(nt),bf=new Float64Array(nf),n2=P.length,best=ctx.best;
   for(let u=cu-ry;u<=cu+ry+1e-10;u+=step)for(let z=cz-rz;z<=cz+rz+1e-10;z+=step){
    bt.fill(B0);bf.fill(B0);
    for(let i=0;i<n2;i+=2){const t0=P[i]-u,t1=P[i+1]-z;
     for(let k=0;k<nt;k++){const dx=t0-T[2*k],dz=t1-T[2*k+1],d=dx*dx+dz*dz;if(d<bt[k])bt[k]=d;}
     for(let k=0;k<nf;k++){const dx=t0-F[2*k],dz=t1-F[2*k+1],d=dx*dx+dz*dz;if(d<bf[k])bf[k]=d;}}
    const score=med(bt)+med(bf)+1e-7*(Math.abs(u)+Math.abs(z));
    if(retain)ctx.coarse.push({loss:score,u,z});
    if(score<best.loss){best.loss=score;best.u=u;best.z=z;}
   }
  };
 }
 /* Copie exacte de loss/search de src/geometry.js (même texte), pour chronométrer le noyau d'origine seul. */
 function origine(){return function search(ctx,cu,cz,ry,rz,step,retain){const points=ctx.points,best=ctx.best,coarse=ctx.coarse,median=a=>med(a);
   function loss(anchors,u,z){
     return median(anchors.map(a=>{let best=.025*.025;
       for(const p of points){const d=(p[0]-u-a[0])**2+(p[1]-z-a[1])**2;if(d<best)best=d;}return best;}));
   }
     for(let u=cu-ry;u<=cu+ry+1e-10;u+=step)for(let z=cz-rz;z<=cz+rz+1e-10;z+=step){
       const score=loss(ctx.top,u,z)+loss(ctx.face,u,z)+1e-7*(Math.abs(u)+Math.abs(z));
       if(retain)coarse.push({loss:score,u,z});
       if(score<best.loss){best.loss=score;best.u=u;best.z=z;}
     }};}
 /* Variante « JS élagué » : même arithmétique ((p0-u)-a0)**2+((p1-z)-a1)**2, mais seuls les points dont |p0-u-a0| < 26 mm
  * sont examinés (fenêtre trouvée par dichotomie sur p0 trié). Tout point hors fenêtre a une distance >= .025² : il ne peut
  * pas abaisser le minimum (borné à .025²). Le minimum, et donc chaque bit de sortie, est inchangé ; l'essai de parité le vérifie. */
 const MARGE=.026;
 function trier(points){const n=points.length,ord=Array.from({length:n},(_,i)=>i).sort((a,b)=>points[a][0]-points[b][0]);
  const X=new Float64Array(n),Y=new Float64Array(n);for(let i=0;i<n;i++){X[i]=points[ord[i]][0];Y[i]=points[ord[i]][1];}return {X,Y};}
 function borne(X,v){let lo=0,hi=X.length;while(lo<hi){const m=(lo+hi)>>1;if(X[m]<v)lo=m+1;else hi=m;}return lo;}
 function jsElague(){
  return function search(ctx,cu,cz,ry,rz,step,retain){
   const S=ctx.S||(ctx.S=trier(ctx.points)),X=S.X,Y=S.Y,best=ctx.best;
   const groupes=[ctx.top,ctx.face],b=[new Float64Array(ctx.top.length),new Float64Array(ctx.face.length)];
   for(let u=cu-ry;u<=cu+ry+1e-10;u+=step)for(let z=cz-rz;z<=cz+rz+1e-10;z+=step){
    let score=0;
    for(let g=0;g<2;g++){const A=groupes[g],bb=b[g];
     for(let k=0;k<A.length;k++){const a0=A[k][0],a1=A[k][1];let m=B0;
      const lo=borne(X,u+a0-MARGE),hi=borne(X,u+a0+MARGE);
      for(let i=lo;i<hi;i++){const d=(X[i]-u-a0)**2+(Y[i]-z-a1)**2;if(d<m)m=d;}bb[k]=m;}
     score+=med(bb);}
    score+=1e-7*(Math.abs(u)+Math.abs(z));
    if(retain)ctx.coarse.push({loss:score,u,z});
    if(score<best.loss){best.loss=score;best.u=u;best.z=z;}
   }
  };
 }
 /* Colle WASM brute : un tas de travail réservé une fois, agrandi au besoin. */
 function wasm(instance,fonction='geo_search'){
  const X=instance.exports;let base=0,taille=0;
  const tas=octets=>{if(octets>taille){if(base)X.liberer(base,taille);taille=Math.max(octets,1<<20);base=X.reserver(taille);}return base;};
  const f64=()=>new Float64Array(X.memory.buffer);
  const api={exports:X,tas,
   search(ctx,cu,cz,ry,rz,step,retain){
    const np=ctx.points.length,nt=ctx.top.length,nf=ctx.face.length,ncMax=retain?Math.ceil((2*ry/step+2)*(2*rz/step+2)):0;
    const octets=8*(2*np+2*nt+2*nf+3+3*ncMax);const p0=tas(octets),M=f64();let o=p0>>3;
    const oP=o;for(const p of ctx.points){M[o++]=p[0];M[o++]=p[1];}
    const oT=o;for(const a of ctx.top){M[o++]=a[0];M[o++]=a[1];}
    const oF=o;for(const a of ctx.face){M[o++]=a[0];M[o++]=a[1];}
    const oB=o;M[o++]=ctx.best.loss;M[o++]=ctx.best.u;M[o++]=ctx.best.z;const oC=o;
    const n=X[fonction](oP*8,np,oT*8,nt,oF*8,nf,cu,cz,ry,rz,step,oB*8,retain?oC*8:0,ncMax)>>>0;
    if(retain&&n>ncMax)throw Error('capacité des cases dépassée');
    const R=f64();ctx.best.loss=R[oB];ctx.best.u=R[oB+1];ctx.best.z=R[oB+2];
    if(retain)for(let i=0;i<n;i++)ctx.coarse.push({loss:R[oC+3*i],u:R[oC+3*i+1],z:R[oC+3*i+2]});
   }};
  return api;
 }
 /* Réécrit le texte de src/geometry.js : `loss` et `search` deviennent un appel au noyau choisi.
  * Le reste du module (tri des points, ancres, droites robustes, confiance) est l'original, octet pour octet. */
 const DEBUT='   function loss(anchors,u,z){',FIN='   search(0,0,cfg.searchY,cfg.searchZ,cfg.grid,true);';
 function variante(source,nom){
  const a=source.indexOf(DEBUT),b=source.indexOf(FIN);if(a<0||b<0)throw Error('src/geometry.js a changé : bloc search introuvable');
  const neuf="   let best={loss:Infinity,u:0,z:0};const coarse=[];const __ctx={points,top:topAnchors,face:faceAnchors,best,coarse};\n"+
   "   const search=(cu,cz,ry,rz,step,retain=false)=>globalThis.__CH061_NOYAU.search(__ctx,cu,cz,ry,rz,step,retain);\n";
  return source.slice(0,a)+neuf+source.slice(b).replace(/root\.BananeGeometry3=api/,'root.BananeGeometry3=api;root.__CH061_VARIANTE='+JSON.stringify(nom));
 }
 const api={jsOpt,jsElague,wasm,variante,origine,trier};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.CH061Noyaux=api;
})(typeof globalThis!=='undefined'?globalThis:this);
