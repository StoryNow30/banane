/* Test 17 (UI) : le panneau dans un vrai navigateur (Chromium de Playwright, fourni par l'environnement). panel.html est chargé depuis le disque avec une API Chrome
 * simulée qui répond `view` et `relecture-etat` par un état fabriqué ; rien n'est envoyé à ESV.
 *   node tools/ui5-navigateur.cjs <dossier-de-captures>
 * Écrit une capture PNG par écran et par état, et la liste des erreurs de la page (doit être vide). Les essais `tests/ui5-navigateur-*.test.cjs` se servent de
 * `preparer` et `scenarios` ; ils sont ignorés (et le disent) quand Chromium ou Playwright est absent. */
'use strict';
const path = require('node:path'), fs = require('node:fs');
const ROOT = path.resolve(__dirname, '..');
const PW = process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright';
const CHROMIUM = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : '/opt/pw-browsers/chromium');
const absent = !fs.existsSync(CHROMIUM) || !fs.existsSync(PW) ? 'Chromium ou Playwright absent : essai de navigateur ignoré' : false;
const cuts = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const id = c => ({ part: 13, cut: c });
function lot(etat, extra = {}) {
  const faits = cuts(4790, 4811).filter(c => ![4796, 4803, 4809].includes(c));
  return { current: { identity: id(4812) }, busy: false, manual: { status: 'IDLE' }, native: { status: 'IDLE', visits: [], incomplete: [] },
    batch: { id: 'lot-1', state: etat, step: 'apply', scope: { part: 13, start: 4790, end: 4900, geometryEngine: 'geometry-candidate-v1', unresolvedPolicy: 'defer', lowConfidence: 'attempt', lotDecision: 'apply' },
      processed: faits.map(c => ({ identity: id(c), cut: c })), deferred: [4796, 4803, 4809].map(c => ({ identity: id(c), cut: c })), skipped: [], manuallyCompleted: [], paused: [], interrupted: [],
      sequence: cuts(4790, 4812).map(c => ({ identity: id(c), cut: c })), activeIdentity: id(4812), lotCommands: {}, ...extra } };
}
function echo(statut) {
  const labels = ['VALIDATE_NO_MOVEMENT', 'VALIDATE_CORRECTED_BOTH', 'VALIDATE_CORRECTED_LEFT_ONLY', 'VALIDATE_NO_MOVEMENT'];
  const t0 = Date.parse('2026-10-19T13:00:00Z');
  const visits = cuts(5100, 5121).map((c, i) => ({ id: 'v' + i, identity: id(c), startedAt: new Date(t0 + i * 11000).toISOString(), endedAt: new Date(t0 + i * 11000 + 9000).toISOString(), label: labels[i % 4], outcome: labels[i % 4], decision: 'VALIDATE' }));
  return { current: { identity: id(5122) }, busy: false, manual: { status: 'IDLE' }, batch: null, native: { status: statut, visits, incomplete: [], message: 'Collecte en cours : travaille normalement dans ESV.' } };
}
/* Réponse du service worker à `relecture-etat` : une passe de relecture (état `etat`) sur le lot terminé. */
const relecture = (etat, extra = {}) => ({ choix: 'corriger', lot: { id: 'lot-1', etat: 'COMPLETED', mode: 'corriger' }, repriseReglage: { actif: true, f5: 'pause' },
  passe: { lotId: 'lot-1', etat, faits: 12, total: 85, cut: 110, reprise: true, pauseDemandee: false, pauseRaison: etat === 'en-pause' ? 'mic' : null, expire: Date.parse('2026-10-22T10:00:00Z'), mode: 'corriger', corriges: 3, ...extra } });
