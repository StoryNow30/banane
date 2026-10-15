// 4.9.5.1 (« 4.9.5 test 1 ») — captures du VRAI panneau (panel.html, panel.css, panel.js du dépôt) dans Chromium,
// avec un ESV simulé et des données fictives (d'après captures-t17.cjs) :
// - l'en-tête du panneau : « ARIANE 4.9.5 test 1 » ;
// - un lot mis en pause parce qu'ESV a refusé d'enregistrer une validation (D3) : l'avis tel que l'opérateur le lit.
// Aucune API Chrome réelle, aucun appel réseau, aucun identifiant de projet.
// node design/ux-2026-10/retenue/captures-t951.cjs <dossier-de-sortie>
const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('/opt/node22/lib/node_modules/playwright');}
const root=path.resolve(__dirname,'../../..'),out=path.resolve(process.argv[2]||path.join(__dirname,'captures-t951'));fs.mkdirSync(out,{recursive:true});

const simulation=()=>{
 const id=cut=>({part:27,cut,pageId:'page-demo',frameId:'f-demo'});
 const S={sessionId:'demo',current:{identity:id(5441)},connection:{status:'connected'},
  notice:'ESV a refusé d’enregistrer la validation du cut 5440 (erreur serveur). Vérifie ce cut dans ESV, puis Reprendre.',
  batch:{id:'lot-demo',state:'PAUSED',step:'analyze',scope:{part:27,start:5400,end:5600,unresolvedPolicy:'defer',lotDecision:'apply',lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1'},
   processed:[],deferred:[],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],sequence:[],lotCommands:{},activeIdentity:id(5441)}};
 const t0=Date.parse('2026-10-15T13:10:00Z');
 for(let k=0;k<14;k++){const c=5400+k*3,at=new Date(t0+k*1900).toISOString();S.batch.sequence.push({sequenceIndex:k,cutId:'p|27|'+c,identity:id(c)});
  S.batch.lotCommands[c]={cut:c,action:'engine',stage:'first-pass',ecartMm:2.4};S.batch.processed.push({cut:c,identity:id(c),evidence:{startedAt:at}});}
 globalThis.__demo={S};
 const repondre=action=>action==='view'?JSON.parse(JSON.stringify(S)):action==='fiches-depart'?{fiches:[]}:action==='list-tabs'?[{id:7,title:'ESV',windowId:1,index:1,active:true,pret:true,utilise:true}]
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
  await p.screenshot({path:path.join(out,`panneau-ecriture-refusee-${theme}.png`)});
  console.log(theme,'ok',await p.evaluate(()=>[document.querySelector('.brand')?.textContent,document.getElementById('notice').textContent].join(' | ')));
  await ctx.close();
 }
 await b.close();
})();
