'use strict';
/* CH-160 (D-383, opérateur, 24/11/2026, piste 1) — Essais :
 *  - Module pur `src/lot-verts-trous.js` (`vertsTrousGrappe`, `qualifierCandidatLive`, `preparerDepuisTable`, `creerBilan`) ;
 *  - Réglage `lot.absorberVertsTrous` dans `src/settings.js` (allumé par défaut, gelé, `actif: false` au bit près) ;
 *  - Accroche dans le cycle du lot Orbite (`background.js`) : insertion entre le cut gauche clos (validé ou différé) et le cut droit,
 *    navigation par `goToCut`, contrôle d'identité et du statut live, validation sur place par `validerMajEspace`,
 *    événements `lot-vert-trou`, compteur de bilan `vertsTrous` séparé de `poses` / `differes` / `traites`,
 *    abstention sur liste absente ou non concordante, échec non bloquant, et absence totale d'effet en Écho.
 *  - Fixtures synthétiques uniquement. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/settings.js');
const LVT = require('../src/lot-verts-trous.js');
const { production, memoire } = require('./helpers/perf-production.cjs');
const { EsvRelecture, SCOPE, K } = require('./helpers/relecture-lot.cjs');
const { base } = require('./fixtures.cjs');
const j = x => JSON.parse(JSON.stringify(x ?? null));
let scienceBase = null;

test('1. Fonction pure vertsTrousGrappe : trous de 1, 2 et 3 cuts absorbés dans une grappe (trouCuts = 5, min = 3)', () => {
  // Grappe 1 : [100, 102, 105] -> trou de 1 (101) et trou de 2 (103, 104)
  // Grappe 2 : [1901, 1903, 1907] -> trou de 1 (1902) et trou de 3 (1904, 1905, 1906)
  // Entrée non triée avec doublon pour vérifier le tri et la déduplication
  const res = LVT.vertsTrousGrappe([1907, 102, 100, 1901, 105, 1903, 102]);
  assert.equal(res.grappes.length, 2);
  assert.deepEqual(res.grappes[0], { debut: 100, fin: 105, cutsLot: [100, 102, 105], nLot: 3 });
  assert.deepEqual(res.grappes[1], { debut: 1901, fin: 1907, cutsLot: [1901, 1903, 1907], nLot: 3 });

  assert.equal(res.trous.length, 4);
  assert.deepEqual(res.trous[0], {
    gauche: 100,
    droite: 102,
    longueur: 1,
    cuts: [101],
    grappe: { debut: 100, fin: 105 },
    nLot: 3,
  });
  assert.deepEqual(res.trous[1], {
    gauche: 102,
    droite: 105,
    longueur: 2,
    cuts: [103, 104],
    grappe: { debut: 100, fin: 105 },
    nLot: 3,
  });
  assert.deepEqual(res.trous[2], {
    gauche: 1901,
    droite: 1903,
    longueur: 1,
    cuts: [1902],
    grappe: { debut: 1901, fin: 1907 },
    nLot: 3,
  });
  assert.deepEqual(res.trous[3], {
    gauche: 1903,
    droite: 1907,
    longueur: 3,
    cuts: [1904, 1905, 1906],
    grappe: { debut: 1901, fin: 1907 },
    nLot: 3,
  });
  assert.deepEqual(res.cuts, [101, 103, 104, 1902, 1904, 1905, 1906]);
});

test('2. Trous de 4 et de 5 cuts non absorbés, même à l’intérieur d’une grappe fusionnée', () => {
  // Grappe [300, 302, 307, 308] :
  // - 302 - 300 = 2 -> trou de 1 cut [301] (absorbé)
  // - 307 - 302 = 5 <= trouCuts (5) -> même grappe [300..308], mais trou ]302, 307[ de longueur 4 (303..306) > trouMaxCuts (3) -> NON absorbé
  // - 308 - 307 = 1 -> consécutifs (0 trou)
  // Puis écart de 6 (trou de 5 cuts 309..313) avant [314, 315, 316] -> hors grappe avec trouCuts=5, et non absorbé même si trouCuts=6.
  const r5 = LVT.vertsTrousGrappe([300, 302, 307, 308, 314, 315, 316]);
  assert.equal(r5.grappes.length, 2);
  assert.deepEqual(r5.grappes[0], { debut: 300, fin: 308, cutsLot: [300, 302, 307, 308], nLot: 4 });
  assert.deepEqual(r5.grappes[1], { debut: 314, fin: 316, cutsLot: [314, 315, 316], nLot: 3 });
  assert.deepEqual(r5.cuts, [301], 'seul le trou de 1 cut (301) est absorbé ; le trou de 4 (303..306) et le trou de 5 (309..313) sont exclus');

  // Même si trouCuts est élargi à 6 pour fusionner le trou de 5 cuts dans la même grappe, trouMaxCuts = 3 l'ignore toujours :
  const r6 = LVT.vertsTrousGrappe([300, 302, 307, 308, 314, 315, 316], { trouCuts: 6, min: 3, trouMaxCuts: 3 });
  assert.equal(r6.grappes.length, 1);
  assert.deepEqual(r6.grappes[0].debut, 300);
  assert.deepEqual(r6.grappes[0].fin, 316);
  assert.deepEqual(r6.cuts, [301], 'trous de 4 et de 5 toujours ignorés à l’intérieur d’une même grappe');
});

test('3. Paire (2 cuts du lot) et isolé (1 cut du lot) : aucun vert absorbé', () => {
  // Isolé : 50
  // Paire avec trou de 1 : [100, 102]
  // Paire avec trou de 2 : [200, 203]
  // Paire avec trou de 3 : [300, 304]
  // Paire consécutive : [400, 401]
  const res = LVT.vertsTrousGrappe([50, 100, 102, 200, 203, 300, 304, 400, 401]);
  assert.deepEqual(res, { grappes: [], trous: [], cuts: [] });

  // Statut ESV 3 (« autre ») dans une table ou une liste de lignes : ne doit JAMAIS être traité comme un rouge du lot
  const tableAvecStatut3 = {
    n: 20,
    st: [0, 0, 1, 0, 1, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // seuls 2 et 4 sont invalid (1) -> paire ; 6 est statut 3 (autre)
    fl: new Array(20).fill(0),
    debut: true,
    rompue: false,
    tronquee: false,
  };
  assert.deepEqual(LVT.extraireCutsLot(tableAvecStatut3), [2, 4], 'le statut 3 (autre) n’est pas un cut invalid du lot');
  assert.deepEqual(LVT.vertsTrousGrappe(tableAvecStatut3), { grappes: [], trous: [], cuts: [] }, 'paire [2, 4] + statut 3 en 6 ne forme pas une grappe');
  const lignesAvecAutre = [
    { i: 10, statut: 'invalid' },
    { i: 12, statut: 'invalid' },
    { i: 14, statut: 'autre' },
  ];
  assert.deepEqual(LVT.extraireCutsLot(lignesAvecAutre), [10, 12]);
  assert.deepEqual(LVT.vertsTrousGrappe(lignesAvecAutre), { grappes: [], trous: [], cuts: [] });
});

test('4. Réglage src/settings.js (lot.absorberVertsTrous) et option actif: false', () => {
  assert.ok(S.lot.absorberVertsTrous, 'lot.absorberVertsTrous exposé dans src/settings.js');
  assert.equal(Object.isFrozen(S.lot.absorberVertsTrous), true, 'lot.absorberVertsTrous est gelé');
  assert.deepEqual({ ...S.lot.absorberVertsTrous }, { actif: true, trouCuts: 5, min: 3, trouMaxCuts: 3 });

  const off = LVT.vertsTrousGrappe([100, 102, 104], { actif: false });
  assert.deepEqual(off, { grappes: [], trous: [], cuts: [] });
  const offBool = LVT.vertsTrousGrappe([100, 102, 104], false);
  assert.deepEqual(offBool, { grappes: [], trous: [], cuts: [] });
});

test('5. Filtre de statut live (qualifierCandidatLive) : valid non traité hors lot requis ; déjà traité, plus valid, cut du lot et dernier cut écartés', () => {
  const setLot = new Set([100, 102, 105]);
  // Candidat valide, jamais traité, hors du lot, pas dernier cut
  assert.deepEqual(
    LVT.qualifierCandidatLive({ cut: 101, ligne: { statut: 'valid', operateur: false }, setLot, total: 200 }),
    { visiter: true, resultat: null, motif: null }
  );
  // Déjà traité par un opérateur (TreatedByOperator = true)
  assert.deepEqual(
    LVT.qualifierCandidatLive({ cut: 101, ligne: { statut: 'valid', operateur: true }, setLot, total: 200 }),
    { visiter: false, resultat: 'ignore', motif: 'deja-traite' }
  );
  // Plus valid (invalid, skipped ou autre)
  assert.deepEqual(
    LVT.qualifierCandidatLive({ cut: 101, ligne: { statut: 'invalid', operateur: false }, setLot, total: 200 }),
    { visiter: false, resultat: 'ignore', motif: 'plus-valid' }
  );
  assert.deepEqual(
    LVT.qualifierCandidatLive({ cut: 101, ligne: { statut: 'skipped', operateur: false }, setLot, total: 200 }),
    { visiter: false, resultat: 'ignore', motif: 'plus-valid' }
  );
  assert.deepEqual(
    LVT.qualifierCandidatLive({ cut: 101, ligne: { statut: 'autre', operateur: false }, setLot, total: 200 }),
    { visiter: false, resultat: 'ignore', motif: 'plus-valid' }
  );
  // Cut appartenant au lot
  assert.deepEqual(
    LVT.qualifierCandidatLive({ cut: 102, ligne: { statut: 'valid', operateur: false }, setLot, total: 200 }),
    { visiter: false, resultat: 'ignore', motif: 'cut-du-lot' }
  );
  // Garde du dernier cut de la partie
  assert.deepEqual(
    LVT.qualifierCandidatLive({ cut: 199, ligne: { statut: 'valid', operateur: false }, setLot, total: 200 }),
    { visiter: false, resultat: 'ignore', motif: 'dernier-cut-partie' }
  );
});

/* Montage d'un lot Orbite dans le service worker réel avec table de liste active pendant le lot. */
async function monterLotAvecTable({
  total = 50,
  rouges = [10, 12, 16],
  loin = [],
  lignesForcees = {},
  absorberVertsTrous = S.lot.absorberVertsTrous,
  listeIllisible = false,
  tableCustom = null,
  refusAller = null,
  echecMajEspace = null,
  desaccorderIdentite = null,
  calculReel = false,
  start = 10,
  end = 16,
} = {}) {
  const adapter = new EsvRelecture({ loin });
  adapter.total = total;
  adapter.rouges = new Set(rouges);
  adapter.lignes = { ...lignesForcees };
  adapter.listeIllisible = listeIllisible;
  adapter.refusAller = refusAller;

  // Dans ESV réel, « valider et suivant » et « cut non validé suivant » sautent au prochain cut invalide (rouge).
  const prochainRouge = depuis => {
    for (let i = depuis + 1; i < adapter.total; i++) {
      const l = adapter.ligne(i);
      if (l.s === 'invalid') return i;
    }
    return depuis + 1;
  };
  adapter.validateAndNext = async function (identity) {
    this.calls.push('validate');
    this.poses.set(this.identity.cut, K.clone(this.rails));
    const after = await this.state();
    const cible = prochainRouge(this.identity.cut);
    this.identity.cut = cible;
    this.ajuster();
    return {
      commandSent: true,
      afterObserved: true,
      afterStateStatus: 'OBSERVED_SAME_TARGET',
      afterState: after,
      operatorDecision: 'VALIDATE',
      navigationSemantics: 'VALIDATE_NEXT_NON_VALIDATED_CUT',
      decisionCommand: { id: 'O2N3DCutValidate3DRail', exists: true, disabled: false },
      navigationObserved: true,
      serverConfirmed: this.server,
      nextIdentity: K.clone(this.identity),
      navigationAfter: { identity: K.clone(this.identity), label: { pageId: this.identity.pageId, part: this.identity.part, cut: this.identity.cut } },
    };
  };
  const origNextWithout = adapter.nextWithoutDecision.bind(adapter);
  adapter.nextWithoutDecision = async function (identity, scope, operationId) {
    const cible = prochainRouge(this.identity.cut);
    this.deferJump = cible - this.identity.cut;
    return origNextWithout(identity, scope, operationId);
  };
  if (desaccorderIdentite) {
    const origGoTo = adapter.goToCut.bind(adapter);
    adapter.goToCut = async function (target, options, opId) {
      const r = await origGoTo(target, options, opId);
      if (desaccorderIdentite(target.cut)) this.identity.cut = target.cut + 99;
      return r;
    };
  }
  if (echecMajEspace) {
    const origMaj = adapter.validerMajEspace.bind(adapter);
    adapter.validerMajEspace = async function (identity, scope, options) {
      if (echecMajEspace(identity.cut)) throw Error('Maj+Espace refusé (simulé)');
      return origMaj(identity, scope, options);
    };
  }

  const local = memoire();
  local.m.banane50Relecture = 'coupee';
  const b = production({ adapter, local });
  b.ctx.BananeSettings = {
    ...b.ctx.BananeSettings,
    relectureDefaut: { mode: 'coupee', modifiable: true },
    voiePrediteOmbre: { ...S.voiePrediteOmbre, actif: false },
    deplacerVue: { ...S.deplacerVue, actif: false },
    reglesMetier: { ...S.reglesMetier, ombre: false },
    lot: {
      ...S.lot,
      profil: 'actuel',
      gardeApresDiffere: { ...S.lot.gardeApresDiffere, actif: false },
      passeDifferes: { ...S.lot.passeDifferes, ombre: false, ecriture: false },
      absorberVertsTrous,
    },
  };
  const envoyer = b.ctx.chrome.tabs.sendMessage;
  b.ctx.chrome.tabs.sendMessage = async (id, m) => {
    if (m?.kind === 'b1-voisins') return JSON.parse(JSON.stringify(adapter.voisins(m)));
    if (m?.kind === 'liste-instantane') return JSON.parse(JSON.stringify(tableCustom ? tableCustom() : adapter.tableListe()));
    return envoyer(id, m);
  };
  const Sh = b.ctx.BananeGCV1Shadow, L = b.ctx.BananeLotDecision;
  if (!calculReel) {
    const sci = scienceBase || (scienceBase = Sh.scientificProposeBoth(base));
    const runtimeOk = Sh.toRuntimeRails(sci);
    let lastShadow = null;
    b.ctx.BananeGCV1Shadow.armOnce = selector => {
      lastShadow = {
        format: 'banane-gcv1-shadow-v1',
        contract: { ...Sh.CONTRACT },
        ...K.clone(sci),
        selection: { selector, requestedEngine: 'geometry-candidate-v1', selectedEngine: 'geometry-candidate-v1', fallback: false, fallbackReason: null },
        comparison: { v46: {}, gcv1: {}, selectedEngine: 'geometry-candidate-v1', fallback: false },
      };
    };
    b.ctx.BananeGCV1Shadow.consumeLast = () => { const out = lastShadow; lastShadow = null; return out; };
    b.ctx.BananeGeometry3.proposeBoth = () => K.clone(runtimeOk);
    b.ctx.BananeLotDecision = {
      ...L,
      decideCut(args) {
        const cut = args?.capture?.identity?.cut;
        if (adapter.loin.has(cut)) return { version: L.DEFAULTS.version, stage: 'deferred', reason: 'hors-vue-simule', anchorsUsed: [], anchor: false };
        return {
          version: L.DEFAULTS.version,
          stage: 'first-pass',
          reason: 'first-pass',
          anchorsUsed: [],
          positions: {
            left: args.capture.rails.left.positionSceneRelative.slice(0, 3),
            right: args.capture.rails.right.positionSceneRelative.slice(0, 3),
          },
          anchor: true,
        };
      },
      commandRails(args) {
        if (args?.decision?.stage === 'deferred') {
          return L.deferRails(runtimeOk, args.decision, 'hors-vue', 'hors de la vue (simulé)');
        }
        return { action: 'engine', reason: 'first-pass', rails: K.clone(runtimeOk) };
      },
    };
  }

  await b.api('connect', { tabId: 1 });
  await b.api('settings', { mode: 'automatic-test' });
  adapter.identity.cut = start;
  adapter.rails = K.clone(base.rails);
  adapter.ajuster();
  const n0 = b.commands.length;
  await b.api('start', { part: 23, start, end, ...SCOPE });
  const vue = await b.settle();
  await new Promise(r => setTimeout(r, 30));
  return { b, adapter, local, vue, commandes: b.commands.slice(n0) };
}

