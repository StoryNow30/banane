/* CH-137 (D-371, D-372) : L'INTERFACE ALTERNATIVE « MIX », d'après la planche Figma « Q4 sombre (mix strict) » (banane-data, maquettes/figma-signal-mix-q4/).
 * Partie PURE : aucun DOM, aucun message, aucune API Chrome.
 *
 * Fond uni ; le mot d'état (Plex Sans 28) et son icône ; la phrase dessous ; un GROS CHIFFRE (Plex Mono 44) et sa légende ; une RÉGLETTE graduée
 * (0, milieu, N) dont l'aiguille est ambre pendant le lot et claire en pause ; la ligne d'allure ; une seule action pleine claire, les autres en texte ;
 * un encadré à filet corail pour ce qui attend l'opérateur ; « Ce qui reste » puis le pied « Cache des exports » en bas (panel-mix.css).
 *
 * Règle du ticket : mêmes boutons, mêmes `data-act`, mêmes gardes que Glacier. Mix part donc du rendu de Glacier (src/signal-rendu.js, `rendre`, et
 * son modèle `modele`) et ne remplace que des dessins, tirés de l'instantané sans rien inventer :
 *   - l'anneau de la tuile d'état devient le gros chiffre et la réglette (`compteHtml`, `regletteHtml`) ; sans total connu, pas de réglette ;
 *     quand la planche n'en porte pas (à toi, interrompu, rattrapage, hors ligne, fin), rien ;
 *   - le glyphe devient l'icône d'état de la planche (`icone`) ;
 *   - la ligne « à poser » prend son titre « Ce qui reste » (« Visites » dans Écho) ;
 *   - deux EXTRAS marqués `data-mx-extra` (raccourcis de commandes que Glacier offre dans son menu « ··· ») : le bouton « Commandes » de la barre et le
 *     pied « Cache des exports » (le même bouton que celui du menu, avec la même garde) ;
 *   - la ligne « Palette » des Réglages est retirée : la palette ne vaut que pour Glacier (D-371). Tout texte passe par `esc` (celui de Glacier). */
