'use strict';
/* CH-028 — LA CORRECTION DANS SIGNAL (src/ui5.js, src/signal-rendu.js), contre la page minimale (tests/helpers/ui5-page.cjs) : l'onglet « Correction »
 * n'existe que si la vue porte une liste ; l'écran de fin du lot l'annonce ; chaque bouton est un clic sur un déclencheur caché du panneau
 * (`#correction-*`, panel.js) ; le statut de chaque cut est lu dans les visites de la séance Écho marquée. Aucun message nouveau. Données fabriquées. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { monter } = require('./helpers/ui5-page.cjs');
const CL = require('../src/correction-liste.js');
const { journal } = require('./helpers/correction-journal.cjs');
const L = CL.construire(journal(), { partie: 5 });
const LOT = { id: 'B1', state: 'COMPLETED', scope: { part: 5, start: 10, end: 19 }, processed: [], deferred: [] };
const correction = (etat, extra = {}) => ({ id: 'C1', etat, creeA: '2026-10-31T10:05:00Z', listes: [{ batchId: 'B1', partie: 5, entrees: L.entrees, comptes: L.comptes }], ...extra });
const visite = (cut, label, fin = true) => ({ visitId: 'v' + cut, identity: { part: 5, cut }, startedAt: '2026-10-31T10:10:00Z', ...(fin ? { endedAt: '2026-10-31T10:10:09Z' } : {}), label });
const etat = (extra = {}) => ({ batch: LOT, current: { identity: { part: 5, cut: 19 } }, connection: { status: 'ready', tabId: 12 }, native: { status: 'IDLE', visits: [] }, ...extra });
async function page(extra) {
  const p = await monter({ etat: etat(extra) });
  p.els.tabs.options = [{ value: '12', textContent: 'ESV · partie 5' }]; p.els.tabs.value = '12';
  for (const id of ['correction-demarrer', 'correction-ouvrir', 'correction-terminer', 'correction-fermer', 'correction-liste']) p.els[id].disabled = false;
  return p;
}
const html = p => { p.ui.maj(true); return p.hote.innerHTML; };
/* CH-036 : la correction s'appelle « Aurore » partout où l'opérateur lit ; « Ouvrir l'Aurore · N cuts » est l'action pleine de la fin du lot (décision du
 * 01/11) ; l'avancement compte les cuts revus (corrigés, validés tels quels, vus). Les déclencheurs (`#correction-*`) et les actions sont les mêmes. */

test('sans liste dans la vue : l’onglet « Aurore » est là (01/11) mais aucune ligne « Ouvrir l’Aurore » ni « Voir l’Aurore »', async () => {
  const p = await page({});
  const h = html(p);
  assert.match(h, /data-act="sg:onglet-correction">Aurore</);
  assert.doesNotMatch(h, /Ouvrir l’Aurore|Voir l’Aurore|Correction/);
  assert.equal(p.ui.instantane(etat()).correction, null);
});

test('fin du lot : « Aurore » dans le bilan, « Ouvrir l’Aurore · 7 cuts » (toute la liste) et l’onglet « Aurore » dans la bascule', async () => {
  const p = await page({ correction: correction('proposee') });
  const h = html(p);
  assert.match(h, /<dt>Aurore<\/dt><dd><b>7<\/b> cuts à revoir : <b>6<\/b> à corriger, <b>1<\/b> à poser/);
  assert.match(h, /data-act="sg:onglet-correction"[^>]*>.*Ouvrir l’Aurore · 7 cuts</s);
  assert.match(h, /role="tab" aria-selected="false" data-act="sg:onglet-correction">Aurore</);
  assert.deepEqual(p.envoyes, []);
});

