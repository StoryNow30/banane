#!/usr/bin/env node
'use strict';
/*
 * perf-relecture-phases.cjs — temps d'une relecture après le lot, par phase et par mode.
 * Lecture seule. Le chemin des données vient d'un argument (fichier, zip ou dossier).
 *
 *   node tools/perf-relecture-phases.cjs CHEMIN [--json SORTIE.json] [--md SORTIE.md]
 *
 * Une passe va de `relecture-debut` au `relecture-fin` du même lot. Pour chaque cut relu
 * (`relecture-ombre` qui porte `durees`), sept phases :
 *   attente de la page, lecture du nuage, recapture, décision, écriture, validation,
 *   attente de l'état de l'adaptateur (refus ADAPTER_BUSY, somme des `attenteMs`).
 *
 * Les `adapter-result` se rangent par la fenêtre de temps (événement précédent, cet
 * événement], pas par `identity` : pendant la relecture ce champ est celui de la demande,
 * souvent le cut d'avant. Sans commande, repli sur `durees` (navigation, capture, calcul).
 * Deux captures annoncées (`skipOmbre.captures`) sans deux commandes : la lecture et la
 * recapture restent non mesurées, la durée brute est publiée à part. Une phase absente
 * vaut `null`, jamais zéro deviné. Zéro : la phase n'a pas eu lieu (aucune recapture,
 * aucune écriture sur une visite, aucune attente ADAPTER_BUSY).
 *
 * Le résidu est `durees.totalMs` moins la somme des phases mesurées : lectures d'état et
 * attente de l'écriture qui ne sont pas des commandes journalisées.
 *
 * Mur, pauses exclues : `relecture-fin.dureeMs` moins les pauses explicites
 * (`relecture-pause` → `relecture-reprise` ou fin) et moins les trous inférés de plus de
 * 60 s (écart entre deux cuts moins le `totalMs` du second). La cible du cahier est 1,8 s
 * par cut relu (`faits`), sur ce mur. La même passe lue dans plusieurs journaux ne compte
 * qu'une fois. Aucun identifiant n'est repris dans le rapport.
 */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const PHASES=[
  ['attentePage','Attente de la page'],
  ['lectureNuage','Lecture du nuage'],
  ['recapture','Recapture'],
  ['decision','Décision'],
  ['ecriture','Écriture'],
  ['validation','Validation'],
  ['attenteAdaptateur','Attente de l’état de l’adaptateur'],
];
const SILENCE_MS=60000,CIBLE_MS=1800;
const ECRITURE=new Set(['apply','restore']);
const ts=e=>Date.parse(e?.timestamp);
const fini=Number.isFinite;
const somme=xs=>xs.reduce((s,x)=>s+x,0);
function stats(values){const v=values.filter(fini).sort((a,b)=>a-b);if(!v.length)return {n:0,median:null,p90:null,moyenne:null,max:null,total:null};
  const q=p=>v[Math.min(v.length-1,Math.floor(p*(v.length-1)+0.5))];
  return {n:v.length,median:q(.5),p90:q(.9),moyenne:v.reduce((s,x)=>s+x,0)/v.length,max:v.at(-1),total:v.reduce((s,x)=>s+x,0)};}
function union(intervals){const a=intervals.filter(([x,y])=>fini(x)&&fini(y)&&y>x).sort((p,q)=>p[0]-q[0]);
  const out=[];for(const [x,y] of a){const z=out.at(-1);if(z&&x<=z[1])z[1]=Math.max(z[1],y);else out.push([x,y]);}return out;}
const longueur=iv=>iv.reduce((s,[x,y])=>s+y-x,0);
/* Portions de `a` qui ne sont couvertes par aucun intervalle de `b`. */
function hors(a,b){const out=[];for(const [x,y] of a){let c=x;for(const [u,v] of b){if(v<=c||u>=y)continue;if(u>c)out.push([c,Math.min(u,y)]);c=Math.max(c,v);if(c>=y)break;}if(c<y)out.push([c,y]);}return out;}
function collectionDe(source){const m=String(source||'').match(/(2026-[^/]+)/);return m?m[1]:null;}

