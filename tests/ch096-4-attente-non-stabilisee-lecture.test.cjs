'use strict';
/* CH-096, défaut 4 — « NIVEAU DE DÉTAIL NON STABILISÉ. » SUIVI D'UNE ERREUR DE LECTURE RESTE UNE ERREUR PASSAGÈRE.
 * Les deux attentes de la capture (src/adapter-page.js) rendent « Niveau de détail non stabilisé. » suivi du message de la dernière
 * lecture en échec, s'il y en a eu une pendant les 12 s. `transientCaptureError` (src/core.js) ne reconnaissait ce message que par
 * égalité exacte : suffixé, il n'était plus passager, la page ne relisait pas la vue et le lot passait en ERROR au lieu de la pause
 * reprenable. Correction (chantiers/CH-096/core.patch) : le message est reconnu par son début. `CH096_SANS_PATCH=1` : sans le patch (rouge). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('./helpers/ch096.cjs'),CORE=A.fichier('src/core.js'),K=A.installerCore();   // avant le moteur, les fixtures et la page
const {MemoryStore,SimulatedESV}=require('./fixtures.cjs'),{Engine}=require('../src/engine.js');
const {esv}=require('./helpers/esv-images.cjs');
const SUFFIXE='Niveau de détail non stabilisé. Quaternion de caméra non unitaire.';
test('le module chargé porte le patch de CH-096 (sauf CH096_SANS_PATCH=1)',()=>{
 assert.ok(['porté','appliqué','écarté','retiré'].includes(CORE.etat),'patch : '+CORE.etat);assert.equal(CORE.avecPatch,!A.SANS);});
test('transientCaptureError : le message suffixé est passager ; les autres verdicts ne changent pas',()=>{
 assert.equal(K.transientCaptureError(SUFFIXE),true);assert.equal(K.transientCaptureError(Error(SUFFIXE)),true);
 assert.equal(K.transientCaptureError('Niveau de détail non stabilisé.'),true);
 assert.equal(K.transientCaptureError('Lecture LiDAR instable : niveau de détail changé pendant la lecture.'),true);
 for(const m of ['Quaternion de caméra non unitaire.','Action interrompue.','Cible différente : cut','Lecture LiDAR annulée (arrêt demandé ou délai dépassé).',
  'Le niveau de détail non stabilisé.','niveau de détail non stabilisé.','',null,undefined,42])assert.equal(K.transientCaptureError(m),false,String(m));});
test('page : une lecture en échec pendant l\'attente non stabilisée → la vue est relue (capture-retry), plus d\'abandon au premier essai',async()=>{
 /* Aucun nuage : la signature reste vide, l'attente n'aboutit jamais ; la lecture des nuages lève une fois pendant l'attente. */
 const f=esv({cut:100}),scene=f.ctx.viewer.scene;let lectures=0,pannes=0;
 Object.defineProperty(scene,'pointclouds',{get(){lectures++;if(lectures===8){pannes++;throw Error('lecture des nuages en panne');}return [];}});
 const before=await f.call('state');let erreur=null;
 try{await f.call('capture',before);}catch(e){erreur=e.message;}
 assert.equal(pannes,1,'montage : la lecture a levé une fois');
 const reprises=f.progress.filter(p=>p.stage==='capture-retry').map(p=>p.detail.message);
 assert.ok(reprises.includes('Niveau de détail non stabilisé. lecture des nuages en panne'),'la tentative suffixée est relue : '+JSON.stringify(reprises)+' / '+erreur);
 assert.ok(K.transientCaptureError(erreur),'l\'erreur rendue reste passagère pour le moteur : '+erreur);});
test('moteur : capture en échec sur le message suffixé → lot en PAUSE reprenable (pas ERROR), puis Reprendre finit le lot',async()=>{
 const adapter=new SimulatedESV(),store=new MemoryStore(),e=new Engine(adapter,store);await e.init();e.s.mode='automatic-test';
 const capture=adapter.capture.bind(adapter);let panne=true;
 adapter.capture=async(...a)=>{if(adapter.identity.cut===101&&panne){panne=false;throw Error(SUFFIXE);}return capture(...a);};
 await e.startBatch({part:23,start:100,end:102,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});await e.task;
 assert.equal(e.s.batch.state,'PAUSED',e.s.batch.error?.message);assert.equal(e.s.batch.error.retryableCapture,true);assert.equal(e.s.batch.step,'capture');
 assert.deepEqual(adapter.calls,['capture','apply','validate','next'],'rien d\'envoyé sur le cut en pause');
 await e.resume();await e.task;
 assert.deepEqual(e.s.batch.processed.map(x=>x.cut),[100,101,102],e.s.batch.error?.message);
 assert.deepEqual(adapter.calls.filter(c=>c!=='capture'&&c!=='next'),['apply','validate','apply','validate','apply','validate']);
 assert.equal(adapter.calls.includes('skip'),false);});
