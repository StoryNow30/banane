'use strict';
/* CH-088 (lot « Vision 8 » du 09/11) — OPÉRATION LOINTAINE ET BILAN À L'ARRIVÉE de la voie potree.
 * Mesuré sur le journal (ÉTABLI) : la cible d'un saut de 11 coupes ou plus n'était prise que 1 à 2 coupes avant, chaque opération coupée au changement de
 * coupe après 250 à 720 ms, 0 à 4 load() finis à l'arrivée ; le bilan comptait « couverts » sur nos requêtes, qui n'existent plus (0 sur 242).
 * Essais purs (Node), arbre synthétique de CH-083/CH-085 (load() à la manière de Potree 1.8.2). Ils prouvent :
 *  - la cible lointaine est prise dès qu'elle est connue (3 coupes avant), son opération SURVIT aux changements de coupe et aux captures, ne lance
 *    rien pendant une capture ni quand Potree charge, finit à l'arrivée ; événement `prechauffage-loin` (captures, ms avant, chargés à l'arrivée) ;
 *  - plafonds inchangés : `noeudsMax` par cible, `enVolMax` pour tous nos load() à la fois ;
 *  - bilan à l'arrivée par l'arbre (`prechauffage-bilan`) : nœuds de la boîte, chargés à l'arrivée, chargés par nous, chargés ensuite par Potree seul ;
 *  - `prechauffage-vue` porte `camera`, jamais `type`. Aucune adresse ni clé dans les événements. Données synthétiques. */
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
 else if(Number.isInteger(quoi?.loin)){out.loin=null;let prec=cut,avant=0;for(let i=cut+1;i<lignes;i++){if(st(i)==='valid')continue;if(i-prec>=quoi.loin){out.loin={...ligne(i,st(i)),avant,saut:i-prec};break;}if(++avant>(quoi.max??40))break;prec=i;}}
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
function monter(reglage,statut,statuts={20:'invalid',70:'invalid',110:'invalid'}){const potree={numNodesLoading:0,maxNodesLoading:4,attentes:[]},journal={appels:[],charges:[],liberes:[],enVol:0,maxEnVol:0};
 const pc=arbre({charges:pres(20),potree,journal});const e=environnement({reglage,voisins:observateur(300,statuts),statut,potree});
 return {pc,e,journal,potree,p:P.creer(e.env)};}
const tous=pc=>{const out=[],pile=[pc.pcoGeometry.root];while(pile.length){const n=pile.pop();out.push(n);pile.push(...Object.values(n.children));}return out;};
const nom=n=>`${n.key.d}-${n.key.x}-${n.key.y}-${n.key.z}`;



const POTREE={voie:'potree',memoire:{actif:true,noeudsMax:200,enVolMax:2},delaiMs:5000,sautMin:2};
const LOIN={...POTREE,loin:{actif:true,sautMin:11,coupesMax:40}};
const de=(e,k)=>e.evts.filter(x=>x.kind===k);
const boite=(pc,cx)=>tous(pc).filter(n=>n.boundingBox.min.x<=cx+.5+2&&n.boundingBox.max.x>=cx+.5-2);
/* Lot : 20, 21, 22, 23 à faire, puis 90 (saut de 67) : la cible lointaine 90 est connue dès la capture de 20, trois coupes avant. */
const LOT={20:'invalid',21:'invalid',22:'invalid',23:'invalid',90:'invalid',91:'invalid'};

test('cible lointaine prise trois coupes avant ; elle survit aux changements de coupe et aux captures, finit à l\'arrivée',async()=>{
 const {pc,e,journal,p}=monter({...LOIN,noeudsMax:12},()=>200,LOT);
 let r=p.apresCapture(contexte(pc,20));await e.tourner(4);
 assert.equal(p.etat().loin?.cible,90,'cible lointaine 90 prise dès la coupe 20');assert.ok(p.etat().loin.lances>0,'des load() lancés pour 90 dès la coupe 20');
 assert.ok(journal.maxEnVol<=2,'2 à la fois au plus');
 /* ESV passe à 21 : l'opération proche s'arrête, la lointaine continue */
 e.etiquette={part:23,cut:21};const n0=journal.appels.length;await e.tourner(6);await r;
 assert.ok(journal.appels.length>n0,'des load() lancés après le changement de coupe');
 /* capture de 21 : plus aucun lancement ; ceux en vol finissent */
 p.annuler('capture');const n1=journal.appels.length;await e.tourner(20);
 assert.equal(journal.appels.length,n1,'aucun load() pendant la capture');assert.equal(journal.enVol,0,'les load() lancés ont fini');
 r=p.apresCapture(contexte(pc,21));await e.tourner(20);await r;
 for(const c of [22,23]){e.etiquette={part:23,cut:c};await e.tourner(5);p.annuler('capture');await e.tourner(3);r=p.apresCapture(contexte(pc,c));await e.tourner(30);await r;}
 assert.equal(de(e,'prechauffage-loin').length,0,'pas encore arrivée');
 /* arrivée à 90 : instantané au début de la capture, Potree charge le reste, bilan à la fin de la capture */
 e.etiquette={part:23,cut:90};await e.tourner(2);p.annuler('capture');
 await e.tourner(80,()=>{for(const n of boite(pc,90))if(!n.loaded)n.load();});   /* Potree charge lui-même ce qui manque */
 r=p.apresCapture(contexte(pc,90));await e.tourner(5);await r;
 const L=de(e,'prechauffage-loin');assert.equal(L.length,1,'une opération lointaine');const l=L[0];
 assert.equal(l.motif,'arrivee');assert.equal(l.cible,90);assert.equal(l.coupe,20);assert.equal(l.saut,67);assert.equal(l.avant,3);assert.equal(l.captures,3,'trois captures entre le départ et l\'arrivée');
 assert.ok(l.msAvant>0);assert.ok(l.charges>0&&l.charges<=32,'chargés avant l\'arrivée, dans le plafond de 32 : '+l.charges);
 assert.equal(l.nousPrets,l.charges,'chargés par nous à l\'arrivée');assert.ok(l.prets>=l.nousPrets);assert.ok(l.boite>=l.prets);
 assert.ok(l.potreeLui>0,'Potree a chargé lui-même le reste');assert.equal(l.echecs,0);assert.equal(typeof l.plafond,'boolean');
 sansAdresse(e.evts);
});

