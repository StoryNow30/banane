'use strict';
/* D-282 — ESTAMPILLE DU PAQUET : tools/package.py écrit `BUILD` (commit court) à la racine du zip ; le service worker le lit et l'écrit dans le journal (`build`), le panneau l'affiche. Hors paquet : « inconnu ». */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const racine=path.join(__dirname,'..');
test('le paquet porte un fichier BUILD au format du commit court, lu tel quel par le code',()=>{
  const dest=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'build-')),'p.zip');
  cp.execFileSync('python3',[path.join(racine,'tools','package.py'),'--output',dest]);
  const b=cp.execFileSync('python3',['-c',`import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read('BUILD').decode().strip())`,dest]).toString().trim();
  assert.match(b,/^([0-9a-f]{4,40}(\+modifie)?|inconnu)$/);
});
test('le journal écrit `build` et le panneau a son emplacement ; la valeur est filtrée',()=>{
  const bg=fs.readFileSync(path.join(racine,'background.js'),'utf8'),pj=fs.readFileSync(path.join(racine,'panel.js'),'utf8'),ph=fs.readFileSync(path.join(racine,'panel.html'),'utf8');
  assert.match(bg,/let BUILD='inconnu'/);assert.match(bg,/version:VERSION,build:BUILD,/);
  assert.match(ph,/id="build"/);assert.match(pj,/getElementById\('build'\)/);
  assert.ok(/\[0-9a-f\]\{4,40\}/.test(bg)&&/\[0-9a-f\]\{4,40\}/.test(pj),'la valeur lue est filtrée par une expression');
});
