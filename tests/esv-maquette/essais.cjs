#!/usr/bin/env node
'use strict';
/* Lance tous les essais de la maquette ESV avec les délais qu'ils demandent (hors `tools/verify.cjs`, qui refuse
 * les essais sautés en mode complet ; ici, sans Playwright ni Chromium, les essais navigateur se sautent avec leur raison).
 *   node tests/esv-maquette/essais.cjs [--sans-navigateur] */
const {spawnSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const ici=__dirname,sans=process.argv.includes('--sans-navigateur');
const fichiers=fs.readdirSync(ici).filter(f=>f.endsWith('.test.cjs')&&!(sans&&/adaptateur|extension|pannes/.test(f))).sort().map(f=>path.join(ici,f));
const r=spawnSync(process.execPath,['--test','--test-timeout=180000',...fichiers],{stdio:'inherit'});process.exit(r.status??1);