(function (root, factory) {
  const S = typeof module === 'object' && typeof require === 'function' ? require('./signal-rendu.js') : root.ArianeSignalRendu;
  const api = factory(S);
  if (typeof module === 'object') module.exports = api; else root.ArianeMixRendu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';
  const esc = S.esc;
  const pl = (n, un, plusieurs) => Number(n) > 1 ? plusieurs : un;
  const entier = v => Number.isInteger(v) && v > 0 ? v : null;
  const W = 1000;   /* largeur du dessin de la réglette (viewBox), étirée à la largeur de la tuile */

  /* ------------------------------------------------------------------ la réglette */
  /* `N` : total connu ; `fait` : cuts faits (trait plein jusque-là) ; `marques` : positions (0 à N-1) des cuts à poser ; `aiguille` : ton ('marche',
   * 'pause') ou null ; `graduations` : 0, milieu, N sous le trait. */
  function regletteHtml({ N, fait = 0, marques = [], aiguille = null }, label) {
    const x = i => (Math.max(0, Math.min(N, i)) / N * W).toFixed(1), xf = x(fait);
    let h = '';
    for (let k = 0; k <= 10; k++) h += `<line class="mx-tick${k % 5 ? '' : ' mx-tick-fort'}" x1="${(k * W / 10).toFixed(1)}" x2="${(k * W / 10).toFixed(1)}" y1="${k % 5 ? 30 : 28}" y2="36"/>`;
    if (fait > 0) h += `<line class="mx-fait" x1="0" x2="${xf}" y1="20" y2="20"/>`;
    h += `<line class="mx-reste" x1="${fait > 0 ? xf : 0}" x2="${W}" y1="20" y2="20"/>`;
    for (const i of marques) h += `<line class="mx-marque" x1="${x(i + 0.5)}" x2="${x(i + 0.5)}" y1="14" y2="26"/>`;
    if (aiguille) h += `<g class="mx-aiguille" data-ton="${aiguille}"><line x1="${xf}" x2="${xf}" y1="8" y2="28"/><rect x="${(Number(xf) - 4).toFixed(1)}" y="6" width="8" height="5"/></g>`;
    const milieu = Math.round(N / 2);
    return `<div class="mx-reglette" role="img" aria-label="${esc(label)}"><div class="mx-grad"><span>0</span><span>${esc(milieu)}</span><span>${esc(N)}</span></div><svg viewBox="0 0 ${W} 40" preserveAspectRatio="none" aria-hidden="true">${h}</svg></div>`;
  }
  /* Écho : un trait par visite (les 60 dernières), haut quand le cut a été corrigé, court quand il a été validé tel quel ; un trait ambre pour la visite en cours. */
  function regletteEcho(marques, enCours, label) {
    const M = marques.slice(-60), n = M.length + (enCours ? 1 : 0); if (!n) return '';
    const pas = W / 60, x0 = W - n * pas;
    let h = '';
    M.forEach((c, i) => { const x = (x0 + (i + 0.5) * pas).toFixed(1); h += `<line class="mx-visite${c ? ' mx-corr' : ''}" x1="${x}" x2="${x}" y1="${c ? 6 : 18}" y2="30"/>`; });
    if (enCours) { const x = (x0 + (n - 0.5) * pas).toFixed(1); h += `<line class="mx-visite mx-en" x1="${x}" x2="${x}" y1="6" y2="30"/>`; }
    return `<div class="mx-reglette" data-forme="echo" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 ${W} 36" preserveAspectRatio="none" aria-hidden="true">${h}</svg></div>`;
  }
  const compteHtml = (chiffre, legende, droite) => `<div class="mx-compte"><div class="mx-g"><b class="mx-chiffre">${esc(chiffre)}</b><span class="mx-leg">${esc(legende)}</span></div><div class="mx-d">${droite || ''}</div></div>`;

  /* Le gros chiffre et la réglette d'Orbite et d'Écho, d'après le modèle de Glacier (`m`) et l'instantané ; '' quand la planche n'en porte pas. */
  function tuileChiffre(s, m, label) {
    const a = s.ar || {}, g = s.sig || {};
    if (m.activite === 'echo') {
      if (m.objet !== 'echo') return '';
      const c = m.compteEcho || { vus: 0, corriges: 0, valides: 0 };
      return compteHtml(c.vus, pl(c.vus, 'cut vu', 'cuts vus'), `<b>${esc(c.corriges)}</b> ${pl(c.corriges, 'corrigé', 'corrigés')} · <b>${esc(c.valides)}</b> ${pl(c.valides, 'validé tel quel', 'validés tels quels')}`)
        + regletteEcho(g.echo?.marques || [], m.glyphe === 'echo', label);
    }
    if (m.verrou || m.fileBilan || m.glyphe === 'hors') return '';
    const N = entier(a.cibles);
    if (a.etat === 'pret') return N ? compteHtml(N, 'cuts ciblés · aucun traité', '') + regletteHtml({ N }, label) : '';
    if (['cours', 'dem', 'pause'].includes(a.etat)) {
      const t = a.traites || 0, st = (Array.isArray(g.statuts) ? g.statuts : []).filter(x => x !== 'cours');
      const marques = st.map((x, i) => x === 'differe' ? i : -1).filter(i => i >= 0);
      return compteHtml(t, N ? `${pl(t, 'traité', 'traités')} sur ${N} ciblés` : pl(t, 'traité', 'traités'), `<b>${esc(a.poses || 0)}</b> ${pl(a.poses || 0, 'posé', 'posés')} · <b>${esc(a.differes || 0)}</b> à poser`)
        + (N ? regletteHtml({ N, fait: Math.min(N, t), marques: marques.filter(i => i < N), aiguille: a.etat === 'cours' ? 'marche' : 'pause' }, label) : '');
    }
    const R = s.relChiffres;
    if (a.etat === 'rel' && R && Number.isInteger(R.faits) && entier(R.total)) {
      const c = R.corriges ?? 0;
      return compteHtml(R.faits, `relus sur ${R.total}`, `<b>${esc(c)}</b> ${pl(c, 'corrigé', 'corrigés')}`)
        + regletteHtml({ N: R.total, fait: Math.min(R.total, R.faits), aiguille: R.etat === 'en-pause' || m.glyphe === 'relpause' ? 'pause' : 'marche' }, label);
    }
    return '';
  }

  /* ------------------------------------------------------------------ les icônes d'état (planche, « composants du Mix ») */
  const I = {
    rond: '<circle cx="12" cy="12" r="9"/>',
    tirets: '<circle cx="12" cy="12" r="9" stroke-dasharray="3.2 2.6"/>',
    pause: '<path d="M9 5.5v13M15 5.5v13"/>',
    pauseRond: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
    pauseTirets: '<circle cx="12" cy="12" r="9" stroke-dasharray="3.2 2.6"/><path d="M10 9v6M14 9v6"/>',
    alerte: '<path d="M12 3.5L21.5 20h-19z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    octo: '<path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z"/><path d="M8 12h8"/>',
    coche: '<path d="M4.5 12.5l5 5L19.5 7"/>',
    carre: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
    cadenas: '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    barre: '<circle cx="12" cy="12" r="9"/><path d="M5.7 18.3L18.3 5.7"/>',
    ondes: '<circle cx="12" cy="12" r="1.3"/><path d="M8.6 8.6a4.8 4.8 0 0 0 0 6.8M15.4 8.6a4.8 4.8 0 0 1 0 6.8M5.8 5.8a8.8 8.8 0 0 0 0 12.4M18.2 5.8a8.8 8.8 0 0 1 0 12.4"/>',
  };
  const PAR_G = { pret: 'rond', cours: 'rond', dem: 'pauseTirets', pause: 'pause', toi: 'alerte', interrompu: 'octo', fini: 'coche', arrete: 'carre', relecture: 'rond', relpause: 'pauseRond', verrou: 'cadenas', hors: 'barre', echoVide: 'tirets', echo: 'ondes' };
  const icone = g => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${I[PAR_G[g]] || I.rond}</svg>`;
  const LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M5 20L10.4 4M19 20L13.6 4M7.4 15h9.2"/></svg>';
  const IC_CMD = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7.5 10l2.5 2-2.5 2M12 14h4"/></svg>';
  const IC_REG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/></svg>';

  /* ------------------------------------------------------------------ rendu */
  const RE_ANNEAU = /<div class="sg-anneau( sg-anneau-seg)?"[^>]*?aria-label="([^"]*)"[^>]*>[\s\S]*?<\/svg><span class="sg-anneau-c">([\s\S]*?)<\/span><\/div>/;
  const deEsc = t => t.replace(/&#39;/g, '’').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  function rendre(snap, ui) {
    const s = snap || {}, u = ui || {}, m = S.modele(s, u);
    let h = S.rendre(s, u);
    const activite = (h.match(/^<div class="sg-fen" data-activite="([^"]*)"/) || [])[1] || '';
    /* l'anneau devient le gros chiffre et la réglette (Orbite, Écho) ; dans les onglets Constellation et Aurore, le chiffre et sa légende de l'anneau */
    h = h.replace(RE_ANNEAU, (tout, seg, label, centre) => {
      const lab = deEsc(label);
      if (activite === 'orbite' || activite === 'echo') return tuileChiffre(s, m, lab);
      const ch = (centre.match(/<span class="sg-chiffre">([^<]*)<\/span>/) || [])[1], su = (centre.match(/<small class="sg-suite">([^<]*)<\/small>/) || [])[1] || '';
      return ch ? compteHtml(deEsc(ch), deEsc(su), '') : '';
    });
    /* l'icône d'état de la planche */
    h = h.replace(/<i class="sg-glyphe" data-g="([^"]*)" data-ton="([^"]*)" aria-hidden="true"><\/i>/g, (t, g, ton) => `<i class="sg-glyphe mx-ic" data-g="${g}" data-ton="${ton}" aria-hidden="true">${icone(g)}</i>`);
    /* la barre : la marque, le raccourci « Commandes » (extra), le menu « ··· » dessiné en réglages */
    h = h.replace(/(<header class="sg-barre">)/, `$1<span class="mx-marque-a">${LOGO}<span>Ariane</span></span>`);
    h = h.replace(/(<button type="button" class="sg-ico sg-menu-b"[^>]*>)···(<\/button>)/, `<button type="button" class="sg-ico mx-cmd" data-mx-extra="1" data-act="sg:palette" aria-label="Commandes (Ctrl K)" title="Commandes (Ctrl K)">${IC_CMD}</button>$1${IC_REG}$2`);
    /* « Ce qui reste » (« Visites » dans Écho) nomme la ligne qui ouvre le tiroir */
    h = h.replace(/(<button type="button" class="sg-poignee"[^>]*><span class="sg-txt">)/, `$1<b class="mx-t">${activite === 'echo' ? 'Visites' : 'Ce qui reste'}</b><span class="mx-sep"> · </span>`);
    /* la palette ne vaut que pour Glacier */
    h = h.replace(/<div class="sg-reg"><span class="sg-lib"><span>Palette<\/span>[\s\S]*?<\/button><\/span><\/div>/, '');
    /* le pied « Cache des exports » : le bouton du menu de Glacier, avec sa garde */
    const cache = (S.rendre(s, { ...u, couche: 'menu' }).match(/<div class="sg-cache"><span class="sg-q"><span class="sg-lib">Cache des exports<\/span>(?:<span class="sg-r">([^<]*)<\/span>)?<\/span>(<button [^>]*data-act="legacy:export-cache-clear"[^>]*>[^<]*<\/button>)<\/div>/));
    if (cache) {
      const r = cache[1] ? deEsc(cache[1]) : '', dit = r ? ` · ${/^après/.test(r) ? 'vidable ' : ''}${r}` : '';
      h = h.replace(/<\/div>$/, `<div class="mx-pied" data-mx-extra="1"><span class="mx-cache">Cache des exports</span>${dit ? `<span class="sg-r">${esc(dit)}</span>` : ''}${cache[2]}</div></div>`);
    }
    return h;
  }

  return { rendre, regletteHtml, icone };
});
