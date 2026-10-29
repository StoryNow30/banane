(() => {
'use strict';
/* CH-022 : code commun de Q-signal-2 (raffinement mesuré) et Q-signal-3 (raffinement poussé).
 * Repris de Q-signal.html et de S-file-de-parties.html (variante A, D-261) : mêmes scènes, mêmes
 * commandes, même simulation. Ce qui change : le système de valeurs (raffinement-signal.md § 3),
 * les symboles tirés du rail, les couleurs à rôle unique, la copie qui ne répète pas les boutons.
 * CH-024 : niveaux 4 et 5 (data-mix) = ce même code et ce même système de valeurs, avec les dessins de
 * Q-signal.html (logo, glyphes d'état, icônes, marques du rail, point de la puce) recolorés par rôle. */
const D = document, R = D.documentElement, FEN = D.getElementById('fen');
const MIX = R.dataset.mix === '1';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fr = n => String(n).replace('.', ',');
const quantile = (t, f) => { if (!t.length) return null; const s = [...t].sort((a, b) => a - b), p = f * (s.length - 1), a = Math.floor(p), b = Math.ceil(p); return s[a] + (s[b] - s[a]) * (p - a); };
const duree = s => { s = Math.max(0, Math.round(s)); if (s < 60) return `${s} s`; const m = Math.floor(s / 60), r = s % 60; return r && m < 10 ? `${m} min ${String(r).padStart(2, '0')}` : `${m} min`; };
const pl = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

/* ─────────────────────────── pictogrammes : un seul trait (2 px), le moins possible */
const T = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const SVG = (inner, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''} ${T}>${inner}</svg>`;
const IC = {
  logo: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20L10.4 4M19 20L13.6 4"/><path d="M7.4 15h9.2" stroke-opacity=".7"/><path d="M9 10.4h6" stroke-opacity=".45"/></svg>`,
  chevron: SVG('<path d="M9 6l6 6-6 6"/>', 'fl'),
  bas: SVG('<path d="M7 10l5 5 5-5"/>', 'fl'),
  fermer: SVG('<path d="M6 6l12 12M18 6L6 18"/>'),
  reglages: SVG('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
  ouvrir: SVG('<path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6"/>'),
  coche: SVG('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
};
/* Glyphe d'état : un bout de rail, dessiné avec les marques du grand rail (raffinement-signal.md § 3).
 * trait = fait (encre) ; reste = pointillé (encre 3) ; repere = la marque de l'état (couleur du rôle). */
const G = {
  fait: (x1, x2) => `<path class="g-fait" d="M${x1} 12H${x2}"/>`,
  reste: (x1, x2) => `<path class="g-reste" d="M${x1} 12H${x2}"/>`,
  rep: d => `<path class="g-rep" d="${d}"/>`,
};
const GL = inner => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke-width="2" stroke-linecap="butt">${inner}</svg>`;
const GLYPHE = {
  repos: GL(G.rep('M3 8v8') + G.reste(5, 21)),
  marche: GL(G.fait(3, 10) + G.rep('M11 6v12M9 6h4') + '<path class="g-rep arc" d="M12 12h7" stroke-width="4" stroke-dasharray="7" stroke-dashoffset="7"/>' + G.reste(13, 21)),
  verrou: GL(G.fait(3, 10) + G.rep('M11 6v12M9 6h4') + G.reste(13, 21)),
  dem: GL(G.fait(3, 10) + G.rep('M11 6v12M9 6h4') + G.reste(13, 16) + '<path class="g-fait" d="M18 7v10"/>'),
  pause: GL(G.fait(3, 9) + G.rep('M11 7v10M15 7v10') + G.reste(17, 21)),
  rupture: GL(G.fait(3, 8) + G.rep('M10 7l-2 10M16 7l-2 10') + G.reste(16, 21)),
  heurtoir: GL(G.fait(3, 17) + '<path class="g-fait" d="M18 6v12M21 8v8"/>'),
  hors: GL(G.reste(3, 9) + G.reste(15, 21)),
  arrete: GL(G.fait(3, 10) + '<path class="g-fait" d="M11 7v10"/>' + G.reste(13, 21)),
};
/* Marques du rail, en ligne dans le texte : ○ différé, ◆ vert à contrôler, • corrigé, × passé (SKIP). */
const MQ = { dif: 'différé', ctl: 'vert à contrôler', corr: 'corrigé', skip: 'passé' };
/* niveaux 4 et 5 : pas de marque en ligne (l'actuelle n'en avait pas) : le mot et le nombre suffisent */
const mq = k => MIX ? '' : `<i class="mq mq-${k}" data-forme="${MQ[k]}" aria-hidden="true"></i>`;

/* CH-024 : les dessins de Q-signal.html, tels quels (trait 1,75 dans 24, dessinés à 16, 18 ou 28 px). */
if (MIX) {
  const T4 = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  const S4 = (inner, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''} ${T4}>${inner}</svg>`;
  Object.assign(IC, {
    chevron: S4('<path d="M9 6l6 6-6 6"/>', 'fl'), bas: S4('<path d="M6 9l6 6 6-6"/>', 'fl'), fermer: S4('<path d="M6 6l12 12M18 6L6 18"/>'),
    cadenas: S4('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    palette: S4('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10l3 2-3 2M12 14h5"/>'),
    reglages: S4('<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>'),
    pause: S4('<path d="M8 5v14M16 5v14" stroke-width="2.5"/>'), play: S4('<path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/>'),
    stop: S4('<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none"/>'),
    coche: S4('<path d="M5 12.5l4.5 4.5L19 7.5"/>'), ouvrir: S4('<path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6"/>'),
    export: S4('<path d="M12 4v11M7 10l5 5 5-5M5 19h14"/>'), liste: S4('<path d="M5 7h14M5 12h14M5 17h9"/>'),
    retour: S4('<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5"/>'),
    echo: S4('<path d="M12 12h.01"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>'),
  });
}
const C4 = 2 * Math.PI * 9;
const GLYPHE4 = (() => {
  const S4 = inner => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  return {
    pret: S4('<circle cx="12" cy="12" r="9"/>'),
    cours: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke-width="1.75" stroke-linecap="butt"><circle class="fond-anneau" cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity=".3"/><circle class="arc" cx="12" cy="12" r="9" stroke="currentColor" transform="rotate(-90 12 12)" stroke-dasharray="${C4.toFixed(2)}" stroke-dashoffset="${C4.toFixed(2)}"/></svg>`,
    dem: S4('<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><path d="M9.5 8.5v7M14.5 8.5v7" stroke-width="2.2"/>'),
    pause: S4('<path d="M8 5v14M16 5v14" stroke-width="2.5"/>'),
    toi: S4('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>'),
    interrompu: S4('<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M8 12h8"/>'),
    fini: S4('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    arrete: S4('<rect x="5" y="5" width="14" height="14" rx="1.5"/>'),
    relpause: S4('<circle cx="12" cy="12" r="9"/><path d="M9.8 8.5v7M14.2 8.5v7" stroke-width="2"/>'),
    verrou: S4('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    hors: S4('<circle cx="12" cy="12" r="9"/><path d="M6 18L18 6"/>'),
    echoVide: S4('<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>'),
    echo: S4('<path d="M12 12h.01" stroke-width="3"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>'),
  };
})();
/* état du modèle (glyphe de Q2) → dessin de l'actuelle, scène par scène comme dans Q-signal.html */
const glyphe4 = m => ({ repos: m.etat === 'echoVide' ? 'echoVide' : 'pret', marche: m.etat === 'echo' ? 'echo' : 'cours', dem: 'dem', pause: m.etat === 'relecture' ? 'relpause' : 'pause', rupture: m.etat === 'interrompu' ? 'interrompu' : 'toi', heurtoir: 'fini', hors: 'hors', verrou: 'verrou', arrete: 'arrete' })[m.glyphe];
/* icônes des boutons pleins et de la palette, comme dans l'actuelle */
const IC_ACT = { demarrer: 'play', 'echo-demarrer': 'play', reprendre: 'play', 'rel-reprendre': 'play', 'file-lancer': 'play', pause: 'pause', tiroir: 'liste', 'file-reprise': 'liste', exporter: 'export', 'echo-terminer': 'export', reessayer: 'retour' };
const icAct = act => MIX && IC_ACT[act] ? IC[IC_ACT[act]] : '';

/* ─────────────────────────── simulation du lot (chiffres inventés) */
let graine = 7; const al = () => { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; };
function lotDeBase() {
  graine = 7; const cuts = []; let n = 4811;
  for (let i = 0; i < 31; i++) { n += 1 + (al() < .35 ? 1 : 0) + (al() < .12 ? 1 : 0); const dif = [7, 12, 19, 26].includes(i); cuts.push({ cut: n, statut: dif ? 'differe' : (al() < .15 ? 'voie' : 'pose'), dur: dif ? 14 + al() * 10 : 5.5 + al() * 6 + (al() < .2 ? 4 : 0), rail: dif ? (al() < .5 ? 'rail droit' : 'rail gauche') : '' }); }
  return { partie: 13, cibles: 120, cuts, encours: { cut: n + 1 + (al() < .4 ? 1 : 0), depuis: 0, attendu: 7.8 }, etat: 'cours', pauseDepuis: 0 };
}
const sim = { lot: lotDeBase(), echo: { visites: [], encours: null }, derniereH: performance.now(), tick: null };
function echoDeBase() { graine = 21; const v = []; let n = 5102; for (let i = 0; i < 148; i++) { n += 1 + (al() < .5 ? 1 : 0); v.push({ cut: n, corrige: al() < .41, dur: 6 + al() * 12 }); } sim.echo = { visites: v, encours: { cut: n + 1, depuis: 4, attendu: 11 } }; }
echoDeBase();
const medianeLot = () => { const d = sim.lot.cuts.slice(-20).map(c => c.dur); return d.length >= 3 ? quantile(d, .5) : null; };
const medianeEcho = () => { const d = sim.echo.visites.slice(-20).map(c => c.dur); return d.length >= 3 ? quantile(d, .5) : null; };
function avancer(dt) {
  const L = sim.lot, k = R.dataset.cadence === 'rapide' ? 4 : 1;
  if (S.scene === 'cours' && (L.etat === 'cours' || L.etat === 'dem')) {
    L.encours.depuis += dt * k;
    if (L.encours.depuis >= L.encours.attendu) {
      const dif = al() < .08, c = L.encours;
      L.cuts.push({ cut: c.cut, statut: dif ? 'differe' : (al() < .15 ? 'voie' : 'pose'), dur: c.attendu, rail: dif ? 'rail droit' : '' });
      const prochain = c.cut + 1 + (al() < .4 ? 1 : 0);
      if (L.etat === 'dem') { L.etat = 'pause'; L.pauseDepuis = 0; L.encours = { cut: prochain, depuis: 0, attendu: 0 }; S.scene = 'pause'; rendre(); return; }
      if (L.cuts.length >= L.cibles) { if (S.file.en) finirPartie(); else S.scene = 'fin'; rendre(); return; }
      L.encours = { cut: prochain, depuis: 0, attendu: 5.5 + al() * 6 + (al() < .2 ? 5 : 0) + (al() < .06 ? 12 : 0) };
      rendre(); return;
    }
    majVivant();
  } else if (S.scene === 'pause') { L.pauseDepuis += dt; majVivant(); }
  else if (S.scene === 'echo' && sim.echo.encours) {
    const e = sim.echo.encours; e.depuis += dt * k;
    if (e.depuis >= e.attendu) { sim.echo.visites.push({ cut: e.cut, corrige: al() < .4, dur: e.attendu }); sim.echo.encours = { cut: e.cut + 1 + (al() < .5 ? 1 : 0), depuis: 0, attendu: 6 + al() * 12 }; rendre(); return; }
    majVivant();
  }
}
function boucle() { const t = performance.now(), dt = (t - sim.derniereH) / 1000; sim.derniereH = t; avancer(Math.min(dt, 1)); }

/* ─────────────────────────── état de la maquette */
const FILE0 = () => ({ allumee: false, n: 2, relecture: true, correction: true, prete: false, en: false, partie: 1, bilans: [], cause: 'page', arret: null });
const CAUSES = {
  page: { nom: 'La page ne change pas de partie', court: 'la partie suivante n’a pas pu s’ouvrir', texte: 'Ariane a fini la partie et demandé la suivante, mais la page d’ESV est restée sur la même partie. Elle ne peut pas continuer sans changer de partie.', milieu: false, puce: 'ok' },
  onglet: { nom: 'Onglet fermé', court: 'l’onglet ESV a été fermé', texte: 'L’onglet connecté n’existe plus. Rouvre la partie dans ESV et reconnecte-la.', milieu: true, puce: 'aucun' },
  muet: { nom: 'ESV muet', court: 'ESV ne répond plus', texte: 'ESV ne répond plus. Attends qu’il réponde, ou recharge la page (F5).', milieu: true, puce: 'ko' },
  refus: { nom: 'Lot arrêté sur un refus', court: 'le lot s’est arrêté sur un refus', texte: 'ESV a refusé une écriture : le lot s’arrête sur ce refus. Ariane n’insiste pas et ne valide rien de plus.', milieu: true, puce: 'ok' },
};
const bilanInvente = p => ({ p, poses: 109 - p % 2, dif: 11 + p % 2, dur: 44 + 3 * p, relu: `relue et corrigée · ${4 + 2 * p} corrections` });
const S = { file: FILE0(), scene: 'cours', tiroir: false, couche: null, sel: null, examines: new Set(), q: '', pi: 0, cacheVide: false, note: '', exportFait: false };
const SCENES = [
  ['pret', 'Prêt'], ['cours', 'Lot en cours · allure vivante'], ['pause', 'En pause'], ['incident', 'Incident · rail non résolu (À toi)'], ['interrompu', 'Incident · ESV muet pendant une pose (Interrompu)'], ['esv-muet', 'ESV ne répond plus (entre deux cuts)'], ['fin', 'Fin de lot'],
  ['relecture', 'Relecture en pause'], ['relecture-f5', 'Relecture en pause après F5'], ['verrou', 'Deuxième passe (verrouillé)'], ['echo-vide', 'Écho · aucune séance'], ['echo', 'Écho · en observation'], ['sans-esv', 'Sans onglet ESV'],
  ['palette', 'Palette Ctrl K'], ['reglages', 'Feuille de réglages'], ['cache', 'Confirmation de vidage du cache'], ['esv', 'Sélecteur de connexion ESV'],
  ['file-eteinte', 'File · éteinte (défaut)'], ['file-reglage', 'File · réglage'], ['file-cours', 'File · en cours (partie 2 sur 3)'], ['file-alerte', 'File · alerte d’arrêt et bilan'], ['file-fin', 'File · fin de file'],
];
const NOTES = {
  pret: 'Au repos. Un seul bouton plein, qui dit l’effet. Les bornes du lot sont dans la phrase ; on les change dans les réglages, au repos. Glyphe : le rail en pointillé, rien de posé.',
  cours: 'Le rail avance au rythme réel de la simulation : le curseur (seule marque en lumière) glisse à chaque cut terminé ; le cut en cours se remplit du temps passé sur lui, jusqu’à la médiane. Allure : cuts par minute, médiane des 20 derniers cuts, temps restant (seulement si le total est connu). Pause → « Pause demandée » (une butée après le cut en cours) → En pause.',
  pause: 'Même instrument. Le curseur devient ‖, en encre : la pause n’est pas une alerte. L’allure dit depuis quand et garde la médiane d’avant la pause. « Reprendre » nomme le cut.',
  incident: 'Le bloc incident remplace le rail, pas l’état. Le rail coupé et le mot « À toi » sont les seuls éléments en brique. La phrase dit le problème, les trois boutons disent les sorties, sans redite ; « Passer » n’est jamais principal et garde sa confirmation.',
  interrompu: 'ESV s’est tu pendant une pose : l’opération interrompue reste écrite jusqu’à sa clôture. Aucun « Reprendre » : la seule sortie est d’archiver le résultat.',
  'esv-muet': 'ESV s’est tu entre deux cuts : rien n’était en l’air. « Reprendre » est permis dès qu’ESV répond ; F5 seulement si la page est figée. La puce le dit une fois, en brique.',
  fin: 'Trois lignes distinctes. Le glyphe est un heurtoir (fin de voie), en encre : terminé n’a pas besoin de couleur. « Voir ce qui reste » ouvre le tiroir ; l’export vient en second ; le cache devient disponible.',
  relecture: 'La relecture est un état d’Orbite : même rail, en relus / sélection, un point • à chaque cut corrigé. Pause, Reprendre, Arrêter.',
  'relecture-f5': 'Après un F5 d’ESV pendant la relecture : « Reprendre » reste là, grisé, avec sa raison écrite dessous.',
  verrou: 'Deuxième passe : Ariane travaille dans ESV (le curseur en lumière), aucune action, cache indisponible. Le nom et les états viendront de la session principale.',
  'echo-vide': 'Écho sans séance : pas de rail. Le cache dit pourquoi il est indisponible.',
  echo: 'Écho en observation : un compteur de visites et une ligne de marques (haute, en encre : corrigée ; basse : validée telle quelle ; en lumière : visite en cours). L’allure est celle de l’opérateur : médiane par cut.',
  'sans-esv': 'Aucun onglet ESV : la puce est un cercle vide, l’action principale devient « Choisir un onglet ».',
  palette: 'Ctrl K. Quatre commandes du moment, l’état à droite ; le reste en tapant. Une commande grisée dit sa raison et ne s’exécute pas. Ctrl K ou Échap ferme.',
  reglages: 'Les réglages, jamais ouverts en séance. Le compteur d’exemples (ancien « GCV2 ») vit ici avec sa définition et sa date. En bas : l’ancien panneau et la zone à part.',
  cache: 'La confirmation d’origine : ce qui sera supprimé, ce qui sera gardé, l’avertissement. Le bouton de suppression n’est jamais le bouton principal.',
  esv: 'Un clic sur la puce : la liste des onglets (rang, partie, fenêtre, premier plan). Choisir = connecter. Pendant un lot la puce n’a plus de chevron et la liste dit pourquoi.',
  'file-eteinte': 'L’écran Prêt de Signal ; une seule ligne s’y ajoute, « File de parties · éteinte », en bouton texte. Éteinte par défaut : « Démarrer jusqu’à la fin de la partie » reste l’action principale.',
  'file-reglage': 'Réglage dans une boîte : file allumée ou éteinte, nombre de parties. La relecture et la correction suivent chaque partie (D-261), ce n’est pas un réglage. « Préparer la file » ne lance rien ; « Lancer la file » apparaît ensuite.',
  'file-cours': 'Partie 2 sur 3. Le lot et son rail sont ceux de Signal. Le tiroir garde le bilan des parties faites. Aucun export automatique ; seul « Arrêter la file » l’arrête. Pause garde son sens habituel.',
  'file-alerte': 'Continuer est impossible : alerte et bilan, rien n’est exporté ni validé de plus. La cause se choisit à droite. Le principal est « Préparer la reprise », qui ne lance rien ; l’export reste manuel.',
  'file-fin': 'La file s’éteint d’elle-même à la dernière partie. Trois lignes : parties faites, ce qui reste (toutes parties), export prêt mais jamais automatique. Le tiroir montre le bilan par partie ; la liste des différés ne montre que la dernière partie dans la maquette.',
};

/* ─────────────────────────── modèle de chaque scène */
function modele() {
  const L = sim.lot, sc = S.scene, F = S.file;
  const traites = L.cuts.length, poses = L.cuts.filter(c => c.statut === 'pose' || c.statut === 'voie').length, differes = L.cuts.filter(c => c.statut === 'differe').length, sautes = L.cuts.filter(c => c.statut === 'saute').length;
  const restants = L.cibles - traites, med = medianeLot();
  const m = { activite: 'orbite', etat: 'pret', glyphe: 'repos', ton: 'neutre', mot: 'Prêt', phrase: '', objet: 'rail', railEtat: 'cours', allure: '', principal: null, secondaire: null, tertiaire: null, raison: '', incident: null, fin: null, verrou: false,
    compte: { traites, poses, differes, sautes, cibles: L.cibles, restants }, puce: { etat: 'ok', texte: 'Onglet 2 · partie 13', verrou: false }, bascule: { verrou: false, raison: '' },
    cache: { dispo: false, q: '1 lot, 190 Mo', raison: 'après le lot' }, reste: { d: differes, v: 0 }, tiroir: 'reste' };
  const base = sc === 'palette' ? 'cours' : sc === 'reglages' || sc === 'esv' ? 'pret' : sc === 'cache' ? 'fin' : sc;
  const verrouLot = () => { m.puce.verrou = true; m.bascule = { verrou: true, raison: 'Écho est disponible après le lot' }; };
  m.differes = L.cuts.filter(c => c.statut === 'differe').map((c, i) => ({ cut: c.cut, motif: c.rail ? 'Rail non résolu' : 'Différé', prec: c.rail || '', heure: `${14 + Math.floor(i / 3)} h ${String((7 * i + 12) % 60).padStart(2, '0')}` })).reverse();
  m.verts = ['fin', 'relecture', 'relecture-f5', 'file-fin'].includes(base) ? [[4861, 'Écartement 21 mm sous la médiane', 'PN'], [4874, 'Saut de hauteur, rail droit', '12 mm'], [4875, 'Saut de hauteur, rail droit', '11 mm'], [4890, 'Écartement 18 mm sous la médiane', ''], [4902, 'Écart aux poses voisines', '9 mm'], [4917, 'Écartement 19 mm sous la médiane', ''], [4931, 'Saut de hauteur, rail gauche', '10 mm'], [4944, 'Écart aux poses voisines', '8 mm'], [4958, 'Écartement 22 mm sous la médiane', 'PN']].map(v => ({ cut: v[0], motif: v[1], prec: v[2] })) : null;
  const allureTexte = () => {
    if (!med) return '';
    const parMin = 60 / med, reste = restants * med;
    return `<b>${fr((Math.round(parMin * 10) / 10).toFixed(1))}</b> cuts par minute <span class="sep">·</span> médiane <b>${fr(Math.round(med * 10) / 10)} s</b> par cut${L.cibles ? ` <span class="sep">·</span> environ <b>${duree(reste)}</b> restantes` : ''}`;
  };
  switch (base) {
    case 'pret': case 'file-eteinte': case 'file-reglage':
      m.phrase = `Partie 13 · du cut <span class="cut">4811</span> jusqu’à la fin de la partie`; m.railEtat = 'vide'; m.compte = { traites: 0, poses: 0, differes: 0, sautes: 0, cibles: 120, restants: 120 };
      m.principal = { texte: 'Démarrer jusqu’à la fin de la partie', act: 'demarrer' }; m.cache = { dispo: true, q: '1 lot, 190 Mo', raison: '' }; m.differes = []; m.reste = { d: 0, v: 0 }; break;
    case 'cours': {
      const dem = L.etat === 'dem';
      m.etat = dem ? 'dem' : 'cours'; m.glyphe = dem ? 'dem' : 'marche'; m.ton = 'marche'; m.mot = dem ? 'Pause demandée' : 'En cours';
      m.phrase = dem ? `Finit le cut <span class="cut">${L.encours.cut}</span>, puis s’arrête` : `Pose du cut <span class="cut">${L.encours.cut}</span>`;
      m.allure = allureTexte(); m.principal = dem ? { texte: 'Pause demandée…', occupe: true } : { texte: 'Pause', act: 'pause' }; m.secondaire = { texte: 'Arrêter', act: 'arreter' };
      verrouLot(); break; }
    case 'pause':
      m.etat = 'pause'; m.glyphe = 'pause'; m.mot = 'En pause'; m.railEtat = 'pause';
      m.phrase = `Après le cut <span class="cut">${L.cuts.at(-1)?.cut ?? '—'}</span> · il reste ${restants} cuts`;
      m.allure = med ? `en pause depuis <b>${duree(L.pauseDepuis)}</b> <span class="sep">·</span> médiane <b>${fr(Math.round(med * 10) / 10)} s</b> par cut avant la pause` : '';
      m.principal = { texte: `Reprendre au cut ${L.encours.cut}`, act: 'reprendre' }; m.secondaire = { texte: 'Arrêter', act: 'arreter' };
      verrouLot(); break;
    case 'incident':
      m.etat = 'toi'; m.glyphe = 'rupture'; m.ton = 'toi'; m.mot = 'À toi'; m.phrase = `Cut <span class="cut">${L.encours.cut}</span> · rail droit non résolu`;
      m.incident = { texte: 'Ariane ne sait pas poser le rail droit de ce cut.', op: '' };
      m.principal = { texte: 'Réessayer la pose', act: 'reessayer' }; m.secondaire = { texte: 'Reprendre à la main', act: 'main' }; m.tertiaire = { texte: 'Passer ce cut…', act: 'passer' };
      verrouLot(); break;
    case 'interrompu':
      m.etat = 'interrompu'; m.glyphe = 'rupture'; m.ton = 'toi'; m.mot = 'Interrompu'; m.phrase = `ESV n’a pas répondu pendant la pose du cut <span class="cut">${L.encours.cut}</span>`;
      m.incident = { texte: 'Ariane n’enverra plus aucune commande à ce cut. Contrôle-le dans ESV.', op: `Opération interrompue : <b>cut <span class="cut">${L.encours.cut}</span> · pose non confirmée</b>` };
      m.principal = { texte: 'Archiver le résultat interrompu', act: 'archiver' }; verrouLot(); m.puce = { etat: 'ko', texte: 'Onglet 2 · sans réponse', verrou: true }; break;
    case 'esv-muet':
      m.etat = 'muet'; m.glyphe = 'rupture'; m.ton = 'toi'; m.mot = 'ESV ne répond plus'; m.phrase = `Entre deux cuts · rien n’était en cours après le cut <span class="cut">${L.cuts.at(-1)?.cut}</span>`;
      m.incident = { texte: 'Si la page d’ESV reste figée, recharge-la (F5).', op: '' };
      m.principal = { texte: `Reprendre au cut ${L.encours.cut}`, act: 'reprendre', inactif: true }; m.raison = 'Possible dès qu’ESV répond.'; m.secondaire = { texte: 'Arrêter', act: 'arreter' };
      verrouLot(); m.puce = { etat: 'ko', texte: 'Onglet 2 · sans réponse', verrou: true }; break;
    case 'fin': case 'file-fin': {
      const d = 11, v = 9; m.etat = 'fini'; m.glyphe = 'heurtoir'; m.mot = 'Terminé'; m.railEtat = 'fini'; m.objet = 'fin';
      m.compte = { traites: 120, poses: 109, differes: d, sautes: 0, cibles: 120, restants: 0 };
      m.fin = [['Lot', `<b>120</b> cuts traités sur <b>120</b> ciblés`], ['Il reste', `${mq('dif')}<b>${d}</b> différés, ${mq('ctl')}<b>${v}</b> verts à contrôler`], ['Export', S.exportFait ? `fait, <b>3</b> volumes confirmés` : 'prêt']];
      m.phrase = 'Partie 13 · fin de la partie atteinte';
      m.principal = S.exportFait ? { texte: 'Exporter à nouveau', act: 'exporter' } : { texte: 'Voir ce qui reste', act: 'tiroir' }; m.secondaire = S.exportFait ? null : { texte: 'Exporter', act: 'exporter' };
      m.cache = { dispo: true, q: '1 lot, 190 Mo', raison: '' }; m.reste = { d, v };
      m.differes = m.differes.concat([{ cut: 4866, motif: 'Rail non résolu', prec: 'rail droit', heure: '15 h 02' }, { cut: 4871, motif: 'Différé', prec: '', heure: '15 h 09' }, { cut: 4889, motif: 'Rail non résolu', prec: 'les deux rails', heure: '15 h 31' }, { cut: 4903, motif: 'Différé', prec: '', heure: '15 h 48' }, { cut: 4918, motif: 'Rail non résolu', prec: 'rail gauche', heure: '16 h 05' }, { cut: 4937, motif: 'Différé', prec: '', heure: '16 h 22' }, { cut: 4951, motif: 'Rail non résolu', prec: 'rail droit', heure: '16 h 40' }]).slice(0, 11); break; }
    case 'relecture': case 'relecture-f5': {
      const f5 = base === 'relecture-f5'; m.etat = 'relecture'; m.glyphe = 'pause'; m.mot = 'Relecture en pause'; m.railEtat = 'relecture'; m.objet = 'relecture';
      m.compte = { relus: 58, selection: 96, corriges: 6 }; m.phrase = f5 ? `Relue jusqu’au cut <span class="cut">4879</span> · ESV a été rechargé` : `Relue jusqu’au cut <span class="cut">4879</span>`;
      m.allure = f5 ? `en pause depuis <b>2 min 10</b> <span class="sep">·</span> médiane <b>6,4 s</b> par cut relu avant la pause` : `en pause depuis <b>40 s</b> <span class="sep">·</span> médiane <b>6,4 s</b> par cut relu <span class="sep">·</span> environ <b>4 min</b> restantes`;
      m.principal = { texte: 'Reprendre la relecture', act: 'rel-reprendre', inactif: f5 }; if (f5) m.raison = 'Possible dès qu’ESV répond.'; m.secondaire = { texte: 'Arrêter la relecture', act: 'rel-arreter' };
      m.cache = { dispo: false, q: '1 lot, 190 Mo', raison: 'après la relecture' }; m.bascule = { verrou: true, raison: 'Écho est disponible après la relecture' }; m.reste = { d: 11, v: 9 }; break; }
    case 'verrou':
      m.etat = 'verrou'; m.glyphe = 'verrou'; m.ton = 'marche'; m.mot = 'Deuxième passe'; m.phrase = 'Ariane travaille dans ESV · ne touche à rien'; m.objet = 'aucun'; m.verrou = true;
      m.cache = { dispo: false, q: '1 lot, 190 Mo', raison: 'après la deuxième passe' }; m.bascule = { verrou: true, raison: 'Écho est disponible après la deuxième passe' }; m.puce.verrou = true; m.reste = { d: 11, v: 9 }; break;
    case 'echo-vide':
      m.activite = 'echo'; m.etat = 'echoVide'; m.mot = 'Aucune séance'; m.phrase = 'Partie 13 · prête à observer'; m.objet = 'aucun';
      m.principal = { texte: 'Démarrer l’observation', act: 'echo-demarrer' }; m.cache = { dispo: false, q: '1 lot, 190 Mo', raison: 'après la séance Écho' }; m.tiroir = 'visites'; break;
    case 'echo': {
      const E = sim.echo, medE = medianeEcho(), corr = E.visites.filter(v => v.corrige).length; m.activite = 'echo'; m.etat = 'echo'; m.glyphe = 'marche'; m.ton = 'marche'; m.mot = 'En observation'; m.objet = 'echo';
      m.phrase = `Visite du cut <span class="cut">${E.encours.cut}</span>`; m.compte = { vus: E.visites.length, corriges: corr };
      m.allure = medE ? `<b>${fr((Math.round(60 / medE * 10) / 10).toFixed(1))}</b> cuts par minute <span class="sep">·</span> médiane <b>${fr(Math.round(medE * 10) / 10)} s</b> par cut` : '';
      m.principal = { texte: 'Terminer et télécharger', act: 'echo-terminer' }; m.secondaire = { texte: 'Pause', act: 'echo-pause' };
      m.cache = { dispo: false, q: '1 lot, 190 Mo', raison: 'après la séance Écho' }; m.bascule = { verrou: true, raison: 'Orbite est disponible après la séance Écho' }; m.puce.verrou = true; m.tiroir = 'visites'; break; }
    case 'sans-esv':
      m.etat = 'hors'; m.glyphe = 'hors'; m.mot = 'Hors ligne'; m.phrase = 'Aucun onglet ESV ouvert'; m.objet = 'aucun'; m.puce = { etat: 'aucun', texte: 'Aucun onglet', verrou: false };
      m.principal = { texte: 'Choisir un onglet', act: 'esv' }; m.cache = { dispo: true, q: '1 lot, 190 Mo', raison: '' }; m.differes = []; m.reste = { d: 0, v: 0 }; break;
    case 'file-alerte': {
      const cz = CAUSES[F.cause], fait = F.bilans.length, cut = L.encours.cut;
      m.etat = 'toi'; m.glyphe = 'rupture'; m.ton = 'toi'; m.mot = 'File arrêtée'; m.objet = 'rail';
      m.phrase = cz.milieu ? `Partie ${fait + 1} sur ${F.n} · arrêtée au cut <span class="cut">${cut}</span>` : `Fin de la partie ${fait} sur ${F.n} · ${cz.court}`;
      m.compte = { traites: 0, poses: 0, differes: 0, sautes: 0, cibles: 0, restants: 0 };
      m.incident = { texte: cz.texte, op: `Bilan : <b>${fait}</b> ${fait > 1 ? 'parties faites' : 'partie faite'} sur ${F.n} · rien exporté, rien validé de plus` };
      m.principal = { texte: `Préparer la reprise · ${pl(F.n - fait, 'partie restante', 'parties restantes')}`, act: 'file-reprise' }; m.secondaire = { texte: 'Exporter les parties faites', act: 'exporter' };
      m.raison = 'Préparer ne lance rien.';
      if (cz.puce === 'ko') m.puce = { etat: 'ko', texte: 'Onglet 2 · sans réponse', verrou: false }; else if (cz.puce === 'aucun') m.puce = { etat: 'aucun', texte: 'Aucun onglet', verrou: false };
      m.cache = { dispo: true, q: '2 lots, 380 Mo', raison: '' }; m.reste = { d: 0, v: 0, bilan: true }; break; }
  }
  adapterFile(m, base);
  if (S.cacheVide) m.cache = { dispo: false, q: 'vidé', raison: '', vide: true };
  return m;
}

/* ─────────────────────────── file de parties (CH-013, variante A validée par D-261) */
const nParties = n => pl(n, 'partie', 'parties');
function fileReglagesHtml() {
  const F = S.file;
  const seg = (cle, nom, opts, cur, off) => `<span class="seg" role="group" aria-label="${esc(nom)}">${opts.map(([v, t]) => `<button type="button" aria-pressed="${String(v) === String(cur)}" data-file="${cle}" data-val="${v}"${off ? ' aria-disabled="true"' : ''}>${t}</button>`).join('')}</span>`;
  const l = (t, aide, ctl, sourd) => `<div class="reg${sourd ? ' sourd' : ''}"><span class="lib"><span>${esc(t)}</span>${aide ? `<small>${esc(aide)}</small>` : ''}</span>${ctl}</div>`;
  return l('File de parties', 'Éteinte par défaut · enchaîne les parties programmées', seg('allumee', 'File de parties', [[0, 'Éteinte'], [1, 'Allumée']], F.allumee ? 1 : 0))
    + l('Nombre de parties', F.allumee ? 'Premier essai : 2, l’opérateur présent' : 'Allume la file pour choisir', seg('n', 'Nombre de parties', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [8, '8']], F.n, !F.allumee), !F.allumee);
}
function adapterFile(m, base) {
  const F = S.file, etatTxt = F.prete ? 'préparée' : F.allumee ? 'allumée' : 'éteinte';
  if (base === 'file-eteinte' || base === 'file-reglage') {
    if (F.prete) { m.principal = { texte: `Lancer la file · ${nParties(F.n)}`, act: 'file-lancer' }; m.raison = 'File préparée · relecture et correction après chaque partie. Rien n’est lancé.'; }
    m.secondaire = { texte: `File de parties · ${etatTxt}`, act: 'file-ouvrir' };
  }
  if (F.en && (base === 'cours' || base === 'pause')) {
    m.phrase = `Partie ${F.partie} sur ${F.n} · ${m.phrase.replace(/^./, c => c.toLowerCase())}`;
    m.secondaire = { texte: 'Arrêter la file', act: 'file-arreter' };
    m.bascule = { verrou: true, raison: 'Écho est disponible après la file' };
    m.fileBandeau = `<p class="allure">Après chaque partie : relecture et correction <span class="sep">·</span> aucun export automatique <span class="sep">·</span> seul « Arrêter la file » l’arrête</p>`;
  }
  if (F.en || base === 'file-alerte' || base === 'file-fin') {
    const l = F.bilans.map(b => ({ p: `P${b.p}`, txt: `${b.poses} posés · ${b.dif} différés`, sous: b.relu, dur: `${b.dur} min` }));
    if (F.en) l.push({ p: `P${F.partie}`, txt: 'en cours', sous: '', dur: '' });
    m.parties = l;
  }
  if (base === 'file-fin') {
    const bil = F.bilans.length, d = F.bilans.reduce((a, b) => a + b.dif, 0), v = 9 * bil, op = F.arret === 'operateur';
    m.mot = op ? 'File arrêtée' : 'File terminée'; m.glyphe = op ? 'arrete' : 'heurtoir'; m.ton = 'neutre';
    m.phrase = op ? `Arrêtée par l’opérateur · ${bil > 1 ? `${bil} parties faites` : `${bil} partie faite`} sur ${F.n}` : `${nParties(bil)} faites · la file s’est éteinte`;
    m.fin = [['Parties', `<b>${bil}</b> faites sur <b>${F.n}</b>, relues et corrigées`], ['Il reste', `${mq('dif')}<b>${d}</b> différés, ${mq('ctl')}<b>${v}</b> verts à contrôler · toutes parties`], ['Export', S.exportFait ? 'fait, <b>3</b> volumes confirmés' : 'prêt · jamais automatique']];
    m.reste = { d, v };
  }
}
function finirPartie() {
  const F = S.file; F.bilans.push(bilanInvente(F.partie));
  if (F.partie < F.n) { F.partie++; sim.lot = lotDeBase(); sim.lot.cuts = []; sim.lot.encours = { cut: 4811, depuis: 0, attendu: 7 }; S.scene = 'cours'; S.tiroir = false; }
  else { F.en = false; F.allumee = false; F.arret = null; S.scene = 'file-fin'; }
}
function appliquerCause() { sim.lot = lotDeBase(); if (!CAUSES[S.file.cause].milieu) sim.lot.cuts = []; }
function boiteFile() {
  const F = S.file;
  return `<div class="voile" data-act="fermer"></div><div class="boite" role="dialog" aria-labelledby="cf-t"><span class="t" id="cf-t">File de parties</span><div>${fileReglagesHtml()}</div><p class="meta">La relecture et la correction suivent chaque partie, toujours. Pas d’export automatique. Seul « Arrêter la file » l’arrête, sauf si continuer est impossible : alerte et bilan.</p><div class="bts"><button type="button" class="texte" data-act="fermer">Fermer</button>${F.prete ? `<button type="button" class="principal" data-act="file-lancer">Lancer la file · ${nParties(F.n)}</button>` : `<button type="button" class="principal" data-act="file-preparer"${F.allumee ? '' : ' disabled'}>Préparer la file</button>`}</div>${F.prete ? '' : '<p class="meta raison-boite">Préparer ne lance rien.</p>'}</div>`;
}

/* ─────────────────────────── rendu */
const glypheHtml = m => MIX ? `<span class="glyphe" data-glyphe="${glyphe4(m)}" data-ton="${m.ton}" aria-hidden="true">${GLYPHE4[glyphe4(m)]}</span>` : `<span class="glyphe" data-glyphe="${m.glyphe}" data-ton="${m.ton}" aria-hidden="true">${GLYPHE[m.glyphe]}</span>`;
function railHtml(m) {
  const L = sim.lot, c = m.compte, total = c.cibles, inconnu = !total;
  const pos = i => `${(i / total * 100).toFixed(3)}%`;
  let h = `<div class="rail" data-etat="${m.railEtat}" data-total="${inconnu ? 'inconnu' : 'connu'}" role="img" aria-label="${esc(`${c.traites} traités sur ${total} ciblés, ${c.differes} différés`)}"><div class="rail-base" data-forme="reste du rail"></div>`;
  if (!inconnu) { for (let k = 0; k <= total; k += 10) h += `<div class="rail-grad${k % 60 === 0 ? ' fort' : ''}" style="left:${pos(k)}"></div>`; h += `<div class="rail-num debut">0</div><div class="rail-num" style="left:50%">${total / 2}</div><div class="rail-num fin" style="left:100%">${total}</div>`; }
  h += `<div class="rail-fait" style="width:${pos(c.traites)}"></div>`;
  if (MIX) L.cuts.slice(0, c.traites).forEach((x, i) => { if (x.statut === 'differe') h += `<div class="rail-dif" data-forme="différé" style="left:${pos(i + .5)}" title="cut ${x.cut}, différé"></div>`; if (x.statut === 'saute') h += `<div class="rail-inc" data-forme="passé" style="left:${pos(i + .5)}" title="cut ${x.cut}, passé"></div>`; });
  else L.cuts.slice(0, c.traites).forEach((x, i) => { if (x.statut === 'differe') h += `<span class="rail-mq" style="left:${pos(i + .5)}" title="cut ${x.cut}, différé">${mq('dif')}</span>`; if (x.statut === 'saute') h += `<span class="rail-mq" style="left:${pos(i + .5)}" title="cut ${x.cut}, passé">${mq('skip')}</span>`; });
  if (m.railEtat !== 'fini' && m.railEtat !== 'vide') h += `<div class="rail-cur" data-forme="curseur" style="left:${pos(c.traites)}"></div>${m.railEtat === 'cours' ? `<div class="rail-ici" style="left:${pos(c.traites)}"><span class="cut">${L.encours.cut}</span><i></i></div>` : ''}`;
  return h + '</div>';
}
function railRelecture(m) {
  const c = m.compte, pos = i => `${(i / c.selection * 100).toFixed(3)}%`;
  let h = `<div class="rail" data-etat="relecture" data-total="connu" role="img" aria-label="${esc(`${c.relus} relus sur ${c.selection}, ${c.corriges} corrigés`)}"><div class="rail-base" data-forme="reste du rail"></div>`;
  for (let k = 0; k <= c.selection; k += 10) h += `<div class="rail-grad" style="left:${pos(Math.min(k, c.selection))}"></div>`;
  h += `<div class="rail-num debut">0</div><div class="rail-num fin" style="left:100%">${c.selection}</div><div class="rail-fait" style="width:${pos(c.relus)}"></div>`;
  [4, 11, 19, 27, 41, 52].forEach(i => { h += MIX ? `<div class="rail-corr" data-forme="corrigé" style="left:${pos(i + .5)}"></div>` : `<span class="rail-mq" style="left:${pos(i + .5)}">${mq('corr')}</span>`; });
  return h + `<div class="rail-cur" data-forme="curseur" style="left:${pos(c.relus)}"></div></div>`;
}
function objetHtml(m) {
  const c = m.compte;
  if (m.incident) return `<div class="incident" role="alert"><p>${m.incident.texte}</p>${m.incident.op ? `<p class="op">${m.incident.op}</p>` : ''}</div>`;
  if (m.objet === 'fin') return `<dl class="fin">${m.fin.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  if (m.objet === 'relecture') return `<div class="objet"><div class="compte"><span class="chiffre">${c.relus}</span><span class="suite">relus sur ${c.selection} sélectionnés</span><span class="droite">${mq('corr')}<b>${c.corriges}</b> corrigés</span></div>${railRelecture(m)}</div>`;
  if (m.objet === 'echo') { const E = sim.echo; return `<div class="objet"><div class="compte"><span class="chiffre">${c.vus}</span><span class="suite">cuts vus</span><span class="droite"><b>${c.corriges}</b> corrigés · <b>${c.vus - c.corriges}</b> validés tels quels</span></div><div class="marques" role="img" aria-label="${esc(`${c.vus} visites, ${c.corriges} corrigées`)}">${E.visites.slice(-60).map(v => `<i class="${v.corrige ? 'c' : ''}"${v.corrige ? ' data-forme="corrigée"' : ''}></i>`).join('')}<i class="en" data-forme="visite en cours"></i></div></div>`; }
  if (m.objet === 'aucun') return '';
  if (m.railEtat === 'vide') return `<div class="objet"><div class="compte"><span class="chiffre">${c.cibles}</span><span class="suite">cuts ciblés · aucun traité</span></div>${railHtml(m)}</div>`;
  const droite = `<span class="droite"><b>${c.poses}</b> posés · ${mq('dif')}<b>${c.differes}</b> différés${c.sautes ? ` · ${mq('skip')}<b>${c.sautes}</b> passés` : ''}</span>`;
  return `<div class="objet"><div class="compte"><span class="chiffre">${c.traites}</span><span class="suite">${c.cibles ? `traités sur ${c.cibles} ciblés` : 'traités'}</span>${droite}</div>${railHtml(m)}</div>`;
}
function actionsHtml(m) {
  if (m.verrou) return `<p class="verrou-ligne">${MIX ? IC.cadenas : ''}<span>Aucune action jusqu’à la fin de la deuxième passe.</span></p>`;
  let h = '<div class="actions">';
  if (m.principal) h += `<button type="button" class="principal" data-act="${m.principal.act || ''}"${m.principal.occupe || m.principal.inactif ? ' disabled' : ''}>${m.principal.occupe ? '<span class="tourne" aria-hidden="true"></span>' : icAct(m.principal.act)}<span>${esc(m.principal.texte)}</span></button>`;
  if (m.raison) h += `<p class="raison">${esc(m.raison)}</p>`;
  for (const b of [m.secondaire, m.tertiaire]) if (b) h += `<button type="button" class="texte" data-act="${b.act}">${esc(b.texte)}</button>`;
  return h + '</div>';
}
function tiroirHtml(m) {
  const v2 = R.dataset.revue === 'v2', ex = S.examines;
  const outils = cut => `<span class="outils"><button type="button" data-ouvrir="${cut}" title="Ouvrir ce cut dans ESV" aria-label="Ouvrir le cut ${cut} dans ESV">${IC.ouvrir}<span>Ouvrir</span></button><button type="button" data-examine="${cut}" aria-pressed="${ex.has(cut)}" title="Marquer examiné" aria-label="${ex.has(cut) ? 'Examiné' : 'Examiner'} le cut ${cut}">${IC.coche}<span>${ex.has(cut) ? 'Examiné' : 'Examiner'}</span></button></span>`;
  const ligne = (r, i, k, prec) => `<div class="ligne${ex.has(r.cut) && v2 ? ' examine' : ''}" role="option" data-row="${i}" aria-selected="${S.sel === i}" tabindex="-1"><span class="cut">${r.cut}</span><span class="motif">${mq(k)}${esc(r.motif)}${r.prec ? ` <small>· ${esc(r.prec)}</small>` : ''}</span>${v2 ? outils(r.cut) : `<span class="prec">${esc(prec(r))}</span>`}</div>`;
  const section = (t, n, d) => `<div class="section"><span class="t">${t}</span>${n != null ? `<span class="n">${n}</span>` : ''}${d ? `<span class="d">${d}</span>` : ''}</div>`;
  let h = '';
  if (m.tiroir === 'visites') {
    const V = [...sim.echo.visites].reverse().slice(0, 40);
    h += section('Visites', sim.echo.visites.length, 'les 40 dernières');
    h += V.length ? V.map((v, i) => `<div class="ligne" role="option" data-row="${i}" aria-selected="${S.sel === i}" tabindex="-1"><span class="cut">${v.cut}</span><span class="motif">${v.corrige ? `${mq('corr')}Corrigé · 1 rail` : 'Validé tel quel'}</span><span class="prec">${fr(Math.round(v.dur))} s</span></div>`).join('') : '<p class="vide">Aucune visite pour l’instant.</p>';
    return `<div class="corps" role="listbox" aria-label="Visites">${h}</div>`;
  }
  const dif = m.differes || [], verts = m.verts;
  const resteD = dif.filter(d => !ex.has(d.cut)).length, resteV = verts ? verts.filter(d => !ex.has(d.cut)).length : 0;
  if (m.parties) h += section('Parties', m.parties.length, 'bilan · chiffres inventés') + m.parties.map(p => `<div class="ligne"><span class="cut">${p.p}</span><span class="motif">${esc(p.txt)}${p.sous ? ` <small>· ${esc(p.sous)}</small>` : ''}</span><span class="prec">${esc(p.dur)}</span></div>`).join('');
  if (v2) h += `<p class="v2-note">Revue V2, à construire : ouvrir un cut dans ESV et le marquer examiné n’existent pas encore dans l’extension.</p>`;
  h += section('Différés', dif.length, v2 && dif.length ? `reste à examiner ${resteD}` : 'à reprendre après le lot');
  h += dif.length ? dif.map((d, i) => ligne(d, i, 'dif', r => r.heure)).join('') : `<p class="vide">Aucun différé pour l’instant.</p>`;
  h += section('Verts à contrôler', verts ? verts.length : null, verts ? (v2 ? `reste à examiner ${resteV}` : 'hors des cuts du lot') : '');
  h += verts ? verts.map((d, i) => ligne(d, dif.length + i, 'ctl', r => r.prec)).join('') : `<p class="vide">Calculés à la fin du lot.</p>`;
  return `<div class="corps" role="listbox" aria-label="Ce qui reste">${h}</div>`;
}
function poigneeHtml(m) {
  const v2 = R.dataset.revue === 'v2', r = m.reste || { d: 0, v: 0 };
  let titre = 'Ce qui reste', detail, court;
  if (m.tiroir === 'visites') { titre = 'Visites'; const n = sim.echo.visites.length; detail = m.objet === 'echo' ? `${n}` : 'aucune pour l’instant'; court = m.objet === 'echo' ? `${n}` : 'aucune'; }
  else if (r.bilan) { detail = 'bilan des parties'; court = 'bilan'; }
  else if (!r.d && !r.v) { detail = 'rien pour l’instant'; court = 'rien'; }
  else { detail = [r.d ? `${mq('dif')}${pl(r.d, 'différé', 'différés')}` : '', r.v ? `${mq('ctl')}${r.v} verts à contrôler` : ''].filter(Boolean).join(', '); court = `${r.d + r.v}`; }
  const total = (m.differes?.length || 0) + (m.verts?.length || 0), reste = total - [...S.examines].filter(c => (m.differes || []).some(d => d.cut === c) || (m.verts || []).some(d => d.cut === c)).length;
  const mini = m.compte?.traites != null && m.compte.cibles ? ` · ${m.compte.traites} sur ${m.compte.cibles}` : '';
  const examen = v2 && total && m.tiroir !== 'visites';
  return `<button type="button" class="poignee${examen ? ' examen' : ''}" data-act="tiroir" aria-expanded="${S.tiroir}" aria-controls="tiroir-corps">${IC.chevron}<span class="txt"><span class="t">${titre}</span> <span class="long">· ${detail}</span><span class="court">· ${court}</span></span>${examen ? `<span class="reste">${reste} sur ${total} à examiner</span>` : ''}<span class="etat-mini">${glypheHtml(m)}<span>${esc(m.mot)}${mini}</span></span></button>`;
}
function cacheHtml(m) {
  const c = m.cache;
  if (c.vide) return `<footer class="cache"><span class="q">Cache vidé · rien à garder</span><span class="espace"></span><button type="button" class="texte" disabled>Vider le cache</button></footer>`;
  return `<footer class="cache"><span class="q"><span class="lib">Cache des exports · </span>${esc(c.q)}</span>${c.raison ? `<span class="r">· vidable ${esc(c.raison)}</span>` : ''}<span class="espace"></span><button type="button" class="texte" data-act="cache"${c.dispo ? '' : ' disabled'}>Vider le cache</button></footer>`;
}
function barreHtml(m) {
  const b = m.bascule, puce = m.puce;
  const seg = (k, t) => `<button type="button" role="tab" aria-selected="${m.activite === k}"${b.verrou && m.activite !== k ? ` aria-disabled="true" data-raison="${esc(b.raison)}" title="${esc(b.raison)}"` : ''} data-act="activite:${k}">${MIX && b.verrou && m.activite !== k ? IC.cadenas : ''}${t}</button>`;
  const choisir = !puce.verrou;
  return `<header class="barre"><span class="logo">${IC.logo}<span>Ariane</span></span><div class="bascule" role="tablist" aria-label="Activité">${seg('orbite', 'Orbite')}${seg('echo', 'Écho')}</div><span class="espace"></span>
  <button type="button" class="puce" data-etat="${puce.etat}" data-act="esv" aria-haspopup="listbox" aria-expanded="${S.couche === 'esv'}" title="${choisir ? 'Choisir l’onglet ESV' : 'Onglet gardé jusqu’à la fin du lot'}"><i class="pt" data-forme="connexion ESV"></i><span class="tx"><span class="long">${esc(puce.texte)}</span><span class="court">${esc(puce.texte.split(' · ')[0])}</span></span>${choisir ? IC.bas : MIX && puce.etat === 'ok' ? IC.cadenas.replace('<svg', '<svg class="fl"') : ''}</button>
  ${MIX ? `<button type="button" class="ico" data-act="palette" aria-label="Commandes (Ctrl K)" title="Commandes · Ctrl K" aria-pressed="${S.couche === 'palette'}">${IC.palette}</button>` : `<button type="button" class="touche" data-act="palette" aria-label="Commandes (Ctrl K)" title="Commandes" aria-pressed="${S.couche === 'palette'}">Ctrl K</button>`}<button type="button" class="ico" data-act="reglages" aria-label="Réglages" title="Réglages" aria-pressed="${S.couche === 'reglages'}">${IC.reglages}</button></header>${S.note ? `<div class="barre-note" role="status">${esc(S.note)}</div>` : ''}`;
}
/* Couches */
function commandes(m) {
  const c = [], etat = `${m.activite === 'echo' ? 'Écho' : 'Orbite'} · ${m.mot}${m.compte?.traites != null && m.compte.cibles && m.activite === 'orbite' && m.objet === 'rail' ? ` · ${m.compte.traites} sur ${m.compte.cibles}` : ''}`;
  if (m.principal && !m.principal.occupe) c.push({ nom: m.principal.texte, act: m.principal.act, et: etat, off: m.principal.inactif ? m.raison : '' });
  if (m.secondaire) c.push({ nom: m.secondaire.texte, act: m.secondaire.act, et: '' });
  c.push({ nom: S.tiroir ? 'Fermer le tiroir' : (m.tiroir === 'visites' ? 'Voir les visites' : 'Voir ce qui reste'), act: 'tiroir', et: m.reste && (m.reste.d + m.reste.v) ? `${m.reste.d + m.reste.v}` : '' });
  c.push({ nom: 'Exporter le dossier', act: 'exporter', et: '', off: m.activite === 'orbite' && ['cours', 'dem', 'pause', 'toi', 'interrompu', 'muet'].includes(m.etat) ? 'après le lot' : '' });
  c.push({ nom: m.activite === 'echo' ? 'Passer en Orbite' : 'Passer en Écho', act: `activite:${m.activite === 'echo' ? 'orbite' : 'echo'}`, et: '', off: m.bascule.verrou ? m.bascule.raison : '' });
  c.push({ nom: 'File de parties', act: 'file-ouvrir', et: S.file.prete ? 'préparée' : S.file.allumee ? 'allumée' : 'éteinte', off: m.etat === 'pret' ? '' : 'pendant un lot ou une file' });
  c.push({ nom: 'Réglages', act: 'reglages', et: '' });
  c.push({ nom: 'Ancien panneau (détails techniques)', act: 'ancien', et: '' });
  c.push({ nom: 'Vider le cache des exports', act: 'cache', et: m.cache.q, off: m.cache.dispo ? '' : m.cache.raison });
  return c;
}
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function paletteHtml(m) {
  const all = commandes(m), q = norm(S.q).trim(), L = q ? all.filter(c => norm(c.nom).includes(q)) : all.slice(0, 4);
  const i = Math.max(0, Math.min(L.length - 1, S.pi));
  return `<div class="voile" data-act="fermer"></div><div class="palette" role="dialog" aria-label="Commandes"><input id="pal-q" type="text" value="${esc(S.q)}" placeholder="Commande…" autocomplete="off" spellcheck="false" aria-label="Rechercher une commande"><div class="cmds" role="listbox">${L.length ? L.map((c, k) => `<button type="button" class="cmd" role="option" aria-selected="${k === i}"${c.off ? ' aria-disabled="true"' : ''} data-cmd="${k}" data-act="${c.off ? '' : c.act}" data-fermer="1">${MIX ? IC[c.ic || IC_ACT[c.act] || (/arreter/.test(c.act) ? 'stop' : /^activite:echo/.test(c.act) ? 'echo' : /^activite/.test(c.act) ? 'play' : c.act === 'reglages' ? 'reglages' : c.act === 'cache' ? 'export' : c.act === 'echo-pause' ? 'pause' : 'liste')] : ''}<span>${esc(c.nom)}</span><span class="et">${esc(c.off || c.et)}</span></button>`).join('') : '<p class="cmd vide-cmd">Aucune commande</p>'}</div><div class="pied"><span><kbd>↑</kbd> <kbd>↓</kbd> choisir</span><span><kbd>Entrée</kbd> exécuter</span><span class="espace"></span><span><kbd>Échap</kbd> fermer</span></div></div>`;
}
function feuilleHtml() {
  const sel = (nom, opts, cur) => `<select data-reg="${nom}" aria-label="${esc(nom)}">${opts.map(o => `<option${o === cur ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const seg = (nom, opts, cur) => `<span class="seg" role="group" aria-label="${esc(nom)}">${opts.map(o => `<button type="button" aria-pressed="${o === cur}" data-seg="${esc(nom)}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</span>`;
  const ligne = (t, aide, ctl, modif) => { const s = [aide, modif ? 'gardé pour le prochain lot' : ''].filter(Boolean).join(' · '); return `<div class="reg"><span class="lib"><span>${esc(t)}</span>${s ? `<small>${esc(s)}</small>` : ''}</span>${ctl}</div>`; };
  const th = R.dataset.theme === 'clair' ? 'Clair' : 'Sombre';
  return `<div class="feuille" role="dialog" aria-label="Réglages"><div class="tete"><span class="t">Réglages</span><span class="meta">jamais en séance</span><span class="espace"></span><kbd>Échap</kbd><button type="button" class="ico" data-act="fermer" aria-label="Fermer">${IC.fermer}</button></div><div class="liste">
  ${ligne('Après le lot', 'Relecture des verts sûrs', sel('Après le lot', ['Rien', 'Relire sans rien modifier', 'Relire et corriger'], 'Relire et corriger'), true)}
  ${ligne('Clic du mode rapide', '', sel('Clic du mode rapide', ['Comme avant', 'Rail gauche recentré', 'Tout recentré'], 'Comme avant'), true)}
  ${ligne('Série de différés', 'Mettre en attente les cuts voisins', seg('Série de différés', ['Non', 'Oui'], 'Non'))}
  ${ligne('Raison de la correction (Écho)', 'Lue au démarrage d’Écho', sel('Raison', ['Non', 'Oui · chiffres du haut', 'Oui · Alt + chiffre', 'Oui · pavé numérique'], 'Non'))}
  ${ligne('Si ESV est rechargé pendant la relecture', '', sel('Si ESV est rechargé', ['Attendre, puis reprendre', 'Arrêter la relecture'], 'Attendre, puis reprendre'))}
  ${ligne('Thème', '', seg('Thème', ['Sombre', 'Clair', 'Système'], th))}
  ${ligne('Interface', 'Au démarrage', seg('Interface', ['Instrument', 'Palette'], 'Instrument'))}
  <div class="reg"><span class="lib"><span>Exemples d’apprentissage</span><small>cuts corrigés dans les Échos archivées, tous projets · au 20/10/2026 · ne mesure aucune qualité</small></span><span class="nombre">2 731</span></div>
  <div class="bas"><button type="button" class="texte lien" data-act="ancien">Ancien panneau (détails techniques)</button><div class="zone-a-part"><span>Séance Écho en cours : supprime ses données, avec confirmation.</span><button type="button" class="contour" data-act="fermer">Abandonner la séance Écho…</button></div></div></div></div>`;
}
const confirmCache = () => `<div class="voile" data-act="fermer"></div><div class="boite" role="dialog" aria-labelledby="cc-t"><span class="t" id="cc-t">Vider le cache des exports ?</span><dl><dt>Supprimé</dt><dd><b>1 lot</b>, <b>120 coupes</b> · 120 visites, 2 140 événements, 118 nuages · environ <b>190 Mo</b> (estimation)</dd><dt>Gardé</dt><dd>l’état du lot, les réglages, la reprise</dd></dl><p class="avert"><b>Irréversible.</b> Si tu veux garder ces données, annule et lance d’abord l’export.</p><div class="bts"><button type="button" class="principal" data-act="fermer">Annuler</button><button type="button" class="contour" data-act="cache-vider">Vider le cache</button></div></div>`;
const confirmPasser = () => `<div class="voile" data-act="fermer"></div><div class="boite" role="dialog" aria-labelledby="cp-t"><span class="t" id="cp-t">Passer le cut <span class="cut">${sim.lot.encours.cut}</span> ?</span><p class="encre2">Il sera compté SKIP et restera dans « ce qui reste ». Le lot reprend au cut suivant.</p><div class="bts"><button type="button" class="principal" data-act="fermer">Annuler</button><button type="button" class="contour" data-act="passer-ok">Passer ce cut</button></div></div>`;
function popoverEsv(m) {
  const verrou = m.puce.verrou, aucun = m.puce.etat === 'aucun';
  const ong = aucun ? '<p class="vide">Aucun onglet ESV ouvert. Ouvre une partie dans ESV ; elle apparaîtra ici.</p>'
    : [['Onglet 1', 'partie 13 · fenêtre 1', false], ['Onglet 2', 'partie 13 · fenêtre 1, au premier plan', true], ['Onglet 3', 'partie 7 · fenêtre 2', false]].map(([n, d, mien]) => `<div class="ong"><span class="lib"><b>${n}</b><small>${d}</small></span>${mien ? `<span class="conn"><i class="pt" data-forme="connecté"></i>connecté</span>` : `<button type="button" class="contour" data-act="esv-connecter"${verrou ? ' disabled' : ''}>Connecter</button>`}</div>`).join('');
  return `<div class="voile transparent" data-act="fermer"></div><div class="popover" role="dialog" aria-label="Onglets ESV">${ong}<p class="pied">${verrou ? 'Une seule connexion, gardée jusqu’à la fin du lot.' : 'Une seule connexion, partagée entre Orbite et Écho.'}</p></div>`;
}

function rendre() {
  const m = modele();
  const instrument = `<section class="instrument" data-ton="${m.ton}" aria-live="polite"><span class="faisceau" aria-hidden="true"></span><div class="groupe-etat"><div class="etat">${glypheHtml(m)}<span class="mot">${esc(m.mot)}</span></div><p class="phrase">${m.phrase}</p></div>${objetHtml(m)}${m.allure ? `<p class="allure" id="allure">${m.allure}</p>` : ''}${m.fileBandeau || ''}${actionsHtml(m)}</section>`;
  const couche = S.couche === 'palette' ? paletteHtml(m) : S.couche === 'reglages' ? feuilleHtml() : S.couche === 'cache' ? confirmCache() : S.couche === 'esv' ? popoverEsv(m) : S.couche === 'passer' ? confirmPasser() : S.couche === 'file' ? boiteFile() : '';
  FEN.innerHTML = `${barreHtml(m)}${instrument}<div class="zone"><div class="tiroir" data-ouvert="${S.tiroir ? 1 : 0}" id="tiroir">${poigneeHtml(m)}<div id="tiroir-corps"${S.tiroir ? '' : ' inert'}>${tiroirHtml(m)}</div></div></div>${cacheHtml(m)}${couche}`;
  /* compact : le tiroir ouvert monte jusqu'à la barre et couvre l'instrument (marges comprises) */
  const zone = FEN.querySelector('.zone'), barre = FEN.querySelector('.barre'); if (zone && barre) FEN.style.setProperty('--instrument-h', Math.round(zone.getBoundingClientRect().top - barre.getBoundingClientRect().bottom) + 'px');
  if (S.couche === 'palette') { const q = D.getElementById('pal-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  majVivant();
  const nk = S.file.en && (S.scene === 'cours' || S.scene === 'pause') ? 'file-cours' : S.scene, nf = nk.startsWith('file-') || S.file.en;
  const n = D.getElementById('notes'); if (n) n.innerHTML = `<h2>${esc(SCENES.find(s => s[0] === nk)?.[1] || '')}</h2><p>${esc(NOTES[nk] || '')}</p>${nf ? `<div class="sim"><h2>Pour jouer la maquette</h2><p>Les chiffres sont inventés ; une partie réelle dure bien plus longtemps.</p><button type="button" data-sim="finir"${S.file.en ? '' : ' disabled'}>Finir la partie</button><button type="button" data-sim="arret"${S.file.en ? '' : ' disabled'}>Provoquer un arrêt</button><br><label>Cause de l’arrêt <select data-sim="cause">${Object.entries(CAUSES).map(([k, c]) => `<option value="${k}"${k === S.file.cause ? ' selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label></div>` : ''}${S.scene === 'cours' || S.scene === 'pause' ? '<p><b>Allure, honnêtement.</b> Déjà dans l’extension : la durée de chaque cut posé (durationMs), l’heure d’ouverture du cut en cours (cutStartedAt), l’heure de départ du lot. Médiane récente, remplissage du cut en cours, cuts par minute et temps restant sont calculables sans rien demander de nouveau à ESV. Pour une vitesse « vraie » qui compte les navigations entre cuts, il faudrait une heure de fin par cut.</p>' : ''}${R.dataset.revue === 'v2' && m.tiroir !== 'visites' ? '<p><span class="nouveau">V2</span> « Ouvrir dans ESV » et « Examiné » sont des fonctions nouvelles à construire ; V1 (lecture seule) correspond à ce que le panneau sait faire aujourd’hui.</p>' : ''}${NOTE_NIVEAU}`;
}
/* Mise à jour légère, sans redessiner : le cut en cours qui se remplit, la ligne d'allure. */
function majVivant() {
  const L = sim.lot;
  if (S.scene === 'cours') {
    const med = medianeLot() || L.encours.attendu, p = Math.min(1, L.encours.depuis / med);
    const arc = FEN.querySelector('.glyphe .arc'); if (arc) arc.style.strokeDashoffset = ((MIX ? C4 : 7) * (1 - p)).toFixed(2);
    const ici = FEN.querySelector('.rail-ici i'); if (ici) ici.style.transform = `scaleX(${p.toFixed(3)})`;
  }
  const al = D.getElementById('allure');
  if (al && S.scene === 'pause') { const med = medianeLot(); al.innerHTML = `en pause depuis <b>${duree(L.pauseDepuis)}</b> <span class="sep">·</span> médiane <b>${fr(Math.round(med * 10) / 10)} s</b> par cut avant la pause`; }
}
/* CH-024 : les notes qui décrivent un dessin de Q2 sont réécrites pour les dessins de l'actuelle. */
if (MIX) Object.assign(NOTES, {
  pret: 'Au repos. Un seul bouton plein, qui dit l’effet. Les bornes du lot sont dans la phrase ; on les change dans les réglages, au repos. Glyphe : l’anneau vide de Signal, en encre.',
  cours: 'Le rail avance au rythme réel de la simulation : le curseur (seule marque en lumière, avec l’anneau) glisse à chaque cut terminé ; l’anneau se remplit du temps passé sur le cut en cours, jusqu’à la médiane. Un trait court sur le rail = un différé. Pause → « Pause demandée » (anneau en pointillé et ‖) → En pause.',
  pause: 'Même instrument. Le glyphe ‖ et le curseur sont en encre : la pause n’est pas une alerte. L’allure dit depuis quand et garde la médiane d’avant la pause. « Reprendre » nomme le cut.',
  incident: 'Le bloc incident remplace le rail, pas l’état. Le triangle et le mot « À toi » sont les seuls éléments en brique, avec le cadre. La phrase dit le problème, les trois boutons disent les sorties, sans redite ; « Passer » n’est jamais principal et garde sa confirmation.',
  interrompu: 'ESV s’est tu pendant une pose : l’octogone barré, en brique. L’opération interrompue reste écrite jusqu’à sa clôture. Aucun « Reprendre » : la seule sortie est d’archiver le résultat.',
  fin: 'Trois lignes distinctes. Le glyphe est la coche de Signal, en encre : terminé n’a pas besoin de couleur. « Voir ce qui reste » ouvre le tiroir ; l’export vient en second ; le cache devient disponible.',
  relecture: 'La relecture est un état d’Orbite : même rail, en relus / sélection, un trait court à chaque cut corrigé. Glyphe : l’anneau et ‖, en encre. Pause, Reprendre, Arrêter.',
  verrou: 'Deuxième passe : Ariane travaille dans ESV (le cadenas, en lumière), aucune action, cache indisponible. Le nom et les états viendront de la session principale.',
  'sans-esv': 'Aucun onglet ESV : le glyphe est l’anneau barré, la puce un cercle vide ; l’action principale devient « Choisir un onglet ».',
});
const NOTE_NIVEAU = MIX
  ? (R.dataset.v === '5'
    ? '<p><b>Niveau 5, mix et noir profond.</b> Le mix du niveau 4 (dessins de Signal, couleurs et valeurs de Q2) sur un noir plus profond : fond et surfaces descendus d’un cran, séparés par leurs filets. Le clair est celui du niveau 4.</p>'
    : '<p><b>Niveau 4, mix strict.</b> Les dessins de Signal (logo, anneau, triangle, octogone, coche, cadenas, icônes des boutons, traits du rail) et son fond ; les couleurs à rôle unique et le système de valeurs de Q2 (lumière = Ariane avance, brique = à toi ; tout le reste en encre, dit par la forme et le mot).</p>')
  : R.dataset.v === '3'
  ? '<p><b>Niveau 3, poussé.</b> Les gestes de la Frise de lumière (CH-020, 4b et 4c) : fond chaud, l’instrument en carte posée, une lumière qui court sur son bord tant qu’Ariane avance, le mot d’état en lumière, le grand compte en Zodiak, un seul bouton plein. Le glyphe est retiré : le mot suffit, la lumière dit la marche.</p>'
  : '<p><b>Niveau 2, mesuré.</b> Mêmes composants et même structure que Signal ; un seul système de valeurs ; couleurs à rôle unique (lumière = Ariane avance, brique = à toi, eau = vert à contrôler) ; symboles tirés du rail.</p>';

/* ─────────────────────────── actions */
function note(t) { S.note = t; rendre(); clearTimeout(note.h); note.h = setTimeout(() => { S.note = ''; rendre(); }, 2600); }
function agir(act) {
  const L = sim.lot;
  switch (act) {
    case 'file-ouvrir': if (S.scene !== 'file-eteinte' && S.scene !== 'file-reglage') S.scene = 'file-eteinte'; S.couche = 'file'; S.tiroir = false; break;
    case 'file-preparer': if (!S.file.allumee) return; S.file.prete = true; S.couche = null; if (S.scene === 'file-reglage') S.scene = 'file-eteinte'; note('File préparée · rien n’est lancé'); return;
    case 'file-lancer': { const F = S.file; F.en = true; F.prete = false; F.partie = 1; F.bilans = []; F.arret = null; S.couche = null; sim.lot = lotDeBase(); sim.lot.cuts = []; sim.lot.encours = { cut: 4811, depuis: 0, attendu: 7 }; S.scene = 'cours'; S.tiroir = false; break; }
    case 'file-arreter': S.file.en = false; S.file.allumee = false; S.file.arret = 'operateur'; S.scene = 'file-fin'; break;
    case 'file-reprise': { const F = S.file; F.n = F.n - F.bilans.length; F.bilans = []; F.partie = 1; F.prete = true; F.allumee = true; S.scene = 'file-eteinte'; S.couche = null; S.tiroir = false; sim.lot = lotDeBase(); note('File préparée pour la reprise · rien n’est lancé'); return; }
    case 'fermer': S.couche = null; S.q = ''; S.pi = 0; break;
    case 'tiroir': S.tiroir = !S.tiroir; S.sel = null; break;
    case 'palette': S.couche = S.couche === 'palette' ? null : 'palette'; S.q = ''; S.pi = 0; break;
    case 'reglages': S.couche = S.couche === 'reglages' ? null : 'reglages'; break;
    case 'esv': S.couche = S.couche === 'esv' ? null : 'esv'; break;
    case 'esv-connecter': S.couche = null; if (S.scene === 'sans-esv') S.scene = 'pret'; note('Connecté à l’onglet 1 · partie 13'); return;
    case 'cache': S.couche = 'cache'; break;
    case 'cache-vider': S.couche = null; S.cacheVide = true; setTimeout(() => { S.cacheVide = false; rendre(); }, 3000); break;
    case 'demarrer': sim.lot = lotDeBase(); sim.lot.cuts = []; sim.lot.encours = { cut: 4811, depuis: 0, attendu: 7 }; S.scene = 'cours'; break;
    case 'pause': if (L.etat === 'cours') L.etat = 'dem'; break;
    case 'reprendre': L.etat = 'cours'; L.encours.depuis = 0; L.encours.attendu = 5.5 + al() * 6; S.scene = 'cours'; break;
    case 'arreter': S.scene = 'fin'; break;
    case 'reessayer': case 'main': case 'archiver': case 'passer-ok': S.couche = null; S.scene = 'cours'; L.etat = 'cours'; L.encours.depuis = 0; if (act === 'passer-ok') { L.cuts.push({ cut: L.encours.cut, statut: 'saute', dur: 0 }); L.encours = { cut: L.encours.cut + 1, depuis: 0, attendu: 7 }; } break;
    case 'passer': S.couche = 'passer'; break;
    case 'exporter': S.exportFait = true; note('Export lancé · 3 volumes'); return;
    case 'rel-reprendre': note('Relecture reprise au cut 4880'); return;
    case 'rel-arreter': S.scene = 'fin'; break;
    case 'echo-demarrer': S.scene = 'echo'; break;
    case 'echo-terminer': S.scene = 'echo-vide'; note('Volumes prêts · téléchargement lancé'); return;
    case 'echo-pause': note('Écho en pause'); return;
    case 'ancien': note('Ancien panneau : ouvert dans la même fenêtre (hors maquette)'); return;
    case 'activite:orbite': case 'activite:echo': { const m = modele(); if (m.bascule.verrou && !act.endsWith(m.activite)) { note(m.bascule.raison); return; } S.scene = act.endsWith('echo') ? 'echo-vide' : (S.scene === 'file-reglage' ? 'file-eteinte' : 'pret'); S.tiroir = false; break; }
    default: return;
  }
  rendre();
}
FEN.addEventListener('click', e => {
  const fi = e.target.closest('[data-file]'); if (fi) { const F = S.file, k = fi.dataset.file, v = Number(fi.dataset.val); if (fi.matches('[aria-disabled="true"]')) return; if (k === 'n') F.n = v; else F[k] = !!v; if (!F.allumee) F.prete = false; rendre(); return; }
  const ex = e.target.closest('[data-examine]'); if (ex) { const c = Number(ex.dataset.examine); if (S.examines.has(c)) S.examines.delete(c); else S.examines.add(c); rendre(); return; }
  const ou = e.target.closest('[data-ouvrir]'); if (ou) { note(`Cut ${ou.dataset.ouvrir} ouvert dans ESV (V2, à construire)`); return; }
  const row = e.target.closest('[data-row]'); if (row && !e.target.closest('[data-act]')) { S.sel = Number(row.dataset.row); rendre(); return; }
  const seg = e.target.closest('[data-seg]'); if (seg) { if (seg.dataset.seg === 'Thème' && seg.dataset.val !== 'Système') regler('theme', seg.dataset.val.toLowerCase()); else { seg.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === seg)); } return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.matches('[aria-disabled="true"]') && a.dataset.raison) { note(a.dataset.raison); return; }
  if (a.matches('[aria-disabled="true"]')) return;
  if (a.dataset.fermer) { S.couche = null; S.q = ''; S.pi = 0; }
  agir(a.dataset.act);
});
FEN.addEventListener('input', e => { if (e.target.id === 'pal-q') { S.q = e.target.value; S.pi = 0; rendre(); } });
D.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); agir('palette'); return; }
  if (e.key === 'Escape') { if (S.couche) agir('fermer'); else if (S.tiroir) agir('tiroir'); return; }
  if (S.couche === 'palette') {
    const L = FEN.querySelectorAll('.cmd[data-cmd]');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { S.pi = Math.max(0, Math.min(L.length - 1, S.pi + (e.key === 'ArrowDown' ? 1 : -1))); rendre(); e.preventDefault(); }
    else if (e.key === 'Enter') { const c = L[Math.max(0, Math.min(L.length - 1, S.pi))]; if (c && c.getAttribute('aria-disabled') !== 'true' && c.dataset.act) { S.couche = null; S.q = ''; S.pi = 0; agir(c.dataset.act); } e.preventDefault(); }
    return;
  }
  if (S.tiroir && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.target.closest('input,select')) {
    const n = FEN.querySelectorAll('#tiroir-corps [data-row]').length; if (!n) return;
    S.sel = Math.max(0, Math.min(n - 1, (S.sel ?? -1) + (e.key === 'ArrowDown' ? 1 : -1))); rendre(); FEN.querySelector(`[data-row="${S.sel}"]`)?.scrollIntoView({ block: 'nearest' }); e.preventDefault();
  }
  if (S.tiroir && R.dataset.revue === 'v2' && S.sel !== null && (e.key === 'e' || e.key === 'E') && !e.target.closest('input,select')) { const b = FEN.querySelector(`[data-row="${S.sel}"] [data-examine]`); if (b) b.click(); }
});
D.getElementById('notes').addEventListener('click', e => { const b = e.target.closest('[data-sim]'); if (!b || b.tagName !== 'BUTTON') return; const F = S.file;
  if (b.dataset.sim === 'finir' && F.en) { finirPartie(); rendre(); }
  if (b.dataset.sim === 'arret' && F.en) { F.en = false; appliquerCause(); S.scene = 'file-alerte'; S.tiroir = false; rendre(); } });
D.getElementById('notes').addEventListener('change', e => { if (e.target.dataset.sim !== 'cause') return; S.file.cause = e.target.value; if (S.scene === 'file-alerte') appliquerCause(); rendre(); });

/* ─────────────────────────── banc d'essai */
const LARGEURS = ['600', '480', '420', '360'];
function regler(k, v) {
  if (k === 'largeur') { if (!LARGEURS.includes(v)) v = Number(v) < 480 ? '360' : '600'; R.dataset.largeur = v; R.dataset.taille = Number(v) < 480 ? 'compact' : 'normal'; FEN.style.setProperty('--largeur', v + 'px'); }
  if (k === 'theme') R.dataset.theme = v; if (k === 'revue') R.dataset.revue = v; if (k === 'cadence') R.dataset.cadence = v; if (k === 'chiffre') R.dataset.chiffre = v;
  D.querySelectorAll(`.banc [data-${k}]`).forEach(b => b.setAttribute('aria-pressed', b.dataset[k] === v));
  rendre();
}
function scene(id) {
  S.file = FILE0(); const F = S.file;
  if (id === 'file-cours') Object.assign(F, { allumee: true, n: 3, en: true, partie: 2, bilans: [bilanInvente(1)] });
  if (id === 'file-alerte') Object.assign(F, { allumee: true, n: 3, bilans: [bilanInvente(1), bilanInvente(2)] });
  if (id === 'file-fin') Object.assign(F, { n: 2, bilans: [bilanInvente(1), bilanInvente(2)] });
  const idVue = id; if (id === 'file-cours') id = 'cours';
  S.scene = id; S.couche = idVue === 'file-reglage' ? 'file' : ['palette', 'reglages', 'cache', 'esv'].includes(id) ? id : null; S.tiroir = false; S.sel = null; S.note = ''; S.exportFait = false;
  if (id === 'file-alerte') appliquerCause();
  if (id === 'cours' || id === 'palette') { sim.lot = lotDeBase(); sim.lot.etat = 'cours'; } else if (id === 'pause') { sim.lot = lotDeBase(); sim.lot.etat = 'pause'; sim.lot.pauseDepuis = 80; } else if (id === 'incident' || id === 'interrompu' || id === 'esv-muet') { sim.lot = lotDeBase(); sim.lot.etat = 'incident'; }
  if (id === 'echo') echoDeBase();
  D.getElementById('sc-scene').value = idVue; rendre();
}
const sel = D.getElementById('sc-scene'); sel.innerHTML = SCENES.map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join(''); sel.addEventListener('change', () => scene(sel.value));
D.querySelectorAll('.banc .seg button').forEach(b => b.addEventListener('click', () => { const k = Object.keys(b.dataset)[0]; regler(k, b.dataset[k]); }));
D.getElementById('sc-reduit').addEventListener('change', e => { if (e.target.checked) R.dataset.reduit = '1'; else delete R.dataset.reduit; });
const P = new URLSearchParams(location.search);
R.dataset.nu = P.get('nu') === '1' ? '1' : '0';
regler('largeur', P.get('largeur') || (P.get('taille') === 'compact' ? '360' : '600'));
if (P.get('theme')) regler('theme', P.get('theme')); if (P.get('revue')) regler('revue', P.get('revue')); if (P.get('cadence')) regler('cadence', P.get('cadence')); if (P.get('chiffre')) regler('chiffre', P.get('chiffre'));
if (P.get('reduit') === '1') { R.dataset.reduit = '1'; D.getElementById('sc-reduit').checked = true; }
scene(SCENES.some(s => s[0] === P.get('scene')) ? P.get('scene') : 'cours');
if (P.get('tiroir') === '1') { S.tiroir = true; rendre(); }
if (P.get('fige') !== '1') sim.tick = setInterval(boucle, 250);
window.ArianeMaquette = { S, sim, scene, rendre, finirPartie };
})();
