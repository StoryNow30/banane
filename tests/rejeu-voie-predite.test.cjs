'use strict';
/* Rejeu « voie prédite » (tools/rejeu-voie-predite.cjs) : essai sur une fixture SYNTHÉTIQUE (voie droite, rails de 64 mm de champignon,
 * nuage fabriqué, aucune donnée réelle). Les `premiers` cuts sont posés seuls et deviennent appuis ; les suivants ont toute la voie
 * décalée de 230 mm, plus loin que la fenêtre d'analyse du moteur (180 mm) et que la vue d'ESV (200 mm). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../tools/rejeu-voie-predite.cjs');

const ctx=T.fixtureSynthetique();
const res=T.executer(ctx,['temoin','vue-reelle','vue-serie']);
const par=id=>res.sorties.find(x=>x.synthese.id===id);
const ligne=(id,cut)=>par(id).detail.find(r=>r.cut===cut);

test('le témoin refait le lot : les premiers cuts sont posés seuls, la voie décalée reste différée',()=>{
  for(const cut of [1,2,3]){const r=ligne('temoin',cut);assert.equal(r.posee,true);assert.equal(r.stage,'first-pass');assert.ok(r.pire<=5,`cut ${cut} : ${r.pire} mm`);}
  for(const cut of [4,5,6,7])assert.equal(ligne('temoin',cut).posee,false,`cut ${cut} posé alors que la vue ne le permet pas`);
  /* Les trois premiers différés avaient une prédiction (reprise depuis la voie) ; la vue l'a refusée. Le quatrième n'a plus d'appui à moins de 3 cuts. */
  assert.equal(ligne('temoin',4).stage,'window');
  assert.equal(ligne('temoin',7).reason,'no-anchor');
  const s=par('temoin').synthese;
  assert.equal(s.differes.poses,0);assert.equal(s.differes.faux,0);assert.equal(s.differes.mauvaiseVoie,0);
});

test('vue déplacée, appuis du lot seuls : la voie prédite retrouve les rails, la vue doit bouger',()=>{
  for(const cut of [4,5,6]){const r=ligne('vue-reelle',cut);assert.equal(r.posee,true);assert.equal(r.stage,'window');assert.ok(r.pire<=5,`cut ${cut} : ${r.pire} mm`);
    assert.equal(r.vue.dans,false);assert.ok(r.vue.dezoom>1.1&&r.vue.dezoom<1.3,'dézoom '+r.vue.dezoom);assert.ok(r.vue.panPx>50&&r.vue.panPx<150);}
  assert.equal(ligne('vue-reelle',7).posee,false,'sans appui réel à 3 cuts, le cut reste différé');
  const s=par('vue-reelle').synthese;assert.equal(s.differes.poses,3);assert.equal(s.differes.juste5,3);assert.equal(s.differes.vue.exigentDeplacement,3);
});

test('en série : chaque pose acceptée devient l\'ancre du suivant, sans dérive sur la fixture',()=>{
  const s=par('vue-serie').synthese;
  assert.equal(s.differes.n,4);assert.equal(s.differes.poses,4);assert.equal(s.differes.juste5,4);assert.equal(s.differes.faux,0);assert.equal(s.differes.mauvaiseVoie,0);
  assert.equal(s.differes.vue.exigentDeplacement,4);assert.equal(s.differes.vue.dezoomMax<1.3,true);
  const erreurs=[4,5,6,7].map(c=>ligne('vue-serie',c).pire);
  assert.ok(Math.max(...erreurs)-Math.min(...erreurs)<2,'erreurs '+erreurs);
  /* Les cuts déjà posés ne changent pas. */
  assert.equal(s.poses_origine.retires,0);assert.equal(s.poses_origine.deplaces,0);assert.equal(s.poses_origine.inchanges,3);
});

test('jugement : juste à 5 et 10 mm, faux au-delà, mauvaise voie à 100 mm',()=>{
  const j=pire=>T.jugement({posee:true,ecart:{pire}});
  assert.equal(j(4.9),'juste5');assert.equal(j(5.1),'juste10');assert.equal(j(10),'juste10');assert.equal(j(10.1),'faux');
  assert.equal(j(99),'faux');assert.equal(j(163),'mauvaise-voie');
  assert.equal(T.jugement({posee:false}),'abstenu');assert.equal(T.jugement({posee:true,ecart:null}),'non-juge');
});

