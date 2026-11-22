#!/usr/bin/env node
'use strict';
/* CH-064-E : temps et mémoire, dans Chromium, 15 répétitions (3 d'échauffement en plus).
 *   CHROMIUM=/opt/google/chrome/chrome node tools/ch064-e-banc.cjs [--json SORTIE]
 * Charge un journal réel aminci (champs lus par la liste de corrections et par l'index) et un instantané de liste.
 * N'écrit aucune donnée identifiante. */
const fs = require('node:fs'), path = require('node:path'), { execFileSync, spawnSync } = require('node:child_process');
const RACINE = path.resolve(__dirname, '..');
const CRATE = path.join(RACINE, 'ariane-rs', 'crates', 'ariane-etat');
const WASM = path.join(RACINE, 'ariane-rs', 'target', 'wasm32-unknown-unknown', 'release', 'ariane_etat.wasm');
const CHROME = process.env.CHROMIUM || '/opt/google/chrome/chrome';

function mince(e) {
  if (!e || typeof e !== 'object') return e;
  const o = {};
  for (const k of ['type', 'timestamp', 'batchId', 'lotId', 'reason', 'kind', 'status', 'rowIndex', 'resultat', 'verdict', 'action', 'pireMm', 'cutsGarde', 'correctionId', 'etat', 'raison', 'lignes', 'batchIds', 'identity', 'decal', 'eventId', 'nativeSessionId']) if (k in e) o[k] = e[k];
  if (e.batch && e.batch.id) o.batch = { id: e.batch.id };
  if (e.body) o.body = { ExtractionStatus: e.body.ExtractionStatus, TreatedByOperator: e.body.TreatedByOperator };
  if (e.lotObservation) { const L = e.lotObservation, c = L.command || {}; o.lotObservation = { stage: L.stage, command: { action: c.action, reason: c.reason }, anchorsUsed: L.anchorsUsed, l1: L.l1 && L.l1.chaine ? { chaine: { appuis: L.l1.chaine.appuis } } : undefined }; }
  return o;
}
function premier(pred) {
  const root = process.env.BANANE_DATA || '/tmp/banane-data/collections';
  for (const d of fs.readdirSync(root)) {
    const raw = path.join(root, d, 'raw');
    if (!fs.existsSync(raw)) continue;
    for (const f of fs.readdirSync(raw)) {
      if (!f.endsWith('.zip')) continue;
      const z = path.join(raw, f);
      const noms = execFileSync('unzip', ['-Z1', z], { encoding: 'utf8' }).split('\n');
      for (const e of noms) if (pred(path.basename(e))) return JSON.parse(execFileSync('unzip', ['-p', z, e], { maxBuffer: 2 ** 31 - 1, encoding: 'utf8' }));
    }
  }
  throw Error('corpus absent');
}
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function stats(a) { return { n: a.length, mediane: q(a, 0.5), p90: q(a, 0.9) }; }

function construireWasm() {
  if (fs.existsSync(WASM)) return;
  const r = spawnSync('cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown', '--features', 'autonome', '-q'], { cwd: CRATE, encoding: 'utf8' });
  if (r.status !== 0) throw Error(r.stderr || r.stdout);
}
function rssNatif(entree) {
  const bin = path.join(CRATE, 'target', 'release', 'rss');
  const r = spawnSync('cargo', ['build', '--release', '-q', '--bin', 'rss'], { cwd: CRATE, encoding: 'utf8' });
  if (r.status !== 0) throw Error(r.stderr || r.stdout);
  const run = spawnSync(bin, [], { input: JSON.stringify(entree), encoding: 'utf8', maxBuffer: 1 << 20 });
  if (run.status !== 0) throw Error(run.stderr || run.stdout);
  return JSON.parse(run.stdout);
}

