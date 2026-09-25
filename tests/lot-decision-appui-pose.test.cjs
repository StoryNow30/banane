'use strict';
/* 4.7.18 — KI-057 (relecture 4.7.16, constat B1) : un appui est un cut POSÉ du
 * lot. Partie 35 (4.7.12) : 8951, reprise depuis la voie dont la cible tombait
 * hors de la vue d'ESV, a été différé ; sa position était pourtant déjà dans la
 * mémoire des appuis et a servi à 8952 et 8953. Désormais, l'appui proposé
 * attend : il n'entre dans la mémoire qu'une fois ses positions commandées,
 * appliquées et le cut validé. Même règle au rejeu hors ligne. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),K=require('../src/core.js'),A=require('../tools/acceptance-report.cjs');
const {base}=require('./fixtures.cjs'),{pilote,SIDES}=require('./helpers/pilote-lot.cjs');
const {pair,positions,pilotCut,pilotLot}=require('./helpers/acceptance-lot.cjs');

const id=cut=>({part:23,cut,frameId:'f'});
const entry=cut=>({identity:id(cut),positions:{left:[cut,0,0],right:[cut,1.435,0]},stage:'first-pass'});

test('KI-057 : quelles positions le Pilote pose-t-il ? (premier passage, reprise commandée, choix)',()=>{
  const fp={stage:'first-pass',anchor:true,positions:{}},win={stage:'window',anchor:true,positions:{}},ch={stage:'choice',anchor:false,positions:{}};
  assert.equal(L.commandsPositions(fp,null),true,'lot en observation : la paire du moteur est appliquée');
  assert.equal(L.commandsPositions(fp,{action:'engine',reason:'first-pass'}),true);
  assert.equal(L.commandsPositions(fp,{action:'defer',reason:'guard'}),false,'cut différé');
  assert.equal(L.commandsPositions(win,{action:'lot',reason:'window'}),true,'reprise commandée');
  for(const reason of ['hors-vue-right','gauge-HIGH_INVALID','error: x'])
    assert.equal(L.commandsPositions(win,{action:'engine',reason}),false,`reprise repliée (${reason}) : la proposition du moteur est appliquée, pas la voie`);
  assert.equal(L.commandsPositions(win,null),false,'lot en observation : une reprise n\'est jamais posée');
  assert.equal(L.commandsPositions(ch,{action:'lot',reason:'choice'}),false,'un choix n\'est jamais appui');
  assert.equal(L.commandsPositions({...fp,anchor:false},null),false);
});

test('KI-057 : l\'appui attend la validation du cut ; une nouvelle analyse remplace l\'attente',()=>{
  const state={anchors:[],pending:[]};
  L.holdAnchor(state,entry(100));L.holdAnchor(state,{...entry(100),stage:'window'});L.holdAnchor(state,entry(101));
  assert.deepEqual(state.pending.map(p=>[p.identity.cut,p.stage]),[[100,'window'],[101,'first-pass']],'« Réessayer ce cut » : une seule attente par cut');
  L.promoteAnchors(state,[id(101)]);
  assert.deepEqual(state.anchors.map(a=>a.identity.cut),[101],'seul le cut validé devient appui');
  assert.deepEqual(state.pending.map(p=>p.identity.cut),[100],'le cut non validé reste en attente, sans servir');
  L.promoteAnchors(state,[{part:23,cut:100,frameId:'autre'}]);
  assert.deepEqual(state.anchors.map(a=>a.identity.cut),[101],'autre repère : autre voie');
  for(let c=200;c<220;c++)L.holdAnchor(state,entry(c));
  assert.ok(state.pending.length<=8,'attentes bornées');
  assert.equal(L.DEFAULTS.anchorRule,'placed');assert.equal(L.DEFAULTS.version,'lot-decision-v6','v6 (4.7.19) : même règle d\'appui');
});

/* Service worker réel : le cas de la partie 35, rejoué. Le cut 100 est décidé
 * « reprise depuis la voie » à une position que le Pilote ne peut pas commander
 * (écartement hors contrat ici, hors de la vue sur le terrain) : la commande se
 * replie sur le moteur. Le cut 101 ne doit pas s'appuyer sur la position de 100. */
