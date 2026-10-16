'use strict';
/* Outil tools/faux-verts.cjs (chantier « faux verts », fiches/FAUX_VERTS.md) : extraction des signaux du moment de la décision, diagnostic
 * des faux verts, typologie, étude. Fixtures SYNTHÉTIQUES : la capture versionnée de tests/corpus (partie 99, cuts inventés), un journal
 * et un jeu fabriqués ici. Aucune donnée de terrain. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../tools/faux-verts.cjs');
const Shadow=require('../src/gcv1-shadow.js'),L=require('../src/lot-decision.js'),C=require('../vendor/capture-core.js'),FV=require('../src/faux-vert-ombre.js');
const pilote=require('./corpus/pilot-part18-cut6704-partial-flank.json');
const SIDES=['left','right'],FR={left:'gauche',right:'droite'};

/* Un petit lot synthétique : deux cuts posés (104 puis 105), même nuage, premier passage. */
function lot(correction105={gauche:[0,1],droite:[1,12]}){
  const captures=new Map(),events=[],jeu=[{type:'entete',format:'ariane-jeu-apprentissage-v1'}];
  let t=0;const ts=()=>new Date(Date.UTC(2026,9,1,0,0,t++)).toISOString();
  for(const cut of [104,105]){
    const identity={pageId:'p',part:99,cut,shape:'U50',frameId:'f',projectId:null};
    const cap={identity,rails:pilote.rails,pointsSceneRelative:pilote.pointsSceneRelative,visibleByClipBoxes:pilote.visibleByClipBoxes};
    captures.set(cut,cap);
    const sci=Shadow.scientificProposeBoth(cap),runtime=Shadow.toRuntimeRails(sci),d=L.decideCut({capture:cap,science:sci,anchors:[],Shadow});
    events.push({type:'proposed',timestamp:ts(),identity,proposal:{rails:runtime}});
    events.push({type:'gcv1-shadow-observed',timestamp:ts(),identity,shadow:{rails:sci.rails,pairGauge:sci.pairGauge}});
    events.push({type:'b1-ombre',timestamp:ts(),identity:{part:99,cut},reel:{stage:d.stage,anchorsUsed:[],guardMm:null}});
    events.push({type:'validation-accepted',timestamp:ts(),identity});
    const dep={};for(const s of SIDES){const M=cap.rails[s].sceneRelativeToProfileLocal,a=C.point(M,d.positions[s]),o=C.point(M,cap.rails[s].positionSceneRelative);
      dep[FR[s]]={longitudinalMm:0,lateralMm:(a[1]-o[1])*1000,verticalMm:(a[2]-o[2])*1000,dist3dMm:0,repere:'profil'};}
    const corr=cut===105?correction105:{gauche:[0,0],droite:[0,0]};
    const correctionMm={};let max=0;
    for(const [k,[la,ve]] of Object.entries(corr)){const d3=Math.hypot(la,ve);max=Math.max(max,d3);correctionMm[k]={longitudinalMm:0,lateralMm:la,verticalMm:ve,dist3dMm:d3,repere:'profil'};}
    jeu.push({type:'cut',partie:99,cut,classe:'posee',traits:{deplacementAriane:dep,s6:{flushPct:0}},zone:null,
      etiquette:{referenceHumaine:'observee',correctionMm,corrige5mm:max>5,corrige10mm:max>10,fauxVert:max>10}});
  }
  /* Un différé à trois cuts : le cut 105 est dans la zone de contrôle de l'opérateur, le 104 aussi. */
  events.push({type:'defer-finalized',timestamp:ts(),identity:{part:99,cut:108}});
  return {captures,journal:{events},jeu};
}
const designation={projet:1,partie:99};
const memo=new Map();
const extrait=(corr)=>{const k=JSON.stringify(corr||null);if(!memo.has(k)){const l=lot(corr);memo.set(k,T.extraire({designation,jeu:l.jeu,journal:l.journal,captures:l.captures}));}return memo.get(k);};

