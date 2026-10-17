'use strict';
/* 5.0 (D-170 à D-173, audit P-5) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : les zones PN et ADV
 * qui servent à la sélection et au mode « corriger » sont tirées des SEULES captures du lot, AVANT la passe, et figées. Une capture de
 * vert faite par la passe qui ressemble à un cœur de PN ne crée ni n'étend aucune zone : le cut reste aux abords, en ombre (fichier
 * proposé réel : seule la zone PN corrige). Chaque visite dit l'origine de sa zone (`zoneSource:'lot'`). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {H,j,apresLot}=require('./helpers/relecture-essais.cjs');
const FICHIER=JSON.parse(fs.readFileSync(path.join(__dirname,'../datasets/relecture-reglages-proposes.json'),'utf8'));

test('captures de verts qui ressemblent à un cœur de PN pendant la passe : aucune zone créée, aucune correction',async()=>{
 let appelsPendantPasse=0,adapterRef=null;
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',decisions:{109:14,115:20},reglagesProposes:FICHIER,
  esv:(a,bb)=>{adapterRef=a;const M=bb.ctx.BananeReglesMetier,copie={};
   /* Pendant la passe, au premier cut relu, une « zone PN » apparaît dans le journal sur 107–117, comme si une capture de vert
    * l'avait ouverte : la passe, figée sur les zones du lot, ne la lit pas. */
   a.surAller=async t=>{if(t.cut===108&&!a.zoneInjectee){a.zoneInjectee=true;
    bb.store.events.push({eventId:'faux-pn',timestamp:new Date().toISOString(),type:'regles-metier-ombre',portee:'cut',batchId:bb.get('engine').s.batch.id,identity:{part:23,cut:109},zone:{pnControle:[107,117]}});}};
   /* Après le lot, toute surface lue serait un cœur de PN (chaussée au ras sur les quatre quarts) : comme les faux cœurs de l'audit. */
   for(const [k,v] of Object.entries(M))copie[k]=typeof v!=='function'?v:function(...args){if(adapterRef.apresLot)appelsPendantPasse++;
    const r=v.apply(this,args);return k==='surface'&&adapterRef.apresLot&&r&&typeof r==='object'?{...r,coeurPN:true,flushPct:100,quadMin:100}:r;};
   bb.ctx.BananeReglesMetier=copie;}});
 const p=await H.finPasse(b);
 const avant=H.evenements(b,'regles-metier-ombre').filter(e=>e.eventId!=='faux-pn').length;
 assert.equal(p.etat,'finie');
 assert.equal(appelsPendantPasse,0,'la passe ne lit aucune surface de règle métier sur ses captures');
 assert.equal(adapter.zoneInjectee,true);assert.equal(avant,0,'aucun événement de zone produit par la passe (règles métier coupées dans l’essai, seule la fausse zone injectée)');
 const debut=H.evenements(b,'relecture-debut')[0];assert.equal(debut.zonesSource,'lot');
 assert.equal(debut.zones.pn.some(z=>z[0]<=109&&109<=z[1]),false,'aucune zone PN sur 109');
 const ev=H.evenements(b,'relecture-ombre'),e109=ev.find(e=>e.identity.cut===109);
 assert.equal(e109.zone==='pn',false);assert.equal(e109.zoneSource,'lot');assert.notEqual(e109.action,'corrige');
 for(const e of ev)assert.ok(['lot','liste','liste-esv'].includes(e.zoneSource),'origine de zone dite');
 assert.equal(p.corriges,0);assert.equal(adapter.enPlace.length,0);assert.equal(apresLot(b,lot).some(c=>c.action==='apply'),false);
});
