const {test}=require('node:test'),assert=require('node:assert/strict'),Gauge=require('../src/gauge.js');

test('gauge parser keeps the raw ESV text and accepts observed millimetre spacing formats without rounding',()=>{
 for(const text of ['1444 mm','1 444 mm','1\u00a0444 mm','1\u202f444 mm']){
   const measurement=Gauge.parse(text);assert.equal(measurement.status,'measured');assert.equal(measurement.valueMm,1444);assert.equal(measurement.rawText,text);
 }
 assert.equal(Gauge.parse('1470,4 mm').valueMm,1470.4);assert.equal(Gauge.parse('1470.4 mm').valueMm,1470.4);
});

test('gauge range classification is pure and never turns an unreadable value into a decision',()=>{
 assert.equal(Gauge.classify(Gauge.parse('1429 mm')).status,'below-range');
 assert.equal(Gauge.classify(Gauge.parse('1430 mm')).status,'within-range');
 assert.equal(Gauge.classify(Gauge.parse('1470 mm')).status,'within-range');
 assert.equal(Gauge.classify(Gauge.parse('1470,1 mm')).status,'above-range');
 for(const text of ['', '—', '1.444 m', 'NaN mm', '-4 mm'])assert.equal(Gauge.classify(Gauge.parse(text)).status,'indeterminate');
});

/* La borne basse du contrat opérateur est 1405 mm, et le module ne rend plus
 * aucun outcome décisionnel : un hors-contrat n'est PLUS un SKIP, c'est une
 * classe. Aucune voie automatique ne peut donc dériver un SKIP d'une mesure —
 * le SKIP reste une décision de l'opérateur. */
test('the operator policy preserves every boundary at 1405 and never yields a decision',()=>{
 const cases=[['1400 mm',['LOW_INVALID']],['1404,9 mm',['LOW_INVALID']],
   ['1405 mm',['TOLERANCE']],['1429 mm',['TOLERANCE']],
   ['1430 mm',['NOMINAL']],['1470 mm',['NOMINAL']],['1470,1 mm',['HIGH_INVALID']]];
 for(const [text,outcomes] of cases){const result=Gauge.assessOperatorPolicy(Gauge.parse(text));
   assert.deepEqual(result.outcomes,outcomes);assert.equal(result.automaticDecisionAllowed,false);}
 for(const rule of Gauge.OPERATOR_RULES)
   assert.ok(!/SKIP/i.test(rule.outcome),'aucun outcome ne doit mentionner SKIP : '+rule.outcome);
});

test('the 1405 boundary has one unambiguous outcome and 1410 is no longer a boundary',()=>{
 const below=Gauge.assessOperatorPolicy(Gauge.parse('1404,9 mm')),boundary=Gauge.assessOperatorPolicy(Gauge.parse('1405 mm'));
 assert.equal(below.status,'specified');assert.deepEqual(below.outcomes,['LOW_INVALID']);
 assert.equal(boundary.status,'specified');assert.deepEqual(boundary.ruleIds,['tolerance-1405-1430']);
 assert.deepEqual(boundary.outcomes,['TOLERANCE']);
 // 1410 n'est plus une frontière : il est à l'intérieur de la tolérance.
 assert.deepEqual(Gauge.assessOperatorPolicy(Gauge.parse('1409,9 mm')).outcomes,['TOLERANCE']);
 assert.deepEqual(Gauge.assessOperatorPolicy(Gauge.parse('1410 mm')).outcomes,['TOLERANCE']);
});

test('the millimetre contract is the single source of truth for the three bounds',()=>{
 assert.deepEqual({low:Gauge.CONTRACT.lowMm,nominal:Gauge.CONTRACT.nominalMm,maximum:Gauge.CONTRACT.maximumMm},
   {low:1405,nominal:1430,maximum:1470});
 assert.equal(Gauge.RULE.minimumMm,Gauge.CONTRACT.nominalMm);
 assert.equal(Gauge.RULE.maximumMm,Gauge.CONTRACT.maximumMm);
 const bounds=Gauge.OPERATOR_RULES.flatMap(r=>[r.minimumMm,r.maximumMm]).filter(v=>v!==null);
 for(const v of bounds)assert.ok([1405,1430,1470].includes(v),'borne hors contrat : '+v);
});
