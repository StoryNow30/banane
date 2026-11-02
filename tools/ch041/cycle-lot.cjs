#!/usr/bin/env node
'use strict';
/* CH-041 — le CYCLE RÉEL d'un cut posé, lu dans les jalons `phase-timing-pli` d'un journal (machine de l'opérateur). Lecture seule.
 *   node tools/ch041/cycle-lot.cjs <journal.json> [--partie N]
 * Par visite posée (jalon `accepted` présent) : capture (open → capture-received), analyse (capture-stored → proposed), décision (proposed → decision),
 * pose (decision → accepted), cycle (open → accepted), navigation (accepted → open de la visite suivante) ; spans du service worker : science
 * publique, v46 par appel, observe-lot, command-lot. Séparé selon la commande du lot (`lot` : la chaîne ou la GCV2 ont posé ; `engine` : le moteur).
 * Sortie : médianes et P90 en ms, effectifs. Aucune coordonnée, aucun numéro de cut. */
const fs = require('node:fs');
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const r0 = v => v === null ? '—' : String(Math.round(v));
function analyser(journal, partie) {
  const ev = journal.events || [];
  const cmd = new Map();
  for (const e of ev) if (e.type === 'gcv1-shadow-observed' && e.identity && e.lotObservation && (partie === undefined || e.identity.part === partie)) cmd.set(e.batchId + ':' + e.identity.cut, e.lotObservation.command?.action ?? 'engine');
  const pli = ev.filter(e => e.type === 'phase-timing-pli' && e.r && e.r.j && e.ctx?.identity && (partie === undefined || e.ctx.identity.part === partie));
  pli.sort((a, b) => (a.r.j.open ?? 0) + 0 - 0 || 0);
  /* Ordre par instant d'ouverture absolu : rows[0][2] est le ms absolu de « open » (horloge du service worker). */
  const abs = e => Array.isArray(e.rows) && e.rows[0] ? e.rows[0][2] : null;
  pli.sort((a, b) => (abs(a) ?? 0) - (abs(b) ?? 0));
  const lignes = [];
  for (let i = 0; i < pli.length; i++) {
    const e = pli[i], j = e.r.j, s = e.r.s || {}, c = cmd.get(e.batchId + ':' + e.ctx.identity.cut) ?? null;
    if (!Number.isFinite(j.accepted)) continue;
    const nxt = pli[i + 1], nav = nxt && abs(nxt) !== null && abs(e) !== null ? abs(nxt) - abs(e) - j.accepted : null;
    const sp = k => s[k] ? s[k][1] : null, spn = k => s[k] ? s[k][0] : 0;
    lignes.push({ cmd: c, capture: j['capture-received'], analyse: Number.isFinite(j.proposed) && Number.isFinite(j['capture-stored']) ? j.proposed - j['capture-stored'] : null,
      decision: Number.isFinite(j.decision) && Number.isFinite(j.proposed) ? j.decision - j.proposed : null, pose: j.accepted - (j.decision ?? j.proposed), cycle: j.accepted, navigation: nav,
      fenetre: Number.isFinite(j.decision) && Number.isFinite(j['capture-received']) ? j.decision - j['capture-received'] : null,
      science: sp('science-public-total'), v46: spn('v46-scientific') ? sp('v46-scientific') / spn('v46-scientific') : null, nV46: spn('v46-scientific'), observe: sp('observe-lot'), command: sp('command-lot') });
  }
  return lignes;
}
function tableau(lignes, titre) {
  const K = ['capture', 'analyse', 'decision', 'pose', 'cycle', 'navigation', 'fenetre', 'science', 'v46', 'observe', 'command'];
  let out = `${titre} : ${lignes.length} cuts posés\n| mesure | ${K.join(' | ')} |\n|---|${K.map(() => '---').join('|')}|\n`;
  out += `| médiane (ms) | ${K.map(k => r0(med(lignes.map(l => l[k])))).join(' | ')} |\n| P90 (ms) | ${K.map(k => r0(q(lignes.map(l => l[k]), 0.9))).join(' | ')} |\n`;
  return out;
}
function main(argv) {
  const f = argv[0]; if (!f) throw Error('usage : cycle-lot.cjs <journal.json> [--partie N]');
  const ip = argv.indexOf('--partie'), partie = ip >= 0 ? Number(argv[ip + 1]) : undefined;
  const journal = JSON.parse(fs.readFileSync(f, 'utf8')), L = analyser(journal, partie);
  let out = `journal ${journal.version || '?'}${partie !== undefined ? ', partie ' + partie : ''}\n` + tableau(L, 'tous');
  for (const c of ['lot', 'engine']) { const l = L.filter(x => x.cmd === c); if (l.length) out += tableau(l, 'commande ' + c); }
  process.stdout.write(out);
  return L;
}
module.exports = { analyser, tableau, med, q };
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { console.error('cycle-lot : ' + e.message); process.exitCode = 1; } }
