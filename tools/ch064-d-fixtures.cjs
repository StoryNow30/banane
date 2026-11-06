#!/usr/bin/env node
'use strict';
/* CH-064-D : fixtures des essais JS du tronc, pour le banc de parité de la décision.
 *   node tools/ch064-d-fixtures.cjs [--sortie FICHIER] [--motif REGEX]
 * Lance chaque essai `tests/*.test.cjs` qui charge un module de décision porté, dans un processus à lui, avec un crochet
 * (`--require` de ce même fichier) qui enveloppe les fonctions exportées des modules : chaque appel venu de l'essai est
 * enregistré (arguments clonés AVANT l'appel par v8.serialize : −0, NaN, undefined, trous conservés). Les appels dont les
 * arguments ne se clonent pas (fonctions, objets vivants) sont comptés et laissés. Sortie (non versionnée, défaut dans
 * ariane-rs/dist/) : v8.serialize([{module, f, args}]) dédoublonné. Rien n'est écrit dans tests/ ni dans src/. */
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),crypto=require('node:crypto');
const RACINE=path.resolve(__dirname,'..');
const MODULES={critere:'src/relecture-critere.js',signal:'src/relecture-signal.js',gardeApresDiffere:'src/garde-apres-differe.js',
 gardePasseAppuis:'src/garde-passe-appuis.js',relectureOmbre:'src/relecture-ombre.js',reglesMetier:'src/regles-metier.js',
 lotDecision:'src/lot-decision.js',voieB1:'src/voie-b1-ecart.js',gcv2L1:'src/gcv2-l1.js'};
const CROCHET=process.env.CH064D_FIXTURES;
if(CROCHET){
 /* Crochet, dans le processus de l'essai. */
 const enr=[],vus=new Set();let refus=0;
 for(const [nom,rel] of Object.entries(MODULES)){let M;try{M=require(path.join(RACINE,rel));}catch{continue;}
  for(const [f,fn] of Object.entries(M)){if(typeof fn!=='function')continue;
   M[f]=function(...args){let b=null;try{b=v8.serialize(args);}catch{refus++;}
    if(b){const h=crypto.createHash('sha1').update(nom+'\0'+f+'\0').update(b).digest('hex');if(!vus.has(h)){vus.add(h);enr.push({module:nom,f,args:b});}}
    return fn.apply(this,args);};}}
 process.on('exit',()=>{fs.writeFileSync(CROCHET,v8.serialize({enr,refus}));});
}else if(require.main===module){
 const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 const sortie=arg('--sortie')||path.join(RACINE,'ariane-rs','dist','ch064-d-fixtures.v8');
 const motif=new RegExp(arg('--motif')||'.');
 const {spawnSync}=require('node:child_process'),os=require('node:os');
 const motifsSrc=Object.values(MODULES).map(r=>path.basename(r));
 const essais=fs.readdirSync(path.join(RACINE,'tests')).filter(f=>f.endsWith('.test.cjs')&&motif.test(f)).sort()
  .filter(f=>{const t=fs.readFileSync(path.join(RACINE,'tests',f),'utf8');return motifsSrc.some(m=>t.includes(m));});
 const tout=[],vus=new Set();let refus=0,echecs=[];
 for(const f of essais){const tmp=path.join(os.tmpdir(),'ch064d-'+process.pid+'-'+f+'.v8');
  const r=spawnSync(process.execPath,['--require',__filename,path.join('tests',f)],{cwd:RACINE,env:{...process.env,CH064D_FIXTURES:tmp},encoding:'utf8',timeout:120000});
  if(r.status!==0)echecs.push(f);
  if(!fs.existsSync(tmp))continue;const o=v8.deserialize(fs.readFileSync(tmp));fs.unlinkSync(tmp);refus+=o.refus;
  for(const e of o.enr){const h=crypto.createHash('sha1').update(e.module+'\0'+e.f+'\0').update(e.args).digest('hex');if(!vus.has(h)){vus.add(h);tout.push({...e,essai:f});}}}
 fs.mkdirSync(path.dirname(sortie),{recursive:true});fs.writeFileSync(sortie,v8.serialize(tout));
 const parModule={};for(const e of tout){const k=e.module+'.'+e.f;parModule[k]=(parModule[k]||0)+1;}
 console.log(JSON.stringify({essais:essais.length,essaisEnEchec:echecs,appels:tout.length,nonClonables:refus,parFonction:parModule,sortie:path.relative(RACINE,sortie)},null,1));
}
module.exports={MODULES};
