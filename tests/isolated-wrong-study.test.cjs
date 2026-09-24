'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),S=require('../tools/isolated-wrong-study.cjs');
test('une règle ne compte que les applications jugées',()=>{
 const rail={s1Changed:true,calibration:{reason:'shift-out-of-domain'},fromEsv:{lateralMm:0}};
 const rows=[{cut:241,stage:'first-pass',referenced:true,wrong:true,rails:{left:rail,right:rail}},
  {cut:2,stage:'deferred',referenced:true,wrong:true,rails:{left:rail,right:rail}}];
 assert.deepEqual(S.score(rows,S.RULES.find(r=>r.id==='s1-hors-domaine')).wrongCuts,[241]);
});
test('le risque S1 hors domaine exige les deux signaux sur le même rail',()=>{
 const left={s1Changed:true,calibration:{reason:null},fromEsv:{lateralMm:0}};
 const right={s1Changed:false,calibration:{reason:'shift-out-of-domain'},fromEsv:{lateralMm:0}};
 const row={cut:409,stage:'first-pass',referenced:true,wrong:true,rails:{left,right}};
 assert.equal(S.score([row],S.RULES.find(r=>r.id==='s1-hors-domaine')).wrongStopped,0);
 assert.equal(S.score([row],S.RULES.find(r=>r.id==='s1-et-calage-hors-domaine-paire')).wrongStopped,1);
});
