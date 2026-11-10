'use strict';
/* CH-090 (D-317 ; lots « Vision 8 » et « Vision 9 », ÉTABLI : 7 nœuds candidats par coupe en partie dense, 2 lancés ; 212 Mo sur 256 consommés par
 * un seul lot) — CAPACITÉ DU PRÉCHAUFFAGE et défauts de longue séance trouvés par la relecture CH-092. Essais purs (Node), monture de CH-092. Ils prouvent :
 *  - `enVolMax` 4 : jusqu'à 4 load() à nous à la fois, jamais plus ; livré à 4 ;
 *  - `memoire.octetsMax` vaut par opération : une séance qui a déjà chargé plus que le plafond continue de préchauffer ;
 *  - plafond d'octets atteint dans une opération : motif `plafond-octets` (et plus `plafond-noeuds`) ;
 *  - garde du tas : au-delà de `tasMaxMo`, aucun lancement ;
 *  - les erreurs passagères s'oublient après `oubliMs` : trois erreurs espacées n'arrêtent plus le lot ; trois erreurs rapprochées, si. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {P,monter,contexte}=require('./ch092-prechauffage-monture.cjs');
const dernier=e=>e.evts.filter(x=>x.kind==='prechauffage').at(-1);
const erreur=(p,st)=>p.ressources([{name:'https://x.invalid/nuage/ept-data/7-70-8-9.laz',initiatorType:'fetch',responseStatus:st}]);

test('enVolMax 4 : jusqu\'à 4 load() à nous à la fois, jamais plus',async()=>{
 const m=monter({enVolMax:4,memoire:{actif:true,noeudsMax:200,enVolMax:4}},{dureeImages:6});const {pc,e,p,potree}=m;let max=0;
 const r=p.apresCapture(contexte(pc));await e.tourner(300,()=>{max=Math.max(max,potree.numNodesLoading);});await r;
 assert.equal(max,4,'4 en vol au plus : '+max);
});

test('livré : 4 chargements à la fois, 256 Mo par opération, garde du tas à 1 536 Mo, oubli des erreurs à 10 min',()=>{
 const s=require('../src/settings.js').lot.chargement.prechauffer,r=P.reglage(s);
 assert.equal(r.enVolMax,4);assert.equal(r.memoire.enVolMax,4);assert.equal(r.memoire.octetsMax,268435456);assert.equal(r.memoire.tasMaxMo,1536);assert.equal(r.oubliMs,600000);assert.equal(r.loin.captureMaxMs,3000);
});

test('séance longue : le total chargé dépasse le plafond, le préchauffage continue (il s\'éteignait pour la vie de la page)',async()=>{
 const plafond=1048576;const m=monter({horizon:1,candidatsMax:1,memoire:{actif:true,noeudsMax:200,enVolMax:2,octetsMax:plafond}},{statuts:Object.fromEntries(Array.from({length:13},(_,i)=>[20+i*8,'invalid']))});const {pc,e,p}=m;
 let cut=20,total=0,derniere=0;const motifs=[];
 for(let k=0;k<12;k++){e.etiquette={part:23,cut};const r=p.apresCapture(contexte(pc,cut));await e.tourner(300);motifs.push((await r).motif);derniere=dernier(e).memOctets;total+=derniere;cut+=8;p.annuler('capture');}
 assert.ok(total>4*plafond,'total de la séance bien au-delà du plafond : '+total);assert.ok(derniere>400000,'la dernière opération a encore chargé : '+derniere);
 assert.deepEqual([...new Set(motifs)],['fini']);
});

test('plafond d\'octets atteint dans une opération : motif plafond-octets',async()=>{
 const m=monter({memoire:{actif:true,noeudsMax:200,enVolMax:2,octetsMax:1048576}});const {pc,e,p}=m;
 /* nœuds synthétiques grossis : 600 000 octets décodés chacun */
 const gros=n=>{const l=n.load;n.load=async function(){await l.call(this);};Object.defineProperty(n,'geometry',{configurable:true,get(){return this.loaded?{attributes:{position:{array:new Float32Array(150000)}}}:null;},set(){}});for(const c of Object.values(n.children))gros(c);};gros(pc.pcoGeometry.root);
 const r=p.apresCapture(contexte(pc));await e.tourner(400);const ev=await r;
 assert.equal(ev.motif,'plafond-octets');
});

test('garde du tas : au-delà de tasMaxMo, aucun lancement',async()=>{
 const m=monter({memoire:{actif:true,noeudsMax:200,enVolMax:2,tasMaxMo:256}});const {pc,e,journal,p}=m;e.env.tas=()=>300*1048576;
 const r=p.apresCapture(contexte(pc));await e.tourner(100);const ev=await r;
 assert.equal(journal.appels.length,0);assert.equal(ev.motif,'plafond-octets');
});

test('erreurs passagères : trois épisodes espacés de plus de oubliMs n\'arrêtent pas le lot ; trois rapprochés, si',async()=>{
 const une=async(m)=>{const {pc,e,journal,p}=m;const r=p.apresCapture(contexte(pc));let n=null;await e.tourner(200,()=>{if(n===null&&journal.appels.length>=2){erreur(p,502);n=1;}});await r;};
 const a=monter({oubliMs:60000});for(let k=0;k<4;k++){await une(a);a.e.horloge+=70000;}
 assert.equal(a.p.actif(),true,'quatre erreurs espacées : toujours allumé');
 const b=monter({oubliMs:60000});for(let k=0;k<3;k++){await une(b);b.e.horloge+=10001;}
 assert.equal(b.p.actif(),false,'trois erreurs rapprochées : arrêt pour le lot');
});

test('opération lointaine : plafond de nœuds propre (`loin.noeudsMax`), sinon celui de l\'opération proche',()=>{
 assert.equal(P.reglage({actif:true,loin:{actif:true}}).loin.noeudsMax,null);assert.equal(P.reglage({actif:true,loin:{actif:true,noeudsMax:96}}).loin.noeudsMax,96);
 assert.equal(P.reglage({actif:true,loin:{actif:true,noeudsMax:9999}}).loin.noeudsMax,null,'hors bornes : défaut');
 assert.equal(require('../src/settings.js').lot.chargement.prechauffer.loin.noeudsMax,96);
});
