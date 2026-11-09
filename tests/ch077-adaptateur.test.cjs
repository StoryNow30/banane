'use strict';
/* CH-077 — patch de la page (chantiers/CH-077/adapter-page.patch, NON appliqué au tronc ; src/adapter-page.js est un fichier interdit à l'exécutant).
 * L'essai applique le patch à une copie temporaire et joue une capture dans la page simulée au rythme des images (tests/helpers/esv-images.cjs), avec
 * le vrai module src/prechauffage.js, un arbre EPT synthétique de Potree, la table B1 de l'observateur simulée et un `fetch` simulé. Il prouve :
 *  - réglage éteint (défaut) : aucune demande, aucun événement de préchauffage, capture identique ;
 *  - allumé : les demandes partent APRÈS la capture, qui n'attend rien (un fetch qui ne répond jamais ne retarde pas la capture) ; adresse = celle que
 *    Potree construit ; une nouvelle capture annule le préchauffage en cours ; aucun événement ne contient d'adresse.
 * Le patch de background.js (chantiers/CH-077/background-page-files.patch : src/prechauffage.js dans PAGE_FILES) est vérifié aussi.
 * Sans l'outil `patch`, l'essai se saute ; un patch qui ne s'applique plus est un ÉCHEC. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'..'),SRC=path.join(racine,'src/adapter-page.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch077-')),copie=path.join(dir,'src/adapter-page.js');fs.mkdirSync(path.join(dir,'src'));
fs.copyFileSync(SRC,copie);fs.copyFileSync(path.join(racine,'background.js'),path.join(dir,'background.js'));
/* D-307 : les deux patchs sont intégrés au tronc (Vision 5) : l'essai joue alors le tronc tel quel, sans repatcher. */
const integre=fs.readFileSync(SRC,'utf8').includes('prechaufferApres');
const r=integre?{status:0}:spawnSync('patch',['-s','-p1','-d',dir,'-i',path.join(racine,'chantiers/CH-077/adapter-page.patch')],{encoding:'utf8'});
const rb=integre?{status:0}:r.error?r:spawnSync('patch',['-s','-p1','-d',dir,'-i',path.join(racine,'chantiers/CH-077/background-page-files.patch')],{encoding:'utf8'});
const troncPropre=integre||!fs.readFileSync(SRC,'utf8').includes('prechaufferApres');
const raison=r.error?.code==='ENOENT'?'outil patch absent':null,opts=raison?{skip:raison}:{};
test('les deux patchs s’appliquent ; src/prechauffage.js est injecté juste avant l’adaptateur',opts,()=>{
 assert.equal(r.status,0,'adaptateur : '+(r.stderr||r.stdout));assert.equal(rb.status,0,'background : '+(rb.stderr||rb.stdout));
 const l=/const PAGE_FILES=\[([^\]]*)\]/.exec(fs.readFileSync(path.join(dir,'background.js'),'utf8'))[1].match(/'[^']+'/g).map(x=>x.slice(1,-1));
 assert.equal(l.indexOf('src/prechauffage.js'),l.indexOf('src/adapter-page.js')-1);
 assert.equal(troncPropre,true,'le tronc n’est pas touché');
});

const lire=fs.readFileSync;fs.readFileSync=function(f,...a){if(!raison&&path.resolve(String(f))===SRC)return lire.call(fs,copie,...a);return lire.call(fs,f,...a);};
const P=require('./helpers/page.cjs'),pageOrig=P.page,S=require('../src/settings.js');
let reglage=null,demandes=[];
P.page=({globals={},...o}={})=>pageOrig({...o,globals:{...globals,BananePrechauffage:require('../src/prechauffage.js'),AbortController,
 PerformanceObserver:class{constructor(f){this.f=f;}observe(){}takeRecords(){return [];}},
 fetch:(url,init)=>new Promise((res,rej)=>{demandes.push({url,init,res});init.signal.addEventListener('abort',()=>rej(Object.assign(Error('abandon'),{name:'AbortError'})));}),
 BananeSettings:{...globals.BananeSettings,lot:{...S.lot,...(reglage?{chargement:{prechauffer:reglage}}:{})}}}});
const {esv,nuage}=require('./helpers/esv-images.cjs');
const J=x=>JSON.parse(JSON.stringify(x??null));

/* Arbre EPT de 64 m centré sur la scène (matrice : translation −32), nœuds chargés : niveaux 0-1 et ceux qui contiennent le cut courant. */
function arbre(){const faire=(d,x,y,z)=>{const s=64/2**d,nom=`${d}-${x}-${y}-${z}`,b={min:{x:x*s,y:y*s,z:z*s},max:{x:(x+1)*s,y:(y+1)*s,z:(z+1)*s}},
  pres=d<=1||(b.min.x<=33&&b.max.x>=31&&b.min.y<=33&&b.max.y>=31&&b.min.z<=33&&b.max.z>=31);
  const n={key:{d,x,y,z},level:d,numPoints:1000,boundingBox:b,children:{},loaded:pres,loading:false,filename:()=>nom,url:()=>'/nuage/ept-data/'+nom};
  if(d<6){let i=0;for(const a of [0,1])for(const c of [0,1])for(const e of [0,1])n.children[i++]=faire(d+1,2*x+a,2*y+c,2*z+e);}return n;};
 return {root:faire(0,0,0,0),loader:{extension:()=>'.bin'}};}

