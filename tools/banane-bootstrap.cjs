#!/usr/bin/env node
'use strict';

/*
 * Banane Research Bootstrap V1
 * Couche de provisioning hors runtime pour les données de recherche.
 * - aucun accès ESV ;
 * - aucun changement de géométrie/moteur ;
 * - fail-closed sur taille/SHA ;
 * - les credentials GitHub ne sont jamais journalisés.
 */

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_LOCK = path.join(ROOT, 'data/native-v46.lock.json');

class BootstrapError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'BootstrapError';
    this.code = code;
    this.details = details;
  }
}

function parseArgs(argv) {
  const args = { command: argv[2] || 'doctor', json: false, lock: DEFAULT_LOCK, noDownload: false };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--no-download') args.noDownload = true;
    else if (a === '--lock') args.lock = path.resolve(argv[++i]);
    else throw new BootstrapError('BAD_ARGUMENT', `Argument inconnu: ${a}`);
  }
  return args;
}

function loadLock(file = DEFAULT_LOCK) {
  const lock = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (lock.format !== 'banane-research-data-lock-v1') {
    throw new BootstrapError('LOCK_FORMAT', `Format de lock non supporté: ${lock.format ?? 'absent'}`);
  }
  if (lock.dataset !== 'native-v46') {
    throw new BootstrapError('LOCK_DATASET', `Dataset inattendu: ${lock.dataset ?? 'absent'}`);
  }
  if (!Array.isArray(lock.assets) || lock.assets.length !== 2) {
    throw new BootstrapError('LOCK_ASSETS', 'Le lock native-v46 doit déclarer exactement deux assets.');
  }
  for (const a of lock.assets) {
    if (!a.key || !a.name || !Number.isInteger(a.assetId) || !Number.isInteger(a.bytes) ||
        !/^[0-9a-f]{64}$/.test(a.sha256 || '') || !a.extractDir) {
      throw new BootstrapError('LOCK_ASSET_INVALID', `Asset lock invalide: ${a.key || a.name || '?'}`);
    }
  }
  return lock;
}

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const s = fs.createReadStream(file);
    s.on('error', reject);
    s.on('data', d => h.update(d));
    s.on('end', () => resolve(h.digest('hex')));
  });
}

async function verifyAssetFile(file, asset) {
  let st;
  try { st = await fsp.stat(file); }
  catch (e) {
    if (e.code === 'ENOENT') return { ok: false, code: 'MISSING', file };
    throw e;
  }
  if (!st.isFile()) return { ok: false, code: 'NOT_FILE', file };
  if (st.size !== asset.bytes) {
    return { ok: false, code: 'SIZE_MISMATCH', file, expectedBytes: asset.bytes, actualBytes: st.size };
  }
  const got = await sha256File(file);
  if (got !== asset.sha256) {
    return { ok: false, code: 'SHA256_MISMATCH', file, expectedSha256: asset.sha256, actualSha256: got };
  }
  return { ok: true, code: 'VERIFIED', file, bytes: st.size, sha256: got };
}

function resolveMaybeRelative(p, root = ROOT) {
  if (!p) return null;
  return path.isAbsolute(p) ? path.normalize(p) : path.resolve(root, p);
}

function canonicalRoot(lock, root = ROOT) {
  return resolveMaybeRelative(lock.canonicalRoot, root);
}

function archiveCandidates(lock, asset, env = process.env, root = ROOT) {
  const out = [];
  const perEnvName = lock.lookup?.perAssetEnvironment?.[asset.key];
  if (perEnvName && env[perEnvName]) {
    const p = resolveMaybeRelative(env[perEnvName], root);
    out.push(fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, asset.name) : p);
  }
  for (const envName of lock.lookup?.directoryEnvironment || []) {
    if (env[envName]) out.push(path.join(resolveMaybeRelative(env[envName], root), asset.name));
  }
  for (const d of lock.lookup?.fallbackDirectories || []) {
    out.push(path.join(resolveMaybeRelative(d, root), asset.name));
  }
  out.push(path.join(canonicalRoot(lock, root), 'downloads', asset.name));
  return [...new Set(out.filter(Boolean).map(path.normalize))];
}

async function locateVerifiedArchive(lock, asset, env = process.env, root = ROOT) {
  const checked = [];
  for (const file of archiveCandidates(lock, asset, env, root)) {
    const v = await verifyAssetFile(file, asset);
    checked.push(v);
    if (v.ok) return { ...v, checked };
  }
  return { ok: false, code: 'NO_VERIFIED_ARCHIVE', checked };
}

