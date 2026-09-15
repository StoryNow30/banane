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

test('the received operator policy preserves every boundary without triggering an automatic decision',()=>{
 const cases=[['1400 mm',['SKIP']],['1409,9 mm',['SKIP']],
   ['1410 mm',['VALIDATE_WITH_TOLERANCE']],['1429 mm',['VALIDATE_WITH_TOLERANCE']],
   ['1430 mm',['VALIDATE']],['1470 mm',['VALIDATE']],['1470,1 mm',['SKIP']]];
 for(const [text,outcomes] of cases){const result=Gauge.assessOperatorPolicy(Gauge.parse(text));
   assert.deepEqual(result.outcomes,outcomes);assert.equal(result.automaticDecisionAllowed,false);}
});

test('the confirmed 1410 boundary has one unambiguous operator policy outcome',()=>{
 const below=Gauge.assessOperatorPolicy(Gauge.parse('1409,9 mm')),boundary=Gauge.assessOperatorPolicy(Gauge.parse('1410 mm'));
 assert.equal(below.status,'specified');assert.deepEqual(below.outcomes,['SKIP']);
 assert.equal(boundary.status,'specified');assert.deepEqual(boundary.ruleIds,['tolerance-1410-1430']);
 assert.deepEqual(boundary.outcomes,['VALIDATE_WITH_TOLERANCE']);
});
