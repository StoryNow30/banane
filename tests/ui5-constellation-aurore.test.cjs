'use strict';
/* CH-036 — LA CONSTELLATION (file de parties) ET L'AURORE (correction) DANS SIGNAL, d'après le dessin validé par l'opérateur (Figma, page
 * « CH-036 · Constellation et Aurore », décisions du 01/11 : vocabulaire Rattrapage / à poser / Passage / sautés ; « Ouvrir l'Aurore » en action pleine ;
 * départs des parties et motifs visibles d'emblée ; onglets libellés en 360 px). Contre la page minimale (tests/helpers/ui5-page.cjs) : les identifiants
 * internes (`file*`, `correction*`, `sg:onglet-file`, `sg:onglet-correction`) ne changent pas, seuls les libellés que l'opérateur lit changent ; chaque
 * bouton reste un clic sur le bouton d'origine du panneau. Aucun message nouveau. Données fabriquées. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { monter } = require('./helpers/ui5-page.cjs');
const CL = require('../src/correction-liste.js');
const { journal } = require('./helpers/correction-journal.cjs');
const js = x => JSON.parse(JSON.stringify(x));
const ORDRE = ['start-batch', 'resume', 'retry', 'manual-takeover', 'manual-completion', 'close-uncertain', 'pause', 'export-tout', 'new-batch', 'relecture-acquitter', 'relecture-arreter', 'relecture-lancer', 'passe-differes-lancer', 'explicit-skip', 'stop'];
const LOT = { id: 'L1', scope: { part: 13, start: 4800, end: 999999 }, state: 'RUNNING', processed: [], deferred: [], activeIdentity: { part: 13, cut: 4812 } };
const etat = (batch, extra = {}) => ({ batch, current: { identity: { part: 13, cut: 4812 } }, connection: { status: 'ready', tabId: 12 }, native: { status: 'IDLE', visits: [] }, ...extra });
function poser(p, { etatTexte = 'prête', phrase = '', reglage = true, choisi = 2, alerte = '', bilan = [], principal = null, secondaire = null, reprendre = null, lancer = null } = {}) {
  const E = p.els; E['file-parties'].hidden = false;
  E['file-etat'].textContent = etatTexte; E['file-phrase'].textContent = phrase; E['file-reglage'].hidden = !reglage;
  E['file-n'].children = [1, 2, 3, 4, 5, 8].map(n => ({ dataset: { n: String(n) }, disabled: false, clics: 0, click() { this.clics++; }, getAttribute: a => a === 'aria-pressed' ? String(n === choisi) : null }));
  E['file-alerte'].hidden = !alerte; E['file-alerte'].textContent = alerte;
  E['file-bilan'].hidden = !bilan.length; E['file-bilan'].querySelectorAll = s => s === 'li' ? bilan.map(t => ({ textContent: t })) : [];
  for (const [id, t] of [['file-principal', principal], ['file-secondaire', secondaire], ['file-reprendre', reprendre], ['file-lancer', lancer]]) { E[id].hidden = t === null; E[id].textContent = t || ''; E[id].disabled = false; }
}
async function pret(extra) {
  const p = await monter({ etat: etat(null, extra) });
  for (const id of ORDRE) p.els[id].hidden = id !== 'start-batch';
  Object.assign(p.els['start-batch'], { className: 'primary', textContent: 'Démarrer le lot' });
  p.els.tabs.options = [{ value: '12', textContent: 'ESV · partie 13' }]; p.els.tabs.value = '12';
  p.els['lot-bornes'].hidden = true;
  return p;
}
const P13 = { part: 13, rang: 0, issueLot: 'fin-normale', motifs: ['fin-normale'], resume: { poses: 112, differes: 6 }, passe: { issue: 'ombre', ecrits: 0 }, relecture: { issue: 'finie', corriges: 3, faits: 120, mode: 'corriger' }, alertes: [] };

/* ------------------------------------------------------------------ Constellation */
test('bascule : les onglets s’appellent « Constellation » et « Aurore » ; les actions internes ne changent pas', async () => {
  const L = CL.construire(journal(), { partie: 5 });
  const C = { id: 'C1', etat: 'proposee', listes: [{ batchId: 'B1', partie: 5, entrees: L.entrees, comptes: L.comptes }] };
  const p = await pret({ fileParties: null, correction: C }); poser(p, { principal: 'Préparer la file', lancer: 'Lancer la file · 2 parties' });
  p.ui.maj(true); const h = p.hote.innerHTML;
  assert.match(h, /role="tab" aria-selected="false" data-act="sg:onglet-file">Constellation</);
  assert.match(h, /role="tab" aria-selected="false" data-act="sg:onglet-correction">Aurore</);
  assert.doesNotMatch(h, />File<|>Correction</);
});

