'use strict';
/* KI-048 — la décision sur le lot telle que le NAVIGATEUR la charge. Les autres
 * essais lient les modules par `require`, donc avec la géométrie GCV1 directe ;
 * dans le service worker, ils sont liés par des globales, dans l'ordre
 * d'`importScripts`, et `gcv1-shadow.js` remplace `BananeGeometry3` par sa
 * façade V4.6. Ici, les fichiers de `background.js` sont exécutés dans cet
 * ordre, sans `module` ni `require`, puis le scénario du risque connu (qui
 * aboutit à un choix) est rejoué. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {listed,load,scenario}=require('./helpers/navigateur.cjs');
test('ordre de background.js : le choix par la voie voit la grille, comme sous Node',()=>{
  const ctx=load(listed),d=scenario(ctx.BananeLotDecision,ctx.BananeGCV1Shadow);
  assert.equal(d.stage,'choice',d.reason);
});
