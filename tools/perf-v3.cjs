'use strict';
/* V3, expérience I1 (D-078, D-087) : comparer les deux modes de lecture d'UN MÊME lot.
 *
 * La 4.9.0.6 tire chaque cut une fois pour toutes à partir de son numéro :
 * « référence » (lecture de la 4.9.0.5) ou « rapide » (même lecteur, pause qui
 * rend la main à ESV sans attendre une image). Les deux modes se mélangent tout
 * au long du lot, sur la même partie, le même poste et la même séance : la
 * comparaison ne dépend ni de la partie, ni de l'heure, ni de la dérive du lot.
 *
 * Mesures, par mode : cycle V1 (navigation → cut suivant observé, ≤ 60 s, la
 * définition des portes), part posée (C1), étapes de la capture par rail
 * (sélection, stabilité, lecture), relectures, points lus. Écart des médianes
 * du cycle avec un intervalle à 95 % (ré-échantillonnage à graine fixe).
 *
 * Bruit A/A (D-087) : sur les cinq lots reçus de 4.9.0.2 à 4.9.0.4 (sans
 * lecture rapide), le même tirage sépare deux moitiés dont les cycles médians
 * diffèrent de 0,4 à 1,6 % ; sur 500 autres tirages, P95 de 4 à 7 % pour un lot
 * d'au moins 150 cuts. Seuil proposé : 7 %, validé par la direction.
 *
 * Usage : node tools/perf-v3.cjs BILAN.json [--tous] [--json SORTIE.json] [--md SORTIE.md]
 */
