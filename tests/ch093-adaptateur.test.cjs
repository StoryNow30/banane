'use strict';
/* CH-093 — patch de la page (chantiers/CH-093/adapter-page.patch, NON appliqué au tronc ; src/adapter-page.js est interdit à l'exécutant).
 * L'essai applique le patch à une copie et joue la commande `prechauffer` dans la page simulée (tests/helpers/esv-images.cjs) avec le vrai
 * src/prechauffage.js et le réglage livré. Il prouve : le patch s'applique, le tronc n'est pas touché ; avec le patch, `ping` annonce la capacité
 * `prechauffer`, la commande répond tout de suite (`lance:true`, rien n'est attendu), la page demande à l'observateur la ligne de la cible (et elle
 * seule) depuis la coupe affichée ; réglage `relecture` éteint ou cible proche : aucune opération ; sans le patch, `ping` n'annonce rien (le service
 * worker n'envoie alors jamais la commande). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'..'),SRC=path.join(racine,'src/adapter-page.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch093-')),copie=path.join(dir,'src/adapter-page.js');fs.mkdirSync(path.join(dir,'src'));fs.copyFileSync(SRC,copie);
const integre=fs.readFileSync(SRC,'utf8').includes('PRECH_ANTICIPE'),troncPropre=integre||!fs.readFileSync(SRC,'utf8').includes('CH-093');
const r=integre?{status:0}:spawnSync('patch',['-s','-p1','-d',dir,'-i',path.join(racine,'chantiers/CH-093/adapter-page.patch')],{encoding:'utf8'});
const raison=r.error?.code==='ENOENT'?'outil patch absent':null,opts=raison?{skip:raison}:{};
test('le patch s’applique ; le tronc n’est pas touché',opts,()=>{assert.equal(r.status,0,r.stderr||r.stdout);assert.ok(troncPropre);});

const lire=fs.readFileSync;let fichier=copie;
fs.readFileSync=function(f,...a){if(!raison&&path.resolve(String(f))===SRC)return lire.call(fs,fichier,...a);return lire.call(fs,f,...a);};
const P=require('./helpers/page.cjs'),pageOrig=P.page,S=require('../src/settings.js');
let reglagePlus={};
P.page=({globals={},...o}={})=>pageOrig({...o,globals:{...globals,BananePrechauffage:require('../src/prechauffage.js'),AbortController,
 PerformanceObserver:class{constructor(f){this.f=f;}observe(){}takeRecords(){return [];}},fetch:()=>new Promise(()=>{}),
 BananeSettings:{...globals.BananeSettings,lot:{...S.lot,chargement:{prechauffer:{...S.lot.chargement.prechauffer,actif:true,...reglagePlus}}}}}});
const {esv,nuage}=require('./helpers/esv-images.cjs');
const J=x=>JSON.parse(JSON.stringify(x??null));

/* Page au cut 100 (fin du lot) ; l'observateur simulé rend la ligne demandée (`cible`) à sa place dans la table. */
async function monter(){
 const f=esv({cut:100,chargements:0}),pc=nuage(f),evts=[],demandes=[];pc.pcoGeometry={root:{key:{d:0},level:0,numPoints:1,boundingBox:{min:{x:-1e4,y:-1e4,z:-1e4},max:{x:1e4,y:1e4,z:1e4}},children:{},loaded:true,loading:false,filename:()=>'0-0-0-0',url:()=>'/n/ept-data/0-0-0-0'},loader:{extension:()=>'.bin'}};
 pc.matrixWorld={elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]};
 const ecoutes=[],orig=f.ctx.postMessage;
 f.ctx.addEventListener=(t,fn)=>{if(t==='message')ecoutes.push(fn);};f.ctx.removeEventListener=(t,fn)=>{const i=ecoutes.indexOf(fn);if(i>=0)ecoutes.splice(i,1);};
 f.ctx.postMessage=(m,o)=>{if(m?.kind==='banane5:voisins'){demandes.push(J(m));const w=m.world,l=(i,s)=>({i,s,e:[...w.left.map((v,k)=>v+(k===1?i-100:0)),...w.right.map((v,k)=>v+(k===1?i-100:0))]});
   const rep={kind:'banane5:voisins-reponse',v:1,id:m.id,ok:true,table:{tables:1},rows:[l(100,'valid'),l(101,'valid')]};
   if(Number.isInteger(m.cible))rep.loin=l(m.cible,'valid');
   queueMicrotask(()=>{for(const fn of [...ecoutes])fn({source:require('node:vm').runInContext('window',f.ctx),origin:f.ctx.location.origin,data:rep});});return;}
  if(m?.kind==='banane5:evt'){evts.push(J(m.event));return;}return orig(m,o);};
 const attendre=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));};
 return {f,demandes,evts:()=>evts.filter(e=>/^prechauffage/.test(e.kind)),attendre};}

