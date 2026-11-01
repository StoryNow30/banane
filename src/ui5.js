/* Test 17 : HABILLAGE DU PANNEAU, partie navigateur.
 *
 * `panel.js` reste le moteur de la page : connexion à ESV, lecture de l'état, rendu de ses propres éléments, exports, vidage automatique
 * d'Écho. Ce fichier ne remplace rien : après chaque rendu du panneau (`ArianePanel.apres`), il lit l'état et les libellés que le panneau
 * vient d'écrire (un INSTANTANÉ), dessine Signal (src/signal-rendu.js) et, quand on clique dessus, CLIQUE le bouton
 * d'origine du panneau (`data-act="legacy:<id>"`). Conséquences voulues :
 *   - aucune commande ni aucun export de plus ou de moins : c'est le même gestionnaire qui répond ;
 *   - AUCUN message au service worker depuis ce fichier (un essai le vérifie sur le source) ; il écrit seulement son propre choix
 *     d'interface (`banane51Interface`) dans chrome.storage.local, et demande la taille de sa fenêtre à chrome.windows ;
 *   - D-250 : « Signal » (src/signal-rendu.js) est la présentation du départ (src/ui5-variante.js). Le panneau d'avant n'est plus proposé : il reste
 *     le moteur caché de la page. Ses « détails techniques » (santé de la collecte, exports de diagnostic, journal, résumé de la partie) restent
 *     atteignables : la feuille de réglages les montre en déplaçant ses propres éléments dans une couche, puis les remet à leur place.
 *     Un ancien choix « ancienne » gardé dans le stockage vaut le départ. Si le dessin échoue, le panneau d'avant réapparaît (secours).
 *   - Revue V2 : « Examiner » est gardé ici, par lot (`banane51Examines` dans chrome.storage.local) ; « Ouvrir » recopie la cible dans le champ caché
 *     `#goto-cut-cible` du panneau et clique son bouton caché `#goto-cut` (action `goto-cut` du service worker, par la voie habituelle du panneau).
 * Les choix « après le lot », « clic », « grappe », « deuxième passe », « raison » sont ceux du panneau : un clic sur la case ou le bouton radio d'origine. */
