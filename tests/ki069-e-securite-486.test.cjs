'use strict';
/* KI-069 (4.8.6), essai e : une autre Ariane intervient ; la mise en sécurité de
 * D-062 (c)(d) reste valable pour la nouvelle action. `validateInPlace` n'est
 * PAS dans EN_SECURITE (elle est refusée une fois l'adaptateur en sécurité). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs');
test('intrusion : validateInPlace refusée, message « pose faite, non validée », rien ne bouge',async()=>{
  const f=page(),before=await f.call('state');
  await assert.rejects(f.raw('next',[],{proprietaire:'autre'}).promise);
  let refus=null;await f.call('validateInPlace',before.identity,{},{commande:'ctrl-entree'}).catch(e=>{refus=e.message;});
  assert.match(refus,new RegExp(`^Adaptateur ESV sans réponse : Ariane ${require('../src/core.js').VERSION_NAME.replaceAll('.', '\\.')} en sécurité`));
  assert.match(refus,/Validation refusée : la pose de ce cut est faite, non validée/);
  assert.equal(f.keyboard.length,0,'aucun raccourci émis');
  assert.equal(f.nodes.get('O2N3DCutDescription').textContent,'Cut 100 of part 23');
});
test('autre propriétaire : validateInPlace refusée sans rien émettre',async()=>{
  const f=page(),before=await f.call('state');
  await assert.rejects(f.raw('validateInPlace',[before.identity,{},{}],{proprietaire:'autre'}).promise,e=>/^Une autre Ariane/.test(e.message));
  assert.equal(f.keyboard.length,0);
});
