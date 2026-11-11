#!/usr/bin/env node
'use strict';
/*
 * relecture-cuts-vides.cjs — CH-107 : LA RELECTURE CUT PAR CUT, CAPTURES VIDES COMPRISES. Lecture seule, sur un export de lot (zips, dossier ou
 * journaux ariane-journal-v4-*.json ; lecture et fusion des volumes par tools/bilan-lot.cjs).
 *
 *   node chantiers/CH-107/outils/relecture-cuts-vides.cjs <dossier ou zips d'un export> [...] [--min 3] [--json] [--cuts]
 *
 * Pour chaque partie relue (événements `relecture-ombre`, rangés dans le temps) :
 *  - par cut : capture vide ou non, points de la première capture (près des deux rails), durée du cut, action (`visite`, `corrige`,
 *    `correction-refusee`, `correction-incertaine`, `navigation-refusee`), ce que la règle aurait fait (`critere.corriger`) et pourquoi
 *    la correction a été écartée ; avec `--cuts`, le tableau de tous les cuts (sinon seulement ceux des séries et les cuts corrigés) ;
 *  - les SÉRIES de cuts vides consécutifs (au moins `--min`, 3 par défaut = le seuil de `lot.serieCapturesVides`), avec leur durée (du début
 *    du premier cut à la fin du dernier) et leur cadence ;
 *  - les comptes qui répondent à la question de l'opérateur : corrections écrites sur un cut à capture vide (doit être 0), corrections écrites
 *    sur un cut peu dense (points de la première capture, le plus petit), pauses et rechargements de la garde CH-107 s'ils existent.
 * Définitions : un cut est « vide » quand toutes ses captures sont vides (`skipOmbre.capturesVides === skipOmbre.captures`, au moins une) ;
 * « première vide » quand la première l'est (la seconde peut être pleine). Les points sont ceux de `skipOmbre.points` (première capture).
 * Durée d'un cut : `durees.totalMs` ; début d'un cut = son heure au journal moins `totalMs`.
 * Règle absolue (comme tools/bilan-lot.cjs) : la sortie ne porte que des comptes, des durées et des numéros de partie et de cut ; les champs sont
 * lus un par un, les textes libres sont filtrés (identifiants et adresses remplacés) et bornés.
 */
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const B = require('../../../tools/bilan-lot.cjs');

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, RE_ADRESSE = /https?:\/*[^\s"'<>)]*/gi;
const propre = (s, n = 90) => (typeof s === 'string' ? s.replace(RE_UUID, '[id]').replace(RE_ADRESSE, '[adresse]').slice(0, n) : null);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ent = v => (Number.isInteger(v) ? v : null);
const secondes = ms => (ms === null ? '?' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`);

/* Un cut relu, champs lus un par un. */
function ligneCut(e) {
  const s = e.skipOmbre && typeof e.skipOmbre === 'object' ? e.skipOmbre : null;
  const captures = s ? ent(s.captures) : null, capturesVides = s ? ent(s.capturesVides) : null;
  const p = s && s.points && typeof s.points === 'object' ? s.points : null;
  const points = p && num(p.left) !== null && num(p.right) !== null ? p.left + p.right : null;
  const totalMs = e.durees ? num(e.durees.totalMs) : null;
  const fin = num(e._ms) !== null && e._ms !== Infinity ? e._ms : null;
  return {
    partie: ent(e.identity && e.identity.part), cut: ent(e.identity && e.identity.cut),
    vide: captures !== null && captures > 0 && capturesVides === captures,
    premiereVide: points === 0 || (captures !== null && captures > 0 && capturesVides !== null && capturesVides > 0 && points === null),
    captures, capturesVides, points,
    totalMs, captureMs: e.durees ? num(e.durees.captureMs) : null,
    debutMs: fin !== null && totalMs !== null ? fin - totalMs : fin, finMs: fin,
    action: propre(e.action, 30), regleAurait: e.critere && typeof e.critere === 'object' ? e.critere.corriger === true : null,
    regle: e.critere ? propre(e.critere.regle, 30) : null, raisonAction: propre(e.raisonAction), role: propre(e.role, 20), zone: propre(e.zone, 20),
    erreurCapture: e.erreurCapture ? propre(e.erreurCapture, 60) : null,
  };
}

function analyser(evenements, { min = 3 } = {}) {
  const ev = evenements.filter(e => e && typeof e === 'object');
  const parties = new Map();
  const partieDe = n => { if (!parties.has(n)) parties.set(n, { partie: n, cuts: [], pauses: [], pointsVides: [] }); return parties.get(n); };
  /* Les pauses n'ont pas de partie : rattachées à la partie du dernier cut relu avant elles. */
  let derniere = null;
  for (const e of ev) {
    if (e.type === 'relecture-ombre') { const l = ligneCut(e); derniere = l.partie; partieDe(l.partie).cuts.push(l); }
    else if (e.type === 'relecture-pause') partieDe(derniere).pauses.push({ raison: propre(e.raison, 20), cut: ent(e.cut), faits: ent(e.faits), total: ent(e.total) });
    else if (e.type === 'relecture-points-vides') partieDe(ent(e.identity && e.identity.part)).pointsVides.push({ etape: propre(e.etape, 20), action: propre(e.action, 20), cut: ent(e.identity && e.identity.cut), vides: ent(e.vides) });
  }
  const sortie = [];
  for (const P of [...parties.values()].sort((a, b) => (a.partie ?? -1) - (b.partie ?? -1))) {
    const series = [];let cur = null;
    for (const c of P.cuts) {
      if (c.vide) { if (!cur) { cur = { cuts: [] }; series.push(cur); } cur.cuts.push(c); }
      else if (c.captures !== null) cur = null;   /* un cut sans capture (erreur) ne ferme ni n'allonge la série */
    }
    const longues = series.filter(s => s.cuts.length >= min).map(s => {
      const a = s.cuts[0], z = s.cuts[s.cuts.length - 1], dureeMs = a.debutMs !== null && z.finMs !== null ? z.finMs - a.debutMs : null;
      return { premier: a.cut, dernier: z.cut, cuts: s.cuts.length, dureeMs, msParCut: dureeMs !== null ? Math.round(dureeMs / s.cuts.length) : null,
        corriges: s.cuts.filter(c => c.action === 'corrige').length, listeCuts: s.cuts.map(c => c.cut) };
    });
    const corriges = P.cuts.filter(c => c.action === 'corrige');
    const pts = corriges.map(c => c.points).filter(v => v !== null);
    sortie.push({
      partie: P.partie, cutsRelus: P.cuts.length,
      cutsVides: P.cuts.filter(c => c.vide).length, premiereVide: P.cuts.filter(c => c.premiereVide).length,
      corriges: corriges.length, corrigesSurVide: corriges.filter(c => c.vide || c.premiereVide).length,
      pointsMinCorrige: pts.length ? Math.min(...pts) : null,
      refus: P.cuts.filter(c => c.action === 'correction-refusee' || c.action === 'correction-incertaine').length,
      regleAuraitSurVide: P.cuts.filter(c => (c.vide || c.premiereVide) && c.regleAurait).length,
      series: longues, pauses: P.pauses, pointsVides: P.pointsVides, cuts: P.cuts,
    });
  }
  return { min, parties: sortie };
}

function markdown(r, { tousLesCuts = false } = {}) {
  const L = ['# Relecture cut par cut : captures vides (CH-107)', '',
    `Série : au moins ${r.min} cuts vides de suite. « Vide » : toutes les captures du cut sans point ; « 1re vide » : la première l'est.`, ''];
  if (!r.parties.length) { L.push('Aucun cut relu dans ce journal.'); return L.join('\n') + '\n'; }
  L.push('| Partie | Cuts relus | Vides | 1re vide | Corrigés | Corrigés sur un cut vide | Points min. d’un cut corrigé | Refus | Séries |', '|---|---|---|---|---|---|---|---|---|');
  for (const p of r.parties) L.push(`| ${p.partie ?? '?'} | ${p.cutsRelus} | ${p.cutsVides} | ${p.premiereVide} | ${p.corriges} | ${p.corrigesSurVide} | ${p.pointsMinCorrige ?? '–'} | ${p.refus} | ${p.series.length} |`);
  for (const p of r.parties) {
    L.push('', `## Partie ${p.partie ?? '?'}`);
    if (p.series.length) {
      L.push('', '| Série | Cuts | Durée | Par cut | Corrigés |', '|---|---|---|---|---|');
      for (const s of p.series) L.push(`| ${s.premier} → ${s.dernier} | ${s.cuts} | ${secondes(s.dureeMs)} | ${secondes(s.msParCut)} | ${s.corriges} |`);
    } else L.push('', 'Aucune série.');
    if (p.pauses.length) L.push('', 'Pauses : ' + p.pauses.map(x => `${x.raison} au cut ${x.cut}`).join(' ; ') + '.');
    if (p.pointsVides.length) L.push('', 'Garde des points (CH-107) : ' + p.pointsVides.map(x => `${x.etape}${x.action ? ` (${x.action})` : ''} au cut ${x.cut}`).join(' ; ') + '.');
    const dansSerie = new Set(p.series.flatMap(s => s.listeCuts));
    const montres = tousLesCuts ? p.cuts : p.cuts.filter(c => c.action === 'corrige' || dansSerie.has(c.cut) || (c.premiereVide && !c.vide));
    if (montres.length) {
      L.push('', '| Cut | Vide | Points | Captures (vides) | Durée | Action | Règle | Raison |', '|---|---|---|---|---|---|---|---|');
      for (const c of montres) L.push(`| ${c.cut} | ${c.vide ? 'oui' : c.premiereVide ? '1re' : 'non'} | ${c.points ?? '?'} | ${c.captures ?? '?'} (${c.capturesVides ?? '?'}) | ${secondes(c.totalMs)} | ${c.action ?? '?'} | ${c.regleAurait === null ? '?' : c.regleAurait ? 'aurait corrigé' : (c.regle ?? 'non')} | ${(c.raisonAction || c.erreurCapture || '').replace(/\|/g, '/')} |`);
    }
  }
  return L.join('\n') + '\n';
}

function main(argv) {
  const json = argv.includes('--json'), tous = argv.includes('--cuts'); let min = 3; const chemins = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--min') { min = Number(argv[++i]); if (!Number.isInteger(min) || min < 1) throw new Error('--min : entier ≥ 1'); }
    else if (!argv[i].startsWith('--')) chemins.push(argv[i]);
  }
  if (!chemins.length) throw new Error('usage : relecture-cuts-vides.cjs <dossier ou zips d’un export> [...] [--min 3] [--json] [--cuts]');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ch107-'));
  try {
    const r = analyser(B.lireEvenements(B.collecter(chemins, tmp)), { min });
    process.stdout.write(json ? JSON.stringify(r, null, 1) + '\n' : markdown(r, { tousLesCuts: tous }));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { console.error(`relecture-cuts-vides : ${e.message}`); process.exit(2); } }
module.exports = { analyser, markdown, ligneCut };
