const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),audit=path.join(root,'audit');fs.mkdirSync(audit,{recursive:true});
/* V4.6.0, revue Astra — deux modes, et la différence est écrite dans l'audit.
 *
 * PARTIEL (par défaut) : depuis un clone GitHub propre, `datasets/native/` est
 * absent — 47 Mo d'exports privés exclus sur consigne. Les deux tests qui en
 * dépendent s'y IGNORENT eux-mêmes, avec leur raison dans la sortie TAP. Le
 * banc va jusqu'au bout : contrôles de syntaxe, empreintes gelées et baseline
 * moteur sont exécutés comme toujours. Un test ignoré n'est pas un test réussi,
 * et les artefacts le disent.
 *
 * COMPLET (`--full`, ou BANANE_BANC=full) : celui du poste de travail. Il exige
 * le corpus et refuse le moindre test ignoré. C'est le seul mode qui autorise à
 * annoncer un banc entièrement vert. */
const C=require('./native-corpus.cjs');
const full=process.argv.includes('--full')||process.env.BANANE_BANC==='full';
const corpus=C.status(root);
if(full&&!corpus.present)throw Error(`Mode complet demandé, corpus Natif absent : ${corpus.missing.join(', ')}. Replace-les (datasets/native/README.md) ou lance le banc sans --full.`);
const startedAt=new Date().toISOString(),log=[`Started: ${startedAt}\nNode: ${process.version}\nPlatform: ${process.platform}\n`,
 `Bench mode: ${full?'full (corpus required, no skip tolerated)':corpus.present?'default (native corpus present)':'partial (native corpus absent: 2 tests skipped, not passed)'}\n`,
 corpus.present?'Native corpus: present.\n':`Native corpus: ABSENT — missing ${corpus.missing.join(', ')}. See datasets/native/README.md.\n`];
function run(args){log.push(`\n$ node ${args.join(' ')}\n`);const p=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});log.push(p.stdout||'',p.stderr||'',`Exit code: ${p.status}\n`);if(p.status!==0){fs.writeFileSync(path.join(audit,'verification.txt'),log.join(''));throw Error('Failed: '+args.join(' '));}return p.stdout;}
// V4 uses separate Node fixtures for input interception and the recording session.
const files=['tests','tests/v242'].flatMap(d=>fs.readdirSync(path.join(root,d)).filter(f=>f.endsWith('.test.cjs')).sort().map(f=>`${d}/${f}`));
const output=run(['--test','--test-reporter=tap','--test-timeout=10000',...files]);
const counts={};for(const name of ['tests','suites','pass','fail','cancelled','skipped','todo'])counts[name]=Number(output.match(new RegExp(`# ${name} (\\d+)`))?.[1]??-1);
// En mode complet, un test ignoré est un échec : rien ne doit manquer au relevé.
if(full&&counts.skipped>0){fs.writeFileSync(path.join(audit,'verification.txt'),log.join(''));throw Error(`Mode complet : ${counts.skipped} test(s) ignoré(s). Le banc complet n'en tolère aucun.`);}
if(counts.skipped>0)log.push(`\n${counts.skipped} test(s) skipped because the private native corpus is absent. Skipped is not passed. See datasets/native/README.md.\n`);
const runtime=['background.js','panel.js','tools/offline-evaluate.cjs','tools/native-offline-evaluate.cjs','tools/audit-native-geometry.cjs','tools/audit-native-v441.cjs','tools/results.cjs','tools/native-fluidity.cjs',...['src','vendor'].flatMap(d=>fs.readdirSync(path.join(root,d)).filter(f=>f.endsWith('.js')).map(f=>`${d}/${f}`))];
for(const file of runtime)run(['--check',file]);
/* V4.6.0. `src/engine.js` est dégelé sur décision explicite pour les défauts 4
 * et 9 d'AUDIT_PILOTE.md ; il n'est pas rendu libre pour autant, il est
 * RÉ-ÉPINGLÉ sur une baseline déclarée. Le contrôle reste donc aussi strict
 * qu'avant : toute dérive non déclarée du moteur fait échouer le banc.
 *
 * `audit/v4.4.0-frozen-engine-hashes.json` n'est PAS modifié — règle de
 * passation. Les trois autres fichiers y sont toujours vérifiés octet pour
 * octet, et la baseline V4.6.0 doit en recopier les empreintes à l'identique :
 * elle ne peut donc pas servir à assouplir le gel historique par la bande. */
