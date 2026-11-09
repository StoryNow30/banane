'use strict';
/* CH-093 — LE PRÉCHAUFFAGE ANTICIPE LE PASSAGE À LA RELECTURE (module de la page, src/prechauffage.js).
 * La première coupe relue n'est connue que du service worker, à la clôture du lot. Elle arrive à la page par deux relais :
 *  - fin du lot : `anticiper(ctx)` (commande `prechauffer` de l'adaptateur, hors de toute capture) ;
 *  - fin de la passe des différés : `loin` joint aux captures de la passe, marqué `mode:true`, y compris à la dernière (indice sans `cut`).
 * Essais purs (Node), arbre synthétique de CH-088 (load() à la manière de Potree 1.8.2). Ils prouvent :
 *  - la cible part dans l'opération lointaine (voie potree), source `changement-mode`, et finit à l'arrivée (`prechauffage-loin`) ;
 *  - mêmes plafonds (`noeudsMax` par cible, `enVolMax` à nous en tout), rien pendant une capture, rien pendant la pause de CH-089 ;
 *  - un réglage coupe (`relecture.actif`) : éteint dans le module, allumé dans le réglage livré ;
 *  - refus : saut court, autre partie, cible inconnue de la table, voie fetch. Aucune adresse ni clé dans les événements. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/prechauffage.js');

function arbre({profondeur=7,taille=128,charges=()=>false,potree,dureeImages=2,journal}={}){
 const faire=(d,x,y,z)=>{const s=taille/2**d,nom=`${d}-${x}-${y}-${z}`,b={min:{x:x*s,y:y*s,z:z*s},max:{x:(x+1)*s,y:(y+1)*s,z:(z+1)*s}};
  const n={key:{d,x,y,z},level:d,numPoints:1000,nodeinfo:{pointCount:1000},boundingBox:b,children:{},loaded:charges(nom,d,b),loading:false,filename:()=>nom,url:()=>'/nuage/ept-data/'+nom,geometry:null};
  if(n.loaded)n.geometry={attributes:{position:{array:new Float32Array(3000)}}};
  n.load=async function(){journal.appels.push(nom);if(this.loaded||this.loading)return;if(potree.numNodesLoading>=potree.maxNodesLoading)return;
   this.loading=true;++potree.numNodesLoading;journal.enVol++;journal.maxEnVol=Math.max(journal.maxEnVol,journal.enVol);
   potree.attentes.push({images:dureeImages,fin:()=>{this.geometry={attributes:{position:{array:new Float32Array(3000)},color:{array:new Uint8Array(4000)}}};this.loaded=true;this.loading=false;--potree.numNodesLoading;journal.enVol--;journal.charges.push(nom);}});};
  n.dispose=()=>{};
  if(d<profondeur){let i=0;for(const a of [0,1])for(const c of [0,1])for(const e of [0,1]){const s2=s/2,bx={min:{x:(2*x+a)*s2,y:(2*y+c)*s2,z:(2*z+e)*s2}};
    if(bx.min.y<=13&&bx.min.y+s2>=8&&bx.min.z<=11&&bx.min.z+s2>=9)n.children[i]=faire(d+1,2*x+a,2*y+c,2*z+e);i++;}}
  return n;};
 return {pcoGeometry:{root:faire(0,0,0,0),loader:{extension:()=>'.bin'}},matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}};}
const pres=cx=>(nom,d,b)=>d<=1||(b.min.x<=cx+.5&&b.max.x>=cx-.5);
const ligne=(i,s='valid')=>({i,s,t:false,v:false,f:false,e:[i+.5,10,10,i+.5,11.435,10]});
/* Table de l'observateur : 127 lignes, toutes validées (le lot est fini), `cible` rendue telle quelle. */
function observateur(lignes=127){return (cut,world,quoi)=>{const rows=[];
 for(let i=Math.max(0,cut-10);i<=Math.min(lignes-1,cut+10);i++)rows.push(ligne(i));
 const out={ok:true,table:{lignes,tables:1},geo:{index:cut,mm:0,secondMm:null},rows};
 if(Number.isInteger(quoi?.cible))out.loin=quoi.cible>=0&&quoi.cible<lignes?ligne(quoi.cible):null;
 else if(quoi?.suivante===true||quoi?.premiere===true||Number.isInteger(quoi?.loin))out.loin=null;
 return out;};}