test('KI-057 : service worker — une reprise non commandée ne devient pas appui (cas 8951 → 8952)',async()=>{
  const far=Object.fromEntries(SIDES.map(s=>[s,base.rails[s].positionSceneRelative.map((v,i)=>v+(i===0?.25:0))]));
  const seen=[];
  const spy={...L,decideCut(args){const cut=args.capture.identity.cut;seen.push({cut,anchors:Array.from(args.anchors,a=>a.identity.cut)});
    return cut===100?{version:L.DEFAULTS.version,anchorRule:'placed',stage:'window',fromPredictionMm:3,anchorsUsed:[99],positions:far,anchor:true}:L.decideCut(args);}};
  const r=await pilote(spy,{start:100,end:101});const view=await r.b.settle();
  const obs=r.observed();
  assert.equal(obs[0].command.action,'engine','la reprise du cut 100 n\'est pas commandée');
  assert.equal(obs[0].anchorHeld,false,'consigné : appui non retenu');
  assert.deepEqual(seen.map(s=>s.cut),[100,101]);
  assert.deepEqual(seen[1].anchors,[],'le cut 101 ne s\'appuie pas sur la position non posée de 100');
  assert.deepEqual(Array.from(view.batch.lotObservation.anchors,a=>a.identity.cut).filter(c=>c===100),[],'100 absent de la mémoire des appuis');
});

test('KI-057 : service worker — un premier passage posé et validé devient appui du cut suivant',async()=>{
  const seen=[],spy={...L,decideCut(args){seen.push({cut:args.capture.identity.cut,anchors:Array.from(args.anchors,a=>a.identity.cut)});return L.decideCut(args);}};
  const r=await pilote(spy,{start:100,end:102});const view=await r.b.settle();
  const obs=r.observed();
  assert.deepEqual(seen.map(s=>s.cut),[100,101,102]);
  assert.ok(obs.every(o=>o.stage==='first-pass'&&o.anchorHeld===true),'premiers passages retenus en attente');
  assert.equal(view.batch.processed.length,2,'100 et 101 validés ; 102, dernier du lot, posé sans validation (4.7.19)');
  assert.deepEqual(seen.map(s=>s.anchors),[[],[100],[100,101]],'appuis = cuts validés avant la décision');
});

/* Rejeu hors ligne : même règle. Lot synthétique : 300 posé et validé, 301
 * différé (sa décision proposait pourtant un appui), 302 décidé ensuite. */
