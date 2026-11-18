/* CH-130 (D-361) — LE PANNEAU COMPLET SUR LE TÉLÉPHONE, partie PURE (aucun DOM, aucun réseau).
 *
 * La page du téléphone (telecommande/telephone.html, servie par le relais avec ce fichier, src/signal-rendu.js et panel-signal.css) dessine le
 * panneau avec le RENDU DU PANNEAU lui-même (`ArianeSignalRendu.rendre`) : mêmes onglets (Orbite, Écho, Constellation, Aurore), même balisage, même
 * feuille de style. Ce module fabrique l'INSTANTANÉ que ce rendu attend (src/ui5.js en fait un d'après le panneau d'origine) à partir de la vue
 * réduite reçue d'Ariane (src/telecommande.js `vueReduite` : des entiers et des mots fermés, jamais un texte d'ESV). Les phrases sont fixes, écrites
 * ici, et ne citent que des numéros.
 *
 * Pouvoir : le rendu peut dessiner d'autres boutons que ceux du téléphone. `filtrer` retire du HTML tout bouton dont l'action n'est ni une navigation
 * locale (onglets, tiroir, détails, menu) ni un des 7 ordres de CH-111 OFFERT par Ariane à cet instant (`vue.boutons`), et ôte l'action des autres
 * éléments. `ordreDe` traduit l'action d'un bouton en ordre ; la page n'envoie rien d'autre, et le service worker garde sa liste fermée et ses refus.
 * Jamais SKIP, jamais une validation, une pose, un départ ni une ouverture de cut dans ESV depuis le téléphone. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.ArianeTelecommandeInstantane = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA = 2;
  /* Action d'un bouton du rendu -> ordre de la télécommande (liste fermée de src/telecommande.js `ORDRES`). */
  const ACTES = Object.freeze({
    'pause': 'lot-pause', 'legacy:pause': 'lot-pause', 'legacy:resume': 'lot-reprendre', 'legacy:stop': 'lot-arreter',
    'legacy:relecture-pause': 'relecture-pause', 'legacy:relecture-reprendre': 'relecture-reprendre',
    'legacy:relecture-arreter': 'relecture-arreter', 'legacy:relecture-arreter-pause': 'relecture-arreter',
    'legacy:file-secondaire': 'constellation-arreter' });
  /* Navigation locale du téléphone : ne part jamais vers Ariane. */
  /* `sg:stats` : le bilan et les départs des parties, derrière l'icône d'en-tête de la Constellation (CH-129, D-362). */
  /* CH-134 : `sg:vue-lot` (la vue « fil » du lot) n'y est pas : la vue réduite ne porte pas la liste des derniers cuts (`fil: []` ci-dessous), le
   * téléphone n'aurait qu'un fil vide à montrer ; le bouton est donc retiré par `filtrer` et le téléphone garde la vue instrument. */
  const NAVIGATION = Object.freeze(['mode:automatic', 'mode:native', 'sg:onglet-file', 'sg:onglet-correction', 'sg:tiroir', 'sg:details', 'sg:fermer', 'sg:menu', 'sg:stats']);
  const ordreDe = (act, vue) => { const o = Object.hasOwn(ACTES, act) ? ACTES[act] : null; return o && vue?.boutons?.[o] === true ? o : null; };
  const permis = (act, vue) => NAVIGATION.includes(act) || ordreDe(act, vue) !== null;
  /* Le HTML du rendu, sans les actions non permises : bouton retiré, autre élément privé de son action. */
  function filtrer(html, vue) {
    return String(html)
      .replace(/<button\b[^>]*\sdata-act="([^"]*)"[^>]*>[\s\S]*?<\/button>/g, (b, act) => permis(act.replace(/&amp;/g, '&'), vue) ? b : '')
      .replace(/\sdata-act="([^"]*)"/g, (x, act) => permis(act.replace(/&amp;/g, '&'), vue) ? x : '');
  }
  /* Les actions qui restent dans un HTML (pour les essais). */
  const actions = html => [...String(html).matchAll(/\sdata-act="([^"]*)"/g)].map(m => m[1]);

  const ent = x => Number.isInteger(x) ? x : null;
  const ALERTE_TITRE = { incertain: 'Résultat incertain', erreur: 'Erreur du lot', 'esv-muet': 'ESV ne répond plus', 'repris-main': 'Repris à la main', 'rail-non-resolu': 'À toi', 'faible-confiance': 'À toi', autre: 'À toi' };
  const ALERTE_TEXTE = (al, c) => { const cut = c ?? '…';
    return al === 'incertain' ? `L’opération sur le cut ${cut} n’a pas été confirmée. Ariane n’y renverra aucune commande : contrôle ce cut dans ESV, sur l’ordinateur.`
      : al === 'esv-muet' ? 'ESV ne répond plus. Si la page ESV reste figée, recharge-la sur l’ordinateur, attends qu’elle réponde, puis Reprendre.'
      : al === 'rail-non-resolu' ? `Le cut ${cut} a un rail qu’Ariane ne sait pas poser. Ce choix se fait sur l’ordinateur.`
      : al === 'faible-confiance' ? `Ariane n’est pas assez sûre de sa pose sur le cut ${cut}. Ce choix se fait sur l’ordinateur.`
      : al === 'repris-main' ? `Le cut ${cut} t’est rendu : corrige-le dans ESV, sur l’ordinateur.`
      : al === 'erreur' ? 'Le lot s’est arrêté sur une erreur. Regarde le panneau sur l’ordinateur.' : 'Le lot attend ta décision, sur l’ordinateur.'; };
  const CONNEXION = { prete: 'ready', absente: 'no-tab', muette: 'unavailable', reconnexion: 'reconnecting' };
  const ECHO_ETAT = { demarrage: 'Démarrage de la collecte', cours: 'Collecte en cours', pause: 'Collecte en pause', muet: 'ESV ne répond plus', terminee: 'Séance terminée', 'a-terminer': 'Séance à terminer' };
  const FILE_ETAT = { lot: ['lot en cours', 'Pose de la partie'], passe: ['rattrapage', 'Rattrapage de la partie'], relecture: ['relecture', 'Relecture de la partie'], changement: ['passage', 'Passage à la partie suivante'],
    fin: ['terminée', 'Toutes les parties prévues sont faites'], arret: ['arrêtée', 'La Constellation s’est arrêtée'] };
  const RELECTURE = { preparation: 'Relecture en préparation', 'en-cours': 'Relecture en cours', 'en-pause': 'Relecture en pause' };

  /* L'instantané pour `ArianeSignalRendu.rendre`. `ui.vue` : l'activité choisie sur le téléphone ('orbite' | 'echo'), sinon celle d'Ariane. */
  function instantane(v, { vue = null, theme = 'sombre' } = {}) {
    v = v && typeof v === 'object' ? v : {};
    const l = v.lot || {}, r = v.relecture || {}, c = v.constellation || {}, p = v.passe2 || {}, B = v.boutons || {}, d = v.detail || {};
    const E = d.echo || {}, F = d.file || {}, A = d.aurore || {}, esv = d.esv || {};
    const connexion = CONNEXION[v.connexion] || null;
    const relVivante = ['preparation', 'en-cours', 'en-pause'].includes(r.etat), ecrit = p.etat === 'ecriture';
    const lotOuvert = ['cours', 'pause', 'alerte'].includes(l.etat) || ecrit || relVivante;
    let etat = { cours: 'cours', pause: 'pause', arrete: 'arrete', fini: 'fini', alerte: 'alerte' }[l.etat] || 'pret';
    if (ecrit) etat = 'p2'; else if (relVivante && etat !== 'alerte') etat = 'rel';
    const sansLot = l.etat === 'aucun' || !l.etat;
    const ar = {
      etat, etatTexte: etat === 'alerte' ? ALERTE_TITRE[l.alerte] || 'À toi' : '', horsLigne: sansLot && esv.partie == null,
      partie: l.partie ?? esv.partie ?? null, cutEsv: esv.cut ?? null, cibles: null, poses: l.poses ?? 0, differes: l.differes ?? 0, traites: l.traites ?? 0, restants: null,
      cours: l.etat === 'cours' ? l.cut : null, dernier: d.dernier ?? (l.etat === 'cours' ? null : l.cut), bornes: sansLot ? null : { debut: l.debut ?? null, fin: l.fin ?? null },
      differesListe: [], horsLot: null, verts: [], vertsNombre: null, vertsLigne: '', aExaminer: l.differes ?? 0, bornesProchain: null, reprise: null,
      passeFin: null, lotOuvert, passe2: ecrit ? { cut: null, ecrites: p.ecrites ?? 0, demandees: p.demandees ?? 0 } : null, etapes: null,
      cache: { actif: false }, connexionBloquee: true, echoEtat: ECHO_ETAT[E.etat] || 'Aucune séance en cours',
      alerte: etat === 'alerte' ? ALERTE_TEXTE(l.alerte, l.cut) : '', esv: connexion === 'unavailable' || l.alerte === 'esv-muet' ? 'ko' : connexion === 'ready' && esv.partie != null ? 'ok' : 'non',
      pause: B['lot-pause'] ? { actif: true } : null, reprendre: B['lot-reprendre'] ? { actif: true, texte: 'Reprendre' } : null };
    /* Les boutons du lot : ceux qu'Ariane offre au téléphone (`vue.boutons`), sous les identifiants des boutons du panneau. */
    const boutonsOrbite = [
      B['lot-pause'] ? { id: 'pause', texte: 'Pause', actif: true, role: 'primary' } : null,
      B['lot-reprendre'] ? { id: 'resume', texte: 'Reprendre', actif: true, role: 'primary' } : null,
      B['lot-arreter'] ? { id: 'stop', texte: 'Arrêter le lot', actif: true, role: B['lot-pause'] || B['lot-reprendre'] ? 'danger' : 'primary' } : null].filter(Boolean);
    const relPause = relVivante ? { ligne: `${RELECTURE[r.etat]}${r.cut != null ? ` · cut ${r.cut}` : ''}${Number.isInteger(r.faits) && Number.isInteger(r.total) ? ` · ${r.faits} sur ${r.total}` : ''}`,
      reprendre: B['relecture-reprendre'] ? { texte: 'Reprendre la relecture', actif: true } : null, pause: B['relecture-pause'] ? { texte: 'Pause de la relecture', actif: true } : null,
      arreter: B['relecture-arreter'] ? { actif: true } : null } : null;
    const actifFile = ['lot', 'passe', 'relecture', 'changement'].includes(c.etat);
    const etatFile = c.etat === 'aucune' || !c.etat ? 'repos' : c.etat === 'autre' ? 'arret' : c.etat;
    const parties = (F.parties || []).map(x => ({ part: x.part, rang: x.rang, interrompue: !!x.interrompue, poses: x.poses, differes: x.differes,
      passe: x.passe ? { issue: x.passe, ecrits: x.ecrits ?? 0 } : null, relecture: x.relecture ? { issue: x.relecture, corriges: x.corriges } : null, motifs: (x.motifs || []).filter(m => m !== 'autre'),
      alertes: x.alerte ? ['alerte : voir le panneau sur l’ordinateur'] : [] }));
    const file = {
      etat: etatFile, actif: actifFile, n: c.n ?? null, vers: F.vers ?? null, etatTexte: (FILE_ETAT[c.etat] || ['prête'])[0],
      phrase: (FILE_ETAT[c.etat] || ['', 'Rien n’est lancé'])[1] + (actifFile && c.partie != null && c.etat !== 'changement' ? ` ${c.partie}` : ''),
      prete: false, nombre: null, alerte: '', bilan: [], principal: null,
      secondaire: actifFile && B['constellation-arreter'] ? { texte: 'Arrêter la Constellation', actif: true } : null,
      rang: c.rang ?? null, part: c.partie ?? null, plan: (F.plan || []).filter(Number.isInteger), faites: parties.filter(x => !x.interrompue).length,
      reprise: F.reprise && F.reprise.part != null ? { part: F.reprise.part, rang: F.reprise.rang, reste: F.reprise.reste } : null,
      lancer: null, reprendre: null, nombreTous: null, partieAffichee: esv.partie ?? null, departs: [], parties };
    let correction = null;
    if (A.etat && A.etat !== 'aucune') {
      const lignes = (A.lignes || []).map(([part, cut, statut, groupe, rails]) => ({ part, cut, statut, groupe, rails, signaux: [], details: {} }));
      const P = [...new Set(lignes.map(x => x.part))];
      const K = A.comptes || {};
      correction = { id: 'telephone', etat: A.etat, listes: (P.length ? P : [esv.partie ?? 0]).map(pa => ({ partie: pa, batchId: null, batchIds: [], comptes: null, lignes: lignes.filter(x => x.part === pa) })),
        courant: A.courant || null, ouverte: A.echoOuverte === true,
        comptes: { total: K.total ?? lignes.length, aCorriger: K.aCorriger ?? 0, aPoser: K.aPoser ?? 0, corrige: K.corrige ?? 0, valide: K.valide ?? 0, vu: K.vu ?? 0, enCours: K.enCours ?? 0, traites: (K.corrige ?? 0) + (K.valide ?? 0) },
        partieAffichee: esv.partie ?? null, entreParties: false, passage: null, ouvrir: { etat: '', texte: '' },
        boutons: { demarrer: { actif: false }, ouvrir: { actif: false }, terminer: { actif: false }, fermer: { actif: false } }, telecharger: null };
    }
    const activite = vue === 'echo' || vue === 'orbite' ? vue : v.activite === 'echo' ? 'echo' : 'orbite';
    const relChiffres = relVivante && Number.isInteger(r.faits) && Number.isInteger(r.total) ? { faits: r.faits, total: r.total, corriges: ent(r.corriges), lot: true, etat: r.etat } : null;
    return {
      variante: 'signal', notice: { texte: '', erreur: false }, avisContrat: '', connexionOuverte: false, connexionStatut: connexion, reconnecter: null,
      mode: activite === 'echo' ? 'native' : 'automatic', boutons: [], boutonsOrbite, boutonsEcho: [],
      lot: { etat: '', finPartie: '' }, relPause, relChiffres, relecture: { ligne: relPause?.ligne || '', actif: !!relPause?.arreter, interrompue: '' },
      echo: { visites: String(E.vus ?? 0), corriges: E.corriges ?? 0, valides: E.valides ?? 0 }, echoRows: [],
      reglages: {}, relectureModifiable: false, exportTexte: 'sur l’ordinateur', onglets: [], ongletChoisi: '', connexionNote: '', gcv2: null,
      file, correction, ar,
      sig: { activite, statuts: {}, allure: {}, echo: { mediane: null, marques: [] }, connexion: { statut: connexion, tabId: null, nomme: connexion === 'ready', reconnect: null },
        onglet: connexion === 'ready' ? (esv.partie != null ? `ESV · partie ${esv.partie}` : 'ESV') : '', historique: null, goto: { present: false, actif: false, raison: '', etat: '', texte: '' },
        examines: [], theme: theme === 'clair' ? 'clair' : 'sombre', palette: 'glacier', f5: null, taille: 'compact', fil: [] } };
  }
  /* La page est plus ancienne que la vue d'Ariane : le relais est à redéployer (telecommande/INSTALLATION.md). */
  const pagePerimee = v => Number.isInteger(v?.schema) && v.schema > SCHEMA;
  return Object.freeze({ SCHEMA, ACTES, NAVIGATION, ordreDe, permis, filtrer, actions, instantane, pagePerimee });
});
