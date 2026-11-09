'use strict';
/* CH-080c — PRÉCHAUFFAGE AVEC LE NŒUD COMMUN DE POTREE (forme RELEVÉE dans ESV le 09/11 : PointCloudCopcGeometryNode d'une PointCloudEptGeometry ; Potree ≥ 1.8.2,
 * src/PointCloudEptGeometry.js et src/loader/ept/LaszipLoader.js). Nœud : `key` = [d, x, y, z], `name` « r… », `owner` = géométrie (`type` 'ept', `base`,
 * `ept.dataType` 'laszip', loadHierarchyPage), `nodeinfo` {pointCount} (absent : page de hiérarchie non lue), `numPoints` −1 tant que non chargé ; ni url() ni
 * filename(). Potree lit les données par fetch(`${base}/ept-data/<d-x-y-z>.laz`) et la hiérarchie par fetch(`${base}/ept-hierarchy/<clé>.json`).
 * Ces essais prouvent : nœuds de la zone demandés à CETTE adresse ; pages de hiérarchie de la zone lues puis nœuds déduits ; rien pour COPC, binaire,
 * zstandard, base avec « ? », ni pour un nœud à 0 point ; extension apprise discordante : rien ; bilan : la première entrée `fetch` d'une de nos clés est
 * la nôtre, les autres sont celles de Potree. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/prechauffage.js');

const nomR=([d,x,y,z])=>'r'+Array.from({length:d},(_,i)=>{const m=1<<(d-i-1);return (x&m?4:0)+(y&m?2:0)+(z&m?1:0);}).join('');
/* Arbre de nœuds communs (cube de 128 m, couloir y,z ≈ 10) ; `page(d,x)` : nœud dont la page n'est pas lue (nodeinfo absent, sans enfants). */
function arbre({charges,page=()=>false,owner={type:'ept',base:'/nuage',ept:{dataType:'laszip'}},points=()=>1000}={}){
 const faire=(d,x,y,z)=>{const s=128/2**d,b={min:{x:x*s,y:y*s,z:z*s},max:{x:(x+1)*s,y:(y+1)*s,z:(z+1)*s}},key=[d,x,y,z],sansPage=page(d,b);
  const n={key,name:nomR(key),level:d,owner,boundingBox:b,children:{},hasChildren:false,nodeinfo:sansPage?undefined:{pointCount:points(d,b)},numPoints:-1,loaded:false,loading:false};
  if(charges(d,b)){n.loaded=true;n.numPoints=1000;}
  if(d<7&&!sansPage){let i=0;for(const a of [0,1])for(const c of [0,1])for(const e of [0,1]){const s2=s/2,y0=(2*y+c)*s2,z0=(2*z+e)*s2;if(y0<=12&&y0+s2>=9&&z0<=11&&z0+s2>=9){n.children[i]=faire(d+1,2*x+a,2*y+c,2*z+e);n.hasChildren=true;}i++;}}
  return n;};
 return {pcoGeometry:Object.assign(owner,{root:faire(0,0,0,0),loader:{}}),matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}};}
