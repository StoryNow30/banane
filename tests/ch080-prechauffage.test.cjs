'use strict';
/* CH-080 (D-309) — PRÉCHAUFFER LA COUPE SUIVANTE QUAND ELLE EST ÉLOIGNÉE, module de page `src/prechauffage.js`.
 * Cause mesurée sur le lot du 09/11 (chantiers/CH-080/etude.md) : la page ne recevait qu'une fenêtre de ±10 lignes de la table B1 ; toute coupe suivante
 * plus loin (sauts du lot) ou déjà validée (relecture) donnait `sans-suivante`. Essais purs (Node), arbre EPT synthétique, `fetch` simulé. Ils prouvent :
 *  - la coupe suivante vient de sa source : ligne `loin` de l'observateur (suivante non validée de toute la table : `liste-esv`), cible du service worker
 *    (`relecture`, `passe-differes`) ; la fenêtre B1 n'est que le dernier recours (`b1-fenetre`) ;
 *  - une cible du service worker qui ne porte pas l'identité de CETTE capture est périmée : rien n'est demandé (règle 4.2) ;
 *  - seuil `sautMin` (défaut 11) : en dessous, rien n'est demandé (`saut-court`) ;
 *  - l'événement `prechauffage` porte `saut` (entier signé) et `source` (liste fermée), sans adresse ni clé ; plafonds inchangés. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/prechauffage.js');

/* Arbre EPT : cube de 128 m, nœuds connus jusqu'à `connu`, matrice identité. Cut N : x = N mètres, rails y = 10 et 11,435, z = 10. */
function arbre({profondeur=7,connu=7,charges=()=>false,taille=128}={}){
 const faire=(d,x,y,z)=>{const s=taille/2**d,nom=`${d}-${x}-${y}-${z}`,b={min:{x:x*s,y:y*s,z:z*s},max:{x:(x+1)*s,y:(y+1)*s,z:(z+1)*s}};
  const n={key:{d,x,y,z},level:d,numPoints:d===connu&&connu<profondeur?-1:1000,boundingBox:b,children:{},loaded:charges(nom,d,b),loading:false,filename:()=>nom,url:()=>'/nuage/ept-data/'+nom};
  if(d<Math.min(profondeur,connu)){let i=0;for(const a of [0,1])for(const c of [0,1])for(const e of [0,1]){const s2=s/2,bx={min:{x:(2*x+a)*s2,y:(2*y+c)*s2,z:(2*z+e)*s2}};
    /* couloir des cuts seulement (y, z autour de 10), pour borner la taille de l'arbre */
    if(bx.min.y<=12&&bx.min.y+s2>=9&&bx.min.z<=11&&bx.min.z+s2>=9)n.children[i]=faire(d+1,2*x+a,2*y+c,2*z+e);i++;}}
  return n;};
 return {pcoGeometry:{root:faire(0,0,0,0),loader:{extension:()=>'.bin'}},matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}};}
/* Chargé par Potree : niveaux 0-1 partout, tout ce qui contient le cut courant (x = cx). */
const pres=cx=>(nom,d,b)=>d<=1||(b.min.x<=cx+.5&&b.max.x>=cx-.5&&b.min.y<=11.935&&b.max.y>=9.5&&b.min.z<=10.5&&b.max.z>=9.5);
const ligne=(i,s='valid')=>({i,s,t:false,v:false,f:false,e:[i,10,10,i,11.435,10]});
/* Table B1 de l'observateur : `statuts` (défaut : tout validé sauf le cut courant), réponse à la manière de src/esv-observer.js `voisins`. */
function observateur(lignes,statuts){return (cut,world,quoi)=>{const st=i=>statuts[i]||'valid',rows=[];
 for(let i=Math.max(0,cut-10);i<=Math.min(lignes-1,cut+10);i++)rows.push(ligne(i,st(i)));
 const out={ok:true,table:{lignes,tables:1},geo:{index:cut,mm:0,secondMm:null},rows};
 if(Number.isInteger(quoi?.cible))out.loin=quoi.cible>=0&&quoi.cible<lignes?ligne(quoi.cible,st(quoi.cible)):null;
 else if(quoi?.suivante===true){out.loin=null;for(let i=cut+1;i<lignes;i++)if(st(i)!=='valid'){out.loin=ligne(i,st(i));break;}}
 return out;};}
/* Ancien adaptateur (CH-077) : `voisins(cut, world)` sans troisième argument, fenêtre seule. */
const ancien=(lignes,statuts)=>{const o=observateur(lignes,statuts);return (cut,world)=>o(cut,world);};