(function (root) {
  'use strict';
  const D = root.document, S5 = root.ArianeSignalRendu, CLE = 'banane51Interface', CLE_EX = 'banane51Examines';
  if (!D || !S5 || !root.ArianePanel) return;
  /* Test 23 : les présentations d'essai « ariane2 » et « palette » sont retirées (opérateur, après la test 21) ; Signal est la seule présentation. */
  const VARIANTES = ['signal'], defaut = 'signal';
  const TAILLE = { signal: [600, 760] };
  const ui = { last: '', pauseLot: null, q: '', pi: 0, focusQ: false, tiroir: false, couche: null, sel: null, note: '', onglet: null };
  const examines = { lot: null, cles: new Set() };
  let variante = defaut, hote = null, gcv2Base = null, secours = false;
  const $ = id => D.getElementById(id);
  const txt = id => { const e = $(id); return e ? String(e.textContent || '').trim() : ''; };
  const visible = id => { const e = $(id); return !!e && !e.hidden; };

  /* ---------------------------------------------------------------- instantané */
  const ORDRE_ORBITE = ['start-batch', 'resume', 'retry', 'manual-takeover', 'manual-completion', 'close-uncertain', 'pause', 'export-tout', 'new-batch', 'relecture-acquitter', 'relecture-arreter', 'relecture-lancer', 'passe-differes-lancer', 'explicit-skip', 'stop'];
  const ORDRE_ECHO = ['native-resume', 'native-end', 'native-download', 'native-start', 'native-pause', 'native-discard'];
  const coche = (ids) => { for (const [v, id] of ids) if ($(id)?.checked) return v; return null; };
  /* « 999999 » est la borne interne « jusqu'à la fin de la partie » (panel.js) ; on ne l'affiche jamais. */
  const FIN_PARTIE = 999999;
  const finVisible = v => { const n = Number(v); return v === '' || v == null || !Number.isFinite(n) || n >= FIN_PARTIE ? null : String(v); };
  const entier = v => Number.isFinite(Number(v)) ? String(Math.trunc(Number(v))) : '—';

  function boutons(mode) {
    const out = [];
    for (const id of mode === 'native' ? ORDRE_ECHO : ORDRE_ORBITE) {
      const e = $(id); if (!e || e.hidden) continue;
      const c = String(e.className || '');
      out.push({ id, texte: String(e.textContent || '').trim(), role: /\bprimary\b/.test(c) ? 'primary' : /\bdanger\b/.test(c) ? 'danger' : 'link', actif: !e.disabled });
    }
    return out;
  }
  /* Statut de chaque cut du lot, dans l'ordre où le lot les a ouverts. */
  const STATUT = { actuel: 'cours', incertain: 'incertain', moteur: 'pose', 'voie-l': 'voie', differe: 'differe', skip: 'saute', main: 'main' };
  function statutsLot(s) {
    if (!s?.batch) return [];
    try { const v = root.ArianePanel.voieDuLot(s); return v.cuts.map(c => STATUT[v.classe(c)]).filter(Boolean); } catch { return []; }
  }
  function lignesEcho(s) {
    const A = root.ArianePanel; let vis = [];
    try { vis = A.visitesNatif(s?.native) || []; } catch { /* aucune */ }
    const corr = x => /^VALIDATE_CORRECTED/.test(String(x.label || ''));
    const dur = x => x.d === null || x.d === undefined ? '' : x.encours ? 'en cours' : `${Math.round(x.d)} s`;
    const texte = x => x.encours ? 'Visite en cours' : /^VALIDATE_CORRECTED_BOTH/.test(x.label) ? 'Corrigé · 2 rails' : corr(x) ? 'Corrigé · 1 rail' : x.label === 'VALIDATE_NO_MOVEMENT' ? 'Validé tel quel' : x.label === 'SKIP' ? 'SKIP' : 'Visité';
    /* Revue T21 (R4) : « validés tels quels » = les validations sans correction, pas « vus − corrigés » (qui compte aussi les SKIP et les visites sans issue). */
    return { echoRows: vis.slice(-40).reverse().map(x => ({ cut: entier(x.c), texte: texte(x), corrige: corr(x), duree: dur(x) })), corriges: vis.filter(corr).length, valides: vis.filter(x => x.label === 'VALIDATE_NO_MOVEMENT').length };
  }
  /* Présentation « Ariane » : les chiffres et l'état du lot, d'après fiches/UI_ETATS_COMPTEURS.md. Lecture seule de l'état.
   * « Pause demandée » n'existe pas dans le moteur : c'est le clic sur Pause (gardé ici, pour ce lot) tant que le lot tourne encore. */
  const OUVERT = ['RUNNING', 'PAUSED', 'PAUSED_UNRESOLVED_RAIL', 'PAUSED_DEFER_NAVIGATION_UNCERTAIN', 'PAUSED_AFTER_STATE_MISSING', 'PAUSED_ADAPTER_UNRESPONSIVE', 'MANUAL_TAKEOVER'];
  const cutDe = x => { const n = Number(x?.cut ?? x?.identity?.cut); return Number.isFinite(n) ? Math.trunc(n) : null; };
  /* Heure de Paris (règle du panneau d'origine), pas celle de la machine. */
  const PARIS = (() => { try { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch { return null; } })();
  const heure = iso => { const d = iso ? new Date(iso) : null; if (!d || isNaN(d) || !PARIS) return ''; const q = {}; for (const x of PARIS.formatToParts(d)) q[x.type] = x.value; return `${Number(q.hour === '24' ? 0 : q.hour)} h ${q.minute}`; };
  const RAILS = { left: 'rail gauche', right: 'rail droit' };
  /* Ciblage T22 (fiches/CIBLAGE_T22.md) : M quand `travailDuLot` (panel.js) ne le donne pas, c'est-à-dire quand le lot ne va pas du cut 0 ou 1 jusqu'à la FIN
   * DE PARTIE (depuis la test 22, Orbite propose la fin retenue pour la partie : le lot part avec un dernier cut numéroté). Lu dans chrome.storage.local
   * (lecture seule, aucun message) : la fiche de départ de CE lot (`banane3FichesDepart`, la première du même batchId) et l'instantané de la liste de sa
   * partie (`banane5ListeInstantane:<partie>`) ; calcul : `ArianeSignalRendu.ciblesBornes`. Trouvé, M est gardé pour tout le lot (un instantané pris plus tard
   * n'a plus les mêmes invalides : il ne le remplacerait pas) ; pas trouvé, nouvel essai au plus toutes les 5 s (la fiche), l'instantané (plus lourd)
   * seulement si la fiche ne suffit pas, six fois au plus par lot ; « total inconnu » d'ici là. */
  const CIBLES = { lot: null, m: null, essai: 0, cours: false, listes: 0 };
  function ciblesDuLot(b) {
    if (!b?.id || !b.scope) return null;
    if (CIBLES.lot !== b.id) Object.assign(CIBLES, { lot: b.id, m: null, essai: 0, listes: 0 });
    if (CIBLES.m !== null || CIBLES.cours || Date.now() - CIBLES.essai < 5000) return CIBLES.m;
    CIBLES.essai = Date.now(); CIBLES.cours = true;
    const id = b.id, sc = b.scope, LM = root.BananeListeMemoire, cle = (LM?.PRE_INST || 'banane5ListeInstantane:') + sc.part, L = root.chrome?.storage?.local;
    void (async () => {
      try {
        const f = (await L?.get?.('banane3FichesDepart'))?.banane3FichesDepart?.find?.(x => x && x.batchId === id);
        let m = f ? S5.ciblesBornes(sc, f, null) : null;
        if (f && m === null && CIBLES.listes < 6 && LM?.decompacter) { CIBLES.listes++; m = S5.ciblesBornes(sc, f, LM.decompacter((await L.get(cle))?.[cle])); }
        if (Number.isInteger(m) && CIBLES.lot === id) { CIBLES.m = m; maj(false); }
      } catch { /* inconnu : dit tel quel */ } finally { CIBLES.cours = false; }
    })();
    return null;
  }
  function calculAr(s, statuts) {
    const b = s?.batch || null, A = root.ArianePanel, compte = k => statuts.filter(x => k.includes(x)).length;
    const poses = compte(['pose', 'voie']), differes = compte(['differe']), traites = poses + differes + compte(['saute', 'main']);
    let cibles = null; try { const f = b && A.travailDuLot(b); if (f && Number.isInteger(f.invalides)) cibles = f.invalides; } catch { /* inconnu */ }
    if (cibles === null && b) cibles = ciblesDuLot(b);
    const st = b?.state || null, incertain = !!s?.reconcileRequired;
    /* La deuxième passe des différés écrit dans ESV (état `passeDifferes` du service worker) : tant qu'elle écrit, rien d'autre n'y part. Elle passe devant
     * « Relecture en cours » : la relecture l'attend, et elle ne part pas pendant une relecture. */
    const p2 = s?.passeDifferes?.etat === 'ecriture' ? { cut: cutDe(s.passeDifferes), ecrites: s.passeDifferes.ecrites, demandees: s.passeDifferes.demandees } : null;
    if (st !== 'RUNNING' || ui.pauseLot !== b?.id) ui.pauseLot = null;
    let etat = 'pret', etatTexte = '';
    const horsLigne = !b && !s?.current?.identity;
    if (b) {
      if (incertain) { etat = 'alerte'; etatTexte = 'Résultat incertain'; }
      else if (p2) etat = 'p2';
      else if (st === 'RUNNING') etat = ui.pauseLot === b.id ? 'dem' : 'cours';
      else if (st === 'PAUSED' && b.pauseReason !== 'low-confidence') etat = 'pause';
      else if (st === 'COMPLETED' || st === 'FINISHED_WITH_UNCONFIRMED_ACTIONS') etat = 'fini';
      else if (st === 'STOPPED') etat = b.stoppedAtEnd ? 'fini' : 'arrete';
      else if (st === 'ERROR') { etat = 'alerte'; etatTexte = 'Erreur du lot'; }
      else { etat = 'alerte'; etatTexte = st === 'PAUSED_ADAPTER_UNRESPONSIVE' ? 'ESV ne répond plus' : st === 'MANUAL_TAKEOVER' ? 'Repris à la main' : 'À toi'; }
    }
    /* La relecture qui suit le lot écrit dans ESV (corriger) : tant qu'elle travaille, le lot n'est pas « terminé » ; le bouton « Arrêter la relecture » du panneau d'avant est visible. */
    if (etat === 'fini' && visible('relecture-arreter')) etat = 'rel';
    /* Phrase de l'incident, d'après l'état (vérifié dans le code : src/engine.js `apply`, `closeUncertain` ; panel.js, « debloquable ») :
     * une opération interrompue bloque toute écriture jusqu'à son archivage ; sans opération en cours, « Reprendre » suffit. */
    const cutI = cutDe(s?.intent?.identity) ?? cutDe(b?.activeIdentity);
    const alerte = !b ? '' : incertain ? `L’opération sur le cut ${cutI ?? '…'} n’a pas été confirmée. Ariane n’y renverra aucune commande : contrôle ce cut dans ESV, puis archive le résultat interrompu.`
      : st === 'PAUSED_ADAPTER_UNRESPONSIVE' ? 'ESV ne répond plus. Si la page ESV reste figée, recharge-la (F5), attends qu’elle réponde, puis clique sur Reprendre.'
      : st === 'PAUSED_UNRESOLVED_RAIL' || b.pauseReason === 'unresolved-rail' ? `Le cut ${cutI ?? '…'} a un rail qu’Ariane ne sait pas poser. Choisis : réessayer, le reprendre à la main, ou le passer.`
      : b.pauseReason === 'low-confidence' ? `Ariane n’est pas assez sûre de sa pose sur le cut ${cutI ?? '…'}. Choisis : réessayer, le reprendre à la main, ou le passer.`
      : st === 'MANUAL_TAKEOVER' ? `Le cut ${cutI ?? '…'} t’est rendu : corrige-le dans ESV, ouvre le cut suivant, puis déclare-le repris à la main.` : '';
    const fin = b?.scope?.end, debut = b?.scope?.start;
    const bornes = b ? { debut: Number.isInteger(debut) ? debut : null, fin: Number.isInteger(fin) && fin < FIN_PARTIE ? fin : null }
      : { debut: $('start')?.value || null, fin: finVisible($('end')?.value) };
    const differesListe = (b?.deferred || []).map(d => {
      const r = Array.isArray(d.unresolvedRails) ? d.unresolvedRails : [];
      return { cut: cutDe(d), motif: r.length ? 'Rail non résolu' : 'Différé', precision: r.length === 2 ? 'les deux rails' : r.length ? (RAILS[r[0]] || '') : '', heure: heure(d.deferredAt) };
    }).filter(d => d.cut !== null).reverse();
    const plages = [...($('verts-plages')?.querySelectorAll?.('li') || [])].map(li => ({ libelle: String(li.querySelector('b')?.textContent || '').trim(), detail: String(li.querySelector('span')?.textContent || '').trim() }));
    const vertsNombre = plages.reduce((n, p) => n + (Number((p.detail.match(/·\s*(\d+)/) || [])[1]) || 0), 0);
    const dernierP = (b?.processed || []).at?.(-1);
    /* Ciblage T22 : lot clos parce qu'ESV est passé au-delà de son dernier cut, dans la même partie (background.js `lotExitOf`, `clore`). */
    const E = b?.stoppedAtEnd, horsLot = E?.reason === 'navigation-beyond-end' && E.target?.part === b.scope?.part && Number.isInteger(E.target?.cut)
      ? { cut: cutDe(E), vers: E.target.cut, fin: Number.isInteger(b.scope?.end) ? b.scope.end : null } : null;
    return {
      etat, etatTexte, horsLigne, partie: s?.current?.identity?.part ?? b?.scope?.part ?? null, cutEsv: s?.current?.identity?.cut ?? null,
      cibles, poses, differes, traites, restants: cibles !== null ? Math.max(0, cibles - traites) : null,
      cours: st === 'RUNNING' ? cutDe(b?.activeIdentity) : null, dernier: cutDe(dernierP), bornes, differesListe, horsLot,
      verts: visible('verts-controle') ? plages : [], vertsNombre: visible('verts-controle') ? vertsNombre : null, vertsLigne: visible('verts-controle') ? txt('verts-ligne') : '',
      aExaminer: differes + (visible('verts-controle') ? vertsNombre : 0),
      /* Revue T21 (D7) : les bornes du PROCHAIN lot, celles que « Démarrer » lit (`#start`, `#end`), tant que le panneau les montre avec « Démarrer le lot » ;
       * « Reprise des différés » (`#lot-reprise`) avec elles. Après « Nouveau lot », ce sont les champs, pas les bornes du lot fini. */
      bornesProchain: visible('lot-bornes') && visible('start-batch') ? { debut: $('start')?.value || '', fin: finVisible($('end')?.value), note: txt('bornes-note') } : null,
      reprise: visible('lot-bornes') && visible('start-batch') && visible('lot-reprise-row') ? { coche: !!$('lot-reprise')?.checked, note: txt('lot-reprise-note') } : null,
      /* Revue T21 (R1) : la deuxième passe de CE lot quand elle n'écrit pas (en ombre, en calcul, finie) : son résultat, que panel.js dit dans `#passe-differes-ligne`. */
      passeFin: (P => P && b && P.lotId === b.id && P.etat !== 'ecriture' ? { mode: P.mode, etat: P.etat, posees: P.posees, differes: P.differes, ecrites: P.ecrites, message: P.message ?? null } : null)(s?.passeDifferes),
      lotOuvert: !!b && (OUVERT.includes(st) || incertain || !!p2 || etat === 'rel'), passe2: p2,
      cache: { actif: !!$('export-cache-clear') && !$('export-cache-clear').disabled }, connexionBloquee: !!$('connect')?.disabled,
      echoEtat: { RUNNING: 'Collecte en cours', PAUSED: 'Collecte en pause', STARTING: 'Démarrage de la collecte', PAUSED_ADAPTER_UNRESPONSIVE: 'ESV ne répond plus', FINISHED: 'Séance terminée' }[s?.native?.status] || (s?.native?.visits?.length ? 'Séance à terminer' : 'Aucune séance en cours'),
      alerte, esv: s?.connection?.status === 'unavailable' || st === 'PAUSED_ADAPTER_UNRESPONSIVE' ? 'ko' : s?.connection?.status === 'no-tab' ? 'non' : s?.current?.identity ? 'ok' : 'non',
      pause: (() => { const e = $('pause'); return e && !e.hidden ? { actif: !e.disabled } : null; })(),
      reprendre: (() => { const e = $('resume'); return e && !e.hidden ? { actif: !e.disabled, texte: String(e.textContent || '').trim() } : null; })(),
    };
  }
  /* Signal : ce que l'instrument ajoute à « ar ». L'allure vient de `batch.processed[].durationMs`, `batch.cutStartedAt` et, s'il existe,
   * `batch.pausedAt` (src/signal-rendu.js, `allureLot`) ; la connexion de `s.connection.status` et du bouton `#reconnect` ; l'historique de
   * `s.partsHistory` ; « Ouvrir dans ESV » des éléments cachés `#goto-cut`, `#goto-cut-etat`. Ce qui manque reste vide : rien n'est inventé. */
  function calculSig(s, statuts, mode, choisi, onglets) {
    const b = s?.batch || null, A = root.ArianePanel;
    if (b?.id !== examines.lot && b?.id) { examines.lot = b.id; examines.cles = new Set(); }
    let vis = []; try { vis = A.visitesNatif(s?.native) || []; } catch { /* aucune */ }
    const faites = vis.filter(x => !x.encours), d = faites.map(x => x.d).filter(x => Number.isFinite(x) && x > 0).slice(-20);
    const go = $('goto-cut'), rc = $('reconnect'), ge = $('goto-cut-etat'), th = D.documentElement?.dataset?.theme, f5 = $('relecture-f5');
    /* Connexion T21 : la puce nomme l'onglet que le service worker cible réellement (`connection.tabId`, celui du lot) quand il en garde un ; sinon le choix du panneau. */
    const tabId = Number.isInteger(s?.connection?.tabId) ? String(s.connection.tabId) : null;
    const onglet = (onglets.find(o => String(o.valeur) === (tabId ?? String(choisi)))?.texte || '').trim();
    return {
      activite: mode === 'native' ? 'echo' : 'orbite', statuts, allure: S5.allureLot(b, Date.now()),
      echo: { mediane: d.length >= 3 ? S5.quantile(d, 0.5) : null, marques: faites.slice(-60).map(x => /^VALIDATE_CORRECTED/.test(String(x.label || ''))) },
      connexion: { statut: s?.connection?.status ?? null, tabId, nomme: !!tabId && onglets.some(o => String(o.valeur) === tabId), reconnect: rc ? { visible: !rc.hidden, actif: !rc.disabled } : null },
      onglet, historique: Array.isArray(s?.partsHistory) ? s.partsHistory : null,
      goto: { present: !!go, actif: !!go && !go.disabled, raison: go?.getAttribute?.('title') || '', etat: ge?.dataset?.etat || '', texte: ge ? String(ge.textContent || '').trim() : '' },
      examines: [...examines.cles], theme: th === 'light' ? 'clair' : 'sombre',
      f5: $('relecture-pause-actif')?.checked && f5 ? (f5.value === 'arret' ? 'arret' : 'pause') : null,
      taille: (root.innerWidth || 600) < 480 || (root.innerHeight || 760) < 600 ? 'compact' : 'normal',
    };
  }
  /* CH-025 : la FILE DE PARTIES (CH-017), carte `#file-parties` du panneau d'avant. Rien tant que la vue ne porte pas `fileParties` (panel.js cache alors
   * la carte). L'état vient de la vue ; « préparée », le nombre choisi (gardés dans panel.js, `fileUI`), les phrases, l'alerte, le bilan et les libellés des
   * boutons viennent de ce que `afficherFile` vient d'écrire. Lecture seule. */
  const FILE_ACTIFS = ['lot', 'passe', 'relecture', 'changement'];
  function fileDuPanneau(s) {
    if (!Object.hasOwn(s || {}, 'fileParties') || !visible('file-parties')) return null;
    const f = s.fileParties || null, bouton = id => { const e = $(id); return e && !e.hidden ? { texte: String(e.textContent || '').trim(), actif: !e.disabled } : null; };
    const choix = visible('file-reglage') ? [...($('file-n')?.children || [])].map(b => ({ n: Number(b.dataset?.n), choisi: b.getAttribute?.('aria-pressed') === 'true' })).filter(x => Number.isInteger(x.n)) : [];
    return {
      etat: f ? String(f.etat || '') : 'repos', actif: !!f && FILE_ACTIFS.includes(f.etat), n: Number.isInteger(f?.n) ? f.n : null, vers: f?.changement?.vers ?? null,
      etatTexte: txt('file-etat'), phrase: txt('file-phrase'), prete: !f && txt('file-etat') === 'préparée', choix,
      alerte: visible('file-alerte') ? txt('file-alerte') : '',
      bilan: visible('file-bilan') ? [...($('file-bilan')?.querySelectorAll?.('li') || [])].map(li => String(li.textContent || '').trim()).filter(Boolean) : [],
      principal: bouton('file-principal'), secondaire: bouton('file-secondaire'),
      /* CH-026 : l'onglet « File » : le plan, la reprise (src/file-parties.js `repriseDe`), les boutons d'un clic, le nombre choisi (lu même caché),
       * la partie affichée dans ESV et les départs des parties (fiches de départ du panneau d'origine). */
      rang: Number.isInteger(f?.rang) ? f.rang : null, part: f?.enCours?.part ?? null, plan: Array.isArray(f?.plan) ? f.plan.slice() : [],
      faites: (f?.bilan || []).filter(p => !p.interrompue).length, reprise: f?.reprise || null,
      lancer: bouton('file-lancer'), reprendre: bouton('file-reprendre'),
      choixTous: [...($('file-n')?.children || [])].map(b => ({ n: Number(b.dataset?.n), choisi: b.getAttribute?.('aria-pressed') === 'true' })).filter(x => Number.isInteger(x.n)),
      partieAffichee: Number.isInteger(s?.current?.identity?.part) ? s.current.identity.part : null,
      departs: departsFile(),
      /* CH-036 : le bilan par partie, structuré (la vue `fileParties.bilan`, src/file-parties.js), pour la Constellation : posés, à poser, écrits au
       * rattrapage, relecture, motifs (codes) et alertes. Lecture seule. */
      parties: (f?.bilan || []).filter(p => p && typeof p === 'object').map(p => ({ part: p.part ?? null, rang: Number.isInteger(p.rang) ? p.rang : null, interrompue: !!p.interrompue,
        poses: Number.isInteger(p.resume?.poses) ? p.resume.poses : null, differes: Number.isInteger(p.resume?.differes) ? p.resume.differes : null,
        passe: p.passe ? { issue: p.passe.issue ?? null, ecrits: Number.isInteger(p.passe.ecrits) ? p.passe.ecrits : 0 } : null,
        relecture: p.relecture ? { issue: p.relecture.issue ?? null, corriges: Number.isInteger(p.relecture.corriges) ? p.relecture.corriges : null } : null,
        motifs: Array.isArray(p.motifs) ? p.motifs.filter(x => typeof x === 'string') : [], alertes: (p.alertes || []).map(a => String(a?.texte || '')).filter(Boolean) })),
    };
  }
  /* Les départs des parties, du plus récent au plus ancien (8 au plus) : validés, invalides, skippés (le compte « skipped » d'ESV au départ du lot,
   * gardé en `ignores` par src/export-cache.js), total, heure de Paris. Rien d'inventé : un champ absent reste vide. */
  const HEURE_PARIS = (() => { try { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return null; } })();
  function departsFile() {
    let f = []; try { f = root.ArianePanel.fichesDepart?.() || []; } catch { f = []; }
    const n = v => Number.isInteger(v) ? v : null;
    return f.filter(x => x && typeof x === 'object').slice(-8).reverse().map(x => {
      const d = typeof x.at === 'string' ? new Date(x.at) : null, ok = d && !isNaN(d) && HEURE_PARIS;
      return { partie: n(x.partie), heure: ok ? HEURE_PARIS.format(d).replace(',', '').replace(/\s+/, ' ') : '', valides: n(x.valides), invalides: n(x.invalides), skippes: n(x.ignores), total: n(x.total) };
    });
  }
  /* CH-028 : LA CORRECTION DANS ORBITE, d'après `s.correction` (service worker, background.js) et les visites de la séance Écho MARQUÉE de la même correction
   * (`s.native.correction.id`) : statut de chaque cut par src/correction-liste.js (`bilan`), lecture seule. Les boutons sont les déclencheurs cachés du panneau
   * (`#correction-*`, panel.js) ; « Télécharger la séance Écho » est le bouton d'Écho d'origine (`#native-download`). Rien tant que la vue n'a pas de liste. */
  const ECHO_OUVERT = ['STARTING', 'RUNNING', 'PAUSED', 'PAUSED_ADAPTER_UNRESPONSIVE'];
  function correctionDuPanneau(s) {
    const C = s?.correction; if (!C || !Array.isArray(C.listes) || !C.listes.length) return null;
    const CL = root.ArianeCorrectionListe, n = s.native, miens = !!n && n.correction?.id === C.id;
    const V = miens ? (n.visits || []).filter(v => v && v.identity) : [];
    const vis = V.map((v, i) => ({ identity: v.identity, label: v.label || null, encours: !v.endedAt && i === V.length - 1 && ECHO_OUVERT.includes(n.status) }));
    const listes = C.listes.map(l => {
      const E = Array.isArray(l.entrees) ? l.entrees : [], b = CL ? CL.bilan(E, vis) : { lignes: E.map(e => ({ ...e, statut: 'a-faire', visites: 0 })) };
      return { partie: l.partie, batchId: l.batchId, comptes: l.comptes || null, lignes: b.lignes.map((x, i) => ({ ...x, details: E[i]?.details || {} })) };
    });
    const tout = listes.flatMap(l => l.lignes), k = st => tout.filter(x => x.statut === st).length;
    const bouton = id => { const e = $(id); return e ? { actif: !e.disabled, visible: !e.hidden, texte: String(e.textContent || '').trim() } : null; };
    const ce = $('correction-etat');
    return { id: C.id, etat: C.etat, listes, courant: C.courant || null, ouverte: C.etat === 'ouverte' && miens && ECHO_OUVERT.includes(n?.status),
      comptes: { total: tout.length, aCorriger: tout.filter(x => x.groupe === 'corriger').length, aPoser: tout.filter(x => x.groupe === 'poser').length, corrige: k('corrige'), valide: k('valide'), vu: k('vu'), enCours: k('en-cours'), traites: k('corrige') + k('valide') },
      partieAffichee: Number.isInteger(s?.current?.identity?.part) ? s.current.identity.part : null,
      /* CH-035 : Aurore entre les parties (réglage allumé à la naissance de la liste) : parcours et état par partie (src/correction-liste.js, `parcours`). */
      /* Convention de CH-036 (relayée par l'intégrateur, 01/11) : `entreParties` (booléen) et `passage` ({ etat: 'en-cours'|'refuse', vers, texte }, ou
       * null). Réglage éteint : `entreParties:false`, `passage:null`, et l'écran de la 4.9.5.29. */
      entreParties: C.entreParties === true,
      passage: C.entreParties !== true ? null : C.changement ? { etat: 'en-cours', vers: C.changement.vers, texte: `Passage à la partie ${C.changement.vers} dans ESV…` }
        : C.passage && C.passage.etat === 'refuse' ? { etat: 'refuse', vers: C.passage.vers, texte: C.passage.texte } : null,
      ...(C.entreParties === true && CL?.parcours ? { changement: C.changement || null,
        parcours: CL.parcours(listes, { partieAffichee: Number.isInteger(s?.current?.identity?.part) ? s.current.identity.part : null, courant: C.courant || null }) } : {}),
      ouvrir: { etat: ce?.dataset?.etat || '', texte: ce ? String(ce.textContent || '').trim() : '' },
      boutons: { demarrer: bouton('correction-demarrer'), ouvrir: bouton('correction-ouvrir'), terminer: bouton('correction-terminer'), fermer: bouton('correction-fermer') },
      telecharger: (b => b && b.visible ? b : null)(bouton('native-download')) };
  }
  function instantane(s) {
    const statuts = statutsLot(s), echo = lignesEcho(s), n = $('tabs'), mode = D.body?.dataset?.window || 'home';
    const rg = {
      relecture: coche([['coupee', 'relecture-coupee'], ['ombre', 'relecture-ombre'], ['corriger', 'relecture-corriger']]),
      clic: coche([['tel-quel', 'clic-tel-quel'], ['gauche-recentre', 'clic-gauche-recentre'], ['tout-recentre', 'clic-tout-recentre']]),
      grappe: !!$('grappe-differes')?.checked, passe2: $('passe-differes')?.indeterminate ? null : !!$('passe-differes')?.checked, raison: !!$('raison-actif')?.checked,
      touches: coche([['chiffres', 'raison-touches-chiffres'], ['alt-chiffres', 'raison-touches-alt-chiffres'], ['pave', 'raison-touches-pave']]),
      bandeau: $('bandeau-toggle')?.getAttribute?.('aria-pressed') === 'true',
    };
    return {
      variante,
      notice: { texte: txt('notice'), erreur: !!$('notice')?.classList?.contains('error') },
      avisContrat: visible('avis-contrat') ? txt('avis-contrat') : '',
      connexionOuverte: !!$('connection')?.open,
      /* T20a (D-243) : le message « ESV n'est pas connecté » se fonde sur le statut tenu à jour par le service worker, plus sur le volet ouvert. */
      connexionStatut: s?.connection?.status || null,
      reconnecter: (() => { const e = $('reconnect'); return e && !e.hidden ? { actif: !e.disabled } : null; })(),
      mode, boutons: boutons(mode), boutonsOrbite: boutons('automatic'), boutonsEcho: boutons('native'),
      lot: { etat: txt('lot-etat'), finPartie: visible('lot-fin-partie') ? txt('lot-fin-partie') : '' },
      relPause: (() => { try { const P = root.ArianeRelecturePause; return P ? P.vue(P.etat(), { esvMuet: s?.connection?.status === 'unavailable' }) : null; } catch { return null; } })(),
      relecture: { ligne: visible('relecture-ligne') ? txt('relecture-ligne') : '', actif: visible('relecture-arreter'), interrompue: visible('relecture-interrompue') ? txt('relecture-interrompue') : '' },
      echo: { visites: txt('native-count') || '0', corriges: echo.corriges, valides: echo.valides },
      echoRows: echo.echoRows,
      reglages: rg, relectureModifiable: visible('relecture-choix-champ'), exportTexte: txt('export-status'),
      onglets: n ? [...(n.options || [])].filter(o => o.value).map(o => ({ valeur: o.value, texte: o.textContent })) : [], ongletChoisi: n?.value || '', connexionNote: txt('tabs-note'),
      gcv2: gcv2Base,
      file: fileDuPanneau(s),
      correction: correctionDuPanneau(s),
      ar: calculAr(s, statuts),
      sig: calculSig(s, statuts, mode, n?.value || '', n ? [...(n.options || [])].filter(o => o.value).map(o => ({ valeur: o.value, texte: o.textContent })) : []),
    };
  }

  /* ---------------------------------------------------------------- dessin */
  const zones = '.ecr,.reg,.defile,.l2,.sg-corps,.sg-liste';
  function maj(force) {
    if (!hote || secours) return;
    const s = root.ArianePanel.state(); if (!s) return;
    entrer(s);   /* avant le premier dessin : Signal ne dessine jamais les boutons d'une vue que le panneau n'a pas rendue */
    let html;
    try {
      const snap = instantane(s);
      /* CH-025 : la boîte de la file ne vaut qu'au repos ; la file lancée (ou arrêtée, finie), elle se ferme. */
      if (ui.couche === 'file' && snap.file?.etat !== 'repos') ui.couche = null;
      html = S5.rendre(snap, ui); hote.dataset.theme = snap.sig.theme; hote.dataset.taille = snap.sig.taille;
    } catch (e) { secourir(e); return; }
    /* Revue T21 (R6) : l'anneau du cut et « en pause depuis » changent à chaque seconde, et `vivant()` les fait avancer : ils ne décident pas d'une
     * réécriture de l'écran (qui refermerait une liste ouverte et recréerait la feuille de réglages, le tiroir, le choix d'onglet). */
    const cle = html.replace(/ stroke-dashoffset="[^"]*"/g, '').replace(/(class="sg-pause-depuis"[^>]*>)[^<]*/g, '$1');
    if (!force && cle === ui.cle) return;
    const defil = [...hote.querySelectorAll(zones)].map(e => e.scrollTop), fb = D.activeElement?.dataset?.borne, avaitQ = D.activeElement?.id === 'ui5-q';
    ui.last = html; ui.cle = cle;
    if (morpher(hote, html)) apresMorph();
    else { hote.innerHTML = html; [...hote.querySelectorAll(zones)].forEach((e, i) => { if (defil[i]) e.scrollTop = defil[i]; }); }
    if (fb) { const nb = hote.querySelector(`[data-borne="${fb}"]`); if (nb) { nb.focus(); try { nb.setSelectionRange?.(nb.value.length, nb.value.length); } catch { /* nombre */ } } }
    const q = $('ui5-q');
    if (q && (ui.focusQ || avaitQ)) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch { /* sans objet */ } }
  }
  /* Signal : mise à jour EN PLACE (les éléments qui restent restent), pour que les transitions se jouent : le rail avance, le curseur glisse,
   * l'anneau se remplit, une couche ouverte ne rejoue pas son entrée à chaque rendu du panneau. Un élément porteur de `data-k` est remplacé
   * quand sa clé change (son entrée s'anime alors une fois). Sans <template> (page minimale des essais), on retombe sur innerHTML. */
  const memeNoeud = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && (a.nodeType !== 1 || a.getAttribute('data-k') === b.getAttribute('data-k'));
  function patchNoeud(a, b) {
    if (a.nodeType === 3 || a.nodeType === 8) { if (a.nodeValue !== b.nodeValue) { a.nodeValue = b.nodeValue; changes.textes.push(a.parentNode); } return; }
    for (const { name } of [...a.attributes]) if (!b.hasAttribute(name) && name !== 'style') a.removeAttribute(name);
    for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
    if (a.tagName === 'INPUT' && a.value !== (b.getAttribute('value') || '') && D.activeElement !== a) a.value = b.getAttribute('value') || '';
    patchEnfants(a, b);
  }
  function patchEnfants(a, b) {
    const ac = [...a.childNodes], bc = [...b.childNodes];
    bc.forEach((y, i) => { const x = ac[i]; if (!x) a.appendChild(y); else if (memeNoeud(x, y)) patchNoeud(x, y); else a.replaceChild(y, x); });
    for (let i = bc.length; i < ac.length; i++) ac[i].remove();
  }
  const changes = { textes: [] };
  function morpher(cible, html) {
    const t = D.createElement('template'); if (!t?.content || !cible.firstChild) { return false; }
    t.innerHTML = html; changes.textes = [];
    if (cible.childNodes.length !== 1 || !memeNoeud(cible.firstChild, t.content.firstChild)) return false;
    patchNoeud(cible.firstChild, t.content.firstChild);
    return true;
  }
  /* Ce qui a changé de valeur se signale une fois, brièvement (chiffres, compteurs, mot d'état) ; rien en boucle. */
  function apresMorph() {
    for (const n of new Set(changes.textes)) {
      const e = n?.closest?.('.sg-chiffre,.sg-n,.sg-droite,.sg-allure b,.sg-fin dd b'); if (!e) continue;
      e.classList.remove('sg-tic'); void e.offsetWidth; e.classList.add('sg-tic');
    }
  }
  /* Connexion T21 (fiches/CONNEXION_T21.md) : le panneau s'ouvre sur l'accueil du panneau d'avant (`#home`, background.js `openPanel`), où panel.js
   * (`discover`) ne cherche pas les onglets ESV ; c'est le clic sur « Orbite » ou « Écho » de cet accueil qui les cherchait et connectait l'onglet unique.
   * Signal n'a pas d'accueil : une fois, il entre dans la vue de l'activité qu'il affiche (Écho si une séance est en cours ou à terminer, sinon Orbite),
   * par un clic sur l'onglet d'origine. Rien d'autre : la règle de connexion est celle de `discover` (onglet unique, rien d'actif).
   * Test 22 (avec la bascule T21) : « à terminer » est ce que `echoEtat` appelle ainsi ; une séance FINIE (`FINISHED`, « Séance terminée », gardée par le
   * service worker après l'export) n'est ni ouverte ni à terminer : le panneau s'ouvre sur Orbite. */
  let entre = false;
  function entrer(s) {
    if (entre || variante !== 'signal' || secours) return;
    entre = true;
    if ((D.body?.dataset?.window || 'home') !== 'home') return;
    const n = s?.native, echo = !!n && (['RUNNING', 'PAUSED', 'STARTING', 'PAUSED_ADAPTER_UNRESPONSIVE'].includes(n.status) || (n.status !== 'FINISHED' && !!n.visits?.length));
    cliquer(echo ? 'tab-native' : 'tab-automatic');
  }
  /* Secours : si l'habillage ne sait pas se dessiner, le panneau d'avant revient tel quel, avec la raison dans sa ligne d'avis. Rien d'autre ne change. */
  function secourir(e) {
    secours = true;
    try { hote.hidden = true; D.body.classList.toggle('ui5', false); } catch { /* page minimale */ }
    const n = $('notice'); if (n) n.textContent = `Le nouveau panneau n’a pas pu s’afficher (${String(e?.message || e).slice(0, 120)}) : le panneau d’avant le remplace jusqu’à la prochaine ouverture du panneau.`;
  }
  /* Entre deux rendus du panneau : l'anneau « en cours » (temps passé sur le cut ÷ médiane) et « en pause depuis ». Le DOM seulement. */
  const ANNEAU = 2 * Math.PI * 9;
  function vivant() {
    if (!hote || variante !== 'signal' || hote.hidden || !hote.querySelector) return;
    /* Revue T21 (R6) : l'écran n'est plus réécrit chaque seconde : tous les anneaux (instrument et poignée du tiroir) avancent ici. */
    const t = Date.now();
    for (const arc of hote.querySelectorAll?.('.sg-arc[data-debut][data-med]') || []) { const debut = Number(arc.dataset.debut), med = Number(arc.dataset.med); if (debut && med) arc.style.strokeDashoffset = (ANNEAU * (1 - Math.min(1, Math.max(0, t - debut) / med))).toFixed(2); }
    const p = hote.querySelector('.sg-pause-depuis[data-debut]');
    if (p) { const debut = Number(p.dataset.debut); if (debut) p.textContent = S5.duree((t - debut) / 1000); }
  }
  function noter(t) { ui.note = t; maj(true); clearTimeout(noter.h); noter.h = setTimeout(() => { ui.note = ''; maj(true); }, 2600); }

  /* ---------------------------------------------------------------- détails techniques (D-250)
   * Les sections techniques du panneau d'avant sont DÉPLACÉES dans une couche par-dessus Signal, puis remises à leur place à la fermeture :
   * mêmes éléments, mêmes boutons, même mise à jour par panel.js. Rien n'est recopié ni redessiné. */
  const TECH = ['native-health', 'native-quality', 'native-details', 'departs-liste', 'part-summary', 'lot-details'];
  let tech = null;
  function ouvrirTech() {
    if (tech || !D.createElement) return;
    const c = D.createElement('div'); c.id = 'ui5-tech'; c.className = 'sg-tech';
    c.innerHTML = '<div class="sg-tech-tete"><b>Détails techniques</b><span>Santé de la collecte, qualité de capture, départs des parties, résumé de la partie, exports et journal</span><button type="button" id="ui5-tech-fermer">Fermer</button></div><div class="sg-tech-corps"></div>';
    D.body.appendChild(c);
    const corps = c.querySelector('.sg-tech-corps'), deplaces = [];
    for (const id of TECH) {
      const e = $(id); if (!e || !e.parentNode) continue;
      const repere = D.createComment(`ui5-tech:${id}`); e.parentNode.insertBefore(repere, e);
      deplaces.push({ e, repere, cache: e.hidden }); if (id === 'lot-details') e.hidden = false; corps.appendChild(e);
    }
    tech = { c, deplaces };
    c.querySelector('#ui5-tech-fermer').onclick = fermerTech;
  }
  function fermerTech() {
    if (!tech) return;
    for (const { e, repere, cache } of tech.deplaces) { repere.parentNode?.insertBefore(e, repere); repere.remove(); if (e.id === 'lot-details') e.hidden = cache; }
    tech.c.remove(); tech = null;
  }

  /* ---------------------------------------------------------------- Signal : actions propres (tiroir, couches, Revue V2) */
  async function garderExamines() { try { await root.chrome?.storage?.local?.set?.({ [CLE_EX]: { lot: examines.lot, cles: [...examines.cles] } }); } catch { /* gardé pour cette fenêtre */ } }
  function themeVoulu(v) {
    const r = D.documentElement, voulu = v === 'clair' ? 'light' : 'dark';
    if (!r?.dataset) return;
    for (let i = 0; i < 2 && r?.dataset?.theme !== voulu; i++) cliquer('theme-toggle');
  }
  function agirSignal(act) {
    const [, quoi, ...reste] = act.split(':'), v = reste.join(':');
    if (quoi === 'tiroir') { ui.tiroir = !ui.tiroir; ui.sel = null; }
    /* CH-025 : un nombre de parties est un clic sur le bouton de la carte d'origine (`#file-n`, sans id : choisi par son `data-n`). */
    else if (quoi === 'file-n') { const b = [...($('file-n')?.children || [])].find(x => x.dataset?.n === v); if (b && !b.disabled) b.click(); }
    /* CH-026 : le troisième onglet « File de parties » : une vue de Signal (rien n'est envoyé au service worker) ; Orbite ou Écho le referme. */
    else if (quoi === 'onglet-file') { ui.onglet = 'file'; ui.couche = null; ui.tiroir = false; ui.sel = null; }
    /* CH-028 : l'onglet « Correction » (une vue de Signal) ; « Ouvrir » recopie « partie:cut » dans `#correction-cible` et clique `#correction-ouvrir`. */
    else if (quoi === 'onglet-correction') { ui.onglet = 'correction'; ui.couche = null; ui.tiroir = false; ui.sel = null; }
    else if (quoi === 'corr-ouvrir') {
      const [part, cut] = reste.map(Number), cible = $('correction-cible'), go = $('correction-ouvrir');
      if (!go || !cible || go.disabled || !Number.isInteger(part) || !Number.isInteger(cut)) { noter('Ouverture indisponible pour l’instant.'); return; }
      cible.value = `${part}:${cut}`; cliquer('correction-ouvrir'); noter(`Ouverture du cut ${cut} dans ESV…`); return;
    }
    else if (quoi === 'palette' || quoi === 'reglages' || quoi === 'esv' || quoi === 'file') { ui.couche = ui.couche === quoi ? null : quoi; ui.q = ''; ui.pi = 0; ui.focusQ = ui.couche === 'palette'; }
    else if (quoi === 'fermer') { ui.couche = null; ui.q = ''; ui.pi = 0; ui.focusQ = false; }
    else if (quoi === 'tech') { ui.couche = null; ouvrirTech(); }
    else if (quoi === 'examiner') { if (examines.cles.has(v)) examines.cles.delete(v); else examines.cles.add(v); void garderExamines(); }
    else if (quoi === 'ouvrir') {
      /* Revue T21 (D5) : un différé ou un vert appartient au LOT ; ESV peut afficher une autre partie (le moteur refuse alors, WRONG_PART, et le dit). */
      const part = root.ArianePanel.state()?.batch?.scope?.part ?? root.ArianePanel.state()?.current?.identity?.part, cible = $('goto-cut-cible'), go = $('goto-cut');
      if (!go || !cible || !Number.isInteger(Number(part)) || go.disabled) { noter(go?.getAttribute?.('title') || 'Ouverture dans ESV indisponible pour l’instant.'); return; }
      cible.value = `${Number(part)}:${Number(v)}`; cliquer('goto-cut'); noter(`Ouverture du cut ${v} dans ESV…`); return;
    }
    else if (quoi === 'choix') {
      const [nom, val] = [reste[0], reste[1]];
      if (nom === 'theme') themeVoulu(val);
      else if (nom === 'bandeau') { if ((val === 'oui') !== ($('bandeau-toggle')?.getAttribute?.('aria-pressed') === 'true')) cliquer('bandeau-toggle'); }
      else choisir(nom, val);
    }
    maj(true);
  }

  /* ---------------------------------------------------------------- actions */
  function cliquer(id) { const e = $(id); if (e && !e.disabled) e.click(); }
  function choisir(nom, v) {
    if (nom === 'relecture') cliquer('relecture-' + v);
    else if (nom === 'clic') cliquer('clic-' + v);
    else if (nom === 'grappe') { if ((v === 'oui') !== !!$('grappe-differes')?.checked) cliquer('grappe-differes'); }
    else if (nom === 'passe2') {
      /* État inconnu (case indéterminée) : la case prend l'inverse du choix, le clic la met au choix. */
      const c = $('passe-differes'); if (!v || !c) return;
      if (c.indeterminate) { c.indeterminate = false; c.checked = v !== 'oui'; }
      if ((v === 'oui') !== !!c.checked) cliquer('passe-differes');
    }
    else if (nom === 'raison') {
      if (v === 'non') { if ($('raison-actif')?.checked) cliquer('raison-actif'); }
      else { if (!$('raison-actif')?.checked) cliquer('raison-actif'); cliquer('raison-touches-' + v); }
    } else if (nom === 'onglet') { if ($('tabs')) $('tabs').value = v; }
    else if (nom === 'f5') { const e = $('relecture-f5'); if (e && !e.disabled && e.value !== v) { e.value = v; if (typeof e.onchange === 'function') e.onchange(); else e.dispatchEvent?.(new root.Event('change', { bubbles: true })); } }
    else if (nom === 'variante') void setVariante(v);
    setTimeout(() => maj(true), 250);
  }
  /* CH-026 : « Arrêter la file » se confirme. Le premier clic ne fait que demander (le bouton devient « Confirmer l'arrêt de la file » pendant 6 s) ;
   * seul un second clic venu au moins 600 ms après arrête : un double clic, ou un clic qui traverse un écran qui vient de changer, ne suffit pas.
   * La palette garde sa propre confirmation (seconde Entrée, Revue T21 G1). */
  const CONFIRME_FILE = { minMs: 600, maxMs: 6000 };
  function confirmerArretFile() {
    const t = Date.now(), c = ui.confirmeFile;
    if (c && t - c >= CONFIRME_FILE.minMs && t - c <= CONFIRME_FILE.maxMs) { ui.confirmeFile = null; clearTimeout(confirmerArretFile.h); return true; }
    if (!c || t - c > CONFIRME_FILE.maxMs) { ui.confirmeFile = t; clearTimeout(confirmerArretFile.h); confirmerArretFile.h = setTimeout(() => { ui.confirmeFile = null; maj(true); }, CONFIRME_FILE.maxMs); }
    maj(true); return false;
  }
  function agir(act, depuis) {
    const [type, v] = [act.split(':')[0], act.slice(act.indexOf(':') + 1)];
    if (act === 'legacy:file-secondaire' && depuis && !confirmerArretFile()) return;
    if (act === 'pause') { const b = root.ArianePanel.state()?.batch; if (b?.state === 'RUNNING' && $('pause') && !$('pause').disabled) { ui.pauseLot = b.id; cliquer('pause'); } }
    else if (type === 'sg') { agirSignal(act); return; }
    else if (type === 'tech') { ouvrirTech(); return; }
    else if (type === 'legacy') cliquer(v);
    else if (type === 'conn') { if ($('tabs')) $('tabs').value = v; cliquer('connect'); }
    else if (type === 'mode') { ui.onglet = null; cliquer(v === 'native' ? 'tab-native' : 'tab-automatic'); }
    else if (type === 'variante') void setVariante(v);
    maj(true);
  }

  /* ---------------------------------------------------------------- événements */
  function brancher() {
    hote.addEventListener('click', e => {
      const a = e.target.closest?.('[data-act]');
      {
        const raison = e.target.closest?.('[aria-disabled="true"][data-raison]'); if (raison) { noter(raison.dataset.raison); return; }
        const row = e.target.closest?.('[data-row]'); if (row && !a) { ui.sel = Number(row.dataset.row); maj(true); return; }
        if (a && (a.dataset.fermer || (!a.dataset.act.startsWith('sg:') && a.closest?.('.sg-palette,.sg-popover,.sg-feuille')))) { if (!a.closest?.('.sg-feuille')) { ui.couche = null; ui.q = ''; ui.pi = 0; ui.focusQ = false; } }
      }
      if (!a) return; agir(a.dataset.act, a);
    });
    hote.addEventListener('change', e => { const s = e.target.closest?.('[data-sel]'); if (s) choisir(s.dataset.sel, s.value); });
    /* bornes du prochain lot : recopiées dans les champs d'origine, que « Démarrer » lit */
    hote.addEventListener('input', e => {
      if (e.target.id === 'ui5-q') { ui.q = e.target.value; ui.pi = 0; maj(true); return; }
      const bo = e.target.dataset?.borne; if (bo && $(bo)) { $(bo).value = e.target.value; $(bo).dispatchEvent(new Event('input', { bubbles: true })); $(bo).dispatchEvent(new Event('change', { bubbles: true })); }
    });
    hote.addEventListener('focusin', e => { if (e.target.id === 'ui5-q') ui.focusQ = true; });
    hote.addEventListener('focusout', e => { if (e.target.id === 'ui5-q') ui.focusQ = false; });
    D.addEventListener('keydown', e => {
      if (secours || hote.hidden || e.altKey) return;
      clavierSignal(e);
    });
    root.addEventListener?.('resize', () => maj(true));
    if (typeof root.setInterval === 'function') root.setInterval(vivant, 500);
  }
  /* Clavier de Signal : Ctrl K ouvre ou ferme la palette, Échap ferme ce qui est ouvert (couche, détails, tiroir) ; dans la palette, ↑ ↓ et Entrée ;
   * tiroir ouvert, ↑ ↓ parcourent les lignes et E marque « examiné ». Une commande grisée n'est jamais lancée. */
  function clavierSignal(e) {
    const dansChamp = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') && e.target?.id !== 'ui5-q';
    if (e.key !== 'Enter') ui.confirme = null;   /* Revue T21 (G1) : toute autre touche annule la confirmation en attente */
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); agirSignal('sg:palette'); return; }
    if (e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') { if (ui.couche) agirSignal('sg:fermer'); else if (tech) fermerTech(); else if (ui.tiroir) agirSignal('sg:tiroir'); return; }
    if (ui.couche === 'palette') {
      const cmds = S5.paletteListe(instantane(root.ArianePanel.state() || {}), ui);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { ui.pi = Math.max(0, Math.min(cmds.length - 1, ui.pi + (e.key === 'ArrowDown' ? 1 : -1))); maj(true); e.preventDefault(); }
      else if (e.key === 'Enter') { const c = cmds[Math.max(0, Math.min(cmds.length - 1, ui.pi))]; e.preventDefault();
        /* Revue T21 (G1) : une commande dangereuse ne part qu'à la seconde Entrée (« ar » + Entrée n'arrête plus le lot d'un geste). */
        if (c && !c.off && c.danger && ui.confirme !== c.act) { ui.confirme = c.act; maj(true); }
        else if (c && !c.off) { ui.confirme = null; ui.couche = null; ui.q = ''; ui.pi = 0; ui.focusQ = false; agir(c.act); } }
      else if (e.target?.id !== 'ui5-q' && e.key.length === 1 && /[\p{L}]/u.test(e.key)) $('ui5-q')?.focus();
      return;
    }
    if (ui.couche || dansChamp || !ui.tiroir || tech) return;
    const etat = root.ArianePanel.state() || {}, snap = instantane(etat);
    if (snap.sig.activite !== 'orbite' && (e.key === 'e' || e.key === 'E')) return;
    const { D: Ld, V: Lv } = S5.lignesRevue(snap.ar || {}), lignes = snap.sig.activite === 'orbite' ? [...Ld, ...Lv] : (snap.echoRows || []);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!lignes.length) return; ui.sel = Math.max(0, Math.min(lignes.length - 1, (ui.sel ?? -1) + (e.key === 'ArrowDown' ? 1 : -1))); maj(true); hote.querySelector?.(`[data-row="${ui.sel}"]`)?.scrollIntoView?.({ block: 'nearest' }); e.preventDefault(); }
    else if ((e.key === 'e' || e.key === 'E') && ui.sel !== null && lignes[ui.sel]) agirSignal('sg:examiner:' + lignes[ui.sel].cle);
  }

  /* ---------------------------------------------------------------- variante et fenêtre */
  async function taille() {
    const t = TAILLE[variante]; const W = root.chrome?.windows;
    if (!t || !W?.getCurrent) return;
    try { const w = await W.getCurrent(); if (w?.type === 'popup' && (Math.abs((w.width || 0) - t[0]) > 40 || Math.abs((w.height || 0) - t[1]) > 40)) await W.update(w.id, { width: t[0], height: t[1] }); } catch { /* fenêtre non redimensionnable : sans effet */ }
  }
  /* `redimensionner` : à l'ouverture, seule une présentation habillée demande sa taille (le panneau d'avant garde celle que l'opérateur a donnée à la fenêtre) ; un changement de présentation la demande toujours. */
  /* `redimensionner` : un changement de présentation demande toujours sa taille à la fenêtre ; à l'ouverture, Signal garde la taille que l'opérateur a donnée
   * à la fenêtre (il s'adapte, compact sous 480 × 600), les présentations d'essai demandent la leur. */
  function appliquer(v, redimensionner) {
    variante = v;
    D.body.classList.toggle('ui5', !secours);
    hote.className = 'u-signal';
    hote.hidden = secours;
    ui.focusQ = ui.couche === 'palette';
    ui.last = '';
    maj(true);
    if (redimensionner) void taille();
  }
  async function setVariante(v) {
    if (!VARIANTES.includes(v)) return;
    try { await root.chrome?.storage?.local?.set?.({ [CLE]: v }); } catch { /* le choix vaut pour cette fenêtre */ }
    ui.q = ''; ui.pi = 0;
    appliquer(v, true);
  }

  async function init() {
    hote = D.createElement('div'); hote.id = 'ui5'; hote.hidden = true; D.body.appendChild(hote);
    /* Un choix gardé inconnu, l'ancien « ancienne » compris (le panneau d'avant n'est plus proposé, D-250), laisse le départ. */
    try { const o = await root.chrome?.storage?.local?.get?.([CLE, CLE_EX]), v = o?.[CLE], ex = o?.[CLE_EX];
      if (VARIANTES.includes(v)) variante = v;
      if (ex && typeof ex.lot === 'string' && Array.isArray(ex.cles)) { examines.lot = ex.lot; examines.cles = new Set(ex.cles.filter(c => typeof c === 'string').slice(0, 2000)); } } catch { /* défaut de la version */ }
    /* Compteur des exemples d'apprentissage (`ariane-compteur-gcv2-v1`, fiches/COMPTEUR_GCV2.md) : les cuts corrigés, tous projets. */
    try { const j = await (await fetch(root.chrome.runtime.getURL('datasets/compteur-gcv2.json'))).json();
      const total = j?.totaux?.tous?.corriges, d = j?.creeLe ? new Date(j.creeLe) : null;
      if (Number.isFinite(total) && d && !isNaN(d)) gcv2Base = { total, date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` }; } catch { /* sans compteur */ }
    brancher();
    root.ArianePanel.apres(() => maj(false));
    appliquer(variante);
  }
  void init();
  root.ArianeUi5 = { instantane, agir, setVariante, maj, ouvrirTech, fermerTech, ui };
})(typeof globalThis !== 'undefined' ? globalThis : this);
