'use strict';
/* 5.0 (chantier « hauteur apprise ») — HAUTEUR APPRISE, EN OMBRE (src/hauteur-apprise.js, consignée par src/lot-decision.js).
 *
 * 70 des 85 faux verts relus viennent de la hauteur du rail ; l'opérateur garde le minimum d'Ariane et ne corrige que la
 * hauteur. La correction apprise (fiches/HAUTEUR_APPRISE.md) : part × (a + b × épaisseur du dessus), par groupe de rail (calage
 * appliqué, calage refusé), bornée à ± 5 mm, avec abstention. Elle est CONSIGNÉE dans la décision (`hauteurApprise`) : à côté de
 * la pose réelle, la pose corrigée. Son chemin d'activation (poser la pose corrigée) existe mais il est COUPÉ
 * (`appliquer:false`) : la décision, la pose et la commande sont identiques, octet pour octet, avec et sans l'ombre.
 * Données synthétiques (captures versionnées de tests/corpus, fixtures de tests). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const L=require('../src/lot-decision.js'),O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js'),Settings=require('../src/settings.js');
const C=require('../vendor/capture-core.js'),Conv=require('../src/placement-convention.js');
const HA=require('../src/hauteur-apprise.js');
const {K,base}=require('./fixtures.cjs');
const pilote=require('./corpus/pilot-part18-cut6704-partial-flank.json');
const SIDES=['left','right'];

/* Réglage posé comme le service worker le voit (global `BananeSettings`) ; les autres ombres de la décision (P8, faux vert) sont
 * tenues à l'écart : cet essai ne juge que la hauteur apprise. */
function avecReglage(valeur,fn){
 const avant=Object.getOwnPropertyDescriptor(globalThis,'BananeSettings');
 globalThis.BananeSettings={...Settings,ombreVerticaleRefusee:undefined,fauxVertOmbre:undefined,hauteurApprise:valeur};
 try{return fn();}finally{if(avant)Object.defineProperty(globalThis,'BananeSettings',avant);else delete globalThis.BananeSettings;}
}
const sans=d=>{const {hauteurApprise,...reste}=d;return reste;};
const LIVRE=()=>({...Settings.hauteurApprise});
/* Un modèle « fort » pour l'essai : chaque rail posé reçoit une correction non nulle. */
const FORT={actif:true,appliquer:false,applique:{a:4,b:0,part:1},refuse:{a:-3,b:0,part:1}};

/* Cas 1 : premier passage, rail gauche calé, rail droit refusé. */
const identity={pageId:'page-synthetique',part:99,cut:105,shape:'U50',frameId:'cadre-synthetique',projectId:null};
const capPilote={identity,rails:pilote.rails,pointsSceneRelative:pilote.pointsSceneRelative,visibleByClipBoxes:pilote.visibleByClipBoxes};
const sciPilote=Shadow.scientificProposeBoth(capPilote);
const premierPassage=(options)=>L.decideCut({capture:capPilote,science:sciPilote,anchors:[],Shadow,...(options?{options}:{})});

/* Cas 2 : reprise depuis la voie (étage « window »). */
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
const reprise=()=>{const cle=JSON.stringify(globalThis.BananeSettings?.hauteurApprise??null);
 if(!memoReprise.has(cle))memoReprise.set(cle,L.decideCut({capture:capReprise,science:sciReprise,anchors:ancres,Shadow}));return memoReprise.get(cle);};
/* Cas 3 : différé (aucune pose). */
const differe=()=>L.decideCut({capture:capReprise,science:sciReprise,anchors:[],Shadow});

/* Commande : la même chaîne que `commandLot` (background.js). Caméras : celles de la capture, ou une caméra large qui voit tout. */
const before=r=>Object.fromEntries(SIDES.map(s=>[s,r[s]]));
const expectedPoses=rails0=>(_a,rails)=>Object.fromEntries(SIDES.map(s=>[s,{positionSceneRelative:C.point(rails0[s].profileLocalToSceneRelative,rails[s].delta)}]));
const moteur=sci=>Shadow.toRuntimeRails(sci);
const ID=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const camLarge=cap=>{const p=cap.rails.left.positionSceneRelative,s=1/1000;
 const vue=[s,0,0,0,0,s,0,0,0,0,s,0,-p[0]*s,-p[1]*s,-p[2]*s,1];return {projection:ID,sceneRelativeToCamera:vue};};
