'use strict';
/* CH-092 (relecture en adversaire du préchauffage, CH-081 à CH-089) — MONTURE COMMUNE des essais ch092-prechauffage-*.test.cjs.
 * Arbre synthétique de CH-085/CH-089 (load() à la manière de Potree 1.8.2), avec en plus :
 *  - `bloque(nom, journal)` : ce load() échoue à la manière de Potree (CH-062) : le nœud reste « en cours », le compteur n'est pas rendu ;
 *  - `ligneBase` : `env.chargements` rend le compteur EFFECTIF de l'adaptateur (compteur de Potree − requêtes de points en échec, CH-062).
 * Données synthétiques. Ce fichier n'est pas un essai (pas de suffixe .test). */
const P=require('../src/prechauffage.js');
function arbre({profondeur=7,taille=128,charges=()=>false,potree,dureeImages=2,journal,bloque=()=>false}={}){
 const faire=(d,x,y,z)=>{const s=taille/2**d,nom=`${d}-${x}-${y}-${z}`,b={min:{x:x*s,y:y*s,z:z*s},max:{x:(x+1)*s,y:(y+1)*s,z:(z+1)*s}};
  const n={key:{d,x,y,z},level:d,numPoints:1000,nodeinfo:{pointCount:1000},boundingBox:b,children:{},loaded:charges(nom,d,b),loading:false,filename:()=>nom,url:()=>'/nuage/ept-data/'+nom,geometry:null};
  if(n.loaded)n.geometry={attributes:{position:{array:new Float32Array(3000)}}};
  n.load=async function(){journal.appels.push(nom);if(this.loaded||this.loading)return;if(potree.numNodesLoading>=potree.maxNodesLoading)return;
   this.loading=true;++potree.numNodesLoading;
   if(bloque(nom,journal)){journal.bloques.push(nom);return;}   /* échec à la manière de Potree : le nœud reste « en cours », le compteur n'est pas rendu */
   potree.attentes.push({images:dureeImages,fin:()=>{this.geometry={attributes:{position:{array:new Float32Array(3000)},color:{array:new Uint8Array(4000)}}};this.loaded=true;this.loading=false;--potree.numNodesLoading;journal.charges.push(nom);}});};
  n.dispose=()=>{};
  if(d<profondeur){let i=0;for(const a of [0,1])for(const c of [0,1])for(const e of [0,1]){const s2=s/2,bx={min:{x:(2*x+a)*s2,y:(2*y+c)*s2,z:(2*z+e)*s2}};
    if(bx.min.y<=13&&bx.min.y+s2>=8&&bx.min.z<=11&&bx.min.z+s2>=9)n.children[i]=faire(d+1,2*x+a,2*y+c,2*z+e);i++;}}
  return n;};
 return {pcoGeometry:{root:faire(0,0,0,0),loader:{extension:()=>'.bin'}},matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}};}
const pres=cx=>(nom,d,b)=>d<=1||(b.min.x<=cx+.5&&b.max.x>=cx-.5);
const ligne=(i,s='valid')=>({i,s,t:false,v:false,f:false,e:[i+.5,10,10,i+.5,11.435,10]});
function observateur(lignes,statuts){return (cut,world,quoi)=>{const st=i=>statuts[i]||'valid',rows=[];
 for(let i=Math.max(0,cut-10);i<=Math.min(lignes-1,cut+10);i++)rows.push(ligne(i,st(i)));
 const out={ok:true,table:{lignes,tables:1},geo:{index:cut,mm:0,secondMm:null},rows};
 if(Number.isInteger(quoi?.cible))out.loin=quoi.cible>=0&&quoi.cible<lignes?ligne(quoi.cible,st(quoi.cible)):null;
 else if(quoi?.suivante===true){out.loin=null;for(let i=cut+1;i<lignes;i++)if(st(i)!=='valid'){out.loin=ligne(i,st(i));break;}}
 else if(quoi?.premiere===true){out.loin=null;for(let i=0;i<lignes;i++)if(i!==cut&&st(i)!=='valid'){out.loin=ligne(i,st(i));break;}}
 else if(Number.isInteger(quoi?.loin)){out.loin=null;let prec=cut,avant=0;for(let i=cut+1;i<lignes;i++){if(st(i)==='valid')continue;if(i-prec>=quoi.loin){out.loin={...ligne(i,st(i)),avant,saut:i-prec};break;}if(++avant>(quoi.max??40))break;prec=i;}}
 return out;};}
function monter(reglage={},{statuts={20:'invalid',70:'invalid',110:'invalid'},bloque,dureeImages=2,ligneBase=false,profondeur=7}={}){
 const potree={numNodesLoading:0,maxNodesLoading:4,attentes:[]},journal={appels:[],charges:[],bloques:[]};
 const pc=arbre({charges:pres(20),potree,journal,bloque,dureeImages,profondeur});const e={evts:[],horloge:0,etiquette:{part:23,cut:20},externe:0};let images=[];
 e.env={reglage:{actif:true,rayonM:.75,sautMin:2,hierarchie:false,zone:'boite',horizon:2,candidatsMax:3,noeudsMax:32,octetsMax:10485760,voie:'potree',memoire:{actif:true,noeudsMax:200,enVolMax:2},delaiMs:2000,...reglage},
  /* ligneBase : compteur effectif de l'adaptateur (CH-062) = compteur de Potree − requêtes de points en échec */
  chargements:()=>potree.numNodesLoading+e.externe-(ligneBase?journal.bloques.length:0),etiquette:()=>e.etiquette,poster:x=>e.evts.push(JSON.parse(JSON.stringify(x))),
  image:()=>new Promise(r=>images.push(r)),maintenant:()=>e.horloge,tas:()=>50*1048576,voisins:observateur(300,statuts),AbortController,
  fetch:()=>Promise.reject(Error('aucun fetch attendu'))};
 e.tourner=async(n=200,chaque=null)=>{for(let i=0;i<n;i++){e.horloge+=16;chaque?.(i);for(const a of [...potree.attentes])if(--a.images<=0){potree.attentes.splice(potree.attentes.indexOf(a),1);a.fin();}
  const f=images;images=[];for(const r of f)r();await new Promise(r=>setImmediate(r));}};
 return {pc,e,journal,potree,p:P.creer(e.env)};}
const contexte=(pc,cut=20)=>({partie:23,coupe:cut,rails:{left:[0,0,0],right:[0,1.435,0]},origine:[cut+.5,10,10],pointclouds:[pc]});
const tous=pc=>{const out=[],pile=[pc.pcoGeometry.root];while(pile.length){const n=pile.pop();out.push(n);pile.push(...Object.values(n.children));}return out;};
module.exports={P,monter,contexte,tous,pres};