test('Constellation prête : étoiles du plan (la partie affichée, puis les suivantes), « Lancer la Constellation · 3 parties », départs visibles', async () => {
  const p = await pret({ fileParties: null }); poser(p, { principal: 'Préparer la file', lancer: 'Lancer la file · 3 parties', choisi: 3 });
  p.ui.agir('sg:onglet-file'); const h = p.hote.innerHTML;
  assert.match(h, /class="sg-mot">Prête</);
  assert.equal((h.match(/class="sg-etoile" data-etat="a-venir"/g) || []).length, 3);
  assert.match(h, /data-etat="a-venir"[^>]*>.*?<span class="sg-mono">13<\/span>/s);
  assert.match(h, /class="sg-principal" data-act="legacy:file-lancer"[^>]*>.*Lancer la Constellation · 3 parties/s);
  assert.match(h, /aria-label="Départs des parties"/, 'les départs restent visibles d’emblée (décision du 01/11)');
  assert.doesNotMatch(h, /\bla file\b|File de parties/);
  p.ui.agir('legacy:file-lancer'); assert.equal(p.els['file-lancer'].clics, 1); assert.deepEqual(js(p.envoyes), []);
});

test('Constellation en cours : l’étoile vivante, les quatre temps (Rattrapage, Passage), « Arrêter la Constellation », bilan et motifs en clair', async () => {
  const F = { etat: 'passe', n: 3, rang: 1, plan: [13, 14, 15], enCours: { part: 14, rang: 1 }, changement: null, bilan: [P13], alerte: null, motifFin: null };
  const p = await pret({ fileParties: F }); poser(p, { etatTexte: 'partie 2 sur 3', phrase: 'Partie 14 · deuxième passe.', reglage: false, secondaire: 'Arrêter la file' });
  p.rendu(etat({ ...LOT, state: 'COMPLETED', activeIdentity: null }, { fileParties: F })); p.ui.agir('sg:onglet-file'); const h = p.hote.innerHTML;
  assert.match(h, /class="sg-etoile" data-etat="faite"[^>]*>.*?13<\/span><small>112 posés<\/small>/s);
  assert.match(h, /class="sg-etoile" data-etat="en-cours"[^>]*>.*?14<\/span>/s);
  assert.match(h, /class="sg-etoile" data-etat="a-venir"[^>]*>.*?15<\/span>/s);
  assert.match(h, /<li data-temps="fait">Pose<\/li><li data-temps="courant" aria-current="step">Rattrapage<\/li><li data-temps="a-venir">Relecture<\/li><li data-temps="a-venir">Passage<\/li>/);
  assert.match(h, /data-act="legacy:file-secondaire"[^>]*>Arrêter la Constellation</);
  assert.match(h, /Partie 13<\/b>.*?112 posés · 6 à poser · 3 corrigés/s);
  assert.match(h, /class="sg-of-motifs">fin normale · rattrapage en ombre, rien d’écrit · relecture finie</);
  assert.doesNotMatch(h, /deuxième passe|différés/, 'mots de l’opérateur (décision du 01/11)');
});

