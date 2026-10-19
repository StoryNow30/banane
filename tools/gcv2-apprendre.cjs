#!/usr/bin/env node
'use strict';
/*
 * gcv2-apprendre.cjs — G1-b de la GCV2 : l'APPRENTISSAGE du score de justesse (étage 2) et de la décision de paire (étage 3)
 * (fiches/G0_GCV2_CONCEPTION.md § 2 à 4, fiches/G1B_APPRENTISSAGE.md, D-201). Étude HORS LIGNE : rien n'est changé à l'extension, aucune action
 * dans ESV. Node pur, sans aucune dépendance.
 *
 *   node tools/gcv2-apprendre.cjs valider  --jeu JEU.jsonl [--jeu …] --usage relecture|lot [--lambda 30] [--variante V1|V2|V3 …] [--sortie V.json]
 *   node tools/gcv2-apprendre.cjs exporter --jeu JEU.jsonl [--jeu …] --sortie datasets/gcv2-parametres.json [--date AAAA-MM-JJ]
 *   node tools/gcv2-apprendre.cjs rapport  --json V1.json [--json V2.json]
 *   node tools/gcv2-apprendre.cjs essai
 *
 * EXEMPLES. Un exemple = (partie, cut, rail, hypothèse) d'un jeu de `gcv2-jeu.cjs`. Étiquettes binaires : l'hypothèse est à 10 mm (à 5 mm) de la
 * pose finale de l'opérateur expert. Seuls entrent les cuts calculés (le moteur a tourné : un nuage) avec une référence pour les deux rails.
 *
 * TRAITS : LISTE BLANCHE EXPLICITE (NUM, CAT, MULTI ci-dessous). Les `traits` de l'hypothèse, les traits du rail, le contexte du cut, la zone, le
 * rôle, les origines (H0 à H5, et leur sous-origine) et le drapeau « hauteur » ; plus quelques mesures d'ACCORD calculées sur les seuls décalages
 * `decal` des hypothèses du même rail (combien d'autres hypothèses tombent à 5 et 10 mm, distance à H1, à la chaîne, aux voisins). Rien d'autre :
 * les champs `visites`, `reference`, `etat`, `etiquette` de la ligne de cut, `micRailMm` de la ligne de rail et tout champ d'étiquette sont
 * INTERDITS (D-201, condition 1). Les traits sont lus champ par champ dans cette liste : un champ interdit est ignoré par construction, et une
 * liste blanche qui en nomme un est refusée (`verifierListeBlanche`).
 *
 * MODÈLE. Régression logistique L2 (Newton), traits numériques normalisés avec les moyennes et écarts du pli d'apprentissage seulement
 * (pondérés : chaque partie pèse autant), indicateurs pour les traits catégoriels (vocabulaire du pli d'apprentissage seulement), calibrage de
 * Platt appris sur les scores hors-échantillon du pli d'apprentissage (chaque partie d'apprentissage est jugée par un modèle qui ne l'a pas vue).
 * Deux probabilités par hypothèse : à 10 mm et à 5 mm.
 *
 * DÉCISION DE PAIRE. Garde-fous NON APPRIS d'abord (écartement de la paire à 15 mm de la médiane de la partie ou dans 1 420–1 470 mm ; chaque rail
 * à 45 mm au plus en latéral de la pose de départ ; changement de dévers de 15 mm au plus) ; ne rien faire (H0, H0) est toujours permis. Choix :
 * le couple qui maximise p_gauche × p_droite à 10 mm. Agir seulement si p ≥ τ ET si l'écart à H0 ≥ δ ; sinon laisser (ou s'abstenir). τ et δ sont
 * choisis par zone sur les scores hors-échantillon du pli d'apprentissage seulement : 0 mauvaise voie, erreur parmi les actions ≤ 9 %, le plus de
 * corrections justes.
 *
 * VALIDATION CROISÉE PAR PARTIE, DEUX USAGES : « relecture » (voisins humains permis, H4 entier) et « lot » (aucune pose de l'opérateur : les
 * hypothèses H4 de source humaine sont retirées, et les traits d'écart aux voisins sont annulés pour les cuts dont les voisins sont humains).
 * RÉFÉRENCES, sur les mêmes cuts : (a) H0, ne rien faire ; (b) la règle prudente figée de D-180 et D-190 relue sur le jeu ; (c) le hasard (une
 * paire tirée uniformément parmi les paires permises par les garde-fous, avec le taux d'action de la GCV2 par zone).
 *
 * VARIANTES PAR ZONE (D-204, option `--variante`, datasets/gcv2-variantes.json). Une variante ne change ni le modèle, ni le calibrage, ni τ et δ : elle
 * décide, pour chaque cut, qui agit, la GCV2 apprise du pli, la règle prudente figée, ou personne (H0). Jamais sur un cut rouge ni différé. Sans
 * l'option, la sortie est celle de G1-b, octet pour octet.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const Manifeste = require('./manifeste-parties.cjs');

const FORMAT_PARAMS = 'ariane-gcv2-parametres-v1', FORMAT_VALID = 'ariane-gcv2-validation-v1', VERSION = 'gcv2-g1b-1';
const FORMAT_JEU = 'ariane-gcv2-jeu-v1';
const SIDES = ['left', 'right'];
const SEUILS = Object.freeze({ juste5: 5, juste10: 10, mauvaiseVoie: 50 });
const GARDES = Object.freeze({ ecartementMedianeMm: 15, contratMm: [1420, 1470], lateralMaxMm: 45, deversMaxMm: 15 });
const ZONES = Object.freeze(['pn', 'adv', 'abords', 'liste', 'hors']);
const ROLES = Object.freeze(['vert', 'rouge', 'differe']);
const CIBLE = Object.freeze({ erreurMax: 0.09, mauvaiseVoieMax: 0, justesMinZone: 10 });
const GRILLE_TAU = Object.freeze(Array.from({ length: 70 }, (_, i) => Math.round((0.3 + 0.01 * i) * 100) / 100));
const GRILLE_DELTA = Object.freeze([2, 3, 5, 8, 10, 12, 15, 20, 25, 30]);
const LAMBDA = 30;
const GRAINE = 20261019;
const fini = v => typeof v === 'number' && Number.isFinite(v);
const arrondi = (v, d = 1) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;

/* ------------------------------------------------------------------ liste blanche des traits */
/* Champs qui ne doivent JAMAIS devenir un trait : comportement de l'opérateur (visites, type de validation, nuage présent ou non) et étiquettes. */
const INTERDITS = Object.freeze(['visites', 'reference', 'etat', 'etiquette', 'micRailMm', 'micMaxMm', 'mic', 'grosse', 'ecartMm', 'classe']);
const estInterdit = nom => INTERDITS.some(i => nom === i || nom.split('.').some(s => s === i) || /^(mic|etiquette|reference|visites)/i.test(nom));
/* [nom, source, chemin, transformation]. Sources : hyp = `traits` de l'hypothèse ; lig = champ de la ligne d'hypothèse ; rail = ligne de rail ;
 * ctx = contexte du cut ; acc = accord entre les hypothèses d'un rail (calculé sur `decal`). Transformations : id, log (signe·ln(1+|x|)),
 * log10 (log10 de x, plancher 1e-12), abs, bool. */
const T = (nom, src, chemin, tr = 'id') => Object.freeze({ nom, src, chemin, tr });
const NUM = Object.freeze([
  T('perte', 'hyp', 'perte', 'log10'), T('ratioPerte', 'hyp', 'ratioPerte', 'log'), T('lignesSommet', 'hyp', 'lignesSommet', 'log'), T('faces', 'hyp', 'faces'),
  T('pointsDessus', 'hyp', 'pointsDessus', 'log'), T('pointsFlanc', 'hyp', 'pointsFlanc', 'log'), T('epaisseurDessusMm', 'hyp', 'epaisseurDessusMm'),
  T('distCelluleMm', 'hyp', 'distCelluleMm', 'log'), T('ratioCelluleProche', 'hyp', 'ratioCelluleProche', 'log'),
  T('dzConventionMm', 'hyp', 'dzConventionMm'), T('duConventionMm', 'hyp', 'duConventionMm'), T('deplMm', 'hyp', 'deplMm', 'log'),
  T('ecartVoieMm', 'hyp', 'ecartVoieMm', 'log'), T('ecartVoisinsMm', 'hyp', 'ecartVoisinsMm', 'log'), T('ecartMedAutreH0Mm', 'hyp', 'ecartMedAutreH0Mm', 'abs'),
  T('ecartPaireMedMm', 'hyp', 'ecartPaireMedMm', 'abs'), T('hauteurMm', 'hyp', 'hauteurMm'),
  T('strong', 'hyp', 'strong', 'bool'), T('pente', 'hyp', 'pente', 'bool'), T('fenetre', 'hyp', 'fenetre', 'bool'), T('competitive', 'hyp', 'competitive', 'bool'),
  T('astar', 'hyp', 'astar', 'bool'), T('publiee', 'hyp', 'publiee', 'bool'), T('s1', 'hyp', 's1', 'bool'), T('strongCelluleProche', 'hyp', 'strongCelluleProche', 'bool'),
  T('hauteur', 'lig', 'hauteur', 'bool'),
  T('confianceAstar', 'rail', 'confianceAstar'), T('rapportPerteAstar', 'rail', 'rapportPerteAstar', 'log'), T('s1Rail', 'rail', 's1', 'bool'),
  T('fortsConcurrents', 'rail', 'fortsConcurrents', 'log'), T('competitives', 'rail', 'competitives', 'log'), T('grappes', 'rail', 'grappes', 'log'),
  T('fortsReservoir', 'rail', 'fortsReservoir', 'log'), T('reservoir', 'rail', 'reservoir', 'log'), T('pointsRail', 'rail', 'pointsRail', 'log'), T('perteMin', 'rail', 'perteMin', 'log10'),
  T('appuisChaine', 'ctx', 'appuisChaine'), T('voisinsN', 'ctx', 'voisinsN'), T('voisinsHumains', 'ctx', 'voisinsHumains'), T('voisinsLot', 'ctx', 'voisinsLot'),
  T('voisinsEncadre', 'ctx', 'voisinsEncadre', 'bool'), T('voisinsCoupMin', 'ctx', 'voisinsCoupMin', 'log'), T('ecartDepartMedMm', 'ctx', 'ecartDepartMedMm', 'abs'),
  T('accNProches5', 'acc', 'nProches5', 'log'), T('accNProches10', 'acc', 'nProches10', 'log'), T('accPlusProcheMm', 'acc', 'plusProcheMm', 'log'),
  T('accDistH1Mm', 'acc', 'distH1Mm', 'log'), T('accDistChaineMm', 'acc', 'distChaineMm', 'log'), T('accDistVoisinsMm', 'acc', 'distVoisinsMm', 'log'), T('accNOrigines', 'acc', 'nOrigines'),
]);
const CAT = Object.freeze([
  T('palier', 'hyp', 'palier'), T('convention', 'hyp', 'convention'), T('groupeHauteur', 'hyp', 'groupeHauteur'), T('chaineEtage', 'hyp', 'chaineEtage'),
  T('hauteurAbstention', 'hyp', 'hauteurAbstention'), T('statut', 'rail', 'statut'), T('motif', 'rail', 'motif'), T('etageChaine', 'ctx', 'etageChaine'),
  T('zone', 'ctx', 'zone'), T('role', 'ctx', 'role'),
]);
const MULTI = Object.freeze([T('balises', 'hyp', 'balises'), T('origines', 'lig', 'origines'), T('sousOrigines', 'lig', 'sousOrigines')]);
const SANS_ACCORD = nom => nom.startsWith('acc');
function verifierListeBlanche(liste = [...NUM, ...CAT, ...MULTI]) {
  for (const t of liste) {
    if (estInterdit(t.nom) || estInterdit(String(t.chemin))) throw Error(`liste blanche : le champ « ${t.nom} » (${t.src}.${t.chemin}) est interdit comme trait (comportement de l'opérateur ou étiquette, D-201)`);
    if (!['hyp', 'lig', 'rail', 'ctx', 'acc'].includes(t.src)) throw Error(`liste blanche : source inconnue « ${t.src} » pour « ${t.nom} »`);
  }
  return true;
}
verifierListeBlanche();

