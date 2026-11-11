'use strict';
/* CH-110 (D-342, D-343) — garde-fous de la remise d'une place de chargement à Potree, dans la page simulée (vm, horloge à événements discrets,
 * tests/helpers/esv-images.cjs). Le patch chantiers/CH-110/adapter-page.patch est appliqué à une copie temporaire de src/adapter-page.js (déjà
 * appliqué au tronc : lu tel quel). Patch absent ou qui ne s'applique plus : ÉCHEC ; outil `patch` absent : saut. L'observateur des ressources est
 * simulé : l'essai lui fait rendre des requêtes `ept-data` en échec quand il veut. Arbre de Potree synthétique (nœud commun : `key` tableau). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'..'),SRC=path.join(racine,'src/adapter-page.js'),PATCH=path.join(racine,'chantiers/CH-110/adapter-page.patch');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch110-vm-')),copie=path.join(dir,'src/adapter-page.js');fs.mkdirSync(path.join(dir,'src'));fs.copyFileSync(SRC,copie);
const DEJA=fs.readFileSync(SRC,'utf8').includes('function planifierRemise(');
const r=DEJA?{status:0}:!fs.existsSync(PATCH)?{status:1,stderr:'patch absent'}:spawnSync('patch',['-s','-p1','-d',dir,'-i',PATCH],{encoding:'utf8'});
const raison=r.error?.code==='ENOENT'?'outil patch absent':null,opts=raison?{skip:raison}:{};
const P=require('./helpers/page.cjs'),pageOrig=P.page;let reglage={},po=null;
P.page=({globals={},...o}={})=>pageOrig({...o,adapter:copie,globals:{...globals,PerformanceObserver:class{constructor(f){this.f=f;}observe(){po=this;}},
 BananeSettings:{...globals.BananeSettings,lot:{...globals.BananeSettings?.lot,reparationPotree:reglage}}}});
const {esv,nuage}=require('./helpers/esv-images.cjs');
const J=x=>JSON.parse(JSON.stringify(x??null));
const evts=f=>J(f.reponses.filter(m=>m.kind==='banane5:evt'&&m.event?.kind==='potree-place-rendue').map(m=>m.event));
const tour=()=>new Promise(res=>setTimeout(res,30));   /* l'horloge de la page avance d'elle-même jusqu'à la minuterie suivante */
/* Page, arbre « 0-0-0-0 » → « 1-1-0-1 » → « 2-3-1-2 », compteur `chargements`, nœud cible dans l'état donné. */
function monter({chargements=1,etat={loading:true,loaded:false},regl={actif:true,essaisParNoeud:2,attenteMs:1000}}={}){reglage=regl;po=null;
 const f=esv({cut:100,chargements}),pc=nuage(f),cible={key:[2,3,1,2],...etat,children:{}},n1={key:[1,1,0,1],loaded:true,loading:false,children:{5:cible}};
 pc.pcoGeometry={root:{key:[0,0,0,0],loaded:true,loading:false,children:{0:{key:[1,0,0,0],children:{}},5:n1}}};
 const echec=(cle,statut=502)=>po.f({getEntries:()=>[{name:`https://esv.invalid/x/ept-data/${cle}.laz`,responseStatus:statut}]});
 return {f,cible,echec};}
test('le patch s’applique au tronc (ou y est déjà)',opts,()=>{assert.equal(r.status,0,'patch : '+(r.stderr||r.stdout));monter();assert.ok(po,'observateur des ressources installé');});

test('échec puis attente : nœud remis « non chargé, non en cours », compteur −1, un événement ; rien avant l’attente',opts,async()=>{
 const {f,cible,echec}=monter({chargements:3});const t0=f.clock();echec('2-3-1-2');
 assert.equal(cible.loading,true,'rien de touché tout de suite');assert.equal(f.potree.numNodesLoading,3);
 await tour();assert.equal(cible.loading,false);assert.equal(cible.loaded,false);assert.equal(f.potree.numNodesLoading,2);
 assert.ok(f.clock()-t0>=1000,'remise après l’attente (1 s)');
 const e=evts(f);assert.equal(e.length,1);assert.deepEqual([e[0].motif,e[0].cle,e[0].statut,e[0].essai,e[0].avant,e[0].apres,e[0].rendues,e[0].episode],['rendue','2-3-1-2',502,1,3,2,1,1]);
});

