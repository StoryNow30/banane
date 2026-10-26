#!/usr/bin/env node
'use strict';
/*
 * decisions-numeros.cjs — VÉRIFIE LA NUMÉROTATION DE DECISIONS.md (rangement R du plan 5.0, 25/10/2026).
 *
 * Lit les titres « ## D-xxx » et rend : nombre de décisions, numéros en double, trous, numéros hors d'ordre, identifiants non
 * numériques (décisions 4.4 et 4.7 : D-4.4.2 … D-4.7c). Deux exceptions connues, écrites ici et dans l'en-tête du fichier, ne
 * font pas échouer : D-097, D-098 et D-099 portent chacun deux décisions différentes depuis l'origine (deux textes gardés, rien
 * n'est tranché) ; D-225 à D-229 n'ont jamais été attribués. Tout autre double, trou ou désordre : code de sortie 1.
 *
 *   node tools/decisions-numeros.cjs [FICHIER]        (par défaut : DECISIONS.md du dépôt)
 */
const fs = require('node:fs'), path = require('node:path');
const DOUBLONS_CONNUS = { 97: 2, 98: 2, 99: 2 };
const TROUS_CONNUS = new Set([225, 226, 227, 228, 229]);

function verifier(texte) {
  const titres = [...texte.matchAll(/^## D-(\S+?)(?=\s|$)/gm)].map(m => m[1]);
  const numeriques = titres.filter(t => /^\d+$/.test(t)).map(Number), autres = titres.filter(t => !/^\d+$/.test(t));
  const compte = new Map(); for (const n of numeriques) compte.set(n, (compte.get(n) || 0) + 1);
  const doublons = [...compte].filter(([, c]) => c > 1).map(([n, c]) => ({ n, c, connu: DOUBLONS_CONNUS[n] === c }));
  const min = Math.min(...numeriques), max = Math.max(...numeriques), trous = [];
  for (let n = min; n <= max; n++) if (!compte.has(n)) trous.push({ n, connu: TROUS_CONNUS.has(n) });
  const desordre = [];
  for (let i = 1; i < numeriques.length; i++) if (numeriques[i] < numeriques[i - 1]) desordre.push({ apres: numeriques[i - 1], n: numeriques[i] });
  for (const n of Object.keys(DOUBLONS_CONNUS).map(Number)) if (n >= min && n <= max && !doublons.some(d => d.n === n)) doublons.push({ n, c: compte.get(n) || 0, connu: false });
  const ok = !doublons.some(d => !d.connu) && !trous.some(t => !t.connu) && !desordre.length;
  return { titres: titres.length, numeriques: numeriques.length, distincts: compte.size, min, max, doublons, trous, desordre, autres, ok };
}
const d3 = n => 'D-' + String(n).padStart(3, '0');
function plages(liste) { const p = []; for (const n of liste) { const l = p.at(-1); if (l && n === l[1] + 1) l[1] = n; else p.push([n, n]); }
  return p.map(([a, z]) => a === z ? d3(a) : `${d3(a)} à ${d3(z)}`).join(', ') || 'aucun'; }
function rapport(r) {
  return [
    `titres « ## D- » : ${r.titres} (numériques : ${r.numeriques}, numéros distincts : ${r.distincts}, de ${d3(r.min)} à ${d3(r.max)})`,
    `identifiants non numériques : ${r.autres.length ? r.autres.map(a => 'D-' + a).join(', ') : 'aucun'}`,
    `doublons : ${r.doublons.length ? r.doublons.map(d => `${d3(d.n)} ×${d.c}${d.connu ? ' (connu : deux décisions différentes, gardées)' : ' (NON CONNU)'}`).join(' ; ') : 'aucun'}`,
    `trous : connus ${plages(r.trous.filter(t => t.connu).map(t => t.n))} ; non connus ${plages(r.trous.filter(t => !t.connu).map(t => t.n))}`,
    `ordre : ${r.desordre.length ? r.desordre.map(x => `${d3(x.n)} après ${d3(x.apres)}`).join(' ; ') : 'croissant'}`,
    `verdict : ${r.ok ? 'OK' : 'ÉCHEC'}`,
  ].join('\n');
}
module.exports = { verifier, rapport };
if (require.main === module) {
  const f = path.resolve(process.argv[2] || path.join(__dirname, '..', 'DECISIONS.md'));
  const r = verifier(fs.readFileSync(f, 'utf8'));
  console.log(rapport(r)); process.exitCode = r.ok ? 0 : 1;
}
