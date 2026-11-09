'use strict';
/* CH-085 (lot « Vision 7 » du 09/11, ÉTABLI : nos fetch de préchauffage reçoivent 401, ceux de Potree 200) — VOIE POTREE du préchauffage.
 * Essais purs (Node), arbre synthétique de CH-083 (load() à la manière de PointCloudCopcGeometryNode de Potree 1.8.2), serveur qui refuse NOS fetch (401).
 * Ils prouvent :
 *  - `voie:'potree'` : AUCUN fetch à nous ; les nœuds de k+1 et k+2 passent par node.load() et sont chargés ; 2 à la fois au plus ;
 *  - une frontière (nœud commun sans page lue) passe par node.loadHierarchy() de Potree, puis ses enfants par load() ;
 *  - refus du serveur : réponse 401 vue par l'observateur pendant l'opération, ou chargement à nous encore en cours au-delà de `delaiMs` : motif
 *    `refus-serveur`, plus aucun lancement, et le préchauffage reste arrêté pour le lot ;
 *  - aujourd'hui (voie fetch) : nos fetch reçoivent 401, rien n'est en mémoire ;
 *  - capture : plus aucun lancement. Aucune adresse ni clé dans les événements. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/prechauffage.js');


function arbre({profondeur=7,taille=128,charges=()=>false,potree,dureeImages=2,journal}={}){
 const faire=(d,x,y,z)=>{const s=taille/2**d,nom=`${d}-${x}-${y}-${z}`,b={min:{x:x*s,y:y*s,z:z*s},max:{x:(x+1)*s,y:(y+1)*s,z:(z+1)*s}};
  const n={key:{d,x,y,z},level:d,numPoints:1000,nodeinfo:{pointCount:1000},boundingBox:b,children:{},loaded:charges(nom,d,b),loading:false,filename:()=>nom,url:()=>'/nuage/ept-data/'+nom,geometry:null};
  if(n.loaded)n.geometry={attributes:{position:{array:new Float32Array(3000)}}};
  n.load=async function(){journal.appels.push(nom);if(this.loaded||this.loading)return;if(potree.numNodesLoading>=potree.maxNodesLoading)return;
   this.loading=true;++potree.numNodesLoading;journal.enVol++;journal.maxEnVol=Math.max(journal.maxEnVol,journal.enVol);
   potree.attentes.push({images:dureeImages,fin:()=>{this.geometry={attributes:{position:{array:new Float32Array(3000)},color:{array:new Uint8Array(4000)}}};this.loaded=true;this.loading=false;--potree.numNodesLoading;journal.enVol--;journal.charges.push(nom);}});};
  n.dispose=()=>{journal.liberes.push(nom);};
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
 return out;};}
function environnement({reglage={},voisins,statut=()=>200,potree}={}){
 const e={evts:[],demandes:[],etiquette:{part:23,cut:20},potree,potreeExterne:0,horloge:0};let images=[];
 e.env={reglage:{actif:true,rayonM:.75,sautMin:2,hierarchie:false,zone:'boite',horizon:2,candidatsMax:3,noeudsMax:32,octetsMax:10485760,...reglage},
  chargements:()=>potree.numNodesLoading+e.potreeExterne,etiquette:()=>e.etiquette,poster:x=>e.evts.push(JSON.parse(JSON.stringify(x))),
  image:()=>new Promise(r=>images.push(r)),maintenant:()=>e.horloge,tas:()=>50*1048576,voisins,AbortController,
  fetch:(url,init)=>new Promise((res,rej)=>{e.demandes.push(url);init.signal.addEventListener('abort',()=>rej(Object.assign(Error('abandon'),{name:'AbortError'})));
   const st=statut(url);queueMicrotask(()=>res({ok:st>=200&&st<300,status:st,headers:{get:()=>null},arrayBuffer:async()=>new ArrayBuffer(50000)}));})};
 e.tourner=async(n=200,chaque=null)=>{for(let i=0;i<n;i++){e.horloge+=16;chaque?.(i);for(const a of [...potree.attentes])if(--a.images<=0){potree.attentes.splice(potree.attentes.indexOf(a),1);a.fin();}
  const f=images;images=[];for(const r of f)r();await new Promise(r=>setImmediate(r));}};
 return e;}
const contexte=(pc,cut=20)=>({partie:23,coupe:cut,rails:{left:[0,0,0],right:[0,1.435,0]},origine:[cut+.5,10,10],pointclouds:[pc]});
const cle=u=>u.split('/').pop().replace('.bin','');
const ADRESSE=/\/|https?:|ept-data|\.bin|\d+-\d+-\d+-\d+/;
const sansAdresse=evts=>assert.ok(!ADRESSE.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse ni clé : '+JSON.stringify(evts));
const MEM={memoire:{actif:true,noeudsMax:200,enVolMax:2}};
function monter(reglage,statut){const potree={numNodesLoading:0,maxNodesLoading:4,attentes:[]},journal={appels:[],charges:[],liberes:[],enVol:0,maxEnVol:0};
 const pc=arbre({charges:pres(20),potree,journal});const e=environnement({reglage,voisins:observateur(300,{20:'invalid',70:'invalid',110:'invalid'}),statut,potree});
 return {pc,e,journal,potree,p:P.creer(e.env)};}
const tous=pc=>{const out=[],pile=[pc.pcoGeometry.root];while(pile.length){const n=pile.pop();out.push(n);pile.push(...Object.values(n.children));}return out;};
const nom=n=>`${n.key.d}-${n.key.x}-${n.key.y}-${n.key.z}`;


const POTREE={voie:'potree',memoire:{actif:true,noeudsMax:200,enVolMax:2},delaiMs:2000};
const dernier=e=>e.evts.filter(x=>x.kind==='prechauffage').at(-1);

test('voie potree : aucun fetch à nous ; k+1 et k+2 chargés par node.load() ; 2 à la fois au plus',async()=>{
 const {pc,e,journal,p}=monter(POTREE,()=>401);const r=p.apresCapture(contexte(pc));await e.tourner();await r;const ev=dernier(e);
 assert.equal(e.demandes.length,0,'aucun fetch à nous');
 assert.ok(journal.charges.some(k=>/^7-70-/.test(k))&&journal.charges.some(k=>/^7-110-/.test(k)),'feuilles de k+1 et k+2 chargées');
 assert.ok(journal.maxEnVol<=2,'2 à la fois au plus : '+journal.maxEnVol);
 assert.equal(ev.noeuds,journal.charges.length);assert.equal(ev.memCharges,journal.charges.length);assert.equal(ev.memEchecs,0);assert.ok(ev.memOctets>0);
 assert.equal(ev.cibles,2);assert.notEqual(ev.motif,'refus-serveur');
 sansAdresse(e.evts);
});

test('aujourd\'hui (voie fetch) : nos fetch reçoivent 401, aucun nœud en mémoire',async()=>{
 const {pc,e,journal,p}=monter({memoire:{actif:true,noeudsMax:200,enVolMax:2}},()=>401);const r=p.apresCapture(contexte(pc));await e.tourner();await r;const ev=dernier(e);
 assert.ok(e.demandes.length>0,'des fetch à nous');assert.equal(journal.appels.length,0,'aucun load() : jamais de 200');assert.equal(ev.memCharges,0);
});

test('frontière : node.loadHierarchy() de Potree, puis ses enfants par load()',async()=>{
 const {pc,e,journal,p}=monter(POTREE);
 /* une feuille de k+1 devient frontière commune : page non lue, enfants inconnus ; loadHierarchy() la greffe (comme Potree) */
 const f=(function cherche(n){if(`${n.key.d}-${n.key.x}-${n.key.y}-${n.key.z}`==='6-35-5-5')return n;for(const c of Object.values(n.children)){const r=cherche(c);if(r)return r;}return null;})(pc.pcoGeometry.root);
 assert.ok(f,'frontière trouvée');const caches=f.children;f.children={};f.nodeinfo=undefined;f.owner={type:'ept'};let lues=0;
 f.loadHierarchy=async()=>{lues++;f.nodeinfo={pointCount:1000};f.children=caches;};
 const r=p.apresCapture(contexte(pc));await e.tourner();await r;const ev=dernier(e);
 assert.equal(lues,1,'page lue par Potree, une fois');assert.equal(ev.hierarchies,1);
 assert.ok(Object.values(caches).some(n=>journal.charges.includes(`${n.key.d}-${n.key.x}-${n.key.y}-${n.key.z}`)),'enfants greffés puis chargés');
 assert.equal(e.demandes.length,0);
});

