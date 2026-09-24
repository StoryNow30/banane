'use strict';
/* CHANTIER 5 — §14 A, non-régression 4.7 : les essais de la release 4.7.0
 * (commit du cahier `efe6bab`, liste figée `tests/fixtures/essais-4.7.0.json`)
 * existent toujours, au même fichier, sous le même nom, et s'exécutent.
 *
 * Ce que l'essai prouve : aucun essai de la 4.7.0 n'a été retiré, renommé, ni
 * rendu « todo » ou « skip ». Ce qu'il ne prouve PAS : qu'aucune assertion n'a
 * été affaiblie. Trois fichiers ont changé depuis (`adapter`, `background`,
 * `gcv1-shadow`) ; leur différence est relue dans `audit/chantiers/acceptation.md`. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {extractTests}=require('../tools/acceptance-matrix-check.cjs');
const ROOT=path.join(__dirname,'..');
const REF=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','essais-4.7.0.json'),'utf8'));

test('§14 A : les 547 essais de la 4.7.0 existent toujours, au même fichier, et s\'exécutent',()=>{
  assert.equal(REF.commit,'efe6bab5c1a27f3580f3c9f9cc643a36771ca98c');assert.equal(REF.essais.length,REF.compte);assert.equal(REF.compte,547);
  const courants=new Map();
  for(const f of new Set(REF.essais.map(e=>e.file))){const p=path.join(ROOT,f);courants.set(f,fs.existsSync(p)?extractTests(p):null);}
  const manquants=[],affaiblis=[];
  for(const e of REF.essais){const t=(courants.get(e.file)||[]).find(x=>x.name===e.name);
    if(!t)manquants.push(`${e.file} › ${e.name}`);else if(t.mode!==e.mode)affaiblis.push(`${e.file} › ${e.name} (${e.mode} → ${t.mode})`);}
  assert.deepEqual(manquants,[],'essais de la 4.7.0 disparus');
  assert.deepEqual(affaiblis,[],'essais de la 4.7.0 devenus todo ou skip');
  /* Les deux seuls essais ignorés en 4.7.0 dépendent du corpus Natif privé. */
  assert.deepEqual(REF.essais.filter(e=>e.mode!=='run').map(e=>e.file),['tests/native-geometry-audit.test.cjs','tests/package.test.cjs']);
});
