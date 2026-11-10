'use strict';
/* CH-101, tour 2 (D-324) — fabrique la page à comparer : le panneau actuel et trois propositions d'apparence, état par état.
 *   node maquettes/ui-ch101/tour-2/generer.cjs                       → tour-2/index.html (sans capture : interdit de CLAUDE.md)
 *   node maquettes/ui-ch101/tour-2/generer.cjs --captures DOSSIER --sortie FICHIER [--publier]   → page complète, hors dépôt
 * Les textes de chaque état sont ceux que le panneau du tronc affiche (relevés sur ses captures) ; chiffres fabriqués, cohérents. */
const fs = require('node:fs'), path = require('node:path');
const ICI = __dirname;
const arg = n => { const i = process.argv.indexOf('--' + n); return i < 0 ? null : process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true; };
const CAPTURES = arg('captures'), SORTIE = arg('sortie') || path.join(ICI, 'index.html'), PUBLIER = !!arg('publier');

/* ───────────────────────────── les huit états, tels que le panneau les écrit */
const LOT = 'Lot du cut <b>4790</b> au cut <b>4900</b>';
const COMPTE = { n: 18, lib: 'traités · total inconnu', detail: '<b>15</b> posés · <b>3</b> à poser', fait: 60, marques: [18.33, 35, 51.67] };
const P3 = ['<b>3</b> à poser · à reprendre après le lot', '<b>3</b> à examiner'], P6 = ['<b>6</b> à poser · à reprendre après le lot', '<b>6</b> à examiner'];
const ETATS = [
  { id: 'pret', nom: 'Prêt', ton: 'creux', mot: 'Prêt', phrase: 'Partie 13 · du cut <b>4790</b> jusqu’à la fin de la partie', champs: true,
    note: 'Dernier cut vide : le lot va jusqu’à la fin de la partie, puis se clôt seul. Modifiable.', actions: ['Démarrer le lot'], poignee: ['Verts pas encore calculés', 'verts pas calculés'], cache: '' },
  { id: 'cours', nom: 'Lot en cours', ton: 'vif', mot: 'En cours', phrase: 'Pose du cut <b>4812</b>', lot: LOT, compte: COMPTE,
    allure: '<b>7,9</b> cuts par minute · médiane <b>7,6 s</b> par cut', actions: ['Pause', 'Arrêter le lot'], poignee: P3, cache: 'après le lot' },
  { id: 'pause', nom: 'En pause', ton: 'attn', mot: 'En pause', phrase: 'Après le cut <b>4811</b>', lot: LOT, compte: COMPTE,
    allure: 'en pause depuis <b>1 min 45</b> · médiane <b>7,6 s</b> par cut avant la pause', actions: ['Reprendre', 'Arrêter le lot'], poignee: P3, cache: 'après le lot' },
  { id: 'toi', nom: 'Rail non résolu', ton: 'attn', mot: 'À toi', phrase: 'Partie 13 · après le cut <b>4811</b>', lot: LOT,
    avis: 'Le cut 4812 a un rail qu’Ariane ne sait pas poser. Choisis : réessayer, le reprendre à la main, ou le passer.', actions: ['Réessayer ce cut', 'Reprise manuelle', 'Arrêter le lot'], poignee: P3, cache: 'après le lot' },
  { id: 'panne', nom: 'ESV muet', ton: 'crit', mot: 'ESV ne répond plus', phrase: 'Partie 13 · après le cut <b>4811</b>', lot: LOT, esv: 'ESV ne répond plus',
    avis: 'ESV ne répond plus. Si la page ESV reste figée, recharge-la (F5), attends qu’elle réponde, puis clique sur Reprendre.', actions: ['Reprendre', 'Arrêter le lot'], poignee: P3, cache: 'après le lot' },
  { id: 'rattrapage', nom: 'Rattrapage', ton: 'neutre', mot: 'Rattrapage', phrase: 'Ariane travaille dans ESV · ne touche à rien · cut <b>4803</b> · 1 posé sur 3',
    verrou: 'Aucune action jusqu’à la fin du rattrapage', actions: [], poignee: P6, cache: 'après le rattrapage' },
  { id: 'relecture', nom: 'Relecture', ton: 'vif', mot: 'Relecture', phrase: 'Relecture 12 sur 85, 3 corrigés · cut 4801', actions: ['Arrêter la relecture', 'Nouveau lot'], sansPrincipal: true, poignee: P6, cache: 'après la relecture' },
  { id: 'fin', nom: 'Fin de lot', ton: 'fait', mot: 'Terminé', phrase: 'Partie 13',
    fin: [['Lot', '<b>93</b> cuts traités'], ['Bornes', 'du cut <b>4790</b> au cut <b>4900</b>'], ['Il reste', '<b>6</b> à poser · verts pas encore calculés'], ['Export', 'prêt']],
    actions: ['Voir ce qui reste', 'Exporter le dossier', 'Nouveau lot'], poignee: ['<b>6</b> à examiner · 6 à poser, verts pas encore calculés', '<b>6</b> à examiner'], reste: 'reste à examiner 6 sur 6', cache: '' },
];

