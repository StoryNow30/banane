#!/usr/bin/env node
'use strict';
/*
 * juge-poses-faux.cjs — LE JUGE DES « POSÉS FAUX » (CH-100, point 4 ; cadrage du 10/11, § 4). Hors ligne, lecture seule.
 *
 *   node tools/juge-poses-faux.cjs <dossier-du-lot> --echo <dossier>... [--partie N]... [--tirage liste.txt]
 *        [--ecart-serie 10] [--json sortie.json] [--csv sortie.csv]
 *
 * Il juge les cuts POSÉS PAR ARIANE contre la pose finale de l'opérateur (Écho), avec UNE définition :
 *   - écart = pire des deux rails, distance 3D (mm) entre la pose d'Ariane et la dernière validation observée de l'opérateur
 *     (jointure tools/jointure-echo-orbite.cjs, base « auto », référence corrigée par l'écriture serveur) ;
 *   - juste = 10 mm ou moins ; « 10 à 50 » ; MAUVAISE VOIE = plus de 50 mm (plus de règle latérale à 100 mm : juger.cjs et
 *     juger-lot.cjs gardent la leur, ce juge-ci est la référence de l'étude « coupes non résolues »).
 * Population (chaque chiffre dit la sienne) :
 *   - posé du lot : cible du lot dont la ligne a reçu une écriture de validation 2xx pendant le lot (définition de juger-lot.cjs) ;
 *   - écrit par la deuxième passe (`passe-differes-ecriture`, résultat « ecrit ») : jugé À PART, jamais additionné au lot ; l'Écho voit
 *     la pose écrite, l'écart est la correction de l'opérateur depuis sa première visite ;
 *   - un différé jamais posé n'est pas un posé : il n'entre pas ici.
 * État d'un posé, un seul par cut :
 *   - sans-echo : jamais visité par l'Écho ;
 *   - valide : l'opérateur a validé ; l'écart est mesuré ;
 *   - ecarte-d285 : validation SANS MOUVEMENT (aucun rail déplacé de plus de 1 mm) d'une visite de moins de 1,5 s : écartée (D-285) ;
 *   - visite-sans-action : visité 0,8 s au moins, aucun rail déplacé, aucune validation : compté à part ; chaque taux est donné
 *     SANS ces lignes (« valides ») et AVEC (« avecVisites », écart nul) ;
 *   - repere : le repère de scène n'est pas calibré ou la pose vue par l'Écho n'est pas celle du journal (la pose a changé entre le lot et
 *     l'Écho : relecture, correction) : non jugé, compté ;
 *   - non-juge : vu trop peu, ou sans mesure.
 * Séries : les fautes viennent en séries (cadrage § 4). Deux fautes de la même partie sont de la même série si elles sont à
 * `--ecart-serie` cuts au plus (10 par défaut) et qu'aucun cut JUGÉ à 50 mm ou moins ne les sépare. Plages jugées : cuts jugés (valides et
 * visités sans action) à `--ecart-serie` cuts au plus l'un de l'autre ; une plage est fautive si elle porte une faute. Les taux sont donnés
 * par cut ET par plage, avec l'intervalle de Wilson à 95 %.
 * Séance tirée au sort (`--tirage`, liste de banane-data/outils/analyse-lots/tirage-echo/tirage-echo.py) : le taux présentable est celui
 * des plages marquées « * » ; les autres cuts jugés sont « hors tirage » (choisis par l'opérateur : biais possible), comptés à part ; la
 * couverture dit combien de cuts tirés ont été jugés. Sans tirage, tous les jugés sont « choisis ».
 * Sorties : texte ; `--json` (le résumé et la liste par cut : numéros et millimètres seulement) ; `--csv` (une ligne par posé).
 */
const fs = require('node:fs'), path = require('node:path');
const L = require('./juger-lot.cjs');
const Poses = require('./precision-poses.cjs');

