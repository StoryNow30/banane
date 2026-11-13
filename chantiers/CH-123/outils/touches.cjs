#!/usr/bin/env node
'use strict';
/* CH-123 : cuts touchés par un réglage et décisions changées hors de ces cuts (R3), entre deux rejeux du banc de CH-116. Lecture seule.
 *   node chantiers/CH-123/outils/touches.cjs REJEU_REF REJEU_REGLAGE [--corpus C.jsonl] [--lots a,b] [--csv F]
 * Les rejeux sont des dossiers du banc (`travail/rejeux/N`) ; celui du réglage doit avoir été fait avec `banc-touches.patch` (mesure seulement),
 * qui marque `l1.c123` sur chaque cut TOUCHÉ : des hypothèses générées (H7, H8) sont entrées au pool et le pool d'avant laissait le cut sans pose.
 * Rend :
 *  - les cuts dont la décision change (état ou pose, profil L1-se), répartis en touchés et hors des cuts touchés (ricochets : il en faut 0) ;
 *  - les poses de la référence par origine (chaîne du lot, GCV2), comptées à part : gardées à l'identique, déplacées, perdues (R3) ;
 *  - les cuts touchés par issue (posé, encore différé), avec le motif de la décision et l'origine de la paire ;
 *  - avec `--corpus` : le jugement des poses nouvelles (pire rail, 3D, contre la pose finale de l'opérateur ; juste ≤ 10 mm, > 50 = mauvaise voie).
 * Sorties : comptes, numéros de cut, millimètres. */
const fs = require('node:fs'), path = require('node:path');
const a = process.argv.slice(2), o = { pos: [] };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--corpus') o.corpus = v(); else if (k === '--csv') o.csv = v(); else if (k === '--lots') o.lots = v().split(','); else o.pos.push(k); }
const [A, B] = o.pos; if (!A || !B) throw Error('touches.cjs REJEU_REF REJEU_REGLAGE [--corpus C.jsonl] [--lots a,b] [--csv F]');
const SIDES = ['left', 'right'], P = 'L1-se';
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut');
const dist = (p, q) => Math.max(...SIDES.map(s => Math.hypot(p[s][0] - q[s][0], p[s][1] - q[s][1], p[s][2] - q[s][2])));
const C = new Map(); if (o.corpus) for (const l of fs.readFileSync(o.corpus, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s))) C.set(`${l.lot}-p${l.partie}-r${l.rang}:${l.cut}`, l);
const pose = x => x && x.etat === 'pose' && x.decal ? x.decal : null;
const origine = x => x.source === 'lot' ? 'chaîne du lot' : x.source === 'gcv2' ? (x.passe2 ? 'GCV2 (deuxième passe)' : 'GCV2') : x.source === 'l1s-chaine' || x.source === 'l1s-vue' ? 'chaîne refaite (L1-s)' : String(x.source);
const marque = y => (y.l1 && y.l1.c123) || (y.passe2 && y.passe2.c123) || null;
const classe = mm => mm <= 10 ? 'juste' : mm <= 50 ? '10-50' : 'plus-50';
const T = {}, lignes = [], totaux = { cuts: 0, identiques: 0, changes: 0, touches: 0, horsTouches: [], autres: 0 };
const t = k => (T[k] = T[k] || { poses: 0, gardees: 0, deplacees: [], perdues: [] });
for (const f of fs.readdirSync(A).filter(f => f.endsWith('.jsonl') && f !== 'reglage.json').sort()) {
  const cle = f.replace('.jsonl', ''); if (o.lots && !o.lots.includes(cle.split('-')[0])) continue;
  if (!fs.existsSync(path.join(B, f))) { process.stderr.write(`absent du réglage : ${f}\n`); continue; }
  const b = new Map(lire(path.join(B, f)).map(x => [x.cut, x])), partie = cle.split('-')[1].slice(1);
  for (const la of lire(path.join(A, f))) {
    const lb = b.get(la.cut); totaux.cuts++;
    if (!lb) { totaux.horsTouches.push(`${cle} ${la.cut} absent`); continue; }
    const x = la.profils[P], y = lb.profils[P], px = pose(x), py = pose(y), m = marque(y), id = `${partie}/${la.cut}`;
    const change = JSON.stringify([x.etat, x.decal || null]) !== JSON.stringify([y.etat, y.decal || null]);
    if (px) { const tt = t(origine(x)); tt.poses++; if (!py) tt.perdues.push(id); else { const d = dist(px, py); if (d > 0.005) tt.deplacees.push(`${id} ${d.toFixed(1)}`); else tt.gardees++; } }
    if (m) totaux.touches++;
    if (!change) { totaux.identiques++; if (!m) continue; }
    else { totaux.changes++; if (!m) totaux.horsTouches.push(`${cle} ${la.cut} ${x.etat}→${y.etat}`); }
    if (!m) continue;
    const c = C.get(`${cle}:${la.cut}`), juge = c && c.poseFinale && !c.exclu, l1 = y.l1 || {};
    const mm = py && juge ? Math.round(dist(py, c.poseFinale) * 10) / 10 : null;
    lignes.push({ cle, lot: cle.split('-')[0], partie: Number(partie), cut: la.cut, zone: lb.zone || la.zone || '', avant: x.etat, apres: y.etat, passe: y.passe2 && y.etat === 'pose' ? y.passe2.passe : '',
      motif: y.etat === 'pose' ? (l1.motif || 'valider') : (l1.motif || (y.passe2 && y.passe2.motif) || (l1.refusCommande ? 'refus:' + l1.refusCommande : '') || ''), hypothese: l1.hypothese || '', p: l1.p ?? '',
      ajoutes: m.ajoutes ?? '', sortLot: c ? c.sortLot : '', classeLot: c ? c.classe : '', mm, classe: mm == null ? (py ? 'non-jugé' : '') : classe(mm), change });
  }
}
const out = [`# Cuts touchés et décisions changées : « ${path.basename(B)} » contre « ${path.basename(A)} »`, '',
  `Cuts comparés : ${totaux.cuts} ; décision identique (état et pose) : ${totaux.identiques} ; décision changée : ${totaux.changes}.`,
  `Cuts touchés (hypothèses générées au pool ET pool d'avant sans pose) : ${totaux.touches}.`,
  `**Décisions changées hors des cuts touchés : ${totaux.horsTouches.length}**${totaux.horsTouches.length ? ' : ' + totaux.horsTouches.join(' ; ') : ''}`, '',
  '## Poses de la référence, par origine (R3)', '', '| origine de la pose (référence) | poses | gardées à l\'identique | déplacées | perdues (différées) |', '|---|---|---|---|---|'];
