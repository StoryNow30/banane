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
 'src/geometry-candidate-v1.js','src/placement-convention.js','src/faux-vert-ombre.js','src/hauteur-apprise.js','src/continuity-observer.js','src/level-crossing.js','src/lot-decision.js','src/gcv1-shadow.js',
 'src/gcv1-export.js','src/engine.js','src/storage.js','src/manual-session.js','src/raison-correction.js','src/native-session.js','src/export-cache.js','src/historique-parties.js','src/file-parties.js','src/correction-liste.js','src/appuis-liste.js','src/liste-memoire.js','src/voie-recentree.js','src/regles-metier.js','src/verts-a-controler.js','src/relecture-ombre.js','src/relecture-critere.js','src/garde-passe-appuis.js','src/garde-apres-differe.js','src/recherche-large.js','src/gcv2-parametres-l1.js','src/gcv2-l1e.js','src/gcv2-l1.js','src/gestes-vue.js','src/deplacement-vue.js');
const store=new BananeStorage3();let selectedTab=null,engine,manual,native,pollPromise=null,timing=null;
const VERSION=globalThis.BananeCore3?.VERSION||'4.9.5.31',VERSION_NAME=globalThis.BananeCore3?.VERSION_NAME||'4.9.5 test 31 (F-V-G-S)';
/* 4.7.21 — CERVEAU DE PLACEMENT ACTIF PAR DÉFAUT (direction, 26/09 : « tout
 * cela, je l'active à chaque fois »). Son état vivait en mémoire du service
 * worker et repartait éteint à chaque redémarrage de Chrome. Dans un lot
 * Pilote GCV1, il ne touche pas les positions posées (la sélection est celle
 * de GCV1) : il agit sur la proposition V4.6 consignée pour comparaison. Les
 * sélections sont autorisées en mode « Tenter », que le lot GCV1 force déjà. */
BananeGeometryBrain.configure({actif:true,autoriserSelectionSansPause:true});
const PAGE_FILES=['vendor/capture-core.js','vendor/lidar.js','src/core.js','src/settings.js','src/lod-signature.js','src/merge-clouds.js','src/native-lidar.js','src/native-page.js','src/gestes-vue.js','src/deplacement-vue.js','src/adapter-page.js'];
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
/* Audit P-5 (H16) — CHAQUE ERREUR PORTE LE LOT ET L'HEURE DE SA DEMANDE. Une réponse peut arriver longtemps après la demande (test 6 : un
 * `cancel` demandé pendant la pause de L2, attente de 45 s expirée en plein L3, rangé sur un cut de L3) : `adapter-result` porte le lot ouvert,
 * l'heure (`demandeA`) et l'identité du moment de la DEMANDE ; `batch-error` (émis par le moteur, épinglé) porte le lot qui passe en erreur et,
 * si l'erreur vient d'une commande à ESV, l'heure de sa demande et son nom (`commande`). Journal seulement : le message à la page ne change pas. */
const echecsCommande=new Map();
function demandeCommande(action){const s=engine?.s,id=s?.current?.identity||s?.before?.identity;
 return {commande:action,batchId:s?.batch?.id??null,demandeA:new Date().toISOString(),...(id&&typeof id==='object'?{identity:{...id}}:{})};}
function rangerErreursDeLot(m){const ev=m.event.bind(m);
 m.event=(type,detail={})=>{if(type!=='batch-error'||!detail||typeof detail!=='object')return ev(type,detail);
  const d=echecsCommande.get(String(detail.message));
  return ev(type,{...detail,batchId:detail.batchId??m.s?.batch?.id??null,demandeA:d?.demandeA??null,commande:d?.commande??null});};}
async function callSur(tabId,action,...args){const demande=demandeCommande(action);
 try{return await envoyerCommande(tabId,demande,action,...args);}
 catch(e){echecsCommande.set(String(e?.message),demande);while(echecsCommande.size>8)echecsCommande.delete(echecsCommande.keys().next().value);
  /* T20a : page perdue pendant une commande ou une lecture : le statut le dit tout de suite. */
  if(e?.code==='ESV_PAGE_ABSENTE'&&tabId===selectedTab&&tabId!==null&&engine?.s?.connection?.status!=='reconnecting')connexionStatut('unavailable',e.message,tabId);throw e;}}
async function envoyerCommande(tabId,demande,action,...args){if(tabId===null)throw Error('Sélectionne un onglet ESV.');
 const tab=await chrome.tabs.get(tabId).catch(e=>{throw pageEsvAbsente(e);});
 /* D3 (4.8.5) : onglet sorti d'ESV pendant une lecture (ESV a quitté la page, ou
  * l'onglet a été emmené ailleurs) : erreur reprenable, comme une page absente. */
 if(!esvURL(tab.url))throw Object.assign(Error('Adaptateur ESV sans réponse : l’onglet sélectionné n’affiche plus ESV. Rouvre ESV dans cet onglet (ou F5), puis : lot Orbite, clique sur Reprendre ; Écho, clique sur Connecter puis Reprendre.'),{code:'ESV_PAGE_ABSENTE'});
 /* 4.7.19 (KI-059) : si Chrome signale lui-même un message trop gros, l'erreur
  * est dite en clair ; pour une capture, c'est une lecture à reprendre. */
 /* 5.0 (revue de la relecture, R7) : le choix de relecture figé dans le scope du lot ne part jamais vers la page (aucune marque) ;
  * un lot à relecture coupée n'a pas ce champ : ses commandes sont inchangées, à l'octet près. */
 args=args.map(x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.hasOwn(x,'relecture')?Object.fromEntries(Object.entries(x).filter(([k])=>k!=='relecture')):x);
 const trace=timing?.startRequest(action,args);
 const envoi=chrome.tabs.sendMessage(tabId,{kind:'page-command',action,args,...(trace?{traceId:trace.id}:{})});
 /* B1 (D-095) : la capture part, la page travaille ; l'hypothèse en ombre du cut précédent se conclut pendant ce temps. */
 if(action==='capture'&&b1File.length)setTimeout(b1Vider,0);
 /* 5.0 (I8) : idem pour l'ombre de la voie prédite du cut précédent (calcul lourd, consigné seulement). */
 if(action==='capture'&&voieOmbreFile.length)setTimeout(voieOmbreVider,0);
 const reply=await envoi.catch(e=>{
   timing?.endRequest(trace,null,e);
   if(!/maximum allowed size/i.test(e?.message||''))throw pageEsvAbsente(e);
   throw Error((action==='capture'?'Lecture LiDAR instable : ':'')+`réponse de l’adaptateur trop grosse pour un message Chrome (${action} ; limite 64 Mo).`+(action==='capture'?' Attends la fin du chargement ou rapproche la vue du cut, puis clique sur Reprendre.':''));});
 timing?.endRequest(trace,reply?.result,reply?.error||(!reply||!Object.hasOwn(reply,'result')?'missing-result':null),reply?.diagnostic);
 if(reply?.diagnostic&&!['state','ping','nativeSnapshot','nativeStart','nativePause','nativeResume','nativeFinish'].includes(action))await engine.event('adapter-result',{...reply.diagnostic,error:reply.error||null,batchId:demande.batchId,demandeA:demande.demandeA,...(demande.identity?{identity:demande.identity}:{})});
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
/* 5.0 (D-157) — GARDE-FOU « CLIC HORS VUE ». La page relève chaque clic de pose calculé hors de la partie visible du canevas
 * (NDC au-delà de ±0,99, ou hors de la fenêtre), sans rien changer au clic, et l'envoie après la réponse (fiches/RAPIDE_HUMAIN.md).
 * Ici : JOURNALISATION SEULE, comme le relevé D4 : `store.putEvent` sans attente, jamais `engine.event` ; ni état du moteur (hors le
 * compteur), ni décision, ni commande n'en dépendent. Poids sobre : un compteur par lot (`batch.clicsHorsVue`), les cinq premiers
 * clics du lot en exemples (`clic-hors-vue`, total courant), puis un bilan à la fin du lot s'il y en a eu (`clic-hors-vue-bilan`).
 * Hors lot (Écho, pose assistée) : compteur de la vie du service worker. Le message vient de la page : chaque champ est revérifié. */
const CLICS_HORS_VUE={exemples:5,parReleve:12},clicsHorsVueHorsLot={total:0,exemples:0};
const texteCourt=(v,n)=>typeof v==='string'?v.slice(0,n):null;
const paireFinie=(v,d)=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)?v.map(x=>Math.round(x*10**d)/10**d):null;
function rangerClicHorsVue(r){try{if(!r||typeof r!=='object'||!Array.isArray(r.clics))return;
 const clics=r.clics.slice(0,CLICS_HORS_VUE.parReleve).filter(c=>c&&typeof c==='object').map(c=>({cote:c.cote==='left'||c.cote==='right'?c.cote:null,
   chemin:texteCourt(c.chemin,20),raison:texteCourt(c.raison,40),essai:Number.isInteger(c.essai)?c.essai:null,lecture:texteCourt(c.lecture,20),
   ndc:paireFinie(c.ndc,3),client:paireFinie(c.client,1)}));
 if(!clics.length)return;
 const b=engine?.s?.batch,enLot=!!b?.id&&b.state==='RUNNING';
 if(enLot&&!(b.clicsHorsVue&&typeof b.clicsHorsVue==='object'))b.clicsHorsVue={total:0,exemples:0};
 const n=enLot?b.clicsHorsVue:clicsHorsVueHorsLot;n.total+=clics.length;
 const place=Math.max(0,CLICS_HORS_VUE.exemples-n.exemples);if(!place)return;
 const exemples=clics.slice(0,place);n.exemples+=exemples.length;
 const e={eventId:globalThis.BananeCore3.uid(),timestamp:new Date().toISOString(),type:'clic-hors-vue',batchId:enLot?b.id:null,
   identity:Number.isInteger(r.identity?.cut)?{part:entierOuNul(r.identity.part),cut:r.identity.cut}:null,
   action:r.action==='apply'||r.action==='restore'?r.action:null,mode:texteCourt(r.mode,20),requestId:texteCourt(r.requestId,64),total:n.total,exemples};
 void Promise.resolve(store.putEvent(e)).catch(()=>{});}catch{}}
/* Bilan du lot clos : une fois, et seulement s'il y a eu des clics hors vue (aucun événement = aucun clic hors vue). */
function bilanClicsHorsVue(b){try{const n=b?.clicsHorsVue;if(!b?.id||!n||n.bilan||!(n.total>0)||!OBS_CLOS.includes(b.state))return;n.bilan=true;
 void Promise.resolve(store.putEvent({eventId:globalThis.BananeCore3.uid(),timestamp:new Date().toISOString(),type:'clic-hors-vue-bilan',
   batchId:b.id,etat:b.state,total:n.total,exemples:n.exemples})).catch(()=>{});}catch{}}
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
function cloreMesureHorsBoucle(){bilanClicsHorsVue(engine?.s?.batch);bilanDeplacementVue(engine?.s?.batch);try{const b=engine?.s?.batch,t=timing?.batch;
 if(b?.id&&!engine.task&&OBS_CLOS.includes(b.state)&&t?.id===b.id&&!t.closed)timing.closeBatch(b.state);}catch{/* mesure seule : jamais bloquant */}}
function marquerFinLot(b,cause){bilanClicsHorsVue(b);bilanDeplacementVue(b);if(b?.id&&engine?.s?.mode==='automatic-test'&&OBS_CLOS.includes(b.state))poserFin(b,Date.now(),cause);finLotNoter(b);}
/* Sortie de la boucle du moteur (`batch-state`, émis dans son `finally`) : fin naturelle, ou fin de l'action en cours après « Arrêter ». */
function finVueParLaBoucle(state){const b=engine?.s?.batch;if(!b?.id||state!==b.state)return;bilanClicsHorsVue(b);bilanDeplacementVue(b);
 if(state==='COMPLETED'||state==='FINISHED_WITH_UNCONFIRMED_ACTIONS')coordinateurLot.transition('fin-de-lot',()=>marquerFinLot(b,'fin-naturelle'));
 else if(state==='STOPPED'&&!b.stoppedAtEnd&&obsFins.get(b.id)?.cause==='arret-manuel')marquerFinLot(b,'arret-manuel');}
/* Avant un nouveau lot : l'ancien, clos, garde son instant de fin (arrêt au dernier cut compris) et son contexte. */
function retenirLotClos(){bilanClicsHorsVue(engine?.s?.batch);bilanDeplacementVue(engine?.s?.batch);const b=engine?.s?.batch;if(!b?.id||engine?.s?.mode!=='automatic-test'||!OBS_CLOS.includes(b.state))return;
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
 /* 5.0 (D-171) : pendant la relecture après le lot, l'observateur passif relève (écritures « seen » d'ESV, preuve des validations). */
 if(relecture.passe?.etat==='en-cours')return 'relecture:'+(relecture.passe.lotId||'');
 if(passeDiff.ecriture)return 'passe-differes:'+(passeDiff.vue?.lotId||'');
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
/* 5.0 (audit 5.0, U1) — EN PLUS, LA DERNIÈRE EMPREINTE CONNUE, TOUS ONGLETS CONFONDUS, dans chrome.storage.local (elle survit au redémarrage du
 * navigateur, que storage.session ne passe pas). Quand l'onglet n'a pas d'empreinte propre, l'événement `contrat-esv` consigne
 * `dernierConnu` ({hash, different, changements}) : un changement d'ESV entre deux jours se voit au premier « Connecter ». JAMAIS D'AVIS
 * sur ce seul motif (deux fenêtres dans deux états restent possibles) : l'avis reste la règle par onglet. */
const CLE_CONTRAT_DERNIER='banane50ContratDernier';
async function contratDernierLire(){try{const v=(await chrome.storage.local.get(CLE_CONTRAT_DERNIER))?.[CLE_CONTRAT_DERNIER];
 return v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.hash==='string'&&/^[0-9a-f]{8}$/.test(v.hash)?v:null;}catch{return null;}}
const stockContrats=()=>chrome?.storage?.session?.get?chrome.storage.session:chrome?.storage?.local;
async function contratsLire(S){try{const v=(await S.get(CLE_CONTRATS))?.[CLE_CONTRATS];return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}}
/* Un onglet fermé est oublié (son numéro ne reviendra pas dans cette session ; en repli sur storage.local, il pourrait être réattribué). */
async function contratOublier(tabId){try{const S=stockContrats();if(!S?.get||!Number.isInteger(tabId))return;
 const tous=await contratsLire(S);if(!(String(tabId) in tous))return;delete tous[String(tabId)];await S.set({[CLE_CONTRATS]:tous});}catch{/* relevé seulement */}}
async function contratNoter(c,tabId){try{
 if(!releveOn('empreinte')||!c||typeof c.hash!=='string'||!/^[0-9a-f]{8}$/.test(c.hash))return;
 const S=stockContrats(),detail=reduireContrat(c.detail),etat=reduireContrat(c.etat),cle=Number.isInteger(tabId)?String(tabId):'?';
 /* Audit P-5 (H14) : la forme 2 ne hache plus la sélection du rail ; une empreinte d'une autre forme n'est jamais comparée (ni avis, ni
  * « différente de la dernière connue » au premier « Connecter » après l'installation). Sans forme dite : forme 1. */
 const forme=Number.isInteger(c.forme)?c.forme:1,memeForme=x=>(Number.isInteger(x?.forme)?x.forme:1)===forme;
 const tous=await contratsLire(S),prev=tous[cle]&&memeForme(tous[cle])?tous[cle]:null;
 const change=!!prev&&typeof prev.hash==='string'&&prev.hash!==c.hash;
 const diff=(x,y)=>{const a=aplatirContrat(x||{}),b=aplatirContrat(y||{});return [...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])).slice(0,12);};
 const bouge=change?diff(prev?.detail,detail):[];
 /* U1 : sans empreinte propre à l'onglet, comparaison (consignée seulement) à la dernière connue, tous onglets confondus. */
 const dernier=(x=>memeForme(x)?x:null)(await contratDernierLire());
 const dernierConnu=prev?undefined:dernier?{hash:dernier.hash,different:dernier.hash!==c.hash,changements:dernier.hash!==c.hash?diff(dernier.detail,detail):[]}:null;
 journalerSimple('contrat-esv',{hash:c.hash,forme,precedent:prev?.hash??null,change,changements:bouge,...(dernierConnu!==undefined?{dernierConnu}:{}),detail,etat,onglet:Number.isInteger(tabId)?tabId:null});
 try{await chrome.storage.local.set({[CLE_CONTRAT_DERNIER]:{hash:c.hash,at:new Date().toISOString(),version:VERSION,forme,detail}});}catch{/* relevé seulement */}
 try{tous[cle]={hash:c.hash,at:new Date().toISOString(),version:VERSION,forme,detail};
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
 const m=await lecturesLire(),prev=m[p.listKey],cx=p.ctx||contexteAudit();
 /* Audit P-5 (H15) : une lecture plus courte que la référence (pages manquantes) n'est gardée que si elle se dit complète ; la liste apprend
  * sa partie au départ d'un lot (résumé d'avant séance, lot en cours), et une partie n'a qu'une liste. */
 if(prev&&prev.rows>0&&p.rows<prev.rows&&p.complete!==true)return;
 let apprise=Number.isInteger(prev?.partie)?prev.partie:null;
 if(p.avantSeance===true&&cx.lotEnCours===true&&Number.isInteger(cx.partie)){apprise=cx.partie;for(const k of Object.keys(m))if(k!==p.listKey&&m[k]?.partie===apprise)delete m[k].partie;}
 m[p.listKey]={atMs:p.atMs,valid:p.valid,invalid:p.invalid,rows:p.rows,...(apprise!==null?{partie:apprise}:{})};
 const cles=Object.keys(m);while(cles.length>8)delete m[cles.shift()];
 try{await chrome.storage.local.set({[CLE_LECTURES]:m});}catch{}
 if(!prev||!Number.isFinite(prev.atMs)||p.atMs<=prev.atMs)return;
 /* H15 : deux lectures ne se comparent que si elles couvrent la même liste entière (même nombre de lignes). */
 if(prev.rows!==p.rows)return;
 const {partie,source}=partieDeListe(m,p.listKey,cx);
 let attendus=null;if(partie!==null)try{attendus=await validationsAriane(partie,prev.atMs,p.atMs);}catch{attendus=null;}
 const constates=p.valid-prev.valid;
 journalerSimple('audit-serveur',{listKey:p.listKey,partie,partieSource:source,depuis:new Date(prev.atMs).toISOString(),jusqua:new Date(p.atMs).toISOString(),
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
 if(b&&!OBS_CLOS.includes(b.state)&&entier(b.scope?.part)!==null)return {partie:b.scope.part,source:'lot',nativeSessionId:echo?n?.id??null:null,lotEnCours:b.state==='RUNNING'};
 if(echo){const part=entier(n?.current?.identity?.part)??entier((n?.visits||[]).at(-1)?.identity?.part);
  return {partie:part,source:part!==null?'echo':null,nativeSessionId:n?.id??null};}
 if(b&&entier(b.scope?.part)!==null&&dansGrace(b))return {partie:b.scope.part,source:'lot',nativeSessionId:null};
 const cap=entier(engine?.s?.before?.identity?.part);
 return {partie:cap,source:cap!==null?'capture':null,nativeSessionId:null};}
/* Audit P-5 (H15) — LA PARTIE DE LA LISTE RÉELLEMENT LUE. Un lot en pause, Écho ou la capture disent la partie AFFICHÉE au moment de la lecture
 * selon Ariane ; après un départ d'ESV vers une autre partie (fin de partie, F5), ce n'est plus celle de la liste (test 6, 10 h 04 : liste de la
 * partie 9 rangée « partie 8 »). Une liste qui connaît sa partie la garde (source `liste` si elle diffère) ; une liste inconnue ne prend pas une
 * partie dont la liste est connue et autre (partie nulle, aucune validation attendue). */
function partieDeListe(m,cle,cx){const connue=Number.isInteger(m[cle]?.partie)?m[cle].partie:null;
 if(connue!==null)return {partie:connue,source:connue===cx.partie?cx.source:'liste'};
 if(cx.partie!==null&&Object.keys(m).some(k=>k!==cle&&m[k]?.partie===cx.partie))return {partie:null,source:null};
 return {partie:cx.partie,source:cx.source};}
/* Une observation rangée : avis `fetch-rails`, pages de liste (lecture finie = silence de 4 s après la dernière page ; complète si sa dernière
 * page est plus courte que les autres, ou s'il n'y en a qu'une : H15). */
function relevesObservation(f,observer){
 if(f.kind==='fetch-rails'&&releveOn('avisFetch')&&Number.isInteger(f.n)&&f.n>0)
  avisContratEsv('fetch-rails',`ESV a changé : des requêtes de rails passent par « fetch » (${f.n} vue${f.n>1?'s':''}), qu’Ariane ne voit pas. Les validations ne sont plus contrôlées : préviens-moi avant de lancer un lot.`,{n:f.n});
 else if(f.kind==='list-page'&&releveOn('auditServeur')&&f.listKey&&f.status>=200&&f.status<300&&f.counts&&Number.isInteger(f.rows)){
  const k=String(observer)+'|'+f.listKey,p=lectures.pend.get(k)||{listKey:f.listKey,pages:0,rows:0,valid:0,invalid:0,atMs:null,timer:null};
  p.ctx=contexteAudit();p.pages++;p.rows+=f.rows;p.valid+=f.counts.valid||0;p.invalid+=f.counts.invalid||0;if(Number.isFinite(f.endedEpochMs))p.atMs=Math.max(p.atMs??0,f.endedEpochMs);
  p.derniere=f.rows;p.plusGrande=Math.max(p.plusGrande||0,f.rows);
  clearTimeout(p.timer);p.timer=setTimeout(()=>{lectures.pend.delete(k);p.complete=p.pages===1||p.derniere<p.plusGrande;void auditLecture(p).catch(()=>{});},Number.isFinite(globalThis.BananeSettings?.releves?.auditSilenceMs)?globalThis.BananeSettings.releves.auditSilenceMs:4000);lectures.pend.set(k,p);}
 else if(f.kind==='list-summary'&&f.beforeSession===true&&f.counts&&Number.isInteger(f.rows)&&Number.isFinite(f.lastEndedEpochMs))
  void auditLecture({listKey:f.listKey,pages:f.pages,rows:f.rows,valid:f.counts.valid||0,invalid:f.counts.invalid||0,atMs:f.lastEndedEpochMs,avantSeance:true,ctx:contexteAudit(),
   complete:!Number.isInteger(f.okPages)||!Number.isInteger(f.pages)||f.okPages===f.pages}).catch(()=>{});}
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
  if(fields.kind==='write')try{ecritureObservee(fields);relectureEcriture(fields);passeDiffEcriture(fields);}catch{}
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
  if(fiche)void Promise.resolve(EC.noterDepart(chrome.storage.local,fiche)).then(()=>historiqueRelire()).catch(()=>{});
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
/* Test 7 (Mic : « sur une partie sans rouge, Ariane passe à la suite sans rien dire ») — PARTIE SANS ROUGE : le dernier relevé
 * du compteur d'ESV pendant le lot (« N on M treated », même partie, source « compteur ») a N ≥ M. Lecture seule : l'avis de
 * fin de lot le dit d'abord ; ni la clôture, ni la navigation d'ESV, ni ce qui est envoyé à ESV ne changent. */
function partieSansRouge(b){const t=b?.totalReleve,p=b?.scope?.part;
 return Number.isInteger(p)&&!!t&&t.part===p&&t.totalSource==='compteur'&&Number.isInteger(t.total)&&t.total>0&&Number.isInteger(t.traites)&&t.traites>=t.total;}
const avisPartieSansRouge=b=>partieSansRouge(b)?`Partie ${b.scope.part} : plus aucun cut rouge à traiter. Le lot s’arrête ici. `:'';
async function clore(reason,last,next,{annonce=null,surNavigation=true,finSansPose=false,dernier=null}={}){const b=engine.s.batch;last=last??b.activeIdentity?.cut;
 b.state='STOPPED';
 if(dernier){/* KI-069 : ESV est resté sur le dernier cut ; rien d'autre n'est ni envoyé ni mémorisé (D-062 b reste celle de D-062). */
   b.stoppedAtEnd={cut:last,reason,issue:reason,motif:dernier.motif,target:null,total:dernier.total,at:new Date().toISOString(),applied:reason==='dernier-cut-valide'};
   const quel=dernier.motif==='dernier-invalide'?'dernier cut à valider de la partie':'dernier cut de la partie';
   engine.s.notice=avisPartieSansRouge(b)+(reason==='dernier-cut-valide'?`Fin du lot : ${quel} (${last}) validé ; ESV est resté sur ce cut.`
     :`Fin du lot : ${quel} (${last}), différé ; rien n’a été envoyé à ESV.`);
   await engine.event('batch-stopped-at-end',{identity:null,reason,lastCut:last??null,target:null,total:dernier.total});return;}
 /* `issue` : sortie d'ESV après une validation, pendant un cut, ou fin muette sans pose (4.8.0). */
 const issue=finSansPose?'fin-sans-pose':surNavigation?'sortie':'sortie-pendant-cut';
 b.stoppedAtEnd={cut:finSansPose?next?.cut??null:last??null,reason,issue,target:next?{part:next.part??null,cut:next.cut??null}:null,at:new Date().toISOString(),applied:issue==='sortie'||issue==='sortie-pendant-cut'&&!!engine.s.applied};
 const where=()=>next?.part!==b.scope.part?`dans la partie ${next?.part}`:`au cut ${next?.cut}`;
 engine.s.notice=avisPartieSansRouge(b)+(finSansPose
   ?`Fin du lot : ESV ne répond plus sur le dernier cut du lot (${next?.cut}), où rien n’a été posé. Contrôle-le dans ESV ; le lot est clos.`
   :reason==='adapter-lost-after-navigation'
   ?`Fin du lot : après la validation du cut ${last}, ESV est passé au cut ${next?.cut} et ne répond plus (changement de partie probable). Le lot est clos ; recharge ESV avant un autre lot.`
   :surNavigation?`Fin du lot : après la validation du cut ${last}, ESV est passé ${where()}, hors du lot. Le lot est clos ; aucun cut hors du lot n'est traité.`
   :`Fin du lot : ESV affiche la partie ${next?.part} pendant le cut ${last}, qu’Ariane n’a pas validé. Le lot est clos ; contrôle ce cut dans ESV.`);
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
/* Preuve d'une validation sur place (Ctrl+Entrée) : commande envoyée, identité inchangée, aucune navigation, compteur « N on M treated » de N à N+1 sur le même total. */
const enPlaceProuvee=(e,identity)=>{const K=globalThis.BananeCore3,av=e?.compteurAvant,ap=e?.compteurApres;
 return e?.commandSent===true&&e.serverConfirmed===true&&e.navigationObserved!==true&&!!e.afterState?.identity&&K.key(e.afterState.identity)===K.key(identity)
  &&Number.isInteger(av?.traites)&&ap?.traites===av.traites+1&&ap.total===av.total;};
/* Ctrl+Entrée valide sans passer au suivant. Preuve : identité inchangée et compteur N → N+1
 * (serverConfirmed) ; jamais navigationObserved. Sans effet ou erreur : le moteur (épinglé) arrête le lot avec ce message ; JAMAIS de repli vers « valider et suivant ». */
async function validerSurPlace(identity,d,scope){const S=globalThis.BananeSettings?.lot||{},K=globalThis.BananeCore3;
 const commande=S.validationDernierCut==='bouton'?'bouton':'ctrl-entree';
 await engine.event('dernier-cut-detecte',{identity:null,part:d.part,cut:d.cut,total:d.total,motif:d.motif,action:'validation',commande});
 const echec=m=>Error(/^Adaptateur ESV sans réponse|^Une autre Ariane/.test(m)?m
   :`Dernier cut ${d.motif==='dernier-invalide'?'à valider ':''}de la partie (${d.cut}) : ${m} Le cut ${d.cut} reste posé, non validé : valide-le toi-même dans ESV. Aucun repli vers « valider et suivant » : ce bouton ferait quitter la partie.`);
 let e;try{e=await validateInPlaceInESV(identity,scope,{commande,boutonId:S.boutonValiderSansSuivant??null});}catch(err){throw echec(err.message);}
 const av=e?.compteurAvant,ap=e?.compteurApres;
 if(!(enPlaceProuvee(e,identity)&&av.total===d.total))
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
function ecritureNoterValidation(identity,origine='lot'){if(reglageEcriture().mode==='off'||!Number.isInteger(identity?.cut))return null;
 const v={cut:identity.cut,part:identity.part??null,lot:engine?.s?.batch?.id??null,envoiMs:Date.now(),retourMs:null,origine};
 /* T21d (H) : la visite que le moteur complétera pour cette validation (même recherche que `validateAndNext` du moteur), pour y rattacher la preuve serveur. */
 if(origine==='lot')try{const K=globalThis.BananeCore3,id=K.cutId(identity),r=(engine?.s?.records||[]).slice().reverse().find(x=>x?.identity&&K.cutId(x.identity)===id);
  v.cutId=id;v.recordId=r?.recordId??r?.id??null;}catch{v.recordId=null;}
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
 if(ok)try{preuveServeurNoter(f,t,l);}catch{/* instrumentation seulement */}
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
/* T21d (fiches/H_PREUVE_SERVEUR.md, correctif 1) — PREUVE SERVEUR RATTACHÉE APRÈS COUP. L'écriture de validation d'ESV part 0,2 à 0,5 s APRÈS la
 * navigation sur laquelle le lot avance (mesuré sur le lot de la 4:2) : aucune lecture faite pendant la validation ne peut la voir. Quand
 * l'observateur passif la voit (2xx, corps `ExtractionStatus: valid` + `TreatedByOperator: true`, ligne = cut validé par le lot, dans
 * `preuveServeurJointeMs` après le retour de la validation), elle est jointe à la visite du cut avec les noms de champs d'Écho
 * (`serverConfirmed`, `serverConfirmationStatus`, `serverConfirmedAt`) et un champ dédié `serverConfirmation` {statut, at, par, délais} ; un
 * événement `validation-ecriture-observee` le dit au journal. Si la visite n'est pas encore complétée par le moteur (écriture vue avant la
 * fin de la validation), la preuve attend l'événement `validation-observation` du cut. Instrumentation seulement : aucune décision, aucune
 * commande, aucune attente ; `validationProof`, l'évidence du lot (`processed[].evidence`) et son état de clôture ne changent pas. Une écriture
 * refusée ou absente ne pose rien (le refus garde son chemin, `ecriture-refusee`). Les validations de la deuxième passe ont leur propre preuve
 * (`ecritureAttendue`) et ne sont pas concernées. */
const preuveJointeMs=()=>{const v=globalThis.BananeSettings?.lot?.preuveServeurJointeMs;return Number.isFinite(v)&&v>=0?v:5000;};
function preuveServeurNoter(f,t,l){const corps=f.body&&typeof f.body==='object'?f.body:null;
 if(!l||!corps||corps.ExtractionStatus!=='valid'||corps.TreatedByOperator!==true)return;
 const v=ecrituresLot.validations.findLast(x=>x.origine==='lot'&&x.cut===l.cut&&!x.preuve&&t>=x.envoiMs-500&&t<=(x.retourMs??Infinity)+preuveJointeMs());if(!v)return;
 v.preuve={statut:f.status,at:new Date(t).toISOString(),par:l.par,apresEnvoiMs:Math.round(t-v.envoiMs),apresRetourMs:Number.isFinite(v.retourMs)?Math.round(t-v.retourMs):null};
 const rattache=preuveServeurRattacher(v);
 journalerSimple('validation-ecriture-observee',{identity:{part:v.part,cut:v.cut},lotId:v.lot,statut:v.preuve.statut,at:v.preuve.at,par:v.preuve.par,
  apresEnvoiMs:v.preuve.apresEnvoiMs,apresRetourMs:v.preuve.apresRetourMs,recordId:v.recordId??null,visite:rattache?'rattachee':'en-attente'});}
function preuveServeurRattacher(v){if(!v?.preuve||v.rattachee||!v.recordId)return false;
 const rec=(engine?.s?.records||[]).find(r=>(r?.recordId??r?.id)===v.recordId);if(!rec||rec.commandSent!==true)return false;
 const p=v.preuve;v.rattachee=true;
 Object.assign(rec,{serverConfirmed:true,serverConfirmationStatus:'observed-validation-write-'+p.statut,serverConfirmedAt:p.at,
  serverConfirmation:{statut:p.statut,at:p.at,par:p.par,apresEnvoiMs:p.apresEnvoiMs,apresRetourMs:p.apresRetourMs}});
 void Promise.resolve(store.putRecord(rec)).catch(()=>{});
 /* Le dernier cut d'un lot : le moteur ne sauvera plus son état ; sauvé ici, seulement s'il est au repos. */
 if(!engine.task&&!engine.busy)void Promise.resolve(engine.save()).catch(()=>{});
 return true;}
/* Preuve vue avant que le moteur ait complété la visite : rattachée à l'observation de la validation de ce cut. */
function preuveServeurEnAttente(identity){try{const K=globalThis.BananeCore3,id=identity?K.cutId(identity):null;if(!id)return;
 for(const v of ecrituresLot.validations)if(v.origine==='lot'&&v.preuve&&!v.rattachee&&v.cutId===id)preuveServeurRattacher(v);}catch{/* instrumentation seulement */}}
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
/* T20a (D-243, D-250) — STATUT DE CONNEXION TENU À JOUR. `engine.s.connection` = { status, observedAt, message, tabId } :
 *   'ready'        à chaque équipement réussi de l'onglet (« Connecter », « Reconnecter », reconnexion après F5, reprise d'Écho, reprise du lot) et
 *                  à chaque lecture réussie de la vue (`pollCurrent`) ;
 *   'reconnecting' pendant une reconnexion (après F5, « Reconnecter », reprise d'Écho) ;
 *   'unavailable'  à chaque perte de la page (rechargement, onglet sorti d'ESV, page absente pendant une commande, équipement impossible) ;
 *   'no-tab'       sans onglet ESV choisi, ou onglet choisi fermé.
 * Le message « ESV n'est pas connecté » du panneau se fonde sur ce statut seul. Aucune commande ESV. */
function connexionStatut(status,message=null,tabId=selectedTab){if(!engine?.s)return;
 engine.s.connection={status,observedAt:new Date().toISOString(),message:typeof message==='string'&&message?message.slice(0,400):null,tabId:Number.isInteger(tabId)?tabId:null};}
/* ÉQUIPEMENTS SÉRIALISÉS PAR ONGLET : un équipement en cours sur un onglet est partagé par toute nouvelle demande sur le même onglet (reprise d'Écho
 * et reconnexion après F5 sur le même `complete`, clic « Reconnecter » pendant une reprise) : une seule injection. */
const equipements=new Map();
function equiperOnglet(tabId){const enCours=equipements.get(tabId);if(enCours)return enCours;
 const p=equiperOngletUneFois(tabId).then(r=>{connexionStatut('ready',null,tabId);return r;});
 equipements.set(tabId,p);const fin=()=>{if(equipements.get(tabId)===p)equipements.delete(tabId);};p.then(fin,fin);return p;}
async function equiperOngletUneFois(tabId){
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
 /* T20a : la même lecture rend le relevé du sélecteur de parties de la page (`selecteurParties`, src/adapter-page.js, réglage `releves.selecteurParties`),
  * en lecture seule ; empreinte coupée : ni l'une ni l'autre (aucun ping de plus). */
 if(releveOn('empreinte'))void callSur(tabId,'ping',{contrat:true}).then(r=>{selecteurNoter(r?.selecteurParties);return contratNoter(r?.contrat,tabId);},()=>{});}
/* T20a (architecture § P, D-250) — RELEVÉ DU SÉLECTEUR DE PARTIES de la page ESV (lecture seule, pour la file de parties de T27) : SUPPOSÉ, une liste
 * de liens `…&p=N` (tests/esv-maquette/README.md). `partsSelector` = { at, status: 'ok' | 'absent' | 'illisible', current, parts: [{part, label, current}] } ;
 * null tant qu'aucun relevé n'a été rendu (adaptateur d'avant, réglage coupé). Relu champ par champ (source non fiable), journalisé quand il change. */
let partsSelector=null,partsSelectorSig=null;
function selecteurNoter(r){try{if(!r||typeof r!=='object')return;
 const parts=[];const vus=new Set();
 if(Array.isArray(r.parts))for(const x of r.parts.slice(0,500)){if(!Number.isInteger(x?.part)||x.part<0||x.part>1e6||vus.has(x.part))continue;vus.add(x.part);
  const label=typeof x.label==='string'?x.label.replace(/\s+/g,' ').trim().slice(0,40)||null:null;parts.push({part:x.part,label,current:x.current===true});}
 const status=['ok','absent','illisible'].includes(r.status)?r.status:'illisible';
 const current=status==='ok'&&Number.isInteger(r.current)&&vus.has(r.current)?r.current:null;
 partsSelector={at:new Date().toISOString(),status,current,parts:status==='ok'?parts:[]};
 const sig=JSON.stringify([status,current,partsSelector.parts]);
 if(sig!==partsSelectorSig){partsSelectorSig=sig;journalerSimple('releve-selecteur-parties',{status,current,n:partsSelector.parts.length,parts:partsSelector.parts});}}catch{/* relevé seulement */}}
/* T20a : statut « reconnecting » pendant la reconnexion de la reprise du lot, « ready » à l'équipement, « unavailable » si elle échoue. */
async function reconnecterESV(delaiMs,garde=()=>{}){connexionStatut('reconnecting','Reprise du lot : Ariane se reconnecte à la page ESV rechargée.');
 try{return await reconnecterESVBoucle(delaiMs,garde);}
 catch(e){if(engine?.s?.connection?.status==='reconnecting')connexionStatut('unavailable',e?.message);throw e;}}
async function reconnecterESVBoucle(delaiMs,garde){const fin=Date.now()+delaiMs;let derniere=null;
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
/* Test 7, suite : un lot clos au premier cut d'une partie complète (`partie-sans-rouge`, rien envoyé) est terminé lui aussi. */
function lotTermine(b){const e=b?.stoppedAtEnd;return b?.state==='STOPPED'&&!!e&&(FINS_DE_PARTIE.has(e.issue)||e.reason==='navigation-other-part-after-defer'||e.issue==='partie-sans-rouge'||e.issue==='depart-sur-vert');}
/* Test 7, suite (coordination) — PARTIE COMPLÈTE : RIEN N'EST ENVOYÉ À ESV SUR UN CUT DÉJÀ TRAITÉ. Constaté au banc : sur une
 * partie dont le compteur « N on M treated » est complet, le lot posait et validait le cut affiché, déjà traité, puis ESV
 * chargeait la partie suivante ; un opérateur ne fait pas cette écriture. Au PREMIER cut du lot (rien de traité, un seul cut
 * dans la séquence), après l'analyse et AVANT toute commande, le lot se clôt sans rien envoyer à ESV si :
 *  1. le relevé du compteur pendant le lot est celui de CE cut (même partie, même cut, après le début du cut), d'un seul
 *     compteur lisible, avec N ≥ M (`partieSansRouge`) ;
 *  2. la liste d'ESV en mémoire de la page (lecture B1 `b1-voisins` : aucune requête réseau, aucune commande) donne à ce cut
 *     un statut LU et non rouge (`valid` ou `skipped`), dans une table unique ou dont la ligne la plus proche est ce cut.
 * Toute information absente, illisible, d'un autre cut ou ambiguë : rien ne change. Un cut `invalid` n'est jamais retenu. */
async function statutListeDuCut(cut,avant){const B=globalThis.BananeAppuisListe;if(!B?.lireReponse||!B.DEFAULTS||selectedTab===null)return null;
 const R=b1.repere,T=R?.T&&R.frameId===(avant?.identity?.frameId??null)?R.T:[0,0,0];
 const world=Object.fromEntries(['left','right'].map(x=>{const p=avant?.rails?.[x]?.positionSceneRelative;return [x,Array.isArray(p)?p.map((v,i)=>v+T[i]):null];}));
 if(!['left','right'].every(x=>Array.isArray(world[x])&&world[x].length===3&&world[x].every(Number.isFinite)))return null;
 const rep=B.lireReponse(await b1Voisins(cut,world),{cut,fenetre:B.DEFAULTS.fenetre});
 if(!rep?.ok||!(rep.table?.tables===1||rep.geo?.index===cut))return null;
 const l=rep.rows.find(x=>x.i===cut);return l?l.statut:null;}
async function partieCompleteAuDepart(){try{const b=engine?.s?.batch,sc=b?.scope,avant=engine?.s?.before,cut=avant?.identity?.cut,t=b?.totalReleve;
  if(b?.state!=='RUNNING'||sc?.geometryEngine!==GCV1_ENGINE||!Number.isInteger(cut)||avant.identity.part!==sc.part)return null;
  if(cutsTraites(b).size>0||(b.sequence?.length??0)!==1||!partieSansRouge(b)||t.cut!==cut)return null;
  const depuis=Date.parse(b.cutStartedAt),vu=Date.parse(t.at);if(!Number.isFinite(depuis)||!Number.isFinite(vu)||vu<depuis)return null;
  const statut=await statutListeDuCut(cut,avant);
  return statut==='valid'||statut==='skipped'?{part:sc.part,cut,total:t.total,traites:t.traites,statut}:null;}catch{return null;}}
/* Clôture sans commande : l'état du lot, l'avis, le journal. La capture ouverte reste (comme l'arrêt au dernier cut non résolu). */
async function cloreSansRouge(p){const b=engine.s.batch;if(b?.state!=='RUNNING')return false;
 b.state='STOPPED';b.stoppedAtEnd={cut:p.cut,reason:'partie-sans-rouge',issue:'partie-sans-rouge',target:null,total:p.total,at:new Date().toISOString(),applied:false};
 engine.s.notice=`Partie ${p.part} : plus aucun cut rouge à traiter. Le lot s’arrête ici. Aucune pose ni validation n’a été envoyée à ESV.`;
 await engine.event('batch-stopped-at-end',{identity:null,reason:'partie-sans-rouge',lastCut:p.cut,target:null,total:p.total,traites:p.traites,statut:p.statut});
 return true;}
/* Test 7, suite 2 (coordination, D-169, audit P-5 C1 et C2) — DÉPART SUR UN CUT VERT : AUCUNE ÉCRITURE SUR LUI.
 * Constaté au banc et sur le terrain (test 6) : un lot qui part d'un cut déjà validé (vert) le pose et le valide
 * (`apply` + `validateAndNext`) pour passer au rouge suivant : cut 0 de la partie 9 (écartement 1 434,0 → 1 429,7 mm),
 * cut 1 reposé, cut 5948 de la partie 8 reposé et revalidé puis sortie d'ESV vers la partie 9 et lot en erreur. Mic,
 * lui, passe au cut suivant à traiter sans rien écrire.
 * Au PREMIER cut du lot (rien de traité, un seul cut dans la séquence), après l'analyse et AVANT toute commande, quand la
 * règle « partie complète » n'a pas joué :
 *  1. le relevé du compteur « N on M treated » de CE cut (même partie, même cut, après le début du cut) donne M et N ;
 *  2. la liste d'ESV en mémoire de la page (`liste-instantane`, la table de l'observateur, tenue à jour des écritures
 *     vues : aucune requête réseau, aucune commande) : une seule table complète de M lignes (ligne = numéro de cut) ;
 *  3. ce cut y est vert (`valid`, ou `skipped`).
 * Sinon (cut rouge, information absente, illisible ou ambiguë) : rien ne change, à l'octet près. Si le cut est vert :
 *  - le nombre de rouges de la table (`invalid` ou statut inconnu) doit être M − N, sinon arrêt sans rien envoyer ;
 *  - le premier cut non validé APRÈS lui est rouge et dans les bornes du lot : Ariane y va par « cut non validé suivant »
 *    (`nextWithoutDecision`, bouton `O2N3DCutNextInvalid3DRail`, Maj+Z : le geste de Mic, déjà celui des différés du lot,
 *    sans écriture), puis le lot repart normalement sur ce cut, dans le même lot ;
 *  - sinon (aucun rouge devant, rouges seulement derrière comme le lot de 10 h 02, suivant non rouge, hors des bornes) :
 *    le lot s'arrête sans rien envoyer et dit lesquels restent. Ariane ne revient pas en arrière d'elle-même : les
 *    rouges derrière sont hors des bornes choisies, et le retour à un cut d'ESV (événement interne) n'est pas vérifié
 *    sur le vrai ESV ; le pas à pas est borné à 40 cuts. */
const LISTE_PAGE_MS=4000,rougeListe=v=>v===1||v===3;
async function tableDeLaPartie(total){if(selectedTab===null)return null;let timer;
 try{const rep=await Promise.race([chrome.tabs.sendMessage(selectedTab,{kind:'liste-instantane'}),new Promise(r=>{timer=setTimeout(()=>r(null),LISTE_PAGE_MS);})]);
  if(rep?.ok!==true||!Array.isArray(rep.tables))return null;
  const l=rep.tables.filter(t=>t&&Array.isArray(t.st)&&t.debut===true&&t.rompue!==true&&t.tronquee!==true&&t.st.length===total);
  return l.length===1?l[0].st.map(v=>Number.isInteger(v)&&v>=0&&v<=3?v:3):null;}
 catch{return null;}finally{clearTimeout(timer);}}
async function departSurVert(){try{const b=engine?.s?.batch,sc=b?.scope,avant=engine?.s?.before,cut=avant?.identity?.cut,t=b?.totalReleve;
  if(b?.state!=='RUNNING'||sc?.geometryEngine!==GCV1_ENGINE||!Number.isInteger(cut)||avant.identity.part!==sc.part)return null;
  if(cutsTraites(b).size>0||(b.sequence?.length??0)!==1)return null;
  if(!t||t.part!==sc.part||t.cut!==cut||t.totalSource!=='compteur'||!Number.isInteger(t.total)||t.total<1||!Number.isInteger(t.traites)||t.traites<0||t.traites>t.total||cut>=t.total)return null;
  const depuis=Date.parse(b.cutStartedAt),vu=Date.parse(t.at);if(!Number.isFinite(depuis)||!Number.isFinite(vu)||vu<depuis)return null;
  const st=await tableDeLaPartie(t.total);if(!st||(st[cut]!==0&&st[cut]!==2))return null;
  const d={part:sc.part,cut,identity:K3().completeIdentity(avant.identity),statut:st[cut]===0?'valid':'skipped',total:t.total,traites:t.traites,
   restants:st.reduce((n,v)=>n+(rougeListe(v)?1:0),0),derriere:[]};
  for(let i=0;i<cut;i++)if(rougeListe(st[i]))d.derriere.push(i);
  if(d.restants!==t.total-t.traites)return {...d,action:'arret',motif:'liste-incoherente'};
  let devant=-1;for(let i=cut+1;i<st.length;i++)if(st[i]!==0){devant=i;break;}
  if(devant<0)return {...d,action:'arret',motif:d.derriere.length?'rouges-derriere':'partie-sans-rouge'};
  if(!rougeListe(st[devant]))return {...d,devant,action:'arret',motif:'suivant-non-rouge'};
  if(devant>sc.end)return {...d,devant,action:'arret',motif:'hors-du-lot'};
  return {...d,devant,action:'naviguer'};}catch{return null;}}
const K3=()=>globalThis.BananeCore3;
const listeCuts=l=>l.length<=12?l.join(', '):`${l.slice(0,12).join(', ')} et ${l.length-12} autres`;
function avisDepartSurVert(d){const n=d.derriere?.length??0,rouges=k=>`${k} ${k>1?'cuts rouges':'cut rouge'}`;
 const debut=`Partie ${d.part} : le cut ${d.cut} est déjà ${d.statut==='skipped'?'passé (SKIP)':'validé'}.`,rien='Aucune pose ni validation n’a été envoyée à ESV.';
 if(d.motif==='rouges-derriere')return `${debut} Plus aucun cut rouge après lui. Il reste ${rouges(n)} derrière : ${listeCuts(d.derriere)}. ${rien} Pour ${n>1?'les':'le'} traiter : ouvre le cut ${d.derriere[0]} dans ESV, puis lance un lot depuis ce cut.`;
 if(d.motif==='suivant-non-rouge')return `${debut} Le cut non validé suivant (${d.devant}) n’est pas rouge (SKIP ou statut inconnu). ${rien} Ouvre le cut à traiter dans ESV, puis lance un lot depuis ce cut.`;
 if(d.motif==='hors-du-lot')return `${debut} Le premier cut rouge après lui (${d.devant}) est au-delà du dernier cut du lot (${d.end}). ${rien}`;
 if(d.motif==='liste-incoherente')return `${debut} La liste d’ESV en mémoire de la page (${rouges(d.restants)}) ne concorde pas avec le compteur (${d.total-d.traites} restants) : Ariane ne sait pas où est le prochain cut rouge. ${rien} Ouvre le cut à traiter dans ESV, puis lance un lot depuis ce cut.`;
 return `${debut} ${rien}`;}
/* Arrêt sans commande : l'état du lot, l'avis, le journal (numéros de cuts seulement). */
async function cloreDepartSurVert(d){const b=engine.s.batch;if(b?.state!=='RUNNING'&&b?.state!=='PAUSED')return false;
 if(d.motif==='partie-sans-rouge')return cloreSansRouge(d);
 b.state='STOPPED';b.stoppedAtEnd={cut:d.cut,reason:'depart-sur-vert',issue:'depart-sur-vert',motif:d.motif,target:null,total:d.total,at:new Date().toISOString(),applied:false,
  derriere:(d.derriere||[]).slice(0,50),restants:d.restants??null,devant:d.devant??null};
 engine.s.notice=avisDepartSurVert({...d,end:b.scope?.end});delete b.departSurVert;
 await engine.event('batch-stopped-at-end',{identity:null,reason:'depart-sur-vert',motif:d.motif,lastCut:d.cut,target:null,total:d.total,traites:d.traites,statut:d.statut,
  derriere:(d.derriere||[]).slice(0,50),restants:d.restants??null,devant:d.devant??null});
 return true;}
/* Navigation sans écriture vers le premier cut rouge, APRÈS la fin de la boucle du moteur (mis en pause par l'analyse) :
 * capture du cut vert archivée (sans pose), « cut non validé suivant », contrôle du cut atteint (même page, même partie,
 * après le cut vert, dans les bornes, rails prêts), puis le même lot repart sur ce cut. Échec, refus ou autre partie :
 * le lot s'arrête et le dit ; rien n'est renvoyé. « Arrêter » entre-temps gagne. */
async function passerAuRouge(b,d,{verrou=true}={}){const K=K3();
 if(engine.s.batch!==b||b.state!=='PAUSED'||b.departSurVert?.phase!=='navigation'||engine.task)return false;
 if(verrou)repriseEnCours=true;
 try{
  await engine.archivePending('depart-sur-vert');engine.s.proposal=null;engine.s.lidarId=null;if(b.lotObservation)b.lotObservation.pending=[];
  const operationId=K.uid();let ev=null,erreur=null;
  try{ev=await adapter.nextWithoutDecision(d.identity,b.scope,operationId);}catch(e){erreur=String(e?.message||e).slice(0,200);}
  const n=ev?.nextIdentity?K.completeIdentity(ev.nextIdentity):null;
  const ok=!erreur&&!ev?.refusal&&ev?.navigationObserved===true&&ev?.nextReady===true&&!!n&&n.pageId===b.scope.pageId&&n.part===b.scope.part&&n.cut>d.cut&&n.cut<=b.scope.end;
  await engine.event('depart-sur-vert',{identity:null,phase:'navigation',part:d.part,cut:d.cut,statut:d.statut,cible:d.devant,atteint:n?{part:n.part,cut:n.cut}:null,
   commande:'nextWithoutDecision',operationId,commandSent:ev?.commandSent===true,refus:ev?.refusal?.code??null,erreur,ok});
  if(engine.s.batch!==b)return false;
  if(!ok){if(b.state!=='PAUSED')return false;
   b.state='STOPPED';b.stoppedAtEnd={cut:d.cut,reason:'depart-sur-vert',issue:'depart-sur-vert',motif:'navigation',target:n?{part:n.part,cut:n.cut}:null,total:d.total,at:new Date().toISOString(),applied:false};
   delete b.departSurVert;
   engine.s.notice=`Partie ${d.part} : le cut ${d.cut} est déjà validé ; rien n’y a été écrit. `+(ev?.commandSent===true
     ?`« Cut non validé suivant » a mené ESV ${n?`au cut ${n.cut} de la partie ${n.part}`:'ailleurs'}, pas au cut rouge ${d.devant} attendu : le lot s’arrête. Contrôle ESV, puis lance un lot depuis un cut rouge.`
     :`La navigation vers le cut rouge ${d.devant} n’est pas partie${ev?.refusal?.message?` (${ev.refusal.message})`:erreur?` (${erreur})`:''} : le lot s’arrête. Ouvre le cut ${d.devant} dans ESV, puis lance un lot depuis ce cut.`);
   await engine.event('batch-stopped-at-end',{identity:null,reason:'depart-sur-vert',motif:'navigation',lastCut:d.cut,target:n?{part:n.part,cut:n.cut}:null,total:d.total});
   await engine.save();return false;}
  if(b.state!=='PAUSED')return false;
  b.sequence=[];b.currentSequence=null;b.activeIdentity=n;b.step='capture';
  b.departSurVert={phase:'fait',cut:d.cut,statut:d.statut,vers:n.cut,at:new Date().toISOString()};
  engine.s.notice=`Cut ${d.cut} déjà validé : rien n’y a été écrit. Ariane est passée au premier cut rouge (${n.cut}) par « cut non validé suivant », comme à la main.`;
  await engine.save();
  await coordinateurLot.transition('reprise',()=>engine.resume());return true;
 }catch(e){if(engine.s.batch===b&&b.state==='PAUSED'){engine.s.notice=`Départ sur le cut vert ${d.cut} : ${String(e?.message||e).slice(0,200)} Rien n’a été écrit sur ce cut.`;await engine.save().catch(()=>{});}return false;}
 finally{if(verrou)repriseEnCours=false;}}
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
 /* Test 7, suite 2 : départ sur un cut vert interrompu avant la navigation : on la refait, jamais la pose sur le cut vert. */
 if(b0?.departSurVert?.phase==='navigation'&&b0.departSurVert.decision){await passerAuRouge(b0,b0.departSurVert.decision,{verrou:false});return;}
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
/* 4.9.5 test 6 (D-157, D-164 ; Mic : « essayer les 2 méthodes ») — CHOIX DU PANNEAU POUR LE LOT. Deux choix, gardés dans
 * storage.local par le panneau (actions `choix-lot-etat`, `choix-lot`), lus au démarrage de chaque lot et figés dans son scope :
 *  - `clicHumain` : le clic de pose du mode rapide ('tel-quel' par défaut, 'gauche-recentre', 'tout-recentre'), envoyé à la page
 *    avec chaque `apply` du lot en cours quand il est corrigé (src/adapter-page.js, `options.clicHumain`) ;
 *  - `regleGrappeDifferes` : la règle métier « grappe de différés » (COUPÉE par défaut) ; activée, elle ouvre le chemin d'activation
 *    existant des règles métier pour CETTE règle seulement (voir `reglesDuLot`) : elle ne peut que différer un cut que le lot validait.
 * Absent, illisible ou inconnu : le défaut. Hors d'un lot en cours (assisté, restauration), rien ne change.
 * Test 18 : `passeDifferes`, l'interrupteur de la deuxième passe des différés (« écrit dans ESV »), gardé au même endroit mais PAS figé dans le scope : il est lu
 * à la fin de chaque lot, à chaque relance et avant chaque cut écrit (`passeDiffAllumee`). Absent : allumée (livrée) ; `false`, toute autre valeur ou stockage illisible : coupée. */
const CLE_CLIC_HUMAIN='banane50ClicHumain',CLE_GRAPPE_DIFFERES='banane50GrappeDifferes',CLE_PASSE_DIFFERES='banane51PasseDifferes',MODES_CLIC_HUMAIN=['tel-quel','gauche-recentre','tout-recentre'];
async function choixDuLot(){let r;try{r=await chrome.storage.local.get([CLE_CLIC_HUMAIN,CLE_GRAPPE_DIFFERES,CLE_PASSE_DIFFERES])||{};}catch{r=null;}
 const p=r?.[CLE_PASSE_DIFFERES];
 return {clicHumain:MODES_CLIC_HUMAIN.includes(r?.[CLE_CLIC_HUMAIN])?r[CLE_CLIC_HUMAIN]:'tel-quel',regleGrappeDifferes:r?.[CLE_GRAPPE_DIFFERES]===true,passeDifferes:!!r&&(p===undefined||p===true)};}
async function choixLot(args){
 if(args&&'clicHumain' in args){if(!MODES_CLIC_HUMAIN.includes(args.clicHumain))throw Error('Clic du mode rapide inconnu.');await chrome.storage.local.set({[CLE_CLIC_HUMAIN]:args.clicHumain});}
 if(args&&'regleGrappeDifferes' in args){if(typeof args.regleGrappeDifferes!=='boolean')throw Error('Règle « grappe de différés » : oui ou non.');await chrome.storage.local.set({[CLE_GRAPPE_DIFFERES]:args.regleGrappeDifferes});}
 if(args&&'passeDifferes' in args){if(typeof args.passeDifferes!=='boolean')throw Error('Deuxième passe : oui ou non.');await chrome.storage.local.set({[CLE_PASSE_DIFFERES]:args.passeDifferes});}
 return choixDuLot();}
const passeDiffAllumee=async()=>(await choixDuLot()).passeDifferes;
/* RM-11 (4.9.5 test 9) — CHOIX DU PANNEAU POUR LA RAISON DE LA CORRECTION. Gardé dans storage.local par le panneau (actions `raison-choix-etat`, `raison-choix`),
 * lu au démarrage d'Écho et figé dans la séance (`native.raison`) : la séance ouverte garde le sien. COUPÉ par défaut (absent, illisible ou inconnu : coupé,
 * rangée du haut). Ce choix n'a rien à voir avec celui du lot (`choixDuLot`) : le lot ne le lit pas et ne change pas. Rien n'est envoyé à ESV. */
const CLE_RAISON='banane50Raison';
async function choixRaisonDuPanneau(){let r={};try{r=(await chrome.storage.local.get(CLE_RAISON))?.[CLE_RAISON]||{};}catch{r={};}
 const R=globalThis.BananeRaisonCorrection;return {actif:r.actif===true&&!!R,touches:R?.TABLES.includes(r.touches)?r.touches:'chiffres'};}
async function raisonChoisir(args){const R=globalThis.BananeRaisonCorrection,c=await choixRaisonDuPanneau();
 if(args&&'actif' in args){if(typeof args.actif!=='boolean')throw Error('Raison de la correction : oui ou non.');c.actif=args.actif;}
 if(args&&'touches' in args){if(!R?.TABLES.includes(args.touches))throw Error('Rangée de touches inconnue.');c.touches=args.touches;}
 await chrome.storage.local.set({[CLE_RAISON]:c});return c;}
function clicHumainDuLot(){const b=engine?.s?.batch,v=b?.state==='RUNNING'?b.scope?.clicHumain:null;return v==='gauche-recentre'||v==='tout-recentre'?v:null;}
const applyInESV=adapter.apply;
adapter.apply=async(...args)=>{
 /* 5.0 (D-147) : le plan de geste de la commande du lot, seulement si le réglage `deplacerVue` est actif ; sinon l'appel d'avant. */
 const plan=deplacerVueReglage()||profilL1()?engine.s.proposal?.lotCommand?.deplacerVue??null:null;let result;
 /* 4.9.5 test 6 (D-164) : le clic du mode rapide figé dans le lot en cours, transmis à la page seulement s'il est corrigé ; « Comme
  * avant » (tel-quel) : l'appel d'avant, à l'octet près. */
 const clic=clicHumainDuLot(),optClic=clic?{clicHumain:clic}:null;
 if(plan){const identity=engine.s.before?.identity??null,ev={phase:'pose',identity:identity?{part:identity.part??null,cut:identity.cut??null}:null,batchId:engine.s.batch?.id??null};
  const t0=Date.now();
  try{result=await applyInESV(...args,{deplacerVue:plan,...optClic});}
  catch(e){await engine.event('deplacer-vue',{...ev,erreur:String(e?.message||e).slice(0,300)}).catch(()=>{});
   journalerDeplacementVue(null,null,String(e?.message||e),'pose',Date.now()-t0);throw e;}
  const rapport=result&&typeof result==='object'?result.deplacerVue??null:null;if(rapport){result={...result};delete result.deplacerVue;}
  await engine.event('deplacer-vue',{...ev,cotes:(rapport?.cotes||[]).map(dvAmener),remise:rapport?.remise??null}).catch(()=>{});
  journalerDeplacementVue(rapport?.cotes,rapport?.remise,null,'pose',Date.now()-t0);}
 else result=optClic?await applyInESV(...args,optClic):await applyInESV(...args);
 if(stopAtLotEnd())await coordinateurLot.transition('fin-de-lot',()=>engine.event('batch-stopped-at-end',{identity:engine.s.before?.identity??null,applied:true}));return result;};
adapter.capabilities={serverConfirmation:false};
/* 4.9.5.13 (fiches/RAPIDE_HUMAIN.md, § 2) : le mode du clic d'un lot à clic corrigé est consigné dans la LECTURE de chaque capture du lot
 * (`readStrategy.clicHumain`, `clicHumainSource:'lot'`). Depuis la test 6, ce mode vient du lot et ne part vers la page qu'avec `apply` ; la
 * capture, faite avant, ne le connaissait pas. Rien de plus n'est envoyé à la page ; « tel-quel » : la lecture d'avant. */
const captureESV=adapter.capture;
/* Cap 5, piste 1 (réglage `lot.recaptureVide`, coupé par défaut) : pendant un lot, une capture presque vide est refaite après une attente. */
async function recaptureVide(args,r){const cfg=globalThis.BananeSettings?.lot?.recaptureVide,b=engine?.s?.batch;
 const n=c=>Array.isArray(c?.pointsSceneRelative)?c.pointsSceneRelative.length:0;
 if(!cfg?.actif||b?.state!=='RUNNING'||!r||typeof r!=='object'||n(r)>=cfg.minPoints)return r;
 let best=r;const avant=n(r),essais=[];
 for(let i=0;i<(cfg.essais|0)&&n(best)<cfg.minPoints;i++){await attendreMs(cfg.attenteMs);let x=null;
  try{x=await captureESV(...args);}catch(e){essais.push({erreur:String(e?.message||e).slice(0,120)});break;}
  essais.push({points:n(x)});if(n(x)>n(best))best=x;}
 await engine.event('recapture-vide',{identity:{part:r.identity?.part??null,cut:r.identity?.cut??null},batchId:b.id??null,pointsAvant:avant,pointsApres:n(best),essais}).catch(()=>{});
 return best;}
adapter.capture=async(...args)=>{const r=await recaptureVide(args,await captureESV(...args)),c=clicHumainDuLot();
 if(c&&r&&typeof r==='object'&&!r.readStrategy?.clicHumain)r.readStrategy={...(r.readStrategy&&typeof r.readStrategy==='object'?r.readStrategy:{}),clicHumain:c,clicHumainSource:'lot'};
 return r;};
/* 4.9.5.13 (L1) : une pose « sans valider » en attente pour CE cut est faite juste avant la navigation sans décision ; sinon l'appel d'avant. */
const nextSansDecisionESV=adapter.nextWithoutDecision;
adapter.nextWithoutDecision=async(identity,...rest)=>{const p=l1PoseEnAttente;l1PoseEnAttente=null;
 if(p&&identity&&p.batchId===(engine?.s?.batch?.id??null)&&p.cutId===globalThis.BananeCore3.cutId(identity))await l1PoserSansValider(p);
 return nextSansDecisionESV(identity,...rest);};
const ready=(async()=>{await restaurerObsFins();selectedTab=(await chrome.storage.local.get('banane3Tab')).banane3Tab??null;engine=new BananeEngine3.Engine(adapter,store);rangerErreursDeLot(engine);
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
   /* T21d (H, correctif 1) : avant la requête de validation, la confirmation du serveur n'est pas évaluable : `null` (inconnu à cet instant), plus
    * `false` (faux par construction sur 68 poses sur 68 au lot de la 4:2). Le moteur (épinglé) n'est pas touché : la valeur est corrigée ici, dans
    * l'événement et dans `applied`, avant leur écriture ; rien ne la lit pour décider. */
   if((type==='applied-verified'||type==='validation-intent')&&rest[0]&&rest[0].serverConfirmed===false){rest[0]={...rest[0],serverConfirmed:null};
    if(type==='applied-verified'&&engine.s.applied&&engine.s.applied.serverConfirmed===false)engine.s.applied.serverConfirmed=null;}
   if(type==='validation-observation')preuveServeurEnAttente(rest[0]?.identity);
   const r=await evenement(type,...rest);
   /* 5.0 (D-171) : fin naturelle d'un lot créé avec la relecture : la passe est planifiée (rien si elle est coupée). */
   if(type==='batch-state'||type==='batch-stopped-at-end'){relecturePlanifier();passeDiffPlanifier();}
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
   let lotObservation=null;const propositionMoteur=proposal;
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
   /* 5.0 (I8) : ombre de la voie prédite, APRÈS la décision et la commande, sur des copies ; elle ne rend rien. */
   if(lotObservation&&pilotScope)voieOmbrePlanifier(lotObservation,propositionMoteur,proposal);
   /* 5.0 : règles métier de Mic, consignées APRÈS la décision et la commande (src/regles-metier.js) ; rien n'est rendu au lot. */
   if(lotObservation&&pilotScope)reglesMetierNoter(lotObservation,proposal);
   if(shadow)await engine.event('gcv1-shadow-observed',{identity:proposal?.identity||engine.s.before?.identity||null,
     sessionId:engine.s.sessionId,batchId:engine.s.batch?.id||null,lidarCaptureId:engine.s.lidarId||null,
     proposalId:proposal?.id||null,shadow,...(lotObservation?{lotObservation}:{})});
   if(analysisError)throw analysisError;
   /* Test 7, suite : partie complète et premier cut pas rouge : le lot se clôt ici, avant toute commande (`partieCompleteAuDepart`). */
   if(pilotScope&&proposal&&shadow?.selection?.selectedEngine===GCV1_ENGINE){const p=await partieCompleteAuDepart();
     if(p&&await coordinateurLot.transition('fin-de-lot',()=>cloreSansRouge(p)))return proposal;}
   /* Test 7, suite 2 : premier cut vert, aucune écriture sur lui (`departSurVert`) : arrêt dit, ou passage au premier rouge
    * après la fin de cette boucle (le lot est mis en pause ici, avant toute commande, puis repart sur le cut rouge). */
   if(pilotScope&&proposal&&shadow?.selection?.selectedEngine===GCV1_ENGINE){const d=await departSurVert(),b=engine.s.batch;
     if(d?.action==='arret'&&await coordinateurLot.transition('fin-de-lot',()=>cloreDepartSurVert(d)))return proposal;
     if(d?.action==='naviguer'&&b?.state==='RUNNING'){b.state='PAUSED';b.departSurVert={phase:'navigation',decision:d,at:new Date().toISOString()};
       engine.s.notice=`Cut ${d.cut} déjà validé : Ariane n’y écrit rien et passe au premier cut rouge (${d.devant}) par « cut non validé suivant ».`;
       await engine.event('depart-sur-vert',{identity:null,phase:'decision',part:d.part,cut:d.cut,statut:d.statut,cible:d.devant,total:d.total,traites:d.traites,restants:d.restants});
       const tache=engine.task;void Promise.resolve(tache).catch(()=>{}).then(()=>passerAuRouge(b,d));return proposal;}}
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
 /* T20a : chaque écriture de l'état suit le lot (heure de la pause, fiche de fin de lot persistante) ; aucune décision ne lit ce suivi. */
 const sauverEtat=engine.save.bind(engine);engine.save=async(...a)=>{try{lotSuivre();}catch{/* suivi seulement */}return sauverEtat(...a);};
 manual=new BananeManualSession4.Sessions(engine,adapter,store);native=new BananeNativeSession4.Sessions(engine,adapter,store);await manual.init();await native.init();
 await historiqueRelire();if(selectedTab===null)connexionStatut('no-tab','Aucun onglet ESV choisi.',null);})();
/* T20a (D-243, D-246, D-250) — HISTORIQUE DES PARTIES (src/historique-parties.js). Fiches de départ (`banane3FichesDepart`) et fiches de fin de lot
 * (`banane55FinsLot`) relues en mémoire pour la vue du panneau (`partsHistory`) ; la fiche de fin d'un lot est écrite quand le lot est clos (ou en
 * erreur), complétée par son motif d'arrêt et par les cuts écrits par la deuxième passe. `batch.pausedAt` : heure d'entrée en pause, retirée à la reprise. */
const finsLot={departs:[],fins:[],sig:new Map(),fin:new Map()};
async function historiqueRelire(){const H=globalThis.BananeHistoriqueParties,EC=cacheExport();
 try{finsLot.departs=EC?await EC.lireDeparts(chrome.storage.local):[];}catch{finsLot.departs=[];}
 try{finsLot.fins=H?await H.lireFins(chrome.storage.local):[];}catch{finsLot.fins=[];}}
function partsHistory(){const H=globalThis.BananeHistoriqueParties;if(!H)return [];
 try{return H.historique({departs:finsLot.departs,fins:finsLot.fins,courant:engine?.s?.batch||null,version:VERSION});}catch{return [];}}
function lotSuivre(){const b=engine?.s?.batch;if(!b?.id)return;
 if(/^PAUSED/.test(b.state||'')){if(!b.pausedAt)b.pausedAt=new Date().toISOString();}else if(b.pausedAt)delete b.pausedAt;
 finLotNoter(b);}
function finLotNoter(b){const H=globalThis.BananeHistoriqueParties;if(!H||!b?.id)return;
 /* La fiche déjà écrite (avant un redémarrage du service worker) garde son heure de fin et son motif : rien n'est réécrit plus tard « à maintenant ». */
 try{const at=finDuLot(b),deja=finsLot.fins.find(x=>x?.batchId===b.id);
  const endedAt=Number.isFinite(at)?new Date(at).toISOString():deja?.endedAt||finsLot.fin.get(b.id)||new Date().toISOString();
  const f=H.ficheFin(b,{version:VERSION,motif:b.stoppedAtEnd?.reason??obsFins.get(b.id)?.cause??deja?.motif??null,at:endedAt});if(!f)return;
  finsLot.fin.set(b.id,f.endedAt);while(finsLot.fin.size>16)finsLot.fin.delete(finsLot.fin.keys().next().value);
  const sig=JSON.stringify(f);if(finsLot.sig.get(b.id)===sig)return;finsLot.sig.set(b.id,sig);while(finsLot.sig.size>16)finsLot.sig.delete(finsLot.sig.keys().next().value);
  void Promise.resolve(H.noterFin(chrome.storage.local,f)).then(l=>{if(Array.isArray(l))finsLot.fins=l;}).catch(()=>{});}catch{/* fiche seulement */}}
/* Fin de la deuxième passe d'un lot : ses cuts écrits complètent la fiche de fin du lot (comptés à part des différés, D-238). */
function finLotPasse(vue){const H=globalThis.BananeHistoriqueParties;if(!H||typeof vue?.lotId!=='string'||!Number.isInteger(vue.ecrites))return;
 void Promise.resolve(H.noterFin(chrome.storage.local,{batchId:vue.lotId,ecritsPasse:vue.ecrites})).then(l=>{if(Array.isArray(l))finsLot.fins=l;}).catch(()=>{});}
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
 let command=L.commandRails({decision:lotObservation,runtimeRails:proposal.rails,before,expectedPoses:K.expectedPoses,cameras:L.viewCameras(capture)});
 /* 5.0 (D-147) : cible hors de la vue SEULEMENT, réglage `deplacerVue` actif (coupé par défaut) : le geste qui l'amènerait. */
 /* Profondeur de chaîne de chaque décision du lot (règle prudente), seulement si le réglage est actif. */
 if(deplacerVueReglage())try{const VR=globalThis.BananeVoieRecentree,b=engine.s.batch,id=engine.s.before?.identity;
  if(VR&&b?.id){if(dvMemoire?.batchId!==b.id)dvMemoire=VR.creerMemoire(b.id);VR.noterDecisionReelle(dvMemoire,id,lotObservation);}}catch{/* jamais bloquant */}
 if(deplacerVueReglage()&&command.action!=='lot'&&/(^|-)hors-vue-(left|right)$/.test(command.reason||'')){
  const essai=await deplacerVuePlanifier({lotObservation,proposal,before,capture,command,reglage:deplacerVueReglage()});if(essai.command)command=essai.command;}
 /* 4.9.5.13 (L1) : cible hors de la vue, quel que soit l'étage : la vue est amenée sur la cible (pré-vol), puis la pose est faite. */
 if(profilL1()&&!deplacerVueReglage()&&command.action!=='lot'&&/(^|-)hors-vue-(left|right)$/.test(command.reason||'')){
  const id=engine.s.before?.identity??null,ctx=l1Contexte,cap=ctx&&id&&ctx.identity.cut===id.cut?ctx.lotArgs.capture:null;
  const cc=profilL1se()&&lotObservation.positions?await l1eCorrigerChaine(cap,id,lotObservation.positions):null;
  if(cc)lotObservation.l1eChaine={correction:cc.correction};
  const obs=cc&&cc.correction.appliquee?{...lotObservation,positions:cc.positions}:lotObservation;
  const essai=await deplacerVuePlanifier({lotObservation:obs,proposal,before,capture,command,reglage:reglageVueL1()});if(essai.command)command=profilL1s()?{...essai.command,l1s:'vue'}:essai.command;
  if(cc&&command.action==='lot'&&command.l1s==='vue')lotObservation.l1eChaine.positions=obs.positions;}
 /* 5.0 : chemin d'activation des règles métier, COUPÉ par défaut ; il ne peut que transformer une validation en différé. */
 command=reglesMetierCommande(command,lotObservation,proposal,before);
 if(command.action==='lot'&&command.l1s==='vue'&&lotObservation.l1eChaine?.positions){const id=engine.s.before?.identity??null,ctx=l1Contexte;
  if(ctx&&id&&ctx.identity.cut===id.cut)l1eTransporter(ctx.lotArgs.capture,id,lotObservation.l1eChaine.positions);}
 /* 4.9.5.13 (L1) : un cut que la chaîne ne pose pas passe à la GCV2 (src/gcv2-l1.js). */
 if(profilL1())command=await l1Commande({command,lotObservation,proposal,before,capture});
 /* CH-034 : recherche large sur le nuage capturé (réglage `lot.rechercheLarge`, ÉTEINT), avant la garde R3 : différer ou remplacer une pose que le lot allait valider. */
 command=rechercheLargeCommande(command,lotObservation,proposal,before,capture);
 /* CH-019 : garde « après un différé », en DERNIER : elle ne peut que transformer une validation en différé. */
 command=gardeApresDiffereCommande(command,lotObservation,proposal);
 lotObservation.command={action:command.action,reason:command.reason,...(command.gaugeMm!=null?{gaugeMm:command.gaugeMm}:{}),...(command.ndc?{ndc:command.ndc}:{}),...(command.deplacerVue?{deplacerVue:command.deplacerVue}:{}),...(command.l1s?{l1s:command.l1s}:{})};
 lotObservation.applied=command.action==='lot';
 /* « La ligne » : le panneau dessine « posé par la voie » les cuts traités que
  * la décision a commandés ; la trace vit dans le lot, bornée à ses cuts. */
 const b=engine.s.batch,cut=engine.s.before?.identity?.cut;
 if(b&&Number.isInteger(cut)){b.lotCommands=b.lotCommands||{};b.lotCommands[cut]={...(b.lotCommands[cut]||{}),cut,action:command.action,stage:lotObservation.stage,
  ...(command.l1s||command.reason==='gcv2-l1'||l1PoseEnAttente?{l1:true}:{}),...(command.reason==='garde-apres-differe'?{gardeApresDiffere:true}:{}),...(command.rechercheLarge?{rechercheLarge:command.rechercheLarge}:{})};}
 if(command.action==='engine')return proposal;
 engine.s.proposal={...proposal,rails:command.rails,lotCommand:{...lotObservation.command,stage:lotObservation.stage,
   anchorsUsed:lotObservation.anchorsUsed||[],engineRails:proposal.rails}};
 return engine.s.proposal;
}
/* 5.0 (D-147, fiches/DEPLACER_VUE.md) — DÉPLACER LA VUE. Réglage `deplacerVue`, COUPÉ PAR DÉFAUT : coupé, rien de ce qui suit ne
 * s'exécute et les commandes sont celles d'avant, octet pour octet (tests/deplacer-vue-sw.test.cjs). Actif, pour un cut que le
 * lot ne pose pas PARCE QUE sa cible tombe hors de la vue d'un rail (KI-051) :
 *   1. l'étage de la décision doit être permis (`etages`, « window » par défaut : le moteur a retrouvé lui-même les deux rails) ;
 *   2. avec des vues élargies, la commande du lot doit passer (toutes les autres gardes inchangées) ;
 *   3. pour chaque rail hors de sa vue, le geste nécessaire, d'après la caméra de la capture (`vueNecessaire`) : dézoom
 *      (≤ `dezoomMax`, pixel ≤ `pixelMaxMm`) ou glisser (≤ `glissementPxMax` px) ; sinon refus ;
 *   4. pré-vol (`preVol`) : la page essaie le geste sur chaque rail concerné, sans rien poser, et remet la vue ; un échec laisse
 *      le cut différé, comme aujourd'hui ;
 *   5. la commande devient celle du lot, avec le plan (`deplacerVue`), que `apply` transmet à la page.
 * Un événement `deplacer-vue` par décision (plan ou refus, pré-vol) et par pose ; un `deplacer-vue-geste` par geste (progression
 * de la page). Aucune position n'y est écrite : des NDC, des facteurs, des pixels, des comptes. */
function deplacerVueReglage(){const v=globalThis.BananeSettings?.deplacerVue;return v&&v.actif===true?v:null;}
let dvContexte=null,dvMemoire=null;
const DV_TRANSMIS=['gestesMax','dezoomMax','glissementPxMax','pixelMaxMm','marge','remiseTolerance','molette','glisser'];
const dvR=(v,k=1000)=>Number.isFinite(v)?Math.round(v*k)/k:null;
const dvAmener=r=>r?{cote:r.cote??null,ok:!!r.ok,raison:r.raison??null,gestes:(r.gestes||[]).map(g=>({type:g.type,crans:g.crans??null,px:g.px??null,py:g.py??null,facteurCran:g.facteurCran??null,gain:g.gain??null,camera:g.camera??null,ndcApres:g.ndcApres??null,dureeMs:g.dureeMs??null})),
 ndcAvant:r.ndcAvant??null,ndcApres:r.ndcApres??null,pixelMm:r.pixelMm??null,dureeMs:r.dureeMs??null,remise:r.remise??null}:null;
const dvPlan=p=>p?{cotes:p.cotes,gestesMax:p.gestesMax,dezoomMax:p.dezoomMax,glissementPxMax:p.glissementPxMax}:null;
async function deplacerVuePlanifier({lotObservation,proposal,before,capture,command,reglage}){
 const L=globalThis.BananeLotDecision,K=globalThis.BananeCore3,VR=globalThis.BananeVoieRecentree,identity=engine.s.before?.identity??null;
 const ev={phase:'decision',identity:identity?{part:identity.part??null,cut:identity.cut??null}:null,batchId:engine.s.batch?.id??null,stage:lotObservation.stage??null,raisonLot:command.reason,ndc:command.ndc??null};
 const fin=async(refus,extra={})=>{await engine.event('deplacer-vue',{...ev,...extra,refus}).catch(()=>{});return {command:null};};
 try{
  if(!(reglage.etages||['window']).includes(lotObservation.stage))return fin('etage');
  if(!VR||!capture||!lotObservation.positions)return fin('capture-absente');
  const large=L.commandRails({decision:lotObservation,runtimeRails:proposal.rails,before,expectedPoses:K.expectedPoses,cameras:VR.camerasLarges(capture)});
  if(large.action!=='lot')return fin('commande:'+large.reason);
  /* Règle prudente D-147 (`regle:'prudente'`, défaut) : le moteur recentré sur la voie du lot (même décision, sa confiance), la
   * profondeur de chaîne et l'écartement des appuis, aux seuils de la voie prédite (`voiePrediteOmbre`) ; la vue aux limites de
   * ce réglage. Une règle non tenue laisse le cut différé. `regle:'aucune'` : seulement l'étage et les limites de la vue. */
  if(reglage.regle!=='aucune'){const ctx=dvContexte;dvContexte=null;
   if(!ctx||ctx.identity.cut!==identity?.cut)return fin('regle:contexte-absent');
   const seuils={...VR.REGLE_PRUDENTE,...(globalThis.BananeSettings?.voiePrediteOmbre||{}),dezoomMax:reglage.dezoomMax,glissementPxMax:reglage.glissementPxMax};
   const r=VR.recentrer({capture:{...ctx.lotArgs.capture,camera:capture.camera??null,viewCaptures:capture.viewCaptures||[]},science:ctx.lotArgs.science,anchors:ctx.anchors,
     Shadow:globalThis.BananeGCV1Shadow,runtimeRails:proposal.rails,before,expectedPoses:K.expectedPoses,vue:'deplacee',profondeurAppui:c=>dvMemoire?.profondeurs.get(c)??0});
   const verdict=VR.verdictPrudent(r,seuils);
   ev.regle={posable:verdict.posable,raison:verdict.raison,etage:r.stage,confiance:VR.confiances(r.moteur),profondeur:r.profondeur,ecartVoieMm:dvR(r.fromPredictionMm,10),ecartementVoisinMm:dvR(r.ecartVoisinMm,10)};
   if(!verdict.posable)return fin('regle:'+verdict.raison);
   const meme=r.positions&&['left','right'].every(s=>Math.hypot(...r.positions[s].map((v,i)=>v-lotObservation.positions[s][i]))<=1e-6);
   if(!meme)return fin('regle:decision-differente');}
  const vue=VR.vueNecessaire(capture,lotObservation.positions,reglage.marge??L.VIEW_MARGIN),cams=L.viewCameras(capture),cotes={};
  if(vue.inconnu)return fin('vue-inconnue');
  for(const s of ['left','right']){const p=vue.par[s];if(!p||p.ok)continue;const c=cams[s];
   const pixel=c?.viewport?.width&&c.projection?.[0]?2/Math.abs(c.projection[0])/c.viewport.width*1000:NaN;
   const dezoom=p.dezoom<=reglage.dezoomMax&&Number.isFinite(pixel)&&pixel*p.dezoom<=reglage.pixelMaxMm,glisser=p.panPx<=reglage.glissementPxMax;
   const besoin={dezoom:dvR(p.dezoom),panPx:dvR(p.panPx,10),pixelMm:dvR(pixel),ndc:p.ndc.map(x=>dvR(x))};
   if(!dezoom&&!glisser)return fin('hors-limites',{besoin:{[s]:besoin}});
   cotes[s]={geste:dezoom?'dezoom':'glissement',...besoin};}
  if(!Object.keys(cotes).length)return fin('dans-la-vue');
  const plan={version:'deplacer-vue-v1',cotes,...Object.fromEntries(DV_TRANSMIS.filter(k=>reglage[k]!==undefined).map(k=>[k,reglage[k]]))};
  const preVol=[];
  if(reglage.preVol!==false)for(const s of Object.keys(cotes)){let r;
   try{r=await call('amenerDansLaVue',s,lotObservation.positions[s],identity,{...plan,cotes:undefined,essai:true});}
   catch(e){r={cote:s,ok:false,raison:'erreur:'+String(e?.message||e).slice(0,100)};}
   preVol.push(dvAmener(r));journalerDeplacementVue(r&&!r.erreur?[r]:null,r?.remise,r?.raison?.startsWith?.('erreur:')?r.raison:null,'pre-vol',null);
   if(!r?.ok)return fin('pre-vol:'+(r?.raison||'?'),{plan:dvPlan(plan),preVol});}
  await engine.event('deplacer-vue',{...ev,plan:dvPlan(plan),preVol,refus:null});
  return {command:{...large,deplacerVue:plan}};
 }catch(e){return fin('erreur:'+String(e?.message||e).slice(0,100));}}
/* CH-031 — JOURNAL DE LA REMISE DE LA VUE (fiches/DEPLACEMENT_VUE_JOURNAL.md). JOURNALISATION SEULE, comme `clic-hors-vue` : `store.putEvent`
 * sans attente, jamais `engine.event` pour l'enregistrement du bilan ; l'identité du cut est celle de l'événement. Rien n'est envoyé à la page,
 * aucune commande ni décision n'en dépend ; une panne du journal est avalée. Par côté amené : `deplacement-vue` (geste, tentatives, caméra
 * avant / après, durée) ; par pose ou pré-vol : `deplacement-vue-remise` (faite / échec / inconnue, écart d'échelle, durée) ; en fin de lot :
 * `deplacement-vue-bilan` (comptes et temps ajouté, sans numéro de cut). */
const dvJournalBilanHorsLot=new (globalThis.BananeDeplacementVue?.Bilan||class{noterDeplacement(){}noterRemise(){}vide(){return true;}resume(){return null;}})();
function journalerDeplacementVue(cotes,remise,erreur,phase,dureeApplyMs){try{const DVm=globalThis.BananeDeplacementVue;if(!DVm?.detailDeplacement)return;
 const b=engine?.s?.batch,enLot=!!b?.id&&b.state==='RUNNING',identity=engine?.s?.before?.identity??null;
 if(enLot&&!(b.deplacementVue&&typeof b.deplacementVue==='object'))b.deplacementVue={};
 const bilan=enLot?new DVm.Bilan(b.deplacementVue):dvJournalBilanHorsLot,id=identity&&Number.isInteger(identity.cut)?{part:identity.part??null,cut:identity.cut}:null;
 const base={batchId:enLot?b.id:null,identity:id},geste=globalThis.BananeSettings?.deplacerVue?.deplacement?.geste??null;
 const ecrire=(type,d)=>void Promise.resolve(store.putEvent({eventId:globalThis.BananeCore3.uid(),timestamp:new Date().toISOString(),type,...base,...d})).catch(()=>{});
 for(const c of Array.isArray(cotes)?cotes.slice(0,2):[]){const d=DVm.detailDeplacement(c,{phase,geste});if(!d)continue;bilan.noterDeplacement(d);ecrire('deplacement-vue',d);}
 const aVu=(Array.isArray(cotes)&&cotes.length>0)||(remise&&typeof remise==='object')||!!erreur;
 if(aVu){const r=DVm.detailRemise(remise,erreur,{phase,dureeApplyMs,cransMax:globalThis.BananeSettings?.deplacerVue?.molette?.cransMax});
  if(!(r.resultat==='inconnu'&&!(Array.isArray(cotes)&&cotes.length)&&phase==='pose'&&!erreur)){bilan.noterRemise(r);ecrire('deplacement-vue-remise',r);}}
 if(enLot)Object.assign(b.deplacementVue,bilan);}catch{}}
/* Bilan du lot clos : une fois, et seulement s'il y a eu un déplacement ou une remise. */
function bilanDeplacementVue(b){try{const n=b?.deplacementVue,DVm=globalThis.BananeDeplacementVue;if(!b?.id||!n||n.bilanEcrit||!DVm?.Bilan||!OBS_CLOS.includes(b.state))return;
 const bilan=new DVm.Bilan(n);if(bilan.vide())return;n.bilanEcrit=true;
 void Promise.resolve(store.putEvent({eventId:globalThis.BananeCore3.uid(),timestamp:new Date().toISOString(),type:'deplacement-vue-bilan',batchId:b.id,etat:b.state,...bilan.resume()})).catch(()=>{});}catch{}}
/* CH-034 — RECHERCHE LARGE (src/recherche-large.js, réglage `lot.rechercheLarge`, livrée ÉTEINTE ; chantiers/CH-034/JOURNAL.md § 2). Sur un cut que la
 * commande allait VALIDER (pose du lot, de la GCV2, ou paire du moteur aux deux rails résolus), le moteur gelé est relancé sur le nuage capturé à des
 * graines espacées jusqu'à ±400 mm en travers ; la pose est confrontée aux paires fortes trouvées (module pur) :
 *   - `differer` : le cut est DIFFÉRÉ comme un cut non résolu (deux abstentions, motif `recherche-large`), comme la garde R3 ; sous L1-se il redevient
 *     un reste de la deuxième passe et sort du transport local ;
 *   - `remplacer` (mode 'choisir') : la meilleure paire large devient la commande du lot (position relue à 0,01 mm, écartement admissible, cible dans la
 *     vue de chaque rail ; hors de la vue : différé, motif `recherche-large`, la vue n'est pas déplacée ici) ; la pose remplacée n'est pas un appui ;
 *   - `garde` : la commande est rendue telle quelle (le même objet).
 * Éteinte (`actif:false`), module absent, ou zone hors de `zones` : la commande est rendue telle quelle, rien n'est écrit. Une panne laisse la commande
 * telle quelle. Événement `recherche-large` à chaque décision (millimètres, pertes, comptes ; jamais une coordonnée). */
function rechercheLargeCommande(command,lotObservation,proposal,before,capture){
 const RL=globalThis.BananeRechercheLarge,R=RL?.reglage(globalThis.BananeSettings?.lot?.rechercheLarge);
 if(!R||!R.actif||!command)return command;
 try{const SIDES=['left','right'],L=globalThis.BananeLotDecision,K=globalThis.BananeCore3,identity=engine.s.before?.identity??null;
  const valide=command.action==='lot'||command.action==='engine'&&SIDES.every(s=>command.rails?.[s]?.status==='candidate');
  if(!valide||!capture||!before||!Number.isInteger(identity?.cut))return command;
  if(Array.isArray(R.zones)){let z=null;try{z=l1Zone(identity);}catch{z=null;}if(!z||!R.zones.includes(z.zone))return command;}
  const expected=K.expectedPoses({rails:before},command.rails);
  const positions=Object.fromEntries(SIDES.map(s=>[s,expected[s].positionSceneRelative]));
  const d=RL.decider({capture:{identity:capture.identity??null,rails:capture.rails,pointsSceneRelative:capture.pointsSceneRelative,visibleByClipBoxes:capture.visibleByClipBoxes},positions,R});
  const resume=RL.resumer(d),ev={identity:{part:identity.part??null,cut:identity.cut},...resume,etage:lotObservation?.stage??null,commandeAvant:{action:command.action,reason:command.reason??null}};
  const differer=motif=>{const dr=L.deferRails(proposal.rails,lotObservation,'recherche-large','décision sur le lot : recherche large sur le nuage, '+motif+' : cut laissé à l\'opérateur');
   lotObservation.rechercheLarge={...resume,commande:{action:command.action,reason:command.reason??null}};
   journalerSimple('recherche-large',{...ev,issue:'differe',motifFinal:motif});
   if(profilL1se()){const t=l1eTransportDe(identity);for(let i=t.length-1;i>=0;i--)if(t[i]?.identity?.cut===identity.cut)t.splice(i,1);
    if(passeDiffReglage().mode!=='off'){const z=l1Zone(identity);l1ResteNoter(identity,{identity:{part:identity.part,cut:identity.cut,frameId:identity.frameId??null},zone:z?.zone??'abords',adv:z?.adv??[],regle:false});}}
   return {...dr,rechercheLarge:'differer'};};
  if(d.etat==='differer')return differer(d.motif);
  if(d.etat!=='remplacer'||!d.positions){journalerSimple('recherche-large',{...ev,issue:'garde'});return command;}
  /* Remplacer : la branche « lot » de commandRails, à l'identique (position relue, écartement, vue), sans la décision du lot. */
  const rails={};
  for(const s of SIDES){const init=before[s],M=init.sceneRelativeToProfileLocal,q=globalThis.BananeCaptureCore.point(M,d.positions[s]),o=globalThis.BananeCaptureCore.point(M,init.positionSceneRelative);
   rails[s]={...proposal.rails[s],status:'candidate',delta:[q[0]-o[0],q[1]-o[1],q[2]-o[2]],confidence:0,reasons:['décision sur le lot : recherche large sur le nuage, meilleure paire loin de la pose'],
    source:'recherche-large',lotDecision:{stage:'recherche-large',version:RL.VERSION}};}
  let exp2;try{exp2=K.expectedPoses({rails:before},rails);}catch{return differer('remplacer-position-illisible');}
  if(SIDES.some(s=>globalThis.BananeCaptureCore.distance(exp2[s].positionSceneRelative,d.positions[s])>1e-5))return differer('remplacer-position-mismatch');
  const G=globalThis.BananeGauge4,gaugeMm=G.gaugeMmOf(exp2,globalThis.BananeCaptureCore);
  if(!G.admissible(G.classifyMm(gaugeMm)))return differer('remplacer-ecartement-'+G.classifyMm(gaugeMm));
  const cams=L.viewCameras(capture);
  for(const s of SIDES){const cam=cams?.[s];if(!cam||!L.inView(cam,d.positions[s]).inView)return differer('remplacer-hors-vue-'+s);}
  lotObservation.rechercheLarge={...resume,commande:{action:command.action,reason:command.reason??null}};
  journalerSimple('recherche-large',{...ev,issue:'remplace',gaugeMm:Math.round(gaugeMm*10)/10});
  return {action:'lot',reason:'recherche-large',rails,gaugeMm:Math.round(gaugeMm*10)/10,rechercheLarge:'remplacer'};
 }catch(e){journalerSimple('recherche-large',{identity:{part:engine?.s?.before?.identity?.part??null,cut:engine?.s?.before?.identity?.cut??null},etat:'erreur',message:String(e?.message||e).slice(0,160)});return command;}}
/* CH-019 — GARDE « APRÈS UN DIFFÉRÉ » (src/garde-apres-differe.js, réglage `lot.gardeApresDiffere`, livrée ALLUMÉE). Sur un cut que la commande
 * allait VALIDER (pose du lot, de la GCV2, ou paire du moteur aux deux rails résolus), si un des cuts qui le précèdent est un différé du lot
 * (`b.deferred` de la même partie, hors cuts différés par cette garde : pas de cascade) et, règle R3, qu'il a moins d'appuis que le seuil
 * (`anchorsUsed` de la décision du lot), le cut est DIFFÉRÉ comme un cut non résolu (deux abstentions, motif `garde-apres-differe`) et
 * l'événement `garde-apres-differe` le dit. Sous L1-se, il redevient un reste de la deuxième passe et sort du transport local. Coupée
 * (`actif:false`) : la commande est rendue telle quelle (le même objet), rien n'est écrit. Une panne laisse la commande telle quelle. */
function gardeApresDiffereCommande(command,lotObservation,proposal){
 const GA=globalThis.BananeGardeApresDiffere,R=GA?.reglage(globalThis.BananeSettings?.lot?.gardeApresDiffere);
 if(!R||R.ok&&!R.actif||!command)return command;
 try{const SIDES=['left','right'],b=engine.s.batch,identity=engine.s.before?.identity??null;
  const valide=command.action==='lot'||command.action==='engine'&&SIDES.every(s=>command.rails?.[s]?.status==='candidate');
  if(!b||!Number.isInteger(identity?.cut))return command;
  /* Appuis : `anchorsUsed` de la décision du lot ; à défaut, ceux de la chaîne consignés par la GCV2 (`l1.chaine.appuis`) ; sinon inconnus (comptés 0). */
  const appuis=Array.isArray(lotObservation?.anchorsUsed)?lotObservation.anchorsUsed.length
   :Number.isInteger(lotObservation?.l1?.chaine?.appuis)?lotObservation.l1.chaine.appuis:null;
  const suivant=gardeApresDiffereSuivant(b,identity,lotObservation,appuis,command);
  if(!valide)return suivant.rendre(command,false);
  const differesLot=(b.deferred||[]).filter(d=>(d?.identity?.part??null)===(identity.part??null)).map(d=>d?.cut??d?.identity?.cut)
   .filter(c=>Number.isInteger(c)&&b.lotCommands?.[c]?.gardeApresDiffere!==true);
  /* CH-015 (définition de R3) : les appuis comptent TELS QUE SANS LA GARDE : un cut qu'elle a différé dans la fenêtre d'appuis est rendu au compte
   * (borne haute `appuisSansGardeMax`), sinon elle s'alimenterait elle-même de proche en proche. */
  const j=GA.juger({cut:identity.cut,differesLot,appuis:suivant.appuisSansGardeMax},R);
  if(!j.differer)return suivant.rendre(command,false);
  const d=globalThis.BananeLotDecision.deferRails(proposal.rails,lotObservation,'garde-apres-differe','décision sur le lot : cut validable après un différé, '+(j.appuis??'?')+' appui(s) : cut laissé à l\'opérateur');
  lotObservation.gardeApresDiffere={regle:j.regle,appuis:j.appuis,voisinsDifferes:j.voisinsDifferes,commande:{action:command.action,reason:command.reason??null}};
  journalerSimple('garde-apres-differe',{identity:{part:identity.part??null,cut:identity.cut},version:GA.VERSION,regle:j.regle,coupures:R.coupures,appuisMin:R.appuisMin,
   appuis:j.appuis,appuisMesures:appuis,voisinsDifferes:j.voisinsDifferes,etage:lotObservation?.stage??null,commandeEvitee:{action:command.action,reason:command.reason??null},...(j.reglageIllisible?{reglageIllisible:R.raison}:{})});
  if(profilL1se()){const t=l1eTransportDe(identity);for(let i=t.length-1;i>=0;i--)if(t[i]?.identity?.cut===identity.cut)t.splice(i,1);
   if(passeDiffReglage().mode!=='off'){const z=l1Zone(identity);l1ResteNoter(identity,{identity:{part:identity.part,cut:identity.cut,frameId:identity.frameId??null},zone:z?.zone??'abords',adv:z?.adv??[],regle:false});}}
  return suivant.rendre(d,true);
 }catch(e){journalerSimple('garde-apres-differe',{identity:{part:engine?.s?.before?.identity?.part??null,cut:engine?.s?.before?.identity?.cut??null},etat:'erreur',message:String(e?.message||e).slice(0,160)});return command;}}
/* Racines sans appui créées par la garde (demande de l'intégrateur, 29/10) : sur un cut qui a, dans la fenêtre d'appuis du lot (`gap` cuts avant
 * lui, src/lot-decision.js), au moins un cut DIFFÉRÉ PAR LA GARDE, l'événement `garde-apres-differe-suivant` donne ses appuis AVEC la garde (mesurés :
 * `anchorsUsed`) et SANS elle en borne haute (`appuisSansGardeMax` = min(`anchors`, appuis + cuts de la garde dans la fenêtre) : si chacun avait été
 * validé et pris pour appui), sa commande finale, et s'il est lui-même différé par la garde. Le journal dit ainsi si la garde a créé des racines sans
 * appui. Rend { appuisSansGardeMax, rendre(commande, différé par la garde) → commande } ; `rendre` écrit l'événement quand il y a lieu. */
function gardeApresDiffereSuivant(b,identity,lotObservation,appuis,command){
 const L=globalThis.BananeLotDecision,gap=L?.DEFAULTS?.gap??3,max=L?.DEFAULTS?.anchors??2,cut=identity.cut;
 const gardes=[];for(let c=cut-gap;c<cut;c++)if(b.lotCommands?.[c]?.gardeApresDiffere===true)gardes.push(c);
 const appuisSansGardeMax=appuis===null?null:gardes.length?Math.min(max,appuis+gardes.length):appuis;
 return {appuisSansGardeMax,rendre:(rendue,parLaGarde)=>{if(gardes.length)journalerSimple('garde-apres-differe-suivant',{identity:{part:identity.part??null,cut},cutsGarde:gardes,fenetre:gap,
  appuis,anchorsUsed:Array.isArray(lotObservation?.anchorsUsed)?lotObservation.anchorsUsed.slice(0,12):null,appuisSansGardeMax,
  etage:lotObservation?.stage??null,commande:{action:rendue?.action??null,reason:rendue?.reason??null},commandeAvantGarde:{action:command.action,reason:command.reason??null},differeParLaGarde:parLaGarde});
  return rendue;}};}
/* Décision sur le lot : l'état du lot (ancres) vit dans le lot lui-même,
 * persisté avec lui, et disparaît avec lui. */
let lotAnchorCandidate=null;
function holdLotAnchor(lotObservation,command){
 const L=globalThis.BananeLotDecision,batch=engine.s.batch,candidate=lotAnchorCandidate;lotAnchorCandidate=null;
 if(!candidate||!batch?.lotObservation||typeof L?.holdAnchor!=='function')return;
 /* D-221 : une pose L1-s (`l1s`) n'est jamais un appui ; sous L1, la pose validée de la GCV2 l'est. */
 /* CH-034 : une pose remplacée par la recherche large n'est jamais un appui (l'appui mémorisé serait celui de la décision du lot, pas la pose commandée). */
 lotObservation.anchorHeld=command?.l1s||command?.rechercheLarge==='remplacer'?false:L.commandsPositions(lotObservation,command)||lotObservation.l1?.etat==='valider'&&command?.action==='lot'&&command?.reason==='gcv2-l1';
 if(lotObservation.anchorHeld)L.holdAnchor(batch.lotObservation,candidate);
}
/* 4.9.5.13 (test 13, D-217, D-219, fiches/L1_DIFFERES.md) — PROFIL DU LOT « L1 ». Gardé dans storage.local (actions `lot-profil-etat`,
 * `lot-profil`), sinon le réglage `lot.profil` (défaut 'L1') ; lu au démarrage du lot et FIGÉ dans le scope (`lotProfil:'L1'`, absent pour
 * 'actuel'). Profil 'actuel' : rien de ce qui suit ne s'exécute, les commandes sont celles de la 4.9.5.9 (tests/lot-profil-actuel.test.cjs).
 * Profil 'L1', sur un cut que la chaîne du lot ne pose pas (le moteur et la chaîne le diffèrent, ou la commande le replie) :
 *   1. la GCV2 (src/gcv2-l1.js, paramètres figés src/gcv2-parametres-l1.js) lit ce que le lot sait À CET INSTANT : la capture et les
 *      options du cut, les appuis de la chaîne au moment de la décision (`l1Contexte`), les cuts validés par CE lot avant lui (visites
 *      `records` des cuts de `batch.processed`, même repère), la zone de la mémoire des règles métier (évaluée avant de noter le cut) ;
 *      la science est recalculée une fois avec le réservoir du moteur ;
 *   2. « valider » : la commande devient celle de la GCV2 (`gcv2-l1`), le moteur pose et valide, le cut devient appui ;
 *   3. « poser sans valider » : la commande reste un différé ; juste avant la navigation sans décision, la pose de la GCV2 est faite par
 *      la commande `apply` de la page (aucune validation), puis `nextWithoutDecision` part comme d'habitude : le cut reste rouge, approché ;
 *   4. cible hors de la vue : la vue est amenée sur la cible (`amenerDansLaVue`, pré-vol), puis posée par `apply` avec le plan ;
 *   5. chaque décision est consignée dans l'observation du lot (`lotObservation.l1` : état, motif, hypothèse, probabilité, écart au départ,
 *      zone, commande) et la pose sans validation par un événement `l1-pose-sans-valider`.
 * Une panne ici ne pose rien : la commande du lot reste celle d'avant. */
/* 4.9.5.14 (test 14, fiches/L1_APPRENTISSAGE.md) — PROFIL « L1-se » (défaut) : celui de L1-s (chaîne, verts et vue identiques, D-221), avec la
 * décision L1-e des différés (src/gcv2-l1e.js) : paire de la GCV2 corrigée à l'écartement des lignes valides non touchées de la liste d'ESV
 * (instantané de la partie, lu une fois par lot), validation des cuts « plus de 150 mm » dont l'écartement anormal s'explique et que le nuage
 * soutient ; plus aucune pose sans validation. Sans instantané de liste : la décision de L1-s sans pose approchée. */
const CLE_LOT_PROFIL='banane50LotProfil',PROFILS_LOT=['actuel','L1','L1-s','L1-se'];
async function profilDuLot(){let r={};try{r=await chrome.storage.local.get(CLE_LOT_PROFIL)||{};}catch{r={};}
 const v=r[CLE_LOT_PROFIL],d=globalThis.BananeSettings?.lot?.profil;return PROFILS_LOT.includes(v)?v:PROFILS_LOT.includes(d)?d:'actuel';}
async function profilChoisir(args){if(!PROFILS_LOT.includes(args?.profil))throw Error('Profil du lot inconnu : actuel, L1, L1-s ou L1-se.');
 await chrome.storage.local.set({[CLE_LOT_PROFIL]:args.profil});return {profil:args.profil};}
function profilL1(){return ['L1','L1-s','L1-se'].includes(engine?.s?.batch?.scope?.lotProfil)&&!!globalThis.BananeGcv2L1&&!!globalThis.BananeGcv2ParametresL1;}
/* D-221 (fiches/L1_DIFFERES.md § 5) — PROFIL « L1-s » : la chaîne de la 4.9.5.9 intacte (options, appuis, voisins) ; sur un cut qu'elle ne pose pas :
 * a. vue déplacée pour sa cible hors de la vue ; b. décision du lot refaite avec les options de L1 ; c. la GCV2. Une pose L1-s n'est jamais un appui
 * de la chaîne ni un voisin de la GCV2 (marquée `l1s` dans la commande consignée et `l1` dans `lotCommands`). */
function profilL1s(){return profilL1()&&['L1-s','L1-se'].includes(engine?.s?.batch?.scope?.lotProfil);}
function profilL1se(){return profilL1s()&&engine?.s?.batch?.scope?.lotProfil==='L1-se'&&!!globalThis.BananeGcv2L1e;}
/* Instantané décompacté de la liste d'ESV de la partie (src/liste-memoire.js), lu une fois par lot ; null s'il manque. */
let l1eListe={cle:null,table:null};
async function l1eTable(part){const cle=(engine?.s?.batch?.id||'')+'|'+part;if(l1eListe.cle===cle)return l1eListe.table;
 let table=null;try{const LM=globalThis.BananeListeMemoire,k=LM.PRE_INST+part,r=await chrome.storage.local.get(k);table=LM.decompacter(r?.[k])||null;}catch{table=null;}
 l1eListe={cle,table};return table;}
/* Test 17 (fiches/PASSATION_T17_SANSPOSE.md) — voie de la liste d'ESV au cut (`voieDeListe`, comme le banc), lue seulement par `rechListeResMm` (coupé) ; null sans liste. */
async function l1eVoieListe(capture,identity){const G=globalThis.BananeGcv2L1;return G.voieDeListe(await l1eTable(identity.part),identity.cut,capture,{...G.VOIE_LISTE,fenetre:G.leviersActifs().voieListeFenetre});}
/* 4.9.5.15 (fiches/L1_CAP5.md) — sous L1-se, poses de L1 de CE lot (GCV2 validées, chaîne refaite par L1-s) : voisines de la GCV2 pour la seule
 * voie de référence (levier « transport » de src/gcv2-l1.js), jamais appuis de la chaîne ni voisines de sa décision (D-221 tenu). */
let l1eTransport={cle:null,poses:[]};
function l1eTransportDe(identity){const cle=(engine?.s?.batch?.id||'')+'|'+identity.part+'|'+(identity.frameId??null);if(l1eTransport.cle!==cle)l1eTransport={cle,poses:[]};return l1eTransport.poses;}
function l1eTransporter(capture,identity,positions){const G=globalThis.BananeGcv2L1;
 if(!profilL1se()||!G?.LEVIERS_LIVRES?.transport||!capture?.rails||!positions)return;
 l1eTransportDe(identity).push({identity:{part:identity.part,cut:identity.cut,frameId:identity.frameId??null},positions:{left:positions.left.slice(0,3),right:positions.right.slice(0,3)},rails:capture.rails});}
/* Sous L1-se, une pose de la chaîne refaite par L1-s (vue amenée, ou options de L1) passe par la correction d'écartement de la GCV2
 * (`corrigerPoseChaine`, comme le banc). Rend { positions (corrigées ou non), correction } ou null (pas L1-se, capture absente, panne). */
async function l1eCorrigerChaine(capture,identity,positions){const G=globalThis.BananeGcv2L1,SIDES=['left','right'];
 try{if(!profilL1se()||!capture?.rails||!positions||!identity)return null;
  const decal=Object.fromEntries(SIDES.map(s=>[s,G.decalage(capture.rails[s],positions[s])]));if(!SIDES.every(s=>Array.isArray(decal[s])))return null;
  const ref=globalThis.BananeGcv2L1e.referenceEcartement(await l1eTable(identity.part),identity.cut),cc=G.corrigerPoseChaine(capture,decal,ref);
  return {positions:cc.correction.appliquee?G.positionsDe(capture,{left:{decal:cc.decal.left},right:{decal:cc.decal.right}}):positions,correction:cc.correction};}
 catch{return null;}}
const ETAGES_L1=['first-pass','window','choice','crossing'];
function reglageVueL1(){return {...(globalThis.BananeSettings?.deplacerVue||{}),actif:true,etages:ETAGES_L1,regle:'aucune'};}
let l1Contexte=null,l1PoseEnAttente=null,l1ModeleCache=null;
function l1Modele(){return l1ModeleCache||(l1ModeleCache=globalThis.BananeGcv2L1.modeleFige(globalThis.BananeGcv2ParametresL1,'lot'));}
/* Zone du cut à l'instant de la décision : mémoire des règles métier du lot, évaluée avant de noter le cut (src/regles-metier.js). */
function l1Zone(identity){const M=globalThis.BananeReglesMetier,c=reglesOmbre.capture,mem=reglesMemoire();
 try{if(!M||!mem||!c||c.erreur||c.cut!==identity?.cut)return {zone:'abords',adv:[],source:'inconnue'};
  const e=M.evaluer(mem,M.resumer({identity:{part:c.part,cut:c.cut},decision:{stage:'deferred'},action:null,valide:false,surface:c.surface}));
  const P=M.DEFAULTS.pn,A=M.DEFAULTS.adv,pn=mem.zones.map(z=>[z.debut-P.margeAvant,z.fin+P.margeApres]),adv=(mem.zonesADV||[]).map(z=>[Math.max(0,z.debut-A.margeAvant),z.fin+A.margeApres]);
  if(e.zone.pnControle)pn.push(e.zone.pnControle);if(e.zone.advControle)adv.push(e.zone.advControle);
  const dans=l=>l.some(([a,b])=>identity.cut>=a&&identity.cut<=b);
  return {zone:dans(pn)?'pn':dans(adv)?'adv':'abords',adv,source:'regles-metier'};}catch{return {zone:'abords',adv:[],source:'inconnue'};}}
/* Cuts validés par CE lot avant le cut (même partie, même repère) : pose de départ et pose validée de leur dernière visite. */
function l1Voisins(b,identity){const SIDES=['left','right'],f=identity?.frameId??null;
 /* L1-s (D-221) : les cuts posés par L1 ne sont pas des voisins. */
 const horsL1=c=>!(profilL1s()&&b?.lotCommands?.[c]?.l1);
 const faits=new Set((b?.processed||[]).filter(p=>p?.identity?.part===identity.part).map(p=>p.cut??p.identity?.cut).filter(horsL1));
 const par=new Map();
 for(const r of engine?.s?.records||[]){const id=r?.identity;if(!id||id.part!==identity.part||(id.frameId??null)!==f||!faits.has(id.cut)||id.cut===identity.cut)continue;
  if(SIDES.every(s=>Array.isArray(r.rails?.[s]?.initial?.sceneRelativeToProfileLocal)&&Array.isArray(r.rails?.[s]?.initial?.positionSceneRelative)&&Array.isArray(r.rails?.[s]?.corrected?.positionSceneRelative)))par.set(id.cut,r);}
 return [...par.values()].map(r=>({identity:{part:r.identity.part,cut:r.identity.cut,frameId:f},
  positions:Object.fromEntries(SIDES.map(s=>[s,r.rails[s].corrected.positionSceneRelative.slice(0,3)])),rails:Object.fromEntries(SIDES.map(s=>[s,r.rails[s].initial]))}));}
/* Plan de vue pour une cible de la GCV2 (mêmes limites et même pré-vol que « déplacer la vue », D-147). */
async function l1PlanVue(capture,positions,identity){const L=globalThis.BananeLotDecision,VR=globalThis.BananeVoieRecentree,r=reglageVueL1();
 const vue=VR.vueNecessaire(capture,positions,r.marge??L.VIEW_MARGIN),cams=L.viewCameras(capture),cotes={};
 if(vue.inconnu)return {ok:false,raison:'vue-inconnue'};
 for(const s of ['left','right']){const p=vue.par[s];if(!p||p.ok)continue;const c=cams[s];
  const pixel=c?.viewport?.width&&c.projection?.[0]?2/Math.abs(c.projection[0])/c.viewport.width*1000:NaN;
  const dezoom=p.dezoom<=r.dezoomMax&&Number.isFinite(pixel)&&pixel*p.dezoom<=r.pixelMaxMm,glisser=p.panPx<=r.glissementPxMax;
  if(!dezoom&&!glisser)return {ok:false,raison:'hors-limites'};
  cotes[s]={geste:dezoom?'dezoom':'glissement',dezoom:dvR(p.dezoom),panPx:dvR(p.panPx,10),pixelMm:dvR(pixel),ndc:p.ndc.map(x=>dvR(x))};}
 if(!Object.keys(cotes).length)return {ok:true,plan:null};
 const plan={version:'deplacer-vue-v1',cotes,...Object.fromEntries(DV_TRANSMIS.filter(k=>r[k]!==undefined).map(k=>[k,r[k]]))};
 if(r.preVol!==false)for(const s of Object.keys(cotes)){let x;
  try{x=await call('amenerDansLaVue',s,positions[s],identity,{...plan,cotes:undefined,essai:true});}catch(e){x={ok:false,raison:'erreur:'+String(e?.message||e).slice(0,100)};}
  if(!x?.ok)return {ok:false,raison:'pre-vol:'+(x?.raison||'?')};}
 return {ok:true,plan};}
async function l1CommandeCoeur({command,lotObservation,proposal,before,capture}){
 const SIDES=['left','right'],ctx=l1Contexte;l1Contexte=null;l1PoseEnAttente=null;
 if(command.action==='lot'||command.action==='engine'&&SIDES.every(s=>command.rails?.[s]?.status==='candidate'))return command;
 const G=globalThis.BananeGcv2L1,L=globalThis.BananeLotDecision,K=globalThis.BananeCore3,VR=globalThis.BananeVoieRecentree,Sh=globalThis.BananeGCV1Shadow;
 const b=engine.s.batch,identity=engine.s.before?.identity??null;
 try{
  if(command.reason==='regles-metier'){lotObservation.l1={version:G.VERSION,etat:'rien',motif:'regle-metier'};return command;}
  if(!ctx||!identity||ctx.identity.cut!==identity.cut||!capture||typeof Sh?.scientificProposeBothAvecReservoir!=='function'){lotObservation.l1={version:G.VERSION,etat:'rien',motif:'contexte-absent'};return command;}
  /* L1-s, b. : la décision du lot refaite avec les options de L1 (garde de paire éteinte, appuis à 10 cuts), mêmes appuis ; si elle pose
   * (vue amenée au besoin), pose validée, jamais appui. */
  if(profilL1s()&&command.reason!=='regles-metier'){
   let d2=L.decideCut({...ctx.lotArgs,anchors:ctx.anchors,options:{...G.REGLE.lotOptions}});
   const cc=d2.positions?await l1eCorrigerChaine(ctx.lotArgs.capture,identity,d2.positions):null;
   if(cc&&cc.correction.appliquee)d2={...d2,positions:cc.positions};
   let c2=L.commandRails({decision:d2,runtimeRails:proposal.rails,before,expectedPoses:K.expectedPoses,cameras:L.viewCameras(capture)});
   if(c2.action!=='lot'&&/(^|-)hors-vue-(left|right)$/.test(c2.reason||'')&&d2.positions){const essai=await deplacerVuePlanifier({lotObservation:d2,proposal,before,capture,command:c2,reglage:reglageVueL1()});if(essai.command)c2=essai.command;}
   if(c2.action==='lot'){const c=reglesMetierCommande({...c2},lotObservation,proposal,before);
    lotObservation.l1={version:G.VERSION,etat:c.action==='lot'?'chaine-l1':'rien',motif:c.action==='lot'?null:'regles-metier',etage:d2.stage,raison:d2.reason!=null?String(d2.reason).slice(0,80):null,
     poseAvant:Object.fromEntries(SIDES.map(s=>[s,before?.[s]?.positionSceneRelative?.slice(0,3)??null])),poseEnvoyee:Object.fromEntries(SIDES.map(s=>[s,d2.positions?.[s]?.slice(0,3)??null])),
     ...(cc?{correction:cc.correction}:{})};
    if(c.action==='lot'){l1eTransporter(ctx.lotArgs.capture,identity,d2.positions);return {...c,l1s:'chaine'};}}
  }
  const t0=Date.now(),science=Sh.scientificProposeBothAvecReservoir(ctx.lotArgs.capture),z=l1Zone(identity);
  const e=profilL1se()?{regle:G.REGLE_E,reference:globalThis.BananeGcv2L1e.referenceEcartement(await l1eTable(identity.part),identity.cut),voieListe:await l1eVoieListe(ctx.lotArgs.capture,identity),
   ...(G.LEVIERS_LIVRES?.transport?{voisinsTransport:l1eTransportDe(identity).slice()}:{})}:{};
  const g=G.deciderDiffere({capture:ctx.lotArgs.capture,science,appuis:ctx.anchors,options:profilL1s()?{...G.REGLE.lotOptions}:ctx.lotArgs.options,voisins:l1Voisins(b,identity),zone:z.zone,plagesADV:z.adv,modele:l1Modele(),...e});
  const d=g.decision,l1={...G.resumer(g),zoneSource:z.source,ms:Date.now()-t0};
  lotObservation.l1=l1;
  if(d.etat==='rien')return command;
  /* D-220 : chaque changement de pose est définitif dans ESV ; le journal garde, pour chaque cut que L1 touche, la pose d'ESV AVANT la commande
   * et la pose envoyée (repère scène de la capture, comme les visites `records`) : la jointure juge le gain (pose d'avant → Mic contre pose L1 → Mic). */
  const p3=v=>Array.isArray(v)?v.slice(0,3):null;
  l1.poseAvant=Object.fromEntries(SIDES.map(s=>[s,p3(before?.[s]?.positionSceneRelative)]));l1.poseEnvoyee=Object.fromEntries(SIDES.map(s=>[s,p3(g.positions?.[s])]));
  const valider=d.etat==='valider';
  const cg=G.commander({positions:g.positions,runtimeRails:proposal.rails,before,expectedPoses:K.expectedPoses,cameras:L.viewCameras(capture),camerasLarges:VR.camerasLarges(capture),valider});
  l1.commande={action:cg.action,reason:cg.reason,vue:cg.vue??null};
  if(cg.action!=='lot')return command;
  let plan=null;
  if(cg.vue==='deplacer'){const v=await l1PlanVue(capture,g.positions,identity);if(!v.ok){l1.commande.refus='vue:'+v.raison;return command;}plan=v.plan;}
  if(valider){
   const c=reglesMetierCommande({action:'lot',reason:'gcv2-l1',rails:cg.rails,gaugeMm:cg.gaugeMm,...(plan?{deplacerVue:plan}:{})},lotObservation,proposal,before);
   if(c.action==='lot'&&!profilL1s())lotAnchorCandidate={identity:{part:identity.part,cut:identity.cut,frameId:identity.frameId??null},positions:g.positions,stage:'gcv2-l1'};
   else if(c.action!=='lot')l1.commande.refus='regles-metier';
   if(c.action==='lot')l1eTransporter(ctx.lotArgs.capture,identity,g.positions);
   return profilL1s()&&c.action==='lot'?{...c,l1s:'gcv2'}:c;}
  /* Sous τ : la commande reste un différé ; la pose est faite juste avant la navigation sans décision (`adapter.nextWithoutDecision`). */
  l1PoseEnAttente={batchId:b?.id??null,cutId:K.cutId(identity),identity:K.clone(identity),before:K.clone(engine.s.before),rails:cg.rails,plan,
   resume:{etat:d.etat,motif:d.motif??null,p:l1.p,hypothese:l1.hypothese,ecartDepartMm:l1.ecartDepartMm,zone:l1.zone,poseAvant:l1.poseAvant,poseEnvoyee:l1.poseEnvoyee}};
  l1.commande.sansValider='en-attente-de-la-navigation';
  return command;
 }catch(e){lotObservation.l1={version:G?.VERSION??null,etat:'erreur',message:String(e?.message||e).slice(0,160)};return command;}}
/* Cap 5b, test 17 — DEUXIÈME PASSE DES DIFFÉRÉS (réglage `lot.passeDifferes` de src/settings.js, livré allumé en écriture, et interrupteur du panneau `passeDiffAllumee` ; L1-se seulement ; fiches/PASSATION_CAP5_B.md § 15,
 * fiches/PASSATION_T17_PASSE2.md). Le banc redécide chaque différé de L1-se en fin de lot avec tout ce que le lot a posé, avant ET après lui. Ici, le même calcul, à la fin
 * naturelle du lot : mémoire des différés pendant le lot (`l1Restes` : coupe d'identité, zone, plages ADV), puis, nuage relu du magasin (`store.getCloud`), décision de la GCV2
 * (voisins de fin de lot, transport complet, appuis de fin de lot, leviers de la passe réglés le temps de chaque appel), jusqu'à `passes` passes ; seules les décisions
 * « valider » comptent, chaque pose alimente le transport LOCAL de la passe. Niveau « ombre » : ni écriture ni navigation vers ESV, l'événement `passe-differes-ombre`
 * dit ce que la passe poserait. Niveau « ecriture » (second réglage, `passeDiffEcrire`) : elle pose ensuite ces cuts dans ESV. */
let l1Restes={cle:null,m:new Map()};
function l1ResteCle(b){return b?.id??null;}
function l1ResteNoter(identity,reste){const b=engine?.s?.batch,cle=l1ResteCle(b);if(l1Restes.cle!==cle)l1Restes={cle,m:new Map()};
 l1Restes.m.set(`${identity.part}|${identity.frameId??null}|${identity.cut}`,reste);}
function l1ResteOter(identity){l1Restes.m.delete(`${identity.part}|${identity.frameId??null}|${identity.cut}`);}
/* Niveau de la passe : 'off', 'ombre' ou 'ecriture' (livré : écriture, sans plafond, décision de l'opérateur). Une clé absente de `lot.passeDifferes` vaut la valeur livrée
 * (`passeDifferesDefaut`) ; `false` coupe ; toute autre valeur que `true` (ou nombre illisible, leviers illisibles) coupe ; l'écriture exige l'observateur passif (la preuve de la
 * validation) : sans lui, la passe reste en ombre. `max` : cuts écrits au plus (Infinity : sans plafond ; un plafond illisible coupe l'écriture). */
function passeDiffReglage(){const B=globalThis.BananeSettings,R={...B?.passeDifferesDefaut,...B?.lot?.passeDifferes},passes=Number.isInteger(R.passes)&&R.passes>0?R.passes:0;
 const leviers=R.leviers&&typeof R.leviers==='object'&&!Array.isArray(R.leviers)?R.leviers:null,max=R.ecritureMax===null?Infinity:Number.isInteger(R.ecritureMax)&&R.ecritureMax>0?R.ecritureMax:0;
 /* Garde A (`gardeAppuis`, src/garde-passe-appuis.js) : illisible, ou module absent, la passe est coupée (jamais de passe sans sa garde par erreur de réglage). */
 const garde=globalThis.BananeGardePasseAppuis?.reglage(R.gardeAppuis,B?.passeDifferesDefaut?.gardeAppuis)??{ok:false};
 let mode='off';
 if(R.ombre===true&&passes>0&&leviers&&garde.ok)mode=R.ecriture===true&&max>0&&B?.observateurPassif?.actif!==false?'ecriture':'ombre';
 return {mode,ecritureDemandee:R.ecriture===true,passes,leviers:leviers??{},max,garde};}
/* Garde A (fiches/GARDE_PASSE_A.md) : chaîne normale = les voisins de la décision du lot (`l1Voisins` : cuts validés par CE lot hors poses de L1), donc ni la GCV2 dans le lot, ni la passe. */
/* CH-034 : la recherche large sur une pose de la passe (module pur, mode « différer » forcé) ; null si éteinte, sans `passe`, ou en panne. */
function passeDiffRechercheLarge(r,positions){
 const RL=globalThis.BananeRechercheLarge,R=RL?.reglage(globalThis.BananeSettings?.lot?.rechercheLarge);
 if(!R||!R.actif||R.passe!==true||!r?.capture||!positions)return null;
 try{const d=RL.decider({capture:{identity:r.identity??null,rails:r.capture.rails,pointsSceneRelative:r.capture.pointsSceneRelative,visibleByClipBoxes:r.capture.visibleByClipBoxes},positions,R:{...R,mode:'differer'},science:r.science??null});
  return RL.resumer(d);}
 catch(e){journalerSimple('recherche-large',{identity:{part:r?.identity?.part??null,cut:r?.identity?.cut??null},etat:'erreur',passe:true,message:String(e?.message||e).slice(0,160)});return null;}}
function passeDiffGarde(rg,b,identity,decal){return globalThis.BananeGardePasseAppuis.juger({cut:identity.cut,decal,cutsNormaux:l1Voisins(b,identity).map(v=>v.identity.cut)},rg.garde);}
async function l1Commande(args){
 const identity=engine.s.before?.identity??null,suivre=!!(identity&&profilL1se()&&passeDiffReglage().mode!=='off');
 let z=null;if(suivre)try{z=l1Zone(identity);}catch{z=null;}
 const r=await l1CommandeCoeur(args);
 if(suivre){const pose=!!(r&&(r.action==='lot'||r.action==='engine'&&['left','right'].every(s=>r.rails?.[s]?.status==='candidate')));
  /* Test 18 : un cut posé sans validation (sous τ) n'est pas un différé pour la passe, comme au banc (`pose-non-validee`). */
  if(pose||args?.lotObservation?.l1?.commande?.sansValider)l1ResteOter(identity);
  else l1ResteNoter(identity,{identity:{part:identity.part,cut:identity.cut,frameId:identity.frameId??null},zone:z?.zone??'abords',adv:z?.adv??[],regle:args?.command?.reason==='regles-metier'||args?.lotObservation?.l1?.motif==='regle-metier'});}
 return r;}
/* `cours` : la passe de CE lot (promesse jamais rejetée) ; `ecriture` : l'écriture en cours (arrêt demandé, attente de l'écriture de validation) ; `vue` : ce que le panneau lit ;
 * `reprise` : le lot, le réglage et la vue de la passe, gardés pour la relancer (le dernier cut du lot validé à la main, par exemple) ; `etat` : l'état persistant de la passe (T21d). */
const passeDiff={planifie:new Set(),cours:null,ecriture:null,vue:null,reprise:null,etat:null};
/* T21d (D-250, priorité 2) — LA DEUXIÈME PASSE SURVIT AU REDÉMARRAGE DU SERVICE WORKER. Constat (partie 0 du 23/10, lot 1) : 90 décisions en 90 s,
 * puis 32 s sans rien, puis le service worker redémarré (point `restored`) ; la passe, qui vivait en mémoire, a disparu sans fin ni relecture.
 * État persistant, dans chrome.storage.local :
 *  - `banane56PasseDiffEntree`, écrite une fois au départ : le transport des poses du lot (rails réduits aux deux champs que la GCV2 en lit,
 *    `positionSceneRelative` et `sceneRelativeToProfileLocal` : les rails complets portent les contours, environ 80 ko par cut) et les appuis du lot ;
 *  - `banane56PasseDiff`, écrite à chaque décision, à chaque changement de tour et de phase, avant et après chaque cut écrit, et dès que la
 *    validation d'un cut est prouvée : les restes de la passe et leur état, le tour et le prochain reste, les poses décidées (positions, décalages,
 *    rails réduits), l'écriture (cuts à écrire, nombre écrit, cut en vol, cuts prouvés), les comptes du panneau. Phases : `ombre`, `ombre-finie`,
 *    `ecriture`, `finie`. Effacée à la fin de la passe.
 * Au réveil (`passeDiffApresRedemarrage`) : REPRISE au point exact si le lot est le même et clos de lui-même, le profil L1-se, la passe allumée
 * (réglage et interrupteur), l'état lisible et de moins de 24 h ; sinon FIN NOTÉE (`passe-differes-ombre-fin` ou `passe-differes-ecriture-fin`,
 * `issue:'interrompue'`, `motif:'sw-redemarre'`, avec la raison). Un cut décidé n'est jamais redécidé (les décisions gardées et le transport sont
 * relus tels quels), un cut écrit jamais réécrit. Cut EN VOL au redémarrage : validation prouvée et gardée → compté écrit (événements rattrapés,
 * `recupere`) ; intention de pose présente sans preuve → écriture INCERTAINE : la passe s'arrête, l'intention reste (« J'ai contrôlé le cut N »,
 * D-248 : rien ne repart) ; ni intention ni preuve → rien n'a été posé, ou la pose a été remise : le cut est refait avec toutes ses gardes (cut
 * rouge dans la liste d'ESV, pose inchangée depuis la visite du lot, intention notée avant toute pose). La relecture qui attendait la passe est
 * replanifiée après elle. Chaque décision rend aussi la main à la boucle d'événements (écriture de l'état, puis `setTimeout` 0) : sans cela, le
 * second tour, dont les nuages sont déjà en mémoire, s'enchaînait en une seule tâche (microtâches seulement), sans laisser passer ni le journal
 * (IndexedDB), ni les messages. Rien ne change à la décision de la passe ni à ses gardes. */
const CLE_PASSE_DIFF_ETAT='banane56PasseDiff',CLE_PASSE_DIFF_ENTREE='banane56PasseDiffEntree',PASSE_REPRISE_MS=24*3600*1000;
const railsReduits=rails=>Object.fromEntries(['left','right'].map(s=>[s,{positionSceneRelative:rails?.[s]?.positionSceneRelative??null,sceneRelativeToProfileLocal:rails?.[s]?.sceneRelativeToProfileLocal??null}]));
const cederLaMain=()=>new Promise(r=>setTimeout(r,0));
async function passeDiffSauver(E){if(!E||passeDiff.etat!==E)return;E.savedAt=new Date().toISOString();try{await chrome.storage.local.set({[CLE_PASSE_DIFF_ETAT]:E});}catch{/* mémoire seule */}}
async function passeDiffOublier(E){try{const r=(await chrome.storage.local.get(CLE_PASSE_DIFF_ETAT))?.[CLE_PASSE_DIFF_ETAT];
 if(!r||r.id===E?.id)await chrome.storage.local.remove?.([CLE_PASSE_DIFF_ETAT,CLE_PASSE_DIFF_ENTREE]);}catch{/* rien */}}
const vueComptes=vue=>({differes:vue.differes,posees:vue.posees,demandees:vue.demandees,ecrites:vue.ecrites});
/* Départ d'une passe (fin de lot ou relance) : entrée figée, puis état. */
async function passeDiffDebut(b,rg,vue,restes,transport,anchors,cleT){const K=globalThis.BananeCore3;
 const E={v:1,id:K.uid(),lotId:b.id,part:b.scope.part,mode:rg.mode,debut:new Date().toISOString(),relectureApres:rg.mode==='ecriture'&&!!relectureDuLot(b),phase:'ombre',
  restes:restes.map(r=>({identity:r.identity,zone:r.zone,adv:r.adv,lidarCaptureId:r.lidarCaptureId,etat:'differe',motif:null})),passe:1,index:0,n:0,poses:[],ecriture:null,
  vue:vueComptes(vue),cleT,savedAt:null};
 passeDiff.etat=E;
 try{await chrome.storage.local.set({[CLE_PASSE_DIFF_ENTREE]:{v:1,id:E.id,lotId:b.id,anchors,
  transport:transport.map(t=>({identity:t.identity,positions:t.positions,rails:railsReduits(t.rails)}))}});}catch{/* mémoire seule */}
 await passeDiffSauver(E);return E;}
/* Une décision de plus : état du reste, prochain reste, pose ; écrit, puis la main est rendue. `transportSeul` : un cut entré au transport sans pose (panne entre les deux). */
async function passeDiffNoter(E,i,r,n,pose){if(E){const x=E.restes[i];if(x){x.etat=r.etat;x.motif=r.motif??null;}E.index=i+1;E.n=n;if(pose)E.poses.push(pose);await passeDiffSauver(E);}
 await cederLaMain();}
/* Nuage du reste relu du magasin, moteur avec réservoir et rails du moteur (le calcul du premier tour, inchangé) ; faux sans nuage lisible. */
async function passeDiffCharger(r){const K=globalThis.BananeCore3,Sh=globalThis.BananeGCV1Shadow;
 const c=await store.getCloud(r.lidarCaptureId);if(!c?.rails?.left||!c?.rails?.right||!Array.isArray(c.pointsSceneRelative))return false;
 const identity=K.completeIdentity(c.identity||r.identity);r.cloud=c;r.capture={identity,rails:c.rails,pointsSceneRelative:c.pointsSceneRelative,visibleByClipBoxes:c.visibleByClipBoxes};
 r.science=Sh.scientificProposeBothAvecReservoir(r.capture);r.runtimeRails=Sh.toRuntimeRails(r.science);return true;}
/* `rep` (T21d, reprise après redémarrage) : {E, restes, transport, anchors, poses} relus de l'état ; la passe repart au tour et au reste gardés. */
async function passeDiffOmbre(b,rg,vue,rep=null){
 const G=globalThis.BananeGcv2L1,L=globalThis.BananeLotDecision,K=globalThis.BananeCore3,VR=globalThis.BananeVoieRecentree,SIDES=['left','right'],debut=Date.now();
 if(!profilL1se()||engine?.s?.batch?.id!==b.id)return null;
 let restes,transport,anchors,poses,E,passe0=1,i0=0,n0=0;
 if(rep){({restes,transport,anchors,poses,E}=rep);passe0=E.passe;i0=E.index;n0=E.n;}
 else{restes=[];
  for(const d of b.deferred||[]){const id=d.identity;if(!id||!d.lidarCaptureId)continue;
   const r=l1Restes.cle===l1ResteCle(b)?l1Restes.m.get(`${id.part}|${id.frameId??null}|${id.cut}`):null;if(!r||r.regle)continue;
   restes.push({...r,lidarCaptureId:d.lidarCaptureId,etat:'differe',capture:null,science:null,runtimeRails:null});}
  vue.differes=vue.ecrites+restes.length;   /* cumulés sur les relances : un cut écrit n'est plus un reste */
  const cleT=(b.id||'')+'|'+b.scope.part+'|'+(restes[0]?.identity.frameId??null);transport=(l1eTransport.cle===cleT?l1eTransport.poses:[]).slice();anchors=(b.lotObservation?.anchors||[]).slice();poses=[];
  E=await passeDiffDebut(b,rg,vue,restes,transport,anchors,cleT);}
 /* Les leviers de la passe ne valent que le temps d'un appel (synchrone) : un lot qui démarre pendant les attentes garde les siens. */
 const avant=G.leviersActifs(),decider=a=>{G.reglerLeviers({...avant,...rg.leviers});try{return G.deciderDiffere(a);}finally{G.reglerLeviers(avant);}};
 for(let passe=passe0;passe<=rg.passes;passe++){let n=passe===passe0?n0:0;
  if(E.passe!==passe){E.passe=passe;E.index=0;E.n=0;await passeDiffSauver(E);}
  for(let i=passe===passe0?i0:0;i<restes.length;i++){const r=restes[i];if(r.etat!=='differe')continue;
   try{
    if(!r.capture&&!await passeDiffCharger(r)){r.etat='sans-nuage';await passeDiffNoter(E,i,r,n,null);continue;}
    const ref=globalThis.BananeGcv2L1e.referenceEcartement(await l1eTable(r.identity.part),r.identity.cut);
    const g=decider({capture:r.capture,science:r.science,appuis:anchors.slice(),options:{...G.REGLE.lotOptions},voisins:l1Voisins(b,r.identity),voisinsTransport:transport.slice(),
     zone:r.zone,plagesADV:r.adv,modele:l1Modele(),regle:G.REGLE_E,reference:ref,voieListe:await l1eVoieListe(r.capture,r.identity)});
    if(g.decision.etat!=='valider'){r.motif=g.decision.motif??null;await passeDiffNoter(E,i,r,n,null);journalerSimple('passe-differes-ombre',{identity:{part:r.identity.part,cut:r.identity.cut},passe,decision:'rien',motif:r.motif,l1:G.resumer(g)});continue;}
    const cg=G.commander({positions:g.positions,runtimeRails:r.runtimeRails,before:r.capture.rails,expectedPoses:K.expectedPoses,cameras:L.viewCameras(r.cloud),camerasLarges:VR.camerasLarges(r.cloud),valider:true});
    if(cg.action!=='lot'){r.motif='commande:'+(cg.reason??'refus');await passeDiffNoter(E,i,r,n,null);journalerSimple('passe-differes-ombre',{identity:{part:r.identity.part,cut:r.identity.cut},passe,decision:'rien',motif:r.motif,l1:G.resumer(g)});continue;}
    const decal=Object.fromEntries(SIDES.map(s=>[s,G.decalage(r.capture.rails[s],g.positions[s]).map(v=>Math.round(v*100)/100)])),garde=passeDiffGarde(rg,b,r.identity,decal);
    if(garde.bloque){r.motif='garde-appuis';await passeDiffNoter(E,i,r,n,null);journalerSimple('passe-differes-ombre',{identity:{part:r.identity.part,cut:r.identity.cut},passe,decision:'rien',motif:r.motif,decal,garde,l1:G.resumer(g)});continue;}
    /* CH-034 : recherche large sur le nuage (réglage `lot.rechercheLarge`, ÉTEINT ; `passe:true`), mode « différer » seulement : une pose de la passe qui n'est aucune paire
     * forte du nuage, ou concurrencée loin d'elle par une paire au moins aussi bonne, n'est pas écrite (motif `recherche-large`). Une panne laisse la pose. */
    const rl=passeDiffRechercheLarge(r,g.positions);
    if(rl&&rl.etat==='differer'){r.motif='recherche-large';await passeDiffNoter(E,i,r,n,null);journalerSimple('passe-differes-ombre',{identity:{part:r.identity.part,cut:r.identity.cut},passe,decision:'rien',motif:r.motif,decal,garde,rechercheLarge:rl,l1:G.resumer(g)});continue;}
    transport.push({identity:{part:r.identity.part,cut:r.identity.cut,frameId:r.identity.frameId??null},positions:g.positions,rails:r.capture.rails});
    r.etat='pose-ombre';n++;
    poses.push({cut:r.identity.cut,passe,decal,r,positions:g.positions});
    await passeDiffNoter(E,i,r,n,{cut:r.identity.cut,passe,decal,positions:g.positions,i,identity:{part:r.identity.part,cut:r.identity.cut,frameId:r.identity.frameId??null},rails:railsReduits(r.capture.rails)});
    journalerSimple('passe-differes-ombre',{identity:{part:r.identity.part,cut:r.identity.cut},passe,decision:'poserait',decal,garde,l1:G.resumer(g)});
   }catch(e){
    /* Panne après l'entrée au transport et avant la pose (comme avant : le cut reste au transport, sans pose). */
    const seul=r.etat==='pose-ombre'&&!poses.some(p=>p.r===r)&&transport.at(-1)?.identity?.cut===r.identity.cut;
    await passeDiffNoter(E,i,r,n,seul?{transportSeul:true,cut:r.identity.cut,passe,i,identity:transport.at(-1).identity,positions:transport.at(-1).positions,rails:railsReduits(transport.at(-1).rails)}:null);
    journalerSimple('passe-differes-ombre',{identity:{part:r.identity.part,cut:r.identity.cut},passe,decision:'erreur',message:String(e?.message||e).slice(0,160)});}}
  if(!n)break;}
 vue.posees=vue.ecrites+poses.length;
 E.phase='ombre-finie';E.vue=vueComptes(vue);await passeDiffSauver(E);
 journalerSimple('passe-differes-ombre-fin',{lotId:b.id,mode:rg.mode,ecritureDemandee:rg.ecritureDemandee,differes:restes.length,posees:poses.length,cuts:poses.map(p=>p.cut),ms:Date.now()-debut,...(rep?{reprise:'sw-redemarre'}:{})});
 return poses;}
/* Niveau « ecriture » (livré allumé ; fiches/PASSATION_T17_PASSE2.md) : les poses décidées en ombre sont écrites dans l'ordre où elles ont été décidées (chacune repose sur les
 * précédentes : voisins, transport), au plus `max` ; à la première pose non écrite la passe s'arrête. Pour chaque cut (`passeDiffPoser`) : aller au cut ; ESV l'affiche rouge dans sa
 * liste (jamais d'écrasement d'un vert) ; capture ; commande du lot ; pose relue à 1 mm (remise sinon) ; Ctrl+Entrée, prouvé par le compteur « N on M treated », le même cut affiché et
 * l'écriture « valid » vue par l'observateur passif. Tant qu'elle écrit, le panneau ne lance rien d'autre ; « Arrêter », ou l'interrupteur coupé, l'arrête avant le cut suivant.
 * T21d : `aReprendre` (reprise après redémarrage) : les poses qui restent à écrire, dans l'ordre gardé ; les mêmes contrôles de départ sont refaits. */
async function passeDiffEcrire(b,poses,rg,vue,aReprendre=null){
 const E=passeDiff.etat&&passeDiff.etat.lotId===b.id?passeDiff.etat:null;
 let aEcrire;
 if(aReprendre){aEcrire=aReprendre;if(!aEcrire.length&&!E?.ecriture)return;}
 else{aEcrire=poses.slice(0,Math.max(0,rg.max-vue.ecrites));if(!aEcrire.length)return;
  vue.etat='ecriture';vue.message=null;vue.demandees=vue.ecrites+aEcrire.length;
  if(E){E.phase='ecriture';E.ecriture={liste:aEcrire.map(p=>p.cut),faits:0,enVol:null,prouves:[]};E.vue=vueComptes(vue);await passeDiffSauver(E);}}
 const demandees=E?.ecriture?.liste?.length??aEcrire.length;
 for(let i=0;i<200&&engine.task;i++)await engine.task.catch(()=>{});
 /* T21d : reprise où tout était déjà écrit (redémarrage juste avant la fin) : rien à contrôler, la fin est seulement notée. */
 const raison0=!aEcrire.length?null:['en-cours','en-pause'].includes(relecture.passe?.etat)?'une relecture est en cours ou en pause':await lotCloRefus(b,true,null);let issue=raison0?'refus-depart':'fin',raison=raison0;
 if(!raison0){const EC=passeDiff.ecriture={arret:false,attente:null,etat:E};
  try{
   for(const p of aEcrire){
    if(EC.arret||!await passeDiffAllumee()){issue='arret';break;}
    if(engine?.s?.batch?.id!==b.id){issue='lot-change';break;}
    vue.cut=p.cut;let r;
    if(E){E.ecriture.enVol={cut:p.cut,depuis:new Date().toISOString()};await passeDiffSauver(E);}
    try{r=await passeDiffPoser(b,p,EC);}catch(e){r={resultat:'incertain',raison:String(e?.message||e).slice(0,300)};}
    /* Un cut incertain reste « en vol » : au réveil, son intention le dit incertain, jamais réécrit. */
    if(E){if(r.resultat==='ecrit'){E.ecriture.faits++;E.vue.ecrites=vue.ecrites+1;}if(r.resultat!=='incertain')E.ecriture.enVol=null;await passeDiffSauver(E);}
    journalerSimple('passe-differes-ecriture',{identity:{part:b.scope.part,cut:p.cut},passe:p.passe,decal:p.decal,...r});
    if(r.resultat!=='ecrit'){issue=r.resultat;raison=r.raison;break;}
    l1ResteOter(p.r.identity);vue.ecrites++;}
  }finally{passeDiff.ecriture=null;vue.cut=null;}}
 vue.etat=issue==='fin'?'finie':'arretee';vue.message=raison;
 if(E){E.phase='finie';E.vue=vueComptes(vue);await passeDiffSauver(E);}
 journalerSimple('passe-differes-ecriture-fin',{lotId:b.id,issue,raison,ecrites:vue.ecrites,demandees,decidees:poses.length,...(aReprendre?{reprise:'sw-redemarre'}:{})});}
/* Action du panneau : relance la passe, avec les mêmes refus qu'au départ automatique. Les décisions sont REFAITES (ombre) : depuis la première, une relecture ou un Écho
 * a pu changer les voisins ; les cuts déjà écrits par la passe ne sont plus des différés pour elle. */
async function passeDiffEcrireDemande(){
 if(!await passeDiffAllumee())throw Error('Deuxième passe coupée dans Réglages (« Règles et choix du prochain lot ») : rien n’est écrit dans ESV.');
 const P=passeDiff.reprise;
 if(!P||P.b.id!==engine?.s?.batch?.id||passeDiff.cours||passeDiff.ecriture)throw Error('Deuxième passe : aucune écriture à relancer pour ce lot, ou une passe est déjà en cours.');
 Object.assign(P.vue,{etat:'calcul',message:null,cut:null});
 passeDiffSuivre(P.vue,passeDiffOmbre(P.b,P.rg,P.vue).then(poses=>poses&&passeDiffEcrire(P.b,poses,P.rg,P.vue)));return {...P.vue};}
async function passeDiffPoser(b,p,E){
 const K=globalThis.BananeCore3,G=globalThis.BananeGcv2L1,L=globalThis.BananeLotDecision,VR=globalThis.BananeVoieRecentree,S=globalThis.BananeSettings?.lot||{},r=p.r,cut=r.identity.cut,part=b.scope.part,t0=Date.now();
 const refuse=raison=>({resultat:'refuse',raison});
 let now,cg;
 /* Lectures seulement : rien n'est encore écrit. */
 try{
  /* T21d : après un redémarrage, le nuage du cut est relu du magasin (calcul du premier tour) pour la garde « pose inchangée » et la commande. */
  if(!r.capture&&!await passeDiffCharger(r))return refuse('nuage du cut absent du magasin au réveil : la pose décidée ne peut pas être commandée');
  /* Test 18 : comme une correction de la relecture, le cut n'est posé qu'atteint par les boutons d'ESV : saut au cut d'avant (d'après, pour le cut 0), puis un pas. */
  const avant=cut>0?cut-1:cut+1,aller=(c,chemin)=>call('goToCut',{part,cut:c},{chemin,borneConnue:null},K.uid()),nonConfirme=(c,nav)=>refuse(`passage au cut ${c} non confirmé (${String(nav?.refusal?.message||nav?.resultat||'résultat inconnu').slice(0,160)})`);
  let nav=await aller(avant,'auto');if(nav?.resultat!=='confirme')return nonConfirme(avant,nav);
  nav=await aller(cut,'pas');if(nav?.resultat!=='confirme')return nonConfirme(cut,nav);
  if(nav.chemin!=='pas-a-pas')return refuse(`cut ${cut} atteint par ${nav.chemin==='evenement'?'la carte (saut)':nav.chemin||'un chemin inconnu'} : pas de pose juste après un saut`);
  const etat=await readState();if(etat?.identity?.part!==part||etat.identity.cut!==cut)return refuse(`ESV affiche le cut ${etat?.identity?.cut}, pas le cut ${cut}`);
  try{engine.writable(etat.identity);}catch{return refuse('cible bloquée par un résultat incertain archivé');}
  const capture=await call('capture',etat);K.assertTarget(etat.identity,capture.identity);
  now=await readState();
  if(K.key(now.identity)!==K.key(etat.identity)||!K.equalPoses(etat.rails,now.rails))return refuse('le cut affiché ou ses rails ont changé pendant la capture');
  if(!K.equalPoses(r.capture.rails,now.rails,.001))return refuse('pose d’ESV du cut changée depuis la visite du lot');
  const ligne=await relectureLigneListe(cut,now);
  if(ligne?.statut!=='invalid'||ligne.operateur)return refuse(`statut lu dans ESV : ${ligne?ligne.statut+(ligne.operateur?', traité par un opérateur':''):'illisible'} ; ce n’est pas un cut rouge, rien n’est écrasé`);
  cg=G.commander({positions:p.positions,runtimeRails:r.runtimeRails,before:now.rails,expectedPoses:K.expectedPoses,cameras:L.viewCameras(capture),camerasLarges:VR.camerasLarges(capture),valider:true});
 }catch(e){return refuse(`lecture impossible : ${String(e?.message||e).slice(0,200)}`);}
 if(cg.action!=='lot')return refuse(`commande refusée (${cg.reason})`);
 if(cg.vue==='deplacer')return refuse('cible hors de la vue : cette passe ne déplace pas la vue');
 const pose=await poserPuisVerifier(b,now,cg.rails,K.expectedPoses(now,cg.rails),'passe');if(pose)return refuse(pose);
 /* Ctrl+Entrée : si la preuve manque APRÈS l'envoi, la pose reste, l'intention aussi : le cut est à contrôler dans ESV. */
 const a=E.attente={cut,depuisMs:Date.now(),ok:false,refus:null},envoi=ecritureNoterValidation(now.identity,'passe'),incertain=m=>Error(`cut ${cut} : validation incertaine (${m}). Contrôle ce cut dans ESV.`);
 let ev;
 try{ev=await validateInPlaceInESV(now.identity,{part,pageId:b.scope.pageId??null},{commande:S.validationDernierCut==='bouton'?'bouton':'ctrl-entree',boutonId:S.boutonValiderSansSuivant??null});}
 catch(e){E.attente=null;if(/rien n.a été envoyé/.test(e?.message||''))return refuse(await remettrePose(b,now,`validation refusée avant l’envoi : ${String(e.message).slice(0,160)}`));throw incertain(String(e?.message||e).slice(0,200));}
 finally{if(envoi)envoi.retourMs=Date.now();}
 if(!enPlaceProuvee(ev,now.identity)){E.attente=null;throw incertain('compteur ou cut affiché inattendus');}
 const fin=Date.now()+reglageRelecture().attenteEcritureMs;while(!a.ok&&a.refus==null&&Date.now()<fin)await attendreMs(100);
 E.attente=null;
 if(!a.ok)throw incertain(a.refus!=null?`ESV a refusé d’enregistrer la validation, statut ${a.refus}`:`aucune écriture de validation vue en ${Math.round(reglageRelecture().attenteEcritureMs/1000)} s`);
 /* T21d : la preuve est gardée AVANT d'effacer l'intention : au réveil, un cut prouvé est compté écrit, jamais réécrit ni dit incertain. */
 if(E.etat?.ecriture){E.etat.ecriture.prouves.push(cut);await passeDiffSauver(E.etat);}
 await relectureEffacerIntention(cut,b.id);
 /* Le seul marqueur d'une validation d'Ariane : le résumé de la partie compte le cut posé, l'audit du serveur compte la validation. */
 journalerSimple('validation-accepted',{identity:now.identity,action:'VALIDATE',passeDifferes:true});
 return {resultat:'ecrit',gaugeMm:cg.gaugeMm,compteur:[ev.compteurAvant.traites,ev.compteurApres.traites,ev.compteurApres.total],ms:Date.now()-t0};}
function passeDiffEcriture(f){const a=passeDiff.ecriture?.attente;if(a&&f?.kind==='write')ecritureAttendue(a,f,ecritureOk(f.status),f.body&&typeof f.body==='object'?f.body:null);}
function passeDiffPlanifier(){const b=engine?.s?.batch,rg=passeDiffReglage();
 if(!b?.id||passeDiff.planifie.has(b.id)||rg.mode==='off'||!profilL1se())return;
 if(!(b.state==='COMPLETED'||b.state==='STOPPED'&&b.stoppedAtEnd))return;
 const vue={lotId:b.id,mode:rg.mode,etat:'calcul',differes:0,posees:0,demandees:0,ecrites:0,cut:null,message:null};
 passeDiff.planifie.add(b.id);
 /* Test 18 : coupée dans Réglages, la passe ne part pas (ni calcul, ni écriture, rien au panneau). */
 passeDiffSuivre(vue,passeDiffAllumee().then(allumee=>{if(!allumee)return null;passeDiff.vue=vue;
  return passeDiffOmbre(b,rg,vue).then(poses=>{if(!poses||rg.mode!=='ecriture')return null;
   passeDiff.reprise={b,rg,vue};return passeDiffEcrire(b,poses,rg,vue);});}));}
function passeDiffSuivre(vue,travail){
 passeDiff.cours=travail.catch(e=>{vue.etat='erreur';vue.message=String(e?.message||e).slice(0,160);journalerSimple('passe-differes-erreur',{lotId:vue.lotId,mode:vue.mode,message:vue.message});})
  .finally(()=>{if(vue.etat==='calcul'||vue.etat==='ecriture')vue.etat='finie';passeDiff.cours=null;finLotPasse(vue);
   /* T21d : la passe est finie (ou en erreur) : son état persistant est effacé. */
   const E=passeDiff.etat;if(E&&E.lotId===vue.lotId){passeDiff.etat=null;void passeDiffOublier(E);}});}
/* T21d — AU RÉVEIL DU SERVICE WORKER : une passe gardée est reprise au point exact, ou close avec son motif (voir plus haut). La partie rapide
 * (lecture de l'état, contrôles, mise en place de la vue et de la promesse) est attendue par `dispatch` : aucune action du panneau ne passe avant ;
 * le travail (décisions, écritures) part ensuite, en arrière-plan, comme une passe ordinaire. */
async function passeDiffApresRedemarrage(){let st;try{st=await chrome.storage.local.get([CLE_PASSE_DIFF_ETAT,CLE_PASSE_DIFF_ENTREE,CLE_RELECTURE_PASSE,CLE_RELECTURE_REPRISE]);}catch{return;}
 const E=st?.[CLE_PASSE_DIFF_ETAT];if(!E||typeof E!=='object')return;
 const entree=st?.[CLE_PASSE_DIFF_ENTREE],b=engine?.s?.batch,memeLot=!!b?.id&&b.id===E.lotId;
 if(E.lotId)passeDiff.planifie.add(E.lotId);   /* jamais une seconde passe neuve pour ce lot */
 const rg=passeDiffReglage(),vue={lotId:E.lotId??null,mode:rg.mode,etat:'calcul',...{differes:0,posees:0,demandees:0,ecrites:0},...(E.vue||{}),cut:null,message:null,reprise:'sw-redemarre'};
 const decidees=Array.isArray(E.restes)?E.restes.filter(x=>x&&x.etat!=='differe'||x?.motif).length:0,posees=Array.isArray(E.poses)?E.poses.filter(p=>!p?.transportSeul):[];
 const enEcriture=['ombre-finie','ecriture','finie'].includes(E.phase);
 /* La relecture qui attendait la passe n'est replanifiée que si elle n'avait pas démarré (sinon elle a sa propre reprise : jamais relancée seule). */
 const relectureDejaPartie=[st?.[CLE_RELECTURE_PASSE],st?.[CLE_RELECTURE_REPRISE]].some(x=>x&&x.lotId===E.lotId),relancerRelecture=()=>{if(memeLot&&E.relectureApres&&!relectureDejaPartie)relecturePlanifier();};
 const noter=(issue,raison)=>{if(E.phase==='ombre-finie'&&E.mode!=='ecriture')return;if(!enEcriture)journalerSimple('passe-differes-ombre-fin',{lotId:E.lotId??null,mode:E.mode??null,issue,motif:'sw-redemarre',raison,differes:Array.isArray(E.restes)?E.restes.length:null,decidees,posees:posees.length,cuts:posees.map(p=>p.cut)});
  else journalerSimple('passe-differes-ecriture-fin',{lotId:E.lotId??null,issue,motif:'sw-redemarre',raison,ecrites:vue.ecrites,demandees:E.ecriture?.liste?.length??0,decidees:posees.length});};
 /* Mémoire du lot rendue (restes non écrits, transport du lot) : « Relancer la deuxième passe » refait ses décisions comme avant le redémarrage. */
 const rendreMemoire=()=>{if(!memeLot||!Array.isArray(E.restes)||!entree||entree.id!==E.id||!Array.isArray(entree.transport))return;
  const ecrits=new Set(E.ecriture?(E.ecriture.liste||[]).slice(0,E.ecriture.faits):[]);
  if(l1Restes.cle!==l1ResteCle(b)){l1Restes={cle:l1ResteCle(b),m:new Map()};for(const x of E.restes)if(x?.identity&&!ecrits.has(x.identity.cut))l1Restes.m.set(`${x.identity.part}|${x.identity.frameId??null}|${x.identity.cut}`,{identity:x.identity,zone:x.zone,adv:x.adv,regle:false});}
  if(l1eTransport.cle!==E.cleT)l1eTransport={cle:E.cleT,poses:entree.transport.slice()};
  passeDiff.reprise={b,rg,vue};};
 const finir=async(issue,raison)=>{noter(issue,raison);await passeDiffOublier(E);
  if(memeLot){rendreMemoire();vue.etat='arretee';vue.message=`Deuxième passe interrompue par un redémarrage du service worker : ${raison}.`;passeDiff.vue=vue;
   relancerRelecture();}};
 try{
  if(E.phase==='finie'){await passeDiffOublier(E);rendreMemoire();relancerRelecture();return;}
  /* Cut en vol au redémarrage : prouvé → écrit ; intention sans preuve → incertain ; rien → refait (avec ses gardes). */
  const vol=E.phase==='ecriture'?E.ecriture?.enVol:null;let enVolRefait=false;
  if(vol&&Number.isInteger(vol.cut)){const intention=(await relectureIntentions()).find(x=>x.cut===vol.cut&&(x.lotId==null||x.lotId===E.lotId));
   const prouve=(E.ecriture.prouves||[]).includes(vol.cut);
   if(prouve){if(intention)await relectureEffacerIntention(vol.cut,E.lotId);
    const p=posees.find(x=>x.cut===vol.cut);let deja=false;try{deja=(await store.all('events')||[]).some(e=>e?.type==='validation-accepted'&&e.passeDifferes===true&&e.identity?.cut===vol.cut&&e.batchId===E.lotId&&String(e.timestamp)>=String(E.debut));}catch{deja=false;}
    if(!deja)journalerSimple('validation-accepted',{identity:{part:E.part??null,cut:vol.cut,frameId:p?.identity?.frameId??null},action:'VALIDATE',passeDifferes:true,recupere:'sw-redemarre'});
    journalerSimple('passe-differes-ecriture',{identity:{part:E.part??null,cut:vol.cut},passe:p?.passe??null,decal:p?.decal??null,resultat:'ecrit',recupere:'sw-redemarre'});
    E.ecriture.faits++;E.ecriture.enVol=null;vue.ecrites++;E.vue={...E.vue,ecrites:vue.ecrites};}
   else if(intention){
    const raison=`service worker redémarré pendant l’écriture du cut ${vol.cut} : pose peut-être appliquée, validation non prouvée ; contrôle ce cut dans ESV, puis « J’ai contrôlé le cut ${vol.cut} »`;
    journalerSimple('passe-differes-ecriture',{identity:{part:E.part??null,cut:vol.cut},resultat:'incertain',raison,reprise:'sw-redemarre'});
    return finir('incertain',raison);}
   else enVolRefait=true;}
  const allumee=memeLot?await passeDiffAllumee():false;
  const refus=!memeLot?'le lot a changé':!(b.state==='COMPLETED'||b.state==='STOPPED'&&b.stoppedAtEnd)?'le lot ne s’est pas fini de lui-même'
   :E.v!==1||!Array.isArray(E.restes)||!Array.isArray(E.poses)||!Number.isInteger(E.passe)||!Number.isInteger(E.index)?'état de la passe illisible'
   :!entree||entree.id!==E.id||!Array.isArray(entree.transport)?'entrée de la passe illisible'
   :!(Date.now()-Date.parse(E.savedAt||0)<PASSE_REPRISE_MS)?'état gardé depuis plus de 24 h'
   :!profilL1se()?'profil du lot autre que L1-se':rg.mode==='off'?'deuxième passe coupée dans les réglages':!allumee?'deuxième passe coupée dans Réglages (interrupteur)'
   :E.mode==='ecriture'&&enEcriture&&rg.mode!=='ecriture'?'écriture de la deuxième passe coupée dans les réglages':null;
  if(refus)return finir('interrompue',refus);
  rendreMemoire();
  const restes=E.restes.map(x=>({identity:x.identity,zone:x.zone,adv:x.adv,regle:false,lidarCaptureId:x.lidarCaptureId,etat:x.etat,motif:x.motif??null,capture:null,science:null,runtimeRails:null}));
  const transport=entree.transport.concat(E.poses.map(p=>({identity:p.identity,positions:p.positions,rails:p.rails})));
  const poses=posees.map(p=>({cut:p.cut,passe:p.passe,decal:p.decal,positions:p.positions,r:restes[p.i]}));
  passeDiff.etat=E;passeDiff.vue=vue;
  vue.etat=enEcriture?'ecriture':'calcul';
  journalerSimple('passe-differes-reprise',{lotId:E.lotId,motif:'sw-redemarre',phase:E.phase,passe:E.passe,index:E.index,differes:E.restes.length,decidees,posees:poses.length,
   ecrites:vue.ecrites,cutEnVol:vol?.cut??null,enVol:vol?(enVolRefait?'refait':'ecrit'):null,depuis:E.savedAt??null,
   /* Trace des décisions déjà prises (leur événement a pu se perdre avec le service worker : le journal est écrit sans attente). */
   restes:E.restes.map(x=>({cut:x.identity?.cut??null,etat:x.etat,motif:x.motif??null})),poses:poses.map(p=>({cut:p.cut,passe:p.passe}))});
  let travail;
  if(!enEcriture)travail=passeDiffOmbre(b,rg,vue,{E,restes,transport,anchors:Array.isArray(entree.anchors)?entree.anchors:[],poses})
   .then(ps=>ps&&rg.mode==='ecriture'?passeDiffEcrire(b,ps,rg,vue):null);
  else if(E.phase==='ombre-finie')travail=rg.mode==='ecriture'?passeDiffEcrire(b,poses,rg,vue):Promise.resolve(null);
  else{const faits=E.ecriture.faits,aReprendre=(E.ecriture.liste||[]).slice(faits).map(c=>poses.find(p=>p.cut===c)).filter(Boolean);
   travail=passeDiffEcrire(b,poses,rg,vue,aReprendre);}
  passeDiffSuivre(vue,travail);
  relancerRelecture();
 }catch(e){try{await finir('interrompue',`reprise impossible (${String(e?.message||e).slice(0,160)})`);}catch{/* rien */}}}
const passeDiffReveil=ready.then(passeDiffApresRedemarrage).catch(()=>{});
async function l1PoserSansValider(p){const clic=clicHumainDuLot(),opt={...(clic?{clicHumain:clic}:{}),...(p.plan?{deplacerVue:p.plan}:{})};
 const ev={identity:{part:p.identity.part??null,cut:p.identity.cut??null},batchId:engine?.s?.batch?.id??null,...p.resume,vueDeplacee:!!p.plan};
 const t0=Date.now();
 try{const r=Object.keys(opt).length?await applyInESV(p.before,p.rails,opt):await applyInESV(p.before,p.rails);
  await engine.event('l1-pose-sans-valider',{...ev,ok:true,applyCommandSent:true,validateSent:false,...(r?.deplacerVue?{remise:r.deplacerVue.remise??null}:{})}).catch(()=>{});
  if(p.plan)journalerDeplacementVue(r?.deplacerVue?.cotes,r?.deplacerVue?.remise,null,'pose-l1',Date.now()-t0);return true;}
 catch(e){await engine.event('l1-pose-sans-valider',{...ev,ok:false,erreur:String(e?.message||e).slice(0,200)}).catch(()=>{});
  if(p.plan)journalerDeplacementVue(null,null,String(e?.message||e),'pose-l1',Date.now()-t0);return false;}}
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
 /* D-211 (test 9) : pas seulement un lot `RUNNING`. Le dernier cut validé arrive parfois quelques dixièmes de seconde APRÈS le passage à `STOPPED` (fenêtre de grâce
  * de l'observateur, `dansGrace`), et la relecture « corriger » écrit pendant que le lot est `STOPPED` : sans cela, ni l'un ni les autres n'étaient mémorisés (18 au
  * lieu de 29, partie 13 du projet 2). La partie est celle du lot. Relevé local seulement : aucune requête vers ESV, aucun effet sur la pose. */
 const enCours=b?.state==='RUNNING'||(!!b&&OBS_CLOS.includes(b.state)&&(dansGrace(b)||relecture.passe?.etat==='en-cours'||!!passeDiff.ecriture));
 if(LM&&!echoId&&enCours)void LM.noterEcriture(chrome.storage.local,f,{partie:b.scope?.part,enLot:true,version:VERSION});}catch{/* jamais bloquant */}}
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
  if(!rep)trace.rep=rep=B.lireReponse(await b1Voisins(id.cut,scene),{cut:id.cut,fenetre:B.DEFAULTS.fenetre});
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
 if(!releveOn('translationDepart')||!prep?.evenement){reglesMetierLignes(args.capture.identity,trace.rep);return prep;}
 try{prep.evenement={...prep.evenement,tDepart:await b1TDepart(args,trace)};}catch{/* relevé seulement */}
 reglesMetierLignes(args.capture.identity,trace.rep);
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
   visibleByClipBoxes:capture.visibleByClipBoxes},science:{rails:shadow.rails,summary:shadow.summary},anchors:state.anchors,Shadow:globalThis.BananeGCV1Shadow,
   ...(profilL1()&&!profilL1s()?{options:{...globalThis.BananeGcv2L1.REGLE.lotOptions}}:{})};
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
 /* 5.0 (I8) : ce que l'ombre de la voie prédite lira, en copie (capture, science, appuis réels AU MOMENT de la décision). */
 voieOmbreNoter(identity,capture,shadow,state.anchors,decision);
 /* 5.0 (D-147) : ce que la règle prudente de « déplacer la vue » relira, seulement si le réglage est actif (références, sans copie). */
 dvContexte=deplacerVueReglage()?{identity,lotArgs,anchors:state.anchors.slice(),decision}:null;
 /* 4.9.5.13 (L1) : ce que la GCV2 lira si la chaîne ne pose pas ce cut (capture, options, appuis AU MOMENT de la décision). */
 l1Contexte=profilL1()?{identity,lotArgs,anchors:state.anchors.slice()}:null;
 /* 5.0 : surface « au ras » du cut pour les règles métier (lecture de la capture seulement). */
 reglesMetierCapture(identity,capture);
 /* Rejeu d'un lot « Reprise » : sa première décision porte les appuis de départ. */
 const reprise=seeds.length&&!state.repriseLogged?{fromBatchId:batch.scope.lotReprise.fromBatchId??null,anchors:seeds}:null;
 if(reprise)state.repriseLogged=true;
 return {...decision,...(reprise?{reprise}:{}),applied:false,displayed:false,engineMs:Date.now()-t0};
}
/* 5.0 — RÈGLES MÉTIER DE MIC (src/regles-metier.js, réglage `reglesMetier`, fiches/REGLES_METIER.md). À chaque cut du lot,
 * l'événement `regles-metier-ombre` consigne la zone reconnue (PN confirmé et ses marges, grappe de différés), les règles de Mic
 * déclenchées et ce qu'Ariane AURAIT fait ; à chaque fenêtre de la liste d'ESV lue par B1, les verts à contrôler (`portee:'verts'`).
 * OMBRE (réglage livré) : la surface est lue sur la capture (copie du stockage), l'évaluation part après la décision et la commande ;
 * rien n'est rendu au lot, ni à `batch`, ni aux appuis ; aucune commande n'est envoyée. Une panne ne laisse qu'un événement « erreur ».
 * ACTIVATION (coupée : `actif:false`, toutes les règles à false ; seul Mic l'ouvre) : `reglesMetierCommande` remplace la commande
 * d'un cut que le lot allait VALIDER par deux abstentions GCV1 (`deferRails`, motif `regles-metier`) : le cut est différé. Jamais une
 * position nouvelle, jamais un différé changé en pose. Mémoire volatile, par lot : un redémarrage du service worker la vide. */
const reglesOmbre={mem:null,premier:true,capture:null,eval:null};
const reglesReglage=()=>{const r=reglesDuLot(globalThis.BananeSettings?.reglesMetier);return r&&(r.ombre===true||r.actif===true)&&globalThis.BananeReglesMetier?r:null;};
/* 4.9.5 test 6 (D-164) : lot créé avec l'interrupteur « grappe de différés » (scope.regleGrappeDifferes, figé au démarrage) : le
 * chemin d'activation s'ouvre pour `grappe-differes` SEULEMENT ; les autres règles gardent leur réglage (coupées à la livraison). */
function reglesDuLot(r){if(!r||engine?.s?.batch?.scope?.regleGrappeDifferes!==true)return r;
 return {...r,actif:true,regles:{...(r.regles||{}),'grappe-differes':true}};}
function reglesMemoire(){const b=engine?.s?.batch,M=globalThis.BananeReglesMetier;if(!b?.id||!M)return null;
 if(reglesOmbre.mem?.lotId!==b.id){reglesOmbre.mem=M.creerMemoire(b.id);reglesOmbre.premier=true;}return reglesOmbre.mem;}
function reglesMetierCapture(identity,capture){try{reglesOmbre.capture=null;reglesOmbre.eval=null;if(!reglesReglage())return;
 reglesOmbre.capture={cut:identity?.cut??null,part:identity?.part??null,surface:globalThis.BananeReglesMetier.surface(capture)};
}catch(e){reglesOmbre.capture={cut:identity?.cut??null,part:identity?.part??null,erreur:String(e?.message||e).slice(0,160)};}}
/* Ce que le lot va faire du cut : valider (les deux rails résolus) ou non, et la pose qu'il validerait (positions scène, gardées ici). */
function reglesResume(lotObservation,rails,before,action){const M=globalThis.BananeReglesMetier,K=globalThis.BananeCore3,c=reglesOmbre.capture,SIDES=['left','right'];
 if(!c||c.erreur)throw Error(c?.erreur||'capture du cut absente');
 const valide=action!=='defer'&&!!rails&&SIDES.every(x=>rails[x]?.status==='candidate'&&Array.isArray(rails[x].delta));
 let initiale=null,finale=null;
 if(valide&&before&&SIDES.every(x=>before[x]))try{const e=K.expectedPoses({rails:before},rails);
  initiale=Object.fromEntries(SIDES.map(x=>[x,before[x].positionSceneRelative]));finale=Object.fromEntries(SIDES.map(x=>[x,e[x].positionSceneRelative]));}catch{}
 return M.resumer({identity:{part:c.part,cut:c.cut},decision:lotObservation,action:action??null,valide,surface:c.surface,initiale,finale});}
function reglesEvaluer(lotObservation,rails,before,action){const M=globalThis.BananeReglesMetier,mem=reglesMemoire();if(!mem)throw Error('lot absent');
 const resume=reglesResume(lotObservation,rails,before,action);return {resume,e:M.evaluer(mem,resume),applique:false};}
function reglesMetierCommande(command,lotObservation,proposal,before){try{
 const r=reglesReglage();if(!r||!command)return command;
 const ev=reglesEvaluer(lotObservation,command.action==='lot'?command.rails:proposal.rails,before,command.action);reglesOmbre.eval=ev;
 if(!globalThis.BananeReglesMetier.doitDifferer(ev.e,r)||command.action==='defer')return command;
 const L=globalThis.BananeLotDecision,regles=ev.e.regles.filter(id=>r.regles?.[id]===true);
 const d=L.deferRails(proposal.rails,lotObservation,'regles-metier','décision sur le lot : règle métier de Mic ('+regles.join(', ')+') : cut laissé à l\'opérateur');
 ev.applique=true;ev.reglesAppliquees=regles;return d;
}catch(e){reglesOmbre.eval={erreur:String(e?.message||e).slice(0,160)};return command;}}
function reglesJournal(ev){try{const K=globalThis.BananeCore3;
 void Promise.resolve(store.putEvent({eventId:K.uid(),timestamp:new Date().toISOString(),type:'regles-metier-ombre',schema:1,
  batchId:engine?.s?.batch?.id??null,sessionId:engine?.s?.sessionId??null,...ev})).catch(()=>{});}catch{/* le journal n'est pas critique */}}
function reglesMetierNoter(lotObservation,proposal){const c=reglesOmbre.capture;try{
 const r=reglesReglage(),M=globalThis.BananeReglesMetier;if(!r)return;
 const SIDES=['left','right'],rails=proposal?.rails;
 let ev=reglesOmbre.eval;
 if(!ev)ev=reglesEvaluer(lotObservation,rails,engine?.s?.before?.rails,lotObservation?.command?.action??null);
 if(ev.erreur)throw Error(ev.erreur);
 const differe=!(rails&&SIDES.every(x=>rails[x]?.status==='candidate'&&Array.isArray(rails[x].delta)));
 M.noter(reglesOmbre.mem,ev.resume,{differe,parRegle:ev.applique===true});
 if(r.ombre!==false){reglesJournal(M.evenement(ev.e,{premier:reglesOmbre.premier,actif:ev.applique?{applique:true,regles:ev.reglesAppliquees}:null}));reglesOmbre.premier=false;}
}catch(e){if(reglesReglage()?.ombre!==false)reglesJournal({version:'regles-metier-v1',portee:'cut',identity:{part:c?.part??null,cut:c?.cut??null},etat:'erreur',message:String(e?.message||e).slice(0,160)});}
 finally{reglesOmbre.eval=null;reglesOmbre.capture=null;}}
/* Fenêtre de la liste d'ESV lue par B1 (statut, traité ou vu par un opérateur, bords) : verts à contrôler, signalés une fois par lot. */
function reglesMetierLignes(identity,rep){try{
 const r=reglesReglage(),M=globalThis.BananeReglesMetier,K=globalThis.BananeCore3,mem=reglesOmbre.mem,b=engine?.s?.batch;
 if(!r||!rep?.ok||!Array.isArray(rep.rows)||!mem||mem.lotId!==b?.id)return;
 const rows=rep.rows.map(x=>({i:x.i,statut:x.statut,operateur:x.operateur===true,vu:x.vu===true,fraiche:x.fraiche===true,
  ecartementMm:x.bords?Math.round(K.C.distance(x.bords.left,x.bords.right)*10000)/10:null}));
 const v=M.lignes(mem,rows,{cut:identity?.cut});
 if(v.verts.length&&r.ombre!==false)reglesJournal({version:'regles-metier-v1',portee:'verts',identity:{part:identity?.part??null,cut:identity?.cut??null},reference:v.reference,verts:v.verts});
}catch{/* relevé seulement */}}
/* 5.0 — VERTS À CONTRÔLER (src/verts-a-controler.js, réglage `vertsAControler`, fiches/VERTS_A_CONTROLER.md). Action de panneau, à la
 * demande (fin de lot, bouton « Recalculer », export) : la liste des verts à relire en priorité. LECTURE SEULE de ce qu'Ariane a déjà :
 *  - cuts du lot, PN et zones d'ADV reconnus : événements `regles-metier-ombre` du journal local (repli : listes du lot courant) ;
 *  - lignes de la liste d'ESV : instantané E1 de la partie (chrome.storage.local), gardé seulement s'il concorde avec le lot (les cuts
 *    du lot y sont rouges ou traités) ; repli : lignes que B1 a lues pendant le lot (écartement seul) ;
 *  - poses d'Ariane : bords qu'elle a écrits pendant le lot (mémoire E1, même liste).
 * AUCUNE action dans ESV : ni commande à l'adaptateur, ni message à l'onglet, ni requête. Rien n'est écrit, ni dans le lot ni ailleurs ;
 * la décision et la pose ne lisent jamais cette liste. */
const vertsReglage=()=>globalThis.BananeSettings?.vertsAControler?.actif!==false&&globalThis.BananeVertsAControler?true:false;
async function vertsAControler(args){
 if(!vertsReglage())return {actif:false};
 const V=globalThis.BananeVertsAControler,LM=globalThis.BananeListeMemoire,b=engine?.s?.batch;
 const partie=Number.isInteger(args?.partie)?args.partie:b?.scope?.part??null;
 if(!Number.isInteger(partie))return {actif:true,partie:null,raison:'partie-inconnue'};
 const lot=new Map(),zones=[],zonesA=[],cutDe=x=>x?.cut??x?.identity?.cut;
 let events=[];try{events=await store.all('events')||[];}catch{/* journal illisible : repli sur le lot courant */}
 /* Un cut peut figurer dans plusieurs lots de la partie (lot interrompu puis repris) et IndexedDB rend les événements par clé
  * aléatoire : on les ordonne (instant, puis identifiant) pour que le DERNIER lot fasse foi du drapeau `differe`, toujours le même. */
 const rang=e=>[String(e.timestamp??''),String(e.eventId??'')];
 const ombres=events.filter(e=>e?.type==='regles-metier-ombre'&&e.portee==='cut'&&e.identity?.part===partie&&Number.isInteger(e.identity?.cut))
  .sort((x,y)=>{const a=rang(x),b=rang(y);return a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:0;});
 for(const e of ombres){
  lot.set(e.identity.cut,{cut:e.identity.cut,differe:e.aurait==='deja-differe'||e.aurait==='sans-pose'});
  const c=e.zone?.pnControle;if(Array.isArray(c)&&c.length===2&&c.every(Number.isInteger))zones.push(c);
  const a=e.zone?.advControle;if(Array.isArray(a)&&a.length===2&&a.every(Number.isInteger))zonesA.push(a);}
 if(!lot.size&&b?.scope?.part===partie){for(const x of b.processed||[]){const c=cutDe(x);if(Number.isInteger(c))lot.set(c,{cut:c,differe:false});}
  for(const x of b.deferred||[]){const c=cutDe(x);if(Number.isInteger(c))lot.set(c,{cut:c,differe:true});}}
 /* Plages de PN : celles d'un même PN grandissent au fil du lot ; on les fond. */
 const pn=[];for(const [a,z] of zones.sort((x,y)=>x[0]-y[0]||x[1]-y[1])){const d=pn.at(-1);if(d&&a<=d[1])d[1]=Math.max(d[1],z);else pn.push([a,z]);}
 /* Zones d'ADV (rail de plus, en ombre ; fiches/DETECTION_ADV.md) : mêmes plages grandissantes, fondues de même. */
 const adv=[];for(const [a,z] of zonesA.sort((x,y)=>x[0]-y[0]||x[1]-y[1])){const d=adv.at(-1);if(d&&a<=d[1]+1)d[1]=Math.max(d[1],z);else adv.push([a,z]);}
 let lignes=[],source='aucune',posees=[],cle=null;
 try{if(LM&&globalThis.BananeSettings?.listeMemoire?.actif!==false){
  const inst=(await LM.instantanes(chrome.storage.local,[partie]))?.[0]?.snap,dec=inst?LM.decompacter(inst):null;
  if(dec){const L=V.lignesDeInstantane(dec),parI=new Map(L.map(x=>[x.i,x])),cuts=[...lot.keys()];
   const rouges=cuts.filter(c=>{const x=parI.get(c);return x&&(x.statut!=='valid'||x.operateur);}).length;
   if(cuts.length&&rouges>=0.8*cuts.length){lignes=L;source='instantane';cle=dec.cle;}}
  if(cle){const m=(await chrome.storage.local.get(LM.CLE_MEM))?.[LM.CLE_MEM]?.[partie];
   if(m&&m.cle===cle)for(const [k,e] of Object.entries(m.cuts||{})){const i=Number(k);
    if(Number.isInteger(i)&&lot.has(i)&&!lot.get(i).differe&&Array.isArray(e)&&e.slice(0,6).every(Number.isFinite))posees.push({i,bords:{left:e.slice(0,3).map(v=>v/1e4),right:e.slice(3,6).map(v=>v/1e4)}});}}}}
 catch{/* stockage illisible : repli */}
 const mem=reglesOmbre.mem;
 if(source==='aucune'&&mem?.lignes?.size&&b?.id===mem.lotId&&b?.scope?.part===partie){lignes=[...mem.lignes].map(([i,x])=>({i,statut:x.statut,g:x.g}));source='fenetres-b1';}
 const l=V.liste({partie,lignes,lot:[...lot.values()],zonesPN:pn,zonesADV:adv,posees});
 return {actif:true,...l,source,lotId:b?.scope?.part===partie?b?.id??null:null,calculeA:new Date().toISOString()};}
/* 5.0 (audit 5.0, I8 (1)) — VOIE PRÉDITE EN OMBRE (src/voie-recentree.js, réglage `voiePrediteOmbre`). Pour chaque cut que le lot DIFFÈRE
 * (proposition finale sans les deux rails résolus), l'événement `voie-predite-ombre` consigne ce qu'aurait donné la règle prudente D-147 :
 * moteur recentré sur la voie du lot, vue déplacée (mesurée, jamais faite), étage, confiance, écart à la voie, profondeur de chaîne, geste
 * de vue nécessaire, verdict. CONSIGNÉ SEULEMENT : le calcul part après la décision et la commande du cut, sur des copies ; il ne rend
 * rien au lot, n'écrit ni dans `batch` ni dans ses appuis, n'envoie aucune commande à ESV. Ses propres « poses » ne servent d'appuis
 * qu'à lui-même (mémoire de l'ombre, volatile : un redémarrage du service worker la vide, la chaîne de l'ombre repart alors des seuls
 * appuis réels). Le calcul lourd (relance du moteur) attend que la page travaille (capture suivante), sinon 4 s, comme B1. Une panne
 * ne laisse qu'un événement « erreur ». */
const voieOmbre={mem:null,premier:true,contexte:null};
const voieOmbreFile=[];let voieOmbreMinuterie=null;
const voieOmbreReglage=()=>{const r=globalThis.BananeSettings?.voiePrediteOmbre;return r&&r.actif===true&&globalThis.BananeVoieRecentree?r:null;};
function voieOmbreNoter(identity,capture,shadow,anchors,decision){try{
 voieOmbre.contexte=null;if(!voieOmbreReglage())return;
 const copie=x=>x==null?x:JSON.parse(JSON.stringify(x));
 voieOmbre.contexte={identity:copie(identity),decision:copie(decision),anchors:copie(anchors||[]),science:copie({rails:shadow.rails,summary:shadow.summary}),
  capture:{identity:copie(identity),rails:copie(capture.rails),pointsSceneRelative:capture.pointsSceneRelative,visibleByClipBoxes:capture.visibleByClipBoxes,
   camera:copie(capture.camera??null),viewCaptures:(capture.viewCaptures||[]).map(v=>({camera:copie(v?.camera??null)}))}};
}catch{voieOmbre.contexte=null;}}
function voieOmbrePlanifier(lotObservation,propositionMoteur,propositionFinale){try{
 const ctx=voieOmbre.contexte;voieOmbre.contexte=null;
 const reglage=voieOmbreReglage(),V=globalThis.BananeVoieRecentree,b=engine.s.batch;
 if(!ctx||!reglage||!b?.id)return;
 if(voieOmbre.mem?.batchId!==b.id){voieOmbre.mem=V.creerMemoire(b.id);voieOmbre.premier=true;}
 const mem=voieOmbre.mem;V.noterDecisionReelle(mem,ctx.identity,ctx.decision);
 const differe=!['left','right'].every(s=>propositionFinale?.rails?.[s]?.status==='candidate');
 if(!differe)return;
 const copie=x=>x==null?x:JSON.parse(JSON.stringify(x)),K=globalThis.BananeCore3;
 const commande=lotObservation.command?{action:lotObservation.command.action,reason:lotObservation.command.reason??null}:null;
 const runtime=copie(propositionMoteur?.rails||null),before=copie(engine.s.before?.rails||ctx.capture.rails),ctxEv={batchId:b.id,sessionId:engine.s.sessionId??null};
 voieOmbrePousser(()=>{const t0=Date.now();let ev;
  try{ev={...V.evaluerDiffere({mem,capture:ctx.capture,science:ctx.science,ancresReelles:ctx.anchors,decisionReelle:ctx.decision,commandeReelle:commande,
    Shadow:globalThis.BananeGCV1Shadow,runtimeRails:runtime,before,expectedPoses:K.expectedPoses,seuils:reglage}).evenement,ms:Date.now()-t0};}
  catch(e){ev={version:'voie-predite-ombre-v1',identity:{part:ctx.identity.part??null,cut:ctx.identity.cut??null},etat:'erreur',message:String(e?.message||e).slice(0,160)};}
  if(voieOmbre.premier){ev.seuils={...reglage,etages:[...reglage.etages]};voieOmbre.premier=false;}
  void Promise.resolve(store.putEvent({eventId:K.uid(),timestamp:new Date().toISOString(),type:'voie-predite-ombre',schema:1,...ctxEv,...ev})).catch(()=>{});});
}catch{/* ombre : jamais bloquant */}}
function voieOmbrePousser(f){voieOmbreFile.push(f);while(voieOmbreFile.length>8)try{voieOmbreFile.shift()();}catch{}clearTimeout(voieOmbreMinuterie);voieOmbreMinuterie=setTimeout(voieOmbreVider,4000);}
function voieOmbreVider(){clearTimeout(voieOmbreMinuterie);voieOmbreMinuterie=null;for(const f of voieOmbreFile.splice(0))try{f();}catch{/* jamais bloquant */}}
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
 port.onDisconnect.addListener(()=>{panelPorts.delete(port);void syncLauncher().catch(()=>{});
  /* CH-028 : le dernier panneau fermé clôt une correction ouverte (sa séance Écho avec elle). */
  if(!panelPorts.size)void ready.then(()=>correctionVerifierFin('panneau-ferme')).catch(()=>{});});
 void syncLauncher().catch(()=>{});
});
chrome.windows.onRemoved?.addListener(id=>{panelWindows.delete(id);for(const [port,info] of panelPorts)if(info.windowId===id)panelPorts.delete(port);void syncLauncher().catch(()=>{});});
chrome.tabs.onRemoved?.addListener(id=>{for(const [port,info] of panelPorts)if(info.tabId===id)panelPorts.delete(port);void syncLauncher().catch(()=>{});void contratOublier(id);
 if(id===selectedTab)void ready.then(()=>{connexionStatut('no-tab','Onglet ESV fermé : rouvre ESV, puis choisis l’onglet dans « Connexion à ESV ».',id);return echoPagePerdue('tab-closed');}).catch(()=>{});});
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
/* T20a : une reprise d'Écho qui s'arrête sans avoir ré-équipé la page ne laisse pas le statut à « reconnecting ». */
async function echoReprise(tabId){const n=engine?.s?.native,tente=!!n&&n.status==='PAUSED_ADAPTER_UNRESPONSIVE'&&!!n.pageLost&&n.pageLost.reason!=='tab-closed'&&!n.pageLost.repriseEnCours
  &&globalThis.BananeSettings?.echo?.repriseAutomatique!==false;
 try{await echoRepriseCorps(tabId);}
 finally{if(tente&&engine?.s?.connection?.status==='reconnecting'&&!equipements.size)connexionStatut('unavailable','Page ESV rechargée : Écho ne s’y est pas reconnecté. Clique sur Connecter puis Reprendre.',tabId);}}
async function echoRepriseCorps(tabId){const n=engine?.s?.native;if(!n||n.status!=='PAUSED_ADAPTER_UNRESPONSIVE'||!n.pageLost||n.pageLost.reason==='tab-closed')return;
 if(globalThis.BananeSettings?.echo?.repriseAutomatique===false||n.pageLost.repriseEnCours)return;
 const perdue=n.pageLost,R=repriseEchoDelais();perdue.repriseEnCours=true;connexionStatut('reconnecting','Page ESV rechargée : Écho s’y reconnecte.',tabId);await syncLauncher().catch(()=>{});
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
  if(engine.s.connection?.status!=='ready')connexionStatut('unavailable',n.message,tabId);
  await engine.save();await syncLauncher().catch(()=>{});}}
chrome.tabs.onUpdated?.addListener((tabId,info,tab)=>{if(tabId!==selectedTab)return;
 if(info.status==='loading')chargementEsvReset();
 void ready.then(async()=>{
  /* T20a : perte de la page, dite tout de suite (statut). */
  if(info.status==='loading'){connexionStatut('unavailable','Page ESV en cours de rechargement.',tabId);if(native?.running())await echoPagePerdue('page-reloaded');}
  else if(info.status==='complete'&&esvURL(tab?.url)){await Promise.all([echoReprise(tabId),reconnexionAuto(tabId)]);}
  else if(info.status==='complete'&&tab?.url&&!esvURL(tab.url))connexionStatut('unavailable','L’onglet choisi n’affiche plus ESV : rouvre ESV dans cet onglet.',tabId);}).catch(()=>{});});
/* T20a (D-243, D-248, architecture module U) — RECONNEXION AUTOMATIQUE APRÈS F5. À la fin du chargement de l'onglet choisi (`complete`), l'onglet est
 * ré-équipé (`equiperOnglet` : sonde, adaptateur, pont, `ping` ; aucune commande ESV), sauf pendant ce qui gère déjà la page ou ne doit pas être
 * dérangé : Écho (il a sa propre reprise, `echoReprise`), Correction, un lot ouvert (en cours ou en pause : « Reprendre » le rattache lui-même, le lot
 * n'est jamais relancé seul), une action du moteur, la deuxième passe, la relecture, une reprise du lot, un retour au cut. Le contrôle « Une autre
 * Ariane » est celui de `equiperOnglet` : refus définitif, rien d'injecté, aucun nouvel essai. Un nouveau rechargement arrête l'essai en cours.
 * Réglage `connexion` (BananeSettings, facultatif) : `reconnexionAuto` (false : comme avant), `pollMs`, `delaiMaxMs`. Journal : `reconnexion-auto`. */
const reconnexionDelais=()=>({reconnexionAuto:true,pollMs:500,delaiMaxMs:60000,...(globalThis.BananeSettings?.connexion||{})});
function refusReconnexionAuto(){const b=engine?.s?.batch;
 if(selectedTab===null)return 'aucun onglet ESV choisi';
 if(native?.active())return 'Écho actif';
 if(manual?.active())return 'Correction active';
 if(b&&!OBS_CLOS.includes(b.state))return b.state==='RUNNING'?'lot en cours : il se reconnecte seul ou s’arrête en pause':'lot ouvert : clique sur « Reprendre », il se reconnecte seul';
 if(engine?.busy||engine?.task)return 'action d’Ariane en cours';
 if(passeDiff.cours||passeDiff.ecriture)return 'deuxième passe en cours';
 if(passeActive())return 'relecture en cours ou en pause';
 if(repriseEnCours)return 'reprise du lot en cours';
 if(retourCutEnCours)return 'retour à un cut en cours';
 return null;}
async function reconnexionAuto(tabId){
 const R=reconnexionDelais();if(R.reconnexionAuto===false||tabId!==selectedTab)return;
 const refus=refusReconnexionAuto();
 if(refus){if(!native?.active())connexionStatut('unavailable',`Page ESV rechargée ; pas de reconnexion automatique (${refus}).`,tabId);return;}
 const gen=chargementEsv.gen,t0=Date.now();let derniere=null,essais=0;
 connexionStatut('reconnecting','Page ESV rechargée : Ariane s’y reconnecte.',tabId);
 const fin=(resultat,motif)=>{journalerSimple('reconnexion-auto',{resultat,motif:motif?String(motif).slice(0,200):null,essais,ms:Date.now()-t0});};
 while(Date.now()-t0<R.delaiMaxMs){
  if(gen!==chargementEsv.gen||tabId!==selectedTab)return fin('abandon','page rechargée de nouveau ou onglet changé');
  const r=refusReconnexionAuto();if(r){connexionStatut('unavailable',`Page ESV rechargée ; reconnexion interrompue (${r}).`,tabId);return fin('abandon',r);}
  try{const tab=await chrome.tabs.get(tabId);
   if(!esvURL(tab?.url)){connexionStatut('unavailable','L’onglet choisi n’affiche plus ESV : rouvre ESV dans cet onglet.',tabId);return fin('abandon','onglet hors ESV');}
   if(tab.status&&tab.status!=='complete'){await attendre(R.pollMs);continue;}
   essais++;await equiperOnglet(tabId);return fin('equipe',null);}
  catch(e){derniere=e;if(e?.definitif){connexionStatut('unavailable',e.message,tabId);return fin('refus',e.message);}}
  await attendre(R.pollMs);}
 const m='Reconnexion automatique impossible après le rechargement'+(derniere?.message?` (${derniere.message})`:'')+' : clique sur « Reconnecter ».';
 if(gen===chargementEsv.gen)connexionStatut('unavailable',m,tabId);fin('echec',derniere?.message||'délai dépassé');}
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
 rest.finDePartieProbable=departOuvert(engine.s.batch);
 /* T20a : historique des parties (fiches persistantes) et relevé du sélecteur de parties (null tant qu'aucun relevé). */
 rest.partsHistory=partsHistory();rest.partsSelector=partsSelector?{...partsSelector,parts:partsSelector.parts.map(x=>({...x}))}:null;if(avisContrat.lignes.length)rest.avisContrat=avisContrat.lignes.slice();if(typeof rest.notice==='string')rest.notice=vocabulaire(rest.notice);
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
 return {...panelView({...v,records:[],incomplete:[]}),recordsCount:Array.isArray(records)?records.length:0,incompleteCount:Array.isArray(incomplete)?incomplete.length:0,
  /* 5.0 : relecture après le lot, seulement si une passe a eu lieu. */
  ...(relecture.passe?{relecture:relectureVue()}:{}),
  /* Test 17 : deuxième passe des différés, seulement si elle a eu lieu. */
  ...(passeDiff.vue?{passeDifferes:{...passeDiff.vue}}:{}),
  /* CH-017 : file de parties, seulement allumée (src/settings.js `file.actif`). */
  ...(fileReglage()?(void fileCompleterBilan().catch(()=>{}),{fileParties:FPm().vue(fileP.etat)}):{})};}
function pollCurrent(){
 /* Pendant une reprise (retour au cut après F5) ou un retour à un cut demandé, la vue ne lit pas ESV. */
 /* T20a : ni pendant un équipement de l'onglet (le statut est alors « reconnecting », puis « ready »). */
 if(pollPromise||engine.busy||engine.task||repriseEnCours||retourCutEnCours||manual?.active()||native?.active()||selectedTab===null||equipements.size)return;
 const tab=selectedTab,gen=chargementEsv.gen;   /* une lecture partie avant un rechargement ne dit rien de la page rechargée */
 pollPromise=engine.observe().then(()=>{if(gen===chargementEsv.gen&&tab===selectedTab)connexionStatut('ready',null,tab);})
  .catch(e=>{if(!equipements.size&&gen===chargementEsv.gen&&tab===selectedTab)connexionStatut('unavailable',e.message,tab);})
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
 /* T20a : fiches de fin de lot (clé à part, jamais vidée), recopiées comme les fiches de départ. */
 let finsLotExport=[];try{finsLotExport=globalThis.BananeHistoriqueParties?await globalThis.BananeHistoriqueParties.lireFins(chrome.storage.local):[];}catch{/* illisible : aucune fiche */}
 return {v1TimingExport:t,fichesDepart,finsLot:finsLotExport,exportPeriod:{startedAt:mq?.at??null,previousDataCleared:mq?{at:mq.at,afterExportAt:mq.afterExportAt??null,manual:mq.manuel===true,text:EC.texte(mq),counts:mq.counts??null}:null}};
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
const PENDANT_RETOUR=new Set(['connect','reconnect','native-start','native-resume','start','resume','retry','manual-takeover','manual-completion','explicit-skip',
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
/* CH-028 — LA CORRECTION DANS ORBITE (src/correction-liste.js, chantiers/CH-028/CONCEPTION.md). Ariane PROPOSE une liste de cuts à corriger à la fin
 * d'un lot clos (ou d'une file finie ou arrêtée : un lot par partie), l'opérateur corrige et VALIDE LUI-MÊME dans ESV, et ses visites sont enregistrées par
 * une VRAIE séance Écho, marquée `correction` (même format de visite : tools/juger-lot.cjs et tools/jointure-echo-orbite.cjs la lisent sans changement).
 * Ariane n'émet ni pose, ni validation, ni SKIP, ni écriture : la seule commande envoyée à ESV est le « retour à un cut » (lecture seule, `allerAuCut`).
 * L'adaptateur refuse `goToCut` pendant Écho (adapter-page.js) : « Ouvrir » met Écho en pause (la visite en cours se clôt), va au cut, puis reprend Écho
 * (nouvelle période, sans continuité supposée), et seulement pour un cut de la liste. État : `engine.s.correction` (gardé, donc dans la vue du panneau).
 * Journal (export Orbite) : `correction-liste` (une fois par lot), `correction-debut`, `correction-ouvrir`, `correction-fin` (bilan par cut). */
const CL=()=>globalThis.ArianeCorrectionListe;
const LOT_CLOS=new Set(['COMPLETED','STOPPED','FINISHED_WITH_UNCONFIRMED_ACTIONS']);
function lotsACorriger(args){
 const demandes=Array.isArray(args?.batchIds)?args.batchIds.filter(x=>typeof x==='string').slice(0,16):null;if(demandes?.length)return demandes;
 const F=fileP.etat;
 if(F&&['fin','arret'].includes(F.etat)&&Array.isArray(F.bilan)){const ids=[...new Set(F.bilan.map(p=>p?.lotId).filter(x=>typeof x==='string'))];if(ids.length)return ids;}
 const b=engine.s.batch;return b?.id?[b.id]:[];}
function refusCorrection(quoi){const b=engine.s.batch;
 if(b&&!LOT_CLOS.has(b.state))return `${quoi} : le lot est encore ouvert (${b.state}) ; la liste naît d’un lot clos.`;
 if(engine.busy||engine.task)return `${quoi} : une action d’Ariane est en cours.`;
 if(['preparation','en-cours','en-pause'].includes(relecture.passe?.etat))return `${quoi} : la relecture du lot tourne encore.`;
 if(passeDiff.vue&&['calcul','ecriture'].includes(passeDiff.vue.etat))return `${quoi} : la deuxième passe tourne encore.`;
 if(fileActive())return `${quoi} : la file de parties tourne encore.`;
 return null;}
async function correctionListe(args){
 const r=refusCorrection('Liste à corriger refusée');if(r)throw Error(r);
 const C=engine.s.correction;if(C?.etat==='ouverte')return vuePanneau();
 const ids=lotsACorriger(args);if(!ids.length)throw Error('Liste à corriger : aucun lot clos.');
 /* Une fois par lot ET par contenu : une liste qui change (un événement du lot arrivé après une première demande) est inscrite de nouveau ; la dernière fait foi. */
 const signature=E=>JSON.stringify((E||[]).map(e=>[e.part,e.cut,e.signaux]));
 const events=await store.all('events'),deja=new Set(events.filter(e=>e?.type==='correction-liste').map(e=>e.batchId+'|'+signature(e.entrees)));
 const listes=[];
 for(const id of ids){const l=CL().construire(events,{batchId:id});if(!l.trouve)continue;
  listes.push({batchId:id,partie:l.partie,entrees:l.entrees,comptes:l.comptes});
  if(!deja.has(id+'|'+signature(l.entrees)))await store.putEvent({eventId:globalThis.BananeCore3.uid(),timestamp:new Date().toISOString(),type:'correction-liste',schema:1,sessionId:engine.s.sessionId??null,
   batchId:id,partie:l.partie,version:CL().VERSION,debutLot:l.debut,comptes:l.comptes,entrees:l.entrees});}
 if(!listes.length)throw Error('Liste à corriger : le journal ne porte aucune décision de ces lots.');
 const memes=C&&C.etat==='proposee'&&JSON.stringify(C.listes.map(l=>l.batchId))===JSON.stringify(listes.map(l=>l.batchId));
 engine.s.correction={id:memes?C.id:globalThis.BananeCore3.uid(),etat:'proposee',creeA:memes?C.creeA:new Date().toISOString(),listes,...(correctionPartiesReglage()?{entreParties:true}:{})};
 await engine.save();return vuePanneau();}
const entreesCorrection=C=>(C?.listes||[]).flatMap(l=>l.entrees);
/* FIN PROPRE (demande de la mère, 31/10) : aucune séance Écho « correction » ne reste ouverte par erreur. `correctionVivante` (mémoire du service worker)
 * porte l'identifiant de la correction démarrée ou reprise dans CETTE vie du service worker ; `correctionOuverture` couvre la pause d'Écho que fait
 * « Ouvrir ». `correctionVerifierFin` clôt la correction (Écho fermé, bilan inscrit) quand : la liste est finie (chaque cut validé ou corrigé),
 * la séance Écho de la correction n'est plus active (terminée depuis l'onglet Écho, abandonnée), ou le service worker a redémarré. Appelée à chaque
 * lecture de la vue par le panneau ; la fermeture du dernier panneau clôt aussi la correction. */
let correctionVivante=null,correctionOuverture=false,correctionFinEnCours=null;
async function correctionVerifierFin(raisonImposee=null){
 const C=engine.s.correction;if(!C||C.etat!=='ouverte'||correctionOuverture||correctionFinEnCours)return;
 const n=engine.s.native,miens=n?.correction?.id===C.id;
 let raison=raisonImposee;
 if(!raison&&correctionVivante!==C.id)raison='sw-redemarre';
 if(!raison&&!(miens&&native.active()))raison='echo-ferme';
 if(!raison&&miens){const b=CL().bilan(entreesCorrection(C),(n.visits||[]).map(v=>({identity:v.identity,label:v.label??null})));
  if(b.comptes.total&&b.comptes.traites===b.comptes.total)raison='liste-finie';}
 if(!raison)return;
 correctionFinEnCours=correctionTerminer({raison}).catch(e=>journalerSimple('correction-fin',{correctionId:C.id,raison,etat:'erreur',message:String(e?.message||e).slice(0,160)})).finally(()=>{correctionFinEnCours=null;});
 await correctionFinEnCours;}
async function correctionDemarrer(){
 const C=engine.s.correction;if(!C||C.etat!=='proposee')throw Error('Aucune liste à corriger proposée.');
 /* « Ouvrir » serait refusé ensuite (retour à un cut, D-067) : dit dès le départ, rien n'est démarré. */
 if(engine.s.applied)throw Error('Correction non démarrée : une pose d’Ariane est appliquée et pas encore validée (fin du lot) : valide-la, restaure-la ou archive-la, puis recommence.');
 if(engine.s.intent||engine.s.reconcileRequired)throw Error('Correction non démarrée : un résultat incertain reste à clôturer.');
 const cuts=entreesCorrection(C).map(e=>({part:e.part,cut:e.cut}));if(!cuts.length)throw Error('La liste à corriger est vide.');
 await demarrerEcho({correction:{id:C.id,batchIds:C.listes.map(l=>l.batchId),cuts:cuts.slice(0,2000),version:CL().VERSION}});
 C.etat='ouverte';C.debutA=new Date().toISOString();C.sessionId=engine.s.native?.id??null;correctionVivante=C.id;await engine.save();
 journalerSimple('correction-debut',{correctionId:C.id,sessionEcho:C.sessionId,batchIds:C.listes.map(l=>l.batchId),cuts:cuts.length});
 return vuePanneau();}
const correctionOuverte=()=>{const C=engine.s.correction,n=engine.s.native;return !!C&&C.etat==='ouverte'&&!!n&&n.correction?.id===C.id&&native.active();};
async function correctionOuvrir(args){
 const C=engine.s.correction;if(!correctionOuverte())throw Error('Aucune correction en cours : commence la correction avant d’ouvrir un cut.');
 const part=Number.isInteger(args?.part)?args.part:null,cut=Number.isInteger(args?.cut)?args.cut:null;
 if(!entreesCorrection(C).some(e=>e.part===part&&e.cut===cut))throw Error(`Le cut ${cut} de la partie ${part} n’est pas dans la liste à corriger.`);
 /* CH-035 : allumé, un cut d'une AUTRE partie que celle affichée passe par le changement de partie ; éteint, rien n'est lu de plus (4.9.5.31). */
 const RP=correctionPartiesReglage();
 if(RP){let lu=null;try{lu=(await call('ping'))?.label||null;}catch{lu=null;}if(partCut(lu)&&lu.part!==part)return correctionOuvrirAilleurs(C,{part,cut},lu,RP);}
 const enMarche=engine.s.native.status==='RUNNING';
 correctionOuverture=true;let r=null,erreur=null;
 try{if(enMarche)await native.pause();
  try{r=await allerAuCut({part,cut});}catch(e){erreur=e;}
  finally{if(enMarche||engine.s.native?.status==='PAUSED'){try{await native.resume();}catch(e){erreur=erreur||e;}}}}
 finally{correctionOuverture=false;}
 journalerSimple('correction-ouvrir',{correctionId:C.id,identity:{part,cut},resultat:erreur?'erreur':r?.resultat??null,code:r?.code??null,message:erreur?String(erreur.message||erreur).slice(0,160):r?.message??null,
  ecoReprise:engine.s.native?.status??null});
 if(erreur)throw erreur;
 if(r?.ok){C.courant={part,cut,at:new Date().toISOString(),resultat:r.resultat};await engine.save();}
 return {...r,correction:C};}
/* CH-035 — L'AURORE ENTRE LES PARTIES (chantiers/CH-035/CONCEPTION.md). Écho en pause pendant TOUT le trajet (la visite en cours se clôt), changement de
 * partie par le cœur commun à la file (`changerPartieEsv` : `ping` et ses capacités, gestes vers la partie suivante seulement, sinon le lien du
 * sélecteur ; preuve = la partie lue dans la page, rails présents), retour au cut (rejoué tant que la page nouvellement chargée le refuse de façon
 * passagère, `gotoBorneMs`), puis reprise d'Écho (nouvelle période). Une seule séance Écho pour toute l'Aurore : chaque visite porte son identité.
 * Journal : `correction-partie` (de, vers, cible, résultat, motif, mode, tentatives, durée), chaque tentative `correction-partie-tentative`. */
const correctionPartiesReglage=()=>{const r=globalThis.BananeSettings?.correctionEntreParties;return r&&r.actif===true?{changementBorneMs:60000,gotoBorneMs:15000,pollMs:500,...r}:null;};
const GOTO_PASSAGERS=new Set(['OUT_OF_BOUNDS','IDENTITY_UNAVAILABLE_BEFORE','ADAPTER_BUSY','NAVIGATION_PATH_UNAVAILABLE','ESV_ILLISIBLE']);
async function allerAuCutApresChangement(cible,RP){const fin=Date.now()+RP.gotoBorneMs;let r=null;
 for(;;){r=await allerAuCut(cible);if(r?.ok||!GOTO_PASSAGERS.has(r?.code)||Date.now()>=fin)return r;await attendre(RP.pollMs);}}
async function correctionOuvrirAilleurs(C,{part,cut},lu,RP){const t0=Date.now(),de=lu.part;
 const enMarche=engine.s.native.status==='RUNNING';
 correctionOuverture=true;let X=null,r=null,erreur=null;
 C.changement={de,vers:part,cut,depuis:new Date().toISOString()};delete C.passage;await engine.save();
 try{if(enMarche)await native.pause();
  /* Réserve de l'intégrateur (01/11) : l'opérateur corrige ici des cuts déjà posés ; les gestes de la file (« Next non validated cut », « dernier cut puis
   * Next cut ») n'ont jamais été relevés sur un vrai ESV quant à ce qu'ils écrivent dans la partie quittée : l'Aurore change TOUJOURS de partie par le
   * lien du sélecteur (navigation seule), y compris vers la partie suivante. */
  try{X=await changerPartieEsv(part,{R:RP,attendu:()=>engine.s.correction?.id===C.id&&engine.s.correction.etat==='ouverte',
    gestes:()=>false,typeTentative:'correction-partie-tentative'});
   if(X.ok)r=await allerAuCutApresChangement({part,cut},RP);}
  catch(e){erreur=e;}
  finally{if(enMarche||engine.s.native?.status==='PAUSED'){try{await native.resume();}catch(e){erreur=erreur||e;}}}}
 finally{correctionOuverture=false;delete C.changement;}
 const resultat=X?.ok?(X.tentatives.length?'ok':'deja'):'echec',reussie=X?.tentatives?.find(t=>t.issue==='ok');
 const detail=X&&!X.ok?String(X.quitte?'correction close pendant le changement':X.detail||'').slice(0,300):null;
 journalerSimple('correction-partie',{correctionId:C.id,version:CL().VERSION_PARCOURS,de,vers:part,cible:{part,cut},resultat,motif:X&&!X.ok?X.quitte?'quitte':X.motif??null:null,detail,
  mode:reussie?.mode??null,tentatives:(X?.tentatives||[]).map(t=>({mode:t.mode,issue:t.issue,raison:t.raison,dureeMs:t.dureeMs})),dureeMs:Date.now()-t0,ecoReprise:engine.s.native?.status??null,
  ...(erreur?{erreur:String(erreur.message||erreur).slice(0,160)}:{})});
 journalerSimple('correction-ouvrir',{correctionId:C.id,identity:{part,cut},resultat:erreur?'erreur':X?.ok?r?.resultat??null:'refuse',code:r?.code??(X?.ok?null:'CHANGEMENT_PARTIE'),
  message:erreur?String(erreur.message||erreur).slice(0,160):r?.message??detail,ecoReprise:engine.s.native?.status??null,changementPartie:{de,vers:part,resultat}});
 if(erreur)throw erreur;
 if(!X?.ok){C.passage={etat:'refuse',vers:part,texte:`Partie ${part} non ouverte dans ESV : ${detail}`.slice(0,300)};await engine.save();}
 if(!X?.ok)return {ok:false,resultat:'refuse',code:'CHANGEMENT_PARTIE',message:`Partie ${part} non ouverte dans ESV (${detail}) : rien n’a été validé ; ESV reste sur la partie affichée.`,cible:{part,cut},correction:C};
 if(r?.ok){C.courant={part,cut,at:new Date().toISOString(),resultat:r.resultat};await engine.save();}
 return {...r,correction:C,changementPartie:{de,vers:part,resultat}};}
async function correctionTerminer({raison='operateur'}={}){
 const C=engine.s.correction;if(!C||C.etat!=='ouverte')throw Error('Aucune correction en cours.');
 const n=engine.s.native;if(n?.correction?.id===C.id&&native.active())await native.end({dataset:false});
 correctionVivante=null;
 const visites=(engine.s.native?.correction?.id===C.id?engine.s.native.visits:[])||[];
 const b=CL().bilan(entreesCorrection(C),visites.map(v=>({identity:v.identity,label:v.label??null})));
 Object.assign(C,{etat:'terminee',finA:new Date().toISOString(),bilan:b.comptes,courant:null,raisonFin:raison});await engine.save();
 journalerSimple('correction-fin',{correctionId:C.id,raison,sessionEcho:C.sessionId??null,comptes:b.comptes,lignes:b.lignes.map(l=>({part:l.part,cut:l.cut,groupe:l.groupe,statut:l.statut,visites:l.visites,label:l.label??null}))});
 return vuePanneau();}
async function correctionFermer(){const C=engine.s.correction;if(C?.etat==='ouverte')throw Error('Termine la correction avant de fermer la liste.');
 delete engine.s.correction;await engine.save();return vuePanneau();}

/* Démarrage d'Écho (bouton « Démarrer l'observation », ou la correction dans Orbite, CH-028 : `extra.correction`). */
async function demarrerEcho(extra){engine.assertBatchContextFree('démarrer Écho');
  /* 4.9.0.18 (AM-23, AM-06) : libellé du cut illisible = aucune identité pour toute la séance : refus ; plusieurs onglets ESV : dit. */
  let vu=await call('nativeSnapshot').catch(e=>e);
  /* F5 hors séance : la page rechargée n'a plus d'adaptateur. « Connecter » ferait la même chose (injection locale, aucune requête à ESV) ;
   * sinon le démarrage échouait en laissant une session et une période fantôme à chaque clic (fiches/ECHO_F5.md). */
  if(vu instanceof Error){try{await equiperOnglet(selectedTab);vu=await call('nativeSnapshot');}
   catch(e){if(e?.definitif)throw e;throw Error('Écho non démarré : la page ESV ne répond pas ('+(e?.message||vu.message)+'). Clique sur Connecter, puis réessaie.');}}
  if(vu&&(!Number.isInteger(vu.identity?.part)||!Number.isInteger(vu.identity?.cut)))throw Error('Écho refusé : le libellé du cut n’est pas lisible dans ESV (« Cut N of part M » attendu). Ouvre un cut, puis réessaie.');
  const onglets=(await chrome.tabs.query({url:'https://esv.lidar.altametris.xyz/rails_validation/*'}).catch(()=>[])).length;
  const choixRaison=await choixRaisonDuPanneau();   // RM-11 : lu ici, figé dans la séance ; coupé, Écho démarre exactement comme avant
  const opts={...(choixRaison.actif?{raison:choixRaison}:{}),...(extra||{})};const v=await native.start(Object.keys(opts).length?opts:undefined);const n=engine.s.native;
  if(n&&onglets>1){n.message=`Observation native active sur l’onglet choisi seulement (${onglets} onglets ESV ouverts : travaille dans celui-ci).`;await engine.save();}
  return v;}
/* 5.0 (D-170 à D-176) — RELECTURE APRÈS LE LOT (src/relecture-ombre.js, src/relecture-critere.js, fiches/RELECTURE_OMBRE.md).
 * Choix du panneau gardé dans storage.local (`relecture-choix-etat`, `relecture-choix`) : « coupée » (défaut), « ombre » (visite,
 * calcule, note ; Ariane ne pose et ne valide rien, mais ESV marque lui-même « vu » chaque cut affiché pour la première fois),
 * « corriger » (corrige seulement les verts qui passent la règle prudente). Lu au DÉMARRAGE du lot et figé dans son scope
 * (`scope.relecture`, consigné par `batch-started`) ; coupée : le scope n'en porte rien, à l'octet près. Au départ de la passe, le plus
 * prudent du mode figé et du choix courant (revue, W10). Le champ `relecture` du scope n'est jamais envoyé à la page (revue, R7).
 * DÉPART (D-176) : automatique, juste après la fin naturelle du lot (boucle finie, ou arrêt au dernier cut sans pose en attente), sans
 * compte à rebours ; ou à la demande (`relecture-lancer`) sur un lot clos. UNE SEULE PASSE À LA FOIS (revue, correction 2) : la passe
 * existe dès sa planification, à l'état « preparation », avant toute attente ; elle porte un jeton de génération contrôlé à chaque
 * étape. Pendant la préparation et la passe, le panneau ne peut lancer ni une autre passe, ni un lot (« Démarrer »), ni un Écho, ni un
 * retour à un cut ; « Arrêter » (du lot) y vaut « Arrêter la relecture » (W11). ESV et le lot sont contrôlés avant ET après les
 * attentes de la préparation. Elle ne part pas si ESV n'est pas propre : pose appliquée non validée, intention ou réconciliation en
 * cours, correction de relecture interrompue non contrôlée, autre activité, ESV dans une autre partie, partie sans rouge (R3).
 * Pour chaque cut choisi par la sélection (méthode de Mic, PN jamais coupé par le plafond) :
 *   1. aller au cut : les boutons « cut suivant » d'ESV dans une plage (pas), la carte entre deux plages (saut) ;
 *   2. capture (`capture`, la même que le lot), statut du cut dans la liste d'ESV (mémoire de la page, aucune requête), calcul : moteur,
 *      décision du lot avec pour appuis la CHAÎNE DE LA PASSE, partie VIDE comme l'étude, où n'entrent que les poses données aux verts
 *      (revue, correction 8), hauteur apprise ; écart par rail, verdict, raison ; SKIP en ombre (D-172, consigné, JAMAIS envoyé) ;
 *      règle prudente (seuils sur les valeurs brutes) ;
 *   3. mode « corriger », règle passée ET garde (revue, corrections 1, 3, 4) : rôle « vert » PROUVÉ (statut `valid` lu dans la liste
 *      d'ESV, sans drapeau opérateur ; cible permise par le moteur, `engine.writable`), cut atteint par les boutons d'ESV ou par le
 *      pas (jamais juste après un saut par la carte : la passe saute au cut d'avant puis fait un pas), cut qui n'est pas le dernier de
 *      la partie. Alors : la commande du lot (`commandRails`), la pose par la MÊME commande `apply` que le lot (clic 'tout-recentre',
 *      jamais en direct : T-5), relue à 1 mm, puis Maj+Espace (le geste de Mic, `validerMajEspace`), qui VALIDE SUR PLACE (D-179 : sur
 *      un vert valide, ESV reste sur le même cut), prouvé par l'écriture « valid » de la ligne vue par l'observateur passif ET par ce
 *      même cut toujours affiché. La passe avance ensuite d'UN PAS vers le cut suivant (le geste de navigation qu'elle emploie déjà).
 *      Une pose refusée ou non conforme est remise (`restore`) et le cut quitté sans action ; une validation non prouvée, ou ESV
 *      affichant un autre cut, arrête la passe en nommant le cut à contrôler ;
 *   4. événement `relecture-ombre` (statut lu dans ESV, arrivée, pose d'ESV, pose calculée, écart, confiance, verdict, raison,
 *      skipOmbre, règle, garde, action, durées). Aucune pause ajoutée (D-176) : la capture et le calcul font le rythme.
 * « vu » (revue, correction 9) : chaque écriture « SeenByOperator » d'ESV pendant la passe est comptée (`vus`) ; les cuts neufs à
 * visiter sont annoncés au départ (`cutsNeufsAnnonces`, quand la liste d'ESV le dit).
 * En mode « ombre », Ariane n'émet aucune commande de pose, de validation, de SKIP ni d'écriture : navigation, boutons de rail de la
 * capture, lecture. « Arrêter la relecture » arrête à la fin de l'étape en cours (jamais entre la pose et la validation d'un cut).
 * Mémoire volatile : un redémarrage du service worker arrête la passe (relecture-fin « interrompue » au redémarrage) ; une correction
 * interrompue entre la pose et la validation est notée par cut (storage.local), dite au panneau, et bloque relecture, lot et retour à
 * un cut jusqu'à « J'ai contrôlé le cut N » (`relecture-acquitter`). */
const CLE_RELECTURE='banane50Relecture',CLE_RELECTURE_INTENTION='banane50RelectureIntention',CLE_RELECTURE_PASSE='banane50RelecturePasse',CLE_RELECTURE_REPRISE='banane51RelectureReprise',CLE_RELECTURE_REGLAGE_PAUSE='banane51RelecturePauseReglage',MODES_RELECTURE=['coupee','ombre','corriger'];
const RELECTURE_BLOQUE=new Set([...PENDANT_RETOUR,'goto-cut','export-cache-clear','settings','reject','references','relecture-lancer','relecture-reprendre','passe-differes-ecrire']);
/* Actions refusées tant qu'une correction de relecture interrompue n'est pas contrôlée par Mic. */
const RELECTURE_INTENTION_BLOQUE=new Set(['start','goto-cut','relecture-lancer','relecture-reprendre','passe-differes-ecrire']);
/* Écartement d'une pose d'ESV jamais posée (valeur d'origine d'ESV, 1 500 mm) : écarté de la médiane des verts relus. */
const ECARTEMENT_ORIGINE_ESV_MM=1500;
const relecture={passe:null,tache:null,planifie:new Set(),attente:null,gen:0};
/* `departMs` (0, D-176) et `attenteEcritureMs` : rythme ; `attenteVuMs` : après le dernier cut affiché, le temps de recevoir le « vu »
 * qu'ESV écrit 0,9 à 1,7 s après l'arrivée (rien n'est commandé pendant ce temps) ; `validation` : le geste de validation de « corriger » ('maj-espace', le seul
 * vérifié ; toute autre valeur ramène « corriger » à « ombre ») ; `plafondCuts` : budget global de la sélection si entier (hors PN) ;
 * `plafondParZone` : budgets par zone (adv, abords, vert-hors-zone, ecartement ; PN hors budget) qui remplacent ceux du module (D-180). */
/* 4.9.5.13 : `occupeAttentesMs` — attentes successives avant de redemander un passage que la page a refusé parce qu'une de ses actions n'était pas
 * finie (`ADAPTER_BUSY`, terrain 2:19) : 6 essais au plus, 11,75 s en tout. */
const reglageRelecture=()=>({departMs:0,attenteEcritureMs:6000,attenteVuMs:2500,pasMax:40,plafondCuts:null,plafondParZone:null,validation:'maj-espace',
 occupeAttentesMs:[250,500,1000,2000,4000,4000],...(globalThis.BananeSettings?.relecture||{})});
/* Test 17 (D-232 à D-234) : une passe EN PAUSE n'agit plus, mais reste « active » pour les gardes : ni lot, ni Écho, ni retour à un cut,
 * ni seconde passe tant qu'elle n'est pas reprise ou arrêtée. `passeVivante` : celle qui travaille ou se prépare (l'ancien sens de `passeActive`). */
const passeVivante=()=>relecture.passe?.etat==='preparation'||relecture.passe?.etat==='en-cours';
const passeActive=()=>passeVivante()||relecture.passe?.etat==='en-pause';
const REPRISE_DUREE_MS=24*3600*1000;
const RANG_MODE={coupee:0,ombre:1,corriger:2};
async function relectureChoix(){const D=globalThis.BananeSettings?.relectureDefaut;if(!D||D.modifiable!==true)return MODES_RELECTURE.includes(D?.mode)?D.mode:'corriger'; /* Test 27 : « corriger » par défaut, non réglable (ordre de l'opérateur, 30/10) */
 let r={};try{r=await chrome.storage.local.get(CLE_RELECTURE)||{};}catch{r={};}return MODES_RELECTURE.includes(r[CLE_RELECTURE])?r[CLE_RELECTURE]:'coupee';}
async function relectureChoisir(args){if(!MODES_RELECTURE.includes(args?.mode))throw Error('Relecture après le lot : choix inconnu.');
 await chrome.storage.local.set({[CLE_RELECTURE]:args.mode});return {mode:await relectureChoix()};}
const relectureDuLot=b=>{const m=b?.scope?.relecture;return m==='ombre'||m==='corriger'?m:null;};
function relectureJournal(type,champs,p=relecture.passe){journalerSimple(type,{lotId:p?.lotId??null,...champs});}
const pluriel=(n,mot,s='s')=>`${n} ${mot}${n>1?s:''}`;
/* Corrections interrompues (pose d'Ariane peut-être faite, validation non prouvée), une par cut. */
async function relectureIntentions(){let v=null;try{v=(await chrome.storage.local.get(CLE_RELECTURE_INTENTION))?.[CLE_RELECTURE_INTENTION]??null;}catch{v=null;}
 return (Array.isArray(v)?v:v&&typeof v==='object'?[v]:[]).filter(x=>Number.isInteger(x?.cut));}
async function relectureNoterIntention(x){const l=await relectureIntentions();l.push(x);try{await chrome.storage.local.set({[CLE_RELECTURE_INTENTION]:l.slice(-16)});}catch{/* mémoire seule */}}
/* N'efface QUE l'intention du cut prouvé (revue, W5). */
async function relectureEffacerIntention(cut,lotId=null){const l=(await relectureIntentions()).filter(x=>!(x.cut===cut&&(lotId===null||x.lotId===lotId)));
 try{if(l.length)await chrome.storage.local.set({[CLE_RELECTURE_INTENTION]:l});else await chrome.storage.local.remove?.(CLE_RELECTURE_INTENTION);}catch{/* rien */}}
/* « J'ai contrôlé le cut N » : Mic a contrôlé dans ESV le cut d'une correction interrompue. */
async function relectureAcquitter(args){const cut=args?.cut;if(!Number.isInteger(cut))throw Error('Relecture : cut à acquitter inconnu.');
 const avant=await relectureIntentions(),x=avant.find(y=>y.cut===cut);if(!x)return relectureEtat();
 await relectureEffacerIntention(cut,x.lotId??null);journalerSimple('relecture-acquittee',{lotId:x.lotId??null,identity:{part:x.part??null,cut}});return relectureEtat();}
/* Ce que le panneau affiche : avancement, comptes, message ; corrections interrompues s'il y en a. */
/* Résumé des réglages que la prochaine passe lirait (carte : source, et si « corriger » pourra corriger). */
async function relectureReglagesResume(){try{const r=await relectureReglages(),q=globalThis.BananeRelectureCritere.correctionPermise(r);
 return {source:r.source,statut:r.statut,correctionPermise:q.ok,raison:q.raison,zones:Object.fromEntries(Object.entries(r.zones||{}).map(([z,x])=>[z,x?.corriger===true]))};}catch{return null;}}
async function relectureEtat(){const p=relecture.passe,intentions=await relectureIntentions(),b=engine?.s?.batch;
 return {choix:await relectureChoix(),lot:b?.id?{id:b.id,mode:relectureDuLot(b)||'coupee',etat:b.state}:null,reglages:await relectureReglagesResume(),
  passe:p?{lotId:p.lotId,mode:p.mode,modeEffectif:p.modeEffectif,etat:p.etat,auto:p.auto===true,total:p.total,faits:p.faits,corriges:p.corriges,refusees:p.refusees,
   vus:p.vus,cutsNeufs:p.cutsNeufs,cutsNeufsAnnonces:p.cutsNeufsAnnonces,cut:p.cut,plage:p.plage,message:p.message,debut:p.debut,fin:p.fin,arretDemande:p.arret===true,reglages:p.reglages??null,pauseDemandee:p.pauseDemandee===true,pauseRaison:p.pauseRaison??null,reprise:p.reprise===true,
   expire:p.etat==='en-pause'&&p.point?.savedAt?Date.parse(p.point.savedAt)+REPRISE_DUREE_MS:null}:null,
  correctionInterrompue:intentions.length&&!passeVivante()?intentions[0]:null,correctionsInterrompues:passeVivante()?[]:intentions,
  repriseReglage:await relectureRepriseReglage()};}
function relectureVue(){const p=relecture.passe;return p?{etat:p.etat,mode:p.modeEffectif||p.mode,faits:p.faits,total:p.total,corriges:p.corriges,vus:p.vus,cut:p.cut,message:p.message,...(p.reprise?{pauseDemandee:p.pauseDemandee===true,pauseRaison:p.pauseRaison??null}:{})}:null;}
/* Une nouvelle passe, à l'état « preparation », posée AVANT toute attente (revue, correction 2). */
function relectureNouvelle(b,auto){const debut=new Date().toISOString();
 relecture.passe={gen:++relecture.gen,lotId:b?.id??null,mode:relectureDuLot(b),modeEffectif:null,etat:'preparation',auto,total:0,faits:0,corriges:0,refusees:0,
  vus:0,vusCuts:new Set(),cutsNeufs:0,cutsNeufsAnnonces:null,cut:null,plage:null,message:'Relecture en préparation : elle part dans un instant.',debut,fin:null,arret:false,reglages:null,operationId:null,attente:null,reprise:false,repriseF5:'pause',pauseDemandee:false,pauseRaison:null,point:null,pointStocke:null};
 return relecture.passe;}
/* Fin naturelle d'un lot créé avec la relecture : la passe est planifiée une fois par lot, et existe dès maintenant (« preparation »). */
function relecturePlanifier(){const b=engine?.s?.batch;if(!b?.id||relecture.planifie.has(b.id)||!relectureDuLot(b)||passeActive())return;
 if(!(b.state==='COMPLETED'||b.state==='STOPPED'&&b.stoppedAtEnd))return;
 relecture.planifie.add(b.id);const p=relectureNouvelle(b,true);
 setTimeout(()=>{void relectureLancer({auto:true,passe:p}).catch(()=>{});},Math.max(0,reglageRelecture().departMs||0));}
/* Seuils de la règle prudente : le fichier proposé (chantier claude/50-zones-autonomes) s'il existe et se lit, sinon le défaut provisoire
 * (la passe reste alors en ombre : correction 5). */
async function relectureReglages(){const Q=globalThis.BananeRelectureCritere;
 try{if(typeof fetch==='function'&&chrome?.runtime?.getURL){const r=await fetch(chrome.runtime.getURL('datasets/relecture-reglages-proposes.json'));
  if(r?.ok)return Q.reglages(await r.json(),'propose');}}catch{/* absent ou illisible : défaut */}
 return Q.reglages(Q.DEFAUT,'defaut');}
/* Issues de fin de lot où le dernier cut reste rouge (il est relu comme un différé) ; ailleurs, il est un cut du lot (traversé). */
const SANS_ROUGE=new Set(['partie-sans-rouge','depart-sur-vert']);
/* Entrée de la sélection : cuts du lot et leur rôle, PN et ADV du journal du lot (figés), liste « À contrôler » si elle est active.
 * Revue (correction 1) : tout cut que le lot ou Mic a traité est un cut du lot (traversé, jamais corrigé) : posés et validés, SKIP,
 * repris à la main, toutes les identités interrompues, le dernier cut d'un lot clos (pose appliquée ou non), la pose en attente, les
 * cibles bloquées. Le rôle « vert » des autres n'est qu'une présomption : la garde exige ensuite le statut lu dans ESV. */
async function relectureEntree(b){const partie=b.scope.part,cutDe=x=>x?.cut??x?.identity?.cut,poses=new Set(),differes=new Set(),sources={};
 const noter=(c,ens,src)=>{if(!Number.isInteger(c)||c<0)return;ens.add(c);sources[src]=(sources[src]||0)+1;};
 for(const x of b.processed||[])noter(cutDe(x),poses,'poses');
 for(const x of b.deferred||[])noter(cutDe(x),differes,'differes');
 for(const x of b.skipped||[])noter(cutDe(x),poses,'skip');
 for(const x of b.manuallyCompleted||[])noter(cutDe(x),poses,'manuels');
 for(const x of b.interrupted||[]){const c=cutDe(x);if(x?.status==='DEFER_DERNIER_CUT_SANS_ENVOI')noter(c,differes,'differes');else noter(c,poses,'interrompus');}
 const fin=b.stoppedAtEnd;
 if(Number.isInteger(fin?.cut)){if(fin.applied===false&&!SANS_ROUGE.has(fin.issue))noter(fin.cut,differes,'finDeLotRouge');else noter(fin.cut,poses,'finDeLot');}
 const a=engine.s.applied?.identity;if(a&&a.part===partie)noter(a.cut,poses,'poseEnAttente');
 for(const k of engine.s.blockedTargets||[]){const [,p,c]=String(k).split('|');if(Number(p)===partie)noter(Number(c),poses,'bloques');}
 const lot=[...poses].map(c=>({cut:c,differe:false})).concat([...differes].filter(c=>!poses.has(c)).map(c=>({cut:c,differe:true})));
 const zonesPN=[],zonesADV=[];let events=[];try{events=await store.all('events')||[];}catch{/* journal illisible */}
 for(const e of events){if(e?.type!=='regles-metier-ombre'||e.portee!=='cut'||e.batchId!==b.id||e.identity?.part!==partie)continue;
  const c=e.zone?.pnControle,z=e.zone?.advControle;
  if(Array.isArray(c)&&c.length===2&&c.every(Number.isInteger))zonesPN.push(c);if(Array.isArray(z)&&z.length===2&&z.every(Number.isInteger))zonesADV.push(z);}
 let aControler=[],ecartementPartieMm=null;try{const v=await vertsAControler({partie});if(v?.actif&&Array.isArray(v.verts))aControler=v.verts.map(x=>x.i).filter(Number.isInteger);
  /* Médiane de l'écartement des lignes valides de la liste d'ESV (20 au moins) : la médiane de la partie de l'étude. */
  if(Number.isFinite(v?.reference?.ecartementMm))ecartementPartieMm=v.reference.ecartementMm;}catch{/* liste absente */}
 const t=b.totalReleve,total=t?.part===partie&&Number.isInteger(t.total)?t.total:null;
 const dansLot=new Set(lot.map(x=>x.cut));
 /* H5 (audit P-5), en ombre : les verts de la liste d'ESV à plus de 15 mm de la médiane d'écartement de la partie (20 lignes au moins). */
 let ecartement=[],lignes=[];try{lignes=await relectureLignesListe(partie,b);const verts=lignes.filter(x=>x.statut==='valid'&&x.operateur!==true&&!dansLot.has(x.i)&&Number.isFinite(x.g));
  if(verts.length>=20){const v=verts.map(x=>x.g).sort((x,y)=>x-y),m=v.length>>1,med=v.length%2?v[m]:(v[m-1]+v[m])/2;
   if(!Number.isFinite(ecartementPartieMm))ecartementPartieMm=Math.round(med*10)/10;
   ecartement=verts.filter(x=>Math.abs(x.g-med)>15).map(x=>x.i);}}catch{/* liste illisible : rien en plus */}
 /* Cuts déjà vus (drapeau « SeenByOperator » de la liste d'ESV, table de la page, sinon instantané), pour annoncer les cuts neufs ; et,
  * sans autre référence, la médiane de l'écartement des lignes valides de la table de la page. */
 const page=await relectureTablePage(total);
 const vu=page?.vu||(lignes.length&&lignes.every(x=>typeof x.vu==='boolean')?new Map(lignes.map(x=>[x.i,x.vu])):null);
 if(!Number.isFinite(ecartementPartieMm)&&Number.isFinite(page?.ecartementMm))ecartementPartieMm=page.ecartementMm;
 /* Zones figées AVANT la passe, tirées des seules captures du lot (événements `regles-metier-ombre` de ce lot) : les captures de la
  * passe ne créent ni n'étendent jamais une zone (audit P-5 : une fausse zone PN apparaît dès qu'on capture des verts). */
 return {partie,total,lot,sources,zonesPN,zonesADV,aControler,ecartement,ecartementPartieMm,zonesSource:'lot',vu};}
/* Lignes de la liste d'ESV de la partie (instantané E1 qui concorde avec le lot, sinon fenêtres lues par B1), écartement et « vu ». */
async function relectureLignesListe(partie,b){const V=globalThis.BananeVertsAControler,LM=globalThis.BananeListeMemoire;if(!V)return [];
 const lot=new Set([...(b.processed||[]),...(b.deferred||[])].map(x=>x?.cut??x?.identity?.cut).filter(Number.isInteger));
 const g=x=>{const d=x.bords;return Number.isFinite(x.g)?x.g:d?.left&&d?.right?Math.hypot(d.left[0]-d.right[0],d.left[1]-d.right[1],d.left[2]-d.right[2])*1000:null;};
 try{if(LM&&globalThis.BananeSettings?.listeMemoire?.actif!==false){const inst=(await LM.instantanes(chrome.storage.local,[partie]))?.[0]?.snap,dec=inst?LM.decompacter(inst):null;
  if(dec){const L=V.lignesDeInstantane(dec),parI=new Map(L.map(x=>[x.i,x])),cuts=[...lot];
   const rouges=cuts.filter(c=>{const x=parI.get(c);return x&&(x.statut!=='valid'||x.operateur);}).length;
   if(cuts.length&&rouges>=0.8*cuts.length)return L.map(x=>({...x,g:g(x),vu:Array.isArray(dec.fl)||ArrayBuffer.isView(dec.fl)?(dec.fl[x.i]&2)===2:undefined}));}}}catch{/* stockage illisible */}
 const mem=reglesOmbre.mem;
 if(mem?.lignes?.size&&b?.id===mem.lotId&&b?.scope?.part===partie)return [...mem.lignes].map(([i,x])=>({i,statut:x.statut,operateur:false,g:x.g}));
 return [];}
/* La liste d'ESV tenue par la page (`liste-instantane`, la table de l'observateur : aucune requête, aucune commande), une seule table
 * complète (de `total` lignes si on le connaît), sinon null : « vu » de chaque ligne, et médiane de l'écartement des lignes valides
 * à bords (20 au moins ; bords au dixième de mm, en 1e-4 m), comme la référence de la liste « À contrôler ». */
async function relectureTablePage(total){if(selectedTab===null)return null;let timer;
 try{const rep=await Promise.race([chrome.tabs.sendMessage(selectedTab,{kind:'liste-instantane'}),new Promise(r=>{timer=setTimeout(()=>r(null),LISTE_PAGE_MS);})]);
  if(rep?.ok!==true||!Array.isArray(rep.tables))return null;
  const l=rep.tables.filter(t=>t&&Array.isArray(t.fl)&&t.debut===true&&t.rompue!==true&&t.tronquee!==true&&(!Number.isInteger(total)||t.fl.length===total));
  if(l.length!==1)return null;const t=l[0],g=[];
  if(Array.isArray(t.st)&&Array.isArray(t.ed))for(let i=0;i<t.st.length;i++){if(t.st[i]!==0)continue;const e=t.ed.slice(6*i,6*i+6);
   if(e.length===6&&e.every(Number.isFinite))g.push(Math.hypot(e[0]-e[3],e[1]-e[4],e[2]-e[5])/10);}
  g.sort((a,b)=>a-b);const m=g.length>>1;
  return {vu:new Map(t.fl.map((f,i)=>[i,Number.isInteger(f)&&(f&2)===2])),ecartementMm:g.length>=20?Math.round((g.length%2?g[m]:(g[m-1]+g[m])/2)*10)/10:null};}
 catch{return null;}finally{clearTimeout(timer);}}
/* Statut d'UN cut dans la liste d'ESV (mémoire de la page, lecture B1 `b1-voisins` : aucune requête, aucune commande), comme
 * `statutListeDuCut` de la base, avec ses drapeaux : {statut, operateur (TreatedByOperator), vu (SeenByOperator)} ; null si illisible,
 * ambigu ou d'un autre cut. */
async function relectureLigneListe(cut,etat){const B=globalThis.BananeAppuisListe;if(!B?.lireReponse||!B.DEFAULTS||selectedTab===null)return null;
 const R=b1.repere,T=R?.T&&R.frameId===(etat?.identity?.frameId??null)?R.T:[0,0,0];
 const world=Object.fromEntries(['left','right'].map(x=>{const p=etat?.rails?.[x]?.positionSceneRelative;return [x,Array.isArray(p)?p.map((v,i)=>v+T[i]):null];}));
 if(!['left','right'].every(x=>Array.isArray(world[x])&&world[x].length===3&&world[x].every(Number.isFinite)))return null;
 const rep=B.lireReponse(await b1Voisins(cut,world),{cut,fenetre:B.DEFAULTS.fenetre});
 if(!rep?.ok||!(rep.table?.tables===1||rep.geo?.index===cut))return null;
 if(rep.table.debut!==true||rep.table.rompue===true||rep.table.tronquee===true)return null;
 const l=rep.rows.find(x=>x.i===cut);return l?{statut:l.statut,operateur:l.operateur===true,vu:l.vu===true}:null;}
/* Pourquoi la passe ne peut pas partir maintenant (ESV doit être propre), ou null. */
async function relectureRefus(b,auto){
 if(!b?.id)return 'aucun lot';
 if(!relectureDuLot(b))return 'ce lot a été créé avec la relecture coupée';
 return lotCloRefus(b,auto,'Lancer la relecture');}
/* Pourquoi ESV n'est pas prêt pour une passe après le lot (relecture, deuxième passe en écriture), ou null. `repartir` : le bouton à cliquer ensuite (null : aucun). */
async function lotCloRefus(b,auto,repartir){
 if(b.scope?.geometryEngine!==GCV1_ENGINE)return 'lot hors Orbite GCV1';
 const naturel=b.state==='COMPLETED'||b.state==='STOPPED'&&!!b.stoppedAtEnd;
 if(auto?!naturel:!['COMPLETED','STOPPED'].includes(b.state))return b.state==='FINISHED_WITH_UNCONFIRMED_ACTIONS'?'le lot a fini avec des actions non confirmées : contrôle ESV d’abord'
  :auto?'le lot ne s’est pas fini de lui-même':'le lot n’est pas clos';
 /* R3 : partie sans rouge, ou départ sur un cut vert sans rien devant : rien n'a été traité, rien à relire autour. */
 if(SANS_ROUGE.has(b.stoppedAtEnd?.issue))return b.stoppedAtEnd.issue==='partie-sans-rouge'?'partie sans cut rouge : rien à relire':'lot clos au départ sur un cut vert : rien à relire';
 const interrompues=await relectureIntentions();
 if(interrompues.length)return `une correction ${interrompues[0].origine==='passe'?'de la deuxième passe':'de la relecture'} a été interrompue au cut ${interrompues[0].cut} : contrôle ce cut dans ESV, puis « J’ai contrôlé le cut ${interrompues[0].cut} »`;
 if(engine.s.intent||engine.s.reconcileRequired||engine.deferPending?.())return 'un résultat incertain reste à clôturer';
 if(engine.task||engine.busy)return 'une action d’Ariane est en cours';
 if(manual?.active?.()||native?.active?.())return 'Écho est actif';
 if(retourCutEnCours||repriseEnCours)return 'un retour à un cut ou une reprise est en cours';
 if(selectedTab===null)return 'aucun onglet ESV';
 let lu=null;try{lu=(await call('ping'))?.label||null;}catch(e){return `ESV ne répond pas (${String(e?.message||e).slice(0,120)})`;}
 if(!partCut(lu))return '« Cut N of part P » illisible dans ESV';
 if(lu.part!==b.scope.part)return `ESV affiche la partie ${lu.part}, pas celle du lot (${b.scope.part}) : reviens dans la partie ${b.scope.part}${repartir?`, puis « ${repartir} »`:''}`;
 /* Pose d'Ariane appliquée et non validée (dernier cut d'un lot borné) : tant qu'ESV l'affiche, la passe ne part pas (elle quitterait
  * ce cut). Mic la valide (ESV passe alors à un autre cut) ou la quitte lui-même ; ensuite « Lancer la relecture ». */
 const a=engine.s.applied?.identity;
 if(a&&a.part===lu.part&&a.cut===lu.cut)return `une pose d’Ariane attend ta validation au cut ${a.cut} : valide-la (ou corrige-la) dans ESV${repartir?`, puis « ${repartir} »`:''}`;
 return null;}
async function relectureLancer({auto=false,passe=null}={}){
 let p;
 if(auto){p=passe;if(!p||relecture.passe!==p||p.etat!=='preparation')return relectureEtat();}
 else{if(passeActive())throw Error(`Relecture déjà ${relecture.passe.etat==='preparation'?'en préparation':'en cours'} : une seule passe à la fois.`);
  p=relectureNouvelle(engine.s.batch,false);}
 {const rg=await relectureRepriseReglage();p.reprise=rg.actif;p.repriseF5=rg.f5;}   /* Test 17 : pause et reprise, éteintes par défaut */
 /* Jeton de génération : une passe remplacée, ou arrêtée pendant sa préparation, ne part jamais. */
 const vivante=()=>relecture.passe===p&&p.gen===relecture.gen&&p.etat==='preparation';
 const nonLancee=(raison,issue='non-lancee')=>{if(relecture.passe===p){p.etat=issue==='arret'?'arretee':'non-lancee';p.message=`Relecture non lancée : ${raison}.`;p.fin=new Date().toISOString();}
  if(p.lotId&&p.mode)relectureJournal('relecture-fin',{mode:p.mode,issue,raison,auto},p);
  if(!auto&&issue!=='arret')throw Error(`Relecture non lancée : ${raison}.`);return relectureEtat();};
 const suite=()=>!vivante()?'remplacee':p.arret?'arret':null;
 try{
  for(let i=0;i<200&&engine.task;i++)await engine.task.catch(()=>{});
  if(passeDiffReglage().mode==='ecriture'&&passeDiff.cours)await passeDiff.cours;
  let s=suite();if(s==='remplacee')return relectureEtat();if(s)return nonLancee('arrêtée à ta demande avant le départ','arret');
  let refus=await relectureRefus(engine.s.batch,auto);if(refus)return nonLancee(refus);
  if(engine.s.batch?.id!==p.lotId)return nonLancee('le lot a changé');
  const R=globalThis.BananeRelectureOmbre,Q=globalThis.BananeRelectureCritere,cfg=reglageRelecture(),reglages=await relectureReglages();
  const choixCourant=engine.s.batch?.scope?.fileParties?p.mode:await relectureChoix();   /* CH-017 (D-261) : relecture toujours dans la file */
  s=suite();if(s==='remplacee')return relectureEtat();if(s)return nonLancee('arrêtée à ta demande avant le départ','arret');
  /* W10 : le plus prudent du mode figé dans le lot et du choix courant du panneau. */
  const prudent=RANG_MODE[choixCourant]<RANG_MODE[p.mode]?choixCourant:p.mode;
  if(prudent==='coupee')return nonLancee('relecture coupée dans le panneau depuis le démarrage du lot');
  const permis=Q.correctionPermise(reglages),observe=globalThis.BananeSettings?.observateurPassif?.actif!==false;
  let modeEffectif=prudent,motif=prudent!==p.mode?`le choix du panneau (« ${prudent} ») est plus prudent que celui du lot`:null;
  if(modeEffectif==='corriger'&&cfg.validation!=='maj-espace'){modeEffectif='ombre';motif='geste de validation non vérifié : « corriger » reste verrouillé';}
  else if(modeEffectif==='corriger'&&!observe){modeEffectif='ombre';motif='l’observateur passif est coupé, aucune écriture ne pourrait être prouvée';}
  else if(modeEffectif==='corriger'&&!permis.ok){modeEffectif='ombre';motif=`réglages non sûrs (${permis.raison})`;}
  const entree=await relectureEntree(engine.s.batch);
  const sel=R.selection(entree,{...R.optionsSelection(reglages.selection),...(Number.isInteger(cfg.plafondCuts)?{plafondCuts:cfg.plafondCuts}:{}),
   ...(cfg.plafondParZone&&typeof cfg.plafondParZone==='object'?{plafondParZone:cfg.plafondParZone}:{})});
  s=suite();if(s==='remplacee')return relectureEtat();if(s)return nonLancee('arrêtée à ta demande avant le départ','arret');
  /* Revue (correction 2) : ESV et le lot sont recontrôlés APRÈS les attentes, juste avant le départ. */
  refus=await relectureRefus(engine.s.batch,auto);if(refus)return nonLancee(refus);
  if(engine.s.batch?.id!==p.lotId)return nonLancee('le lot a changé pendant la préparation');
  s=suite();if(s==='remplacee')return relectureEtat();if(s)return nonLancee('arrêtée à ta demande avant le départ','arret');
  /* Test 18 : la deuxième passe des différés et la relecture n'écrivent jamais ensemble dans ESV (contrôle juste avant le départ ; une passe en ombre ne touche pas ESV). */
  if(passeDiff.ecriture||passeDiffReglage().mode==='ecriture'&&passeDiff.cours)return nonLancee('la deuxième passe des différés travaille dans ESV');
  const b=engine.s.batch,affiches=[...new Set([...sel.cuts.map(c=>c.cut),...sel.plages.flatMap(x=>x.traverses||[])])];
  const neufs=entree.vu&&affiches.every(c=>entree.vu.has(c))?affiches.filter(c=>entree.vu.get(c)===false).length:null;
  Object.assign(p,{etat:'en-cours',modeEffectif,total:sel.total,cutsNeufsAnnonces:neufs,
   reglages:{source:reglages.source,statut:reglages.statut,refus:reglages.refus??null,invalides:reglages.invalides??[],correctionPermise:permis.ok,raison:permis.raison,
    zones:Object.fromEntries(Object.entries(reglages.zones||{}).map(([z,x])=>[z,x?.corriger===true]))},
   noteMode:motif?`Mode « ${modeEffectif} »${modeEffectif!==p.mode?` (au lieu de « ${p.mode} »)`:''} : ${motif}.`:null});
  p.message=p.noteMode;
  if(p.reprise)await relectureRepriseEffacer();   /* une passe neuve remplace toute reprise gardée */
  try{await chrome.storage.local.set({[CLE_RELECTURE_PASSE]:{lotId:p.lotId,gen:p.gen,debut:p.debut,mode:p.mode,modeEffectif}});}catch{/* mémoire seule */}
  relectureJournal('relecture-debut',{mode:p.mode,modeEffectif,choixCourant,motif,auto,total:sel.total,traverses:sel.traverses,parZone:sel.parZone,variante:reglages.variante,
   ecartementPartieMm:entree.ecartementPartieMm??null,cutsNeufsAnnonces:neufs,sourcesLot:entree.sources,chaine:'vide',validation:cfg.validation,
   zonesSource:entree.zonesSource,zones:{pn:entree.zonesPN.slice(0,64),adv:entree.zonesADV.slice(0,64)},tempsEstimeS:sel.tempsEstimeS,plafondCuts:sel.plafondCuts,plafondParZone:sel.plafondParZone,
   plages:sel.plages.map(x=>({debut:x.debut,fin:x.fin,zone:x.zone,libelle:x.libelle,relus:x.relus})),horsPlafond:sel.horsPlafond.map(x=>({debut:x.debut,fin:x.fin,libelle:x.libelle})),
   reglages:p.reglages},p);
  relecture.tache=relecturePasse(p,b,sel,reglages,entree).catch(e=>{if(relecture.passe===p&&p.etat==='en-cours'){p.etat='erreur';p.message=`Relecture arrêtée : ${String(e?.message||e).slice(0,300)}`;p.fin=new Date().toISOString();
   relectureJournal('relecture-fin',{mode:p.mode,modeEffectif:p.modeEffectif,issue:'erreur',raison:p.message,faits:p.faits,corriges:p.corriges,vus:p.vus},p);}
   void relectureOublierPasse(p);void relectureRepriseEffacer();});
  return relectureEtat();}
 catch(e){if(relecture.passe===p&&p.etat==='preparation')return nonLancee(`erreur pendant la préparation (${String(e?.message||e).slice(0,200)})`);throw e;}}
async function relectureOublierPasse(p){try{const r=(await chrome.storage.local.get(CLE_RELECTURE_PASSE))?.[CLE_RELECTURE_PASSE];
 if(r&&r.gen===p.gen&&r.lotId===p.lotId)await chrome.storage.local.remove?.(CLE_RELECTURE_PASSE);}catch{/* rien */}}
/* ---- Test 17 (D-232 à D-234) : PAUSE ET REPRISE DE LA RELECTURE, même après un F5 ou un redémarrage du service worker.
 * Éteinte par défaut (réglage `banane51RelecturePauseReglage`, panneau : Réglages). Allumée : la passe garde, après chaque cut relu, un POINT DE REPRISE
 * (`banane51RelectureReprise`) : la sélection déjà calculée, le prochain cut, les compteurs, la chaîne d'appuis, les écartements des verts, les plages sautées.
 *  - « Pause » : s'arrête au prochain point sûr (jamais entre la pose et la validation d'une correction), garde le point, passe « en-pause ».
 *  - F5 ou ESV muet pendant la passe : pause automatique (réglage « Si ESV est rechargé » = pause, par défaut) ou arrêt comme avant (= arret).
 *    Une correction interrompue reste une erreur : elle bloque tout jusqu'à « J'ai contrôlé le cut N ».
 *  - Redémarrage du service worker : la passe revient EN PAUSE (jamais relancée seule).
 *  - « Reprendre » : mêmes contrôles qu'au départ (relectureRefus), puis repart au cut gardé, sans repasser sur les cuts relus ; le cut en cours à la pause est refait.
 *  - « Arrêter » est définitif : il efface le point. Une reprise garde au plus 24 h ; un lot différent l'efface. */
async function relectureRepriseReglage(){let r={};try{r=(await chrome.storage.local.get(CLE_RELECTURE_REGLAGE_PAUSE))?.[CLE_RELECTURE_REGLAGE_PAUSE]||{};}catch{r={};}
 return {actif:r.actif===true,f5:r.f5==='arret'?'arret':'pause'};}
async function relectureRepriseReglageChoisir(args){if(passeActive())throw Error('Relecture en cours ou en pause : change ce réglage après sa fin.');
 await chrome.storage.local.set({[CLE_RELECTURE_REGLAGE_PAUSE]:{actif:args?.actif===true,f5:args?.f5==='arret'?'arret':'pause'}});return relectureRepriseReglage();}
async function relectureRepriseLire(){try{const v=(await chrome.storage.local.get(CLE_RELECTURE_REPRISE))?.[CLE_RELECTURE_REPRISE];
 return v&&v.v===1&&Array.isArray(v.sel?.cuts)&&Number.isInteger(v.index)?v:null;}catch{return null;}}
async function relectureRepriseEffacer(){try{await chrome.storage.local.remove?.(CLE_RELECTURE_REPRISE);}catch{/* rien */}}
const repriseExpiree=pt=>!pt||!(Date.now()-Date.parse(pt.savedAt||0)<REPRISE_DUREE_MS);
function relectureDepuisPoint(pt,raison,f5='pause'){const sc=pt.sel.cuts[pt.index];
 relecture.passe={gen:++relecture.gen,lotId:pt.lotId,mode:pt.mode,modeEffectif:pt.modeEffectif,etat:'en-pause',auto:false,total:pt.total,faits:pt.faits,corriges:pt.corriges,refusees:pt.refusees,
  vus:pt.vus,vusCuts:new Set(pt.vusCuts||[]),cutsNeufs:pt.cutsNeufs||0,cutsNeufsAnnonces:pt.cutsNeufsAnnonces??null,cut:sc?.cut??null,plage:pt.sel.plages?.[sc?.plage]?.libelle??null,
  message:`Relecture gardée en pause au cut ${sc?.cut??'?'} : ${pluriel(pt.faits,'cut')} relu${pt.faits>1?'s':''} sur ${pt.total}. Tu peux la reprendre.`,debut:pt.debut,fin:null,arret:false,
  reglages:pt.reglages??null,operationId:null,attente:null,noteMode:pt.noteMode??null,reprise:true,repriseF5:f5,pauseDemandee:false,pauseRaison:raison,point:pt,pointStocke:true};
 return relecture.passe;}
/* Au redémarrage du service worker : une passe en cours a été perdue. Avec un point de reprise valable (réglage allumé, même lot, moins de 24 h), elle revient EN PAUSE ;
 * sinon elle est close dans le journal (« interrompue »). */
async function relectureApresRedemarrage(){try{const st=await chrome.storage.local.get([CLE_RELECTURE_PASSE,CLE_RELECTURE_REPRISE]),r=st?.[CLE_RELECTURE_PASSE];if(relecture.passe)return;
 const pt=st?.[CLE_RELECTURE_REPRISE]||null;
 if(pt){const reg=await relectureRepriseReglage(),b=engine?.s?.batch,bon=pt.v===1&&Array.isArray(pt.sel?.cuts)&&Number.isInteger(pt.index)&&reg.actif&&b?.id===pt.lotId&&!repriseExpiree(pt);
  if(bon){await chrome.storage.local.remove?.(CLE_RELECTURE_PASSE);relecture.planifie.add(pt.lotId);const p=relectureDepuisPoint(pt,'redemarrage',reg.f5);
   relectureJournal('relecture-pause',{mode:p.mode,modeEffectif:p.modeEffectif,raison:'redemarrage',cut:p.cut,index:pt.index,faits:p.faits,total:p.total,corriges:p.corriges,stocke:true},p);return;}
  await relectureRepriseEffacer();
  if(!r)journalerSimple('relecture-fin',{lotId:pt.lotId??null,mode:pt.mode??null,modeEffectif:pt.modeEffectif??null,issue:'interrompue',raison:'point de reprise jeté au réveil',debut:pt.debut??null});}
 if(!r)return;
 await chrome.storage.local.remove?.(CLE_RELECTURE_PASSE);
 journalerSimple('relecture-fin',{lotId:r.lotId??null,mode:r.mode??null,modeEffectif:r.modeEffectif??null,issue:'interrompue',raison:'service worker redémarré pendant la passe',debut:r.debut??null});}catch{/* rien */}}
void ready.then(relectureApresRedemarrage).catch(()=>{});
function relectureArreter(){const p=relecture.passe;if(!p||!passeActive())return {arretDemande:false};
 if(p.etat==='en-pause'){p.etat='arretee';p.fin=new Date().toISOString();p.pauseDemandee=false;p.message=`Relecture arrêtée à ta demande (elle était en pause) : ${pluriel(p.faits,'cut')} relu${p.faits>1?'s':''} sur ${p.total}.`;
  relectureJournal('relecture-fin',{mode:p.mode,modeEffectif:p.modeEffectif,issue:'arret',raison:'arrêtée pendant la pause',faits:p.faits,total:p.total,corriges:p.corriges,refusees:p.refusees,vus:p.vus,
   cutsNeufs:p.cutsNeufs,cutsNeufsAnnonces:p.cutsNeufsAnnonces,dureeMs:Date.parse(p.fin)-Date.parse(p.debut)},p);
  void relectureRepriseEffacer();void relectureOublierPasse(p);return {arretDemande:true,etat:p.etat};}
 p.arret=true;
 /* T-6 : raison neutre, celle d'une annulation de retour à un cut (aucune marque de la relecture dans la page). */
 if(p.operationId)void adapter.cancel({operationId:p.operationId,reason:'goto-cut-cancel'}).catch(()=>{});return {arretDemande:true,etat:p.etat};}
/* Pause demandée : la passe finit l'étape en cours (jamais entre la pose et la validation d'une correction), puis s'arrête en gardant son point. */
function relectureMettreEnPause(){const p=relecture.passe;
 if(!p||p.etat!=='en-cours')throw Error(p?.etat==='preparation'?'La relecture part dans un instant : mets-la en pause une fois partie.':'Aucune relecture en cours à mettre en pause.');
 if(!p.reprise)throw Error('Pause de la relecture éteinte dans les réglages : elle ne peut que s’arrêter.');
 p.pauseDemandee=true;
 if(p.operationId)void adapter.cancel({operationId:p.operationId,reason:'goto-cut-cancel'}).catch(()=>{});
 return {pauseDemandee:true,etat:p.etat};}
/* Reprise : mêmes contrôles qu'au départ, puis la passe repart au cut gardé. */
async function relectureReprendre(){const p=relecture.passe;
 if(!p||p.etat!=='en-pause')throw Error('Aucune relecture en pause.');
 const b=engine.s.batch,pt=p.point&&!repriseExpiree(p.point)?p.point:await relectureRepriseLire();
 if(!pt||pt.lotId!==p.lotId||b?.id!==p.lotId||repriseExpiree(pt)){p.etat='arretee';p.fin=new Date().toISOString();p.message='Relecture en pause abandonnée : le lot a changé ou la reprise a plus d’un jour.';
  await relectureRepriseEffacer();await relectureOublierPasse(p);relectureJournal('relecture-fin',{mode:p.mode,modeEffectif:p.modeEffectif,issue:'interrompue',raison:'reprise expirée ou lot changé',faits:p.faits,total:p.total},p);
  throw Error(p.message);}
 const refus=await relectureRefus(b,false);if(refus)throw Error(`Relecture non reprise : ${refus}.`);
 const Q=globalThis.BananeRelectureCritere,cfg=reglageRelecture(),reglages=await relectureReglages(),choixCourant=await relectureChoix();
 /* Jamais plus permissif qu'à la pause : le plus prudent du mode gardé et du choix courant, puis les mêmes verrous qu'au départ. */
 let modeEffectif=RANG_MODE[choixCourant]<RANG_MODE[pt.modeEffectif]?choixCourant:pt.modeEffectif;
 if(modeEffectif==='coupee')throw Error('Relecture non reprise : relecture coupée dans le panneau depuis la pause.');
 if(modeEffectif==='corriger'&&(cfg.validation!=='maj-espace'||globalThis.BananeSettings?.observateurPassif?.actif===false||!Q.correctionPermise(reglages).ok))modeEffectif='ombre';
 const entree=await relectureEntree(b);
 const entreeReprise={...entree,ecartementPartieMm:Number.isFinite(pt.ecartementPartieMm)?pt.ecartementPartieMm:entree.ecartementPartieMm};
 if(relecture.passe!==p||p.etat!=='en-pause')throw Error('Relecture non reprise : la passe a changé pendant les contrôles.');
 p.gen=++relecture.gen;p.etat='en-cours';p.pauseDemandee=false;p.arret=false;p.fin=null;p.modeEffectif=modeEffectif;p.message=`Relecture reprise au cut ${pt.sel.cuts[pt.index]?.cut??'?'}.`;
 relectureJournal('relecture-reprise',{mode:p.mode,modeEffectif,raisonPause:p.pauseRaison,index:pt.index,cut:pt.sel.cuts[pt.index]?.cut??null,faits:p.faits,total:p.total},p);
 try{await chrome.storage.local.set({[CLE_RELECTURE_PASSE]:{lotId:p.lotId,gen:p.gen,debut:p.debut,mode:p.mode,modeEffectif}});}catch{/* mémoire seule */}
 void syncLauncher().catch(()=>{});   /* la page ESV (rechargée pendant la pause) relit tout de suite qu'une séance d'observation est ouverte */
 relecture.tache=relecturePasse(p,b,pt.sel,reglages,entreeReprise,pt).catch(e=>{if(relecture.passe===p&&p.etat==='en-cours'){p.etat='erreur';p.message=`Relecture arrêtée : ${String(e?.message||e).slice(0,300)}`;p.fin=new Date().toISOString();
   relectureJournal('relecture-fin',{mode:p.mode,modeEffectif:p.modeEffectif,issue:'erreur',raison:p.message,faits:p.faits,corriges:p.corriges,vus:p.vus},p);}
   void relectureOublierPasse(p);void relectureRepriseEffacer();});
 return relectureEtat();}
const attendreMs=ms=>new Promise(r=>setTimeout(r,Math.max(0,ms)));
/* Origine de la zone d'un cut relu : PN, ADV et abords viennent du lot (captures et cuts du lot, figés avant la passe) ; la liste
 * « À contrôler » et les verts hors plage (écartement) viennent de la liste d'ESV. */
const sourceZone=c=>['pn','adv','abords'].includes(c.zone)?'lot':c.zone==='ecartement'?'liste-esv':'liste';
/* Un cut que les réglages pourraient corriger (vert d'une zone ouverte ; la zone « écartement » est fermée tant que les réglages ne l'ouvrent pas, D-185) : en « corriger », il n'est posé qu'atteint par les boutons. */
const relectureCorrigeable=(c,reglages)=>c.role==='vert'&&reglages?.zones?.[c.zone]?.corriger===true;
/* Ce qu'Ariane donnerait sur une capture (aucun effet), selon la variante du fichier de réglages (« chaine+h » : décision du lot avec
 * pour appuis la chaîne de la passe, plus la hauteur apprise ; « seul » : sans appui) : moteur, décision, jugement ; la commande qui
 * serait écrite (commande du lot sur la pose ESV de la capture, plus la hauteur pour « +h ») et son écart ; la règle prudente.
 * `ctx` : {chaine (appuis, mis à jour ici), ecartementRef () → médiane de la partie, ou null}. */
function relectureCalculer(capture,c,ctx,reglages,skip){
 const R=globalThis.BananeRelectureOmbre,Q=globalThis.BananeRelectureCritere,L=globalThis.BananeLotDecision,K=globalThis.BananeCore3,Shadow=globalThis.BananeGCV1Shadow;
 const variante=reglages.variante||'chaine+h',enChaine=variante.startsWith('chaine'),avecH=variante.endsWith('+h');
 /* Comme le lot : aucune option passée à la décision ; la correction de hauteur est consignée par la décision selon son réglage. */
 const identity=K.completeIdentity(capture.identity||{}),science=Shadow.scientificProposeBoth(capture);
 const decision=L.decideCut({capture:{identity,rails:capture.rails,pointsSceneRelative:capture.pointsSceneRelative,visibleByClipBoxes:capture.visibleByClipBoxes},
  science:{rails:science.rails,summary:science.summary},anchors:enChaine?ctx.chaine:[],Shadow});
 /* Chaîne de l'étude : la pose donnée à ce cut devient un appui des cuts suivants (positions de la décision, étapes qui posent sur la
  * voie, pas un appui refusé par la décision), qu'elle soit écrite ou non. Revue (correction 8) : la chaîne part vide, et seules les
  * poses données aux VERTS y entrent ; jamais celle d'un cut différé par le lot (un first-pass sur la voie d'un lot fautif s'y
  * propagerait). */
 const enChaineAjout=enChaine&&c.role==='vert'&&decision?.positions&&decision.anchor!==false&&['first-pass','window','crossing'].includes(decision.stage);
 if(enChaineAjout)L.rememberAnchor(ctx.chaine,{identity:{part:identity.part,cut:identity.cut,frameId:identity.frameId??null},positions:decision.positions,stage:decision.stage},1e6);
 const jugement=R.juger({capture,decision,science,hauteur:avecH});
 let commande=null,ecrit=null,ecritBrut=null,ecartementMm=null,ecartementBrutMm=null;const ecartementRefMm=ctx.ecartementRef();
 /* La commande du lot pour les positions de la décision. Au premier passage (pose du moteur confirmée par la voie des appuis), le lot
  * pose la paire du moteur, dont les positions sont celles de la décision : la même conversion que la reprise depuis la voie
  * (décalages du repère profil de la pose d'ESV, relus à 0,01 mm, écartement dans le contrat, cible dans la vue) en donne les rails.
  * « +h » : la correction de hauteur de chaque rail est ajoutée au décalage vertical, et la cible est relue dans la vue. */
 try{const pourCommande=decision?.stage==='first-pass'&&decision.positions?{...decision,stage:'window'}:decision,cameras=L.viewCameras(capture);
  commande=L.commandRails({decision:pourCommande,runtimeRails:{left:{},right:{}},before:capture.rails,expectedPoses:K.expectedPoses,cameras});
  const mm=jugement.hauteurMm;
  if(commande?.action==='lot'&&avecH&&mm&&['left','right'].some(s=>mm[s])){
   const rails=Object.fromEntries(['left','right'].map(s=>{const r=commande.rails[s];return [s,mm[s]?{...r,delta:[r.delta[0],r.delta[1],r.delta[2]+mm[s]/1000]}:r];}));
   const exp=K.expectedPoses({rails:capture.rails},rails);
   commande=['left','right'].every(s=>cameras?.[s]&&L.inView(cameras[s],exp[s].positionSceneRelative).inView)?{...commande,rails}:{action:'engine',reason:'hauteur-hors-vue'};}
  if(commande?.action==='lot'){const exp=K.expectedPoses({rails:capture.rails},commande.rails);
   ecrit=Object.fromEntries(['left','right'].map(s=>[s,R.ecartRail(capture.rails[s],exp[s].positionSceneRelative)]));
   ecritBrut=Object.fromEntries(['left','right'].map(s=>[s,R.ecartRail(capture.rails[s],exp[s].positionSceneRelative,{brut:true})]));
   /* Écartement de la pose, comme l'étude : celui des positions de la décision (brut pour la règle, arrondi pour le journal). */
   ecartementBrutMm=L.gaugeOf(decision.positions);ecartementMm=Math.round(ecartementBrutMm*10)/10;}}catch{commande=null;}
 const critere=commande?.action==='lot'?Q.juger({jugement,zone:c.zone,role:c.role,skipOmbre:skip,ecrit,ecritBrut,ecartementMm,ecartementBrutMm,ecartementRefMm},reglages)
  :{corriger:false,regle:'commande',raison:`la commande du lot ne pose pas ce cut (${commande?.reason??'aucune'})`};
 return {jugement,commande,ecrit,ecritBrut,ecartementMm,ecartementBrutMm,ecartementRefMm,critere,variante,enChaine:!!enChaineAjout};}
/* Attente de l'écriture de validation du cut, vue par l'observateur passif (rangerObservations → relectureEcriture) ; et compte des
 * « vu » qu'ESV écrit lui-même pendant la passe (PUT {SeenByOperator:true}, sans statut : un cut affiché pour la première fois). */
function relectureEcriture(f){const p=relecture.passe;if(!p||p.etat!=='en-cours'||f?.kind!=='write')return;
 const ok=Number.isInteger(f.status)&&f.status>=200&&f.status<300,corps=f.body&&typeof f.body==='object'?f.body:null;
 if(ok&&corps&&!('ExtractionStatus' in corps)&&corps.SeenByOperator===true&&Number.isInteger(f.rowIndex)){if(!p.vusCuts.has(f.rowIndex)){p.vusCuts.add(f.rowIndex);p.vus=p.vusCuts.size;}return;}
 if(p.attente===relecture.attente)ecritureAttendue(relecture.attente,f,ok,corps);}
/* Écriture de validation de la ligne attendue (`a` : cut, depuisMs), vue par l'observateur passif : `ok` si ESV l'a enregistrée, `refus` (statut) sinon. */
function ecritureAttendue(a,f,ok,corps){if(!a||f.rowIndex!==a.cut)return;
 const t=Number.isFinite(f.startedEpochMs)?f.startedEpochMs:Date.now();if(t<a.depuisMs-500)return;
 if(corps&&corps.ExtractionStatus!=='valid')return;
 if(ok)a.ok=true;else if(f.status!=null)a.refus=f.status;}
/* Garde d'une correction (revue, corrections 1, 3, 4) : tout doit tenir, sinon le cut reste en ombre, avec la raison. */
function relectureGarde({c,etat,ligne,par,total}){
 if(c.role!=='vert')return {ok:false,raison:`rôle « ${c.role} » : jamais corrigé`};
 if(!ligne)return {ok:false,raison:'statut du cut illisible dans la liste d’ESV : pas de correction sans preuve du vert'};
 if(ligne.statut!=='valid'||ligne.operateur)return {ok:false,raison:`statut lu dans ESV : ${ligne.statut}${ligne.operateur?', traité par un opérateur':''} ; ce n’est pas un vert d’ESV`};
 try{engine.writable(etat.identity);}catch{return {ok:false,raison:'cible bloquée par un résultat incertain archivé'};}
 if(par!=='pas')return {ok:false,raison:`cut atteint par ${par==='evenement'?'la carte (saut)':par||'un chemin inconnu'} : pas de pose juste après un saut`};
 if(!Number.isInteger(total))return {ok:false,raison:'nombre de cuts de la partie inconnu : Maj+Espace pourrait quitter la partie'};
 if(c.cut>=total-1)return {ok:false,raison:'dernier cut de la partie : Maj+Espace chargerait la partie suivante'};
 return {ok:true,raison:null};}
/* Remet la pose d'avant (`restore`) d'un cut dont la pose ou la validation est refusée, intention effacée ; rend la raison. Lève si la remise est impossible. */
async function remettrePose(b,now,raison){const K=globalThis.BananeCore3,cut=now.identity.cut;let ok=false;
 try{const r=await call('restore',now);ok=K.equalPoses(now.rails,r?.rails,.001);}catch{ok=false;}
 if(!ok)throw Error(`cut ${cut} : pose d’Ariane non conforme (${raison}) et remise impossible ; rien n’est validé. Contrôle ce cut dans ESV (une pose non validée n’est pas enregistrée).`);
 await relectureEffacerIntention(cut,b.id);return `${raison} ; pose remise`;}
/* Pose des rails d'un cut (intention notée) par la commande `apply` du lot, relue à 1 mm, puis rails relus comme le moteur avant de valider. T-5 : la pose
 * de la passe ne clique jamais en direct (« tout-recentre », D-157), quel que soit le réglage du lot. Une anomalie remet la pose d'avant (`restore`) : rend
 * alors la raison, intention effacée. Rend null si la pose est en place (l'intention reste, à effacer après la validation) ; lève si ESV est muet ou si la
 * remise est impossible. */
async function poserPuisVerifier(b,now,rails,expected,origine=null){const K=globalThis.BananeCore3,cut=now.identity.cut;
 await relectureNoterIntention({lotId:b.id,part:now.identity.part,cut,at:new Date().toISOString(),...(origine?{origine}:{})});
 const remettre=raison=>remettrePose(b,now,raison);
 let result;try{result=await applyInESV(now,rails,{clicHumain:'tout-recentre'});}
 catch(e){if(/Adaptateur ESV sans réponse|Une autre Ariane/.test(e?.message||''))throw Error(`cut ${cut} : ESV ne répond plus pendant la pose (${e.message}) ; rien n’est validé. Contrôle ce cut dans ESV.`);
  return remettre(`pose refusée par la page : ${String(e?.message||e).slice(0,160)}`);}
 if(K.key(result?.identity||{})!==K.key(now.identity)||!K.equalPoses(expected,result?.rails,.001))return remettre('pose non conforme à la commande (relecture à 1 mm)');
 const avantValider=await readState();
 if(K.key(avantValider.identity)!==K.key(now.identity)||!K.equalPoses(result.rails,avantValider.rails,.001))return remettre('rails modifiés entre la pose et la validation');
 return null;}
/* Correction d'un cut : le chemin de la pose d'un rouge par le lot (commande du lot, `apply`, relecture à 1 mm), puis Maj+Espace sur
 * place, prouvé par l'écriture « valid » de la ligne et par le MÊME cut toujours affiché (D-179). Rend {action, raison, arrivee,
 * stopApres} ; lève si la validation n'est pas prouvée. */
async function relectureCorriger(p,b,etat,calc){const K=globalThis.BananeCore3,G=globalThis.BananeGauge4,cut=etat.identity.cut;
 const refusee=raison=>({action:'correction-refusee',raison});
 const now=await readState();if(K.key(now.identity)!==K.key(etat.identity))return refusee('le cut affiché a changé');
 if(!K.equalPoses(etat.rails,now.rails))return refusee('rails modifiés depuis la capture');
 {let l2=null;try{l2=await relectureLigneListe(cut,now);}catch{l2=null;}if(!l2||l2.statut!=='valid'||l2.operateur)return refusee('statut du cut changé ou illisible depuis la lecture');}
 const rails=calc.commande.rails,expected=K.expectedPoses(now,rails),g=G.gaugeMmOf(expected,K.C);
 if(!G.admissible(G.classifyMm(g)))return refusee(`écartement hors contrat (${Math.round(g*10)/10} mm)`);
 const effacer=()=>relectureEffacerIntention(cut,b.id);
 const pose=await poserPuisVerifier(b,now,rails,expected);if(pose)return refusee(pose);
 /* Maj+Espace (D-175, D-179) : sur un vert, ESV écrit « valid » et reste sur le même cut. L'attente est portée par la passe (jeton). */
 const a={cut,depuisMs:Date.now(),ok:false,refus:null};relecture.attente=a;p.attente=a;
 const lacher=()=>{if(relecture.attente===a)relecture.attente=null;if(p.attente===a)p.attente=null;};
 let ev;try{ev=await call('validerMajEspace',now.identity,{part:b.scope.part,pageId:b.scope.pageId??null});}
 catch(e){lacher();
  if(/rien n.a été envoyé/.test(e?.message||''))return refusee(await remettrePose(b,now,`validation refusée avant l’envoi : ${String(e.message).slice(0,160)}`));
  throw Error(`cut ${cut} : validation incertaine (${String(e?.message||e).slice(0,200)}). Contrôle ce cut dans ESV.`);}
 if(ev?.commandSent!==true){lacher();throw Error(`cut ${cut} : validation incertaine (Maj+Espace non transmis). Contrôle ce cut dans ESV.`);}
 const fin=Date.now()+reglageRelecture().attenteEcritureMs;while(!a.ok&&a.refus==null&&Date.now()<fin)await attendreMs(100);
 lacher();
 if(!a.ok)throw Error(a.refus!=null?`cut ${cut} : ESV a refusé d’enregistrer la validation (statut ${a.refus}). Contrôle ce cut dans ESV.`
  :`cut ${cut} : Maj+Espace envoyé, aucune écriture de validation vue en ${Math.round(reglageRelecture().attenteEcritureMs/1000)} s. Contrôle ce cut dans ESV.`);
 await effacer();
 /* D-179 : la preuve est l'écriture ET le même cut toujours affiché. La page dit si elle a vu un autre cut ; sinon, une lecture du libellé
  * « Cut N of part P » (aucune commande) le confirme. Un autre cut, ou un libellé illisible : la passe s'arrête, rien n'est réécrit. */
 let vers=ev.navigationObserved===true&&partCut(ev.nextIdentity)?partCut(ev.nextIdentity):null;
 if(!vers){try{vers=partCut((await call('ping'))?.label);}catch{vers=null;}}
 if(!vers||vers.part!==now.identity.part||vers.cut!==cut)return {action:'corrige',raison:calc.critere.raison,arrivee:vers,
  stopApres:`Relecture arrêtée après la correction du cut ${cut} (validation vue) : ${vers?`après Maj+Espace, ESV affiche le cut ${vers.cut} de la partie ${vers.part}, pas le cut ${cut}`:'le cut affiché par ESV est illisible après Maj+Espace'}. Contrôle ESV.`};
 return {action:'corrige',raison:calc.critere.raison,arrivee:vers};}
async function relecturePasse(p,b,sel,reglages,entree,reprise=null){const K=globalThis.BananeCore3,R=globalThis.BananeRelectureOmbre,cfg=reglageRelecture(),partie=b.scope.part;
 /* Chaîne d'appuis (revue, correction 8) : VIDE au départ, comme l'étude ; seules les poses calculées pour les verts relus y entrent. */
 const chaine=reprise?.chaine?JSON.parse(JSON.stringify(reprise.chaine)):[],ecartementsVerts=reprise?.ecartementsVerts?reprise.ecartementsVerts.slice():[],ecartementPartieMm=entree.ecartementPartieMm;
 /* Médiane de la partie : celle de la liste d'ESV ; sans elle, celle des poses d'ESV des verts déjà relus (5 au moins). */
 const mediane=t=>{const v=t.slice().sort((x,y)=>x-y),m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2;};
 const ctx={chaine,ecartementRef:()=>Number.isFinite(ecartementPartieMm)?ecartementPartieMm:ecartementsVerts.length>=5?Math.round(mediane(ecartementsVerts)*10)/10:null};
 let total=Number.isInteger(entree.total)?entree.total:null;
 const borne=Math.max(...[total!==null?total-1:null,...sel.cuts.map(c=>c.cut)].filter(Number.isInteger));
 const vivante=()=>relecture.passe===p&&p.gen===relecture.gen&&p.etat==='en-cours';
 const plagesSautees=new Set(reprise?.plagesSautees||[]);let precedent=null,ici=null,issue='fin',derniereArrivee=null,ciCourant=reprise?.index??0,indexPause=null;
 const stop=(m,i='erreur')=>{p.message=m;issue=i;if(i==='pause-esv')indexPause=ciCourant;};
 /* Test 17 : ESV muet (F5, onglet rechargé) : pause automatique si le réglage le veut, sinon arrêt comme avant ; tout autre arrêt reste une erreur. */
 const stopEsv=m=>stop(m,p.reprise&&p.repriseF5!=='arret'&&/sans réponse|ne répond pas/.test(m)?'pause-esv':'erreur');
 /* Point de reprise après chaque cut relu : `index` est le PROCHAIN cut à relire (jamais un cut à moitié fait). */
 const reprisePoser=async index=>{
  const pt={v:1,lotId:p.lotId,mode:p.mode,modeEffectif:p.modeEffectif,debut:p.debut,total:p.total,index,faits:p.faits,corriges:p.corriges,refusees:p.refusees,vus:p.vus,vusCuts:[...p.vusCuts],
   cutsNeufs:p.cutsNeufs,cutsNeufsAnnonces:p.cutsNeufsAnnonces,chaine:JSON.parse(JSON.stringify(chaine)),ecartementsVerts:ecartementsVerts.slice(),ecartementPartieMm:Number.isFinite(ecartementPartieMm)?ecartementPartieMm:null,
   plagesSautees:[...plagesSautees],sel:{cuts:sel.cuts,plages:sel.plages},reglages:p.reglages??null,noteMode:p.noteMode??null,savedAt:new Date().toISOString()};
  p.point=pt;try{await chrome.storage.local.set({[CLE_RELECTURE_REPRISE]:pt});p.pointStocke=true;}catch{p.pointStocke=false;}};
 if(p.reprise)await reprisePoser(reprise?.index??0);
 /* Champs communs des événements d'un cut relu (revue, R10). */
 const evenementCut=(c,plage,champs)=>({identity:{part:partie,cut:c.cut},mode:p.modeEffectif,plage:plage?.libelle??null,zone:c.zone,zoneSource:sourceZone(c),role:c.role,...champs});
 /* Aller à un cut ('pas' : boutons d'ESV ; 'auto' : carte, sinon pas à pas). W8 : seul un cut hors des bornes, ou une annulation, fait
  * sauter la plage ; tout autre refus arrête la passe. 4.9.5.13 (terrain 2:19) : un refus « action d'Ariane en cours » (`ADAPTER_BUSY` : une
  * capture, une pose ou une lecture de la page n'est pas finie ; rien n'est parti vers ESV) est passager : la passe attend (`occupeAttentesMs`)
  * et redemande, avec une opération neuve ; la page garde son verrou et ne navigue jamais pendant une action. Au-delà des essais : arrêt. */
 const aller=async(cut,chemin)=>{const attentes=(Array.isArray(cfg.occupeAttentesMs)?cfg.occupeAttentesMs:[]).filter(x=>Number.isFinite(x)&&x>=0).slice(0,10);let nav,demandes=0;
  for(;;){const opId=K.uid();p.operationId=opId;demandes++;
   try{nav=await call('goToCut',{part:partie,cut},{chemin,borneConnue:Number.isFinite(borne)?borne:null},opId);}
   catch(e){p.operationId=null;ici=null;/* « Une autre Ariane » : un F5 n'y change rien, la passe ne se met pas en pause (stopEsv ne la prend pas pour un ESV muet). */
   if(/^Une autre Ariane/.test(e?.message||''))return {stop:`Relecture arrêtée au cut ${cut} : ${String(e.message).slice(0,200)}. Rien n’a été posé.`};
   return {stop:`Relecture arrêtée : ESV ne répond pas pendant le passage au cut ${cut} (${String(e?.message||e).slice(0,160)}). Contrôle le cut affiché ; rien n’a été posé.`};}
   p.operationId=null;
   if(!(nav?.resultat==='refuse'&&String(nav.refusal?.code||'')==='ADAPTER_BUSY')||p.arret||p.pauseDemandee||!vivante()||demandes>attentes.length)break;
   const attenteMs=attentes[demandes-1];
   await engine.event('relecture-navigation-attente',{identity:{part:partie,cut},code:'ADAPTER_BUSY',essai:demandes,attenteMs,essaisMax:attentes.length,
    raison:String(nav.refusal?.message||'').slice(0,200)}).catch(()=>{});
   await attendreMs(attenteMs);}
  if(nav?.bornes?.source==='compteur'&&Number.isInteger(nav.bornes.total)&&nav.bornes.total>0)total=nav.bornes.total;
  if(nav?.resultat==='confirme'){ici=cut;return {ok:true,par:nav.chemin==='pas-a-pas'?'pas':nav.chemin==='aucun'?'aucun':'evenement'};}
  if(nav?.resultat==='refuse'){const code=String(nav.refusal?.code||'');
   if(p.arret||p.pauseDemandee||/^(OUT_OF_BOUNDS|CANCELLED_)/.test(code))return {saut:true,raison:nav.refusal?.message??code};
   return {stop:`Relecture arrêtée : passage au cut ${cut} refusé par la page (${String(nav.refusal?.message||code||'refus').slice(0,200)})${demandes>1?` après ${demandes} demandes`:''}. Rien n’a été posé.`};}
  ici=null;return {stop:`Relecture arrêtée : le passage au cut ${cut} n’est pas confirmé (${nav?.refusal?.message||nav?.resultat||'résultat inconnu'}). Contrôle le cut affiché ; rien n’a été posé.`};};
 for(let ci=reprise?.index??0;ci<sel.cuts.length;ci++){const c=sel.cuts[ci];ciCourant=ci;
  if(!vivante()){issue='erreur';p.message='Relecture arrêtée : passe remplacée.';break;}
  if(p.arret){issue='arret';p.message=`Relecture arrêtée à ta demande : ${pluriel(p.faits,'cut')} relu${p.faits>1?'s':''} sur ${p.total}.`;break;}
  if(p.pauseDemandee&&p.reprise){issue='pause';indexPause=ci;break;}
  if(plagesSautees.has(c.plage))continue;
  const plage=sel.plages[c.plage];p.cut=c.cut;p.plage=plage?.libelle??null;
  const t0=Date.now(),chemins=[];let par=null,r=null;
   const memePlage=precedent&&precedent.plage===c.plage,enPas=ici!==null&&c.cut>ici&&(memePlage?c.cut-ici<=cfg.pasMax:c.cut-ici===1);
   if(enPas){chemins.push('pas');r=await aller(c.cut,'pas');}
   /* Revue (correction 3) : en « corriger », un vert corrigeable n'est posé qu'atteint par les boutons d'ESV. Après un saut par la
    * carte, la passe saute au cut d'avant (d'après, pour le cut 0), puis fait un pas vers lui. */
   else if(p.modeEffectif==='corriger'&&relectureCorrigeable(c,reglages)){const avant=c.cut>0?c.cut-1:c.cut+1;
    if(ici!==avant){chemins.push(`auto:${avant}`);const r0=await aller(avant,'auto');
     if(r0.stop){stopEsv(r0.stop);break;}if(r0.saut)r=r0;}
    if(!r){chemins.push('pas');r=await aller(c.cut,'pas');}}
   else{chemins.push('auto');r=await aller(c.cut,'auto');}
   if(r.stop){stopEsv(r.stop);break;}
   if(r.saut){if(p.arret)continue;if(p.pauseDemandee&&p.reprise){ci--;continue;}relectureJournal('relecture-ombre',evenementCut(c,plage,{action:'navigation-refusee',raison:r.raison??null,chemins}),p);
    plagesSautees.add(c.plage);precedent=null;ici=null;continue;}
   par=r.par;
  precedent=c;const tNav=Date.now();derniereArrivee=tNav;
  let etat,capture,erreurCapture=null,ligne=null;
  try{etat=await readState();if(etat?.identity?.part!==partie||etat.identity.cut!==c.cut)throw Error(`ESV affiche le cut ${etat?.identity?.cut}, pas le cut ${c.cut}`);
   /* Statut du cut dans la liste d'ESV (mémoire de la page, dès l'arrivée) : la preuve du vert, et « vu » ou non à l'arrivée. */
   try{ligne=await relectureLigneListe(c.cut,etat);}catch{ligne=null;}
   capture=await call('capture',etat);K.assertTarget(etat.identity,capture.identity);}
  catch(e){if(/Adaptateur ESV sans réponse|Une autre Ariane|ESV affiche/.test(e?.message||'')){stopEsv(`Relecture arrêtée au cut ${c.cut} : ${String(e.message).slice(0,200)}. Rien n’a été posé.`);break;}
   erreurCapture=String(e?.message||e).slice(0,200);}
  if(ligne&&ligne.vu===false)p.cutsNeufs++;
  /* D-172 : une capture vide est relue une fois ; deux captures complètes vides de suite : « aucun-point » (consigné, jamais envoyé). */
  let seconde=null;
  if(capture&&R.captureVide(capture))try{seconde=await call('capture',etat);}catch(e){if(/Adaptateur ESV sans réponse|Une autre Ariane/.test(e?.message||'')){stopEsv(`Relecture arrêtée au cut ${c.cut} : ${String(e.message).slice(0,200)}. Rien n’a été posé.`);break;}}
  const tCap=Date.now();let calc=null,erreurCalcul=null;const skip=capture?R.skipOmbre(seconde?[capture,seconde]:[capture]):null;
  if(c.role==='vert'&&capture?.rails&&!R.captureVide(capture))try{const g=globalThis.BananeLotDecision.gaugeOf({left:capture.rails.left.positionSceneRelative,right:capture.rails.right.positionSceneRelative});
   if(Number.isFinite(g)&&Math.abs(g-ECARTEMENT_ORIGINE_ESV_MM)>.05)ecartementsVerts.push(g);}catch{/* écartement illisible */}
  if(capture)try{calc=relectureCalculer(capture,c,ctx,reglages,skip);}catch(e){erreurCalcul=String(e?.message||e).slice(0,200);}
  const tCalc=Date.now();let action={action:'visite',raison:null},garde=null;
  if(calc&&p.modeEffectif==='corriger'&&calc.critere.corriger&&!p.arret){
   garde=relectureGarde({c,etat,ligne,par,total});
   if(!garde.ok)action={action:'visite',raison:`correction écartée : ${garde.raison}`};
   else{try{action=await relectureCorriger(p,b,etat,calc);}
    catch(e){stop(`Relecture arrêtée : ${String(e?.message||e).slice(0,300)}`);
     relectureJournal('relecture-ombre',evenementCut(c,plage,{action:'correction-incertaine',raison:p.message,statutEsv:ligne,arrivee:par,chemins}),p);p.faits++;break;}
    if(action.action==='corrige'){p.corriges++;ici=action.arrivee?action.arrivee.cut:null;}else p.refusees++;}}
  const j=calc?.jugement;capture=null;
  relectureJournal('relecture-ombre',evenementCut(c,plage,{statutEsv:ligne,arrivee:par,chemins,
   poseEsv:j?.poseActuelle??null,poseCalculee:j?.poseCalculee??null,ecartMm:j?.ecartMm??null,pireMm:j?.pireMm??null,confiance:j?.confiance??null,
   etage:j?.etage??null,appuis:j?.appuis??[],enChaine:calc?.enChaine??false,chaineCuts:chaine.length,hauteurMm:j?.hauteurMm??null,zoneGrise:j?.zoneGrise??false,verdict:j?.verdict??null,raison:j?.raison??erreurCapture??erreurCalcul,
   skipOmbre:skip?{raison:skip.raison,points:skip.points,captures:skip.captures,capturesVides:skip.capturesVides}:null,
   ecritMm:calc?.ecrit??null,ecartementMm:calc?.ecartementMm??null,ecartementRefMm:calc?.ecartementRefMm??null,variante:calc?.variante??null,s1:j?.s1??null,
   critere:calc?{corriger:calc.critere.corriger,regle:calc.critere.regle,raison:calc.critere.raison}:null,garde,
   action:action.action,raisonAction:action.raison,erreurCapture,erreurCalcul,
   durees:{navigationMs:tNav-t0,captureMs:tCap-tNav,calculMs:tCalc-tCap,totalMs:Date.now()-t0}}),p);
  p.faits++;
  if(p.reprise)await reprisePoser(ci+1);
  if(action.stopApres){stop(action.stopApres);break;}}
 /* Les « vu » des derniers cuts affichés arrivent après eux : la passe les attend (aucune commande pendant ce temps). */
 if(derniereArrivee!==null&&issue!=='pause-esv'){const reste=cfg.attenteVuMs-(Date.now()-derniereArrivee);if(reste>0)await attendreMs(Math.min(reste,10000));}
 /* Pause (demandée, ou ESV muet) : la passe garde son point et passe « en pause » ; pas de relecture-fin, la passe n'est pas finie. */
 if((issue==='pause'||issue==='pause-esv')&&relecture.passe===p&&p.reprise&&Number.isInteger(indexPause)){
  const sc=sel.cuts[indexPause];p.etat='en-pause';p.pauseRaison=issue==='pause'?'mic':'esv';p.pauseDemandee=false;p.arret=false;p.cut=sc?.cut??null;p.plage=sel.plages[sc?.plage]?.libelle??null;
  await reprisePoser(indexPause);
  p.message=issue==='pause'?`Relecture en pause au cut ${p.cut} : ${pluriel(p.faits,'cut')} relu${p.faits>1?'s':''} sur ${p.total}. Tu peux la reprendre, même après un F5.`
   :`ESV ne répond plus : relecture gardée en pause au cut ${p.cut} (${pluriel(p.faits,'cut')} relu${p.faits>1?'s':''} sur ${p.total}). Recharge ESV (F5) si elle est figée, reconnecte-la, puis reprends la relecture.`;
  relectureJournal('relecture-pause',{mode:p.mode,modeEffectif:p.modeEffectif,raison:p.pauseRaison,cut:p.cut,index:indexPause,faits:p.faits,total:p.total,corriges:p.corriges,stocke:p.pointStocke!==false,message:issue==='pause-esv'?String(p.message).slice(0,200):null},p);
  await relectureOublierPasse(p);return;}
 if(p.reprise){p.pauseDemandee=false;await relectureRepriseEffacer();}
 const vu=p.vus?` ; ESV a marqué ${pluriel(p.vus,'cut')} « vu »`:'';
 if(issue==='fin'&&p.etat==='en-cours')p.message=`Relecture finie : ${pluriel(p.faits,'cut')} relu${p.faits>1?'s':''}${p.modeEffectif==='corriger'?`, ${pluriel(p.corriges,'corrigé')}${p.refusees?`, ${pluriel(p.refusees,'correction')} refusée${p.refusees>1?'s':''} par la page`:''}`:', rien de modifié'}${vu}.${p.noteMode?` ${p.noteMode}`:''}`;
 else if(issue!=='fin'&&vu&&p.message&&!p.message.includes('« vu »'))p.message=p.message.replace(/\.?$/,`${vu}.`);
 if(relecture.passe===p){p.etat=issue==='fin'?'finie':issue==='arret'?'arretee':'erreur';p.fin=new Date().toISOString();p.cut=null;}
 relectureJournal('relecture-fin',{mode:p.mode,modeEffectif:p.modeEffectif,issue,raison:p.message,faits:p.faits,total:p.total,corriges:p.corriges,refusees:p.refusees,
  vus:p.vus,cutsNeufs:p.cutsNeufs,cutsNeufsAnnonces:p.cutsNeufsAnnonces,dureeMs:Date.parse(p.fin||new Date().toISOString())-Date.parse(p.debut)},p);
 await relectureOublierPasse(p);}
/* Test 29 (CH-027 ; ordre écrit de l'opérateur du 31/10 : « garder le système éveillé via Chrome, j'autorise la permission du manifeste ») — ÉVEIL DU SYSTÈME.
 * Pendant un lot, une file de parties, la deuxième passe ou la relecture, Ariane demande à Chrome de ne pas mettre l'ordinateur en veille
 * (`chrome.power.requestKeepAwake`, niveau « system » : l'écran peut s'éteindre, constat de l'opérateur) et relâche la demande dès que plus rien ne tourne.
 * L'écoute (Écho) n'en fait pas partie : l'opérateur est devant. Une panne de l'API ne touche jamais le lot (journal `eveil-erreur`). */
const eveil={tenu:false,raison:null,minuteur:null};
function eveilBesoin(){const R=globalThis.BananeSettings?.eveil;if(!R||R.actif!==true)return null;
 try{if(typeof fileActive==='function'&&fileActive())return 'file';}catch{/* pas de file */}
 const seance=seanceObservateur({grace:true});
 return seance&&/^(lot|relecture|passe-differes):/.test(seance)?seance.split(':')[0]:null;}
function eveilMaj(){const besoin=eveilBesoin(),niveau=globalThis.BananeSettings?.eveil?.niveau==='display'?'display':'system';
 try{
  if(besoin&&!eveil.tenu){if(!chrome.power?.requestKeepAwake)return;chrome.power.requestKeepAwake(niveau);eveil.tenu=true;eveil.raison=besoin;journalerSimple('eveil-demande',{raison:besoin,niveau});}
  else if(!besoin&&eveil.tenu){chrome.power?.releaseKeepAwake?.();eveil.tenu=false;journalerSimple('eveil-relache',{apres:eveil.raison});eveil.raison=null;}
 }catch(e){journalerSimple('eveil-erreur',{message:String(e?.message||e).slice(0,160)});}}
if(!eveil.minuteur&&typeof setInterval==='function')eveil.minuteur=setInterval(eveilMaj,5000);
/* CH-017 (T27a ; D-244, D-245, D-247, D-248, D-261) — FILE DE PARTIES : PILOTE DU SERVICE WORKER autour de la machine pure `src/file-parties.js`.
 * ÉTEINTE PAR DÉFAUT (`BananeSettings.file.actif`, src/settings.js) : aucune action « file-* » n'est acceptée (« Commande inconnue », comme avant),
 * aucun tic, aucune lecture du stockage de la file, la vue du panneau et les exports sont ceux d'avant, à l'octet près.
 * Allumée : `file-demarrer` {n, lotArgs} fige les N parties (la partie affichée puis les suivantes du sélecteur d'ESV relevé en lecture seule) ; la
 * machine rend des actions que le pilote exécute APRÈS avoir gardé l'état (`banane60FileParties`) : démarrer le lot de la partie (le chemin
 * « Démarrer » du panneau, toutes ses gardes ; scope `fileParties` et relecture « corriger », D-261), changer de partie (commande
 * `changerPartie` de l'adaptateur, puis la partie demandée lue dans ESV en 60 s au plus, l'onglet ré-équipé après un rechargement), revenir sur la
 * partie du lot pour la relecture, arrêter ce qui travaille. Un TIC (1 s) lit le lot, la passe et la relecture et nourrit la machine : la passe et
 * la relecture partent d'elles-mêmes à la fin du lot (comme sans file). Le registre des écritures (`banane60RegistreFile`) est noté à la fin de
 * chaque partie. Au réveil du service worker : `fileReprendre` (registre d'abord). CH-026 : l'événement `arreter` note la commande qui l'a
 * porté (`origine` : `file-arreter`, « Arrêter la file » ; `stop`, « Arrêter » du lot pendant la file), que le journal du test 26 ne permettait pas de distinguer. Commandes ESV de la file : celles du lot, de la passe, de la
 * relecture, et `changerPartie` ; aucune autre, jamais de SKIP. Journal : `file-parties`, `file-parties-reprise`, `file-parties-erreur`. */
const FILE_DEFAUT=Object.freeze({changementBorneMs:60000,ticMs:1000,passeGraceMs:5000,relectureAttenteMs:180000,pollMs:500});
const FILE_ACTIONS=new Set(['file-etat','file-demarrer','file-arreter','file-oublier']);
const FILE_LOT_ARGS=['testConfirmed','allowNavigationEvidence','lowConfidence','unresolvedPolicy','lotDecision','geometryEngine'];
const fileP={etat:null,file:Promise.resolve(),tic:null,ticEnCours:false,demarrage:null,action:null};
const FPm=()=>globalThis.BananeFileParties;
function fileReglage(){const f=globalThis.BananeSettings?.file;return f&&f.actif===true&&FPm()?{...FILE_DEFAUT,...f}:null;}
const fileActive=()=>!!fileP.etat&&!!FPm()?.actif(fileP.etat);
async function fileSauver(e){fileP.etat=e;const C=FPm().CLE_ETAT;try{if(e)await chrome.storage.local.set({[C]:e});else await chrome.storage.local.remove?.(C);}catch{/* mémoire seule */}}
/* Une transition à la fois : l'état gardé est toujours celui de la dernière transition rendue. */
function fileEvenement(ev){const p=fileP.file.then(()=>fileAppliquer(FPm().transition(fileP.etat,{at:new Date().toISOString(),...ev}),ev));fileP.file=p.catch(()=>{});return p;}
async function fileAppliquer(r,ev){if(r.refus)throw Error('File de parties non lancée : '+r.refus+'.');if(r.ignore)return r;
 const avant=fileP.etat;await fileSauver(r.etat);const e=r.etat||avant;
 journalerSimple('file-parties',{evenement:ev.type,de:avant?.etat??null,vers:r.etat?.etat??null,fileId:e?.id??null,rang:e?.k??null,part:r.etat?.partie?.part??r.etat?.changement?.vers??null,
  motif:r.etat?.motifFin?.code??null,actions:r.actions.map(a=>a.type),...(ev.type==='arreter'?{origine:ev.origine??null}:{}),
  ...(ev.type==='demarrer'&&ev.remplace?{remplace:ev.remplace}:{}),...(ev.type==='demarrer'&&Number.isInteger(ev.reprise)?{reprise:ev.reprise}:{})});
 fileTicPlanifier();for(const a of r.actions)void fileAction(a);return r;}
async function fileAction(a){fileP.action=a.type;try{
  if(a.type==='demarrer-lot')await fileDemarrerLot(a);
  else if(a.type==='changer-partie')await fileChangerPartie(a.vers,false);
  else if(a.type==='retour-partie')await fileChangerPartie(a.vers,true);
  else if(a.type==='arreter-activite')await fileArreterActivite();
  else if(a.type==='registre')await fileRegistreNoter(a.rang);}
 catch(e){journalerSimple('file-parties-erreur',{action:a.type,message:String(e?.message||e).slice(0,200)});}
 finally{if(fileP.action===a.type)fileP.action=null;}}
/* REGISTRE consulté avant tout départ : une écriture d'Ariane non prouvée (pose commandée non validée, résultat à réconcilier, correction de la
 * relecture ou de la passe interrompue, écriture de la passe en vol) ; null si rien n'est en suspens. */
/* CH-026-c : PORTÉE du registre. `lot` : les écritures du moteur seulement (le lot se classe sur les siennes : à sa fin, la deuxième passe, en
 * écriture depuis D-259, démarre aussitôt, et son écriture en vol n'est pas une pose du lot laissée en suspens ; constat sur un vrai ESV, 30/10) ;
 * `passe` : le moteur, la passe et ses corrections (la relecture, qui suit, peut déjà tourner) ; défaut : tout (relecture finie, départ, reprise). */
async function fileSuspens(portee='tout'){const s=engine?.s;
 if(s?.intent||s?.reconcileRequired)return 'résultat incertain à réconcilier dans ESV';
 if(s?.applied)return `pose d’Ariane au cut ${s.applied.identity?.cut??'?'} non validée`;
 if(portee==='lot')return null;
 const l=(await relectureIntentions()).filter(x=>portee!=='passe'||x.origine==='passe');if(l.length)return `correction ${l[0].origine==='passe'?'de la deuxième passe':'de la relecture'} interrompue au cut ${l[0].cut}`;
 if(passeDiff.ecriture?.attente||passeDiff.etat?.ecriture?.enVol)return 'écriture de la deuxième passe en vol';
 return null;}
function fileResume(b){return {traites:cutsTraites(b).size,poses:(b.processed||[]).length,differes:(b.deferred||[]).length,main:(b.manuallyCompleted||[]).length};}
async function fileDemarrerLot({part,rang}){const e=fileP.etat;if(!e||e.etat!=='lot'||e.k!==rang||e.partie?.lotId)return;
 const s=await fileSuspens();if(s)return fileEvenement({type:'suspens',detail:s});
 let now=null;try{now=await readState();}catch(x){return fileEvenement({type:'lot-refuse',detail:`ESV ne répond pas (${String(x?.message||x).slice(0,160)})`});}
 if(now?.identity?.part!==part||!Number.isInteger(now?.identity?.cut))return fileEvenement({type:'lot-refuse',detail:`ESV affiche la partie ${now?.identity?.part??'?'}, pas la partie ${part}`});
 const args={...(e.lotArgs||{}),part,start:now.identity.cut,end:FIN_PARTIE,endMode:'partie'};
 fileP.demarrage={id:e.id,rang,n:e.n};
 try{await dispatch({action:'start',args});}catch(x){return fileEvenement({type:'lot-refuse',detail:String(x?.message||x).slice(0,300)});}
 finally{fileP.demarrage=null;}
 const b=engine.s.batch;return fileEvenement({type:'lot-demarre',lotId:b?.id,part});}
/* CHANGER DE PARTIE (ou revenir sur celle du lot pour la relecture). La commande n'est envoyée que si l'adaptateur dit la connaître (`ping` :
 * `capacites`) ; sa réponse n'est qu'un accusé de demande : la PREUVE est la partie demandée lue dans ESV (« Cut N of part P », rails présents),
 * après un rechargement (onglet ré-équipé) ou sur place, dans la borne.
 * CH-026 : vers la partie SUIVANTE, les gestes de l'opérateur d'abord (témoignage du 30/10, jamais mesuré sur un vrai ESV), chacun seulement si
 * l'adaptateur l'annonce (`changerPartie:<mode>` ; chantiers/CH-026/adaptateur-changement-partie.patch) : (1) `invalide-suivant` (son « Espace » :
 * plus rien à valider dans la partie, « Next non validated cut ») ; (2) `suivant-dernier` (« dernier cut puis Z » : `goToCut` au dernier cut, puis
 * « Next cut ») ; (3) `lien`, le clic du sélecteur, en dernier repli (seul chemin du retour sur la partie du lot). Aucun n'émet de validation ni de
 * SKIP (l'adaptateur le rend dans sa réponse). Une tentative refusée ou sans effet passe à la suivante ; une AUTRE partie ouverte arrête tout.
 * Chaque tentative est un événement `file-parties-changement` (mode, réponse de la page, compteur, bouton, identité avant et après, délai) ; un
 * échec, un `file-parties-changement-echec` (toutes les tentatives, sélecteur avant et après) et une alerte qui le dit dans Signal : jamais muet. */
const FILE_GESTE_BORNE_MS=15000;
async function fileChangerPartie(vers,retour){const R=fileReglage(),e0=fileP.etat;if(!R||!e0)return;
 const attendu=()=>fileP.etat?.id===e0.id&&(retour?fileP.etat.etat==='relecture':fileP.etat.etat==='changement'&&fileP.etat.changement?.vers===vers);
 const s=await fileSuspens();if(s)return fileEvenement({type:'suspens',detail:s});
 if(!retour)await fileEvenement({type:'changement-envoye',vers});
 const X=await changerPartieEsv(vers,{retour,attendu,R,gestes:()=>!retour});
 if(X.quitte)return;
 if(X.ok)return retour?fileRelectureApresRetour(true):fileEvenement({type:'changement-ok',part:vers,cut:X.r.identity.cut});
 if(X.journalEchec)journalerSimple('file-parties-changement-echec',{vers,retour,motif:X.motif,detail:String(X.detail||'').slice(0,300),tentatives:X.tentatives,selecteurAvant:X.selecteurAvant,selecteurApres:X.selecteurApres,dureeMs:Date.now()-X.t0});
 const resume=X.tentatives.map(t=>`${t.mode} : ${t.texte}`).join(' ; ');
 const d=X.tentatives.length&&!String(X.detail||'').includes(resume)?`${X.detail} ; essayé : ${resume}`:X.detail;
 return retour?fileRelectureApresRetour(false,d):fileEvenement({type:'changement-echec',motif:X.motif,detail:String(d).slice(0,380)});}
/* CH-035 : LE CŒUR DU CHANGEMENT DE PARTIE, commun à la file (CH-017, CH-026) et à l'Aurore entre parties (correction dans Orbite). Extrait tel quel de
 * `fileChangerPartie` : `ping` et ses `capacites`, les modes de l'adaptateur (`gestes(de)` dit si les deux gestes vers la partie SUIVANTE sont permis),
 * la preuve (partie lue dans la page, rails présents, onglet ré-équipé), les bornes, un événement par tentative (`typeTentative`), l'arrêt prudent si ESV
 * ouvre une autre partie. `attendu()` faux : on quitte sans rien conclure. Rend {ok, r} ou {ok:false, motif, detail, journalEchec, selecteurApres},
 * avec toujours {tentatives, selecteurAvant, t0} ; ne touche à aucun état de la file ni de la correction. */
async function changerPartieEsv(vers,{retour=false,attendu,R,gestes=()=>true,typeTentative='file-parties-changement'}){
 const t0=Date.now(),tentatives=[];let selecteurAvant=null;
 const sel=x=>x?{status:x.status??null,current:entierOuNul(x.current),n:Array.isArray(x.parts)?x.parts.length:null,vers:Array.isArray(x.parts)?x.parts.some(p=>p?.part===vers):null}:null;
 const relever=async()=>{try{return sel((await call('ping',{contrat:true}))?.selecteurParties);}catch{return null;}};
 const fin=x=>({...x,tentatives,selecteurAvant,t0});
 const echec=async(motif,detail)=>{const journalEchec=!retour||tentatives.length>0;return fin({ok:false,motif,detail,journalEchec,selecteurApres:journalEchec?await relever():null});};
 const ok=r=>fin({ok:true,r});
 const pret=r=>r?.identity?.part===vers&&!!r?.rails?.left&&!!r?.rails?.right;
 let lu=null;try{lu=await readState();}catch{/* lu plus bas */}
 if(pret(lu))return ok(lu);
 let ping=null;try{ping=await call('ping',{contrat:true});}catch(x){return echec('esv-muet',`ESV ne répond pas (${String(x?.message||x).slice(0,160)})`);}
 selecteurAvant=sel(ping?.selecteurParties);
 if(!Array.isArray(ping?.capacites)||!ping.capacites.includes('changerPartie'))return echec('commande-absente','l’adaptateur de la page ne connaît pas « changerPartie » (diff proposé de CH-017 non appliqué)');
 const de0=lu?.identity?.part??null;
 const modes=[...(gestes(de0??entierOuNul(ping?.label?.part))?['invalide-suivant','suivant-dernier'].filter(m=>ping.capacites.includes('changerPartie:'+m)):[]),'lien'];
 /* Attente de la preuve d'une tentative acceptée : la partie demandée, ou une autre partie (arrêt), ou rien dans la borne. */
 const preuve=async borne=>{const fin=Date.now()+borne;let vu=false,derniere=null,partie=null;
  while(Date.now()<fin){if(!attendu())return {quitte:true};
   let tab=null;try{tab=selectedTab===null?null:await chrome.tabs.get(selectedTab);}catch{tab=null;}
   if(!tab)return {onglet:true};
   if(tab.status&&tab.status!=='complete'){await attendre(R.pollMs);continue;}
   try{const r=await readState();vu=true;partie=r?.identity?.part??null;if(pret(r))return {r};derniere=partie!==null?`ESV affiche la partie ${partie}, cut ${r?.identity?.cut??'?'}`:null;}
   catch(x){derniere=String(x?.message||x).slice(0,160);try{await equiperOnglet(selectedTab);}catch(y){if(y?.definitif)return {definitif:y.message};}}
   await attendre(R.pollMs);}
  return {vu,derniere,partie};};
 let dernierMotif=null;
 for(const mode of modes){if(!attendu())return fin({quitte:true});
  const t=Date.now(),T={mode,raison:null,de:null,compteur:null,bouton:null,goto:null,issue:null,texte:'',identiteApres:null,dureeMs:null};tentatives.push(T);
  const fixer=rep=>{T.raison=typeof rep?.raison==='string'?rep.raison.slice(0,40):null;T.de=Number.isInteger(rep?.de?.part)?{part:rep.de.part,cut:entierOuNul(rep.de.cut)}:T.de;
   T.compteur=rep?.compteur&&Number.isInteger(rep.compteur.total)?{traites:entierOuNul(rep.compteur.traites),total:rep.compteur.total}:T.compteur;
   T.bouton=rep?.bouton?.id?{id:String(rep.bouton.id).slice(0,40),existe:!!rep.bouton.exists,inactif:!!rep.bouton.disabled}:T.bouton;
   T.sansDecision=rep?.validationCommandSent===false&&rep?.skipCommandSent===false;};
  const noter=(issue,texte,apres=null)=>{T.issue=issue;T.texte=texte;T.identiteApres=apres;T.dureeMs=Date.now()-t;
   journalerSimple(typeTentative,{vers,retour,mode,de:T.de,deja:issue==='deja',tentative:tentatives.length,raison:T.raison,compteur:T.compteur,bouton:T.bouton,goto:T.goto,issue,texte:texte.slice(0,200),identiteApres:apres,sansDecision:T.sansDecision??null,dureeMs:T.dureeMs});};
  let rep=null;try{rep=await call('changerPartie',{part:vers,mode});}catch(x){fixer(null);noter('refus',`commande refusée (${String(x?.message||x).slice(0,120)})`);dernierMotif='changement-impossible';continue;}
  fixer(rep);
  /* « Dernier cut puis Z » : l'adaptateur dit le dernier cut (compteur M − 1) ; Ariane y va (`goToCut`, navigation seule), puis redemande. */
  if(mode==='suivant-dernier'&&rep?.ok!==true&&rep?.raison==='pas-au-dernier-cut'&&Number.isInteger(rep?.dernier)&&Number.isInteger(rep?.de?.part)){
   let nav=null;try{nav=await call('goToCut',{part:rep.de.part,cut:rep.dernier},{chemin:'auto',borneConnue:rep.dernier},globalThis.BananeCore3.uid());}catch(x){nav={resultat:'erreur',refusal:{code:'ERREUR',message:String(x?.message||x)}};}
   T.goto={cut:rep.dernier,resultat:typeof nav?.resultat==='string'?nav.resultat:null,chemin:typeof nav?.chemin==='string'?nav.chemin:null,code:typeof nav?.refusal?.code==='string'?nav.refusal.code.slice(0,40):null};
   if(nav?.confirme!==true){noter('refus',`dernier cut ${rep.dernier} non atteint (${String(nav?.refusal?.message||nav?.resultat||'résultat inconnu').slice(0,120)})`);dernierMotif='changement-impossible';continue;}
   try{rep=await call('changerPartie',{part:vers,mode});}catch(x){fixer(null);noter('refus',`commande refusée (${String(x?.message||x).slice(0,120)})`);dernierMotif='changement-impossible';continue;}
   fixer(rep);}
  if(rep?.ok!==true){const r=rep?.raison;
   const texte=r==='reste-a-valider'?`il reste des cuts à valider (${T.compteur?.traites??'?'} traités sur ${T.compteur?.total??'?'})`:r==='partie-absente'?`aucune entrée vers la partie ${vers} dans le sélecteur`
    :r==='bouton-absent'||r==='bouton-desactive'?`bouton ${T.bouton?.id||'?'} ${r==='bouton-absent'?'absent':'désactivé'}`:r?`la page refuse : ${String(r).slice(0,60)}`:'réponse illisible de la page';
   noter('refus',texte);dernierMotif=['partie-absente','libelle-illisible'].includes(r)?'selecteur-illisible':'changement-impossible';continue;}
  if(rep.deja){noter('deja','déjà sur la partie');const r=await readState().catch(()=>null);if(pret(r))return ok(r);continue;}
  const P=await preuve(mode==='lien'?R.changementBorneMs:Math.min(FILE_GESTE_BORNE_MS,R.changementBorneMs));
  if(P.quitte)return fin({quitte:true});
  if(P.onglet){noter('onglet-ferme','onglet ESV fermé');return echec('onglet-ferme','onglet ESV fermé pendant le changement de partie');}
  if(P.definitif){noter('echec',P.definitif.slice(0,160));return echec('changement-impossible',P.definitif);}
  if(P.r){noter('ok',`partie ${vers} ouverte en ${Math.round((Date.now()-t)/100)/10} s`,{part:vers,cut:entierOuNul(P.r.identity?.cut)});return ok(P.r);}
  const borne=Math.round((mode==='lien'?R.changementBorneMs:Math.min(FILE_GESTE_BORNE_MS,R.changementBorneMs))/1000);
  if(Number.isInteger(P.partie)&&P.partie!==vers&&P.partie!==(T.de?.part??de0)){noter('autre-partie',`ESV a ouvert la partie ${P.partie}, pas la partie ${vers}`,{part:P.partie,cut:null});
   return echec('changement-impossible',`ESV a ouvert la partie ${P.partie} au lieu de la partie ${vers} : arrêt prudent`);}
  noter(P.vu?'sans-effet':'muet',`${P.vu?`la partie ${vers} n’est pas affichée`:'ESV ne répond plus'} après ${borne} s${P.derniere?` (${P.derniere})`:''}`,Number.isInteger(P.partie)?{part:P.partie,cut:null}:null);
  dernierMotif=P.vu?'changement-impossible':'esv-muet';}
 return echec(dernierMotif||'changement-impossible',`la page d’ESV n’a pas affiché la partie ${vers}`);}
/* D-261 : après le retour sur la partie du lot, la relecture est relancée (le chemin « Lancer la relecture », toutes ses gardes). */
async function fileRelectureApresRetour(revenu,detail=null){const e=fileP.etat,lotId=e?.partie?.lotId;if(!e||e.etat!=='relecture')return;
 const nonLancee=d=>fileEvenement({type:'relecture-fin',lotId,issue:'non-lancee',horsPartie:false,detail:d});
 if(!revenu)return nonLancee(`retour sur la partie ${e.partie.part} impossible${detail?` (${detail})`:''}`);
 try{await dispatch({action:'relecture-lancer'});}catch(x){return nonLancee(String(x?.message||x).slice(0,300));}}
async function fileArreterActivite(){if(passeDiff.ecriture)passeDiff.ecriture.arret=true;if(passeActive())relectureArreter();
 const b=engine?.s?.batch;if(b&&!OBS_CLOS.includes(b.state))await coordinateurLot.transition('arret',async()=>{const fin=engine.stop();marquerFinLot(b,'arret-manuel');await fin;}).catch(()=>{});}
async function fileRegistreLire(){try{const v=(await chrome.storage.local.get(FPm().CLE_REGISTRE))?.[FPm().CLE_REGISTRE];return Array.isArray(v)?v:[];}catch{return [];}}
async function fileRegistreNoter(rang){const e=fileP.etat,p=e?.bilan?.find(x=>x.rang===rang);if(!p?.lotId)return;
 let events=[];try{events=await store.all('events')||[];}catch{events=[];}
 const du=events.filter(x=>x?.batchId===p.lotId||x?.lotId===p.lotId),b=engine?.s?.batch,cutDe=x=>x?.cut??x?.identity?.cut;
 const poses=b?.id===p.lotId?(b.processed||[]).map(cutDe):[];
 const passe=du.filter(x=>x.type==='passe-differes-ecriture'&&x.resultat==='ecrit'&&x.identity?.part===p.part).map(x=>x.identity.cut);
 const corriges=du.filter(x=>x.type==='relecture-ombre'&&x.action==='corrige'&&x.identity?.part===p.part).map(x=>({cut:x.identity.cut,ecartMm:Number.isFinite(x.ecartMm)?x.ecartMm:null}));
 const R=FPm().registreAjouter(await fileRegistreLire(),{fileId:e.id,part:p.part,rang,lotId:p.lotId,at:p.fin,poses,passe,corriges,valides:[...poses,...passe,...corriges.map(c=>c.cut)]});
 try{await chrome.storage.local.set({[FPm().CLE_REGISTRE]:R});}catch{/* mémoire seule */}}
function fileTicPlanifier(){const R=fileReglage();if(!R||!fileActive()||fileP.tic)return;
 fileP.tic=setTimeout(()=>{fileP.tic=null;void fileTic().catch(()=>{}).finally(fileTicPlanifier);},R.ticMs);}
async function fileTic(){const R=fileReglage();if(!R||!fileActive()||fileP.action||fileP.ticEnCours)return;fileP.ticEnCours=true;
 try{const e=fileP.etat,lotId=e.partie?.lotId;
  let tab=null;try{tab=selectedTab===null?null:await chrome.tabs.get(selectedTab);}catch{tab=null;}
  if(!tab)return void await fileEvenement({type:'onglet-ferme',detail:'onglet ESV fermé ou non choisi'});
  if(e.etat==='lot'&&lotId){const b=engine?.s?.batch;
   if(b?.id!==lotId)return void await fileEvenement({type:'lot-fin',lotId,motif:'refus-lot',detail:'le lot de la file a été remplacé'});
   if(!FPm().classerLot({etat:b.state}))return;   /* lot ouvert (une pause comprise) : la file attend */
   /* CH-026-b : le moteur marque la fin du lot AVANT d'avoir fini sa boucle (la validation sur place du dernier cut est encore en vol, mesuré :
    * acceptée 25 ms après `batch-stopped-at-end`). Tant que la boucle du lot tourne, rien n'est classé : sinon le registre lit une pose « non
    * validée » qui l'est l'instant d'après, et la file s'arrête à tort en « ecriture-incertaine ». Boucle finie, le registre décide comme avant. */
   if(engine?.task)return;
   const s=await fileSuspens('lot'),arret=coordinateurLot.journal.some(t=>t.nom==='arret'&&t.lot===b.id)||obsFins.get(b.id)?.cause==='arret-manuel';
   const motif=FPm().classerLot({etat:b.state,stoppedAtEnd:b.stoppedAtEnd,arretOperateur:arret,ecritureEnSuspens:!!s});
   return void await fileEvenement({type:'lot-fin',lotId,motif,issue:b.stoppedAtEnd?.issue??b.state,resume:fileResume(b),
    detail:motif==='ecriture-incertaine'?s||'le lot a fini avec des actions non confirmées':b.stoppedAtEnd?.reason??engine.s.notice??null});}
  if(e.etat==='passe'){if(passeDiff.cours||passeDiff.ecriture)return;
   if(!passeDiff.planifie.has(lotId)&&Date.now()-Date.parse(e.depuis)<R.passeGraceMs)return;
   const v=passeDiff.vue?.lotId===lotId?passeDiff.vue:null,s=await fileSuspens('passe');
   return void await fileEvenement({type:'passe-fin',lotId,issue:v?v.etat:'absente',ecrits:v?.ecrites??0,ecritureEnSuspens:!!s,detail:s||v?.message||null});}
  if(e.etat==='relecture'){const p=relecture.passe;
   if(p?.lotId===lotId&&['preparation','en-cours','en-pause'].includes(p.etat))return;
   if(p?.lotId===lotId&&['finie','arretee','erreur','non-lancee'].includes(p.etat)){const s=await fileSuspens();let hors=false;
    if(p.etat==='non-lancee')try{const r=await readState();hors=Number.isInteger(r?.identity?.part)&&r.identity.part!==e.partie.part;}catch{/* illisible : pas de retour */}
    return void await fileEvenement({type:'relecture-fin',lotId,issue:p.etat,corriges:p.corriges,refusees:p.refusees,faits:p.faits,mode:p.modeEffectif||p.mode,horsPartie:hors,ecritureEnSuspens:!!s,detail:s||p.message||null});}
   if(!passeActive()&&Date.now()-Date.parse(e.depuis)>R.relectureAttenteMs)return void await fileEvenement({type:'relecture-fin',lotId,issue:'absente',detail:'aucune relecture pour ce lot'});}}
 finally{fileP.ticEnCours=false;}}
/* AU RÉVEIL DU SERVICE WORKER (allumée seulement) : l'état gardé est relu ; le registre, l'onglet et ESV sont lus avant toute action (machine : `reprise`). */
async function fileReprendre(){if(!fileReglage())return;let v=null;try{v=(await chrome.storage.local.get(FPm().CLE_ETAT))?.[FPm().CLE_ETAT];}catch{return;}
 const e=FPm().relire(v);if(!e)return;fileP.etat=e;if(!FPm().actif(e))return;
 await passeDiffReveil;
 let ongletPresent=selectedTab!==null;if(ongletPresent)try{await chrome.tabs.get(selectedTab);}catch{ongletPresent=false;}
 const s=await fileSuspens();let partieAffichee=null;try{partieAffichee=(await readState())?.identity?.part??null;}catch{/* ESV muet */}
 const b=engine?.s?.batch,f=b?.scope?.fileParties,lotFile=f&&f.id===e.id?{id:b.id,rang:f.rang,part:b.scope.part}:null;
 const r=FPm().reprise(e,{ongletPresent,ecritureEnSuspens:!!s,detailSuspens:s,lotFile,partieAffichee,at:new Date().toISOString()});
 journalerSimple('file-parties-reprise',{fileId:e.id,etat:e.etat,rang:e.k,vers:r.etat?.etat??null,actions:r.actions.map(a=>a.type),suspens:s,partieAffichee});
 const p=fileP.file.then(()=>fileAppliquer(r,{type:'reprise'}));fileP.file=p.catch(()=>{});await p;}
const fileReveil=ready.then(()=>fileReprendre()).catch(()=>{});
/* CH-026-c : file arrêtée, l'activité de sa dernière partie finie depuis (passe, relecture) : son issue va au bilan (src/file-parties.js `completerBilan`).
 * Appelé à chaque vue du panneau (une lecture d'état, aucune commande ESV). */
async function fileCompleterBilan(){const e=fileP.etat;if(!e||e.etat!=='arret'||!FPm().completerBilan)return;const lotId=e.bilan?.at(-1)?.lotId;if(!lotId)return;
 const p=relecture.passe,v=passeDiff.vue,fini=x=>['finie','arretee','erreur','non-lancee'].includes(x);
 const n=FPm().completerBilan(e,{lotId,passe:v?.lotId===lotId&&!passeDiff.cours&&!passeDiff.ecriture&&v.etat?{issue:v.etat,ecrits:v.ecrites??0}:null,
  relecture:p?.lotId===lotId&&fini(p.etat)?{issue:p.etat,corriges:p.corriges,faits:p.faits,mode:p.modeEffectif||p.mode}:null});
 if(!n)return;await fileSauver(n);journalerSimple('file-parties-bilan-complete',{fileId:n.id,part:n.bilan.at(-1).part,passe:n.bilan.at(-1).passe?.issue??null,relecture:n.bilan.at(-1).relecture?.issue??null});}
async function fileVue(){await fileCompleterBilan();return {reglage:{actif:true,nombres:[1,2,3,4,5,8]},file:FPm().vue(fileP.etat),registre:(await fileRegistreLire()).slice(-8)};}
async function fileDispatch(action,args){await fileReveil;
 if(action==='file-etat')return fileVue();
 if(action==='file-arreter'){await fileEvenement({type:'arreter',origine:'file-arreter'});return fileVue();}
 if(action==='file-oublier'){await fileEvenement({type:'oublier'});return fileVue();}
 /* file-demarrer : mêmes refus qu'un lot, dits AVANT de créer la file (rien n'est gardé si elle ne peut pas partir). */
 if(fileActive())throw Error('File de parties déjà en cours : arrête-la d’abord.');
 if(selectedTab===null)throw Error('Connecte ESV avant de lancer la file.');
 if(engine.s.mode!=='automatic-test')throw Error('File de parties : Orbite seulement (mode lot).');
 engine.assertBatchContextFree('la file de parties');
 if(passeActive()||passeDiff.cours||passeDiff.ecriture||native?.active()||manual?.active())throw Error('File de parties : termine l’activité en cours (relecture, deuxième passe, Écho) avant de la lancer.');
 const s=await fileSuspens();if(s)throw Error(`File de parties non lancée : ${s}. Contrôle ce cut dans ESV d’abord.`);
 let now=null;try{now=await readState();}catch(x){throw Error('File de parties non lancée : ESV ne répond pas ('+String(x?.message||x).slice(0,160)+').');}
 /* CH-026 : REPRISE d'une file arrêtée, au rang interrompu (`depuis` : la partie du plan qui n'a pas fini). La nouvelle file part de la partie affichée :
  * elle doit être celle-là, sinon le rang serait faux. Refus en clair, rien n'est gardé. */
 const depuis=args?.depuis;
 if(depuis!==undefined&&depuis!==null){if(!Number.isInteger(depuis))throw Error('Reprise de la file : partie de reprise illisible.');
  if(now?.identity?.part!==depuis)throw Error(`Reprise de la file : ESV affiche la partie ${now?.identity?.part??'?'} ; la reprise part de la partie ${depuis}. Affiche-la dans ESV, puis reprends.`);}
 try{const r=await callSur(selectedTab,'ping',{contrat:true});selecteurNoter(r?.selecteurParties);}catch{/* relevé ancien gardé */}
 const lotArgs=Object.fromEntries(FILE_LOT_ARGS.filter(k=>args?.lotArgs&&Object.hasOwn(args.lotArgs,k)).map(k=>[k,args.lotArgs[k]]));
 const precedente=fileP.etat&&FPm().terminal(fileP.etat)?{id:fileP.etat.id,etat:fileP.etat.etat,faites:fileP.etat.bilan.filter(p=>!p.interrompue).length,n:fileP.etat.n}:null;
 await fileEvenement({type:'demarrer',id:globalThis.BananeCore3.uid(),n:Number(args?.n),selecteur:partsSelector,courante:now?.identity?.part,lotArgs,
  ...(precedente?{remplace:precedente}:{}),...(Number.isInteger(depuis)?{reprise:depuis}:{})});
 return fileVue();}
async function fileExport(){if(!fileReglage())return {};const r=await fileRegistreLire();return r.length||fileP.etat?{fileParties:{etat:FPm().vue(fileP.etat),registre:r}}:{};}
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
  /* 4.9.5 test 6 (D-164) : les choix du panneau pour le lot (clic du mode rapide, règle « grappe de différés »), lus ICI, au
   * démarrage, dans storage.local, et figés dans le scope : un changement pendant le lot n'attend que le lot suivant. Ce que le
   * panneau envoie dans `start` ne compte pas : seule la valeur gardée fait foi. Consignés par `batch-started` et l'export.
   * Au défaut (« Comme avant », règle coupée), le scope n'en porte rien : il est celui d'avant, à l'octet près (il voyage jusqu'à
   * la page) ; un champ absent se lit comme le défaut. */
  delete startArgs.clicHumain;delete startArgs.regleGrappeDifferes;
  /* 4.9.5.13 (test 13) : profil du lot figé dans le scope ; 'actuel' : le scope n'en porte rien (celui de la 4.9.5.9, à l'octet près). */
  /* Sans les modules L1 (service worker incomplet), le lot est celui de la 4.9.5.9 : aucun profil dans le scope. */
  delete startArgs.lotProfil;if(geometryEngine===GCV1_ENGINE&&globalThis.BananeGcv2L1&&globalThis.BananeGcv2ParametresL1){const pr=await profilDuLot();if(pr==='L1'||pr==='L1-s')startArgs.lotProfil=pr;else if(pr==='L1-se')startArgs.lotProfil=globalThis.BananeGcv2L1e?'L1-se':'L1-s';}
  {const c=await choixDuLot();if(c.clicHumain!=='tel-quel')startArgs.clicHumain=c.clicHumain;if(c.regleGrappeDifferes)startArgs.regleGrappeDifferes=true;}
  /* 5.0 (D-171, D-173) : relecture après le lot, lue ICI et figée dans le scope ; coupée (défaut) : le scope n'en porte rien. */
  delete startArgs.relecture;{const m=await relectureChoix();if(m!=='coupee')startArgs.relecture=m;}
  /* CH-017 (D-261) : un lot démarré par la file de parties porte la file dans son scope, et la relecture avec correction (toujours) ; hors file,
   * le scope n'en porte rien (celui d'avant, à l'octet près). */
  delete startArgs.fileParties;if(fileP.demarrage){startArgs.fileParties={...fileP.demarrage};startArgs.relecture='corriger';}
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
async function dispatch(m){await ready;await passeDiffReveil;   /* T21d : une passe gardée est reprise (ou close) avant toute action du panneau */
 const {action,args={}}=m;
 /* CH-017 : file de parties (éteinte : ces actions restent inconnues, comme avant). Pendant la file, « Arrêter » arrête la file et ce qui
  * travaille ; « Démarrer » à la main est refusé (le lot suivant appartient à la file). */
 if(FILE_ACTIONS.has(action)&&fileReglage())return fileDispatch(action,args);
 if(action==='stop'&&fileActive()){await fileEvenement({type:'arreter',origine:'stop'});return engine.view();}
 if(action==='start'&&fileActive()&&!fileP.demarrage)throw Error('File de parties en cours : le lot suivant part de lui-même. Clique sur « Arrêter la file » pour reprendre la main.');
 /* 5.0 (D-171, revue de la relecture) : relecture après le lot. Pendant sa préparation et pendant la passe, rien qui agisse dans ESV ou
  * sur le lot ne part du panneau ; « Arrêter » (du lot) arrête la relecture (W11). */
 if(action==='stop'&&passeActive()){relectureArreter();return engine.view();}
 /* Test 17 : tant que la deuxième passe écrit dans ESV, rien d'autre n'en part du panneau ; « Arrêter » l'arrête avant le cut suivant. */
 if(passeDiff.ecriture){if(action==='stop'){passeDiff.ecriture.arret=true;return engine.view();}
  if(RELECTURE_BLOQUE.has(action))throw Error(`Deuxième passe des différés en cours (${passeDiff.vue.ecrites} cut posé sur ${passeDiff.vue.demandees}) : clique sur « Arrêter » et attends qu’elle s’arrête.`);}
 if(passeActive()&&RELECTURE_BLOQUE.has(action)&&!(relecture.passe.etat==='en-pause'&&['connect','relecture-reprendre'].includes(action)))
  throw Error(relecture.passe.etat==='en-pause'?'Relecture en pause : clique sur « Reprendre la relecture » ou « Arrêter la relecture » avant cette action.'
   :relecture.passe.etat==='preparation'?'Relecture après le lot en préparation (elle part dans un instant) : attends-la, ou clique sur « Arrêter la relecture ».'
   :`Relecture après le lot en cours (${relecture.passe.faits} sur ${relecture.passe.total}) : clique sur « Arrêter la relecture » et attends qu’elle s’arrête.`);
 if(RELECTURE_INTENTION_BLOQUE.has(action)){const l=await relectureIntentions();
  if(l.length)throw Error(`Une correction ${l[0].origine==='passe'?'de la deuxième passe':'de la relecture'} a été interrompue au cut ${l[0].cut} (partie ${l[0].part}) : contrôle ce cut dans ESV, puis clique sur « J’ai contrôlé le cut ${l[0].cut} » dans la carte Relecture.`);}
 if(action==='passe-differes-ecrire')return passeDiffEcrireDemande();
 if(action==='relecture-choix-etat')return {mode:await relectureChoix()};
 if(action==='relecture-choix')return relectureChoisir(args);
 if(action==='relecture-etat')return relectureEtat();
 if(action==='relecture-arreter')return relectureArreter();
 if(action==='relecture-acquitter')return relectureAcquitter(args);
 if(action==='relecture-pause')return relectureMettreEnPause();
 if(action==='relecture-reprendre')return relectureReprendre();
 if(action==='relecture-pause-reglage')return relectureRepriseReglageChoisir(args);
 if(action==='goto-cut-cancel'){const r=retourCutEnCours;if(!r)return {cancelRequested:false,reason:'aucun-retour'};
  await adapter.cancel({operationId:r.operationId,reason:'goto-cut-cancel'}).catch(()=>{});return {cancelRequested:true,operationId:r.operationId};}
 if(retourCutEnCours&&PENDANT_RETOUR.has(action))throw Error('Retour à un cut en cours : attends son résultat, ou annule-le.');
 if(action==='open-window'){await openPanel(args.window);return {opened:true};}
 if(action==='liste-instantanes'||action==='liste-resume')return listeAction(action,args);
 /* 5.0 : verts à contrôler, lecture seule (aucune action dans ESV), permise à tout moment. */
 if(action==='verts-a-controler')return vertsAControler(args);
 if(action==='fiches-depart'){const EC=cacheExport();return {fiches:EC?await EC.lireDeparts(chrome.storage.local):[]};}
 if(action==='export-cache-info'){const EC=cacheExport(),c=contexteVidage(),refus=EC?EC.refus(c,{auto:args?.auto===true}):'module absent';
  /* Test 4 : ce que la capture ouverte retient (identifiants), pour que la confirmation le dise et ne le compte pas parmi ce qui sera supprimé. */
  return {refus,reprenable:EC?EC.reprenable(c):false,marqueur:EC?await EC.lire(chrome.storage.local):null,capture:refus===null?await captureOuverteAGarder():null};}
 if(action==='export-cache-clear')return viderCacheExport(args);
 if(action==='bornes-partie'){const t=await finsParties(),f=t[Number(args?.part)];return f?{part:Number(args.part),last:f.last,source:f.source,at:f.at}:null;}
 /* 4.9.5 test 6 (D-164) : choix du panneau pour le PROCHAIN lot ; permis à tout moment, le lot en cours garde les siens. */
 if(action==='choix-lot-etat')return choixDuLot();
 if(action==='choix-lot')return choixLot(args);
 if(action==='lot-profil-etat')return {profil:await profilDuLot()};
 if(action==='lot-profil')return profilChoisir(args);
 /* RM-11 : choix de la raison de la correction pour la PROCHAINE séance d'Écho ; une raison tapée au panneau (secours des touches) est consignée par la séance. */
 if(action==='raison-choix-etat')return choixRaisonDuPanneau();
 if(action==='raison-choix')return raisonChoisir(args);
 if(action==='native-raison')return native.raisonPanneau(args);
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
  await engine.observe();connexionStatut('ready',null,tab.id);await engine.save();return engine.view();}
 /* T20a (D-243) : « Reconnecter » ré-équipe l'onglet choisi (comme après un F5) ; aucune commande ESV. Mêmes refus que « Connecter ». */
 if(action==='reconnect'){
  if(selectedTab===null){connexionStatut('no-tab','Aucun onglet ESV choisi.',null);throw Error('Aucun onglet ESV choisi : choisis-le dans « Connexion à ESV ».');}
  if(engine.busy||engine.task||manual.running()||native.running())throw Error('Termine l’activité en cours avant de reconnecter ESV.');
  if(repriseEnCours)throw Error('Reprise du lot en cours : attends qu’elle se termine.');
  const tab=selectedTab;connexionStatut('reconnecting','Reconnexion à la page ESV demandée.',tab);
  try{await equiperOnglet(tab);}catch(e){connexionStatut('unavailable',e?.message,tab);throw e;}
  try{await engine.observe();}catch{/* page équipée ; la lecture de la vue reprendra */}
  await engine.save();return engine.view();}
 if(action==='view'){await correctionVerifierFin().catch(()=>{});if(selectedTab===null&&engine.s.connection?.status!=='no-tab')connexionStatut('no-tab','Aucun onglet ESV choisi.',null);
  pollCurrent();const v=vuePanneau();return {...v,assistGauge:assistGauge(v)};}
 // V4.6.0 : une reprise manuelle est un lot actif. Le mode Natif ne prend pas sa place.
 /* CH-028 : la correction dans Orbite (avant le refus général « Écho est actif » : la correction EST une séance Écho). */
 if(action==='correction-liste')return correctionListe(args);
 if(action==='correction-demarrer')return correctionDemarrer();
 if(action==='correction-ouvrir')return correctionOuvrir(args);
 if(action==='correction-terminer')return correctionTerminer({raison:'operateur'});
 if(action==='correction-fermer')return correctionFermer();
 if(action==='native-start')return demarrerEcho();
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
 if(action==='native-export-ack')return native.ackExported(args?.ids||[],{confirmes:Array.isArray(args?.confirmed)?args.confirmed:[],fichiers:args?.fichiers,final:args?.final===true});
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
 if(action==='relecture-lancer')return relectureLancer({auto:false});
 if(action==='pause')return coordinateurLot.transition('pause',async()=>{await engine.pause();return engine.view();});
 if(action==='stop')return coordinateurLot.transition('arret',async()=>{const b=engine.s.batch,ouvert=!!b&&!OBS_CLOS.includes(b.state),fin=engine.stop();
  if(ouvert&&engine.s.batch===b)marquerFinLot(b,'arret-manuel');await fin;return engine.view();});
 if(action==='resume')return coordinateurLot.transition('reprise',async()=>{if(repriseEnCours)throw Error('Reprise déjà en cours : patiente.');
  if(lotTermine(engine.s.batch)){engine.s.notice=`Lot déjà terminé : ${engine.s.batch.stoppedAtEnd.reason==='navigation-other-part-after-defer'?'fin de la partie retenue':engine.s.batch.stoppedAtEnd.reason==='partie-sans-rouge'?'partie sans cut rouge':engine.s.batch.stoppedAtEnd.reason==='depart-sur-vert'?'départ sur un cut vert, rien à traiter devant':'dernier cut de la partie atteint'} (cut ${engine.s.batch.stoppedAtEnd.cut}). Rien n’est rejoué ; pour continuer, clique sur « Nouveau lot ».`;await engine.save();return engine.view();}
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
 const timingMeta={...(exporte?await fileExport():{}),...(v1TimingExport?{v1TimingExport}:{}),...(periode?{exportPeriod:periode.exportPeriod}:{}),...(periode?.fichesDepart?.length?{fichesDepart:periode.fichesDepart}:{}),...(periode?.finsLot?.length?{finsLot:periode.finsLot}:{})};
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
 if(m.kind==='clic-hors-vue'&&sender.tab?.id===selectedTab&&esvURL(sender.url||sender.tab?.url)){rangerClicHorsVue(m.releve);return;}
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
    const progression=()=>engine.event('adapter-progress',{requestId:m.requestId,action:m.action,elapsedMs:m.elapsedMs,acknowledged:m.acknowledged,lastStage:m.lastStage,lastDetail:m.lastDetail});
    /* 5.0 (D-147) : chaque geste de vue d'Ariane, et la remise de la vue, consignés à part (les autres étapes : comme avant). */
    if(m.lastStage==='vue-geste'||m.lastStage==='vue-remise')return engine.event('deplacer-vue-geste',{action:m.action,etape:m.lastStage,...(m.lastDetail&&typeof m.lastDetail==='object'?m.lastDetail:{}),
      identity:engine.s.before?.identity?{part:engine.s.before.identity.part??null,cut:engine.s.before.identity.cut??null}:null}).catch(()=>{}).then(progression);
    return progression();}).then(()=>respond({ok:true}),e=>respond({error:e.message}));return true;
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
