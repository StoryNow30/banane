#!/usr/bin/env node
'use strict';
/*
 * ch100-b1-ecart.cjs — CH-100, mesure 1 : « B1-écart, base à battre ». Hors ligne, lecture seule, aucune dépendance.
 *
 * Inventaire puis jugement de l'ombre `voie-b1-ecart-ombre` (CH-055) telle que l'extension l'a CONSIGNÉE au journal des lots
 * (ce n'est pas un rejeu : la référence de CH-057 § 2, 44 justes sur 67, vient du rejeu `tools/rejeu-voie-predite.cjs`).
 *
 *   node tools/ch100-b1-ecart.cjs --collections <banane-data/collections> [--depuis 2026-11-04] [--jusqu 2026-11-10]
 *        [--apres 2026-11-05] [--ecart-serie 10] [--json sortie.json] [--csv sortie.csv]
 *   node tools/ch100-b1-ecart.cjs --lot <dossier-d-un-lot> [--echo <dossier>]... [--nom étiquette] [--json …] [--csv …]
 *
 * `--collections` : chaque collection `AAAA-MM-JJ_*` de la plage est lue dans son `raw/` ; les archives `ariane-lot-<horodatage>` y sont
 * regroupées PAR HORODATAGE (un lot par horodatage : un même `raw/` peut en porter plusieurs), par liens symboliques dans un dossier
 * temporaire effacé à la fin ; l'Écho est celui du même `raw/` (toutes les archives `ariane-echo-*`). Rien n'est écrit dans les données.
 *
 * DÉFINITIONS (chaque chiffre dit sa population)
 *   - événement : `voie-b1-ecart-ombre` du journal, pour une partie. « du lot » : sans champ `passe` ; « de la passe » : avec `passe`
 *     (deuxième passe sur les différés). La jointure (tools/jointure-echo-orbite.cjs) garde le DERNIER du cut : celui de la passe remplace
 *     celui du lot. ATTENTION : le fichier du journal n'est pas dans l'ordre du temps, et la jointure prend le dernier dans l'ordre du FICHIER :
 *     c'est parfois l'événement du lot. Trois lectures sont données : `dernier` (dernier dans le TEMPS : l'intention de la jointure), `duLot`
 *     (l'événement du lot seul) et `jugerLot` (ce que la jointure et juger-lot lisent réellement, refait à l'identique pour rapprocher les chiffres).
 *   - différé du lot : cible du lot sans écriture de validation pendant le lot (définition de tools/juger-lot.cjs). Seuls ces cuts sont
 *     retenus pour le jugement, comme dans le bloc « ombre voie B1-écart » de juger-lot ; les autres événements sont comptés à part.
 *   - posable : `verdict.posable === true` ; source : `b1` (liste d'ESV), `serie` (chaîne de l'ombre), `ecart` (écartement), `lot`.
 *   - état Écho d'un cut, un seul :
 *       sans-echo           : jamais visité par l'Écho ;
 *       valide              : l'opérateur a validé (dernière validation observée) ; l'écart est mesuré ;
 *       ecarte-d285         : validation SANS MOUVEMENT (aucun rail déplacé de plus de 1 mm) d'une visite de moins de 1,5 s : écartée (D-285) ;
 *       visite-sans-action  : visité 0,8 s au moins, aucun rail déplacé, aucune validation (règle de la jointure) ; compté À PART ;
 *       non-juge            : vu trop peu, déplacé sans validation, ou sans mesure dans le repère profil.
 *   - écart d'une pose d'ombre = pire des deux rails, distance 3D (mm), entre la pose de l'ombre (`poseMm` : décalages dans le repère profil de la
 *     pose de DÉPART d'ESV) et la pose finale de l'opérateur ramenée au même départ : `Voie.ecartPose(poseMm, mic)`.
 *       méthode « directe » (celle de juger-lot) : mic = `J.micDepuisDepart(ligne)` ; vaut quand la première visite de l'Écho voit encore la
 *         pose de départ du lot (différé jamais écrit entre le lot et l'Écho) ;
 *       méthode « reconstituée » : le cut a été ÉCRIT par la deuxième passe (`passe-differes-ecriture`, « ecrit ») avant l'Écho ; l'Écho voit la
 *         pose écrite, la correction de l'opérateur est relative à elle : mic = décalage écrit par la passe (`decal`) + correction. La méthode
 *         directe y mesurerait le déplacement de la passe, pas l'erreur de l'ombre (artefact de CH-034 § 8) : `ecartBrutMm` garde ce chiffre faux
 *         pour le montrer, `ecartMm` porte l'écart reconstitué.
 *       visité sans action : l'opérateur a laissé la pose en place. Si la passe a écrit le cut, la pose en place est la pose écrite (mic = `decal`).
 *         Sinon la pose en place est la pose de départ d'ESV, NON VALIDÉE : mic = 0, et l'écart ne mesure que la distance de l'ombre à une pose que
 *         personne n'a validée (drapeau `depart-non-valide`). Ces lignes n'entrent que dans la lecture « avec les visites ».
 *   - classes : juste = 10 mm ou moins ; « 10 à 50 » ; plus de 50 mm (mauvaise voie, définition unique de tools/juge-poses-faux.cjs).
 *   - séries (même fonction que le juge) : deux fautes de la même partie sont de la même série si elles sont à `--ecart-serie` cuts au plus
 *     (10) et qu'aucun cut jugé non fautif ne les sépare. Données pour « plus de 50 mm » et pour « plus de 10 mm ».
 *   - « correction de plus de 10 mm » : la pose finale de l'opérateur est à plus de 10 mm de la pose de départ (pire rail, 3D) : c'est la
 *     population de la référence (n = 67 dans CH-057). « rappel » = justes / différés jugés de cette population (abstentions comprises).
 *   - seuil du ticket : jugement « concluable » à partir de 30 poses d'ombre jugées (validées) sur les lots d'après `--apres`.
 * Limite dite : le journal ne porte pas la pose de départ d'un différé en coordonnées de scène ; que la première visite de l'Écho voie la même
 * pose de départ que le lot n'est donc pas vérifié cut par cut (PROBABLE quand aucune écriture de validation de la ligne n'est au journal entre
 * les deux ; drapeau `ecriture-entre-deux` sinon).
 * Sorties : numéros de partie et de cut, sources, millimètres, classes, drapeaux. Aucun identifiant, aucune coordonnée.
 */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const L = require('./juger-lot.cjs');
