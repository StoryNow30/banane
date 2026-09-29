'use strict';
/* D2 (4.8.5, D-060) : garde d'écartement bas à 1 420 mm sur les premiers
 * passages SANS APPUI. Garde seulement, jamais une cible : le cut est différé,
 * aucune pose n'est cherchée à la place. Règle consignée dans la décision
 * (`lot-decision-v7`) ; les lots anciens se rejouent avec leurs règles. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const L=require('../src/lot-decision.js'),A=require('../tools/acceptance-report.cjs');
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const rail=y=>({positionSceneRelative:[0,y,0],profileLocalToSceneRelative:I,sceneRelativeToProfileLocal:I});
/* Premier passage dont la paire fait `mm` d'écartement (rail droit déplacé latéralement). */
function cas(mm,{cut=707,anchors=[],options}={}){
  const capture={identity:{part:11,cut,frameId:'f'},rails:{left:rail(0),right:rail(1.435)},pointsSceneRelative:[],visibleByClipBoxes:[]};
  const science={rails:{left:{ok:true,next:{status:'candidate',delta:[0,0,0]}},right:{ok:true,next:{status:'candidate',delta:[0,(mm-1435)/1000,0]}}},summary:{}};
  return L.decideCut({capture,science,anchors,Shadow:null,...(options?{options}:{})});
}
const appui=(cut,mm)=>({identity:{part:11,cut,frameId:'f'},positions:{left:[0,0,0],right:[0,mm/1000,0]},stage:'first-pass'});

test('règle consignée : lot-decision-v7, garde bas à 1 420 mm',()=>{
  assert.equal(L.DEFAULTS.version,'lot-decision-v7');assert.equal(L.DEFAULTS.lowGaugeGuardMm,1420);
  const d=cas(1435);assert.equal(d.version,'lot-decision-v7');assert.equal(d.lowGaugeGuardMm,1420);
});
test('premier passage sans appui sous 1 420 mm : différé, motif nommé, aucune pose ; 1 426 mm : posé',()=>{
  for(const mm of [1405,1414.5,1419.9]){const d=cas(mm);
    assert.equal(d.stage,'deferred',String(mm));assert.equal(d.reason,'first-pass-low-gauge');assert.equal(d.anchor,false);
    assert.equal(d.positions,undefined,'jamais une cible');assert.equal(d.gaugeMm,Math.round(mm*10)/10);assert.deepEqual(d.anchorsUsed,[]);}
  for(const mm of [1420,1426,1462.8]){const d=cas(mm);assert.equal(d.stage,'first-pass',String(mm));assert.ok(d.positions);}
});
test('avec un appui : non concerné (1 405 mm posé)',()=>{
  const d=cas(1405,{cut:708,anchors:[appui(707,1405)]});
  assert.equal(d.stage,'first-pass');assert.deepEqual(d.anchorsUsed,[707]);
});
test('garde éteinte (lots anciens rejoués avec leurs règles) : 1 405 mm posé',()=>{
  const d=cas(1405,{options:{lowGaugeGuardMm:null,version:'lot-decision-v6'}});
  assert.equal(d.stage,'first-pass');assert.equal(d.lowGaugeGuardMm,null);
});
test('rejeu : règles actuelles et lots v7 avec la garde ; lots v6 et exports antérieurs sans',()=>{
  assert.equal(A.lotRules([],null,true).lowGaugeGuardMm,1420);
  assert.equal(A.lotRules([{lotObservation:{version:'lot-decision-v7',pairGuard:true,lowGaugeGuardMm:1420}}],'4.8.5.1').lowGaugeGuardMm,1420);
  assert.equal(A.lotRules([{lotObservation:{version:'lot-decision-v6',pairGuard:true}}],'4.8.0').lowGaugeGuardMm,null);
  assert.equal(A.lotRules([],'4.8.0').lowGaugeGuardMm,null);assert.equal(A.lotRules([],'4.8.5.1').lowGaugeGuardMm,1420);
  assert.equal(A.rulesFor('4.7.20').lowGaugeGuardMm,null);assert.equal(A.rulesFor(null,true).lowGaugeGuardMm,1420);
  /* Les règles du lot sont bien transmises à la décision rejouée. */
  assert.match(fs.readFileSync(path.join(__dirname,'../tools/acceptance-report.cjs'),'utf8'),/options:\{pairGuard:rules\.pairGuard,[^}]*lowGaugeGuardMm:rules\.lowGaugeGuardMm/);
});
test('commande : le Pilote diffère, sans rien poser',()=>{
  const d=cas(1405),rails={left:{status:'candidate'},right:{status:'candidate'}};
  const r=L.commandRails({decision:d,runtimeRails:rails,before:rails});
  assert.equal(r.action,'defer');assert.equal(r.reason,'first-pass-low-gauge');
});