function commandExists(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(probe, [cmd], { stdio: 'ignore' });
  return r.status === 0;
}

function findExtractor(lock) {
  for (const cmd of lock.extraction?.programs || ['7zz', '7z']) {
    if (commandExists(cmd)) return cmd;
  }
  return null;
}

function tokenFromEnvironment(env = process.env) {
  return env.GH_TOKEN || env.GITHUB_TOKEN || null;
}

function tokenFromGhCli() {
  if (!commandExists('gh')) return null;
  const r = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  if (r.status !== 0) return null;
  const token = (r.stdout || '').trim();
  return token || null;
}

function resolveGitHubToken(env = process.env) {
  return tokenFromEnvironment(env) || tokenFromGhCli();
}

function requestToFile(url, headers, output, redirects = 0) {
  if (redirects > 5) return Promise.reject(new BootstrapError('DOWNLOAD_REDIRECT', 'Trop de redirections GitHub.'));
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        let nextHeaders = { ...headers };
        try {
          const u = new URL(res.headers.location);
          if (u.hostname !== 'api.github.com') delete nextHeaders.Authorization;
        } catch {}
        return resolve(requestToFile(res.headers.location, nextHeaders, output, redirects + 1));
      }
      if (res.statusCode !== 200) {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', c => { if (body.length < 2000) body += c; });
        res.on('end', () => reject(new BootstrapError(
          'DOWNLOAD_HTTP',
          `GitHub asset HTTP ${res.statusCode}. Vérifier le token et l'accès au dépôt privé.`,
          { statusCode: res.statusCode, body: body.slice(0, 500) }
        )));
        return;
      }
      const ws = fs.createWriteStream(output, { flags: 'wx' });
      ws.on('error', reject);
      res.on('error', reject);
      res.pipe(ws);
      ws.on('finish', () => ws.close(() => resolve(output)));
    });
    req.on('error', reject);
  });
}

