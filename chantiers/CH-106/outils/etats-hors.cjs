'use strict';
/* CH-106 : le VRAI panneau dans les états que les treize photos de CH-104 ne montrent pas. Données fabriquées, API Chrome simulée, rien n'est envoyé à ESV.
 * Usage : CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-106/outils/etats-hors.cjs DOSSIER_HORS_DEPOT [filtre] [largeur] [hauteur]
 * Écrit, par état : le texte du panneau, la teinte, le mot, le libellé de l'anneau, les étapes, les boutons du pied ; une image dans le dossier (jamais dans le dépôt). */
const path=require('node:path'),fs=require('node:fs');
const R=path.resolve(__dirname,'../../..');
const navigateur=require(R+'/tests/esv-maquette/navigateur.cjs'),{ouvrirPanneau}=require(R+'/tests/helpers/panneau-local.cjs');
const N=require(R+'/tools/ui5-navigateur.cjs');
const {E:E0,FICHES,lot,id}=require(R+'/chantiers/CH-104/outils/capturer.cjs');
const SORTIE=process.argv[2],FILTRE=process.argv[3]||'',W=Number(process.argv[4]||360),H=Number(process.argv[5]||480);
const fin=()=>lot('COMPLETED',4900,{activeIdentity:null});
const avecRel=(st,passe)=>{const x=st;x.batch.scope={...x.batch.scope,relecture:'corriger'};return {state:x,rel:{choix:'corriger',lot:{id:'lot-1'},repriseReglage:{actif:true,f5:'pause'},passe:{lotId:'lot-1',mode:'corriger',modeEffectif:'corriger',faits:12,total:85,corriges:3,cut:4801,reprise:true,pauseDemandee:false,pauseRaison:null,expire:null,...passe}}};};
const vue=(etat,o={})=>({id:'file-1',etat,n:5,plan:[13,14,15,16,17],rang:1,enCours:{part:14,rang:1,lot:true},changement:null,bilan:[],motifFin:null,alerte:null,reprises:0,...o});
const clos=p=>({current:{identity:id(0,p)},busy:false,manual:{status:'IDLE'},native:{status:'IDLE',visits:[],incomplete:[]},batch:null});
const B13={part:13,rang:0,issueLot:'fin',motifs:['fin-normale'],resume:{poses:87,differes:6},passe:null,relecture:{issue:'finie',corriges:3},alertes:[]};
const echo=st=>{const s=JSON.parse(JSON.stringify(N.SCENARIOS.echo.state));s.native.status=st;return s;};
const CL=require(R+'/src/correction-liste.js'),{journal}=require(R+'/tests/helpers/correction-journal.cjs');
const LC13=CL.construire(journal({partie:13}),{partie:13}),LC14=CL.construire(journal({partie:14}),{partie:14});
const CORR=(etat,extra={})=>({id:'C1',etat,creeA:'2026-10-31T10:05:00Z',listes:[{batchId:'lot-1',partie:13,entrees:LC13.entrees,comptes:LC13.comptes}],...extra});
const E={
 erreur:{state:lot('ERROR',4811)},
 demarrage:{state:{...lot('RUNNING',4789),busy:true}},
 'pause-demandee':{actions:['pause'],state:lot('RUNNING',4811,{cutStartedAt:new Date().toISOString()})},
 'cours-occupe':{state:{...lot('RUNNING',4811),busy:true}},
 incertain:{state:{...lot('RUNNING',4811),reconcileRequired:true,intent:{identity:id(4812)}}},
 main:{state:lot('MANUAL_TAKEOVER',4811)},
 'basse-confiance':{state:lot('PAUSED',4811,{pauseReason:'low-confidence'})},
 'nav-incertaine':{state:lot('PAUSED_DEFER_NAVIGATION_UNCERTAIN',4811)},
 arrete:{state:lot('STOPPED',4811,{activeIdentity:null})},
 'fin-ombre':{state:{...fin(),passeDifferes:{etat:'finie',mode:'ombre',lotId:'lot-1',posees:4,differes:6,ecrites:0}}},
 'fin-ecrite':{state:{...fin(),passeDifferes:{etat:'finie',mode:'ecriture',lotId:'lot-1',posees:5,differes:6,ecrites:5}}},
 'fin-passe-erreur':{state:{...fin(),passeDifferes:{etat:'erreur',mode:'ecriture',lotId:'lot-1',message:'ESV a refusé'}}},
 'rel-pause-demandee':avecRel(fin(),{etat:'en-cours',pauseDemandee:true}),
 'rel-en-pause':avecRel(fin(),{etat:'en-pause',pauseRaison:'esv'}),
 'rel-redemarrage':avecRel(fin(),{etat:'en-pause',pauseRaison:'redemarrage'}),
 'rel-interrompue':avecRel(fin(),{etat:'interrompue'}),
 'rel-finie':avecRel(fin(),{etat:'finie',faits:85,total:85,corriges:7}),
 'file-passe':{file:true,fiches:FICHES.slice(0,2),state:{...fin(),fileParties:vue('passe',{bilan:[B13]}),passeDifferes:{etat:'ecriture',mode:'ecriture',lotId:'lot-1',cut:4803,ecrites:1,demandees:3}}},
 'file-relecture':(x=>({file:true,fiches:FICHES.slice(0,2),...x,state:{...x.state,fileParties:vue('relecture',{bilan:[B13]})}}))(avecRel(fin(),{etat:'en-cours'})),
 'file-alerte-cours':{file:true,fiches:FICHES.slice(0,2),state:{...lot('RUNNING',4811),fileParties:vue('lot',{bilan:[B13],alerte:{texte:'ESV ne répond plus',detail:'partie 14'}})}},
 'file-arret-alerte':{file:true,fiches:FICHES.slice(0,2),state:{...clos(14),fileParties:vue('arret',{enCours:null,bilan:[B13],alerte:{texte:'Onglet ESV fermé',detail:'partie 14'},motifFin:{code:'onglet-ferme',texte:'onglet ESV fermé'},reprise:{rang:1,part:14,reste:4}})}},
 'file-reprise-rechargee':{file:true,fiches:FICHES.slice(0,2),state:{...lot('RUNNING',4811),fileParties:vue('lot',{bilan:[B13],reprises:1})}},
 'file-orbite-cours':{state:{...lot('RUNNING',4811,{cutStartedAt:new Date().toISOString()}),fileParties:vue('lot',{bilan:[B13]})}},
 'file-orbite-passage':{state:{...clos(14),fileParties:vue('changement',{enCours:null,changement:{vers:15,tentatives:1},bilan:[B13]})}},
 'sans-onglet':{state:{current:null,busy:false,manual:{status:'IDLE'},native:{status:'IDLE',visits:[],incomplete:[]},batch:null,connection:{status:'no-tab',observedAt:'t',message:null,tabId:null}},onglets:[]},
 'esv-muet':{state:{...lot('RUNNING',4811),connection:{status:'unavailable',observedAt:'t',message:'ESV ne répond pas',tabId:1}}},
 'echo-pause':{hash:'#native',state:echo('PAUSED')},
 'echo-a-terminer':{hash:'#native',state:echo('IDLE')},
 'echo-muet':{hash:'#native',state:echo('PAUSED_ADAPTER_UNRESPONSIVE')},
 'aurore-2-listes':{actions:['sg:onglet-correction'],state:{...fin(),current:{identity:id(15)},correction:{id:'C1',etat:'ouverte',creeA:'2026-10-31T10:05:00Z',courant:{part:13,cut:15},listes:[{batchId:'B1',partie:13,entrees:LC13.entrees,comptes:LC13.comptes},{batchId:'B2',partie:14,entrees:LC14.entrees,comptes:LC14.comptes}]},native:{id:'n1',status:'RUNNING',correction:{id:'C1'},visits:[]}}},
 /* CH-106, suite (demande de l'intégrateur) : une relecture EN PAUSE vue depuis Orbite, l'Aurore et la Constellation. */
 'rp-orbite':(x=>({...x,state:{...x.state,correction:CORR('proposee')}}))(avecRel(fin(),{etat:'en-pause',pauseRaison:'esv'})),
 'rp-aurore':(x=>({...x,actions:['sg:onglet-correction'],state:{...x.state,correction:CORR('proposee')}}))(avecRel(fin(),{etat:'en-pause',pauseRaison:'esv'})),
 'rp-aurore-ouverte':(x=>({...x,actions:['sg:onglet-correction'],state:{...x.state,correction:CORR('ouverte',{courant:{part:13,cut:15}})}}))(avecRel(fin(),{etat:'en-pause',pauseRaison:'esv'})),
 'rp-aurore-vide':(x=>({...x,actions:['sg:onglet-correction']}))(avecRel(fin(),{etat:'en-pause',pauseRaison:'esv'})),
 'rp-file-repos':(x=>({...x,file:true,fiches:FICHES.slice(0,2)}))(avecRel(fin(),{etat:'en-pause',pauseRaison:'esv'})),
 'rp-file-relecture':(x=>({...x,file:true,fiches:FICHES.slice(0,2),state:{...x.state,fileParties:vue('relecture',{bilan:[B13]})}}))(avecRel(fin(),{etat:'en-pause',pauseRaison:'esv'})),
 'rc-file-repos':(x=>({...x,file:true,fiches:FICHES.slice(0,2)}))(avecRel(fin(),{etat:'en-cours'})),
 'rc-aurore':(x=>({...x,actions:['sg:onglet-correction'],state:{...x.state,correction:CORR('proposee')}}))(avecRel(fin(),{etat:'en-cours'})),
 'rf-file-repos':(x=>({...x,file:true,fiches:FICHES.slice(0,2)}))(avecRel(fin(),{etat:'finie',faits:85,total:85})),
 'rf-aurore':(x=>({...x,actions:['sg:onglet-correction'],state:{...x.state,correction:CORR('proposee')}}))(avecRel(fin(),{etat:'finie',faits:85,total:85})),
};
for(const e of Object.values(E))if(!Object.hasOwn(e.state,'fileParties'))e.state={...e.state,fileParties:null};
(async()=>{
 if(!SORTIE){console.error('Dossier de sortie attendu.');process.exit(2);}fs.mkdirSync(SORTIE,{recursive:true});
 const {chromium}=require(navigateur.modulePlaywright());const nav=await chromium.launch({executablePath:navigateur.executable()});const out={};
 await Promise.all(Object.entries(E).filter(([n])=>!FILTRE||n.includes(FILTRE)).map(async([nom,e])=>{
  const ctx=await nav.newContext({viewport:{width:W,height:H}});const page=await ctx.newPage();const err=[];
  page.on('pageerror',x=>err.push('ERREUR '+x.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load/.test(m.text()))err.push('CONSOLE '+m.text());});
  const state={connection:{status:'ready',observedAt:'t',message:null,tabId:1},...e.state};
  await page.addInitScript(({state,rel,fiches,onglets})=>{
   const reponses={view:state,'list-tabs':onglets??[{id:1,title:'ESV',pret:true,utilise:true,index:0,windowId:1,active:true}],'choix-lot-etat':{clicHumain:'tel-quel',regleGrappeDifferes:false},'raison-choix-etat':{actif:false,touches:'chiffres'},
    'relecture-choix-etat':{mode:'corriger'},'relecture-etat':rel,'bandeau-etat':{on:false},'fiches-depart':{fiches}};
   window.__appels=[];window.__rep=reponses;const stockage={};
   window.fetch=async()=>({json:async()=>({totaux:{tous:{corriges:2731}},creeLe:'2026-10-20T08:00:00Z'})});
   window.chrome={runtime:{id:'essai',getURL:p=>new URL(p,location.href).href,connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async m=>{window.__appels.push(m.action||m.kind);return {result:m.action in reponses?reponses[m.action]:{}};}},
    storage:{local:{get:async()=>({...stockage}),set:async o=>{Object.assign(stockage,o);}}},windows:{getCurrent:async()=>({id:1,type:'normal',width:600,height:760}),update:async()=>({})}};
  },{state,rel:e.rel||{choix:'corriger',lot:null,passe:null},fiches:e.fiches||[],onglets:e.onglets});
  await ouvrirPanneau(page,e.hash||'#automatic');await page.waitForTimeout(1800);
  for(const a of e.actions||[]){await page.evaluate(a=>window.ArianeUi5.agir(a),a);await page.waitForTimeout(400);}
  if(e.file){await page.evaluate(()=>window.ArianeUi5.agir('sg:onglet-file'));await page.waitForTimeout(500);}
  if(process.env.PALETTE){await page.evaluate(()=>window.ArianeUi5.agir('sg:palette'));await page.waitForTimeout(400);}
  await page.waitForTimeout(600);
  await page.screenshot({path:path.join(SORTIE,`${nom}-${W}.png`)});
  out[nom]={err,...await page.evaluate(()=>{const f=document.querySelector('#ui5 .sg-fen');if(!f)return {rien:true};
   return {teinte:f.dataset.teinte,etat:f.dataset.etat,mot:f.querySelector('.sg-mot')?.textContent,anneau:f.querySelector('.sg-anneau')?.getAttribute('aria-label'),
    etapes:[...f.querySelectorAll('.sg-etapes li')].map(l=>l.dataset.etape+':'+l.textContent.trim()).join(' / '),
    temps:[...f.querySelectorAll('.sg-temps li')].map(l=>l.dataset.temps+':'+l.textContent.trim()).join(' / '),chaine:[...f.querySelectorAll('.sg-chaine li')].map(l=>l.dataset.partie+':'+l.dataset.etat).join(' '),
    pied:[...f.querySelectorAll('.sg-actions button')].map(b=>(b.disabled?'×':'')+b.textContent.trim()+'['+(b.dataset.act||'')+']').join(' | '),
    palette:(document.querySelector('#ui5 .sg-palette')?.innerText||'').replace(/\n+/g,' | '),texte:(f.innerText||'').replace(/\n+/g,' | ').slice(0,900)};})};
  await ctx.close();}));
 await nav.close();
 for(const [k,v] of Object.entries(out).sort())console.log('== '+k+'\n'+Object.entries(v).map(([a,b])=>'  '+a+': '+(Array.isArray(b)?b.join(' ; '):b)).join('\n'));
})().catch(e=>{console.error(e);process.exit(1);});
