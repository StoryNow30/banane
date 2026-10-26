#!/usr/bin/env node
'use strict';
/*
 * banc-comparer.cjs — compare deux rapports du banc (tools/banc-esv.cjs --json), cut par cut :
 * même lot, deux versions d'Ariane (ou deux réglages). Rien n'est estimé : chaque ligne vient des deux rapports.
 *
 *   node tools/banc-comparer.cjs A.json B.json [--md SORTIE.md] [--json SORTIE.json]
 *
 * Par cut : issue (posé-validé / différé / absent), durée, écart à la référence (mm, si rejeu) ; totaux ; ce qui diffère.
 */
const fs=require('node:fs');
function lire(f){const d=JSON.parse(fs.readFileSync(f,'utf8'));return d.resume||d;}
function issues(r){const m=new Map();for(const c of r.cuts||[])m.set(c.cut,{duree:c.dureeMs,types:new Set(c.types||[])});
  const valides=new Set((r.ecrituresServeur||[]).filter(e=>e.status==='valid').map(e=>Number(String(e.rowKey).split('-').pop())));
  const ecarts=new Map((r.ecartsReferenceMm||[]).map(e=>[Number(String(e.rowKey).split('-').pop()),e]));
  const out=new Map();for(const [cut,x] of m)out.set(cut,{issue:valides.has(cut)?'posé-validé':[...x.types].some(t=>/defer/.test(t))?'différé':'autre',duree:x.duree,ecart:ecarts.get(cut)||null});
  return out;}
function comparer(a,b){const ia=issues(a),ib=issues(b),cuts=[...new Set([...ia.keys(),...ib.keys()])].sort((x,y)=>x-y);
  const lignes=cuts.map(cut=>{const x=ia.get(cut),y=ib.get(cut);return {cut,A:x?x.issue:'absent',B:y?y.issue:'absent',dureeA:x?.duree??null,dureeB:y?.duree??null,
    ecartA:x?.ecart?[x.ecart.gaucheMm,x.ecart.droitMm]:null,ecartB:y?.ecart?[y.ecart.gaucheMm,y.ecart.droitMm]:null,differe:(x?x.issue:'absent')!==(y?y.issue:'absent')};});
  const total=r=>({version:r.version,etat:r.etatFinal,dureeMs:r.dureeLotMs,poses:(r.ecrituresServeur||[]).filter(e=>e.status==='valid').length,differes:r.differes??null,erreurs:(r.erreurs||[]).length,commandes:r.commandes});
  return {A:total(a),B:total(b),cuts:lignes,differents:lignes.filter(l=>l.differe).map(l=>l.cut)};}
function markdown(c){const l=['| cut | A | B | durée A | durée B | écart A (g/d mm) | écart B (g/d mm) |','|---|---|---|---|---|---|---|'];
  for(const x of c.cuts)l.push(`| ${x.cut} | ${x.A} | ${x.B} | ${x.dureeA??'–'} | ${x.dureeB??'–'} | ${x.ecartA?x.ecartA.join(' / '):'–'} | ${x.ecartB?x.ecartB.join(' / '):'–'} |`);
  return `A : ${c.A.version} (${c.A.etat}, ${c.A.dureeMs} ms, ${c.A.poses} posés-validés, ${c.A.differes} différés, ${c.A.erreurs} erreurs)\nB : ${c.B.version} (${c.B.etat}, ${c.B.dureeMs} ms, ${c.B.poses} posés-validés, ${c.B.differes} différés, ${c.B.erreurs} erreurs)\nCuts d'issue différente : ${c.differents.length?c.differents.join(', '):'aucun'}\n\n${l.join('\n')}\n`;}
module.exports={comparer,issues,markdown};
if(require.main===module){const a=process.argv.slice(2),f=[],o={};
  for(let i=0;i<a.length;i++){if(a[i]==='--md'||a[i]==='--json'){if(!a[i+1]||a[i+1].startsWith('--')){console.error(a[i]+' : fichier de sortie attendu');process.exit(2);}o[a[i].slice(2)]=a[++i];}else f.push(a[i]);}
  if(f.length!==2){console.error('Usage : A.json B.json [--md SORTIE.md] [--json SORTIE.json]');process.exit(2);}
  const c=comparer(lire(f[0]),lire(f[1])),md=markdown(c);if(o.md)fs.writeFileSync(o.md,md);if(o.json)fs.writeFileSync(o.json,JSON.stringify(c,null,1));console.log(md);}