const camerasLarges=cap=>({left:camLarge(cap),right:camLarge(cap)});
const commande=(d,cap,sci,cameras={left:null,right:null})=>L.commandRails({decision:d,runtimeRails:moteur(sci),before:before(cap.rails),expectedPoses:expectedPoses(cap.rails),cameras});
const versLeHaut=(rail,mm)=>{const P=rail.profileLocalToSceneRelative,a=C.point(P,[0,0,0]),b=C.point(P,[0,0,mm/1000]);return b.map((v,i)=>v-a[i]);};
const proche=(a,b,tol=2e-6)=>a.every((v,i)=>Math.abs(v-b[i])<=tol);

test('le module et le réglage existent : modèle figé, ombre active pour consigner, chemin d\'activation COUPÉ',()=>{
 assert.equal(HA.VERSION,'hauteur-apprise-v1');
 assert.ok(Object.isFrozen(HA.MODELE)&&Object.isFrozen(HA.MODELE.applique)&&Object.isFrozen(HA.MODELE.refuse)&&Object.isFrozen(HA.MODELE.etages));
 assert.deepEqual([...HA.MODELE.etages],['first-pass','window','choice'],'l\'ornière d\'un PN n\'est pas corrigée');
 const s=Settings.hauteurApprise;assert.ok(Object.isFrozen(s));
 assert.equal(s.actif,true);assert.equal(s.appliquer,false,'le chemin d\'activation est coupé dans le réglage livré');
 for(const k of ['plafondMm','pointsDessusMin'])assert.equal(s[k],HA.MODELE[k],k);
 assert.deepEqual({...s.applique},{...HA.MODELE.applique});assert.deepEqual({...s.refuse},{...HA.MODELE.refuse});assert.deepEqual([...s.etages],[...HA.MODELE.etages]);
 const ligne=Settings.describe().find(l=>/Hauteur apprise/.test(l.nom));
 assert.ok(ligne,'une ligne dans la liste des réglages');assert.match(ligne.valeur,/consign/i);assert.match(ligne.pourquoi,/jamais/i);
});

test('correction d\'un rail : part × (a + b × épaisseur), bornée, et abstention quand le signal manque',()=>{
 const m={...HA.MODELE,applique:{a:3,b:-0.5,part:0.5},refuse:{a:18,b:-1,part:1},plafondMm:5};
 const rail=(groupe,ep,n=40)=>({groupe,epaisseurDessusMm:ep,pointsDessus:n});
 assert.deepEqual(HA.correctionRail(rail('applique',14),'first-pass',m),{correctionMm:-2,abstention:null},'0,5 × (3 − 7)');
 assert.deepEqual(HA.correctionRail(rail('applique',6),'first-pass',m),{correctionMm:0,abstention:null},'0,5 × (3 − 3) : rien');
 assert.deepEqual(HA.correctionRail(rail('refuse',10),'window',m),{correctionMm:5,abstention:null,borne:true},'18 − 10 = 8, borné à 5');
 assert.deepEqual(HA.correctionRail(rail('refuse',16),'choice',m),{correctionMm:2,abstention:null});
 assert.deepEqual(HA.correctionRail(rail('refuse',30),'first-pass',m),{correctionMm:-5,abstention:null,borne:true},'la borne vaut dans les deux sens');
 assert.equal(HA.correctionRail(rail('applique',14),'crossing',m).abstention,'etage');
 assert.equal(HA.correctionRail(rail(null,14),'first-pass',m).abstention,'calage');
 assert.equal(HA.correctionRail(rail('applique',14,10),'first-pass',m).abstention,'dessus-peu-observe');
 assert.equal(HA.correctionRail(rail('applique',null),'first-pass',m).abstention,'dessus-peu-observe');
 for(const x of [rail('applique',14,10),rail(null,14)])assert.equal(HA.correctionRail(x,'first-pass',m).correctionMm,0);
 assert.equal(HA.groupe({applied:true}),'applique');assert.equal(HA.groupe({applied:false,reason:'shift-out-of-domain'}),'refuse');
 assert.equal(HA.groupe({applied:false,reason:'top-under-observed'}),null);assert.equal(HA.groupe(null),null);
});

