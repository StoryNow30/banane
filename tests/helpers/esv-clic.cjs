'use strict';
/* D-157 — ESV simulé pour les CLICS DE POSE, au plus près du banc ESV local (D-088) et des lots réels :
 *  - le bouton d'un rail fixe le côté et sa classe tout de suite ; la caméra ne suit qu'à l'image suivante (16 ms) ;
 *  - la vue d'un rail est orthographique, ±0,2 unité de scène (projection 5,0), sur un canevas placé comme celui d'ESV
 *    (left 1057,6, top 73,6, 1042 × 944 px) dans une fenêtre de 2 133 × 1 080 px ;
 *  - le clic sur le canevas pose le rail du côté COURANT au point où le rayon de la caméra ACTIVE coupe le plan de coupe
 *    (plan du profil, normale = axe x du profil), sans vérifier que ce point est dans la vue ;
 *  - Chromium arrondit `clientX` et `clientY` d'un MouseEvent synthétique à l'entier inférieur (relevé dans Chromium 141,
 *    enquête D-157) ; ESV calcule son rayon à partir de ces entiers et du rectangle du canevas.
 * Le code de page d'Ariane (src/adapter-page.js, ou un autre fichier donné : le code de base pour les empreintes) tourne
 * dans un contexte isolé, piloté par messages comme dans ESV. Tout ce que la page fait à ESV est consigné dans `journal`
 * (boutons pressés, événements envoyés au canevas, dans l'ordre) : c'est la trace qu'on compare octet pour octet.
 * Deux horloges : « virtuelle » (essais : une minuterie avance l'horloge quand elle échoit) et « reelle » (banc : vraies
 * minuteries, durées multipliées par `echelle`). Données synthétiques ou caméras des lots ; aucune adresse d'ESV. */
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('../../vendor/capture-core.js'),K=require('../../src/core.js'),F=require('../v242/fixtures.cjs');
const RACINE=path.resolve(__dirname,'../..');
const VIEWPORT=Object.freeze({left:1057.5999755859375,top:73.5999984741211,width:1042,height:944});
const FENETRE=Object.freeze({largeur:2133,hauteur:1080});
const PROJECTION=Object.freeze([5,0,0,0, 0,5*1042/944,0,0, 0,0,-1e-4,0, 0,0,0,1]);
const ORIGINE='https://banc.invalid';
const norme=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
const point3=m=>[m[12],m[13],m[14]];

/* Géométrie synthétique d'un cut, comme les lots : profil x = normale du plan de coupe (le long de la voie), y = latéral
 * (vers le rail gauche), z = haut ; caméra regardant le long de la voie, l'écran à droite = côté du rail droit. */
function geometrie({ecart=1.5,devers=0}={}){
  const X=[0,-1,0],Y=[1,0,0],Z=[0,0,1];
  const rail=(x,z)=>[...X,0,...Y,0,...Z,0,x,0,z,1];
  const rails={left:rail(ecart/2,devers/2),right:rail(-ecart/2,-devers/2)};
  const vue=m=>{const p=point3(m);return [-1,0,0,0, 0,0,1,0, 0,1,0,0, p[0],p[1]+.2,p[2],1];};
  return {rails:{left:{rail:rails.left,profil:rails.left},right:{rail:rails.right,profil:rails.right}},vues:{left:vue(rails.left),right:vue(rails.right)}};
}
/* Un cut tiré « rapide » ou « référence » par le réglage « echantillon » (même hachage que src/adapter-page.js). */
function cutDuMode(mode,depuis=100){for(let c=depuis;;c++){const h=Math.imul(c>>>0,2654435761)>>>0;if((h<429496730?'reference':'rapide')===mode)return c;}}

function horlogeVirtuelle(){
  const minuteries=new Map();let numero=0,maintenant=0,prevu=false,image=()=>{};let prochaine=16;
  const tourner=()=>{prevu=false;if(!minuteries.size)return;
    const [id,m]=[...minuteries].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];minuteries.delete(id);
    if(m.at>maintenant)maintenant=m.at;while(prochaine<=maintenant){image();prochaine+=16;}m.fn();planifier();};
  const planifier=()=>{if(!prevu){prevu=true;setImmediate(tourner);}};
  return {maintenant:()=>maintenant,surImage:f=>{image=f;},
    setTimeout:(fn,ms=0)=>{const id=++numero;minuteries.set(id,{at:maintenant+Math.max(0,Number(ms)||0),fn});planifier();return id;},
    clearTimeout:id=>{minuteries.delete(id);},
    /* l'image suivante d'ESV : la caméra suit le bouton du rail */
    aImage:fn=>{const id=++numero;minuteries.set(id,{at:prochaine>maintenant?prochaine:maintenant+16,fn});planifier();return id;}};
}
function horlogeReelle(echelle=1){
  const t0=performance.now();const ids=new Map();let numero=0;
  return {maintenant:()=>(performance.now()-t0)/echelle,surImage:()=>{},
    setTimeout:(fn,ms=0)=>{const id=++numero;ids.set(id,setTimeout(()=>{ids.delete(id);fn();},Math.max(0,Number(ms)||0)*echelle));return id;},
    clearTimeout:id=>{const t=ids.get(id);if(t!==undefined){clearTimeout(t);ids.delete(id);}},
    aImage:fn=>{const id=++numero;ids.set(id,setTimeout(()=>{ids.delete(id);fn();},16*echelle));return id;}};
}