/* ───────────────────────────── signes : le strict nécessaire, au trait */
const sv = (d, extra = '') => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
const IC = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 21L10.4 3M19 21L13.6 3"/><path d="M7.4 15h9.2M9 9.6h6" stroke-width="1.6"/></svg>',
  bas: sv('<path d="M4 6l4 4 4-4"/>'), droite: sv('<path d="M6 4l4 4-4 4"/>'),
  cadenas: sv('<rect x="3.5" y="7.5" width="9" height="6" rx="1.5"/><path d="M5.5 7.5V5.5a2.5 2.5 0 0 1 5 0v2"/>'),
  loupe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.2"/><path d="M15.8 15.8L20 20"/></svg>',
  reglages: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/></svg>',
};
/* signe d'état de la proposition 3 : un petit rond, à la manière des statuts des outils sobres */
const ROND = { creux: '<circle cx="8" cy="8" r="6"/>', vif: '<circle cx="8" cy="8" r="6"/><path d="M8 8V4.2A3.8 3.8 0 0 1 11.8 8z" fill="currentColor" stroke-width="1"/>',
  attn: '<circle cx="8" cy="8" r="6"/><path d="M6.4 5.8v4.4M9.6 5.8v4.4"/>', toi: '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/>',
  crit: '<circle cx="8" cy="8" r="6"/><path d="M8 4.8v3.6M8 11h.01"/>', neutre: '<circle cx="8" cy="8" r="6" stroke-dasharray="2.4 2.4"/>', fait: '<circle cx="8" cy="8" r="6.4" fill="currentColor" stroke="none"/><path d="M5.4 8.2l1.8 1.8 3.4-3.8" stroke="var(--fond)"/>' };
const rond = e => sv(ROND[e.id === 'toi' ? 'toi' : e.ton]);

/* ───────────────────────────── morceaux communs (même contenu, trois habillages) */
const esv = e => e.esv || 'Utilisé par Ariane — ESV';
const rail = (e, c) => e.compte ? `<div class="${c}-rail" data-ton="${e.ton}" role="img" aria-label="18 traités, total inconnu, 3 à poser"><b style="width:${e.compte.fait}%"></b>${e.compte.marques.map(x => `<u style="left:${x}%"></u>`).join('')}<s style="left:${e.compte.fait}%"></s></div>` : '';
const champs = c => `<div class="${c}-champs"><label>Premier cut<span>4790</span></label><label>Dernier cut<span class="vide">fin de partie</span></label></div>`;
const boutons = (e, c) => e.actions.length ? `<div class="${c}-actions${e.actions.length > 2 ? ' n3' : ''}">${e.actions.map((t, i) => `<button type="button"${i || e.sansPrincipal ? '' : ' class="pr"'}>${t}</button>`).join('')}</div>` : '';
const poignee = e => `<span class="x600">${e.poignee[0]}</span><span class="x360">${e.poignee[1]}</span>${e.reste ? `<em>${e.reste}</em>` : ''}`;

