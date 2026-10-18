'use strict';
/* 5.0 (D-170 à D-176) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : le fichier de réglages
 * proposé RÉEL (datasets/relecture-reglages-proposes.json, chantier claude/50-zones-autonomes), servi à la passe comme dans
 * l'extension. En « corriger » (D-180), un vert de PN ou d'abords prouvé qui passe la règle est corrigé ; un cut différé par le lot
 * n'est jamais touché ; sous 8 mm, rien. Le premier cut du PN, corrigeable, est atteint par un pas après un saut au cut d'avant, jamais posé
 * juste après le saut (revue, correction 3). Données synthétiques ; la zone PN est donnée par un événement des règles métier du lot. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {H,j,apresLot,posesApresSaut}=require('./helpers/relecture-essais.cjs');
const FICHIER=JSON.parse(fs.readFileSync(path.join(__dirname,'../datasets/relecture-reglages-proposes.json'),'utf8'));

test('fichier réel : verts de PN et d’abords corrigés (8 mm et plus, premier cut du PN atteint par un pas), sous 8 mm laissé, différé du lot jamais touché',async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',decisions:{107:12,108:6,109:14,115:20},reglagesProposes:FICHIER,relecture:{departMs:150}});
 /* Le lot a reconnu un PN (règles métier en ombre) : plage à contrôler 107–110. */
 const lotId=b.get('engine').s.batch.id;
 b.store.events.push({eventId:'pn-essai',timestamp:new Date().toISOString(),type:'regles-metier-ombre',portee:'cut',batchId:lotId,identity:{part:23,cut:111},zone:{pnControle:[107,110]}});
 const p=await H.finPasse(b);
 const debut=H.evenements(b,'relecture-debut')[0];
 assert.deepEqual(j(debut.reglages),{source:'propose',statut:'propose',refus:null,invalides:[],correctionPermise:true,raison:null,zones:{pn:true,adv:true,abords:true,'vert-hors-zone':false}});assert.equal(debut.variante,'chaine+h');assert.equal(debut.modeEffectif,'corriger');
 assert.deepEqual(j(debut.parZone),{pn:4,adv:0,abords:4,'vert-hors-zone':0,ecartement:0},'107–110 en PN ; 113 à 116 aux abords');
 assert.deepEqual(j(debut.plages.map(x=>[x.debut,x.fin,x.zone])),[[107,110,'pn'],[111,116,'abords']],'une plage par type de zone');
 assert.equal(p.etat,'finie',p.message);assert.equal(p.corriges,3);
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[107,109,115]);
 assert.deepEqual(adapter.allees.slice(0,4).map(a=>[a.cut,a.chemin]),[[106,'auto'],[107,'pas'],[108,'pas'],[109,'pas']],'saut au cut 106, pas vers 107 ; Maj+Espace valide sur place, puis un pas vers 108');
 assert.deepEqual(posesApresSaut(apresLot(b,lot)),[],'aucune pose juste après un saut');
 const ev=H.evenements(b,'relecture-ombre'),de=c=>ev.find(e=>e.identity.cut===c);
 assert.equal(de(107).zone,'pn');assert.equal(de(107).action,'corrige');assert.equal(de(107).arrivee,'pas');
 assert.equal(de(109).zone,'pn');assert.equal(de(109).action,'corrige');assert.equal(de(109).critere.regle,'ok');
 assert.equal(de(108).critere.regle,'seuil','6 mm : sous les 8 mm du fichier');assert.equal(de(108).arrivee,'pas');
 assert.equal(de(115).zone,'abords');assert.equal(de(115).action,'corrige');assert.equal(de(115).critere.regle,'ok','abords : corriger=true (D-180), mêmes gardes que le PN');
 assert.equal(de(113).role,'differe');assert.notEqual(de(113).action,'corrige');
 assert.equal(apresLot(b,lot).filter(c=>c.action==='apply').length,3);
});