async function jouer({allume}){reglage=allume?{...S.lot.chargement.prechauffer,voie:'fetch'/* CH-085 : cet essai vise la voie fetch (adresse de Potree) */,actif:true,rayonM:.5,sautMin:1/* CH-080 : le réglage livré (11) ne préchauffe plus la voisine ; ici, la voisine */}:{...S.lot.chargement.prechauffer,actif:false};demandes=[];
 const f=esv({cut:100,chargements:0}),pc=nuage(f),evts=[];pc.pcoGeometry=arbre();pc.matrixWorld={elements:[1,0,0,0,0,1,0,0,0,0,1,0,-32,-32,-32,1]};
 /* Messages de la page : l'observateur simulé répond à `banane5:voisins` (cut suivant à 1 m en y) ; les événements sont gardés. */
 const ecoutes=[],orig=f.ctx.postMessage;
 f.ctx.addEventListener=(t,fn)=>{if(t==='message')ecoutes.push(fn);};f.ctx.removeEventListener=(t,fn)=>{const i=ecoutes.indexOf(fn);if(i>=0)ecoutes.splice(i,1);};
 f.ctx.postMessage=(m,o)=>{if(m?.kind==='banane5:voisins'){const w=m.world,rows=[100,101,102].map(i=>({i,s:'invalid',e:[...w.left.map((v,k)=>v+(k===1?i-100:0)),...w.right.map((v,k)=>v+(k===1?i-100:0))]}));
   queueMicrotask(()=>{for(const fn of [...ecoutes])fn({source:require('node:vm').runInContext('window',f.ctx),origin:f.ctx.location.origin,data:{kind:'banane5:voisins-reponse',v:1,id:m.id,ok:true,table:{tables:1},rows}});});return;}
  if(m?.kind==='banane5:evt'){evts.push(J(m.event));return;}return orig(m,o);};
 const before=await f.call('state');const capture=J(await f.call('capture',before));
 const demandesALaFin=demandes.length;
 for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
 return {f,before,capture,evts,demandesALaFin};}

test('éteint (`actif:false`) : aucune demande, aucun événement de préchauffage',opts,async()=>{
 /* D-307 : allumé par défaut pour le lot d'essai ; le cas éteint est forcé par le réglage. */
 assert.equal(S.lot.chargement.prechauffer.actif,true);
 const j=await jouer({allume:false});assert.equal(demandes.length,0);assert.equal(j.evts.filter(e=>/^prechauffage/.test(e.kind)).length,0);
});

test('allumé : demandes après la capture, non attendues, à l’adresse de Potree ; nouvelle capture = annulation ; événements sans adresse',opts,async()=>{
 const eteint=await jouer({allume:false}),j=await jouer({allume:true});
 assert.deepEqual(j.capture.pointsSceneRelative,eteint.capture.pointsSceneRelative,'mêmes points capturés');
 assert.equal(j.demandesALaFin,0,'aucune demande avant la fin de la capture');
 assert.ok(demandes.length>=1&&demandes.length<=2,'des demandes partent ensuite, deux en vol au plus : '+demandes.length);
 for(const d of demandes){assert.match(d.url,/^\/nuage\/ept-data\/\d+-\d+-\d+-\d+\.bin$/);assert.equal(d.init.priority,'low');assert.equal(d.init.cache,'default');}
 /* Les fetch ne répondent jamais : la capture est pourtant rendue (rien n'est attendu). Une nouvelle capture annule le préchauffage. */
 const signaux=demandes.map(d=>d.init.signal);await j.f.call('capture',j.before);
 for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
 assert.ok(signaux.every(s=>s.aborted),'demandes en vol abandonnées au début de la capture suivante');
 const ev=j.evts.filter(e=>e.kind==='prechauffage');assert.ok(ev.length>=1);assert.equal(ev[0].motif,'capture');assert.equal(ev[0].annule,true);assert.equal(ev[0].coupe,100);assert.equal(ev[0].predite,101);
 const texte=JSON.stringify(j.evts.filter(e=>/^prechauffage/.test(e.kind)));assert.ok(!/\/|ept-data|\.bin|\d+-\d+-\d+-\d+/.test(texte.replace(/"kind":"[^"]*"/g,'')),'aucune adresse ni clé : '+texte);
 /* Fin : Potree recharge, le préchauffage relancé après la seconde capture s'arrête (sinon sa veille tournerait sans fin). */
 j.f.potree.numNodesLoading=5;for(let i=0;i<40;i++)await new Promise(r=>setImmediate(r));
 assert.ok(j.evts.filter(e=>e.kind==='prechauffage').some(e=>e.motif==='chargement'),'arrêt au premier chargement de Potree');
 fs.readFileSync=lire;P.page=pageOrig;
});
