#!/usr/bin/env node
'use strict';
/* CH-064, étape 1 bis : banc de l'option B (extension mince + programme Rust natif par chrome.runtime.connectNative)
 * contre l'option A (cœur WASM dans le service worker) et le JS, dans un vrai Chromium, sur les nuages réels.
 *   node --max-old-space-size=6000 tools/ch064-banc-b.cjs [--nuages N] [--json SORTIE] [--sans-tenue]
 * Tout est fabriqué dans un dossier temporaire (extension d'essai à clé fixe, profil, manifeste de l'hôte) : rien n'est
 * installé ailleurs, rien n'entre dans le paquet. Mesures :
 *   1. latence d'un aller-retour (message minimal) ; débit d'une capture de 500 000 points (accusé, écho) ;
 *   2. limites de taille d'un message dans les deux sens ;
 *   3. calcul de la pose (V4.6 proposeBoth) par nuage réel : JS, A (façade WASM), B (aller-retour natif), cœur seul
 *      (WASM sur trame déjà encodée, natif mesuré par l'hôte) ; PARITÉ stricte de A et de B contre le JS ;
 *   4. mémoire : hôte (RSS, haute eau, après malloc_trim), mémoire linéaire WASM, processus de Chromium ;
 *   5. tenue : hôte tué, service worker arrêté (CDP), service worker inactif avec le port ouvert, redémarrage de Chrome. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync,spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const {construire}=require('./ch064-construire.cjs'),{nuages}=require('./ch064-nuages.cjs');
const RACINE=path.resolve(__dirname,'..'),RS=path.join(RACINE,'ariane-rs');
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
/* Mémoire de Chromium : somme des RSS du processus navigateur de CE profil et de tous ses descendants (/proc). */
function rssChromium(profil){const pp=new Map(),rss=new Map();let racines=[];
 for(const p of fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x))){try{const st=fs.readFileSync('/proc/'+p+'/status','utf8');
  pp.set(p,(st.match(/PPid:\s+(\d+)/)||[])[1]);rss.set(p,Number((st.match(/VmRSS:\s+(\d+)/)||[0,0])[1]));
  const c=fs.readFileSync('/proc/'+p+'/cmdline','utf8');if(c.includes('--user-data-dir='+profil)&&!c.includes('--type='))racines.push(p);}catch{}}
 const garde=new Set(racines);let change=true;while(change){change=false;for(const [p,q] of pp)if(!garde.has(p)&&garde.has(q)){garde.add(p);change=true;}}
 let ko=0;for(const p of garde)ko+=rss.get(p)||0;return {rssKo:ko,processus:garde.size};}
