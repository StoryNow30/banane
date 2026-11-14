#!/usr/bin/env node
'use strict';
/* CH-064, étape 4 : construction SÉPARÉE de l'extension où le cœur Rust/WASM remplace les modules portés, par leurs
 * façades de même API. Jamais le paquet livré : le dossier produit (ariane-rs/dist/extension-wasm/, non versionné) part
 * du paquet officiel (tools/package.py), puis, dans la COPIE seulement :
 *   - manifest.json : content_security_policy.extension_pages avec 'wasm-unsafe-eval' (compiler le WASM dans le SW) ;
 *   - background.js : la coquille et le cœur chargés en tête de importScripts, puis chaque façade insérée JUSTE APRÈS le
 *     module qu'elle remplace (V4.6 après src/geometry.js, GCV1 après src/geometry-candidate-v1.js, calage après
 *     src/placement-convention.js), avant que les modules suivants ne lient la globale ;
 *   - ariane/ : les fichiers de la coquille, le cœur en base64, les scripts de branchement ; ARIANE_RS : provenance.
 *   node tools/ch064-construire-extension.cjs [--modules geometrie,gcv1,convention[,gcv2L1]] [--sortie DOSSIER]
 *   --modules '' : témoin, le paquet officiel décompressé sans aucune modification
 * Rend le dossier ; l'extension se charge non empaquetée (chrome://extensions, ou --load-extension). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {construire}=require('./ch064-construire.cjs');
const RACINE=path.resolve(__dirname,'..');
/* Chaque module : le script JS qu'il suit dans importScripts et la globale qu'il remplace. */
const MODULES={
 geometrie:{apres:'src/geometry.js',script:'facade-geometrie.js',corps:"globalThis.BananeGeometry3=ARIANE_RS_FACADES.geometrie=ArianeFacadeGeometrie.creer(ArianeCoeurSW,globalThis.BananeGeometry3);"},
 gcv1:{apres:'src/geometry-candidate-v1.js',script:'facade-gcv1.js',corps:"globalThis.BananeGeometry3=ARIANE_RS_FACADES.gcv1=ArianeFacadeGcv1.creer(ArianeCoeurSW,globalThis.BananeGeometry3);"},
 convention:{apres:'src/placement-convention.js',script:'facade-convention.js',corps:"globalThis.BananePlacementConvention=ARIANE_RS_FACADES.convention=ArianeFacadeConvention.creer(ArianeCoeurSW,globalThis.BananePlacementConvention);"},
 /* CH-074 (J5) : GCV2 L1 (src/gcv2-l1.js) par la façade de décision ; seulement sur demande (`--modules …,gcv2L1`), jamais par défaut. */
 gcv2L1:{apres:'src/gcv2-l1.js',script:'facade-decision.js',corps:"{const R=ArianeFacadeDecision.creer(ArianeCoeurSW,{gcv2L1:globalThis.BananeGcv2L1,shadow:globalThis.BananeGCV1Shadow,convention:globalThis.BananePlacementConvention});ARIANE_RS_FACADES.gcv2L1=R;globalThis.BananeGcv2L1=R.gcv2L1;}"},
};
const DEFAUT=['geometrie','gcv1','convention'];
function construireExtension({modules=DEFAUT,sortie=path.join(RACINE,'ariane-rs','dist','extension-wasm')}={}){
 const w=construire({silencieux:true});if(!w)throw Error('cargo absent');
 const zip=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'ch064-ext-')),'ariane.zip');
 execFileSync('python3',[path.join(RACINE,'tools','package.py'),'--output',zip],{cwd:RACINE,stdio:'pipe'});
 fs.rmSync(sortie,{recursive:true,force:true});fs.mkdirSync(sortie,{recursive:true});
 execFileSync('unzip',['-q',zip,'-d',sortie]);fs.rmSync(path.dirname(zip),{recursive:true,force:true});
 if(!modules.length)return sortie; // témoin : le paquet officiel tel quel, pour comparer
 // manifeste de la copie
 const mp=path.join(sortie,'manifest.json'),m=JSON.parse(fs.readFileSync(mp,'utf8'));
 m.content_security_policy={...(m.content_security_policy||{}),extension_pages:"script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"};
 m.name=m.name+' (cœur Rust, essai CH-064)';fs.writeFileSync(mp,JSON.stringify(m,null,2)+'\n');
 // coquille, cœur, branchements
 const a=path.join(sortie,'ariane');fs.mkdirSync(a);
 for(const f of ['vba.js','coeur.js','facade-geometrie.js','facade-gcv1.js','facade-convention.js','facade-decision.js'])fs.copyFileSync(path.join(RACINE,'ariane-rs','coquille',f),path.join(a,f));
 fs.copyFileSync(w+'.js',path.join(a,'coeur.wasm.js'));
 fs.writeFileSync(path.join(a,'branchement-coeur.js'),"'use strict';\n/* CH-064 : instance du cœur du service worker (mémoire bornée par réinstanciation au-delà de 64 Mio). */\n"+
  "globalThis.ArianeCoeurSW=ArianeCoeur.creer(ARIANE_COEUR_WASM_B64,{seuilReinstanciation:64*1024*1024});globalThis.ARIANE_RS_MODULES="+JSON.stringify(modules)+";\n"+
  "globalThis.ARIANE_RS_FACADES={};globalThis.ARIANE_RS_COMPTEURS=()=>({coeur:ArianeCoeurSW.etat(),facades:Object.fromEntries(Object.entries(ARIANE_RS_FACADES).map(([k,f])=>[k,f.compteurs()]))});\n");
 const tete=['ariane/vba.js','ariane/coeur.js','ariane/coeur.wasm.js','ariane/branchement-coeur.js','ariane/facade-geometrie.js','ariane/facade-gcv1.js','ariane/facade-convention.js','ariane/facade-decision.js'];
 const bp=path.join(sortie,'background.js');let b=fs.readFileSync(bp,'utf8');
 const debut="importScripts('vendor/capture-core.js',";if(!b.includes(debut))throw Error('background.js a changé : importScripts introuvable');
 b=b.replace(debut,"importScripts("+tete.map(t=>"'"+t+"'").join(',')+",'vendor/capture-core.js',");
 for(const nom of modules){const d=MODULES[nom];if(!d)throw Error('module inconnu : '+nom);
  const f='ariane/branchement-'+nom+'.js';fs.writeFileSync(path.join(sortie,f),"'use strict';\n/* CH-064 : façade WASM de "+d.apres+" (même API). */\n"+d.corps+"\n");
  const ancre="'"+d.apres+"',";const n=b.split(ancre).length-1;if(n!==1)throw Error('ancre '+d.apres+' trouvée '+n+' fois dans background.js');
  b=b.replace(ancre,ancre+"'"+f+"',");}
 fs.writeFileSync(bp,b);
 fs.writeFileSync(path.join(sortie,'ARIANE_RS'),JSON.stringify({chantier:'CH-064',modules,commit:execFileSync('git',['rev-parse','--short','HEAD'],{cwd:RACINE,encoding:'utf8'}).trim(),
  coeurOctets:fs.statSync(w).size},null,1)+'\n');
 return sortie;
}
module.exports={construireExtension,MODULES};
if(require.main===module){const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 console.log(construireExtension({modules:arg('--modules')!==null?arg('--modules').split(',').filter(Boolean):undefined,sortie:arg('--sortie')?path.resolve(arg('--sortie')):undefined}));}
