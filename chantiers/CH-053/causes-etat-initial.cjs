#!/usr/bin/env node
'use strict';
/*
 * causes-etat-initial.cjs — CH-053-C : ventile les cuts validés dont l'état initial n'est pas qualifié (définition stricte)
 * par CAUSE, et compte ce que chaque piste récupère. Hors ligne, lecture seule, aucune donnée versée.
 *
 *   node chantiers/CH-053/causes-etat-initial.cjs --echo <dossier|fichiers|volumes zip …> [--partie N] [--json sortie.json]
 *
 * Cause d'un cut non qualifié = fin de la PREMIÈRE capture de la visite retenue (CLIP_CHANGED, RAIL_STATE_CHANGED sur geste,
 * TARGET_CHANGED, RESOURCE_LIMIT, NO_RAIL_OBSERVED, autre), ou « aucune-capture ». Pour chaque cut non qualifié on dit aussi :
 *   - captureTardive        : une capture plus tardive de la même visite porte un instantané à couverture qualifiée ;
 *   - memeDecoupeQueLaPremiere : cette capture tardive a la même découpe que la première (signature `clipping` des nuages) ;
 *   - recuperable (voies)   : la définition assouplie (src/native-reconstruction.js) le qualifie, et par quelle voie.
 * Les chiffres rendus sont des comptes sur l'export donné ; l'outil n'invente rien.
 */
const fs = require('node:fs');
const V = require('../../tools/lire-volumes.cjs');
const { mergeFiles } = require('../../tools/merge-segments.cjs');
const { entreesEcho } = require('../../tools/taux-apprenables.cjs');
const { reconstruireCut } = require('../../src/native-reconstruction.js');

const COTES = ['left', 'right'];
const intentionsDe = r => (r.operatorIntents || []).map(i => i && i.intent).filter(Boolean);
const rang = r => `${r.startedAt || ''}|${String(r.visitIndex ?? 0).padStart(8, '0')}`;
const sig = c => JSON.stringify((c && c.clouds || []).map(x => x && x.clipping || null));

function causes(entrees, { partie = null } = {}) {
  const { merged, missing } = mergeFiles(entrees);
  const nuages = new Map();
  for (const c of merged.clouds || []) for (const id of [c.captureId, c.chunkId]) if (id) nuages.set(id, c);
  const parCut = new Map();
  for (const r of merged.records || []) {
    const id = r.identity || {};
    if (!Number.isInteger(id.cut) || (partie !== null && id.part !== partie)) continue;
    const k = `${id.part ?? '?'}|${id.cut}`;
    (parCut.get(k) || parCut.set(k, []).get(k)).push(r);
  }
  const lignes = [];
  for (const [, visites] of parCut) {
    visites.sort((a, b) => rang(a).localeCompare(rang(b)));
    if (!visites.some(r => intentionsDe(r).includes('VALIDATE'))) continue;
    const v = visites.filter(r => intentionsDe(r).length).at(-1);
    const ge = v.geometryEligibility || {};
    const c1 = COTES.every(s => ge[s] && ge[s].captureId);
    const caps = Object.values(v.geometryCaptures || {}).sort((a, b) => String(a.startedAt || '').localeCompare(String(b.startedAt || '')));
    const premiere = caps[0] || null;
    const fin = !premiere ? 'aucune-capture' : (premiere.termination && premiere.termination.code) || 'sans-fin-anormale';
    const tardives = caps.slice(1);
    const aCouverture = cap => COTES.some(s => (v.railSnapshots && v.railSnapshots[s] || []).some(x => x.captureId === cap.captureId && x.coverage && x.coverage.status === 'qualified-candidate'));
    const tardive = tardives.filter(aCouverture);
    const memeDecoupe = tardive.some(cap => sig(nuages.get(cap.captureId)) === sig(nuages.get(premiere && premiere.captureId)));
    const rec = reconstruireCut(v, { nuages });
    lignes.push({ qualifieStrict: c1, premiereFin: fin, captures: caps.length, captureTardive: tardive.length > 0, memeDecoupeQueLaPremiere: tardive.length > 0 && memeDecoupe,
      recuperable: !c1 && rec.qualifie, voies: !c1 && rec.qualifie ? COTES.map(s => rec.rails[s].voie) : null,
      raisons: !c1 && !rec.qualifie ? [...new Set(COTES.flatMap(s => rec.rails[s].raisons))] : null });
  }
  const perdus = lignes.filter(l => !l.qualifieStrict);
  const compte = (xs, f) => xs.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
  return {
    exportPartiel: missing.length > 0, cutsValides: lignes.length, qualifiesStricts: lignes.length - perdus.length, nonQualifies: perdus.length,
    parCause: compte(perdus, l => l.premiereFin),
    avecCaptureTardiveQualifiee: perdus.filter(l => l.captureTardive).length,
    ...{ memeDecoupe: perdus.filter(l => l.memeDecoupeQueLaPremiere).length },
    recuperables: perdus.filter(l => l.recuperable).length, parVoie: compte(perdus.filter(l => l.recuperable), l => l.voies.join('+')),
    recuperablesParCause: compte(perdus.filter(l => l.recuperable), l => l.premiereFin),
    nonRecuperesParRaison: compte(perdus.filter(l => !l.recuperable).flatMap(l => l.raisons || ['inconnue']), x => x),
    tauxStrictPct: lignes.length ? Math.round((lignes.length - perdus.length) / lignes.length * 1000) / 10 : null,
    tauxAssoupliPct: lignes.length ? Math.round((lignes.length - perdus.length + perdus.filter(l => l.recuperable).length) / lignes.length * 1000) / 10 : null,
    note: 'Taux = état initial (critère 1) seul ; le taux d\'apprenables complet est celui de tools/taux-apprenables.cjs (--assouplie). Qualification : compté sur l\'export, PROBABLE si exportPartiel.',
  };
}

function main() {
  const argv = process.argv.slice(2), opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const iE = argv.indexOf('--echo'), chemins = [];
  if (iE >= 0) for (let i = iE + 1; i < argv.length && !argv[i].startsWith('--'); i++) chemins.push(argv[i]);
  if (!chemins.length) { console.error('Usage : --echo <dossier|fichiers|volumes zip …> [--partie N] [--json sortie.json]'); process.exit(1); }
  const entrees = entreesEcho(chemins);
  if (!entrees.length) { console.error('Aucun export Écho trouvé.'); process.exit(1); }
  const res = causes(entrees, { partie: opt('--partie') !== undefined ? Number(opt('--partie')) : null });
  console.log(JSON.stringify(res, null, 1));
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(res, null, 1));
}
if (require.main === module) main();
module.exports = { causes };
