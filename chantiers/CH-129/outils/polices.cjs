'use strict';
/* CH-129 : relevé des polices réellement rendues par le vrai panneau (taille, graisse, interligne) dans les états de chantiers/CH-104/outils/capturer.cjs,
 * à 360 et 600 px. Usage : CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-129/outils/polices.cjs [palette] */
const R = require('node:path').resolve(__dirname, '../../..');
const { chromium } = require(require(R + '/tests/esv-maquette/navigateur.cjs').modulePlaywright());
const { ouvrir } = require(R + '/tests/helpers/signal-navigateur.cjs');
const { E } = require(R + '/chantiers/CH-104/outils/capturer.cjs');
const ETATS = ['pret', 'cours', 'toi', 'relecture', 'fin', 'file-cours', 'file-fin', 'aurore'];
(async () => {
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }), tout = {};
  for (const w of [360, 600]) for (const n of ETATS) {
    const e = E[n], { page } = await ouvrir(nav, JSON.parse(JSON.stringify({ ...e.state, fileParties: e.state.fileParties ?? null })), { width: w, height: 760 });
    if (e.file) { await page.evaluate(() => window.ArianeUi5.agir('sg:onglet-file')); }
    for (const a of e.actions || []) await page.evaluate(x => window.ArianeUi5.agir(x), a);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => { const o = []; for (const el of document.querySelectorAll('#ui5 *')) {
      if (![...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim()) || !el.getClientRects().length) continue;
      const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || el.closest('[aria-hidden="true"],[inert]')) continue;
      o.push(`${parseFloat(s.fontSize)}px/${s.fontWeight}/${s.lineHeight === 'normal' ? 'n' : Math.round(parseFloat(s.lineHeight) * 10) / 10}|${(el.className && el.className.baseVal === undefined ? el.className : el.tagName).toString().split(' ')[0]}`); } return o; });
    for (const x of r) { const [k, c] = x.split('|'), cle = `${w} ${k}`; (tout[cle] = tout[cle] || new Set()).add(c); }
    await page.close();
  }
  await nav.close();
  for (const w of [360, 600]) { const L = Object.keys(tout).filter(k => k.startsWith(w + ' ')).sort((a, b) => parseFloat(a.split(' ')[1]) - parseFloat(b.split(' ')[1]));
    console.log(`== ${w} px : ${new Set(L.map(k => k.split(' ')[1].split('/')[0])).size} tailles`); for (const k of L) console.log(' ', k, [...tout[k]].slice(0, 8).join(' ')); }
})().catch(e => { console.error(e); process.exit(1); });