/* ------------------------------------------------------------------ outils numériques */
const sigmoide = z => z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* Borne de Wilson à 95 % d'une proportion k/n (même formule que tools/relecture-autonome.cjs). */
function wilson(k, n, z = 1.959964) {
  if (!n) return { bas: null, haut: null };
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { bas: Math.max(0, (c - r) / d), haut: Math.min(1, (c + r) / d) };
}
const norme = v => Math.hypot(v[0], v[1], v[2]);
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

/* ------------------------------------------------------------------ lecture du jeu */
function lignesDeTexte(texte) { return texte.split('\n').filter(l => l.trim()).map(l => JSON.parse(l)); }
/* Regroupe les lignes d'un jeu par cut. */
function jeuDeLignes(lignes) {
  const entete = lignes.find(l => l.type === 'entete');
  if (!entete || entete.format !== FORMAT_JEU) throw Error(`jeu : format ${FORMAT_JEU} attendu`);
  const cuts = new Map();
  for (const l of lignes) {
    if (l.type === 'cut') cuts.set(l.cut, { cut: l, rail: {}, hyp: { left: [], right: [] } });
    else if (l.type === 'rail') cuts.get(l.cut).rail[l.rail] = l;
    else if (l.type === 'hyp') cuts.get(l.cut).hyp[l.rail].push(l);
  }
  return { entete, partie: entete.partie, cuts: [...cuts.values()] };
}
/* Lecture d'un fichier de jeu : refuse un jeu de jugement, un témoin fixe et toute partie qui n'est pas d'apprentissage (manifeste des parties). */
function lireJeuFichier(fichier, { manifeste = Manifeste.lire() } = {}) {
  const buf = fs.readFileSync(fichier), jeu = jeuDeLignes(lignesDeTexte(buf.toString('utf8')));
  const m = /^(\d+):(\d+)$/.exec(String(jeu.partie || ''));
  if (!m) throw Error(`jeu ${path.basename(fichier)} : désignation de partie illisible`);
  const projet = Number(m[1]), partie = Number(m[2]);
  if (jeu.entete.jeu !== 'apprentissage') throw Error(`jeu ${path.basename(fichier)} : jeu « ${jeu.entete.jeu} », l'apprentissage ne lit que des jeux d'apprentissage`);
  if (Manifeste.estTemoin(manifeste, projet, partie)) throw Error(`la partie ${jeu.partie} est un témoin fixe : l'apprentissage ne la lit jamais (D-192)`);
  if (Manifeste.statut(manifeste, projet, partie) !== 'apprentissage') throw Error(`la partie ${jeu.partie} est réservée : l'apprentissage ne la lit pas (manifeste des parties)`);
  jeu.sha256 = sha256(buf); jeu.fichier = path.basename(fichier);
  return jeu;
}

/* ------------------------------------------------------------------ cas : un cut, ses hypothèses, ses traits bruts, ses étiquettes (séparées) */
const SOUS_H4_HUMAIN = 'voisins-humains';
function transfo(tr, v) {
  if (v === null || v === undefined) return NaN;
  if (tr === 'bool') return v === true ? 1 : v === false ? 0 : NaN;
  if (typeof v !== 'number' || !Number.isFinite(v)) return NaN;
  if (tr === 'log') return Math.sign(v) * Math.log1p(Math.abs(v));
  if (tr === 'log10') return Math.log10(Math.max(v, 1e-12));
  if (tr === 'abs') return Math.abs(v);
  return v;
}
/* Accord entre les hypothèses d'un rail : mesures sur les seuls décalages (aucune étiquette). */
function accords(hyps) {
  const d = (a, b) => norme([a.decal[0] - b.decal[0], a.decal[1] - b.decal[1], a.decal[2] - b.decal[2]]);
  const h1 = hyps.find(h => !h.hauteur && h.origines.includes('H1')), ch = hyps.find(h => !h.hauteur && h.sousOrigines.includes('chaine')), vo = hyps.find(h => !h.hauteur && h.origines.includes('H4'));
  return hyps.map(h => {
    let n5 = 0, n10 = 0, mini = Infinity;
    for (const o of hyps) { if (o === h) continue; const e = d(h, o); if (e <= 5) n5++; if (e <= 10) n10++; if (e < mini) mini = e; }
    return { nProches5: n5, nProches10: n10, plusProcheMm: Number.isFinite(mini) ? mini : null, distH1Mm: h1 ? d(h, h1) : null, distChaineMm: ch ? d(h, ch) : null,
      distVoisinsMm: vo ? d(h, vo) : null, nOrigines: h.origines.length };
  });
}
/* Traits bruts d'une hypothèse, lus champ par champ dans la liste blanche (rien d'autre n'est jamais lu). */
function brut(ligne, rail, ctx, acc) {
  const S = { hyp: ligne.traits || {}, lig: ligne, rail: rail || {}, ctx, acc };
  const lire = t => S[t.src][t.chemin];
  return {
    n: Float64Array.from(NUM, t => transfo(t.tr, lire(t))),
    c: CAT.map(t => { const v = lire(t); return v === null || v === undefined ? '∅' : String(v); }),
    m: MULTI.map(t => { const v = lire(t); return Array.isArray(v) ? v.map(String) : []; }),
  };
}
/* Usage « lot » : aucune pose de l'opérateur n'existe. On retire les hypothèses H4 de source humaine, on enlève H4 des hypothèses où il s'était
 * confondu avec une autre origine, et on annule les traits d'écart aux voisins des cuts dont les voisins étaient humains. Le jeu ne porte pas les
 * poses des voisins : l'interpolation « voisins du lot seuls » d'un cut à voisins mixtes ne peut pas être recalculée (elle est perdue). */
function appliquerUsage(c, usage) {
  const humains = c.cut.contexte && c.cut.contexte.voisins && c.cut.contexte.voisins.humains > 0;
  if (usage !== 'lot' || !humains) return { hyp: c.hyp, ctx: c.cut.contexte, retire: 0 };
  const hyp = { left: [], right: [] }; let retire = 0;
  for (const s of SIDES) for (const h of c.hyp[s]) {
    if (h.origines.length === 1 && h.origines[0] === 'H4' && h.sousOrigines.every(x => x === SOUS_H4_HUMAIN)) { retire++; continue; }
    hyp[s].push({ ...h, origines: h.origines.filter(o => o !== 'H4'), sousOrigines: h.sousOrigines.filter(x => x !== SOUS_H4_HUMAIN), traits: { ...h.traits, ecartVoisinsMm: null } });
  }
  const G0 = c.cut.contexte.ecartDepartMm, gMed = c.gMed;
  for (const s of SIDES) {
    const autre = SIDES.find(x => x !== s);
    for (const h of hyp[s]) {
      if (!fini(gMed) || !fini(G0)) { h.traits = { ...h.traits, ecartPaireMedMm: null }; continue; }
      let mini = Infinity;
      for (const o of hyp[autre]) mini = Math.min(mini, Math.abs(G0 + (h.traits.ecartementAutreH0Mm - G0) + (o.traits.ecartementAutreH0Mm - G0) - gMed));
      h.traits = { ...h.traits, ecartPaireMedMm: Number.isFinite(mini) ? arrondi(mini, 1) : null };
    }
  }
  return { hyp, ctx: { ...c.cut.contexte, voisins: { n: 0, humains: 0, lot: 0, encadre: null, coupMin: null, ecartementMm: null } }, retire };
}
/* Les cas d'une partie : cuts calculés avec un nuage et une référence pour les deux rails. */
function construireCas(jeu, usage = 'relecture') {
  if (!['relecture', 'lot'].includes(usage)) throw Error(`usage « ${usage} » : relecture | lot`);
  const cas = [], gMed = fini(jeu.entete.gMedMm) ? jeu.entete.gMedMm : null;
  for (const c0 of jeu.cuts) {
    const c = c0.cut;
    if (c.etat !== 'calcule' || !c.nHyp || !c.etiquette || !c.etiquette.mic || !c.etiquette.mic.left || !c.etiquette.mic.right) continue;
    const { hyp, ctx: contexte } = appliquerUsage({ cut: c, hyp: c0.hyp, gMed }, usage);
    const G0 = fini(contexte && contexte.ecartDepartMm) ? contexte.ecartDepartMm : null, v = (contexte && contexte.voisins) || {};
    const ctx = { zone: c.zone, role: c.role, etageChaine: contexte ? contexte.etageChaine : null, appuisChaine: contexte ? contexte.appuisChaine : null,
      voisinsN: v.n ?? null, voisinsHumains: v.humains ?? null, voisinsLot: v.lot ?? null, voisinsEncadre: v.encadre ?? null, voisinsCoupMin: v.coupMin ?? null,
      ecartDepartMedMm: fini(G0) && fini(gMed) ? G0 - gMed : null };
    const k = { partie: jeu.partie, cut: c.cut, zone: c.zone, role: c.role, gMed, G0, chaineDifferee: ctx.etageChaine === 'deferred', rails: {}, etiq: { micMaxMm: c.etiquette.micMaxMm, mic: c.etiquette.mic } };
    for (const s of SIDES) {
      const acc = accords(hyp[s]);
      k.rails[s] = { confiance: c0.rail[s] ? c0.rail[s].confianceAstar : null, hyps: hyp[s].map((h, i) => ({
        rang: h.rang, hauteur: !!h.hauteur, origines: h.origines, sousOrigines: h.sousOrigines, decal: h.decal, g: h.traits.ecartementAutreH0Mm,
        x: brut(h, c0.rail[s], ctx, acc[i]),
        /* étiquette : posée à part, jamais lue par `brut` */
        y: h.etiquette ? { ecartMm: h.etiquette.ecartMm } : null })) };
    }
    if (SIDES.some(s => k.rails[s].hyps.some(h => !h.y))) continue;
    k.i0 = {}; for (const s of SIDES) { k.i0[s] = k.rails[s].hyps.findIndex(h => !h.hauteur && h.origines.includes('H0')); if (k.i0[s] < 0) k.i0[s] = k.rails[s].hyps.findIndex(h => !h.hauteur && h.decal.every(x => Math.abs(x) < 0.75)); }
    if (SIDES.some(s => k.i0[s] < 0)) continue;
    k.paires = pairesPermises(k);
    cas.push(k);
  }
  return cas;
}

