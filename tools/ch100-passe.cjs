#!/usr/bin/env node
'use strict';
/*
 * ch100-passe.cjs — CH-100, mesure 2 : la deuxième passe des différés, écritures réelles et « poserait », depuis le 26/10.
 * Hors ligne, lecture seule des collections de banane-data. Aucun réglage, aucune règle nouvelle.
 *
 *   node tools/ch100-passe.cjs --collections <banane-data/collections> --travail <dossier de travail> --sortie <dossier de sortie>
 *
 * Le dossier de travail reçoit des LIENS SYMBOLIQUES (un dossier par export de lot, un par collection d'Écho) : rien n'est copié ni
 * modifié dans les collections. Les archives 7z ne sont pas lues (aucun décompresseur) : elles sont listées « illisibles ».
 *
 * DÉFINITIONS (chaque chiffre dit sa population)
 *   - lot : un `batch-started` du journal, daté par son départ (UTC). Un lot présent dans plusieurs exports (journal cumulé) n'est
 *     compté qu'une fois (export qui porte le plus d'événements de passe pour ce lot, le plus récent à égalité).
 *   - période : départ du lot le 26/10/2026 ou après. À PART, jamais additionnée : la partie 0 du 23/10 (lot 2, partie de réglage de la
 *     garde A). Un lot antérieur resté dans un journal cumulé est écarté et compté.
 *   - mode de la passe : champ `mode` de `passe-differes-ombre-fin` (« ombre » ou « ecriture », D-259) ; absent = « inconnu ».
 *   - UNE DÉCISION PAR CUT : la PREMIÈRE décision `passe-differes-ombre` du cut dans le lot, dans l'ordre du temps (c'est la passe 1 ;
 *     les décisions suivantes, passe 2 ou relance, sont comptées mais ne changent pas la décision retenue). Un cut déjà décidé dans un
 *     lot antérieur du même jour et de la même partie est « revu » : écarté des taux et compté.
 *   - ÉCRITURE : cut porteur d'un `passe-differes-ecriture` de résultat « ecrit » dans le lot (que la décision qui l'a fait écrire soit
 *     de la passe 1 ou de la passe 2 : la passe est notée). Écart = correction de l'opérateur depuis la pose écrite : pire rail, 3D,
 *     base = première visite de l'Écho (elle voit la pose écrite ; CH-034 § 8 : ajouter le décalage une seconde fois est faux).
 *     États : valide (validation de l'opérateur, écart mesuré) ; visite-sans-action (visité 0,8 s au moins, aucun rail déplacé, aucune
 *     validation : 0 mm, compté à part, taux donnés SANS et AVEC) ; ecarte-d285 (validation sans mouvement d'une visite de moins de
 *     1,5 s : écartée, D-285) ; non-juge ; sans-echo. C'est `etatDe(ligne, passe = vrai)` de tools/juge-poses-faux.cjs.
 *   - OMBRE (« poserait » non écrit, première décision) : écart = pire rail, 3D, entre la pose de l'ombre (`decal`, mm, repère profil de
 *     la pose de départ d'ESV) et la pose finale de l'opérateur ramenée à la pose de départ :
 *     `Voie.ecartPose(decal, J.micDepuisDepart(ligne))`, comme `ombreDe` de tools/juger-lot.cjs. « Visité sans action » n'apprend rien
 *     d'un cut non posé : non jugé. La validation sans mouvement de moins de 1,5 s est écartée aussi (D-285) et comptée.
 *   - GARDE A : première décision « rien » dont `garde.bloque` est vrai ou dont le motif est `garde-appuis`. La pose refusée est
 *     consignée (`decal`) : elle est jugée comme une ombre. « Bonne pose retirée » = 10 mm ou moins ; « faute retirée » = plus de 50 mm.
 *     Calcul statique : l'effet d'un refus sur les poses suivantes (transport) n'est pas refait.
 *   - classes : juste = 10 mm ou moins ; « 10-50 » ; faute = plus de 50 mm (arrondi au micromètre). Intervalles de Wilson à 95 %.
 *   - seuil du ticket : moins de 20 écritures jugées = « non concluable ».
 * SORTIES (aucun identifiant : ni UUID, ni page, ni coordonnée, ni extrait de journal) : `inventaire.csv` (un lot par ligne),
 * `cuts.csv` (un cut par ligne), `resume.json`, `resume.txt`.
 */
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const L = require('./juger-lot.cjs');
const J = require('./jointure-echo-orbite.cjs');
const Poses = require('./precision-poses.cjs');
const Juge = require('./juge-poses-faux.cjs');
const Voie = require('../src/voie-recentree.js');

