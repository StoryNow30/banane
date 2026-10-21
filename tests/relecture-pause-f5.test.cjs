'use strict';
/* 4.9.6 (D-232, D-233) — F5 PENDANT LA RELECTURE, service worker réel, réglage allumé :
 *  - « pause » (par défaut) : ESV muet pendant un cut → la passe se met EN PAUSE au cut non fait, garde son point ; « Reprendre » est refusé tant qu'ESV ne répond pas,
 *    puis repart de ce cut sans repasser sur les cuts relus ;
 *  - « arret » : comme avant le 4.9.6, la passe s'arrête en erreur et rien n'est gardé. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause,attendreEtat,cutsAllees}=require('./helpers/relecture-pause.cjs');
function muet(a){const ping=a.ping.bind(a);a.ping=async()=>{if(a.muet)throw Error('Adaptateur ESV sans réponse (simulé).');return ping();};}

test('F5 au cut 110 : pause automatique au cut non fait ; reprise refusée tant qu’ESV est muet ; puis reprise sans repasser sur 108 et 109',async()=>{
 const {b,adapter}=await lotPause({esv:a=>{muet(a);a.panneCapture.add(110);}});
 const p=await attendreEtat(b,'en-pause'),cutPause=p.cut;
 assert.equal(cutPause,110,'le cut 110 n’a pas été relu : il est refait');assert.equal(p.pauseRaison,'esv');assert.equal(p.faits,2);
 assert.match(p.message,/ESV ne répond plus : relecture gardée en pause au cut 110/);
 assert.equal(H.evenements(b,'relecture-fin').length,0,'pas de relecture-fin : ni erreur ni fin');
 assert.equal(H.evenements(b,'relecture-pause')[0].raison,'esv');
 const pt=b.local.m.banane51RelectureReprise;assert.equal(pt.sel.cuts[pt.index].cut,110);assert.equal(pt.faits,2);
 /* ESV encore muet (page pas rechargée) : refus clair, la passe reste en pause. */
 adapter.muet=true;
 await assert.rejects(b.api('relecture-reprendre'),/Relecture non reprise : ESV ne répond pas/);
 assert.equal(b.get('relecture').passe.etat,'en-pause');
 /* ESV répond de nouveau. */
 adapter.muet=false;adapter.panneCapture.clear();const avant=cutsAllees(adapter).length;
 await b.api('relecture-reprendre');const fin=await H.finPasse(b);
 assert.equal(fin.etat,'finie');assert.equal(fin.faits,7);
 const apres=cutsAllees(adapter).slice(avant);assert.equal(apres[0],110);for(const c of [108,109])assert.equal(apres.includes(c),false,`le cut ${c} n’est pas revisité`);
 assert.equal(H.evenements(b,'relecture-fin').length,1);assert.equal(H.evenements(b,'relecture-fin')[0].issue,'fin');
 assert.equal(H.evenements(b,'relecture-reprise')[0].raisonPause,'esv');
});
