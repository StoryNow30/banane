'use strict';
/* B3 (C01, D-102) — transitions nommées du lot. Essais de caractérisation :
 * chaque essai rejoue une transition dans le service worker réel et vérifie
 * d'abord le comportement actuel (états, événements, poses), puis l'ordre des
 * transitions nommées relevé par le coordinateur (`coordinateurLot.journal`).
 * Aucun comportement nouveau : ces essais décrivent l'ordre de la 4.9.0.12. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('../src/lot-decision.js');
const {pilote}=require('./helpers/pilote-lot.cjs');
const {background}=require('./helpers/background-harness.cjs');
const {dernierDiffere}=require('./helpers/fin-partie.cjs');
const {dernierCut}=require('./helpers/dernier-cut.cjs');
const {espion,esvLent,reglages,attendreFin}=require('./helpers/esv-lent.cjs');

const NOMS=['demarrage','pause','reprise','arret','fin-de-lot','rechargement','cut-suivant','differe','erreur'];
const trace=b=>[...b.fonction('coordinateurLot.journal.map(t=>t.nom)')];
const types=b=>b.store.events.map(e=>e.type).filter(t=>!/adapter-progress|gcv1-shadow|esv-releve/.test(t));
const sousSuite=(liste,attendus)=>{let i=0;for(const x of liste)if(x===attendus[i])i++;return i===attendus.length;};
const libre=async b=>{for(let i=0;i<500&&b.fonction('engine.task');i++)await new Promise(r=>setImmediate(r));};
/* Action du panneau demandée pendant la validation du cut 100 (comme l'opérateur pendant un lot). */
function pendantCut100(action){let r;const esv=e=>{const v=e.validateAndNext.bind(e);
  e.validateAndNext=async(...a)=>{const out=await v(...a);if(a[0]?.cut===100)await r.b.api(action);return out;};};
  return {esv,lier:x=>{r=x;return x;}};}

test('B3 : les neuf transitions nommées, chacune passée par le coordinateur',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
  const b=background();
  assert.deepEqual([...b.fonction('TRANSITIONS_LOT')],NOMS);
  for(const nom of NOMS)assert.ok(src.includes(`transition('${nom}'`),'transition sans point d’entrée nommé : '+nom);
  assert.throws(()=>b.fonction(`coordinateurLot.transition('inconnue',()=>null)`),/Transition du lot inconnue/);
});

test('B3 démarrage → cut suivant → fin de lot (lot borné, pose au dernier cut, non validée)',async()=>{
  const r=await pilote(L,{start:100,end:101});const view=await r.b.settle();
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd.cut,101);assert.equal(view.batch.stoppedAtEnd.applied,true);
  assert.equal(r.applied.length,2,'deux poses');
  const t=types(r.b);assert.ok(sousSuite(t,['batch-started','validation-accepted','cut-target-changed','proposed','batch-stopped-at-end','applied-verified','batch-state']),t.join(' '));
  assert.deepEqual(trace(r.b),['demarrage','cut-suivant','fin-de-lot']);
});

test('B3 fin de lot naturelle (V4.6) : la boucle du moteur clôt le lot',async()=>{
  const b=background();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});
  while((await b.api('view')).batch?.state==='RUNNING')await new Promise(r=>setImmediate(r));
  const view=await b.api('view');assert.equal(view.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');assert.equal(view.batch.processed.length,2);
  assert.deepEqual(trace(b),['demarrage','cut-suivant','cut-suivant','fin-de-lot']);
});

test('B3 pause puis reprise : la reprise cherche d’abord un rechargement, puis le lot finit',async()=>{
  const p=pendantCut100('pause'),r=p.lier(await pilote(L,{start:100,end:101,esv:p.esv}));
  let view=await r.b.settle();await libre(r.b);
  assert.equal(view.batch.state,'PAUSED');assert.equal(view.batch.processed.length,1);
  await r.b.api('resume');view=await r.b.settle();
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd.cut,101);
  assert.ok(!types(r.b).includes('batch-rebased-after-reload'),'même page : aucun rattachement');
  assert.deepEqual(trace(r.b),['demarrage','cut-suivant','pause','reprise','rechargement','fin-de-lot']);
});

test('B3 arrêt pendant un cut : lot arrêté, rien d’autre',async()=>{
  const p=pendantCut100('stop'),r=p.lier(await pilote(L,{start:100,end:101,esv:p.esv}));
  await r.b.settle();await libre(r.b);const view=await r.b.api('view');
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.processed.length,1);assert.equal(view.batch.stoppedAtEnd??null,null);
  assert.ok(!types(r.b).includes('batch-stopped-at-end'));
  assert.deepEqual(trace(r.b),['demarrage','cut-suivant','arret']);
});

test('B3 F5 puis reprise : rechargement (lot rattaché à la nouvelle page) avant la suite du lot',async()=>{
  const r=await pilote(espion,{start:100,end:103,settings:reglages(),esv:esvLent});
  let view=await r.b.settle();assert.equal(view.batch.state,'PAUSED');
  r.b.adapter.onReload();await r.b.api('resume');view=await attendreFin(r);
  assert.equal(view.batch.stoppedAtEnd?.cut,103);
  const t=types(r.b);assert.ok(sousSuite(t,['defer-intent','capture-failed','batch-capture-wait','batch-state','batch-rebased-after-reload','capture-restarted','batch-stopped-at-end']),t.join(' '));
  assert.deepEqual(trace(r.b),['demarrage','cut-suivant','differe','reprise','rechargement','cut-suivant','fin-de-lot']);
});

test('B3 différé au dernier cut, ESV quitte la page : différé, puis reprise qui ferme le lot sans rechargement',async()=>{
  const {r,view}=await dernierDiffere({},{total:101});
  assert.equal(view.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');assert.equal(view.batch.departApresDiffere.cut,100);
  assert.ok(sousSuite(types(r.b),['defer-intent','defer-navigation-uncertain','fin-partie-depart','batch-state']));
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  const fin=await r.b.api('resume');
  assert.equal(fin.batch.state,'STOPPED');assert.equal(fin.batch.stoppedAtEnd.reason,'navigation-other-part-after-defer');
  assert.deepEqual(trace(r.b),['demarrage','differe','differe','reprise','fin-de-lot']);
});

test('B3 dernier cut de la partie validé sur place : cut suivant puis fin de lot',async()=>{
  const {r,view}=await dernierCut();
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd.reason,'dernier-cut-valide');
  assert.ok(sousSuite(types(r.b),['validation-intent','dernier-cut-detecte','validation-en-place','batch-stopped-at-end','validation-accepted']));
  assert.deepEqual(trace(r.b),['demarrage','cut-suivant','fin-de-lot']);
});

test('B3 erreur : refus au démarrage, message rendu au panneau et gardé dans l’avis',async()=>{
  const r=await pilote(L,{start:100,end:101});await r.b.settle();
  await assert.rejects(r.b.api('start',{part:23,start:100,end:101,geometryEngine:'inconnu'}),/Moteur géométrique de lot inconnu/);
  const view=await r.b.api('view');assert.equal(view.notice,'Moteur géométrique de lot inconnu.');assert.equal(view.batch.state,'STOPPED');
  assert.deepEqual(trace(r.b).slice(-2),['demarrage','erreur']);
});
