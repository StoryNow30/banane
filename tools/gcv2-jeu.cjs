#!/usr/bin/env node
'use strict';
/*
 * gcv2-jeu.cjs — G1-a de la GCV2 : le JEU D'HYPOTHÈSES de l'étage 1 (fiches/G0_GCV2_CONCEPTION.md § 2, fiches/G1A_HYPOTHESES.md) et le
 * RAPPEL ATTEIGNABLE (première porte de la GCV2 : au moins 60 % des corrections de plus de 10 mm ont une hypothèse à 10 mm de la pose finale
 * de l'opérateur expert). Étude HORS LIGNE : rien n'est changé à l'extension, aucune action dans ESV, aucun modèle appris ici.
 *
 *   node tools/gcv2-jeu.cjs construire --partie P:N --echo DOSSIER [--echo DOSSIER…] (--journal J.json [--journal …] | --sans-lot)
 *                                      --sortie JEU.jsonl [--juger-partie-reservee]
 *   node tools/gcv2-jeu.cjs rappel     --jeu JEU.jsonl [--jeu …] [--json R.json]
 *   node tools/gcv2-jeu.cjs essai
 *
 * CONSTRUIRE. Pour chaque cut que l'opérateur expert a visité dans un Écho (mêmes entrées SANS FUITE que `relecture-autonome.cjs extraire`, dont
 * il réutilise la lecture de l'Écho, l'entrée sans fuite, le moteur livré, la décision du lot, la chaîne d'appuis et la hauteur apprise), et pour
 * chaque rail, une liste bornée (12 poses au plus) d'hypothèses de pose, chacune étiquetée par son origine :
 *   H0 la pose de départ (ne rien faire) ;
 *   H1 la proposition A* du moteur (cellule `astar-published` du réservoir), calage de convention compris ;
 *   H2 les cellules du réservoir (`pool` du moteur) COMPÉTITIVES (perte à moins de 1,5 fois la meilleure), et les cellules STRONG ÉCARTÉES par ce
 *      ratio ; chaque cellule est posée comme le moteur la poserait (calage de convention) ;
 *   H3 la pose relancée depuis la voie prédite par la chaîne (la décision du lot avec pour appuis les poses qu'Ariane vient de donner), et la voie
 *      prédite elle-même quand la chaîne a des appuis ;
 *   H4 l'interpolation des voisins SÛRS : poses de l'opérateur déjà validées AVANT la première visite du cut (ordre du temps), et poses de départ
 *      des cuts que le lot a posés et validés (visités à l'Écho). Jamais une pose non vérifiée d'Ariane.
 *   H5 (ajout demandé par RM-4) le rail manquant complété par l'écartement médian de la partie, à partir du rail sûr (l'autre rail, publié par le moteur) ;
 *   H6 (D-207, « voie décalée ») la pose d'ESV d'origine translatée du décalage [latéral, vertical] d'un voisin SÛR récent (même règle de temps que
 *      H4), à 10 cuts au plus : le voisin le plus proche, et la médiane des 5 plus proches ; rail par rail et « paire » (même décalage aux deux rails).
 *      Deux familles marquées par leur source : « h6-lot-… » (voisins validés par le lot seuls : usage lot) et « h6-humain-… » (avec au moins un voisin
 *      humain : usage relecture seulement). Priorité avant H2. La ligne de cut porte aussi la VOIE DE RÉFÉRENCE de la série (`contexte.voieH6`), qui
 *      sert au garde-fou de voie des différés (gcv2-apprendre `--garde-voie`) ;
 * Chaque pose existe avec et sans hauteur apprise (`src/hauteur-apprise.js`) quand celle-ci donne une correction non nulle. Deux hypothèses à
 * moins de 0,75 mm l'une de l'autre sont une seule (la liste `origines` garde toutes les origines qui y mènent).
 *
 * FRONTIÈRE ANTI-FUITE. `hypothesesDuCut` ne reçoit NI la référence de l'opérateur NI aucune pose de lui pour le cut lui-même : la capture et la
 * science du cut, les décisions du lot (seul et en chaîne), les appuis de la chaîne, les voisins sûrs (déjà vérifiés AVANT la première visite de ce
 * cut ; pour H6, leur décalage depuis la pose d'ESV d'origine, lue dans le journal du lot quand le lot a posé le voisin), la pose d'ESV d'origine du cut
 * (journal du lot) et la médiane d'écartement de la partie. L'ÉTIQUETTE (`etiqueter`) est posée après, dans une autre fonction, sur le résultat : jamais
 * dans les traits. tests/gcv2-jeu.test.cjs le prouve (changer la référence ne change aucun trait ; une pose voisine validée APRÈS la première
 * visite ne change rien).
 *
 * Le moteur ne rend pas son réservoir de cellules (`reducePool` est interne à `src/gcv1-shadow.js`, qui ne doit pas changer). L'outil charge donc
 * une COPIE EN MÉMOIRE du module, avec une seule ancre remplacée (`return {ok:true,side,` reçoit en plus le champ `_reservoir`) : le fichier de
 * `src/` n'est pas touché, le calcul est celui du moteur livré, et l'essai compare le résultat de la copie à celui du module livré.
 *
 * Sortie (JSON lignes, HORS DÉPÔT) : une ligne `entete`, puis par cut une ligne `cut` (zone, rôle, étiquette du cut, moteur), par rail une ligne
 * `rail` (traits du moteur pour ce rail) et par hypothèse une ligne `hyp` (origine, décalage [longitudinal, latéral, vertical] en mm dans le
 * repère profil de la pose de départ, traits sans fuite, étiquette : écart 3D à la pose finale). Des millimètres, des numéros de cut, des comptes :
 * aucune coordonnée absolue, aucun identifiant de projet.
 *
 * RAPPEL. Lit un ou plusieurs jeux et donne le rappel atteignable (corrections de plus de 10 mm et de plus de 5 mm, parts à 10 mm et à 5 mm),
 * par zone et par origine, ce que chaque origine ajoute, les abstentions du moteur rattrapées.
 */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const C = require('../vendor/capture-core.js');
const L = require('../src/lot-decision.js');
const O = require('../src/continuity-observer.js');
const H = require('../src/hauteur-apprise.js');
const Conv = require('../src/placement-convention.js');
const V = require('../src/voie-recentree.js');
const ShadowLivre = require('../src/gcv1-shadow.js');
const RA = require('./relecture-autonome.cjs');
const J = require('./jointure-echo-orbite.cjs');
const Manifeste = require('./manifeste-parties.cjs');

