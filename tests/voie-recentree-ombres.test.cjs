'use strict';
/* 5.0 (audit 5.0, I8) — MODULE COMMUN « RECENTRER SUR LA VOIE » (src/voie-recentree.js) : LES DEUX OMBRES, sur le vrai moteur (suite de
 * tests/voie-recentree.test.cjs, séparée pour tenir sous le délai de 20 s par fichier de verify).
 *
 * La règle prudente de la voie prédite (D-147) et la mémoire des différés G1 (b) (D-148) sont la même mécanique : le moteur
 * relancé sur des rails translatés sur une voie prédite, puis le minimum unique à 15 mm. Le module rend la décision qu'aurait
 * prise le moteur recentré, la confiance, l'écart à la voie, la profondeur de chaîne et le geste de vue qu'il AURAIT fallu.
 * Il ne commande rien. Données synthétiques : la fixture de tools/rejeu-voie-predite.cjs (voie droite fabriquée) et celle
 * de tests/fixtures.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../src/voie-recentree.js'),L=require('../src/lot-decision.js'),K=require('../src/core.js'),Shadow=require('../src/gcv1-shadow.js');
const R=require('../tools/rejeu-voie-predite.cjs');
const SIDES=['left','right'];

/* Fixture : cuts 1 à 3 posés seuls (appuis), cuts 4 à 7 avec toute la voie décalée de 230 mm (hors de la fenêtre du
 * moteur et de la vue d'ESV). La vérité est connue : 230 mm du côté opposé au décalage. */
const fx=R.fixtureSynthetique();
const cap=c=>fx.captures.get(c);
const entree=c=>({identity:K.completeIdentity(cap(c).identity),rails:cap(c).rails,pointsSceneRelative:cap(c).pointsSceneRelative,visibleByClipBoxes:cap(c).visibleByClipBoxes});
const sciences=new Map();const science=c=>{if(!sciences.has(c))sciences.set(c,Shadow.scientificProposeBoth(cap(c)));return sciences.get(c);};
const runtime=c=>Shadow.toRuntimeRails(science(c));
/* Appuis réels : les cuts 1 à 3 posés par le moteur seul. */
const posee=c=>{const e=K.expectedPoses({rails:cap(c).rails},runtime(c));return {identity:{part:1,cut:c,frameId:'f-synth'},positions:Object.fromEntries(SIDES.map(s=>[s,e[s].positionSceneRelative])),stage:'first-pass'};};
const appuisReels=[1,2,3].map(posee);

