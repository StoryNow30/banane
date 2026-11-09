'use strict';
/* CH-092 (relecture en adversaire de CH-088) — DÉFAUT « capture en échec : l'opération lointaine reste en pause ».
 * `enCapture` passe à vrai au début de toute capture (`annuler('capture')`, src/adapter-page.js l. 490 ; src/prechauffage.js l. 539) et ne repasse à
 * faux que dans `apresCapture` (l. 632), appelé seulement quand la capture RÉUSSIT (adapter-page.js l. 541). Une capture qui lève (lecture instable,
 * annulation, mauvaise coupe) laisse `enCapture` vrai : l'opération lointaine ne lance plus rien jusqu'à la fin de la prochaine capture réussie,
 * alors que le réseau est libre. Rien n'est bloqué pour le lot ; le temps de préchargement est perdu.
 * Essai rouge marqué `todo`. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {monter,contexte}=require('./ch092-prechauffage-monture.cjs');

test('capture qui échoue (aucun apresCapture) : l\'opération lointaine reprend quand Potree ne charge plus',async()=>{
 const m=monter({loin:{actif:true,sautMin:11,coupesMax:40}},{statuts:{20:'invalid',21:'invalid',22:'invalid',70:'invalid'}});const {pc,e,journal,p}=m;
 p.apresCapture(contexte(pc));await e.tourner(6);const avant=journal.appels.length;assert.ok(avant>0,'opération lointaine partie');
 e.etiquette={part:23,cut:21};p.annuler('capture');   /* la capture de la coupe 21 commence, puis lève : apresCapture n'est jamais appelé */
 await e.tourner(300);
 assert.equal(m.potree.numNodesLoading,0,'Potree ne charge rien');
 assert.ok(journal.appels.length>avant,`load() lancés après la capture en échec : ${journal.appels.length-avant}`);
});
