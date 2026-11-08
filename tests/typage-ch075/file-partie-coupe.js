/** Partie contre coupe, sur les vraies fonctions de src/file-parties.js et src/file-prioritaire.js. */
const FP=require('../../src/file-parties.js'),F=require('../../src/file-prioritaire.js');
/** @type {CH075.Coupe} */ const coupe=/** @type {CH075.Coupe} */(7);
/** @type {CH075.Partie} */ const partie=/** @type {CH075.Partie} */(2);
/** @type {CH075.Selecteur} */ const selecteur={status:'ok',parts:[{part:2}]};
FP.planifier(selecteur,coupe,2); // rejet
FP.transition(null,{type:'changement-ok',part:coupe}); // rejet
FP.transition(null,{type:'demarrer',courante:coupe,selecteur,n:1}); // rejet
F.plages([partie]); // rejet
F.ordonner([{part:coupe,cut:coupe}]); // rejet
F.ordonner([{part:partie,cut:partie}]); // rejet
/** @type {CH075.Coupe} */ const issue=FP.repriseDe(null)?.part??coupe; // rejet
module.exports={issue};
