#!/usr/bin/env node
'use strict';
/* Lance tous les essais de la maquette ESV avec les délais qu'ils demandent (hors `tools/verify.cjs`, qui refuse
 * les essais sautés en mode complet ; ici, sans Playwright ni Chromium, les essais navigateur se sautent avec leur raison).
 *   node tests/esv-maquette/essais.cjs [--sans-navigateur] */
const {spawnSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const ici=__dirname,sans=process.argv.includes('--sans-navigateur');
const fichiers=fs.readdirSync(ici).filter(f=>f.endsWith('.test.cjs')&&!(sans&&/adaptateur|extension|pannes/.test(f))).sort().map(f=>path.join(ici,f));
/* CH-017 : l'essai de la file de parties (deux Chromium, des lots réels de plusieurs parties) tourne APRÈS les autres, seul : lancé en parallèle,
 * sa charge faisait manquer ses délais à « Connexion T21 » (mesuré : 1 échec dans la suite complète, 0 sans lui). */
const SEUL=/file-parties\.test\.cjs$/,ensemble=fichiers.filter(f=>!SEUL.test(f)),apres=fichiers.filter(f=>SEUL.test(f));
const r=spawnSync(process.execPath,['--test','--test-timeout=180000',...ensemble],{stdio:'inherit'});
const r2=apres.length&&!sans?spawnSync(process.execPath,['--test','--test-timeout=600000',...apres],{stdio:'inherit'}):{status:0};
process.exit((r.status??1)||(r2.status??1));
