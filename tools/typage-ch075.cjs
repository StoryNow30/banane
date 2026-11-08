'use strict';
// Vérification sans émission et identité structurelle hors commentaires et parenthèses neutres.
const ts=require('typescript'),fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const PERIMETRE=['src/appuis-liste.js'];
const BASE='5699f68';
const ORIGINE='966d52431947b3c8710ede1c866f141a32620c3e969308a480a878f072d60d02';
const EMPREINTE='f1c7c1cbd7a52009c8662abb0b42b59a47cbc28dcc0dd81338c55d164a5d2b0e';
const sha=texte=>crypto.createHash('sha256').update(texte).digest('hex');
function configuration(){
 const config=ts.readConfigFile('tsconfig.ch075.json',ts.sys.readFile);
 if(config.error)throw Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
 const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,'.');
 assert.deepEqual(parsed.fileNames.filter(x=>x.endsWith('.js')),PERIMETRE,'Périmètre JS modifié');
 assert.notEqual(parsed.options.noCheck,true,'Vérification désactivée');
 for(const cle of ['allowJs','checkJs','noEmit','strict'])assert.equal(parsed.options[cle],true,cle);
 return parsed;
}
function verifier(extra=[]){const c=configuration();for(const fichier of PERIMETRE){const texte=fs.readFileSync(fichier,'utf8');assert.ok(!/@ts-(?:nocheck|ignore|expect-error)\b|\bany\b/.test(texte),`${fichier} : échappatoire de typage interdite`);}const p=ts.createProgram([...c.fileNames,...extra],c.options);return ts.getPreEmitDiagnostics(p);}
function jetons(source){
 const arbre=ts.createSourceFile('module.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 assert.equal(arbre.parseDiagnostics.length,0,'JavaScript invalide');
 function structure(n){
  // Seules les parenthèses des assertions JSDoc sont neutralisées, jamais une directive.
  const assertion=ts.isParenthesizedExpression(n)&&/@type\s*\{/.test(source.slice(n.getFullStart(),n.getStart(arbre)));
  if(assertion&&!ts.isStringLiteral(n.expression))return structure(n.expression);
  const enfants=n.getChildren(arbre).filter(x=>!(x.kind>=ts.SyntaxKind.FirstJSDocNode&&x.kind<=ts.SyntaxKind.LastJSDocNode));
  return [n.kind,n.flags & ts.NodeFlags.OptionalChain,enfants.length?null:n.getText(arbre),enfants.map(structure)];
 }
 return JSON.stringify(structure(arbre));
}
function identite(){return PERIMETRE.map(f=>{const empreinte=sha(jetons(fs.readFileSync(f,'utf8')));assert.equal(empreinte,EMPREINTE,`${f} : code exécuté modifié`);return {fichier:f,sha256:empreinte};});}
function origine(){const avant=cp.execFileSync('git',['show',`${BASE}:${PERIMETRE[0]}`],{encoding:'utf8'});assert.equal(sha(avant),ORIGINE);assert.equal(sha(jetons(avant)),EMPREINTE);return {base:BASE,sha256Source:ORIGINE,sha256Ast:EMPREINTE};}
function main(){
 if(process.argv.includes('--origine'))console.log(JSON.stringify(origine()));
 const erreurs=verifier(['tests/typage-ch075/positif.js']);
 if(erreurs.length){process.stderr.write(ts.formatDiagnosticsWithColorAndContext(erreurs,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));process.exitCode=1;return;}
 for(const nom of ['unites','reperes','coupe-partie','operation']){const fichier=`tests/typage-ch075/${nom}.js`,d=verifier([fichier]).filter(x=>x.file?.fileName.endsWith(fichier));const lignes=fs.readFileSync(fichier,'utf8').split('\n');assert.ok(lignes.some(x=>x.includes('// rejet')),`${nom} : aucun rejet attendu`);for(const [ligne,texte] of lignes.entries()){if(!texte.includes('// rejet'))continue;assert.ok(d.some(x=>(x.code===2322||x.code===2345)&&x.file.getLineAndCharacterOfPosition(x.start).line===ligne),`${nom}:${ligne+1} : confusion non rejetée`);}}
 console.log(JSON.stringify({perimetre:PERIMETRE,erreurs:erreurs.length,identite:identite()},null,2));
}
module.exports={verifier,jetons,identite,origine,PERIMETRE,ORIGINE,EMPREINTE};if(require.main===module)main();
