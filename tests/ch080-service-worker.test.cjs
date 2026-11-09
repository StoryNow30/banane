'use strict';
/* CH-080 (D-309) — LE SERVICE WORKER JOINT LA COUPE SUIVANTE CONNUE À LA CAPTURE DE LA RELECTURE, JAMAIS À CELLE DU LOT.
 * Vrai service worker en vm (tests/helpers/relecture-lot.cjs : un lot puis sa relecture contre un ESV simulé). Il prouve :
 *  - chaque capture de la relecture porte `prechauffage` {part, de : son cut, cut : le prochain cut que la relecture capture, source:'relu', op} ;
 *  - la dernière capture de la relecture n'en porte pas (plus rien à relire) ;
 *  - aucune capture du lot n'en porte (commandes du lot identiques à l'octet : tests/choix-lot-clic-sw.test.cjs). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('./helpers/relecture-lot.cjs');

test('relecture : cible = prochain cut relu ; lot : aucune cible',async()=>{
 const x=await H.lotRelecture({mode:'ombre'});await H.finPasse(x.b);
 const caps=x.b.commands.filter(c=>c.action==='capture').map(c=>({cut:c.args[0]?.identity?.cut,part:c.args[0]?.identity?.part,h:c.args[0]?.prechauffage}));
 const premiere=caps.findIndex(c=>c.h);assert.ok(premiere>0,'des captures du lot précèdent la relecture');
 assert.ok(caps.slice(0,premiere).every(c=>c.h===undefined),'aucune capture du lot ne porte de cible');
 const rel=caps.slice(premiere);assert.ok(rel.length>=3,'la relecture capture plusieurs cuts : '+rel.length);
 for(let i=0;i<rel.length;i++){const c=rel[i],suiv=rel.slice(i+1).find(d=>d.cut!==c.cut);
  if(!suiv){assert.equal(c.h,undefined,'dernière capture : rien à préchauffer');continue;}
  assert.deepEqual({part:c.h.part,de:c.h.de,cut:c.h.cut,source:c.h.source},{part:c.part,de:c.cut,cut:suiv.cut,source:'relu'},`capture du cut ${c.cut}`);
  assert.equal(typeof c.h.op,'string');assert.ok(c.h.op.length>0,'identifiant d’opération');}
 assert.equal(new Set(rel.filter(c=>c.h).map(c=>c.h.op)).size,rel.filter(c=>c.h).length,'un identifiant par capture');
});

test('passe des différés : la capture du 112 porte le cut suivant de la passe (114) ; la dernière, rien',async()=>{
 const {lotPasse,relancer}=require('./helpers/passe-differes.cjs');
 const x=await lotPasse({passe:{passes:1},deux:true});await relancer(x);
 const caps=x.b.commands.filter(c=>c.action==='capture'&&c.args[0]?.prechauffage).map(c=>({cut:c.args[0].identity.cut,h:c.args[0].prechauffage}));
 assert.deepEqual(caps.map(c=>[c.cut,c.h.de,c.h.cut,c.h.source]),[[112,112,114,'passe-differes']],'une cible, celle du cut suivant de la passe');
 const tous=x.b.commands.filter(c=>c.action==='capture').map(c=>c.args[0]?.identity?.cut);assert.ok(tous.includes(114),'le 114 est capturé, sans cible (dernier)');
});
