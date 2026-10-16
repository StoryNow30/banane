'use strict';
/* U8 (audit 5.0) : machine partagée. `tools/verify.cjs`
 *  - lance ses essais avec une priorité basse (nice), quand c'est possible sous Linux ;
 *  - refuse de partir, avec un message clair, si un verrou « rejeu lourd » est posé ;
 *  - lit le chemin du verrou dans la variable d'environnement BANANE_VERROU_LOURD (par défaut `lourd.lock` à côté du dépôt,
 *    jamais un chemin codé en dur) ;
 *  - n'écrit rien dans audit/ quand il refuse. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const Garde = require('../tools/verify-garde.cjs');
const racine = path.join(__dirname, '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'verify-garde-'));

test('le chemin du verrou vient de la variable d\'environnement, sinon d\'un chemin relatif au dépôt', () => {
  assert.equal(Garde.cheminVerrou({ BANANE_VERROU_LOURD: '/un/endroit/quelconque.lock' }, '/depot/x'), '/un/endroit/quelconque.lock');
  assert.equal(Garde.cheminVerrou({}, '/espace/wt/HYG'), path.join('/espace/wt', 'lourd.lock'), 'par défaut : lourd.lock dans le dossier qui contient le dépôt');
  assert.equal(Garde.cheminVerrou({ BANANE_VERROU_LOURD: '' }, '/espace/wt/HYG'), null, 'variable vide : pas de contrôle');
  assert.ok(!/claude-|scratchpad|\/tmp\//.test(fs.readFileSync(path.join(racine, 'tools', 'verify-garde.cjs'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'aucun chemin du carnet codé en dur');
});

test('un verrou posé fait refuser le départ, avec un message qui dit quoi faire', () => {
  const d = tmp();
  try {
    const verrou = path.join(d, 'lourd.lock');
    assert.doesNotThrow(() => Garde.refuserSiVerrou({ BANANE_VERROU_LOURD: verrou }, racine), 'pas de verrou : on part');
    fs.writeFileSync(verrou, 'rejeu de la partie 29\n');
    assert.throws(() => Garde.refuserSiVerrou({ BANANE_VERROU_LOURD: verrou }, racine), e => {
      assert.ok(e instanceof Garde.VerrouPose);
      assert.match(e.message, /rejeu lourd/); assert.match(e.message, /rejeu de la partie 29/);
      assert.ok(e.message.includes(verrou)); assert.match(e.message, /BANANE_VERROU_LOURD/); assert.match(e.message, /disparu/);
      return true;
    });
    assert.doesNotThrow(() => Garde.refuserSiVerrou({ BANANE_VERROU_LOURD: '' }, racine), 'variable vide : contrôle coupé');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('priorité basse : demandée sous Linux, jamais relevée, sans effet ni erreur ailleurs', () => {
  const appels = [];
  const faux = (prio, { plateforme = 'linux', leve = false } = {}) => ({ getPriority: () => prio, setPriority: (pid, v) => { if (leve) throw Error('interdit'); appels.push([pid, v]); } });
  assert.equal(Garde.baisserPriorite(faux(0), 'linux'), 10); assert.deepEqual(appels, [[0, 10]]);
  appels.length = 0;
  assert.equal(Garde.baisserPriorite(faux(15), 'linux'), 15, 'déjà plus basse : on la garde'); assert.deepEqual(appels, []);
  assert.equal(Garde.baisserPriorite(faux(0), 'win32'), null); assert.deepEqual(appels, []);
  assert.equal(Garde.baisserPriorite(faux(0, { leve: true }), 'linux'), null, 'une erreur du système ne fait pas échouer verify');
  assert.equal(Garde.baisserPriorite(faux(0), 'linux', 5), 5, 'valeur choisie');
});

test('priorité basse : un processus qui l\'appelle la voit, et ses enfants l\'héritent (Linux)', { skip: process.platform !== 'linux' && 'priorité nice : Linux seulement' }, () => {
  const code = `const G=require(${JSON.stringify(path.join(racine, 'tools', 'verify-garde.cjs'))});G.baisserPriorite();`
    + `console.log(require('os').getPriority()+','+require('child_process').execFileSync(process.execPath,['-e','console.log(require("os").getPriority())'],{encoding:'utf8'}).trim());`;
  const r = cp.spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const [soi, enfant] = r.stdout.trim().split(',').map(Number);
  assert.ok(soi >= 10 && enfant >= 10, r.stdout);
});

test('verify.cjs refuse de partir quand le verrou est posé, sans toucher aux relevés', () => {
  const d = tmp();
  try {
    const verrou = path.join(d, 'lourd.lock'); fs.writeFileSync(verrou, 'rejeu lourd de la partie 24\n');
    const empreinte = f => { try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(racine, 'audit', f))).digest('hex'); } catch { return null; } };
    const avant = ['verification.txt', 'verification.json'].map(empreinte);
    const r = cp.spawnSync(process.execPath, [path.join(racine, 'tools', 'verify.cjs')], { encoding: 'utf8', env: { ...process.env, BANANE_VERROU_LOURD: verrou }, timeout: 60000 });
    assert.equal(r.status, 3, r.stdout + r.stderr);
    assert.match(r.stderr, /rejeu lourd/); assert.match(r.stderr, /rejeu lourd de la partie 24/); assert.match(r.stderr, /BANANE_VERROU_LOURD/);
    assert.deepEqual(['verification.txt', 'verification.json'].map(empreinte), avant, 'audit/verification.* inchangés');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('verify.cjs appelle le garde avant tout le reste, et baisse sa priorité', () => {
  const src = fs.readFileSync(path.join(racine, 'tools', 'verify.cjs'), 'utf8');
  const iGarde = src.indexOf('refuserSiVerrou'), iPrio = src.indexOf('baisserPriorite'), iEssais = src.indexOf("run(['--test'");
  assert.ok(iGarde > 0 && iPrio > 0 && iEssais > 0);
  assert.ok(iGarde < iEssais && iPrio < iEssais, 'avant le lancement des essais');
  assert.ok(src.indexOf('refuserSiVerrou') < src.indexOf('fs.mkdirSync(audit'), 'avant d\'écrire dans audit/');
});
