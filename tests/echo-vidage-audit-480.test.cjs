'use strict';
/* 4.8.0 (audit qualité, D01) — Écho avec de vrais téléchargements confirmés
 * (faux chrome.downloads piloté par l'essai) : purge après confirmation
 * seulement, et l'export final attend la fin d'un vidage en cours. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {panneau}=require('../tools/audit-qualite-480.cjs');
const {Sessions}=require('../src/native-session.js'),settings=require('../src/settings.js');
function telechargements(){const ecoutes=new Set(),faits=[];let n=0;
  return {faits,finir:(i,etat='complete')=>{faits[i].etat=etat;for(const f of [...ecoutes])f({id:faits[i].id,state:{current:etat}});},
    api:{download:async o=>{faits.push({id:++n,nom:o.filename,etat:'in_progress'});return n;},search:async({id})=>[{id,state:faits.find(f=>f.id===id)?.etat}],
      onChanged:{addListener:f=>ecoutes.add(f),removeListener:f=>ecoutes.delete(f)}}};}
async function echo(){const clouds=new Map([['A',{captureId:'A',pointsSceneRelative:[[0,0,0]]}]]);
  const s={native:{id:'s',status:'RUNNING',visits:[],incomplete:[],cloudIds:['A']}};
  const store={all:async()=>[],getCloud:async id=>clouds.get(id),deleteCloud:async id=>clouds.delete(id)};
  const session=new Sessions({s,save:async()=>{}},{},store),dl=telechargements();
  const p=await panneau(s,{hash:'#native',chromeExtra:{downloads:dl.api},globals:{BananeStorage3:class{constructor(){return store;}},BananeSettings:settings},reponses:{
    'native-export-advice':{due:true,bytesPending:1,segments:0},
    'native-export-manifest':args=>session.exportManifest(args?.all===true).catch(()=>({sessionId:'s',cloudIds:[...clouds.keys()]})),
    'native-export-ack':args=>session.ackExported(args.ids,{confirmes:args.confirmed}),'native-end':{}}});
  session.dataset=async()=>({session:s.native,records:[],events:[],cloudIds:s.native.cloudIds.slice()});session.exportAdvice=()=>({due:false});
  return {p,dl,clouds,s};}
const attendre=async p=>{for(let i=0;i<5;i++)await p.attendre();};
test('vidage confirmé : le nuage est purgé ; refusé : il reste',async()=>{
  for(const [etat,reste] of [['complete',false],['interrupted',true]]){
    const {p,dl,clouds}=await echo();const vidage=p.intervals[1]();await attendre(p);
    assert.equal(dl.faits.length,1);assert.equal(clouds.has('A'),true,'rien de purgé avant la fin du fichier');
    dl.finir(0,etat);await vidage;await attendre(p);assert.equal(clouds.has('A'),reste,etat);
    assert.equal(p.appels.find(a=>a.action==='native-export-ack')?.args?.fichiers,1,'l’acquittement dit le nombre de fichiers écrits');}
});
test('l’export final attend la fin du vidage en cours',async()=>{
  const {p,dl}=await echo();const vidage=p.intervals[1]();await attendre(p);
  const fin=p.$('native-end').onclick();await attendre(p);
  assert.equal(p.appels.some(a=>a.action==='native-export-manifest'&&a.args?.all),false,'l’export final attend');
  dl.finir(0);await vidage;await attendre(p);
  const i=p.appels.findIndex(a=>a.action==='native-export-ack'),j=p.appels.findIndex(a=>a.action==='native-export-manifest'&&a.args?.all);
  assert.ok(i>=0&&j>i,'acquittement du vidage, puis manifeste de l’export final');
  for(let k=1;k<dl.faits.length;k++)dl.finir(k);await fin;
});
