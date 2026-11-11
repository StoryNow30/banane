'use strict';
/* CH-109 (A, D-341) — APRÈS UN F5, LA RELECTURE REPREND SEULE AU CUT OÙ ELLE ÉTAIT. Service worker réel, ESV simulé (tests/helpers/relecture-pause.cjs).
 * Une pause de raison « esv » (ESV muet pendant un cut) attend un rechargement de la page vu par Chrome (`chargementEsv.gen`), puis ESV prêt et
 * ré-équipé (même attente que le rechargement de CH-060, sans recharger : délais du réglage `relectureSignalEteint`), puis reprend par le chemin de
 * « Reprendre ». Sans rechargement dans la borne `attenteRepriseMs`, elle reste en pause avec son message. Journal `relecture-esv-revenue`. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause,attendreEtat,cutsAllees}=require('./helpers/relecture-pause.cjs');
const {REGLAGE,avec}=require('./helpers/relecture-signal.cjs');
const muet=a=>{const ping=a.ping.bind(a);a.ping=async()=>{if(a.muet)throw Error('Adaptateur ESV sans réponse (simulé).');return ping();};};
const etapes=b=>H.evenements(b,'relecture-esv-revenue').map(e=>e.etape);
async function jusqua(f,ms=8000){const t=Date.now();for(;;){const v=f();if(v)return v;if(Date.now()-t>ms)throw Error('délai dépassé');await H.attendre(20);}}

test('F5 au cut 110 : pause, la page se recharge, ESV revient : reprise seule au cut 110, sans revoir 108 et 109, passe finie',async()=>{
 const {b,adapter}=await lotPause({esv:avec(muet,(a,bb)=>REGLAGE({actif:true})(bb),a=>{a.panneCapture.add(110);})});
 const p=await attendreEtat(b,'en-pause');assert.equal(p.pauseRaison,'esv');assert.equal(p.cut,110);
 const avant=cutsAllees(adapter).length;
 /* F5 : Chrome dit la page en chargement, ESV muet un instant, puis répond (la panne du cut 110 est passée). */
 adapter.muet=true;adapter.panneCapture.clear();b.get('chargementEsvReset')();setTimeout(()=>{adapter.muet=false;},80);
 await jusqua(()=>H.evenements(b,'relecture-reprise').length);
 const fin=await H.finPasse(b,60000);
 assert.equal(fin.etat,'finie',fin.message);assert.equal(fin.faits,7);
 const apres=cutsAllees(adapter).slice(avant);assert.equal(apres[0],110,'reprise au cut 110');for(const c of [108,109])assert.equal(apres.includes(c),false);
 assert.equal(H.evenements(b,'relecture-reprise')[0].raisonPause,'esv');
 assert.deepEqual(etapes(b),['attente','rechargee','repris']);
});

test('ESV muet sans rechargement : aucune reprise seule ; au-delà de la borne, la passe reste en pause avec son message',async()=>{
 const {b}=await lotPause({esv:avec(muet,(a,bb)=>REGLAGE({actif:true,attenteRepriseMs:300})(bb),a=>{a.panneCapture.add(110);})});
 const p=await attendreEtat(b,'en-pause');const message=p.message;
 await jusqua(()=>etapes(b).includes('echec'),3000);
 assert.equal(b.get('relecture').passe.etat,'en-pause');assert.equal(b.get('relecture').passe.message,message,'message de la pause gardé');
 assert.equal(H.evenements(b,'relecture-reprise').length,0);
 assert.match(H.evenements(b,'relecture-esv-revenue').find(e=>e.etape==='echec').motif,/aucun rechargement/);
});

test('l’opérateur reprend lui-même pendant l’attente : Ariane s’efface, une seule reprise, la passe finit',async()=>{
 const {b,adapter}=await lotPause({esv:avec(muet,(a,bb)=>REGLAGE({actif:true,attenteRepriseMs:3000})(bb),a=>{a.panneCapture.add(110);})});
 await attendreEtat(b,'en-pause');adapter.panneCapture.clear();
 await b.api('relecture-reprendre');
 const fin=await H.finPasse(b,60000);assert.equal(fin.etat,'finie');assert.equal(fin.faits,7);
 await jusqua(()=>etapes(b).includes('abandon'),4000);
 assert.deepEqual(etapes(b),['attente','abandon']);assert.equal(H.evenements(b,'relecture-reprise').length,1);
});
