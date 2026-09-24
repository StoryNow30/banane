'use strict';
/* KI-048, contre-épreuve : la décision sur le lot chargée APRÈS la composition
 * GCV1 (l'ordre fautif de la 4.7.8) ne reçoit pas la grille ; la raison le dit.
 * Séparé de `lot-decision-navigateur.test.cjs` pour tenir le délai par fichier. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {listed,load,scenario}=require('./helpers/navigateur.cjs');
test('chargée après la composition GCV1, la grille manque : raison « grid-unavailable », jamais « aucun minimum »',()=>{
  const without=listed.filter(f=>f!=='src/lot-decision.js'),at=without.indexOf('src/gcv1-shadow.js');
  const ctx=load([...without.slice(0,at+1),'src/lot-decision.js',...without.slice(at+1)]),d=scenario(ctx.BananeLotDecision,ctx.BananeGCV1Shadow);
  assert.equal(d.stage,'deferred');assert.match(d.reason,/grid-unavailable/);assert.doesNotMatch(d.reason,/no-qualified-minimum/);
});