const previousHashes=JSON.parse(fs.readFileSync(path.join(audit,'v4.4.0-frozen-engine-hashes.json')));
const engineBaseline=JSON.parse(fs.readFileSync(path.join(audit,'v4.6.0-engine-baseline.json')));
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const frozenFiles=Object.keys(previousHashes).filter(f=>f!=='src/engine.js');
const geometryUnchanged=frozenFiles.every(f=>sha(f)===previousHashes[f]);
if(!geometryUnchanged){fs.writeFileSync(path.join(audit,'verification.txt'),log.join(''));throw Error('Le placement, les transformations de coordonnées ou le lecteur LiDAR partagé ont changé : ils restent gelés à la référence 4.4.0.');}
const baselineKeepsHistory=frozenFiles.every(f=>engineBaseline.unchangedSince440?.[f]===previousHashes[f])
  &&engineBaseline.engine?.previousHash440===previousHashes['src/engine.js'];
if(!baselineKeepsHistory){fs.writeFileSync(path.join(audit,'verification.txt'),log.join(''));throw Error('La baseline V4.6.0 ne recopie pas les empreintes historiques 4.4.0 : empreintes historiques non modifiables.');}
const engineMatchesBaseline=sha('src/engine.js')===engineBaseline.engine?.['src/engine.js'];
if(!engineMatchesBaseline){fs.writeFileSync(path.join(audit,'verification.txt'),log.join(''));throw Error('src/engine.js ne correspond pas à la baseline déclarée audit/v4.6.0-engine-baseline.json. Mets la baseline à jour sciemment, ou annule la modification du moteur.');}
log.push('\nPlacement, coordinate transforms and shared LiDAR reader unchanged from 4.4.0 (SHA-256). Engine pinned to the declared V4.6.0 baseline. Native collection uses a separate reader.\n');
// Relevé d'empreintes pour l'audit — il n'assure aucun contrôle : les fichiers
// gelés sont vérifiés ci-dessus contre audit/v4.4.0-frozen-engine-hashes.json,
// qui n'est pas modifié, et le moteur contre la baseline V4.6.0. Les pages sont
// découvertes plutôt qu'énumérées, pour qu'aucune ne puisse manquer au relevé
// après un remaniement de l'interface.
const pages=fs.readdirSync(root).filter(f=>f.endsWith('.html')).sort();
const hashes=Object.fromEntries(['manifest.json',...pages,'panel.css',...runtime].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const results={startedAt,finishedAt:new Date().toISOString(),node:process.version,platform:process.platform,counts,files,runtimeFilesSyntaxChecked:runtime.length,hashes,geometryUnchanged,
 frozenSince440:frozenFiles,engineBaselineVersion:engineBaseline.version,engineMatchesBaseline,engineHash:sha('src/engine.js'),engineHash440:previousHashes['src/engine.js'],
 /* Statut explicite du corpus : sans lui, ce relevé ne vaut pas pour un banc
  * complet, et `benchMode` le dit plutôt que de laisser lire 369/371 comme un
  * banc vert. */
 benchMode:full?'full':corpus.present?'default':'partial',nativeCorpus:corpus,skippedForMissingCorpus:counts.skipped,
 allTestsExecuted:counts.skipped===0,
 browserExtensionLoad:'NOT_EXECUTED: management URL blocked',browserUI:'NOT_EXECUTED: ERR_BLOCKED_BY_CLIENT',realIndexedDB:'NOT_EXECUTED',realESV:'NOT_EXECUTED: no connected ESV test session'};
fs.writeFileSync(path.join(audit,'verification.txt'),log.join(''));fs.writeFileSync(path.join(audit,'verification.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.counts));console.log(`Syntax: ${runtime.length} runtime files. Geometry unchanged: ${geometryUnchanged}. Engine matches V4.6.0 baseline: ${engineMatchesBaseline}.`);
console.log(`Bench mode: ${results.benchMode}. Native corpus: ${corpus.present?'present':'absent ('+corpus.missing.length+' files)'}. Skipped: ${counts.skipped}${counts.skipped?' — skipped is not passed':''}. Complete output: audit/verification.txt`);
