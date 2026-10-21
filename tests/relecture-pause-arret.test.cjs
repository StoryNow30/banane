'use strict';
/* 4.9.6 (D-232, D-233) — « ARRÊTER » PENDANT LA PAUSE : définitif. Il efface le point, ferme la passe (relecture-fin « arret » une fois), rend la main
 * (un lot peut de nouveau partir), et rien ne peut plus être repris ; « Arrêter » du lot (action `stop`) vaut « Arrêter la relecture ». */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause,attendreEtat}=require('./helpers/relecture-pause.cjs');

test('arrêt pendant la pause : passe arrêtée, point effacé, un seul relecture-fin « arret », reprise impossible, le lot peut de nouveau partir',async()=>{
 let demande=null;
 const {b}=await lotPause({esv:(a,bb)=>{a.surAller=async t=>{if(t.cut!==109||demande)return;demande=await bb.api('relecture-pause');};}});
 const p=await attendreEtat(b,'en-pause');assert.ok('banane51RelectureReprise' in b.local.m);
 await b.api('stop');   /* « Arrêter » du lot, pendant la pause */
 assert.equal(p.etat,'arretee');assert.match(p.message,/arrêtée à ta demande \(elle était en pause\) : 2 cuts relus sur 7/);
 assert.equal('banane51RelectureReprise' in b.local.m,false);
 const fins=H.evenements(b,'relecture-fin');assert.equal(fins.length,1);assert.equal(fins[0].issue,'arret');assert.equal(fins[0].faits,2);
 await assert.rejects(b.api('relecture-reprendre'),/Aucune relecture en pause/);
 await b.api('relecture-arreter');assert.equal(H.evenements(b,'relecture-fin').length,1,'un second arrêt ne journalise rien');
 /* La main est rendue : plus aucun refus « Relecture en pause ». */
 const r=await b.api('goto-cut',{part:23,cut:5}).then(()=>'accepté',e=>e.message);assert.doesNotMatch(String(r),/Relecture en pause|Relecture après le lot en cours/);
});
