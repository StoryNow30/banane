'use strict';
/* CH-120 : fichier des vérités pour la mesure du pool (BANC_POOL_VERITE), tiré du corpus de CH-116 et des méta du banc (hors dépôt).
 *   node chantiers/CH-120/outils/verites.cjs > $CH116_TRAVAIL/verites-ch120.json */
const fs = require('node:fs'), path = require('node:path');
const T = process.env.CH116_TRAVAIL || path.join(process.env.HOME, 'ch116');
const corpus = fs.readFileSync(process.env.CH116_CORPUS || path.join(T, 'corpus.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const out = {};
for (const c of corpus) {
  if (!c.poseFinale || c.classe === 'non-juge') continue;
  const fm = path.join(T, 'meta', `${c.lot}-p${c.partie}-r${c.rang}.json`); if (!fs.existsSync(fm)) { process.stderr.write('méta absente : ' + fm + '\n'); continue; }
  const m = JSON.parse(fs.readFileSync(fm, 'utf8'));
  out[`${m.lotId.slice(0, 8)}:${c.partie}:${c.cut}`] = { left: c.poseFinale.left, right: c.poseFinale.right, classe: c.classe, sort: c.sortLot, exclu: c.exclu || null, lot: c.lot, rang: c.rang };
}
process.stdout.write(JSON.stringify(out));
