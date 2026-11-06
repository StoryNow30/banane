#!/usr/bin/env node
'use strict';
/* CH-070 : relève les entrées des fonctions portées dans TOUS les essais du tronc qui chargent les modules de session.
 *   node tools/ch070-relever.cjs SORTIE.jsonl
 * Chaque essai est lancé sous le crochet tools/ch070-releve-crochet.cjs (NODE_OPTIONS) ; la sortie, hors dépôt, sert de
 * cas aux bancs (ariane-rs/parite/session-*.cjs, $CH070_RELEVE_FICHIER). Les essais en vm (contexte isolé) ne passent
 * pas par require : leurs appels ne sont pas relevés (dit dans le rapport). */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const RACINE=path.resolve(__dirname,'..'),sortie=path.resolve(process.argv[2]||'releve.jsonl');
const MOTIF=/native-session|part-summary-49|historique-parties|native-reconstruction|src\/core\.js|\.\.\/src\/core'|\.\/core'/;
const essais=fs.readdirSync(path.join(RACINE,'tests')).filter(n=>n.endsWith('.test.cjs')).filter(n=>MOTIF.test(fs.readFileSync(path.join(RACINE,'tests',n),'utf8'))).sort();
fs.writeFileSync(sortie,'');
const bilan=[];
for(const n of essais){const r=spawnSync('node',['--test',path.join('tests',n)],{cwd:RACINE,encoding:'utf8',timeout:600000,maxBuffer:1<<28,
  env:{...process.env,CH070_RELEVE:sortie,NODE_OPTIONS:'-r '+path.join(__dirname,'ch070-releve-crochet.cjs')}});
 bilan.push({essai:n,code:r.status});}
const lignes=fs.readFileSync(sortie,'utf8').split('\n').filter(Boolean),parF={};let refus=0;
for(const l of lignes){const o=JSON.parse(l);if(o.refus)refus+=o.refus;else parF[o.f]=(parF[o.f]||0)+1;}
console.log(JSON.stringify({essais:essais.length,enEchec:bilan.filter(b=>b.code!==0).map(b=>b.essai),parFonction:parF,nonEncodables:refus},null,1));
