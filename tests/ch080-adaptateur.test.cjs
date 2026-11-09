'use strict';
/* CH-080 (D-309) — patch de la page (chantiers/CH-080/adapter-page.patch, NON appliqué au tronc ; src/adapter-page.js est interdit à l'exécutant).
 * L'essai applique le patch à une copie et joue une capture dans la page simulée (tests/helpers/esv-images.cjs) avec le vrai src/prechauffage.js. Il prouve :
 *  - le patch s'applique, le tronc n'est pas touché ;
 *  - capture du lot (aucune cible) : la page demande à l'observateur la suivante non validée de toute la liste (`suivante:true`) ;
 *  - capture portant la cible du service worker (`expected.prechauffage`) : la page demande cette ligne (`cible`) et l'événement dit `source:'relu'` ;
 *  - sans le patch (tronc) : aucune de ces demandes, la fenêtre seule (dernier recours). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'..'),SRC=path.join(racine,'src/adapter-page.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch080-')),copie=path.join(dir,'src/adapter-page.js');fs.mkdirSync(path.join(dir,'src'));fs.copyFileSync(SRC,copie);
const integre=fs.readFileSync(SRC,'utf8').includes('CH-080'),troncPropre=integre||!fs.readFileSync(SRC,'utf8').includes('CH-080');
const r=integre?{status:0}:spawnSync('patch',['-s','-p1','-d',dir,'-i',path.join(racine,'chantiers/CH-080/adapter-page.patch')],{encoding:'utf8'});
const raison=r.error?.code==='ENOENT'?'outil patch absent':null,opts=raison?{skip:raison}:{};
test('le patch s’applique ; le tronc n’est pas touché',opts,()=>{assert.equal(r.status,0,r.stderr||r.stdout);assert.ok(troncPropre);});

const lire=fs.readFileSync;let fichier=copie;
fs.readFileSync=function(f,...a){if(!raison&&path.resolve(String(f))===SRC)return lire.call(fs,fichier,...a);return lire.call(fs,f,...a);};
const P=require('./helpers/page.cjs'),pageOrig=P.page,S=require('../src/settings.js');
P.page=({globals={},...o}={})=>pageOrig({...o,globals:{...globals,BananePrechauffage:require('../src/prechauffage.js'),AbortController,
 PerformanceObserver:class{constructor(f){this.f=f;}observe(){}takeRecords(){return [];}},fetch:()=>new Promise(()=>{}),
 BananeSettings:{...globals.BananeSettings,lot:{...S.lot,chargement:{prechauffer:{...S.lot.chargement.prechauffer,actif:true}}}}}});
const {esv,nuage}=require('./helpers/esv-images.cjs');
const J=x=>JSON.parse(JSON.stringify(x??null));

/* Une capture au cut 100 ; l'observateur simulé répond (fenêtre : tout validé ; `loin` : cut 150 en x + 50). Rend les demandes vues et les événements. */
async function jouer(expectedPlus={}){
 const f=esv({cut:100,chargements:0}),pc=nuage(f),evts=[],demandes=[];pc.pcoGeometry={root:{key:{d:0},level:0,numPoints:1,boundingBox:{min:{x:-1e4,y:-1e4,z:-1e4},max:{x:1e4,y:1e4,z:1e4}},children:{},loaded:true,loading:false,filename:()=>'0-0-0-0',url:()=>'/n/ept-data/0-0-0-0'},loader:{extension:()=>'.bin'}};
 pc.matrixWorld={elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]};
 const ecoutes=[],orig=f.ctx.postMessage;
 f.ctx.addEventListener=(t,fn)=>{if(t==='message')ecoutes.push(fn);};f.ctx.removeEventListener=(t,fn)=>{const i=ecoutes.indexOf(fn);if(i>=0)ecoutes.splice(i,1);};
 f.ctx.postMessage=(m,o)=>{if(m?.kind==='banane5:voisins'){demandes.push(J(m));const w=m.world,l=(i,s)=>({i,s,e:[...w.left.map((v,k)=>v+(k===1?i-100:0)),...w.right.map((v,k)=>v+(k===1?i-100:0))]});
   const rep={kind:'banane5:voisins-reponse',v:1,id:m.id,ok:true,table:{tables:1},rows:[l(100,'invalid'),l(101,'valid')]};
   if(Number.isInteger(m.cible))rep.loin=l(m.cible,'valid');else if(m.suivante===true)rep.loin=l(150,'invalid');
   queueMicrotask(()=>{for(const fn of [...ecoutes])fn({source:require('node:vm').runInContext('window',f.ctx),origin:f.ctx.location.origin,data:rep});});return;}
  if(m?.kind==='banane5:evt'){evts.push(J(m.event));return;}return orig(m,o);};
 const before=await f.call('state');const exp={...before,...expectedPlus(before)};await f.call('capture',exp);
 for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
 return {demandes,evts:evts.filter(e=>e.kind==='prechauffage')};}

test('lot (sans cible) : la page demande la suivante de toute la liste ; source liste-esv, saut 50',opts,async()=>{
 const j=await jouer(()=>({}));assert.equal(j.demandes[0].suivante,true);assert.equal('cible' in j.demandes[0],false);
 /* CH-081 (Vision 8, horizon 2) : une seconde demande, la suivante de la coupe prédite (k+2). */
 assert.equal(j.demandes.length,2);assert.equal(j.demandes[1].suivante,true);assert.equal(j.demandes[1].cut,150);
 assert.equal(j.evts[0].source,'liste-esv');assert.equal(j.evts[0].saut,50);assert.equal(j.evts[0].predite,150);
});

test('relecture : la cible jointe à la capture est demandée telle quelle ; source relecture',opts,async()=>{
 const j=await jouer(b=>({prechauffage:{part:b.identity.part,de:b.identity.cut,cut:40,source:'relu',op:'essai'}}));
 assert.equal(j.demandes[0].cible,40);assert.equal('suivante' in j.demandes[0],false);
 assert.equal(j.evts[0].source,'relu');assert.equal(j.evts[0].saut,-60);assert.equal(j.evts[0].predite,40);
});

/* Vision 6 (D-309) : une fois le patch intégré au tronc, il n'y a plus d'adaptateur « sans le patch » à jouer : le cas se saute. */
test('sans le patch (tronc) : fenêtre seule, la coupe à 50 coupes n’est pas trouvée',integre?{skip:'patch CH-080 intégré au tronc'}:opts,async()=>{
 fichier=SRC;for(const k of Object.keys(require.cache))if(/helpers\/(page|esv-images)\.cjs$/.test(k))delete require.cache[k];
 const j=await jouer(()=>({}));assert.equal('suivante' in j.demandes[0],false);assert.equal(j.evts[0].motif,'sans-suivante');assert.equal(j.evts[0].source,null);
 fs.readFileSync=lire;P.page=pageOrig;
});
