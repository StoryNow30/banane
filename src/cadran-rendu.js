/* CH-135 (D-368) : L'INTERFACE ALTERNATIVE « CADRAN », tirée du prototype Figma « Direction A — Cadran » (banane-data, maquettes/figma-interface-alternative/).
 * Partie PURE : aucun DOM, aucun message, aucune API Chrome.
 *
 * Un instrument sobre : une voie vue de côté (deux rails, une traverse par cut, le plan de coupe bleu au cut en cours, un fanion orange par cut à
 * poser, un heurtoir pour l'arrêt, deux bornes pour le début et la fin), le mot d'état en capitales espacées, des filets fins (panel-cadran.css).
 *
 * Règle du ticket : « mêmes boutons et ordres, mêmes gardes : seule la présentation change ». Cadran part donc du rendu de l'instrument
 * (src/signal-rendu.js, `rendre`) : même modèle (`modele()`), mêmes écrans, mêmes `data-act`, mêmes boutons grisés, mêmes champs. Il ne remplace que
 * deux dessins, tirés de l'instantané sans rien recalculer :
 *   - l'anneau de la tuile d'état devient la VOIE (`voieHtml`) : statuts des cuts du lot (`sig.statuts`, src/ui5.js), cuts ciblés (`ar.cibles`) ;
 *     sans total connu, la voie s'arrête au dernier cut traité et s'ouvre en pointillé : aucun total inventé ;
 *   - le glyphe d'état devient la voie en miniature (`glyphe`).
 * Il ajoute « cut n/N » à droite du mot d'état quand le total est connu (maquette). Le reste (barre, couches, Constellation, Aurore, Ce qui reste,
 * Réglages) garde son balisage, que panel-cadran.css habille. Tout texte passe par `esc` (celui de l'instrument). */
