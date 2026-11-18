#!/usr/bin/env node
'use strict';
/* CH-070 : banc de parité d'ariane-session, sur le cœur construit AVEC l'aiguillage proposé (tools/ch070-construire.cjs).
 *   node tools/ch070-parite.cjs --module session-resume [--chromium] [--nuages N] [--json SORTIE]
 * Même moteur de comparaison que tools/ch064-parite.cjs (stricte, exceptions comprises, empreintes VBA). */
const fs=require('node:fs'),path=require('node:path');
const {executer}=require('./ch064-parite.cjs'),{executerChromium}=require('./ch070-parite-chromium.cjs'),Coeur=require('../ariane-rs/coquille/coeur.js'),{construire}=require('./ch070-construire.cjs');
const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
const nom=arg('--module');if(!nom)throw Error('--module requis');
const ad=require(path.resolve(__dirname,'..','ariane-rs','parite',nom+'.cjs')),w=construire();
const o={nuages:arg('--nuages')?Number(arg('--nuages')):Infinity,lot:arg('--lot')?Number(arg('--lot')):20};
const fin=r=>{const s=JSON.stringify(r,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);if(r.verdict!=='IDENTIQUE')process.exitCode=1;};
if(a.includes('--chromium'))executerChromium(ad,fs.readFileSync(w),o).then(r=>fin({format:'ch064-parite-v1',moteur:'chromium',...r})).catch(e=>{console.error(e);process.exit(1);});
else fin({format:'ch064-parite-v1',moteur:'node '+process.version,...executer(ad,Coeur.creer(fs.readFileSync(w)),o)});
