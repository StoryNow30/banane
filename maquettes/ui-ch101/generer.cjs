'use strict';
/* CH-101, étape 1 — fabrique la page à comparer : l'existant et trois propositions, état par état. Rien n'est intégré à l'extension.
 *   node maquettes/ui-ch101/generer.cjs                      → maquettes/ui-ch101/index.html (sans capture : interdit de CLAUDE.md)
 *   node maquettes/ui-ch101/generer.cjs --captures DOSSIER --sortie FICHIER [--publier]
 *        → page complète hors dépôt, captures et polices incluses ; --publier retire l'enveloppe html/head/body (page privée).
 * Chiffres fabriqués, cohérents entre eux (partie 13, lot du cut 4790 au cut 4900). Libellés : ceux du panneau, sauf mention « texte proposé ». */
const fs = require('node:fs'), path = require('node:path');
const ICI = __dirname, RACINE = path.resolve(ICI, '../..');
const arg = n => { const i = process.argv.indexOf('--' + n); return i < 0 ? null : process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true; };
const CAPTURES = arg('captures'), SORTIE = arg('sortie') || path.join(ICI, 'index.html'), PUBLIER = !!arg('publier');

/* ───────────────────────────── le lot fabriqué */
const DEBUT = 4790, FIN = 4900;
const VERTS = new Set([4793, 4799, 4800, 4806, 4815, 4816, 4824, 4833, 4841, 4842, 4850, 4858, 4866, 4871, 4880, 4888, 4889, 4895]); /* déjà valides dans ESV : le lot ne les ouvre pas */
const DIF = { 4796: 'g', 4803: 'gd', 4809: 'd', 4838: 'd', 4861: 'gd', 4877: 'g' };
const RAIL = { g: 'rail gauche', d: 'rail droit', gd: 'les deux rails' };
const DUREE = n => (6.2 + ((n * 37) % 23) / 10).toFixed(1).replace('.', ',');
const compte = jusqua => { let t = 0, d = 0; for (let n = DEBUT; n <= jusqua; n++) if (!VERTS.has(n)) { t++; if (DIF[n]) d++; } return { traites: t, aposer: d, poses: t - d }; };
const difs = (jusqua, sauf = []) => Object.keys(DIF).map(Number).filter(n => n <= jusqua && !sauf.includes(n)).sort((a, b) => b - a);
const nb = (n, un, pl) => `${n} ${n > 1 ? pl : un}`;

const ETATS = [
  { id: 'pret', nom: 'Prêt', ton: 'neutre', mot: 'Prêt', phrase: 'Partie 13 · du cut <b class="mono">4790</b> jusqu’à la fin de la partie', atteint: DEBUT - 1, cur: 4790, fen: [4790, 4837],
    actions: ['Démarrer le lot'], cache: ['Cache des exports', 'Vider le cache'], capture: '02-pret',
    critique: ['Un cercle vide pour dire « Prêt » : le signe ne dit ni la partie ni la voie.', 'La note sous les champs (13 px, gris) porte la règle la plus importante de l’écran : où le lot s’arrêtera.', 'Plus de la moitié de la fenêtre est vide ; la poignée du bas annonce « Verts pas encore calculés » alors qu’aucun lot n’a tourné.'] },
  { id: 'cours', nom: 'Lot en cours', ton: 'travail', mot: 'En cours', phrase: 'Pose du cut <b class="mono">4812</b>', atteint: 4811, cur: 4812, fen: [4790, 4837],
    allure: '<b>8,2</b> cuts par minute · médiane <b>7,4 s</b> par cut', actions: ['Pause', 'Arrêter le lot'], cache: ['Cache des exports · après le lot', 'Vider le cache'], capture: '03-lot-en-cours',
    critique: ['Le vert de l’anneau dit « Ariane travaille », le même vert dit « ESV connecté » dans la barre : deux sens.', '« Arrêter le lot » est écrit en rouge en permanence : il y a du rouge à l’écran quand tout va bien.', 'Lot borné de 4790 à 4900, mais « total inconnu » : le curseur du rail tombe toujours vers les deux tiers d’une échelle calculée, sa position ne veut rien dire.', '« à poser » : la seule chose qui attendra l’opérateur est un chiffre ambre de 15 px à droite, et une poignée repliée en bas.'] },
  { id: 'pause', nom: 'En pause', ton: 'attente', mot: 'En pause', phrase: 'Après le cut <b class="mono">4811</b>', atteint: 4811, cur: 4812, fen: [4790, 4837],
    allure: 'en pause depuis <b>1 min 44</b> · médiane <b>7,4 s</b> par cut avant la pause', actions: ['Reprendre', 'Arrêter le lot'], cache: ['Cache des exports · après le lot', 'Vider le cache'], capture: '04-pause',
    critique: ['L’ambre de la pause est aussi celui du chiffre « à poser » : une pause voulue et des cuts à reprendre ont la même couleur.', 'Vu du coin de l’œil, l’écran en pause et l’écran en cours ont la même silhouette : seuls un pictogramme de 24 px et un mot changent.', 'En 360 × 480, la ligne d’allure passe sur deux lignes et la poignée du tiroir glisse sous le bouton (visible sur la capture).'] },
  { id: 'toi', nom: 'Pause « rail non résolu »', ton: 'toi', mot: 'À toi', phrase: 'Partie 13 · après le cut <b class="mono">4811</b>', atteint: 4811, cur: 4812, fen: [4790, 4837], rail: 'd',
    avis: 'Le cut 4812 a un rail qu’Ariane ne sait pas poser. Choisis : réessayer, ou le reprendre à la main.', actions: ['Réessayer ce cut', 'Reprise manuelle', 'Arrêter le lot'], cache: ['Cache des exports · après le lot', 'Vider le cache'], capture: '05-pause-rail-non-resolu',
    critique: ['Le texte dit « réessayer, le reprendre à la main, ou le passer » : le bouton pour passer est masqué (D-320), le texte promet un choix qui n’existe pas.', 'Triangle d’avertissement : le même signe que pour « ESV ne répond plus ». « C’est à toi » et « c’est en panne » ne se distinguent que par le mot.', 'Le rail a disparu de l’écran au moment précis où l’on voudrait voir quel cut, et quel rail.'] },
  { id: 'panne', nom: 'ESV ne répond plus', ton: 'panne', mot: 'ESV ne répond plus', phrase: 'Partie 13 · après le cut <b class="mono">4811</b>', atteint: 4811, cur: 4812, fen: [4790, 4837],
    avis: 'Si la page ESV reste figée, recharge-la (F5), attends qu’elle réponde, puis clique sur Reprendre.', actions: ['Reprendre', 'Arrêter le lot'], cache: ['Cache des exports · après le lot', 'Vider le cache'], capture: '06-esv-ne-repond-plus',
    critique: ['« ESV ne répond plus » est écrit trois fois (puce, mot d’état, première phrase de l’avis).', 'Même rouge pour l’alerte et pour « Arrêter le lot » juste à côté de « Reprendre » : l’œil ne sait pas lequel est le danger.'] },
  { id: 'rattrapage', nom: 'Rattrapage (deuxième passe)', ton: 'travail', mot: 'Rattrapage', phrase: 'Ariane travaille dans ESV · ne touche à rien', atteint: FIN, cur: 4803, fen: [4790, 4837],
    verrou: 'Aucune action jusqu’à la fin du rattrapage', passe: { cut: 4803, posees: 1, demandees: 3 }, cache: ['Cache des exports · après le rattrapage', 'Vider le cache'], capture: '10-deuxieme-passe',
    critique: ['Une phrase à quatre points médians : « Ariane travaille dans ESV · ne touche à rien · cut 4813 · 1 posé sur 3 ». L’ordre (ne touche à rien) et le compte (1 sur 3) ont le même poids.', 'Deux cadenas pour un seul message, et rien qui bouge : on ne voit pas qu’Ariane travaille.'] },
  { id: 'relecture', nom: 'Relecture', ton: 'travail', mot: 'Relecture', phrase: '<b>12</b> sur <b>85</b>, <b>3</b> corrigés · cut <b class="mono">4801</b>', atteint: FIN, cur: 4801, fen: [4790, 4837], rel: { faits: 12, total: 85, corriges: 3 },
    actions: ['Arrêter la relecture', 'Nouveau lot'], cache: ['Cache des exports · après la relecture', 'Vider le cache'], capture: '09-relecture',
    critique: ['Le mot « Relecture » puis la phrase « Relecture 12 sur 85 » : répété, et aucun dessin de l’avancement alors que le total (85) est connu.', 'Le seul objet visible est un bouton cerclé de rouge, « Arrêter la relecture » : l’écran d’un travail qui se passe bien ressemble à une alerte.', '« Nouveau lot » est offert pendant la relecture, à côté de l’arrêt.'] },
  { id: 'fin', nom: 'Fin de lot', ton: 'sur', mot: 'Terminé', phrase: 'Partie 13', atteint: FIN, cur: null, fen: [4853, 4900], rattrape: [4796, 4838],
    fin: [['Lot', '<b>93</b> cuts traités'], ['Bornes', 'du cut <b class="mono">4790</b> au cut <b class="mono">4900</b>'], ['Rattrapage', '<b>2</b> posés et validés sur <b>2</b> décidés'], ['Il reste', '<span class="t">4 à poser</span>, <b>2</b> verts à contrôler'], ['Export', 'prêt']],
    actions: ['Voir ce qui reste', 'Exporter le dossier', 'Nouveau lot'], cache: ['Cache des exports', 'Vider le cache'], capture: '07-fin-de-lot',
    critique: ['Coche verte « Terminé » alors qu’il reste des cuts à poser : le vert dit « fini » là où l’opérateur attend « sûr ».', '« Il reste 3 à poser » est écrit en blanc ici, en ambre dans la poignée dix lignes plus bas.', 'Tiroir ouvert, le chiffre 3 est écrit cinq fois (3 à examiner, 3 à poser, 3 sur 3, À POSER 3, reste à examiner 3).', 'L’action principale, « Voir ce qui reste », ne fait qu’ouvrir le tiroir : la liste aurait la place d’être déjà là.'] },
];

