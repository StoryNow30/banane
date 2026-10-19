'use strict';
/* 5.0 (audit 5.0, I8 (2)) — ÉCHO : UN ÉVÉNEMENT `memoire-differes-ombre` PAR PREMIÈRE VISITE D'UN CUT QUE LE LOT A DIFFÉRÉ.
 *
 * G1 (b), en ombre : la voie est prolongée depuis les corrections DÉJÀ VALIDÉES par l'opérateur sur les cuts précédents de la
 * même série de différés, puis le moteur est recentré sur elle (module commun src/voie-recentree.js). Frontière anti-fuite :
 * celle de l'observation « continuité » (l'ombre GCV1 de l'Écho, amendement n°7) — la pose de départ de la visite et les points
 * capturés AVANT le premier changement de rail ; jamais la référence humaine ni la pose finale de la visite observée. Le
 * calcul tourne après la fin de visite, hors de la file des événements, et ne commande rien (l'Écho est passif). Données
 * synthétiques (tests/fixtures.cjs). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {identity,truth,shifted,esv,nativeFixture,visit,ombres,sansHorloge,SIDES,O,Shadow,S,K,base,entreeSansFuite}=require('./helpers/memoire-ombre-session.cjs');

test('le réglage existe, COUPÉ au terrain depuis la test 5 (relecture I-1), en OMBRE quand il est actif, réglage G1 (b) de D-148 ; le panneau dit qu\'il ne fait que consigner',()=>{
  const m=S.memoireDifferesOmbre;assert.ok(Object.isFrozen(m));
  assert.deepEqual({...m,etages:[...m.etages]},{actif:false,ecartSerieMax:10,K:3,appuis:2,mmParCut:3,porteDispersionMm:10,etages:['first-pass','window','choice']});
  const ligne=S.describe().find(l=>/Mémoire des différés en ombre/.test(l.nom));assert.ok(ligne);assert.equal(ligne.valeur,'coupée');assert.match(ligne.pourquoi,/référence/i);
});

test('session Écho : un événement par première visite d\'un différé ; la série apprend des corrections déjà validées ; rien n\'est commandé',{timeout:60000},async()=>{
  const f=await nativeFixture();
  const a=await visit(f,'a',100),b=await visit(f,'b',101),c=await visit(f,'c',102);
  const e=ombres(f);
  assert.deepEqual(e.map(x=>[x.identity.cut,x.etat]),[[100,'sans-memoire'],[101,'calcule'],[102,'calcule']]);
  for(const x of e){assert.equal(x.nativeSessionId,f.engine.s.native.id,'sort dans l\'export Écho');assert.equal(x.frontiere,'avant-reference');assert.ok(x.visitId);}
  const [,e1,e2]=e;
  assert.deepEqual(e1.memoire.cuts,[100]);assert.deepEqual(e2.memoire.cuts,[101,100]);assert.deepEqual(e2.appuis,[101,100]);
  assert.equal(e2.verdict.posable,true);
  /* La pose de l'ombre retrouve celle de l'opérateur (vérité du fixture), à quelques mm. */
  for(const side of SIDES){const v=K.C.point(esv[side].sceneRelativeToProfileLocal,truth[side].positionSceneRelative),o=K.C.point(esv[side].sceneRelativeToProfileLocal,esv[side].positionSceneRelative);
    assert.ok(Math.abs(e2.poseMm[side][1]-(v[1]-o[1])*1000)<3,`${side} : ${e2.poseMm[side]}`);}
  assert.ok(!/positionSceneRelative|"positions"/.test(JSON.stringify(e)));
  /* Écho passif : aucune visite ne porte de commande d'Ariane ; la référence de l'opérateur est intacte. */
  for(const r of [a,b,c]){assert.equal(r.commandSentByBanane,false);}
  assert.deepEqual(c.humanFinalReference.state.rails.left.positionSceneRelative,truth.left.positionSceneRelative);
  /* Un cut que le lot n'a pas différé : aucun événement. */
  await visit(f,'d',110);assert.equal(ombres(f).length,3);
});

test('ce qui manque est dit : sans lot connu pour la partie, un seul événement « differes-inconnus », rien de calculé',{timeout:60000},async()=>{
  const f=await nativeFixture({differes:[]});
  await visit(f,'a',100);await visit(f,'b',101);await visit(f,'c',102);
  const e=ombres(f);assert.equal(e.length,1);assert.equal(e[0].etat,'differes-inconnus');assert.equal(e[0].identity.part,22);assert.equal(e[0].verdict.posable,false);
});