test('extraire : un cas par cut posé, signaux du moment de la décision, ombre identique à celle de l\'extension',()=>{
  const r=extrait();
  assert.equal(r.cas.length,2);assert.equal(r.entete.differesAuJournal,1);
  const c=r.cas.find(x=>x.cut===105),sci=Shadow.scientificProposeBoth({identity:{},rails:pilote.rails,pointsSceneRelative:pilote.pointsSceneRelative,visibleByClipBoxes:pilote.visibleByClipBoxes});
  assert.equal(c.format,T.FORMAT_CAS);assert.deepEqual(c.partie,designation);
  assert.equal(c.signaux.calageVerticalMm,Math.max(...SIDES.map(s=>Math.abs(sci.rails[s].conventionCalibration.dzMm))));
  assert.equal(c.signaux.calageRefuse,1,'le rail droit du fixture est refusé');
  assert.ok(Number.isFinite(c.signaux.epaisseurDessusMm)&&Number.isFinite(c.signaux.voisinsLateralMm),'bande du dessus et voie des posés précédents');
  assert.equal(r.cas.find(x=>x.cut===104).signaux.voisinsLateralMm,null,'aucun posé avant le premier cut du lot');
  assert.equal(c.ombre.verdict,'valider','8,3 mm de calage : sous le seuil figé de 11 mm');
  const d=L.decideCut({capture:{identity:{part:99,cut:105,frameId:'f'},rails:pilote.rails,pointsSceneRelative:pilote.pointsSceneRelative,visibleByClipBoxes:pilote.visibleByClipBoxes},science:sci,anchors:[],Shadow});
  const ombre=FV.evaluer({capture:{rails:pilote.rails,pointsSceneRelative:pilote.pointsSceneRelative,visibleByClipBoxes:pilote.visibleByClipBoxes},science:sci,decision:d});
  assert.deepEqual(c.ombre.rails,ombre.rails,'mêmes signaux que l\'ombre consignée par la décision');
  assert.equal(c.controle.distDiffere,3);assert.equal(c.controle.sousControle,true);
});

test('frontière anti-fuite : changer la référence humaine ne change ni les signaux ni l\'ombre',()=>{
  const a=extrait(),b=extrait({gauche:[30,-20],droite:[-25,40]});
  for(const cut of [104,105]){const x=a.cas.find(c=>c.cut===cut),y=b.cas.find(c=>c.cut===cut);
    assert.deepEqual(x.signaux,y.signaux,'signaux du cut '+cut);assert.deepEqual(x.ombre,y.ombre,'ombre du cut '+cut);}
  assert.notDeepEqual(a.cas.find(c=>c.cut===105).jugement,undefined);
});

test('diagnostic des seuls faux verts, et aucune coordonnée absolue dans la sortie',()=>{
  const r=extrait();
  const fv=r.cas.filter(c=>c.jugement.fauxVert);assert.deepEqual(fv.map(c=>c.cut),[105]);
  assert.ok(fv[0].diagnostic&&!r.cas.find(c=>c.cut===104).diagnostic);
  const rel=fv[0].diagnostic.rails.right.relecture;assert.ok(rel&&rel.choisi&&rel.procheOperateur&&rel.bandeOperateur,'grille relue autour de la pose de l\'opérateur');
  const txt=JSON.stringify(r);
  for(const v of pilote.rails.left.positionSceneRelative)assert.ok(!txt.includes(String(Math.round(v*1000)/1000).slice(0,7)),'coordonnée absolue');
});

test('typologie : un rail refusé que l\'opérateur remonte d\'environ le décalage mesuré est une convention verticale vérifiée',()=>{
  const c=extrait().cas.find(x=>x.cut===105),k=T.classer(c);
  assert.equal(k.cause,'convention verticale');assert.equal(k.rail,'right');assert.equal(k.verifie,true);assert.match(k.sousCause,/refusé/);
  /* Même cut, l'opérateur DESCEND le rail : la correction ne s'explique plus par le calage, la cause est seulement supposée. */
  const d=T.classer(extrait({gauche:[0,1],droite:[1,-12]}).cas.find(x=>x.cut===105));
  assert.equal(d.cause,'convention verticale');assert.equal(d.verifie,false);
  /* Correction latérale de plus de 50 mm : voie décalée. */
  assert.equal(T.classer(extrait({gauche:[60,0],droite:[62,1]}).cas.find(x=>x.cut===105)).cause,'voie décalée');
  /* Ornière d'un passage à niveau : autre. */
  assert.equal(T.classer({...c,etage:'crossing'}).cause,'autre');
  assert.deepEqual([...T.CAUSES],['mauvais minimum','flanc partiel','convention verticale','extraction validée en place','voie décalée','nuage pauvre','autre']);
});

