#!/usr/bin/env node
'use strict';
/*
 * M-synthese.cjs — CH-053-M. Synthèse et VALIDATION CROISÉE PAR PARTIE des sources de voie rejouées par
 * tools/rejeu-voie-predite.cjs (fichiers `--detail`, un par partie). Lecture seule, agrégats seulement : comptes, millimètres,
 * numéros de cut ; aucune coordonnée.
 *
 *   node chantiers/CH-053/M-synthese.cjs --detail 10=D10.json --detail 13=D13.json … [--grosses JEU.jsonl …] [--json S.json]
 *
 * Périmètre : les cuts DIFFÉRÉS par le lot (classe « differee ») qui ont une pose humaine (jugés) et un nuage (une ligne de rejeu).
 * Avec `--grosses` (jeux gcv2-jeu), le périmètre est restreint aux corrections de plus de 10 mm (le même que le rappel de CH-051 :
 * 45 cuts), à côté du périmètre « tous les différés jugés ».
 *
 * Par variante et par partie : posés, justes (≤ 10 mm, pire des deux rails en 3D), faux (> 10 mm), à plus de 50 mm (budget D-223).
 * Validation croisée : pour chaque partie jugée, la variante est CHOISIE sur les trois autres (le plus de justes, à condition d'aucune
 * pose à plus de 50 mm ; à égalité, le moins de faux, puis la variante la plus simple), puis appliquée à la partie jugée ; les quatre
 * résultats hors échantillon sont sommés. Intervalle de Wilson à 95 % sur les parts.
 */
const fs=require('node:fs');
const arg=(n)=>{const a=process.argv.slice(2),o=[];for(let i=0;i<a.length;i++)if(a[i]===n)o.push(a[++i]);return o;};
const wilson=(k,n,z=1.959964)=>{if(!n)return [null,null];const p=k/n,d=1+z*z/n,c=p+z*z/(2*n),r=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return [(c-r)/d,(c+r)/d];};
const pc=(k,n)=>n?`${(100*k/n).toFixed(1).replace('.',',')} % (${k}/${n})`:'—';
const pcw=(k,n)=>{const [a,b]=wilson(k,n);return n?`${pc(k,n)} [${(100*a).toFixed(0)} ; ${(100*b).toFixed(0)}]`:'—';};

const details={},grosses=new Set();
for(const d of arg('--detail')){const [p,f]=d.split('=');details[p]=JSON.parse(fs.readFileSync(f,'utf8'));}
for(const f of arg('--grosses'))for(const l of fs.readFileSync(f,'utf8').split('\n')){if(!l.trim())continue;const o=JSON.parse(l);if(o.type==='cut'&&o.role==='differe'&&o.etat==='calcule'&&o.etiquette?.mic?.left&&o.etiquette.mic.right&&o.etiquette.micMaxMm>10)grosses.add(o.partie.split(':')[1]+'/'+o.cut);}
const parties=Object.keys(details).sort((a,b)=>a-b);
const variantes=[...new Set(parties.flatMap(p=>Object.keys(details[p])))];
/* Ordre de simplicité (pour départager) : rang dans cette liste. */
const SIMPLE=['temoin','prol10-serie','b1-reelle','b1-serie','ecart-g-serie','ecart-d-serie','ecart-serie','balayage-serie','ecart-balayage-serie','ecart-balayage-reelle','ecart-balayage-c30-serie','b1-ecart-serie','b1-ecart-balayage-serie','b1-prol10-ecart-balayage-serie','plafond-serie'];
const simple=v=>{const i=SIMPLE.indexOf(v);return i<0?99:i;};

/* Lignes jugées d'une variante et d'une partie : différés (classe differee) avec une pose humaine (la variante « plafond » pose grâce à elle :
 * jamais une règle, donnée pour l'échelle). Une ligne sans `pire` mais posée est « non jugée » : comptée à part. */
function lignes(p,v,perim){
  return (details[p][v]||[]).filter(r=>r.classe==='differee'&&(perim!=='grosses'||grosses.has(p+'/'+r.cut)));
}
function compter(rows){
  const o={n:rows.length,poses:0,justes:0,faux:0,plus50:0,nonJuges:0,sources:{},fautes:[]};
  for(const r of rows){
    if(!r.posee)continue;o.poses++;
    if(r.pire==null){o.nonJuges++;continue;}
    o.sources[r.source]=(o.sources[r.source]||0)+1;
    if(r.pire<=10)o.justes++;else{o.faux++;if(r.pire>50)o.plus50++;o.fautes.push({cut:r.cut,source:r.source,pireMm:r.pire});}
  }
  return o;
}
/* `n` vrai : les différés jugés de la partie dans le périmètre = ceux qui ont une référence (la variante plafond en pose certains : la table de
 * jointure est la même pour toutes les variantes ; on prend le nombre de lignes de classe differee dont au moins une variante a un `pire`, ou qui
 * sont dans `grosses`). */
