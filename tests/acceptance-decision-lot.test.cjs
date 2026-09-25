'use strict';
/* CHANTIER 5 — règles contractuelles de la décision sur le lot (cahier 4.8,
 * n°3 §3.6, n°9 §9.1, n°10, n°11 ; D-047, D-050 ; KI-053).
 *
 * `src/lot-decision.js` est chargé tel quel, comme dans le service worker, mais
 * sur une grille de minima CONSTRUITE (moteur et calage factices) : on place
 * soi-même deux minima admissibles près de la voie, cas que le banc terrain n'a
 * jamais présenté (`audit/ecartement-voisin-2026-09-24.md`). Rails de synthèse :
 * x le long de la voie, y latéral, z vertical, écartement des appuis 1 435 mm. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pair,positions,pilotCut,pilotLot}=require('./helpers/acceptance-lot.cjs');
const ROOT=path.join(__dirname,'..'),SIDES=['left','right'];

function loadDecision(grid){
  const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);
  for(const f of ['vendor/capture-core.js','src/gauge.js','src/continuity-observer.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
  ctx.BananeGeometry3={DEFAULTS:{alternativeSeparation:.02},propose(capture,side,{lab}){lab.onCoarse(grid[side].map(c=>({...c})));return {};}};
  ctx.BananePlacementConvention={bandOffsets:()=>({ok:true,top:new Array(20),face:new Array(10)}),calibrate:()=>({applied:false})};
  vm.runInContext(fs.readFileSync(path.join(ROOT,'src/lot-decision.js'),'utf8'),ctx,{filename:'src/lot-decision.js'});
  return ctx.BananeLotDecision;
}
/* Le moteur relancé depuis la voie : rail gauche retrouvé sur la prédiction,
 * rail droit laissé ambigu (motif éligible au choix). */
const rail=next=>({ok:true,next,frame:{sign:1,uSeed:0}});
const Shadow={scientificProposeBoth:()=>({summary:{pairGaugeRejected:false},
  rails:{left:rail({status:'candidate',delta:[0,0,0],changed:false}),right:rail({status:'unresolved',motif:'ambiguity'})}})};
const science={summary:{},rails:Object.fromEntries(SIDES.map(s=>[s,{ok:true,next:{status:'unresolved',motif:'ambiguity'}}]))};
const capture={identity:{part:2,cut:105,frameId:'f'},rails:pair(105,{left:[60,0],right:[60,0]},[0,0,0],1500),pointsSceneRelative:[[0,0,0]],visibleByClipBoxes:[true]};
const anchorsAt=(gaugeMm=1435)=>[103,104].map(cut=>({identity:{part:2,cut,frameId:'f'},positions:positions(pair(cut,{},[0,0,0],gaugeMm))}));
/* Deux minima du rail droit près de la prédiction (−8 et +14 mm, 22 mm l'un de
 * l'autre), le minimum global loin de la voie (50 mm). */
const deux={left:[{u:0,z:0,loss:1}],right:[{u:-.008,z:0,loss:1},{u:.014,z:0,loss:1.1},{u:.05,z:0,loss:.5}]};
const gaugeOf=d=>Math.hypot(...[0,1,2].map(i=>d.positions.right[i]-d.positions.left[i]))*1000;

