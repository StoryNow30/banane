const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const C=require('../tools/native-corpus.cjs');
const root=path.resolve(__dirname,'..');
test('manifest and bundled runtime form a self-contained MV3 extension without fixture dependencies',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));assert.equal(manifest.manifest_version,3);assert.equal(manifest.version,require('../src/core.js').VERSION);assert.match(manifest.version,/^4\.7\.\d+$/);
 assert.equal(manifest.action.default_popup,undefined);assert.equal(manifest.background.service_worker,'background.js');
 assert.deepEqual(manifest.host_permissions,['https://esv.lidar.altametris.xyz/rails_validation/*']);
 const runtime=['background.js','panel.html','panel.css','panel.js',...fs.readdirSync(path.join(root,'src')).map(x=>'src/'+x),...fs.readdirSync(path.join(root,'vendor')).map(x=>'vendor/'+x)];
 for(const file of runtime){assert.ok(fs.statSync(path.join(root,file)).size>0);assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/tests\/corpus|SimulatedESV|fixture-page/);}
 for(const page of ['panel.html']){const html=fs.readFileSync(path.join(root,page),'utf8');assert.ok(html.includes(`V${manifest.version} · TEST`));const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(fs.existsSync(path.join(root,match[1])));
 }
 for(const group of manifest.content_scripts)for(const p of group.js)assert.ok(fs.existsSync(path.join(root,p)));
 assert.ok(fs.readFileSync(path.join(root,'src/bridge.js'),'utf8').includes(`Banane ${manifest.version} · ouvrir`));
});
test('built installable archive contains runtime sources, offline results and documentation without bulky reference fixtures',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'banane-v3-package-')),zip=path.join(temp,'test.zip'),python=process.platform==='win32'?'python':'python3';
 try{const built=spawnSync(python,[path.join(root,'tools/package.py'),'--output',zip],{encoding:'utf8'});assert.equal(built.status,0,built.stderr);
   const checked=spawnSync(python,['-c','import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); n=z.namelist(); assert z.testzip() is None; assert n.count("manifest.json")==1; assert "banane-v3/manifest.json" not in n; assert all(p in n for p in ["src/engine.js","src/geometry.js","src/gauge.js","src/native-page.js","src/native-session.js","src/native-lidar.js","tools/offline-evaluate.cjs","tools/native-offline-evaluate.cjs","tools/audit-native-geometry.cjs","tools/audit-native-v441.cjs","panel.html","README.md","NATIVE_MODE.md","NATIVE_GEOMETRY_ACCEPTANCE.md","CHANGELOG.md","PROJECT_STATE.md","REQUIREMENTS.md","DECISIONS.md","KNOWN_ISSUES.md","TEST_REPORT.md","NEXT_TASKS.md","OFFLINE_EVALUATION.md","audit/ingestion-certificate-v4.3.0.json","audit/native-fluidity-v4.4.3.json","audit/native-v4.4.1-real-audit.json","audit/native-offline-v4.4.1-baseline.json","audit/verification.json","audit/v4.4.0-frozen-engine-hashes.json","audit/v4.6.0-engine-baseline.json","audit-corpus.md","datasets/automatic/geometry-evaluation-v4.2.0.json","datasets/automatic/offline-evaluation-v4.3.0.json"]); assert not any(p.startswith("/") or ".." in p.split("/") for p in n); assert not any(p.startswith(("archive/","releases/","datasets/manual/","datasets/native/","tests/","audit/v3")) for p in n); print(len(n))',zip],{encoding:'utf8'});
 assert.equal(checked.status,0,checked.stderr);assert.ok(Number(checked.stdout)>30);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
/* V4.6.0, revue Astra. L'archive SOURCE est le seul des deux contrôles qui
 * exige le corpus Natif privé : il vérifie que les trois exports de référence y
 * sont. Séparé de l'archive installable, il peut être ignoré sur un clone
 * propre sans emporter avec lui le contrôle du livrable. Ignoré, pas réussi. */
test('built source archive carries the runnable tests, fixtures and the three native reference exports',{skip:C.skip()},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'banane-v3-source-')),python=process.platform==='win32'?'python':'python3';
 try{
 const source=path.join(temp,'source.zip'),builtSource=spawnSync(python,[path.join(root,'tools/package.py'),'--source','--output',source],{encoding:'utf8'});
 assert.equal(builtSource.status,0,builtSource.stderr);
 const sourceCheck=spawnSync(python,['-c','import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); n=z.namelist(); assert z.testzip() is None; assert all(p in n for p in ("tests/native-lidar.test.cjs","tests/native-session.test.cjs","tests/native-v441-audit.test.cjs","tests/corpus/banane-lidar-part-23-cut-2855-1788941885642.json","tests/incidents/journal-part-24-cut-7460-v3.0.0.json","datasets/native/reference/Banane/banane-native-v4-1789117835514.json","datasets/native/reference/Banane/banane-native-v4-1789120447962.json","datasets/native/reference/Banane/banane-native-v4-1789125861104.json")); assert not any(p.startswith(("archive/","releases/","datasets/manual/")) for p in n); assert not any("openai-download" in p for p in n)',source],{encoding:'utf8'});
 assert.equal(sourceCheck.status,0,sourceCheck.stderr);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
