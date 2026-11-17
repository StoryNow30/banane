'use strict';
/* CH-129 : AUDIT DU VRAI PANNEAU aux largeurs de 320 à 720 px, dans les 13 scènes de la page de démonstration, avec les trois palettes (Glacier,
 * Sarcelle, Signal), thème sombre, hauteur 760. Mesure de chantiers/CH-104/outils/capturer.cjs (`MESURE`) : débordement de la page, élément qui sort,
 * zone qui défile, troncature, texte sous 4,5:1 de contraste ; la bande du sélecteur de parties (1 à 20) est exclue par cette mesure (CH-108).
 * Usage : CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-129/outils/audit.cjs [SORTIE.json] */
const path = require('node:path'), fs = require('node:fs');
const R = path.resolve(__dirname, '../../..');
const navigateur = require(R + '/tests/esv-maquette/navigateur.cjs'), { ouvrirPanneau } = require(R + '/tests/helpers/panneau-local.cjs');
const { E, MESURE, lot } = require(R + '/chantiers/CH-104/outils/capturer.cjs');
const LARGEURS = process.env.LARGEURS ? process.env.LARGEURS.split(',').map(Number) : [320, 400, 480, 560, 600, 640, 720], PALETTES = ['glacier', 'sarcelle', 'signal'];
const SCENES = {
  repos: { state: E.pret.state }, cours: { state: E.cours.state }, pause: { state: E.pause.state }, toi: { state: E.toi.state },
  rattrapage: { state: E.rattrapage.state }, relecture: { state: E.relecture.state, rel: E.relecture.rel }, fin: { state: E.fin.state },
  constellation: { ...E['file-cours'], onglet: 'file' }, passage: { ...E['file-passage'], onglet: 'file' }, 'file-fin': { ...E['file-fin'], onglet: 'file' },
  aurore: { state: E.aurore.state, onglet: 'correction' }, panne: { state: E.panne.state }, erreur: { state: lot('ERROR', 4811, { activeIdentity: null }) },
};
(async () => {
  const { chromium } = require(navigateur.modulePlaywright()); const nav = await chromium.launch({ executablePath: navigateur.executable() });
  const res = {}; let n = 0, defauts = 0;
  for (const pal of PALETTES) for (const w of LARGEURS) for (const [nom, sc] of Object.entries(SCENES)) {
    const ctx = await nav.newContext({ viewport: { width: w, height: 760 } }), page = await ctx.newPage(), erreurs = [];
    page.on('pageerror', x => erreurs.push(x.message));
    const state = JSON.parse(JSON.stringify({ connection: { status: 'ready', observedAt: 't', message: null, tabId: 1 }, ...sc.state, fileParties: sc.state.fileParties ?? null }).replace(/"MAINTENANT-(\d+)"/g, (_, s) => JSON.stringify(new Date(Date.now() - s * 1000).toISOString())));
    await page.addInitScript(({ state, rel, fiches }) => {
      const rep = { view: state, 'list-tabs': [{ id: 1, title: 'ESV', pret: true, utilise: true, index: 0, windowId: 1, active: true }], 'choix-lot-etat': { clicHumain: 'tel-quel', regleGrappeDifferes: false }, 'raison-choix-etat': { actif: false, touches: 'chiffres' },
        'relecture-choix-etat': { mode: 'corriger' }, 'relecture-etat': rel, 'bandeau-etat': { on: false }, 'fiches-depart': { fiches } }, st = {};
      window.fetch = async () => ({ json: async () => ({ totaux: { tous: { corriges: 2731 } }, creeLe: '2026-10-20T08:00:00Z' }) });
      window.chrome = { runtime: { id: 'essai', getURL: p => new URL(p, location.href).href, connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }), sendMessage: async m => ({ result: m.action in rep ? rep[m.action] : {} }) },
        storage: { local: { get: async () => ({ ...st }), set: async o => { Object.assign(st, o); } } }, windows: { getCurrent: async () => ({ id: 1, type: 'normal', width: 600, height: 760 }), update: async () => ({}) } };
    }, { state, rel: sc.rel || { choix: 'corriger', lot: null, passe: null }, fiches: sc.fiches || [] });
    await ouvrirPanneau(page, '#automatic'); await page.waitForTimeout(900);
    await page.evaluate(p => window.ArianeUi5.agir('sg:choix:palette:' + p), pal);
    if (sc.onglet === 'file') await page.evaluate(() => window.ArianeUi5.agir('sg:onglet-file'));
    if (sc.onglet === 'correction') await page.evaluate(() => window.ArianeUi5.agir('sg:onglet-correction'));
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }); await page.waitForTimeout(500);
    const m = [...erreurs.map(x => 'ERREUR ' + x), ...await page.evaluate(MESURE)];
    res[`${pal}-${w}-${nom}`] = m; n++; defauts += m.length; await ctx.close();
  }
  await nav.close();
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
  for (const [k, v] of Object.entries(res)) if (v.length) console.log(k, '|', v.join(' | '));
  console.log(`${n} vues, ${defauts} défaut(s)`);
})().catch(e => { console.error(e); process.exit(1); });
