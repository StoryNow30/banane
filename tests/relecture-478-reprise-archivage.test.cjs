'use strict';
/* RELECTURE INDÉPENDANTE 4.7.12 (audit/chantiers/relecture-478.md, constat I3).
 * KI-052 est corrigé pour le chemin documenté : passer au cut suivant, archiver,
 * reprendre. Si l'opérateur clique « Reprendre » AVANT de quitter le cut
 * archivé, la reprise recapture ce cut, `Engine.apply()` refuse d'écrire
 * (cible bloquée) et le lot passe en ERROR, état que « Reprendre » n'accepte
 * plus ; « Arrêter » puis « Reprendre » sur le cut suivant échoue aussi (cible
 * différente). Aucune commande n'est envoyée, mais le lot est perdu, et avec
 * lui la mémoire des appuis. Attendu : après être passé au cut suivant, le lot
 * reprend. Marqué `todo` tant que ce n'est pas le cas. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {background}=require('./helpers/fond-relecture.cjs');
test('« Reprendre » sur le cut archivé, puis cut suivant : le lot doit rester reprenable',
  {todo:'constat I3 de la relecture 4.7.12 : le lot finit en ERROR non reprenable'},async()=>{
  const b=background();let fail=true;const apply=b.adapter.apply.bind(b.adapter);
  b.adapter.apply=async(...a)=>{if(fail){fail=false;throw Error('Position proposée hors de la vue : left');}return apply(...a);};
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  await b.api('start',{part:23,start:100,end:102,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});
  await b.settle();await b.api('close-uncertain');
  await b.api('resume');let view=await b.settle();                         // reprise sans quitter le cut archivé
  const first=`${view.batch.state} : ${view.batch.error?.message}`;
  assert.deepEqual(b.adapter.calls.filter(c=>c!=='capture'),[],'aucune commande autre que la lecture');
  await b.adapter.next();                                                     // l'opérateur passe alors au cut suivant
  const attempts=[];
  for(const action of ['close-uncertain','resume','stop','resume']){try{await b.api(action);attempts.push(action+' : accepté');}catch(e){attempts.push(action+' : '+e.message);}}
  view=await b.settle();
  assert.equal(view.batch.processed.length,1,`après la reprise sur le cut archivé (${first}) : ${attempts.join(' ; ')}`);
});
