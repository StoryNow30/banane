'use strict';
/* 5.0 (D-170, D-171, D-172) — RELECTURE APRÈS LE LOT, EN OMBRE : le module pur (src/relecture-ombre.js).
 *  - La sélection des cuts à relire, selon la méthode de Mic (fiches/METHODE_MIC_P29.md) : cut isolé (le cut d'avant et le cut
 *    d'après), grappe (toute la plage, sans trou, marges comprises), différé (ses abords), PN et ADV (zones déjà marginées par les
 *    règles métier), liste « À contrôler ». Ordonnée par plages, dans l'ordre des cuts ; plafond de cuts, plages entières.
 *  - D-172 : les premiers cuts d'une partie ne sont jamais exclus.
 *  - Le calcul de ce qu'Ariane donnerait sur un cut : écart par rail (latéral, vertical) à la pose actuelle d'ESV, verdict, raison,
 *    et `skipOmbre` (aucun point affiché ; un seul scanner : illisible dans la capture, jamais inventé). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../src/relecture-ombre.js');
const {base,K}=require('./fixtures.cjs');
const C=require('../vendor/capture-core.js');
const plagesDe=s=>s.plages.map(p=>[p.debut,p.fin]);
const cutsDe=s=>s.cuts.map(c=>c.cut);

test('cut isolé : le cut d’avant et le cut d’après ; le cut du lot est traversé, pas relu',()=>{
 const s=R.selection({partie:29,lot:[{cut:323,differe:false}]});
 assert.deepEqual(plagesDe(s),[[322,324]]);
 assert.deepEqual(cutsDe(s),[322,324]);
 assert.deepEqual(s.plages[0].motifs,['isole']);
 assert.deepEqual(s.plages[0].traverses,[323]);
 assert.equal(s.cuts[0].role,'vert');
});

test('grappe : toute la plage, marges de 3 comprises, sans trou ; les cuts posés du lot sont traversés',()=>{
 const s=R.selection({partie:29,lot:[456,458,460,463,468].map(cut=>({cut,differe:false}))});
 assert.deepEqual(plagesDe(s),[[453,471]]);
 assert.deepEqual(s.plages[0].motifs,['grappe']);
 const attendu=[];for(let c=453;c<=471;c++)if(![456,458,460,463,468].includes(c))attendu.push(c);
 assert.deepEqual(cutsDe(s),attendu);
});

test('différé : ses abords (2 cuts) et le différé lui-même, relu avec le rôle « différé »',()=>{
 const s=R.selection({partie:8,lot:[{cut:899,differe:true}]});
 assert.deepEqual(plagesDe(s),[[897,901]]);
 assert.deepEqual(cutsDe(s),[897,898,899,900,901]);
 assert.equal(s.cuts.find(c=>c.cut===899).role,'differe');
 assert.ok(s.plages[0].motifs.includes('differe'));
});

test('PN, ADV et « À contrôler » : la plage entière, chaque cut ; ordre des cuts ; fusion des plages proches',()=>{
 const s=R.selection({partie:29,zonesPN:[[1652,1667]],zonesADV:[[6608,6620]],aControler:[[5936,5940],6000,6003]});
 assert.deepEqual(plagesDe(s),[[1652,1667],[5936,5940],[6000,6000],[6003,6003],[6608,6620]]);
 assert.deepEqual(s.plages.map(p=>p.motifs),[['pn'],['a-controler'],['a-controler'],['a-controler'],['adv']]);
 assert.equal(s.cuts.length,16+5+2+13);assert.deepEqual(s.parZone,{pn:16,adv:13,abords:0,'vert-hors-zone':7,ecartement:0});
 const c=cutsDe(s);assert.deepEqual(c,[...c].sort((a,b)=>a-b),'dans l’ordre des cuts');
 /* 6000 et 6003 : comme l'étude, aucun cut ajouté pour boucher le trou (6001 et 6002 ne sont pas relus). */
 assert.equal(s.plages[2].libelle,'à contrôler 6000');
});

