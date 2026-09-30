'use strict';
/* KI-069 (4.8.6), essai c : tout ce qui n'est pas CERTAINEMENT le dernier cut
 * garde le comportement actuel : « valider et suivant » (bouton d'ESV). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {dernierCut,appels,releveBrut}=require('./helpers/dernier-cut.cjs');
const ancien=(r,view,cut=100)=>{
  assert.equal(appels(r,'validateInPlace'),0,'pas de Ctrl+Entrée');assert.ok(appels(r,'validate')>=1,'le bouton « valider et suivant », comme en 4.8.5');
  assert.ok(!/dernier cut de la partie/.test(view.notice||''),'pas de message de dernier cut');
  assert.notEqual(view.batch.stoppedAtEnd?.issue,'dernier-cut-valide');};
const unCut=o=>({options:{start:100,end:101,endMode:null,...o}});

test('N < M−1 : comportement actuel',async()=>{const {r,view}=await dernierCut({mesure:{total:8786,traites:8760},...unCut()});ancien(r,view);});
test('M inconnu (aucun relevé) : comportement actuel',async()=>{const {r,view}=await dernierCut({mesure:null,...unCut()});ancien(r,view);});
test('M illisible (compteur non lisible) : comportement actuel',async()=>{const {r,view}=await dernierCut({mesure:()=>({compteurIllisible:true}),...unCut()});ancien(r,view);});
test('M incohérent (N ≥ M) : comportement actuel',async()=>{const {r,view}=await dernierCut({mesure:{total:100,traites:99},...unCut()});ancien(r,view);});
test('plusieurs compteurs : comportement actuel',async()=>{
  const {r,view}=await dernierCut({mesure:i=>({identity:i,compteur:{traites:100,total:101},compteursVus:2}),...unCut()});ancien(r,view);});
test('relevé d\'un autre cut : comportement actuel',async()=>{
  const {r,view}=await dernierCut({mesure:i=>({identity:{...i,cut:i.cut-1},compteur:{traites:100,total:101}}),...unCut()});ancien(r,view);});
test('relevé d\'une autre partie : comportement actuel',async()=>{
  const {r,view}=await dernierCut({mesure:i=>({identity:{...i,part:i.part+1},compteur:{traites:100,total:101}}),...unCut()});ancien(r,view);});
test('relevé périmé (antérieur au début du cut) : comportement actuel',async()=>{
  const {r,view}=await dernierCut({mesure:i=>({identity:i,at:'2020-01-01T00:00:00.000Z',compteur:{traites:100,total:101}}),...unCut()});ancien(r,view);});
test('M = 0 ou négatif : comportement actuel',async()=>{const {r,view}=await dernierCut({mesure:i=>({identity:i,compteur:{traites:0,total:0}}),...unCut()});ancien(r,view);});
