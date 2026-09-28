#!/usr/bin/env node
'use strict';
/* Mesure CPU Node de la composition réelle, cinq captures terrain p12.
 * Le wrapper chronomètre V4.6 sans en changer la sortie. Ni ESV ni stockage.
 * Usage : node tools/audit-calcul-480.cjs DOSSIER_LOT SORTIE.json */
const fs=require('node:fs'),os=require('node:os'),{performance}=require('node:perf_hooks');
const A=require('./acceptance-report.cjs'),S=require('../src/gcv1-shadow.js'),R=require('../src/geometry-brain.js');
const lot=A.loadLot(process.argv[2],'p12');R.configure({actif:true,autoriserSelectionSansPause:true});
let runtimeMs=0;
const wrapper={...R,proposeBoth(...a){const t=performance.now();try{return R.proposeBoth(...a);}finally{runtimeMs=performance.now()-t;}}};
const shadow=S._createForTest(wrapper,require('../src/geometry-candidate-v1.js'),require('../vendor/capture-core.js'),require('../src/gauge.js'),require('../src/placement-convention.js'));
const rows=[];
for(const cut of [1,210,7738,7743,7852]){
 const c=lot.corpus.clouds.find(c=>c.identity?.cut===cut);if(!c)throw Error('Capture absente : '+cut);
 for(let repetition=0;repetition<3;repetition++){
  shadow.armOnce('active-pilot-test');const t=performance.now();shadow.geometry.proposeBoth(c);const totalMs=performance.now()-t,last=shadow.consumeLast();
  rows.push({cut,repetition,points:c.pointsSceneRelative?.length,runtimeMs,totalMs,selectedEngine:last.selection.selectedEngine});
 }
}
const result={conditions:{node:process.version,cpu:os.cpus()[0].model,at:new Date().toISOString(),scope:'Node local, captures p12 ; aucune mesure navigateur'},rows};
fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
