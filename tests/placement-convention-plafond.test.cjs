'use strict';
/* P1 (plan 5.0, D-129) — plafond du calage de convention.
 *
 * Réglage `conventionPlafond` de src/settings.js, COUPÉ par défaut. Coupé : `calibrate` rend, octet pour octet, ce que
 * rendait la base 5.0 (référence figée sur des cas synthétiques). Activé : un rail dont le décalage sort du domaine de
 * 8 mm est calé à 8 mm au plus par axe, dans son signe ; le reste est consigné ; la garde de paire (D-044) voit toujours
 * un rail « hors domaine ». Fixtures synthétiques seulement. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Convention=require('../src/placement-convention.js'),Shadow=require('../src/gcv1-shadow.js'),L=require('../src/lot-decision.js');
const Settings=require('../src/settings.js'),Gauge=require('../src/gauge.js'),C=require('../vendor/capture-core.js');
const {capture,raw,CAS,lancer}=require('./helpers/p1-convention-cas.cjs');
const pilot=require('./corpus/pilot-part18-cut6704-partial-flank.json');
const reference=JSON.parse(fs.readFileSync(path.join(__dirname,'corpus','p1-convention-reference.json'),'utf8')).resultats;

/* Pose le réglage comme le service worker le voit (global `BananeSettings`), puis le retire. */
function avecReglage(valeur,fn){
  const avant=Object.getOwnPropertyDescriptor(globalThis,'BananeSettings');
  globalThis.BananeSettings={...Settings,conventionPlafond:valeur};
  try{return fn();}finally{if(avant)Object.defineProperty(globalThis,'BananeSettings',avant);else delete globalThis.BananeSettings;}
}

test('le réglage existe, il est coupé par défaut, et le panneau le dit',()=>{
  assert.equal(Settings.conventionPlafond,false);
  const ligne=Settings.describe().find(l=>/Plafond du calage de convention/.test(l.nom));
  assert.ok(ligne);assert.match(ligne.valeur,/coupé/);
});

test('coupé : octet pour octet la base 5.0, sur tous les cas synthétiques',()=>{
  assert.equal(CAS.length,reference.length);
  assert.ok(reference.some(s=>JSON.parse(s).reason==='shift-out-of-domain'),'le jeu contient des rails refusés');
  const defaut=lancer(Convention);
  const coupes=[
    ['sans réglage',defaut],
    ['réglage faux',avecReglage(false,()=>lancer(Convention))],
    ['réglage absent de l’objet',(()=>{const avant=globalThis.BananeSettings;globalThis.BananeSettings={};try{return lancer(Convention);}finally{if(avant===undefined)delete globalThis.BananeSettings;else globalThis.BananeSettings=avant;}})()]];
  for(const [nom,out] of coupes)for(let i=0;i<CAS.length;i++)assert.equal(out[i],reference[i],`${nom} : ${CAS[i].nom}`);
  /* Option explicite fausse : même chose, même quand le réglage global est actif. */
  const force=avecReglage(true,()=>CAS.map(c=>JSON.stringify(Convention.calibrate(capture(c.cap||{}),c.side||'left',raw(!!(c.cap&&c.cap.mirror)),{...(c.options||{}),plafond:false}))));
  for(let i=0;i<CAS.length;i++)assert.equal(force[i],reference[i],`option plafond:false : ${CAS[i].nom}`);
});

test('activé : un rail dans le domaine, ou non calable, est rendu à l’identique',()=>{
  const actif=avecReglage(true,()=>lancer(Convention));
  let dedans=0,illisibles=0;
  for(let i=0;i<CAS.length;i++){
    const ref=JSON.parse(reference[i]);
    if(ref.reason==='shift-out-of-domain')continue;
    assert.equal(actif[i],reference[i],CAS[i].nom);ref.applied?dedans++:illisibles++;
  }
  assert.ok(dedans>20&&illisibles>0,'cas dans le domaine et cas non calables couverts');
});