function phaseDuCut(ombre,commandes,attentes){
  const d=ombre.durees||{},action=ombre.action||null;
  const gotos=commandes.filter(c=>c.action==='goToCut'&&fini(c.elapsedMs));
  const captures=commandes.filter(c=>c.action==='capture'&&fini(c.elapsedMs));
  const ecritures=commandes.filter(c=>ECRITURE.has(c.action)&&fini(c.elapsedMs));
  const validations=commandes.filter(c=>c.action==='validerMajEspace'&&fini(c.elapsedMs));
  const attenteAdaptateur=somme(attentes.map(e=>fini(e.attenteMs)?e.attenteMs:0));
  const sources={attentePage:null,lectureNuage:null};
  let attentePage=null;
  if(gotos.length){attentePage=somme(gotos.map(c=>c.elapsedMs));sources.attentePage='commandes';}
  else if(fini(d.navigationMs)){attentePage=Math.max(0,d.navigationMs-attenteAdaptateur);sources.attentePage='repli-durees';}
  let lectureNuage=null,recapture=null;
  const annoncees=ombre.skipOmbre?.captures;
  if(captures.length){lectureNuage=captures[0].elapsedMs;recapture=somme(captures.slice(1).map(c=>c.elapsedMs));sources.lectureNuage='commandes';}
  else if(fini(d.captureMs)&&!(annoncees>=2)){lectureNuage=d.captureMs;recapture=0;sources.lectureNuage='repli-durees';}
  const decision=fini(d.calculMs)?d.calculMs:null;
  const ecriture=ecritures.length?somme(ecritures.map(c=>c.elapsedMs)):(action==='corrige'||action==='correction-refusee'||action==='correction-incertaine'?null:0);
  const validation=validations.length?somme(validations.map(c=>c.elapsedMs)):(action==='corrige'?null:0);
  const phases={attentePage,lectureNuage,recapture,decision,ecriture,validation,attenteAdaptateur};
  const complet=fini(d.totalMs)&&PHASES.every(([id])=>fini(phases[id]));
  const points=fini(captures[0]?.lastDetail?.points)?captures[0].lastDetail.points:null;
  return {phases,sources,residuMs:complet?d.totalMs-somme(PHASES.map(([id])=>phases[id])):null,
    captureNonDecoupeeMs:lectureNuage==null&&fini(d.captureMs)?d.captureMs:null,totalMs:fini(d.totalMs)?d.totalMs:null,points};
}

function tempsMur(passe,cuts){
  const fin=passe.fin,tDeb=ts(passe.debut),tFin=fin?ts(fin):null;
  const dureeMs=fini(fin?.dureeMs)?fin.dureeMs:(fini(tDeb)&&fini(tFin)?tFin-tDeb:null);
  const pauses=[];let ouv=null;
  for(const e of passe.events){if(e.type==='relecture-pause')ouv=ts(e);
    else if((e.type==='relecture-reprise'||e.type==='relecture-fin')&&ouv!=null){const z=ts(e);if(fini(ouv)&&fini(z)&&z>ouv)pauses.push([ouv,z]);ouv=null;}}
  const pausesU=union(pauses);
  const seq=[{t:tDeb,total:0},...cuts.map(c=>({t:c.t,total:c.totalMs})),...(fini(tFin)?[{t:tFin,total:0}]:[])];
  const idles=[];
  for(let i=1;i<seq.length;i++){if(!fini(seq[i].t)||!fini(seq[i-1].t))continue;
    const work=fini(seq[i].total)?seq[i].total:0,idle=seq[i].t-seq[i-1].t-work;
    if(idle>SILENCE_MS)idles.push([seq[i].t-idle,seq[i].t]);}
  const silenceU=union(hors(idles,pausesU));
  const pauseMs=longueur(pausesU),silenceMs=longueur(silenceU);
  const actifMs=fini(dureeMs)?dureeMs-pauseMs-silenceMs:null;
  const faits=Number.isInteger(fin?.faits)?fin.faits:cuts.length;
  const msParCut=faits>0&&fini(actifMs)?actifMs/faits:null;
  return {dureeMs,pauseMs,silenceMs,actifMs,faits,msParCut,brutMsParCut:faits>0&&fini(dureeMs)?dureeMs/faits:null,
    ecartCibleMs:fini(msParCut)?msParCut-CIBLE_MS:null};
}

