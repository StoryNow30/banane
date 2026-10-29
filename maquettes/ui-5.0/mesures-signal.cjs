#!/usr/bin/env node
/* CH-023 : adaptation de ui-v2/sources/verifier.cjs et inventaire.cjs à Signal.
 * Usage : CHROMIUM=<exécutable> node maquettes/ui-5.0/mesures-signal.cjs
 *   --sortie <dossier hors dépôt> --phase r0 --captures Q-signal S-file-de-parties
 * Les inventaires sont faits à 600 × 760, dans le panneau seul. Les contrôles
 * couvrent les deux thèmes et les largeurs annoncées dans le résultat JSON.
 * Les captures restent hors dépôt. Aucun téléchargement de ressource n'est permis.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const argv = process.argv.slice(2);
const option = (nom, defaut) => { const i = argv.indexOf(nom); return i < 0 ? defaut : argv[i + 1]; };
const sortie = path.resolve(option('--sortie', path.join(__dirname, '../../../mesures-hors-depot')));
const phase = option('--phase', 'mesure');
const captures = argv.includes('--captures');
const noms = argv.filter((x, i) => !x.startsWith('--') && !['--sortie', '--phase'].includes(argv[i - 1]));
if (!noms.length) noms.push('Q-signal-b2', 'Q-signal-b3');
const largeurs = argv.includes('--rapide') ? [360, 600] : [360, 390, 420, 479, 480, 481, 540, 600];
if (sortie.startsWith(path.resolve(__dirname, '../..') + path.sep)) throw Error('Sortie exigée hors du dépôt');
fs.mkdirSync(sortie, { recursive: true });

/* Exécuté dans la page : même formule WCAG que le vérificateur acquis.
 * Ajouts : composition des fonds alpha, opacité héritée, exclusion des éléments
 * masqués par un dialogue, inert, hors du panneau ou coupés par un ascendant.
 * Une mesure sur fond image/dégradé est signalée comme limite, jamais certifiée.
 */