test('vue nécessaire : dans la vue, dézoom et glissement',()=>{
  const cap=ctx.captures.get(4),P=T.positionMic;
  const dans=T.vueNecessaire(cap,Object.fromEntries(['left','right'].map(s=>[s,cap.rails[s].positionSceneRelative])));
  assert.equal(dans.dans,true);assert.equal(dans.dezoom,1);assert.equal(dans.panPx,0);
  const loin=T.vueNecessaire(cap,Object.fromEntries(['left','right'].map(s=>[s,P(cap.rails[s],[0,-300,0])])));
  assert.equal(loin.dans,false);assert.ok(Math.abs(loin.dezoom-300/200/.99)<.02,'dézoom '+loin.dezoom);
  assert.ok(loin.panMm>90&&loin.panMm<110,'glissement '+loin.panMm);
});

test('repère de la liste d\'ESV : T retrouvée, fenêtre de ±5 lignes',()=>{
  const T0=[1234.5,2345.25,3.125];
  const lignes=[...ctx.captures.values()].map(c=>({cut:c.cut,statut:'invalid',left:c.rails.left.positionSceneRelative.map((v,i)=>v+T0[i]),right:c.rails.right.positionSceneRelative.map((v,i)=>v+T0[i])}));
  const rep=T.estimerT(lignes,ctx.captures);
  assert.ok(rep.ecartMaxMm<1e-6&&rep.rigideMaxMm<1e-6);assert.equal(rep.cadres,1);T0.forEach((v,i)=>assert.ok(Math.abs(rep.T[i]-v)<1e-9));
  const par=new Map(lignes.map(l=>[l.cut,l]));
  assert.deepEqual(T.fenetreListe(par,4).map(r=>r.i),[1,2,3,4,5,6,7]);
  /* Seules les lignes valides, autres que le cut décidé, deviennent des appuis (B1) ; les lignes invalides du lot n'en sont pas. */
  const B=require('../src/appuis-liste.js');
  assert.equal(B.appuis(T.fenetreListe(par,4),rep.parCadre['f-synth'].T,{part:1,cut:4,frameId:'f-synth'}).length,0);
  par.get(2).statut='valid';par.get(4).statut='valid';
  const app=B.appuis(T.fenetreListe(par,4),rep.parCadre['f-synth'].T,{part:1,cut:4,frameId:'f-synth'});
  assert.deepEqual(app.map(a=>a.identity.cut),[2]);
  app[0].positions.left.forEach((v,i)=>assert.ok(Math.abs(v-ctx.captures.get(2).rails.left.positionSceneRelative[i])<1e-9));
});

test('aucune donnée réelle dans la fixture : repère de scène arrondi, aucun grand nombre',()=>{
  for(const c of ctx.captures.values())for(const s of ['left','right'])assert.ok(c.rails[s].positionSceneRelative.every(v=>Math.abs(v)<1000));
});

test('règle prudente : refuse sans confiance, sans cohérence des deux rails, trop loin de la voie, trop profond, ou en ADV sans deux rails cohérents',()=>{
  const r=(o={})=>({stage:'window',fromPredictionMm:4,anchorsUsed:[10,11],validatedAnchors:null,profondeur:2,
    moteur:{left:{confiance:70},right:{confiance:65}},deplacementMm:{left:[-150,2],right:[-148,3]},...o});
  const g={etages:['window'],fenetreMm:15,confMin:50,cohMm:10,cohVMm:15,appuisMin:2,profMax:8,adv:{etages:['window'],cohMm:5,appuisMin:2,profMax:4}};
  assert.equal(T.regleAccepte(g,r(),null),null);
  assert.equal(T.regleAccepte(g,r({stage:'choice'}),null),'etage');
  assert.equal(T.regleAccepte(g,r({fromPredictionMm:20}),null),'fenetre');
  assert.equal(T.regleAccepte(g,r({anchorsUsed:[10]}),null),'appuis');
  assert.equal(T.regleAccepte(g,r({profondeur:9}),null),'profondeur');
  assert.equal(T.regleAccepte(g,r({moteur:{left:{confiance:70},right:{confiance:40}}}),null),'confiance');
  assert.equal(T.regleAccepte(g,r({moteur:{left:{confiance:70},right:{confiance:0,s1:true}}}),null),null,'un rail retenu par S1 n\'a pas de confiance calibrée');
  assert.equal(T.regleAccepte(g,r({moteur:{left:{confiance:70},right:{confiance:null}}}),null),'confiance');
  assert.equal(T.regleAccepte(g,r({deplacementMm:{left:[-150,2],right:[-120,3]}}),null),'coherence');
  assert.equal(T.regleAccepte(g,r({deplacementMm:{left:[-150,2],right:[-148,30]}}),null),'coherence-vertical');
  /* en zone d'ADV : seuils plus stricts, et `adv:false` interdit toute pose nouvelle */
  const adv={adv:{zone:2}};
  assert.equal(T.regleAccepte(g,r(),adv),null);
  assert.equal(T.regleAccepte(g,r({deplacementMm:{left:[-150,2],right:[-143,3]}}),adv),'coherence');
  assert.equal(T.regleAccepte(g,r({profondeur:5}),adv),'profondeur');
  assert.equal(T.regleAccepte({...g,adv:false},r(),adv),'adv-interdit');
  assert.equal(T.regleAccepte({},r({stage:'choice',profondeur:99}),adv),null,'sans seuil, rien n\'est refusé');
  assert.equal(T.regleAccepte({sansAncre:true},r(),null,{reason:'no-anchor'}),null);
  assert.equal(T.regleAccepte({sansAncre:true},r(),null,{reason:'left:no-qualified-minimum-near-prediction'}),'avec-ancre');
});