function vivant(pid){try{process.kill(pid,0);return true;}catch{return false;}}
function preparer(dir,N){
 const w=construire({silencieux:true});const r=spawnSync('cargo',['build','--release','-q','-p','ariane-hote'],{cwd:RS,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);
 const hote=path.join(RS,'target','release','ariane-hote');
 const ext=path.join(dir,'ext'),profil=path.join(dir,'profil');fs.mkdirSync(path.join(ext,'lib'),{recursive:true});fs.mkdirSync(path.join(profil,'NativeMessagingHosts'),{recursive:true});
 execFileSync('openssl',['genrsa','-out',path.join(dir,'cle.pem'),'2048'],{stdio:'ignore'});
 const der=execFileSync('openssl',['rsa','-in',path.join(dir,'cle.pem'),'-pubout','-outform','DER'],{stdio:['ignore','pipe','ignore']});
 const id=crypto.createHash('sha256').update(der).digest('hex').slice(0,32).split('').map(h=>String.fromCharCode(97+parseInt(h,16))).join('');
 const scripts=['vendor/capture-core.js','src/geometry.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-geometrie.js'];
 for(const s of scripts)fs.copyFileSync(path.join(RACINE,s),path.join(ext,'lib',path.basename(s)));
 fs.writeFileSync(path.join(ext,'lib','comparer.js'),'(function(){const module={};'+fs.readFileSync(path.join(__dirname,'ch064-comparer.cjs'),'utf8').replace("'use strict';",'')+';self.Ch064Comparer=module.exports;})();');
 fs.copyFileSync(w+'.js',path.join(ext,'lib','coeur.wasm.js'));
 fs.writeFileSync(path.join(ext,'manifest.json'),JSON.stringify({manifest_version:3,name:'CH-064 banc B',version:'1',key:der.toString('base64'),permissions:['nativeMessaging'],
  background:{service_worker:'sw.js'},content_scripts:[{matches:['https://essai.exemple/*'],js:['cs.js'],run_at:'document_start'}],content_security_policy:{extension_pages:"script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"}}));
 fs.writeFileSync(path.join(ext,'reveil.html'),'<!doctype html><script src="reveil.js"></script>');
 fs.writeFileSync(path.join(ext,'reveil.js'),"chrome.runtime.sendMessage('reveil');");
 fs.writeFileSync(path.join(ext,'sw.js'),SW);fs.writeFileSync(path.join(ext,'cs.js'),CS);
 const liste=[];for(const c of nuages(N))liste.push(c);fs.writeFileSync(path.join(ext,'nuages.json'),JSON.stringify(liste));
 fs.writeFileSync(path.join(profil,'NativeMessagingHosts','fr.ariane.coeur.json'),JSON.stringify({name:'fr.ariane.coeur',description:'CH-064 banc B',path:hote,type:'stdio',allowed_origins:['chrome-extension://'+id+'/']}));
 return {ext,profil,id,nuages:liste.length,octetsWasm:fs.statSync(w).size,octetsHote:fs.statSync(hote).size};
}
/* Script de contenu (monde isolé) : reçoit les tampons de la page (structured clone), les passe au service worker par
 * chrome.runtime (JSON : base64 obligatoire), qui les passe à l'hôte. Mesure chaque saut. */
const CS=String.raw`
addEventListener('message',async ev=>{const d=ev.data;if(!d||d.k!=='ch064')return;const tRecu=performance.now();
 const o=new Uint8Array(d.buf);const t0=performance.now();const b64=o.toBase64();const tB64=performance.now()-t0;
 const r=await chrome.runtime.sendMessage({k:'lidar',t:b64});const tTotal=performance.now()-t0;
 // essai sans base64 : un tableau typé passé tel quel par chrome.runtime
 const brut=await chrome.runtime.sendMessage({k:'brut',v:new Float32Array(d.buf.slice(0,16))});
 postMessage({k:'ch064r',tRecu,msBase64Contenu:tB64,msContenuVersSwEtHote:tTotal,sw:r,typeRecuSansBase64:brut},'*');});
`;
/* Service worker de l'extension d'essai. */
const SW=String.raw`
importScripts('lib/capture-core.js','lib/geometry.js','lib/vba.js','lib/coeur.js','lib/facade-geometrie.js','lib/comparer.js','lib/coeur.wasm.js');
self.demarre=Date.now();self.V46=self.BananeGeometry3;
const b64e=o=>o.toBase64?o.toBase64():btoa(Array.from(o,c=>String.fromCharCode(c)).join(''));
const b64d=s=>Uint8Array.fromBase64?Uint8Array.fromBase64(s):Uint8Array.from(atob(s),c=>c.charCodeAt(0));
self.base64Natif=!!(Uint8Array.prototype.toBase64&&Uint8Array.fromBase64);
let t0=performance.now();self.coeur=ArianeCoeur.creer(ARIANE_COEUR_WASM_B64);self.msInstanciation=performance.now()-t0;
self.facadeA=ArianeFacadeGeometrie.creer(coeur,V46);
self.natif={port:null,attente:new Map(),n:0,morceaux:new Map(),connexions:0,deconnexions:[]};
function connecter(){const p=chrome.runtime.connectNative('fr.ariane.coeur');natif.connexions++;natif.port=p;
 p.onMessage.addListener(m=>{const a=natif.attente.get(m.i);if(!a)return;
  if(m.n===undefined){natif.attente.delete(m.i);a.res(m);return;}
  const parts=natif.morceaux.get(m.i)||{l:[],n:0};parts.l[m.k]=m.t;parts.n++;natif.morceaux.set(m.i,parts);
  if(parts.n===m.n){natif.morceaux.delete(m.i);natif.attente.delete(m.i);a.res({t:parts.l.join(''),us:m.us,morceaux:m.n});}});
 p.onDisconnect.addListener(()=>{const e=chrome.runtime.lastError?.message;natif.deconnexions.push({t:Date.now(),e});natif.port=null;
  for(const a of natif.attente.values())a.rej(new Error('déconnecté : '+e));natif.attente.clear();});}
self.envoyer=msg=>new Promise((res,rej)=>{if(!natif.port)connecter();const i=++natif.n;natif.attente.set(i,{res,rej});try{natif.port.postMessage({i,...msg});}catch(e){natif.attente.delete(i);rej(e);}});
self.appelNatif=async(f,trame)=>{const r=await envoyer({f,t:b64e(trame)});return {octets:b64d(r.t),us:r.us,morceaux:r.morceaux};};
self.valeurNatif=async(f,valeur)=>{const r=await appelNatif(f,ArianeVba.encoder(valeur));const v=ArianeVba.decoder(r.octets);
 if(v&&v.__erreurVba){const E=v.nom==='TypeError'?TypeError:Error;throw new E(v.message);}return v;};
self.facadeB={proposeBoth:async(c,o={})=>valeurNatif(20,{capture:ArianeFacadeGeometrie.sousEnsemble(c),options:o})};
chrome.runtime.onMessage.addListener((m,s,rep)=>{
 if(m&&m.k==='lidar'){const t0=performance.now();const o=b64d(m.t);const tDec=performance.now()-t0;const t1=performance.now();
  envoyer({c:'etat',x:m.t}).then(()=>rep({octets:o.length,msDecodageSw:tDec,msSwVersHote:performance.now()-t1}));return true;}
 if(m&&m.k==='brut'){rep({type:Object.prototype.toString.call(m.v),cles:Object.keys(m.v||{}).length});return false;}
 if(m==='reveil'){envoyer({c:'etat'}).then(e=>rep(e)).catch(e=>rep({erreur:e.message}));return true;}});
`;
const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[s.length>>1]:null;},p95=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.floor(.95*s.length))]:null;};
const r3=x=>x===null?null:Math.round(x*1000)/1000;
async function lancer(prep){const {chromium}=require('playwright');
 const ctx=await chromium.launchPersistentContext(prep.profil,{channel:'chromium',headless:true,args:['--disable-extensions-except='+prep.ext,'--load-extension='+prep.ext]});
 let [sw]=ctx.serviceWorkers();if(!sw)sw=await ctx.waitForEvent('serviceworker',{timeout:20000});return {ctx,sw};}
