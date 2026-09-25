'use strict';
/* 4.7.19 (KI-058) — passage à niveau lu par l'ornière, et voie encadrée.
 * Coupe synthétique : voie selon x, latéral selon y, hauteur selon z ; poses
 * ESV à y = 0 et y = 1,495 ; ornières de 55 mm, 50 mm de profondeur, qui
 * commencent 30 mm à l'intérieur de chaque pose. Bord lu : 30 à 32 mm (pas des
 * points) ; position du lecteur (calage −3 mm) : 27 à 29 mm à l'intérieur. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../vendor/capture-core.js'),L=require('../src/lot-decision.js'),X=require('../src/level-crossing.js');
const SIDES=['left','right'],Y={left:0,right:1.495};
const rail=y=>{const P=C.translation([0,y,0]);return {positionSceneRelative:[0,y,0],profileOriginSceneRelative:[0,y,0],railLocalToSceneRelative:P,profileLocalToSceneRelative:P,sceneRelativeToProfileLocal:C.inverse(P)};};
function coupe(cut,hauteur=y=>(y>=0.030&&y<=0.085)||(y>=1.495-0.085&&y<=1.495-0.030)?-0.05:0){
  const pts=[];for(let x=-0.4;x<=0.4;x+=0.04)for(let y=-0.5;y<=1.995;y+=0.004)pts.push([x,y,hauteur(y)]);
  return {identity:{part:9,cut,frameId:'f'},rails:{left:rail(Y.left),right:rail(Y.right)},pointsSceneRelative:pts,visibleByClipBoxes:pts.map(()=>true)};}
/* Science : moteur qui propose un décalage latéral (m, vers l'intérieur) par rail, ou s'abstient. */
const science=inward=>({rails:Object.fromEntries(SIDES.map(s=>[s,inward==null?{ok:true,next:{status:'unresolved',motif:'flank'}}
  :{ok:true,next:{status:'candidate',delta:[0,(s==='left'?1:-1)*inward,0]}}])),summary:{}});
const lecteur=capture=>X.read(capture).positions;
/* Reprise depuis la voie : le moteur relancé s'abstient aussi (repère illisible), donc ni reprise ni choix. */
const abstenu={scientificProposeBoth:()=>({rails:{left:{ok:false},right:{ok:false}},summary:{}})};
const decide=(capture,sci,anchors=[],options)=>L.decideCut({capture,science:sci,anchors,Shadow:abstenu,...(options?{options}:{})});
const anchor=(cut,positions)=>({identity:{part:9,cut,frameId:'f'},positions});

test('lecteur : bord de l\'ornière, calé de −3 mm latéral et +4 mm vertical',()=>{
  const c=coupe(10),r=X.read(c);
  assert.equal(r.crossing,true);assert.equal(r.ok,true);
  /* Points tous les 4 mm en travers : le bord est lu au pas de mesure près. */
  assert.ok(SIDES.every(s=>r.edges[s].edgeMm>=30&&r.edges[s].edgeMm<=32),JSON.stringify(r.edges));
  assert.ok(Math.abs(r.positions.left[1]-(r.edges.left.edgeMm-3)/1000)<1e-9&&Math.abs(r.positions.right[1]-(1.495-(r.edges.right.edgeMm-3)/1000))<1e-9);
  assert.ok(Math.abs(r.positions.left[2]-0.004)<1e-9,'dessus du champignon + 4 mm');
  const voie=coupe(10,y=>(y>=-0.065&&y<=0)||(y>=1.495&&y<=1.56)?0:-0.17);
  assert.equal(X.read(voie).crossing,false,'voie courante : pas de passage à niveau');
});

test('lecteur : chaussée extérieure plus basse que le champignon (772 droit), point isolé au fond ; creux trop large écarté',()=>{
  /* Rail gauche : champignon à −8 mm, chaussée extérieure à −19 mm, ornière de 30 à 90 mm à −40 mm (un pas à −29 mm),
   * chaussée intérieure à +5 mm. Rail droit : ornière ordinaire. */
  const h=y=>y<-0.035?-0.019:y<0.028?-0.008:y<0.090?(Math.abs(y-0.050)<0.0015?-0.029:-0.040):y<0.6?0.005:
    (y>=1.495-0.085&&y<=1.495-0.030)?-0.05:0;
  const r=X.read(coupe(10,h));
  assert.equal(r.ok,true,JSON.stringify(r.edges));assert.ok(r.edges.left.edgeMm>=28&&r.edges.left.edgeMm<=32,JSON.stringify(r.edges.left));
  assert.ok(Math.abs(r.edges.left.topMm+8)<=1,'dessus du champignon, pas la chaussée');
  const large=X.read(coupe(10,y=>(y>=0.030&&y<=0.230)||(y>=1.495-0.085&&y<=1.495-0.030)?-0.05:0));
  assert.equal(large.edges.left.ok,false,'creux de 20 cm : pas une ornière');
});

