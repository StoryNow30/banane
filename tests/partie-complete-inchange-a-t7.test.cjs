'use strict';
/* Test 7, suite (coordination) — PARTIE COMPLÈTE : AUTRES CAS, COMMANDES INCHANGÉES (partie complète mais information incertaine ou cut rouge).
 * Constaté au banc avant correction : sur une partie dont le compteur d'ESV « N on M treated » est complet (N = M), le lot
 * posait (`apply`) et validait (`validateAndNext`) le cut affiché, déjà traité, puis ESV chargeait la partie suivante. Un
 * opérateur ne fait pas cette écriture. Règle : au PREMIER cut du lot, avant toute commande, si le relevé du compteur de ce
 * cut dit la partie complète ET si la liste d'ESV (mémoire de la page, lecture B1) donne à ce cut un statut lu et non
 * « invalid », le lot se clôt sans rien envoyer. Toute information absente ou incertaine : commandes d'avant, à l'octet près.
 * Un cut rouge n'est jamais retenu. Service worker réel en VM, moteur et GCV1 réels, ESV simulé ; données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {scenario,fenetre,AVIS}=require('./helpers/partie-complete.cjs');

test('partie complète mais information incertaine ou cut rouge : commandes envoyées à ESV identiques, à l’octet près, à celles d’un lot sans relevé (comportement d’avant)',async()=>{
 const ref=await scenario({mesure:null,liste:undefined,module:false});
 assert.deepEqual(ref.calls,['capture','apply','validate','next'],'référence : pose, validation, partie suivante');
 assert.deepEqual(ref.trace.map(x=>x.a),['apply','validateAndNext','next'],'la navigation de l’ESV simulé passe par `next`');
 for(const [nom,o] of [
   ['partie complète, cut affiché ROUGE',{mesure:{total:101,traites:101},liste:fenetre(50,'invalid')}],
   ['partie complète, statut illisible',{mesure:{total:101,traites:101},liste:fenetre(50,'autre')}],
   ['partie complète, page sans réponse',{mesure:{total:101,traites:101},liste:undefined}],
   ['partie complète, page qui refuse',{mesure:{total:101,traites:101},liste:{ok:false,reason:'sans-table'}}],
   ['partie complète, deux tables et ligne non rapprochée',{mesure:{total:101,traites:101},liste:fenetre(50,'valid',{tables:2,index:12})}],
   ['partie complète, ligne du cut absente',{mesure:{total:101,traites:101},liste:{...fenetre(50,'valid'),rows:[]}}]]){
  const s=await scenario(o);
  assert.deepEqual(s.calls,ref.calls,nom);assert.deepEqual(s.trace,ref.trace,nom+' : arguments identiques');
  assert.doesNotMatch(String(s.view.notice),/Aucune pose ni validation n’a été envoyée à ESV/,nom);}
});

