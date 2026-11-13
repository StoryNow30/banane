#!/usr/bin/env node
'use strict';
/* CH-125 (audit 2, R6) : sur les lots d'octobre de la garde, les poses de la CHAÎNE déplacées par un réglage, contre la vérité scellée. Hors ligne.
 *   node chantiers/CH-125/outils/oct-chaine.cjs --a REJEUX_ETEINT --b REJEUX_REGLAGE [--seuil 0.5] [--csv PAR-CUT.csv]
 * `--a`, `--b` : dossiers de `banc.cjs garde` (r-<lot>.jsonl ; même code, réglage éteint puis allumé). Pose de la chaîne = pose du profil `base`
 * (la chaîne sans la GCV2), celle que la garde ne rejuge pas. Par groupe de lots et au total :
 *   - poses de la chaîne des deux côtés, déplacées de plus de `seuil` mm (pire rail, 3D) : nombre, médiane, maximum ;
 *   - parmi celles qui ont une vérité scellée (datasets/garde-gcv2/verites/) : écart à la vérité avant et après, rapprochées (mieux de plus de
 *     0,5 mm), éloignées, justes (≤ 10 mm à l'éteint) passés au-delà de 10 mm, gagnés, médiane de l'écart avant et après (toutes les jugées, et
 *     les déplacées) ; les vérités « visité sans action » (la vérité y est la pose du lot) sont données à part ;
 *   - décisions changées (état du profil `base` et du profil L1-se), séparées en cuts touchés par la mesure (`mesureSource` au rejeu) et ricochets.
 * Sorties : comptes, millimètres, numéros de cut. */
