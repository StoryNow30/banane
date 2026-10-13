'use strict';
/* V3, expériences I1 puis « turbo » (D-078, D-087, D-088) : comparer les deux modes d'UN MÊME lot.
 *
 * 4.9.0.7 : le mode « rapide » ajoute la sélection à l'image (I2), la lecture au signal de fin
 * de chargement (I3) et la pose sans recentrage (P1). L'outil compte en plus, par mode : la
 * durée de la pose (phase V1), les vues lues au signal ou à la règle des 800 ms, les poses
 * retombées sur le recentrage.
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
 * D-091 (4.9.0.9) : réglage « echantillon », un cut sur dix en référence (même hachage, premier
 * dixième). La règle du lot est celle que la page consigne à la fin de chaque capture
 * (`regleLecture`, depuis la 4.9.0.9) ; avant, le terrain n'a connu que le tirage. Les
 * étapes d'une capture sont datées par la page (`pageMs`) quand elle le fait : le pont les datait
 * à la réception du message, après la lecture en mode rapide (lecture par rail affichée à 0 s).
 *
 * Usage : node tools/perf-v3.cjs BILAN.json [--tous] [--json SORTIE.json] [--md SORTIE.md]
 */
const fs=require('node:fs'),zlib=require('node:zlib'),V1=require('./perf-phases.cjs');
const BRUIT_AA_PCT=7,MODES=['reference','rapide'];
const hache=cut=>Math.imul(cut>>>0,2654435761)>>>0;
const tirage=cut=>hache(cut)>>>31?'rapide':'reference';
/* Règles de la page (src/adapter-page.js, lectureDuCut). */
const REGLES={tirage,echantillon:cut=>hache(cut)<429496730?'reference':'rapide',toujours:()=>'rapide',reference:()=>'reference'};
/* Règle d'une capture : celle que la page consigne (4.9.0.9) ; mode consigné sans règle (4.9.0.6 à
 * 4.9.0.8) : « tirage », la seule que ces versions ont connue ; rien de consigné : aucune. */
const regleDe=c=>c.regleLecture??(c.lecture?'tirage':null);
/* Règles vues, capture par capture (un lot repris après un retour arrière, ou plusieurs lots lus avec
 * --tous, peuvent en mêler deux) ; la plus fréquente sert de repli. Une règle inconnue de l'outil est
 * refusée, jamais remplacée en silence. */
function regleDuLot(caps){const n=new Map();for(const c of caps){const r=regleDe(c);if(r)n.set(r,(n.get(r)||0)+1);}
  for(const nom of n.keys())if(!REGLES[nom])throw Error('Règle de tirage inconnue de l\'outil : '+nom+'.');
  const nom=n.size?[...n].sort((a,b)=>b[1]-a[1])[0][0]:'tirage';
  return {nom,consignee:caps.some(c=>c.regleLecture),reglesVues:Object.fromEntries(n)};}
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
  return [...parRequete].map(([requestId,etapes])=>{
    /* Heure de la page si toutes les étapes la portent (4.9.0.9), sinon celle du pont. */
    const page=etapes.every(p=>Number.isFinite(p.lastDetail?.pageMs)),heure=p=>page?p.lastDetail.pageMs:p.elapsedMs;
    etapes.sort((a,b)=>heure(a)-heure(b));
    const c={requestId,cut:Number.isInteger(etapes[0].identity?.cut)?etapes[0].identity.cut:null,lecture:null,selection:[],stabilite:[],lecture_ms:[],relectures:0,points:null,regles:[],
      erreur:resultats.get(requestId)?.error??null,totalMs:resultats.get(requestId)?.elapsedMs??null,horloge:page?'page':'pont',
      t0:Math.min(...etapes.map(ms).filter(Number.isFinite))};
    let precedent=0,attente=null,lu=null;
    for(const p of etapes){const s=p.lastStage,t=heure(p),d=p.lastDetail||{};if(d.lecture&&!c.lecture)c.lecture=d.lecture;
      if(s==='capture-wait'){if(d.attempt===1)c.selection.push(t-precedent);attente=t;}
      else if(s==='capture-read'&&attente!==null){c.stabilite.push(t-attente);lu=t;if(d.regle)c.regles.push(d.regle);}
      else if(s==='capture-view-ready'&&lu!==null){c.lecture_ms.push(t-lu);precedent=t;attente=lu=null;}
      else if(s==='capture-retry')c.relectures++;
      else if(s==='capture-ready'){c.points=d.points??null;c.regleLecture=d.regleLecture??null;}}
    return c;});}