test('D-172 : les cuts 0 à 3 d’une partie ne sont jamais exclus ; bornes 0 et total − 1',()=>{
 const s=R.selection({partie:1,lot:[{cut:1,differe:false},{cut:0,differe:false}],total:500,zonesPN:[[495,510]]});
 assert.deepEqual(plagesDe(s),[[0,2],[495,499]]);
 assert.deepEqual(cutsDe(s).slice(0,2),[2,495],'0 et 1 sont des cuts du lot (traversés), 2 est relu');
 const t=R.selection({partie:1,lot:[{cut:2,differe:true}]});
 assert.deepEqual(cutsDe(t),[0,1,2,3,4]);
});

test('plafond de cuts : PN hors budget ; les autres plages entières, par priorité (ADV, grappe, différé, isolé, à contrôler), puis ordre des cuts',()=>{
 const entree={partie:29,lot:[{cut:323,differe:false}],zonesPN:[[1652,1667]],aControler:[[100,104]]};
 const s=R.selection(entree,{plafondCuts:5});
 assert.deepEqual(plagesDe(s),[[322,324],[1652,1667]],'PN (16, hors budget) et isolé (2) ; « À contrôler » (5) ne tient plus dans les 3 restants');
 assert.deepEqual(s.horsPlafond.map(p=>[p.debut,p.fin,p.raison]),[[100,104,'plafond-cuts']]);
 assert.equal(s.total,18);
 assert.equal(s.tempsEstimeS,Math.round(18*R.DEFAULTS.tempsParCutS+1*R.DEFAULTS.tempsTraverseS));
 assert.deepEqual(plagesDe(R.selection(entree,{plafondCuts:18})),[[100,104],[322,324],[1652,1667]],'avec 18 : tout tient (le PN ne compte pas)');
 /* Une seule plage plus grande que le plafond : elle est coupée (on garde son début) plutôt que rien. */
 const u=R.selection({partie:29,zonesADV:[[1000,1099]]},{plafondCuts:30});
 assert.deepEqual(plagesDe(u),[[1000,1029]]);assert.equal(u.horsPlafond[0].raison,'plafond-cuts');assert.deepEqual([u.horsPlafond[0].debut,u.horsPlafond[0].fin],[1030,1099]);
});

test('entrée vide ou invalide : sélection vide, aucune exception',()=>{
 for(const e of [undefined,{},{lot:[{cut:-1}],zonesPN:[[5,'x']],aControler:['a',null]}]){
  const s=R.selection(e);assert.equal(s.total,0);assert.deepEqual(s.plages,[]);}
});

/* ----------------------------------------------------------------- calcul */
const capture=()=>K.clone(base);
/* Position d'un rail décalée de [long, lat, vert] mm dans son repère profil. */
const decale=(rail,mm)=>{const o=C.point(rail.sceneRelativeToProfileLocal,rail.positionSceneRelative);
 return C.point(rail.profileLocalToSceneRelative,[o[0]+mm[0]/1000,o[1]+mm[1]/1000,o[2]+mm[2]/1000]);};

test('juger : écart latéral et vertical par rail, « je corrigerais » au-delà du seuil, raison lisible',()=>{
 const c=capture();
 const decision={stage:'window',positions:{left:decale(c.rails.left,[0,12,0]),right:decale(c.rails.right,[0,0.5,-1])}};
 const j=R.juger({capture:c,decision,science:null});
 assert.equal(j.ecartMm.left.lat,12);assert.equal(j.ecartMm.left.vert,0);
 assert.equal(j.ecartMm.right.lat,0.5);assert.equal(j.ecartMm.right.vert,-1);
 assert.equal(j.verdict,'je corrigerais');assert.match(j.raison,/rail gauche.*latéral 12 mm/);
 assert.equal(j.pireMm,12);assert.equal(j.etage,'window');
 assert.ok(Array.isArray(j.poseActuelle.left)&&Array.isArray(j.poseCalculee.right));
});

