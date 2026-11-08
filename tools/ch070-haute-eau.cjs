#!/usr/bin/env node
'use strict';
/* CH-070 : haute eau de l'arène du cœur (vba_occupe, octets alloués pendant UN appel) et mémoire linéaire, par fonction,
 * sur les plus grosses entrées réelles de banane-data ; puis le bilan entier (85 Mo), au plafond de 256 Mio.
 *   CH070_TRAVAIL=… node --max-old-space-size=8000 tools/ch070-haute-eau.cjs [--json SORTIE] */
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const C=require('./ch064-corpus.cjs'),X=require('../src/native-export.js'),P=require('../src/part-summary-49.js'),Vba=require('../ariane-rs/coquille/vba.js'),{construire}=require('./ch070-construire.cjs');
const lire=(z,e)=>JSON.parse(execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1,encoding:'utf8'}));
function premier(m){for(const z of C.zips())for(const e of C.entrees(z))if(m.test(e))return lire(z,e);return null;}
const w=construire(),module_=new WebAssembly.Module(fs.readFileSync(w));
const IMPORTS={env:{js_sin:Math.sin,js_cos:Math.cos,js_tan:Math.tan,js_atan2:Math.atan2,js_exp:Math.exp,js_log:Math.log,js_log10:Math.log10,js_log1p:Math.log1p,js_pow:Math.pow}};
/* Une instance NEUVE par mesure : la mémoire linéaire vaut alors exactement ce que l'appel a demandé. */
function mesurer(nom,f,v){const ex=new WebAssembly.Instance(module_,IMPORTS).exports,t=Vba.encoder(v),p=ex.vba_reserver(t.length);
 new Uint8Array(ex.memory.buffer,p,t.length).set(t);let r;
 try{const m=ex.vba_appel(f,p,t.length);const out=Vba.decoder(new Uint8Array(ex.memory.buffer,ex.vba_resultat(),m).slice());
  r={nom,trameEntreeOctets:t.length,arenePendantAppel:ex.vba_occupe(),memoireLineaire:ex.memory.buffer.byteLength,issue:out&&out.__erreurVba?out.nom+': '+out.message.slice(0,40):'rendu'};}
 catch(e){r={nom,trameEntreeOctets:t.length,memoireLineaire:ex.memory.buffer.byteLength,issue:'trappe : '+e.message};}
 console.error(JSON.stringify(r));return r;}
const echo=X.expand(premier(/ariane-echo-.*seg01/)),bilan=premier(/bilan-v4.*seg01/),j=P.fromJournal(bilan),proj=j.events.map(P.projectEvent).filter(Boolean);
const gros=echo.records.slice().sort((a,b)=>JSON.stringify(b).length-JSON.stringify(a).length)[0];
const S={movementThresholdM:0.001,ecritureReferenceSeuilM:0.001,freshnessSkewMs:50,watermarkBytes:36*1048576,qualityRailLimit:4000};
const res=[
 mesurer('summarize (événements projetés, panneau)',251,{a:[{...j,events:proj,details:true,historyStatus:'available'}],locale:'en-US'}),
 mesurer('historique',263,{a:[{departs:bilan.fichesDepart,fins:bilan.finsLot,courant:bilan.state.batch}],locale:'en-US'}),
 mesurer('classify (plus gros enregistrement)',280,{a:[gros],reglages:S}),
 mesurer('reconstruireCut (plus gros enregistrement)',294,{a:[gros]}),
 mesurer('health (session entière)',277,{native:echo.session,reglages:S}),
 mesurer('summarize (bilan ENTIER brut, 94 000 événements)',251,{a:[{...j,details:true}],locale:'en-US'})];
const out={format:'ch070-haute-eau-v1',plafondOctets:268435456,res};
if(process.argv.includes('--json'))fs.writeFileSync(process.argv[process.argv.indexOf('--json')+1],JSON.stringify(out,null,1)+'\n');console.log(JSON.stringify(out,null,1));