function rendre1(e) {
  let c = `<div class="p1-mot" data-ton="${e.ton}"><i></i><h3>${e.mot}</h3></div><p class="p1-phrase">${e.phrase}</p>${e.lot ? `<p class="p1-lot">${e.lot}</p>` : ''}`;
  if (e.champs) c += champs('p1') + `<p class="p1-note">${e.note}</p>`;
  if (e.compte) c += `<div class="p1-compte"><strong>${e.compte.n}</strong><span>${e.compte.lib}</span><em>${e.compte.detail}</em></div>${rail(e, 'p1')}`;
  if (e.allure) c += `<p class="p1-allure">${e.allure}</p>`;
  if (e.avis) c += `<p class="p1-avis" data-ton="${e.ton}">${e.avis}</p>`;
  if (e.fin) c += `<dl class="p1-fin">${e.fin.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  if (e.verrou) c += `<p class="p1-verrou">${IC.cadenas}${e.verrou}</p>`;
  c += boutons(e, 'p1');
  const seg = '<div class="p1-seg"><span class="ici">Orbite</span><span>Écho</span><span>Aurore</span></div>';
  return `<div class="p p1" data-etat="${e.id}"><header class="p1-barre"><span class="p1-logo">${IC.logo}<span class="x600">Ariane</span></span>${seg}<span class="pousse"></span><span class="p1-puce" data-ton="${e.ton}"><i></i>${esv(e)}${IC.bas}</span><span class="p1-ic x600">${IC.loupe}</span><span class="p1-ic">${IC.reglages}</span></header><div class="p1-rang2">${seg}</div>
<div class="p1-corps">${c}</div><div class="p1-poignee">${IC.droite}${poignee(e)}</div><footer class="p1-cache"><div class="cache-lib">Cache des exports${e.cache ? `<span><i class="pt">· </i>${e.cache}</span>` : ''}</div><button type="button"${e.cache ? ' disabled' : ''}>Vider le cache</button></footer></div>`;
}
function rendre2(e) {
  let c = `<div class="p2-mot" data-ton="${e.ton}"><i></i><h3>${e.mot}</h3></div><p class="p2-phrase">${e.phrase}</p>${e.lot ? `<p class="p2-lot">${e.lot}</p>` : ''}`;
  if (e.champs) c += champs('p2') + `<p class="p2-note">${e.note}</p>`;
  if (e.compte) c += `<div class="p2-compte"><strong>${e.compte.n}</strong><span>${e.compte.lib}</span><em>${e.compte.detail}</em></div>${rail(e, 'p2')}`;
  if (e.allure) c += `<p class="p2-allure">${e.allure}</p>`;
  if (e.avis) c += `<p class="p2-avis" data-ton="${e.ton}">${e.avis}</p>`;
  if (e.fin) c += `<dl class="p2-fin">${e.fin.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  if (e.verrou) c += `<p class="p2-verrou">${IC.cadenas}${e.verrou}</p>`;
  c += boutons(e, 'p2');
  return `<div class="p p2" data-etat="${e.id}"><header class="p2-tete"><span class="p2-titre">Ariane</span><span class="p2-puce" data-ton="${e.ton}"><i></i>${esv(e)}${IC.bas}</span><span class="p2-ic x600">${IC.loupe}</span><span class="p2-ic">${IC.reglages}</span></header>
<nav class="p2-onglets"><span class="ici">Orbite</span><span>Écho</span><span>Aurore</span></nav>
<div class="p2-corps"><section class="p2-carte p2-etat">${c}</section><section class="p2-carte p2-rangs"><div class="p2-rang">${poignee(e)}${IC.droite}</div><div class="p2-rang"><div class="cache-lib">Cache des exports${e.cache ? `<span><i class="pt">· </i>${e.cache}</span>` : ''}</div><button type="button"${e.cache ? ' disabled' : ''}>Vider le cache</button></div></section></div></div>`;
}
function rendre3(e) {
  let c = `<div class="p3-mot" data-ton="${e.ton}">${rond(e)}<h3>${e.mot}</h3></div><p class="p3-phrase">${e.phrase}</p>`;
  if (e.champs) c += champs('p3') + `<p class="p3-note">${e.note}</p>`;
  if (e.compte) c += rail(e, 'p3');
  const props = [];
  if (e.lot) props.push(['Lot', 'du cut <b>4790</b> au cut <b>4900</b>']);
  if (e.compte) props.push(['Traités', '<b>18</b> <span>· total inconnu</span>'], ['Posés', '<b>15</b>'], ['À poser', '<b>3</b>']);
  if (e.allure) props.push([e.id === 'pause' ? 'En pause' : 'Allure', e.id === 'pause' ? 'depuis <b>1 min 45</b> <span class="apres"><i>· </i>médiane 7,6 s par cut avant la pause</span>' : '<b>7,9</b> cuts par minute <span class="apres"><i>· </i>médiane 7,6 s par cut</span>']);
  if (e.fin) props.push(...e.fin);
  if (props.length) c += `<dl class="p3-props">${props.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  if (e.avis) c += `<p class="p3-avis" data-ton="${e.ton}">${e.avis}</p>`;
  if (e.verrou) c += `<p class="p3-verrou">${IC.cadenas}${e.verrou}</p>`;
  c += boutons(e, 'p3');
  return `<div class="p p3" data-etat="${e.id}"><header class="p3-barre"><span class="p3-nom">Ariane</span><nav class="p3-nav"><span class="ici">Orbite</span><span>Écho</span><span>Aurore</span></nav><span class="p3-esv" data-ton="${e.ton}"><i></i>${esv(e)}</span><span class="p3-kbd x600">Ctrl K</span>${IC.reglages}</header>
<div class="p3-corps">${c}</div><footer class="p3-pied"><div class="p3-rang">${poignee(e)}${IC.droite}</div><div class="p3-rang"><div class="cache-lib">Cache des exports${e.cache ? `<span><i class="pt">· </i>${e.cache}</span>` : ''}</div><button type="button"${e.cache ? ' disabled' : ''}>Vider le cache</button></div></footer></div>`;
}

/* ───────────────────────────── la page */
const b64 = (f, mime) => `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
const image = (theme, taille, id) => { if (!CAPTURES) return null; const f = path.join(CAPTURES, `${theme}-${taille}-${id}.webp`); return fs.existsSync(f) ? b64(f, 'image/webp') : null; };
function existant(e) {
  if (!CAPTURES) return '<div class="absent">Photographie du panneau actuel : hors dépôt. Voir la page publiée.</div>';
  return ['clair', 'sombre'].map(th => [360, 600].map(t => `<img class="v-${th} v-${t}" src="${image(th, t, e.id)}" alt="Panneau actuel, ${e.nom}, thème ${th}, ${t === 360 ? '360 × 480' : '600 × 760'}" width="${t}" height="${t === 360 ? 480 : 760}" loading="lazy">`).join('')).join('');
}
const col = (n, titre, html, cls = '') => `<figure class="col ${cls}"><figcaption>${n ? `<b>${n}</b>` : ''}<span>${titre}</span></figcaption><div class="cadre">${html}</div></figure>`;
const rang = e => `<section class="etat" id="etat-${e.id}"><h2>${e.nom}</h2><div class="rang">${col('', 'Aujourd’hui', existant(e), 'ex')}${col('1', 'Signal, fini', rendre1(e))}${col('2', 'Système', rendre2(e))}${col('3', 'Sobre', rendre3(e))}</div></section>`;

const PAGE_CSS = `
/* la page : trois phrases, puis par état un rang de quatre panneaux à taille réelle ; rien d'autre à lire */
:root{--pg:#F4F4F5;--pg-tx:#18181B;--pg-tx2:#52525B;--pg-trait:#DEDEE2;--pg-carte:#FFFFFF;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--pg:#0E0E10;--pg-tx:#EDEDEF;--pg-tx2:#A1A1AA;--pg-trait:#2A2A2E;--pg-carte:#18181B;color-scheme:dark}}
:root[data-theme="dark"]{--pg:#0E0E10;--pg-tx:#EDEDEF;--pg-tx2:#A1A1AA;--pg-trait:#2A2A2E;--pg-carte:#18181B;color-scheme:dark}
body{background:var(--pg);color:var(--pg-tx);font:400 16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:32px 72px}
.page{max-width:1560px;margin:0 auto}
.page *{box-sizing:border-box}
:where(.page) h1{font-size:clamp(24px,4vw,32px);line-height:1.15;font-weight:650;letter-spacing:-.02em;margin:0 0 8px;text-wrap:balance}
:where(.page) h2{font-size:18px;line-height:1.3;font-weight:600;margin:0 0 12px}
:where(.page) p{margin:0;max-width:70ch}
.chapo{color:var(--pg-tx2)}
.trois{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;margin:24px 0 0;padding:0;list-style:none}
.trois li{background:var(--pg-carte);border:1px solid var(--pg-trait);border-radius:12px;padding:16px;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:baseline}
.trois b{grid-row:span 2;font-size:13px;font-weight:600;width:24px;height:24px;display:grid;place-items:center;border-radius:6px;background:var(--pg-tx);color:var(--pg);align-self:start}
.trois strong{font-weight:600}
.trois span{color:var(--pg-tx2);font-size:15px}
.reglages{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;margin:24px -16px 0;padding:10px 16px;background:var(--pg);border-bottom:1px solid var(--pg-trait);font-size:14px;color:var(--pg-tx2)}
.reglages div{display:flex;align-items:center;gap:8px}
.choix{display:inline-flex;padding:2px;border-radius:9px;background:var(--pg-trait)}
.choix button{font:500 14px/1 inherit;font-family:inherit;height:30px;padding:0 12px;border:0;border-radius:7px;background:transparent;color:var(--pg-tx2);cursor:pointer}
.choix button[aria-pressed="true"]{background:var(--pg-carte);color:var(--pg-tx)}
.choix button:focus-visible{outline:2px solid var(--pg-tx);outline-offset:1px}
.etat{margin-top:36px}
.rang{display:flex;gap:16px;overflow-x:auto;padding:4px 16px 16px;margin:0 -16px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.col{margin:0;flex:none;scroll-snap-align:center}
.col figcaption{display:flex;gap:8px;align-items:center;height:24px;margin-bottom:8px;font-size:14px;color:var(--pg-tx2)}
.col figcaption b{font-size:12px;font-weight:600;width:20px;height:20px;display:grid;place-items:center;border-radius:5px;background:var(--pg-tx);color:var(--pg)}
.col .cadre{border-radius:10px;box-shadow:0 0 0 1px var(--pg-trait)}
.col img{display:none;max-width:none}
.t-clair:not(.g600) img.v-clair.v-360,.t-sombre:not(.g600) img.v-sombre.v-360,.t-clair.g600 img.v-clair.v-600,.t-sombre.g600 img.v-sombre.v-600{display:block}
.absent{position:absolute;inset:0;display:grid;place-items:center;padding:28px;text-align:center;color:var(--pg-tx2);font-size:14px;line-height:1.5}
.notes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:24px 48px;margin-top:48px;padding-top:24px;border-top:1px solid var(--pg-trait)}
.notes ul{margin:0;padding-left:18px}
.notes li{margin-bottom:6px;color:var(--pg-tx2);max-width:64ch}
.notes li b{color:var(--pg-tx);font-weight:600}
`;
function page() {
  const corps = `<div class="page t-clair" id="page">
<header><h1>Trois nouvelles apparences pour le panneau</h1>
<p class="chapo">Même panneau, mêmes boutons, mêmes textes : seule l’apparence change. À gauche de chaque rang, le panneau d’aujourd’hui.</p>
<ol class="trois">
<li><b>1</b><strong>Signal, fini</strong><span>Le panneau actuel, à la même place, avec la police du système et des finitions soignées.</span></li>
<li><b>2</b><strong>Système</strong><span>L’allure des panneaux et des réglages de Chrome : des cartes, des boutons arrondis, un seul bleu.</span></li>
<li><b>3</b><strong>Sobre</strong><span>Presque sans couleur : un titre, une liste de lignes alignées, de petits boutons.</span></li>
</ol></header>
<div class="reglages" role="group" aria-label="Affichage des panneaux"><div>Thème <span class="choix"><button type="button" id="th-clair" aria-pressed="true">Clair</button><button type="button" id="th-sombre" aria-pressed="false">Sombre</button></span></div><div>Taille <span class="choix"><button type="button" id="ta-360" aria-pressed="true">360 × 480</button><button type="button" id="ta-600" aria-pressed="false">600 × 760</button></span></div><div>Faire défiler chaque rang de côté.</div></div>
${ETATS.map(rang).join('\n')}
<section class="notes"><div><h2>À savoir</h2><ul>
<li><b>Police.</b> Les trois propositions sont affichées avec la police de l’appareil qui ouvre cette page (Segoe UI sous Windows, San Francisco sous macOS, Roboto sous Android). Le panneau d’aujourd’hui est une photographie : sa police est IBM Plex.</li>
<li><b>Thème.</b> Dans l’extension, le clair ou le sombre suivrait le réglage du système ; ici les deux boutons servent à comparer.</li>
<li><b>Rien n’est installé.</b> Ce sont des maquettes ; l’extension n’a pas changé.</li></ul></div>
<div><h2>Libellés à remplacer, si tu le veux</h2><ul>
<li><b>« Utilisé par Ariane — ESV »</b> (coupé dans le panneau actuel) : proposer « ESV connecté ».</li>
<li><b>« …ou le passer »</b> dans le message du rail non résolu : le bouton pour passer est masqué ; proposer de retirer ces mots.</li>
<li><b>« Relecture 12 sur 85 »</b> sous le titre « Relecture » : proposer « 12 sur 85, 3 corrigés · cut 4801 ».</li></ul></div>
<div><h2>Les autres écrans</h2><ul>
<li><b>1.</b> Écho, Constellation, Aurore et les réglages gardent leur place et reçoivent les mêmes finitions.</li>
<li><b>2.</b> Chaque écran devient une ou deux cartes ; les réglages prennent la forme des réglages de Chrome (une ligne, un interrupteur).</li>
<li><b>3.</b> Chaque écran devient un titre et une liste de lignes ; l’Aurore et la Constellation sont déjà des listes.</li></ul></div></section>
</div>
<script>
(function(){var p=document.getElementById('page'),q=function(i){return document.getElementById(i)};
function ajuster(){var g=p.classList.contains('g600'),z=g?1:Math.min(1,(document.documentElement.clientWidth-32)/360);[].forEach.call(document.querySelectorAll('.col .cadre'),function(c){c.style.zoom=z;});}
function theme(s){p.classList.toggle('t-sombre',s);p.classList.toggle('t-clair',!s);q('th-clair').setAttribute('aria-pressed',String(!s));q('th-sombre').setAttribute('aria-pressed',String(s));}
function taille(g){p.classList.toggle('g600',g);q('ta-360').setAttribute('aria-pressed',String(!g));q('ta-600').setAttribute('aria-pressed',String(g));ajuster();}
q('th-clair').addEventListener('click',function(){theme(false)});q('th-sombre').addEventListener('click',function(){theme(true)});
q('ta-360').addEventListener('click',function(){taille(false)});q('ta-600').addEventListener('click',function(){taille(true)});
var t=document.documentElement.getAttribute('data-theme');theme(t?t==='dark':!!(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches));
window.addEventListener('resize',ajuster);ajuster();})();
</script>`;
  const tete = `<title>Panneau Ariane, tour 2</title>\n${PUBLIER ? '<meta name="' + ['c', 'laude:viewport-fit-sides'].join('') + '" content="cover">\n' : ''}<style>\n${PAGE_CSS}\n${fs.readFileSync(path.join(ICI, 'style.css'), 'utf8')}\n</style>`;
  return PUBLIER ? `${tete}\n${corps}\n` : `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n${tete}\n</head>\n<body>\n${corps}\n</body>\n</html>\n`;
}
fs.writeFileSync(SORTIE, page());
console.log(`${SORTIE} · ${Math.round(fs.statSync(SORTIE).size / 1024)} ko · ${ETATS.length} états × 3 propositions${CAPTURES ? ' · photographies incluses' : ' · sans photographie'}`);
module.exports = { ETATS, rendre1, rendre2, rendre3 };