const J = require('./jointure-echo-orbite.cjs');
const Poses = require('./precision-poses.cjs');
const Juge = require('./juge-poses-faux.cjs');
const Voie = require('../src/voie-recentree.js');

const FORMAT = 'ariane-ch100-b1-ecart-v1';
const TYPE = 'voie-b1-ecart-ombre';
const JUSTE_MM = Juge.JUSTE_MM, FAUTE_MM = Juge.FAUTE_MM, D285_S = Juge.D285_S, SANS_MOUVEMENT_MM = 1, ECART_SERIE = 10, SEUIL_CONCLUABLE = 30;
const REFERENCE = { source: 'CH-057 § 2 (rejeu, 9 parties des 04 et 05/11)', differesCorrectionPlus10: 67, poses: 49, justes: 44, faux10a50: 5, plus50: 0 };
const fini = v => Number.isFinite(v);
const arr = (v, d = 1) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const instant = e => { const t = Date.parse(e && (e.timestamp || e) || ''); return fini(t) ? t : null; };
const classeDe = mm => !fini(mm) ? null : Juge.classeDe(mm);
const norme3 = v => Math.hypot(v[0] || 0, v[1] || 0, v[2] || 0);
const tri3 = v => Array.isArray(v) ? (v.length === 3 ? v.map(Number) : [0, Number(v[0]), Number(v[1])]) : null;
const somme = (a, b) => ({ left: [0, 1, 2].map(i => a.left[i] + b.left[i]), right: [0, 1, 2].map(i => a.right[i] + b.right[i]) });
const decalDe = d => { const l = d && tri3(d.left), r = d && tri3(d.right); return l && r && [...l, ...r].every(fini) ? { left: l, right: r } : null; };
const ZERO = { left: [0, 0, 0], right: [0, 0, 0] };
const ecartEntre = (a, b) => a && b ? Voie.ecartPose(a, b) : null;

/* Les événements d'ombre d'une partie, par cut, dans l'ordre du temps. */
function evenementsDe(journal, partie) {
  const par = new Map();
  const evs = journal.events.filter(e => e.type === TYPE && e.identity && e.identity.part === partie && Number.isInteger(e.identity.cut) && instant(e) !== null)
    .sort((a, b) => instant(a) - instant(b));
  for (const e of evs) { if (!par.has(e.identity.cut)) par.set(e.identity.cut, []); par.get(e.identity.cut).push(e); }
  return { evs, par };
}
const confMin = c => c && fini(c.left) && fini(c.right) ? Math.min(c.left, c.right) : null;
const vue = e => e ? { posable: !!(e.verdict && e.verdict.posable === true), source: e.source ?? null, etage: e.etage ?? null, pose: decalDe(e.poseMm), repere: e.repere ?? null, passe: e.passe ?? null, confiance: confMin(e.confiance),
  raison: e.verdict && e.verdict.posable !== true ? String(e.verdict && e.verdict.raison || e.etat || '?').slice(0, 80) : null } : null;

/* Première visite de l'Écho par cut (instant) : sert à dire si l'Écho a vu le cut après l'écriture de la passe. */
function premieresVisites(echo, partie) {
  const m = new Map();
  if (!echo) return m;
  for (const r of echo.records) {
    const id = r && r.identity; if (!id || id.part !== partie || !Number.isInteger(id.cut)) continue;
    const t = Date.parse(r.startedAt || ''); if (!fini(t)) continue;
    if (!m.has(id.cut) || t < m.get(id.cut)) m.set(id.cut, t);
  }
  return m;
}

