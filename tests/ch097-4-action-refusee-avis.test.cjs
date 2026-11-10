'use strict';
/* CH-097, défaut 4 — UNE LECTURE DU PANNEAU QUI ÉCHOUE N'ÉCRASE PLUS L'AVIS DU LOT. Avant : tout rejet de `dispatch` posait `engine.s.notice`,
 * sauvegardait l'état et prenait une des 64 entrées du journal des transitions (`erreur`), lecture ou geste. Cas suivi : le panneau demande `build`
 * à chaque ouverture ; pendant Écho (donc pendant toute correction), `build` tombait sous le refus général « Écho est actif » : l'avis du lot était
 * remplacé et le paquet n'était pas affiché. Maintenant : `build` répond pendant Écho ; une lecture qui échoue rend son erreur au panneau sans toucher
 * l'avis, l'état gardé ni le journal des transitions ; un geste refusé reste noté comme avant. Service worker RÉEL en VM. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {background}=require('./helpers/background-harness.cjs'),K=require('../src/core.js'),Settings=require('../src/settings.js'),EC=require('../src/export-cache.js');
async function monte(){const b=background({globals:{BananeCore3:K,BananeSettings:Settings,BananeExportCache:EC,setTimeout,clearTimeout}});
 await b.api('connect',{tabId:1});const engine=b.fonction('engine'),journal=b.fonction('coordinateurLot').journal;
 let sauvegardes=0;const save=engine.save.bind(engine);engine.save=async(...a)=>{sauvegardes++;return save(...a);};
 return {b,engine,erreurs:()=>journal.filter(x=>x.nom==='erreur').length,sauvegardes:()=>sauvegardes};}
const echo=engine=>{engine.s.native={id:'N1',status:'RUNNING',visits:[],observationPeriods:[],cloudIds:[]};};

test('`build` pendant Écho : le paquet est rendu, l’avis du lot est intact, aucune transition « erreur », aucune sauvegarde',async()=>{
 const {b,engine,erreurs,sauvegardes}=await monte();echo(engine);engine.s.notice='AVIS DU LOT';
 const avant=sauvegardes(),r=await b.api('build');
 assert.equal(typeof r.build,'string');assert.equal(engine.s.notice,'AVIS DU LOT');assert.equal(erreurs(),0);assert.equal(sauvegardes(),avant);});

test('une lecture qui échoue (`cloud`) : l’erreur revient au panneau, sans avis, sans sauvegarde, sans transition',async()=>{
 const {b,engine,erreurs,sauvegardes}=await monte();engine.s.notice='AVIS DU LOT';b.store.getCloud=async()=>{throw Error('nuage illisible');};
 const avant=sauvegardes();
 await assert.rejects(b.api('cloud',{id:'x'}),/nuage illisible/);
 assert.equal(engine.s.notice,'AVIS DU LOT');assert.equal(erreurs(),0);assert.equal(sauvegardes(),avant);});

test('un geste refusé reste noté comme avant : avis remplacé, une transition « erreur » ; le refus général d’Écho tient pour les gestes',async()=>{
 const {b,engine,erreurs}=await monte();echo(engine);engine.s.notice='AVIS DU LOT';
 await assert.rejects(b.api('start',{}),/Écho est actif/);
 assert.match(engine.s.notice,/Écho est actif/);assert.equal(erreurs(),1);
 await assert.rejects(b.api('explicit-skip'),/Écho est actif/,'le chemin de « SKIP explicite » n’est pas touché : toujours refusé pendant Écho');
 assert.equal(erreurs(),2);});
