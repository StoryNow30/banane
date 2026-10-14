// Le VRAI panneau (panel.html, panel.css, panel.js du dépôt) dans Chromium,
// avec un ESV simulé et des données fictives : captures claire et sombre, et
// une vidéo du mouvement réel (entrée, cut suivant, pause, reprise).
// Aucune API Chrome réelle, aucun appel réseau, aucun identifiant de projet.
// node design/ux-2026-10/retenue/panneau-vivant.cjs [dossier-temporaire]
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
let pw;try{pw=require('playwright');}catch{pw=require('/opt/node22/lib/node_modules/playwright');}
const root=path.resolve(__dirname,'../../..'),dir=__dirname,tmp=process.argv[2]||fs.mkdtempSync('/tmp/panneau-');

/* L'ESV simulé : un lot Orbite en cours, cut 8455, partie 34. Le panneau interroge
 * « view » chaque seconde ; la démonstration fait évoluer cet état dans le temps. */
const simulation=()=>{
 const T0=Date.parse('2026-10-14T14:20:00Z'),iso=s=>new Date(T0+s*1000).toISOString();
 const voie=new Set([8415,8422,8423,8429,8433,8441,8446,8447,8453]),diff=new Set([8420,8438,8451]);
 const ecart=c=>+(2+((c*37)%97)/97*(voie.has(c)?10:6)).toFixed(1);
 const id=cut=>({part:34,cut,pageId:'page-demo',frameId:'f-demo'});
 const S={sessionId:'demo',current:{identity:id(8455)},connection:{status:'connected'},
  batch:{id:'lot-demo',state:'RUNNING',step:'capture',scope:{part:34,start:8410,end:8640,unresolvedPolicy:'defer',lotDecision:'apply',lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1'},
   processed:[],deferred:[],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],sequence:[],lotCommands:{},activeIdentity:id(8455)},
  lastActionEvidence:{commandSent:true,navigationObserved:true,afterObserved:false,serverConfirmed:false,operatorDecision:'validate',beforeNavigationIdentity:id(8454),identity:id(8454)}};
 let k=0;for(let c=8410;c<=8455;c++){S.batch.sequence.push({sequenceIndex:k++,cutId:'p|34|'+c,identity:id(c)});if(c===8455)break;
  if(diff.has(c))S.batch.deferred.push({identity:id(c),deferredAt:iso(c-8460),unresolvedRails:['left','right']});
  else{S.batch.processed.push({cut:c,identity:id(c),evidence:{startedAt:iso(c-8460)}});S.batch.lotCommands[c]={cut:c,action:voie.has(c)?'lot':'engine',stage:voie.has(c)?'window':'first-pass',ecartMm:ecart(c)};}}
 const fiches=[{at:'2026-10-12T16:04:40Z',partie:33,valides:2015,invalides:12,total:2310},{at:'2026-10-13T12:58:02Z',partie:34,valides:1284,invalides:37,ignores:5,total:2140}];
 const avancer=()=>{const b=S.batch,c=b.activeIdentity.cut;b.processed.push({cut:c,identity:id(c),evidence:{startedAt:iso(5)}});b.lotCommands[c]={cut:c,action:'engine',stage:'first-pass',ecartMm:3.1};
  b.sequence.push({sequenceIndex:b.sequence.length,cutId:'p|34|'+(c+1),identity:id(c+1)});b.activeIdentity=id(c+1);S.current.identity=id(c+1);b.step='capture';
  S.lastActionEvidence={...S.lastActionEvidence,beforeNavigationIdentity:id(c),identity:id(c),navigationObserved:true};};
 globalThis.__demo={S,avancer};
 const repondre=(action,args)=>action==='view'?JSON.parse(JSON.stringify(S)):action==='fiches-depart'?{fiches}:action==='list-tabs'?[{id:7,title:'ESV (simulé)'}]
  :action==='bornes-partie'?{last:null,source:null}:action==='pause'?(S.batch.state='PAUSED',{}):action==='resume'?(S.batch.state='RUNNING',{}):{};
 globalThis.chrome={runtime:{id:'demo',connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
  sendMessage:async m=>({result:repondre(m.action,m.args)})},storage:{local:{get:async()=>({}),set:async()=>{}}}};
};