test('l’onglet : liste proposée, signaux en clair, « Commencer l’Aurore » clique le déclencheur caché', async () => {
  const p = await page({ correction: correction('proposee') });
  p.ui.agir('sg:onglet-correction');
  const h = p.hote.innerHTML;
  assert.match(h, /role="tab" aria-selected="true"[^>]*>Aurore</);
  assert.match(h, /class="sg-mot">Prête</);
  assert.match(h, /Partie 5 · 6 à corriger, 1 à poser/);
  assert.match(h, /<span class="sg-cut">14<\/span><span class="sg-motif"><span class="sg-sig">posé au rattrapage<\/span><small>· déplacement 38,4 mm<\/small>/);
  assert.match(h, /<span class="sg-cut">15<\/span><span class="sg-motif"><span class="sg-sig">juste après un cut à poser<\/span><small>· posé sans appui<\/small>/);
  assert.match(h, /Section-a-poser|À poser/);
  assert.equal((h.match(/class="sg-statut"[^>]*>à faire</g) || []).length, 7);
  assert.match(h, /data-act="legacy:correction-demarrer"[^>]*>.*Commencer l’Aurore/s);
  assert.match(h, /data-act="legacy:correction-fermer"[^>]*>Fermer la liste/);
  assert.doesNotMatch(h, /data-act="sg:corr-ouvrir/, '« Ouvrir » n’existe qu’en correction ouverte');
  p.ui.agir('legacy:correction-demarrer');
  assert.equal(p.els['correction-demarrer'].clics, 1);
  assert.deepEqual(p.envoyes, []);
});

test('correction ouverte : statuts lus dans les visites d’Écho, « Ouvrir » recopie la cible et clique `#correction-ouvrir`', async () => {
  const native = { status: 'RUNNING', correction: { id: 'C1' }, visits: [visite(14, 'VALIDATE_CORRECTED_BOTH'), visite(15, 'VALIDATE_NO_MOVEMENT'), visite(16, null, false)] };
  const p = await page({ correction: correction('ouverte', { courant: { part: 5, cut: 16 } }), native });
  p.ui.agir('sg:onglet-correction');
  const h = p.hote.innerHTML;
  assert.match(h, /class="sg-mot">En cours</);
  assert.match(h, /Cut <span class="sg-mono">16<\/span> ouvert dans ESV/);
  assert.match(h, /<span class="sg-cut">14<\/span>.*?class="sg-statut" data-statut="corrige">corrigé · 2 rails</s);
  assert.match(h, /<span class="sg-cut">15<\/span>.*?data-statut="valide">validé tel quel</s);
  assert.match(h, /<span class="sg-cut">16<\/span>.*?data-statut="en-cours">ouvert dans ESV</s);
  assert.match(h, /<span class="sg-chiffre">2<\/span><span class="sg-suite">sur 7 revus<\/span>/);
  assert.match(h, /data-act="sg:corr-ouvrir:5:17"[^>]*>.*Suivant · cut 17/s, 'le premier cut à faire après le courant');
  assert.match(h, /data-act="legacy:correction-terminer"[^>]*>Terminer l’Aurore/);
  p.ui.agir('sg:corr-ouvrir:5:18');
  assert.equal(p.els['correction-cible'].value, '5:18'); assert.equal(p.els['correction-ouvrir'].clics, 1);
  assert.deepEqual(p.envoyes, []);
});

test('liste terminée : bilan, « Télécharger la séance Écho » (bouton d’Écho d’origine), « Exporter le dossier »', async () => {
  const native = { status: 'FINISHED', correction: { id: 'C1' }, visits: [visite(14, 'VALIDATE_CORRECTED_BOTH'), visite(15, 'VALIDATE_NO_MOVEMENT'), visite(17, 'PASS_NO_DECISION')] };
  const p = await page({ correction: correction('terminee'), native });
  Object.assign(p.els['native-download'], { hidden: false, textContent: 'Télécharger à nouveau la session' });
  Object.assign(p.els['export-tout'], { hidden: false, textContent: 'Tout exporter' });
  p.ui.agir('sg:onglet-correction');
  const h = p.hote.innerHTML;
  assert.match(h, /class="sg-mot">Terminée</);
  assert.match(h, /Partie 5 · 1 corrigé, 1 validé tel quel, 1 vu sans validation · inscrit dans l’export Orbite/);
  assert.match(h, /data-act="legacy:native-download"[^>]*>.*Télécharger la séance Écho/s);
  assert.match(h, /class="sg-principal" data-act="legacy:export-tout"[^>]*>.*Exporter le dossier/s, 'CH-036 : l’export est l’action pleine');
});

test('CH-037 : une liste d’une autre partie que celle affichée, passage éteint : « Ouvrir » reste actif (jamais muet), la raison viendra du refus', async () => {
  const native = { status: 'RUNNING', correction: { id: 'C1' }, visits: [] };
  const p = await page({ correction: correction('ouverte'), native, current: { identity: { part: 7, cut: 3 } } });
  p.ui.agir('sg:onglet-correction');
  const h = p.hote.innerHTML;
  assert.doesNotMatch(h, /<button type="button" disabled title="[^"]*partie 5/);
  assert.match(h, /data-act="sg:corr-ouvrir:5:\d+" title="Partie 5 : le passage entre parties est éteint ; le clic dit quoi faire">/);
});

test('CH-037 : le refus du passage (réglage éteint) est affiché dans l’onglet Aurore', async () => {
  const native = { status: 'RUNNING', correction: { id: 'C1' }, visits: [] };
  const C = { ...correction('ouverte'), passage: { etat: 'refuse', vers: 5, texte: 'Le cut 12 est dans la partie 5 ; ESV affiche la partie 7. Le passage entre parties est éteint.' } };
  const p = await page({ correction: C, native, current: { identity: { part: 7, cut: 3 } } });
  p.ui.agir('sg:onglet-correction');
  assert.match(p.hote.innerHTML, /<p class="sg-raison" role="status">Le cut 12 est dans la partie 5 ; ESV affiche la partie 7\. Le passage entre parties est éteint\.<\/p>/);
});
