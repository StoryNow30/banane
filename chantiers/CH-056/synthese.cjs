#!/usr/bin/env node
'use strict';
/* CH-056 — synthèse du coût et du bénéfice de la garde « après un différé », à partir des détails de `tools/rejeu-voie-predite.cjs --detail`
 * (une sortie par partie : témoin = lot sans la garde, variantes `garde-*` = lot avec la garde dans la boucle).
 * Pour chaque variante, contre le témoin, cut par cut : RETENUS = posés par le témoin, non posés par la variante (la garde, ou la chaîne
 * d'appuis qu'elle casse) ; parmi eux, la pose évitée jugée contre l'Écho : juste ≤ 10 mm, fausse > 10 mm, > 50 mm. Totaux de la variante :
 * différés (à reprendre par l'opérateur), posés jugés, posés > 50 mm, borne de Wilson à 95 %. Aucune coordonnée : numéros de cut et mm.
 * Usage : node chantiers/CH-056/synthese.cjs P=detail.json [P=detail.json ...] [--json sortie.json] [--variantes id,id] */
const fs=require('node:fs');
function wilson(k,n,z=1.96){if(!n)return [0,1];const p=k/n,d=1+z*z/n,c=p+z*z/(2*n),m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return [Math.max(0,(c-m)/d),Math.min(1,(c+m)/d)];}
const pc=v=>Math.round(v*1000)/10;
function synthese(parties,{variantes=null}={}){
  const ids=new Set();for(const d of Object.values(parties))for(const k of Object.keys(d))if(k!=='temoin'&&(!variantes||variantes.includes(k)))ids.add(k);
  const out={};
  for(const id of ['temoin',...ids]){
    const t={retenus:0,retenusJuges:0,retenusJustes:0,retenusFaux:0,retenus50:0,retenusCuts:[],gagnes:0,differes:0,poses:0,posesJuges:0,poses50:0,posesFaux:0,posesJustes:0,parPartie:{}};
    for(const [p,d] of Object.entries(parties)){
      const T=new Map((d.temoin||[]).map(r=>[r.cut,r])),rows=d[id];if(!rows)continue;
      let ret=0;
      for(const r of rows){
        if(r.posee){t.poses++;if(r.pire!=null){t.posesJuges++;if(r.pire>50)t.poses50++;if(r.pire>10)t.posesFaux++;else t.posesJustes++;}}else t.differes++;
        const a=T.get(r.cut);if(!a||id==='temoin')continue;
        if(a.posee&&!r.posee){t.retenus++;ret++;
          if(a.pire!=null){t.retenusJuges++;if(a.pire<=10)t.retenusJustes++;else t.retenusFaux++;if(a.pire>50)t.retenus50++;}
          t.retenusCuts.push(`${p}/${r.cut}${r.garde?'':'*'}:${a.pire??'nj'}`);}
        else if(!a.posee&&r.posee)t.gagnes++;
      }
      t.parPartie[p]={retenus:ret,differes:rows.filter(r=>!r.posee).length};
    }
    t.borne50=pc(wilson(t.poses50,t.posesJuges)[1]);t.retenusJustesIC=t.retenusJuges?wilson(t.retenusJustes,t.retenusJuges).map(pc):null;
    out[id]=t;
  }
  return out;
}
function main(argv=process.argv.slice(2)){
  const parties={};let json=null,variantes=null;
  for(let i=0;i<argv.length;i++){const a=argv[i];if(a==='--json')json=argv[++i];else if(a==='--variantes')variantes=argv[++i].split(',');
    else{const [p,f]=a.split('=');parties[p]=JSON.parse(fs.readFileSync(f,'utf8'));}}
  const s=synthese(parties,{variantes});
  console.log('| variante | retenus | jugés | justes ≤10 | faux >10 | >50 | différés | posés jugés | posés >50 | borne Wilson >50 |');
  console.log('|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|');
  for(const [id,t] of Object.entries(s))console.log(`| ${id} | ${t.retenus} | ${t.retenusJuges} | ${t.retenusJustes} | ${t.retenusFaux} | ${t.retenus50} | ${t.differes} | ${t.posesJuges} | ${t.poses50} | ${t.borne50} % |`);
  if(json)fs.writeFileSync(json,JSON.stringify(s,null,1)+'\n');
}
if(require.main===module)main();
module.exports={synthese,wilson};
