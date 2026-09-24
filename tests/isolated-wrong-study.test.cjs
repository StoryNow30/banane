'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),S=require('../tools/isolated-wrong-study.cjs');
test('une règle ne compte que les applications jugées',()=>{
 const rail={s1Changed:true,calibration:{reason:'shift-out-of-domain'},fromEsv:{lateralMm:0}};
 const rows=[{cut:241,stage:'first-pass',referenced:true,wrong:true,rails:{left:rail,right:rail}},
  {cut:2,stage:'deferred',referenced:true,wrong:true,rails:{left:rail,right:rail}}];
 assert.deepEqual(S.score(rows,S.RULES[0]).wrongCuts,[241]);
});