const DEBUT = Date.parse('2026-10-26T00:00:00Z');
const A_PART = '2026-10-23_v4.9.5.19_partie-0-lot-2';
const SEUIL_ECRITURES = 20, D285_S = 1.5, SANS_MOUVEMENT_MM = 1;
/* Écho de chaque collection de lot (lu dans les NOTES.md des collections ; la clé de jointure est (partie, cut) : un Écho n'est joint
 * qu'au lot du même jour et du même chantier). Une collection absente d'ici n'a pas d'Écho. */
const ECHOS = {
  '2026-10-23_v4.9.5.19_partie-0-lot-2': ['2026-10-23_v4.9.5.19_echo-partie-0'],
  '2026-10-26_v4.9.5.21_partie-15-lot': ['2026-10-26_v4.9.5.21_echo-partie-15'],
  '2026-10-26_v4.9.5.21_partie-16-lot': ['2026-10-26_v4.9.5.21_echo-partie-16'],
  '2026-10-26_v4.9.5.21_partie-17-lot': ['2026-10-26_v4.9.5.21_echo-partie-17'],
  '2026-10-26_v4.9.5.21_parties-18-19-20-lots': ['2026-10-26_v4.9.5.21_echo-partie-18', '2026-10-26_v4.9.5.21_echo-partie-20'],
  '2026-10-26_v4.9.5.22_partie-0-lot': ['2026-10-26_v4.9.5.23_echo-partie-0'],
  '2026-10-26_v4.9.5.23_partie-1-lot': ['2026-10-26_v4.9.5.23_echo-partie-1'],
  '2026-10-29_CH-012_poses-reference-strictes-partie17': ['2026-10-29_CH-012_poses-reference-strictes-partie17'],
  '2026-11-01_v4.9.5.30_aurore-parties-10-11': ['2026-11-01_v4.9.5.30_aurore-parties-10-11'],
  '2026-11-02_v4.9.5.31_aurore-une-seule-partie': ['2026-11-02_v4.9.5.31_partie0-echo-complet'],
  '2026-11-02_v4.9.5.31_constellation-fin-de-lot-newpart': ['2026-11-02_v4.9.5.31_partie0-echo-complet'],
  '2026-11-02_v4.9.5.35_constellation-parties-12-13-14': ['2026-11-02_v4.9.5.35_constellation-parties-12-13-14'],
  '2026-11-04_v5_lot-orbite-parties-6-15-et-echo': ['2026-11-04_v5_echo-manuel-parties-10-13-14-15'],
  '2026-11-05_v5_reference-avant-apprentissage': ['2026-11-05_v5_reference-avant-apprentissage'],
  '2026-11-06_v5_constellation-parties-13-16': ['2026-11-06_v5_constellation-parties-13-16'],
  '2026-11-08_v5_vision-echo': ['2026-11-08_v5_vision-echo'],
};

const fini = v => Number.isFinite(v);
const arr = (v, d = 1) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const instant = e => { const t = Date.parse(e && e.timestamp || ''); return fini(t) ? t : null; };
const classeDe = Juge.classeDe;

/* Parcours récursif : fichiers d'une collection. */
function fichiers(dir) {
  const out = [];
  const marche = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) marche(p); else out.push(p); } };
  marche(dir);
  return out;
}
/* Liens symboliques : travail/lots/<collection>/<horodatage>/ et travail/echos/<collection>/. */
function preparer(collections, travail) {
  const lots = [], echos = new Set(), illisibles = [];
  for (const col of fs.readdirSync(collections).filter(n => /^2026-1[01]-/.test(n)).sort()) {
    const racine = path.join(collections, col);
    if (!fs.statSync(racine).isDirectory()) continue;
    const vus = new Set();
    let n7z = 0;
    for (const f of fichiers(racine)) {
      const nom = path.basename(f);
      if (/\.7z(\.\d{3})?$/i.test(nom)) { n7z++; continue; }
      if (!/\.zip$/i.test(nom)) continue;
      const mLot = /ariane-lot-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/.exec(nom);
      let cible = null;
      if (mLot) { cible = path.join(travail, 'lots', col, mLot[1]); if (!vus.has(mLot[1])) { vus.add(mLot[1]); lots.push({ collection: col, export: mLot[1], dir: cible }); } }
      else if (/ariane-echo-/.test(nom)) { cible = path.join(travail, 'echos', col); echos.add(col); }
      if (!cible) continue;
      fs.mkdirSync(cible, { recursive: true });
      const lien = path.join(cible, nom);
      try { fs.lstatSync(lien); } catch { fs.symlinkSync(f, lien); }
    }
    if (n7z) illisibles.push({ collection: col, archives7z: n7z });
  }
  return { lots, echos, illisibles };
}

