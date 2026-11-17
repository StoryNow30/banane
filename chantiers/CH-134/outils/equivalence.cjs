'use strict';
/* CH-134 : ÉQUIVALENCE DE L'INTÉGRATION DE LA DIRECTION A. Pour chaque vue (scène × largeur × palette × thème), le vrai panneau est rendu deux fois
 * avec les MÊMES scripts (arbre de travail) : (1) référence = panel-signal.css d'une révision (par défaut integration/cloture-50) + la feuille de la
 * direction A de CH-132 posée par-dessus ; (2) candidat = panel-signal.css de l'arbre de travail. Les styles calculés de chaque élément de #ui5
 * (et de ses ::before / ::after) sont comparés propriété par propriété ; toute différence est listée. Le bouton de vue (`.sg-vue-b`, nouveau)
 * est exclu ; un élément rendu ni dans l'une ni dans l'autre (sous un display:none) n'est pas comparé. Animations et transitions coupées (état final). Usage :
 *   CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-134/outils/equivalence.cjs [REV] [SORTIE.json] */
const path = require('node:path'), fs = require('node:fs'), { execFileSync } = require('node:child_process');
const R = path.resolve(__dirname, '../../..');
const navigateur = require(R + '/tests/esv-maquette/navigateur.cjs'), { ouvrirPanneau } = require(R + '/tests/helpers/panneau-local.cjs');
const { SCENES, preparer } = require('./scenes.cjs');
const REV = process.argv[2] || 'integration/cloture-50';
const REF = execFileSync('git', ['show', `${REV}:panel-signal.css`], { cwd: R, encoding: 'utf8', maxBuffer: 64e6 }) + '\n' + fs.readFileSync(R + '/chantiers/CH-132/directions/instrument.css', 'utf8');
const CAND = fs.readFileSync(R + '/panel-signal.css', 'utf8');
const LARGEURS = (process.env.LARGEURS || '360,600,720').split(',').map(Number), PALETTES = (process.env.PALETTES || 'glacier,sarcelle,signal').split(','), THEMES = (process.env.THEMES || 'sombre,clair').split(',');
const RELEVE = () => { const out = {}, ex = new Set(document.querySelectorAll('#ui5 .sg-vue-b, #ui5 .sg-vue-b *'));
  const chemin = e => { const p = []; for (let x = e; x && x.id !== 'ui5'; x = x.parentElement) p.unshift(x.tagName + '.' + [...x.classList].join('.') + ':' + [...x.parentElement.children].indexOf(x)); return p.join('>'); };
  for (const e of document.querySelectorAll('#ui5 *')) { if (ex.has(e)) continue; const k = chemin(e);
    for (const ps of [null, '::before', '::after']) { const c = getComputedStyle(e, ps); if (ps && (c.content === 'none' || c.content === 'normal')) continue;
      const o = { __rendu: String(e.getClientRects().length > 0) }; for (let i = 0; i < c.length; i++) { const n = c[i]; if (/^(transition|animation)/.test(n)) continue; o[n] = c.getPropertyValue(n); } out[k + (ps || '')] = o; } }
  return out; };
(async () => {
  const { chromium } = require(navigateur.modulePlaywright()); const nav = await chromium.launch({ executablePath: navigateur.executable() });
  const res = {}; let n = 0, diffs = 0;
  const travaux = []; for (const th of THEMES) for (const pal of PALETTES) for (const w of LARGEURS) for (const [nom, sc] of Object.entries(SCENES).filter(([k]) => !process.env.SCENES || process.env.SCENES.split(',').includes(k))) travaux.push({ th, pal, w, nom, sc });
  let i = 0;
  await Promise.all(Array.from({ length: Number(process.env.PARALLELE || 4) }, async () => { while (i < travaux.length) { const { th, pal, w, nom, sc } = travaux[i++];
    const rel = [];
    for (const css of [REF, CAND]) {
      const ctx = await nav.newContext({ viewport: { width: w, height: 760 } }), page = await ctx.newPage();
      await page.route('**/panel-signal.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
      await preparer(page, sc); await ouvrirPanneau(page, '#automatic'); await page.waitForTimeout(700);
      await page.evaluate(([p, t]) => { window.ArianeUi5.agir('sg:choix:palette:' + p); window.ArianeUi5.agir('sg:choix:theme:' + t); }, [pal, th]);
      if (sc.onglet === 'file') await page.evaluate(() => window.ArianeUi5.agir('sg:onglet-file'));
      if (sc.onglet === 'correction') await page.evaluate(() => window.ArianeUi5.agir('sg:onglet-correction'));
      for (const a of sc.actions || []) await page.evaluate(x => window.ArianeUi5.agir(x), a);
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }); await page.waitForTimeout(300);
      rel.push(await page.evaluate(RELEVE)); await ctx.close();
    }
    const [a, b] = rel, d = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (!a[k] || !b[k]) { d.push(`${k} : ${a[k] ? 'absent du candidat' : 'absent de la référence'}`); continue; }
      if (a[k].__rendu === 'false' && b[k].__rendu === 'false') continue;   /* ni l'un ni l'autre n'est rendu (sous un display:none) : rien à voir */
      for (const p of Object.keys(a[k])) if (a[k][p] !== b[k][p]) d.push(`${k} { ${p}: ${a[k][p]} → ${b[k][p]} }`); }
    res[`${th}-${pal}-${w}-${nom}`] = d; n++; diffs += d.length;
  } }));
  await nav.close();
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(res, null, 1));
  for (const [k, v] of Object.entries(res)) if (v.length) console.log(k, '|', v.slice(0, 12).join(' | '), v.length > 12 ? `| … (${v.length})` : '');
  console.log(`${n} vues, ${diffs} différence(s)`);
})().catch(e => { console.error(e); process.exit(1); });
