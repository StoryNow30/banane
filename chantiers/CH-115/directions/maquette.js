/* CH-115, MAQUETTE SEULEMENT (jamais chargé par l'extension) : ce que les directions ajoutent au vrai panneau sans toucher à src/.
 * 1. Les détails à la demande : un clic sur la tuile d'état (hors bouton) ouvre ou ferme les détails (classe `cx-details` sur <html>).
 * 2. Le mouvement : un changement d'état rejoue l'entrée de la tuile (`cx-change`) ; un chiffre qui change roule (`cx-roule`).
 * 3. L'avancement en variable CSS (`--cx-p`, 0 à 1) lu sur l'arc de l'anneau, pour les directions qui le dessinent autrement.
 * Aucun message n'est envoyé, aucun bouton n'est créé ni retiré. */
(function () {
  'use strict';
  const d = document.documentElement, racine = document.getElementById('ui5'); if (!racine) return;
  document.addEventListener('click', e => {
    const t = e.target.closest('.sg-tu-etat,.sg-constel'); if (!t || e.target.closest('button,a,input,select,[data-act]')) return;
    d.classList.toggle('cx-details');
  });
  const rejouer = (el, c) => { if (!el) return; el.classList.remove(c); void el.offsetWidth; el.classList.add(c); };
  let etat = '';
  const CA = 2 * Math.PI * 45.4;
  function suivre() {
    const f = racine.querySelector('.sg-fen');
    if (f) { const e = `${f.dataset.activite}/${f.dataset.etat}/${f.dataset.teinte}`; if (e !== etat) { if (etat) rejouer(racine.querySelector('.sg-tu-etat,.sg-constel'), 'cx-change'); etat = e; d.dataset.cxTeinte = f.dataset.teinte || ''; } }
    for (const a of racine.querySelectorAll('.sg-anneau')) {
      const arc = a.querySelector('.sg-arc'); let p = 0;
      if (a.dataset.tourne) p = -1; else if (arc) { const v = parseFloat(String(arc.getAttribute('stroke-dasharray') || '0').split(/[ ,]+/)[0]); p = Math.max(0, Math.min(1, v / CA)); }
      const m = a.closest('.sg-milieu,.sg-tu-etat') || a; m.style.setProperty('--cx-p', p < 0 ? '0' : p.toFixed(3)); m.dataset.cxTourne = p < 0 ? '1' : '';
    }
  }
  const vus = new WeakMap();
  new MutationObserver(L => {
    for (const m of L) {
      const el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
      const c = el && el.closest && el.closest('.sg-chiffre,.sg-trio .sg-n,.sg-poignee .sg-n,.sg-phrase .sg-mono');
      if (c) { const t = c.textContent; if (vus.get(c) !== t) { vus.set(c, t); rejouer(c, 'cx-roule'); } }
    }
    suivre();
  }).observe(racine, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-etat', 'data-teinte', 'stroke-dasharray'] });
  suivre();
})();
