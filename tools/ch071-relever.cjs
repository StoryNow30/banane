#!/usr/bin/env node
'use strict';
/* CH-071 : relève les appels faits aux quatre modules du lot 300–349 par TOUS les essais du tronc qui les chargent.
 *   node tools/ch071-relever.cjs [--sortie DOSSIER]   (défaut ariane-rs/target/ch071-releve, hors suivi)
 * Lance chaque essai concerné (grep sur tests/*.test.cjs : nom du fichier source ou de la globale) sous le crochet
 * tools/ch071-releve-crochet.cjs, puis fusionne et dédoublonne les appels (même octets v8.serialize) dans releve.bin.
 * Le résultat des essais n'est pas jugé ici (ils sont jugés par le verify) ; il est consigné dans bilan.json. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const RACINE=path.resolve(__dirname,'..');
const a=process.argv.slice(2),SORTIE=a.includes('--sortie')?path.resolve(a[a.indexOf('--sortie')+1]):path.join(RACINE,'ariane-rs','target','ch071-releve');
const MOTIF=/file-parties|file-prioritaire|serie-captures-vides|raison-correction|BananeFileParties|ArianeFilePrioritaire|BananeSerieCapturesVides|BananeRaisonCorrection/;
/* Un essai charge les modules directement ou par le service worker (background.js en VM, qui les importe tous). */
const SW=/background-harness|perf-production|file-parties-sw|fond-relecture|helpers\/navigateur|background\.js/;
function essais(){return fs.readdirSync(path.join(RACINE,'tests')).filter(n=>n.endsWith('.test.cjs')).sort().filter(n=>{const t=fs.readFileSync(path.join(RACINE,'tests',n),'utf8');return MOTIF.test(t)||SW.test(t);});}
function lire(dossier){const out=[];for(const n of fs.readdirSync(dossier).filter(x=>x.endsWith('.bin')&&x!=='releve.bin')){const b=fs.readFileSync(path.join(dossier,n));let p=0;
  while(p+4<=b.length){const l=b.readUInt32LE(p);out.push(b.subarray(p+4,p+4+l));p+=4+l;}}return out;}
if(require.main===module)(async()=>{
 fs.rmSync(SORTIE,{recursive:true,force:true});fs.mkdirSync(SORTIE,{recursive:true});
 const bilan={format:'ch071-releve-v1',essais:[]};
 const {spawn}=require('node:child_process'),liste=essais(),PARALLELE=Number(a.includes('--parallele')?a[a.indexOf('--parallele')+1]:4);
 const un=n=>new Promise(res=>{const d=path.join(SORTIE,'brut',n.replace(/\.test\.cjs$/,'')),t0=Date.now();
  const c=spawn(process.execPath,['--test','--test-reporter=dot',path.join('tests',n)],{cwd:RACINE,stdio:'ignore',
   env:{...process.env,CH071_RELEVE_DIR:d,NODE_OPTIONS:((process.env.NODE_OPTIONS||'')+' --require '+path.join(__dirname,'ch071-releve-crochet.cjs')).trim()}});
  c.on('exit',code=>{const appels=fs.existsSync(d)?lire(d).length:0;bilan.essais.push({essai:n,code,appels,secondes:Math.round((Date.now()-t0)/100)/10});console.error(n,code,appels);res();});});
 let i=0;await Promise.all(Array.from({length:PARALLELE},async()=>{while(i<liste.length)await un(liste[i++]);}));
 bilan.essais.sort((x,y)=>x.essai<y.essai?-1:1);
 const vus=new Set(),uniques=[];let total=0;
 for(const e of bilan.essais){const d=path.join(SORTIE,'brut',e.essai.replace(/\.test\.cjs$/,''));if(!fs.existsSync(d))continue;
  for(const b of lire(d)){total++;const h=crypto.createHash('sha1').update(b).digest('hex');if(vus.has(h))continue;vus.add(h);uniques.push(b);}}
 const parts=[];for(const b of uniques){const l=Buffer.alloc(4);l.writeUInt32LE(b.length);parts.push(l,b);}
 fs.writeFileSync(path.join(SORTIE,'releve.bin'),Buffer.concat(parts));
 Object.assign(bilan,{appels:total,uniques:uniques.length});fs.writeFileSync(path.join(SORTIE,'bilan.json'),JSON.stringify(bilan,null,1)+'\n');
 console.log(JSON.stringify({essais:bilan.essais.length,appels:total,uniques:uniques.length,sortie:path.relative(RACINE,SORTIE)}));
})();
module.exports={SORTIE,lireReleve:f=>{const b=fs.readFileSync(f),out=[];let p=0;while(p+4<=b.length){const l=b.readUInt32LE(p);out.push(b.subarray(p+4,p+4+l));p+=4+l;}return out;}};