test('6. Cycle du lot dans le service worker : ordre d’insertion entre cut gauche (validé ou différé) et cut droit, événements lot-vert-trou et bilan vertsTrous', async () => {
  // Grappe de 3 cuts du lot : 10 (validé), 12 (différé car hors vue), 16 (validé, fin du lot).
  // Trous attendus :
  // - ]10, 12[ : cut 11 (longueur 1) après la validation de 10 et avant le traitement de 12
  // - ]12, 16[ : cuts 13, 14, 15 (longueur 3) après le différé de 12 et avant le traitement de 16
  const { b, adapter } = await monterLotAvecTable({
    total: 30,
    rouges: [10, 12, 16],
    loin: [12], // 12 sera différé par le lot
    calculReel: true,
    start: 10,
    end: 16,
  });

  // Vérification des validations sur place Maj+Espace : uniquement sur les 4 verts des trous, dans l'ordre
  assert.deepEqual(adapter.majEspace.map(x => x.cut), [11, 13, 14, 15]);
  // Aucune pose (apply) ni SKIP sur les verts des trous
  const cutsApply = adapter.applyArgs.map(x => x.cut);
  assert.deepEqual(cutsApply, [10, 16], 'seuls les cuts posables du lot reçoivent apply');

  // Vérification de l'ordre chronologique dans le journal d'événements :
  // validation-accepted(10) -> lot-vert-trou(11) -> defer-finalized(12) -> lot-vert-trou(13, 14, 15) -> before-captured(16)
  const jalons = b.store.events
    .filter(e => ['validation-accepted', 'defer-finalized', 'lot-vert-trou', 'before-captured'].includes(e.type))
    .map(e => `${e.type}:${e.cut ?? e.identity?.cut}`);
  assert.deepEqual(jalons, [
    'before-captured:10',
    'validation-accepted:10',
    'lot-vert-trou:11',
    'before-captured:12',
    'defer-finalized:12',
    'lot-vert-trou:13',
    'lot-vert-trou:14',
    'lot-vert-trou:15',
    'before-captured:16',
  ]);

  // Forme des événements lot-vert-trou
  const evs = b.store.events.filter(e => e.type === 'lot-vert-trou');
  assert.equal(evs.length, 4);
  const lotId = b.get('engine').s.batch.id;
  assert.deepEqual(
    evs.map(e => ({
      cut: e.cut,
      part: e.part,
      lotId: e.lotId,
      resultat: e.resultat,
      motif: e.motif,
      trou: e.trou,
      grappe: e.grappe,
    })),
    [
      { cut: 11, part: 23, lotId, resultat: 'valide', motif: 'valide-sur-place', trou: { gauche: 10, droite: 12, longueur: 1 }, grappe: { debut: 10, fin: 16 } },
      { cut: 13, part: 23, lotId, resultat: 'valide', motif: 'valide-sur-place', trou: { gauche: 12, droite: 16, longueur: 3 }, grappe: { debut: 10, fin: 16 } },
      { cut: 14, part: 23, lotId, resultat: 'valide', motif: 'valide-sur-place', trou: { gauche: 12, droite: 16, longueur: 3 }, grappe: { debut: 10, fin: 16 } },
      { cut: 15, part: 23, lotId, resultat: 'valide', motif: 'valide-sur-place', trou: { gauche: 12, droite: 16, longueur: 3 }, grappe: { debut: 10, fin: 16 } },
    ]
  );

  // Compteur de bilan du lot : séparé de poses, differes et traites
  const batch = b.get('engine').s.batch;
  assert.deepEqual(j(batch.vertsTrous), { candidats: 4, valides: 4, ignores: 0, echecs: 0 });
  const resume = j(b.get('fileResume')(batch));
  assert.equal(resume.poses, 1, 'cut 10 validé (cut 16 arrêté en fin de lot avec pose appliquée)');
  assert.equal(resume.differes, 1, 'cut 12 différé');
  assert.equal(resume.traites, 2, 'traites ne compte que les cuts du lot');
  assert.deepEqual(resume.vertsTrous, { candidats: 4, valides: 4, ignores: 0, echecs: 0 });
});

