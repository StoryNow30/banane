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
 'src/gcv1-export.js','src/engine.js','src/storage.js','src/manual-session.js','src/native-session.js');
const store=new BananeStorage3();let selectedTab=null,engine,manual,native,pollPromise=null,timing=null;
const VERSION=globalThis.BananeCore3?.VERSION||'4.9.0.1',VERSION_NAME=globalThis.BananeCore3?.VERSION_NAME||'4.9.0 test 1';
/* 4.7.21 — CERVEAU DE PLACEMENT ACTIF PAR DÉFAUT (direction, 26/09 : « tout
 * cela, je l'active à chaque fois »). Son état vivait en mémoire du service
 * worker et repartait éteint à chaque redémarrage de Chrome. Dans un lot
 * Pilote GCV1, il ne touche pas les positions posées (la sélection est celle
 * de GCV1) : il agit sur la proposition V4.6 consignée pour comparaison. Les
 * sélections sont autorisées en mode « Tenter », que le lot GCV1 force déjà. */
BananeGeometryBrain.configure({actif:true,autoriserSelectionSansPause:true});
const PAGE_FILES=['vendor/capture-core.js','vendor/lidar.js','src/core.js','src/settings.js','src/lod-signature.js','src/merge-clouds.js','src/native-lidar.js','src/native-page.js','src/adapter-page.js'];
const GCV1_ENGINE='geometry-candidate-v1',V46_ENGINE='v4.6';
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
const bandeauVisible=()=>bandeau.on&&panelPorts.size+panelWindows.size>0&&bandeau.text?{text:bandeau.text,ton:bandeau.ton}:null;
function launcherState(){const ids=new Set(panelWindows.keys());
 for(const [port,info] of panelPorts)ids.add(info.windowId??port);
 return {visible:ids.size===0,openWindows:ids.size,bandeau:ids.size?bandeauVisible():null};}
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
 const reply=await chrome.tabs.sendMessage(tabId,{kind:'page-command',action,args,...(trace?{traceId:trace.id}:{})}).catch(e=>{
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
async function closeAtExit(reason,last,next,{annonce=null,surNavigation=true,finSansPose=false,dernier=null}={}){const b=engine.s.batch;last=last??b.activeIdentity?.cut;
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
adapter.validateAndNext=async(...args)=>{
 const dernier=dernierCutCertain(args[0]?.cut);if(dernier)return validerSurPlace(args[0],dernier,args[1]);
 const evidence=await validateInESV(...args);
 const next=evidence?.nextIdentity,exit=lotExitOf(next);
 if(exit)await closeAtExit(exit==='part'?'navigation-other-part':'navigation-beyond-end',engine.s.before?.identity?.cut,next);
 return evidence;};
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
 if(ping?.intrusion)throw definitif(`Ariane ${VERSION_NAME} en sécurité : une autre Ariane a tenté de commander cet onglet (« ${ping.intrusion.action} »). Désactive l’autre Ariane dans edge://extensions, puis F5 sur ESV, puis Reprendre.`);}
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
 await engine.save();return true;}
async function reprendreLot(){assertPilotContract(engine.s.batch?.scope);
 const b0=engine.s.batch;
 if(departOuvert(b0))return finApresDiffere(b0);
 const lot=engine.s.batch?.id,etatDepart=engine.s.batch?.state;
 const garde=()=>engine.s.batch?.id===lot&&engine.s.batch.state===etatDepart;
 /* 4.8.0 : page ESV rafraîchie (F5) depuis la pause : retour au cut, lot rattaché. */
 const {etat}=await retablirApresRechargement(garde);
 /* Relecture 4.7.12, constat I3 : « Reprendre » sur le cut encore affiché et
  * archivé recapturait ce cut, que le moteur refuse d'écrire ; le lot passait
  * en ERROR, non reprenable, et perdait ses appuis. La reprise est refusée
  * avant de toucher à l'étape du lot : il reste arrêté, reprenable dès le cut
  * suivant. */
 const affiche=etat??await adapter.state().catch(()=>null);
 if(affiche?.identity)try{engine.writable(affiche.identity);}
  catch{throw Error(`Cut ${affiche.identity.cut} : résultat incertain archivé, Ariane n’y écrit plus. Passe au cut suivant dans ESV, puis clique sur Reprendre.`);}
 /* KI-052 : « Archiver le résultat interrompu » arrête le lot en laissant
  * l'étape « apply » et efface la proposition ; reprendre relançait la boucle
  * sur une proposition absente. Sans proposition, la reprise recommence le
  * cut par sa capture. */
 if(engine.s.batch?.step==='apply'&&!engine.s.proposal&&!engine.s.intent&&!engine.s.reconcileRequired)engine.s.batch.step='capture';
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
 if(stopAtLotEnd())await engine.event('batch-stopped-at-end',{identity:engine.s.before?.identity??null,applied:true});return result;};
adapter.capabilities={serverConfirmation:false};
const ready=(async()=>{selectedTab=(await chrome.storage.local.get('banane3Tab')).banane3Tab??null;engine=new BananeEngine3.Engine(adapter,store);
 /* 4.8.0 (D-058, option 1 de la direction) : une lecture instable met le lot en
  * pause (moteur épinglé). Le remède est de rafraîchir ESV : on le dit ; après
  * F5, « Reprendre » revient seul au cut du lot (retablirApresRechargement). */
 /* 4.8.6 (KI-069) : différé sur le dernier cut de la partie : aucune commande « suivant »
  * (le moteur épinglé attendrait un changement de cut) ; le lot se ferme ici, rien n'est envoyé à ESV. */
 const differer=engine.deferUnresolved.bind(engine);
 engine.deferUnresolved=async(now,b,eligibility)=>{const d=dernierCutCertain(now?.identity?.cut);if(!d)return differer(now,b,eligibility);
   await engine.event('dernier-cut-differe',{identity:null,part:d.part,cut:d.cut,total:d.total,motif:d.motif,commande:null});
   b.interrupted=Array.isArray(b.interrupted)?b.interrupted:[];
   b.interrupted.push({identity:globalThis.BananeCore3.completeIdentity(now.identity),status:'DEFER_DERNIER_CUT_SANS_ENVOI',commandInvoked:false,total:d.total});
   await closeAtExit('dernier-cut-differe',d.cut,null,{dernier:d});await engine.save();
   return {status:'DEFER_DERNIER_CUT_SANS_ENVOI'};};
 const evenement=engine.event.bind(engine);
 engine.event=async(type,...rest)=>{const r=await evenement(type,...rest);
   if(type==='defer-navigation-uncertain')await departApresDiffere(rest[0]);
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
   if(pilotScope&&proposal&&stopAtLotEnd(proposal))await engine.event('batch-stopped-at-end',{identity:engine.s.before?.identity??null,applied:false});
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
 const decision=L.decideCut({capture:{identity,rails:capture.rails,pointsSceneRelative:capture.pointsSceneRelative,
   visibleByClipBoxes:capture.visibleByClipBoxes},science:{rails:shadow.rails,summary:shadow.summary},anchors:state.anchors,Shadow:globalThis.BananeGCV1Shadow});
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
chrome.tabs.onRemoved?.addListener(id=>{for(const [port,info] of panelPorts)if(info.tabId===id)panelPorts.delete(port);void syncLauncher().catch(()=>{});});
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
 rest.finDePartieProbable=departOuvert(engine.s.batch);if(typeof rest.notice==='string')rest.notice=vocabulaire(rest.notice);
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
 /* Pendant une reprise (retour au cut après F5), la vue ne lit pas ESV. */
 if(pollPromise||engine.busy||engine.task||repriseEnCours||manual?.active()||native?.active()||selectedTab===null)return;
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
async function dispatch(m){await ready;const {action,args={}}=m;
 if(action==='open-window'){await openPanel(args.window);return {opened:true};}
 if(action==='bornes-partie'){const t=await finsParties(),f=t[Number(args?.part)];return f?{part:Number(args.part),last:f.last,source:f.source,at:f.at}:null;}
 if(action==='bandeau-etat'){const r=await chrome.storage.local.get('banane4Bandeau');bandeau.on=r?.banane4Bandeau===true;return {on:bandeau.on};}
 if(action==='bandeau'){bandeau={on:args.on===true,text:String(args.text||'').slice(0,200),ton:['vert','ambre','rouge'].includes(args.ton)?args.ton:''};
  await chrome.storage.local.set({banane4Bandeau:bandeau.on});await syncLauncher();return {on:bandeau.on};}
 if(action==='list-tabs')return (await chrome.tabs.query({url:'https://esv.lidar.altametris.xyz/rails_validation/*'})).map(t=>({id:t.id,title:t.title}));
 if(action==='connect'){
  if(engine.busy||engine.task||manual.running()||native.running())throw Error('Termine l’activité en cours avant de changer d’onglet.');
  if(repriseEnCours)throw Error('Reprise du lot en cours : attends qu’elle se termine.');
  const tab=await chrome.tabs.get(Number(args.tabId));if(!esvURL(tab.url))throw Error('Onglet ESV invalide.');
  // Only extension-origin UI requests can inject the fixed, bundled adapter.
  await equiperOnglet(tab.id);selectedTab=tab.id;await chrome.storage.local.set({banane3Tab:selectedTab});
  await engine.observe();engine.s.connection={status:'ready',observedAt:new Date().toISOString()};await engine.save();return engine.view();}
 if(action==='view'){pollCurrent();const v=vuePanneau();return {...v,assistGauge:assistGauge(v)};}
 // V4.6.0 : une reprise manuelle est un lot actif. Le mode Natif ne prend pas sa place.
 if(action==='native-start'){engine.assertBatchContextFree('démarrer Écho');return native.start();}
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
 if(action==='pause'){await engine.pause();return engine.view();}if(action==='stop'){await engine.stop();return engine.view();}
 if(action==='resume'){if(repriseEnCours)throw Error('Reprise déjà en cours : patiente.');
  repriseEnCours=true;try{await reprendreLot();}finally{repriseEnCours=false;}return engine.view();}
 /* 4.7.18 (KI-055, chantier 5) : « Réessayer ce cut » relit une capture. Si
  * l'opérateur a déplacé les rails pendant la pause, cette capture serait SA
  * pose, qui entrerait dans le moteur et la décision sur le lot (cahier §10,
  * §14 I) : refusé, comme « Reprendre » (« Rails modifiés depuis la lecture
  * interrompue »). `src/engine.js` est épinglé : le contrôle vit ici. */
 if(action==='retry'){const ref=engine.s.before?.rails;
   if(ref){const now=await engine.adapter.state();
     if(!globalThis.BananeCore3.equalPoses(ref,now.rails))throw Error('Rails modifiés pendant la pause : « Réessayer » analyserait ta pose, il est refusé. Choisis Reprise manuelle ou SKIP explicite.');}
   await engine.retryPaused();return engine.view();}
 if(action==='manual-takeover'){await engine.manualTakeover();return engine.view();}
 // V4.6.0 : l'opérateur déclare avoir traité le cut lui-même ; le lot reprend au suivant.
 if(action==='manual-completion'){await engine.manualCompletion();return engine.view();}
 if(action==='explicit-skip'){await engine.skipPaused();return engine.view();}
 if(action==='start'){
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
  await engine.startBatch(startArgs);return engine.view();}
 if(action==='cloud')return store.getCloud(args.id);
 /* Métadonnées d'export sans événements ni enregistrements : le panneau les lit
  * directement dans IndexedDB (4.7.19, KI-059). `stateOmits` dit ce qui manque
  * à l'état, rangé ailleurs dans le même fichier. */
 const v1TimingExport=['journal-meta','dataset-meta','journal','dataset'].includes(action)?await flushMesure():null;
 const timingMeta=v1TimingExport?{v1TimingExport}:{};
 if(action==='journal-meta')return {...timingMeta,format:'banane-test-journal-v4',version:VERSION,state:exportState(),stateOmits:['records','incomplete'],closureSummary:engine.closureSummary()};
 if(action==='dataset-meta')return {...timingMeta,format:'banane-test-dataset-v4',version:VERSION,exportedAt:new Date().toISOString(),state:exportState(),stateOmits:['records','incomplete'],closureSummary:engine.closureSummary(),cloudIds:await store.keys('clouds')};
 if(action==='journal')return {...timingMeta,format:'banane-test-journal-v4',version:VERSION,state:engine.view(),events:await store.all('events'),records:await store.all('records'),closureSummary:engine.closureSummary()};
 if(action==='dataset')return {...timingMeta,format:'banane-test-dataset-v4',version:VERSION,exportedAt:new Date().toISOString(),state:engine.view(),events:await store.all('events'),records:await store.all('records'),closureSummary:engine.closureSummary(),cloudIds:await store.keys('clouds')};
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
  else if(action==='close-uncertain')result=await engine.closeUncertain();
  else if(action==='cancel-before'){await engine.archivePending('operator-cancelled');result=engine.view();}
  else if(action==='references')result=await engine.exportReferences();
  else throw Error('Commande inconnue.');return result;
 });
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 if(m.kind==='launcher-status'&&sender.tab?.id&&esvURL(sender.url||sender.tab?.url)){
  respond(launcherState());return;}
 if(m.kind==='heartbeat'){respond({ok:true});return;}
 if(m.kind==='esv-releve'&&sender.tab?.id===selectedTab&&esvURL(sender.url||sender.tab?.url)){rangerReleve(m.releve);return;}
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
  async e=>{const message=vocabulaire(e.message);if(engine){engine.s.notice=message;await engine.save().catch(()=>{});}respond({error:message});});return true;
});
