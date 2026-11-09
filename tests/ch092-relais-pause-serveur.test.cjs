'use strict';
/* CH-092 (relecture en adversaire de CH-089) — DÉFAUT 2 : le motif `pause-serveur` (CH-089) est dans les listes fermées de l'observateur
 * (src/esv-observer.js, PRECH_MOTIFS et PRECH_MOTIFS_LOIN) mais pas dans celles du service worker (background.js, OBS_PRECH_MOTIFS et
 * OBS_PRECH_MOTIFS_LOIN) : le service worker relit l'événement et remplace le motif par null. Dans le journal du lot, une pause de 10 s du
 * préchauffage (erreur passagère d'ESV) ne se distingue plus d'un motif inconnu : la règle livrée par CH-089 n'est pas mesurable sur le terrain.
 * Essais rouges marqués `todo` ; background.js n'est pas modifié ici. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {world}=require('./helpers/fake-page.cjs');
const SRC=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
function obsFields(){const debut=SRC.indexOf('const obsInt='),fin=SRC.indexOf('}return null;}',SRC.indexOf('function obsFields('))+'}return null;}'.length;
 const ctx={OBS_REASONS:new Set()};vm.createContext(ctx);vm.runInContext(SRC.slice(debut,fin)+';this.obsFields=obsFields;',ctx);return ctx.obsFields;}
const EVTS=[{kind:'prechauffage',coupe:20,predite:21,op:1,saut:1,source:'liste-esv',noeuds:0,octets:0,annule:false,motif:'pause-serveur'},
 {kind:'prechauffage-loin',coupe:20,cible:90,saut:70,avant:3,source:'liste-esv',motif:'pause-serveur',plafond:false}];
function relais(){const w=world();for(const event of EVTS)w.deliver({kind:'banane5:evt',event});
 const ring=w.observed().filter(x=>/^prechauffage/.test(x.kind)),F=obsFields();return {ring,sw:ring.map(x=>F(x))};}

test('montage : l’observateur garde `pause-serveur` pour les deux événements (comportement livré, vert)',()=>{
 const {ring}=relais();assert.deepEqual(ring.map(x=>x.motif),['pause-serveur','pause-serveur']);});

test('défaut 2a : le service worker garde le motif `pause-serveur` de l’événement `prechauffage`',
 {todo:'CH-092 défaut 2 : `pause-serveur` absent de OBS_PRECH_MOTIFS (background.js)'},()=>{
 assert.equal(relais().sw[0].motif,'pause-serveur');});

test('défaut 2b : le service worker garde le motif `pause-serveur` de l’événement `prechauffage-loin`',
 {todo:'CH-092 défaut 2 : `pause-serveur` absent de OBS_PRECH_MOTIFS_LOIN (background.js)'},()=>{
 assert.equal(relais().sw[1].motif,'pause-serveur');});

test('défaut 2c : tout motif fermé de l’observateur est connu du service worker (les deux listes ne divergent pas)',
 {todo:'CH-092 défaut 2 : listes de motifs divergentes entre src/esv-observer.js et background.js'},()=>{
 const O=fs.readFileSync(path.join(__dirname,'../src/esv-observer.js'),'utf8');
 const liste=(src,nom)=>{const m=new RegExp('(?:const |,)'+nom+'=\\[([^\\]]*)\\]').exec(src);assert.ok(m,nom+' introuvable');return m[1].split(',').map(x=>x.trim().replace(/^'|'$/g,'')).filter(Boolean);};
 for(const [o,s] of [['PRECH_MOTIFS','OBS_PRECH_MOTIFS'],['PRECH_MOTIFS_LOIN','OBS_PRECH_MOTIFS_LOIN'],['PRECH_SOURCES','OBS_PRECH_SOURCES']]){
  const absents=liste(O,o).filter(x=>!liste(SRC,s).includes(x));assert.deepEqual(absents,[],o+' → '+s);}
});
