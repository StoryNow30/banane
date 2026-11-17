'use strict';
/* CH-134 : AUDIT ÉTENDU DU VRAI PANNEAU (celui de CH-129, avec les contrôles ajoutés par CH-132). Pour chaque vue : scène (chantiers/CH-134/outils/
 * scenes.cjs) × largeur (320 à 720 px par pas de 40, hauteur 760) × palette (Glacier, Sarcelle, Signal) × thème (sombre, clair) × vue du lot
 * (instrument, fil ; la vue fil n'existe que dans Orbite, lot ouvert ou fini : ailleurs, la vue gardée « fil » ne doit rien changer, et c'est mesuré).
 * Contrôles : MESURE de chantiers/CH-104/outils/capturer.cjs (débordement, élément qui sort, zone qui défile, troncature en largeur, ellipse, contraste
 * sous 4,5:1) ; texte rendu sous 11 px ; anneau ou halo à moins de 12 px d'un bord qui coupe ; texte coupé en hauteur (lignes bornées : phrase,
 * avis) ; erreurs de la page. Usage : CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-134/outils/audit.cjs [SORTIE.json]
 * Variables : SCENES, LARGEURS, PALETTES, THEMES, VUES (listes à virgules), PARALLELE (4 par défaut). */
const path = require('node:path'), fs = require('node:fs');
const R = path.resolve(__dirname, '../../..');
const navigateur = require(R + '/tests/esv-maquette/navigateur.cjs'), { ouvrirPanneau } = require(R + '/tests/helpers/panneau-local.cjs');
const { MESURE } = require(R + '/chantiers/CH-104/outils/capturer.cjs');
const { SCENES, preparer } = require('./scenes.cjs');
const liste = (v, d) => (process.env[v] ? process.env[v].split(',') : d);
const LARGEURS = liste('LARGEURS', Array.from({ length: 11 }, (_, i) => String(320 + 40 * i))).map(Number), PALETTES = liste('PALETTES', ['glacier', 'sarcelle', 'signal']);
const THEMES = liste('THEMES', ['sombre', 'clair']), VUES = liste('VUES', ['instrument', 'fil']), NOMS = liste('SCENES', Object.keys(SCENES));
const PETITS = () => [...new Set([...document.querySelectorAll('#ui5 .sg-fen *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[aria-hidden="true"],.sg-mol-fen') && parseFloat(getComputedStyle(e).fontSize) < 11).map(e => `POLICE ${parseFloat(getComputedStyle(e).fontSize)}px « ${e.textContent.trim().slice(0, 20)} »`))];
const ANNEAUX = () => { const o = [];
  for (const a of document.querySelectorAll('#ui5 .sg-anneau')) { if (!a.getClientRects().length || getComputedStyle(a).display === 'none') continue;
    const r = a.getBoundingClientRect(), svg = a.querySelector('svg'); if (!svg || getComputedStyle(svg).display === 'none' || r.width < 20) continue;
    let p = a.parentElement; while (p && p.id !== 'ui5' && getComputedStyle(p).overflowX === 'visible' && getComputedStyle(p).overflowY === 'visible') p = p.parentElement;
    if (!p) continue; const q = p.getBoundingClientRect();
    const av = getComputedStyle(a, '::before'), arc = a.querySelector('.sg-arc'), f = arc ? getComputedStyle(arc).filter : 'none';
    const voile = av.display !== 'none' && av.content !== 'none' ? Math.max(0, -parseFloat(av.left) || 0, -parseFloat(av.top) || 0) : 0;
    const ombre = /drop-shadow/.test(f) ? Math.max(0, ...[...f.matchAll(/(-?[\d.]+)px/g)].map(x => Math.abs(+x[1]))) : 0, halo = Math.max(voile, ombre);
    const c = [r.left - q.left, q.right - r.right, r.top - q.top, q.bottom - r.bottom].map(x => x - halo), d = Math.min(...c);
    if (d < 12) o.push(`ANNEAU (halo ${Math.round(halo)} px compris) à ${Math.round(d)} px d'un bord qui coupe (${['gauche', 'droite', 'haut', 'bas'][c.indexOf(d)]})`); }
  return o; };
