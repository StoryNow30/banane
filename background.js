'use strict';
// L'ORDRE COMPTE. `src/engine.js` est gelé et lie sa géométrie au chargement.
// La composition V4.6 (géométrie gelée + cerveau) reste la décision runtime.
// GCV1 est chargé ensuite comme copie scientifique figée. La façade conserve
// V4.6 par défaut, et ne sélectionne GCV1 que pour un appel explicitement armé.
/* ORDRE. `src/lot-decision.js` lit la grille d'A_STAR par `geometry-candidate-v1.js`,
 * qu'il lie au chargement via `BananeGeometry3`. Or `src/gcv1-shadow.js`
 * remplace ensuite `BananeGeometry3` par sa façade V4.6, qui ignore la demande
 * de grille : chargé après lui, le choix par la voie ne voyait aucun minimum
 * (défaut de la 4.7.8, KI-048). Il est donc chargé juste après la géométrie
 * GCV1 et avant la composition. */
importScripts('vendor/capture-core.js','src/core.js','src/settings.js','src/gauge.js','src/geometry.js',
 'src/brain.js','src/geometry-brain.js','src/gcv1-shadow-bootstrap.js','src/perf-phase.js',
 'src/geometry-candidate-v1.js','src/placement-convention.js','src/continuity-observer.js','src/level-crossing.js','src/lot-decision.js','src/gcv1-shadow.js',
 'src/gcv1-export.js','src/engine.js','src/storage.js','src/manual-session.js','src/native-session.js','src/export-cache.js','src/appuis-liste.js','src/liste-memoire.js');
const store=new BananeStorage3();let selectedTab=null,engine,manual,native,pollPromise=null,timing=null;
const VERSION=globalThis.BananeCore3?.VERSION||'4.9.5.3',VERSION_NAME=globalThis.BananeCore3?.VERSION_NAME||'4.9.5 test 3';
/* 4.7.21 — CERVEAU DE PLACEMENT ACTIF PAR DÉFAUT (direction, 26/09 : « tout
 * cela, je l'active à chaque fois »). Son état vivait en mémoire du service
 * worker et repartait éteint à chaque redémarrage de Chrome. Dans un lot
 * Pilote GCV1, il ne touche pas les positions posées (la sélection est celle
 * de GCV1) : il agit sur la proposition V4.6 consignée pour comparaison. Les
 * sélections sont autorisées en mode « Tenter », que le lot GCV1 force déjà. */
BananeGeometryBrain.configure({actif:true,autoriserSelectionSansPause:true});
const PAGE_FILES=['vendor/capture-core.js','vendor/lidar.js','src/core.js','src/settings.js','src/lod-signature.js','src/merge-clouds.js','src/native-lidar.js','src/native-page.js','src/adapter-page.js'];
const GCV1_ENGINE='geometry-candidate-v1',V46_ENGINE='v4.6';
/* B3 (C01, D-102) — COORDINATEUR DU LOT. Les transitions du lot ont un nom et
 * un seul point d'entrée chacune, autour du moteur épinglé (`src/engine.js`,
 * inchangé) et de ses enveloppes ci-dessous. `transition(nom, f)` appelle `f`
 * tout de suite et rend son résultat tel quel (aucune attente ajoutée, aucun
 * effet sur ESV ni sur les exports) ; le nom est noté dans `journal`, en
 * mémoire seulement (64 entrées), pour que l'ordre soit lisible et testé.
 *   demarrage    « Démarrer » (start)              pause        « Pause »
 *   reprise      « Reprendre » (resume)            arret        « Arrêter »
 *   rechargement F5 : lot rattaché à la page (dans la reprise)
 *   cut-suivant  validation et passage au cut suivant (validateAndNext)
 *   differe      cut différé ; départ d'ESV après un différé
 *   fin-de-lot   lot clos : dernier cut, sortie d'ESV, fin naturelle de la boucle
 *   erreur       refus ou échec d'une action du panneau, dit dans l'avis
 * 4.9.0.16 (test 15) : chaque entrée porte aussi son heure (`at`) ; les 64 dernières
 * partent dans le journal exporté (`transitionsLot`) : nom, identifiant du lot, état
 * du lot, heure. Rien d'autre (ni identité de cut, ni donnée d'ESV). */
const TRANSITIONS_LOT=Object.freeze(['demarrage','pause','reprise','arret','fin-de-lot','rechargement','cut-suivant','differe','erreur']);
const coordinateurLot={journal:[],
 transition(nom,f){if(!TRANSITIONS_LOT.includes(nom))throw Error('Transition du lot inconnue : '+nom);
  const b=engine?.s?.batch;this.journal.push({nom,lot:b?.id??null,etat:b?.state??null,at:new Date().toISOString()});if(this.journal.length>64)this.journal.shift();
  return f();}};
function liveGCV1Contract(){
 const contract=globalThis.BananeGCV1Shadow?.state?.().contract;
 if(!contract?.id||!contract?.geometrySha256)throw Error('Moteur GCV1 d’Orbite indisponible.');
 return {id:contract.id,geometrySha256:contract.geometrySha256};
}
function assertPilotContract(scope){
 if(scope?.geometryEngine!==GCV1_ENGINE)return;
 const live=liveGCV1Contract(),saved=scope.geometryContract;
 if(!saved||saved.id!==live.id||saved.geometrySha256!==live.geometrySha256)
  throw Error('Moteur GCV1 du lot indisponible ou incohérent : reprise refusée.');
}
// V4.5.7 — une seule page. Les vues sont un état interne de panel.html, plus
// des fenêtres distinctes : ouvrir le Natif depuis l'accueil laissait deux
// popups empilées. Le mode Correction est retiré.
const PANEL='panel.html';
const VIEWS=['home','native','automatic','assisted'];
const esvURL=url=>{try{const u=new URL(url);return u.origin==='https://esv.lidar.altametris.xyz'&&u.pathname.startsWith('/rails_validation/');}catch{return false;}};
// The URL filter for extension pages is not reliable without a tabs permission. Track
// windows created here and live extension-page ports instead of guessing from tabs.query({url}).
const panelWindows=new Map(),panelPorts=new Map();
/* 4.7.20 (piste H) — BANDEAU DANS ESV : une ligne d'état que le panneau compose
 * et que la page ESV affiche en bas, sans capter aucun clic. Il suit la
 * fenêtre Banane : fermée, il disparaît (la pastille « ouvrir » revient). La
 * préférence est gardée ; le texte ne vient que du panneau. */
let bandeau={on:false,text:'',ton:''};
/* 4.9.0.18 (AM-05, AM-06) : quand Écho a perdu sa page (F5, onglet parti), l'alerte vient du service worker lui-même,
 * panneau ouvert ou non ; sinon le texte ne vient que du panneau. */
const alerteEcho=()=>{const n=engine?.s?.native;if(!n||n.status!=='PAUSED_ADAPTER_UNRESPONSIVE'||!n.pageLost)return null;
 return {text:'ARIANE · ÉCHO · CAPTURE ARRÊTÉE · '+(n.pageLost.reason==='tab-closed'?'onglet fermé : Connecter puis Reprendre':n.pageLost.repriseEnCours?'page rechargée, reprise en cours…':'page rechargée : Connecter puis Reprendre'),ton:'rouge'};};
const bandeauVisible=()=>alerteEcho()||(bandeau.on&&panelPorts.size+panelWindows.size>0&&bandeau.text?{text:bandeau.text,ton:bandeau.ton}:null);
function launcherState(){const ids=new Set(panelWindows.keys());
 for(const [port,info] of panelPorts)ids.add(info.windowId??port);
 return {visible:ids.size===0,openWindows:ids.size,bandeau:ids.size?bandeauVisible():alerteEcho()};}
async function syncLauncher(){const state=launcherState(),tabs=await chrome.tabs.query({});
 await Promise.allSettled(tabs.filter(tab=>esvURL(tab.url)).map(tab=>chrome.tabs.sendMessage(tab.id,{kind:'launcher-visibility',visible:state.visible,bandeau:state.bandeau})));return state;}
async function call(action,...args){return callSur(selectedTab,action,...args);}
/* 4.8.0 — PAGE ESV RECHARGÉE OU FERMÉE pendant une commande (F5 de l'opérateur,
 * onglet fermé) : Chrome rejette par une erreur de connexion, que le moteur
 * classait en ERROR, non reprenable. Traduite ici, pour toutes les commandes,
 * en « Adaptateur ESV sans réponse » (pause reprenable), cause et remède dits. */
const PAGE_ABSENTE=/Could not establish connection|Receiving end does not exist|message (port|channel) (is )?closed|No tab with id|The frame was removed|Extension context invalidated|back\/forward cache/i;
function pageEsvAbsente(e){if(!PAGE_ABSENTE.test(e?.message||''))return e;
 return Object.assign(Error(`Adaptateur ESV sans réponse : page ESV rechargée ou fermée (${e.message}). Après un F5 : lot Orbite, clique sur Reprendre ; Écho, clique sur Connecter puis Reprendre. Onglet fermé : rouvre ESV puis clique sur Connecter.`),{code:'ESV_PAGE_ABSENTE'});}
async function callSur(tabId,action,...args){if(tabId===null)throw Error('Sélectionne un onglet ESV.');
 const tab=await chrome.tabs.get(tabId).catch(e=>{throw pageEsvAbsente(e);});
 /* D3 (4.8.5) : onglet sorti d'ESV pendant une lecture (ESV a quitté la page, ou
  * l'onglet a été emmené ailleurs) : erreur reprenable, comme une page absente. */
 if(!esvURL(tab.url))throw Object.assign(Error('Adaptateur ESV sans réponse : l’onglet sélectionné n’affiche plus ESV. Rouvre ESV dans cet onglet (ou F5), puis : lot Orbite, clique sur Reprendre ; Écho, clique sur Connecter puis Reprendre.'),{code:'ESV_PAGE_ABSENTE'});
 /* 4.7.19 (KI-059) : si Chrome signale lui-même un message trop gros, l'erreur
  * est dite en clair ; pour une capture, c'est une lecture à reprendre. */
 const trace=timing?.startRequest(action,args);
 const envoi=chrome.tabs.sendMessage(tabId,{kind:'page-command',action,args,...(trace?{traceId:trace.id}:{})});
 /* B1 (D-095) : la capture part, la page travaille ; l'hypothèse en ombre du cut précédent se conclut pendant ce temps. */
 if(action==='capture'&&b1File.length)setTimeout(b1Vider,0);
 const reply=await envoi.catch(e=>{
   timing?.endRequest(trace,null,e);
   if(!/maximum allowed size/i.test(e?.message||''))throw pageEsvAbsente(e);
   throw Error((action==='capture'?'Lecture LiDAR instable : ':'')+`réponse de l’adaptateur trop grosse pour un message Chrome (${action} ; limite 64 Mo).`+(action==='capture'?' Attends la fin du chargement ou rapproche la vue du cut, puis clique sur Reprendre.':''));});
 timing?.endRequest(trace,reply?.result,reply?.error||(!reply||!Object.hasOwn(reply,'result')?'missing-result':null),reply?.diagnostic);
 if(reply?.diagnostic&&!['state','ping','nativeSnapshot','nativeStart','nativePause','nativeResume','nativeFinish'].includes(action))await engine.event('adapter-result',{...reply.diagnostic,error:reply.error||null});
 if(reply?.error)throw Error(reply.error);
 if(!reply||!Object.hasOwn(reply,'result'))throw Error('Aucune réponse de l’adaptateur ESV.');return reply.result;}
/* D4 (4.8.5, D-061) : le relevé passif d'ESV, rangé au journal (`esv-releve`)
 * directement dans le stockage : ni la capture, ni l'état du moteur (épinglé),
 * ni sa fenêtre d'événements n'en dépendent ; une écriture qui échoue ne bloque
 * rien. Seuls les champs du relevé sont gardés, vérifiés ; l'identité est celle
 * que la page a lue (complétée comme celle des autres événements), sinon aucune. */
const entierOuNul=v=>Number.isInteger(v)?v:null;
function rangerReleve(r){try{if(!r||typeof r!=='object')return;const K=globalThis.BananeCore3;
 const e={eventId:K.uid(),timestamp:new Date().toISOString(),type:'esv-releve',
   at:typeof r.at==='string'?r.at:null,requestId:typeof r.requestId==='string'?r.requestId:null,
   identity:Number.isInteger(r.identity?.cut)?K.completeIdentity({pageId:typeof r.identity.pageId==='string'?r.identity.pageId:undefined,part:entierOuNul(r.identity.part),cut:r.identity.cut}):null};
 if(Number.isInteger(r.demande?.cut))e.demande={part:entierOuNul(r.demande.part),cut:r.demande.cut};
 if(Number.isInteger(r.compteur?.traites)&&Number.isInteger(r.compteur?.total))e.compteur={traites:r.compteur.traites,total:r.compteur.total};
 for(const k of ['compteurIllisible','textesTronques'])if(r[k]===true)e[k]=true;
 for(const k of ['compteursVus','objetsRail','cutsAffiches','cutsAffichesVus'])if(Number.isInteger(r[k]))e[k]=r[k];
 /* D-062 : le dernier relevé pendant un lot, quel qu'il soit, remplace le précédent
  * (jamais réemployé) ; le départ ne s'en sert que s'il est celui du cut N. */
 const b=engine.s.batch;if(b?.state==='RUNNING')b.totalReleve={part:e.identity?.part??null,cut:e.identity?.cut??null,...totalPartie(e),traites:(e.compteursVus??1)>1?null:(e.compteur?.traites??null),at:e.at||e.timestamp};
 void Promise.resolve(store.putEvent(e)).catch(()=>{});}catch{}}
/* V1 (test 2, D-077/D-078) — RANGEMENT DE L'OBSERVATEUR PASSIF DE LA PAGE ESV.
 * Le pont relaie ce que l'observateur de la page a vu (écriture de validation, pages de
 * la liste des coupes, fichiers de points). Ici : JOURNALISATION SEULE.
 *  - rien n'est rangé hors séance (lot Orbite non clos, session Écho active) ni si le
 *    réglage `observateurPassif.actif` est faux : réponse `accept:false` ;
 *  - le message vient de la page (source non fiable) : chaque entrée est revalidée champ
 *    par champ (liste blanche, nombres finis, chaînes bornées) ;
 *  - rangé comme `esv-releve` (`store.putEvent`, sans attente), jamais par `engine.event` :
 *    ni état, ni décision, ni commande ne dépendent de ces événements ; un échec
 *    d'écriture est compté et dit par un jalon « gap » ;
 *  - borne par séance : au-delà, un seul jalon « gap ». */
const OBS_REASONS=new Set(['ring-overflow','bridge-queue','oversize','unserializable','store-rejected','rejected','session-cap']);
const obsState={lost:0,perSeance:new Map()};
/* Grâce de réception après l'arrêt au dernier cut du lot. La dernière validation du lot (Ctrl+Entrée en place) clôt le lot
 * (`closeAtExit`, état STOPPED) avant que son écriture PUT ait été relayée : l'observateur la poste à la fin de l'écriture, le pont
 * la tient 250 ms avant de l'envoyer (mesuré : 158 à 343 ms entre la fin de l'écriture et sa réception ; lots 7 à 10, 4 sur 4 perdues).
 * Pendant cette courte fenêtre, et pour ce seul lot, le rangement accepte encore ce que l'observateur RELAIE : rien n'est
 * demandé à ESV, la séance n'est pas rouverte (`launcher-status` ne l'annonce pas). Date absente, illisible ou future : jamais devinée.
 * OBS-2 (relecture du test 3) : cela comprend une requête COMMENCÉE après la fin du lot (validation ou navigation dans ESV
 * juste après « Arrêter ») ; un filtre sur la date de début perdrait de vraies écritures (vrai lot : PUT commencé après
 * l'acceptation 63 fois sur 208, jusqu'à +1,5 s). Chaque entrée rangée pendant la grâce porte donc `recuEnGrace:true` et
 * `debutMoinsFinLotMs` (début de la requête, horloge de la page − fin du lot, horloge du service worker ; écart d'horloge
 * non corrigé ; null sans date de début) : l'analyse les sépare. */
const OBS_GRACE_MS=5000,OBS_CLOS=['STOPPED','COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS'];
/* OBS-4 (relecture du test 3) : « Arrêter » pendant une action prolonge la grâce tant que la boucle finit l'action de ce
 * lot, mais 120 s au plus après l'arrêt (sans plafond : mesuré accepté 10 min après) ; ensuite, seuls les 5 s après la
 * sortie de la boucle (jalon `batch-state`) comptent. */
const OBS_TACHE_MAX_MS=120000;
/* Test 3 — MÊME GRÂCE après l'arrêt MANUEL (« Arrêter ») et après la fin naturelle du lot (COMPLETED, ou
 * FINISHED_WITH_UNCONFIRMED_ACTIONS : même fin, nommée par `closingState` selon la confirmation serveur). `src/engine.js`
 * (épinglé) ne date ni l'un ni l'autre : l'instant est relevé ICI, quand le service worker voit la fin (clic « Arrêter »
 * sur un lot non clos ; sortie de la boucle du moteur, jalon `batch-state`). Clé : l'identifiant du lot, aucun autre lot
 * n'en hérite. Le contexte de mesure du lot est gardé avec : si un NOUVEAU lot démarre pendant la grâce, ce que la page a
 * vu AVANT son début reste à l'ancien ; ce qu'elle a vu après, ou sans date, va au nouveau (jamais l'inverse). Le vidage
 * du cache des exports est refusé tant qu'une grâce court, ou si une grâce a couru depuis l'instantané de l'export
 * (sinon une écriture arrivée après l'instantané resterait seule, sans son lot). Rien de demandé à ESV. */
const obsFins=new Map();
/* T3D-7 / OBS-3 (relecture du test 3) : les fins relevées (instant, cause, contexte de mesure) sont aussi gardées dans
 * chrome.storage.session : un redémarrage du service worker pendant la grâce ne les perd plus (relues avant `ready`).
 * Sans chrome.storage.session (navigateur ancien) : mémoire seule, comme avant. Jamais dans chrome.storage.local. */
const OBS_FINS_CLE='banane49ObsFins';
function sauverObsFins(){try{const s=chrome?.storage?.session;if(s?.set)Promise.resolve(s.set({[OBS_FINS_CLE]:[...obsFins]})).catch(()=>{});}catch{/* mémoire seule */}}
async function restaurerObsFins(){try{const s=chrome?.storage?.session;if(!s?.get)return;const v=(await s.get(OBS_FINS_CLE))?.[OBS_FINS_CLE];if(!Array.isArray(v))return;
 for(const x of v){const [id,f]=Array.isArray(x)?x:[];if(typeof id==='string'&&Number.isFinite(f?.at)&&!obsFins.has(id))obsFins.set(id,{at:f.at,cause:typeof f.cause==='string'?f.cause:null,ctx:f.ctx&&typeof f.ctx==='object'?f.ctx:{}});}
 while(obsFins.size>4)obsFins.delete(obsFins.keys().next().value);}catch{/* rien de relu : comme avant */}}
function obsContexte(){try{const v=timing?.context?.()||timing?.batchContext?.();return v?{sessionId:v.sessionId??null,batchId:v.batchId??null,visitId:v.visitId??null,clockId:timing?.clockId??null}:{};}catch{return {};}}
function poserFin(b,at,cause){const c=obsContexte(),prev=obsFins.get(b.id);
 const ctx=c.batchId===b.id?c:prev?.ctx||{sessionId:engine?.s?.sessionId??null,batchId:b.id,visitId:null,clockId:timing?.clockId??null};
 obsFins.delete(b.id);obsFins.set(b.id,{at,cause,ctx});while(obsFins.size>4)obsFins.delete(obsFins.keys().next().value);sauverObsFins();}
/* D1 (relecture finale de la 4.9.0) : fin de lot HORS de la boucle du moteur (« Clôturer le résultat incertain », fin de
 * partie après un différé, SKIP explicite du dernier cut) : aucun jalon `batch-state`, la mesure V1 du lot restait ouverte
 * et le vidage du cache était refusé indéfiniment. Elle est close ici, comme pour « Arrêter » hors tâche (`operatorAfter`),
 * avec l'état réel du lot ; jamais pendant une tâche (la boucle la clôt elle-même), jamais deux fois. */
function cloreMesureHorsBoucle(){try{const b=engine?.s?.batch,t=timing?.batch;
 if(b?.id&&!engine.task&&OBS_CLOS.includes(b.state)&&t?.id===b.id&&!t.closed)timing.closeBatch(b.state);}catch{/* mesure seule : jamais bloquant */}}
function marquerFinLot(b,cause){if(b?.id&&engine?.s?.mode==='automatic-test'&&OBS_CLOS.includes(b.state))poserFin(b,Date.now(),cause);}
/* Sortie de la boucle du moteur (`batch-state`, émis dans son `finally`) : fin naturelle, ou fin de l'action en cours après « Arrêter ». */
function finVueParLaBoucle(state){const b=engine?.s?.batch;if(!b?.id||state!==b.state)return;
 if(state==='COMPLETED'||state==='FINISHED_WITH_UNCONFIRMED_ACTIONS')coordinateurLot.transition('fin-de-lot',()=>marquerFinLot(b,'fin-naturelle'));
 else if(state==='STOPPED'&&!b.stoppedAtEnd&&obsFins.get(b.id)?.cause==='arret-manuel')marquerFinLot(b,'arret-manuel');}
/* Avant un nouveau lot : l'ancien, clos, garde son instant de fin (arrêt au dernier cut compris) et son contexte. */
function retenirLotClos(){const b=engine?.s?.batch;if(!b?.id||engine?.s?.mode!=='automatic-test'||!OBS_CLOS.includes(b.state))return;
 const at=finDuLot(b);if(Number.isFinite(at))poserFin(b,at,obsFins.get(b.id)?.cause||'dernier-cut');}
/* Instant de fin du lot (ms) : arrêt au dernier cut = `stoppedAtEnd.at` (absente ou illisible : NaN, jamais devinée) ; sinon fin relevée ici. */
function finDuLot(b){if(b.state==='STOPPED'&&b.stoppedAtEnd)return Date.parse(b.stoppedAtEnd.at);const f=obsFins.get(b.id);return f?f.at:NaN;}
const dansFenetre=(at,now)=>{const age=now-at;return Number.isFinite(age)&&age>=-1000&&age<=OBS_GRACE_MS;};
function dansGrace(b,now=Date.now()){if(dansFenetre(finDuLot(b),now))return true;
 /* « Arrêter » pendant une action : la boucle du moteur finit l'action en cours de CE lot (comme la mesure V1, `runtimeContext`). */
 const f=obsFins.get(b.id),age=now-(f?.at??NaN);
 return b.state==='STOPPED'&&!b.stoppedAtEnd&&f?.cause==='arret-manuel'&&!!engine?.task&&Number.isFinite(age)&&age>=-1000&&age<=OBS_TACHE_MAX_MS;}
function seanceObservateur({grace=false}={}){
 const b=engine?.s?.batch;
 if(engine?.s?.mode==='automatic-test'&&b&&!OBS_CLOS.includes(b.state))return 'lot:'+(b.id||'');
 if(grace&&engine?.s?.mode==='automatic-test'&&b&&OBS_CLOS.includes(b.state)&&dansGrace(b))return 'lot:'+(b.id||'');
 return manual?.active?.()?'ecoute-manuelle':native?.active?.()?'ecoute-native':null;}
/* Lot précédent encore en grâce quand la séance est celle d'un lot plus récent : { seance, ctx, debut } ou null. */
function ancienLotEnGrace(seance){const b=engine?.s?.batch;if(!b?.id||seance!=='lot:'+b.id)return null;
 const debut=Date.parse(b.startedAt),now=Date.now();if(!Number.isFinite(debut))return null;let best=null;
 for(const [id,f] of obsFins)if(id!==b.id&&f.at<=debut+1000&&dansFenetre(f.at,now)&&(!best||f.at>best.at))best={id,...f};
 return best?{seance:'lot:'+best.id,ctx:best.ctx,debut,fin:best.at}:null;}
/* Une grace a-t-elle couru entre `depuis` et maintenant ? 'en-cours', 'depuis-instantane' ou null (vidage du cache). */
function graceObservations(depuis=Date.now()){const now=Date.now(),b=engine?.s?.batch,fins=[...obsFins.values()].map(f=>f.at);
 if(engine?.s?.mode==='automatic-test'&&b&&OBS_CLOS.includes(b.state)){if(dansGrace(b,now))return 'en-cours';fins.push(finDuLot(b));}
 if(fins.some(at=>dansFenetre(at,now)))return 'en-cours';
 return fins.some(at=>Number.isFinite(at)&&at+OBS_GRACE_MS>=depuis&&at-1000<=now)?'depuis-instantane':null;}
