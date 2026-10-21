/* 4.9.5 test 10-ui : HABILLAGE DU PANNEAU, partie PURE (aucun DOM, aucun message, aucune API Chrome).
 *
 * Trois présentations du même panneau (« linear », « raycast », « figma ») dessinées à partir d'un INSTANTANÉ (voir src/ui5.js) :
 * l'état et les libellés que `panel.js` vient d'écrire dans sa propre page. L'habillage ne décide rien : le bouton principal, les
 * autres actions, les phrases viennent du panneau (la hiérarchie « La ligne », D-045) ; un clic sur l'habillage est un clic sur le
 * bouton d'origine (`data-act="legacy:<id>"`). Aucun export, aucun message au service worker, rien de neuf envoyé à ESV.
 *
 * Tout texte vient du panneau ou de ce fichier et passe par `esc` avant d'entrer dans le HTML. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api; else root.ArianeUi5Rendu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VARIANTES = ['ariane', 'linear', 'raycast', 'figma'];
  const NOMS = { ariane: 'Ariane', linear: 'Linear', raycast: 'Raycast', figma: 'Figma et Arc' };

  /* ------------------------------------------------------------------ modèle d'écran commun */
  /* Le bouton principal : celui que le panneau a désigné (`role: 'primary'`). Pendant la relecture, « Arrêter la relecture » (ou
   * « J'ai contrôlé le cut ») passe devant et l'export descend dans « Autres options » : on n'exporte pas avant la fin. */
  function choisirBoutons(boutons, mode) {
    const liste = (boutons || []).filter(b => b && b.id);
    const prioritaires = ['relecture-acquitter', 'relecture-arreter'];
    let primaire = null;
    if (mode === 'automatic') primaire = prioritaires.map(id => liste.find(b => b.id === id)).find(Boolean) || null;
    if (!primaire) primaire = liste.find(b => b.role === 'primary') || null;
    const autres = liste.filter(b => b !== primaire && b.id !== 'native-discard');
    return { primaire, autres };
  }

  function tonDe(snap) {
    const t = snap.mode === 'native' ? snap.echo?.ton : snap.lot?.ton;
    if (snap.notice?.erreur) return 'rouge';
    return t === 'red' ? 'rouge' : t === 'amber' ? 'ambre' : t === 'live' ? 'vert' : 'gris';
  }

  function phrase(snap) {
    if (snap.mode === 'home') return 'Choisis ce que tu veux faire dans ESV.';
    if (snap.mode === 'automatic') {
      if (snap.relecture?.interrompue) return snap.relecture.interrompue;
      if (snap.relecture?.ligne && snap.relecture.actif) return snap.relecture.ligne;
      if (snap.lot?.finPartie) return snap.lot.finPartie;
    }
    return snap.notice?.texte || '';
  }

  /* Ce que toutes les présentations montrent, calculé une fois. */
  function modele(snap) {
    const s = snap || {};
    const { primaire, autres } = choisirBoutons(s.boutons, s.mode);
    const echo = s.mode === 'native';
    const gros = echo ? (s.echo?.visites ?? '0') : (s.lot?.cut ?? '—');
    const petit = echo ? 'cuts vus' : 'cut';
    const etat = echo ? (s.echo?.etat || 'Aucune collecte') : (s.lot?.etat || 'Aucun lot');
    return {
      mode: s.mode, ton: tonDe(s), etat, phrase: phrase(s), primaire, autres, gros, petit,
      pct: Number.isFinite(s.lot?.pct) ? s.lot.pct : null,
      avancement: echo ? '' : (s.lot?.traites ? `${s.lot.traites} ${s.lot.traitesUnite || ''}`.trim() : ''),
      compteurs: echo ? [['Corrigés', String(s.echo?.corriges ?? 0), ''], ['Visites', String(s.echo?.visites ?? 0), '']] : (s.lot?.compteurs || []).map(c => [c.label, c.valeur, c.sous]),
      contexte: s.contexte || '', avis: s.avisContrat || '', connexionOuverte: !!s.connexionOuverte,
      exportTexte: s.exportTexte || '', gcv2: s.gcv2 || null,
      partie: s.partie ?? null, cutEsv: s.cutEsv ?? null,
    };
  }

  /* ------------------------------------------------------------------ morceaux communs */
  const bouton = (b, cls = '') => `<button type="button" class="${esc(cls)}${b.role === 'danger' ? ' danger' : ''}" data-act="legacy:${esc(b.id)}"${b.actif ? '' : ' disabled'}>${esc(b.texte)}</button>`;
  const ton2 = t => ({ vert: 'v', ambre: 'a', rouge: 'r', gris: 'n' }[t] || 'n');
  const touche = (...k) => k.map(x => `<kbd>${esc(x)}</kbd>`).join(' ');
  const gcv2Txt = g => g ? `${esc(g.total)}${g.session ? ` <span class="plus">+ ${esc(g.session)}</span>` : ''}` : '—';
  const pctTxt = m => m.pct === null ? '' : `${Math.round(m.pct)} %`;
  const barre = m => m.pct === null ? '' : `<div class="barre"><i style="width:${Math.max(0, Math.min(100, m.pct)).toFixed(1)}%"></i></div>`;

  /* Entrée « Orbite ou Écho » quand rien n'est choisi. */
  const choixMode = () => `<div class="modes"><button type="button" class="mode" data-act="mode:automatic"><b>Orbite</b><span>Ariane pose et valide les rails d'un lot ; tu suis.</span></button><button type="button" class="mode" data-act="mode:native"><b>Écho</b><span>Tu travailles dans ESV ; Ariane observe et enregistre.</span></button></div>`;

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
 ${ligne('Interface', 'La présentation du panneau.', sel('variante', [['ariane', 'Ariane'], ['ancienne', 'Ancien panneau']], snap.variante))}
 ${ligne('Détails techniques', 'Santé de la collecte, qualité de capture, départs des parties, résumé de la partie, journal du lot.', `<button type="button" class="btn" data-act="variante:ancienne">Ouvrir l’ancien panneau</button>`)}`;
  }

  const avisHtml = m => (m.avis ? `<div class="ban rouge"><span class="pt r"></span><div class="tx">${esc(m.avis)}</div></div>` : '')
    + (m.connexionOuverte ? `<div class="ban rouge"><span class="pt r"></span><div class="tx">ESV n’est pas connecté.<small>Recharge la page ESV (F5), puis reconnecte-toi dans Réglages.</small></div><button type="button" class="btn p" data-act="ecran:reglages">Connexion</button></div>` : '');

  /* ------------------------------------------------------------------ LINEAR */
  const STATUT = { cours: ['cours', 'En cours'], incertain: ['rouge', 'À contrôler'], differe: ['ambre', 'Différés'], pose: ['vert', 'Posés'], voie: ['vert', 'Posés par la voie'], saute: ['rouge', 'SKIP'], main: ['vert', 'Repris à la main'] };
  const ORDRE = ['cours', 'incertain', 'differe', 'saute', 'main', 'voie', 'pose'];
  /* Sélection : tant que rien n'est choisi (`ui.sel` nul), le cut en cours. */
  const selDe = (ui, n, defaut) => (ui.sel === null || ui.sel === undefined) ? defaut : Math.max(0, Math.min(Math.max(n - 1, 0), ui.sel));
  function lignesLinear(snap, ui) {
    const rows = snap.rows || [];
    const sel = selDe(ui, rows.length, 0);
    const parG = {};
    for (const r of rows) (parG[r.statut] = parG[r.statut] || []).push(r);
    let h = '', i = 0;
    for (const g of ORDRE) {
      const L = parG[g]; if (!L || !L.length) continue;
      const [ic, nom] = STATUT[g] || ['', g];
      h += `<div class="grp"><span class="ic ${ic}"></span>${esc(nom)} <span class="n">${L.length}</span></div>`;
      for (const r of L.slice(0, 60)) {
        h += `<div class="row${i === sel ? ' s' : ''}" data-row="${i}"><span class="ic ${ic}"></span><span class="c">${esc(r.cut)}</span><span class="t">${esc(r.texte)}</span><span class="m">${esc(r.ecart ?? '')}</span></div>`;
        i++;
      }
    }
    if (snap.aPoser > 0) h += `<div class="grp"><span class="ic"></span>À poser <span class="n">${esc(snap.aPoser)}</span></div>`;
    return { html: h, n: i };
  }
  function detailLinear(snap, m, ui) {
    const rows = [...(snap.rows || [])].sort((a, b) => ORDRE.indexOf(a.statut) - ORDRE.indexOf(b.statut));
    const r = rows[selDe(ui, rows.length, 0)] || null;
    const actions = [m.primaire, ...m.autres].filter(Boolean).slice(0, 4).map(b => `<button type="button" class="btn${b === m.primaire ? ' p' : ''}${b.role === 'danger' ? ' danger' : ''}" style="width:100%;margin-bottom:6px" data-act="legacy:${esc(b.id)}"${b.actif ? '' : ' disabled'}>${esc(b.texte)}</button>`).join('');
    return `<h3>${r ? 'Cut ' + esc(r.cut) : esc(m.gros)}</h3><p class="sub">${r ? esc((STATUT[r.statut] || [0, r.statut])[1]) : esc(m.etat)}</p>
 ${r ? `<dl><dt>Statut</dt><dd>${esc(r.texte)}</dd>${r.ecart ? `<dt>Écart à la voie</dt><dd class="mono">${esc(r.ecart)}</dd>` : ''}</dl>` : `<p class="sub">${esc(m.phrase)}</p>`}
 <div class="h">ACTIONS</div>${actions || '<p class="sub">Rien à faire pour l’instant.</p>'}`;
  }
  function rendreLinear(snap, ui, ecran) {
    const m = modele(snap);
    const ec = ecran === 'reglages';
    const nav = (act, ic, t, n) => `<div class="it${(act === 'mode:automatic' && m.mode === 'automatic' && !ec) || (act === 'mode:native' && m.mode === 'native' && !ec) || (act === 'ecran:reglages' && ec) ? ' a' : ''}" data-act="${act}">${ic} ${t}${n ? `<span class="n">${esc(n)}</span>` : ''}</div>`;
    const side = `<aside class="side"><div class="ws"><i></i>Ariane</div>${nav('mode:automatic', '▷', 'Orbite')}${nav('mode:native', '◌', 'Écho')}${nav('ecran:reglages', '⚙', 'Réglages')}
 <h4>Partie</h4><div class="it"><span class="ic ${m.ton === 'vert' ? 'cours' : m.ton === 'rouge' ? 'rouge' : ''}"></span>${m.partie != null ? 'Partie ' + esc(m.partie) : 'Aucune partie'}${m.avancement ? `<span class="n">${esc(m.avancement)}</span>` : ''}</div>
 <div class="pied">GCV2 · cuts appris<br><b>${gcv2Txt(m.gcv2)}</b>${m.gcv2?.date ? `<br><small>au ${esc(m.gcv2.date)}</small>` : ''}<br><span class="it" data-act="variante:ancienne" style="padding:6px 0">Ancien panneau</span></div></aside>`;
    if (ec) return `<div class="app sans-detail">${side}<section class="main"><div class="bar"><span class="fil"><b>Réglages</b></span><span class="sp"></span><button type="button" class="btn" data-act="ecran:seance">Retour <kbd>Échap</kbd></button></div><div class="reg">${reglages(snap)}</div></section></div>`;
    if (m.mode === 'home') return `<div class="app sans-detail">${side}<section class="main"><div class="bar"><span class="fil"><b>Ariane</b></span></div><div class="vide">${choixMode()}</div></section></div>`;
    const L = m.mode === 'automatic' ? lignesLinear(snap, ui) : { html: lignesEcho(snap, ui), n: (snap.echoRows || []).length };
    const prim = m.primaire ? bouton(m.primaire, 'btn p') + '' : '';
    const filtre = `<div class="filtres"><span class="chip a">${esc(m.etat)}</span>${m.compteurs.map(c => `<span class="chip">${esc(c[0])} <b>${esc(c[1])}</b></span>`).join('')}</div>`;
    const phr = `<div class="ban ${m.ton === 'rouge' ? 'rouge' : ''}"><span class="pt ${ton2(m.ton)}"></span><div class="tx">${esc(m.phrase)}</div>${m.pct !== null ? `<span class="mono">${esc(pctTxt(m))}</span>` : ''}</div>`;
    const liste = L.n || L.html ? L.html : `<div class="vide2">Aucun cut dans ce lot pour l’instant.</div>`;
    return `<div class="app">${side}<section class="main"><div class="bar"><span class="fil">${m.mode === 'native' ? 'Écho' : 'Orbite'} / <b>${m.partie != null ? 'Partie ' + esc(m.partie) : '—'}</b></span><span class="sp"></span>${prim}<button type="button" class="btn" data-act="palette">Commandes <kbd>Ctrl K</kbd></button></div>${avisHtml(m)}${phr}${barre(m)}${filtre}<div class="liste">${liste}</div></section><aside class="det">${detailLinear(snap, m, ui)}</aside>${palette(snap, m, ui)}</div>`;
  }
  function lignesEcho(snap, ui) {
    const rows = snap.echoRows || [];
    const sel = selDe(ui, rows.length, 0);
    if (!rows.length) return '<div class="vide2">Aucune visite pour l’instant.</div>';
    return `<div class="grp"><span class="ic vert"></span>Visites <span class="n">${rows.length}</span></div>` + rows.map((r, i) => `<div class="row${i === sel ? ' s' : ''}" data-row="${i}"><span class="ic ${r.corrige ? 'ambre' : 'vert'}"></span><span class="c">${esc(r.cut)}</span><span class="t">${esc(r.texte)}</span><span class="m">${esc(r.duree)}</span></div>`).join('');
  }

  /* ------------------------------------------------------------------ palette de commandes (Linear et Raycast) */
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function commandes(snap, m) {
    const c = [];
    const ICONE = { pause: '❚❚', resume: '↻', stop: '■', 'start-batch': '▶', 'native-start': '▶', 'native-pause': '❚❚', 'native-resume': '↻', 'native-end': '■', 'export-tout': '⧉', 'native-download': '⧉', retry: '↻', 'close-uncertain': '✓', 'new-batch': '▶', 'relecture-arreter': '■', 'relecture-lancer': '▶', 'relecture-acquitter': '✓', 'explicit-skip': '⤼', 'manual-takeover': '✋', 'manual-completion': '✓' };
    if (m.primaire) c.push({ icone: ICONE[m.primaire.id] || '▶', nom: m.primaire.texte, type: 'Commande', act: 'legacy:' + m.primaire.id, ton: 'v', actif: m.primaire.actif });
    for (const b of m.autres) c.push({ icone: ICONE[b.id] || '•', nom: b.texte, type: 'Commande', act: 'legacy:' + b.id, ton: b.role === 'danger' ? 'r' : 'n', actif: b.actif });
    if (m.mode !== 'automatic') c.push({ icone: '▷', nom: 'Passer en Orbite', sous: 'Ariane pose le lot', type: 'Vue', act: 'mode:automatic', ton: 'b', actif: true });
    if (m.mode !== 'native') c.push({ icone: '◌', nom: 'Passer en Écho', sous: 'tu corriges toi-même', type: 'Vue', act: 'mode:native', ton: 'b', actif: true });
    const r = snap.reglages || {};
    c.push({ icone: '⚙', nom: 'Après le lot', sous: { coupee: 'rien', ombre: 'relire sans modifier', corriger: 'relire et corriger' }[r.relecture] || '', type: 'Réglage', act: 'ecran:reglages', ton: 'n', actif: true });
    c.push({ icone: '⚙', nom: 'Réglages', type: 'Vue', act: 'ecran:reglages', ton: 'n', actif: true });
    c.push({ icone: '☰', nom: 'Détails techniques (ancien panneau)', type: 'Vue', act: 'variante:ancienne', ton: 'p', actif: true });
    return c.filter(x => x.actif !== false || x.act.startsWith('legacy:'));
  }
  function filtrer(cmds, q) { const n = norm(q).trim(); return n ? cmds.filter(c => norm(c.nom + ' ' + (c.sous || '')).includes(n)) : cmds; }
  function palette(snap, m, ui) {
    if (!ui.palette) return '';
    const L = filtrer(commandes(snap, m), ui.q);
    const i = Math.max(0, Math.min(L.length - 1, ui.pi || 0));
    return `<div class="pal on" data-act="palette:fermer"><div class="bx" data-stop="1"><input id="ui5-q" value="${esc(ui.q)}" placeholder="Que veux-tu faire ?" autocomplete="off"><div class="l">${L.length ? L.map((c, k) => `<div class="o${k === i ? ' s' : ''}" data-act="${esc(c.act)}" data-fermer="1"><span class="t ${esc(c.ton)}">${esc(c.icone)}</span><span class="nm">${esc(c.nom)}</span>${c.sous ? `<span class="sb">${esc(c.sous)}</span>` : ''}<span class="ty">${esc(c.type)}</span></div>`).join('') : '<div class="o"><span class="nm">Aucune commande</span></div>'}</div></div></div>`;
  }

  /* ------------------------------------------------------------------ RAYCAST */
  function rendreRaycast(snap, ui, ecran) {
    const m = modele(snap);
    const ec = ecran === 'reglages';
    const tag = ec ? 'Réglages' : m.mode === 'native' ? `Écho${m.partie != null ? ' · partie ' + esc(m.partie) : ''}` : m.mode === 'automatic' ? `Orbite${m.partie != null ? ' · partie ' + esc(m.partie) : ''}` : 'Ariane';
    let liste, meta = '', pied;
    if (ec) { liste = `<div class="reg">${reglages(snap)}</div>`; pied = `<span class="ac" data-act="ecran:seance">Retour ${touche('Échap')}</span>`; }
    else {
      const cmds = filtrer(commandes(snap, m), ui.q);
      const i = Math.max(0, Math.min(cmds.length - 1, ui.pi || 0));
      const ligne = (c, k) => `<div class="o${k === i ? ' s' : ''}" data-act="${esc(c.act)}"><span class="t ${esc(c.ton)}">${esc(c.icone)}</span><span class="nm">${esc(c.nom)}</span>${c.sous ? `<span class="sb">${esc(c.sous)}</span>` : ''}<span class="ty">${esc(c.type)}</span></div>`;
      const sug = cmds.filter(c => c.type === 'Commande'), autres = cmds.filter(c => c.type !== 'Commande');
      let k = 0;
      liste = (m.mode === 'home' ? choixMode() : '') + (sug.length ? `<div class="g">${ui.q ? 'Résultats' : 'Suggestions'}</div>` + sug.map(c => ligne(c, k++)).join('') : '') + (autres.length ? `<div class="g">Vues et réglages</div>` + autres.map(c => ligne(c, k++)).join('') : '');
      const kv = m.compteurs.map(c => `<div class="kv"><span>${esc(c[0])}</span><span>${esc(c[1])}</span></div>`).join('');
      meta = `<div class="ti${m.ton === 'rouge' ? ' rouge' : ''}">${esc(m.etat)}</div><div class="big">${esc(m.gros)}</div>${barre(m).replace('class="barre"', 'class="bm"')}<div class="phr">${esc(m.phrase)}</div>${kv}${m.exportTexte ? `<div class="kv"><span>Export</span><span>${esc(m.exportTexte.slice(0, 80))}</span></div>` : ''}`;
      const cmd = cmds[i];
      pied = `<span class="ac" data-act="${cmd ? esc(cmd.act) : ''}">${esc(cmd ? cmd.nom : '')} ${touche('↵')}</span>`;
    }
    return `<div class="bureau"><div class="ray"><div class="q"><span class="rt"><i></i>${tag}</span><input id="ui5-q" placeholder="Que veux-tu faire ?" value="${esc(ui.q)}" autocomplete="off"><span class="ld${m.ton === 'vert' && m.mode !== 'home' ? ' on' : ''}"></span></div>${avisHtml(m)}<div class="corps${meta ? '' : ' seul'}"><div class="l">${liste}</div>${meta ? `<div class="meta">${meta}</div>` : ''}</div><div class="pied"><span class="lg"></span><span class="sp"></span>${pied}<span class="sep"></span><span class="ac" data-act="ecran:${ec ? 'seance' : 'reglages'}">${ec ? 'Séance' : 'Réglages'}</span><span class="sep"></span><span class="ac" data-act="variante:ancienne">Ancien panneau</span></div></div></div>`;
  }

  /* ------------------------------------------------------------------ FIGMA ET ARC */
  const CELLE = { cours: 'now', incertain: 'bad', differe: 'd', pose: 'p', voie: 'q', saute: 'bad', main: 'p' };
  function ruban(snap, ui) {
    const rows = [...(snap.rows || [])].sort((a, b) => a.ordre - b.ordre);
    const sel = selDe(ui, rows.length, Math.max(0, rows.findIndex(r => r.statut === 'cours' || r.statut === 'incertain')));
    const cells = rows.map((r, i) => ({ c: CELLE[r.statut] || 'r', cut: r.cut, i }));
    const reste = Math.max(0, Math.min(400, Number(snap.aPoser) || 0));
    for (let k = 0; k < reste; k++) cells.push({ c: 'r', cut: null, i: cells.length });
    if (!cells.length) return '<div class="vide2">Le ruban se remplira dès le premier cut du lot.</div>';
    const lignes = []; for (let i = 0; i < cells.length; i += 40) lignes.push(cells.slice(i, i + 40));
    return lignes.map((l, k) => `<div class="rub"><div class="lbl">${esc(l.find(x => x.cut != null)?.cut ?? '')}${l.some(x => x.cut == null) ? ' …' : ''}</div><div class="cells">${l.map(x => `<div class="cell ${x.c}${x.i === sel ? ' sel' : ''}" data-row="${x.i}" title="${x.cut != null ? 'cut ' + esc(x.cut) : 'à poser'}"></div>`).join('')}</div></div>`).join('')
      + `<div class="mini">${cells.map(x => `<i class="${x.c}"></i>`).join('')}</div>`;
  }
  function rendreFigma(snap, ui, ecran) {
    const m = modele(snap);
    const ec = ecran === 'reglages';
    const esp = (act, c, t, n, a) => `<div class="espace${a ? ' a' : ''}" data-act="${act}"><i class="pt" style="background:${c}"></i>${t}<small>${esc(n || '')}</small></div>`;
    const side = `<aside class="esp"><div class="logo">ARIANE</div><h4>Espaces</h4>${esp('mode:automatic', 'var(--vert)', 'Orbite' + (m.partie != null && m.mode === 'automatic' ? ' · P' + esc(m.partie) : ''), m.avancement, m.mode === 'automatic' && !ec)}${esp('mode:native', 'var(--bleu)', 'Écho', m.mode === 'native' ? String(snap.echo?.visites ?? '') : '', m.mode === 'native' && !ec)}<h4>Vues</h4>${esp('ecran:reglages', 'var(--tx3)', '⚙ Réglages', '', ec)}${esp('variante:ancienne', 'var(--tx3)', '☰ Ancien panneau', '')}<div class="bas">GCV2 · cuts appris<br><b>${gcv2Txt(m.gcv2)}</b>${m.gcv2?.date ? `<br><small>au ${esc(m.gcv2.date)}</small>` : ''}</div></aside>`;
    if (ec) return `<div class="app">${side}<section class="cv"><div class="tools"><span class="sp"></span><button type="button" class="btn" data-act="ecran:seance">Retour <kbd>Échap</kbd></button></div><div class="toile reg">${reglages(snap)}</div></section><aside class="insp"></aside></div>`;
    if (m.mode === 'home') return `<div class="app">${side}<section class="cv"><div class="tools"></div><div class="toile">${choixMode()}</div></section><aside class="insp"></aside></div>`;
    const prim = m.primaire ? bouton(m.primaire, 'btn p') : '';
    const rows = [...(snap.rows || [])].sort((a, b) => a.ordre - b.ordre);
    const selF = selDe(ui, rows.length, Math.max(0, rows.findIndex(x => x.statut === 'cours' || x.statut === 'incertain')));
    const r = rows[selF] || null;
    const corps = m.mode === 'automatic' ? `<div class="leg2"><span><i class="p"></i>posé</span><span><i class="q"></i>posé par la voie</span><span><i class="d"></i>différé</span><span><i class="now"></i>en cours</span><span><i class="r"></i>à poser</span></div>${ruban(snap, ui)}`
      : `<div class="echo-gros"><div class="big">${esc(m.gros)}</div><div>${esc(m.petit)}</div></div><div class="rub"><div class="cells">${(snap.echoRows || []).slice(0, 120).map((x, i) => `<div class="cell ${x.corrige ? 'd' : 'p'}${i === selDe(ui, (snap.echoRows || []).length, 0) ? ' sel' : ''}" data-row="${i}" title="cut ${esc(x.cut)}"></div>`).join('')}</div></div>`;
    const insp = `<h3>${r && m.mode === 'automatic' ? 'Cut ' + esc(r.cut) : esc(m.gros)}</h3><p class="sub">${r && m.mode === 'automatic' ? esc((STATUT[r.statut] || [0, r.statut])[1]) : esc(m.etat)}</p>${m.pct !== null ? `<div class="big">${esc(pctTxt(m))}</div><div class="sub">${esc(m.avancement)}</div>` : ''}<div class="sec"><h5>${r && m.mode === 'automatic' ? 'CE CUT' : m.mode === 'native' ? 'CETTE SÉANCE' : 'CE LOT'}</h5>${r && m.mode === 'automatic' ? `<div class="kv"><span>Statut</span><span>${esc(r.texte)}</span></div>${r.ecart ? `<div class="kv"><span>Écart à la voie</span><span class="mono">${esc(r.ecart)}</span></div>` : ''}` : m.compteurs.map(c => `<div class="kv"><span>${esc(c[0])}</span><b>${esc(c[1])}</b></div>`).join('')}</div><div class="sec"><h5>ACTIONS</h5>${[m.primaire, ...m.autres].filter(Boolean).slice(0, 5).map(b => `<button type="button" class="btn${b === m.primaire ? ' p' : ''}${b.role === 'danger' ? ' danger' : ''}" style="width:100%;margin-bottom:6px" data-act="legacy:${esc(b.id)}"${b.actif ? '' : ' disabled'}>${esc(b.texte)}</button>`).join('') || '<p class="sub">Rien à faire pour l’instant.</p>'}</div>`;
    return `<div class="app">${side}<section class="cv"><div class="tools"><span class="etat-t ${m.ton}">${esc(m.etat)}</span><span class="sp"></span>${prim}</div>${avisHtml(m)}<div class="ban ${m.ton === 'rouge' ? 'rouge' : ''}"><span class="pt ${ton2(m.ton)}"></span><div class="tx">${esc(m.phrase)}</div></div><div class="toile">${corps}</div></section><aside class="insp">${insp}</aside></div>`;
  }

  /* ------------------------------------------------------------------ ARIANE (4.9.6 test 1, maquettes/ui-5.0/M-accueil.html)
   * Accueil à vignettes, puis Orbite, Écho, Revue. Les chiffres viennent de `snap.ar` (calculé par src/ui5.js à partir de l'état du
   * panneau, définitions de fiches/UI_ETATS_COMPTEURS.md) ; les commandes sont les boutons d'origine du panneau (`legacy:<id>`), dans
   * la hiérarchie qu'il a choisie. Rien d'autre n'est commandé. */
  const PICTO = {
    orbite: '<circle cx="12" cy="12" r="2.6"/><ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(-25 12 12)"/>',
    echo: '<path d="M12 12h.01"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
    revue: '<path d="M5 6h9M5 12h6M5 18h9"/><path d="M15 12l2.2 2.2L21 10"/>', reglages: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  };
  const CLP = { orbite: 'o', echo: 'e', revue: 'r', reglages: 'b' };
  const picto = n => `<span class="picto ${CLP[n]}"><svg viewBox="0 0 24 24" aria-hidden="true">${PICTO[n]}</svg></span>`;
  const IC = {
    pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
    play: '<path d="M7 5l12 7-12 7z" fill="currentColor"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    alerte: '<path d="M12 4l9 16H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  };
  const ic = (n, s = 15) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${IC[n]}</svg>`;
  const nb = v => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null;
  /* Pastille d'état du lot : la forme dit l'état (roue, roue en pointillé, deux barres, coche, triangle). */
  const PASTILLE = { pret: ['pret', 'Prêt'], cours: ['cours', 'Orbite en cours'], dem: ['dem', 'Pause demandée'], pause: ['pause', 'En pause'], alerte: ['alerte', 'À toi'], fini: ['fini', 'Lot terminé'], arrete: ['fini', 'Lot arrêté'] };
  const pastille = a => { const [c, t] = a.horsLigne && a.etat === 'pret' ? ['hors', 'Aucun onglet ESV'] : (PASTILLE[a.etat] || PASTILLE.pret); return `<span class="etat ${c}"><span class="f"></span>${esc(a.etatTexte || t)}</span>`; };
  const COUL = { orbite: 'var(--orbite)', echo: 'var(--echo)', revue: 'var(--revue)' };
  const barreAr = (a, vive) => {
    if (!a.cibles) return '';
    const p = x => Math.max(0, Math.min(100, x / a.cibles * 100)).toFixed(2);
    return `<div class="barre" role="img" aria-label="${esc(a.poses)} posés et ${esc(a.differes)} différés sur ${esc(a.cibles)}" style="--fin:${p(a.poses + a.differes)}%"><i style="width:${p(a.poses)}%;background:#fff"></i><i style="width:${p(a.differes)}%;background:var(--dif)"></i>${vive ? '<span class="lueur"></span>' : ''}</div>`;
  };
  function enteteAr(a, courant) {
    const ong = [['accueil', 'Accueil'], ['orbite', 'Orbite'], ['echo', 'Écho'], ['revue', 'Revue']].map(([k, t]) => `<button type="button" data-act="aller:${k}" aria-current="${k === courant}">${COUL[k] ? `<i style="background:${COUL[k]}"></i>` : ''}${t}</button>`).join('');
    const mini = (a.etat === 'cours' || a.etat === 'dem') && !['orbite', 'accueil'].includes(courant)
      ? `<span class="mini"><button type="button" data-act="aller:orbite"><span class="spin"></span>Orbite · ${esc(a.traites)}${a.cibles ? ' / ' + esc(a.cibles) : ''}</button>${a.pause ? `<button type="button" class="mini-p" data-act="pause" aria-label="Pause du lot"${a.pause.actif && a.etat !== 'dem' ? '' : ' disabled'}>${ic('pause', 13)}</button>` : ''}</span>` : '';
    const esv = a.esv === 'ko' ? '<span class="esv ko"><i></i>ESV ne répond plus</span>' : a.esv === 'ok' ? '<span class="esv"><i></i>ESV répond</span>' : '<span class="esv non"><i></i>ESV non connecté</span>';
    return `<header class="haut"><span class="marque"><svg viewBox="0 0 26 26" width="24" height="24" aria-hidden="true"><path d="M3 22C8 4 18 4 23 22" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M7 22C10 11 16 11 19 22" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/></svg>Ariane</span><nav class="onglets" aria-label="Activités">${ong}</nav><span class="sp"></span>${mini}${esv}<button type="button" class="ico${courant === 'reglages' ? ' a' : ''}" data-act="aller:reglages" aria-label="Réglages" title="Réglages">${picto('reglages').replace('picto b', 'picto nu')}</button></header>`;
  }
  /* Commande principale : celle du panneau ; pendant une pause demandée, elle reste en place, grisée. */
  function commandeAr(a, m, cls = 'pill') {
    if (a.etat === 'dem') return `<button type="button" class="${cls}" id="ar-cmd" disabled><span class="ar-lbl"><span class="spin"></span>Pause demandée…</span></button>`;
    const p = m.primaire; if (!p) return '';
    const icone = /pause/.test(p.id) ? ic('pause') : /resume|start|lancer/.test(p.id) ? ic('play') : '';
    return `<button type="button" class="${cls}${p.role === 'danger' ? ' danger' : ''}" id="ar-cmd" data-act="${p.id === 'pause' ? 'pause' : 'legacy:' + esc(p.id)}"${p.actif ? '' : ' disabled'}><span class="ar-lbl">${icone}${esc(p.texte)}</span></button>`;
  }
  const autresAr = m => m.autres.some(b => b.actif) ? `<div class="autres">${m.autres.filter(b => b.actif).map(b => `<button type="button" class="pill sombre petit${b.role === 'danger' ? ' danger' : ''}" data-act="legacy:${esc(b.id)}"${b.actif ? '' : ' disabled'}>${esc(b.texte)}</button>`).join('')}</div>` : '';
  function alerteAr(snap, m) {
    const t = [m.avis, m.connexionOuverte ? 'ESV n’est pas connecté. Recharge la page ESV (F5) si elle est figée, puis reconnecte-la dans Réglages.' : '', snap.notice?.erreur ? snap.notice.texte : '', snap.relecture?.interrompue || ''].filter(Boolean);
    return t.length ? `<div class="alerte" role="alert">${ic('alerte', 20)}<div>${t.map(x => `<p>${esc(x)}</p>`).join('')}</div></div>` : '';
  }
  function accueilAr(snap, a, m) {
    const titre = a.partie != null ? `Partie ${esc(a.partie)}` : 'Aucune partie ouverte';
    const phrase = a.etat === 'cours' ? `Orbite pose le cut ${esc(a.cours ?? '…')}. Ne change pas de cut dans ESV pendant le lot.`
      : a.etat === 'dem' ? `Orbite finit le cut ${esc(a.cours ?? '…')}, puis s’arrête.`
      : a.etat === 'pause' ? `Lot en pause${a.dernier != null ? `, après le cut ${esc(a.dernier)}` : ''}.${a.restants != null ? ` Il reste ${esc(a.restants)} cuts.` : ''}`
      : a.etat === 'alerte' ? (a.alerte || m.phrase || 'Le lot attend ta décision.')
      : a.etat === 'fini' || a.etat === 'arrete' ? `${esc(a.traites)} cuts traités.${a.aExaminer ? ` ${esc(a.aExaminer)} cuts restent à examiner.` : ''}`
      : a.partie != null ? 'Lance un lot Orbite, ou ouvre Écho pour corriger toi-même.' : 'Ouvre une partie dans ESV ; Ariane la reconnaîtra.';
    const enLot = a.etat === 'cours' || a.etat === 'dem';
    const bts = enLot ? `<button type="button" class="pill" data-act="aller:orbite" data-vers="orbite">Suivre le lot</button>${a.pause ? `<button type="button" class="pill verre" data-act="pause"${a.etat === 'dem' || !a.pause.actif ? ' disabled' : ''}>${ic('pause')}${a.etat === 'dem' ? 'Pause demandée…' : 'Pause'}</button>` : ''}`
      : a.etat === 'fini' || a.etat === 'arrete' ? `${a.aExaminer ? `<button type="button" class="pill" data-act="aller:revue">Examiner les ${esc(a.aExaminer)} cuts</button>` : ''}<button type="button" class="pill${a.aExaminer ? ' verre' : ''}" data-act="legacy:export-tout">Exporter le dossier</button>`
      : a.etat === 'pause' && a.reprendre ? `<button type="button" class="pill" data-act="legacy:resume"${a.reprendre.actif ? '' : ' disabled'}>${ic('play')}${esc(a.reprendre.texte || 'Reprendre')}</button><button type="button" class="pill verre" data-act="aller:orbite">Voir le lot</button>`
      : `<button type="button" class="pill" data-act="aller:orbite" data-vers="orbite">${ic('play')}${a.etat === 'alerte' ? 'Voir le lot' : 'Ouvrir Orbite'}</button><button type="button" class="pill verre" data-act="aller:echo" data-vers="echo">Ouvrir Écho</button>`;
    const don = a.traites || a.cibles ? `<div class="l1"><span>Avancement du lot</span></div><div class="n">${esc(a.traites)} <span>${a.cibles ? `sur ${esc(a.cibles)} cuts traités` : 'cuts traités'}</span></div><div class="d"><span><i class="m p"></i>${esc(a.poses)} posés</span><span><i class="m d"></i>${esc(a.differes)} différés</span></div>${barreAr(a, a.etat === 'cours')}`
      : `<div class="l1"><span>Ce qu’Ariane sait de la partie</span></div><div class="n">${a.cutEsv != null ? esc(a.cutEsv) : '—'} <span>cut affiché dans ESV</span></div>`;
    const vig = (k, cls, titreV, sous, st, indispo) => `<button type="button" class="vig ${cls}${indispo ? ' indispo' : ''}" ${indispo ? 'aria-disabled="true"' : `data-act="aller:${k}"`} data-k="${k}">${picto(k)}<span class="tx"><b>${titreV}</b><small>${sous}</small><span class="st">${st}</span></span><span class="fl"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span></button>`;
    const stO = { cours: `En cours · cut ${esc(a.cours ?? '…')}`, dem: 'Pause demandée', pause: 'En pause', alerte: 'Attend ta décision', fini: 'Terminé', arrete: 'Arrêté', pret: 'Prêt' }[a.etat] || 'Prêt';
    const stE = a.lotOuvert ? `${ic('lock', 12)} Indisponible pendant le lot` : esc(a.echoEtat || 'Prêt');
    const nbRevue = a.differes + (a.vertsNombre || 0);
    return `${enteteAr(a, 'accueil')}<section class="une"><div class="in"><div>${pastille(a)}<h2>${titre}</h2><p>${phrase}</p><div class="bts">${bts}</div></div><div class="donnee">${don}</div></div></section>${alerteAr(snap, m)}
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
    const titre = { cours: 'Pose des rails', dem: 'Pose des rails', pause: 'Lot en pause', alerte: 'Le lot attend', fini: 'Lot terminé', arrete: 'Lot arrêté', pret: 'Prêt à poser' }[a.etat] || 'Orbite';
    const bornes = a.bornes ? `du cut ${esc(a.bornes.debut ?? '…')} ${a.bornes.fin ? 'au cut ' + esc(a.bornes.fin) : 'à la fin de la partie'}` : '';
    const phrase = enLot ? 'Ariane pose et valide chaque cut, puis passe au suivant. Pendant le lot, ne change pas de cut dans ESV.'
      : a.etat === 'pret' ? 'Ariane posera les rails de chaque cut invalide, puis passera au suivant. Les bornes sont remplies avec le cut affiché dans ESV.'
      : a.etat === 'pause' ? 'Le lot reprendra au cut suivant, sans repasser sur ceux déjà validés.'
      : (a.etat === 'fini' || a.etat === 'arrete') ? (a.aExaminer ? `Il reste ${esc(a.aExaminer)} cuts à examiner dans la Revue.` : 'Rien ne reste à examiner pour ce lot.') : (a.alerte || m.phrase || '');
    const ligne = a.etat === 'dem' ? `<span class="spin"></span><span>Ariane finit le <b>cut ${esc(a.cours ?? '…')}</b>, puis s’arrête. Aucun nouveau cut ne sera ouvert.</span>`
      : a.etat === 'cours' ? `<span class="spin"></span><span>Pose en cours sur le <b>cut ${esc(a.cours ?? '…')}</b></span>`
      : a.dernier != null ? `<span>Dernière validation : <b>cut ${esc(a.dernier)}</b></span>` : `<span>${esc(m.etat)}</span>`;
    const bornesEdit = a.etat === 'pret' ? `<div class="bornes"><label>Premier cut<input type="number" min="0" data-borne="start" value="${esc(a.bornes?.debut ?? '')}"></label><label>Dernier cut<input type="number" min="0" data-borne="end" placeholder="fin de partie" value="${esc(a.bornes?.fin ?? '')}"></label></div>` : '';
    const suivi = `<div class="suivi"><div class="n"><b>${esc(a.traites)}</b> <span>${a.cibles ? `sur ${esc(a.cibles)} cuts traités` : 'cuts traités'}</span></div>
   <div class="d"><span><i class="m p"></i>${esc(a.poses)} posés</span><span><i class="m d"></i>${esc(a.differes)} différés</span>${a.restants != null ? `<span class="r">${esc(a.restants)} restants</span>` : ''}</div>
   ${barreAr(a, a.etat === 'cours')}<div class="cour">${ligne}</div>${bornesEdit}<div class="act">${examiner ? `<button type="button" class="pill" data-act="aller:revue">Examiner les ${esc(a.aExaminer)} cuts</button>` : commandeAr(a, m)}</div>${autresAr(examiner && m.primaire ? { autres: [m.primaire, ...m.autres] } : m)}</div>`;
    return `${enteteAr(a, 'orbite')}<section class="scene"><div><div class="ar-nom">${picto('orbite')}<b>Orbite</b><span>${a.partie != null ? '· partie ' + esc(a.partie) : ''}</span></div>
   <h2>${titre}</h2><div class="phr">${pastille(a)}<span class="bo">${bornes}</span></div><p>${esc(phrase)}</p>${alerteAr(snap, m)}</div>${suivi}</section>
 ${parcoursAr(a)}<div class="cols"><section class="panneau"><div class="ph"><h3>Différés de ce lot</h3><span class="sp"></span><small>${enLot ? 'à reprendre après le lot' : 'à reprendre'}</small></div>${listeDiff(a, 'Aucun différé pour l’instant.')}</section></div>`;
  }
  function echoAr(snap, a, m) {
    const rows = snap.echoRows || [];
    return `${enteteAr(a, 'echo')}<section class="scene"><div><div class="ar-nom">${picto('echo')}<b>Écho</b><span>${a.partie != null ? '· partie ' + esc(a.partie) : ''}</span></div>
   <h2>Tu corriges,<br>Écho garde les exemples</h2><p>Chaque correction que tu fais dans ESV est gardée comme exemple pour un prochain modèle, avec la raison si tu en donnes une.</p>${alerteAr(snap, m)}</div>
  <div class="suivi"><div class="n"><b>${esc(snap.echo?.corriges ?? 0)}</b> <span>corrections dans cette séance</span></div><div class="d"><span>${esc(snap.echo?.visites ?? 0)} cuts vus</span><span class="r">${esc(a.echoEtat || '')}</span></div>
   <div class="act">${a.lotOuvert ? `<span class="etat">${ic('lock', 13)} Indisponible pendant un lot Orbite</span>` : commandeAr(a, m)}</div>${a.lotOuvert ? '' : autresAr(m)}</div></section>
 <div class="cols"><section class="panneau"><div class="ph"><h3>Visites de la séance</h3></div>${rows.length ? `<div class="defile">${rows.map(r => `<div class="row e-row"><i class="m" style="background:${r.corrige ? 'var(--dif)' : 'var(--echo)'}"></i><span class="c">${esc(r.cut)}</span><span>${esc(r.texte)}</span><span class="s" style="text-align:right">${esc(r.duree)}</span></div>`).join('')}</div>` : '<div class="vide">Aucune visite pour l’instant.</div>'}</section></div>`;
  }
  function revueAr(snap, a, m) {
    const V = a.verts || [];
    return `${enteteAr(a, 'revue')}<div class="tete">${picto('revue')}<div><h2>Revue${a.partie != null ? ' · partie ' + esc(a.partie) : ''}</h2><div class="ar-sous">${esc(a.differes)} différés · ${esc(a.vertsNombre || 0)} verts à contrôler${a.vertsLigne ? ' · ' + esc(a.vertsLigne) : ''}</div></div></div>
 <p class="note-ar">Liste à consulter : ouvre chaque cut toi-même dans ESV. Cette version n’ouvre pas les cuts et ne garde pas de case « examiné ».</p>
 <div class="cols deux"><section class="panneau neutre"><div class="ph"><h3>Différés du lot</h3></div>${listeDiff(a, a.lotOuvert ? 'Aucun différé pour l’instant.' : 'Aucun différé.')}</section>
  <section class="panneau neutre"><div class="ph"><h3>Verts à contrôler</h3><span class="sp"></span><small>hors des cuts du lot</small></div>${V.length ? `<div class="defile">${V.map(v => `<div class="row v-row"><i class="m v"></i><span>${esc(v.libelle)}</span><span class="s" style="text-align:right">${esc(v.detail)}</span></div>`).join('')}</div>` : `<div class="vide">${a.lotOuvert ? 'Calculés à la fin du lot.' : 'Aucun vert suspect, ou liste pas encore calculée.'}</div>`}</section></div>`;
  }
  function reglagesAr(snap, a) {
    return `${enteteAr(a, 'reglages')}<div class="tete">${picto('reglages')}<div><h2>Réglages et bilans</h2><div class="ar-sous">Gardés par Ariane ; les choix du lot valent pour le prochain lot.</div></div><span class="sp"></span><button type="button" class="pill sombre" data-act="legacy:export-tout">Exporter le dossier</button></div>
 <div class="cols"><section class="panneau"><div class="reg">${reglages(snap)}</div>${snap.exportTexte ? `<p class="note-ar">${esc(snap.exportTexte)}</p>` : ''}${snap.gcv2 ? `<p class="note-ar">GCV2 · exemples d’apprentissage : <b>${esc(snap.gcv2.total)}</b> cuts corrigés dans les Échos archivés, au ${esc(snap.gcv2.date)}. Ce n’est pas une mesure de qualité.</p>` : ''}</section></div>`;
  }
  function rendreAriane(snap, ui, ecran) {
    const a = snap.ar || { etat: 'pret', traites: 0, poses: 0, differes: 0, differesListe: [], parcours: [], verts: [] };
    const vue = ['accueil', 'orbite', 'echo', 'revue', 'reglages'].includes(ecran) ? ecran : 'accueil';
    const mode = vue === 'echo' ? 'native' : 'automatic';
    const m = modele({ ...snap, mode, boutons: mode === 'native' ? (snap.boutonsEcho || snap.boutons) : (snap.boutonsOrbite || snap.boutons) });
    const corps = { accueil: accueilAr, orbite: orbiteAr, echo: echoAr, revue: revueAr, reglages: reglagesAr }[vue](snap, a, m);
    return `<div class="app ar-${vue}${a.etat === 'pause' && vue === 'orbite' ? ' eteinte' : ''}" data-vue="${vue}"><div class="ecr">${corps}</div></div>`;
  }

  const RENDUS = { linear: rendreLinear, raycast: rendreRaycast, figma: rendreFigma, ariane: rendreAriane };
  function rendre(variante, snap, ui, ecran) { const f = RENDUS[variante]; return f ? f(snap, ui || { sel: null, palette: false, q: '', pi: 0 }, ecran || 'seance') : ''; }

  return { esc, VARIANTES, NOMS, modele, choisirBoutons, commandes, filtrer, rendre, norm, STATUT, ORDRE };
});
