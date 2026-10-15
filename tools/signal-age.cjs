#!/usr/bin/env node
'use strict';
/* 4.9.5.1 (D-109) — PART DES VUES LUES AU SIGNAL SELON L'ÂGE DE LA PAGE ESV.
 *
 * Constat des tests 15 à 17 : pendant ~10 min après le chargement d'une page ESV, la plupart des vues
 * sont lues « au signal » (fin de chargement de Potree) ; ensuite tout passe au repli « stabilite »
 * (800 ms), et un F5 rétablit le signal. Cet outil range chaque lecture d'une vue (étape `capture-read`
 * du journal exporté) par page ESV et par tranche de 5 min d'âge de la page, et dit :
 *   — la part lue au signal par tranche ;
 *   — au repli, la condition qui manquait le plus souvent (`diag.m`, consigné depuis la 4.9.5.1 :
 *     « chargements » = `Potree.numNodesLoading` ≠ 0, « images », « noeuds », « vue », « aucune ») ;
 *   — au repli, la part où des chargements restaient en cours à la fin, et le maximum médian vu.
 *
 * Seules comptent les lectures qui PEUVENT finir au signal : mode rapide, première tentative
 * (une relecture et un cut « référence » attendent toujours 800 ms ; `diag.m` = « hors-signal »).
 *
 * Âge de la page : `diag.navS` (depuis la navigation de la page, remis à zéro par un F5) quand il est
 * consigné (4.9.5.1 et après) ; sinon, pour les anciens exports, depuis le premier événement du journal
 * portant cette page (`identity.pageId`) : c'est l'âge depuis la première action d'Ariane sur la page,
 * une borne basse de l'âge réel.
 *
 * Usage : node tools/signal-age.cjs export.json [export2.json …] [--json]
 * (un export en volumes : passer le JSON de chaque volume ; les lectures sont réunies par page.) */
const fs=require('node:fs');
const V1=require('./perf-phases.cjs');
const TRANCHE_S=300;

function evenements(data){
 if(data&&data.dictionaries&&Array.isArray(data.events))return V1.resolveRefs(data.events,data.dictionaries).value;
 return Array.isArray(data?.events)?data.events:[];}

/* Une lecture pouvant finir au signal ? Avec diagnostic : tout sauf « hors-signal ». Sans : rapide, 1re tentative. */
function eligible(d){if(d.diag&&typeof d.diag==='object')return d.diag.m!=='hors-signal';return d.lecture==='rapide'&&d.attempt===1;}

function lectures(events){
 const premier=new Map();
 for(const e of events){const p=e.identity?.pageId,t=Date.parse(e.timestamp);if(p&&Number.isFinite(t)&&(!premier.has(p)||t<premier.get(p)))premier.set(p,t);}
 const out=[];
 for(const e of events){
  if(e.type!=='adapter-progress'||e.action!=='capture'||e.lastStage!=='capture-read')continue;
  const d=e.lastDetail||{};if(d.regle!=='signal'&&d.regle!=='stabilite')continue;if(!eligible(d))continue;
  const p=e.identity?.pageId??null,t=Date.parse(e.timestamp),g=d.diag&&typeof d.diag==='object'?d.diag:null;
  let ageS=null,source=null;
  if(Number.isFinite(g?.navS)){ageS=g.navS;source='page';}
  else if(p&&premier.has(p)&&Number.isFinite(t)){ageS=Math.max(0,(t-premier.get(p))/1000);source='journal';}
  out.push({page:p,at:Number.isFinite(t)?t:null,ageS,source,regle:d.regle,diag:g,cut:e.identity?.cut??null});}
 return out;}

const median=a=>{const s=a.filter(Number.isFinite).sort((x,y)=>x-y);return s.length?(s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2):null;};
function dominante(l){const n={};for(const x of l)if(x.regle==='stabilite'&&x.diag?.m)n[x.diag.m]=(n[x.diag.m]||0)+1;
 const tri=Object.entries(n).sort((a,b)=>b[1]-a[1]);return {dominante:tri[0]?.[0]??null,conditions:Object.fromEntries(tri)};}
function bilan(l){const signal=l.filter(x=>x.regle==='signal').length,repli=l.length-signal,replis=l.filter(x=>x.regle==='stabilite'&&x.diag);
 return {lectures:l.length,signal,repli,partSignal:l.length?signal/l.length:null,...dominante(l),
  replisAvecDiagnostic:replis.length,
  replisChargementFinal:replis.filter(x=>Array.isArray(x.diag.nl)&&x.diag.nl[0]>0).length,
  chargementsMaxMedian:median(replis.map(x=>Array.isArray(x.diag.nl)?x.diag.nl[1]:null)),
  imagesMedian:median(replis.map(x=>x.diag.img)),
  noeudsMedian:median(l.map(x=>x.diag?.noeuds)),lruPtsMedian:median(l.map(x=>x.diag?.lruPts)),memMoMedian:median(l.map(x=>x.diag?.memMo))};}

