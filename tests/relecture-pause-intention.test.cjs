'use strict';
/* Correctif de relecture (test 17) — REDÉMARRAGE DU SERVICE WORKER ENTRE LA POSE ET Maj+Espace D'UNE CORRECTION : la passe revient en pause, mais la reprise ne doit pas
 * pouvoir reposer sur ce cut tant que l'opérateur n'a pas dit « J'ai contrôlé le cut » (comme pour le départ d'un lot, un retour à un cut ou une relance : RELECTURE_INTENTION_BLOQUE). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production}=require('./helpers/perf-production.cjs');
const {H,lotPause}=require('./helpers/relecture-pause.cjs');
const {PERMISSIF}=require('./helpers/relecture-essais.cjs');
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
test('après un redémarrage entre la pose et Maj+Espace d\'une correction, « Reprendre » est refusée jusqu\'à « J\'ai contrôlé le cut »',async()=>{
 let pendu=true,origine=null;
 const {b,adapter,local}=await lotPause({mode:'corriger',decisions:{109:14,110:14},reglagesProposes:PERMISSIF,
  esv:a=>{origine=a.validerMajEspace;a.validerMajEspace=async(...x)=>pendu?new Promise(()=>{}):origine.apply(a,x);}});
 const fin=Date.now()+30000;while(!(local.m.banane50RelectureIntention||[]).length&&Date.now()<fin)await attendre(20);
 assert.equal((local.m.banane50RelectureIntention||[]).length,1,'l\'intention de la correction est notée avant Maj+Espace');
 pendu=false;
 const c=production({adapter,local,store:b.store});await c.api('view');await attendre(100);
 const e=JSON.parse(JSON.stringify(await c.api('relecture-etat')));
 assert.equal(e.passe.etat,'en-pause');assert.ok(e.correctionInterrompue,'la correction interrompue est dite');
 await assert.rejects(c.api('relecture-reprendre'),/^Error: Une correction de la relecture a été interrompue au cut 109.*J’ai contrôlé le cut 109/s);
 assert.equal((await c.api('relecture-etat')).passe.etat,'en-pause','toujours en pause, rien n\'a été posé');
 await c.api('relecture-acquitter',{part:e.correctionInterrompue.part,cut:e.correctionInterrompue.cut});
 assert.equal((await c.api('relecture-etat')).correctionInterrompue,null);
});
