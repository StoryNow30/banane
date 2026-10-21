/* Test 17 : HABILLAGE DU PANNEAU, partie PURE (aucun DOM, aucun message, aucune API Chrome).
 *
 * La présentation « Ariane » (maquette « accueil à vignettes », D-231 : accueil, Orbite, Écho, Revue, Réglages) dessinée à partir d'un INSTANTANÉ
 * (voir src/ui5.js) : l'état et les libellés que `panel.js` vient d'écrire dans sa propre page. L'habillage ne décide rien : le bouton principal,
 * les autres actions, les phrases viennent du panneau (la hiérarchie « La ligne », D-045) ; un clic sur l'habillage est un clic sur le bouton
 * d'origine (`data-act="legacy:<id>"`). Aucun export, aucun message au service worker, rien de neuf envoyé à ESV.
 *
 * Tout texte vient du panneau ou de ce fichier et passe par `esc` avant d'entrer dans le HTML. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api; else root.ArianeUi5Rendu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ------------------------------------------------------------------ modèle d'écran */
  /* Le bouton principal : celui que le panneau a désigné (`role: 'primary'`). Pendant la relecture, « Arrêter la relecture » (ou « J'ai contrôlé le
   * cut ») passe devant et l'export descend dans « Autres options » : on n'exporte pas avant la fin. */
  function choisirBoutons(boutons, mode) {
    const liste = (boutons || []).filter(b => b && b.id);
    const prioritaires = ['relecture-acquitter', 'relecture-arreter'];
    let primaire = null;
    if (mode === 'automatic') primaire = prioritaires.map(id => liste.find(b => b.id === id)).find(Boolean) || null;
    if (!primaire) primaire = liste.find(b => b.role === 'primary') || null;
    const autres = liste.filter(b => b !== primaire && b.id !== 'native-discard');
    return { primaire, autres };
  }

  function phrase(snap) {
    if (snap.mode === 'automatic') {
      if (snap.relecture?.interrompue) return snap.relecture.interrompue;
      if (snap.relecture?.ligne && snap.relecture.actif) return snap.relecture.ligne;
      if (snap.lot?.finPartie) return snap.lot.finPartie;
    }
    return snap.notice?.texte || '';
  }

  function modele(snap) {
    const s = snap || {};
    const { primaire, autres } = choisirBoutons(s.boutons, s.mode);
    return { primaire, autres, etat: s.lot?.etat || 'Aucun lot', phrase: phrase(s), avis: s.avisContrat || '', connexionOuverte: !!s.connexionOuverte };
  }

  /* Réglages : des listes, jamais en séance. Les valeurs et les actions sont celles du panneau (clic sur la case ou le bouton d'origine). */
  function reglages(snap) {
    const r = snap.reglages || {};
    const sel = (nom, valeurs, courant) => `<select data-sel="${esc(nom)}">${valeurs.map(([v, l]) => `<option value="${esc(v)}"${v === courant ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const ligne = (titre, aide, ctl) => `<div class="lr"><div>${esc(titre)}${aide ? `<small>${esc(aide)}</small>` : ''}</div>${ctl}</div>`;
    return `<h2>Réglages</h2>
 ${ligne('Après le lot', 'Choix gardé pour le prochain lot ; le lot en cours garde le sien.', sel('relecture', [['coupee', 'Rien'], ['ombre', 'Relire sans rien modifier'], ['corriger', 'Relire et corriger']], r.relecture))}
 ${ligne('Clic du mode rapide', 'Gardé pour le prochain lot.', sel('clic', [['tel-quel', 'Comme avant'], ['gauche-recentre', 'Rail gauche recentré'], ['tout-recentre', 'Tout recentré']], r.clic))}
 ${ligne('Série de différés', 'Mettre en attente les cuts voisins d’une série de différés.', sel('grappe', [['non', 'Non'], ['oui', 'Oui']], r.grappe ? 'oui' : 'non'))}
 ${ligne('Raison de la correction (Écho)', 'Lue au démarrage d’Écho.', sel('raison', [['non', 'Non'], ['chiffres', 'Oui · chiffres du haut'], ['alt-chiffres', 'Oui · Alt + chiffre'], ['pave', 'Oui · pavé numérique']], r.raison ? (r.touches || 'chiffres') : 'non'))}
 ${ligne('Bandeau dans ESV', 'Une ligne d’état au bas de la page ESV.', `<button type="button" class="btn" data-act="legacy:bandeau-toggle">${r.bandeau ? 'Allumé' : 'Éteint'}</button>`)}
 ${ligne('Thème', '', `<button type="button" class="btn" data-act="legacy:theme-toggle">Clair / sombre</button>`)}
 ${ligne('Connexion à ESV', snap.connexionNote || '', `<span class="conn">${(snap.onglets || []).length ? sel('onglet', [['', 'Choisir un onglet…'], ...snap.onglets.map(o => [o.valeur, o.texte])], snap.ongletChoisi || '') : ''}<button type="button" class="btn" data-act="legacy:connect">Reconnecter ESV</button></span>`)}
 ${ligne('Vider le cache des exports', 'Seulement après confirmation de réception.', `<button type="button" class="btn" data-act="legacy:export-cache-clear">Vider…</button>`)}
 ${ligne('Abandonner la séance Écho', 'Supprime les données de la séance, avec confirmation.', `<button type="button" class="btn danger" data-act="legacy:native-discard">Abandonner…</button>`)}
 ${ligne('Interface', 'La présentation du panneau.', sel('variante', [['ariane', 'Ariane'], ['ariane2', 'Ariane, nouvelle présentation (essai)'], ['ancienne', 'Ancien panneau']], snap.variante))}
 ${ligne('Détails techniques', 'Santé de la collecte, qualité de capture, départs des parties, résumé de la partie, journal du lot.', `<button type="button" class="btn" data-act="variante:ancienne">Ouvrir l’ancien panneau</button>`)}`;
  }

  /* ------------------------------------------------------------------ écrans
   * Accueil à vignettes, puis Orbite, Écho, Revue. Les chiffres viennent de `snap.ar` (calculé par src/ui5.js à partir de l'état du
   * panneau, définitions de fiches/UI_ETATS_COMPTEURS.md) ; les commandes sont les boutons d'origine du panneau (`legacy:<id>`), dans
   * la hiérarchie qu'il a choisie. Rien d'autre n'est commandé. */
  const PICTO = {
    orbite: '<circle cx="12" cy="12" r="2.6"/><ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(-25 12 12)"/>',
    echo: '<path d="M12 12h.01"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
    cache: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5"/>',
    revue: '<path d="M5 6h9M5 12h6M5 18h9"/><path d="M15 12l2.2 2.2L21 10"/>', reglages: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  };
  const CLP = { orbite: 'o', echo: 'e', revue: 'r', reglages: 'b', cache: 'b' };
  const picto = n => `<span class="picto ${CLP[n]}"><svg viewBox="0 0 24 24" aria-hidden="true">${PICTO[n]}</svg></span>`;
  const IC = {
    pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
    play: '<path d="M7 5l12 7-12 7z" fill="currentColor"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    globe: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></g>',
    trash: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5"/></g>',
    alerte: '<path d="M12 4l9 16H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  };
  const ic = (n, s = 15) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${IC[n]}</svg>`;
  /* Pastille d'état du lot : la forme dit l'état (roue, roue en pointillé, deux barres, coche, triangle). */
  const PASTILLE = { pret: ['pret', 'Prêt'], cours: ['cours', 'Orbite en cours'], dem: ['dem', 'Pause demandée'], pause: ['pause', 'En pause'], p2: ['cours', 'Deuxième passe en cours'], alerte: ['alerte', 'À toi'], fini: ['fini', 'Lot terminé'], arrete: ['fini', 'Lot arrêté'] };
  const pastille = a => { const [c, t] = a.horsLigne && a.etat === 'pret' ? ['hors', 'Aucun onglet ESV'] : (PASTILLE[a.etat] || PASTILLE.pret); return `<span class="etat ${c}"><span class="f"></span>${esc(a.etatTexte || t)}</span>`; };
  const COUL = { orbite: 'var(--orbite)', echo: 'var(--echo)', revue: 'var(--revue)' };
  const barreAr = (a, vive) => {
    if (!a.cibles) return '';
    const p = x => Math.max(0, Math.min(100, x / a.cibles * 100)).toFixed(2);
    return `<div class="barre" role="img" aria-label="${esc(a.poses)} posés et ${esc(a.differes)} différés sur ${esc(a.cibles)}" style="--fin:${p(a.poses + a.differes)}%"><i style="width:${p(a.poses)}%;background:#fff"></i><i style="width:${p(a.differes)}%;background:var(--dif)"></i>${vive ? '<span class="lueur"></span>' : ''}</div>`;
  };
  /* Nouvelle présentation (`variante` « ariane2 », maquette v2) : mêmes écrans, sans grand titre ni phrase d'accompagnement, rangée des onglets ESV, vidage du cache en vue,
   * nouveau logo. Une seule connexion ESV est partagée par Orbite et Écho : la rangée montre le même onglet connecté dans les deux. */
  const v2 = snap => snap.variante === 'ariane2';
  const LOGO1 = '<svg viewBox="0 0 26 26" width="24" height="24" aria-hidden="true"><path d="M3 22C8 4 18 4 23 22" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M7 22C10 11 16 11 19 22" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/></svg>';
  /* Deux rails qui convergent forment un A, les traverses raccourcissent vers l'horizon ; dégradé corail → violet (couleurs d'Orbite et d'Écho). */
  const LOGO2 = '<svg class="logo" viewBox="0 0 32 32" width="26" height="26" aria-label="Ariane"><defs><linearGradient id="ar-lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9466"/><stop offset=".55" stop-color="#d4306e"/><stop offset="1" stop-color="#6a3be8"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#ar-lg)"/><g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 26L14.6 6M23.5 26L17.4 6" stroke-width="2.6"/><path d="M10 21h12" stroke-width="2.2" stroke-opacity=".85"/><path d="M11.55 16h8.9" stroke-width="2" stroke-opacity=".65"/><path d="M13.1 11h5.8" stroke-width="1.8" stroke-opacity=".45"/></g></svg>';
  /* Rangée des onglets ESV : une puce par onglet de la liste du panneau ; un clic choisit l'onglet ET clique « Reconnecter ESV ». */
  function rangeeEsv(snap, a, courant) {
    if (!v2(snap) || !['accueil', 'orbite', 'echo'].includes(courant)) return '';
    const choisi = snap.ongletChoisi || '', nom = courant === 'echo' ? 'Écho' : courant === 'orbite' ? 'Orbite' : 'Connecté', cl = courant === 'echo' ? 'e' : courant === 'orbite' ? 'o' : 'c';
    const puces = (snap.onglets || []).map(o => {
      const mien = String(o.valeur) === String(choisi), pasPret = /pas prêt/i.test(o.texte), off = !mien && (pasPret || a.connexionBloquee);
      const qui = mien ? (a.esv === 'ko' ? 'Reconnexion…' : nom) : off ? ic('lock', 12) : 'Connecter';
      const titre = mien ? 'Connecté' : off ? (pasPret ? 'Cet onglet n’est pas prêt' : 'Garde son onglet jusqu’à la fin du lot') : 'Connecter Ariane à cet onglet';
      return `<button type="button" class="te${mien ? ' ' + cl : ''}${off ? ' lock' : ''}${!choisi && !off ? ' attend' : ''}"${mien || off ? ' aria-disabled="true"' : ` data-act="conn:${esc(o.valeur)}"`} title="${titre}"><span class="pt"></span><b>${esc(o.texte)}</b><span class="qui">${qui}</span></button>`;
    }).join('');
    return `<div class="esvbar"><span class="lab">${ic('globe', 15)}Onglets ESV</span><div class="tabs">${puces || '<span class="aucun">Aucun onglet ESV ouvert.</span>'}</div></div>`;
  }
  /* Vidage du cache des exports, en vue dans Orbite et Écho. Même bouton, même confirmation que le panneau d'origine ; grisé avec sa raison tant qu'il est impossible. */
  function maintAr(snap, a, courant) {
    if (!v2(snap) || !['orbite', 'echo'].includes(courant)) return '';
    const ok = a.cache?.actif === true, relecture = !!(snap.relecture?.actif || snap.relPause?.pause || snap.relPause?.reprendre);
    const raison = courant === 'echo' ? (a.lotOuvert || /Aucune/.test(a.echoEtat || '') ? 'Indisponible pour l’instant.' : 'Disponible quand la séance Écho est terminée.')
      : relecture ? 'Disponible quand la relecture est terminée ou arrêtée.' : a.lotOuvert ? 'Disponible quand le lot est terminé ou arrêté.' : 'Indisponible pour l’instant.';
    return `<div class="maint">${picto('cache')}<span class="tx">Cache des exports<small>${ok ? 'À vider seulement après réception de tous les volumes exportés.' : raison}</small></span><span class="sp"></span><button type="button" class="pill cache" id="ar-cache" data-act="legacy:export-cache-clear"${ok ? '' : ' disabled'}>${ic('trash')}Vider le cache</button></div>`;
  }
  function enteteAr(snap, a, courant) {
    const ong = [['accueil', 'Accueil'], ['orbite', 'Orbite'], ['echo', 'Écho'], ['revue', 'Revue']].map(([k, t]) => `<button type="button" data-act="aller:${k}" aria-current="${k === courant}">${COUL[k] ? `<i style="background:${COUL[k]}"></i>` : ''}${t}</button>`).join('');
    const mini = (a.etat === 'cours' || a.etat === 'dem') && !['orbite', 'accueil'].includes(courant)
      ? `<span class="mini"><button type="button" data-act="aller:orbite"><span class="spin"></span>Orbite · ${esc(a.traites)}${a.cibles ? ' / ' + esc(a.cibles) : ''}</button>${a.pause ? `<button type="button" class="mini-p" data-act="pause" aria-label="Pause du lot"${a.pause.actif && a.etat !== 'dem' ? '' : ' disabled'}>${ic('pause', 13)}</button>` : ''}</span>` : '';
    const esv = a.esv === 'ko' ? '<span class="esv ko"><i></i>ESV ne répond plus</span>' : a.esv === 'ok' ? '<span class="esv"><i></i>ESV répond</span>' : '<span class="esv non"><i></i>ESV non connecté</span>';
    return `<header class="haut"><span class="marque">${v2(snap) ? LOGO2 : LOGO1}Ariane</span><nav class="onglets" aria-label="Activités">${ong}</nav><span class="sp"></span>${mini}${esv}<button type="button" class="ico${courant === 'reglages' ? ' a' : ''}" data-act="aller:reglages" aria-label="Réglages" title="Réglages">${picto('reglages').replace('picto b', 'picto nu')}</button></header>${rangeeEsv(snap, a, courant)}`;
  }
  /* Commande principale : celle du panneau ; pendant une pause demandée, elle reste en place, grisée. */
  function commandeAr(a, m, cls = 'pill') {
    if (a.etat === 'dem') return `<button type="button" class="${cls}" id="ar-cmd" disabled><span class="ar-lbl"><span class="spin"></span>Pause demandée…</span></button>`;
    if (a.etat === 'p2') return `<button type="button" class="${cls}" id="ar-cmd" disabled><span class="ar-lbl">${ic('lock')}Ne touche à rien dans ESV</span></button>`;
    const p = m.primaire; if (!p) return '';
    const icone = /pause/.test(p.id) ? ic('pause') : /resume|start|lancer/.test(p.id) ? ic('play') : '';
    return `<button type="button" class="${cls}${p.role === 'danger' ? ' danger' : ''}" id="ar-cmd" data-act="${p.id === 'pause' ? 'pause' : 'legacy:' + esc(p.id)}"${p.actif ? '' : ' disabled'}><span class="ar-lbl">${icone}${esc(p.texte)}</span></button>`;
  }
  const autresAr = m => m.autres.some(b => b.actif) ? `<div class="autres">${m.autres.filter(b => b.actif).map(b => `<button type="button" class="pill sombre petit${b.role === 'danger' ? ' danger' : ''}" data-act="legacy:${esc(b.id)}">${esc(b.texte)}</button>`).join('')}</div>` : '';
  function alerteAr(snap, m) {
    const t = [m.avis, m.connexionOuverte ? 'ESV n’est pas connecté. Recharge la page ESV (F5) si elle est figée, puis reconnecte-la dans Réglages.' : '', snap.notice?.erreur ? snap.notice.texte : '', snap.relecture?.interrompue || ''].filter(Boolean);
    return t.length ? `<div class="alerte" role="alert">${ic('alerte', 20)}<div>${t.map(x => `<p>${esc(x)}</p>`).join('')}</div></div>` : '';
  }
  /* Test 17 (D-232) : relecture en pause ou pause possible — une ligne et les boutons du module `src/relecture-pause.js`, rien d'autre. */
  const relAr = (snap, cls = 'pill') => {
    const r = snap.relPause; if (!r || (!r.pause && !r.reprendre && !r.arreter)) return '';
    const b = [];
    if (r.pause) b.push(`<button type="button" class="${cls} sombre petit" data-act="legacy:relecture-pause"${r.pause.actif ? '' : ' disabled'}>${ic('pause')}${esc(r.pause.texte)}</button>`);
    if (r.reprendre) b.push(`<button type="button" class="${cls}" data-act="legacy:relecture-reprendre"${r.reprendre.actif ? '' : ' disabled'}${r.reprendre.raison ? ` title="${esc(r.reprendre.raison)}"` : ''}>${ic('play')}${esc(r.reprendre.texte)}</button>`);
    if (r.arreter) b.push(`<button type="button" class="${cls} sombre petit danger" data-act="legacy:relecture-arreter-pause">Arrêter la relecture</button>`);
    return `<div class="relpause">${r.ligne ? `<p>${esc(r.ligne)}</p>` : ''}<div class="act">${b.join('')}</div></div>`;
  };
  function accueilAr(snap, a, m) {
    const titre = a.partie != null ? `Partie ${esc(a.partie)}` : 'Aucune partie ouverte';
    const phrase = a.etat === 'p2' ? 'La deuxième passe travaille dans ESV. Ne touche à rien tant qu’elle n’a pas fini.'
      : a.etat === 'cours' ? `Orbite pose le cut ${esc(a.cours ?? '…')}. Ne change pas de cut dans ESV pendant le lot.`
      : a.etat === 'dem' ? `Orbite finit le cut ${esc(a.cours ?? '…')}, puis s’arrête.`
      : a.etat === 'pause' ? `Lot en pause${a.dernier != null ? `, après le cut ${esc(a.dernier)}` : ''}.${a.restants != null ? ` Il reste ${esc(a.restants)} cuts.` : ''}`
      : a.etat === 'alerte' ? esc(a.alerte || m.phrase || 'Le lot attend ta décision.')
      : a.etat === 'fini' || a.etat === 'arrete' ? `${esc(a.traites)} cuts traités.${a.aExaminer ? ` ${esc(a.aExaminer)} cuts restent à examiner.` : ''}`
      : a.partie != null ? 'Lance un lot Orbite, ou ouvre Écho pour corriger toi-même.' : 'Ouvre une partie dans ESV ; Ariane la reconnaîtra.';
    const enLot = a.etat === 'cours' || a.etat === 'dem';
    const bts = a.etat === 'p2' ? '<button type="button" class="pill" data-act="aller:orbite">Suivre la passe</button>'
      : enLot ? `<button type="button" class="pill" data-act="aller:orbite" data-vers="orbite">Suivre le lot</button>${a.pause ? `<button type="button" class="pill verre" data-act="pause"${a.etat === 'dem' || !a.pause.actif ? ' disabled' : ''}>${ic('pause')}${a.etat === 'dem' ? 'Pause demandée…' : 'Pause'}</button>` : ''}`
      : a.etat === 'fini' || a.etat === 'arrete' ? `${a.aExaminer ? `<button type="button" class="pill" data-act="aller:revue">Examiner les ${esc(a.aExaminer)} cuts</button>` : ''}<button type="button" class="pill${a.aExaminer ? ' verre' : ''}" data-act="legacy:export-tout">Exporter le dossier</button>`
      : a.etat === 'pause' && a.reprendre ? `<button type="button" class="pill" data-act="legacy:resume"${a.reprendre.actif ? '' : ' disabled'}>${ic('play')}${esc(a.reprendre.texte || 'Reprendre')}</button><button type="button" class="pill verre" data-act="aller:orbite">Voir le lot</button>`
      : `<button type="button" class="pill" data-act="aller:orbite" data-vers="orbite">${ic('play')}${a.etat === 'alerte' ? 'Voir le lot' : 'Ouvrir Orbite'}</button><button type="button" class="pill verre" data-act="aller:echo" data-vers="echo">Ouvrir Écho</button>`;
    const don = a.traites || a.cibles ? `<div class="l1"><span>Avancement du lot</span></div><div class="n">${esc(a.traites)} <span>${a.cibles ? `sur ${esc(a.cibles)} cuts traités` : 'cuts traités'}</span></div><div class="d"><span><i class="m p"></i>${esc(a.poses)} posés</span><span><i class="m d"></i>${esc(a.differes)} différés</span></div>${barreAr(a, a.etat === 'cours')}`
      : `<div class="l1"><span>Ce qu’Ariane sait de la partie</span></div><div class="n">${a.cutEsv != null ? esc(a.cutEsv) : '—'} <span>cut affiché dans ESV</span></div>`;
    const vig = (k, cls, titreV, sous, st, indispo) => `<button type="button" class="vig ${cls}${indispo ? ' indispo' : ''}" ${indispo ? 'aria-disabled="true"' : `data-act="aller:${k}"`} data-k="${k}">${picto(k)}<span class="tx"><b>${titreV}</b><small>${sous}</small><span class="st">${st}</span></span><span class="fl"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span></button>`;
    const stO = { p2: 'Deuxième passe en cours', cours: `En cours · cut ${esc(a.cours ?? '…')}`, dem: 'Pause demandée', pause: 'En pause', alerte: 'Attend ta décision', fini: 'Terminé', arrete: 'Arrêté', pret: 'Prêt' }[a.etat] || 'Prêt';
    const stE = a.lotOuvert ? `${ic('lock', 12)} Indisponible pendant le lot` : esc(a.echoEtat || 'Prêt');
    const nbRevue = a.differes + (a.vertsNombre || 0);
    const courte = a.horsLigne && a.etat === 'pret' ? 'Aucun onglet connecté.'
      : a.etat === 'p2' ? 'La deuxième passe travaille dans ESV. Ne touche à rien.'
      : a.etat === 'cours' ? `Pose du cut ${esc(a.cours ?? '…')}.` : a.etat === 'dem' ? `Finit le cut ${esc(a.cours ?? '…')}, puis s’arrête.`
      : a.etat === 'pause' ? `En pause${a.dernier != null ? ` après le cut ${esc(a.dernier)}` : ''}.`
      : a.etat === 'alerte' ? esc(a.alerte || m.phrase || 'Le lot attend ta décision.')
      : a.etat === 'fini' || a.etat === 'arrete' ? `${esc(a.traites)} cuts traités${a.aExaminer ? ` · ${esc(a.aExaminer)} à examiner` : ''}.` : '';
    const entete = v2(snap) ? `<span class="t2">${a.partie != null ? 'Partie ' + esc(a.partie) : 'ESV'}</span>${courte ? `<p class="p2">${courte}</p>` : ''}` : `<h2>${titre}</h2><p>${phrase}</p>`;
    return `${enteteAr(snap, a, 'accueil')}<section class="une"><div class="in"><div>${pastille(a)}${entete}<div class="bts">${bts}</div>${relAr(snap)}</div><div class="donnee">${don}</div></div></section>${alerteAr(snap, m)}
 <section class="rangee"><h3>Activités${a.partie != null ? ' · partie ' + esc(a.partie) : ''}</h3><div class="vignettes">
  ${vig('orbite', 'o', 'Orbite', 'Ariane pose et valide les rails', stO, false)}
  ${vig('echo', 'e', 'Écho', 'Tu corriges, Écho garde les exemples', stE, a.lotOuvert)}
  ${vig('revue', 'r', 'Revue', 'Différés et verts à contrôler', nbRevue ? `${esc(nbRevue)} à examiner` : 'Rien à examiner', false)}
  ${vig('reglages', 'b', 'Réglages et bilans', 'Exports, connexion, détails techniques', esc(snap.exportTexte ? snap.exportTexte.slice(0, 40) : 'Ouvrir'), false)}
 </div></section>`;
  }
  function parcoursAr(a) {
    const n = Math.max(a.cibles || 0, (a.parcours || []).length); if (!n) return '';
    const W = 1000, x = k => (k / n * W).toFixed(1), L = a.parcours || [];
    let g = `<line x1="0" y1="22" x2="${W}" y2="22" stroke="rgba(255,255,255,.16)" stroke-width="2"/><line x1="0" y1="22" x2="${x(L.length)}" y2="22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
    L.forEach((st, i) => { if (st === 'differe') g += `<rect x="${(i / n * W - 1.5).toFixed(1)}" y="14" width="3" height="16" rx="1.5" fill="#ffc043"/>`; else if (st === 'incertain' || st === 'saute') g += `<rect x="${(i / n * W - 1.5).toFixed(1)}" y="14" width="3" height="16" rx="1.5" fill="#ff6b5e"/>`; });
    const front = a.cours ?? a.dernier;
    if (front != null && L.length) g += `<line x1="${x(L.length)}" y1="6" x2="${x(L.length)}" y2="34" stroke="#fff" stroke-width="2"/><text x="${(L.length / n * W + 8).toFixed(1)}" y="12" fill="#fff" font-size="14" font-family="JetBrains Mono" font-weight="600">${esc(front)}</text>`;
    return `<section class="position"><div class="t"><span><b>Parcours du lot</b> · cuts dans l’ordre du lot, différés en ambre${a.cibles ? '' : ' (total inconnu pour ce lot)'}</span><span>${a.cibles ? 'fin de la partie' : ''}</span></div><svg viewBox="0 0 ${W} 38" preserveAspectRatio="none" role="img" aria-label="Parcours du lot">${g}</svg></section>`;
  }
  function listeDiff(a, vide) {
    const L = a.differesListe || [];
    if (!L.length) return `<div class="vide">${esc(vide)}</div>`;
    return `<div class="entetes d-row"><span></span><span>Cut</span><span>Motif</span><span>Précision</span><span style="text-align:right">Heure</span></div><div class="defile">${L.map(d => `<div class="row d-row"><i class="m d"></i><span class="c">${esc(d.cut)}</span><span>${esc(d.motif)}</span><span class="s">${esc(d.precision || '')}</span><span class="s" style="text-align:right">${esc(d.heure || '')}</span></div>`).join('')}</div>`;
  }
  function orbiteAr(snap, a, m) {
    const enLot = a.etat === 'cours' || a.etat === 'dem', examiner = (a.etat === 'fini' || a.etat === 'arrete') && a.aExaminer > 0;
    const titre = { cours: 'Pose des rails', dem: 'Pose des rails', p2: 'Deuxième passe', pause: 'Lot en pause', alerte: 'Le lot attend', fini: 'Lot terminé', arrete: 'Lot arrêté', pret: 'Prêt à poser' }[a.etat] || 'Orbite';
    const bornes = a.bornes ? `du cut ${esc(a.bornes.debut ?? '…')} ${a.bornes.fin ? 'au cut ' + esc(a.bornes.fin) : 'à la fin de la partie'}` : '';
    const phrase = a.etat === 'p2' ? 'Ariane revoit les cuts laissés différés et pose ceux qu’elle peut décider, avec les poses d’avant et d’après. Pendant ce temps, ne change pas de cut dans ESV.'
      : enLot ? 'Ariane pose et valide chaque cut, puis passe au suivant. Pendant le lot, ne change pas de cut dans ESV.'
      : a.etat === 'pret' ? 'Ariane posera les rails de chaque cut invalide, puis passera au suivant. Les bornes sont remplies avec le cut affiché dans ESV.'
      : a.etat === 'pause' ? 'Le lot reprendra au cut suivant, sans repasser sur ceux déjà validés.'
      : (a.etat === 'fini' || a.etat === 'arrete') ? (a.aExaminer ? `Il reste ${a.aExaminer} cuts à examiner dans la Revue.` : 'Rien ne reste à examiner pour ce lot.') : (a.alerte || m.phrase || '');
    const ligne = a.etat === 'p2' ? `<span class="spin"></span><span>La deuxième passe travaille dans ESV${a.passe2.cut != null ? ` · <b>cut ${esc(a.passe2.cut)}</b>` : ''} · ${esc(a.passe2.ecrites)} posé sur ${esc(a.passe2.demandees)}. <b>Ne touche à rien</b> tant qu’elle n’a pas fini.</span>`
      : a.etat === 'dem' ? `<span class="spin"></span><span>Ariane finit le <b>cut ${esc(a.cours ?? '…')}</b>, puis s’arrête. Aucun nouveau cut ne sera ouvert.</span>`
      : a.etat === 'cours' ? `<span class="spin"></span><span>Pose en cours sur le <b>cut ${esc(a.cours ?? '…')}</b></span>`
      : a.dernier != null ? `<span>Dernière validation : <b>cut ${esc(a.dernier)}</b></span>` : `<span>${esc(m.etat)}</span>`;
    const bornesEdit = a.etat === 'pret' ? `<div class="bornes"><label>Premier cut<input type="number" min="0" data-borne="start" value="${esc(a.bornes?.debut ?? '')}"></label><label>Dernier cut<input type="number" min="0" data-borne="end" placeholder="fin de partie" value="${esc(a.bornes?.fin ?? '')}"></label></div>` : '';
    const suivi = `<div class="suivi"><div class="n"><b>${esc(a.traites)}</b> <span>${a.cibles ? `sur ${esc(a.cibles)} cuts traités` : 'cuts traités'}</span></div>
   <div class="d"><span><i class="m p"></i>${esc(a.poses)} posés</span><span><i class="m d"></i>${esc(a.differes)} différés</span>${a.restants != null ? `<span class="r">${esc(a.restants)} restants</span>` : ''}</div>
   ${barreAr(a, a.etat === 'cours')}<div class="cour">${ligne}</div>${bornesEdit}<div class="act">${examiner ? `<button type="button" class="pill" data-act="aller:revue">Examiner les ${esc(a.aExaminer)} cuts</button>` : commandeAr(a, m)}</div>${autresAr(examiner && m.primaire ? { autres: [m.primaire, ...m.autres] } : m)}${relAr(snap)}</div>`;
    return `${enteteAr(snap, a, 'orbite')}<section class="scene"><div><div class="ar-nom">${picto('orbite')}<b>Orbite</b><span>${a.partie != null ? '· partie ' + esc(a.partie) : ''}</span></div>
   ${v2(snap) ? '' : `<h2>${titre}</h2>`}<div class="phr">${pastille(a)}<span class="bo">${bornes}</span></div>${v2(snap) ? '' : `<p>${esc(phrase)}</p>`}${alerteAr(snap, m)}</div>${suivi}</section>
 ${v2(snap) ? '' : parcoursAr(a)}<div class="cols"><section class="panneau"><div class="ph"><h3>Différés de ce lot</h3><span class="sp"></span><small>${enLot ? 'à reprendre après le lot' : 'à reprendre'}</small></div>${listeDiff(a, 'Aucun différé pour l’instant.')}</section></div>${maintAr(snap, a, 'orbite')}`;
  }
  function echoAr(snap, a, m) {
    const rows = snap.echoRows || [];
    return `${enteteAr(snap, a, 'echo')}<section class="scene"><div><div class="ar-nom">${picto('echo')}<b>Écho</b><span>${a.partie != null ? '· partie ' + esc(a.partie) : ''}</span></div>
   ${v2(snap) ? '' : '<h2>Tu corriges,<br>Écho garde les exemples</h2><p>Chaque correction que tu fais dans ESV est gardée comme exemple pour un prochain modèle, avec la raison si tu en donnes une.</p>'}${alerteAr(snap, m)}</div>
  <div class="suivi"><div class="n"><b>${esc(snap.echo?.corriges ?? 0)}</b> <span>corrections dans cette séance</span></div><div class="d"><span>${esc(snap.echo?.visites ?? 0)} cuts vus</span><span class="r">${esc(a.echoEtat || '')}</span></div>
   <div class="act">${a.lotOuvert ? `<span class="etat">${ic('lock', 13)} Indisponible pendant un lot Orbite</span>` : commandeAr(a, m)}</div>${a.lotOuvert ? '' : autresAr(m)}</div></section>
 <div class="cols"><section class="panneau"><div class="ph"><h3>Visites de la séance</h3></div>${rows.length ? `<div class="defile">${rows.map(r => `<div class="row e-row"><i class="m" style="background:${r.corrige ? 'var(--dif)' : 'var(--echo)'}"></i><span class="c">${esc(r.cut)}</span><span>${esc(r.texte)}</span><span class="s" style="text-align:right">${esc(r.duree)}</span></div>`).join('')}</div>` : '<div class="vide">Aucune visite pour l’instant.</div>'}</section></div>${maintAr(snap, a, 'echo')}`;
  }
  function revueAr(snap, a, m) {
    const V = a.verts || [];
    return `${enteteAr(snap, a, 'revue')}<div class="tete">${picto('revue')}<div><h2>Revue${a.partie != null ? ' · partie ' + esc(a.partie) : ''}</h2><div class="ar-sous">${esc(a.differes)} différés · ${esc(a.vertsNombre || 0)} verts à contrôler${a.vertsLigne ? ' · ' + esc(a.vertsLigne) : ''}</div></div></div>
 <p class="note-ar">Liste à consulter : ouvre chaque cut toi-même dans ESV. Cette version n’ouvre pas les cuts et ne garde pas de case « examiné ».</p>
 <div class="cols deux"><section class="panneau neutre"><div class="ph"><h3>Différés du lot</h3></div>${listeDiff(a, a.lotOuvert ? 'Aucun différé pour l’instant.' : 'Aucun différé.')}</section>
  <section class="panneau neutre"><div class="ph"><h3>Verts à contrôler</h3><span class="sp"></span><small>hors des cuts du lot</small></div>${V.length ? `<div class="defile">${V.map(v => `<div class="row v-row"><i class="m v"></i><span>${esc(v.libelle)}</span><span class="s" style="text-align:right">${esc(v.detail)}</span></div>`).join('')}</div>` : `<div class="vide">${a.lotOuvert ? 'Calculés à la fin du lot.' : 'Aucun vert suspect, ou liste pas encore calculée.'}</div>`}</section></div>`;
  }
  function reglagesAr(snap, a) {
    return `${enteteAr(snap, a, 'reglages')}<div class="tete">${picto('reglages')}<div><h2>Réglages et bilans</h2><div class="ar-sous">Gardés par Ariane ; les choix du lot valent pour le prochain lot.</div></div><span class="sp"></span><button type="button" class="pill sombre" data-act="legacy:export-tout">Exporter le dossier</button></div>
 <div class="cols"><section class="panneau"><div class="reg">${reglages(snap)}</div>${snap.exportTexte ? `<p class="note-ar">${esc(snap.exportTexte)}</p>` : ''}${snap.gcv2 ? `<p class="note-ar">GCV2 · exemples d’apprentissage : <b>${esc(snap.gcv2.total)}</b> cuts corrigés dans les Échos archivés, au ${esc(snap.gcv2.date)}. Ce n’est pas une mesure de qualité.</p>` : ''}</section></div>`;
  }
  function rendre(snap, ecran) {
    const a = snap.ar || { etat: 'pret', traites: 0, poses: 0, differes: 0, differesListe: [], parcours: [], verts: [] };
    const vue = ['accueil', 'orbite', 'echo', 'revue', 'reglages'].includes(ecran) ? ecran : 'accueil';
    const mode = vue === 'echo' ? 'native' : 'automatic';
    const m = modele({ ...snap, mode, boutons: mode === 'native' ? snap.boutonsEcho : snap.boutonsOrbite });
    const corps = { accueil: accueilAr, orbite: orbiteAr, echo: echoAr, revue: revueAr, reglages: reglagesAr }[vue](snap, a, m);
    return `<div class="app ar-${vue}${v2(snap) ? ' v2' : ''}${a.etat === 'pause' && vue === 'orbite' ? ' eteinte' : ''}" data-vue="${vue}"><div class="ecr">${corps}</div></div>`;
  }

  return { esc, modele, choisirBoutons, rendre };
});
