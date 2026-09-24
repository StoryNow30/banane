'use strict';
/* RELECTURE INDÉPENDANTE 4.7.12 (audit/chantiers/relecture-478.md, constat I3).
 * KI-052 est corrigé pour le chemin documenté : passer au cut suivant, archiver,
 * reprendre. Si l'opérateur clique « Reprendre » AVANT de quitter le cut
 * archivé, la reprise recapture ce cut, `Engine.apply()` refuse d'écrire
 * (cible bloquée) et le lot passe en ERROR, état que « Reprendre » n'accepte
 * plus ; « Arrêter » puis « Reprendre » sur le cut suivant échoue aussi (cible
 * différente). Aucune commande n'est envoyée, mais le lot est perdu, et avec
 * lui la mémoire des appuis. Corrigé en 4.7.14 : « Reprendre » sur le cut archivé est refusé
 * avant tout changement d'état ; le lot reste arrêté et reprend au cut suivant. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {background}=require('./helpers/fond-relecture.cjs');
test('« Reprendre » sur le cut archivé est refusé ; au cut suivant, le lot reprend',async()=>{
  const b=background();let fail=true;const apply=b.adapter.apply.bind(b.adapter);
  b.adapter.apply=async(...a)=>{if(fail){fail=false;throw Error('Position proposée hors de la vue : left');}return apply(...a);};
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  await b.api('start',{part:23,start:100,end:102,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});
  await b.settle();await b.api('close-uncertain');
  await assert.rejects(b.api('resume'),/résultat incertain archivé.*Passe au cut suivant/);   // reprise sans quitter le cut archivé
  let view=await b.api('view');assert.equal(view.batch.state,'STOPPED','le lot reste arrêté, reprenable');
  assert.deepEqual(b.adapter.calls.filter(c=>c!=='capture'),[],'aucune commande autre que la lecture');
  await b.adapter.next();                                                     // l'opérateur passe au cut suivant
  await b.api('resume');view=await b.settle();
  assert.deepEqual(view.batch.processed.map(x=>x.cut),[101,102],view.batch.error?.message);   // le lot va au bout de sa plage
});

test('« Arrêter » puis « Reprendre » après être passé au cut suivant : le lot reprend',async()=>{
  const b=background();let fail=true;const apply=b.adapter.apply.bind(b.adapter);
  b.adapter.apply=async(...a)=>{if(fail){fail=false;throw Error('Position proposée hors de la vue : left');}return apply(...a);};
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  await b.api('start',{part:23,start:100,end:102,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});
  await b.settle();await b.api('close-uncertain');await assert.rejects(b.api('resume'));
  await b.api('stop');await b.adapter.next();await b.api('resume');const view=await b.settle();
  assert.deepEqual(view.batch.processed.map(x=>x.cut),[101,102],view.batch.error?.message);
});