test('activé : le décalage hors domaine est plafonné à 8 mm par axe, dans son signe, et le reste est consigné',()=>{
  const actif=avecReglage(true,()=>lancer(Convention));
  let plafonnes=0;const axes={du:0,dz:0,duNeg:0,dzNeg:0,deux:0};
  for(let i=0;i<CAS.length;i++){
    const ref=JSON.parse(reference[i]);
    if(ref.reason!=='shift-out-of-domain')continue;
    const r=JSON.parse(actif[i]),c=CAS[i],cap=(c.options&&c.options.maxShiftMm)||8,mirror=!!(c.cap&&c.cap.mirror),brut=raw(mirror),sign=mirror?-1:1;
    plafonnes++;
    assert.equal(r.applied,true,c.nom);assert.equal(r.capped,true,c.nom);assert.equal(r.capMm,cap,c.nom);
    /* Les décalages mesurés sont ceux du refus ; rien d'autre ne change. */
    assert.equal(r.duMm,ref.duMm,c.nom);assert.equal(r.dzMm,ref.dzMm,c.nom);assert.equal(r.topN,ref.topN);assert.equal(r.faceN,ref.faceN);
    assert.deepEqual(r.rawDelta,brut,c.nom);
    /* Plafond : magnitude limitée à cap, même signe. */
    assert.equal(r.appliedDzMm,Math.sign(ref.dzMm)*Math.min(Math.abs(ref.dzMm),cap),c.nom);
    assert.equal(r.appliedDuMm,Math.sign(ref.duMm)*Math.min(Math.abs(ref.duMm),cap),c.nom);
    assert.ok(Math.abs(r.appliedDzMm)<=cap&&Math.abs(r.appliedDuMm)<=cap);
    assert.ok(Math.abs(r.appliedDzMm-r.dzMm)<=1e-12||Math.abs(r.appliedDzMm)===cap,'un axe dans le domaine est appliqué en entier');
    /* Le reste = mesuré − appliqué, même signe que le mesuré, nul sur un axe qui n'a pas dépassé. */
    assert.ok(Math.abs(r.restDzMm-(r.dzMm-r.appliedDzMm))<1e-12);assert.ok(Math.abs(r.restDuMm-(r.duMm-r.appliedDuMm))<1e-12);
    assert.ok(r.restDzMm*ref.dzMm>=0&&r.restDuMm*ref.duMm>=0,'le reste a le signe du décalage');
    if(Math.abs(ref.dzMm)<=cap)assert.equal(r.restDzMm,0);
    if(Math.abs(ref.duMm)<=cap)assert.equal(r.restDuMm,0);
    assert.ok(Math.abs(r.restDzMm)>0||Math.abs(r.restDuMm)>0,'le plafond a joué, donc il reste quelque chose');
    /* Le delta posé = delta brut + décalage plafonné (u orienté vers le champignon, signe du profil). */
    assert.equal(r.delta[0],brut[0]);
    assert.ok(Math.abs(r.delta[1]-(brut[1]+sign*r.appliedDuMm/1000))<1e-12,c.nom);
    assert.ok(Math.abs(r.delta[2]-(brut[2]+r.appliedDzMm/1000))<1e-12,c.nom);
    if(Math.abs(ref.dzMm)>cap)ref.dzMm>0?axes.dz++:axes.dzNeg++;
    if(Math.abs(ref.duMm)>cap)ref.duMm>0?axes.du++:axes.duNeg++;
    if(Math.abs(ref.dzMm)>cap&&Math.abs(ref.duMm)>cap)axes.deux++;
    /* Le motif du refus reste, pour la garde de paire. */
    assert.equal(r.reason,'shift-out-of-domain');
  }
  assert.ok(plafonnes>=60,'assez de rails refusés pour que la mesure compte');
  for(const [k,v] of Object.entries(axes))assert.ok(v>0,`axe couvert : ${k}`);
});

test('activé : exactement à la borne, rien n’est plafonné et rien n’est ajouté au résultat',()=>{
  /* Face décalée de 11 mm : duMm vaut 8,0 (à la borne), dzMm 3,5. */
  const r=avecReglage(true,()=>Convention.calibrate(capture({faceShiftMm:11}),'left',raw(false)));
  assert.equal(r.applied,true);assert.ok(Math.abs(r.duMm)<=8);
  assert.equal('capped' in r,false);assert.equal('restDzMm' in r,false);assert.equal(r.reason,undefined);
});