const obsInt=(v,max=1e12)=>Number.isInteger(v)&&v>=0&&v<=max?v:null;
const obsNum=v=>Number.isFinite(v)&&Math.abs(v)<1e15?v:null;
const obsStr=(v,n)=>typeof v==='string'&&v.length<=n?v:null;
const obsKey=v=>typeof v==='string'&&v.length<=80&&/^[\w.+\-]+$/.test(v)?v:null;
const obsOutcome=v=>['done','error','abort','timeout'].includes(v)?v:null;
/* 4.9.5.3 (S6) : sous-objets relevés par l'observateur, relus champ par champ (source non fiable). */
function obsStatuts(o){if(!o||typeof o!=='object'||Array.isArray(o))return null;const out={};let n=0;
 for(const k of Object.keys(o)){if(n>=8||!/^\d{1,3}$/.test(k))continue;const v=obsInt(o[k],1e7);if(v!==null){out[k]=v;n++;}}return out;}
function obsGardes(g){if(!g||typeof g!=='object')return null;const ext=e=>e&&typeof e==='object'?{n:obsInt(e.n,1e7),...(e.min!==undefined?{min:obsNum(e.min),max:obsNum(e.max)}:{})}:null;
 const types={};let n=0;if(g.RailType?.valeurs&&typeof g.RailType.valeurs==='object')for(const k of Object.keys(g.RailType.valeurs)){if(n>=8||k.length>24||!/^[\w.\-]+$/.test(k))continue;const v=obsInt(g.RailType.valeurs[k],1e7);if(v!==null){types[k]=v;n++;}}
 const succes={};n=0;if(g.Success&&typeof g.Success==='object')for(const k of Object.keys(g.Success)){if(n>=8||k.length>40||!/^[\w.\-]+$/.test(k))continue;succes[k]={n:obsInt(g.Success[k]?.n,1e7),vrai:obsInt(g.Success[k]?.vrai,1e7)};n++;}
 return {RailSpacing:ext(g.RailSpacing),TrajAzimuth:ext(g.TrajAzimuth),RailType:{n:obsInt(g.RailType?.n,1e7),valeurs:types},PK:{n:obsInt(g.PK?.n,1e7)},Success:succes};}
function obsBody(b){if(!b||typeof b!=='object'||Array.isArray(b))return null;const out={};let n=0;
 for(const k of Object.keys(b)){const v=b[k];if(n>=24||k.length>40||!/^[\w.\-]+$/.test(k))continue;
  if(typeof v==='number'&&Number.isFinite(v)||typeof v==='boolean'||typeof v==='string'&&v.length<=32){out[k]=v;n++;}}
 return out;}
function obsFields(x){
 const time={startedEpochMs:obsNum(x.startedEpochMs),endedEpochMs:obsNum(x.endedEpochMs),durationMs:obsNum(x.durationMs)};
 switch(x.kind){
  case 'write':return {kind:'write',via:'xhr',urlClass:'rail-pair-write',method:obsStr(x.method,8),status:obsInt(x.status,999),outcome:obsOutcome(x.outcome),attempt:obsInt(x.attempt,1000),
   railPairId:obsStr(x.railPairId,80)&&/^(?!\/)(?!.*\.\.)[\w.+\-/]+$/.test(x.railPairId)?x.railPairId:null,bodyKeys:obsInt(x.bodyKeys,1e6),body:obsBody(x.body),rowIndex:obsInt(x.rowIndex,1e7),...time};
  case 'list-page':{const c=x.counts&&typeof x.counts==='object'?{valid:obsInt(x.counts.valid),invalid:obsInt(x.counts.invalid),skipped:obsInt(x.counts.skipped)}:null;
   return {kind:'list-page',via:'xhr',urlClass:'rail-list',listKey:obsKey(x.listKey),status:obsInt(x.status,999),outcome:obsOutcome(x.outcome),chars:obsInt(x.chars,1e9),rows:obsInt(x.rows,1e7),counts:c,
    skipped:['oversize','unreadable'].includes(x.skipped)?x.skipped:null,basis:'row-string-values',...time};}
  case 'list-summary':{const c=x.counts&&typeof x.counts==='object'?{valid:obsInt(x.counts.valid),invalid:obsInt(x.counts.invalid),skipped:obsInt(x.counts.skipped)}:null;
   return {kind:'list-summary',listKey:obsKey(x.listKey),pages:obsInt(x.pages,1e6),okPages:obsInt(x.okPages,1e6),rows:obsInt(x.rows,1e8),chars:obsInt(x.chars,1e10),counts:c,
    firstStartedEpochMs:obsNum(x.firstStartedEpochMs),lastEndedEpochMs:obsNum(x.lastEndedEpochMs),durationMs:obsNum(x.durationMs),beforeSession:typeof x.beforeSession==='boolean'?x.beforeSession:null};}
  case 'fetch-rails':return {kind:'fetch-rails',n:obsInt(x.n,1e7),startedEpochMs:obsNum(x.startedEpochMs),endedEpochMs:obsNum(x.endedEpochMs),windowMs:obsInt(x.windowMs,1e5)};
  case 'observer':return {kind:'observer',version:obsInt(x.version,1000),world:x.world==='MAIN'?'MAIN':null,installedBeforePageScripts:typeof x.installedBeforePageScripts==='boolean'?x.installedBeforePageScripts:null,
   readyState:['loading','interactive','complete'].includes(x.readyState)?x.readyState:null,scriptsAtInstall:obsInt(x.scriptsAtInstall,1e6),enabled:typeof x.enabled==='boolean'?x.enabled:null,
   afterDenial:typeof x.afterDenial==='boolean'?x.afterDenial:null,dropped:obsInt(x.dropped,1e9),ignored:obsInt(x.ignored,1e12)};
  case 'resource':return {kind:'resource',class:'point-resource',n:obsInt(x.n,1e7),bytes:obsInt(x.bytes,1e12),startedEpochMs:obsNum(x.startedEpochMs),endedEpochMs:obsNum(x.endedEpochMs),windowMs:obsInt(x.windowMs,1e5),
   /* 4.9.5.3 (S6) : statut et durée des nœuds ept-data (champs absents si le relevé est coupé). */
   ...(x.ept!==undefined?{ept:obsInt(x.ept,1e7),statuts:obsStatuts(x.statuts),sansStatut:obsInt(x.sansStatut,1e7),echecs:obsInt(x.echecs,1e7),echecsCumules:obsInt(x.echecsCumules,1e9),dureeTotMs:obsNum(x.dureeTotMs),dureeMaxMs:obsNum(x.dureeMaxMs)}:{})};
  case 'list-fields':return {kind:'list-fields',listKey:obsKey(x.listKey),rows:obsInt(x.rows,1e7),champs:obsInt(x.champs,1e4),
   noms:Array.isArray(x.noms)?x.noms.slice(0,64).filter(n=>typeof n==='string'&&n.length<=40&&/^[\w.\-]+$/.test(n)):[],gardes:obsGardes(x.gardes)};
  case 'esv-event':return ['railPairSelected','railPairUpdated','railPairSeen','loading','newPart'].includes(x.nom)
   ?{kind:'esv-event',nom:x.nom,args:Array.isArray(x.args)?x.args.slice(0,6).map(v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='boolean'?v:typeof v==='string'&&v.length<=24?v:null):[],pageMs:obsNum(x.pageMs),perdus:obsInt(x.perdus,1e6)}:null;
  case 'diag-compteur-bloque':return {kind:'diag-compteur-bloque',valeur:obsInt(x.valeur,1e6),cuts:obsInt(x.cuts,1000),cut:obsInt(x.cut,1e8),pageMs:obsNum(x.pageMs)};
  case 'gap':return {kind:'gap',lost:obsInt(x.lost,1e9),reason:OBS_REASONS.has(x.reason)?x.reason:'rejected',of:obsStr(x.of,24)};
 }return null;}
/* 4.9.0.18 (KI-068) : événements et visites du lot seulement (ni Écho, ni Correction : `nativeSessionId`, `manualSessionId`,
 * `observationPeriodId`, `railSnapshots`), avec le compte de ce qui est écarté. */
const horsEcho=x=>!x||!(x.nativeSessionId||x.manualSessionId||x.observationPeriodId||x.railSnapshots);
async function lotSeul(){const events=await store.all('events'),records=await store.all('records'),e=events.filter(horsEcho),r=records.filter(horsEcho);
 const exclus=events.length-e.length+records.length-r.length;return {events:e,records:r,scope:exclus?{exportScope:{lotOnly:true,excludedEchoItems:exclus,rule:'KI-068'}}:{}};}
/* 4.9.5.3 (S6) — AVIS DE CONTRAT ESV, EMPREINTE À « CONNECTER », AUDIT SERVEUR AU RECHARGEMENT DE LA LISTE. LECTURE SEULE : rien n'est
 * envoyé à ESV, rien ne change dans la pose, la validation ni la navigation ; un avis est une ligne de texte au panneau et un
 * événement du journal (`avis-contrat-esv`). Une ligne par motif et par vie du service worker.
 *  - `fetch-rails` : l'observateur compte les requêtes `fetch` de chemin « rails » (non enveloppé, jamais lu). Aujourd'hui toujours 0 :
 *    s'il devient non nul, les écritures d'ESV ont changé de voie et D3, B1 (fraîcheur) et la preuve d'écriture seraient muets ;
 *  - empreinte du contrat (`ping` de « Connecter », adaptateur) : boutons de navigation (identifiants), classes de rail, présence des
 *    écouteurs jQuery par événement, versions de jQuery et de Potree. Hachée (8 caractères), gardée avec la précédente DE CE MÊME ONGLET
 *    (4.9.5.4, D-139 : ni libellés de boutons ni nombre d'écouteurs, qui dépendent de l'état de la page) ; un changement dit lesquels des
 *    éléments ont bougé ;
 *  - audit serveur : chaque lecture complète de la liste d'une partie (au F5, ou au début de la séance) donne les validés côté serveur ;
 *    leur écart avec la lecture précédente est comparé aux validations qu'Ariane a faites entre les deux (événements
 *    `validation-accepted` de la partie) : `audit-serveur` (attendus, constatés, écart). Les validations d'un humain, ou un refus
 *    du serveur, se voient dans l'écart ; aucune conclusion n'est tirée ici. */
const avisContrat={lignes:[],vus:new Set()};
const releveOn=nom=>globalThis.BananeSettings?.releves?.[nom]!==false;
function journalerSimple(type,champs){try{const K=globalThis.BananeCore3;
 void Promise.resolve(store.putEvent({eventId:K.uid(),timestamp:new Date().toISOString(),type,schema:1,sessionId:engine?.s?.sessionId??null,batchId:engine?.s?.batch?.id??null,...champs})).catch(()=>{});}catch{/* le journal n'est pas critique */}}
function avisContratEsv(motif,texte,detail={}){try{if(avisContrat.vus.has(motif))return;avisContrat.vus.add(motif);
 avisContrat.lignes.push(texte);while(avisContrat.lignes.length>4)avisContrat.lignes.shift();journalerSimple('avis-contrat-esv',{motif,texte,...detail});}catch{}}
/* Copie bornée d'une valeur venue de la page (source non fiable) : nombres finis, booléens, chaînes courtes, objets et listes bornés. */
function reduireContrat(v,profondeur=0){
 if(typeof v==='number')return Number.isFinite(v)?v:null;if(typeof v==='boolean')return v;if(typeof v==='string')return v.slice(0,80);
 if(profondeur>=4||!v||typeof v!=='object')return null;
 if(Array.isArray(v))return v.slice(0,16).map(x=>reduireContrat(x,profondeur+1));
 const out={};let n=0;for(const k of Object.keys(v)){if(n>=24)break;if(k.length>48)continue;out[k]=reduireContrat(v[k],profondeur+1);n++;}return out;}
function aplatirContrat(v,prefixe='',out={}){
 if(v&&typeof v==='object')for(const k of Object.keys(v))aplatirContrat(v[k],prefixe?prefixe+'.'+k:k,out);else out[prefixe]=v;return out;}
/* 4.9.5.4 (D-139) — L'EMPREINTE PRÉCÉDENTE EST RANGÉE PAR ONGLET. Jusqu'à la 4.9.5.3, une seule empreinte était gardée pour tout le
 * navigateur : deux fenêtres ESV dans des états différents se la disputaient et produisaient de fausses alertes en alternance. Chaque onglet
 * n'est comparé qu'à lui-même (numéro d'onglet), dans chrome.storage.session — un numéro d'onglet n'a de sens que dans la session du navigateur
 * (à défaut de storage.session : storage.local, borné à 8 onglets). Une empreinte de la 4.9.5.3 (clé `banane53Contrat`, autre forme) n'est
 * jamais relue. Ne sont plus comparés ni les libellés de boutons ni le nombre d'écouteurs (l'adaptateur les met à part, dans `etat`, que le journal
 * garde sans le comparer). Aucune requête ESV : tout vient du second `ping` de « Connecter ». */
const CLE_CONTRATS='banane54Contrats',CONTRATS_MAX=8;
const stockContrats=()=>chrome?.storage?.session?.get?chrome.storage.session:chrome?.storage?.local;
async function contratsLire(S){try{const v=(await S.get(CLE_CONTRATS))?.[CLE_CONTRATS];return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}}
/* Un onglet fermé est oublié (son numéro ne reviendra pas dans cette session ; en repli sur storage.local, il pourrait être réattribué). */
async function contratOublier(tabId){try{const S=stockContrats();if(!S?.get||!Number.isInteger(tabId))return;
 const tous=await contratsLire(S);if(!(String(tabId) in tous))return;delete tous[String(tabId)];await S.set({[CLE_CONTRATS]:tous});}catch{/* relevé seulement */}}
async function contratNoter(c,tabId){try{
 if(!releveOn('empreinte')||!c||typeof c.hash!=='string'||!/^[0-9a-f]{8}$/.test(c.hash))return;
 const S=stockContrats(),detail=reduireContrat(c.detail),etat=reduireContrat(c.etat),cle=Number.isInteger(tabId)?String(tabId):'?';
 const tous=await contratsLire(S),prev=tous[cle]||null;
 const change=!!prev&&typeof prev.hash==='string'&&prev.hash!==c.hash;
 const a=aplatirContrat(prev?.detail||{}),b=aplatirContrat(detail||{}),bouge=change?[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])).slice(0,12):[];
 journalerSimple('contrat-esv',{hash:c.hash,precedent:prev?.hash??null,change,changements:bouge,detail,etat,onglet:Number.isInteger(tabId)?tabId:null});
 try{tous[cle]={hash:c.hash,at:new Date().toISOString(),version:VERSION,detail};
  const cles=Object.keys(tous).sort((x,y)=>String(tous[x]?.at||'').localeCompare(String(tous[y]?.at||'')));while(cles.length>CONTRATS_MAX)delete tous[cles.shift()];
  await S.set({[CLE_CONTRATS]:tous});}catch{}
 for(const m of [...avisContrat.vus])if(m.startsWith('empreinte:')){avisContrat.vus.delete(m);}   // un nouveau « Connecter » réévalue l'avis d'empreinte
 avisContrat.lignes=avisContrat.lignes.filter(l=>!l.startsWith('ESV n’a plus le même contrat'));
 if(change)avisContratEsv('empreinte:'+c.hash,`ESV n’a plus le même contrat qu’à la dernière connexion (empreinte ${prev.hash}, puis ${c.hash}${bouge.length?' ; ce qui a bougé : '+bouge.slice(0,4).join(', '):''}). Rien ne s’arrête ; préviens-moi avant de lancer un lot.`,{hash:c.hash,precedent:prev.hash,changements:bouge});
}catch{/* relevé seulement */}}
const CLE_LECTURES='banane53Lectures',lectures={pend:new Map(),memoire:null};
async function lecturesLire(){if(lectures.memoire)return lectures.memoire;
 try{const v=(await chrome.storage.local.get(CLE_LECTURES))?.[CLE_LECTURES];lectures.memoire=v&&typeof v==='object'?v:{};}catch{lectures.memoire={};}return lectures.memoire;}
async function validationsAriane(partie,deMs,aMs){
 const evs=await store.all('events');let n=0;
 for(const e of evs){if(e?.type!=='validation-accepted')continue;const t=Date.parse(e.timestamp);
  if(Number.isFinite(t)&&t>deMs&&t<=aMs&&(partie===null||e.identity?.part===partie))n++;}return n;}
async function auditLecture(p){
 if(!releveOn('auditServeur')||!p||!p.listKey||p.listKey==='undefined'||!(p.rows>=2)||!Number.isFinite(p.atMs))return;
 const m=await lecturesLire(),prev=m[p.listKey];
 m[p.listKey]={atMs:p.atMs,valid:p.valid,invalid:p.invalid,rows:p.rows};
 const cles=Object.keys(m);while(cles.length>8)delete m[cles.shift()];
 try{await chrome.storage.local.set({[CLE_LECTURES]:m});}catch{}
 if(!prev||!Number.isFinite(prev.atMs)||p.atMs<=prev.atMs)return;
 const cx=p.ctx||contexteAudit(),partie=cx.partie;
 let attendus=null;if(partie!==null)try{attendus=await validationsAriane(partie,prev.atMs,p.atMs);}catch{attendus=null;}
 const constates=p.valid-prev.valid;
 journalerSimple('audit-serveur',{listKey:p.listKey,partie,partieSource:cx.source,depuis:new Date(prev.atMs).toISOString(),jusqua:new Date(p.atMs).toISOString(),
  validesAvant:prev.valid,validesApres:p.valid,invalidesAvant:prev.invalid,invalidesApres:p.invalid,attendus,constates,ecart:attendus===null?null:constates-attendus,
  avantSeance:p.avantSeance===true,pages:p.pages??null,...(cx.nativeSessionId?{nativeSessionId:cx.nativeSessionId}:{})});}
/* 4.9.5.4 (D-141, D-134) — LA PARTIE ET LA SÉANCE DE LA LISTE LUE, relevées au moment où la liste est vue (pas 4 s plus tard, au silence).
 * Avant : la partie venait de `batch.scope.part` même pour un lot clos depuis longtemps — un événement portait « partie 29 » avec les totaux de la
 * liste de la partie 12 affichée dans ESV. Maintenant, par ordre : un lot ouvert (en cours ou en pause) ; la séance Écho (sa dernière visite :
 * jamais le lot clos, ni une partie devinée avant la première visite) ; un lot tout juste clos, encore en grâce de l'observateur ; l'identité de la
 * capture en cours. Sinon `partie:null` et aucune validation attendue (elles ne se comparent qu'à la liste de la même partie). Pendant Écho,
 * l'événement porte `nativeSessionId` : il sort dans l'export d'Écho (filtré sur ce champ) et plus dans le journal d'Orbite, comme les observations. */
function contexteAudit(){
 const b=engine?.s?.batch,n=engine?.s?.native,echo=!!native?.active?.(),entier=v=>Number.isInteger(v)?v:null;
 if(b&&!OBS_CLOS.includes(b.state)&&entier(b.scope?.part)!==null)return {partie:b.scope.part,source:'lot',nativeSessionId:echo?n?.id??null:null};
 if(echo){const part=entier(n?.current?.identity?.part)??entier((n?.visits||[]).at(-1)?.identity?.part);
  return {partie:part,source:part!==null?'echo':null,nativeSessionId:n?.id??null};}
 if(b&&entier(b.scope?.part)!==null&&dansGrace(b))return {partie:b.scope.part,source:'lot',nativeSessionId:null};
 const cap=entier(engine?.s?.before?.identity?.part);
 return {partie:cap,source:cap!==null?'capture':null,nativeSessionId:null};}
/* Une observation rangée : avis `fetch-rails`, pages de liste (lecture complète = silence de 4 s après la dernière page). */
function relevesObservation(f,observer){
 if(f.kind==='fetch-rails'&&releveOn('avisFetch')&&Number.isInteger(f.n)&&f.n>0)
  avisContratEsv('fetch-rails',`ESV a changé : des requêtes de rails passent par « fetch » (${f.n} vue${f.n>1?'s':''}), qu’Ariane ne voit pas. Les validations ne sont plus contrôlées : préviens-moi avant de lancer un lot.`,{n:f.n});
 else if(f.kind==='list-page'&&releveOn('auditServeur')&&f.listKey&&f.status>=200&&f.status<300&&f.counts&&Number.isInteger(f.rows)){
  const k=String(observer)+'|'+f.listKey,p=lectures.pend.get(k)||{listKey:f.listKey,pages:0,rows:0,valid:0,invalid:0,atMs:null,timer:null};
  p.ctx=contexteAudit();p.pages++;p.rows+=f.rows;p.valid+=f.counts.valid||0;p.invalid+=f.counts.invalid||0;if(Number.isFinite(f.endedEpochMs))p.atMs=Math.max(p.atMs??0,f.endedEpochMs);
  clearTimeout(p.timer);p.timer=setTimeout(()=>{lectures.pend.delete(k);void auditLecture(p).catch(()=>{});},Number.isFinite(globalThis.BananeSettings?.releves?.auditSilenceMs)?globalThis.BananeSettings.releves.auditSilenceMs:4000);lectures.pend.set(k,p);}
 else if(f.kind==='list-summary'&&f.beforeSession===true&&f.counts&&Number.isInteger(f.rows)&&Number.isFinite(f.lastEndedEpochMs))
  void auditLecture({listKey:f.listKey,pages:f.pages,rows:f.rows,valid:f.counts.valid||0,invalid:f.counts.invalid||0,atMs:f.lastEndedEpochMs,avantSeance:true,ctx:contexteAudit()}).catch(()=>{});}
/* 4.9.5.3 (S6) : relevés de l'observateur de la page coupés par les réglages (`releves`, `esvEvents`) : noms rendus au pont. */
function relevesOff(){const R=globalThis.BananeSettings?.releves||{},E=globalThis.BananeSettings?.esvEvents||{},o=[];
 if(R.ressources===false)o.push('ressources');if(R.champsListe===false)o.push('champsListe');if(R.compteurBloque?.actif===false)o.push('compteurBloque');if(E.ombre===false)o.push('esvEvents');return o;}