/* État Écho et pose finale de l'opérateur depuis le départ du lot (mic), pour un cut différé. */
function etatEcho(ligne, ecrit, echoApresEcriture) {
  if (!ligne || !ligne.dansEcho) return { etat: 'sans-echo' };
  const duree = fini(ligne.dureeVisiteS) ? ligne.dureeVisiteS : null, visites = ligne.visitesEcho || 0;
  if (ligne.referenceHumaine !== 'observee') return { etat: 'non-juge', duree, visites };
  const passe = !!(ecrit && echoApresEcriture);
  if (ligne.regleVisiteBon) {
    return { etat: 'visite-sans-action', duree, visites, methode: passe ? 'reconstituee' : 'directe', micBrut: ZERO, mic: passe ? ecrit : ZERO, departNonValide: !passe };
  }
  const corr = J.micDepuisDepart(ligne), mmCorr = ligne.ecartHumain && ligne.ecartHumain.maxDist3dMm;
  if (!corr) return { etat: 'non-juge', duree, visites };
  const sansMouvement = ligne.etiquetteEcho === 'VALIDATE_NO_MOVEMENT' || (fini(mmCorr) && mmCorr <= SANS_MOUVEMENT_MM);
  const etat = sansMouvement && duree !== null && duree < D285_S ? 'ecarte-d285' : 'valide';
  /* Base « ariane » : la jointure a déjà ajouté le déplacement d'Ariane, la correction part du départ. Sinon, cut écrit par la passe : on ajoute son décalage. */
  const dejaDepart = typeof ligne.base === 'string' && ligne.base.startsWith('ariane');
  const mic = passe && !dejaDepart ? somme(ecrit, corr) : corr;
  return { etat, duree, visites, methode: passe && !dejaDepart ? 'reconstituee' : 'directe', micBrut: corr, mic, base: ligne.base || null, sansMouvement };
}

/* Une partie d'un lot → { inventaire, cuts }. */
function mesurerPartie({ journal, echo, partie, lotNom }) {
  const { evs, par } = evenementsDe(journal, partie);
  const run = L.lotsDe(journal, partie);
  const inv = { lot: lotNom, partie, lotTrouve: !!run, evenements: evs.length, evenementsDuLot: evs.filter(e => e.passe == null).length, evenementsDeLaPasse: evs.filter(e => e.passe != null).length,
    cuts: par.size };
  if (!run) return { inventaire: inv, cuts: [] };
  const { cibles, poses } = L.ciblesPosesDe(run, partie);
  const batchs = new Set(run.lots.map(l => l.B));
  inv.cibles = cibles.size; inv.posesDuLot = poses.size; inv.differesDuLot = cibles.size - poses.size;
  inv.evenementsHorsExecution = evs.filter(e => e.batchId && !batchs.has(e.batchId)).length;
  const lignes = L.indexLignes(journal, echo, partie), premieres = premieresVisites(echo, partie);
  inv.echo = echo ? [...lignes.values()].filter(l => l.dansEcho).length : 0;
  /* Écritures réelles de la deuxième passe, et toute écriture de validation de la ligne vue au journal. */
  const ecrits = new Map(), ecritures = new Map();
  for (const e of run.ev) {
    if (e.type === 'passe-differes-ecriture' && e.resultat === 'ecrit' && e.identity && e.identity.part === partie && (e.batchId ? batchs.has(e.batchId) : instant(e) >= run.t0)) {
      const d = decalDe(e.decal); ecrits.set(e.identity.cut, { t: instant(e), decal: d });
    }
    if (e.type === 'esv-observation' && e.kind === 'write' && Number.isInteger(e.rowIndex) && e.body && e.body.ExtractionStatus === 'valid' && Number.isInteger(e.status) && e.status >= 200 && e.status < 300
      && instant(e) >= run.t0) { if (!ecritures.has(e.rowIndex)) ecritures.set(e.rowIndex, []); ecritures.get(e.rowIndex).push(instant(e)); }
  }
  /* Zone métier du cut (`regles-metier-ombre`, portée cut) : passage à niveau et appareil de voie, libellés seulement. */
  const zones = new Map();
  for (const e of run.ev) if (e.type === 'regles-metier-ombre' && e.identity && e.identity.part === partie && e.zone) zones.set(e.identity.cut, { pn: e.zone.pn ?? null, adv: e.zone.adv ?? null });
  const cuts = [];
  for (const [cut, es] of [...par].sort((a, b) => a[0] - b[0])) {
    const duLot = es.filter(e => e.passe == null), dePasse = es.filter(e => e.passe != null);
    const vLot = vue(duLot[0] || null), vDer = vue(es[es.length - 1]);
    const differe = cibles.has(cut) && !poses.has(cut);
    const ec = ecrits.get(cut) || null, tEcho = premieres.get(cut) ?? null;
    const echoApresEcriture = !!(ec && tEcho !== null && tEcho > ec.t);
    const et = etatEcho(lignes.get(cut), ec && ec.decal, echoApresEcriture);
    const tDernier = instant(es[es.length - 1]);
    /* Ce que lisent RÉELLEMENT la jointure et juger-lot : le dernier événement du cut dans l'ordre du FICHIER (qui n'est pas l'ordre du temps), jugé par la méthode directe, visites sans action comprises. */
    const jl = lignes.get(cut) && lignes.get(cut).ombres && lignes.get(cut).ombres.b1Ecart || null, zone = zones.get(cut) || {};
    const autresEcritures = (ecritures.get(cut) || []).filter(t => t > instant(es[0]) && (tEcho === null || t < tEcho) && !(ec && Math.abs(t - ec.t) < 5000));
    const drapeaux = [];
    if (!differe) drapeaux.push(cibles.has(cut) ? 'pose-par-le-lot' : 'hors-cibles');
    if (ec) drapeaux.push('ecrit-par-la-passe');
    if (ec && !ec.decal) drapeaux.push('passe-sans-decalage');
    if (ec && tEcho !== null && !echoApresEcriture) drapeaux.push('echo-avant-ecriture');
    if (autresEcritures.length) drapeaux.push('ecriture-entre-deux');
    if (tEcho !== null && tEcho < tDernier) drapeaux.push('echo-avant-ombre');
    if (et.departNonValide) drapeaux.push('depart-non-valide');
    if (vDer.repere && vDer.repere !== 'calibre') drapeaux.push('repere-' + vDer.repere);
    const changeMm = vLot && vLot.pose && vDer.pose ? arr(ecartEntre(vLot.pose, vDer.pose)) : null;
    const change = !vLot ? 'pas-d-evenement-du-lot' : !dePasse.length ? 'lot-seul' : vLot.posable !== vDer.posable ? (vDer.posable ? 'devient-posable' : 'devient-abstenu')
      : !vLot.posable ? 'abstenu-identique' : vLot.source !== vDer.source || (changeMm !== null && changeMm > 0.1) ? 'pose-changee' : 'identique';
    const mesure = (v) => {
      if (!v || !v.posable || !v.pose || !et.mic) return { mm: null, brut: null };
      return { mm: arr(ecartEntre(v.pose, et.mic)), brut: arr(ecartEntre(v.pose, et.micBrut)) };
    };
    const mD = mesure(vDer), mL = mesure(vLot);
    const correctionMm = et.mic ? arr(Math.max(norme3(et.mic.left), norme3(et.mic.right))) : null;
    cuts.push({ lot: lotNom, partie, cut, evenements: es.length, evenementsDuLot: duLot.length, evenementsDeLaPasse: dePasse.length, differeDuLot: differe, changement: change, changementPoseMm: changeMm,
      zonePn: zone.pn ?? null, zoneAdv: zone.adv ?? null,
      jugerLot: jl ? { passe: jl.passe !== null && jl.passe !== undefined, posable: !!jl.posable, source: jl.source ?? null, ecartMm: fini(jl.ecartMm) ? jl.ecartMm : null, classe: classeDe(jl.ecartMm) } : null,
      dernier: { passe: vDer.passe !== null, posable: vDer.posable, source: vDer.source, etage: vDer.etage, confiance: vDer.confiance, ecartMm: mD.mm, ecartBrutMm: mD.brut, classe: classeDe(mD.mm), classeBrute: classeDe(mD.brut), serie50: null, serie10: null },
      duLot: vLot ? { posable: vLot.posable, source: vLot.source, etage: vLot.etage, confiance: vLot.confiance, ecartMm: mL.mm, ecartBrutMm: mL.brut, classe: classeDe(mL.mm), classeBrute: classeDe(mL.brut), serie50: null, serie10: null } : null,
      echo: et.etat, methode: et.methode || null, dureeVisiteS: et.duree ?? null, visites: et.visites ?? 0, correctionOperateurMm: correctionMm, drapeaux });
  }
  inv.cutsDifferesDuLot = cuts.filter(c => c.differeDuLot).length;
  inv.cutsHorsDifferes = cuts.length - inv.cutsDifferesDuLot;
  inv.ecritsParLaPasse = cuts.filter(c => c.drapeaux.includes('ecrit-par-la-passe')).length;
  return { inventaire: inv, cuts };
}

