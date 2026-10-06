/* V1 (test 2) — OBSERVATEUR PASSIF DE LA PAGE ESV (D-077, D-078).
 *
 * Injecté au démarrage de la page, dans le MONDE PRINCIPAL (manifeste :
 * `world:'MAIN'`, `run_at:'document_start'`), avant les scripts d'ESV : un
 * script du monde isolé ne verrait pas les requêtes de la page. Il n'a donc
 * aucun accès à `chrome.*` ; il parle au pont (src/bridge.js) par
 * `window.postMessage`.
 *
 * Il OBSERVE, il ne COMMANDE rien :
 *  - aucune requête n'est émise, aucun appel d'ESV ni du bus d'ESV ;
 *  - les originaux sont appelés avec les mêmes arguments et le même receveur ;
 *    leur valeur ou leur exception est rendue telle quelle ;
 *  - AUCUN en-tête n'est lu ni écrit (le jeton de connexion n'est jamais vu :
 *    ni `setRequestHeader`, ni `getResponseHeader`, ni `getAllResponseHeaders`) ;
 *  - `fetch` n'est PAS enveloppé : observer une Promise de la page demande d'y
 *    accrocher un `.then`, ce qui changerait le traitement d'un rejet non géré
 *    par la page. Les écritures d'ESV passent par XMLHttpRequest ;
 *  - une panne de l'observateur est avalée (`try/catch` partout) ;
 *  - mémoire bornée : tampon de 256 entrées ou 1 Mo, le plus ancien perdu en
 *    premier, la perte étant dite par un jalon `gap` (jamais de trou muet).
 *
 * Ce qui est noté (jamais l'URL complète, seulement sa CLASSE) :
 *  - `write`        écriture sur une coupe : méthode, statut, durée, tentative,
 *                   identifiant de coupe d'ESV (fin du chemin) et CORPS réduit
 *                   aux nombres, booléens et courtes chaînes (jamais d'objet) ;
 *  - `list-page`    page de la liste des coupes : statut, taille, nombre de
 *                   lignes et comptes par valeur de statut, sans les lignes ;
 *  - `resource`     fichiers de points : nombre, octets, début et fin, par
 *                   fenêtres de 250 ms (API de mesure des ressources) ;
 *  - `list-summary` résumé compact (comptes seulement) des listes chargées AVANT une séance,
 *                   posé une fois au début de la séance : jamais les lignes, jamais les écritures
 *                   ni les fichiers de points d'avant la séance ;
 *  - `observer`     marque « observateur présent » (version, installé avant les scripts de la page) ;
 *  - `fetch-rails`  filet : nombre de requêtes `fetch` de chemin rails (ces
 *                   requêtes ne sont pas observées, seulement comptées) ;
 *  - tout le reste (connexion, jeton, autres) : compté, jamais noté.
 *
 * Les événements du bus jQuery d'ESV (identité) ne sont pas pris ici : jQuery
 * n'existe pas encore à `document_start` (voir le rapport de la mission A). */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else api.install(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const LIMITS=Object.freeze({ringEntries:256,ringChars:1048576,entryChars:4096,resourceWindowMs:250,
  bodyKeys:24,bodyKeyChars:40,bodyStringChars:32,idChars:80,listChars:8000000,retryWindowMs:15000,listKeys:16});
 /* Classes d'URL : seul le CHEMIN compte, jamais la chaîne de requête. À
  * confirmer sur le banc ESV (mission B) avant toute conclusion. */
 const AUTH=/(^|\.)login\.microsoftonline\.com$|(^|\.)b2clogin\.com$|(^|\.)login\.live\.com$|\/oauth2\/|\/token(\/|$)|\/authorize(\/|$)|\/devicecode/i;
 const POINTS=/(?:^|\/)ept\.json$|\/ept-(?:data|hierarchy)\//i;
 const STATUS_VALUES=['valid','invalid','skipped'];
 const OBSERVER_VERSION=1;

 function pathOf(url,base){try{const u=new URL(String(url),base);return {host:u.hostname,path:u.pathname};}catch{return null;}}
 function classify(method,url,base){
  const u=pathOf(url,base);if(!u)return 'other';
  if(AUTH.test(u.host)||AUTH.test(u.path))return 'auth';
  const m=String(method||'GET').toUpperCase();
  if(m!=='GET'&&m!=='HEAD'&&/\/rails\/[^/]/.test(u.path))return 'write';
  /* Mesuré sur le banc ESV local (mission F) : la liste d'une partie est un GET `.../rails/<table de la partie>`
   * (pages chaînées par `?npk=...&nrk=...`), pas un GET `.../rails` ; ce dernier n'est que la question « y a-t-il
   * des invalides ? » (`?&status=invalid&top=1`). Les deux sont des listes ; un GET à deux segments après `rails`
   * (une coupe) reste « autre ». */
  if(m==='GET'&&/\/rails(\/[^/]+)?\/?$/.test(u.path))return 'list-page';
  if(m==='GET'&&POINTS.test(u.path))return 'point-resource';
  return 'other';
 }
 /* Chemin de classe « rails » (écriture, liste ou lecture d'une coupe), hors connexion et jeton. */
 function isRailsPath(url,base){const u=pathOf(url,base);return !!u&&!AUTH.test(u.host)&&!AUTH.test(u.path)&&/\/rails(\/|$)/.test(u.path);}
 /* Clé de liste : `.../rails/<table>` = la table de la partie (une clé par partie) ; `.../<projet>/rails` = le
  * segment avant `/rails` (la question « invalides », que la page d'ESV pose avec `projects/undefined` : clé à part,
  * jamais prise pour une partie). Caractères sûrs seulement ; sinon rien. Chaque chargement de partie recharge la
  * page, donc un observateur = une partie. */
 function listKey(url,base){
  const u=pathOf(url,base),m=u&&(/\/rails\/([^/]+)\/?$/.exec(u.path)||/\/([^/]+)\/rails\/?$/.exec(u.path));if(!m)return null;
  let k;try{k=decodeURIComponent(m[1]);}catch{return null;}
  return k.length<=LIMITS.idChars&&/^[\w.+\-]+$/.test(k)?k:null;}
 /* Identifiant de coupe d'ESV : fin du chemin après `/rails/`, caractères
  * sûrs seulement ; sinon rien. Ce n'est ni un jeton ni la chaîne de requête. */
 function railPairId(url,base){
  const u=pathOf(url,base),m=u&&/\/rails\/([^?#]+)$/.exec(u.path);if(!m)return null;
  let id;try{id=decodeURIComponent(m[1]);}catch{return null;}
  return id.length<=LIMITS.idChars&&/^(?!\/)(?!.*\.\.)[\w.+\-/]+$/.test(id)?id:null;
 }
 /* Corps d'une écriture : nombres finis, booléens et chaînes courtes seulement. */
 function writeBody(body){
  try{if(typeof body!=='string'||body.length>LIMITS.entryChars*4)return {keys:null,values:null};
   const o=JSON.parse(body);if(!o||typeof o!=='object'||Array.isArray(o))return {keys:null,values:null};
   const out={},names=Object.keys(o);let n=0;
   for(const k of names){const v=o[k];if(n>=LIMITS.bodyKeys||k.length>LIMITS.bodyKeyChars||!/^[\w.\-]+$/.test(k))continue;
    if(typeof v==='number'&&Number.isFinite(v)||typeof v==='boolean'||typeof v==='string'&&v.length<=LIMITS.bodyStringChars){out[k]=v;n++;}}
   return {keys:names.length,values:out};
  }catch{return {keys:null,values:null};}
 }
 /* Page de liste : lignes et comptes par valeur de statut (texte), sans les lignes. */
 function listSummary(text){
  if(typeof text!=='string')return {rows:null,counts:null};
  if(text.length>LIMITS.listChars)return {rows:null,counts:null,skipped:'oversize'};
  try{const j=JSON.parse(text),rows=Array.isArray(j)?j:Array.isArray(j?.value)?j.value:null;if(!rows)return {rows:null,counts:null};
   const counts={valid:0,invalid:0,skipped:0};
   for(const r of rows){if(!r||typeof r!=='object')continue;for(const k in r){const v=r[k];if(typeof v==='string'&&STATUS_VALUES.includes(v)){counts[v]++;break;}}}
   return {rows:rows.length,counts};
  }catch{return {rows:null,counts:null,skipped:'unreadable'};}
 }

 function install(win){
  if(!win||win.__banane5ObserverInstalled)return null;
  /* Dans le monde ISOLÉ (navigateur trop ancien pour `world:'MAIN'` en manifeste, qui
   * ignore alors la clé), les prototypes sont des copies : y envelopper XMLHttpRequest ne
   * verrait rien de la page. `chrome.runtime` n'existe que dans ce monde : s'abstenir. */
  try{if(win.chrome&&win.chrome.runtime&&win.chrome.runtime.id)return null;}catch{}
  try{Object.defineProperty(win,'__banane5ObserverInstalled',{value:true});}catch{return null;}
  const origin=()=>{try{return win.location.origin;}catch{return '*';}};
  const base=()=>{try{return win.location.href;}catch{return undefined;}};
  const perfNow=()=>win.performance.now(),epoch=t=>win.performance.timeOrigin+t;
  let observerId;try{observerId=win.crypto.randomUUID();}catch{observerId=String(Math.random()).slice(2)+String(Date.now());}
  let enabled=true,seq=0,ringChars=0,dropped=0,ignored=0;const ring=[],listSums=new Map();
  /* État de la page à l'installation : l'observateur est-il arrivé avant les scripts de la page ?
   * oui = document en cours de chargement et aucun script encore analysé ; non = déjà chargé ou des
   * scripts analysés ; inconnu (null) = document illisible : jamais deviné. */
  const start=(()=>{try{const d=win.document;if(!d)return {readyState:null,scripts:null,before:null};
   const readyState=typeof d.readyState==='string'?d.readyState:null,scripts=d.scripts&&Number.isInteger(d.scripts.length)?d.scripts.length:null;
   return {readyState,scripts,before:readyState!==null&&scripts!==null?readyState==='loading'&&scripts===0:null};}catch{return {readyState:null,scripts:null,before:null};}})();

  /* ------------------------------------------------ tampon et envoi */
  function post(entry){try{win.postMessage({kind:'banane5:esv-observation',v:1,observer:observerId,entry},origin());}catch{}}
  function record(entry){
   let e={seq:++seq,...entry},json;
   try{json=JSON.stringify(e);
    if(json.length>LIMITS.entryChars){e={seq:e.seq,kind:'gap',lost:1,reason:'oversize',of:String(entry.kind).slice(0,24)};json=JSON.stringify(e);}}
   catch{e={seq:e.seq,kind:'gap',lost:1,reason:'unserializable'};json=JSON.stringify(e);}
   ring.push({seq:e.seq,json,chars:json.length});ringChars+=json.length;
   while(ring.length>LIMITS.ringEntries||ringChars>LIMITS.ringChars){const x=ring.shift();ringChars-=x.chars;dropped++;}
   post(e);
  }
  /* Marque « observateur présent » : posée à la demande du pont, au début d'une séance. Elle distingue
   * « aucune écriture » d'« observateur absent » (navigateur trop ancien, page non rechargée après
   * l'installation, extension non rechargée) : sans marque dans une séance, l'observateur n'y était pas. */
  function snapshot(afterDenial){
   record({kind:'observer',version:OBSERVER_VERSION,world:'MAIN',installedBeforePageScripts:start.before,readyState:start.readyState,scriptsAtInstall:start.scripts,
    enabled,afterDenial:afterDenial===true,dropped,ignored});
   // Séance démarrée APRÈS le chargement des listes : leur résumé (comptes seulement), rien d'autre d'avant la séance.
   if(afterDenial===true)postListSummaries();
  }
  /* Résumé compact par chargement de liste (jamais les lignes), tenu à part du tampon : il n'est pas évincé par
   * les écritures. Une valeur inconnue (page illisible, en erreur, trop grosse) rend le total « non mesuré »
   * (null), jamais zéro. Au plus 16 clés. */
  function addListSummary(key,e){
   const k=key??'?';let v=listSums.get(k);if(!v){if(listSums.size>=LIMITS.listKeys)return;
    v={key,pages:0,ok:0,rows:0,rowsKnown:true,chars:0,charsKnown:true,counts:{valid:0,invalid:0,skipped:0},countsKnown:true,first:null,last:null};listSums.set(k,v);}
   v.pages++;if(e.status>=200&&e.status<300)v.ok++;
   if(Number.isFinite(e.rows))v.rows+=e.rows;else v.rowsKnown=false;
   if(Number.isFinite(e.chars))v.chars+=e.chars;else v.charsKnown=false;
   if(e.counts&&typeof e.counts==='object')for(const c of STATUS_VALUES)v.counts[c]+=e.counts[c]||0;else v.countsKnown=false;
   if(Number.isFinite(e.startedEpochMs))v.first=v.first===null?e.startedEpochMs:Math.min(v.first,e.startedEpochMs);
   if(Number.isFinite(e.endedEpochMs))v.last=v.last===null?e.endedEpochMs:Math.max(v.last,e.endedEpochMs);
  }
  function postListSummaries(){for(const v of listSums.values())record({kind:'list-summary',listKey:v.key,pages:v.pages,okPages:v.ok,rows:v.rowsKnown?v.rows:null,chars:v.charsKnown?v.chars:null,
   counts:v.countsKnown?{...v.counts}:null,firstStartedEpochMs:v.first,lastEndedEpochMs:v.last,durationMs:v.first!==null&&v.last!==null?Math.round((v.last-v.first)*100)/100:null,beforeSession:true});}
  /* Le pont se signale (ou se re-signale) : rejouer ce que le tampon garde. */
  function replay(afterSeq){for(const x of ring)if(x.seq>afterSeq){try{post(JSON.parse(x.json));}catch{}}}

  /* ------------------------------------------------ XMLHttpRequest */
  const meta=new WeakMap(),lastSend=new Map();
  function patch(obj,name,before){
   const d=obj&&Object.getOwnPropertyDescriptor(obj,name);if(!d||typeof d.value!=='function')return false;
   const original=d.value;
   Object.defineProperty(obj,name,{...d,value:new Proxy(original,{apply(target,thisArg,args){
    if(enabled)try{before(thisArg,args);}catch{}
    return Reflect.apply(target,thisArg,args);}})});
   return true;
  }
  function onOpen(xhr,args){
   const cls=classify(args[0],args[1],base());
   meta.set(xhr,{cls,method:String(args[0]||'GET').toUpperCase(),url:args[1],attached:false,done:false});
  }
  function onSend(xhr,args){
   const m=meta.get(xhr);if(!m||m.cls!=='write'&&m.cls!=='list-page'){ignored++;return;}
   // Une note par requête : un envoi relancé (le premier a levé) ou répété sans `open` n'ajoute rien.
   if(m.attached)return;m.attached=true;
   const started=perfNow(),body=m.cls==='write'?writeBody(args[0]):null;let outcome='done';
   /* Tentative : décidée À L'ENVOI. ESV relance l'écriture depuis le rappel de la précédente, avant `loadend` et avant
    * la note de celle-ci : comparer des heures de FIN (prises plus tard) donnait toujours « tentative 1 ». On regarde
    * donc si la précédente écriture de la même coupe est déjà terminée sans 200 ni 204 (statut 0 compris). Fin connue
    * par `loadend` si la relance vient après ; sinon la relance part du rappel même (fin = maintenant). Coupe illisible
    * (identifiant nul) : jamais rapprochée d'une autre, tentative 1. */
   if(m.cls==='write'){const id=railPairId(m.url,base()),key=m.method+' '+id,prev=id===null?undefined:lastSend.get(key),
     st=prev&&prev.xhr!==xhr&&prev.xhr.readyState===4&&Number.isInteger(prev.xhr.status)?prev.xhr.status:null;
    m.attempt=st!==null&&st!==200&&st!==204&&started-(prev.endedAt??started)<LIMITS.retryWindowMs?prev.attempt+1:1;
    if(id!==null){m.sent={xhr,attempt:m.attempt,endedAt:null};lastSend.set(key,m.sent);if(lastSend.size>64)lastSend.delete(lastSend.keys().next().value);}}
   const flag=name=>()=>{outcome=name;};
   xhr.addEventListener('abort',flag('abort'));xhr.addEventListener('timeout',flag('timeout'));
   xhr.addEventListener('loadend',()=>{
    // Un XHR réutilisé garde les écouteurs de sa requête précédente : seul compte celui de l'`open` courant.
    if(meta.get(xhr)!==m||m.done)return;m.done=true;if(m.sent)m.sent.endedAt=perfNow();
    // Après les écouteurs d'ESV : la lecture éventuellement lourde ne les retarde pas.
    try{win.setTimeout(()=>{try{finish(xhr,m,started,perfNow(),outcome,body);}catch{}},0);}catch{}
   });
  }
  function finish(xhr,m,started,ended,outcome,body){
   if(!enabled)return;
   const status=Number.isInteger(xhr.status)?xhr.status:0;if(status===0&&outcome==='done')outcome='error';
   const common={via:'xhr',method:m.method,status,outcome,startedEpochMs:epoch(started),endedEpochMs:epoch(ended),durationMs:Math.round((ended-started)*100)/100};
   if(m.cls==='write'){
    const id=railPairId(m.url,base()),attempt=m.attempt||1;
    record({kind:'write',urlClass:'rail-pair-write',railPairId:id,attempt,bodyKeys:body?.keys??null,body:body?.values??null,...common});
   }else{
    let text=null;try{text=xhr.responseType===''||xhr.responseType==='text'?xhr.responseText:xhr.responseType==='json'&&xhr.response?JSON.stringify(xhr.response):null;}catch{}
    const s=status>=200&&status<300?listSummary(text):{rows:null,counts:null};
    const key=listKey(m.url,base()),entry={kind:'list-page',urlClass:'rail-list',listKey:key,chars:typeof text==='string'?text.length:null,basis:'row-string-values',...s,...common};
    record(entry);addListSummary(key,entry);
   }
  }
  patch(win.XMLHttpRequest&&win.XMLHttpRequest.prototype,'open',onOpen);
  patch(win.XMLHttpRequest&&win.XMLHttpRequest.prototype,'send',onSend);

  /* ------------------------------------------------ fichiers de points */
  let windowTimer=null,agg=null,aggFetch=null;
  function flushResources(){windowTimer=null;const a=agg,f=aggFetch;agg=null;aggFetch=null;
   if(a)record({kind:'resource',class:'point-resource',n:a.n,bytes:a.bytes,startedEpochMs:epoch(a.start),endedEpochMs:epoch(a.end),windowMs:LIMITS.resourceWindowMs});
   if(f)record({kind:'fetch-rails',n:f.n,startedEpochMs:epoch(f.start),endedEpochMs:epoch(f.end),windowMs:LIMITS.resourceWindowMs});}
  /* Filet passif pour `fetch` (non enveloppé) : l'API de mesure des ressources voit aussi les requêtes
   * `fetch`. On COMPTE celles dont le chemin est de classe « rails » (jamais l'URL, jamais le contenu) :
   * un « 0 écriture » se distingue ainsi d'une écriture passée par `fetch` et non vue. */
  function onResources(entries){
   for(const e of entries){const start=Number(e.startTime),end=Number(e.responseEnd);if(!Number.isFinite(start)||!Number.isFinite(end))continue;
    if(classify('GET',e.name,base())==='point-resource'){
     if(!agg)agg={n:0,bytes:0,start,end};agg.n++;agg.bytes+=Number(e.transferSize)||Number(e.encodedBodySize)||0;agg.start=Math.min(agg.start,start);agg.end=Math.max(agg.end,end);
    }else if(e.initiatorType==='fetch'&&isRailsPath(e.name,base())){
     if(!aggFetch)aggFetch={n:0,start,end};aggFetch.n++;aggFetch.start=Math.min(aggFetch.start,start);aggFetch.end=Math.max(aggFetch.end,end);}}
   if((agg||aggFetch)&&!windowTimer)windowTimer=win.setTimeout(()=>{try{flushResources();}catch{}},LIMITS.resourceWindowMs);
  }
  try{if(win.PerformanceObserver){const po=new win.PerformanceObserver(list=>{try{if(enabled)onResources(list.getEntries());}catch{}});po.observe({type:'resource',buffered:true});}}catch{}

  /* ------------------------------------------------ messages du pont */
  try{win.addEventListener('message',ev=>{try{
   if(ev.source!==win||ev.origin!==origin())return;const d=ev.data;if(!d||typeof d!=='object')return;
   if(d.kind==='banane5:hello')replay(Number.isInteger(d.afterSeq)&&d.afterSeq>=0?d.afterSeq:0);
   else if(d.kind==='banane5:snapshot')snapshot(d.afterDenial===true);
   else if(d.kind==='banane5:config')enabled=d.enabled!==false;
  }catch{}});}catch{}

  return {record,replay,ring:()=>ring.map(x=>JSON.parse(x.json)),setEnabled:v=>{enabled=!!v;},
   stats:()=>({observer:observerId,seq,dropped,ringEntries:ring.length,ringChars,ignored,enabled})};
 }
 return {install,classify,isRailsPath,railPairId,listKey,writeBody,listSummary,LIMITS};
});
