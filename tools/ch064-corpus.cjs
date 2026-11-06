'use strict';
/* CH-064 : corpus réel, lu dans un clone de banane-data (jamais copié dans ce dépôt).
 *   BANANE_DATA=<clone> (défaut /home/user/data/banane-data) ; collections du 04/11, du 05/11 et du 06/11 par défaut.
 * documents() : chaque entrée .json de chaque zip, un à la fois (le texte n'est jamais gardé). */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const RACINE=process.env.BANANE_DATA||'/home/user/data/banane-data';
const MOTIF=/^2026-11-0[456]_/;
function zips(motif=MOTIF){const c=path.join(RACINE,'collections');if(!fs.existsSync(c))throw Error('Corpus absent : '+c+' (BANANE_DATA)');
 const out=[];for(const d of fs.readdirSync(c).filter(n=>motif.test(n)).sort()){const pile=[path.join(c,d)];
  while(pile.length){const r=pile.pop();for(const n of fs.readdirSync(r).sort()){const f=path.join(r,n),s=fs.statSync(f);if(s.isDirectory())pile.push(f);else if(n.endsWith('.zip'))out.push(f);}}}
 return out.sort();}
function entrees(zip){return execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).split('\n').filter(n=>n.endsWith('.json'));}
function*documents(motif){for(const z of zips(motif))for(const e of entrees(z)){const texte=execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1,encoding:'utf8'});
 yield {zip:path.relative(RACINE,z),entree:e,octets:Buffer.byteLength(texte),texte};}}
module.exports={RACINE,zips,entrees,documents};
