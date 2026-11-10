'use strict';
/* CH-088 — patch de la page (chantiers/CH-088/adapter-page.patch, NON appliqué au tronc ; src/adapter-page.js est interdit à l'exécutant).
 * L'essai applique le patch à une copie et joue une capture du lot dans la page simulée (tests/helpers/esv-images.cjs) avec le vrai src/prechauffage.js
 * et le réglage livré. Il prouve : le patch s'applique, le tronc n'est pas touché ; avec le patch, la page demande à l'observateur la cible lointaine
 * (`loin` : 11, `max` : 40) et l'opération lointaine part (cible 400) ; sans le patch, la demande part sans `loin`, l'observateur ne rend rien et
 * aucune opération lointaine ne part (le reste du préchauffage est inchangé). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'..'),SRC=path.join(racine,'src/adapter-page.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch088-')),copie=path.join(dir,'src/adapter-page.js');fs.mkdirSync(path.join(dir,'src'));fs.copyFileSync(SRC,copie);
const integre=fs.readFileSync(SRC,'utf8').includes('CH-088 : loin'),troncPropre=integre||!fs.readFileSync(SRC,'utf8').includes('CH-088');
const r=integre?{status:0}:spawnSync('patch',['-s','-p1','-d',dir,'-i',path.join(racine,'chantiers/CH-088/adapter-page.patch')],{encoding:'utf8'});
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
   if(Number.isInteger(m.cible))rep.loin=l(m.cible,'valid');else if(m.suivante===true)rep.loin=l(101,'invalid');else if(Number.isInteger(m.loin))rep.loin={...l(400,'invalid'),avant:1,saut:299};
   queueMicrotask(()=>{for(const fn of [...ecoutes])fn({source:require('node:vm').runInContext('window',f.ctx),origin:f.ctx.location.origin,data:rep});});return;}
  if(m?.kind==='banane5:evt'){evts.push(J(m.event));return;}return orig(m,o);};
 const before=await f.call('state');const exp={...before,...expectedPlus(before)};await f.call('capture',exp);
 for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
 return {demandes,evts:evts.filter(e=>/^prechauffage/.test(e.kind))};}

test('avec le patch : demande `loin` (11, 40) à l\'observateur, depuis le cut courant',opts,async()=>{
 const j=await jouer(()=>({}));const d=j.demandes.find(x=>'loin' in x);
 assert.ok(d,'une demande loin : '+JSON.stringify(j.demandes));assert.equal(d.loin,11);assert.equal(d.max,40);assert.equal(d.cut,100);
});
/* Audit du 10/11 : le cas « sans le patch (tronc) » est retiré : le patch CH-088 est dans le tronc depuis Vision 9, le cas était sauté à chaque passage. */
