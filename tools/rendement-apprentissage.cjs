#!/usr/bin/env node
'use strict';
/*
 * rendement-apprentissage.cjs — L'ENTONNOIR D'UN LOT VERS L'APPRENTISSAGE (CH-051). Lecture seule, hors ligne.
 *
 *   node tools/rendement-apprentissage.cjs --table TABLE.json [--table …] [--echo DOSSIER…] [--json SORTIE.json]
 *
 * Entrées : les tables de `tools/jointure-echo-orbite.cjs --sortie` (une par partie), et, si on veut la qualification des états initiaux,
 * les exports Écho (dossiers ou zips, union des segments : le dernier segment l'emporte par record, comme merge-segments).
 *
 * Ce que l'outil compte, par partie puis au total, pour répondre à « qu'est-ce qui, de ce lot, peut encore apprendre quelque chose à Ariane ? » :
 *   lot            cuts du journal, posés, différés, différés sans nuage (motif `input` des deux rails : la capture du lot était vide) ;
 *   echo           cuts vus par l'Écho, références humaines, posés d'Ariane jugés, différés jugés, cuts hors journal jugés ;
 *   couverture     posés d'Ariane jugés sur posés : la seule mesure qui ferme la boucle sur la qualité des poses ;
 *   etiquettes     validations sans mouvement, dont rapides (visite < 1,5 s) ; visites courtes ; corrigées ; plus de 10 mm ; plus de 50 mm ;
 *   differesJuges  par motif du moteur : effectif, part à plus de 50 mm (hors fenêtre de la GCV2), médiane ; `sansTraitsAriane` = différés jugés
 *                  dont la capture du lot était vide (aucune hypothèse de la GCV2 au lot : on n'y apprend rien sur sa décision) ;
 *   apprenables    références, paires d'états initiaux qualifiées (Écho), informatifs = paire qualifiée ET correction de plus de 10 mm.
 * Sans export Écho, la paire qualifiée et les informatifs valent null (« non mesuré »), jamais une estimation.
 * Sortie : comptes, millimètres, numéros de partie ; aucun identifiant, aucune coordonnée.
 */
const fs = require('node:fs'), path = require('node:path');

const VISITE_COURTE_S = 1.5, SEUIL_INFORMATIF_MM = 10, SEUIL_VOIE_MM = 50;
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
const cle = (p, c) => `${p}:${c}`;
const motifs = l => (l.motifDiffere ? [l.motifDiffere.gauche && l.motifDiffere.gauche.motif, l.motifDiffere.droite && l.motifDiffere.droite.motif].map(x => x || '-').join('/') : '-');
const sansNuage = l => motifs(l) === 'input/input';
const observee = l => l.referenceHumaine === 'observee';
const ecartMax = l => (l.ecartHumain && Number.isFinite(l.ecartHumain.maxDist3dMm) ? l.ecartHumain.maxDist3dMm : null);

function analyserPartie(table, eligibilite) {
  const T = Array.isArray(table.table) ? table.table : [];
  const partie = T.length ? T[0].partie : (table.options && table.options.partie) ?? null;
  const journal = T.filter(l => l.dansJournal && l.classe !== 'hors-journal');
  const poses = journal.filter(l => l.classe === 'posee'), differes = journal.filter(l => l.classe === 'differee');
  const vus = T.filter(l => l.dansEcho), refs = T.filter(observee);
  const posesJuges = poses.filter(observee), differesJuges = differes.filter(observee), hors = T.filter(l => l.classe === 'hors-journal' && observee(l));
  const sansMouvement = refs.filter(l => l.etiquetteEcho === 'VALIDATE_NO_MOVEMENT');
  const courtes = refs.filter(l => Number.isFinite(l.dureeVisiteS) && l.dureeVisiteS < VISITE_COURTE_S);
  const corrigees = refs.filter(l => /^VALIDATE_CORRECTED/.test(l.etiquetteEcho || ''));
  const plus10 = refs.filter(l => ecartMax(l) > SEUIL_INFORMATIF_MM), plus50 = refs.filter(l => ecartMax(l) > SEUIL_VOIE_MM);
  const parMotif = {};
  for (const l of differesJuges) { const k = motifs(l); parMotif[k] = parMotif[k] || { n: 0, plus50mm: 0, ecarts: [] }; parMotif[k].n++; if (ecartMax(l) > SEUIL_VOIE_MM) parMotif[k].plus50mm++; parMotif[k].ecarts.push(ecartMax(l)); }
  for (const k of Object.keys(parMotif)) { const m = parMotif[k]; parMotif[k] = { n: m.n, plus50mm: m.plus50mm, medianeMm: r1(med(m.ecarts)) }; }
  let paireQualifiee = null, informatifs = null;
  if (eligibilite) {
    const q = refs.filter(l => eligibilite.get(cle(l.partie, l.cut)) === true);
    paireQualifiee = q.length; informatifs = q.filter(l => ecartMax(l) > SEUIL_INFORMATIF_MM).length;
  }
  return {
    partie,
    lot: { cuts: journal.length, poses: poses.length, differes: differes.length, differesSansNuage: differes.filter(sansNuage).length },
    echo: { cutsVus: vus.length, references: refs.length, posesJuges: posesJuges.length, differesJuges: differesJuges.length, horsJournalJuges: hors.length },
    couverturePoses: { juges: posesJuges.length, poses: poses.length },
    etiquettes: { sansMouvement: sansMouvement.length, sansMouvementRapide: sansMouvement.filter(l => Number.isFinite(l.dureeVisiteS) && l.dureeVisiteS < VISITE_COURTE_S).length,
      visitesCourtes: courtes.length, corrigees: corrigees.length, plus10mm: plus10.length, plus50mm: plus50.length },
    differesJuges: { parMotif, sansTraitsAriane: differesJuges.filter(sansNuage).length, medianeMm: r1(med(differesJuges.map(ecartMax))) },
    apprenables: { references: refs.length, paireQualifiee, informatifs },
  };
}

