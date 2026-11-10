'use strict';
/* CH-101, tour 3 (D-325) — fabrique la page à comparer : le panneau actuel et trois refontes, état par état.
 *   node maquettes/ui-ch101/tour-3/generer.cjs                       → tour-3/index.html (sans photographie : interdit de CLAUDE.md)
 *   node maquettes/ui-ch101/tour-3/generer.cjs --captures DOSSIER --sortie FICHIER [--publier]   → page complète, hors dépôt
 * Chiffres fabriqués, cohérents : partie 13, lot du cut 4790 au cut 4900, cut 4811 atteint (22 numéros sur 111, soit 20 %),
 * 18 cuts traités (15 posés, 3 à poser), 89 numéros au plus encore à venir. Aucune action ajoutée ni supprimée. */
const fs = require('node:fs'), path = require('node:path');
const ICI = __dirname;
const arg = n => { const i = process.argv.indexOf('--' + n); return i < 0 ? null : process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true; };
const CAPTURES = arg('captures'), SORTIE = arg('sortie') || path.join(ICI, 'index.html'), PUBLIER = !!arg('publier');

const sv = d => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = { bas: sv('<path d="M4 6l4 4 4-4"/>'), droite: sv('<path d="M6 4l4 4-4 4"/>'), cadenas: sv('<rect x="3.5" y="7.5" width="9" height="6" rx="1.5"/><path d="M5.5 7.5V5.5a2.5 2.5 0 0 1 5 0v2"/>'),
  menu: '<svg viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><circle cx="3.5" cy="9" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="14.5" cy="9" r="1.5"/></svg>' };

/* ───────────────────────────── les huit états */
const AP3 = [[4809, '10 h 09'], [4803, '10 h 03'], [4796, '10 h 06']], AP6 = [[4877, '10 h 07'], [4861, '10 h 01'], [4838, '10 h 08'], ...AP3];
const ETATS = [
  { id: 'pret', nom: 'Prêt', ton: 'repos', mot: 'Prêt', pct: 0, geant: ['4790', 'premier cut'], bornes: ['4790', 'fin'], leg: ['Premier cut', 'Dernier cut : fin de partie'],
    ligne: 'Partie 13 · jusqu’à la fin de la partie, puis le lot se clôt seul.', champs: true, actions: ['Démarrer le lot'], aposer: null },
  { id: 'cours', nom: 'Lot en cours', ton: 'marche', mot: 'En cours', pct: 20, geant: ['20', '%'], bornes: ['4790', '4900'], pos: '4812', leg: ['<b>18</b> cuts traités', '<b>89</b> au plus à venir'],
    ligne: 'Pose du cut <b>4812</b> · <b>18</b> cuts traités · fin au cut <b>4900</b>', trio: [['18', 'cuts traités'], ['3', 'à poser'], ['7,9', 'cuts par minute']], actions: ['Pause', 'Arrêter le lot'], aposer: AP3 },
  { id: 'pause', nom: 'En pause', ton: 'repos', mot: 'En pause', pct: 20, geant: ['20', '%'], bornes: ['4790', '4900'], pos: '4811', leg: ['<b>18</b> cuts traités', '<b>89</b> au plus à venir'],
    ligne: 'En pause depuis <b>1 min 45</b>, après le cut <b>4811</b>', trio: [['18', 'cuts traités'], ['3', 'à poser'], ['1 min 45', 'en pause']], actions: ['Reprendre', 'Arrêter le lot'], aposer: AP3 },
  { id: 'toi', nom: 'Rail non résolu', ton: 'toi', mot: 'À toi', pct: 20, geant: ['4812', 'cut'], bornes: ['4790', '4900'], pos: '4812', leg: ['<b>18</b> cuts traités', '<b>89</b> au plus à venir'],
    avis: 'Ariane ne sait pas poser un rail du cut 4812. Réessaie, ou reprends-le à la main.', trio: [['18', 'cuts traités'], ['3', 'à poser'], ['4811', 'dernier cut posé']], actions: ['Réessayer ce cut', 'Reprise manuelle', 'Arrêter le lot'], aposer: AP3 },
  { id: 'panne', nom: 'ESV muet', ton: 'panne', mot: 'ESV ne répond plus', long: true, pct: 20, geant: ['20', '%'], bornes: ['4790', '4900'], pos: '4811', leg: ['<b>18</b> cuts traités', '<b>89</b> au plus à venir'],
    avis: 'Recharge la page ESV (F5), attends qu’elle réponde, puis clique sur Reprendre.', trio: [['18', 'cuts traités'], ['3', 'à poser'], ['4811', 'dernier cut posé']], actions: ['Reprendre', 'Arrêter le lot'], aposer: AP3 },
  { id: 'rattrapage', nom: 'Rattrapage', ton: 'marche', mot: 'Rattrapage', pct: 33, geant: ['1', 'sur 3'], bornes: ['0', '3'], pos: '1', leg: ['<b>1</b> posé sur <b>3</b>', 'cut <b>4803</b>'],
    ligne: 'Ariane travaille dans ESV : ne touche à rien. Cut <b>4803</b>.', trio: [['1', 'posé au rattrapage'], ['3', 'décidés'], ['6', 'à poser']], verrou: 'Aucune action jusqu’à la fin du rattrapage', actions: [], aposer: AP6 },
  { id: 'relecture', nom: 'Relecture', ton: 'marche', mot: 'Relecture', pct: 14, geant: ['14', '%'], bornes: ['0', '85'], pos: '12', leg: ['<b>12</b> cuts relus', '<b>3</b> corrigés'],
    ligne: '<b>12</b> cuts relus sur <b>85</b> · <b>3</b> corrigés · cut <b>4801</b>', trio: [['12', 'relus sur 85'], ['3', 'corrigés'], ['6', 'à poser']], actions: ['Arrêter la relecture', 'Nouveau lot'], sansPrincipal: true, aposer: AP6 },
  { id: 'fin', nom: 'Fin de lot', ton: 'repos', mot: 'Terminé', pct: 100, geant: ['93', 'cuts traités'], bornes: ['4790', '4900'], leg: ['<b>93</b> cuts traités', '<b>6</b> à poser'],
    ligne: 'Il reste <b>6</b> à poser · verts pas encore calculés · export prêt', trio: [['93', 'cuts traités'], ['6', 'à poser'], ['prêt', 'export']], actions: ['Voir ce qui reste', 'Exporter le dossier', 'Nouveau lot'], aposer: AP6 },
];

