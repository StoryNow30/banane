'use strict';
/* Module d'aide des essais CH-096 (tests/ch096-*.test.cjs). Les corrections des fichiers protégés sont livrées en patchs
 * (chantiers/CH-096/adapter-page.patch, chantiers/CH-096/core.patch) : tant que le tronc ne les porte pas, l'essai les applique à une
 * COPIE du fichier ; quand le tronc les porte, il lit le fichier du dépôt. `CH096_SANS_PATCH=1` : le fichier SANS le patch (celui du
 * dépôt s'il ne le porte pas, sinon une copie dont le patch est retiré à l'envers), pour revoir les essais rouges. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'../..'),SANS=process.env.CH096_SANS_PATCH==='1';
const PATCHS={'src/adapter-page.js':['adapter-page.patch','CH-096'],'src/core.js':['core.patch','CH-096']};
const copies=[];process.on('exit',()=>{for(const d of copies)try{fs.rmSync(d,{recursive:true,force:true});}catch{}});
const cache={};
/* Rend {chemin, texte, etat} du fichier à charger : etat = 'porté' | 'appliqué' | 'écarté' | 'retiré' | 'refusé : …' | 'patch absent'. */
function fichier(rel){if(cache[rel])return cache[rel];
 const [nom,marque]=PATCHS[rel],source=path.join(racine,rel),patch=path.join(racine,'chantiers/CH-096',nom),texte=fs.readFileSync(source,'utf8'),porte=texte.includes(marque);
 const rendre=(chemin,t,etat)=>cache[rel]={chemin,texte:t,etat,avecPatch:t.includes(marque)};
 if(porte&&!SANS)return rendre(source,texte,'porté');
 if(!porte&&SANS)return rendre(source,texte,'écarté');
 if(!fs.existsSync(patch))return rendre(source,texte,'patch absent');
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'ch096-'));copies.push(d);const cible=path.join(d,rel);
 fs.mkdirSync(path.dirname(cible),{recursive:true});fs.writeFileSync(cible,texte);
 const r=spawnSync('patch',['-s',...(SANS?['-R']:[]),'-p1','-d',d,'-i',patch],{encoding:'utf8'});
 if(r.status!==0)return rendre(source,texte,'refusé : '+(r.stderr||r.stdout||r.error?.message));
 return rendre(cible,fs.readFileSync(cible,'utf8'),SANS?'retiré':'appliqué');}
/* Le module `src/core.js` voulu (avec ou sans le patch), chargé à part du cache de `require`. */
function core(){const f=fichier('src/core.js');if(f.chemin===path.join(racine,'src/core.js'))return require(f.chemin);
 const Module=require('node:module'),m=new Module(f.chemin,module);m.filename=path.join(racine,'src/core.js');m.paths=Module._nodeModulePaths(path.join(racine,'src'));
 m._compile(f.texte,m.filename);return m.exports;}
/* Met ce module à la place de `src/core.js` dans le cache de `require` : à appeler AVANT de charger le moteur, les fixtures ou la page. */
function installerCore(){const f=fichier('src/core.js'),source=path.join(racine,'src/core.js');if(f.chemin===source)return require(source);
 const Module=require('node:module'),m=new Module(source,module);m.filename=source;m.paths=Module._nodeModulePaths(path.dirname(source));
 m._compile(f.texte,source);m.loaded=true;require.cache[source]=m;return m.exports;}
module.exports={racine,SANS,fichier,core,installerCore};
