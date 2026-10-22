'use strict';
/* Terrain du 22/10/2026 : « La session Écho précédente (77 visite(s)) n'a pas été téléchargée en entier » au lancement d'un nouvel Écho.
 * Le panneau acquitte l'export final avec `final:true` ; la commande `native-export-ack` du service worker ne transmettait pas ce champ,
 * donc `finalExportAt` n'était jamais noté (AM-19, 4.9.0.18) et « Télécharger à nouveau la session » n'y changeait rien. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {K}=require('./fixtures.cjs'),Settings=require('../src/settings.js'),EC=require('../src/export-cache.js');
const {background}=require('./helpers/background-harness.cjs');
const esv={id:'test',url:'https://esv.lidar.altametris.xyz/rails_validation/test',tab:{id:1}};

test('native-export-ack final:true (service worker) : l’export final confirmé est noté et libère le démarrage d’un nouvel Écho',async()=>{
 const b=background({globals:{BananeCore3:K,BananeSettings:Settings,BananeExportCache:EC}});await b.api('connect',{tabId:1});await b.api('native-start');
 const id=b.fonction('engine.s.native.id'),period=b.fonction('engine.s.native.currentPeriodId'),state=await b.adapter.state();
 await b.message({kind:'native-event',type:'visit-started',payload:{sessionId:id,observationPeriodId:period,visitId:'v1',identity:state.identity,initialObserved:state}},esv);
 await b.message({kind:'native-event',type:'visit-ended',payload:{sessionId:id,observationPeriodId:period,visitId:'v1',identity:state.identity,finalObserved:state,reason:'finished',nextIdentity:null,endedAt:new Date().toISOString()}},esv);
 await b.api('native-end');
 await assert.rejects(b.api('native-start'),/n’a pas été téléchargée en entier/);
 /* Sans `final`, rien n'est noté : le blocage reste (« Télécharger » partiel). */
 await b.api('native-export-ack',{ids:[],confirmed:[],fichiers:1});
 await assert.rejects(b.api('native-start'),/n’a pas été téléchargée en entier/);
 const ack=await b.api('native-export-ack',{ids:[],confirmed:[],fichiers:3,final:true});
 assert.equal(ack.final,true);assert.ok(b.fonction('engine.s.native.exportState.finalExportAt'));assert.equal(b.fonction('engine.s.native.exportState.finalExportFiles'),3);
 await b.api('native-start');assert.equal(b.fonction('engine.s.native.visits.length'),0);
});
