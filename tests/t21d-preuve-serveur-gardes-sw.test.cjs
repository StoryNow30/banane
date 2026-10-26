'use strict';
/* T21d (fiches/H_PREUVE_SERVEUR.md, correctif 1) — PREUVE SERVEUR : CE QUI NE DOIT PAS ÊTRE RATTACHÉ, ET RIEN DE CHANGÉ AU LOT (suite de t21d-preuve-serveur-sw). Sur le lot de la 4:2, l'écriture de validation 204 partait
 * 182 à 456 ms APRÈS la navigation sur laquelle le lot avance : elle n'était jamais jointe au cut, et `applied-verified.serverConfirmed` était faux
 * par construction. Service worker réel en VM, moteur réel, ESV simulé, écritures de l'observateur passif relayées par le montage
 * tests/helpers/d3-ecritures.cjs (forme de src/esv-observer.js). Instrumentation seulement : commandes, état du lot et preuve de validation inchangés. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lot,J}=require('./helpers/d3-ecritures.cjs');
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const ev=(r,t)=>r.b.store.events.filter(e=>e.type===t);
const neutre=x=>JSON.parse(JSON.stringify(x).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<h>'));
/* Validation du lot (cuts 100 à 102), puis l'écriture 204 de la ligne relayée `apres[cut]` ms plus tard (après la navigation), corps de validation. */
const apres=delais=>cut=>delais[cut]===undefined?[]:[{status:204,rowIndex:cut,apresMs:delais[cut],debutMs:Date.now()+delais[cut]}];
const visites=r=>r.e.s.records.filter(x=>x.commandSent);

test('aucune décision, commande ni attente changée : mêmes commandes et même lot avec ou sans l’observateur passif',async()=>{
 const avec=await lot({ecritures:apres({100:182,101:300,102:456})}),sans=await lot({ecritures:apres({100:182,101:300,102:456}),observateur:false});await attendre(700);
 assert.deepEqual(neutre(avec.b.commands),neutre(sans.b.commands));assert.deepEqual(avec.journal,sans.journal);assert.equal(avec.etat,sans.etat);assert.deepEqual(avec.traites,sans.traites);
 assert.equal(ev(sans,'validation-ecriture-observee').length,0,'sans observateur : rien n’est rattaché');assert.ok(visites(sans).every(x=>x.serverConfirmed===false));
});

test('écriture refusée (500, rien ensuite) : rien n’est rattaché, le refus garde son chemin (événement et pause)',async()=>{
 const r=await lot({ecritures:cut=>cut===100?[{status:500,apresMs:200}]:[]});await attendre(400);
 assert.equal(ev(r,'ecriture-refusee').length,1);assert.equal(ev(r,'validation-ecriture-observee').length,0);
 assert.ok(visites(r).every(x=>x.serverConfirmed===false));
});

test('écriture absente (102), corps sans « traité par l’opérateur » (100), ou ligne d’un autre cut (101) : rien n’est rattaché',async()=>{
 const r=await lot({ecritures:cut=>cut===100?[{status:204,rowIndex:cut,apresMs:200,body:{ExtractionStatus:'valid'}}]:cut===101?[{status:204,rowIndex:500,apresMs:200}]:[]});await attendre(400);
 assert.equal(ev(r,'validation-ecriture-observee').length,0);assert.ok(visites(r).every(x=>x.serverConfirmed===false));
 assert.equal(r.e.closureSummary().withoutServerConfirmation.length,3,'les trois cuts restent « sans confirmation »');
});
