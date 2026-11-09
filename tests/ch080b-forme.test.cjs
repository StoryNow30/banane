'use strict';
/* CH-080b — FORME DES NŒUDS DE POTREE DANS ESV. Sur le vrai ESV (lots « Vision 5 » et « Vision 6 » du 09/11, ÉTABLI par les comptes des événements), aucun
 * nœud non chargé n'a jamais eu de nom lu (`filename()` puis `key.name()`) : 733 préchauffages sur 733 sans candidat, des frontières jamais lues. La forme
 * réelle est attendue d'un relevé de console (chantiers/CH-080/releve-console.js). Ces essais prouvent, sur des formes SYNTHÉTIQUES :
 *  - forme SUPPOSÉE « r » (filename() rend le nom de Potree « r » + chiffres, key {d,x,y,z} entière, url() = `…/ept-data/D-X-Y-Z`) : nœuds nommés, demandés ;
 *  - décodage du nom de Potree (toPotreeName) en D-X-Y-Z ;
 *  - adresse non sûre (url() avec « ? », sans ept.url) : rien n'est demandé, motif `sans-adresse`, compté (`sansAdresse`) ;
 *  - nœud sans url() : préfixe hérité de l'ancêtre le plus proche dont l'adresse est sûre ;
 *  - forme du premier nœud non chargé (`formeNoeud`, bits) et nœuds sans nom (`sansNom`) dans l'événement, sans aucune adresse ;
 *  - réseau occupé : la prédiction est faite d'abord, l'événement porte `predite`, `saut` et `source`. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/prechauffage.js');

function arbre({charges}){const faire=(d,x,y,z)=>{const s=128/2**d,nom=`${d}-${x}-${y}-${z}`,b={min:{x:x*s,y:y*s,z:z*s},max:{x:(x+1)*s,y:(y+1)*s,z:(z+1)*s}};
  const n={key:{d,x,y,z},level:d,numPoints:1000,boundingBox:b,children:{},loaded:charges(d,b),loading:false,filename:()=>nom,url:()=>'/nuage/ept-data/'+nom};
  if(d<7){let i=0;for(const a of [0,1])for(const c of [0,1])for(const e of [0,1]){const s2=s/2,y0=(2*y+c)*s2,z0=(2*z+e)*s2;if(y0<=12&&y0+s2>=9&&z0<=11&&z0+s2>=9)n.children[i]=faire(d+1,2*x+a,2*y+c,2*z+e);i++;}}
  return n;};
 return {pcoGeometry:{root:faire(0,0,0,0),loader:{extension:()=>'.bin'}},matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}};}
const pres=cx=>(d,b)=>d<=1||(b.min.x<=cx+.5&&b.max.x>=cx-.5);
const nomPotree=({d,x,y,z})=>'r'+Array.from({length:d},(_,i)=>{const m=1<<(d-i-1);return (x&m?4:0)+(y&m?2:0)+(z&m?1:0);}).join('');
const visiter=(n,f)=>{f(n);for(const e of Object.values(n.children))visiter(e,f);};
/* Forme SUPPOSÉE « r » : filename() rend le nom de Potree, `name` aussi ; key entière ; url() = …/ept-data/D-X-Y-Z (construction EPT). */
const formeR=pc=>{visiter(pc.pcoGeometry.root,n=>{const r=nomPotree(n.key);n.filename=()=>r;n.name=r;});return pc;};
const ligne=(i,s='valid')=>({i,s,e:[i,10,10,i,11.435,10]});
const voisins=(cut,w,quoi)=>({ok:true,table:{lignes:200,tables:1},geo:{index:cut},rows:[ligne(cut,'invalid')],...(quoi?.suivante?{loin:ligne(70,'invalid')}:{})});
function env({reglage={},compteur=0}={}){const e={evts:[],demandes:[]};let images=[];
 e.env={reglage:{actif:true,rayonM:.75,sautMin:11,...reglage},chargements:()=>compteur,etiquette:()=>({part:23,cut:20}),poster:x=>e.evts.push(JSON.parse(JSON.stringify(x))),
  image:()=>new Promise(r=>images.push(r)),maintenant:()=>0,voisins,AbortController,relever:()=>[],
  fetch:(url,init)=>new Promise((res,rej)=>{e.demandes.push(url);init.signal.addEventListener('abort',()=>rej(Object.assign(Error('abandon'),{name:'AbortError'})));queueMicrotask(()=>res({ok:true,status:200,headers:{get:()=>null},arrayBuffer:async()=>new ArrayBuffer(5000)}));})};
 e.tourner=async()=>{for(let i=0;i<40;i++){const f=images;images=[];for(const r of f)r();await new Promise(r=>setImmediate(r));}};return e;}
