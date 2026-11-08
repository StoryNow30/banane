/* FICHIER FABRIQUÉ par tools/rust-lidar-paquet.cjs : ne pas éditer à la main. */
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
 * Trappe du module (fusion par le chef, CH-064) : une WebAssembly.RuntimeError pendant une tranche ne fait pas échouer capture().
 * L'instance est recréée (mémoire neuve, vues refaites), puis la MÊME tranche est rejouée par le noyau JS, à partir de l'état
 * sauvé juste avant l'appel (matrices et état des plus proches) ; l'état rendu est recopié dans l'instance neuve, et les tranches
 * suivantes repartent dans le WASM. Compté par reprises(). Essai : tools/ch064-essais-lidar-trappe.cjs.
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
 /* File des captures (audit de la PR n° 25, P1) : le noyau porte un état (matrices, plus proches, arène) d'un appel de
  * debutNoeud() à la fin du nœud, à travers les `await pause()`. Deux capture() simultanées se l'écraseraient. La variante
  * exporte donc un capture() qui attend la fin de la précédente (réussie ou non) avant de commencer : les captures sont
  * sérialisées sur tout leur parcours. Le journal du 05/11 n'en montre aucune simultanée (2 711 captures) ; l'origine, elle,
  * est réentrante (état local à chaque appel). */
 const EXPORT='  return {capture,inventory,diagnostic,cameraSnapshot,boxVisible,clipSnapshot};';
 const FILE='  let __fileCaptures=Promise.resolve();\n  const __captureEnFile=options=>{const p=__fileCaptures.then(()=>capture(options));__fileCaptures=p.then(()=>{},()=>{});return p;};\n'+
  '  return {capture:__captureEnFile,inventory,diagnostic,cameraSnapshot,boxVisible,clipSnapshot};';
 function variante(texte){
  const a=texte.indexOf(DEBUT),b=texte.indexOf(FIN),c=texte.indexOf(EXPORT);
  if(a<0||b<0||texte.indexOf(DEBUT,a+1)>=0)throw Error('vendor/lidar.js a changé : boucle par point introuvable ou ambiguë (CH-064-L à mettre à jour).');
  if(c<0||texte.indexOf(EXPORT,c+1)>=0||c<a)throw Error('vendor/lidar.js a changé : export de capture introuvable ou ambigu (CH-064 à mettre à jour).');
  return texte.slice(0,a)+BRANCHE+texte.slice(a,c)+FILE+texte.slice(c+EXPORT.length);
 }
 /* ---------- partie commune aux deux noyaux ---------- */
 const MESSAGES=[null,'Projection non finie.','Transformation non finie.'],VERSION_ARENE=1;
 const nombre=x=>typeof x==='number'&&!Number.isNaN(x);
 /* Accesseurs reconnus (audits de la PR n° 25 : 4ceb766, 01846d1, 906ec78, 1f78142). La lecture directe du tableau n'est prise que
  * si l'attribut n'a AUCUN accesseur getX/getY/getZ, ou si ses trois accesseurs sont AUTHENTIFIÉS comme ceux de three.js. On
  * authentifie la sémantique, pas seulement l'identité ; les quatre conditions doivent tenir :
  *  1. chaque accesseur est lu par descripteur (chaîne des prototypes) et c'est une valeur, jamais une propriété calculée ;
  *  2. son texte (Function.prototype.toString, pris au chargement de la coquille) est EXACTEMENT un corps de la liste blanche
  *     CORPS_THREE, par genre d'attribut (simple ou entrelacé) ;
  *  3. il est identique à l'instantané pris au chargement de la coquille dans la page (globalThis.THREE de ce moment-là ; THREE
  *     absent au chargement : aucune référence) ET aux fonctions que porte encore le THREE courant ;
  *  4. pour lui seul, les sondes sont relues comme seconde garde (ces accesseurs sont purs).
  * Tout autre accesseur : AUCUN appel de la coquille, pas même les sondes ; le nœud passe par la boucle d'origine, seule à
  * reproduire ses appels à l'identique (indices, ordre, entrelacement avec les autres attributs, arrêts de budget ou d'erreur).
  * Limite assumée : une page qui réécrirait Function.prototype.toString AVANT l'injection de la coquille pour se faire passer pour
  * three.js sort de ce modèle (ESV n'a aucune raison de le faire). Refus comptés par raison (refus()). */
 /* Corps de three.js r124 (Potree 1.8.0 à 1.8.2 : libs/three.js/build/three.module.js, BufferAttribute et
  * InterleavedBufferAttribute ; relevé du source, CH-064 ; ESV charge Potree 1.8.0, relevé de CH-062). Ces accesseurs lisent le
  * tableau sans branche « normalized » ; les attributs normalisés sont de toute façon exclus plus bas. À compléter avec la
  * révision relevée chez l'opérateur si elle diffère. */
 const CORPS_THREE=Object.freeze({r124:Object.freeze({buffer:Object.freeze(["function ( index ) {\n\n\t\treturn this.array[ index * this.itemSize ];\n\n\t}", "function ( index ) {\n\n\t\treturn this.array[ index * this.itemSize + 1 ];\n\n\t}", "function ( index ) {\n\n\t\treturn this.array[ index * this.itemSize + 2 ];\n\n\t}"]),entrelace:Object.freeze(["function ( index ) {\n\n\t\treturn this.data.array[ index * this.data.stride + this.offset ];\n\n\t}", "function ( index ) {\n\n\t\treturn this.data.array[ index * this.data.stride + this.offset + 1 ];\n\n\t}", "function ( index ) {\n\n\t\treturn this.data.array[ index * this.data.stride + this.offset + 2 ];\n\n\t}"])}),
  /* D-303 : copie de three.js r124 propre à Potree 1.8.0 (relevé de l'opérateur sur ESV, 08/11) : même code, un cran
   * d'indentation de plus. Seuls les attributs simples ont été relevés : pas de corps entrelacé pour cette copie. */
  'r124-potree':Object.freeze({buffer:Object.freeze(["function ( index ) {\n\n\t\t\treturn this.array[ index * this.itemSize ];\n\n\t\t}", "function ( index ) {\n\n\t\t\treturn this.array[ index * this.itemSize + 1 ];\n\n\t\t}", "function ( index ) {\n\n\t\t\treturn this.array[ index * this.itemSize + 2 ];\n\n\t\t}"]),entrelace:null})});
 const refusParRaison={},FT=Function.prototype.toString,appliquer=Reflect.apply,proto=Object.getPrototypeOf,descripteur=Object.getOwnPropertyDescriptor;
 /* Fonction de la clé k de o (chaîne des prototypes) par descripteur : la fonction, undefined si la clé est absente, ou null si ce
  * n'est pas une donnée simple (propriété calculée, ou valeur qui n'est pas une fonction). */
 function fonctionDe(o,k){for(let p=o;p!==null&&p!==undefined;p=proto(p)){const d=descripteur(p,k);
  if(d)return 'value' in d&&typeof d.value==='function'?d.value:null;}return undefined;}
 const trio=p=>{if(!p)return null;const x=fonctionDe(p,'getX'),y=fonctionDe(p,'getY'),z=fonctionDe(p,'getZ');return x&&y&&z?[x,y,z]:null;};
 const texte=f=>{try{return appliquer(FT,f,[]);}catch{return null;}};
 const GENRES=['buffer','entrelace'];
 const authentique=(t,genre)=>Object.keys(CORPS_THREE).some(r=>!!CORPS_THREE[r][genre]&&CORPS_THREE[r][genre].every((c,k)=>texte(t[k])===c));
 const protosThree=T=>{try{return [T&&T.BufferAttribute&&T.BufferAttribute.prototype,T&&T.InterleavedBufferAttribute&&T.InterleavedBufferAttribute.prototype];}catch{return [null,null];}};
 const INSTANTANE_THREE=protosThree(globalThis.THREE).map((p,i)=>{const t=trio(p);return t&&authentique(t,GENRES[i])?t:null;});
 const memeTrio=(a,b)=>!!a&&!!b&&a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2];
 let COPIE_EPINGLEE=null;
 function accesseursSurs(pos){
  const x=fonctionDe(pos,'getX'),y=fonctionDe(pos,'getY'),z=fonctionDe(pos,'getZ');
  if(x===undefined&&y===undefined&&z===undefined)return true;
  if(!x||!y||!z)return false;
  const t=[x,y,z],courant=protosThree(globalThis.THREE).map(trio);
  for(let i=0;i<2;i++)if(memeTrio(t,INSTANTANE_THREE[i])&&memeTrio(courant[i],INSTANTANE_THREE[i])&&authentique(t,GENRES[i]))return true;
  /* D-303 : copie de three.js propre à Potree (absente de globalThis.THREE). Le texte authentifie la sémantique (corps sans
   * variable libre : `this.array`, `this.itemSize`) ; l'identité est tenue par ÉPINGLAGE : le premier trio authentique d'attribut
   * simple vu par cette coquille est retenu, et seul ce trio-là est reconnu ensuite (une autre copie, même au même texte, ne
   * l'est pas). L'épinglage se fait avant toute lecture et n'appelle aucun accesseur. */
  if(COPIE_EPINGLEE===null&&authentique(t,'buffer'))COPIE_EPINGLEE=t;
  return memeTrio(t,COPIE_EPINGLEE)&&authentique(t,'buffer');
 }
 const refuser=raison=>{refusParRaison[raison]=(refusParRaison[raison]||0)+1;return null;};
 /* Éligibilité ; rend le descripteur du nœud ({src, stride, offset, capacite, f64}) ou null. */
 function eligibleAvec(octetsEntree,capaciteMax){
  return function eligible(n,indexAttr,bounds,maxPoints,maxInspected,yieldEvery,drawEnd,probes){
   if(indexAttr||!n.position||n.position.isFloat16BufferAttribute)return null;
   if(!accesseursSurs(n.position))return refuser('accesseur inconnu'); // AVANT toute lecture : les sondes ci-dessous appellent l'accesseur
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
 /* instancier : seulement pour l'essai de trappe (instance factice) ; défaut : l'instance du module, sans import. */
 function noyauWasm(source,{instancier=m=>new WebAssembly.Instance(m,{}).exports}={}){
  const module=source instanceof WebAssembly.Module?source:new WebAssembly.Module(source);
  let X,buf,pE,octets,cap,F32,F64,M,E,R,S;
  function monter(){
   X=instancier(module);buf=X.memory.buffer;
   if(typeof X.lidar_version_arene!=='function'||X.lidar_version_arene()!==VERSION_ARENE)throw Error('CH-064-L : cœur LiDAR désaccordé (version d\u2019arène).');
   // La mémoire ne grandit jamais (initiale = maximale) : ces vues restent valides toute la vie de l'instance.
   pE=X.lidar_entree();octets=X.lidar_entree_octets();cap=X.lidar_capacite();
   F32=new Float32Array(buf,pE,octets/4);F64=new Float64Array(buf,pE,octets/8);
   M=new Float64Array(buf,X.lidar_matrices(),131);E=new Float64Array(buf,X.lidar_etat(),24);
   R=new Uint32Array(buf,X.lidar_retenus(),cap);S=new Float64Array(buf,X.lidar_scene(),3*cap);
  }
  monter();
  const capacite=cap,secours=noyauJs(capacite),Msauve=new Float64Array(131),Esauve=new Float64Array(24);
  let copieOctets=0,tranches=0,reprises=0;
  /* Rejoue une tranche par le noyau JS à partir de l'état sauvé avant l'appel, puis rend cet état à l'instance. */
  function rejouer(L,di,nb,limite,retour){M.set(Msauve);E.set(Esauve);secours.charger(Msauve,Esauve);
   const t=secours.tranche(L,di,nb,limite,retour);E.set(secours.etat());return t;}
  return {nom:'wasm',eligible:eligibleAvec(octets,capacite),
   debutNoeud(model,invModel,transforms,frames,bounds){ecrireMatrices(M,model,invModel,transforms,frames,bounds);E[6]=0;E[15]=0;},
   tranche(L,di,nb,limite,retour){
    const debut=di*L.stride+L.offset,lus=nb>0?(nb-1)*L.stride+3:0;
    (L.f64?F64:F32).set(L.src.subarray(debut,debut+lus));copieOctets+=lus*(L.f64?8:4);tranches++;
    E[0]=retour;Msauve.set(M);Esauve.set(E);
    let k;
    try{k=(L.f64?X.lidar_parcourir_f64:X.lidar_parcourir_f32)(nb,L.stride,di,limite)>>>0;}
    catch(e){
     if(!(e instanceof WebAssembly.RuntimeError))throw e;
     // Trappe : instance neuve, état d'avant l'appel rendu, tranche rejouée par le noyau JS (même algorithme), état recopié.
     reprises++;monter();return rejouer(L,di,nb,limite,retour);
    }
    // Tranche refusée par le noyau (code 3, garde de l'arène : n'arrive pas pour un nœud éligible) : rejouée de même.
    if(E[5]===3){reprises++;refuser('tranche refusée');return rejouer(L,di,nb,limite,retour);}
    return resultat(E,k,R,S);
   },
   proches(cible,SIDES){ecrireProches(E,cible,SIDES);},
   memoireOctets:()=>buf.byteLength,copieOctets:()=>copieOctets,tranches:()=>tranches,reprises:()=>reprises};
 }

 /* ---------- noyau JS sans allocation (même algorithme que la crate) ---------- */
 function noyauJs(cap=4096){
  const M=new Float64Array(131),E=new Float64Array(24),R=new Uint32Array(cap),S=new Float64Array(3*cap);
  const P=new Float64Array(3),Q=new Float64Array(3),T=new Float64Array(3),L0=new Float64Array(3),L1=new Float64Array(3);
  let err=0,tranches=0;
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
    let rt=retour,traites=0,nonFinis=0,g=0,d=0,k=0;err=0;tranches++;
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
   /* reprise après trappe du noyau WASM : état complet repris, puis rendu */
   charger(m,e){M.set(m);E.set(e);},etat:()=>E,
   memoireOctets:()=>0,copieOctets:()=>0,tranches:()=>tranches};
 }
 return {variante,noyauWasm,noyauJs,refus:()=>({...refusParRaison}),threeReconnu:()=>INSTANTANE_THREE.map(t=>!!t),CORPS_THREE,DEBUT,FIN};
});
