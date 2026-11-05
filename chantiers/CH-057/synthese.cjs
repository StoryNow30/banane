#!/usr/bin/env node
'use strict';
/* CH-057 — synthèse et VALIDATION CROISÉE PAR PARTIE des variantes rejouées par chantiers/CH-057/rejeu.cjs (fichiers `--detail`, un par partie),
 * sur les 9 parties d'apprentissage (11:10, 11:13, 11:14, 11:15, 12:8 à 12:12). Reprise de chantiers/CH-053/M-synthese.cjs, avec des clés
 * « projet:partie » (la partie 10 existe dans les deux projets). Lecture seule ; agrégats : comptes, millimètres, numéros de cut, aucune coordonnée.
 *
 *   node chantiers/CH-057/synthese.cjs --detail 11:10=D.json … [--grosses 11:10=JEU.jsonl …] [--json S.json]
 *
 * A. Différés rendus posables (seconde chance) : cuts de classe « differee » (différés par le lot réel) avec une pose humaine. Périmètres :
 *    « grosses » (correction > 10 mm, jeux gcv2-jeu, comme CH-051 et CH-053-M) et « tous ». Par variante : posés, justes (≤ 10 mm, pire des deux
 *    rails en 3D), faux (> 10 mm), > 50 mm. VALIDATION CROISÉE : pour chaque partie jugée, la variante est choisie sur les 8 autres parmi les
 *    candidates (le plus de justes sans aucune pose > 50 mm ; à égalité, le moins de faux, puis la plus proche du réglage livré), puis appliquée
 *    à la partie jugée. Comparaison au réglage livré (`b1-ecart-serie` : fenêtre 30 mm, choix 15 mm, src/settings.js `voieB1EcartOmbre`).
 * B. Lot entier, par variante : cuts posés, posés jugés, justes, > 50 mm (budget D-223, borne de Wilson), différés laissés à l'opérateur.
 * Intervalles de Wilson à 95 %. */
const fs=require('node:fs');
const arg=n=>{const a=process.argv.slice(2),o=[];for(let i=0;i<a.length;i++)if(a[i]===n)o.push(a[++i]);return o;};
const wilson=(k,n,z=1.959964)=>{if(!n)return [null,null];const p=k/n,d=1+z*z/n,c=p+z*z/(2*n),r=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return [Math.max(0,(c-r)/d),Math.min(1,(c+r)/d)];};
const r1=v=>Math.round(v*1000)/10;
const pc=(k,n)=>n?`${(100*k/n).toFixed(1).replace('.',',')} % (${k}/${n})`:'—';
const pcw=(k,n)=>{if(!n)return '—';const [a,b]=wilson(k,n);return `${pc(k,n)} [${(100*a).toFixed(0)} ; ${(100*b).toFixed(0)}]`;};
/* Comparaison lexicographique de deux clés (nombres puis texte) : négatif si a passe avant b. */
const lex=(a,b)=>{for(let i=0;i<a.length;i++){if(a[i]===b[i])continue;return a[i]<b[i]?-1:1;}return 0;};
const coupe=s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];};

/* Candidates de la seconde chance (sans garde, sans plafond) ; ordre = préférence à égalité (le réglage livré d'abord). */
const LIVREE='b1-ecart-serie';
const estCandidate=v=>v===LIVREE||/^b1-ecart-serie-f\d+-c\d+$/.test(v)||['b1-serie','ecart-serie','temoin'].includes(v);
const rang=v=>v===LIVREE?0:v.startsWith('b1-ecart-serie-f')?1:v==='temoin'?3:2;

