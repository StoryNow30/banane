'use strict';
/* CH-019 — GARDE « APRÈS UN DIFFÉRÉ » BRANCHÉE dans le lot (background.js, `gardeApresDiffereCommande`), réglage livré (R3, 2 cuts, moins de
 * 2 appuis). Lot des cuts 111 à 116, le 112 différé par le moteur et le lot : 113 (1 appui, le 111) allait être validé ; la garde le diffère.
 * Définitions de CH-015 (confirmées par CH-015 le 29/10) : un différé de la garde n'est pas un « précédent différé », et les appuis comptent TELS
 * QUE SANS LA GARDE (le 113 est rendu au compte du 114 : 1 mesuré + 1 = 2) ; sinon la règle s'alimenterait d'elle-même (CH-015 : 254 posés de
 * plus différés sur la partie 20). Le 114 est donc validé, avec 1 appui mesuré. Montage : tests/helpers/garde-apres-differe-lot.cjs. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lotGarde,decisions}=require('./helpers/garde-apres-differe-lot.cjs');
const j=v=>JSON.parse(JSON.stringify(v));

test('garde livrée : 113 différé après le 112, 114 validé (pas de cascade, appuis comptés sans la garde), événements de la garde et du cut suivant',async()=>{
 const x=await lotGarde();
 assert.deepEqual(x.differes,[112,113]);assert.deepEqual(x.valides,[111,114,115]);
 /* Le cut différé par la garde passe par « suivant sans décision », comme tout différé ; aucun SKIP, aucune validation de plus. */
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','nextWithoutDecision','capture','nextWithoutDecision','capture','apply','validate','next','capture','apply','validate','next','capture','apply']);
 assert.ok(!x.commandes.some(c=>/skip/i.test(String(c.action))),'jamais de SKIP');
 const d=j(Object.fromEntries(decisions(x.b)));
 assert.deepEqual(d[113].command,{action:'defer',reason:'garde-apres-differe'});
 assert.deepEqual(d[113].gardeApresDiffere,{regle:'R3',appuis:1,voisinsDifferes:[112],commande:{action:'engine',reason:'first-pass'}});
 assert.equal(x.batch.lotCommands[113].gardeApresDiffere,true);assert.equal(x.batch.lotCommands[113].action,'defer');
 /* Pas de cascade : le 114 a 1 appui mesuré (le 111) et deux précédents différés (112 par le lot, 113 par la garde) ; 113 compte comme appui. */
 assert.deepEqual(d[114].anchorsUsed,[111]);assert.equal(d[114].command.action,'engine');assert.equal('gardeApresDiffere' in d[114],false);
 for(const c of [114,115])assert.equal('gardeApresDiffere' in x.batch.lotCommands[c],false,c);
 assert.deepEqual(x.gardes.map(e=>({cut:e.identity.cut,part:e.identity.part,regle:e.regle,coupures:e.coupures,appuisMin:e.appuisMin,appuis:e.appuis,mesures:e.appuisMesures,voisins:e.voisinsDifferes,etage:e.etage,evitee:e.commandeEvitee,version:e.version})),
  [{cut:113,part:23,regle:'R3',coupures:2,appuisMin:2,appuis:1,mesures:1,voisins:[112],etage:'first-pass',evitee:{action:'engine',reason:'first-pass'},version:'garde-apres-differe-1'}]);
 /* Racines sans appui (événement `garde-apres-differe-suivant`) : 114 et 115 ont 1 appui mesuré au lieu de 2 sans la garde (mesuré sans elle :
  * tests/garde-apres-differe-coupee-sw.test.cjs, 114 appuyé sur 113 et 111, 115 sur 114 et 113). */
 const suivants=j(x.b.store.events.filter(e=>e.type==='garde-apres-differe-suivant')).map(e=>({cut:e.identity.cut,gardes:e.cutsGarde,appuis:e.appuis,max:e.appuisSansGardeMax,action:e.commande.action,parLaGarde:e.differeParLaGarde}));
 assert.deepEqual(suivants,[{cut:114,gardes:[113],appuis:1,max:2,action:'engine',parLaGarde:false},{cut:115,gardes:[113],appuis:1,max:2,action:'engine',parLaGarde:false},
  {cut:116,gardes:[113],appuis:2,max:2,action:'engine',parLaGarde:false}]);
});
