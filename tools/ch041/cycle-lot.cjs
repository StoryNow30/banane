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
/* Le levier lui-même, quand il a tourné (événements `recherche-large` du journal, CH-034 et CH-041) : par cut consulté, `ms` du module (porte + relances sur place),
 * `executeur.attenteMs` (ce qui s'est vraiment ajouté au cycle quand les relances étaient précalculées), part des portes fermées, des précalculs, des pannes.
 * C'est la mesure du critère (d) sur la machine de l'opérateur : médiane et moyenne du temps ajouté par cut consulté. */
function levier(journal, partie) {
  const ev = (journal.events || []).filter(e => e.type === 'recherche-large' && e.identity && (partie === undefined || e.identity.part === partie) && e.etat !== 'erreur' && !e.passe);
  if (!ev.length) return null;
  const ajoute = e => e.executeur && e.executeur.precalcule ? (e.executeur.attenteMs || 0) + (e.ms || 0) : (e.ms || 0);
  const a = ev.map(ajoute), moy = x => x.length ? x.reduce((u, v) => u + v, 0) / x.length : null;
  const K = ['consultés', 'porte fermée', 'précalculés', 'pannes exécuteur', 'différés', 'ajouté médiane ms', 'ajouté moyenne ms', 'ajouté P90 ms', 'module ms médiane', 'attente ms médiane', 'cache ms médiane'];
  const V = [ev.length, ev.filter(e => e.porte && e.porte.ouverte === false).length, ev.filter(e => e.executeur && e.executeur.precalcule).length, ev.filter(e => e.executeur && e.executeur.erreur).length, ev.filter(e => e.issue === 'differe').length,
    r0(med(a)), r0(moy(a)), r0(q(a, .9)), r0(med(ev.map(e => e.ms))), r0(med(ev.filter(e => e.executeur && e.executeur.precalcule).map(e => e.executeur.attenteMs))), r0(med(ev.filter(e => e.executeur).map(e => e.executeur.cacheMs)))];
  return `recherche large (événements du journal)\n| ${K.join(' | ')} |\n|${K.map(() => '---').join('|')}|\n| ${V.join(' | ')} |\n`;
}
function main(argv) {
  const f = argv[0]; if (!f) throw Error('usage : cycle-lot.cjs <journal.json> [--partie N]');
  const ip = argv.indexOf('--partie'), partie = ip >= 0 ? Number(argv[ip + 1]) : undefined;
  const journal = JSON.parse(fs.readFileSync(f, 'utf8')), L = analyser(journal, partie);
  let out = `journal ${journal.version || '?'}${partie !== undefined ? ', partie ' + partie : ''}\n` + tableau(L, 'tous');
  for (const c of ['lot', 'engine']) { const l = L.filter(x => x.cmd === c); if (l.length) out += tableau(l, 'commande ' + c); }
  const lv = levier(journal, partie); if (lv) out += lv;
  process.stdout.write(out);
  return L;
}
module.exports = { analyser, tableau, levier, med, q };
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { console.error('cycle-lot : ' + e.message); process.exitCode = 1; } }