test('plafond par cible inchangé (noeudsMax) ; Potree qui charge met l\'opération lointaine en pause, sans l\'arrêter',async()=>{
 const {pc,e,journal,p}=monter({...LOIN,noeudsMax:5},()=>200,LOT);
 const r=p.apresCapture(contexte(pc,20));await e.tourner(5);await r;
 e.potreeExterne=1;const n0=journal.appels.length;await e.tourner(20);assert.equal(journal.appels.length,n0,'aucun lancement quand Potree charge');
 e.potreeExterne=0;await e.tourner(60);
 assert.ok(p.etat().loin,'toujours en cours');
 assert.ok(p.etat().loin.lances<=5,'5 nœuds au plus pour la cible : '+p.etat().loin.lances);
});

test('cible changée : l\'opération lointaine finit en « remplace » ; réglage éteint par défaut, allumé livré',async()=>{
 const {pc,e,p}=monter(LOIN,()=>200,LOT);
 let r=p.apresCapture(contexte(pc,20));await e.tourner(10);await r;
 /* la relecture donne une autre cible lointaine (110) */
 r=p.apresCapture({...contexte(pc,21),suivante:{source:'relu',cut:22,part:23,de:21,loin:{cut:110,avant:1,saut:88}}});await e.tourner(10);await r;
 const L=de(e,'prechauffage-loin');assert.equal(L.length,1);assert.equal(L[0].motif,'remplace');assert.equal(L[0].cible,90);
 assert.equal(p.etat().loin.cible,110,'nouvelle cible : celle du service worker');
 assert.equal(P.reglage({actif:true}).loin.actif,false,'module : éteinte');
 const S=require('../src/settings.js').lot.chargement.prechauffer.loin;assert.deepEqual({...S},{actif:true,sautMin:11,coupesMax:40},'livré : allumée, 11 coupes, 40 à l\'avance');
});

test('bilan à l\'arrivée par l\'arbre (voie potree) : boîte, chargés à l\'arrivée, par nous, puis par Potree lui-même',async()=>{
 const {pc,e,journal,p}=monter(POTREE,()=>200);
 let r=p.apresCapture(contexte(pc,20));await e.tourner(12);
 e.etiquette={part:23,cut:70};await e.tourner(10);await r;p.annuler('capture');
 await e.tourner(80,()=>{for(const n of boite(pc,70))if(!n.loaded)n.load();});
 r=p.apresCapture(contexte(pc,70));await e.tourner(200);await r;
 const b=de(e,'prechauffage-bilan').at(-1);
 assert.ok(b,'un bilan');assert.equal(b.juste,true);
 for(const k of ['boite','prets','nousPrets','nousEnVol','boiteFin','potreeLui','nousApres'])assert.ok(Number.isInteger(b[k]),k+' entier : '+b[k]);
 assert.ok(b.nousPrets>0,'des nœuds chargés par nous à l\'arrivée');assert.ok(b.potreeLui>0,'des nœuds chargés ensuite par Potree seul');
 assert.ok(b.prets+b.potreeLui+b.nousApres<=b.boiteFin);
 sansAdresse(e.evts);
});

test('prechauffage-vue : `camera`, jamais `type` (le type de l\'enveloppe du journal)',async()=>{
 const {pc,e,p}=monter(POTREE,()=>200);
 const cam={isOrthographicCamera:true,projectionMatrix:{elements:[5,0,0,0,0,4.38,0,0,0,0,-0.0001,0,0,0,0,1]}};
 const r=p.apresCapture({...contexte(pc),vue:()=>({camera:cam,pointBudget:2000000,pointLoadLimit:4000000})});await e.tourner(200);await r;
 const v=de(e,'prechauffage-vue')[0];assert.ok(v);assert.equal(v.camera,'orthographique');assert.equal('type' in v,false);assert.equal(v.limitePoints,4000000);
});
