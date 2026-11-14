#!/usr/bin/env node
'use strict';
/* CH-125 (audit 5, R6 étendue à tous les leviers) : sur les lots d'octobre de la garde, chaque cut dont la pose ou l'état du profil L1-se change entre
 * le rejeu à l'éteint et le rejeu d'un réglage, jugé contre la vérité scellée : pose de base, pose nouvelle, vérité. Hors ligne, lecture seule.
 *   node chantiers/CH-125/outils/oct-poses.cjs --a REJEUX_ETEINT --b REJEUX_REGLAGE [--seuil 0.5] [--nommes "2-17 9803,2-20-fd7067f7 288"] [--csv PAR-CUT.csv]
 * `--a`, `--b` : dossiers de `banc.cjs garde` (r-<lot>.jsonl). Un cut est TOUCHÉ quand la mesure a agi sur lui au rejeu du réglage : `mesureSource`
 * (calage à la source), `l1.flanc.avant` (flanc de la paire validée, pose de la décision remplacée) ou `flancEcrit.avant` (paire mesurée écrite, décision
 * gardée) ; tout autre changement est un RICOCHET.
 * Écart = pire rail, 3D, à la vérité (datasets/garde-gcv2/verites/) ; les vérités « visité sans action » sont marquées. `--nommes` : cuts donnés un
 * par un, changés ou non. Sorties : comptes, millimètres, numéros de cut. */
