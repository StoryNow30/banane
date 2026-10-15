'use strict';
/* Page « comme ESV » au rythme des images (copie du montage de tests/v3-turbo.test.cjs, D-088) :
 * caméra recopiée à l'image suivante (une image toutes les 16 ms), compteurs de Potree, horloge à
 * événements discrets. Partagée par les essais de la 4.9.5.1 (diagnostic du signal, D-109). */
const {page}=require('./page.cjs'),S=require('../../src/settings.js');
function esv({cut=100,pilote={},chargements=0}={}){
 const potree={framenumber:0,numNodesLoading:chargements};
 /* Ces essais isolent les pièces du mode rapide d'après le tirage de la 4.9.0.7 (cut 100 rapide, cut 101 référence) ;
  * le réglage de la 4.9.0.9 (« echantillon », D-091) est essayé dans v9-echantillon. */
 const globals={Potree:potree,BananeSettings:{...S,pilote:{...S.pilote,modeRapide:'tirage',...pilote}}};
 const f=page({globals}),cam=f.ctx.viewer.scene.getActiveCamera(),images=[],clics=[];
 const minuteries=new Map();let numero=0,prevu=false,prochaine=16;
 const tourner=()=>{prevu=false;if(!minuteries.size)return;
  const [id,m]=[...minuteries].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];minuteries.delete(id);
  if(m.at>f.clock())f.advance(m.at-f.clock());while(prochaine<=f.clock()){image();prochaine+=16;}m.fn();planifier();};
 const planifier=()=>{if(!prevu){prevu=true;setImmediate(tourner);}};
 f.ctx.setTimeout=(fn,ms=0)=>{const id=++numero;minuteries.set(id,{at:f.clock()+ms,fn});planifier();return id;};
 f.ctx.clearTimeout=id=>{minuteries.delete(id);};
 f.ctx.requestAnimationFrame=fn=>f.ctx.setTimeout(fn,prochaine-f.clock()>0?prochaine-f.clock():16);
 f.nodes.get('O2N3DCutDescription').textContent=`Cut ${cut} of part 23`;
 let cote='left';const enAttente=[];
 for(const [id,side,classe] of [['O2N3DCutLRClick','left','leftRailSClass'],['O2N3DCutRRClick','right','rightRailSClass']]){
  const n=f.nodes.get(id),clic=n.click;
  n.classList={contains:c=>c===classe&&cote===side};
  n.click=function(){clics.push(side);const avant=cam.position;clic.call(this);const apres=cam.position;cam.position=avant;cote=side;enAttente.push(()=>{cam.position=apres;});};
 }
 /* Une image : la caméra suit la vue demandée, le compteur d'images avance. */
 function image(){potree.framenumber++;images.push(potree.framenumber);for(const a of enAttente.splice(0))a();}
 return {...f,potree,clics,image,cote:()=>cote};
}
/* Un nuage visible (un nœud) pour que la signature compte au moins un nœud. */
function nuage(f){const F=require('../v242/fixtures.cjs'),L=require('../../vendor/lidar.js'),pc=F.object([0,0,0],'PointCloudOctree'),n=F.object([0,0,0],'Points');
 n.geometry={attributes:{position:F.buffer([[0,.01,.01],[0,1.425,.01]])}};pc.material={clipBoxes:[],clipTask:0,clipMethod:0};pc.visibleNodes=[{sceneNode:n}];
 f.ctx.viewer.scene.pointclouds=[pc];f.ctx.Potree.ClipTask=F.enums.ClipTask;f.ctx.Potree.ClipMethod=F.enums.ClipMethod;f.ctx.BananeLidar.capture=opts=>L.capture(opts);return pc;}
module.exports={esv,nuage};
