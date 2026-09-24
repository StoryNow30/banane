#!/usr/bin/env node
'use strict';
/*
 * lot-command-scan.cjs — relevé de la décision sur le lot dans des lots Pilote
 * exportés (relecture indépendante 4.7.12, audit/chantiers/relecture-478.md).
 *
 *   node tools/lot-command-scan.cjs --lot DOSSIER[=libellé] [...] [--ricochet] [--json SORTIE]
 *
 * Lecture seule. Pour chaque lot (dossier reconnu par `tools/acceptance-report.cjs`) :
 *   - étapes consignées et commandes (`lotObservation.command`) ;
 *   - cuts retirés par la garde de continuité ou par la garde de paire, avec
 *     ce qui a été commandé ensuite et ce que le Pilote a fait (runtime) ;
 *   - temps de la décision dans le service worker (`engineMs`), séparé selon
 *     que le moteur a été relancé depuis la voie ou non, et durée d'un cut
 *     traité (journal) ;
 *   - avec `--ricochet` : rejeu hors ligne sans puis avec la garde de paire
 *     (D-044), cuts dont la décision change et nombre d'appuis ; reprises et
 *     choix dont le passage relancé serait signalé par cette garde.
 * Aucune position humaine n'est lue : ni relecture, ni référence.
 */
const fs=require('node:fs'),path=require('node:path');
const A=require('./acceptance-report.cjs'),L=require('../src/lot-decision.js'),Shadow=require('../src/gcv1-shadow.js');
const q=(v,p)=>v.length?v.slice().sort((a,b)=>a-b)[Math.min(v.length-1,Math.floor(p*v.length))]:null;
const count=(list,f)=>list.reduce((m,x)=>{const k=f(x);m[k]=(m[k]||0)+1;return m;},{});

function scanLot(lot,{ricochet=false}={}){
  const ctx=A.lotCuts(lot.diagnostic,lot.journal),obs=ctx.cuts.flatMap(c=>c.observations),withLot=obs.filter(o=>o.lotObservation);
  const guarded=withLot.filter(o=>o.lotObservation.guardDeferred||o.lotObservation.pairGuarded).map(o=>{const lo=o.lotObservation;
    return {cut:o.identity.cut,stage:lo.stage,guardMm:lo.guardMm??null,pairGuarded:!!lo.pairGuarded,
      command:lo.command?`${lo.command.action}/${lo.command.reason}`:null,runtimeApplied:!!o.runtime?.apply,deferral:o.runtime?.deferral?.status??null};});
  const relaunched=withLot.filter(o=>o.lotObservation.anchorsUsed?.length&&o.lotObservation.stage!=='first-pass'&&!o.lotObservation.pairGuarded);
  const ms=list=>list.map(o=>o.lotObservation.engineMs).filter(Number.isFinite);
  const durations=(ctx.batch?.processed||[]).map(p=>p.durationMs).filter(Number.isFinite);
  const out={label:lot.label,version:lot.diagnostic?.version??lot.journal?.version??null,observations:obs.length,withLotObservation:withLot.length,
    stages:count(withLot,o=>o.lotObservation.stage),commands:count(withLot,o=>o.lotObservation.command?`${o.lotObservation.command.action}/${o.lotObservation.command.reason}`:'aucune'),
    guarded,decisionMs:{relaunched:{n:ms(relaunched).length,median:q(ms(relaunched),.5),p90:q(ms(relaunched),.9),max:q(ms(relaunched),1)},
      direct:{n:ms(withLot).length-ms(relaunched).length,max:q(ms(withLot.filter(o=>!relaunched.includes(o))),1)}},
    cutDurationMs:{n:durations.length,median:q(durations,.5),p90:q(durations,.9)}};
  if(ricochet&&lot.corpus){
    /* Seule la garde de paire varie ; les autres règles restent celles du lot (D-047, D-050). */
    const {source,pairGuard,...lotRules}=A.lotRules(obs,out.version);
    const without=A.replayLot(obs,lot.corpus,{options:{...lotRules,pairGuard:false}});
    let last=null;const spy={...Shadow,scientificProposeBoth:c=>(last=Shadow.scientificProposeBoth(c))},flagged=[];
    const Lspy={...L,decideCut:args=>{last=null;const d=L.decideCut({...args,Shadow:spy});
      if((d.stage==='window'||d.stage==='choice')&&L.pairFlagged(last))flagged.push(args.capture.identity.cut);return d;}};
    const withGuard=A.replayLot(obs,lot.corpus,{L:Lspy,options:{...lotRules,pairGuard:true}});
    out.ricochet={changed:obs.map((o,i)=>({o,a:without[i].decision,b:withGuard[i].decision}))
      .filter(({a,b})=>a?.stage!==b?.stage||JSON.stringify(a?.positions)!==JSON.stringify(b?.positions))
      .map(({o,a,b})=>({cut:o.identity.cut,without:a?.stage??null,withPairGuard:b?.stage??null,reason:b?.reason??null,anchors:b?.anchorsUsed??[]})),
      relaunchedFlaggedByPairGuard:flagged};
  }
  return out;
}
function run(argv=process.argv.slice(2)){
  const lots=[];let json=null,ricochet=false;
  for(let i=0;i<argv.length;i++){const a=argv[i];
    if(a==='--lot'){const v=argv[++i],at=v.lastIndexOf('=');lots.push(at>0?{dir:v.slice(0,at),label:v.slice(at+1)}:{dir:v,label:path.basename(path.resolve(v))});}
    else if(a==='--ricochet')ricochet=true;else if(a==='--json')json=argv[++i];else throw Error('Argument inconnu : '+a);}
  if(!lots.length)throw Error('Usage : --lot DOSSIER[=libellé] [...] [--ricochet] [--json SORTIE]');
  const report={format:'banane-lot-command-scan-v1',lots:lots.map(l=>scanLot(A.loadLot(l.dir,l.label),{ricochet}))};
  for(const r of report.lots){
    console.log(`${r.label} (${r.version}) : ${r.withLotObservation}/${r.observations} observations avec décision · étapes ${JSON.stringify(r.stages)} · commandes ${JSON.stringify(r.commands)}`);
    for(const g of r.guarded)console.log(`   ${g.cut} : ${g.stage}${g.guardMm!=null?' (garde '+g.guardMm+' mm)':''}${g.pairGuarded?' (garde de paire)':''} → commande ${g.command} ; Pilote : ${g.runtimeApplied?'appliqué':g.deferral||'—'}`);
    const d=r.decisionMs;console.log(`   décision : moteur relancé n=${d.relaunched.n}, médiane ${d.relaunched.median} ms, p90 ${d.relaunched.p90}, max ${d.relaunched.max} · sans relance n=${d.direct.n}, max ${d.direct.max} ms · cut traité : médiane ${r.cutDurationMs.median} ms, p90 ${r.cutDurationMs.p90} (n=${r.cutDurationMs.n})`);
    if(r.ricochet){for(const c of r.ricochet.changed)console.log(`   garde de paire : ${c.cut} ${c.without} → ${c.withPairGuard}${c.reason?' ('+c.reason+')':''}, appuis ${JSON.stringify(c.anchors)}`);
      console.log(`   reprises et choix dont le passage relancé serait signalé : ${r.ricochet.relaunchedFlaggedByPairGuard.join(', ')||'aucun'}`);}
  }
  if(json)fs.writeFileSync(json,JSON.stringify(report,null,1)+'\n');
  return report;
}
if(require.main===module)try{run();}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={scanLot,run};
