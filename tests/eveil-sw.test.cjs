'use strict';
/* Test 29 (CH-027) — ÉVEIL DU SYSTÈME : pendant un lot, une file, la deuxième passe ou la relecture, le service worker réel demande à Chrome de ne pas mettre
 * l'ordinateur en veille (`chrome.power.requestKeepAwake('system')`), une seule fois, et relâche dès que plus rien ne tourne. L'écoute (Écho) n'en fait pas partie.
 * Une panne de l'API ne touche jamais le lot. Réglage `eveil.actif`. Service worker réel en VM, API `chrome.power` simulée. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,memoire}=require('./helpers/perf-production.cjs');

function montage(){const b=production({local:memoire()}),appels=[];b.fonction=b.get;
 const chrome=b.ctx.chrome;chrome.power={requestKeepAwake:n=>appels.push('demande:'+n),releaseKeepAwake:()=>appels.push('relache')};
 const seance=s=>b.fonction('seanceObservateur=()=>'+JSON.stringify(s)),file=f=>b.fonction("fileP.etat="+(f?"{etat:'lot'}":"null"));
 return {b,appels,seance,file,maj:()=>b.fonction('eveilMaj()')};}

test('lot, relecture, deuxième passe : une demande « system », puis un relâchement quand plus rien ne tourne',()=>{
 const {appels,seance,maj}=montage();
 maj();assert.deepEqual(appels,[],'rien ne tourne : aucune demande');
 seance('lot:L1');maj();maj();assert.deepEqual(appels,['demande:system'],'une seule demande, pas une par minuteur');
 seance('relecture:L1');maj();assert.deepEqual(appels,['demande:system'],'le lot puis la relecture : la demande est gardée');
 seance('passe-differes:L1');maj();assert.deepEqual(appels,['demande:system']);
 seance(null);maj();assert.deepEqual(appels,['demande:system','relache']);
 maj();assert.equal(appels.length,2,'rien de plus');});

test('la file de parties garde le système éveillé, même entre deux lots',()=>{
 const {appels,seance,file,maj}=montage();
 seance(null);file(true);maj();assert.deepEqual(appels,['demande:system']);
 file(false);maj();assert.deepEqual(appels,['demande:system','relache']);});

test('l’écoute (Écho, manuelle ou native) ne demande rien : l’opérateur est devant',()=>{
 const {appels,seance,maj}=montage();
 seance('ecoute-native');maj();seance('ecoute-manuelle');maj();assert.deepEqual(appels,[]);});

test('une panne de l’API ne casse rien : pas d’exception, la demande est retentée au tour suivant',()=>{
 const {b,appels,seance,maj}=montage();b.ctx.chrome.power.requestKeepAwake=()=>{throw Error('refus de chrome');};
 seance('lot:L1');assert.doesNotThrow(maj);assert.deepEqual(appels,[]);
 b.ctx.chrome.power.requestKeepAwake=n=>appels.push('demande:'+n);maj();assert.deepEqual(appels,['demande:system']);});

test('sans l’API (`chrome.power` absent) : aucun effet, aucune exception',()=>{
 const {b,seance}=montage();delete b.ctx.chrome.power;seance('lot:L1');assert.doesNotThrow(()=>b.fonction('eveilMaj()'));});

test('réglage coupé (`eveil.actif: false`) : aucune demande',()=>{
 const {b,appels,seance,maj}=montage();b.fonction('globalThis.BananeSettings=Object.freeze({...globalThis.BananeSettings,eveil:Object.freeze({actif:false,niveau:"system"})})');
 seance('lot:L1');maj();assert.deepEqual(appels,[]);});

test('le manifeste déclare la permission « power » (ordre écrit de l’opérateur, 31/10)',()=>{
 const m=require('../manifest.json');assert.ok(m.permissions.includes('power'));});
