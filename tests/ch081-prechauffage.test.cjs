'use strict';
/* CH-081 (D-311, aval de l'intégrateur pour Vision 8) — BRANCHEMENT DE LA BOÎTE ET DE L'ANTICIPATION dans `src/prechauffage.js`. Essais purs (Node), arbre
 * EPT synthétique (celui des essais de CH-080), `fetch` simulé. Ils prouvent :
 *  - `zone:'boite'` : la boîte de découpe d'ESV de la coupe prédite, jusqu'aux feuilles : un nœud de côté (à 1,7 m du milieu des rails) est demandé, ce
 *    que le cube de 0,75 m ne fait pas ; l'événement porte `zone` ;
 *  - `horizon:2` : la suivante de la coupe prédite (k+2) est demandée à l'observateur et préchauffée ensuite ; `cibles` = 2 ;
 *  - fin de la liste du lot (`sans-suivante`) : la première ligne non validée de toute la table (`premiere`), source `changement-mode` ;
 *  - plafond du lot : `plafond-lot`, plus aucune requête ;
 *  - bilan : `utiles` (redemandés par Potree), `inutiles` (expirés sans l'être) ; un nœud déjà préchauffé n'est pas redemandé (`deja-prechauffe`) ;
 *  - `prechauffage-vue` : au premier passage, puis seulement quand la vue change ; ni adresse ni position ;
 *  - aucun événement ne contient d'adresse ni de clé. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/prechauffage.js');

function arbre({profondeur=7,taille=128,charges=()=>false}={}){
 const faire=(d,x,y,z)=>{const s=taille/2**d,nom=`${d}-${x}-${y}-${z}`,b={min:{x:x*s,y:y*s,z:z*s},max:{x:(x+1)*s,y:(y+1)*s,z:(z+1)*s}};
  const n={key:{d,x,y,z},level:d,numPoints:1000,boundingBox:b,children:{},loaded:charges(nom,d,b),loading:false,filename:()=>nom,url:()=>'/nuage/ept-data/'+nom};
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
function environnement({reglage={},voisins,etiquette={part:23,cut:20},relever=()=>[]}={}){
 const e={evts:[],demandes:[],etiquette,demandesVoisins:[]};let images=[];
 e.env={reglage:{actif:true,rayonM:.75,sautMin:2,hierarchie:false,...reglage},chargements:()=>0,etiquette:()=>e.etiquette,poster:x=>e.evts.push(JSON.parse(JSON.stringify(x))),
  image:()=>new Promise(r=>images.push(r)),maintenant:()=>0,
  voisins:(...a)=>{e.demandesVoisins.push({cut:a[0],...JSON.parse(JSON.stringify(a[2]??{}))});return voisins(...a);},AbortController,
  fetch:(url,init)=>new Promise((res,rej)=>{e.demandes.push(url);init.signal.addEventListener('abort',()=>rej(Object.assign(Error('abandon'),{name:'AbortError'})));
   queueMicrotask(()=>res({ok:true,status:200,headers:{get:k=>k==='Cache-Control'?'max-age=3600':null},arrayBuffer:async()=>new ArrayBuffer(50000)}));}),
  relever};
 e.tourner=async(n=60)=>{for(let i=0;i<n;i++){const f=images;images=[];for(const r of f)r();await new Promise(r=>setImmediate(r));}};
 return e;}
const contexte=(pc,cut=20,plus={})=>({partie:23,coupe:cut,rails:{left:[0,0,0],right:[0,1.435,0]},origine:[cut+.5,10,10],pointclouds:[pc],...plus});
async function jouer(e,ctx,p=P.creer(e.env)){const r=p.apresCapture(ctx);await e.tourner();await r;return {ev:e.evts.filter(x=>x.kind==='prechauffage').at(-1),p};}
const cles=e=>e.demandes.map(u=>u.split('/').pop().replace('.bin',''));
const ADRESSE=/\/|https?:|ept-data|\.bin|\d+-\d+-\d+-\d+/;
const sansAdresse=evts=>assert.ok(!ADRESSE.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse ni clé : '+JSON.stringify(evts));
const V8={zone:'boite',horizon:2,candidatsMax:3,noeudsMax:32,octetsMax:10485760};

test('zone boîte : le nœud de côté (1,7 m du milieu) est demandé, pas avec le cube ; jusqu\'aux feuilles ; `zone` dans l\'événement',async()=>{
 const st={20:'invalid',70:'invalid'};
 const eb=environnement({reglage:{zone:'boite',noeudsMax:200},voisins:observateur(200,st)}),{ev:vb}=await jouer(eb,contexte(arbre({charges:pres(20)})));
 const ec=environnement({reglage:{zone:'cube',noeudsMax:200},voisins:observateur(200,st)}),{ev:vc}=await jouer(ec,contexte(arbre({charges:pres(20)})));
 assert.equal(vb.zone,'boite');assert.equal(vc.zone,'cube');assert.equal(vb.predite,70);
 const cote=k=>/^7-70-8-/.test(k);   /* feuille de 1 m, y de 8 à 9 : dans la boîte (milieu 10,72 ± 2 m), hors du cube (rail gauche 10 − 0,75) */
 assert.ok(cles(eb).some(cote),'boîte : nœud de côté demandé : '+cles(eb).join(' '));assert.ok(!cles(ec).some(cote),'cube : pas de nœud de côté');
 assert.ok(cles(eb).some(k=>k.startsWith('7-')),'jusqu\'aux feuilles (niveau 7)');
 assert.ok(!cles(eb).some(k=>/^7-(6[0-8]|7[2-9])-/.test(k)),'rien hors de ±0,25 m en long');
 sansAdresse(eb.evts);
});

