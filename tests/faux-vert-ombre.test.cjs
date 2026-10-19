'use strict';
/* 5.0 (chantier « faux verts ») — FAUX VERT EN OMBRE (src/faux-vert-ombre.js, consigné par src/lot-decision.js).
 *
 * Un faux vert est un cut qu'Ariane valide et que l'opérateur corrige de plus de 10 mm. La typologie des 85 faux verts des
 * parties 17, 24, 29 et de la partie 1 du second projet (fiches/FAUX_VERTS.md) montre surtout des erreurs VERTICALES de
 * convention : le dessus du rail est ambigu. La règle « hauteur ambiguë » le dit d'un rail : décalage vertical du calage de
 * convention d'au moins 11 mm (appliqué ou refusé) ET bande des points du dessus épaisse d'au moins 14 mm (10e au 90e centile)
 * à la pose posée. Elle est CONSIGNÉE dans la décision (`fauxVertOmbre`) ; son chemin d'activation (différer le cut au lieu
 * de le valider) existe mais il est COUPÉ (`differer:false`) : la décision, la pose et la commande sont identiques, octet pour
 * octet, avec et sans l'ombre. Coupé ou non, ce chemin ne peut que DIFFÉRER : jamais une pose nouvelle.
 * Données synthétiques (captures versionnées de tests/corpus, fixtures de tests). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const L=require('../src/lot-decision.js'),O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js'),Settings=require('../src/settings.js');
const C=require('../vendor/capture-core.js'),Conv=require('../src/placement-convention.js');
const FV=require('../src/faux-vert-ombre.js');
const {K,base}=require('./fixtures.cjs');
const pilote=require('./corpus/pilot-part18-cut6704-partial-flank.json');
const SIDES=['left','right'];

function avecReglage(valeur,fn){
 const avant=Object.getOwnPropertyDescriptor(globalThis,'BananeSettings');
 /* La hauteur apprise (autre ombre de la décision) est tenue à l'écart : cet essai ne juge que le faux vert en ombre. */
 globalThis.BananeSettings=valeur===undefined?{...Settings,fauxVertOmbre:undefined,hauteurApprise:undefined}:{...Settings,fauxVertOmbre:valeur,hauteurApprise:undefined};
 try{return fn();}finally{if(avant)Object.defineProperty(globalThis,'BananeSettings',avant);else delete globalThis.BananeSettings;}
}
const sans=d=>{const {fauxVertOmbre,...reste}=d;return reste;};
const BAS={actif:true,differer:false,dzMinMm:8,epaisseurMinMm:6};

/* Cas 1 : premier passage, rail gauche calé (4,8 mm), rail droit refusé (8,3 mm). */
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
const memoReprise=new Map();
const reprise=()=>{const cle=JSON.stringify(globalThis.BananeSettings?.fauxVertOmbre??null);
 if(!memoReprise.has(cle))memoReprise.set(cle,L.decideCut({capture:capReprise,science:sciReprise,anchors:ancres,Shadow}));return memoReprise.get(cle);};
/* Cas 3 : différé (aucune pose). */
const differe=()=>L.decideCut({capture:capReprise,science:sciReprise,anchors:[],Shadow});

/* Commande : la même chaîne que `commandLot` (background.js). */
const before=r=>Object.fromEntries(SIDES.map(s=>[s,r[s]]));
const expectedPoses=rails0=>(_a,rails)=>Object.fromEntries(SIDES.map(s=>[s,{positionSceneRelative:C.point(rails0[s].profileLocalToSceneRelative,rails[s].delta)}]));
const moteur=sci=>Shadow.toRuntimeRails(sci);
const commande=(d,cap,sci,cameras={left:null,right:null})=>L.commandRails({decision:d,runtimeRails:moteur(sci),before:before(cap.rails),expectedPoses:expectedPoses(cap.rails),cameras});

test('le module et le réglage existent : règle figée, ombre active pour consigner, chemin d\'activation COUPÉ',()=>{
 assert.equal(FV.VERSION,'faux-vert-ombre-v1');
 assert.deepEqual({...FV.REGLE},{version:'faux-vert-ombre-v1',dzMinMm:11,epaisseurMinMm:14});
 assert.ok(Object.isFrozen(FV.REGLE));
 assert.deepEqual({...Settings.fauxVertOmbre},{actif:true,differer:false,dzMinMm:11,epaisseurMinMm:14});
 assert.ok(Object.isFrozen(Settings.fauxVertOmbre));
 assert.equal(Settings.fauxVertOmbre.differer,false,'le chemin d\'activation est coupé dans le réglage livré');
 const ligne=Settings.describe().find(l=>/Faux vert en ombre/.test(l.nom));
 assert.ok(ligne,'une ligne dans la liste des réglages');assert.match(ligne.valeur,/consign/i);assert.match(ligne.pourquoi,/jamais/i);
});

