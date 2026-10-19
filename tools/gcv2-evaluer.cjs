#!/usr/bin/env node
'use strict';
/*
 * gcv2-evaluer.cjs — G1-c-prep : l'ÉVALUATEUR UNIQUE de la GCV2 au niveau exigé par l'audit externe (audit externe du 19 octobre, dossier audit/chantiers/ du dépôt pilote ; D-210 ;
 * fiches/PROTOCOLE_G1C.md ; fiches/G1C_PREPARATION.md). Étude HORS LIGNE : rien n'est changé à l'extension, aucune action dans ESV. Node pur.
 *
 *   node tools/gcv2-evaluer.cjs controle --jeu J.jsonl … --cas C.jsonl … [--table T.json …] [--json C.json]      (M1 : la règle prudente exacte contre D-190)
 *   node tools/gcv2-evaluer.cjs valider  --jeu J.jsonl … --cas C.jsonl … --usage relecture|lot [--lambdas 3,30,300 --lambda-temoin 30] [--variante V1] [--sortie E.json]
 *   node tools/gcv2-evaluer.cjs rapport  --json E.json
 *   node tools/gcv2-evaluer.cjs registre --jeu J.jsonl … --cas C.jsonl …                                      (F6, M5 : le parcours de la population)
 *   node tools/gcv2-evaluer.cjs essai
 *
 * Ce que l'outil fait, dans un seul évaluateur, cut par cut :
 *  1. RÉFÉRENCE EXACTE (M1). La règle prudente n'est plus un substitut rejoué sur le jeu (`reglePrudente` de gcv2-apprendre : 38 actions, 27 justes) : on appelle les vraies
 *     fonctions de tools/relecture-autonome.cjs (`lignes`, `agit`, `regleDuReglage`) sur les `cas` de l'extraction, avec les réglages figés du dépôt. Les cuts sont
 *     les mêmes que ceux du jeu (clé : partie, cut). Contrôle sur 1:14, 1:15, 1:16 : 40 actions, 29 justes, 2 abîmés (D-190).
 *  2. PORTE UNIQUE (M2, M3 ; fiches/PROTOCOLE_G1C.md § 3), écrite et exécutable : `porteUnique`. Issues : succès, échec, non démontré.
 *  3. λ IMBRIQUÉ (V3) et UNITÉ (V4) : validation croisée de gcv2-apprendre avec λ choisi dans chaque pli extérieur ; lectures par partie, moyenne des parties, cumul des cuts.
 *  4. REGISTRE de population (F6, M5) : visités → avec référence (explicite / implicite) → avec nuage → exemples retenus → actions ; SKIP ; 740 contre 741.
 *
 * DÉFINITIONS (M1 : les catégories se recouvrent, elles ne s'additionnent pas). Pour un cut : `mic` = correction de l'opérateur expert (pire des deux rails, mm, valeur exacte
 * de l'extraction) ; une méthode « agit » (elle pose) ou non ; `e` = écart de sa pose à celle de Mic (pire des deux rails) ; `lat` = déplacement latéral maximal.
 *   juste        agit, Mic > 10 mm, e ≤ 10 mm                      abîmé        agit, Mic ≤ 5 mm, e > 10 mm
 *   erreur       agit, e > 10 mm (un abîmé est toujours une erreur)  mauvaise voie  agit, e > 50 mm ou lat > 45 mm (une mauvaise voie est presque toujours une erreur)
 *   erreur finale > 10 mm, ACTION OU NON : e si la méthode agit, sinon l'écart de la pose de départ (= Mic) ; elle compte aussi les grosses corrections laissées faux.
 * Un juste n'est jamais une erreur ; un abîmé est toujours une erreur ; une mauvaise voie est une erreur sauf déplacement latéral seul. `recouvrements` les dénombre.
 */
const fs = require('node:fs'), path = require('node:path');
const A = require('./gcv2-apprendre.cjs');

const FORMAT_EVAL = 'ariane-gcv2-evaluation-v1';
const FICHIER_REGLAGES = path.join(__dirname, '..', 'datasets', 'relecture-reglages-proposes.json');
/* La porte unique : mêmes nombres que fiches/PROTOCOLE_G1C.md § 3. */
const PORTE = Object.freeze({ mauvaiseVoieMax: 0, erreurMax: 0.09, juste10: A.SEUILS.juste10, mauvaiseVoieMm: A.SEUILS.mauvaiseVoie, lateralMm: A.GARDES.lateralMaxMm, z: 1.959964 });
/* Seuils de durée d'une visite sans action (F6) : G0 dit 0,6 s (et le compteur l'applique) ; la jointure Écho-Orbite, qui a fabriqué les références implicites du jeu, 0,8 s. */
const SEUIL_VISITE_G0_S = 0.6, SEUIL_VISITE_JEU_S = 0.8;
/* Contrôle D-190 : 3 parties (1:14, 1:15, 1:16), règle prudente figée. */
/* Chiffres publiés en G1-b (fiches/G1B_APPRENTISSAGE.md, validation croisée à λ = 30, règle prudente SUBSTITUÉE, V1 sur 2 411 cuts) : le point de départ de l'écart du λ imbriqué. */
const PUBLIE_G1B = Object.freeze({ relecture: Object.freeze({ agit: 257, justes: 128, abimes: 2, mauvaiseVoie: 0, erreurs: 9, taux: 9 / 257 }), lot: Object.freeze({ agit: 258, justes: 123, abimes: 2, mauvaiseVoie: 0, erreurs: 11, taux: 11 / 258 }) });
const ATTENDU_D190 = Object.freeze({ visites: 528, micSup10: 35, agit: 40, justes: 29, abimes: 2, mauvaiseVoie: 0, laisseFaux: 6, abstentions: 87, erreurs: 2 });

/* Référence INCERTAINE (D-211) : la pose de départ d'une visite de l'Écho est déjà déplacée par rapport à la ligne de la liste d'ESV du départ de la partie (Mic avait corrigé dans une
 * autre fenêtre, l'Écho n'a vu que la revisite). Le cut ne vaut pas « correction nulle » : il est classé « incertaine » au registre et exclu des exemples. Signal d'extraction :
 * `mic.ref === 'incertaine'` dans le cas (et `reference: 'incertaine'` dans le jeu). Détection : écart entre la pose de départ de la visite et la liste d'ESV du départ de partie. */
