'use strict';
/* CH-086 : arrêt simulé du service worker après CHAQUE écriture confirmée de la fenêtre (du retour de la validation à la pose suivante),
 * magasin « fifo ». init() retrouve un état sûr, IndexedDB rattrape l'état, la reprise ne pose ni ne valide jamais deux fois, aucun SKIP. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {patchOk,Engine,K,S,ALLUME,ETEINT,StoreLent,ESV,scope,lot,normaliser,enregistrements,arretsFenetre}=require('./helpers/ch086.cjs');
test('le patch s’applique au tronc (ou le tronc le porte)',patchOk);
for(const navigationSeule of [false,true])
 test(`arrêt après chaque écriture de la fenêtre (navigation seule ${navigationSeule}, fifo) : état sûr, rien de perdu, jamais de double`,async()=>{
  const o=await arretsFenetre({navigationSeule,ordre:'fifo'});
  assert.ok(o.points>=12,'points de la fenêtre : '+o.points);assert.ok(o.reprises>0,'init() a réécrit des écritures de la fenêtre');
  assert.ok(o.etats.length>=2,'plusieurs issues de reprise : '+JSON.stringify(o.etats));
 });