/* État d'un « poserait » non écrit ou d'une pose refusée : la pose de l'ombre contre la pose finale de l'opérateur. */
function etatOmbre(ligne, decal) {
  if (!ligne || !ligne.dansEcho) return { etat: 'sans-echo' };
  const duree = fini(ligne.dureeVisiteS) ? ligne.dureeVisiteS : null;
  if (ligne.referenceHumaine !== 'observee' || ligne.regleVisiteBon) return { etat: 'non-juge', duree };
  const corr = ligne.ecartHumain && ligne.ecartHumain.maxDist3dMm;
  const sansMouvement = ligne.etiquetteEcho === 'VALIDATE_NO_MOVEMENT' || (ligne.base !== 'ariane' && fini(corr) && corr <= SANS_MOUVEMENT_MM);
  if (sansMouvement && duree !== null && duree < D285_S) return { etat: 'ecarte-d285', duree };
  if (!decal || !Array.isArray(decal.left) || !Array.isArray(decal.right)) return { etat: 'non-juge', duree };
  const mm = Voie.ecartPose({ left: decal.left.slice(0, 3), right: decal.right.slice(0, 3) }, J.micDepuisDepart(ligne));
  return fini(mm) ? { etat: 'valide', mm: arr(mm, 2), duree } : { etat: 'non-juge', duree };
}
const normeDecal = d => d && Array.isArray(d.left) && Array.isArray(d.right) ? arr(Math.max(Math.hypot(...d.left.slice(0, 3)), Math.hypot(...d.right.slice(0, 3))), 1) : null;

/* Un export → ses lots (un par batch-started), avec leurs événements de passe. */
function lotsDuJournal(journal, source) {
  const ev = journal.events.filter(e => instant(e) !== null).sort((a, b) => instant(a) - instant(b));
  const out = new Map();
  for (const e of ev) if (e.type === 'batch-started' && e.batch && e.batch.id && !out.has(e.batch.id)) {
    out.set(e.batch.id, { id: e.batch.id, t0: instant(e), partie: e.identity ? e.identity.part : null, source, journal, ombres: [], ecritures: [], fins: [], finsEcriture: [], differesFinalises: new Set() });
  }
  for (const e of ev) {
    const lot = e.batchId && out.get(e.batchId);
    if (!lot) continue;
    if (e.type === 'passe-differes-ombre' && e.identity) lot.ombres.push(e);
    else if (e.type === 'passe-differes-ecriture' && e.identity) lot.ecritures.push(e);
    else if (e.type === 'passe-differes-ombre-fin') lot.fins.push(e);
    else if (e.type === 'passe-differes-ecriture-fin') lot.finsEcriture.push(e);
    else if (e.type === 'defer-finalized' && e.identity && Number.isInteger(e.identity.cut)) lot.differesFinalises.add(e.identity.cut);
  }
  return [...out.values()];
}

