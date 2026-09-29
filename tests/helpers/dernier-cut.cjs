'use strict';
/* Auxiliaires des essais KI-069 (4.8.6) : dernier cut d'une partie. ESV simulé
 * dont le cut affiché est le dernier de la partie (N = M−1) ; relevé passif
 * « N on M treated » envoyé après chaque capture ; action `validateInPlace`
 * (Ctrl+Entrée relayé) simulée comme la page la rend. Aucun code d'ESV. */
const L=require('../../src/lot-decision.js'),K=require('../../src/core.js');
const {pilote}=require('./pilote-lot.cjs'),{releve,differe}=require('./fin-partie.cjs');
const ESV_SENDER={id:'test',url:'https://esv.lidar.altametris.xyz/rails_validation/test',tab:{id:1}};
/* Relevé fabriqué à la main (heure, cut ou compteurs choisis). */
function releveBrut(b,r){return b.message({kind:'esv-releve',releve:{requestId:'r-'+Math.random(),at:new Date().toISOString(),...r}},ESV_SENDER);}
/* Après chaque capture, le relevé du cut affiché : `mesure` = {total, traites} ou une fonction (identité) → relevé brut. */
const avecReleve=(mesure={})=>(esv,b)=>{const c=esv.capture.bind(esv);
  esv.capture=async(...a)=>{const out=await c(...a);
    if(mesure===null)return out;
    if(typeof mesure==='function')await releveBrut(b,mesure({...esv.identity}));else await releve(b,{...esv.identity},mesure);return out;};};
/* ESV simulé : Ctrl+Entrée valide sans changer de cut ; le compteur passe de `traites` à `traites`+1. */
function validationEnPlace(esv,{effet='valide',traites=8760,total=8786}={}){esv.commandes=[];esv.enPlace=[];
  esv.validateInPlace=async function(identity,scope,commande){this.calls.push('validateInPlace');this.commandes.push(commande);
    if(effet==='erreur')throw Error('Ctrl+Entrée : commande refusée par la page.');
    const apres=await this.state(),valide=effet==='valide';
    const e={format:'banane-validate-in-place-v1',operatorDecision:'VALIDATE',command:'ctrl-entrée',commandSent:true,
      decisionCommand:{id:'Ctrl+Enter',exists:true,disabled:false},afterObserved:true,afterState:apres,afterStateStatus:'OBSERVED_SAME_TARGET',
      beforeNavigationIdentity:K.completeIdentity(identity),navigationObserved:false,serverConfirmed:valide,nextIdentity:null,
      compteurAvant:{traites,total},compteurApres:{traites:valide?traites+1:traites,total}};
    this.enPlace.push(e);return e;};}
/* Lot Orbite « jusqu'à la fin de la partie » sur le dernier cut (100 = M−1, M = 101). */
async function dernierCut({mesure={total:101,traites:100},decision=L,esv=null,options={}}={}){
  const r=await pilote(decision,{start:100,end:0,endMode:'partie',esv:(e,b)=>{avecReleve(mesure)(e,b);validationEnPlace(e,{traites:100,total:101});esv?.(e,b);},...options});
  return {r,view:await r.b.settle()};}
const appels=(r,nom)=>r.b.adapter.calls.filter(c=>c===nom).length;
const navigations=r=>r.b.adapter.calls.filter(c=>['next','nextWithoutDecision','validate','skip'].includes(c));
module.exports={L,differe,pilote,releve,releveBrut,avecReleve,validationEnPlace,dernierCut,appels,navigations};