async function downloadAsset(lock, asset, destination, env = process.env) {
  const token = resolveGitHubToken(env);
  if (!token) {
    throw new BootstrapError(
      'AUTH_MISSING',
      'Aucun GH_TOKEN/GITHUB_TOKEN et aucun `gh auth token` disponible. Monter les .7z ou fournir un token GitHub autorisé.'
    );
  }
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const partial = destination + `.partial-${process.pid}-${Date.now()}`;
  const [owner, repo] = lock.source.repository.split('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${asset.assetId}`;
  const headers = {
    'Accept': 'application/octet-stream',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'banane-research-bootstrap-v1',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  try {
    await requestToFile(url, headers, partial);
    const verified = await verifyAssetFile(partial, asset);
    if (!verified.ok) {
      throw new BootstrapError('DOWNLOADED_ASSET_INVALID',
        `Asset téléchargé invalide (${verified.code}) : ${asset.name}`, verified);
    }
    await fsp.rm(destination, { force: true });
    await fsp.rename(partial, destination);
    return { ...verified, file: destination, source: 'github-release' };
  } finally {
    await fsp.rm(partial, { force: true }).catch(() => {});
  }
}

async function scanJsonFiles(dir) {
  const out = [];
  async function walk(p) {
    const entries = await fsp.readdir(p, { withFileTypes: true });
    for (const e of entries) {
      const q = path.join(p, e.name);
      if (e.isDirectory()) await walk(q);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.json')) out.push(q);
    }
  }
  try { await walk(dir); }
  catch (e) { if (e.code === 'ENOENT') return []; else throw e; }
  return out.sort();
}

function lockFingerprint(lock) {
  return sha256Buffer(Buffer.from(JSON.stringify(lock)));
}

async function readExtractionMarker(dir, lock, asset) {
  const markerPath = path.join(dir, lock.extraction.provenanceMarker);
  let marker;
  try { marker = JSON.parse(await fsp.readFile(markerPath, 'utf8')); }
  catch (e) {
    return { ok: false, code: e.code === 'ENOENT' ? 'MARKER_MISSING' : 'MARKER_INVALID', markerPath };
  }
  const checks = {
    format: marker.format === 'banane-bootstrap-extraction-v1',
    dataset: marker.dataset === lock.dataset,
    assetKey: marker.assetKey === asset.key,
    assetSha256: marker.assetSha256 === asset.sha256,
    assetBytes: marker.assetBytes === asset.bytes,
    lockSha256: marker.lockSha256 === lockFingerprint(lock),
    jsonFiles: Number.isInteger(marker.jsonFiles) && marker.jsonFiles > 0,
  };
  if (Object.values(checks).some(v => !v)) return { ok: false, code: 'MARKER_MISMATCH', markerPath, checks, marker };
  const files = (await scanJsonFiles(dir)).filter(f => path.basename(f) !== lock.extraction.provenanceMarker);
  if (files.length !== marker.jsonFiles) {
    return { ok: false, code: 'JSON_COUNT_MISMATCH', markerPath, expected: marker.jsonFiles, actual: files.length };
  }
  return { ok: true, code: 'VERIFIED_MARKER', markerPath, marker, jsonFiles: files.length, dir };
}

async function extractVerifiedArchive(lock, asset, archive, root = ROOT) {
  const extractor = findExtractor(lock);
  if (!extractor) {
    throw new BootstrapError('EXTRACTOR_MISSING',
      `Aucun extracteur 7z disponible (${(lock.extraction.programs || []).join(', ')}). Installer 7-Zip/p7zip ou monter une extraction déjà préparée.`);
  }
  const base = canonicalRoot(lock, root);
  const dest = path.join(base, 'extracted', asset.extractDir);
  const existing = await readExtractionMarker(dest, lock, asset);
  if (existing.ok) return { ...existing, reused: true, extractor: null };

  const tmp = dest + `.tmp-${process.pid}-${Date.now()}`;
  await fsp.rm(tmp, { recursive: true, force: true });
  await fsp.mkdir(tmp, { recursive: true });

  const r = spawnSync(extractor, ['x', '-y', `-o${tmp}`, archive], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    await fsp.rm(tmp, { recursive: true, force: true });
    throw new BootstrapError('EXTRACT_FAILED', `Extraction ${asset.name} échouée avec ${extractor}.`,
      { status: r.status, stderr: (r.stderr || '').slice(-2000) });
  }
  const jsonFiles = await scanJsonFiles(tmp);
  if (lock.extraction.jsonRequired && !jsonFiles.length) {
    await fsp.rm(tmp, { recursive: true, force: true });
    throw new BootstrapError('EXTRACT_NO_JSON', `Aucun JSON trouvé après extraction de ${asset.name}.`);
  }
  const marker = {
    format: 'banane-bootstrap-extraction-v1',
    dataset: lock.dataset,
    assetKey: asset.key,
    assetName: asset.name,
    assetSha256: asset.sha256,
    assetBytes: asset.bytes,
    lockSha256: lockFingerprint(lock),
    sourceRepository: lock.source.repository,
    releaseTag: lock.source.releaseTag,
    jsonFiles: jsonFiles.length,
    sourceVerified: true,
    extractedAt: new Date().toISOString(),
  };
  await fsp.writeFile(path.join(tmp, lock.extraction.provenanceMarker), JSON.stringify(marker, null, 2) + '\n');
  await fsp.rm(dest, { recursive: true, force: true });
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.rename(tmp, dest);
  return { ok: true, code: 'EXTRACTED', dir: dest, jsonFiles: jsonFiles.length, marker, extractor };
}

function hashFileSync(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function repositoryStatus(lock, root = ROOT) {
  const missing = [];
  const mismatched = [];
  const matched = [];
  for (const rel of lock.compatibleCode.requiredRepositoryFiles || []) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) missing.push(rel);
  }
  for (const [rel, want] of Object.entries(lock.compatibleCode.criticalFiles || {})) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) { missing.push(rel); continue; }
    const got = hashFileSync(file);
    if (got === want) matched.push({ file: rel, sha256: got });
    else mismatched.push({ file: rel, expected: want, actual: got });
  }
  let gitHead = null, gitDirty = null;
  if (commandExists('git')) {
    const h = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (h.status === 0) gitHead = h.stdout.trim();
    const s = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (s.status === 0) gitDirty = Boolean(s.stdout.trim());
  }
  return { ok: missing.length === 0 && mismatched.length === 0, missing: [...new Set(missing)], mismatched, matched, gitHead, gitDirty };
}

async function assetStatus(lock, asset, env = process.env, root = ROOT) {
  const archive = await locateVerifiedArchive(lock, asset, env, root);
  const extractedDir = path.join(canonicalRoot(lock, root), 'extracted', asset.extractDir);
  const extracted = await readExtractionMarker(extractedDir, lock, asset);
  return { key: asset.key, asset, archive, extracted };
}

