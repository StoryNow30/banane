#!/usr/bin/env node
'use strict';
/* CH-123 : distance du milieu de la paire posée à l'axe de la voie relevée (ancre de CH-124), pour les cuts reposés par un réglage. MESURE
 * SEULEMENT : l'ancre n'entre dans aucun réglage ni dans aucun critère de ce chantier. Hors ligne, lecture seule.
 *   node --max-old-space-size=8192 chantiers/CH-123/outils/axe-ch124.cjs --ch124 COPIE_DE_CH-124 --ref REJEU_REF --reglage REJEU_REGLAGE [--csv F]
 * COPIE_DE_CH-124 : copie de travail de la branche `chantier/CH-124` (hors dépôt) ; ses outils `outils/{lib,trajectoire,ancre}.cjs` sont utilisés
 * tels quels (axe prédit par la seule liste d'ESV du départ du lot, reconstituée). Données : dossier de travail du banc de CH-116 (CH116_TRAVAIL).
 * Pour chaque cut différé à la référence et posé par le réglage : écart en travers (mm, signé, vers la gauche) du milieu de la paire posée à
 * l'axe prédit ; de même pour la pose finale de l'opérateur (cut jugé) et pour la pose de départ d'ESV ; écart de la pose au jugement du banc
 * (pire rail, 3D). Un lot-partie sans liste d'ESV n'a pas d'axe : ses cuts sont comptés « sans axe ». Sorties : numéros de cut, millimètres. */
const fs = require('node:fs'), path = require('node:path');
const a = process.argv.slice(2), o = {};
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--ch124') o.ch124 = v(); else if (k === '--ref') o.ref = v(); else if (k === '--reglage') o.reglage = v(); else if (k === '--csv') o.csv = v(); else throw Error('option inconnue ' + k); }
if (!o.ch124 || !o.ref || !o.reglage) throw Error('--ch124 COPIE --ref REJEU_REF --reglage REJEU_REGLAGE');
const OUT = path.join(path.resolve(o.ch124), 'chantiers', 'CH-124', 'outils');
const Lb = require(path.join(OUT, 'lib.cjs')), T = require(path.join(OUT, 'trajectoire.cjs')), An = require(path.join(OUT, 'ancre.cjs'));
const SIDES = ['left', 'right'], P = 'L1-se';
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut');
const pose = x => x && x.etat === 'pose' && x.decal ? x.decal : null;
const pire = (p, q) => Math.max(...SIDES.map(s => Math.hypot(p[s][0] - q[s][0], p[s][1] - q[s][1], p[s][2] - q[s][2])));
const centre = p => p ? (p.left[1] + p.right[1]) / 2 : null;
const r1 = v => v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10;
const co = Lb.corpus(), lignes = [];
for (const e of Lb.entrees()) {
  const k = Lb.cle(e), fa = path.join(o.ref, k + '.jsonl'), fb = path.join(o.reglage, k + '.jsonl');
  if (!fs.existsSync(fa) || !fs.existsSync(fb)) continue;
  const B = new Map(lire(fb).map(x => [x.cut, x])), reposes = lire(fa).filter(la => !pose(la.profils[P]) && B.get(la.cut) && pose(B.get(la.cut).profils[P])).map(la => la.cut);
  if (!reposes.length) continue;
  const m = Lb.meta(k), C = co.get(k) || new Map();
  let Mo = null, rows = null, cal = null, caps = null;
  if (m.liste) { const fin = T.lignes(m.liste); caps = Lb.captures(k); cal = An.calage(fin, caps); if (cal) { rows = An.listeDeDepart(fin, caps, cal); Mo = An.modele(rows); } }
  for (const cut of reposes) {
    const y = B.get(cut).profils[P], c = C.get(cut), juge = c && c.poseFinale && !c.exclu, d = pose(y);
    const l = { lot: e.lot, partie: e.partie, cut, zone: B.get(cut).zone || '', motif: (y.l1 && y.l1.motif) || 'valider', mm: juge ? r1(pire(d, c.poseFinale)) : null, axePose: null, axeFinale: null, axeDepart: null, raison: '' };
    const cap = caps && caps.get(cut), r = rows && rows[cut], ax = Mo && r ? Mo.axe(cut) : null;
    if (!m.liste) l.raison = 'sans liste'; else if (!cal) l.raison = 'sans calage'; else if (!cap || !r) l.raison = 'cut absent de la liste'; else if (!ax) l.raison = 'sans calage local';
    else {
      const rep = Lb.repere(cap), Ow = rep.O.map((v, i) => v + cal.t[i]), yM = 1000 * ((r.M[0] - Ow[0]) * rep.Y[0] + (r.M[1] - Ow[1]) * rep.Y[1]), yAxe = yM + ax.mm;
      l.axePose = r1(centre(Lb.poseCoupe(cap, d, rep)) - yAxe); l.axeDepart = r1(0 - yAxe);
      if (juge) l.axeFinale = r1(centre(Lb.poseCoupe(cap, c.poseFinale, rep)) - yAxe);
    }
    lignes.push(l);
  }
  caps = null;
}
const avec = lignes.filter(l => l.axePose != null), abs = avec.map(l => Math.abs(l.axePose)), q = (v, p) => { const x = Lb.quantile(v, p); return x == null ? '-' : x.toFixed(1); };
const out = [`# Cuts reposés par « ${path.basename(o.reglage)} » (différés à « ${path.basename(o.ref)} ») : écart du milieu de la paire à l'axe de CH-124`, '',
  'Mesure seulement : l\'axe n\'entre dans aucun réglage. Écarts en travers, mm, signés vers la gauche. Repère de CH-124 : à la pose finale de l\'opérateur, 4,1 mm en médiane et 36,4 mm au plus sur 792 cuts jugés ; mauvaises voies à 121-331 mm.', '',
  `Cuts reposés : ${lignes.length} ; avec axe : ${avec.length} ; sans axe : ${lignes.length - avec.length}${lignes.length - avec.length ? ' (' + [...new Set(lignes.filter(l => l.axePose == null).map(l => l.raison))].join(', ') + ')' : ''}.`,
  avec.length ? `Écart |milieu de la paire posée − axe| : médiane ${q(abs, 0.5)} mm, q90 ${q(abs, 0.9)} mm, max ${Math.max(...abs).toFixed(1)} mm ; au-delà de 40 mm : ${abs.filter(x => x > 40).length} ; au-delà de 60 mm : ${abs.filter(x => x > 60).length}.` : '', '',
  '| lot | partie/cut | zone | motif | pose → axe | pose finale → axe | départ ESV → axe | écart à la pose finale (pire rail, 3D) |', '|---|---|---|---|---|---|---|---|'];
for (const l of lignes) out.push(`| ${l.lot} | ${l.partie}/${l.cut} | ${l.zone} | ${l.motif} | ${l.axePose ?? l.raison} | ${l.axeFinale ?? '-'} | ${l.axeDepart ?? '-'} | ${l.mm ?? 'non jugé'} |`);
process.stdout.write(out.join('\n') + '\n');
if (o.csv) fs.writeFileSync(o.csv, 'lot;partie;cut;zone;motif;axePoseMm;axeFinaleMm;axeDepartMm;ecartFinaleMm;raison\n' + lignes.map(l => [l.lot, l.partie, l.cut, l.zone, l.motif, l.axePose ?? '', l.axeFinale ?? '', l.axeDepart ?? '', l.mm ?? '', l.raison].join(';')).join('\n') + '\n');
