'use strict';
/* Test 17 (D-232 à D-234) — LE RÉGLAGE « PAUSE ET REPRISE » : éteint par défaut (nouveauté non prouvée = livrée coupée). Éteint : la relecture est exactement celle d'avant
 * (« Pause » refusée, aucun point gardé, un F5 l'arrête en erreur) ; le réglage se lit et se change par le service worker, jamais pendant une passe. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause}=require('./helpers/relecture-pause.cjs');
const js=x=>JSON.parse(JSON.stringify(x));   /* les objets du service worker viennent d'un autre contexte : on compare leur contenu */

test('réglage éteint (installation neuve) : « Pause » refusée, aucun point, aucun événement de pause ; la passe finit comme avant',async()=>{
 let demande=null,lu=null;
 const {b}=await lotPause({actif:null,esv:(a,bb)=>{a.surAller=async t=>{if(t.cut!==109||demande)return;lu=await bb.api('relecture-pause-reglage-etat');demande=await bb.api('relecture-pause').then(()=>'accepté',e=>e.message);}}});
 const p=await H.finPasse(b);
 assert.deepEqual(js(lu),{actif:false,f5:'pause'},'éteint par défaut');assert.match(demande,/éteinte dans les réglages/);
 assert.equal(p.etat,'finie');assert.equal(p.faits,7);
 assert.equal('banane51RelectureReprise' in b.local.m,false);assert.equal(H.evenements(b,'relecture-pause').length,0);
 const etat=await b.api('relecture-etat');assert.equal(etat.repriseReglage.actif,false);assert.equal(etat.passe.reprise,false);
});
