'use strict';
/* Test 17 (D-232 à D-234) — STOCKAGE DÉFAILLANT ET DOUBLE CLIC : si le point de reprise ne peut pas être écrit (stockage plein ou illisible), la pause fonctionne en mémoire
 * (le journal dit « stocke: false ») mais ne survit pas à un redémarrage du service worker (la passe est alors close « interrompue », comme avant la pause) ;
 * deux clics rapides sur « Pause » ne font qu'une pause. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production}=require('./helpers/perf-production.cjs');
const {H,lotPause,attendreEtat}=require('./helpers/relecture-pause.cjs');
const attendre=ms=>new Promise(r=>setTimeout(r,ms));

test('point de reprise illisible : pause et reprise en mémoire, rien après un redémarrage ; deux clics sur Pause = une pause',async()=>{
 let d1=null,d2=null;
 const {b,adapter,local}=await lotPause({esv:(a,bb)=>{const set=bb.ctx.chrome.storage.local.set.bind(bb.ctx.chrome.storage.local);
  bb.ctx.chrome.storage.local.set=async o=>{if(o&&'banane51RelectureReprise' in o)throw Error('QUOTA_BYTES (simulé)');return set(o);};
  a.surAller=async t=>{if(t.cut!==109||d1)return;d1=await bb.api('relecture-pause');d2=await bb.api('relecture-pause');};}});
 const p=await attendreEtat(b,'en-pause');
 assert.equal(d1.pauseDemandee,true);assert.equal(d2.pauseDemandee,true,'le second clic ne change rien');
 assert.equal(H.evenements(b,'relecture-pause').length,1,'une seule pause journalisée');assert.equal(H.evenements(b,'relecture-pause')[0].stocke,false);
 assert.equal('banane51RelectureReprise' in local.m,false);
 /* Redémarrage : le point n'existe pas, la passe n'est pas ressuscitée. */
 const c=production({adapter,local,store:b.store});await c.api('view');await attendre(60);assert.equal((await c.api('relecture-etat')).passe,null);
 /* En mémoire, la reprise marche encore (service worker non redémarré). */
 await b.api('relecture-reprendre');const fin=await H.finPasse(b);assert.equal(fin.etat,'finie');assert.equal(fin.faits,7);
});
