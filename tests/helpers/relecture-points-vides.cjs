'use strict';
/* CH-107 — outils communs des essais « ESV n'affiche plus les points pendant la relecture » (tests/ch107-relecture-points-vides*.test.cjs).
 * ESV simulé : les cuts de `vides` rendent des captures sans point (comme une page dont le chargeur de points s'est arrêté) ; le rechargement de
 * l'onglet est imité comme dans tests/helpers/relecture-signal.cjs (page muette `muetMs`, puis elle répond). `persiste` : la page rechargée
 * n'affiche toujours pas les points (seconde série). Données synthétiques. */
const {H,lotPause,attendreEtat,cutsAllees}=require('./relecture-pause.cjs');
const {REGLAGE,avec}=require('./relecture-signal.cjs');
function esvVide({vides=[],persiste=false,muetMs=60}={}){return (a,b)=>{a.rechargements=0;for(const c of vides)a.sansPoints.add(c);
 const ping=a.ping.bind(a);a.ping=async()=>{if(a.muet)throw Error('Adaptateur ESV sans réponse (simulé).');return ping();};
 b.ctx.chrome.tabs.reload=async()=>{a.rechargements++;a.muet=true;b.get('chargementEsvReset')();
  setTimeout(()=>{a.muet=false;if(!persiste)a.sansPoints.clear();},muetMs);};};}
/* Relecture « corriger » (cuts relus : 108, 109, 110, 113, 114, 115, 116), réglage de pause allumé ou non ; le signal d'ESV est coupé pour isoler
 * la garde des points (ses délais servent au rechargement). `decisions` : 114 et 115 seraient corrigés (pose à 13 et 20 mm), points ou non. */
const PERMISSIF=require('./relecture-essais.cjs').PERMISSIF;
const DECISIONS={109:14,114:13,115:20};
const lotVide=({actif=true,...o}={})=>lotPause({actif,mode:'corriger',decisions:DECISIONS,reglagesProposes:PERMISSIF,
 esv:avec(esvVide(o),(a,b)=>REGLAGE({actif:false,attenteRepriseMs:3000})(b))});
async function evenement(b,type,pred=()=>true,ms=15000){const t=Date.now();for(;;){const e=H.evenements(b,type).find(pred);if(e)return e;
 if(Date.now()-t>ms)throw Error(`événement « ${type} » absent ; ${b.get('relecture').passe?.etat} : ${b.get('relecture').passe?.message}`);await H.attendre(20);}}
module.exports={H,lotVide,esvVide,attendreEtat,cutsAllees,evenement,DECISIONS};