test('horizon 2 : la suivante de la coupe prédite est demandée à l\'observateur, puis préchauffée ; cibles = 2',async()=>{
 const e=environnement({reglage:V8,voisins:observateur(300,{20:'invalid',70:'invalid',110:'invalid'})}),{ev}=await jouer(e,contexte(arbre({charges:pres(20)})));
 assert.deepEqual(e.demandesVoisins.map(d=>[d.cut,!!d.suivante]),[[20,true],[70,true]]);
 assert.equal(ev.cibles,2);assert.equal(ev.predite,70);assert.equal(ev.source,'liste-esv');
 assert.ok(cles(e).some(k=>/^7-70-/.test(k))&&cles(e).some(k=>/^7-110-/.test(k)),'k+1 puis k+2');
 assert.ok(cles(e).findIndex(k=>/^7-110-/.test(k))>cles(e).findIndex(k=>/^7-70-/.test(k)),'k+1 d\'abord');
 sansAdresse(e.evts);
});

test('fin de la liste du lot : première ligne non validée de toute la table, source changement-mode',async()=>{
 const e=environnement({reglage:V8,voisins:observateur(300,{20:'invalid',5:'invalid'})}),{ev}=await jouer(e,contexte(arbre({charges:pres(20)})));
 assert.ok(e.demandesVoisins.some(d=>d.premiere===true),'premiere demandée');
 assert.equal(ev.source,'changement-mode');assert.equal(ev.predite,5);assert.equal(ev.saut,-15);assert.ok(ev.noeuds>0);
 const e1=environnement({reglage:{zone:'boite'},voisins:observateur(300,{20:'invalid',5:'invalid'})}),{ev:v1}=await jouer(e1,contexte(arbre({charges:pres(20)})));
 assert.equal(v1.motif,'sans-suivante','une seule cible (réglage de CH-080c) : comportement d\'avant');
});

test('plafond du lot : plafond-lot, plus aucune requête',async()=>{
 const e=environnement({reglage:{...V8,lotRequetesMax:3},voisins:observateur(300,{20:'invalid',70:'invalid',110:'invalid'})});
 const {ev,p}=await jouer(e,contexte(arbre({charges:pres(20)})));
 assert.equal(ev.motif,'plafond-lot');assert.equal(e.demandes.length,3);assert.equal(p.etat().lot.requetes,3);
});

