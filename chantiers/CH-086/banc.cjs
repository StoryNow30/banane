#!/usr/bin/env node
'use strict';
/* CH-086 — banc du temps par cut sur la maquette ESV : N lots avec le réglage `ecrituresApresValidation` allumé, N éteint, alternés
 * (l'ordre change à chaque paire). Deux copies de l'extension, identiques hors de la ligne du réglage dans src/settings.js.
 *   node chantiers/CH-086/banc.cjs DOSSIER_AVEC DOSSIER_SANS [--n 15] [--cuts 10] [--sortie RELEVE.json]
 * Pour chaque lot : commandes du lot, journal de la maquette (poses au nm, rails choisis, cuts chargés, écritures au serveur ; heures
 * retirées), écritures reçues par le « serveur » : leur empreinte doit être la même dans les 2N lots. Durées : lot et cuts (rapport du banc). */
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {banc}=require('../../tools/banc-esv.cjs');
const a=process.argv.slice(2),pos=a.filter((x,i)=>!x.startsWith('--')&&!(a[i-1]||'').startsWith('--'));
const opt=k=>{const i=a.indexOf('--'+k);return i>=0?a[i+1]:null;};
const N=Number(opt('n')||15),CUTS=Number(opt('cuts')||10),SORTIE=opt('sortie');
const [AVEC,SANS]=pos.map(p=>path.resolve(p));
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16);
const TYPES=new Set(['cut-charge','rail-choisi','rail-pose','ecriture','ecriture-reponse','evenement-jquery']);
function signature(r){const m=(r.maquetteJournal||[]).filter(x=>TYPES.has(x.type)).map(({at,...x})=>x);
 return {commandes:r.resume.commandes,ecritures:r.resume.ecrituresServeur,maquette:sha(m),poses:sha(m.filter(x=>x.type==='rail-pose')),etat:r.resume.etatFinal,cutsPoses:r.resume.cutsPoses,differes:r.resume.differes};}
const med=l=>{const s=[...l].sort((x,y)=>x-y);return s.length?s[Math.floor((s.length-1)/2)]:null;},p90=l=>{const s=[...l].sort((x,y)=>x-y);return s.length?s[Math.ceil(0.9*s.length)-1]:null;};
(async()=>{const lots=[];
 for(let i=0;i<N;i++)for(const [nom,ext] of (i%2?[['avec',AVEC],['sans',SANS]]:[['sans',SANS],['avec',AVEC]])){
  const tmp=path.join(require('node:os').tmpdir(),`ch086-banc-${process.pid}.json`);await banc({cuts:CUTS,extension:ext,json:tmp});
  const r=JSON.parse(fs.readFileSync(tmp,'utf8'));fs.rmSync(tmp,{force:true});const s=signature(r);
  lots.push({nom,i,dureeLotMs:r.resume.dureeLotMs,cuts:(r.resume.cuts||[]).map(c=>c.dureeMs),signature:s,erreurs:r.resume.erreurs?.length||0});
  console.error(`${nom} ${i} lot ${r.resume.dureeLotMs} ms, état ${s.etat}, maquette ${s.maquette}`);}
 const sig=l=>JSON.stringify(l.signature),ref=sig(lots[0]);
 const groupe=n=>{const l=lots.filter(x=>x.nom===n);return {lots:l.length,lotMedianMs:med(l.map(x=>x.dureeLotMs)),cutMedianMs:med(l.flatMap(x=>x.cuts)),cutP90Ms:p90(l.flatMap(x=>x.cuts)),erreurs:l.reduce((n,x)=>n+x.erreurs,0)};};
 const releve={n:N,cuts:CUTS,avec:groupe('avec'),sans:groupe('sans'),signaturesIdentiques:lots.every(x=>sig(x)===ref),signaturesDifferentes:lots.filter(x=>sig(x)!==ref).map(x=>({nom:x.nom,i:x.i,signature:x.signature})),
  signature:lots[0].signature,lots};
 if(SORTIE)fs.writeFileSync(SORTIE,JSON.stringify(releve,null,1));
 const {lots:_,...court}=releve;console.log(JSON.stringify(court,null,1));})().catch(e=>{console.error(e);process.exit(1);});
