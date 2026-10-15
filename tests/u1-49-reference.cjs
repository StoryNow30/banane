#!/usr/bin/env node
'use strict';
/* U1 (mission G) — comptes du résumé de partie face à l'outil d'analyse, COUPE
 * PAR COUPE, sur des lots réels. Rejeu explicite, hors banc (exports privés,
 * jamais versés au dépôt) :
 *
 *   node tests/u1-49-reference.cjs RACINE SORTIE.json
 *
 * RACINE contient un dossier par lot (« lot 23 initial », « lot 25 »…), avec son
 * journal (`journal-v4`) et son diagnostic, comme pour tools/analyse-locale.cjs ;
 * le numéro de partie est le premier nombre du nom.
 *
 * Trois contrôles, tous à zéro différence :
 *  1. lot courant : chaque lot lu dans SON export (état + historique) ;
 *  2. lot passé : chaque lot relu dans un export PLUS TARDIF de la même session,
 *     depuis l'historique seul, ESV montrant la dernière page vue par ce lot ;
 *  3. cumul : la partie résumée dans le dernier export, comparée à l'union des
 *     lots de l'outil où la dernière issue d'une coupe l'emporte (R7).
 * Correspondance des catégories (outil → résumé) : applied → posée ; deferred →
 * différé moteur ; gauge-rejected → différé écartement ; no-input « différé sans
 * point LiDAR » → différé sans points ; tout le reste (other, no-input sans
 * différé) → issue inconnue. L'outil n'est pas modifié. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const A=require('../tools/analyse-locale.cjs'),U=require('../src/part-summary-49.js');
const [root,out]=process.argv.slice(2);if(!root||!out)throw Error('Usage : node tests/u1-49-reference.cjs RACINE SORTIE.json');

const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function toolStatus(r){
  if(r.outcome==='applied')return {status:'posed',kind:null};
  if(r.outcome==='deferred')return {status:'deferred',kind:'engineDeferred'};
  if(r.outcome==='gauge-rejected')return {status:'deferred',kind:'gaugeRejected'};
  if(r.outcome==='no-input'&&r.reason==='différé-sans-point-lidar')return {status:'deferred',kind:'noInput'};
  return {status:'unknown',kind:null};}
const CATS=['distinct','posed','deferred','engineDeferred','gaugeRejected','noInput','unclassifiedDeferred','manual','skipped','unknown'];
function counts(rows){const c=Object.fromEntries(CATS.map(k=>[k,0]));
  for(const r of rows){c.distinct++;c[r.status]++;if(r.status==='deferred')c[r.kind]++;}return c;}
/* Différences coupe par coupe entre deux listes {cut,status,kind}. */
function diff(tool,panel){const a=new Map(tool.map(r=>[r.cut,r])),b=new Map(panel.map(r=>[r.cut,r])),d=[];
  for(const cut of new Set([...a.keys(),...b.keys()])){const x=a.get(cut),y=b.get(cut);
    if(!x||!y||x.status!==y.status||(x.kind??null)!==(y.kind??null))d.push({cut,outil:x?`${x.status}${x.kind?'/'+x.kind:''}`:'absent',resume:y?`${y.status}${y.kind?'/'+y.kind:''}`:'absent'});}
  return d.sort((p,q)=>p.cut-q.cut);}