/* ------------------------------------------------------------------ garde-fous (non appris) */
const pire = decal => Math.max(Math.abs(decal[1]), Math.abs(decal[2]));
/* Écartement de la paire (gauche i, droite j) : l'écartement de départ plus ce que chaque rail y ajoute (écartement du rail avec l'autre rail laissé au
 * départ). Exact au premier ordre en latéral ; l'écart avec le calcul exact du jeu est de 0,3 mm au plus dans 97 % des cas et de plus de 1 mm dans 0,3 % (fiche § 2.6). */
function ecartementPaire(k, hl, hr) { return fini(k.G0) && fini(hl.g) && fini(hr.g) ? k.G0 + (hl.g - k.G0) + (hr.g - k.G0) : null; }
function paireValide(k, hl, hr, gardes = GARDES) {
  if (Math.abs(hl.decal[1]) > gardes.lateralMaxMm || Math.abs(hr.decal[1]) > gardes.lateralMaxMm) return false;
  if (Math.abs(hl.decal[2] - hr.decal[2]) > gardes.deversMaxMm) return false;
  const g = ecartementPaire(k, hl, hr);
  if (!fini(g)) return false;
  return (fini(k.gMed) && Math.abs(g - k.gMed) <= gardes.ecartementMedianeMm) || (g >= gardes.contratMm[0] && g <= gardes.contratMm[1]);
}
/* Toutes les paires permises par les garde-fous, sauf (H0, H0) qui est toujours permise. */
function pairesPermises(k, gardes = GARDES) {
  const out = [], L = k.rails.left.hyps, R = k.rails.right.hyps;
  for (let i = 0; i < L.length; i++) for (let j = 0; j < R.length; j++) {
    if (i === k.i0.left && j === k.i0.right) continue;
    if (!paireValide(k, L[i], R[j], gardes)) continue;
    out.push({ i, j, ecart: Math.max(pire(L[i].decal), pire(R[j].decal)) });
  }
  return out;
}

/* ------------------------------------------------------------------ codage des traits (normalisation du pli d'apprentissage seulement) */
const MIN_CATEGORIE = 20;
/* `lignes` : traits bruts des exemples d'apprentissage ; `poids` : leur poids. Rend le codage (noms de colonnes, moyennes, écarts, vocabulaires). */
function ajusterCodage(lignes, poids, { accord = true } = {}) {
  const sw = poids.reduce((a, b) => a + b, 0), num = [], noms = [];
  NUM.forEach((t, c) => {
    if (!accord && SANS_ACCORD(t.nom)) { num.push(null); return; }
    let s = 0, w = 0, manque = 0;
    for (let i = 0; i < lignes.length; i++) { const v = lignes[i].n[c]; if (Number.isNaN(v)) manque++; else { s += poids[i] * v; w += poids[i]; } }
    const moy = w ? s / w : 0; let q = 0;
    for (let i = 0; i < lignes.length; i++) { const v = lignes[i].n[c]; if (!Number.isNaN(v)) q += poids[i] * (v - moy) ** 2; }
    const sd = w ? Math.sqrt(q / w) : 1;
    num.push({ moy, sd: sd > 1e-9 ? sd : 1, constant: !(sd > 1e-9), manque: manque > 0 && manque < lignes.length });
    if (sd > 1e-9) { noms.push(t.nom); if (manque > 0 && manque < lignes.length) noms.push(t.nom + ':manque'); }
  });
  const cat = CAT.map((t, c) => { const cnt = new Map(); for (const l of lignes) cnt.set(l.c[c], (cnt.get(l.c[c]) || 0) + 1); return [...cnt].filter(([, n]) => n >= MIN_CATEGORIE).map(([v]) => v).sort(); });
  cat.forEach((vals, c) => { if (vals.length > 1) for (const v of vals) noms.push(`${CAT[c].nom}=${v}`); });
  const multi = MULTI.map((t, c) => { const cnt = new Map(); for (const l of lignes) for (const v of new Set(l.m[c])) cnt.set(v, (cnt.get(v) || 0) + 1); return [...cnt].filter(([, n]) => n >= MIN_CATEGORIE).map(([v]) => v).sort(); });
  multi.forEach((vals, c) => { for (const v of vals) noms.push(`${MULTI[c].nom}∋${v}`); });
  return { num, cat, multi, noms, p: noms.length, accord, nExemples: lignes.length, poidsTotal: sw };
}
function coder(fit, l, out = new Float64Array(fit.p), off = 0) {
  let j = off;
  fit.num.forEach((f, c) => {
    if (!f || f.constant) return;
    const v = l.n[c], ko = Number.isNaN(v);
    out[j++] = ko ? 0 : Math.max(-6, Math.min(6, (v - f.moy) / f.sd));
    if (f.manque) out[j++] = ko ? 1 : 0;
  });
  fit.cat.forEach((vals, c) => { if (vals.length > 1) for (const v of vals) out[j++] = l.c[c] === v ? 1 : 0; });
  fit.multi.forEach((vals, c) => { for (const v of vals) out[j++] = l.m[c].includes(v) ? 1 : 0; });
  return out;
}
function matrice(fit, lignes) {
  const X = new Float64Array(lignes.length * fit.p);
  lignes.forEach((l, i) => coder(fit, l, X, i * fit.p));
  return X;
}

/* ------------------------------------------------------------------ régression logistique L2 (Newton) */
/* Minimise Σ wᵢ·logloss + (λ/2)·‖β‖² (l'ordonnée n'est pas pénalisée). X : n×p à plat. Rend { coef, intercept, iterations, perte }. */
function ajusterLogistique(X, n, p, y, w, lambda = LAMBDA, { maxIter = 30, tol = 1e-7 } = {}) {
  const q = p + 1, beta = new Float64Array(q);
  const sw = w.reduce((a, b) => a + b, 0), swy = w.reduce((a, b, i) => a + b * y[i], 0), pm = Math.min(0.999, Math.max(0.001, swy / sw));
  beta[p] = Math.log(pm / (1 - pm));
  const z = new Float64Array(n), nz = new Int32Array(p), g = new Float64Array(q), H = new Float64Array(q * q);
  const objectif = b => {
    let o = 0;
    for (let i = 0; i < n; i++) { let s = b[p]; const o0 = i * p; for (let j = 0; j < p; j++) s += X[o0 + j] * b[j]; o += w[i] * (s > 0 ? s + Math.log1p(Math.exp(-s)) : Math.log1p(Math.exp(s))) - w[i] * y[i] * s; }
    let r = 0; for (let j = 0; j < p; j++) r += b[j] * b[j];
    return o + 0.5 * lambda * r;
  };
  let obj = objectif(beta), it = 0;
  for (; it < maxIter; it++) {
    g.fill(0); H.fill(0);
    for (let i = 0; i < n; i++) {
      const o0 = i * p; let s = beta[p], m = 0;
      for (let j = 0; j < p; j++) { const x = X[o0 + j]; if (x !== 0) { nz[m++] = j; s += x * beta[j]; } }
      const mu = sigmoide(s), r = w[i] * (mu - y[i]), h = w[i] * mu * (1 - mu);
      for (let a = 0; a < m; a++) {
        const ja = nz[a], xa = X[o0 + ja]; g[ja] += r * xa; const ha = h * xa;
        for (let b = 0; b <= a; b++) H[ja * q + nz[b]] += ha * X[o0 + nz[b]];
        H[p * q + ja] += ha;
      }
      g[p] += r; H[p * q + p] += h;
    }
    for (let j = 0; j < p; j++) { g[j] += lambda * beta[j]; H[j * q + j] += lambda; }
    H[p * q + p] += 1e-9;
    /* H est rempli en triangle inférieur (ligne ≥ colonne), l'ordonnée en dernière ligne : on complète le haut puis on résout par Cholesky. */
    const A = new Float64Array(q * q);
    for (let a = 0; a < q; a++) for (let b = 0; b <= a; b++) { const v = H[a * q + b]; A[a * q + b] = v; A[b * q + a] = v; }
    const d = cholesky(A, g, q);
    let pas = 1, nb = new Float64Array(q), nobj = obj;
    for (let essai = 0; essai < 12; essai++) { for (let a = 0; a < q; a++) nb[a] = beta[a] - pas * d[a]; nobj = objectif(nb); if (nobj <= obj + 1e-12) break; pas /= 2; }
    let maxd = 0; for (let a = 0; a < q; a++) maxd = Math.max(maxd, Math.abs(nb[a] - beta[a]));
    if (nobj <= obj + 1e-12) { beta.set(nb); obj = nobj; }
    if (maxd < tol) { it++; break; }
  }
  return { coef: Array.from(beta.subarray(0, p)), intercept: beta[p], iterations: it, perte: obj };
}
function cholesky(A, b, q) {
  const Lc = new Float64Array(q * q);
  for (let i = 0; i < q; i++) for (let j = 0; j <= i; j++) {
    let s = A[i * q + j]; for (let k = 0; k < j; k++) s -= Lc[i * q + k] * Lc[j * q + k];
    if (i === j) { if (!(s > 1e-12)) s = 1e-12; Lc[i * q + i] = Math.sqrt(s); } else Lc[i * q + j] = s / Lc[j * q + j];
  }
  const y = new Float64Array(q), x = new Float64Array(q);
  for (let i = 0; i < q; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= Lc[i * q + k] * y[k]; y[i] = s / Lc[i * q + i]; }
  for (let i = q - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < q; k++) s -= Lc[k * q + i] * x[k]; x[i] = s / Lc[i * q + i]; }
  return x;
}
function scoresLineaires(modele, X, n) {
  const p = modele.coef.length, z = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = modele.intercept; const o = i * p; for (let j = 0; j < p; j++) s += X[o + j] * modele.coef[j]; z[i] = s; }
  return z;
}

/* ------------------------------------------------------------------ petits arbres (option : seulement s'ils gagnent nettement) */
/* Boosting de petits arbres (profondeur 3 au plus, 50 arbres au plus), perte logistique, pas de Newton, coupures sur 32 classes de quantiles. Mêmes
 * entrées que la logistique ; sert à mesurer si des interactions entre traits manquent à la régression logistique (fiche § 6). */
