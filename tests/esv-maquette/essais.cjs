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
/* Vision 11 : `correction-signal` (frappe Ctrl+Entrée puis attente de 10 s) manque son délai dès qu'un autre fichier tourne à côté (mesuré le 10/11 : rouge 4 fois
 * sur 6 dans la suite, vert 6 fois sur 6 seul, 27 s ; même durée seul sur Vision 10) : il passe après les autres, et ce second groupe tourne un fichier à la fois. */
const SEUL=/(file-(parties|changement-gestes|partie-changee-par-esv)|correction-signal)\.test\.cjs$/  /* CH-039 : idem */,ensemble=fichiers.filter(f=>!SEUL.test(f)),apres=fichiers.filter(f=>SEUL.test(f));
/* Vision 11 : deux fichiers à la fois au plus. À la concurrence par défaut (3 sur 4 cœurs, un ou deux Chromium par fichier), des essais d'interface manquaient
 * leurs délais selon l'ordre de passage (mesuré le 10/11 : `correction-signal` puis `file-signal-clics` rouges dans la suite, verts seuls). */
const r=spawnSync(process.execPath,['--test','--test-concurrency=2','--test-timeout=180000',...ensemble],{stdio:'inherit'});
const r2=apres.length&&!sans?spawnSync(process.execPath,['--test','--test-concurrency=1','--test-timeout=600000',...apres],{stdio:'inherit'}):{status:0};
process.exit((r.status??1)||(r2.status??1));