test('ombre d\'Orbite : un événement par différé, la chaîne de l\'ombre ne vit que dans sa mémoire ; rien de ce qui est lu ne change',{timeout:60000},()=>{
 const mem=V.creerMemoire('lot-synth'),evts=[];
 for(const c of [1,2,3])V.noterDecisionReelle(mem,entree(c).identity,{stage:'first-pass',anchorsUsed:[]});
 for(const c of [4,5,6,7]){
  const ent=entree(c),capture={...ent,camera:cap(c).camera,viewCaptures:cap(c).viewCaptures};
  /* Décision réelle du lot (appuis réels seulement) : reprise refusée par la vue (4 à 6), puis plus d'appui (7). */
  const reelle=L.decideCut({capture:ent,science:science(c),anchors:appuisReels,Shadow});
  const avant=JSON.stringify({capture,sci:science(c),appuisReels,reelle,run:runtime(c)});
  const {evenement}=V.evaluerDiffere({mem,capture,science:science(c),ancresReelles:appuisReels,decisionReelle:reelle,commandeReelle:{action:'engine',reason:'hors-vue-left'},
   Shadow,runtimeRails:runtime(c),before:cap(c).rails,expectedPoses:K.expectedPoses});
  assert.equal(JSON.stringify({capture,sci:science(c),appuisReels,reelle,run:runtime(c)}),avant,'rien de ce qui est lu n\'est modifié');
  evts.push(evenement);
 }
 assert.deepEqual(evts.map(e=>e.reel.stage),['window','window','window','deferred']);
 assert.deepEqual(evts.map(e=>e.etage),['window','window','window','window'],'en série : le cut 7 a pour appuis les poses de l\'ombre');
 assert.deepEqual(evts.map(e=>e.verdict.posable),[true,true,true,true],JSON.stringify(evts.map(e=>e.verdict)));
 assert.deepEqual(evts.map(e=>e.profondeur),[1,2,3,4]);
 assert.deepEqual(evts.map(e=>e.appuisOmbre),[[],[4],[5,4],[6,5]]);
 assert.deepEqual(evts.map(e=>e.recalcule),[true,true,true,true]);
 for(const e of evts){
  assert.equal(e.vue.geste,'dezoom');assert.ok(SIDES.every(s=>Math.abs(e.poseMm[s][1]+230)<5));assert.ok(Number.isFinite(e.confiance.left)&&e.confiance.left>=55);
  assert.ok(Number.isFinite(e.ecartVoieMm)&&e.ecartVoieMm<=15);
  /* Aucune position de scène : seulement des décalages (mm), des numéros de cut, des comptes. */
  assert.deepEqual(Object.keys(e).sort(),['appuis','appuisOmbre','confiance','ecartVoieMm','ecartementVoisinMm','etage','identity','poseMm','profondeur','raison','recalcule','reel','verdict','version','vue']);
  assert.ok(!/positionSceneRelative|"positions"/.test(JSON.stringify(e)));
 }
 /* La mémoire de l'ombre est la seule chose modifiée : les appuis réels n'ont pas bougé. */
 assert.deepEqual(appuisReels.map(a=>a.identity.cut),[1,2,3]);assert.deepEqual(mem.poses.map(p=>p.identity.cut),[4,5,6,7]);
 /* Un cut différé sans appui ni pose d'ombre proche : pas de relance du moteur, verdict dit pourquoi. */
 const mem2=V.creerMemoire('autre');let appels=0;const espion={...Shadow,scientificProposeBoth:x=>{appels++;return Shadow.scientificProposeBoth(x);}};
 const seul=V.evaluerDiffere({mem:mem2,capture:{...entree(7),camera:cap(7).camera,viewCaptures:cap(7).viewCaptures},science:science(7),ancresReelles:[],
  decisionReelle:{stage:'deferred',reason:'no-anchor',anchorsUsed:[]},Shadow:espion,runtimeRails:runtime(7),before:cap(7).rails,expectedPoses:K.expectedPoses}).evenement;
 assert.equal(appels,0);assert.equal(seul.recalcule,false);assert.deepEqual(seul.verdict,{posable:false,raison:'differe:no-anchor'});assert.equal(seul.poseMm,null);
});

test('ombre de l\'Écho : moteur recentré sur la voie des corrections de l\'opérateur ; l\'entrée ne porte pas la référence humaine',{timeout:60000},()=>{
 /* Cut 6 : l'opérateur a corrigé 4 et 5 (vérité). */
 const vrai=c=>{const capC=cap(c);return Object.fromEntries(SIDES.map(s=>[s,R.positionMic(capC.rails[s],[0,-230,0])]));};
 const validees=[4,5].map((c,i)=>({identity:{part:1,cut:c,frameId:'f-synth'},visitIndex:i+1,positions:vrai(c)}));
 const ent={identity:entree(6).identity,rails:cap(6).rails,points:cap(6).pointsSceneRelative,visible:cap(6).visibleByClipBoxes};
 const {evenement:e}=V.evaluerEcho({entree:ent,differes:[4,5,6,7],validees,Shadow});
 assert.equal(e.version,'memoire-differes-ombre-v1');assert.equal(e.frontiere,'avant-reference');assert.equal(e.etat,'calcule');
 assert.ok(['window','choice'].includes(e.etage),e.etage);assert.equal(e.verdict.posable,true);assert.deepEqual(e.appuis,[5,4]);assert.deepEqual(e.memoire.cuts,[5,4]);
 for(const s of SIDES)assert.ok(Math.abs(e.poseMm[s][1]+230)<5,`${s} : ${e.poseMm[s]}`);
 assert.ok(!/positionSceneRelative|"positions"/.test(JSON.stringify(e)));
 /* Sans mémoire : rien n'est calculé (le moteur n'est pas appelé). */
 let appels=0;const espion={...Shadow,scientificProposeBoth:x=>{appels++;return Shadow.scientificProposeBoth(x);}};
 const vide=V.evaluerEcho({entree:ent,differes:[4,5,6,7],validees:[],Shadow:espion}).evenement;
 assert.equal(appels,0);assert.equal(vide.etat,'sans-memoire');assert.deepEqual(vide.verdict,{posable:false,raison:'sans-memoire'});
});