async function doctor(lock, env = process.env, root = ROOT) {
  const code = repositoryStatus(lock, root);
  const assets = [];
  for (const asset of lock.assets) assets.push(await assetStatus(lock, asset, env, root));
  const envToken = tokenFromEnvironment(env);
  const ghToken = envToken ? null : tokenFromGhCli();
  const auth = Boolean(envToken || ghToken);
  const extractor = findExtractor(lock);
  const ready = code.ok && assets.every(a => a.extracted.ok && (a.archive.ok || a.extracted.marker?.sourceVerified === true));
  return {
    format: 'banane-bootstrap-status-v1',
    command: 'doctor',
    dataset: lock.dataset,
    root: canonicalRoot(lock, root),
    code,
    auth: { available: auth, via: envToken ? 'environment' : (ghToken ? 'gh-cli' : null) },
    extractor: { available: Boolean(extractor), command: extractor },
    assets,
    ready,
  };
}

async function normalizeArchive(lock, asset, located, root = ROOT) {
  const canonical = path.join(canonicalRoot(lock, root), 'downloads', asset.name);
  if (path.normalize(located.file) === path.normalize(canonical)) return located;
  await fsp.mkdir(path.dirname(canonical), { recursive: true });
  await fsp.copyFile(located.file, canonical);
  const verified = await verifyAssetFile(canonical, asset);
  if (!verified.ok) throw new BootstrapError('CANONICAL_COPY_INVALID', `Copie canonique invalide: ${asset.name}`, verified);
  return { ...verified, source: 'local-copy' };
}

async function prepare(lock, opts = {}, env = process.env, root = ROOT) {
  const code = repositoryStatus(lock, root);
  if (!code.ok) throw new BootstrapError('CODE_NOT_COMPATIBLE',
    'Le code local ne correspond pas au socle critique attendu. Corriger le clone avant de préparer les données.', code);

  const results = [];
  for (const asset of lock.assets) {
    let located = await locateVerifiedArchive(lock, asset, env, root);
    if (!located.ok) {
      if (opts.noDownload) {
        throw new BootstrapError('ARCHIVE_MISSING',
          `${asset.name} absent ou invalide et --no-download actif.`, { checked: located.checked });
      }
      const dest = path.join(canonicalRoot(lock, root), 'downloads', asset.name);
      located = await downloadAsset(lock, asset, dest, env);
    } else {
      located = await normalizeArchive(lock, asset, located, root);
    }
    const extraction = await extractVerifiedArchive(lock, asset, located.file, root);
    results.push({ key: asset.key, archive: located, extraction });
  }

  const state = {
    format: 'banane-bootstrap-state-v1',
    dataset: lock.dataset,
    lockSha256: lockFingerprint(lock),
    preparedAt: new Date().toISOString(),
    code: {
      referenceCommit: lock.compatibleCode.referenceCommit,
      criticalFilesVerified: Object.keys(lock.compatibleCode.criticalFiles || {}),
    },
    assets: Object.fromEntries(results.map(r => [r.key, {
      archive: r.archive.file,
      sha256: r.archive.sha256,
      bytes: r.archive.bytes,
      extracted: r.extraction.dir,
      jsonFiles: r.extraction.jsonFiles,
    }])),
    ready: true,
  };
  const statePath = path.join(canonicalRoot(lock, root), 'state.json');
  await fsp.mkdir(path.dirname(statePath), { recursive: true });
  await fsp.writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
  return { format: 'banane-bootstrap-status-v1', command: 'prepare', dataset: lock.dataset, code, assets: results, statePath, state, ready: true };
}

async function verify(lock, env = process.env, root = ROOT) {
  const status = await doctor(lock, env, root);
  status.command = 'verify';
  if (!status.code.ok) return status;
  status.ready = status.assets.every(a => a.extracted.ok &&
    (a.archive.ok || a.extracted.marker?.sourceVerified === true));
  return status;
}

async function resolvePreparedDataset(lock = loadLock(DEFAULT_LOCK), root = ROOT) {
  const v = await verify(lock, process.env, root);
  if (!v.ready) throw new BootstrapError('DATASET_NOT_READY',
    'native-v46 n’est pas READY. Exécuter `node tools/banane-bootstrap.cjs doctor` puis `prepare`.', v);
  return Object.fromEntries(v.assets.map(a => [a.key, a.extracted.dir]));
}