const FORMAT = 'ariane-juge-poses-faux-v1';
const JUSTE_MM = 10, FAUTE_MM = 50, D285_S = 1.5, SANS_MOUVEMENT_MM = 1, ECART_SERIE = 10;
const fini = v => Number.isFinite(v);
const arr = (v, d = 2) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const instant = e => { const t = Date.parse(e && e.timestamp || ''); return fini(t) ? t : null; };
const classeDe = mm => { const v = Math.round(mm * 1000) / 1000; return v <= JUSTE_MM ? 'juste' : v <= FAUTE_MM ? '10-50' : 'faute'; };
const railMm = (l, c) => l && l.ecartHumain && l.ecartHumain[c] && fini(l.ecartHumain[c].dist3dMm) ? arr(l.ecartHumain[c].dist3dMm) : null;

/* État d'un posé d'après sa ligne de jointure. `passe` : cut écrit par la deuxième passe (base = première visite de l'Écho). */
function etatDe(ligne, passe) {
  if (!ligne || !ligne.dansEcho) return { etat: 'sans-echo' };
  const duree = fini(ligne.dureeVisiteS) ? ligne.dureeVisiteS : null;
  if (ligne.referenceHumaine !== 'observee') return { etat: 'non-juge', duree };
  if (ligne.regleVisiteBon) return { etat: 'visite-sans-action', mm: 0, duree };
  if (!passe && (typeof ligne.base !== 'string' || !ligne.base.startsWith('ariane'))) return { etat: 'repere', duree };
  const mm = ligne.ecartHumain && ligne.ecartHumain.maxDist3dMm;
  if (!fini(mm)) return { etat: 'non-juge', duree };
  const sansMouvement = ligne.etiquetteEcho === 'VALIDATE_NO_MOVEMENT' || mm <= SANS_MOUVEMENT_MM;
  if (sansMouvement && duree !== null && duree < D285_S) return { etat: 'ecarte-d285', duree };
  return { etat: 'valide', mm: arr(mm), gauche: railMm(ligne, 'gauche'), droite: railMm(ligne, 'droite'), duree };
}

function compte(cuts) {
  const mm = cuts.map(c => c.mm).filter(fini), k = (c) => cuts.filter(x => x.classe === c).length;
  return { n: cuts.length, justes: k('juste'), de10a50: k('10-50'), fautes: k('faute'), maxMm: mm.length ? Math.max(...mm) : null,
    wilsonJustes: Poses.wilson(k('juste'), cuts.length), wilsonFautes: Poses.wilson(k('faute'), cuts.length) };
}
/* Séries de fautes et plages jugées d'une liste de cuts jugés (même partie), triée par numéro. */
function seriesEtPlages(juges, ecartSerie) {
  const tri = [...juges].sort((a, b) => a.cut - b.cut), series = [], plages = [];
  let serie = null, plage = null;
  for (const c of tri) {
    if (plage && c.cut - plage.fin <= ecartSerie) { plage.fin = c.cut; plage.juges++; if (c.classe === 'faute') plage.fautes++; }
    else plages.push(plage = { debut: c.cut, fin: c.cut, juges: 1, fautes: c.classe === 'faute' ? 1 : 0 });
    if (c.classe !== 'faute') { serie = null; continue; }
    if (serie && c.cut - serie.fin <= ecartSerie) { serie.fin = c.cut; serie.fautes++; serie.maxMm = Math.max(serie.maxMm, c.mm); }
    else series.push(serie = { debut: c.cut, fin: c.cut, fautes: 1, maxMm: c.mm });
    c.serie = series.length;
  }
  const fautives = plages.filter(p => p.fautes).length;
  return { series, plages: { n: plages.length, fautives, wilsonFautives: Poses.wilson(fautives, plages.length), liste: plages } };
}

