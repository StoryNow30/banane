'use strict';
/* F6 (relecture du test 3) : depuis la V2, seul le PREMIER segment d'un export porte `events`, `state`, `v1TimingExport`…
 * (src/native-export.js, UNE_FOIS) ; les suivants ont un en-tête mince (`segment.headerIn`). L'analyse lancée sur un tel
 * segment disait « Observateur : absent » (ou « Aucun événement horodaté ») : faux et trompeur. Elle dit maintenant où
 * sont les données : lancer sur le segment qui porte l'en-tête, ou fusionner les segments. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const V1=require('../tools/perf-phases.cjs'),PL=require('../tools/perf-lot.cjs'),Nx=require('../src/native-export.js');
const mince=()=>({...Nx.enteteMince({format:'banane-test-dataset-v4',version:'4.9.0.3',exportedAt:'2026-10-12T08:00:00.000Z',events:[{type:'x'}],records:[{recordId:'r'}],
 state:{batch:{id:'B'}},v1TimingExport:{schema:1},closureSummary:{}}),segment:{index:2,headerIn:1,stamp:'s',objects:3,format:'banane-native-export-segment-v1',selfContained:true},clouds:[],dictionaries:{}});
test('perf-phases : segment à en-tête mince → message explicite, pas « observateur absent »',()=>{
 const d=mince();assert.deepEqual(d.events,[]);assert.equal(d.state,undefined,'en-tête mince réel (enteteMince)');
 const m=V1.measure(d),md=V1.toMarkdown(m);
 assert.equal(m.available,false);assert.match(m.reason,/en-tête mince/);assert.match(m.reason,/seg01/);assert.match(m.reason,/fusionne les segments/);
 assert.doesNotMatch(md,/Observateur : absent|observateur absent/i,'pas de faux « observateur absent »');
 assert.match(md,/en-tête mince/);
});
test('perf-lot : segment à en-tête mince → erreur explicite (segment qui porte l’en-tête, ou fusion)',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ariane-mince-'));
 try{const f=path.join(dir,'ariane-bilan-v4-x-seg02.json');fs.writeFileSync(f,JSON.stringify(mince()));
  assert.throws(()=>PL.run([f]),e=>/en-tête mince/.test(e.message)&&/seg01/.test(e.message)&&/merge-segments/.test(e.message)&&!/Aucun événement horodaté/.test(e.message));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('premier segment (en-tête complet) : inchangé, aucun message de segment mince',()=>{
 const m=V1.measure({version:'4.9.0.3',events:[],segment:{index:1,stamp:'s'}});assert.doesNotMatch(m.reason,/en-tête mince/);
});
