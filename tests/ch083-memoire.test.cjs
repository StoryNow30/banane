'use strict';
/* CH-083 (D-314) — PHASE MÉMOIRE du préchauffage : `node.load()` de Potree sur les nœuds de la coupe suivante que le préchauffage HTTP vient de recevoir en 200.
 * Essais purs (Node), arbre EPT synthétique (celui de CH-081) dont chaque nœud porte `nodeinfo` et un `load()` qui imite PointCloudCopcGeometryNode de
 * Potree 1.8.2 (sort si chargé, en cours ou `numNodesLoading >= maxNodesLoading` ; sinon `loading`, ++compteur, fin quelques images plus tard, --compteur).
 * Ils prouvent :
 *  - allumée : les nœuds préchauffés de k+1 et k+2 sont `loaded` à la fin de l'opération ; au plus `enVolMax` chargements à nous à la fois ; l'événement
 *    porte `memLances`, `memCharges`, `memOctets` (octets décodés) et le tas ;
 *  - `load()` n'est appelé QUE sur un nœud servi en 200 par le préchauffage HTTP (jamais sur un échec, jamais sur un nœud non demandé) ;
 *  - éteinte (clé absente ou `actif:false`) : aucun `load()`, comportement de CH-081 ;
 *  - Potree qui repart (compteur au-delà de nos chargements) : arrêt, plus aucun lancement ; une capture (`annuler`) : plus aucun lancement ;
 *  - aucun nœud de la coupe en cours n'est touché (ni `load`, ni libéré) ; aucun événement ne porte d'adresse ni de clé. Données synthétiques. */
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
 const e={evts:[],demandes:[],etiquette:{part:23,cut:20},potree,potreeExterne:0};let images=[];
 e.env={reglage:{actif:true,rayonM:.75,sautMin:2,hierarchie:false,zone:'boite',horizon:2,candidatsMax:3,noeudsMax:32,octetsMax:10485760,...reglage},
  chargements:()=>potree.numNodesLoading+e.potreeExterne,etiquette:()=>e.etiquette,poster:x=>e.evts.push(JSON.parse(JSON.stringify(x))),
  image:()=>new Promise(r=>images.push(r)),maintenant:()=>0,tas:()=>50*1048576,voisins,AbortController,
  fetch:(url,init)=>new Promise((res,rej)=>{e.demandes.push(url);init.signal.addEventListener('abort',()=>rej(Object.assign(Error('abandon'),{name:'AbortError'})));
   const st=statut(url);queueMicrotask(()=>res({ok:st>=200&&st<300,status:st,headers:{get:()=>null},arrayBuffer:async()=>new ArrayBuffer(50000)}));})};
 e.tourner=async(n=200,chaque=null)=>{for(let i=0;i<n;i++){chaque?.(i);for(const a of [...potree.attentes])if(--a.images<=0){potree.attentes.splice(potree.attentes.indexOf(a),1);a.fin();}
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

test('allumée : les nœuds préchauffés de k+1 et k+2 sont chargés en mémoire ; 2 à la fois au plus ; comptes et tas dans l\'événement',async()=>{
 const {pc,e,journal,p}=monter(MEM);const r=p.apresCapture(contexte(pc));await e.tourner();await r;
 const ev=e.evts.filter(x=>x.kind==='prechauffage').at(-1);
 const prech=new Set(e.demandes.map(cle));
 assert.ok(journal.charges.length>0,'des nœuds chargés');
 assert.ok(journal.charges.some(k=>/^7-70-/.test(k))&&journal.charges.some(k=>/^7-110-/.test(k)),'feuilles de k+1 et k+2 chargées : '+journal.charges.join(' '));
 for(const k of journal.charges)assert.ok(prech.has(k),'chargé seulement s\'il a été préchauffé : '+k);
 for(const n of tous(pc))if(prech.has(nom(n)))assert.equal(n.loaded,true,'nœud préchauffé chargé à la fin : '+nom(n));
 assert.ok(journal.maxEnVol<=2,'au plus 2 à la fois : '+journal.maxEnVol);
 assert.equal(ev.memLances,journal.charges.length);assert.equal(ev.memCharges,journal.charges.length);assert.equal(ev.memEchecs,0);
 assert.equal(ev.memOctets,journal.charges.length*16000,'octets décodés = somme des attributs');
 assert.equal(ev.tasAvantKo,51200);assert.equal(ev.tasApresKo,51200);assert.equal(ev.memEnVolFin,0);
 assert.equal(journal.liberes.length,0,'rien n\'est libéré');
 sansAdresse(e.evts);
});

test('coupe en cours : aucun de ses nœuds n\'est touché (ni load, ni libéré), tous restent chargés',async()=>{
 const {pc,e,journal,p}=monter(MEM);const avant=tous(pc).filter(n=>n.loaded).map(nom);
 const r=p.apresCapture(contexte(pc));await e.tourner();await r;
 const apres=new Set(tous(pc).filter(n=>n.loaded).map(nom));
 for(const k of avant)assert.ok(apres.has(k),'toujours chargé : '+k);
 for(const k of journal.appels)assert.ok(!avant.includes(k),'pas de load() sur un nœud déjà chargé : '+k);
});

test('load() seulement sur un nœud servi en 200 : un échec du HTTP n\'est jamais chargé (il bloquerait le compteur de Potree)',async()=>{
 const {pc,e,journal,p}=monter(MEM,u=>/7-70-/.test(u)?502:200);const r=p.apresCapture(contexte(pc));await e.tourner();await r;
 assert.ok(e.demandes.some(u=>/7-70-/.test(u)),'demandé en HTTP');
 assert.ok(!journal.appels.some(k=>/^7-70-/.test(k)),'jamais chargé après un 502');
 assert.ok(journal.charges.length>0,'les autres le sont');
});

test('éteinte (clé absente ou actif:false) : aucun load(), comportement de CH-081',async()=>{
 for(const reglage of [{},{memoire:{actif:false}}]){
  const {pc,e,journal,p}=monter(reglage);const r=p.apresCapture(contexte(pc));await e.tourner();await r;
  const ev=e.evts.filter(x=>x.kind==='prechauffage').at(-1);
  assert.equal(journal.appels.length,0);assert.ok(e.demandes.length>0,'le HTTP part');assert.equal(ev.memLances,null);
 }
});

test('Potree qui repart : arrêt (`chargement`), plus aucun lancement ; capture : plus aucun lancement',async()=>{
 {const {pc,e,journal,p}=monter(MEM);const r=p.apresCapture(contexte(pc));let n=null;
  await e.tourner(200,i=>{if(n===null&&journal.appels.length>=2){e.potreeExterne=1;n=journal.appels.length;}});await r;
  const ev=e.evts.filter(x=>x.kind==='prechauffage').at(-1);
  assert.equal(ev.motif,'chargement');assert.ok(journal.appels.length<=n+0,'aucun lancement après : '+journal.appels.length+' contre '+n);}
 {const {pc,e,journal,p}=monter(MEM);const r=p.apresCapture(contexte(pc));let n=null;
  await e.tourner(200,i=>{if(n===null&&journal.appels.length>=1){p.annuler('capture');n=journal.appels.length;}});await r;
  const ev=e.evts.filter(x=>x.kind==='prechauffage').at(-1);
  assert.equal(ev.motif,'capture');assert.equal(journal.appels.length,n,'aucun lancement après la capture');}
});

test('réglage : bornes de memoire (enVolMax au plus 2), défaut éteint',()=>{
 assert.equal(P.reglage({actif:true}).memoire.actif,false);
 const m=P.reglage({actif:true,memoire:{actif:true,enVolMax:4,noeudsMax:5}}).memoire;assert.equal(m.enVolMax,2);assert.equal(m.noeudsMax,5);
 assert.equal(require('../src/settings.js').lot.chargement.prechauffer.memoire.actif,true,'allumé pour le lot d\'essai (D-314)');
});

test('plafond par opération : au plus `noeudsMax` load() lancés',async()=>{
 const {pc,e,journal,p}=monter({memoire:{actif:true,noeudsMax:5,enVolMax:2}});const r=p.apresCapture(contexte(pc));await e.tourner();await r;
 const ev=e.evts.filter(x=>x.kind==='prechauffage').at(-1);
 assert.equal(journal.appels.length,5);assert.equal(ev.memLances,5);
});
