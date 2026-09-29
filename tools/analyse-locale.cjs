#!/usr/bin/env node
'use strict';
/*
 * analyse-locale.cjs — analyse des exports d'Ariane SUR TON ORDINATEUR, pour n'envoyer
 * que les résultats (quelques Mo) au lieu des exports (plusieurs Go de nuages de points).
 *
 *   node tools/analyse-locale.cjs DOSSIER_RACINE [--sortie DOSSIER] [--memoire MO] [--avec-journal]
 *
 * DOSSIER_RACINE contient un sous-dossier par lot Orbite et un par relecture Écho ; le
 * numéro de la partie est le premier nombre du nom du dossier, et un nom qui contient
 * « echo », « écho », « relecture » ou « natif » désigne une relecture :
 *
 *   DOSSIER_RACINE/lot 20/    ← fichiers du lot (journal, diagnostic, corpus, bilan)
 *   DOSSIER_RACINE/echo 20/   ← fichiers de la relecture de la même partie (facultatif)
 *   DOSSIER_RACINE/lot 33/
 *
 * Pour chaque lot : rapport d'acceptation (mode léger : les points bruts sont écartés dès
 * la lecture, aucun chiffre ne change — voir tests/analyse-locale.test.cjs), temps mesurés
 * (perf-lot) et extraits du journal (relevé passif, fin de lot, pauses, erreurs). Tout est
 * réuni dans un seul fichier `resultats-ariane-AAAA-MM-JJ.json.gz`, à envoyer tel quel.
 * `--avec-journal` y joint aussi le journal et le diagnostic de chaque lot, compressés
 * (utile pour de nouvelles études ; environ 10 % du poids du journal).
 */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');

const VERSION_KIT = 1;
const EST_RELECTURE = /(echo|écho|relecture|natif|native)/i;
const ROUTINE = new Set(['cut-target-changed', 'adapter-progress', 'proposed', 'gcv1-shadow-observed', 'adapter-result', 'after-captured',
  'validation-intent', 'validation-observation', 'applied-verified', 'validation-accepted', 'before-captured', 'capture-abandoned',
  'esv-releve', 'defer-navigation-accepted', 'defer-command-possible', 'defer-navigation-observation', 'defer-intent', 'defer-finalized']);
const MAX_RARES = 200;

const estDossier = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const json = f => fs.readdirSync(f).filter(n => n.toLowerCase().endsWith('.json')).sort().map(n => path.join(f, n));
const archives = f => fs.readdirSync(f).some(n => /\.(zip|7z|gz|rar|part\d+)$/i.test(n));
/* Un lot est souvent décompressé dans un dossier de plus (« lot 25/LOT 25/… ») : on descend d'un niveau. */
function dossierJson(dir) {
  if (json(dir).length) return { dir };
  const sous = fs.readdirSync(dir).map(n => path.join(dir, n)).filter(d => estDossier(d) && json(d).length);
  if (sous.length === 1) return { dir: sous[0] };
  return { raison: sous.length > 1 ? 'plusieurs sous-dossiers de fichiers : un lot par dossier'
    : archives(dir) ? 'archives à décompresser d’abord' : 'aucun fichier .json' };
}

function decouvrir(racine) {
  const lots = [], relectures = new Map(), ignores = [];
  const noms = fs.readdirSync(racine).filter(n => estDossier(path.join(racine, n)) && !/^resultats/i.test(n)).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' }));
  for (const nom of noms) {
    const trouve = dossierJson(path.join(racine, nom)), m = /(\d+)/.exec(nom);
    if (!trouve.dir) { ignores.push({ dossier: nom, raison: trouve.raison }); continue; }
    if (!m) { ignores.push({ dossier: nom, raison: 'pas de numéro de partie dans le nom du dossier' }); continue; }
    const part = Number(m[1]);
    if (EST_RELECTURE.test(nom)) (relectures.get(part) || relectures.set(part, []).get(part)).push({ nom, dir: trouve.dir });
    else lots.push({ part, nom, dir: trouve.dir });
  }
  return { lots, relectures, ignores };
}

const fmt = n => (Math.round(n * 10) / 10).toString().replace('.', ',');
const compte = (o, k) => { o[k] = (o[k] || 0) + 1; };

/* Ce que le journal dit de la fin du lot et du relevé passif d'ESV : de quoi trancher les questions que
 * les rapports d'acceptation ne posent pas (fin de partie, texte « M cuts », pauses, erreurs). */