const pres=cx=>(d,b)=>d<=1||(b.min.x<=cx+.5&&b.max.x>=cx-.5);
const ligne=(i,s='valid')=>({i,s,e:[i,10,10,i,11.435,10]});
const voisins=(cut,w,quoi)=>({ok:true,table:{lignes:200,tables:1},geo:{index:cut},rows:[ligne(cut,'invalid')],...(quoi?.suivante?{loin:ligne(70,'invalid')}:{})});
function fichierHier(cle){const [d,x,y,z]=cle.split('-').map(Number),h={};for(let r=0;r<=2&&d+r<=7;r++){const k=2**r;for(let a=0;a<k;a++)for(let b=0;b<k;b++)for(let c=0;c<k;c++)h[`${d+r}-${x*k+a}-${y*k+b}-${z*k+c}`]=r===2&&d+r<7?-1:1000;}return h;}
function env({reglage={}}={}){const e={evts:[],demandes:[],hier:[]};let images=[];
 e.env={reglage:{actif:true,rayonM:.75,sautMin:11,hierarchie:true,...reglage},chargements:()=>0,etiquette:()=>({part:23,cut:20}),poster:x=>e.evts.push(JSON.parse(JSON.stringify(x))),
  image:()=>new Promise(r=>images.push(r)),maintenant:()=>0,voisins,AbortController,relever:()=>[],
  fetch:(url,init)=>new Promise((res,rej)=>{e.demandes.push({url,init});init.signal.addEventListener('abort',()=>rej(Object.assign(Error('abandon'),{name:'AbortError'})));
   const m=/ept-hierarchy\/(\d+-\d+-\d+-\d+)\.json$/.exec(url);if(m)e.hier.push(m[1]);const corps=m?new TextEncoder().encode(JSON.stringify(fichierHier(m[1]))).buffer:new ArrayBuffer(5000);
   queueMicrotask(()=>res({ok:true,status:200,headers:{get:()=>null},arrayBuffer:async()=>corps}));})};
 e.tourner=async()=>{for(let i=0;i<40;i++){const f=images;images=[];for(const r of f)r();await new Promise(r=>setImmediate(r));}};return e;}
const ctx=(pc,cut=20)=>({partie:23,coupe:cut,rails:{left:[0,0,0],right:[0,1.435,0]},origine:[cut,10,10],pointclouds:[pc]});
async function jouer(e,pc,p=P.creer(e.env),cut=20){const r=p.apresCapture(ctx(pc,cut));await e.tourner();await r;return e.evts.filter(x=>x.kind==='prechauffage').at(-1);}
const dansZone=(cle,cx=70)=>{const [d,x]=cle.split('-').map(Number),s=128/2**d;return x*s<=cx+.75&&(x+1)*s>=cx-.75;};
const ADRESSE=/\/|https?:|ept-data|\.laz|\d+-\d+-\d+-\d+|\?/;

