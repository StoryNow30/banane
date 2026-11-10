'use strict';
/* CH-096, défaut 1 — « ARCHIVER LE RÉSULTAT INTERROMPU » PUIS « REPRENDRE » APRÈS UNE VALIDATION NON CONFIRMÉE, SANS F5.
 * La validation n'a pas rendu de résultat (cut inchangé) : lot en ERROR, `reconcileRequired`, intention « validate ». L'opérateur archive
 * (`closeUncertain` : lot STOPPED, proposition et `applied` effacés, étape « validate » laissée), passe au cut suivant et clique
 * « Reprendre ». Avant la correction, la boucle repartait à l'étape « validate » sans proposition : « Cannot read properties of null »,
 * lot en ERROR non reprenable. KI-052 ne remettait l'étape que pour « apply ». Correction dans le service worker (hors fichier protégé),
 * à côté de celle de KI-052 : sans proposition, sans pose appliquée, sans intention, la reprise recommence le cut affiché par sa capture.
 * `CH096_SANS_PATCH=1` : la remise d'étape est neutralisée dans la copie du service worker chargée par l'essai (pour revoir le rouge). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const MARQUE="/*CH-096-1*/['apply','validate'].includes(engine.s.batch?.step)";
const SANS=process.env.CH096_SANS_PATCH==='1';
if(SANS){const reel=fs.readFileSync.bind(fs),cible=path.resolve(__dirname,'../background.js');
 fs.readFileSync=(f,...a)=>{const t=reel(f,...a);return typeof t==='string'&&path.resolve(String(f))===cible?t.split(MARQUE).join("engine.s.batch?.step==='apply'"):t;};}
const {background}=require('./helpers/fond-relecture.cjs');
const LOT={part:23,start:100,end:102,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'};
/* Lot dont la PREMIÈRE validation ne rend pas de résultat ; `sortie` : le message levé par l'adaptateur. */
async function lotValidationNonConfirmee(sortie){
 const b=background();let fail=true;const valider=b.adapter.validateAndNext.bind(b.adapter);
 b.adapter.validateAndNext=async(...a)=>{if(fail){fail=false;b.adapter.calls.push('validate');throw Error(sortie);}return valider(...a);};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 await b.api('start',LOT);const vue=await b.settle();
 assert.equal(vue.batch.state,'ERROR');assert.equal(vue.batch.step,'validate');
 return b;}
test('le service worker chargé porte la remise d\'étape de CH-096 (sauf CH096_SANS_PATCH=1)',()=>{
 assert.equal(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8').includes(MARQUE),!SANS);});
for(const sortie of ['VALIDATE transmis, résultat non confirmé : le cut n’a pas changé','Validation ambiguë : délai dépassé.'])
test('validation non confirmée ('+sortie.slice(0,20)+'…) : archiver, passer au cut suivant, Reprendre → le lot reprend par la capture',async()=>{
 const b=await lotValidationNonConfirmee(sortie);
 await b.api('close-uncertain');let vue=await b.api('view');
 assert.equal(vue.batch.state,'STOPPED');assert.equal(vue.batch.step,'validate','l\'archivage laisse l\'étape du lot');
 await b.adapter.next();                                   // l'opérateur passe au cut suivant dans ESV
 const avant=b.adapter.calls.length;
 await b.api('resume');vue=await b.settle();
 assert.notEqual(vue.batch.state,'ERROR',vue.batch.error?.message);
 assert.deepEqual(vue.batch.processed.map(x=>x.cut),[101,102],vue.batch.error?.message);
 /* Le cut archivé (100) : une pose, une validation transmise, plus rien ensuite. Les deux suivants : capture, pose, validation, une fois. */
 assert.deepEqual(b.adapter.calls.slice(avant),['capture','apply','validate','next','capture','apply','validate','next']);
 assert.equal(b.adapter.calls.filter(c=>c==='validate').length,3,'aucune validation renvoyée sur le cut archivé');
 assert.equal(b.adapter.calls.includes('skip'),false,'aucun SKIP');
});
test('validation non confirmée : « Reprendre » sur le cut archivé encore affiché reste refusé, sans commande, lot reprenable',async()=>{
 const b=await lotValidationNonConfirmee('VALIDATE transmis, résultat non confirmé : le cut n’a pas changé');
 await b.api('close-uncertain');const avant=b.adapter.calls.length;
 await assert.rejects(b.api('resume'),/résultat incertain archivé.*Passe au cut suivant/);
 const vue=await b.api('view');assert.equal(vue.batch.state,'STOPPED');assert.equal(vue.batch.step,'validate','étape non touchée par une reprise refusée');
 assert.equal(b.adapter.calls.length,avant,'aucune commande');
});
test('validation non confirmée, NON archivée : « Reprendre » reste refusé (réconciliation), l\'étape n\'est pas remise',async()=>{
 const b=await lotValidationNonConfirmee('VALIDATE transmis, résultat non confirmé : le cut n’a pas changé');
 const avant=b.adapter.calls.length;await b.adapter.next();
 await assert.rejects(b.api('resume'));
 const vue=await b.api('view');assert.equal(vue.batch.step,'validate');assert.equal(vue.batch.state,'ERROR');
 assert.deepEqual(b.adapter.calls.slice(avant),['next'],'aucune commande d\'Ariane');
});
