#!/usr/bin/env node
'use strict';
/*
 * rejeu-audit-serveur.cjs — H15 (audit P-5, fiches/FIABILITE_LOT.md) : rejoue les observations de liste d'un journal d'Orbite dans le VRAI code
 * du service worker (`relevesObservation`, puis `auditLecture`), et compare les audits produits à ceux du journal.
 *
 *   node tools/rejeu-audit-serveur.cjs JOURNAL [--racine DEPOT] [--json SORTIE.json]
 *
 * `--racine` : rejouer avec le service worker d'un autre dépôt (une copie de la base, par exemple) ; par défaut, celui-ci.
 * Reconstitution : l'état du lot à chaque observation vient du journal (`batch-started`, `batch-state`, `batch-stopped-at-end`) ; les
 * validations d'Ariane (`validation-accepted`) sont mises dans le stockage ; un silence de plus de 4 s (heure de réception) termine une lecture,
 * comme sur le terrain. La mémoire des lectures part vide.
 * Vérité de comparaison : la partie de chaque liste et son nombre de lignes, lus au départ de chaque lot (résumé d'avant séance posté pendant que
 * le lot tourne). Un audit est COHÉRENT si sa partie est nulle ou celle de la liste, et si ses deux lectures couvrent la liste entière
 * (validés + invalides = nombre de lignes de la liste).
 * Lecture seule : aucune commande, rien n'est écrit hors de --json. Les clés de liste ne sont jamais imprimées (étiquettes liste-A, liste-B…).
 */
const path=require('node:path'),fs=require('node:fs');
const arg=(n,d=null)=>{const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:d;};
const dormir=ms=>new Promise(r=>setTimeout(r,ms));

async function rejouer(journal,{racine=path.join(__dirname,'..')}={}){
  const {production,memoire}=require(path.join(path.resolve(racine),'tests/helpers/perf-production.cjs'));
  const j=JSON.parse(fs.readFileSync(journal,'utf8')),ev=(j.events||[]).slice().sort((x,y)=>String(x.timestamp).localeCompare(String(y.timestamp)));
  const etiquettes=new Map(),E=k=>{if(k==null)return k;if(!etiquettes.has(k))etiquettes.set(k,'liste-'+String.fromCharCode(65+etiquettes.size%26)+(etiquettes.size>=26?etiquettes.size:''));return etiquettes.get(k);};
  const lots=new Map(),L=id=>{if(id==null)return null;if(!lots.has(id))lots.set(id,'L'+(lots.size+1));return lots.get(id);};
  const local=memoire(),b=production({local});await b.api('view');
  b.ctx.BananeSettings={...b.ctx.BananeSettings,releves:{...b.ctx.BananeSettings.releves,auditSilenceMs:30}};
  const engine=b.get('engine'),releves=b.get('relevesObservation');
  for(const e of ev)if(e.type==='validation-accepted')await b.store.putEvent({eventId:'v-'+e.eventId,timestamp:e.timestamp,type:'validation-accepted',identity:{part:e.identity?.part??null,cut:e.identity?.cut??null}});
  const verite=new Map(),obs=[];let lot=null;
  for(const e of ev){
    if(e.type==='batch-started'&&e.batch?.id){lot={id:e.batch.id,state:'RUNNING',startedAt:e.timestamp,scope:{...e.batch.scope}};L(lot.id);}
    else if(e.type==='batch-state'&&lot&&typeof e.state==='string')lot.state=e.state;
    else if(e.type==='batch-stopped-at-end'&&lot)lot.stoppedAtEnd={at:e.timestamp,cut:e.lastCut??null};
    if(e.type!=='esv-observation'||!['list-page','list-summary'].includes(e.kind))continue;
    if(e.kind==='list-summary'&&e.beforeSession===true&&e.rows>=2&&lot?.state==='RUNNING')verite.set(e.listKey,{partie:lot.scope.part,lignes:e.rows});
    obs.push({e,lot:lot?JSON.parse(JSON.stringify(lot)):null});}
  let dernier=null;
  for(const {e,lot:l} of obs){const t=Date.parse(e.timestamp);if(dernier!==null&&t-dernier>4000)await dormir(120);dernier=t;
    engine.s.batch=l;const f={...e};for(const k of ['eventId','timestamp','type','schema','observer','receivedMs','timeOrigin','sessionId','batchId'])delete f[k];
    releves(f,e.observer?.id??'?');}
  await dormir(300);
  const vue=x=>{const v=verite.get(x.listKey)||{};return {jusqua:x.jusqua,liste:E(x.listKey),lot:L(x.batchId),partie:x.partie,source:x.partieSource,partieDeLaListe:v.partie??null,lignesDeLaListe:v.lignes??null,
    pages:x.pages,validesAvant:x.validesAvant,validesApres:x.validesApres,lignesAvant:x.validesAvant+x.invalidesAvant,lignesApres:x.validesApres+x.invalidesApres,
    constates:x.constates,attendus:x.attendus,ecart:x.ecart,avantSeance:x.avantSeance};};
  const verdict=x=>({...x,coherent:(x.partie===null||x.partie===x.partieDeLaListe)&&x.lignesDeLaListe!==null&&x.lignesAvant===x.lignesDeLaListe&&x.lignesApres===x.lignesDeLaListe});
  const duJournal=ev.filter(x=>x.type==='audit-serveur').map(vue).map(verdict),rejoues=b.store.events.filter(x=>x.type==='audit-serveur').map(vue).map(verdict);
  return {racine:path.resolve(racine),version:JSON.parse(fs.readFileSync(path.join(racine,'manifest.json'),'utf8')).version,
    listes:Object.fromEntries([...verite].map(([k,v])=>[E(k),v])),auditsDuJournal:duJournal,auditsRejoues:rejoues,
    incoherents:{journal:duJournal.filter(x=>!x.coherent).length,rejoues:rejoues.filter(x=>!x.coherent).length}};
}
module.exports={rejouer};
if(require.main===module){const journal=process.argv[2];
  if(!journal||journal.startsWith('--')||!fs.existsSync(journal)){console.error('Usage : node tools/rejeu-audit-serveur.cjs JOURNAL [--racine DEPOT] [--json SORTIE.json]');process.exit(1);}
  rejouer(journal,{racine:arg('--racine')||path.join(__dirname,'..')}).then(r=>{const s=JSON.stringify(r,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);},
    e=>{console.error(e.stack||e.message);process.exitCode=1;});}