(async()=>{
 const b=await pw.chromium.launch();
 const ouvrir=async(ctx,theme)=>{const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
  await p.addInitScript(simulation);await p.addInitScript(t=>{try{localStorage.setItem('banane-theme',t);}catch{}},theme);
  await p.goto('file://'+path.join(root,'panel.html')+'#automatic');
  await p.evaluate(t=>{document.documentElement.dataset.theme=t;},theme==='sombre'?'dark':'light');
  await p.evaluate(()=>document.fonts.ready);return p;};
 // Captures fixes, page entière.
 for(const theme of ['sombre','clair']){
  const ctx=await b.newContext({viewport:{width:480,height:880},deviceScaleFactor:2});const p=await ouvrir(ctx,theme);
  await p.waitForTimeout(3200);await p.evaluate(()=>{__demo.S.batch.step='apply';});await p.waitForTimeout(1500);
  await p.screenshot({path:path.join(dir,`vivant-${theme}.png`),fullPage:true});console.log(`vivant-${theme}.png`);await ctx.close();
 }
 // Le film : la fenêtre réelle, en temps réel, capturée image par image par le
 // protocole de Chromium (Page.startScreencast), aux pixels de l'écran (×2).
 if(!process.env.SANS_FILM)for(const theme of (process.env.FILM_CLAIR?['sombre','clair']:['sombre'])){
  const vdir=path.join(tmp,'film-'+theme);fs.rmSync(vdir,{recursive:true,force:true});fs.mkdirSync(vdir,{recursive:true});
  const ctx=await b.newContext({viewport:{width:480,height:880},deviceScaleFactor:2});
  const p=await ouvrir(ctx,theme),pause=ms=>p.waitForTimeout(ms);
  const glisser=async(de,a,ms)=>{const n=Math.round(ms/16);for(let i=1;i<=n;i++){const t=i/n,e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;await p.evaluate(y=>window.scrollTo(0,y),de+(a-de)*e);await p.waitForTimeout(16);}};
  const cdp=await ctx.newCDPSession(p),images=[];
  cdp.on('Page.screencastFrame',f=>{images.push({t:f.metadata.timestamp,data:f.data});cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
  await p.reload();await p.evaluate(t=>{document.documentElement.dataset.theme=t;},theme==='sombre'?'dark':'light');
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:960,maxHeight:1760,everyNthFrame:1});
  await pause(2800);
  await p.evaluate(()=>{__demo.S.batch.step='apply';});await pause(1600);
  await p.evaluate(()=>{__demo.S.batch.step='validate';});await pause(1600);
  await p.evaluate(()=>__demo.avancer());await pause(3000);
  await glisser(0,1180,1400);await pause(3000);await glisser(1180,0,1200);await pause(1500);
  await p.click('#pause');await pause(3000);
  await p.click('#resume');await pause(2800);
  await cdp.send('Page.stopScreencast');await ctx.close();
  // Une image toutes les 1/30 s : la dernière image reçue avant chaque instant.
  const t0=images[0].t,fin=images.at(-1).t,fps=30;let j=0,n=0;
  for(let t=t0;t<=fin;t+=1/fps){while(j+1<images.length&&images[j+1].t<=t)j++;fs.writeFileSync(path.join(vdir,`f${String(n++).padStart(5,'0')}.jpg`),Buffer.from(images[j].data,'base64'));}
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(vdir,'f%05d.jpg'),'-vf','scale=960:1760:flags=lanczos','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','slow','-movflags','+faststart',path.join(dir,`vivant-motion-${theme}.mp4`)]);
  console.log(`vivant-motion-${theme}.mp4 (${images.length} images reçues, ${n} images)`);
 }
 await b.close();
})();
