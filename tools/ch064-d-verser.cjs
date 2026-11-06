#!/usr/bin/env node
'use strict';
/* CH-064-D : verse dans chantiers/CH-064/ les résultats des bancs (ariane-rs/dist/, non versionné), réduits à ce qui se lit :
 * cas, identiques, verdict, empreintes, temps, mémoire, compteurs de la façade, empreintes des sources JS de référence.
 * Les identifiants de cas (partie, cut) et les trames ne sont pas versés.
 *   node tools/ch064-d-verser.cjs */
const fs=require('node:fs'),path=require('node:path');
const RACINE=path.resolve(__dirname,'..'),D=path.join(RACINE,'ariane-rs','dist'),C=path.join(RACINE,'chantiers','CH-064');
const out={format:'ch064-d-parite-v1',bancs:{}};
for(const f of fs.readdirSync(D).filter(n=>/^parite-j\d-(node|chromium)\.json$/.test(n)).sort()){const r=JSON.parse(fs.readFileSync(path.join(D,f),'utf8'));
 out.bancs[f.replace('.json','')]={moteur:r.moteur||r.navigateur,cas:r.cas,identiques:r.identiques,verdict:r.verdict,ecarts:(r.ecarts||[]).length,
  casChargeNaN:r.casChargeNaN??null,empreintes:r.empreintes,temps:r.temps,memoireCoeur:r.memoireCoeur,tasJsOctets:r.tasJsOctets??null,facade:r.bilanAdaptateur,sources:r.sources};}
fs.writeFileSync(path.join(C,'D-parite.json'),JSON.stringify(out,null,1)+'\n');
const t=path.join(D,'ch064-d-banc-temps.json');if(fs.existsSync(t))fs.copyFileSync(t,path.join(C,'D-banc-temps.json'));
console.log(Object.entries(out.bancs).map(([k,v])=>k+' '+v.cas+'/'+v.identiques+' '+v.verdict).join('\n'));
