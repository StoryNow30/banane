'use strict';
/* CH-056 — la garde « après un différé » rejouée dans tools/rejeu-voie-predite.cjs (chiffrage de son coût et de son bénéfice).
 * Données synthétiques seulement. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const R=require('../tools/rejeu-voie-predite.cjs');

const pose={left:[0,0,0],right:[0,1.435,0]};
const res=(...rs)=>new Map(rs.map(r=>[r.cut,r]));
const ctx=(zones={})=>({journal:{zonesJournal:zones}});
const juger=(g,{cut=12,appuis=0,resultats,zones={},stage='window'}={})=>{
  const r={cut,posee:true,ecart:{pire:7}};
  const d=R.garderApresDiffere(g,ctx(zones),cut,{stage,anchorsUsed:Array(appuis).fill({})},{action:'lot'},pose,r,resultats);
  return {d,r};};
const livree={regle:'R3',coupures:2,appuisMin:2,zone:'tout'};

test('garde livrée : un cut posable juste après un différé du lot, sans appui, est différé ; la pose évitée reste jugée',()=>{
  const {d,r}=juger(livree,{resultats:res({cut:11,posee:false})});
  assert.equal(d,true);assert.equal(r.posee,false);assert.equal(r.garde,true);assert.equal(r.ecartSansGarde.pire,7);assert.equal(r.ecart,undefined);
});
test('garde livrée : assez d\'appuis, différé hors fenêtre, ou différé par la garde elle-même (pas de cascade) : posé',()=>{
  assert.equal(juger(livree,{appuis:2,resultats:res({cut:11,posee:false})}).d,false);
  assert.equal(juger(livree,{resultats:res({cut:9,posee:false})}).d,false);
  assert.equal(juger(livree,{resultats:res({cut:11,posee:false,garde:true})}).d,false);
});
test('appuis comptés sans la garde : un cut de la garde dans la fenêtre d\'appuis compte pour un appui',()=>{
  /* 10 différé du lot, 11 différé par la garde : 12 a 1 appui mesuré + 1 rendu = 2 ⇒ posé. */
  assert.equal(juger(livree,{appuis:1,resultats:res({cut:10,posee:false},{cut:11,posee:false,garde:true})}).d,false);
  assert.equal(juger(livree,{appuis:0,resultats:res({cut:10,posee:false},{cut:11,posee:false,garde:true})}).d,true);
});
test('variantes : distance au différé, appuis exigés, zone PN/ADV, R1',()=>{
  const r10=res({cut:10,posee:false});
  assert.equal(juger({...livree,coupures:1},{resultats:r10}).d,false);
  assert.equal(juger({...livree,coupures:2},{resultats:r10}).d,true);
  assert.equal(juger({...livree,appuisMin:1},{appuis:1,resultats:r10}).d,false);
  assert.equal(juger({...livree,appuisMin:3},{appuis:2,resultats:r10}).d,true);
  assert.equal(juger({...livree,zone:'pn-adv'},{resultats:r10}).d,false);
  assert.equal(juger({...livree,zone:'pn-adv'},{resultats:r10,zones:{12:{pn:true,adv:false}}}).d,true);
  assert.equal(juger({...livree,zone:'hors-pn-adv'},{resultats:r10,zones:{12:{pn:false,adv:true}}}).d,false);
  assert.equal(juger({regle:'R1',coupures:2,zone:'tout'},{appuis:2,resultats:r10}).d,true);
});
test('variantes listées ; le journal donne les cuts de la garde réelle et les zones',()=>{
  const ids=R.VARIANTES.map(v=>v.id);
  assert.ok(ids.includes('garde-livree')&&ids.includes('garde-r3-c1-a1-pn-adv')&&ids.includes('garde-r1-c2-tout'));
  assert.equal(R.VARIANTES.find(v=>v.id==='temoin').garde,undefined);
  const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'ch056-')),'j.json');
  fs.writeFileSync(f,JSON.stringify({events:[
    {type:'proposed',timestamp:'1',identity:{part:3,cut:5}},
    {type:'garde-apres-differe',identity:{part:3,cut:5}},{type:'garde-apres-differe',etat:'erreur',identity:{part:3,cut:6}},
    {type:'regles-metier-ombre',portee:'cut',identity:{part:3,cut:5},zone:{pn:{id:1},adv:null}}]}));
  const j=R.lireJournal(f);
  assert.deepEqual([...j.gardeReel],[5]);assert.deepEqual(j.zonesJournal[5],{pn:true,adv:false});
});
test('synthèse CH-056 : retenus contre le témoin, jugés à 10 et 50 mm, borne de Wilson',()=>{
  const S=require('../chantiers/CH-056/synthese.cjs');
  const d={temoin:[{cut:1,posee:true,pire:3},{cut:2,posee:true,pire:60},{cut:3,posee:true,pire:null},{cut:4,posee:false}],
    'garde-x':[{cut:1,posee:false,garde:true},{cut:2,posee:false,garde:true},{cut:3,posee:false},{cut:4,posee:false}]};
  const s=S.synthese({7:d});
  assert.equal(s['garde-x'].retenus,3);assert.equal(s['garde-x'].retenusJustes,1);assert.equal(s['garde-x'].retenus50,1);
  assert.deepEqual(s['garde-x'].retenusCuts,['7/1:3','7/2:60','7/3*:nj']);
  assert.equal(s.temoin.poses50,1);assert.equal(s.temoin.posesJuges,2);
  assert.ok(Math.abs(S.wilson(0,125)[1]-0.0298)<0.001);
});
test('Écho en segments compactés (références vers `dictionaries`) : mêmes captures complétées que la session dépliée',()=>{
  const fx=R.fixtureSynthetique(),cap=fx.captures.get(3);
  const rec={visitId:'v1',startedAt:'1',identity:{...cap.identity,part:1,cut:3},beforeEstablished:{rails:cap.rails}};
  const clouds=['left','right'].map(s=>({format:'banane-native-lidar-chunk-v1',chunkId:'k'+s,visitId:'v1',side:s,rail:cap.rails[s],
    pointsSceneRelative:cap.pointsSceneRelative.slice(0,50),visibleByClipBoxes:Array(50).fill(true)}));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch056e-')),a=path.join(dir,'a.json'),b=path.join(dir,'b.json');
  fs.writeFileSync(a,JSON.stringify({records:[rec],clouds}));
  fs.writeFileSync(b,JSON.stringify({records:[{...rec,identity:{__ref:'identities:0'}}],clouds,dictionaries:{identities:[rec.identity]}}));
  const ca=new Map(),cb=new Map();R.completerParEcho(ca,[a],1);R.completerParEcho(cb,[b],1);
  assert.equal(ca.size,1);assert.equal(cb.size,1);assert.equal(cb.get(3).pointsSceneRelative.length,ca.get(3).pointsSceneRelative.length);
});
