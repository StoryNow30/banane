/* CH-136 — STOCKAGE NEUF SUR CE POSTE.
 * Constat (journaux du 16/11 et du 17/11, ÉTABLI) : le 17/11 l'opérateur a travaillé sur un autre ordinateur ; chrome.storage.local est propre à un
 * profil Chrome d'un poste (et à l'identifiant de l'extension, qui change avec le dossier d'installation d'une extension non empaquetée). Tous les
 * choix gardés étaient absents : aj5 éteint (défaut d'alors), télécommande à appairer de nouveau, palette et mode rapide par défaut.
 * Ce module ne change aucun réglage : à l'ouverture du panneau, s'il ne trouve ni sa marque ni aucun choix de l'opérateur, il le dit par un avis
 * (« Compris » l'acquitte) ; s'il trouve des choix sans marque (poste déjà utilisé, mise à jour), il pose la marque en silence. */
(function (root, fabrique) {
  const M = fabrique(root);
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.ArianeStockageNeuf = M;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const MARQUE = 'banane5Poste';
  /* Clés écrites seulement par un choix de l'opérateur (ou par un lot qu'il a lancé) : jamais par le service worker à son démarrage. */
  const CHOIX = ['banane58AjustementHauteur', 'banane50ClicHumain', 'banane50LotProfil', 'banane50Raison', 'banane50Relecture', 'banane56PasseDiff',
    'arianeTelecommande', 'banane51Interface', 'banane51Palette', 'banane60FileParties', 'banane55FinsLot', 'banane3FichesDepart', 'banane5ListeMemoire'];
  const TEXTE = 'Réglages neufs sur ce poste (autre ordinateur, profil ou dossier) : valeurs par défaut, dont hauteur des poses allumée, '
    + 'mode rapide « Comme avant », télécommande à appairer. Vérifie les Réglages avant le premier lot.';

  /* Décision pure : `stock` est ce que rend chrome.storage.local.get(null). */
  function evaluer(stock, maintenant) {
    const s = stock && typeof stock === 'object' ? stock : {}, m = s[MARQUE];
    if (m && typeof m === 'object') return { avis: m.neuf === true && m.acquitte !== true, ecrire: null };
    const neuf = !CHOIX.some(k => Object.prototype.hasOwnProperty.call(s, k));
    return { avis: neuf, ecrire: { [MARQUE]: { vu: maintenant || new Date().toISOString(), neuf, acquitte: false } } };
  }
  function acquitter(stock, maintenant) {
    const m = stock?.[MARQUE];
    return { [MARQUE]: { ...(m && typeof m === 'object' ? m : { vu: maintenant || new Date().toISOString(), neuf: true }), acquitte: true, acquitteA: maintenant || new Date().toISOString() } };
  }

  /* Branchement au panneau : un bandeau à part, posé dans <body> (panel-ui5.css cache <main> sous Signal), fixé en bas de la fenêtre, au-dessus de
   * l'interface, sans toucher aux écrans de CH-134 et CH-135. Couleurs propres (contraste ≥ 4,5:1 dans les deux thèmes), thème lu sur #ui5. */
  const STYLE = '#avis-stockage-neuf{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147482000;display:flex;gap:12px;align-items:center;flex-wrap:wrap;'
    + 'padding:12px 14px;border-radius:10px;border:1px solid #6B5A1E;background:#1E1A0E;color:#F5EBC8;font:400 13px/1.45 "Inter",system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.45)}'
    + '#avis-stockage-neuf p{margin:0;flex:1 1 220px;min-width:0;overflow-wrap:anywhere}'
    + '#avis-stockage-neuf button{flex:0 0 auto;font:600 13px/1 "Inter",system-ui,sans-serif;padding:8px 14px;border-radius:8px;border:1px solid #F5EBC8;background:#F5EBC8;color:#1E1A0E;cursor:pointer}'
    + '#avis-stockage-neuf[data-theme="clair"]{background:#FFF6D6;color:#3A2E05;border-color:#C9A93A}'
    + '#avis-stockage-neuf[data-theme="clair"] button{background:#3A2E05;color:#FFF6D6;border-color:#3A2E05}'
    /* Hauteur réservée tant que l'avis est là : l'interface (#ui5, fixe sur toute la fenêtre) et le panneau d'avant s'arrêtent au-dessus du bandeau. */
    + 'body.avis-sn #ui5{bottom:var(--avis-sn-h,0px)!important}body.avis-sn{padding-bottom:var(--avis-sn-h,0px)}'
    /* Fenêtre étroite : bandeau plus serré (à 320 px, il ne doit pas faire défiler l'écran du lot). */
    + '@media (max-width:479px){#avis-stockage-neuf{left:8px;right:8px;bottom:8px;padding:8px 10px;gap:8px;font-size:12px;line-height:1.35}#avis-stockage-neuf p{flex-basis:180px}#avis-stockage-neuf button{padding:6px 10px;font-size:12px}}';
  /* Couches de Signal (tests/ch106-couches-clavier-navigateur.test.cjs) : tant qu'une est ouverte, ce qu'elle ne contient pas est inatteignable ; le bandeau aussi. */
  const COUCHES = '.sg-tiroir[data-ouvert="1"],#ui5 [role="dialog"],#ui5-tech';
  function suivreCouches(boite, D) { let c = false; try { c = !!D.querySelector?.(COUCHES); } catch { /* rien */ }
    boite.inert = c; if (c) boite.setAttribute('aria-hidden', 'true'); else boite.removeAttribute?.('aria-hidden'); }
  async function brancher({ L = root.chrome?.storage?.local, D = root.document } = {}) {
    if (!L?.get || !D) return { avis: false };
    let stock;
    try { stock = await L.get(null); } catch { return { avis: false }; }
    const r = evaluer(stock);
    if (r.ecrire) { try { await L.set(r.ecrire); } catch { /* l'avis vaudra pour cette fenêtre */ } }
    if (!r.avis || D.getElementById('avis-stockage-neuf')) return { avis: r.avis };
    const boite = D.createElement('div');
    boite.id = 'avis-stockage-neuf'; boite.className = 'status avis-stockage-neuf'; boite.setAttribute('role', 'alert');
    const p = D.createElement('p'); p.textContent = TEXTE;
    const b = D.createElement('button'); b.type = 'button'; b.id = 'avis-stockage-neuf-ok'; b.textContent = 'Compris';
    b.addEventListener('click', async () => {
      try { const s = await L.get([MARQUE]); await L.set(acquitter(s)); } catch { /* acquitté pour cette fenêtre */ }
      boite.remove(); rendre();
    });
    boite.append(p, b);
    if (D.head && !D.getElementById('avis-stockage-neuf-style')) { const st = D.createElement('style'); st.id = 'avis-stockage-neuf-style'; st.textContent = STYLE; D.head.append(st); }
    const theme = () => { try { return D.getElementById('ui5')?.dataset?.theme === 'clair' ? 'clair' : 'sombre'; } catch { return 'sombre'; } };
    boite.setAttribute('data-theme', theme());
    D.body.append(boite);
    const R = D.documentElement?.style;
    function reserver() { try { R?.setProperty?.('--avis-sn-h', (Math.ceil(boite.offsetHeight || 0) + (root.innerWidth < 480 ? 16 : 24)) + 'px'); D.body.classList?.add?.('avis-sn'); } catch { /* rien */ } }
    function rendre() { try { R?.removeProperty?.('--avis-sn-h'); D.body.classList?.remove?.('avis-sn'); } catch { /* rien */ } }
    reserver(); suivreCouches(boite, D);
    /* Une couche s'ouvre sans délai : observée au fil des changements de la page, pas seulement chaque seconde. */
    try { if (root.MutationObserver) { const mo = new root.MutationObserver(() => { if (!boite.parentNode) mo.disconnect(); else suivreCouches(boite, D); });
      mo.observe(D.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-ouvert', 'role', 'hidden'] }); } } catch { /* l'intervalle suffit */ }
    /* Le thème et la largeur (donc la hauteur du bandeau) peuvent changer après l'ouverture : relus tant que l'avis est là. */
    const suivre = setInterval(() => { if (!boite.parentNode) { clearInterval(suivre); rendre(); } else { boite.setAttribute('data-theme', theme()); reserver(); suivreCouches(boite, D); } }, 1000);
    suivre?.unref?.();
    return { avis: true };
  }
  if (root.document && root.chrome?.storage?.local) {
    const go = () => { void brancher(); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', go); else go();
  }
  return { MARQUE, CHOIX, TEXTE, STYLE, COUCHES, evaluer, acquitter, brancher, suivreCouches };
});