function jugeables(p,perim){
  const cuts=new Set();
  for(const v of variantes)for(const r of lignes(p,v,perim))if(r.pire!=null||grosses.has(p+'/'+r.cut))cuts.add(r.cut);
  return cuts;
}
const out={format:'ch053m-synthese-v1',parties,variantes,perimetres:{}};
for(const perim of ['grosses','tous']){
  if(perim==='grosses'&&!grosses.size)continue;
  const P={parPartie:{},total:{},validationCroisee:{}};
  const jug={};for(const p of parties)jug[p]=jugeables(p,perim);
  for(const v of variantes){
    P.parPartie[v]={};const tot={n:0,poses:0,justes:0,faux:0,plus50:0,nonJuges:0,sources:{},fautes:[]};
    for(const p of parties){
      const c=compter(lignes(p,v,perim).filter(r=>jug[p].has(r.cut)));c.n=jug[p].size;
      P.parPartie[v][p]=c;
      for(const k of ['n','poses','justes','faux','plus50','nonJuges'])tot[k]+=c[k];
      for(const [s,k] of Object.entries(c.sources))tot.sources[s]=(tot.sources[s]||0)+k;
      tot.fautes.push(...c.fautes.map(f=>({partie:p,...f})));
    }
    P.total[v]=tot;
  }
  /* Rappel ATTEIGNABLE après : une source au moins (hors plafond) a posé le cut à 10 mm. */
  let att=0,n=0;const attParPartie={};
  for(const p of parties){let a=0;for(const cut of jug[p]){n++;if(variantes.some(v=>v!=='plafond-serie'&&lignes(p,v,perim).some(r=>r.cut===cut&&r.posee&&r.pire!=null&&r.pire<=10))){att++;a++;}}attParPartie[p]={k:a,n:jug[p].size};}
  P.atteignableApres={k:att,n,parPartie:attParPartie};
  /* Validation croisée par partie. */
  const candidates=variantes.filter(v=>v!=='plafond-serie');
  const score=(v,ps)=>{let j=0,f=0,p50=0;for(const p of ps){const c=P.parPartie[v][p];j+=c.justes;f+=c.faux;p50+=c.plus50;}return {j,f,p50};};
  const vc={parPartie:{},total:{n:0,poses:0,justes:0,faux:0,plus50:0,fautes:[]}};
  for(const p of parties){
    const autres=parties.filter(q=>q!==p);
    let best=null;
    for(const v of candidates){const s=score(v,autres);
      const cle=[s.p50>0?1:0,-s.j,s.f,simple(v)];
      if(!best||cle.some((x,i)=>x!==best.cle[i])&&cle.find((x,i)=>x!==best.cle[i])<best.cle[cle.findIndex((x,i)=>x!==best.cle[i])])best={v,cle,s};}
    const c=P.parPartie[best.v][p];
    vc.parPartie[p]={choisie:best.v,surLesAutres:best.s,...c};
    for(const k of ['n','poses','justes','faux','plus50'])vc.total[k]+=c[k];vc.total.fautes.push(...c.fautes.map(f=>({partie:p,variante:best.v,...f})));
  }
  P.validationCroisee=vc;
  out.perimetres[perim]=P;
}
/* ------------------------------------------------------------------ texte */
const L=[];
for(const [perim,P] of Object.entries(out.perimetres)){
  L.push(`\n## Périmètre : ${perim==='grosses'?'différés jugés avec correction > 10 mm (le rappel de CH-051)':'tous les différés jugés (avec nuage)'}`);
  L.push('','| variante | n | posés | justes ≤ 10 mm | faux > 10 | > 50 mm | par partie (justes/faux/>50 : '+parties.join(', ')+') |','|---|--:|--:|--:|--:|--:|---|');
  for(const v of variantes.sort((a,b)=>simple(a)-simple(b))){const t=P.total[v];
    L.push(`| ${v} | ${t.n} | ${t.poses} | ${t.justes} (${pc(t.justes,t.n)}) | ${t.faux} | ${t.plus50} | ${parties.map(p=>{const c=P.parPartie[v][p];return `${c.justes}/${c.faux}/${c.plus50} sur ${c.n}`;}).join(' ; ')} |`);}
  const a=P.atteignableApres;
  L.push('',`Rappel atteignable après (une source au moins pose à 10 mm, plafond exclu) : ${pcw(a.k,a.n)} ; par partie : ${parties.map(p=>`${p} : ${pc(a.parPartie[p].k,a.parPartie[p].n)}`).join(' ; ')}.`);
  const vc=P.validationCroisee;
  L.push('',`Validation croisée par partie (variante choisie sur les trois autres, appliquée à la quatrième) : posés ${vc.total.poses}/${vc.total.n}, justes ${pcw(vc.total.justes,vc.total.n)}, faux > 10 mm ${vc.total.faux}, > 50 mm ${pcw(vc.total.plus50,vc.total.poses)} des posés.`);
  for(const p of parties){const c=vc.parPartie[p];L.push(`  partie ${p} : choisie « ${c.choisie} » (sur les autres : ${c.surLesAutres.j} justes, ${c.surLesAutres.f} faux, ${c.surLesAutres.p50} > 50) → ${c.justes} justes, ${c.faux} faux, ${c.plus50} > 50 mm sur ${c.n}`);}
  if(vc.total.fautes.length)L.push('  fautes hors échantillon : '+vc.total.fautes.map(f=>`${f.partie}/${f.cut} ${f.source} ${f.pireMm} mm`).join(' ; '));
}
console.log(L.join('\n'));
const js=arg('--json')[0];if(js)fs.writeFileSync(js,JSON.stringify(out,null,1));