function analyser(events){
 const l=lectures(events),pages=new Map();
 for(const x of l){const k=x.page??'(sans page)';if(!pages.has(k))pages.set(k,[]);pages.get(k).push(x);}
 const parPage=[...pages].map(([page,ls])=>{const tr=new Map();
  for(const x of ls){const k=Number.isFinite(x.ageS)?Math.floor(x.ageS/TRANCHE_S)*5:null;if(!tr.has(k))tr.set(k,[]);tr.get(k).push(x);}
  const debut=Math.min(...ls.map(x=>x.at).filter(Number.isFinite));
  return {page,debut:Number.isFinite(debut)?new Date(debut).toISOString():null,ageSource:ls.some(x=>x.source==='page')?'page':'journal',
   tranches:[...tr].sort((a,b)=>(a[0]??1e9)-(b[0]??1e9)).map(([min,xs])=>({minutes:min,...bilan(xs)})),...bilan(ls)};})
  .sort((a,b)=>String(a.debut).localeCompare(String(b.debut)));
 const tranches=new Map();
 for(const x of l){const k=Number.isFinite(x.ageS)?Math.floor(x.ageS/TRANCHE_S)*5:null;if(!tranches.has(k))tranches.set(k,[]);tranches.get(k).push(x);}
 return {lectures:l.length,avecDiagnostic:l.filter(x=>x.diag).length,pages:parPage,
  tranches:[...tranches].sort((a,b)=>(a[0]??1e9)-(b[0]??1e9)).map(([min,xs])=>({minutes:min,...bilan(xs)})),...bilan(l)};}

const pct=v=>v==null?'—':Math.round(v*100)+' %';
const libTranche=m=>m==null?'âge inconnu':`${String(m).padStart(3)} à ${m+5} min`;
function ligne(t){return `| ${libTranche(t.minutes)} | ${t.lectures} | ${t.signal} | ${t.repli} | ${pct(t.partSignal)} | ${t.dominante??'—'} | ${t.replisAvecDiagnostic?`${t.replisChargementFinal} / ${t.replisAvecDiagnostic}`:'—'} |`;}
function toMarkdown(r){
 const o=[`# Signal de fin de chargement selon l'âge de la page ESV`,'',
  `${r.lectures} lectures pouvant finir au signal (mode rapide, première tentative), dont ${r.avecDiagnostic} avec diagnostic (4.9.5.1).`,
  `Ensemble : ${pct(r.partSignal)} au signal ; condition manquante dominante au repli : ${r.dominante??'non consignée (export d’avant la 4.9.5.1)'}`+
  (r.dominante?` (${Object.entries(r.conditions).map(([k,v])=>`${k} ${v}`).join(', ')})`:'')+'.',''];
 const tete=['| Âge de la page | Lectures | Signal | Repli 800 ms | Part au signal | Manque dominant | Repli avec chargement en cours à la fin |','|---|---|---|---|---|---|---|'];
 o.push('## Toutes pages',...tete,...r.tranches.map(ligne),'');
 for(const p of r.pages){o.push(`## Page ${String(p.page).slice(0,8)} (début ${p.debut??'?'}, âge ${p.ageSource==='page'?'depuis le chargement de la page':'depuis la première action d’Ariane, borne basse'})`,...tete,...p.tranches.map(ligne),'');
  if(p.replisAvecDiagnostic)o.push(`Repli : chargements max médian ${p.chargementsMaxMedian??'—'}, images médianes ${p.imagesMedian??'—'} ; nœuds médians ${p.noeudsMedian??'—'}, points en cache médians ${p.lruPtsMedian??'—'}, mémoire JS médiane ${p.memMoMedian??'—'} Mo.`,'');}
 return o.join('\n');}

function run(argv=process.argv.slice(2)){
 const fichiers=argv.filter(a=>!a.startsWith('--')),json=argv.includes('--json');
 if(!fichiers.length)throw Error('Usage : node tools/signal-age.cjs export.json [export2.json …] [--json]');
 const ev=[];for(const f of fichiers)ev.push(...evenements(JSON.parse(fs.readFileSync(f,'utf8'))));
 const r=analyser(ev);process.stdout.write(json?JSON.stringify(r,null,1)+'\n':toMarkdown(r)+'\n');return r;}
if(require.main===module)try{run();}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={lectures,analyser,toMarkdown,run,TRANCHE_S};
