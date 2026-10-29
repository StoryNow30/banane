/* CH-014 : moteur de démonstration commun aux maquettes ui-v2.
 * Il ne dessine rien du panneau : chaque maquette fournit sa fonction rendre(S, D).
 * Il tient l'état du lot (fictif), joue la simulation, et porte la régie de démo
 * (choix de la scène, du thème, de la largeur et du mouvement), placée hors du panneau.
 * Données toutes fictives : numéros de cuts inventés, aucune donnée terrain. */
(function () {
  'use strict';

  const L = {
    lancer: 'Lancer un lot neuf',
    preparer: 'Préparer un autre lot',
    pause: 'Mettre en pause',
    continuer: 'Continuer ce lot',
    arreter: 'Arrêter ce lot',
    confirmer: "Confirmer l'arrêt",
    exporter: 'Exporter',
    examiner: 'Examiner',
    ouvrir: 'Ouvrir dans ESV',
    arreterFile: 'Arrêter la file',
    confirmerFile: "Confirmer l'arrêt de la file",
  };

  const CAUSES = {
    page: { titre: 'La page ne change pas de partie', detail: 'Ariane a demandé la partie suivante trois fois ; ESV est resté sur la même.' },
    onglet: { titre: "L'onglet ESV a été fermé", detail: "Plus aucun onglet ESV n'est ouvert : la file ne peut pas continuer." },
    muet: { titre: 'ESV ne répond plus', detail: "Aucune réponse d'ESV depuis 90 secondes." },
    refus: { titre: "Le lot s'est arrêté sur un refus", detail: "ESV a refusé une pose au cut 233. Ariane n'a rien forcé." },
  };

  const MOTIFS_DIFFERE = ['Rail hors du nuage sur 2 m', 'Deux tracés possibles', 'Nuage trop clairsemé', 'Ballast masque le rail'];
  const MOTIFS_VERT = ['Posé, écart au voisin de 4 cm', 'Posé près d’un appareil de voie', 'Posé, rail court'];

  /* Hasard reproductible : la même scène donne toujours les mêmes nombres. */
  let graine = 7;
  function hasard() { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; }

  function etatInitial() {
    return {
      activite: 'orbite', phase: 'pret', vue: 'principal', examen: null,
      esv: 'connecte', onglets: [{ id: 1, nom: 'onglet de gauche' }, { id: 2, nom: 'onglet de droite' }], ongletChoisi: null,
      reprise: false, cause: null,
      bornes: { debut: 140, fin: 379, finDePartie: false },
      total: 240, totalCache: 240, faits: 0, poses: 0, differes: 0, aControler: 0, cut: 140,
      confirmer: null, message: null,
      file: { active: false, nb: 3, courante: 1, parties: [], relecture: 0, alerte: null, finie: false },
      echo: { vus: 0, dernier: null, accord: 0 },
      restants: [], tic: 0,
    };
  }

  let S = etatInitial();
  let rendreFn = null, apresFn = null, racine = null, etatPrecedent = null;
  const valeurs = new Map();
  const abonnes = [];

  function minutesRestantes() {
    if (S.total == null) return null;
    return Math.max(0, Math.round((S.total - S.faits) * 0.075));
  }
  function cutFin() { return S.total == null ? null : S.bornes.debut + S.total - 1; }

  function ajouterRestant(type) {
    const liste = type === 'differe' ? MOTIFS_DIFFERE : MOTIFS_VERT;
    S.restants.push({ id: 'r' + S.restants.length + '-' + S.cut, cut: S.cut, type, motif: liste[Math.floor(hasard() * liste.length)] });
  }

  function remplir(n) {
    /* Avance le lot de n cuts d'un coup (pour poser une scène en milieu de lot). */
    for (let i = 0; i < n; i++) avancerUnCut(true);
  }

  function avancerUnCut(silencieux) {
    const r = hasard();
    if (r < 0.045) { S.differes++; ajouterRestant('differe'); }
    else if (r < 0.075) { S.aControler++; S.poses++; ajouterRestant('vert'); }
    else S.poses++;
    S.faits++; S.cut++;
    if (!silencieux) verifierFin();
  }

  function remiseCompteurs() {
    S.faits = 0; S.poses = 0; S.differes = 0; S.aControler = 0; S.cut = S.bornes.debut; S.restants = [];
  }

  function verifierFin() {
    const limite = S.total == null ? S.totalCache : S.total;
    if (S.faits < limite) return;
    if (S.total == null) S.total = S.faits;
    if (S.file.active) {
      S.file.parties.push({ n: S.file.courante, poses: S.poses, differes: S.differes, aControler: S.aControler });
      if (S.file.courante < S.file.nb) { S.file.relecture = 3; return; }
      S.file.finie = true;
    }
    S.phase = 'fin';
  }

  function tic() {
    S.tic++;
    if (S.message && S.message.fin < Date.now()) S.message = null;
    if (S.activite === 'echo') {
      if (S.tic % 2 === 0) { S.echo.vus++; S.echo.dernier = 300 + S.echo.vus; if (hasard() > 0.12) S.echo.accord++; }
      majVue(); return;
    }
    if (S.phase !== 'encours') { if (S.message === null && !tic.avaitMessage) return; tic.avaitMessage = !!S.message; majVue(); return; }
    if (S.file.relecture > 0) {
      S.file.relecture--;
      if (S.file.relecture === 0) {
        S.file.courante++; remiseCompteurs(); S.total = 240; S.totalCache = 240;
      }
      majVue(); return;
    }
    avancerUnCut(false);
    majVue();
  }

  function dire(texte) { S.message = { texte, fin: Date.now() + 4200 }; }

  /* ---------- actions déclenchées par data-a ---------- */
  const actions = {
    lancer() {
      if (S.esv !== 'connecte') { dire('ESV n’est pas relié : rien n’est lancé.'); return; }
      const fin = S.bornes.finDePartie ? null : S.bornes.fin;
      S.total = fin == null ? null : fin - S.bornes.debut + 1;
      S.totalCache = S.total == null ? 180 : S.total;
      remiseCompteurs(); S.phase = 'encours'; S.vue = 'principal'; S.reprise = false; S.cause = null;
      S.file.courante = 1; S.file.parties = []; S.file.alerte = null; S.file.finie = false; S.file.relecture = 0;
    },
    preparer() {
      S.phase = 'pret'; S.vue = 'principal'; S.reprise = false; S.cause = null;
      S.bornes = { debut: S.total ? S.bornes.debut + S.total : 380, fin: (S.total ? S.bornes.debut + S.total : 380) + 199, finDePartie: false };
      remiseCompteurs(); S.file.parties = []; S.file.finie = false; S.file.alerte = null;
      dire('Bornes du prochain lot à choisir. Rien n’est lancé.');
    },
    pause() { if (S.phase === 'encours') S.phase = 'pause'; },
    continuer() { if (S.phase === 'pause' || S.phase === 'arrete') { S.phase = 'encours'; S.reprise = false; S.cause = null; } },
    arreter() {
      if (S.confirmer !== 'arreter') { S.confirmer = 'arreter'; setTimeout(() => { if (S.confirmer === 'arreter') { S.confirmer = null; majVue(); } }, 4000); return; }
      S.confirmer = null; S.phase = 'arrete'; S.cause = 'Arrêté par l’opérateur.';
      if (S.file.active) { S.file.alerte = null; }
    },
    arreterFile() {
      if (S.confirmer !== 'file') { S.confirmer = 'file'; setTimeout(() => { if (S.confirmer === 'file') { S.confirmer = null; majVue(); } }, 4000); return; }
      S.confirmer = null; S.phase = 'arrete'; S.cause = 'File arrêtée par l’opérateur.';
    },
    exporter() { dire('Export du lot prêt (fichier fictif dans cette maquette).'); },
    voirReste() { S.vue = 'reste'; },
    retour() { S.vue = 'principal'; S.examen = null; },
    examiner(id) { S.examen = S.restants.find((r) => r.id === id) || null; S.vue = S.examen ? 'examen' : 'reste'; },
    ouvrir(id) { const r = S.restants.find((x) => x.id === id); dire('Cut ' + (r ? r.cut : '') + ' ouvert dans l’onglet ESV.'); },
    traiter(id) { S.restants = S.restants.filter((r) => r.id !== id); S.vue = 'reste'; S.examen = null; dire('Marqué comme vu.'); },
    orbite() { if (S.phase === 'encours') return; S.activite = 'orbite'; },
    echo() { if (S.phase === 'encours') { dire('Mettre le lot en pause ou l’arrêter avant de passer en Écho.'); return; } S.activite = 'echo'; },
    fileBascule() { if (S.phase === 'encours' || S.phase === 'pause') return; S.file.active = !S.file.active; },
    fileMoins() { if (S.file.nb > 2) S.file.nb--; },
    filePlus() { if (S.file.nb < 9) S.file.nb++; },
    finDePartie() { S.bornes.finDePartie = !S.bornes.finDePartie; },
    debutMoins() { S.bornes.debut = Math.max(1, S.bornes.debut - 10); },
    debutPlus() { S.bornes.debut = Math.min(S.bornes.fin - 1, S.bornes.debut + 10); },
    finMoins() { S.bornes.fin = Math.max(S.bornes.debut + 1, S.bornes.fin - 10); },
    finPlus() { S.bornes.fin += 10; },
    reessayer() { S.esv = 'choisir'; },
    choisirOnglet(id) { S.ongletChoisi = Number(id); S.esv = 'connecte'; dire('Onglet ESV relié.'); },
    fermerAlerte() { S.file.alerte = null; },
    regler(arg) { const [k, v] = String(arg).split(':'); const x = Math.max(1, Math.round(Number(v))); if (k === 'debut' || k === 'fin') S.bornes[k] = x; if (S.bornes.fin <= S.bornes.debut) S.bornes.fin = S.bornes.debut + 1; },
  };

  function agir(nom, arg) {
    if (!actions[nom]) return;
    if (nom !== 'arreter' && nom !== 'arreterFile') S.confirmer = null;
    actions[nom](arg);
    majVue();
  }

  /* ---------- scènes de la régie ---------- */
  function scene(nom) {
    graine = 7; S = etatInitial();
    const milieu = () => { S.phase = 'encours'; remplir(112); };
    const sc = {
      pret: () => {},
      'pret-absent': () => { S.esv = 'absent'; },
      'pret-onglet': () => { S.esv = 'choisir'; },
      'pret-file': () => { S.file.active = true; },
      encours: () => milieu(),
      'encours-inconnu': () => { S.bornes.finDePartie = true; S.total = null; S.totalCache = 180; milieu(); },
      pause: () => { milieu(); S.phase = 'pause'; },
      arrete: () => { milieu(); S.phase = 'arrete'; S.cause = 'Arrêté par l’opérateur.'; },
      reprise: () => { milieu(); S.phase = 'arrete'; S.reprise = true; S.cause = 'La page ESV a été rechargée pendant le lot.'; },
      fin: () => { S.phase = 'encours'; remplir(240); S.phase = 'fin'; },
      reste: () => { S.phase = 'encours'; remplir(240); S.phase = 'fin'; S.vue = 'reste'; },
      examen: () => { S.phase = 'encours'; remplir(240); S.phase = 'fin'; S.vue = 'examen'; S.examen = S.restants.find((r) => r.type === 'differe') || S.restants[0]; },
      'file-encours': () => {
        S.file.active = true; S.file.nb = 3; S.file.courante = 2;
        S.file.parties = [{ n: 1, poses: 226, differes: 9, aControler: 5 }];
        milieu();
      },
      'file-relecture': () => {
        S.file.active = true; S.file.nb = 3; S.file.courante = 2; S.phase = 'encours'; remplir(240);
        S.file.parties = [{ n: 1, poses: 226, differes: 9, aControler: 5 }, { n: 2, poses: S.poses, differes: S.differes, aControler: S.aControler }];
        S.file.relecture = 8;
      },
      'file-alerte-page': () => alerte('page'),
      'file-alerte-onglet': () => alerte('onglet'),
      'file-alerte-muet': () => alerte('muet'),
      'file-alerte-refus': () => alerte('refus'),
      'file-fin': () => {
        S.file.active = true; S.file.nb = 3; S.file.courante = 3; S.phase = 'encours'; remplir(240); S.phase = 'fin'; S.file.finie = true;
        S.file.parties = [{ n: 1, poses: 226, differes: 9, aControler: 5 }, { n: 2, poses: 231, differes: 6, aControler: 3 }, { n: 3, poses: S.poses, differes: S.differes, aControler: S.aControler }];
      },
      echo: () => { S.activite = 'echo'; S.echo = { vus: 34, dernier: 334, accord: 30 }; },
    };
    function alerte(cle) {
      S.file.active = true; S.file.nb = 3; S.file.courante = 2;
      S.file.parties = [{ n: 1, poses: 226, differes: 9, aControler: 5 }];
      S.phase = 'encours'; remplir(93); S.phase = 'arrete';
      S.file.alerte = { cle, ...CAUSES[cle] };
      S.cause = CAUSES[cle].titre;
    }
    (sc[nom] || sc.pret)();
    majVue();
  }

  const SCENES = [
    ['Lot', [['pret', 'Prêt'], ['encours', 'En cours'], ['encours-inconnu', 'En cours, total inconnu'], ['pause', 'En pause'], ['arrete', 'Arrêté au milieu'], ['fin', 'Fin de lot'], ['reste', 'Ce qui reste'], ['examen', 'Examiner un cut']]],
    ['Incidents', [['pret-absent', 'ESV non connecté'], ['pret-onglet', 'Onglet à choisir'], ['reprise', 'Reprise après rechargement']]],
    ['File de parties', [['pret-file', 'File allumée, réglage'], ['file-encours', 'Partie 2 sur 3'], ['file-relecture', 'Relecture entre deux parties'], ['file-alerte-page', 'Alerte : page figée'], ['file-alerte-onglet', 'Alerte : onglet fermé'], ['file-alerte-muet', 'Alerte : ESV muet'], ['file-alerte-refus', 'Alerte : refus'], ['file-fin', 'Fin de file']]],
    ['Activité', [['echo', 'Écho (Ariane observe)']]],
  ];

  /* ---------- rendu ---------- */
  function majVue() {
    if (!racine || !rendreFn) return;
    const actif = document.activeElement;
    const cleFocus = actif && racine.contains(actif) ? (actif.getAttribute('data-a') || '') + '|' + (actif.getAttribute('data-id') || '') : null;
    const gardes = {};
    racine.querySelectorAll('[data-garder]').forEach((n) => { gardes[n.getAttribute('data-garder')] = n; });
    const defile = racine.scrollTop;
    racine.innerHTML = rendreFn(S, D);
    racine.querySelectorAll('[data-garder]').forEach((n) => { const v = gardes[n.getAttribute('data-garder')]; if (v) n.replaceWith(v); });
    racine.scrollTop = defile;
    if (cleFocus) {
      const [a, id] = cleFocus.split('|');
      const cible = [...racine.querySelectorAll('[data-a]')].find((n) => n.getAttribute('data-a') === a && (n.getAttribute('data-id') || '') === id);
      if (cible) cible.focus();
    }
    /* Valeurs qui changent : un élément data-valeur="clé" reçoit la classe « change » quand son
     * texte diffère du rendu précédent ; chaque maquette dessine sa propre transition. */
    racine.querySelectorAll('[data-valeur]').forEach((e) => {
      const k = e.getAttribute('data-valeur'), t = e.textContent;
      if (valeurs.has(k) && valeurs.get(k) !== t && !mouvementReduit()) e.classList.add('change');
      valeurs.set(k, t);
    });
    /* Changement d'état : la racine porte data-etat ; data-etat-change="1" au rendu qui suit un changement. */
    const cleEtat = S.phase + '|' + S.vue + '|' + S.activite;
    racine.setAttribute('data-etat', S.phase);
    racine.setAttribute('data-etat-change', cleEtat !== etatPrecedent && etatPrecedent !== null && !mouvementReduit() ? '1' : '0');
    etatPrecedent = cleEtat;
    if (apresFn) apresFn(S, D, racine);
    abonnes.forEach((f) => f(S));
    const st = document.getElementById('regie-etat');
    if (st) st.textContent = 'phase : ' + S.phase + (S.activite === 'echo' ? ' · Écho' : '') + (S.vue !== 'principal' ? ' · vue ' + S.vue : '');
  }

  function mouvementReduit() {
    return document.documentElement.getAttribute('data-mouvement') === 'reduit' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function themeSombre() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function n(x) { return x == null ? '' : String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }


  /* Contenu de l'état courant, identique pour toutes les maquettes : le sens ne change pas d'une
   * proposition à l'autre, seule la forme change. */
  function modele() {
    const m = { phase: S.phase, vue: S.vue, activite: S.activite, message: S.message ? S.message.texte : null };
    m.liaison = S.esv === 'connecte'
      ? { etat: 'relie', texte: 'ESV relié', detail: (S.onglets.find((o) => o.id === S.ongletChoisi) || S.onglets[0]).nom }
      : S.esv === 'absent' ? { etat: 'absent', texte: 'ESV non relié', detail: 'aucun onglet ESV ne répond' }
        : { etat: 'choisir', texte: 'Onglet ESV à choisir', detail: S.onglets.length + ' onglets ESV ouverts' };
    const min = minutesRestantes();
    m.compte = {
      faits: S.faits, total: S.total, totalTexte: S.total == null ? 'total inconnu' : n(S.total),
      cut: S.cut, minutes: min, tempsTexte: min == null ? 'temps restant inconnu' : (min < 1 ? 'moins d’une minute' : 'environ ' + min + ' min'),
      poses: S.poses, differes: S.differes, aExaminer: S.aControler, debut: S.bornes.debut,
      fin: S.total == null ? null : S.bornes.debut + S.total - 1, part: S.total ? S.faits / S.total : null,
    };
    m.bornes = { ...S.bornes };
    m.restants = S.restants.slice();
    m.examen = S.examen;
    const f = S.file;
    m.file = { active: f.active, nb: f.nb, courante: f.courante, parties: f.parties.slice(), relecture: f.active && f.relecture > 0 && S.phase === 'encours', alerte: f.alerte, finie: f.finie, ligneCourante: !f.finie && f.parties.length < f.courante };
    m.activiteBloquee = S.phase === 'encours';
    const arret = f.active && S.phase !== 'pret' && S.phase !== 'fin'
      ? { a: 'arreterFile', libelle: D.libelleArretFile(), rang: 'arret', confirme: S.confirmer === 'file' }
      : { a: 'arreter', libelle: D.libelleArret(), rang: 'arret', confirme: S.confirmer === 'arreter' };
    const pasRelie = S.esv !== 'connecte';
    m.incident = null;
    if (S.activite === 'echo') {
      m.vue = 'echo';
      m.titre = 'Écho'; m.phrase = 'Ariane regarde l’opérateur poser et ne pose rien.';
      m.echo = { ...S.echo };
      m.actions = [{ a: 'orbite', libelle: 'Revenir en Orbite', rang: 'second' }];
      return m;
    }
    switch (S.phase) {
      case 'pret':
        m.titre = 'Prêt';
        m.phrase = pasRelie ? 'Rien ne peut partir tant qu’ESV n’est pas relié.' : (S.bornes.finDePartie ? 'Du cut ' + S.bornes.debut + ' jusqu’à la fin de la partie.' : 'Du cut ' + S.bornes.debut + ' au cut ' + S.bornes.fin + ', soit ' + (S.bornes.fin - S.bornes.debut + 1) + ' cuts.');
        m.actions = [
          { a: 'lancer', libelle: L.lancer, rang: 'principal', desactive: pasRelie, raison: pasRelie ? 'ESV doit être relié avant de lancer.' : null },
          { a: 'preparer', libelle: L.preparer, rang: 'second', note: 'ne lance rien' },
        ];
        if (S.esv === 'absent') m.incident = { type: 'absent', titre: 'ESV non connecté', texte: 'Aucun onglet ESV ne répond. Ouvrir ESV dans un onglet de ce navigateur, puis chercher à nouveau.', actions: [{ a: 'reessayer', libelle: 'Chercher l’onglet ESV', rang: 'principal' }] };
        if (S.esv === 'choisir') m.incident = { type: 'choisir', titre: 'Onglet à choisir', texte: 'Plusieurs onglets ESV sont ouverts. Choisir celui qu’Ariane doit suivre.', actions: S.onglets.map((o) => ({ a: 'choisirOnglet', id: String(o.id), libelle: o.nom, rang: 'choix' })) };
        break;
      case 'encours':
        if (m.file.relecture) {
          m.titre = 'Relecture'; m.phrase = 'Relecture et correction de la partie ' + f.courante + ', puis la partie ' + (f.courante + 1) + ' démarre seule.';
          m.actions = [arret];
          break;
        }
        m.titre = 'En cours';
        m.phrase = 'Ariane pose le cut ' + S.cut + '. ' + S.faits + ' traités sur ' + (S.total == null ? 'un total inconnu' : S.total) + '.';
        m.actions = [{ a: 'pause', libelle: L.pause, rang: 'principal' }, arret];
        break;
      case 'pause':
        m.titre = 'En pause'; m.phrase = 'Arrêté au cut ' + S.cut + ' en attendant. Continuer reprend ce même lot.';
        m.actions = [{ a: 'continuer', libelle: L.continuer, rang: 'principal' }, arret];
        break;
      case 'arrete':
        m.titre = 'Arrêté';
        m.phrase = (S.reprise ? '' : (S.cause || 'Lot arrêté.') + ' ') + 'Le lot s’est arrêté au cut ' + S.cut + ', après ' + S.faits + ' cuts.';
        m.actions = [{ a: 'continuer', libelle: L.continuer, rang: 'principal', note: 'au cut ' + S.cut }, { a: 'lancer', libelle: L.lancer, rang: 'second', note: 'depuis les bornes' }];
        if (S.reprise) m.incident = { type: 'reprise', titre: 'Reprise après rechargement', texte: 'La page ESV a été rechargée. Ariane a retrouvé le lot : rien n’est perdu, rien ne repart sans vous.', actions: [] };
        if (f.alerte) { m.titre = 'File arrêtée'; m.phrase = 'La file s’est arrêtée pendant la partie ' + f.courante + ' sur ' + f.nb + ', au cut ' + S.cut + '.'; }
        break;
      case 'fin':
        m.titre = f.finie ? 'File terminée' : 'Lot terminé';
        m.phrase = f.finie ? f.nb + ' parties faites, chacune relue et corrigée.' : S.faits + ' cuts traités, du cut ' + S.bornes.debut + ' au cut ' + (S.bornes.debut + S.faits - 1) + '.';
        m.actions = [{ a: 'exporter', libelle: L.exporter, rang: 'principal' }, { a: 'preparer', libelle: L.preparer, rang: 'second', note: 'ne lance rien' }];
        if (S.restants.length) m.actions.push({ a: 'voirReste', libelle: 'Voir ce qui reste (' + S.restants.length + ')', rang: 'lien' });
        break;
    }
    if (S.vue === 'reste') { m.titreVue = 'Ce qui reste'; }
    return m;
  }

  const D = {
    L, CAUSES, esc, n, modele, minutesRestantes, cutFin, mouvementReduit, themeSombre,
    libelleArret: () => (S.confirmer === 'arreter' ? L.confirmer : L.arreter),
    libelleArretFile: () => (S.confirmer === 'file' ? L.confirmerFile : L.arreterFile),
    differes: () => S.restants.filter((r) => r.type === 'differe'),
    verts: () => S.restants.filter((r) => r.type === 'vert'),
    abonner: (f) => abonnes.push(f),
    /* Coupe fictive d'un cut : points (x, z) et position proposée des deux rails. */
    coupe(cut, nb) {
      let g = (cut * 9301 + 49297) % 233280; const h = () => { g = (g * 9301 + 49297) % 233280; return g / 233280; };
      const pts = [];
      for (let i = 0; i < (nb || 240); i++) {
        const x = h() * 2 - 1; let z = -0.35 + 0.12 * Math.cos(x * 2.2) + (h() - 0.5) * 0.05;
        if (Math.abs(Math.abs(x) - 0.36) < 0.03 && h() > 0.3) z += 0.11 + h() * 0.02; /* tête de rail */
        if (Math.abs(x) < 0.55 && Math.abs(x) > 0.28 && h() > 0.85) z += 0.05; /* traverse */
        pts.push([x, z]);
      }
      return { pts, rails: [-0.36, 0.36] };
    },
  };

  function regieHTML() {
    const opts = SCENES.map(([g, l]) => `<optgroup label="${g}">${l.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</optgroup>`).join('');
    return `<div class="regie" role="region" aria-label="Régie de démonstration (hors panneau)">
      <strong>Régie de démo</strong>
      <label>Scène <select id="regie-scene">${opts}</select></label>
      <label>Thème <select id="regie-theme"><option value="auto">système</option><option value="light">clair</option><option value="dark">sombre</option></select></label>
      <label>Largeur <select id="regie-largeur"><option value="360">360 px, compacte</option><option value="420" selected>420 px, normale</option><option value="600">600 px, large</option></select></label>
      <label>Mouvement <select id="regie-mouvement"><option value="systeme">système</option><option value="reduit">réduit</option></select></label>
      <span id="regie-etat" aria-live="polite"></span>
    </div>`;
  }

  const CSS_REGIE = `.regie{font:13px/1.4 system-ui,sans-serif;background:#ECECEC;color:#1A1A1A;border-bottom:1px solid #BDBDBD;padding:8px 16px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
  .regie select{font:inherit;color:#1A1A1A;background:#FFF;border:1px solid #8A8A8A;border-radius:3px;padding:2px 4px}
  .regie #regie-etat{color:#4A4A4A;margin-left:auto}`;

  function appliquerReglages(r) {
    const h = document.documentElement;
    if (r.theme) { if (r.theme === 'auto') h.removeAttribute('data-theme'); else h.setAttribute('data-theme', r.theme); }
    if (r.mouvement) { if (r.mouvement === 'reduit') h.setAttribute('data-mouvement', 'reduit'); else h.removeAttribute('data-mouvement'); }
    if (r.largeur) document.documentElement.style.setProperty('--largeur-panneau', r.largeur + 'px');
    const sel = (id, v) => { const e = document.getElementById(id); if (e && v) e.value = v; };
    sel('regie-theme', r.theme); sel('regie-largeur', r.largeur); sel('regie-mouvement', r.mouvement); sel('regie-scene', r.scene);
    if (r.scene) scene(r.scene); else majVue();
  }

  function monter(opt) {
    rendreFn = opt.rendre; apresFn = opt.apres || null;
    const st = document.createElement('style'); st.textContent = CSS_REGIE; document.head.appendChild(st);
    const sansRegie = new URLSearchParams(location.search).get('regie') === '0';
    /* ?seul=1 : le panneau seul, sans notes ni marges (vue de la page comparative). */
    if (new URLSearchParams(location.search).get('seul') === '1') {
      const st2 = document.createElement('style');
      st2.textContent = '.notes{display:none!important}.scene{padding:0!important;gap:0!important}body{background:transparent!important}';
      document.head.appendChild(st2);
    }
    if (!sansRegie) document.body.insertAdjacentHTML('afterbegin', regieHTML());
    racine = document.getElementById('panneau');
    racine.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b || !racine.contains(b) || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
      agir(b.getAttribute('data-a'), b.getAttribute('data-id'));
    });
    racine.addEventListener('change', (e) => {
      const c = e.target.closest('[data-champ]');
      if (!c) return;
      const v = parseInt(String(c.value).replace(/\D/g, ''), 10);
      if (Number.isFinite(v) && v > 0) S.bornes[c.getAttribute('data-champ')] = v;
      if (S.bornes.fin <= S.bornes.debut) S.bornes.fin = S.bornes.debut + 1;
      majVue();
    });
    const on = (id, f) => { const e = document.getElementById(id); if (e) e.addEventListener('change', f); };
    on('regie-scene', (e) => scene(e.target.value));
    on('regie-theme', (e) => appliquerReglages({ theme: e.target.value }));
    on('regie-largeur', (e) => appliquerReglages({ largeur: e.target.value }));
    on('regie-mouvement', (e) => appliquerReglages({ mouvement: e.target.value }));
    window.addEventListener('message', (e) => { if (e.data && e.data.ui2) appliquerReglages(e.data.ui2); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => majVue());
    const p = new URLSearchParams(location.search);
    appliquerReglages({ theme: p.get('t') || 'auto', largeur: p.get('w') || '420', mouvement: p.get('m') || 'systeme', scene: p.get('s') || 'pret' });
    if (p.get('fige') !== '1') setInterval(tic, 900);
  }

  window.Demo = { monter, scene, agir, etat: () => S, D };
})();
