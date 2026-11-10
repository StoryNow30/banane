'use strict';
// Vérification sans émission et identité structurelle hors commentaires et parenthèses neutres.
const ts=require('typescript'),fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
// Références gelées par fichier : texte (source) et arbre syntaxique (ast) du fichier non annoté, à la base indiquée.
const REFERENCES={
 'src/appuis-liste.js':{base:'5699f68',source:'966d52431947b3c8710ede1c866f141a32620c3e969308a480a878f072d60d02',ast:'f1c7c1cbd7a52009c8662abb0b42b59a47cbc28dcc0dd81338c55d164a5d2b0e'},
 /* CH-097 (défaut 3) : le code de la file change (alertes : écrits de la passe, refus de la relecture). Référence refaite sur le commit du changement ;
  * l'ancienne (base 32c4783, arbre 9d59d93b…) reste lisible dans l'historique. Si l'intégration ne garde pas ce commit, refaire la base sur le tronc. */
 'src/file-parties.js':{base:'a674e14',source:'4f11c329d04c5e7890511d7682d3e42ecb9df8e0bc46fbeb2dd0a4724f61ce02',ast:'a94dbfefb4c4ce1200ce8f0d58b7d9bd2bf0c75f9a8710a426d817d024394207'},
 'src/file-prioritaire.js':{base:'32c4783',source:'c43494abd24fd2ff21ac410021c6e66e2ed6dea1eb172b8ef8633cb147f6bab1',ast:'ed5fc7e67e598d1098b8332bb3f0a5674e022086f585884e24cbfc68e236c566'},
};
const PERIMETRE=['src/appuis-liste.js','src/file-prioritaire.js','src/file-parties.js'];
const ORIGINE=REFERENCES[PERIMETRE[0]].source,EMPREINTE=REFERENCES[PERIMETRE[0]].ast;
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
function identite(){return PERIMETRE.map(f=>{const empreinte=sha(jetons(fs.readFileSync(f,'utf8')));assert.equal(empreinte,REFERENCES[f].ast,`${f} : code exécuté modifié`);return {fichier:f,sha256:empreinte};});}
function origine(){return PERIMETRE.map(f=>{const r=REFERENCES[f],avant=cp.execFileSync('git',['show',`${r.base}:${f}`],{encoding:'utf8'});assert.equal(sha(avant),r.source,`${f} : texte de base`);assert.equal(sha(jetons(avant)),r.ast,`${f} : arbre de base`);return {fichier:f,base:r.base,sha256Source:r.source,sha256Ast:r.ast};});}
function main(){
 if(process.argv.includes('--origine'))console.log(JSON.stringify(origine()));
 const erreurs=verifier(['tests/typage-ch075/positif.js']);
 if(erreurs.length){process.stderr.write(ts.formatDiagnosticsWithColorAndContext(erreurs,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));process.exitCode=1;return;}
 for(const nom of ['unites','reperes','coupe-partie','operation','file-partie-coupe','file-coupe-operation']){const fichier=`tests/typage-ch075/${nom}.js`,d=verifier([fichier]).filter(x=>x.file?.fileName.endsWith(fichier));const lignes=fs.readFileSync(fichier,'utf8').split('\n');assert.ok(lignes.some(x=>x.includes('// rejet')),`${nom} : aucun rejet attendu`);for(const [ligne,texte] of lignes.entries()){if(!texte.includes('// rejet'))continue;assert.ok(d.some(x=>(x.code===2322||x.code===2345)&&x.file.getLineAndCharacterOfPosition(x.start).line===ligne),`${nom}:${ligne+1} : confusion non rejetée`);}}
 console.log(JSON.stringify({perimetre:PERIMETRE,erreurs:erreurs.length,identite:identite()},null,2));
}
module.exports={verifier,jetons,identite,origine,PERIMETRE,REFERENCES,ORIGINE,EMPREINTE};if(require.main===module)main();
