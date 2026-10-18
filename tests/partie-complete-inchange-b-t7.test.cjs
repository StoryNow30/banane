'use strict';
/* Test 7, suite (coordination) — PARTIE COMPLÈTE : AUTRES CAS, COMMANDES INCHANGÉES (partie incomplète, compteur absent, illisible ou d’un autre cut).
 * Constaté au banc avant correction : sur une partie dont le compteur d'ESV « N on M treated » est complet (N = M), le lot
 * posait (`apply`) et validait (`validateAndNext`) le cut affiché, déjà traité, puis ESV chargeait la partie suivante. Un
 * opérateur ne fait pas cette écriture. Règle : au PREMIER cut du lot, avant toute commande, si le relevé du compteur de ce
 * cut dit la partie complète ET si la liste d'ESV (mémoire de la page, lecture B1) donne à ce cut un statut lu et non
 * « invalid », le lot se clôt sans rien envoyer. Toute information absente ou incertaine : commandes d'avant, à l'octet près.
 * Un cut rouge n'est jamais retenu. Service worker réel en VM, moteur et GCV1 réels, ESV simulé ; données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {scenario,fenetre,AVIS}=require('./helpers/partie-complete.cjs');

test('partie incomplète, compteur absent, illisible ou d’un autre cut : commandes envoyées à ESV identiques, à l’octet près, à celles d’un lot sans relevé (comportement d’avant)',async()=>{
 const ref=await scenario({mesure:null,liste:undefined,module:false});
 assert.deepEqual(ref.calls,['capture','apply','validate','next'],'référence : pose, validation, partie suivante');
 assert.deepEqual(ref.trace.map(x=>x.a),['apply','validateAndNext','next'],'la navigation de l’ESV simulé passe par `next`');
 for(const [nom,o] of [
   ['partie complète, module de lecture absent',{mesure:{total:101,traites:101},liste:fenetre(50,'valid'),module:false}],
   ['il reste des rouges (N < M), cut vert',{mesure:{total:101,traites:90},liste:fenetre(50,'valid')}],
   ['compteur absent',{mesure:null,liste:fenetre(50,'valid')}],
   ['compteur illisible (plusieurs compteurs)',{mesure:i=>({requestId:'r',at:new Date().toISOString(),identity:{pageId:i.pageId,part:i.part,cut:i.cut},compteur:{traites:101,total:101},compteursVus:2}),liste:fenetre(50,'valid')}],
   ['relevé d’un autre cut',{mesure:i=>({requestId:'r',at:new Date().toISOString(),identity:{pageId:i.pageId,part:i.part,cut:49},compteur:{traites:101,total:101}}),liste:fenetre(50,'valid')}],
   ['relevé d’une autre partie',{mesure:i=>({requestId:'r',at:new Date().toISOString(),identity:{pageId:i.pageId,part:22,cut:i.cut},compteur:{traites:101,total:101}}),liste:fenetre(50,'valid')}],
   ['relevé antérieur au début du cut',{mesure:i=>({requestId:'r',at:'2020-01-01T00:00:00.000Z',identity:{pageId:i.pageId,part:i.part,cut:i.cut},compteur:{traites:101,total:101}}),liste:fenetre(50,'valid')}]]){
  const s=await scenario(o);
  assert.deepEqual(s.calls,ref.calls,nom);assert.deepEqual(s.trace,ref.trace,nom+' : arguments identiques');
  assert.doesNotMatch(String(s.view.notice),/Aucune pose ni validation n’a été envoyée à ESV/,nom);}
});