const ctx=pc=>({partie:23,coupe:20,rails:{left:[0,0,0],right:[0,1.435,0]},origine:[20,10,10],pointclouds:[pc]});
async function jouer(e,pc){const p=P.creer(e.env),r=p.apresCapture(ctx(pc));await e.tourner();await r;return e.evts.filter(x=>x.kind==='prechauffage').at(-1);}
const ADRESSE=/\/|https?:|ept-data|\.bin|\d+-\d+-\d+-\d+|\?/;
const sansAdresse=evts=>assert.ok(!ADRESSE.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse : '+JSON.stringify(evts));

test('forme SUPPOSÉE « r » (filename() = nom de Potree) : nœuds nommés par la clé, demandés à l’adresse EPT',async()=>{
 const e=env(),ev=await jouer(e,formeR(arbre({charges:pres(20)})));
 assert.ok(ev.candidats>0,'candidats : '+ev.candidats);assert.ok(ev.noeuds>0);assert.equal(ev.sansNom,0);
 for(const u of e.demandes)assert.match(u,/^\/nuage\/ept-data\/\d+-\d+-\d+-\d+\.bin$/);
 assert.ok((ev.formeNoeud&1)&&!(ev.formeNoeud&2)&&(ev.formeNoeud&4)&&(ev.formeNoeud&16)&&(ev.formeNoeud&64)&&(ev.formeNoeud&1024),'bits de forme : '+ev.formeNoeud);
 sansAdresse(e.evts);
});

test('nom de Potree décodé : seul (ni filename ni key), il donne la clé D-X-Y-Z',async()=>{
 const pc=arbre({charges:pres(20)});visiter(pc.pcoGeometry.root,n=>{const r=nomPotree(n.key),k=`${n.key.d}-${n.key.x}-${n.key.y}-${n.key.z}`;n.name=r;delete n.filename;delete n.key;n.url=()=>'/nuage/ept-data/'+k;});
 const e=env(),ev=await jouer(e,pc);assert.ok(ev.noeuds>0);assert.equal(ev.sansNom,0);
});

test('aucune adresse sûre (url() avec « ? », sans ept.url) : rien n’est demandé, motif sans-adresse, compté',async()=>{
 const pc=arbre({charges:pres(20)});visiter(pc.pcoGeometry.root,n=>{const u=n.url();n.url=()=>u+'?jeton=x';});
 const e=env(),ev=await jouer(e,pc);assert.equal(e.demandes.length,0);assert.equal(ev.motif,'sans-adresse');assert.ok(ev.sansAdresse>0);assert.ok(ev.formeNoeud&512);sansAdresse(e.evts);
});

test('nœud sans url() : préfixe hérité de l’ancêtre le plus proche dont l’adresse est sûre ; ept.url d’abord',async()=>{
 const pc=arbre({charges:pres(20)});visiter(pc.pcoGeometry.root,n=>{if(n.level>=3)delete n.url;});
 const e=env(),ev=await jouer(e,pc);assert.ok(ev.noeuds>0);for(const u of e.demandes)assert.match(u,/^\/nuage\/ept-data\/\d+-\d+-\d+-\d+\.bin$/);
 const pc2=arbre({charges:pres(20)}),ept={url:'/autre/'};visiter(pc2.pcoGeometry.root,n=>{n.ept=ept;n.url=()=>'/ailleurs/'+n.filename();});
 const e2=env(),ev2=await jouer(e2,pc2);assert.ok(ev2.noeuds>0);for(const u of e2.demandes)assert.match(u,/^\/autre\/ept-data\/\d+-\d+-\d+-\d+\.bin$/,'construction de Potree : ept.url + ept-data/');
});

test('aucun nom lisible : comptés `sansNom`, rien demandé',async()=>{
 const pc=arbre({charges:pres(20)});visiter(pc.pcoGeometry.root,n=>{if(!n.loaded){n.filename=()=>'nœud';delete n.key;}});
 const e=env(),ev=await jouer(e,pc);assert.equal(e.demandes.length,0);assert.ok(ev.sansNom>0);assert.equal(ev.candidats,0);
});

test('réseau occupé : la prédiction est faite d’abord ; predite, saut et source dans l’événement ; rien demandé',async()=>{
 const e=env({compteur:3}),ev=await jouer(e,arbre({charges:pres(20)}));
 assert.equal(ev.motif,'reseau-occupe');assert.equal(ev.predite,70);assert.equal(ev.saut,50);assert.equal(ev.source,'liste-esv');assert.equal(e.demandes.length,0);
});
