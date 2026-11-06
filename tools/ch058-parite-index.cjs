#!/usr/bin/env node
'use strict';
/* CH-058 — Parité de l'index du journal sur de vrais journaux : chaque étape bornée rend-elle EXACTEMENT ce que rendait
 * la lecture complète ? On rejoue, sur le journal entier puis sur le seul sous-ensemble que l'index fournit
 * (types de `src/journal-index.js`, ordre relatif conservé), la liste de corrections (`construire` pour chaque lot,
 * `couverture`), et les filtres par type de background.js. Toute différence est une erreur.
 *   node --max-old-space-size=6000 tools/ch058-parite-index.cjs J1.json [J2.json …]   → code 0 si tout est identique */
const fs=require('fs'),assert=require('assert');
const path=require('path'),CL=require('../src/correction-liste.js');
/* Les types indexés, lus dans background.js (`TYPES_INDEXES`) : la parité porte sur la liste réellement livrée. */
function typesIndexes(racine=path.resolve(__dirname,'..')){const bg=fs.readFileSync(path.join(racine,'background.js'),'utf8');
 const m=bg.match(/const TYPES_INDEXES=Object\.freeze\((\[[\s\S]*?\])\);/);if(!m)throw Error('TYPES_INDEXES introuvable dans background.js');return JSON.parse(m[1].replace(/'/g,'"'));}
const LISTE=typesIndexes(),TYPES=new Set(LISTE);
/* Les filtres de background.js, recopiés tels quels (lecture seule du journal). */
const FILTRES={
 validationsAriane:e=>e?.type==='validation-accepted',
 passeVol:e=>e?.type==='validation-accepted'&&e.passeDifferes===true,
 vertsAControler:e=>e?.type==='regles-metier-ombre'&&e.portee==='cut',
 finDeLotZones:e=>e?.type==='regles-metier-ombre'&&e.portee==='cut',
 fileRegistreNoter:e=>(e?.type==='passe-differes-ecriture'&&e.resultat==='ecrit')||(e?.type==='relecture-ombre'&&e.action==='corrige'),
 correctionListeDeja:e=>e?.type==='correction-liste',correctionCouverture:e=>e?.type==='correction-couverture'};
const SOUS_ENSEMBLE={validationsAriane:['validation-accepted'],passeVol:['validation-accepted'],vertsAControler:['regles-metier-ombre'],
 finDeLotZones:['regles-metier-ombre'],fileRegistreNoter:['passe-differes-ecriture','relecture-ombre'],correctionListeDeja:LISTE,correctionCouverture:LISTE};
function parite(events){const sous=events.filter(e=>TYPES.has(e?.type)),out={evenements:events.length,sousEnsemble:sous.length,controles:0};
 for(const [nom,f] of Object.entries(FILTRES)){const t=new Set(SOUS_ENSEMBLE[nom]);
  assert.deepStrictEqual(events.filter(e=>t.has(e?.type)).filter(f),events.filter(f),nom);out.controles++;}
 assert.deepStrictEqual(CL.couverture(sous,{}),CL.couverture(events,{}),'couverture');out.controles++;
 const lots=[...new Set(events.filter(e=>e?.type==='batch-started'&&e.batch?.id).map(e=>e.batch.id))];
 for(const id of lots){assert.deepStrictEqual(CL.construire(sous,{batchId:id}),CL.construire(events,{batchId:id}),'construire '+id.slice(0,0));out.controles++;}
 out.lots=lots.length;return out;}
if(require.main===module){let ko=0;
 for(const f of process.argv.slice(2)){const j=JSON.parse(fs.readFileSync(f,'utf8'));
  try{console.log(JSON.stringify({journal:f.split('/').slice(-2,-1)[0]||f,...parite(j.events||[])}));}catch(e){ko++;console.log('DIFFÉRENCE',f,e.message.slice(0,300));}}
 process.exitCode=ko?1:0;}
module.exports={parite,FILTRES,typesIndexes};
