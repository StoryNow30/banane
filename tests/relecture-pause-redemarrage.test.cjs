'use strict';
/* 4.9.6 (D-232, D-233) — REDÉMARRAGE DU SERVICE WORKER pendant une relecture en pause (le panneau peut se rouvrir, le service worker se rendormir) :
 *  - avec un point de reprise valable (réglage allumé, même lot, moins de 24 h), la passe revient EN PAUSE, jamais relancée seule ; « Arrêter » l'efface ;
 *  - point trop vieux (plus de 24 h) ou d'un autre lot : jeté, la relecture n'est pas ressuscitée. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production}=require('./helpers/perf-production.cjs');
const {H,lotPause,attendreEtat}=require('./helpers/relecture-pause.cjs');
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const js=x=>JSON.parse(JSON.stringify(x));

test('redémarrage pendant une pause : la passe revient en pause au même cut, avec ses compteurs ; « Arrêter » efface le point',async()=>{
 let demande=null;
 const {b,adapter,local}=await lotPause({esv:(a,bb)=>{a.surAller=async t=>{if(t.cut!==109||demande)return;demande=await bb.api('relecture-pause');};}});
 const p=await attendreEtat(b,'en-pause'),cut=p.cut,faits=p.faits;
 const c=production({adapter,local,store:b.store});await c.api('view');await attendre(60);
 const etat=js(await c.api('relecture-etat'));
 assert.equal(etat.passe.etat,'en-pause');assert.equal(etat.passe.pauseRaison,'redemarrage');assert.equal(etat.passe.cut,cut);assert.equal(etat.passe.faits,faits);assert.equal(etat.passe.reprise,true);
 assert.ok(etat.passe.expire>Date.now(),'la reprise a une échéance');
 assert.equal(c.store.events.filter(e=>e.type==='relecture-pause'&&e.raison==='redemarrage').length,1);
 assert.equal(c.store.events.some(e=>e.type==='relecture-fin'&&e.issue==='interrompue'),false,'pas « interrompue » : elle est gardée en pause');
 /* Elle n'agit pas seule, et rien d'autre ne part. */
 await attendre(100);assert.equal((await c.api('relecture-etat')).passe.etat,'en-pause');
 await assert.rejects(c.api('start',{part:23,start:1,end:2}),/Relecture en pause/);
 await c.api('relecture-arreter');
 const apres=js(await c.api('relecture-etat'));assert.equal(apres.passe.etat,'arretee');
 assert.equal('banane51RelectureReprise' in local.m,false,'« Arrêter » efface le point');
 assert.equal(c.store.events.filter(e=>e.type==='relecture-fin').at(-1).issue,'arret');
});
