'use strict';
/* CH-089 (lot « Vision 9 » du 09/11, ÉTABLI : UNE réponse 502 d'ESV pendant une opération a arrêté le préchauffage pour tout le reste du lot,
 * 22 préchauffages sur les 21 premières validations, aucun sur les 75 suivantes) — PAUSE AU LIEU DE L'ARRÊT.
 * Essais purs (Node), même arbre synthétique que CH-085. Ils prouvent :
 *  - une erreur passagère (5xx, échec d'un load(), chargement trop long) : motif `pause-serveur`, plus aucun lancement pendant `pauseMs`,
 *    le préchauffage reste allumé et repart après la pause ;
 *  - `refusMax` erreurs passagères (3 par défaut) : arrêt pour le lot (`refus-serveur`), comme avant ;
 *  - un vrai refus (401, 403) : arrêt pour le lot dès la première fois, comme avant ;
 *  - une erreur vue PENDANT la pause ne compte pas une deuxième fois. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/prechauffage.js');

function arbre({profondeur=7,taille=128,charges=()=>false,potree,dureeImages=2,journal}={}){
 const faire=(d,x,y,z)=>{const s=taille/2**d,nom=`${d}-${x}-${y}-${z}`,b={min:{x:x*s,y:y*s,z:z*s},max:{x:(x+1)*s,y:(y+1)*s,z:(z+1)*s}};
  const n={key:{d,x,y,z},level:d,numPoints:1000,nodeinfo:{pointCount:1000},boundingBox:b,children:{},loaded:charges(nom,d,b),loading:false,filename:()=>nom,url:()=>'/nuage/ept-data/'+nom,geometry:null};
  if(n.loaded)n.geometry={attributes:{position:{array:new Float32Array(3000)}}};
  n.load=async function(){journal.appels.push(nom);if(this.loaded||this.loading)return;if(potree.numNodesLoading>=potree.maxNodesLoading)return;
   this.loading=true;++potree.numNodesLoading;
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
 return out;};}
function monter(reglage){const potree={numNodesLoading:0,maxNodesLoading:4,attentes:[]},journal={appels:[],charges:[]};
 const pc=arbre({charges:pres(20),potree,journal});const e={evts:[],horloge:0};let images=[];
 e.env={reglage:{actif:true,rayonM:.75,sautMin:2,hierarchie:false,zone:'boite',horizon:2,candidatsMax:3,noeudsMax:32,octetsMax:10485760,voie:'potree',memoire:{actif:true,noeudsMax:200,enVolMax:2},delaiMs:2000,...reglage},
  chargements:()=>potree.numNodesLoading,etiquette:()=>({part:23,cut:20}),poster:x=>e.evts.push(JSON.parse(JSON.stringify(x))),
  image:()=>new Promise(r=>images.push(r)),maintenant:()=>e.horloge,tas:()=>50*1048576,voisins:observateur(300,{20:'invalid',70:'invalid',110:'invalid'}),AbortController,
  fetch:()=>Promise.reject(Error('aucun fetch attendu'))};
 e.tourner=async(n=200,chaque=null)=>{for(let i=0;i<n;i++){e.horloge+=16;chaque?.(i);for(const a of [...potree.attentes])if(--a.images<=0){potree.attentes.splice(potree.attentes.indexOf(a),1);a.fin();}
  const f=images;images=[];for(const r of f)r();await new Promise(r=>setImmediate(r));}};
 return {pc,e,journal,potree,p:P.creer(e.env)};}
const contexte=pc=>({partie:23,coupe:20,rails:{left:[0,0,0],right:[0,1.435,0]},origine:[20.5,10,10],pointclouds:[pc]});
const dernier=e=>e.evts.filter(x=>x.kind==='prechauffage').at(-1);
const erreur=(p,st)=>p.ressources([{name:'https://x.invalid/nuage/ept-data/7-70-8-9.laz',initiatorType:'fetch',responseStatus:st}]);
/* Une opération pendant laquelle ESV répond `st` dès le 2e load() lancé. */
async function operationAvecErreur(m,st){const {pc,e,journal,p}=m;const r=p.apresCapture(contexte(pc));let n=null;
 await e.tourner(200,()=>{if(n===null&&journal.appels.length>=2){erreur(p,st);n=journal.appels.length;}});await r;return n;}

