'use strict';
/* 4.9.0.17 (retours de l'opérateur sur la test 16).
 * 1. Tuile « Lot » : sur un lot qui couvre TOUTE la partie (premier cut 0 ou 1, jusqu'à la fin de
 *    partie) et dont la fiche de départ est connue (D-092, même batchId, la première du lot), le %
 *    est celui du TRAVAIL : cuts traités (posés + différés) ÷ invalides au départ, avec « N / M
 *    invalides ». Sinon (plage fixe, départ au milieu, pas de fiche) : la position, comme avant.
 *    Jamais de recul dans un lot, plafond 100 %, une décimale sous 10 % (vers le bas), 100 % à la fin.
 * 2. Heure de Paris partout dans le panneau (activité, départs), heure d'été et d'hiver.
 * Panneau réel (panel.js) dans un contexte vm, DOM et API Chrome simulés. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const element=tag=>({tag,hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',style:{},children:[],attrs:{},
  classList:{toggle(){}},dataset:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(){},replaceChildren(...c){this.children=c;},append(...c){this.children.push(...c);},
  addEventListener(){},set onchange(_){},set oninput(_){},set onclick(_){}});
async function panneau(etat,fiches=[]){
  const elements=new Map(),minuteries=[];let state=etat,f=fiches;
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:t=>element(t),
    getElementById(id){if(!elements.has(id)){const e=element('div');elements.set(id,e);if(id==='lot-traites')e.parentElement=element('p');}return elements.get(id);}};
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async({action})=>({result:action==='view'?state:action==='list-tabs'?[]:action==='fiches-depart'?{fiches:f}:action==='bornes-partie'?{last:null,source:null}:{}})}};
  const context={document,chrome,location:{hash:'#automatic'},addEventListener:()=>{},setInterval:(fn,ms)=>minuteries.push([fn,ms]),setTimeout:()=>{},clearTimeout:()=>{},console,BananeExportCache:{}};
  vm.createContext(context);vm.runInContext(SOURCE,context);
  const attendre=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};await attendre();
  const $=id=>document.getElementById(id);
  $.etat=async e=>{state=e;for(const [fn,ms] of minuteries)if(ms===1000)fn();await attendre();};
  /* Nouvelles fiches : la relecture des départs (toutes les 5 s). */
  $.fiches=async x=>{f=x;for(const [fn,ms] of minuteries)if(ms===5000)fn();await attendre();};
  return $;
}
const traites=n=>Array.from({length:n},(_,i)=>({cut:1+i*3}));
const lot=(scope,{n=39,cut=120,id='lot-p25',state='RUNNING',...extra}={})=>({current:{identity:{part:25,cut}},batch:{id,state,step:'apply',
  scope:{part:25,start:1,end:999999,endMode:'partie',unresolvedPolicy:'defer',lotDecision:'apply',lowConfidence:'attempt',...scope},
  processed:traites(n),skipped:[],paused:[],interrupted:[],manuallyCompleted:[],deferred:[],sequence:[],activeIdentity:{part:25,cut},lotCommands:{},...extra}});
const fiche=(x={})=>({at:'2026-10-15T08:40:00.000Z',batchId:'lot-p25',partie:25,valides:8746,invalides:514,ignores:0,total:9260,...x});
const tuile=$=>({pct:$('lot-pct').textContent,largeur:$('lot-progres-fill').style.width,unite:$('lot-traites-u').textContent,
  cache:$('lot-progres').hidden,inconnu:/indetermine/.test($('lot-progres').className),note:$('lot-progres-note').textContent});

test('lot sur toute la partie, fiche de départ du lot : 39 traités sur 514 invalides → « 7,5 » % et « / 514 invalides »',async()=>{
  const $=await panneau(lot({}),[fiche()]);
  assert.deepEqual(tuile($),{pct:'7,5',largeur:'7.59%',unite:'/ 514 invalides',cache:false,inconnu:false,note:''},'39 / 514 = 7,59 % : une décimale, arrondie vers le bas');
  assert.equal($('lot-traites').textContent,'39');
  assert.match($('lot-traites').parentElement.attrs.title,/invalides de la partie au départ du lot/);
  /* Le premier cut 0 compte aussi pour « toute la partie ». */
  const z=await panneau(lot({start:0}),[fiche()]);assert.equal(tuile(z).pct,'7,5');
});

