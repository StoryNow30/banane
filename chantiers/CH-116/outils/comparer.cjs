#!/usr/bin/env node
'use strict';
/* CH-116 : comparatif d'un rejeu contre une référence (par défaut « livre »), cut par cut, sur le corpus jugé. Hors ligne.
 *   node chantiers/CH-116/outils/comparer.cjs --nom N [--ref livre] [--vus 1111,1211] [--examen 0511]
 * Par lot, pour la référence et le rejeu : posés jugés, > 50 mm, 10–50, différés ; transitions : justes (≤ 10 mm à la référence) passés
 * au-delà de 10 mm, justes différés, différés de la référence reposés justes / faux. Groupes : vus (réglage), non vus, examen. */
const B = require('./banc.cjs');
const a = process.argv.slice(2), o = { ref: 'livre', vus: ['1111', '1211'], examen: ['0511'] };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--nom') o.nom = v(); else if (k === '--ref') o.ref = v(); else if (k === '--vus') o.vus = v().split(','); else if (k === '--examen') o.examen = v().split(','); else throw Error('option inconnue ' + k); }
if (!o.nom) throw Error('--nom N');
const J = B.juger(o.nom, {}), R = B.juger(o.ref, {}), ref = new Map(R.parCut.map(r => [`${r.cle}:${r.cut}`, r]));
const vide = () => ({ jugesR: 0, p50R: 0, d1050R: 0, diffR: 0, juges: 0, p50: 0, d1050: 0, diff: 0, justesPlus10: 0, justesDifferes: 0, reposesJustes: 0, reposesFaux: 0, nouveaux50: [], perdus50: [], liste: [] });
const T = {};
for (const r of J.parCut) {
  const q = ref.get(`${r.cle}:${r.cut}`); if (!q) continue;
  const t = (T[r.lot] = T[r.lot] || vide()), id = `${r.partie}/${r.cut}`;
  if (q.classe) { t.jugesR++; if (q.classe === 'plus-50') t.p50R++; if (q.classe === '10-50') t.d1050R++; }
  if (q.etat === 'differe') t.diffR++;
  if (r.classe) { t.juges++; if (r.classe === 'plus-50') t.p50++; if (r.classe === '10-50') t.d1050++; }
  if (r.etat === 'differe') t.diff++;
  if (q.classe === 'juste' && (r.classe === '10-50' || r.classe === 'plus-50')) { t.justesPlus10++; t.liste.push(`${id} juste→${r.mm} mm`); }
  if (q.classe === 'juste' && r.etat === 'differe') { t.justesDifferes++; t.liste.push(`${id} juste→différé`); }
  if (q.etat === 'differe' && r.classe) { if (r.classe === 'juste') t.reposesJustes++; else { t.reposesFaux++; t.liste.push(`${id} différé→${r.mm} mm`); } }
  if (r.classe === 'plus-50' && q.classe !== 'plus-50') t.nouveaux50.push(id);
  if (q.classe === 'plus-50' && r.classe !== 'plus-50') t.perdus50.push(`${id}→${r.etat === 'differe' ? 'différé' : r.mm + ' mm'}`);
}
const somme = ls => ls.reduce((s, l) => { const t = T[l] || vide(); for (const k of Object.keys(s)) s[k] = Array.isArray(s[k]) ? s[k].concat(t[k]) : s[k] + t[k]; return s; }, vide());
const lots = Object.keys(T), nonVus = lots.filter(l => !o.vus.includes(l) && !o.examen.includes(l));
const H = `| lot | posés jugés (réf → rejeu) | > 50 mm | 10–50 | différés | justes passés > 10 mm | justes différés | différés reposés justes / faux |\n|---|---|---|---|---|---|---|---|`;
const L = (n, t) => `| ${n} | ${t.jugesR} → ${t.juges} | ${t.p50R} → ${t.p50} | ${t.d1050R} → ${t.d1050} | ${t.diffR} → ${t.diff} | ${t.justesPlus10} | ${t.justesDifferes} | ${t.reposesJustes} / ${t.reposesFaux} |`;
const out = [`Rejeu « ${o.nom} » contre « ${o.ref} », sur le corpus jugé`, '', H, ...lots.map(l => L(l + (o.vus.includes(l) ? ' (vu)' : o.examen.includes(l) ? ' (examen)' : ''), T[l])),
  L('**vus**', somme(o.vus)), L('**non vus**', somme(nonVus)), L('**examen**', somme(o.examen)), L('**total**', somme(lots)), ''];
for (const l of lots) { const t = T[l]; if (t.perdus50.length) out.push(`${l} : > 50 mm corrigés ${t.perdus50.join(' ')}`); if (t.nouveaux50.length) out.push(`${l} : nouveaux > 50 mm ${t.nouveaux50.join(' ')}`); if (t.liste.length) out.push(`${l} : ${t.liste.join(' ; ')}`); }
process.stdout.write(out.join('\n') + '\n');