test('juger : sous le seuil, « je laisserais » ; sans pose calculée, « je laisserais » avec le motif',()=>{
 const c=capture();
 const ok=R.juger({capture:c,decision:{stage:'first-pass',positions:{left:decale(c.rails.left,[0,1,2]),right:decale(c.rails.right,[0,-2,1])}}});
 assert.equal(ok.verdict,'je laisserais');assert.match(ok.raison,/sous le seuil de 5 mm/);
 const sans=R.juger({capture:c,decision:{stage:'deferred',reason:'no-anchor'}});
 assert.equal(sans.verdict,'je laisserais');assert.equal(sans.poseCalculee,null);assert.equal(sans.ecartMm,null);
 assert.match(sans.raison,/aucune pose sûre.*no-anchor/);
});

test('juger : la hauteur apprise corrige la pose calculée (pose « corrigee » de la décision), et le dit',()=>{
 const c=capture(),left=decale(c.rails.left,[0,0,0]),right=decale(c.rails.right,[0,0,0]);
 const decision={stage:'window',positions:{left,right},hauteurApprise:{version:'hauteur-apprise-v1',rails:{
  left:{correctionMm:4,corrigee:decale(c.rails.left,[0,0,4])},right:{correctionMm:0,abstention:null}}}};
 const j=R.juger({capture:c,decision});
 assert.equal(j.ecartMm.left.vert,4);assert.equal(j.ecartMm.right.vert,0);
 assert.deepEqual(j.hauteurMm,{left:4,right:0});
 assert.equal(j.verdict,'je laisserais','4 mm reste sous le seuil');
});

