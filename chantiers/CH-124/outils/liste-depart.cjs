#!/usr/bin/env node
'use strict';
/* CH-124 : écrit (HORS DÉPÔT) la liste d'ESV du DÉPART d'un lot, reconstituée, au format de l'instantané (src/liste-memoire.js).
 * L'export ne garde que le dernier instantané de la partie, souvent pris après le lot ; le service worker, lui, lit l'instantané pris au chargement de la
 * partie, avant le premier cut. Pour une parité banc / service worker avec le levier d'ancre, les deux doivent lire cette liste de départ.
 *   node chantiers/CH-124/outils/liste-depart.cjs --code COPIE --partie P:N --journal J.json --corpus C.json [--corpus …] --lot ID --liste LISTE.json --sortie DEPART.json
 * `--code` : copie du dépôt où `ancre.patch` est appliqué (elle porte `listeDeDepart` dans tools/banc-differes.cjs).
 * Sortie standard : comptes seulement (lignes remises, taille de la grappe de calage). */
const fs = require('node:fs'), path = require('node:path');
function args(a) { const o = { corpus: [] }; for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i];
  if (k === '--code') o.code = path.resolve(v()); else if (k === '--partie') o.partie = v(); else if (k === '--journal') o.journal = v(); else if (k === '--corpus') o.corpus.push(v());
  else if (k === '--lot') o.lot = v(); else if (k === '--liste') o.liste = v(); else if (k === '--sortie') o.sortie = v(); else throw Error('option inconnue ' + k); }
  for (const k of ['code', 'partie', 'journal', 'lot', 'liste', 'sortie']) if (!o[k]) throw Error('--' + k + ' manquant'); return o; }
function main() {
  const o = args(process.argv.slice(2)), Banc = require(path.join(o.code, 'tools', 'banc-differes.cjs')), LM = require(path.join(o.code, 'src', 'liste-memoire.js'));
  const partie = Number(o.partie.split(':')[1]), journal = JSON.parse(fs.readFileSync(o.journal, 'utf8')), R = Banc.lotReel(journal, partie, o.lot);
  const cuts = R.lot.cuts.slice().sort((a, b) => a.t - b.t), captures = Banc.chargerCaptures(o.corpus, cuts.map(c => c.captureId).filter(Boolean));
  const snap = JSON.parse(fs.readFileSync(o.liste, 'utf8')), table = LM.decompacter(snap);
  const cl = cuts.map(c => { const cap = c.captureId ? captures.get(c.captureId) : null, pr = R.poseReelle.get(c.cut) || null;
    return cap ? { cut: c.cut, depart: { left: cap.rails.left.positionSceneRelative.slice(0, 3), right: cap.rails.right.positionSceneRelative.slice(0, 3) }, pose: pr ? pr.corrigee : null } : null; }).filter(Boolean);
  const D = Banc.listeDeDepart(table, cl); if (!D) throw Error('translation monde − scène introuvable : pas de liste de départ');
  /* 14/11 : un cut du lot traité depuis était INVALIDE au départ (le lot ne traite que les invalides : la fiche de départ en compte autant que de cuts du lot).
   * `listeDeDepart` le rend « valide, sans drapeau » : il entrerait dans la référence d'écartement de la décision L1-e et dans la voie courante de l'ancre, ce que le
   * service worker n'a jamais vu. Ici il redevient invalide (statut 1). */
  let invalides = 0; for (const c of cl) if (Number.isInteger(c.cut) && c.cut >= 0 && c.cut < table.n && (table.fl[c.cut] & 1)) { D.table.st[c.cut] = 1; invalides++; }
  const t = { st: D.table.st, fl: D.table.fl, ed: D.table.ed.map(v => (Number.isFinite(v) ? v : NaN)) };
  const out = LM.compacter(t, { partie: snap.partie, at: snap.at, version: snap.version, cle: snap.cle });
  fs.writeFileSync(o.sortie, JSON.stringify(out));
  process.stdout.write(`liste de départ : ${out.lignes} lignes, ${cl.length} cuts du lot, ${D.remises} lignes remises sans drapeau dont ${invalides} rendues invalides, calage sur ${D.n} cuts (grappe suivante ${D.second})\n`);
}
if (require.main === module) { try { main(); } catch (e) { process.stderr.write('liste-depart : ' + e.message + '\n'); process.exitCode = 1; } }