const fs = require('node:fs'), path = require('node:path');
const RACINE = path.join(__dirname, '..', '..', '..');
const a = process.argv.slice(2), o = { seuil: 0.5 };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--a') o.a = v(); else if (k === '--b') o.b = v(); else if (k === '--seuil') o.seuil = Number(v()); else if (k === '--csv') o.csv = v(); else throw Error('option inconnue ' + k); }
if (!o.a || !o.b) throw Error('--a REJEUX_ETEINT --b REJEUX_REGLAGE');
const base = JSON.parse(fs.readFileSync(path.join(RACINE, 'datasets', 'garde-gcv2', 'base-test18.json'), 'utf8'));
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut');
const SIDES = ['left', 'right'], pire = (p, q) => Math.max(...SIDES.map(s => Math.hypot(p[s][0] - q[s][0], p[s][1] - q[s][1], p[s][2] - q[s][2])));
const med = v => { if (!v.length) return null; const s = v.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }, r1 = v => v == null ? '-' : (Math.round(v * 10) / 10).toFixed(1);
const vide = () => ({ poses: 0, depl: [], juges: 0, jugesDepl: 0, mieux: 0, pire: 0, egal: 0, justes: 0, perdus: [], gagnes: [], ea: [], eb: [], eaD: [], ebD: [], vb: { n: 0, depl: 0, perdus: [] }, etatBase: [], etatL1: [], ricochets: [], posesL1Ricochet: [] });
const T = {}, csv = ['lot;cut;origine;verite;deplace_mm;ecart_avant;ecart_apres;touche'];
for (const l of base.lots) {
  const fa = path.join(o.a, `r-${l.nom}.jsonl`), fb = path.join(o.b, `r-${l.nom}.jsonl`); if (!fs.existsSync(fa) || !fs.existsSync(fb)) { process.stdout.write(`lot absent : ${l.nom}\n`); continue; }
  const V = JSON.parse(fs.readFileSync(path.join(RACINE, 'datasets', 'garde-gcv2', 'verites', l.verite), 'utf8')), B = new Map(lire(fb).map(x => [x.cut, x]));
  for (const la of lire(fa)) {
    const lb = B.get(la.cut); if (!lb) continue;
    const touche = !!lb.mesureSource, id = `${l.nom} ${la.cut}`;
    for (const g of [l.groupe, 'total']) {
      const t = (T[g] = T[g] || vide()), xa = la.profils.base, xb = lb.profils.base, ya = la.profils['L1-se'], yb = lb.profils['L1-se'];
      if (xa && xb && (xa.etat === 'pose') !== (xb.etat === 'pose')) t.etatBase.push(`${id} ${xa.etat}→${xb.etat}${touche ? '' : ' (ricochet)'}`);
      if (ya && yb && ya.etat !== yb.etat) { t.etatL1.push(`${id} ${ya.etat}→${yb.etat}${touche ? '' : ' (ricochet)'}`); if (!touche) t.ricochets.push(id); }
      else if (ya && yb && ya.etat === 'pose' && ya.decal && yb.decal && !touche && pire(ya.decal, yb.decal) > o.seuil) t.posesL1Ricochet.push(`${id} ${r1(pire(ya.decal, yb.decal))}`);
      if (!xa || !xb || xa.etat !== 'pose' || xb.etat !== 'pose' || !xa.decal || !xb.decal) continue;
      t.poses++; const d = pire(xa.decal, xb.decal), v = V[la.cut], dep = d > o.seuil; if (dep) t.depl.push(d);
      if (!v || !v.mic) { if (g === 'total' && dep) csv.push([l.nom, la.cut, xa.etage || '', '', r1(d), '', '', touche ? 1 : 0].join(';')); continue; }
      const ea = pire(xa.decal, v.mic), eb = pire(xb.decal, v.mic), visite = /visite-bon/.test(v.src || '');
      if (g === 'total' && dep) csv.push([l.nom, la.cut, xa.etage || '', v.src || '', r1(d), r1(ea), r1(eb), touche ? 1 : 0].join(';'));
      if (visite) { t.vb.n++; if (dep) t.vb.depl++; if (ea <= 10 && eb > 10) t.vb.perdus.push(`${id} ${r1(ea)}→${r1(eb)}`); continue; }
      t.juges++; t.ea.push(ea); t.eb.push(eb); if (ea <= 10) t.justes++;
      if (dep) { t.jugesDepl++; t.eaD.push(ea); t.ebD.push(eb); if (eb < ea - 0.5) t.mieux++; else if (eb > ea + 0.5) t.pire++; else t.egal++; }
      if (ea <= 10 && eb > 10) t.perdus.push(`${id} ${r1(ea)}→${r1(eb)}`); if (ea > 10 && eb <= 10) t.gagnes.push(`${id} ${r1(ea)}→${r1(eb)}`);
    }
  }
}
const out = ['| groupe | poses de la chaîne | déplacées | médiane, max (mm) | jugées (validation) | dont déplacées | rapprochées / éloignées / égales | justes à l\'éteint | justes passés > 10 mm | gagnés | médiane de l\'écart, toutes : avant → après | déplacées : avant → après | « visité sans action » : poses, déplacées, justes passés > 10 mm |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const [g, t] of Object.entries(T)) out.push(`| ${g} | ${t.poses} | ${t.depl.length} | ${r1(med(t.depl))}, ${t.depl.length ? r1(Math.max(...t.depl)) : '-'} | ${t.juges} | ${t.jugesDepl} | ${t.mieux} / ${t.pire} / ${t.egal} | ${t.justes} | ${t.perdus.length} | ${t.gagnes.length} | ${r1(med(t.ea))} → ${r1(med(t.eb))} | ${r1(med(t.eaD))} → ${r1(med(t.ebD))} | ${t.vb.n}, ${t.vb.depl}, ${t.vb.perdus.length} |`);
const t = T.total || vide();
out.push('', `Justes d'octobre passés au-delà de 10 mm (validations) : ${t.perdus.join(' ; ') || 'aucun'}`, `Gagnés : ${t.gagnes.join(' ; ') || 'aucun'}`, `« Visité sans action », justes passés au-delà de 10 mm : ${t.vb.perdus.join(' ; ') || 'aucun'}`,
  `États changés, profil base (chaîne) : ${t.etatBase.length}${t.etatBase.length ? ' : ' + t.etatBase.join(' ; ') : ''}`, `États changés, profil L1-se : ${t.etatL1.length}${t.etatL1.length ? ' : ' + t.etatL1.join(' ; ') : ''}`,
  `Ricochets (état changé sur un cut non touché par la mesure) : ${t.ricochets.length}${t.ricochets.length ? ' : ' + t.ricochets.join(' ; ') : ''}`, `Poses L1-se déplacées sur un cut non touché : ${t.posesL1Ricochet.length}${t.posesL1Ricochet.length ? ' : ' + t.posesL1Ricochet.join(' ; ') : ''}`);
process.stdout.write(out.join('\n') + '\n');
if (o.csv) fs.writeFileSync(o.csv, csv.join('\n') + '\n');