test('skipOmbre (D-172) : « aucun-point » seulement après deux captures complètes vides ; jamais « un seul scanner »',()=>{
 const c=capture(),vide={...c,pointsSceneRelative:[],quality:{...c.quality,retained:0,perRail:{left:0,right:0}}};
 assert.deepEqual(R.skipOmbre([c]),{raison:null,points:{left:2322,right:2442},captures:1,capturesVides:0});
 assert.equal(R.skipOmbre([vide]).raison,null,'une seule capture vide ne suffit pas (visites brèves de l’étude)');
 assert.deepEqual(R.skipOmbre([vide,vide]),{raison:'aucun-point',points:{left:0,right:0},captures:2,capturesVides:2});
 assert.equal(R.skipOmbre([vide,c]).raison,null,'la seconde capture a des points');
 assert.equal(R.captureVide(vide),true);assert.equal(R.captureVide(c),false);
 /* Un seul rail sans point n'est pas « aucun point affiché ». */
 const unRail={...c,quality:{...c.quality,perRail:{left:0,right:12}}};assert.equal(R.skipOmbre([unRail,unRail]).raison,null);
 /* Les points d'un seul scanner (attribut de source) ne font jamais un SKIP : ce n'est pas mesurable dans ESV. */
 const unScanner={...c,attributes:{...c.attributes,pointSourceID:new Array(c.pointsSceneRelative.length).fill(7)}};
 assert.equal(R.skipOmbre([unScanner,unScanner]).raison,null);
 assert.equal(R.skipOmbre(null).raison,null);
 assert.ok(!/un-seul-scanner/.test(require('node:fs').readFileSync(require.resolve('../src/relecture-ombre.js'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'')));
});

test('sélection alignée sur l’étude : hors grappe, chaque cut du lot avec ses voisins (sans boucher le trou) ; zone de chaque cut par ordre pn, adv, abords, liste',()=>{
 /* Deux cuts du lot à 4 cuts l'un de l'autre (paire, pas une grappe) : 9, 11 et 13, 15 ; 12 n'est pas relu. */
 const s=R.selection({partie:1,lot:[{cut:10},{cut:14}]});
 assert.deepEqual(cutsDe(s),[9,11,13,15]);
 /* Une plage qui touche un PN : chaque cut garde son type (abords hors du PN, pn dedans) ; c'est le type qui dit si l'on corrige. */
 const t=R.selection({partie:1,lot:[{cut:10},{cut:14}],zonesPN:[[16,20]],aControler:[21]});
 assert.deepEqual(s.cuts.map(c=>c.zone),['abords','abords','abords','abords']);
 assert.deepEqual(t.cuts.filter(c=>c.cut>=13).map(c=>[c.cut,c.zone]),[[13,'abords'],[15,'abords'],[16,'pn'],[17,'pn'],[18,'pn'],[19,'pn'],[20,'pn'],[21,'vert-hors-zone']]);
 /* Marges du fichier proposé (bloc `selection`) : options de la sélection. */
 assert.deepEqual(R.optionsSelection({grappeMin:3,trouCuts:5,margeGrappe:3,margeIsole:1,margeDiffere:2}),{grappe:{min:3,trouCuts:5,marge:3},isole:{marge:1},differe:{marge:2}});
 const u=R.selection({partie:1,lot:[{cut:50,differe:true}]},R.optionsSelection({margeDiffere:4,margeIsole:0}));assert.deepEqual(cutsDe(u),[46,47,48,49,50,51,52,53,54]);
});

test('juger : variante « +h » (défaut) ajoute la hauteur sur l’axe vertical de la pose d’ESV ; sans « +h », la décision seule ; confiance A* même pour un rail S1',()=>{
 const c=capture(),decision={stage:'window',positions:{left:decale(c.rails.left,[0,0,0]),right:decale(c.rails.right,[0,0,0])},hauteurApprise:{rails:{left:{correctionMm:-3},right:{correctionMm:0}}}};
 const science={rails:{left:{s1Changed:true,astar:{confidence:66}},right:{astar:{confidence:71}}}};
 const h=R.juger({capture:c,decision,science});assert.equal(h.ecartMm.left.vert,-3);assert.deepEqual(h.hauteurMm,{left:-3,right:0});
 assert.deepEqual(h.confiance,{left:66,right:71});assert.deepEqual(h.s1,{left:true,right:false});
 const sans=R.juger({capture:c,decision,science,hauteur:false});assert.equal(sans.ecartMm.left.vert,0);assert.equal(sans.hauteurMm,null);
});

test('le module ne commande rien : aucune référence à une commande d’ESV ni à chrome',()=>{
 const src=require('node:fs').readFileSync(require.resolve('../src/relecture-ombre.js'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 for(const mot of ['apply','validateAndNext','skipAndNext','validateInPlace','chrome.','XMLHttpRequest','fetch('])assert.ok(!src.includes(mot),mot);
});

test('H5 (audit P-5) : verts à plus de 15 mm de la médiane hors plage, en zone « ecartement » (ombre) ; un cut déjà dans une plage garde sa zone',()=>{
 const s=R.selection({partie:9,lot:[{cut:100}],zonesPN:[[200,210]],ecartement:[101,205,7047,7048,7049]});
 const z=Object.fromEntries(s.cuts.map(c=>[c.cut,c.zone]));
 assert.equal(z[101],'abords','101 est déjà aux abords du cut 100');assert.equal(z[205],'pn');
 for(const c of [7047,7048,7049])assert.equal(z[c],'ecartement');
 assert.equal(s.plages.at(-1).libelle,'écartement 7047–7049');assert.equal(s.parZone.ecartement,3);
 /* Plafond : passent après tout le reste. */
 const t=R.selection({partie:9,lot:[{cut:100}],ecartement:[7047]},{plafondCuts:2});assert.deepEqual(t.horsPlafond.map(p=>p.debut),[7047]);
});

/* Revue (F4) : l'écart brut est rendu à côté de l'écart arrondi pour l'affichage. */
test('juger : écart brut (`ecartBrutMm`) à côté de l’écart arrondi ; ecartRail brut sur demande',()=>{
 const c=capture(),decision={stage:'window',positions:{left:decale(c.rails.left,[0,7.95,0]),right:decale(c.rails.right,[0,7.95,0])}};
 const j=R.juger({capture:c,decision});
 assert.equal(j.ecartMm.left.lat,8);assert.ok(Math.abs(j.ecartBrutMm.left.lat-7.95)<1e-6,String(j.ecartBrutMm.left.lat));
 const b=R.ecartRail(c.rails.left,decision.positions.left,{brut:true});assert.ok(Math.abs(b.lat-7.95)<1e-6);
});

/* Revue (correction 7) : un PN n'est jamais coupé par le plafond. Les plages sont découpées par type de zone avant le plafond ; les PN
 * sont hors du budget, gardés entiers ; le budget sert ensuite les autres zones par priorité. */
test('plafond par zone : PN 401–414 dans une ADV 256–689, plafond 120 : les 14 cuts du PN relus ; deux PN gardés entiers avant toute grappe d’abords',()=>{
 const s=R.selection({partie:1,zonesADV:[[256,689]],zonesPN:[[401,414]]},{plafondCuts:120});
 const pn=[];for(let c=401;c<=414;c++)pn.push(c);
 assert.deepEqual(s.cuts.filter(c=>c.zone==='pn').map(c=>c.cut),pn,'le PN entier');
 assert.ok(s.plages.some(p=>p.zone==='pn'&&p.debut===401&&p.fin===414),'le PN est sa propre plage');
 assert.ok(s.cuts.filter(c=>c.zone!=='pn').length<=120,'le budget ne compte que les autres zones');
 assert.ok(s.plages.every(p=>s.cuts.filter(c=>c.cut>=p.debut&&c.cut<=p.fin).every(c=>c.zone===p.zone)),'une plage, un type de zone');
 const t=R.selection({partie:1,lot:[{cut:900},{cut:902},{cut:904}],zonesADV:[[256,689]],zonesPN:[[50,60],[401,414]]},{plafondCuts:20});
 const pnT=t.cuts.filter(c=>c.zone==='pn').map(c=>c.cut);
 assert.deepEqual(pnT,[50,51,52,53,54,55,56,57,58,59,60,...pn],'les deux PN entiers, au-delà du plafond');
 assert.equal(t.cuts.filter(c=>c.zone==='abords').length,0,'la grappe d’abords ne passe qu’après');
 assert.ok(t.horsPlafond.some(p=>p.debut===897&&p.fin===907),'grappe 897–907 hors plafond');
 assert.equal(t.cuts.filter(c=>c.zone!=='pn').length,20);
 assert.equal(t.plafondCuts,20);
});

/* D-180 : le plafond est PAR ZONE. Avant, un budget unique servi par priorité laissait l'ADV (329 verts jugeables sur les parties
 * d'apprentissage) manger presque tout et les abords (223) presque rien. Maintenant chaque zone (ADV, abords, vert hors zone,
 * écartement) a son budget ; le PN reste hors budget, jamais coupé. */
test('plafond par zone : l’ADV ne mange plus le budget des abords ; PN jamais coupé ; plages entières par priorité dans la zone ; la première trop grande est coupée à son début',()=>{
 const entree={partie:1,lot:[{cut:900},{cut:902},{cut:904},{cut:1100,differe:true}],zonesADV:[[256,689]],zonesPN:[[401,414]],aControler:[[1500,1509]]};
 const s=R.selection(entree,{plafondParZone:{adv:60,abords:30,'vert-hors-zone':4,ecartement:0}});
 const nb=z=>s.cuts.filter(c=>c.zone===z).length;
 assert.equal(nb('pn'),14,'PN entier, hors budget');
 assert.equal(nb('adv'),60,'ADV coupée à son budget (le début de la plage)');
 assert.deepEqual(s.cuts.filter(c=>c.zone==='adv').map(c=>c.cut).slice(0,2),[256,257]);
 assert.ok(nb('abords')>0&&nb('abords')<=30,'les abords ont leur budget, même avec une ADV de 434 cuts');
 assert.deepEqual(s.cuts.filter(c=>c.zone==='abords').map(c=>c.cut).filter(c=>c>=897&&c<=907).length>0,true,'grappe 897–907 gardée (priorité grappe)');
 assert.equal(nb('vert-hors-zone'),4,'liste « À contrôler » coupée à 4');
 assert.ok(s.horsPlafond.some(p=>p.debut===316&&p.fin===400)&&s.horsPlafond.some(p=>p.debut===415&&p.fin===689),'reste de l’ADV (de part et d’autre du PN) rendu hors plafond');
 assert.ok(s.horsPlafond.some(p=>p.debut===1504&&p.fin===1509),'reste de la liste rendu hors plafond');
 assert.deepEqual(s.plafondParZone,{adv:60,abords:30,'vert-hors-zone':4,ecartement:0});
 /* Sans plafond de zone (null) : tout est relu, comme l'étude. */
 const t=R.selection(entree,{plafondParZone:{adv:null,abords:null,'vert-hors-zone':null,ecartement:null}});
 assert.equal(t.cuts.filter(c=>c.zone==='adv').length,420,'434 cuts d’ADV moins les 14 du PN');assert.equal(t.horsPlafond.length,0);
 /* Le budget d'une zone ne sert jamais une autre : abords seuls à 6, ADV à 0 (aucune ligne ADV), PN intact. */
 const u=R.selection(entree,{plafondParZone:{adv:0,abords:6,'vert-hors-zone':null,ecartement:null}});
 assert.equal(u.cuts.filter(c=>c.zone==='adv').length,0);assert.equal(u.cuts.filter(c=>c.zone==='pn').length,14);
 assert.ok(u.cuts.filter(c=>c.zone==='abords').length<=6);
 /* Le plafond global (réglage de rythme) reste possible : il joue après ceux des zones, PN toujours hors budget. */
 const v=R.selection(entree,{plafondParZone:{adv:60,abords:30,'vert-hors-zone':4,ecartement:0},plafondCuts:20});
 assert.equal(v.cuts.filter(c=>c.zone!=='pn').length<=20,true);assert.equal(v.cuts.filter(c=>c.zone==='pn').length,14);
});

test('plafond par zone : valeurs par défaut (mesurées, fiche § 11) — chaque zone a un budget fini, le PN aucun',()=>{
 const d=R.DEFAULTS.plafondParZone;
 assert.ok(d&&!('pn' in d),'le PN n’a pas de budget');
 assert.deepEqual(JSON.parse(JSON.stringify(d)),{adv:40,abords:70,'vert-hors-zone':20,ecartement:20});
 assert.equal(R.DEFAULTS.plafondCuts,null,'plus de budget unique par défaut');
 /* La passe d'une partie reste de l'ordre de la dizaine de minutes : PN (hors budget) + 150 cuts hors PN au plus, à 3,5 s le cut. */
 assert.ok(Object.values(d).reduce((a,b)=>a+b,0)*3.5/60<=12,'au plus 12 minutes de cuts hors PN');
 /* Appliqués sans option : une ADV de 434 cuts (PN 401–414 dedans) et une grappe d'abords de 11 cuts. */
 const s=R.selection({partie:1,lot:[{cut:900},{cut:902},{cut:904}],zonesADV:[[256,689]],zonesPN:[[401,414]]});
 assert.equal(s.cuts.filter(c=>c.zone==='pn').length,14);assert.equal(s.cuts.filter(c=>c.zone==='adv').length,40);assert.equal(s.cuts.filter(c=>c.zone==='abords').length,8);
});