const fs=require('node:fs'),zlib=require('node:zlib'),V1=require('./perf-phases.cjs');
const BRUIT_AA_PCT=7,MODES=['reference','rapide'];
const tirage=cut=>Math.imul(cut>>>0,2654435761)>>>31?'rapide':'reference';
const ms=e=>Date.parse(e.timestamp);
function quantile(values,p){const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return v.length?v[Math.min(v.length-1,Math.floor(p*(v.length-1)+0.5))]:null;}
function median(values){const v=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return null;const m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2;}
function graine(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
/* Intervalle à 95 % de médiane(b) − médiane(a), par ré-échantillonnage ; reproductible. */
function intervalle(a,b,{tirages=2000,seed=20261012}={}){if(a.length<2||b.length<2)return null;
  const r=graine(seed),pick=x=>x.map(()=>x[Math.floor(r()*x.length)]),d=[];
  for(let t=0;t<tirages;t++)d.push(median(pick(b))-median(pick(a)));return {bas:quantile(d,.025),haut:quantile(d,.975)};}

function fenetre(events,batchId){const debuts=events.filter(e=>e.type==='batch-started');const i=debuts.findIndex(e=>e.batch?.id===batchId);
  if(i<0)return events;const de=ms(debuts[i]),a=debuts[i+1]?ms(debuts[i+1]):Infinity;return events.filter(e=>ms(e)>=de&&ms(e)<a);}
/* Étapes de chaque capture, rail par rail, d'après les étapes publiées par la page. */
function captures(events){const parRequete=new Map(),resultats=new Map();
  for(const e of events){if(e.action!=='capture')continue;
    if(e.type==='adapter-progress'){if(!parRequete.has(e.requestId))parRequete.set(e.requestId,[]);parRequete.get(e.requestId).push(e);}
    else if(e.type==='adapter-result')resultats.set(e.requestId,e);}
  return [...parRequete].map(([requestId,etapes])=>{etapes.sort((a,b)=>a.elapsedMs-b.elapsedMs);
    const c={requestId,cut:Number.isInteger(etapes[0].identity?.cut)?etapes[0].identity.cut:null,lecture:null,selection:[],stabilite:[],lecture_ms:[],relectures:0,points:null,
      erreur:resultats.get(requestId)?.error??null,totalMs:resultats.get(requestId)?.elapsedMs??null};
    let precedent=0,attente=null,lu=null;
    for(const p of etapes){const s=p.lastStage,t=p.elapsedMs,d=p.lastDetail||{};if(d.lecture&&!c.lecture)c.lecture=d.lecture;
      if(s==='capture-wait'){if(d.attempt===1)c.selection.push(t-precedent);attente=t;}
      else if(s==='capture-read'&&attente!==null){c.stabilite.push(t-attente);lu=t;}
      else if(s==='capture-view-ready'&&lu!==null){c.lecture_ms.push(t-lu);precedent=t;attente=lu=null;}
      else if(s==='capture-retry')c.relectures++;
      else if(s==='capture-ready')c.points=d.points??null;}
    return c;});}

function comparer(data,{tous=false}={}){
  if(data.dictionaries&&Array.isArray(data.events))data={...data,events:V1.resolveRefs(data.events,data.dictionaries).value};
  const batchId=tous?null:data.state?.batch?.id??null,m=V1.measure(data,{tous,...(batchId?{batchId}:{})});
  if(!m.available)throw Error(m.reason||'Mesures V1 indisponibles.');
  const visites=m.visits.filter(v=>(tous||!batchId||v.batchId===batchId)&&Number.isInteger(v.identity?.cut));
  const evts=(data.events||[]).filter(e=>Number.isFinite(ms(e))).sort((a,b)=>ms(a)-ms(b)),caps=captures(tous||!batchId?evts:fenetre(evts,batchId));
  const regles=new Set(caps.map(c=>c.lecture).filter(Boolean));
  const controle={capturesSansMode:caps.filter(c=>!c.lecture).length,desaccords:caps.filter(c=>c.lecture&&c.cut!==null&&c.lecture!==tirage(c.cut)).length,
    modesVus:[...regles]};
  const bras={};
  for(const mode of MODES){const vs=visites.filter(v=>tirage(v.identity.cut)===mode),cy=vs.map(v=>v.activeCycleMs).filter(Number.isFinite);
    /* Mode d'une capture : celui consigné par la page ; à défaut (export d'avant la 4.9.0.6), celui du tirage. */
    const cs=caps.filter(c=>(c.lecture||(c.cut!==null?tirage(c.cut):null))===mode),ok=cs.filter(c=>!c.erreur);
    bras[mode]={visites:vs.length,cycles:cy.length,cycleMedianMs:median(cy),cycleP90Ms:quantile(cy,.9),
      posees:vs.filter(v=>v.phases[3].status==='measured').length,differees:vs.filter(v=>v.phases[3].reason==='deferred-without-apply').length,
      partPosee:vs.length?vs.filter(v=>v.phases[3].status==='measured').length/vs.length:null,
      captures:cs.length,capturesEnErreur:cs.length-ok.length,relectures:cs.reduce((n,c)=>n+c.relectures,0),
      captureMedianeMs:median(ok.map(c=>c.totalMs)),selectionParRailMs:median(ok.flatMap(c=>c.selection)),
      stabiliteParRailMs:median(ok.flatMap(c=>c.stabilite)),lectureParRailMs:median(ok.flatMap(c=>c.lecture_ms)),
      lectureParRailP90Ms:quantile(ok.flatMap(c=>c.lecture_ms),.9),pointsMedian:median(ok.map(c=>c.points))};
    bras[mode]._cy=cy;}
  const a=bras.reference,b=bras.rapide,delta=a.cycleMedianMs!==null&&b.cycleMedianMs!==null?b.cycleMedianMs-a.cycleMedianMs:null;
  const ecart={cycleMs:delta,pct:delta!==null&&a.cycleMedianMs?100*delta/a.cycleMedianMs:null,intervalle95:intervalle(a._cy,b._cy),bruitAAPct:BRUIT_AA_PCT,
    auDelaDuBruit:delta!==null&&a.cycleMedianMs?Math.abs(100*delta/a.cycleMedianMs)>BRUIT_AA_PCT:null};
  for(const mode of MODES)delete bras[mode]._cy;
  return {lot:batchId,version:data.version??null,bras,ecart,controle};}

const s=x=>x===null||x===undefined?'—':(x/1000).toFixed(2).replace('.',',')+' s';
const pc=x=>x===null||x===undefined?'—':(100*x).toFixed(1).replace('.',',')+' %';
function toMarkdown(r){const a=r.bras.reference,b=r.bras.rapide,L=[];
  L.push(`# V3, expérience I1 : lecture rapide contre référence (même lot)`,'',`Lot ${r.lot??'tous'} ; version ${r.version??'?'}.`,'',
    '| Mesure | Référence | Rapide |','|---|---:|---:|',
    `| Cuts (visites) | ${a.visites} | ${b.visites} |`,`| Cycle médian (V1) | ${s(a.cycleMedianMs)} | ${s(b.cycleMedianMs)} |`,
    `| Cycle P90 | ${s(a.cycleP90Ms)} | ${s(b.cycleP90Ms)} |`,`| Part posée (C1) | ${pc(a.partPosee)} | ${pc(b.partPosee)} |`,
    `| Différées | ${a.differees} | ${b.differees} |`,`| Captures (en erreur) | ${a.captures} (${a.capturesEnErreur}) | ${b.captures} (${b.capturesEnErreur}) |`,
    `| Relectures d'une vue | ${a.relectures} | ${b.relectures} |`,`| Capture médiane | ${s(a.captureMedianeMs)} | ${s(b.captureMedianeMs)} |`,
    `| Sélection par rail | ${s(a.selectionParRailMs)} | ${s(b.selectionParRailMs)} |`,`| Stabilité par rail | ${s(a.stabiliteParRailMs)} | ${s(b.stabiliteParRailMs)} |`,
    `| Lecture par rail (médiane / P90) | ${s(a.lectureParRailMs)} / ${s(a.lectureParRailP90Ms)} | ${s(b.lectureParRailMs)} / ${s(b.lectureParRailP90Ms)} |`,
    `| Points par capture | ${a.pointsMedian??'—'} | ${b.pointsMedian??'—'} |`,'');
  const e=r.ecart;
  L.push(e.cycleMs===null?'Écart du cycle médian : non mesuré.':`Écart du cycle médian (rapide − référence) : ${s(e.cycleMs)} (${e.pct.toFixed(1).replace('.',',')} %)`
    +(e.intervalle95?`, intervalle à 95 % de ${s(e.intervalle95.bas)} à ${s(e.intervalle95.haut)}`:'')+`. Bruit A/A : ${e.bruitAAPct} % ; `
    +(e.auDelaDuBruit?'écart au-delà du bruit.':'écart dans le bruit.'));
  const c=r.controle;L.push('',`Contrôle du tirage : ${c.desaccords} capture(s) dont le mode consigné diffère du tirage ; ${c.capturesSansMode} capture(s) sans mode consigné`
    +(c.capturesSansMode?' (export d\'avant la 4.9.0.6 : mode recalculé par le tirage)':'')+'.');
  return L.join('\n')+'\n';}

function run(argv=process.argv.slice(2)){const file=argv.find((x,i)=>!x.startsWith('--')&&!['--json','--md'].includes(argv[i-1]));
  if(!file)throw Error('Usage : node tools/perf-v3.cjs BILAN.json [--tous] [--json SORTIE.json] [--md SORTIE.md]');
  const opt=k=>{const i=argv.indexOf(k);return i>=0?argv[i+1]:null;};const brut=fs.readFileSync(file);
  const r=comparer(JSON.parse((file.endsWith('.gz')?zlib.gunzipSync(brut):brut).toString('utf8')),{tous:argv.includes('--tous')});
  if(opt('--json'))fs.writeFileSync(opt('--json'),JSON.stringify(r,null,1)+'\n');
  const md=toMarkdown(r);if(opt('--md'))fs.writeFileSync(opt('--md'),md);else process.stdout.write(md);return r;}
if(require.main===module)try{run();}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={tirage,comparer,toMarkdown,intervalle,captures,BRUIT_AA_PCT,run};
