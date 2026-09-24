#!/usr/bin/env node
'use strict';
/* Étude hors ligne des faux isolés. Les références ne jugent qu'après le
 * calcul du moteur ; aucun déplacement, validation ni SKIP. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const APPLIED=new Set(['first-pass','second-pass-window','second-pass-choice']);
const RULES=[
 {id:'s1-hors-domaine',test:r=>['left','right'].some(s=>r.rails[s].s1Changed&&r.rails[s].calibration.reason==='shift-out-of-domain')},
 {id:'calage-hors-domaine',test:r=>['left','right'].some(s=>r.rails[s].calibration.reason==='shift-out-of-domain')},
 {id:'s1-tout',test:r=>['left','right'].some(s=>r.rails[s].s1Changed)},
 {id:'flanc-partiel',test:r=>['left','right'].some(s=>r.rails[s].partialFlankUsed)},
 {id:'depart-isole',test:r=>r.stage==='first-pass'&&r.deviationToAnchorsMm===null},
 {id:'translation-esv-100mm',test:r=>['left','right'].some(s=>Math.abs(r.rails[s].fromEsv.lateralMm)>100)}
];
function score(rows,rule){
 const hits=rows.filter(r=>APPLIED.has(r.stage)&&rule.test(r));
 return {rule:rule.id,stopped:hits.length,wrongStopped:hits.filter(r=>r.referenced&&r.wrong).length,
  rightLost:hits.filter(r=>r.referenced&&!r.wrong).length,
  unjudgedStopped:hits.filter(r=>!r.referenced).length,
  wrongCuts:hits.filter(r=>r.referenced&&r.wrong).map(r=>r.cut),
  rightCuts:hits.filter(r=>r.referenced&&!r.wrong).map(r=>r.cut)};
}
function baselineRun(file,label){
 const report=JSON.parse(fs.readFileSync(file,'utf8'));
 const run=report.runs.find(r=>r.label===label&&r.variant==='B'&&r.chain==='guarded'&&r.sides==='both'&&r.chooseMm===15);
 assert(run,'reproduction B/guarded/both/15 absente : '+label);
 return run;
}
module.exports={RULES,score,baselineRun,APPLIED};
