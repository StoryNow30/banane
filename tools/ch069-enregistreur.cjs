'use strict';
/* CH-069 : enregistreur des appels faits par les essais du tronc aux modules d'export (chargé par --require, jamais en
 * production). Chaque lecture d'un des cinq fichiers (require ou vm) rend le source suivi d'un court ajout qui enveloppe les
 * fonctions publiques portées : chaque appel EXTERNE est sérialisé (v8.serialize, au moment de l'appel) dans un puits ;
 * les appels dont un argument ne se sérialise pas (fonction) sont ignorés. Écrit à la sortie du processus dans
 * $CH069_RELEVE (fichier .bin : liste de {m, f, a}). */
const fs=require('node:fs'),v8=require('node:v8'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
const RACINE=path.resolve(__dirname,'..');
const CIBLES={
 'src/native-export.js':['NativeExport','BananeNativeExport',['compact','expand','expandCloud','unfoldRefs','misfiledHead','alleger','enteteMince','deltaMetadonnees','evenementsParReference','rehydraterEvenements']],
 'src/phase-pli.js':['PhasePli','BananePhasePli',['plier','deplier','estPlie','eligible']],
 'src/gcv1-export.js':['GCV1Export','BananeGCV1Export',['buildDiagnostic']],
 'src/export-cache.js':['ExportCache','BananeExportCache',['signature','capturesAGarder','refus','reprenable','finiPourDeBon','ficheDepart','ajouterDepart']],
 'src/zip-writer.js':['Zip','BananeZip',['crc32']],
};
const vus=new Set(),appels=[],parFonction={};
function puits(m,f,a){
 const k=m+'.'+f;if((parFonction[k]||0)>=400)return;
 let o;try{o=v8.serialize(a);}catch{return;}
 const h=crypto.createHash('sha1').update(k).update(o).digest('hex');if(vus.has(h))return;vus.add(h);
 parFonction[k]=(parFonction[k]||0)+1;appels.push({m,f,a:o});
}
globalThis.__ch069Puits=puits;
const ajout=([m,g,fns])=>`\n;(function(G){var p=G.__ch069Puits;if(typeof p!=='function')return;`+
 `var api=(typeof module==='object'&&module&&module.exports&&typeof module.exports.${fns[0]}==='function')?module.exports:G.${g};if(!api||api.__ch069)return;`+
 `try{Object.defineProperty(api,'__ch069',{value:true});}catch(e){return;}`+
 `${JSON.stringify(fns)}.forEach(function(n){var f=api[n];if(typeof f!=='function')return;api[n]=function(){p(${JSON.stringify(m)},n,Array.prototype.slice.call(arguments));return f.apply(this,arguments);};});`+
 `})(typeof globalThis!=='undefined'?globalThis:this);\n`;
const lire=fs.readFileSync;
fs.readFileSync=function(f,...r){const out=lire.call(this,f,...r);
 try{if(typeof f==='string'){const rel=path.relative(RACINE,path.resolve(f)).split(path.sep).join('/');const c=CIBLES[rel];
  if(c){if(typeof out==='string')return out+ajout(c);return Buffer.concat([out,Buffer.from(ajout(c))]);}}}catch{}
 return out;};
for(const n of ['createContext','runInNewContext']){const o=vm[n];vm[n]=function(ctx,...r){
 if(n==='createContext'){const c=ctx||{};try{c.__ch069Puits=puits;}catch{}return o.call(this,c,...r);}
 const s=r[0]&&typeof r[0]==='object'?r[0]:(r[0]={});try{s.__ch069Puits=puits;}catch{}return o.call(this,ctx,...r);};}
process.on('exit',()=>{if(!process.env.CH069_RELEVE||!appels.length)return;fs.writeFileSync(process.env.CH069_RELEVE,v8.serialize(appels));});
