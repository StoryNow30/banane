/* UI 5.0 « Signal » (D-250) : HABILLAGE DU PANNEAU, partie PURE (aucun DOM, aucun message, aucune API Chrome).
 *
 * La présentation par défaut du panneau, d'après la maquette maquettes/ui-5.0/Q-signal.html et le fichier Figma « Ariane 5.0 » :
 * une barre (logo, bascule Orbite / Écho, puce de l'onglet ESV, commandes, réglages), l'INSTRUMENT (glyphe et mot d'état, une phrase,
 * l'objet — rail du lot, marques d'Écho, trois lignes de fin, bloc incident —, la ligne d'allure, une action principale), le TIROIR
 * « Ce qui reste » (Revue V2 : différés et verts à contrôler, avec « Ouvrir » et « Examiner »), la bande du cache, et des couches
 * (palette Ctrl K, feuille de réglages, onglets ESV).
 *
 * Même principe que src/ui5-rendu.js : tout vient d'un INSTANTANÉ (src/ui5.js) de ce que le panneau d'origine vient d'écrire ; un clic
 * est un clic sur le bouton d'origine (`data-act="legacy:<id>"`). Rien d'autre n'est commandé. Tout texte passe par `esc`. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api; else root.ArianeSignalRendu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fr = n => String(n).replace('.', ',');
  const un = x => fr((Math.round(x * 10) / 10).toFixed(1));
  const duree = s => { s = Math.max(0, Math.round(s)); if (s < 60) return `${s} s`; const m = Math.floor(s / 60), r = s % 60; if (m >= 60) { const h = Math.floor(m / 60), mm = m % 60; return mm ? `${h} h ${String(mm).padStart(2, '0')}` : `${h} h`; } return r && m < 10 ? `${m} min ${String(r).padStart(2, '0')}` : `${m} min`; };
  const mono = v => `<span class="sg-mono">${esc(v)}</span>`;
  const pl = (n, mot) => Number(n) === 1 ? mot : mot + 's';
  /* Différés de la revue : la liste du lot (celle du tiroir) ; à défaut, le compte du lot. */
  const nDif = a => (a.differesListe || []).length || a.differes || 0;

  /* ------------------------------------------------------------------ allure (calcul pur, aussi utilisé par src/ui5.js) */
  function quantile(t, f) { if (!t.length) return null; const s = [...t].sort((a, b) => a - b), p = f * (s.length - 1), a = Math.floor(p), b = Math.ceil(p); return s[a] + (s[b] - s[a]) * (p - a); }
  /* Médiane des 20 derniers cuts posés (secondes), d'après `batch.processed[].durationMs` (du début du cut à sa validation, src/engine.js).
   * Au moins 3 durées ; sinon rien. Ce n'est pas une vitesse « vraie » : les navigations entre deux cuts ne sont pas comptées. */
  function allureLot(b, maintenant) {
    if (!b) return null;
    const d = (b.processed || []).map(x => Number(x?.durationMs)).filter(x => Number.isFinite(x) && x > 0).slice(-20).map(x => x / 1000);
    const med = d.length >= 3 ? quantile(d, 0.5) : null;
    const t = iso => { const v = Date.parse(iso || ''); return Number.isFinite(v) ? v : null; };
    const debut = t(b.cutStartedAt), pause = t(b.pausedAt);
    return { mediane: med, parMinute: med ? 60 / med : null, debutCut: debut, debutPause: pause, depuisS: debut !== null ? Math.max(0, (maintenant - debut) / 1000) : null, pauseS: pause !== null ? Math.max(0, (maintenant - pause) / 1000) : null };
  }

  /* ------------------------------------------------------------------ pictogrammes (SVG inline, trait 1,75) */
  const T = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  const SVG = (inner, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''} ${T}>${inner}</svg>`;
  const IC = {
    logo: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20L10.4 4M19 20L13.6 4"/><path d="M7.4 15h9.2" stroke-opacity=".7"/><path d="M9 10.4h6" stroke-opacity=".45"/></svg>',
    fleche: '<path d="M9 6l6 6-6 6"/>', bas: '<path d="M6 9l6 6 6-6"/>', cadenas: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    palette: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10l3 2-3 2M12 14h5"/>',
    reglages: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="2.5"/>', play: '<path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none"/>', coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    ouvrir: '<path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6"/>', export: '<path d="M12 4v11M7 10l5 5 5-5M5 19h14"/>', liste: '<path d="M5 7h14M5 12h14M5 17h9"/>',
    retour: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5"/>', croix: '<path d="M6 6l12 12M18 6L6 18"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    echo: '<path d="M12 12h.01"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
    orbite: '<circle cx="12" cy="12" r="2.6"/><ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(-25 12 12)"/>',
  };
  const ic = (n, cls) => SVG(IC[n] || '', cls);
  /* Glyphes d'état : la forme porte l'état, la couleur confirme. L'anneau « en cours » se remplit avec le temps passé sur le cut (0 → médiane) ;
   * src/ui5.js le met à jour entre deux rendus d'après `data-debut` et `data-med`. */
  const C = 2 * Math.PI * 9;
  const GLYPHE = {
    pret: '<circle cx="12" cy="12" r="9"/>', dem: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><path d="M9.5 8.5v7M14.5 8.5v7" stroke-width="2.2"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="2.5"/>', toi: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    interrompu: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M8 12h8"/>', fini: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', arrete: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
    relecture: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/>', relpause: '<circle cx="12" cy="12" r="9"/><path d="M9.8 8.5v7M14.2 8.5v7" stroke-width="2"/>',
    verrou: IC.cadenas, hors: '<circle cx="12" cy="12" r="9"/><path d="M6 18L18 6"/>', echoVide: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>',
    echo: '<path d="M12 12h.01" stroke-width="3"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><path class="sg-fond-anneau" d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  };
  function glyphe(m, cls = '') {
    const vivant = m.glyphe === 'cours' || m.glyphe === 'echo';
    let svg;
    if (m.glyphe === 'cours') {
      const al = m.anneau || {}, p = al.med && al.depuis !== null && al.depuis !== undefined ? Math.min(1, al.depuis / al.med) : 0;
      svg = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke-width="1.75" stroke-linecap="butt"><circle class="sg-fond-anneau" cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity=".3"/><circle class="sg-arc" cx="12" cy="12" r="9" stroke="currentColor" transform="rotate(-90 12 12)" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - p)).toFixed(2)}"${al.debut ? ` data-debut="${esc(al.debut)}"` : ''}${al.med ? ` data-med="${esc(Math.round(al.med * 1000))}"` : ''}/></svg>`;
    } else svg = SVG(GLYPHE[m.glyphe] || GLYPHE.pret);
    return `<span class="sg-glyphe${vivant ? ' sg-vivant' : ''}${cls ? ' ' + cls : ''}" data-ton="${esc(m.ton)}" aria-hidden="true">${svg}</span>`;
  }

  /* ------------------------------------------------------------------ modèle : l'état du lot ou d'Écho, d'après l'instantané */
  /* Le bouton principal et les autres : ceux que le panneau a désignés (`role: 'primary'`), dans sa hiérarchie. Pendant la relecture,
   * « Arrêter la relecture » (ou « J'ai contrôlé le cut ») passe devant ; l'abandon d'une séance Écho n'est jamais ici (feuille de réglages). */
  function boutonsPanneau(liste, mode) {
    const L = (liste || []).filter(b => b && b.id && b.id !== 'native-discard');
    let p = null;
    if (mode === 'automatic') p = ['relecture-acquitter', 'relecture-arreter'].map(id => L.find(b => b.id === id)).find(Boolean) || null;
    if (!p) p = L.find(b => b.role === 'primary') || null;
    return { primaire: p, autres: L.filter(b => b !== p) };
  }
  const icBouton = id => /pause/.test(id) ? 'pause' : /resume|reprendre|start|lancer|new-batch|retry/.test(id) ? (id === 'retry' ? 'retour' : 'play') : /export|download|end/.test(id) ? 'export' : '';
  const TEXTE = { 'export-tout': 'Exporter le dossier' };
  const versAction = b => b ? { texte: TEXTE[b.id] || b.texte, act: b.id === 'pause' ? 'pause' : 'legacy:' + b.id, ic: icBouton(b.id), inactif: !b.actif, danger: b.role === 'danger' || /^(stop|explicit-skip|relecture-arreter)$/.test(b.id) } : null;

  const ECHO_ACTIF = /Collecte en cours|Collecte en pause|Démarrage|Séance à terminer|ESV ne répond plus/;
  function modele(snap, ui) {
    const s = snap || {}, a = s.ar || { etat: 'pret', traites: 0, poses: 0, differes: 0, differesListe: [], verts: [] }, g = s.sig || {};
    const activite = g.activite === 'echo' ? 'echo' : 'orbite';
    const partie = a.partie != null ? `Partie ${esc(a.partie)}` : '';
    const m = { activite, etat: a.etat, glyphe: 'pret', ton: 'encre2', mot: 'Prêt', phrase: '', objet: null, allure: '', principal: null, secondaires: [], raison: '', incident: null, verrou: false, anneau: null };
    const echoActif = ECHO_ACTIF.test(a.echoEtat || '') && !/Aucune/.test(a.echoEtat || '');
    m.bascule = activite === 'orbite' ? (echoActif ? { verrou: true, raison: 'Orbite est disponible après la séance Écho' } : a.lotOuvert ? { verrou: true, raison: 'Écho est disponible après le lot' } : { verrou: false })
      : a.lotOuvert ? { verrou: true, raison: 'Écho est disponible après le lot' } : echoActif ? { verrou: true, raison: 'Orbite est disponible après la séance Écho' } : { verrou: false };
    if (activite === 'echo') return modeleEcho(s, a, g, m, partie);
    const { primaire, autres } = boutonsPanneau(s.boutonsOrbite, 'automatic');
    /* L'export reste dans la palette pendant le lot et au repos : l'instrument ne garde que les commandes du moment (maquette). */
    const horsExport = !['fini', 'arrete'].includes(a.etat);
    const actions = () => { m.principal = versAction(primaire); m.secondaires = autres.filter(b => b.actif && !(horsExport && b.id === 'export-tout')).map(versAction); };
    const AL = g.allure || {};
    const reste = a.restants != null && AL.mediane ? a.restants * AL.mediane : null;
    const ligneAllure = () => AL.mediane ? `<b>${un(AL.parMinute)}</b> cuts par minute <span class="sg-sep">·</span> médiane <b>${un(AL.mediane)} s</b> par cut${reste !== null ? ` <span class="sg-sep">·</span> environ <b>${duree(reste)}</b> restantes` : ''}` : '';
    const bornes = a.bornes ? `du cut ${mono(a.bornes.debut ?? '…')} ${a.bornes.fin ? 'au cut ' + mono(a.bornes.fin) : 'jusqu’à la fin de la partie'}` : '';
    switch (a.etat) {
      case 'cours':
        Object.assign(m, { glyphe: 'cours', ton: 'vivant', mot: 'En cours', phrase: `Pose du cut ${mono(a.cours ?? '…')}`, objet: 'rail', allure: ligneAllure(), anneau: { debut: AL.debutCut, med: AL.mediane, depuis: AL.depuisS } });
        actions(); break;
      case 'dem':
        Object.assign(m, { glyphe: 'dem', ton: 'attention', mot: 'Pause demandée', phrase: `Finit le cut ${mono(a.cours ?? '…')}, puis s’arrête`, objet: 'rail', allure: ligneAllure() });
        actions(); m.principal = { texte: 'Pause demandée…', occupe: true }; break;
      case 'pause':
        Object.assign(m, { glyphe: 'pause', ton: 'attention', mot: 'En pause', objet: 'rail', railEtat: 'pause',
          phrase: `${a.dernier != null ? `Après le cut ${mono(a.dernier)}` : 'En pause'}${a.restants != null ? ` · il reste ${esc(a.restants)} cuts` : ''}`,
          allure: [AL.pauseS !== null && AL.pauseS !== undefined ? `en pause depuis <b class="sg-pause-depuis" data-debut="${esc(AL.debutPause)}">${duree(AL.pauseS)}</b>` : '', AL.mediane ? `médiane <b>${un(AL.mediane)} s</b> par cut avant la pause` : ''].filter(Boolean).join(' <span class="sg-sep">·</span> ') });
        actions(); break;
      case 'alerte': {
        const incertain = a.etatTexte === 'Résultat incertain';
        Object.assign(m, { glyphe: incertain ? 'interrompu' : 'toi', ton: 'alerte', mot: incertain ? 'Interrompu' : a.etatTexte || 'À toi', phrase: [partie, a.dernier != null ? `après le cut ${mono(a.dernier)}` : ''].filter(Boolean).join(' · '), incident: { texte: a.alerte || 'Le lot attend ta décision.' } });
        actions(); break;
      }
      case 'p2':
        Object.assign(m, { glyphe: 'verrou', ton: 'encre2', mot: 'Deuxième passe', verrou: true,
          phrase: `Ariane travaille dans ESV · ne touche à rien${a.passe2?.cut != null ? ` · cut ${mono(a.passe2.cut)}` : ''}${a.passe2 ? ` · ${esc(a.passe2.ecrites ?? 0)} posé sur ${esc(a.passe2.demandees ?? 0)}` : ''}` });
        break;
      case 'rel': {
        const r = s.relPause || {}, enPause = !!r.reprendre;
        Object.assign(m, { glyphe: enPause ? 'relpause' : 'relecture', ton: enPause ? 'attention' : 'vivant', mot: enPause ? 'Relecture en pause' : 'Relecture', phrase: esc(r.ligne || s.relecture?.ligne || 'Relecture après le lot') });
        const b = [];
        if (r.reprendre) b.push({ texte: r.reprendre.texte, act: 'legacy:relecture-reprendre', ic: 'play', inactif: !r.reprendre.actif });
        if (r.pause) b.push({ texte: r.pause.texte, act: 'legacy:relecture-pause', ic: 'pause', inactif: !r.pause.actif });
        if (r.arreter) b.push({ texte: 'Arrêter la relecture', act: 'legacy:relecture-arreter-pause', danger: true });
        if (b.length) { m.principal = b[0]; m.secondaires = b.slice(1); m.raison = r.reprendre && !r.reprendre.actif ? r.reprendre.raison || '' : ''; } else actions();
        break;
      }
      case 'fini': case 'arrete': {
        Object.assign(m, { glyphe: a.etat === 'fini' ? 'fini' : 'arrete', ton: a.etat === 'fini' ? 'vivant' : 'encre2', mot: a.etat === 'fini' ? 'Terminé' : 'Arrêté', objet: 'fin',
          phrase: [partie, esc(s.lot?.finPartie || '')].filter(Boolean).join(' · ') });
        m.fin = [['Lot', `<b>${esc(a.traites)}</b> cuts traités${a.cibles ? ` sur <b>${esc(a.cibles)}</b> ciblés` : ''}`],
          ['Il reste', nDif(a) + (a.vertsNombre || 0) ? `<b class="sg-dif">${esc(nDif(a))}</b> ${pl(nDif(a), 'différé')}, <b>${esc(a.vertsNombre || 0)}</b> ${pl(a.vertsNombre || 0, 'vert')} à contrôler` : 'rien à examiner'],
          ['Export', esc(s.exportTexte || 'prêt')]];
        actions();
        if (nDif(a) + (a.vertsNombre || 0) > 0) { const ex = (s.boutonsOrbite || []).find(b => b.id === 'export-tout'); m.secondaires = [ex ? versAction(ex) : null, ...m.secondaires.filter(b => b.act !== 'legacy:export-tout'), ...(m.principal && m.principal.act !== 'legacy:export-tout' ? [m.principal] : [])].filter(Boolean); m.principal = { texte: 'Voir ce qui reste', act: 'sg:tiroir', ic: 'liste' }; }
        break;
      }
      default:
        if (a.horsLigne || g.connexion?.statut === 'no-tab') {
          const choisi = !!g.onglet && g.connexion?.statut !== 'no-tab';
          Object.assign(m, { glyphe: 'hors', mot: 'Hors ligne', phrase: choisi ? 'Aucune partie affichée dans l’onglet ESV choisi' : 'Aucun onglet ESV ouvert' });
          m.principal = { texte: choisi ? 'Onglets ESV' : 'Choisir un onglet', act: 'sg:esv' };
        } else {
          Object.assign(m, { glyphe: 'pret', mot: 'Prêt', phrase: [partie, bornes].filter(Boolean).join(' · '), objet: a.cibles ? 'rail' : null, railEtat: 'vide' });
          actions();
        }
    }
    if (g.connexion?.statut === 'unavailable' && !m.incident && a.etat !== 'p2') m.incident = { texte: 'ESV n’est pas connecté. Si la page ESV est figée, recharge-la (F5), puis reconnecte-la.' };
    if (g.connexion?.statut === 'reconnecting' && !m.incident) m.raison = m.raison || 'Reconnexion à ESV en cours…';
    return m;
  }
  function modeleEcho(s, a, g, m, partie) {
    const { primaire, autres } = boutonsPanneau(s.boutonsEcho, 'native'), E = g.echo || {};
    const actions = () => { m.principal = versAction(primaire); m.secondaires = autres.filter(b => b.actif).map(versAction); };
    const e = a.echoEtat || 'Aucune séance en cours', vus = Number(s.echo?.visites) || 0, corr = Number(s.echo?.corriges) || 0;
    m.compteEcho = { vus, corriges: corr };
    if (a.lotOuvert) { Object.assign(m, { glyphe: 'verrou', mot: 'Écho', phrase: 'Disponible après le lot Orbite', verrou: true, verrouTexte: 'Écho est disponible après le lot' }); return m; }
    if (/Collecte en cours|Démarrage/.test(e)) Object.assign(m, { glyphe: 'echo', ton: 'vivant', mot: /Démarrage/.test(e) ? 'Démarrage' : 'En observation', phrase: g.cutEsv != null || a.cutEsv != null ? `Visite du cut ${mono(a.cutEsv ?? g.cutEsv)}` : partie, objet: 'echo' });
    else if (/Collecte en pause/.test(e)) Object.assign(m, { glyphe: 'pause', ton: 'attention', mot: 'Écho en pause', phrase: partie, objet: 'echo' });
    else if (/ESV ne répond plus/.test(e)) Object.assign(m, { glyphe: 'toi', ton: 'alerte', mot: 'ESV ne répond plus', phrase: partie, incident: { texte: 'Si la page ESV reste figée, recharge-la (F5), puis reprends la collecte.' } });
    else if (/Séance à terminer/.test(e)) Object.assign(m, { glyphe: 'pause', ton: 'attention', mot: 'Séance à terminer', phrase: partie, objet: vus ? 'echo' : null });
    else Object.assign(m, { glyphe: 'echoVide', mot: 'Aucune séance', phrase: [partie, 'prête à observer'].filter(Boolean).join(' · ') });
    if (m.objet === 'echo' && E.mediane) m.allure = `<b>${un(60 / E.mediane)}</b> cuts par minute <span class="sg-sep">·</span> médiane <b>${un(E.mediane)} s</b> par cut <span class="sg-sep">·</span> <b>${esc(corr)}</b> corrigés`;
    actions();
    return m;
  }

  /* ------------------------------------------------------------------ morceaux */
  function railHtml(a, statuts, etat) {
    const total = a.cibles || null, n = statuts.length, traites = a.traites || 0;
    const echelle = total || Math.max(10, Math.ceil(Math.max(n, traites) * 1.25 / 10) * 10);
    const pos = i => `${Math.max(0, Math.min(100, i / echelle * 100)).toFixed(3)}%`;
    let h = `<div class="sg-rail" data-etat="${esc(etat || 'cours')}" data-total="${total ? 'connu' : 'inconnu'}" role="img" aria-label="${esc(`${traites} traités${total ? ` sur ${total} ciblés` : ''}, ${a.differes || 0} différés`)}"><div class="sg-rail-base"></div>`;
    if (total) {
      const pas = total > 400 ? 50 : 10;
      for (let k = 0; k <= total; k += pas) h += `<div class="sg-rail-grad${k % (pas * 5) === 0 ? ' sg-dix' : ''}" style="left:${pos(k)}"></div>`;
      h += `<div class="sg-rail-num sg-debut">0</div>${total >= 20 ? `<div class="sg-rail-num" style="left:50%">${esc(Math.round(total / 2))}</div>` : ''}<div class="sg-rail-num sg-fin" style="left:100%">${esc(total)}</div>`;
    }
    h += `<div class="sg-rail-fait" style="width:${pos(traites)}"></div>`;
    statuts.forEach((x, i) => { if (x === 'differe') h += `<div class="sg-rail-dif" style="left:${pos(i + 0.5)}"></div>`; else if (x === 'incertain') h += `<div class="sg-rail-inc" style="left:${pos(i + 0.5)}"></div>`; });
    if (etat !== 'vide' && etat !== 'fini') h += `<div class="sg-rail-cur" style="left:${pos(traites)}"></div>`;
    return h + '</div>';
  }
  function objetHtml(snap, m) {
    const a = snap.ar || {}, g = snap.sig || {};
    if (m.incident) return `<div class="sg-incident" role="alert"><p>${esc(m.incident.texte)}</p></div>`;
    if (m.objet === 'fin') return `<dl class="sg-fin">${m.fin.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
    if (m.objet === 'echo') {
      const c = m.compteEcho, M = (g.echo?.marques || []).slice(-60);
      return `<div class="sg-objet"><div class="sg-compte"><span class="sg-chiffre">${esc(c.vus)}</span><span class="sg-suite">cuts vus</span><span class="sg-droite"><b>${esc(c.corriges)}</b> corrigés · <b>${esc(Math.max(0, c.vus - c.corriges))}</b> validés tels quels</span></div><div class="sg-marques" role="img" aria-label="${esc(`${c.vus} visites, ${c.corriges} corrigées`)}">${M.map(x => `<i class="${x ? 'sg-c' : ''}"></i>`).join('')}${m.glyphe === 'echo' ? '<i class="sg-en"></i>' : ''}</div></div>`;
    }
    if (m.objet !== 'rail') return '';
    if (m.railEtat === 'vide') return `<div class="sg-objet"><div class="sg-compte"><span class="sg-chiffre">${esc(a.cibles)}</span><span class="sg-suite">cuts ciblés · aucun traité</span></div>${railHtml(a, [], 'vide')}</div>`;
    const droite = `<span class="sg-droite"><b>${esc(a.poses)}</b> posés · <span class="sg-dif">${esc(a.differes)}</span> différés</span>`;
    return `<div class="sg-objet"><div class="sg-compte"><span class="sg-chiffre">${esc(a.traites)}</span><span class="sg-suite">${a.cibles ? `traités sur ${esc(a.cibles)} ciblés` : 'traités'}</span>${droite}</div>${railHtml(a, g.statuts || [], m.railEtat || 'cours')}</div>`;
  }
  function actionsHtml(m) {
    if (m.verrou) return `<div class="sg-verrou-ligne">${ic('cadenas')}<span>${esc(m.verrouTexte || 'Aucune action jusqu’à la fin de la deuxième passe')}</span></div>`;
    if (!m.principal && !m.secondaires.length) return m.raison ? `<p class="sg-raison">${esc(m.raison)}</p>` : '';
    let h = '<div class="sg-actions">';
    const p = m.principal;
    if (p) h += `<button type="button" class="sg-principal${p.danger ? ' sg-danger' : ''}"${p.act && !p.occupe ? ` data-act="${esc(p.act)}"` : ''}${p.occupe || p.inactif ? ' disabled' : ''}>${p.occupe ? '<span class="sg-tourne" aria-hidden="true"></span>' : p.ic ? ic(p.ic) : ''}<span>${esc(p.texte)}</span></button>`;
    for (const b of m.secondaires) h += `<button type="button" class="sg-secondaire${b.danger ? ' sg-danger' : ''}" data-act="${esc(b.act)}"${b.inactif ? ' disabled' : ''}>${esc(b.texte)}</button>`;
    if (m.raison) h += `<span class="sg-raison">${esc(m.raison)}</span>`;
    return h + '</div>';
  }

  /* Ce qui reste (Revue V2, D-250) : différés puis verts à contrôler, jamais mélangés. Chaque ligne a « Ouvrir » (le cut dans ESV, par le
   * bouton caché `#goto-cut` du panneau) et « Examiner » (gardé par l'habillage, pour ce lot). Les verts viennent du panneau groupés en plages :
   * « Ouvrir » amène ESV au premier cut de la plage. */
  const premierCut = t => { const x = String(t || '').match(/\d+/); return x ? Number(x[0]) : null; };
  function lignesRevue(a) {
    const D = (a.differesListe || []).map(d => ({ cle: 'd:' + d.cut, cut: d.cut, motif: d.motif, prec: d.precision, meta: d.heure }));
    const V = (a.verts || []).map(v => { const c = premierCut(v.detail); return { cle: 'v:' + (c ?? v.libelle), cut: c, motif: v.libelle, prec: v.detail, meta: '' }; });
    return { D, V };
  }
  function tiroirHtml(snap, m, ui) {
    const g = snap.sig || {}, sel = ui.sel;
    if (m.activite === 'echo') {
      const R = snap.echoRows || [];
      const rows = R.map((r, i) => `<div class="sg-ligne" role="option" data-row="${i}" aria-selected="${sel === i}" tabindex="-1"><span class="sg-cut">${esc(r.cut)}</span><span class="sg-motif">${esc(r.texte)}</span><span class="sg-prec">${esc(r.duree)}</span></div>`).join('');
      return `<div class="sg-corps" role="listbox" aria-label="Visites"><div class="sg-section"><span>Visites</span><span class="sg-n">${esc(snap.echo?.visites ?? 0)}</span><span class="sg-d">les 40 dernières</span></div>${rows || '<div class="sg-vide">Aucune visite pour l’instant.</div>'}</div>`;
    }
    const a = snap.ar || {}, ex = new Set(g.examines || []), go = g.goto || {}, { D, V } = lignesRevue(a);
    const titreOuvrir = !go.present ? 'Disponible avec la prochaine mise à jour du moteur' : !go.actif ? go.raison || 'Indisponible pour l’instant' : 'Ouvrir ce cut dans ESV';
    const outils = r => `<span class="sg-outils"><button type="button"${r.cut !== null && go.present && go.actif ? ` data-act="sg:ouvrir:${esc(r.cut)}"` : ' disabled'} title="${esc(titreOuvrir)}">${ic('ouvrir')}<span>Ouvrir</span></button><button type="button" data-act="sg:examiner:${esc(r.cle)}" aria-pressed="${ex.has(r.cle)}" title="Marquer examiné">${ic('coche')}<span>${ex.has(r.cle) ? 'Examiné' : 'Examiner'}</span></button></span>`;
    const ligne = (r, i) => `<div class="sg-ligne${ex.has(r.cle) ? ' sg-examine' : ''}" role="option" data-row="${i}" aria-selected="${sel === i}" tabindex="-1"><span class="sg-cut">${esc(r.cut ?? '—')}</span><span class="sg-motif">${esc(r.motif)}${r.prec ? ` <small>· ${esc(r.prec)}</small>` : ''}${r.meta ? ` <small>· ${esc(r.meta)}</small>` : ''}</span>${outils(r)}</div>`;
    const reste = L => L.filter(r => !ex.has(r.cle)).length;
    const etatGo = go.etat === 'refuse' ? `<div class="sg-note-ligne sg-refus" role="status">${esc(go.texte || 'Ouverture refusée')}</div>` : go.etat === 'en-cours' ? '<div class="sg-note-ligne" role="status">Ouverture du cut dans ESV…</div>' : '';
    let h = etatGo;
    h += `<div class="sg-section"><span>Différés</span><span class="sg-n">${D.length}</span>${D.length ? `<span class="sg-d">reste à examiner <span class="sg-n">${reste(D)}</span></span>` : `<span class="sg-d">${a.lotOuvert ? 'à reprendre après le lot' : ''}</span>`}</div>`;
    h += D.length ? D.map((r, i) => ligne(r, i)).join('') : `<div class="sg-vide">${a.lotOuvert ? 'Aucun différé pour l’instant.' : 'Aucun différé.'}</div>`;
    h += `<div class="sg-section"><span>Verts à contrôler</span>${V.length ? `<span class="sg-n">${esc(a.vertsNombre || V.length)}</span><span class="sg-d">reste à examiner <span class="sg-n">${reste(V)}</span> plages</span>` : ''}</div>`;
    h += V.length ? V.map((r, i) => ligne(r, D.length + i)).join('') + (a.vertsLigne ? `<div class="sg-vide sg-petit">${esc(a.vertsLigne)}</div>` : '') : `<div class="sg-vide">${a.lotOuvert ? 'Calculés à la fin du lot.' : 'Aucun vert suspect, ou liste pas encore calculée.'}</div>`;
    return `<div class="sg-corps" role="listbox" aria-label="Ce qui reste">${h}</div>`;
  }
  function poigneeHtml(snap, m, ui) {
    const g = snap.sig || {}, a = snap.ar || {}, ex = new Set(g.examines || []);
    let n = 0, long = '', court = '', resteTx = '';
    if (m.activite === 'echo') { n = Number(snap.echo?.visites) || 0; long = n ? 'visites' : 'Aucune visite pour l’instant'; court = n ? 'visites' : 'aucune visite'; }
    else {
      const { D, V } = lignesRevue(a), total = D.length + V.length, reste = [...D, ...V].filter(r => !ex.has(r.cle)).length;
      const d = nDif(a), v = a.vertsNombre || 0;
      n = a.lotOuvert ? d : d + v;
      long = a.lotOuvert ? (d ? `${pl(d, 'différé')} · à reprendre après le lot` : 'Aucun différé pour l’instant') : n ? `à examiner · ${d} ${pl(d, 'différé')}, ${v} ${pl(v, 'vert')}` : 'Rien à examiner';
      court = n ? 'à examiner' : 'rien à examiner';
      if (total && !a.lotOuvert) resteTx = `reste à examiner ${reste} sur ${total}`;
    }
    const mini = `<span class="sg-etat-mini">${glyphe(m)}<span>${esc(m.mot)}${m.activite === 'orbite' && a.cibles && ['cours', 'dem', 'pause'].includes(m.etat) ? ` · ${esc(a.traites)} sur ${esc(a.cibles)}` : ''}</span></span>`;
    return `<button type="button" class="sg-poignee" data-act="sg:tiroir" aria-expanded="${!!ui.tiroir}" aria-controls="sg-tiroir-corps">${ic('fleche', 'sg-fl')}<span class="sg-txt">${n ? `<span class="sg-n${m.activite === 'orbite' && nDif(a) ? ' sg-dif' : ''}">${esc(n)}</span> ` : ''}<span class="sg-long">${esc(long)}</span><span class="sg-court">${esc(court)}</span></span>${resteTx ? `<span class="sg-reste">${esc(resteTx)}</span>` : ''}${mini}</button>`;
  }
  /* Bande du cache : le bouton d'origine, et sa raison tant qu'il est impossible (même règle que src/ui5-rendu.js). */
  function cacheHtml(snap, m) {
    const a = snap.ar || {}, rel = !!(snap.relecture?.actif || snap.relPause?.pause || snap.relPause?.reprendre || snap.relPause?.arreter);
    const ok = a.cache?.actif === true && !rel;
    const raison = ok ? '' : a.etat === 'p2' ? 'après la deuxième passe' : rel ? 'après la relecture' : m.activite === 'echo' && !/Aucune/.test(a.echoEtat || '') ? 'après la séance Écho' : a.lotOuvert ? 'après le lot' : 'indisponible pour l’instant';
    return `<footer class="sg-cache"><span class="sg-q"><span class="sg-lib">Cache des exports</span></span>${raison ? `<span class="sg-r">· ${esc(raison)}</span>` : ''}<span class="sg-espace"></span><button type="button" data-act="legacy:export-cache-clear"${ok ? '' : ' disabled'}>Vider le cache</button></footer>`;
  }
  function barreHtml(snap, m, ui) {
    const g = snap.sig || {}, b = m.bascule, st = g.connexion?.statut, a = snap.ar || {};
    const seg = (k, t) => { const off = b.verrou && m.activite !== k; return `<button type="button" role="tab" aria-selected="${m.activite === k}"${off ? ` aria-disabled="true" data-raison="${esc(b.raison)}"` : m.activite === k ? '' : ` data-act="mode:${k === 'echo' ? 'native' : 'automatic'}"`}>${off ? ic('cadenas') : ''}${t}</button>`; };
    const etatPuce = st === 'unavailable' || a.esv === 'ko' ? 'ko' : st === 'reconnecting' ? 'libre' : !g.onglet || st === 'no-tab' ? 'aucun' : a.lotOuvert ? 'verrou' : 'ok';
    const texte = etatPuce === 'ko' ? 'ESV ne répond plus' : st === 'reconnecting' ? 'Reconnexion…' : etatPuce === 'aucun' ? 'Aucun onglet' : g.onglet;
    const court = String(texte).split(' · ')[0];
    return `<header class="sg-barre"><span class="sg-logo">${IC.logo}<span>Ariane</span></span><div class="sg-bascule" role="tablist" aria-label="Activité">${seg('orbite', 'Orbite')}${seg('echo', 'Écho')}</div><span class="sg-espace"></span>
<button type="button" class="sg-puce" data-etat="${etatPuce}" data-act="sg:esv" aria-haspopup="dialog" aria-expanded="${ui.couche === 'esv'}" title="${a.lotOuvert ? 'Garde son onglet jusqu’à la fin du lot' : 'Choisir l’onglet ESV'}"><i></i><span class="sg-tx"><span class="sg-long">${esc(texte)}</span><span class="sg-court">${esc(court)}</span></span>${ic(etatPuce === 'verrou' ? 'cadenas' : 'bas', 'sg-fl')}</button>
<button type="button" class="sg-ico sg-ico-palette" data-act="sg:palette" aria-label="Commandes (Ctrl K)" title="Commandes · Ctrl K" aria-pressed="${ui.couche === 'palette'}">${ic('palette')}</button><button type="button" class="sg-ico" data-act="sg:reglages" aria-label="Réglages" title="Réglages" aria-pressed="${ui.couche === 'reglages'}">${ic('reglages')}</button></header>${ui.note ? `<div class="sg-barre-note" role="status">${esc(ui.note)}</div>` : ''}`;
  }

  /* ------------------------------------------------------------------ couches */
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function commandes(snap, m, ui) {
    const a = snap.ar || {}, g = snap.sig || {}, c = [], vus = new Set();
    const add = (icn, nom, act, et, off) => { if (!act || vus.has(act)) return; vus.add(act); c.push({ ic: icn, nom, act, et: et || '', off: off || '' }); };
    const etat = `${m.activite === 'echo' ? 'Écho' : 'Orbite'} · ${m.mot}${m.activite === 'orbite' && a.cibles && ['cours', 'dem', 'pause'].includes(m.etat) ? ` · ${a.traites} sur ${a.cibles}` : ''}`;
    if (m.principal && !m.principal.occupe) add(m.principal.ic || 'play', m.principal.texte, m.principal.act, etat, m.principal.inactif ? m.raison || 'indisponible' : '');
    for (const b of m.secondaires) add(b.danger ? 'stop' : b.ic || 'coche', b.texte, b.act, '', b.inactif ? 'indisponible' : '');
    add('liste', ui.tiroir ? 'Fermer le tiroir' : 'Voir ce qui reste', 'sg:tiroir', '');
    const ex = (snap.boutonsOrbite || []).find(b => b.id === 'export-tout');
    add('export', 'Exporter le dossier', 'legacy:export-tout', '', ex && ex.actif ? '' : a.lotOuvert ? 'après le lot' : 'indisponible pour l’instant');
    const autre = m.activite === 'echo' ? 'orbite' : 'echo';
    add(autre === 'echo' ? 'echo' : 'orbite', autre === 'echo' ? 'Passer en Écho' : 'Passer en Orbite', `mode:${autre === 'echo' ? 'native' : 'automatic'}`, '', m.bascule.verrou ? m.bascule.raison : '');
    add('reglages', 'Réglages', 'sg:reglages', '');
    add('globe', 'Onglets ESV', 'sg:esv', g.onglet || '');
    if (g.connexion?.reconnect?.visible) add('retour', 'Reconnecter ESV', 'legacy:reconnect', '', g.connexion.reconnect.actif ? '' : 'reconnexion en cours');
    add('stop', 'Vider le cache des exports', 'legacy:export-cache-clear', '', a.cache?.actif ? '' : 'indisponible pour l’instant');
    add('liste', 'Détails techniques', 'sg:tech', '');
    return c;
  }
  function paletteListe(snap, ui) {
    const m = modele(snap, ui), all = commandes(snap, m, ui), q = norm(ui.q).trim();
    return q ? all.filter(c => norm(c.nom + ' ' + c.et).includes(q)).slice(0, 7) : all.slice(0, 4);
  }
  function paletteHtml(snap, ui) {
    const L = paletteListe(snap, ui), i = Math.max(0, Math.min(L.length - 1, ui.pi || 0));
    return `<div class="sg-voile" data-act="sg:fermer"></div><div class="sg-palette" role="dialog" aria-label="Commandes"><input id="ui5-q" type="text" value="${esc(ui.q)}" placeholder="Commande…" autocomplete="off" spellcheck="false" aria-label="Rechercher une commande"><div class="sg-cmds" role="listbox">${L.length ? L.map((c, k) => `<button type="button" class="sg-cmd" role="option" aria-selected="${k === i}"${c.off ? ' aria-disabled="true"' : ` data-act="${esc(c.act)}"`} data-fermer="1">${ic(c.ic)}<span>${esc(c.nom)}</span><span class="sg-et">${esc(c.off || c.et)}</span></button>`).join('') : '<div class="sg-cmd"><span></span><span class="sg-et">Aucune commande</span></div>'}</div><div class="sg-pied"><span><kbd>↑</kbd> <kbd>↓</kbd> choisir</span><span><kbd>Entrée</kbd> exécuter</span><span class="sg-espace"></span><span><kbd>Échap</kbd> fermer</span></div></div>`;
  }
  function esvHtml(snap) {
    const g = snap.sig || {}, a = snap.ar || {}, L = snap.onglets || [], choisi = String(snap.ongletChoisi || ''), verrou = !!a.lotOuvert || !!a.connexionBloquee;
    const rows = L.length ? L.map(o => { const mien = String(o.valeur) === choisi, pasPret = /pas prêt/i.test(o.texte);
      return `<div class="sg-ong"><span class="sg-lib"><b>${esc(o.texte)}</b>${pasPret ? '<small>pas prêt</small>' : ''}</span>${mien && g.connexion?.statut !== 'unavailable' ? '<span class="sg-conn"><i></i>connecté</span>' : `<button type="button" data-act="conn:${esc(o.valeur)}"${verrou && !mien || pasPret ? ' disabled' : ''}>${mien ? 'Reconnecter' : 'Connecter'}</button>`}</div>`; }).join('')
      : '<div class="sg-vide sg-petit">Aucun onglet ESV ouvert. Ouvre une partie dans ESV ; elle apparaîtra ici.</div>';
    const rc = g.connexion?.reconnect;
    const reco = rc?.visible ? `<div class="sg-ong"><span class="sg-lib"><b>Reconnecter</b><small>${esc(g.connexion.statut === 'reconnecting' ? 'en cours…' : 'ré-équiper l’onglet choisi')}</small></span><button type="button" data-act="legacy:reconnect"${rc.actif ? '' : ' disabled'}>Reconnecter</button></div>` : '';
    return `<div class="sg-voile sg-transparent" data-act="sg:fermer"></div><div class="sg-popover" role="dialog" aria-label="Onglets ESV">${rows}${reco}<div class="sg-pied">${verrou ? ic('cadenas') + '<span>Une seule connexion, gardée jusqu’à la fin du lot.</span>' : `<span>${esc(snap.connexionNote || 'Une seule connexion, partagée entre Orbite et Écho.')}</span>`}</div></div>`;
  }
  function historiqueHtml(H) {
    if (!Array.isArray(H)) return '';
    const FIN = { complete: 'terminée', arretee: 'arrêtée', 'en-cours': 'en cours', interrompue: 'interrompue' };
    const jour = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}` : ''; };
    const L = H.slice(0, 12).map(p => `<div class="sg-hist"><span class="sg-mono">${esc(p.part ?? '—')}</span><span>${esc(FIN[p.fin] || p.fin || '')}${p.cibles != null ? ` · ${esc(p.cibles)} ciblés` : ''}${p.poses != null ? ` · ${esc(p.poses)} posés` : ''}${p.differes != null ? ` · ${esc(p.differes)} différés` : ''}${p.depart?.ignores ? ` · ${esc(p.depart.ignores)} ignorés` : ''}</span><small>${esc(jour(p.startedAt))}</small></div>`).join('');
    return `<div class="sg-reg sg-reg-bloc"><span class="sg-lib"><span>Parties traitées</span><small>Gardées même après un vidage du cache</small></span></div>${L || '<div class="sg-vide sg-petit">Aucune partie enregistrée pour l’instant.</div>'}`;
  }
  function feuilleHtml(snap) {
    const r = snap.reglages || {}, g = snap.sig || {};
    const sel = (nom, valeurs, courant, aide) => `<select data-sel="${esc(nom)}" aria-label="${esc(aide)}">${valeurs.map(([v, l]) => `<option value="${esc(v)}"${v === courant ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const seg = (nom, valeurs, courant, aide) => `<span class="sg-seg" role="group" aria-label="${esc(aide)}">${valeurs.map(([v, l]) => `<button type="button" aria-pressed="${v === courant}" data-act="sg:choix:${esc(nom)}:${esc(v)}">${esc(l)}</button>`).join('')}</span>`;
    const ligne = (t, aide, ctl) => `<div class="sg-reg"><span class="sg-lib"><span>${esc(t)}</span>${aide ? `<small>${esc(aide)}</small>` : ''}</span>${ctl}</div>`;
    const discard = (snap.boutonsEcho || []).find(b => b.id === 'native-discard');
    return `<div class="sg-feuille" role="dialog" aria-label="Réglages"><div class="sg-tete"><span class="sg-t">Réglages</span><span class="sg-meta">jamais en séance</span><kbd>Échap</kbd><button type="button" class="sg-ico" data-act="sg:fermer" aria-label="Fermer">${ic('croix')}</button></div><div class="sg-liste">
 ${ligne('Après le lot', 'Relecture des verts sûrs · gardé pour le prochain lot', sel('relecture', [['coupee', 'Rien'], ['ombre', 'Relire sans rien modifier'], ['corriger', 'Relire et corriger']], r.relecture, 'Après le lot'))}
 ${ligne('Clic du mode rapide', 'gardé pour le prochain lot', sel('clic', [['tel-quel', 'Comme avant'], ['gauche-recentre', 'Rail gauche recentré'], ['tout-recentre', 'Tout recentré']], r.clic, 'Clic du mode rapide'))}
 ${ligne('Série de différés', 'Mettre en attente les cuts voisins', seg('grappe', [['non', 'Non'], ['oui', 'Oui']], r.grappe ? 'oui' : 'non', 'Série de différés'))}
 ${ligne('Deuxième passe (écrit dans ESV)', 'En fin de lot, pose et valide les cuts restés sans pose qu’elle sait poser', sel('passe2', [...(r.passe2 === null ? [['', 'État inconnu']] : []), ['oui', 'Allumée'], ['non', 'Coupée']], r.passe2 === null ? '' : r.passe2 ? 'oui' : 'non', 'Deuxième passe'))}
 ${ligne('Raison de la correction (Écho)', 'Lue au démarrage d’Écho', sel('raison', [['non', 'Non'], ['chiffres', 'Oui · chiffres du haut'], ['alt-chiffres', 'Oui · Alt + chiffre'], ['pave', 'Oui · pavé numérique']], r.raison ? r.touches || 'chiffres' : 'non', 'Raison de la correction'))}
 ${g.f5 ? ligne('Si ESV est rechargé pendant la relecture', '', sel('f5', [['pause', 'Attendre, puis reprendre'], ['arret', 'Arrêter la relecture']], g.f5, 'Si ESV est rechargé')) : ''}
 ${ligne('Bandeau dans ESV', 'Une ligne d’état au bas de la page ESV', seg('bandeau', [['non', 'Éteint'], ['oui', 'Allumé']], r.bandeau ? 'oui' : 'non', 'Bandeau dans ESV'))}
 ${ligne('Thème', '', seg('theme', [['sombre', 'Sombre'], ['clair', 'Clair']], g.theme === 'clair' ? 'clair' : 'sombre', 'Thème'))}
 ${ligne('Interface', 'Signal, ou la palette seule', sel('variante', [['signal', 'Signal (instrument)'], ['palette', 'Palette seule'], ['ariane2', 'Ariane v2 (essai)']], snap.variante, 'Interface'))}
 ${snap.gcv2 ? `<div class="sg-reg"><span class="sg-lib"><span>Exemples d’apprentissage</span><small>cuts corrigés dans les Échos archivées, tous projets · au ${esc(snap.gcv2.date)} · ne mesure aucune qualité</small></span><span class="sg-mono">${esc(snap.gcv2.total)}</span></div>` : ''}
 ${historiqueHtml(g.historique)}
 <div class="sg-bas"><button type="button" class="sg-lien" data-act="sg:tech">${ic('liste')}<span>Détails techniques : santé de la collecte, exports de diagnostic, journal, résumé de la partie</span></button>${snap.exportTexte ? `<p class="sg-meta">${esc(snap.exportTexte)}</p>` : ''}${discard ? `<div class="sg-danger-zone"><span>Séance Écho : supprime ses données, avec confirmation.</span><button type="button" data-act="legacy:native-discard"${discard.actif ? '' : ' disabled'}>Abandonner la séance Écho…</button></div>` : ''}</div></div></div>`;
  }

  /* ------------------------------------------------------------------ écran */
  function rendre(snap, ui) {
    const s = snap || {}, u = ui || {}, m = modele(s, u);
    const instrument = `<section class="sg-instrument" aria-live="polite"><div class="sg-groupe-etat"><div class="sg-etat">${glyphe(m)}<span class="sg-mot">${esc(m.mot)}</span></div><p class="sg-phrase">${m.phrase}</p></div>${objetHtml(s, m)}${m.allure ? `<p class="sg-allure">${m.allure}</p>` : ''}${actionsHtml(m)}</section>`;
    const couche = u.couche === 'palette' ? paletteHtml(s, u) : u.couche === 'reglages' ? feuilleHtml(s) : u.couche === 'esv' ? esvHtml(s) : '';
    return `<div class="sg-fen" data-activite="${m.activite}" data-etat="${esc(m.etat)}">${barreHtml(s, m, u)}${instrument}<div class="sg-zone"><div class="sg-tiroir" data-ouvert="${u.tiroir ? 1 : 0}">${poigneeHtml(s, m, u)}<div id="sg-tiroir-corps"${u.tiroir ? '' : ' inert'}>${tiroirHtml(s, m, u)}</div></div></div>${cacheHtml(s, m)}${couche}</div>`;
  }

  return { esc, quantile, allureLot, modele, commandes, paletteListe, lignesRevue, rendre, duree };
});
