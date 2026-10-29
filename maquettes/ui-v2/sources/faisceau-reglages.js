/* CH-020 : réglages communs aux quatre pistes « Faisceau » : police et effet d'avancement.
 * Inclus par construire.cjs à la place de « /*INCLURE:faisceau-reglages.js*\/ », avant le moteur.
 *
 * La racine du document porte data-police et data-avancement. On les choisit :
 *   - dans la régie de la page (deux listes ajoutées après celles du moteur commun) ;
 *   - par l'adresse : ?police=<clé>&av=<clé> ;
 *   - par message de la page de comparaison : postMessage({ faisceau: { police, avancement } }).
 * « actuelle » / « actuel » = ce que la piste fait d'elle-même (rien n'est posé sur la racine).
 *
 * Polices : toutes sous licence SIL Open Font License 1.1, embarquées en base64 par les repères
 * POLICE de chaque page (aucun chargement externe). Chaque couple donne la police du texte
 * (--sans), celle des chiffres (--chiffre), la graisse et l'approche du grand nombre. */
(function () {
  'use strict';
  const POLICES = [
    ['actuelle', 'Actuelle (celle de la piste)'],
    ['technique', 'Technique · Geist + Geist Mono'],
    ['editorial', 'Éditorial · Instrument Sans + Newsreader'],
    ['lisible', 'Lisible · Atkinson Hyperlegible Next + Mono'],
    ['condense', 'Condensé · IBM Plex Sans Condensed'],
    ['rond', 'Rond · Manrope'],
  ];
  const AVANCEMENTS = [
    ['actuel', 'Actuel (celui de la piste)'],
    ['continu', 'Continu · remplissage fluide'],
    ['paliers', 'Paliers · ne recule jamais'],
    ['graduation', 'Graduation qui se révèle'],
    ['matiere', 'Matière · un niveau qui monte'],
  ];
  const CSS = `
:root[data-police="technique"]{--sans:'Geist',system-ui,sans-serif;--chiffre:'Geist Mono',ui-monospace,monospace;--poids-n:500;--chasse-n:-.06em}
:root[data-police="editorial"]{--sans:'Instrument Sans',system-ui,sans-serif;--chiffre:'Newsreader',Georgia,serif;--poids-n:400;--chasse-n:-.02em}
:root[data-police="lisible"]{--sans:'Atkinson Hyperlegible Next',system-ui,sans-serif;--chiffre:'Atkinson Hyperlegible Mono',ui-monospace,monospace;--poids-n:700;--chasse-n:-.05em}
:root[data-police="condense"]{--sans:'IBM Plex Sans Condensed',system-ui,sans-serif;--chiffre:'IBM Plex Sans Condensed',system-ui,sans-serif;--poids-n:600;--chasse-n:-.03em}
:root[data-police="rond"]{--sans:'Manrope',system-ui,sans-serif;--chiffre:'Manrope',system-ui,sans-serif;--poids-n:700;--chasse-n:-.05em}
:root[data-police] body{font-family:var(--sans)}
:root[data-police] .lot .grand .n{font-family:var(--chiffre);font-weight:var(--poids-n);letter-spacing:var(--chasse-n)}
:root[data-police] .jalon b,:root[data-police] .bornes input,:root[data-police] .pas output{font-family:var(--chiffre)}
/* effets d'avancement dessinés par le moteur (classes du SVG de la carte) */
.fx .fx-jauge{stroke:var(--fa1);stroke-width:2.4;stroke-linecap:round;fill:none;filter:drop-shadow(0 0 3px var(--fa-halo))}
.fx .fx-palier{stroke:var(--fa1);stroke-width:2.6;stroke-linecap:butt;fill:none}
.fx .fx-grad{stroke:var(--fa1);stroke-width:1.4;stroke-linecap:round;fill:none}
.fx .fx-grad-der{stroke:var(--fa1);stroke-width:2.4;stroke-linecap:round;fill:none;filter:drop-shadow(0 0 3px var(--fa-halo))}
/* matière : un niveau de lumière chaude qui monte dans la carte, sous le texte, presque rien ;
 * le niveau exact est marqué par deux encoches sur les bords (moteur), jamais par un trait sur le texte */
.lot[data-av="matiere"]{background-image:linear-gradient(to top,color-mix(in srgb,var(--fa1) 9%,transparent),color-mix(in srgb,var(--fa1) 4%,transparent) var(--niveau,0%),transparent var(--niveau,0%))}
.regie select.fx-choix{max-width:16em}`;

  const racine = document.documentElement;
  function poser(r) {
    if (r.police) { if (r.police === 'actuelle') racine.removeAttribute('data-police'); else racine.setAttribute('data-police', r.police); }
    if (r.avancement) { if (r.avancement === 'actuel') racine.removeAttribute('data-avancement'); else racine.setAttribute('data-avancement', r.avancement); }
    const p = document.getElementById('regie-police'), a = document.getElementById('regie-avancement');
    if (p && r.police) p.value = r.police;
    if (a && r.avancement) a.value = r.avancement;
    /* un rendu sans changer de scène : la frise (piste 4) relit l'effet choisi */
    window.postMessage({ ui2: {} }, '*');
  }
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const q = new URLSearchParams(location.search);
  poser({ police: q.get('police') || 'actuelle', avancement: q.get('av') || 'actuel' });
  window.addEventListener('message', (e) => { if (e.data && e.data.faisceau) poser(e.data.faisceau); });
  /* la régie du moteur commun est posée par Demo.monter : on y ajoute nos deux listes ensuite */
  function regie() {
    const r = document.querySelector('.regie');
    if (!r || document.getElementById('regie-police')) return;
    const liste = (id, nom, l, v) => `<label>${nom} <select id="${id}" class="fx-choix">${l.map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
    const etat = document.getElementById('regie-etat');
    const html = liste('regie-police', 'Police', POLICES, racine.getAttribute('data-police') || 'actuelle') + liste('regie-avancement', 'Avancement', AVANCEMENTS, racine.getAttribute('data-avancement') || 'actuel');
    if (etat) etat.insertAdjacentHTML('beforebegin', html); else r.insertAdjacentHTML('beforeend', html);
    document.getElementById('regie-police').addEventListener('change', (e) => poser({ police: e.target.value }));
    document.getElementById('regie-avancement').addEventListener('change', (e) => poser({ avancement: e.target.value }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', regie); else setTimeout(regie, 0);
  window.FaisceauReglages = { POLICES, AVANCEMENTS, poser };
})();
