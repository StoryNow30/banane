'use strict';
/* Matrice cut par cut (D-038, chantier 3) : une ligne par cut distinct, les
 * cuts exclus par l'opérateur restent visibles et hors des comptes. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {matrix,toCsv}=require('../tools/cut-matrix.cjs');

test('une session vide rend une matrice vide',()=>{
  const r=matrix({records:[],clouds:[],events:[]},'vide');
  assert.equal(r.summary.distinctCuts,0);assert.deepEqual(r.rows,[]);
});

test('revisites comptées sur le cut, cuts exclus visibles et hors des comptes',()=>{
  const rec=(visitIndex,cut)=>({visitId:'v'+visitIndex,visitIndex,identity:{part:24,cut},visitRelation:{type:visitIndex?'revisit':'first-observation'}});
  const r=matrix({records:[rec(0,100),rec(1,100),rec(2,9033)],clouds:[],events:[]},'s');
  assert.equal(r.rows.length,2);assert.equal(r.rows[0].visits,2);assert.equal(r.rows[0].outcome,'no-initial-pose');
  assert.equal(r.rows[1].outcome,'excluded-by-operator');
  assert.equal(r.summary.distinctCuts,1);assert.equal(r.summary.excludedByOperator,1);assert.equal(r.summary.revisitedCuts,1);
  assert.match(toCsv([r]).split('\n')[0],/^session;partie;cut;visites/);
});
