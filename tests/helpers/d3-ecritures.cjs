'use strict';
/* 4.9.5.1 (D3, D-110) — montage des essais « écriture de validation refusée par ESV ». Service worker RÉEL en VM,
 * moteur réel, ESV simulé ; le pont est remplacé par l'envoi direct d'un lot d'entrées de l'observateur (forme de
 * src/esv-observer.js). Chaque capture dure 120 ms (ESV lit son nuage), plus que la fenêtre de relance réglée ici
 * (40 ms) : un refus est donc confirmé pendant la capture du cut suivant. */
const {production}=require('./perf-production.cjs');
const SCOPE={part:23,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'};
const AVIS=/^ESV a refusé d’enregistrer la validation du cut (\d+) \((erreur serveur|pas de réponse du serveur)\)\. Vérifie ce cut dans ESV, puis Reprendre\.$/;
const pause=ms=>new Promise(r=>setTimeout(r,ms)),J=x=>JSON.parse(JSON.stringify(x??null));
/* `ecritures(cut)` : les écritures que la page voit pendant la validation de ce cut (avant la navigation), chacune
 * { status, rowIndex?, railPairId?, body?, attempt?, apresMs? (relayée plus tard), debutMs? (heure de début forcée) }. */
async function lot({ecritures=()=>[],observateur=true,reglage={},start=100,end=102}={}){
 const b=production();const S=b.ctx.BananeSettings;
 b.ctx.BananeSettings={...S,lot:{...S.lot,ecritureRefuseeRelanceMs:40,...reglage}};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const a=b.adapter,journal=[];let seq=0;a.identity.cut=start;
 const relayer=entries=>{if(observateur)b.raw({kind:'esv-observation',observer:'obs-d3',entries});};
 const valider=a.validateAndNext.bind(a),capturer=a.capture.bind(a),poser=a.apply.bind(a);
 a.validateAndNext=async function(...x){const cut=this.identity.cut;journal.push(['validation',cut]);
  for(const w of ecritures(cut)){const t=w.debutMs??Date.now();
   const e={seq:++seq,kind:'write',method:'PUT',status:w.status,outcome:w.status===0?'error':'done',attempt:w.attempt??1,railPairId:w.railPairId??`traj/RK-${cut}`,
    bodyKeys:3,body:w.body===undefined?{ExtractionStatus:'valid',SeenByOperator:true,TreatedByOperator:true}:w.body,rowIndex:w.rowIndex??null,
    startedEpochMs:t,endedEpochMs:t+5,durationMs:5};
   if(w.apresMs)setTimeout(()=>relayer([e]),w.apresMs);else relayer([e]);}
  return valider(...x);};
 a.capture=async function(...x){journal.push(['capture',this.identity.cut]);await pause(120);return capturer(...x);};
 a.apply=async function(...x){journal.push(['pose',this.identity.cut]);return poser(...x);};
 await b.api('start',{...SCOPE,start,end});await b.settle();await pause(80);
 const e=b.get('engine'),bt=e.s.batch;
 return {b,e,etat:bt.state,avis:e.s.notice,traites:J(bt.processed.map(p=>p.cut)),lotId:bt.id,journal:J(journal),
  refus:J(b.store.events.filter(x=>x.type==='ecriture-refusee')),transitions:J(b.get('coordinateurLot').journal.map(t=>t.nom))};}
const fini=s=>['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS'].includes(s);
module.exports={lot,fini,AVIS,J};