const SCENARIOS = {
  accueil: { state: { current: null, busy: false, manual: { status: 'IDLE' }, native: { status: 'IDLE', visits: [], incomplete: [] }, batch: null }, hash: '' },
  repos: { state: { current: { identity: id(4790) }, busy: false, manual: { status: 'IDLE' }, native: { status: 'IDLE', visits: [], incomplete: [] }, batch: null }, hash: '#automatic' },
  lot: { state: lot('RUNNING'), hash: '#automatic' },
  pause: { state: lot('PAUSED'), hash: '#automatic' },
  incident: { state: lot('PAUSED_ADAPTER_UNRESPONSIVE', { pauseReason: 'adapter-unresponsive' }), hash: '#automatic' },
  fin: { state: lot('COMPLETED', { activeIdentity: null }), hash: '#automatic' },
  echo: { state: echo('RUNNING'), hash: '#native' },
  'relecture-cours': { state: lot('COMPLETED', { activeIdentity: null }), hash: '#automatic', relecture: relecture('en-cours') },
  'relecture-pause': { state: lot('COMPLETED', { activeIdentity: null }), hash: '#automatic', relecture: relecture('en-pause') },
};
/* Charge panel.html dans `page` pour le scénario `nom`, `variante` étant l'interface gardée ('ancienne', 'ariane2' ou 'palette'). */
async function preparer(page, nom, variante, vue = { width: 1180, height: 840 }) {
  const sc = SCENARIOS[nom];
  await page.addInitScript(({ state, racine, variante, rel, vue }) => {
    const reponses = { view: state, 'list-tabs': [{ id: 1, title: 'ESV', pret: true, utilise: true, index: 0, windowId: 1, active: true }], 'choix-lot-etat': { clicHumain: 'tel-quel', regleGrappeDifferes: false }, 'raison-choix-etat': { actif: false, touches: 'chiffres' },
      'relecture-choix-etat': { mode: 'corriger' }, 'relecture-etat': rel || { choix: 'corriger', lot: null, passe: null, repriseReglage: { actif: false, f5: 'pause' } }, 'bandeau-etat': { on: false }, 'fiches-depart': { fiches: [] } };
    const stockage = variante === 'ancienne' ? {} : { banane51Interface: variante };
    window.__appels = []; window.__stockage = stockage;
    window.fetch = async () => ({ json: async () => ({ total: 2684, date: '19/10/2026' }) });
    window.chrome = { runtime: { id: 'essai', getURL: p => 'file://' + racine + '/' + p, connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }),
      sendMessage: async m => { window.__appels.push(m.action || m.kind); return { result: m.action in reponses ? reponses[m.action] : {} }; } },
      storage: { local: { get: async () => ({ ...stockage }), set: async o => { Object.assign(stockage, o); } } }, windows: { getCurrent: async () => ({ id: 1, type: 'normal', width: vue.width, height: vue.height }), update: async () => ({}) } };
  }, { state: sc.state, racine: ROOT, variante, rel: sc.relecture || null, vue });
  await page.goto('file://' + ROOT + '/panel.html' + sc.hash);
}
async function ouvrir(vue = { width: 1180, height: 840 }) {
  const { chromium } = require(PW);
  const navigateur = await chromium.launch({ executablePath: CHROMIUM });
  const nouvelle = async () => { const page = await navigateur.newPage({ viewport: vue }), erreurs = []; page.on('pageerror', e => erreurs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erreurs.push('console: ' + m.text()); }); return { page, erreurs }; };
  return { navigateur, nouvelle };
}
/* Captures du panneau d'avant, de la maquette v2 (accueil, Orbite, Écho, Revue, Réglages) et de la palette ; `sortie` : dossier. Rend les erreurs de page. */
async function capturer(sortie) {
  const erreurs = [], faits = [];
  /* 1,3 s : le panneau relit l'état toutes les secondes ; la pause de la relecture n'apparaît qu'à la lecture suivante. */
  const sh = async (page, nom) => { await page.waitForTimeout(1300); await page.screenshot({ path: path.join(sortie, nom + '.png'), fullPage: nom.startsWith('ancien') }); faits.push(nom); };
  const { navigateur, nouvelle } = await ouvrir();
  try {
    for (const sc of ['accueil', 'lot', 'pause', 'incident', 'fin', 'echo', 'relecture-cours', 'relecture-pause']) {
      const { page, erreurs: e } = await nouvelle(); await preparer(page, sc, 'ancienne'); await sh(page, `ancien-${sc}`); await page.close(); erreurs.push(...e.map(x => `ancien/${sc}: ${x}`));
    }
    for (const sc of ['accueil', 'lot', 'pause', 'incident', 'fin', 'echo', 'relecture-cours', 'relecture-pause']) {
      const { page, erreurs: e } = await nouvelle(); await preparer(page, sc, 'ariane2'); await sh(page, `v2-${sc}-accueil`);
      for (const ec of ['orbite', 'echo', 'revue', 'reglages']) {
        await page.click(ec === 'reglages' ? '#ui5 [data-act="aller:reglages"]' : `#ui5 .onglets [data-act="aller:${ec}"]`); await sh(page, `v2-${sc}-${ec}`);
        await page.click('#ui5 .onglets [data-act="aller:accueil"]'); await page.waitForTimeout(200);
      }
      await page.close(); erreurs.push(...e.map(x => `v2/${sc}: ${x}`));
    }
  } finally { await navigateur.close(); }
  const p = await ouvrir({ width: 720, height: 560 });
  try {
    for (const sc of ['lot', 'relecture-pause']) {
      const { page, erreurs: e } = await p.nouvelle(); await preparer(page, sc, 'palette', { width: 720, height: 560 }); await sh(page, `palette-${sc}-ouverte`);
      await page.keyboard.type('re'); await sh(page, `palette-${sc}-recherche`); await page.close(); erreurs.push(...e.map(x => `palette/${sc}: ${x}`));
    }
  } finally { await p.navigateur.close(); }
  return { erreurs, faits };
}
if (require.main === module) {
  if (absent) { console.error(absent); process.exit(2); }
  const sortie = path.resolve(process.argv[2] || '.'); fs.mkdirSync(sortie, { recursive: true });
  capturer(sortie).then(r => { console.log(JSON.stringify(r, null, 1)); process.exit(r.erreurs.length ? 1 : 0); }).catch(e => { console.error(e); process.exit(2); });
}
module.exports = { absent, preparer, ouvrir, capturer, SCENARIOS, lot, echo, relecture };
