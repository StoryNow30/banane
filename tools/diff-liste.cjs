#!/usr/bin/env node
/* Ariane 5.0 (E1) — compare la liste d'ESV avant / après la relecture de l'opérateur. Lecture seule, hors ligne.
 *
 *   node tools/diff-liste.cjs AVANT.json APRES.json [--journal J.json] [--json sortie.json] [--detail] [--seuil 1]
 *   node tools/diff-liste.cjs --journal ariane-journal-v4-*.json APRES.json [...]
 *
 * Entrées : instantanés `ariane-liste-partieN-<heure>.json` (même partie), et/ou un journal `ariane-journal-v4-*.json` dont les
 * écritures de validation observées (kind 'write', 2xx, corps avec les six bords) disent ce qu'Ariane a posé.
 *  - deux instantanés : référence = AVANT, comparée à APRES, cut par cut ; avec --journal en plus, les cuts posés par Ariane
 *    sont distingués des verts d'extraction ;
 *  - un instantané + un journal : référence = dernière écriture d'Ariane par cut ; seuls ses cuts sont comparables.
 * Sortie par cut : écart par rail en mm (latéral et vertical dans le repère profil local déduit de la direction des bords
 * voisins ; distance 3D si ce repère manque, dit dans le résumé), changement de statut, de drapeaux. Résumé par classe.
 * Aucune coordonnée n'est écrite : seulement des numéros de cut, des millimètres et des comptes. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const LM = require('../src/liste-memoire.js');
const U = LM.UNITE / 1000;                       // unités par millimètre (10)
const STATUTS = ['valid', 'invalid', 'skipped', 'autre'];
const arr1 = v => Math.round(v * 10) / 10;

function lireJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }

/* Écritures d'Ariane d'un journal : cut → {bords (dm), at}, dernière écriture gagnante, pour la table `cle` si connue
 * (sinon la table qui a le plus d'écritures). */
function ecrituresJournal(j, cle) {
  const ev = Array.isArray(j?.events) ? j.events : [], parTable = new Map();
  for (const e of ev) {
    if (e?.kind !== 'write' || !(e.status >= 200 && e.status < 300) || !Number.isInteger(e.rowIndex) || typeof e.railPairId !== 'string') continue;
    const b = LM.bordsCorps(e.body), k = e.railPairId.lastIndexOf('/'); if (!b || k <= 0) continue;
    const t = LM.empreinte(e.railPairId.slice(0, k));
    if (!parTable.has(t)) parTable.set(t, new Map());
    parTable.get(t).set(e.rowIndex, { bords: b, at: e.timestamp || null });
  }
  let choix = null;
  if (cle && parTable.has(cle)) choix = cle;
  else for (const [t, m] of parTable) if (choix === null || m.size > parTable.get(choix).size) choix = t;
  return { cuts: choix ? parTable.get(choix) : new Map(), tables: parTable.size, correspond: !!cle && choix === cle, ecritures: ev.filter(e => e?.kind === 'write').length };
}

/* Repère profil local au cut i (sur la référence) : tangente horizontale = direction entre les bords gauches des voisins
 * (i−1, i+1, ou un seul côté), latéral = perpendiculaire horizontale, vertical = Z. null si la direction manque. */
function repere(ref, i) {
  const pt = k => (k >= 0 && k < ref.n && [0, 1, 2].every(d => ref.ed[6 * k + d] !== null) ? [ref.ed[6 * k], ref.ed[6 * k + 1]] : null);
  const a = pt(i - 1) || pt(i), b = pt(i + 1) || pt(i);
  if (!a || !b) return null;
  const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty);
  return l > 0.01 * LM.UNITE ? { lat: [-ty / l, tx / l] } : null;
}
function ecartRail(ra, rb, off, rep) {
  const dx = (rb[off] - ra[off]) / U, dy = (rb[off + 1] - ra[off + 1]) / U, dz = (rb[off + 2] - ra[off + 2]) / U, d3 = Math.hypot(dx, dy, dz);
  if (!rep) return { d3: arr1(d3), lat: null, vert: arr1(dz) };
  return { d3: arr1(d3), lat: arr1(dx * rep.lat[0] + dy * rep.lat[1]), vert: arr1(dz) };
}
const complet = r => r.every(v => v !== null);

