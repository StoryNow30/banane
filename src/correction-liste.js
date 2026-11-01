/* CH-028 — LA LISTE DE CUTS À CORRIGER (correction dans Orbite). Module PUR : aucun DOM, aucun message, aucune API Chrome, aucune écriture.
 *
 * À la fin d'un lot (ou de chaque partie d'une file), Ariane propose les cuts qu'elle juge probablement faux, d'après des signaux qu'elle a déjà
 * au journal ; l'opérateur les corrige et les valide lui-même dans ESV, Écho enregistre ses visites. Ce module ne fait que LIRE les événements
 * du journal d'un lot et rendre la liste ; le service worker l'inscrit au journal (`correction-liste`, donc dans l'export Orbite) et
 * tools/correction-liste.cjs la rejoue hors ligne sur les exports de banane-data.
 *
 * Population (mêmes définitions que tools/juger-lot.cjs et CH-015 predicteurs-valider.cjs) :
 *   - lot : le dernier `batch-started` de la partie (ou celui de `batchId`) ; fenêtre du départ à 5 s après `batch-stopped-at-end` ;
 *   - cible : cut qui a reçu une décision du lot (`gcv1-shadow-observed` de ce lot), hors cut de départ déjà vert (`depart-sur-vert` < 30 s) ;
 *   - posé : cible dont la ligne a reçu une écriture 2xx « valid » traitée par l'opérateur pendant la fenêtre ; différé : cible sans elle.
 *     Les écritures de la deuxième passe (`passe-differes-ecriture` « ecrit ») comptent aussi comme posés, avec leur propre signal.
 *
 * Signaux (une entrée de la liste en porte au moins un ; `cle` stable, utilisée par l'export et par Signal) :
 *   differe          différé resté sans pose à la fin du lot (motif du lot ou de la garde) : groupe « à poser » ;
 *   apres-differe    posé dont un des deux cuts précédents est un différé (R1 de CH-015 : 13 des 21 poses à plus de 50 mm de la partie 20) ;
 *   sans-appui       posé par une commande du LOT (window, choice, GCV2 L1) sans appui de chaîne (46 % de faux parmi les jugés sans appui,
 *                    partie 20) ; seul il n'entre pas (trop coûteux, CH-015 § 8) : il entre avec `apres-differe`, ou seul s'il est posé par le lot ;
 *   garde-suivant    posé que l'événement `garde-apres-differe-suivant` signale (cut voisin d'un cut différé par la garde R3) ;
 *   passe-ecrite     cut écrit par la deuxième passe (pire déplacement du rail donné) ;
 *   relecture        la relecture après le lot dit « je corrigerais » sans avoir corrigé (règle prudente non passée) ;
 * L'ombre « faux vert » n'est pas lue : seuls son module, la décision sur le lot et le réglage la nomment (tests/faux-vert-ombre.test.cjs), et elle
 * n'a signalé aucun cut sur les lots mesurés (partie 20 : 0 sur 721 ; partie 10 : « valider » partout).
 * Chaque entrée : { part, cut, groupe: 'corriger'|'poser', signaux: [cle…], details: {…}, rang }. Le rang ordonne la liste (le plus fort d'abord,
 * puis l'ordre des cuts). Aucun chiffre n'est deviné : un signal absent du journal n'est simplement pas porté. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api; else root.ArianeCorrectionListe = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'correction-liste-1';
  const VERSION_PARCOURS = 'correction-parcours-1';
  const DEPART_VERT_S = 30, FIN_APRES_ARRET_S = 5;
  /* Ordre de force (le premier est le plus probablement faux). */
  const SIGNAUX = ['passe-ecrite', 'apres-differe', 'sans-appui', 'garde-suivant', 'relecture', 'differe'];
  const LIBELLE = {
    'passe-ecrite': 'écrit par la deuxième passe', 'apres-differe': 'juste après un différé', 'sans-appui': 'posé sans appui',
    'garde-suivant': 'voisin d’un cut gardé', relecture: 'la relecture le corrigerait', differe: 'différé',
  };
  const fini = Number.isFinite;
  const instant = e => { const t = Date.parse(e && e.timestamp || ''); return fini(t) ? t : null; };
  const entier = Number.isInteger;

  /* Le lot de la partie et sa fenêtre. */
  function lotDe(events, partie, batchId) {
    const ev = (events || []).filter(e => e && instant(e) !== null).sort((a, b) => instant(a) - instant(b));
    const departs = ev.filter(e => e.type === 'batch-started' && e.batch && e.batch.id);
    const decisions = new Map();
    for (const e of ev) if (e.type === 'gcv1-shadow-observed' && e.batchId) decisions.set(e.batchId, (decisions.get(e.batchId) || 0) + 1);
    const dePart = departs.filter(e => e.identity && e.identity.part === partie);
    /* Hors ligne, sans `batchId` : le lot de la partie qui a le plus de décisions (le dernier à égalité) ; une reprise fermée au départ
     * (`depart-sur-vert`, file de 3 parties du 30/10, partie 4) n'en a qu'une et ne masque pas le vrai lot. */
    const mien = batchId ? departs.filter(e => e.batch.id === batchId).pop()
      : dePart.reduce((m, e) => !m || (decisions.get(e.batch.id) || 0) >= (decisions.get(m.batch.id) || 0) ? e : m, null);
    if (!mien) return null;
    const B = mien.batch.id, t0 = instant(mien), part = entier(partie) ? partie : mien.identity && mien.identity.part;
    let fin = Infinity;
    const suivant = departs.find(e => instant(e) > t0 && e.batch.id !== B);
    if (suivant) fin = instant(suivant);
    const arret = ev.find(e => e.type === 'batch-stopped-at-end' && instant(e) > t0 && instant(e) < fin);
    if (arret) fin = Math.min(fin, instant(arret) + FIN_APRES_ARRET_S * 1000);
    else { const rel = ev.find(e => e.type === 'relecture-debut' && e.batchId === B); if (rel) fin = Math.min(fin, instant(rel)); }
    return { ev, B, t0, fin, part };
  }

  const maxDecal = d => { let m = null; for (const c of ['left', 'right']) { const v = d && d[c]; if (Array.isArray(v)) for (const x of v) if (fini(x)) m = Math.max(m ?? 0, Math.abs(x)); } return m; };
  const arr1 = v => fini(v) ? Math.round(v * 10) / 10 : null;

  function construire(events, options = {}) {
    const lot = lotDe(events, options.partie, options.batchId);
    if (!lot) return { version: VERSION, trouve: false, partie: options.partie ?? null, batchId: options.batchId ?? null, entrees: [], comptes: null };
    const { ev, B, t0, fin, part } = lot;
    const dePartie = e => e.identity && e.identity.part === part && entier(e.identity.cut);
    const shadow = new Map(), cibles = new Set();
    for (const e of ev) if (e.type === 'gcv1-shadow-observed' && e.batchId === B && dePartie(e)) { cibles.add(e.identity.cut); shadow.set(e.identity.cut, e); }
    for (const e of ev) if (e.type === 'capture-abandoned' && e.reason === 'depart-sur-vert' && dePartie(e) && instant(e) >= t0 && instant(e) <= t0 + DEPART_VERT_S * 1000) cibles.delete(e.identity.cut);
    const poses = new Set();
    for (const e of ev) if (e.type === 'esv-observation' && e.kind === 'write' && instant(e) >= t0 && instant(e) < fin && entier(e.status) && e.status >= 200 && e.status < 300
      && e.body && e.body.ExtractionStatus === 'valid' && e.body.TreatedByOperator === true && cibles.has(e.rowIndex)) poses.add(e.rowIndex);
    /* Écritures de la deuxième passe (après la fenêtre du lot) : posées, signal propre. */
    const passe = new Map();
    for (const e of ev) if (e.type === 'passe-differes-ecriture' && e.resultat === 'ecrit' && (e.batchId === B || e.lotId === B) && dePartie(e) && cibles.has(e.identity.cut) && instant(e) >= t0) passe.set(e.identity.cut, e);
    for (const c of passe.keys()) poses.delete(c);   /* écrit par la passe, pas par le lot (l'écriture peut tomber dans la fenêtre) */
    const differes = new Set([...cibles].filter(c => !poses.has(c) && !passe.has(c)));
    const sig = new Map();
    const ajoute = (cut, cle, detail) => { let x = sig.get(cut); if (!x) sig.set(cut, x = { signaux: new Set(), details: {} }); x.signaux.add(cle); if (detail !== undefined) x.details[cle] = detail; };
    const garde = new Map();
    for (const e of ev) if (e.type === 'garde-apres-differe' && e.batchId === B && dePartie(e)) garde.set(e.identity.cut, e);
    for (const c of differes) {
      const L = (shadow.get(c) || {}).lotObservation || {}, cmd = L.command || {};
      ajoute(c, 'differe', { motif: garde.has(c) ? 'garde-apres-differe' : cmd.reason || L.stage || null });
    }
    for (const [c, e] of passe) ajoute(c, 'passe-ecrite', { decalMm: arr1(maxDecal(e.decal)) });
    for (const c of poses) {
      const L = (shadow.get(c) || {}).lotObservation || {}, cmd = L.command || {};
      const appuis = Array.isArray(L.anchorsUsed) ? L.anchorsUsed.length : (L.l1 && L.l1.chaine && fini(L.l1.chaine.appuis) ? L.l1.chaine.appuis : null);
      const r1 = [1, 2].filter(k => differes.has(c - k) || passe.has(c - k)).map(k => c - k);
      const parLeLot = cmd.action === 'lot';
      if (r1.length) ajoute(c, 'apres-differe', { differes: r1 });
      if (appuis === 0 && (r1.length || parLeLot)) ajoute(c, 'sans-appui', { commande: cmd.reason || null });
    }
    for (const e of ev) if (e.type === 'garde-apres-differe-suivant' && e.batchId === B && dePartie(e) && (poses.has(e.identity.cut))) ajoute(e.identity.cut, 'garde-suivant', { cutsGarde: Array.isArray(e.cutsGarde) ? e.cutsGarde.slice(0, 4) : [] });
    /* Relecture du lot : « je corrigerais » sans correction. Seuls les cuts du lot (cibles) : la relecture visite aussi des verts d'avant le lot,
     * qui ne sont pas des poses d'Ariane (option `relectureHorsLot` pour les garder, mesure seulement). */
    for (const e of ev) if (e.type === 'relecture-ombre' && (e.batchId === B || e.lotId === B) && dePartie(e) && e.verdict === 'je corrigerais' && e.action !== 'corrige'
      && (options.relectureHorsLot || poses.has(e.identity.cut) || passe.has(e.identity.cut))) ajoute(e.identity.cut, 'relecture', { pireMm: arr1(e.pireMm) });
    const rangDe = s => Math.min(...[...s].map(k => SIGNAUX.indexOf(k)));
    const entrees = [...sig.entries()].map(([cut, x]) => ({ part, cut, groupe: x.signaux.has('differe') ? 'poser' : 'corriger', signaux: SIGNAUX.filter(k => x.signaux.has(k)), details: x.details, force: rangDe(x.signaux) }))
      .sort((a, b) => (a.groupe === b.groupe ? 0 : a.groupe === 'corriger' ? -1 : 1) || a.force - b.force || b.signaux.length - a.signaux.length || a.cut - b.cut)
      .map((e, i) => { const { force, ...r } = e; return { ...r, rang: i + 1 }; });
    const parSignal = Object.fromEntries(SIGNAUX.map(k => [k, entrees.filter(e => e.signaux.includes(k)).length]));
    return { version: VERSION, trouve: true, partie: part, batchId: B, debut: new Date(t0).toISOString(), entrees,
      ...(options.population ? { population: { poses: [...poses, ...passe.keys()].sort((a, b) => a - b), differes: [...differes].sort((a, b) => a - b) } } : {}),
      comptes: { cibles: cibles.size, poses: poses.size + passe.size, differes: differes.size, aCorriger: entrees.filter(e => e.groupe === 'corriger').length, aPoser: entrees.filter(e => e.groupe === 'poser').length, parSignal } };
  }

  /* Statut d'une entrée d'après les visites d'Écho (format de la séance Écho : `visits` de la session, `label`, `identity`, `encours`).
   * CH-037 (défaut 2, test 30) : le résultat le PLUS FORT parmi les visites du cut décide, et non plus la dernière visite (cut 3250 de la partie 10 le
   * 01/11 : corrigé, puis validé, puis une visite sans décision, et le bilan disait « vu »). corrige (validation avec un rail déplacé) > valide (validation
   * sans déplacement) > en-cours (visite ouverte, sans libellé) > vu (visite sans validation) > a-faire (aucune visite). À force égale, la plus récente ;
   * le libellé et les rails rendus sont ceux de la visite retenue. ESV n'a aucun geste « dévalider » observé par Écho : une revisite ne défait rien. */
  const REGLE_STATUT = 'le résultat le plus fort parmi les visites : corrigé > validé > ouvert > vu > à faire ; à force égale, la plus récente';
  const FORCE = { corrige: 4, valide: 3, 'en-cours': 2, vu: 1 };
  const statutVisite = x => { const l = String(x.label || '');
    return /^VALIDATE_CORRECTED/.test(l) ? 'corrige' : l === 'VALIDATE_NO_MOVEMENT' ? 'valide' : !l && x.encours ? 'en-cours' : 'vu'; };
  function statutDe(entree, visites) {
    const v = (visites || []).filter(x => x && x.identity && x.identity.part === entree.part && x.identity.cut === entree.cut);
    if (!v.length) return { statut: 'a-faire', visites: 0 };
    let best = null, st = null;
    for (const x of v) { const s = statutVisite(x); if (!best || FORCE[s] >= FORCE[st]) { best = x; st = s; } }
    if (st === 'en-cours') return { statut: 'en-cours', visites: v.length };
    const l = String(best.label || '');
    return { statut: st, visites: v.length, label: l || null, rails: /BOTH/.test(l) ? 2 : /^VALIDATE_CORRECTED/.test(l) ? 1 : 0 };
  }
  /* CH-037 (défaut 2) : LA fusion des visites d'Écho (`n.visits` : identité, `label` posé à la clôture de la visite) et des étiquettes provisoires du
   * service worker (`issues`, par visitId : la visite OUVERTE dont Maj+Espace est observé, ou une visite perdue avec la page, dont le résumé n'a jamais
   * reçu d'étiquette). Le libellé d'Écho l'emporte toujours. `echoOuvert` : la séance observe (la dernière visite sans fin est « ouverte »). Une seule
   * fonction pour l'écran (src/ui5.js), la fin « liste finie » et `correction-fin` (background.js) : le même résultat partout. */
  function visitesFusionnees(visites, { issues = null, echoOuvert = false } = {}) {
    const V = (visites || []).filter(v => v && v.identity), I = issues && typeof issues === 'object' ? issues : {};
    return V.map((v, i) => { const p = !v.label && typeof I[v.visitId] === 'string' ? I[v.visitId] : null;
      return { identity: v.identity, label: v.label || p || null, encours: !v.endedAt && i === V.length - 1 && !!echoOuvert, provisoire: !!p }; });
  }
  function bilan(entrees, visites) {
    const c = { 'a-faire': 0, 'en-cours': 0, corrige: 0, valide: 0, vu: 0 };
    const lignes = (entrees || []).map(e => { const s = statutDe(e, visites); c[s.statut]++; return { part: e.part, cut: e.cut, groupe: e.groupe, signaux: e.signaux, ...s }; });
    return { lignes, comptes: { total: lignes.length, ...c, traites: c.corrige + c.valide } };
  }

  /* CH-035 — PARCOURS DE L'AURORE SUR PLUSIEURS PARTIES (chantiers/CH-035/CONCEPTION.md § 2). `listes` : [{ partie, lignes: [{ part, cut, statut }] }]
   * (les lignes de `bilan`) ; options : `partieAffichee` (lue dans ESV), `courant` ({ part, cut } du dernier cut ouvert). Aucun état gardé : tout se lit
   * sur les statuts, donc sur les visites d'Écho (reprise après un arrêt sans curseur). Ordre : les parties dans l'ordre des listes (celui de la
   * Constellation), puis les cuts par numéro croissant. Suivant : premier cut « à faire » de la partie de départ (celle du cut courant, sinon la partie
   * affichée) après le cut courant, puis le reste de cette partie, puis les parties suivantes, puis retour au début. État d'une partie : `faite` (plus
   * rien « à faire » ni « en cours »), `en-cours` (cut ouvert, partie du cut courant ou déjà entamée), `a-faire`. */
  function parcours(listes, options = {}) {
    const parts = [], par = new Map();
    for (const l of listes || []) for (const x of (l && l.lignes) || []) {
      if (!x || !entier(x.part) || !entier(x.cut)) continue;
      if (!par.has(x.part)) { par.set(x.part, new Map()); parts.push(x.part); }
      const m = par.get(x.part); if (!m.has(x.cut)) m.set(x.cut, x.statut || 'a-faire');
    }
    const ordre = parts.flatMap(p => [...par.get(p).entries()].sort((a, b) => a[0] - b[0]).map(([cut, statut]) => ({ part: p, cut, statut })));
    const C = options.courant && entier(options.courant.part) && entier(options.courant.cut) ? options.courant : null;
    const depart = C ? C.part : entier(options.partieAffichee) ? options.partieAffichee : null;
    const i0 = parts.indexOf(depart), tour = i0 < 0 ? parts : [...parts.slice(i0), ...parts.slice(0, i0)];
    const aFaire = x => x.statut === 'a-faire';
    /* Le cut ouvert n'est jamais le suivant, même avant que sa visite d'Écho soit enregistrée. */
    const ouvert = x => C && x.part === C.part && x.cut === C.cut;
    let suivant = null;
    for (const p of tour) {
      const cuts = ordre.filter(x => x.part === p && aFaire(x) && !ouvert(x));
      const apres = p === depart && C && C.part === p ? cuts.filter(x => x.cut > C.cut) : [];
      const x = apres[0] || cuts[0];
      if (x) { suivant = { part: x.part, cut: x.cut }; break; }
    }
    const parties = parts.map(p => {
      const L = ordre.filter(x => x.part === p), faits = L.filter(x => x.statut === 'corrige' || x.statut === 'valide').length;
      const reste = L.some(x => aFaire(x) || x.statut === 'en-cours');
      const entamee = L.some(x => !aFaire(x)) || (C && C.part === p);
      return { partie: p, etat: !reste ? 'faite' : entamee ? 'en-cours' : 'a-faire', faits, total: L.length };
    });
    return { version: VERSION_PARCOURS, ordre: ordre.map(({ part, cut }) => ({ part, cut })), suivant, parties };
  }

  return { VERSION, VERSION_PARCOURS, SIGNAUX, LIBELLE, REGLE_STATUT, construire, statutDe, visitesFusionnees, bilan, lotDe, parcours };
});
