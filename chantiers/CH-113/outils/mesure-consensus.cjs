/* CH-113 — poses du chemin « consensus » de la GCV2 (L1-e) dans un rejeu du banc, jugées contre la vérité d'Écho, selon les voisins posés
 * plus tôt par le même profil : nombre à `fenetre` cuts au plus en arrière, écart (en cuts) au plus récent, source du plus récent (chaîne ou GCV2).
 *   node chantiers/CH-113/outils/mesure-consensus.cjs --rejeu R.jsonl --verite V.json [--rejeu … --verite …] [--motif consensus] [--fenetre 12]
 * Des comptes et des millimètres seulement. */
'use strict';
const fs = require('fs'); const a = process.argv.slice(2), R = [], V = []; let motif = 'consensus', F = 12;
for (let i = 0; i < a.length; i++) { if (a[i] === '--rejeu') R.push(a[++i]); else if (a[i] === '--verite') V.push(a[++i]); else if (a[i] === '--motif') motif = a[++i]; else if (a[i] === '--fenetre') F = +a[++i]; }
const d = (x, y) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
const groupes = {};
for (let k = 0; k < R.length; k++) {
  const L = fs.readFileSync(R[k], 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(x => x.type === 'cut');
  const v0 = JSON.parse(fs.readFileSync(V[k], 'utf8')), ver = v0.verite || v0; const poses = [];
  for (const l of L) {
    const x = l.profils['L1-se'];
    if (x && x.etat === 'pose' && x.l1 && x.l1.motif === motif) {
      const av = poses.filter(q => l.cut - q.cut > 0 && l.cut - q.cut <= F), recent = av.length ? av[av.length - 1] : null;
      const mic = ver[l.cut] && ver[l.cut].mic, e = mic ? Math.max(d(x.decal.left, mic.left), d(x.decal.right, mic.right)) : null;
      const nouv = av.filter(q => q.src === 'gcv2').length;
      const cle = `voisins ${av.length >= 3 ? '3+' : av.length} · dont GCV2 ${nouv >= 2 ? '2+' : nouv} · plus récent ${recent ? (l.cut - recent.cut <= 2 ? '≤2' : '3-12') + ' cuts, ' + recent.src : 'aucun'}`;
      const g = (groupes[cle] = groupes[cle] || { n: 0, juges: 0, juste: 0, '10-50': 0, 'plus-50': 0, cuts: [] });
      g.n++; if (e != null) { g.juges++; g[e <= 10 ? 'juste' : e <= 50 ? '10-50' : 'plus-50']++; } g.cuts.push(`${l.partie}/${l.cut}${e == null ? '' : ':' + e.toFixed(1)}`);
    }
    if (x && x.etat === 'pose') poses.push({ cut: l.cut, src: x.source === 'gcv2' ? 'gcv2' : 'chaine' });
  }
}
let T = { n: 0, juges: 0, juste: 0, '10-50': 0, 'plus-50': 0 };
for (const [c, g] of Object.entries(groupes).sort()) { console.log(`${c} : ${g.n} poses, jugées ${g.juges} (≤10 ${g.juste}, 10-50 ${g['10-50']}, >50 ${g['plus-50']})\n   ${g.cuts.join(' ')}`); for (const k of Object.keys(T)) T[k] += g[k]; }
console.log(`TOTAL « ${motif} » : ${T.n} poses, jugées ${T.juges} (≤10 ${T.juste}, 10-50 ${T['10-50']}, >50 ${T['plus-50']})`);