test('Constellation arrêtée : la raison, l’étoile à reprendre, « Reprendre à la partie 14 · 1 restante » (clic de `#file-reprendre`)', async () => {
  const F = { etat: 'arret', n: 2, rang: 1, plan: [13, 14], enCours: null, changement: null, bilan: [P13], reprise: { rang: 1, part: 14, reste: 1 },
    alerte: { texte: 'la page d’ESV ne change pas de partie' }, motifFin: { code: 'changement-impossible', texte: 'la page d’ESV ne change pas de partie' } };
  const p = await pret({ fileParties: F });
  poser(p, { etatTexte: 'arrêtée', phrase: 'la page d’ESV ne change pas de partie · 1 partie faite sur 2 · rien exporté.', reglage: false, alerte: 'la page d’ESV ne change pas de partie.',
    bilan: ['Partie 13 · …'], principal: 'Préparer la reprise · 1 partie restante', reprendre: 'Reprendre la file · 1 partie restante', lancer: 'Nouvelle file · 2 parties' });
  p.rendu(etat({ ...LOT, state: 'COMPLETED', activeIdentity: null }, { fileParties: F })); p.ui.agir('sg:onglet-file'); const h = p.hote.innerHTML;
  assert.match(h, /class="sg-mot">Arrêtée</);
  assert.match(h, /role="alert"[^>]*>.*la page d’ESV ne change pas de partie/s);
  assert.match(h, /class="sg-etoile" data-etat="interrompue"[^>]*>.*?14<\/span><small>à reprendre<\/small>/s);
  assert.match(h, /class="sg-principal" data-act="legacy:file-reprendre"[^>]*>.*Reprendre à la partie 14 · 1 restante/s);
  assert.match(h, /data-act="legacy:file-lancer"[^>]*>.*Nouvelle Constellation · 2 parties/s);
  p.ui.agir('legacy:file-reprendre'); assert.equal(p.els['file-reprendre'].clics, 1);
});

test('Orbite, fin d’une Constellation : « Constellation terminée », « Ouvrir l’Aurore · N cuts » en action pleine', async () => {
  const L = CL.construire(journal(), { partie: 5 });
  const C = { id: 'C1', etat: 'proposee', listes: [{ batchId: 'B1', partie: 5, entrees: L.entrees, comptes: L.comptes }] };
  const F = { etat: 'fin', n: 1, rang: 1, plan: [13], enCours: null, changement: null, bilan: [P13], alerte: null, motifFin: null };
  const p = await pret({ fileParties: F, correction: C });
  poser(p, { etatTexte: 'terminée', phrase: '1 partie faite · la file s’est éteinte. Export : prêt, jamais automatique.', reglage: false, bilan: ['Partie 13 · …'], principal: 'Fermer le bilan', lancer: 'Relancer une file · 2 parties' });
  p.els['export-tout'].hidden = false; p.els['export-tout'].textContent = 'Exporter';
  p.rendu(etat({ ...LOT, state: 'COMPLETED', activeIdentity: null }, { fileParties: F, correction: C })); const h = p.hote.innerHTML;
  assert.match(h, /class="sg-mot">Constellation terminée</);
  assert.match(h, /class="sg-principal"[^>]*data-act="sg:onglet-correction"[^>]*>.*Ouvrir l’Aurore · 7 cuts/s);
  assert.match(h, /la Constellation s’est éteinte/);
  assert.match(h, /data-act="sg:onglet-file">Voir la Constellation</);
});

/* ------------------------------------------------------------------ Aurore */
const L5 = CL.construire(journal(), { partie: 5 });
const correction = (etat, extra = {}) => ({ id: 'C1', etat, listes: [{ batchId: 'B1', partie: 5, entrees: L5.entrees, comptes: L5.comptes }], ...extra });
const visite = (cut, label, fin = true) => ({ visitId: 'v' + cut, identity: { part: 5, cut }, startedAt: '2026-10-31T10:10:00Z', ...(fin ? { endedAt: '2026-10-31T10:10:09Z' } : {}), label });
const LOT5 = { id: 'B1', state: 'COMPLETED', scope: { part: 5, start: 10, end: 19 }, processed: [], deferred: [] };
const etat5 = (extra = {}) => ({ batch: LOT5, current: { identity: { part: 5, cut: 19 } }, connection: { status: 'ready', tabId: 12 }, native: { status: 'IDLE', visits: [] }, ...extra });
async function aurore(extra) {
  const p = await monter({ etat: etat5(extra) });
  p.els.tabs.options = [{ value: '12', textContent: 'ESV · partie 5' }]; p.els.tabs.value = '12';
  for (const id of ['correction-demarrer', 'correction-ouvrir', 'correction-terminer', 'correction-fermer', 'correction-liste']) p.els[id].disabled = false;
  return p;
}