async function main(){
 const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null,N=Number(arg('--nuages')||200);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch064-b-'));const prep=preparer(dir,N);
 const out={format:'ch064-banc-b-v1',plateforme:os.platform()+' '+os.release(),noeud:process.version,preparation:{nuages:prep.nuages,octetsWasm:prep.octetsWasm,octetsHote:prep.octetsHote}};
 let {ctx,sw}=await lancer(prep);
 out.navigateur=await sw.evaluate(()=>({ua:navigator.userAgent.match(/Chrome\/[\d.]+/)[0],base64Natif,msInstanciationWasm:msInstanciation}));
 await sw.evaluate(async()=>{const r=await fetch('nuages.json');self.NUAGES=await r.json();});
 // 0. démarrage à froid de l'hôte (premier message, lancement du processus compris)
 out.demarrageHote=await sw.evaluate(async()=>{const t0=performance.now();const e=await envoyer({c:'etat'});return {msPremierMessage:performance.now()-t0,pid:e.pid,memoire:e.memoire};});
 // 1. latence
 out.latence=await sw.evaluate(async()=>{const tr=ArianeVba.encoder(null),v=[],w=[];
  for(let i=0;i<300;i++){const t0=performance.now();await appelNatif(1,tr);v.push(performance.now()-t0);}
  for(let i=0;i<300;i++){const t0=performance.now();coeur.appeler(1,null);w.push(performance.now()-t0);}
  const q=(a,x)=>{const s=a.slice().sort((u,z)=>u-z);return s[Math.min(s.length-1,Math.floor(x*s.length))];};
  return {natifMsMediane:q(v,.5),natifMsP95:q(v,.95),wasmMsMediane:q(w,.5),wasmMsP95:q(w,.95),n:300};});
 // 1 bis. débit : capture de 500 000 points tirés des nuages réels (rails du premier)
 out.debit=await sw.evaluate(async()=>{const pts=[],vis=[];for(const c of NUAGES){for(let i=0;i<c.pointsSceneRelative.length&&pts.length<500000;i++){pts.push(c.pointsSceneRelative[i]);vis.push(c.visibleByClipBoxes?.[i]??true);}if(pts.length>=500000)break;}
  const grand={...NUAGES[0],pointsSceneRelative:pts,visibleByClipBoxes:vis};self.GRAND=grand;
  const val={capture:ArianeFacadeGeometrie.sousEnsemble(grand),options:{}};const r={points:pts.length};
  let t0=performance.now();const tr=ArianeVba.encoder(val);r.msEncodageVba=performance.now()-t0;r.octetsVba=tr.length;
  t0=performance.now();const s=(tr.toBase64?tr.toBase64():'');r.msBase64=performance.now()-t0;r.octetsBase64=s.length;
  const fois=async f=>{const v=[];let x;for(let i=0;i<3;i++){const t=performance.now();x=await f();v.push(performance.now()-t);}v.sort((a,b)=>a-b);return {ms:v[1],x};};
  let m=await fois(()=>appelNatif(1,tr));r.natifAccuseMs=m.ms;r.natifAccuseUsHote=m.x.us;
  m=await fois(()=>appelNatif(0,tr));r.natifEchoMs=m.ms;r.natifEchoMorceaux=m.x.morceaux;r.natifEchoUsHote=m.x.us;r.echoIdentique=m.x.octets.length===tr.length&&m.x.octets.every((b,i)=>b===tr[i]);
  m=await fois(()=>{const o=coeur.appelerOctets(1,tr);o.liberer();coeur.apresAppel();});r.wasmAccuseMs=m.ms;
  m=await fois(()=>{const o=coeur.appelerOctets(0,tr);const k=o.octets.length;o.liberer();coeur.apresAppel();return k;});r.wasmEchoMs=m.ms;
  // pose sur la grande capture
  m=await fois(()=>V46.proposeBoth(grand));r.poseJsMs=m.ms;const ref=m.x;
  m=await fois(()=>facadeA.proposeBoth(grand));r.poseAMs=m.ms;r.poseAIdentique=!Ch064Comparer.comparer(ref,m.x).length;
  m=await fois(()=>facadeB.proposeBoth(grand));r.poseBMs=m.ms;r.poseBIdentique=!Ch064Comparer.comparer(ref,m.x).length;
  r.memoireWasm=coeur.etat();return r;});
 out.debit.memoireHote=await sw.evaluate(async()=>{const avant=await envoyer({c:'etat'});const apres=await envoyer({c:'rendre'});return {apresEcho:avant.memoire,apresMallocTrim:apres.memoire};});
 out.debit.chromium=rssChromium(prep.profil);
 // 1 ter. lecture LiDAR sous B : les tampons Potree d'une vue (505 000 points, Float32 xyz) sortent de la page jusqu'à l'hôte
 {const page=await ctx.newPage();await page.route('https://essai.exemple/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>essai</title>'}));
  await page.goto('https://essai.exemple/rails_validation/x');await attendre(300);
  out.lidarTransfert=await page.evaluate(()=>new Promise(res=>{const n=505000,f=new Float32Array(3*n);for(let i=0;i<3*n;i++)f[i]=Math.sin(i)*30;
   addEventListener('message',ev=>{if(ev.data&&ev.data.k==='ch064r'){const t=performance.now();res({points:n,octets:f.byteLength||3*n*4,...ev.data,msTotalPageVersHote:t-t0});}});
   const t0=performance.now();postMessage({k:'ch064',buf:f.buffer},'*',[f.buffer]);}));
  await page.close();}
 // 2. limites de taille
 out.limites=await sw.evaluate(async()=>{const r={versChrome:{},versHote:{}};
  for(const o of [1000000,1048576,1048577,1100000]){try{const m=await envoyer({c:'grand',o});r.versChrome[o]='reçu ('+(m.t?.length??0)+' car.)';}catch(e){r.versChrome[o]=e.message;}}
  for(const mo of [16,63,64,65]){const s='A'.repeat(mo*1048576-40);try{const m=await envoyer({c:'etat',x:s});r.versHote[mo+' Mio']='accepté';}catch(e){r.versHote[mo+' Mio']=String(e.message).slice(0,140);}}
  return r;});
 // 3. calcul par nuage réel, parité
 out.pose=await sw.evaluate(async()=>{const m={js:[],a:[],b:[],coeurWasm:[],coeurNatifUs:[],encodage:[]},par={a:0,b:0,n:0},ecarts=[];
  const t=f=>{const t0=performance.now();const x=f();return [performance.now()-t0,x];};
  for(const c of NUAGES){par.n++;
   for(let k=0;k<2;k++)V46.proposeBoth(c); // échauffement
   const [tj,rj]=t(()=>V46.proposeBoth(c));m.js.push(tj);
   const [ta,ra]=t(()=>facadeA.proposeBoth(c));m.a.push(ta);if(!Ch064Comparer.comparer(rj,ra).length)par.a++;
   const t0=performance.now();const rb=await facadeB.proposeBoth(c);m.b.push(performance.now()-t0);const e=Ch064Comparer.comparer(rj,rb);if(!e.length)par.b++;else if(ecarts.length<5)ecarts.push(e.slice(0,2));
   const val={capture:ArianeFacadeGeometrie.sousEnsemble(c),options:{}};const [te,tr]=t(()=>ArianeVba.encoder(val));m.encodage.push(te);
   const [tw]=t(()=>{const o=coeur.appelerOctets(20,tr);o.liberer();});m.coeurWasm.push(tw);
   const rn=await appelNatif(20,tr);m.coeurNatifUs.push(rn.us[1]/1000);}
  const q=(a,x)=>{const s=a.slice().sort((u,z)=>u-z);return s[Math.min(s.length-1,Math.floor(x*s.length))];};
  const o={};for(const k in m)o[k]={mediane:q(m[k],.5),p95:q(m[k],.95)};return {nuages:par.n,identiquesA:par.a,identiquesB:par.b,ecartsB:ecarts,ms:o,memoireWasm:coeur.etat()};});
 out.pose.memoireHote=await sw.evaluate(async()=>(await envoyer({c:'etat'})).memoire);
 out.pose.chromium=rssChromium(prep.profil);
 if(!a.includes('--sans-tenue')){
  const tenue={};
  // 5a. hôte tué
  const pid=(await sw.evaluate(()=>envoyer({c:'etat'}))).pid;process.kill(pid,'SIGKILL');await attendre(300);
  tenue.hoteTue=await sw.evaluate(async()=>{const d=natif.deconnexions.at(-1);const t0=performance.now();const e=await envoyer({c:'etat'});return {deconnexionVue:d,msReconnexion:performance.now()-t0,nouveauPid:e.pid};});
  // 5b. inactivité avec le port ouvert (45 s), puis témoin sans port
  const d0=await sw.evaluate(()=>self.demarre);await attendre(45000);
  tenue.inactifPortOuvert=await sw.evaluate(async()=>({memeServiceWorker:self.demarre,portOuvert:!!natif.port})).then(r=>({...r,memeServiceWorker:r.memeServiceWorker===d0})).catch(e=>({erreur:e.message}));
  // 5c. arrêt du service worker par CDP : l'hôte suit-il ? reprise au réveil
  const pidAvant=(await sw.evaluate(()=>envoyer({c:'etat'}))).pid;
  const page=await ctx.newPage();const cdp=await ctx.newCDPSession(page);await cdp.send('ServiceWorker.enable');await cdp.send('ServiceWorker.stopAllWorkers');await attendre(1500);
  tenue.swArrete={hoteEncoreVivant:vivant(pidAvant)};
  const t0=Date.now();await page.goto('chrome-extension://'+prep.id+'/reveil.html');
  const sw2=ctx.serviceWorkers().at(-1);
  for(let i=0;i<50&&!(await sw2.evaluate(()=>!!natif.port).catch(()=>false));i++)await attendre(100);
  tenue.swArrete.msReveilEtReponse=Date.now()-t0;tenue.swArrete.nouveauServiceWorker=(await sw2.evaluate(()=>self.demarre).catch(()=>null))!==d0;
  // 5d. redémarrage de Chrome
  const pidFin=await sw2.evaluate(async()=>(await envoyer({c:'etat'})).pid).catch(()=>null);
  await ctx.close();await attendre(500);tenue.redemarrage={hoteArreteALaFermeture:pidFin?!vivant(pidFin):null};
  const t1=Date.now();({ctx,sw}=await lancer(prep));const tl=Date.now()-t1;
  const r=await sw.evaluate(async()=>{const t0=performance.now();const e=await envoyer({c:'etat'});return {msPremierMessage:performance.now()-t0,pid:e.pid};});
  tenue.redemarrage={...tenue.redemarrage,msLancementChrome:tl,...r};
  out.tenue=tenue;
 }
 await ctx.close();fs.rmSync(dir,{recursive:true,force:true});
 const s=JSON.stringify(out,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);
}
main().catch(e=>{console.error(e);process.exit(1);});