/* Un rail d'ESV : objet (avec un maillage) → profil → contour (ligne). Matrices locales explicites (`matrixAutoUpdate=false`). */
function objetRail(cote){
  const o=F.object([0,0,0],'Object3D'),mesh=F.object([0,0,0],'Mesh'),profil=F.object([0,0,0],'Object3D'),ligne=F.object([0,0,0],'Line');
  F.add(o,mesh);F.add(o,profil);F.add(profil,ligne);
  const s=cote==='left'?1:-1;ligne.geometry={attributes:{position:F.buffer([[0,0,0],[0,s*.035,0],[0,s*.035,-.05]])}};
  for(const x of [o,profil])x.matrixAutoUpdate=false;
  o.matrix={elements:C.identity()};profil.matrix={elements:C.identity()};return {o,profil};
}

function esvClic({adapter=path.join(RACINE,'src/adapter-page.js'),pilote={},reglages=null,horloge='virtuelle',echelle=1,viewport=VIEWPORT,fenetre=FENETRE}={}){
  const S=reglages||require('../../src/settings.js');
  const H=horloge==='reelle'?horlogeReelle(echelle):horlogeVirtuelle();
  const root=F.object([0,0,0],'Scene'),rails={left:objetRail('left'),right:objetRail('right')};F.add(root,rails.left.o);F.add(root,rails.right.o);
  const camera=F.object([0,0,0],'OrthographicCamera');camera.matrixAutoUpdate=false;camera.matrix={elements:C.identity()};camera.projectionMatrix={elements:[...PROJECTION]};
  const nodes=new Map(),journal=[],progress=[],releves=[],horsVue=[],autres=[],reponses=[],ecouteurs=[],attente=new Map();
  let cote='right',vues={left:null,right:null},depart={left:null,right:null},enAttente=[],decalage={},classeFigee={},vp={...viewport};
  const monde=s=>C.multiply(rails[s].o.matrix.elements,rails[s].profil.matrix.elements);
  const position=s=>point3(rails[s].o.matrix.elements);
  /* La vue d'un rail suit le rail : la caméra de la capture, translatée du déplacement du rail depuis la capture. */
  const vueDe=s=>{const m=vues[s].slice(),p=position(s),d=depart[s].map((v,i)=>p[i]-v);for(let i=0;i<3;i++)m[12+i]+=d[i];return m;};
  const suivre=()=>{for(const a of enAttente.splice(0))a();};H.surImage(suivre);
  const canvas={getBoundingClientRect:()=>({...vp,right:vp.left+vp.width,bottom:vp.top+vp.height,x:vp.left,y:vp.top}),
    dispatchEvent:e=>{journal.push({quoi:'canevas',type:e.type,clientX:e.clientX,clientY:e.clientY,button:e.button,buttons:e.buttons,bubbles:e.bubbles,cancelable:e.cancelable,cote});
      if(e.type!=='click')return true;
      /* Chromium : entier inférieur ; ESV : rayon depuis le rectangle du canevas et la caméra ACTIVE. */
      const cx=Math.floor(e.clientX),cy=Math.floor(e.clientY),nx=(cx-vp.left)/vp.width*2-1,ny=1-(cy-vp.top)/vp.height*2;
      const W=camera.matrix.elements,inv=C.inverse(camera.projectionMatrix.elements);
      const a=C.point(W,C.point(inv,[nx,ny,-1])),b=C.point(W,C.point(inv,[nx,ny,1]));
      const P=monde(cote),n=norme(P.slice(0,3)),p0=position(cote);
      const t=n.reduce((s,v,i)=>s+v*(p0[i]-a[i]),0)/n.reduce((s,v,i)=>s+v*(b[i]-a[i]),0);
      /* ESV qui pose de travers (`decalageEsv` : {d:[x,y,z], fois:n}) : essai des reprises décalées. */
      const dec=decalage[cote]&&decalage[cote].fois>0?(decalage[cote].fois--,decalage[cote].d):[0,0,0];
      const X=a.map((v,i)=>v+t*(b[i]-v)).map((v,i)=>v+dec[i]);
      rails[cote].o.matrix={elements:C.multiply(C.translation(X.map((v,i)=>v-p0[i])),rails[cote].o.matrix.elements)};return true;}};
  for(const [id,text] of [['O2N3DCutDescription','Cut 100 of part 23'],['O2N3DCutShapeInfo','U50']])nodes.set(id,{textContent:text});
  for(const [id,side,classe] of [['O2N3DCutLRClick','left','leftRailSClass'],['O2N3DCutRRClick','right','rightRailSClass']])
    nodes.set(id,{classList:{contains:c=>!classeFigee[side]&&c===classe&&cote===side},
      click(){journal.push({quoi:'bouton',id});cote=side;const s=side;enAttente.push(()=>{if(vues[s])camera.matrix={elements:vueDe(s)};});H.aImage(suivre);}});
  const pil={...S.pilote,...pilote,rapide:{...S.pilote.rapide,...(pilote.rapide||{})}};
  const ctx={console,window:null,location:{origin:ORIGINE},innerWidth:fenetre?.largeur,innerHeight:fenetre?.hauteur,
    document:{getElementById:id=>nodes.get(id),dispatchEvent:()=>true},
    BananeCaptureCore:C,BananeCore3:K,BananeSettings:{...S,pilote:pil},BananeLodSignature:require('../../src/lod-signature.js'),BananeLidar:{...require('../../vendor/lidar.js')},
    BananeNativeLidar4:require('../../src/native-lidar.js'),BananeMerge3:require('../../src/merge-clouds.js'),
    viewer:{scene:{scene:root,pointclouds:[],getActiveCamera:()=>camera},renderer:{domElement:canvas}},
    Date:class extends Date{static now(){return Math.round(H.maintenant()*1000)/1000;}},setTimeout:H.setTimeout,clearTimeout:H.clearTimeout,
    requestAnimationFrame:fn=>H.aImage(fn),Potree:{framenumber:0,numNodesLoading:0},
    MouseEvent:class{constructor(type,args){this.type=type;Object.assign(this,args);}},KeyboardEvent:class{constructor(type,args){this.type=type;Object.assign(this,args);}},
    __ARIANE_PROPRIETAIRE:{id:'test',version:K.VERSION},
    addEventListener:(event,fn)=>{if(event==='message')ecouteurs.push(fn);},
    postMessage:m=>{if(m.kind==='banane3:progress')progress.push(m);else if(m.kind==='banane3:releve')releves.push(m);
      else if(m.kind==='banane3:clic-hors-vue')horsVue.push(m);else if(m.kind==='banane3:result'){reponses.push(m);attente.get(m.id)?.(m);attente.delete(m.id);}else autres.push(m);},
    crypto:{randomUUID:K.uid}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(adapter,'utf8'),ctx,{filename:path.basename(adapter)});
  function call(action,...args){const id=K.uid();return new Promise((resolve,reject)=>{attente.set(id,m=>m.error?reject(Error(m.error)):resolve(m.result));
    const data={kind:'banane3:command',channel:'fixture',proprietaire:'test',id,action,args};
    for(const f of ecouteurs)f({source:vm.runInContext('window',ctx),origin:ORIGINE,data});});}
  /* Place un cut : rails (matrices monde de l'objet et du profil), vues de chaque rail (caméras de la capture), vue active. */
  function poser({part=23,cut=100,rails:r,vues:v,active='right',projection=null,vp:vp2=null,decalageEsv={},figee={}}){
    nodes.get('O2N3DCutDescription').textContent=`Cut ${cut} of part ${part}`;
    for(const s of ['left','right']){rails[s].o.matrix={elements:[...r[s].rail]};rails[s].profil.matrix={elements:C.multiply(C.inverse(r[s].rail),r[s].profil)};}
    vues={left:[...v.left],right:[...v.right]};depart={left:position('left'),right:position('right')};
    if(projection)camera.projectionMatrix={elements:[...projection]};if(vp2)vp={...vp2};
    enAttente=[];cote=active;camera.matrix={elements:[...vues[active]]};decalage=JSON.parse(JSON.stringify(decalageEsv));classeFigee=figee;}
  return {ctx,call,poser,journal,progress,releves,horsVue,autres,reponses,nodes,camera,
    position,cote:()=>cote,clock:()=>H.maintenant(),vue:()=>({...vp}),
    /* NDC d'un point de scène (repère monde) dans une caméra donnée (repère monde). */
    ndc:(m,p)=>C.point(C.multiply(camera.projectionMatrix.elements,C.inverse(m)),p)};
}