function additionner(parties) {
  const somme = (chemin) => parties.reduce((a, p) => { const v = chemin.reduce((o, k) => (o ? o[k] : null), p); return v === null || a === null ? null : a + (v || 0); }, 0);
  const T = { partie: 'total', lot: {}, echo: {}, couverturePoses: {}, etiquettes: {}, differesJuges: { parMotif: {}, sansTraitsAriane: 0, medianeMm: null }, apprenables: {} };
  for (const g of ['lot', 'echo', 'couverturePoses', 'etiquettes', 'apprenables']) for (const k of Object.keys(parties[0] ? parties[0][g] : {})) T[g][k] = somme([g, k]);
  for (const p of parties) {
    T.differesJuges.sansTraitsAriane += p.differesJuges.sansTraitsAriane;
    for (const [k, m] of Object.entries(p.differesJuges.parMotif)) { const t = T.differesJuges.parMotif[k] = T.differesJuges.parMotif[k] || { n: 0, plus50mm: 0 }; t.n += m.n; t.plus50mm += m.plus50mm; }
  }
  return T;
}

function analyser(tables, { eligibilite = null } = {}) {
  const parties = tables.map(t => analyserPartie(t, eligibilite));
  return { format: 'ariane-rendement-apprentissage-v1', seuils: { visiteCourteS: VISITE_COURTE_S, informatifMm: SEUIL_INFORMATIF_MM, voieMm: SEUIL_VOIE_MM }, parties, total: additionner(parties) };
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1).replace('.', ',') + ' %' : '—');
const nm = v => (v === null || v === undefined ? 'non mesuré' : String(v));
function texte(R) {
  const L = [];
  L.push('Rendement d’un lot pour l’apprentissage (tables de jointure Écho ↔ Orbite).');
  L.push(`Seuils : visite courte < ${VISITE_COURTE_S} s ; informatif > ${SEUIL_INFORMATIF_MM} mm ; voie > ${SEUIL_VOIE_MM} mm.`);
  for (const p of [...R.parties, R.total]) {
    const t = p.partie === 'total' ? `Total (${R.parties.length} parties)` : `Partie ${p.partie}`;
    L.push('', t);
    L.push(`  lot : ${p.lot.cuts} cuts, posés ${p.lot.poses}, différés ${p.lot.differes} dont sans nuage ${p.lot.differesSansNuage}`);
    L.push(`  Écho : ${p.echo.cutsVus} cuts vus, ${p.echo.references} références ; posés d’Ariane jugés ${p.echo.posesJuges}, différés jugés ${p.echo.differesJuges}, hors journal jugés ${p.echo.horsJournalJuges}`);
    L.push(`  couverture des posés : ${p.couverturePoses.juges}/${p.couverturePoses.poses} (${pct(p.couverturePoses.juges, p.couverturePoses.poses)})`);
    const e = p.etiquettes;
    L.push(`  étiquettes : sans mouvement ${e.sansMouvement} (dont visite courte ${e.sansMouvementRapide}), visites courtes ${e.visitesCourtes}, corrigées ${e.corrigees}, > ${SEUIL_INFORMATIF_MM} mm ${e.plus10mm}, > ${SEUIL_VOIE_MM} mm ${e.plus50mm}`);
    const m = Object.entries(p.differesJuges.parMotif).map(([k, v]) => `${k} ${v.n}${v.plus50mm ? ` (> ${SEUIL_VOIE_MM} mm : ${v.plus50mm})` : ''}${Number.isFinite(v.medianeMm) ? ` méd. ${String(v.medianeMm).replace('.', ',')} mm` : ''}`).join(' ; ');
    L.push(`  différés jugés par motif : ${m || 'aucun'} ; sans traits d’Ariane (capture du lot vide) ${p.differesJuges.sansTraitsAriane}`);
    L.push(`  apprenables : références ${p.apprenables.references}, paire d’états initiaux qualifiée ${nm(p.apprenables.paireQualifiee)}, informatifs ${nm(p.apprenables.informatifs)}`);
  }
  return L.join('\n');
}