const ecarts=(t,p)=>Object.fromEntries(CATS.map(k=>[k,p[k]-t[k]]));

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'u1-49-ref-'));
const lots=[];
try{
  const dirs=fs.readdirSync(root).filter(n=>/\d/.test(n)&&fs.statSync(path.join(root,n)).isDirectory()).sort((a,b)=>a.localeCompare(b,'fr',{numeric:true}));
  for(const nom of dirs){const dir=path.join(root,nom),part=Number(/(\d+)/.exec(nom)[1]);
    const files=fs.readdirSync(dir).filter(n=>n.endsWith('.json')).sort().map(n=>path.join(dir,n));
    const jf=files.find(f=>/journal-v4/.test(path.basename(f)));if(!jf)throw Error('Journal manquant : '+dir);
    const r=A.analyserLot({part,nom,dir},[],{memoire:2048},tmp,'lot-'+lots.length);
    if(r.acceptation.erreur)throw Error(nom+' : '+r.acceptation.erreur);
    const rapport=r.acceptation.rapport,lotTool=rapport.lots[0],journal=JSON.parse(fs.readFileSync(jf,'utf8'));
    const toolRows=lotTool.rows.filter(x=>!x.excluded).map(x=>({cut:x.cut,part:x.part,...toolStatus(x),outcome:x.outcome,reason:x.reason??null}));
    if(toolRows.some(x=>x.part!==part))throw Error(nom+' : l’outil compte une coupe hors de la partie '+part+' ; correspondance à revoir.');
    lots.push({nom,part,dir,journal,journalFile:jf,batchId:journal.state.batch.id,startedAt:journal.state.batch.startedAt,state:journal.state.batch.state,
      inputs:files.map(f=>({file:path.basename(f),bytes:fs.statSync(f).size,sha256:sha(f)})),
      tool:{c1:rapport.total.c1,rows:toolRows,excluded:lotTool.rows.filter(x=>x.excluded).length}});}

  /* 1. Chaque lot dans son propre export. */
  const courant=lots.map(l=>{const s=U.summarize({...U.fromJournal(l.journal),details:true}),lot=s.lots.find(x=>x.id===l.batchId);
    const panel=lot?lot.cuts:[],tc=counts(l.tool.rows),pc=lot?lot.counts:counts([]);
    return {nom:l.nom,part:l.part,batchId:l.batchId,etat:l.state,inputs:l.inputs,outil:tc,resume:pc,ecarts:ecarts(tc,pc),
      differencesParCoupe:diff(l.tool.rows,panel),lotComplet:lot?.complete??null,resumeComplet:s.historyComplete,source:s.scope?.source??null};});

  /* 2. Chaque lot relu, comme lot passé, dans les exports plus tardifs qui le contiennent. */
  const passe=[];
  for(const l of lots)for(const later of lots){if(later===l||!(later.startedAt>l.startedAt))continue;
    const ev=later.journal.events;if(!ev.some(e=>e.type==='batch-started'&&e.batch?.id===l.batchId))continue;
    /* ESV montre la dernière page de ce lot : identité la plus récente que le
     * lot lui-même a consignée (ses résultats, son état, son rattachement). */
    const fin=ev.filter(e=>e.type==='batch-started'&&e.batch?.startedAt>l.startedAt).map(e=>e.batch.startedAt).sort()[0]??'9';
    const fenetre=ev.filter(e=>e.identity?.part===l.part&&e.identity.pageId&&e.timestamp>=l.startedAt&&e.timestamp<fin).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
    const vu=fenetre.filter(e=>e.batchId===l.batchId||['batch-state','batch-rebased-after-reload'].includes(e.type)).at(-1)?.identity;
    const s=U.summarize({...U.fromJournal(later.journal),batch:null,identity:vu,details:true}),lot=s.lots.find(x=>x.id===l.batchId);
    /* Si ESV a été rechargée ensuite sans reprise du lot, la page affichée n'est
     * pas rapprochée : le lot n'y est pas compté, et le résumé le dit. */
    const derniere=fenetre.at(-1)?.identity,autre=derniere&&derniere.pageId!==vu?.pageId?U.summarize({...U.fromJournal(later.journal),batch:null,identity:derniere}):null;
    passe.push({lot:l.nom,relu_dans:later.nom,pageDuLot:vu?.pageId??null,
      outil:counts(l.tool.rows),resume:lot?lot.counts:null,ecarts:lot?ecarts(counts(l.tool.rows),lot.counts):null,
      differencesParCoupe:diff(l.tool.rows,lot?lot.cuts:[]),lotComplet:lot?.complete??null,lotsDeLaPartie:s.lots.length,
      pageRechargee:autre?{page:derniere.pageId,lotsComptes:autre.lots.length,autresLotsSignales:autre.otherPageLots,complet:autre.historyComplete}:null});
    if(autre&&(autre.historyComplete||autre.otherPageLots<1))throw Error(l.nom+' : page rechargée non signalée');}

  /* 3. Cumul par partie, dans le dernier export de chaque partie. */
  const cumul=[];
  for(const part of [...new Set(lots.map(l=>l.part))]){
    const mine=lots.filter(l=>l.part===part).sort((a,b)=>a.startedAt.localeCompare(b.startedAt)),last=mine.at(-1);
    const union=new Map();for(const l of mine)for(const r of l.tool.rows)union.set(r.cut,r);
    const toolRows=[...union.values()],s=U.summarize({...U.fromJournal(last.journal),details:true});
    const lotsVus=s.lots.map(x=>x.id),attendus=mine.map(l=>l.batchId);
    const intersection=mine.length>1?mine[0].tool.rows.filter(r=>mine.slice(1).some(m=>m.tool.rows.some(x=>x.cut===r.cut))).length:0;
    cumul.push({part,export:last.nom,lotsOutil:attendus,lotsResume:lotsVus,sommeDesLots:mine.reduce((n,l)=>n+l.tool.rows.length,0),
      coupesEnCommun:intersection,outil:counts(toolRows),resume:s.counts,ecarts:ecarts(counts(toolRows),s.counts),
      differencesParCoupe:diff(toolRows,s.cuts||[]),differesRestants:s.deferredCuts,complet:s.historyComplete});}

  const zero=x=>x.differencesParCoupe.length===0&&(!x.ecarts||Object.values(x.ecarts).every(v=>v===0));
  const proof={format:'ariane-u1-49-reference-v2',node:process.version,commande:'node tests/u1-49-reference.cjs RACINE SORTIE.json',
    outil:'tools/analyse-locale.cjs:analyserLot (non modifié) → tools/acceptance-report.cjs, lignes par coupe',
    correspondance:'applied→posée ; deferred→différé moteur ; gauge-rejected→différé écartement ; no-input « différé-sans-point-lidar »→différé sans points ; autres→inconnue',
    toutAZero:[...courant,...passe,...cumul].every(zero),courant,passe,cumul};
  fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');
  const ligne=c=>`${c.distinct} coupes · ${c.posed} posées · ${c.deferred} différées (${c.engineDeferred} moteur, ${c.gaugeRejected} écartement, ${c.noInput} sans points) · ${c.unknown} inconnues`;
  for(const x of courant)console.log(`[lot]   ${x.nom} : outil ${ligne(x.outil)} | résumé ${ligne(x.resume)} | écarts coupe à coupe ${x.differencesParCoupe.length}`);
  for(const x of passe)console.log(`[passé] ${x.lot} relu dans ${x.relu_dans} : résumé ${x.resume?ligne(x.resume):'ABSENT'} | écarts coupe à coupe ${x.differencesParCoupe.length}`);
  for(const x of cumul)console.log(`[cumul] partie ${x.part} (${x.lotsResume.length} lots) : outil ${ligne(x.outil)} | résumé ${ligne(x.resume)} | écarts ${x.differencesParCoupe.length}`);
  console.log(proof.toutAZero?'Zéro différence.':'DIFFÉRENCES : voir '+out);
  if(!proof.toutAZero)process.exitCode=1;
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