const FORMAT = 'ariane-gcv2-jeu-v1', FORMAT_RAPPEL = 'ariane-gcv2-rappel-v1';
const SIDES = ['left', 'right'];
const MAX_HYP = 12;             // poses de base par rail (chacune peut avoir une variante « avec hauteur »)
const DOUBLON_MM = 0.75;        // deux hypothèses plus proches que cela n'en font qu'une
const SEUILS_MM = Object.freeze({ juste: 5, faux: 10, mauvaiseVoie: 50 });
const ORIGINES = Object.freeze(['H0', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const ORIGINES_G1A = Object.freeze(['H0', 'H1', 'H2', 'H3', 'H4', 'H5']);
const VERSION_H6 = 'h6-1';
const fini = v => typeof v === 'number' && Number.isFinite(v);
const arrondi = (v, d = 1) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const sig4 = v => fini(v) ? Number(v.toPrecision(4)) : null;
const norme = v => Math.hypot(...v);
const moins = (a, b) => a.map((x, i) => x - b[i]);
const med = a => { const s = a.filter(fini).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/* ------------------------------------------------------------------ moteur avec réservoir */
/* Copie en mémoire de src/gcv1-shadow.js où `scientificRail` rend aussi son réservoir (`_reservoir` : cellules du pool, perte minimale, signe du
 * profil). Une seule ancre est remplacée ; si elle n'est plus unique, le fichier a changé et l'outil refuse de continuer. */
const ANCRE_RESERVOIR = 'return {ok:true,side,';
const AJOUT_RESERVOIR = 'return {ok:true,side,_reservoir:{pool:reduced.pool,lmin,sign:frame.sign},';
let _moteur = null;
function moteurAvecReservoir() {
  if (_moteur) return _moteur;
  const chemin = path.join(__dirname, '..', 'src', 'gcv1-shadow.js'), src = fs.readFileSync(chemin, 'utf8');
  if (src.split(ANCRE_RESERVOIR).length !== 2) throw Error('src/gcv1-shadow.js a changé : l\'ancre du réservoir n\'est plus unique, l\'outil ne la remplace pas.');
  const m = new Module(chemin, module);
  m.filename = chemin; m.paths = Module._nodeModulePaths(path.dirname(chemin));
  m._compile(src.replace(ANCRE_RESERVOIR, AJOUT_RESERVOIR), chemin);
  _moteur = m.exports;
  return _moteur;
}

/* ------------------------------------------------------------------ voisins sûrs */
/* Poses vérifiées d'une partie, avec l'instant où elles le sont devenues : { cut, source: 'humain' | 'lot', t (ms, -Infinity pour le lot),
 * positions: { left, right } (scène, en mémoire seulement) }. Une pose HUMAINE est la dernière validation de l'opérateur sur le cut, ou sa
 * pose de départ quand il l'a visité sans rien toucher (règle des 0,8 s) ; elle compte à la FIN de la visite qui l'a validée. Une pose du LOT est
 * la pose de départ d'un cut que le lot a posé et validé : elle précède tout l'Écho. */
function posesVerifiees(parCut, { ctx, referenceHumaine, lotValide = new Set(), deplacementsLot = new Map() }) {
  const out = [];
  for (const c of parCut) {
    const v0 = c.visites[0], avant = v0 && v0.beforeEstablished && v0.beforeEstablished.rails;
    const depart = avant && SIDES.every(s => avant[s] && Array.isArray(avant[s].positionSceneRelative) && avant[s].positionSceneRelative.length === 3)
      ? { left: avant.left.positionSceneRelative.slice(), right: avant.right.positionSceneRelative.slice() } : null;
    const ref = referenceHumaine(c.visites);
    const rails = ref && ref.etat && ref.etat.rails;
    const finale = rails && SIDES.every(s => rails[s] && Array.isArray(rails[s].positionSceneRelative) && rails[s].positionSceneRelative.length === 3)
      ? { left: rails.left.positionSceneRelative.slice(), right: rails.right.positionSceneRelative.slice() } : null;
    const fin = x => Date.parse(x && (x.endedAt || x.startedAt));
    /* H6 : décalage de la pose sûre depuis la pose d'ESV d'origine (avant le lot), dans le repère profil du rail de départ de CE voisin. */
    const decal = positions => decalageDepuisEsv(avant, positions, lotValide.has(c.cut) ? esvDepuisDeplacement(avant, deplacementsLot.get(c.cut)) : 'depart');
    if (finale && fini(fin(ref.visite))) out.push({ cut: c.cut, source: 'humain', t: fin(ref.visite), positions: finale, decalage: decal(finale) });
    else if (!ref && depart) {
      const sa = J.visiteSansAction(c, J.DUREE_VISITE_DEFAUT_S, ctx);
      const t = fin(c.visites[c.visites.length - 1]);
      if (sa.appliquee && fini(t)) out.push({ cut: c.cut, source: 'humain', t, positions: depart, decalage: decal(depart) });
    }
    if (depart && lotValide.has(c.cut)) out.push({ cut: c.cut, source: 'lot', t: -Infinity, positions: depart, decalage: decal(depart) });
  }
  return out;
}
/* Pose d'ESV d'origine d'un cut posé par le lot, dans le repère de l'Écho : la pose de départ (celle du lot) moins le DÉPLACEMENT du lot (pose
 * corrigée − pose initiale, lu dans le journal du lot). Le journal et l'Écho n'ont pas la même origine de scène : seule la différence se transporte. */
function esvDepuisDeplacement(rails, dl) {
  if (!rails || !dl || !SIDES.every(s => rails[s] && Array.isArray(rails[s].positionSceneRelative) && Array.isArray(dl[s]) && dl[s].length === 3 && dl[s].every(fini))) return null;
  return Object.fromEntries(SIDES.map(s => [s, rails[s].positionSceneRelative.map((v, i) => v - dl[s][i])]));
}
/* H6 — décalage [latéral, vertical] (mm) d'une pose sûre `positions` par rapport à la pose d'ESV d'ORIGINE du même cut, dans le repère profil
 * du rail de départ (`rails`, pose montrée par l'Écho). `esv` : 'depart' quand la pose de départ EST celle d'ESV (cut que le lot n'a pas posé),
 * la pose d'ESV d'origine dans le repère de l'Écho quand le lot a posé le cut (`esvDepuisDeplacement`), null si on ne la
 * connaît pas (aucun décalage). Rien de la référence du cut JUGÉ n'entre ici : `positions` est la pose sûre d'un AUTRE cut. */
function decalageDepuisEsv(rails, positions, esv) {
  if (!rails || !positions || !esv) return null;
  const out = {};
  for (const s of SIDES) {
    const a = RA.decalage(rails[s], positions[s]), b = esv === 'depart' ? [0, 0, 0] : RA.decalage(rails[s], esv[s]);
    if (!a || !b) return null;
    out[s] = [a[1] - b[1], a[2] - b[2]];
  }
  return out;
}
/* Appuis vérifiés AVANT l'instant `t0` (début de la première visite du cut), autres que le cut lui-même. Un cut à la fois humain (avant t0) et
 * lot garde la pose humaine ; humain après t0 : le lot, s'il y en a un, sinon rien. */
function voisinsSursA(verifiees, partie, cut, t0) {
  const par = new Map();
  for (const p of verifiees) {
    if (p.cut === cut) continue;
    if (p.source === 'humain' && !(p.t < t0)) continue;
    const a = par.get(p.cut);
    if (!a || (p.source === 'humain' && a.source !== 'humain') || (p.source === a.source && p.t > a.t)) par.set(p.cut, p);
  }
  return [...par.values()].map(p => ({ identity: { part: partie, cut: p.cut, frameId: null }, positions: p.positions, stage: 'verifie', source: p.source,
    ...(p.decalage !== undefined ? { decalage: p.decalage } : {}) }));
}

/* ------------------------------------------------------------------ H6 « voie décalée » (D-207) */
/* La paire de départ translatée du décalage [latéral, vertical] d'un voisin SÛR récent (même règle de temps que H4 : `voisinsSursA`).
 * Deux familles : « tous » (voisins humains validés avant la première visite, et voisins du lot) pour l'usage relecture ; « lot » (voisins validés
 * par le lot seulement) pour l'usage lot. Dans chaque famille, deux variantes : le voisin le plus proche, et la médiane des K plus proches, à
 * FENETRE cuts au plus ; chacune rail par rail et « paire » (le même décalage, moyenne des deux rails du voisin, appliqué aux deux rails). */
const H6 = Object.freeze({ fenetreCuts: 10, k: 5, dispersionSureMm: 50, nSur: 2, reservoirMm: 5, procheMaxCuts: 5, supportDessus: 5, supportFlanc: 3, concurrentMm: 45 });
/* Voisins utilisables : même voie, autre cut, à `fenetreCuts` au plus, avec un décalage connu ; du plus proche au plus loin (à égalité, l'amont). */
function voisinsH6(identity, voisins) {
  return (voisins || []).filter(a => a && a.decalage && a.identity && a.identity.part === identity.part && (a.identity.frameId ?? null) === (identity.frameId ?? null)
    && a.identity.cut !== identity.cut && Math.abs(a.identity.cut - identity.cut) <= H6.fenetreCuts)
    .sort((a, b) => Math.abs(a.identity.cut - identity.cut) - Math.abs(b.identity.cut - identity.cut) || a.identity.cut - b.identity.cut);
}
const moyPaire = d => [(d.left[0] + d.right[0]) / 2, (d.left[1] + d.right[1]) / 2];
/* Décalages d'une famille : { proche: {left,right,paire,dist,source}, mediane: {…, n, distMax, dispersion} | null, reference } ou null. */
function decalagesH6(identity, voisins) {
  const v = voisinsH6(identity, voisins);
  if (!v.length) return null;
  const p = v[0], k = v.slice(0, H6.k), dist = a => Math.abs(a.identity.cut - identity.cut);
  const proche = { left: p.decalage.left.slice(), right: p.decalage.right.slice(), paire: moyPaire(p.decalage), dist: dist(p), n: 1, source: p.source === 'humain' ? 'humain' : 'lot' };
  let mediane = null;
  if (k.length >= 2) {
    const m = f => [med(k.map(a => f(a)[0])), med(k.map(a => f(a)[1]))];
    const L = m(a => a.decalage.left), R = m(a => a.decalage.right), P = m(a => moyPaire(a.decalage));
    /* Accord entre voisins : étendue (max − min) du latéral, par rail et pour la paire. */
    const etendue = f => { const x = k.map(a => f(a)[0]); return Math.max(...x) - Math.min(...x); };
    mediane = { left: L, right: R, paire: P, n: k.length, distMax: Math.max(...k.map(dist)), source: k.some(a => a.source === 'humain') ? 'humain' : 'lot',
      dispersion: { left: etendue(a => a.decalage.left), right: etendue(a => a.decalage.right), paire: etendue(a => moyPaire(a.decalage)) } };
  }
  /* Voie de référence de la série (garde-fou des différés, gcv2-apprendre `--garde-voie`, audit H1) : la médiane rail par rail des K plus proches.
   * Premières preuves (ici) : au moins `nSur` appuis, une étendue latérale d'au plus `dispersionSureMm` sur chaque rail (appuis contradictoires :
   * non), l'appui le plus proche à `procheMaxCuts` au plus (propagation limitée). Les autres preuves (support local des deux rails à la pose de
   * référence, pas de voie concurrente à la pose de départ, pas de rupture de série) sont ajoutées par `hypothesesDuCut` et `lignesDuJeu`. */
  const motifs = [];
  if (!mediane) motifs.push(v.length ? 'un-seul-appui' : 'aucun-appui');
  else {
    if (mediane.dispersion.left > H6.dispersionSureMm || mediane.dispersion.right > H6.dispersionSureMm) motifs.push('appuis-contradictoires');
    if (proche.dist > H6.procheMaxCuts) motifs.push('appui-trop-loin');
  }
  const reference = mediane ? { left: mediane.left, right: mediane.right, n: mediane.n, distMax: mediane.distMax, distMin: proche.dist,
    dispersion: { left: mediane.dispersion.left, right: mediane.dispersion.right }, ancres: k.map(a => ({ cut: a.identity.cut, source: a.source === 'humain' ? 'humain' : 'lot' })), motifs } : null;
  return { proche, mediane, reference, motifs };
}

/* ------------------------------------------------------------------ géométrie d'une hypothèse */
const cleCellule = c => Math.round(c.u * 1e6) + ',' + Math.round(c.z * 1e6);
const comptePositions = (capture, side, mm) => L.positionOf(capture.rails[side], mm.map(v => v / 1000));
/* Mesures d'une pose (sans fuite : la capture et le calage seuls) : points sous le gabarit, épaisseur du dessus, groupe de convention, hauteur apprise. */
function mesuresPose(capture, side, mm, calage, etage = 'first-pass') {
  const pos = comptePositions(capture, side, mm);
  const sig = H.signalRail(capture, { rails: { [side]: { conventionCalibration: calage || null } } }, side, pos);
  const cor = H.correctionRail(sig, etage);
  return { pos, sig, cor };
}
const gaugeMm = (a, b) => 1000 * C.distance(a, b);
/* Mêmes mesures, la capture ayant ce rail translaté jusqu'à la pose `mm` (H6 : poses loin de la fenêtre de ±180 mm de la bande de points). Le
 * calage de convention, s'il y en a un, est celui de la pose ; la position rendue est celle de la pose dans la capture d'origine. */
function mesuresTranslatees(capture, side, mm, calage, etage = 'first-pass') {
  const rail = capture.rails[side], pos = comptePositions(capture, side, mm);
  const t = pos.map((v, i) => v - rail.positionSceneRelative[i]);
  const capT = { ...capture, rails: { ...capture.rails, [side]: O.translated(rail, t) } };
  const sig = H.signalRail(capT, { rails: { [side]: { conventionCalibration: calage || null } } }, side, pos);
  return { pos, sig, cor: H.correctionRail(sig, etage) };
}

/* ------------------------------------------------------------------ hypothèses d'un cut (SANS la référence humaine) */
/*
 * `capture` : { identity, rails (pose de départ), pointsSceneRelative, visibleByClipBoxes } ; `science` : résultat du moteur AVEC réservoir ;
 * `seul` : { decision, v } (décision du lot, premier passage) ; `chaine` : { decision, v } ou null ; `appuisAvant` : appuis de la chaîne ;
 * `voisins` : appuis vérifiés avant la première visite ; `gMed` : médiane d'écartement de la partie (mm) ou null.
 * Rend { rails: { left: [hyp…], right: [hyp…] }, rail: { left: {...}, right: {...} }, cut: {...}, tronques: { left: [[l,a,v]…], right: … } }.
 */
function hypothesesDuCut({ capture, science, seul, chaine = null, appuisAvant = [], voisins = [], gMed = null, voisinsLot = null, departEsv = null }) {
  const T = (ShadowLivre._test), identity = capture.identity;
  const res = {};
  /* H6 : décalages des voisins sûrs (deux familles). `departEsv` : null quand la pose de départ du cut est celle d'ESV ; { left, right } (mm,
   * [long, lat, vert]) quand le lot l'a posé (la pose d'ESV d'origine, lue dans le journal du lot) ; false si on ne la connaît pas (pas de H6). */
  const baseH6 = departEsv === false ? null : departEsv || { left: [0, 0, 0], right: [0, 0, 0] };
  const famH6 = baseH6 ? { lot: decalagesH6(identity, voisinsLot || voisins.filter(a => a.source === 'lot')), tous: decalagesH6(identity, voisins) } : { lot: null, tous: null };
  const tronquesH6 = { left: 0, right: 0 };
  /* Voie prédite par la chaîne, et interpolation des voisins sûrs, en [latéral, vertical] mm par rail. */
  let voie = null;
  if (chaine && chaine.decision && (chaine.decision.anchorsUsed || []).length) {
    try { voie = V.predictionDe(capture, chaine.decision, appuisAvant); } catch { voie = null; }
  }
  let interp = null, infoVoisins = { n: 0, humains: 0, lot: 0, encadre: false, coupMin: null, ecartementMm: null };
  if (voisins.length) {
    const nb = L.neighbours(identity, voisins, L.DEFAULTS), pa = L.predictionAnchors(identity, voisins, nb, L.DEFAULTS);
    if (pa.list.length) {
      const predire = pa.list.framed ? L.predictFramed : O.predict, utilises = voisins.filter(a => pa.cuts.includes(a.identity.cut));
      interp = {};
      for (const s of SIDES) { const p = predire(capture.rails[s], pa.list, s); interp[s] = [p.lateral * 1000, p.vertical * 1000]; }
      const g = L.gaugeReference(identity, voisins, L.DEFAULTS);
      infoVoisins = { n: pa.cuts.length, humains: utilises.filter(a => a.source === 'humain').length, lot: utilises.filter(a => a.source === 'lot').length,
        encadre: !!pa.framed, coupMin: Math.min(...pa.cuts.map(k => Math.abs(k - identity.cut))), ecartementMm: g ? arrondi(g.mm, 1) : null };
    }
  }
  const tronques = { left: [], right: [] }, railInfo = {};
  for (const s of SIDES) {
    const rail = capture.rails[s], r = science.rails[s], rs = r && r.ok && r._reservoir ? r._reservoir : null;
    const items = [];   // { origine, sous, mm: [l,a,v] (sans hauteur), calage, cellule, ordre }
    items.push({ origine: 'H0', sous: 'depart', mm: [0, 0, 0], calage: null, cellule: null });
    /* Cellules du réservoir : H1 (A*), H2 (compétitives et STRONG écartées). */
    const cellules = [];
    if (rs) {
      const pick = r.next && r.next.pick ? cleCellule(r.next.pick) : null;
      for (const c of rs.pool) {
        const ratio = T.lossRatio(c.loss, rs.lmin), comp = T.inCompetitive(c, rs.lmin), strong = T.qualifyStrong(c), astar = (c.tags || []).includes('astar-published');
        cellules.push({ c, ratio, comp, strong, astar, publiee: pick !== null && cleCellule(c) === pick });
      }
    }
    const miseEnCellule = (k, origine, sous) => {
      const brut = [0, rs.sign * k.c.u, k.c.z], cal = Conv.calibrate(capture, s, brut), fin = cal.applied ? cal.delta : brut;
      return { origine, sous, mm: fin.map(v => 1000 * v), calage: cal, cellule: k };
    };
    const astarCell = cellules.find(k => k.astar);
    if (astarCell) items.push(miseEnCellule(astarCell, 'H1', 'astar'));
    /* H3 : pose de la chaîne et voie prédite. */
    if (chaine && chaine.decision && chaine.decision.positions && (chaine.decision.anchorsUsed || []).length)
      items.push({ origine: 'H3', sous: 'chaine', mm: RA.decalage(rail, chaine.decision.positions[s]), calage: null, cellule: null, chaineRail: chaine.v.rails[s] });
    if (voie) items.push({ origine: 'H3', sous: 'voie', mm: [0, voie[s][0], voie[s][1]], calage: null, cellule: null });
    /* H4 : interpolation des voisins sûrs. */
    if (interp) items.push({ origine: 'H4', sous: infoVoisins.humains ? 'voisins-humains' : 'voisins-lot', mm: [0, interp[s][0], interp[s][1]], calage: null, cellule: null });
    /* H5 : rail manquant complété par l'écartement médian de la partie, à partir du rail sûr (l'autre rail, quand le moteur le publie). Le latéral est
     * celui qui donne à la paire l'écartement médian, la hauteur celle du rail sûr (le dévers de départ est gardé). Rien de la référence humaine. */
    const sur = SIDES.find(x => x !== s), rSur = science.rails[sur];
    if (fini(gMed) && rSur && rSur.ok && rSur.next.status === 'candidate' && Array.isArray(rSur.next.delta)) {
      const dSur = rSur.next.delta, posSur = L.positionOf(capture.rails[sur], dSur), vert = 1000 * dSur[2];
      const g = a => gaugeMm(L.positionOf(rail, [0, a / 1000, vert / 1000]), posSur);
      let a = 0;
      for (let k = 0; k < 4; k++) { const pente = (g(a + 5) - g(a)) / 5; if (!(Math.abs(pente) > 0.3)) { a = NaN; break; } a -= (g(a) - gMed) / pente; }
      if (Number.isFinite(a) && Math.abs(a) <= 80 && Math.abs(g(a) - gMed) < 0.5) items.push({ origine: 'H5', sous: 'ecartement-median', mm: [0, a, vert], calage: null, cellule: null });
    }
    /* H6 : la pose d'ESV d'origine translatée du décalage d'un voisin sûr. Ordre : rail par rail, puis « paire » ; dans chaque mode, la famille du lot
     * d'abord (elle sert aux deux usages), puis celle qui compte les voisins humains (seulement si elle en utilise). Avant H2. */
    if (baseH6) for (const mode of ['rail', 'paire']) for (const fam of ['lot', 'tous']) for (const variante of ['proche', 'mediane']) {
      const F = famH6[fam] && famH6[fam][variante];
      if (!F || (fam === 'tous' && F.source !== 'humain')) continue;
      const off = mode === 'paire' ? F.paire : F[s], b = baseH6[s];
      items.push({ origine: 'H6', sous: `h6-${F.source}-${variante}-${mode}`, mm: [b[0], b[1] + off[0], b[2] + off[1]], calage: null, cellule: null,
        h6: { source: F.source, ampleurMm: Math.hypot(off[0], off[1]), distCuts: variante === 'proche' ? F.dist : F.distMax, n: F.n,
          dispersionMm: variante === 'mediane' ? (mode === 'paire' ? F.dispersion.paire : F.dispersion[s]) : (famH6[fam].mediane ? famH6[fam].mediane.dispersion[mode === 'paire' ? 'paire' : s] : null) } });
    }
    /* H2 : par priorité (compétitive STRONG, compétitive, STRONG écartée), à perte croissante. */
    const h2 = cellules.filter(k => !k.astar && (k.comp || k.strong))
      .sort((a, b) => (b.comp && b.strong) - (a.comp && a.strong) || b.comp - a.comp || a.c.loss - b.c.loss);
    const h2Items = h2.map(k => miseEnCellule(k, 'H2', k.comp ? (k.strong ? 'comp-strong' : 'comp') : 'strong-ecartee'));
    /* Déduplication dans l'ordre H0, H1, H3, H4, H5 puis H2 ; plafond de MAX_HYP poses de base. */
    const gardees = [], vus = [];
    const ajoute = it => {
      const d = gardees.find(g => norme(moins(g.mm, it.mm)) < DOUBLON_MM);
      if (d) {
        if (!d.origines.includes(it.origine)) d.origines.push(it.origine);
        d.sousListe.push(it.sous);
        if (it.cellule) { d.cellules.push(it.cellule); if (!d.cellule || it.cellule.c.loss < d.cellule.c.loss) { d.cellule = it.cellule; d.calage = it.calage; } }
        /* Les traits H6 suivent la première H6 qui tombe ici (celle du lot passe avant celle des voisins humains). */
        if (it.h6 && (!d.h6 || (d.h6.source !== 'lot' && it.h6.source === 'lot'))) d.h6 = it.h6;
        return true;
      }
      if (gardees.length >= MAX_HYP) return false;
      gardees.push({ ...it, origines: [it.origine], sousListe: [it.sous], cellules: it.cellule ? [it.cellule] : [] });
      return true;
    };
    for (const it of items) if (!ajoute(it) && it.origine === 'H6') tronquesH6[s]++;
    for (const it of h2Items) if (!ajoute(it)) tronques[s].push(it.mm.map(v => arrondi(v, 2)));
    /* Rail : traits propres au rail. */
    railInfo[s] = {
      statut: r && r.ok ? r.next.status : 'absent', motif: r && r.ok ? (r.next.motif ?? null) : (r && r.error ? 'erreur' : 'absent'),
      confianceAstar: r && r.astar ? arrondi(r.astar.confidence, 1) : null, rapportPerteAstar: r && r.astar ? arrondi(r.astar.lossRatio, 2) : null,
      s1: !!(r && r.s1Changed), fortsConcurrents: r && r.competitive ? (r.competitive.nStrongCompetitive ?? null) : null,
      competitives: r && r.competitive ? r.competitive.nCompetitive : null, grappes: r && r.competitive ? r.competitive.nClusters : null,
      fortsReservoir: r && r.competitive ? r.competitive.nStrongPool : null, reservoir: rs ? rs.pool.length : 0,
      pointsRail: r && r.frame ? r.frame.pointsLocal : null, perteMin: rs ? sig4(rs.lmin) : null,
    };
    res[s] = { gardees, cellules, rs };
  }
  /* Traits et variantes « avec hauteur », puis écartement de la paire (a besoin des deux listes). */
  const hyps = { left: [], right: [] };
  for (const s of SIDES) {
    const { gardees, cellules } = res[s], autre = SIDES.find(x => x !== s);
    gardees.forEach((g, i) => {
      /* Une pose H6 peut être loin de la pose de départ (130 à 250 mm) : la bande de points de la convention ne lit que ±180 mm autour du rail de
       * départ. Les points sous le gabarit d'une H6 sont donc comptés sur la capture dont ce rail est TRANSLATÉ jusqu'à la pose (mêmes points). */
      const m = g.h6 ? mesuresTranslatees(capture, s, g.mm, g.calage) : mesuresPose(capture, s, g.mm, g.calage), sig = m.sig;
      const dessinCellule = g.cellule;
      let proche = null;
      if (!dessinCellule && cellules.length) {
        let best = null;
        for (const k of cellules) {
          const d = Math.hypot(1000 * (res[s].rs.sign * k.c.u) - g.mm[1], 1000 * k.c.z - g.mm[2]);
          if (!best || d < best.d) best = { d, k };
        }
        proche = best;
      }
      const posAutreH0 = capture.rails[autre].positionSceneRelative;
      const gauge0 = gaugeMm(m.pos, posAutreH0);
      const base = {
        rang: i, origine: g.origine, sous: g.sousListe[0], origines: g.origines.slice().sort(), sousOrigines: [...new Set(g.sousListe)].sort(),
        decal: g.mm.map(v => arrondi(v, 2)),
        traits: {
          perte: dessinCellule ? sig4(dessinCellule.c.loss) : null, ratioPerte: dessinCellule ? arrondi(dessinCellule.ratio, 3) : null,
          lignesSommet: dessinCellule ? dessinCellule.c.topRows ?? null : null, faces: dessinCellule ? dessinCellule.c.faceCount ?? null : null,
          strong: dessinCellule ? g.cellules.some(k => k.strong) : null, palier: dessinCellule ? dessinCellule.c.tier ?? null : null,
          pente: dessinCellule ? !!dessinCellule.c.slopeLimited : null, fenetre: dessinCellule ? !!dessinCellule.c.windowOk : null,
          competitive: dessinCellule ? g.cellules.some(k => k.comp) : null, astar: g.cellules.some(k => k.astar),
          publiee: g.cellules.some(k => k.publiee), s1: !!(g.cellules.some(k => k.publiee) && railInfo[s].s1),
          balises: dessinCellule ? (dessinCellule.c.tags || []).slice().sort() : null,
          distCelluleMm: proche ? arrondi(proche.d, 1) : null, ratioCelluleProche: proche ? arrondi(proche.k.ratio, 3) : null, strongCelluleProche: proche ? proche.k.strong : null,
          pointsDessus: sig.pointsDessus, pointsFlanc: sig.pointsFlanc, epaisseurDessusMm: sig.epaisseurDessusMm,
          dzConventionMm: g.calage ? arrondi(g.calage.dzMm, 2) : null, duConventionMm: g.calage ? arrondi(g.calage.duMm, 2) : null,
          convention: g.calage ? (g.calage.applied ? 'appliquee' : (g.calage.reason || 'refusee')) : null, groupeHauteur: g.chaineRail ? (g.chaineRail.groupe ?? null) : sig.groupe,
          deplMm: arrondi(norme(g.mm), 2),
          ecartVoieMm: voie ? arrondi(Math.hypot(g.mm[1] - voie[s][0], g.mm[2] - voie[s][1]), 2) : null,
          ecartVoisinsMm: interp ? arrondi(Math.hypot(g.mm[1] - interp[s][0], g.mm[2] - interp[s][1]), 2) : null,
          ecartementAutreH0Mm: arrondi(gauge0, 1), ecartMedAutreH0Mm: fini(gMed) ? arrondi(gauge0 - gMed, 1) : null,
          chaineEtage: g.chaineRail ? chaine.v.stage : null,
        },
        _pos: m.pos, _cor: m.cor,
      };
      /* Traits H6 (sans fuite : voisins sûrs et réservoir du moteur). La perte et les lignes au sommet ne sont connues que si une cellule du réservoir
       * tombe à `reservoirMm` de la pose ; sinon (pose hors de la fenêtre du moteur, le cas courant au-delà de 150 mm) elles restent nulles. */
      if (g.h6) {
        const cel = dessinCellule ? { d: 0, k: dessinCellule } : proche, dans = !!(cel && cel.d <= H6.reservoirMm);
        Object.assign(base.traits, { h6AmpleurMm: arrondi(g.h6.ampleurMm, 2), h6DistCuts: g.h6.distCuts, h6NVoisins: g.h6.n, h6DispersionMm: arrondi(g.h6.dispersionMm, 2),
          h6DansReservoir: dans, h6Perte: dans ? sig4(cel.k.c.loss) : null, h6LignesSommet: dans ? (cel.k.c.topRows ?? null) : null });
      }
      let correction = null;
      if (g.chaineRail) correction = fini(g.chaineRail.hauteurMm) && g.chaineRail.hauteurMm !== 0 ? g.chaineRail.hauteurMm : null;
      else if (m.cor && m.cor.correctionMm) correction = m.cor.correctionMm;
      base.traits.hauteurMm = correction;
      base.traits.hauteurAbstention = g.chaineRail ? (g.chaineRail.hauteurAbstention ?? null) : (m.cor ? m.cor.abstention : null);
      hyps[s].push({ ...base, hauteur: false });
      if (correction) {
        const mm = [g.mm[0], g.mm[1], g.mm[2] + correction], pos = comptePositions(capture, s, mm);
        hyps[s].push({ ...base, hauteur: true, decal: mm.map(v => arrondi(v, 2)), _pos: pos, traits: { ...base.traits, deplMm: arrondi(norme(mm), 2),
          ecartVoieMm: voie ? arrondi(Math.hypot(mm[1] - voie[s][0], mm[2] - voie[s][1]), 2) : null,
          ecartVoisinsMm: interp ? arrondi(Math.hypot(mm[1] - interp[s][0], mm[2] - interp[s][1]), 2) : null,
          ecartementAutreH0Mm: arrondi(gaugeMm(pos, posAutreH0), 1), ecartMedAutreH0Mm: fini(gMed) ? arrondi(gaugeMm(pos, posAutreH0) - gMed, 1) : null } });
      }
    });
  }
  /* Écartement de la paire contre la médiane de la partie : la meilleure paire possible avec l'autre rail (toutes ses hypothèses). */
  if (fini(gMed)) for (const s of SIDES) {
    const autre = SIDES.find(x => x !== s);
    for (const h of hyps[s]) {
      let mini = Infinity;
      for (const o of hyps[autre]) mini = Math.min(mini, Math.abs(gaugeMm(h._pos, o._pos) - gMed));
      h.traits.ecartPaireMedMm = Number.isFinite(mini) ? arrondi(mini, 1) : null;
    }
  } else for (const s of SIDES) for (const h of hyps[s]) h.traits.ecartPaireMedMm = null;
  for (const s of SIDES) for (const h of hyps[s]) { delete h._pos; delete h._cor; }
  const ecartDepart = gaugeMm(capture.rails.left.positionSceneRelative, capture.rails.right.positionSceneRelative);
  const abstenu = !SIDES.every(s => science.rails[s] && science.rails[s].ok && science.rails[s].next.status === 'candidate') || !!(science.summary && science.summary.pairGaugeRejected);
  /* Voie de référence de la série, par famille, en mm dans le repère profil de la pose de départ (comme `decal`) : le garde-fou des différés. */
  /* Preuves indépendantes de la simple translation (audit H1, point 3) : SUPPORT LOCAL des deux rails à la pose de référence (points du dessus et du
   * flanc sous le gabarit, sur la capture translatée), et PAS DE VOIE CONCURRENTE plausible : si la pose de départ a elle aussi un support sur les
   * deux rails alors que la référence en est à plus de `concurrentMm`, deux voies sont possibles, on s'abstient. Sans preuve suffisante : non sûre. */
  const support = mm => SIDES.map(s => { const m = mesuresTranslatees(capture, s, mm[s], null).sig; return { dessus: m.pointsDessus ?? 0, flanc: m.pointsFlanc ?? 0 }; });
  const soutenu = x => x.dessus >= H6.supportDessus && x.flanc >= H6.supportFlanc;
  const refH6 = f => {
    const r = famH6[f] && famH6[f].reference;
    if (!r) return null;
    const pose = s => [arrondi(baseH6[s][1] + r[s][0], 2), arrondi(baseH6[s][2] + r[s][1], 2)];
    const sRef = support({ left: [baseH6.left[0], baseH6.left[1] + r.left[0], baseH6.left[2] + r.left[1]], right: [baseH6.right[0], baseH6.right[1] + r.right[0], baseH6.right[2] + r.right[1]] });
    const sDep = support({ left: [0, 0, 0], right: [0, 0, 0] }), loin = Math.max(...SIDES.map(s => Math.abs(baseH6[s][1] + r[s][0]))) > H6.concurrentMm;
    const motifs = [...r.motifs];
    if (!sRef.every(soutenu)) motifs.push('sans-support-local');
    if (loin && sDep.every(soutenu)) motifs.push('voie-concurrente-au-depart');
    return { left: pose('left'), right: pose('right'), n: r.n, distMin: r.distMin, distMax: r.distMax, dispersionMm: { left: arrondi(r.dispersion.left, 2), right: arrondi(r.dispersion.right, 2) },
      ancres: r.ancres, support: { reference: sRef, depart: sDep }, motifs, sure: !motifs.length };
  };
  const voieH6 = baseH6 ? { tous: refH6('tous'), lot: refH6('lot'), departLot: !!departEsv } : null;
  return { rails: hyps, rail: railInfo, tronques, voieH6, tronquesH6,
    cut: { abstenu, differe: seul.decision.stage === 'deferred', etage: seul.decision.stage, raison: seul.decision.reason != null ? String(seul.decision.reason).slice(0, 60) : null,
      etageChaine: chaine ? chaine.decision.stage : null, appuisChaine: chaine ? (chaine.decision.anchorsUsed || []).length : 0,
      voisins: infoVoisins, ecartDepartMm: arrondi(ecartDepart, 1), gMedMm: arrondi(gMed, 1),
      ecartementMm: science.pairGauge ? arrondi(science.pairGauge.predictedMm, 1) : null, ecartementRejete: !!(science.summary && science.summary.pairGaugeRejected),
      nHyp: { left: hyps.left.length, right: hyps.right.length } } };
}

/* ------------------------------------------------------------------ étiquette (après les traits, jamais dedans) */
const classeDe = mm => !fini(mm) ? null : mm <= SEUILS_MM.juste ? '<=5' : mm <= SEUILS_MM.faux ? '<=10' : mm <= SEUILS_MM.mauvaiseVoie ? '<=50' : '>50';
/* `mic` : { left: [l,a,v] | null, right: … } (correction de l'opérateur depuis la pose de départ) ou null (pas de référence). */
function etiqueter(hypotheses, mic) {
  const out = { left: [], right: [] };
  for (const s of SIDES) for (const h of hypotheses.rails[s]) {
    const m = mic && mic[s];
    const e = m ? norme(moins(h.decal, m)) : null;
    out[s].push(m ? { ecartMm: arrondi(e, 2), classe: classeDe(e) } : null);
  }
  return out;
}

/* ------------------------------------------------------------------ observateur d'`extraire` */
function creerObservateur({ partie, lotValide = new Set(), deplacementsLot = new Map(), moteur = moteurAvecReservoir(), journal = () => {} }) {
  const etat = { verifiees: [], gMed: null, cuts: [], erreurs: 0, ecartsMoteur: 0, calcules: 0 };
  return {
    etat,
    debut({ parCut, ctx, referenceHumaine }) {
      etat.verifiees = posesVerifiees(parCut, { ctx, referenceHumaine, lotValide, deplacementsLot });
      /* Médiane d'écartement de la partie : poses de départ des cuts visités, hors cuts du lot et hors valeur par défaut 1500 mm (statistique
       * de la partie, comme `lignes` de relecture-autonome.cjs ; aucune référence de l'opérateur). */
      const g = [];
      for (const c of parCut) {
        const a = c.visites[0] && c.visites[0].beforeEstablished && c.visites[0].beforeEstablished.rails;
        if (!a || !a.left || !a.right || !a.left.positionSceneRelative || !a.right.positionSceneRelative || lotValide.has(c.cut)) continue;
        const mm = gaugeMm(a.left.positionSceneRelative, a.right.positionSceneRelative);
        if (fini(mm) && Math.abs(mm - 1500) > 0.05) g.push(mm);
      }
      etat.gMed = med(g);
    },
    cut({ c, v0, o, entree, brut }) {
      const t0 = Date.parse(v0.startedAt), rec = { cut: c.cut, o, hyp: null, hypLot: null, etiquette: null, erreur: null };
      etat.cuts.push(rec);
      if (!o.ariane || o.ariane.etat !== 'calcule' || !brut) return;
      try {
        const science = moteur.scientificProposeBoth(brut.capture);
        /* La copie du moteur doit donner la même publication que le moteur livré. */
        for (const s of SIDES) {
          const a = JSON.stringify(science.rails[s] && science.rails[s].next && science.rails[s].next.delta), b = JSON.stringify(brut.science.rails[s] && brut.science.rails[s].next && brut.science.rails[s].next.delta);
          if (a !== b) etat.ecartsMoteur++;
        }
        const voisins = voisinsSursA(etat.verifiees, partie, c.cut, t0);
        /* H6, famille du lot : les voisins validés par le lot SEULEMENT (un cut à la fois humain et lot garde ici sa pose du lot). */
        const voisinsLot = voisinsSursA(etat.verifiees.filter(p => p.source === 'lot'), partie, c.cut, t0);
        /* Pose d'ESV d'origine du cut : sa pose de départ, sauf si le lot l'a posé (journal du lot ; inconnue : pas de H6). */
        let departEsv = null;
        if (lotValide.has(c.cut)) {
          const ini = esvDepuisDeplacement(brut.capture.rails, deplacementsLot.get(c.cut)), d = ini ? Object.fromEntries(SIDES.map(s => [s, RA.decalage(brut.capture.rails[s], ini[s])])) : null;
          departEsv = d && SIDES.every(s => d[s]) ? d : false;
        }
        rec.hyp = hypothesesDuCut({ capture: brut.capture, science, seul: brut.seul, chaine: brut.chaine, appuisAvant: brut.appuisAvant, voisins, gMed: etat.gMed, voisinsLot, departEsv });
        /* Jeu « lot » (audit F3) : GÉNÉRÉ depuis des entrées sans aucun appui humain (H4 et H6 n'ont que les voisins du lot), avant déduplication,
         * plafond et traits ; il n'est pas obtenu en filtrant le jeu de relecture. */
        rec.hypLot = hypothesesDuCut({ capture: brut.capture, science, seul: brut.seul, chaine: brut.chaine, appuisAvant: brut.appuisAvant, voisins: voisinsLot, gMed: etat.gMed, voisinsLot, departEsv });
        etat.calcules++;
      } catch (e) { rec.erreur = String(e && e.message || e).slice(0, 160); etat.erreurs++; journal(`cut ${c.cut} : ${rec.erreur}`); }
    },
  };
}

/* Lignes du jeu d'une partie, une fois le cas et la table connus (zone, rôle). */
/* Rupture de série (audit H1, point 2) : un appui est séparé du cut par une bifurcation quand un cut de l'intervalle (bornes comprises) n'a pas le même
 * statut ADV que le cut. La voie de référence n'est alors pas sûre. */
function avecRupture(voie, cut, zones) {
  if (!voie) return voie;
  const adv = c => (zones.get(c) || {}).zone === 'adv', t = adv(cut);
  const rompu = (voie.ancres || []).some(a => { for (let c = Math.min(a.cut, cut); c <= Math.max(a.cut, cut); c++) if (zones.has(c) && adv(c) !== t) return true; return false; });
  if (!rompu) return voie;
  const motifs = [...voie.motifs, 'rupture-de-serie'];
  return { ...voie, motifs, sure: false };
}
/* `usage` : « relecture » (voisins humains validés avant la première visite, et voisins du lot) ou « lot » (jeu généré sans aucun appui humain). */
function lignesDuJeu({ designation, jeu, observateur, cas, zones, usage = 'relecture' }) {
  if (!['relecture', 'lot'].includes(usage)) throw Error(`usage « ${usage} » : relecture | lot`);
  const out = [{ type: 'entete', format: FORMAT, partie: designation, jeu, usage, note: 'jeu HORS DÉPÔT : décalages en mm dans le repère profil de la pose de départ, aucune coordonnée absolue',
    maxHypParRail: MAX_HYP, doublonMm: DOUBLON_MM, seuilsMm: SEUILS_MM, gMedMm: arrondi(observateur.etat.gMed, 1), h6: { version: VERSION_H6, ...H6 } }];
  const roleDe = g => g === 'pose' ? 'rouge' : g === 'differe' ? 'differe' : 'vert';
  for (const rec0 of observateur.etat.cuts) {
    const hyp = usage === 'lot' ? rec0.hypLot : rec0.hyp;
    const rec = { ...rec0, hyp: hyp ? { ...hyp, voieH6: hyp.voieH6 ? { ...hyp.voieH6, tous: avecRupture(hyp.voieH6.tous, rec0.cut, zones), lot: avecRupture(hyp.voieH6.lot, rec0.cut, zones) } : hyp.voieH6 } : null };
    const o = rec.o, z = zones.get(rec.cut) || { zone: 'hors', genre: 'vert' };
    const mic = o.mic && o.mic.ref ? { left: o.mic.rails.left, right: o.mic.rails.right } : null;
    const micMax = mic && mic.left && mic.right ? arrondi(Math.max(norme(mic.left), norme(mic.right)), 2) : null;
    const ligneCut = { type: 'cut', partie: designation, cut: rec.cut, zone: z.zone, role: roleDe(z.genre), etat: o.ariane ? o.ariane.etat : null,
      reference: o.mic ? (o.mic.ref || null) : null, visites: o.visites, etiquette: { mic, micMaxMm: micMax, grosse: fini(micMax) ? micMax > SEUILS_MM.faux : null },
      moteur: rec.hyp ? { abstenu: rec.hyp.cut.abstenu, differe: rec.hyp.cut.differe, etage: rec.hyp.cut.etage, raison: rec.hyp.cut.raison, ecartementMm: rec.hyp.cut.ecartementMm, ecartementRejete: rec.hyp.cut.ecartementRejete } : null,
      contexte: rec.hyp ? { etageChaine: rec.hyp.cut.etageChaine, appuisChaine: rec.hyp.cut.appuisChaine, voisins: rec.hyp.cut.voisins, ecartDepartMm: rec.hyp.cut.ecartDepartMm, voieH6: rec.hyp.voieH6 } : null,
      nHyp: rec.hyp ? rec.hyp.cut.nHyp : null, tronques: rec.hyp ? { left: rec.hyp.tronques.left.length, right: rec.hyp.tronques.right.length } : null,
      tronquesPoses: rec.hyp && (rec.hyp.tronques.left.length || rec.hyp.tronques.right.length) ? rec.hyp.tronques : null, tronquesH6: rec.hyp ? rec.hyp.tronquesH6 : null, erreur: rec.erreur };
    out.push(ligneCut);
    if (!rec.hyp) continue;
    const et = etiqueter(rec.hyp, mic);
    for (const s of SIDES) {
      out.push({ type: 'rail', partie: designation, cut: rec.cut, rail: s, ...rec.hyp.rail[s], micRailMm: mic && mic[s] ? arrondi(norme(mic[s]), 2) : null });
      rec.hyp.rails[s].forEach((h, i) => out.push({ type: 'hyp', partie: designation, cut: rec.cut, rail: s, rang: h.rang, origine: h.origine, sous: h.sous, origines: h.origines, sousOrigines: h.sousOrigines,
        hauteur: h.hauteur, decal: h.decal, traits: { ...h.traits, zone: z.zone, role: roleDe(z.genre) }, etiquette: et[s][i] }));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ construction d'une partie */
function construire({ projet, partie, echo, journaux = [], sansLot = false, jeu = 'apprentissage', journal = () => {} }) {
  const designation = `${projet}:${partie}`;
  if (sansLot && journaux.length) throw Error('--sans-lot et --journal s\'excluent');
  if (!sansLot && !journaux.length) throw Error('--journal J.json (lot Orbite de la partie) ou --sans-lot (partie sans lot) attendu');
  const RM = require('./regles-metier.cjs');
  const lotValide = new Set(), deplacementsLot = new Map();
  for (const f of sansLot ? [] : journaux) {
    const j = RM.lireJournal(f, partie);
    for (const c of j.valide) {
      lotValide.add(c);
      const p = j.poses.get(c);
      if (p && p.initiale && p.finale && SIDES.every(s => Array.isArray(p.initiale[s]) && Array.isArray(p.finale[s]))) deplacementsLot.set(c, Object.fromEntries(SIDES.map(s => [s, p.finale[s].map((v, i) => v - p.initiale[s][i])])));
    }
  }
  const observateur = creerObservateur({ partie, lotValide, deplacementsLot, journal });
  const cas = RA.extraire({ partie, projet, echo, observateur });
  const table = RA.construireTable({ projet, partie, echo, journaux: sansLot ? [] : journaux, cas, sansLot });
  const L2 = RA.lignes({ cas, table, designation });
  const zones = new Map(L2.lignes.map(l => [l.cut, { zone: l.zone, genre: l.genre }]));
  const lignes = lignesDuJeu({ designation, jeu, observateur, cas, zones }), lignesLot = lignesDuJeu({ designation, jeu, observateur, cas, zones, usage: 'lot' });
  return { lignes, lignesLot, etat: observateur.etat, cas, table };
}

/* ------------------------------------------------------------------ rappel atteignable */
const wilson = RA.wilson;
function lireJeux(fichiers) {
  const cuts = new Map(), parCleRail = new Map();
  for (const f of fichiers) for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    const o = JSON.parse(l);
    if (o.type === 'cut') cuts.set(o.partie + '/' + o.cut, { ...o, hyp: { left: [], right: [] }, rail: {} });
    else if (o.type === 'rail') cuts.get(o.partie + '/' + o.cut).rail[o.rail] = o;
    else if (o.type === 'hyp') cuts.get(o.partie + '/' + o.cut).hyp[o.rail].push(o);
  }
  return [...cuts.values()];
}
/* Écart minimal (mm) entre la pose finale d'un rail et les hypothèses retenues par `filtre`. */
function meilleurEcart(c, s, filtre) {
  let best = Infinity;
  for (const h of c.hyp[s]) if (h.etiquette && filtre(h) && h.etiquette.ecartMm < best) best = h.etiquette.ecartMm;
  return best;
}
const ZONES = ['pn', 'adv', 'abords', 'liste', 'hors'];
/* Un ensemble d'origines S : sur chaque rail, « ne rien faire » (H0) est toujours possible, les hypothèses de S s'y ajoutent. Un cut est atteint à
 * `seuil` mm si chacun de ses deux rails a, dans H0 + S, une hypothèse à `seuil` au plus. `hauteur` : 'sans' | 'avec' | 'les-deux'. */
/* `prefixes` : sous-origines par préfixe (H6 : « h6-lot », « h6-humain », « -rail »…) ; `lot` : usage lot, une hypothèse qui ne vient QUE de voisins
 * humains (H4 « voisins-humains », H6 « h6-humain-… ») est retirée, comme dans gcv2-apprendre. */
const origineAuLot = (h, o) => o === 'H4' ? h.sousOrigines.includes('voisins-lot') : o === 'H6' ? h.sousOrigines.some(x => x.startsWith('h6-lot-')) : true;
function filtre({ origines = null, sous = null, prefixes = null, hauteur = 'les-deux', avecH0 = true, lot = false }) {
  return h => {
    if (!(hauteur === 'les-deux' || (hauteur === 'avec') === h.hauteur)) return false;
    const os = lot ? h.origines.filter(o => origineAuLot(h, o)) : h.origines;
    const ss = lot ? h.sousOrigines.filter(x => x !== 'voisins-humains' && !x.startsWith('h6-humain-')) : h.sousOrigines;
    return (avecH0 && os.includes('H0')) || !!(origines && os.some(o => origines.includes(o))) || !!(sous && ss.some(x => sous.includes(x)))
      || !!(prefixes && ss.some(x => prefixes.some(p => x.includes(p))));
  };
}
/* Un cut est atteint à `seuil` mm si chacun de ses deux rails a une hypothèse à `seuil` au plus (paire) ; au moins un rail : un seul suffit. */
function atteint(c, f, seuil, mode = 'paire') {
  const a = SIDES.map(s => c.etiquette.mic && c.etiquette.mic[s] ? meilleurEcart(c, s, f) <= seuil : null);
  if (a.some(x => x === null)) return null;
  return mode === 'paire' ? a.every(Boolean) : a.some(Boolean);
}
const ENSEMBLES = Object.freeze([
  ['H0 seule (ne rien faire)', { origines: [], hauteur: 'sans' }],
  ['H0 + H1 (A* du moteur)', { origines: ['H1'], hauteur: 'sans' }],
  ['H0 + H2 (réservoir)', { origines: ['H2'], hauteur: 'sans' }],
  ['H0 + H2 compétitives', { sous: ['comp', 'comp-strong'], hauteur: 'sans' }],
  ['H0 + H2 STRONG écartées', { sous: ['strong-ecartee'], hauteur: 'sans' }],
  ['H0 + H3 (chaîne, voie prédite)', { origines: ['H3'], hauteur: 'sans' }],
  ['H0 + H4 (voisins sûrs)', { origines: ['H4'], hauteur: 'sans' }],
  ['H0 + H4 voisins du lot seuls', { sous: ['voisins-lot'], hauteur: 'sans' }],
  ['H0 + H5 (rail complété par l\'écartement médian)', { origines: ['H5'], hauteur: 'sans' }],
  ['H0 + H1 + H2 compétitives', { origines: ['H1'], sous: ['comp', 'comp-strong'], hauteur: 'sans' }],
  ['H0 + H1 + H2', { origines: ['H1', 'H2'], hauteur: 'sans' }],
  ['H0 à H3', { origines: ['H1', 'H2', 'H3'], hauteur: 'sans' }],
  ['H0 à H4 (sans hauteur)', { origines: ['H1', 'H2', 'H3', 'H4'], hauteur: 'sans' }],
  ['H0 à H5 (sans hauteur)', { origines: ORIGINES_G1A, hauteur: 'sans' }],
  ['H0 à H5, avec et sans hauteur', { origines: ORIGINES_G1A, hauteur: 'les-deux' }],
  ['H0 + H6 (voie décalée)', { origines: ['H6'], hauteur: 'sans' }],
  ['H0 + H6 voisins du lot seuls', { prefixes: ['h6-lot-'], hauteur: 'sans' }],
  ['H0 + H6 voisin le plus proche', { prefixes: ['-proche-'], hauteur: 'sans' }],
  ['H0 + H6 médiane des voisins', { prefixes: ['-mediane-'], hauteur: 'sans' }],
  ['H0 + H6 rail par rail', { prefixes: ['-rail'], hauteur: 'sans' }],
  ['H0 + H6 même décalage aux deux rails', { prefixes: ['-paire'], hauteur: 'sans' }],
  ['H0 à H6 (sans hauteur)', { origines: ORIGINES, hauteur: 'sans' }],
  ['H0 à H6, avec et sans hauteur', { origines: ORIGINES, hauteur: 'les-deux' }],
  ['usage lot : H0 à H5 sans voisins humains', { origines: ORIGINES_G1A, hauteur: 'les-deux', lot: true }],
  ['usage lot : H0 à H6 sans voisins humains', { origines: ORIGINES, hauteur: 'les-deux', lot: true }],
]);
const filtreEnsemble = filtre;
function rappel(jeux, { selections = {} } = {}) {
  const cuts = jeux.filter(c => c.etat === 'calcule' && c.nHyp && c.etiquette.mic && c.etiquette.mic.left && c.etiquette.mic.right);
  const sansNuage = jeux.filter(c => !c.nHyp && c.etiquette.mic && c.etiquette.mic.left && c.etiquette.mic.right);
  const comptes = (liste, seuilGrosse) => liste.filter(c => c.etiquette.micMaxMm > seuilGrosse);
  const ligne = (liste, f, seuil, mode = 'paire') => {
    const ok = liste.map(c => atteint(c, f, seuil, mode)).filter(x => x !== null);
    const k = ok.filter(Boolean).length;
    return { n: ok.length, k, part: ok.length ? k / ok.length : null, wilson: ok.length ? wilson(k, ok.length) : null };
  };
  const tout = () => true;
  const out = { format: FORMAT_RAPPEL, parties: [...new Set(jeux.map(c => c.partie))].sort(), cuts: jeux.length, jugeables: cuts.length, sansNuageAvecReference: sansNuage.length, seuilsMm: SEUILS_MM };
  out.comptes = { grosses: comptes(cuts, 10).length, plus5: comptes(cuts, 5).length };
  /* Sans nuage (l'Écho l'a purgé, ou le cut n'a pas de capture exploitable) : hors de la porte, comptés à part. */
  out.sansNuage = { cuts: sansNuage.length, grosses: comptes(sansNuage, 10).length, plus5: comptes(sansNuage, 5).length,
    parPartie: Object.fromEntries([...new Set(sansNuage.map(c => c.partie))].sort().map(p => [p, comptes(sansNuage.filter(c => c.partie === p), 10).length])) };
  const familles = { 'plus-de-10-mm': comptes(cuts, 10), 'plus-de-5-mm': comptes(cuts, 5) };
  out.global = {};
  for (const [nom, liste] of Object.entries(familles)) {
    out.global[nom] = { n: liste.length };
    for (const mode of ['paire', 'un-rail']) out.global[nom][mode] = { a10: ligne(liste, tout, 10, mode), a5: ligne(liste, tout, 5, mode) };
  }
  /* Chiffre BRUT : les corrections sans nuage (perdues pour de bon) restent au dénominateur, comme des échecs. La porte se lit sur les cuts avec nuage (`global`). */
  out.brut = {};
  for (const [nom, liste] of Object.entries(familles)) {
    const perdues = comptes(sansNuage, nom === 'plus-de-10-mm' ? 10 : 5).length, r = ligne(liste, tout, 10), r5 = ligne(liste, tout, 5), n = r.n + perdues;
    out.brut[nom] = { avecNuage: r.n, sansNuage: perdues, a10: { n, k: r.k, part: n ? r.k / n : null }, a5: { n, k: r5.k, part: n ? r5.k / n : null } };
  }
  out.parZone = {};
  for (const z of ZONES) {
    out.parZone[z] = {};
    for (const [nom, liste] of Object.entries(familles)) {
      const l = liste.filter(c => c.zone === z);
      out.parZone[z][nom] = { n: l.length, paire: { a10: ligne(l, tout, 10), a5: ligne(l, tout, 5) }, unRail: { a10: ligne(l, tout, 10, 'un-rail'), a5: ligne(l, tout, 5, 'un-rail') } };
    }
  }
  /* Par ensemble d'origines, sur les grosses corrections (> 10 mm) et sur les > 5 mm : global et par zone. */
  out.parOrigine = {};
  for (const [nom, e] of ENSEMBLES) {
    const f = filtreEnsemble(e);
    out.parOrigine[nom] = {};
    for (const [fam, liste] of Object.entries(familles)) {
      out.parOrigine[nom][fam] = { global: { a10: ligne(liste, f, 10), a5: ligne(liste, f, 5) }, parZone: Object.fromEntries(ZONES.map(z => [z, { a10: ligne(liste.filter(c => c.zone === z), f, 10), a5: ligne(liste.filter(c => c.zone === z), f, 5) }])) };
    }
  }
  /* Apport marginal : toutes origines contre toutes sauf une (ou sauf la hauteur). */
  const sans = { 'sans H1': h => tout(h) && !(h.origines.length === 1 && h.origines[0] === 'H1'),
    'sans H2': h => !(h.origines.length === 1 && h.origines[0] === 'H2'), 'sans H2 STRONG écartées': h => !(h.origines.length === 1 && h.origines[0] === 'H2' && h.sousOrigines.every(x => x === 'strong-ecartee')),
    'sans H5': h => !(h.origines.length === 1 && h.origines[0] === 'H5'),
    'sans H3': h => !(h.origines.length === 1 && h.origines[0] === 'H3'), 'sans H4': h => !(h.origines.length === 1 && h.origines[0] === 'H4'),
    'sans H6': h => !(h.origines.length === 1 && h.origines[0] === 'H6'),
    'sans hauteur apprise': h => !h.hauteur };
  out.apportMarginal = {};
  for (const [nom, liste] of Object.entries(familles)) {
    out.apportMarginal[nom] = {};
    const base = ligne(liste, tout, 10);
    for (const [k, f] of Object.entries(sans)) { const r = ligne(liste, f, 10); out.apportMarginal[nom][k] = { sans: r, apport: base.k - r.k, base }; }
  }
  /* Abstentions du moteur (rail non candidat ou paire hors contrat) parmi les grosses corrections : part rattrapée. */
  const abst = cuts.filter(c => c.moteur && c.moteur.abstenu), grAbst = comptes(abst, 10);
  out.abstentions = { cuts: abst.length, grosses: grAbst.length, grossesParMotif: {} };
  const motif = c => { const m = SIDES.map(s => c.rail[s] && c.rail[s].statut !== 'candidate' ? (c.rail[s].motif || c.rail[s].statut) : null).filter(Boolean); return m.length ? [...new Set(m)].sort().join('+') : (c.moteur && c.moteur.ecartementRejete ? 'gauge-out-of-contract' : 'autre'); };
  for (const c of grAbst) { const m = motif(c); out.abstentions.grossesParMotif[m] = (out.abstentions.grossesParMotif[m] || 0) + 1; }
  out.abstentions.rattrapees = {};
  for (const [nom, e] of [['toutes origines, avec et sans hauteur', { origines: ORIGINES, hauteur: 'les-deux' }], ['H0 + H1 (le moteur), sans hauteur', { origines: ['H1'], hauteur: 'sans' }], ['H0 + H2', { origines: ['H2'], hauteur: 'sans' }],
    ['H0 + H2 STRONG écartées', { sous: ['strong-ecartee'], hauteur: 'sans' }], ['H0 + H3', { origines: ['H3'], hauteur: 'sans' }], ['H0 + H4', { origines: ['H4'], hauteur: 'sans' }], ['H0 + H5', { origines: ['H5'], hauteur: 'sans' }]])
    out.abstentions.rattrapees[nom] = { a10: ligne(grAbst, filtreEnsemble(e), 10), a5: ligne(grAbst, filtreEnsemble(e), 5) };
  out.abstentions.parZone = Object.fromEntries(ZONES.map(z => { const l = grAbst.filter(c => c.zone === z); return [z, { n: l.length, toutes: ligne(l, tout, 10), h2: ligne(l, filtreEnsemble({ origines: ['H2'], hauteur: 'sans' }), 10), moteur: ligne(l, filtreEnsemble({ origines: ['H1'], hauteur: 'sans' }), 10) }]; }));
  /* Plafond de 12 : grosses corrections pour lesquelles une cellule écartée par le plafond aurait été à 10 mm. */
  let tronquesAide = 0, tronquesCuts = 0;
  for (const c of comptes(cuts, 10)) {
    if (!c.tronquesPoses) continue; tronquesCuts++;
    const proche = SIDES.every(s => { const m = c.etiquette.mic[s]; return meilleurEcart(c, s, tout) <= 10 || (c.tronquesPoses[s] || []).some(p => norme(moins(p, m)) <= 10); });
    if (proche && !atteint(c, tout, 10)) tronquesAide++;
  }
  out.plafond = { grossesAvecCellulesEcartees: tronquesCuts, rattrapeesParLesCellulesEcartees: tronquesAide };
  /* Même relevé pour la décision du lot en premier passage (la mesure de RM-4, « abstention seul ») : le cut est différé par le lot. */
  const dif = cuts.filter(c => c.moteur && c.moteur.differe), grDif = comptes(dif, 10);
  out.differesSeul = { cuts: dif.length, grosses: grDif.length, rattrapees: Object.fromEntries([['toutes origines, avec et sans hauteur', { origines: ORIGINES, hauteur: 'les-deux' }], ['H0 + H1 (le moteur)', { origines: ['H1'], hauteur: 'sans' }], ['H0 + H2', { origines: ['H2'], hauteur: 'sans' }], ['H0 + H3', { origines: ['H3'], hauteur: 'sans' }], ['H0 + H4', { origines: ['H4'], hauteur: 'sans' }], ['H0 + H5', { origines: ['H5'], hauteur: 'sans' }]].map(([n, e]) => [n, { a10: ligne(grDif, filtreEnsemble(e), 10), a5: ligne(grDif, filtreEnsemble(e), 5) }])) };
  /* Les grosses corrections hors d'atteinte (paire à 10 mm, toutes origines) : taille, axe dominant du rail manquant, zone, rôle, moteur abstenu. */
  const manq = comptes(cuts, 10).filter(c => atteint(c, tout, 10) === false);
  const tranche = mm => mm <= 25 ? '10-25' : mm <= 50 ? '25-50' : '>50';
  const axeDe = m => { const a = [Math.abs(m[0]), Math.abs(m[1]), Math.abs(m[2])]; return a[1] >= a[2] && a[1] >= a[0] ? 'lateral' : a[2] >= a[0] ? 'vertical' : 'longitudinal'; };
  const compte = (liste, f) => { const o = {}; for (const x of liste) { const k = f(x); o[k] = (o[k] || 0) + 1; } return o; };
  const railsManquants = manq.flatMap(c => SIDES.filter(s => meilleurEcart(c, s, tout) > 10).map(s => ({ c, s, mic: c.etiquette.mic[s], meilleur: meilleurEcart(c, s, tout) })));
  out.manquees = { cuts: manq.length, parTaille: compte(manq, c => tranche(c.etiquette.micMaxMm)), parZone: compte(manq, c => c.zone), parRole: compte(manq, c => c.role), moteurAbstenu: compte(manq, c => c.moteur.abstenu ? 'abstenu' : 'a propose'),
    railsManquants: railsManquants.length, parAxe: compte(railsManquants, x => axeDe(x.mic)), parTailleRail: compte(railsManquants, x => tranche(norme(x.mic))),
    meilleurEcartMedianMm: med(railsManquants.map(x => x.meilleur)), parSansHypotheseAutreQueH0: railsManquants.filter(x => !(x.c.hyp[x.s].some(h => !h.origines.includes('H0') || h.origines.length > 1))).length };
  /* Densité et niveau de hasard : combien d'hypothèses par rail, et quelle part des grosses corrections serait « atteinte » avec les hypothèses d'un
   * AUTRE cut de la même partie (décalage de rang `k` parmi les cuts jugeables) : si cette part est élevée, le rappel mesure la densité de la liste,
   * pas sa justesse. */
  const bases = []; for (const c of cuts) for (const s of SIDES) bases.push(c.hyp[s].filter(h => !h.hauteur).length);
  out.densite = { posesParRail: { moyenne: bases.length ? bases.reduce((a, b) => a + b, 0) / bases.length : null, mediane: med(bases), max: Math.max(0, ...bases) }, railsCoupesAuPlafond: bases.filter(n => n >= MAX_HYP).length, rails: bases.length };
  const hasard = {};
  for (const k of [3, 7, 11]) {
    let n = 0, ok = 0;
    for (const p of out.parties) {
      const j = cuts.filter(c => c.partie === p);
      if (j.length <= k) continue;
      j.forEach((c, i) => {
        if (!(c.etiquette.micMaxMm > 10)) return;
        const autre = j[(i + k) % j.length];
        n++;
        if (SIDES.every(s => autre.hyp[s].some(h => h.etiquette && Math.hypot(...h.decal.map((v, m) => v - c.etiquette.mic[s][m])) <= 10))) ok++;
      });
    }
    hasard['decalage ' + k] = { n, k: ok, part: n ? ok / n : null };
  }
  out.hasard = hasard;
  /* Parties, rôles. */
  out.parPartie = {};
  for (const p of out.parties) {
    const l = jeux.filter(c => c.partie === p), j = cuts.filter(c => c.partie === p), g = comptes(j, 10);
    out.parPartie[p] = { cutsVisites: l.length, avecReference: l.filter(c => c.etiquette.mic).length, jugeables: j.length, sansNuageAvecReference: sansNuage.filter(c => c.partie === p).length,
      grosses: g.length, plus5: comptes(j, 5).length, rappel10: ligne(g, tout, 10), rappel5: ligne(g, tout, 5),
      hypotheses: l.reduce((n, c) => n + c.hyp.left.length + c.hyp.right.length, 0), cutsAvecHypotheses: l.filter(c => c.hyp.left.length).length };
  }
  out.parRole = Object.fromEntries(['vert', 'rouge', 'differe'].map(r => [r, ligne(comptes(cuts.filter(c => c.role === r), 10), tout, 10)]));
  /* H6 : rappel AVANT (origines de G1-a, H0 à H5) et APRÈS (H0 à H6), avec et sans hauteur, dans les deux usages (relecture ; lot = sans voisins
   * humains), sur les grosses corrections : global, par zone, par partie, par rôle et sur les sélections nommées (`selections` : nom → ensemble de
   * « partie/cut »). */
  const fAv = filtreEnsemble({ origines: ORIGINES_G1A }), fAp = filtreEnsemble({ origines: ORIGINES });
  const fAvL = filtreEnsemble({ origines: ORIGINES_G1A, lot: true }), fApL = filtreEnsemble({ origines: ORIGINES, lot: true });
  const aa = l => ({ n: l.length, avant: ligne(l, fAv, 10), apres: ligne(l, fAp, 10), avant5: ligne(l, fAv, 5), apres5: ligne(l, fAp, 5), lotAvant: ligne(l, fAvL, 10), lotApres: ligne(l, fApL, 10) });
  const gr = comptes(cuts, 10);
  out.avantApres = { global: aa(gr), parZone: Object.fromEntries(ZONES.map(z => [z, aa(gr.filter(c => c.zone === z))])),
    parPartie: Object.fromEntries(out.parties.map(p => [p, aa(gr.filter(c => c.partie === p))])),
    parRole: Object.fromEntries(['vert', 'rouge', 'differe'].map(r => [r, aa(gr.filter(c => c.role === r))])),
    selections: Object.fromEntries(Object.entries(selections).map(([nom, ens]) => {
      const l = cuts.filter(c => ens.has(c.partie + '/' + c.cut)), g = comptes(l, 10);
      return [nom, { cutsJugeables: l.length, grosses: aa(g), toutes: aa(l), absents: [...ens].filter(k => !l.some(c => c.partie + '/' + c.cut === k)).length }];
    })) };
  return out;
}
/* « 2:1:293-459,2:1:625 » → ensemble de « 2:1/293 »… */
function lireSelection(texte) {
  const out = new Set();
  for (const morceau of String(texte).split(',').map(x => x.trim()).filter(Boolean)) {
    const m = /^(\d+:\d+):(\d+)(?:-(\d+))?$/.exec(morceau);
    if (!m) throw Error(`sélection illisible : ${morceau} (P:N:a-b)`);
    const a = Number(m[2]), b = m[3] ? Number(m[3]) : a;
    for (let c = a; c <= b; c++) out.add(m[1] + '/' + c);
  }
  return out;
}

/* ------------------------------------------------------------------ texte */
const fr = (v, d = 1) => fini(v) ? v.toFixed(d).replace('.', ',') : '—';
const pc = r => r && r.n ? `${fr(100 * r.part, 1)} % (${r.k}/${r.n})` : '—';
function texte(R) {
  const L1 = [];
  L1.push(`Rappel atteignable — ${R.parties.join(', ')} : ${R.cuts} cuts visités, ${R.jugeables} jugeables (référence et nuage), ${R.comptes.grosses} corrections > 10 mm, ${R.comptes.plus5} > 5 mm.`);
  for (const f of ['plus-de-10-mm', 'plus-de-5-mm']) {
    const g = R.global[f];
    L1.push(`${f} (n = ${g.n}) : paire à 10 mm ${pc(g.paire.a10)}, à 5 mm ${pc(g.paire.a5)} ; au moins un rail à 10 mm ${pc(g['un-rail'].a10)}`);
  }
  for (const f of ['plus-de-10-mm', 'plus-de-5-mm']) { const x = R.brut[f]; L1.push(`${f} BRUT, cuts sans nuage comptés comme échecs (${x.sansNuage} perdues pour de bon) : à 10 mm ${pc(x.a10)}, à 5 mm ${pc(x.a5)}`); }
  for (const z of ZONES) { const x = R.parZone[z]['plus-de-10-mm']; L1.push(`  zone ${z} : n = ${x.n}, paire à 10 mm ${pc(x.paire.a10)}, à 5 mm ${pc(x.paire.a5)}`); }
  for (const [nom, v] of Object.entries(R.parOrigine)) L1.push(`  ${nom} : > 10 mm à 10 mm ${pc(v['plus-de-10-mm'].global.a10)}`);
  if (R.avantApres) {
    const t = (nom, x) => `  ${nom} (n = ${x.n}) : avant H6 ${pc(x.avant)}, après ${pc(x.apres)} ; usage lot : avant ${pc(x.lotAvant)}, après ${pc(x.lotApres)} ; à 5 mm : ${pc(x.avant5)} → ${pc(x.apres5)}`;
    L1.push('H6, rappel à 10 mm des > 10 mm, avant et après :', t('global', R.avantApres.global));
    for (const z of ZONES) L1.push(t('zone ' + z, R.avantApres.parZone[z]));
    for (const [p, x] of Object.entries(R.avantApres.parPartie)) L1.push(t('partie ' + p, x));
    for (const [r, x] of Object.entries(R.avantApres.parRole)) L1.push(t('rôle ' + r, x));
    for (const [nom, x] of Object.entries(R.avantApres.selections)) L1.push(t(`sélection ${nom} (${x.cutsJugeables} cuts jugeables, ${x.absents} sans jeu)`, x.grosses));
  }
  return L1.join('\n');
}

/* ------------------------------------------------------------------ ligne de commande */
function args(argv) {
  const o = { mode: argv[0], echo: [], journal: [], jeux: [], sansLot: false, jugerReservee: false, selections: {} };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], val = () => { const v = argv[++i]; if (v === undefined) throw Error('valeur manquante après ' + k); return v; };
    if (k === '--partie') { const [p, n] = val().split(':').map(Number); if (!Number.isInteger(p) || !Number.isInteger(n)) throw Error('--partie PROJET:PARTIE'); o.projet = p; o.partie = n; }
    else if (k === '--echo') o.echo.push(val()); else if (k === '--journal') o.journal.push(val()); else if (k === '--sans-lot') o.sansLot = true;
    else if (k === '--sortie') o.sortie = val(); else if (k === '--sortie-lot') o.sortieLot = val(); else if (k === '--jeu') o.jeux.push(val()); else if (k === '--json') o.json = val();
    else if (k === '--juger-partie-reservee') o.jugerReservee = true;
    else if (k === '--selection') { const v = val(), i = v.indexOf('='); if (i < 1) throw Error('--selection NOM=P:N:a-b,…'); o.selections[v.slice(0, i)] = lireSelection(v.slice(i + 1)); }
    else throw Error('argument inconnu : ' + k);
  }
  return o;
}
/* Contrôle du manifeste : un jeu d'apprentissage ne lit que des parties d'apprentissage ; un jeu de jugement (option) que des parties réservées. */
function controlerManifeste({ projet, partie, jugerReservee }) {
  const m = Manifeste.lire(), d = { projet, partie };
  const { avis } = Manifeste.controler(m, [d], { outil: 'gcv2-jeu', jugerReservee });
  const reservee = Manifeste.statut(m, projet, partie) === 'reservee';
  if (jugerReservee && !reservee) throw Error(`la partie ${partie} du projet ${projet} est en apprentissage : --juger-partie-reservee construit un jeu de jugement, séparé, de parties réservées seulement.`);
  return { avis, jeu: jugerReservee ? 'jugement' : 'apprentissage', temoin: Manifeste.estTemoin(m, projet, partie) };
}

module.exports = { FORMAT, FORMAT_RAPPEL, MAX_HYP, DOUBLON_MM, SEUILS_MM, ORIGINES, ORIGINES_G1A, H6, VERSION_H6, moteurAvecReservoir, posesVerifiees, voisinsSursA, hypothesesDuCut, etiqueter, classeDe,
  decalageDepuisEsv, esvDepuisDeplacement, avecRupture, voisinsH6, decalagesH6, mesuresTranslatees, creerObservateur, lignesDuJeu, construire, lireJeux, rappel, lireSelection, filtre, texte, controlerManifeste, args };

if (require.main === module) {
  try {
    const a = args(process.argv.slice(2));
    if (a.mode === 'construire') {
      if (!a.partie || !a.echo.length || !a.sortie) throw Error('construire --partie P:N --echo DOSSIER [--echo …] (--journal J.json | --sans-lot) --sortie JEU.jsonl [--juger-partie-reservee]');
      const c = controlerManifeste(a);
      if (c.avis) console.error(c.avis);
      const t0 = Date.now(), r = construire({ projet: a.projet, partie: a.partie, echo: a.echo, journaux: a.journal, sansLot: a.sansLot, jeu: c.jeu, journal: m => console.error(m) });
      fs.mkdirSync(path.dirname(path.resolve(a.sortie)), { recursive: true });
      fs.writeFileSync(a.sortie, r.lignes.map(l => JSON.stringify(l)).join('\n') + '\n');
      if (a.sortieLot) fs.writeFileSync(a.sortieLot, r.lignesLot.map(l => JSON.stringify(l)).join('\n') + '\n');
      const n = t => r.lignes.filter(l => l.type === t).length;
      console.log(`partie ${a.projet}:${a.partie} (${c.jeu}) : ${n('cut')} cuts, ${r.etat.calcules} calculés, ${n('hyp')} hypothèses, erreurs ${r.etat.erreurs}, écarts de la copie du moteur ${r.etat.ecartsMoteur}, ${Math.round((Date.now() - t0) / 1000)} s`);
    } else if (a.mode === 'rappel') {
      if (!a.jeux.length) throw Error('rappel --jeu JEU.jsonl [--jeu …] [--json R.json]');
      const R = rappel(lireJeux(a.jeux), { selections: a.selections });
      if (a.json) fs.writeFileSync(a.json, JSON.stringify(R, null, 1));
      console.log(texte(R));
    } else if (a.mode === 'essai') {
      console.log('voir tests/gcv2-jeu.test.cjs');
    } else throw Error('mode : construire | rappel');
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
