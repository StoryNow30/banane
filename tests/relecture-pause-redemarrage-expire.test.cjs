'use strict';
/* Test 17 (D-232 à D-234) — REDÉMARRAGE, suite (un fichier à part : chaque fichier d'essai tient en moins de 20 s) — REDÉMARRAGE DU SERVICE WORKER pendant une relecture en pause (le panneau peut se rouvrir, le service worker se rendormir) :
 *  - avec un point de reprise valable (réglage allumé, même lot, moins de 24 h), la passe revient EN PAUSE, jamais relancée seule ; « Arrêter » l'efface ;
 *  - point trop vieux (plus de 24 h) ou d'un autre lot : jeté, la relecture n'est pas ressuscitée. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production}=require('./helpers/perf-production.cjs');
const {H,lotPause,attendreEtat}=require('./helpers/relecture-pause.cjs');
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const js=x=>JSON.parse(JSON.stringify(x));

test('point de plus de 24 h, ou d’un autre lot, ou réglage éteint : jeté au réveil, aucune passe ressuscitée',async()=>{
 let demande=null;
 const {b,adapter,local}=await lotPause({esv:(a,bb)=>{a.surAller=async t=>{if(t.cut!==109||demande)return;demande=await bb.api('relecture-pause');};}});
 await attendreEtat(b,'en-pause');
 const pt=js(local.m.banane51RelectureReprise);
 for(const [nom,abime,reglage] of [['trop vieux',x=>{x.savedAt=new Date(Date.now()-25*3600*1000).toISOString();},null],['autre lot',x=>{x.lotId='lot-ancien';},null],['réglage éteint',()=>{},{actif:false,f5:'pause'}]]){
  local.m.banane51RelectureReprise=js(pt);abime(local.m.banane51RelectureReprise);if(reglage)local.m.banane51RelecturePauseReglage=reglage;
  const c=production({adapter,local,store:b.store});await c.api('view');await attendre(60);
  assert.equal((await c.api('relecture-etat')).passe,null,nom+' : aucune passe ressuscitée');
  assert.equal('banane51RelectureReprise' in local.m,false,nom+' : point jeté');
 }
});