function mesurer({ collections, travail }) {
  const prep = preparer(collections, travail);
  /* 1. Tous les lots, dédoublonnés par identifiant de lot (jamais écrit en sortie). Les journaux ne sont pas gardés en mémoire. */
  const parId = new Map();
  let exportsLus = 0;
  const exportsIllisibles = [];
  for (const x of prep.lots) {
    let journal;
    try { journal = Poses.lireJournalDir(x.dir); } catch (e) { exportsIllisibles.push({ collection: x.collection, export: x.export }); continue; }
    exportsLus++;
    for (const lot of lotsDuJournal(journal, x)) {
      const n = lot.ombres.length + lot.ecritures.length + lot.fins.length, vu = parId.get(lot.id);
      const leger = { id: lot.id, t0: lot.t0, partie: lot.partie, source: x, ecrits: lot.ecritures.filter(e => e.resultat === 'ecrit').length };
      if (!vu || n > vu.n || (n === vu.n && x.export > vu.lot.source.export)) parId.set(lot.id, { n, lot: leger });
    }
  }
  const tous = [...parId.values()].map(x => x.lot).sort((a, b) => a.t0 - b.t0);
  const anterieurs = tous.filter(l => l.t0 < DEBUT && l.source.collection !== A_PART);
  const choisis = new Set(tous.filter(l => l.t0 >= DEBUT || l.source.collection === A_PART).map(l => l.id));

  /* 2. Export par export, chacun dans un processus fils (la mémoire d'un Écho est rendue à la fin) : le journal, l'Écho de sa
   * collection, une jointure par partie. */
  const inventaire = [], cuts = [];
  for (const x of prep.lots) {
    const ids = [...parId.values()].filter(v => v.lot.source === x && choisis.has(v.lot.id)).map(v => v.lot.id);
    if (!ids.length) continue;
    process.stderr.write(`export ${x.collection} ${x.export} (${ids.length} lot(s))\n`);
    const r = spawnSync(process.execPath, ['--max-old-space-size=9000', __filename, '--enfant', JSON.stringify({ x, ids, travail, echos: (ECHOS[x.collection] || []).filter(c => prep.echos.has(c)) })],
      { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'inherit'] });
    if (r.status !== 0) { exportsIllisibles.push({ collection: x.collection, export: x.export, raison: 'jointure en échec (mémoire ou lecture)' }); continue; }
    const d = JSON.parse(r.stdout);
    inventaire.push(...d.inventaire); cuts.push(...d.cuts);
  }
  /* Cuts « revus » : déjà décidés dans un lot antérieur du même jour et de la même partie. */
  inventaire.sort((a, b) => a.t0 - b.t0); cuts.sort((a, b) => a.t0 - b.t0 || a.cut - b.cut);
  const dejaVus = new Set();
  for (const c of cuts) {
    if (c.aPart) continue;
    const cle = `${c.date}|${c.partie}|${c.cut}`;
    if (dejaVus.has(cle)) { c.revu = true; const i = inventaire.find(v => v.t0 === c.t0 && v.partie === c.partie); if (i) i.revus++; } else dejaVus.add(cle);
  }
  return { prep, exportsLus, exportsIllisibles, anterieurs, inventaire, cuts };
}

/* Processus fils : un export. */
function enfant({ x, ids, travail, echos }) {
  const journal = Poses.lireJournalDir(x.dir);
  const source = { ...x, version: journal.version || null, build: journal.build || null };
  const echo = echos.length ? Poses.lireEcho(L.dossiersEcho(echos.map(c => path.join(travail, 'echos', c)))) : null;
  const cacheLignes = new Map();
  const lignesDe = (partie) => {
    if (!cacheLignes.has(partie)) cacheLignes.set(partie, echo ? L.indexLignes(journal, echo, partie) : null);
    return cacheLignes.get(partie);
  };
  const inventaire = [], cuts = [], voulus = new Set(ids);
  for (const lot of lotsDuJournal(journal, source)) if (voulus.has(lot.id)) traiterLot(lot, lignesDe, inventaire, cuts);
  return { inventaire, cuts };
}

