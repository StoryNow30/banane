#!/usr/bin/env node
'use strict';
/* Lecture LiDAR en Rust dans le paquet (D-296, étape 6 a de CH-064) : fabrique et vérifie les trois fichiers de page.
 *   node tools/rust-lidar-paquet.cjs --construire   (cargo requis) : reconstruit le module puis écrit les trois fichiers
 *   node tools/rust-lidar-paquet.cjs --verifier     (sans cargo)    : vérifie qu'ils sont à jour ; code 1 sinon
 * Fichiers (injectés dans le monde MAIN de la page ESV, après vendor/lidar.js, par background.js : PAGE_FILES) :
 *   vendor/ariane-lidar.js       copie conforme de la coquille ariane-rs/crates/ariane-lidar/js/lidar-wasm.js ;
 *   vendor/ariane-lidar-wasm.js  le module ariane_lidar.wasm en base64, avec son SHA-256 (vérifié au chargement) ;
 *   vendor/lidar-rust.js         la variante de vendor/lidar.js (même texte + une branche + la file des captures), exportée
 *                                sous BananeLidarRust ; vendor/lidar.js n'est PAS modifié.
 * Aucun de ces fichiers ne s'écrit à la main : la vérification est faite par tools/package.py et par tests/rust-lidar.test.cjs. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const RACINE=path.resolve(__dirname,'..'),ESPACE=path.join(RACINE,'ariane-rs');
const SOURCE_COQUILLE=path.join(ESPACE,'crates','ariane-lidar','js','lidar-wasm.js');
const WASM=path.join(ESPACE,'target','wasm32-unknown-unknown','release','ariane_lidar.wasm');
const SORTIES={coquille:'vendor/ariane-lidar.js',wasm:'vendor/ariane-lidar-wasm.js',variante:'vendor/lidar-rust.js'};
const ENTETE='/* FICHIER FABRIQUÉ par tools/rust-lidar-paquet.cjs : ne pas éditer à la main. */\n';
const lire=f=>fs.readFileSync(path.join(RACINE,f),'utf8');
function texteCoquille(){return ENTETE+fs.readFileSync(SOURCE_COQUILLE,'utf8');}
/* La variante est calculée par la coquille donnée (par défaut : celle du paquet, vendor/ariane-lidar.js), sur le vendor/lidar.js courant. */
function texteVariante(coquille=path.join(RACINE,SORTIES.coquille)){const W=require(coquille),v=W.variante(lire('vendor/lidar.js'));
 const a='root.BananeLidar=api';if(v.split(a).length!==2)throw Error('vendor/lidar.js : export BananeLidar introuvable ou multiple');
 return ENTETE+v.replace(a,'root.BananeLidarRust=api');}
function texteWasm(octets){const sha=crypto.createHash('sha256').update(octets).digest('hex');
 return ENTETE+`/* ariane_lidar.wasm (crate ariane-lidar), ${octets.length} octets. */\n(function(root){root.ARIANE_LIDAR_WASM=Object.freeze({sha256:'${sha}',octets:${octets.length},base64:'${octets.toString('base64')}'});})(typeof globalThis!=='undefined'?globalThis:this);\n`;}
/* Lit le module embarqué dans vendor/ariane-lidar-wasm.js (sans l'exécuter dans ce processus : le texte est analysé). */
function wasmEmbarque(){const t=lire(SORTIES.wasm),m=/sha256:'([0-9a-f]{64})',octets:(\d+),base64:'([A-Za-z0-9+/=]*)'/.exec(t);
 if(!m)throw Error(SORTIES.wasm+' : forme inattendue');const o=Buffer.from(m[3],'base64');return {sha:m[1],n:Number(m[2]),octets:o};}
function verifier(){const e=[];
 for(const [k,f] of Object.entries(SORTIES))if(!fs.existsSync(path.join(RACINE,f)))e.push(f+' absent');
 if(e.length)return e;
 // la source de la coquille (ariane-rs/, hors paquet) n'est comparée que si elle est présente dans l'arbre
 if(fs.existsSync(SOURCE_COQUILLE)&&lire(SORTIES.coquille)!==texteCoquille())e.push(SORTIES.coquille+' diffère de la coquille de ariane-lidar');
 if(lire(SORTIES.variante)!==texteVariante())e.push(SORTIES.variante+' diffère de la variante de vendor/lidar.js');
 const w=wasmEmbarque(),sha=crypto.createHash('sha256').update(w.octets).digest('hex');
 if(sha!==w.sha||w.octets.length!==w.n)e.push(SORTIES.wasm+' : SHA-256 ou taille faux');
 try{new WebAssembly.Module(w.octets);}catch(x){e.push(SORTIES.wasm+' : module invalide ('+x.message+')');}
 if(fs.existsSync(WASM)&&!fs.readFileSync(WASM).equals(w.octets))e.push(SORTIES.wasm+' : diffère du module construit dans ariane-rs/target (relancer --construire)');
 return e;}
function construire(){const r=spawnSync('cargo',['build','--release','--target','wasm32-unknown-unknown','-p','ariane-lidar'],{cwd:ESPACE,encoding:'utf8'});
 if(r.status!==0)throw Error('cargo : '+r.stderr);
 fs.writeFileSync(path.join(RACINE,SORTIES.coquille),texteCoquille());fs.writeFileSync(path.join(RACINE,SORTIES.variante),texteVariante(SOURCE_COQUILLE));
 fs.writeFileSync(path.join(RACINE,SORTIES.wasm),texteWasm(fs.readFileSync(WASM)));}
module.exports={verifier,SORTIES};
if(require.main===module){const a=process.argv.slice(2);
 if(a.includes('--construire'))construire();
 const e=verifier();if(e.length){console.error(e.join('\n'));process.exit(1);}console.log('lecture LiDAR en Rust : fichiers de page à jour ('+Object.values(SORTIES).join(', ')+')');}