/* ------------------------------------------------------------------ scénarios partagés (empreinte du code de base, essais) */
const PROPOSITIONS={left:{delta:[0,.012,.003]},right:{delta:[0,-.01,.004]}};
/* Chaque scénario : un cut, sa vue active, ses propositions, et ce qu'ESV fait de particulier. */
const SCENARIOS={
  'rapide-vue-droite':{mode:'rapide'},
  'rapide-vue-gauche':{mode:'rapide',active:'left'},
  'reference':{mode:'reference'},
  /* ESV prend le côté, mais la classe de son bouton ne le dit pas (témoin illisible) : pose avec recentrage. */
  'rapide-classe-figee-gauche':{mode:'rapide',figee:{left:true}},
  'rapide-esv-decale-une-fois':{mode:'rapide',decalageEsv:{left:{d:[0,0,.003],fois:1}}},
  /* Cible droite à NDC x ≈ 0,995 de sa propre vue (entre la marge de 0,99 et le bord) : le lot l'aurait différée (KI-051). */
  'rapide-cible-droite-au-bord':{mode:'rapide',propositions:{left:PROPOSITIONS.left,right:{delta:[0,-.199,.004]}}},
  /* Fenêtre plus étroite que le canevas : la partie droite du canevas sort de la fenêtre. */
  'rapide-fenetre-etroite':{mode:'rapide',fenetre:{largeur:1600,hauteur:1080},propositions:{left:PROPOSITIONS.left,right:{delta:[0,-.06,.004]}}},
  'reference-cible-gauche-au-bord':{mode:'reference',propositions:{left:{delta:[0,.199,.003]},right:PROPOSITIONS.right}},
  'rapide-puis-restauration':{mode:'rapide',restaurer:true},
};
const r9=v=>Math.round(v*1e9)/1e9;
/* Joue un scénario : la trace envoyée à ESV, les étapes, les poses finales, la durée (horloge virtuelle) et l'erreur.
 * `options` (test 6) : troisième argument de `apply`, comme le service worker l'envoie pour un lot (`{clicHumain}`). */