/* Un lot → sa ligne d'inventaire et ses cuts. */
function traiterLot(lot, lignesDe, inventaire, cuts) {
  {
  /* 3. Par lot : inventaire et cuts. */
    const jour = new Date(lot.t0).toISOString().slice(0, 10), aPart = lot.source.collection === A_PART;
    const modes = [...new Set(lot.fins.map(f => f.mode).filter(Boolean))];
    const mode = modes.length ? modes.join('+') : (lot.ecritures.length ? 'ecriture' : (lot.ombres.length || lot.fins.length ? 'inconnu' : 'aucune-passe'));
    const lignes = lot.ombres.length || lot.ecritures.length ? lignesDe(lot.partie) : null;
    const premiere = new Map(), nDec = new Map(), suivantes = new Map();
    for (const e of lot.ombres) {
      if (e.identity.part !== lot.partie) continue;
      const c = e.identity.cut;
      nDec.set(c, (nDec.get(c) || 0) + 1);
      if (!premiere.has(c)) premiere.set(c, e); else { if (!suivantes.has(c)) suivantes.set(c, []); suivantes.get(c).push(e); }
    }
    const ecrits = new Map(), refusEcriture = new Map();
    for (const e of lot.ecritures) { if (e.identity.part !== lot.partie) continue; (e.resultat === 'ecrit' ? ecrits : refusEcriture).set(e.identity.cut, e); }
    const inv = { t0: lot.t0, date: jour, heureUTC: new Date(lot.t0).toISOString().slice(11, 16), collection: lot.source.collection, partie: lot.partie, aPart,
      version: lot.source.version, build: lot.source.build, mode, echo: !!(ECHOS[lot.source.collection] || []).length && !!lignes,
      differes: lot.fins.length && fini(lot.fins[0].differes) ? lot.fins[0].differes : lot.differesFinalises.size, differesFinalises: lot.differesFinalises.size,
      decisions: lot.ombres.length, decisionsPasse1: lot.ombres.filter(e => e.passe === 1).length, decisionsPasse2: lot.ombres.filter(e => e.passe === 2).length,
      cutsDecides: premiere.size, poserait: 0, rien: 0, refusGarde: 0, ecrits: ecrits.size, ecritsDecidesPasse2: 0, refusEcriture: refusEcriture.size,
      poseraitNonEcrits: 0, revus: 0, echoVus: 0 };
    for (const [cut, e] of [...premiere.entries()].sort((a, b) => a[0] - b[0])) {
      const refusGarde = e.decision === 'rien' && ((e.garde && e.garde.bloque === true) || e.motif === 'garde-appuis');
      if (e.decision === 'poserait') inv.poserait++; else if (e.decision === 'rien') inv.rien++;
      if (refusGarde) inv.refusGarde++;
      const ecrit = ecrits.get(cut) || null;
      const suite = suivantes.get(cut) || [], poseraitApres = suite.find(x => x.decision === 'poserait') || null;
      const type = ecrit ? 'ecriture' : e.decision === 'poserait' ? 'ombre-poserait' : refusGarde ? 'refus-garde' : 'rien';
      if (ecrit && e.decision !== 'poserait') inv.ecritsDecidesPasse2++;
      if (type === 'ombre-poserait') inv.poseraitNonEcrits++;
      const revu = false;
      const ligne = lignes ? lignes.get(cut) : null;
      let et = { etat: lignes ? 'sans-echo' : 'pas-d-echo' };
      if (lignes) {
        if (type === 'ecriture') et = Juge.etatDe(ligne, true);
        else if (type === 'ombre-poserait' || type === 'refus-garde') et = etatOmbre(ligne, e.decal);
        else et = { etat: ligne && ligne.dansEcho ? 'non-concerne' : 'sans-echo' };
      }
      if (ligne && ligne.dansEcho) inv.echoVus++;
      const mm = fini(et.mm) ? et.mm : null;
      cuts.push({ t0: lot.t0, date: jour, collection: lot.source.collection, partie: lot.partie, cut, aPart, revu, mode, type,
        premiereDecision: e.decision, premierePasse: e.passe ?? null, motif: e.decision === 'rien' ? (e.motif || null) : null,
        gardeBloque: e.garde ? e.garde.bloque === true : null, gardeMotif: e.garde ? e.garde.motif || null : null,
        gardeDeplacementMm: e.garde && fini(e.garde.deplacementMm) ? e.garde.deplacementMm : null, gardeAppuiCuts: e.garde && Number.isInteger(e.garde.appuiNormalCuts) ? e.garde.appuiNormalCuts : null,
        deplacementPoseMm: normeDecal(ecrit ? ecrit.decal : e.decal), decisions: nDec.get(cut), poseraitEnsuite: e.decision !== 'poserait' && !!poseraitApres,
        ecrit: !!ecrit, passeEcriture: ecrit ? ecrit.passe ?? null : null, refusEcriture: refusEcriture.has(cut),
        etat: et.etat, mm, classe: mm !== null ? classeDe(mm) : null, dureeVisiteS: fini(et.duree) ? arr(et.duree, 2) : null,
        base: type === 'ecriture' && ligne && ligne.dansEcho ? ligne.base || null : null });
    }
    /* Écrit sans décision d'ombre retrouvée dans le lot (ne devrait pas arriver) : compté. */
    inv.ecritsSansDecision = [...ecrits.keys()].filter(c => !premiere.has(c)).length;
    inventaire.push(inv);
  }
}

