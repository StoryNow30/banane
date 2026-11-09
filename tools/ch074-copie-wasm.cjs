#!/usr/bin/env node
'use strict';
/* CH-074 (J5) : COPIE du dépôt (fichiers suivis de HEAD) dont le service worker charge gcv2-l1 par le cœur WASM, pour passer les
 * parités du service worker (tools/parite-l1se-sw.cjs, tools/parite-relecture-sw.cjs) avec `--racine` sur le cœur branché.
 *   node tools/ch074-copie-wasm.cjs SORTIE [--modules gcv2L1]
 * Dans la COPIE seulement (jamais le dépôt, jamais le paquet) :
 *   - background.js et ariane/ : ceux de la construction séparée (tools/ch064-construire-extension.cjs, module gcv2L1 sur demande) ;
 *   - tests/helpers/perf-production.cjs : le contexte vm du service worker reçoit `TextDecoder` et `atob`, que le vrai service worker a
 *     (le cœur décode sa VBA et son WASM avec) ; rien d'autre n'y change ;
 *   - tools/parite-l1se-sw.cjs : les compteurs du cœur écrits à la fin (sortie d'erreur).
 * La copie porte ARIANE_RS (provenance). Le dossier SORTIE est vidé d'abord. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {construireExtension}=require('./ch064-construire-extension.cjs');
const RACINE=path.resolve(__dirname,'..');
function copie(sortie,modules=['gcv2L1']){
 if(!sortie||path.resolve(sortie).startsWith(RACINE+path.sep))throw Error('SORTIE hors du dépôt attendue');
 fs.rmSync(sortie,{recursive:true,force:true});fs.mkdirSync(sortie,{recursive:true});
 const tar=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'ch074-')),'h.tar');
 execFileSync('git',['archive','--format=tar','-o',tar,'HEAD'],{cwd:RACINE});execFileSync('tar',['-xf',tar,'-C',sortie]);fs.rmSync(path.dirname(tar),{recursive:true,force:true});
 const ext=construireExtension({modules,sortie:fs.mkdtempSync(path.join(os.tmpdir(),'ch074-ext-'))});
 fs.cpSync(path.join(ext,'ariane'),path.join(sortie,'ariane'),{recursive:true});
 fs.copyFileSync(path.join(ext,'background.js'),path.join(sortie,'background.js'));
 fs.copyFileSync(path.join(ext,'ARIANE_RS'),path.join(sortie,'ARIANE_RS'));
 fs.rmSync(ext,{recursive:true,force:true});
 const hp=path.join(sortie,'tests','helpers','perf-production.cjs'),h=fs.readFileSync(hp,'utf8'),ancre='const ctx={console,URL,TextEncoder,';
 if(h.split(ancre).length!==2)throw Error('perf-production.cjs a changé : contexte introuvable');
 fs.writeFileSync(hp,h.replace(ancre,ancre+"TextDecoder,atob:globalThis.atob,"));
 /* tools/parite-l1se-sw.cjs de la copie : les compteurs du cœur et des façades (ARIANE_RS_COMPTEURS) écrits sur la sortie d'erreur à la fin,
  * pour prouver que gcv2-l1 a bien été servi par le cœur pendant la parité. */
 const pp=path.join(sortie,'tools','parite-l1se-sw.cjs'),p=fs.readFileSync(pp,'utf8'),a2="  process.stdout.write(JSON.stringify({ partie: a.partie, lot: a.lot, profil,";
 if(p.split(a2).length!==2)throw Error('parite-l1se-sw.cjs a changé : sortie introuvable');
 const trace="  try { process.stderr.write('ARIANE_RS_COMPTEURS ' + JSON.stringify(b.get('ARIANE_RS_COMPTEURS()')) + '\\n'); } catch (e) { process.stderr.write('ARIANE_RS_COMPTEURS absent\\n'); }\n";
 fs.writeFileSync(pp,p.replace(a2,trace+a2));
 return sortie;
}
module.exports={copie};
if(require.main===module){const a=process.argv.slice(2),i=a.indexOf('--modules');console.log(copie(path.resolve(a[0]),i>=0?a[i+1].split(','):undefined));}