/* Panneau : le motif est affiché pour que l'opérateur trouve ces cuts à la relecture. */
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',onclick:null,oninput:null,
  attrs:{},style:{},classList:{toggle(){},add(){}},dataset:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},
  replaceChildren(){},append(){},addEventListener(){},querySelectorAll:()=>[],set onchange(_){}});
async function panneau(state){const elements=new Map();
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:()=>element(),
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async({action})=>({result:action==='view'?state:action==='list-tabs'?[]:{}})}};
  const context={document,chrome,location:{hash:'#automatic'},addEventListener:()=>{},setInterval:()=>{},setTimeout:()=>{},clearTimeout:()=>{},console,Date,
    matchMedia:()=>({matches:true,addEventListener(){}}),requestAnimationFrame:()=>{}};
  vm.createContext(context);vm.runInContext(SOURCE,context);
  for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));return id=>document.getElementById(id);}
test('panneau : les différés « écartement bas » sont nommés, cut par cut',async()=>{
  const id=cut=>({pageId:'p',part:11,cut,shape:'U50',frameId:'f'});
  const state={current:{identity:id(712)},batch:{state:'RUNNING',scope:{part:11,start:700,end:999999,endMode:'partie',geometryEngine:'geometry-candidate-v1'},
    processed:[{cut:706}],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],sequence:[706,707,711,712].map(c=>({cut:c})),activeIdentity:id(712),
    deferred:[{identity:id(707),deferredAt:'2026-09-29T08:00:00Z'},{identity:id(711),deferredAt:'2026-09-29T08:00:10Z'}],
    lotCommands:{707:{cut:707,action:'defer',stage:'deferred',reason:'first-pass-low-gauge'},711:{cut:711,action:'defer',stage:'deferred',reason:'first-pass-low-gauge'}}}};
  const $=await panneau(state);
  assert.match($('lot-compteurs').innerHTML,/refusés \(écartement bas\) : 707, 711/);
});
test('service worker : le motif du différé est gardé avec le cut (journal, panneau)',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
  assert.ok(src.includes('cut:identity.cut,stage:decision.stage,reason:decision.reason??null,'));
});

test('au passage à niveau aussi : premier passage sans appui à 1 405 mm différé, sans repli sur l’ornière',()=>{
  /* Même règle partout : un refus de la garde est repris par l'opérateur (relecture), jamais reposé par Ariane. */
  const C=require('../vendor/capture-core.js');
  const r=y=>{const P=C.translation([0,y,0]);return {positionSceneRelative:[0,y,0],profileOriginSceneRelative:[0,y,0],railLocalToSceneRelative:P,profileLocalToSceneRelative:P,sceneRelativeToProfileLocal:C.inverse(P)};};
  const pts=[];for(let x=-0.4;x<=0.4;x+=0.04)for(let y=-0.5;y<=1.995;y+=0.004)pts.push([x,y,(y>=0.030&&y<=0.085)||(y>=1.495-0.085&&y<=1.495-0.030)?-0.05:0]);
  const capture={identity:{part:9,cut:10,frameId:'f'},rails:{left:r(0),right:r(1.495)},pointsSceneRelative:pts,visibleByClipBoxes:pts.map(()=>true)};
  const science={rails:{left:{ok:true,next:{status:'candidate',delta:[0,0.045,0]}},right:{ok:true,next:{status:'candidate',delta:[0,-0.045,0]}}},summary:{}};
  const d=L.decideCut({capture,science,anchors:[],Shadow:null});
  assert.equal(d.stage,'deferred');assert.equal(d.reason,'first-pass-low-gauge');assert.equal(d.gaugeMm,1405);assert.equal(d.levelCrossing.read,true);
});
/* Revue de code de D2 (29/09). */
test('revue : voie encadrée (lot « Reprise ») qui confirme la paire : pas « sans appui », non refusé',()=>{
  /* Appuis posés 5 cuts avant et 5 cuts après, à 1 405 mm : aucun voisin à 3 cuts, mais une voie. */
  const d=cas(1405,{cut:710,anchors:[appui(705,1405),appui(715,1405)]});
  assert.notEqual(d.reason,'first-pass-low-gauge');assert.equal(d.stage,'first-pass');
});
test('revue : sans capture de départ, le refus est quand même un différé (jamais la paire du moteur)',()=>{
  const d=cas(1405),rails={left:{status:'candidate'},right:{status:'candidate'}};
  const r=L.commandRails({decision:d,runtimeRails:rails,before:undefined});
  assert.equal(r.action,'defer');assert.equal(r.reason,'first-pass-low-gauge');
});