/* Cas synthétiques pour l'étude : quatre parties, un signal qui sépare sur trois et pas sur la quatrième. */
function partieSynthetique(n,separe){
  const out=[];
  for(let i=0;i<40;i++){const fv=i<6;
    out.push({format:T.FORMAT_CAS,partie:{projet:1,partie:n},cut:i*10,etage:'first-pass',controle:{sousControle:i%2===0,distDiffere:null},
      signaux:{calageVerticalMm:separe?(fv?12+i:i%9):i%13,epaisseurDessusMm:fv?16:8},
      ombre:{verdict:separe&&fv&&i<3?'differer':(i===39?'differer':'valider'),rails:{left:{dzMm:separe&&fv?12:2,epaisseurDessusMm:fv?16:8},right:{dzMm:0,epaisseurDessusMm:8}}},
      jugement:{avecReference:i!==38,fauxVert:fv,corrige5mm:fv||i<10},
      diagnostic:fv?{rails:{left:{correctionMm:[0,12,12],poseArianeMm:[0,0.5],calage:{applique:true,raison:null,dzMm:4,bruteMm:[0,-3.5]},flancMoteur:8,relecture:null},right:null},ricochet:false}:undefined});}
  return out;
}
test('étude : AUC, validation croisée par partie (jamais la partie jugée dans l\'apprentissage), bilan de la règle',()=>{
  assert.equal(T.auc([3,4,5],[0,1,2]),1);assert.equal(T.auc([0,1,2],[3,4,5]),0);assert.equal(T.auc([1,1,1],[1,1,1]),.5);assert.equal(T.auc([1,2],[0,0,0]),null,'trop peu de cas');
  const parties={'1:1':partieSynthetique(1,true),'1:2':partieSynthetique(2,true),'1:3':partieSynthetique(3,true),'1:4':partieSynthetique(4,false)};
  const cv=T.cvSignal(parties,'calageVerticalMm',1,.05);
  assert.equal(cv.length,4);
  const p4=cv.find(r=>r.partie==='1:4');assert.equal(p4.fauxVerts,6);assert.ok(p4.seuil>=12,'seuil appris sur les parties 1 à 3 seulement');
  assert.equal(p4.evites,0,'le signal ne sépare pas la partie 4 : jugé sur elle, il ne trouve rien');
  const b=T.bilanRegle(parties,c=>c.ombre.verdict==='differer');
  assert.equal(b['1:1'].evites,3);assert.equal(b['1:1'].bonsDifferes,1);assert.equal(b['1:1'].net,2);assert.equal(b['1:4'].evites,0);
  assert.equal(b['1:1'].differesSansReference,0);assert.equal(b['1:1'].fauxVertsHorsControle,3);
  const e=T.etudier(Object.values(parties));
  assert.equal(e.format,T.FORMAT_ETUDE);assert.deepEqual(e.parties,['1:1','1:2','1:3','1:4']);
  assert.equal(e.typologie['1:1'].total,6);assert.ok(e.regle.validationCroisee.every(r=>r.juge.fauxVerts===6));
  const s=e.signaux.find(x=>x.signal==='calageVerticalMm');assert.equal(s.parPartie['1:1'],1);
  const txt=T.texte(e);for(const titre of ['Typologie','Signaux','Validation croisée','Règle de l\'ombre'])assert.match(txt,new RegExp(titre));
});

test('manifeste des parties : une partie réservée est refusée',()=>{
  assert.throws(()=>T.main(['extraire','--partie','1:99','--jeu','x','--journal','y','--corpus','z']),/réservée/);
});

test('preuve sur un lot : décisions et commandes identiques avec et sans l\'ombre ; ouverte, l\'activation ne fait que différer',()=>{
  const l=lot();
  const r=T.preuve({jeu:l.jeu,journal:l.journal,captures:l.captures});
  assert.equal(r.cuts,2);assert.equal(r.decisionsIdentiques,2);assert.equal(r.commandesIdentiques,2);assert.equal(r.consignes,2);
  assert.equal(r.activationOuverte.posesAjoutees,0);assert.equal(r.activationOuverte.autres,0);assert.equal(r.sansEffet,true);
  assert.equal(globalThis.BananeSettings,undefined,'le réglage global est rendu tel qu\'il était');
});

test('levier vertical (mesure) : une correction qui suit l\'épaisseur du dessus, apprise ailleurs, est retrouvée sur la partie jugée',()=>{
  /* Quatre parties où l'opérateur descend le rail de (épaisseur − 8) mm sur les rails calés : les faux verts sont les rails épais. */
  const partie=n=>Array.from({length:30},(_,i)=>{const ep=6+i*0.5,v=-(ep-8);
    return {partie:{projet:1,partie:n},cut:i,ombre:{rails:{left:{calage:'applique',epaisseurDessusMm:ep},right:{calage:'top-under-observed',epaisseurDessusMm:6}}},
      jugement:{avecReference:true,fauxVert:Math.abs(v)>10,corrige5mm:Math.abs(v)>5,correctionMm:{left:[0,v,Math.abs(v)],right:[0,0,0]}}};});
  const r=T.cvLevier({'1:1':partie(1),'1:2':partie(2),'1:3':partie(3),'1:4':partie(4)});
  const p=r['1:4'];assert.ok(p.fauxVertsAvant>0);assert.equal(p.fauxVertsApres,0);assert.equal(p.nouveaux,0);
  assert.ok(Math.abs(p.modele.applique.b+1)<1e-9&&Math.abs(p.modele.applique.a-8)<1e-9,'pente −1, ordonnée +8');
});
