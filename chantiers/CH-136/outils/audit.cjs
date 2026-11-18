'use strict';
/* CH-136 : audit de CH-129 étendu — deux thèmes (sombre, clair), bandeau « réglages neufs » affiché (AVIS=1, stockage vide) ou non (AVIS=0, marque posée),
 * et RECOUVREMENT : le centre de chaque bouton visible doit tomber sur le bouton lui-même (elementFromPoint), bandeau compris.
 * Usage : AVIS=1 THEMES=sombre,clair CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-136/outils/audit.cjs [SORTIE.json]
 * D'origine — CH-129 : AUDIT DU VRAI PANNEAU aux largeurs de 320 à 720 px, dans les 13 scènes de la page de démonstration, avec les trois palettes (Glacier,
 * Sarcelle, Signal), thème sombre, hauteur 760. Mesure de chantiers/CH-104/outils/capturer.cjs (`MESURE`) : débordement de la page, élément qui sort,
 * zone qui défile, troncature, texte sous 4,5:1 de contraste ; la bande du sélecteur de parties (1 à 20) est exclue par cette mesure (CH-108).
 * Usage : CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-129/outils/audit.cjs [SORTIE.json] */
const path = require('node:path'), fs = require('node:fs');
const R = path.resolve(__dirname, '../../..');
const THEMES = (process.env.THEMES || 'sombre,clair').split(','), AVIS = process.env.AVIS !== '0';
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
  for (const th of THEMES) for (const pal of PALETTES) for (const w of LARGEURS) for (const [nom, sc] of Object.entries(SCENES)) {
    const ctx = await nav.newContext({ viewport: { width: w, height: 760 } }), page = await ctx.newPage(), erreurs = [];
    page.on('pageerror', x => erreurs.push(x.message));
    const state = JSON.parse(JSON.stringify({ connection: { status: 'ready', observedAt: 't', message: null, tabId: 1 }, ...sc.state, fileParties: sc.state.fileParties ?? null }).replace(/"MAINTENANT-(\d+)"/g, (_, s) => JSON.stringify(new Date(Date.now() - s * 1000).toISOString())));
    await page.addInitScript(({ state, rel, fiches, avis }) => {
      const rep = { view: state, 'list-tabs': [{ id: 1, title: 'ESV', pret: true, utilise: true, index: 0, windowId: 1, active: true }], 'choix-lot-etat': { clicHumain: 'tel-quel', regleGrappeDifferes: false }, 'raison-choix-etat': { actif: false, touches: 'chiffres' },
        'relecture-choix-etat': { mode: 'corriger' }, 'relecture-etat': rel, 'bandeau-etat': { on: false }, 'fiches-depart': { fiches } }, st = avis ? {} : { banane5Poste: { neuf: false } };
      window.fetch = async () => ({ json: async () => ({ totaux: { tous: { corriges: 2731 } }, creeLe: '2026-10-20T08:00:00Z' }) });
      window.chrome = { runtime: { id: 'essai', getURL: p => new URL(p, location.href).href, connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }), sendMessage: async m => ({ result: m.action in rep ? rep[m.action] : {} }) },
        storage: { local: { get: async () => ({ ...st }), set: async o => { Object.assign(st, o); } } }, windows: { getCurrent: async () => ({ id: 1, type: 'normal', width: 600, height: 760 }), update: async () => ({}) } };
    }, { state, rel: sc.rel || { choix: 'corriger', lot: null, passe: null }, fiches: sc.fiches || [], avis: AVIS });
    await ouvrirPanneau(page, '#automatic'); await page.waitForTimeout(900);
    await page.evaluate(p => window.ArianeUi5.agir('sg:choix:palette:' + p), pal);
    await page.evaluate(t => window.ArianeUi5.agir('sg:choix:theme:' + t), th);
    if (sc.onglet === 'file') await page.evaluate(() => window.ArianeUi5.agir('sg:onglet-file'));
    if (sc.onglet === 'correction') await page.evaluate(() => window.ArianeUi5.agir('sg:onglet-correction'));
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }); await page.waitForTimeout(500);
    await page.waitForTimeout(1200);   /* le bandeau relit thème et hauteur chaque seconde */
    const recouvert = await page.evaluate(avis => {
      const out = [], vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
      const ban = document.getElementById('avis-stockage-neuf');
      if (avis && !ban) out.push('BANDEAU absent');
      if (ban) { const t = document.documentElement.dataset.theme === 'light' ? 'clair' : 'sombre'; if (ban.dataset.theme !== t) out.push('BANDEAU thème ' + ban.dataset.theme + ' ≠ ' + t); }
      for (const b of document.querySelectorAll('#ui5 button, #ui5 [data-act], #avis-stockage-neuf button')) {
        if (!vis(b)) continue; const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (y >= innerHeight || x >= innerWidth) continue;   /* hors de la vue (zone qui défile) : pas un recouvrement */
        /* Coupé par un ancêtre qui ne laisse pas déborder (liste qui défile, #ui5) : invisible, pas recouvert. */
        let coupe = false; for (let a = b.parentElement; a && a !== document.documentElement; a = a.parentElement) { const st = getComputedStyle(a);
          if (/(hidden|auto|scroll|clip)/.test(st.overflow + st.overflowY + st.overflowX)) { const q = a.getBoundingClientRect(); if (x < q.left || x > q.right || y < q.top || y > q.bottom) { coupe = true; break; } } }
        if (coupe) continue;
        const e = document.elementFromPoint(x, y); if (!e || !(e === b || b.contains(e) || e.contains(b) && e.closest('[data-act]') === b)) out.push(`RECOUVERT ${b.dataset.act || b.id || b.textContent.trim().slice(0, 20)} par ${e ? (e.id || e.className || e.tagName) : 'rien'}`);
      }
      return out; }, AVIS);
    const m = [...erreurs.map(x => 'ERREUR ' + x), ...await page.evaluate(MESURE), ...recouvert];
    res[`${th}-${pal}-${w}-${nom}`] = m; n++; defauts += m.length; await ctx.close();
  }
  await nav.close();
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
  for (const [k, v] of Object.entries(res)) if (v.length) console.log(k, '|', v.join(' | '));
  console.log(`${n} vues, ${defauts} défaut(s)`);
})().catch(e => { console.error(e); process.exit(1); });
