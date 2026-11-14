#!/usr/bin/env node
'use strict';
/* CH-116 : poses de la garde d'octobre changées par un réglage (« verts changés » et toute pose déplacée), jugées contre les vérités de la base.
 *   CH116_TRAVAIL=… node chantiers/CH-116/outils/verts-changes.cjs --a eteint --b N [--seuil 0.5] [--csv F]
 * Rejeux : travail/garde/<nom>/r-<lot>.jsonl (banc.cjs garde). Vérités : datasets/garde-gcv2/verites/ (celles de la base scellée).
 * Pour chaque cut posé des deux côtés (profil L1-se, vue « sans passe » : les poses de la passe à part) dont la pose bouge de plus de `seuil` mm :
 * écart à la vérité avant et après (pire rail, 3D), et sa classe : rapprochée / éloignée (de plus de 0,5 mm) / égale ; passée sous 10 mm ; JUSTE passé au-delà de 10 mm. */
const fs = require('node:fs'), path = require('node:path');
const RACINE = path.join(__dirname, '..', '..', '..');
const { travail } = require('./lots.cjs');
const base = JSON.parse(fs.readFileSync(path.join(RACINE, 'datasets', 'garde-gcv2', 'base-test18.json'), 'utf8'));
const a = process.argv.slice(2), o = { seuil: 0.5 };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--a') o.a = v(); else if (k === '--b') o.b = v(); else if (k === '--seuil') o.seuil = Number(v()); else if (k === '--csv') o.csv = v(); else throw Error('option inconnue ' + k); }
const dist = (p, q) => Math.max(...['left', 'right'].map(s => Math.hypot(...[0, 1, 2].map(i => p[s][i] - q[s][i]))));
const lire = (n, l) => new Map(fs.readFileSync(path.join(travail(), 'garde', n, `r-${l}.jsonl`), 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut').map(x => [x.cut, x]));
const T = { deplacees: 0, jugees: 0, rapprochees: 0, eloignees: 0, egales: 0, sous10: 0, justesPlus10: [], nonJugees: 0, parOrigine: {} }, lignes = [], csv = ['lot;cut;origine;passe;deplacementMm;avantMm;apresMm'];
for (const l of base.lots) {
  const A = lire(o.a, l.nom), B = lire(o.b, l.nom), V = JSON.parse(fs.readFileSync(path.join(RACINE, 'datasets', 'garde-gcv2', 'verites', l.verite), 'utf8'));
  for (const [cut, la] of A) {
    const x = la.profils['L1-se'], lb = B.get(cut), y = lb && lb.profils['L1-se'];
    if (!x || !y || x.etat !== 'pose' || y.etat !== 'pose' || !x.decal || !y.decal) continue;
    const d = dist(x.decal, y.decal); if (d <= o.seuil) continue;
    const origine = x.source === 'lot' ? 'chaîne' : x.passe2 ? 'passe' : 'GCV2', passe = !!(x.passe2 && x.passe2.passe);
    T.deplacees++; T.parOrigine[origine] = (T.parOrigine[origine] || 0) + 1;
    const mic = V[cut] && V[cut].mic;
    if (!mic) { T.nonJugees++; csv.push([l.nom, cut, origine, passe, d.toFixed(1), '', ''].join(';')); continue; }
    const ea = dist(x.decal, mic), eb = dist(y.decal, mic); T.jugees++;
    if (eb < ea - 0.5) T.rapprochees++; else if (eb > ea + 0.5) T.eloignees++; else T.egales++;
    if (ea > 10 && eb <= 10) T.sous10++;
    if (ea <= 10 && eb > 10) T.justesPlus10.push(`${l.nom} ${cut} ${ea.toFixed(1)}→${eb.toFixed(1)} mm`);
    lignes.push({ id: `${l.nom} ${cut}`, origine, d, ea, eb });
    csv.push([l.nom, cut, origine, passe, d.toFixed(1), ea.toFixed(1), eb.toFixed(1)].join(';'));
  }
}
const med = v => { const s = v.slice().sort((p, q) => p - q), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const out = [`Poses de la garde d'octobre déplacées de plus de ${o.seuil} mm : « ${o.b} » contre « ${o.a} »`,
  `déplacées ${T.deplacees} (${Object.entries(T.parOrigine).map(([k, v]) => k + ' ' + v).join(', ')}) ; déplacement médian ${med(lignes.map(x => x.d))?.toFixed(1)} mm, max ${lignes.length ? Math.max(...lignes.map(x => x.d)).toFixed(1) : '-'}`,
  `jugées ${T.jugees} (non jugées ${T.nonJugees}) : rapprochées ${T.rapprochees}, éloignées ${T.eloignees}, égales à 0,5 mm ${T.egales} ; passées sous 10 mm ${T.sous10} ; JUSTES passés au-delà de 10 mm ${T.justesPlus10.length}${T.justesPlus10.length ? ' : ' + T.justesPlus10.join(', ') : ''}`,
  `écart à la vérité, médiane avant ${med(lignes.map(x => x.ea))?.toFixed(1)} mm, après ${med(lignes.map(x => x.eb))?.toFixed(1)} mm`, '',
  ...lignes.sort((p, q) => (q.eb - q.ea) - (p.eb - p.ea)).map(x => `  ${x.id} (${x.origine}) : déplacée de ${x.d.toFixed(1)} mm ; vérité ${x.ea.toFixed(1)} → ${x.eb.toFixed(1)} mm`)];
if (o.csv) fs.writeFileSync(o.csv, csv.join('\n') + '\n');
process.stdout.write(out.join('\n') + '\n');