test('activé : dessus sous-observé reste refusé, il n’y a rien à plafonner',()=>{
  const r=avecReglage(true,()=>Convention.calibrate(capture({topPoints:10}),'left',raw(false)));
  assert.equal(r.applied,false);assert.equal(r.reason,'top-under-observed');assert.deepEqual(r.delta,raw(false));
});

test('le plafond suit maxShiftMm, et l’option explicite prime sur le réglage',()=>{
  const cap=capture({topSpreadMm:5}),brut=raw(false);
  const sans=Convention.calibrate(cap,'left',brut,{maxShiftMm:4});assert.equal(sans.applied,false);
  const avec=Convention.calibrate(cap,'left',brut,{maxShiftMm:4,plafond:true});
  assert.equal(avec.applied,true);assert.equal(avec.capMm,4);assert.equal(avec.appliedDzMm,4);
  assert.equal(avecReglage(true,()=>Convention.calibrate(cap,'left',brut,{maxShiftMm:4,plafond:false})).applied,false);
  assert.equal(avecReglage(true,()=>Convention.calibrate(cap,'left',brut,{maxShiftMm:4})).capped,true);
  assert.equal(avecReglage(false,()=>Convention.calibrate(cap,'left',brut,{maxShiftMm:4,plafond:true})).capped,true);
});

test('activé : déterministe, et le delta d’entrée n’est pas modifié',()=>{
  const cap=capture({topSpreadMm:11}),brut=raw(false),copie=brut.slice();
  const a=Convention.calibrate(cap,'left',brut,{plafond:true}),b=Convention.calibrate(cap,'left',brut,{plafond:true});
  assert.equal(JSON.stringify(a),JSON.stringify(b));assert.deepEqual(brut,copie);assert.deepEqual(a.rawDelta,copie);assert.notEqual(a.rawDelta,brut);
});

test('dans le moteur : le rail hors domaine est posé plafonné, le rail calé et l’écartement suivent',()=>{
  const off=Shadow.scientificProposeBoth(pilot);
  const on=avecReglage(true,()=>Shadow.scientificProposeBoth(pilot));
  /* Le rail gauche, dans le domaine, ne bouge pas ; le droit, hors domaine (voir placement-convention.test), est plafonné. */
  const sansPaire=({pairGauge,...r})=>r;  // l'écartement de la paire dépend des deux rails
  assert.equal(JSON.stringify(sansPaire(on.rails.left)),JSON.stringify(sansPaire(off.rails.left)));
  const refus=off.rails.right.conventionCalibration,cal=on.rails.right.conventionCalibration;
  assert.equal(refus.applied,false);assert.equal(refus.reason,'shift-out-of-domain');
  assert.equal(cal.applied,true);assert.equal(cal.capped,true);assert.equal(cal.reason,'shift-out-of-domain');
  assert.deepEqual(on.rails.right.next.rawDelta,off.rails.right.next.delta,'le delta scientifique reste lisible');
  assert.deepEqual(on.rails.right.next.delta,cal.delta);
  const d=[1,2].map(i=>(on.rails.right.next.delta[i]-off.rails.right.next.delta[i])*1000);
  assert.ok(d.every(v=>Math.abs(v)<=8+1e-9),'au plus 8 mm par axe');assert.ok(d.some(v=>Math.abs(v)>1),'le rail a bougé');
  /* L'écartement est jugé sur les positions réellement commandées, plafonnées. */
  const attendu=Gauge.predictedGaugeMm(pilot.rails,{left:on.rails.left.next.delta,right:on.rails.right.next.delta},C);
  assert.ok(Math.abs(on.pairGauge.predictedMm-attendu)<1e-9);
  /* Coupé de nouveau : retour exact. */
  assert.equal(JSON.stringify(Shadow.scientificProposeBoth(pilot)),JSON.stringify(off));
});