function ajusterArbres(X, n, p, y, w, { profondeur = 3, nArbres = 50, pas = 0.1, classes = 32, lambda = 5, minPoids = 20 } = {}) {
  const coupures = [], B = new Uint8Array(n * p);
  for (let j = 0; j < p; j++) {
    const v = new Float64Array(n); for (let i = 0; i < n; i++) v[i] = X[i * p + j];
    const tri = Array.from(new Set(v)).sort((a, b) => a - b), cp = [];
    if (tri.length > 1) { const m = Math.min(classes - 1, tri.length - 1); for (let c = 1; c <= m; c++) { const t = (tri[Math.floor(c * (tri.length - 1) / m)] + tri[Math.max(0, Math.floor(c * (tri.length - 1) / m) - 1)]) / 2; if (!cp.length || t > cp[cp.length - 1]) cp.push(t); } }
    coupures.push(cp);
    for (let i = 0; i < n; i++) { let b = 0; const x = v[i]; while (b < cp.length && x > cp[b]) b++; B[i * p + j] = b; }
  }
  const sw = w.reduce((a, b) => a + b, 0), swy = w.reduce((a, b, i) => a + b * y[i], 0), pm = Math.min(0.999, Math.max(0.001, swy / sw));
  const base = Math.log(pm / (1 - pm)), F = new Float64Array(n).fill(base), arbres = [];
  const g = new Float64Array(n), h = new Float64Array(n);
  for (let t = 0; t < nArbres; t++) {
    for (let i = 0; i < n; i++) { const mu = sigmoide(F[i]); g[i] = w[i] * (mu - y[i]); h[i] = w[i] * mu * (1 - mu); }
    const noeud = (idx, d) => {
      let G = 0, H = 0; for (const i of idx) { G += g[i]; H += h[i]; }
      const feuille = { v: -G / (H + lambda) * pas };
      if (d >= profondeur || idx.length < 2 * minPoids) return feuille;
      let best = null; const base0 = G * G / (H + lambda);
      for (let j = 0; j < p; j++) {
        const nb = coupures[j].length + 1; if (nb < 2) continue;
        const hg = new Float64Array(nb), hh = new Float64Array(nb), hn = new Int32Array(nb);
        for (const i of idx) { const b = B[i * p + j]; hg[b] += g[i]; hh[b] += h[i]; hn[b]++; }
        let gl = 0, hl = 0, nl = 0;
        for (let b = 0; b < nb - 1; b++) {
          gl += hg[b]; hl += hh[b]; nl += hn[b];
          if (nl < minPoids || idx.length - nl < minPoids) continue;
          const gain = gl * gl / (hl + lambda) + (G - gl) * (G - gl) / (H - hl + lambda) - base0;
          if (!best || gain > best.gain) best = { gain, j, b };
        }
      }
      if (!best || best.gain <= 1e-9) return feuille;
      const L = [], R = []; for (const i of idx) (B[i * p + best.j] <= best.b ? L : R).push(i);
      return { j: best.j, seuil: coupures[best.j][best.b], gauche: noeud(L, d + 1), droite: noeud(R, d + 1) };
    };
    const arbre = noeud(Array.from({ length: n }, (_, i) => i), 0);
    arbres.push(arbre);
    for (let i = 0; i < n; i++) F[i] += valeurArbre(arbre, X, i * p);
  }
  return { base, arbres };
}
function valeurArbre(a, X, o) { while (a.j !== undefined) a = X[o + a.j] <= a.seuil ? a.gauche : a.droite; return a.v; }
function scoresArbres(modele, X, n, p) {
  const z = new Float64Array(n).fill(modele.base);
  for (let i = 0; i < n; i++) for (const a of modele.arbres) z[i] += valeurArbre(a, X, i * p);
  return z;
}

/* ------------------------------------------------------------------ calibrage de Platt : p = σ(a·z + b), pondéré */
function platt(z, y, w, { maxIter = 60 } = {}) {
  let a = 1, b = 0;
  const obj = (a, b) => { let o = 0; for (let i = 0; i < z.length; i++) { const s = a * z[i] + b; o += w[i] * ((s > 0 ? s + Math.log1p(Math.exp(-s)) : Math.log1p(Math.exp(s))) - y[i] * s); } return o; };
  let o = obj(a, b);
  for (let it = 0; it < maxIter; it++) {
    let ga = 0, gb = 0, haa = 0, hab = 0, hbb = 0;
    for (let i = 0; i < z.length; i++) { const mu = sigmoide(a * z[i] + b), r = w[i] * (mu - y[i]), h = w[i] * mu * (1 - mu); ga += r * z[i]; gb += r; haa += h * z[i] * z[i]; hab += h * z[i]; hbb += h; }
    haa += 1e-9; hbb += 1e-9;
    const det = haa * hbb - hab * hab; if (!(Math.abs(det) > 1e-18)) break;
    const da = (hbb * ga - hab * gb) / det, db = (haa * gb - hab * ga) / det;
    let pas = 1, na = a, nb = b, no = o;
    for (let e = 0; e < 12; e++) { na = a - pas * da; nb = b - pas * db; no = obj(na, nb); if (no <= o + 1e-12) break; pas /= 2; }
    const bouge = Math.abs(na - a) + Math.abs(nb - b);
    if (no <= o + 1e-12) { a = na; b = nb; o = no; }
    if (bouge < 1e-9) break;
  }
  if (!(a > 1e-6)) a = 1e-6;                  // le calibrage reste monotone croissant
  return { a, b };
}
const appliquerPlatt = (c, z) => sigmoide(c.a * z + c.b);

/* ------------------------------------------------------------------ jeu d'exemples et entraînement */
/* Exemples d'un ensemble de cas : une ligne par hypothèse. */
function exemples(cas) {
  const out = { lignes: [], y10: [], y5: [], partie: [], ref: [] };
  cas.forEach((k, ci) => { for (const s of SIDES) k.rails[s].hyps.forEach((h, hi) => { out.lignes.push(h.x); out.y10.push(h.y.ecartMm <= SEUILS.juste10 ? 1 : 0); out.y5.push(h.y.ecartMm <= SEUILS.juste5 ? 1 : 0); out.partie.push(k.partie); out.ref.push([ci, s, hi]); }); });
  out.y10 = Uint8Array.from(out.y10); out.y5 = Uint8Array.from(out.y5);
  return out;
}
/* Poids : chaque partie pèse autant (la somme des poids vaut le nombre d'exemples). */
function poidsParPartie(parties) {
  const cnt = new Map(); for (const p of parties) cnt.set(p, (cnt.get(p) || 0) + 1);
  const n = parties.length, P = cnt.size;
  return Float64Array.from(parties, p => n / (P * cnt.get(p)));
}
/* Entraîne les deux modèles (10 mm, 5 mm) sur les cas donnés. Rend { fit, m10, m5 }. */
function entrainer(cas, { lambda = LAMBDA, accord = true, deux = true } = {}) {
  const ex = exemples(cas), w = poidsParPartie(ex.partie), fit = ajusterCodage(ex.lignes, w, { accord });
  const X = matrice(fit, ex.lignes), n = ex.lignes.length;
  const m10 = ajusterLogistique(X, n, fit.p, ex.y10, w, lambda), m5 = deux ? ajusterLogistique(X, n, fit.p, ex.y5, w, lambda) : null;
  return { fit, m10, m5, n };
}
/* Scores linéaires (avant calibrage) des hypothèses d'un ensemble de cas : { z10: [cas][rail] → Float64Array, z5 }. */
function scorer(modele, cas) {
  const ex = exemples(cas), X = matrice(modele.fit, ex.lignes), n = ex.lignes.length;
  const z10 = scoresLineaires(modele.m10, X, n), z5 = modele.m5 ? scoresLineaires(modele.m5, X, n) : null;
  return { ex, z10, z5 };
}
/* Remet les scores à plat dans la forme du cas : cas[k] = { left: [...], right: [...] }. */
function parCas(cas, ex, v) {
  const out = cas.map(k => ({ left: new Float64Array(k.rails.left.hyps.length), right: new Float64Array(k.rails.right.hyps.length) }));
  ex.ref.forEach(([ci, s, hi], idx) => { out[ci][s][hi] = v[idx]; });
  return out;
}

/* ------------------------------------------------------------------ décision de paire */
/* Le couple qui maximise p_gauche × p_droite parmi (H0, H0) et les paires permises. `p` : { left, right } probabilités calibrées à 10 mm. */
function meilleurePaire(k, p) {
  const i0 = k.i0.left, j0 = k.i0.right;
  let best = { i: i0, j: j0, p: p.left[i0] * p.right[j0], ecart: 0, h0: true };
  const rang = [];
  for (const q of k.paires) {
    const v = p.left[q.i] * p.right[q.j];
    rang.push({ i: q.i, j: q.j, p: v, ecart: q.ecart, h0: false });
    if (v > best.p) best = { i: q.i, j: q.j, p: v, ecart: q.ecart, h0: false };
  }
  rang.push({ i: i0, j: j0, p: p.left[i0] * p.right[j0], ecart: 0, h0: true });
  rang.sort((a, b) => b.p - a.p);
  return { best, deux: rang.slice(0, 2) };
}
/* seuils : { zone: { actif, tau, delta } }. Rend { etat: 'agit' | 'laisse' | 'abstient', paire, p, ecart, alternatives }. */
function decider(k, p, seuils) {
  const { best, deux } = meilleurePaire(k, p), s = seuils[k.zone] || seuils.hors || { actif: false };
  /* Laisser : la meilleure paire est (H0, H0), ou elle est à moins de δ de H0, ou la zone est inactive. S'abstenir : une pose candidate, trop incertaine. */
  let etat = 'laisse';
  if (!best.h0 && s.actif && best.ecart >= s.delta) etat = best.p >= s.tau ? 'agit' : 'abstient';
  return { etat, i: best.i, j: best.j, p: best.p, ecart: best.ecart, alternatives: deux };
}
/* Issue d'une paire (i, j) d'un cas : écart à la pose finale (le pire des deux rails), déplacement latéral maximal. */
function issueDePaire(k, i, j) {
  const hl = k.rails.left.hyps[i], hr = k.rails.right.hyps[j];
  return { e: Math.max(hl.y.ecartMm, hr.y.ecartMm), lat: Math.max(Math.abs(hl.decal[1]), Math.abs(hr.decal[1])) };
}
/* Un résultat par cut : { partie, cut, zone, role, mic (pire des deux rails), etat, e, lat }. */
function resultatDeDecision(k, d) {
  const r = { partie: k.partie, cut: k.cut, zone: k.zone, role: k.role, mic: k.etiq.micMaxMm, etat: d.etat, e: null, lat: null };
  if (d.etat === 'agit') { const o = issueDePaire(k, d.i, d.j); r.e = o.e; r.lat = o.lat; }
  return r;
}

const plusGrand = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] > b[i]) return true; if (a[i] < b[i]) return false; } return false; };
/* Choix de τ et δ par zone, sur des scores hors-échantillon du pli d'apprentissage (cas + probabilités calibrées).
 * Contrainte : 0 mauvaise voie, erreur parmi les actions ≤ erreurMax, au moins `justesMinZone` corrections justes ; objectif : le plus de
 * corrections justes, puis le moins d'erreurs, puis le moins d'abîmés, puis les seuils les plus hauts. Zone sans seuil admissible : inactive. */
