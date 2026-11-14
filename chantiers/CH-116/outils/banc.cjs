#!/usr/bin/env node
'use strict';
/* CH-116 : banc d'évaluation « GCV2.1 » (D-351). Hors ligne, lecture seule ; rien n'est commandé dans ESV ; aucun fichier de l'extension modifié.
 * Rejoue le VRAI code (tools/banc-differes.cjs rejouer, profil livré L1-se) sur tout le corpus jugé, avec un patch et/ou un réglage, et juge
 * contre le corpus (corpus.jsonl de corpus.cjs). Variables : CH116_TRAVAIL (dossier local, voir lots.cjs), CH116_CORPUS (corpus.jsonl).
 *
 *   node chantiers/CH-116/outils/banc.cjs rejouer  --nom N [--patch P.patch …] [--env CLE=VALEUR …] [--lots 1111,1211] [--jobs 3] [--refaire]
 *        Sans patch : le code du dépôt tel quel. Avec patch : copie de HEAD (git archive) dans travail/copies/N, patchs appliqués (git apply).
 *        `--env` passe des variables au rejeu (ex. BANC_LEVIERS='{"…":…}' pour un patch qui les lit). Sortie : travail/rejeux/N/<clé>.jsonl.
 *   node chantiers/CH-116/outils/banc.cjs juger    --nom N [--ref livre] [--lots …] [--avec-courtes] [--json S.json] [--csv PAR-CUT.csv]
 *        (`--avec-courtes` : juge aussi les cuts écartés par D-285, visites et validations sans mouvement de moins de 1,5 s)
 *        Tableau standard par lot : posés jugés, ≤ 10 mm, 10–50, > 50 (mauvaise voie), différés, différés reposés justes / faux, bons bloqués ;
 *        avec `--ref`, les cuts qui changent de classe contre le rejeu de référence.
 *   node chantiers/CH-116/outils/banc.cjs fidelite --nom livre [--lots …]
 *        Décisions et poses du rejeu identiques au lot réel (même état ; pose à 1 mm au plus, pire rail 3D), lot par lot, écarts listés.
 *   node chantiers/CH-116/outils/banc.cjs garde    --nom N [--patch P.patch …] [--env BANC_LEVIERS=JSON] [--jobs 3] [--refaire]
 *        Garde d'octobre au banc (premier filtre rapide) : les 12 lots de datasets/garde-gcv2/base-test18.json rejoués comme `garde-gcv2 --rejouer`
 *        (profils base et L1-se, --chrono, --juger-partie-reservee), leviers = ceux de la base (deuxième passe livrée) + ceux du réglage, en parallèle ;
 *        puis `garde-gcv2 comparer` sur ces rejeux. Lots : BANANE_LOTS (défaut travail/oct/lots). Sortie : travail/garde/N/ (garde.md, garde.json, resume.txt) ;
 *        reculs RÉELS (juste dégradé, faute nouvelle, décision changée) séparés des « verts changés ». Retour : celui de la garde.
 *   node chantiers/CH-116/outils/banc.cjs croise   --noms a,b,c [--ref livre] [--poids JSON] [--examen 0511|aucun]
 *        Validation croisée par lot : pour chaque lot hors examen, le réglage choisi (coût minimal) sur TOUS LES AUTRES lots hors examen,
 *        jugé sur celui-là. Puis examen : réglage choisi sur tous les lots hors examen, jugé sur les lots d'examen (jamais vus au réglage).
 *        Coût par défaut : 100·(> 50) + 10·(10–50) + 5·(bons bloqués) + 1·(différés).
 * Juge unique (tools/juge-poses-faux.cjs) : écart = pire des deux rails, distance 3D, contre la pose finale de l'opérateur ; juste ≤ 10 mm ;
 * mauvaise voie > 50 mm. Sorties : comptes, millimètres, numéros de cut. */
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const RACINE = path.join(__dirname, '..', '..', '..');
const { LOTS, cle, travail } = require('./lots.cjs');
const PROFIL = 'L1-se';
const POIDS = { plus50: 100, d1050: 10, bloques: 5, differes: 1 };
const SIDES = ['left', 'right'];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pire = (p, q) => Math.max(dist(p.left, q.left), dist(p.right, q.right));
const classe = e => e <= 10 ? 'juste' : e <= 50 ? '10-50' : 'plus-50';
const lireJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
const fichierCorpus = () => process.env.CH116_CORPUS || path.join(travail(), 'corpus.jsonl');

