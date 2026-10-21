'use strict';
/* Test 17 (D-232 à D-234) — LES GARDES PENDANT LA PAUSE, service worker réel, réglage allumé :
 *  1. toutes les actions que la relecture vivante interdit (RELECTURE_BLOQUE : lot, Écho, retour à un cut, vidage du cache, réglages, relance à zéro…) sont aussi refusées
 *     pendant la pause, avec le message de la pause ; seule la connexion (nécessaire après un F5) et « Reprendre » passent ;
 *  2. « Reprendre » fait relire à la page ESV qu'une séance d'observation est ouverte (rechargée pendant la pause, elle ne l'avait pas) avant le premier cut repris.
 * Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause,attendreEtat}=require('./helpers/relecture-pause.cjs');

test('pendant la pause : tout ce que la relecture vivante interdit est refusé, la connexion et la reprise passent ; la reprise réveille l’observateur de la page',async()=>{
 let demande=null;
 const {b}=await lotPause({esv:(a,bb)=>{a.surAller=async t=>{if(t.cut!==109||demande)return;demande=await bb.api('relecture-pause');};}});
 await attendreEtat(b,'en-pause');
 const bloquees=[...b.get('RELECTURE_BLOQUE')],refus=[];
 for(const act of ['start','goto-cut','relecture-lancer','native-start','resume','retry','export-cache-clear','settings'])assert.ok(bloquees.includes(act),act+' est interdite pendant la relecture');
 for(const act of bloquees.filter(a=>a!=='connect'&&a!=='relecture-reprendre'))await b.api(act,{part:23,cut:5,start:1,end:2}).then(()=>refus.push(act+' accepté'),e=>refus.push(act+' : '+e.message));
 assert.equal(refus.length,bloquees.length-2);for(const m of refus)assert.match(m,/^[a-z-]+ : Relecture en pause/,m);
 await b.api('connect',{tabId:1});
 const envoyes=[],envoi=b.ctx.chrome.tabs.sendMessage;
 b.ctx.chrome.tabs.query=async()=>[{id:1,url:'https://esv.lidar.altametris.xyz/rails_validation/test'}];
 b.ctx.chrome.tabs.sendMessage=async(id,m)=>{envoyes.push(m?.kind);return envoi(id,m);};
 await b.api('relecture-reprendre');
 assert.ok(envoyes.includes('launcher-visibility'),'la reprise fait relire à la page ESV si une séance d’observation est ouverte');
 assert.equal((await H.finPasse(b)).etat,'finie');
});