/* Comptes d'une liste de { mm, classe }. */
function compte(liste) {
  const k = c => liste.filter(x => x.classe === c).length, mm = liste.map(x => x.mm).filter(fini);
  return { n: liste.length, justes: k('juste'), de10a50: k('10-50'), plus50: k('faute'), maxMm: mm.length ? Math.max(...mm) : null,
    wilsonJustes: Poses.wilson(k('juste'), liste.length), wilsonPlus50: Poses.wilson(k('faute'), liste.length) };
}
/* Le bloc « ombre voie B1-écart » de juger-lot, refait à l'identique (dernier événement dans l'ordre du fichier, méthode directe, toute ligne à écart fini). */
function reelle(cuts) {
  const p = cuts.filter(c => c.differeDuLot && c.jugerLot && c.jugerLot.posable), j = p.filter(c => fini(c.jugerLot.ecartMm));
  const parSource = {}; for (const c of p) { const s = c.jugerLot.source || 'inconnue'; parSource[s] = (parSource[s] || 0) + 1; }
  return { posables: p.length, parSource, juges: j.length, juste10: j.filter(c => c.jugerLot.ecartMm <= JUSTE_MM).length, plusDe10: j.filter(c => c.jugerLot.ecartMm > JUSTE_MM).length, plusDe50: j.filter(c => c.jugerLot.ecartMm > FAUTE_MM).length,
    evenementDuLotRetenu: cuts.filter(c => c.differeDuLot && c.jugerLot && c.evenementsDeLaPasse > 0 && !c.jugerLot.passe).length };
}
/* Bilan d'une lecture (`dernier` ou `duLot`) sur une liste de cuts (différés du lot seulement). */
function bilan(cuts, lecture, ecartSerie, poserSeries) {
  const tous = cuts.filter(c => c.differeDuLot && c[lecture]);
  const posables = tous.filter(c => c[lecture].posable);
  const parSource = {}, etats = {};
  for (const c of posables) { const s = c[lecture].source || 'inconnue'; parSource[s] = (parSource[s] || 0) + 1; etats[c.echo] = (etats[c.echo] || 0) + 1; }
  const item = c => ({ partie: c.partie, lot: c.lot, cut: c.cut, mm: c[lecture].ecartMm, classe: c[lecture].classe, source: c[lecture].source || 'inconnue' });
  const mesures = posables.filter(c => fini(c[lecture].ecartMm));
  const valides = mesures.filter(c => c.echo === 'valide'), visites = mesures.filter(c => c.echo === 'visite-sans-action');
  const avec = [...valides, ...visites];
  const bruts = valides.map(c => ({ mm: c[lecture].ecartBrutMm, classe: c[lecture].classeBrute }));
  const sources = {};
  for (const s of Object.keys(parSource)) sources[s] = { posables: parSource[s], valides: compte(valides.filter(c => (c[lecture].source || 'inconnue') === s).map(item)),
    avecVisites: compte(avec.filter(c => (c[lecture].source || 'inconnue') === s).map(item)) };
  /* Séries, par (lot, partie) : fautes de plus de 50 mm, puis « plus de 10 mm ». */
  const series = { sans: { plus50: 0, plus10: 0, plages: 0, plagesFautives50: 0 }, avec: { plus50: 0, plus10: 0, plages: 0, plagesFautives50: 0 }, liste: [] };
  for (const [nom, pop] of [['sans', valides], ['avec', avec]]) {
    const groupes = new Map();
    for (const c of pop) { const k = c.lot + '|' + c.partie; if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(c); }
    for (const g of groupes.values()) {
      const a = g.map(c => ({ cut: c.cut, classe: c[lecture].classe, mm: c[lecture].ecartMm, ref: c }));
      const s50 = Juge.seriesEtPlages(a, ecartSerie);
      const b = g.map(c => ({ cut: c.cut, classe: c[lecture].classe === 'juste' ? 'juste' : 'faute', mm: c[lecture].ecartMm, ref: c }));
      const s10 = Juge.seriesEtPlages(b, ecartSerie);
      series[nom].plus50 += s50.series.length; series[nom].plus10 += s10.series.length; series[nom].plages += s50.plages.n; series[nom].plagesFautives50 += s50.plages.fautives;
      if (nom === 'avec') {
        if (poserSeries) { for (const x of a) if (x.serie) x.ref[lecture].serie50 = x.serie; for (const x of b) if (x.serie) x.ref[lecture].serie10 = x.serie; }
        for (const s of s10.series) series.liste.push({ lot: g[0].lot, partie: g[0].partie, seuilMm: JUSTE_MM, debut: s.debut, fin: s.fin, fautes: s.fautes, maxMm: s.maxMm });
        for (const s of s50.series) series.liste.push({ lot: g[0].lot, partie: g[0].partie, seuilMm: FAUTE_MM, debut: s.debut, fin: s.fin, fautes: s.fautes, maxMm: s.maxMm });
      }
    }
  }
  /* Lecture « référence » (CH-057) : différés jugés (validation observée), abstentions comprises ; correction de plus de 10 mm. */
  const juges = tous.filter(c => c.echo === 'valide' && fini(c.correctionOperateurMm));
  const grosses = juges.filter(c => c.correctionOperateurMm > JUSTE_MM);
  const ref = (pop) => { const p = pop.filter(c => c[lecture].posable && fini(c[lecture].ecartMm)).map(item), c = compte(p);
    return { differesJuges: pop.length, poses: c.n, justes: c.justes, de10a50: c.de10a50, plus50: c.plus50, rappel: Poses.wilson(c.justes, pop.length), wilsonPlus50: c.wilsonPlus50 }; };
  return { evenementsRetenus: tous.length, posables: posables.length, abstenus: tous.length - posables.length, parSource, etatsEcho: etats,
    ecritsParLaPasse: posables.filter(c => c.drapeaux.includes('ecrit-par-la-passe')).length,
    valides: compte(valides.map(item)), avecVisites: compte(avec.map(item)), visitesSansAction: visites.length,
    visitesDepartNonValide: visites.filter(c => c.drapeaux.includes('depart-non-valide')).length,
    reconstituees: valides.filter(c => c.methode === 'reconstituee').length,
    methodeJugerLotSansCorrection: compte(bruts), lectureReelleDeJugerLot: reelle(cuts), sources, series,
    commeLaReference: { tous: ref(juges), correctionPlus10: ref(grosses) } };
}

