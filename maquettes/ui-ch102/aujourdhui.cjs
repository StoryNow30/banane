'use strict';
/* CH-102 : photographie le panneau d'aujourd'hui (panel.html du tronc) dans les huit états du lot, aux deux tailles et dans les deux thèmes.
 *   CHROMIUM=/opt/pw-browsers/chromium node maquettes/ui-ch102/aujourdhui.cjs DOSSIER_HORS_DEPOT
 * Montage des essais de navigateur (API Chrome simulée, rien n'est envoyé à ESV), chiffres fabriqués du lot de CH-101 :
 * partie 13, cuts 4790 à 4900, cut 4811 atteint, 3 cuts à poser. Les images vont HORS du dépôt (interdit de CLAUDE.md). */
const fs = require('node:fs'), path = require('node:path');
const N = require('../../tests/esv-maquette/navigateur.cjs'), { ouvrirPanneau } = require('../../tests/helpers/panneau-local.cjs');
const U = require('../../tools/ui5-navigateur.cjs');
const SORTIE = process.argv[2];
if (!SORTIE) { console.error('usage : node maquettes/ui-ch102/aujourdhui.cjs DOSSIER_HORS_DEPOT'); process.exit(2); }
if (!path.relative(path.resolve(__dirname, '../..'), path.resolve(SORTIE)).startsWith('..')) { console.error('refus : le dossier de sortie est dans le dépôt (aucune capture dans le dépôt)'); process.exit(2); }

const RELECTURE0 = { choix: 'corriger', lot: null, passe: null };
const fini = U.lot('COMPLETED', { activeIdentity: null });
const ETATS = [
  { id: 'pret', state: U.SCENARIOS.repos.state },
  { id: 'cours', state: U.lot('RUNNING', { cutStartedAt: new Date(Date.now() - 4000).toISOString() }) },
  { id: 'pause', state: U.lot('PAUSED') },
  { id: 'toi', state: U.lot('PAUSED_UNRESOLVED_RAIL', { pauseReason: 'unresolved-rail' }) },
  { id: 'panne', state: U.lot('PAUSED_ADAPTER_UNRESPONSIVE', { pauseReason: 'adapter-unresponsive' }) },
  { id: 'rattrapage', state: { ...fini, passeDifferes: { lotId: 'lot-1', mode: 'ecriture', etat: 'ecriture', differes: 3, posees: 3, demandees: 3, ecrites: 1, cut: 4803, message: null } } },
  { id: 'relecture', state: { ...fini, relecture: { etat: 'en-cours' } }, relecture: { choix: 'corriger', lot: { id: 'lot-1', etat: 'COMPLETED', mode: 'corriger' }, passe: { lotId: 'lot-1', etat: 'en-cours', faits: 12, total: 85, cut: 4801, reprise: true, pauseDemandee: false, pauseRaison: null, expire: null }, repriseReglage: { actif: true, f5: 'pause' } } },
  { id: 'fin', state: fini },
];
const TAILLES = [[360, 480], [600, 760]], THEMES = ['light', 'dark'];

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const { chromium } = N.playwright(), nav = await chromium.launch({ executablePath: N.executable() }), erreurs = [];
  for (const e of ETATS) for (const [w, h] of TAILLES) for (const theme of THEMES) {
    const page = await nav.newPage({ viewport: { width: w, height: h }, colorScheme: theme, deviceScaleFactor: 2 });
    page.on('pageerror', x => erreurs.push(`${e.id} ${w} ${theme} : ${x.message}`));
    await page.addInitScript(({ state, relecture, w, h, theme }) => {
      const reponses = { view: { connection: { status: 'ready', observedAt: 't', message: null, tabId: 1 }, ...state }, 'list-tabs': [{ id: 1, title: 'ESV', pret: true, utilise: true, index: 0, windowId: 1, active: true }],
        'choix-lot-etat': { clicHumain: 'tel-quel', regleGrappeDifferes: false, passeDifferes: true }, 'raison-choix-etat': { actif: false, touches: 'chiffres' }, 'relecture-choix-etat': { mode: 'corriger' },
        'relecture-etat': relecture, 'bandeau-etat': { on: false }, 'fiches-depart': { fiches: [] } };
      const stockage = { 'banane.theme': theme };
      try { localStorage.setItem('banane.theme', theme); } catch { /* stockage indisponible : le thème suit alors le système */ }
      window.fetch = async () => ({ json: async () => ({ totaux: { tous: { corriges: 2731 } }, creeLe: '2026-10-20T08:00:00Z' }) });
      window.chrome = { runtime: { id: 'essai', getURL: p => new URL(p, location.href).href, connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }),
        sendMessage: async m => ({ result: m.action in reponses ? reponses[m.action] : {} }) },
        storage: { local: { get: async () => ({ ...stockage }), set: async o => { Object.assign(stockage, o); } } }, windows: { getCurrent: async () => ({ id: 1, type: 'normal', width: w, height: h }), update: async () => ({}) } };
    }, { state: e.state, relecture: e.relecture || RELECTURE0, w, h, theme });
    await ouvrirPanneau(page, '#automatic');
    await page.waitForTimeout(e.id === 'relecture' ? 6000 : 800);   /* la carte de relecture répond après le premier rendu : attendre le rendu suivant */
    await page.screenshot({ path: path.join(SORTIE, `aujourdhui-${e.id}-${w}-${theme === 'dark' ? 'sombre' : 'clair'}.png`) });
    await page.close();
  }
  await nav.close();
  console.log(`${ETATS.length * TAILLES.length * THEMES.length} images dans ${SORTIE} · ${erreurs.length} erreur(s) de page`);
  for (const x of erreurs) console.log('  ' + x);
})();
