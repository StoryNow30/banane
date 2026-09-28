#!/usr/bin/env node
'use strict';
/*
 * perf-lot.cjs — temps mesurés sur le terrain pendant un lot Orbite (ex-Pilote),
 * lus dans les événements d'un export (journal `banane-journal-v4-…` ou bilan
 * fusionné `banane-bilan-v4-…`, voir tools/merge-segments.cjs). Rien n'est
 * estimé : chaque chiffre vient d'un horodatage ou d'un `elapsedMs` mesuré par
 * le bridge dans la page ESV.
 *
 *   node tools/perf-lot.cjs EXPORT.json [--json SORTIE.json] [--md SORTIE.md] [--titre T] [--tous]
 *
 * Un export compressé (`.json.gz`) est lu tel quel. Par défaut, seul le lot exporté (`state.batch`) est mesuré ; `--tous` garde
 * tous les événements de l'export.
 *
 * Mesures :
 *   - commandes ESV (`adapter-result`) : durée par action (capture, apply,
 *     validateAndNext, nextWithoutDecision…), erreurs, et pour la capture les
 *     points, octets et essais ;
 *   - analyse (`before-captured` → `proposed`, même cut) : moteur, décision
 *     sur le lot et écritures comprises ; `engineMs` : décision seule ;
 *   - cycle (`cut-target-changed` → suivant) : temps par cut vu de l'opérateur ;
 *   - silences : écarts de plus de 60 s entre deux événements (pause, attente,
 *     opérateur) ; comptés à part, hors cadence.
 * Les événements d'un export ne sont pas rangés dans l'ordre : ils sont triés
 * par horodatage.
 */
const fs=require('node:fs'),zlib=require('node:zlib');
const SILENCE_MS=60000;
const ms=e=>Date.parse(e.timestamp);
const cutOf=e=>Number.isInteger(e?.identity?.cut)?e.identity.cut:null;
function stats(values){const v=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return {n:0};
  const q=p=>v[Math.min(v.length-1,Math.floor(p*(v.length-1)+0.5))];
  return {n:v.length,median:q(0.5),p90:q(0.9),max:v.at(-1),min:v[0],total:v.reduce((s,x)=>s+x,0)};}
/* Un export garde les événements de plusieurs lots : on ne mesure que le lot
 * exporté (`state.batch`), de son `batch-started` au lot suivant. */
function fenetreDuLot(events,batch){
  const debuts=events.filter(e=>e.type==='batch-started');const i=debuts.findIndex(e=>e.batch?.id&&e.batch.id===batch?.id);
  if(i<0)return {events,filtre:false};const de=ms(debuts[i]),a=debuts[i+1]?ms(debuts[i+1]):Infinity;
  return {events:events.filter(e=>ms(e)>=de&&ms(e)<a),filtre:true};}
