#!/usr/bin/env node
'use strict';
/* CH-069 : relève les appels aux modules d'export faits par TOUS les essais du tronc qui les chargent.
 *   node tools/ch069-releve.cjs   → ariane-rs/target/ch069/releve.bin (non suivi), liste dédoublonnée de {m, f, a}
 * Chaque essai est lancé à part avec tools/ch069-enregistreur.cjs ; son verdict est rapporté, sans influence sur le relevé. */
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const RACINE=path.resolve(__dirname,'..'),SORTIE=path.join(RACINE,'ariane-rs','target','ch069');
const MOTIF=/native-export|phase-pli|gcv1-export|export-cache|zip-writer/;
function releve({silencieux=false}={}){
 fs.mkdirSync(SORTIE,{recursive:true});
 const essais=fs.readdirSync(path.join(RACINE,'tests')).filter(n=>/\.test\.cjs$/.test(n)&&MOTIF.test(fs.readFileSync(path.join(RACINE,'tests',n),'utf8'))).sort();
 const tous=[],vus=new Set(),bilan=[];
 for(const e of essais){const f=path.join(SORTIE,'releve-'+e+'.bin');fs.rmSync(f,{force:true});
  const r=spawnSync(process.execPath,['--max-old-space-size=8000','--require',path.join(__dirname,'ch069-enregistreur.cjs'),path.join('tests',e)],
   {cwd:RACINE,encoding:'utf8',env:{...process.env,CH069_RELEVE:f},timeout:600000,maxBuffer:1<<28});
  let n=0;if(fs.existsSync(f)){for(const c of v8.deserialize(fs.readFileSync(f))){const h=crypto.createHash('sha1').update(c.m+'.'+c.f).update(c.a).digest('hex');if(vus.has(h))continue;vus.add(h);tous.push({...c,essai:e});n++;}fs.rmSync(f);}
  bilan.push({essai:e,code:r.status,appels:n});if(!silencieux)console.error(e,'code',r.status,'appels',n);}
 fs.writeFileSync(path.join(SORTIE,'releve.bin'),v8.serialize(tous));
 const parFonction={};for(const c of tous)parFonction[c.m+'.'+c.f]=(parFonction[c.m+'.'+c.f]||0)+1;
 return {essais:essais.length,appels:tous.length,parFonction,bilan};
}
module.exports={releve,FICHIER:path.join(SORTIE,'releve.bin')};
if(require.main===module)console.log(JSON.stringify(releve(),null,1));