test('moteur d\'accord avec l\'ornière (≤ 8 mm) : premier passage inchangé',()=>{
  const d=decide(coupe(10),science(0.030));
  assert.equal(d.stage,'first-pass');assert.equal(d.levelCrossing.read,true);assert.equal(d.levelCrossing.engineMm,3);
  assert.equal(d.version,'lot-decision-v6');assert.equal(d.crossing,true);assert.equal(d.framed,true);
});

test('moteur en désaccord avec l\'ornière : premier passage inchangé, écart seulement consigné',()=>{
  /* Banc du 25/09 : s'en servir de garde retirait 7 premiers passages justes, sans arrêter aucun faux. */
  const d=decide(coupe(10),science(0.045));
  assert.equal(d.stage,'first-pass');assert.equal(d.levelCrossing.engineMm,18);
});

test('moteur abstenu, sans appui : l\'ornière pose la paire en dernier recours (écartement admissible), appui une fois posée',()=>{
  const c=coupe(10),d=decide(c,science(null));
  assert.equal(d.stage,'crossing');assert.equal(d.anchor,true);assert.equal(d.fromPredictionMm,null);
  assert.deepEqual(d.positions,lecteur(c));assert.ok(d.gaugeMm>1405&&d.gaugeMm<1470,String(d.gaugeMm));
  assert.equal(L.commandsPositions(d,{action:'lot'}),true);assert.equal(L.commandsPositions(d,{action:'engine'}),false);
});

test('avec appuis, cut différé par la chaîne : l\'ornière est posée si elle tombe à 10 mm de la voie, sinon le différé reste',()=>{
  const c=coupe(12),p=lecteur(c),shift=(q,mm)=>({left:[q.left[0],q.left[1]+mm/1000,q.left[2]],right:[q.right[0],q.right[1]+mm/1000,q.right[2]]});
  const ok=decide(c,science(null),[anchor(10,shift(p,2)),anchor(11,shift(p,2))]);
  assert.equal(ok.stage,'crossing');assert.equal(ok.fromPredictionMm,2);assert.deepEqual([...ok.anchorsUsed],[11,10]);
  assert.equal(ok.deferredReason,'left:frame right:frame','motif du différé que l\'ornière reprend');
  const loin=decide(c,science(null),[anchor(10,shift(p,25)),anchor(11,shift(p,25))]);
  assert.equal(loin.stage,'deferred');assert.equal(loin.reason,'left:frame right:frame');
  assert.equal(loin.levelCrossing.refused,'voie');assert.equal(loin.levelCrossing.fromPredictionMm,25);
});

test('lecteur coupé (rejeu d\'un lot antérieur) : décision de la 4.7.18',()=>{
  const d=decide(coupe(10),science(0.045),[],{crossing:false});
  assert.equal(d.stage,'first-pass');assert.equal(d.levelCrossing,undefined);assert.equal(d.crossing,false);
});

test('voie encadrée : courbe du second degré par 2 appuis de chaque côté, droite par 1 + 1',()=>{
  /* Rail en courbe : y = 0,002·x² (x le long de la voie, en cuts de 1 m). */
  const r=rail(0),at=x=>({left:[x,0.002*x*x,0],right:[x,1.495+0.002*x*x,0]});
  const courbe=[-2,-1,1,2].map(x=>({positions:at(x)}));courbe.framed=true;
  assert.ok(Math.abs(L.predictFramed(r,courbe,'left').lateral)<1e-12,'la parabole passe par le cut');
  const droite=[-1,1].map(x=>({positions:at(x)}));
  assert.ok(Math.abs(L.predictFramed(r,droite,'left').lateral-0.002)<1e-12,'1 + 1 : corde, flèche de 2 mm');
  const anchors=[8,9,11,12].map(cut=>anchor(cut,at(0)));
  assert.deepEqual(L.framedNeighbours({part:9,cut:10,frameId:'f'},anchors).map(a=>a.identity.cut),[9,8,11,12]);
  assert.equal(L.framedNeighbours({part:9,cut:10,frameId:'f'},anchors.slice(0,2)),null,'appuis d\'un seul côté : pas d\'encadrement');
  assert.equal(L.framedNeighbours({part:9,cut:10,frameId:'f'},anchors,{...L.DEFAULTS,framed:false}),null);
});