test('la fin de partie inconnue n’empêche pas la mesure du travail (pas de bande « fin de partie inconnue »)',async()=>{
  const $=await panneau(lot({},{n:100}),[fiche()]);
  assert.deepEqual(tuile($),{pct:'19',largeur:'19.46%',unite:'/ 514 invalides',cache:false,inconnu:false,note:''},'100 / 514 = 19,46 % : entier, vers le bas');
});

test('plusieurs fiches pour le lot : la première du lot (invalides au démarrage) ; une fiche d’un autre lot ne sert pas',async()=>{
  const $=await panneau(lot({}),[fiche({batchId:'autre',invalides:50}),fiche({invalides:514}),fiche({at:'2026-10-15T09:10:00.000Z',invalides:480})]);
  assert.equal(tuile($).unite,'/ 514 invalides');assert.equal(tuile($).pct,'7,5');
  const autre=await panneau(lot({}),[fiche({batchId:'autre'})]);
  assert.equal(tuile(autre).unite,'cuts','pas de fiche pour ce lot : la tuile garde « cuts »');
  assert.equal(tuile(autre).inconnu,true,'sans fiche ni fin connue : la bande « fin de partie inconnue », comme avant');
});

test('plage fixe : la position, comme avant, même avec une fiche du lot ; « cuts »',async()=>{
  const $=await panneau(lot({start:100,end:200,endMode:undefined},{cut:125}),[fiche()]);
  assert.deepEqual(tuile($),{pct:'25',largeur:'25%',unite:'cuts',cache:false,inconnu:false,note:''},'(125 − 100) / (200 − 100)');
});

test('départ au milieu de la partie (jusqu’à la fin de partie) : la position, jamais le travail',async()=>{
  const r={totalReleve:{part:25,cut:5000,total:9260,totalSource:'compteur'}};
  const $=await panneau(lot({start:4000},{cut:5000,...r}),[fiche()]);
  const t=tuile($);assert.equal(t.unite,'cuts');assert.equal(t.pct,'19','(5000 − 4000) / (9259 − 4000) = 19,01 %');
  const sans=await panneau(lot({start:4000},{cut:5000}),[fiche()]);assert.equal(tuile(sans).inconnu,true,'fin inconnue : la bande, pas un faux chiffre');
});

test('pas de fiche de départ (ou invalides illisibles ou nuls) : retour à la position',async()=>{
  const r={totalReleve:{part:25,cut:2315,total:9258,totalSource:'compteur'}};/* (2315 − 1) / (9257 − 1) = 25 % */
  for(const fiches of [[],[fiche({invalides:0})],[fiche({invalides:null})],[fiche({partie:24})]]){
    const $=await panneau(lot({},{cut:2315,...r}),fiches);
    assert.deepEqual(tuile($),{pct:'25',largeur:'25%',unite:'cuts',cache:false,inconnu:false,note:''},JSON.stringify(fiches));}
});

test('le % ne recule jamais dans un lot ; plafonné à 100 % ; 100 % à la fin du lot',async()=>{
  const $=await panneau(lot({},{n:39}),[fiche()]);assert.equal(tuile($).pct,'7,5');
  await $.etat(lot({},{n:30}));assert.equal(tuile($).pct,'7,5','moins de cuts lus un instant : le vert ne recule pas');assert.equal($('lot-traites').textContent,'30');
  await $.etat(lot({},{n:52}));assert.equal(tuile($).pct,'10','52 / 514 = 10,1 % : entier dès 10 %');
  await $.etat(lot({},{n:600}));assert.equal(tuile($).pct,'100','plafond');assert.equal(tuile($).largeur,'100%');assert.equal(tuile($).unite,'/ 514 invalides');
  const fin=await panneau(lot({},{n:200,state:'COMPLETED'}),[fiche()]);assert.equal(tuile(fin).pct,'100','fin du lot = 100 %');
  const pos=await panneau(lot({start:100,end:200,endMode:undefined},{cut:180,state:'STOPPED',stoppedAtEnd:{cut:180,reason:'navigation-other-part'}}),[]);
  assert.equal(tuile(pos).pct,'100','position : lot clos à sa fin = 100 %');
});

