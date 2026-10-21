'use strict';
/* Test 17 (D-232 à D-234) — LE RÉGLAGE « PAUSE ET REPRISE », suite (un fichier à part : chaque fichier d'essai tient en moins de 20 s) : éteint par défaut (nouveauté non prouvée = livrée coupée). Éteint : la relecture est exactement celle d'avant
 * (« Pause » refusée, aucun point gardé, un F5 l'arrête en erreur) ; le réglage se lit et se change par le service worker, jamais pendant une passe. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause}=require('./helpers/relecture-pause.cjs');
const js=x=>JSON.parse(JSON.stringify(x));   /* les objets du service worker viennent d'un autre contexte : on compare leur contenu */

test('réglage éteint puis F5 : erreur comme avant ; réglage lu, changé et refusé pendant une passe',async()=>{
 let pendant=null;
 const {b}=await lotPause({actif:false,esv:(a,bb)=>{a.panneCapture.add(110);a.surAller=async t=>{if(t.cut!==108||pendant)return;pendant=await bb.api('relecture-pause-reglage',{actif:true,f5:'arret'}).then(()=>'accepté',e=>e.message);};}});
 const p=await H.finPasse(b);
 assert.match(pendant,/Relecture en cours ou en pause : change ce réglage après sa fin/);
 assert.equal(p.etat,'erreur');assert.equal(H.evenements(b,'relecture-pause').length,0);assert.equal('banane51RelectureReprise' in b.local.m,false);
 /* Passe finie : le réglage se change. */
 assert.deepEqual(js(await b.api('relecture-pause-reglage',{actif:true,f5:'arret'})),{actif:true,f5:'arret'});
 assert.deepEqual(js(await b.api('relecture-pause-reglage-etat')),{actif:true,f5:'arret'});
 assert.deepEqual(js(await b.api('relecture-pause-reglage',{actif:'oui',f5:'n’importe quoi'})),{actif:false,f5:'pause'},'valeurs inconnues : éteint, pause');
});
