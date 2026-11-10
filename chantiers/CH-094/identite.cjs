'use strict';
/* CH-094 — relevé d'un lot SANS panne de stockage (3 cuts), dans les 4 combinaisons de CH-086 (ESV qui relit ou « navigation seule » ;
 * magasin FIFO ou chrome.storage en avance sur IndexedDB) : commandes vers ESV, appels, événements, visites, état final et lot, après
 * renumérotation des identifiants et masquage des heures (tests/helpers/ch086.cjs, `enregistrements`). Écrit le JSON sur la sortie.
 * `CH094_SANS_PATCH=1` : moteur du dépôt tel quel. Comparé à l'octet par tests/ch094-reprise-apres-ecriture-refusee.test.cjs. */
const H=require('../../tests/helpers/ch094.cjs');
(async()=>{const sortie={patchs:undefined,lots:{}};
 for(const navigationSeule of [false,true])for(const ordre of ['fifo','etat-avant'])
  sortie.lots[(navigationSeule?'navigation-seule':'relit')+'/'+ordre]=H.enregistrements(await H.lot({navigationSeule,ordre}));
 process.stdout.write(JSON.stringify(sortie.lots));})().catch(e=>{console.error(e);process.exit(1);});
