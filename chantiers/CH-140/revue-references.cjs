#!/usr/bin/env node
'use strict';
/* Revue explicite des références d'un Écho, par critères objectifs, sans jamais imprimer de donnée de terrain.
 * usage : node revue-references.cjs <dossier-echo> [--csv sortie.csv]
 * Verdict par critère (aucune décision humaine déguisée : les critères sont écrits ici, et le verdict dit lequel échoue). */
const fs = require('node:fs'), path = require('node:path');
const dossier = process.argv[2];
const csvOut = process.argv.includes('--csv') ? process.argv[process.argv.indexOf('--csv') + 1] : null;
const fichiers = fs.readdirSync(dossier).filter(f => /^ariane-echo-.*\.json$/.test(f)).sort();
const parCut = new Map();
for (const f of fichiers) {
  const j = JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf8'));
  const ids = j.dictionaries.identities, rails = j.dictionaries.rails;
  const rail = ref => { const m = /^rails:(\d+)$/.exec(ref?.__ref || ''); return m ? rails[Number(m[1])] : null; };
  const pos = r => r && Array.isArray(r.positionSceneRelative) ? r.positionSceneRelative : null;
  for (const r of j.records || []) {
    const id = r.identity?.__ref ? ids[Number(r.identity.__ref.split(':')[1])] : null;
    if (!id) continue;
    const cle = id.part + ':' + id.cut;
    const avant = parCut.get(cle);
    if (avant && String(avant.exporte) >= String(j.exportedAt)) continue;
    const st = r.humanFinalReferences?.[0]?.state || null;
    const paires = ['left', 'right'].map(cote => {
      const a = pos(rail(r.startPose?.rails?.[cote])), b = pos(rail(st?.rails?.[cote]));
      return a && b ? Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 1000) : null;
    });
    const pair = r.geometryEligibility?.pair || {};
    const raisons = (pair.reasons || []).map(x => x.replace(/^(left|right):/, ''));
    parCut.set(cle, {
      exporte: j.exportedAt, partie: id.part, cut: id.cut, label: r.observedLabelCandidate || null,
      statut: r.status, intents: (r.operatorIntents || []).length, decision: r.humanFinalReference?.decisionKey || null,
      reference: !!st, comparable: r.usableAsNativeReference === true, pairStatut: pair.status || null,
      raisons, lidar: r.lidarStatus || null, ecartMm: paires.every(x => x === null) ? null : Math.max(...paires.filter(x => x !== null)),
      gauche: paires[0], droite: paires[1],
    });
  }
}
const tous = [...parCut.values()];
const corriges = tous.filter(x => /^VALIDATE_CORRECTED/.test(x.label || ''));
const juge = x => {
  const echecs = [];
  if (!x.reference) echecs.push('sans référence');
  if (x.statut !== 'complete') echecs.push('statut ' + x.statut);
  if (!x.comparable) echecs.push('paire non comparable');
  if (x.intents !== 1) echecs.push(x.intents + ' intentions');
  if (x.ecartMm === null) echecs.push('déplacement incalculable');
  else if (x.ecartMm < 1) echecs.push('déplacement < 1 mm');
  return echecs;
};
const bilan = {};
for (const x of corriges) {
  const e = juge(x);
  const k = e.length ? e.join(' ; ') : 'acceptée par les critères';
  bilan[k] = (bilan[k] || 0) + 1;
}
console.log('Échos lus :', fichiers.length, '| cuts :', tous.length, '| corrections :', corriges.length);
console.log('\nRevue des corrections, par critère qui échoue :');
for (const [k, n] of Object.entries(bilan).sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(5), k);
const raisons = {};
for (const x of corriges) for (const r of x.raisons) raisons[r] = (raisons[r] || 0) + 1;
console.log('\nMotifs de paire non comparable (corrections) :');
for (const [k, n] of Object.entries(raisons).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(String(n).padStart(5), k);
const ecarts = corriges.map(x => x.ecartMm).filter(x => Number.isFinite(x)).sort((a, b) => a - b);
if (ecarts.length) {
  const q = p => ecarts[Math.min(ecarts.length - 1, Math.floor(p * ecarts.length))];
  console.log('\nDéplacement de la correction (mm, repère scène) : médiane', q(0.5), '| quartiles', q(0.25), '–', q(0.75), '| min', ecarts[0], '| max', ecarts.at(-1));
}
const lidar = {};
for (const x of tous) lidar[x.lidar] = (lidar[x.lidar] || 0) + 1;
console.log('État LiDAR des cuts :', Object.entries(lidar).map(([k, n]) => (k || '—') + ':' + n).join(' '));
if (csvOut) {
  const entetes = ['partie', 'cut', 'label', 'statut', 'intents', 'decision', 'comparable', 'pairStatut', 'ecartMm', 'gauche', 'droite', 'lidar', 'echecs'];
  const lignes = corriges.map(x => [x.partie, x.cut, x.label, x.statut, x.intents, x.decision, x.comparable, x.pairStatut, x.ecartMm, x.gauche, x.droite, x.lidar, juge(x).join(' ; ')].join(','));
  fs.writeFileSync(csvOut, [entetes.join(','), ...lignes].join('\n') + '\n');
  console.log('\nCSV écrit :', csvOut, '(' + lignes.length + ' corrections)');
}