const fs = require('node:fs'), path = require('node:path');
const RACINE = path.join(__dirname, '..', '..', '..');
const a = process.argv.slice(2), o = { seuil: 0.5, nommes: [] };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--a') o.a = v(); else if (k === '--b') o.b = v(); else if (k === '--seuil') o.seuil = Number(v()); else if (k === '--nommes') o.nommes = v().split(',').map(s => s.trim()).filter(Boolean); else if (k === '--csv') o.csv = v(); else throw Error('option inconnue ' + k); }
if (!o.a || !o.b) throw Error('--a REJEUX_ETEINT --b REJEUX_REGLAGE');
const base = JSON.parse(fs.readFileSync(path.join(RACINE, 'datasets', 'garde-gcv2', 'base-test18.json'), 'utf8'));
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut');
const SIDES = ['left', 'right'], pire = (p, q) => Math.max(...SIDES.map(s => Math.hypot(p[s][0] - q[s][0], p[s][1] - q[s][1], p[s][2] - q[s][2])));
const r1 = v => v == null || !Number.isFinite(v) ? '-' : (Math.round(v * 10) / 10).toFixed(1), med = v => { if (!v.length) return null; const s = v.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const P = 'L1-se', pose = x => x && x.etat === 'pose' && x.decal ? x.decal : null;
/* flanc agi : la paire de la décision a été remplacée (`l1.flanc.avant`, propagation « A ») ou la paire mesurée a été écrite (`flancEcrit.avant`, « B ») */
const flancAgi = y => { const f = y && ((y.l1 && y.l1.flanc) || (y.passe2 && y.passe2.l1 && y.passe2.l1.flanc)); return !!((f && f.avant) || (y && y.flancEcrit && y.flancEcrit.avant)); };
const rows = [], nommes = new Map(o.nommes.map(n => [n, null]));
let cuts = 0, posesA = 0;
for (const l of base.lots) {
  const fa = path.join(o.a, `r-${l.nom}.jsonl`), fb = path.join(o.b, `r-${l.nom}.jsonl`); if (!fs.existsSync(fa) || !fs.existsSync(fb)) { process.stdout.write(`lot absent : ${l.nom}\n`); continue; }
  const V = JSON.parse(fs.readFileSync(path.join(RACINE, 'datasets', 'garde-gcv2', 'verites', l.verite), 'utf8')), B = new Map(lire(fb).map(x => [x.cut, x]));
  for (const la of lire(fa)) {
    const lb = B.get(la.cut); if (!lb) continue; cuts++;
    const ya = la.profils[P], yb = lb.profils[P], pa = pose(ya), pb = pose(yb), id = `${l.nom} ${la.cut}`; if (pa) posesA++;
    const v = V[la.cut], vr = v && v.mic ? v.mic : null, visite = !!(v && /visite-bon/.test(v.src || ''));
    const touche = !!lb.mesureSource || flancAgi(yb), d = pa && pb ? pire(pa, pb) : null;
    const change = (!!pa) !== (!!pb) || (d !== null && d > o.seuil);
    const row = { id, groupe: l.groupe, zone: lb.zone || la.zone || '', source: (yb && yb.source) || (ya && ya.source) || '', motif: (yb && yb.l1 && yb.l1.motif) || (ya && ya.l1 && ya.l1.motif) || '', touche, flanc: flancAgi(yb),
      etatA: ya ? ya.etat : '-', etatB: yb ? yb.etat : '-', d, ea: pa && vr ? pire(pa, vr) : null, eb: pb && vr ? pire(pb, vr) : null, verite: vr ? (visite ? 'visité sans action' : 'validation') : 'aucune', visite };
    if (nommes.has(id)) nommes.set(id, { ...row, change });
    if (change) rows.push(row);
  }
}
const juge = r => r.verite !== 'aucune', deplace = r => r.d !== null && r.d > o.seuil;
const bilan = (titre, L) => {
  const D = L.filter(deplace), J = D.filter(juge), mieux = J.filter(r => r.eb < r.ea - 0.5), pireL = J.filter(r => r.eb > r.ea + 0.5), deg2 = J.filter(r => r.eb > r.ea + 2), perdus = J.filter(r => r.ea <= 10 && r.eb > 10), gagnes = J.filter(r => r.ea > 10 && r.eb <= 10);
  const etats = L.filter(r => r.etatA !== r.etatB), nouv = etats.filter(r => r.etatB === 'pose' && r.eb !== null), nouvMal = nouv.filter(r => r.eb > 10);
  return [`### ${titre} : ${L.length} cut(s) changé(s)`,
    `- poses déplacées de plus de ${o.seuil} mm : ${D.length} (médiane ${r1(med(D.map(r => r.d)))} mm, maximum ${D.length ? r1(Math.max(...D.map(r => r.d))) : '-'}) ; jugées contre la vérité : ${J.length} (dont ${J.filter(r => r.visite).length} « visité sans action »)`,
    `- rapprochées ${mieux.length}, éloignées ${pireL.length}, égales ${J.length - mieux.length - pireL.length} ; médiane de l'écart ${r1(med(J.map(r => r.ea)))} → ${r1(med(J.map(r => r.eb)))} mm`,
    /* une pose que l'opérateur a validée telle quelle (écart de base de 2 mm au plus) a pour vérité la pose d'Ariane : la déplacer l'éloigne par construction */
    `- dont poses RETOUCHÉES par l'opérateur (écart de base > 2 mm) : ${J.filter(r => r.ea > 2).length}, rapprochées ${mieux.filter(r => r.ea > 2).length}, éloignées ${pireL.filter(r => r.ea > 2).length} ; poses validées telles quelles (écart de base ≤ 2 mm) : ${J.filter(r => r.ea <= 2).length}, déplacées de ${J.filter(r => r.ea <= 2).map(r => r1(r.d)).join(', ') || '-'} mm`,
    `- dégradées de plus de 2 mm : ${deg2.length}${deg2.length ? ' : ' + deg2.map(r => `${r.id} ${r1(r.ea)}→${r1(r.eb)}`).join(' ; ') : ''}`,
    `- justes passés au-delà de 10 mm : ${perdus.length}${perdus.length ? ' : ' + perdus.map(r => `${r.id} ${r1(r.ea)}→${r1(r.eb)}`).join(' ; ') : ''} ; gagnés : ${gagnes.length}${gagnes.length ? ' : ' + gagnes.map(r => `${r.id} ${r1(r.ea)}→${r1(r.eb)}`).join(' ; ') : ''}`,
    `- états changés : ${etats.length}${etats.length ? ' : ' + etats.map(r => `${r.id} ${r.etatA}→${r.etatB}${r.etatB === 'pose' && r.eb !== null ? ' (' + r1(r.eb) + ' mm de la vérité)' : r.etatA === 'pose' && r.ea !== null ? ' (était à ' + r1(r.ea) + ' mm)' : ''}`).join(' ; ') : ''}`,
    `- poses nouvelles jugées à plus de 10 mm : ${nouvMal.length}${nouvMal.length ? ' : ' + nouvMal.map(r => `${r.id} ${r1(r.eb)}`).join(' ; ') : ''}`].join('\n');
};
const T = rows.filter(r => r.touche), Rc = rows.filter(r => !r.touche);
const out = [`Lots d'octobre de la garde : ${cuts} cuts, ${posesA} posés par le profil ${P} à l'éteint ; ${rows.length} cut(s) changé(s) par le réglage (${T.length} touché(s) par la mesure, ${Rc.length} par ricochet).`, '',
  bilan('Cuts TOUCHÉS par la mesure', T), '', bilan('RICOCHETS (cuts non touchés)', Rc), '',
  '### Chaque cut changé : pose de base, pose nouvelle, vérité', '| cut | zone | source, motif | touché | état | déplacement (mm) | écart à la vérité : base → nouvelle (mm) | vérité |', '|---|---|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.id} | ${r.zone} | ${r.source}${r.motif ? ', ' + r.motif : ''} | ${r.touche ? (r.flanc ? 'flanc' : 'oui') : 'ricochet'} | ${r.etatA === r.etatB ? r.etatA : r.etatA + ' → ' + r.etatB} | ${r1(r.d)} | ${r1(r.ea)} → ${r1(r.eb)} | ${r.verite} |`)];
if (o.nommes.length) out.push('', '### Cuts nommés d\'avance', ...[...nommes.entries()].map(([n, r]) => r ? `- ${n} : ${r.change ? 'CHANGÉ' : 'inchangé'}${r.touche ? ', touché' : ''} ; état ${r.etatA}${r.etatA === r.etatB ? '' : ' → ' + r.etatB} ; écart à la vérité ${r1(r.ea)} → ${r1(r.eb)} mm (${r.verite})` : `- ${n} : absent des rejeux`));
process.stdout.write(out.join('\n') + '\n');
if (o.csv) fs.writeFileSync(o.csv, ['lot_cut;groupe;zone;source;motif;touche;etat_avant;etat_apres;deplacement_mm;ecart_avant;ecart_apres;verite', ...rows.map(r => [r.id, r.groupe, r.zone, r.source, r.motif, r.touche ? (r.flanc ? 'flanc' : 'oui') : 'ricochet', r.etatA, r.etatB, r1(r.d), r1(r.ea), r1(r.eb), r.verite].join(';'))].join('\n') + '\n');
