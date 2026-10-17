'use strict';
/* 5.0 — RÈGLES MÉTIER DE MIC EN OMBRE (src/regles-metier.js). Essais du module pur, sur des données SYNTHÉTIQUES (voie droite
 * fabriquée, numéros de cut inventés) : surface « au ras » par quart de voie, zones (PN confirmé, marge après, grappe de différés),
 * règles déclenchées et verdict, verts à contrôler par l'écartement de la partie. Aucune position dans ce que le module rend. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../src/regles-metier.js');

/* Deux rails d'une voie droite le long de x, repère profil = repère scène (matrice identité, colonne d'abord). */
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const rail=y=>({positionSceneRelative:[0,y,0],sceneRelativeToProfileLocal:I,profileLocalToSceneRelative:I});
const RAILS={left:rail(-0.7175),right:rail(0.7175)};
/* Nuage : z(y) donne la hauteur du sol à l'abscisse latérale y ; points tous visibles. */
function capture(z){const pts=[];for(let x=-0.5;x<=0.5001;x+=0.05)for(let y=-1.3;y<=1.3001;y+=0.01)pts.push([x,y,z(y)]);return {rails:RAILS,pointsSceneRelative:pts,visibleByClipBoxes:pts.map(()=>true)};}
const ballast=()=>-0.16,chaussee=()=>-0.01;
const quai=y=>y>0.7175?-0.01:-0.16;   // à droite du rail droit seulement : un quai, un trottoir, une autre voie au ras

test('réglages : version, seuils figés, objet gelé',()=>{
 assert.ok(Object.isFrozen(R.DEFAULTS));assert.equal(R.DEFAULTS.version,'regles-metier-v1');
 assert.deepEqual(JSON.parse(JSON.stringify(R.DEFAULTS.pn)),{confirmation:2,confirmationEcartCuts:3,margeAvant:4,margeApres:6});
 assert.deepEqual(JSON.parse(JSON.stringify(R.DEFAULTS.grappe)),{fenetreCuts:6,differesMin:2,procheCuts:2});
 assert.equal(R.DEFAULTS.surface.quadMinPct,50);assert.equal(R.DEFAULTS.ecartement.seuilMm,15);assert.equal(R.DEFAULTS.enPlace.mm,1);
});

test('surface au ras : la chaussée d\'un PN couvre les quatre quarts ; un quai d\'un seul côté ne fait pas un PN',()=>{
 const voie=R.surface(capture(ballast)),pn=R.surface(capture(chaussee)),q=R.surface(capture(quai));
 assert.equal(voie.flushPct,0);assert.equal(voie.coeurPN,false);
 assert.equal(pn.flushPct,100);assert.equal(pn.quadMin,100);assert.equal(pn.coeurPN,true);
 /* Le quai remplit un quart sur quatre : la part globale peut monter, le plus faible des quarts reste à 0. */
 assert.ok(q.flushPct>=20&&q.flushPct<=30,'part globale '+q.flushPct);assert.equal(q.quadMin,0);assert.equal(q.coeurPN,false);
 /* Même part globale que le lecteur du passage à niveau (src/level-crossing.js) : même bande, mêmes points visibles. */
 const X=require('../src/level-crossing.js');for(const c of [capture(ballast),capture(chaussee),capture(quai)])assert.equal(R.surface(c).flushPct,X.detect(c).flushPct);
 /* Trop peu de points à côté des rails : pas de verdict de PN. */
 const vide={rails:RAILS,pointsSceneRelative:[[0,-0.4,0]],visibleByClipBoxes:[true]};assert.equal(R.surface(vide).coeurPN,false);
 /* Points invisibles écartés, comme dans la décision du lot. */
 const c=capture(chaussee);c.visibleByClipBoxes=c.pointsSceneRelative.map(()=>false);assert.equal(R.surface(c).sidePoints,0);
});

const res=(cut,o={})=>({cut,part:9,valide:true,stage:'first-pass',action:'engine',deplacementMm:5,ecartementMm:1435,coeurPN:false,flushPct:0,quadMin:0,...o});
function jouer(mem,suite){return suite.map(r=>{const e=R.evaluer(mem,r);R.noter(mem,r,{differe:!r.valide});return e;});}