test('refus : 401 vu par l\'observateur pendant l\'opération → refus-serveur, plus aucun lancement, arrêt pour le lot',async()=>{
 const {pc,e,journal,p}=monter(POTREE);const r=p.apresCapture(contexte(pc));let n=null;
 await e.tourner(200,()=>{if(n===null&&journal.appels.length>=2){p.ressources([{name:'https://x.invalid/nuage/ept-data/7-70-8-9.laz',initiatorType:'fetch',responseStatus:401}]);n=journal.appels.length;}});await r;
 assert.equal(dernier(e).motif,'refus-serveur');assert.equal(journal.appels.length,n,'aucun lancement après le refus');
 const avant=journal.appels.length,r2=await p.apresCapture(contexte(pc));
 assert.equal(r2.motif,'refus-serveur');assert.equal(journal.appels.length,avant,'arrêté pour le lot');assert.equal(p.actif(),false);
});

/* CH-089 : un chargement trop long est une erreur passagère : pause (`pause-serveur`), plus l'arrêt pour le lot ; arrêt seulement avec refusMax:1. */
test('refus : un chargement à nous encore en cours au-delà de delaiMs → refus-serveur (refusMax 1)',async()=>{
 const {pc,e,journal,potree,p}=monter({...POTREE,delaiMs:500,refusMax:1});
 /* le premier load() ne finit jamais (réponse en échec : Potree le garde « en cours » et le compteur à +1) */
 let premier=true;const orig=potree.attentes;potree.attentes={push:a=>{if(premier){premier=false;return;}orig.push(a);},splice:(...x)=>orig.splice(...x),indexOf:x=>orig.indexOf(x),[Symbol.iterator]:()=>orig[Symbol.iterator]()};
 const r=p.apresCapture(contexte(pc));await e.tourner();await r;
 assert.equal(dernier(e).motif,'refus-serveur');assert.equal(p.actif(),false);
});

test('capture : plus aucun lancement ; réglage : voie fetch par défaut, potree livré',async()=>{
 const {pc,e,journal,p}=monter(POTREE);const r=p.apresCapture(contexte(pc));let n=null;
 await e.tourner(200,()=>{if(n===null&&journal.appels.length>=1){p.annuler('capture');n=journal.appels.length;}});await r;
 assert.equal(dernier(e).motif,'capture');assert.equal(journal.appels.length,n);
 assert.equal(P.reglage({actif:true}).voie,'fetch');assert.equal(P.reglage({actif:true,voie:'potree'}).voie,'potree');
 assert.equal(require('../src/settings.js').lot.chargement.prechauffer.voie,'potree','livré : voie potree (CH-085)');
});