test('7. Service worker : cut déjà traité ou plus valid ignoré, échec de navigation, d’identité ou de Maj+Espace consigné sans bloquer le lot ni différer', async () => {
  // Grappe : [10, 14, 18, 20] (4 cuts du lot)
  // Trou 1 ]10, 14[ : cuts 11, 12, 13
  //   - 11 : déjà traité par un opérateur (t: true) -> ignore (deja-traite)
  //   - 12 : statut skipped -> ignore (plus-valid)
  //   - 13 : valid non traité -> valide
  // Trou 2 ]14, 18[ : cuts 15, 16, 17
  //   - 15 : refus de navigation goToCut -> echec (navigation)
  //   - 16 : échec de validerMajEspace -> echec (maj-espace)
  //   - 17 : valid non traité -> valide
  // Trou 3 ]18, 20[ : cut 19
  //   - 19 : identité affichée différente avant Maj+Espace -> echec (identite-avant-maj-espace)
  const { b, adapter } = await monterLotAvecTable({
    total: 30,
    rouges: [10, 14, 18, 20],
    lignesForcees: {
      11: { s: 'valid', t: true, v: true },
      12: { s: 'skipped', t: false, v: true },
    },
    refusAller: cut => (cut === 15 ? 'NAVIGATION_PATH_UNAVAILABLE' : null),
    echecMajEspace: cut => cut === 16,
    desaccorderIdentite: cut => cut === 19,
    start: 10,
    end: 20,
  });

  // Seuls 13 et 17 ont été validés par Maj+Espace (16 a échoué, 19 a été arrêté par le contrôle d'identité avant l'envoi)
  assert.deepEqual(adapter.majEspace.map(x => x.cut), [13, 17]);
  const evs = b.store.events.filter(e => e.type === 'lot-vert-trou');
  assert.deepEqual(
    evs.map(e => [e.cut, e.resultat, e.motif]),
    [
      [11, 'ignore', 'deja-traite'],
      [12, 'ignore', 'plus-valid'],
      [13, 'valide', 'valide-sur-place'],
      [15, 'echec', 'navigation'],
      [16, 'echec', 'maj-espace'],
      [17, 'valide', 'valide-sur-place'],
      [19, 'echec', 'identite-avant-maj-espace'],
    ]
  );
  const batch = b.get('engine').s.batch;
  assert.deepEqual(j(batch.vertsTrous), { candidats: 7, valides: 2, ignores: 2, echecs: 3 });
  assert.equal(batch.deferred.length, 0, 'aucun vert en échec n’est différé');
  assert.equal(batch.stoppedAtEnd?.cut, 20, 'le lot a continué jusqu’au cut 20 sans blocage');
});