function rangerObservations(m){try{
 if(globalThis.BananeSettings?.observateurPassif?.actif===false)return {accept:false,enabled:false,reason:'setting-off'};
 const seance=seanceObservateur({grace:true});if(!seance)return {accept:false,reason:'no-session'};
 if(typeof m.observer!=='string'||m.observer.length>80||!Array.isArray(m.entries)||m.entries.length>100)return {accept:true,stored:0,reason:'malformed'};
 const K=globalThis.BananeCore3,cfg=globalThis.BananeSettings?.observateurPassif||{},cap=cfg.entreesParSeanceMax||20000,maxChars=cfg.caracteresParEntree||4096;
 const receivedMs=(()=>{try{return timing?.now?timing.now():performance.now();}catch{return null;}})(),timeOrigin=timing?.origin??(typeof performance!=='undefined'?performance.timeOrigin:null);
 /* OBS-2 : séance tenue seulement par la grâce de fin du lot courant → entrées marquées (écart à la fin de CE lot). */
 const lot=engine?.s?.batch,enGrace=seance!==seanceObservateur();
 /* OBS-3 : en grâce, le contexte de mesure relevé à la fin du lot (gardé au redémarrage) ; sinon celui de la mesure en cours. */
 const ctxFin=enGrace&&lot?.id?obsFins.get(lot.id)?.ctx:null,ctxCourant=ctxFin&&ctxFin.batchId===lot.id?ctxFin:obsContexte();
 const vu=s=>obsState.perSeance.get(s)||{n:0,capped:false},courant={seance,ctx:ctxCourant,seen:vu(seance),fin:enGrace&&lot?finDuLot(lot):null},events=[];let rejected=0;
 const marqueGrace=(f,fin)=>{const t=f.startedEpochMs;return {recuEnGrace:true,debutMoinsFinLotMs:Number.isFinite(t)&&Number.isFinite(fin)?Math.round((t-fin)*10)/10:null};};
 /* Nouveau lot pendant la grâce de l'ancien : ce que la page a vu (début, sinon fin) AVANT le début du nouveau lot reste à l'ancien. */
 const ancien=(a=>a&&{...a,seen:vu(a.seance)})(ancienLotEnGrace(seance));
 const cible=f=>{if(!ancien)return courant;const t=Number.isFinite(f.startedEpochMs)?f.startedEpochMs:f.endedEpochMs;return Number.isFinite(t)&&t<ancien.debut?ancien:courant;};
 /* 4.9.0.18 (AM-14) : pendant Écho, les observations portent `nativeSessionId` : elles sortent dans l'export d'Écho (et plus
  * dans le journal d'Orbite, KI-068) ; une écriture de validation réussie est jointe à la visite (`serverWrites`). */
 const echoId=seance==='ecoute-native'?engine?.s?.native?.id??null:null;
 const add=(fields,seq,c=courant)=>{const e={eventId:K.uid(),timestamp:new Date().toISOString(),type:'esv-observation',schema:1,observer:{id:m.observer,seq:Number.isInteger(seq)?seq:null},...fields,receivedMs,timeOrigin,...c.ctx,...(echoId?{nativeSessionId:echoId}:{}),
  ...(c.fin!==null&&c.fin!==undefined?marqueGrace(fields,c.fin):{})};
  if(JSON.stringify(e).length>maxChars){rejected++;return;}events.push(e);};
 if(obsState.lost){add({kind:'gap',lost:obsState.lost,reason:'store-rejected',of:null},null);obsState.lost=0;}
 for(const x of m.entries){
  if(!x||typeof x!=='object'){rejected++;continue;}
  const fields=obsFields(x);if(!fields){rejected++;continue;}
  /* 4.9.5.1 (D3) : suivi des écritures refusées, avant le plafond de la séance (rien n'est rangé de plus). */
  if(fields.kind==='write')try{ecritureObservee(fields);}catch{}
  try{relevesObservation(fields,m.observer);}catch{}
  const c=cible(fields),seen=c.seen;
  if(fields.kind!=='gap'&&seen.n>=cap){if(!seen.capped){seen.capped=true;add({kind:'gap',lost:null,reason:'session-cap',of:null},null,c);}rejected++;continue;}
  add(fields,x.seq,c);if(fields.kind!=='gap')seen.n++;
  if(fields.kind==='write'){b1NoterEcriture(fields);listeNoterEcriture(fields,echoId);}
  if(fields.kind==='write'&&echoId&&events.at(-1)?.kind==='write')void Promise.resolve(native.noteServerWrite(events.at(-1))).catch(()=>{});}
 if(rejected&&!events.some(e=>e.kind==='gap'&&e.reason==='rejected'))add({kind:'gap',lost:rejected,reason:'rejected',of:null},null);
 for(const c of ancien?[ancien,courant]:[courant]){obsState.perSeance.set(c.seance,c.seen);if(obsState.perSeance.size>8)obsState.perSeance.delete(obsState.perSeance.keys().next().value);}
 /* 4.9.0.10 (D-092) : fiche de départ de la partie (validés, invalides, total), gardée hors du cache : le vidage ne la touche pas. */
 for(const e of events){if(e.kind!=='list-summary'||e.beforeSession!==true)continue;try{const EC=cacheExport(),lotE=engine?.s?.batch,
   fiche=EC?.ficheDepart?.(e,{batchId:e.batchId??lotE?.id??(echoId?'echo:'+echoId:null),
    /* 4.9.0.18 : en Écho, la partie est celle du cut affiché (aucun lot). */
    partie:echoId?engine?.s?.current?.identity?.part??null:(e.batchId??lotE?.id)===lotE?.id?lotE?.scope?.part:null,version:VERSION});
  if(fiche)void Promise.resolve(EC.noterDepart(chrome.storage.local,fiche)).catch(()=>{});
  listeApresChargement(e,fiche,courant.ctx);}catch{/* la fiche n'est pas critique */}}
 for(const e of events){try{void Promise.resolve(store.putEvent(e)).catch(()=>{obsState.lost++;});}catch{obsState.lost++;}}
 /* OBS-5 : réponse en grâce marquée ; le pont n'en tire aucun début de séance (ni marque, ni résumés d'avant séance). */
 return {accept:true,stored:events.length,...(enGrace?{grace:true}:{}),...(b1Reglage()==='off'?{tableListe:false}:{}),...(relevesOff().length?{relevesOff:relevesOff()}:{})};
}catch(e){return {accept:true,stored:0,reason:'error',error:String(e?.message||e).slice(0,200)};}}
/* D-062 (a) : M, le nombre de cuts de la partie (numérotés de 0 à M−1), est le
 * total du compteur « N on M treated » (le texte confirmé par la direction,
 * photo du 27/09), lu une seule fois. Le texte « M cuts » est journalisé pour
 * qualification mais ne sert jamais seul : un autre nombre suivi de « cuts »
 * (cuts validés, par exemple) vaudrait N+1 au cut N et ferait mémoriser une
 * fausse fin. */
function totalPartie(e){const a=e.compteur?.total;
 if((e.compteursVus??1)>1)return {total:null,totalSource:'plusieurs'};
 return Number.isInteger(a)&&a>0?{total:a,totalSource:'compteur'}:{total:null,totalSource:'illisible'};}
const adapter=Object.fromEntries(['ping','state','nativeSnapshot','capture','apply','restore','next','nextWithoutDecision','validateAndNext','validateInPlace','skipAndNext','manualStart','manualPause','manualResume','manualFinish','nativeStart','nativePause','nativeResume','nativeFinish','cancel'].map(a=>[a,(...args)=>call(a,...args)]));
/* 4.7.19 — LE PILOTE S'ARRÊTE AU DERNIER CUT DU LOT (retour terrain du 25/09).
 * Le bouton de validation d'ESV valide ET charge le cut non validé suivant, au
 * besoin dans la partie suivante : le lot finissait donc dans une autre partie.
 * Au dernier cut du lot (`scope.end`), le Pilote pose la paire puis s'arrête
 * sans valider ; un cut non résolu est laissé sans commande ni navigation.
 * `src/engine.js` est épinglé : l'arrêt passe par l'état du lot, que la boucle
 * relit entre deux étapes. */
function stopAtLotEnd(proposal){
 const b=engine.s.batch,cut=engine.s.before?.identity?.cut;
 if(b?.state!=='RUNNING'||b.scope?.geometryEngine!==GCV1_ENGINE||!Number.isInteger(cut)||cut!==b.scope.end)return false;
 const resolved=proposal===undefined||['left','right'].every(side=>proposal?.rails?.[side]?.delta);
 /* Non résolu : seule la politique « différer » navigue ; « pause » reste déjà sur le cut. */
 if(proposal!==undefined&&(resolved||b.scope.unresolvedPolicy!=='defer'))return false;
 b.state='STOPPED';b.stoppedAtEnd={cut,at:new Date().toISOString(),applied:proposal===undefined};
 engine.s.notice=proposal===undefined
   ?`Dernier cut du lot (${cut}) : pose appliquée, non validée. Contrôle-la et valide-la toi-même dans ESV ; Orbite ne passe pas à la partie suivante.`
   :`Dernier cut du lot (${cut}) : rail non résolu, laissé sans commande ni navigation. À toi de le placer dans ESV.`;
 return true;
}
/* 4.7.21 — BORNES DU LOT REMPLIES PAR BANANE (direction, 26/09 : « ne pas
 * m'embêter à remplir à chaque fois »). ESV n'affiche que « Cut N of part P » :
 * le dernier cut d'une partie ne se lit nulle part. Banane retient donc, par
 * partie, la fin connue : celle que tu as saisie pour un lot, ou le cut après
 * lequel ESV a quitté la partie (fin constatée). Sans fin connue, le lot va « à
 * la fin de la partie » (`endMode:'partie'`, borne FIN_PARTIE) : il avance
 * jusqu'à ce qu'ESV quitte la partie, puis se clôt seul (KI-061). Une valeur
 * par défaut, jamais imposée : le panneau la propose, tu la modifies. Clé : le
 * numéro de partie (ESV ne donne pas le projet). */
const FIN_PARTIE=999999,CLE_PARTIES='banane4Parties';
async function finsParties(){try{return (await chrome.storage.local.get(CLE_PARTIES))?.[CLE_PARTIES]||{};}catch{return {};}}
async function retenirFinPartie(part,cut,source){if(!Number.isInteger(part)||!Number.isInteger(cut)||cut<0||cut>=FIN_PARTIE)return;
 try{const t=await finsParties();t[part]={last:cut,source,at:new Date().toISOString()};await chrome.storage.local.set({[CLE_PARTIES]:t});}catch{/* mémoire indisponible : le panneau proposera « fin de partie » */}}
/* 4.7.20 (KI-061) — FIN DE PARTIE APRÈS UNE VALIDATION. Dans un reliquat, le
 * dernier cut non validé du lot n'est pas `scope.end` : sa validation fait
 * charger par ESV le cut non validé suivant, au besoin dans la partie suivante,
 * et l'arrêt au dernier cut (4.7.19) ne joue pas. Terrain du 25/09 : partie 6,
 * 7634 validé, ESV affiche 8131 (fin du lot) puis ne répond plus ; même scène en
 * partie 3 (4.7.18, 8209). `src/engine.js` ne contrôle la cible qu'après un
 * différé : la navigation d'une validation est contrôlée ici. */
function lotExitOf(next,dernier=null){const b=engine.s.batch,sc=b?.scope;
 /* 4.8.6 (KI-069) : dernier cut de la partie, validé sur place, sans navigation. */
 if(dernier&&b?.state==='RUNNING'&&sc?.geometryEngine===GCV1_ENGINE)return 'dernier-cut-valide';
 if(b?.state!=='RUNNING'||sc?.geometryEngine!==GCV1_ENGINE||!next)return null;
 if(Number.isInteger(next.part)&&next.part!==sc.part)return 'part';
 if(Number.isInteger(next.cut)&&next.cut>sc.end)return 'beyond-end';
 return null;}
function closeAtExit(...args){return coordinateurLot.transition('fin-de-lot',()=>clore(...args));}
async function clore(reason,last,next,{annonce=null,surNavigation=true,finSansPose=false,dernier=null}={}){const b=engine.s.batch;last=last??b.activeIdentity?.cut;
 b.state='STOPPED';
 if(dernier){/* KI-069 : ESV est resté sur le dernier cut ; rien d'autre n'est ni envoyé ni mémorisé (D-062 b reste celle de D-062). */
   b.stoppedAtEnd={cut:last,reason,issue:reason,motif:dernier.motif,target:null,total:dernier.total,at:new Date().toISOString(),applied:reason==='dernier-cut-valide'};
   const quel=dernier.motif==='dernier-invalide'?'dernier cut à valider de la partie':'dernier cut de la partie';
   engine.s.notice=reason==='dernier-cut-valide'?`Fin du lot : ${quel} (${last}) validé ; ESV est resté sur ce cut.`
     :`Fin du lot : ${quel} (${last}), différé ; rien n’a été envoyé à ESV.`;
   await engine.event('batch-stopped-at-end',{identity:null,reason,lastCut:last??null,target:null,total:dernier.total});return;}
 /* `issue` : sortie d'ESV après une validation, pendant un cut, ou fin muette sans pose (4.8.0). */
 const issue=finSansPose?'fin-sans-pose':surNavigation?'sortie':'sortie-pendant-cut';
 b.stoppedAtEnd={cut:finSansPose?next?.cut??null:last??null,reason,issue,target:next?{part:next.part??null,cut:next.cut??null}:null,at:new Date().toISOString(),applied:issue==='sortie'||issue==='sortie-pendant-cut'&&!!engine.s.applied};
 const where=()=>next?.part!==b.scope.part?`dans la partie ${next?.part}`:`au cut ${next?.cut}`;
 engine.s.notice=finSansPose
   ?`Fin du lot : ESV ne répond plus sur le dernier cut du lot (${next?.cut}), où rien n’a été posé. Contrôle-le dans ESV ; le lot est clos.`
   :reason==='adapter-lost-after-navigation'
   ?`Fin du lot : après la validation du cut ${last}, ESV est passé au cut ${next?.cut} et ne répond plus (changement de partie probable). Le lot est clos ; recharge ESV avant un autre lot.`
   :surNavigation?`Fin du lot : après la validation du cut ${last}, ESV est passé ${where()}, hors du lot. Le lot est clos ; aucun cut hors du lot n'est traité.`
   :`Fin du lot : ESV affiche la partie ${next?.part} pendant le cut ${last}, qu’Ariane n’a pas validé. Le lot est clos ; contrôle ce cut dans ESV.`;
 await engine.event('batch-stopped-at-end',{identity:null,reason,lastCut:last??null,target:b.stoppedAtEnd.target});
 /* ESV a quitté la partie après ce cut : c'est la fin de la partie pour le
  * Pilote. 4.8.0 (KI-063) : seulement quand ESV montre ou annonce une AUTRE
  * partie. Terrain du 26/09 (partie 13) : ESV muet après 6629 alors qu'il
  * annonçait 6758, même partie ; la 4.7.21 retenait 6629 comme fin. Si ESV a
  * annoncé un cut plus loin dans la partie avant d'en sortir, c'est lui. */
 if(surNavigation&&Number.isInteger(next?.part)&&next.part!==b.scope.part)await retenirFinPartie(b.scope.part,Math.max(last??-1,annonce?.part===b.scope.part&&Number.isInteger(annonce.cut)?annonce.cut:-1),'fin constatée');}
/* 4.8.6 (KI-069, D-065) — DERNIER CUT DE LA PARTIE CERTAIN : le cut N vaut M−1,
 * M lu dans le relevé passif du cut N lui-même (même partie, même cut, un seul
 * compteur « N on M treated », N < M, relevé postérieur au début du cut). Tout
 * autre cas (M inconnu, illisible, incohérent, plusieurs compteurs, relevé d'un
 * autre cut ou périmé) : comportement de la 4.8.5, inchangé. */
function dernierCutCertain(cut){const b=engine.s.batch,sc=b?.scope,t=b?.totalReleve;
 if(b?.state!=='RUNNING'||sc?.geometryEngine!==GCV1_ENGINE||!Number.isInteger(cut)||!t)return null;
 if(t.part!==sc.part||t.cut!==cut||t.totalSource!=='compteur'||!Number.isInteger(t.total)||t.total<1||cut>=t.total)return null;
 const depuis=Date.parse(b.cutStartedAt),relevé=Date.parse(t.at);
 if(!Number.isFinite(depuis)||!Number.isFinite(relevé)||relevé<depuis)return null;
 if(cut===t.total-1)return {part:sc.part,cut,total:t.total,motif:'dernier-cut'};
 /* Retour terrain du 30/09 (partie 37) : le dernier cut À VALIDER n'est pas toujours M−1 (8504 pour M = 8640 ; ESV a quitté
  * la partie). Le compteur « N on M treated » le dit : restants = M − traités ; devant = restants − cuts déjà différés par ce
  * lot (ils restent à valider, derrière) − 1 (le cut courant). Devant = 0 : aucun cut à valider après celui-ci. Sûr par
  * excès : un cut à valider hors lot, ou différé par un lot antérieur, GONFLE « devant » (jamais de faux zéro) ; les
  * cas qui le dégonfleraient (cut différé situé devant, SKIP ou reprise à la main dont le compte est inconnu) sont écartés. */
 const traites=t.traites,differes=[...new Set((b.deferred||[]).map(d=>d?.cut??d?.identity?.cut))];
 if(!Number.isInteger(traites)||traites<0||traites>=t.total||(b.skipped?.length||0)>0||(b.manuallyCompleted?.length||0)>0)return null;
 if(differes.some(c=>!Number.isInteger(c)||c>=cut))return null;
 return t.total-traites-differes.length-1===0?{part:sc.part,cut,total:t.total,motif:'dernier-invalide'}:null;}
const validateInESV=adapter.validateAndNext,validateInPlaceInESV=adapter.validateInPlace;
/* Ctrl+Entrée valide sans passer au suivant. Preuve : identité inchangée et compteur N → N+1
 * (serverConfirmed) ; jamais navigationObserved. Sans effet ou erreur : le moteur (épinglé) arrête le lot avec ce message ; JAMAIS de repli vers « valider et suivant ». */
async function validerSurPlace(identity,d,scope){const S=globalThis.BananeSettings?.lot||{},K=globalThis.BananeCore3;
 const commande=S.validationDernierCut==='bouton'?'bouton':'ctrl-entree';
 await engine.event('dernier-cut-detecte',{identity:null,part:d.part,cut:d.cut,total:d.total,motif:d.motif,action:'validation',commande});
 const echec=m=>Error(/^Adaptateur ESV sans réponse|^Une autre Ariane/.test(m)?m
   :`Dernier cut ${d.motif==='dernier-invalide'?'à valider ':''}de la partie (${d.cut}) : ${m} Le cut ${d.cut} reste posé, non validé : valide-le toi-même dans ESV. Aucun repli vers « valider et suivant » : ce bouton ferait quitter la partie.`);
 let e;try{e=await validateInPlaceInESV(identity,scope,{commande,boutonId:S.boutonValiderSansSuivant??null});}catch(err){throw echec(err.message);}
 const av=e?.compteurAvant,ap=e?.compteurApres;
 if(!(e?.commandSent===true&&e.serverConfirmed===true&&e.navigationObserved!==true&&e.afterState?.identity&&K.key(e.afterState.identity)===K.key(identity)
   &&Number.isInteger(av?.traites)&&ap?.traites===av.traites+1&&ap.total===av.total&&av.total===d.total))
   throw echec('Ctrl+Entrée n’a pas produit l’effet attendu : la validation n’est pas confirmée (identité ou compteur « N on M treated » inattendus).');
 await engine.event('validation-en-place',{identity:null,part:d.part,cut:d.cut,total:d.total,motif:d.motif,commande:e.command??'ctrl-entrée',compteurAvant:av,compteurApres:ap});
 await closeAtExit('dernier-cut-valide',d.cut,null,{dernier:d});
 return e;}
/* 4.9.5.1 (D3, renvoyé par la relecture finale de la 4.9.0, D-110) — ÉCRITURE DE VALIDATION REFUSÉE PAR ESV.
 * Avant : ESV refusait l'écriture (HTTP 500), l'observateur passif le voyait (`kind:'write', status:500`), mais le lot
 * acceptait le cut (preuve `navigation-only`) et continuait. Désormais, SANS AUCUNE ATTENTE AJOUTÉE :
 *  1. chaque validation envoyée par le lot est notée (cut, heure d'envoi, heure de retour) ;
 *  2. chaque écriture observée (rangerObservations) est rapprochée d'une ligne : `rowIndex` s'il est donné (hypothèse
 *     de banc : rowIndex = numéro du cut, comme pour B1) ; sinon la ligne déjà vue pour le même `railPairId` (écriture
 *     réussie antérieure) ; sinon la DERNIÈRE validation envoyée dont la fenêtre contient le début de l'écriture
 *     (500 ms avant l'envoi, 1 s après le retour). En pratique, l'observateur ne donne `rowIndex` que pour une
 *     écriture réussie (seule appliquée à sa table) : pour un refus, c'est la fenêtre qui joue. Une écriture dont le
 *     corps est lu et ne porte pas `ExtractionStatus` (« SeenByOperator » du cut suivant, par exemple) n'est pas une
 *     validation : jamais prise pour un refus. Un cut que le lot n'a pas validé n'est jamais concerné ;
 *  3. écriture non 2xx (ou statut 0) d'un cut validé : si aucune écriture 2xx de la même ligne (même `railPairId`, ou
 *     même cut) ne suit dans `ecritureRefuseeRelanceMs` (2 s, ESV relance parfois), le refus est confirmé : événement
 *     `ecriture-refusee` (cut, statut, heure) et, si le lot tourne, PAUSE comme le bouton Pause (le moteur s'arrête à
 *     son prochain point sûr, jamais au milieu d'une capture, d'une pose ou d'une validation), avec l'avis
 *     « ESV a refusé d'enregistrer la validation du cut N (erreur serveur). Vérifie ce cut dans ESV, puis Reprendre. »
 * Rien n'est renvoyé à ESV. Sans observation (observateur absent ou coupé) : comportement de la 4.9.0. En mémoire
 * seulement : un redémarrage du service worker oublie un refus non encore confirmé. */
const ecrituresLot={validations:[],lignes:new Map(),echecs:new Map(),refusees:[]};
const reglageEcriture=()=>{const S=globalThis.BananeSettings?.lot||{};return {mode:S.ecritureRefusee==='off'?'off':'pause',
 relanceMs:Number.isFinite(S.ecritureRefuseeRelanceMs)&&S.ecritureRefuseeRelanceMs>=0?S.ecritureRefuseeRelanceMs:2000};};
function ecritureNoterValidation(identity){if(reglageEcriture().mode==='off'||!Number.isInteger(identity?.cut))return null;
 const v={cut:identity.cut,part:identity.part??null,lot:engine?.s?.batch?.id??null,envoiMs:Date.now(),retourMs:null};
 ecrituresLot.validations.push(v);if(ecrituresLot.validations.length>16)ecrituresLot.validations.shift();return v;}
const ecritureOk=s=>Number.isInteger(s)&&s>=200&&s<300;
function ecritureLigne(f,t){
 if(Number.isInteger(f.rowIndex))return {cut:f.rowIndex,par:'rowIndex'};
 if(f.railPairId&&ecrituresLot.lignes.has(f.railPairId))return {cut:ecrituresLot.lignes.get(f.railPairId),par:'railPairId'};
 const v=ecrituresLot.validations.findLast(v=>t>=v.envoiMs-500&&t<=(v.retourMs??Infinity)+1000);
 return v?{cut:v.cut,par:'fenetre'}:null;}
function ecritureObservee(f){const R=reglageEcriture();if(R.mode==='off'||!f||f.kind!=='write')return;
 const t=Number.isFinite(f.startedEpochMs)?f.startedEpochMs:Date.now(),ok=ecritureOk(f.status);
 if(ok&&f.railPairId&&Number.isInteger(f.rowIndex)){ecrituresLot.lignes.set(f.railPairId,f.rowIndex);if(ecrituresLot.lignes.size>256)ecrituresLot.lignes.delete(ecrituresLot.lignes.keys().next().value);}
 /* Corps lu sans `ExtractionStatus` : pas une écriture de validation. */
 if(f.body&&typeof f.body==='object'&&!Object.hasOwn(f.body,'ExtractionStatus'))return;
 const l=ecritureLigne(f,t);
 if(ok){for(const [cle,e] of ecrituresLot.echecs)if(t>=e.debutMs-1&&(f.railPairId&&f.railPairId===e.railPairId||l&&l.cut===e.cut))ecrituresLot.echecs.delete(cle);return;}
 if(f.status===null||f.status===undefined||!l||!ecrituresLot.validations.some(v=>v.cut===l.cut))return;
 const e={cut:l.cut,par:l.par,statut:f.status,railPairId:f.railPairId??null,debutMs:t,lot:engine?.s?.batch?.id??null};
 ecrituresLot.echecs.set(l.cut,e);setTimeout(()=>{void ecritureConfirmer(l.cut,e).catch(()=>{});},R.relanceMs);}
async function ecritureConfirmer(cut,e){if(ecrituresLot.echecs.get(cut)!==e)return;ecrituresLot.echecs.delete(cut);
 const b=engine?.s?.batch,heure=new Date(e.debutMs).toISOString(),tourne=b?.state==='RUNNING'&&b.id===e.lot;
 const avis=`ESV a refusé d’enregistrer la validation du cut ${cut} (${e.statut===0?'pas de réponse du serveur':'erreur serveur'}). Vérifie ce cut dans ESV, puis Reprendre.`;
 ecrituresLot.refusees.push({cut,statut:e.statut,heure});if(ecrituresLot.refusees.length>32)ecrituresLot.refusees.shift();
 await engine.event('ecriture-refusee',{identity:null,cut,statut:e.statut,heure,rapprochement:e.par,lot:e.lot,pause:tourne});
 if(tourne)await coordinateurLot.transition('pause',async()=>{await engine.pause();});
 /* L'avis est posé tout de suite, puis de nouveau quand le moteur s'est arrêté (une étape finie entre-temps, la capture
  * par exemple, écrit le sien). */
 const poser=async()=>{if(engine?.s?.batch?.id!==e.lot)return;engine.s.notice=avis;await engine.save();};
 await poser();if(tourne&&engine.task)void engine.task.then(poser,poser).catch(()=>{});}
adapter.validateAndNext=(...args)=>coordinateurLot.transition('cut-suivant',async()=>{
 const envoi=ecritureNoterValidation(args[0]);
 try{
 const dernier=dernierCutCertain(args[0]?.cut);if(dernier)return await validerSurPlace(args[0],dernier,args[1]);
 const evidence=await validateInESV(...args);
 const next=evidence?.nextIdentity,exit=lotExitOf(next);
 if(exit)await closeAtExit(exit==='part'?'navigation-other-part':'navigation-beyond-end',engine.s.before?.identity?.cut,next);
 return evidence;}finally{if(envoi)envoi.retourMs=Date.now();}});
const readState=adapter.state,unresponsive=e=>/Adaptateur ESV sans réponse/.test(e?.message||'');
/* 4.8.0 (KI-063) — ESV LU DANS UNE AUTRE PARTIE. Après un silence, ESV peut
 * revenir sur une autre partie (terrain du 26/09 : partie 13 muette 30 s après
 * 6629, puis partie 14, cut 1) : le lot sort de sa partie, il est clos, rien
 * n'y est traité. */
async function horsPartie(r,{attente=false}={}){const b=engine.s.batch,id=r?.identity;
 /* Pendant l'attente d'un ESV muet, un lot mis en pause entre-temps compte encore. */
 const actif=b?.state==='RUNNING'||attente&&b?.state==='PAUSED';
 if(!actif||b.scope?.geometryEngine!==GCV1_ENGINE||!Number.isInteger(id?.part)||id.part===b.scope.part)return r;
 const last=b.processed?.at(-1);
 /* Fin de partie retenue seulement si ESV sort juste après une navigation
  * d'Ariane (le lot n'a pas encore commencé le cut annoncé) ; une autre partie
  * ouverte à la main au milieu d'un cut ne dit rien de la fin (revue 4.8.0). */
 const apresNavigation=!!last?.evidence?.navigationObserved&&b.activeIdentity?.cut===last.cut;
 await closeAtExit('navigation-other-part',undefined,{part:id.part,cut:id.cut},{annonce:last?.evidence?.nextIdentity,surNavigation:apresNavigation});
 throw Error(`Fin du lot : ESV affiche la partie ${id.part}, hors du lot (KI-063).`);}