/* une ligne bornée (-webkit-line-clamp) qui cache du texte : la phrase de la tuile, un avis ; « Détails » la rend entière, mais c'est dit */
const HAUTEUR = () => [...document.querySelectorAll('#ui5 .sg-fen *')].filter(e => { const s = getComputedStyle(e); return e.getClientRects().length && s.webkitLineClamp && s.webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 2; })
  .map(e => `COUPE EN HAUTEUR ${(e.className.baseVal ?? e.className).split(' ')[0]} « ${e.textContent.trim().slice(0, 30)} »`);
async function vue(nav, nom, sc, w, pal, th, v) {
  const ctx = await nav.newContext({ viewport: { width: w, height: 760 } }), page = await ctx.newPage(), erreurs = [];
  page.on('pageerror', x => erreurs.push(x.message));
  try {
    await preparer(page, sc, { vue: v === 'fil' ? 'fil' : null }); await ouvrirPanneau(page, '#automatic'); await page.waitForTimeout(800);
    await page.evaluate(([p, t]) => { window.ArianeUi5.agir('sg:choix:palette:' + p); window.ArianeUi5.agir('sg:choix:theme:' + t); }, [pal, th]);
    if (sc.onglet === 'file') await page.evaluate(() => window.ArianeUi5.agir('sg:onglet-file'));
    if (sc.onglet === 'correction') await page.evaluate(() => window.ArianeUi5.agir('sg:onglet-correction'));
    for (const a of sc.actions || []) await page.evaluate(x => window.ArianeUi5.agir(x), a);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }); await page.waitForTimeout(400);
    const etat = await page.evaluate(() => ({ vue: document.querySelector('#ui5 .sg-fen')?.dataset.vue || 'instrument', bouton: !!document.querySelector('#ui5 [data-act="sg:vue-lot"]') }));
    return { etat, m: [...erreurs.map(x => 'ERREUR ' + x), ...await page.evaluate(MESURE), ...await page.evaluate(PETITS), ...await page.evaluate(ANNEAUX), ...await page.evaluate(HAUTEUR)] };
  } finally { await ctx.close(); }
}
(async () => {
  const { chromium } = require(navigateur.modulePlaywright()); const nav = await chromium.launch({ executablePath: navigateur.executable() });
  const travaux = []; for (const th of THEMES) for (const v of VUES) for (const pal of PALETTES) for (const w of LARGEURS) for (const nom of NOMS) travaux.push({ th, v, pal, w, nom });
  const res = {}, vuesFil = {}; let n = 0, defauts = 0, i = 0;
  await Promise.all(Array.from({ length: Number(process.env.PARALLELE || 4) }, async () => { while (i < travaux.length) { const t = travaux[i++];
    const { etat, m } = await vue(nav, t.nom, SCENES[t.nom], t.w, t.pal, t.th, t.v); const k = `${t.th}-${t.v}-${t.pal}-${t.w}-${t.nom}`;
    res[k] = m; n++; defauts += m.length; if (t.v === 'fil') vuesFil[t.nom] = `${etat.vue}${etat.bouton ? ' (bouton)' : ''}`;
    if (n % 200 === 0) console.error(`${n} / ${travaux.length}`); } }));
  await nav.close();
  const tri = Object.fromEntries(Object.keys(res).sort().map(k => [k, res[k]]));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ vues: n, defauts, vueFilParScene: vuesFil, resultats: tri }, null, 1));
  for (const [k, v] of Object.entries(tri)) if (v.length) console.log(k, '|', v.join(' | '));
  console.log('vue fil gardée, par scène :', JSON.stringify(vuesFil));
  console.log(`${n} vues, ${defauts} défaut(s)`);
})().catch(e => { console.error(e); process.exit(1); });