/* ───────────────────────────── morceaux communs */
const barre = e => `<header class="barre"><span class="act">Orbite${IC.bas}</span><span class="esv"${e.ton === 'panne' ? ' data-ko' : ''}><i></i>ESV</span><span class="menu">${IC.menu}</span></header>`;
const trio = e => e.trio ? `<div class="trio x600">${e.trio.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}</div>` : '';
const champs = () => '<div class="rangs"><div class="rang">Premier cut<em class="val">4790</em></div><div class="rang">Dernier cut<em>fin de partie</em></div></div>';
function rangs(e) {
  if (e.champs) return champs();
  const L = e.aposer || [], n = L.length;
  return `<div class="rangs x360"><div class="rang"><b>${n}</b> à poser<em>${e.id === 'fin' ? 'à examiner' : 'après le lot'}</em>${IC.droite}</div></div>`
    + `<div class="rangs x600">${L.slice(0, 2).map(([c, h]) => `<div class="rang"><b>${c}</b><span>à poser · ${h}</span><em class="val">Ouvrir</em>${IC.droite}</div>`).join('')}<div class="rang"><b>${n}</b> à poser en tout<em>${e.id === 'fin' ? 'à examiner' : 'après le lot'}</em>${IC.droite}</div></div>`;
}
const actions = e => e.verrou ? `<div class="verrou">${IC.cadenas}${e.verrou}</div>` : `<div class="actions${e.actions.length > 2 ? ' n3' : ''}">${e.actions.map((t, i) => `<button type="button"${i || e.sansPrincipal ? '' : ' class="pr"'}>${t}</button>`).join('')}</div>`;
const texte = e => e.avis ? `<p class="avis">${e.avis}</p>` : `<p class="ligne">${e.ligne}</p>`;