function extraits(journal) {
  const ev = (journal.events || []).slice().sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))), b = journal.state?.batch || {}, types = {}, releves = { n: 0, totaux: {}, cutsAffiches: {}, couples: {}, illisibles: 0, plusieurs: 0 };
  const pauses = [], erreurs = {}, rares = [];
  let premier = null, dernier = null;
  for (const e of ev) {
    compte(types, e.type);
    if (e.type === 'esv-releve') {
      releves.n++;
      if (e.compteur) { compte(releves.totaux, e.compteur.total); } else if (e.compteurIllisible) releves.illisibles++;
      if (Number.isInteger(e.cutsAffiches)) compte(releves.cutsAffiches, e.cutsAffiches);
      if (e.compteursVus > 1 || e.cutsAffichesVus > 1) releves.plusieurs++;
      compte(releves.couples, `${e.compteur?.total ?? '∅'} / ${e.cutsAffiches ?? '∅'}`);
      const r = { cut: e.identity?.cut ?? null, part: e.identity?.part ?? null, traites: e.compteur?.traites ?? null, total: e.compteur?.total ?? null, cutsAffiches: e.cutsAffiches ?? null, at: e.at };
      premier = premier || r; dernier = r;
    }
    if (e.type === 'batch-state' && e.batch?.state && e.batch.state !== 'RUNNING') pauses.push({ at: e.timestamp, etat: e.batch.state, cause: e.batch.pauseReason ?? null, cut: e.identity?.cut ?? null });
    if (e.type === 'adapter-result' && e.error) compte(erreurs, String(e.error).slice(0, 90));
    if (!ROUTINE.has(e.type) && rares.length < MAX_RARES) rares.push(JSON.parse(JSON.stringify(e, (k, v) => typeof v === 'string' && v.length > 500 ? v.slice(0, 500) + '…' : v)));
  }
  const inter = {}; for (const x of b.interrupted || []) compte(inter, x.status || x.reason || '?');
  return {
    version: journal.version ?? null, cloture: journal.closureSummary ? { ...journal.closureSummary, deferredCuts: undefined, deferredCutsCount: (journal.closureSummary.deferredCuts || []).length } : null,
    lot: { etat: b.state ?? null, etape: b.step ?? null, portee: b.scope ?? null, pause: b.pauseReason ?? null, erreur: b.error == null ? null : String(typeof b.error === 'string' ? b.error : JSON.stringify(b.error)).slice(0, 400), traites: (b.processed || []).length,
      differes: (b.deferred || []).length, interrompus: inter, finDePartie: b.stoppedAtEnd ?? null, departApresDiffere: b.departApresDiffere ?? null, totalReleve: b.totalReleve ?? null },
    evenements: types, releve: { ...releves, premier, dernier }, pauses: pauses.slice(0, 100), erreursCommandes: erreurs, evenementsRares: rares,
  };
}

