#!/usr/bin/env node
'use strict';
/* esv-contrat-comparer.cjs — compare un relevé du vrai ESV (tools/esv-contrat-releve.js) aux hypothèses de la
 * maquette (tests/esv-maquette/contrat-esv.json) : confirmée / infirmée / non relevée, et quoi changer dans la maquette.
 *   node tools/esv-contrat-comparer.cjs RELEVE.json [--json SORTIE.json]        Le relevé reste privé (jamais dans le dépôt). */
const fs=require('node:fs'),path=require('node:path');
const contrat=JSON.parse(fs.readFileSync(path.join(__dirname,'../tests/esv-maquette/contrat-esv.json'),'utf8'));
const lire=(o,cle)=>cle.split('.').reduce((x,k)=>x==null?undefined:x[k],o);
function juger(h,releve){const v=lire(releve,h.attendu.cle),a=h.attendu.valeur;
  if(v===undefined||v===null)return {verdict:'non relevée',observe:v};
  if(Array.isArray(a))return {verdict:JSON.stringify(v)===JSON.stringify(a)?'confirmée':'infirmée',observe:v};
  if(typeof a==='string'&&a.startsWith('≥ ')){const n=Array.isArray(v)?v.length:Number(v);return {verdict:n>=Number(a.slice(2))?'confirmée':'infirmée',observe:n};}
  if(typeof a==='string'&&/^\d+ à \d+$/.test(a)){const [lo,hi]=a.split(' à ').map(Number);return {verdict:v>=lo&&v<=hi?'confirmée':'infirmée',observe:v};}
  if(a==='= liste.lignes'){const lignes=lire(releve,'liste.lignes');return lignes==null?{verdict:'non relevée',observe:v}:{verdict:v===lignes?'confirmée':'infirmée',observe:v};}
  if(typeof a==='string')return {verdict:String(v).toLowerCase()===a.toLowerCase()?'confirmée':'infirmée',observe:v};
  return {verdict:v===a?'confirmée':'infirmée',observe:v};}
function comparer(releve){const lignes=contrat.hypotheses.map(h=>({...h,...juger(h,releve)}));
  return {releve:releve.quand||null,confirmees:lignes.filter(l=>l.verdict==='confirmée').length,infirmees:lignes.filter(l=>l.verdict==='infirmée').length,nonRelevees:lignes.filter(l=>l.verdict==='non relevée').length,hypotheses:lignes,
    aChanger:lignes.filter(l=>l.verdict==='infirmée').map(l=>`${l.id} ${l.sujet} : la maquette suppose « ${l.maquette} », ESV montre ${JSON.stringify(l.observe)}`)};}
module.exports={comparer,juger};
if(require.main===module){const f=process.argv[2];if(!f){console.error('Usage : RELEVE.json [--json SORTIE.json]');process.exit(2);}
  const c=comparer(JSON.parse(fs.readFileSync(f,'utf8')));const j=process.argv.indexOf('--json');if(j>=0)fs.writeFileSync(process.argv[j+1],JSON.stringify(c,null,1));
  console.log(`${c.confirmees} confirmées, ${c.infirmees} infirmées, ${c.nonRelevees} non relevées`);for(const l of c.hypotheses)console.log(`${l.id} ${l.verdict.padEnd(12)} ${l.sujet} — attendu ${JSON.stringify(l.attendu.valeur)}, observé ${JSON.stringify(l.observe)}`);
  if(c.aChanger.length){console.log('\nÀ changer dans la maquette :');for(const x of c.aChanger)console.log(' - '+x);}}