/* Cuts traités par le lot (posés, différés, SKIP, repris à la main). */
function cutsTraites(b){return new Set([...(b.processed||[]),...(b.skipped||[]),...(b.manuallyCompleted||[]),...(b.deferred||[])].map(x=>x?.cut??x?.identity?.cut).filter(Number.isInteger));}
adapter.state=async(...args)=>{
 /* Seul un lot EN COURS au moment de la lecture attend un ESV muet : une
  * lecture sur un lot déjà en pause (vue du panneau, reprise) échoue aussitôt,
  * comme avant (revue 4.8.0). */
 const lot=engine.s.batch,enCours=lot?.state==='RUNNING'&&lot.scope?.geometryEngine===GCV1_ENGINE;
 try{return await horsPartie(await readState(...args));}catch(e){if(!unresponsive(e))throw e;
   const S=globalThis.BananeSettings?.lot||{},b=engine.s.batch;let sansReponse=e;
   /* Page rechargée (F5) ou fermée : aucune relecture ne peut réussir avant la
    * réinstallation d'Ariane ; « Reprendre » s'en charge. */
   if(!enCours||b!==lot||!['RUNNING','PAUSED'].includes(b.state)||e.code==='ESV_PAGE_ABSENTE')throw e;
   /* ESV muet pendant un lot (4.7.20 KI-061, 4.8.0 KI-063). Attente longue une
    * fois le lot en route (30 s de silence sur le terrain, partie 13), courte
    * avant (adaptateur plutôt absent). Ensuite, si ESV s'est tu JUSTE APRÈS la
    * navigation vers le cut de fin d'un lot borné (le lot n'a pas commencé ce
    * cut, rien n'y est posé) : lot clos proprement (KI-061). Sinon : « sans
    * réponse », que F5 puis « Reprendre » règle. Une sortie vers une autre
    * partie est déjà close par la validation (lotExitOf). */
   const next=b.processed?.at(-1)?.evidence?.nextIdentity,traites=cutsTraites(b);
   const courant=b.activeIdentity?.cut,attendu=Number.isInteger(courant)&&!traites.has(courant)?courant:next?.cut;
   const commence=Number.isInteger(attendu)&&engine.s.before?.identity?.cut===attendu,rienPose=!engine.s.applied&&!engine.s.intent;
   const borne=traites.size>0&&rienPose&&!commence&&Number.isInteger(attendu)&&attendu>=b.scope.end&&b.scope.endMode!=='partie';
   const longue=traites.size>0,essais=longue?(S.stateRetriesNavigation??10):(S.stateRetries??2);
   /* « Arrêter » pendant l'attente : on cesse d'attendre. « Pause » : on attend
    * encore ; si ESV répond, le moteur s'arrête proprement en pause. */
   const arrete=()=>engine.s.batch!==b||b.state==='STOPPED';
   for(let k=1;k<=essais;k++){if(arrete())throw sansReponse;
     if(longue)engine.s.notice=b.state==='PAUSED'
       ?`Pause demandée : Ariane attend encore la réponse d’ESV (lecture ${k} sur ${essais}), puis s’arrête.`
       :`ESV ne répond pas encore${Number.isInteger(attendu)?` (chargement du cut ${attendu} ?)`:''} : nouvelle lecture ${k} sur ${essais}. Le lot reprend seul dès qu’ESV répond.`;
     await new Promise(r=>setTimeout(r,S.stateRetryMs??3000));if(arrete())throw sansReponse;
     try{const r=await readState(...args);await engine.event('adapter-state-retry',{attempt:k,ok:true});
       if(longue&&b.state==='RUNNING')engine.s.notice='ESV répond de nouveau : le lot continue.';return await horsPartie(r,{attente:true});}
     catch(e2){if(!unresponsive(e2))throw e2;sansReponse=e2;if(e2.code==='ESV_PAGE_ABSENTE')throw e2;}}
   if(borne&&!arrete()){await closeAtExit('adapter-lost-after-navigation',b.processed?.at(-1)?.cut,{part:b.scope.part,cut:attendu},{finSansPose:true});
     throw Error('Fin du lot : ESV ne répond plus après le dernier passage (KI-061).');}
   throw sansReponse;}};
/* 4.8.0 — ESV RAFRAÎCHI PENDANT UN LOT (direction, 27/09). Quand ESV est lent
 * (nuages qui n'apparaissent pas, vue qui ne se recentre pas), le remède est de
 * rafraîchir la page. Mais après F5, ESV repart du PREMIER cut non validé de la
 * partie (le premier différé) et la page change de repère (`pageId`,
 * `frameId`) : le moteur, épinglé, refusait toute reprise (« Contexte de lot
 * changé »). Ariane reconnecte la page, revient au cut du lot par « cut non
 * validé suivant » (aucune validation, aucun rail touché), puis rattache le
 * lot à la nouvelle page : les appuis passent dans le nouveau repère par la
 * translation mesurée sur les deux rails du cut (≤ 1 mm, même rotation), ou
 * sont écartés si elle ne se vérifie pas (la voie repart des cuts suivants).
 * Déclenché par « Reprendre » après un F5 de l'opérateur (option 1 de la
 * direction : un rafraîchissement automatique croisait trop de cas). */
let repriseEnCours=false;
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
/* Adaptateur et bridge dans l'onglet ESV, puis `ping` de la bonne version :
 * partagé par « Connecter » et la reconnexion après un rafraîchissement. Sur un
 * document déjà équipé, l'adaptateur ne se réinstalle pas (même `pageId`).
 * D1 (4.8.5, D-060) — COHABITATION. Le monde principal de la page est commun à
 * toutes les extensions : une seule Ariane peut y avoir son adaptateur. On
 * regarde AVANT d'injecter (lecture seule du marqueur de l'adaptateur) : celui
 * d'une autre Ariane (autre extension) → refus, rien n'est injecté ; le nôtre
 * d'une autre version → recharger ESV ; le nôtre de cette version → seul le
 * bridge est remis. Sur un onglet vierge, le tampon du propriétaire précède
 * les fichiers : l'adaptateur n'obéira qu'à cette extension. */
/* Refus DÉFINITIFS (`definitif`) : la reconnexion après F5 ne les retente pas. */
const definitif=message=>Object.assign(Error(message),{definitif:true});
/* `v` : le nom de version de l'autre Ariane, tel qu'edge://extensions
 * l'affiche, ou son numéro si elle ne le donne pas (4.8.0). */
const autreAriane=(v,sansProprietaire=false)=>definitif(`Une autre Ariane (${v||'version inconnue'}) est active dans cet onglet : désactive-la dans edge://extensions, puis F5 sur ESV.`+
  /* Un adaptateur sans propriétaire est celui d'une Ariane d'avant la 4.8.5 : la 4.8.0 installée à côté, ou cette Ariane avant sa mise à jour. */
  (sansProprietaire?' Si c’est une mise à jour de cette Ariane, F5 suffit.':''));
const aRecharger=()=>definitif(`Recharge la page ESV (F5) pour activer Ariane ${VERSION_NAME}.`);
/* Sonde ET tampon en un seul passage dans la page : entre la lecture du
 * marqueur et la pose du tampon, aucune autre injection ne peut s'intercaler. */
/* Revue globale : le tampon d'une AUTRE Ariane déjà posé (connexion simultanée,
 * adaptateur pas encore installé) vaut refus : on ne l'écrase pas. */
async function sondeEtTampon(tabId){
 const r=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',args:[chrome.runtime.id,VERSION,VERSION_NAME],func:(id,version,versionName)=>{const p=window.__BANANE_V3_PAGE;
   if(p)return {version:String(p.version??''),versionName:typeof p.versionName==='string'?p.versionName:null,proprietaire:typeof p.proprietaire==='string'?p.proprietaire:null};
   const t=window.__ARIANE_PROPRIETAIRE;
   if(typeof t?.id==='string'&&t.id!==id)return {version:String(t.version??''),versionName:typeof t.versionName==='string'?t.versionName:null,proprietaire:t.id};
   window.__ARIANE_PROPRIETAIRE={id,version,versionName};return null;}});
 return r?.[0]?.result??null;}
async function equiperOnglet(tabId){
 const deja=await sondeEtTampon(tabId);
 if(deja&&deja.proprietaire!==chrome.runtime.id)throw autreAriane(deja.versionName||deja.version,deja.proprietaire===null);
 if(deja&&deja.version!==VERSION)throw aRecharger();
 if(!deja)await chrome.scripting.executeScript({target:{tabId},world:'MAIN',files:PAGE_FILES});
 await chrome.scripting.executeScript({target:{tabId},world:'ISOLATED',files:['src/bridge.js']});
 const ping=await callSur(tabId,'ping').catch(e=>{throw /^Une autre Ariane/.test(e?.message||'')?definitif(e.message):e;});
 /* Une autre Ariane a pu s'installer entre le tampon et nos fichiers : le ping le
  * dit, ou l'adaptateur refuse notre ping en la nommant (refus définitif). */
 if(ping?.proprietaire!==chrome.runtime.id)throw autreAriane(ping?.versionName||ping?.version,!ping?.proprietaire);
 if(ping?.version!==VERSION)throw aRecharger();
 if(ping?.intrusion)throw definitif(`Ariane ${VERSION_NAME} en sécurité : une autre Ariane a tenté de commander cet onglet (« ${ping.intrusion.action} »). Désactive l’autre Ariane dans edge://extensions, puis F5 sur ESV, puis Reprendre.`);
 /* 4.9.5.3 (S6) : empreinte du contrat ESV, demandée par un second ping (lecture seule) ; une panne n'empêche jamais la connexion. */
 if(releveOn('empreinte'))void callSur(tabId,'ping',{contrat:true}).then(r=>contratNoter(r?.contrat,tabId),()=>{});}
async function reconnecterESV(delaiMs,garde=()=>{}){const fin=Date.now()+delaiMs;let derniere=null;
 while(Date.now()<fin){garde();try{const tab=await chrome.tabs.get(selectedTab);
   if(tab?.status&&tab.status!=='complete'){await attendre(500);continue;}
   await equiperOnglet(selectedTab);return;}
  catch(e){if(e.definitif)throw e;derniere=e;}await attendre(1000);}
 throw Error('ESV ne répond pas après le rafraîchissement'+(derniere?.message?` (${derniere.message})`:'')+'.');}
async function etatDansPartie(part,delaiMs,garde=()=>{}){const fin=Date.now()+delaiMs;let derniere=null;
 while(Date.now()<fin){garde();try{const r=await readState();
   if(Number.isInteger(r?.identity?.part)&&r.identity.part!==part)throw Object.assign(Error(`ESV affiche la partie ${r.identity.part}, pas la partie ${part} du lot.`),{definitif:true});
   if(r?.rails?.left&&r?.rails?.right)return r;}catch(e){if(e.definitif)throw e;derniere=e;}
  await attendre(1000);}
 throw Error('Rails du cut illisibles après le rafraîchissement'+(derniere?.message?` (${derniere.message})`:'')+'.');}
function translationRails(a,b){
 const d=['left','right'].map(side=>{const p=a?.[side]?.positionSceneRelative,q=b?.[side]?.positionSceneRelative;
   return Array.isArray(p)&&Array.isArray(q)&&p.length===3&&q.length===3?q.map((v,i)=>v-p[i]):null;});
 if(!d[0]||!d[1]||Math.hypot(...d[0].map((v,i)=>v-d[1][i]))>.001)return null;
 for(const side of ['left','right']){const A=a[side].railLocalToSceneRelative,B=b[side].railLocalToSceneRelative;
   if(!Array.isArray(A)||!Array.isArray(B)||[0,1,2,4,5,6,8,9,10].some(i=>Math.abs(A[i]-B[i])>1e-6))return null;}
 return d[0].map((v,i)=>(v+d[1][i])/2);}
/* Rattache le lot à la page affichée, sur SON cut. Les attentes des cuts déjà
 * validés deviennent d'abord appuis (dans l'ancien repère, comme
 * `observeLot`) ; les autres ne seront jamais validées sur l'ancienne page et
 * sont écartées. Puis les appuis passent dans le nouveau repère. */
function rebaserLot(now,avant){const b=engine.s.batch,L=globalThis.BananeLotDecision,S=globalThis.BananeSettings;
 const ancien=engine.s.before?.identity?.frameId??b.activeIdentity?.frameId??null,nouveau=now.identity.frameId??null;
 /* Translation mesurée sur le MÊME cut, vu avant et après : sans lui, appuis écartés. */
 const T=avant?translationRails(avant.rails,now.rails):null,obs=b.lotObservation;let gardes=0,ecartes=0;
 if(obs&&typeof L?.promoteAnchors==='function')promouvoirAppuis(b,obs,b.processed,(S?.lot?.maxAnchors??40)+(b.scope?.lotReprise?.anchors?.length||0));
 const deplacer=a=>{if((a?.identity?.frameId??null)!==ancien)return [a];if(!T){ecartes++;return [];}gardes++;
   const positions=Object.fromEntries(Object.entries(a.positions||{}).map(([side,p])=>[side,Array.isArray(p)&&p.length===3?p.map((v,i)=>v+T[i]):p]));
   return [{...a,identity:{...a.identity,frameId:nouveau},positions}];};
 if(obs){obs.anchors=(obs.anchors||[]).flatMap(deplacer);obs.pending=[];}
 const de=b.scope.pageId;b.scope.pageId=now.identity.pageId;engine.s.before=now;b.step='capture';
 return {dePageId:de,versPageId:now.identity.pageId,deFrameId:ancien,versFrameId:nouveau,translation:T,appuisGardes:gardes,appuisEcartes:ecartes};}
/* Rend le lot reprenable sur la page ESV affichée. Rend l'état affiché, et
 * `rattache` vrai seulement si c'était une autre page (un silence passager
 * n'est pas un rechargement). Le cut à retrouver : celui dont la lecture a été
 * interrompue (`before`, pas encore traité), exactement ; sinon le premier cut
 * non validé après le dernier cut traité. Introuvable : refus en clair, rien
 * n'est modifié. */