(function (root, factory) {
  const S = typeof module === 'object' && typeof require === 'function' ? require('./signal-rendu.js') : root.ArianeSignalRendu;
  const api = factory(S);
  if (typeof module === 'object') module.exports = api; else root.ArianeCadranRendu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';
  const esc = S.esc;
  const MAX = 60;                       /* au-delà, une traverse par groupe de cuts : la voie reste lisible à 320 px */
  const H = 40, R1 = 15, R2 = 25;       /* hauteur de la voie, rails haut et bas (px) */
  const pc = v => `${(Math.round(v * 100) / 100).toFixed(2)}%`;
  /* Ordre de priorité d'un groupe de cuts : le plus parlant l'emporte (un cut incertain, puis un cut à poser, puis le cut en cours). */
  const RANG = { incertain: 6, differe: 5, cours: 4, main: 3, saute: 2, voie: 1, pose: 1 };
  const CLASSE = { incertain: 'cd-incident', differe: 'cd-differe', cours: 'cd-cours', main: 'cd-main', saute: 'cd-saute', voie: 'cd-pose', pose: 'cd-pose' };

  /* ------------------------------------------------------------------ la voie */
  /* `T` : traverses [{classe, fanion}] ; `N` : nombre de places ; `fait` : places faites (rails pleins jusque-là) ;
   * `coupe` : place du plan de coupe ({i, pause}) ; `heurtoir` : place de l'arrêt ; `bornes` : deux bornes ; `ouvert` : total inconnu. */
  function voieSvg({ T = [], N = 0, fait = 0, coupe = null, heurtoir = null, bornes = false, ouvert = false, coupures = [] }) {
    const pad = 1.6, larg = 100 - 2 * pad, x = i => pad + (N ? (i + 0.5) / N : 0) * larg, bord = i => pad + (N ? i / N : 0) * larg;
    const xf = ouvert ? 100 - pad - 14 : bord(fait);
    let h = '';
    /* rails : la part faite en plein, le reste en filet clair ; total inconnu : un pointillé après le dernier cut traité */
    for (const y of [R1, R2]) {
      if (fait > 0 || ouvert) h += `<line class="cd-rail cd-fait" x1="${pc(pad)}" x2="${pc(fait > 0 ? (ouvert ? xf : bord(fait)) : pad)}" y1="${y}" y2="${y}"/>`;
      if (!ouvert) h += `<line class="cd-rail" x1="${pc(fait > 0 ? bord(fait) : pad)}" x2="${pc(100 - pad)}" y1="${y}" y2="${y}"/>`;
    }
    if (ouvert) h += `<line class="cd-ouvert" x1="${pc(xf)}" x2="${pc(100 - pad)}" y1="${(R1 + R2) / 2}" y2="${(R1 + R2) / 2}"/>`;
    for (const c of coupures) h += `<line class="cd-coupure" x1="${pc(bord(c))}" x2="${pc(bord(c))}" y1="${R1 - 6}" y2="${R2 + 6}"/>`;
    T.forEach((t, i) => {
      const haut = t.classe === 'cd-vide' ? [R1 + 2, R2 - 2] : [R1 - 4, R2 + 4];
      h += `<line class="cd-tr ${t.classe}" x1="${pc(x(i))}" x2="${pc(x(i))}" y1="${haut[0]}" y2="${haut[1]}"/>`;
    });
    T.forEach((t, i) => { if (t.fanion) h += `<svg class="cd-fanion" x="${pc(x(i))}" y="0" overflow="visible"><path d="M0 ${R1 - 4}V1"/><path class="cd-drapeau" d="M0 1h7l-2 2.6 2 2.6H0z"/></svg>`; });
    if (coupe) {
      const c = Math.min(Math.max(0, coupe.i), Math.max(0, N - 1)), xc = N ? x(c) : pad;
      h += coupe.pause
        ? `<svg class="cd-coupe cd-pause" x="${pc(xc)}" y="0" overflow="visible"><path d="M-2.5 3V37M2.5 3V37M-5 3h10M-5 37h10"/></svg>`
        : `<line class="cd-coupe" x1="${pc(xc)}" x2="${pc(xc)}" y1="3" y2="37"/><svg class="cd-coupe-c" x="${pc(xc)}" y="0" overflow="visible"><path d="M-4 3h8M-4 37h8"/></svg>`;
    }
    if (heurtoir !== null) h += `<svg class="cd-heurtoir" x="${pc(bord(Math.min(N, heurtoir)))}" y="0" overflow="visible"><path d="M1 ${R1 - 7}h4V${R2 + 7}H1"/></svg>`;
    if (bornes) h += `<svg class="cd-borne" x="${pc(pad)}" y="0" overflow="visible"><path d="M4 ${R1 - 8}H0V${R2 + 8}H4"/></svg><svg class="cd-borne" x="${pc(100 - pad)}" y="0" overflow="visible"><path d="M-4 ${R1 - 8}H0V${R2 + 8}H-4"/></svg>`;
    return `<svg class="cd-voie-svg" width="100%" height="${H}" aria-hidden="true">${h}</svg>`;
  }
  /* Les statuts (un par cut, dans l'ordre du lot) groupés en au plus MAX places. */
  function traverses(statuts, total) {
    const n = Math.max(total, statuts.length), k = Math.max(1, Math.ceil(n / MAX)), N = Math.ceil(n / k), T = [];
    for (let i = 0; i < N; i++) {
      const g = statuts.slice(i * k, (i + 1) * k);
      const s = g.reduce((m, x) => (RANG[x] || 0) > (RANG[m] || 0) ? x : m, null);
      T.push({ classe: s ? CLASSE[s] || 'cd-pose' : 'cd-vide', fanion: g.includes('differe') });
    }
    return { T, N, k };
  }
  function voieOrbite(snap, label) {
    const a = snap.ar || {}, g = snap.sig || {}, st = (Array.isArray(g.statuts) ? g.statuts : []).filter(x => x !== 'cours');
    const total = Number.isInteger(a.cibles) && a.cibles > 0 ? a.cibles : null, e = a.etat;
    const ouvert = total === null && e !== 'fini' && e !== 'pret';
    const { T, N, k } = traverses(st, total ?? st.length);
    const fait = Math.ceil(st.length / k), o = { T, N, fait, ouvert };
    if (e === 'cours' || e === 'dem' || e === 'alerte') o.coupe = { i: Math.floor(st.length / k), pause: e === 'dem' };
    else if (e === 'pause') o.coupe = { i: Math.min(N - 1, fait), pause: true };
    else if (e === 'rel') { const R = snap.relChiffres; if (R && R.total > 0) o.coupe = { i: Math.floor(Math.min(1, R.faits / R.total) * N), pause: R.etat === 'en-pause' }; }
    if (e === 'arrete') o.heurtoir = fait;
    if (e === 'fini' || e === 'pret') o.bornes = true;
    if (o.coupe && N === 0) delete o.coupe;
    return `<div class="cd-voie" role="img" aria-label="${esc(label)}">${voieSvg(o)}</div>`;
  }
  /* Écho : une traverse par visite (les 60 dernières), plus haute quand le cut a été corrigé ; le plan de coupe après la dernière tant qu'Écho observe. */
  function voieEcho(snap, label, glyphe) {
    const M = (snap.sig?.echo?.marques || []).slice(-MAX), en = glyphe === 'echo';
    const N = Math.max(M.length + (en ? 1 : 0), 1);
    const T = M.map(c => ({ classe: c ? 'cd-corr' : 'cd-pose', fanion: false }));
    return `<div class="cd-voie" role="img" aria-label="${esc(label)}">${voieSvg({ T, N, fait: M.length, coupe: en ? { i: M.length } : null, ouvert: false })}</div>`;
  }
  /* Aurore (anneau à segments de l'instrument : un arc par partie, à la mesure de ses cuts) : un tronçon de voie par partie, coupé par un filet ;
   * les traverses faites en plein. Lu sur le dessin de l'instrument (longueurs de ses arcs), sans rien recalculer. */
  function voieSegments(anneau, label) {
    const cer = [...anneau.matchAll(/<circle class="sg-(piste|arc)"(?: data-etat="([^"]*)")?(?: data-partie="[^"]*")? cx="50" cy="50" r="[^"]*" stroke-dasharray="([\d.]+) /g)];
    const segs = []; for (let i = 0; i + 1 < cer.length; i += 2) { const L = Number(cer[i][3]), f = L > 0 ? Number(cer[i + 1][3]) / L : 0; segs.push({ L, f, etat: cer[i + 1][2] || '' }); }
    const tot = segs.reduce((x, y) => x + y.L, 0) || 1, N = Math.min(MAX, Math.max(segs.length * 4, 24)), T = [], coupures = [];
    let deb = 0;
    segs.forEach((sg, j) => {
      const n = Math.max(1, Math.round(sg.L / tot * N)), faits = Math.round(sg.f * n);
      for (let i = 0; i < n; i++) T.push({ classe: i < faits ? 'cd-pose' : 'cd-vide', fanion: false });
      deb += n; if (j < segs.length - 1) coupures.push(deb);
    });
    return `<div class="cd-voie cd-voie-seg" role="img" aria-label="${esc(label)}">${voieSvg({ T, N: T.length, fait: 0, coupures, bornes: true })}</div>`;
  }

  /* ------------------------------------------------------------------ le glyphe : la voie en miniature */
  const G_RAILS = '<path class="cd-g-r" d="M3 9.5H29M3 14.5H29"/>', G_TR = '<path class="cd-g-t" d="M7 6V18M11 6V18M15 6V18"/>';
  const GLYPHES = {
    pret: '<path class="cd-g-t" d="M5 4H3V20H5M27 4H29V20H27"/><path class="cd-g-p" d="M6 9.5H26M6 14.5H26"/>',
    hors: '<path class="cd-g-t" d="M5 4H3V20H5"/><path class="cd-g-p" d="M6 9.5H22M6 14.5H22"/>',
    cours: `${G_RAILS}${G_TR}<path class="cd-g-c" d="M20 3V21M18 3h4M18 21h4"/><path class="cd-g-p" d="M23 9.5H29M23 14.5H29"/>`,
    dem: `${G_RAILS}${G_TR}<path class="cd-g-c" d="M19 3V21M22 3V21"/>`,
    pause: `${G_RAILS}${G_TR}<path class="cd-g-c" d="M19 3V21M22 3V21"/>`,
    arrete: `${G_RAILS}${G_TR}<path class="cd-g-t" d="M18 5h3V19h-3"/><path class="cd-g-p" d="M23 9.5H29M23 14.5H29"/>`,
    fini: '<path class="cd-g-t" d="M5 4H3V20H5M27 4H29V20H27M7 6V18M11 6V18M15 6V18M19 6V18M23 6V18"/><path class="cd-g-r" d="M3 9.5H29M3 14.5H29"/>',
    toi: `${G_RAILS}${G_TR}<path class="cd-g-a" d="M20 3V21"/>`,
    interrompu: `${G_RAILS}${G_TR}<path class="cd-g-a" d="M20 3V21M17.5 3h5M17.5 21h5"/>`,
    verrou: `${G_RAILS}${G_TR}<path class="cd-g-f" d="M19 13V2.5h6l-1.6 2 1.6 2H19"/>`,
    relecture: `${G_RAILS}<path class="cd-g-t" d="M7 6V18M11 6V18M15 6V18M19 6V18M23 6V18"/><path class="cd-g-c" d="M26 3V21"/>`,
    relpause: `${G_RAILS}<path class="cd-g-t" d="M7 6V18M11 6V18M15 6V18M19 6V18"/><path class="cd-g-c" d="M23.5 3V21M26.5 3V21"/>`,
    echo: `${G_RAILS}<path class="cd-g-t" d="M7 6V18M11 6V18M15 4V20"/><path class="cd-g-c" d="M20 3V21"/>`,
  };
  const glyphe = g => `<svg viewBox="0 0 32 24" aria-hidden="true" fill="none" stroke-width="1.5">${GLYPHES[g] || `${G_RAILS}${G_TR}`}</svg>`;

  /* ------------------------------------------------------------------ rendu */
  const RE_ANNEAU = /<div class="sg-anneau( sg-anneau-seg)?"[^>]*?aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/svg><span class="sg-anneau-c">[\s\S]*?<\/span><\/div>/;
  function rendre(snap, ui) {
    const s = snap || {}, u = ui || {}, a = s.ar || {};
    let h = S.rendre(s, u);
    const tete = (h.match(/^<div class="sg-fen" data-activite="([^"]*)" data-etat="([^"]*)"/) || []);
    const activite = tete[1] || '';
    const g0 = (h.match(/<i class="sg-glyphe" data-g="([^"]*)"/) || [])[1] || '';
    /* l'anneau de la tuile d'état devient la voie */
    h = h.replace(RE_ANNEAU, (tout, seg, label, svg) => {
      const lab = label.replace(/&#39;/g, '’').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      if (seg) return voieSegments(svg, lab);
      if (activite === 'echo') return voieEcho(s, lab, g0);
      return voieOrbite(s, lab);
    });
    /* le glyphe d'état : la voie en miniature */
    h = h.replace(/<i class="sg-glyphe" data-g="([^"]*)" data-ton="([^"]*)" aria-hidden="true"><\/i>/g, (t, g, ton) => `<i class="sg-glyphe cd-glyphe" data-g="${g}" data-ton="${ton}" aria-hidden="true">${glyphe(g)}</i>`);
    /* « cut n/N » à droite du mot d'état (maquette) : le cut en cours (traités + 1), le dernier quand le lot est terminé ; seulement si le total est connu */
    const N = Number.isInteger(a.cibles) && a.cibles > 0 ? a.cibles : null;
    if (activite === 'orbite' && N && ['cours', 'dem', 'pause', 'arrete', 'alerte', 'fini'].includes(a.etat)) {
      const n = a.etat === 'fini' ? Math.min(N, a.traites || 0) : Math.min(N, (a.traites || 0) + 1);
      h = h.replace(/(<section class="sg-instrument[^"]*"[^>]*><div class="sg-haut">[\s\S]*?)(<\/div><div class="sg-milieu">)/, `$1<span class="cd-cut sg-mono">cut ${n}/${N}</span>$2`);
    }
    /* Bascule de la vue du lot « instrument / fil » (CH-134, D-368) : l'état est `ui.vueLot`, l'action `sg:vue-lot` est câblée par CH-134 dans src/ui5.js.
     * Si le rendu de l'instrument porte déjà le bouton (CH-134 fusionnée), Cadran le garde tel quel ; sinon il le pose ici, au même endroit logique (la tête,
     * quand un lot est ouvert ou fini, pas hors ESV), et pose `data-vue="fil"` sur la fenêtre. */
    const lotVu = activite === 'orbite' && (a.lotOuvert || ['fini', 'arrete'].includes(a.etat)) && g0 !== 'hors';
    if (lotVu && !h.includes('data-act="sg:vue-lot"')) {
      const fil = u.vueLot === 'fil';
      h = h.replace(/(<section class="sg-instrument[^"]*"[^>]*><div class="sg-haut">[\s\S]*?)(<\/div><div class="sg-milieu">)/, `$1<button type="button" class="sg-vue-b" data-act="sg:vue-lot" aria-pressed="${fil}" aria-label="${fil ? 'Vue instrument' : 'Vue fil'}" title="${fil ? 'Vue instrument' : 'Vue fil'}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h16M4 12h16M4 18h10"/></svg></button>$2`);
      if (fil && !/^<div class="sg-fen"[^>]*data-vue=/.test(h)) h = h.replace(/^(<div class="sg-fen"[^>]*?)>/, '$1 data-vue="fil">');
    }
    /* les compteurs de la maquette : Posés · À poser · Reste, quand le reste est connu (sinon ceux de l'instrument : Traités · Posés · À poser) */
    if (activite === 'orbite' && Number.isInteger(a.restants)) h = h.replace(/<dl class="sg-trio"><div><dt>Traités<\/dt><dd class="sg-n">[^<]*<\/dd><\/div>(<div><dt>Posés<\/dt><dd class="sg-n">[^<]*<\/dd><\/div><div><dt>À poser<\/dt><dd class="sg-n[^"]*">[^<]*<\/dd><\/div>)<\/dl>/,
      (t, deux) => `<dl class="sg-trio">${deux}<div><dt>Reste</dt><dd class="sg-n cd-reste">${esc(a.restants)}</dd></div></dl>`);
    return h;
  }

  return { rendre, voieSvg, traverses, glyphe };
});
