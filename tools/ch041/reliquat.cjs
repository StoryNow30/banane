#!/usr/bin/env node
'use strict';
/* CH-041 — ESTIMATION du temps que l'exécuteur parallèle laisserait au cycle (le « reliquat »), cut par cut, à partir (1) de la fenêtre réelle capture reçue → décision
 * du journal (machine de l'opérateur, `phase-timing-pli`) et (2) du temps de calcul de la décision candidate mesuré hors ligne (`decisions.cjs`, cette machine).
 *   node tools/ch041/reliquat.cjs --journal J.json --partie N --candidat C.jsonl [--rapport 1.98] [--facteur 1.2] [--surcout 60]
 * Par cut posé consulté : porte fermée → ajouté = ms du module (quelques ms) ; porte ouverte → calcul parallèle = ms / rapport (gain mesuré des fils, tools/ch041/chrono-executeur.cjs)
 * × facteur (machine de l'opérateur / celle-ci) + surcoût (envoi de la capture, ms), reliquat = max(0, calcul − fenêtre), ajouté = reliquat + ms de la porte. Témoins :
 * « CH-034 » (tout le calcul en série, sans porte : ms de la référence × facteur) et « porte seule » (sans exécuteur). Rend médiane, moyenne, P90 de l'ajouté par cut,
 * part des cuts où il reste un reliquat. C'est une ESTIMATION (SUPPOSÉ : rapport et surcoût constants, fenêtre indépendante du levier) ; la mesure vraie est sur le terrain
 * (événement `recherche-large`, champ `executeur.attenteMs`, lu par tools/ch041/cycle-lot.cjs). Aucun numéro de cut en sortie. */
const fs = require('node:fs');
const { analyser, med, q } = require('./cycle-lot.cjs');
function args(argv) { const o = { rapport: 1.98, facteur: 1.2, surcout: 60 }; for (let i = 0; i < argv.length; i++) { const k = argv[i], v = () => argv[++i]; if (k === '--journal') o.journal = v(); else if (k === '--partie') o.partie = Number(v()); else if (k === '--candidat') o.candidat = v(); else if (k === '--reference') o.reference = v(); else if (k === '--rapport') o.rapport = Number(v()); else if (k === '--facteur') o.facteur = Number(v()); else if (k === '--surcout') o.surcout = Number(v()); else throw Error('argument inconnu ' + k); } if (!o.journal || !Number.isInteger(o.partie) || !o.candidat) throw Error('usage : --journal J --partie N --candidat C.jsonl [--reference R.jsonl]'); return o; }
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(l => !l.entete);
const r0 = v => v === null || !Number.isFinite(v) ? '—' : String(Math.round(v));
const moy = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
function main(argv) {
  const a = args(argv), journal = JSON.parse(fs.readFileSync(a.journal, 'utf8'));
  /* La fenêtre par cut : les lignes de cycle-lot portent le cut via la pli ; on refait l'association ici. */
  const ev = journal.events || [], fen = new Map();
  for (const e of ev) if (e.type === 'phase-timing-pli' && e.r && e.r.j && e.ctx?.identity?.part === a.partie && Number.isFinite(e.r.j.decision) && Number.isFinite(e.r.j['capture-received'])) fen.set(e.ctx.identity.cut, e.r.j.decision - e.r.j['capture-received']);
  const C = lire(a.candidat), R = a.reference ? new Map(lire(a.reference).map(l => [l.cut, l])) : null;
  const lignes = [];
  for (const c of C) { const f = fen.get(c.cut); if (!Number.isFinite(f) || !Number.isFinite(c.ms)) continue;
    const ferme = c.porte && c.porte.ouverte === false, porteMs = ferme ? c.ms : 5;
    const calcul = ferme ? 0 : c.ms * a.facteur / a.rapport + a.surcout, reliquat = Math.max(0, calcul - f);
    const r = R ? R.get(c.cut) : null;
    lignes.push({ fenetre: f, ferme, ajoute: reliquat + porteMs, porteSeule: c.ms * a.facteur, ch034: r ? r.ms * a.facteur : null, reste: reliquat > 0 }); }
  const K = [['CH-034 (série, sans porte)', 'ch034'], ['porte + graines exactes, en série', 'porteSeule'], ['porte + exécuteur parallèle (estimé)', 'ajoute']];
  let out = `partie ${a.partie} : ${lignes.length} cuts posés avec fenêtre et décision ; fenêtre médiane ${r0(med(lignes.map(l => l.fenetre)))} ms ; porte fermée ${lignes.filter(l => l.ferme).length} ; rapport ${a.rapport}, facteur ${a.facteur}, surcoût ${a.surcout} ms\n| temps ajouté par cut posé | médiane (ms) | moyenne (ms) | P90 (ms) | cuts avec reliquat |\n|---|---|---|---|---|\n`;
  for (const [nom, k] of K) { const v = lignes.map(l => l[k]).filter(Number.isFinite); if (!v.length) continue; out += `| ${nom} | ${r0(med(v))} | ${r0(moy(v))} | ${r0(q(v, .9))} | ${k === 'ajoute' ? lignes.filter(l => l.reste).length + '/' + lignes.length : '—'} |\n`; }
  process.stdout.write(out);
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { console.error('reliquat : ' + e.message); process.exitCode = 1; } }