async function retablirApresRechargement(garde=()=>true){
 const b=engine.s.batch,S=globalThis.BananeSettings?.lot||{};
 const interrompu=()=>{if(!garde())throw Error('Reprise interrompue : le lot a été arrêté.');};
 /* « Adaptateur sans réponse » : c'est justement ce qu'un rafraîchissement règle. */
 if(!b||b.scope?.geometryEngine!==GCV1_ENGINE||!['PAUSED','STOPPED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(b.state))return {etat:null,rattache:false};
 let now=null;try{now=await readState();}catch{/* adaptateur absent ou occupé */}
 if(!now){const fin=Date.now()+(S.rafraichirAttenteMs??90000);
   engine.s.notice='Ariane attend la page ESV (rafraîchis-la si elle reste figée)…';await engine.save();
   await reconnecterESV(fin-Date.now(),interrompu);now=await etatDansPartie(b.scope.part,Math.max(1000,fin-Date.now()),interrompu);}
 interrompu();
 if(now.identity.pageId===b.scope.pageId)return {etat:now,rattache:false};
 /* Rien de posé sur un cut : capture à refaire, analyse sans pose, ou résultat
  * archivé (KI-052). Une pose commandée reste à contrôler dans ESV. */
 const libre=['capture','analyze'].includes(b.step)||b.step==='apply'&&!engine.s.proposal;
 if(!libre||engine.s.intent||engine.s.applied||engine.s.reconcileRequired)
   throw Error('ESV a été rechargé pendant une pose : contrôle le cut dans ESV, puis lance un nouveau lot.');
 if(now.identity.part!==b.scope.part)throw Error(`ESV affiche la partie ${now.identity.part}, pas la partie ${b.scope.part} du lot.`);
 /* Le cut à retrouver : le cut en cours du lot s'il n'est pas traité (lecture
  * interrompue, ou cut annoncé après un différé) ; sinon le premier cut non
  * validé après le plus loin des cuts traités. */
 const traites=cutsTraites(b);
 const avant=engine.s.before&&!traites.has(engine.s.before.identity?.cut)?engine.s.before:null;
 const enCours=avant?.identity?.cut??(Number.isInteger(b.activeIdentity?.cut)&&!traites.has(b.activeIdentity.cut)?b.activeIdentity.cut:null);
 const exact=enCours,plancher=exact??Math.max(-1,...traites),max=S.rafraichirPasMax??400;
 const atteint=c=>exact!==null?c>=exact:c>plancher;
 let ici=now.rails?.left&&now.rails?.right?now:await etatDansPartie(b.scope.part,S.rafraichirAttenteMs??90000,interrompu),pas=0;
 while(Number.isInteger(plancher)&&!atteint(ici.identity.cut)&&pas<max){
   engine.s.notice=`ESV rafraîchi : retour au lot (cut ${ici.identity.cut} affiché, rien n’est validé).`;
   interrompu();ici=await adapter.next(ici.identity);pas++;
   if(ici?.identity?.part!==b.scope.part)throw Error(`ESV est passé à la partie ${ici?.identity?.part} en revenant au lot.`);}
 const vise=exact??`après ${plancher}`;
 if(exact!==null?ici.identity.cut!==exact:!(ici.identity.cut>plancher)||traites.has(ici.identity.cut))
   throw Error(`ESV rafraîchi, mais le cut ${vise} du lot n’est pas retrouvé (ESV affiche le cut ${ici.identity.cut}${pas>=max?` après ${pas} cuts`:''}). Ouvre-le dans ESV, puis clique sur Reprendre.`);
 interrompu();
 /* Lecture faite sur l'ancienne page, sans pose (étape « analyse ») : archivée,
  * proposition comprise ; le cut sera relu sur la nouvelle page. */
 if(b.step==='analyze'){await engine.archivePending('esv-reloaded');engine.s.proposal=null;engine.s.lidarId=null;}
 const r=rebaserLot(ici,avant);
 await engine.event('batch-rebased-after-reload',{identity:ici.identity,cut:exact??plancher,atteint:ici.identity.cut,pas,...r});
 engine.s.notice=`ESV rafraîchi : lot rattaché à la nouvelle page, au cut ${ici.identity.cut}${r.appuisEcartes?` (${r.appuisEcartes} appuis écartés)`:''}.`;
 await engine.save();return {etat:ici,rattache:true,...r,pas};}
/* « Reprendre » (après F5 le cas échéant). « Arrêter » pendant l'attente d'ESV
 * ou le retour au cut gagne : on ne relance que le même lot, dans l'état où
 * il était. */
/* 4.8.5 (D3, KI-067) — FIN DE PARTIE APRÈS UN DIFFÉRÉ. Terrain du 28/09
 * (partie 15) : le « suivant sans décision » envoyé depuis le dernier cut
 * (9056, sans point LiDAR) fait quitter la page à ESV ; le moteur (épinglé) le
 * lit comme une navigation sans progression et met le lot en pause. Dans un lot
 * « jusqu'à la fin de la partie », sur un cut SANS POSE, on retient ce départ
 * quand la commande a pu partir et qu'ESV a quitté la page (page mise en cache
 * de navigation, comme le 28/09) ou annonce une autre partie. Une erreur de
 * connexion AVANT l'envoi, ou un canal fermé sans départ, n'est pas un départ. La marque est liée à l'intention
 * (operationId) : elle ne vaut que tant que cette intention reste ouverte. La
 * preuve vient à la reprise (`finApresDiffere`) : D-062, le compteur « N on M »
 * seul n'en est pas une ; avec une partie supérieure affichée, N = M−1 en est
 * une. Aucune commande n'est renvoyée. Lot borné, ou cut posé :
 * rien ne change, l'incertitude y est réelle. */
const PAGE_QUITTEE=/back\/forward cache/i;
async function departApresDiffere(ev){const b=engine.s.batch,sc=b?.scope;
 if(!ev||!b||b.state!=='PAUSED_DEFER_NAVIGATION_UNCERTAIN'||sc?.geometryEngine!==GCV1_ENGINE||sc.endMode!=='partie'||engine.s.applied)return;
 if(ev.identity?.part!==sc.part||!Number.isInteger(ev.identity?.cut)||!ev.operationId)return;
 const autre=Number.isInteger(ev.observedIdentity?.part)&&ev.observedIdentity.part!==sc.part;
 if(!autre&&!PAGE_QUITTEE.test(ev.refusal?.message||''))return;
 /* D-062 : M et N journalisés au départ. M vient du relevé du cut N lui-même
  * (même partie, même cut) ; N ≥ M le rend incohérent. `dernier` : N = M−1
  * (vrai), N < M−1 (faux), M inconnu (null) ; seule base de la mémorisation
  * (finApresDiffere) et du panneau. */
 const N=ev.identity.cut,t=b.totalReleve,duCut=t?.part===sc.part&&t?.cut===N;
 let total=duCut&&Number.isInteger(t.total)?t.total:null,totalSource=!t?'absent':!duCut?'autre-cut':t.totalSource;
 if(total!==null&&N>=total){total=null;totalSource='incoherent';}
 const dernier=total===null?null:N===total-1;
 b.departApresDiffere={part:ev.identity.part,cut:N,operationId:ev.operationId,total,totalSource,dernier,at:new Date().toISOString()};
 await engine.event('fin-partie-depart',{identity:null,part:sc.part,cut:N,total,totalSource,dernier,releveCut:t?.cut??null,operationId:ev.operationId});
 engine.s.notice=`ESV a quitté la page après le différé du cut ${N} ; fin de partie ${dernier===true?'probable':'à vérifier'} : clique sur Reprendre (F5 seulement si ESV reste figée).`;
 await engine.save();}
const departOuvert=b=>{const d=b?.departApresDiffere;return !!d&&b.state==='PAUSED_DEFER_NAVIGATION_UNCERTAIN'&&b.scope?.endMode==='partie'
  &&engine.deferPending?.()?.operationId===d.operationId;};
/* D3, puis D-062 (b) : « Reprendre » après ce départ. Sans F5 d'abord : Ariane
 * s'installe seule sur la page où ESV est allée (un F5 pourrait ramener ESV dans
 * la partie du lot). L'intention de navigation encore ouverte sur N est clôturée
 * sans renvoi et le lot se ferme. La fin de la partie n'est MÉMORISÉE que si ESV
 * affiche une partie SUPÉRIEURE et que N vaut M−1 (M relevé au départ, D4) ;
 * jamais en deçà d'une fin déjà connue. Sinon rien n'est mémorisé : le panneau
 * dit que N pourrait être le dernier cut, à saisir comme borne si l'opérateur
 * veut le retenir. ESV encore dans la partie du lot : lot fermé aussi (D-062 b),
 * sans fin ni différé compté ; contrôle du cut N demandé. ESV illisible, action
 * en cours, résultat de POSE incertain à clôturer : aucune clôture automatique. */
async function finApresDiffere(b){const d=b.departApresDiffere,S=globalThis.BananeSettings?.lot||{};
 const lot=b.id,garde=()=>{if(engine.s.batch?.id!==lot||engine.s.batch.state!=='PAUSED_DEFER_NAVIGATION_UNCERTAIN')throw Error('Reprise interrompue : le lot a changé.');};
 if(engine.task)throw Error('Attends la fin de l’action en cours.');
 if(engine.s.reconcileRequired||engine.s.intent)throw Error('Un résultat incertain reste à clôturer à la main : contrôle ESV, puis clôture ce résultat incertain. Aucune fin de partie n’est affirmée.');
 let now=null;try{now=await readState();}catch{/* page rechargée : Ariane s'y réinstalle */}
 if(!now){engine.s.notice='Ariane attend la page ESV (rafraîchis-la si elle reste figée)…';await engine.save();
   await reconnecterESV(S.rafraichirAttenteMs??90000,garde);now=await readState();}
 garde();if(!departOuvert(engine.s.batch))throw Error('Reprise interrompue : la navigation différée a changé.');
 const P=now?.identity?.part;if(!Number.isInteger(P))throw Error('ESV illisible après le rafraîchissement : contrôle la page, puis clique sur Reprendre.');
 const part=b.scope.part,N=d.cut,M=Number.isInteger(d.total)?d.total:null,memoriser=P>part&&d.dernier===true,meme=P===part;
 /* Même partie, cut plus loin que N : la navigation a eu lieu, N n'est pas le dernier. */
 const X=now.identity.cut,plusLoin=meme&&Number.isInteger(X)&&X>N;
 /* Le moteur journalise la clôture (non comptée comme différé confirmé :
  * exports et rapport d'acceptation inchangés) ; l'interruption est renommée
  * ci-dessous, et le panneau compte ce cut parmi les différés (voieDuLot). Un
  * arrêt du service worker entre les deux écritures laisse un lot clos par
  * l'opérateur, sans fin retenue : le cas de la 4.8.0, sans perte. */
 await engine.locked(()=>engine.closeUncertain());
 const it=(b.interrupted||[]).findLast(x=>x.operationId===d.operationId&&x.status==='DEFER_NAVIGATION_CLOSED_BY_OPERATOR');
 /* Même partie : rien ne dit que la navigation a eu lieu ; ce n'est pas un différé. */
 if(it)it.status=memoriser?'DEFER_NAVIGATION_CLOSED_END_OF_PART':meme&&!plusLoin?'DEFER_NAVIGATION_CLOSED_SAME_PART':'DEFER_NAVIGATION_CLOSED_NO_END_PROOF';
 b.error=null;delete b.departApresDiffere;
 const reason=memoriser?'navigation-other-part-after-defer':meme?(plusLoin?'defer-moved-within-part':'defer-closed-same-part'):'navigation-away-after-defer-unproven',target={part:P,cut:X??null};
 b.stoppedAtEnd={cut:N,reason,issue:'sortie',target,total:M,at:new Date().toISOString(),applied:false};
 if(memoriser){
   engine.s.notice=`Fin du lot : ESV est passée à la partie ${P} ; le cut ${N} est le dernier de la partie ${part} (${M} cuts, de 0 à ${M-1}) ; fin de partie retenue. Aucune commande n’a été renvoyée.`;
   const connue=(await finsParties())[part];
   if(!(Number.isInteger(connue?.last)&&connue.last>N))await retenirFinPartie(part,N,'fin constatée après différé (M−1)');}
 else if(plusLoin)engine.s.notice=`Lot fermé sans fin de partie : ESV affiche encore la partie ${part}, au cut ${X}, après le cut ${N} : ce n’est pas le dernier. Contrôle le cut ${N} dans ESV. Aucune commande n’a été renvoyée.`;
 /* Relecture indépendante de D-062 : partie supérieure, M connu, N ≠ M−1 : le code
  * vient d'écarter N ; le message le dit et n'invite pas à le saisir comme borne. */
 else if(P>part&&M!==null&&N!==M-1)engine.s.notice=`Lot fermé sans fin de partie : la partie ${part} compte ${M} cuts, son dernier cut est le ${M-1} ; le cut ${N} n’est pas le dernier. Rien n’est retenu. Aucune commande n’a été renvoyée.`;
 else{const POURQUOI={incoherent:'nombre de cuts de la partie incohérent',plusieurs:'plusieurs compteurs de cuts dans la page','autre-cut':'nombre de cuts relevé sur un autre cut'};
   const pourquoi=meme?`ESV affiche encore la partie ${part}${Number.isInteger(X)?`, cut ${X}`:''}`:P<part?`ESV affiche la partie ${P}, antérieure au lot`
     :M===null?(POURQUOI[d.totalSource]||'nombre de cuts de la partie illisible'):`${M} cuts relevés : le dernier serait le ${M-1}`;
   engine.s.notice=`Lot fermé sans fin de partie (${pourquoi}) : le cut ${N} pourrait être le dernier de la partie ; saisis-le comme dernier cut si tu veux le retenir.`
     +(meme?` Contrôle le cut ${N} dans ESV.`:'')+' Aucune commande n’a été renvoyée.';}
 await engine.event('batch-stopped-at-end',{identity:null,reason,lastCut:N,target,total:M,finMemorisee:memoriser});
 cloreMesureHorsBoucle();await engine.save();return true;}
/* 4.9.0.16 (test 15, 5a) — LOT DÉJÀ TERMINÉ. Après une fin de partie certaine (dernier cut
 * validé sur place ou différé sans envoi, KI-069 ; fin retenue après un différé, D-062 b),
 * « Reprendre » relançait la boucle sur le dernier cut : la fin se rejouait à chaque clic
 * (« dernier-cut-differe » puis « batch-stopped-at-end », terrain du 15/10 à 07:27:52 et
 * 07:27:58). Il n'y a plus rien à faire dans ce lot : la reprise répond « Lot déjà
 * terminé », sans commande ni événement. Les autres clôtures (dernier cut d'une plage,
 * sortie d'ESV) restent reprenables comme avant. */
const FINS_DE_PARTIE=new Set(['dernier-cut-valide','dernier-cut-differe']);
function lotTermine(b){const e=b?.stoppedAtEnd;return b?.state==='STOPPED'&&!!e&&(FINS_DE_PARTIE.has(e.issue)||e.reason==='navigation-other-part-after-defer');}
/* 4.9.0.16 (test 15, 5b) — REPRISE SUR UNE PROPOSITION DÉJÀ CALCULÉE. Le moteur épinglé ne
 * contrôle les rails à la reprise que si le cut repart de sa capture. Arrêté (ou en pause)
 * après l'analyse et avant la pose, le lot reprenait à l'étape « pose » et appliquait la
 * proposition calculée AVANT l'arrêt, sans nouvelle capture (terrain du 15/10, cut 2236 :
 * « Arrêter », puis « Reprendre » 6 s plus tard). Comme « Réessayer » : si les rails d'ESV
 * ne sont plus ceux de la capture, la reprise est refusée, rien n'est posé. Rails
 * inchangés : la proposition vaut toujours, le lot reprend comme avant. */
async function gardeRailsCapture(affiche){const b=engine.s.batch,avant=engine.s.before;
 if(!b||!avant?.rails||engine.s.applied||engine.s.intent||engine.s.reconcileRequired)return;
 if(!(b.step==='analyze'||b.step==='apply'&&engine.s.proposal))return;
 const now=affiche?.rails?affiche:await adapter.state().catch(()=>null);
 if(!now?.rails)throw Error(`Cut ${avant.identity?.cut??'?'} : rails d’ESV illisibles ; la proposition calculée avant l’arrêt n’est pas appliquée. Recharge ESV (F5), puis clique sur Reprendre.`);
 if(!globalThis.BananeCore3.equalPoses(avant.rails,now.rails))
  throw Error(`Rails modifiés depuis la capture du cut ${avant.identity?.cut??'?'} : la proposition calculée avant l’arrêt n’est pas appliquée, la reprise est refusée. ${b.state==='STOPPED'?'C':'Arrête le lot, c'}ontrôle ce cut dans ESV, puis lance un nouveau lot.`);}
async function reprendreLot(){assertPilotContract(engine.s.batch?.scope);
 const b0=engine.s.batch;
 if(departOuvert(b0))return coordinateurLot.transition('fin-de-lot',()=>finApresDiffere(b0));
 const lot=engine.s.batch?.id,etatDepart=engine.s.batch?.state;
 const garde=()=>engine.s.batch?.id===lot&&engine.s.batch.state===etatDepart;
 /* 4.8.0 : page ESV rafraîchie (F5) depuis la pause : retour au cut, lot rattaché. */
 const {etat,rattache}=await coordinateurLot.transition('rechargement',()=>retablirApresRechargement(garde));
 /* Relecture 4.7.12, constat I3 : « Reprendre » sur le cut encore affiché et
  * archivé recapturait ce cut, que le moteur refuse d'écrire ; le lot passait
  * en ERROR, non reprenable, et perdait ses appuis. La reprise est refusée
  * avant de toucher à l'étape du lot : il reste arrêté, reprenable dès le cut
  * suivant. */
 const affiche=etat??await adapter.state().catch(()=>null);
 /* D-067 : après un retour à un cut pendant la pause, le lot ne repart que du cut où il était. */
 await gardeRetourCut('« Reprendre »',affiche,{rattache});
 if(affiche?.identity)try{engine.writable(affiche.identity);}
  catch{throw Error(`Cut ${affiche.identity.cut} : résultat incertain archivé, Ariane n’y écrit plus. Passe au cut suivant dans ESV, puis clique sur Reprendre.`);}
 /* KI-052 : « Archiver le résultat interrompu » arrête le lot en laissant
  * l'étape « apply » et efface la proposition ; reprendre relançait la boucle
  * sur une proposition absente. Sans proposition, la reprise recommence le
  * cut par sa capture. */
 if(engine.s.batch?.step==='apply'&&!engine.s.proposal&&!engine.s.intent&&!engine.s.reconcileRequired)engine.s.batch.step='capture';
 if(!garde())return false;
 await gardeRailsCapture(affiche);
 if(!garde())return false;
 /* « Adaptateur sans réponse » : ESV répond de nouveau (état relu ci-dessus), le
  * lot redevient une pause ordinaire ; refus du moteur : l'état est rendu. */
 const b=engine.s.batch,bloque=b?.state==='PAUSED_ADAPTER_UNRESPONSIVE'&&!!etat;if(bloque)b.state='PAUSED';
 /* Un lot clos (fin, sortie) qu'on relance n'est plus clos. */
 const fin=b?.stoppedAtEnd;if(b)b.stoppedAtEnd=null;
 try{await engine.resume();}catch(e){if(engine.s.batch===b){if(bloque&&b.state==='PAUSED')b.state='PAUSED_ADAPTER_UNRESPONSIVE';b.stoppedAtEnd=fin;}throw e;}
 return true;}
const applyInESV=adapter.apply;
adapter.apply=async(...args)=>{const result=await applyInESV(...args);
 if(stopAtLotEnd())await coordinateurLot.transition('fin-de-lot',()=>engine.event('batch-stopped-at-end',{identity:engine.s.before?.identity??null,applied:true}));return result;};
adapter.capabilities={serverConfirmation:false};
const ready=(async()=>{await restaurerObsFins();selectedTab=(await chrome.storage.local.get('banane3Tab')).banane3Tab??null;engine=new BananeEngine3.Engine(adapter,store);
 /* 4.8.0 (D-058, option 1 de la direction) : une lecture instable met le lot en
  * pause (moteur épinglé). Le remède est de rafraîchir ESV : on le dit ; après
  * F5, « Reprendre » revient seul au cut du lot (retablirApresRechargement). */
 /* 4.8.6 (KI-069) : différé sur le dernier cut de la partie : aucune commande « suivant »
  * (le moteur épinglé attendrait un changement de cut) ; le lot se ferme ici, rien n'est envoyé à ESV. */
 const differer=engine.deferUnresolved.bind(engine);
 engine.deferUnresolved=(now,b,eligibility)=>coordinateurLot.transition('differe',async()=>{const d=dernierCutCertain(now?.identity?.cut);if(!d)return differer(now,b,eligibility);
   await engine.event('dernier-cut-differe',{identity:null,part:d.part,cut:d.cut,total:d.total,motif:d.motif,commande:null});
   b.interrupted=Array.isArray(b.interrupted)?b.interrupted:[];
   b.interrupted.push({identity:globalThis.BananeCore3.completeIdentity(now.identity),status:'DEFER_DERNIER_CUT_SANS_ENVOI',commandInvoked:false,total:d.total});
   await closeAtExit('dernier-cut-differe',d.cut,null,{dernier:d});await engine.save();
   return {status:'DEFER_DERNIER_CUT_SANS_ENVOI'};});
 const evenement=engine.event.bind(engine);
 engine.event=async(type,...rest)=>{if(type==='batch-state')finVueParLaBoucle(rest[0]?.state);
   /* OBS-3 : arrêt au dernier cut : l'instant reste `stoppedAtEnd.at` ; on garde aussi le contexte de mesure (redémarrage). */
   if(type==='batch-stopped-at-end'){const b=engine.s.batch,at=Date.parse(b?.stoppedAtEnd?.at);if(b?.id&&b.state==='STOPPED'&&Number.isFinite(at)&&engine.s.mode==='automatic-test')poserFin(b,at,'dernier-cut');}
   const r=await evenement(type,...rest);
   if(type==='defer-navigation-uncertain')await coordinateurLot.transition('differe',()=>departApresDiffere(rest[0]));
   if(type==='batch-capture-wait'&&engine.s.batch?.scope?.geometryEngine===GCV1_ENGINE&&!/F5/.test(rest[0]?.message||''))
     engine.s.notice=`${rest[0]?.message||'Lecture LiDAR instable.'} Si ESV reste lent (nuages absents, vue qui ne se recentre pas) : rafraîchis la page ESV (F5), puis clique sur Reprendre ; Ariane revient seule au cut du lot, sans rien valider.`;
   return r;};
 // Le moteur reste inchangé. On enveloppe seulement l'appel public analyze()
 // afin d'armer pour UN appel le candidat actif Assisté, puis de persister le
 // journal comparatif. Hors Assisté, le retour reste exactement V4.6.
 const analyzeV46=engine.analyze.bind(engine);
 engine.analyze=async(...args)=>{
   const gcv1=globalThis.BananeGCV1Shadow;
   const activeAssisted=engine.s.mode==='assisted'&&gcv1?.state?.().activeAssistedEnabled===true;
   const pilotScope=engine.s.mode==='automatic-test'&&engine.s.batch?.scope?.geometryEngine===GCV1_ENGINE
     ?engine.s.batch.scope:null;
   if(pilotScope)assertPilotContract(pilotScope);
   const selector=pilotScope?'active-pilot-test':activeAssisted?'active-assisted':null;
   if(timing)timing.selector=selector||'runtime-default';
   let proposal,analysisError=null;
   try{if(selector)gcv1.armOnce(selector);proposal=await analyzeV46(...args);}
   catch(e){analysisError=e;}
   finally{gcv1?.disarm?.();}
   const shadow=gcv1?.consumeLast?.()||null;
   /* Engine.analyze() reste l'unique constructeur de s.proposal. On annote le
    * même objet après le calcul pour rendre la provenance durable ; event()
    * persiste ensuite ensemble l'état annoté et le proposalId comparatif. */
   if(selector&&proposal&&shadow?.selection){
     proposal.geometryEngine=shadow.selection.selectedEngine;
     proposal.geometrySelection={selector,requestedEngine:GCV1_ENGINE,
       selectedEngine:shadow.selection.selectedEngine,fallback:shadow.selection.fallback===true,
       fallbackReason:shadow.selection.fallbackReason||null,contractId:shadow.contract?.id||null,
       geometrySha256:shadow.contract?.geometrySha256||null};
   }
   /* Décision sur le lot (amendement n°9, D-039), calculée sur la capture du
    * cut et les cuts déjà passés du lot, consignée avec l'observation GCV1.
    * 4.7.10 (D-041, D-042) : dans un lot créé avec « appliquer », elle COMMANDE
    * — la proposition remise au lot porte ses positions (`commandLot`). Un lot
    * « observer seulement », ou créé avant la 4.7.10, reste en observation.
    * Une erreur ici n'arrête rien : la proposition du moteur reste la seule. */
   let lotObservation=null;
   if(pilotScope&&shadow&&!shadow.error)try{lotObservation=await observeLot(shadow);}
    catch(e){lotObservation={stage:'error',reason:e?.message||String(e),applied:false};}
   if(lotObservation&&pilotScope?.lotDecision==='apply'&&proposal&&!analysisError&&shadow?.selection?.selectedEngine===GCV1_ENGINE)try{proposal=await commandLot(proposal,lotObservation);}
    catch(e){/* KI-053 : une paire retirée par la garde n'est jamais rendue, même sur erreur. */
     if(lotObservation.guardDeferred&&globalThis.BananeLotDecision?.deferRails){
       const d=globalThis.BananeLotDecision.deferRails(proposal.rails,lotObservation,'guard-error','décision sur le lot : paire du moteur retirée par la garde ; commande impossible ('+(e?.message||String(e))+')');
       engine.s.proposal=proposal={...proposal,rails:d.rails,lotCommand:{action:'defer',reason:'guard-error',stage:lotObservation.stage,engineRails:proposal.rails}};
       lotObservation.command={action:'defer',reason:'guard-error: '+(e?.message||String(e))};lotObservation.applied=false;}
     else lotObservation.command={action:'engine',reason:'error: '+(e?.message||String(e))};}
   /* 4.7.18 (KI-057) : l'appui proposé attend que le cut soit validé avec ces
    * positions ; il ne compte qu'une fois posé (`promoteAnchors`). */
   if(lotObservation&&pilotScope)holdLotAnchor(lotObservation,pilotScope.lotDecision==='apply'?lotObservation.command??null:null);
   if(shadow)await engine.event('gcv1-shadow-observed',{identity:proposal?.identity||engine.s.before?.identity||null,
     sessionId:engine.s.sessionId,batchId:engine.s.batch?.id||null,lidarCaptureId:engine.s.lidarId||null,
     proposalId:proposal?.id||null,shadow,...(lotObservation?{lotObservation}:{})});
   if(analysisError)throw analysisError;
   /* 4.7.19 — dernier cut du lot non résolu : laissé sans commande ni navigation. */
   if(pilotScope&&proposal&&stopAtLotEnd(proposal))await coordinateurLot.transition('fin-de-lot',()=>engine.event('batch-stopped-at-end',{identity:engine.s.before?.identity??null,applied:false}));
   if(pilotScope&&shadow?.selection?.selectedEngine!==GCV1_ENGINE){
     engine.s.proposal=null;
     const reason=shadow?.selection?.fallbackReason||shadow?.error||'sélection GCV1 absente';
     await engine.event('gcv1-pilot-error',{identity:engine.s.before?.identity||null,message:reason,geometryEngine:GCV1_ENGINE});
     throw Error('GCV1 d’Orbite : '+reason);
   }
   return proposal;
 };
 timing=globalThis.BananePhaseTiming?.install(engine,store)||null;
 if(timing){const observer=observeLot,commander=commandLot;
  observeLot=function(...args){return timing.trackTask('observe-lot',()=>observer.apply(this,args));};
  commandLot=function(...args){return timing.trackTask('command-lot',()=>commander.apply(this,args));};
 }
 await engine.init();
 manual=new BananeManualSession4.Sessions(engine,adapter,store);native=new BananeNativeSession4.Sessions(engine,adapter,store);await manual.init();await native.init();})();
/* 4.7.10 — la décision commande. La proposition du moteur n'est pas modifiée
 * (l'événement « proposed » la garde telle quelle) : une NOUVELLE proposition,
 * même identifiant, porte les rails de la décision et devient celle du lot.
 * `Engine.apply()` garde tous ses contrôles : état ESV inchangé, écartement
 * dans le contrat avant commande, relecture à 1 mm après. */
/* « La ligne », Assisté : l'écartement de la proposition affichée, calculé comme
 * le garde du moteur (poses attendues après application), pour la plage
 * 1405–1470 du panneau. Lecture seule, aucune valeur centrale ni cible. */
function assistGauge(v){
 try{const K=globalThis.BananeCore3,G=globalThis.BananeGauge4,p=v?.proposal,b=v?.before;
  if(!K||!G||!p?.rails||!b?.rails||!['left','right'].every(side=>p.rails[side]?.delta))return null;
  const mm=G.gaugeMmOf(K.expectedPoses(b,p.rails),K.C),cls=G.classifyMm(mm);
  return Number.isFinite(mm)?{proposalId:p.id??null,mm:Math.round(mm*10)/10,gaugeClass:cls,admissible:G.admissible(cls),contract:G.CONTRACT}:null;
 }catch{return null;}
}
async function commandLot(proposal,lotObservation){
 const L=globalThis.BananeLotDecision,K=globalThis.BananeCore3,before=engine.s.before?.rails;
 /* 4.7.11 — caméras de la capture : la cible doit tomber dans la vue du rail (KI-051). */
 const capture=engine.s.lidarId?await store.getCloud(engine.s.lidarId):null;
 const command=L.commandRails({decision:lotObservation,runtimeRails:proposal.rails,before,expectedPoses:K.expectedPoses,cameras:L.viewCameras(capture)});
 lotObservation.command={action:command.action,reason:command.reason,...(command.gaugeMm!=null?{gaugeMm:command.gaugeMm}:{}),...(command.ndc?{ndc:command.ndc}:{})};
 lotObservation.applied=command.action==='lot';
 /* « La ligne » : le panneau dessine « posé par la voie » les cuts traités que
  * la décision a commandés ; la trace vit dans le lot, bornée à ses cuts. */
 const b=engine.s.batch,cut=engine.s.before?.identity?.cut;
 if(b&&Number.isInteger(cut)){b.lotCommands=b.lotCommands||{};b.lotCommands[cut]={...(b.lotCommands[cut]||{}),cut,action:command.action,stage:lotObservation.stage};}
 if(command.action==='engine')return proposal;
 engine.s.proposal={...proposal,rails:command.rails,lotCommand:{...lotObservation.command,stage:lotObservation.stage,
   anchorsUsed:lotObservation.anchorsUsed||[],engineRails:proposal.rails}};
 return engine.s.proposal;
}
/* Décision sur le lot : l'état du lot (ancres) vit dans le lot lui-même,
 * persisté avec lui, et disparaît avec lui. */
let lotAnchorCandidate=null;
function holdLotAnchor(lotObservation,command){
 const L=globalThis.BananeLotDecision,batch=engine.s.batch,candidate=lotAnchorCandidate;lotAnchorCandidate=null;
 if(!candidate||!batch?.lotObservation||typeof L?.holdAnchor!=='function')return;
 lotObservation.anchorHeld=L.commandsPositions(lotObservation,command);
 if(lotObservation.anchorHeld)L.holdAnchor(batch.lotObservation,candidate);
}
/* B1 (D-095) — VOISINS VALIDÉS LUS DANS LA LISTE DES COUPES D'ESV (src/appuis-liste.js).
 * La liste vit en mémoire de la PAGE (src/esv-observer.js) ; le service worker n'en
 * demande, par le pont, qu'une fenêtre de ±5 lignes autour du cut décidé et la ligne
 * la plus proche de sa pose de départ (monde = scène + T). T, la translation monde −
 * scène de la page, est mesurée ici sur les écritures de validation relevées par
 * l'observateur (corps de l'écriture − pose corrigée d'Ariane du même cut) : elle
 * reste en mémoire du service worker, n'est jamais consignée ni exportée, et se
 * recalibre à la validation suivante après un redémarrage. Le journal (`b1-ombre`) ne
 * garde que des écarts en mm, des numéros de cut et des comptes. Aucune requête vers
 * ESV : le pont lit la mémoire de la page. */
const b1={repere:null,sansPaire:0};
function b1Reglage(){const v=globalThis.BananeSettings?.appuisListe;return v==='ombre'||v==='actif'?v:'off';}
/* E1 (5.0) — mémoire de la liste d'ESV (src/liste-memoire.js) : bords écrits par Ariane pendant un lot, instantané et écarts au
 * chargement d'une liste. Rien n'est envoyé à ESV ; toute panne est avalée. */
function listeNoterEcriture(f,echoId){try{const LM=globalThis.BananeListeMemoire,b=engine?.s?.batch;
 if(LM&&!echoId&&b?.state==='RUNNING')void LM.noterEcriture(chrome.storage.local,f,{partie:b.scope?.part,enLot:true,version:VERSION});}catch{/* jamais bloquant */}}
function listeApresChargement(e,fiche,ctx){try{const LM=globalThis.BananeListeMemoire,K=globalThis.BananeCore3;if(!LM||!fiche)return;
 void LM.apresChargement({storage:chrome.storage.local,chrome,tabId:selectedTab,obs:e,fiche,version:VERSION,
  emettre:ev=>store.putEvent({eventId:K.uid(),timestamp:new Date().toISOString(),schema:1,...ev,...ctx})});}catch{/* jamais bloquant */}}
async function listeAction(action,args){const LM=globalThis.BananeListeMemoire;if(!LM)return {instantanes:[]};
 if(action==='liste-resume')return LM.resume(chrome.storage.local,Number(args?.partie));
 return {instantanes:await LM.instantanes(chrome.storage.local,args?.parties)};}
function b1NoterEcriture(f){try{const B=globalThis.BananeAppuisListe;
 if(!B||b1Reglage()==='off'||!(f.status>=200&&f.status<300)||!Number.isInteger(f.rowIndex)||f.body?.ExtractionStatus!=='valid')return;
 const bords=B.bordsCorps(f.body);if(!bords)return;
 const corrige=r=>['left','right'].every(x=>Array.isArray(r?.rails?.[x]?.corrected?.positionSceneRelative));
 const rec=(engine?.s?.records||[]).slice(-40).reverse().find(r=>r?.identity?.cut===f.rowIndex&&corrige(r));
 if(!rec){b1.sansPaire++;return;}
 b1.repere=B.noterRepere(b1.repere,rec.identity.frameId??null,B.mesurerT(bords,{left:rec.rails.left.corrected.positionSceneRelative,right:rec.rails.right.corrected.positionSceneRelative}));
}catch{/* jamais bloquant */}}
async function b1Voisins(cut,world){const B=globalThis.BananeAppuisListe;if(selectedTab===null)return {ok:false,reason:'sans-onglet'};let timer;
 try{return await Promise.race([chrome.tabs.sendMessage(selectedTab,{kind:'b1-voisins',cut,fenetre:B.DEFAULTS.fenetre,world}),
   new Promise(r=>{timer=setTimeout(()=>r({ok:false,reason:'delai'}),B.DEFAULTS.delaiPageMs);})]);}
 catch{return {ok:false,reason:'page-sans-reponse'};}finally{clearTimeout(timer);}}
/* Préparation, LÉGÈRE : repère, demande à la page (quelques millisecondes), appariement, voisins et garde de
 * cohérence. Elle se fait au moment de la décision, avant toute écriture du cut décidé (la ligne N est encore
 * la pose de départ d'ESV). Rend soit un événement final, soit de quoi conclure. */
/* 4.9.5.3 (S6, idée 6a) — T CALCULÉE SUR LA POSE DE DÉPART DU CUT, dès le premier cut, consignée À CÔTÉ de celle d'aujourd'hui
 * (`tDepart` dans l'événement `b1-ombre`) ; B1 continue d'employer l'actuelle (écriture de validation + pose corrigée), rien ne change
 * dans les voisins ni dans la décision. La ligne N de la liste est la pose de départ du cut N (prouvé à 0,0 mm sur quatre parties) tant
 * qu'elle est `invalid` et qu'aucune écriture ne l'a rafraîchie : T = bords de cette ligne (monde) − pose de départ de la capture
 * (scène). Aucune écriture à attendre : la mesure existe au premier cut. T n'est jamais consignée : seulement son état, sa rigidité
 * (écart des deux rails, mm) et son écart à la T actuelle (mm). */
const b1Depart={repere:null};
async function b1TDepart(args,trace){const B=globalThis.BananeAppuisListe,id=args.capture.identity;
 try{const scene={left:args.capture.rails.left.positionSceneRelative,right:args.capture.rails.right.positionSceneRelative};
  let rep=trace.rep;
  if(!rep)rep=B.lireReponse(await b1Voisins(id.cut,scene),{cut:id.cut,fenetre:B.DEFAULTS.fenetre});
  if(!rep.ok)return {etat:'page',raison:rep.reason};
  const ligne=rep.rows.find(x=>x.i===id.cut);
  if(!ligne)return {etat:'sans-ligne'};if(!ligne.bords)return {etat:'sans-bords'};
  if(ligne.statut!=='invalid'||ligne.fraiche)return {etat:'ligne-non-depart',statut:ligne.statut,fraiche:ligne.fraiche};
  const m=B.mesurerT(ligne.bords,scene);if(!m)return {etat:'mesure-impossible'};
  b1Depart.repere=B.noterRepere(b1Depart.repere,id.frameId??null,m);
  const R=b1.repere,ecart=R?.T&&R.frameId===(id.frameId??null)?Math.hypot(...m.T.map((v,i)=>v-R.T[i]))*1000:null;
  return {etat:m.ok?'calibre':'non-rigide',rigideMm:Math.round(m.rigideMm*10)/10,repere:B.resumeRepere(b1Depart.repere),
   ecartAActuelleMm:ecart===null?null:Math.round(ecart*10)/10};
 }catch(e){return {etat:'erreur',message:String(e?.message||e).slice(0,120)};}}
async function b1Preparer(args,d0,mode){
 const trace={},prep=await b1PreparerBase(args,d0,mode,trace);
 if(!releveOn('translationDepart')||!prep?.evenement)return prep;
 try{prep.evenement={...prep.evenement,tDepart:await b1TDepart(args,trace)};}catch{/* relevé seulement */}
 return prep;}
async function b1PreparerBase(args,d0,mode,trace={}){const B=globalThis.BananeAppuisListe,L=globalThis.BananeLotDecision,t0=Date.now(),id=args.capture.identity;
 const base={mode,identity:{part:id.part??null,cut:id.cut??null},reel:B.resumeDecision(d0)};
 try{const R=b1.repere;
  if(!R||R.frameId!==(id.frameId??null)||!R.T)return {evenement:{...base,etat:'sans-repere',ecrituresSansPaire:b1.sansPaire}};
  if(R.etat!=='calibre')return {evenement:{...base,etat:'repere-instable',repere:B.resumeRepere(R)}};
  const world=Object.fromEntries(['left','right'].map(x=>[x,args.capture.rails[x].positionSceneRelative.map((v,i)=>v+R.T[i])]));
  const rep=B.lireReponse(await b1Voisins(id.cut,world),{cut:id.cut,fenetre:B.DEFAULTS.fenetre});
  trace.rep=rep;
  if(!rep.ok)return {evenement:{...base,etat:'page',raison:rep.reason,repere:B.resumeRepere(R),ms:Date.now()-t0}};
  const apparie=B.accord(rep,id.cut),validated=apparie.ok?B.appuis(rep.rows,R.T,id):[];
  const gardes=validated.length?L.consistentValidated(id,args.capture.rails,validated).map(a=>a.identity.cut):[];
  return {validated,regle:validated.length?B.regle(d0):'inchange',t0,evenement:{...base,etat:apparie.ok?'calcule':'desaccord',repere:B.resumeRepere(R),table:rep.table,appariement:apparie,
   fenetre:B.compter(rep.rows,id.cut),candidats:validated.map(a=>a.identity.cut),gardes,msPage:Date.now()-t0}};
 }catch(e){return {evenement:{...base,etat:'erreur',message:String(e?.message||e).slice(0,200)}};}}
/* Conclusion : la décision avec les voisins, selon la règle d'emploi. Elle peut relancer le moteur depuis la voie
 * (jusqu'à 2,5 s mesurées sur le terrain pour une reprise) : en ombre, elle attend que la page travaille. */
function b1Conclure(prep,args,d0){const B=globalThis.BananeAppuisListe,L=globalThis.BananeLotDecision,t=Date.now();
 if(!prep.validated)return {evenement:prep.evenement};
 try{const pol=B.politique(d0,prep.validated,v=>L.decideCut({...args,validated:v}));
  return {decision:pol.decision,evenement:{...prep.evenement,regle:pol.regle,hypothese:pol.regle==='inchange'?null:B.resumeDecision(pol.decision),...B.comparer(d0,pol.decision),msCalcul:Date.now()-t}};}
 catch(e){return {evenement:{...prep.evenement,etat:'erreur',message:String(e?.message||e).slice(0,200)}};}}
/* Ombre : les conclusions lourdes attendent que la page travaille (envoi de la capture suivante), sinon 4 s. */
const b1File=[];let b1Minuterie=null;
function b1Planifier(f){b1File.push(f);while(b1File.length>8)try{b1File.shift()();}catch{}clearTimeout(b1Minuterie);b1Minuterie=setTimeout(b1Vider,4000);}
function b1Vider(){clearTimeout(b1Minuterie);b1Minuterie=null;for(const f of b1File.splice(0))try{f();}catch{/* jamais bloquant */}}
function b1Journal(ev,ctx){try{if(!ev)return;const K=globalThis.BananeCore3;
 void Promise.resolve(store.putEvent({eventId:K.uid(),timestamp:new Date().toISOString(),type:'b1-ombre',schema:1,...ctx,...ev})).catch(()=>{});}catch{/* le journal n'est pas critique */}}
/* Décision réelle `d0` : rendue telle quelle en ombre (calcul différé, consigné seulement) ; en actif, remplacée par
 * l'hypothèse quand la règle d'emploi s'applique. Une panne ici ne change jamais la décision réelle. */
async function b1Decision(args,d0){
 const mode=b1Reglage();if(mode==='off'||!globalThis.BananeAppuisListe)return d0;
 const snap={...args,anchors:(args.anchors||[]).slice()},ctx={batchId:engine?.s?.batch?.id??null,sessionId:engine?.s?.sessionId??null};
 if(mode==='ombre'){void b1Preparer(snap,d0,mode).then(prep=>{
   if(!prep.validated||prep.regle==='inchange')b1Journal(b1Conclure(prep,snap,d0).evenement,ctx);
   else b1Planifier(()=>b1Journal(b1Conclure(prep,snap,d0).evenement,ctx));},()=>{});
  return d0;}
 const r=b1Conclure(await b1Preparer(snap,d0,mode),snap,d0);b1Journal(r.evenement,ctx);
 return r.decision&&r.decision!==d0?{...r.decision,appuisListe:{regle:r.evenement.regle,gardes:r.evenement.gardes}}:d0;}
/* 4.9.5.3 (S6, idée 9 (1)) — « NE PAS REVISITER UN DIFFÉRÉ SANS SOURCE NOUVELLE », EN OMBRE. Quand le lot revisite un cut déjà différé
 * (une visite précédente, d'un lot précédent de la session, l'a laissé sans pose), l'événement `revisite-differe` dit si quelque chose de
 * neuf existe depuis : un autre cadre de scène (F5), un voisin validé par ce lot à `frameGap` cuts au plus, un appui utilisé par la
 * décision d'aujourd'hui et pas par la précédente. `revisite-sans-source-nouvelle:true` = rien de neuf. RIEN N'EST SAUTÉ : la décision,
 * la pose et la navigation restent celles du moteur ; c'est le taux de re-différé qui décidera de la règle. */
function revisiteDiffere(identity,batch,decision){try{
 if(!releveOn('revisiteSansSource')||!Number.isInteger(identity?.cut)||!batch)return;
 const avant=(engine?.s?.records||[]).filter(r=>(r?.status==='deferred-unresolved'||r?.decision==='DEFERRED_UNRESOLVED')&&r.identity?.part===identity.part&&r.identity?.cut===identity.cut&&r.batchId!==batch.id);
 if(!avant.length)return;
 const dernier=avant.reduce((a,b)=>String(b.deferredAt||'')>=String(a.deferredAt||'')?b:a);
 const gap=globalThis.BananeLotDecision?.DEFAULTS?.frameGap??8;
 const cadre=(dernier.identity?.frameId??null)!==(identity.frameId??null)||(dernier.identity?.pageId??null)!==(identity.pageId??null);
 const voisins=[...new Set((batch.processed||[]).map(p=>p?.cut??p?.identity?.cut).filter(c=>Number.isInteger(c)&&c!==identity.cut&&Math.abs(c-identity.cut)<=gap))].sort((a,b)=>a-b);
 const prec=new Set(Array.isArray(dernier.proposal?.lotCommand?.anchorsUsed)?dernier.proposal.lotCommand.anchorsUsed:[]);
 const nouveaux=(Array.isArray(decision?.anchorsUsed)?decision.anchorsUsed:[]).filter(c=>Number.isInteger(c)&&!prec.has(c));
 journalerSimple('revisite-differe',{identity:{part:identity.part??null,cut:identity.cut},'revisite-sans-source-nouvelle':!cadre&&!voisins.length&&!nouveaux.length,
  cadreChange:cadre,voisinsValidesDepuis:voisins.slice(0,12),appuisNouveaux:nouveaux.slice(0,12),fois:avant.length+1,differeAvant:{batchId:dernier.batchId??null,at:dernier.deferredAt??null},
  stage:decision?.stage??null,reason:decision?.reason??null,rienSaute:true});
}catch{/* relevé seulement */}}
async function observeLot(shadow){
 const L=globalThis.BananeLotDecision,S=globalThis.BananeSettings,batch=engine.s.batch;
 if(!L||!batch||S?.lot?.observe===false)return null;
 const capture=engine.s.lidarId?await store.getCloud(engine.s.lidarId):null;
 if(!capture?.rails?.left||!capture?.rails?.right||!Array.isArray(capture.pointsSceneRelative))return {stage:'no-capture',applied:false};
 const identity=globalThis.BananeCore3.completeIdentity(capture.identity||engine.s.before?.identity||{});
 /* 4.7.19 — lot « Reprise » : la mémoire part des cuts posés par le lot précédent
  * autour de ses différés (`scope.lotReprise`, figé à la création). */
 const seeds=batch.scope?.lotReprise?.anchors||[],max=(S?.lot?.maxAnchors??40)+seeds.length;
 const state=batch.lotObservation||(batch.lotObservation={version:L.DEFAULTS.version,anchors:seeds.map(a=>({...a})),pending:[]});
 lotAnchorCandidate=null;
 /* 4.7.18 (KI-057) : les cuts validés depuis la décision précédente deviennent
  * appuis ; une décision ne s'appuie que sur des cuts posés. 4.7.19 : chaque
  * cut posé est aussi gardé, en bref, pour une reprise ultérieure (`lotPosed`). */
 if(typeof L.promoteAnchors==='function')promouvoirAppuis(batch,state,batch.processed,max);
 const t0=Date.now();
 const lotArgs={capture:{identity,rails:capture.rails,pointsSceneRelative:capture.pointsSceneRelative,
   visibleByClipBoxes:capture.visibleByClipBoxes},science:{rails:shadow.rails,summary:shadow.summary},anchors:state.anchors,Shadow:globalThis.BananeGCV1Shadow};
 /* B1 (D-095) : en ombre (réglage livré), la décision réelle est celle-ci, inchangée ; l'hypothèse « voisins de la
  * liste d'ESV » est calculée à côté, après coup, et seulement consignée (`b1-ombre`). */
 const decision=await b1Decision(lotArgs,L.decideCut(lotArgs));
 revisiteDiffere(identity,batch,decision);
 /* « La ligne » : l'écart de chaque cut à la voie de ses voisins (garde du
  * premier passage, ou distance à la prédiction pour une reprise ou un choix),
  * pour le profil du panneau. Borné aux cuts du lot. */
 const chosen=decision.chosen?Object.values(decision.chosen).map(c=>c.fromPredictionMm).filter(Number.isFinite):[];
 const ecartMm=decision.guardMm??decision.fromPredictionMm??(chosen.length?Math.max(...chosen):null);
 if(Number.isInteger(identity.cut)){batch.lotCommands=batch.lotCommands||{};
   batch.lotCommands[identity.cut]={...(batch.lotCommands[identity.cut]||{}),cut:identity.cut,stage:decision.stage,reason:decision.reason??null,ecartMm:Number.isFinite(ecartMm)?ecartMm:null};}
 if(decision.anchor)lotAnchorCandidate={identity:{part:identity.part,cut:identity.cut,frameId:identity.frameId??null},positions:decision.positions,stage:decision.stage};
 /* Rejeu d'un lot « Reprise » : sa première décision porte les appuis de départ. */
 const reprise=seeds.length&&!state.repriseLogged?{fromBatchId:batch.scope.lotReprise.fromBatchId??null,anchors:seeds}:null;
 if(reprise)state.repriseLogged=true;
 return {...decision,...(reprise?{reprise}:{}),applied:false,displayed:false,engineMs:Date.now()-t0};
}
/* Les attentes des cuts validés (`processed`) deviennent appuis ; chaque cut
 * nouvellement promu est gardé en bref dans `lotPosed` (reprise). */
function promouvoirAppuis(batch,state,processed,max){const L=globalThis.BananeLotDecision,waiting=(state.pending||[]).map(p=>p.identity.cut);
 L.promoteAnchors(state,(processed||[]).map(p=>p.identity).filter(Boolean),max);
 rememberPosed(batch,state,waiting.filter(c=>!(state.pending||[]).some(p=>p.identity.cut===c)));}
/* 4.7.19 — cuts posés par le lot, en bref (identité et positions), pour une
 * reprise des différés : la mémoire de décision n'en garde que 40. */
function rememberPosed(batch,state,cuts){
 for(const cut of cuts){const a=(state.anchors||[]).find(x=>x.identity.cut===cut);if(!a)continue;
   const posed=batch.lotPosed||(batch.lotPosed=[]),i=posed.findIndex(x=>x.identity.cut===cut&&x.identity.part===a.identity.part);
   const entry={identity:{...a.identity},positions:a.positions,stage:a.stage};if(i>=0)posed[i]=entry;else posed.push(entry);}
}
/* Appuis de départ d'une reprise : les cuts posés par le lot précédent à
 * `frameGap` cuts au plus d'un de ses différés. Aucun cut validé à la main :
 * seulement ce que le Pilote a posé et validé lui-même (cahier §14 I). */
async function currentFrameId(){try{return globalThis.BananeCore3.completeIdentity((await adapter.state()).identity||{}).frameId??null;}catch{return null;}}
function repriseAnchors(prev,part){
 const L=globalThis.BananeLotDecision,S=globalThis.BananeSettings;
 if(!prev||prev.scope?.geometryEngine!==GCV1_ENGINE||prev.scope?.part!==part)throw Error('Reprise : aucun lot Orbite précédent sur cette partie. Décoche « Reprise » ou lance un lot ordinaire.');
 const memory=JSON.parse(JSON.stringify(prev.lotObservation||{anchors:[],pending:[]})),posed=JSON.parse(JSON.stringify(prev.lotPosed||[]));
 const tmp={lotPosed:posed};promouvoirAppuis(tmp,memory,prev.processed,1e6);
 for(const a of memory.anchors||[])if(!tmp.lotPosed.some(x=>x.identity.cut===a.identity.cut))tmp.lotPosed.push({identity:{...a.identity},positions:a.positions,stage:a.stage});
 const gap=L.DEFAULTS.frameGap,deferred=(prev.deferred||[]).map(d=>d.identity?.cut).filter(Number.isInteger);
 if(!deferred.length)throw Error('Reprise : le lot précédent n\'a aucun cut différé.');
 return {fromBatchId:prev.id??null,deferredCuts:deferred.length,anchors:tmp.lotPosed.filter(a=>deferred.some(c=>Math.abs(c-a.identity.cut)<=gap))
   .sort((a,b)=>a.identity.cut-b.identity.cut)};
}
async function openPanel(which='home'){if(!VIEWS.includes(which))throw Error('Vue inconnue.');
 const url=chrome.runtime.getURL(PANEL)+'#'+which;
 // Une fenêtre Banane existe déjà : on la ramène au premier plan et on lui
 // demande de changer de vue, plutôt que d'en empiler une seconde.
 const existing=[...panelWindows.keys()][0]??[...panelPorts.values()][0]?.windowId;
 if(existing!==undefined){try{await chrome.windows.update(existing,{focused:true});
   for(const port of panelPorts.keys()){try{port.postMessage({kind:'navigate',view:which});}catch{/* port fermé */}}
   await syncLauncher();return;}
  catch{panelWindows.delete(existing);}}
 const window=await chrome.windows.create({url,type:'popup',width:560,height:820});
 if(Number.isInteger(window?.id))panelWindows.set(window.id,url);
 await syncLauncher();}
chrome.action.onClicked.addListener(()=>openPanel());
chrome.runtime.onConnect.addListener(port=>{
 const url=port.sender?.url||port.sender?.tab?.url;
 // Le fragment d'URL porte la vue : il ne doit pas fausser la comparaison.
 const sansFragment=(url||'').split('#')[0];
 if(port.name!=='banane-panel-presence'||port.sender?.id!==chrome.runtime.id||sansFragment!==chrome.runtime.getURL(PANEL))return;
 panelPorts.set(port,{url,windowId:port.sender?.tab?.windowId,tabId:port.sender?.tab?.id});
 if(Number.isInteger(port.sender?.tab?.windowId))panelWindows.set(port.sender.tab.windowId,url);
 port.onDisconnect.addListener(()=>{panelPorts.delete(port);void syncLauncher().catch(()=>{});});
 void syncLauncher().catch(()=>{});
});
chrome.windows.onRemoved?.addListener(id=>{panelWindows.delete(id);for(const [port,info] of panelPorts)if(info.windowId===id)panelPorts.delete(port);void syncLauncher().catch(()=>{});});
chrome.tabs.onRemoved?.addListener(id=>{for(const [port,info] of panelPorts)if(info.tabId===id)panelPorts.delete(port);void syncLauncher().catch(()=>{});void contratOublier(id);
 if(id===selectedTab)void ready.then(()=>echoPagePerdue('tab-closed')).catch(()=>{});});
/* 4.9.0.18 (AM-05, audit Écho) — PAGE ESV RECHARGÉE PENDANT ÉCHO. La barrière d'entrée et l'observateur vivent dans le document :
 * après un F5 ils n'existent plus et rien ne le disait (Écho n'envoie aucune commande qui aurait échoué). La session est
 * mise en pause « page perdue », l'alerte s'affiche dans ESV, puis l'observation REPREND TOUTE SEULE quand la page est
 * chargée (réglage `echo.repriseAutomatique`) : réinstallation de l'adaptateur, nouvelle période, aucune commande à ESV. */
async function echoPagePerdue(reason){if(!native?.running())return null;const r=await native.pageLost(reason);await syncLauncher().catch(()=>{});return r;}
/* F5 en Écho (fiches/ECHO_F5.md) — LA REPRISE ATTEND QU'ESV AIT FINI DE CHARGER. Avant, elle partait au premier « complete » de l'onglet,
 * 0,35 s après le F5, alors qu'ESV n'avait ni liste (7 s) ni cut : visite sans identité, puis visites au cut 0 du chargement. Le service
 * worker note ce que l'observateur de la page lui rapporte déjà (pages de liste lues, aucune requête de plus) ; la reprise exige le libellé
 * du cut lisible (`ping.label`, lecture du DOM) ET la liste lue puis silencieuse. Si la liste n'est jamais vue, le libellé doit afficher un
 * cut réel (≥ 1) après `attenteSansListeMs`. Au-delà de `delaiMaxMs` : aucune période, « Connecter puis Reprendre » comme avant. */
const chargementEsv={gen:0,debutMs:Date.now(),listePages:0,derniereListeMs:null};
function chargementEsvReset(){chargementEsv.gen++;chargementEsv.debutMs=Date.now();chargementEsv.listePages=0;chargementEsv.derniereListeMs=null;}
function chargementEsvNoter(entries){if(!Array.isArray(entries))return;
 for(const e of entries)if(e?.kind==='list-page'&&e.status>=200&&e.status<300){const t=Number.isFinite(e.endedEpochMs)?Math.min(e.endedEpochMs,Date.now()):Date.now();
  chargementEsv.listePages++;chargementEsv.derniereListeMs=Math.max(chargementEsv.derniereListeMs??0,t);}}
const repriseEchoDelais=()=>({pollMs:250,silenceListeMs:2500,attenteSansListeMs:10000,delaiMaxMs:60000,...(globalThis.BananeSettings?.echo?.reprise||{})});
function chargementEsvPret(label,R,now=Date.now()){
 if(!Number.isInteger(label?.part)||!Number.isInteger(label?.cut)||label.part<1)return false;/* « partie 0 » : libellé de chargement d'ESV */
 if(chargementEsv.listePages>0)return now-chargementEsv.derniereListeMs>=R.silenceListeMs;
 return label.cut>=1&&label.part>=1&&now-chargementEsv.debutMs>=R.attenteSansListeMs;}
async function echoReprise(tabId){const n=engine?.s?.native;if(!n||n.status!=='PAUSED_ADAPTER_UNRESPONSIVE'||!n.pageLost||n.pageLost.reason==='tab-closed')return;
 if(globalThis.BananeSettings?.echo?.repriseAutomatique===false||n.pageLost.repriseEnCours)return;
 const perdue=n.pageLost,R=repriseEchoDelais();perdue.repriseEnCours=true;await syncLauncher().catch(()=>{});
 let derniere=null,fin=Date.now()+R.delaiMaxMs,genFin=chargementEsv.gen,genEquipe=-1,echecs=0,attente=null;
 try{while(Date.now()<fin){
   if(n.status!=='PAUSED_ADAPTER_UNRESPONSIVE'||n.pageLost!==perdue)return;/* reprise manuelle, session finie : rien à faire */
   if(chargementEsv.gen!==genFin){genFin=chargementEsv.gen;fin=Date.now()+R.delaiMaxMs;}/* nouveau chargement : l'attente repart */
   try{const tab=await chrome.tabs.get(tabId);if(!esvURL(tab.url))throw Error('l’onglet n’affiche plus ESV');
    if(genEquipe!==chargementEsv.gen){await equiperOnglet(tabId);genEquipe=chargementEsv.gen;}
    const ping=await callSur(tabId,'ping');
    if(chargementEsvPret(ping?.label,R)){await native.resume();perdue.repriseEnCours=false;n.pageLost=null;
     n.message='Observation native reprise après le rechargement de la page ESV (nouvelle période, rien d’inventé pendant l’interruption).';
     await engine.save();await syncLauncher().catch(()=>{});return;}
    attente=ping?.label?'liste de coupes pas encore lue':'cut pas encore identifié';}
   catch(e){derniere=e;genEquipe=-1;if(e?.definitif||++echecs>=5)break;await new Promise(r=>setTimeout(r,1500*echecs));continue;}
   await new Promise(r=>setTimeout(r,R.pollMs));}}
 catch(e){derniere=e;}
 if(n.pageLost===perdue){perdue.repriseEnCours=false;
  n.message='Écho : reprise automatique impossible après le rechargement ('+(derniere?.message||'ESV n’a pas fini de charger : '+(attente||'page sans réponse'))+'). Clique sur Connecter puis Reprendre.';
  await engine.save();await syncLauncher().catch(()=>{});}}
chrome.tabs.onUpdated?.addListener((tabId,info,tab)=>{if(tabId!==selectedTab)return;
 if(info.status==='loading')chargementEsvReset();
 void ready.then(async()=>{if(info.status==='loading'&&native?.running())await echoPagePerdue('page-reloaded');
  else if(info.status==='complete'&&esvURL(tab?.url))await echoReprise(tabId);}).catch(()=>{});});
/* 4.7.19 (KI-059) — LA VUE ET LES EXPORTS TIENNENT DANS UN MESSAGE.
 * Un message chrome.runtime est limité à 64 Mio. `records` et `incomplete`
 * grandissent d'un enregistrement par cut (~9 Ko) et sont déjà dans le
 * stockage : le panneau, qui ne les affiche pas, ne les reçoit plus à chaque
 * rafraîchissement ; leur nombre reste donné. Les exports (journal, bilan,
 * diagnostic, corpus) lisent événements et enregistrements directement dans
 * IndexedDB, comme le Natif depuis la 4.5.3 : le message ne porte plus que
 * l'état. */
/* 4.8.0 — ARIANE, ÉCHO, ORBITE (direction, 27/09, D-058). Les textes du
 * moteur épinglé et des modules plus anciens gardent parfois « Banane », « le
 * mode Natif » ou « le Pilote » : ce qui part vers le panneau (message, erreur)
 * passe par ce vocabulaire. Identifiants et formats de données ne changent pas. */
const VOCABULAIRE=[[/\b[Ll]e mode Natif\b/g,'Écho'],[/\bdu mode Natif\b/g,'d’Écho'],[/\bau mode Natif\b/g,'à Écho'],[/\b[Mm]ode Natif\b/g,'Écho'],[/\bNatif\b/g,'Écho'],
 [/\b[Ll]e Pilote\b/g,'Orbite'],[/\bdu Pilote\b/g,'d’Orbite'],[/\bau Pilote\b/g,'à Orbite'],[/\bPilote\b/g,'Orbite'],[/(^|[^A-Za-z0-9_])Banane(?![A-Za-z0-9_]| \(V2\))/g,'$1Ariane']];
const vocabulaire=t=>typeof t==='string'?VOCABULAIRE.reduce((x,[a,b])=>x.replace(a,b),t):t;
function panelView(v){if(!v||typeof v!=='object'||!Array.isArray(v.records)||!Object.hasOwn(v,'collection')||!Object.hasOwn(v,'batch'))return v;
 const {records,incomplete,...rest}=v;
 /* D3 : « fin de partie probable » : une seule règle, celle de la reprise. */
 rest.finDePartieProbable=departOuvert(engine.s.batch);if(avisContrat.lignes.length)rest.avisContrat=avisContrat.lignes.slice();if(typeof rest.notice==='string')rest.notice=vocabulaire(rest.notice);
 if(typeof rest.native?.message==='string')rest.native={...rest.native,message:vocabulaire(rest.native.message)};
 if(typeof rest.batch?.error?.message==='string')rest.batch={...rest.batch,error:{...rest.batch.error,message:vocabulaire(rest.batch.error.message)}};
 /* `lotPosed` (4.7.19, un cut posé = une entrée) : son nombre suffit au panneau. */
 if(Array.isArray(rest.batch?.lotPosed)){const {lotPosed,...batch}=rest.batch;rest.batch={...batch,lotPosedCount:lotPosed.length};}
 return {...rest,recordsCount:records.length,incompleteCount:Array.isArray(incomplete)?incomplete.length:0};}
function exportState(){const {records,incomplete,...rest}=engine.view();return rest;}
/* 4.8.0 (audit qualité, P01) — la vue du panneau, demandée chaque seconde,
 * clonait TOUT l'état (enregistrements compris, un par cut) avant d'en retirer
 * le lourd : 1,1 s par vue à 8 000 cuts sous Node (audit). On retire d'abord
 * (records, incomplete, lotPosed), on clone ensuite ; le panneau n'en lit que
 * les nombres. Même forme que panelView(engine.view()). */
function vuePanneau(){const {records,incomplete,...s}=engine.s,b=s.batch,poses=Array.isArray(b?.lotPosed)?b.lotPosed:null;
 /* La copie est celle du moteur : engine.view() appliqué à l'état allégé. */
 const leger=poses?{...s,batch:(({lotPosed,...x})=>x)(b)}:s,v=engine.view.call({s:leger,busy:engine.busy});
 if(poses)v.batch.lotPosedCount=poses.length;
 return {...panelView({...v,records:[],incomplete:[]}),recordsCount:Array.isArray(records)?records.length:0,incompleteCount:Array.isArray(incomplete)?incomplete.length:0};}
function pollCurrent(){
 /* Pendant une reprise (retour au cut après F5) ou un retour à un cut demandé, la vue ne lit pas ESV. */
 if(pollPromise||engine.busy||engine.task||repriseEnCours||retourCutEnCours||manual?.active()||native?.active()||selectedTab===null)return;
 pollPromise=engine.observe().then(()=>{engine.s.connection={status:'ready',observedAt:new Date().toISOString()};})
  .catch(e=>{engine.s.connection={status:'unavailable',message:e.message};})
  .finally(()=>{pollPromise=null;});
}
/* V1 (test 2) — la mesure ne bloque ni ne fait échouer un export. `timing.flush()`
 * attend déjà au plus 250 ms ses propres écritures ; ici on garde l'appel lui-même :
 * une exception, ou une Promise qui ne se règle jamais, donne une métadonnée
 * « incomplète » (status flush-error ou timeout, flushComplete:false, aucun lot
 * certifié) et l'export continue. Borne dure : 1 s (une valeur inférieure peut être
 * posée par un essai, jamais supérieure). Mesure absente : rien de plus qu'avant. */
async function flushMesure(){if(!timing)return null;
 const limite=Number.isFinite(timing.hardLimitMs)&&timing.hardLimitMs>0?Math.min(1000,timing.hardLimitMs):1000;let timer;
 const incomplet=(status,error)=>({schema:1,status,maxWaitMs:limite,flushComplete:false,pendingWrites:null,lots:[],...(error?{error:String(error?.message||error).slice(0,200)}:{})});
 try{return await Promise.race([Promise.resolve().then(()=>timing.flush()),new Promise(resolve=>{timer=setTimeout(()=>resolve(incomplet('timeout')),limite);})]);}
 catch(e){return incomplet('flush-error',e);}
 finally{clearTimeout(timer);}}
/* V2 — VIDAGE DU CACHE DES EXPORTS (frontière écrite dans src/export-cache.js).
 * Le marqueur (chrome.storage.local, clé à part : l'état du moteur n'est pas touché)
 * dit quand le cache a été vidé ; les exports le recopient (`exportPeriod`). Les lots
 * dont la mesure V1 a été vidée sortent de `v1TimingExport.lots` (leur santé n'est
 * plus dans le journal, ce n'est pas une perte à signaler à chaque export). */
const cacheExport=()=>globalThis.BananeExportCache;
const contexteVidage=depuis=>({state:engine.s,busy:engine.busy,task:engine.task,nativeActive:native.active(),manualActive:manual.active(),timing,graceObservations:graceObservations(depuis)});
/* Un lot vidé n'est masqué de la mesure V1 que s'il est CLOS et dans le même segment qu'au vidage :
 * repris ou rouvert, sa santé redevient visible (aucune mesure V1 masquée). */
const lotVideMasque=(e,t)=>{const id=typeof e==='string'?e:e.id,b=t?.batches?.get?.(id);
 if(!b)return typeof e==='object'?true:true;return b.closed===true&&(typeof e==='string'||e.segment===undefined||b.segment===e.segment);};
async function periodeExport(v1){
 const EC=cacheExport();let mq=null;try{mq=EC?await EC.lire(chrome.storage.local):null;}catch{/* marqueur illisible : période inconnue */}
 const masques=new Set((mq?.lotsVides||[]).filter(e=>lotVideMasque(e,timing)).map(e=>typeof e==='string'?e:e.id));let t=v1;
 if(t&&masques.size&&Array.isArray(t.lots))t={...t,lots:t.lots.filter(l=>!masques.has(l.batchId)),lotsVidesDuCache:t.lots.filter(l=>masques.has(l.batchId)).map(l=>l.batchId)};
 let fichesDepart=[];try{fichesDepart=EC?await EC.lireDeparts(chrome.storage.local):[];}catch{/* illisible : aucune fiche */}
 return {v1TimingExport:t,fichesDepart,exportPeriod:{startedAt:mq?.at??null,previousDataCleared:mq?{at:mq.at,afterExportAt:mq.afterExportAt??null,manual:mq.manuel===true,text:EC.texte(mq),counts:mq.counts??null}:null}};
}
/* Après un vidage, `closureSummary` ne liste plus les coupes sans état final / sans confirmation
 * des enregistrements vidés (l'état du moteur, lui, garde tout : engine.js n'est pas touché). */
async function closureExport(){
 const c=engine.closureSummary(),EC=cacheExport();let mq=null;try{mq=EC?await EC.lire(chrome.storage.local):null;}catch{/* inchangé */}
 if(!mq)return c;
 try{const K=globalThis.BananeCore3,presents=new Set(await store.keys('records')),rs=(engine.s.records||[]).filter(r=>presents.has(r.recordId||r.id));
  return {...c,
   withoutFinalState:rs.filter(r=>r.status==='AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED'||r.status==='incomplete-no-after').map(r=>K.cutId(r.identity||r.before?.identity)),
   withoutServerConfirmation:rs.filter(r=>r.commandSent&&!r.serverConfirmed).map(r=>K.cutId(r.identity)),
   closureScope:'enregistrements depuis le dernier vidage du cache (withoutFinalState, withoutServerConfirmation)'};}
 catch{return c;}
}
/* Test 4 — CAPTURE « AVANT » RESTÉE OUVERTE sur un lot fini (dernier cut différé, posé non validé, sortie d'ESV pendant un cut) :
 * `closeAtExit` / `stopAtLotEnd` ne la referment pas ; le moteur (épinglé) l'archive au prochain `begin()`. Le vidage est permis
 * (src/export-cache.js `refus`) À CONDITION de garder son nuage LiDAR, les événements et visites qui le nomment : ils restent
 * dans le cache et partent au prochain export. Rien n'est lu si aucune capture n'est ouverte. */
async function captureOuverteAGarder(){const EC=cacheExport(),s=engine?.s;
 if(!EC?.capturesAGarder||!s?.lidarId||!(EC.CAPTURES_OUVERTES||[]).includes(s.collection))return null;
 /* DON-1 : l'état de la capture est RELEVÉ ici, avant les deux lectures d'IndexedDB (qui rendent la main au moteur). Relu sur
  * `engine.s` APRÈS les attentes, une capture refermée entre-temps ne donnait plus rien à garder (capt = null) et le « second
  * contrôle » de viderCacheExport comparait null à null. Avec ce relevé, il voit la différence et refuse (« réessaie »). */
 const releve={collection:s.collection,lidarId:s.lidarId,proposal:s.proposal};
 const g=EC.capturesAGarder(releve,await store.all('events'),await store.all('records'));
 return g.clouds.length?{collection:releve.collection,...g}:null;}
async function viderCacheExport(args){
 const EC=cacheExport();if(!EC)throw Error('Vidage indisponible (module absent).');
 const auto=!!args?.auto&&args?.manuel!==true;
 const t0=args?.instantaneAt,depuis=Number.isFinite(t0)&&t0<=Date.now()+1000?t0:Date.now();
 const raison=EC.refus(contexteVidage(depuis),{auto});if(raison)throw Error('Vidage refusé : '+raison+'.');
 const garder={events:[],records:[],clouds:[]};
 const capt=await captureOuverteAGarder();
 if(capt){garder.clouds.push(...capt.clouds);garder.events.push(...capt.events);garder.records.push(...capt.records);}
 /* Une session Écho ou Correction conservée garde ses données (son propre abandon les efface). */
 if(engine.s.native||engine.s.manual){
  garder.clouds.push(...(engine.s.native?.cloudIds||[]),...(engine.s.manual?.cloudIds||[]));
  for(const r of await store.all('records'))if(r.nativeSessionId||r.manualSessionId)garder.records.push(r.recordId||r.id);
  for(const e of await store.all('events'))if(e.nativeSessionId||e.manualSessionId)garder.events.push(e.eventId);}
 /* Les lectures ci-dessus ont rendu la main : si l'état du moteur a changé entre-temps (lot repris, capture refermée ou autre),
  * le refus est réévalué et la capture à garder relue AVANT de supprimer quoi que ce soit. */
 const raison2=EC.refus(contexteVidage(depuis),{auto});if(raison2)throw Error('Vidage refusé : '+raison2+'.');
 const ouverte=engine.s.lidarId&&(EC.CAPTURES_OUVERTES||[]).includes(engine.s.collection)?engine.s.lidarId:null;
 if((capt?.clouds[0]??null)!==ouverte)throw Error('Vidage refusé : la capture ouverte a changé pendant la préparation du vidage ; réessaie.');
 const avant=await EC.lire(chrome.storage.local);
 const lots=[...(timing?.batches?.entries?.()||[])].filter(([,b])=>b.closed===true).map(([id,b])=>({id,segment:b.segment}));
 const counts=await EC.supprimer(store,args?.ids||{},garder,args?.signatures);
 if(!auto)await globalThis.BananeListeMemoire?.effacer(chrome.storage.local).catch(()=>{});/* E1 : vidage manuel = mémoire de la liste aussi */
 /* Gardé à cause de la capture ouverte (parmi ce qui était demandé) : dit au panneau, noté dans le marqueur. */
 const demande=nom=>new Set(args?.ids?.[nom]||[]),compte=(nom,liste)=>{const d=demande(nom);return (liste||[]).filter(i=>d.has(i)).length;};
 const captureGardee=capt?{collection:capt.collection,nuages:compte('clouds',capt.clouds),evenements:compte('events',capt.events),visites:compte('records',capt.records)}:null;
 const marqueur={at:new Date().toISOString(),afterExportAt:auto||args?.manuel!==true?(args?.exportAt||null):null,manuel:args?.manuel===true||!args?.exportAt,
  counts:{events:counts.events,records:counts.records,clouds:counts.clouds},
  ...(captureGardee&&(captureGardee.nuages||captureGardee.evenements||captureGardee.visites)?{captureGardee}:{}),
  lotsVides:[...(avant?.lotsVides||[]).filter(e=>typeof e==='object'&&!lots.some(l=>l.id===e.id)),...lots]};
 /* Le marqueur n'est écrit qu'APRÈS une suppression réussie. */
 let marqueurEcrit=true;try{await EC.ecrire(chrome.storage.local,marqueur);}catch{marqueurEcrit=false;}
 return {cleared:true,...counts,at:marqueur.at,text:EC.texte(marqueur),marqueurEcrit,captureGardee};
}
/* RETOUR À UN CUT (4.9, cadrage « Revenir à un cut », D-067, D-077 point 3) — LECTURE SEULE.
 * Action de panneau `goto-cut` {part, cut} : la page va au cut N de la partie CHARGÉE et
 * en confirme l'identité (`goToCut`, src/adapter-page.js : événement interne d'ESV, sinon
 * pas à pas, sinon refus). Rien n'est validé, skippé ni posé ; le moteur, la pose et la
 * décision sur le lot n'en savent rien ; aucune reprise automatique des différés (hors
 * périmètre, à soumettre séparément). Refusée, sans rien envoyer à ESV, quand :
 *  - un lot Orbite tourne, ou sa pause n'est pas EFFECTIVE (action du moteur encore en
 *    cours), ou la reprise du lot (retour au cut après F5 compris) est en cours ;
 *  - un résultat est à clôturer (navigation différée incertaine, état final manquant,
 *    intention ou réconciliation), une pose est appliquée sans validation, ou une
 *    reprise manuelle tient le contexte du lot ;
 *  - hors d'un lot en pause, une capture assistée ou une proposition est ouverte ;
 *  - une autre demande de retour est en cours (double appel) ;
 *  - Écho est actif (refus général de `dispatch`, plus haut que l'action).
 * Journal `goto-cut`, rangé directement (comme `b1-ombre`, jamais par `engine.event`) :
 * cible, identité avant et après (partie et cut SEULEMENT : ni position, ni repère, ni
 * projet ESV), commande émise (evenement, pas-a-pas, aucune, refus), résultat, durée.
 * CONTRÔLE D'IDENTITÉ AVANT REPRISE (D-067) : la première demande pendant la pause d'un
 * lot retient le cut affiché au départ (`b.retourCut`) ; « Reprendre », « Réessayer »,
 * « SKIP explicite » et « Reprise manuelle » sont refusés tant qu'ESV n'affiche pas de
 * nouveau ce cut. Page rechargée (autre page ESV) : la reprise après F5 ramène elle-même
 * le lot à son cut ; la garde s'efface. */
const PAUSES_LOT=new Set(['PAUSED','STOPPED','PAUSED_ADAPTER_UNRESPONSIVE']);
/* Pendant un retour en vol, ces actions attendent son résultat (elles agiraient sur un cut en mouvement). */
const PENDANT_RETOUR=new Set(['connect','native-start','native-resume','start','resume','retry','manual-takeover','manual-completion','explicit-skip',
 'before','after','lidar','analyze','accept','restore','reconcile','close-uncertain','cancel-before']);
let retourCutEnCours=null;
const partCut=x=>Number.isInteger(x?.part)&&Number.isInteger(x?.cut)?{part:x.part,cut:x.cut}:null;
function journalRetour(ev){try{const K=globalThis.BananeCore3;
 void Promise.resolve(store.putEvent({eventId:K.uid(),timestamp:new Date().toISOString(),type:'goto-cut',schema:1,...ev})).catch(()=>{});}catch{/* le journal n'est pas critique */}}
function refusRetour(){const b=engine.s.batch,s=engine.s;
 if(retourCutEnCours)return ['DEJA_EN_COURS','Un retour à un cut est déjà en cours : attends son résultat (une seule demande à la fois).'];
 if(selectedTab===null)return ['SANS_ONGLET','Sélectionne un onglet ESV.'];
 if(repriseEnCours)return ['REPRISE_EN_COURS','Reprise du lot en cours : aucune navigation de consultation.'];
 if(b?.state==='RUNNING')return ['LOT_EN_COURS','Lot Orbite en cours : mets-le en pause avant d’aller à un autre cut.'];
 if(engine.task||engine.busy)return ['PAUSE_NON_EFFECTIVE','Une action d’Ariane est encore en cours (lecture, pose, validation ou déplacement) : attends que la pause soit effective.'];
 if(b?.state==='MANUAL_TAKEOVER')return ['REPRISE_MANUELLE',`Reprise manuelle en cours sur le cut ${b.manualTakeover?.identity?.cut??b.activeIdentity?.cut} : termine-la avant d’aller à un autre cut.`];
 if(['PAUSED_DEFER_NAVIGATION_UNCERTAIN','PAUSED_AFTER_STATE_MISSING'].includes(b?.state)||engine.deferPending?.()||s.intent||s.reconcileRequired)
  return ['INCERTITUDE_A_CLORE','Un résultat incertain reste à clôturer : contrôle ESV et clôture-le avant toute navigation.'];
 if(s.applied)return ['POSE_NON_VALIDEE','Une pose d’Ariane est appliquée et pas encore validée : valide-la, restaure-la ou archive-la avant d’aller à un autre cut.'];
 const enPause=!!b&&PAUSES_LOT.has(b.state);
 if(!enPause&&s.before&&['BEFORE_CAPTURED','READY_FOR_AFTER'].includes(s.collection))return ['CAPTURE_OUVERTE','Une capture est ouverte : termine-la ou annule-la avant d’aller à un autre cut.'];
 if(!enPause&&s.proposal)return ['PROPOSITION_OUVERTE','Une proposition est ouverte : applique-la, rejette-la ou annule la capture avant d’aller à un autre cut.'];
 return null;}
/* Plus grand cut connu de la partie (cut du lot, cuts traités, cut retenu) : borne de la cible quand le compteur d'ESV est illisible. */
function borneConnue(part){const b=engine.s.batch,vus=[];
 if(b?.scope?.part===part)for(const x of [b.activeIdentity,...(b.processed||[]),...(b.skipped||[]),...(b.deferred||[])]){const c=x?.cut??x?.identity?.cut;if(Number.isInteger(c))vus.push(c);}
 const o=b?.retourCut?.origine;if(o?.part===part)vus.push(o.cut);return vus.length?Math.max(...vus):null;}
async function allerAuCut(args){const t0=Date.now(),K=globalThis.BananeCore3,S=globalThis.BananeSettings?.retourCut||{};
 const cible={part:Number.isInteger(args?.part)?args.part:null,cut:Number.isInteger(args?.cut)?args.cut:null},b=engine.s.batch;
 const base={cible,lotId:b?.id??null,etatLot:b?.state??null};
 const refus=(code,message,avant=null)=>{journalRetour({...base,operationId:null,identiteAvant:avant,identiteApres:null,commande:'refus',chemin:null,emissions:0,resultat:'refuse',code,message,dureeMs:Date.now()-t0});
  return {ok:false,resultat:'refuse',code,message,cible,identiteAvant:avant,identiteApres:null,commande:'refus',emissions:0,dureeMs:Date.now()-t0};};
 if(cible.part===null||cible.cut===null||cible.cut<0)return refus('CIBLE_INVALIDE','Cible invalide : une partie et un cut entiers, cut positif ou nul.');
 const r=refusRetour();if(r)return refus(...r);
 const operationId=K.uid();retourCutEnCours={operationId,depuis:t0,cible};
 try{
  /* Cut affiché AVANT toute émission (lecture seule) : la garde de reprise en a besoin même si la page ne répond pas ensuite. */
  let lu=null;try{lu=(await call('ping'))?.label||null;}catch(e){return refus('ESV_ILLISIBLE',`ESV ne répond pas (${e.message}) : aucune navigation.`);}
  if(!partCut(lu))return refus('ESV_ILLISIBLE','« Cut N of part P » illisible dans ESV : aucune navigation.');
  const enPause=!!b&&PAUSES_LOT.has(b.state)&&engine.s.batch===b,garde=enPause&&!b.retourCut;
  if(garde){b.retourCut={origine:{pageId:lu.pageId??null,part:lu.part,cut:lu.cut},depuis:new Date().toISOString()};await engine.save();}
  let ev=null,erreur=null;
  try{ev=await call('goToCut',cible,{chemin:S.chemin,borneConnue:borneConnue(cible.part)},operationId);}catch(e){erreur=e;}
  /* Rien n'est parti : la garde posée par cette demande n'a pas lieu d'être. */
  if(garde&&ev&&ev.emissions===0&&ev.commandInvoked===false&&b.retourCut){delete b.retourCut;await engine.save();}
  const commande=erreur?'inconnue':ev.chemin==='evenement'?'evenement':ev.chemin==='pas-a-pas'?'pas-a-pas':ev.resultat==='refuse'?'refus':'aucune';
  const resultat=erreur?'incertain':ev.resultat,code=erreur?'ADAPTATEUR':ev.refusal?.code??null,message=erreur?erreur.message:ev.refusal?.message??null;
  const out={ok:resultat==='confirme',resultat,code,message,cible,operationId,identiteAvant:partCut(ev?.identiteAvant)||partCut(lu),identiteApres:partCut(ev?.identiteApres),
   commande,chemin:ev?.chemin??null,emissions:ev?.emissions??null,pas:ev?.pas?{demandes:ev.pas.demandes,faits:ev.pas.faits}:null,pret:ev?.pret??null,
   pauseExplicite:erreur?true:ev.pauseExplicite===true,gardeReprise:partCut(b?.retourCut?.origine),dureeMs:Date.now()-t0};
  journalRetour({...base,operationId,identiteAvant:out.identiteAvant,identiteApres:out.identiteApres,commande,chemin:out.chemin,emissions:out.emissions,pas:out.pas,
   cheminEvenement:ev?.cheminEvenement?.raison??(ev?.cheminEvenement?.disponible?'disponible':null),cheminPas:ev?.cheminPas?.raison??(ev?.cheminPas?.disponible?'disponible':null),
   bornes:ev?.bornes?{source:ev.bornes.source,total:ev.bornes.total}:null,pret:out.pret,resultat,code,message,dureeMs:out.dureeMs,dureePageMs:ev?.durationMs??null,gardeReprise:out.gardeReprise});
  return out;
 }finally{retourCutEnCours=null;}}
/* D-067 : contrôle d'identité avant toute action du lot qui part du cut affiché. `affiche` : l'état déjà relu
 * (reprise) ; sinon le libellé est relu ici. Illisible : la reprise est refusée ; pour les autres actions, le
 * moteur relit et contrôle lui-même le cut du lot. */
async function gardeRetourCut(quoi,affiche=undefined,{rattache=false}={}){const b=engine.s.batch,o=b?.retourCut?.origine;if(!o)return;
 if(rattache){delete b.retourCut;await engine.save();return;}
 let l=affiche===undefined?null:affiche?.identity??null;
 if(affiche===undefined){try{l=(await call('ping'))?.label||null;}catch{return;}if(!partCut(l))return;}
 if(l&&o.pageId!=null&&l.pageId!=null&&l.pageId!==o.pageId){delete b.retourCut;await engine.save();return;}
 if(!partCut(l)||l.part!==o.part||l.cut!==o.cut)throw Error(`${quoi} refusé : le lot est en pause sur le cut ${o.cut} de la partie ${o.part}, ESV affiche ${partCut(l)?`le cut ${l.cut} de la partie ${l.part}`:'un cut illisible'} (consultation). Reviens au cut ${o.cut} dans ESV, puis recommence ; rien n’a été validé.`);
 delete b.retourCut;await engine.save();}
/* B3 — transition « demarrage » : le corps de « Démarrer », inchangé (déplacé de `dispatch`). */
async function demarrerLot(args){
  // Avant tout archivage : un lot en reprise manuelle garde son contexte.
  engine.assertBatchContextFree('un nouveau lot');
  /* 4.7.21 : « fin de partie » demandée, ou fin saisie retenue pour la partie. */
  const finPartie=args?.endMode==='partie';
  if(!finPartie&&Number.isInteger(args?.end))await retenirFinPartie(args.part,args.end,'saisie');
  if(engine.s.before&&!engine.s.applied&&!engine.s.intent)await engine.archivePending('new-automatic-batch');
  /* GARDE-FOU DÉCOUVERT SUR LE TERRAIN, cut 6/4245.
   *
   * Une sélection du cerveau porte `confidence: 0` pour que le pilote la mette
   * en pause. Mais `src/engine.js` — gelé, ligne 233 — ne met en pause que
   * si `scope.lowConfidence !== 'attempt'`. Avec la politique « Tenter la
   * proposition expérimentale », le pilote a donc appliqué tout seul une
   * sélection explicitement marquée « jamais à appliquer automatiquement ».
   *
   * La confiance nulle ne suffit pas : on coupe la sélection à la source quand
   * la politique permet de tenter. Le cerveau continue de retirer le biais
   * vertical — cette correction-là garde la confiance du moteur et n'a jamais
   * été en cause. Un rail ambigu redevient alors `unresolved`, ce qui met le
   * lot en pause par le chemin `missing`, avant même la question de confiance. */
  const geometryEngine=args?.geometryEngine||V46_ENGINE;
  if(![V46_ENGINE,GCV1_ENGINE].includes(geometryEngine))throw Error('Moteur géométrique de lot inconnu.');
  const startArgs={...args,geometryEngine,...(finPartie?{end:FIN_PARTIE}:{})};
  if(geometryEngine===GCV1_ENGINE){
    startArgs.geometryContract=liveGCV1Contract();
    startArgs.requestedLowConfidence=args?.lowConfidence||null;
    // La publication GCV1 est la frontière d'admissibilité du lot TEST : une
    // candidate finie, y compris S1 à confiance non calibrée, n'est pas
    // repassée dans le seuil de confiance historique V4.6.
    startArgs.lowConfidence='attempt';
    /* 4.7.10 — décision sur le lot, figée dans le scope à la création : elle
     * commande seulement si le lot est créé avec « appliquer » (D-041, D-042). */
    if(args?.lotDecision!==undefined&&!['apply','observe'].includes(args.lotDecision))throw Error('Décision sur le lot inconnue.');
    startArgs.lotDecision=args?.lotDecision==='apply'?'apply':'observe';
  }else delete startArgs.lotDecision;
  /* 4.7.18 (relecture 4.7.16, I1) : la version qui CRÉE le lot, figée dans son
   * scope ; le rejeu la préfère à la version de l'export, qui peut être plus récente. */
  startArgs.extensionVersion=VERSION;
  if(finPartie)startArgs.endMode='partie';else delete startArgs.endMode;
  /* 4.7.19 — REPRISE DES DIFFÉRÉS : les appuis de départ sont figés dans le scope. */
  delete startArgs.lotReprise;
  if(args?.lotReprise===true){if(geometryEngine!==GCV1_ENGINE)throw Error('Reprise : réservée à Orbite GCV1.');
    startArgs.lotReprise=repriseAnchors(engine.s.batch,args.part);
    /* 4.7.20 — les appuis d'une reprise sont liés au repère de la page ESV
     * (`frameId`) : après un rechargement, aucun ne sert (terrain du 25/09,
     * partie 9). Refusé en clair plutôt que lancé sans effet. */
    const frame=await currentFrameId(),seeds=startArgs.lotReprise.anchors||[];
    if(frame&&seeds.length&&!seeds.some(a=>(a.identity?.frameId??null)===frame))
      throw Error('Reprise : la page ESV a été rechargée depuis le lot précédent (autre repère) ; ses cuts posés ne peuvent plus servir d’appuis. Décoche « Reprise » ou lance un lot ordinaire.');}
  const tente=startArgs.lowConfidence==='attempt';
  const autorise=BananeGeometryBrain.reglages().autoriserSelectionSansPause===true;
  BananeGeometryBrain.configure({selectionActive:!tente||autorise});
  retenirLotClos();await engine.startBatch(startArgs);return engine.view();}
async function dispatch(m){await ready;const {action,args={}}=m;
 if(action==='goto-cut-cancel'){const r=retourCutEnCours;if(!r)return {cancelRequested:false,reason:'aucun-retour'};
  await adapter.cancel({operationId:r.operationId,reason:'goto-cut-cancel'}).catch(()=>{});return {cancelRequested:true,operationId:r.operationId};}
 if(retourCutEnCours&&PENDANT_RETOUR.has(action))throw Error('Retour à un cut en cours : attends son résultat, ou annule-le.');
 if(action==='open-window'){await openPanel(args.window);return {opened:true};}
 if(action==='liste-instantanes'||action==='liste-resume')return listeAction(action,args);
 if(action==='fiches-depart'){const EC=cacheExport();return {fiches:EC?await EC.lireDeparts(chrome.storage.local):[]};}
 if(action==='export-cache-info'){const EC=cacheExport(),c=contexteVidage(),refus=EC?EC.refus(c,{auto:args?.auto===true}):'module absent';
  /* Test 4 : ce que la capture ouverte retient (identifiants), pour que la confirmation le dise et ne le compte pas parmi ce qui sera supprimé. */
  return {refus,reprenable:EC?EC.reprenable(c):false,marqueur:EC?await EC.lire(chrome.storage.local):null,capture:refus===null?await captureOuverteAGarder():null};}
 if(action==='export-cache-clear')return viderCacheExport(args);
 if(action==='bornes-partie'){const t=await finsParties(),f=t[Number(args?.part)];return f?{part:Number(args.part),last:f.last,source:f.source,at:f.at}:null;}
 if(action==='bandeau-etat'){const r=await chrome.storage.local.get('banane4Bandeau');bandeau.on=r?.banane4Bandeau===true;return {on:bandeau.on};}
 if(action==='bandeau'){bandeau={on:args.on===true,text:String(args.text||'').slice(0,200),ton:['vert','ambre','rouge'].includes(args.ton)?args.ton:''};
  await chrome.storage.local.set({banane4Bandeau:bandeau.on});await syncLauncher();return {on:bandeau.on};}
 /* 4.9.0.16 (test 15) : de quoi distinguer deux onglets ESV au même titre (fenêtre, rang, onglet actif,
  * prêt ou non, celui qu'Ariane utilise). Aucune adresse n'est rendue au panneau. */
 if(action==='list-tabs')return (await chrome.tabs.query({url:'https://esv.lidar.altametris.xyz/rails_validation/*'})).map(t=>({id:t.id,title:t.title,
  windowId:t.windowId??null,index:Number.isInteger(t.index)?t.index:null,active:t.active===true,pret:t.status!=='loading'&&t.discarded!==true,utilise:t.id===selectedTab}));
 if(action==='connect'){
  if(engine.busy||engine.task||manual.running()||native.running())throw Error('Termine l’activité en cours avant de changer d’onglet.');
  if(repriseEnCours)throw Error('Reprise du lot en cours : attends qu’elle se termine.');
  const tab=await chrome.tabs.get(Number(args.tabId));if(!esvURL(tab.url))throw Error('Onglet ESV invalide.');
  // Only extension-origin UI requests can inject the fixed, bundled adapter.
  await equiperOnglet(tab.id);selectedTab=tab.id;await chrome.storage.local.set({banane3Tab:selectedTab});
  await engine.observe();engine.s.connection={status:'ready',observedAt:new Date().toISOString()};await engine.save();return engine.view();}
 if(action==='view'){pollCurrent();const v=vuePanneau();return {...v,assistGauge:assistGauge(v)};}
 // V4.6.0 : une reprise manuelle est un lot actif. Le mode Natif ne prend pas sa place.
 if(action==='native-start'){engine.assertBatchContextFree('démarrer Écho');
  /* 4.9.0.18 (AM-23, AM-06) : libellé du cut illisible = aucune identité pour toute la séance : refus ; plusieurs onglets ESV : dit. */
  let vu=await call('nativeSnapshot').catch(e=>e);
  /* F5 hors séance : la page rechargée n'a plus d'adaptateur. « Connecter » ferait la même chose (injection locale, aucune requête à ESV) ;
   * sinon le démarrage échouait en laissant une session et une période fantôme à chaque clic (fiches/ECHO_F5.md). */
  if(vu instanceof Error){try{await equiperOnglet(selectedTab);vu=await call('nativeSnapshot');}
   catch(e){if(e?.definitif)throw e;throw Error('Écho non démarré : la page ESV ne répond pas ('+(e?.message||vu.message)+'). Clique sur Connecter, puis réessaie.');}}
  if(vu&&(!Number.isInteger(vu.identity?.part)||!Number.isInteger(vu.identity?.cut)))throw Error('Écho refusé : le libellé du cut n’est pas lisible dans ESV (« Cut N of part M » attendu). Ouvre un cut, puis réessaie.');
  const onglets=(await chrome.tabs.query({url:'https://esv.lidar.altametris.xyz/rails_validation/*'}).catch(()=>[])).length;
  const v=await native.start();const n=engine.s.native;
  if(n&&onglets>1){n.message=`Observation native active sur l’onglet choisi seulement (${onglets} onglets ESV ouverts : travaille dans celui-ci).`;await engine.save();}
  return v;}
 if(action==='native-pause')return native.pause();
 if(action==='native-resume')return native.resume();
 if(action==='native-end')return native.end({dataset:false});
 if(action==='native-download')return native.dataset();
 // V4.5-R : export segmenté. Le panneau demande un plan (métadonnées + nuages
 // pas encore écrits), écrit le segment, puis acquitte les identifiants.
 if(action==='native-health')return native.health();
 if(action==='native-export-advice')return native.exportAdvice();
 if(action==='native-export-manifest')return native.exportManifest(args?.all===true);
 if(action==='native-export-plan')return native.exportPlan();
 if(action==='native-export-ack')return native.ackExported(args?.ids||[],{confirmes:Array.isArray(args?.confirmed)?args.confirmed:[],fichiers:args?.fichiers});
 // Abandon : irréversible, sans export. La confirmation est demandée côté panneau.
 if(action==='native-discard')return native.discard();
 // État du cerveau : ce qu'il est réglé à faire, et ce qu'il a fait au dernier passage.
 if(action==='brain-state')return {...BananeGeometryBrain.reglages(),ajuste:BananeGeometryBrain.AJUSTE,dernier:BananeGeometryBrain.journal()};
 // Gates internes GCV1 : shadow et actif Assisté sont OFF à chaque démarrage
 // du service worker. Elles n'accordent aucun accès à l'adaptateur ; seule la
 // géométrie rendue par l'appel Assisté explicitement armé peut changer.
 if(action==='gcv1-shadow-state')return {...BananeGCV1Shadow.state(),dernier:BananeGCV1Shadow.journal()};
 if(action==='gcv1-shadow-configure'){
   if(engine.busy||engine.task||manual.running()||native.running())throw Error('Termine l’activité en cours avant de changer le shadow GCV1.');
   const options={};
   if(Object.prototype.hasOwnProperty.call(args||{},'enabled'))options.enabled=args.enabled;
   if(Object.prototype.hasOwnProperty.call(args||{},'activeAssisted'))options.activeAssisted=args.activeAssisted;
   // Flanc partiel (cahier 4.8, amendement n°3) : actif par défaut, coupable sans rebuild.
   if(Object.prototype.hasOwnProperty.call(args||{},'partialFlank'))options.partialFlank=args.partialFlank;
   // Calage de convention (amendement n°4) : actif par défaut, coupable pour un essai.
   if(Object.prototype.hasOwnProperty.call(args||{},'convention'))options.convention=args.convention;
   return BananeGCV1Shadow.configure(options);
 }
 // Exports GCV1 strictement manuels : ils relisent les événements et les
 // captures déjà persistés. Aucun calcul géométrique ni appel adaptateur.
 if(action==='gcv1-export-meta')return {version:VERSION,sessionId:engine.s.sessionId,state:exportState()};
 if(action==='gcv1-diagnostic-export')return BananeGCV1Export.buildDiagnostic({version:VERSION,
   sessionId:engine.s.sessionId,state:engine.view(),events:await store.all('events')});
 if(action==='gcv1-corpus-export-plan'){
   const diagnostic=BananeGCV1Export.buildDiagnostic({version:VERSION,sessionId:engine.s.sessionId,
     state:engine.view(),events:await store.all('events')});
   return BananeGCV1Export.buildCorpusPlan({diagnostic,getCloud:id=>store.getCloud(id)});
 }
 // V4.5.7 — le mode Correction est retiré : aucune nouvelle session ne peut
 // être démarrée, et la page ESV ne reçoit plus manual-page.js. Fermeture et
 // téléchargement restent ouverts pour récupérer une session déjà enregistrée
 // avant la mise à jour : la retirer ne doit pas rendre ses données illisibles.
 if(['manual-start','manual-pause','manual-resume'].includes(action))
  throw Error('Le mode Correction a été retiré en 4.5.4. Utilise Écho.');
 if(action==='manual-end')return manual.end();
 if(action==='manual-download')return manual.dataset();
 if(native.active()&&!['cloud','native-download','native-health','native-export-advice','native-export-manifest','native-export-plan','native-export-ack','native-discard'].includes(action))throw Error('Écho est actif. Termine-le avant d’utiliser Mes corrections, l’assisté ou le pilote.');
 if(manual.active()&&!['cloud','journal','dataset'].includes(action))throw Error('Une session est active dans Mes corrections. Termine-la avant de piloter un lot ou d’utiliser l’assisté.');
 if(action==='goto-cut')return allerAuCut(args);
 if(action==='pause')return coordinateurLot.transition('pause',async()=>{await engine.pause();return engine.view();});
 if(action==='stop')return coordinateurLot.transition('arret',async()=>{const b=engine.s.batch,ouvert=!!b&&!OBS_CLOS.includes(b.state),fin=engine.stop();
  if(ouvert&&engine.s.batch===b)marquerFinLot(b,'arret-manuel');await fin;return engine.view();});
 if(action==='resume')return coordinateurLot.transition('reprise',async()=>{if(repriseEnCours)throw Error('Reprise déjà en cours : patiente.');
  if(lotTermine(engine.s.batch)){engine.s.notice=`Lot déjà terminé : ${engine.s.batch.stoppedAtEnd.reason==='navigation-other-part-after-defer'?'fin de la partie retenue':'dernier cut de la partie atteint'} (cut ${engine.s.batch.stoppedAtEnd.cut}). Rien n’est rejoué ; pour continuer, clique sur « Nouveau lot ».`;await engine.save();return engine.view();}
  repriseEnCours=true;try{await reprendreLot();}finally{repriseEnCours=false;}return engine.view();});
 /* 4.7.18 (KI-055, chantier 5) : « Réessayer ce cut » relit une capture. Si
  * l'opérateur a déplacé les rails pendant la pause, cette capture serait SA
  * pose, qui entrerait dans le moteur et la décision sur le lot (cahier §10,
  * §14 I) : refusé, comme « Reprendre » (« Rails modifiés depuis la lecture
  * interrompue »). `src/engine.js` est épinglé : le contrôle vit ici. */
 if(action==='retry'){await gardeRetourCut('« Réessayer »');const ref=engine.s.before?.rails;
   if(ref){const now=await engine.adapter.state();
     if(!globalThis.BananeCore3.equalPoses(ref,now.rails))throw Error('Rails modifiés pendant la pause : « Réessayer » analyserait ta pose, il est refusé. Choisis Reprise manuelle ou SKIP explicite.');}
   await engine.retryPaused();return engine.view();}
 if(action==='manual-takeover'){await gardeRetourCut('« Reprise manuelle »');await engine.manualTakeover();return engine.view();}
 // V4.6.0 : l'opérateur déclare avoir traité le cut lui-même ; le lot reprend au suivant.
 if(action==='manual-completion'){await engine.manualCompletion();return engine.view();}
 /* OBS-1 (relecture du test 3) : un SKIP explicite du dernier cut d'un lot borné clôt le lot HORS de la boucle du moteur
  * (pas de jalon `batch-state`) : la fin est relevée ici, comme pour « Arrêter », sinon l'écriture SKIP arrive sans grâce. */
 if(action==='explicit-skip'){await gardeRetourCut('« SKIP explicite »');const b=engine.s.batch,ouvert=!!b&&!OBS_CLOS.includes(b.state);await engine.skipPaused();
  if(ouvert&&engine.s.batch===b&&(b.state==='COMPLETED'||b.state==='FINISHED_WITH_UNCONFIRMED_ACTIONS')){coordinateurLot.transition('fin-de-lot',()=>marquerFinLot(b,'fin-naturelle'));cloreMesureHorsBoucle();}return engine.view();}
 if(action==='start')return coordinateurLot.transition('demarrage',()=>demarrerLot(args));
 if(action==='cloud')return store.getCloud(args.id);
 /* Métadonnées d'export sans événements ni enregistrements : le panneau les lit
  * directement dans IndexedDB (4.7.19, KI-059). `stateOmits` dit ce qui manque
  * à l'état, rangé ailleurs dans le même fichier. */
 const exporte=['journal-meta','dataset-meta','journal','dataset'].includes(action),periode=exporte?await periodeExport(await flushMesure()):null;
 const v1TimingExport=periode?.v1TimingExport??null;
 const timingMeta={...(v1TimingExport?{v1TimingExport}:{}),...(periode?{exportPeriod:periode.exportPeriod}:{}),...(periode?.fichesDepart?.length?{fichesDepart:periode.fichesDepart}:{})};
 /* 4.9.0.16 (test 15, 5c) : les 64 dernières transitions du lot (B3), dans le journal exporté. */
 const transitionsLot=coordinateurLot.journal.map(t=>({nom:t.nom,lot:t.lot,etat:t.etat,at:t.at??null}));
 if(action==='journal-meta')return {...timingMeta,format:'banane-test-journal-v4',version:VERSION,state:exportState(),stateOmits:['records','incomplete'],closureSummary:await closureExport(),transitionsLot};
 if(action==='dataset-meta')return {...timingMeta,format:'banane-test-dataset-v4',version:VERSION,exportedAt:new Date().toISOString(),state:exportState(),stateOmits:['records','incomplete'],closureSummary:await closureExport(),cloudIds:await store.keys('clouds')};
 /* 4.9.0.18 (KI-068) : le journal et le bilan d'Orbite rendus par message (repli du panneau) ne portent plus les visites ni les
  * événements d'Écho et de Correction ; même règle que le panneau (`lireStoreOrbite`) et tools/filtrer-journal.cjs. */
 if(action==='journal'){const o=await lotSeul();return {...timingMeta,format:'banane-test-journal-v4',version:VERSION,state:engine.view(),events:o.events,records:o.records,...o.scope,closureSummary:await closureExport(),transitionsLot};}
 if(action==='dataset'){const o=await lotSeul();return {...timingMeta,format:'banane-test-dataset-v4',version:VERSION,exportedAt:new Date().toISOString(),state:engine.view(),events:o.events,records:o.records,...o.scope,closureSummary:await closureExport(),cloudIds:await store.keys('clouds')};}
 return engine.locked(async()=>{
  let result;
  if(action==='settings'){
    if(!['observation','assisted','automatic-test'].includes(args.mode))throw Error('Mode invalide.');
    const settings={...engine.s.settings};
    for(const k of ['minConfidence','searchY','searchZ'])if(args[k]!==undefined){
      const v=Number(args[k]),ranges={minConfidence:[0,100],searchY:[.01,.15],searchZ:[.01,.08]};
      if(!Number.isFinite(v)||v<ranges[k][0]||v>ranges[k][1])throw Error('Paramètre invalide : '+k);settings[k]=v;}
    // Le cerveau vit hors des réglages géométriques : ce ne sont pas des seuils
    // du moteur, et ils ne doivent pas se retrouver dans `settings` que le
    // moteur gelé valide.
    if(args.brain!==undefined)BananeGeometryBrain.configure({actif:args.brain===true});
    if(args.brainSelectionSansPause!==undefined)
     BananeGeometryBrain.configure({autoriserSelectionSansPause:args.brainSelectionSansPause===true});
    engine.s.mode=args.mode;engine.s.settings=settings;
    result=engine.view();
  }else if(action==='before')result=await engine.begin();
  else if(action==='after')result=await engine.finish();
  else if(action==='lidar')result=await engine.standalone();
  else if(action==='analyze')result=await engine.analyze();
  else if(action==='accept')result=await engine.apply(false);
  else if(action==='reject'){engine.s.proposal=null;await engine.event('proposal-rejected');result=engine.view();}
  else if(action==='restore')result=await engine.restore();
  else if(action==='reconcile')result=await engine.reconcile();
  else if(action==='close-uncertain'){result=await engine.closeUncertain();cloreMesureHorsBoucle();}
  else if(action==='cancel-before'){await engine.archivePending('operator-cancelled');result=engine.view();}
  else if(action==='references')result=await engine.exportReferences();
  else throw Error('Commande inconnue.');return result;
 });
}
let swPret=false;ready.then(()=>{swPret=true;},()=>{});
chrome.runtime.onMessage.addListener((m,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 if(m.kind==='launcher-status'&&sender.tab?.id&&esvURL(sender.url||sender.tab?.url)){
  // Onglet choisi : en plus, l'état de séance de l'observateur passif (le pont en tire sa demande de marque).
  respond(sender.tab.id===selectedTab?{...launcherState(),observation:{seance:globalThis.BananeSettings?.observateurPassif?.actif!==false&&!!seanceObservateur()}}:launcherState());return;}
 if(m.kind==='heartbeat'){respond({ok:true});return;}
 if(m.kind==='esv-releve'&&sender.tab?.id===selectedTab&&esvURL(sender.url||sender.tab?.url)){rangerReleve(m.releve);return;}
 /* OBS-3 (relecture du test 3) : le message qui réveille le service worker arrive avant `ready` (onglet choisi et fins
  * pas encore relus) ; il était ignoré sans réponse et ses entrées, déjà retirées de la file du pont, perdues sans trace.
  * Il est maintenant traité une fois `ready` résolu. */
 if(m.kind==='esv-observation'&&sender.tab?.id&&esvURL(sender.url||sender.tab?.url)){
  if(sender.tab.id===selectedTab)chargementEsvNoter(m.entries);
  if(swPret){if(sender.tab.id===selectedTab)respond(rangerObservations(m));return;}
  ready.then(()=>respond(sender.tab.id===selectedTab?rangerObservations(m):{accept:false,reason:'other-tab'}),()=>respond({accept:false,reason:'not-ready'}));return true;}
 if(m.kind==='manual-event'&&sender.tab?.id===selectedTab&&esvURL(sender.url)){
  ready.then(()=>manual.receive(m.type,m.payload)).then(result=>respond({result}),e=>respond({error:e.message}));return true;
 }
 if(m.kind==='native-event'&&sender.tab?.id===selectedTab&&esvURL(sender.url)){
  ready.then(()=>native.receive(m.type,m.payload)).then(result=>respond({result}),e=>respond({error:e.message}));return true;
 }
 if(m.kind==='adapter-trace'&&sender.tab?.id===selectedTab&&esvURL(sender.url)){
  timing?.progress(m);
  ready.then(()=>{if(m.action==='capture')engine.s.captureProgress={stage:m.lastStage,...m.lastDetail};
    return engine.event('adapter-progress',{requestId:m.requestId,action:m.action,elapsedMs:m.elapsedMs,acknowledged:m.acknowledged,lastStage:m.lastStage,lastDetail:m.lastDetail});}).then(()=>respond({ok:true}),e=>respond({error:e.message}));return true;
 }
 if(m.kind==='open-panel'){openPanel().then(()=>respond({ok:true}),e=>respond({error:e.message}));return true;}
 // Le fragment d'URL porte la vue affichée ; seule l'origine de la page compte.
 if(m.kind!=='panel'||(sender.url||'').split('#')[0]!==chrome.runtime.getURL(PANEL))return;
 /* 4.7.19 (KI-059) : une réponse trop grosse pour Chrome devient une erreur dite
  * en clair au panneau, au lieu d'un envoi qui échoue sans réponse. */
 dispatch(m).then(result=>{try{respond({result:m.action==='view'?result:panelView(result)});}
   catch(e){respond({error:`Réponse d’Ariane trop grosse pour un message Chrome (${m.action}) : ${e.message}`});}},
  e=>coordinateurLot.transition('erreur',async()=>{const message=vocabulaire(e.message);if(engine){engine.s.notice=message;await engine.save().catch(()=>{});}respond({error:message});}));return true;
});
