'use strict';
/* Retour à un cut (4.9) : action de panneau `goto-cut` du service worker réel (VM, harnais de
 * background-harness.cjs). Refus pendant un lot en cours, une pause non effective, une pose, une
 * validation ou une capture ouverte ; journal `goto-cut` sans position ni projet ESV ; une seule
 * demande à la fois, annulable ; contrôle d'identité avant reprise du lot (D-067). L'adaptateur est
 * SIMULÉ (aucun code d'ESV) : la page elle-même est essayée dans retour-cut-page et retour-cut-refus. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {SimulatedESV,K}=require('./fixtures.cjs');
const {background,shadowHarness}=require('./helpers/background-harness.cjs');
const {simple}=require('./helpers/retour-cut.cjs');
class ESVRetour extends SimulatedESV{
  constructor(){super();this.retours=[];this.annulations=[];this.attente=null;this.panne=null;}
  async ping(){return {...await super.ping(),label:{pageId:this.identity.pageId,part:this.identity.part,cut:this.identity.cut}};}
  async cancel(o){this.calls.push('cancel');this.annulations.push(o);}
  /* Réponse de la forme de `goToCut` (src/adapter-page.js) : refus de partie, sinon saut confirmé. */
  async goToCut(cible,options,operationId){this.calls.push('goToCut');this.retours.push({cible,options,operationId});
    if(this.attente)await this.attente;if(this.panne)throw Error(this.panne);
    const avant={part:this.identity.part,cut:this.identity.cut},base={format:'ariane-goto-cut-v1',operationId,cible,identiteAvant:avant,
      cheminEvenement:{disponible:true,raison:null},cheminPas:{disponible:true,raison:null},bornes:{total:null,max:120,source:'cut-connu'},durationMs:5};
    if(cible.part!==avant.part)return {...base,chemin:null,commande:'aucune',emissions:0,commandInvoked:false,resultat:'refuse',confirme:false,pauseExplicite:false,
      identiteApres:null,refusal:{code:'WRONG_PART',message:'Partie demandée hors de la partie chargée. Rien n’a été envoyé à ESV.'}};
    this.identity.cut=cible.cut;
    return {...base,chemin:'evenement',commande:'evenement',emissions:1,commandInvoked:true,resultat:'confirme',confirme:true,pauseExplicite:false,pret:true,
      identiteApres:{part:this.identity.part,cut:this.identity.cut},refusal:null};}
}
async function montage(){const adapter=new ESVRetour(),b=background({adapter,shadow:shadowHarness(),
  globals:{BananeCore3:K,BananeSettings:require('../src/settings.js')}});await b.api('connect',{tabId:1});
  /* Copies hors du contexte VM du service worker (comparaisons profondes). */
  const api=async(...a)=>simple(await b.api(...a));
  return {b:{...b,api},adapter,engine:b.fonction('engine'),journal:()=>simple(b.store.events.filter(e=>e.type==='goto-cut'))};}
/* Lot Orbite en pause sur le cut 100 de la partie 23 (lecture faite, rien de posé). */
async function enPause(m,etat='PAUSED'){const avant=await m.adapter.state();
  m.engine.s.batch={id:'lot-essai',state:etat,step:'analyze',scope:{pageId:'fixture-page',part:23,start:90,end:130},activeIdentity:K.completeIdentity(avant.identity),
    processed:[{cut:98,key:'k98'},{cut:99,key:'k99'}],skipped:[],deferred:[],paused:[],interrupted:[],sequence:[],manuallyCompleted:[],pauseReason:'low-confidence'};
  m.engine.s.before=avant;m.engine.s.collection='READY_FOR_AFTER';m.engine.s.mode='automatic-test';}
const SANS_POSITION=/positionSceneRelative|railLocalToSceneRelative|frameId|pageId|"rails"|\d{6}_\d{6}_[A-Z]_/;