const POTREE={voie:'potree',memoire:{actif:true,noeudsMax:200,enVolMax:2},delaiMs:5000,sautMin:2,relecture:{actif:true,sautMin:11}};
/* Fin du lot au cut 120 ; la relecture commencera au cut 20 (100 coupes en arrière : sa boîte n'est plus chargée). */
function monter(reglage={},depart=120){const potree={numNodesLoading:0,maxNodesLoading:4,attentes:[]},journal={appels:[],charges:[],enVol:0,maxEnVol:0};
 const pc=arbre({charges:pres(depart),potree,journal});const e={evts:[],etiquette:{part:23,cut:depart},potreeExterne:0,horloge:0};let images=[];
 e.env={reglage:{actif:true,rayonM:.75,hierarchie:false,zone:'boite',horizon:2,candidatsMax:3,noeudsMax:32,octetsMax:10485760,...POTREE,...reglage},
  chargements:()=>potree.numNodesLoading+e.potreeExterne,etiquette:()=>e.etiquette,poster:x=>e.evts.push(JSON.parse(JSON.stringify(x))),
  image:()=>new Promise(r=>images.push(r)),maintenant:()=>e.horloge,tas:()=>50*1048576,voisins:observateur(),AbortController,fetch:()=>Promise.reject(Error('aucun fetch attendu'))};
 e.tourner=async(n=200,chaque=null)=>{for(let i=0;i<n;i++){e.horloge+=16;chaque?.(i);for(const a of [...potree.attentes])if(--a.images<=0){potree.attentes.splice(potree.attentes.indexOf(a),1);a.fin();}
  const f=images;images=[];for(const r of f)r();await new Promise(r=>setImmediate(r));}};
 return {pc,e,journal,potree,p:P.creer(e.env)};}
