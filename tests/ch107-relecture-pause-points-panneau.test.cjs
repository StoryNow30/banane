'use strict';
/* CH-107 — LE PANNEAU DIT LA PAUSE « POINTS » EN CLAIR (src/relecture-pause.js, `vue`, fonction pure) : ESV n'affiche plus les points, la relecture est
 * gardée en pause au premier cut vide de la série ; « Reprendre la relecture » et « Arrêter la relecture » comme pour les autres pauses. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src/relecture-pause.js'),'utf8'),ctx);
const P=ctx.ArianeRelecturePause,js=x=>JSON.parse(JSON.stringify(x));
const ETAT=p=>({choix:'corriger',lot:null,passe:{lotId:'L1',etat:'en-pause',faits:3,total:7,cut:113,reprise:true,pauseDemandee:false,expire:null,...p},repriseReglage:{actif:true,f5:'pause'}});

test('pause « points » : la ligne dit qu’ESV n’affiche plus les points ; Reprendre (au cut) et Arrêter offerts ; ESV muet : Reprendre grisée',()=>{
 const v=js(P.vue(ETAT({pauseRaison:'points'})));
 assert.equal(v.ligne,'ESV n’affiche plus les points : relecture gardée en pause au cut 113 · 3 cuts relus sur 7.');
 assert.deepEqual(v.reprendre,{texte:'Reprendre la relecture au cut 113',actif:true,raison:''});assert.equal(v.arreter,true);assert.equal(v.pause,null);
 assert.equal(js(P.vue(ETAT({pauseRaison:'points'}),{esvMuet:true})).reprendre.actif,false);
 /* Les autres raisons ne changent pas. */
 assert.equal(P.vue(ETAT({pauseRaison:'signal'})).ligne,'Relecture en pause au cut 113 · 3 cuts relus sur 7.');
});
