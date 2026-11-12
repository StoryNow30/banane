'use strict';
/* CH-112 : lots jugés rejoués (chemins du dossier de travail local ; aucune donnée au dépôt). */
const path = require('node:path');
const D = process.env.CH112_DONNEES;
const p = (...a) => path.join(D, ...a);
module.exports = [
  { lot: '11/11', journal: p('lot1111/ariane-journal-v4-1794429630703.json'), parties: [
    { partie: 15, liste: p('echo15/ariane-liste-partie15-20261112-072751Z.json'), jointure: p('j/p15.json') },
    { partie: 16, liste: p('echo16/ariane-liste-partie16-20261112-074321Z.json'), jointure: p('j/p16.json') } ] },
  { lot: '06/11', journal: p('lot1106/ariane-journal-v4-1793969735830.json'), parties: [13, 15, 16].map(n => (
    { partie: n, liste: p('lot1106/ariane-liste-partie' + n + '-20261106-' + { 13: '074455Z', 15: '093512Z', 16: '105828Z' }[n] + '.json'), jointure: p('j/b' + n + '.json') })) },
  { lot: '05/11', journal: p('lot1105/ariane-journal-v4-1793877797246.json'), parties: [8, 9, 10, 11, 12].map(n => (
    { partie: n, liste: p('lot1105/ariane-liste-partie' + n + '-20261105-' + { 8: '073031Z', 9: '075352Z', 10: '081634Z', 11: '083926Z', 12: '095410Z' }[n] + '.json'), jointure: p('j/e' + n + '.json') })) },
  { lot: '08/11 a', journal: p('lot1108a/ariane-journal-v4-1794154426755.json'), parties: [
    { partie: 3, liste: p('lot1108a/ariane-liste-partie3-20261108-153747Z.json'), jointure: p('j/a3.json') },
    { partie: 4, liste: p('lot1108a/ariane-liste-partie4-20261108-154317Z.json'), jointure: p('j/a4.json') } ] },
  { lot: '08/11 b', journal: p('lot1108b/ariane-journal-v4-1794173428052.json'), parties: [
    { partie: 6, liste: p('lot1108b/ariane-liste-partie6-20261108-212439Z.json'), jointure: p('j/c6.json') } ] },
];