test('D-050 : garde, jamais cible — deux minima admissibles près de la voie : le Pilote diffère, seule la variante de mesure prend le plus proche',()=>{
  const L=loadDecision(deux),decide=options=>L.decideCut({capture,science,anchors:anchorsAt(),Shadow,options});
  /* Réglages du Pilote (aucune option, D-050) : ni aide au choix, ni cible. */
  const pilote=decide();
  assert.equal(pilote.stage,'deferred');assert.equal(pilote.reason,'right:several-minima-near-prediction');
  assert.equal(pilote.positions,undefined);assert.equal(pilote.gaugeReference.mm,1435);
  /* Aide au choix (option de mesure) : les deux paires passent la garde, aucune n'est préférée. */
  const aide=decide({gaugeChoice:true});
  assert.equal(aide.stage,'deferred');assert.match(aide.reason,/gauge-choice:2/);assert.equal(aide.positions,undefined);
  /* Témoin : la variante « cible », interdite au Pilote, choisit la paire la plus
   * proche de l'écartement des voisins — le scénario distingue bien garde et cible. */
  const cible=decide({gaugeTargetStudy:true});
  assert.equal(cible.stage,'choice');assert.equal(cible.chosen.right.byGaugeGuard,true);
  assert.ok(Math.abs(gaugeOf(cible)-1427)<0.5,String(gaugeOf(cible)));
  /* Une garde ÉCARTE : à 10 mm, la paire à 14 mm des voisins est retirée ; il n'en reste qu'une. */
  const garde=decide({gaugeChoice:true,gaugeGuardMm:10});
  assert.equal(garde.stage,'choice');assert.ok(Math.abs(gaugeOf(garde)-1427)<0.5);
});

test('§7.1 : deux minima admissibles ne sont jamais départagés par l\'écartement, qu\'il soit proche de 1 435 mm ou des voisins',()=>{
  const L=loadDecision(deux);
  for(const gaugeMm of [1420,1435,1449])for(const options of [undefined,{gaugeGuardMm:null}]){
    const d=L.decideCut({capture,science,anchors:anchorsAt(gaugeMm),Shadow,options});
    assert.equal(d.stage,'deferred',`appuis à ${gaugeMm} mm, options ${JSON.stringify(options)}`);
    assert.equal(d.reason,'right:several-minima-near-prediction');assert.equal(d.positions,undefined);}
  /* Un seul minimum près de la voie : choisi pour sa POSITION, écartement contrôlé en admissibilité. */
  const seul=loadDecision({left:deux.left,right:[{u:.014,z:0,loss:1.1},{u:.05,z:0,loss:.5}]});
  const d=seul.decideCut({capture,science,anchors:anchorsAt(),Shadow});
  assert.equal(d.stage,'choice');assert.equal(d.chosen.right.fromPredictionMm,14);assert.ok(d.gaugeMm>=1405&&d.gaugeMm<=1470,String(d.gaugeMm));
});

test('choix par la voie : les deux rails exigés, et un choix n\'est jamais appui',()=>{
  /* Rail droit sans minimum qualifié près de la voie : aucun rail seul n'est rendu. */
  const aucun=loadDecision({left:deux.left,right:[{u:.05,z:0,loss:.5},{u:-.04,z:0,loss:.8}]});
  const d=aucun.decideCut({capture,science,anchors:anchorsAt(),Shadow});
  assert.equal(d.stage,'deferred');assert.equal(d.reason,'right:no-qualified-minimum-near-prediction');
  assert.equal(d.positions,undefined);assert.ok(!d.anchor);
  const cmd=aucun.commandRails({decision:d,runtimeRails:{left:{status:'candidate',delta:[0,0,0]},right:{status:'unresolved',delta:null}},before:capture.rails});
  assert.equal(cmd.action,'engine','sans garde ni position : la proposition du moteur, qui diffère le cut entier');
  /* Un choix abouti ne devient pas appui (n°9 §9.1, D-050). */
  const un=loadDecision({left:deux.left,right:[{u:.014,z:0,loss:1.1},{u:.05,z:0,loss:.5}]});
  const c=un.decideCut({capture,science,anchors:anchorsAt(),Shadow});
  assert.equal(c.stage,'choice');assert.equal(c.anchor,false);assert.ok(SIDES.every(s=>Array.isArray(c.positions[s])));
});