test('les signaux sont ceux du moment de la décision : groupe du calage de la science, bande du dessus à la pose décidée',()=>{
 const d=premierPassage(),s=HA.signaux({capture:capPilote,science:sciPilote,decision:d});
 assert.equal(s.etage,'first-pass');
 assert.equal(s.rails.left.groupe,'applique');assert.equal(s.rails.right.groupe,'refuse');
 for(const side of SIDES){
  const M=capPilote.rails[side].sceneRelativeToProfileLocal,a=C.point(M,d.positions[side]),o=C.point(M,capPilote.rails[side].positionSceneRelative);
  const b=Conv.bandOffsets(capPilote,side,[a[0]-o[0],a[1]-o[1],a[2]-o[2]]);
  assert.equal(s.rails[side].pointsDessus,b.top.length);
  assert.equal(s.rails[side].epaisseurDessusMm,Math.round((Conv.quantile(b.top,.9)-Conv.quantile(b.top,.1))*10)/10,side);
 }
 assert.equal(HA.signaux({capture:capReprise,science:sciReprise,decision:differe()}),null,'rien sans pose');
});

test('la décision consigne la pose réelle ET la pose corrigée, remontée de la correction dans le repère profil du rail',()=>{
 const d=avecReglage(LIVRE(),()=>premierPassage());
 const h=d.hauteurApprise;assert.ok(h,'hauteurApprise présente');assert.equal(h.version,'hauteur-apprise-v1');assert.equal(h.etage,'first-pass');
 for(const side of SIDES){
  const r=h.rails[side],attendu=HA.correctionRail(HA.signaux({capture:capPilote,science:sciPilote,decision:d}).rails[side],'first-pass');
  assert.ok(proche(r.reelle,d.positions[side]),side+' : la pose réelle consignée est celle de la décision');
  assert.equal(r.correctionMm,attendu.correctionMm,side);
  if(r.correctionMm!==0)assert.ok(proche(r.corrigee.map((v,i)=>v-r.reelle[i]),versLeHaut(pilote.rails[side],r.correctionMm)),side+' : pose corrigée');
  else assert.ok(!('corrigee' in r));
 }
 const f=avecReglage(FORT,()=>premierPassage()).hauteurApprise;
 assert.equal(f.rails.left.correctionMm,4);assert.equal(f.rails.right.correctionMm,-3);
 assert.ok(proche(f.rails.right.corrigee.map((v,i)=>v-f.rails.right.reelle[i]),versLeHaut(pilote.rails.right,-3)));
 const dr=avecReglage(FORT,reprise);assert.equal(dr.stage,'window');assert.ok(proche(dr.hauteurApprise.rails.left.reelle,dr.positions.left));
});

test('rien n\'est consigné hors service worker, réglage coupé ou cut différé ; l\'option de l\'appelant l\'emporte',()=>{
 for(const [nom,r] of [['actif:false',{...LIVRE(),actif:false}],['absent',undefined]])assert.ok(!('hauteurApprise' in avecReglage(r,()=>premierPassage())),nom);
 assert.equal(globalThis.BananeSettings,undefined);assert.ok(!('hauteurApprise' in premierPassage()),'outils hors ligne : la base 5.0');
 assert.ok(!('hauteurApprise' in avecReglage(LIVRE(),differe)),'cut différé : rien à consigner');
 assert.equal(premierPassage({hauteurApprise:FORT}).hauteurApprise.rails.left.correctionMm,4);
 assert.ok(!('hauteurApprise' in avecReglage(LIVRE(),()=>premierPassage({hauteurApprise:{actif:false}}))));
});