/* [{ nom, date, journal, echo }] → résultat complet. */
function mesurer(lots, options = {}) {
  const ecartSerie = options.ecartSerie || ECART_SERIE, apres = options.apres || '2026-11-05';
  const out = { format: FORMAT, definition: `écart = pire rail, 3D, pose de l'ombre contre la pose finale de l'opérateur ramenée au départ du lot ; juste = ${JUSTE_MM} mm ou moins ; mauvaise voie = plus de ${FAUTE_MM} mm ; validation sans mouvement de moins de ${D285_S} s écartée (D-285) ; séries à ${ecartSerie} cuts au plus ; seules les ombres des différés du lot sont jugées`,
    reference: REFERENCE, apres, seuilConcluable: SEUIL_CONCLUABLE, lots: [], inventaire: [], cuts: [] };
  for (const lot of lots) {
    const ev = lot.journal.events, t = ev.map(e => e.timestamp).filter(Boolean).sort();
    const parties = new Set(L.partiesDuJournal(lot.journal));
    for (const e of ev) if (e.type === TYPE && e.identity && Number.isInteger(e.identity.part)) parties.add(e.identity.part);
    const info = { lot: lot.nom, date: lot.date, paquet: lot.journal.build || null, version: lot.journal.version || null, debut: t[0] ? t[0].slice(0, 16) : null, fin: t.length ? t[t.length - 1].slice(0, 16) : null,
      parties: [...parties].sort((a, b) => a - b), evenements: ev.filter(e => e.type === TYPE).length, echo: !!lot.echo, apres: lot.date > apres,
      partiesEcho: lot.echo ? [...new Set(lot.echo.records.map(r => r.identity && r.identity.part).filter(Number.isInteger))].sort((a, b) => a - b) : [] };
    out.lots.push(info);
    if (!info.evenements) continue;
    for (const partie of info.parties) {
      const r = mesurerPartie({ journal: lot.journal, echo: lot.echo, partie, lotNom: lot.nom });
      if (!r.inventaire.evenements) continue;
      const b = { dernier: bilan(r.cuts, 'dernier', ecartSerie, true), duLot: bilan(r.cuts, 'duLot', ecartSerie, true) };
      const ch = {}; for (const c of r.cuts) if (c.differeDuLot) ch[c.changement] = (ch[c.changement] || 0) + 1;
      out.inventaire.push({ ...r.inventaire, date: lot.date, paquet: info.paquet, apres: info.apres, changements: ch, dernier: b.dernier, duLot: b.duLot });
      out.cuts.push(...r.cuts.map(c => ({ date: lot.date, ...c })));
    }
  }
  const apresCuts = out.cuts.filter(c => c.date > apres);
  out.total = { apres: { dernier: bilan(apresCuts, 'dernier', ecartSerie, false), duLot: bilan(apresCuts, 'duLot', ecartSerie, false) },
    tout: { dernier: bilan(out.cuts, 'dernier', ecartSerie, false), duLot: bilan(out.cuts, 'duLot', ecartSerie, false) } };
  const n = out.total.apres.dernier.valides.n;
  out.conclusion = { posesJugeesApres: n, seuil: SEUIL_CONCLUABLE, concluable: n >= SEUIL_CONCLUABLE, manquent: Math.max(0, SEUIL_CONCLUABLE - n),
    premierPaquet: (out.lots.filter(l => l.evenements).sort((a, b) => String(a.debut).localeCompare(String(b.debut)))[0] || null) };
  if (out.conclusion.premierPaquet) { const p = out.conclusion.premierPaquet; out.conclusion.premierPaquet = { paquet: p.paquet, lot: p.lot, date: p.date }; }
  return out;
}