function passeDe(bloc,version,source){
  const ev=bloc.events,fin=bloc.fin,debut=bloc.debut;
  const marqueurs=ev.filter(e=>e.type==='relecture-debut'||e.type==='relecture-ombre');
  const cuts=[],sans=[0];
  marqueurs.forEach((e,i)=>{
    if(e.type!=='relecture-ombre')return;
    const d=e.durees;if(!d||!['navigationMs','captureMs','calculMs','totalMs'].some(k=>fini(d[k]))){sans[0]++;return;}
    const prev=ts(marqueurs[i-1]),ici=ts(e);
    const dans=(x)=>fini(ts(x))&&ts(x)>prev&&ts(x)<=ici;
    const commandes=ev.filter(x=>x.type==='adapter-result'&&dans(x));
    const attentes=ev.filter(x=>x.type==='relecture-navigation-attente'&&dans(x));
    const ph=phaseDuCut(e,commandes,attentes);
    cuts.push({t:ici,tPrev:prev,partie:Number.isInteger(e.identity?.part)?e.identity.part:null,cut:Number.isInteger(e.identity?.cut)?e.identity.cut:null,
      zone:typeof e.zone==='string'?e.zone:null,action:e.action||null,mode:e.mode||debut.modeEffectif||debut.mode||null,...ph});
  });
  let attenteHorsN=0,attenteHorsMs=0;
  for(const a of ev){if(a.type!=='relecture-navigation-attente')continue;const t=ts(a);
    if(cuts.some(c=>fini(c.tPrev)&&fini(c.t)&&t>c.tPrev&&t<=c.t))continue;
    attenteHorsN++;if(fini(a.attenteMs))attenteHorsMs+=a.attenteMs;}
  const mur=tempsMur({debut,fin,events:ev},cuts);
  const parties=cuts.map(c=>c.partie).filter(Number.isInteger);
  const freq=new Map();for(const p of parties)freq.set(p,(freq.get(p)||0)+1);
  const partie=freq.size?[...freq.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0][0]:null;
  const mode=fin?.modeEffectif||debut.modeEffectif||fin?.mode||debut.mode||null;
  return {collection:collectionDe(source),version:version??null,partie,mode,issue:fin?.issue??null,
    debut:debut.timestamp,corriges:Number.isInteger(fin?.corriges)?fin.corriges:cuts.filter(c=>c.action==='corrige').length,
    sansDurees:sans[0],attenteHorsCutN:attenteHorsN,attenteHorsCutMs:attenteHorsMs,points:stats(cuts.map(c=>c.points)),cuts,...mur};
}

function blocs(events){
  const ev=(events||[]).filter(e=>e&&fini(ts(e))).sort((a,b)=>ts(a)-ts(b));
  const out=[];let cur=null;
  for(const e of ev){
    if(e.type==='relecture-debut'){if(cur)out.push(cur);cur={debut:e,fin:null,events:[e],lotId:e.lotId??e.batchId??null};continue;}
    if(!cur)continue;
    const meme=!cur.lotId||!(e.lotId||e.batchId)||(e.lotId||e.batchId)===cur.lotId;
    if(!meme)continue;
    if(e.type==='relecture-fin'){cur.events.push(e);cur.fin=e;out.push(cur);cur=null;continue;}
    if(e.type==='relecture-ombre'||e.type==='relecture-pause'||e.type==='relecture-reprise'||e.type==='relecture-navigation-attente'||e.type==='adapter-result')
      cur.events.push(e);
  }
  if(cur)out.push(cur);
  return out;
}

function cle(p){return [p.debut,p.dureeMs??'',p.faits??'',p.mode??'',p.partie??''].join('|');}
function dedupe(passes){const vu=new Map();
  for(const p of passes){const k=cle(p),ancien=vu.get(k);if(!ancien||p.cuts.length>ancien.cuts.length)vu.set(k,p);}return [...vu.values()];}

