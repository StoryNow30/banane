#!/usr/bin/env node
'use strict';
/* CH-070 : construit un cœur WASM QUI COMPREND ariane-session, sans toucher ariane-coeur dans le dépôt : copie de
 * ariane-rs/ (sans target ni dist) dans un dossier de travail hors dépôt, application de
 * chantiers/CH-070/coeur-aiguillage.patch (l'aiguillage 250–299 proposé au chef), construction release wasm32.
 *   node tools/ch070-construire.cjs [--dossier D]   → chemin du .wasm (D/ariane-rs/target/…/ariane_coeur.wasm)
 * Le dossier de travail (défaut : $CH070_TRAVAIL, sinon <tmp>/ch070-coeur) garde sa cible (constructions incrémentales). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const RACINE=path.resolve(__dirname,'..');
function copier(de,vers){fs.mkdirSync(vers,{recursive:true});for(const n of fs.readdirSync(de)){if(n==='target'||n==='dist')continue;
 const a=path.join(de,n),b=path.join(vers,n),s=fs.statSync(a);if(s.isDirectory())copier(a,b);else if(!fs.existsSync(b)||fs.readFileSync(b).compare(fs.readFileSync(a))!==0)fs.copyFileSync(a,b);}}
function construire({dossier=process.env.CH070_TRAVAIL||path.join(os.tmpdir(),'ch070-coeur'),cible='wasm32-unknown-unknown'}={}){
 const rs=path.join(dossier,'ariane-rs');
 // les sources sont recopiées à chaque fois (les fichiers changés seulement), puis le patch est réappliqué
 for(const f of ['crates/ariane-coeur/Cargo.toml','crates/ariane-coeur/src/abi.rs'])if(fs.existsSync(path.join(rs,f)))fs.rmSync(path.join(rs,f));
 copier(path.join(RACINE,'ariane-rs'),rs);
 const p=spawnSync('patch',['-p2','-s','-i',path.join(RACINE,'chantiers/CH-070/coeur-aiguillage.patch')],{cwd:rs,encoding:'utf8'});
 if(p.status!==0)throw Error('patch : '+p.stdout+p.stderr);
 const r=spawnSync('cargo',['build','--release','--target',cible,'-p','ariane-coeur'],{cwd:rs,encoding:'utf8'});
 if(r.status!==0)throw Error('construction : '+r.stderr.slice(-3000));
 return path.join(rs,'target',cible,'release','ariane_coeur.wasm');
}
module.exports={construire};
if(require.main===module){const w=construire();console.log(w,fs.statSync(w).size,'octets');}
