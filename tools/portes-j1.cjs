#!/usr/bin/env node
'use strict';
/*
 * portes-j1.cjs — portes de banc de J1 (4.8.5 test 1, PLAN_SUITE §0 et D5),
 * imprimées en VERT ou ROUGE :
 *   1. les 633 cuts de validation (lots des parties 9, 11 et 12), rejoués avec
 *      les règles de leur lot, donnent les mêmes décisions que la référence
 *      figée sur le code de la 4.8.0, et la parité rejeu/observation ne bouge pas ;
 *   2. les 8 jeux du banc 4.8.5 (a à h), rejoués avec les règles actuelles :
 *      seuls natif-p11:707 et 711 (refusés) et 718 (posé, ricochet) changent,
 *      0 juste perdu ;
 *   3. avec `--verify` : `node tools/verify.cjs` à 0.
 *
 *   node tools/portes-j1.cjs --entrees ENTREES.env [--reference F] [--verify] [--reprendre]
 *   node tools/portes-j1.cjs --entrees ENTREES.env --figer F     (référence depuis le code courant)
 *   node tools/portes-j1.cjs --releve RELEVE.json [--reference F] (relevé déjà fait)
 *
 * ENTREES.env : les cinq dossiers de la recette banane-data
 * (`travail/2026-09-28_banc-485/preparer.sh`) : DONNEES_C5, KIT_EXTRAIT,
 * P9_4718R, ECHO_P11, SORTIE. Chaque rejeu tourne dans son propre processus
 * (mémoire) ; `--reprendre` garde une sortie déjà écrite dans SORTIE si elle
 * vient du même code (empreinte : commit + modifications non commitées) et des
 * mêmes arguments. `--figer` refuse un relevé fait sur un code modifié.
 * Code de sortie : 0 si toutes les portes sont vertes, 1 sinon.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const B=path.resolve(__dirname,'..');
const REFERENCE=path.join(B,'audit/portes-j1/reference-4.8.0.json');
/* PLAN_SUITE §0, J1 : ce que D2 (garde d'écartement bas à 1 420 mm) doit changer, et rien d'autre. */
const ATTENDU={validationCuts:633,jeux:{'natif-p11:707':'refusé','natif-p11:711':'refusé','natif-p11:718':'posé'}};
const CHAMPS_LOT=['stage','wouldApply','reason','anchors','guardMm'],CHAMPS_JEU=['stage','applied','wrong','worstMm'];

