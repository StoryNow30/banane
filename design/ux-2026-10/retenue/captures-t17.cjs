// 4.9.0.17 — captures du VRAI panneau (panel.html, panel.css, panel.js du dépôt) dans Chromium,
// avec un ESV simulé et des données fictives (d'après captures-t16.cjs) :
// - la tuile d'un lot sur TOUTE la partie (cut 1 → fin de partie) avec sa fiche de départ :
//   « 7,5 % » et « 39 / 514 invalides » (travail), en cours puis fini (100 %) ;
// - la tuile d'un lot à plage fixe : la position, « N cuts », comme avant ;
// - les départs (carte en cours, historique déplié) et l'activité du lot en heure de Paris.
// Aucune API Chrome réelle, aucun appel réseau, aucun identifiant de projet.
// node design/ux-2026-10/retenue/captures-t17.cjs <dossier-de-sortie>
const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('/opt/node22/lib/node_modules/playwright');}
const root=path.resolve(__dirname,'../../..'),out=path.resolve(process.argv[2]||path.join(__dirname,'captures-t17'));fs.mkdirSync(out,{recursive:true});

const simulation=()=>{
 const id=cut=>({part:25,cut,pageId:'page-demo',frameId:'f-demo'});
 /* Lot sur toute la partie 25 : parti du cut 1, jusqu'à la fin de partie ; 39 cuts traités (posés + différés). */
 const S={sessionId:'demo',current:{identity:id(118)},connection:{status:'connected'},
  batch:{id:'lot-demo',state:'RUNNING',step:'capture',scope:{part:25,start:1,end:999999,endMode:'partie',unresolvedPolicy:'defer',lotDecision:'apply',lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1'},
   processed:[],deferred:[],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],sequence:[],lotCommands:{},activeIdentity:id(118)}};
 const t0=Date.parse('2026-10-15T08:41:00Z');
 for(let k=0;k<38;k++){const c=1+k*3,at=new Date(t0+k*2100).toISOString();S.batch.sequence.push({sequenceIndex:k,cutId:'p|25|'+c,identity:id(c)});
  if(k%9===4)S.batch.deferred.push({identity:id(c),deferredAt:at,unresolvedRails:['left']});
  else S.batch.lotCommands[c]={cut:c,action:'engine',stage:'first-pass',ecartMm:3.2};
  S.batch.processed.push({cut:c,identity:id(c),evidence:{startedAt:at}});}
 S.batch.sequence.push({sequenceIndex:S.batch.sequence.length,cutId:'p|25|118',identity:id(118)});
 const fiches=[
  {at:'2026-10-14T12:01:00Z',partie:23,valides:7512,invalides:1748,total:9260},
  {at:'2026-10-14T12:48:00Z',partie:23,valides:8599,invalides:661,total:9260},
  {at:'2026-10-15T06:54:04Z',partie:24,valides:8761,invalides:514,total:9275},
  {at:'2026-10-15T08:35:45Z',partie:26,valides:8814,invalides:370,total:9184},
  {at:'2026-10-15T08:40:12Z',batchId:'lot-demo',partie:25,valides:8746,invalides:514,total:9260}];
 globalThis.__demo={S,id};
 const repondre=action=>action==='view'?JSON.parse(JSON.stringify(S)):action==='fiches-depart'?{fiches}:action==='list-tabs'?[{id:7,title:'ESV',windowId:1,index:1,active:true,pret:true,utilise:true}]
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
  // Lot sur toute la partie : 39e cut traité (l'onde au bord du vert), « 7,5 % », « 39 / 514 invalides ».
  await p.evaluate(()=>{const S=__demo.S,b=S.batch,c=b.activeIdentity.cut;b.processed.push({cut:c,identity:__demo.id(c),evidence:{startedAt:'2026-10-15T08:42:20Z'}});
   b.lotCommands[c]={cut:c,action:'engine',stage:'first-pass',ecartMm:2.1};b.activeIdentity=__demo.id(c+3);S.current.identity=__demo.id(c+3);});
  await p.waitForTimeout(1600);
  await p.locator('#lot-tuile').screenshot({path:path.join(out,'tuile-partie'+t)});
  // L'activité du lot, en heure de Paris (08:42 UTC = 10:42 à Paris le 15/10).
  await p.evaluate(()=>{document.getElementById('lot-details-toggle').click();});await p.waitForTimeout(800);
  await p.locator('#lot-activite-bloc').screenshot({path:path.join(out,'activite'+t)}).catch(e=>console.log('activité :',e.message));
  await p.evaluate(()=>{document.getElementById('lot-details-toggle').click();});
  // Fin du lot : 100 %.
  await p.evaluate(()=>{const S=__demo.S,b=S.batch;b.state='STOPPED';b.stoppedAtEnd={cut:9259,issue:'dernier-cut-valide',reason:'dernier-cut-valide',at:'2026-10-15T10:40:00Z',applied:true};});
  await p.waitForTimeout(2600);
  await p.locator('#lot-tuile').screenshot({path:path.join(out,'tuile-partie-fini'+t)});
  // Lot à plage fixe (2116 → 2240, cut 2190) : la position, « N cuts ».
  await p.evaluate(()=>{const S=__demo.S,id=c=>({...__demo.id(c),part:25});S.batch={...S.batch,id:'lot-plage',state:'RUNNING',stoppedAtEnd:undefined,
   scope:{...S.batch.scope,start:2116,end:2240,endMode:undefined},activeIdentity:id(2190),processed:S.batch.processed.slice(0,30)};S.current.identity=id(2190);});
  await p.waitForTimeout(2000);
  await p.locator('#lot-tuile').screenshot({path:path.join(out,'tuile-plage'+t)});
  // Les départs en heure de Paris : la partie en cours, l'historique dont une partie dépliée.
  await p.evaluate(()=>{for(const d of document.querySelectorAll('#departs-liste details'))d.open=false;const h=document.querySelector('#departs-liste .d-partie');if(h)h.open=true;});
  await p.waitForTimeout(300);
  await p.locator('#departs-liste').screenshot({path:path.join(out,'departs'+t)});
  console.log(theme,'ok',await p.evaluate(()=>[document.getElementById('lot-pct').textContent,document.getElementById('lot-traites').textContent,document.getElementById('lot-traites-u').textContent].join(' | ')));
  await ctx.close();
 }
 await b.close();
})();
