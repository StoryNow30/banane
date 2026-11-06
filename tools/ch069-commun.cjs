'use strict';
/* CH-069 : outillage commun des bancs de l'export (parité, temps).
 *  - construireCoeur() : le cœur WASM AVEC le bras 200..=249. Si le branchement (chantiers/CH-069/branchement-coeur.patch)
 *    est déjà dans ariane-coeur, construction normale (tools/ch064-construire.cjs) ; sinon, copie de ariane-rs/ dans
 *    ariane-rs/target/ch069-src (non suivi), patch appliqué à la copie, construction à part. Le cœur suivi n'est jamais touché.
 *  - envelopper/developper : une valeur JS (Map, Set, Uint8Array compris) ↔ octets VBA, trous, −0, NaN, undefined et ordre
 *    des clés conservés ; sert à transporter les cas, à l'identique, vers Node et vers Chromium.
 *  - modules() : les modules JS de référence (lus, jamais modifiés). */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const Vba=require('../ariane-rs/coquille/vba.js');
const RACINE=path.resolve(__dirname,'..'),RS=path.join(RACINE,'ariane-rs'),PATCH=path.join(RACINE,'chantiers/CH-069/branchement-coeur.patch');
function brancheDansLeCoeur(){return fs.readFileSync(path.join(RS,'crates/ariane-coeur/src/abi.rs'),'utf8').includes('ariane_export::appeler');}
function copier(src,dst){fs.mkdirSync(dst,{recursive:true});for(const n of fs.readdirSync(src)){if(n==='target'||n==='dist')continue;const a=path.join(src,n),b=path.join(dst,n);
 if(fs.statSync(a).isDirectory())copier(a,b);else fs.copyFileSync(a,b);}}
function construireCoeur({silencieux=true,patchs=[],memoireMax=null}={}){
 if(brancheDansLeCoeur()&&!patchs.length&&!memoireMax)return require('./ch064-construire.cjs').construire({silencieux});
 const copie=path.join(RS,'target',(patchs.length?'ch069-p-src':'ch069-src')+(memoireMax?'-max':''));fs.rmSync(copie,{recursive:true,force:true});copier(RS,copie);
 for(const f of [...(brancheDansLeCoeur()?[]:[PATCH]),...patchs]){const p=spawnSync('patch',['-p2','-d',copie,'-i',f],{encoding:'utf8'});if(p.status!==0)throw Error('patch '+f+' : '+p.stdout+p.stderr);}
 const cible=(patchs.length?'ch069-p':'ch069')+(memoireMax?'-max'+memoireMax:'');const env={...process.env};
 if(memoireMax)env.CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS='-C link-arg=--max-memory='+memoireMax;
 const r=spawnSync('cargo',['build','--release','--target','wasm32-unknown-unknown','-p','ariane-coeur','--target-dir',path.join(RS,'target',cible)],
  {cwd:copie,encoding:'utf8',stdio:silencieux?'pipe':'inherit',env});
 if(r.status!==0)throw Error('construction du cœur (copie patchée) : '+(r.stderr||'').slice(-2000));
 const w=path.join(RS,'target',cible,'wasm32-unknown-unknown','release','ariane_coeur.wasm');
 fs.mkdirSync(path.join(RS,'dist'),{recursive:true});const sortie=path.join(RS,'dist','ariane-coeur-'+cible+'.wasm');fs.copyFileSync(w,sortie);return sortie;
}
/* Enveloppe : les objets que la VBA refuse deviennent des objets marqués. */
const MARQUE='\u0000ch069';
function envelopper(v){
 if(v instanceof Map)return {[MARQUE]:'map',e:[...v].map(([k,x])=>[envelopper(k),envelopper(x)])};
 if(v instanceof Set)return {[MARQUE]:'set',e:[...v].map(envelopper)};
 if(v instanceof Uint8Array)return {[MARQUE]:'u8',e:Buffer.from(v.buffer,v.byteOffset,v.byteLength).toString('latin1')};
 if(Array.isArray(v)){const r=new Array(v.length);for(let i=0;i<v.length;i++)if(i in v)r[i]=envelopper(v[i]);return r;}
 if(v&&typeof v==='object'){const r={};for(const k of Object.keys(v))r[k]=envelopper(v[k]);return r;}
 return v;
}
const SOURCE_DEVELOPPER=`function developper(v){
 if(Array.isArray(v)){for(let i=0;i<v.length;i++)if(i in v)v[i]=developper(v[i]);return v;}
 if(v&&typeof v==='object'){const m=v['\\u0000ch069'];
  if(m==='map')return new Map(v.e.map(([k,x])=>[developper(k),developper(x)]));
  if(m==='set')return new Set(v.e.map(developper));
  if(m==='u8'){const o=new Uint8Array(v.e.length);for(let i=0;i<o.length;i++)o[i]=v.e.charCodeAt(i);return o;}
  for(const k of Object.keys(v))v[k]=developper(v[k]);return v;}
 return v;}`;
const developper=(0,eval)('('+SOURCE_DEVELOPPER+')');
const versOctets=v=>Vba.encoder(envelopper(v));
const depuisOctets=o=>developper(Vba.decoder(o));
/* Sorties : les Map/Set rendues (jalons de deltaMetadonnees) deviennent des listes marquées, comparables. */
const SOURCE_COMPARABLE=`function comparable(v){
 if(v instanceof Map)return {'\\u0000map':[...v].map(([k,x])=>[comparable(k),comparable(x)])};
 if(v instanceof Set)return {'\\u0000set':[...v].map(comparable)};
 if(Array.isArray(v)){const r=new Array(v.length);for(let i=0;i<v.length;i++)if(i in v)r[i]=comparable(v[i]);return r;}
 if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype){const r={};for(const k of Object.keys(v))Object.defineProperty(r,k,{value:comparable(v[k]),enumerable:true,writable:true,configurable:true});return r;}
 return v;}`;
const comparable=(0,eval)('('+SOURCE_COMPARABLE+')');
function modules(){return {NativeExport:require('../src/native-export.js'),PhasePli:require('../src/phase-pli.js'),GCV1Export:require('../src/gcv1-export.js'),
 ExportCache:require('../src/export-cache.js'),Zip:require('../src/zip-writer.js'),Coeur:require('../ariane-rs/coquille/coeur.js')};}
const SCRIPTS_NAVIGATEUR=['vendor/capture-core.js','src/core.js','src/native-export.js','src/phase-pli.js','src/gcv1-export.js','src/export-cache.js','src/zip-writer.js',
 'ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-export.js'];
const SOURCES=['src/native-export.js','src/phase-pli.js','src/gcv1-export.js','src/export-cache.js','src/zip-writer.js','vendor/capture-core.js'];
const PATCH_NOMBRE=path.join(RACINE,'chantiers/CH-069/ariane-js-nombre-rapide.patch');
module.exports={RACINE,PATCH_NOMBRE,construireCoeur,brancheDansLeCoeur,envelopper,developper,versOctets,depuisOctets,comparable,SOURCE_DEVELOPPER,SOURCE_COMPARABLE,modules,SCRIPTS_NAVIGATEUR,SOURCES};
