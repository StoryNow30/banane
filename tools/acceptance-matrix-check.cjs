#!/usr/bin/env node
'use strict';
/*
 * acceptance-matrix-check.cjs — contrôle de la matrice d'acceptation
 * (`tests/ACCEPTANCE_MATRIX.md`, cahier 4.8 §14 et §7, chantier 5).
 *
 *   node tools/acceptance-matrix-check.cjs [--matrix FICHIER] [--json]
 *
 * Échoue (code 1) si la matrice :
 *   - désigne un fichier qui n'existe pas, ou un essai dont le nom exact n'est
 *     pas déclaré dans le fichier désigné ;
 *   - perd une exigence (identifiant attendu absent) ou en répète une ;
 *   - porte un statut autre que COUVERT, PARTIEL ou MANQUANT ;
 *   - déclare COUVERT une exigence sans essai, ou avec un essai « todo » ou
 *     « skip » (un défaut connu ou un essai non exécuté ne prouve rien) ;
 *   - déclare MANQUANT une exigence en citant un essai qui s'exécute ;
 *   - déclare §14 B plus couvert que le plus faible des invariants §7.1 à §7.10.
 *
 * Syntaxe d'un essai dans la colonne « Tests » :
 *   `tests/fichier.test.cjs` › `nom exact de l'essai`
 * Tout autre chemin entre accents graves de cette colonne (outil, bilan) doit
 * exister. Les noms sont lus dans le source, sans exécuter les essais : un nom
 * construit par gabarit (`${…}`) est reconnu par motif. Lecture seule.
 */
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),MATRIX=path.join(ROOT,'tests','ACCEPTANCE_MATRIX.md');
const STATUSES=['MANQUANT','PARTIEL','COUVERT'];
/* Exigences qui doivent figurer, une ligne chacune. Retirer une ligne de la
 * matrice fait échouer le contrôle : une exigence ne disparaît pas en silence. */
const REQUIRED=Object.freeze([
  ...Array.from({length:10},(_,i)=>`§7.${i+1}`),
  ...'ABCDEFGHI'.split('').map(l=>`§14 ${l}`),
  ...Array.from({length:11},(_,i)=>`§14 A.${i+1}`),
  '§5.4 a','§5.4 b','§5.4 c','§5.4 d','§5.5',
  ...Array.from({length:9},(_,i)=>`LOT-${i+1}`)]);

/* ---- les essais déclarés dans un fichier source ---- */
function readLiteral(src,i){
  const q=src[i];if(!['\'','"','`'].includes(q))return null;
  let text='',pattern='',dynamic=false;
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  for(let j=i+1;j<src.length;j++){const c=src[j];
    if(c==='\\'){const n=src[j+1],map={n:'\n',t:'\t',r:'\r','0':'\0'};const v=map[n]??n;text+=v;pattern+=esc(v);j++;continue;}
    if(c===q)return {text,pattern:dynamic?new RegExp('^'+pattern+'$','s'):null,end:j+1};
    if(q==='`'&&c==='$'&&src[j+1]==='{'){let depth=1,k=j+2;for(;k<src.length&&depth;k++){if(src[k]==='{')depth++;else if(src[k]==='}')depth--;}
      dynamic=true;text+='${…}';pattern+='.+?';j=k-1;continue;}
    text+=c;pattern+=esc(c);}
  return null;
}
/* Nom de l'essai : un littéral, un gabarit, ou une concaténation (`'a '+x+' b'`) ;
 * toute partie calculée devient un motif. */