test('PN : un cœur seul n\'est qu\'un candidat ; deux cœurs à 3 cuts au plus confirment ; marge de 6 cuts après ; 4 avant signalés seulement',()=>{
 const mem=R.creerMemoire('lot-a');
 const e=jouer(mem,[res(96),res(100,{coeurPN:true}),res(102,{coeurPN:true}),res(105),res(108),res(109)]);
 assert.deepEqual(e.map(x=>x.zone.pn),[null,'coeur-non-confirme','coeur','marge-apres','marge-apres',null]);
 assert.deepEqual(e[2].zone.pnControle,[96,108],'plage à contrôler : 4 cuts avant le premier cœur, 6 après le dernier');
 assert.deepEqual(e.map(x=>x.regles.includes('pn-chaque-cut')),[false,false,true,true,true,false]);
 assert.deepEqual(e.map(x=>x.aurait),['valider','valider','differer','differer','differer','valider']);
 /* Variante de mesure (un cœur suffit) : la zone commence au cœur lui-même. */
 const m1=R.creerMemoire('lot-a1');R.noter(m1,res(100,{coeurPN:true}),{},{pn:{confirmation:1}});assert.deepEqual(m1.zones,[{debut:100,fin:100}]);
 /* Un cœur isolé loin de tout autre : jamais confirmé. */
 const m2=R.creerMemoire('lot-b');assert.deepEqual(jouer(m2,[res(10,{coeurPN:true}),res(14,{coeurPN:true})]).map(x=>x.zone.pn),['coeur-non-confirme','coeur-non-confirme']);
});

test('grappe de différés : un cut posé au milieu de différés du lot ; les différés DE LA RÈGLE ne comptent pas (pas d\'avalanche)',()=>{
 const mem=R.creerMemoire('lot-c');
 const e=jouer(mem,[res(200,{valide:false,stage:'deferred'}),res(201,{valide:false,stage:'deferred'}),res(202),res(206),res(209)]);
 assert.deepEqual(e.map(x=>x.regles.includes('grappe-differes')),[false,false,true,false,false]);
 assert.equal(e[0].aurait,'deja-differe');assert.equal(e[2].zone.grappe.differes,2);assert.equal(e[2].zone.grappe.plusProche,1);
 /* La règle aurait différé 202 : en mode actif, ce différé-là est noté comme tel et ne nourrit pas la grappe suivante. */
 const m2=R.creerMemoire('lot-d');R.noter(m2,res(300,{valide:false}),{differe:true});R.noter(m2,res(301,{valide:false}),{differe:true});
 R.noter(m2,res(302),{differe:true,parRegle:true});
 const x=R.evaluer(m2,res(303));assert.equal(x.zone.grappe.differes,2);assert.equal(x.zone.grappe.plusProche,2);
 R.noter(m2,res(303),{differe:true,parRegle:true});assert.equal(R.evaluer(m2,res(305)).regles.includes('grappe-differes'),false);
});

test('validation en place dans une zone : refusée ; hors zone, rien',()=>{
 const mem=R.creerMemoire('lot-e');jouer(mem,[res(50,{coeurPN:true}),res(51,{coeurPN:true})]);
 assert.ok(R.evaluer(mem,res(52,{deplacementMm:0.4})).regles.includes('zone-validation-en-place'));
 assert.ok(!R.evaluer(R.creerMemoire('lot-f'),res(52,{deplacementMm:0.4})).regles.includes('zone-validation-en-place'));
 assert.ok(!R.evaluer(mem,res(52,{deplacementMm:3})).regles.includes('zone-validation-en-place'));
});

test('un cut que le lot ne valide pas n\'est jamais « à différer » : la règle ne pose rien et ne change pas un différé',()=>{
 const mem=R.creerMemoire('lot-g');jouer(mem,[res(50,{coeurPN:true}),res(51,{coeurPN:true})]);
 const e=R.evaluer(mem,res(52,{valide:false,stage:'deferred'}));assert.equal(e.aurait,'deja-differe');assert.deepEqual(e.regles,[]);
 assert.equal(R.evaluer(mem,res(53,{valide:null})).aurait,'sans-pose');
});

