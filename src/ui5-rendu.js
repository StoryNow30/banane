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
  const VARIANTES = ['linear', 'raycast', 'figma'];
  const NOMS = { linear: 'Linear', raycast: 'Raycast', figma: 'Figma et Arc' };

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
 ${ligne('Interface', 'Les quatre présentations du panneau.', sel('variante', [['linear', 'Linear'], ['raycast', 'Raycast'], ['figma', 'Figma et Arc'], ['ancienne', 'Ancien panneau']], snap.variante))}
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

  const RENDUS = { linear: rendreLinear, raycast: rendreRaycast, figma: rendreFigma };
  function rendre(variante, snap, ui, ecran) { const f = RENDUS[variante]; return f ? f(snap, ui || { sel: null, palette: false, q: '', pi: 0 }, ecran || 'seance') : ''; }

  return { esc, VARIANTES, NOMS, modele, choisirBoutons, commandes, filtrer, rendre, norm, STATUT, ORDRE };
});
