#!/usr/bin/env node
'use strict';
/*
 * ch098-memoire.cjs — CH-098 : qui retient la mémoire de la page pendant un lot long ?
 *
 * Banc « extension réelle » (comme tools/banc-esv.cjs) : l'extension du dépôt chargée dans Chromium, l'hôte d'ESV ROUTÉ vers la maquette
 * (tests/esv-maquette, en mode EPT mémoire de Potree : `ept=1&eptHier=1&eptForme=commun&eptPas=7&eptMemoire=1`), un lot Orbite de N cuts
 * (puis la relecture, en ombre). Toutes les `--pas` coupes chargées par la page, le tas JS est relevé APRÈS ramasse-miettes forcé, par le
 * protocole de débogage de Chromium (`HeapProfiler.collectGarbage` puis `Runtime.getHeapUsage`), dans la page de la maquette et dans le
 * service worker de l'extension. `--sans-extension 1` : même maquette, même nombre de coupes, navigation par le bouton « valider et suivant »
 * de la maquette, sans Ariane (référence). `--instantanes 1` : un instantané du tas de la page au premier et au dernier relevé, résumé par
 * constructeur (nombre et octets propres), différence rendue.
 *
 *   CHROMIUM=/opt/pw-browsers/chromium node tools/ch098-memoire.cjs [--cuts 330] [--pas 50] [--sans-extension 0|1] [--relecture 0|1]
 *        [--instantanes 0|1] [--json SORTIE.json] [--maquette 'clé=valeur&…'] [--extension DOSSIER]
 *
 * Ce que le banc prouve : ce que retient la page de la MAQUETTE (sa propre mémoire plus celle d'Ariane). Ce qu'il ne prouve pas : la mémoire
 * du vrai ESV ni du vrai Potree (géométries réelles, textures, WebGL). Hors de tools/verify.cjs. Une seule page Chromium, machine au repos.
 */
const path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const N=require('../tests/esv-maquette/navigateur.cjs');
const racine=N.racine;
const MAQUETTE_EPT='ept=1&eptHier=1&eptForme=commun&eptPas=7&eptMemoire=1&eptDecode=40';
function args(argv){const o={cuts:330,pas:50,debut:100,latence:30,'sans-extension':0,relecture:1,instantanes:0,json:null,maquette:MAQUETTE_EPT,extension:racine,delai:3600000,port:9338,marge:60,limite:'300000'};
 for(let i=0;i<argv.length;i++){const a=argv[i];if(a.startsWith('--'))o[a.slice(2)]=argv[++i];}
 for(const k of ['marge','cuts','pas','debut','latence','sans-extension','relecture','instantanes','delai','port'])o[k]=Number(o[k]);
 o.sansExtension=o['sans-extension']===1;o.extension=path.resolve(o.extension);return o;}
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const Mo=o=>Math.round(o/1048576*10)/10;

/* ---------- protocole de débogage, client minimal (WebSocket de Node 22) ---------- */
const jsonHttp=(port,chemin)=>new Promise((res,rej)=>{http.get({host:'127.0.0.1',port,path:chemin},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d));}catch(e){rej(e);}});}).on('error',rej);});
async function cdp(url){const ws=new WebSocket(url);await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(Error('CDP : connexion refusée'));});
 let n=0;const attente=new Map(),ecoute=new Map();
 ws.onmessage=m=>{const x=JSON.parse(m.data);if(x.id&&attente.has(x.id)){const {res,rej}=attente.get(x.id);attente.delete(x.id);x.error?rej(Error(x.error.message)):res(x.result);}
  else if(x.method&&ecoute.has(x.method))for(const f of ecoute.get(x.method))f(x.params);};
 const envoyer=(method,params={})=>new Promise((res,rej)=>{const id=++n;attente.set(id,{res,rej});ws.send(JSON.stringify({id,method,params}));});
 const sur=(method,f)=>{if(!ecoute.has(method))ecoute.set(method,[]);ecoute.get(method).push(f);};
 return {envoyer,sur,fermer:()=>ws.close()};}