function agreger(passes){
  const parMode={};
  for(const p of passes){if(p.mode!=='ombre'&&p.mode!=='corriger')continue;(parMode[p.mode]||=[]).push(p);}
  const out={};
  for(const [mode,ps] of Object.entries(parMode)){
    const cuts=ps.flatMap(p=>p.cuts);
    if(!cuts.length)continue;
    const phases={};let sommeMedianes=0;
    for(const [id] of PHASES){const s=stats(cuts.map(c=>c.phases[id]));phases[id]=s;if(fini(s.median))sommeMedianes+=s.median;}
    for(const [id] of PHASES)phases[id].part=sommeMedianes&&fini(phases[id].median)?phases[id].median/sommeMedianes:null;
    out[mode]={n:cuts.length,passes:ps.length,sommeMedianesMs:sommeMedianes||null,phases,
      residu:stats(cuts.map(c=>c.residuMs)),totalMs:stats(cuts.map(c=>c.totalMs)),
      msParCut:stats(ps.map(p=>p.msParCut)),actifMs:stats(ps.map(p=>p.actifMs)),
      parZone:zonesDe(cuts),parAction:actionsDe(cuts)};
  }
  return out;
}
function zonesDe(cuts){const m=new Map();for(const c of cuts){const z=c.zone||'?';if(!m.has(z))m.set(z,[]);m.get(z).push(c);}
  return Object.fromEntries([...m.entries()].sort().map(([z,cs])=>[z,{n:cs.length,totalMs:stats(cs.map(c=>c.totalMs)),lectureNuage:stats(cs.map(c=>c.phases.lectureNuage))}]));}
function actionsDe(cuts){const m=new Map();for(const c of cuts){const a=c.action||'?';if(!m.has(a))m.set(a,[]);m.get(a).push(c);}
  return Object.fromEntries([...m.entries()].sort().map(([a,cs])=>[a,{n:cs.length,totalMs:stats(cs.map(c=>c.totalMs)),ecriture:stats(cs.map(c=>c.phases.ecriture)),validation:stats(cs.map(c=>c.phases.validation))}]));}

function measure(data,{source=null}={}){
  const journaux=Array.isArray(data)?data.map(d=>({data:d,source})):[ {data,source} ];
  const passes=[];
  for(const j of journaux)for(const b of blocs(j.data?.events))passes.push(passeDe(b,j.data?.version??null,j.source));
  const uniques=dedupe(passes);
  return {cibleMs:CIBLE_MS,silenceSeuilMs:SILENCE_MS,passes:uniques,parMode:agreger(uniques)};
}

