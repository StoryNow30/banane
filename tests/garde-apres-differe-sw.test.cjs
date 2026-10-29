'use strict';
/* CH-019 — GARDE « APRÈS UN DIFFÉRÉ » BRANCHÉE dans le lot (background.js, `gardeApresDiffereCommande`), réglage livré (R3, 2 cuts, moins de
 * 2 appuis). Lot des cuts 111 à 116, le 112 différé par le moteur et le lot : 113 et 114 (1 appui, le 111) allaient être validés ; la garde les
 * diffère. Le 115 suit deux cuts différés PAR LA GARDE seulement : il n'est pas différé (pas de cascade), même sans appui. Montage :
 * tests/helpers/garde-apres-differe-lot.cjs. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lotGarde,decisions}=require('./helpers/garde-apres-differe-lot.cjs');

test('garde livrée : 113 et 114 différés après le 112, le 115 validé (un différé de la garde ne compte pas), un événement par cut différé',async()=>{
 const x=await lotGarde();
 assert.deepEqual(x.differes,[112,113,114]);assert.deepEqual(x.valides,[111,115]);
 /* Les cuts différés par la garde passent par « suivant sans décision », comme tout différé ; aucun SKIP, aucune validation de plus. */
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','nextWithoutDecision','capture','nextWithoutDecision','capture','nextWithoutDecision','capture','apply','validate','next','capture','apply']);
 assert.ok(!x.commandes.some(c=>/skip/i.test(String(c.action))),'jamais de SKIP');
 const d=JSON.parse(JSON.stringify(Object.fromEntries(decisions(x.b))));
 for(const c of [113,114]){assert.deepEqual(d[c].command,{action:'defer',reason:'garde-apres-differe'},c);
  assert.deepEqual(d[c].gardeApresDiffere,{regle:'R3',appuis:1,voisinsDifferes:[112],commande:{action:'engine',reason:'first-pass'}});
  assert.equal(x.batch.lotCommands[c].gardeApresDiffere,true);assert.equal(x.batch.lotCommands[c].action,'defer');}
 /* Pas de cascade : le 115 a 0 appui et deux voisins différés, mais par la garde. */
 assert.deepEqual(d[115].anchorsUsed,[]);assert.equal(d[115].command.action,'engine');assert.equal('gardeApresDiffere' in d[115],false);
 assert.equal('gardeApresDiffere' in x.batch.lotCommands[115],false);
 assert.deepEqual(x.gardes.map(e=>({cut:e.identity.cut,part:e.identity.part,regle:e.regle,coupures:e.coupures,appuisMin:e.appuisMin,appuis:e.appuis,voisins:e.voisinsDifferes,etage:e.etage,evitee:e.commandeEvitee,version:e.version})),
  [113,114].map(cut=>({cut,part:23,regle:'R3',coupures:2,appuisMin:2,appuis:1,voisins:[112],etage:'first-pass',evitee:{action:'engine',reason:'first-pass'},version:'garde-apres-differe-1'})));
 /* Racines sans appui (événement `garde-apres-differe-suivant`) : le 115 est validé avec 0 appui ; sans la garde il en avait 2 (borne haute 2,
  * mesuré : tests/garde-apres-differe-coupee-sw.test.cjs joue le même lot, 115 appuyé sur 113 et 114). */
 const suivants=JSON.parse(JSON.stringify(x.b.store.events.filter(e=>e.type==='garde-apres-differe-suivant'))).map(e=>({cut:e.identity.cut,gardes:e.cutsGarde,appuis:e.appuis,max:e.appuisSansGardeMax,action:e.commande.action,parLaGarde:e.differeParLaGarde}));
 assert.deepEqual(suivants,[{cut:114,gardes:[113],appuis:1,max:2,action:'defer',parLaGarde:true},{cut:115,gardes:[113,114],appuis:0,max:2,action:'engine',parLaGarde:false},
  {cut:116,gardes:[113,114],appuis:1,max:2,action:'engine',parLaGarde:false}]);
});