/* La garde de paire (D-044) : un premier passage dont un rail est repêché par S1 ET dont un rail est hors domaine est
 * différé. Le plafond ne doit pas la contourner : le rail plafonné porte toujours le motif « hors domaine ». */
test('la garde de paire ne change pas : un rail plafonné compte toujours comme hors domaine',()=>{
  const cap=capture({topSpreadMm:11}),cal=Convention.calibrate(cap,'left',raw(false),{plafond:true});
  assert.equal(cal.capped,true);
  const science=repeche=>({summary:{pairGaugeRejected:false},rails:{
    left:{ok:true,next:{status:'candidate',delta:[0,.001,0],changed:repeche},conventionCalibration:{applied:true,reason:null}},
    right:{ok:true,next:{status:'candidate',delta:[0,.001,0],changed:false},conventionCalibration:cal}}});
  const pose=(s)=>L.decideCut({capture:{identity:{part:23,cut:105,frameId:'f'},rails:pilot.rails,pointsSceneRelative:pilot.pointsSceneRelative,visibleByClipBoxes:pilot.pointsSceneRelative.map(()=>true)},science:s,anchors:[],Shadow});
  const gardee=pose(science(true));
  assert.equal(gardee.stage,'deferred');assert.equal(gardee.reason,'pair-guard');
  /* Le même rail refusé (comportement actuel) donne la même décision. */
  const refus=Convention.calibrate(cap,'left',raw(false),{plafond:false});
  const sciRefus={...science(true),rails:{...science(true).rails,right:{...science(true).rails.right,conventionCalibration:refus}}};
  assert.equal(JSON.stringify(pose(sciRefus)),JSON.stringify(gardee));
  /* Pas de rail repêché : la garde ne se déclenche pas, plafond ou non. */
  assert.notEqual(pose(science(false)).reason,'pair-guard');
});

/* ------------------------------------------------------------------ P1 bis : plafond sur l'axe vertical seulement */
const brutDe=c=>raw(!!(c.cap&&c.cap.mirror));
const lancerAvec=(valeur)=>avecReglage(valeur,()=>lancer(Convention));

test('trois valeurs : faux, "vertical", vrai ; le reste vaut faux', () => {
  assert.equal(JSON.stringify(Convention.calibrate(capture({topSpreadMm:11}),'left',raw(false),{plafond:'oui'})),reference[CAS.findIndex(c=>c.cap&&c.cap.topSpreadMm===11&&c.cap.topShiftMm===0&&c.cap.facePoints===11)],'valeur inconnue : comme faux');
  for(const valeur of ['oui',1,null,undefined,'both','']) {
    const out=avecReglage(valeur,()=>lancer(Convention));
    for(let i=0;i<CAS.length;i++)assert.equal(out[i],reference[i],`${String(valeur)} : ${CAS[i].nom}`);
  }
});

test('"vertical" : les rails dans le domaine ou non calables sont rendus à l’identique', () => {
  const v=lancerAvec('vertical');
  for(let i=0;i<CAS.length;i++){const ref=JSON.parse(reference[i]);if(ref.reason==='shift-out-of-domain')continue;assert.equal(v[i],reference[i],CAS[i].nom);}
});

test('"vertical" : un décalage latéral hors domaine garde le rail refusé, posé brut, même si dz est hors domaine', () => {
  const v=lancerAvec('vertical');let lateraux=0,deux=0;
  for(let i=0;i<CAS.length;i++){
    const ref=JSON.parse(reference[i]),max=(CAS[i].options&&CAS[i].options.maxShiftMm)||8;
    if(ref.reason!=='shift-out-of-domain'||!(Math.abs(ref.duMm)>max))continue;
    lateraux++;if(Math.abs(ref.dzMm)>max)deux++;
    assert.equal(v[i],reference[i],`refus conservé, octet pour octet : ${CAS[i].nom}`);
    const r=JSON.parse(v[i]);assert.equal(r.applied,false);assert.deepEqual(r.delta,brutDe(CAS[i]));assert.equal('capped' in r,false);
  }
  assert.ok(lateraux>=4,'cas latéraux couverts');assert.ok(deux>=2,'cas avec les deux axes hors domaine couverts');
});

