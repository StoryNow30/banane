#!/usr/bin/env node
'use strict';
/* CH-116 : poses déplacées entre deux rejeux, par origine de la pose (chaîne du lot ou GCV2), avec leur jugement. Hors ligne.
 *   node chantiers/CH-116/outils/chaine.cjs --a livre --b N --lot 1211v --corpus C.jsonl [--seuil 0.5]
 * Origine lue au rejeu de référence : « chaîne » = source `lot` (première passe, fenêtre, choix, croisement…), « GCV2 » = source `gcv2`
 * (dans le lot ou deuxième passe). Pour chaque origine : poses déplacées de plus de `seuil` mm (pire rail, 3D), médiane et maximum, combien sont
 * jugées, et parmi elles combien vont vers la pose finale de l'opérateur (mieux de plus de 0,5 mm), s'en éloignent (pire), ou restent. */
const fs = require('node:fs'), path = require('node:path');
const { LOTS, cle, travail } = require('./lots.cjs');
const a = process.argv.slice(2), o = { seuil: 0.5 };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--a') o.a = v(); else if (k === '--b') o.b = v(); else if (k === '--lot') o.lot = v(); else if (k === '--corpus') o.corpus = v(); else if (k === '--seuil') o.seuil = Number(v()); else throw Error('option inconnue ' + k); }
if (!o.a || !o.b || !o.lot || !o.corpus) throw Error('--a REF --b REJEU --lot L --corpus C.jsonl');
const C = new Map(fs.readFileSync(o.corpus, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).map(c => [`${c.partie}/${c.cut}`, c]));
const dist = (p, q) => Math.max(...['left', 'right'].map(s => Math.hypot(...[0, 1, 2].map(i => p[s][i] - q[s][i]))));
const lire = (n, e) => fs.readFileSync(path.join(travail(), 'rejeux', n, cle(e) + '.jsonl'), 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut');
const T = {};
for (const e of LOTS.filter(x => x.lot === o.lot)) {
  const A = lire(o.a, e), B = new Map(lire(o.b, e).map(l => [l.cut, l]));
  for (const la of A) {
    const x = la.profils['L1-se'], lb = B.get(la.cut), y = lb && lb.profils['L1-se'];
    if (!x || x.etat !== 'pose' || !x.decal || !y || y.etat !== 'pose' || !y.decal) continue;
    const orig = x.source === 'lot' ? 'chaîne' : x.passe2 ? 'GCV2 (passe)' : 'GCV2', t = (T[orig] = T[orig] || { poses: 0, dep: [], juges: 0, mieux: [], pire: [], egal: 0 });
    t.poses++;
    const d = dist(x.decal, y.decal); if (d <= o.seuil) continue;
    t.dep.push(d);
    const c = C.get(`${e.partie}/${la.cut}`);
    if (c && c.poseFinale && !c.exclu) {
      t.juges++; const ea = dist(x.decal, c.poseFinale), eb = dist(y.decal, c.poseFinale), id = `${e.partie}/${la.cut} ${ea.toFixed(1)}→${eb.toFixed(1)}`;
      if (eb < ea - 0.5) t.mieux.push(id); else if (eb > ea + 0.5) t.pire.push(id); else t.egal++;
    }
  }
}
const med = v => { if (!v.length) return null; const s = v.slice().sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const out = [`« ${o.b} » contre « ${o.a} », lot ${o.lot} : poses déplacées de plus de ${o.seuil} mm, par origine`, '',
  '| origine | poses (posées des deux côtés) | déplacées | médiane (mm) | max (mm) | jugées | vers la pose finale | s\'en éloignent | inchangées à 0,5 mm |', '|---|---|---|---|---|---|---|---|---|'];
for (const [k, t] of Object.entries(T)) out.push(`| ${k} | ${t.poses} | ${t.dep.length} | ${t.dep.length ? med(t.dep).toFixed(1) : '-'} | ${t.dep.length ? Math.max(...t.dep).toFixed(1) : '-'} | ${t.juges} | ${t.mieux.length} | ${t.pire.length} | ${t.egal} |`);
for (const [k, t] of Object.entries(T)) { if (t.pire.length) out.push('', `${k}, éloignées : ${t.pire.join(' ; ')}`); if (t.mieux.length) out.push('', `${k}, rapprochées : ${t.mieux.join(' ; ')}`); }
process.stdout.write(out.join('\n') + '\n');
