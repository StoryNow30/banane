'use strict';
/* 4.9.5.4 (P8, D-140) — CORRECTION VERTICALE APPRISE, EN OMBRE SUR LES RAILS À CONVENTION REFUSÉE. SEULEMENT CONSIGNÉE, JAMAIS APPLIQUÉE.
 *
 * D-140 : sur les rails dont le calage de convention est refusé (décalage hors des 8 mm), Mic remonte la pose dans les trois parties relues
 * (+6,1 ; +1,8 ; +3,6 mm). La correction apprise ailleurs n'atteint pas la porte (« 0 mauvaise pose ajoutée ») : elle va en OMBRE.
 * Réglage `ombreVerticaleRefusee` de src/settings.js, actif par défaut (3,6 mm) mais pour consigner seulement : la décision porte, à côté de la pose
 * réelle, celle qu'aurait donnée la correction. RIEN ne la lit : la pose, la validation et la navigation sont identiques, octet pour octet, avec et
 * sans le réglage. Données synthétiques (captures versionnées de tests/corpus, fixtures de tests). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const L=require('../src/lot-decision.js'),O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js'),Settings=require('../src/settings.js'),C=require('../vendor/capture-core.js');
const {K,base}=require('./fixtures.cjs');
const pilote=require('./corpus/pilot-part18-cut6704-partial-flank.json');
const SIDES=['left','right'];

/* Réglage posé comme le service worker le voit (global `BananeSettings`), puis retiré. */
function avecReglage(valeur,fn){
 const avant=Object.getOwnPropertyDescriptor(globalThis,'BananeSettings');
 /* Les autres ombres de la décision (faux vert en ombre, hauteur apprise) sont tenues à l'écart : cet essai ne juge que P8. */
 globalThis.BananeSettings=valeur===undefined?{...Settings,ombreVerticaleRefusee:undefined,fauxVertOmbre:undefined,hauteurApprise:undefined}:{...Settings,ombreVerticaleRefusee:valeur,fauxVertOmbre:undefined,hauteurApprise:undefined};
 try{return fn();}finally{if(avant)Object.defineProperty(globalThis,'BananeSettings',avant);else delete globalThis.BananeSettings;}
}
const sans=d=>{const {ombreVerticale,...reste}=d;return reste;};

/* Cas 1 : premier passage, un rail refusé (le droit), un rail calé (le gauche). */
const identity={pageId:'page-synthetique',part:99,cut:105,shape:'U50',frameId:'cadre-synthetique',projectId:null};
const capPilote={identity,rails:pilote.rails,pointsSceneRelative:pilote.pointsSceneRelative,visibleByClipBoxes:pilote.visibleByClipBoxes};
const sciPilote=Shadow.scientificProposeBoth(capPilote);
const premierPassage=()=>L.decideCut({capture:capPilote,science:sciPilote,anchors:[],Shadow});

/* Cas 2 : reprise depuis la voie (stade « window »), rail droit refusé par le moteur. */
const capture=(rails,cut=105)=>({identity:{part:23,cut,frameId:'f'},rails,pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)});
const science0=Shadow.scientificProposeBoth(capture(base.rails));
const truth=Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,d=science0.rails[side].next.delta;
 const w=K.C.point(P,d),o=K.C.point(P,[0,0,0]);return [side,O.translated(r,w.map((v,i)=>v-o[i]))];}));