function readName(src,i){
  let text='',pattern='',dynamic=false,j=i;
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  for(;;){
    while(/\s/.test(src[j]||''))j++;
    const c=src[j];if(c===undefined)return null;
    if(c===','||c===')'){if(!text&&!dynamic)return null;return {text,pattern:dynamic?new RegExp('^'+pattern+'$','s'):null,end:j};}
    if(c==='+'){j++;continue;}
    const lit=readLiteral(src,j);
    if(lit){text+=lit.text;pattern+=lit.pattern?lit.pattern.source.slice(1,-1):esc(lit.text);dynamic=dynamic||!!lit.pattern;j=lit.end;continue;}
    let depth=0;for(;j<src.length;j++){const d=src[j];if('([{'.includes(d))depth++;else if(')]}'.includes(d)){if(!depth)break;depth--;}else if(!depth&&(d==='+'||d===','))break;}
    text+='…';pattern+='.+?';dynamic=true;
  }
}
function optionsAfter(src,i){
  const m=/^\s*,\s*\{/.exec(src.slice(i,i+200));if(!m)return '';
  let depth=0,k=i+m[0].length-1;const start=k;
  for(;k<src.length;k++){if(src[k]==='{')depth++;else if(src[k]==='}'&&--depth===0)break;}
  return src.slice(start,k+1);
}
function extractTests(file){
  const src=fs.readFileSync(file,'utf8'),out=[],re=/(?<![\w$.])test(\.(todo|skip|only))?\s*\(\s*/g;let m;
  while((m=re.exec(src))){
    if(!['\'','"','`'].includes(src[re.lastIndex]))continue;
    const lit=readName(src,re.lastIndex);if(!lit)continue;
    const opts=optionsAfter(src,lit.end),line=src.slice(0,m.index).split('\n').length;
    const mode=m[2]==='todo'||/\btodo\s*:/.test(opts)?'todo':m[2]==='skip'||/\bskip\s*:/.test(opts)?'skip':'run';
    out.push({name:lit.text,pattern:lit.pattern,line,mode});}
  return out;
}
const cache=new Map();
function testsOf(rel,root=ROOT){const file=path.join(root,rel);
  if(!cache.has(file))cache.set(file,fs.existsSync(file)?extractTests(file):null);return cache.get(file);}
function findTest(rel,name,root=ROOT){const list=testsOf(rel,root);if(!list)return null;
  return list.find(t=>t.name===name)||list.find(t=>t.pattern&&t.pattern.test(name))||undefined;}

/* ---- la matrice ---- */
const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim());
/* Lignes dont le statut se déduit d'autres lignes (colonne « Tests » ouverte par « → »). */
const DERIVED=Object.freeze({'§14 B':id=>/^§7\.\d+$/.test(id)});
const TEST_REF=/`([^`]+)`\s*›\s*`([^`]+)`/g,FILE_LIKE=p=>/^[\w.-]+\/[\w./-]+$|^[\w.-]+\.(c?js|md|json)$/.test(p);
function parseMatrix(text){
  const rows=[];text.split('\n').forEach((line,i)=>{
    if(!/^\s*\|/.test(line))return;const c=cells(line);
    if(!/^(§\d|LOT-\d)/.test(c[0]||''))return;
    const tests=[...(c[2]||'').matchAll(TEST_REF)].map(x=>({file:x[1],name:x[2]}));
    /* Tout chemin cité, dans n'importe quelle colonne, doit exister. */
    const paths=[...c.join(' ').replace(TEST_REF,'').matchAll(/`([^`]+)`/g)].map(x=>x[1]).filter(FILE_LIKE);
    rows.push({id:c[0],requirement:c[1]||'',tests,paths,derived:/^→/.test(c[2]||''),
      status:(/^(COUVERT|PARTIEL|MANQUANT)\b/.exec(c[3]||'')||[])[1]||null,rawStatus:c[3]||'',proof:c[4]||'',line:i+1});});
  return rows;
}
function check(text,{root=ROOT,required=REQUIRED}={}){
  const rows=parseMatrix(text),errors=[],err=(row,msg)=>errors.push(`ligne ${row?.line??'?'} ${row?.id??''} : ${msg}`);
  const seen=new Map();
  for(const row of rows){
    if(seen.has(row.id))err(row,`exigence en double (déjà ligne ${seen.get(row.id).line})`);seen.set(row.id,row);
    if(!row.status)err(row,`statut invalide « ${row.rawStatus} » : COUVERT, PARTIEL ou MANQUANT`);
    if(!row.proof)err(row,'phrase de preuve absente');
    for(const p of row.paths)if(!fs.existsSync(path.join(root,p)))err(row,`fichier introuvable : ${p}`);
    row.resolved=row.tests.map(t=>{
      if(!/^tests\/.+\.test\.cjs$/.test(t.file)){err(row,`pas un fichier d'essais : ${t.file}`);return {...t,found:null};}
      if(!fs.existsSync(path.join(root,t.file))){err(row,`fichier d'essais introuvable : ${t.file}`);return {...t,found:null};}
      const found=findTest(t.file,t.name,root);
      if(!found)err(row,`essai introuvable dans ${t.file} : « ${t.name} »`);
      return {...t,found:found||null};});
    const run=row.resolved.filter(t=>t.found?.mode==='run'),idle=row.resolved.filter(t=>t.found&&t.found.mode!=='run');
    if(row.derived&&!row.tests.length&&!DERIVED[row.id])err(row,'ligne dérivée (« → ») sans règle de dérivation connue');
    if(row.status==='COUVERT'&&!row.tests.length&&!(row.derived&&DERIVED[row.id]))err(row,'COUVERT sans aucun essai désigné');
    if(row.status==='COUVERT'&&idle.length)err(row,`COUVERT avec un essai ${idle.map(t=>t.found.mode).join('/')} : « ${idle[0].name} »`);
    if(row.status==='MANQUANT'&&run.length)err(row,`MANQUANT alors que « ${run[0].name} » s'exécute : PARTIEL ou COUVERT`);
  }
  for(const id of required)if(!seen.has(id))errors.push(`exigence absente de la matrice : ${id}`);
  for(const [id,member] of Object.entries(DERIVED)){const row=seen.get(id),from=rows.filter(r=>member(r.id)&&r.status);
    if(!row?.status||!from.length)continue;const weakest=STATUSES[Math.min(...from.map(r=>STATUSES.indexOf(r.status)))];
    if(STATUSES.indexOf(row.status)>STATUSES.indexOf(weakest))err(row,`${id} déclaré ${row.status} alors que la plus faible des lignes dont il dérive est ${weakest}`);}
  const count=s=>rows.filter(r=>r.status===s).length;
  return {ok:errors.length===0,errors,rows:rows.length,counts:{COUVERT:count('COUVERT'),PARTIEL:count('PARTIEL'),MANQUANT:count('MANQUANT')},
    tests:rows.reduce((n,r)=>n+r.tests.length,0),todo:rows.flatMap(r=>(r.resolved||[]).filter(t=>t.found?.mode==='todo').map(t=>`${r.id} · ${t.name}`)),
    unproven:rows.filter(r=>r.status!=='COUVERT').map(r=>`${r.id} ${r.status||'statut invalide'}`)};
}
function run(argv=process.argv.slice(2)){
  const i=argv.indexOf('--matrix'),file=i>=0?path.resolve(argv[i+1]):MATRIX;
  if(!fs.existsSync(file)){console.error(`Matrice introuvable : ${file}`);return 1;}
  const r=check(fs.readFileSync(file,'utf8'));
  if(argv.includes('--json'))console.log(JSON.stringify(r,null,2));
  else{console.log(`Matrice : ${r.rows} exigences, ${r.tests} essais désignés — COUVERT ${r.counts.COUVERT}, PARTIEL ${r.counts.PARTIEL}, MANQUANT ${r.counts.MANQUANT}.`);
    if(r.todo.length)console.log(`Essais « todo » (défauts connus) : ${r.todo.length}\n  `+r.todo.join('\n  '));
    if(r.unproven.length)console.log('Sans preuve complète : '+r.unproven.join(' ; '));
    for(const e of r.errors)console.error('ERREUR '+e);
    console.log(r.ok?'Contrôle réussi.':`Contrôle ÉCHOUÉ : ${r.errors.length} erreur(s).`);}
  return r.ok?0:1;
}
if(require.main===module)process.exitCode=run();
module.exports={REQUIRED,STATUSES,extractTests,findTest,parseMatrix,check,run};
