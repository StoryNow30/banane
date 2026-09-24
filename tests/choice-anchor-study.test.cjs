'use strict';
/* Étude « choix et appuis » : décompte par étape et nombre d'appuis, règles
 * appliquées par filtre aux seuls choix. Données synthétiques, sans moteur. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../tools/choice-anchor-study.cjs');
const row=(cut,stage,anchors,{from=null,judged=true,wrong=false}={})=>({source:'lot',cut,stage,anchors,chosenMaxFromPredictionMm:from,judged,wrong,worstMm:wrong?20:2});
const rows=[row(1,'first-pass',0),row(2,'first-pass',2),row(3,'choice',1,{from:14,wrong:true}),row(4,'choice',1,{from:4}),
  row(5,'choice',2,{from:12}),row(6,'window',1,{judged:false}),row(7,'choice',1,{from:3,judged:false})];
test('décompte par étape et par nombre d\'appuis, faux nommés',()=>{
  const t=S.tally(rows);
  assert.deepEqual(t['choice · 1 appui'],{decisions:3,judged:2,wrong:1,wrongCuts:['lot:3 (20 mm)']});
  assert.equal(t['choice · 2 appuis'].decisions,1);
  assert.equal(t['first-pass · 0 appui'].decisions,1);
  assert.equal(t['window · 1 appui'].judged,0);
});
test('les règles ne touchent que les choix',()=>{
  const r=S.rules(rows);
  assert.deepEqual([r['actuelle'].applied,r['actuelle'].wrong],[7,1]);
  const two=r['choix : 2 appuis au moins'];
  assert.deepEqual([two.applied,two.wrong,two.removedWrong,two.removedJudgedRight,two.removedUnjudged],[4,0,['lot:3'],['lot:4'],['lot:7']]);
  const ten=r['choix : à 10 mm de la prédiction au plus'];
  assert.deepEqual([ten.applied,ten.removedWrong,ten.removedJudgedRight],[5,['lot:3'],['lot:5']]);
});