/* ---- logique des portes (pure) ---- */
const indexer=(lignes,cle)=>new Map(lignes.map(x=>[cle(x),x]));
function differences(avant,apres,champs){
  const cles=[...new Set([...avant.keys(),...apres.keys()])],out=[];
  for(const cle of cles){const a=avant.get(cle)??null,b=apres.get(cle)??null;
    if(!a||!b||champs.some(c=>(a[c]??null)!==(b[c]??null)))out.push({cle,avant:a,apres:b});}
  return out;
}
function lignesValidation(v){return (v?.lots||[]).flatMap(l=>(l.rows||[]).map(r=>({...r,cle:`${l.label}:${r.part}:${r.cut}`})));}
function porteValidation(ref,cur){
  const a=lignesValidation(ref),b=lignesValidation(cur),changes=differences(indexer(a,x=>x.cle),indexer(b,x=>x.cle),CHAMPS_LOT);
  const pr=new Map((ref?.lots||[]).map(l=>[l.label,l.parity??null]));
  const parites=(cur?.lots||[]).map(l=>{const parity=l.parity??null,reference=pr.get(l.label)??null;
    return {label:l.label,parity,reference,ok:(parity?.compared??null)===(reference?.compared??null)&&(parity?.identical??null)===(reference?.identical??null)};});
  const pariteOk=parites.every(p=>p.ok);
  return {id:'validation-633',libelle:`${ATTENDU.validationCuts} cuts de validation`,cuts:b.length,changes,parites,
    vert:b.length===ATTENDU.validationCuts&&!changes.length&&pariteOk};
}
function porteJeux(ref,cur){
  const lignes=j=>(j?.sessions||[]).flatMap(s=>(s.rows||[]).map(r=>({...r,cle:`${s.label}:${r.cut}`})));
  const avant=indexer(lignes(ref),x=>x.cle),apres=indexer(lignes(cur),x=>x.cle),changes=differences(avant,apres,CHAMPS_JEU);
  const change=new Map(changes.map(c=>[c.cle,c])),attendus=[];
  for(const [cle,sens] of Object.entries(ATTENDU.jeux)){const c=change.get(cle);
    const ok=!!c&&(sens==='refusé'?c.avant?.applied===true&&!c.apres?.applied:c.avant?.applied===false&&c.apres?.applied===true);
    attendus.push({cle,sens,ok,change:c||null});}
  const inattendus=changes.map(c=>c.cle).filter(k=>!(k in ATTENDU.jeux));
  const justesPerdus=[...avant.values()].filter(a=>a.applied&&a.judged&&a.wrong===false&&!apres.get(a.cle)?.applied).map(a=>a.cle);
  return {id:'jeux-8',libelle:'8 jeux',sessions:(cur?.sessions||[]).length,changes,attendus,inattendus,justesPerdus,
    vert:attendus.every(a=>a.ok)&&!inattendus.length&&!justesPerdus.length};
}
function evaluer(reference,courant,{verify=null}={}){
  const portes=[porteValidation(reference.validation,courant.validation),porteJeux(reference.jeux,courant.jeux)];
  if(verify)portes.push({id:'verify',libelle:'node tools/verify.cjs',code:verify.code,vert:verify.code===0});
  return {portes,vert:portes.every(p=>p.vert)};
}
const etat=l=>!l?'absent':l.stage??(l.applied?'posé':'non posé');
function texte(r){
  const L=[];
  for(const p of r.portes){const t=(p.vert?'VERT ':'ROUGE')+' '+p.libelle+' : ';
    if(p.id==='validation-633'){const d=[];
      d.push(p.changes.length?`${p.changes.length} décision${p.changes.length>1?'s':''} changée${p.changes.length>1?'s':''} : `+p.changes.slice(0,12).map(c=>`${c.cle} ${etat(c.avant)}→${etat(c.apres)}`).join(', ')+(p.changes.length>12?', …':''):'0 décision changée');
      if(p.cuts!==ATTENDU.validationCuts)d.push(`${p.cuts} cuts au lieu de ${ATTENDU.validationCuts}`);
      d.push(p.parites.map(x=>`parité ${x.label} ${x.parity?.identical??'—'}/${x.parity?.compared??'—'}`+(!x.ok?` (référence ${x.reference?.identical??'—'}/${x.reference?.compared??'—'})`:'')).join(', '));
      L.push(t+d.join(' ; '));}
    else if(p.id==='jeux-8'){const d=p.attendus.map(a=>a.ok?`${a.cle} ${a.sens}`:`${a.cle} attendu ${a.sens}, ${a.change?`${etat(a.change.avant)}→${etat(a.change.apres)}`:'inchangé'}`);
      if(p.inattendus.length)d.push(`${p.inattendus.length} changement${p.inattendus.length>1?'s':''} inattendu${p.inattendus.length>1?'s':''} : `+p.inattendus.slice(0,12).join(', ')+(p.inattendus.length>12?', …':''));
      d.push(p.justesPerdus.length?`juste perdu : ${p.justesPerdus.join(', ')}`:'0 juste perdu');
      L.push(t+d.join(' ; '));}
    else L.push(t+`code ${p.code}`);}
  L.push(r.vert?'J1 (banc) : toutes les portes sont vertes.':'J1 (banc) : au moins une porte est rouge.');
  return L.join('\n')+'\n';
}

/* ---- relevé : rejeux dans des processus séparés ---- */
const CLES=['DONNEES_C5','KIT_EXTRAIT','P9_4718R','ECHO_P11','SORTIE'];
function lireEntrees(f){const e={};
  for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=/^(?:export\s+)?([A-Z0-9_]+)=(.*)$/.exec(l.trim());if(!m)continue;
    const v=m[2].trim(),q=v.length>1&&(v[0]==='"'||v[0]==="'")&&v.at(-1)===v[0];e[m[1]]=q?v.slice(1,-1):v;}
  /* Chemins relatifs : depuis le dossier du fichier (les rejeux tournent depuis la racine du dépôt). */
  for(const k of CLES)if(e[k])e[k]=path.resolve(path.dirname(path.resolve(f)),e[k]);
  for(const k of CLES){if(!e[k])throw Error(`${f} : ${k} manquant`);
    /* `=` et `@` séparent dossier, libellé et relecture dans les arguments des rejeux. */
    if(/[=@]/.test(e[k]))throw Error(`${f} : ${k} : chemin avec = ou @ (séparateurs des arguments de rejeu)`);}
  return e;}
