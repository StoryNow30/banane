#!/usr/bin/env node
'use strict';
/*
 * cursor-sweep.cjs — bilan des curseurs de la décision sur le lot (critère C5
 * du cahier 4.8), à partir des relevés de `tools/choice-anchor-study.cjs`.
 *
 *   node tools/choice-anchor-study.cjs DOSSIER/NOM-a.json [--option clé=valeur ...] --natif ... --lot ...
 *   node tools/cursor-sweep.cjs SORTIE.json DOSSIER base NOM [...]
 *
 * Chaque configuration NOM est lue dans DOSSIER/NOM-*.json (un ou plusieurs
 * relevés, fusionnés). `base` est la configuration de référence (curseurs de
 * `src/lot-decision.js`). Pour chaque configuration : cuts appliqués, jugés,
 * faux (Natif et Pilote), et, par rapport à la base, les cuts gagnés, perdus
 * et décidés autrement, avec leur jugement. Faux : latéral OU vertical > 10 mm
 * (D-038), jugement de l'étude. Rien n'est une cible d'écartement.
 */
const fs=require('node:fs'),path=require('node:path');
const key=x=>x.source+':'+x.cut;
const verdict=x=>x.judged?(x.wrong?'faux':'juste'):'non jugé';
function sum(rows){const j=rows.filter(x=>x.judged),w=j.filter(x=>x.wrong);
  return {applied:rows.length,judged:j.length,right:j.length-w.length,wrong:w.length,wrongCuts:w.map(x=>key(x)+' ('+x.worstMm+' mm)')};}
/* Une décision « autre » : étape différente, ou jugement différent, ou écart qui bouge de plus d'1 mm. */
function changedFrom(x,b){return x.stage!==b.stage||(x.judged&&b.judged&&(x.wrong!==b.wrong||Math.abs(x.worstMm-b.worstMm)>1));}
function summarize(configs,baseName='base'){
  const base=configs[baseName];if(!base)throw Error('Configuration de référence absente : '+baseName);
  const baseMap=new Map(base.map(x=>[key(x),x])),b=sum(base),out={};
  for(const [name,rows] of Object.entries(configs)){
    const all=sum(rows),res={natif:sum(rows.filter(x=>x.kind==='natif')),pilote:sum(rows.filter(x=>x.kind==='pilote')),all,stages:{}};
    for(const x of rows)res.stages[x.stage]=(res.stages[x.stage]||0)+1;
    if(name!==baseName){const cur=new Map(rows.map(x=>[key(x),x]));
      res.delta={applied:all.applied-b.applied,right:all.right-b.right,wrong:all.wrong-b.wrong};
      res.gained=rows.filter(x=>!baseMap.has(key(x))).map(x=>({cut:key(x),stage:x.stage,verdict:verdict(x),worstMm:x.worstMm??null}));
      res.lost=base.filter(x=>!cur.has(key(x))).map(x=>({cut:key(x),stage:x.stage,verdict:verdict(x),worstMm:x.worstMm??null}));
      res.changed=rows.filter(x=>baseMap.has(key(x))&&changedFrom(x,baseMap.get(key(x)))).map(x=>{const o=baseMap.get(key(x));
        return {cut:key(x),stage:o.stage+' → '+x.stage,worstMm:x.judged&&o.judged?[o.worstMm,x.worstMm]:null,verdict:verdict(o)===verdict(x)?verdict(x):verdict(o)+' → '+verdict(x)};});}
    out[name]=res;}
  return out;
}
function load(dir,name){const files=fs.readdirSync(dir).filter(f=>f.startsWith(name+'-')&&f.endsWith('.json')&&/^[a-z]$/.test(f.slice(name.length+1,-5))).sort();
  if(!files.length)throw Error('Aucun relevé pour '+name+' dans '+dir);
  return files.flatMap(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')).rows);}
function run(argv=process.argv.slice(2)){
  const [out,dir,...names]=argv;if(!out||!dir||!names.length)throw Error('Usage : SORTIE.json DOSSIER base NOM [...]');
  const result={format:'banane-cursor-sweep-v1',wrongMm:10,base:names[0],configs:summarize(Object.fromEntries(names.map(n=>[n,load(dir,n)])),names[0])};
  fs.writeFileSync(out,JSON.stringify(result,null,1)+'\n');
  for(const [n,r] of Object.entries(result.configs))console.log(`${n.padEnd(16)} ${String(r.all.applied).padStart(4)} appliqués · ${r.all.right} justes · ${r.all.wrong} faux`+(r.delta?`  (${r.delta.right>=0?'+':''}${r.delta.right} justes, ${r.delta.wrong>=0?'+':''}${r.delta.wrong} faux)`:''));
  return result;
}
if(require.main===module)try{run();}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={summarize,sum,changedFrom,load,run};
