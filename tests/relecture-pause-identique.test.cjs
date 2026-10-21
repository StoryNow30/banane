'use strict';
/* 4.9.6 (D-232, D-233) — UNE REPRISE DONNE LES MÊMES RÉSULTATS QU'UNE PASSE SANS PAUSE : même action, même verdict, même pose calculée, mêmes écritures, même chaîne d'appuis
 * (le nombre d'appuis que chaque décision reçoit). La référence est une passe sans pause du même montage (tests/fixtures/relecture-pause-reference.json), relevée une fois.
 * La pause tombe entre le cut 110 et le cut 113 ; la chaîne (108, 109, 110) doit traverser la pause. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('./helpers/relecture-pause.cjs'),{H,lotPause,attendreEtat,hookChaine,resume}=P;
const {PERMISSIF}=require('./helpers/relecture-essais.cjs');
const REF=require('./fixtures/relecture-pause-reference.json');

test('pause entre 110 et 113 puis reprise : mêmes résultats par cut, même chaîne d’appuis, mêmes corrections que la passe sans pause',async()=>{
 const rec={};let demande=null;
 const suite=hookChaine(rec);
 const {b,adapter}=await lotPause({mode:'corriger',decisions:{108:6,109:14,110:14,114:6,115:6},reglagesProposes:PERMISSIF,esv:(a,bb)=>{suite(a,bb);a.surAller=async t=>{if(t.cut!==110||demande)return;demande=await bb.api('relecture-pause');};}});
 const p=await attendreEtat(b,'en-pause');assert.equal(p.cut,113,'la pause tombe avant le cut 113');
 const pt=b.local.m.banane51RelectureReprise;assert.equal(pt.chaine.length,3,'les poses données à 108, 109 et 110 sont dans le point de reprise');
 await b.api('relecture-reprendre');const fin=await H.finPasse(b);
 const r=JSON.parse(JSON.stringify(resume(b,rec)));
 assert.deepEqual(r.cuts,REF.cuts,'mêmes actions, verdicts, poses, écritures et chaîne par cut');
 assert.deepEqual(r.appuisRecus,REF.appuisRecus,'chaque décision reçoit les mêmes appuis');
 assert.equal(fin.faits,REF.faits);assert.equal(fin.corriges,REF.corriges);assert.deepEqual(adapter.majEspace.map(m=>m.cut),REF.majEspace);
});