/* Liste d'une séance tirée au sort (texte de tirage-echo.py) → plages posées (tirées ou non) et différés. */
function lireTirage(texte) {
  const plages = [], differes = [];
  let bloc = null;
  for (const l of String(texte).split(/\r?\n/)) {
    if (/^PLAGES POS/.test(l)) { bloc = 'plages'; continue; }
    if (/^DIFF/.test(l)) { bloc = 'differes'; continue; }
    const m = /^\s*(\*)?\s*partie (\d+) : (\d+)(?: à (\d+))?/.exec(l);
    if (!m || !bloc) continue;
    if (bloc === 'plages') plages.push({ partie: Number(m[2]), debut: Number(m[3]), fin: Number(m[4] || m[3]), tiree: !!m[1] });
    else differes.push({ partie: Number(m[2]), cut: Number(m[3]) });
  }
  if (!plages.length) throw Error('liste de tirage : aucune plage lue (format de tirage-echo.py attendu)');
  return { plages, differes };
}

function jugerPartie({ journal, echo, partie, tirage, ecartSerie }) {
  const lot = L.lotsDe(journal, partie);
  const base = { partie, lotTrouve: !!lot };
  if (!lot) return { ...base, poses: 0, cuts: [] };
  const { poses } = L.ciblesPosesDe(lot, partie);
  const lignes = L.indexLignes(journal, echo, partie);
  const batchs = new Set(lot.lots.map(l => l.B)), ecrits = new Set();
  for (const e of lot.ev) {
    if (e.type !== 'passe-differes-ecriture' || e.resultat !== 'ecrit' || !e.identity || e.identity.part !== partie) continue;
    if (e.batchId ? !batchs.has(e.batchId) : instant(e) < lot.t0) continue;
    ecrits.add(e.identity.cut);
  }
  const tires = tirage ? (cut) => tirage.plages.some(p => p.partie === partie && p.tiree && cut >= p.debut && cut <= p.fin) : null;
  const ligneDe = (cut, source) => {
    const lg = lignes.get(cut), et = etatDe(lg, source === 'passe');
    const c = { partie, cut, source, etat: et.etat, classe: fini(et.mm) ? classeDe(et.mm) : null, mm: fini(et.mm) ? et.mm : null,
      gaucheMm: et.gauche ?? null, droiteMm: et.droite ?? null, dureeVisiteS: et.duree ?? null, serie: null };
    if (tires) c.tire = source === 'lot' && tires(cut);
    return c;
  };
  const cutsLot = [...poses].filter(c => !ecrits.has(c)).sort((a, b) => a - b).map(c => ligneDe(c, 'lot'));
  const cutsPasse = [...ecrits].sort((a, b) => a - b).map(c => ligneDe(c, 'passe'));
  const bilan = (cuts) => {
    const de = (e) => cuts.filter(c => c.etat === e);
    const valides = de('valide'), avec = [...valides, ...de('visite-sans-action')];
    return { sansEcho: de('sans-echo').length, nonJuges: de('non-juge').length, repere: de('repere').length, ecartesD285: de('ecarte-d285').length,
      visitesSansAction: de('visite-sans-action').length, valides: compte(valides), avecVisites: compte(avec), ...seriesEtPlages(avec, ecartSerie) };
  };
  const r = { ...base, poses: cutsLot.length, ...bilan(cutsLot) };
  const bp = bilan(cutsPasse);
  r.passe = { ecrits: cutsPasse.length, sansEcho: bp.sansEcho, nonJuges: bp.nonJuges, ecartesD285: bp.ecartesD285, visitesSansAction: bp.visitesSansAction, valides: bp.valides, avecVisites: bp.avecVisites };
  if (tirage) {
    const t = cutsLot.filter(c => c.tire), h = cutsLot.filter(c => !c.tire), bt = bilan(t), bh = bilan(h);
    r.tirage = { tires: t.length, valides: bt.valides, avecVisites: bt.avecVisites, ecartesD285: bt.ecartesD285, sansEcho: bt.sansEcho, nonJuges: bt.nonJuges + bt.repere,
      couverture: Poses.wilson(bt.avecVisites.n, t.length), series: bt.series, plages: bt.plages };
    r.horsTirage = { poses: h.length, valides: bh.valides, avecVisites: bh.avecVisites };
  }
  r.cuts = [...cutsLot, ...cutsPasse];
  return r;
}