test('écartement de la partie : référence = médiane des lignes valides vues ; un vert à plus de 15 mm est à contrôler, une seule fois',()=>{
 const mem=R.creerMemoire('lot-h');const L=(i,g,s='valid',o={})=>({i,statut:s,operateur:false,vu:false,fraiche:false,ecartementMm:g,...o});
 /* Pas assez de lignes : aucune référence, aucun verdict. */
 assert.equal(R.lignes(mem,[L(1,1470)],{cut:1}).reference.mm,null);
 const rows=[];for(let i=10;i<40;i++)rows.push(L(i,1437+(i%3)));rows.push(L(40,1471),L(45,1452.4),L(42,1420,'invalid'),L(43,1469,'valid',{operateur:true}));
 const r=R.lignes(mem,rows,{cut:42});
 assert.equal(r.reference.mm,1438);assert.ok(r.reference.lignes>=30);
 assert.deepEqual(r.verts.map(v=>[v.i,v.raisons]),[[40,['ecartement']]],'45 est à 14,4 mm : sous le seuil ; 42 est rouge ; 43 a été traité par l\'opérateur');
 assert.equal(r.verts[0].ecartMm,33);
 assert.deepEqual(R.lignes(mem,rows,{cut:43}).verts,[],'déjà signalé : pas deux fois');
});

test('verts dans un PN confirmé : chaque vert de la plage à contrôler est signalé (contrôler chaque cut)',()=>{
 const mem=R.creerMemoire('lot-i');jouer(mem,[res(100,{coeurPN:true}),res(102,{coeurPN:true})]);
 const L=i=>({i,statut:'valid',operateur:false,vu:false,fraiche:false,ecartementMm:1437});
 const r=R.lignes(mem,[94,95,96,97,99,101,103,107,108,109].map(L),{cut:102});
 assert.deepEqual(r.verts.map(v=>v.i),[96,97,99,101,103,107,108]);for(const v of r.verts)assert.deepEqual(v.raisons,['pn']);
});

test('verts d\'une grappe (intérieur et 3 cuts de marge) et voisins d\'un isolé (règles 1 et 2 de Mic)',()=>{
 /* Rouges du lot : 500, 502, 505 (trous de 5 cuts au plus : une grappe de trois) et 520 (isolé). */
 const mem=R.creerMemoire('lot-j');jouer(mem,[res(500),res(502),res(505),res(520)]);
 const L=(i,s='valid')=>({i,statut:s,operateur:false,vu:false,fraiche:false,ecartementMm:1437});
 const r=R.lignes(mem,[496,497,499,501,503,504,506,508,509,519,521,522].map(i=>L(i)),{cut:520});
 const par=Object.fromEntries(r.verts.map(v=>[v.i,v.raisons]));
 for(const i of [501,503,504])assert.deepEqual(par[i],['grappe'],String(i));
 for(const i of [497,499,506,508])assert.deepEqual(par[i],['grappe-marge'],String(i));
 assert.deepEqual(par[519],['isole']);assert.deepEqual(par[521],['isole']);
 for(const i of [496,509,522])assert.equal(par[i],undefined,String(i));
 /* Une paire de rouges n'est ni une grappe ni un isolé : rien autour. */
 const m2=R.creerMemoire('lot-j2');jouer(m2,[res(700),res(702)]);
 assert.deepEqual(R.lignes(m2,[699,701,703].map(i=>L(i)),{cut:702}).verts,[]);
 /* Un rouge pas encore visité (ligne « invalid » de la fenêtre) compte comme rouge. */
 const m3=R.creerMemoire('lot-j3');jouer(m3,[res(800)]);
 const r3=R.lignes(m3,[L(801),L(802,'invalid'),L(803),L(804,'invalid')],{cut:800});assert.deepEqual(r3.verts.map(v=>[v.i,v.raisons[0]]),[[801,'grappe'],[803,'grappe']]);
});

