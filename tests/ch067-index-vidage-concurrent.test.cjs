'use strict';
/* CH-067 (audit de CH-058) — l'index du journal en mémoire (src/journal-index.js) doit rester un SUR-ENSEMBLE des clés en base.
 * Défaut : les enveloppes de suppression (`clearAll`, `deleteIfUnchanged`, `deleteMany`, `deleteEvent`, `deleteRecord`) retirent les
 * clés de l'index APRÈS la fin de la suppression. Une écriture de la même clé (ou, pour `clearAll`, de n'importe quelle clé) lancée
 * PENDANT la suppression est notée dans l'index à l'appel, s'écrit en base après la suppression (IndexedDB ordonne les transactions),
 * puis l'enveloppe la retire de l'index : l'objet est en base, l'index ne le connaît plus, `pret` reste vrai, aucune incohérence n'est
 * vue (une clé MANQUANTE de l'index ne déclenche pas le repli) et la lecture bornée le perd jusqu'au prochain redémarrage du service worker.
 * Scénarios concrets :
 *  1. « Vider le cache » (clearAll) pendant que l'observateur passif écrit un `esv-observation` : l'événement survit en base, la liste
 *     de corrections et la fin de lot (lireParType) ne le voient plus ;
 *  2. vidage automatique de l'Écho (`deleteIfUnchanged('records', …)`) pendant que le moteur réécrit la même visite (libellé posé à la
 *     clôture, CH-037) : la visite réécrite est en base, l'export de la session (`lireVisitesNatif`) ne l'emporte plus.
 * Magasin factice, données synthétiques.   node --test tests/ch067-index-vidage-concurrent.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict');
const JI=require('../src/journal-index.js');
const TYPES=['esv-observation','validation-accepted'];

/* Magasin de la forme de BananeStorage3 : une écriture et une suppression sont des transactions qui se terminent plus tard
 * (un tour de boucle par `pause`), dans l'ordre où elles ont été lancées, comme IndexedDB. */
function magasin(){const m={clouds:new Map(),events:new Map(),records:new Map()},pause=()=>new Promise(r=>setImmediate(r));
  let file=Promise.resolve();const tx=f=>{const p=file.then(async()=>{await pause();return f();});file=p.catch(()=>{});return p;};
  const tri=n=>[...m[n].keys()].sort();
  const db={transaction:nom=>{const t={oncomplete:null,onerror:null,onabort:null};let attente=0;
    const req=f=>{const q={onsuccess:null};attente++;setImmediate(()=>{q.result=f();q.onsuccess&&q.onsuccess();if(--attente===0)setImmediate(()=>t.oncomplete&&t.oncomplete());});return q;};
    t.objectStore=()=>({get:k=>req(()=>structuredClone(m[nom].get(k))),getAll:()=>req(()=>tri(nom).map(k=>structuredClone(m[nom].get(k)))),getAllKeys:()=>req(()=>tri(nom))});
    setImmediate(()=>{if(attente===0)t.oncomplete&&t.oncomplete();});return t;}};
  return {m,open:async()=>db,
    putEvent:e=>tx(()=>{m.events.set(e.eventId,structuredClone(e));}),putRecord:r=>tx(()=>{m.records.set(r.recordId||r.id,structuredClone(r));}),
    deleteEvent:id=>tx(()=>{m.events.delete(id);}),deleteRecord:id=>tx(()=>{m.records.delete(id);}),
    deleteMany:(n,ids)=>tx(()=>{let k=0;for(const id of ids)if(m[n].delete(id))k++;return k;}),
    deleteIfUnchanged:(n,ids)=>tx(()=>{const s=[];for(const id of ids)if(m[n].delete(id))s.push(id);return {supprimes:s,gardes:[]};}),
    /* Trois magasins vidés l'un après l'autre (src/storage.js : une transaction par magasin). */
    clearAll:async()=>{for(const n of ['clouds','events','records'])await tx(()=>{m[n].clear();});},
    all:async n=>{await pause();return tri(n).map(k=>structuredClone(m[n].get(k)));},keys:async n=>tri(n)};}

test('vider le cache pendant une écriture : l’événement écrit après le vidage reste en base ET dans la lecture bornée',async()=>{
  const base=magasin(),s=JI.equiper(base,{types:TYPES});
  await s.putEvent({eventId:'e-avant',type:'esv-observation',kind:'write',status:200});await s.indexJournal.construire();
  const vidage=s.clearAll();                                                   /* l'opérateur clique « Vider le cache » */
  /* `events` est vidé, `records` ne l'est pas encore : clearAll n'a pas rendu la main. */
  while(base.m.events.size)await new Promise(r=>setImmediate(r));
  const ecriture=s.putEvent({eventId:'e-pendant',type:'esv-observation',kind:'write',status:200});   /* l'observateur écrit pendant le vidage */
  await Promise.all([vidage,ecriture]);
  const enBase=(await s.all('events')).filter(e=>TYPES.includes(e.type)).map(e=>e.eventId);
  assert.deepEqual(enBase,['e-pendant'],'scénario : l’événement écrit pendant le vidage survit en base');
  const borne=(await s.lireParType(['esv-observation'])).filter(e=>e.type==='esv-observation').map(e=>e.eventId);
  assert.deepEqual(borne,enBase,'la lecture bornée doit rendre ce que rend « tout lire puis filtrer »');
});

test('vidage de l’Écho (deleteIfUnchanged) pendant la réécriture de la même visite : l’export de la session l’emporte',async()=>{
  const base=magasin(),s=JI.equiper(base,{types:TYPES});
  await s.putRecord({recordId:'v1',nativeSessionId:'S',label:null});await s.indexJournal.construire();
  const vidage=s.deleteIfUnchanged('records',['v1'],{v1:'sig'},()=>'sig');       /* la visite exportée est retirée */
  const reecriture=s.putRecord({recordId:'v1',nativeSessionId:'S',label:'VALIDATE'});   /* le moteur réécrit la visite (libellé) */
  await Promise.all([vidage,reecriture]);
  const enBase=(await s.all('records')).filter(r=>r.nativeSessionId==='S').map(r=>r.recordId+':'+r.label);
  assert.deepEqual(enBase,['v1:VALIDATE'],'scénario : la visite réécrite est en base');
  const export_=(await s.lireVisitesNatif('S')).filter(r=>r.nativeSessionId==='S').map(r=>r.recordId+':'+r.label);
  assert.deepEqual(export_,enBase,'l’export de la session doit emporter la visite réécrite');
});

test('suppression d’un événement pendant sa réécriture (deleteEvent) : la lecture bornée garde l’objet en base',async()=>{
  const base=magasin(),s=JI.equiper(base,{types:TYPES});
  await s.putEvent({eventId:'e1',type:'validation-accepted',n:1});await s.indexJournal.construire();
  await Promise.all([s.deleteEvent('e1'),s.putEvent({eventId:'e1',type:'validation-accepted',n:2})]);
  const enBase=(await s.all('events')).filter(e=>e.type==='validation-accepted').map(e=>e.n);
  assert.deepEqual(enBase,[2]);
  assert.deepEqual((await s.lireParType(['validation-accepted'])).filter(e=>e.type==='validation-accepted').map(e=>e.n),enBase);
});
