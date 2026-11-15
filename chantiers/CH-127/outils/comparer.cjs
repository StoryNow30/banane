#!/usr/bin/env node
'use strict';
/* CH-127 : un réglage « poser plus » sous N contre le tronc (N allumé), cut par cut, jugé contre la vérité, et la règle de décision du ticket (§ 4).
 * Hors ligne, lecture seule. Sorties : numéros de cut, millimètres.
 *   node chantiers/CH-127/outils/comparer.cjs corpus --ref N --nom X [--md F] [--csv F] [--json F]
 *        rejeux du banc de CH-116 (CH116_TRAVAIL/rejeux/<nom>/<clé>.jsonl) ; vérité = pose finale du corpus (hors exclusions) ; groupe = étiquette du lot.
 *   node chantiers/CH-127/outils/comparer.cjs garde  --ref N --nom X [...]
 *        rejeux de la garde d'octobre au banc (CH116_TRAVAIL/garde/<nom>/r-<lot>.jsonl) ; vérité = datasets/garde-gcv2/verites/ ; groupe = groupe de la base.
 * Profil L1-se. « Posé » = état `pose` (pose écrite ; une pose de la passe non écrite est un différé). Pose nouvelle = posé par X, et non posé par la référence
 * ou posé à plus de 1 mm de sa pose. Juste = à 10 mm au plus de la vérité (pire rail, 3D). Chaîne = pose de la référence de source autre que `gcv2`.
 * N « a jugé » une pose quand le profil porte `ancre` sans `muet`. */
const fs = require('node:fs'), path = require('node:path');
const RACINE = path.join(__dirname, '..', '..', '..');
const { LOTS, cle, travail } = require(path.join(RACINE, 'chantiers', 'CH-116', 'outils', 'lots.cjs'));
const SIDES = ['left', 'right'];
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut');
const pire = (a, b) => Math.max(...SIDES.map(s => Math.hypot(a[s][0] - b[s][0], a[s][1] - b[s][1], a[s][2] - b[s][2])));
const f1 = v => v == null ? '' : v.toFixed(1);
function args(a) { const o = { mode: a[0] }; for (let i = 1; i < a.length; i++) { const k = a[i]; if (['--ref', '--nom', '--md', '--csv', '--json'].includes(k)) o[k.slice(2)] = a[++i]; else throw Error('option inconnue ' + k); } return o; }

function paires(o) {
  const W = travail(), out = [];
  if (o.mode === 'corpus') {
    const C = new Map();
    for (const l of fs.readFileSync(process.env.CH116_CORPUS || path.join(W, 'corpus.jsonl'), 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s))) { const k = `${l.lot}-p${l.partie}-r${l.rang}`; if (!C.has(k)) C.set(k, new Map()); C.get(k).set(l.cut, l); }
    for (const e of LOTS.filter(e => !e.vierge)) { const k = cle(e), a = path.join(W, 'rejeux', o.nom, k + '.jsonl'), b = path.join(W, 'rejeux', o.ref, k + '.jsonl'); if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
      const c = C.get(k) || new Map(); out.push({ lot: k, groupe: e.lot, a, b, verite: cut => { const x = c.get(cut); return x && x.poseFinale && !x.exclu ? x.poseFinale : null; } }); }
  } else if (o.mode === 'garde') {
    const base = JSON.parse(fs.readFileSync(path.join(RACINE, 'datasets', 'garde-gcv2', 'base-test18.json'), 'utf8'));
    for (const l of base.lots) { const a = path.join(W, 'garde', o.nom, `r-${l.nom}.jsonl`), b = path.join(W, 'garde', o.ref, `r-${l.nom}.jsonl`); if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
      const V = JSON.parse(fs.readFileSync(path.join(RACINE, 'datasets', 'garde-gcv2', 'verites', l.verite), 'utf8'));
      out.push({ lot: l.nom, groupe: l.groupe, a, b, verite: cut => V[cut] && V[cut].mic ? V[cut].mic : null }); }
  } else throw Error('mode : corpus | garde');
  return out;
}
const nJuge = x => !x.ancre ? 'sans ancre' : x.ancre.muet ? 'muet : ' + x.ancre.muet : 'jugé';
const etiq = x => `${x.etat}/${x.source || ''}${x.source === 'ancre' ? '<' + (x.origine || '') : ''}${x.passe2 && x.passe2.nonEcrite ? ' (non écrite : ' + x.passe2.nonEcrite + ')' : ''}`;
const sig = x => JSON.stringify({ e: x.etat, d: x.decal || null, s: x.source || null, o: x.origine || null, r: x.decalRefuse || null, p: x.passe2 ? (x.passe2.passe ?? true) : null, n: x.passe2 ? x.passe2.nonEcrite || null : null });