test('LA DÉCISION NE CHANGE PAS : identique, octet pour octet, avec et sans l\'ombre, à tout réglage ; la commande aussi',()=>{
 const REGLAGES=[LIVRE(),FORT,{...FORT,plafondMm:50},{...LIVRE(),actif:false},undefined,{...FORT,appliquer:false,etages:[]}];
 const ref=avecReglage(undefined,()=>({pp:JSON.stringify(premierPassage()),rp:JSON.stringify(reprise())}));
 for(const r of REGLAGES){
  const d=avecReglage(r,()=>premierPassage());
  assert.equal(JSON.stringify(sans(d)),ref.pp,`premier passage, ${JSON.stringify(r)}`);
  assert.equal(JSON.stringify(d.positions),JSON.stringify(JSON.parse(ref.pp).positions));
 }
 const dr=avecReglage(FORT,reprise);
 assert.equal(dr.stage,'window');assert.equal(JSON.stringify(sans(dr)),ref.rp,'reprise depuis la voie');
 /* La commande ne lit pas l'ombre tant que le chemin est coupé, même une ombre démesurée ou fausse. */
 for(const [d,cap,sci] of [[avecReglage(FORT,()=>premierPassage()),capPilote,sciPilote],[dr,capReprise,sciReprise]]){
  const refC=JSON.stringify(commande(sans(d),cap,sci,camerasLarges(cap)));
  for(const r of [Settings.hauteurApprise,FORT,undefined])
   avecReglage(r,()=>{
    assert.equal(JSON.stringify(commande(d,cap,sci,camerasLarges(cap))),refC);
    assert.equal(JSON.stringify(commande({...d,hauteurApprise:{rails:{left:{correctionMm:999},right:{correctionMm:-999}}}},cap,sci,camerasLarges(cap))),refC);
   });
 }
});

test('chemin d\'activation (essai seulement, coupé à la livraison) : il ne change que la hauteur d\'une commande qui pose',()=>{
 const ouvert={...FORT,appliquer:true};
 for(const [cas,cap,sci] of [[()=>premierPassage(),capPilote,sciPilote],[reprise,capReprise,sciReprise]]){
  const d=avecReglage(FORT,cas),ref=commande(sans(d),cap,sci,camerasLarges(cap));
  const out=avecReglage(ouvert,()=>commande(d,cap,sci,camerasLarges(cap)));
  assert.equal(out.action,ref.action,'même action');assert.ok(['engine','lot'].includes(out.action));
  for(const s of SIDES){
   const mm=d.hauteurApprise.rails[s].correctionMm;
   assert.equal(out.rails[s].status,ref.rails[s].status);
   assert.equal(out.rails[s].delta[0],ref.rails[s].delta[0]);assert.equal(out.rails[s].delta[1],ref.rails[s].delta[1],'latéral inchangé');
   assert.ok(Math.abs(out.rails[s].delta[2]-ref.rails[s].delta[2]-mm/1000)<1e-12,s+' : la hauteur bouge de la correction consignée');
  }
  assert.deepEqual(out.hauteurApprise.correctionMm,Object.fromEntries(SIDES.map(s=>[s,d.hauteurApprise.rails[s].correctionMm])));
  assert.ok(SIDES.some(s=>d.hauteurApprise.rails[s].correctionMm!==0),'le modèle fort corrige au moins un rail');
  /* Sans caméra pour relire la vue, ou cible corrigée hors de la vue : la commande reste telle quelle. */
  assert.equal(JSON.stringify(avecReglage(ouvert,()=>commande(d,cap,sci))),JSON.stringify(commande(sans(d),cap,sci)));
  const etroite={projection:ID,sceneRelativeToCamera:[1,0,0,0,0,1,0,0,0,0,1,0,1e3,1e3,1e3,1]};
  assert.equal(JSON.stringify(avecReglage(ouvert,()=>commande(d,cap,sci,{left:etroite,right:etroite}))),JSON.stringify(commande(sans(d),cap,sci,{left:etroite,right:etroite})));
 }
 /* Un cut différé reste différé, à l'identique : le chemin n'ajoute jamais de pose. */
 const dd=avecReglage(FORT,differe),refD=JSON.stringify(commande(dd,capReprise,sciReprise,camerasLarges(capReprise)));
 assert.equal(JSON.stringify(avecReglage(ouvert,()=>commande({...dd,hauteurApprise:{rails:{left:{correctionMm:4},right:{correctionMm:4}}}},capReprise,sciReprise,camerasLarges(capReprise)))),refD);
 /* Corrections nulles : rien ne change. */
 const d0=avecReglage(FORT,()=>premierPassage()),z={...d0,hauteurApprise:{...d0.hauteurApprise,rails:{left:{correctionMm:0},right:{correctionMm:0}}}};
 assert.equal(JSON.stringify(avecReglage(ouvert,()=>commande(z,capPilote,sciPilote,camerasLarges(capPilote)))),JSON.stringify(commande(sans(d0),capPilote,sciPilote,camerasLarges(capPilote))));
});

