/* Ariane 5.0 (CH-146, Lot B1, D-357, D-378, D-380, D-381) — CODE UNIQUE DE DÉCISION DU LOT PARTAGÉ ENTRE LE BANC ET LE SERVICE WORKER.
 *
 * Ce module pur factorise l'enchaînement de décision d'un cut sous le profil livré « L1-se » et d'un tour de deuxième passe en ombre,
 * afin que le banc hors ligne (`tools/banc-differes.cjs`) et le service worker (`background.js`) exécutent un seul et même code métier :
 *  1. `deciderCutL1se` : décision de la chaîne du lot, contre-expertise éventuelle, règle de grappe, reprise hors-vue `l1s-vue`,
 *     reprise `l1s-chaine` avec les options de L1 et la correction d'écartement, décision GCV2 `deciderDiffere` + `commander`,
 *     confrontation à la recherche large, garde après un différé, étage final d'ajustement sur le profil (`ajustementFin`),
 *     refus d'ancre de trajectoire sans ricochet (`ancre`), et mise à jour des voisins, des appuis, du transport et des restes de 2e passe.
 *  2. `deciderRestePasse` : décision d'un reste lors d'un tour de 2e passe en ombre (`deciderDiffere` avec les leviers de la passe,
 *     `commander`, garde A des appuis de la passe, recherche large en mode « différer », mise à jour du transport, ajustement fin
 *     et refus d'ancre sans ricochet).
 *  3. Briques pures réutilisables : `corrigerChaine`, `confronterRechercheLarge`, `jugerGardeApresDiffere`, `ajusterPoseFin`, `jugerAncre`.
 *
 * Invariant : 0 décision changée. Aucune dépendance au DOM ni aux API Chrome ; compatible synchrone (banc) et asynchrone (service worker). */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BananeDecisionLotPartagee = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const VERSION = 'decision-lot-partagee-1';
  const SIDES = ['left', 'right'];
  const fini = v => typeof v === 'number' && Number.isFinite(v);
  const estPromesse = x => !!(x && (typeof x === 'object' || typeof x === 'function') && typeof x.then === 'function');
  const suivre = (x, fn) => estPromesse(x) ? x.then(fn) : fn(x);

  /* Résolution dynamique des dépendances : lit d'abord le contexte global `root` (permettant aux essais en VM d'espionner ou remplacer
   * un module sur `b.ctx`), avec repli CommonJS en Node. */
  const nodeReq = typeof require === 'function' ? require : null;
  const cacheReq = {};
  function dep(nomGlobal, chemin) {
    if (root && root[nomGlobal]) return root[nomGlobal];
    if (!nodeReq) return null;
    if (!cacheReq[chemin]) cacheReq[chemin] = nodeReq(chemin);
    return cacheReq[chemin];
  }
  const modC = () => dep('BananeCaptureCore', '../vendor/capture-core.js');
  const modK = () => dep('BananeCore3', './core.js');
  const modG4 = () => dep('BananeGauge4', './gauge.js');
  const modL = () => dep('BananeLotDecision', './lot-decision.js');
  const modSh = () => dep('BananeGCV1Shadow', './gcv1-shadow.js');
  const modL1 = () => dep('BananeGcv2L1', './gcv2-l1.js');
  const modGA = () => dep('BananeGardePasseAppuis', './garde-passe-appuis.js');
  const modGAD = () => dep('BananeGardeApresDiffere', './garde-apres-differe.js');
  const modRL = () => dep('BananeRechercheLarge', './recherche-large.js');
  const modANC = () => dep('BananeAncreTrajectoire', './ancre-trajectoire.js');

  function decalPose(rails, positions) {
    const G = modL1();
    return positions && rails && G ? Object.fromEntries(SIDES.map(s => [s, G.decalage(rails[s], positions[s])])) : null;
  }

  function positionsDeRails(before, rails) {
    const K = modK();
    const x = K.expectedPoses({ rails: before }, rails);
    return Object.fromEntries(SIDES.map(s => [s, x[s].positionSceneRelative.slice(0, 3)]));
  }

  /* 4.9.5.15 : sous L1-se, une pose de la chaîne refaite par L1-s (vue amenée ou options de L1) passe par la correction d'écartement
   * de la GCV2 (`corrigerPoseChaine`). Rend { decal, positions, correction } ou null. */
  function corrigerChaine({ capture, positions = null, decal = null, reference = null } = {}) {
    const G = modL1(), L = modL();
    try {
      if (!G || !capture?.rails || (!positions && !decal)) return null;
      const d0 = decal || Object.fromEntries(SIDES.map(s => [s, G.decalage(capture.rails[s], positions[s])]));
      if (!SIDES.every(s => Array.isArray(d0[s]))) return null;
      const cc = G.corrigerPoseChaine(capture, d0, reference ?? null);
      const pos = cc.correction.appliquee
        ? G.positionsDe(capture, { left: { decal: cc.decal.left }, right: { decal: cc.decal.right } })
        : (positions || (L ? Object.fromEntries(SIDES.map(s => [s, L.positionOf(capture.rails[s], cc.decal[s].map(v => v / 1000))])) : null));
      return { decal: cc.decal, positions: pos, correction: cc.correction };
    } catch {
      return null;
    }
  }

  /* CH-034 : confrontation d'une pose candidate à la recherche large sur le nuage capturé.
   * Rend null (éteinte ou hors zone), { issue: 'garde', resume, garde }, { issue: 'differe', motif, resume, out },
   * ou { issue: 'remplace', positions, decal, rails, gaugeMm, resume, out }. */
  function confronterRechercheLarge({ capture, science = null, before, positions, cameras, zone = null, reglage, etage = null, origine = 'lot', cache = null, proposalRails = null } = {}) {
    const RL = modRL(), L = modL(), K = modK(), C = modC(), G4 = modG4();
    if (!RL || !reglage || !reglage.actif || !capture || !before || !positions) return null;
    if (Array.isArray(reglage.zones) && (!zone || !reglage.zones.includes(zone))) return null;
    const cle = cache ? 'rl' + SIDES.map(s => positions[s].map(v => v.toFixed(6)).join(',')).join(';') : null;
    let rl = cle ? cache.get(cle) : null;
    if (!rl) {
      try {
        const capRL = { identity: capture.identity ?? null, rails: capture.rails, pointsSceneRelative: capture.pointsSceneRelative, visibleByClipBoxes: capture.visibleByClipBoxes };
        const dd = RL.decider({ capture: capRL, positions, R: reglage, ...(science ? { science } : {}) });
        rl = { ...RL.resumer(dd), positions: dd.positions || null };
      } catch (e) {
        if (proposalRails) throw e;
        rl = { etat: 'erreur', message: String(e && e.message || e).slice(0, 120) };
      }
      if (cle) cache.set(cle, rl);
    }
    const { positions: pRL, ...resume } = rl;
    if (rl.etat === 'differer') {
      return { issue: 'differe', motif: rl.motif, resume, out: { etat: 'differe', source: 'recherche-large', etage, rechercheLarge: { ...resume, origine } } };
    }
    if (rl.etat === 'remplacer' && pRL) {
      if (proposalRails && C && K && G4) {
        const rails = {};
        for (const s of SIDES) {
          const init = before[s], M = init.sceneRelativeToProfileLocal, q = C.point(M, pRL[s]), o = C.point(M, init.positionSceneRelative);
          rails[s] = { ...proposalRails[s], status: 'candidate', delta: [q[0] - o[0], q[1] - o[1], q[2] - o[2]], confidence: 0,
            reasons: ['décision sur le lot : recherche large sur le nuage, meilleure paire loin de la pose'],
            source: 'recherche-large', lotDecision: { stage: 'recherche-large', version: RL.VERSION } };
        }
        let exp2;
        try { exp2 = K.expectedPoses({ rails: before }, rails); } catch {
          return { issue: 'differe', motif: 'remplacer-position-illisible', resume, out: { etat: 'differe', source: 'recherche-large', etage, rechercheLarge: { ...resume, origine, motifFinal: 'remplacer-position-illisible' } } };
        }
        if (SIDES.some(s => C.distance(exp2[s].positionSceneRelative, pRL[s]) > 1e-5)) {
          return { issue: 'differe', motif: 'remplacer-position-mismatch', resume, out: { etat: 'differe', source: 'recherche-large', etage, rechercheLarge: { ...resume, origine, motifFinal: 'remplacer-position-mismatch' } } };
        }
        const gaugeMm = G4.gaugeMmOf(exp2, C);
        if (!G4.admissible(G4.classifyMm(gaugeMm))) {
          const m = 'remplacer-ecartement-' + G4.classifyMm(gaugeMm);
          return { issue: 'differe', motif: m, resume, out: { etat: 'differe', source: 'recherche-large', etage, rechercheLarge: { ...resume, origine, motifFinal: m } } };
        }
        for (const s of SIDES) {
          const cam = cameras?.[s];
          if (!cam || !L.inView(cam, pRL[s]).inView) {
            const m = 'remplacer-hors-vue-' + s;
            return { issue: 'differe', motif: m, resume, out: { etat: 'differe', source: 'recherche-large', etage, rechercheLarge: { ...resume, origine, motifFinal: 'remplacer-hors-vue' } } };
          }
        }
        const gArrondi = Math.round(gaugeMm * 10) / 10;
        return { issue: 'remplace', positions: pRL, decal: decalPose(before, pRL), rails, gaugeMm: gArrondi, resume,
          out: { etat: 'pose', source: 'recherche-large', etage, commande: 'lot', vue: null, decal: decalPose(before, pRL), rechercheLarge: { ...resume, origine } } };
      }
      if (SIDES.every(s => cameras && cameras[s] && L.inView(cameras[s], pRL[s]).inView)) {
        const dec = decalPose(before, pRL);
        return { issue: 'remplace', positions: pRL, decal: dec, resume,
          out: { etat: 'pose', source: 'recherche-large', etage, commande: 'lot', vue: null, decal: dec, rechercheLarge: { ...resume, origine } } };
      }
      return { issue: 'differe', motif: 'remplacer-hors-vue', resume,
        out: { etat: 'differe', source: 'recherche-large', etage, rechercheLarge: { ...resume, origine, motifFinal: 'remplacer-hors-vue' } } };
    }
    return { issue: 'garde', resume, garde: { ...resume, origine } };
  }

  /* CH-019 : garde « après un différé » (R1/R3), en mode actif ou en ombre. */
  function jugerGardeApresDiffere({ cut, part = null, batch = null, differesLot = null, lotCommands = null, lotObservation = null, appuis = undefined, reglage = null } = {}) {
    const GAD = modGAD(), L = modL();
    const R = reglage && typeof reglage.ok === 'boolean' ? reglage : GAD?.reglage(reglage);
    if (!GAD || !R || (R.ok && !R.actif && !R.ombre) || !Number.isInteger(cut)) return null;
    const appuisMesures = appuis !== undefined ? appuis
      : Array.isArray(lotObservation?.anchorsUsed) ? lotObservation.anchorsUsed.length
      : Number.isInteger(lotObservation?.l1?.chaine?.appuis) ? lotObservation.l1.chaine.appuis : null;
    const gap = L?.DEFAULTS?.gap ?? 3, max = L?.DEFAULTS?.anchors ?? 2;
    const cmds = lotCommands || batch?.lotCommands || null;
    const gardes = [];
    for (let c = cut - gap; c < cut; c++) if (cmds?.[c]?.gardeApresDiffere === true) gardes.push(c);
    const appuisSansGardeMax = appuisMesures === null ? null : gardes.length ? Math.min(max, appuisMesures + gardes.length) : appuisMesures;
    if (R.ok && !R.actif && R.ombre) {
      const diffs = differesLot || (batch?.deferred || []).filter(d => (d?.identity?.part ?? null) === (part ?? null)).map(d => d?.cut ?? d?.identity?.cut).filter(Number.isInteger);
      const j = GAD.juger({ cut, differesLot: diffs, appuis: appuisMesures }, R);
      return { mode: 'ombre', reglage: R, version: GAD.VERSION, differer: false, aurait: !!j.aurait, jugement: j, appuis: appuisMesures, appuisSansGardeMax, gardes, fenetre: gap };
    }
    const diffs = differesLot || (batch?.deferred || []).filter(d => (d?.identity?.part ?? null) === (part ?? null)).map(d => d?.cut ?? d?.identity?.cut)
      .filter(c => Number.isInteger(c) && cmds?.[c]?.gardeApresDiffere !== true);
    const j = GAD.juger({ cut, differesLot: diffs, appuis: appuisSansGardeMax }, R);
    return { mode: 'actif', reglage: R, version: GAD.VERSION, differer: !!j.differer, aurait: !!j.differer, jugement: j, appuis: appuisMesures, appuisSansGardeMax, gardes, fenetre: gap };
  }

  /* CH-121 : étage final d'ajustement d'une pose de L1-se sur le profil du rail (`ajusterPoseFinale` + `commander`). */
  function ajusterPoseFin({ capture, before, runtimeRails, cameras = null, positions = null, decal = null, source = 'lot', vue = null, reglage = null, ajuster = null } = {}) {
    const G = modL1(), L = modL(), K = modK();
    if (!G || !L || !K || !reglage || !capture?.rails || !before || !runtimeRails || vue) return null;
    if (reglage.seulChaine && source !== 'lot') return null;
    const decalAvant = decal || (positions ? decalPose(before, positions) : null);
    if (!decalAvant || !SIDES.every(s => Array.isArray(decalAvant[s]))) return null;
    const a = ajuster ? ajuster(capture, decalAvant, reglage) : (reglage === true ? G.ajusterPoseFinale(capture, decalAvant) : G.ajusterPoseFinale(capture, decalAvant, reglage));
    if (!a || !a.ajuste) return { ajuste: false };
    const pos = Object.fromEntries(SIDES.map(s => [s, L.positionOf(before[s], a.decal[s].map(v => v / 1000))]));
    const cams = cameras || L.viewCameras(capture);
    const cg = G.commander({ positions: pos, runtimeRails, before, expectedPoses: K.expectedPoses, cameras: cams, valider: true });
    if (cg.action !== 'lot' || cg.vue !== 'dans') {
      return { ajuste: false, refus: cg.reason || 'vue', info: a.info };
    }
    const decalApres = decalPose(before, pos);
    return { ajuste: true, positions: pos, decalAvant, decal: decalApres, info: a.info, commande: cg };
  }

  /* CH-124 : jugement d'une pose par l'ancre de trajectoire (sans ricochet). */
  function jugerAncre({ etatAncre, cut, capture = null, before, positions = null, decal = null, source = 'lot', etage = null, appui = false, positionsDecision = null } = {}) {
    const ANC = modANC(), L = modL();
    if (!ANC || !etatAncre || !before || !Number.isInteger(cut)) return null;
    const pos = positions || (decal && L ? Object.fromEntries(SIDES.map(s => [s, L.positionOf(before[s], decal[s].map(v => v / 1000))])) : null);
    if (!pos) return null;
    const j = ANC.juger(etatAncre, cut, capture || { rails: before }, pos);
    if (j.refus !== true) return { refus: false, jugement: j };
    const posFantome = positionsDecision ? { left: positionsDecision.left.slice(0, 3), right: positionsDecision.right.slice(0, 3) } : pos;
    return {
      refus: true,
      jugement: j,
      appui: !!appui,
      positionsFantome: posFantome,
      outBanc: { etat: 'differe', source: 'ancre', etage, origine: source, ancre: j, decalRefuse: decal || decalPose(before, pos) },
    };
  }

  /* 1. DÉCISION CENTRALE D'UN CUT EN PROFIL « L1-se » (commune au banc et au service worker).
   * - Au banc (synchrone, `etatProfil` / `E` fourni, sans `proposal`) : retourne directement `{ out, decisionLot, posesL1s, valideChaine, restePasse }`
   *   et met à jour `E.valides`, `E.anchors` et `E.validesL1`.
   * - Dans le service worker (asynchrone, `proposal` et callbacks de pont/stockage fournis) : retourne une promesse `{ command, out, decisionLot }`
   *   et met à jour `lotObservation`, le transport et les restes de la 2e passe. */
  function deciderCutL1se(args) {
    const G = modL1(), L = modL(), K = modK(), Sh = modSh();
    const {
      capture,
      nuage = capture,
      science = null,
      obtenirScience = null,
      runtimeRails = args.proposal?.rails,
      before = capture?.rails,
      decisionLot = null,
      decideCut = null,
      decideCutL1 = null,
      deciderGcv2 = null,
      commandeInitiale = null,
      autoriserL1sVue = true,
      contexteValide = true,
      anchors = [],
      voisins = undefined,
      obtenirVoisins = null,
      voisinsTransport = undefined,
      obtenirVoisinsTransport = null,
      zone = null,
      plagesADV = [],
      obtenirZone = null,
      modele = null,
      obtenirModele = null,
      reference = undefined,
      obtenirReference = null,
      voieListe = undefined,
      obtenirVoieListe = null,
      etatAncre = undefined,
      obtenirEtatAncre = null,
      cameras = nuage && L ? L.viewCameras(nuage) : null,
      camerasLarges = null,
      leviers = G ? G.leviersActifs() : {},
      etatProfil = null,
      identity = capture?.identity || null,
      cache = null,
      grappeBloque = null,
      reglages = {},
      validerVue = null,
      appliquerReglesMetier = null,
      transporter = null,
      suivreReste = null,
      surPoseEnAttente = null,
      etapesSw = null,
      journalTexte = null,
      proposal = null,
    } = args;

    const cut = identity?.cut ?? capture?.identity?.cut ?? null;
    const E = etatProfil;
    const RLR = reglages.rechercheLarge ?? null;
    const reglageAjustement = reglages.ajustementFin !== undefined ? reglages.ajustementFin : (leviers.ajustementFin ?? null);
    const resoudreRef = () => reference !== undefined ? reference : (obtenirReference ? obtenirReference() : null);
    const resoudreVoieListe = () => voieListe !== undefined ? voieListe : (obtenirVoieListe ? obtenirVoieListe() : null);
    const resoudreAncre = () => etatAncre !== undefined ? etatAncre : (obtenirEtatAncre ? obtenirEtatAncre() : null);

    /* Chemin Service Worker (quand `proposal` ou `etapesSw` est fourni) : exécute le pipeline L1-se avec ses callbacks asynchrones de vue et de liste. */
    if (proposal || etapesSw) {
      return (async () => {
        const lotObs = decisionLot;
        let command = commandeInitiale || L.commandRails({ decision: lotObs, runtimeRails, before, expectedPoses: K.expectedPoses, cameras });

        /* a. Reprise hors-vue de la chaîne normale (`l1s-vue`), corrigée à l'écartement de référence sous L1-se. */
        if (autoriserL1sVue && command.action !== 'lot' && /(^|-)hors-vue-(left|right)$/.test(command.reason || '')) {
          const ref = lotObs?.positions && capture ? await resoudreRef() : null;
          const cc = lotObs?.positions && capture ? corrigerChaine({ capture, positions: lotObs.positions, reference: ref }) : null;
          if (cc) lotObs.l1eChaine = { correction: cc.correction };
          const obs = cc && cc.correction.appliquee ? { ...lotObs, positions: cc.positions } : lotObs;
          const essai = validerVue ? await validerVue({ etape: 'l1s-vue', decision: obs, command }) : null;
          if (essai && essai.command) command = { ...essai.command, l1s: 'vue' };
          if (cc && command.action === 'lot' && command.l1s === 'vue') lotObs.l1eChaine.positions = obs.positions;
        }

        /* Règles métier (grappe de différés) sur la commande de la chaîne ou `l1s-vue`. */
        if (appliquerReglesMetier) command = appliquerReglesMetier(command);
        if (command.action === 'lot' && command.l1s === 'vue' && lotObs?.l1eChaine?.positions && transporter) {
          transporter(capture, identity, lotObs.l1eChaine.positions);
        }

        /* b. & c. Étape L1 (`l1s-chaine` puis `gcv2`) si la chaîne normale / `l1s-vue` ne pose pas le cut. */
        const dejaPose = command.action === 'lot' || (command.action === 'engine' && SIDES.every(s => command.rails?.[s]?.status === 'candidate'));
        if (!dejaPose) {
          try {
            if (command.reason === 'regles-metier') {
              lotObs.l1 = { version: G.VERSION, etat: 'rien', motif: 'regle-metier' };
            } else if (!contexteValide) {
              lotObs.l1 = { version: G.VERSION, etat: 'rien', motif: 'contexte-absent' };
            } else {
              /* b. Décision du lot refaite avec les options de L1 (`l1s-chaine`) + correction d'écartement. */
              let poseChaineL1 = false;
              let d2 = decideCutL1 ? decideCutL1() : L.decideCut({ capture, science, anchors, Shadow: Sh, options: { ...G.REGLE.lotOptions } });
              const ref2 = d2.positions ? await resoudreRef() : null;
              const cc2 = d2.positions ? corrigerChaine({ capture, positions: d2.positions, reference: ref2 }) : null;
              if (cc2 && cc2.correction.appliquee) d2 = { ...d2, positions: cc2.positions };
              let c2 = L.commandRails({ decision: d2, runtimeRails, before, expectedPoses: K.expectedPoses, cameras });
              if (c2.action !== 'lot' && /(^|-)hors-vue-(left|right)$/.test(c2.reason || '') && d2.positions && validerVue) {
                const essai2 = await validerVue({ etape: 'l1s-chaine', decision: d2, command: c2 });
                if (essai2 && essai2.command) c2 = essai2.command;
              }
              if (c2.action === 'lot') {
                const c = appliquerReglesMetier ? appliquerReglesMetier({ ...c2 }) : { ...c2 };
                lotObs.l1 = {
                  version: G.VERSION,
                  etat: c.action === 'lot' ? 'chaine-l1' : 'rien',
                  motif: c.action === 'lot' ? null : 'regles-metier',
                  etage: d2.stage,
                  raison: d2.reason != null ? String(d2.reason).slice(0, 80) : null,
                  poseAvant: Object.fromEntries(SIDES.map(s => [s, before?.[s]?.positionSceneRelative?.slice(0, 3) ?? null])),
                  poseEnvoyee: Object.fromEntries(SIDES.map(s => [s, d2.positions?.[s]?.slice(0, 3) ?? null])),
                  ...(cc2 ? { correction: cc2.correction } : {}),
                };
                if (c.action === 'lot') {
                  if (transporter) transporter(capture, identity, d2.positions);
                  command = { ...c, l1s: 'chaine' };
                  poseChaineL1 = true;
                }
              }

              /* c. GCV2 (`deciderDiffere` + `commander`) si `l1s-chaine` n'a pas posé. */
              if (!poseChaineL1) {
                const t0 = Date.now();
                const sc = science || (obtenirScience ? obtenirScience() : Sh.scientificProposeBothAvecReservoir(capture));
                const z = obtenirZone ? obtenirZone() : { zone: zone || 'abords', adv: plagesADV || [], source: 'regles-metier' };
                const refG = await resoudreRef();
                const vlG = await resoudreVoieListe();
                const vsG = voisins !== undefined ? voisins : (obtenirVoisins ? obtenirVoisins() : []);
                const vtG = voisinsTransport !== undefined ? voisinsTransport : (obtenirVoisinsTransport ? obtenirVoisinsTransport() : undefined);
                const modG = modele || (obtenirModele ? obtenirModele() : null);
                const g = G.deciderDiffere({
                  capture, science: sc, appuis: anchors, options: { ...G.REGLE.lotOptions },
                  voisins: vsG, zone: z.zone, plagesADV: z.adv, modele: modG,
                  regle: G.REGLE_E, reference: refG, voieListe: vlG,
                  ...(vtG !== undefined ? { voisinsTransport: vtG } : {}),
                });
                const dec = g.decision, l1 = { ...G.resumer(g), zoneSource: z.source, ms: Date.now() - t0 };
                lotObs.l1 = l1;
                if (dec.etat !== 'rien') {
                  const p3 = v => Array.isArray(v) ? v.slice(0, 3) : null;
                  l1.poseAvant = Object.fromEntries(SIDES.map(s => [s, p3(before?.[s]?.positionSceneRelative)]));
                  l1.poseEnvoyee = Object.fromEntries(SIDES.map(s => [s, p3(g.positions?.[s])]));
                  const valider = dec.etat === 'valider';
                  const cg = G.commander({ positions: g.positions, runtimeRails, before, expectedPoses: K.expectedPoses, cameras, camerasLarges, valider });
                  l1.commande = { action: cg.action, reason: cg.reason, vue: cg.vue ?? null };
                  if (cg.action === 'lot') {
                    let plan = null, vueOk = true;
                    if (cg.vue === 'deplacer' && validerVue) {
                      const v = await validerVue({ etape: 'gcv2', positions: g.positions, command: cg });
                      if (!v || !v.ok) { l1.commande.refus = 'vue:' + (v?.raison || '?'); vueOk = false; }
                      else plan = v.plan;
                    }
                    if (vueOk) {
                      if (valider) {
                        const cmdG = { action: 'lot', reason: 'gcv2-l1', rails: cg.rails, gaugeMm: cg.gaugeMm, ...(plan ? { deplacerVue: plan } : {}) };
                        const c = appliquerReglesMetier ? appliquerReglesMetier(cmdG) : cmdG;
                        if (c.action !== 'lot') l1.commande.refus = 'regles-metier';
                        else {
                          if (transporter) transporter(capture, identity, g.positions);
                          command = { ...c, l1s: 'gcv2' };
                        }
                      } else {
                        if (surPoseEnAttente) surPoseEnAttente({ rails: cg.rails, plan, dec, l1 });
                        l1.commande.sansValider = 'en-attente-de-la-navigation';
                      }
                    }
                  }
                }
              }
            }
          } catch (e) {
            lotObs.l1 = { version: G?.VERSION ?? null, etat: 'erreur', message: String(e?.message || e).slice(0, 160) };
          }
        }

        if (suivreReste) suivreReste(command, lotObs);
        if (etapesSw?.rechercheLarge) command = etapesSw.rechercheLarge(command);
        if (etapesSw?.gardeApresDiffere) command = etapesSw.gardeApresDiffere(command);
        if (etapesSw?.ajustementFin) command = etapesSw.ajustementFin(command);
        if (etapesSw?.ancre) command = await etapesSw.ancre(command);
        return { command, decisionLot: lotObs };
      })();
    }

    /* Chemin pur synchrone (banc et appels directs sur fixtures) : retourne directement `{ out, decisionLot, posesL1s, valideChaine, restePasse }`. */
    const d = decisionLot || (decideCut ? decideCut() : L.decideCut({ capture, science, anchors: E ? E.anchors : anchors, Shadow: Sh, options: {} }));
    let cmd = commandeInitiale || L.commandRails({ decision: d, runtimeRails, before, expectedPoses: K.expectedPoses, cameras });
    let vue = null;
    let pose = cmd.action === 'lot' || (cmd.action === 'engine' && SIDES.every(s => cmd.rails && cmd.rails[s] && cmd.rails[s].status === 'candidate'));
    let positions = null;
    if (pose) positions = cmd.action === 'lot' ? d.positions : positionsDeRails(before, cmd.rails);
    const estBloqueGrappe = (dd = d) => grappeBloque ? !!grappeBloque(dd) : false;
    let posesL1s = false;
    let out;

    /* Contre-expertise de la chaîne (leviers `contreChaineZones`, `contreChaineMm`, coupés par défaut). */
    let ombre = null, contre = null;
    const listeVoisins = E ? E.valides : (voisins || []);
    const listeTransport = E ? E.validesL1 : (voisinsTransport || null);
    if (pose && (leviers.contreChaineZones || []).includes(zone) && !estBloqueGrappe(d)) {
      try {
        const transportActif = leviers.transport && listeTransport && listeTransport.length;
        const ev = fini(leviers.contreChaineVoieMm) ? G.ecartAVoie(capture, cut, listeVoisins.concat(transportActif ? listeTransport : []), decalPose(before, positions)) : null;
        if (fini(leviers.contreChaineVoieMm) && !(ev && Math.max(ev.proche, ev.droite) > leviers.contreChaineVoieMm)) throw null;
        const g = G.deciderDiffere({
          capture, science, appuis: (E ? E.anchors : anchors).slice(), options: { ...G.REGLE.lotOptions },
          voisins: listeVoisins, voisinsTransport: transportActif ? listeTransport : null,
          zone, plagesADV, modele, regle: G.REGLE_E,
          reference: resoudreRef(), voieListe: resoudreVoieListe(),
        });
        ombre = G.resumer(g);
        if (G.contreChaine(g, decalPose(before, positions), leviers.contreChaineMm)) { contre = g; pose = false; }
      } catch (e) { if (e) ombre = { erreur: String(e.message || e).slice(0, 120) }; }
    }

    const confronter = (pos, etg, cams, orig) => confronterRechercheLarge({ capture, science, before, positions: pos, cameras: cams, zone, reglage: RLR, etage: etg, origine: orig, cache });
    const appliquerRL = (o, pos, cams) => {
      const rl = confronter(pos, o.etage, cams, o.source);
      if (!rl) return o;
      if (rl.out) return rl.out.etat === 'pose' ? { ...rl.out, vue: o.vue } : rl.out;
      return { ...o, rechercheLarge: rl.garde };
    };

    if (pose && estBloqueGrappe(d)) {
      pose = false;
      out = { etat: 'differe', source: 'regle-grappe', etage: d.stage };
    } else if (pose) {
      const rl = confronter(positions, d.stage, vue ? camerasLarges : cameras, 'lot');
      if (rl && rl.out && rl.out.etat === 'differe') {
        pose = false;
        out = rl.out;
      } else if (rl && rl.out) {
        positions = rl.positions;
        if (E) E.valides.push({ identity, positions, rails: before });
        out = { ...rl.out, vue };
      } else {
        if (E) {
          E.valides.push({ identity, positions, rails: before });
          if (L.commandsPositions(d, cmd)) L.rememberAnchor(E.anchors, { identity, positions: d.positions, stage: d.stage }, E.max);
        }
        out = { etat: 'pose', source: 'lot', etage: d.stage, commande: cmd.action, vue, decal: decalPose(before, positions), ...(ombre ? { ombre } : {}), ...(rl ? { rechercheLarge: rl.garde } : {}) };
      }
    } else if (!contre && (() => {
      /* a. Cible de la chaîne hors de la vue : vue élargie, pose de la chaîne, validée, jamais appui ni voisin. */
      if (/(^|-)hors-vue-(left|right)$/.test(cmd.reason || '')) {
        const large = L.commandRails({ decision: d, runtimeRails, before, expectedPoses: K.expectedPoses, cameras: camerasLarges });
        if (large.action === 'lot') {
          out = estBloqueGrappe(d)
            ? { etat: 'differe', source: 'regle-grappe', etage: d.stage }
            : { etat: 'pose', source: 'l1s-vue', etage: d.stage, commande: 'lot', vue: 'deplacee', decal: decalPose(before, d.positions) };
          if (out.etat === 'pose') out = appliquerRL(out, d.positions, camerasLarges);
          return true;
        }
      }
      /* b. Décision du lot refaite avec les options de L1 (garde de paire éteinte, appuis à 10 cuts), mêmes appuis. */
      const d2 = decideCutL1 ? decideCutL1() : L.decideCut({ capture, science, anchors: E ? E.anchors : anchors, Shadow: Sh, options: { ...G.REGLE.lotOptions } });
      let c2 = L.commandRails({ decision: d2, runtimeRails, before, expectedPoses: K.expectedPoses, cameras }), vue2 = null;
      if (c2.action !== 'lot' && /(^|-)hors-vue-(left|right)$/.test(c2.reason || '')) {
        const l2 = L.commandRails({ decision: d2, runtimeRails, before, expectedPoses: K.expectedPoses, cameras: camerasLarges });
        if (l2.action === 'lot') { c2 = l2; vue2 = 'deplacee'; }
      }
      if (c2.action !== 'lot') return false;
      const pos2 = d2.positions;
      out = estBloqueGrappe(d2)
        ? { etat: 'differe', source: 'regle-grappe', etage: d2.stage }
        : { etat: 'pose', source: 'l1s-chaine', etage: d2.stage, commande: c2.action, vue: vue2, decal: decalPose(before, pos2) };
      if (out.etat === 'pose') out = appliquerRL(out, pos2, vue2 ? camerasLarges : cameras);
      return true;
    })()) {
      posesL1s = out.etat === 'pose';
      /* 4.9.5.15 : sous L1-se, la pose refaite de la chaîne passe par la même correction d'écartement que la GCV2 (pas une pose remplacée par la recherche large). */
      if (out.etat === 'pose' && out.decal && out.source !== 'recherche-large') {
        const cc = corrigerChaine({ capture, decal: out.decal, reference: resoudreRef() });
        if (cc) {
          out.decal = cc.decal;
          out.correction = cc.correction;
          if (leviers.transport && E) (E.validesL1 = E.validesL1 || []).push({ identity, positions: Object.fromEntries(SIDES.map(s => [s, L.positionOf(before[s], out.decal[s].map(v => v / 1000))])), rails: before });
        }
      }
    } else {
      /* c. La GCV2 (L1-e) sur un cut que la chaîne du lot ne pose pas. */
      const base = { source: 'gcv2', etage: d.stage, raison: d.reason != null ? String(d.reason).slice(0, 80) : null, ...(contre ? { contreChaine: decalPose(before, positions) } : {}) };
      try {
        const transportActif = leviers.transport && listeTransport && listeTransport.length;
        let g;
        if (contre) g = contre;
        else if (deciderGcv2) g = deciderGcv2(!!transportActif);
        else g = G.deciderDiffere({
          capture, science, appuis: (E ? E.anchors : anchors).slice(), options: { ...G.REGLE.lotOptions },
          voisins: listeVoisins, voisinsTransport: transportActif ? listeTransport : null,
          zone, plagesADV, modele, regle: G.REGLE_E,
          reference: resoudreRef(), voieListe: resoudreVoieListe(),
        });
        const dec = g.decision, l1 = G.resumer(g);
        if (dec.etat === 'rien') out = { ...base, etat: 'differe', l1 };
        else {
          const valider = dec.etat === 'valider';
          const cg = G.commander({ positions: g.positions, runtimeRails, before, expectedPoses: K.expectedPoses, cameras, camerasLarges, valider });
          if (cg.action !== 'lot') out = { ...base, etat: 'differe', l1: { ...l1, refusCommande: cg.reason } };
          else if (valider && estBloqueGrappe(d)) out = { ...base, etat: 'differe', l1: { ...l1, refusCommande: 'regle-grappe' } };
          else if (valider) {
            const vueG = cg.vue === 'deplacer' ? 'deplacee' : null;
            const rl = confronter(g.positions, d.stage, vueG ? camerasLarges : cameras, 'gcv2');
            if (rl && rl.out && rl.out.etat === 'differe') out = { ...base, ...rl.out, l1 };
            else {
              const positionsG = rl && rl.out ? rl.positions : g.positions;
              if (leviers.transport && E) (E.validesL1 = E.validesL1 || []).push({ identity, positions: positionsG, rails: before });
              out = rl && rl.out
                ? { ...base, ...rl.out, vue: vueG, l1, aControler: dec.aControler === true }
                : { ...base, etat: 'pose', vue: vueG, decal: decalPose(before, g.positions), l1, aControler: dec.aControler === true, ...(rl ? { rechercheLarge: rl.garde } : {}) };
            }
          } else out = { ...base, etat: 'pose-non-validee', vue: cg.vue === 'deplacer' ? 'deplacee' : null, decal: decalPose(before, g.positions), l1 };
        }
      } catch (e) {
        out = { ...base, etat: 'differe', erreur: String(e && e.message || e).slice(0, 120) };
        if (journalTexte) journalTexte(`cut ${cut} (L1-se) : ${out.erreur}`);
      }
    }

    /* CH-121 : étage final d'ajustement de la pose sur le profil du rail, dans la vue courante, avant le refus d'ancre. */
    if (reglageAjustement && out && out.etat === 'pose' && out.decal && !out.vue && (!reglageAjustement.seulChaine || out.source === 'lot')) {
      const af = ajusterPoseFin({ capture, before, runtimeRails, cameras, decal: out.decal, source: out.source, vue: out.vue, reglage: true, ajuster: reglages.ajuster });
      if (af && af.ajuste) {
        if (!reglageAjustement.voisinsDecision && E) {
          const v = E.valides.find(x => x.identity.cut === identity.cut && x.identity.part === identity.part && (x.identity.frameId ?? null) === (identity.frameId ?? null));
          if (v) v.positions = af.positions;
        }
        out = { ...out, decal: af.decal, ajustementFin: { avant: out.decal, info: af.info } };
      } else if (af && af.refus) {
        out = { ...out, ajustementFin: { refus: af.refus, info: af.info } };
      }
    }

    /* Cap 5 : un différé de L1-se (hors règle de grappe et hors refus d'ancre) est gardé pour la deuxième passe. */
    const restePasse = !!(out && out.etat === 'differe' && (out.source === 'gcv2' || out.source === 'lot' || out.source === 'recherche-large'));
    const valideChaine = !!(out && out.etat === 'pose' && !(posesL1s || out.source === 'gcv2'));

    /* CH-124 : refus d'ancre, sans ricochet (la pose refusée reste appui, voisine, transport et mémoire de grappe ; elle n'est pas donnée à la 2e passe). */
    const Ea = resoudreAncre();
    if (Ea && out && out.etat === 'pose' && out.decal) {
      const ja = jugerAncre({ etatAncre: Ea, cut, capture, before, decal: out.decal, source: out.source, etage: out.etage });
      if (ja) out = ja.refus ? ja.outBanc : { ...out, ancre: ja.jugement };
    }

    return { out, decisionLot: d, posesL1s, valideChaine, restePasse };
  }

  /* 2. DÉCISION CENTRALE D'UN TOUR DE DEUXIÈME PASSE EN OMBRE (`deciderRestePasse`, commune au banc et au service worker).
   * Enchaîne : `deciderDiffere` (avec `leviersPasse` si fournis) → `commander` → garde A (`garde-appuis`) → `rechercheLarge` (mode `'differer'`, `passe:true`)
   * → ajout au transport L1-se → `ajustementFin` → refus `ancre` sans ricochet.
   * Compatible synchrone (banc : `etatAncre` direct) et asynchrone (service worker : `obtenirEtatAncre` asynchrone). */
  function deciderRestePasse(args) {
    const G = modL1(), L = modL(), K = modK(), GA = modGA();
    const {
      capture,
      science,
      runtimeRails,
      before = capture?.rails,
      cameras,
      camerasLarges,
      appuis = [],
      voisins = [],
      obtenirCutsNormaux = null,
      voisinsTransport = null,
      zone = 'abords',
      plagesADV = [],
      modele,
      reference = null,
      voieListe = null,
      leviersPasse = null,
      gardeAppuis = null,
      rechercheLarge = null,
      rechercheLargePrecedente = null,
      ajustementFin = null,
      ajuster = null,
      etatAncre = undefined,
      obtenirEtatAncre = null,
      transport = null,
      transporter = true,
      diag = false,
      passe = 1,
      surErreurRechercheLarge = null,
    } = args;

    const cut = capture?.identity?.cut ?? null;
    const vs0 = typeof voisins === 'function' ? voisins() : voisins;
    const avant = leviersPasse ? G.leviersActifs() : null;
    if (leviersPasse) G.reglerLeviers({ ...avant, ...leviersPasse });
    let g;
    try {
      g = G.deciderDiffere({
        capture,
        science,
        appuis: Array.isArray(appuis) ? appuis.slice() : [],
        options: { ...G.REGLE.lotOptions },
        voisins: vs0,
        voisinsTransport,
        zone,
        plagesADV,
        modele,
        regle: G.REGLE_E,
        reference,
        voieListe,
      });
    } finally {
      if (leviersPasse) G.reglerLeviers(avant);
    }

    const l1 = G.resumer(g);
    if (g.decision.etat !== 'valider') {
      const motif = g.decision.motif ?? null;
      return {
        decision: 'rien',
        etape: 'gcv2',
        motif,
        g,
        l1,
        passe2Banc: { passe, motif, ...(diag ? { l1 } : {}) },
      };
    }

    const cg = G.commander({
      positions: g.positions,
      runtimeRails,
      before,
      expectedPoses: K.expectedPoses,
      cameras,
      camerasLarges,
      valider: true,
    });
    if (cg.action !== 'lot') {
      return {
        decision: 'rien',
        etape: 'commande',
        motif: 'commande:' + (cg.reason ?? 'refus'),
        commande: cg,
        g,
        l1,
        passe2Banc: null,
      };
    }

    const decalBrut = decalPose(before, g.positions);
    const decal = Object.fromEntries(SIDES.map(s => [s, decalBrut[s].map(v => Math.round(v * 100) / 100)]));
    const vsGarde = typeof voisins === 'function' ? voisins() : vs0;
    const cutsNormaux = obtenirCutsNormaux ? obtenirCutsNormaux() : (vsGarde || []).map(v => v.identity.cut);
    const reglageGarde = gardeAppuis && typeof gardeAppuis.ok === 'boolean' ? gardeAppuis : { ok: true, ...gardeAppuis };
    const garde = GA.juger({ cut, decal, cutsNormaux }, reglageGarde);
    if (garde.bloque) {
      return {
        decision: 'rien',
        etape: 'garde-appuis',
        motif: 'garde-appuis',
        decal,
        decalBrut,
        garde,
        g,
        l1,
        passe2Banc: { passe, motif: 'garde-appuis', garde, ...(diag ? { l1 } : {}) },
      };
    }

    const RL = modRL();
    const reglageRL = typeof rechercheLarge === 'function' ? rechercheLarge() : rechercheLarge;
    let rl = null, rlRetenu = rechercheLargePrecedente;
    if (RL && reglageRL && reglageRL.actif === true && reglageRL.passe === true) {
      try {
        const capRL = { identity: capture.identity ?? null, rails: capture.rails, pointsSceneRelative: capture.pointsSceneRelative, visibleByClipBoxes: capture.visibleByClipBoxes };
        rl = RL.resumer(RL.decider({ capture: capRL, positions: g.positions, R: { ...reglageRL, mode: 'differer' }, ...(science ? { science } : {}) }));
      } catch (e) {
        if (surErreurRechercheLarge) { surErreurRechercheLarge(e); rl = null; }
        else rl = { etat: 'erreur', message: String(e && e.message || e).slice(0, 120) };
      }
      if (rl && rl.etat === 'differer') {
        return {
          decision: 'rien',
          etape: 'recherche-large',
          motif: 'recherche-large',
          decal,
          decalBrut,
          garde,
          rechercheLarge: rl,
          g,
          l1,
          passe2Banc: { passe, motif: 'recherche-large', garde, rechercheLarge: rl, ...(diag ? { l1 } : {}) },
        };
      }
      if (rl && rl.etat !== 'erreur') rlRetenu = rl;
    }

    const finaliserPose = Ea => {
      const idT = { part: capture.identity?.part ?? null, cut, frameId: capture.identity?.frameId ?? null };
      const entreeTransport = transporter ? { identity: idT, positions: g.positions, rails: before } : null;
      const vue = cg.vue === 'deplacer' ? 'deplacee' : null;
      const passe2Pose = { passe, garde, ...(rlRetenu ? { rechercheLarge: rlRetenu } : {}) };

      /* Ajustement fin (CH-121) sur la pose de la passe (le transport garde `g.positions`, la pose de la décision). */
      let af = null;
      if (ajustementFin && !ajustementFin.seulChaine && !vue) {
        try {
          af = ajusterPoseFin({ capture, before, runtimeRails, cameras, positions: g.positions, decal: decalBrut, source: 'gcv2', vue: null, reglage: ajustementFin, ajuster });
        } catch {
          af = null;
        }
      }
      const positionsFinales = af && af.ajuste ? af.positions : g.positions;
      const decalFinalBrut = af && af.ajuste ? af.decal : decalBrut;
      const decalFinal = af && af.ajuste ? Object.fromEntries(SIDES.map(s => [s, af.decal[s].map(v => Math.round(v * 100) / 100)])) : decal;

      let outBanc = {
        source: 'gcv2',
        passe2: passe2Pose,
        etage: 'deferred',
        etat: 'pose',
        vue,
        decal: decalFinalBrut,
        l1,
        ...(af && af.ajuste ? { ajustementFin: { avant: decalBrut, info: af.info } } : af && af.refus ? { ajustementFin: { refus: af.refus, info: af.info } } : {}),
      };

      /* Refus d'ancre (CH-124) : la pose refusée reste comptée et transportée comme le livré (sans ricochet), et n'est ni posée ni reprise. */
      if (Ea) {
        const ja = jugerAncre({ etatAncre: Ea, cut, capture, before, positions: g.positions, decal: outBanc.decal, source: 'gcv2-passe', etage: 'deferred' });
        if (ja && ja.refus) {
          if (entreeTransport && Array.isArray(transport)) transport.push(entreeTransport);
          outBanc = { etat: 'differe', source: 'ancre', etage: 'deferred', origine: 'gcv2-passe', ancre: ja.jugement, decalRefuse: outBanc.decal, passe2: outBanc.passe2 };
          return {
            decision: 'rien',
            etape: 'ancre',
            motif: 'ancre',
            comptePose: true,
            ancreRefus: true,
            ancre: ja.jugement,
            decal,
            decalBrut,
            garde,
            rechercheLarge: rlRetenu,
            g,
            l1,
            entreeTransport,
            outBanc,
          };
        }
        if (ja) outBanc = { ...outBanc, ancre: ja.jugement };
      }

      if (entreeTransport && Array.isArray(transport)) transport.push(entreeTransport);
      return {
        decision: 'poserait',
        etape: 'pose',
        motif: null,
        comptePose: true,
        positions: positionsFinales,
        positionsDecision: g.positions,
        decal: decalFinal,
        decalAvantAjustement: af && af.ajuste ? decal : null,
        decalBrut: decalFinalBrut,
        vue,
        garde,
        rechercheLarge: rlRetenu,
        ajustementFin: af && af.ajuste ? { avant: decal, positions: af.positions, decal: decalFinal } : null,
        ancre: outBanc.ancre || null,
        g,
        l1,
        entreeTransport,
        outBanc,
      };
    };

    const Ea = etatAncre !== undefined ? etatAncre : (obtenirEtatAncre ? obtenirEtatAncre() : null);
    return suivre(Ea, finaliserPose);
  }

  return {
    VERSION,
    deciderCutL1se,
    deciderRestePasse,
    corrigerChaine,
    confronterRechercheLarge,
    jugerGardeApresDiffere,
    ajusterPoseFin,
    jugerAncre,
  };
});