function args(a) {
  const o = { patch: [], env: {}, jobs: 3, lots: null, refaire: false };
  o.mode = a[0];
  for (let i = 1; i < a.length; i++) {
    const k = a[i], v = () => a[++i];
    if (k === '--nom') o.nom = v(); else if (k === '--noms') o.noms = v().split(','); else if (k === '--patch') o.patch.push(path.resolve(v()));
    else if (k === '--env') { const s = v(), j = s.indexOf('='); o.env[s.slice(0, j)] = s.slice(j + 1); }
    else if (k === '--lots') o.lots = v().split(','); else if (k === '--jobs') o.jobs = Number(v()); else if (k === '--refaire') o.refaire = true; else if (k === '--avec-courtes') o.avecCourtes = true;
    else if (k === '--ref') o.ref = v(); else if (k === '--json') o.json = v(); else if (k === '--csv') o.csv = v();
    else if (k === '--poids') o.poids = { ...POIDS, ...JSON.parse(v()) }; else if (k === '--examen') o.examen = v();
    else throw Error('option inconnue ' + k);
  }
  return o;
}
/* Les lots vierges (examen tenu à l'écart) ne sont rejoués et jugés que nommés par --lots. */
const entrees = o => LOTS.filter(e => o.lots ? o.lots.includes(e.lot) : !e.vierge);
const meta = e => JSON.parse(fs.readFileSync(path.join(travail(), 'meta', cle(e) + '.json'), 'utf8'));
const dossierRejeux = nom => path.join(travail(), 'rejeux', nom);

