/* MODÈLE DE NAVIGATION SUPPOSÉ — CE N'EST PAS ESV (essais du chantier « déplacer la vue », fiches/DEPLACER_VUE.md).
 *
 * La maquette ESV (branche claude/esv-locale-audit) ne réagit ni à la molette ni au glisser : elle n'a aucun écouteur sur sa
 * vue en dehors du `click` de pose. Pour jouer `amenerDansLaVue`, ce script greffe sur `window.viewer` une navigation
 * orthographique de visionneuse, avec des hypothèses NOMMÉES, chacune réglable (`window.__modeleNavigation` avant le chargement) :
 *   molette        : type écouté, 'wheel' (par défaut) ou 'mousewheel' (écouteur historique seul, comme certaines visionneuses) ;
 *                    sens lu sur `wheelDeltaY` s'il existe (comme une visionneuse qui lit `wheelDelta`), sinon sur −deltaY ;
 *   facteurCran    : dézoom par cran (1,1 : 10 % de vue en plus par cran) ; zoom centré sur la vue ;
 *   gainGlisser    : 1 = le fond suit la souris pixel pour pixel (vue orthographique) ;
 *   boutonGlisser  : bouton qui fait glisser la vue (0 : gauche, comme l'opérateur le fait, D-147) ;
 *   persisteSelect : le zoom survit-il au recentrage sur un rail et au changement de cut ? (inconnu sur ESV) ;
 *   amortiImages   : la vue rejoint sa cible en N images (amortissement), 0 = tout de suite.
 * Il ne touche ni aux rails ni au réseau : il ne fait que bouger la caméra. Tout geste est compté dans `window.__navigation`. */
(function(w){'use strict';
 const o=Object.assign({molette:'wheel',facteurCran:1.1,gainGlisser:1,boutonGlisser:0,persisteSelect:true,amortiImages:0},w.__modeleNavigation||{});
 const viewer=w.viewer,canvas=viewer.renderer.domElement,camera=viewer.scene.getActiveCamera();
 const etat=w.__navigation={options:o,zoom:1,crans:0,glissers:0,evenements:{},resets:0};
 const compter=t=>{etat.evenements[t]=(etat.evenements[t]||0)+1;};
 /* Projection : le modèle multiplie l'échelle d'origine par 1/zoom. Une projection réécrite par la page (recentrage) est
  * reprise telle quelle comme nouvelle base ; avec `persisteSelect`, le zoom courant lui est réappliqué. */
 const pm=camera.projectionMatrix;let base=Array.from(pm.elements),courant=null;
 const appliquer=()=>{courant=base.slice();courant[0]=base[0]/etat.zoom;courant[5]=base[5]/etat.zoom;return courant;};
 Object.defineProperty(pm,'elements',{configurable:true,enumerable:true,get(){return courant||appliquer();},
   set(v){base=Array.from(v);etat.resets++;if(!o.persisteSelect)etat.zoom=1;appliquer();}});
 appliquer();
 /* Translation de la caméra le long de ses axes (droite, haut), en unités de scène. */
 function deplacer(dx,dy){const m=camera.matrixWorld?.elements;
   const ax=m?[m[0],m[1],m[2]]:[1,0,0],ay=m?[m[4],m[5],m[6]]:[0,1,0];
   const d=[0,1,2].map(i=>ax[i]*dx+ay[i]*dy);
   camera.position.x+=d[0];camera.position.y+=d[1];camera.position.z+=d[2];
   if(m){m[12]+=d[0];m[13]+=d[1];m[14]+=d[2];}}
 const largeurScene=()=>2/Math.abs((courant||appliquer())[0]),pxScene=()=>largeurScene()/(canvas.clientWidth||canvas.width||canvas.getBoundingClientRect().width);
 /* Amortissement : le zoom ou le déplacement se fait en N images. */
 const image=fn=>typeof w.requestAnimationFrame==='function'?w.requestAnimationFrame(fn):setTimeout(fn,16);
 function amorti(pas){const n=Math.max(0,o.amortiImages|0);if(!n){pas(1);return;}let i=0;const tour=()=>{i++;pas(1/n);if(i<n)image(tour);};image(tour);}
 canvas.addEventListener(o.molette,e=>{compter(e.type);
   const sens=Number.isFinite(e.wheelDeltaY)&&e.wheelDeltaY!==0?Math.sign(e.wheelDeltaY):-Math.sign(e.deltaY||0);if(!sens)return;
   etat.crans+=sens<0?1:-1;const f=sens<0?o.facteurCran:1/o.facteurCran;
   amorti(part=>{etat.zoom*=Math.pow(f,part);appliquer();});},{passive:true});
 let glisse=null;
 canvas.addEventListener('mousedown',e=>{compter('mousedown');if(e.button===o.boutonGlisser)glisse={x:e.clientX,y:e.clientY,bouge:false};});
 const bouger=e=>{compter('mousemove');if(!glisse)return;const masque=o.boutonGlisser===2?2:o.boutonGlisser===1?4:1;if(!(e.buttons&masque)){glisse=null;return;}
   const dx=e.clientX-glisse.x,dy=e.clientY-glisse.y;glisse.x=e.clientX;glisse.y=e.clientY;if(!dx&&!dy)return;glisse.bouge=true;
   const k=pxScene()*o.gainGlisser;amorti(part=>deplacer(-dx*k*part,dy*k*part));};
 canvas.addEventListener('mousemove',bouger);
 (w.addEventListener?w:canvas).addEventListener('mouseup',e=>{compter('mouseup');if(glisse?.bouge)etat.glissers++;glisse=null;});
})(typeof window!=='undefined'?window:globalThis);