test('Orbite, fin du lot : la ligne « Aurore » au bilan et « Ouvrir l’Aurore · 7 cuts » en action pleine', async () => {
  const p = await aurore({ correction: correction('proposee') });
  p.ui.maj(true); const h = p.hote.innerHTML;
  assert.match(h, /<dt>Aurore<\/dt><dd><b>7<\/b> cuts à revoir : <b>6<\/b> à corriger, <b>1<\/b> à poser/);
  assert.match(h, /class="sg-principal"[^>]*data-act="sg:onglet-correction"[^>]*>.*Ouvrir l’Aurore · 7 cuts/s);
});

test('Aurore proposée : « Prête », l’horizon (0 sur 7 revus), la partie, les raisons en mots de l’opérateur, « Commencer l’Aurore »', async () => {
  const p = await aurore({ correction: correction('proposee') });
  p.ui.agir('sg:onglet-correction'); const h = p.hote.innerHTML;
  assert.match(h, /class="sg-mot">Prête</);
  assert.match(h, /<span class="sg-chiffre">0<\/span><span class="sg-suite">sur 7 revus<\/span>/);
  assert.match(h, /class="sg-aube"[^>]*>.*?data-partie="5"/s);
  assert.match(h, /class="sg-corr-partie"[^>]*>.*?Partie 5<\/b>.*?0 sur 7/s);
  assert.match(h, /<span class="sg-cut">14<\/span><span class="sg-motif"><span class="sg-sig">posé au rattrapage<\/span>/);
  assert.match(h, /<span class="sg-cut">15<\/span><span class="sg-motif"><span class="sg-sig">juste après un cut à poser<\/span>/);
  assert.match(h, /data-act="legacy:correction-demarrer"[^>]*>.*Commencer l’Aurore/s);
  assert.doesNotMatch(h, /deuxième passe|différé/);
});

test('Aurore ouverte : le cut ouvert, « Suivant · cut 17 », « Terminer l’Aurore »', async () => {
  const native = { status: 'RUNNING', correction: { id: 'C1' }, visits: [visite(14, 'VALIDATE_CORRECTED_BOTH'), visite(15, 'VALIDATE_NO_MOVEMENT'), visite(16, null, false)] };
  const p = await aurore({ correction: correction('ouverte', { courant: { part: 5, cut: 16 } }), native });
  p.ui.agir('sg:onglet-correction'); const h = p.hote.innerHTML;
  assert.match(h, /class="sg-mot">En cours</);
  assert.match(h, /<span class="sg-chiffre">2<\/span><span class="sg-suite">sur 7 revus<\/span>/);
  assert.match(h, /data-act="sg:corr-ouvrir:5:17"[^>]*>.*Suivant · cut 17/s);
  assert.match(h, /data-act="legacy:correction-terminer"[^>]*>Terminer l’Aurore/);
});

test('autre partie, traversée éteinte (4.9.5.29) : « Ouvrir » grisé avec la raison, la phrase dit d’ouvrir la partie dans ESV', async () => {
  const native = { status: 'RUNNING', correction: { id: 'C1' }, visits: [] };
  const p = await aurore({ correction: correction('ouverte'), native, current: { identity: { part: 7, cut: 3 } } });
  p.ui.agir('sg:onglet-correction'); const h = p.hote.innerHTML;
  assert.match(h, /<button type="button" disabled title="Ouvre la partie 5 dans ESV pour corriger ce cut">/);
  assert.match(h, /ouvre la partie 5 dans ESV pour continuer/);
  assert.doesNotMatch(h, /Passer à la partie/);
});

