'use strict';
/* CH-115 : AUDIT « page validée contre vrai panneau ». La page validée (comparaison-epure.html, colonnes « Après ») est rejouée telle quelle : arbre du commit
 * de la page (MAQ_RACINE, un `git worktree` hors dépôt) + feuilles et scripts de chantiers/CH-115/directions de cet arbre. Le vrai panneau : l'arbre courant.
 * Mêmes états fabriqués (chantiers/CH-104/outils/capturer.cjs), même taille, mêmes palettes ; animations et transitions arrêtées pour mesurer l'état posé.
 * Mesure, par bloc (ligne d'état, anneau, titre, phrase, frise, trace, avis, boutons…), la boîte (x, y, largeur, hauteur, par rapport à la fenêtre) et
 * quelques styles (fond, couleur, police, ombre, arc). Écrit SORTIE/audit.json et SORTIE/ecarts.md ; photos à 2 × si PHOTOS=1. Rien dans le dépôt.
 * Usage : MAQ_RACINE=/chemin/arbre-04b1142 CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-115/outils/audit.cjs SORTIE [filtre] */
const path = require('node:path'), fs = require('node:fs');
const R = path.resolve(__dirname, '../../..'), MAQ = process.env.MAQ_RACINE;
const SORTIE = process.argv[2], FILTRE = process.argv[3] || '';
if (!SORTIE || !MAQ) { console.error('MAQ_RACINE et dossier de sortie attendus.'); process.exit(2); }
fs.mkdirSync(SORTIE, { recursive: true });
const navigateur = require(R + '/tests/esv-maquette/navigateur.cjs');
const { E, lot } = require(R + '/chantiers/CH-104/outils/capturer.cjs');
const avecFile = s => ({ ...s, fileParties: s.fileParties ?? null });
const SCENES = {
  repos: { state: E.pret.state }, cours: { state: E.cours.state }, pause: { state: E.pause.state }, toi: { state: E.toi.state },
  rattrapage: { state: E.rattrapage.state }, relecture: { state: E.relecture.state, rel: E.relecture.rel }, fin: { state: E.fin.state },
  constellation: { ...E['file-cours'], onglet: 'file' }, passage: { ...E['file-passage'], onglet: 'file' }, 'file-fin': { ...E['file-fin'], onglet: 'file' },
  aurore: { state: E.aurore.state, onglet: 'correction' }, panne: { state: E.panne.state }, erreur: { state: lot('ERROR', 4811, { activeIdentity: null }) },
};
const TAILLES = { etroit: { width: 380, height: 640 }, large: { width: 600, height: 760 } };
const DIR = p => path.join(MAQ, 'chantiers/CH-115/directions', p);
const css = pal => ['commun.css', 'b.css', 'b2.css', `b2-${pal}.css`, 'epure2.css'].map(f => fs.readFileSync(DIR(f), 'utf8')).join('\n');
const jsMaq = () => fs.readFileSync(DIR('maquette.js'), 'utf8') + '\n;' + fs.readFileSync(DIR('motion.js'), 'utf8');
const ARRET = '*,*::before,*::after{animation:none!important;transition:none!important}';
const BLOCS = {
  tuile: '#ui5 .sg-tu-etat', haut: '#ui5 .sg-tu-etat>.sg-haut', mot: '#ui5 .sg-tu-etat .sg-mot', partie: '#ui5 .sg-tu-etat .sg-partie', anneau: '#ui5 .sg-tu-etat .sg-anneau',
  arc: '#ui5 .sg-tu-etat .sg-anneau .sg-arc', chiffre: '#ui5 .sg-tu-etat .sg-anneau .sg-chiffre', titre: '#ui5 .sg-constel-t .sg-chiffre', rang: '#ui5 .sg-constel-t .sg-suite',
  phrase: '#ui5 .sg-tu-etat .sg-phrase', chaine: '#ui5 .sg-chaine', courant: '#ui5 .sg-chaine li[data-etat="en-cours"] i', trace: '#ui5 .sg-tu-fil', point1: '#ui5 .sg-fil li:first-child',
  avis: '#ui5 .sg-tu-avis', fin: '#ui5 .sg-tu-fin', poignee: '#ui5 .sg-poignee', bouton1: '#ui5 .sg-actions>button:nth-child(1)', bouton2: '#ui5 .sg-actions>button:nth-child(2)', bouton3: '#ui5 .sg-actions>button:nth-child(3)',
  liste: '#ui5 .sg-tu-liste', onglet: '#ui5 .sg-bascule [aria-selected="true"]',
};
const MESURE = (BLOCS) => {
  const fen = document.querySelector('#ui5 .sg-fen'); if (!fen) return null; const F = fen.getBoundingClientRect(), out = {};
  const st = (e, ps, pe) => { const s = getComputedStyle(e, pe || null); return Object.fromEntries(ps.map(p => [p, s.getPropertyValue(p)])); };
  const vu = e => { if (!e || !e.getClientRects().length) return false; for (let x = e; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
  for (const [k, sel] of Object.entries(BLOCS)) {
    const e = document.querySelector(sel); if (!vu(e)) continue; const r = e.getBoundingClientRect();
    out[k] = { x: Math.round(r.left - F.left), y: Math.round(r.top - F.top), w: Math.round(r.width), h: Math.round(r.height),
      ...st(e, ['background-color', 'color', 'font-size', 'font-weight', 'box-shadow', 'border-radius', 'stroke', 'stroke-width', 'background-image']) };
    if (k === 'arc') out[k].tableau = e.getAttribute('stroke-dasharray'), out[k].svg = getComputedStyle(e.closest('svg')).transform;
  }
  out.fen = { ...st(fen, ['background-color', '--accent', '--fond', '--tuile']) };
  /* la commande des détails : le bouton (vrai panneau) ou le libellé posé en ::after (page validée) */
  const b = document.querySelector('#ui5 .sg-details-b');
  /* comparés : le texte (espaces réduits, comme à l'écran), les styles, et les retraits au bord bas et droit de la tuile (seule mesure possible d'un ::after) */
  const tx = v => String(v || '').replace(/^"|"$/g, '').replace(/^none$|^normal$/, '').replace(/\s+/g, ' ').trim();
  const T = document.querySelector('#ui5 .sg-tu-etat'), TR = T && T.getBoundingClientRect();
  if (vu(b)) { const r = b.getBoundingClientRect(); out.details = { texte: tx(b.textContent + String(getComputedStyle(b, '::after').content).replace(/^"|"$/g, '').replace(/^none$/, '')), ...st(b, ['font-size', 'font-weight', 'text-transform', 'color', 'box-shadow', 'opacity', 'letter-spacing', 'padding']), bas: Math.round(TR.bottom - r.bottom), droite: Math.round(TR.right - r.right) }; }
  else if (T) { const s = getComputedStyle(T, '::after'); if (tx(s.content)) out.details = { texte: tx(s.content), 'font-size': s.fontSize, 'font-weight': s.fontWeight, 'text-transform': s.textTransform, color: s.color, 'box-shadow': s.boxShadow, opacity: s.opacity, 'letter-spacing': s.letterSpacing, padding: s.padding, bas: Math.round(parseFloat(s.bottom)), droite: Math.round(parseFloat(s.right)) }; }
  return out;
};
async function mesurer(nav, racine, maquette, sc, vp, pal, photo) {
  const { ouvrirPanneau } = require(racine + '/tests/helpers/panneau-local.cjs');
  const ctx = await nav.newContext({ viewport: vp, deviceScaleFactor: photo ? 2 : 1 }), page = await ctx.newPage(), erreurs = [];
  page.on('pageerror', x => erreurs.push(x.message));
  const state = JSON.parse(JSON.stringify({ connection: { status: 'ready', observedAt: 't', message: null, tabId: 1 }, ...avecFile(sc.state) }).replace(/"MAINTENANT-(\d+)"/g, (_, s) => JSON.stringify(new Date(Date.now() - s * 1000).toISOString())));
  await page.addInitScript(({ state, rel, fiches }) => {
    const rep = { view: state, 'list-tabs': [{ id: 1, title: 'ESV', pret: true, utilise: true, index: 0, windowId: 1, active: true }], 'choix-lot-etat': { clicHumain: 'tel-quel', regleGrappeDifferes: false }, 'raison-choix-etat': { actif: false, touches: 'chiffres' },
      'relecture-choix-etat': { mode: 'corriger' }, 'relecture-etat': rel, 'bandeau-etat': { on: false }, 'fiches-depart': { fiches } }, st = {};
    window.fetch = async () => ({ json: async () => ({ totaux: { tous: { corriges: 2731 } }, creeLe: '2026-10-20T08:00:00Z' }) });
    window.chrome = { runtime: { id: 'essai', getURL: p => new URL(p, location.href).href, connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }), sendMessage: async m => ({ result: m.action in rep ? rep[m.action] : {} }) },
      storage: { local: { get: async () => ({ ...st }), set: async o => { Object.assign(st, o); } } }, windows: { getCurrent: async () => ({ id: 1, type: 'normal', width: 600, height: 760 }), update: async () => ({}) } };
  }, { state, rel: sc.rel || { choix: 'corriger', lot: null, passe: null }, fiches: sc.fiches || [] });
  await ouvrirPanneau(page, '#automatic'); await page.waitForTimeout(1100);
  if (maquette) { await page.addStyleTag({ content: css(pal) }); await page.addScriptTag({ content: jsMaq() }); }
  else await page.evaluate(p => window.ArianeUi5.agir('sg:choix:palette:' + p), pal);
  if (sc.onglet === 'file') await page.evaluate(() => window.ArianeUi5.agir('sg:onglet-file'));
  if (sc.onglet === 'correction') await page.evaluate(() => window.ArianeUi5.agir('sg:onglet-correction'));
  await page.waitForTimeout(500); await page.addStyleTag({ content: ARRET }); await page.waitForTimeout(400);
  const m = await page.evaluate(MESURE, BLOCS);
  if (photo) await page.screenshot({ path: photo });
  await ctx.close(); return { m, erreurs };
}
const ecarts = (a, b) => {
  const L = [];
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    if (!a?.[k] || !b?.[k]) { L.push(`${k} : ${a?.[k] ? 'absent du vrai panneau' : 'en plus dans le vrai panneau'}`); continue; }
    for (const p of new Set([...Object.keys(a[k]), ...Object.keys(b[k])])) {
      const x = a[k][p], y = b[k][p];
      if (['x', 'y', 'w', 'h', 'bas', 'droite'].includes(p)) { if (Math.abs((x ?? 0) - (y ?? 0)) > 2) L.push(`${k}.${p} : ${x} → ${y}`); }
      else if (String(x ?? '') !== String(y ?? '')) L.push(`${k}.${p} : « ${x ?? '—'} » → « ${y ?? '—'} »`);
    }
  }
  return L;
};
(async () => {
  const { chromium } = require(navigateur.modulePlaywright()); const nav = await chromium.launch({ executablePath: navigateur.executable() });
  const res = {}, md = ['# CH-115 : écarts page validée → vrai panneau (plus de 2 px, ou style différent)', ''];
  let total = 0;
  for (const pal of ['glacier', 'sarcelle']) for (const [t, vp] of Object.entries(TAILLES)) for (const [s, sc] of Object.entries(SCENES)) {
    const cle = `${pal}-${t}-${s}`; if (FILTRE && !cle.includes(FILTRE)) continue;
    const ph = process.env.PHOTOS === '1';
    const a = await mesurer(nav, MAQ, true, sc, vp, pal, ph && path.join(SORTIE, cle + '-maquette.png'));
    const b = await mesurer(nav, R, false, sc, vp, pal, ph && path.join(SORTIE, cle + '-vrai.png'));
    const L = ecarts(a.m, b.m); total += L.length; res[cle] = { maquette: a.m, vrai: b.m, ecarts: L, erreurs: [...a.erreurs, ...b.erreurs] };
    md.push(`## ${cle} : ${L.length ? L.length + ' écart(s)' : 'identique à 2 px près'}`, ...L.map(x => '- ' + x), ...(res[cle].erreurs.length ? ['- ERREURS : ' + res[cle].erreurs.join(' | ')] : []), '');
    console.log(cle, L.length);
  }
  await nav.close();
  fs.writeFileSync(path.join(SORTIE, 'audit.json'), JSON.stringify(res, null, 1)); fs.writeFileSync(path.join(SORTIE, 'ecarts.md'), md.join('\n'));
  console.log(`total : ${total} écart(s)`);
})().catch(e => { console.error(e); process.exit(1); });
