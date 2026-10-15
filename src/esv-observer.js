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
 *  - `resource` (4.9.5.3) porte aussi, pour les nœuds `ept-data` : `statuts` (nombre de ressources par statut HTTP, `responseStatus` de
 *                   l'API de mesure des ressources quand le navigateur le donne), `sansStatut`, `echecs` (statut ≥ 400 ou 0), `echecsCumules`
 *                   (depuis l'installation), `dureeTotMs` et `dureeMaxMs` (relevé en lecture seule, S6) ;
 *  - `list-fields` (4.9.5.3) une fois par chargement de liste : NOMS des champs d'une ligne (jamais les valeurs) et résumé des champs gardés
 *                   (`RailSpacing`, `TrajAzimuth`, `RailType`, `Success*`, `PK` : présence, extrêmes, valeurs de `RailType`) ;
 *  - `esv-event`, `diag-compteur-bloque` (4.9.5.3) : relayés tels que l'adaptateur de la page (même monde) les poste (`banane5:evt`),
 *                   après réduction (nombres, courtes chaînes) ; l'adaptateur pose des écouteurs jQuery en ombre sur les événements d'ESV ;
 *  - `observer`     marque « observateur présent » (version, installé avant les scripts de la page) ;
 *  - `fetch-rails`  filet : nombre de requêtes `fetch` de chemin rails (ces
 *                   requêtes ne sont pas observées, seulement comptées) ;
 *  - tout le reste (connexion, jeton, autres) : compté, jamais noté.
 *
 * B1 (D-095) — TABLE DES COUPES, EN MÉMOIRE DE LA PAGE SEULEMENT. À la lecture d'une
 * page de la liste d'une partie (`…/rails/<table>`), une table compacte est tenue ici,
 * par table : clé de ligne, ordre de réception (= indice dans la liste d'ESV, donc le
 * numéro de cut affiché « Cut N »), statut, drapeaux opérateur et bords gauche/droit
 * (MONDE). Elle n'est jamais postée en bloc, jamais stockée, jamais accompagnée d'une
 * URL : le pont n'en reçoit, à sa demande (`banane5:voisins`), qu'une fenêtre de ±10
 * lignes au plus et l'indice de la ligne la plus proche d'un point donné. Les écritures
 * de validation réussies vues ici la tiennent à jour (fraîcheur : ESV fait de même dans
 * sa propre copie). Mémoire bornée (`tableRows` lignes, `tables` tables). Aucune requête
 * émise, aucun en-tête lu, aucun original modifié : rien ne change pour la page.
 *
 * Les événements du bus jQuery d'ESV (identité) ne sont pas pris ici : jQuery
 * n'existe pas encore à `document_start` (voir le rapport de la mission A). */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else api.install(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const LIMITS=Object.freeze({ringEntries:256,ringChars:1048576,entryChars:4096,resourceWindowMs:250,
  bodyKeys:24,bodyKeyChars:40,bodyStringChars:32,idChars:80,listChars:8000000,retryWindowMs:15000,listKeys:16,
  tableRows:40000,tables:4,rowKeyChars:40,voisinsMax:10});
 const EDGES=['XLeftEdge','YLeftEdge','ZLeftEdge','XRightEdge','YRightEdge','ZRightEdge'],STATUS_CODE={valid:0,invalid:1,skipped:2};
 /* Classes d'URL : seul le CHEMIN compte, jamais la chaîne de requête. À
  * confirmer sur le banc ESV (mission B) avant toute conclusion. */
 const AUTH=/(^|\.)login\.microsoftonline\.com$|(^|\.)b2clogin\.com$|(^|\.)login\.live\.com$|\/oauth2\/|\/token(\/|$)|\/authorize(\/|$)|\/devicecode/i;
 const POINTS=/(?:^|\/)ept\.json$|\/ept-(?:data|hierarchy)\//i;
 const STATUS_VALUES=['valid','invalid','skipped'];
 const OBSERVER_VERSION=1;
 /* 4.9.5.3 (S6) — champs de liste gardés en plus (lecture seule) et événements relayés depuis l'adaptateur. */
 const EXTRA_NUM=['RailSpacing','TrajAzimuth'],EXTRA_STR='RailType',EXTRA_PK='PK',SUCCESS=/^Success/;
 const EVT_KINDS=Object.freeze({'esv-event':['railPairSelected','railPairUpdated','railPairSeen','loading','newPart'],'diag-compteur-bloque':null});
 const EPT_DATA=/\/ept-data\//i;
 function argsReduits(a){if(!Array.isArray(a))return [];return a.slice(0,6).map(v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.length<=24?v:typeof v==='boolean'?v:null);}

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
 function listSummary(text,sink){
  if(typeof text!=='string')return {rows:null,counts:null};
  if(text.length>LIMITS.listChars)return {rows:null,counts:null,skipped:'oversize'};
  try{const j=JSON.parse(text),rows=Array.isArray(j)?j:Array.isArray(j?.value)?j.value:null;if(!rows)return {rows:null,counts:null};
   const counts={valid:0,invalid:0,skipped:0};
   for(const r of rows){if(!r||typeof r!=='object')continue;for(const k in r){const v=r[k];if(typeof v==='string'&&STATUS_VALUES.includes(v)){counts[v]++;break;}}}
   // B1 : la même lecture alimente la table de la page (aucun second décodage).
   if(typeof sink==='function')try{sink(rows);}catch{}
   return {rows:rows.length,counts};
  }catch{return {rows:null,counts:null,skipped:'unreadable'};}
 }
 /* ------------------------------------------------ B1 : table des coupes (mémoire de la page) */
 /* Table d'une partie : GET `…/rails/<table>` seulement (pas la question « invalides » `…/<projet>/rails`). */
 function tableKey(url,base){
  const u=pathOf(url,base),m=u&&/\/rails\/([^/]+)\/?$/.exec(u.path);if(!m)return null;
  let k;try{k=decodeURIComponent(m[1]);}catch{return null;}
  return k.length<=LIMITS.idChars&&/^[\w.+\-]+$/.test(k)?k:null;}
 /* Première page d'une lecture : sans suite chaînée (`npk`). La chaîne de requête est lue ici, jamais notée. */
 function firstPage(url,base){try{return !new URL(String(url),base).searchParams.has('npk');}catch{return null;}}
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function newTable(debut){return {rk:[],st:[],fl:[],ed:[],idx:new Map(),pages:0,debut:debut===true,rompue:false,tronquee:false,fraiches:0,
  /* 4.9.5.3 : champs gardés en plus, parallèles à `rk` (NaN / null si absents) ; jamais postés en bloc. */
  sp:[],az:[],rt:[],pk:[],su:new Map()};}
 /* Une ligne par élément reçu, dans l'ordre (ESV range chaque élément de la même façon) : l'indice suit le sien. */
 function addRows(t,rows){
  for(const r of rows){if(t.rk.length>=LIMITS.tableRows){t.tronquee=true;return;}
   const o=r&&typeof r==='object'?r:{},k=typeof o.RowKey==='string'&&o.RowKey.length<=LIMITS.rowKeyChars?o.RowKey:null,i=t.rk.length;
   t.rk.push(k);if(k!==null&&!t.idx.has(k))t.idx.set(k,i);
   t.st.push(STATUS_CODE[o.ExtractionStatus]??3);t.fl.push((o.TreatedByOperator===true?1:0)|(o.SeenByOperator===true?2:0));
   for(const e of EDGES)t.ed.push(finite(o[e])?o[e]:NaN);
   if(t.extras!==false)gardeExtras(t,o,i);}
 }
 /* 4.9.5.3 (S6) : RailSpacing, TrajAzimuth, RailType, Success*, PK de la ligne, si présents. Aucun effet sur les comptes ni sur B1. */
 function gardeExtras(t,o,i){
  t.sp.push(finite(o.RailSpacing)?o.RailSpacing:NaN);t.az.push(finite(o.TrajAzimuth)?o.TrajAzimuth:NaN);
  t.rt.push(typeof o[EXTRA_STR]==='string'&&o[EXTRA_STR].length<=24?o[EXTRA_STR]:null);
  const pk=o[EXTRA_PK];t.pk.push(finite(pk)?pk:typeof pk==='string'&&pk.length<=24?pk:null);
  for(const k in o){if(!SUCCESS.test(k)||k.length>40||!/^[\w.\-]+$/.test(k))continue;
   let col=t.su.get(k);if(!col){if(t.su.size>=8)continue;col=[];t.su.set(k,col);}
   while(col.length<i)col.push(null);const v=o[k];col[i]=finite(v)||typeof v==='boolean'?v:typeof v==='string'&&v.length<=24?v:null;}
 }
 /* Noms des champs d'UNE ligne (jamais les valeurs) et résumé des champs gardés : consigné une fois par chargement de liste. */
 function inventaireChamps(rows,t){
  const premiere=rows.find(r=>r&&typeof r==='object'&&!Array.isArray(r)),noms=premiere?Object.keys(premiere).filter(k=>k.length<=40&&/^[\w.\-]+$/.test(k)).sort().slice(0,64):[];
  const ext=(a)=>{const v=a.filter(Number.isFinite);return v.length?{n:v.length,min:Math.min(...v),max:Math.max(...v)}:{n:0};};
  const types={};for(const x of t.rt)if(x!==null){types[x]=(types[x]||0)+1;if(Object.keys(types).length>8)break;}
  const succes={};for(const [k,col] of t.su){const v=col.filter(x=>x!==null&&x!==undefined);succes[k]={n:v.length,vrai:v.filter(x=>x===true).length};}
  return {noms,champs:Object.keys(premiere||{}).length,
   gardes:{RailSpacing:ext(t.sp),TrajAzimuth:ext(t.az),RailType:{n:t.rt.filter(x=>x!==null).length,valeurs:types},PK:{n:t.pk.filter(x=>x!==null).length},Success:succes}};
 }
 /* Écriture réussie sur une ligne connue : statut, drapeaux et bords tels qu'écrits (ESV fait de même chez lui). */
 function applyWrite(t,rk,v){
  const i=t.idx.get(rk);if(i===undefined||!v)return null;
  if(typeof v.ExtractionStatus==='string'){t.st[i]=STATUS_CODE[v.ExtractionStatus]??3;
   if(v.TreatedByOperator===true)t.fl[i]|=1;if(v.SeenByOperator===true)t.fl[i]|=2;
   const e=EDGES.map(k=>v[k]);if(e.every(finite)){for(let j=0;j<6;j++)t.ed[6*i+j]=e[j];if(!(t.fl[i]&4))t.fraiches++;t.fl[i]|=4;}}
  else if(v.SeenByOperator===true)t.fl[i]|=2;
  return i;
 }
 /* Ligne la plus proche d'une paire de points (monde), toutes tables : pire des deux rails, en mm. */
 function nearest(tables,world){
  let best=null,second=Infinity;
  for(const [key,t] of tables){const n=t.rk.length;
   for(let i=0;i<n;i++){const o=6*i;
    const dl=Math.hypot(t.ed[o]-world.left[0],t.ed[o+1]-world.left[1],t.ed[o+2]-world.left[2]),dr=Math.hypot(t.ed[o+3]-world.right[0],t.ed[o+4]-world.right[1],t.ed[o+5]-world.right[2]),d=Math.max(dl,dr);
    if(!(d===d))continue;
    if(!best||d<best.d){if(best)second=Math.min(second,best.d);best={key,index:i,d};}else if(d<second)second=d;}}
  return best?{key:best.key,index:best.index,mm:best.d*1000,secondMm:Number.isFinite(second)?second*1000:null}:null;
 }
 const STATUS_NAME=['valid','invalid','skipped','autre'];
 /* Réponse au pont : résumé de la table retenue, ligne la plus proche, fenêtre de ±`fenetre` lignes autour du cut demandé. */
 function voisins(tables,req){
  const point=p=>Array.isArray(p)&&p.length===3&&p.every(finite)?p:null,world=req&&{left:point(req.world?.left),right:point(req.world?.right)};
  const cut=req?.cut,w=req?.fenetre;
  if(!Number.isInteger(cut)||cut<0||!Number.isInteger(w)||w<1||w>LIMITS.voisinsMax||!world.left||!world.right)return {ok:false,reason:'demande-invalide'};
  if(!tables.size)return {ok:false,reason:'sans-table'};
  const geo=nearest(tables,world);if(!geo)return {ok:false,reason:'sans-ligne'};
  const t=tables.get(geo.key),rows=[];
  for(let i=Math.max(0,cut-w);i<=Math.min(t.rk.length-1,cut+w);i++){const o=6*i,e=t.ed.slice(o,o+6);
   rows.push({i,s:STATUS_NAME[t.st[i]]??'autre',t:!!(t.fl[i]&1),v:!!(t.fl[i]&2),f:!!(t.fl[i]&4),e:e.every(finite)?e:null});}
  return {ok:true,table:{lignes:t.rk.length,pages:t.pages,fraiches:t.fraiches,debut:t.debut,rompue:t.rompue,tronquee:t.tronquee,tables:tables.size},
   geo:{index:geo.index,mm:geo.mm,secondMm:geo.secondMm},rows};
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
  let enabled=true,seq=0,ringChars=0,dropped=0,ignored=0,tablesOn=true;const ring=[],listSums=new Map(),tables=new Map();
  /* 4.9.5.3 (S6) : relevés coupés par le service worker (`banane5:config`, `relevesOff`) ; tous actifs au départ. */
  const off=new Set();let echecsCumules=0;
  const releveOn=nom=>!off.has(nom);
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
    /* B1 : écriture réussie → la ligne de la table est mise à jour ; son indice (un nombre) est noté. */
    let rowIndex=null;
    if(tablesOn&&status>=200&&status<300&&id!==null&&body?.values){const k=id.lastIndexOf('/'),t=k>0?tables.get(id.slice(0,k)):null;if(t)rowIndex=applyWrite(t,id.slice(k+1),body.values);}
    record({kind:'write',urlClass:'rail-pair-write',railPairId:id,attempt,bodyKeys:body?.keys??null,body:body?.values??null,rowIndex,...common});
   }else{
    let text=null;try{text=xhr.responseType===''||xhr.responseType==='text'?xhr.responseText:xhr.responseType==='json'&&xhr.response?JSON.stringify(xhr.response):null;}catch{}
    const tk=tablesOn?tableKey(m.url,base()):null;let read=false;
    const s=status>=200&&status<300?listSummary(text,tk===null?null:rows=>{read=true;pageInto(tk,m.url,rows);}):{rows:null,counts:null};
    if(tk!==null&&!read)pageBroken(tk,m.url);
    const key=listKey(m.url,base()),entry={kind:'list-page',urlClass:'rail-list',listKey:key,chars:typeof text==='string'?text.length:null,basis:'row-string-values',...s,...common};
    record(entry);addListSummary(key,entry);
   }
  }
  /* B1 : une première page ouvre une table neuve (relecture de la liste) ; une suite sans début vu ne sert jamais
   * à l'indice (`debut:false`) ; une page illisible ou en erreur rompt la table. Au plus `LIMITS.tables` tables. */
  function tableFor(tk,url){const first=firstPage(url,base());let t=tables.get(tk);
   if(first===true||!t){if(t)tables.delete(tk);t=newTable(first===true);t.extras=releveOn('champsListe');tables.set(tk,t);while(tables.size>LIMITS.tables)tables.delete(tables.keys().next().value);}
   return t;}
  function pageInto(tk,url,rows){const t=tableFor(tk,url);t.pages++;addRows(t,rows);
   /* 4.9.5.3 : inventaire des noms de champs, une fois par chargement de liste (première page). Noms seulement, jamais de valeurs. */
   if(t.pages===1&&t.debut&&t.extras!==false&&!t.inventaire){t.inventaire=true;try{record({kind:'list-fields',listKey:listKey(url,base()),rows:rows.length,...inventaireChamps(rows,t)});}catch{}}}
  function pageBroken(tk,url){const t=tableFor(tk,url);t.pages++;t.rompue=true;}
  patch(win.XMLHttpRequest&&win.XMLHttpRequest.prototype,'open',onOpen);
  patch(win.XMLHttpRequest&&win.XMLHttpRequest.prototype,'send',onSend);

  /* ------------------------------------------------ fichiers de points */
  let windowTimer=null,agg=null,aggFetch=null;
  function flushResources(){windowTimer=null;const a=agg,f=aggFetch;agg=null;aggFetch=null;
   if(a)record({kind:'resource',class:'point-resource',n:a.n,bytes:a.bytes,startedEpochMs:epoch(a.start),endedEpochMs:epoch(a.end),windowMs:LIMITS.resourceWindowMs,
    /* 4.9.5.3 (S6) : nœuds ept-data seulement ; absent si le relevé est coupé ou si la fenêtre n'en compte aucun. */
    ...(a.ept?{ept:a.ept.n,statuts:a.ept.statuts,sansStatut:a.ept.sansStatut,echecs:a.ept.echecs,echecsCumules,dureeTotMs:Math.round(a.ept.dur*10)/10,dureeMaxMs:Math.round(a.ept.max*10)/10}:{})});
   if(f)record({kind:'fetch-rails',n:f.n,startedEpochMs:epoch(f.start),endedEpochMs:epoch(f.end),windowMs:LIMITS.resourceWindowMs});}
  /* Filet passif pour `fetch` (non enveloppé) : l'API de mesure des ressources voit aussi les requêtes
   * `fetch`. On COMPTE celles dont le chemin est de classe « rails » (jamais l'URL, jamais le contenu) :
   * un « 0 écriture » se distingue ainsi d'une écriture passée par `fetch` et non vue. */
  function onResources(entries){
   for(const e of entries){const start=Number(e.startTime),end=Number(e.responseEnd);if(!Number.isFinite(start)||!Number.isFinite(end))continue;
    if(classify('GET',e.name,base())==='point-resource'){
     if(!agg)agg={n:0,bytes:0,start,end};agg.n++;agg.bytes+=Number(e.transferSize)||Number(e.encodedBodySize)||0;agg.start=Math.min(agg.start,start);agg.end=Math.max(agg.end,end);
     if(releveOn('ressources')&&EPT_DATA.test(pathOf(e.name,base())?.path||'')){
      /* `responseStatus` (Chrome ≥ 109) : absent = non disponible (jamais compté comme échec) ; 0 ou ≥ 400 = échec. Durée = fin − début. */
      const x=agg.ept||(agg.ept={n:0,statuts:{},sansStatut:0,echecs:0,dur:0,max:0});x.n++;
      const rs=e.responseStatus,d=Number(e.duration);if(Number.isFinite(d)&&d>=0){x.dur+=d;x.max=Math.max(x.max,d);}
      if(Number.isInteger(rs)&&rs>=0&&rs<=999){const k=String(rs);if(k in x.statuts||Object.keys(x.statuts).length<8)x.statuts[k]=(x.statuts[k]||0)+1;if(rs===0||rs>=400){x.echecs++;echecsCumules++;}}
      else x.sansStatut++;}
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
   /* 4.9.5.3 (S6) : l'adaptateur de la page (même monde) poste ses relevés (écouteurs jQuery en ombre, compteur bloqué) ; réduits ici. */
   else if(d.kind==='banane5:evt'&&d.event&&typeof d.event==='object'){
    const x=d.event,k=typeof x.kind==='string'?x.kind:'';if(!Object.hasOwn(EVT_KINDS,k)||!enabled)return;
    if(k==='esv-event'){if(!releveOn('esvEvents')||!EVT_KINDS[k].includes(x.nom))return;
     record({kind:k,nom:x.nom,args:argsReduits(x.args),pageMs:finite(x.pageMs)?Math.round(x.pageMs*10)/10:null,...(Number.isInteger(x.perdus)&&x.perdus>0?{perdus:Math.min(x.perdus,1e6)}:{})});}
    else if(k==='diag-compteur-bloque'){if(!releveOn('compteurBloque'))return;
     record({kind:k,valeur:Number.isInteger(x.valeur)&&x.valeur>0&&x.valeur<1e6?x.valeur:null,cuts:Number.isInteger(x.cuts)&&x.cuts>0&&x.cuts<1000?x.cuts:null,
      cut:Number.isInteger(x.cut)&&x.cut>=0&&x.cut<1e8?x.cut:null,pageMs:finite(x.pageMs)?Math.round(x.pageMs*10)/10:null});}}
   else if(d.kind==='banane5:config'){
    if(Array.isArray(d.relevesOff)){off.clear();for(const n of d.relevesOff)if(typeof n==='string'&&n.length<=24)off.add(n);}
    if(!Array.isArray(d.relevesOff)&&(!('table' in d)||typeof d.enabled==='boolean'))enabled=d.enabled!==false;
    // B1 : appuis de la liste coupés (réglage `appuisListe:'off'`) : la table est oubliée et n'est plus tenue.
    if(d.table===false){tablesOn=false;tables.clear();}}
   /* B1 : demande du pont (fenêtre de voisins et ligne la plus proche d'un point monde). Réponse bornée. */
   else if(d.kind==='banane5:voisins'&&typeof d.id==='string'&&d.id.length<=80){
    const r=!enabled||!tablesOn?{ok:false,reason:'coupe'}:voisins(tables,d);
    win.postMessage({kind:'banane5:voisins-reponse',v:1,id:d.id,...r},origin());}
  }catch{}});}catch{}

  return {record,replay,ring:()=>ring.map(x=>JSON.parse(x.json)),setEnabled:v=>{enabled=!!v;},
   stats:()=>({observer:observerId,seq,dropped,ringEntries:ring.length,ringChars,ignored,enabled}),
   tables:()=>[...tables.values()].map(t=>({lignes:t.rk.length,pages:t.pages,fraiches:t.fraiches,debut:t.debut,rompue:t.rompue,tronquee:t.tronquee}))};
 }
 return {install,classify,isRailsPath,railPairId,listKey,writeBody,listSummary,tableKey,firstPage,voisins,inventaireChamps,newTable,addRows,argsReduits,LIMITS};
});