function choisirSeuils(cas, probas, cible = CIBLE) {
  const seuils = {};
  for (const z of ZONES) {
    const gagnants = [];
    cas.forEach((k, ci) => {
      if (k.zone !== z) return;
      const { best } = meilleurePaire(k, probas[ci]);
      if (best.h0) return;
      const o = issueDePaire(k, best.i, best.j);
      gagnants.push({ p: best.p, ecart: best.ecart, e: o.e, lat: o.lat, mic: k.etiq.micMaxMm });
    });
    let meilleur = null;
    for (const delta of GRILLE_DELTA) for (const tau of GRILLE_TAU) {
      let agit = 0, justes = 0, erreurs = 0, mv = 0, abimes = 0;
      for (const g of gagnants) {
        if (g.p < tau || g.ecart < delta) continue;
        agit++; if (g.e > SEUILS.juste10) erreurs++;
        if (g.mic > SEUILS.juste10 && g.e <= SEUILS.juste10) justes++;
        if (g.e > SEUILS.mauvaiseVoie || g.lat > GARDES.lateralMaxMm) mv++;
        if (g.mic <= SEUILS.juste5 && g.e > SEUILS.juste10) abimes++;
      }
      if (!agit || mv > cible.mauvaiseVoieMax || erreurs / agit > cible.erreurMax + 1e-12 || justes < cible.justesMinZone) continue;
      const cle = [justes, -erreurs, -abimes, tau, delta];
      if (!meilleur || plusGrand(cle, meilleur.cle)) meilleur = { cle, tau, delta, agit, justes, erreurs, abimes };
    }
    seuils[z] = meilleur ? { actif: true, tau: meilleur.tau, delta: meilleur.delta, agit: meilleur.agit, justes: meilleur.justes, erreurs: meilleur.erreurs, abimes: meilleur.abimes }
      : { actif: false, tau: null, delta: null, agit: 0, justes: 0, erreurs: 0, abimes: 0 };
  }
  return seuils;
}

/* ------------------------------------------------------------------ entraînement d'un pli : calibrage et seuils sur les scores hors-échantillon */
/* Apprend, sur `casApp` (plusieurs parties), tout ce qu'un pli apprend : le modèle, le calibrage de Platt et les seuils, ces deux-là sur les
 * scores que des modèles entraînés SANS la partie jugée donnent à chaque partie d'apprentissage. `espion(nom, parties)` est appelé chaque fois
 * qu'un pas lit des parties (essai : une partie jugée n'y figure jamais). */
function apprendrePli(casApp, opt = {}) {
  const { lambda = LAMBDA, accord = true, espion = () => {}, cible = CIBLE, calibrer5 = true } = opt;
  const parties = [...new Set(casApp.map(k => k.partie))].sort();
  const idx = new Map(casApp.map((k, i) => [k, i]));
  const z10 = casApp.map(() => ({})), z5 = casApp.map(() => ({}));
  for (const t of parties) {
    const train = casApp.filter(k => k.partie !== t), test = casApp.filter(k => k.partie === t);
    espion('interne', train.map(k => k.partie));
    const mod = entrainer(train, { lambda, accord, deux: calibrer5 }), sc = scorer(mod, test);
    const a10 = parCas(test, sc.ex, sc.z10), a5 = sc.z5 ? parCas(test, sc.ex, sc.z5) : null;
    test.forEach((k, ti) => { const ci = idx.get(k); z10[ci] = a10[ti]; if (a5) z5[ci] = a5[ti]; });
  }
  const exA = exemples(casApp), wA = poidsParPartie(exA.partie);
  const aplat = (zc) => { const v = new Float64Array(exA.ref.length); exA.ref.forEach(([ci, s, hi], n) => { v[n] = zc[ci][s][hi]; }); return v; };
  espion('calibrage', parties);
  const cal10 = platt(aplat(z10), exA.y10, wA), cal5 = calibrer5 ? platt(aplat(z5), exA.y5, wA) : null;
  const probas = z10.map(c => ({ left: Float64Array.from(c.left, z => appliquerPlatt(cal10, z)), right: Float64Array.from(c.right, z => appliquerPlatt(cal10, z)) }));
  espion('seuils', parties);
  const seuils = choisirSeuils(casApp, probas, cible);
  espion('modele', parties);
  const modele = entrainer(casApp, { lambda, accord, deux: calibrer5 });
  return { modele, cal10, cal5, seuils, parties, oofZ10: z10, oofZ5: z5 };
}
/* Probabilités calibrées d'un pli appris pour des cas jugés : { p10: [cas]{left,right}, p5 }. */
function jugerPli(pli, cas) {
  const sc = scorer(pli.modele, cas), a10 = parCas(cas, sc.ex, sc.z10), a5 = sc.z5 ? parCas(cas, sc.ex, sc.z5) : null;
  const cal = (c, a) => a.map(o => ({ left: Float64Array.from(o.left, z => appliquerPlatt(c, z)), right: Float64Array.from(o.right, z => appliquerPlatt(c, z)) }));
  return { p10: cal(pli.cal10, a10), p5: a5 && pli.cal5 ? cal(pli.cal5, a5) : null };
}

/* ------------------------------------------------------------------ références : H0, règle prudente figée, hasard */
const REGLES_PRUDENTES = Object.freeze({ variante: 'chaine+h', seuilMm: 8, lateralMaxMm: 45, ecartementMedianeMm: 15, confianceMin: 0, zones: ['pn', 'adv', 'abords'], roles: ['vert'] });
/* Lit les réglages figés du dépôt (datasets/relecture-reglages-proposes.json) : l'essai vérifie qu'ils sont ceux de REGLES_PRUDENTES. */
function reglesPrudentesDuDepot(fichier = path.join(__dirname, '..', 'datasets', 'relecture-reglages-proposes.json')) {
  const g = JSON.parse(fs.readFileSync(fichier, 'utf8')), z = g.zones || {};
  return { variante: g.variante && g.variante.proposition, seuilMm: (z.pn || {}).seuilMm, lateralMaxMm: g.voie && g.voie.lateralMaxMm, ecartementMedianeMm: g.coherence && g.coherence.ecartementMaxMm,
    confianceMin: (z.pn || {}).confianceMin, zones: Object.keys(z).filter(x => z[x].corriger === true).map(x => x === 'vert-hors-zone' ? 'hors' : x).sort(), roles: g.roles };
}
/* Pose de la règle prudente `chaine+h` sur le jeu : la pose de la chaîne (H3 « chaine », sinon l'A* du moteur H1 : la décision du lot sans appui)
 * avec la hauteur apprise quand elle existe. Rend { i, j } ou null (le moteur s'abstient). */
function poseChaineH(k) {
  const choix = {};
  for (const s of SIDES) {
    const hy = k.rails[s].hyps;
    const base = hy.find(h => !h.hauteur && h.sousOrigines.includes('chaine')) || hy.find(h => !h.hauteur && h.origines.includes('H1'));
    if (!base) return null;
    const v = hy.find(h => h.hauteur && h.rang === base.rang);
    choix[s] = hy.indexOf(v || base);
  }
  return { i: choix.left, j: choix.right };
}
function reglePrudente(k, R = REGLES_PRUDENTES) {
  const r = { partie: k.partie, cut: k.cut, zone: k.zone, role: k.role, mic: k.etiq.micMaxMm, etat: 'abstient', e: null, lat: null };
  const pose = k.chaineDifferee ? null : poseChaineH(k);
  if (!pose) return r;
  const hl = k.rails.left.hyps[pose.i], hr = k.rails.right.hyps[pose.j];
  if (!R.zones.includes(k.zone) || !R.roles.includes(k.role)) { r.etat = 'laisse'; return r; }
  const conf = Math.min(...SIDES.map(s => fini(k.rails[s].confiance) ? k.rails[s].confiance : -1));
  const g = ecartementPaire(k, hl, hr);
  const agit = Math.max(pire(hl.decal), pire(hr.decal)) >= R.seuilMm && Math.max(Math.abs(hl.decal[1]), Math.abs(hr.decal[1])) <= R.lateralMaxMm
    && conf >= R.confianceMin && fini(g) && fini(k.gMed) && Math.abs(g - k.gMed) <= R.ecartementMedianeMm;
  if (!agit) { r.etat = 'laisse'; return r; }
  const o = issueDePaire(k, pose.i, pose.j);
  return { ...r, etat: 'agit', e: o.e, lat: o.lat };
}
/* (a) H0 : ne rien faire. */
const resultatH0 = k => ({ partie: k.partie, cut: k.cut, zone: k.zone, role: k.role, mic: k.etiq.micMaxMm, etat: 'laisse', e: null, lat: null });

/* ------------------------------------------------------------------ variantes par zone (D-204) */
const FORMAT_VARIANTES = 'ariane-gcv2-variantes-v1';
const FICHIER_VARIANTES = path.join(__dirname, '..', 'datasets', 'gcv2-variantes.json');
/* Lit et vérifie les variantes. Une variante n'agit que sur des verts, et la règle prudente n'y agit que dans son propre périmètre. */
function lireVariantes(fichier = FICHIER_VARIANTES) {
  const g = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  if (g.format !== FORMAT_VARIANTES) throw Error(`variantes : format ${FORMAT_VARIANTES} attendu`);
  const defs = g.variantes || {}, liste = (d, quoi) => {
    if (!d || !Array.isArray(d.zones) || !Array.isArray(d.roles)) throw Error(`variantes : « ${quoi} » doit nommer des zones et des rôles`);
    return { zones: [...d.zones], roles: [...d.roles] };
  };
  const out = {};
  for (const nom of Object.keys(defs)) {
    const gcv2 = liste(defs[nom].gcv2, `${nom}.gcv2`), prudente = liste(defs[nom].prudente, `${nom}.prudente`);
    for (const l of [gcv2, prudente]) {
      if (l.zones.some(z => !ZONES.includes(z))) throw Error(`variantes : ${nom} nomme une zone inconnue`);
      if (l.roles.some(r => r !== 'vert')) throw Error(`variantes : ${nom} ne peut agir que sur des verts (ni rouge ni différé)`);
    }
    if (prudente.zones.some(z => !REGLES_PRUDENTES.zones.includes(z))) throw Error(`variantes : ${nom} donne à la règle prudente une zone hors de son périmètre`);
    out[nom] = { resume: defs[nom].resume || null, gcv2, prudente };
  }
  return out;
}
/* Résultat d'une variante pour un cut : celui de la GCV2 (`rG`), celui de la règle prudente (`rP`), ou « laisser » (H0). */
function appliquerVariante(k, nom, rG, rP, defs = lireVariantes()) {
  const d = defs[nom];
  if (!d) throw Error(`variante « ${nom} » inconnue (${Object.keys(defs).join(' | ')})`);
  const dans = l => l.zones.includes(k.zone) && l.roles.includes(k.role);
  if (dans(d.gcv2)) return rG;
  if (dans(d.prudente)) return rP;
  return resultatH0(k);
}

