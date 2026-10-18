'use strict';
/* 5.0, D-179 — tools/relecture-maquette.cjs règle la copie (hors du dépôt) de la maquette ESV du banc de la relecture : Maj+Espace valide
 * SUR PLACE un cut vert (`majEspace=surplace`), « vu » et cuts rouges bornés. L'essai part de la maquette de la branche
 * claude/esv-locale-audit si elle est présente dans ce dépôt (sinon, il est passé). Rien d'ESV : la maquette est celle de l'audit. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const M=require('../tools/relecture-maquette.cjs');
const FICHIERS=['esv-maquette.js','scenario.cjs','serveur.cjs'];
function extraire(){const d=fs.mkdtempSync(path.join(os.tmpdir(),'maquette-'));
 try{for(const f of FICHIERS)fs.writeFileSync(path.join(d,f),cp.execFileSync('git',['show',`origin/claude/esv-locale-audit:tests/esv-maquette/${f}`],{cwd:path.join(__dirname,'..'),stdio:['ignore','pipe','ignore']}));}
 catch{fs.rmSync(d,{recursive:true,force:true});return null;}
 return d;}

test('la maquette réglée valide sur place un vert (surplace), garde l’ancien geste sur un rouge, et le réglage est idempotent',{timeout:15000},t=>{
 const d=extraire();if(!d)return t.skip('maquette de la branche claude/esv-locale-audit absente de ce dépôt');
 try{
  assert.deepEqual(M.regler(d).sort(),[...FICHIERS].sort());
  const apres=FICHIERS.map(f=>fs.readFileSync(path.join(d,f),'utf8'));
  assert.deepEqual(M.regler(d),[],'déjà réglée : rien n’est refait');
  assert.deepEqual(FICHIERS.map(f=>fs.readFileSync(path.join(d,f),'utf8')),apres);
  for(const f of FICHIERS)cp.execFileSync(process.execPath,['--check',path.join(d,f)]);
  const m=apres[0];
  assert.equal(m.split("options.majEspace==='surplace'?majEspaceSurPlace()").length-1,1,'une seule branche « sur place » dans le geste Maj+Espace');
  assert.match(m,/function majEspaceSurPlace\(\)\{if\(cutCourant\(\)\.status==='valid'\)return validerSurPlace\(\);return validerEtSuivant\(\);\}/);
  assert.equal(m.split(';marquerVu(c,generation);').length-1,1,'un seul « vu » par chargement');
 }finally{fs.rmSync(d,{recursive:true,force:true});}
});

test('une maquette inattendue est refusée, sans rien écrire',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'maquette-'));
 try{for(const f of FICHIERS)fs.writeFileSync(path.join(d,f),'// autre maquette\n');
  assert.throws(()=>M.regler(d),/Maquette inattendue/);
  assert.equal(fs.readFileSync(path.join(d,'esv-maquette.js'),'utf8'),'// autre maquette\n');
 }finally{fs.rmSync(d,{recursive:true,force:true});}
});
