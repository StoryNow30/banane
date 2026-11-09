'use strict';
/* CH-086 : commandes à ESV, poses, validations, événements, visites et état final identiques, réglage `ecrituresApresValidation` éteint et
 * allumé (ESV qui relit l'état final, et « navigation seule » comme sur le terrain ; magasin FIFO, et chrome.storage en avance sur IndexedDB). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {patchOk,Engine,K,S,ALLUME,ETEINT,StoreLent,ESV,scope,lot,normaliser,enregistrements,arretsFenetre}=require('./helpers/ch086.cjs');
test('le patch s’applique au tronc (ou le tronc le porte)',patchOk);
test('2. commandes à ESV, poses, validations, événements, visites et état final identiques, réglage éteint et allumé',async()=>{
 for(const navigationSeule of [false,true])for(const ordre of ['fifo','etat-avant']){
  const sans=await lot({reglage:ETEINT,navigationSeule,ordre,fin:101}),avec=await lot({reglage:ALLUME,navigationSeule,ordre,fin:101});
  assert.equal(sans.e.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');assert.equal(sans.e.s.batch.processed.length,2);
  assert.deepEqual(enregistrements(avec),enregistrements(sans),`navigation seule ${navigationSeule}, ordre ${ordre}`);
  assert.deepEqual(avec.e.s.batch.processed.map(p=>p.evidence.validationProof),Array(2).fill(navigationSeule?'navigation-only':'after-state-observed'));}
});