function charger(){
  const details={},grosses=new Set();
  for(const d of arg('--detail')){const [p,f]=coupe(d);details[p]=JSON.parse(fs.readFileSync(f,'utf8'));}
  for(const g of arg('--grosses')){const [p,f]=coupe(g);
    for(const l of fs.readFileSync(f,'utf8').split('\n')){if(!l.trim())continue;const o=JSON.parse(l);
      if(o.type==='cut'&&o.role==='differe'&&o.etat==='calcule'&&o.etiquette?.mic?.left&&o.etiquette.mic.right&&o.etiquette.micMaxMm>10)grosses.add(p+'/'+o.cut);}}
  return {details,grosses};
}
function compter(rows){
  const o={n:0,poses:0,justes:0,faux:0,plus50:0,nonJuges:0,sources:{},fautes:[]};
  for(const r of rows){if(!r.posee)continue;o.poses++;if(r.pire==null){o.nonJuges++;continue;}
    o.sources[r.source]=(o.sources[r.source]||0)+1;
    if(r.pire<=10)o.justes++;else{o.faux++;if(r.pire>50)o.plus50++;o.fautes.push({cut:r.cut,source:r.source,pireMm:r.pire});}}
  return o;
}
function synthese({details,grosses}){
  const parties=Object.keys(details).sort(),variantes=[...new Set(parties.flatMap(p=>Object.keys(details[p])))];
  const lignes=(p,v,perim)=>(details[p][v]||[]).filter(r=>r.classe==='differee'&&(perim!=='grosses'||grosses.has(p+'/'+r.cut)));
  const jugeables=(p,perim)=>{const s=new Set();for(const v of variantes)for(const r of lignes(p,v,perim))if(r.pire!=null||grosses.has(p+'/'+r.cut))s.add(r.cut);return s;};
  const out={format:'ch057-synthese-v1',parties,variantes,perimetres:{},lot:{}};
  for(const perim of ['grosses','tous']){
    if(perim==='grosses'&&!grosses.size)continue;
    const P={parPartie:{},total:{}},jug=Object.fromEntries(parties.map(p=>[p,jugeables(p,perim)]));
    for(const v of variantes){P.parPartie[v]={};const t={n:0,poses:0,justes:0,faux:0,plus50:0,nonJuges:0,sources:{},fautes:[]};
      for(const p of parties){const c=compter(lignes(p,v,perim).filter(r=>jug[p].has(r.cut)));c.n=jug[p].size;P.parPartie[v][p]=c;
        for(const k of ['n','poses','justes','faux','plus50','nonJuges'])t[k]+=c[k];
        for(const [s,k] of Object.entries(c.sources))t.sources[s]=(t.sources[s]||0)+k;t.fautes.push(...c.fautes.map(f=>({partie:p,...f})));}
      t.justesIC=wilson(t.justes,t.n).map(x=>x==null?null:r1(x));t.plus50IC=wilson(t.plus50,t.poses).map(x=>x==null?null:r1(x));P.total[v]=t;}
    let att=0,n=0;const attP={};
    for(const p of parties){let a=0;for(const cut of jug[p]){n++;if(variantes.some(v=>v!=='plafond-serie'&&!/garde/.test(v)&&lignes(p,v,perim).some(r=>r.cut===cut&&r.posee&&r.pire!=null&&r.pire<=10))){att++;a++;}}attP[p]={k:a,n:jug[p].size};}
    P.atteignableApres={k:att,n,ic:wilson(att,n).map(x=>x==null?null:r1(x)),parPartie:attP};
    const cand=variantes.filter(estCandidate),score=(v,ps)=>ps.reduce((s,p)=>{const c=P.parPartie[v][p];return {j:s.j+c.justes,f:s.f+c.faux,p50:s.p50+c.plus50};},{j:0,f:0,p50:0});
    const vc={parPartie:{},total:{n:0,poses:0,justes:0,faux:0,plus50:0,fautes:[]}};
    for(const p of parties){
      const autres=parties.filter(q=>q!==p);let best=null;
      for(const v of cand){const s=score(v,autres),cle=[s.p50>0?1:0,-s.j,s.f,rang(v),v];
        if(!best||lex(cle,best.cle)<0)best={v,cle,s};}
      const c=P.parPartie[best.v][p];vc.parPartie[p]={choisie:best.v,surLesAutres:best.s,...c};
      for(const k of ['n','poses','justes','faux','plus50'])vc.total[k]+=c[k];vc.total.fautes.push(...c.fautes.map(f=>({partie:p,variante:best.v,...f})));}
    vc.total.justesIC=wilson(vc.total.justes,vc.total.n).map(x=>x==null?null:r1(x));vc.total.plus50IC=wilson(vc.total.plus50,vc.total.poses).map(x=>x==null?null:r1(x));
    P.validationCroisee=vc;out.perimetres[perim]=P;
  }
  /* B. Lot entier. */
  for(const v of variantes){const t={cuts:0,poses:0,posesJuges:0,justes:0,plus10:0,plus50:0,differes:0,fautes50:[]};
    for(const p of parties)for(const r of details[p][v]||[]){t.cuts++;if(!r.posee){t.differes++;continue;}t.poses++;
      if(r.pire!=null){t.posesJuges++;if(r.pire<=10)t.justes++;else t.plus10++;if(r.pire>50)t.fautes50.push(`${p}/${r.cut}:${r.pire}`);}}
    t.plus50=t.fautes50.length;t.plus50IC=wilson(t.plus50,t.posesJuges).map(x=>x==null?null:r1(x));out.lot[v]=t;}
  return out;
}
function texte(out){
  const L=[],parties=out.parties;
  for(const [perim,P] of Object.entries(out.perimetres)){
    L.push(`\n## A. Différés du lot réel, périmètre « ${perim} » (${perim==='grosses'?'correction > 10 mm':'tous les différés jugés avec nuage'})`,'',
      '| variante | n | posés | justes ≤ 10 mm [IC 95 %] | faux > 10 | > 50 mm |','|---|--:|--:|--:|--:|--:|');
    for(const v of out.variantes){const t=P.total[v];L.push(`| ${v} | ${t.n} | ${t.poses} | ${pcw(t.justes,t.n)} | ${t.faux} | ${t.plus50} |`);}
    const a=P.atteignableApres;L.push('',`Atteignable après (une source au moins, ni plafond ni garde, pose à 10 mm) : ${pcw(a.k,a.n)}.`);
    const vc=P.validationCroisee;
    L.push('',`Validation croisée (choisie sur les 8 autres) : posés ${vc.total.poses}/${vc.total.n}, justes ${pcw(vc.total.justes,vc.total.n)}, faux ${vc.total.faux}, > 50 mm ${pcw(vc.total.plus50,vc.total.poses)} des posés.`);
    for(const p of parties){const c=vc.parPartie[p];L.push(`  ${p} : « ${c.choisie} » (autres : ${c.surLesAutres.j} j, ${c.surLesAutres.f} f, ${c.surLesAutres.p50} > 50) → ${c.justes} j, ${c.faux} f, ${c.plus50} > 50 sur ${c.n}`);}
    if(vc.total.fautes.length)L.push('  fautes : '+vc.total.fautes.map(f=>`${f.partie}/${f.cut} ${f.source} ${f.pireMm} mm`).join(' ; '));
  }
  L.push('','## B. Lot entier (toutes classes)','','| variante | posés | posés jugés | justes ≤ 10 | > 10 | > 50 mm [IC haut] | différés |','|---|--:|--:|--:|--:|--:|--:|');
  for(const v of out.variantes){const t=out.lot[v];L.push(`| ${v} | ${t.poses} | ${t.posesJuges} | ${t.justes} | ${t.plus10} | ${t.plus50} [≤ ${t.plus50IC[1]} %] | ${t.differes} |`);}
  return L.join('\n');
}
module.exports={synthese,texte,wilson,estCandidate};
if(require.main===module){const o=synthese(charger());console.log(texte(o));const js=arg('--json')[0];if(js)fs.writeFileSync(js,JSON.stringify(o,null,1)+'\n');}