test('refus avant toute émission : lot en cours, pause non effective, pose, validation, incertitude, reprise manuelle',async()=>{
  const m=await montage();
  const cas=[[e=>{e.s.batch.state='RUNNING';},'LOT_EN_COURS'],[e=>{e.task=Promise.resolve();},'PAUSE_NON_EFFECTIVE'],[e=>{e.busy=true;},'PAUSE_NON_EFFECTIVE'],
    [e=>{e.s.batch.state='MANUAL_TAKEOVER';},'REPRISE_MANUELLE'],[e=>{e.s.batch.state='PAUSED_DEFER_NAVIGATION_UNCERTAIN';},'INCERTITUDE_A_CLORE'],
    [e=>{e.s.batch.state='PAUSED_AFTER_STATE_MISSING';},'INCERTITUDE_A_CLORE'],[e=>{e.s.intent={kind:'validate'};},'INCERTITUDE_A_CLORE'],
    [e=>{e.s.intent={kind:'apply'};},'INCERTITUDE_A_CLORE'],[e=>{e.s.reconcileRequired=true;},'INCERTITUDE_A_CLORE'],[e=>{e.s.applied={proposalId:'p'};},'POSE_NON_VALIDEE'],
    [e=>{e.s.batch=null;},'CAPTURE_OUVERTE'],[e=>{e.s.batch.state='COMPLETED';e.s.collection='IDLE';e.s.before=null;e.s.proposal={id:'p'};},'PROPOSITION_OUVERTE']];
  for(const [regler,code] of cas){await enPause(m);m.engine.task=null;m.engine.busy=false;m.engine.s.intent=null;m.engine.s.reconcileRequired=false;m.engine.s.applied=null;m.engine.s.proposal=null;
    regler(m.engine);const r=await m.b.api('goto-cut',{part:23,cut:97});
    assert.deepEqual([r.ok,r.resultat,r.code,r.commande,r.emissions],[false,'refuse',code,'refus',0],code);}
  m.engine.task=null;m.engine.busy=false;
  assert.equal(m.adapter.retours.length,0,'aucune demande n’a atteint la page');
  const j=m.journal();assert.equal(j.length,cas.length);assert.ok(j.every(e=>e.commande==='refus'&&e.resultat==='refuse'&&e.emissions===0&&Number.isFinite(e.dureeMs)));
  assert.deepEqual(j.map(e=>e.code),cas.map(c=>c[1]));
  await enPause(m);for(const c of [{part:23,cut:-1},{part:'23',cut:97},{part:23}]){const r=await m.b.api('goto-cut',c);assert.equal(r.code,'CIBLE_INVALIDE',JSON.stringify(c));}
  m.b.fonction('native').active=()=>true;await assert.rejects(m.b.api('goto-cut',{part:23,cut:97}),/Écho est actif/);
  assert.equal(m.adapter.retours.length,0);
});
test('lot en pause : une demande, confirmée, journalisée sans position ; rien de décidé ni posé ; garde de reprise posée',async()=>{
  const m=await montage();await enPause(m);const avant=JSON.stringify(m.engine.s.before.rails);
  const r=await m.b.api('goto-cut',{part:23,cut:97});
  assert.deepEqual([r.ok,r.resultat,r.commande,r.emissions,r.identiteAvant,r.identiteApres,r.gardeReprise],
    [true,'confirme','evenement',1,{part:23,cut:100},{part:23,cut:97},{part:23,cut:100}]);
  assert.equal(m.adapter.retours.length,1);const d=simple(m.adapter.retours[0]);
  assert.deepEqual(d.cible,{part:23,cut:97});assert.equal(typeof d.operationId,'string');assert.deepEqual(d.options,{chemin:'auto',borneConnue:100});
  assert.deepEqual(m.adapter.calls.filter(c=>c!=='goToCut'),[],'ni validation, ni SKIP, ni pose, ni capture, ni suivant');
  const [e]=m.journal();
  assert.deepEqual({cible:e.cible,avant:e.identiteAvant,apres:e.identiteApres,commande:e.commande,chemin:e.chemin,emissions:e.emissions,resultat:e.resultat,lot:e.lotId,etat:e.etatLot},
    {cible:{part:23,cut:97},avant:{part:23,cut:100},apres:{part:23,cut:97},commande:'evenement',chemin:'evenement',emissions:1,resultat:'confirme',lot:'lot-essai',etat:'PAUSED'});
  assert.ok(Number.isFinite(e.dureeMs)&&e.dureePageMs===5);assert.doesNotMatch(JSON.stringify(m.journal()),SANS_POSITION);
  assert.equal(m.engine.s.batch.state,'PAUSED');assert.equal(JSON.stringify(m.engine.s.before.rails),avant,'capture du lot intacte');
  assert.deepEqual(simple(m.engine.s.batch.retourCut.origine),{pageId:'fixture-page',part:23,cut:100});
});
test('contrôle d’identité avant reprise (D-067) : refus tant qu’ESV n’affiche pas le cut du lot ; levé au retour',async()=>{
  const m=await montage();await enPause(m);let reprises=0,autres=0;
  m.engine.resume=async()=>{reprises++;};m.engine.retryPaused=m.engine.skipPaused=m.engine.manualTakeover=async()=>{autres++;};
  await m.b.api('goto-cut',{part:23,cut:96});
  await assert.rejects(m.b.api('resume'),/« Reprendre » refusé : le lot est en pause sur le cut 100 de la partie 23, ESV affiche le cut 96/);
  for(const [action,nom] of [['retry','Réessayer'],['explicit-skip','SKIP explicite'],['manual-takeover','Reprise manuelle']])
    await assert.rejects(m.b.api(action),new RegExp(`« ${nom} » refusé`));
  assert.deepEqual([reprises,autres],[0,0]);
  const r=await m.b.api('goto-cut',{part:23,cut:100});assert.equal(r.ok,true);assert.deepEqual(r.gardeReprise,{part:23,cut:100},'l’origine reste celle du premier retour');
  await m.b.api('resume');assert.equal(reprises,1);assert.equal(m.engine.s.batch.retourCut,undefined,'garde levée');
  assert.deepEqual(m.adapter.calls.filter(c=>!['goToCut','state'].includes(c)),[]);
  /* Page rechargée (F5) : la reprise après rechargement ramène elle-même le lot ; la garde s'efface. */
  await m.b.api('goto-cut',{part:23,cut:99});m.adapter.identity.pageId='autre-page';await m.b.api('resume');assert.equal(reprises,2);
});
test('double appel refusé ; pendant le retour, reprise refusée ; annulation transmise avec l’opération',async()=>{
  const m=await montage();await enPause(m);let lacher;m.adapter.attente=new Promise(r=>{lacher=r;});
  const p1=m.b.api('goto-cut',{part:23,cut:97});while(!m.adapter.retours.length)await new Promise(r=>setImmediate(r));
  const r2=await m.b.api('goto-cut',{part:23,cut:98});assert.deepEqual([r2.ok,r2.code,r2.emissions],[false,'DEJA_EN_COURS',0]);
  await assert.rejects(m.b.api('resume'),/Retour à un cut en cours/);await assert.rejects(m.b.api('start',{part:23}),/Retour à un cut en cours/);
  const a=await m.b.api('goto-cut-cancel');assert.equal(a.cancelRequested,true);
  assert.deepEqual(simple(m.adapter.annulations),[{operationId:m.adapter.retours[0].operationId,reason:'goto-cut-cancel'}]);
  lacher();const r1=await p1;assert.equal(r1.ok,true);assert.equal(m.adapter.retours.length,1,'une seule demande a atteint la page');
  assert.deepEqual(await m.b.api('goto-cut-cancel'),{cancelRequested:false,reason:'aucun-retour'});
});
test('refus de la page sans émission : pas de garde ; adaptateur en panne : incertain, garde gardée',async()=>{
  const m=await montage();await enPause(m);
  let r=await m.b.api('goto-cut',{part:24,cut:97});
  assert.deepEqual([r.ok,r.resultat,r.code,r.commande,r.emissions],[false,'refuse','WRONG_PART','refus',0]);assert.equal(m.engine.s.batch.retourCut,undefined);
  m.adapter.panne='Adaptateur ESV sans réponse (simulé)';r=await m.b.api('goto-cut',{part:23,cut:97});
  assert.deepEqual([r.ok,r.resultat,r.code,r.commande,r.pauseExplicite],[false,'incertain','ADAPTATEUR','inconnue',true]);
  assert.deepEqual(simple(m.engine.s.batch.retourCut.origine),{pageId:'fixture-page',part:23,cut:100},'émission possible : la reprise exigera le cut 100');
  assert.deepEqual(m.journal().map(e=>[e.commande,e.resultat]),[['refus','refuse'],['inconnue','incertain']]);
});