test('les signaux sont ceux du moment de la décision : calage de convention de la science, épaisseur du dessus à la pose décidée',()=>{
 const d=premierPassage();
 const s=FV.signaux({capture:capPilote,science:sciPilote,decision:d});
 for(const side of SIDES){
  const cal=sciPilote.rails[side].conventionCalibration;
  assert.equal(s.rails[side].dzMm,Math.round(cal.dzMm*10)/10,side+' : décalage vertical du calage');
  const M=capPilote.rails[side].sceneRelativeToProfileLocal,a=C.point(M,d.positions[side]),o=C.point(M,capPilote.rails[side].positionSceneRelative);
  const b=Conv.bandOffsets(capPilote,side,[a[0]-o[0],a[1]-o[1],a[2]-o[2]]);
  assert.equal(s.rails[side].pointsDessus,b.top.length);
  assert.equal(s.rails[side].epaisseurDessusMm,Math.round((Conv.quantile(b.top,.9)-Conv.quantile(b.top,.1))*10)/10,side+' : épaisseur du dessus');
 }
 assert.equal(s.rails.left.calage,'applique');assert.equal(s.rails.right.calage,'shift-out-of-domain');
});

test('verdict : « différer » seulement si un même rail porte les deux signaux au-dessus des seuils',()=>{
 const d=premierPassage();
 const defaut=FV.evaluer({capture:capPilote,science:sciPilote,decision:d});
 assert.equal(defaut.verdict,'valider','8,3 mm et 6,8 mm sont sous les seuils figés');assert.equal(defaut.motif,null);assert.deepEqual(defaut.railsSuspects,[]);
 assert.deepEqual(defaut.seuils,{dzMinMm:11,epaisseurMinMm:14});
 const bas=FV.evaluer({capture:capPilote,science:sciPilote,decision:d,reglage:BAS});
 assert.equal(bas.verdict,'differer');assert.equal(bas.motif,'hauteur-ambigue');assert.deepEqual(bas.railsSuspects,['right'],'le rail gauche (4,8 mm) reste sous le seuil de décalage');
 /* Un seul des deux signaux ne suffit pas. */
 assert.equal(FV.evaluer({capture:capPilote,science:sciPilote,decision:d,reglage:{dzMinMm:8,epaisseurMinMm:50}}).verdict,'valider');
 assert.equal(FV.evaluer({capture:capPilote,science:sciPilote,decision:d,reglage:{dzMinMm:50,epaisseurMinMm:1}}).verdict,'valider');
 /* Rien à juger sans pose. */
 assert.equal(FV.evaluer({capture:capReprise,science:sciReprise,decision:differe()}),null);
 assert.equal(FV.evaluer({capture:capPilote,science:sciPilote,decision:null}),null);
});

test('la décision consigne l\'ombre quand le réglage est actif, et rien hors service worker ou réglage coupé',()=>{
 const d=avecReglage(BAS,()=>premierPassage());
 assert.equal(d.fauxVertOmbre.verdict,'differer');assert.equal(d.fauxVertOmbre.version,'faux-vert-ombre-v1');
 assert.equal(avecReglage({...Settings.fauxVertOmbre},()=>premierPassage()).fauxVertOmbre.verdict,'valider');
 for(const [nom,r] of [['actif:false',{...BAS,actif:false}],['absent',undefined]])assert.ok(!('fauxVertOmbre' in avecReglage(r,()=>premierPassage())),nom);
 assert.equal(globalThis.BananeSettings,undefined);assert.ok(!('fauxVertOmbre' in premierPassage()),'outils hors ligne : la base 5.0');
 assert.ok(!('fauxVertOmbre' in avecReglage(BAS,differe)),'cut différé : rien à consigner');
 /* L'option explicite de l'appelant l'emporte sur le global (rejeu hors ligne). */
 assert.equal(premierPassage({fauxVertOmbre:BAS}).fauxVertOmbre.verdict,'differer');
 assert.ok(!('fauxVertOmbre' in avecReglage(BAS,()=>premierPassage({fauxVertOmbre:{actif:false}}))));
});

test('LA DÉCISION NE CHANGE PAS : identique, octet pour octet, avec et sans l\'ombre, à tout réglage ; la commande aussi',()=>{
 const REGLAGES=[BAS,{...Settings.fauxVertOmbre},{...BAS,actif:false},undefined,{actif:true,differer:false,dzMinMm:0,epaisseurMinMm:0}];
 /* Référence : le service worker sans ce réglage (les autres ombres, P8 comprise, restent ce qu'elles sont). */
 const sansReglage=avecReglage(undefined,()=>({pp:JSON.stringify(premierPassage()),rp:JSON.stringify(reprise())}));
 for(const r of REGLAGES){
  const d=avecReglage(r,()=>premierPassage());
  assert.equal(JSON.stringify(sans(d)),sansReglage.pp,`premier passage, ${JSON.stringify(r)}`);
 }
 const dr=avecReglage(BAS,reprise);
 assert.equal(dr.stage,'window');assert.equal(JSON.stringify(sans(dr)),sansReglage.rp,'reprise depuis la voie');
 /* La commande ne lit pas l'ombre tant que le chemin est coupé, même une ombre « différer » ou fausse. */
 for(const [d,cap,sci] of [[avecReglage(BAS,()=>premierPassage()),capPilote,sciPilote],[dr,capReprise,sciReprise]]){
  const ref=JSON.stringify(commande(sans(d),cap,sci));
  for(const r of [Settings.fauxVertOmbre,BAS,undefined])
   avecReglage(r,()=>{
    assert.equal(JSON.stringify(commande(d,cap,sci)),ref);
    assert.equal(JSON.stringify(commande({...d,fauxVertOmbre:{verdict:'differer',motif:'faux'}},cap,sci)),ref);
   });
 }
});