function compactAsset(a) {
  return {
    key: a.key,
    archive: a.archive?.ok ? { status: 'PASS', file: a.archive.file, bytes: a.archive.bytes, sha256: a.archive.sha256 }
      : { status: 'MISSING_OR_INVALID', checked: (a.archive?.checked || []).map(x => ({ file: x.file, code: x.code })) },
    extracted: a.extracted?.ok ? { status: 'PASS', dir: a.extracted.dir, jsonFiles: a.extracted.jsonFiles }
      : { status: a.extracted?.code || 'MISSING' },
  };
}

function outputStatus(status, jsonMode) {
  if (jsonMode) {
    const safe = {
      ...status,
      assets: (status.assets || []).map(a => a.asset ? compactAsset(a) : a),
    };
    process.stdout.write(JSON.stringify(safe, null, 2) + '\n');
    return;
  }
  const row = (k, v, detail = '') => console.log(`${k.padEnd(20)} ${String(v).padEnd(12)}${detail ? ' ' + detail : ''}`);
  row('CODE', status.code?.ok ? 'PASS' : 'FAIL',
    status.code?.ok ? '' : `missing=${status.code?.missing?.length || 0} mismatch=${status.code?.mismatched?.length || 0}`);
  if (status.auth) row('GITHUB_AUTH', status.auth.available ? 'AVAILABLE' : 'MISSING', status.auth.via || '');
  if (status.extractor) row('EXTRACTOR', status.extractor.available ? 'PASS' : 'MISSING', status.extractor.command || '');
  for (const a of status.assets || []) {
    if (a.asset) {
      row(`${a.key.toUpperCase()}_ARCHIVE`, a.archive.ok ? 'PASS' : 'MISSING', a.archive.ok ? a.archive.file : '');
      row(`${a.key.toUpperCase()}_DATA`, a.extracted.ok ? 'PASS' : 'MISSING',
        a.extracted.ok ? `${a.extracted.jsonFiles} JSON` : a.extracted.code);
    } else if (a.archive && a.extraction) {
      row(`${a.key.toUpperCase()}_ARCHIVE`, 'PASS', a.archive.file);
      row(`${a.key.toUpperCase()}_DATA`, 'PASS', `${a.extraction.jsonFiles} JSON`);
    }
  }
  row('DATASET', status.ready ? 'READY' : 'NOT_READY');
  if (!status.ready) {
    console.log('\nAction: monter les deux .7z aux chemins documentés ou fournir GH_TOKEN/GITHUB_TOKEN, puis exécuter `prepare`.');
  }
}

async function main(argv = process.argv) {
  let args;
  try {
    args = parseArgs(argv);
    const lock = loadLock(args.lock);
    let status;
    if (args.command === 'doctor') status = await doctor(lock);
    else if (args.command === 'prepare') status = await prepare(lock, { noDownload: args.noDownload });
    else if (args.command === 'verify') status = await verify(lock);
    else if (args.command === 'paths') {
      const dirs = await resolvePreparedDataset(lock);
      status = { format: 'banane-bootstrap-paths-v1', command: 'paths', dataset: lock.dataset, paths: dirs, ready: true };
    } else {
      throw new BootstrapError('BAD_COMMAND', `Commande inconnue: ${args.command}. Utiliser doctor, prepare, verify ou paths.`);
    }
    if (args.command === 'paths') {
      if (args.json) console.log(JSON.stringify(status, null, 2));
      else Object.entries(status.paths).forEach(([k, v]) => console.log(`${k}=${v}`));
    } else outputStatus(status, args.json);
    process.exitCode = status.ready ? 0 : 2;
  } catch (e) {
    const out = { ready: false, error: e.code || 'UNEXPECTED', message: e.message, details: e.details || null };
    if (args?.json) console.error(JSON.stringify(out, null, 2));
    else {
      console.error(`BOOTSTRAP FAIL [${out.error}] ${out.message}`);
      if (out.details && out.error !== 'AUTH_MISSING') console.error(JSON.stringify(out.details, null, 2));
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  ROOT, DEFAULT_LOCK, BootstrapError,
  parseArgs, loadLock, sha256Buffer, sha256File, verifyAssetFile,
  archiveCandidates, locateVerifiedArchive, commandExists, findExtractor,
  tokenFromEnvironment, tokenFromGhCli, resolveGitHubToken, scanJsonFiles, lockFingerprint,
  readExtractionMarker, repositoryStatus, doctor, prepare, verify,
  resolvePreparedDataset, outputStatus,
};
