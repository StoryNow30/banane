'use strict';
/* 5.0 — PN ROBUSTE (fiches/PN_ROBUSTE.md, H6) : LE RÉGLAGE CHANGE L'OMBRE, PAS LES COMMANDES ENVOYÉES À ESV. Service worker réel en VM
 * (tests/helpers/regles-metier-lot.cjs, données synthétiques, lot de 112 à 115). La surface du module est remplacée par une suite
 * fabriquée : 112 cœur de PN, 113 vu sans chaussée, 114 cœur, 115 vu sans chaussée. Avec la règle d'avant (`consecutifs:false`), 112 et
 * 114 (à 2 cuts) confirment un PN au cut 114 ; avec la règle livrée (cœurs consécutifs), 113 les sépare : pas de PN. L'ombre le dit ;
 * la règle `pn-chaque-cut` étant coupée (réglage livré, et lot « grappe » de la test 6), les commandes ESV, les rails, les
 * enregistrements, les événements métier et les décisions du lot restent identiques, octet pour octet. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {lot,neutre,decisions,metier,ombres,deq,rec,S}=require('./helpers/regles-metier-lot.cjs');
const SURF={112:{coeur:true},113:{coeur:false},114:{coeur:true},115:{coeur:false}};
/* Module des règles métier du service worker, avec la surface fabriquée et, si `ref`, la règle d'avant (`consecutifs:false`). */
const monter=ref=>async b=>{const R=b.ctx.BananeReglesMetier,ordre=[112,113,114,115];let k=0;
 const opt=o=>ref?{...(o||{}),pn:{...((o||{}).pn||{}),consecutifs:false}}:o;
 b.ctx.BananeReglesMetier={...R,
  surface:cap=>{const c=Number.isInteger(cap?.identity?.cut)?cap.identity.cut:ordre[Math.min(k,ordre.length-1)];k++;
   const s=SURF[c]||{coeur:false};return {flushPct:s.coeur?95:20,sidePoints:900,quadMin:s.coeur?90:0,quarts:null,coeurPN:s.coeur,advRails:0,advCotes:{}};},
  evaluer:(m,r,o)=>R.evaluer(m,r,opt(o)),noter:(m,r,f,o)=>R.noter(m,r,f,opt(o))};};
const grappe={...S.reglesMetier,actif:true,regles:{...S.reglesMetier.regles,'grappe-differes':true}};
let livre,avant,livreG,avantG;
before(async()=>{
 livre=await lot(undefined,{avant:monter(false)});avant=await lot(undefined,{avant:monter(true)});
 livreG=await lot(grappe,{avant:monter(false)});avantG=await lot(grappe,{avant:monter(true)});
});
const memes=(x,y,quoi)=>{
 deq(neutre(x.b.commands),neutre(y.b.commands),quoi+' : mêmes commandes ESV, même ordre');
 deq(neutre(x.adapter.rails),neutre(y.adapter.rails));deq(x.adapter.calls,y.adapter.calls);
 deq(rec(x.b),rec(y.b));deq(metier(x.b),metier(y.b),quoi+' : mêmes événements métier');
 assert.equal(JSON.stringify(neutre(decisions(x.b))),JSON.stringify(neutre(decisions(y.b))),quoi+' : décisions identiques, octet pour octet');};

test('l\'ombre change : la règle d\'avant confirme un PN au cut 114, la règle livrée non',()=>{
 const a=ombres(avant.b),l=ombres(livre.b),at=(e,c)=>e.find(x=>x.identity.cut===c);
 deq(l.map(x=>x.identity.cut),[112,113,114,115]);deq(a.map(x=>x.identity.cut),[112,113,114,115]);
 assert.equal(at(a,114).zone.pn,'coeur');deq(at(a,114).zone.pnControle,[108,120]);assert.ok(at(a,114).regles.includes('pn-chaque-cut'));
 assert.equal(at(a,115).zone.pn,'marge-apres');
 assert.equal(at(l,114).zone.pn,'coeur-non-confirme');assert.equal(at(l,114).zone.pnControle,undefined);
 for(const x of l)assert.ok(!x.regles.includes('pn-chaque-cut'),'règle livrée : aucun PN, donc aucune règle PN');
 assert.equal(at(l,115).zone.pn,null);
 /* Les seuils du premier événement disent quelle règle a tourné (module livré : cœurs consécutifs). */
 assert.equal(l[0].seuils.pn.consecutifs,true);
});

test('LES COMMANDES ESV NE CHANGENT PAS : réglage livré (règles coupées), avec et sans cœurs consécutifs',()=>{
 memes(livre,avant,'réglage livré');
 /* Le lot a bien différé 112 et 113 et posé 114 et 115 (sinon l'essai ne prouverait rien). */
 deq(decisions(livre.b).map(([c,x])=>[c,x.stage,x.command?.action]),[[112,'deferred','engine'],[113,'deferred','engine'],[114,'first-pass','engine'],[115,'first-pass','engine']]);
});

test('LES COMMANDES ESV NE CHANGENT PAS : lot « grappe » de la test 6 (seule grappe-differes activée), avec et sans cœurs consécutifs',()=>{
 memes(livreG,avantG,'lot grappe');
 /* Ici la grappe diffère 114 et 115 dans les deux cas ; la règle PN, coupée, n'y est pour rien. */
 deq(decisions(livreG.b).map(([c,x])=>[c,x.command?.action]),[[112,'engine'],[113,'engine'],[114,'defer'],[115,'defer']]);
 const e=ombres(avantG.b).find(x=>x.identity.cut===114);deq(e.actif,{applique:true,regles:['grappe-differes']});
});
