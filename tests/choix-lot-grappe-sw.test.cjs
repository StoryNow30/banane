'use strict';
/* 4.9.5 test 6 (D-164, demande de Mic) — L'INTERRUPTEUR « GRAPPE DE DIFFÉRÉS » DU PANNEAU : COUPÉ, ET CHANGÉ EN COURS DE LOT.
 * (L'interrupteur activé : tests/choix-lot-grappe-actif-sw.test.cjs.) Service worker réel en VM
 * (tests/helpers/regles-metier-lot.cjs : cuts 112 et 113 sans point, différés ; 114 et 115 posés juste après la grappe),
 * chrome.storage.local en mémoire.
 *  - Coupé (défaut, ou rien de gardé) : commandes identiques à la base, octet pour octet (tests/fixtures/choix-lot-50-base.json).
 *  - Activé : le chemin d'activation existant s'ouvre pour `grappe-differes` SEULEMENT, exactement comme le réglage
 *    `reglesMetier.actif` + `regles['grappe-differes']` : des validations deviennent des différés, sans aucune pose nouvelle ni
 *    type d'appel nouveau ; `pn-chaque-cut` et `zone-validation-en-place` restent coupées.
 *  - Lu au démarrage du lot et figé : un changement pendant le lot attend le lot suivant.
 *  - Consigné : `regleGrappeDifferes:true` dans le scope du lot (`batch-started`, état exporté) ; chaque cut mis en attente par la
 *    règle : son événement `regles-metier-ombre` (`actif:{applique:true,regles:['grappe-differes']}`) et le motif `regles-metier`. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {lot,neutre,decisions,ombres}=require('./helpers/regles-metier-lot.cjs');
const {memoire}=require('./helpers/perf-production.cjs');
const GOLDEN=require('./fixtures/choix-lot-50-base.json');
const h=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const VERSION=require('../manifest.json').version;
const versionGolden=x=>JSON.parse(JSON.stringify(x).split(`"extensionVersion":"${VERSION}"`).join(`"extensionVersion":"${GOLDEN.version}"`));
const garder=(choix,pendant=null)=>async b=>{const local=memoire();Object.assign(local.m,choix);b.ctx.chrome.storage.local=local;b.local=local;
 if(pendant){const capture=b.adapter.capture.bind(b.adapter);let fait=false;
  b.adapter.capture=async(...a)=>{if(!fait){fait=true;await pendant(b);}return capture(...a);};}};
const scope=b=>b.get('engine').s.batch.scope;
/* Chaque lot est joué à la première demande (deux lots par fichier : loin de la limite de 20 s du banc). */
const memo=f=>{let p=null;return ()=>p||(p=f());};
const L={livre:memo(()=>lot(undefined)),
 change:memo(()=>lot(undefined,{avant:garder({},async b=>{await b.api('choix-lot',{regleGrappeDifferes:true});})}))};

test('coupé (défaut) : mêmes appels et mêmes commandes que la base, octet pour octet ; scope inchangé',async()=>{
 const livre=await L.livre();
 for(const [nom,x] of [['rien de gardé',livre]]){
  assert.deepEqual(x.adapter.calls,GOLDEN.grappe.appels,nom);
  assert.equal(h(versionGolden(neutre(x.b.commands))),GOLDEN.grappe.empreinteCommandes,nom+' : commandes identiques octet pour octet');
  assert.equal('regleGrappeDifferes' in scope(x.b),false,nom);
  assert.ok(!ombres(x.b).some(e=>e.actif),nom+' : aucune règle appliquée');
 }
});

test('changé pendant le lot : le lot reste coupé jusqu\'à sa fin ; le choix est gardé pour le lot suivant',async()=>{
 const livre=await L.livre(),change=await L.change();
 assert.deepEqual(change.adapter.calls,livre.adapter.calls,'le lot garde son réglage');
 assert.equal(JSON.stringify(neutre(decisions(change.b))),JSON.stringify(neutre(decisions(livre.b))));
 assert.equal('regleGrappeDifferes' in scope(change.b),false);assert.equal(change.b.local.m.banane50GrappeDifferes,true);
 assert.deepEqual(JSON.parse(JSON.stringify(await change.b.api('choix-lot-etat'))),{clicHumain:'tel-quel',regleGrappeDifferes:true});
});
