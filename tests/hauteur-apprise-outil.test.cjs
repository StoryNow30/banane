'use strict';
/* Outil tools/hauteur-apprise.cjs (chantier « hauteur apprise », fiches/HAUTEUR_APPRISE.md) : extraction des signaux du moment de
 * la décision (par le module de l'extension), étude des modèles de correction verticale en validation croisée par partie, preuve
 * « ombre sans effet » sur un lot. Fixtures SYNTHÉTIQUES : la capture versionnée de tests/corpus (partie 99, cuts inventés), un
 * journal et un jeu fabriqués ici, des cas d'étude inventés. Aucune donnée de terrain. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../tools/hauteur-apprise.cjs');
const Shadow=require('../src/gcv1-shadow.js'),L=require('../src/lot-decision.js'),C=require('../vendor/capture-core.js'),HA=require('../src/hauteur-apprise.js');
const pilote=require('./corpus/pilot-part18-cut6704-partial-flank.json');
const SIDES=['left','right'],FR={left:'gauche',right:'droite'};

/* Un petit lot synthétique : deux cuts posés (104 puis 105), même nuage, premier passage. */
function lot(correction105={gauche:[0,1],droite:[1,12]}){
  const captures=new Map(),events=[],jeu=[{type:'entete',format:'ariane-jeu-apprentissage-v1',source:{version:'9.9.9'}}];
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
    jeu.push({type:'cut',partie:99,cut,classe:'posee',traits:{deplacementAriane:dep},zone:null,
      etiquette:{referenceHumaine:'observee',correctionMm,corrige5mm:max>5,corrige10mm:max>10,fauxVert:max>10}});
  }
  return {captures,journal:{events},jeu};
}
const designation={projet:1,partie:99};
const memo=new Map();
const extrait=(corr)=>{const k=JSON.stringify(corr||null);if(!memo.has(k)){const l=lot(corr);memo.set(k,T.extraire({designation,jeu:l.jeu,journal:l.journal,captures:l.captures}));}return memo.get(k);};

test('extraire : un cas par cut posé, signaux et correction du module de l\'extension, référence à part',()=>{
  const r=extrait();
  assert.equal(r.cas.length,2);assert.equal(r.entete.version,'9.9.9');
  const c=r.cas.find(x=>x.cut===105);
  assert.equal(c.format,T.FORMAT_CAS);assert.deepEqual(c.partie,designation);assert.equal(c.etage,'first-pass');
  const cap={identity:{part:99,cut:105,frameId:'f'},rails:pilote.rails,pointsSceneRelative:pilote.pointsSceneRelative,visibleByClipBoxes:pilote.visibleByClipBoxes};
  const sci=Shadow.scientificProposeBoth(cap),d=L.decideCut({capture:cap,science:sci,anchors:[],Shadow});
  const sig=HA.signaux({capture:cap,science:sci,decision:d});
  assert.deepEqual(c.signaux,sig.rails,'mêmes signaux que l\'ombre consignée par la décision');
  const ev=HA.evaluer({capture:cap,science:sci,decision:d});
  for(const s of SIDES)assert.equal(c.ombre[s].correctionMm,ev.rails[s].correctionMm,s);
  assert.deepEqual(c.jugement.correctionMm.right,[1,12,Math.round(Math.hypot(1,12)*100)/100]);assert.equal(c.jugement.fauxVert,true);
});

test('frontière anti-fuite : changer la référence humaine ne change ni les signaux ni l\'ombre, et aucune coordonnée absolue ne sort',()=>{
  const a=extrait(),b=extrait({gauche:[30,-20],droite:[-25,40]});
  for(const cut of [104,105]){const x=a.cas.find(c=>c.cut===cut),y=b.cas.find(c=>c.cut===cut);
    assert.deepEqual(x.signaux,y.signaux,'signaux du cut '+cut);assert.deepEqual(x.ombre,y.ombre,'ombre du cut '+cut);}
  const txt=JSON.stringify(a);
  for(const v of pilote.rails.left.positionSceneRelative)assert.ok(!txt.includes(String(Math.round(v*1000)/1000).slice(0,7)),'coordonnée absolue');
});

