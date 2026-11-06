'use strict';
/* CH-071 : crochet de RELEVÉ, chargé par NODE_OPTIONS=--require dans chaque processus d'essai (tools/ch071-relever.cjs).
 * Enveloppe les fonctions exportées de src/file-parties.js, src/file-prioritaire.js, src/serie-captures-vides.js et
 * src/raison-correction.js, qu'elles soient chargées par require (Module._load) ou exécutées dans une VM (vm.runInContext,
 * repéré par le texte du fichier). Chaque appel venu de l'extérieur du module est consigné AVANT exécution (copie par
 * v8.serialize : −0, undefined, trous et Set conservés) dans CH071_RELEVE_DIR/<pid>.bin (longueur sur 4 octets puis l'appel).
 * Les modules eux-mêmes ne sont pas modifiés ; seule la référence vue par l'appelant est une copie enveloppée. */
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),Module=require('node:module'),vm=require('node:vm');
const DIR=process.env.CH071_RELEVE_DIR;
const RACINE=path.resolve(__dirname,'..');
const MODULES={'file-parties':'BananeFileParties','file-prioritaire':'ArianeFilePrioritaire','serie-captures-vides':'BananeSerieCapturesVides','raison-correction':'BananeRaisonCorrection'};
const CHEMINS=Object.fromEntries(Object.keys(MODULES).map(m=>[path.join(RACINE,'src',m+'.js'),m]));
const TEXTES=new Map(Object.entries(CHEMINS).map(([f,m])=>[fs.readFileSync(f,'utf8'),m]));
let fd=null,actif=0;
function consigner(m,f,args){
 if(!DIR||actif)return;
 let b;try{b=v8.serialize({m,f,args});}catch{b=v8.serialize({m,f,nonSerialisable:true});}
 if(fd===null){fs.mkdirSync(DIR,{recursive:true});fd=fs.openSync(path.join(DIR,process.pid+'.bin'),'a');}
 const l=Buffer.alloc(4);l.writeUInt32LE(b.length);fs.writeSync(fd,Buffer.concat([l,b]));
}
const enveloppes=new WeakMap();
function envelopper(m,api){
 if(!api||typeof api!=='object')return api;
 if(enveloppes.has(api))return enveloppes.get(api);
 const copie={};
 for(const k of Object.keys(api)){const v=api[k];
  copie[k]=typeof v==='function'?function(...args){consigner(m,k,args);actif++;try{return v.apply(this,args);}finally{actif--;}}:v;}
 const r=Object.isFrozen(api)?Object.freeze(copie):copie;enveloppes.set(api,r);return r;
}
const charger=Module._load;
Module._load=function(requete,parent,...reste){const api=charger.call(this,requete,parent,...reste);
 let f;try{f=Module._resolveFilename(requete,parent);}catch{return api;}
 return CHEMINS[f]?envelopper(CHEMINS[f],api):api;};
const executer=vm.runInContext;
vm.runInContext=function(code,ctx,...reste){const r=executer.call(this,code,ctx,...reste);
 const m=typeof code==='string'?TEXTES.get(code):undefined;
 if(m&&ctx&&ctx[MODULES[m]])ctx[MODULES[m]]=envelopper(m,ctx[MODULES[m]]);
 return r;};
