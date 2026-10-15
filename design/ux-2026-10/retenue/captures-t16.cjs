// 4.9.0.16 — captures du VRAI panneau (panel.html, panel.css, panel.js du dépôt) dans Chromium,
// avec un ESV simulé et des données fictives : la tuile du lot (en cours, pause, fini), la carte
// des départs avec l'historique déplié, le sélecteur « Onglet ESV » à deux onglets de même titre.
// Aucune API Chrome réelle, aucun appel réseau, aucun identifiant de projet.
// node design/ux-2026-10/retenue/captures-t16.cjs <dossier-de-sortie>
// (la liste déroulante native ne se capture pas ouverte : le sélecteur est montré en liste
// visible, `size`, avec les mêmes styles d'options).
const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('/opt/node22/lib/node_modules/playwright');}
const root=path.resolve(__dirname,'../../..'),out=path.resolve(process.argv[2]||path.join(__dirname,'captures-t16'));fs.mkdirSync(out,{recursive:true});

const simulation=()=>{
 const id=cut=>({part:24,cut,pageId:'page-demo',frameId:'f-demo'});
 const S={sessionId:'demo',current:{identity:id(2190)},connection:{status:'connected'},
  batch:{id:'lot-demo',state:'RUNNING',step:'capture',scope:{part:24,start:2116,end:2240,unresolvedPolicy:'defer',lotDecision:'apply',lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1'},
   processed:[],deferred:[],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],sequence:[],lotCommands:{},activeIdentity:id(2190)}};
 for(let c=2116,k=0;c<2190;c++,k++){S.batch.sequence.push({sequenceIndex:k,cutId:'p|24|'+c,identity:id(c)});
  if(c%13===0)S.batch.deferred.push({identity:id(c),deferredAt:'2026-10-15T07:20:00Z',unresolvedRails:['left']});
  else{S.batch.processed.push({cut:c,identity:id(c),evidence:{startedAt:'2026-10-15T07:20:00Z'}});S.batch.lotCommands[c]={cut:c,action:'engine',stage:'first-pass',ecartMm:3.2};}}
 S.batch.sequence.push({sequenceIndex:S.batch.sequence.length,cutId:'p|24|2190',identity:id(2190)});
 const fiches=[
  {at:'2026-10-12T16:04:40Z',partie:21,valides:7480,invalides:233,total:7713},
  {at:'2026-10-13T09:10:00Z',partie:22,valides:6120,invalides:310,ignores:4,total:6430},
  {at:'2026-10-13T12:58:02Z',partie:22,valides:6377,invalides:53,ignores:4,total:6430},
  {at:'2026-10-14T12:01:00Z',partie:23,valides:7512,invalides:1748,total:9260},
  {at:'2026-10-14T12:48:00Z',partie:23,valides:8599,invalides:661,total:9260},
  {at:'2026-10-15T06:40:00Z',partie:24,valides:8890,invalides:385,total:9275},
  {at:'2026-10-15T07:02:00Z',partie:24,valides:9010,invalides:265,total:9275},
  {at:'2026-10-15T07:18:00Z',partie:24,valides:9102,invalides:173,total:9275},
  {at:'2026-10-15T07:35:00Z',partie:24,valides:9169,invalides:106,total:9275}];
 const titre='Project 000000_000000_X_000 view';
 const tabs=[{id:7,title:titre,windowId:1,index:1,active:true,pret:true,utilise:true},{id:8,title:titre,windowId:1,index:3,active:false,pret:true},{id:9,title:'ESV — autre partie',windowId:2,index:0,active:true,pret:false}];
 globalThis.__demo={S,id};
 const repondre=action=>action==='view'?JSON.parse(JSON.stringify(S)):action==='fiches-depart'?{fiches}:action==='list-tabs'?tabs
  :action==='bornes-partie'?{last:null,source:null}:{};
 globalThis.chrome={runtime:{id:'demo',connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
  sendMessage:async m=>({result:repondre(m.action)})},storage:{local:{get:async()=>({}),set:async()=>{}}}};
};

(async()=>{
 const b=await pw.chromium.launch();
 for(const theme of ['sombre','clair']){
  const ctx=await b.newContext({viewport:{width:480,height:900},deviceScaleFactor:2});const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
  await p.addInitScript(simulation);
  await p.goto('file://'+path.join(root,'panel.html')+'#automatic');
  await p.evaluate(t=>{document.documentElement.dataset.theme=t;},theme==='sombre'?'dark':'light');
  await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(3000);
  const t=`-${theme}.png`;
  // La tuile du lot, en cours, juste après un cut terminé (l'onde au bord du vert).
  await p.evaluate(()=>{const S=__demo.S,b=S.batch,c=b.activeIdentity.cut;b.processed.push({cut:c,identity:__demo.id(c)});b.activeIdentity=__demo.id(c+8);S.current.identity=__demo.id(c+8);});
  await p.waitForTimeout(1500);
  await p.locator('#lot-tuile').screenshot({path:path.join(out,'tuile-en-cours'+t)});
  await p.evaluate(()=>{__demo.S.batch.state='PAUSED';});await p.waitForTimeout(1600);
  await p.locator('#lot-tuile').screenshot({path:path.join(out,'tuile-pause'+t)});
  await p.evaluate(()=>{const S=__demo.S,b=S.batch;b.state='STOPPED';b.activeIdentity=__demo.id(2240);S.current.identity=__demo.id(2240);b.stoppedAtEnd={cut:2240,at:'2026-10-15T07:40:00Z',applied:true};});
  await p.waitForTimeout(2600);
  await p.locator('#lot-tuile').screenshot({path:path.join(out,'tuile-fini'+t)});
  // Les départs : la partie en cours, son détail déplié, l'historique dont une partie dépliée.
  await p.evaluate(()=>{for(const d of document.querySelectorAll('#departs-liste details'))d.open=false;
   document.querySelector('#departs-liste .d-detail').open=true;document.querySelector('#departs-liste .d-partie').open=true;});
  await p.waitForTimeout(300);
  await p.locator('#departs-liste').screenshot({path:path.join(out,'departs'+t)});
  // Le sélecteur : liste visible (size) pour montrer les options avec leurs styles.
  await p.evaluate(()=>{const c=document.getElementById('connection');c.hidden=false;c.open=true;const t=document.getElementById('tabs');t.size=4;t.style.height='auto';t.style.padding='6px 4px';});
  await p.waitForTimeout(300);
  await p.locator('#connection').screenshot({path:path.join(out,'selecteur'+t)});
  console.log(theme,'ok');await ctx.close();
 }
 await b.close();
})();