/* Comptes d'une liste de cuts jugés. */
function bilan(liste) {
  const de = e => liste.filter(c => c.etat === e), valides = de('valide'), avec = [...valides, ...de('visite-sans-action')];
  const compte = (x) => { const k = c => x.filter(y => y.classe === c).length, mm = x.map(y => y.mm).filter(fini);
    return { n: x.length, justes: k('juste'), de10a50: k('10-50'), fautes: k('faute'), maxMm: mm.length ? Math.max(...mm) : null,
      wilsonJustes: Poses.wilson(k('juste'), x.length), wilsonFautes: Poses.wilson(k('faute'), x.length) }; };
  return { n: liste.length, sansEcho: de('sans-echo').length + de('pas-d-echo').length, nonJuges: de('non-juge').length, ecartesD285: de('ecarte-d285').length,
    visitesSansAction: de('visite-sans-action').length, valides: compte(valides), avecVisites: compte(avec) };
}
function resumer(m) {
  const P = m.cuts.filter(c => !c.aPart && !c.revu), A = m.cuts.filter(c => c.aPart);
  const parLot = (liste) => { const g = new Map(); for (const c of liste) { const k = `${c.date} partie ${c.partie}`; if (!g.has(k)) g.set(k, []); g.get(k).push(c); } return [...g.entries()].map(([lot, l]) => ({ lot, ...bilan(l) })); };
  const bloc = (liste) => {
    const ecr = liste.filter(c => c.type === 'ecriture'), omb = liste.filter(c => c.type === 'ombre-poserait'), gar = liste.filter(c => c.type === 'refus-garde');
    return { cutsDecides: liste.length, ecriture: { total: bilan(ecr), parLot: parLot(ecr), deciseesPasse2: ecr.filter(c => c.premiereDecision !== 'poserait').length },
      ombre: { total: bilan(omb), parLot: parLot(omb), parMode: Object.fromEntries([...new Set(omb.map(c => c.mode))].map(k => [k, bilan(omb.filter(c => c.mode === k))])),
        parGarde: Object.fromEntries([...new Set(omb.map(c => c.gardeMotif || 'sans-garde'))].map(k => [k, bilan(omb.filter(c => (c.gardeMotif || 'sans-garde') === k))])) },
      gardeA: { refus: gar.length, total: bilan(gar), parLot: parLot(gar), poseraitEnsuite: gar.filter(c => c.poseraitEnsuite).length },
      rien: liste.filter(c => c.type === 'rien').length };
  };
  const periode = bloc(P), jug = periode.ecriture.total.avecVisites.n;
  const inv = m.inventaire.filter(i => !i.aPart), som = k => inv.reduce((s, i) => s + (i[k] || 0), 0);
  const fautes = periode.ecriture.total.avecVisites.fautes;
  return { format: 'ariane-ch100-passe-v1', periode: 'lots partis le 26/10/2026 ou après ; partie 0 du 23/10 (lot 2) à part',
    exportsLus: m.exportsLus, exportsIllisibles: m.exportsIllisibles, collections7zNonLues: m.prep.illisibles,
    lotsAnterieursEcartes: m.anterieurs.map(l => ({ date: new Date(l.t0).toISOString().slice(0, 10), partie: l.partie, collection: l.source.collection, ecrits: l.ecrits })),
    inventaire: { lots: inv.length, lotsAvecPasse: inv.filter(i => i.decisions || i.ecrits).length, parMode: Object.fromEntries([...new Set(inv.map(i => i.mode))].map(k => [k, inv.filter(i => i.mode === k).length])),
      differes: som('differes'), decisions: som('decisions'), cutsDecides: som('cutsDecides'), poserait: som('poserait'), rien: som('rien'), refusGarde: som('refusGarde'),
      ecrits: som('ecrits'), ecritsDecidesPasse2: som('ecritsDecidesPasse2'), refusEcriture: som('refusEcriture'), poseraitNonEcrits: som('poseraitNonEcrits'), revus: som('revus'), ecritsSansDecision: som('ecritsSansDecision') },
    resultat: periode, aPart2310: bloc(A),
    seuil: { ecrituresJugees: jug, seuil: SEUIL_ECRITURES, concluable: jug >= SEUIL_ECRITURES, fautes,
      borneHauteFautes: Poses.wilson(fautes, jug).haut, pour5pcSansFaute: 73, pour3pcSansFaute: 125, manquePour5pc: Math.max(0, 73 - jug), manquePour3pc: Math.max(0, 125 - jug),
      ecritsSansEchoOuNonJuges: periode.ecriture.total.n - jug } };
}

