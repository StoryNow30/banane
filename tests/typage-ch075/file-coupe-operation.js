/** Coupe contre opération, sur les vraies fonctions de src/file-parties.js et src/file-prioritaire.js. */
const FP=require('../../src/file-parties.js'),F=require('../../src/file-prioritaire.js');
/** @type {CH075.Coupe} */ const coupe=/** @type {CH075.Coupe} */(7);
/** @type {CH075.Partie} */ const partie=/** @type {CH075.Partie} */(2);
/** @type {CH075.Operation} */ const operation=/** @type {CH075.Operation} */('o');
/** @type {CH075.Selecteur} */ const selecteur={status:'ok',parts:[{part:2}]};
F.plages([operation]); // rejet
FP.planifier(selecteur,partie,operation); // rejet
/** @type {CH075.Operation} */ const op=F.plages([coupe]); // rejet
/** @type {CH075.Echange} */ const echange={identity:{part:partie,cut:coupe},operationId:coupe}; // rejet
/** @type {CH075.Coupe} */ const cut=operation; // rejet
module.exports={echange,op,cut};