function rendre1(e) {
  return `<div class="p r1" data-etat="${e.id}" data-ton="${e.ton}">${barre(e)}<div class="r1-corps"><div class="r1-haut"><span class="etat"><i></i><h3>${e.mot}</h3></span><span>Partie 13</span></div>
<div class="r1-geant${e.geant[0].length > 3 ? ' quatre' : ''}"><strong>${e.geant[0]}</strong><span>${e.geant[1]}</span></div><div class="jauge" role="img" aria-label="Avancement ${e.pct} %"><b style="width:${e.pct}%"></b></div>${texte(e)}${trio(e)}<div class="pousse"></div>${rangs(e)}${actions(e)}</div></div>`;
}
function rendre2(e) {
  return `<div class="p r2" data-etat="${e.id}" data-ton="${e.ton}">${barre(e)}<div class="r2-corps"><section class="r2-carte"><div class="r2-tete"><span class="puce"><i></i><h3>${e.mot}</h3></span><span>Partie 13</span></div>
<div class="r2-bornes"><strong>${e.bornes[0]}</strong><div class="r2-piste" role="img" aria-label="Avancement ${e.pct} %"><b style="width:${e.pct}%"></b>${e.pct < 100 ? `<i style="left:${e.pct}%"></i>` : ''}</div><strong>${e.bornes[1]}</strong></div>
<div class="r2-legende"><span>${e.leg[0]}</span><span>${e.leg[1]}</span></div></section>${texte(e)}${trio(e)}<div class="pousse"></div>${e.champs ? '' : rangs(e)}${actions(e)}</div></div>`;
}
function rendre3(e) {
  const pct = e.id === 'pret' ? '' : `<div class="r3-pct"><strong class="nb">${e.id === 'fin' ? '93' : e.id === 'rattrapage' ? '1 sur 3' : e.pct + ' %'}</strong><span class="ligne">${{ cours: '18 cuts traités · fin au cut 4900', pause: 'depuis 1 min 45 · 18 cuts traités', toi: 'cut 4812 · 18 cuts traités', panne: 'arrêté après le cut 4811', rattrapage: 'posé · cut 4803 · ne touche à rien', relecture: '12 cuts relus sur 85 · 3 corrigés', fin: 'cuts traités · 6 à poser · export prêt' }[e.id]}</span></div>`;
  return `<div class="p r3" data-etat="${e.id}" data-ton="${e.ton}"><div class="r3-fond" style="width:${e.pct}%"></div>${barre(e)}<div class="r3-corps"><div class="pousse"></div><h3 class="r3-mot${e.long ? ' long' : ''}">${e.mot}<i></i></h3>${pct}${e.avis ? `<p class="avis">${e.avis}</p>` : e.id === 'pret' ? `<p class="ligne" style="margin-top:12px">${e.ligne}</p>` : ''}${trio(e)}${rangs(e)}${actions(e)}</div></div>`;
}