/* ------------------------------------------------------------------ rejouer */
/* CH116_CODE : dossier de code déjà composé (arbre d'une autre branche + patch), rejoué tel quel ; prioritaire sur --patch. */
function copieDuCode(o) {
  if (process.env.CH116_CODE) return path.resolve(process.env.CH116_CODE);
  if (!o.patch.length) return RACINE;
  const d = path.join(travail(), 'copies', o.nom);
  fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true });
  cp.execSync(`git -C "${RACINE}" archive HEAD | tar -x -C "${d}"`);
  for (const p of o.patch) cp.execFileSync('git', ['apply', p], { cwd: d, stdio: 'inherit' });
  return d;
}
async function rejouer(o) {
  if (!o.nom) throw Error('rejouer --nom N');
  const code = copieDuCode(o), out = dossierRejeux(o.nom); fs.mkdirSync(out, { recursive: true });
  const reglage = { nom: o.nom, patchs: o.patch.map(p => ({ fichier: path.basename(p), sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') })), env: o.env, profil: PROFIL };
  fs.writeFileSync(path.join(out, 'reglage.json'), JSON.stringify(reglage, null, 1));
  const file = entrees(o).filter(e => o.refaire || !fs.existsSync(path.join(out, cle(e) + '.jsonl')));
  /* les plus gros d'abord */
  file.sort((a, b) => meta(b).cutsLot - meta(a).cutsLot);
  let actifs = 0, i = 0, echecs = 0; const t0 = Date.now();
  await new Promise(fin => {
    const suivant = () => {
      if (i >= file.length && actifs === 0) return fin();
      while (actifs < o.jobs && i < file.length) {
        const e = file[i++], m = meta(e), sortie = path.join(out, cle(e) + '.jsonl');
        const a = ['--max-old-space-size=6144', path.join(code, 'tools', 'banc-differes.cjs'), 'rejouer', '--partie', '1:' + e.partie, '--journal', m.journal,
          ...[].concat(m.captures).flatMap(c => ['--corpus', c]), '--lot', m.lotId, '--profils', PROFIL, '--sortie', sortie + '.part'];
        /* CH116_LISTES : dossier de listes de remplacement (<clé>.json, ex. liste du départ reconstituée) ; sinon la liste exportée du lot. */
        const lr = process.env.CH116_LISTES ? path.join(process.env.CH116_LISTES, cle(e) + '.json') : null;
        if (lr && fs.existsSync(lr)) a.push('--liste', lr); else if (m.liste) a.push('--liste', m.liste);
        actifs++;
        const p = cp.spawn(process.execPath, a, { env: { ...process.env, ...o.env }, stdio: ['ignore', 'pipe', 'pipe'] });
        let err = '', sout = ''; p.stderr.on('data', d => { err += d; }); p.stdout.on('data', d => { sout += d; });
        p.on('close', code_ => {
          actifs--;
          if (code_ === 0) { fs.renameSync(sortie + '.part', sortie); process.stdout.write(`${cle(e)} : ${sout.trim().replace(/lot \S+ /, '')}\n`); }
          else { echecs++; process.stdout.write(`${cle(e)} : ÉCHEC\n${err.slice(-2000)}\n`); }
          suivant();
        });
      }
    };
    suivant();
  });
  process.stdout.write(`rejeu « ${o.nom} » : ${file.length} lot(s)-partie(s), ${echecs} échec(s), ${Math.round((Date.now() - t0) / 1000)} s\n`);
  if (echecs) process.exitCode = 1;
}

/* ------------------------------------------------------------------ juger */
function chargerCorpus() {
  const m = new Map();
  for (const l of lireJsonl(fichierCorpus())) m.set(`${l.lot}-p${l.partie}-r${l.rang}:${l.cut}`, l);
  return m;
}
function poseProfil(l) { const x = l.profils && l.profils[PROFIL]; return x && x.etat === 'pose' && x.decal ? x.decal : null; }
const vide = () => ({ cuts: 0, poses: 0, posesJuges: 0, juste: 0, '10-50': 0, 'plus-50': 0, differes: 0, differesJuges: 0, reposesJustes: 0, reposesFaux: 0, bonsBloques: 0,
  liste50: [], liste1050: [], listeReposesFaux: [], listeBloques: [] });
/* Juge un rejeu contre le corpus : rend { parLot: {lot: tableau}, total, parCut: [...] }. Les cuts du rejeu absents du corpus sont non jugés. */
function juger(nom, o) {
  const C = chargerCorpus(), parLot = {}, total = vide(), parCut = [];
  for (const e of entrees(o)) {
    const f = path.join(dossierRejeux(nom), cle(e) + '.jsonl');
    if (!fs.existsSync(f)) continue;
    const T = (parLot[e.lot] = parLot[e.lot] || vide());
    for (const l of lireJsonl(f).filter(x => x.type === 'cut')) {
      const c = C.get(`${cle(e)}:${l.cut}`); if (!c) continue;
      const pose = poseProfil(l), juge = c.poseFinale && (!c.exclu || (o.avecCourtes && /^d285-/.test(c.exclu)));
      const r = { cle: cle(e), lot: e.lot, partie: e.partie, cut: l.cut, sortLot: c.sortLot, classeLot: c.classe, etat: pose ? 'pose' : 'differe', mm: null, classe: null };
      for (const t of [T, total]) t.cuts++;
      if (pose) {
        for (const t of [T, total]) t.poses++;
        if (juge) {
          r.mm = Math.round(pire(pose, c.poseFinale) * 10) / 10; r.classe = classe(r.mm);
          for (const t of [T, total]) {
            t.posesJuges++; t[r.classe]++;
            if (r.classe === 'plus-50') t.liste50.push(`${e.partie}/${l.cut}`); if (r.classe === '10-50') t.liste1050.push(`${e.partie}/${l.cut}`);
            if (c.sortLot === 'differe') { if (r.classe === 'juste') t.reposesJustes++; else { t.reposesFaux++; t.listeReposesFaux.push(`${e.partie}/${l.cut}`); } }
          }
        }
      } else {
        for (const t of [T, total]) { t.differes++; if (juge) t.differesJuges++; }
        if (juge && c.sortLot === 'pose' && c.classe === 'juste') for (const t of [T, total]) { t.bonsBloques++; t.listeBloques.push(`${e.partie}/${l.cut}`); }
      }
      parCut.push(r);
    }
  }
  return { parLot, total, parCut };
}
const cout = (t, w) => w.plus50 * t['plus-50'] + w.d1050 * t['10-50'] + w.bloques * t.bonsBloques + w.differes * t.differes;
const somme = ts => ts.reduce((a, t) => { for (const k of Object.keys(a)) a[k] = Array.isArray(a[k]) ? a[k].concat(t[k]) : a[k] + t[k]; return a; }, vide());
const ENTETE = '| lot | cuts | posés | jugés | ≤ 10 | 10–50 | > 50 | différés (jugés) | reposés justes / faux | bons bloqués |\n|---|---|---|---|---|---|---|---|---|---|';
const ligne = (n, t) => `| ${n} | ${t.cuts} | ${t.poses} | ${t.posesJuges} | ${t.juste} | ${t['10-50']} | ${t['plus-50']} | ${t.differes} (${t.differesJuges}) | ${t.reposesJustes} / ${t.reposesFaux} | ${t.bonsBloques} |`;
function tableau(J) {
  const out = [ENTETE, ...Object.entries(J.parLot).map(([k, t]) => ligne(k, t)), ligne('**total**', J.total)];
  if (J.total.liste50.length) out.push('', `> 50 mm : ${J.total.liste50.join(' ')}`);
  if (J.total.listeReposesFaux.length) out.push(`reposés faux : ${J.total.listeReposesFaux.join(' ')}`);
  if (J.total.listeBloques.length) out.push(`bons bloqués : ${J.total.listeBloques.join(' ')}`);
  return out.join('\n');
}
function changements(J, R) {
  const ref = new Map(R.parCut.map(r => [`${r.cle}:${r.cut}`, r])), out = [];
  for (const r of J.parCut) { const q = ref.get(`${r.cle}:${r.cut}`); if (q && (q.etat !== r.etat || q.classe !== r.classe || (r.mm != null && q.mm != null && Math.abs(r.mm - q.mm) > 1))) out.push({ lot: r.lot, partie: r.partie, cut: r.cut, avant: `${q.etat}${q.mm != null ? ' ' + q.mm + ' mm' : ''}`, apres: `${r.etat}${r.mm != null ? ' ' + r.mm + ' mm' : ''}` }); }
  return out;
}

/* ------------------------------------------------------------------ fidélité */
function fidelite(nom, o) {
  const res = {};
  for (const e of entrees(o)) {
    const f = path.join(dossierRejeux(nom), cle(e) + '.jsonl'); if (!fs.existsSync(f)) continue;
    const r = (res[cle(e)] = { cuts: 0, decisionsId: 0, poses: 0, posesId: 0, ecarts: [] });
    for (const l of lireJsonl(f).filter(x => x.type === 'cut')) {
      r.cuts++; const re = l.reel || {}, x = (l.profils || {})[PROFIL] || {}, rp = !!re.pose, xp = x.etat === 'pose';
      if (rp !== xp) { r.ecarts.push(`${l.cut} : réel ${rp ? 'posé (' + re.etage + ')' : 'différé (' + (re.motif || re.etage) + ')'}, rejeu ${x.etat} (${x.etage || x.source || ''})`); continue; }
      r.decisionsId++; if (!rp) continue; r.poses++;
      if (!re.decal || !x.decal) { if (x.source === 'reel-sans-nuage') r.posesId++; else r.ecarts.push(`${l.cut} : pose sans décalage`); continue; }
      const d = pire(re.decal, x.decal);
      if (d <= 1) r.posesId++; else r.ecarts.push(`${l.cut} : pose à ${d.toFixed(1)} mm du réel (étage réel ${re.etage}, rejeu ${x.etage || x.source})`);
    }
  }
  return res;
}

/* ------------------------------------------------------------------ validation croisée */
function croise(o) {
  if (!o.noms || !o.noms.length) throw Error('croise --noms a,b,c');
  const w = o.poids || POIDS, J = Object.fromEntries(o.noms.map(n => [n, juger(n, o)]));
  const lots = [...new Set(entrees(o).map(e => e.lot))];
  const examen = o.examen === 'aucun' ? [] : o.examen ? o.examen.split(',') : [...new Set(entrees(o).filter(e => e.examen).map(e => e.lot))];
  const reglables = lots.filter(l => !examen.includes(l)), out = [];
  const tab = (n, l) => J[n].parLot[l] || vide();
  const choisir = sur => o.noms.map(n => ({ n, c: sur.reduce((s, l) => s + cout(tab(n, l), w), 0) })).sort((a, b) => a.c - b.c)[0].n;
  out.push(`Validation croisée par lot (${reglables.length} lots réglables ; examen : ${examen.join(', ') || 'aucun'}) ; coût = ${JSON.stringify(w)}`, '', '| lot jugé | réglage choisi sur les autres | ' + ENTETE.split('\n')[0].slice(8), '|---|---|---|---|---|---|---|---|---|---|---|');
  const tenus = [], refs = [];
  for (const l of reglables) {
    const n = choisir(reglables.filter(x => x !== l)), t = tab(n, l); tenus.push(t); if (o.ref) refs.push(tab(o.ref, l));
    out.push(`| ${l} | ${n} ${ligne('', t).slice(3)}`);
  }
  out.push(`| **total tenu à l'écart** | | ${ligne('', somme(tenus)).slice(5)}`);
  if (o.ref) out.push(`| **référence ${o.ref}, mêmes lots** | | ${ligne('', somme(refs)).slice(5)}`);
  if (examen.length) {
    const n = choisir(reglables), te = somme(examen.map(l => tab(n, l)));
    out.push('', `Examen : réglage choisi sur les ${reglables.length} lots réglables = « ${n} », jugé sur ${examen.join(', ')} :`, '', ENTETE, ligne(n, te));
    if (o.ref) out.push(ligne(o.ref, somme(examen.map(l => tab(o.ref, l)))));
  }
  return out.join('\n');
}

/* ------------------------------------------------------------------ garde d'octobre */
const BASE_GARDE = path.join(RACINE, 'datasets', 'garde-gcv2', 'base-test18.json');
async function garde(o) {
  if (!o.nom) throw Error('garde --nom N');
  const base = JSON.parse(fs.readFileSync(BASE_GARDE, 'utf8')), BL = process.env.BANANE_LOTS || path.join(travail(), 'oct', 'lots');
  const reglage = o.env.BANC_LEVIERS ? JSON.parse(o.env.BANC_LEVIERS) : {}, leviers = { ...(base.banc.leviers || {}), ...reglage };
  const code = copieDuCode({ ...o, nom: 'garde-' + o.nom }), out = path.join(travail(), 'garde', o.nom); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'reglage.json'), JSON.stringify({ nom: o.nom, patchs: o.patch.map(p => ({ fichier: path.basename(p), sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') })), leviers }, null, 1));
  const file = base.lots.filter(l => o.refaire || !fs.existsSync(path.join(out, `r-${l.nom}.jsonl`))).sort((a, b) => b.fichiers.corpus.length - a.fichiers.corpus.length);
  let actifs = 0, i = 0, echecs = 0; const t0 = Date.now();
  await new Promise(fin => {
    const suivant = () => {
      if (i >= file.length && actifs === 0) return fin();
      while (actifs < o.jobs && i < file.length) {
        const l = file[i++], d = path.join(BL, l.nom), F = l.fichiers, sortie = path.join(out, `r-${l.nom}.jsonl`);
        const a = ['--max-old-space-size=6144', path.join(code, 'tools', 'banc-differes.cjs'), 'rejouer', '--partie', l.bancPartie || l.partie, '--journal', path.join(d, F.journal),
          ...(F.corpus || []).flatMap(c => ['--corpus', path.join(d, c)]), '--lot', l.lot, '--profils', 'base,L1-se', ...(F.liste ? ['--liste', path.join(d, F.liste)] : []),
          '--juger-partie-reservee', '--chrono', '--sortie', sortie + '.part'];
        actifs++;
        const p = cp.spawn(process.execPath, a, { env: { ...process.env, ...o.env, BANC_LEVIERS: JSON.stringify(leviers) }, stdio: ['ignore', 'ignore', 'pipe'] });
        let err = ''; p.stderr.on('data', x => { err += x; });
        p.on('close', c => { actifs--; if (c === 0) fs.renameSync(sortie + '.part', sortie); else { echecs++; process.stdout.write(`${l.nom} : ÉCHEC\n${err.slice(-1500)}\n`); } suivant(); });
      }
    };
    suivant();
  });
  if (echecs) throw Error(`${echecs} rejeu(x) en échec`);
  const g = cp.spawnSync(process.execPath, [path.join(RACINE, 'tools', 'garde-gcv2.cjs'), 'comparer', '--base', BASE_GARDE, '--rejeux', out, '--sortie', out], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const rap = JSON.parse(fs.readFileSync(path.join(out, 'garde.json'), 'utf8'));
  const verts = r => /vert\(s\) changé\(s\)|verts changés/.test(r), reels = rap.reculs.filter(r => !verts(r)), vc = rap.reculs.filter(verts);
  const res = [`garde d'octobre au banc, réglage « ${o.nom} » : retour ${g.status} ; ${rap.reculs.length} recul(s) dont ${reels.length} RÉEL(S) et ${vc.length} « verts changés » ; rejeux ${Math.round((Date.now() - t0) / 1000)} s`,
    ...reels.map(r => '  réel : ' + r), ...vc.map(r => '  verts changés : ' + r), ...rap.signalements.map(s => '  signalé : ' + s)].join('\n');
  fs.writeFileSync(path.join(out, 'resume.txt'), res + '\n'); process.stdout.write(res + '\n');
  process.exitCode = g.status;
}

async function main() {
  const o = args(process.argv.slice(2));
  if (o.mode === 'garde') return garde(o);
  if (o.mode === 'rejouer') return rejouer(o);
  if (o.mode === 'juger') {
    if (!o.nom) throw Error('juger --nom N'); const J = juger(o.nom, o);
    process.stdout.write(`Rejeu « ${o.nom} » contre le corpus (${fichierCorpus()}) :\n\n${tableau(J)}\n`);
    if (o.ref) { const ch = changements(J, juger(o.ref, o)); process.stdout.write(`\nChangements contre « ${o.ref} » : ${ch.length}\n${ch.map(c => `  ${c.lot} p${c.partie}/${c.cut} : ${c.avant} → ${c.apres}`).join('\n')}\n`); }
    if (o.json) fs.writeFileSync(o.json, JSON.stringify({ parLot: J.parLot, total: J.total }, null, 1));
    if (o.csv) fs.writeFileSync(o.csv, ['cle;cut;sortLot;classeLot;etat;mm;classe', ...J.parCut.map(r => [r.cle, r.cut, r.sortLot, r.classeLot, r.etat, r.mm ?? '', r.classe ?? ''].join(';'))].join('\n') + '\n');
    return;
  }
  if (o.mode === 'fidelite') {
    const F = fidelite(o.nom || 'livre', o); let n = 0, d = 0, p = 0, pi = 0;
    for (const [k, r] of Object.entries(F)) {
      n += r.cuts; d += r.decisionsId; p += r.poses; pi += r.posesId;
      process.stdout.write(`${k} : décisions identiques ${r.decisionsId}/${r.cuts} ; poses identiques à 1 mm ${r.posesId}/${r.poses}\n${r.ecarts.map(x => '    ' + x).join('\n')}${r.ecarts.length ? '\n' : ''}`);
    }
    process.stdout.write(`TOTAL : décisions identiques ${d}/${n} (${(100 * d / n).toFixed(1)} %) ; poses identiques ${pi}/${p} (${(100 * pi / p).toFixed(1)} %)\n`);
    if (o.json) fs.writeFileSync(o.json, JSON.stringify(F, null, 1));
    return;
  }
  if (o.mode === 'croise') { process.stdout.write(croise(o) + '\n'); return; }
  throw Error('mode : rejouer | juger | fidelite | croise | garde');
}
module.exports = { juger, fidelite, croise, cout, POIDS, PROFIL };
if (require.main === module) main().catch(e => { process.stderr.write('banc : ' + e.message + '\n'); process.exitCode = 1; });