/* ------------------------------------------------------------------ mesures */
const COMPTEURS = ['visites', 'micSup5', 'micSup10', 'agit', 'justes', 'justes5', 'reproduit10', 'abimes', 'aggraves', 'mauvaiseVoie', 'erreurs', 'abstentions', 'laisseFaux'];
function bilanVide() { return Object.fromEntries(COMPTEURS.map(c => [c, 0])); }
/* Ajoute un résultat (poids p, 1 par défaut) à un bilan. Définitions (fiche § 3) :
 *  justes      Mic > 10 mm et la pose est à 10 mm ou moins de lui ; justes5 : à 5 mm ou moins ;
 *  abimes      on agit sur un cut que Mic laisse à 5 mm ou moins (ou presque) et la pose est à plus de 10 mm ; aggraves : Mic > 5 mm et on l'aggrave de plus de 5 mm ;
 *  mauvaiseVoie  on agit et la pose est à plus de 50 mm de celle de Mic (mauvais rail) ou déplace un rail de plus de 45 mm en latéral ;
 *  erreurs     on agit et la pose reste à plus de 10 mm de celle de Mic (porte : 9 % au plus des actions) ;
 *  abstentions la décision avait une pose candidate mais pas assez sûre ; laisseFaux : Mic > 10 mm et on n'agit pas. */
function compterVisite(b, mic, p = 1) { b.visites += p; if (mic > 5) b.micSup5 += p; if (mic > 10) b.micSup10 += p; return b; }
/* Ce que vaut une action (poids p) : r = { mic, e, lat }. */
function compterAction(b, r, p = 1) {
  b.agit += p;
  if (r.e > 10) b.erreurs += p;
  if (r.mic > 10 && r.e <= 10) b.justes += p;
  if (r.mic > 10 && r.e <= 5) b.justes5 += p;
  if (r.mic > 5 && r.e <= 10) b.reproduit10 += p;
  if (r.mic <= 5 && r.e > 10) b.abimes += p;
  if (r.mic > 5 && r.e > r.mic + 5) b.aggraves += p;
  if (r.e > SEUILS.mauvaiseVoie || r.lat > GARDES.lateralMaxMm) b.mauvaiseVoie += p;
  return b;
}
function ajouterBilan(b, r) {
  compterVisite(b, r.mic);
  if (r.etat === 'abstient') b.abstentions++;
  if (r.etat !== 'agit') { if (r.mic > 10) b.laisseFaux++; return b; }
  return compterAction(b, r);
}
const bilanDe = (rs, f = () => true) => rs.filter(f).reduce((b, r) => ajouterBilan(b, r), bilanVide());
const sommeBilans = bs => bs.reduce((a, b) => { for (const c of COMPTEURS) a[c] += b[c]; return a; }, bilanVide());
const dansPerimetrePrudent = r => REGLES_PRUDENTES.zones.includes(r.zone) && REGLES_PRUDENTES.roles.includes(r.role);
const arr = b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * 10) / 10]));
function synthese(rs) {
  const out = { total: bilanDe(rs), perimetrePrudent: bilanDe(rs, dansPerimetrePrudent), parZone: {}, parRole: {} };
  for (const z of ZONES) out.parZone[z] = bilanDe(rs, r => r.zone === z);
  for (const o of ROLES) out.parRole[o] = bilanDe(rs, r => r.role === o);
  return out;
}

/* Hasard : en espérance exacte. Dans chaque zone, la GCV2 agit sur la part `taux[zone]` des cuts ; le hasard agit sur cette même part de cuts,
 * avec une paire tirée uniformément parmi les paires permises par les garde-fous (sauf H0, H0). Rend des bilans en espérance (décimaux). */
function hasardEnEsperance(cas, taux) {
  const par = { total: bilanVide(), perimetrePrudent: bilanVide(), parZone: Object.fromEntries(ZONES.map(z => [z, bilanVide()])), parRole: Object.fromEntries(ROLES.map(r => [r, bilanVide()])) };
  for (const k of cas) {
    const mic = k.etiq.micMaxMm, N = k.paires.length, t = N ? (taux[k.zone] || 0) : 0;
    const cibles = [par.total, par.parZone[k.zone], par.parRole[k.role]];
    if (dansPerimetrePrudent(k)) cibles.push(par.perimetrePrudent);
    for (const b of cibles) { compterVisite(b, mic); if (mic > 10) b.laisseFaux += 1 - t; }
    if (!t) continue;
    for (const q of k.paires) {
      const o = issueDePaire(k, q.i, q.j);
      for (const b of cibles) compterAction(b, { mic, e: o.e, lat: o.lat }, t / N);
    }
  }
  return par;
}

/* Courbe de fiabilité en 10 classes (p moyen, taux observé) et Brier. `paires` : [[p, y, poids]]. */
function fiabilite(paires, classes = 10) {
  const bins = Array.from({ length: classes }, () => ({ n: 0, p: 0, y: 0 }));
  let brier = 0;
  for (const [p, y] of paires) { const b = bins[Math.min(classes - 1, Math.floor(p * classes))]; b.n++; b.p += p; b.y += y; brier += (p - y) ** 2; }
  return { n: paires.length, brier: paires.length ? brier / paires.length : null,
    classes: bins.map((b, i) => ({ de: i / classes, a: (i + 1) / classes, n: b.n, pMoyen: b.n ? b.p / b.n : null, observe: b.n ? b.y / b.n : null })) };
}

/* ------------------------------------------------------------------ validation croisée par partie */
function validationCroisee(parties, { usage = 'relecture', lambda = LAMBDA, accord = true, espion = () => {}, cible = CIBLE, journal = () => {}, variantes = [], defsVariantes } = {}) {
  const defs = variantes.length ? (defsVariantes || lireVariantes()) : null, methodesV = Object.fromEntries(variantes.map(v => [v, []]));
  for (const v of variantes) if (!defs[v]) throw Error(`variante « ${v} » inconnue (${Object.keys(defs).join(' | ')})`);
  const noms = parties.map(j => j.partie), casParPartie = Object.fromEntries(parties.map(j => [j.partie, construireCas(j, usage)]));
  const methodes = { gcv2: [], prudente: [], h0: [] }, plis = [], hasard = { total: bilanVide(), perimetrePrudent: bilanVide(), parZone: Object.fromEntries(ZONES.map(z => [z, bilanVide()])), parRole: Object.fromEntries(ROLES.map(r => [r, bilanVide()])) };
  const parPartie = {}, fiab10 = [], fiab5 = [], fiabGagnants = [], coefs = [], hasardParPartie = {};
  for (const jugee of noms) {
    const app = noms.filter(n => n !== jugee).flatMap(n => casParPartie[n]), test = casParPartie[jugee];
    espion('pli', noms.filter(n => n !== jugee));
    const t0 = Date.now(), pli = apprendrePli(app, { lambda, accord, espion: (nom, ps) => { if (ps.includes(jugee)) throw Error(`fuite : la partie jugée ${jugee} est lue par « ${nom} »`); espion(nom, ps); }, cible });
    const J = jugerPli(pli, test);
    const dec = test.map((k, i) => decider(k, J.p10[i], pli.seuils)), rs = test.map((k, i) => resultatDeDecision(k, dec[i]));
    const rsP = test.map(k => reglePrudente(k)), rsH = test.map(resultatH0);
    methodes.gcv2.push(...rs); methodes.prudente.push(...rsP); methodes.h0.push(...rsH);
    const rsV = {}; for (const v of variantes) { rsV[v] = test.map((k, i) => appliquerVariante(k, v, rs[i], rsP[i], defs)); methodesV[v].push(...rsV[v]); }
    /* hasard : taux d'action de la GCV2 par zone, sur cette partie */
    const taux = {}; for (const z of ZONES) { const n = rs.filter(r => r.zone === z).length; taux[z] = n ? rs.filter(r => r.zone === z && r.etat === 'agit').length / n : 0; }
    const h = hasardEnEsperance(test, taux); hasardParPartie[jugee] = h;
    for (const b of [h.total, h.perimetrePrudent]) void b;
    for (const c of COMPTEURS) { hasard.total[c] += h.total[c]; hasard.perimetrePrudent[c] += h.perimetrePrudent[c]; for (const z of ZONES) hasard.parZone[z][c] += h.parZone[z][c]; for (const o of ROLES) hasard.parRole[o][c] += h.parRole[o][c]; }
    /* calibrage */
    test.forEach((k, i) => {
      for (const s of SIDES) k.rails[s].hyps.forEach((hh, hi) => { fiab10.push([J.p10[i][s][hi], hh.y.ecartMm <= 10 ? 1 : 0]); if (J.p5) fiab5.push([J.p5[i][s][hi], hh.y.ecartMm <= 5 ? 1 : 0]); });
      const { best } = meilleurePaire(k, J.p10[i]);
      const o = issueDePaire(k, best.i, best.j); fiabGagnants.push([best.p, o.e <= 10 ? 1 : 0, best.h0 ? 1 : 0]);
    });
    coefs.push({ partie: jugee, noms: pli.modele.fit.noms, coef10: pli.modele.m10.coef, intercept10: pli.modele.m10.intercept });
    parPartie[jugee] = { empreinteModele: empreinteModele(pli.modele), gcv2: synthese(rs), prudente: synthese(rsP), h0: synthese(rsH), hasard: arrondiSynth(h), seuils: pli.seuils, calibrage10: pli.cal10, calibrage5: pli.cal5, nCas: test.length, nExemplesApp: pli.modele.n };
    if (variantes.length) parPartie[jugee].variantes = Object.fromEntries(variantes.map(v => [v, synthese(rsV[v])]));
    plis.push(jugee);
    journal(`pli ${jugee} : ${test.length} cuts, ${((Date.now() - t0) / 1000).toFixed(0)} s, agit ${rs.filter(r => r.etat === 'agit').length}`);
  }
  const arrondiHasard = arrondiSynth(hasard);
  return { format: FORMAT_VALID, version: VERSION, usage, lambda, accord, graine: GRAINE, parties: noms,
    nCas: noms.reduce((a, n) => a + casParPartie[n].length, 0),
    total: { gcv2: synthese(methodes.gcv2), prudente: synthese(methodes.prudente), h0: synthese(methodes.h0), hasard: arrondiHasard },
    parPartie, calibrage: { p10: fiabilite(fiab10), p5: fiab5.length ? fiabilite(fiab5) : null, gagnants: fiabilite(fiabGagnants.map(([p, y]) => [p, y])), gagnantsHorsH0: fiabilite(fiabGagnants.filter(g => !g[2]).map(([p, y]) => [p, y])) },
    coefficients: resumeCoefficients(coefs),
    ...(variantes.length ? { variantes: Object.fromEntries(variantes.map(v => [v, synthese(methodesV[v])])), variantesDef: Object.fromEntries(variantes.map(v => [v, defs[v]])) } : {}) };
}
/* Empreinte de tout ce qu'un modèle a appris : colonnes, normalisation, vocabulaires, coefficients. */
function empreinteModele(m) {
  return sha256(JSON.stringify({ noms: m.fit.noms, num: m.fit.num, cat: m.fit.cat, multi: m.fit.multi, c10: m.m10.coef, b10: m.m10.intercept, c5: m.m5 && m.m5.coef, b5: m.m5 && m.m5.intercept })).slice(0, 16);
}
function arrondiSynth(s) { return { total: arr(s.total), perimetrePrudent: arr(s.perimetrePrudent), parZone: Object.fromEntries(Object.entries(s.parZone).map(([k, v]) => [k, arr(v)])), parRole: Object.fromEntries(Object.entries(s.parRole).map(([k, v]) => [k, arr(v)])) }; }
/* Coefficients des 11 plis : moyenne, écart, part des plis de même signe. Les colonnes d'un pli peuvent différer (vocabulaires) : on joint par nom. */
function resumeCoefficients(plis) {
  const par = new Map();
  for (const p of plis) p.noms.forEach((n, i) => { if (!par.has(n)) par.set(n, []); par.get(n).push(p.coef10[i]); });
  const out = [...par].map(([nom, v]) => { const m = v.reduce((a, b) => a + b, 0) / plis.length, pos = v.filter(x => x > 0).length, neg = v.filter(x => x < 0).length;
    return { nom, moyenne: arrondi(m, 3), plis: v.length, memeSigne: Math.max(pos, neg) / v.length }; });
  return out.sort((a, b) => Math.abs(b.moyenne) - Math.abs(a.moyenne)).slice(0, 40);
}

