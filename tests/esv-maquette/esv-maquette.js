/* esv-maquette.js — page qui IMITE le contrat qu'Ariane lit dans ESV (voir
 * fiches/AUDIT_ESV_LOCALE.md § 1 et tests/esv-maquette/README.md). Aucun code
 * ni contenu d'ESV : seuls les identifiants DOM et les formes d'objets que le
 * code de page d'Ariane lit sont reproduits. Tout ce qui est « hypothèse » est
 * marqué dans le README et dans le journal de la page.
 *
 * Objets fournis : window.viewer {scene:{scene, pointclouds, getActiveCamera},
 * renderer:{domElement}}, window.Potree {ClipTask, ClipMethod, numNodesLoading}.
 * Lecture de l'état par les essais : window.__maquette. */
(()=>{'use strict';
 /* ---------- petite algèbre (colonnes, comme three.js) ---------- */
 const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 const mul=(a,b)=>{const c=Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c;};
 const pt=(m,p)=>{const w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];return [(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w,(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w,(m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14])/w];};
 const tr=p=>{const m=I();m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;};
 function inv(m){const r=[0,1,2,3].map(i=>[m[i],m[4+i],m[8+i],m[12+i],...[0,1,2,3].map(j=>i===j?1:0)]);
  for(let c=0;c<4;c++){let p=c;for(let i=c+1;i<4;i++)if(Math.abs(r[i][c])>Math.abs(r[p][c]))p=i;[r[c],r[p]]=[r[p],r[c]];const d=r[c][c];if(!d)throw Error('matrice singulière');
   for(let j=0;j<8;j++)r[c][j]/=d;for(let i=0;i<4;i++)if(i!==c){const v=r[i][c];for(let j=0;j<8;j++)r[i][j]-=v*r[c][j];}}
  const o=Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)o[j*4+i]=r[i][4+j];return o;}
 function compose(o){const {x,y,z,w}=o.quaternion,p=o.position,s=o.scale;const xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
  return [(1-2*(yy+zz))*s.x,2*(xy+wz)*s.x,2*(xz-wy)*s.x,0, 2*(xy-wz)*s.y,(1-2*(xx+zz))*s.y,2*(yz+wx)*s.y,0, 2*(xz+wy)*s.z,2*(yz-wx)*s.z,(1-2*(xx+yy))*s.z,0, p.x,p.y,p.z,1];}
 function quatColonnes(X,Y,Z){const R=(l,c)=>[X,Y,Z][c][l],t=R(0,0)+R(1,1)+R(2,2);
  if(t>0){const s=Math.sqrt(t+1)*2;return {x:(R(2,1)-R(1,2))/s,y:(R(0,2)-R(2,0))/s,z:(R(1,0)-R(0,1))/s,w:.25*s};}
  if(R(0,0)>R(1,1)&&R(0,0)>R(2,2)){const s=Math.sqrt(1+R(0,0)-R(1,1)-R(2,2))*2;return {x:.25*s,y:(R(0,1)+R(1,0))/s,z:(R(0,2)+R(2,0))/s,w:(R(2,1)-R(1,2))/s};}
  if(R(1,1)>R(2,2)){const s=Math.sqrt(1+R(1,1)-R(0,0)-R(2,2))*2;return {x:(R(0,1)+R(1,0))/s,y:.25*s,z:(R(1,2)+R(2,1))/s,w:(R(0,2)-R(2,0))/s};}
  const s=Math.sqrt(1+R(2,2)-R(0,0)-R(1,1))*2;return {x:(R(0,2)+R(2,0))/s,y:(R(1,2)+R(2,1))/s,z:.25*s,w:(R(1,0)-R(0,1))/s};}
 const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 /* ---------- objets de scène (forme three.js, matrices tenues à jour) ---------- */
 function objet(type,pose={}){const o={type,visible:true,position:{x:0,y:0,z:0},quaternion:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1},rotation:{x:0,y:0,z:0,order:'XYZ'},
   matrixAutoUpdate:true,children:[],parent:null,matrixWorld:{elements:I()}};poser(o,pose);return o;}
 function poser(o,pose){if(pose.position)Object.assign(o.position,{x:pose.position[0],y:pose.position[1],z:pose.position[2]});
  if(pose.quaternion)Object.assign(o.quaternion,{x:pose.quaternion[0],y:pose.quaternion[1],z:pose.quaternion[2],w:pose.quaternion[3]});
  if(pose.scale)Object.assign(o.scale,{x:pose.scale[0],y:pose.scale[1],z:pose.scale[2]});
  if(pose.rotation)Object.assign(o.rotation,{x:pose.rotation[0],y:pose.rotation[1],z:pose.rotation[2],order:pose.rotation[3]||'XYZ'});}
 function ajouter(parent,enfant){parent.children.push(enfant);enfant.parent=parent;return enfant;}
 function majMonde(o){o.matrixWorld.elements=o.parent?mul(o.parent.matrixWorld.elements,compose(o)):compose(o);for(const c of o.children)majMonde(c);}
 const tampon=(rows,Type=Float32Array,itemSize=3)=>({array:Type.from(rows),itemSize,count:rows.length/itemSize,version:0,normalized:false});
 /* ---------- options ---------- */
 const q=new URLSearchParams(location.search),num=(k,d)=>{const v=Number(q.get(k));return q.has(k)&&Number.isFinite(v)?v:d;};
 const options={cuts:num('cuts',12),debut:num('debut',100),part:num('part',23),cut:num('cut',NaN),latence:num('latence',40),lots:num('lots',4),
   latenceRails:num('latenceRails',60),decoupeTardive:num('decoupeTardive',1)===1,distanceCamera:10};
 const $=id=>document.getElementById(id);
 const journal=[],log=(type,detail={})=>{const e={at:new Date().toISOString(),type,...detail};journal.push(e);
   const el=$('journal');if(el){el.textContent=journal.slice(-40).map(x=>`${x.at.slice(11,23)} ${x.type} ${JSON.stringify({...x,at:undefined,type:undefined})}`).join('\n');el.scrollTop=el.scrollHeight;}};
 /* ---------- état ---------- */
 const etat={scenario:null,partie:null,index:-1,side:null,chargements:0,minuteries:[],listes:new Map(),ecritures:0};
 const root=objet('Scene'),camera=objet('OrthographicCamera');camera.projectionMatrix={elements:I()};
 const pc=objet('PointCloudOctree');pc.visibleNodes=[];pc.material={clipBoxes:[],clipTask:2,clipMethod:0};ajouter(root,pc);
 for(const [i,p] of [[0,[0,0,0]],[1,[1.5,0,0]]].entries()){const m=objet('Mesh',{position:p});m.geometry={type:'SphereGeometry',parameters:{radius:.0015}};m.material={color:{getHex:()=>[16302520,10606282][i]}};ajouter(root,m);}
 majMonde(root);
 const canvas=$('maquette-vue');
 window.Potree={ClipTask:{NONE:0,HIGHLIGHT:1,SHOW_INSIDE:2,SHOW_OUTSIDE:3},ClipMethod:{INSIDE_ANY:0,INSIDE_ALL:1},numNodesLoading:0};
 window.viewer={scene:{scene:root,pointclouds:[pc],getActiveCamera:()=>camera},renderer:{domElement:canvas}};
 const rails={left:null,right:null};
 const cutCourant=()=>etat.partie?.cuts[etat.index]||null;
 /* ---------- caméra ---------- */
 function projection(){const w=canvas.clientWidth||canvas.width,h=canvas.clientHeight||canvas.height,s=etat.scenario?.camera?.echelle??5;
  camera.projectionMatrix.elements=[s,0,0,0, 0,s*w/h,0,0, 0,0,-(etat.scenario?.camera?.profondeur??1e-4),0, 0,0,0,1];}
 function recentrer(side){const c=cutCourant();if(!c||!rails.left||!rails.right)return;
  const L=pt(rails.left.matrixWorld.elements,[0,0,0]),R=pt(rails.right.matrixWorld.elements,[0,0,0]);
  const X=unit([R[0]-L[0],R[1]-L[1],0]),Y=[0,0,1],Z=cross(X,Y),cible=side==='right'?R:L;
  poser(camera,{position:cible.map((v,i)=>v+Z[i]*options.distanceCamera),quaternion:(({x,y,z,w})=>[x,y,z,w])(quatColonnes(X,Y,Z))});
  majMonde(camera);projection();dessiner();log('camera-recentree',{side});}
 /* ---------- découpe (boîte Potree : inverse = monde → cube unité) ---------- */
 function decoupe(profondeur){const c=cutCourant();if(!c)return;const L=c.rails.left.position,R=c.rails.right.position,[larg,haut]=etat.scenario.decoupe.dimensions;
  const X=unit([R[0]-L[0],R[1]-L[1],0]),Y=[0,0,1],Z=cross(X,Y),centre=L.map((v,i)=>(v+R[i])/2+Y[i]*.5);
  const boite=objet('Box',{position:centre,quaternion:(({x,y,z,w})=>[x,y,z,w])(quatColonnes(X,Y,Z)),scale:[larg,haut,profondeur]});majMonde(boite);
  pc.material.clipBoxes=[{inverse:{elements:inv(boite.matrixWorld.elements)}}];}
 /* ---------- chargement d'un cut ---------- */
 function viderCut(){for(const t of etat.minuteries)clearTimeout(t);etat.minuteries.length=0;
  for(const s of ['left','right'])if(rails[s]){root.children.splice(root.children.indexOf(rails[s]),1);rails[s]=null;}
  pc.visibleNodes=[];window.Potree.numNodesLoading=0;etat.side=null;for(const id of ['O2N3DCutLRClick','O2N3DCutRRClick'])$(id).classList.remove('active');}
 function construireRail(side,desc){const r=objet('Object3D',{position:desc.position,quaternion:desc.quaternion,scale:desc.scale,rotation:desc.rotation});
  ajouter(r,objet('Mesh'));const profil=ajouter(r,objet('Object3D',{position:desc.profil.position,quaternion:desc.profil.quaternion,scale:desc.profil.scale,rotation:desc.profil.rotation}));
  for(const contour of desc.contours){const l=ajouter(profil,objet('Line'));l.geometry={attributes:{position:tampon(contour.flat())}};}
  r.__side=side;return r;}
 function chargerCut(index,raison){const c=etat.partie.cuts[index];if(!c)return false;viderCut();etat.index=index;etat.chargements++;
  $('O2N3DCutDescription').textContent=`Cut ${c.cut} of part ${etat.partie.part}`;$('O2N3DCutShapeInfo').textContent=c.shape||'U50';
  majCompteur();log('cut-charge',{cut:c.cut,part:etat.partie.part,raison,status:c.status});
  /* Les rails arrivent après le libellé (Ariane attend « ses rails ne sont pas encore disponibles »). */
  const t=setTimeout(()=>{for(const s of ['left','right']){rails[s]=ajouter(root,construireRail(s,c.rails[s]));}majMonde(root);decoupe(etat.scenario.decoupe.dimensions[2]);recentrer('left');etat.side=null;log('rails-prets',{cut:c.cut});},options.latenceRails);
  etat.minuteries.push(t);
  /* Nœuds de points : par lots, avec latence ; Potree.numNodesLoading pendant le chargement. */
  const lots=Math.max(1,options.lots),parLot=Math.ceil(c.noeuds.length/lots);window.Potree.numNodesLoading=c.noeuds.length;
  for(let i=0;i<lots;i++){const tranche=c.noeuds.slice(i*parLot,(i+1)*parLot);if(!tranche.length)continue;
   etat.minuteries.push(setTimeout(()=>{for(const n of tranche)pc.visibleNodes.push(noeud(n,c));window.Potree.numNodesLoading-=tranche.length;dessiner();log('noeuds-charges',{cut:c.cut,lot:i+1,noeuds:pc.visibleNodes.length});},options.latence*(i+1)+options.latenceRails));}
  if(options.decoupeTardive)etat.minuteries.push(setTimeout(()=>{if(cutCourant()===c){decoupe(etat.scenario.decoupe.dimensions[2]+.1);log('decoupe-deplacee',{cut:c.cut});}},options.latenceRails+150));
  majEtat();return true;}
 function noeud(n,c){const p=objet('Points',{position:c.origine});p.isPoints=true;p.parent=pc;p.matrixWorld.elements=mul(pc.matrixWorld.elements,compose(p));
  const xs=n.positions;let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<xs.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],xs[i+k]);max[k]=Math.max(max[k],xs[i+k]);}
  p.geometry={attributes:{position:tampon(xs),intensity:tampon(n.intensite.length?n.intensite:Array(xs.length/3).fill(0),Uint16Array,1),classification:tampon(n.classe.length?n.classe:Array(xs.length/3).fill(0),Uint8Array,1)},
   drawRange:{start:0,count:Infinity},boundingBox:{min:{x:min[0],y:min[1],z:min[2]},max:{x:max[0],y:max[1],z:max[2]}}};
  return {sceneNode:p,geometryNode:{boundingBox:{min:{x:min[0]+c.origine[0],y:min[1]+c.origine[1],z:min[2]+c.origine[2]},max:{x:max[0]+c.origine[0],y:max[1]+c.origine[1],z:max[2]+c.origine[2]}}}};}
 /* ---------- compteur « N on M treated » et « M cuts » ---------- */
 const traites=()=>etat.partie.cuts.filter(c=>c.status!=='invalid').length; /* hypothèse : traité = validé ou passé */
 function majCompteur(){$('maquette-compteur').textContent=`${traites()} on ${etat.partie.cuts.length} treated`;$('maquette-total').textContent=`${etat.partie.cuts.length} cuts`;
  $('O2N3DCutNextInvalid3DRail').disabled=prochain('invalid')<0;}
 const prochain=(critere,depuis=etat.index)=>{for(let i=depuis+1;i<etat.partie.cuts.length;i++){const s=etat.partie.cuts[i].status;if(critere==='invalid'?s==='invalid':s!=='valid')return i;}return -1;};
 /* ---------- écritures vers le « serveur » ---------- */
 async function ecrire(status){const c=cutCourant();c.status=status;majCompteur();const L=pt(rails.left.matrixWorld.elements,[0,0,0]),R=pt(rails.right.matrixWorld.elements,[0,0,0]);
  const body={RowKey:`${etat.partie.part}-${c.cut}`,ExtractionStatus:status,TreatedByOperator:true,SeenByOperator:true,XLeftEdge:L[0],YLeftEdge:L[1],ZLeftEdge:L[2],XRightEdge:R[0],YRightEdge:R[1],ZRightEdge:R[2]};
  etat.ecritures++;log('ecriture',{cut:c.cut,status});
  try{const r=await fetch(`/rails/${etat.partie.table}/${body.RowKey}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});log('ecriture-reponse',{cut:c.cut,http:r.status});}
  catch(e){log('ecriture-echec',{cut:c.cut,message:e.message});}}
 /* ---------- actions (équivalents de ce qu'Ariane observe dans ESV) ---------- */
 function choisirRail(side){etat.side=side;$('O2N3DCutLRClick').classList.toggle('active',side==='left');$('O2N3DCutRRClick').classList.toggle('active',side==='right');
  log('rail-choisi',{side});requestAnimationFrame(()=>recentrer(side)); /* la caméra suit à l'image suivante (D-088) */}
 function invalideSuivant(){const i=prochain('invalid');if(i<0){log('invalide-suivant-aucun');return;}chargerCut(i,'invalide-suivant');}
 function validerEtSuivant(){if(!rails.left)return;void ecrire('valid');const i=prochain('non-valide');
  if(i>=0)return chargerCut(i,'valider-et-suivant');
  const suivante=etat.scenario.parties[etat.scenario.parties.indexOf(etat.partie)+1];
  if(suivante){etat.partie=suivante;const j=prochain('non-valide',-1);chargerCut(j>=0?j:0,'partie-suivante');} /* terrain du 30/09 : au dernier cut, ESV charge la partie suivante */
  else log('valider-dernier-sans-suite');}
 function validerSurPlace(){if(!rails.left)return;void ecrire('valid');}
 function passer(){if(!rails.left)return;void ecrire('skipped');invalideSuivant();}
 function allerA(index,raison){if(index<0||index>=etat.partie.cuts.length){log('navigation-refusee',{index});return;}chargerCut(index,raison);}
 $('O2N3DCutLRClick').addEventListener('click',()=>choisirRail('left'));$('O2N3DCutRRClick').addEventListener('click',()=>choisirRail('right'));
 $('O2N3DCutValidate3DRail').addEventListener('click',validerEtSuivant);$('O2N3DCutNextInvalid3DRail').addEventListener('click',invalideSuivant);
 $('maquette-cut-precedent').addEventListener('click',()=>allerA(etat.index-1,'precedent'));$('maquette-cut-suivant').addEventListener('click',()=>allerA(etat.index+1,'suivant'));
 document.addEventListener('maquette:goto',e=>{const i=etat.partie?.cuts.findIndex(c=>c.cut===Number(e.detail?.cut));if(i>=0)allerA(i,'evenement-goto');}); /* hypothèse d'événement interne */
 document.addEventListener('keydown',e=>{if(e.target?.closest?.('input,textarea,select'))return;const which=e.which||e.keyCode;
  log('touche',{key:e.key,which,shift:e.shiftKey,ctrl:e.ctrlKey,trusted:e.isTrusted});
  if(e.shiftKey&&!e.ctrlKey&&(which===90||e.key==='Z'||e.key==='z'))return invalideSuivant();
  if(e.shiftKey&&!e.ctrlKey&&(which===8||e.key==='Backspace'))return passer();
  if(e.ctrlKey&&!e.shiftKey&&(which===13||e.key==='Enter'))return validerSurPlace();
  if(e.shiftKey&&!e.ctrlKey&&(which===32||e.key===' '||e.code==='Space'))return validerEtSuivant();
  if(!e.shiftKey&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&(e.key==='d'||e.key==='D'))return allerA(etat.index+1,'touche-D'); /* U3 : « cut de droite » (hypothèse) */});
 /* Clic dans la vue : pose le rail COURANT au point rayon caméra ∩ plan de coupe,
  * sans vérifier que le point est dans la vue (D-088 P1) ; pixel entier (4.8.0). */
 canvas.addEventListener('click',e=>{const rect=canvas.getBoundingClientRect(),px=Math.trunc(e.clientX-rect.left),py=Math.trunc(e.clientY-rect.top);
  if(!etat.side||!rails[etat.side]){log('clic-ignore',{px,py,raison:'aucun rail courant'});return;}
  const P=camera.projectionMatrix.elements,ndc=[px/rect.width*2-1,1-py/rect.height*2];
  const cam=camera.matrixWorld.elements,railCam=pt(inv(cam),pt(rails[etat.side].matrixWorld.elements,[0,0,0]));
  const monde=pt(cam,[ndc[0]/P[0],ndc[1]/P[5],railCam[2]]),avant=pt(rails[etat.side].matrixWorld.elements,[0,0,0]),d=monde.map((v,i)=>v-avant[i]);
  const r=rails[etat.side];r.position.x+=d[0];r.position.y+=d[1];r.position.z+=d[2];majMonde(r);dessiner();
  log('rail-pose',{side:etat.side,px,py,deplacementMm:d.map(v=>Math.round(v*1e4)/10)});});
 /* ---------- rendu 2D (confort visuel seulement) ---------- */
 let dessinDemande=false;function dessiner(){if(dessinDemande)return;dessinDemande=true;requestAnimationFrame(()=>{dessinDemande=false;rendre();});}
 function rendre(){const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.fillStyle='#0e0f12';ctx.fillRect(0,0,w,h);if(!cutCourant()||!rails.left)return;
  const VP=mul(camera.projectionMatrix.elements,inv(camera.matrixWorld.elements)),pix=p=>{const n=pt(VP,p);return [(n[0]+1)/2*w,(1-n[1])/2*h];};
  ctx.fillStyle='#6f8fb3';for(const n of pc.visibleNodes){const a=n.sceneNode.geometry.attributes.position.array,m=n.sceneNode.matrixWorld.elements;
   for(let i=0;i<a.length;i+=3){const [x,y]=pix(pt(m,[a[i],a[i+1],a[i+2]]));if(x>=0&&x<w&&y>=0&&y<h)ctx.fillRect(x,y,1.5,1.5);}}
  for(const s of ['left','right']){const r=rails[s];if(!r)continue;ctx.strokeStyle=s===etat.side?'#f4db72':'#e05a5a';ctx.lineWidth=1.5;
   for(const l of r.children[1].children){const a=l.geometry.attributes.position.array,m=l.matrixWorld.elements;ctx.beginPath();for(let i=0;i<a.length;i+=3){const [x,y]=pix(pt(m,[a[i],a[i+1],a[i+2]]));i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}}
  ctx.fillStyle='#9ab';ctx.font='12px monospace';ctx.fillText(`${$('O2N3DCutDescription').textContent} · rail courant : ${etat.side||'aucun'} · nœuds : ${pc.visibleNodes.length}`,10,h-10);}
 function majEtat(){const c=cutCourant();$('maquette-etat').textContent=c?`partie ${etat.partie.part}, cut ${c.cut} (${c.status}), ${etat.partie.cuts.length} coupes, latence ${options.latence} ms × ${options.lots} lots`:'—';}
 /* ---------- démarrage : scénario puis liste des coupes (GET paginé) ---------- */
 async function demarrer(){
  const s=await (await fetch(`/maquette/scenario.json?cuts=${options.cuts}&debut=${options.debut}&part=${options.part}`)).json();etat.scenario=s;
  for(const p of s.parties){const lignes=[];for(let page=1;;page++){const r=await (await fetch(`/rails/${p.table}?page=${page}`)).json();lignes.push(...r.value);if(r.value.length<r.pageSize)break;}
   etat.listes.set(p.part,lignes);for(const l of lignes){const c=p.cuts.find(x=>x.cut===l.CutNumber);if(c)c.status=l.ExtractionStatus;}}
  etat.partie=s.parties[0];
  let index=Number.isFinite(options.cut)?etat.partie.cuts.findIndex(c=>c.cut===options.cut):-1;
  if(index<0){index=etat.partie.cuts.findIndex(c=>c.status==='invalid');if(index<0)index=0;}
  projection();chargerCut(index,'demarrage');return true;}
 window.__maquette={options,journal,etat:()=>{const c=cutCourant();return {part:etat.partie?.part??null,cut:c?.cut??null,index:etat.index,status:c?.status??null,side:etat.side,
   compteur:$('maquette-compteur').textContent,noeudsVisibles:pc.visibleNodes.length,chargements:etat.chargements,ecritures:etat.ecritures,railsPrets:!!rails.left,
   statuts:etat.partie?.cuts.map(x=>x.status[0]).join('')||'',rails:['left','right'].map(s=>rails[s]?pt(rails[s].matrixWorld.elements,[0,0,0]):null)};},
  allerA:cut=>{const i=etat.partie.cuts.findIndex(c=>c.cut===cut);return i>=0?allerA(i,'maquette.allerA'):false;},scenario:()=>etat.scenario,pret:null};
 window.__maquette.pret=demarrer().then(()=>true,e=>{log('erreur-demarrage',{message:e.message});$('maquette-etat').textContent='Erreur : '+e.message;throw e;});
})();