async function chromium(charge) {
  const { chromium } = require('/tmp/pw/node_modules/playwright');
  const b = await chromium.launch({ executablePath: CHROME, args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  try {
    const p = await b.newPage();
    await p.goto('about:blank');
    for (const s of ['src/etat-morceaux.js', 'src/correction-liste.js', 'src/liste-memoire.js', 'src/verts-a-controler.js', 'ariane-rs/coquille/vba.js', 'ariane-rs/coquille/coeur.js'])
      await p.addScriptTag({ content: fs.readFileSync(path.join(RACINE, s), 'utf8') });
    const b64 = fs.readFileSync(WASM).toString('base64');
    return await p.evaluate(async ({ b64, charge }) => {
      const o = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const frais = () => ArianeCoeur.creer(o, { seuilReinstanciation: 256 * 1024 * 1024 });
      let coeur = frais();
      const N = 15, CHAUD = 3;
      const temps = { correctionJs: [], correctionRs: [], listeJs: [], listeRs: [], etatJs: [], etatRs: [] };
      const une = async () => {
        let t = performance.now(); BananeEtatMorceaux && ArianeCorrectionListe.construire(charge.events, { population: true }); temps.correctionJs.push(performance.now() - t);
        t = performance.now(); coeur.appeler(0, { f: 'correction', events: charge.events, options: { population: true } }); temps.correctionRs.push(performance.now() - t);
        t = performance.now(); BananeListeMemoire.decompacter(charge.liste); temps.listeJs.push(performance.now() - t);
        t = performance.now(); coeur.appeler(0, { f: 'listeDecompacter', snap: charge.liste }); temps.listeRs.push(performance.now() - t);
        t = performance.now(); BananeEtatMorceaux.decouper(charge.session); temps.etatJs.push(performance.now() - t);
        t = performance.now(); coeur.appeler(0, { f: 'decouper', etat: charge.session, connus: null }); temps.etatRs.push(performance.now() - t);
      };
      for (let i = 0; i < CHAUD; i++) await une();
      for (const k of Object.keys(temps)) temps[k] = [];
      if (globalThis.gc) gc();
      for (let i = 0; i < N; i++) await une();
      const tasAvant = performance.memory ? performance.memory.usedJSHeapSize : null;
      coeur = frais();
      const avant = coeur.memoireOctets();
      coeur.appeler(0, { f: 'correction', events: charge.events, options: { population: true } });
      const apresAppel = coeur.etat();
      const tasApres = performance.memory ? performance.memory.usedJSHeapSize : null;
      // Seuil bas : l'instance est recréée, la mémoire linéaire retombe.
      const borne = ArianeCoeur.creer(o, { seuilReinstanciation: 64 * 1024 });
      borne.appeler(0, { f: 'listeEmpreinte', s: 'borne' });
      borne.appeler(0, { f: 'correction', events: charge.events, options: { population: true } });
      const apresBorne = borne.etat();
      return { temps, memoire: { lineaireAvant: avant, hauteEau: apresAppel.hauteEau, lineaireApresAppel: apresAppel.memoire, lineaireApresReinstanciation: apresBorne.memoire, reinstanciations: apresBorne.reinstanciations, tasJsAvant: tasAvant, tasJsApres: tasApres }, navigateur: navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] };
    }, { b64, charge });
  } finally { await b.close(); }
}

async function main() {
  construireWasm();
  const journal = premier(b => b.startsWith('ariane-journal-v4'));
  const liste = premier(b => b.startsWith('ariane-liste-partie'));
  const echo = premier(b => b.startsWith('ariane-echo') && b.includes('seg'));
  const charge = { events: (journal.events || []).map(mince), liste, session: echo.session };
  const nav = await chromium(charge);
  const temps = {};
  for (const [k, v] of Object.entries(nav.temps)) temps[k] = stats(v);
  const natif = rssNatif({ f: 'correction', events: charge.events, options: { population: true } });
  const res = { format: 'ch064-e-banc-v1', navigateur: nav.navigateur, repetitions: 15, echauffement: 3, evenements: charge.events.length, tempsMs: temps, memoire: nav.memoire, natif, qualification: 'ÉTABLI' };
  const s = JSON.stringify(res, null, 1);
  const out = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
  if (out) fs.writeFileSync(out, s + '\n');
  console.log(s);
}
main().catch(e => { console.error(e); process.exit(1); });