test('l\'ombre ne modifie rien de ce qu\'elle lit',()=>{
 const capAvant=JSON.stringify(capPilote),sciAvant=JSON.stringify(sciPilote),d=premierPassage(),dAvant=JSON.stringify(d);
 HA.evaluer({capture:capPilote,science:sciPilote,decision:d,reglage:FORT});avecReglage(FORT,()=>premierPassage());
 assert.equal(JSON.stringify(capPilote),capAvant);assert.equal(JSON.stringify(sciPilote),sciAvant);assert.equal(JSON.stringify(d),dAvant);
});

test('une panne de l\'ombre ne change jamais la décision',()=>{
 const reel=HA.evaluer;
 try{HA.evaluer=()=>{throw Error('panne');};
  const d=avecReglage(FORT,()=>premierPassage());assert.ok(!('hauteurApprise' in d));assert.equal(JSON.stringify(d),JSON.stringify(avecReglage(undefined,()=>premierPassage())));}
 finally{HA.evaluer=reel;}
});

test('seuls le module, la décision sur le lot et le réglage nomment l\'ombre ; le moteur et le service worker ne la lisent pas',()=>{
 const racine=path.resolve(__dirname,'..'),lecteurs=[];
 for(const f of [...fs.readdirSync(path.join(racine,'src')).filter(x=>x.endsWith('.js')).map(x=>'src/'+x),'background.js','panel.js']){
  const t=fs.readFileSync(path.join(racine,f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  if(/\bhauteurApprise\b|BananeHauteurApprise/.test(t))lecteurs.push(f);
 }
 /* 5.0 (D-171) : src/relecture-ombre.js, module pur de la relecture, LIT la correction consignée par la décision pour dire la pose
  * qu'Ariane donnerait ; il ne la calcule pas et ne la pose pas. Le service worker ne la nomme toujours pas. */
 /* 4.9.5.13 (L1, D-219) : src/gcv2-l1.js, module de la GCV2 des différés, LIT la hauteur apprise consignée par la décision (hypothèses de la
  * chaîne), comme la relecture ; il ne la calcule pas. Le service worker ne la nomme toujours pas. */
 assert.deepEqual(lecteurs.sort(),['src/gcv2-l1.js','src/hauteur-apprise.js','src/lot-decision.js','src/relecture-ombre.js','src/settings.js']);
 assert.ok(!/hauteurApprise|hauteur-apprise/i.test(fs.readFileSync(path.join(racine,'src/engine.js'),'utf8')));
 const liste=[...fs.readFileSync(path.join(racine,'background.js'),'utf8').match(/importScripts\(([^)]*)\)/s)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 assert.ok(liste.indexOf('src/hauteur-apprise.js')>=0,'absent de importScripts');
 assert.ok(liste.indexOf('src/placement-convention.js')<liste.indexOf('src/hauteur-apprise.js'));
 assert.ok(liste.indexOf('src/hauteur-apprise.js')<liste.indexOf('src/lot-decision.js'));
});
