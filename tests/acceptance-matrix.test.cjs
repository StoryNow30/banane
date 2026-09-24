'use strict';
/* CHANTIER 5 — la matrice d'acceptation (`tests/ACCEPTANCE_MATRIX.md`) est
 * contrôlée à chaque banc : `tools/acceptance-matrix-check.cjs` échoue si une
 * ligne désigne un fichier ou un essai qui n'existe pas, si une exigence
 * disparaît, ou si un statut ne tient pas à ses essais. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const M=require('../tools/acceptance-matrix-check.cjs');
const ROOT=path.join(__dirname,'..');
const ligne=(id,tests,statut,preuve='preuve')=>`| ${id} | exigence | ${tests.map(([f,n])=>`\`${f}\` › \`${n}\``).join('<br>')} | ${statut} | ${preuve} |`;
const matrice=lignes=>['| Id | Exigence | Tests | Statut | Preuve |','|---|---|---|---|---|',...lignes].join('\n');
const OK=['tests/gauge-contract.test.cjs','les six frontières exactes du contrat'];

test('la matrice d\'acceptation ne désigne que des fichiers et des essais qui existent',()=>{
  const p=spawnSync(process.execPath,[path.join(ROOT,'tools/acceptance-matrix-check.cjs')],{cwd:ROOT,encoding:'utf8'});
  assert.equal(p.status,0,p.stdout+p.stderr);assert.match(p.stdout,/Contrôle réussi/);
  const r=M.check(fs.readFileSync(path.join(ROOT,'tests/ACCEPTANCE_MATRIX.md'),'utf8'));
  assert.deepEqual(r.errors,[]);assert.equal(r.counts.COUVERT+r.counts.PARTIEL+r.counts.MANQUANT,M.REQUIRED.length);
});

test('contrôle : fichier absent, essai inconnu, exigence perdue, doublon ou statut invalide font échouer',()=>{
  const r=M.check(matrice([ligne('§7.1',[['tests/absent.test.cjs','x']],'COUVERT'),ligne('§7.2',[[OK[0],'nom inventé']],'COUVERT'),
    ligne('§7.3',[OK],'VERT'),ligne('§7.3',[OK],'COUVERT'),ligne('§7.4',[['tools/verify.cjs','x']],'PARTIEL'),
    '| §7.5 | exigence | `audit/bilan-absent.md` | MANQUANT | preuve |']),{required:['§7.1','§7.2','§7.3','§7.4','§7.5','§7.6']});
  assert.equal(r.ok,false);const e=r.errors.join('\n');
  for(const attendu of [/fichier d'essais introuvable : tests\/absent\.test\.cjs/,/essai introuvable dans tests\/gauge-contract\.test\.cjs : « nom inventé »/,
    /statut invalide « VERT »/,/exigence en double/,/pas un fichier d'essais : tools\/verify\.cjs/,/fichier introuvable : audit\/bilan-absent\.md/,/exigence absente de la matrice : §7\.6/])
    assert.match(e,attendu);
});

test('contrôle : COUVERT exige un essai qui s\'exécute ; un « todo » ou un « skip » ne prouve rien ; §14 B suit le plus faible des §7',()=>{
  const todo=['tests/acceptance-objectifs.test.cjs','§14 G : C5, le bilan des curseurs, est rapporté avec C1 à C4'];
  const skip=['tests/native-geometry-audit.test.cjs','the three read-only Terra exports reproduce the demonstrated geometry loss'];
  const r=M.check(matrice([ligne('§7.1',[OK,todo],'COUVERT'),ligne('§7.2',[skip],'COUVERT'),ligne('§7.3',[],'COUVERT'),
    ligne('§7.4',[OK],'MANQUANT'),ligne('§7.5',[todo],'MANQUANT'),'| §14 B | exigence | → §7.1 à §7.10 | COUVERT | dérivé |']),{required:[]});
  const e=r.errors.join('\n');
  assert.match(e,/§7\.1 : COUVERT avec un essai todo/);assert.match(e,/§7\.2 : COUVERT avec un essai skip/);
  assert.match(e,/§7\.3 : COUVERT sans aucun essai/);assert.match(e,/§7\.4 : MANQUANT alors que/);
  assert.doesNotMatch(e,/§7\.5/,'un essai todo peut documenter une exigence MANQUANTE');
  assert.match(e,/§14 B déclaré COUVERT alors que la plus faible des lignes dont il dérive est MANQUANT/);
  assert.deepEqual(r.todo.length,2);
});

test('noms d\'essais : littéral, gabarit et concaténation reconnus comme dans la sortie du banc',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'matrice-'));
  try{const f=path.join(dir,'x.test.cjs');
    fs.writeFileSync(f,["test('un nom d\\'essai',()=>{});",'test("guillemets",{todo:\'KI-000\'},()=>{});',
      "for(const n of [1,2])test(`gabarit ${n} fini`,()=>{});","test('début '+Math.round(v/1024)+' Ko fin',{skip:true},()=>{});",
      "assert.ok(/x/.test('pas un essai'));test.todo('marqué todo');"].join('\n'));
    const t=M.extractTests(f),par=n=>t.find(x=>x.name===n||x.pattern?.test(n));
    assert.deepEqual(t.map(x=>x.mode),['run','todo','run','skip','todo']);
    assert.equal(par('un nom d\'essai').mode,'run');assert.equal(par('guillemets').mode,'todo');
    assert.ok(par('gabarit 2 fini'));assert.ok(par('début 400 Ko fin'));assert.equal(par('pas un essai'),undefined);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
  /* Les noms construits du banc réel sont reconnus sous leur forme développée. */
  assert.ok(M.findTest('tests/gauge-hard-gate.test.cjs','écartement en dessous de 1405 : aucune commande, aucun VALIDATE, aucun SKIP, état récupérable'));
  assert.ok(M.findTest('tests/terrain-reel.test.cjs','découper à 900 Ko puis fusionner rend la session entière'));
});