/* ───────────────────────────── la page */
const b64 = (f, mime) => `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
const image = (theme, taille, id) => { if (!CAPTURES) return null; const f = path.join(CAPTURES, `${theme}-${taille}-${id}.webp`); return fs.existsSync(f) ? b64(f, 'image/webp') : null; };
function existant(e) {
  if (!CAPTURES) return '<div class="absent">Photographie du panneau actuel : hors dépôt. Voir la page publiée.</div>';
  return ['clair', 'sombre'].map(th => [360, 600].map(t => `<img class="v-${th} v-${t}" src="${image(th, t, e.id)}" alt="Panneau actuel, ${e.nom}, thème ${th}, ${t === 360 ? '360 × 480' : '600 × 760'}" width="${t}" height="${t === 360 ? 480 : 760}" loading="lazy">`).join('')).join('');
}
const col = (n, titre, html, cls = '') => `<figure class="col ${cls}"><figcaption>${n ? `<b>${n}</b>` : ''}<span>${titre}</span></figcaption><div class="cadre">${html}</div></figure>`;
const rang = e => `<section class="etat" id="etat-${e.id}"><h2>${e.nom}</h2><div class="rang-p">${col('', 'Aujourd’hui', existant(e), 'ex')}${col('1', 'Le chiffre', rendre1(e))}${col('2', 'Le trajet', rendre2(e))}${col('3', 'Le mot', rendre3(e))}</div></section>`;

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
.rang-p{display:flex;gap:16px;overflow-x:auto;padding:4px 16px 16px;margin:0 -16px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.col{margin:0;flex:none;scroll-snap-align:center}
.col figcaption{display:flex;gap:8px;align-items:center;height:24px;margin-bottom:8px;font-size:14px;color:var(--pg-tx2)}
.col figcaption b{font-size:12px;font-weight:600;width:20px;height:20px;display:grid;place-items:center;border-radius:5px;background:var(--pg-tx);color:var(--pg)}
.col .cadre{box-shadow:0 0 0 1px var(--pg-trait)}
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
<header><h1>Trois refontes du panneau</h1>
<p class="chapo">D’un coup d’œil : est-ce que tout va bien, et où en est le lot. Le reste est à un clic. À gauche de chaque rang, le panneau d’aujourd’hui.</p>
<ol class="trois">
<li><b>1</b><strong>Le chiffre</strong><span>L’avancement en un très grand chiffre, l’état au-dessus. Inspiré des widgets d’iOS (Bourse, Calendrier).</span></li>
<li><b>2</b><strong>Le trajet</strong><span>Une carte : le premier cut, le dernier, un point qui avance. Inspiré des activités en direct d’iOS (suivi d’un vol, d’une livraison).</span></li>
<li><b>3</b><strong>Le mot</strong><span>L’état écrit en très grand ; le fond du panneau se remplit avec le lot. Inspiré de l’écran de veille d’iOS et de la barre de téléchargement d’un navigateur.</span></li>
</ol>
<p class="chapo" style="margin-top:16px">Bleu : Ariane travaille. Gris : à l’arrêt. Orange : à toi. Rouge : en panne.</p></header>
<div class="reglages" role="group" aria-label="Affichage des panneaux"><div>Thème <span class="choix"><button type="button" id="th-clair" aria-pressed="true">Clair</button><button type="button" id="th-sombre" aria-pressed="false">Sombre</button></span></div><div>Taille <span class="choix"><button type="button" id="ta-360" aria-pressed="true">360 × 480</button><button type="button" id="ta-600" aria-pressed="false">600 × 760</button></span></div><div>Faire défiler chaque rang de côté.</div></div>
${ETATS.map(rang).join('\n')}
<section class="notes"><div><h2>Ce qui est passé derrière un clic</h2><ul>
<li><b>« Orbite ⌄ »</b>, en haut à gauche : Écho et Aurore.</li>
<li><b>« ··· »</b>, en haut à droite : les réglages, la palette (Ctrl K), le cache des exports et « Vider le cache », le choix de l’onglet ESV.</li>
<li><b>« À poser »</b> : la liste des cuts, avec « Ouvrir » et « Examiner » ; les verts à contrôler y sont aussi.</li>
<li>Toutes les actions du lot restent à l’écran : Démarrer, Pause, Reprendre, Arrêter, Réessayer, Reprise manuelle, Exporter, Nouveau lot.</li></ul></div>
<div><h2>Textes changés (même sens)</h2><ul>
<li><b>« 20 % »</b> : la place du lot entre son premier et son dernier cut (cut 4811 atteint, de 4790 à 4900). Le panneau actuel écrit « total inconnu ».</li>
<li><b>« 89 au plus à venir »</b> : les numéros qui restent jusqu’au dernier cut ; ESV en saute.</li>
<li><b>« ESV »</b> avec un point, à la place de « Utilisé par Ariane — ESV ».</li>
<li><b>Rail non résolu</b> : « Ariane ne sait pas poser un rail du cut 4812. Réessaie, ou reprends-le à la main. »</li>
<li><b>Rattrapage</b> : « Ariane travaille dans ESV : ne touche à rien. »</li></ul></div>
<div><h2>À savoir</h2><ul>
<li><b>Police.</b> Les propositions s’affichent avec la police de l’appareil qui ouvre cette page. Le panneau d’aujourd’hui est une photographie.</li>
<li><b>À vérifier avant de construire.</b> Pour un lot « jusqu’à la fin de la partie », le pourcentage demande le numéro du dernier cut de la partie.</li>
<li><b>Rien n’est installé.</b> Ce sont des maquettes ; l’extension n’a pas changé.</li></ul></div></section>
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
  const tete = `<title>Panneau Ariane, tour 3</title>\n${PUBLIER ? '<meta name="' + ['c', 'laude:viewport-fit-sides'].join('') + '" content="cover">\n' : ''}<style>\n${PAGE_CSS}\n${fs.readFileSync(path.join(ICI, 'style.css'), 'utf8')}\n</style>`;
  return PUBLIER ? `${tete}\n${corps}\n` : `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n${tete}\n</head>\n<body>\n${corps}\n</body>\n</html>\n`;
}
fs.writeFileSync(SORTIE, page());
console.log(`${SORTIE} · ${Math.round(fs.statSync(SORTIE).size / 1024)} ko · ${ETATS.length} états × 3 refontes${CAPTURES ? ' · photographies incluses' : ' · sans photographie'}`);