test('événement : jamais de position ; seuils au premier événement seulement',()=>{
 const mem=R.creerMemoire('lot-k');const e=R.evaluer(mem,res(1,{coeurPN:true}));
 const ev=R.evenement(e,{premier:true}),ev2=R.evenement(e,{premier:false});
 assert.ok(ev.seuils&&!ev2.seuils);assert.ok(!/positionSceneRelative|"positions"|bords/.test(JSON.stringify(ev)));
 assert.equal(ev.version,'regles-metier-v1');assert.equal(ev.portee,'cut');
});

test('réglage d\'activation : coupé par défaut, et seule une règle nommée ET activée peut transformer une validation en différé',()=>{
 const S=require('../src/settings.js'),r=S.reglesMetier;
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.regles));assert.equal(r.ombre,true);assert.equal(r.actif,false);
 assert.deepEqual(Object.keys(r.regles).sort(),['grappe-differes','pn-chaque-cut','zone-validation-en-place']);
 for(const v of Object.values(r.regles))assert.equal(v,false);
 const e={aurait:'differer',regles:['pn-chaque-cut']};
 assert.equal(R.doitDifferer(e,r),false,'réglage livré : rien');
 assert.equal(R.doitDifferer(e,{...r,actif:true}),false,'actif sans règle activée : rien');
 assert.equal(R.doitDifferer(e,{...r,actif:true,regles:{...r.regles,'grappe-differes':true}}),false,'une autre règle activée : rien');
 assert.equal(R.doitDifferer(e,{...r,actif:true,regles:{...r.regles,'pn-chaque-cut':true}}),true);
 assert.equal(R.doitDifferer({aurait:'valider',regles:[]},{...r,actif:true,regles:{'pn-chaque-cut':true}}),false);
 assert.equal(R.doitDifferer({aurait:'deja-differe',regles:[]},{actif:true,regles:{'pn-chaque-cut':true}}),false);
});

/* ADV (fiches/DETECTION_ADV.md) : voie fabriquée avec ses deux champignons (dessus à 0, 7 cm vers l'extérieur de chaque pose), le
 * ballast à −16 cm, et ce qu'on veut y ajouter : un rail de plus, le contre-rail d'une courbe, une chaussée de PN, une rampe. */
const tete=y=>(y<=-0.7175+0.0005&&y>=-0.7875)||(y>=0.7175-0.0005&&y<=0.7875);
const voieAvec=extra=>y=>{const e=extra?extra(y):null;return e!=null?e:tete(y)?0:-0.16;};
const surDe=c=>R.surface(c);

test('rail de plus : une aiguille ou la voie qui diverge dans le nuage ; ni le contre-rail d\'une courbe, ni la chaussée d\'un PN, ni une rampe',()=>{
 const voie=surDe(capture(voieAvec()));assert.equal(voie.advRails,0,'voie courante : aucun rail de plus');
 /* Un champignon de 6 cm, côté voie, à 17–23 cm du rail gauche (vu du rail droit : à 1,2 m, hors de la fenêtre). */
 const aiguille=surDe(capture(voieAvec(y=>y>=-0.5475&&y<=-0.4875?0:null)));
 assert.equal(aiguille.advRails,1);assert.deepEqual(aiguille.advCotes.right,[]);assert.equal(aiguille.advCotes.left.length,1);
 const [a,b]=aiguille.advCotes.left[0];assert.ok(a>=16&&a<=18&&b>=23&&b<=24,`bornes ${a}–${b} cm`);
 /* Côté extérieur : le rail de la voie qui diverge, à 25 cm dehors du rail droit. */
 assert.equal(surDe(capture(voieAvec(y=>y>=0.7175+0.25&&y<=0.7175+0.31?0:null))).advRails,1);
 /* Contre-rail de courbe : ornière de 4,5 cm, champignon jusqu'à 10 cm côté voie. Il court sur des centaines de cuts : écarté. */
 assert.equal(surDe(capture(voieAvec(y=>y>=-0.7175+0.045&&y<=-0.7175+0.10?0:null))).advRails,0);
 /* Chaussée d'un PN : tout est au ras, le côté est « plat ». */
 assert.equal(surDe(capture(voieAvec(y=>tete(y)?0:-0.01))).advRails,0);
 /* Rampe (remblai, quai qui monte) côté voie : pas de creux de part et d'autre d'un champignon. */
 assert.equal(surDe(capture(voieAvec(y=>y>0.2&&y<0.7175-0.1?Math.min(0,-0.16+(y-0.2)*0.8):null))).advRails,0);
 /* Rien à lire : pas de verdict. */
 assert.equal(R.railsDePlus({rails:RAILS,pointsSceneRelative:[]}).rails,null);
 /* Tous les points comptent, visibles ou non (la fenêtre d'ESV coupe souvent les rails voisins). */
 const c=capture(voieAvec(y=>y>=-0.5475&&y<=-0.4875?0:null));c.visibleByClipBoxes=c.pointsSceneRelative.map(()=>false);assert.equal(R.surface(c).advRails,1);
 /* Le PN, lui, ne lit que les points visibles : rien ne change pour lui. */
 assert.equal(R.surface(c).sidePoints,0);
});