/* { journal, echo, parties, tirage, ecartSerie } → { format, definition, parties: [...], total }. */
function juger({ journal, echo, parties, tirage = null, ecartSerie = ECART_SERIE }) {
  const liste = (parties && parties.length ? parties : L.partiesDuJournal(journal)).map(partie => jugerPartie({ journal, echo, partie, tirage, ecartSerie }));
  const tous = liste.flatMap(p => p.cuts.filter(c => c.source === 'lot')), de = (e) => tous.filter(c => c.etat === e);
  const valides = de('valide'), avec = [...valides, ...de('visite-sans-action')];
  const series = liste.reduce((s, p) => s + (p.series || []).length, 0);
  const plagesN = liste.reduce((s, p) => s + (p.plages ? p.plages.n : 0), 0), plagesF = liste.reduce((s, p) => s + (p.plages ? p.plages.fautives : 0), 0);
  const passe = liste.flatMap(p => p.cuts.filter(c => c.source === 'passe'));
  return { format: FORMAT, build: journal.build || null,
    definition: `mauvaise voie = plus de ${FAUTE_MM} mm, pire rail, 3D ; juste = ${JUSTE_MM} mm ou moins ; validation sans mouvement de moins de ${D285_S} s écartée (D-285) ; séries à ${ecartSerie} cuts au plus`,
    tirage: !!tirage, parties: liste,
    total: { poses: tous.length, sansEcho: de('sans-echo').length, nonJuges: de('non-juge').length, repere: de('repere').length, ecartesD285: de('ecarte-d285').length,
      visitesSansAction: de('visite-sans-action').length, valides: compte(valides), avecVisites: compte(avec), series,
      plages: { n: plagesN, fautives: plagesF, wilsonFautives: Poses.wilson(plagesF, plagesN) },
      passe: { ecrits: passe.length, valides: compte(passe.filter(c => c.etat === 'valide')), avecVisites: compte(passe.filter(c => c.etat === 'valide' || c.etat === 'visite-sans-action')) } } };
}

const pc = w => w && w.n ? `${w.k}/${w.n} (${(w.part * 100).toFixed(1).replace('.', ',')} % [${(w.bas * 100).toFixed(1).replace('.', ',')} ; ${(w.haut * 100).toFixed(1).replace('.', ',')}])` : '0/0';
function ligneCompte(nom, c) {
  return `  ${nom} : ${c.n} jugés ; justes (10 mm ou moins) ${pc(c.wilsonJustes)} ; 10 à 50 mm ${c.de10a50} ; mauvaise voie (plus de 50 mm, pire rail, 3D) ${pc(c.wilsonFautes)}` + (c.maxMm !== null ? ` ; max ${String(c.maxMm).replace('.', ',')} mm` : '');
}
function blocTexte(titre, p) {
  const o = [titre, `  posés du lot ${p.poses} : sans Écho ${p.sansEcho}, non jugés ${p.nonJuges}, repère ${p.repere}, écartés D-285 ${p.ecartesD285}, visités sans action ${p.visitesSansAction}, validés ${p.valides.n}`,
    ligneCompte('sans les « visité sans action »', p.valides), ligneCompte('avec les « visité sans action »', p.avecVisites)];
  if (Array.isArray(p.series)) o.push(`  séries de fautes ${p.series.length}` + (p.series.length ? ' : ' + p.series.map(s => `${s.debut}${s.fin !== s.debut ? '-' + s.fin : ''} (${s.fautes}, max ${s.maxMm} mm)`).join(', ') : ''));
  else if (fini(p.series)) o.push(`  séries de fautes ${p.series}`);
  if (p.plages) o.push(`  plages jugées ${p.plages.n}, fautives ${pc(p.plages.wilsonFautives)}`);
  if (p.tirage) {
    o.push(`  SÉANCE TIRÉE AU SORT : ${p.tirage.tires} cuts tirés, jugés ${pc(p.tirage.couverture)} (couverture)`, '  ' + ligneCompte('tirés, sans les « visité sans action »', p.tirage.valides).trim(),
      '  ' + ligneCompte('tirés, avec', p.tirage.avecVisites).trim(), `    plages tirées jugées ${p.tirage.plages.n}, fautives ${pc(p.tirage.plages.wilsonFautives)}`,
      '  ' + ligneCompte(`hors tirage (choisis, biais possible ; ${p.horsTirage.poses} posés)`, p.horsTirage.avecVisites).trim());
  }
  if (p.passe && p.passe.ecrits) o.push(`  deuxième passe (à part) : ${p.passe.ecrits} écrits`, '  ' + ligneCompte('écrits par la passe, validés', p.passe.valides).trim());
  return o.join('\n');
}
function texte(r) {
  const o = [`Juge des posés faux — paquet ${r.build || '?'}`, `Définition : ${r.definition}.`, ''];
  for (const p of r.parties) o.push(p.lotTrouve ? blocTexte(`Partie ${p.partie}`, p) : `Partie ${p.partie} : aucun lot dans le journal`, '');
  if (r.parties.length > 1) o.push(blocTexte(`Total (${r.parties.length} parties)`, r.total));
  return o.join('\n');
}
const COLONNES = ['partie', 'cut', 'source', 'etat', 'classe', 'mm', 'gaucheMm', 'droiteMm', 'dureeVisiteS', 'serie', 'tire'];
function enCsv(r) {
  const v = x => x === null || x === undefined ? '' : x === true ? 'oui' : x === false ? 'non' : String(x);
  return [COLONNES.join(';'), ...r.parties.flatMap(p => p.cuts.map(c => COLONNES.map(k => v(c[k])).join(';')))].join('\n') + '\n';
}

