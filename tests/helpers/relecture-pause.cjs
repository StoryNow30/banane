'use strict';
/* Test 17 (D-232 à D-234) — outils communs des essais de la PAUSE ET DE LA REPRISE de la relecture : le montage de la relecture après le lot
 * (tests/helpers/relecture-lot.cjs) avec le réglage « pause et reprise » allumé (il est éteint par défaut) et le choix « si ESV est rechargé ». */
const {memoire}=require('./perf-production.cjs');
const H=require('./relecture-lot.cjs');
const REGLAGE='banane51RelecturePauseReglage',REPRISE='banane51RelectureReprise';
/* `actif` : réglage allumé (défaut) ; `null` : aucun réglage gardé (état d'une installation neuve) ; `f5` : 'pause' (défaut) ou 'arret'. */
async function lotPause({actif=true,f5='pause',mode='ombre',local=null,...reste}={}){
 const l=local||memoire();if(actif!==null)l.m[REGLAGE]={actif,f5};
 return H.lotRelecture({mode,local:l,...reste});}
/* Attend que la passe soit dans l'état demandé. */
async function attendreEtat(b,etat,ms=60000){const fin=Date.now()+ms;
 for(;;){const p=b.get('relecture').passe;if(p?.etat===etat)return p;
  const r=b.get('relecture');if(r.tache&&p?.etat==='en-cours')await Promise.race([r.tache,H.attendre(30)]);else await H.attendre(10);
  if(Date.now()>fin)throw Error(`passe non ${etat} (état : ${p?.etat})`);}}
const cutsAllees=adapter=>adapter.allees.map(a=>a.cut);
/* Fait entrer dans la chaîne d'appuis de la passe les poses « window » des cuts relus (le montage les écarte : `anchor:false`) et note, par cut, le nombre d'appuis
 * que la décision a reçus : de quoi vérifier qu'une reprise garde la chaîne (mêmes appuis qu'une passe sans pause). */
const hookChaine=rec=>(a,bb)=>{const d=bb.ctx.BananeLotDecision;
 bb.ctx.BananeLotDecision={...d,decideCut(args){const r=d.decideCut(args),cut=args?.capture?.identity?.cut;
  if(Number.isInteger(cut)&&(cut<111||cut>113)){rec[cut]=(args.anchors||[]).length;if(r?.stage==='window')return {...r,anchor:true};}return r;}};};
/* Résumé comparable du journal de la passe : par cut, ce qui doit être identique avec ou sans pause. */
const resume=(b,rec)=>({cuts:b.store.events.filter(e=>e.type==='relecture-ombre').map(e=>({cut:e.identity.cut,action:e.action,verdict:e.verdict??null,poseCalculee:e.poseCalculee??null,
 ecritMm:e.ecritMm??null,chaineCuts:e.chaineCuts,appuis:(e.appuis||[]).length,enChaine:e.enChaine})),appuisRecus:rec});
module.exports={H,...H,lotPause,attendreEtat,cutsAllees,hookChaine,resume,REGLAGE,REPRISE};