test('chemin d\'activation (essai seulement, coupé à la livraison) : il ne peut que DIFFÉRER, jamais poser',()=>{
 const actif={...BAS,differer:true};
 const d=avecReglage(BAS,()=>premierPassage());assert.equal(d.fauxVertOmbre.verdict,'differer');
 const sansOmbre=commande(sans(d),capPilote,sciPilote);
 const out=avecReglage(actif,()=>commande(d,capPilote,sciPilote));
 assert.equal(out.action,'defer');assert.equal(out.reason,'faux-vert-ombre');
 for(const s of SIDES){assert.equal(out.rails[s].status,'unresolved');assert.equal(out.rails[s].delta,null);}
 assert.notEqual(sansOmbre.action,'defer','sans le chemin, le cut aurait été posé');
 /* Un verdict « valider » laisse la commande telle quelle. */
 const v={...d,fauxVertOmbre:{...d.fauxVertOmbre,verdict:'valider'}};
 assert.equal(JSON.stringify(avecReglage(actif,()=>commande(v,capPilote,sciPilote))),JSON.stringify(sansOmbre));
 /* Un cut déjà différé reste différé, à l'identique : le chemin n'ajoute jamais de pose. */
 const dd=avecReglage(BAS,differe),refD=JSON.stringify(commande(dd,capReprise,sciReprise));
 assert.equal(JSON.stringify(avecReglage(actif,()=>commande({...dd,fauxVertOmbre:{verdict:'differer'}},capReprise,sciReprise))),refD);
 /* Différé par l'ombre, le cut ne devient pas appui. */
 assert.equal(L.commandsPositions(d,out),false);
});

test('l\'ombre ne modifie rien de ce qu\'elle lit',()=>{
 const capAvant=JSON.stringify(capPilote),sciAvant=JSON.stringify(sciPilote),d=premierPassage(),dAvant=JSON.stringify(d);
 FV.evaluer({capture:capPilote,science:sciPilote,decision:d,reglage:BAS});avecReglage(BAS,()=>premierPassage());
 assert.equal(JSON.stringify(capPilote),capAvant);assert.equal(JSON.stringify(sciPilote),sciAvant);assert.equal(JSON.stringify(d),dAvant);
});

test('une panne de l\'ombre ne change jamais la décision',()=>{
 const reel=FV.evaluer;
 try{FV.evaluer=()=>{throw Error('panne');};
  const d=avecReglage(BAS,()=>premierPassage());assert.ok(!('fauxVertOmbre' in d));assert.equal(JSON.stringify(d),JSON.stringify(avecReglage(undefined,()=>premierPassage())));}
 finally{FV.evaluer=reel;}
});

test('seuls le module, la décision sur le lot et le réglage nomment l\'ombre ; le moteur et le service worker ne la lisent pas',()=>{
 const racine=path.resolve(__dirname,'..'),lecteurs=[];
 for(const f of [...fs.readdirSync(path.join(racine,'src')).filter(x=>x.endsWith('.js')).map(x=>'src/'+x),'background.js','panel.js']){
  const t=fs.readFileSync(path.join(racine,f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  if(/\bfauxVertOmbre\b|BananeFauxVertOmbre/.test(t))lecteurs.push(f);
 }
 assert.deepEqual(lecteurs.sort(),['src/faux-vert-ombre.js','src/lot-decision.js','src/settings.js']);
 assert.ok(!/fauxVert|faux-vert/i.test(fs.readFileSync(path.join(racine,'src/engine.js'),'utf8')));
 /* Le service worker charge le module avant la décision sur le lot. */
 const liste=[...fs.readFileSync(path.join(racine,'background.js'),'utf8').match(/importScripts\(([^)]*)\)/s)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 assert.ok(liste.indexOf('src/faux-vert-ombre.js')>=0,'absent de importScripts');
 assert.ok(liste.indexOf('src/faux-vert-ombre.js')<liste.indexOf('src/lot-decision.js'));
 assert.ok(liste.indexOf('src/placement-convention.js')<liste.indexOf('src/faux-vert-ombre.js'));
});
