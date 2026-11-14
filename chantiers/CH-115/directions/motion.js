/* CH-115, tour 2 (D-350), MAQUETTE SEULEMENT : le motion design des variantes de B, posé sur le vrai panneau sans toucher à src/.
 * Rien n'est envoyé, aucun bouton n'est créé ni retiré ; les seules propriétés animées sont transform et opacity (l'arc de l'anneau mis à part).
 * 1. Chorégraphie d'un changement d'état : l'ancienne tuile (copie figée) sort vers le haut, puis la nouvelle entre morceau par morceau, en ressort.
 * 2. Changement d'onglet : la page glisse dans le sens de l'onglet choisi.
 * 3. Chiffres qui roulent : l'ancien chiffre monte et s'efface, le nouveau arrive d'en bas.
 * 4. Clic : une onde courte sur le bouton.
 * 5. Ralenti (page de comparaison : `window.__cxRalenti`) : toutes les animations et transitions du cadre jouent à 1/4.
 * « Réduire les animations » : rien de tout cela ne joue. */
(function () {
  'use strict';
  const R = document.getElementById('ui5'); if (!R) return;
  const calme = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* ressorts (courbes `linear()` : un ressort amorti, puis un ressort plus vif pour les chiffres) */
  const RESSORT = 'linear(0, .157 5.8%, .523 13.3%, .857 22.3%, 1.007 30.4%, 1.044 36.5%, 1.045 42.3%, 1.013 55.6%, .998 68.8%, 1)';
  const VIF = 'linear(0, .009, .035 2.1%, .141 4.4%, .723 12.9%, .938 16.7%, 1.017 19.4%, 1.067, 1.099 24.3%, 1.108 26%, 1.103, 1.085 31.1%, 1.008 39.6%, .98 45.7%, .977 49.2%, .985 55.3%, 1.002 64.3%, 1.004 76.5%, 1)';
  const SORTIE = 'cubic-bezier(.4,0,1,1)';
  (function ralenti() { const f = window.__cxRalenti ? 0.25 : 1; for (const a of document.getAnimations()) if (a.playbackRate !== f) a.playbackRate = f; requestAnimationFrame(ralenti); })();

  const ONGLETS = ['orbite', 'echo', 'file', 'correction'];
  let cle = '', activite = '', copie = null;
  const tuile = () => R.querySelector('.sg-tu-etat,.sg-constel');
  /* la copie figée de la tuile, posée hors du rendu (le rendu du panneau ne la touche pas), aux mêmes styles */
  function fantome(c) {
    const w = document.createElement('div'); w.id = 'ui5'; w.className = R.className; w.dataset.theme = R.dataset.theme || ''; w.dataset.taille = R.dataset.taille || '';
    w.setAttribute('aria-hidden', 'true'); w.inert = true;
    Object.assign(w.style, { position: 'fixed', inset: 'auto', left: c.rect.left + 'px', top: c.rect.top + 'px', width: c.rect.width + 'px', height: c.rect.height + 'px', background: 'transparent', pointerEvents: 'none', zIndex: 40, overflow: 'visible' });
    const f = document.createElement('div'); f.className = 'sg-fen'; Object.assign(f.dataset, c.fen); Object.assign(f.style, { background: 'transparent', height: '100%', overflow: 'visible' });
    c.noeud.style.margin = '0'; c.noeud.style.height = '100%'; f.appendChild(c.noeud); w.appendChild(f); document.body.appendChild(w);
    return w;
  }
  const morceaux = t => t ? [...t.querySelectorAll(':scope>.sg-haut, .sg-anneau, .sg-phrase, .sg-trio, .sg-constel-t, .sg-chaine, .sg-temps, :scope>p')].filter(e => e.getClientRects().length) : [];
  function entrer(liste, depart, dx = 0, dy = 14) {
    liste.forEach((e, i) => e.animate([{ opacity: 0, transform: `translate(${dx}px,${dy}px) scale(.985)` }, { opacity: 1, transform: 'none' }], { duration: 620, delay: depart + i * 55, easing: RESSORT, fill: 'backwards' }));
  }
  function changement(ancienne, nouvelleActivite, ancienneActivite) {
    if (calme()) return;
    const t = tuile();
    if (nouvelleActivite !== ancienneActivite && ancienneActivite) {
      /* changement d'onglet : la page glisse dans le sens de l'onglet */
      const sens = Math.sign(ONGLETS.indexOf(nouvelleActivite) - ONGLETS.indexOf(ancienneActivite)) || 1;
      const page = R.querySelector('.sg-page');
      if (page) page.animate([{ opacity: 0, transform: `translateX(${28 * sens}px)` }, { opacity: 1, transform: 'none' }], { duration: 520, easing: RESSORT });
      return;
    }
    if (ancienne && t) {
      const g = fantome(ancienne);
      /* la tuile neuve se tait le temps de la sortie */
      t.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 170 });
      g.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-12px) scale(.98)' }], { duration: 200, easing: SORTIE, fill: 'forwards' }).finished.then(() => g.remove(), () => g.remove());
    }
    entrer(morceaux(t), 150);
    const z = R.querySelector('.sg-zone'); if (z) entrer([...z.children].filter(e => e.getClientRects().length), 260);
    const p = R.querySelector('.sg-actions'); if (p) entrer([...p.children], 320, 0, 10);
  }
  /* chiffres : l'ancien monte, le nouveau arrive (copie de l'ancien posée à sa place, à ses styles calculés) */
  const textes = new WeakMap();
  function rouler(el, avant) {
    if (calme() || !el.isConnected) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const s = getComputedStyle(el), g = document.createElement('span'); g.textContent = avant; g.setAttribute('aria-hidden', 'true');
    Object.assign(g.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', font: s.font, letterSpacing: s.letterSpacing, color: s.color, textAlign: s.textAlign, lineHeight: s.lineHeight, pointerEvents: 'none', zIndex: 41, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' });
    document.body.appendChild(g);
    g.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-55%)' }], { duration: 260, easing: SORTIE, fill: 'forwards' }).finished.then(() => g.remove(), () => g.remove());
    el.animate([{ opacity: 0, transform: 'translateY(55%)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 60, easing: VIF, fill: 'backwards' });
  }
  function suivre(muta) {
    const f = R.querySelector('.sg-fen'); if (!f) return;
    const k = `${f.dataset.activite}/${f.dataset.etat}/${f.dataset.teinte}`;
    if (k !== cle) { const a = activite; activite = f.dataset.activite; const avant = cle; cle = k; if (avant) changement(copie, activite, a); }
    else if (muta) for (const m of muta) {
      const el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
      const c = el && el.closest && el.closest('.sg-chiffre,.sg-trio .sg-n,.sg-poignee .sg-n,.sg-constel-t .sg-chiffre');
      if (c) { const t = c.textContent, avant = textes.get(c); if (avant !== undefined && avant !== t) rouler(c, avant); }
    }
    for (const c of R.querySelectorAll('.sg-chiffre,.sg-trio .sg-n,.sg-poignee .sg-n')) textes.set(c, c.textContent);
    const t = tuile(); if (t) copie = { noeud: t.cloneNode(true), rect: t.getBoundingClientRect(), fen: { ...f.dataset } };
  }
  new MutationObserver(suivre).observe(R, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-etat', 'data-teinte', 'data-activite'] });
  suivre();
  /* clic : une onde courte */
  R.addEventListener('pointerdown', e => {
    const b = e.target.closest('button'); if (!b || calme() || b.disabled) return;
    const r = b.getBoundingClientRect(), o = document.createElement('span'), d = Math.max(r.width, r.height) * 2.2;
    Object.assign(o.style, { position: 'absolute', left: (e.clientX - r.left - d / 2) + 'px', top: (e.clientY - r.top - d / 2) + 'px', width: d + 'px', height: d + 'px', borderRadius: '50%', background: 'currentColor', opacity: .18, pointerEvents: 'none' });
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative'; b.style.overflow = 'hidden'; b.appendChild(o);
    o.animate([{ transform: 'scale(0)', opacity: .22 }, { transform: 'scale(1)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)' }).finished.then(() => o.remove(), () => o.remove());
  });
})();
