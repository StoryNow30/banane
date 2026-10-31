'use strict';
/* CH-028 — L'ONGLET « Correction » DE SIGNAL, DANS UN VRAI NAVIGATEUR (ignoré s'il n'y a pas de Chromium, et dit ignoré ; découpé en trois fichiers pour tenir sous 20 s chacun : etats, actions, balayage). Montage :
 * tests/helpers/signal-navigateur.cjs (service worker simulé), lot fini de la partie 13 ; liste fabriquée par src/correction-liste.js sur
 * tests/helpers/correction-journal.cjs. Maquette : Figma, page « CH-028 · Correction dans Orbite » (liste proposée, cut ouvert, correction enregistrée,
 * liste terminée). Mesures : 0 erreur de console, 0 débordement de 360 à 600 px, contraste ≥ 4,5:1, sombre et clair ; chaque bouton envoie l'action du
 * déclencheur caché du panneau (`correction-demarrer`, `correction-ouvrir` {part, cut}, `correction-terminer`), et rien qui écrive dans ESV. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { CHROMIUM, PW, absent, ouvrir, SC } = require('./helpers/signal-navigateur.cjs');
const { parLargeurs, poserEtat, verifier } = require('./helpers/signal-file.cjs');
const CL = require('../src/correction-liste.js');
const { journal } = require('./helpers/correction-journal.cjs');

const L = CL.construire(journal({ partie: 13 }), { partie: 13 });
const corr = (etat, extra = {}) => ({ id: 'C1', etat, creeA: '2026-10-31T10:05:00Z', listes: [{ batchId: 'B1', partie: 13, entrees: L.entrees, comptes: L.comptes }], ...extra });
const visite = (cut, label, fin = true) => ({ visitId: 'v' + cut, identity: { part: 13, cut }, startedAt: '2026-10-31T10:10:00Z', ...(fin ? { endedAt: '2026-10-31T10:10:09Z' } : {}), label });
const courant = { identity: { part: 13, cut: 15 } };
const ETATS = {
  proposee: { ...SC.fin, current: courant, correction: corr('proposee') },
  ouvert: { ...SC.fin, current: courant, correction: corr('ouverte', { courant: { part: 13, cut: 15 } }), native: { id: 'n1', status: 'RUNNING', correction: { id: 'C1' }, visits: [visite(14, 'VALIDATE_NO_MOVEMENT'), visite(15, null, false)] } },
  enregistre: { ...SC.fin, current: courant, correction: corr('ouverte', { courant: { part: 13, cut: 15 } }), native: { id: 'n1', status: 'RUNNING', correction: { id: 'C1' }, visits: [visite(14, 'VALIDATE_NO_MOVEMENT'), visite(15, 'VALIDATE_CORRECTED_BOTH'), visite(16, null, false)] } },
  terminee: { ...SC.fin, current: courant, correction: corr('terminee'), native: { id: 'n1', status: 'FINISHED', correction: { id: 'C1' }, visits: [visite(14, 'VALIDATE_NO_MOVEMENT'), visite(15, 'VALIDATE_CORRECTED_BOTH'), visite(17, 'PASS_NO_DECISION')] } },
};
const EXTRA = '.sg-onglet-corr .sg-statut,.sg-onglet-corr .sg-motif,.sg-onglet-corr .sg-cut,.sg-onglet-corr .sg-meta,.sg-onglet-corr .sg-section span,.sg-onglet-corr .sg-suite,.sg-onglet-corr .sg-droite,.sg-onglet-corr .sg-outils button,.sg-bascule button';

async function monter(nav, state) {
  const sig = await ouvrir(nav, state, { width: 600, height: 760 });
  await sig.page.addInitScript(() => { const f = window.chrome.runtime.sendMessage; window.__m = [];
    window.chrome.runtime.sendMessage = async m => { if (/^(correction-|goto-cut|apply|validate|skip)/.test(m.action || '')) window.__m.push(JSON.parse(JSON.stringify(m))); return f(m); }; });
  await sig.page.reload(); await sig.page.waitForTimeout(700);
  return sig;
}
const messages = page => page.evaluate(() => window.__m.splice(0));

test('onglet « Correction » : Commencer, Ouvrir (partie et cut), Terminer envoient les actions des déclencheurs cachés ; rien qui écrive dans ESV', { skip: absent, timeout: 25000 }, async () => {
  const { chromium } = require(PW), nav = await chromium.launch({ executablePath: CHROMIUM });
  try {
    const { page, erreurs } = await monter(nav, ETATS.proposee);
    await page.click('#ui5 .sg-bascule [data-act="sg:onglet-correction"]'); await page.waitForTimeout(200);
    await page.click('#ui5 .sg-onglet-corr [data-act="legacy:correction-demarrer"]'); await page.waitForTimeout(400);
    assert.deepEqual((await messages(page)).map(m => m.action).filter(a => a !== 'correction-liste'), ['correction-demarrer']);
    await poserEtat(page, ETATS.ouvert);
    await page.click('#ui5 .sg-onglet-corr [data-act="sg:corr-ouvrir:13:16"]'); await page.waitForTimeout(400);
    const m = (await messages(page)).filter(x => x.action !== 'correction-liste');
    assert.deepEqual(m.map(x => [x.action, x.args]), [['correction-ouvrir', { part: 13, cut: 16 }]]);
    await page.click('#ui5 .sg-onglet-corr [data-act="legacy:correction-terminer"]'); await page.waitForTimeout(400);
    assert.deepEqual((await messages(page)).map(x => x.action).filter(a => a !== 'correction-liste'), ['correction-terminer']);
    assert.deepEqual(erreurs, []);
  } finally { await nav.close(); }
});