/* Depuis la fusion de CH-035 : `passage` est dérivé par src/ui5.js de la vue du service worker (`changement` en cours, ou `passage` refusé). */
test('autre partie, traversée allumée (CH-035, `entreParties`) : « Passer à la partie 5 · cut 13 » (le parcours de CH-035 : cuts par numéro croissant) ; passage en cours : écran verrouillé', async () => {
  const native = { status: 'RUNNING', correction: { id: 'C1' }, visits: [] };
  const p = await aurore({ correction: correction('ouverte', { entreParties: true }), native, current: { identity: { part: 7, cut: 3 } } });
  p.ui.agir('sg:onglet-correction'); let h = p.hote.innerHTML;
  assert.match(h, /class="sg-principal" data-act="sg:corr-ouvrir:5:13"[^>]*>.*Passer à la partie 5 · cut 13/s);
  assert.match(h, /data-act="sg:corr-ouvrir:5:15"/, '« Ouvrir » sert aussi pour une autre partie');
  p.rendu(etat5({ correction: correction('ouverte', { entreParties: true, changement: { vers: 5 } }), native, current: { identity: { part: 7, cut: 3 } } }));
  h = p.hote.innerHTML;
  assert.match(h, /class="sg-mot">Passage</); assert.match(h, /Vers la partie <span class="sg-mono">5<\/span>/);
  assert.doesNotMatch(h, /data-act="sg:corr-ouvrir/);
  p.rendu(etat5({ correction: correction('ouverte', { entreParties: true, passage: { etat: 'refuse', vers: 5, texte: 'ESV n’a pas changé de partie' } }), native, current: { identity: { part: 7, cut: 3 } } }));
  assert.match(p.hote.innerHTML, /role="status"[^>]*>ESV n’a pas changé de partie</);
});

test('Aurore terminée : « Terminée », bilan par partie, « Exporter le dossier » en action pleine, « Télécharger la séance Écho »', async () => {
  const native = { status: 'FINISHED', correction: { id: 'C1' }, visits: [visite(14, 'VALIDATE_CORRECTED_BOTH'), visite(15, 'VALIDATE_NO_MOVEMENT'), visite(17, 'PASS_NO_DECISION')] };
  const p = await aurore({ correction: correction('terminee'), native });
  Object.assign(p.els['native-download'], { hidden: false, textContent: 'Télécharger à nouveau la session' });
  Object.assign(p.els['export-tout'], { hidden: false, textContent: 'Tout exporter' });
  p.ui.agir('sg:onglet-correction'); const h = p.hote.innerHTML;
  assert.match(h, /class="sg-mot">Terminée</);
  assert.match(h, /class="sg-principal" data-act="legacy:export-tout"[^>]*>.*Exporter le dossier/s);
  assert.match(h, /data-act="legacy:native-download"[^>]*>Télécharger la séance Écho/);
  assert.match(h, /Partie 5<\/b>.*?1 corrigé · 1 validé tel quel · 1 vu sans validation/s);
});

test('Aurore sans liste : le 4e onglet est toujours là et dit ce qui le remplit (remarque de l’opérateur, 01/11)', async () => {
  const p = await pret({ fileParties: null, correction: null }); poser(p, { principal: 'Préparer la file', lancer: 'Lancer la file · 2 parties' });
  p.ui.maj(true); let h = p.hote.innerHTML;
  assert.match(h, /data-onglets="4"/);
  assert.match(h, /role="tab" aria-selected="false" data-act="sg:onglet-correction">Aurore</);
  p.ui.agir('sg:onglet-correction'); h = p.hote.innerHTML;
  assert.match(h, /role="tab" aria-selected="true">Aurore</);
  assert.match(h, /Pas encore de liste à reprendre/);
  assert.match(h, /data-activite="correction" data-etat="vide"/);
});