/* ------------------------------------------------------------------ export des paramètres */
function exporter(parties, { usages = ['relecture', 'lot'], lambda = LAMBDA, accord = true, date, cible = CIBLE, journal = () => {} } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw Error('exporter : --date AAAA-MM-JJ attendue');
  const noms = parties.map(j => j.partie), out = { format: FORMAT_PARAMS, version: VERSION, date, graine: GRAINE, lambda, accord,
    note: 'Paramètres de la GCV2 appris sur les parties nommées. Aucune coordonnée, aucune ligne d\'exemple : des coefficients, des moyennes, des seuils et des empreintes.',
    parties: noms.map(n => ({ partie: n, sha256: parties.find(j => j.partie === n).sha256 })), garde: { ...GARDES, contratMm: [...GARDES.contratMm] },
    cible: { ...CIBLE }, listeBlanche: listeBlancheExportable(accord), interdits: [...INTERDITS], usages: {} };
  for (const usage of usages) {
    const cas = parties.flatMap(j => construireCas(j, usage)), t0 = Date.now();
    /* Calibrage et seuils : sur les scores hors-échantillon de toutes les parties (une partie jugée par un modèle qui ne l'a pas vue). */
    const pli = apprendrePli(cas, { lambda, accord, cible });
    out.usages[usage] = {
      nCas: cas.length, nExemples: pli.modele.n, colonnes: pli.modele.fit.noms,
      normalisation: pli.modele.fit.num.map((f, i) => f && !f.constant ? { nom: NUM[i].nom, moyenne: arrondi(f.moy, 6), ecartType: arrondi(f.sd, 6), manque: f.manque } : null).filter(Boolean),
      categories: Object.fromEntries([...CAT.map((t, i) => [t.nom, pli.modele.fit.cat[i]]), ...MULTI.map((t, i) => [t.nom, pli.modele.fit.multi[i]])]),
      modele10: { intercept: arrondi(pli.modele.m10.intercept, 6), coefficients: pli.modele.m10.coef.map(v => arrondi(v, 6)) },
      modele5: { intercept: arrondi(pli.modele.m5.intercept, 6), coefficients: pli.modele.m5.coef.map(v => arrondi(v, 6)) },
      calibrage10: { methode: 'platt', a: arrondi(pli.cal10.a, 6), b: arrondi(pli.cal10.b, 6) }, calibrage5: { methode: 'platt', a: arrondi(pli.cal5.a, 6), b: arrondi(pli.cal5.b, 6) },
      seuils: Object.fromEntries(ZONES.map(z => [z, { actif: pli.seuils[z].actif, tau: pli.seuils[z].tau, delta: pli.seuils[z].delta }])),
      seuilsApprentissage: Object.fromEntries(ZONES.map(z => [z, { agit: pli.seuils[z].agit, justes: pli.seuils[z].justes, erreurs: pli.seuils[z].erreurs, abimes: pli.seuils[z].abimes }])),
    };
    journal(`export ${usage} : ${cas.length} cuts, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  return out;
}
function listeBlancheExportable(accord = true) {
  const f = (t, type) => ({ nom: t.nom, source: t.src, chemin: t.chemin, transformation: t.tr, type });
  return [...NUM.filter(t => accord || !SANS_ACCORD(t.nom)).map(t => f(t, t.tr === 'bool' ? 'booleen' : 'numerique')), ...CAT.map(t => f(t, 'categorie')), ...MULTI.map(t => f(t, 'multiple'))];
}
/* Sérialisation stable : mêmes entrées, mêmes octets. */
const serialiser = o => JSON.stringify(o, null, 1) + '\n';

/* ------------------------------------------------------------------ rapport en tableaux */
const pc = (a, b) => b ? `${(Math.round(1000 * a / b) / 10).toString().replace('.', ',')} %` : '—';
const nb = v => Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toString().replace('.', ',');
const LIGNE = b => `${nb(b.visites)} | ${nb(b.micSup10)} | ${nb(b.agit)} | ${nb(b.justes)} | ${nb(b.justes5)} | ${nb(b.abimes)} | ${nb(b.mauvaiseVoie)} | ${nb(b.erreurs)} (${pc(b.erreurs, b.agit)}) | ${nb(b.abstentions)} | ${nb(b.laisseFaux)}`;
const ENTETE = 'visités | Mic > 10 mm | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions) | abstentions | grosses laissées fausses';
function wilsonTexte(b) { const w = wilson(b.erreurs, b.agit); return w.haut == null ? '—' : `≤ ${(Math.round(1000 * w.haut) / 10).toString().replace('.', ',')} %`; }
/* La porte du plan (D-201, G0 § 4) : 0 mauvaise voie, erreur parmi les actions ≤ 9 %, corrections justes ≥ celles de la règle prudente, abîmés ≤ ceux de la
 * règle prudente. Lue sur tous les cuts jugés (G) et sur le périmètre de la règle prudente (P : verts de PN, ADV et abords). */
function porte(V) {
  const lire = (g, r) => {
    const w = wilson(g.erreurs, g.agit), erreur = g.agit ? g.erreurs / g.agit : null;
    return { mauvaiseVoie: g.mauvaiseVoie === 0, erreur: g.agit ? erreur <= 0.09 : false, erreurTaux: erreur, wilsonHaut: w.haut, justes: g.justes >= r.justes, abimes: g.abimes <= r.abimes,
      borneHaute: w.haut != null && w.haut <= 0.09, valeurs: { gcv2: { agit: g.agit, justes: g.justes, abimes: g.abimes, mauvaiseVoie: g.mauvaiseVoie, erreurs: g.erreurs }, prudente: { agit: r.agit, justes: r.justes, abimes: r.abimes, mauvaiseVoie: r.mauvaiseVoie } } };
  };
  const tout = lire(V.total.gcv2.total, V.total.prudente.total), perimetre = lire(V.total.gcv2.perimetrePrudent, V.total.prudente.perimetrePrudent);
  const ok = o => o.mauvaiseVoie && o.erreur && o.justes && o.abimes;
  return { tout, perimetre, tenue: ok(tout), tenuePerimetre: ok(perimetre) };
}
function rapport(V) {
  const L = [], M = [['gcv2', 'GCV2'], ['prudente', 'règle prudente'], ['hasard', 'hasard'], ['h0', 'H0 (ne rien faire)']];
  L.push(`## Usage « ${V.usage} » (${V.nCas} cuts jugés, ${V.parties.length} plis)`, '');
  L.push('### Total, par méthode (mêmes cuts)', '', `méthode | ${ENTETE} | Wilson haut`, '---|' + '--:|'.repeat(10) + '---');
  for (const [k, nom] of M) L.push(`${nom} | ${LIGNE(V.total[k].total)} | ${wilsonTexte(V.total[k].total)}`);
  L.push('', '### Dans le périmètre de la règle prudente (verts de PN, ADV et abords)', '', `méthode | ${ENTETE} | Wilson haut`, '---|' + '--:|'.repeat(10) + '---');
  for (const [k, nom] of M) L.push(`${nom} | ${LIGNE(V.total[k].perimetrePrudent)} | ${wilsonTexte(V.total[k].perimetrePrudent)}`);
  L.push('', '### Par partie jugée (GCV2 | règle prudente)', '', `partie | ${ENTETE} | règle prudente : agit | justes | abîmés | mauvaise voie`, '---|' + '--:|'.repeat(10) + '--:|--:|--:|--:');
  for (const p of V.parties) { const g = V.parPartie[p].gcv2.total, r = V.parPartie[p].prudente.total; L.push(`${p} | ${LIGNE(g)} | ${nb(r.agit)} | ${nb(r.justes)} | ${nb(r.abimes)} | ${nb(r.mauvaiseVoie)}`); }
  L.push('', '### Par zone (GCV2 | règle prudente | hasard)', '', `zone | méthode | ${ENTETE}`, '---|---|' + '--:|'.repeat(10));
  for (const z of ZONES) for (const [k, nom] of M.slice(0, 3)) L.push(`${z} | ${nom} | ${LIGNE(V.total[k].parZone[z])}`);
  L.push('', '### Par rôle du cut', '', `rôle | méthode | ${ENTETE}`, '---|---|' + '--:|'.repeat(10));
  for (const o of ROLES) for (const [k, nom] of M.slice(0, 3)) L.push(`${o} | ${nom} | ${LIGNE(V.total[k].parRole[o])}`);
  const fb = c => c.classes.map(x => `${x.n ? nb(Math.round(100 * x.pMoyen)) + '/' + nb(Math.round(100 * x.observe)) : '—'}`).join(' ');
  const P = porte(V), oui = x => x ? 'oui' : 'NON';
  L.push('', '### Porte du plan (0 mauvaise voie, erreur ≤ 9 %, corrections justes ≥ règle prudente, abîmés ≤ règle prudente)', '', 'lecture | 0 mauvaise voie | erreur ≤ 9 % | borne de Wilson ≤ 9 % | justes ≥ prudente | abîmés ≤ prudente | porte tenue', '---|---|---|---|---|---|---');
  for (const [nom, o, t] of [['tous les cuts', P.tout, P.tenue], ['périmètre de la règle prudente', P.perimetre, P.tenuePerimetre]]) L.push(`${nom} | ${oui(o.mauvaiseVoie)} | ${oui(o.erreur)} (${o.erreurTaux == null ? '—' : (Math.round(1000 * o.erreurTaux) / 10).toString().replace('.', ',') + ' %'}) | ${oui(o.borneHaute)} (≤ ${o.wilsonHaut == null ? '—' : (Math.round(1000 * o.wilsonHaut) / 10).toString().replace('.', ',') + ' %'}) | ${oui(o.justes)} (${nb(o.valeurs.gcv2.justes)} contre ${nb(o.valeurs.prudente.justes)}) | ${oui(o.abimes)} (${nb(o.valeurs.gcv2.abimes)} contre ${nb(o.valeurs.prudente.abimes)}) | ${oui(t)}`);
  L.push('', `### Calibrage (hors-échantillon)`, '', `Brier p(10 mm) ${arrondi(V.calibrage.p10.brier, 4)} sur ${V.calibrage.p10.n} hypothèses${V.calibrage.p5 ? ` ; p(5 mm) ${arrondi(V.calibrage.p5.brier, 4)}` : ''} ; paire gagnante ${arrondi(V.calibrage.gagnants.brier, 4)} (${V.calibrage.gagnants.n} cuts).`,
    '', 'classe | n (10 mm) | p moyen | observé | n (gagnants) | p moyen | observé', '---|--:|--:|--:|--:|--:|--:');
  V.calibrage.p10.classes.forEach((c, i) => { const g = V.calibrage.gagnants.classes[i]; L.push(`${i * 10}–${i * 10 + 10} % | ${c.n} | ${c.n ? arrondi(c.pMoyen, 3) : '—'} | ${c.n ? arrondi(c.observe, 3) : '—'} | ${g.n} | ${g.n ? arrondi(g.pMoyen, 3) : '—'} | ${g.n ? arrondi(g.observe, 3) : '—'}`); });
  void fb;
  L.push('', '### Seuils par pli', '', 'partie jugée | ' + ZONES.map(z => `${z} (τ, δ)`).join(' | '), '---|' + '---|'.repeat(ZONES.length));
  for (const p of V.parties) L.push(`${p} | ${ZONES.map(z => { const s = V.parPartie[p].seuils[z]; return s.actif ? `${s.tau} ; ${s.delta}` : 'inactive'; }).join(' | ')}`);
  L.push('', '### Traits dominants (coefficient moyen sur les plis, traits normalisés)', '', 'trait | coefficient moyen | plis de même signe', '---|--:|--:');
  for (const c of V.coefficients.slice(0, 20)) L.push(`${c.nom} | ${c.moyenne} | ${Math.round(100 * c.memeSigne)} %`);
  if (V.variantes) L.push('', rapportVariantes(V));
  return L.join('\n');
}
/* Les variantes par zone (D-204), mêmes cuts et mêmes plis que le rapport de base : variante, règle prudente seule, GCV2 seule, hasard et H0. */
function rapportVariantes(V) {
  const L = [], oui = x => x ? 'oui' : 'NON', p1 = x => x == null ? '—' : (Math.round(1000 * x) / 10).toString().replace('.', ',') + ' %';
  const liste = l => l.zones.length && l.roles.length ? `${l.zones.join(', ')} (${l.roles.join(', ')})` : 'rien';
  for (const nom of Object.keys(V.variantes)) {
    const S = V.variantes[nom], d = V.variantesDef[nom], tete = `méthode | ${ENTETE} | Wilson haut`, ligne = '---|' + '--:|'.repeat(10) + '---';
    L.push(`## Variante ${nom} — usage « ${V.usage} » (${V.nCas} cuts jugés, ${V.parties.length} plis)`, '', `GCV2 : ${liste(d.gcv2)} ; règle prudente : ${liste(d.prudente)} ; partout ailleurs : rien. τ et δ : ceux appris dans chaque pli.`, '');
    L.push(`### Total, ${nom} contre les références (mêmes cuts)`, '', tete, ligne);
    for (const [nomM, b] of [[nom, S.total], ['règle prudente seule', V.total.prudente.total], ['GCV2 seule', V.total.gcv2.total], ['hasard', V.total.hasard.total], ['H0 (ne rien faire)', V.total.h0.total]]) L.push(`${nomM} | ${LIGNE(b)} | ${wilsonTexte(b)}`);
    L.push('', `### Dans le périmètre de la règle prudente (verts de PN, ADV et abords), ${nom}`, '', tete, ligne);
    for (const [nomM, b] of [[nom, S.perimetrePrudent], ['règle prudente seule', V.total.prudente.perimetrePrudent], ['GCV2 seule', V.total.gcv2.perimetrePrudent]]) L.push(`${nomM} | ${LIGNE(b)} | ${wilsonTexte(b)}`);
    L.push('', `### Par zone (${nom} | règle prudente seule | GCV2 seule)`, '', `zone | méthode | ${ENTETE}`, '---|---|' + '--:|'.repeat(10));
    for (const z of ZONES) for (const [nomM, b] of [[nom, S.parZone[z]], ['règle prudente', V.total.prudente.parZone[z]], ['GCV2 seule', V.total.gcv2.parZone[z]]]) L.push(`${z} | ${nomM} | ${LIGNE(b)}`);
    L.push('', `### Par rôle du cut (${nom} | règle prudente seule | GCV2 seule)`, '', `rôle | méthode | ${ENTETE}`, '---|---|' + '--:|'.repeat(10));
    for (const o of ROLES) for (const [nomM, b] of [[nom, S.parRole[o]], ['règle prudente', V.total.prudente.parRole[o]], ['GCV2 seule', V.total.gcv2.parRole[o]]]) L.push(`${o} | ${nomM} | ${LIGNE(b)}`);
    L.push('', `### Par partie jugée (${nom} | règle prudente)`, '', `partie | ${ENTETE} | règle prudente : agit | justes | abîmés | mauvaise voie`, '---|' + '--:|'.repeat(10) + '--:|--:|--:|--:');
    for (const q of V.parties) { const g = V.parPartie[q].variantes[nom].total, r = V.parPartie[q].prudente.total; L.push(`${q} | ${LIGNE(g)} | ${nb(r.agit)} | ${nb(r.justes)} | ${nb(r.abimes)} | ${nb(r.mauvaiseVoie)}`); }
    const P = porte({ total: { gcv2: S, prudente: V.total.prudente } });
    L.push('', `### Porte du plan, ${nom} (0 mauvaise voie, erreur ≤ 9 %, corrections justes ≥ règle prudente, abîmés ≤ règle prudente)`, '', 'lecture | 0 mauvaise voie | erreur ≤ 9 % | borne de Wilson ≤ 9 % | justes ≥ prudente | abîmés ≤ prudente | porte tenue', '---|---|---|---|---|---|---');
    for (const [nomL, o, t] of [['tous les cuts', P.tout, P.tenue], ['périmètre de la règle prudente', P.perimetre, P.tenuePerimetre]]) L.push(`${nomL} | ${oui(o.mauvaiseVoie)} (${nb(o.valeurs.gcv2.mauvaiseVoie)}) | ${oui(o.erreur)} (${p1(o.erreurTaux)}) | ${oui(o.borneHaute)} (≤ ${p1(o.wilsonHaut)}) | ${oui(o.justes)} (${nb(o.valeurs.gcv2.justes)} contre ${nb(o.valeurs.prudente.justes)}) | ${oui(o.abimes)} (${nb(o.valeurs.gcv2.abimes)} contre ${nb(o.valeurs.prudente.abimes)}) | ${oui(t)}`);
    L.push('');
  }
  return L.join('\n');
}

/* ------------------------------------------------------------------ ligne de commande */
function args(argv) {
  const o = { jeux: [], jsons: [], variantes: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--jeu') o.jeux.push(argv[++i]); else if (a === '--json') o.jsons.push(argv[++i]); else if (a === '--usage') o.usage = argv[++i];
    else if (a === '--lambda') o.lambda = Number(argv[++i]); else if (a === '--sortie') o.sortie = argv[++i]; else if (a === '--date') o.date = argv[++i];
    else if (a === '--variante') o.variantes.push(...String(argv[++i]).split(',').map(x => x.trim()).filter(Boolean));
    else if (a === '--sans-accord') o.accord = false; else if (a === '--erreur-max') o.erreurMax = Number(argv[++i]); else if (!o.mode) o.mode = a; else throw Error(`argument inconnu : ${a}`);
  }
  return o;
}
function main(argv) {
  const a = args(argv), journal = m => process.stderr.write(m + '\n');
  if (a.mode === 'valider' || a.mode === 'exporter') {
    if (!a.jeux.length) throw Error('--jeu JEU.jsonl attendu (au moins un)');
    const parties = a.jeux.map(f => lireJeuFichier(f));
    const cible = { ...CIBLE, ...(a.erreurMax ? { erreurMax: a.erreurMax } : {}) };
    if (a.mode === 'valider') {
      if (!a.usage) throw Error('--usage relecture|lot attendu');
      const V = validationCroisee(parties, { usage: a.usage, lambda: a.lambda || LAMBDA, accord: a.accord !== false, cible, journal, variantes: [...new Set(a.variantes)] });
      if (a.sortie) fs.writeFileSync(a.sortie, JSON.stringify(V)); process.stdout.write(rapport(V) + '\n');
    } else {
      if (!a.sortie) throw Error('--sortie datasets/gcv2-parametres.json attendu');
      const date = a.date || new Date().toISOString().slice(0, 10);
      fs.writeFileSync(a.sortie, serialiser(exporter(parties, { lambda: a.lambda || LAMBDA, accord: a.accord !== false, date, cible, journal })));
      process.stdout.write(`écrit ${a.sortie}\n`);
    }
  } else if (a.mode === 'rapport') {
    if (!a.jsons.length) throw Error('--json V.json attendu');
    for (const f of a.jsons) process.stdout.write(rapport(JSON.parse(fs.readFileSync(f, 'utf8'))) + '\n\n');
  } else if (a.mode === 'essai') {
    process.stdout.write('node --test tests/gcv2-apprendre.test.cjs\n');
  } else throw Error('mode : valider | exporter | rapport | essai');
}
module.exports = {
  FORMAT_PARAMS, FORMAT_VALID, VERSION, SEUILS, GARDES, ZONES, ROLES, CIBLE, LAMBDA, GRAINE, INTERDITS, NUM, CAT, MULTI, REGLES_PRUDENTES,
  verifierListeBlanche, estInterdit, wilson, mulberry32, sigmoide, lignesDeTexte, jeuDeLignes, lireJeuFichier, construireCas, appliquerUsage, accords, brut,
  pairesPermises, paireValide, ecartementPaire, ajusterCodage, coder, matrice, ajusterLogistique, ajusterArbres, scoresArbres, platt, appliquerPlatt, exemples, poidsParPartie, entrainer, scorer, parCas,
  meilleurePaire, decider, choisirSeuils, apprendrePli, jugerPli, reglePrudente, reglesPrudentesDuDepot, poseChaineH, resultatH0, resultatDeDecision, bilanDe, synthese, hasardEnEsperance,
  fiabilite, porte, validationCroisee, exporter, serialiser, listeBlancheExportable, rapport,
  FORMAT_VARIANTES, FICHIER_VARIANTES, lireVariantes, appliquerVariante, rapportVariantes, args,
};
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(`gcv2-apprendre : ${e.message}\n`); process.exit(1); } }