/* Référence : {n, st, fl, ed, ariane:Set|null, source}. Retour : lignes par cut + résumé. */
function comparer(ref, apres, opt) {
  const seuil = opt?.seuil ?? 1, ariane = ref.ariane || null, cuts = [];
  const cl = { arianeComparables: 0, arianeInchanges: 0, arianeSup1: 0, arianeSup5: 0, arianeSup10: 0, vertsExtractionModifies: 0, vertsExtractionComparables: 0,
    invalidesDevenusValides: 0, statutsChanges: 0, drapeauxChanges: 0, sansRepere3d: 0, sansReference: 0, absentsApres: 0 };
  const n = Math.min(ref.n, apres.n);
  for (let i = 0; i < n; i++) {
    const ra = ref.ed.slice(6 * i, 6 * i + 6), rb = apres.ed.slice(6 * i, 6 * i + 6);
    const estAriane = ariane ? ariane.has(i) : false;
    const stA = ref.st[i], stB = apres.st[i], flA = ref.fl[i], flB = apres.fl[i];
    const statutChange = ref.sansStatut ? false : stA !== stB, drapeauxChange = ref.sansStatut ? false : flA !== flB;
    let rails = null, max = null, mode = null;
    if (complet(ra) && complet(rb)) {
      const rep = repere(ref.reperes || ref, i);
      rails = { gauche: ecartRail(ra, rb, 0, rep), droite: ecartRail(ra, rb, 3, rep) };
      max = Math.max(rails.gauche.d3, rails.droite.d3); mode = rep ? 'profil' : '3d';
      if (!rep) cl.sansRepere3d++;
    } else if (ariane && estAriane) cl.absentsApres++; else if (!ref.sansStatut && complet(ra) !== complet(rb)) cl.absentsApres++;
    if (statutChange) cl.statutsChanges++;
    if (drapeauxChange) cl.drapeauxChanges++;
    const invalideDevenuValide = !ref.sansStatut && stA === 1 && stB === 0 && !estAriane;
    if (invalideDevenuValide) cl.invalidesDevenusValides++;
    if (estAriane) {
      if (max === null) continue;
      cl.arianeComparables++;
      if (max > seuil) cl.arianeSup1++; else cl.arianeInchanges++;
      if (max > 5) cl.arianeSup5++;
      if (max > 10) cl.arianeSup10++;
    } else if (!ref.sansStatut && stA === 0 && max !== null) {
      cl.vertsExtractionComparables++;
      if (max > seuil) cl.vertsExtractionModifies++;
    } else if (ref.sansStatut) cl.sansReference++;
    if ((max !== null && max > seuil) || statutChange || drapeauxChange)
      cuts.push({ cut: i, classe: estAriane ? 'ariane' : 'autre', mode, maxMm: max, ...(rails ? { gauche: rails.gauche, droite: rails.droite } : {}),
        ...(statutChange ? { statut: [STATUTS[stA], STATUTS[stB]] } : {}), ...(drapeauxChange ? { drapeaux: [flA, flB] } : {}) });
  }
  return { cuts, classes: cl, lignes: { avant: ref.n, apres: apres.n, comparees: n } };
}

function chargerSnapshot(f) {
  const d = LM.decompacter(lireJson(f));
  if (!d) throw new Error(`${path.basename(f)} : pas un instantané ${LM.FORMAT}`);
  return d;
}

