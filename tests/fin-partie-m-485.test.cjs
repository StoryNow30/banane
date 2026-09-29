'use strict';
/* D-062 (b), version de test 2 — FIN DE PARTIE MÉMORISÉE SEULEMENT SUR PREUVE.
 * Après le départ d'ESV au différé du cut N (D3), la fin de la partie n'est
 * mémorisée que si, à la reprise, ESV affiche une partie SUPÉRIEURE et que N
 * vaut M−1, M étant le nombre de cuts de la partie relevé par D4 (numérotation
 * à partir de 0, D-062 (a)). Sinon le lot se ferme sans rien mémoriser, avec
 * « le cut N pourrait être le dernier ; saisis-le comme dernier cut si tu veux
 * le retenir ». Aucune commande n'est renvoyée. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {dernierDiffere,navs,panneau}=require('./helpers/fin-partie.cjs');
const PEUT_ETRE=/le cut 100 pourrait être le dernier de la partie ; saisis-le comme dernier cut si tu veux le retenir/;
async function reprise(r,part,cut=1){Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part,cut});return r.b.api('resume');}
const fin=r=>r.b.api('bornes-partie',{part:23});

test('N = M−1 et partie supérieure : lot fermé, fin de partie mémorisée, rien renvoyé',async()=>{
  const {r,view}=await dernierDiffere({},{total:101});
  assert.equal(view.batch.departApresDiffere.total,101,'M relevé au départ');
  const depart=r.b.store.events.find(e=>e.type==='fin-partie-depart');
  assert.ok(depart,'départ journalisé');assert.equal(depart.cut,100);assert.equal(depart.total,101);assert.equal(depart.part,23);
  const v=await reprise(r,24);
  assert.equal(v.batch.state,'STOPPED');assert.match(v.notice,/Fin du lot : ESV est passée à la partie 24 ; le cut 100 est le dernier de la partie 23 \(101 cuts, de 0 à 100\)/);
  const f=await fin(r);assert.equal(f.last,100);assert.equal(f.source,'fin constatée après différé (M−1)');
  assert.equal(navs(r),1,'aucune navigation renvoyée');
  const ev=r.b.store.events.filter(e=>e.type==='batch-stopped-at-end').at(-1);assert.equal(ev.total,101);assert.equal(ev.finMemorisee,true);
});
test('partie supérieure ouverte à la main après un départ qui n’est pas une fin : lot fermé, rien mémorisé',async()=>{
  const {r,view}=await dernierDiffere({},{total:6732});
  assert.match(view.notice,/ESV a quitté la page après le différé du cut 100/);assert.doesNotMatch(view.notice,/fin de partie probable/,'100 n’est pas 6731');
  const v=await reprise(r,24);
  assert.equal(v.batch.state,'STOPPED');assert.match(v.notice,PEUT_ETRE);assert.match(v.notice,/6732 cuts : le dernier est le 6731/);
  assert.equal(await fin(r),null,'rien mémorisé');assert.equal(navs(r),1);
  assert.equal(r.b.store.events.filter(e=>e.type==='batch-stopped-at-end').at(-1).finMemorisee,false);
});
test('M absent (compteur illisible) : lot fermé, rien mémorisé',async()=>{
  const {r,view}=await dernierDiffere();
  assert.equal(view.batch.departApresDiffere.total,null);
  assert.equal(r.b.store.events.find(e=>e.type==='fin-partie-depart').total,null,'M absent journalisé comme tel');
  const v=await reprise(r,24);
  assert.equal(v.batch.state,'STOPPED');assert.match(v.notice,PEUT_ETRE);assert.match(v.notice,/nombre de cuts de la partie illisible/);
  assert.equal(await fin(r),null);
});
test('partie inférieure : lot fermé, rien mémorisé, aucun conseil de rouvrir la partie suivante',async()=>{
  const {r}=await dernierDiffere({},{total:101});
  const v=await reprise(r,22,5);
  assert.equal(v.batch.state,'STOPPED');assert.match(v.notice,PEUT_ETRE);assert.doesNotMatch(v.notice,/[Rr]ouvre la partie suivante/);
  assert.equal(await fin(r),null);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),/[Rr]ouvre la partie suivante/);
});
test('même partie affichée : lot fermé, rien mémorisé, contrôle du cut demandé, pas compté comme différé',async()=>{
  const {r}=await dernierDiffere({},{total:101});
  const v=await reprise(r,23,100);
  assert.equal(v.batch.state,'STOPPED');assert.match(v.notice,/Lot fermé sans fin de partie : ESV affiche encore la partie 23 \(cut 100\)\. Contrôle le cut 100 dans ESV/);
  assert.doesNotMatch(v.notice,/pourrait être le dernier/,'ESV encore dans la partie : pas une fin possible à saisir');
  assert.equal(await fin(r),null);assert.equal(navs(r),1);
  assert.equal(v.batch.interrupted.at(-1).status,'DEFER_NAVIGATION_CLOSED_SAME_PART');
  const {$}=await panneau(v);assert.doesNotMatch($('lot-compteurs').innerHTML,/écartement bas\) : 100/,'pas un différé');
  assert.match($('batch').textContent,/différé non confirmé, ESV encore dans la partie/);
});
test('« M cuts » présent à côté du compteur : M vient du compteur seul',async()=>{
  const {r,view}=await dernierDiffere({},{total:101,cuts:7956});
  assert.equal(view.batch.departApresDiffere.total,101);assert.equal(view.batch.departApresDiffere.totalSource,'compteur');
  await reprise(r,24);assert.equal((await fin(r)).last,100);
});
test('« M cuts » seul (un « 101 cuts » peut compter autre chose, et vaudrait N+1) : jamais une preuve',async()=>{
  const {r,view}=await dernierDiffere({},{cuts:101});
  assert.equal(view.batch.departApresDiffere.total,null);
  const v=await reprise(r,24);assert.match(v.notice,PEUT_ETRE);assert.equal(await fin(r),null);
});
test('M incohérent (N ≥ M) : rien mémorisé, dit comme tel',async()=>{
  const {r,view}=await dernierDiffere({},{total:100});
  assert.equal(view.batch.departApresDiffere.totalSource,'incoherent');assert.match(view.notice,/fin de partie probable/);
  const v=await reprise(r,24);assert.match(v.notice,/nombre de cuts de la partie incohérent/);assert.equal(await fin(r),null);
});
test('relevé d’un autre cut, ou sans identité, au dernier passage : M non pris',async()=>{
  const {r,view}=await dernierDiffere({},{total:101});
  assert.equal(view.batch.departApresDiffere.total,101);
  const {releve}=require('./helpers/fin-partie.cjs');
  const b3=(await dernierDiffere({},{total:101})).r;
  await releve(b3.b,{pageId:'p',part:null,cut:null},{total:101});
  assert.equal(b3.b.fonction('engine').s.batch.totalReleve.cut,null,'un relevé sans identité remplace le précédent');
});
test('panneau : la fermeture sans preuve est dite, et compte le cut parmi les différés',async()=>{
  const {r}=await dernierDiffere({},{total:6732});const v=await reprise(r,24);
  assert.equal(v.batch.interrupted.at(-1).status,'DEFER_NAVIGATION_CLOSED_NO_END_PROOF');
  const {$}=await panneau(v);
  assert.match($('batch').textContent,/lot clos après le cut 100 : ESV a quitté la partie après le différé, sans preuve de fin/);
  assert.match($('lot-compteurs').innerHTML,/refusés \(écartement bas\) : 100/);
});