/* ------------------------------------------------------------------ texte, csv */
const vg = v => v === null || v === undefined ? '—' : String(v).replace('.', ',');
const pw = w => w && w.n ? `${w.k}/${w.n} (${vg(arr(100 * w.part))} % [${vg(arr(100 * w.bas))} ; ${vg(arr(100 * w.haut))}])` : '0/0';
const src = o => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ') || 'aucune';
const ligneCompte = (nom, c) => `    ${nom} : ${c.n} jugés ; justes (${JUSTE_MM} mm ou moins) ${pw(c.wilsonJustes)} ; 10 à 50 mm ${c.de10a50} ; plus de ${FAUTE_MM} mm ${pw(c.wilsonPlus50)}` + (c.maxMm !== null ? ` ; max ${vg(c.maxMm)} mm` : '');
function blocBilan(titre, b) {
  const o = [`  ${titre} : ${b.evenementsRetenus} différés du lot avec événement, posables ${b.posables} (${src(b.parSource)}), abstenus ${b.abstenus}`,
    `    posables, état Écho : ${src(b.etatsEcho)} ; écrits par la passe ${b.ecritsParLaPasse}`,
    ligneCompte('SANS les « visité sans action » (validation observée)', b.valides) + ` ; dont ${b.reconstituees} reconstituée(s)`,
    ligneCompte(`AVEC les ${b.visitesSansAction} « visité sans action » (dont ${b.visitesDepartNonValide} sur un départ non validé)`, b.avecVisites),
    ligneCompte('méthode directe partout, sans reconstitution (validés, pour comparaison)', b.methodeJugerLotSansCorrection)];
  for (const [s, v] of Object.entries(b.sources)) o.push(`    source ${s} (${v.posables} posables) : validés ${v.valides.n}, justes ${v.valides.justes}, 10 à 50 ${v.valides.de10a50}, plus de 50 ${v.valides.plus50} ; avec visites ${v.avecVisites.n}, justes ${v.avecVisites.justes}, 10 à 50 ${v.avecVisites.de10a50}, plus de 50 ${v.avecVisites.plus50}`);
  o.push(`    séries (sans / avec visites) : plus de 50 mm ${b.series.sans.plus50} / ${b.series.avec.plus50} ; plus de 10 mm ${b.series.sans.plus10} / ${b.series.avec.plus10} ; plages jugées ${b.series.sans.plages} / ${b.series.avec.plages}, fautives (plus de 50 mm) ${b.series.sans.plagesFautives50} / ${b.series.avec.plagesFautives50}`);
  const r = b.commeLaReference;
  o.push(`    comme la référence : différés jugés ${r.tous.differesJuges}, posés ${r.tous.poses}, justes ${pw(r.tous.rappel)}, 10 à 50 ${r.tous.de10a50}, plus de 50 ${r.tous.plus50} ; correction de plus de 10 mm : ${r.correctionPlus10.differesJuges}, posés ${r.correctionPlus10.poses}, justes ${pw(r.correctionPlus10.rappel)}, 10 à 50 ${r.correctionPlus10.de10a50}, plus de 50 ${pw(r.correctionPlus10.wilsonPlus50)}`);
  return o;
}
function texte(r) {
  const o = ['CH-100, mesure 1 : B1-écart, base à battre (ombre consignée au journal).', `Définition : ${r.definition}.`, '', 'LOTS LUS'];
  for (const l of r.lots) o.push(`  ${l.lot} · paquet ${l.paquet || '?'} · ${l.debut} → ${l.fin} · parties ${l.parties.join(', ')} · événements ${l.evenements} · Écho ${l.echo ? 'parties ' + l.partiesEcho.join(', ') : l.evenements ? 'aucun' : 'non lu (aucun événement à juger)'}`);
  const p = r.conclusion.premierPaquet;
  o.push('', p ? `Premier lot qui consigne l'événement : ${p.lot} (paquet ${p.paquet}).` : 'Aucun lot ne consigne l\'événement.', '', 'INVENTAIRE ET JUGEMENT PAR LOT ET PAR PARTIE');
  for (const i of r.inventaire) {
    o.push(`${i.lot} · partie ${i.partie} · paquet ${i.paquet}` + (i.apres ? '' : ' · (lot de référence, pas « après »)'),
      `  événements ${i.evenements} (du lot ${i.evenementsDuLot}, de la passe ${i.evenementsDeLaPasse}), cuts distincts ${i.cuts} : différés du lot ${i.cutsDifferesDuLot}, autres ${i.cutsHorsDifferes} ; écrits par la passe ${i.ecritsParLaPasse} ; lot : ${i.cibles} cibles, ${i.differesDuLot} différés`,
      `  dernier contre événement du lot (différés) : ${src(i.changements)}`,
      `  bloc de juger-lot refait à l'identique (dernier dans l'ordre du FICHIER, méthode directe) : posables ${i.dernier.lectureReelleDeJugerLot.posables} (${src(i.dernier.lectureReelleDeJugerLot.parSource)}), jugés ${i.dernier.lectureReelleDeJugerLot.juges} : à 10 mm ${i.dernier.lectureReelleDeJugerLot.juste10}, > 10 mm ${i.dernier.lectureReelleDeJugerLot.plusDe10}, > 50 mm ${i.dernier.lectureReelleDeJugerLot.plusDe50} ; cuts où il retient l'événement du lot alors qu'un événement de la passe existe : ${i.dernier.lectureReelleDeJugerLot.evenementDuLotRetenu}`, ...blocBilan('lecture « dernier » (jointure)', i.dernier), ...blocBilan('lecture « événement du lot »', i.duLot), '');
  }
  o.push(`TOTAL DES LOTS D'APRÈS LE ${r.apres}`, ...blocBilan('lecture « dernier » (jointure)', r.total.apres.dernier), ...blocBilan('lecture « événement du lot »', r.total.apres.duLot), '');
  const c = r.conclusion, f = r.reference;
  o.push(`Référence à égaler (${f.source}) : ${f.justes} justes sur ${f.differesCorrectionPlus10} différés à correction de plus de 10 mm, ${f.faux10a50} faux de 10 à 50 mm, ${f.plus50} sur ${f.poses} posés à plus de 50 mm.`,
    c.concluable ? `CONCLUABLE : ${c.posesJugeesApres} poses d'ombre jugées (validation observée) sur les lots d'après le ${r.apres} (seuil ${c.seuil}).`
      : `NON CONCLUABLE : ${c.posesJugeesApres} poses d'ombre jugées (validation observée) sur les lots d'après le ${r.apres} ; il en manque ${c.manquent} pour atteindre ${c.seuil}.`);
  return o.join('\n');
}
const COLONNES = ['date', 'lot', 'partie', 'cut', 'evenements', 'evenementsDuLot', 'evenementsDeLaPasse', 'differeDuLot', 'changement', 'changementPoseMm', 'echo', 'methode', 'dureeVisiteS', 'visites', 'correctionOperateurMm', 'zonePn', 'zoneAdv',
  'dernier.passe', 'dernier.posable', 'dernier.source', 'dernier.etage', 'dernier.confiance', 'dernier.ecartMm', 'dernier.classe', 'dernier.ecartBrutMm', 'dernier.classeBrute', 'dernier.serie10', 'dernier.serie50',
  'duLot.posable', 'duLot.source', 'duLot.etage', 'duLot.ecartMm', 'duLot.classe', 'duLot.ecartBrutMm', 'duLot.classeBrute',
  'jugerLot.passe', 'jugerLot.posable', 'jugerLot.source', 'jugerLot.ecartMm', 'jugerLot.classe', 'drapeaux'];