const SEUIL_REFERENCE_INCERTAINE_MM = 0.5;   // même seuil que « rail déplacé » de la jointure Écho-Orbite (DEPLACEMENT_MODIFIE_MM)
const fini = v => typeof v === 'number' && Number.isFinite(v);
const arrondi = (v, d = 1) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const norme = v => Math.hypot(v[0], v[1], v[2]);
const mediane = a => { const s = a.filter(fini).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const moyenne = a => { const s = a.filter(fini); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null; };
const cle = r => `${r.partie}|${r.cut}`;
const pire = decal => Math.max(Math.abs(decal[1]), Math.abs(decal[2]));
const projetDe = partie => String(partie).split(':')[0];

/* ------------------------------------------------------------------ catégories d'un résultat de cut */
const agit = r => r.etat === 'agit';
const estMauvaiseVoie = r => agit(r) && (r.e > PORTE.mauvaiseVoieMm || r.lat > PORTE.lateralMm);
const estJuste = r => agit(r) && r.mic > PORTE.juste10 && r.e <= PORTE.juste10;
const estAbime = r => agit(r) && r.mic <= A.SEUILS.juste5 && r.e > PORTE.juste10;
const estErreur = r => agit(r) && r.e > PORTE.juste10;
/* Erreur finale d'un cut, action ou non : la pose de la méthode si elle agit, sinon la pose de départ (son écart à Mic est Mic). */
const erreurFinale = r => agit(r) ? r.e : r.mic;
const finaleSup10 = r => erreurFinale(r) > PORTE.juste10;

/* ------------------------------------------------------------------ Wilson et effectif minimal */
const wilsonHaut = (k, n) => A.wilson(k, n, PORTE.z).haut;
/* Plus petit nombre d'actions sans aucune erreur pour que la borne haute de Wilson à 95 % tombe à `erreurMax` ou moins (39 pour 9 %, repère de l'audit M3). */
function effectifMinimum(erreurMax = PORTE.erreurMax) {
  for (let n = 1; n < 100000; n++) if (wilsonHaut(0, n) <= erreurMax) return n;
  return Infinity;
}

/* Écart (mm) entre la pose de départ d'une visite et la ligne de la liste d'ESV du départ de partie, pire des deux rails ; `poses` : { left: [x, y, z], right: [x, y, z] } en mm, dans le
 * même repère (le chantier d'extraction convertit). null si une des deux poses manque. Incertaine si l'écart dépasse `seuilMm`. */
function detecterReferenceIncertaine({ poseDepartVisite, poseListeDebut, seuilMm = SEUIL_REFERENCE_INCERTAINE_MM }) {
  const d = s => { const a = poseDepartVisite && poseDepartVisite[s], b = poseListeDebut && poseListeDebut[s]; return Array.isArray(a) && Array.isArray(b) && a.length >= 3 && b.length >= 3 ? norme([a[0] - b[0], a[1] - b[1], a[2] - b[2]]) : null; };
  const l = d('left'), r = d('right');
  if (l === null || r === null) return { incertaine: null, ecartMm: null, raison: 'liste d\'ESV du départ de partie ou pose de départ indisponible : signal non évaluable' };
  const e = Math.max(l, r); return { incertaine: e > seuilMm, ecartMm: e, seuilMm };
}

/* ================================================================== 1. RÉFÉRENCE EXACTE */
const reglagesDuDepot = (fichier = FICHIER_REGLAGES) => JSON.parse(fs.readFileSync(fichier, 'utf8'));
const roleDeGenre = g => g === 'pose' ? 'rouge' : g === 'differe' ? 'differe' : 'vert';
const genreDeRole = r => r === 'rouge' ? 'pose' : r === 'differe' ? 'differe' : 'vert';
/* Table minimale d'une partie : le lot (cuts rouges et différés) lu dans le jeu. Elle suffit à `lignes` pour le genre des cuts et la médiane d'écartement (qui exclut le lot) ;
 * la zone de chaque cut est reprise du jeu, construit avec la vraie table. */
function tablePseudo(jeu) {
  const [projet, partie] = String(jeu.partie).split(':').map(Number);
  return { format: 'ariane-verts-table-v1', projet, partie, lot: jeu.cuts.filter(c => c.cut.role !== 'vert').map(c => ({ cut: c.cut.cut, differe: c.cut.role === 'differe' })), zonesPN: [], zonesADV: [], cuts: [] };
}
/* Mic exact d'un cas de l'extraction (pire des deux rails, mm, non arrondi). */
const micDuCas = c => c.mic && c.mic.ref && c.mic.rails ? Math.max(norme(c.mic.rails.left), norme(c.mic.rails.right)) : null;

/*
 * Rejoue la règle prudente figée AVEC LES VRAIES FONCTIONS de tools/relecture-autonome.cjs : `lignes` (mesures de chaque cut : écart, voie, écartement contre la médiane
 * de la partie), `regleDuReglage` (la règle lue dans datasets/relecture-reglages-proposes.json) et `agit`. Un résultat par cut mesurable (référence et nuage) :
 * { partie, cut, zone, role, mic, etat: 'agit' | 'laisse' | 'abstient', e, lat, ref, skip } — la décision de `bilan(…, zones actives)` de `juger`, cut par cut.
 *   jeu     jeu de gcv2-apprendre (`jeuDeLignes`), pour la zone et le rôle de chaque cut ; table : la vraie table de la partie si on l'a (contrôle D-190), sinon la table
 *   minimale du lot lue dans le jeu.
 */
function referenceExacte({ jeu, cas, reglages = reglagesDuDepot(), table = null }) {
  const RA = require('./relecture-autonome.cjs');
  /* une référence incertaine n'est pas une correction nulle : le cut est traité comme sans référence */
  cas = cas.map(c => c.mic && c.mic.ref === 'incertaine' ? { ...c, mic: { ref: null, raison: 'reference-incertaine' } } : c);
  const R = RA.regleDuReglage(reglages), partie = jeu ? jeu.partie : null;
  const designation = partie || `${cas[0].projet}:${cas[0].partie}`;
  const L = RA.lignes({ cas, table: table || tablePseudo(jeu), designation });
  const duJeu = jeu ? new Map(jeu.cuts.map(c => [c.cut.cut, c.cut])) : new Map(), duCas = new Map(cas.map(c => [c.cut, c]));
  const resultats = new Map(), lignes = [];
  let zonesDifferentes = 0;
  for (const l of L.lignes) {
    const j = duJeu.get(l.cut);
    if (j) { if (table) { if (j.zone !== l.zone) zonesDifferentes++; } else { l.zone = j.zone; l.genre = genreDeRole(j.role); } }
    if (!l.ref || l.etat !== 'calcule') continue;
    lignes.push(l);
    const v = l.var && l.var[R.regle.variante], c = duCas.get(l.cut);
    let etat = 'laisse', e = null, lat = null;
    if (!v || v.d == null) etat = 'abstient';
    else if (R.actifs.includes(l.zone) && RA.agit(l, R.regle)) { etat = 'agit'; e = v.e; lat = v.latMax; }
    resultats.set(l.cut, { partie: designation, cut: l.cut, zone: l.zone, role: roleDeGenre(l.genre), mic: l.mic, etat, e, lat, ref: c.mic.ref, skip: !!c.skipMic });
  }
  return { resultats, lignes, regle: R.regle, actifs: R.actifs, gMed: L.gMed, gMedJeu: jeu && fini(jeu.entete.gMedMm) ? jeu.entete.gMedMm : null, zonesDifferentes };
}
/* Fournisseur de référence pour `validationCroisee` : le résultat exact d'un cas du jeu, ou une erreur claire (jamais un repli silencieux sur le substitut). */
function fournisseurReference(refs) {
  return k => {
    const r = refs[k.partie] && refs[k.partie].resultats.get(k.cut);
    if (!r) throw Error(`référence exacte : le cut ${k.partie} ${k.cut} du jeu n'a pas de ligne mesurable dans les cas de l'extraction`);
    return r;
  };
}
/* Ajoute la référence humaine (explicite ou implicite) et le SKIP aux résultats d'une méthode, et remplace Mic par sa valeur exacte (le jeu l'arrondit à 0,01 mm : 10,0036 mm
 * y devient 10,0 mm et ne dépasse plus 10 mm — c'est l'écart de 741 contre 740 grosses corrections). */
function annoter(resultats, casParPartie) {
  return resultats.map(r => {
    const c = casParPartie[r.partie] && casParPartie[r.partie].get(r.cut);
    if (!c) return { ...r };
    const m = micDuCas(c);
    return { ...r, mic: fini(m) ? m : r.mic, ref: c.mic.ref, skip: !!c.skipMic };
  });
}

/* Compare deux ensembles de résultats cut par cut : décision et écart. */
function comparerCutParCut(a, b) {
  const mb = new Map(b.map(r => [cle(r), r])), out = { communs: 0, memeDecision: 0, differences: [], seulementA: [], seulementB: [] };
  for (const r of a) {
    const s = mb.get(cle(r));
    if (!s) { out.seulementA.push({ partie: r.partie, cut: r.cut }); continue; }
    out.communs++;
    if (r.etat === s.etat) out.memeDecision++;
    if (r.etat !== s.etat || (agit(r) && Math.abs(r.e - s.e) > 0.5)) out.differences.push({ partie: r.partie, cut: r.cut, zone: r.zone, a: { etat: r.etat, e: arrondi(r.e, 2) }, b: { etat: s.etat, e: arrondi(s.e, 2) }, mic: arrondi(r.mic, 2) });
  }
  const ma = new Set(a.map(cle)); for (const r of b) if (!ma.has(cle(r))) out.seulementB.push({ partie: r.partie, cut: r.cut });
  return out;
}

/* ------------------------------------------------------------------ contrôle D-190 */
/* Les trois conditions de la règle, pour un cut : écart ≥ X, déplacement latéral ≤ D, écartement à G de la médiane. */
function gardesDeLaRegle(regle, l) {
  const v = l.var[regle.variante];
  return { ecart: v.pire >= regle.X, lateral: v.latMax <= regle.D, ecartement: regle.G == null || (v.dg != null && v.dg <= regle.G) };
}
/*
 * Contrôle de la règle exacte contre D-190 (1:14, 1:15, 1:16 : 528 cuts, 40 actions, 29 justes, 2 abîmés). `parties` : [{ jeu?, cas, table }] avec la VRAIE table de chaque partie
 * (la sélection de D-190 : tous les cuts qui ne sont pas « hors »). Trois lectures du même jeu de cuts, comparées :
 *   reel      la fonction `bilan` de tools/relecture-autonome.cjs (les chiffres de D-190) ;
 *   mien      les mêmes cuts, comptés par l'évaluateur (`A.bilanDe` sur les résultats cut par cut) : doit être identique ;
 *   substitut la règle prudente rejouée par gcv2-apprendre sur le jeu (G1-b : 38 actions, 27 justes) : les cuts qui diffèrent sont listés avec leur cause.
 */
function controleD190({ parties, reglages = reglagesDuDepot(), attendu = ATTENDU_D190 }) {
  const RA = require('./relecture-autonome.cjs'), R = RA.regleDuReglage(reglages);
  const fnActifs = Object.assign(l => R.actifs.includes(l.zone) ? R.regle : null, { variante: R.regle.variante });
  const reels = [], miens = [], parPartie = [], ecarts = [], horsPopulation = [];
  let sub = [];
  for (const p of parties) {
    const ex = referenceExacte({ jeu: p.jeu || null, cas: p.cas, reglages, table: p.table });
    const sel = ex.lignes.filter(l => l.zone !== 'hors'), selCuts = new Set(sel.map(l => l.cut));
    reels.push(RA.bilan(sel, fnActifs));
    const rsel = [...ex.resultats.values()].filter(r => selCuts.has(r.cut));
    miens.push(A.bilanDe(rsel));
    const partie = rsel.length ? rsel[0].partie : '?';
    const ligne = { partie, mesurables: rsel.length, agit: rsel.filter(agit).length, gMedLigne: ex.gMed, gMedJeu: ex.gMedJeu, zonesDifferentes: ex.zonesDifferentes };
    if (p.jeu) {
      const ks = A.construireCas(p.jeu, 'relecture'), parCut = new Map(ks.map(k => [k.cut, k])), exParCut = new Map(rsel.map(r => [r.cut, r]));
      const subP = ks.filter(k => exParCut.has(k.cut)).map(k => A.reglePrudente(k));
      sub = sub.concat(subP);
      for (const r of rsel) if (!parCut.has(r.cut)) horsPopulation.push({ partie, cut: r.cut, zone: r.zone, mic: arrondi(r.mic, 2), etat: r.etat });
      ligne.horsPopulation = rsel.filter(r => !parCut.has(r.cut)).length;
      for (const s of subP) {
        const r = exParCut.get(s.cut);
        if (r.etat === s.etat && (!agit(r) || Math.abs(r.e - s.e) <= 0.5)) continue;
        const k = parCut.get(s.cut), l = ex.lignes.find(x => x.cut === s.cut), v = l.var[R.regle.variante], pose = A.poseChaineH(k);
        const e = gardesDeLaRegle(R.regle, l);
        let sg = null;
        if (pose) {
          const hl = k.rails.left.hyps[pose.i], hr = k.rails.right.hyps[pose.j], g = A.ecartementPaire(k, hl, hr);
          sg = { ecart: Math.max(pire(hl.decal), pire(hr.decal)) >= R.regle.X, lateral: Math.max(Math.abs(hl.decal[1]), Math.abs(hr.decal[1])) <= R.regle.D,
            ecartement: fini(g) && fini(k.gMed) && Math.abs(g - k.gMed) <= R.regle.G, dg: fini(g) && fini(k.gMed) ? arrondi(Math.abs(g - k.gMed), 2) : null };
        }
        const diff = sg ? ['ecart', 'lateral', 'ecartement'].filter(c => e[c] !== sg[c]) : ['pose-absente'];
        /* La pose de la chaîne (avec la hauteur apprise) est-elle parmi les hypothèses du jeu ? Sinon le substitut lit l'A* du moteur à sa place. */
        const cc = p.cas.find(x => x.cut === s.cut), ch = cc && cc.ariane && cc.ariane.chaine;
        const absente = ch ? ['left', 'right'].filter(side => { const q = ch.rails[side] && ch.rails[side].pose; if (!q) return false; const h = ch.rails[side].hauteurMm || 0;
          return !k.rails[side].hyps.some(x => Math.hypot(x.decal[0] - q[0], x.decal[1] - q[1], x.decal[2] - (q[2] + h)) < 0.76); }) : [];
        const poseDeChaine = absente.length ? `pose de la chaîne absente des hypothèses du jeu (rail ${absente.join(' et ')}, étage ${ch.stage}) : le substitut lit l'A* du moteur` : null;
        const cause = poseDeChaine || (diff.length ? diff.map(c => c === 'ecartement' ? `écartement (médiane ${arrondi(ex.gMed, 2)} contre ${arrondi(k.gMed, 2)} dans le jeu ; écart de l'écartement à la médiane ${arrondi(v.dg, 2)} contre ${sg && sg.dg})` : c === 'ecart' ? 'écart à la pose de départ' : c === 'lateral' ? 'déplacement latéral' : 'pas de pose de chaîne dans le jeu').join(' ; ')
          : (agit(r) && s.etat === 'agit' ? 'même décision, écart à Mic différent (arrondi du jeu)' : 'gardes identiques, pose différente (chaîne ou hauteur)'));
        ecarts.push({ partie, cut: s.cut, zone: r.zone, mic: arrondi(r.mic, 2), exact: { etat: r.etat, e: arrondi(r.e, 2), pire: arrondi(v.pire, 2), dg: arrondi(v.dg, 2), etage: v.stage }, substitut: { etat: s.etat, e: arrondi(s.e, 2), dg: sg && sg.dg },
          gardesQuiDiffèrent: diff, poseDeChaineAbsente: absente, cause });
      }
      ligne.substitut = { agit: subP.filter(agit).length };
    }
    parPartie.push(ligne);
  }
  const somme = (bs, f) => bs.reduce((a, b) => a + f(b), 0);
  const reel = { visites: somme(reels, b => b.visites), micSup10: somme(reels, b => b.micSup10), agit: somme(reels, b => b.agit), justes: somme(reels, b => b.corrigesJustes), abimes: somme(reels, b => b.abime),
    mauvaiseVoie: somme(reels, b => b.mauvaiseVoie), laisseFaux: somme(reels, b => b.laisseFaux), abstentions: somme(reels, b => b.abstention), erreurs: somme(reels, b => b.erreurs10) };
  const mien = A.bilanDe([]); for (const b of miens) for (const c of Object.keys(mien)) mien[c] += b[c];
  const mienCmp = { visites: mien.visites, micSup10: mien.micSup10, agit: mien.agit, justes: mien.justes, abimes: mien.abimes, mauvaiseVoie: mien.mauvaiseVoie, laisseFaux: mien.laisseFaux, abstentions: mien.abstentions, erreurs: mien.erreurs };
  const cmp = (a, b) => Object.keys(b).filter(k => a[k] !== b[k]);
  const out = { attendu, reel, mien: mienCmp, accordAttendu: cmp(reel, attendu).length === 0, ecartsAttendu: cmp(reel, attendu), accordReelMien: cmp(reel, mienCmp).length === 0, ecartsReelMien: cmp(reel, mienCmp), parPartie };
  if (parties.some(p => p.jeu)) {
    const b = A.bilanDe(sub.map(s => s)); // sub est la liste des résultats du substitut, un par cut mesurable de la population du jeu
    out.substitut = { cuts: sub.length, agit: b.agit, justes: b.justes, abimes: b.abimes, mauvaiseVoie: b.mauvaiseVoie, laisseFaux: b.laisseFaux, abstentions: b.abstentions };
    out.ecarts = ecarts; out.horsPopulation = horsPopulation;
  }
  return out;
}

/* ================================================================== 2. PORTE UNIQUE */
/*
 * Porte unique du jugement G1-c (fiches/PROTOCOLE_G1C.md § 3), écrite et exécutable. Le candidat (V1) contre la règle prudente RÉELLEMENT rejouée, cut par cut :
 *   1. 0 mauvaise voie (erreur finale > 50 mm ou rail déplacé de plus de 45 mm en travers) — et aucune partie n'en a une (condition 5 : arrêt pour sécurité) ;
 *   2. borne haute de Wilson à 95 % de l'erreur parmi les actions ≤ 9 % : IMPOSÉE, pas seulement calculée. Moins de `effectifMinimum()` actions (39) : la condition ne peut
 *      pas être démontrée, même sans aucune erreur → « non démontré » ;
 *   3. 0 mauvaise pose ajoutée, en comparaison APPARIÉE : aucun cut que la référence laisse ou pose à 10 mm de Mic (erreur finale ≤ 10 mm) et que le candidat pose à plus de 10 mm ;
 *   4. corrections justes du candidat ≥ celles de la référence ; erreur médiane (erreur finale, action ou non, sur les cuts mesurables de la zone) ≤ celle de la référence sur chaque zone
 *      active (où le candidat agit) ;
 *   5. résultats par partie publiés : un échec de la condition 4 sur une partie est écrit mais ne fait pas échouer la porte si le total la tient.
 * Issues : `echec` si l'une des conditions 1, 3, 4 échoue ou si l'effectif suffit et la borne dépasse 9 % ; `non-demontre` si rien n'échoue mais que l'effectif ne suffit pas pour la
 * condition 2 ; `succes` sinon. Un échec certain l'emporte toujours sur « non démontré ». `options.zonesActives` impose la liste des zones actives (sinon : celles où le candidat agit).
 */
function porteUnique({ candidat, reference, options = {} }) {
  const mr = new Map(reference.map(r => [cle(r), r]));
  const cand = [], ref = [], nonApparies = [];
  for (const r of candidat) { const s = mr.get(cle(r)); if (s) { cand.push(r); ref.push(s); } else nonApparies.push({ partie: r.partie, cut: r.cut }); }
  const n = cand.length, effMin = effectifMinimum(PORTE.erreurMax);
  const resume = rs => { const acts = rs.filter(agit); return { cuts: rs.length, actions: acts.length, justes: rs.filter(estJuste).length, abimes: rs.filter(estAbime).length, erreurs: rs.filter(estErreur).length, mauvaiseVoie: rs.filter(estMauvaiseVoie).length, finaleSup10: rs.filter(finaleSup10).length }; };
  const C = resume(cand), Rf = resume(ref);
  /* 1. mauvaise voie */
  const cMV = { ok: C.mauvaiseVoie <= PORTE.mauvaiseVoieMax, valeur: C.mauvaiseVoie, cuts: cand.filter(estMauvaiseVoie).map(r => ({ partie: r.partie, cut: r.cut, zone: r.zone, e: arrondi(r.e, 1), lat: arrondi(r.lat, 1) })) };
  /* 2. Wilson imposé */
  const w = wilsonHaut(C.erreurs, C.actions), suffisant = C.actions >= effMin;
  const cW = { ok: suffisant ? w <= PORTE.erreurMax : null, suffisant, actions: C.actions, erreurs: C.erreurs, taux: C.actions ? C.erreurs / C.actions : null, haut: w, effectifMinimum: effMin, seuil: PORTE.erreurMax };
  /* 3. mauvaises poses ajoutées (appariées) */
  const ajoutees = []; cand.forEach((r, i) => { if (agit(r) && r.e > PORTE.juste10 && !finaleSup10(ref[i])) ajoutees.push({ partie: r.partie, cut: r.cut, zone: r.zone, mic: arrondi(r.mic, 1), eCandidat: arrondi(r.e, 1), referenceAgit: agit(ref[i]), eReference: arrondi(erreurFinale(ref[i]), 1) }); });
  const cA = { ok: ajoutees.length === 0, valeur: ajoutees.length, cuts: ajoutees };
  /* 4. justes et médianes par zone */
  const cJ = { ok: C.justes >= Rf.justes, candidat: C.justes, reference: Rf.justes };
  const zonesActives = options.zonesActives || A.ZONES.filter(z => cand.some(r => r.zone === z && agit(r)));
  const medianes = {}; let okMed = true;
  for (const z of A.ZONES) {
    const idx = cand.map((r, i) => r.zone === z ? i : -1).filter(i => i >= 0);
    const mc = mediane(idx.map(i => erreurFinale(cand[i]))), mrf = mediane(idx.map(i => erreurFinale(ref[i]))), actif = zonesActives.includes(z);
    /* à titre d'information : la même médiane sur les seuls cuts où l'une des deux méthodes agit (la médiane sur tous les cuts est dominée par les cuts que personne ne touche) */
    const ia = idx.filter(i => agit(cand[i]) || agit(ref[i]));
    medianes[z] = { actif, cuts: idx.length, candidat: arrondi(mc, 3), reference: arrondi(mrf, 3), ok: !actif || idx.length === 0 || mc <= mrf + 1e-9,
      cutsOuUneMethodeAgit: ia.length, candidatSurActions: arrondi(mediane(ia.map(i => erreurFinale(cand[i]))), 3), referenceSurActions: arrondi(mediane(ia.map(i => erreurFinale(ref[i]))), 3) };
    if (actif && !medianes[z].ok) okMed = false;
  }
  const cM = { ok: okMed, zones: medianes };
  /* 5. par partie */
  const parties = [...new Set(cand.map(r => r.partie))].sort(), parPartie = {};
  for (const p of parties) {
    const idx = cand.map((r, i) => r.partie === p ? i : -1).filter(i => i >= 0), c = idx.map(i => cand[i]), f = idx.map(i => ref[i]);
    const med = {}, medOk = []; for (const z of zonesActives) { const zi = idx.filter(i => cand[i].zone === z); if (!zi.length) continue; const a = mediane(zi.map(i => erreurFinale(cand[i]))), b = mediane(zi.map(i => erreurFinale(ref[i]))); med[z] = { candidat: arrondi(a, 3), reference: arrondi(b, 3) }; if (a > b + 1e-9) medOk.push(z); }
    const rc = resume(c), rf = resume(f);
    const aj = c.filter((r, i) => agit(r) && r.e > PORTE.juste10 && !finaleSup10(f[i])).length;
    parPartie[p] = { candidat: rc, reference: rf, ajoutees: aj, medianes: med, ratees: [...(rc.mauvaiseVoie > 0 ? ['mauvaise voie'] : []), ...(aj > 0 ? ['mauvaise pose ajoutée'] : []), ...(rc.justes < rf.justes ? ['justes < référence'] : []), ...medOk.map(z => `médiane ${z} > référence`)] };
  }
  const cP = { ok: parties.every(p => parPartie[p].candidat.mauvaiseVoie === 0), parties: parPartie, note: 'une partie peut rater la condition 4 sans faire échouer la porte si le total la tient (protocole § 3.5) ; une mauvaise voie sur une partie met fin à l\'examen en échec (§ 4)' };
  /* exposition : le nombre d'actions exposées */
  const compter = (rs, cleF) => { const o = {}; for (const r of rs) if (agit(r)) { const k = cleF(r); o[k] = (o[k] || 0) + 1; } return o; };
  const exposition = { total: { candidat: C.actions, reference: Rf.actions }, parZone: { candidat: compter(cand, r => r.zone), reference: compter(ref, r => r.zone) }, parRole: { candidat: compter(cand, r => r.role), reference: compter(ref, r => r.role) },
    parPartie: { candidat: compter(cand, r => r.partie), reference: compter(ref, r => r.partie) } };
  const echecs = []; if (!cMV.ok) echecs.push('mauvaise voie observée'); if (!cP.ok) echecs.push('une partie a une mauvaise voie'); if (!cA.ok) echecs.push('mauvaise pose ajoutée');
  if (!cJ.ok) echecs.push('moins de corrections justes que la référence'); if (!cM.ok) echecs.push('erreur médiane d\'une zone active au-dessus de la référence'); if (suffisant && !cW.ok) echecs.push('borne de Wilson > 9 %');
  const issue = echecs.length ? 'echec' : suffisant ? 'succes' : 'non-demontre';
  const raisons = echecs.length ? echecs : suffisant ? [] : [`${C.actions} actions exposées : au moins ${effMin} sont nécessaires pour que la borne de Wilson puisse tomber à ${Math.round(PORTE.erreurMax * 100)} % (même sans erreur)`];
  return { format: 'ariane-gcv2-porte-unique-v1', protocole: 'fiches/PROTOCOLE_G1C.md § 3', issue, raisons, cuts: n, nonApparies, conditions: { mauvaiseVoie: cMV, wilson: cW, poseAjoutee: cA, justes: cJ, medianeParZone: cM, parPartie: cP }, exposition,
    candidat: C, reference: Rf };
}

/* Sensibilité de la porte à un sous-ensemble de cuts (références explicites seulement, sans SKIP…) : même porte, mêmes seuils, lecture seule. */
function sensibilites(candidat, reference) {
  const defs = [['références explicites seulement (validation de Mic, sans « visité sans action »)', r => r.ref === 'validation'], ['sans les cuts marqués SKIP par Mic', r => !r.skip],
    ['références explicites, sans SKIP', r => r.ref === 'validation' && !r.skip]];
  return defs.map(([nom, f]) => {
    const keep = new Set(candidat.filter(f).map(cle)), p = porteUnique({ candidat: candidat.filter(r => keep.has(cle(r))), reference: reference.filter(r => keep.has(cle(r))) });
    return { nom, cuts: p.cuts, issue: p.issue, actions: p.candidat.actions, justes: p.candidat.justes, referenceJustes: p.reference.justes, erreurs: p.candidat.erreurs, wilsonHaut: arrondi(p.conditions.wilson.haut, 4), mauvaiseVoie: p.candidat.mauvaiseVoie, ajoutees: p.conditions.poseAjoutee.valeur };
  });
}

/* ------------------------------------------------------------------ recouvrement des catégories (M1) */
/* Dénombre les actions par combinaison de catégories (juste, abîmé, erreur, mauvaise voie) et l'erreur finale > 10 mm, action ou non. */
function recouvrements(rs) {
  const acts = rs.filter(agit), combos = new Map();
  for (const r of acts) {
    const f = [estJuste(r) && 'juste', estAbime(r) && 'abîmé', estErreur(r) && 'erreur', estMauvaiseVoie(r) && 'mauvaise voie'].filter(Boolean), k = f.length ? f.join(' + ') : 'aucune (à 10 mm de Mic, Mic ≤ 10 mm ou déjà juste)';
    combos.set(k, (combos.get(k) || 0) + 1);
  }
  const sansAction = rs.filter(r => !agit(r));
  return { cuts: rs.length, actions: acts.length, combinaisons: [...combos].map(([categories, n]) => ({ categories, n })).sort((a, b) => b.n - a.n),
    categories: { justes: rs.filter(estJuste).length, abimes: rs.filter(estAbime).length, erreurs: rs.filter(estErreur).length, mauvaiseVoie: rs.filter(estMauvaiseVoie).length },
    erreurFinaleSup10: { total: rs.filter(finaleSup10).length, parActionErreur: acts.filter(r => r.e > PORTE.juste10).length, sansAction: sansAction.filter(r => r.mic > PORTE.juste10).length,
      dont: { abstentions: sansAction.filter(r => r.etat === 'abstient' && r.mic > PORTE.juste10).length, laisses: sansAction.filter(r => r.etat === 'laisse' && r.mic > PORTE.juste10).length } },
    reparations: rs.filter(estJuste).length, deteriorations: rs.filter(estAbime).length, causesAbstention: { abstient: sansAction.filter(r => r.etat === 'abstient').length, laisse: sansAction.filter(r => r.etat === 'laisse').length } };
}

/* ================================================================== 3. UNITÉ DÉCLARÉE : LA PARTIE (V4) */
/* Les trois lectures : par partie, moyenne des parties, cumul des cuts ; tous les projets, puis le projet 1 et le projet 2 séparés. */
function lectureDe(rs) {
  const b = A.bilanDe(rs), w = wilsonHaut(b.erreurs, b.agit);
  return { visites: b.visites, micSup10: b.micSup10, agit: b.agit, justes: b.justes, abimes: b.abimes, mauvaiseVoie: b.mauvaiseVoie, erreurs: b.erreurs, laisseFaux: b.laisseFaux, abstentions: b.abstentions, taux: b.agit ? b.erreurs / b.agit : null, wilsonHaut: w, finaleSup10: rs.filter(finaleSup10).length };
}
function lecturesParUnite(rs) {
  const out = {}, projets = [...new Set(rs.map(r => projetDe(r.partie)))].sort();
  for (const [nom, sel] of [['tous', () => true], ...projets.map(p => [`projet ${p}`, r => projetDe(r.partie) === p])]) {
    const sous = rs.filter(sel), parties = [...new Set(sous.map(r => r.partie))].sort(), parPartie = Object.fromEntries(parties.map(p => [p, lectureDe(sous.filter(r => r.partie === p))]));
    const L = Object.values(parPartie), champs = ['visites', 'micSup10', 'agit', 'justes', 'abimes', 'mauvaiseVoie', 'erreurs', 'laisseFaux', 'abstentions', 'finaleSup10'];
    const moy = Object.fromEntries(champs.map(c => [c, arrondi(moyenne(L.map(l => l[c])), 2)]));
    moy.tauxErreur = arrondi(moyenne(L.filter(l => l.agit > 0).map(l => l.taux)), 4); moy.partiesAvecAction = L.filter(l => l.agit > 0).length;
    out[nom] = { parties: parties.length, parPartie, moyenneParties: moy, cumulCuts: lectureDe(sous) };
  }
  return out;
}

/* ================================================================== 4. REGISTRE DE POPULATION (F6, M5) */
/* Le parcours d'une partie : visités → avec référence (explicite / implicite) → avec nuage → exemples retenus → actions. `cas` : cas de l'extraction ; `exemples` : numéros des cuts
 * retenus par l'apprentissage (identifiants) ; `actions` : numéros des cuts où la méthode évaluée agit. SKIP : statut écrit par Mic (`skipMic`). */
function registrePartie({ partie, cas, exemples = [], actions = [], actionsReference = [], seuilVisiteS = SEUIL_VISITE_G0_S }) {
  const ex = new Set(exemples), raisons = {}, l = {
    partie, visites: 0, reference: { explicite: 0, implicite: 0, incertaine: 0, aucune: 0 }, aucuneParRaison: raisons, nuage: { avec: 0, sans: 0, autre: 0 }, referenceEtNuage: 0, exemples: exemples.length, actions: actions.length, actionsReference: actionsReference.length,
    skip: { total: 0, referenceExplicite: 0, referenceImplicite: 0, sansReference: 0, retenusCommeExemples: 0 }, grossesCorrections: { total: 0, avecNuage: 0, sansNuage: 0, retenuesCommeExemples: 0 },
    seuilVisite: { utilise: SEUIL_VISITE_JEU_S, g0: seuilVisiteS, trop_courtsDansLaBande: 0 },
  };
  for (const c of cas) {
    if (!(c.cut >= 0)) continue;
    l.visites++;
    const incertaine = (c.mic && c.mic.ref === 'incertaine') || c.referenceIncertaine === true || (c.mic && c.mic.raison === 'reference-incertaine');
    const ref = incertaine ? null : c.mic && c.mic.ref, nuage = c.ariane && c.ariane.etat === 'calcule';
    if (incertaine) l.reference.incertaine++;
    else if (ref === 'validation') l.reference.explicite++; else if (ref === 'visite-bon') l.reference.implicite++; else { l.reference.aucune++; const q = (c.mic && c.mic.raison) || 'inconnue'; raisons[q] = (raisons[q] || 0) + 1; }
    if (nuage) l.nuage.avec++; else if (c.ariane && c.ariane.etat === 'sans-nuage') l.nuage.sans++; else l.nuage.autre++;
    if (ref && nuage) l.referenceEtNuage++;
    if (c.skipMic) { l.skip.total++; if (ref === 'validation') l.skip.referenceExplicite++; else if (ref === 'visite-bon') l.skip.referenceImplicite++; else l.skip.sansReference++; if (ex.has(c.cut)) l.skip.retenusCommeExemples++; }
    const m = micDuCas(c);
    if (!incertaine && fini(m) && m > PORTE.juste10) { l.grossesCorrections.total++; if (nuage) l.grossesCorrections.avecNuage++; else l.grossesCorrections.sansNuage++; if (ex.has(c.cut)) l.grossesCorrections.retenuesCommeExemples++; }
    /* visites sans validation, refusées « trop courtes » au seuil de 0,8 s, mais dont la première visite dure déjà 0,6 s ou plus : références que 0,6 s aurait acceptées (borne basse :
     * la jointure compare la plus longue visite, ici on ne voit que la première) */
    if (!ref && c.mic && c.mic.raison === 'trop-court' && fini(c.dwellPremiereS) && c.dwellPremiereS >= seuilVisiteS && c.dwellPremiereS < SEUIL_VISITE_JEU_S) l.seuilVisite.trop_courtsDansLaBande++;
  }
  return l;
}
function sommeRegistre(lignes) {
  const t = JSON.parse(JSON.stringify(lignes[0])); const add = (a, b) => { for (const k of Object.keys(b)) { if (typeof b[k] === 'number') a[k] = (a[k] || 0) + b[k]; else if (b[k] && typeof b[k] === 'object') add(a[k] || (a[k] = {}), b[k]); } };
  t.partie = 'total'; for (const k of Object.keys(t)) if (typeof t[k] === 'number') t[k] = 0; const reset = o => { for (const k of Object.keys(o)) { if (typeof o[k] === 'number') o[k] = 0; else if (o[k] && typeof o[k] === 'object') reset(o[k]); } }; reset(t);
  t.seuilVisite.utilise = SEUIL_VISITE_JEU_S; t.seuilVisite.g0 = lignes[0].seuilVisite.g0;
  for (const l of lignes) { const c = { ...l, partie: undefined, seuilVisite: { trop_courtsDansLaBande: l.seuilVisite.trop_courtsDansLaBande } }; delete c.partie; add(t, c); }
  return t;
}
/* 740 (G1-a, jeu) contre 741 (RM-4, cas) grosses corrections : même population, Mic arrondi à 0,01 mm dans le jeu, exact dans l'extraction. Liste les cuts qui franchissent 10 mm d'un côté seulement. */
function reconcilierGrosses(parties) {
  const out = { cas: 0, jeu: 0, ecarts: [] };
  for (const p of parties) {
    const jc = new Map(p.jeu.cuts.map(c => [c.cut.cut, c.cut]));
    for (const c of p.cas) {
      const m = micDuCas(c); if (!fini(m)) continue;
      const j = jc.get(c.cut), mj = j && j.etiquette ? j.etiquette.micMaxMm : null, g = m > PORTE.juste10, gj = fini(mj) && mj > PORTE.juste10;
      if (g) out.cas++; if (gj) out.jeu++;
      if (g !== gj) out.ecarts.push({ partie: p.jeu.partie, cut: c.cut, micExact: arrondi(m, 4), micJeu: mj });
    }
  }
  return out;
}

/* ================================================================== 5. ÉVALUATION COMPLÈTE */
/* Lit des cas (JSON lignes de `relecture-autonome extraire`). */
const lireCas = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
/* Évalue : références exactes, validation croisée (λ imbriqué si demandé), porte unique, lectures par unité, recouvrements, registre.
 *   parties  jeux de `lireJeuFichier` ; casParPartie : { '1:14': [cas…] } ; tables : { '1:14': table } facultatives. */
function evaluer({ parties, casParPartie, tables = {}, usage = 'relecture', lambdas = null, lambdaTemoin = null, lambda = A.LAMBDA, variante = 'V1', reglages = reglagesDuDepot(), journal = () => {}, accord = true }) {
  const refs = {};
  for (const j of parties) {
    if (!casParPartie[j.partie]) throw Error(`partie ${j.partie} : les cas de l'extraction manquent (--cas)`);
    refs[j.partie] = referenceExacte({ jeu: j, cas: casParPartie[j.partie], reglages, table: tables[j.partie] || null });
  }
  const V = A.validationCroisee(parties, { usage, lambda, lambdas, lambdaTemoin, variantes: [variante], reference: fournisseurReference(refs), garderCuts: true, journal, accord });
  const parCut = Object.fromEntries(Object.entries(casParPartie).map(([p, cs]) => [p, new Map(cs.map(c => [c.cut, c]))]));
  const cand = annoter(V.cuts.variantes[variante], parCut), reference = annoter(V.cuts.prudente, parCut), gcv2Seule = annoter(V.cuts.gcv2, parCut);
  const porte = porteUnique({ candidat: cand, reference });
  const E = { format: FORMAT_EVAL, usage, variante, lambda, lambdas: V.lambdas || null, parties: V.parties, nCas: V.nCas,
    reference: { source: 'tools/relecture-autonome.cjs (lignes, agit, regleDuReglage) sur les cas de l\'extraction', regle: refs[parties[0].partie].regle, actifs: refs[parties[0].partie].actifs,
      parPartie: Object.fromEntries(parties.map(j => [j.partie, { lignesMesurables: refs[j.partie].resultats.size, gMedReference: arrondi(refs[j.partie].gMed, 2), gMedJeu: refs[j.partie].gMedJeu }])) },
    porte, sensibilites: sensibilites(cand, reference), unites: { candidat: lecturesParUnite(cand), reference: lecturesParUnite(reference), gcv2Seule: lecturesParUnite(gcv2Seule) },
    recouvrements: { candidat: recouvrements(cand), reference: recouvrements(reference) },
    bilans: { candidat: lectureDe(cand), reference: lectureDe(reference), gcv2Seule: lectureDe(gcv2Seule), h0: lectureDe(annoter(V.cuts.h0, parCut)) },
    lambdaParPli: V.lambdaParPli || null, cuts: { candidat: cand, reference, gcv2Seule }, publieG1b: PUBLIE_G1B[usage] || null };
  const registre = parties.map(j => registrePartie({ partie: j.partie, cas: casParPartie[j.partie], exemples: A.construireCas(j, usage).map(k => k.cut),
    actions: cand.filter(r => r.partie === j.partie && agit(r)).map(r => r.cut), actionsReference: reference.filter(r => r.partie === j.partie && agit(r)).map(r => r.cut) }));
  E.registre = { parPartie: registre, total: sommeRegistre(registre), grosses: reconcilierGrosses(parties.map(j => ({ jeu: j, cas: casParPartie[j.partie] }))) };
  /* λ fixe de G1-b (témoin), évalué dans les mêmes plis et sur les mêmes cuts : même référence exacte, même Mic exact, même porte. */
  if (V.cuts.temoin) {
    const tc = annoter(V.cuts.temoin.variantes[variante], parCut);
    E.temoin = { lambda: lambdaTemoin, bilan: lectureDe(tc), porte: porteUnique({ candidat: tc, reference }), gcv2Seule: lectureDe(annoter(V.cuts.temoin.gcv2, parCut)) };
  }
  const { cuts: _cuts, ...Vsans } = V; void _cuts;
  E.validation = Vsans;
  return E;
}

/* ================================================================== 6. RAPPORT */
const pc = (a, b) => b ? `${(Math.round(1000 * a / b) / 10).toString().replace('.', ',')} %` : '—';
const pc1 = x => x == null ? '—' : `${(Math.round(1000 * x) / 10).toString().replace('.', ',')} %`;
const nb = v => v == null ? '—' : Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toString().replace('.', ',');
const oui = v => v === true ? 'oui' : v === false ? 'NON' : 'non démontré';
const ISSUE = { succes: 'SUCCÈS', echec: 'ÉCHEC', 'non-demontre': 'NON DÉMONTRÉ' };
function rapportPorte(P) {
  const c = P.conditions, L = [];
  L.push(`### Porte unique : ${ISSUE[P.issue]}`, '', P.raisons.length ? `Raisons : ${P.raisons.join(' ; ')}.` : 'Toutes les conditions sont tenues.', '', 'condition | résultat | valeurs', '---|---|---');
  L.push(`1. 0 mauvaise voie | ${oui(c.mauvaiseVoie.ok)} | ${c.mauvaiseVoie.valeur} sur ${P.candidat.actions} actions`);
  L.push(`2. borne haute de Wilson de l'erreur parmi les actions ≤ 9 % | ${c.wilson.ok === null ? 'non démontré (effectif insuffisant)' : oui(c.wilson.ok)} | ${c.wilson.erreurs} erreurs sur ${c.wilson.actions} actions (${pc1(c.wilson.taux)}), borne haute ${pc1(c.wilson.haut)} ; effectif minimum ${c.wilson.effectifMinimum} actions`);
  L.push(`3. 0 mauvaise pose ajoutée (appariée) | ${oui(c.poseAjoutee.ok)} | ${c.poseAjoutee.valeur}${c.poseAjoutee.cuts.length ? ' : ' + c.poseAjoutee.cuts.map(x => `${x.partie} cut ${x.cut} (${x.zone}, Mic ${x.mic}, candidat ${x.eCandidat}, référence ${x.eReference})`).join(' ; ') : ''}`);
  L.push(`4a. corrections justes ≥ référence | ${oui(c.justes.ok)} | ${c.justes.candidat} contre ${c.justes.reference}`);
  L.push(`4b. erreur médiane ≤ référence sur chaque zone active | ${oui(c.medianeParZone.ok)} | ${A.ZONES.filter(z => c.medianeParZone.zones[z].actif).map(z => { const m = c.medianeParZone.zones[z]; return `${z} ${m.candidat} contre ${m.reference} mm sur ${m.cuts} cuts (sur les ${m.cutsOuUneMethodeAgit} cuts où l'une des deux agit : ${m.candidatSurActions} contre ${m.referenceSurActions})`; }).join(' ; ') || 'aucune zone active'}`);
  L.push(`5. aucune partie avec une mauvaise voie | ${oui(c.parPartie.ok)} | ${Object.values(c.parPartie.parties).filter(p => p.candidat.mauvaiseVoie > 0).length} partie(s) en défaut`);
  L.push('', '#### Actions exposées (candidat | référence)', '', 'zone | actions', '---|---');
  for (const z of A.ZONES) L.push(`${z} | ${P.exposition.parZone.candidat[z] || 0} | ${P.exposition.parZone.reference[z] || 0}`);
  L.push('', 'rôle | actions', '---|---'); for (const o of A.ROLES) L.push(`${o} | ${P.exposition.parRole.candidat[o] || 0} | ${P.exposition.parRole.reference[o] || 0}`);
  L.push('', 'partie | actions candidat | actions référence | justes (cand. | réf.) | erreurs | mauvaise voie | ajoutées | conditions ratées', '---|--:|--:|---|--:|--:|--:|---');
  for (const [p, o] of Object.entries(c.parPartie.parties)) L.push(`${p} | ${o.candidat.actions} | ${o.reference.actions} | ${o.candidat.justes} | ${o.reference.justes} | ${o.candidat.erreurs} | ${o.candidat.mauvaiseVoie} | ${o.ajoutees} | ${o.ratees.join(', ') || '—'}`);
  return L.join('\n');
}
function rapportEvaluation(E) {
  const L = [`## Évaluation ${E.variante} — usage « ${E.usage} » (${E.nCas} cuts jugés, ${E.parties.length} plis)`, '', E.lambdas ? `λ imbriqué : choisi dans chaque pli extérieur parmi ${E.lambdas.join(', ')}.` : `λ fixe : ${E.lambda}.`, ''];
  L.push(rapportPorte(E.porte), '');
  L.push('### Sensibilité de la porte (même porte, sous-ensembles de cuts ; lecture seule)', '', 'sous-ensemble | cuts | issue | actions | justes (cand. | réf.) | erreurs | Wilson haut | mauvaise voie | ajoutées', '---|--:|---|--:|---|--:|--:|--:|--:');
  for (const s of E.sensibilites) L.push(`${s.nom} | ${s.cuts} | ${ISSUE[s.issue]} | ${s.actions} | ${s.justes} | ${s.referenceJustes} | ${s.erreurs} | ${pc1(s.wilsonHaut)} | ${s.mauvaiseVoie} | ${s.ajoutees}`);
  L.push('', '### Unité déclarée : la partie (trois lectures)', '');
  for (const [nom, lect] of Object.entries(E.unites.candidat)) {
    const ref = E.unites.reference[nom];
    L.push(`#### ${nom} (${lect.parties} parties)`, '', 'lecture | méthode | cuts | actions | justes | abîmés | mauvaise voie | erreurs (part) | Wilson haut | erreur finale > 10 mm', '---|---|--:|--:|--:|--:|--:|--:|--:|--:');
    for (const [m, u] of [['candidat', lect], ['règle prudente exacte', ref]]) {
      const c = u.cumulCuts, mo = u.moyenneParties;
      L.push(`cumul des cuts | ${m} | ${c.visites} | ${c.agit} | ${c.justes} | ${c.abimes} | ${c.mauvaiseVoie} | ${c.erreurs} (${pc1(c.taux)}) | ${pc1(c.wilsonHaut)} | ${c.finaleSup10}`);
      L.push(`moyenne des parties | ${m} | ${nb(mo.visites)} | ${nb(mo.agit)} | ${nb(mo.justes)} | ${nb(mo.abimes)} | ${nb(mo.mauvaiseVoie)} | ${nb(mo.erreurs)} (taux moyen ${pc1(mo.tauxErreur)}, ${mo.partiesAvecAction} parties avec action) | — | ${nb(mo.finaleSup10)}`);
    }
    L.push('', 'partie | méthode | cuts | actions | justes | abîmés | mauvaise voie | erreurs (part)', '---|---|--:|--:|--:|--:|--:|--:');
    for (const p of Object.keys(lect.parPartie)) for (const [m, u] of [['candidat', lect], ['règle prudente', ref]]) { const c = u.parPartie[p]; L.push(`${p} | ${m} | ${c.visites} | ${c.agit} | ${c.justes} | ${c.abimes} | ${c.mauvaiseVoie} | ${c.erreurs} (${pc1(c.taux)})`); }
    L.push('');
  }
  L.push('### Recouvrement des catégories et erreur finale > 10 mm (action ou non)', '');
  for (const [m, r] of [['candidat', E.recouvrements.candidat], ['règle prudente exacte', E.recouvrements.reference]]) {
    L.push(`**${m}** : ${r.cuts} cuts, ${r.actions} actions ; juste ${r.categories.justes}, abîmé ${r.categories.abimes}, erreur ${r.categories.erreurs}, mauvaise voie ${r.categories.mauvaiseVoie} ; **erreur finale > 10 mm : ${r.erreurFinaleSup10.total}** (${r.erreurFinaleSup10.parActionErreur} par une action en erreur, ${r.erreurFinaleSup10.sansAction} grosses corrections sans action dont ${r.erreurFinaleSup10.dont.abstentions} abstentions et ${r.erreurFinaleSup10.dont.laisses} laissées) ; abstentions ${r.causesAbstention.abstient}.`, '', 'combinaison de catégories | actions', '---|--:');
    for (const c of r.combinaisons) L.push(`${c.categories} | ${c.n}`);
    L.push('');
  }
  if (E.temoin) {
    const l = (nom, b, P) => `${nom} | ${b.agit} | ${b.justes} | ${b.abimes} | ${b.mauvaiseVoie} | ${b.erreurs} (${pc1(b.taux)}) | ${pc1(b.wilsonHaut)} | ${P ? ISSUE[P.issue] : '—'}`, G = E.publieG1b;
    L.push('### Écart du λ imbriqué avec G1-b (V1, mêmes 11 plis)', '', 'lecture | actions | justes | abîmés | mauvaise voie | erreurs (part) | Wilson haut | porte unique', '---|--:|--:|--:|--:|--:|--:|---');
    if (G) L.push(`G1-b publié (λ = ${E.temoin.lambda}, règle prudente substituée, Mic arrondi) | ${G.agit} | ${G.justes} | ${G.abimes} | ${G.mauvaiseVoie} | ${G.erreurs} (${pc1(G.taux)}) | ${pc1(A.wilson(G.erreurs, G.agit).haut)} | —`);
    L.push(l(`λ fixe ${E.temoin.lambda}, règle prudente exacte, Mic exact (nouvel évaluateur)`, E.temoin.bilan, E.temoin.porte), l(`λ imbriqué (${E.lambdas.join(', ')}), même évaluateur`, E.bilans.candidat, E.porte), '');
  }
  if (E.registre) L.push(rapportRegistre([...E.registre.parPartie, E.registre.total]), '', `Grosses corrections (Mic > 10 mm) : ${E.registre.grosses.cas} dans les cas de l'extraction (Mic exact), ${E.registre.grosses.jeu} dans le jeu (Mic arrondi à 0,01 mm)${E.registre.grosses.ecarts.length ? ` ; cuts qui franchissent 10 mm d'un côté seulement : ${E.registre.grosses.ecarts.map(x => `${x.partie} cut ${x.cut} (${x.micExact} mm exact, ${x.micJeu} dans le jeu)`).join(', ')}` : ''}.`, '');
  if (E.lambdaParPli) { L.push('### λ choisi par pli extérieur', '', 'partie jugée | λ choisi | perte interne par λ', '---|--:|---'); for (const p of E.parties) L.push(`${p} | ${E.lambdaParPli[p].choisi} | ${Object.entries(E.lambdaParPli[p].criteres || {}).map(([l, v]) => `${l} : ${v}`).join(' ; ')}`); }
  return L.join('\n');
}
function rapportControle(C) {
  const L = ['## Contrôle de la règle prudente exacte contre D-190 (1:14, 1:15, 1:16)', '', 'lecture | cuts mesurables | Mic > 10 mm | actions | justes | abîmés | mauvaise voie | laissés faux | abstentions | erreurs', '---|--:|--:|--:|--:|--:|--:|--:|--:|--:'];
  const l = (nom, o) => `${nom} | ${o.visites} | ${o.micSup10} | ${o.agit} | ${o.justes} | ${o.abimes} | ${o.mauvaiseVoie} | ${o.laisseFaux} | ${o.abstentions} | ${o.erreurs}`;
  L.push(l('D-190 (attendu)', C.attendu), l('fonction `bilan` de relecture-autonome', C.reel), l('évaluateur, cut par cut', C.mien));
  if (C.substitut) L.push(`substitut de G1-b (jeu) | ${C.substitut.cuts} | — | ${C.substitut.agit} | ${C.substitut.justes} | ${C.substitut.abimes} | ${C.substitut.mauvaiseVoie} | ${C.substitut.laisseFaux} | ${C.substitut.abstentions} | —`);
  L.push('', `Accord avec D-190 : ${C.accordAttendu ? 'oui' : 'NON (' + C.ecartsAttendu.join(', ') + ')'} ; accord entre la fonction réelle et l'évaluateur : ${C.accordReelMien ? 'oui' : 'NON (' + C.ecartsReelMien.join(', ') + ')'}.`);
  if (C.ecarts) {
    L.push('', `### Écarts du substitut avec la règle exacte (${C.ecarts.length} cuts)`, '', 'partie | cut | zone | Mic | exacte | substitut | gardes qui diffèrent | cause', '---|--:|---|--:|---|---|---|---');
    for (const e of C.ecarts) L.push(`${e.partie} | ${e.cut} | ${e.zone} | ${e.mic} | ${e.exact.etat}${e.exact.e != null ? ' (e ' + e.exact.e + ')' : ''} | ${e.substitut.etat}${e.substitut.e != null ? ' (e ' + e.substitut.e + ')' : ''} | ${e.gardesQuiDiffèrent.join(', ') || '—'} | ${e.cause}`);
    if (C.horsPopulation.length) L.push('', `Cuts mesurables de la règle exacte absents de la population du jeu : ${C.horsPopulation.length} (${C.horsPopulation.map(h => `${h.partie} ${h.cut}`).join(', ')}).`);
    L.push('', 'partie | cuts mesurables | médiane d\'écartement (règle exacte) | médiane (jeu) | actions exactes | actions du substitut', '---|--:|--:|--:|--:|--:');
    for (const p of C.parPartie) L.push(`${p.partie} | ${p.mesurables} | ${arrondi(p.gMedLigne, 2)} | ${p.gMedJeu} | ${p.agit} | ${p.substitut ? p.substitut.agit : '—'}`);
  }
  return L.join('\n');
}
function rapportRegistre(lignes) {
  const L = ['## Registre de population (parcours complet, par partie)', '', 'partie | visités | réf. explicite | réf. implicite | réf. incertaine | sans réf. | avec nuage | sans nuage | réf. et nuage | exemples retenus | actions | SKIP (dont réf. explicite) | SKIP retenus | grosses corr. | avec nuage | sans nuage | « trop court » 0,6–0,8 s', '---|' + '--:|'.repeat(15) + '--:'];
  for (const l of lignes) L.push(`${l.partie} | ${l.visites} | ${l.reference.explicite} | ${l.reference.implicite} | ${l.reference.incertaine || 0} | ${l.reference.aucune} | ${l.nuage.avec} | ${l.nuage.sans + l.nuage.autre} | ${l.referenceEtNuage} | ${l.exemples} | ${l.actions} | ${l.skip.total} (${l.skip.referenceExplicite}) | ${l.skip.retenusCommeExemples} | ${l.grossesCorrections.total} | ${l.grossesCorrections.avecNuage} | ${l.grossesCorrections.sansNuage} | ${l.seuilVisite.trop_courtsDansLaBande}`);
  return L.join('\n');
}

/* ================================================================== ligne de commande */
function argsCli(argv) {
  const o = { mode: argv[0], jeux: [], cas: [], tables: [], json: null, usage: null, lambdas: null, lambdaTemoin: null, variante: 'V1', sortie: null };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], v = () => { const x = argv[++i]; if (x === undefined) throw Error(`valeur manquante après ${k}`); return x; };
    if (k === '--jeu') o.jeux.push(v()); else if (k === '--cas') o.cas.push(v()); else if (k === '--table') o.tables.push(v()); else if (k === '--json') o.json = v(); else if (k === '--usage') o.usage = v();
    else if (k === '--lambdas') o.lambdas = v().split(',').map(Number); else if (k === '--lambda-temoin') o.lambdaTemoin = Number(v()); else if (k === '--variante') o.variante = v(); else if (k === '--sortie') o.sortie = v();
    else throw Error(`argument inconnu : ${k}`);
  }
  return o;
}
function chargerCas(fichiers) {
  const out = {};
  for (const f of fichiers) { const cs = lireCas(f); if (!cs.length) throw Error(`${f} : aucun cas`); out[`${cs[0].projet}:${cs[0].partie}`] = cs; }
  return out;
}
function chargerTables(fichiers) {
  const out = {};
  for (const f of fichiers) { const t = JSON.parse(fs.readFileSync(f, 'utf8')); out[`${t.projet}:${t.partie}`] = t; }
  return out;
}
function main(argv) {
  const a = argsCli(argv), journal = m => process.stderr.write(m + '\n');
  if (a.mode === 'controle') {
    const cas = chargerCas(a.cas), tables = chargerTables(a.tables), jeux = a.jeux.map(f => A.lireJeuFichier(f));
    const parties = Object.keys(cas).sort((x, y) => x.localeCompare(y, undefined, { numeric: true })).map(p => ({ jeu: jeux.find(j => j.partie === p) || null, cas: cas[p], table: tables[p] }));
    const C = controleD190({ parties }); if (a.json) fs.writeFileSync(a.json, JSON.stringify(C, null, 1)); process.stdout.write(rapportControle(C) + '\n');
  } else if (a.mode === 'valider') {
    if (!a.jeux.length || !a.usage) throw Error('valider --jeu … --cas … --usage relecture|lot');
    const parties = a.jeux.map(f => A.lireJeuFichier(f)), E = evaluer({ parties, casParPartie: chargerCas(a.cas), tables: chargerTables(a.tables), usage: a.usage, lambdas: a.lambdas, lambdaTemoin: a.lambdaTemoin, variante: a.variante, journal });
    if (a.sortie) fs.writeFileSync(a.sortie, JSON.stringify(E)); process.stdout.write(rapportEvaluation(E) + '\n');
  } else if (a.mode === 'rapport') {
    if (!a.json) throw Error('rapport --json E.json'); process.stdout.write(rapportEvaluation(JSON.parse(fs.readFileSync(a.json, 'utf8'))) + '\n');
  } else if (a.mode === 'registre') {
    const cas = chargerCas(a.cas), jeux = a.jeux.map(f => A.lireJeuFichier(f));
    const lignes = jeux.map(j => registrePartie({ partie: j.partie, cas: cas[j.partie], exemples: A.construireCas(j, 'relecture').map(k => k.cut) }));
    process.stdout.write(rapportRegistre([...lignes, sommeRegistre(lignes)]) + '\n');
  } else if (a.mode === 'essai') process.stdout.write('node --test tests/gcv2-evaluer.test.cjs\n');
  else throw Error('mode : controle | valider | rapport | registre | essai');
}
module.exports = { FORMAT_EVAL, PUBLIE_G1B, SEUIL_REFERENCE_INCERTAINE_MM, detecterReferenceIncertaine, PORTE, SEUIL_VISITE_G0_S, SEUIL_VISITE_JEU_S, ATTENDU_D190, agit, estMauvaiseVoie, estJuste, estAbime, estErreur, erreurFinale, finaleSup10, wilsonHaut, effectifMinimum, mediane,
  reglagesDuDepot, tablePseudo, micDuCas, referenceExacte, fournisseurReference, annoter, comparerCutParCut, controleD190, porteUnique, sensibilites, recouvrements, lectureDe, lecturesParUnite,
  registrePartie, sommeRegistre, reconcilierGrosses, lireCas, evaluer, rapportPorte, rapportEvaluation, rapportControle, rapportRegistre, argsCli, chargerCas, chargerTables };
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(`gcv2-evaluer : ${e.message}\n`); process.exit(1); } }