/* Qualification des états initiaux lue dans les exports Écho : par cut, la paire est « comparable-candidate » des deux côtés dans le dernier record
 * qui porte une référence humaine. Union des segments ; les nuages ne sont jamais gardés. */
function lireEligibilite(dossiers) {
  const V = require('./lire-volumes.cjs');
  const recs = new Map();
  const deref = doc => { const dict = doc.dictionaries || {}; const r = x => { if (!x || typeof x !== 'object') return x; if (typeof x.__ref === 'string') { const i = x.__ref.lastIndexOf(':'); const d = dict[x.__ref.slice(0, i)]; return d ? r(d[+x.__ref.slice(i + 1)]) : x; } if (Array.isArray(x)) return x.map(r); const o = {}; for (const [k, v] of Object.entries(x)) o[k] = r(v); return o; }; return r; };
  for (const d of dossiers) {
    const fichiers = fs.statSync(d).isDirectory() ? fs.readdirSync(d).filter(f => /\.(zip|json)$/i.test(f)).sort().map(f => path.join(d, f)) : [d];
    for (const f of fichiers) for (const e of V.entrees(f)) {
      if (!/\.json$/.test(e.nom) || /liste/.test(e.nom)) continue;
      let doc; try { doc = JSON.parse(e.lire()); } catch { continue; }
      if (!Array.isArray(doc.records)) continue;
      const D = deref(doc);
      for (const r0 of doc.records) { const r = D(r0); const id = r.recordId || r.id; if (!id) continue; const prev = recs.get(id); if (!prev || String(r.updatedAt || '') >= String(prev.updatedAt || '')) recs.set(id, r); }
    }
  }
  const elig = new Map();
  for (const r of recs.values()) {
    if (!r.identity || !Number.isInteger(r.identity.part) || !Number.isInteger(r.identity.cut) || !r.humanFinalReference) continue;
    const g = r.geometryEligibility || {}; const ok = ['left', 'right'].every(s => g[s] && g[s].status === 'comparable-candidate');
    const k = cle(r.identity.part, r.identity.cut);
    if (!elig.has(k) || String(r.updatedAt || '') >= String(elig.get(k).maj || '')) elig.set(k, { ok, maj: r.updatedAt || '' });
  }
  return new Map([...elig].map(([k, v]) => [k, v.ok]));
}

function lireArguments(argv) {
  const a = { tables: [], echo: [], json: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--table') a.tables.push(argv[++i]);
    else if (x === '--echo') a.echo.push(argv[++i]);
    else if (x === '--json') a.json = argv[++i];
    else throw Error(`option inconnue : ${x}`);
  }
  if (!a.tables.length) throw Error('donner au moins une --table (sortie de tools/jointure-echo-orbite.cjs)');
  return a;
}

function executer(argv) {
  const a = lireArguments(argv);
  const tables = a.tables.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  const eligibilite = a.echo.length ? lireEligibilite(a.echo) : null;
  const R = analyser(tables, { eligibilite });
  console.log(texte(R));
  if (a.json) fs.writeFileSync(a.json, JSON.stringify(R, null, 1));
  return R;
}

module.exports = { analyser, analyserPartie, additionner, texte, lireEligibilite, lireArguments, executer, VISITE_COURTE_S, SEUIL_INFORMATIF_MM, SEUIL_VOIE_MM };
if (require.main === module) { try { executer(process.argv.slice(2)); } catch (e) { console.error(String(e && e.message || e)); process.exit(1); } }
