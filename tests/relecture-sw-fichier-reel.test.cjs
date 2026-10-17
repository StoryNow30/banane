'use strict';
/* 5.0 (D-170 à D-173) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : le fichier de réglages
 * proposé RÉEL (datasets/relecture-reglages-proposes.json, chantier claude/50-zones-autonomes), servi à la passe comme dans
 * l'extension. En « corriger », seul un vert de PN qui passe la règle est corrigé ; les abords restent en ombre ; un cut différé par le
 * lot n'est jamais touché. Données synthétiques ; la zone PN est donnée par un événement des règles métier du lot. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {H,j,apresLot}=require('./helpers/relecture-essais.cjs');
const FICHIER=JSON.parse(fs.readFileSync(path.join(__dirname,'../datasets/relecture-reglages-proposes.json'),'utf8'));

test('fichier réel : un vert de PN corrigé (8 mm et plus), les abords laissés en ombre, le différé du lot jamais touché',async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',decisions:{108:6,109:14,115:20},reglagesProposes:FICHIER,relecture:{departMs:150},
  esv:(a,bb)=>{a.surAller=null;}});
 /* Le lot a reconnu un PN (règles métier en ombre) : plage à contrôler 107–110. */
 const lotId=b.get('engine').s.batch.id;
 b.store.events.push({eventId:'pn-essai',timestamp:new Date().toISOString(),type:'regles-metier-ombre',portee:'cut',batchId:lotId,identity:{part:23,cut:111},zone:{pnControle:[107,110]}});
 const p=await H.finPasse(b);
 const debut=H.evenements(b,'relecture-debut')[0];
 assert.deepEqual(j(debut.reglages),{source:'propose',statut:'propose'});assert.equal(debut.variante,'chaine+h');
 assert.deepEqual(j(debut.parZone),{pn:4,adv:0,abords:4,'vert-hors-zone':0,ecartement:0},'107–110 en PN ; 113 à 116 aux abords');
 assert.equal(p.etat,'finie');assert.equal(p.corriges,1);
 assert.deepEqual(adapter.enPlace.map(x=>x.cut),[109]);
 const ev=H.evenements(b,'relecture-ombre'),de=c=>ev.find(e=>e.identity.cut===c);
 assert.equal(de(109).zone,'pn');assert.equal(de(109).action,'corrige');assert.equal(de(109).critere.regle,'ok');
 assert.equal(de(108).critere.regle,'seuil','6 mm : sous les 8 mm du fichier');
 assert.equal(de(115).zone,'abords');assert.equal(de(115).action,'visite');assert.equal(de(115).critere.regle,'zone','abords : corriger=false, reste en ombre');
 assert.equal(de(113).role,'differe');assert.notEqual(de(113).action,'corrige');
 assert.equal(apresLot(b,lot).filter(c=>c.action==='apply').length,1);
});
