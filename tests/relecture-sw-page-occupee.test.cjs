'use strict';
/* 4.9.5.13 — LA PAGE EST OCCUPÉE PAR UNE CAPTURE : REFUS TRANSITOIRE. Terrain, partie 19 du 19/10 : la relecture « corriger » s'est arrêtée à 156 cuts
 * sur 574 sur « passage au cut 5042 refusé par la page (Action d'Ariane en cours dans ESV (capture) …) ». Ce refus (`ADAPTER_BUSY`) dit seulement
 * qu'une action de la page n'est pas finie : la page n'a rien envoyé à ESV. La passe attend la fin de l'action et redemande le passage (délais et
 * nombre d'essais bornés, chaque attente consignée : `relecture-navigation-attente`) ; la page refuse toujours de naviguer pendant une capture.
 * Un refus qui dure au-delà des essais, ou un refus définitif (autre code), arrête la passe comme avant. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,apresLot}=require('./helpers/relecture-essais.cjs');
const OCCUPE={occupeAttentesMs:[20,40,80]};

test('refus « action en cours » passager : la passe attend, redemande, puis continue ; chaque attente est consignée', async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'ombre',relecture:OCCUPE,esv:a=>{let n=0;a.refusAller=cut=>cut===109&&n++<2?'ADAPTER_BUSY':null;}});
 const p=await H.finPasse(b);
 assert.equal(p.etat,'finie',p.message);
 const allees=adapter.allees.filter(x=>x.cut===109);assert.equal(allees.length,3,'deux refus, puis le passage');
 assert.equal(new Set(allees.map(x=>x.operationId)).size,3,'une opération neuve par demande');
 const e=H.evenements(b,'relecture-navigation-attente');
 assert.deepEqual(e.map(x=>[x.identity.cut,x.code,x.essai,x.attenteMs]),[[109,'ADAPTER_BUSY',1,20],[109,'ADAPTER_BUSY',2,40]]);
 assert.ok(allees[1].t-allees[0].t>=18,'attente avant la deuxième demande');
 assert.equal(apresLot(b,lot).some(c=>['apply','validerMajEspace'].includes(c.action)),false);
});

test('refus « action en cours » qui dure : la passe s’arrête après les essais bornés ; un refus définitif l’arrête sans attendre', async()=>{
 const {b,adapter}=await H.lotRelecture({mode:'ombre',relecture:OCCUPE,esv:a=>{a.refusAller=cut=>cut===109?'ADAPTER_BUSY':null;}});
 const p=await H.finPasse(b);
 assert.equal(p.etat,'erreur');assert.match(p.message,/passage au cut 109 refusé par la page \(refus simulé \(ADAPTER_BUSY\)/);
 assert.match(p.message,/4 demandes/);
 assert.equal(adapter.allees.filter(x=>x.cut===109).length,4,'1 + 3 essais');
 assert.equal(H.evenements(b,'relecture-navigation-attente').length,3);
 adapter.refusAller=cut=>cut===109?'WRONG_PART':null;
 await b.api('relecture-lancer');const q=await H.finPasse(b);
 assert.equal(q.etat,'erreur');assert.match(q.message,/WRONG_PART/);
 assert.equal(H.evenements(b,'relecture-navigation-attente').length,3,'aucune attente de plus');
});