test('bilan : utiles (redemandés par Potree), inutiles (expirés) ; déjà préchauffé : pas redemandé',async()=>{
 let entrees=[];
 const e=environnement({reglage:V8,voisins:observateur(300,{20:'invalid',70:'invalid',110:'invalid'}),relever:()=>{const x=entrees;entrees=[];return x;}});
 const pc=arbre({charges:pres(20)});
 const {p}=await jouer(e,contexte(pc));
 const k70=cles(e).filter(k=>/^7-70-/.test(k)),k110=cles(e).filter(k=>/^7-110-/.test(k));assert.ok(k70.length>1&&k110.length>0);
 /* arrivée à 70 : Potree redemande un seul des nœuds de 70 ; les autres de 70 expirent, ceux de 110 attendent encore une arrivée */
 entrees=[{name:'https://x.invalid/nuage/ept-data/'+k70[0]+'.bin',initiatorType:'xmlhttprequest',transferSize:0,decodedBodySize:100}];
 e.etiquette={part:23,cut:70};const n0=e.demandes.length;
 const {ev}=await jouer(e,contexte(pc,70),p);
 const b=e.evts.filter(x=>x.kind==='prechauffage-bilan').at(-1);
 /* rang 1 : nœuds de 70 seulement ; un nœud commun à 70 et 110 (niveaux hauts) attend l'arrivée à 110 */
 const couvre=(k,x)=>{const [d,i]=k.split('-').map(Number),t=128/2**d;return Math.floor(x/t)===i;},rang1=cles(e).filter(k=>couvre(k,70.5)&&!couvre(k,110.5)).length;
 assert.equal(b.juste,true);assert.equal(b.utiles,1);assert.equal(b.inutiles,rang1-1,'nœuds de 70 non redemandés');
 assert.ok(!e.demandes.slice(n0).some(u=>k110.some(k=>u.includes('/'+k+'.'))),'les nœuds de 110 déjà préchauffés ne sont pas redemandés');
 assert.ok(['deja-prechauffe','fini','plafond-noeuds'].includes(ev.motif),ev.motif);
 sansAdresse(e.evts);
});

test('prechauffage-vue : au premier passage puis à chaque changement ; entiers et liste fermée',async()=>{
 const cam={isOrthographicCamera:true,projectionMatrix:{elements:[5,0,0,0,0,4.3873704,0,0,0,0,-0.0000999983,0,0,0,0,1]},position:{x:844565.7,y:6519774,z:172.78}};
 let budget=1000000;
 const e=environnement({reglage:V8,voisins:observateur(300,{20:'invalid',21:'invalid',22:'invalid',23:'invalid'})}),p=P.creer(e.env);
 const ctx=()=>contexte(arbre({charges:pres(20)}),20,{vue:()=>({camera:cam,pointBudget:budget,pointcloud:{maxLevel:Infinity,material:{clipBoxes:[{}]}}})});
 await jouer(e,ctx(),p);await jouer(e,ctx(),p);budget=2000000;await jouer(e,ctx(),p);
 const v=e.evts.filter(x=>x.kind==='prechauffage-vue');
 assert.equal(v.length,2,'départ, puis changement de pointBudget');
 assert.deepEqual(v[0],{kind:'prechauffage-vue',camera:'orthographique',   /* CH-088 : `camera` */demiLargeurMm:200,demiHauteurMm:228,profondeurM:20000,champDeg:null,pointBudget:1000000,maxLevel:-1,minNodeSize:null,boites:1,limitePoints:null,fetchNatif:/\[native code\]/.test(Function.prototype.toString.call(fetch)),enTetesXhr:null,credXhr:null});   /* CH-085 : diagnostic d'authentification (fetch natif de Node, pas de Potree) */   /* CH-083 */
 assert.ok(!/844565|6519774/.test(JSON.stringify(v)),'aucune position');
});
