#!/usr/bin/env node
'use strict';
/* CH-064 : construit le cœur WASM (ariane-rs/) et l'enveloppe base64 chargeable par importScripts.
 *   node tools/ch064-construire.cjs            → ariane-rs/dist/ariane-coeur.wasm et ariane-coeur.wasm.js
 * Rien de ce qui est produit n'est versionné (ariane-rs/.gitignore). Rend le chemin du .wasm, ou null si cargo est absent. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const RACINE=path.resolve(__dirname,'..','ariane-rs'),DIST=path.join(RACINE,'dist');
function cargoPresent(){const r=spawnSync('cargo',['--version'],{encoding:'utf8'});return r.status===0;}
function construire({silencieux=false}={}){
 if(!cargoPresent())return null;
 const r=spawnSync('cargo',['build','--release','--target','wasm32-unknown-unknown','-p','ariane-coeur'],{cwd:RACINE,encoding:'utf8',stdio:silencieux?'pipe':'inherit'});
 if(r.status!==0)throw Error('Construction du cœur WASM en échec :\n'+(r.stderr||''));
 const wasm=path.join(RACINE,'target','wasm32-unknown-unknown','release','ariane_coeur.wasm');
 fs.mkdirSync(DIST,{recursive:true});const sortie=path.join(DIST,'ariane-coeur.wasm'),octets=fs.readFileSync(wasm);fs.writeFileSync(sortie,octets);
 fs.writeFileSync(sortie+'.js','/* Généré par tools/ch064-construire.cjs : ne pas éditer. */\nglobalThis.ARIANE_COEUR_WASM_B64='+JSON.stringify(octets.toString('base64'))+';\n');
 return sortie;
}
module.exports={construire,cargoPresent,DIST};
if(require.main===module){const s=construire();if(!s){console.error('cargo absent : rien construit.');process.exit(2);}console.log(s,fs.statSync(s).size,'octets');}
