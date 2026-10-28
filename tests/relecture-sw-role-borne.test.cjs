'use strict';
/* 5.0, revue de la relecture (D-175, correction 1) — LOT BORNÉ : le dernier cut (113), posé par le lot puis corrigé et validé par l'opérateur,
 * est un cut du lot : traversé, jamais réécrit, même s'il est dans un PN et que la règle y verrait plus de 8 mm. Au-delà de la borne,
 * un cut ROUGE (115, invalide dans la liste d'ESV) est relu en ombre mais jamais posé : la garde exige le statut `valid` lu dans ESV.
 * Un vert d'ESV au-delà de la borne (116) est corrigé (contrôle). Fichier de réglages proposé RÉEL. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {H,j,apresLot}=require('./helpers/relecture-essais.cjs');
const FICHIER=JSON.parse(fs.readFileSync(path.join(__dirname,'../datasets/relecture-reglages-proposes.json'),'utf8'));

test('lot borné : dernier cut posé puis validé par l\'opérateur jamais réécrit ; rouge au-delà de la borne relu sans pose ; vert prouvé corrigé',async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',loin:[],decisions:{113:20,115:20,116:12},reglagesProposes:FICHIER,esv:a=>{a.rouges.add(115);}});
 await H.attendre(100);
 assert.match(b.get('relecture').passe.message,/une pose d’Ariane attend ta validation au cut 113/);
 const bt=b.get('engine').s.batch;assert.equal(bt.stoppedAtEnd.cut,113);assert.equal(bt.stoppedAtEnd.applied,true);
 b.store.events.push({eventId:'pn-borne',timestamp:new Date().toISOString(),type:'regles-metier-ombre',portee:'cut',batchId:bt.id,identity:{part:23,cut:112},zone:{pnControle:[110,116]}});
 /* L'opérateur corrige le cut 113 à sa façon (9 mm) et le valide ; ESV passe au 114. */
 const mic=H.decaleDe(adapter.railsDe(113),-9);adapter.poses.set(113,mic);adapter.identity.cut=114;adapter.ajuster();
 await b.api('relecture-lancer');const p=await H.finPasse(b);
 assert.equal(p.etat,'finie',p.message);
 const ev=H.evenements(b,'relecture-ombre'),de=c=>ev.find(x=>x.identity.cut===c);
 assert.equal(de(113),undefined,'le dernier cut du lot borné est traversé, jamais relu');
 assert.ok(H.K.equalPoses(adapter.poses.get(113),mic,1e-9),'la correction de l\'opérateur reste');
 assert.equal(de(115).zone,'pn');assert.equal(de(115).critere.corriger,true,'la règle dirait « corriger »');assert.equal(de(115).action,'visite');
 assert.deepEqual(j(de(115).statutEsv),{statut:'invalid',operateur:false,vu:false});assert.match(de(115).raisonAction,/statut lu dans ESV : invalid/);
 assert.equal(de(116).action,'corrige');assert.deepEqual(adapter.majEspace.map(x=>x.cut),[116]);
 assert.deepEqual(apresLot(b,lot).filter(c=>c.action==='apply').map(c=>c.args[0].identity.cut),[116]);
 assert.equal(H.evenements(b,'relecture-debut').at(-1).sourcesLot.finDeLot,1);
});