function relever() {
  const zone = document.getElementById('fen'), zr = zone.getBoundingClientRect();
  const couche = zone.querySelector('.boite, .palette, .feuille, .popover');
  const parse = c => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const melange = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const lum = c => {
    const f = x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; };
    return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b);
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
  const vis = el => {
    if (el.closest('[inert]') || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    if (couche && !couche.contains(el) && el !== couche) return false;
    const r = el.getBoundingClientRect();
    let l = Math.max(zr.left, 0, r.left), d = Math.min(zr.right, innerWidth, r.right);
    let h = Math.max(zr.top, 0, r.top), b = Math.min(zr.bottom, innerHeight, r.bottom);
    for (let e = el.parentElement; e && e !== zone; e = e.parentElement) {
      const s = getComputedStyle(e), q = e.getBoundingClientRect();
      if (s.overflowX !== 'visible') { l = Math.max(l, q.left); d = Math.min(d, q.right); }
      if (s.overflowY !== 'visible') { h = Math.max(h, q.top); b = Math.min(b, q.bottom); }
    }
    return d - l > .5 && b - h > .5;
  };
  const fond = el => {
    const pile = []; let complexe = false, opacite = 1;
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e); opacite *= Number(s.opacity);
      if (s.backgroundImage !== 'none') complexe = true;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) { pile.push(c); if (c.a === 1) break; }
    }
    let r = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = pile.length - 1; i >= 0; i--) r = melange(pile[i], r);
    return { couleur: r, complexe, opacite };
  };
  const ctl = el => /^(BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName) || el.getAttribute('role') === 'switch';
  const ensembles = Object.fromEntries(['tailles', 'graisses', 'couleurs', 'fonds', 'rayons', 'espacements', 'bordures', 'ombres', 'symboles'].map(k => [k, new Set()]));
  let elements = 0, surfaces = 0, textes = 0, min = 99;
  const ecarts = [], fondsComplexes = [], vus = new Set();
  for (const el of zone.querySelectorAll('*')) {
    if (!vis(el) || el instanceof SVGElement || el.closest('[aria-hidden="true"]')) continue;
    const s = getComputedStyle(el), texte = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
    const dansControle = [...vus].some(c => c !== el && c.contains(el));
    if (ctl(el) || el.getAttribute('role') === 'img' || el.hasAttribute('data-forme')) {
      if (!dansControle) { elements++; vus.add(el); }
    } else if (texte && !dansControle) elements++;
    const bd = ['Top', 'Right', 'Bottom', 'Left'].filter(c => parseFloat(s['border' + c + 'Width']) && s['border' + c + 'Style'] !== 'none' && !s['border' + c + 'Color'].endsWith(', 0)'));
    const bg = parse(s.backgroundColor);
    if ((bg && bg.a > 0) || bd.length) {
      surfaces++; ensembles.rayons.add(s.borderRadius);
      if (bg && bg.a > 0) ensembles.fonds.add(s.backgroundColor);
      for (const c of bd) ensembles.bordures.add([s['border' + c + 'Width'], s['border' + c + 'Style'], s['border' + c + 'Color']].join(' '));
    }
    for (const k of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'rowGap', 'columnGap']) {
      if (parseFloat(s[k]) > 0) ensembles.espacements.add(s[k]);
    }
    if (s.boxShadow !== 'none') ensembles.ombres.add(s.boxShadow);
    if (texte) {
      ensembles.tailles.add(s.fontSize); ensembles.graisses.add(s.fontWeight); ensembles.couleurs.add(s.color);
      const b = fond(el), c = parse(s.color); if (!c) continue;
      c.a *= b.opacite; const r = ratio(c.a < 1 ? melange(c, b.couleur) : c, b.couleur);
      textes++; min = Math.min(min, r);
      if (b.complexe) fondsComplexes.push(texte.slice(0, 60));
      if (r < 4.5 - .001) ecarts.push({ type: 'contraste', ratio: Number(r.toFixed(3)), texte: texte.slice(0, 70), classe: el.className });
    }
  }
  for (const el of zone.querySelectorAll('svg')) if (vis(el)) ensembles.symboles.add(el.closest('[data-act]')?.getAttribute('data-act') || el.closest('.glyphe')?.getAttribute('data-ton') || 'repere');
  const debordements = [];
  if (zone.scrollWidth > zone.clientWidth + 1) debordements.push('panneau');
  if (document.documentElement.scrollWidth > innerWidth + 1) debordements.push('page');
  const cibles = zone.querySelectorAll('.instrument, .barre, .boite, .palette, .feuille, .corps, .cache, .popover');
  for (const el of cibles) if (vis(el) && el.scrollWidth > el.clientWidth + 1) debordements.push(el.className);
  for (const el of zone.querySelectorAll('button,input,select')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.left < zr.left - 1 || r.right > zr.right + 1) debordements.push('controle:' + (el.getAttribute('data-act') || el.textContent.trim()).slice(0, 40));
  }
  for (const x of [...new Set(debordements)]) ecarts.push({ type: 'debordement', cible: x });
  const mouvements = zone.getAnimations({ subtree: true }).filter(a => a.playState === 'running' && a.effect?.getTiming().duration > 0).length;
  const valeurs = Object.fromEntries(Object.entries(ensembles).map(([k, v]) => [k, [...v].sort()]));
  return { elements, surfaces, textes, min: Number(min.toFixed(4)), ecarts, fondsComplexes: [...new Set(fondsComplexes)], mouvements, valeurs, nombre: Object.fromEntries(Object.entries(valeurs).map(([k, v]) => [k, v.length])) };
}

async function appliquer(page, cas, theme, w) {
  await page.evaluate(({ cas, theme, w }) => {
    const A = window.ArianeMaquette, R = document.documentElement;
    R.dataset.theme = theme; R.dataset.taille = w < 480 ? 'compact' : 'normal'; R.dataset.revue = cas.revue || 'v1'; R.dataset.reduit = '1';
    A.S.examines.clear(); A.S.cacheVide = false; A.scene(cas.scene);
    A.S.tiroir = !!cas.tiroir;
    if (cas.demande) A.sim.lot.etat = 'dem';
    if (cas.cause) { const e = document.querySelector('[data-sim="cause"]'); if (e) { e.value = cas.cause; e.dispatchEvent(new Event('change', { bubbles: true })); } }
    A.rendre();
    for (const e of document.querySelectorAll('#fen .corps, #fen .liste, #fen .instrument')) e.scrollTop = 0;
  }, { cas, theme, w });
}