function lancer(script, args, memoireMo) {
  const r = spawnSync(process.execPath, [`--max-old-space-size=${memoireMo}`, path.join(__dirname, script), ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  return { ok: r.status === 0, sortie: (r.stdout || '').trim(), erreur: (r.stderr || '').trim().split('\n').slice(0, 6).join('\n') };
}

function lireJson(f) { return f && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }

function analyserLot(lot, relectures, opt, tmp, label = `p${lot.part}`) {
  const res = { part: lot.part, dossier: lot.nom, label, relectures: relectures.map(r => r.nom), avertissements: [] };
  const base = path.join(tmp, label.replace(/[^\w-]/g, '_'));
  const args = ['--leger', '--lot', `${lot.dir}=${label}`];
  if (relectures.length > 1) res.avertissements.push(`plusieurs dossiers de relecture pour la partie ${lot.part} (${relectures.map(r => r.nom).join(', ')}) : regroupe-les dans un seul dossier ; relecture ignorée`);
  else if (relectures.length === 1) args.push('--relecture', relectures[0].dir);
  const t0 = Date.now();
  const acc = lancer('acceptance-report.cjs', [...args, '--json', base + '-acc.json', '--md', base + '-acc.md'], opt.memoire);
  res.acceptation = acc.ok ? { rapport: lireJson(base + '-acc.json'), markdown: fs.readFileSync(base + '-acc.md', 'utf8'), resume: acc.sortie } : { erreur: acc.erreur || 'échec sans message' };
  res.acceptationSecondes = Math.round((Date.now() - t0) / 100) / 10;
  const journaux = json(lot.dir).filter(f => /journal-v4/i.test(path.basename(f)));
  if (journaux.length === 1) {
    const perf = lancer('perf-lot.cjs', [journaux[0], '--json', base + '-perf.json', '--md', base + '-perf.md'], opt.memoire);
    res.perf = perf.ok ? { mesures: lireJson(base + '-perf.json'), markdown: fs.readFileSync(base + '-perf.md', 'utf8') } : { erreur: perf.erreur };
    try { res.extraits = extraits(JSON.parse(fs.readFileSync(journaux[0]))); } catch (e) { res.extraits = { erreur: String(e.message).slice(0, 300) }; }
    if (opt.avecJournal) {
      res.journalGz = zlib.gzipSync(fs.readFileSync(journaux[0])).toString('base64');
      const diag = json(lot.dir).find(f => /diagnostic/i.test(path.basename(f)));
      if (diag) res.diagnosticGz = zlib.gzipSync(fs.readFileSync(diag)).toString('base64');
    }
  } else res.avertissements.push(journaux.length ? 'plusieurs journaux dans le dossier : un lot par dossier' : 'aucun journal (fichier « journal-v4 ») : temps et extraits non calculés');
  return res;
}

function resume(resultats, ignores) {
  const L = ['# Résumé de l’analyse locale', '', '| Lot | Cuts | Posés | Couverture | Refusés (écart.) | Différés | Relecture | Faux / jugés | Cycle médian |', '|---|---|---|---|---|---|---|---|---|'];
  for (const r of resultats) {
    const t = r.acceptation?.rapport?.total, c1 = t?.c1, c4 = t?.c4, cy = r.perf?.mesures?.cycleMs?.median ?? r.perf?.mesures?.cycleMs?.p50 ?? null;
    L.push(`| ${r.label} | ${c1?.distinctCuts ?? '—'} | ${c1?.applied ?? '—'} | ${c1 ? fmt(c1.coveragePct) + ' %' : '—'} | ${c1?.gaugeRejected ?? '—'} | ${c1?.deferred ?? '—'} | ${r.relectures.length ? 'oui' : 'non'} | `
      + `${c4 ? (c4.evaluable === false ? 'non évaluable' : `${c4.wrong} / ${c4.judgedApplied}`) : '—'} | ${cy != null ? fmt(cy / 1000) + ' s' : '—'} |`);
    if (r.acceptation?.erreur) L.push(`|  | ↳ erreur : ${r.acceptation.erreur.split('\n')[0].slice(0, 160)} | | | | | | | |`);
    for (const a of r.avertissements) L.push(`|  | ↳ ${a.slice(0, 200)} | | | | | | | |`);
  }
  if (ignores.length) L.push('', '## Dossiers ignorés', '', ...ignores.map(i => `- ${i.dossier} : ${i.raison}`));
  return L.join('\n') + '\n';
}

function main(argv = process.argv.slice(2)) {
  const val = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const racine = argv.find((a, i) => !a.startsWith('--') && !['--sortie', '--memoire'].includes(argv[i - 1]));
  if (!racine || !fs.existsSync(racine)) { console.error('Usage : node tools/analyse-locale.cjs DOSSIER_RACINE [--sortie DOSSIER] [--memoire MO] [--avec-journal]'); process.exit(1); }
  const memoire = Number(val('--memoire')) || Math.max(2048, Math.min(12288, Math.floor(os.totalmem() / 1048576 * 0.7)));
  const sortie = val('--sortie') || path.join(racine, 'resultats'), opt = { memoire, avecJournal: argv.includes('--avec-journal') };
  fs.mkdirSync(sortie, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ariane-analyse-'));
  const { lots, relectures, ignores } = decouvrir(racine);
  for (const [part, r] of relectures) if (!lots.some(l => l.part === part)) ignores.push({ dossier: r.map(x => x.nom).join(', '), raison: `relecture sans lot de la partie ${part}` });
  if (!lots.length) { console.error('Aucun dossier de lot trouvé dans ' + racine + '.' + (ignores.length ? '\n' + ignores.map(i => `  - ${i.dossier} : ${i.raison}`).join('\n') : '')); process.exit(1); }
  console.log(`${lots.length} lot(s), mémoire ${memoire} Mo par analyse.`);
  const resultats = [];
  for (const lot of lots) {
    console.log(`→ ${lot.nom} (partie ${lot.part})${relectures.get(lot.part) ? ' + relecture' : ''}…`);
    const r = analyserLot(lot, relectures.get(lot.part) || [], opt, tmp, lots.filter(l => l.part === lot.part).length > 1 ? `p${lot.part}-${lot.nom.replace(/[^\w]+/g, '-')}` : `p${lot.part}`);
    console.log(`   ${r.acceptation.resume ? r.acceptation.resume.split('\n').pop().slice(0, 200) : 'ERREUR : ' + (r.acceptation.erreur || '').split('\n')[0]}`);
    resultats.push(r);
  }
  const jour = new Date().toISOString().slice(0, 10), md = resume(resultats, ignores);
  const doc = { format: 'ariane-analyse-locale-v1', kit: VERSION_KIT, node: process.version, produitLe: new Date().toISOString(), lots: resultats, ignores };
  const fichier = path.join(sortie, `resultats-ariane-${jour}.json.gz`);
  fs.writeFileSync(fichier, zlib.gzipSync(JSON.stringify(doc)));
  fs.writeFileSync(path.join(sortie, 'RESUME.md'), md);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n' + md + `\nÀ envoyer : ${fichier} (${Math.round(fs.statSync(fichier).size / 1024)} Ko)`);
}

if (require.main === module) try { main(); } catch (e) { console.error(e.stack || e); process.exitCode = 1; }
module.exports = { decouvrir, dossierJson, extraits, resume, analyserLot, main };