function main() {
  const o = args(process.argv.slice(2)); if (!o.ref || !o.nom) throw Error('--ref et --nom');
  const R = { cuts: 0, identiques: 0, changes: [], groupes: {} };
  for (const P of paires(o)) {
    const A = lire(P.a), B = new Map(lire(P.b).map(x => [x.cut, x]));
    const G = R.groupes[P.groupe] = R.groupes[P.groupe] || { reposesJustes: 0, justesPerdus: 0 };
    for (const l of A) {
      const x = (l.profils || {})['L1-se'], yl = B.get(l.cut), y = yl && (yl.profils || {})['L1-se']; if (!x || !y) continue; R.cuts++;
      if (sig(x) === sig(y)) { R.identiques++; continue; }
      const v = P.verite(l.cut), xP = x.etat === 'pose' && x.decal, yP = y.etat === 'pose' && y.decal;
      const pn = xP && v ? pire(x.decal, v) : null, pb = yP && v ? pire(y.decal, v) : null, dep = xP && yP ? pire(x.decal, y.decal) : null;
      const c = { lot: P.lot, groupe: P.groupe, cut: l.cut, avant: etiq(y), apres: etiq(x), pb, pn, dep, nJuge: xP ? nJuge(x) : '', verite: !!v };
      if (xP && (!yP || dep > 1)) c.type = yP ? (y.source === 'gcv2' ? 'pose GCV2 déplacée' : 'pose de la CHAÎNE déplacée') : 'pose nouvelle (différé → posé)';
      else if (yP && !xP) c.type = (y.source === 'gcv2' ? 'pose GCV2 perdue' : 'pose de la CHAÎNE perdue') + (x.source === 'ancre' ? ' (refus de N)' : '');
      else c.type = 'autre (état ou source, pose égale)';
      if (x.source === 'ancre' && y.source !== 'ancre') { c.refusN = '+1'; c.refusAVerite = v && x.decalRefuse ? pire(x.decalRefuse, v) : null; }
      if (y.source === 'ancre' && x.source !== 'ancre') { c.refusN = '-1'; c.refusAVerite = v && y.decalRefuse ? pire(y.decalRefuse, v) : null; }
      c.nouvelle = !!(xP && (!yP || dep > 1));
      c.reposeJuste = !yP && xP && pn != null && pn <= 10; if (c.reposeJuste) G.reposesJustes++;
      c.justeAuDela = yP && pb != null && pb <= 10 && xP && pn > 10;
      c.justePerdu = yP && pb != null && pb <= 10 && !xP; if (c.justePerdu) G.justesPerdus++;
      c.chaine = yP && y.source !== 'gcv2' && (!xP || dep > 1 || x.source !== y.source);
      R.changes.push(c);
    }
  }
  const N = R.changes.filter(c => c.nouvelle), J = N.filter(c => c.pn != null);
  const a = J.filter(c => c.pn > 50), b = J.filter(c => c.pn > 10), c1 = R.changes.filter(c => c.justeAuDela), c2 = R.changes.filter(c => c.justePerdu), d = R.changes.filter(c => c.chaine);
  const comp = Object.entries(R.groupes).map(([g, x]) => ({ g, ...x, ok: x.justesPerdus === 0 || x.reposesJustes >= 3 * x.justesPerdus }));
  const rN = R.changes.filter(c => c.refusN === '+1'), rNm = R.changes.filter(c => c.refusN === '-1');
  const parN = k => { const s = N.filter(k); return `${s.length} (N a jugé ${s.filter(c => c.nJuge === 'jugé').length}, muet ${s.filter(c => c.nJuge.startsWith('muet')).length}, sans ancre ${s.filter(c => c.nJuge === 'sans ancre').length})`; };
  const L = [`# ${o.nom} contre ${o.ref} (${o.mode})`, '',
    `Cuts comparés : ${R.cuts} ; identiques (profil L1-se : état, pose, source, passe, refus) : ${R.identiques} ; changés : ${R.changes.length}.`, '',
    '| type | cuts |', '|---|---|', ...Object.entries(R.changes.reduce((m, c) => (m[c.type] = (m[c.type] || 0) + 1, m), {})).map(([t, n]) => `| ${t} | ${n} |`), '',
    `Poses nouvelles : ${parN(() => true)} ; jugées : ${J.length} ; à 10 mm au plus : ${J.filter(c => c.pn <= 10).length} ; 10 à 50 mm : ${J.filter(c => c.pn > 10 && c.pn <= 50).length} ; au-delà de 50 mm : ${a.length} ; sans vérité : ${N.length - J.length}.`,
    `Différés du tronc reposés justes : ${R.changes.filter(c => c.reposeJuste).length}.`,
    `Refus de N en plus : ${rN.length}${rN.length ? ' (' + rN.map(c => `${c.lot}/${c.cut} pose refusée à ${f1(c.refusAVerite)} mm de la vérité`).join(' ; ') + ')' : ''} ; en moins : ${rNm.length}${rNm.length ? ' (' + rNm.map(c => `${c.lot}/${c.cut}`).join(' ; ') + ')' : ''}.`, '',
    '## Règle (§ 4 du ticket), sur ce jeu seul', '',
    `- (a) poses nouvelles à plus de 50 mm : **${a.length}**${a.length ? ' : ' + a.map(c => `${c.lot}/${c.cut} ${f1(c.pn)} mm`).join(' ; ') : ''}`,
    `- (b) poses nouvelles jugées à plus de 10 mm : **${b.length} sur ${J.length}**${b.length ? ' : ' + b.map(c => `${c.lot}/${c.cut} ${f1(c.pn)} mm`).join(' ; ') : ''}`,
    `- (c) justes du tronc passés au-delà de 10 mm : **${c1.length}**${c1.length ? ' : ' + c1.map(c => `${c.lot}/${c.cut} ${f1(c.pb)} → ${f1(c.pn)} mm`).join(' ; ') : ''} ; justes perdus : **${c2.length}**${c2.length ? ' : ' + c2.map(c => `${c.lot}/${c.cut} (${f1(c.pb)} mm → ${c.apres})`).join(' ; ') : ''}`,
    `- (c) compensation par groupe (reposés justes ≥ 3 × justes perdus) : ${comp.map(x => `${x.g} ${x.reposesJustes}/${x.justesPerdus}${x.ok ? '' : ' NON'}`).join(' ; ')}`,
    `- (d) poses de la chaîne déplacées ou perdues : **${d.length}**${d.length ? ' : ' + d.map(c => `${c.lot}/${c.cut}`).join(' ; ') : ''}`, '',
    '## Cuts changés', '', '| lot | cut | type | référence | réglage | réf. → vérité (mm) | réglage → vérité (mm) | déplacement (mm) | N | refus N |', '|---|---|---|---|---|---|---|---|---|---|',
    ...R.changes.map(c => `| ${c.lot} | ${c.cut} | ${c.type} | ${c.avant} | ${c.apres} | ${f1(c.pb)} | ${f1(c.pn)} | ${f1(c.dep)} | ${c.nJuge} | ${c.refusN || ''} |`)];
  const md = L.join('\n') + '\n'; if (o.md) fs.writeFileSync(o.md, md); process.stdout.write(md);
  if (o.csv) fs.writeFileSync(o.csv, ['lot;groupe;cut;type;reference;reglage;refVeriteMm;reglageVeriteMm;deplacementMm;N;refusN', ...R.changes.map(c => [c.lot, c.groupe, c.cut, c.type, c.avant, c.apres, f1(c.pb), f1(c.pn), f1(c.dep), c.nJuge, c.refusN || ''].join(';'))].join('\n') + '\n');
  if (o.json) fs.writeFileSync(o.json, JSON.stringify({ cuts: R.cuts, identiques: R.identiques, groupes: R.groupes, changes: R.changes }, null, 1));
}
main();