test('502 pendant une opération : pause-serveur, aucun lancement pendant la pause, préchauffage toujours allumé',async()=>{
 const m=monter({});const {pc,e,journal,p}=m;const n=await operationAvecErreur(m,502);
 assert.equal(dernier(e).motif,'pause-serveur');assert.equal(journal.appels.length,n,'aucun lancement après l\'erreur');
 assert.equal(p.actif(),true,'toujours allumé');
 const avant=journal.appels.length,r2=await p.apresCapture(contexte(pc));
 assert.equal(r2.motif,'pause-serveur');assert.equal(journal.appels.length,avant,'rien pendant la pause');
});

test('après la pause (10 s par défaut) : le préchauffage repart et charge',async()=>{
 const m=monter({});const {pc,e,journal,p}=m;await operationAvecErreur(m,502);
 e.horloge+=10001;const avant=journal.charges.length;const r=p.apresCapture(contexte(pc));await e.tourner();const ev=await r;
 assert.notEqual(ev.motif,'pause-serveur');assert.notEqual(ev.motif,'refus-serveur');assert.ok(journal.charges.length>avant,'des nœuds chargés après la pause');
});

test('une erreur vue pendant la pause ne compte pas ; 3 erreurs passagères séparées : arrêt pour le lot',async()=>{
 const m=monter({});const {pc,e,journal,p}=m;
 await operationAvecErreur(m,502);erreur(p,503);erreur(p,502);assert.equal(p.actif(),true,'erreurs pendant la pause : non comptées');
 e.horloge+=10001;await operationAvecErreur(m,504);assert.equal(p.actif(),true,'2 erreurs : toujours allumé');assert.equal(dernier(e).motif,'pause-serveur');
 e.horloge+=10001;await operationAvecErreur(m,502);assert.equal(dernier(e).motif,'refus-serveur');assert.equal(p.actif(),false,'3e erreur : arrêt pour le lot');
 e.horloge+=60000;const avant=journal.appels.length,r=await p.apresCapture(contexte(pc));assert.equal(r.motif,'refus-serveur');assert.equal(journal.appels.length,avant);
});

for(const st of [401,403])test(`${st} : vrai refus, arrêt pour le lot dès la première fois`,async()=>{
 const m=monter({});const {e,p}=m;await operationAvecErreur(m,st);
 assert.equal(dernier(e).motif,'refus-serveur');assert.equal(p.actif(),false);
});

test('chargement à nous trop long (au-delà de delaiMs) : pause, pas arrêt',async()=>{
 const m=monter({delaiMs:500});const {pc,e,potree,p}=m;
 let premier=true;const orig=potree.attentes;potree.attentes={push:a=>{if(premier){premier=false;return;}orig.push(a);},splice:(...x)=>orig.splice(...x),indexOf:x=>orig.indexOf(x),[Symbol.iterator]:()=>orig[Symbol.iterator]()};
 const r=p.apresCapture(contexte(pc));await e.tourner();await r;
 assert.equal(dernier(e).motif,'pause-serveur');assert.equal(p.actif(),true);
});

test('réglage : pauseMs 10 000 et refusMax 3 par défaut, bornés ; livré ainsi ; l\'observateur garde le motif',()=>{
 const r=P.reglage({actif:true});assert.equal(r.pauseMs,10000);assert.equal(r.refusMax,3);
 const b=P.reglage({actif:true,pauseMs:5,refusMax:99});assert.equal(b.pauseMs,10000);assert.equal(b.refusMax,3);
 const v=P.reglage({actif:true,pauseMs:30000,refusMax:1});assert.equal(v.pauseMs,30000);assert.equal(v.refusMax,1);
 const s=require('../src/settings.js').lot.chargement.prechauffer;assert.equal(s.pauseMs,10000);assert.equal(s.refusMax,3);
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/esv-observer.js'),'utf8');
 assert.match(src,/'refus-serveur','pause-serveur'/,'motif connu de l\'observateur (opération et opération lointaine)');
});
