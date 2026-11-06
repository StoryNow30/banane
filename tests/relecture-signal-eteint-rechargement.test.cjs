'use strict';
/* CH-060 — SIGNAL D'ESV ÉTEINT PENDANT LA RELECTURE, réglage ALLUMÉ (suite de tests/relecture-signal-eteint.test.cjs, coupée en deux pour tenir sous 20 s).
 * Service worker réel, ESV simulé (tests/helpers/relecture-signal.cjs) : pause au point de reprise, rechargement, reprise au cut suivant ; ESV jamais prêt. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause,attendreEtat,cutsAllees}=require('./helpers/relecture-pause.cjs');
const {esvSignal,REGLAGE,avec,etape}=require('./helpers/relecture-signal.cjs');

test('SW, réglage allumé : pause au point de reprise, rechargement, reprise au cut suivant ; 7 cuts relus, aucun revu',async()=>{
 const {b,adapter}=await lotPause({esv:avec(esvSignal(),(a,b)=>REGLAGE({actif:true})(b))});
 /* La passe se met en pause après le 3e cut relu au repli (108, 109, 110), puis Ariane recharge et reprend seule. */
 await attendreEtat(b,'en-pause');await etape(b,'repris');const fin=await H.finPasse(b,60000);
 assert.equal(fin.etat,'finie',fin.message);assert.equal(fin.faits,7);assert.equal(adapter.rechargements,1,'un seul rechargement');
 const relus=H.evenements(b,'relecture-ombre').map(e=>e.identity.cut);
 assert.deepEqual(relus,[108,109,110,113,114,115,116],'chaque cut relu une fois, dans l’ordre');
 const pause=H.evenements(b,'relecture-pause');assert.equal(pause.length,1);assert.equal(pause[0].raison,'signal');assert.equal(pause[0].cut,113);
 assert.equal(H.evenements(b,'relecture-reprise').length,1);assert.equal(H.evenements(b,'relecture-reprise')[0].raisonPause,'signal');
 const etapes=H.evenements(b,'relecture-signal-eteint').map(e=>e.etape);assert.deepEqual(etapes,['detecte','recharge','repris']);
 assert.equal(H.evenements(b,'relecture-signal-eteint')[0].action,'recharger');
 const apres=cutsAllees(adapter).slice(cutsAllees(adapter).indexOf(110)+1);for(const c of [108,109,110])assert.equal(apres.includes(c),false,`le cut ${c} n’est pas revisité`);
 assert.equal(H.evenements(b,'relecture-fin').length,1);assert.equal(H.evenements(b,'relecture-fin')[0].issue,'fin');
});
test('SW, réglage allumé, ESV jamais prêt après le rechargement : la passe reste en pause, avec la consigne ; rien n’est relu de plus',async()=>{
 const {b,adapter}=await lotPause({esv:avec(esvSignal({jamaisPret:true}),(a,b)=>REGLAGE({actif:true,attenteRepriseMs:300})(b))});
 const p=await attendreEtat(b,'en-pause');assert.equal(p.pauseRaison,'signal');
 const echec=await etape(b,'echec');assert.match(echec.motif,/pas prêt/);
 assert.equal(b.get('relecture').passe.etat,'en-pause');assert.match(b.get('relecture').passe.message,/Recharge ESV \(F5\), reconnecte-la, puis reprends la relecture/);
 assert.equal(H.evenements(b,'relecture-ombre').length,3);assert.equal(adapter.rechargements,1);
 /* L'opérateur reprend lui-même une fois ESV revenu : la passe finit sans revoir les cuts relus. */
 adapter.muet=false;adapter.rechargee=true;await b.api('relecture-reprendre');const fin=await H.finPasse(b);
 assert.equal(fin.etat,'finie');assert.equal(fin.faits,7);assert.equal(H.evenements(b,'relecture-ombre').length,7);
});