test('"vertical" : dz seul hors domaine est plafonné à 8 mm dans son signe, du appliqué en entier, le reste consigné', () => {
  const v=lancerAvec('vertical');let n=0,positifs=0,negatifs=0;
  for(let i=0;i<CAS.length;i++){
    const ref=JSON.parse(reference[i]),c=CAS[i],max=(c.options&&c.options.maxShiftMm)||8;
    if(ref.reason!=='shift-out-of-domain'||Math.abs(ref.duMm)>max)continue;
    n++;const r=JSON.parse(v[i]),mirror=!!(c.cap&&c.cap.mirror),brut=brutDe(c),sign=mirror?-1:1;
    assert.equal(r.applied,true,c.nom);assert.equal(r.capped,true);assert.equal(r.capAxes,'vertical');assert.equal(r.capMm,max);assert.equal(r.reason,'shift-out-of-domain');
    assert.equal(r.duMm,ref.duMm);assert.equal(r.dzMm,ref.dzMm);
    assert.equal(r.appliedDzMm,Math.sign(ref.dzMm)*max,'dz plafonné');assert.ok(Math.abs(r.restDzMm-(ref.dzMm-r.appliedDzMm))<1e-12);assert.ok(r.restDzMm*ref.dzMm>0);
    assert.equal(r.appliedDuMm,ref.duMm,'du appliqué en entier');assert.equal(r.restDuMm,0);
    assert.ok(Math.abs(r.delta[1]-(brut[1]+sign*ref.duMm/1000))<1e-12);assert.ok(Math.abs(r.delta[2]-(brut[2]+r.appliedDzMm/1000))<1e-12);assert.equal(r.delta[0],brut[0]);
    ref.dzMm>0?positifs++:negatifs++;
  }
  assert.ok(n>=50);assert.ok(positifs>0&&negatifs>0,'les deux signes de dz');
});

test('vrai : comportement des deux axes inchangé par P1 bis (aucun champ capAxes)', () => {
  const t=lancerAvec(true);
  for(let i=0;i<CAS.length;i++){const ref=JSON.parse(reference[i]),r=JSON.parse(t[i]);
    if(ref.reason==='shift-out-of-domain'){assert.equal(r.capped,true);assert.equal('capAxes' in r,false);const max=(CAS[i].options&&CAS[i].options.maxShiftMm)||8;assert.equal(r.appliedDuMm,Math.sign(ref.duMm)*Math.min(Math.abs(ref.duMm),max));}
    else assert.equal(t[i],reference[i]);}
  /* "vertical" et vrai ne diffèrent que sur les rails dont du est hors domaine : ailleurs, même pose (du est appliqué en entier dans les deux cas). */
  const v=lancerAvec('vertical');let memes=0,differents=0;
  for(let i=0;i<CAS.length;i++){const ref=JSON.parse(reference[i]),max=(CAS[i].options&&CAS[i].options.maxShiftMm)||8;
    if(ref.reason!=='shift-out-of-domain')continue;
    const a=JSON.parse(v[i]),b=JSON.parse(t[i]);
    if(Math.abs(ref.duMm)>max){differents++;assert.equal(a.applied,false);assert.equal(b.applied,true);}
    else{memes++;assert.deepEqual(a.delta,b.delta,CAS[i].nom);assert.equal(a.appliedDzMm,b.appliedDzMm);}}
  assert.ok(memes>0&&differents>0);
});

test('l’option explicite prime sur le réglage, avec les trois valeurs', () => {
  const cap=capture({topSpreadMm:11}),brut=raw(false);
  assert.equal(Convention.calibrate(cap,'left',brut,{plafond:'vertical'}).capAxes,'vertical');
  assert.equal(avecReglage(true,()=>Convention.calibrate(cap,'left',brut,{plafond:'vertical'})).capAxes,'vertical');
  assert.equal(avecReglage('vertical',()=>Convention.calibrate(cap,'left',brut,{plafond:true})).capAxes,undefined);
  assert.equal(avecReglage('vertical',()=>Convention.calibrate(cap,'left',brut,{plafond:false})).applied,false);
  assert.equal(avecReglage('vertical',()=>Convention.calibrate(cap,'left',brut)).capAxes,'vertical');
});