test('nœud commun (hiérarchie lue) : nœuds de la zone demandés à `${base}/ept-data/<clé>.laz`, requête de Potree (GET, cache par défaut)',async()=>{
 const e=env(),ev=await jouer(e,arbre({charges:pres(20)}));
 assert.ok(ev.noeuds>0,'nœuds demandés : '+ev.noeuds);assert.equal(ev.sansNom,0);assert.equal(ev.sansAdresse,0);
 for(const {url,init} of e.demandes){const m=/^\/nuage\/ept-data\/(\d+-\d+-\d+-\d+)\.laz$/.exec(url);assert.ok(m,'adresse : '+url);assert.ok(dansZone(m[1]));assert.equal(init.method,'GET');assert.equal(init.cache,'default');assert.equal(init.credentials,'same-origin');}
 assert.ok((ev.formeNoeud&4096)&&(ev.formeNoeud&8192)&&(ev.formeNoeud&16384)&&!(ev.formeNoeud&32),'forme : '+ev.formeNoeud);
 assert.ok(!ADRESSE.test(JSON.stringify(e.evts).replace(/"kind":"[^"]*"/g,'')));
});

test('pages de hiérarchie non lues dans la zone (nodeinfo absent) : `${base}/ept-hierarchy/<clé>.json` lu, nœuds déduits demandés, pages (−1) jamais demandées en données',async()=>{
 const e=env(),ev=await jouer(e,arbre({charges:pres(20),page:(d,b)=>d===2&&!(b.min.x<=20&&b.max.x>=20)}));
 assert.ok(ev.hierarchies>=1&&e.hier.length===ev.hierarchies);assert.ok(e.hier.every(k=>dansZone(k)));assert.ok(ev.deduits>0);assert.ok(ev.noeuds>0);
 /* Données : connues de l'arbre (niveau ≤ 2 hors frontières) ou de nombre de points > 0 dans une page LUE ; jamais un −1 d'une page non lue. */
 const lus=Object.assign({},...e.hier.map(fichierHier));
 for(const {url} of e.demandes.filter(d=>/ept-data/.test(d.url))){const k=/(\d+-\d+-\d+-\d+)\.laz$/.exec(url)[1];assert.ok(dansZone(k));
  assert.ok(Number(k.split('-')[0])<2||lus[k]>0||Object.keys(lus).length&&e.hier.includes(k),'donnée connue ou lue dans une page : '+k);assert.notEqual(lus[k],-1,'pas une page non lue : '+k);}
 assert.ok(e.demandes.some(d=>/ept-data/.test(d.url)&&e.hier.some(h=>d.url.includes('/'+h+'.laz'))),'la frontière elle-même est demandée après lecture de sa page');
 for(const {url} of e.demandes.filter(d=>/ept-hierarchy/.test(d.url)))assert.match(url,/^\/nuage\/ept-hierarchy\/\d+-\d+-\d+-\d+\.json$/);
});

test('rien sans adresse sûre : COPC, binaire, zstandard, base avec « ? » → sans-adresse, aucune requête',async()=>{
 for(const owner of [{type:'copc',base:'/nuage',ept:{dataType:'laszip'}},{type:'ept',base:'/nuage',ept:{dataType:'binary'}},{type:'ept',base:'/nuage',ept:{dataType:'zstandard'}},{type:'ept',base:'/nuage?jeton=x',ept:{dataType:'laszip'}},{type:'ept',ept:{dataType:'laszip'}}]){
  const nom=`${owner.type}/${owner.ept.dataType}/${owner.base?owner.base.includes('?')?'base ?':'base':'sans base'}`,e=env(),ev=await jouer(e,arbre({charges:pres(20),owner}));assert.equal(e.demandes.length,0,nom);assert.equal(ev.motif,'sans-adresse');assert.ok(ev.sansAdresse>0);}
});

test('nœud à 0 point : jamais demandé (Potree ne le charge pas)',async()=>{
 const e=env(),ev=await jouer(e,arbre({charges:pres(20),points:()=>0}));assert.equal(e.demandes.length,0);assert.equal(ev.noeuds,0);
});

test('extension apprise des requêtes de Potree discordante (.bin) : rien n’est demandé',async()=>{
 const e=env(),p=P.creer(e.env);p.ressources([{name:'/nuage/ept-data/0-0-0-0.bin',initiatorType:'fetch',transferSize:10,decodedBodySize:10}]);
 const ev=await jouer(e,arbre({charges:pres(20)}),p);assert.equal(e.demandes.length,0);assert.equal(ev.motif,'sans-adresse');
});

test('bilan avec un Potree qui charge par fetch : la première entrée de chacune de nos clés est la nôtre, les suivantes sont celles de Potree',async()=>{
 const e=env(),p=P.creer(e.env),pc=arbre({charges:pres(20)});await jouer(e,pc,p);
 const cles=p._clesPourEssai();assert.ok(cles.length>0);
 const ent=(c,tz)=>({name:'/nuage/ept-data/'+c+'.laz',initiatorType:'fetch',transferSize:tz,decodedBodySize:4000});
 p.ressources(cles.map(c=>ent(c,4100)));               /* nos propres demandes, vues par l'observateur */
 p.ressources([...cles.map(c=>ent(c,0)),ent('9-9-9-9',4100)]);   /* Potree à la coupe suivante : nos clés servies par le cache, une autre téléchargée */
 const b=e.evts.length;e.env.etiquette=()=>({part:23,cut:70});await jouer(e,pc,p,70);
 const bil=e.evts.slice(b).find(x=>x.kind==='prechauffage-bilan');assert.equal(bil.juste,true);assert.equal(bil.potree,cles.length+1);assert.equal(bil.couverts,cles.length);assert.equal(bil.servisCache,cles.length);
});