/* Empreinte du code qui rejoue : commit, et modifications non commitées du code. */
function empreinteCode(){const git=(...a)=>spawnSync('git',a,{cwd:B,encoding:'utf8',maxBuffer:256<<20}).stdout||'';
  const chemins=['src','tools','vendor','background.js'],commit=git('rev-parse','--short','HEAD').trim()||null;
  const etat=git('status','--porcelain','--',...chemins),h=crypto.createHash('sha256').update(String(commit)).update(git('diff','HEAD','--',...chemins));
  for(const f of git('ls-files','--others','--exclude-standard','--',...chemins).split('\n').filter(Boolean))h.update(f).update(fs.readFileSync(path.join(B,f)));
  return {commit,modifie:etat.trim().length>0,empreinte:h.digest('hex').slice(0,16)};}
/* Empreinte des entrées d'un rejeu : nom, taille et date de chaque fichier (liens suivis). */
function empreinteEntrees(chemins){const h=crypto.createHash('sha256');
  const voir=(p,prof)=>{let st;try{st=fs.statSync(p);}catch{h.update(p+' absent\n');return;}
    if(st.isDirectory()){if(prof<4)for(const n of fs.readdirSync(p).sort())voir(path.join(p,n),prof+1);}else h.update(`${p} ${st.size} ${st.mtimeMs}\n`);};
  for(const c of chemins)voir(c,0);return h.digest('hex').slice(0,16);}
