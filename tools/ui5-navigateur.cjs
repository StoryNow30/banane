/* 4.9.5 test 10-ui : essai dans un vrai navigateur (Chromium de Playwright, fourni par l'environnement) du panneau habillé.
 * Charge panel.html depuis le disque avec une API Chrome simulée qui répond `view` par un état fabriqué ; rien n'est envoyé à ESV.
 *   node tools/ui5-navigateur.cjs <dossier-de-sortie> [variante...]
 * Écrit une capture par variante et par scénario, et la liste des erreurs de la page (doit être vide). */
'use strict';
const path = require('node:path'), fs = require('node:fs');
const ROOT = path.resolve(__dirname, '..');
const cuts = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const id = c => ({ part: 13, cut: c });
function lot(etat, extra = {}) {
  const faits = cuts(4790, 4811).filter(c => ![4796, 4803, 4809].includes(c));
  return { current: { identity: id(4812) }, busy: false, manual: { status: 'IDLE' }, native: { status: 'IDLE', visits: [], incomplete: [] },
    batch: { id: 'lot-1', state: etat, step: 'apply', scope: { part: 13, start: 4790, end: 4900, geometryEngine: 'geometry-candidate-v1', unresolvedPolicy: 'defer', lowConfidence: 'attempt', lotDecision: 'apply' },
      processed: faits.map(c => ({ identity: id(c), cut: c })), deferred: [4796, 4803, 4809].map(c => ({ identity: id(c), cut: c })), skipped: [], manuallyCompleted: [], paused: [], interrupted: [],
      sequence: [...cuts(4790, 4812)].map(c => ({ identity: id(c), cut: c })), activeIdentity: id(4812), lotCommands: {}, ...extra } };
}
function echo(statut) {
  const labels = ['VALIDATE_NO_MOVEMENT', 'VALIDATE_CORRECTED_BOTH', 'VALIDATE_CORRECTED_LEFT_ONLY', 'VALIDATE_NO_MOVEMENT'];
  const t0 = Date.parse('2026-10-19T13:00:00Z');
  const visits = cuts(5100, 5121).map((c, i) => ({ id: 'v' + i, identity: id(c), startedAt: new Date(t0 + i * 11000).toISOString(), endedAt: new Date(t0 + i * 11000 + 9000).toISOString(), label: labels[i % 4], outcome: labels[i % 4], decision: 'VALIDATE' }));
  return { current: { identity: id(5122) }, busy: false, manual: { status: 'IDLE' }, batch: null, native: { status: statut, visits, incomplete: [], message: 'Collecte en cours : travaille normalement dans ESV.' } };
}
const SCENARIOS = {
  repos: { state: { current: { identity: id(4790) }, busy: false, manual: { status: 'IDLE' }, native: { status: 'IDLE', visits: [], incomplete: [] }, batch: null }, hash: '#automatic' },
  lot: { state: lot('RUNNING'), hash: '#automatic' },
  incident: { state: lot('PAUSED_ADAPTER_UNRESPONSIVE', { pauseReason: 'adapter-unresponsive' }), hash: '#automatic' },
  echo: { state: echo('RUNNING'), hash: '#native' },
  accueil: { state: { current: null, busy: false, manual: { status: 'IDLE' }, native: { status: 'IDLE', visits: [], incomplete: [] }, batch: null }, hash: '' },
};
/* Même clic, deux chemins : l'habillage ou le bouton d'origine. Les messages envoyés au service worker doivent être les mêmes, dans le même ordre. */
async function comparerClics(variante, controles) {
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
  const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const resultats = [];
  for (const { etat, idLegacy, selecteur } of controles) {
    const sorties = [];
    for (const chemin of ['habillage', 'origine']) {
      const page = await navigateur.newPage({ viewport: { width: 1120, height: 760 } });
      await page.addInitScript(({ state, v, racine }) => {
        const reponses = { view: state, 'list-tabs': [{ id: 1, title: 'ESV', pret: true, utilise: true, index: 0, windowId: 1, active: true }], 'choix-lot-etat': { clicHumain: 'tel-quel', regleGrappeDifferes: false }, 'raison-choix-etat': { actif: false, touches: 'chiffres' },
          'relecture-choix-etat': { mode: 'corriger' }, 'relecture-etat': { choix: 'corriger', lot: null, passe: null }, 'bandeau-etat': { on: false }, 'fiches-depart': { fiches: [] } };
        window.__appels = [];
        window.fetch = async () => ({ json: async () => ({ total: 2684, date: '19/10/2026' }) });
        window.chrome = { runtime: { id: 'essai', getURL: p => 'file://' + racine + '/' + p, connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }),
          sendMessage: async m => { window.__appels.push(m.action || m.kind); return { result: m.action in reponses ? reponses[m.action] : {} }; } },
          storage: { local: { get: async () => ({ banane51Interface: v }), set: async () => {} } }, windows: { getCurrent: async () => ({ id: 1, type: 'normal', width: 1120, height: 760 }), update: async () => ({}) } };
      }, { state: etat, v: chemin === 'habillage' ? variante : 'ancienne', racine: ROOT });
      await page.goto('file://' + ROOT + '/panel.html#automatic');
      await page.waitForTimeout(450);
      const avant = await page.evaluate(() => window.__appels.length);
      await page.evaluate(([chem, id, sel]) => { const e = chem === 'habillage' ? document.querySelector(sel) : document.getElementById(id); e && e.click(); }, [chemin, idLegacy, selecteur]);
      await page.waitForTimeout(1000);
      sorties.push(await page.evaluate(a => window.__appels.slice(a).filter(x => x !== 'view' && x !== 'fiches-depart'), avant));
      await page.close();
    }
    resultats.push({ idLegacy, habillage: sorties[0], origine: sorties[1] });
  }
  await navigateur.close();
  return resultats;
}
async function lancer(sortie, variantes) {
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
  const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const erreurs = [], resultat = {};
  for (const v of variantes) for (const [nom, sc] of Object.entries(SCENARIOS)) {
    const page = await navigateur.newPage({ viewport: v === 'raycast' ? { width: 900, height: 660 } : { width: 1120, height: 760 } });
    page.on('pageerror', e => erreurs.push(`${v}/${nom}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erreurs.push(`${v}/${nom} console: ${m.text()}`); });
    await page.addInitScript(({ state, v, racine }) => {
      const reponses = { view: state, 'list-tabs': [{ id: 1, title: 'ESV', pret: true, utilise: true, index: 0, windowId: 1, active: true }], 'choix-lot-etat': { clicHumain: 'tel-quel', regleGrappeDifferes: false }, 'raison-choix-etat': { actif: false, touches: 'chiffres' },
        'relecture-choix-etat': { mode: 'corriger' }, 'relecture-etat': { choix: 'corriger', lot: null, passe: null }, 'bandeau-etat': { on: false }, 'fiches-depart': { fiches: [] } };
      const stockage = { banane51Interface: v };
      window.__appels = [];
      window.fetch = async () => ({ json: async () => ({ total: 2684, date: '19/10/2026' }) });
      window.chrome = { runtime: { id: 'essai', getURL: p => 'file://' + racine + '/' + p, connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }),
        sendMessage: async m => { window.__appels.push(m.action || m.kind); return { result: m.action in reponses ? reponses[m.action] : {} }; } },
        storage: { local: { get: async () => ({ ...stockage }), set: async o => { Object.assign(stockage, o); } } }, windows: { getCurrent: async () => ({ id: 1, type: 'normal', width: 1120, height: 760 }), update: async () => ({}) } };
    }, { state: sc.state, v, racine: ROOT });
    await page.goto('file://' + ROOT + '/panel.html' + sc.hash);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(sortie, `${v}-${nom}.png`) });
    resultat[`${v}/${nom}`] = await page.evaluate(() => ({ ui5: document.body.classList.contains('ui5'), classe: document.getElementById('ui5')?.className, taille: document.getElementById('ui5')?.innerHTML.length, boutonsPrincipaux: document.querySelectorAll('#ui5 .btn.p').length }));
    if (nom === 'lot') {
      /* Réglages, palette, et surtout : un clic sur l'habillage déclenche le BON bouton du panneau (même action au service worker). */
      await page.click('[data-act="ecran:reglages"]'); await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(sortie, `${v}-reglages.png`) });
      resultat[`${v}/reglages`] = await page.evaluate(() => ({ lignes: document.querySelectorAll('#ui5 .lr').length, listes: document.querySelectorAll('#ui5 select').length }));
      await page.click('[data-act="ecran:seance"]'); await page.waitForTimeout(150);
      if (v === 'linear') { await page.keyboard.press('Control+k'); await page.waitForTimeout(150); await page.screenshot({ path: path.join(sortie, `${v}-palette.png`) }); await page.keyboard.press('Escape'); }
      const avant = await page.evaluate(() => window.__appels.length);
      await page.evaluate(() => { const b = document.querySelector('#ui5 .btn.p, #ui5 .o.s'); window.__texteBouton = b && b.textContent; b && b.click(); });
      await page.waitForTimeout(300);
      resultat[`${v}/clic-principal`] = await page.evaluate(a => ({ texte: window.__texteBouton, appels: window.__appels.slice(a) }), avant);
    }
    await page.close();
  }
  await navigateur.close();
  return { erreurs, resultat };
}
if (require.main === module) {
  const sortie = path.resolve(process.argv[2] || '.'); fs.mkdirSync(sortie, { recursive: true });
  const variantes = process.argv.slice(3).length ? process.argv.slice(3) : ['linear', 'raycast', 'figma'];
  lancer(sortie, variantes).then(r => { console.log(JSON.stringify(r, null, 1)); process.exit(r.erreurs.length ? 1 : 0); }).catch(e => { console.error(e); process.exit(2); });
}
module.exports = { lancer, comparerClics, SCENARIOS, lot, echo };
/* 4.9.6 test 1 : la présentation « Ariane », écran par écran (accueil, Orbite, Écho, Revue, Réglages), pour chaque scénario. */
SCENARIOS.fin = { state: lot('COMPLETED', { activeIdentity: null }), hash: '#automatic' };
SCENARIOS.pause = { state: lot('PAUSED'), hash: '#automatic' };
async function capturerAriane(sortie, scenarios = Object.keys(SCENARIOS), ecrans = ['accueil', 'orbite', 'echo', 'revue', 'reglages'], vue = { width: 1180, height: 800 }, attente = 700) {
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
  const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const erreurs = [], resultat = {};
  for (const nom of scenarios) {
    const sc = SCENARIOS[nom], page = await navigateur.newPage({ viewport: vue });
    page.on('pageerror', e => erreurs.push(`${nom}: ${e.message}`));
    await page.addInitScript(({ state, racine }) => {
      const reponses = { view: state, 'list-tabs': [{ id: 1, title: 'ESV', pret: true, utilise: true, index: 0, windowId: 1, active: true }], 'choix-lot-etat': { clicHumain: 'tel-quel', regleGrappeDifferes: false }, 'raison-choix-etat': { actif: false, touches: 'chiffres' },
        'relecture-choix-etat': { mode: 'corriger' }, 'relecture-etat': { choix: 'corriger', lot: null, passe: null }, 'bandeau-etat': { on: false }, 'fiches-depart': { fiches: [] } };
      window.__appels = [];
      window.fetch = async () => ({ json: async () => ({ total: 2684, date: '19/10/2026' }) });
      window.chrome = { runtime: { id: 'essai', getURL: p => 'file://' + racine + '/' + p, connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }),
        sendMessage: async m => { window.__appels.push(m.action || m.kind); return { result: m.action in reponses ? reponses[m.action] : {} }; } },
        storage: { local: { get: async () => ({ banane51Interface: 'ariane' }), set: async () => {} } }, windows: { getCurrent: async () => ({ id: 1, type: 'normal', width: 1180, height: 800 }), update: async () => ({}) } };
    }, { state: sc.state, racine: ROOT });
    await page.goto('file://' + ROOT + '/panel.html' + sc.hash);
    await page.waitForTimeout(450);
    for (const ec of ecrans) {
      if (ec !== 'accueil') { await page.click(ec === 'reglages' ? '#ui5 .ico' : `#ui5 .onglets [data-act="aller:${ec}"]`); await page.waitForTimeout(attente); }
      if (sortie) await page.screenshot({ path: path.join(sortie, `ariane-${nom}-${ec}.png`) });
      resultat[`${nom}/${ec}`] = await page.evaluate(() => ({ vue: document.querySelector('#ui5 .app')?.dataset.vue, etat: document.querySelector('#ui5 .etat')?.textContent || '', cmd: document.querySelector('#ui5 #ar-cmd')?.textContent || '' }));
      if (ec !== 'accueil') { await page.click('#ui5 .onglets [data-act="aller:accueil"]'); await page.waitForTimeout(Math.min(attente, 600)); }
    }
    await page.close();
  }
  await navigateur.close();
  return { erreurs, resultat };
}
module.exports.capturerAriane = capturerAriane;