test('jamais deux fois pour le même échec : deux entrées de la même clé en attente → une remise',opts,async()=>{
 const {f,echec}=monter({chargements:2});echec('2-3-1-2');echec('2-3-1-2');await tour();
 assert.equal(f.potree.numNodesLoading,1);assert.equal(evts(f).filter(e=>e.motif==='rendue').length,1);
});

test('plafond par nœud : au-delà de `essaisParNoeud`, le nœud reste « en cours » et le compteur intact',opts,async()=>{
 const {f,cible,echec}=monter({chargements:1,regl:{actif:true,essaisParNoeud:1,attenteMs:1000}});
 echec('2-3-1-2');await tour();assert.equal(cible.loading,false);
 cible.loading=true;f.potree.numNodesLoading++;   /* Potree le redemande ; nouvel échec */
 echec('2-3-1-2');await tour();assert.equal(cible.loading,true,'plafond : rien de touché');assert.equal(f.potree.numNodesLoading,1);
 assert.deepEqual(evts(f).map(e=>[e.motif,e.essai]),[['rendue',1],['plafond',2]]);
});

test('état inattendu : nœud introuvable, déjà chargé, plus en cours, compteur à 0 ou absent → rien de touché, motif dit',opts,async()=>{
 let m=monter();m.echec('3-0-0-0');await tour();assert.equal(m.f.potree.numNodesLoading,1);assert.equal(evts(m.f)[0].motif,'introuvable');
 m=monter({etat:{loading:true,loaded:true}});m.echec('2-3-1-2');await tour();assert.equal(m.f.potree.numNodesLoading,1);assert.equal(m.cible.loading,true);assert.equal(evts(m.f)[0].motif,'etat');
 m=monter({etat:{loading:false,loaded:false}});m.echec('2-3-1-2');await tour();assert.equal(m.f.potree.numNodesLoading,1);assert.equal(evts(m.f)[0].motif,'etat');
 m=monter({chargements:0});m.echec('2-3-1-2');await tour();assert.equal(m.f.potree.numNodesLoading,0,'jamais sous 0');assert.equal(m.cible.loading,true);assert.equal(evts(m.f)[0].motif,'compteur-zero');
 m=monter();m.f.potree.numNodesLoading=undefined;m.echec('2-3-1-2');await tour();assert.equal(m.cible.loading,true);assert.equal(evts(m.f)[0].motif,'etat');
 m=monter();m.echec('2-3-1-2',200);await tour();assert.equal(m.cible.loading,true,'statut 200 : pas un échec');assert.equal(evts(m.f).length,0);
});

test('épisodes : un nouvel épisode quand un échec arrive sans remise en attente',opts,async()=>{
 const {f,cible,echec}=monter({chargements:2});echec('2-3-1-2');await tour();
 cible.loading=true;echec('2-3-1-2');await tour();assert.deepEqual(evts(f).map(e=>[e.episode,e.essai]),[[1,1],[2,2]]);assert.equal(f.potree.numNodesLoading,0);
});

test('réglage éteint : aucune remise, aucun événement, nœud et compteur intacts',opts,async()=>{
 const {f,cible,echec}=monter({regl:{actif:false,essaisParNoeud:2,attenteMs:1000}});
 assert.ok(po,'l’observateur reste celui de la ligne de base (allumée par le réglage livré)');echec('2-3-1-2');await tour();
 assert.equal(cible.loading,true);assert.equal(f.potree.numNodesLoading,1);assert.equal(evts(f).length,0);
});