function reutilisable(f,cle){try{return fs.statSync(f).size>0&&fs.readFileSync(f+'.empreinte','utf8')===cle;}catch{return false;}}
function lancer(sortie,args,{reprendre,empreinte},entrees){
  const cle=empreinte+' '+empreinteEntrees(entrees)+' '+JSON.stringify(args);
  if(reprendre&&reutilisable(sortie,cle))return JSON.parse(fs.readFileSync(sortie,'utf8'));
  fs.rmSync(sortie+'.empreinte',{force:true});
  const t=Date.now(),r=spawnSync(process.execPath,['--max-old-space-size=13000',...args],{cwd:B,encoding:'utf8',maxBuffer:64<<20});
  if(r.status!==0)throw Error(`${path.basename(sortie)} : échec (${r.status})\n${(r.stderr||r.stdout||'').slice(-2000)}`);
  fs.writeFileSync(sortie+'.empreinte',cle);
  process.stderr.write(`${new Date().toISOString().slice(11,19)} ${path.basename(sortie)} ${Math.round((Date.now()-t)/1000)} s\n`);
  return JSON.parse(fs.readFileSync(sortie,'utf8'));
}
function releve(e,{reprendre=false}={}){
  const O=e.SORTIE,K=e.KIT_EXTRAIT,D=e.DONNEES_C5,E=e.ECHO_P11,code=empreinteCode(),x={reprendre,empreinte:code.empreinte};fs.mkdirSync(O,{recursive:true});
  const lots=[['p9-4.7.18',e.P9_4718R],['p9-4.7.19',`${K}/p9-lot-4719`],['p11-4.7.20',`${K}/p11-lot-4720`],['p12-4.7.20',`${K}/p12-lot-4720`]];
  const validation={lots:lots.map(([label,dir])=>{const f=`${O}/validation-${label}.json`;
    const r=lancer(f,['tools/acceptance-report.cjs','--lot',`${dir}=${label}`,'--rejeu-lot','--decision-par-rejeu','--json',f],x,[dir]).lots[0];
    return {label,parity:r.lotDecisionParity??null,rows:r.rows.filter(x=>!x.excluded).map(x=>({part:x.part,cut:x.cut,
      ...Object.fromEntries(CHAMPS_LOT.map(c=>[c,x.lot?.[c]??null]))}))};})};
  const J={a:['--natif',`${D}/natif-p24=natif-p24`,'--natif',`${D}/natif-p30=natif-p30`,'--natif',`${D}/natif-p2-7801=natif-p2-7801`],
    b:['--lot',`${D}/p31/lot=pilote-p31-4.7.8@${D}/p31/rel`,'--lot',`${D}/p31fin/lot=pilote-p31-fin-4.7.9@${D}/p31fin/rel`],
    c:['--lot',`${D}/p34/lot=pilote-p34-4.7.11@${D}/p34/rel`],
    d:['--lot',`${D}/p2/lot=pilote-p2-4.7.18@${D}/p2/rel`,'--lot',`${D}/p3/lot=pilote-p3-4.7.18@${D}/p3/rel`],
    e:['--lot',`${e.P9_4718R}=pilote-p9-4.7.18@${K}/p9-relecture`,'--lot',`${K}/p9-lot-4719=pilote-p9-4.7.19@${K}/p9-relecture`],
    f:['--lot',`${K}/p12-lot-4720=pilote-p12-4.7.20@${K}/p12-relecture`],
    g:['--natif',`${E}=natif-p11`],h:['--lot',`${K}/p11-lot-4720=pilote-p11-4.7.20@${E}`]};
  const jeux={sessions:Object.entries(J).flatMap(([jeu,args])=>{const f=`${O}/jeu-${jeu}.json`;
    return lancer(f,['tools/first-pass-signal-study.cjs',f,'--base-seule',...args],x,args.filter(a=>!a.startsWith('--')).flatMap(a=>{const i=a.indexOf('='),r=a.slice(i+1).split('@')[1];return [a.slice(0,i),...(r?[r]:[])];})).sessions.map(s=>({jeu,label:s.label,rows:s.base.rows}));})};
  return {format:'ariane-portes-j1-releve-v1',code,faitLe:new Date().toISOString(),validation,jeux};
}
function run(argv=process.argv.slice(2)){
  const opt=k=>{const i=argv.indexOf(k);return i>=0?argv[i+1]:null;},lire=f=>JSON.parse(fs.readFileSync(f,'utf8'));
  const figer=opt('--figer'),reference=opt('--reference')||REFERENCE;
  if(argv.includes('--figer')&&(!figer||figer.startsWith('--')))throw Error('--figer : chemin de la référence à écrire manquant');
  if(!figer&&!fs.existsSync(reference))throw Error(`référence absente : ${reference} (la figer d'abord, sur le code de la 4.8.0 : --figer)`);
  let cur,e=null;
  if(opt('--releve'))cur=lire(opt('--releve'));
  else{if(!opt('--entrees'))throw Error('Usage : --entrees ENTREES.env [--reference F] [--verify] [--reprendre] | --figer F | --releve RELEVE.json');
    e=lireEntrees(opt('--entrees'));cur=releve(e,{reprendre:argv.includes('--reprendre')});
    fs.writeFileSync(`${e.SORTIE}/releve.json`,JSON.stringify(cur)+'\n');}
  if(figer){if(cur.code?.modifie!==false||!cur.code?.commit)throw Error(`relevé fait sur un code modifié ou inconnu (${cur.code?.commit??'?'}) : une référence se fige sur un commit propre`);
    fs.mkdirSync(path.dirname(figer),{recursive:true});fs.writeFileSync(figer,JSON.stringify(cur)+'\n');
    const n=cur.validation.lots.reduce((s,l)=>s+l.rows.length,0),m=cur.jeux.sessions.reduce((s,x)=>s+x.rows.length,0);
    process.stdout.write(`Référence figée (${cur.code.commit}) : ${n} cuts de validation, ${m} cuts sur ${cur.jeux.sessions.length} sessions des 8 jeux → ${figer}\n`);return null;}
  const verify=argv.includes('--verify')?{code:spawnSync(process.execPath,['tools/verify.cjs'],{cwd:B,stdio:'ignore'}).status}:null;
  const r=evaluer(lire(reference),cur,{verify});
  process.stdout.write(`Relevé : code ${cur.code?.commit??'?'}${cur.code?.modifie?' (modifié, non commité)':''}.\n`+texte(r));
  if(e)fs.writeFileSync(`${e.SORTIE}/portes-j1.json`,JSON.stringify(r,null,1)+'\n');
  process.exitCode=r.vert?0:1;return r;
}
if(require.main===module)try{run();}catch(e){console.error(e.message);process.exitCode=2;}
module.exports={ATTENDU,evaluer,texte,porteValidation,porteJeux,lireEntrees,reutilisable,empreinteCode,empreinteEntrees,releve,run};
