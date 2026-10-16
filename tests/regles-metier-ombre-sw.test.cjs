'use strict';
/* 5.0 — ORBITE : L'OMBRE DES RÈGLES MÉTIER DE MIC NE CHANGE RIEN À LA POSE. Service worker réel en VM (montage :
 * tests/helpers/regles-metier-lot.cjs ; moteur et GCV1 réels, ESV simulé, données synthétiques). Réglage livré (ombre active,
 * activation coupée) contre ombre coupée, lot de 112 à 114 : mêmes commandes ESV, mêmes rails, mêmes enregistrements, mêmes
 * événements métier, décisions du lot identiques octet pour octet. Un événement `regles-metier-ombre` par cut, sans position ; au
 * cut 114, posé juste après les différés 112 et 113, l'ombre dit qu'Ariane l'aurait différé (`grappe-differes`) : le lot l'a quand
 * même posé. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {lot,neutre,decisions,metier,ombres,deq,rec,S}=require('./helpers/regles-metier-lot.cjs');
let coupe,ombre;
before(async()=>{coupe=await lot({...S.reglesMetier,ombre:false},{fin:114});ombre=await lot(undefined,{fin:114});});

test('LA POSE NE CHANGE PAS : mêmes commandes ESV, mêmes rails, mêmes enregistrements, mêmes événements métier, décisions identiques octet pour octet',()=>{
 deq(neutre(ombre.b.commands),neutre(coupe.b.commands),'mêmes commandes ESV, même ordre');
 deq(neutre(ombre.adapter.rails),neutre(coupe.adapter.rails));deq(ombre.adapter.calls,coupe.adapter.calls);
 deq(rec(ombre.b),rec(coupe.b));deq(metier(ombre.b),metier(coupe.b),'mêmes événements métier');
 assert.equal(JSON.stringify(neutre(decisions(ombre.b))),JSON.stringify(neutre(decisions(coupe.b))),'décisions du lot identiques, octet pour octet');
 /* Le lot a bien différé 112 et 113 et posé 114 (sinon l'essai ne prouverait rien). */
 deq(decisions(coupe.b).map(([c,x])=>[c,x.command?.action==='defer'?'defer':'pose']),[[112,'defer'],[113,'defer'],[114,'pose']]);
 assert.equal(coupe.adapter.calls.filter(c=>c==='apply').length,1);
});

test('un événement par cut, seulement si l\'ombre est active ; zone, règles, verdict ; jamais de position',()=>{
 assert.equal(ombres(coupe.b).length,0,'ombre coupée : rien');
 const e=ombres(ombre.b);deq(e.map(x=>x.identity.cut),[112,113,114]);
 deq(e.map(x=>x.aurait),['deja-differe','deja-differe','differer']);
 deq(e[2].regles,['grappe-differes']);assert.equal(e[2].zone.grappe.differes,2);assert.equal(e[2].zone.grappe.plusProche,1);
 for(const x of e){assert.equal(x.version,'regles-metier-v1');assert.equal(x.portee,'cut');assert.ok(x.batchId);assert.equal(x.actif,undefined,'activation coupée');
  assert.ok(!/positionSceneRelative|"positions"|bords/.test(JSON.stringify(x)),'aucune position');}
 deq(e[0].seuils,JSON.parse(JSON.stringify(require('../src/regles-metier.js').DEFAULTS)),'seuils au premier événement');assert.equal(e[1].seuils,undefined);
});

test('aucun chemin de pose ne lit le module : seul le service worker l\'appelle, le moteur l\'ignore',()=>{
 const fs=require('node:fs'),path=require('node:path'),racine=path.resolve(__dirname,'..');
 const bg=fs.readFileSync(path.join(racine,'background.js'),'utf8');assert.match(bg,/'src\/regles-metier\.js'/,'chargé par le service worker');
 for(const f of fs.readdirSync(path.join(racine,'src')).filter(x=>x.endsWith('.js')&&x!=='regles-metier.js'&&x!=='settings.js')){
  const t=fs.readFileSync(path.join(racine,'src',f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/BananeReglesMetier|regles-metier|reglesMetier/.test(t),f+' ne lit pas le module');}
});