test('le réglage livré est faux et le panneau le dit coupé', () => {
  assert.equal(Settings.conventionPlafond,false);
  const texte=Settings.describe().find(l=>/Plafond du calage de convention/.test(l.nom)).valeur;
  assert.match(texte,/coupé/);
});

test('dans le moteur : "vertical" plafonne dz seul, le journal compact reprend capped, capMm, capAxes et rest*, et coupé il est inchangé', () => {
  const off=Shadow.scientificProposeBoth(pilot),runtimeOff=Shadow.toRuntimeRails(off);
  for(const s of ['left','right'])assert.deepEqual(Object.keys(runtimeOff[s].gcv1.convention),['applied','reason','duMm','dzMm','faceMode','rawDelta'],'coupé : mêmes champs qu’avant');
  const refus=off.rails.right.conventionCalibration;
  const lateral=Math.abs(refus.duMm)>8;
  const vert=avecReglage('vertical',()=>Shadow.scientificProposeBoth(pilot)),deux=avecReglage(true,()=>Shadow.scientificProposeBoth(pilot));
  const cv=vert.rails.right.conventionCalibration;
  assert.equal(lateral,false,'la capture versionnée a un rail droit hors domaine sur dz seul');
  if(lateral){assert.equal(cv.applied,false);assert.deepEqual(vert.rails.right.next.delta,off.rails.right.next.delta);}
  else{assert.equal(cv.capped,true);assert.equal(cv.capAxes,'vertical');assert.equal(cv.appliedDuMm,cv.duMm);assert.equal(cv.restDuMm,0);
    const journal=Shadow.toRuntimeRails(vert).right.gcv1.convention;
    assert.deepEqual(['capped','capMm','capAxes','appliedDuMm','appliedDzMm','restDuMm','restDzMm'].map(k=>journal[k]),[true,8,'vertical',cv.appliedDuMm,cv.appliedDzMm,cv.restDuMm,cv.restDzMm]);}
  const jd=Shadow.toRuntimeRails(deux).right.gcv1.convention;
  assert.equal(jd.capped,true);assert.equal(jd.capMm,8);assert.equal(jd.capAxes,'both');assert.equal(jd.restDzMm,deux.rails.right.conventionCalibration.restDzMm);
  assert.equal(Shadow.toRuntimeRails(deux).left.gcv1.convention.capped,undefined,'rail dans le domaine : rien de plus');
});

test('la garde de paire ne change pas non plus en mode "vertical"', () => {
  const cap=capture({topSpreadMm:11}),brut=raw(false);   // dz hors domaine seul
  const cal=Convention.calibrate(cap,'left',brut,{plafond:'vertical'});assert.equal(cal.capped,true);assert.equal(cal.capAxes,'vertical');
  const latRefuse=Convention.calibrate(capture({faceShiftMm:12}),'left',brut,{plafond:'vertical'});assert.equal(latRefuse.applied,false);
  for(const [nom,rail] of [['plafonné',cal],['refusé',latRefuse]]){
    const science={summary:{pairGaugeRejected:false},rails:{
      left:{ok:true,next:{status:'candidate',delta:[0,.001,0],changed:true},conventionCalibration:{applied:true,reason:null}},
      right:{ok:true,next:{status:'candidate',delta:[0,.001,0],changed:false},conventionCalibration:rail}}};
    const d=L.decideCut({capture:{identity:{part:23,cut:105,frameId:'f'},rails:pilot.rails,pointsSceneRelative:pilot.pointsSceneRelative,visibleByClipBoxes:pilot.pointsSceneRelative.map(()=>true)},science,anchors:[],Shadow});
    assert.equal(d.stage,'deferred',nom);assert.equal(d.reason,'pair-guard',nom);
  }
});