test('KI-053 : relecture des poses impossible après retrait par une garde : différé ; sans retrait, proposition du moteur',()=>{
  const L=require('../src/lot-decision.js');
  const runtimeRails={left:{status:'candidate',delta:[0,.004,0]},right:{status:'candidate',delta:[0,-.004,0]}};
  const before=pair(105,{},[0,0,0],1500),positionsLot=positions(pair(105));
  const casse=()=>{throw Error('repère illisible');};
  for(const retrait of [{guardDeferred:true,guardMm:42.1},{guardDeferred:true,guardMm:null,gaugeJumpMm:23.5}]){
    for(const stage of ['window','choice']){
      const out=L.commandRails({decision:{stage,positions:positionsLot,anchorsUsed:[104,103],...retrait},runtimeRails,before,expectedPoses:casse,cameras:null});
      assert.equal(out.action,'defer',`${stage} ${JSON.stringify(retrait)}`);assert.equal(out.reason,'guard-expected-poses-failed');
      for(const s of SIDES){assert.equal(out.rails[s].status,'unresolved');assert.equal(out.rails[s].delta,null);
        assert.match(out.rails[s].reasons[0],retrait.gaugeJumpMm?/écartement voisin/:/garde de continuité/);}}}
  const sans=L.commandRails({decision:{stage:'window',positions:positionsLot},runtimeRails,before,expectedPoses:casse,cameras:null});
  assert.equal(sans.action,'engine');assert.equal(sans.rails,runtimeRails);assert.equal(sans.reason,'expected-poses-failed');
});

test('rejeu : les règles consignées par le lot arrivent telles quelles à la décision',()=>{
  const A=require('../tools/acceptance-report.cjs');
  const lo=(extra={})=>({stage:'first-pass',anchor:false,applied:false,...extra});
  const lot=rules=>{const cuts=[pilotCut(23,500,{lotObservation:lo(rules)}),pilotCut(23,501,{outcome:'deferred',lotObservation:lo(rules)})];
    const l=pilotLot(23,cuts);return {label:'règles',...l,relecture:null,corpus:{clouds:cuts.map(c=>({captureId:c.observation.lidar.captureId,identity:c.id,rails:c.before,pointsSceneRelative:[[0,0,0]],visibleByClipBoxes:[true]}))}};};
  const seen=[],L={decideCut(args){seen.push(args.options);return {stage:'deferred',reason:'x'};}};
  const cas=[[{version:'lot-decision-v2',pairGuard:false},{},{pairGuard:false,chainMm:10,gaugeGuardMm:null,minTop:15,anchorRule:'decided',crossing:false,framed:false}],
    [{version:'lot-decision-v3',pairGuard:true,chainMm:15},{},{pairGuard:true,chainMm:15,gaugeGuardMm:null,minTop:15,anchorRule:'decided',crossing:false,framed:false}],
    [{version:'lot-decision-v4',pairGuard:true,chainMm:15,gaugeGuardMm:20,minTop:5},{},{pairGuard:true,chainMm:15,gaugeGuardMm:20,minTop:5,anchorRule:'decided',crossing:false,framed:false}],
    [{version:'lot-decision-v5',pairGuard:true,chainMm:15,gaugeGuardMm:20,minTop:5,anchorRule:'placed'},{},{pairGuard:true,chainMm:15,gaugeGuardMm:20,minTop:5,anchorRule:'placed',crossing:false,framed:false}],
    [{version:'lot-decision-v6',pairGuard:true,chainMm:15,gaugeGuardMm:20,minTop:5,anchorRule:'placed',crossing:true,framed:true},{},{pairGuard:true,chainMm:15,gaugeGuardMm:20,minTop:5,anchorRule:'placed',crossing:true,framed:true}],
    [{version:'lot-decision-v2',pairGuard:false},{currentRules:true},{pairGuard:true,chainMm:15,gaugeGuardMm:20,minTop:5,anchorRule:'placed',crossing:true,framed:true}]];
  for(const [rules,opt,attendu] of cas){seen.length=0;
    const r=A.report([lot(rules)],{replay:true,replayDeps:{L,Shadow:{},maxAnchors:40},...opt});
    assert.equal(seen.length,2);for(const o of seen)assert.deepEqual(o,attendu,JSON.stringify(rules));
    const {source,...consignees}=r.lots[0].lotDecisionRules;assert.deepEqual(consignees,attendu);
    assert.equal(source,opt.currentRules?'actuelles':'lot');}
});
