#!/usr/bin/env node
'use strict';
/* CH-116 : préparation hors ligne des lots du corpus (lecture seule des exports extraits par extraire.sh).
 *   CH116_TRAVAIL=… node chantiers/CH-116/outils/preparer.cjs [--lots 1111,1211] [--effacer-segments]
 * Pour chaque (lot, partie, rang) de lots.cjs : retrouve le lot dans le journal, réduit les captures du corpus du lot aux seuls cuts du lot
 * (travail/captures/<clé>.json), fait la jointure Écho ↔ journal (tools/jointure-echo-orbite.cjs, visites sans action retenues à 0,8 s ; corpus.cjs marque celles de moins de 1,5 s, D-285)
 * (travail/j/<clé>.json), et écrit travail/meta/<clé>.json (chemins locaux et identifiant du lot : hors dépôt).
 * `--effacer-segments` efface les segments bruts du corpus une fois réduits (disque limité). */
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const RACINE = path.join(__dirname, '..', '..', '..');
const D = require(path.join(RACINE, 'tools', 'diag-differes.cjs'));
const { LOTS, cle, travail } = require('./lots.cjs');

function args(a) {
  const o = { lots: null, effacer: false };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--lots') o.lots = a[++i].split(','); else if (a[i] === '--effacer-segments') o.effacer = true; else throw Error('option inconnue ' + a[i]);
  }
  return o;
}
const fichiers = (d, re) => fs.existsSync(d) ? fs.readdirSync(d).filter(f => re.test(f)).sort().map(f => path.join(d, f)) : [];

function preparerDossier(dossier, entrees, o) {
  const W = travail(); for (const s of ['captures', 'j', 'meta']) fs.mkdirSync(path.join(W, s), { recursive: true });
  const journaux = fichiers(dossier, /^ariane-journal-v4-.*\.json$/);
  if (journaux.length !== 1) throw Error(`${dossier} : ${journaux.length} journal(aux)`);
  const journal = JSON.parse(fs.readFileSync(journaux[0], 'utf8')), lots = D.lotsDuJournal(journal);
  const voulus = new Map();
  for (const e of entrees) {
    const k = cle(e), m = path.join(W, 'meta', k + '.json');
    const deLaPartie = lots.filter(l => l.partie === e.partie);
    const lot = deLaPartie[e.rang - 1];
    if (!lot) throw Error(`${k} : lot de rang ${e.rang} absent (${deLaPartie.length} lot(s) de la partie ${e.partie})`);
    const listes = fichiers(dossier, new RegExp(`^ariane-liste-partie${e.partie}-.*\\.json$`));
    const ids = lot.cuts.map(c => c.captureId).filter(Boolean);
    voulus.set(k, { e, lot, ids: new Set(ids), clouds: [], meta: m, liste: listes[0] || null });
  }
  /* Réduction des captures : un seul passage sur les segments. */
  const segs = fichiers(dossier, /^ariane-gcv1-corpus-.*\.json$/);
  const aFaire = [...voulus.values()].filter(v => !fs.existsSync(path.join(W, 'captures', cle(v.e) + '.json')));
  if (aFaire.length) {
    for (const s of segs) {
      let doc = JSON.parse(fs.readFileSync(s, 'utf8'));
      for (const c of doc.clouds || []) for (const v of aFaire) if (c && v.ids.has(c.captureId)) v.clouds.push(c);
      doc = null;
    }
    for (const v of aFaire) { /* écriture en flot, en parts de 250 Mo au plus : le banc lit chaque fichier en une chaîne (limite 512 Mo) */
      const base = path.join(W, 'captures', cle(v.e)); let part = 1, fd = null, octets = 0, n = 0;
      const ouvrir = () => { fd = fs.openSync(base + (part > 1 ? '.' + part : '') + '.json.part', 'w'); fs.writeSync(fd, '{"clouds":['); octets = 0; n = 0; };
      const fermer = () => { fs.writeSync(fd, ']}'); fs.closeSync(fd); const f = base + (part > 1 ? '.' + part : '') + '.json'; fs.renameSync(f + '.part', f); };
      ouvrir();
      for (const c of v.clouds) { const t = JSON.stringify(c); if (n && octets + t.length > 250e6) { fermer(); part++; ouvrir(); } fs.writeSync(fd, (n ? ',' : '') + t); octets += t.length; n++; }
      fermer(); v.n = v.clouds.length; v.clouds = null; }
  }
  for (const v of voulus.values()) {
    const k = cle(v.e), fj = path.join(W, 'j', k + '.json');
    if (!fs.existsSync(fj)) {
      const r = cp.spawnSync(process.execPath, ['--max-old-space-size=6144', path.join(RACINE, 'tools', 'jointure-echo-orbite.cjs'), '--echo', ...v.e.echo,
        '--journal', journaux[0], '--partie', String(v.e.partie), '--visite-sans-action-bonne', '--sortie', fj], { encoding: 'utf8', maxBuffer: 1 << 28 });
      if (r.status !== 0) throw Error(`${k} : jointure en échec\n${r.stderr}`);
    }
    fs.writeFileSync(v.meta, JSON.stringify({ cle: k, lot: v.e.lot, partie: v.e.partie, rang: v.e.rang, examen: !!v.e.examen, journal: journaux[0], lotId: v.lot.id,
      liste: v.liste, captures: fichiers(path.join(W, 'captures'), new RegExp(`^${k}(\\.\\d+)?\\.json$`)), jointure: fj, cutsLot: v.lot.cuts.length, captures_lot: v.ids.size }, null, 1));
    process.stdout.write(`${k} : ${v.lot.cuts.length} cuts au lot, captures ${v.n == null ? 'déjà réduites' : v.n + '/' + v.ids.size}\n`);
  }
  if (o.effacer) for (const s of segs) fs.unlinkSync(s);
}

function main() {
  const o = args(process.argv.slice(2)), parDossier = new Map();
  for (const e of LOTS) { if (o.lots ? !o.lots.includes(e.lot) : e.vierge) continue; if (!parDossier.has(e.dossierLot)) parDossier.set(e.dossierLot, []); parDossier.get(e.dossierLot).push(e); }
  for (const [d, es] of parDossier) preparerDossier(d, es, o);
}
if (require.main === module) { try { main(); } catch (e) { process.stderr.write('preparer : ' + e.message + '\n'); process.exitCode = 1; } }