function comparer(data,{tous=false}={}){
  if(data.dictionaries&&Array.isArray(data.events))data={...data,events:V1.resolveRefs(data.events,data.dictionaries).value};
  const batchId=tous?null:data.state?.batch?.id??null,m=V1.measure(data,{tous,...(batchId?{batchId}:{})});
  if(!m.available)throw Error(m.reason||'Mesures V1 indisponibles.');
  const visites=m.visits.filter(v=>(tous||!batchId||v.batchId===batchId)&&Number.isInteger(v.identity?.cut));
  const evts=(data.events||[]).filter(e=>Number.isFinite(ms(e))).sort((a,b)=>ms(a)-ms(b)),champ=tous||!batchId?evts:fenetre(evts,batchId),caps=captures(champ);
  const regles=new Set(caps.map(c=>c.lecture).filter(Boolean));
  /* Lot d'un événement : le dernier « batch-started » avant lui ; sans aucun début de lot, un seul lot. */
  const debuts=evts.filter(e=>e.type==='batch-started'&&e.batch?.id).map(e=>({id:e.batch.id,t:ms(e)}));
  const cle=(lot,cut)=>(debuts.length?lot:'*')+'|'+cut,lotA=t=>{let id=null;for(const d of debuts)if(d.t<=t)id=d.id;return id;};
  /* D-091 : mode consigné par la page pour chaque capture (la dernière d'un cut dans un lot l'emporte) ;
   * une visite prend celui de sa capture. À défaut de capture consignée (avant la 4.9.0.6), la règle. */
  const consigne=new Map();for(const c of [...caps].sort((a,b)=>a.t0-b.t0))if(c.lecture&&c.cut!==null)consigne.set(cle(lotA(c.t0),c.cut),c.lecture);
  const regle=regleDuLot(caps),repli=REGLES[regle.nom];
  const modeVisite=v=>consigne.get(cle(v.batchId,v.identity.cut))??repli(v.identity.cut);
  /* Poses du mode rapide retombées sur le recentrage (une par rail), avec le mode de leur cut. */
  const replis=champ.filter(e=>e.type==='adapter-progress'&&e.action==='apply'&&e.lastStage==='apply-repli'&&Number.isInteger(e.identity?.cut))
    .map(e=>consigne.get(cle(lotA(ms(e)),e.identity.cut))??repli(e.identity.cut));
  const controle={capturesSansMode:caps.filter(c=>!c.lecture).length,
    desaccords:caps.filter(c=>c.lecture&&c.cut!==null&&c.lecture!==REGLES[regleDe(c)](c.cut)).length,
    modesVus:[...regles],regle:regle.nom,regleConsignee:regle.consignee,reglesVues:regle.reglesVues,etapesDateesParLaPage:caps.filter(c=>c.horloge==='page').length,
    visitesSansCaptureConsignee:visites.filter(v=>!consigne.has(cle(v.batchId,v.identity.cut))).length};
  const bras={};
  for(const mode of MODES){const vs=visites.filter(v=>modeVisite(v)===mode),cy=vs.map(v=>v.activeCycleMs).filter(Number.isFinite);
    /* Mode d'une capture : celui consigné par la page ; à défaut (export d'avant la 4.9.0.6), celui du tirage. */
    const cs=caps.filter(c=>(c.lecture||(c.cut!==null?repli(c.cut):null))===mode),ok=cs.filter(c=>!c.erreur);
    const poses=vs.map(v=>v.phases[3]).filter(p=>p.status==='measured').map(p=>p.ms),regles=cs.flatMap(c=>c.regles);
    bras[mode]={visites:vs.length,cycles:cy.length,cycleMedianMs:median(cy),cycleP90Ms:quantile(cy,.9),
      posees:vs.filter(v=>v.phases[3].status==='measured').length,differees:vs.filter(v=>v.phases[3].reason==='deferred-without-apply').length,
      partPosee:vs.length?vs.filter(v=>v.phases[3].status==='measured').length/vs.length:null,
      captures:cs.length,capturesEnErreur:cs.length-ok.length,relectures:cs.reduce((n,c)=>n+c.relectures,0),
      captureMedianeMs:median(ok.map(c=>c.totalMs)),selectionParRailMs:median(ok.flatMap(c=>c.selection)),
      stabiliteParRailMs:median(ok.flatMap(c=>c.stabilite)),lectureParRailMs:median(ok.flatMap(c=>c.lecture_ms)),
      lectureParRailP90Ms:quantile(ok.flatMap(c=>c.lecture_ms),.9),pointsMedian:median(ok.map(c=>c.points)),
      poseMedianeMs:median(poses),vuesAuSignal:regles.filter(r=>r==='signal').length,vuesALaStabilite:regles.filter(r=>r==='stabilite').length,
      posesReplis:replis.filter(m=>m===mode).length};
    bras[mode]._cy=cy;}
  const a=bras.reference,b=bras.rapide,delta=a.cycleMedianMs!==null&&b.cycleMedianMs!==null?b.cycleMedianMs-a.cycleMedianMs:null;
  const ecart={cycleMs:delta,pct:delta!==null&&a.cycleMedianMs?100*delta/a.cycleMedianMs:null,intervalle95:intervalle(a._cy,b._cy),bruitAAPct:BRUIT_AA_PCT,
    auDelaDuBruit:delta!==null&&a.cycleMedianMs?Math.abs(100*delta/a.cycleMedianMs)>BRUIT_AA_PCT:null};
  for(const mode of MODES)delete bras[mode]._cy;
  return {lot:batchId,version:data.version??null,bras,ecart,controle};}