function enCsv(r) {
  const v = x => x === null || x === undefined ? '' : x === true ? 'oui' : x === false ? 'non' : Array.isArray(x) ? x.join(' ') : String(x);
  const lire = (c, k) => k.split('.').reduce((a, p) => a === null || a === undefined ? a : a[p], c);
  return [COLONNES.join(';'), ...r.cuts.map(c => COLONNES.map(k => v(lire(c, k))).join(';'))].join('\n') + '\n';
}

/* ------------------------------------------------------------------ découverte des lots */
const MOTIF_LOT = /ariane-lot-(\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d)/, MOTIF_ECHO = /ariane-echo-/;
/* Les lots d'une racine de collections : un par horodatage d'archive, par liens symboliques dans `travail`. */
function decouvrir(racine, { depuis, jusqu }, travail) {
  const out = [];
  for (const col of fs.readdirSync(racine).sort()) {
    const m = /^(\d{4}-\d\d-\d\d)_/.exec(col); if (!m || (depuis && m[1] < depuis) || (jusqu && m[1] > jusqu)) continue;
    const raw = path.join(racine, col, 'raw'); let noms;
    try { noms = fs.readdirSync(raw); } catch { continue; }
    const groupes = new Map();
    for (const n of noms) { const g = MOTIF_LOT.exec(n); if (g && /\.zip(\.\d{3})?$/i.test(n)) { if (!groupes.has(g[1])) groupes.set(g[1], []); groupes.get(g[1]).push(n); } }
    const echo = noms.some(n => MOTIF_ECHO.test(n)) ? [raw] : [];
    for (const [stamp, fichiers] of [...groupes].sort()) {
      const dir = path.join(travail, stamp); fs.mkdirSync(dir, { recursive: true });
      for (const f of fichiers) fs.symlinkSync(path.join(raw, f), path.join(dir, f));
      out.push({ nom: stamp.slice(0, 16), date: stamp.slice(0, 10), dir, echo, volumes: fichiers.length });
    }
  }
  return out;
}

