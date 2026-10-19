'use strict';
/* RM-11 (test 9) — outils communs des essais de la raison de la correction dans la session Écho (tests/echo-raison*.test.cjs) : le scénario déterministe
 * (tests/helpers/echo-scenario.cjs), la lecture allumée, la frappe d'un chiffre, la validation Maj+Espace. */
const jouer=require('./echo-scenario.cjs');
const ON={raison:{actif:true,touches:'chiffres'}};
const chiffre=n=>({code:'Digit'+n,key:'character'});
/* Joue un scénario libre (sans les quatre visites du scénario figé) ; `fn` reçoit les outils, ses assertions s'exécutent dans la séance. */
const seance=(fn,demarrage=ON,options={})=>jouer({prelude:false,demarrage,frappes:fn,...options});
const visite=(f,id)=>f.store.records.find(r=>r.visitId===id);
const valider=(f,id,etat)=>f.touche(id,etat,{code:'Space',key:' ',shiftKey:true,intent:'VALIDATE',decisionKey:'Shift+Space'});
module.exports={jouer,ON,chiffre,seance,visite,valider};