const USAGE = 'Usage : node tools/juge-poses-faux.cjs <dossier-du-lot> --echo <dossier>... [--partie N]... [--tirage liste.txt] [--ecart-serie 10] [--json f.json] [--csv f.csv]';
function lireArguments(argv) {
  const a = { dossier: null, echo: [], parties: [], tirage: null, ecartSerie: ECART_SERIE, json: null, csv: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--echo') a.echo.push(argv[++i]);
    else if (k === '--partie') a.parties.push(Number(argv[++i]));
    else if (k === '--tirage') a.tirage = argv[++i];
    else if (k === '--ecart-serie') a.ecartSerie = Number(argv[++i]);
    else if (k === '--json') a.json = argv[++i];
    else if (k === '--csv') a.csv = argv[++i];
    else if (k.startsWith('--')) throw Error(`Argument inconnu : ${k}. ${USAGE}`);
    else if (a.dossier === null) a.dossier = k;
    else throw Error(`Un seul dossier de lot attendu. ${USAGE}`);
  }
  if (!a.dossier || !a.echo.length) throw Error(`dossier du lot et --echo attendus. ${USAGE}`);
  if (a.parties.some(p => !Number.isInteger(p)) || !Number.isInteger(a.ecartSerie) || a.ecartSerie < 1) throw Error(`--partie et --ecart-serie attendent des entiers. ${USAGE}`);
  return a;
}
function executer(argv, sortie = console.log) {
  const a = lireArguments(argv);
  const journal = Poses.lireJournalDir(a.dossier), echo = Poses.lireEcho(L.dossiersEcho(a.echo));
  const r = juger({ journal, echo, parties: a.parties, tirage: a.tirage ? lireTirage(fs.readFileSync(a.tirage, 'utf8')) : null, ecartSerie: a.ecartSerie });
  const ecrire = (f, t) => { const abs = path.resolve(f); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, t); };
  if (a.json) ecrire(a.json, JSON.stringify(r, null, 1));
  if (a.csv) ecrire(a.csv, enCsv(r));
  sortie(texte(r));
  return r;
}
if (require.main === module) {
  try { executer(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { FORMAT, JUSTE_MM, FAUTE_MM, D285_S, etatDe, classeDe, seriesEtPlages, lireTirage, juger, texte, enCsv, lireArguments, executer };