/* ───────────────────────────── signes communs */
const LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="butt"><path d="M5 21L10.4 3M19 21L13.6 3"/><path d="M7.4 15h9.2M9 9.6h6" stroke-width="1.6"/></svg>';
const esv = e => e.ton === 'panne' ? ['panne', 'ESV ne répond plus'] : ['sur', 'ESV connecté'];
const resteDe = e => e.id === 'pret' ? [] : difs(e.atteint, e.rattrape || []);
const ouvrir = e => ['fin'].includes(e.id) ? '<u>Ouvrir</u>' : '';

/* ═════════════════════════════════════════════════════════════ A · Plan de voie */
function glypheA(e) {
  const R = (x1, x2, o = 1, extra = '') => `<path d="M${x1} 5H${x2}M${x1} 15H${x2}" stroke-opacity="${o}"${extra}/>`;
  const c = { pret: R(2, 30, .4) + '<path d="M3 1v18" stroke-width="2.5"/>',
    cours: R(2, 16) + R(16, 30, .4) + '<path d="M16 0v20" stroke-width="2.5"/>',
    pause: R(2, 13) + R(19, 30, .4) + '<path d="M13 1v18M19 1v18" stroke-width="2.5"/>',
    toi: '<path d="M2 5h28M2 15h12M22 15h8"/><path d="M14 15h8" stroke-dasharray="2 2" stroke-width="1.5"/><path d="M18 1v18" stroke-width="2.5"/>',
    panne: '<path d="M2 5h10M20 5h10M2 15h10M20 15h10"/><path d="M13 19l6-18" stroke-width="2.5"/>',
    rattrapage: '<path d="M2 5h28M2 15h9M21 15h9"/><path d="M11 15h5" stroke-width="3.2"/>',
    relecture: R(2, 30) + '<path d="M12 0v20" stroke-width="2.5"/><path d="M20 7.5l-3 2.5 3 2.5" stroke-width="1.6"/>',
    fin: R(2, 27) + '<path d="M28 1v18" stroke-width="3.2"/>' }[e.id];
  return `<svg viewBox="0 0 32 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${c}</svg>`;
}
const miniA = r => `<svg viewBox="0 0 22 14" fill="none" stroke-width="2" aria-hidden="true"><path d="M1 3h20" stroke="${/g/.test(r) ? 'var(--toi)' : 'var(--encre2)'}"${/g/.test(r) ? ' stroke-dasharray="3 2"' : ''}/><path d="M1 11h20" stroke="${/d/.test(r) ? 'var(--toi)' : 'var(--encre2)'}"${/d/.test(r) ? ' stroke-dasharray="3 2"' : ''}/></svg>`;
function planA(e) {
  const [a, b] = e.fen, pas = 100 / (b - a + 1), x = n => ((n - a + .5) * pas).toFixed(2) + '%';
  const fait = Math.max(0, Math.min(b, e.atteint) - a + 1) * pas, sauf = e.rattrape || [];
  let h = `<div class="pa-plan"><span class="pa-nomfile g">G</span><span class="pa-nomfile d">D</span><div class="pa-file g"><b style="width:${fait.toFixed(2)}%"></b></div><div class="pa-file d"><b style="width:${fait.toFixed(2)}%"></b></div>`;
  for (let n = a; n <= Math.min(b, e.atteint); n++) h += VERTS.has(n) ? `<i class="v" style="left:${x(n)}"></i>` : DIF[n] && !sauf.includes(n) ? `<i class="m ${DIF[n]}" style="left:${x(n)}"></i>` : `<i style="left:${x(n)}"></i>`;
  if (e.cur !== null && e.cur >= a && e.cur <= b) h += `<div class="pa-cur" style="left:${x(e.cur)}" data-ton="${e.ton}"${e.cur - a < 3 ? ' data-bord="g"' : b - e.cur < 3 ? ' data-bord="d"' : ''}><span>${e.cur}</span></div>`;
  h += `</div><div class="pa-regle"><span>${a}</span><span>${b === FIN ? FIN : `${b} → ${FIN}`}</span></div>`;
  h += `<div class="pa-lot"><b style="left:${((a - DEBUT) / (FIN - DEBUT + 1) * 100).toFixed(2)}%;width:${((b - a + 1) / (FIN - DEBUT + 1) * 100).toFixed(2)}%"></b></div>`;
  return `<section class="pa-voie" aria-label="Plan du lot">${h}</section>`;
}
function resteA(e, cls) {
  const L = resteDe(e); if (!L.length) return '';
  return `<section class="${cls}-reste"><h4>À poser · ${L.length} <span>${e.id === 'fin' ? 'à reprendre dans ESV' : 'à reprendre après le lot'}</span></h4><div class="liste"><ul>${L.map(n => `<li>${cls === 'pa' ? miniA(DIF[n]) : paireB(/g/.test(DIF[n]) ? 'manqueMini' : 'vide', /d/.test(DIF[n]) ? 'manqueMini' : 'vide')}<b class="mono">${n}</b><em>${RAIL[DIF[n]]}</em>${ouvrir(e)}</li>`).join('')}</ul></div></section>`;
}
const champs = cls => `<div class="${cls}-bornes" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label style="display:block"><span style="display:block;font-size:var(--t-meta);color:var(--encre2)">Premier cut</span><span class="mono" style="display:block;border:1px solid var(--encre3);padding:6px 8px;margin-top:3px">4790</span></label><label style="display:block"><span style="display:block;font-size:var(--t-meta);color:var(--encre2)">Dernier cut</span><span style="display:block;border:1px solid var(--encre3);padding:6px 8px;margin-top:3px;color:var(--encre2)">fin de partie</span></label></div><p style="color:var(--encre)">Dernier cut vide : le lot va jusqu’à la fin de la partie, puis se clôt seul.</p>`;
const actions = (e, cls) => e.verrou ? `<div class="${cls}-verrou">${e.verrou}</div>` : `<div class="${cls}-actions${e.actions.length > 2 ? ' n3' : ''}">${e.actions.map((t, i) => `<button type="button"${i ? '' : e.id === 'relecture' ? ' class="large"' : ' class="pr"'}>${t}</button>`).join('')}</div>`;
const pied = (e, cls) => `<footer class="${cls}-pied">${actions(e, cls)}<p class="${cls}-cache">${e.cache[0]}<span>${e.cache[1]}</span></p></footer>`;