test('8. Service worker : réglage éteint (actif: false) -> aucun candidat, aucun événement, aucun compteur, chemin identique', async () => {
  const { b, adapter } = await monterLotAvecTable({
    total: 30,
    rouges: [10, 12, 15],
    absorberVertsTrous: { ...S.lot.absorberVertsTrous, actif: false },
    start: 10,
    end: 15,
  });
  assert.deepEqual(adapter.majEspace, []);
  assert.deepEqual(adapter.allees, []);
  assert.deepEqual(b.store.events.filter(e => e.type === 'lot-vert-trou'), []);
  const batch = b.get('engine').s.batch;
  assert.equal('vertsTrous' in batch, false);
  assert.equal('vertsTrous' in b.get('fileResume')(batch), false);
});

test('9. Service worker : liste absente ou non concordante -> abstention consignée une fois, lot inchangé', async () => {
  // Cas A : liste absente / illisible
  const abs = await monterLotAvecTable({
    total: 30,
    rouges: [10, 12, 15],
    listeIllisible: true,
    start: 10,
    end: 15,
  });
  assert.deepEqual(abs.adapter.majEspace, []);
  const evAbs = abs.b.store.events.filter(e => e.type === 'lot-vert-trou');
  assert.equal(evAbs.length, 1, 'une seule abstention par lot');
  assert.equal(evAbs[0].resultat, 'abstention');
  assert.equal(evAbs[0].motif, 'liste-absente');
  assert.deepEqual(j(abs.b.get('engine').s.batch.vertsTrous), { candidats: 0, valides: 0, ignores: 0, echecs: 0 });

  // Cas B : liste non concordante (toutes les lignes de la table sont marquées valid, aucune rouge)
  const nonConc = await monterLotAvecTable({
    total: 30,
    rouges: [10, 12, 15],
    tableCustom: () => ({
      ok: true,
      tables: [{ key: 't', debut: true, rompue: false, tronquee: false, st: new Array(30).fill(0), fl: new Array(30).fill(0), ed: new Array(180).fill(0) }],
    }),
    start: 10,
    end: 15,
  });
  assert.deepEqual(nonConc.adapter.majEspace, []);
  const evNonConc = nonConc.b.store.events.filter(e => e.type === 'lot-vert-trou');
  assert.equal(evNonConc.length, 1);
  assert.equal(evNonConc[0].resultat, 'abstention');
  assert.equal(evNonConc[0].motif, 'liste-non-concordante');
  assert.deepEqual(j(nonConc.b.get('engine').s.batch.vertsTrous), { candidats: 0, valides: 0, ignores: 0, echecs: 0 });
});