test('zone d\'ADV : une alerte seule ne suffit pas ; deux à 3 cuts au plus ouvrent la zone ; 30 cuts de marge ; aucun verdict changé',()=>{
 const mem=R.creerMemoire('lot-adv');
 const e=jouer(mem,[res(90),res(100,{advRails:1}),res(102,{advRails:2}),res(108,{advRails:1}),res(115),res(138),res(139),res(160,{advRails:1})]);
 assert.deepEqual(e.map(x=>x.zone.adv),[null,'alerte-non-confirmee','alerte','alerte','marge-apres','marge-apres',null,'alerte-non-confirmee']);
 assert.deepEqual(e[2].zone.advControle,[70,132],'30 cuts avant la première alerte, 30 après la dernière');
 assert.deepEqual(e[3].zone.advControle,[70,138],'la zone grandit tant que les alertes se suivent à 10 cuts au plus');
 assert.equal(e[1].zone.advControle,undefined);
 assert.deepEqual(e.map(x=>x.aurait),Array(8).fill('valider'),'en ombre : la zone d\'ADV ne change aucun verdict');
 for(const x of e)assert.ok(!x.regles.length);
 assert.deepEqual(mem.zonesADV,[{debut:100,fin:108}]);
 /* Deux alertes trop loin l'une de l'autre : jamais de zone. */
 const m2=R.creerMemoire('lot-adv2');assert.deepEqual(jouer(m2,[res(10,{advRails:1}),res(14,{advRails:1})]).map(x=>x.zone.adv),['alerte-non-confirmee','alerte-non-confirmee']);
 /* Capture absente (advRails nul) : pas d'alerte. */
 assert.equal(R.evaluer(R.creerMemoire('x'),res(5,{advRails:null})).zone.adv,null);
 /* Le résumé porte le compte, l'événement aussi ; jamais une position. */
 const s=R.resumer({identity:{part:9,cut:7},valide:true,surface:{advRails:2}});assert.equal(s.advRails,2);
 const ev=R.evenement(R.evaluer(R.creerMemoire('y'),s));assert.equal(ev.surface.advRails,2);assert.ok(!/positionSceneRelative|"positions"|bords/.test(JSON.stringify(ev)));
});

test('verts dans une zone d\'ADV : signalés (`adv`), comme ceux d\'un PN',()=>{
 const mem=R.creerMemoire('lot-adv3');jouer(mem,[res(300,{advRails:1}),res(302,{advRails:1})]);
 const L=i=>({i,statut:'valid',operateur:false,vu:false,fraiche:false,ecartementMm:1437});
 const r=R.lignes(mem,[260,270,290,320,332,340].map(L),{cut:302});
 assert.deepEqual(r.verts.map(v=>[v.i,v.raisons]),[[270,['adv']],[290,['adv']],[320,['adv']],[332,['adv']]]);
});
