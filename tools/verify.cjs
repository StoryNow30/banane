const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),audit=path.join(root,'audit');fs.mkdirSync(audit,{recursive:true});
const startedAt=new Date().toISOString(),log=[`Started: ${startedAt}\nNode: ${process.version}\nPlatform: ${process.platform}\n`];
function run(args){log.push(`\n$ node ${args.join(' ')}\n`);const p=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});log.push(p.stdout||'',p.stderr||'',`Exit code: ${p.status}\n`);if(p.status!==0){fs.writeFileSync(path.join(audit,'verification.txt'),log.join(''));throw Error('Failed: '+args.join(' '));}return p.stdout;}
// V4 uses separate Node fixtures for input interception and the recording session.
const files=['tests','tests/v242'].flatMap(d=>fs.readdirSync(path.join(root,d)).filter(f=>f.endsWith('.test.cjs')).sort().map(f=>`${d}/${f}`));
const output=run(['--test','--test-reporter=tap','--test-timeout=10000',...files]);
const counts={};for(const name of ['tests','suites','pass','fail','cancelled','skipped','todo'])counts[name]=Number(output.match(new RegExp(`# ${name} (\\d+)`))?.[1]??-1);
const runtime=['background.js','panel.js','tools/offline-evaluate.cjs','tools/native-offline-evaluate.cjs','tools/audit-native-geometry.cjs','tools/audit-native-v441.cjs','tools/results.cjs','tools/native-fluidity.cjs',...['src','vendor'].flatMap(d=>fs.readdirSync(path.join(root,d)).filter(f=>f.endsWith('.js')).map(f=>`${d}/${f}`))];
for(const file of runtime)run(['--check',file]);
const previousHashes=JSON.parse(fs.readFileSync(path.join(audit,'v4.4.0-frozen-engine-hashes.json'))),frozenFiles=Object.keys(previousHashes);
const geometryUnchanged=frozenFiles.every(f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')===previousHashes[f]);
if(!geometryUnchanged){fs.writeFileSync(path.join(audit,'verification.txt'),log.join(''));throw Error('Le moteur, le pilote ou le lecteur LiDAR partagé a changé pendant un chantier Natif.');}
log.push('\nPlacement engine, pilot and shared LiDAR reader unchanged from 4.4.0 (SHA-256). Native collection uses a separate reader.\n');
// Relevé d'empreintes pour l'audit — il n'assure aucun contrôle : le moteur
// gelé est vérifié lignes 11-13 contre audit/v4.4.0-frozen-engine-hashes.json,
// qui n'est pas modifié. Les pages sont découvertes plutôt qu'énumérées, pour
// qu'aucune ne puisse manquer au relevé après un remaniement de l'interface.
const pages=fs.readdirSync(root).filter(f=>f.endsWith('.html')).sort();
const hashes=Object.fromEntries(['manifest.json',...pages,'panel.css',...runtime].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const results={startedAt,finishedAt:new Date().toISOString(),node:process.version,platform:process.platform,counts,files,runtimeFilesSyntaxChecked:runtime.length,hashes,geometryUnchanged,
 browserExtensionLoad:'NOT_EXECUTED: management URL blocked',browserUI:'NOT_EXECUTED: ERR_BLOCKED_BY_CLIENT',realIndexedDB:'NOT_EXECUTED',realESV:'NOT_EXECUTED: no connected ESV test session'};
fs.writeFileSync(path.join(audit,'verification.txt'),log.join(''));fs.writeFileSync(path.join(audit,'verification.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.counts));console.log(`Syntax: ${runtime.length} runtime files. Geometry unchanged: ${geometryUnchanged}. Complete output: audit/verification.txt`);