/* Cas d'étude synthétiques : l'opérateur descend les rails calés de 0,5 × (épaisseur − 6) mm, remonte les rails refusés de 4 mm. */
function cas(partie,i,{groupe,ep,v,l=0,etage='first-pass',n=40}){
  const d3=Math.hypot(l,v);
  return {format:T.FORMAT_CAS,partie,cut:i,etage,
    signaux:{left:{groupe,calage:groupe==='applique'?'applique':groupe==='refuse'?'shift-out-of-domain':null,dzMm:0,duMm:0,epaisseurDessusMm:ep,pointsDessus:n,pointsFlanc:10},
      right:{groupe:'applique',calage:'applique',dzMm:0,duMm:0,epaisseurDessusMm:6,pointsDessus:40,pointsFlanc:10}},
    ombre:null,jugement:{avecReference:true,fauxVert:d3>10,correctionMm:{left:[l,v,d3],right:[0,0,0]}}};
}
function partieSynthetique(n){
  const p={projet:1,partie:n},out=[];
  for(let i=0;i<30;i++){const ep=6+i*0.6;out.push(cas(p,i,{groupe:'applique',ep,v:-0.5*(ep-6),l:2}));}
  for(let i=0;i<12;i++)out.push(cas(p,100+i,{groupe:'refuse',ep:9+i*0.1,v:4,l:i<6?9.5:2}));
  return out;
}
test('étude : le modèle linéaire par groupe est retrouvé, appris sans la partie jugée, et le bilan compte les faux verts, corrigés et nouveaux',()=>{
  const listes=[1,2,3,4].map(partieSynthetique);
  const rails=T.railsEtude(listes.flat());
  const m=T.FAMILLES.lineaire(rails);
  assert.ok(Math.abs(m.applique.b+0.5)<1e-9&&Math.abs(m.applique.a-3)<1e-9,'pente −0,5, ordonnée +3');
  assert.ok(Math.abs(m.refuse.a-4)<1e-9&&Math.abs(m.refuse.b)<1e-9,'rails refusés : +4 constant');
  /* Bilan : un rail refusé corrigé latéralement de 9,5 et verticalement de 4 (10,3 mm) passe sous 10 mm s'il est remonté de 4 mm. */
  const env={partApplique:1,partRefuse:1,plafondMm:5};
  const b=T.bilan(listes[0],T.correcteur(m,env),{bruitMm:2});
  assert.equal(b.fauxVertsAvant,6);assert.equal(b.fauxVertsApres,0);assert.equal(b.corriges,6);assert.equal(b.nouveaux,0);
  assert.ok(b.medianeVerticaleApresMm<b.medianeVerticaleAvantMm);
  /* Une correction de signe faux crée des faux verts : ils sont comptés comme nouveaux. */
  const faux=T.bilan(listes[0],T.correcteur({...m,applique:{a:12,b:0}},env),{bruitMm:2});
  assert.ok(faux.nouveaux>0);
  /* Validation croisée : la partie jugée n'entre jamais dans l'apprentissage. */
  const autre=partieSynthetique(4).map(c=>({...c,jugement:{...c.jugement,correctionMm:{...c.jugement.correctionMm,left:[c.jugement.correctionMm.left[0],-30,30]}}}));
  const parParties=T.parParties([...listes.slice(0,3).flat(),...autre]);
  const cv=T.validationCroisee(parParties,'lineaire',{penalite:10});
  const p4=cv.parPartie.find(x=>x.partie==='1:4');
  const attendu=T.FAMILLES.lineaire(T.railsEtude(listes.slice(0,3).flat()));
  assert.deepEqual(p4.modele,attendu,'le modèle jugé sur 1:4 est appris sur 1:1 à 1:3 seulement');
  assert.ok(cv.parPartie.every(x=>x.enveloppe&&Number.isFinite(x.bilan.fauxVertsApres)));
});

test('étude complète : familles, enveloppe choisie sur l\'apprentissage, modèle retenu au format du module, texte',()=>{
  const e=T.etudier([1,2,3,4].map(partieSynthetique));
  assert.equal(e.format,T.FORMAT_ETUDE);assert.deepEqual(e.parties,['1:1','1:2','1:3','1:4']);
  for(const f of ['aucun','p8','p8Appris','lineaire','morceaux'])assert.ok(e.familles[f]&&e.familles[f].imbriquee&&e.familles[f].enveloppeFixe,f);
  const r=e.retenu;assert.equal(r.famille,'lineaire');
  for(const g of ['applique','refuse'])assert.ok(Number.isFinite(r.modele[g].a)&&Number.isFinite(r.modele[g].b)&&Number.isFinite(r.modele[g].part),g);
  assert.ok(Number.isFinite(r.modele.plafondMm));
  assert.equal(e.familles.aucun.imbriquee.cumul.nouveaux,0);
  const txt=T.texte(e);for(const titre of ['Validation croisée','Modèle retenu','P8'])assert.match(txt,new RegExp(titre));
});

test('manifeste des parties : une partie réservée est refusée',()=>{
  assert.throws(()=>T.main(['extraire','--partie','1:99','--jeu','x','--journal','y','--corpus','z']),/réservée/);
});

test('preuve sur un lot : décisions et commandes identiques avec et sans l\'ombre ; ouverte, l\'activation ne change que la hauteur',()=>{
  const l=lot();
  const r=T.preuve({jeu:l.jeu,journal:l.journal,captures:l.captures});
  assert.equal(r.cuts,2);assert.equal(r.decisionsIdentiques,2);assert.equal(r.commandesIdentiques,2);assert.equal(r.consignes,2);
  assert.equal(r.activationOuverte.posesAjoutees,0);assert.equal(r.activationOuverte.autres,0);assert.equal(r.sansEffet,true);
  assert.equal(r.activationOuverte.hauteurSeulement+r.activationOuverte.commandesInchangees,2);
  assert.equal(globalThis.BananeSettings,undefined,'le réglage global est rendu tel qu\'il était');
});