for (const [k, v] of Object.entries(T).sort()) out.push(`| ${k} | ${v.poses} | ${v.gardees} | ${v.deplacees.length} | ${v.perdues.length} |`);
for (const [k, v] of Object.entries(T)) { if (v.deplacees.length) out.push('', `${k}, déplacées (mm) : ${v.deplacees.join(' ; ')}`); if (v.perdues.length) out.push('', `${k}, perdues : ${v.perdues.join(' ; ')}`); }
const cpt = {}; for (const l of lignes) { const k = `${l.avant}→${l.apres} | ${l.zone} | ${l.motif || '-'} | ${l.classe || '-'}`; cpt[k] = (cpt[k] || 0) + 1; }
out.push('', '## Cuts touchés, par issue', '', '| avant → après | zone | motif de la décision | jugement | cuts |', '|---|---|---|---|---|');
for (const [k, v] of Object.entries(cpt).sort()) out.push(`| ${k} | ${v} |`);
const np = lignes.filter(l => l.avant !== 'pose' && l.apres === 'pose');
const cl = k => np.filter(l => l.classe === k).length;
out.push('', `Poses nouvelles (différé → posé) : ${np.length} ; jugées ${np.filter(l => l.mm != null).length} : ≤ 10 mm ${cl('juste')}, 10–50 mm ${cl('10-50')}, > 50 mm ${cl('plus-50')} ; non jugées ${cl('non-jugé')}.`);
if (np.length) { out.push('', '| lot | partie/cut | zone | motif | paire | p | sort au lot réel | écart à la pose finale (mm) |', '|---|---|---|---|---|---|---|---|');
  for (const l of np) out.push(`| ${l.lot} | ${l.partie}/${l.cut} | ${l.zone} | ${l.motif}${l.passe ? ' (passe ' + l.passe + ')' : ''} | ${l.hypothese} | ${l.p} | ${l.sortLot}${l.classeLot ? ' (' + l.classeLot + ')' : ''} | ${l.mm ?? 'non jugé'} |`); }
process.stdout.write(out.join('\n') + '\n');
if (o.csv) { const k = ['cle', 'cut', 'zone', 'avant', 'apres', 'passe', 'motif', 'hypothese', 'p', 'ajoutes', 'sortLot', 'classeLot', 'mm', 'classe', 'change'];
  fs.writeFileSync(o.csv, k.join(';') + '\n' + lignes.map(l => k.map(c => String(l[c] ?? '')).join(';')).join('\n') + '\n'); }
process.exitCode = totaux.horsTouches.length ? 1 : 0;
