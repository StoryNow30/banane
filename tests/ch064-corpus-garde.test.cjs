'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const racine=path.resolve(__dirname,'..');
function essai(t,code,preparer=()=>{}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch064-corpus-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));preparer(dir);return cp.spawnSync(process.execPath,['-e',code],{cwd:racine,env:{...process.env,BANANE_DATA:dir},encoding:'utf8'});}
function archive(d){const dossier=path.join(d,'collections','2026-11-04_essai');fs.mkdirSync(dossier,{recursive:true});const r=cp.spawnSync('python3',['-c',"import sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],'w') as z: z.writestr('document.json','{}')",path.join(dossier,'essai.zip')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
test('CH-064 : le corpus absent ou sans archive ne peut pas produire une parité verte',t=>{
 for(const preparer of [()=>{},d=>fs.mkdirSync(path.join(d,'collections'))]){const r=essai(t,"require('./tools/ch064-corpus.cjs').zips()",preparer);assert.notEqual(r.status,0);assert.match(r.stderr,/Corpus (absent|vide)/);}
});
test('CH-064 : le cache de décision reste dans le dépôt de données',t=>{
 const r=essai(t,"const assert=require('node:assert/strict'),path=require('node:path');assert.equal(require('./tools/ch064-d-reel.cjs').CACHE,path.join(process.env.BANANE_DATA,'.cache','ch064','ch064-d-reel.v8'))");assert.equal(r.status,0,r.stderr);
});
test('CH-064 : la parité E refuse aussi un corpus vide, avant tout appel au cœur',async t=>{
 const r=essai(t,"require('./tools/ch064-e-parite.cjs').corpus({appeler(){throw Error('appel inattendu');}}).then(()=>process.exit(2),e=>{if(!/Corpus (absent|vide)/.test(e.message)){console.error(e);process.exit(3);}})",d=>fs.mkdirSync(path.join(d,'collections')));assert.equal(r.status,0,r.stderr);
});
test('CH-064 : le chemin clone ou collections sélectionne les mêmes archives',t=>{
 for(const prefixe of ['',"process.env.BANANE_DATA=require('node:path').join(process.env.BANANE_DATA,'collections');"]){const r=essai(t,prefixe+"require('node:assert/strict').equal(require('./tools/ch064-corpus.cjs').zips().length,1)",archive);assert.equal(r.status,0,r.stderr);}
});
test('CH-064 : une archive sans document exploitable ne suffit ni à D ni à E',t=>{
 const r=essai(t,"const assert=require('node:assert/strict'),fs=require('node:fs'),D=require('./tools/ch064-d-reel.cjs');assert.throws(()=>D.extrait(),/Corpus vide/);assert.equal(fs.existsSync(D.CACHE),false);require('./tools/ch064-e-parite.cjs').corpus({}).then(()=>process.exit(2),e=>{if(!/Corpus vide/.test(e.message)){console.error(e);process.exit(3);}})",archive);assert.equal(r.status,0,r.stderr);
});