function measure(data,{tous=false}={}){
  const tries=(data.events||[]).filter(e=>Number.isFinite(ms(e))).sort((a,b)=>ms(a)-ms(b));
  const batch=data.state?.batch||null,{events,filtre}=tous?{events:tries,filtre:false}:fenetreDuLot(tries,batch);
  if(!events.length)throw Error('Aucun événement horodaté dans cet export.');
  const m=mesurer(events);
  /* Lot par lot : chaque `batch-started` ouvre une fenêtre jusqu'au suivant. */
  const debuts=events.filter(e=>e.type==='batch-started'),lots=debuts.map((d,i)=>{const de=ms(d),a=debuts[i+1]?ms(debuts[i+1]):Infinity;
    const w=events.filter(e=>ms(e)>=de&&ms(e)<a),x=mesurer(w),etats=w.filter(e=>e.type==='batch-state');
    return {lot:d.batch?.id??null,partie:d.batch?.scope?.part??null,depart:d.batch?.scope?.start??null,debut:d.timestamp,
      fin:etats.at(-1)?.state??null,cuts:x.cuts.distincts,dureeMin:x.dureeMin.totale,silencesMin:x.dureeMin.silences,
      cycleMs:x.cycleMs,captureMs:x.commandesMs.capture||{n:0},erreurs:Object.values(x.erreurs).reduce((s,l)=>s+l.length,0)};});
  return {source:{format:data.format??null,version:data.version??null,exportedAt:data.exportedAt??null,partie:batch?.scope?.part??null,
      lot:batch?.id??null,etat:batch?.state??null,lotSeul:filtre,evenements:events.length,debut:events[0].timestamp,fin:events.at(-1).timestamp},...m,lots};
}
function mesurer(events){
  const actions={},errors={},capture={points:[],bytes:[],attempts:[]};
  for(const e of events.filter(x=>x.type==='adapter-result')){const a=e.action||'?';(actions[a]=actions[a]||[]).push(e.elapsedMs);
    if(e.error)(errors[a]=errors[a]||[]).push({cut:cutOf(e),at:e.timestamp,message:String(e.error).slice(0,160)});
    if(a==='capture'&&!e.error&&e.lastDetail){capture.points.push(e.lastDetail.points);capture.bytes.push(e.lastDetail.bytes);capture.attempts.push(e.lastDetail.attempts);}}
  /* Analyse : du dernier `before-captured` d'un cut à son `proposed`. */
  const analyse=[],engine=[];let avant=null;
  for(const e of events){if(e.type==='before-captured')avant=e;
    else if(e.type==='proposed'&&avant&&cutOf(avant)===cutOf(e)){analyse.push(ms(e)-ms(avant));avant=null;}
    if(e.type==='gcv1-shadow-observed'&&Number.isFinite(e.lotObservation?.engineMs))engine.push(e.lotObservation.engineMs);}
  /* Cycle par cut et silences. */
  const cibles=events.filter(e=>e.type==='cut-target-changed'),cycles=[];
  for(let i=1;i<cibles.length;i++)cycles.push({cut:cutOf(cibles[i-1]),ms:ms(cibles[i])-ms(cibles[i-1])});
  const silences=[];for(let i=1;i<events.length;i++){const d=ms(events[i])-ms(events[i-1]);
    if(d>SILENCE_MS)silences.push({apres:events[i-1].type,cut:cutOf(events[i-1]),de:events[i-1].timestamp,ms:d});}
  const debut=ms(events[0]),fin=ms(events.at(-1)),silenceMs=silences.reduce((s,x)=>s+x.ms,0);
  const cuts=new Set(events.map(cutOf).filter(c=>c!==null));
  const actif=Math.max(1,fin-debut-silenceMs),cyclesHorsSilence=cycles.filter(c=>c.ms<=SILENCE_MS);
  return {
    cuts:{distincts:cuts.size,cycles:cycles.length},
    dureeMin:{totale:(fin-debut)/60000,silences:silenceMs/60000,active:actif/60000},
    cadence:{cutsParHeureActive:cyclesHorsSilence.length/(cyclesHorsSilence.reduce((s,c)=>s+c.ms,0)/3600000||1)},
    cycleMs:stats(cyclesHorsSilence.map(c=>c.ms)),cyclesLents:cycles.filter(c=>c.ms>SILENCE_MS).map(c=>({cut:c.cut,s:Math.round(c.ms/1000)})),
    commandesMs:Object.fromEntries(Object.entries(actions).map(([a,v])=>[a,stats(v)])),
    erreurs:errors,
    capture:{points:stats(capture.points),octets:stats(capture.bytes),essais:stats(capture.attempts)},
    analyseMs:stats(analyse),decisionMs:stats(engine),
    silences:silences.map(s=>({...s,s:Math.round(s.ms/1000)})),
  };
}
const n=v=>Number.isFinite(v)?String(Math.round(v)):'—';
const sec=v=>!Number.isFinite(v)?'—':v<1000?Math.round(v)+' ms':(Math.round(v/100)/10).toFixed(1).replace('.',',')+' s';
function toMarkdown(m,titre){
  const L=[`# Temps terrain — ${titre||m.source.lot||'lot'}`,'',
    `Export ${m.source.format||'?'} ${m.source.version||''}, partie ${m.source.partie??'?'}, état ${m.source.etat||'?'} ; ${m.source.debut} → ${m.source.fin}${m.source.lotSeul?' (lot exporté seul)':' (tous les événements de l’export)'}.`,
    `${m.cuts.distincts} cuts distincts, ${m.source.evenements} événements. Durée ${n(m.dureeMin.totale)} min, dont ${n(m.dureeMin.silences)} min de silences (> 60 s) ; cadence ${n(m.cadence.cutsParHeureActive)} cuts/h hors silences.`,'',
    '| Mesure | n | médiane | p90 | max |','|---|---|---|---|---|',
    `| Cycle par cut (hors silences) | ${m.cycleMs.n} | ${sec(m.cycleMs.median)} | ${sec(m.cycleMs.p90)} | ${sec(m.cycleMs.max)} |`,
    `| Analyse (capture reçue → proposition) | ${m.analyseMs.n} | ${sec(m.analyseMs.median)} | ${sec(m.analyseMs.p90)} | ${sec(m.analyseMs.max)} |`,
    `| Décision sur le lot (engineMs) | ${m.decisionMs.n} | ${sec(m.decisionMs.median)} | ${sec(m.decisionMs.p90)} | ${sec(m.decisionMs.max)} |`];
  for(const [a,s] of Object.entries(m.commandesMs))L.push(`| Commande ESV « ${a} » | ${s.n} | ${sec(s.median)} | ${sec(s.p90)} | ${sec(s.max)} |`);
  L.push(`| Capture : points | ${m.capture.points.n} | ${n(m.capture.points.median)} | ${n(m.capture.points.p90)} | ${n(m.capture.points.max)} |`,
    `| Capture : Mo | ${m.capture.octets.n} | ${m.capture.octets.n?(m.capture.octets.median/1048576).toFixed(2).replace('.',','):'—'} | ${m.capture.octets.n?(m.capture.octets.p90/1048576).toFixed(2).replace('.',','):'—'} | ${m.capture.octets.n?(m.capture.octets.max/1048576).toFixed(2).replace('.',','):'—'} |`,
    `| Capture : essais | ${m.capture.essais.n} | ${n(m.capture.essais.median)} | ${n(m.capture.essais.p90)} | ${n(m.capture.essais.max)} |`);
  if(m.lots.length>1){L.push('','Lot par lot :','','| Début | Partie | Départ | Fin | Cuts | Durée | Cycle médian / p90 | Capture médiane / p90 / max | Erreurs |','|---|---|---|---|---|---|---|---|---|');
    for(const l of m.lots)L.push(`| ${l.debut} | ${l.partie??'?'} | ${l.depart??'?'} | ${l.fin??'—'} | ${l.cuts} | ${n(l.dureeMin)} min${l.silencesMin>=1?` (${n(l.silencesMin)} de silences)`:''} | ${sec(l.cycleMs.median)} / ${sec(l.cycleMs.p90)} | ${sec(l.captureMs.median)} / ${sec(l.captureMs.p90)} / ${sec(l.captureMs.max)} | ${l.erreurs} |`);}
  const err=Object.entries(m.erreurs);if(err.length){L.push('','Erreurs de commande :','');for(const [a,l] of err)L.push(`- ${a} : ${l.length} (${l.slice(0,3).map(x=>`cut ${x.cut} : ${x.message}`).join(' ; ')}${l.length>3?' ; …':''})`);}
  if(m.silences.length){L.push('',`Silences (> 60 s) : ${m.silences.length}`,'');for(const s of m.silences.slice(0,12))L.push(`- ${s.de}, après « ${s.apres} » (cut ${s.cut??'?'}) : ${s.s} s`);if(m.silences.length>12)L.push('- …');}
  return L.join('\n')+'\n';
}
function run(argv=process.argv.slice(2)){
  const file=argv.find((a,i)=>!a.startsWith('--')&&!['--json','--md','--titre'].includes(argv[i-1]));if(!file)throw Error('Usage : EXPORT.json [--json SORTIE.json] [--md SORTIE.md]');
  const opt=k=>{const i=argv.indexOf(k);return i>=0?argv[i+1]:null;};
  const brut=fs.readFileSync(file),texte=(file.endsWith('.gz')?zlib.gunzipSync(brut):brut).toString('utf8');
  const m=measure(JSON.parse(texte),{tous:argv.includes('--tous')});
  if(opt('--json'))fs.writeFileSync(opt('--json'),JSON.stringify(m,null,1)+'\n');
  const md=toMarkdown(m,opt('--titre'));if(opt('--md'))fs.writeFileSync(opt('--md'),md);else process.stdout.write(md);
  return m;
}
if(require.main===module)try{run();}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={measure,toMarkdown,stats,run};
