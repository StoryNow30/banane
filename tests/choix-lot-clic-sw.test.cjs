'use strict';
/* 4.9.5 test 6 (D-157, D-164 ; Mic : « essayer les 2 méthodes ») — LE CLIC DU MODE RAPIDE CHOISI DANS LE PANNEAU, SANS CHOIX.
 * Service worker réel en VM (tests/helpers/choix-lot.cjs), chrome.storage.local en mémoire. Sans choix gardé, ou « Comme avant »
 * gardé (règle « grappe de différés » coupée), les commandes envoyées à la page sont celles de la base, octet pour octet
 * (tests/fixtures/choix-lot-50-base.json, prise sur claude/50-base a362a29) ; `apply` part sans option ; le scope du lot est celui
 * d'avant. Le choix vient du stockage, jamais des arguments de « Démarrer ». */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lotClic,neutre,CLE_CLIC,CLE_GRAPPE}=require('./helpers/choix-lot.cjs');
const {GOLDEN,h,versionGolden,j,scopeDe}=require('./helpers/choix-lot-essais.cjs');

test('sans choix (arguments de « Démarrer » trafiqués, ignorés) ou « Comme avant » gardé : mêmes commandes que la base, octet pour octet',async()=>{
 for(const [nom,o] of [['sans choix',{extra:{clicHumain:'tout-recentre',regleGrappeDifferes:true}}],['Comme avant gardé',{choix:{[CLE_CLIC]:'tel-quel',[CLE_GRAPPE]:false}}]]){
  const x=await lotClic(o);
  assert.deepEqual(x.commandes.map(c=>c.action??null),GOLDEN.clic.actions,nom);
  assert.equal(h(versionGolden(neutre(x.commandes))),GOLDEN.clic.empreinteCommandes,nom+' : commandes identiques octet pour octet');
  assert.deepEqual(j(x.options),GOLDEN.clic.applyOptions,nom+' : apply sans option');assert.equal(x.options.length,2);
  assert.equal('clicHumain' in scopeDe(x.b),false,nom);assert.equal('regleGrappeDifferes' in scopeDe(x.b),false,nom);
 }
});