test('avec le patch : `ping` annonce `prechauffer` ; la commande répond tout de suite et demande la ligne de la cible à l\'observateur',opts,async()=>{
 const m=await monter(),etat=await m.f.call('state'),part=etat.identity.part;
 assert.ok((await m.f.call('ping')).capacites.includes('prechauffer'));
 const rep=await m.f.call('prechauffer',{part,cut:20,source:'changement-mode',url:'/n/ept-data/1-0-0-0.bin'});
 assert.deepEqual(J(rep),{lance:true});await m.attendre();
 assert.equal(m.demandes.length,1,JSON.stringify(m.demandes));assert.equal(m.demandes[0].cible,20);assert.equal(m.demandes[0].cut,100,'depuis la coupe affichée');
 assert.deepEqual(m.evts().filter(e=>e.kind==='prechauffage'),[],'cible prise : aucun refus posté');
});
test('avec le patch : `prechauffer` est en lecture seule : aucune touche, aucun clic, coupe et rails d\'ESV inchangés',opts,async()=>{
 const m=await monter(),f=m.f,sansHeure=({capturedAt,...x})=>x,avant=J(await f.call('state')),label=f.nodes.get('O2N3DCutDescription').textContent;
 const clics=f.clics.length,touches=f.keyboard.length,pose=n=>J([n.position.x,n.position.y,n.position.z]),rails=[pose(f.left),pose(f.right)];
 for(const n of ['O2N3DCutValidate3DRail','O2N3DCutNextInvalid3DRail']){const el=f.nodes.get(n),clic=el.click;el.click=function(){throw Error('bouton d\'ESV cliqué : '+n);};el._clic=clic;}
 for(const c of [{part:avant.identity.part,cut:20,source:'changement-mode'},{part:avant.identity.part,cut:105,source:'changement-mode'},null])await f.call('prechauffer',c);
 await m.attendre();
 assert.equal(f.keyboard.length,touches,'aucune touche envoyée à ESV');assert.equal(f.clics.length,clics,'aucun clic sur un rail');
 assert.equal(f.nodes.get('O2N3DCutDescription').textContent,label,'même coupe affichée');assert.deepEqual([pose(f.left),pose(f.right)],rails,'rails d\'ESV inchangés');
 assert.deepEqual(sansHeure(J(await f.call('state'))),sansHeure(avant),'état lu identique avant et après');
 assert.deepEqual(f.progress.filter(x=>!['received'].includes(x.stage)).map(x=>x.stage),[],'aucune étape de commande');
});
test('avec le patch : cible proche, autre partie ou cible illisible : refus posté ou rien, jamais d\'opération',opts,async()=>{
 const m=await monter(),part=(await m.f.call('state')).identity.part;
 assert.deepEqual(J(await m.f.call('prechauffer',{part,cut:105,source:'changement-mode'})),{lance:true});await m.attendre();
 assert.equal(m.demandes.length,0,'saut court : l\'observateur n\'est pas même interrogé');
 assert.deepEqual(m.evts().map(e=>[e.kind,e.motif,e.source,e.coupe,e.predite]),[['prechauffage','saut-court','changement-mode',100,105]]);
 await m.f.call('prechauffer',{part:part+1,cut:20,source:'changement-mode'});await m.f.call('prechauffer',null);await m.f.call('prechauffer','20');await m.attendre();
 assert.equal(m.demandes.length,0);assert.equal(m.evts().length,1);
});
test('avec le patch, réglage `relecture` éteint : la capacité reste annoncée, la commande ne fait rien',opts,async()=>{
 reglagePlus={relecture:{actif:false}};try{const m=await monter(),part=(await m.f.call('state')).identity.part;
  await m.f.call('prechauffer',{part,cut:20,source:'changement-mode'});await m.attendre();assert.equal(m.demandes.length,0);assert.deepEqual(m.evts(),[]);}finally{reglagePlus={};}
});
test('sans le patch (tronc) : `ping` n\'annonce pas la capacité',integre?{skip:'patch CH-093 intégré au tronc'}:opts,async()=>{
 fichier=SRC;try{const m=await monter();assert.equal((await m.f.call('ping')).capacites.includes('prechauffer'),false);}finally{fichier=copie;}
});