test('KI-057 : rejeu — règle « placed » d\'après ce que le Pilote a fait ; « decided » pour les lots antérieurs',()=>{
  const fp=c=>({version:'lot-decision-v5',anchorRule:'placed',stage:'first-pass',positions:positions(pair(c)),anchor:true,command:{action:'engine',reason:'first-pass'}});
  const cuts=[pilotCut(23,300,{lotObservation:fp(300)}),pilotCut(23,301,{outcome:'deferred',lotObservation:fp(301)}),pilotCut(23,302,{lotObservation:fp(302)})];
  const lot=pilotLot(23,cuts),clouds=cuts.map(c=>({captureId:c.observation.lidar.captureId,identity:c.id,rails:c.before,pointsSceneRelative:[[0,0,0]],visibleByClipBoxes:[true]}));
  const run=anchorRule=>{const seen=[],Ls={...L,decideCut(args){const c=args.capture.identity.cut;seen.push([c,args.anchors.map(a=>a.identity.cut)]);return fp(c);}};
    const out=A.replayLot(lot.diagnostic.observations,{clouds},{L:Ls,Shadow:{},options:{anchorRule}});return {seen,out};};
  const placed=run('placed');
  assert.deepEqual(placed.seen,[[300,[]],[301,[300]],[302,[300]]],'301, différé, n\'est pas appui de 302');
  assert.deepEqual(placed.out.map(x=>x.decision.anchorPlaced),[true,false,true]);
  assert.ok(placed.out.every(x=>!x.decision.anchorSimulated),'décisions identiques au lot : issue consignée, pas simulée');
  assert.deepEqual(run('decided').seen,[[300,[]],[301,[300]],[302,[300,301]]],'jusqu\'à la 4.7.17 : appui dès la décision');
  /* Lot en « observer » : seule la proposition du moteur est appliquée ; un
   * premier passage validé est posé, une reprise ne l'est jamais. */
  const win=c=>({...fp(c),stage:'window',command:undefined});
  const obs=[pilotCut(23,310,{lotObservation:{...fp(310),command:undefined}}),pilotCut(23,311,{lotObservation:win(311)}),pilotCut(23,312,{lotObservation:fp(312)})];
  const lo=pilotLot(23,obs),cl=obs.map(c=>({captureId:c.observation.lidar.captureId,identity:c.id,rails:c.before,pointsSceneRelative:[[0,0,0]],visibleByClipBoxes:[true]}));
  const vus=[],Lo={...L,decideCut(args){const c=args.capture.identity.cut;vus.push([c,args.anchors.map(a=>a.identity.cut)]);return c===311?win(c):{...fp(c),command:undefined};}};
  A.replayLot(lo.diagnostic.observations,{clouds:cl},{L:Lo,Shadow:{},mode:'observe',options:{anchorRule:'placed'}});
  assert.deepEqual(vus,[[310,[]],[311,[310]],[312,[310]]],'« observer » : la reprise 311, validée avec la proposition du moteur, n\'est pas appui');
  /* Le même lot rejoué comme la version courante (« apply ») : la reprise est commandée (simulée). */
  const vus2=[];A.replayLot(lo.diagnostic.observations,{clouds:cl},{L:{...Lo,decideCut(args){const c=args.capture.identity.cut;vus2.push([c,args.anchors.map(a=>a.identity.cut)]);return c===311?win(c):{...fp(c),command:undefined};}},Shadow:{},mode:'apply',options:{anchorRule:'placed'}});
  assert.deepEqual(vus2,[[310,[]],[311,[310]],[312,[310,311]]],'« apply » simulé : la reprise commandée et validée devient appui');
  // Règles du rejeu : consignées par la v5, « decided » avant.
  assert.equal(A.lotRules([{lotObservation:fp(300)}],'4.7.18').anchorRule,'placed');
  assert.equal(A.lotRules([{lotObservation:{version:'lot-decision-v4',pairGuard:true,chainMm:15,gaugeGuardMm:20,minTop:5}}],'4.7.18').anchorRule,'decided');
  assert.equal(A.rulesFor('4.7.17').anchorRule,'decided');assert.equal(A.rulesFor('4.7.18').anchorRule,'placed');
  assert.equal(A.lotRules([],null,true).anchorRule,'placed','règles actuelles');
});

test('KI-057 : rejeu d\'une décision différente du lot — commande simulée, dite comme telle',()=>{
  const d={stage:'window',anchor:true,positions:positions(pair(400))};
  const ok=A.placement(d,null,null,L);
  assert.deepEqual([ok.placed,ok.simulated,ok.command.action],[true,true,'lot'],'caméra inconnue : vue supposée bonne');
  const wide={...d,positions:{left:d.positions.left,right:d.positions.right.map((v,i)=>v+(i===1?.2:0))}};
  const out=A.placement(wide,null,null,L);
  assert.equal(out.placed,false,'écartement hors contrat : le Pilote ne pose pas');assert.match(out.command.reason,/^gauge-/);
  assert.equal(A.placement({...d,stage:'choice',anchor:false},null,null,L).placed,false);
});