async function cible(port,filtre){for(let i=0;i<40;i++){const l=await jsonHttp(port,'/json/list');const t=l.find(filtre);if(t)return t;await dormir(250);}return null;}
/* Tas après deux ramasse-miettes forcés (le second ramasse ce que le premier a rendu ramassable : finaliseurs, WeakRef). */
async function tasApresGC(c){await c.envoyer('HeapProfiler.collectGarbage');await dormir(100);await c.envoyer('HeapProfiler.collectGarbage');const h=await c.envoyer('Runtime.getHeapUsage');return {utiliseMo:Mo(h.usedSize),totalMo:Mo(h.totalSize)};}
/* Instantané du tas résumé par constructeur : {nom: {n, octets}} (taille propre). */
async function resumeInstantane(c){let morceaux=[];const f=p=>morceaux.push(p.chunk);c.sur('HeapProfiler.addHeapSnapshotChunk',f);
 await c.envoyer('HeapProfiler.enable');await c.envoyer('HeapProfiler.collectGarbage');await c.envoyer('HeapProfiler.takeHeapSnapshot',{reportProgress:false});
 const s=JSON.parse(morceaux.join(''));morceaux=[];const m=s.snapshot.meta,F=m.node_fields.length,iT=m.node_fields.indexOf('type'),iN=m.node_fields.indexOf('name'),iS=m.node_fields.indexOf('self_size');
 const types=m.node_types[0],r={};for(let i=0;i<s.nodes.length;i+=F){const t=types[s.nodes[i+iT]],nom=t==='object'||t==='native'||t==='closure'?s.strings[s.nodes[i+iN]]:'('+t+')';
  const k=t==='closure'?'(closure) '+nom:nom;const e=r[k]||(r[k]={n:0,octets:0});e.n++;e.octets+=s.nodes[i+iS];}
 return r;}
function diffInstantanes(a,b,n=25){const cles=new Set([...Object.keys(a),...Object.keys(b)]);
 return [...cles].map(k=>({nom:k,dn:(b[k]?.n||0)-(a[k]?.n||0),dOctets:(b[k]?.octets||0)-(a[k]?.octets||0),n:b[k]?.n||0})).sort((x,y)=>y.dOctets-x.dOctets).slice(0,n);}