async function jouer(nom,{adapter,pilote={},options}={}){
  const sc=SCENARIOS[nom],G=geometrie(),f=esvClic({adapter,pilote,fenetre:sc.fenetre||FENETRE}),cut=cutDuMode(sc.mode);
  f.poser({cut,rails:G.rails,vues:G.vues,active:sc.active||'right',decalageEsv:sc.decalageEsv||{},figee:sc.figee||{}});
  const before=await f.call('state'),propositions=sc.propositions||PROPOSITIONS,cible=K.expectedPoses(before,propositions);
  const t0=f.clock();let erreur=null;
  try{await f.call('apply',before,propositions,...(options===undefined?[]:[options]));}catch(e){erreur=e.message;}
  const dureeMs=f.clock()-t0;
  if(sc.restaurer&&!erreur)try{await f.call('restore',before);}catch(e){erreur='restauration : '+e.message;}
  await new Promise(r=>setImmediate(r));
  const fin=await f.call('state');
  return {cut,journal:JSON.parse(JSON.stringify(f.journal)),
    etapes:f.progress.map(p=>[p.stage,JSON.parse(JSON.stringify(p.detail||{}))]),
    positions:Object.fromEntries(['left','right'].map(s=>[s,fin.rails[s].positionSceneRelative.map(r9)])),
    ecartCibleMm:Object.fromEntries(['left','right'].map(s=>[s,r9(C.distance(fin.rails[s].positionSceneRelative,cible[s].positionSceneRelative)*1000)])),
    dureeMs,erreur,horsVue:JSON.parse(JSON.stringify(f.horsVue)),vue:f.vue(),fenetre:sc.fenetre||FENETRE};
}
/* Un clic du journal est-il dans la partie visible du canevas (marge de 0,99 en NDC, et dans la fenêtre) ? */
function clicVisible(c,vue=VIEWPORT,fenetre=FENETRE,marge=.99){
  const nx=(c.clientX-vue.left)/vue.width*2-1,ny=1-(c.clientY-vue.top)/vue.height*2;
  return Math.abs(nx)<=marge&&Math.abs(ny)<=marge&&c.clientX>=0&&c.clientY>=0&&c.clientX<fenetre.largeur&&c.clientY<fenetre.hauteur;}
module.exports={esvClic,geometrie,cutDuMode,VIEWPORT,FENETRE,PROJECTION,PROPOSITIONS,SCENARIOS,jouer,clicVisible};
