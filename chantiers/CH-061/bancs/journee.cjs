/* CH-061 : parts mesurées d'une journée réelle (journal de lot du 05/11, banane-data), sans identifiant ni coordonnée en sortie.
 * - lot : temps par cut (open → accepted, phase-timing-pli), capture, analyse, façade de géométrie ;
 * - lecture des points : écart pageMs entre `capture-read` et l'étape suivante, par mode de lecture ;
 * - relecture : durées par étape de `relecture-ombre` si présentes. Résultat : resultats/journee-2026-11-05.json. */
'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');const {zips}=require('./nuages.cjs');
const z=zips().find(f=>/2026-11-05.*volume01-sur09/.test(f));const nom=execFileSync('unzip',['-Z1',z],{encoding:'utf8'}).split('\n').find(n=>/journal-v4-.*\.json$/.test(n));
const j=JSON.parse(execFileSync('unzip',['-p',z,nom],{maxBuffer:1<<30}));const ev=j.events;
const s=a=>a.reduce((x,y)=>x+y,0),q=(a,p)=>{a=[...a].sort((x,y)=>x-y);return a.length?+a[Math.floor(p*(a.length-1))].toFixed(1):null;};
const P=ev.filter(e=>e.type==='phase-timing-pli'&&e.r?.j?.accepted<30000);
const span=k=>P.map(e=>e.r.s[k]?.[1]||0);
const lot={cuts:P.length,cutMs:{mediane:q(P.map(e=>e.r.j.accepted),.5),total:Math.round(s(P.map(e=>e.r.j.accepted)))},
  captureMs:{mediane:q(span('command:capture'),.5),total:Math.round(s(span('command:capture')))},
  analyseMs:{mediane:q(span('analysis-envelope'),.5),total:Math.round(s(span('analysis-envelope')))},
  facadeGeometrieMs:{mediane:q(span('facade-total'),.5),total:Math.round(s(span('facade-total')))},
  sciencePubliqueMs:{total:Math.round(s(span('science-public-total')))}};
const by={};for(const e of ev)if((e.type==='adapter-progress'||e.type==='adapter-result')&&e.action==='capture')(by[e.requestId]??=[]).push(e);
const lect={};
for(const a of Object.values(by)){a.sort((x,y)=>x.elapsedMs-y.elapsedMs);
  for(let i=0;i<a.length;i++)if(a[i].lastStage==='capture-read'){const nx=a.slice(i+1).find(e=>e.lastStage!=='capture-read');if(!nx||nx.lastDetail?.pageMs==null)continue;
    const d=a[i].lastDetail;(lect[d.lecture]??=[]).push({ms:nx.lastDetail.pageMs-d.pageMs,pts:d.diag?.pts||null,mem:d.diag?.memMo||null});}}
const lecture=Object.fromEntries(Object.entries(lect).map(([k,v])=>[k,{vues:v.length,msParVue:{mediane:q(v.map(x=>x.ms),.5),p90:q(v.map(x=>x.ms),.9)},totalMs:Math.round(s(v.map(x=>x.ms))),
  pointsVisiblesParVue:{mediane:q(v.filter(x=>x.pts).map(x=>x.pts),.5)},tasPageEsvMo:{mediane:q(v.filter(x=>x.mem).map(x=>x.mem),.5),max:q(v.filter(x=>x.mem).map(x=>x.mem),1)}}]));
const R=ev.filter(e=>e.type==='relecture-ombre');const cles={};for(const e of R)for(const [k,v] of Object.entries(e.durees||{}))if(typeof v==='number')(cles[k]??=[]).push(v);
const relecture={cuts:R.length,dureesMs:Object.fromEntries(Object.entries(cles).map(([k,v])=>[k,{mediane:q(v,.5),total:Math.round(s(v))}]))};
const out={source:'journal de lot du 05/11 (banane-data), 1 volume',lot,lecture,relecture};
console.log(JSON.stringify(out,null,1));fs.writeFileSync(path.join(__dirname,'../resultats/journee-2026-11-05.json'),JSON.stringify(out,null,1));