const contexte=(pc,cut=120,plus={})=>({partie:23,coupe:cut,rails:{left:[0,0,0],right:[0,1.435,0]},origine:[cut+.5,10,10],pointclouds:[pc],...plus});
const cible=(cut=20,plus={})=>({cible:{part:23,cut,source:'changement-mode',...plus}});
const tous=pc=>{const out=[],pile=[pc.pcoGeometry.root];while(pile.length){const n=pile.pop();out.push(n);pile.push(...Object.values(n.children));}return out;};
const boite=(pc,cx)=>tous(pc).filter(n=>n.boundingBox.min.x<=cx+.5+2&&n.boundingBox.max.x>=cx+.5-2);
const de=(e,k)=>e.evts.filter(x=>x.kind===k);
const ADRESSE=/\/|https?:|ept-data|\.bin|\d+-\d+-\d+-\d+/;
const sansAdresse=evts=>assert.ok(!ADRESSE.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse ni clé : '+JSON.stringify(evts));
/* Arrivée de la relecture sur sa première coupe : étiquette, capture (Potree charge le reste), bilan à la fin de la capture. */
async function arriver(m,cut=20){const {pc,e,p}=m;e.etiquette={part:23,cut};await e.tourner(2);p.annuler('capture');
 await e.tourner(80,()=>{for(const n of boite(pc,cut))if(!n.loaded)n.load();});
 const r=p.apresCapture(contexte(pc,cut));await e.tourner(5);await r;}

test('fin du lot : la première coupe relue part dans l\'opération lointaine, source changement-mode, et finit à l\'arrivée',async()=>{
 const m=monter({noeudsMax:12}),{pc,e,journal,p}=m;
 assert.equal(typeof p.anticiper,'function','le module rend `anticiper`');
 const r=await p.anticiper(contexte(pc,120,cible(20)));
 assert.equal(r.motif,'loin');assert.equal(r.cible,20);
 await e.tourner(30);
 assert.equal(p.etat().loin?.cible,20);assert.ok(journal.appels.length>0,'des load() lancés avant toute capture de la relecture');assert.ok(journal.maxEnVol<=2,'2 à la fois au plus');
 assert.ok(journal.charges.length>0,'des nœuds de la cible chargés avant l\'arrivée');
 await arriver(m);
 const L=de(e,'prechauffage-loin');assert.equal(L.length,1);const l=L[0];
 assert.deepEqual([l.motif,l.source,l.cible,l.coupe,l.saut,l.avant],['arrivee','changement-mode',20,120,-100,0]);
 assert.ok(l.charges>0&&l.charges<=12,'chargés avant l\'arrivée, dans le plafond de 12 : '+l.charges);assert.equal(l.nousPrets,l.charges);assert.ok(l.boite>=l.prets);
 assert.ok(l.msAvant>0);assert.equal(l.echecs,0);
 sansAdresse(e.evts);
});

test('rien pendant une capture ; Potree qui charge met en pause ; plafond par cible inchangé',async()=>{
 const m=monter({noeudsMax:5}),{pc,e,journal,p}=m;
 p.annuler('capture');   /* une capture est en cours */
 const r=await p.anticiper(contexte(pc,120,cible(20)));assert.equal(r.motif,'loin','la cible est prise');
 await e.tourner(20);assert.equal(journal.appels.length,0,'aucun load() pendant la capture');
 const fin=p.apresCapture(contexte(pc,120));await e.tourner(3);
 assert.ok(journal.appels.length>0,'après la capture, les load() partent');
 e.potreeExterne=1;await e.tourner(4);const n0=journal.appels.length;await e.tourner(20);assert.equal(journal.appels.length,n0,'aucun lancement quand Potree charge');
 e.potreeExterne=0;await e.tourner(80);await fin;
 assert.ok(p.etat().loin?.lances<=5,'5 nœuds au plus pour la cible : '+p.etat().loin?.lances);assert.ok(journal.maxEnVol<=2);
});

test('la capture de fin de lot (sans indice) ne remplace pas une cible de changement de mode déjà prise',async()=>{
 /* Ordre inverse du terrain possible : la commande arrive pendant que la dernière capture du lot finit. */
 const m=monter({loin:{actif:true,sautMin:11,coupesMax:40}}),{pc,e,p}=m;
 await p.anticiper(contexte(pc,120,cible(20)));await e.tourner(5);
 p.annuler('capture');const r=p.apresCapture(contexte(pc,120));await e.tourner(30);await r;
 assert.equal(p.etat().loin?.cible,20,'toujours la première coupe relue');assert.equal(de(e,'prechauffage-loin').length,0,'pas de « remplace »');
});

test('règle de pause de CH-089 : pendant la pause, rien ; une erreur passagère arrête l\'opération sans éteindre',async()=>{
 const m=monter(),{pc,e,journal,p}=m;
 await p.anticiper(contexte(pc,120,cible(20)));await e.tourner(4);
 p.ressources([{name:'https://x.invalid/nuage/ept-data/'+journal.appels[0]+'.bin',initiatorType:'fetch',responseStatus:502}]);
 const l=de(e,'prechauffage-loin').at(-1);assert.equal(l?.motif,'pause-serveur');assert.equal(p.actif(),true);
 await e.tourner(10);const n=journal.appels.length;
 const r=await p.anticiper(contexte(pc,120,cible(20)));assert.equal(r.motif,'pause-serveur');
 await e.tourner(20);assert.equal(journal.appels.length,n,'rien pendant la pause');
 e.horloge+=10001;assert.equal((await p.anticiper(contexte(pc,120,cible(20)))).motif,'loin','après la pause, la cible repart');
});

test('un réglage coupe : éteint dans le module, allumé dans le réglage livré ; rien en voie fetch',async()=>{
 assert.equal(P.reglage({actif:true}).relecture.actif,false,'module : éteint');
 assert.deepEqual({...P.reglage({actif:true,relecture:{actif:true,sautMin:1}}).relecture},{actif:true,sautMin:11},'hors bornes : défaut');
 const S=require('../src/settings.js').lot.chargement.prechauffer.relecture;assert.deepEqual({...S},{actif:true,sautMin:11},'livré : allumé, 11 coupes');
 for(const reglage of [{relecture:{actif:false}},{relecture:undefined},{voie:'fetch'}]){
  const {pc,e,journal,p}=monter(reglage);const r=await p.anticiper(contexte(pc,120,cible(20)));await e.tourner(20);
  assert.equal(r.motif,'eteint',JSON.stringify(reglage));assert.equal(journal.appels.length,0);assert.equal(p.etat().loin,null);assert.equal(e.evts.length,0);}
});

test('refus : saut court, autre partie, source inconnue, cible absente de la table, repère illisible',async()=>{
 const cas=[[cible(112),'saut-court'],[cible(120),'saut-court'],[cible(20,{part:24}),'indice-perime'],[cible(20,{source:'relu'}),'indice-perime'],[cible(-1),'indice-perime'],
  [cible(500),'sans-cible'],[{},'indice-perime']];
 for(const [c,motif] of cas){const {pc,e,journal,p}=monter();const r=await p.anticiper(contexte(pc,120,c));await e.tourner(10);
  assert.equal(r.motif,motif,JSON.stringify(c));assert.equal(journal.appels.length,0);assert.equal(p.etat().loin,null);}
 const {pc,p}=monter();assert.equal((await p.anticiper({...contexte(pc,120,cible(20)),rails:{left:[0,0,0],right:[0,3,0]}})).motif,'repere');
 assert.equal((await p.anticiper({...contexte(pc,120,cible(20)),coupe:null})).motif,'indice-perime');
});

test('fin de la passe : `loin` marqué `mode` joint à une capture de la passe → source changement-mode ; la dernière capture (sans `cut`) le porte aussi',async()=>{
 const m=monter({loin:{actif:true,sautMin:11,coupesMax:40}}),{pc,e,p}=m;
 /* avant-dernier cut de la passe (120), le suivant (121) est proche ; la relecture commencera à 20 */
 let r=p.apresCapture(contexte(pc,120,{suivante:{source:'passe-differes',cut:121,part:23,de:120,loin:{cut:20,avant:1,saut:-101,mode:true}}}));await e.tourner(10);await r;
 assert.equal(p.etat().loin?.cible,20);
 /* dernier cut de la passe : plus de suivant dans la passe, l'indice ne porte que `loin` */
 e.etiquette={part:23,cut:121};await e.tourner(3);p.annuler('capture');await e.tourner(3);
 r=p.apresCapture(contexte(pc,121,{suivante:{source:'passe-differes',part:23,de:121,loin:{cut:20,avant:0,saut:-101,mode:true}}}));await e.tourner(30);const ev=await r;
 assert.notEqual(ev.motif,'indice-perime','un indice sans `cut` mais avec `loin.mode` est accepté');assert.equal(ev.motif,'loin');
 assert.equal(p.etat().loin?.cible,20,'la même opération continue');assert.equal(de(e,'prechauffage-loin').length,0,'pas de « remplace »');
 await arriver(m);
 const l=de(e,'prechauffage-loin')[0];assert.deepEqual([l.motif,l.source,l.cible,l.coupe,l.captures],['arrivee','changement-mode',20,120,1]);
 /* sans `mode`, un indice sans `cut` reste périmé (comportement de CH-080) */
 const m2=monter({loin:{actif:true,sautMin:11,coupesMax:40}});
 const ev2=await m2.p.apresCapture(contexte(m2.pc,120,{suivante:{source:'passe-differes',part:23,de:120,loin:{cut:20,avant:0,saut:-100}}}));assert.equal(ev2.motif,'indice-perime');
 sansAdresse(e.evts);
});

test('la commande de fin de lot puis les captures de la passe visent la même cible : une seule opération',async()=>{
 const m=monter({loin:{actif:true,sautMin:11,coupesMax:40}}),{pc,e,p}=m;
 await p.anticiper(contexte(pc,120,cible(20)));await e.tourner(5);
 e.etiquette={part:23,cut:118};await e.tourner(3);p.annuler('capture');await e.tourner(3);
 const r=p.apresCapture(contexte(pc,118,{suivante:{source:'passe-differes',part:23,de:118,loin:{cut:20,avant:0,saut:-98,mode:true}}}));await e.tourner(20);await r;
 assert.equal(de(e,'prechauffage-loin').length,0);assert.equal(p.etat().loin?.cible,20);
 await arriver(m);
 const l=de(e,'prechauffage-loin')[0];assert.deepEqual([l.motif,l.source,l.coupe,l.captures],['arrivee','changement-mode',120,1]);
});
