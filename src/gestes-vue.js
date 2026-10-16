(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeGestesVue=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* GESTES DE VUE (5.0, chantier « déplacer la vue », fiches/DEPLACER_VUE.md).
  *
  * Deux usages, un seul vocabulaire :
  *   1. ÉMETTRE, pour `amenerDansLaVue` (src/adapter-page.js, coupé par défaut : `settings.deplacerVue.actif`) : la suite
  *      d'événements qu'un navigateur Chromium produit pour un vrai tour de molette ou un vrai glisser au bouton gauche, relevée
  *      le 16 octobre 2026 sur Chromium 141 avec des gestes de confiance (`tools/releve-gestes-vue.cjs`, partie A) :
  *        molette  : [pointermove, mousemove] pour amener le pointeur, puis `wheel` par cran (deltaY ±100, deltaMode 0,
  *                   wheelDelta ∓120, buttons 0) ;
  *        glisser  : [pointermove, mousemove], pointerdown (button 0, buttons 1, pressure 0,5), mousedown (detail 1), puis
  *                   par pas [pointermove (button −1, buttons 1), mousemove (button 0, buttons 1)], pointerup (buttons 0,
  *                   pressure 0), mouseup (detail 1) ; Chromium ajoute un `click` (un PointerEvent) à la fin du glisser.
  *      Ce que le navigateur fait et qu'une page ne peut pas refaire : `isTrusted` reste faux ; le `mousewheel` historique
  *      n'est remis qu'aux événements de confiance (un écouteur `mousewheel` seul ne voit jamais un `wheel` synthétique) ;
  *      `pointerrawupdate` n'est produit que s'il a un écouteur. Le `click` final d'un glisser n'est PAS émis par défaut
  *      (`clicFinal:false`) : ESV pose le rail courant sur un clic dans la vue (D-088), et l'on ne sait pas encore pourquoi
  *      un glisser de l'opérateur ne le pose pas.
  *   2. RELEVER, pour l'Écho : les glissers et les crans de molette de l'opérateur, résumés (un événement par glisser, un par
  *      série de crans), avec la caméra avant et après. Observation pure : écouteurs passifs, rien n'est empêché ni arrêté,
  *      aucune commande. Le relevé ne garde ni position de scène ni coordonnée absolue : des pixels d'écran, des durées, des
  *      comptes, et la caméra réduite à sa taille de pixel et à son déplacement dans son propre repère (mm).
  *
  * Aucune horloge ni aucun hasard implicites : `alea`, `maintenant`, `planifier` sont donnés par l'appelant (essais
  * reproductibles). */
 const VERSION='gestes-vue-v1';
 const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
 const r3=v=>Number.isFinite(v)?Math.round(v*1000)/1000:null;
 const med=a=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),i=b.length>>1;return b.length%2?b[i]:(b[i-1]+b[i])/2;};
 /* Réglages d'émission par défaut (surchargés par `settings.deplacerVue`). Les durées et pas sont PROVISOIRES : le relevé de
  * l'Écho (glissers et crans de l'opérateur) doit les fixer avant toute activation. */
 const EMISSION=Object.freeze({
   molette:Object.freeze({deltaY:100,deltaMode:0,wheelDelta:120,intervalleMs:Object.freeze([60,140]),cransMax:8,sensDezoom:1}),
   glisser:Object.freeze({dureeMs:Object.freeze([220,420]),pasMs:16,bouton:0,clicFinal:false}),
 });
 const entre=(alea,[a,b])=>a+(b-a)*alea();

 /* ------------------------------------------------------------------ émettre */
 /* Une souris : le premier pointeur, de type « mouse ». */
 const POINTEUR={pointerId:1,pointerType:'mouse',isPrimary:true,width:1,height:1,tiltX:0,tiltY:0,twist:0,tangentialPressure:0};
 /* Descripteurs (sans DOM) : { genre: 'pointer'|'mouse'|'wheel', type, init, apresMs }. `apresMs` : attente AVANT l'événement. */
 function approche(x,y,boutons=0,dernier=null){
   const mv=dernier?{movementX:Math.round(x-dernier[0]),movementY:Math.round(y-dernier[1])}:{movementX:0,movementY:0};
   return [{genre:'pointer',type:'pointermove',init:{...POINTEUR,clientX:x,clientY:y,button:-1,buttons:boutons,pressure:boutons?.5:0,...mv},apresMs:0},
     {genre:'mouse',type:'mousemove',init:{clientX:x,clientY:y,button:0,buttons:boutons,...mv},apresMs:0}];
 }
 /* `crans` crans de molette au point (x, y) ; `sens` +1 = deltaY positif (vers soi : dézoom dans la plupart des visionneuses),
  * −1 = l'inverse. Le pointeur est d'abord amené au point (une visionneuse zoome souvent vers la dernière position connue de
  * la souris, lue sur `mousemove`). */
 function sequenceMolette({x,y,crans,sens=1,reglages=EMISSION.molette,alea=Math.random}){
   const m={...EMISSION.molette,...(reglages||{})},n=Math.max(0,Math.floor(crans)),s=sens<0?-1:1,out=[...approche(x,y)];
   for(let i=0;i<n;i++)out.push({genre:'wheel',type:'wheel',apresMs:i?Math.round(entre(alea,m.intervalleMs)):0,
     init:{clientX:x,clientY:y,button:0,buttons:0,deltaX:0,deltaY:s*m.deltaY,deltaZ:0,deltaMode:m.deltaMode,wheelDeltaX:0,wheelDeltaY:-s*m.wheelDelta}});
   return out;
 }
 /* Glisser de (x0, y0) à (x1, y1) au bouton `bouton`, en `dureeMs` (tiré dans la plage), un pas toutes les `pasMs` environ,
  * vitesse en cloche (départ et arrivée lents), positions entières. */
 function sequenceGlisser({x0,y0,x1,y1,reglages=EMISSION.glisser,alea=Math.random}){
   const g={...EMISSION.glisser,...(reglages||{})},bouton=g.bouton|0,masque=bouton===2?2:bouton===1?4:1;
   const duree=Math.max(g.pasMs*2,Math.round(Array.isArray(g.dureeMs)?entre(alea,g.dureeMs):g.dureeMs)),pas=Math.max(2,Math.round(duree/g.pasMs));
   const out=[...approche(x0,y0)];
   out.push({genre:'pointer',type:'pointerdown',init:{...POINTEUR,clientX:x0,clientY:y0,button:bouton,buttons:masque,pressure:.5},apresMs:Math.round(entre(alea,[40,90]))});
   out.push({genre:'mouse',type:'mousedown',init:{clientX:x0,clientY:y0,button:bouton,buttons:masque,detail:1},apresMs:0});
   let prec=[x0,y0];
   for(let i=1;i<=pas;i++){const t=i/pas,f=(1-Math.cos(Math.PI*t))/2,x=Math.round(x0+(x1-x0)*f),y=Math.round(y0+(y1-y0)*f);
     if(i<pas&&x===prec[0]&&y===prec[1])continue;
     const a=approche(x,y,masque,prec);a[0].apresMs=Math.max(1,Math.round(g.pasMs*(0.75+0.5*alea())));out.push(...a);prec=[x,y];}
   out.push({genre:'pointer',type:'pointerup',init:{...POINTEUR,clientX:x1,clientY:y1,button:bouton,buttons:0,pressure:0},apresMs:Math.round(entre(alea,[30,80]))});
   out.push({genre:'mouse',type:'mouseup',init:{clientX:x1,clientY:y1,button:bouton,buttons:0,detail:1},apresMs:0});
   if(g.clicFinal&&bouton===0)out.push({genre:'pointer',type:'click',init:{...POINTEUR,clientX:x1,clientY:y1,button:0,buttons:0,pressure:0,detail:1},apresMs:0});
   return out;
 }
 /* Construit l'événement DOM d'un descripteur (constructeurs de la page). Les champs d'écran suivent le client. */
 function construire(d,w){
   const ecran={screenX:d.init.clientX+(Number(w.screenX)||0),screenY:d.init.clientY+(Number(w.screenY)||0)};
   const init={bubbles:true,cancelable:d.type!=='pointerenter'&&d.type!=='mouseenter',composed:true,view:w,...ecran,...d.init};
   const Ctor=d.genre==='wheel'?w.WheelEvent:d.genre==='pointer'?(w.PointerEvent||w.MouseEvent):w.MouseEvent;
   return new Ctor(d.type,init);
 }
 /* Émet la suite sur `cible`, en respectant les attentes. `attendre(ms)` rend une promesse ; `garde()` est appelée avant chaque
  * événement (annulation, cut changé) et peut lever. Rend le nombre d'événements émis et leurs types. */
 async function emettre(cible,seq,{fenetre,attendre,garde=()=>{}}){
   const types=[];
   for(const d of seq){if(d.apresMs>0)await attendre(d.apresMs);garde();cible.dispatchEvent(construire(d,fenetre));types.push(d.type);}
   return {evenements:types.length,types};
 }

 /* ------------------------------------------------------------------ caméra */
 /* Taille du pixel (mm) d'une caméra orthographique lue par `cameraSnapshot`. */
 const pixelMm=cam=>cam?.viewport?.width&&Array.isArray(cam.projection)&&cam.projection[0]?2/Math.abs(cam.projection[0])/cam.viewport.width*1000:NaN;
 /* Caméra réduite pour un relevé : taille du pixel et vue (px). Jamais de position. */
 const resumeCamera=cam=>cam?{mmPx:r3(pixelMm(cam)),vue:cam.viewport?[Math.round(cam.viewport.width),Math.round(cam.viewport.height)]:null}:null;
 /* De `avant` à `apres` : déplacement de la caméra dans le repère de `avant` (droite, haut, profondeur ; mm) et zoom (> 1 : dézoom). */
 function ecartCamera(avant,apres){
   if(!avant?.cameraToSceneRelative||!apres?.cameraToSceneRelative)return null;
   const A=avant.cameraToSceneRelative,B=apres.cameraToSceneRelative,d=[12,13,14].map(i=>B[i]-A[i]);
   const axe=k=>{const v=[A[4*k],A[4*k+1],A[4*k+2]],n=Math.hypot(...v)||1;return (d[0]*v[0]+d[1]*v[1]+d[2]*v[2])/n*1000;};
   const pa=pixelMm(avant),pb=pixelMm(apres);
   return {deplacementMm:[r1(axe(0)),r1(axe(1)),r1(axe(2))],zoom:Number.isFinite(pa)&&Number.isFinite(pb)&&pa>0?r3(pb/pa):null};
 }
 const memeCamera=(a,b)=>!!a&&!!b&&Array.isArray(a.cameraToSceneRelative)&&Array.isArray(b.cameraToSceneRelative)
   &&a.cameraToSceneRelative.every((v,i)=>Math.abs(v-b.cameraToSceneRelative[i])<=1e-9)&&a.projection.every((v,i)=>Math.abs(v-b.projection[i])<=1e-12);

 /* ------------------------------------------------------------------ ce qu'il faut */
 /* La cible projetée en NDC `ndc` ([x, y]) : facteur de dézoom pour la ramener dans la marge, et glissement en pixels. */
 function besoin(ndc,viewport,marge=.99){
   const ax=Math.abs(ndc[0]),ay=Math.abs(ndc[1]);
   const exX=Math.max(0,ax-marge),exY=Math.max(0,ay-marge);
   return {dans:ax<=marge&&ay<=marge,dezoom:Math.max(1,Math.max(ax,ay)/marge),panPx:Math.max(exX*viewport.width/2,exY*viewport.height/2)};
 }

 /* ------------------------------------------------------------------ relever (Écho) */
 /* Agrégateur des gestes de l'opérateur. `evenement(e)` reçoit les événements DOM de confiance (pointerdown, pointermove,
  * pointerup, pointercancel, click, auxclick, contextmenu, wheel) ; `lireCamera()` rend la caméra (ou null) ; `emettre(resume)`
  * reçoit un résumé ; `planifier(fn, ms)` diffère ; `maintenant()` en ms. `estVue(cible)` : la cible est la vue d'ESV.
  * Le glisser n'est résumé que s'il a bougé (≥ `seuilPx`) ou s'il n'est pas au bouton gauche : un simple clic de pose est déjà
  * consigné par l'Écho. La caméra « après » est lue quand elle est immobile (`lecturesStables` lectures égales à `sondageMs`),
  * au plus `stabiliteMaxMs` après le geste. */
 const RELEVE=Object.freeze({seuilPx:3,serieMs:400,sondageMs:80,lecturesStables:3,stabiliteMaxMs:1500});
 class Releveur{
   constructor({lireCamera,emettre,planifier,maintenant,estVue,reglages={}}){
     Object.assign(this,{lireCamera,emettreResume:emettre,planifier,maintenant,estVue});this.r={...RELEVE,...reglages};
     this.glisser=null;this.molette=null;this.fin=null;this.compte={glissers:0,molettes:0,ignores:0};
   }
   camera(){try{return this.lireCamera()||null;}catch{return null;}}
   evenement(e){
     if(!e||e.isTrusted===false)return;
     try{
       const t=this.maintenant(),type=e.type;
       if(type==='pointerdown'){if(!this.estVue(e.target))return;
         this.glisser={t0:t,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,id:e.pointerId,type:e.pointerType||null,bouton:e.button,boutons:e.buttons,pas:0,longueur:0,
           clic:false,auxclic:false,menu:false,camAvant:this.camera()};return;}
       if(type==='pointermove'){const g=this.glisser;if(!g||g.t1!=null||(g.id!=null&&e.pointerId!==g.id))return;
         g.pas++;g.longueur+=Math.hypot(e.clientX-g.x,e.clientY-g.y);g.x=e.clientX;g.y=e.clientY;return;}
       if(type==='pointerup'||type==='pointercancel'){const g=this.glisser;if(!g||g.t1!=null||(g.id!=null&&e.pointerId!==g.id))return;
         g.t1=t;g.annule=type==='pointercancel';g.x=e.clientX??g.x;g.y=e.clientY??g.y;g.horsVue=!this.estVue(e.target);
         this.planifier(()=>this.finirGlisser(g),0);return;}
       if(type==='click'||type==='auxclick'){const g=this.glisser;if(g&&g.t1!=null&&t-g.t1<=50){if(type==='click')g.clic=true;else g.auxclic=true;}return;}
       if(type==='contextmenu'){const g=this.glisser;if(g)g.menu=true;return;}
       if(type==='wheel'){if(!this.estVue(e.target))return;
         let m=this.molette;
         if(!m||t-m.dernier>this.r.serieMs){if(m)this.finirMolette(m);m=this.molette={t0:t,dernier:t,crans:0,somme:0,deltas:[],intervalles:[],mode:e.deltaMode,
           deltaX:0,camAvant:this.camera(),x:e.clientX,y:e.clientY,legacy:Number.isFinite(e.wheelDeltaY)?e.wheelDeltaY:null};}
         else m.intervalles.push(t-m.dernier);
         m.crans++;m.somme+=e.deltaY||0;m.deltaX+=e.deltaX||0;if(m.deltas.length<4)m.deltas.push(e.deltaY);m.dernier=t;
         const garde=m;this.planifier(()=>{if(this.molette===garde&&this.maintenant()-garde.dernier>=this.r.serieMs)this.finirMolette(garde);},this.r.serieMs+5);return;}
     }catch{this.compte.ignores++;}
   }
   /* Caméra immobile, puis résumé. */
   apres(debut,suite){let prec=null,stables=0;const t0=this.maintenant();
     const tour=()=>{const c=this.camera(),cle=c?JSON.stringify([c.cameraToSceneRelative,c.projection]):null;
       stables=cle!==null&&cle===prec?stables+1:0;prec=cle;
       if(stables>=this.r.lecturesStables-1||this.maintenant()-t0>=this.r.stabiliteMaxMs){suite(c,stables>=this.r.lecturesStables-1);return;}
       this.planifier(tour,this.r.sondageMs);};
     this.planifier(tour,debut);}
   finirGlisser(g){if(this.glisser===g)this.glisser=null;
     const net=Math.hypot(g.x-g.x0,g.y-g.y0);
     if(g.bouton===0&&net<this.r.seuilPx&&g.longueur<this.r.seuilPx)return;   // un clic, déjà consigné
     this.apres(this.r.sondageMs,(cam,stable)=>{this.compte.glissers++;
       this.emettreResume({version:VERSION,type:'glisser',bouton:g.bouton,boutons:g.boutons,pointeur:g.type,dxPx:r1(g.x-g.x0),dyPx:r1(g.y-g.y0),distancePx:r1(net),
         longueurPx:r1(g.longueur),pas:g.pas,dureeMs:Math.round(g.t1-g.t0),clic:g.clic,auxclic:g.auxclic,menuContextuel:g.menu,annule:!!g.annule,finHorsVue:!!g.horsVue,
         camera:{avant:resumeCamera(g.camAvant),apres:resumeCamera(cam),stable,...(ecartCamera(g.camAvant,cam)||{})},debutMs:g.t0});});}
   finirMolette(m){if(this.molette===m)this.molette=null;if(m.fini)return;m.fini=true;
     this.apres(0,(cam,stable)=>{this.compte.molettes++;
       this.emettreResume({version:VERSION,type:'molette',crans:m.crans,sens:Math.sign(m.somme),deltaY:m.deltas,deltaMode:m.mode,sommeDeltaY:r1(m.somme),
         deltaX:r1(m.deltaX),wheelDeltaY:m.legacy,dureeMs:Math.round(m.dernier-m.t0),intervalleMs:r1(med(m.intervalles)),
         camera:{avant:resumeCamera(m.camAvant),apres:resumeCamera(cam),stable,...(ecartCamera(m.camAvant,cam)||{})},debutMs:m.t0});});}
 }
 /* Types écoutés par le relevé (fenêtre, phase de capture, passifs). */
 const TYPES_RELEVE=Object.freeze(['pointerdown','pointermove','pointerup','pointercancel','click','auxclick','contextmenu','wheel']);

 return {VERSION,EMISSION,RELEVE,TYPES_RELEVE,POINTEUR,approche,sequenceMolette,sequenceGlisser,construire,emettre,pixelMm,resumeCamera,ecartCamera,memeCamera,besoin,Releveur};
});
