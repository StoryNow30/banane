'use strict';
/* CH-080 (D-309) — séance de maquette pour l'essai navigateur (tests/esv-maquette/ch080-prechauffage.test.cjs) et le banc (tools/ch080-banc.cjs).
 * Celle de CH-077 (tests/esv-maquette/ch077-outils.cjs), avec la maquette en mode `saut` (une coupe à faire toutes les N, les autres validées : « cut non
 * validé suivant » saute de N coupes) et, au choix, l'adaptateur du tronc (« sans le correctif ») ou sa copie patchée par chantiers/CH-080/adapter-page.patch. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const N=require('./navigateur.cjs'),O77=require('./ch077-outils.cjs');
let copie=null;
/* Copie patchée (null si l'outil `patch` manque ; exception si le patch ne s'applique plus). Patch déjà intégré au tronc : le tronc tel quel. */
function adaptateurCH080(){if(copie!==null)return copie;const tronc=O77.adaptateurPatche();if(tronc===null)return null;if(tronc.includes('CH-080'))return copie=tronc;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch080-m-'));fs.mkdirSync(path.join(dir,'src'));fs.writeFileSync(path.join(dir,'src/adapter-page.js'),tronc);
 const r=spawnSync('patch',['-s','-p1','-d',dir,'-i',path.join(N.racine,'chantiers/CH-080/adapter-page.patch')],{encoding:'utf8'});
 if(r.error?.code==='ENOENT')return null;if(r.status!==0)throw Error('le patch CH-080 ne s’applique plus : '+(r.stderr||r.stdout));
 return copie=fs.readFileSync(path.join(dir,'src/adapter-page.js'),'utf8');}
/* `correctif` : adaptateur patché (true) ou celui du tronc (false) ; hiérarchie EPT en fichiers (CH-080, étape « hiérarchie ») par défaut ; `saut` : coupes entre deux coupes à faire ; réglage livré (sautMin 11) par défaut. */
function ouvrir({correctif=true,prechauffer=true,saut=50,reglage={},hierarchieFichiers=true,forme=null}={}){   /* `forme` : 'r', forme SUPPOSÉE des nœuds d'ESV (CH-080b) */   /* `hierarchieFichiers` : hiérarchie EPT lue dans des fichiers, comme Potree 1.8 */
 return O77.ouvrir({prechauffer,reglage:{sautMin:require('../../src/settings.js').lot.chargement.prechauffer.sautMin,...reglage},maquette:{cuts:2*saut+1,saut,eptHier:hierarchieFichiers?1:0,...(forme?{eptForme:forme}:{})},
  adaptateur:correctif?adaptateurCH080():O77.adaptateurPatche()});}
module.exports={ouvrir,adaptateurCH080};