const pc = w => w && w.n ? `${w.k}/${w.n} (${(w.part * 100).toFixed(1).replace('.', ',')} % [${(w.bas * 100).toFixed(1).replace('.', ',')} ; ${(w.haut * 100).toFixed(1).replace('.', ',')}])` : '0/0';
const ligneCompte = (nom, c) => `    ${nom} : ${c.n} jugés ; justes ${pc(c.wilsonJustes)} ; 10 à 50 mm ${c.de10a50} ; plus de 50 mm ${pc(c.wilsonFautes)}` + (c.maxMm !== null ? ` ; max ${String(c.maxMm).replace('.', ',')} mm` : '');
function blocTexte(titre, b) {
  const o = [titre, `  ${b.n} cuts : sans Écho ${b.sansEcho}, non jugés ${b.nonJuges}, écartés D-285 ${b.ecartesD285}, visités sans action ${b.visitesSansAction}, validés ${b.valides.n}`];
  o.push(ligneCompte('sans les « visité sans action »', b.valides));
  if (b.visitesSansAction) o.push(ligneCompte('avec les « visité sans action »', b.avecVisites));
  return o;
}
function texte(r, m) {
  const o = ['CH-100, mesure 2 : deuxième passe, écritures réelles et « poserait », depuis le 26/10 (hors ligne).',
    `Exports lus ${r.exportsLus} ; collections en 7z non lues : ${r.collections7zNonLues.map(x => x.collection).join(', ') || 'aucune'} ; lots antérieurs au 26/10 écartés : ${r.lotsAnterieursEcartes.length}.`, '',
    'INVENTAIRE (lots porteurs d\'au moins une décision de passe ; les autres sont dans inventaire.csv)',
    'date heure | partie | version/paquet | mode | différés | décisions (p1+p2) | cuts décidés : poserait / rien / dont refus garde A | écrits (dont décidés en passe 2) | refus à l\'écriture | Écho'];
  for (const i of m.inventaire) if (i.decisions || i.ecrits)
    o.push(`${i.aPart ? '[À PART] ' : ''}${i.date} ${i.heureUTC} | ${i.partie} | ${i.version || '?'}${i.build ? '/' + i.build : ''} | ${i.mode} | ${i.differes} | ${i.decisions} (${i.decisionsPasse1}+${i.decisionsPasse2}) | ${i.cutsDecides} : ${i.poserait} / ${i.rien} / ${i.refusGarde} | ${i.ecrits} (${i.ecritsDecidesPasse2}) | ${i.refusEcriture} | ${i.echo ? `oui (${i.echoVus} cuts décidés vus)` : 'non'}${i.revus ? ` | revus ${i.revus}` : ''}`);
  const I = r.inventaire;
  o.push('', `Total période : ${I.lots} lots, ${I.lotsAvecPasse} avec passe (${Object.entries(I.parMode).map(([k, v]) => `${k} ${v}`).join(', ')}) ; différés ${I.differes} ; décisions ${I.decisions} ; cuts décidés ${I.cutsDecides} (revus ${I.revus}) : poserait ${I.poserait}, rien ${I.rien} dont refus de la garde A ${I.refusGarde} ; écrits ${I.ecrits} (dont décidés en passe 2 : ${I.ecritsDecidesPasse2}) ; « poserait » non écrits ${I.poseraitNonEcrits} ; refus à l'écriture ${I.refusEcriture}.`, '');
  const sec = (nom, R) => {
    o.push(`== ${nom} ==`, ...blocTexte('ÉCRITURES RÉELLES (« ecrit »), correction de l\'opérateur depuis la pose écrite', R.ecriture.total));
    for (const p of R.ecriture.parLot) o.push(`    ${p.lot} : ${p.n} écrits, sans Écho ${p.sansEcho}, non jugés ${p.nonJuges}, D-285 ${p.ecartesD285}, visités sans action ${p.visitesSansAction}, validés ${p.valides.n} (justes ${p.valides.justes}, 10-50 ${p.valides.de10a50}, >50 ${p.valides.fautes})`);
    o.push(...blocTexte('OMBRE (« poserait » non écrit, première décision), pose de l\'ombre contre la pose finale de l\'opérateur', R.ombre.total));
    for (const [k, b] of Object.entries(R.ombre.parGarde)) o.push(`    garde « ${k} » : ${b.n} cuts, jugés ${b.valides.n} (justes ${b.valides.justes}, 10-50 ${b.valides.de10a50}, >50 ${b.valides.fautes})`);
    for (const p of R.ombre.parLot) o.push(`    ${p.lot} : ${p.n} poserait, sans Écho ${p.sansEcho}, non jugés ${p.nonJuges}, D-285 ${p.ecartesD285}, jugés ${p.valides.n} (justes ${p.valides.justes}, 10-50 ${p.valides.de10a50}, >50 ${p.valides.fautes})`);
    o.push(...blocTexte(`GARDE A : ${R.gardeA.refus} refus à la première décision (dont « poserait » ensuite dans le lot : ${R.gardeA.poseraitEnsuite}), pose refusée contre la pose finale`, R.gardeA.total));
    o.push(`    bonnes poses retirées (10 mm ou moins) : ${R.gardeA.total.valides.justes} ; fautes retirées (plus de 50 mm) : ${R.gardeA.total.valides.fautes} ; 10 à 50 mm : ${R.gardeA.total.valides.de10a50} ; non mesurables (sans Écho, non jugés, D-285) : ${R.gardeA.total.n - R.gardeA.total.valides.n}`, '');
  };
  sec('PÉRIODE (depuis le 26/10, hors partie 0 du 23/10)', r.resultat);
  sec('À PART : partie 0 du 23/10, lot 2 (réglage de la garde A)', r.aPart2310);
  const s = r.seuil;
  o.push(`SEUIL DU TICKET : ${s.ecrituresJugees} écritures jugées (validées ou visitées sans action) ; seuil ${s.seuil} : ${s.concluable ? 'CONCLUABLE' : 'NON CONCLUABLE'}. Fautes ${s.fautes} ; borne haute de Wilson ${(s.borneHauteFautes * 100).toFixed(1).replace('.', ',')} %.`,
    `Écho à demander : zéro faute prouve 5 % avec 73 poses jugées (il en manque ${s.manquePour5pc}), 3 % avec 125 (il en manque ${s.manquePour3pc}). Écrits de la période sans Écho ou non jugés : ${s.ecritsSansEchoOuNonJuges}.`);
  return o.join('\n');
}
const COL_INV = ['date', 'heureUTC', 'collection', 'partie', 'aPart', 'version', 'build', 'mode', 'echo', 'differes', 'differesFinalises', 'decisions', 'decisionsPasse1', 'decisionsPasse2', 'cutsDecides', 'poserait', 'rien', 'refusGarde', 'ecrits', 'ecritsDecidesPasse2', 'refusEcriture', 'poseraitNonEcrits', 'revus', 'echoVus', 'ecritsSansDecision'];
const COL_CUT = ['date', 'collection', 'partie', 'cut', 'aPart', 'revu', 'mode', 'type', 'premiereDecision', 'premierePasse', 'motif', 'gardeBloque', 'gardeMotif', 'gardeDeplacementMm', 'gardeAppuiCuts', 'deplacementPoseMm', 'decisions', 'poseraitEnsuite', 'ecrit', 'passeEcriture', 'refusEcriture', 'etat', 'mm', 'classe', 'dureeVisiteS', 'base'];
const csv = (cols, lignes) => { const v = x => x === null || x === undefined ? '' : x === true ? 'oui' : x === false ? 'non' : String(x); return [cols.join(';'), ...lignes.map(l => cols.map(k => v(l[k])).join(';'))].join('\n') + '\n'; };

