'use strict';
/* CH-062 — SIGNAL D'ESV ÉTEINT PENDANT LE LOT : après le rechargement, ESV rouvre une AUTRE partie. Ariane ne change jamais de partie elle-même :
 * le lot reste en pause, avec la consigne F5 ; rien n'est posé, rien n'est validé de plus. Montage : tests/helpers/lot-signal.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {REGLAGE,lotSignal,ev,etapes,valides,attendreLot,etape}=require('./helpers/lot-signal.cjs');

test('ESV rouvre la partie 0 : lot en pause, consigne F5, aucun changement de partie, aucun cut de plus',async()=>{
 const {b,adapter}=await lotSignal({reglage:{...REGLAGE,lectures:2,attenteRepriseMs:800},esv:{partieApres:0},end:114});
 const echec=await etape(b,'echec');await attendreLot(b,{etat:'PAUSED'});
 assert.match(echec.motif,/pas prêt/);assert.equal(adapter.rechargements,1);
 const e=b.get('engine');assert.equal(e.s.batch.state,'PAUSED','le lot reste en pause');
 assert.match(e.s.notice,/Recharge ESV \(F5\) sur la partie 23, reconnecte-la, puis clique sur Reprendre/);
 assert.equal(adapter.calls.some(c=>/changerPartie|partie/i.test(c)),false,'aucune commande de changement de partie');
 assert.equal(adapter.identity.part,0,'ESV est resté sur la partie qu’il a rouverte');
 assert.deepEqual(valides(b),[111,112],'rien de validé après la pause');
 assert.deepEqual(etapes(b),['detecte','pause','recharge','echec']);
});

test('ESV rouvre la partie 24 : « Reprendre » refuse (autre partie), le lot reste en pause avec la consigne F5, rien n’est posé',async()=>{
 const {b,adapter}=await lotSignal({reglage:{...REGLAGE,lectures:2,attenteRepriseMs:800},esv:{partieApres:24},end:114});
 const echec=await etape(b,'echec');await attendreLot(b,{etat:'PAUSED'});
 assert.match(echec.motif,/partie 24, pas la partie 23/);
 assert.equal(b.get('engine').s.batch.state,'PAUSED');assert.match(b.get('engine').s.notice,/Recharge ESV \(F5\) sur la partie 23/);
 assert.equal(adapter.identity.part,24);assert.deepEqual(valides(b),[111,112]);
 const apres=adapter.calls.slice(adapter.calls.lastIndexOf('validate')+2);   /* « validate » de l'ESV simulé appelle son propre « next » */assert.equal(apres.some(c=>['apply','validate','skip','next'].includes(c)),false,'aucune commande après la pause : '+apres);
});
