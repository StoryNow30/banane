'use strict';
/* D3 (4.8.5, KI-067, D-060) — fin de partie après un différé. Terrain du 28/09,
 * partie 15 : le « suivant sans décision » envoyé depuis le dernier cut (9056,
 * sans point LiDAR) fait quitter la page à ESV ; le moteur (épinglé) le lit
 * comme une navigation sans progression et met le lot en pause. Dans un lot
 * « jusqu'à la fin de la partie », sur un cut sans pose : pause avec un message
 * clair ; à la reprise, une AUTRE partie affichée après cette navigation
 * prouve la fin (lot clos, fin retenue). Aucune commande n'est renvoyée. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {L,pilote,differe,quitte,navs,dernierDiffere,panneau,vueLot}=require('./helpers/fin-partie.cjs');
test('dernier différé, ESV quitte la page : pause, message clair, aucune commande renvoyée',async()=>{
  const {r,view}=await dernierDiffere();
  assert.equal(view.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');
  assert.match(view.notice,/ESV a quitté la page après le différé du cut 100 ; fin de partie à vérifier : clique sur Reprendre \(F5 seulement si ESV reste figée\)/,'M inconnu : à vérifier');
  assert.equal(navs(r),1,'une seule navigation');assert.equal(await r.b.api('bornes-partie',{part:23}),null,'aucune fin affirmée sans preuve');
  assert.equal((await r.b.api('view')).batch.departApresDiffere.cut,100,'le panneau reçoit le départ');
});
test('reprise sur la partie suivante, dernier cut (M−1) : lot clos, fin de partie retenue, rien renvoyé',async()=>{
  const {r}=await dernierDiffere({},{total:101});
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  const view=await r.b.api('resume');
  assert.equal(view.batch.state,'STOPPED');assert.match(view.notice,/Fin du lot : ESV est passée à la partie 24 ; le cut 100 est le dernier de la partie 23/);
  assert.equal(view.batch.stoppedAtEnd.cut,100);assert.equal(view.batch.stoppedAtEnd.reason,'navigation-other-part-after-defer');
  const f=await r.b.api('bornes-partie',{part:23});assert.equal(f.last,100);assert.equal(f.source,'fin constatée après différé (M−1)');
  assert.equal(navs(r),1,'aucune navigation renvoyée');assert.equal(r.b.adapter.calls.filter(c=>c==='capture').length,1,'aucune capture dans la partie 24');
  assert.ok(r.b.store.events.some(e=>e.type==='defer-intent-closed'),'intention clôturée, sans renvoi');
});
test('reprise sur la MÊME partie : pas de preuve de fin, lot fermé sans rien mémoriser (D-062 b), rien renvoyé',async()=>{
  const {r}=await dernierDiffere({},{total:101});
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',cut:100});
  const view=await r.b.api('resume');assert.equal(view.batch.state,'STOPPED');
  assert.match(view.notice,/ESV affiche encore la partie 23, cut 100\)[^]*Contrôle le cut 100 dans ESV/);
  assert.equal(view.batch.departApresDiffere,undefined);
  assert.equal(await r.b.api('bornes-partie',{part:23}),null);assert.equal(navs(r),1);
});
test('lot borné : comportement de la 4.8.0 (incertitude réelle, pas de fin de partie)',async()=>{
  const r=await pilote(differe,{start:100,end:105,esv:quitte});const view=await r.b.settle();
  assert.equal(view.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');assert.doesNotMatch(view.notice,/fin de partie probable/);
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  await assert.rejects(r.b.api('resume'));
  assert.notEqual((await r.b.api('bornes-partie',{part:23}))?.source,'fin constatée après différé','la borne saisie du lot reste, aucune fin constatée');
});
test('autre partie ouverte à la main au milieu d’un cut (sans ce différé) : arrêt de protection, aucune fin retenue',async()=>{
  const r=await pilote(L,{start:100,end:0,endMode:'partie',esv:esv=>{const c=esv.capture.bind(esv);
    esv.capture=async(...a)=>{const out=await c(...a);esv.identity.part=24;esv.identity.cut=7;return out;};}});
  const view=await r.b.settle();
  assert.equal(view.batch.state,'STOPPED');assert.equal(await r.b.api('bornes-partie',{part:23}),null,'rien affirmé sur la fin');
});
test('onglet sorti d’ESV pendant une lecture : erreur reprenable, comme une page absente',async()=>{
  const {background,shadowHarness}=require('./helpers/background-harness.cjs');
  const b=background({shadow:shadowHarness()});await b.api('connect',{tabId:1});
  b.fonction('chrome').tabs.get=async id=>({id,url:'https://www.example.org/'});
  await assert.rejects(b.fonction('callSur')(1,'state'),e=>e.code==='ESV_PAGE_ABSENTE'&&/n’affiche plus ESV/.test(e.message));
});
test('panneau : après le départ d’ESV au différé, « Reprendre » est proposé et la marche à suivre est dite',async()=>{
  const {$,textes}=await panneau(vueLot({departApresDiffere:{part:15,cut:9056,operationId:'op-9056',total:9057,dernier:true,at:'t'}}));
  assert.equal($('resume').hidden,false);assert.match($('notice').textContent,/fin de partie probable : clique sur Reprendre/);
  const sans=await panneau(vueLot({}));assert.equal(sans.$('resume').hidden,true,'navigation incertaine ordinaire : pas de reprise');
});

