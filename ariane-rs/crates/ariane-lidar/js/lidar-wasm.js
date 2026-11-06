/* CH-064-L : coquille de la lecture LiDAR en Rust/WASM.
 *
 * variante(texte de vendor/lidar.js) rend le MÊME texte, où une seule branche est insérée devant la boucle par point d'un nœud
 * (`for(let di=drawStart;di<drawEnd;di++)`) : si le nœud est éligible et qu'un noyau est installé
 * (`globalThis.ArianeLidarNoyau`), le nœud est parcouru par tranches par le noyau ; sinon la boucle d'origine s'exécute,
 * inchangée. Tout le reste de capture() est le code d'origine (inventaire, sondes, attributs, boxVisible, statut).
 * Le texte de vendor/lidar.js est lu à chaque construction : la variante suit le tronc (cible mouvante) et refuse de se
 * construire si la boucle a changé.
 *
 * Deux noyaux de même interface :
 *   noyauWasm(module)  : ariane_lidar.wasm (crate ariane-lidar), arène statique de 512 Kio qui ne grandit jamais ;
 *   noyauJs()          : le même algorithme en JS sans allocation (référence « JS élagué » du banc).
 *
 * Éligibilité d'un nœud (sinon : boucle d'origine) : non indexé ; positions Float32Array ou Float64Array, non normalisées,
 * pas ≥ 3 ; lecture directe `array[i*stride+offset+k]` PROUVÉE égale (Object.is) à l'accesseur sur les sondes du nœud,
 * comme le chemin rapide de src/native-lidar.js (4.7.2) ; bornes, maxPoints, maxInspected numériques ; yieldEvery entier > 0 ;
 * drawEnd entier.
 * Écart connu (documenté, comme CH-061) : l'horloge du budget (Date.now()-started>maxMillis) est lue avant chaque tranche
 * (≤ 4 096 points) et non avant chaque point. Le résultat est celui que le JS d'origine aurait rendu si l'horloge avait
 * franchi le budget à cette frontière. Sans franchissement du budget (cas mesuré), aucune différence. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArianeLidarWasm=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DEBUT='      for(let di=drawStart;di<drawEnd;di++) {';
 const FIN='      unchanged();\n      report.inspection="complete";';
 const BRANCHE=`      const __N=globalThis.ArianeLidarNoyau,__L=__N&&__N.eligible(n,indexAttr,bounds,maxPoints,maxInspected,yieldEvery,drawEnd,report.probes);
      if(__L){
        __N.debutNoeud(model,invModel,transforms,frames,bounds);
        let di=drawStart;
        while(di<drawEnd){
          if(out.quality.inspected>=maxInspected||out.pointsSceneRelative.length>=maxPoints||Date.now()-started>maxMillis){
            report.inspection="partial-budget";finishedAll=false;break outer;
          }
          if((di-drawStart)%yieldEvery===0){guard();unchanged();await pause();guard();unchanged();}
          const fin=Math.min(drawEnd,di+yieldEvery-((di-drawStart)%yieldEvery),di+Math.ceil(maxInspected-out.quality.inspected),di+__L.capacite);
          const t=__N.tranche(__L,di,fin-di,maxPoints-out.pointsSceneRelative.length,out.quality.roundTripMaxSceneUnits);
          out.quality.inspected+=t.traites;report.inspected+=t.traites;
          out.quality.nonFinitePositions+=t.nonFinis;report.nonFinitePositions+=t.nonFinis;
          out.quality.roundTripMaxSceneUnits=t.retour;out.quality.perRail.left+=t.gauche;out.quality.perRail.right+=t.droite;
          const __ret=t.retenus,__sc=t.scene,__cl=out.clouds[n.cloudIndex].clipping;
          for(let k=0;k<t.n;k++){
            const i=__ret[k],p=[__sc[3*k],__sc[3*k+1],__sc[3*k+2]];
            out.pointsSceneRelative.push(p);out.pointSources.push([nodeIndex,i]);
            out.quality.pointRoundTripsChecked++;
            out.visibleByClipBoxes.push(boxVisible(__cl,p));
            for(const key of extras) {
              const a=attrs[key],value=a&&i<a.count?a.get(i,0):null;
              out.attributes[key].push(finite(value)?value:null);
            }
            out.nodes[nodeIndex].retained++;
          }
          __N.proches(report.nearestToRailOrigin,SIDES);
          if(t.erreur)fail(t.erreur);
          di+=t.traites;
        }
      } else
`;
 function variante(texte){
  const a=texte.indexOf(DEBUT),b=texte.indexOf(FIN);
  if(a<0||b<0||texte.indexOf(DEBUT,a+1)>=0)throw Error('vendor/lidar.js a changé : boucle par point introuvable ou ambiguë (CH-064-L à mettre à jour).');
  return texte.slice(0,a)+BRANCHE+texte.slice(a);
 }
 /* ---------- partie commune aux deux noyaux ---------- */
 const MESSAGES=[null,'Projection non finie.','Transformation non finie.'];
 const nombre=x=>typeof x==='number'&&!Number.isNaN(x);
 /* Éligibilité ; rend le descripteur du nœud ({src, stride, offset, capacite, f64}) ou null. */
 function eligibleAvec(octetsEntree,capaciteMax){
  return function eligible(n,indexAttr,bounds,maxPoints,maxInspected,yieldEvery,drawEnd,probes){
   if(indexAttr||!n.position||n.position.isFloat16BufferAttribute)return null;
   const meta=n.attribute&&n.attribute.metadata,src=n.position.array||(n.position.data&&n.position.data.array);
   if(!meta||meta.normalized||n.position.normalized)return null;
   const f64=src instanceof Float64Array;if(!f64&&!(src instanceof Float32Array))return null;
   const stride=meta.stride,offset=meta.offset;
   if(!Number.isInteger(stride)||!Number.isInteger(offset)||stride<3||offset<0||meta.itemSize<3)return null;
   if(!Array.isArray(bounds)||!nombre(bounds[0])||!nombre(bounds[1])||!nombre(bounds[2]))return null;
   if(!nombre(maxPoints)||!nombre(maxInspected)||!Number.isSafeInteger(yieldEvery)||yieldEvery<1||!Number.isInteger(drawEnd))return null;
   // Preuve de la lecture directe : chaque sonde relue par l'accesseur et par le tableau, au bit près.
   let vues=0;
   for(const pr of probes||[]){const i=pr.sourceIndex;if(!Number.isInteger(i)||i<0||i>=n.attribute.count)continue;
    for(let k=0;k<3;k++)if(!Object.is(n.attribute.get(i,k),src[i*stride+offset+k]))return null;vues++;}
   if(!vues)return null;
   const largeur=f64?8:4,capacite=Math.min(capaciteMax,Math.floor((octetsEntree/largeur-3)/stride)+1);
   return capacite>=1?{src,stride,offset,f64,capacite}:null;
  };
 }
 /* Matrices : model, invModel, transforms[0..1], frames[s].profileLocalToSceneRelative, frames[s].sceneRelativeToProfileLocal, bounds. */
 function ecrireMatrices(M,model,invModel,transforms,frames,bounds){
  M.set(model,0);M.set(invModel,16);M.set(transforms[0],32);M.set(transforms[1],48);
  M.set(frames[0].profileLocalToSceneRelative,64);M.set(frames[1].profileLocalToSceneRelative,80);
  M.set(frames[0].sceneRelativeToProfileLocal,96);M.set(frames[1].sceneRelativeToProfileLocal,112);
  M[128]=bounds[0];M[129]=bounds[1];M[130]=bounds[2];
 }
 /* report.nearestToRailOrigin depuis l'état (mêmes clés, même ordre que vendor/lidar.js). */
 function ecrireProches(E,cible,SIDES){
  for(let s=0;s<2;s++){const o=s?15:6;if(E[o]!==0)cible[SIDES[s]]={sourceIndex:E[o+2],distanceProfileUnits:E[o+1],
   pointProfileLocal:[E[o+3],E[o+4],E[o+5]],pointSceneRelative:[E[o+6],E[o+7],E[o+8]]};}
 }
 const resultat=(E,n,retenus,scene)=>({n,traites:E[1],nonFinis:E[2],gauche:E[3],droite:E[4],retour:E[0],retenus,scene,erreur:MESSAGES[E[5]]||null});

 /* ---------- noyau Rust/WASM ---------- */
 function noyauWasm(source){
  const module=source instanceof WebAssembly.Module?source:new WebAssembly.Module(source);
  const X=new WebAssembly.Instance(module,{}).exports,buf=X.memory.buffer;
  // La mémoire ne grandit jamais (initiale = maximale) : ces vues restent valides toute la vie de l'instance.
  const pE=X.lidar_entree(),octets=X.lidar_entree_octets(),cap=X.lidar_capacite();
  const F32=new Float32Array(buf,pE,octets/4),F64=new Float64Array(buf,pE,octets/8);
  const M=new Float64Array(buf,X.lidar_matrices(),131),E=new Float64Array(buf,X.lidar_etat(),24);
  const R=new Uint32Array(buf,X.lidar_retenus(),cap),S=new Float64Array(buf,X.lidar_scene(),3*cap);
  let copieOctets=0;
  return {nom:'wasm',eligible:eligibleAvec(octets,cap),
   debutNoeud(model,invModel,transforms,frames,bounds){ecrireMatrices(M,model,invModel,transforms,frames,bounds);E[6]=0;E[15]=0;},
   tranche(L,di,nb,limite,retour){
    const debut=di*L.stride+L.offset,lus=nb>0?(nb-1)*L.stride+3:0;
    (L.f64?F64:F32).set(L.src.subarray(debut,debut+lus));copieOctets+=lus*(L.f64?8:4);
    E[0]=retour;
    const k=(L.f64?X.lidar_parcourir_f64:X.lidar_parcourir_f32)(nb,L.stride,di,limite)>>>0;
    if(E[5]===3)throw Error('CH-064-L : tranche refusée par le noyau (dépassement de l’arène).');
    return resultat(E,k,R,S);
   },
   proches(cible,SIDES){ecrireProches(E,cible,SIDES);},
   memoireOctets:()=>buf.byteLength,copieOctets:()=>copieOctets};
 }

 /* ---------- noyau JS sans allocation (même algorithme que la crate) ---------- */
 function noyauJs(){
  const cap=4096,M=new Float64Array(131),E=new Float64Array(24),R=new Uint32Array(cap),S=new Float64Array(3*cap);
  const P=new Float64Array(3),Q=new Float64Array(3),T=new Float64Array(3),L0=new Float64Array(3),L1=new Float64Array(3);
  let err=0;
  /* C.point(M[o..o+16], x,y,z) → sortie ; err = 1 (Projection) ou 2 (Transformation). */
  function pt(o,x,y,z,sortie){
   const w=M[o+3]*x+M[o+7]*y+M[o+11]*z+M[o+15];
   if(!Number.isFinite(w)||Math.abs(w)<1e-15){err=1;return false;}
   let a=M[o]*x+M[o+4]*y+M[o+8]*z+M[o+12],b=M[o+1]*x+M[o+5]*y+M[o+9]*z+M[o+13],c=M[o+2]*x+M[o+6]*y+M[o+10]*z+M[o+14];
   if(w!==1){a/=w;b/=w;c/=w;}
   if(!(Number.isFinite(a)&&Number.isFinite(b)&&Number.isFinite(c))){err=2;return false;}
   sortie[0]=a;sortie[1]=b;sortie[2]=c;return true;
  }
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  function plusProche(l,present,meilleur){
   if(!present||!Number.isFinite(meilleur))return true;
   const s=l[0]*l[0]+l[1]*l[1]+l[2]*l[2];
   if(!(Number.isFinite(s)&&s>1e-200))return true;
   return Math.sqrt(s)<=meilleur*(1+1e-9);
  }
  return {nom:'js-elague',eligible:eligibleAvec(Infinity,cap),
   debutNoeud(model,invModel,transforms,frames,bounds){ecrireMatrices(M,model,invModel,transforms,frames,bounds);E[6]=0;E[15]=0;},
   tranche(Ld,di,nb,limite,retour){
    const src=Ld.src,stride=Ld.stride,b0=M[128],b1=M[129],b2=M[130];
    let rt=retour,traites=0,nonFinis=0,g=0,d=0,k=0;err=0;
    points:for(let j=0;j<nb;j++){
     if(k>=limite)break;
     const base=(di+j)*stride+Ld.offset,x=src[base],y=src[base+1],z=src[base+2],i=di+j;
     traites++;
     if(!(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z))){nonFinis++;continue;}
     if(!pt(32,x,y,z,L0)||!pt(48,x,y,z,L1))break;
     const in0=Math.abs(L0[0])<=b0&&Math.abs(L0[1])<=b1&&Math.abs(L0[2])<=b2,in1=Math.abs(L1[0])<=b0&&Math.abs(L1[1])<=b1&&Math.abs(L1[2])<=b2;
     for(let s=0;s<2;s++){const l=s?L1:L0,o=s?15:6,present=E[o]!==0;
      if(!plusProche(l,present,E[o+1]))continue;
      const dd=Math.hypot(l[0],l[1],l[2]);
      if(!present||dd<E[o+1]){if(!pt(0,x,y,z,P))break points;
       E[o]=1;E[o+1]=dd;E[o+2]=i;E[o+3]=l[0];E[o+4]=l[1];E[o+5]=l[2];E[o+6]=P[0];E[o+7]=P[1];E[o+8]=P[2];}}
     if(!(in0||in1))continue;
     if(!pt(0,x,y,z,P)||!pt(16,P[0],P[1],P[2],Q)||!pt(0,Q[0],Q[1],Q[2],T))break;
     rt=Math.max(rt,dist(T,P));
     if(!pt(96,P[0],P[1],P[2],Q)||!pt(64,Q[0],Q[1],Q[2],T))break;
     rt=Math.max(rt,dist(T,P));if(in0)g++;
     if(!pt(112,P[0],P[1],P[2],Q)||!pt(80,Q[0],Q[1],Q[2],T))break;
     rt=Math.max(rt,dist(T,P));if(in1)d++;
     R[k]=i;S[3*k]=P[0];S[3*k+1]=P[1];S[3*k+2]=P[2];k++;
    }
    E[0]=rt;E[1]=traites;E[2]=nonFinis;E[3]=g;E[4]=d;E[5]=err;
    return resultat(E,k,R,S);
   },
   proches(cible,SIDES){ecrireProches(E,cible,SIDES);},
   memoireOctets:()=>0,copieOctets:()=>0};
 }
 return {variante,noyauWasm,noyauJs,DEBUT,FIN};
});