const sec=v=>!fini(v)?'—':v<1000?Math.round(v)+' ms':(Math.round(v/100)/10).toFixed(1).replace('.',',')+' s';
const pct=v=>!fini(v)?'—':(v*100).toFixed(1).replace('.',',')+' %';
function toMarkdown(m){
  const L=['# Relecture par phase','',
    `Cible ${sec(m.cibleMs)} par cut relu (\`relecture-fin.dureeMs\` / cuts, pauses explicites et trous de plus de ${Math.round(m.silenceSeuilMs/1000)} s exclus). Médiane, p90, moyenne. Part = médiane de la phase / somme des médianes.`];
  const modes=Object.keys(m.parMode);
  if(!modes.length)L.push('','Aucune passe de relecture dans ces journaux.');
  for(const mode of modes){
    const g=m.parMode[mode];
    L.push('',`## Mode ${mode}`,'',`${g.passes} passe${g.passes>1?'s':''}, ${g.n} cuts à durées. Mur hors pauses : médiane ${sec(g.msParCut.median)} (${g.msParCut.n} passe${g.msParCut.n>1?'s':''}).`,'',
      '| Phase | n | médiane | p90 | moyenne | part |','|---|---:|---:|---:|---:|---:|');
    for(const [id,libelle] of PHASES){const s=g.phases[id];L.push(`| ${libelle} | ${s.n} | ${sec(s.median)} | ${sec(s.p90)} | ${sec(s.moyenne)} | ${pct(s.part)} |`);}
    L.push(`| Résidu (total − phases) | ${g.residu.n} | ${sec(g.residu.median)} | ${sec(g.residu.p90)} | ${sec(g.residu.moyenne)} | |`,
      `| Total du cut (\`durees.totalMs\`) | ${g.totalMs.n} | ${sec(g.totalMs.median)} | ${sec(g.totalMs.p90)} | ${sec(g.totalMs.moyenne)} | |`);
  }
  if(m.passes.length){
    L.push('','## Passes','','| Collection | Version | Partie | Mode | Issue | Relus | Corrigés | Pauses | Trous | Attente hors cuts | Points | Par cut hors pauses | Écart à 1,8 s |','|---|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for(const p of m.passes)L.push(`| ${p.collection||'—'} | ${p.version||'—'} | ${p.partie??'—'} | ${p.mode||'—'} | ${p.issue||'—'} | ${p.faits??'—'} | ${p.corriges??'—'} | ${sec(p.pauseMs)} | ${sec(p.silenceMs)} | ${p.attenteHorsCutN?`${p.attenteHorsCutN} · ${sec(p.attenteHorsCutMs)}`:'0'} | ${p.points?.n?Math.round(p.points.median):'—'} | ${sec(p.msParCut)} | ${sec(p.ecartCibleMs)} |`);
  }
  return L.join('\n')+'\n';
}

/* --------------------------------------------------------------- lecture */
const V=require('./lire-volumes.cjs');
function marcher(racine,acc=[]){for(const n of fs.readdirSync(racine)){const p=path.join(racine,n);const s=fs.statSync(p);
  if(s.isDirectory())marcher(p,acc);else acc.push(p);}return acc;}
function journalDepuis(fichier){
  if(/\.zip$/i.test(fichier))return V.entreesZip(fichier).filter(e=>/journal/i.test(e.nom)&&/\.json(\.gz)?$/i.test(e.nom)).map(e=>({
    source:fichier+'#'+e.nom,texte:()=>/\.gz$/i.test(e.nom)?zlib.gunzipSync(e.lire()).toString('utf8'):e.lire().toString('utf8')}));
  if(/\.json\.gz$/i.test(fichier))return [{source:fichier,texte:()=>zlib.gunzipSync(fs.readFileSync(fichier)).toString('utf8')}];
  if(/\.json$/i.test(fichier))return [{source:fichier,texte:()=>fs.readFileSync(fichier,'utf8')}];
  return [];
}
function lireJournaux(chemin){
  const fichiers=fs.statSync(chemin).isDirectory()?marcher(chemin):[chemin];
  const out=[];
  for(const f of fichiers)for(const e of journalDepuis(f)){let data;try{data=JSON.parse(e.texte());}catch{continue;}
    if(!Array.isArray(data?.events))continue;out.push({source:e.source,data});}
  return out;
}
function fusionner(mesures){const passes=dedupe(mesures.flatMap(m=>m.passes));return {cibleMs:CIBLE_MS,silenceSeuilMs:SILENCE_MS,passes,parMode:agreger(passes)};}

function args(argv){const o={json:null,md:null,chemin:null};const pos=[];
  for(let i=0;i<argv.length;i++){const a=argv[i];if(a==='--json')o.json=argv[++i];else if(a==='--md')o.md=argv[++i];else if(a.startsWith('--'))throw Error('argument inconnu : '+a);else pos.push(a);}
  if(pos.length!==1)throw Error('usage : node tools/perf-relecture-phases.cjs CHEMIN [--json F] [--md F]');
  o.chemin=pos[0];return o;}
function main(argv){
  const o=args(argv),journaux=lireJournaux(o.chemin);
  if(!journaux.length)throw Error('Aucun journal (events) dans '+o.chemin);
  const m=fusionner(journaux.map(j=>measure(j.data,{source:j.source})));
  if(o.json)fs.writeFileSync(o.json,JSON.stringify(m));
  if(o.md)fs.writeFileSync(o.md,toMarkdown(m));
  process.stdout.write(toMarkdown(m));
  return m;
}
module.exports={measure,toMarkdown,PHASES,CIBLE_MS};
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message||e);process.exit(1);}}
