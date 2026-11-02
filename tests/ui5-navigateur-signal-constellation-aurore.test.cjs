'use strict';
/* CH-036 — LA CONSTELLATION ET L'AURORE DANS UN VRAI NAVIGATEUR (ignoré s'il n'y a pas de Chromium, et dit ignoré). Maquette : Figma, page
 * « CH-036 · Constellation et Aurore », validée par l'opérateur le 01/11 (départs et motifs visibles d'emblée ; en 360 px, les quatre onglets gardent leur
 * libellé, sur leur propre rang sous la barre). Montage : tests/helpers/signal-navigateur.cjs (service worker simulé). Mesures, de 360 à 600 px puis en
 * clair : 0 erreur de console, rien qui déborde (barre comprise), contraste ≥ 4,5:1 sur les textes nouveaux ; en compact, la bascule est sous la barre et
 * aucun libellé d'onglet n'est coupé. La barre est mesurée par ses enfants directs et ses onglets : le nom de l'onglet ESV dans la puce se rogne (points
 * de suspension), c'est voulu. Données fabriquées. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { CHROMIUM, PW, absent, ouvrir, SC } = require('./helpers/signal-navigateur.cjs');
const { poserEtat } = require('./helpers/signal-file.cjs');
const CL = require('../src/correction-liste.js');
const { journal } = require('./helpers/correction-journal.cjs');

const partie = (part, rang, poses, differes, corriges, motifs = ['fin-normale']) => ({ part, rang, issueLot: 'fin-normale', motifs, resume: { poses, differes }, passe: { issue: 'ombre', ecrits: 0 }, relecture: { issue: 'finie', corriges }, alertes: [] });
const vue = (etat, o = {}) => ({ id: 'file-1', etat, n: 3, plan: [13, 14, 15], rang: 0, enCours: null, changement: null, bilan: [], motifFin: null, alerte: null, reprises: 0, ...o });
const P13 = partie(13, 0, 112, 6, 3), P14 = partie(14, 1, 98, 4, 2), P15 = partie(15, 2, 131, 9, 5, ['nombre-atteint']);
const L13 = CL.construire(journal({ partie: 13, lot: 'B1' }), { partie: 13 }), L14 = CL.construire(journal({ partie: 14, lot: 'B2' }), { partie: 14 });
const corr = (etat, extra = {}) => ({ id: 'C1', etat, listes: [{ batchId: 'B1', partie: 13, entrees: L13.entrees, comptes: L13.comptes }, { batchId: 'B2', partie: 14, entrees: L14.entrees, comptes: L14.comptes }], ...extra });
const visite = (part, cut, label, fin = true) => ({ visitId: `v${part}-${cut}`, identity: { part, cut }, startedAt: '2026-10-31T10:10:00Z', ...(fin ? { endedAt: '2026-10-31T10:10:09Z' } : {}), label });
const CONSTELLATION = {
  passe: { ...SC.fin, passeDifferes: { etat: 'ecriture', mode: 'ecriture', lotId: 'lot-1', cut: 4813, ecrites: 1, demandees: 3 }, fileParties: vue('passe', { rang: 1, enCours: { part: 14, rang: 1, lot: true }, bilan: [P13] }) },
  arret: { ...SC.fin, fileParties: vue('arret', { rang: 1, bilan: [P13], motifFin: { code: 'changement-impossible', texte: 'la page d’ESV ne change pas de partie' },
    alerte: { code: 'changement-impossible', texte: 'la page d’ESV ne change pas de partie', detail: '60 s sans la partie 14', part: 13 }, reprise: { rang: 1, part: 14, reste: 2 } }) },
  fin: { ...SC.fin, fileParties: vue('fin', { rang: 3, bilan: [P13, P14, P15] }), correction: corr('proposee') },
};
const AURORE = {
  proposee: { ...SC.fin, current: { identity: { part: 13, cut: 15 } }, correction: corr('proposee') },
  ouverte: { ...SC.fin, current: { identity: { part: 13, cut: 15 } }, correction: corr('ouverte', { entreParties: true, courant: { part: 13, cut: 15 } }),
    native: { id: 'n1', status: 'RUNNING', correction: { id: 'C1' }, visits: [visite(13, 14, 'VALIDATE_NO_MOVEMENT'), visite(13, 15, null, false)] } },
};
const TEXTES = '.sg-mot,.sg-phrase,.sg-actions button,.sg-etoile small,.sg-etoile .sg-mono,.sg-temps li,.sg-of-t span,.sg-of-l span,.sg-of-l b,.sg-of-motifs,.sg-of-departs th,.sg-of-departs td,.sg-meta,.sg-corr-partie span,.sg-corr-partie b,.sg-aube small,.sg-suite,.sg-statut,.sg-sig,.sg-bascule button,.sg-incident p';
const LARGEURS = [600, 560, 520, 480, 440, 400, 360];

function mesurer(page) {
  return page.evaluate(sel => {
    const h = document.getElementById('ui5'), f = h.querySelector('.sg-fen'), W = document.documentElement.clientWidth;
    const rgb = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const lum = ({ r, g, b }) => { const t = x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }; return .2126 * t(r) + .7152 * t(g) + .0722 * t(b); };
    const fond = e => { const pile = []; for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } }
      let r = pile.pop() || { r: 0, g: 0, b: 0, a: 1 }; while (pile.length) { const c = pile.pop(); r = { r: c.r * c.a + r.r * (1 - c.a), g: c.g * c.a + r.g * (1 - c.a), b: c.b * c.a + r.b * (1 - c.a), a: 1 }; } return r; };
    const contraste = e => { const c = rgb(getComputedStyle(e).color), b = fond(e); if (!c) return 21; const k = { r: c.r * c.a + b.r * (1 - c.a), g: c.g * c.a + b.g * (1 - c.a), b: c.b * c.a + b.b * (1 - c.a) }; const [l1, l2] = [lum(k), lum(b)].sort((a, b) => b - a); return (l1 + .05) / (l2 + .05); };
    const vus = [...h.querySelectorAll(sel)].filter(e => e.getClientRects().length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && !e.disabled && !e.closest('[disabled]'));
    const faibles = vus.map(e => ({ t: e.textContent.trim().slice(0, 40), c: Math.round(contraste(e) * 100) / 100 })).filter(x => x.c < 4.5);
    const sortants = [...h.querySelectorAll('.sg-barre > *,.sg-bascule button,.sg-instrument *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > W + 1; }).map(e => e.className?.baseVal ?? e.className ?? e.tagName);
    const ba = h.querySelector('.sg-bascule'), pu = h.querySelector('.sg-puce');
    const coupes = [...ba.querySelectorAll('button')].filter(b => b.scrollWidth > b.clientWidth + 1 || !b.textContent.trim()).map(b => b.textContent);
    return { W, mot: f.querySelector('.sg-mot')?.textContent, deborde: f.scrollWidth > f.clientWidth + 1, sortants, faibles, coupes, onglets: [...ba.querySelectorAll('button')].map(b => b.textContent),
      basculeSous: ba.getBoundingClientRect().top >= pu.getBoundingClientRect().bottom - 1, compact: h.dataset.taille === 'compact' };
  }, TEXTES);
}
async function balayer(page, nom, res) {
  for (const w of LARGEURS) { await page.setViewportSize({ width: w, height: 640 }); await page.waitForTimeout(120); res[`${nom} ${w}`] = await mesurer(page); }
  await page.setViewportSize({ width: 600, height: 760 }); await page.evaluate(() => window.ArianeUi5.agir('sg:choix:theme:clair'));
  await page.waitForFunction(() => document.getElementById('ui5').dataset.theme === 'clair', null, { timeout: 2500 }); await page.waitForTimeout(100);
  res[`${nom} clair 600`] = await mesurer(page);
  await page.setViewportSize({ width: 360, height: 640 }); await page.waitForTimeout(120); res[`${nom} clair 360`] = await mesurer(page);
  await page.evaluate(() => window.ArianeUi5.agir('sg:choix:theme:sombre')); await page.waitForFunction(() => document.getElementById('ui5').dataset.theme === 'sombre', null, { timeout: 2500 });
  await page.setViewportSize({ width: 600, height: 760 });
}
function verifier(res) {
  for (const [k, r] of Object.entries(res)) {
    assert.equal(r.deborde, false, `${k} : rien ne déborde`); assert.deepEqual(r.sortants, [], `${k} : aucun élément ne sort à droite (barre comprise)`);
    assert.deepEqual(r.faibles, [], `${k} : contraste d’au moins 4,5:1`); assert.deepEqual(r.coupes, [], `${k} : aucun libellé d’onglet coupé`);
    if (r.compact) assert.equal(r.basculeSous, true, `${k} : en compact, la bascule a son propre rang sous la barre`);
  }
}

test('Constellation : en cours (rattrapage), arrêtée, terminée ; 360 à 600 et clair ; onglets libellés ; ni débordement, ni contraste faible, ni erreur', { skip: absent, timeout: 19000 }, async () => {
  const { chromium } = require(PW), nav = await chromium.launch({ executablePath: CHROMIUM }), res = {}, vus = {};
  try {
    const { page, erreurs } = await ouvrir(nav, CONSTELLATION.passe, { width: 600, height: 760 });
    await page.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]'); await page.waitForTimeout(200);
    for (const nom of ['passe', 'arret', 'fin']) {
      if (nom !== 'passe') await poserEtat(page, CONSTELLATION[nom]);
      vus[nom] = await page.evaluate(() => { const h = document.getElementById('ui5');
        return { etoiles: [...h.querySelectorAll('.sg-etoile')].map(e => e.dataset.etat + ':' + e.querySelector('.sg-mono').textContent), temps: h.querySelector('.sg-temps [aria-current]')?.textContent || '',
          motifs: [...h.querySelectorAll('.sg-of-motifs')].map(e => e.textContent), titres: [...h.querySelectorAll('.sg-of-t span:first-child')].map(e => e.textContent), principal: h.querySelector('.sg-principal')?.textContent.trim() || '' }; });
      await balayer(page, nom, res);
    }
    assert.deepEqual(erreurs, []);
  } finally { await nav.close(); }
  verifier(res);
  assert.deepEqual(res['passe 600'].onglets, ['Orbite', 'Écho', 'Constellation', 'Aurore']);
  assert.deepEqual(res['fin 360'].onglets, ['Orbite', 'Écho', 'Constellation', 'Aurore']);
  assert.deepEqual(vus.passe.etoiles, ['faite:13', 'en-cours:14', 'a-venir:15']); assert.equal(vus.passe.temps, 'Rattrapage');
  assert.deepEqual(vus.passe.motifs, ['fin normale · rattrapage en ombre, rien d’écrit · relecture finie']);
  assert.deepEqual(vus.arret.etoiles, ['faite:13', 'interrompue:14', 'a-venir:15']); assert.match(vus.arret.principal, /Reprendre à la partie 14 · 2 restantes/);
  assert.deepEqual(vus.fin.titres, ['Bilan par partie', 'Départs des parties'], 'bilan et départs visibles d’emblée');
  assert.match(vus.fin.principal, /Ouvrir l’Aurore · \d+ cuts/);
});

test('Aurore : proposée puis ouverte sur deux parties (traversée allumée) ; 360 à 600 et clair ; ni débordement, ni contraste faible, ni erreur', { skip: absent, timeout: 19000 }, async () => {
  const { chromium } = require(PW), nav = await chromium.launch({ executablePath: CHROMIUM }), res = {}, vus = {};
  try {
    const { page, erreurs } = await ouvrir(nav, AURORE.proposee, { width: 600, height: 760 });
    await page.click('#ui5 .sg-bascule [data-act="sg:onglet-correction"]'); await page.waitForTimeout(200);
    for (const nom of ['proposee', 'ouverte']) {
      if (nom !== 'proposee') await poserEtat(page, AURORE[nom]);
      vus[nom] = await page.evaluate(() => { const h = document.getElementById('ui5');
        return { parties: [...h.querySelectorAll('.sg-corr-partie')].map(e => e.textContent), aube: [...h.querySelectorAll('.sg-aube > span')].map(e => e.dataset.partie), principal: h.querySelector('.sg-principal')?.textContent.trim() || '',
          ouvrir14: !!h.querySelector('[data-act^="sg:corr-ouvrir:14:"]') }; });
      await balayer(page, nom, res);
    }
    assert.deepEqual(erreurs, []);
  } finally { await nav.close(); }
  verifier(res);
  assert.deepEqual(vus.proposee.aube, ['13', '14']); assert.equal(vus.proposee.parties.length, 2); assert.match(vus.proposee.principal, /Commencer l’Aurore/);
  assert.match(vus.ouverte.principal, /Suivant · cut \d+/); assert.equal(vus.ouverte.ouvrir14, true, 'traversée allumée : « Ouvrir » sert aussi pour la partie 14');
});