test('CSV : une ligne par cut, séparateur « ; », virgule décimale, aucune coordonnée absolue',()=>{
  const csv=T.csvVariante(par('vue-serie').detail).trim().split('\n');
  assert.equal(csv.length,1+7);
  assert.equal(csv[0].split(';').length,15);
  const l4=csv.find(l=>l.startsWith('4;')).split(';');
  assert.equal(l4[1],'differee');assert.equal(l4[4],'oui');assert.equal(l4[9],'non');
  assert.match(l4[10],/^1,1\d$/,'dézoom avec virgule');
});

test('lecture du journal, de la jointure et du corpus : ordre du lot, pose de l\'opérateur depuis le départ, captures allégées',()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'voie-'));
  try{
    const journal={events:[
      {type:'proposed',timestamp:'2026-01-01T00:00:03Z',identity:{cut:12}},{type:'proposed',timestamp:'2026-01-01T00:00:01Z',identity:{cut:10}},
      {type:'proposed',timestamp:'2026-01-01T00:00:02Z',identity:{cut:11}},{type:'proposed',timestamp:'2026-01-01T00:00:04Z',identity:{cut:11}},
      {type:'b1-ombre',identity:{cut:11},reel:{stage:'deferred'},hypothese:{stage:'window'},gardes:[10,12]}]};
    fs.writeFileSync(path.join(dir,'j.json'),JSON.stringify(journal));
    const j=T.lireJournal(path.join(dir,'j.json'));
    assert.deepEqual(j.ordre,[10,11,12]);assert.deepEqual(j.b1[11],{reel:'deferred',hypothese:'window',gardes:2});
    const profil=(la,ve)=>({repere:'profil',longitudinalMm:0,lateralMm:la,verticalMm:ve});
    const jointure={table:[
      {cut:10,classe:'differee',ecartHumain:{gauche:profil(-100,5),droite:profil(-40,6)}},
      {cut:11,classe:'posee',base:'ariane',arianeDeplacement:{gauche:profil(-20,1),droite:profil(30,2)},ecartHumain:{gauche:profil(2,0),droite:profil(-1,3)}},
      {cut:12,classe:'posee',base:null,ecartHumain:null}]};
    fs.writeFileSync(path.join(dir,'t.json'),JSON.stringify(jointure));
    const ref=T.lireReference(path.join(dir,'t.json'));
    assert.deepEqual(ref.get(10).mic,{left:[0,-100,5],right:[0,-40,6]});assert.equal(ref.get(10).ariane,null);
    assert.deepEqual(ref.get(11).mic,{left:[0,-18,1],right:[0,29,5]},'pose de l\'opérateur = déplacement d\'Ariane + correction');
    assert.deepEqual(ref.get(11).ariane,{left:[0,-20,1],right:[0,30,2]});
    assert.equal(ref.get(12).mic,null);
    /* corpus : seules les captures aux deux rails sont gardées, allégées */
    const seg={clouds:[{cut:10,captureId:'a',identity:{part:1,cut:10},rails:ctx.captures.get(1).rails,pointsSceneRelative:[[0,0,0]],visibleByClipBoxes:[true],nodes:[1,2,3],
      camera:ctx.captures.get(1).camera,viewCaptures:[{captureId:'x',camera:ctx.captures.get(1).camera,quality:{}}]},{cut:11,rails:{left:{}}}]};
    fs.writeFileSync(path.join(dir,'c.json'),JSON.stringify(seg));
    const caps=T.chargerCaptures([path.join(dir,'c.json')]);
    assert.deepEqual([...caps.keys()],[10]);assert.equal(caps.get(10).nodes,undefined);assert.equal(caps.get(10).viewCaptures.length,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