async function banc(options={}){
 const o={...args([]),...options},pw=N.playwright();if(!pw)throw Error('Playwright introuvable.');
 const manifeste=JSON.parse(fs.readFileSync(path.join(o.extension,'manifest.json'),'utf8'));
 const hote=new URL(manifeste.host_permissions[0].replace(/\*$/,'')),origine=hote.origin,prefixe=hote.pathname;
 const {demarrer}=require('../tests/esv-maquette/serveur.cjs');const serveur=await demarrer({});
 const ext=o.sansExtension?[]:[`--disable-extensions-except=${o.extension}`,`--load-extension=${o.extension}`];
 const ctx=await pw.chromium.launchPersistentContext('',{executablePath:N.executable(),headless:true,viewport:{width:1200,height:800},
  args:['--headless=new',`--remote-debugging-port=${o.port}`,'--enable-precise-memory-info',...ext]});
 const erreurs=[],releves=[],t0=Date.now();let cPage=null,cSw=null;
 try{
  await ctx.route(origine+'/**',async route=>{const u=new URL(route.request().url());let chemin=u.pathname;
   if(chemin.startsWith(prefixe)){const reste=chemin.slice(prefixe.length);chemin='/tests/esv-maquette/'+(reste===''||reste==='maquette'?'esv.html':reste);}
   try{const r=await route.fetch({url:serveur.url+chemin+u.search});await route.fulfill({response:r});}catch(e){erreurs.push('route '+chemin+' : '+e.message);await route.abort().catch(()=>{});}});
  let sw=null,id=null;
  if(!o.sansExtension){for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await dormir(250);sw=ctx.serviceWorkers()[0];if(!sw)throw Error('Service worker absent.');
   id=sw.url().split('/')[2];sw.on('console',m=>{if(m.type()==='error')erreurs.push('sw: '+m.text().slice(0,200));});}
  const esv=(ctx.pages()[0])||await ctx.newPage();esv.on('pageerror',e=>erreurs.push('esv: '+e.message.slice(0,200)));
  /* La relecture relit aussi des cuts autour du lot : la partie de la maquette déborde de `marge` cuts de chaque côté. */
  const cutsMaquette=o.cuts+2*o.marge+2,premier=o.debut-o.marge;
  await esv.goto(`${origine}${prefixe}maquette?cuts=${cutsMaquette}&debut=${premier}&cut=${o.debut}&latence=${o.latence}&${o.maquette}`);
  await esv.evaluate(()=>window.__maquette.pret);await esv.waitForFunction(()=>window.__maquette.etat().railsPrets);
  /* Limite de points de la LRU de Potree : ESV en a une (points gardés stables, 3,85 à 3,96 millions, lot du 10/11) ; la maquette n'en a pas par défaut.
   * `auto` : 3 fois les points que la LRU tient après la première coupe ; un nombre : cette limite ; `aucune` : pas de limite (rien n'est libéré). */
  if(o.limite!=='aucune'){if(o.limite==='auto')await esv.waitForFunction(()=>window.Potree.numNodesLoading===0&&(window.__memoireEpt?.().lruPoints||0)>0,null,{timeout:20000}).catch(()=>{});await dormir(500);const l=o.limite==='auto'?3*(await esv.evaluate(()=>window.__memoireEpt?.().lruPoints||0)):Number(o.limite);
   if(l>0)await esv.evaluate(l=>{window.Potree.pointLoadLimit=l;},l);o.limiteAppliquee=l;}
  const tPage=await cible(o.port,t=>t.type==='page'&&t.url.includes('maquette'));if(!tPage)throw Error('cible CDP de la page introuvable');cPage=await cdp(tPage.webSocketDebuggerUrl);
  if(!o.sansExtension){const tSw=await cible(o.port,t=>t.type==='service_worker'&&t.url.includes(id));if(tSw)cSw=await cdp(tSw.webSocketDebuggerUrl);else erreurs.push('cible CDP du service worker introuvable');}
  const etatMaquette=()=>esv.evaluate(()=>{const e=window.__maquette.etat();return {cut:e.cut,chargements:e.chargements,journal:window.__maquette.journal.length};});
  /* Tailles lisibles côté page (Ariane et maquette), sans rien modifier. */
  const tailles=()=>esv.evaluate(()=>{const r={};try{const pc=window.viewer?.scene?.pointclouds?.[0];r.visibles=pc?.visibleNodes?.length??null;
   let n=0,g=0,oct=0;const vu=new Set(),pile=pc?.pcoGeometry?.root?[pc.pcoGeometry.root]:[];while(pile.length){const x=pile.pop();if(!x||vu.has(x))continue;vu.add(x);n++;
    if(x.geometry){g++;for(const a of Object.values(x.geometry.attributes||{}))oct+=a?.array?.byteLength||0;}
    const ch=x.children;if(Array.isArray(ch))pile.push(...ch.filter(Boolean));else if(ch&&typeof ch==='object')pile.push(...Object.values(ch).filter(Boolean));}
   r.noeuds=n;r.noeudsGeom=g;r.geomMo=Math.round(oct/1048576*10)/10;}catch{}
   try{const m=window.__memoireEpt?.();if(m){r.lruPoints=m.lruPoints;r.lruNoeuds=m.lruNoeuds;}}catch{}r.memMo=Math.round((performance.memory?.usedJSHeapSize||0)/1048576*10)/10;r.journalMaquette=window.__maquette.journal.length;r.messages=Array.isArray(window.__messages)?window.__messages.length:null;return r;});
  const relever=async(etiquette,cuts)=>{const page=await tasApresGC(cPage),swm=cSw?await tasApresGC(cSw):null;const e=await etatMaquette();
   const r={etiquette,cuts,chargements:e.chargements,s:Math.round((Date.now()-t0)/1000),pageMo:page.utiliseMo,swMo:swm?.utiliseMo??null,...await tailles()};releves.push(r);
   console.error(`# ${etiquette} cuts=${cuts} chargements=${e.chargements} page=${r.pageMo} Mo sw=${r.swMo} Mo nœuds=${r.noeuds}/${r.noeudsGeom} géom=${r.geomMo} Mo lru=${r.lruNoeuds} memMo=${r.memMo} journal=${r.journalMaquette} (${r.s} s)`);return r;};
  let instA=null,instB=null;
  await dormir(1500);await relever('depart',0);if(o.instantanes)instA=await resumeInstantane(cPage);
  if(o.sansExtension){
   /* Référence : la même maquette, navigation par « valider et suivant » (bouton d'ESV imité), une coupe affichée jusqu'à ses nœuds montés. */
   let fait=0;const c0=(await etatMaquette()).chargements;
   while(fait<o.cuts){const avant=(await etatMaquette()).chargements;await esv.evaluate(()=>document.getElementById('O2N3DCutValidate3DRail').click());
    await esv.waitForFunction(a=>window.__maquette.etat().chargements>a&&window.__maquette.etat().railsPrets,avant,{timeout:30000});
    await esv.waitForFunction(()=>window.Potree.numNodesLoading===0,null,{timeout:30000}).catch(()=>{});await dormir(150);
    fait=(await etatMaquette()).chargements-c0;if(fait%o.pas===0)await relever('navigation',fait);}
  }else{
   const panneau=await ctx.newPage();panneau.on('pageerror',e=>erreurs.push('panneau: '+e.message));
   await panneau.goto(`chrome-extension://${id}/panel.html#automatic`);await dormir(600);
   const api=async(action,a={})=>{const r=await panneau.evaluate(([action,a])=>chrome.runtime.sendMessage({kind:'panel',action,args:a}),[action,a]);if(r?.error)throw Error(`${action} : ${r.error}`);return r?.result;};
   const onglets=await api('list-tabs');const onglet=onglets.find(t=>/MAQUETTE|Maquette/i.test(t.title))||onglets[0];
   if(o.relecture)await api('relecture-choix',{mode:'ombre'});
   await api('connect',{tabId:onglet.id});await api('settings',{mode:'automatic-test'});
   const part=(await esv.evaluate(()=>window.__maquette.etat())).part;
   const lot={part,start:o.debut,end:o.debut+o.cuts-1,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',unresolvedPolicy:'defer',lotDecision:'apply',geometryEngine:'geometry-candidate-v1'};
   const c0=(await etatMaquette()).chargements;let prochain=o.pas,vue=null;const debutLot=Date.now();await api('start',lot);
   for(;;){await dormir(500);vue=await api('view');const ch=(await etatMaquette()).chargements-c0;
    if(ch>=prochain){await relever('lot',ch);prochain+=o.pas;}
    if(vue?.batch?.state!=='RUNNING')break;if(Date.now()-debutLot>o.delai){erreurs.push('délai du lot dépassé');break;}}
   await dormir(2000);await relever('fin-lot',(await etatMaquette()).chargements-c0);console.error('# lot fini : '+JSON.stringify({etat:vue?.batch?.state,notice:vue?.notice,poses:vue?.batch?.lotPosedCount}));
   if(o.relecture){let etat=await api('relecture-etat');
    if(etat.passe?.etat==='non-lancee'&&/attend ta validation/.test(etat.passe.message||'')){await esv.evaluate(()=>document.getElementById('O2N3DCutValidate3DRail').click());await dormir(1500);await api('relecture-lancer');}
    const debutPasse=Date.now(),cP=(await etatMaquette()).chargements;let prochainP=o.pas;
    for(;;){await dormir(500);etat=await api('relecture-etat');const ch=(await etatMaquette()).chargements-cP;
     if(ch>=prochainP){await relever('relecture',ch);prochainP+=o.pas;}
     if(Date.now()-debutPasse>(o.delaiPasse||1800000)){erreurs.push('passe trop longue');break;}
     if(etat.passe&&!['preparation','en-cours'].includes(etat.passe.etat))break;if(Date.now()-debutPasse>o.delai){erreurs.push('délai de la passe dépassé');break;}}
    await dormir(2000);await relever('fin-relecture',(await etatMaquette()).chargements-cP);
    releves.at(-1).passe={etat:etat.passe?.etat??null,message:etat.passe?.message??null,faits:etat.passe?.faits??null,total:etat.passe?.total??null};}
   releves.find(r=>r.etiquette==='fin-lot').lot={etat:vue?.batch?.state??null,notice:vue?.notice??null,poses:vue?.batch?.lotPosedCount??null,differes:(vue?.batch?.deferred||[]).length};
  }
  await dormir(3000);await relever('repos',null);
  if(o.instantanes){instB=await resumeInstantane(cPage);}
  const res={version:manifeste.version,avecExtension:!o.sansExtension,cuts:o.cuts,maquette:o.maquette,limite:o.limiteAppliquee??null,releves,erreurs:erreurs.slice(0,20),nErreurs:erreurs.length,
   instantanes:instA&&instB?diffInstantanes(instA,instB):null,dureeS:Math.round((Date.now()-t0)/1000)};
  if(o.json)fs.writeFileSync(o.json,JSON.stringify(res,null,1));
  return res;
 }finally{cPage?.fermer();cSw?.fermer();await ctx.close().catch(()=>{});await serveur.fermer();}
}
module.exports={banc,args,resumeInstantane,diffInstantanes,tasApresGC,cdp};
if(require.main===module)banc(args(process.argv.slice(2))).then(r=>{console.log(JSON.stringify({...r,releves:undefined},null,1));},e=>{console.error(e.stack||e.message);process.exitCode=1;});
