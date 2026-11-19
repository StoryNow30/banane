#!/usr/bin/env node
'use strict';
/* Dérive un Écho « revu » : ne garde que les visites des cuts acceptés par la revue par critères.
 * L'export brut reste intact ; ce fichier dérivé est ce qui entre en apprentissage. */
const fs = require('node:fs'), path = require('node:path');
const [src, dst] = process.argv.slice(2);
fs.mkdirSync(dst, { recursive: true });
const fichiers = fs.readdirSync(src).filter(f => /^ariane-echo-.*\.json$/.test(f)).sort();
/* 1. verdict par cut, sur la visite la plus récente */
const parCut = new Map();
for (const f of fichiers) {
  const j = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
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
    const ecarts = ['left', 'right'].map(cote => {
      const a = pos(rail(r.startPose?.rails?.[cote])), b = pos(rail(st?.rails?.[cote]));
      return a && b ? Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 1000 : null;
    });
    const ecartMm = ecarts.every(x => x === null) ? null : Math.max(...ecarts.filter(x => x !== null));
    const label = r.observedLabelCandidate || '';
    let ok = true;
    if (!st) ok = false;
    if (r.status !== 'complete') ok = false;
    if (r.usableAsNativeReference !== true) ok = false;
    if ((r.operatorIntents || []).length !== 1) ok = false;
    if (ecartMm === null || ecartMm < 1) ok = false;
    parCut.set(cle, { exporte: j.exportedAt, ok, label });
  }
}
const acceptes = new Set([...parCut].filter(([, v]) => v.ok && /^VALIDATE_CORRECTED/.test(v.label)).map(([k]) => k));
const aussi = new Set([...parCut].filter(([, v]) => v.ok && /^(VALIDATE_NO_MOVEMENT|PASS_NO_DECISION)$/.test(v.label)).map(([k]) => k));
console.log('cuts acceptés :', acceptes.size, 'corrections |', aussi.size, 'sans correction (validés tels quels ou visite sans décision)');
/* 2. réécrit chaque fichier en ne gardant que ces cuts */
let gardes = 0, ecartes = 0;
for (const f of fichiers) {
  const j = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
  const ids = j.dictionaries.identities;
  const records = (j.records || []).filter(r => {
    const id = r.identity?.__ref ? ids[Number(r.identity.__ref.split(':')[1])] : null;
    const cle = id ? id.part + ':' + id.cut : '';
    const garde = acceptes.has(cle) || aussi.has(cle);
    garde ? gardes++ : ecartes++;
    return garde;
  });
  j.revue = { par: 'revue par critères (revue-references.cjs)', criteres: 'référence présente, statut complete, paire comparable, une seule intention, déplacement ≥ 1 mm', cutsGARDES: acceptes.size + aussi.size, note: 'export brut intact ; ce fichier est un dérivé' };
  j.records = records;
  fs.writeFileSync(path.join(dst, f.replace(/\.json$/, '-revue.json')), JSON.stringify(j));
}
console.log('visites gardées :', gardes, '| écartées :', ecartes);
fs.writeFileSync(path.join(dst, 'ACCEPTES.txt'), [...acceptes].sort().join('\n') + '\n');