function executer(argv, sortie = console.log) {
  if (argv[0] === '--enfant') { process.stdout.write(JSON.stringify(enfant(JSON.parse(argv[1])))); return null; }
  const a = {};
  for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (['--collections', '--travail', '--sortie'].includes(k)) a[k.slice(2)] = argv[++i]; else throw Error(`Argument inconnu : ${k}`); }
  if (!a.collections || !a.travail || !a.sortie) throw Error('Usage : node tools/ch100-passe.cjs --collections <dossier> --travail <dossier> --sortie <dossier>');
  fs.mkdirSync(a.travail, { recursive: true }); fs.mkdirSync(a.sortie, { recursive: true });
  const m = mesurer({ collections: path.resolve(a.collections), travail: path.resolve(a.travail) });
  const r = resumer(m), t = texte(r, m);
  fs.writeFileSync(path.join(a.sortie, 'inventaire.csv'), csv(COL_INV, m.inventaire));
  /* cuts.csv : les cuts écrits, « poserait » et refusés par la garde, en entier ; les « rien » hors garde, sans millimètre, y sont aussi. */
  fs.writeFileSync(path.join(a.sortie, 'cuts.csv'), csv(COL_CUT, m.cuts));
  fs.writeFileSync(path.join(a.sortie, 'resume.json'), JSON.stringify(r, null, 1));
  fs.writeFileSync(path.join(a.sortie, 'resume.txt'), t + '\n');
  sortie(t);
  return { m, r };
}
if (require.main === module) {
  try { executer(process.argv.slice(2)); }
  catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}
module.exports = { mesurer, resumer, texte, etatOmbre, executer, ECHOS };