const s=x=>x===null||x===undefined?'—':(x/1000).toFixed(2).replace('.',',')+' s';
const pc=x=>x===null||x===undefined?'—':(100*x).toFixed(1).replace('.',',')+' %';
function toMarkdown(r){const a=r.bras.reference,b=r.bras.rapide,L=[];
  L.push(`# V3 : mode rapide contre référence (même lot)`,'',`Lot ${r.lot??'tous'} ; version ${r.version??'?'}.`,'',
    '| Mesure | Référence | Rapide |','|---|---:|---:|',
    `| Cuts (visites) | ${a.visites} | ${b.visites} |`,`| Cycle médian (V1) | ${s(a.cycleMedianMs)} | ${s(b.cycleMedianMs)} |`,
    `| Cycle P90 | ${s(a.cycleP90Ms)} | ${s(b.cycleP90Ms)} |`,`| Part posée (C1) | ${pc(a.partPosee)} | ${pc(b.partPosee)} |`,
    `| Différées | ${a.differees} | ${b.differees} |`,`| Captures (en erreur) | ${a.captures} (${a.capturesEnErreur}) | ${b.captures} (${b.capturesEnErreur}) |`,
    `| Relectures d'une vue | ${a.relectures} | ${b.relectures} |`,`| Capture médiane | ${s(a.captureMedianeMs)} | ${s(b.captureMedianeMs)} |`,
    `| Sélection par rail | ${s(a.selectionParRailMs)} | ${s(b.selectionParRailMs)} |`,`| Stabilité par rail | ${s(a.stabiliteParRailMs)} | ${s(b.stabiliteParRailMs)} |`,
    `| Lecture par rail (médiane / P90) | ${s(a.lectureParRailMs)} / ${s(a.lectureParRailP90Ms)} | ${s(b.lectureParRailMs)} / ${s(b.lectureParRailP90Ms)} |`,
    `| Points par capture | ${a.pointsMedian??'—'} | ${b.pointsMedian??'—'} |`,
    `| Pose médiane (phase V1) | ${s(a.poseMedianeMs)} | ${s(b.poseMedianeMs)} |`,
    `| Vues lues au signal / à la règle des 800 ms | ${a.vuesAuSignal} / ${a.vuesALaStabilite} | ${b.vuesAuSignal} / ${b.vuesALaStabilite} |`,
    `| Poses retombées sur le recentrage | ${a.posesReplis} | ${b.posesReplis} |`,'');
  const e=r.ecart;
  L.push(e.cycleMs===null?'Écart du cycle médian : non mesuré.':`Écart du cycle médian (rapide − référence) : ${s(e.cycleMs)} (${e.pct.toFixed(1).replace('.',',')} %)`
    +(e.intervalle95?`, intervalle à 95 % de ${s(e.intervalle95.bas)} à ${s(e.intervalle95.haut)}`:'')+`. Bruit A/A : ${e.bruitAAPct} % ; `
    +(e.auDelaDuBruit?'écart au-delà du bruit.':'écart dans le bruit.'));
  const c=r.controle,nomRegle={tirage:'un cut sur deux',echantillon:'un cut sur dix en référence',toujours:'tous rapides',reference:'aucun rapide'}[c.regle]??c.regle;
  const vues=Object.entries(c.reglesVues||{});
  L.push('',`Règle du lot : « ${c.regle} » (${nomRegle})${vues.length>1?` ; ATTENTION, plusieurs règles dans ces captures : ${vues.map(([n,k])=>`${n} (${k})`).join(', ')} ; chaque visite est rangée selon le mode consigné de sa capture`:c.regleConsignee?', consignée par la page':', déduite (export d\'avant la 4.9.0.9)'} ; étapes datées par la page : ${c.etapesDateesParLaPage??0} capture(s) ; visites sans capture consignée : ${c.visitesSansCaptureConsignee??0}.`);
  L.push('',`Contrôle du tirage : ${c.desaccords} capture(s) dont le mode consigné diffère du tirage ; ${c.capturesSansMode} capture(s) sans mode consigné`
    +(c.capturesSansMode?' (export d\'avant la 4.9.0.6 : mode recalculé par le tirage)':'')+'.');
  return L.join('\n')+'\n';}

function run(argv=process.argv.slice(2)){const file=argv.find((x,i)=>!x.startsWith('--')&&!['--json','--md'].includes(argv[i-1]));
  if(!file)throw Error('Usage : node tools/perf-v3.cjs BILAN.json [--tous] [--json SORTIE.json] [--md SORTIE.md]');
  const opt=k=>{const i=argv.indexOf(k);return i>=0?argv[i+1]:null;};const brut=fs.readFileSync(file);
  const r=comparer(JSON.parse((file.endsWith('.gz')?zlib.gunzipSync(brut):brut).toString('utf8')),{tous:argv.includes('--tous')});
  if(opt('--json'))fs.writeFileSync(opt('--json'),JSON.stringify(r,null,1)+'\n');
  const md=toMarkdown(r);if(opt('--md'))fs.writeFileSync(opt('--md'),md);else process.stdout.write(md);return r;}
if(require.main===module)try{run();}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={tirage,REGLES,regleDuLot,comparer,toMarkdown,intervalle,captures,BRUIT_AA_PCT,run};
