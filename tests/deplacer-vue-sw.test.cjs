'use strict';
/* 5.0 — « DÉPLACER LA VUE » DANS LE LOT (background.js) : service worker réel en VM, moteur et GCV1 réels, ESV simulé.
 * Le cut 112 a sa pose de départ à 230 mm de la voie ; sa décision (reprise depuis la voie) tombe hors de la vue du rail
 * gauche (NDC 1,34) : aujourd'hui, le lot le diffère (`guard-hors-vue-left`).
 *  - RÉGLAGE COUPÉ (défaut) : mêmes commandes, octet pour octet, que le code de base (origin/claude/50-base, empreintes dans
 *    tests/fixtures/lot-sans-vue-50-base.json) ; aucune commande de vue, `apply` sans troisième argument.
 *  Le réglage actif est essayé dans tests/deplacer-vue-sw-actif.test.cjs (délai de 20 s par fichier). */
const {test,before}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {lot,neutre,decisions,metier}=require('./helpers/deplacer-vue-lot.cjs'),S=require('../src/settings.js');
const GOLDEN=require('./fixtures/lot-sans-vue-50-base.json');
const h=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
/* L'empreinte de 50-base (2c878f1) a été prise sous la version 4.9.5.4 : chaque `apply` porte `extensionVersion`. Une nouvelle version de test ne
 * change que ce champ ; on le ramène à la version de l'empreinte avant de hacher (rien d'autre n'est neutralisé). */
const VERSION_GOLDEN='4.9.5.4',VERSION=require('../manifest.json').version;
const versionGolden=x=>JSON.parse(JSON.stringify(x).split(`"extensionVersion":"${VERSION}"`).join(`"extensionVersion":"${VERSION_GOLDEN}"`));
const ev=(b,type)=>b.store.events.filter(e=>e.type===type);
let defaut;
before(async()=>{defaut=await lot({});});

test('réglage coupé (défaut) : mêmes commandes, mêmes appels, mêmes décisions que 50-base, octet pour octet',()=>{
 assert.equal(S.deplacerVue.actif,false,'coupé par défaut');
 for(const [nom,x] of [['défaut',defaut]]){
  assert.deepEqual(x.b.commands.map(c=>c.action??null),GOLDEN.actions,nom+' : mêmes actions');
  assert.deepEqual(x.b.commands.map(c=>(c.args||[]).length),GOLDEN.nombreArguments,nom+' : mêmes arguments (apply : 2)');
  assert.equal(h(versionGolden(neutre(x.b.commands))),GOLDEN.empreinteCommandes,nom+' : commandes identiques octet pour octet');
  assert.deepEqual(x.adapter.calls,GOLDEN.appels,nom);assert.deepEqual(x.adapter.applyArgs,GOLDEN.applyArgs,nom+' : apply sans option');
  assert.deepEqual(metier(x.b),GOLDEN.metier,nom+' : mêmes événements');
  assert.equal(h(neutre(decisions(x.b))),GOLDEN.empreinteDecisions,nom+' : décisions identiques');
  assert.equal(ev(x.b,'deplacer-vue').length+ev(x.b,'deplacer-vue-geste').length,0);
  assert.ok(!x.b.commands.some(c=>c.action==='amenerDansLaVue'));
 }
 /* L'essai prouve quelque chose : 112 est bien différé pour la vue. */
 assert.deepEqual(GOLDEN.decisions[1].slice(0,2),[112,'window']);assert.equal(GOLDEN.decisions[1][2].reason,'guard-hors-vue-left');
});

