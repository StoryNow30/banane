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
 assert.deepEqual(plagesDe(s),[[1652,1667],[5936,5940],[6000,6003],[6608,6620]]);
 assert.deepEqual(s.plages.map(p=>p.motifs),[['pn'],['a-controler'],['a-controler'],['adv']]);
 assert.equal(s.cuts.length,16+5+4+13);
 const c=cutsDe(s);assert.deepEqual(c,[...c].sort((a,b)=>a-b),'dans l’ordre des cuts');
 /* 6000 et 6003 : deux cuts d'écart, fusionnés (on ne laisse pas de trou de moins de 3 cuts). */
 assert.equal(s.plages[2].libelle,'à contrôler 6000–6003');
});

test('D-172 : les cuts 0 à 3 d’une partie ne sont jamais exclus ; bornes 0 et total − 1',()=>{
 const s=R.selection({partie:1,lot:[{cut:1,differe:false},{cut:0,differe:false}],total:500,zonesPN:[[495,510]]});
 assert.deepEqual(plagesDe(s),[[0,2],[495,499]]);
 assert.deepEqual(cutsDe(s).slice(0,2),[2,495],'0 et 1 sont des cuts du lot (traversés), 2 est relu');
 const t=R.selection({partie:1,lot:[{cut:2,differe:true}]});
 assert.deepEqual(cutsDe(t),[0,1,2,3,4]);
});

test('plafond de cuts : plages entières, par priorité (PN, ADV, grappe, différé, isolé, à contrôler), puis ordre des cuts',()=>{
 const entree={partie:29,lot:[{cut:323,differe:false}],zonesPN:[[1652,1667]],aControler:[[100,104]]};
 const s=R.selection(entree,{plafondCuts:18});
 assert.deepEqual(plagesDe(s),[[322,324],[1652,1667]],'PN (16) puis isolé (2) ; « À contrôler » (5) ne tient plus');
 assert.deepEqual(s.horsPlafond.map(p=>[p.debut,p.fin,p.raison]),[[100,104,'plafond-cuts']]);
 assert.equal(s.total,18);
 assert.equal(s.tempsEstimeS,Math.round(18*R.DEFAULTS.tempsParCutS+1*R.DEFAULTS.tempsTraverseS));
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
 assert.deepEqual(j.hauteurApprise,{left:4,right:0});
 assert.equal(j.verdict,'je laisserais','4 mm reste sous le seuil');
});

test('skipOmbre (D-172) : « aucun-point » si la capture n’a aucun point ; scanners illisibles, jamais inventés',()=>{
 const c=capture();
 assert.deepEqual(R.skipOmbre(c),{raison:null,points:{left:2322,right:2442},scanners:null,scannersLisibles:false});
 const vide={...c,pointsSceneRelative:[],quality:{...c.quality,retained:0,perRail:{left:0,right:0}}};
 assert.equal(R.skipOmbre(vide).raison,'aucun-point');
 assert.equal(R.skipOmbre(null).raison,null);
 /* Un seul rail sans point n'est pas « aucun point affiché ». */
 assert.equal(R.skipOmbre({...c,quality:{...c.quality,perRail:{left:0,right:12}}}).raison,null);
});

test('skipOmbre (D-172) : « un-seul-scanner » seulement si les points portent leur source (pointSourceID), jamais deviné',()=>{
 const c=capture(),n=c.pointsSceneRelative.length;
 const un={...c,attributes:{...c.attributes,pointSourceID:new Array(n).fill(7)}};
 assert.deepEqual(R.skipOmbre(un),{raison:'un-seul-scanner',points:{left:2322,right:2442},scanners:1,scannersLisibles:true});
 const deux={...c,attributes:{...c.attributes,pointSourceID:Array.from({length:n},(_,i)=>i%3?7:9)}};
 assert.equal(R.skipOmbre(deux).raison,null);assert.equal(R.skipOmbre(deux).scanners,2);
 /* Les points cachés par la boîte de découpe ne comptent pas : le seul point du second scanner est caché. */
 const cache={...c,visibleByClipBoxes:Array.from({length:n},(_,i)=>i!==0),attributes:{...c.attributes,pointSourceID:Array.from({length:n},(_,i)=>i===0?9:7)}};
 assert.equal(R.skipOmbre(cache).raison,'un-seul-scanner');
 /* Attribut de longueur différente des points : illisible. */
 assert.equal(R.skipOmbre({...c,attributes:{pointSourceID:[1]}}).scannersLisibles,false);
});

test('le module ne commande rien : aucune référence à une commande d’ESV ni à chrome',()=>{
 const src=require('node:fs').readFileSync(require.resolve('../src/relecture-ombre.js'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 for(const mot of ['apply','validateAndNext','skipAndNext','validateInPlace','chrome.','XMLHttpRequest','fetch('])assert.ok(!src.includes(mot),mot);
});