function main(argv) {
  const pos = [], o = { detail: false, seuil: 1, journal: null, json: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--journal') o.journal = argv[++i]; else if (a === '--json') o.json = argv[++i]; else if (a === '--detail') o.detail = true;
    else if (a === '--seuil') o.seuil = Number(argv[++i]); else if (a.startsWith('--')) throw new Error('option inconnue : ' + a); else pos.push(a);
  }
  if (!Number.isFinite(o.seuil) || o.seuil < 0) throw new Error('--seuil : millimètres ≥ 0');
  if (pos.length < 1 || pos.length > 2 || (pos.length === 1 && !o.journal)) {
    console.error('Usage : diff-liste.cjs AVANT.json APRES.json [--journal J.json]  |  diff-liste.cjs --journal J.json APRES.json  [--json sortie.json] [--detail] [--seuil mm]');
    process.exit(2);
  }
  const apres = chargerSnapshot(pos[pos.length - 1]);
  let ref, forme, notes = [];
  const jr = o.journal ? ecrituresJournal(lireJson(o.journal), apres.cle) : null;
  if (pos.length === 2) {
    ref = chargerSnapshot(pos[0]); forme = 'deux-instantanes';
    if (ref.partie !== apres.partie) throw new Error(`parties différentes (${ref.partie} et ${apres.partie}) : comparaison refusée`);
    if (ref.cle && apres.cle && ref.cle !== apres.cle) throw new Error('listes différentes (empreintes de clé distinctes) : comparaison refusée');
    if (jr) ref.ariane = new Set(jr.cuts.keys());
  } else {
    forme = 'journal-contre-instantane';
    const ed = new Array(6 * apres.n).fill(null), st = new Array(apres.n).fill(0), fl = new Array(apres.n).fill(0);
    for (const [cut, w] of jr.cuts) if (cut < apres.n) for (let j = 0; j < 6; j++) ed[6 * cut + j] = w.bords[j];
    ref = { n: apres.n, st, fl, ed, ariane: new Set([...jr.cuts.keys()].filter(c => c < apres.n)), sansStatut: true, reperes: apres };
    notes.push('référence = dernières écritures d’Ariane ; statuts et drapeaux non comparés ; repère profil tiré des voisins de l’instantané relu');
  }
  if (jr) {
    if (!jr.cuts.size) notes.push('aucune écriture de validation exploitable dans le journal');
    if (!jr.correspond) notes.push(`table du journal choisie par nombre d’écritures (${jr.tables} table(s) vues)`);
  }
  const r = comparer(ref, apres, { seuil: o.seuil });
  const c = r.classes, pct = (a, b) => (b ? ` (${Math.round(1000 * a / b) / 10} %)` : '');
  const out = [`Forme : ${forme} · partie ${apres.partie ?? '?'} · lignes avant ${r.lignes.avant}, après ${r.lignes.apres}, comparées ${r.lignes.comparees} · seuil ${o.seuil} mm`];
  if (c.sansRepere3d) out.push(`Repère : ${c.sansRepere3d} cut(s) sans direction de voisins exploitable → distance 3D seule (latéral non calculé).`);
  else out.push('Repère : profil local (latéral/vertical) pour tous les cuts comparés.');
  out.push(`Cuts posés par Ariane comparables : ${c.arianeComparables} · inchangés (≤ ${o.seuil} mm) ${c.arianeInchanges}${pct(c.arianeInchanges, c.arianeComparables)} · corrigés > ${o.seuil} mm ${c.arianeSup1}${pct(c.arianeSup1, c.arianeComparables)} · > 5 mm ${c.arianeSup5} · > 10 mm ${c.arianeSup10}`);
  if (!ref.sansStatut) out.push(`Verts d’extraction (valides à l’avant, hors cuts d’Ariane) modifiés > ${o.seuil} mm : ${c.vertsExtractionModifies} sur ${c.vertsExtractionComparables} · invalides devenus valides : ${c.invalidesDevenusValides} · statuts changés ${c.statutsChanges} · drapeaux changés ${c.drapeauxChanges}`);
  if (c.absentsApres) out.push(`Cuts dont un bord manque d’un côté : ${c.absentsApres}`);
  for (const n of notes) out.push('Note : ' + n);
  if (o.detail) {
    out.push('', 'cut\tclasse\tmode\tmax_mm\tG lat\tG vert\tD lat\tD vert\tstatut\tdrapeaux');
    for (const k of r.cuts) out.push([k.cut, k.classe, k.mode ?? '-', k.maxMm ?? '-', k.gauche?.lat ?? '-', k.gauche?.vert ?? '-', k.droite?.lat ?? '-', k.droite?.vert ?? '-', k.statut ? k.statut.join('>') : '-', k.drapeaux ? k.drapeaux.join('>') : '-'].join('\t'));
  }
  console.log(out.join('\n'));
  if (o.json) fs.writeFileSync(o.json, JSON.stringify({ forme, partie: apres.partie, seuilMm: o.seuil, lignes: r.lignes, classes: c, notes, cuts: r.cuts }, null, 1));
  return { ...r, forme, notes };
}

module.exports = { comparer, ecrituresJournal, repere, main };
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { console.error('Erreur : ' + e.message); process.exit(1); } }