function rendreA(e) {
  const c = compte(e.atteint), [et, el] = esv(e);
  let corps = `<div><div class="pa-mot">${glypheA(e)}<h3>${e.mot}</h3></div><p class="pa-phrase">${e.id === 'rattrapage' ? `${e.phrase} · cut <b class="mono">${e.passe.cut}</b>` : /Partie 13/.test(e.phrase) ? e.phrase : e.phrase + ' · partie 13'}</p></div>`;
  if (e.avis) corps += `<p class="pa-avis">${e.avis}</p>`;
  if (e.id === 'pret') corps += champs('pa');
  corps += planA(e);
  if (e.fin) corps += `<dl class="pa-fin">${e.fin.filter(l => l[0] !== 'Bornes').map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  else if (e.id === 'rattrapage') corps += `<dl class="pa-chiffres"><div class="s"><dt>posés au rattrapage</dt><dd>${e.passe.posees}</dd></div><div><dt>décidés</dt><dd>${e.passe.demandees}</dd></div><div><dt>plafond par lot</dt><dd>10</dd></div></dl>`;
  else if (e.id === 'relecture') corps += `<dl class="pa-chiffres"><div><dt>relus</dt><dd>${e.rel.faits}<span style="font-size:.6em;color:var(--encre2)"> / ${e.rel.total}</span></dd></div><div><dt>corrigés</dt><dd>${e.rel.corriges}</dd></div><div class="t"><dt>à poser</dt><dd>${resteDe(e).length}</dd></div></dl>`;
  else if (e.id !== 'pret') corps += `<dl class="pa-chiffres"><div class="s"><dt>posés</dt><dd>${c.poses}</dd></div><div class="t"><dt>à poser</dt><dd>${c.aposer}</dd></div><div><dt>traités</dt><dd>${c.traites}</dd></div></dl>`;
  if (e.allure) corps += `<p class="pa-allure">${e.id === 'pause' ? 'en pause depuis <b>1 min 44</b>' : e.allure}</p>`;
  corps += resteA(e, 'pa');
  return `<div class="p pa" data-etat="${e.id}" data-ton="${e.ton}"><header class="pa-barre"><span class="pa-logo">${LOGO}<span>Ariane</span></span><nav class="pa-nav"><span class="ici">Orbite</span><span>Écho</span><span>Aurore</span></nav><span class="pa-esv" data-ton="${et}"><i></i>${el}</span><span>Réglages</span></header><div class="pa-corps">${corps}</div>${pied(e, 'pa')}</div>`;
}

/* ═════════════════════════════════════════════════════════════ B · La coupe */
const PROFIL = 'M7 2h10a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-2.2c-.5 0-.8.4-.8.9v6.2c0 1.2.7 2.2 1.8 2.6l6 2.1c.7.3 1.2.9 1.2 1.7V26H1v-1.5c0-.8.5-1.4 1.2-1.7l6-2.1c1.1-.4 1.8-1.4 1.8-2.6v-6.2c0-.5-.3-.9-.8-.9H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z';
const TRAIT = { pose: 'fill="var(--sur)" stroke="var(--sur)"', plein: 'fill="var(--encre)" stroke="var(--encre)"', trouve: 'fill="none" stroke="var(--encre)"', vide: 'fill="none" stroke="var(--encre3)"',
  encours: 'fill="var(--encre)" fill-opacity=".1" stroke="var(--encre)" class="enc"', manque: 'fill="none" stroke="var(--toi)" stroke-dasharray="2.5 2.5"', manqueMini: 'fill="none" stroke="var(--toi)" stroke-width="2.2"', panne: 'fill="none" stroke="var(--panne)"' };
const profil = (t, dx = 0) => `<path d="${PROFIL}" transform="translate(${dx} 0)" stroke-width="1.6" stroke-linejoin="round" ${TRAIT[t]}/>`;
const paireB = (g, d) => `<svg viewBox="0 0 54 28" aria-hidden="true">${profil(g)}${profil(d, 30)}</svg>`;
function rendreB(e) {
  const c = compte(e.atteint), [et, el] = esv(e);
  const H = { pret: ['premier cut · partie 13', '4790', 'vide', 'vide', 'G', 'D'], cours: ['cut · partie 13', '4812', 'encours', 'encours', 'G · pose', 'D · pose'], pause: ['prochain cut · partie 13', '4812', 'vide', 'vide', 'G', 'D'],
    toi: ['cut · partie 13', '4812', 'trouve', 'manque', 'G · trouvé', 'D · non résolu'], panne: ['cut · partie 13', '4812', 'panne', 'panne', 'G · sans réponse', 'D'],
    rattrapage: ['cut · rattrapage', '4803', 'encours', 'encours', 'G · pose', 'D · pose'], relecture: ['cut relu · partie 13', '4801', 'pose', 'pose', 'G · posé', 'D · posé'], fin: ['cuts traités · partie 13', '93', 'pose', 'pose', 'G', 'D'] }[e.id];
  const phrase = { pret: 'du cut 4790 jusqu’à la fin de la partie', cours: 'Ariane pose ce cut', pause: 'après le cut 4811', toi: 'un rail qu’Ariane ne sait pas poser', panne: 'après le cut 4811', rattrapage: 'Ariane travaille dans ESV · ne touche à rien', relecture: '12 sur 85, 3 corrigés', fin: 'lot du cut 4790 au cut 4900' }[e.id];
  let corps = `<div class="pb-tete"><div class="pb-cut"><small>${H[0]}</small><strong>${H[1]}</strong></div><div class="pb-prof"><figure><svg viewBox="0 0 24 28" aria-hidden="true">${profil(H[2])}</svg><figcaption>${H[4]}</figcaption></figure><figure><svg viewBox="0 0 24 28" aria-hidden="true">${profil(H[3])}</svg><figcaption>${H[5]}</figcaption></figure></div></div>`;
  corps += `<div class="pb-etat"><h3>${e.mot}</h3><p>${phrase}</p></div>`;
  if (e.avis) corps += `<p class="pb-avis">${e.id === 'toi' ? 'Choisis : réessayer, ou le reprendre à la main.' : e.avis}</p>`;
  if (e.id === 'pret') corps += champs('pb');
  /* la cote : l'étendue du lot, ce qui est fait en trait plein, les cuts à poser en losange à leur place */
  if (e.id !== 'pret') {
    const pos = n => ((n - DEBUT) / (FIN - DEBUT) * 100).toFixed(2), at = e.id === 'relecture' ? e.rel.faits / e.rel.total * 100 : e.id === 'fin' || e.id === 'rattrapage' ? 100 : +pos(e.atteint);
    corps += `<div class="pb-cote" aria-label="Avancement"><div class="l"></div><div class="f" style="width:${at}%"></div><div class="b" style="left:0"></div><div class="b" style="left:${at}%"></div><div class="b" style="right:0"></div>`
      + (e.id === 'relecture' ? '' : resteDe(e).map(n => `<div class="m" style="left:${pos(n)}%"></div>`).join(''))
      + (e.id === 'relecture' ? `<span class="n">0</span><span class="n c" style="left:${at}%">12</span><span class="n d">85</span>` : `<span class="n">4790</span>${at < 100 ? `<span class="n c" style="left:${at}%">${e.atteint}</span>` : ''}<span class="n d">4900</span>`) + '</div>';
  }
  if (e.fin) corps += `<dl class="pb-fin">${e.fin.filter(l => l[0] !== 'Lot' && l[0] !== 'Bornes').map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  else if (e.id === 'rattrapage') corps += `<dl class="pb-tab"><div class="s"><dt>posés au rattrapage</dt><dd>${e.passe.posees} <small>sur ${e.passe.demandees} décidés</small></dd></div><div><dt>plafond par lot</dt><dd>10</dd></div></dl>`;
  else if (e.id === 'relecture') corps += `<dl class="pb-tab"><div><dt>relus</dt><dd>12 <small>/ 85</small></dd></div><div><dt>corrigés</dt><dd>3</dd></div><div class="t"><dt>à poser</dt><dd>${resteDe(e).length}</dd></div></dl>`;
  else if (e.id !== 'pret') corps += `<dl class="pb-tab"><div class="s"><dt>posés</dt><dd>${c.poses}</dd></div><div class="t"><dt>à poser</dt><dd>${c.aposer}</dd></div><div><dt>traités</dt><dd>${c.traites}</dd></div>${e.id === 'cours' ? '<div><dt>cuts par minute</dt><dd>8,2</dd></div>' : e.id === 'pause' ? '<div><dt>en pause depuis</dt><dd>1 min 44</dd></div>' : ''}</dl>`;
  corps += resteA(e, 'pb');
  return `<div class="p pb" data-etat="${e.id}" data-ton="${e.ton}"><header class="pb-barre"><span class="pb-logo">${LOGO}<span>Ariane</span></span><nav class="pb-nav"><span class="ici">Orbite</span><span>Écho</span><span>Aurore</span></nav><span class="pb-esv" data-ton="${et}">${el}</span><span>Réglages</span></header><div class="pb-corps">${corps}</div>${pied(e, 'pb')}</div>`;
}

/* ═════════════════════════════════════════════════════════════ C · Main courante */
function rendreC(e) {
  const c = compte(e.atteint), [et, el] = esv(e);
  const phrase = { pret: e.phrase, cours: e.phrase + ' · partie 13', pause: e.phrase + ' · en pause depuis <b>1 min 44</b>', toi: 'Le cut <b class="mono">4812</b> a un rail qu’Ariane ne sait pas poser.', panne: 'Recharge la page ESV (F5), attends qu’elle réponde, puis Reprendre.',
    rattrapage: 'Ariane travaille dans ESV · <b>ne touche à rien</b>', relecture: e.phrase, fin: 'Partie 13 · lot du cut <b class="mono">4790</b> au cut <b class="mono">4900</b>' }[e.id];
  let bandeau = `<h3>${e.mot}</h3><p>${phrase}</p>`;
  if (e.id === 'relecture') bandeau += `<div class="pc-jauge"><b style="width:${(12 / 85 * 100).toFixed(1)}%"></b></div>`;
  let corps = '';
  if (e.id === 'pret') corps += champs('pc');
  if (e.id === 'toi') corps += '<p class="pc-avis">Choisis : réessayer, ou le reprendre à la main.</p>';
  if (!['pret', 'fin', 'relecture', 'rattrapage'].includes(e.id)) corps += `<p class="pc-total"><span class="s"><b>${c.poses}</b> posés</span><span class="t"><b>${c.aposer}</b> à poser</span><span><b>${c.traites}</b> traités</span></p>${e.id === 'cours' ? '<p class="pc-total"><span><b>8,2</b> cuts par minute</span><span>médiane <b>7,4 s</b> par cut</span></p>' : ''}`;
  let lignes = '', tete = '<h4><span>Cut</span><span>Résultat</span><span>Durée</span></h4>';
  if (e.fin) { tete = '<h4><span>Bilan</span><span></span><span></span></h4>';
    lignes = e.fin.filter(l => l[0] !== 'Bornes').map(([k, v]) => `<li class="k${k === 'Il reste' ? ' t' : ''}"><span>${k}</span><span>${v.replace(/<span class="t">|<\/span>/g, '')}</span></li>`).join('')
      + resteDe(e).map(n => `<li class="t"><b>${n}</b><span>à poser · ${RAIL[DIF[n]]}</span><u>Ouvrir</u></li>`).join('');
  } else if (e.id === 'rattrapage') { tete = '<h4><span>Cut</span><span>Rattrapage · 1 posé sur 3 décidés</span><span></span></h4>';
    lignes = `<li class="vif"><b>4803</b><span>pose en cours…</span><span></span></li><li class="s"><b>4796</b><span>posé et validé</span><span>${DUREE(4796)} s</span></li>` + difs(FIN, [4796, 4803]).map(n => `<li class="t"><b>${n}</b><span>à poser · ${RAIL[DIF[n]]}</span><span></span></li>`).join('');
  } else if (e.id === 'relecture') { tete = '<h4><span>Cut</span><span>À poser · à reprendre après la relecture</span><span></span></h4>';
    lignes = resteDe(e).map(n => `<li class="t"><b>${n}</b><span>à poser · ${RAIL[DIF[n]]}</span><span></span></li>`).join('');
  } else if (e.id !== 'pret') {
    lignes = e.id === 'cours' ? '<li class="vif"><b>4812</b><span>pose en cours…</span><span>3 s</span></li>' : e.id === 'toi' ? '<li class="t"><b>4812</b><span>rail droit non résolu · à toi</span><span></span></li>' : e.id === 'panne' ? '<li class="vif"><b>4812</b><span>ESV ne répond plus</span><span></span></li>' : '<li class="vif"><b>4812</b><span>en attente · lot en pause</span><span></span></li>';
    for (let n = e.atteint; n >= DEBUT; n--) if (!VERTS.has(n)) lignes += DIF[n] ? `<li class="t"><b>${n}</b><span>à poser · ${RAIL[DIF[n]]}</span><span></span></li>` : `<li><b>${n}</b><span>posé et validé</span><span>${DUREE(n)} s</span></li>`;
  }
  if (lignes) corps += `<section class="pc-main">${tete}<div class="liste"><ul>${lignes}</ul></div></section>`;
  return `<div class="p pc" data-etat="${e.id}" data-ton="${e.ton}"><header class="pc-barre"><span class="pc-logo">A<span>RIANE</span></span><nav class="pc-nav"><span class="ici">Orbite</span><span>Écho</span><span>Aurore</span></nav><span class="pc-esv" data-ton="${et}">${el}</span><span>Réglages</span></header><section class="pc-bandeau">${bandeau}</section><div class="pc-corps">${corps}</div>${pied(e, 'pc')}</div>`;
}

/* ───────────────────────────── la page */
const POLICES = [['Hanken Grotesk', 'HankenGrotesk-latin-wght.woff2', '100 900'], ['Bricolage Grotesque', 'BricolageGrotesque-latin-opsz-wght.woff2', '200 800'], ['JetBrains Mono', 'JetBrainsMono-latin-wght.woff2', '100 800'],
  ['IBM Plex Sans', 'IBMPlexSans-latin-400.woff2', '400'], ['IBM Plex Sans', 'IBMPlexSans-latin-500.woff2', '500'], ['IBM Plex Sans', 'IBMPlexSans-latin-600.woff2', '600'], ['IBM Plex Mono', 'IBMPlexMono-latin-400.woff2', '400'], ['IBM Plex Mono', 'IBMPlexMono-latin-500.woff2', '500']];
const b64 = (f, mime) => `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
const polices = () => POLICES.map(([nom, f, w]) => `@font-face{font-family:"${nom}";src:url(${CAPTURES ? b64(path.join(RACINE, 'fonts', f), 'font/woff2') : '../../fonts/' + f}) format("woff2");font-weight:${w};font-display:swap}`).join('\n');
const image = (nom, taille) => { if (!CAPTURES) return null; const f = path.join(CAPTURES, `${taille}-${nom}.webp`); return fs.existsSync(f) ? b64(f, 'image/webp') : null; };
const existant = e => { const a = image(e.capture, 360), b = image(e.capture, 600);
  return a ? `<img class="t360" src="${a}" alt="Panneau actuel, ${e.nom}, 360 × 480" width="360" height="480"><img class="t600" src="${b}" alt="Panneau actuel, ${e.nom}, 600 × 760" width="600" height="760">` : '<div class="absent">Capture du panneau actuel : hors dépôt (aucune image du panneau n’est versée ici). Voir la page publiée.</div>'; };
const colonne = (titre, sous, html, cls = '') => `<figure class="col ${cls}"><figcaption><b>${titre}</b><span>${sous}</span></figcaption><div class="cadre">${html}</div></figure>`;
const rang = e => `<section class="etat" id="etat-${e.id}"><h3>${e.nom}</h3><div class="crit"><h4>Ce qui gêne dans l’existant</h4><ul>${e.critique.map(t => `<li>${t}</li>`).join('')}</ul></div>
<div class="rang">${colonne('Existant', 'Signal, tronc', existant(e), 'ex')}${colonne('A', 'Plan de voie', rendreA(e))}${colonne('B', 'La coupe', rendreB(e))}${colonne('C', 'Main courante', rendreC(e))}</div></section>`;
const AUTRES = [['01-accueil-hors-ligne', 'Aucun onglet ESV', 'Bien : une seule action. Mais « Démarrer le lot » grisé reste à côté, et la raison est écrite en dessous en gris.'], ['11-echo', 'Écho, en observation', 'Les barres vertes et grises n’ont pas de légende : on ne sait pas qu’une barre haute est une correction.'],
  ['13-constellation-onglet', 'Constellation, lot en cours', 'Anneau, onglets numérotés, tableau : trois façons de dire « partie 1 sur 2 » sur le même écran.'], ['16-aurore', 'Aurore, cut ouvert', 'Le plus abouti : une ligne vivante, un statut par cut. Le vert « ouvert dans ESV » y veut dire « en cours », encore un sens.'],
  ['17-reglages', 'Réglages', 'Trois sortes de commandes (liste, bascule à deux mots, bascule Non/Oui) pour le même geste : choisir une valeur.'], ['08-fin-de-lot-tiroir', 'Fin de lot, tiroir ouvert', 'La liste utile arrive enfin, sous une poignée tronquée (« verts pas encore calc… »).']];
const autres = () => CAPTURES ? `<section class="bloc"><h2>L’existant, les autres états</h2><p class="chapo">Photographiés aussi, non redessinés à cette étape : la proposition retenue s’y étendra.</p><div class="galerie">${AUTRES.map(([n, t, c]) => { const s = image(n, 360); return s ? `<figure><img src="${s}" alt="Panneau actuel, ${t}" width="360" height="480" loading="lazy"><figcaption><b>${t}</b>${c}</figcaption></figure>` : ''; }).join('')}</div></section>` : '';

const PAGE_CSS = `
/* la page : une colonne de lecture, puis par état un rang de quatre cadres à la taille réelle du panneau, qui défile de côté sur téléphone */
:root{--fond:#F2F3F1;--carte:#FFFFFF;--encre:#161A1D;--encre2:#4B555C;--filet:#D5D9D6;--accent:#0B5C8A;--marque:#FFE9C7;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--fond:#121517;--carte:#1B1F22;--encre:#ECEFEF;--encre2:#A9B3B8;--filet:#30373C;--accent:#7CC4E8;--marque:#4A3413;color-scheme:dark}}
:root[data-theme="dark"]{--fond:#121517;--carte:#1B1F22;--encre:#ECEFEF;--encre2:#A9B3B8;--filet:#30373C;--accent:#7CC4E8;--marque:#4A3413;color-scheme:dark}
body{background:var(--fond);color:var(--encre);font:400 16px/1.55 "Hanken Grotesk",system-ui,sans-serif;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 64px}
.page *{box-sizing:border-box}
.page{max-width:1560px;margin:0 auto}
.page h1{font:700 clamp(28px,5vw,44px)/1.05 "Bricolage Grotesque","Hanken Grotesk",sans-serif;letter-spacing:-.03em;margin:0;text-wrap:balance}
.page h2{font:700 24px/1.2 "Bricolage Grotesque","Hanken Grotesk",sans-serif;letter-spacing:-.02em;margin:0 0 12px;text-wrap:balance}
:where(.page) h3{font:700 19px/1.25 "Hanken Grotesk",sans-serif;margin:0}
:where(.page) h4{font:600 12px/1.3 "Hanken Grotesk",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--encre2);margin:0 0 6px}
:where(.page) p,:where(.page) li{max-width:68ch}
:where(.page) p{margin:0 0 10px}
:where(.page) ul,:where(.page) ol{margin:0;padding-left:20px}
:where(.page) li{margin-bottom:5px}
.chapo{color:var(--encre2)}
.bloc{margin-top:44px}
.tete{display:grid;gap:14px;padding-bottom:22px;border-bottom:2px solid var(--encre)}
.niv{font:500 11px/1 "JetBrains Mono",monospace;letter-spacing:.04em;padding:3px 5px;border:1px solid var(--encre2);color:var(--encre2);white-space:nowrap;vertical-align:1px}
.deux{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:24px 40px}
.partis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px}
.parti{background:var(--carte);border:1px solid var(--filet);padding:18px;display:grid;gap:10px;align-content:start}
.parti h3 span{font:500 13px/1 "JetBrains Mono",monospace;margin-right:8px;padding:3px 7px;background:var(--encre);color:var(--carte)}
.leg{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;font-size:14px;line-height:1.35}
.leg i{display:block;width:26px;height:14px}
.leg i.c{background:transparent;border:2px solid}
.taille{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:14px;color:var(--encre2)}
.taille button{font:600 14px/1 "Hanken Grotesk",sans-serif;height:36px;padding:0 14px;border:1px solid var(--encre);background:transparent;color:var(--encre);cursor:pointer}
.taille button[aria-pressed="true"]{background:var(--encre);color:var(--fond)}
.taille button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.etat{margin-top:40px;padding-top:18px;border-top:1px solid var(--filet)}
.crit{margin:10px 0 14px}
.crit li{color:var(--encre2);font-size:15px}
.rang{display:flex;gap:16px;overflow-x:auto;padding:4px 16px 14px;margin:0 -16px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.col{margin:0;flex:none;scroll-snap-align:center}
.col figcaption{display:flex;gap:8px;align-items:baseline;margin-bottom:8px;font-size:14px}
.col figcaption b{font:500 13px/1 "JetBrains Mono",monospace;padding:3px 7px;background:var(--encre);color:var(--fond)}
.col.ex figcaption b{background:transparent;color:var(--encre);border:1px solid var(--encre)}
.col figcaption span{color:var(--encre2)}
.col .cadre{outline:1px solid var(--filet)}
.col img{display:block;max-width:none}
.t600{display:none!important}.g600 .t600{display:block!important}.g600 .t360{display:none!important}
.col.ex .cadre{background:#121314}
.absent{position:absolute;inset:0;display:grid;place-items:center;padding:28px;text-align:center;color:#A6A9AD;font-size:14px;line-height:1.5}
.galerie{display:flex;gap:16px;overflow-x:auto;padding:4px 16px 14px;margin:0 -16px}
.galerie figure{margin:0;flex:none;width:300px}
.galerie img{display:block;width:300px;height:400px;outline:1px solid var(--filet)}
.galerie figcaption{font-size:14px;line-height:1.4;color:var(--encre2);margin-top:8px}
.galerie figcaption b{display:block;color:var(--encre)}
.marque{background:var(--marque);padding:0 3px}
table.sens{border-collapse:collapse;font-size:14px;width:100%;max-width:900px}
table.sens th,table.sens td{text-align:left;padding:7px 10px 7px 0;border-bottom:1px solid var(--filet);vertical-align:top}
table.sens th{font-weight:600;color:var(--encre2)}
.defile{overflow-x:auto}
`;

function page() {
  const corps = `<div class="page" id="page">
<header class="tete"><h1>Le panneau d’Ariane, tel qu’il est et tel qu’il pourrait être</h1>
<p class="chapo">Chantier CH-101, étape 1. Le panneau actuel photographié dans ses états réels, sa critique, et trois propositions dessinées sur ces mêmes états, avec les mêmes libellés. Rien n’est intégré : l’étape 2 attend un choix écrit.</p>
<div class="taille" role="group" aria-label="Taille de la fenêtre du panneau"><span>Taille de la fenêtre :</span><button type="button" id="taille-360" aria-pressed="true">360 × 480 (compacte)</button><button type="button" id="taille-600" aria-pressed="false">600 × 760</button><span>Chaque rang défile de côté : Existant, A, B, C.</span></div></header>

<section class="bloc deux"><div><h2>Ce qui a déjà été dit</h2>
<ul><li><b>D-230 à D-236</b> : les habillages inspirés d’autres logiciels ont plu en maquette puis ont été retirés ; ni gros titres, ni phrases qui prennent par la main.</li>
<li><b>D-256</b> : « les couleurs elles-mêmes » ne plaisent pas et « le sens ne va pas » ; symboles « trop génériques, trop vibe codé ». Demande : une palette et des signes propres au métier (rails, cuts, lots, ESV).</li>
<li><b>D-257</b> : trois directions rejetées pour leur esthétique générale. <b>D-271</b> : on est resté sur Signal.</li>
<li><b>Acquis, non touché ici</b> : la simplicité ; Lancer = lot neuf, Continuer = même lot, Préparer = ne lance rien ; le bouton SKIP reste masqué (D-320).</li></ul></div>
<div><h2>Comment les images ont été faites</h2>
<p>Le vrai <code>panel.html</code> du tronc, dans Chromium, avec le montage des essais de navigateur (réponses du service worker fabriquées) : 19 états, en 600 × 760 et en 360 × 480, aucune erreur de page. <span class="niv">ÉTABLI</span></p>
<p>Ce n’est pas la chaîne complète extension → maquette ESV : la pause, la relecture et le rattrapage ne s’y déclenchent pas à la demande. Les chiffres des captures sont ceux des essais (ils ne sont pas tous cohérents entre eux : « 1 à poser » en haut, « 3 à poser » en bas). <span class="niv">ÉTABLI</span></p></div></section>

<section class="bloc"><h2>Critique de l’existant</h2><div class="deux">
<div><h4>Couleurs</h4><p><b>Trois couleurs, une dizaine de sens.</b> Le vert dit « ESV connecté », « Ariane travaille », « Terminé », « Relecture » et marque le curseur. L’ambre dit « En pause » et « à poser ». Le rouge écrit « Arrêter le lot » pendant tout un lot sain, cercle « Arrêter la relecture », et sert aux alertes. <span class="niv">ÉTABLI</span></p>
<p>Lecture proposée du reproche « le sens ne va pas » : on attend d’une couleur qu’elle dise s’il faut agir ; ici le rouge est là quand tout va bien et le vert quand il reste du travail. <span class="niv">SUPPOSÉ</span></p></div>
<div><h4>Signes</h4><p><b>Dix pictogrammes d’interface générale</b> : cercle, deux barres, triangle, coche, cadenas, flèche de lecture, téléchargement, liste, engrenage, invite de commande. Seul le logo parle de rails. <span class="niv">ÉTABLI</span></p></div>
<div><h4>Le rail</h4><p><b>Il ne situe rien.</b> Sans total connu, son échelle est calculée (traités × 1,25, arrondi à la dizaine) : le curseur reste vers les deux tiers. On ne voit ni les bornes du lot, ni où sont les cuts à poser. <span class="niv">ÉTABLI</span></p></div>
<div><h4>Place</h4><p><b>La moitié de la fenêtre est vide, l’utile est replié.</b> En 600 × 760, l’état tient dans le tiers haut ; ce qui attend l’opérateur est dans une poignée de 40 px en bas. La bande « Cache des exports » garde 56 px pour un bouton grisé pendant tout le lot. <span class="niv">ÉTABLI</span></p></div>
<div><h4>Lisibilité</h4><p><b>Contraste mesuré 3,9:1</b> pour le texte tertiaire (« Lot du cut 4790 au cut 4900 », « après le lot »), sous le seuil de 4,5:1. Quatre lignes grises de taille voisine sans ordre de lecture ; le mot d’état (28 px) et le chiffre (44 px) se disputent la première place. <span class="niv">ÉTABLI</span></p></div>
<div><h4>Libellés</h4><p><b>« Utilisé par Ariane — E… »</b> : la puce coupe le seul mot utile, dans les deux tailles. La pause « rail non résolu » propose de « passer » un cut alors que ce bouton est masqué. « ESV ne répond plus » écrit trois fois sur le même écran. <span class="niv">ÉTABLI</span></p></div></div></section>

<section class="bloc"><h2>Trois partis pris</h2>
<p class="chapo">Une règle commune : la couleur répond à une seule question, « dois-je faire quelque chose ? ». Ariane qui travaille n’a pas de couleur, c’est le mouvement qui le dit. Aucun bouton ne porte une couleur de sens.</p>
<div class="partis">
<div class="parti"><h3><span>A</span>Plan de voie</h3><p>Le lot est dessiné comme la voie vue de dessus : deux files de rail, un trait par cut, à sa vraie place entre les bornes. On voit où Ariane en est, où sont les trous, et de quel côté.</p>
<div class="leg" style="--b:#8CCBEA;--o:#FF9B2E;--r:#FF6A5E"><i style="background:#8CCBEA"></i><span>bleu acier : posé et validé, ESV connecté</span><i style="background:#FF9B2E"></i><span>orange plein : à toi, maintenant</span><i class="c" style="border-color:#FF9B2E"></i><span>orange en contour : à toi, plus tard (à poser, pause)</span><i style="background:#FF6A5E"></i><span>rouge : en panne, ESV ne répond plus</span></div>
<p class="chapo">Signes : la voie, le trait de coupe, la traverse en pointillé avec un carré sur le rail qui manque, le heurtoir de fin.</p></div>
<div class="parti"><h3><span>B</span>La coupe</h3><p>Le cut lui-même au centre : son numéro en très grand, celui qu’on lit dans ESV, et les deux rails vus en coupe, chacun avec son état. Fond clair de plan technique ; l’avancement est une cote.</p>
<div class="leg"><i style="background:#0A6847"></i><span>vert profond : posé et validé, ESV connecté</span><i style="background:#FF9B2E"></i><span>orange plein : à toi, maintenant</span><i class="c" style="border-color:#A84300"></i><span>orange brûlé en trait : à toi, plus tard</span><i style="background:#B3261E"></i><span>rouge : en panne</span></div>
<p class="chapo">Signes : le profil du rail (plein = posé, pointillé orange = non résolu), la cote entre deux bornes, le losange d’un cut à poser.</p></div>
<div class="parti"><h3><span>C</span>Main courante</h3><p>Un bandeau d’état qui se lit du coin de l’œil pendant qu’on regarde ESV, puis le journal du lot : une ligne par cut, la dernière en haut, avec sa durée. Aucun pictogramme : les mots et la couleur du bandeau.</p>
<div class="leg"><i style="background:#1C7A55"></i><span>vert : sûr, lot clos (bandeau plein) ; posé (texte)</span><i style="background:#FFC61A"></i><span>jaune plein : à toi, maintenant</span><i class="c" style="border-color:#FFC61A"></i><span>jaune en contour ou en marge : à toi, plus tard</span><i style="background:#C0281C"></i><span>rouge : en panne</span></div>
<p class="chapo">Signes : aucun dessin ; une marque de marge par ligne, le bandeau, le défilement sous le bandeau quand Ariane travaille.</p></div>
</div></section>

<section class="bloc"><h2>État par état</h2><p class="chapo">Mêmes chiffres dans les trois propositions : partie 13, lot du cut 4790 au cut 4900, trois cuts à poser en cours de lot (4796 rail gauche, 4803 les deux rails, 4809 rail droit). Données fabriquées.</p>
${ETATS.map(rang).join('\n')}</section>

${autres()}

<section class="bloc deux"><div><h2>Ce qui reste à vérifier</h2>
<div class="defile"><table class="sens"><thead><tr><th>Ce que les propositions affichent</th><th>D’où cela vient</th><th></th></tr></thead><tbody>
<tr><td>Position de chaque cut posé ou à poser</td><td><code>batch.processed[].cut</code>, <code>batch.deferred[].cut</code>, bornes du lot</td><td><span class="niv">ÉTABLI</span></td></tr>
<tr><td>Rail concerné d’un cut à poser</td><td>précision déjà calculée pour le tiroir (<code>src/ui5.js</code>)</td><td><span class="niv">ÉTABLI</span></td></tr>
<tr><td>Durée par cut (C)</td><td><code>batch.processed[].durationMs</code></td><td><span class="niv">ÉTABLI</span></td></tr>
<tr><td>Rail concerné pendant la pause « rail non résolu » (A, B, C)</td><td>à lire dans l’état de la pause ; sinon « un rail » sans côté</td><td><span class="niv">SUPPOSÉ</span></td></tr>
<tr><td>Détail par cut du rattrapage (C)</td><td>le panneau reçoit le cut en cours et le compte ; les lignes par cut sont à confirmer</td><td><span class="niv">SUPPOSÉ</span></td></tr>
<tr><td>Lot de plusieurs milliers de cuts (A)</td><td>le plan montre une fenêtre de 48 cuts qui défile ; la réglette du dessous garde tout le lot</td><td><span class="niv">PROBABLE</span></td></tr>
</tbody></table></div>
<p style="margin-top:12px">Textes proposés, à valider avec le reste : « ESV connecté » à la place de « Utilisé par Ariane — ESV » ; la phrase de la pause sans « ou le passer ». Contrastes des trois propositions mesurés : tout texte à 4,5:1 au moins.</p></div>
<div><h2>Ce qu’il faut décider</h2>
<ol><li><b>Laquelle</b> : A, B, C, ou un mélange (par exemple le bandeau de C au-dessus du plan de A).</li>
<li><b>Le sens des couleurs</b> : sûr, à toi (plein = maintenant, contour = plus tard), en panne, et rien pour « Ariane travaille ». Est-ce ce qui est attendu ?</li>
<li><b>Sombre ou clair</b> : B est claire, A et C sombres ; chacune peut être déclinée dans l’autre teinte.</li>
<li><b>La taille réelle</b> de la fenêtre sur le poste de travail : les dessins tiennent en 360 × 480 et en 600 × 760.</li></ol>
<p class="chapo">Les autres écrans (Écho, Constellation, Aurore, réglages) seront dessinés dans la direction retenue avant toute intégration.</p></div></section>
</div>
<script>
(function(){var p=document.getElementById('page'),a=document.getElementById('taille-360'),b=document.getElementById('taille-600');
function ajuster(){var L=p.classList.contains('g600')?600:360,z=Math.min(1,(document.documentElement.clientWidth-32)/L);
 [].forEach.call(document.querySelectorAll('.col .cadre'),function(c){c.style.zoom=L===360?z:1;});}
function choisir(g){p.classList.toggle('g600',g);a.setAttribute('aria-pressed',String(!g));b.setAttribute('aria-pressed',String(g));ajuster();}
a.addEventListener('click',function(){choisir(false);});b.addEventListener('click',function(){choisir(true);});window.addEventListener('resize',ajuster);ajuster();})();
</script>`;
  /* la balise de marge latérale n'est utile qu'à la page publiée */
  const tete = `<title>Panneau Ariane CH-101</title>\n${PUBLIER ? '<meta name="' + ['c', 'laude:viewport-fit-sides'].join('') + '" content="cover">\n' : ''}<style>\n${polices()}\n${PAGE_CSS}\n${fs.readFileSync(path.join(ICI, 'style.css'), 'utf8')}\n</style>`;
  return PUBLIER ? `${tete}\n${corps}\n` : `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n${tete}\n</head>\n<body>\n${corps}\n</body>\n</html>\n`;
}
fs.writeFileSync(SORTIE, page());
console.log(`${SORTIE} · ${Math.round(fs.statSync(SORTIE).size / 1024)} ko · ${ETATS.length} états × 3 propositions${CAPTURES ? ' · captures incluses' : ' · sans capture'}`);
module.exports = { ETATS, rendreA, rendreB, rendreC };