function environnement({reglage={},voisins,etiquette={part:23,cut:20}}={}){
 const e={evts:[],demandes:[],etiquette,demandesVoisins:[]};let images=[];
 e.env={reglage:{actif:true,rayonM:.75,sautMin:11,...reglage},chargements:()=>0,etiquette:()=>e.etiquette,poster:x=>e.evts.push(JSON.parse(JSON.stringify(x))),
  image:()=>new Promise(r=>images.push(r)),maintenant:()=>0,
  voisins:(...a)=>{e.demandesVoisins.push(JSON.parse(JSON.stringify(a[2]??null)));return voisins(...a);},AbortController,
  fetch:(url,init)=>new Promise((res,rej)=>{e.demandes.push(url);init.signal.addEventListener('abort',()=>rej(Object.assign(Error('abandon'),{name:'AbortError'})));
   queueMicrotask(()=>res({ok:true,status:200,headers:{get:k=>k==='Cache-Control'?'max-age=3600':null},arrayBuffer:async()=>new ArrayBuffer(50000)}));}),
  relever:()=>[]};
 e.tourner=async(n=40)=>{for(let i=0;i<n;i++){const f=images;images=[];for(const r of f)r();await new Promise(r=>setImmediate(r));}};
 return e;}
const contexte=(pc,cut=20,suivante)=>({partie:23,coupe:cut,rails:{left:[0,0,0],right:[0,1.435,0]},origine:[cut,10,10],pointclouds:[pc],...(suivante!==undefined?{suivante}:{})});
async function jouer(e,ctx){const p=P.creer(e.env),r=p.apresCapture(ctx);await e.tourner();await r;return e.evts.filter(x=>x.kind==='prechauffage').at(-1);}
const ADRESSE=/\/|https?:|ept-data|\.bin|\d+-\d+-\d+-\d+/;
const sansAdresse=evts=>assert.ok(!ADRESSE.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse ni clé : '+JSON.stringify(evts));

test('réglage : `sautMin` livré à 11 ; clé absente ou hors bornes : 1 (comportement de CH-077) ; sources en liste fermée',()=>{
 assert.equal(P.DEFAUT.sautMin,1);assert.equal(P.reglage({actif:true}).sautMin,1);
 assert.equal(P.reglage({actif:true,sautMin:0}).sautMin,1,'hors bornes : défaut');assert.equal(P.reglage({actif:true,sautMin:3}).sautMin,3);
 assert.deepEqual([...P.SOURCES],['liste-esv','relu','passe-differes','b1-fenetre']);
 const S=require('../src/settings.js');assert.equal(S.lot.chargement.prechauffer.sautMin,11,'réglage livré : seuil de la mesure');
 assert.equal(S.lot.chargement.prechauffer.noeudsMax,24);assert.equal(S.lot.chargement.prechauffer.octetsMax,8388608);assert.equal(S.lot.chargement.prechauffer.enVolMax,2,'plafonds inchangés');
});

test('lot, saut de 50 coupes : la suivante non validée de TOUTE la liste (source liste-esv) ; nœuds de sa zone demandés',async()=>{
 const pc=arbre({charges:pres(20)}),e=environnement({voisins:observateur(200,{20:'invalid',70:'invalid'})});
 const ev=await jouer(e,contexte(pc,20));
 assert.deepEqual(e.demandesVoisins,[{suivante:true}],'la page demande la suivante à l’observateur');
 assert.equal(ev.predite,70);assert.equal(ev.source,'liste-esv');assert.equal(ev.saut,50);
 assert.ok(ev.noeuds>0&&ev.noeuds<=24,'nœuds demandés : '+ev.noeuds);assert.equal(e.demandes.length,ev.noeuds);
 for(const u of e.demandes){const [d,x]=/(\d+)-(\d+)-\d+-\d+\.bin$/.exec(u).slice(1).map(Number),s=128/2**d;assert.ok(x*s<=70.75&&(x+1)*s>=69.25,'nœud dans la zone de la coupe 70 : '+u);}
 sansAdresse(e.evts);
});

test('sans le correctif (ancien adaptateur, fenêtre ±10 seule) : saut de 50 → sans-suivante, rien demandé (essai rouge du ticket)',async()=>{
 const pc=arbre({charges:pres(20)}),e=environnement({voisins:ancien(200,{20:'invalid',70:'invalid'})});
 const ev=await jouer(e,contexte(pc,20));assert.equal(ev.motif,'sans-suivante');assert.equal(e.demandes.length,0);assert.equal(ev.source,null);
});

test('seuil : saut de 5 (< 11) → saut-court, rien demandé ; fenêtre B1 (dernier recours) seulement si rien d’autre',async()=>{
 const pc=arbre({charges:pres(20)});
 const e1=environnement({voisins:observateur(200,{20:'invalid',25:'invalid'})}),ev1=await jouer(e1,contexte(pc,20));
 assert.equal(ev1.motif,'saut-court');assert.equal(ev1.saut,5);assert.equal(ev1.source,'liste-esv');assert.equal(e1.demandes.length,0);
 const e2=environnement({voisins:ancien(200,{20:'invalid',25:'invalid'}),reglage:{sautMin:2}}),ev2=await jouer(e2,contexte(pc,20));
 assert.equal(ev2.source,'b1-fenetre');assert.equal(ev2.predite,25);assert.equal(ev2.saut,5);
});

test('relecture : cible du service worker, même validée, même en arrière ; source relecture ; saut signé',async()=>{
 const pc=arbre({charges:pres(80)}),e=environnement({voisins:observateur(200,{}),etiquette:{part:23,cut:80}});
 const ev=await jouer(e,contexte(pc,80,{part:23,de:80,cut:30,source:'relu',op:'x'}));
 assert.deepEqual(e.demandesVoisins,[{cible:30}]);assert.equal(ev.predite,30);assert.equal(ev.source,'relu');assert.equal(ev.saut,-50);assert.ok(ev.noeuds>0);
 const e2=environnement({voisins:observateur(200,{})}),ev2=await jouer(e2,contexte(arbre({charges:pres(20)}),20,{part:23,de:20,cut:90,source:'passe-differes',op:'y'}));
 assert.equal(ev2.source,'passe-differes');assert.equal(ev2.saut,70);
});

test('cible périmée (autre capture, autre partie, source inconnue) ou absente de la table : rien demandé, jamais de repli sur la fenêtre',async()=>{
 const pc=arbre({charges:pres(20)});
 for(const h of [{part:23,de:19,cut:90,source:'relu'},{part:9,de:20,cut:90,source:'relu'},{part:23,de:20,cut:90,source:'lot'},{part:23,de:20,cut:-1,source:'relu'},'90']){
  const e=environnement({voisins:observateur(200,{21:'invalid'})}),ev=await jouer(e,contexte(pc,20,h));
  assert.equal(ev.motif,'indice-perime',JSON.stringify(h));assert.equal(e.demandes.length,0);assert.equal(e.demandesVoisins.length,0,'l’observateur n’est même pas interrogé');}
 const e=environnement({voisins:observateur(50,{21:'invalid'})}),ev=await jouer(e,contexte(pc,20,{part:23,de:20,cut:90,source:'relu'}));
 assert.equal(ev.motif,'sans-cible');assert.equal(e.demandes.length,0);
});

test('identité d’opération et annulation : une nouvelle capture annule le préchauffage d’un saut lointain',async()=>{
 const pc=arbre({charges:pres(20)}),e=environnement({voisins:observateur(200,{20:'invalid',70:'invalid'})});
 e.env.fetch=(url,init)=>new Promise((res,rej)=>{e.demandes.push(url);init.signal.addEventListener('abort',()=>rej(Object.assign(Error('abandon'),{name:'AbortError'})));});
 const p=P.creer(e.env),r=p.apresCapture(contexte(pc,20));await e.tourner(5);
 assert.ok(e.demandes.length>=1&&e.demandes.length<=2,'deux en vol au plus');p.annuler('capture');await e.tourner(5);await r;
 const ev=e.evts.find(x=>x.kind==='prechauffage');assert.equal(ev.motif,'capture');assert.equal(ev.annule,true);assert.equal(ev.termines,0);assert.equal(ev.saut,50);
});

/* ---- CH-080, étape « hiérarchie » (demande de l'intégrateur) : la zone lointaine n'a que des frontières (hiérarchie non lue). */
/* Fichier de hiérarchie EPT de la clé : descendants sur 2 niveaux, −1 au dernier (sauf au fond, 7). */
function fichierHier(cle){const [d,x,y,z]=cle.split('-').map(Number),h={};
 for(let r=0;r<=2&&d+r<=7;r++){const k=2**r;for(let a=0;a<k;a++)for(let b=0;b<k;b++)for(let c=0;c<k;c++)h[`${d+r}-${x*k+a}-${y*k+b}-${z*k+c}`]=r===2&&d+r<7?-1:1000;}return h;}
function avecHier(e){const lus=[];e.hier=lus;e.env.fetch=(url,init)=>new Promise((res,rej)=>{e.demandes.push(url);init.signal.addEventListener('abort',()=>rej(Object.assign(Error('abandon'),{name:'AbortError'})));
 const m=/ept-hierarchy\/(\d+-\d+-\d+-\d+)\.json$/.exec(url);if(m)lus.push(m[1]);
 const corps=m?new TextEncoder().encode(JSON.stringify(fichierHier(m[1]))).buffer:new ArrayBuffer(50000);
 queueMicrotask(()=>res({ok:true,status:200,headers:{get:()=>null},arrayBuffer:async()=>corps}));});return e;}
/* Arbre connu comme sur le terrain : hiérarchie lue jusqu'au niveau 2 (frontières −1 sans enfants), chargé autour du cut courant. */
const arbreFrontiere=()=>{const pc=arbre({charges:pres(20)}),elaguer=n=>{if(n.level===2&&!(n.boundingBox.min.x<=20&&n.boundingBox.max.x>=20)){n.numPoints=-1;n.children={};return;}for(const e of Object.values(n.children))elaguer(e);};
 elaguer(pc.pcoGeometry.root);return pc;};   /* hiérarchie lue en profondeur autour du cut courant (x = 20) seulement, frontières −1 au niveau 2 ailleurs */

test('hiérarchie éteinte (défaut du module) : seules les frontières sont comptées, aucun fichier de hiérarchie demandé',async()=>{
 const e=avecHier(environnement({voisins:observateur(200,{20:'invalid',70:'invalid'})})),ev=await jouer(e,contexte(arbreFrontiere(),20));
 assert.equal(P.DEFAUT.hierarchie,false);assert.equal(e.hier.length,0);assert.ok(ev.frontiere>0);assert.equal(ev.hierarchies,0);
});

test('hiérarchie allumée : fichiers des frontières de la zone lus, nœuds de la zone déduits et demandés, plafonds tenus',async()=>{
 const e=avecHier(environnement({voisins:observateur(200,{20:'invalid',70:'invalid'}),reglage:{hierarchie:true}})),ev=await jouer(e,contexte(arbreFrontiere(),20));
 assert.ok(ev.hierarchies>=1&&ev.hierarchies<=8,'fichiers de hiérarchie : '+ev.hierarchies);assert.equal(e.hier.length,ev.hierarchies);
 assert.ok(ev.deduits>0,'nœuds déduits : '+ev.deduits);assert.ok(ev.noeuds>0);assert.ok(ev.noeuds+ev.hierarchies<=24,'plafond de nœuds : fichiers compris');
 const donnees=e.demandes.filter(u=>/ept-data/.test(u));assert.equal(donnees.length,ev.noeuds);
 for(const u of donnees){const [d,x]=/(\d+)-(\d+)-\d+-\d+\.bin$/.exec(u).slice(1).map(Number),s=128/2**d;assert.ok(x*s<=70.75&&(x+1)*s>=69.25,'nœud dans la zone de la coupe 70 : '+u);assert.match(u,/^\/nuage\/ept-data\/\d+-\d+-\d+-\d+\.bin$/,'adresse de Potree');}
 for(const k of e.hier){const [d,x]=k.split('-').map(Number),s=128/2**d;assert.ok(x*s<=70.75&&(x+1)*s>=69.25,'hiérarchie de la zone seulement : '+k);}
 assert.ok(Math.max(...donnees.map(u=>Number(/(\d+)-\d+-\d+-\d+\.bin$/.exec(u)[1])))>2,'des nœuds plus profonds que la hiérarchie connue');
 sansAdresse(e.evts);
});

test('hiérarchie : une nouvelle capture annule la lecture en cours ; rien n’est déduit ni demandé ensuite',async()=>{
 const e=environnement({voisins:observateur(200,{20:'invalid',70:'invalid'}),reglage:{hierarchie:true}});
 e.env.fetch=(url,init)=>new Promise((res,rej)=>{e.demandes.push(url);init.signal.addEventListener('abort',()=>rej(Object.assign(Error('abandon'),{name:'AbortError'})));});
 const p=P.creer(e.env),r=p.apresCapture(contexte(arbreFrontiere(),20));await e.tourner(5);
 assert.ok(e.demandes.length>=1&&e.demandes.every(u=>/ept-hierarchy/.test(u)),'d’abord la hiérarchie');const n=e.demandes.length;
 p.annuler('capture');await e.tourner(10);await r;
 assert.equal(e.demandes.length,n,'rien ne repart');const ev=e.evts.find(x=>x.kind==='prechauffage');assert.equal(ev.motif,'capture');assert.equal(ev.noeuds,0);assert.equal(ev.deduits,0);
});
