#!/usr/bin/env node
'use strict';
/* CH-041 — la CLASSE de chaque cut posé d'une partie, jugé contre l'Écho (les briques de tools/juger-lot.cjs, CH-011/CH-030) : par cut, l'état
 * (sans-echo, non-juge, corrige, controle), l'écart (pire rail, 3D, mm), le latéral et le vertical, le geste (acceptation, fine, moyenne, faute).
 *   node tools/ch041/juges.cjs <dossier-export-lot> --echo <dossier-echo> --partie N --sortie J.jsonl
 * Sortie JSON lignes HORS DÉPÔT (numéros de cut, millimètres). Lecture seule. */
const fs = require('node:fs'), path = require('node:path');
const JL = require('../juger-lot.cjs');
function main(argv) {
  const a = { echo: [] }; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (k === '--echo') a.echo.push(argv[++i]); else if (k === '--partie') a.partie = Number(argv[++i]); else if (k === '--sortie') a.sortie = argv[++i]; else if (!a.dossier) a.dossier = k; else throw Error('argument inconnu ' + k); }
  if (!a.dossier || !a.echo.length || !Number.isInteger(a.partie) || !a.sortie) throw Error('usage : juges.cjs <dossier> --echo <dossier> --partie N --sortie J.jsonl');
  const journal = JL.lireJournalDir(a.dossier), echo = JL.lireEcho(JL.dossiersEcho(a.echo));
  const lot = JL.lotsDe(journal, a.partie); if (!lot) throw Error('aucun lot de la partie ' + a.partie);
  const { poses } = JL.ciblesPosesDe(lot, a.partie), lignes = JL.indexLignes(journal, echo, a.partie);
  fs.mkdirSync(path.dirname(path.resolve(a.sortie)), { recursive: true });
  const out = [], comptes = {};
  for (const cut of [...poses].sort((x, y) => x - y)) {
    const et = JL.etatPose(lignes.get(cut)), geste = et.etat === 'corrige' || et.etat === 'controle' ? JL.geste(et.mm, et.etat === 'controle') : null;
    out.push({ cut, etat: et.etat, mm: et.mm ?? null, lat: et.lat ?? null, vert: et.vert ?? null, geste });
    const k = geste || et.etat; comptes[k] = (comptes[k] || 0) + 1;
  }
  fs.writeFileSync(a.sortie, out.map(l => JSON.stringify(l)).join('\n') + '\n');
  process.stdout.write(`partie ${a.partie} : ${out.length} posés ; ${JSON.stringify(comptes)} → ${a.sortie}\n`);
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { console.error('juges : ' + e.message); process.exitCode = 1; } }