(async () => {
  const nav = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'] });
  const rapport = { phase, navigateur: nav.version(), largeurs, themes: ['clair', 'sombre'], fichiers: [] };
  for (const nom of noms) {
    const page = await nav.newPage({ viewport: { width: 600, height: 760 }, reducedMotion: 'reduce' });
    const erreurs = [], reseau = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') erreurs.push(m.text()); });
    page.on('pageerror', e => erreurs.push(e.message));
    await page.route('**/*', route => {
      const u = new URL(route.request().url());
      if (u.protocol === 'file:' || u.protocol === 'data:') route.continue();
      else { reseau.push(u.hostname); route.abort(); }
    });
    const u = pathToFileURL(path.join(__dirname, nom + '.html')); u.search = 'nu=1&fige=1&reduit=1';
    await page.goto(u.href); await page.evaluate(() => document.fonts.ready);
    const scenes = await page.locator('#sc-scene option').evaluateAll(es => es.map(e => ({ nom: e.value, scene: e.value })));
    const cas = [...scenes, { nom: 'pause-demandee', scene: 'cours', demande: true }];
    for (const sc of ['cours', 'fin', 'echo', ...(scenes.some(x => x.scene === 'file-fin') ? ['file-cours', 'file-fin', 'file-alerte'] : [])]) {
      cas.push({ nom: sc + '-tiroir', scene: sc, tiroir: true });
      if (sc === 'fin') cas.push({ nom: 'fin-tiroir-v2', scene: sc, tiroir: true, revue: 'v2' });
    }
    if (scenes.some(x => x.scene === 'file-alerte')) for (const cause of ['onglet', 'muet', 'refus']) cas.push({ nom: 'file-alerte-' + cause, scene: 'file-alerte', cause });
    const f = { nom, scenes: scenes.map(x => x.scene), cas: cas.map(x => x.nom), controles: 0, textes: 0, min: 99, erreurs, reseau, ecarts: [], inventaire: [] };
    for (const theme of rapport.themes) for (const w of largeurs) {
      await page.setViewportSize({ width: w, height: w < 480 ? 480 : 760 });
      for (const c of cas) {
        await appliquer(page, c, theme, w);
        const r = await page.evaluate(relever);
        f.controles++; f.textes += r.textes; f.min = Math.min(f.min, r.min);
        for (const e of r.ecarts) f.ecarts.push({ theme, largeur: w, scene: c.nom, ...e });
        if (r.mouvements) f.ecarts.push({ theme, largeur: w, scene: c.nom, type: 'mouvement-reduit', nombre: r.mouvements });
        if (r.fondsComplexes.length) f.ecarts.push({ theme, largeur: w, scene: c.nom, type: 'fond-complexe', textes: r.fondsComplexes });
        if (w === 600) f.inventaire.push({ theme, scene: c.nom, ...r });
        if (captures && w === 600) await page.locator('#fen').screenshot({ path: path.join(sortie, phase + '-' + nom + '-' + theme + '-' + c.nom + '.png'), animations: 'disabled' });
      }
    }
    f.erreurs = [...new Set(erreurs)]; f.reseau = [...new Set(reseau)];
    rapport.fichiers.push(f);
    console.log(`${nom} : ${f.controles} surfaces contrôlées, ${f.textes} textes, minimum ${f.min.toFixed(2)}:1, ${f.ecarts.length} écarts, ${f.erreurs.length} erreurs`);
    console.log(JSON.stringify(f.ecarts.slice(0, 8)));
    await page.close();
    fs.writeFileSync(path.join(sortie, phase + '-mesures.json'), JSON.stringify(rapport, null, 2) + '\n');
  }
  await nav.close();
  process.exitCode = rapport.fichiers.some(f => f.ecarts.length || f.erreurs.length || f.reseau.length) ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 2; });