test('la fiche arrive après l’ouverture du panneau : la tuile passe au travail sans attendre un nouveau cut',async()=>{
  const $=await panneau(lot({}),[]);assert.equal(tuile($).unite,'cuts');
  await $.fiches([fiche()]);assert.equal(tuile($).unite,'/ 514 invalides');assert.equal(tuile($).pct,'7,5');
});

test('une décimale sous 10 % : 1 traité sur 514 → « 0,1 » ; bord lumineux caché sous 1,5 %',async()=>{
  const toggles=[];const $=await panneau(lot({},{n:1}),[fiche()]);
  assert.equal(tuile($).pct,'0,1');assert.equal(tuile($).largeur,'0.19%');
  const p=$('lot-progres');p.classList={toggle:(c,v)=>toggles.push([c,v])};await $.etat(lot({},{n:10}));
  assert.deepEqual(toggles.at(-1),['naissant',false],'10 / 514 = 1,95 % : le bord se montre');
});

/* 2. Heure de Paris : l'activité du lot (CEST en septembre, CET en novembre) et les départs, avec
 * le passage à l'heure d'hiver du 25/10/2026 (03:00 CEST → 02:00 CET, à 01:00 UTC). */
test('heure de Paris : activité du lot, heure d’été et d’hiver ; aucun « UTC » affiché',async()=>{
  const b=lot({start:100,end:120,endMode:undefined},{cut:103,n:0});
  b.batch.processed=[{cut:100,evidence:{startedAt:'2026-07-15T10:00:00Z'}},{cut:101,evidence:{startedAt:'2026-11-25T10:00:20Z'}}];
  b.batch.lotCommands={100:{cut:100,stage:'first-pass',action:'engine'},101:{cut:101,stage:'first-pass',action:'engine'}};
  const $=await panneau(b,[]);const a=$('lot-activite').innerHTML;
  assert.match(a,/<span class="h">12:00:00<\/span><span class="c">100<\/span>/,'15/07, CEST : UTC+2');
  assert.match(a,/<span class="h">11:00:20<\/span><span class="c">101<\/span>/,'25/11, CET : UTC+1');
});

test('heure de Paris : départs autour du passage à l’heure d’hiver (25/10/2026) et en été (15/07)',async()=>{
  const fiches=[{at:'2026-07-15T10:05:00Z',partie:20,valides:1,invalides:2,total:3},
    {at:'2026-10-25T00:30:00Z',partie:21,valides:1,invalides:2,total:3},{at:'2026-10-25T01:30:00Z',partie:21,valides:1,invalides:2,total:3},
    {at:'2026-10-25T23:15:00Z',partie:22,valides:1,invalides:2,total:3}];
  const $=await panneau(lot({part:21},{cut:5}),fiches),blocs=$('departs-liste').children,txt=e=>e.textContent+(e.children||[]).map(txt).join(' ');
  const tout=blocs.map(txt).join(' | ');
  assert.match(tout,/Partie 21.*en cours · 25\/10 02:30 · 2 départs/s,'01:30 UTC = 02:30 CET (après le passage)');
  assert.match(tout,/25\/10 02:30 1 2 3.*25\/10 02:30 1 2 3/s,'00:30 UTC = 02:30 CEST (avant), 01:30 UTC = 02:30 CET (après)');
  assert.match(tout,/Partie 22.*26\/10 00:15/s,'23:15 UTC le 25 = 00:15 le 26, heure d’hiver');
  assert.match(tout,/Partie 20.*15\/07 12:05/s,'été : UTC+2');
  assert.doesNotMatch(tout,/UTC/);
});
