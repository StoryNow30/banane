/* UI 5.0 « Signal » (D-250) : HABILLAGE DU PANNEAU, partie PURE (aucun DOM, aucun message, aucune API Chrome).
 *
 * La présentation par défaut du panneau, d'après la maquette maquettes/ui-5.0/Q-signal.html et le fichier Figma « Ariane 5.0 » :
 * une barre (logo, bascule Orbite / Écho, puce de l'onglet ESV, commandes, réglages), l'INSTRUMENT (glyphe et mot d'état, une phrase,
 * l'objet — rail du lot, marques d'Écho, trois lignes de fin, bloc incident —, la ligne d'allure, une action principale), le TIROIR
 * « Ce qui reste » (Revue V2 : différés et verts à contrôler, avec « Ouvrir » et « Examiner »), la bande du cache, et des couches
 * (palette Ctrl K, feuille de réglages, onglets ESV).
 *
 * Même principe que les présentations d'essai d'avant (retirées en test 23) : tout vient d'un INSTANTANÉ (src/ui5.js) de ce que le panneau d'origine vient d'écrire ; un clic
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
  const pl = (n, mot) => Number(n) <= 1 ? mot : mot + 's';
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
  /* Ciblage T22 (fiches/CIBLAGE_T22.md) : M, les cuts invalides compris dans les bornes du lot (`sc`), d'après la fiche de départ de CE lot (`f`, D-092 :
   * invalides et lignes de la liste d'ESV au démarrage) et, si les bornes ne couvrent pas toute la partie, l'instantané décompacté de la liste (`L`,
   * src/liste-memoire.js : `st[cut]`, 1 = invalide) pris dans le MÊME état que la fiche (même partie, mêmes lignes, même nombre d'invalides). Toute la
   * partie : départ au cut 0 ou 1 (règle de `travailDuLot`, panel.js) et fin de partie, ou dernier cut au moins égal à la dernière ligne. Sinon null :
   * jamais un total deviné. Aucun invalide dans les bornes : null (pas de « sur 0 »). */
  const FIN_PARTIE = 999999, PREMIER_CUT_MAX = 1;
  function ciblesBornes(sc, f, L) {
    if (!sc || !f || !Number.isInteger(f.invalides) || f.invalides <= 0 || !Number.isInteger(f.total) || f.total < 2) return null;
    if (Number.isInteger(f.partie) && f.partie !== sc.part) return null;
    const a = Number(sc.start), z = sc.endMode === 'partie' || Number(sc.end) >= FIN_PARTIE ? f.total - 1 : Number(sc.end);
    if (!Number.isInteger(a) || a < 0 || !Number.isInteger(z) || z < a) return null;
    if (a <= PREMIER_CUT_MAX && z >= f.total - 1) return f.invalides;
    if (!L || L.partie !== sc.part || L.n !== f.total || !Array.isArray(L.st) || L.st.length !== L.n) return null;
    let tout = 0, dedans = 0;
    for (let i = 0; i < L.n; i++) if (L.st[i] === 1) { tout++; if (i >= a && i <= z) dedans++; }
    return tout === f.invalides && dedans > 0 ? dedans : null;
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
    return `<span class="sg-glyphe${vivant ? ' sg-vivant' : ''}${cls ? ' ' + cls : ''}" data-k="${esc(m.glyphe)}" data-g="${esc(m.glyphe)}" data-ton="${esc(m.ton)}" aria-hidden="true">${svg}</span>`;
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

  /* Une séance Écho est OUVERTE quand le service worker la dit en cours, en pause, au démarrage ou sans réponse d'ESV (les quatre statuts ouverts du panneau
   * d'origine). « Séance terminée » (FINISHED, gardée après l'export) ne l'est pas. */
  const echoOuvert = e => /Collecte en cours|Collecte en pause|Démarrage|ESV ne répond plus/.test(e || '');
  function modele(snap, ui) {
    const s = snap || {}, a = s.ar || { etat: 'pret', traites: 0, poses: 0, differes: 0, differesListe: [], verts: [] }, g = s.sig || {};
    const activite = g.activite === 'echo' ? 'echo' : 'orbite';
    const partie = a.partie != null ? `Partie ${esc(a.partie)}` : '';
    const m = { activite, etat: a.etat, glyphe: 'pret', ton: 'encre2', mot: 'Prêt', phrase: '', objet: null, allure: '', principal: null, secondaires: [], raison: '', incident: null, verrou: false, anneau: null };
    /* Bascule (T21) : une NAVIGATION, jamais verrouillée, comme les vues du panneau d'origine. Seuls les départs sont refusés, par les boutons d'origine
     * (grisés : « Démarrer l'observation » pendant un lot, « Démarrer le lot » pendant une séance ouverte) et par l'écran Écho pendant un lot. Sans cela, une
     * séance Écho rouverte en Orbite, un lot affiché dans Écho ou une séance finie rendaient la pause, l'arrêt et la fin inaccessibles. */
    m.bascule = { verrou: false };
    /* Revue T21 (D4, R5, D6) : ce que le panneau d'avant disait en rouge — l'avis de contrat ESV, le refus d'une action (sa ligne d'avis en erreur ;
     * pas quand ESV est déconnecté, ni muet pendant Écho : l'incident le dit déjà), la correction interrompue (tout est refusé jusqu'à « J'ai contrôlé le cut »). */
    const muet = g.connexion?.statut === 'unavailable' || (activite === 'echo' && /ESV ne répond plus/.test(a.echoEtat || ''));
    m.avis = [...new Set([s.avisContrat, s.notice?.erreur && !muet ? s.notice.texte : '', s.relecture?.interrompue].filter(Boolean))];
    if (activite === 'echo') return modeleEcho(s, a, g, m, partie);
    const { primaire, autres } = boutonsPanneau(s.boutonsOrbite, 'automatic');
    /* L'export reste dans la palette pendant le lot et au repos : l'instrument ne garde que les commandes du moment (maquette). */
    const horsExport = !['fini', 'arrete'].includes(a.etat);
    const actions = () => { m.principal = versAction(primaire); m.secondaires = autres.filter(b => b.actif && !(horsExport && b.id === 'export-tout')).map(versAction); };
    /* Connexion T21 : le lot part sur l'onglet que le service worker cible (`connection.tabId`). « Démarrer le lot » n'est permis que si cet onglet est
     * listé, nommé dans la puce, et prêt ; sinon grisé, avec la raison. */
    const cibleOk = g.connexion?.statut === 'ready' && g.connexion?.nomme === true;
    const RAISON_ONGLET = 'Choisis un onglet ESV : le lot part sur l’onglet nommé en haut à droite.';
    const gardeDemarrer = () => { if (cibleOk) return; let vu = false;
      for (const b of [m.principal, ...m.secondaires]) if (b && b.act === 'legacy:start-batch') { b.inactif = true; vu = true; }
      if (vu && !m.raison) m.raison = RAISON_ONGLET; };
    const AL = g.allure || {};
    const reste = a.restants != null && AL.mediane ? a.restants * AL.mediane : null;
    const ligneAllure = () => AL.mediane ? `<b>${un(AL.parMinute)}</b> cuts par minute <span class="sg-sep">·</span> médiane <b>${un(AL.mediane)} s</b> par cut${reste !== null ? ` <span class="sg-sep">·</span> environ <b>${duree(reste)}</b> restantes` : ''}` : '';
    const bornes = a.bornes ? `du cut ${mono(a.bornes.debut ?? '…')} ${a.bornes.fin ? 'au cut ' + mono(a.bornes.fin) : 'jusqu’à la fin de la partie'}` : '';
    /* Ciblage T22 : les bornes du lot restent dites pendant le lot (où il s'arrêtera) ; au repos, ce sont celles du prochain lot (`bornesHtml`). */
    if (a.bornes && ['cours', 'dem', 'pause', 'alerte'].includes(a.etat)) m.bornesLot = `Lot ${bornes}`;
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
        /* Revue T21 (D6) : une correction interrompue bloque tout jusqu'à son acquittement : « J'ai contrôlé le cut N » passe devant. */
        const acq = (s.boutonsOrbite || []).find(x => x.id === 'relecture-acquitter'); if (acq && b.length) b.unshift(versAction(acq));
        if (b.length) { m.principal = b[0]; m.secondaires = b.slice(1); m.raison = r.reprendre && !r.reprendre.actif ? r.reprendre.raison || '' : ''; } else actions();
        break;
      }
      case 'fini': case 'arrete': {
        Object.assign(m, { glyphe: a.etat === 'fini' ? 'fini' : 'arrete', ton: a.etat === 'fini' ? 'vivant' : 'encre2', mot: a.etat === 'fini' ? 'Terminé' : 'Arrêté', objet: 'fin',
          phrase: [partie, esc(s.lot?.finPartie || '')].filter(Boolean).join(' · ') });
        m.fin = [['Lot', `<b>${esc(a.traites)}</b> cuts traités${a.cibles ? ` sur <b>${esc(a.cibles)}</b> ciblés` : ''}`],
          /* Revue T21 (R4) : `vertsNombre` nul = liste des verts pas encore calculée (src/ui5.js) : jamais « 0 vert » ni « rien à examiner ». */
          ['Il reste', a.vertsNombre === null ? `<b class="sg-dif">${esc(nDif(a))}</b> ${pl(nDif(a), 'différé')} · verts pas encore calculés` : nDif(a) + (a.vertsNombre || 0) ? `<b class="sg-dif">${esc(nDif(a))}</b> ${pl(nDif(a), 'différé')}, <b>${esc(a.vertsNombre || 0)}</b> ${pl(a.vertsNombre || 0, 'vert')} à contrôler` : 'rien à examiner'],
          ['Export', esc(s.exportTexte || 'prêt')]];
        /* Ciblage T22 : où le lot s'est arrêté. ESV passé au-delà de son dernier cut (même partie) : les cuts suivants ne sont pas de ce lot, et c'est dit. */
        if (bornes) m.fin.splice(1, 0, ['Bornes', bornes]);
        const H = a.horsLot;
        if (H) m.fin.splice(1, 0, ['Fin du lot', `après le cut ${mono(H.cut ?? '…')}, ESV est passé au cut ${mono(H.vers)}, hors du lot : rien après le cut ${mono(H.fin)} n’est traité par ce lot`]);
        /* Revue T21 (R1) : le résultat de la deuxième passe (en ombre : ce qu'elle poserait, rien n'est écrit), comme le panneau d'avant le disait. */
        const P = a.passeFin;
        if (P) m.fin.push(['Deuxième passe', P.etat === 'calcul' ? 'calcul des cuts restés sans pose…' : P.etat === 'erreur' ? `en erreur${P.message ? ' · ' + esc(P.message) : ''}`
          : P.mode === 'ombre' ? `en ombre : <b>${esc(P.posees)}</b> sur <b>${esc(P.differes)}</b> qu’elle poserait · rien n’est écrit dans ESV`
          : `${P.etat === 'arretee' ? 'arrêtée · ' : ''}<b>${esc(P.ecrites)}</b> posés et validés sur <b>${esc(P.posees)}</b> décidés${P.message ? ' · ' + esc(P.message) : ''}`]);
        actions();
        if (nDif(a) + (a.vertsNombre || 0) > 0) { const ex = (s.boutonsOrbite || []).find(b => b.id === 'export-tout'); m.secondaires = [ex ? versAction(ex) : null, ...m.secondaires.filter(b => b.act !== 'legacy:export-tout'), ...(m.principal && m.principal.act !== 'legacy:export-tout' ? [m.principal] : [])].filter(Boolean); m.principal = { texte: 'Voir ce qui reste', act: 'sg:tiroir', ic: 'liste' }; }
        break;
      }
      default:
        if (a.horsLigne || !cibleOk) {
          const st = g.connexion?.statut, choisi = !!g.onglet && st !== 'no-tab', listes = (s.onglets || []).length, enLigne = !a.horsLigne && st === 'ready';
          /* Connexion T21 : des onglets listés ne sont pas « aucun onglet ouvert » ; ESV lisible mais onglet ciblé absent de la liste : à choisir, pas « Prêt ».
           * Test 22 : un refus de la connexion (ligne d'avis du panneau, en erreur) est dit par `m.avis` (Revue T21, D4), seul endroit des refus. */
          Object.assign(m, { glyphe: 'hors', mot: enLigne ? 'Onglet à choisir' : 'Hors ligne',
            phrase: enLigne ? 'Choisis l’onglet ESV à utiliser' : choisi ? 'Aucune partie affichée dans l’onglet ESV choisi' : listes ? 'Choisis l’onglet ESV à utiliser' : 'Aucun onglet ESV ouvert' });
          actions(); gardeDemarrer();
          const lot = [m.principal, ...m.secondaires].find(b => b && b.act === 'legacy:start-batch');
          m.principal = { texte: choisi && !enLigne ? 'Onglets ESV' : 'Choisir un onglet', act: 'sg:esv' }; m.secondaires = lot ? [lot] : [];
        } else {
          Object.assign(m, { glyphe: 'pret', mot: 'Prêt', phrase: [partie, bornes].filter(Boolean).join(' · '), objet: a.cibles ? 'rail' : null, railEtat: 'vide' });
          actions();
        }
    }
    fileModele(s, a, m, ui);
    gardeDemarrer();
    if (g.connexion?.statut === 'unavailable' && !m.incident && a.etat !== 'p2') m.incident = { texte: 'ESV n’est pas connecté. Si la page ESV est figée, recharge-la (F5), puis reconnecte-la.' };
    if (g.connexion?.statut === 'reconnecting' && !m.incident) m.raison = m.raison || 'Reconnexion à ESV en cours…';
    return m;
  }
  /* CH-025 : la FILE DE PARTIES (CH-017 ; maquette S-file-de-parties.html, variante A, D-261), d'après `snap.file` (src/ui5.js : la carte du panneau d'avant).
   * Au repos, dans l'écran « Prêt » seulement : une entrée discrète « File de parties · prête » qui ouvre la boîte de réglage ; préparée, « Lancer la file »
   * devient l'action principale et « Démarrer le lot » passe à côté. Pendant la file, quel que soit l'état du lot : un bandeau (partie k sur n, phase) avec
   * « Arrêter la file » ; « Démarrer le lot » et « Nouveau lot » sont retirés (la file enchaîne seule) ; le changement de partie verrouille l'écran.
   * File arrêtée ou finie, lot clos : l'écran de la file (alerte, bilan par partie, « Préparer la reprise » ou « Fermer le bilan », l'export en bouton) ;
   * lot encore ouvert ou en alerte : le lot garde l'écran, la file passe dans le bandeau. Chaque bouton est celui de la carte (`#file-principal`,
   * `#file-secondaire`, `#file-n`). */
  const sansDepart = b => b && !/^legacy:(start-batch|new-batch)$/.test(b.act || '');
  /* CH-026 : pendant la file, « Arrêter le lot » (`stop`) arrêtait TOUTE la file (le service worker arrête la file sur `stop`) alors que l'écran dit
   * « seul Arrêter la file l'arrête » ; il apparaissait aussi sous le bouton « Lancer la file » de la boîte (arrêt du test 26). Il est retiré pendant la
   * file : la file s'arrête par « Arrêter la file », qui se confirme (src/ui5.js, `ui.confirmeFile`). */
  const sansArretLot = b => sansDepart(b) && b.act !== 'legacy:stop';
  function fileModele(s, a, m, ui = {}) {
    const F = s.file;
    if (!F) return;
    const P = F.principal, fp = P ? { texte: P.texte, act: 'legacy:file-principal', ic: /^Lancer/.test(P.texte) ? 'play' : '', inactif: !P.actif } : null;
    if (F.etat === 'repos') {
      if (m.etat !== 'pret' || m.glyphe !== 'pret') return;
      if (F.prete && fp) { m.secondaires = [m.principal, ...m.secondaires].filter(Boolean); m.principal = fp; m.raison = m.raison || 'File préparée · relecture et correction après chaque partie. Rien n’est lancé.'; }
      m.secondaires.push({ texte: `File de parties · ${F.prete ? 'préparée' : 'prête'}`, act: 'sg:file' });
      return;
    }
    const conf = !!ui.confirmeFile && F.actif;
    const Se = F.secondaire ? { texte: conf ? 'Confirmer l’arrêt de la file' : F.secondaire.texte, act: 'legacy:file-secondaire', danger: true, inactif: !F.secondaire.actif, confirme: conf } : null;
    m.file = { etatTexte: F.etatTexte, phrase: F.phrase, secondaire: Se };
    if (F.actif) {
      if (!sansArretLot(m.principal)) m.principal = null;
      m.secondaires = m.secondaires.filter(sansArretLot);
      if (F.etat === 'changement' && !a.lotOuvert) Object.assign(m, { glyphe: 'verrou', ton: 'encre2', mot: 'Changement de partie', objet: null, fin: null, incident: null, verrou: true,
        verrouTexte: 'Aucune action pendant le changement de partie', principal: null, secondaires: [], raison: '',
        phrase: `Vers la partie ${mono(F.vers ?? '…')} · Ariane travaille dans ESV · ne touche à rien` });
      return;
    }
    /* CH-026 : file arrêtée, « Reprendre la file » (au rang interrompu, `#file-reprendre`) remplace « Préparer la reprise » : celui-ci oubliait la file, et
     * l'écran suivant offrait le « Reprendre » du LOT, que l'opérateur a pris pour la reprise de la file (test 26, 14:22:11 puis 14:22:15). */
    const rep = F.reprendre ? { texte: F.reprendre.texte, act: 'legacy:file-reprendre', ic: 'play', inactif: !F.reprendre.actif } : null;
    /* CH-026-c : la file arrêtée pendant que le lot, la deuxième passe ou la relecture de sa partie tournent encore : jamais « arrêtée » nu à côté d'une
     * activité vivante, et rien à reprendre ni à relancer avant sa fin (le service worker le refuserait). */
    const enCours = activiteFile(s);
    if (a.lotOuvert || ['alerte', 'p2', 'rel'].includes(m.etat)) { Object.assign(m.file, { alerte: F.alerte, bilan: F.bilan, principal: enCours ? null : rep || fp,
      ...(enCours ? { etatTexte: `attend la fin de ${enCours}`, attente: `${enCours[0].toUpperCase()}${enCours.slice(1)} de la partie continue : la file s’est arrêtée et ne repartira pas seule ; reprends-la à sa fin.` } : {}) }); return; }
    const arret = F.etat === 'arret', ex = (s.boutonsOrbite || []).find(b => b.id === 'export-tout');
    m.file = null;
    Object.assign(m, { glyphe: arret ? (F.alerte ? 'toi' : 'arrete') : 'fini', ton: arret ? (F.alerte ? 'alerte' : 'attention') : 'vivant', mot: arret ? 'File arrêtée' : 'File terminée',
      phrase: esc(F.phrase), objet: null, fin: null, incident: F.alerte ? { texte: F.alerte } : null, verrou: false, raison: '', fileBilan: F.bilan,
      principal: rep || fp, secondaires: [ex ? versAction(ex) : null, { texte: 'Onglet File de parties', act: 'sg:onglet-file' }].filter(Boolean) });
  }
  function modeleEcho(s, a, g, m, partie) {
    const { primaire, autres } = boutonsPanneau(s.boutonsEcho, 'native'), E = g.echo || {};
    const actions = () => { m.principal = versAction(primaire); m.secondaires = autres.filter(b => b.actif).map(versAction); };
    const e = a.echoEtat || 'Aucune séance en cours', vus = Number(s.echo?.visites) || 0, corr = Number(s.echo?.corriges) || 0;
    m.compteEcho = { vus, corriges: corr, valides: Number.isFinite(Number(s.echo?.valides)) ? Number(s.echo.valides) : Math.max(0, vus - corr) };
    if (a.lotOuvert) { Object.assign(m, { glyphe: 'verrou', mot: 'Écho', phrase: 'Disponible après le lot Orbite', verrou: true, verrouTexte: 'Écho est disponible après le lot' }); return m; }
    if (/Collecte en cours|Démarrage/.test(e)) Object.assign(m, { glyphe: 'echo', ton: 'vivant', mot: /Démarrage/.test(e) ? 'Démarrage' : 'En observation', phrase: g.cutEsv != null || a.cutEsv != null ? `Visite du cut ${mono(a.cutEsv ?? g.cutEsv)}` : partie, objet: 'echo' });
    else if (/Collecte en pause/.test(e)) Object.assign(m, { glyphe: 'pause', ton: 'attention', mot: 'Écho en pause', phrase: partie, objet: 'echo' });
    else if (/ESV ne répond plus/.test(e)) Object.assign(m, { glyphe: 'toi', ton: 'alerte', mot: 'ESV ne répond plus', phrase: partie, incident: { texte: 'Si la page ESV reste figée, recharge-la (F5), puis reprends la collecte.' } });
    else if (/Séance à terminer/.test(e)) Object.assign(m, { glyphe: 'pause', ton: 'attention', mot: 'Séance à terminer', phrase: partie, objet: vus ? 'echo' : null });
    else if (/Séance terminée/.test(e)) Object.assign(m, { glyphe: 'fini', ton: 'encre2', mot: 'Séance terminée', phrase: partie, objet: vus ? 'echo' : null });
    else Object.assign(m, { glyphe: 'echoVide', mot: 'Aucune séance', phrase: [partie, 'prête à observer'].filter(Boolean).join(' · ') });
    if (m.objet === 'echo' && E.mediane) m.allure = `<b>${un(60 / E.mediane)}</b> cuts par minute <span class="sg-sep">·</span> médiane <b>${un(E.mediane)} s</b> par cut <span class="sg-sep">·</span> <b>${esc(corr)}</b> corrigés`;
    actions();
    /* Test 23 : en Écho aussi, ESV perdu se dit (comme en Orbite), sauf si l'état le dit déjà. */
    if (g.connexion?.statut === 'unavailable' && !m.incident) m.incident = { texte: 'ESV n’est pas connecté. Si la page ESV est figée, recharge-la (F5), puis reconnecte-la.' };
    return m;
  }

  /* ------------------------------------------------------------------ morceaux */
  function railHtml(a, statuts, etat) {
    const total = a.cibles || null, n = statuts.length, traites = a.traites || 0;
    const echelle = total || Math.max(10, Math.ceil(Math.max(n, traites) * 1.25 / 10) * 10);
    const pos = i => `${Math.max(0, Math.min(100, i / echelle * 100)).toFixed(3)}%`;
    let h = `<div class="sg-rail" data-etat="${esc(etat || 'cours')}" data-total="${total ? 'connu' : 'inconnu'}" role="img" aria-label="${esc(`${traites} traités${total ? ` sur ${total} ciblés` : ', total inconnu'}, ${a.differes || 0} différés`)}"><div class="sg-rail-base"></div>`;
    if (total) {
      const pas = total > 400 ? 50 : 10;
      for (let k = 0; k <= total; k += pas) h += `<div class="sg-rail-grad${k % (pas * 5) === 0 ? ' sg-dix' : ''}" style="left:${pos(k)}"></div>`;
      h += `<div class="sg-rail-num sg-debut">0</div>${total >= 20 ? `<div class="sg-rail-num" style="left:50%">${esc(Math.round(total / 2))}</div>` : ''}<div class="sg-rail-num sg-fin" style="left:100%">${esc(total)}</div>`;
    }
    /* Ordre stable pour la mise à jour en place : le segment fait et le curseur avant les repères, qui s'ajoutent au bout (un nouveau différé apparaît, le curseur glisse). */
    h += `<div class="sg-rail-fait" style="width:${pos(traites)}"></div>`;
    if (etat !== 'vide' && etat !== 'fini') h += `<div class="sg-rail-cur" data-k="cur" style="left:${pos(traites)}"></div>`;
    statuts.forEach((x, i) => { if (x === 'differe') h += `<div class="sg-rail-dif" data-k="d${i}" style="left:${pos(i + 0.5)}"></div>`; else if (x === 'incertain') h += `<div class="sg-rail-inc" data-k="i${i}" style="left:${pos(i + 0.5)}"></div>`; });
    return h + '</div>';
  }
  const avisHtml = m => (m.avis || []).map(t => `<p>${esc(t)}</p>`).join('');
  function objetHtml(snap, m) {
    const a = snap.ar || {}, g = snap.sig || {};
    if (m.incident) return `<div class="sg-incident" data-k="incident" role="alert"><p>${esc(m.incident.texte)}</p>${avisHtml(m)}</div>`;
    if (m.objet === 'fin') return `<dl class="sg-fin" data-k="fin">${m.fin.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
    if (m.objet === 'echo') {
      const c = m.compteEcho, M = (g.echo?.marques || []).slice(-60);
      return `<div class="sg-objet" data-k="echo"><div class="sg-compte"><span class="sg-chiffre">${esc(c.vus)}</span><span class="sg-suite">cuts vus</span><span class="sg-droite"><b>${esc(c.corriges)}</b> corrigés · <b>${esc(c.valides)}</b> validés tels quels</span></div><div class="sg-marques" role="img" aria-label="${esc(`${c.vus} visites, ${c.corriges} corrigées`)}">${M.map(x => `<i class="${x ? 'sg-c' : ''}"></i>`).join('')}${m.glyphe === 'echo' ? '<i class="sg-en"></i>' : ''}</div></div>`;
    }
    if (m.objet !== 'rail') return '';
    if (m.railEtat === 'vide') return `<div class="sg-objet" data-k="rail"><div class="sg-compte"><span class="sg-chiffre">${esc(a.cibles)}</span><span class="sg-suite">cuts ciblés · aucun traité</span></div>${railHtml(a, [], 'vide')}</div>`;
    const droite = `<span class="sg-droite"><b>${esc(a.poses)}</b> posés · <span class="sg-dif">${esc(a.differes)}</span> différés</span>`;
    /* Ciblage T22 : M inconnu (src/ui5.js) : dit tel quel ; le rail n'a alors ni graduations ni total, et l'allure aucun temps restant. */
    return `<div class="sg-objet" data-k="rail"><div class="sg-compte"><span class="sg-chiffre">${esc(a.traites)}</span><span class="sg-suite">${a.cibles ? `traités sur ${esc(a.cibles)} ciblés` : 'traités · total inconnu'}</span>${droite}</div>${railHtml(a, g.statuts || [], m.railEtat || 'cours')}</div>`;
  }
  /* Revue T21 (D7) : les bornes du prochain lot, revues et modifiables avant « Démarrer le lot », au repos et après « Nouveau lot » (règle du panneau
   * d'avant : aucun lot ne part sans que tu aies revu ses bornes). Ce qu'on tape va dans `#start` / `#end` (src/ui5.js), que « Démarrer » lit ;
   * la case clique `#lot-reprise`, dont le gestionnaire remplit les bornes. */
  function bornesHtml(snap, m) {
    const a = snap.ar || {}, B = a.bornesProchain, r = a.reprise;
    if (!B || m.activite !== 'orbite' || a.lotOuvert || m.glyphe === 'hors' || m.file || m.fileBilan) return '';
    return `<div class="sg-bornes"><label><span>Premier cut</span><input type="number" min="0" data-borne="start" placeholder="cut affiché dans ESV" value="${esc(B.debut ?? '')}"></label><label><span>Dernier cut</span><input type="number" min="0" data-borne="end" placeholder="fin de partie" value="${esc(B.fin ?? '')}"></label>${B.note ? `<small>${esc(B.note)}</small>` : ''}${r ? `<label class="sg-reprise"><input type="checkbox" data-act="legacy:lot-reprise"${r.coche ? ' checked' : ''}><span>Reprise des différés : repartir des cuts posés par le lot précédent</span>${r.note ? `<small>${esc(r.note)}</small>` : ''}</label>` : ''}</div>`;
  }
  /* CH-025 : le bandeau de la file (pendant la file, ou arrêtée pendant que le lot garde l'écran) et le bilan par partie (écran de fin de la file). */
  const NOTE_FILE = 'Après chaque partie : <b>relecture et correction</b>, toujours <span class="sg-sep">·</span> aucun export automatique <span class="sg-sep">·</span> seul « Arrêter la file » l’arrête';
  const bilanHtml = L => L?.length ? `<ol class="sg-file-bilan" aria-label="Bilan par partie">${L.map(t => `<li>${esc(t)}</li>`).join('')}</ol>` : '';
  function fileHtml(m) {
    if (m.fileBilan) return bilanHtml(m.fileBilan);
    const F = m.file; if (!F) return '';
    const bt = (b, cls) => b ? `<button type="button" class="${cls}${b.danger ? ' sg-danger' : ''}" data-act="${esc(b.act)}"${b.inactif ? ' disabled' : ''}>${esc(b.texte)}</button>` : '';
    return `<div class="sg-file" data-k="file"><p class="sg-file-t"><b>File de parties</b>${F.etatTexte ? ` <span class="sg-sep">·</span> <span class="sg-mono">${esc(F.etatTexte)}</span>` : ''}</p>${F.phrase ? `<p>${esc(F.phrase)}</p>` : ''}${F.attente ? `<p class="sg-file-attente">${esc(F.attente)}</p>` : ''}${F.alerte ? `<p class="sg-file-alerte" role="alert">${esc(F.alerte)}</p>` : ''}${bilanHtml(F.bilan)}${F.principal || F.secondaire ? `<div class="sg-file-bts">${bt(F.principal, 'sg-secondaire')}${bt(F.secondaire, 'sg-secondaire')}</div>` : ''}<p class="sg-meta">${NOTE_FILE}</p></div>`;
  }
  /* La boîte de réglage (variante A) : le nombre de parties, puis « Préparer la file » (ne lance rien), puis « Lancer la file » (qui referme la boîte). */
  function boiteFileHtml(snap) {
    const F = snap.file; if (!F || F.etat !== 'repos') return '';
    const P = F.principal;
    const seg = F.choix.length ? `<span class="sg-seg" role="group" aria-label="Nombre de parties">${F.choix.map(c => `<button type="button" aria-pressed="${c.choisi}" data-act="sg:file-n:${esc(c.n)}">${esc(c.n)}</button>`).join('')}</span>` : '';
    return `<div class="sg-voile" data-k="voile-file" data-act="sg:fermer"></div><div class="sg-boite" data-k="file" role="dialog" aria-labelledby="sg-file-t"><span class="sg-t" id="sg-file-t">File de parties</span>
<div class="sg-reg"><span class="sg-lib"><span>Nombre de parties</span><small>Premier essai : 2, l’opérateur présent</small></span>${seg}</div>${F.phrase ? `<p class="sg-meta">${esc(F.phrase)}</p>` : ''}
<p class="sg-meta">La relecture et la correction suivent chaque partie, toujours. Pas d’export automatique. Rien n’arrête la file que « Arrêter la file », sauf si continuer est impossible : alerte et bilan. Préparer ne lance rien.</p>
<div class="sg-bts"><button type="button" class="sg-annuler" data-act="sg:fermer">Fermer</button>${P ? `<button type="button" class="sg-principal" data-act="legacy:file-principal"${F.prete ? ' data-fermer="1"' : ''}${P.actif ? '' : ' disabled'}>${F.prete ? ic('play') : ''}<span>${esc(P.texte)}</span></button>` : ''}</div></div>`;
  }
  function actionsHtml(m) {
    if (m.verrou) return `<div class="sg-verrou-ligne">${ic('cadenas')}<span>${esc(m.verrouTexte || 'Aucune action jusqu’à la fin de la deuxième passe')}</span></div>`;
    if (!m.principal && !m.secondaires.length) return m.raison ? `<p class="sg-raison">${esc(m.raison)}</p>` : '';
    let h = '<div class="sg-actions">';
    const p = m.principal;
    if (p) h += `<button type="button" data-k="${esc(p.occupe ? 'occupe' : p.act || '')}" class="sg-principal${p.danger ? ' sg-danger' : ''}"${p.act && !p.occupe ? ` data-act="${esc(p.act)}"` : ''}${p.occupe || p.inactif ? ' disabled' : ''}>${p.occupe ? '<span class="sg-tourne" aria-hidden="true"></span>' : p.ic ? ic(p.ic) : ''}<span>${esc(p.texte)}</span></button>`;
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
      const rows = R.map((r, i) => `<div class="sg-ligne" data-k="${esc(r.cut)}" style="--i:${Math.min(i, 12)}" role="option" data-row="${i}" aria-selected="${sel === i}" tabindex="-1"><span class="sg-cut">${esc(r.cut)}</span><span class="sg-motif">${esc(r.texte)}</span><span class="sg-prec">${esc(r.duree)}</span></div>`).join('');
      return `<div class="sg-corps" role="listbox" aria-label="Visites"><div class="sg-section"><span>Visites</span><span class="sg-n">${esc(snap.echo?.visites ?? 0)}</span><span class="sg-d">les 40 dernières</span></div>${rows || '<div class="sg-vide">Aucune visite pour l’instant.</div>'}</div>`;
    }
    const a = snap.ar || {}, ex = new Set(g.examines || []), go = g.goto || {}, { D, V } = lignesRevue(a);
    const titreOuvrir = !go.present ? 'Disponible avec la prochaine mise à jour du moteur' : !go.actif ? go.raison || 'Indisponible pour l’instant' : 'Ouvrir ce cut dans ESV';
    const outils = r => `<span class="sg-outils"><button type="button"${r.cut !== null && go.present && go.actif ? ` data-act="sg:ouvrir:${esc(r.cut)}"` : ' disabled'} title="${esc(titreOuvrir)}">${ic('ouvrir')}<span>Ouvrir</span></button><button type="button" data-act="sg:examiner:${esc(r.cle)}" aria-pressed="${ex.has(r.cle)}" title="Marquer examiné">${ic('coche')}<span>${ex.has(r.cle) ? 'Examiné' : 'Examiner'}</span></button></span>`;
    const ligne = (r, i) => `<div class="sg-ligne${ex.has(r.cle) ? ' sg-examine' : ''}" data-k="${esc(r.cle)}" style="--i:${Math.min(i, 12)}" role="option" data-row="${i}" aria-selected="${sel === i}" tabindex="-1"><span class="sg-cut">${esc(r.cut ?? '—')}</span><span class="sg-motif">${esc(r.motif)}${r.prec ? ` <small>· ${esc(r.prec)}</small>` : ''}${r.meta ? ` <small>· ${esc(r.meta)}</small>` : ''}</span>${outils(r)}</div>`;
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
      const d = nDif(a), v = a.vertsNombre || 0, vInc = a.vertsNombre === null && !a.lotOuvert;
      n = a.lotOuvert ? d : d + v;
      long = a.lotOuvert ? (d ? `${pl(d, 'différé')} · à reprendre après le lot` : 'Aucun différé pour l’instant') : n ? `à examiner · ${d} ${pl(d, 'différé')}, ${vInc ? 'verts pas encore calculés' : `${v} ${pl(v, 'vert')}`}` : vInc ? 'Verts pas encore calculés' : 'Rien à examiner';
      court = n ? 'à examiner' : vInc ? 'verts pas calculés' : 'rien à examiner';
      if (total && !a.lotOuvert) resteTx = `reste à examiner ${reste} sur ${total}`;
    }
    const mini = `<span class="sg-etat-mini">${glyphe(m)}<span>${esc(m.mot)}${m.activite === 'orbite' && a.cibles && ['cours', 'dem', 'pause'].includes(m.etat) ? ` · ${esc(a.traites)} sur ${esc(a.cibles)}` : ''}</span></span>`;
    return `<button type="button" class="sg-poignee" data-act="sg:tiroir" aria-expanded="${!!ui.tiroir}" aria-controls="sg-tiroir-corps">${ic('fleche', 'sg-fl')}<span class="sg-txt">${n ? `<span class="sg-n${m.activite === 'orbite' && nDif(a) ? ' sg-dif' : ''}">${esc(n)}</span> ` : ''}<span class="sg-long">${esc(long)}</span><span class="sg-court">${esc(court)}</span></span>${resteTx ? `<span class="sg-reste">${esc(resteTx)}</span>` : ''}${mini}</button>`;
  }
  /* Bande du cache : le bouton d'origine, et sa raison tant qu'il est impossible (même règle que le panneau d'origine). */
  function cacheHtml(snap, m) {
    const a = snap.ar || {}, rel = !!(snap.relecture?.actif || snap.relPause?.pause || snap.relPause?.reprendre || snap.relPause?.arreter);
    const ok = a.cache?.actif === true && !rel;
    const raison = ok ? '' : a.etat === 'p2' ? 'après la deuxième passe' : rel ? 'après la relecture' : m.activite === 'echo' && echoOuvert(a.echoEtat) ? 'après la séance Écho' : a.lotOuvert ? 'après le lot' : 'indisponible pour l’instant';
    return `<footer class="sg-cache"><span class="sg-q"><span class="sg-lib">Cache des exports</span></span>${raison ? `<span class="sg-r">· ${esc(raison)}</span>` : ''}<span class="sg-espace"></span><button type="button" data-act="legacy:export-cache-clear"${ok ? '' : ' disabled'}>Vider le cache</button></footer>`;
  }
  function barreHtml(snap, m, ui) {
    const g = snap.sig || {}, b = m.bascule, st = g.connexion?.statut, a = snap.ar || {};
    /* CH-026 : troisième onglet « File » (la file de parties) : une vue de Signal ; Orbite et Écho y redeviennent cliquables. */
    const surFile = ui.onglet === 'file' && !!snap.file;
    const seg = (k, t) => { const choisi = !surFile && m.activite === k, off = b.verrou && m.activite !== k; return `<button type="button" role="tab" aria-selected="${choisi}"${off ? ` aria-disabled="true" data-raison="${esc(b.raison)}"` : choisi ? '' : ` data-act="mode:${k === 'echo' ? 'native' : 'automatic'}"`}>${off ? ic('cadenas') : ''}${t}</button>`; };
    const segFile = snap.file ? `<button type="button" role="tab" aria-selected="${surFile}"${surFile ? '' : ' data-act="sg:onglet-file"'}>File</button>` : '';
    const etatPuce = st === 'unavailable' || a.esv === 'ko' ? 'ko' : st === 'reconnecting' ? 'libre' : !g.onglet || st === 'no-tab' ? 'aucun' : a.lotOuvert ? 'verrou' : 'ok';
    /* Connexion T21 : le service worker garde un onglet prêt que la liste ne nomme pas : « à choisir », jamais « Aucun onglet » (le lot y partirait). */
    const texte = etatPuce === 'ko' ? 'ESV ne répond plus' : st === 'reconnecting' ? 'Reconnexion…' : etatPuce === 'aucun' ? (st === 'ready' && g.connexion?.tabId ? 'Onglet à choisir' : 'Aucun onglet') : g.onglet;
    const court = String(texte).split(' · ')[0];
    return `<header class="sg-barre"><span class="sg-logo">${IC.logo}<span>Ariane</span></span><div class="sg-bascule" role="tablist" aria-label="Activité">${seg('orbite', 'Orbite')}${seg('echo', 'Écho')}${segFile}</div><span class="sg-espace"></span>
<button type="button" class="sg-puce" data-etat="${etatPuce}" data-act="sg:esv" aria-haspopup="dialog" aria-expanded="${ui.couche === 'esv'}" title="${a.lotOuvert ? 'Garde son onglet jusqu’à la fin du lot' : 'Choisir l’onglet ESV'}"><i></i><span class="sg-tx"><span class="sg-long">${esc(texte)}</span><span class="sg-court">${esc(court)}</span></span>${ic(etatPuce === 'verrou' ? 'cadenas' : 'bas', 'sg-fl')}</button>
<button type="button" class="sg-ico sg-ico-palette" data-act="sg:palette" aria-label="Commandes (Ctrl K)" title="Commandes · Ctrl K" aria-pressed="${ui.couche === 'palette'}">${ic('palette')}</button><button type="button" class="sg-ico" data-act="sg:reglages" aria-label="Réglages" title="Réglages" aria-pressed="${ui.couche === 'reglages'}">${ic('reglages')}</button></header>${ui.note ? `<div class="sg-barre-note" data-k="note" role="status">${esc(ui.note)}</div>` : ''}`;
  }

  /* ------------------------------------------------------------------ couches */
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function commandes(snap, m, ui) {
    const a = snap.ar || {}, g = snap.sig || {}, c = [], vus = new Set();
    /* Revue T21 (G1) : `danger` (arrêter le lot ou la relecture, SKIP, terminer la séance Écho) : la palette demande une seconde Entrée (src/ui5.js). */
    const add = (icn, nom, act, et, off, danger) => { if (!act || vus.has(act)) return; vus.add(act); c.push({ ic: icn, nom, act, et: et || '', off: off || '', danger: !!danger || act === 'legacy:native-end' }); };
    const etat = `${m.activite === 'echo' ? 'Écho' : 'Orbite'} · ${m.mot}${m.activite === 'orbite' && a.cibles && ['cours', 'dem', 'pause'].includes(m.etat) ? ` · ${a.traites} sur ${a.cibles}` : ''}`;
    if (m.principal && !m.principal.occupe) add(m.principal.ic || 'play', m.principal.texte, m.principal.act, etat, m.principal.inactif ? m.raison || 'indisponible' : '', m.principal.danger);
    for (const b of m.secondaires) add(b.danger ? 'stop' : b.ic || 'coche', b.texte, b.act, '', b.inactif ? 'indisponible' : '', b.danger);
    /* CH-025 : pendant la file, « Arrêter la file » (bandeau) ; arrêtée pendant que le lot garde l'écran, son bouton de reprise ou de bilan. */
    if (m.file?.secondaire) add('stop', m.file.secondaire.texte, m.file.secondaire.act, 'File de parties', m.file.secondaire.inactif ? 'indisponible' : '', true);
    if (m.file?.principal) add('liste', m.file.principal.texte, m.file.principal.act, 'File de parties', m.file.principal.inactif ? 'indisponible' : '');
    add('liste', ui.tiroir ? 'Fermer le tiroir' : 'Voir ce qui reste', 'sg:tiroir', '');
    const ex = (snap.boutonsOrbite || []).find(b => b.id === 'export-tout');
    add('export', 'Exporter le dossier', 'legacy:export-tout', '', ex && ex.actif ? '' : a.lotOuvert ? 'après le lot' : 'indisponible pour l’instant');
    const autre = m.activite === 'echo' ? 'orbite' : 'echo';
    add(autre === 'echo' ? 'echo' : 'orbite', autre === 'echo' ? 'Passer en Écho' : 'Passer en Orbite', `mode:${autre === 'echo' ? 'native' : 'automatic'}`, '', m.bascule.verrou ? m.bascule.raison : '');
    if (snap.file && ui.onglet !== 'file') add('liste', 'Onglet File de parties', 'sg:onglet-file', '');
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
    return `<div class="sg-voile" data-k="voile-palette" data-act="sg:fermer"></div><div class="sg-palette" data-k="palette" role="dialog" aria-label="Commandes"><input id="ui5-q" type="text" value="${esc(ui.q)}" placeholder="Commande…" autocomplete="off" spellcheck="false" aria-label="Rechercher une commande"><div class="sg-cmds" role="listbox">${L.length ? L.map((c, k) => `<button type="button" class="sg-cmd" role="option" aria-selected="${k === i}"${c.off ? ' aria-disabled="true"' : ` data-act="${esc(c.act)}"`} data-fermer="1">${ic(c.ic)}<span>${esc(c.nom)}</span><span class="sg-et">${esc(c.off || (ui.confirme === c.act ? 'Entrée encore pour confirmer' : c.et))}</span></button>`).join('') : '<div class="sg-cmd"><span></span><span class="sg-et">Aucune commande</span></div>'}</div><div class="sg-pied"><span><kbd>↑</kbd> <kbd>↓</kbd> choisir</span><span><kbd>Entrée</kbd> exécuter</span><span class="sg-espace"></span><span><kbd>Échap</kbd> fermer</span></div></div>`;
  }
  function esvHtml(snap) {
    const g = snap.sig || {}, a = snap.ar || {}, L = snap.onglets || [], choisi = String(snap.ongletChoisi || ''), verrou = !!a.lotOuvert || !!a.connexionBloquee;
    /* Connexion T21 : « connecté » seulement pour l'onglet choisi ET prêt ; un onglet choisi d'avance par le panneau (onglet unique, seul prêt) garde son bouton. */
    const rows = L.length ? L.map(o => { const mien = String(o.valeur) === choisi, pasPret = /pas prêt/i.test(o.texte);
      return `<div class="sg-ong"><span class="sg-lib"><b>${esc(o.texte)}</b>${pasPret ? '<small>pas prêt</small>' : ''}</span>${mien && g.connexion?.statut === 'ready' ? '<span class="sg-conn"><i></i>connecté</span>' : `<button type="button" data-act="conn:${esc(o.valeur)}"${verrou && !mien || pasPret ? ' disabled' : ''}>${mien ? 'Reconnecter' : 'Connecter'}</button>`}</div>`; }).join('')
      : '<div class="sg-vide sg-petit">Aucun onglet ESV ouvert. Ouvre une partie dans ESV ; elle apparaîtra ici.</div>';
    const rc = g.connexion?.reconnect;
    const reco = rc?.visible ? `<div class="sg-ong"><span class="sg-lib"><b>Reconnecter</b><small>${esc(g.connexion.statut === 'reconnecting' ? 'en cours…' : 'ré-équiper l’onglet choisi')}</small></span><button type="button" data-act="legacy:reconnect"${rc.actif ? '' : ' disabled'}>Reconnecter</button></div>` : '';
    return `<div class="sg-voile sg-transparent" data-k="voile-esv" data-act="sg:fermer"></div><div class="sg-popover" data-k="esv" role="dialog" aria-label="Onglets ESV">${rows}${reco}<div class="sg-pied">${verrou ? ic('cadenas') + '<span>Une seule connexion, gardée jusqu’à la fin du lot.</span>' : `<span>${esc(snap.connexionNote || 'Une seule connexion, partagée entre Orbite et Écho.')}</span>`}</div></div>`;
  }
  const PARIS = (() => { try { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch { return null; } })();
  function historiqueHtml(H) {
    if (!Array.isArray(H)) return '';
    const FIN = { complete: 'terminée', arretee: 'arrêtée', 'en-cours': 'en cours', interrompue: 'interrompue' };
    /* Heure de Paris (règle du panneau d'origine, `paris()` de panel.js), pas celle de la machine. */
    const jour = iso => { const d = iso ? new Date(iso) : null; if (!d || isNaN(d) || !PARIS) return ''; const q = {}; for (const x of PARIS.formatToParts(d)) q[x.type] = x.value; return `${q.day}/${q.month} ${Number(q.hour === '24' ? 0 : q.hour)} h ${q.minute}`; };
    const L = H.slice(0, 12).map(p => `<div class="sg-hist"><span class="sg-mono">${esc(p.part ?? '—')}</span><span>${esc(FIN[p.fin] || p.fin || '')}${p.cibles != null ? ` · ${esc(p.cibles)} ciblés` : ''}${p.poses != null ? ` · ${esc(p.poses)} posés` : ''}${p.differes != null ? ` · ${esc(p.differes)} différés` : ''}${Number.isInteger(p.sautes) ? ` · ${esc(p.sautes)} ${pl(p.sautes, 'skippé')}` : ''}${p.depart?.ignores ? ` · ${esc(p.depart.ignores)} ignorés au départ` : ''}</span><small>${esc(jour(p.startedAt))}</small></div>`).join('');
    return `<div class="sg-reg sg-reg-bloc"><span class="sg-lib"><span>Parties traitées</span><small>Gardées même après un vidage du cache</small></span></div>${L || '<div class="sg-vide sg-petit">Aucune partie enregistrée pour l’instant.</div>'}`;
  }
  function feuilleHtml(snap) {
    const r = snap.reglages || {}, g = snap.sig || {};
    const sel = (nom, valeurs, courant, aide) => `<select data-sel="${esc(nom)}" aria-label="${esc(aide)}">${valeurs.map(([v, l]) => `<option value="${esc(v)}"${v === courant ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const seg = (nom, valeurs, courant, aide) => `<span class="sg-seg" role="group" aria-label="${esc(aide)}">${valeurs.map(([v, l]) => `<button type="button" aria-pressed="${v === courant}" data-act="sg:choix:${esc(nom)}:${esc(v)}">${esc(l)}</button>`).join('')}</span>`;
    const ligne = (t, aide, ctl) => `<div class="sg-reg"><span class="sg-lib"><span>${esc(t)}</span>${aide ? `<small>${esc(aide)}</small>` : ''}</span>${ctl}</div>`;
    const discard = (snap.boutonsEcho || []).find(b => b.id === 'native-discard');
    return `<div class="sg-feuille" data-k="reglages" role="dialog" aria-label="Réglages"><div class="sg-tete"><span class="sg-t">Réglages</span><span class="sg-meta">jamais en séance</span><kbd>Échap</kbd><button type="button" class="sg-ico" data-act="sg:fermer" aria-label="Fermer">${ic('croix')}</button></div><div class="sg-liste">
 ${snap.relectureModifiable ? ligne('Après le lot', 'Relecture des verts sûrs · gardé pour le prochain lot', sel('relecture', [['coupee', 'Rien'], ['ombre', 'Relire sans rien modifier'], ['corriger', 'Relire et corriger']], r.relecture, 'Après le lot')) : ''}
 ${ligne('Clic du mode rapide', 'gardé pour le prochain lot', sel('clic', [['tel-quel', 'Comme avant'], ['gauche-recentre', 'Rail gauche recentré'], ['tout-recentre', 'Tout recentré']], r.clic, 'Clic du mode rapide'))}
 ${ligne('Série de différés', 'Mettre en attente les cuts voisins', seg('grappe', [['non', 'Non'], ['oui', 'Oui']], r.grappe ? 'oui' : 'non', 'Série de différés'))}
 ${ligne('Deuxième passe (en ombre)', 'En fin de lot, note ce qu’elle poserait pour les cuts restés sans pose, sans rien écrire dans ESV', sel('passe2', [...(r.passe2 === null ? [['', 'État inconnu']] : []), ['oui', 'Allumée'], ['non', 'Coupée']], r.passe2 === null ? '' : r.passe2 ? 'oui' : 'non', 'Deuxième passe'))}
 ${ligne('Raison de la correction (Écho)', 'Lue au démarrage d’Écho', sel('raison', [['non', 'Non'], ['chiffres', 'Oui · chiffres du haut'], ['alt-chiffres', 'Oui · Alt + chiffre'], ['pave', 'Oui · pavé numérique']], r.raison ? r.touches || 'chiffres' : 'non', 'Raison de la correction'))}
 ${g.f5 ? ligne('Si ESV est rechargé pendant la relecture', '', sel('f5', [['pause', 'Attendre, puis reprendre'], ['arret', 'Arrêter la relecture']], g.f5, 'Si ESV est rechargé')) : ''}
 ${ligne('Bandeau dans ESV', 'Une ligne d’état au bas de la page ESV', seg('bandeau', [['non', 'Éteint'], ['oui', 'Allumé']], r.bandeau ? 'oui' : 'non', 'Bandeau dans ESV'))}
 ${ligne('Thème', '', seg('theme', [['sombre', 'Sombre'], ['clair', 'Clair']], g.theme === 'clair' ? 'clair' : 'sombre', 'Thème'))}
 ${snap.gcv2 ? `<div class="sg-reg"><span class="sg-lib"><span>Exemples d’apprentissage</span><small>cuts corrigés dans les Échos archivées, tous projets · au ${esc(snap.gcv2.date)} · ne mesure aucune qualité</small></span><span class="sg-mono">${esc(snap.gcv2.total)}</span></div>` : ''}
 ${historiqueHtml(g.historique)}
 <div class="sg-bas"><button type="button" class="sg-lien" data-act="sg:tech">${ic('liste')}<span>Détails techniques : santé de la collecte, exports de diagnostic, journal, résumé de la partie</span></button>${snap.exportTexte ? `<p class="sg-meta">${esc(snap.exportTexte)}</p>` : ''}${discard ? `<div class="sg-danger-zone"><span>Séance Écho : supprime ses données, avec confirmation.</span><button type="button" data-act="legacy:native-discard"${discard.actif ? '' : ' disabled'}>Abandonner la séance Écho…</button></div>` : ''}</div></div></div>`;
  }

  /* ------------------------------------------------------------------ écran */
  /* CH-026 : L'ONGLET « File de parties » (maquette Figma, page « CH-026 · Onglet File de parties » : prête, en cours, arrêtée avec alerte, finie). D'après
   * `snap.file` (src/ui5.js : la carte de la file du panneau d'origine et ses boutons). Lancer, reprendre, relancer, arrêter : des clics sur les boutons
   * d'origine (`#file-lancer`, `#file-reprendre`, `#file-secondaire`, `#file-n`) ; l'export est celui d'Orbite. Aucun message nouveau au service worker. */
  const nP = n => `${n} ${n > 1 ? 'parties' : 'partie'}`;
  const milliers = v => Number.isInteger(v) ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') : '';
  /* CH-026-c : l'activité de la partie qui tourne encore (le lot, la deuxième passe, la relecture), dite en clair ; null s'il n'y en a pas. */
  const activiteFile = s => { const a = s.ar || {}; return a.etat === 'rel' ? 'la relecture' : a.etat === 'p2' ? 'la deuxième passe' : a.lotOuvert ? 'le lot' : null; };
  function ongletFileModele(s, u) {
    const F = s.file, actif = !!F.actif, etat = F.etat, R = F.reprise, aff = F.partieAffichee;
    const PH = { lot: 'lot en cours', passe: 'deuxième passe', relecture: 'relecture et correction', changement: 'changement de partie' };
    const m = { glyphe: 'pret', ton: 'encre2', mot: 'File prête', phrase: '', bandeau: null, alerte: '', lancer: null, bilan: F.bilan || [], vide: '' };
    const bt = (b, act, cls) => b ? { texte: b.texte, act, inactif: !b.actif, cls } : null;
    const ex = (s.boutonsOrbite || []).find(b => b.id === 'export-tout');
    const lancer = bt(F.lancer, 'legacy:file-lancer', 'plein');
    if (actif) {
      const conf = !!u.confirmeFile;
      Object.assign(m, { glyphe: 'cours', ton: 'vivant', mot: 'File en cours', phrase: `Partie ${(F.rang ?? 0) + 1} sur ${F.n ?? '?'} · partie ${F.part ?? F.vers ?? '?'} · ${PH[etat] || etat}`,
        vide: 'Aucune partie finie pour l’instant.',
        bandeau: { etatTexte: F.etatTexte, phrase: F.phrase, secondaire: F.secondaire ? { texte: conf ? 'Confirmer l’arrêt de la file' : F.secondaire.texte, act: 'legacy:file-secondaire', danger: true, inactif: !F.secondaire.actif } : null } });
      return m;
    }
    const seg = F.choixTous || [];
    const enCours = activiteFile(s);
    if (etat === 'arret' && enCours) {
      /* CH-026-c : arrêtée pendant que l'activité de la partie tourne : la dire, et rien à reprendre ni à relancer avant sa fin. */
      const off = b => b && { ...b, inactif: true };
      Object.assign(m, { glyphe: 'pause', ton: 'attention', mot: `Attend la fin de ${enCours}`, phrase: esc(F.phrase), alerte: F.alerte,
        lancer: { seg: [], note: `${enCours[0].toUpperCase()}${enCours.slice(1)} de la partie continue : la file s’est arrêtée et ne repartira pas seule. Reprise et nouvelle file : à sa fin.`,
          boutons: [off(bt(F.reprendre, 'legacy:file-reprendre', 'plein')), off(lancer && { ...lancer, cls: F.reprendre ? 'second' : 'plein' })].filter(Boolean) } });
    } else if (etat === 'arret') {
      const rep = bt(F.reprendre, 'legacy:file-reprendre', 'plein');
      Object.assign(m, { glyphe: F.alerte ? 'toi' : 'arrete', ton: F.alerte ? 'alerte' : 'attention', mot: 'File arrêtée', phrase: esc(F.phrase), alerte: F.alerte,
        lancer: { seg, note: R ? `La reprise part de la partie ${R.part} (rang ${R.rang + 1} sur ${F.n}) : ESV doit l’afficher. « Nouvelle file » part de la partie affichée.` : 'Tout est fait : une nouvelle file part de la partie affichée.',
          boutons: [rep, lancer && { ...lancer, cls: rep ? 'second' : 'plein' }].filter(Boolean) } });
    } else if (etat === 'fin') {
      Object.assign(m, { glyphe: 'fini', ton: 'vivant', mot: 'File terminée', phrase: esc(F.phrase),
        lancer: { seg, note: 'Une nouvelle file part de la partie affichée dans ESV, sans recharger l’extension.', boutons: [lancer, ex ? { texte: 'Exporter le dossier', act: 'legacy:export-tout', inactif: !ex.actif, cls: 'second' } : null].filter(Boolean) } });
    } else {
      Object.assign(m, { phrase: aff !== null ? `Partie ${mono(aff)} affichée dans ESV · rien n’est lancé` : 'Aucune partie affichée dans ESV · rien n’est lancé', vide: 'Aucune file lancée depuis l’ouverture du panneau.',
        lancer: { seg, note: `À partir de la partie affichée dans ESV${aff !== null ? ` (partie ${aff})` : ''}, puis les suivantes du sélecteur. Relecture et correction après chaque partie, toujours. Pas d’export automatique.`, boutons: [lancer].filter(Boolean) } });
    }
    return m;
  }
  function ongletFileHtml(s, u) {
    const m = ongletFileModele(s, u), F = s.file;
    const bouton = b => b ? `<button type="button" class="${b.cls === 'plein' ? 'sg-principal' : 'sg-secondaire sg-cadre'}${b.danger ? ' sg-danger' : ''}" data-act="${esc(b.act)}"${b.inactif ? ' disabled' : ''}>${b.cls === 'plein' ? ic('play') : ''}<span>${esc(b.texte)}</span></button>` : '';
    const titre = t => `<h2 class="sg-of-t">${esc(t)}</h2>`;
    let h = `<div class="sg-groupe-etat"><div class="sg-etat">${glyphe(m)}<span class="sg-mot">${esc(m.mot)}</span></div><p class="sg-phrase">${m.phrase}</p></div>`;
    if (m.bandeau) { const B = m.bandeau; h += `<div class="sg-file" data-k="file"><p class="sg-file-t"><b>File de parties</b>${B.etatTexte ? ` <span class="sg-sep">·</span> <span class="sg-mono">${esc(B.etatTexte)}</span>` : ''}</p>${B.phrase ? `<p>${esc(B.phrase)}</p>` : ''}${B.secondaire ? `<div class="sg-file-bts"><button type="button" class="sg-secondaire sg-danger" data-act="${esc(B.secondaire.act)}"${B.secondaire.inactif ? ' disabled' : ''}>${esc(B.secondaire.texte)}</button></div>` : ''}<p class="sg-meta">${NOTE_FILE}</p></div>`; }
    if (m.alerte) h += `<div class="sg-incident" role="alert"><p>${esc(m.alerte)}</p></div>`;
    if (m.lancer) { const L = m.lancer;
      h += `<section class="sg-of-sec" aria-label="Lancer la file">${titre('Lancer la file')}${L.seg.length ? `<div class="sg-of-ligne"><span>Nombre de parties</span><span class="sg-seg" role="group" aria-label="Nombre de parties">${L.seg.map(c => `<button type="button" aria-pressed="${c.choisi}" data-act="sg:file-n:${esc(c.n)}">${esc(c.n)}</button>`).join('')}</span></div>` : ''}<p class="sg-meta">${esc(L.note)}</p>${L.boutons.length ? `<div class="sg-actions">${L.boutons.map(bouton).join('')}</div>` : ''}</section>`; }
    h += `<section class="sg-of-sec" aria-label="Bilan de la file">${titre('Bilan de la file')}${m.bilan.length ? bilanHtml(m.bilan) : `<p class="sg-meta">${esc(m.vide)}</p>`}</section>`;
    const D = F.departs || [];
    h += `<section class="sg-of-sec" aria-label="Départs des parties">${titre('Départs des parties')}${D.length ? `<table class="sg-of-departs"><thead><tr><th scope="col">Partie</th><th scope="col">Départ</th><th scope="col">validés</th><th scope="col">invalides</th><th scope="col">skippés</th><th scope="col">total</th></tr></thead><tbody>${D.map(d => `<tr><td class="sg-mono">${esc(d.partie ?? '?')}</td><td>${esc(d.heure)}</td><td>${milliers(d.valides)}</td><td>${milliers(d.invalides)}</td><td>${milliers(d.skippes)}</td><td>${milliers(d.total)}</td></tr>`).join('')}</tbody></table><p class="sg-meta">Chiffres de la liste d’ESV au départ de chaque lot ; skippés : le compte « skipped » d’ESV.</p>` : '<p class="sg-meta">Aucun départ de partie noté pour l’instant.</p>'}</section>`;
    return `<section class="sg-instrument sg-onglet-file" aria-live="polite" aria-label="File de parties">${h}</section>`;
  }
  function rendre(snap, ui) {
    const s = snap || {}, u = ui || {}, m = modele(s, u);
    if (u.onglet === 'file' && s.file) {
      const couche = u.couche === 'palette' ? paletteHtml(s, u) : u.couche === 'reglages' ? feuilleHtml(s) : u.couche === 'esv' ? esvHtml(s) : '';
      return `<div class="sg-fen" data-activite="file" data-etat="${esc(s.file.etat)}">${barreHtml(s, m, u)}${ongletFileHtml(s, u)}${cacheHtml(s, m)}${couche}</div>`;
    }
    const instrument = `<section class="sg-instrument" aria-live="polite"><div class="sg-groupe-etat"><div class="sg-etat">${glyphe(m)}<span class="sg-mot">${esc(m.mot)}</span></div><p class="sg-phrase">${m.phrase}</p>${m.bornesLot ? `<p class="sg-lot-bornes">${m.bornesLot}</p>` : ''}</div>${!m.incident && avisHtml(m) ? `<div class="sg-incident" role="alert">${avisHtml(m)}</div>` : ''}${objetHtml(s, m)}${fileHtml(m)}${bornesHtml(s, m)}${m.allure ? `<p class="sg-allure">${m.allure}</p>` : ''}${actionsHtml(m)}</section>`;
    const couche = u.couche === 'palette' ? paletteHtml(s, u) : u.couche === 'reglages' ? feuilleHtml(s) : u.couche === 'esv' ? esvHtml(s) : u.couche === 'file' ? boiteFileHtml(s) : '';
    return `<div class="sg-fen" data-activite="${m.activite}" data-etat="${esc(m.etat)}">${barreHtml(s, m, u)}${instrument}<div class="sg-zone"><div class="sg-tiroir" data-ouvert="${u.tiroir ? 1 : 0}">${poigneeHtml(s, m, u)}<div id="sg-tiroir-corps"${u.tiroir ? '' : ' inert'}>${tiroirHtml(s, m, u)}</div></div></div>${cacheHtml(s, m)}${couche}</div>`;
  }

  return { esc, quantile, allureLot, ciblesBornes, modele, commandes, paletteListe, lignesRevue, rendre, duree };
});
