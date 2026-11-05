#!/usr/bin/env node
'use strict';
/* CH-057 — garde « après un différé », LECTURE A de CH-056 sur les 9 parties : les cuts que la garde a RÉELLEMENT différés (événements
 * `garde-apres-differe` du journal Orbite), leur zone (PN / ADV, ombre `regles-metier-ombre`) et la pose que le témoin (le lot sans la garde,
 * rejeu) leur aurait donnée, jugée contre l'Écho (pire des deux rails, mm). Lecture seule ; numéros de cut et mm seulement.
 *   node chantiers/CH-057/garde-reelle.cjs --journal J.json --partie 12:10 --detail D.json [--journal … --partie … --detail …] [--json S.json]
 * Lecture du journal : `lireJournal` de tools/rejeu-voie-predite.cjs (version CH-056). */
const fs=require('node:fs');
const R=require('../../tools/rejeu-voie-predite.cjs');
const Manifeste=require('../../tools/manifeste-parties.cjs');
const wilson=(k,n,z=1.959964)=>{if(!n)return [null,null];const p=k/n,d=1+z*z/n,c=p+z*z/(2*n),r=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return [Math.max(0,(c-r)/d),Math.min(1,(c+r)/d)].map(x=>Math.round(x*1000)/10);};
function lirePartie(journal,partie,detail){
  if(typeof R.lireJournal!=='function')throw Error('lireJournal absent : outil de rejeu antérieur à CH-056');
  const J=R.lireJournal(journal,Manifeste.lireDesignations(partie)[0].partie),temoin=new Map((detail.temoin||[]).map(r=>[r.cut,r]));
  if(!J.gardeReel)throw Error('journal lu sans la garde : outil de rejeu antérieur à CH-056');
  return [...J.gardeReel].sort((a,b)=>a-b).map(cut=>{const z=J.zonesJournal[cut]||null,t=temoin.get(cut)||null;
    return {partie,cut,pnAdv:z?!!(z.pn||z.adv):null,temoinPose:!!t?.posee,pireMm:t?.posee?t.pire??null:null};});
}
function bilan(rows){
  const b={retenus:rows.length,posesTemoin:0,juges:0,justes:0,faux10a50:0,plus50:0,cuts:[]};
  for(const r of rows){if(!r.temoinPose)continue;b.posesTemoin++;if(r.pireMm==null)continue;b.juges++;
    if(r.pireMm<=10)b.justes++;else if(r.pireMm<=50)b.faux10a50++;else b.plus50++;b.cuts.push(`${r.partie}/${r.cut}:${r.pireMm}`);}
  b.justesIC=wilson(b.justes,b.juges);b.plus50IC=wilson(b.plus50,b.juges);return b;
}
function synthese(rows){return {tout:bilan(rows),pnAdv:bilan(rows.filter(r=>r.pnAdv===true)),horsPnAdv:bilan(rows.filter(r=>r.pnAdv===false)),zoneInconnue:bilan(rows.filter(r=>r.pnAdv==null))};}
module.exports={lirePartie,bilan,synthese};
if(require.main===module){
  const a=process.argv.slice(2),J=[],P=[],D=[];let js=null;
  for(let i=0;i<a.length;i++){if(a[i]==='--journal')J.push(a[++i]);else if(a[i]==='--partie')P.push(a[++i]);else if(a[i]==='--detail')D.push(a[++i]);else if(a[i]==='--json')js=a[++i];}
  const rows=P.flatMap((p,i)=>lirePartie(J[i],p,JSON.parse(fs.readFileSync(D[i],'utf8'))));
  const s=synthese(rows);
  for(const [k,b] of Object.entries(s))console.log(`${k} : retenus ${b.retenus}, posés par le témoin ${b.posesTemoin}, jugés ${b.juges}, justes ${b.justes} [${b.justesIC}], faux 10-50 ${b.faux10a50}, > 50 ${b.plus50} [${b.plus50IC}] — ${b.cuts.join(' ')}`);
  if(js)fs.writeFileSync(js,JSON.stringify({format:'ch057-garde-reelle-v1',synthese:s,cuts:rows},null,1)+'\n');
}
