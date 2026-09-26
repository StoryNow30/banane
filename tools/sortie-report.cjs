#!/usr/bin/env node
'use strict';
/*
 * sortie-report.cjs — brouillon du rapport de sortie de la 4.8 (cahier §14 G :
 * C1 à C5 rapportés ensemble, jamais C1 seul ; §15 : P2 accompagne tout
 * chiffre d'erreur).
 *
 *   node tools/sortie-report.cjs audit/sortie-4.8-lots.json audit/rapport-sortie-4.8.md
 *
 * Entrée : la liste des lots, chacun avec son rapport d'acceptation
 * (`tools/acceptance-report.cjs --json`), son rôle — « validation » (partie
 * jamais utilisée pour régler), « réglage », « couverture » (sans relecture) —
 * et sa relecture (complète, ciblée, aucune). Rien n'est recalculé ici : le
 * rapport reprend les chiffres des rapports d'acceptation et dit, critère par
 * critère, ce qui est tenu, ce qui ne l'est pas et ce qui n'est pas mesurable.
 */
const fs=require('node:fs'),path=require('node:path');
const pct=v=>Number.isFinite(v)?String(Math.round(v*10)/10).replace('.',','):'—';
const mm=v=>Number.isFinite(v)?String(Math.round(v*10)/10).replace('.',',')+' mm':'—';
const FINI=['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS'];

function lotRow(entry,report){
  const lot=report.lots[0],t=report.total;
  return {label:lot.label,partie:lot.batch?.part??null,version:lot.version??null,role:entry.role,relecture:entry.relecture,note:entry.note||'',
    etat:lot.batch?.state??null,complet:typeof lot.complete==='boolean'?lot.complete:FINI.includes(lot.batch?.state),
    c1:{appliques:t.c1.applied,cuts:t.c1.distinctCuts,pct:t.c1.coveragePct},
    c4:{faux:t.c4.wrong,juges:t.c4.judgedApplied,evaluable:!!t.c4.evaluable,partJugee:t.c4.judgedSharePct??null,
      nommes:(t.c4.wrongCuts||[]).map(w=>({cut:w.cut,pireMm:w.worstMm}))},
    c3:{refuses:(t.c3.refused||[]).length,horsContratAppliques:(t.c3.appliedOutOfContract||[]).length},
    c2:t.c2?{rails:t.c2.rails,lateralP90:t.c2.lateralMm?.p90??null,verticalP90:t.c2.verticalMm?.p90??null,plancher:t.c2.floor?.label??null}:null};
}
function summarize(manifest,load){
  const rows=manifest.lots.map(e=>lotRow(e,load(e.fichier)));
  const val=rows.filter(r=>r.role==='validation'),valRelus=val.filter(r=>r.relecture!=='aucune');
  const complets=val.filter(r=>r.complet);
  const horsContrat=rows.reduce((n,r)=>n+r.c3.horsContratAppliques,0);
  const faux=valRelus.flatMap(r=>r.c4.nommes.map(w=>({...w,lot:r.label})));
  const criteres={
    C1:complets.length?{statut:complets.every(r=>r.c1.pct>=80)?'tenu':'non tenu',detail:complets.map(r=>`${r.label} : ${pct(r.c1.pct)} %`).join(' ; ')}
      :{statut:'non démontré',detail:val.length?`aucun lot de validation complet ; lots arrêtés : ${val.map(r=>`${r.label} ${pct(r.c1.pct)} %`).join(' ; ')}`
        :'aucun lot de validation : les parties relues ont servi au réglage'},
    C2:{statut:manifest.p2?'mesurable':'non publiable',detail:manifest.p2?'plancher P2 fourni':'P2 non mesuré : aucune cible d\'erreur publiée (§15)'},
    C3:{statut:horsContrat?'non tenu':'tenu',detail:`sur tous les lots : ${horsContrat} paire(s) hors contrat appliquée(s), ${rows.reduce((n,r)=>n+r.c3.refuses,0)} refus d'écartement`},
    C4:{statut:!valRelus.length?'non mesuré':manifest.seuilC4?(faux.length<=manifest.seuilC4.maxFaux?'tenu':'non tenu'):'seuil à trancher',
      detail:!valRelus.length?'aucun lot de validation relu'
        :`${faux.length} faux sur ${valRelus.reduce((n,r)=>n+r.c4.juges,0)} cuts jugés des lots de validation relus`+(faux.length?' : '+faux.map(w=>`${w.cut} (${mm(w.pireMm)}, ${w.lot})`).join(', '):'')},
    C5:{statut:manifest.bilans?.length?'bilans tenus':'sans bilan',detail:(manifest.bilans||[]).join(' ; ')},
  };
  return {format:'banane-sortie-4.8-v1',regle:manifest.regle||null,rows,criteres,conditions:manifest.conditions||[]};
}
function toMarkdown(s,{date}={}){
  const L=['# Rapport de sortie 4.8 — brouillon','',`**${date||'Date non fournie'}.** Produit par \`tools/sortie-report.cjs\` à partir des rapports d'acceptation : aucun chiffre n'est recalculé ici. C1 à C5 sont rapportés ensemble ; C1 seul n'est pas un résultat (§14 G).`,'',
    ...(s.regle?[s.regle,'']:[]),'## Lots','','| Lot | Partie | Version | Rôle | Relecture | État | C1 | C4 faux / jugés | C3 hors contrat appliqués |','|---|---|---|---|---|---|---|---|---|'];
  for(const r of s.rows)L.push(`| ${r.label}${r.note?' — '+r.note:''} | ${r.partie??'—'} | ${r.version??'—'} | ${r.role} | ${r.relecture} | ${r.etat??'—'}${r.complet?' (complet)':''} | ${r.c1.appliques}/${r.c1.cuts} (${pct(r.c1.pct)} %) | ${r.relecture==='aucune'?'non jugé':`${r.c4.faux}/${r.c4.juges}${r.c4.evaluable?'':' (non évaluable)'}`} | ${r.c3.horsContratAppliques} |`);
  L.push('','## Critères','','| Critère | Statut | Détail |','|---|---|---|');
  for(const [k,c] of Object.entries(s.criteres))L.push(`| ${k} | **${c.statut}** | ${c.detail} |`);
  if(s.conditions.length){L.push('','## Ce qui manque pour la version candidate','');for(const c of s.conditions)L.push('- '+c);}
  return L.join('\n')+'\n';
}
function run(argv=process.argv.slice(2)){
  const [manifestFile,out]=argv;if(!manifestFile)throw Error('Usage : MANIFESTE.json [SORTIE.md]');
  const base=path.resolve(path.dirname(manifestFile),'..'),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  const s=summarize(manifest,f=>JSON.parse(fs.readFileSync(path.resolve(base,f),'utf8')));
  const md=toMarkdown(s,{date:manifest.date});if(out)fs.writeFileSync(out,md);else process.stdout.write(md);
  for(const [k,c] of Object.entries(s.criteres))console.error(`${k} : ${c.statut}`);
  return s;
}
if(require.main===module)try{run();}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={lotRow,summarize,toMarkdown,run};