const shifted=(rails,mm)=>Object.fromEntries(SIDES.map(side=>{const r=rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
 const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));
const anchorAt=(cut,rails)=>({identity:{part:23,cut,frameId:'f'},positions:Object.fromEntries(SIDES.map(s=>[s,rails[s].positionSceneRelative]))});
const railsReprise=shifted(truth,150),capReprise=capture(railsReprise),sciReprise=Shadow.scientificProposeBoth(capReprise),ancres=[anchorAt(104,shifted(truth,12)),anchorAt(103,shifted(truth,12))];
/* La reprise relance le moteur (environ 1 s) : une décision par réglage, gardée (jamais modifiée par les essais). */
const memoReprise=new Map();
const reprise=()=>{const cle=JSON.stringify(globalThis.BananeSettings?.ombreVerticaleRefusee??null);
 if(!memoReprise.has(cle))memoReprise.set(cle,L.decideCut({capture:capReprise,science:sciReprise,anchors:ancres,Shadow}));return memoReprise.get(cle);};

/* Cas 3 : tous les rails calés (aucun refus) : premier passage de la capture de base. */
const capBase=capture(truth),sciBase=Shadow.scientificProposeBoth(capBase);
const sansRefus=()=>L.decideCut({capture:capBase,science:sciBase,anchors:[],Shadow});

/* Déplacement vertical du repère profil d'un rail, en repère scène (ce que « +mm vers le haut » veut dire pour ce rail). */
const versLeHaut=(rail,mm)=>{const P=rail.profileLocalToSceneRelative,a=C.point(P,[0,0,0]),b=C.point(P,[0,0,mm/1000]);return b.map((v,i)=>v-a[i]);};
const proche=(a,b,tol=2e-6)=>a.every((v,i)=>Math.abs(v-b[i])<=tol);

test('le réglage existe, il est actif par défaut avec 3,6 mm, et le panneau dit qu\'il ne fait que consigner',()=>{
 assert.deepEqual({...Settings.ombreVerticaleRefusee},{actif:true,mm:3.6});
 assert.ok(Object.isFrozen(Settings.ombreVerticaleRefusee));
 const ligne=Settings.describe().find(l=>/Correction verticale en ombre/.test(l.nom));
 assert.ok(ligne,'une ligne dans la liste des réglages');assert.match(ligne.valeur,/3,6/);assert.match(ligne.valeur,/consign/i);assert.match(ligne.pourquoi,/jamais appliquée/i);
 assert.equal(Settings.conventionPlafond,false,'le plafond de convention reste coupé');
});

test('premier passage, un rail refusé : la décision consigne la pose réelle ET celle d\'une correction verticale de +3,6 mm, pour ce rail seul',()=>{
 const d=avecReglage({actif:true,mm:3.6},premierPassage);
 assert.equal(d.stage,'first-pass');
 assert.equal(sciPilote.rails.right.conventionCalibration.applied,false,'le rail droit est refusé');assert.equal(sciPilote.rails.left.conventionCalibration.applied,true);
 const o=d.ombreVerticale;assert.ok(o,'ombreVerticale présente');
 assert.equal(o.mm,3.6);assert.deepEqual(Object.keys(o.rails),['right'],'le rail calé n\'est pas concerné');
 const r=o.rails.right;
 assert.ok(proche(r.reelle,d.positions.right),'la pose réelle consignée est celle de la décision');
 assert.ok(proche(r.ombre.map((v,i)=>v-r.reelle[i]),versLeHaut(pilote.rails.right,3.6)),'l\'ombre est la pose réelle remontée de 3,6 mm dans le repère profil du rail');
 assert.equal(r.refus.reason,'shift-out-of-domain');assert.ok(Number.isFinite(r.refus.dzMm)&&Number.isFinite(r.refus.duMm),'le décalage mesuré par la convention est consigné');
});

test('reprise depuis la voie : même consigne, sur le rail refusé',()=>{
 const d=avecReglage({actif:true,mm:3.6},reprise);
 assert.equal(d.stage,'window');assert.equal(sciReprise.rails.right.conventionCalibration.applied,false);
 assert.deepEqual(Object.keys(d.ombreVerticale.rails),['right']);
 assert.ok(proche(d.ombreVerticale.rails.right.reelle,d.positions.right));
});

test('aucun rail refusé, ou cut différé sans pose : rien n\'est consigné',()=>{
 const d=avecReglage({actif:true,mm:3.6},sansRefus);
 assert.ok(SIDES.every(s=>sciBase.rails[s].conventionCalibration.applied===true));
 assert.ok(!('ombreVerticale' in d));
 const differe=avecReglage({actif:true,mm:3.6},()=>L.decideCut({capture:capReprise,science:sciReprise,anchors:[],Shadow}));
 assert.equal(differe.stage,'deferred');assert.ok(!('ombreVerticale' in differe));
});

test('la valeur vient du réglage (3,6 par défaut), et le réglage coupé ou absent ne laisse aucune trace',()=>{
 const cinq=avecReglage({actif:true,mm:5},premierPassage).ombreVerticale;assert.equal(cinq.mm,5);
 const r=cinq.rails.right;assert.ok(proche(r.ombre.map((v,i)=>v-r.reelle[i]),versLeHaut(pilote.rails.right,5)));
 for(const [nom,reglage] of [['actif:false',{actif:false,mm:3.6}],['absent',undefined],['sans valeur',{actif:true}],['valeur non finie',{actif:true,mm:NaN}],['valeur nulle',{actif:true,mm:0}]])
  assert.ok(!('ombreVerticale' in avecReglage(reglage,premierPassage)),nom);
 /* Hors service worker (outils hors ligne) : pas de global, pas de consigne, comme la base 5.0. */
 assert.equal(globalThis.BananeSettings,undefined);assert.ok(!('ombreVerticale' in premierPassage()));
 /* L'option explicite de l'appelant l'emporte sur le global (rejeu hors ligne). */
 const opt=L.decideCut({capture:capPilote,science:sciPilote,anchors:[],Shadow,options:{ombreVerticale:{actif:true,mm:2}}});assert.equal(opt.ombreVerticale.mm,2);
 assert.ok(!('ombreVerticale' in avecReglage({actif:true,mm:3.6},()=>L.decideCut({capture:capPilote,science:sciPilote,anchors:[],Shadow,options:{ombreVerticale:{actif:false}}}))));
});

test('LA POSE NE CHANGE PAS : décisions identiques, octet pour octet, avec et sans le réglage, à toute valeur ; les commandes aussi',()=>{
 /* La reprise relance le moteur (environ 1 s) : un seul réglage actif pour la reprise ; le premier passage en essaie quatre. */
 const REGLAGES={'premier passage':[{actif:true,mm:3.6},{actif:true,mm:25},{actif:false,mm:3.6},undefined],'reprise':[{actif:true,mm:3.6}],'sans refus':[{actif:true,mm:3.6},undefined]};
 const decisions={};
 for(const [nom,cas] of [['premier passage',premierPassage],['reprise',reprise],['sans refus',sansRefus]]){
  const sansReglage=JSON.stringify(cas());
  for(const reglage of REGLAGES[nom]){
   const d=avecReglage(reglage,cas);
   assert.equal(JSON.stringify(sans(d)),sansReglage,`${nom} : tout sauf la consigne est identique (${JSON.stringify(reglage)})`);
   assert.equal(JSON.stringify(d.positions),JSON.stringify(JSON.parse(sansReglage).positions),`${nom} : positions identiques`);
   if(nom==='reprise'&&reglage.mm===3.6)decisions.reprise=d;
  }
 }
 /* Ce qui est commandé à ESV ne lit jamais la consigne, même fausse ou démesurée. */
 const d=decisions.reprise,dFaux={...d,ombreVerticale:{mm:999,rails:{left:{ombre:[1,2,3],reelle:[1,2,3]},right:{ombre:[9,9,9],reelle:[9,9,9]}}}};
 const before=Object.fromEntries(SIDES.map(s=>[s,capReprise.rails[s]])),runtimeRails=before;
 const expectedPoses=(_a,rails)=>Object.fromEntries(SIDES.map(s=>[s,{positionSceneRelative:C.point(capReprise.rails[s].profileLocalToSceneRelative,rails[s].delta)}]));
 const commande=x=>JSON.stringify(L.commandRails({decision:x,runtimeRails,before,expectedPoses,cameras:{left:null,right:null}}));
 assert.equal(commande(d),commande(sans(d)));assert.equal(commande(dFaux),commande(sans(d)));
});

test('la consigne ne modifie rien de ce qu\'elle lit : capture, science et décision de base restent intactes',()=>{
 const capAvant=JSON.stringify(capPilote),sciAvant=JSON.stringify(sciPilote);
 avecReglage({actif:true,mm:3.6},premierPassage);
 assert.equal(JSON.stringify(capPilote),capAvant);assert.equal(JSON.stringify(sciPilote),sciAvant);
});

test('aucun chemin de pose ne lit la consigne : seule la fonction d\'ombre la nomme dans src/',()=>{
 const racine=path.resolve(__dirname,'..'),lecteurs=[];
 for(const f of [...fs.readdirSync(path.join(racine,'src')).filter(x=>x.endsWith('.js')).map(x=>'src/'+x),'background.js','panel.js']){
  const t=fs.readFileSync(path.join(racine,f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  if(/\bombreVerticale\b/.test(t))lecteurs.push(f);
 }
 assert.deepEqual(lecteurs.sort(),['src/lot-decision.js'],'seul lot-decision.js consigne ; ni le moteur, ni la commande, ni le service worker ne la lisent');
 assert.ok(!/ombreVerticale/.test(fs.readFileSync(path.join(racine,"src/engine.js"),"utf8")));
});