test('10. Écho : la fonction ne s’arme pas et n’émet aucune commande', async () => {
  const adapter = new EsvRelecture({ loin: [] });
  adapter.total = 30;
  adapter.rouges = new Set([10, 12, 15]);
  const local = memoire();
  const b = production({ adapter, local });
  const envoyer = b.ctx.chrome.tabs.sendMessage;
  b.ctx.chrome.tabs.sendMessage = async (id, m) => {
    if (m?.kind === 'liste-instantane') return JSON.parse(JSON.stringify(adapter.tableListe()));
    return envoyer(id, m);
  };
  await b.api('connect', { tabId: 1 });
  adapter.identity.cut = 10;
  await b.api('native-start');
  await b.api('native-end');
  assert.deepEqual(adapter.majEspace, []);
  assert.deepEqual(adapter.allees, []);
  assert.deepEqual(b.store.events.filter(e => e.type === 'lot-vert-trou'), []);
});

test('11. Statut ESV 3 (« autre ») est traité comme un rouge du lot, pas comme un vert absorbable', () => {
  const table = { n: 20, st: new Array(20).fill(0), fl: new Array(20).fill(0), debut: true, rompue: false, tronquee: false };
  // 10 invalid, 11 autre, 12 invalid, 13 valid, 14 invalid : 11 entre dans le lot, 13 reste le seul trou absorbé.
  table.st[10] = 1; table.st[11] = 3; table.st[12] = 1; table.st[13] = 0; table.st[14] = 1;
  const prep = LVT.preparerDepuisTable({ table, scope: { start: 10, end: 14, total: 20 } });
  assert.equal(prep.ok, true);
  assert.deepEqual(prep.cutsLot, [10, 11, 12, 14]);
  assert.deepEqual(prep.cuts, [13]);
  assert.equal(LVT.ligneDeTable(table, 11).statut, 'autre');
  assert.equal(LVT.extraireCutsLot(table).includes(11), true);
  assert.equal(LVT.extraireCutsLot(table).includes(13), false);
  assert.deepEqual(LVT.qualifierCandidatLive({ cut: 11, ligne: LVT.ligneDeTable(table, 11), setLot: prep.setLot, total: 20 }), {
    visiter: false, resultat: 'ignore', motif: 'cut-du-lot'
  });
});