const USAGE = 'Usage : node tools/ch100-b1-ecart.cjs (--collections <racine> [--depuis AAAA-MM-JJ] [--jusqu AAAA-MM-JJ] | --lot <dossier> [--echo <dossier>]... [--nom x]) [--apres AAAA-MM-JJ] [--ecart-serie 10] [--json f] [--csv f]';
function lireArguments(argv) {
  const a = { collections: null, depuis: '2026-11-04', jusqu: null, lot: null, echo: [], nom: null, apres: '2026-11-05', ecartSerie: ECART_SERIE, json: null, csv: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--collections') a.collections = argv[++i];
    else if (k === '--depuis') a.depuis = argv[++i];
    else if (k === '--jusqu') a.jusqu = argv[++i];
    else if (k === '--lot') a.lot = argv[++i];
    else if (k === '--echo') a.echo.push(argv[++i]);
    else if (k === '--nom') a.nom = argv[++i];
    else if (k === '--apres') a.apres = argv[++i];
    else if (k === '--ecart-serie') a.ecartSerie = Number(argv[++i]);
    else if (k === '--json') a.json = argv[++i];
    else if (k === '--csv') a.csv = argv[++i];
    else throw Error(`Argument inconnu : ${k}. ${USAGE}`);
  }
  if (!a.collections === !a.lot) throw Error(`--collections ou --lot attendu (l'un des deux). ${USAGE}`);
  if (!Number.isInteger(a.ecartSerie) || a.ecartSerie < 1) throw Error(`--ecart-serie attend un entier. ${USAGE}`);
  return a;
}
function executer(argv, sortie = console.log) {
  const a = lireArguments(argv);
  let travail = null, lots;
  try {
    if (a.collections) { travail = fs.mkdtempSync(path.join(os.tmpdir(), 'ch100-b1-ecart-')); lots = decouvrir(path.resolve(a.collections), a, travail); }
    else lots = [{ nom: a.nom || 'lot', date: a.nom && /^\d{4}-\d\d-\d\d/.test(a.nom) ? a.nom.slice(0, 10) : '9999-99-99', dir: path.resolve(a.lot), echo: a.echo }];
    if (!lots.length) throw Error('aucun lot trouvé');
    const charges = [];
    for (const l of lots) {
      let journal; try { journal = Poses.lireJournalDir(l.dir); } catch (e) { sortie(`  (${l.nom} : journal illisible, ${e.message})`); continue; }
      /* L'Écho n'est lu que si le journal porte l'événement : le reste de l'inventaire n'en a pas besoin. */
      const utile = journal.events.some(e => e.type === TYPE);
      let echo = null; if (utile && l.echo.length) { try { echo = Poses.lireEcho(L.dossiersEcho(l.echo)); } catch { echo = null; } }
      charges.push({ nom: l.nom, date: l.date, journal, echo });
    }
    const r = mesurer(charges, { ecartSerie: a.ecartSerie, apres: a.apres });
    const ecrire = (f, t) => { const abs = path.resolve(f); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, t); };
    if (a.json) ecrire(a.json, JSON.stringify(r, null, 1));
    if (a.csv) ecrire(a.csv, enCsv(r));
    sortie(texte(r));
    return r;
  } finally { if (travail) fs.rmSync(travail, { recursive: true, force: true }); }
}
if (require.main === module) {
  try { executer(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { FORMAT, TYPE, REFERENCE, SEUIL_CONCLUABLE, evenementsDe, etatEcho, mesurerPartie, bilan, mesurer, texte, enCsv, decouvrir, lireArguments, executer };
