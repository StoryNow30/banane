'use strict';
/* 5.0 (D-170 à D-173) — montage des essais de la RELECTURE APRÈS LE LOT : service worker réel en VM, moteur, GCV1 et décision réels,
 * ESV simulé, chrome.storage.local en mémoire (le panneau y garde le choix « relecture »). Données synthétiques.
 * Lot de 111 à 113 : 111 et 112 posés et validés, 113 (dernier cut du lot) a sa pose d'ESV à 230 mm de la voie (cible hors de la vue :
 * non résolu) : le lot s'arrête au dernier cut sans commande ni navigation (fin naturelle, sans pose en attente). La relecture choisit alors la grappe 108–116 (marge 3) : 108, 109, 110,
 * 113 (différé), 114, 115, 116 relus ; 111 et 112 traversés. `decalages` : {cut: mm} pose d'ESV de ce cut décalée en travers (les
 * deux rails), pour que la pose calculée s'en écarte. L'ESV simulé tient la pose de chaque cut : ce qu'Ariane valide y reste.
 * `ecriture` : ce que l'observateur passif voit après une validation (Maj+Espace : 'valid' 204 par défaut, un statut, 'autre' : la ligne
 * écrite avec un autre statut que « valid », ou null : rien).
 * Revue de la relecture (D-175) : l'ESV simulé tient aussi la LISTE de la partie (statut, drapeau opérateur, « vu ») que la page lit en
 * mémoire (`b1-voisins`), imite le « vu » qu'ESV écrit au premier affichage d'un cut (PUT {SeenByOperator:true}), et valide par
 * Maj+Espace (`validerMajEspace`) : comme le vrai ESV (D-179, l'opérateur), sur un vert valide SUR PLACE : écriture « valid » de la ligne, ESV reste
 * sur le même cut (`majEspaceVers(cut)` : l'ancienne supposition « cut + 1 », ou un autre cut, là où un essai en a besoin). */
const {production,memoire}=require('./perf-production.cjs'),{SimulatedESV,base,K}=require('../fixtures.cjs');
const S=require('../../src/settings.js'),O=require('../../src/continuity-observer.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const SIDES=['left','right'],CLE='banane50Relecture';
/* Rails décalés de `mm` en travers (et `vert` mm en hauteur) dans le repère profil de chaque rail. */
const decaleDe=(rails,mm,vert=0)=>Object.fromEntries(SIDES.map(side=>{const r=rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]+vert/1000]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));
const decale=mm=>decaleDe(base.rails,mm);
/* Caméra d'ESV centrée sur chaque rail (comme tests/helpers/deplacer-vue-lot.cjs) : la commande du lot vérifie que la cible est dans la vue. */
function camerasParRail(rails){const c=base.camera,p0=c.cameraToSceneRelative.slice(12,15);
  return SIDES.map(s=>{const p=rails[s].positionSceneRelative,M=c.cameraToSceneRelative.slice();
    const ax=[M[0],M[1],M[2]],ay=[M[4],M[5],M[6]],d=p.map((v,i)=>v-p0[i]),u=ax[0]*d[0]+ax[1]*d[1]+ax[2]*d[2],w=ay[0]*d[0]+ay[1]*d[1]+ay[2]*d[2];
    for(let i=0;i<3;i++)M[12+i]=p0[i]+ax[i]*u+ay[i]*w;
    return {camera:{type:'OrthographicCamera',cameraToSceneRelative:M,sceneRelativeToCamera:K.C.inverse(M),projection:[5,0,0,0, 0,5*800/600,0,0, 0,0,-1e-4,0, 0,0,0,1],viewport:{left:0,top:0,width:800,height:600}}};});}
class EsvRelecture extends SimulatedESV{
 constructor({decalages={},loin=[113]}={}){super();this.decalages=decalages;this.loin=new Set(loin);this.poses=new Map();this.allees=[];this.enPlace=[];this.applyArgs=[];
  this.ecriture='valid';this.surValidation=null;this.refusApply=null;this.offsetApply=false;this.apresLot=false;this.sansPoints=new Set();this.panneCapture=new Set();
  /* Liste d'ESV : nombre de cuts de la partie (compteur), cuts rouges, lignes forcées {cut: {s, t, v}}, cuts déjà vus ; Maj+Espace. */
  this.total=200;this.rouges=new Set(loin);this.lignes={};this.vus=new Set([111,112,113]);this.vusListe=new Set(this.vus);this.listeIllisible=false;this.lecturesListe=[];
  this.majEspace=[];this.majEspaceVers=null;this.surVu=null;this.imiterVu=true;this.bordsListe=false;this.refusAller=null;}
 /* Pose d'ESV d'un cut : celle qu'Ariane ou la passe y a validée ; sinon, après le lot, un vert juste (la pose que le lot a validée au
  * cut 111, celle du moteur sur ce nuage), décalé de `decalages[cut]` mm en travers (nombre) ou [travers, hauteur] ; avant le lot, la
  * pose de la fixture. */
 railsDe(cut){if(this.poses.has(cut))return K.clone(this.poses.get(cut));if(this.loin.has(cut))return K.clone(decale(230));
  const juste=this.apresLot?this.poses.get(111):null,d=this.decalages[cut],[mm,vert]=Array.isArray(d)?d:[Number.isFinite(d)?d:0,0];
  return juste?decaleDe(juste,mm,vert):K.clone(base.rails);}
 ajuster(){this.rails=this.railsDe(this.identity.cut);}
 /* Affichage d'un cut : ESV écrit « vu » la première fois (imité après le lot). */
 afficher(cut){if(this.vus.has(cut))return;this.vus.add(cut);if(!this.apresLot||!this.imiterVu||!this.surVu){this.vusListe.add(cut);return;}
  /* Comme ESV : l'écriture « vu » part un peu après l'arrivée ; la ligne de la liste passe à « vu » avec elle. */
  setTimeout(()=>{this.vusListe.add(cut);this.surVu(cut);},40);}
 /* Ligne de la liste d'ESV d'un cut : forcée, sinon validée (opérateur) si Ariane ou la passe l'a validée, rouge si laissée, vert d'ESV sinon. */
 ligne(i){const f=this.lignes[i];if(f)return {i,s:f.s,t:f.t===true,v:f.v??this.vusListe.has(i),f:false,e:null};
  if(this.poses.has(i))return {i,s:'valid',t:true,v:true,f:true,e:null};
  return {i,s:this.rouges.has(i)?'invalid':'valid',t:false,v:this.vusListe.has(i),f:false,e:null};}
 voisins(m){this.lecturesListe.push(m.cut);if(this.listeIllisible)return {ok:false,reason:'coupe'};const rows=[];
  for(let i=Math.max(0,m.cut-m.fenetre);i<=Math.min(this.total-1,m.cut+m.fenetre);i++)rows.push(this.ligne(i));
  return {ok:true,table:{lignes:this.total,pages:1,fraiches:0,debut:true,rompue:false,tronquee:false,tables:1},geo:null,rows};}
 /* La table entière de la liste (`liste-instantane` : statut et drapeaux de chaque ligne, comme l'observateur de la page). */
 tableListe(){if(this.listeIllisible)return {ok:false,reason:'coupe'};const st=[],fl=[],ed=[];
  for(let i=0;i<this.total;i++){const l=this.ligne(i);st.push({valid:0,invalid:1,skipped:2}[l.s]??3);fl.push((l.t?1:0)|(l.v?2:0));
   /* Bords (1e-4 m) : la pose d'ESV du cut, pour les lignes valides seulement si `bordsListe`. */
   const r=this.bordsListe&&l.s==='valid'?this.railsDe(i):null;ed.push(...(r?[...r.left.positionSceneRelative,...r.right.positionSceneRelative].map(v=>Math.round(v*1e4)):[null,null,null,null,null,null]));}
  return {ok:true,tables:[{key:'table-essai',debut:true,rompue:false,tronquee:false,st,fl,ed}]};}
 async ping(){return {...await super.ping(),label:{pageId:this.identity.pageId,part:this.identity.part,cut:this.identity.cut}};}
 async capture(expected){const d=await super.capture(expected);d.viewCaptures=camerasParRail(d.rails);
  if(this.sansPoints?.has(this.identity.cut)){d.pointsSceneRelative=[];d.visibleByClipBoxes=[];d.quality={...d.quality,retained:0,perRail:{left:0,right:0}};}
  if(this.panneCapture?.has(this.identity.cut))throw Error('Adaptateur ESV sans réponse (simulé).');return d;}
 async apply(before,proposals,...reste){this.applyArgs.push({cut:this.identity.cut,reste:K.clone(reste)});
  if(this.refusApply&&this.refusApply(this.identity.cut))throw Error('Position proposée hors de la vue (simulé).');
  const r=await super.apply(before,proposals);if(this.offsetApply){this.rails.left.positionSceneRelative[1]+=.01;this.rails.left.railLocalToSceneRelative[13]+=.01;return this.state();}return r;}
 async next(){await super.next();this.ajuster();return this.state();}
 async nextWithoutDecision(...a){const r=await super.nextWithoutDecision(...a);this.ajuster();return r;}
 async validateAndNext(...a){this.poses.set(this.identity.cut,K.clone(this.rails));return super.validateAndNext(...a);}
 /* Retour à un cut : la page confirme le cut atteint (chemin « pas à pas » ou « événement »), et les bornes lues au compteur. */
 async goToCut(target,options={},operationId=null){this.calls.push('goToCut');this.allees.push({cut:target.cut,chemin:options.chemin??null,operationId,t:Date.now()});
  if(this.surAller)await this.surAller(target);
  /* Refus de la page (`refusAller(cut)` → code), rendu comme la vraie page : rien n'est émis. */
  const code=this.refusAller?this.refusAller(target.cut):null;
  if(code)return {format:'ariane-goto-cut-v1',operationId,action:'GO_TO_CUT',lectureSeule:true,cible:{part:target.part,cut:target.cut},identiteAvant:{part:this.identity.part,cut:this.identity.cut},
   identiteApres:null,chemin:null,commande:'aucune',emissions:0,commandInvoked:false,resultat:'refuse',confirme:false,refusal:{code,message:`refus simulé (${code}) ; rien n’a été envoyé à ESV.`}};
  const avant={part:this.identity.part,cut:this.identity.cut},pas=options.chemin==='pas';
  if(pas){const s=target.cut>avant.cut?1:-1;for(let c=avant.cut+s;c!==target.cut+s;c+=s)this.afficher(c);}else this.afficher(target.cut);
  this.identity.cut=target.cut;this.ajuster();
  return {format:'ariane-goto-cut-v1',operationId,action:'GO_TO_CUT',lectureSeule:true,cible:{part:target.part,cut:target.cut},identiteAvant:avant,
   identiteApres:{part:this.identity.part,cut:this.identity.cut},chemin:pas?'pas-a-pas':'evenement',commande:pas?'pas-a-pas':'evenement',
   bornes:Number.isInteger(this.total)?{total:this.total,max:this.total-1,source:'compteur'}:{total:null,max:target.cut,source:'cut-connu'},
   emissions:1,commandInvoked:true,applyCommandSent:false,validationCommandSent:false,skipCommandSent:false,resultat:'confirme',confirme:true,pret:true,refusal:null};}
 /* Validation sur place (Ctrl+Entrée) : jamais employée par la passe ; consignée si elle l'était. */
 async validateInPlace(identity,scope,options){this.calls.push('validateInPlace');this.enPlace.push({cut:identity.cut,options:K.clone(options)});
  throw Error('validateInPlace n’est pas le geste de la relecture (simulé).');}
 /* Maj+Espace : ESV écrit « valid » sur la ligne (vue par l'observateur si `ecriture`) et RESTE SUR LE MÊME CUT (D-179 : l'opérateur, deux fois).
  * `majEspaceVers(cut)` rend le cut que l'ESV simulé affiche ensuite (cut + 1 : l'ancienne supposition ; un autre cut : ESV ailleurs).
  * Le simulateur échoue sur toute option inattendue. */
 async validerMajEspace(identity,scope,options){this.calls.push('validerMajEspace');
  if(options!==undefined&&!(options&&typeof options==='object'&&!Object.keys(options).length))throw Error('validerMajEspace : option inattendue (simulé) : '+JSON.stringify(options));
  if(!scope||scope.part!==this.identity.part)throw Error('validerMajEspace : partie du lot absente ou différente (simulé).');
  const cut=identity.cut;if(cut!==this.identity.cut)throw Error('Maj+Espace refusé : cut différent ; rien n’a été envoyé à ESV.');
  this.majEspace.push({cut,scope:K.clone(scope)});this.poses.set(cut,K.clone(this.rails));
  const vers=this.majEspaceVers?this.majEspaceVers(cut):cut,bouge=Number.isInteger(vers)&&vers!==cut;
  if(bouge){this.afficher(vers);this.identity.cut=vers;this.ajuster();}
  if(this.surValidation)await this.surValidation(cut,this.ecriture);
  return {format:'banane-maj-espace-v1',operatorDecision:'VALIDATE',command:'maj-espace',commandSent:true,serverConfirmed:false,
   beforeNavigationIdentity:{...identity},navigationObserved:bouge,nextIdentity:bouge?{pageId:this.identity.pageId,part:this.identity.part,cut:vers}:null,nextReady:bouge?true:null};}
}
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
/* `mode` : choix gardé ('coupee', 'ombre', 'corriger' ; null : rien de gardé) ; `reglagesProposes` : contenu du fichier proposé servi
 * par `fetch` (absent : défaut provisoire) ; `relecture` : réglages de rythme de l'essai. */
/* `decisions` : {cut: mm} cuts hors du lot dont la décision est remplacée par une reprise depuis la voie (étage « window », sans appui :
 * la chaîne de la passe part vide, revue, correction 8) à `mm` mm en travers de la pose d'ESV, les deux rails ensemble ([travers gauche, travers droit] : chaque rail) : le moteur
 * de la fixture ne retrouve pas son rail quand la pose d'ESV a bougé (sa boîte de découpe est celle de la fixture) ; ce remplacement
 * isole le chemin de la passe (navigation, règle, pose, validation, preuve). Le reste du calcul est réel. */
/* `calculReel` (faux par défaut) : hors du lot, la science du moteur est celle de la fixture, calculée une fois par processus, et la
 * décision des cuts sans remplacement est un différé immédiat (« essai-sans-calcul ») : la passe dure alors quelques dizaines de ms par
 * cut au lieu de 1 à 4 s (le délai d'un essai est de 20 s). Vrai : moteur et décision réels sur chaque cut relu. */
let scienceFixture=null;
async function lotRelecture({mode='ombre',loin=[113],decalages={},decisions={},calculReel=false,ecartementPartie=undefined,reglagesProposes=null,relecture={},esv=null,observateur=true,clic=null,regles=false,local:localDonne=null}={}){
 const adapter=new EsvRelecture({decalages,loin}),local=localDonne||memoire();if(mode)local.m[CLE]=mode;if(clic)local.m.banane50ClicHumain=clic;
 const b=production({adapter,local});b.local=local;
 /* Test 25 (D-268) : déplacement de la vue livré allumé ; coupé dans ce montage qui compare aux commandes de la base. */
 b.ctx.BananeSettings={...b.ctx.BananeSettings,voiePrediteOmbre:{...S.voiePrediteOmbre,actif:false},deplacerVue:{...S.deplacerVue,actif:false},
  observateurPassif:{...S.observateurPassif,actif:observateur},
  /* Les règles métier en ombre voient un ADV dans le nuage de la fixture (81–143) : coupées, sauf demande (`regles`). */
  ...(regles?{}:{reglesMetier:{...S.reglesMetier,ombre:false}}),relecture:{departMs:0,attenteEcritureMs:300,attenteVuMs:120,...relecture},
  /* 4.9.5.13 : profil du lot « actuel » (empreintes de la base ; le défaut livré, « L1-s », est essayé dans tests/lot-profil-*.test.cjs). */
  /* CH-019 : la garde « après un différé » est coupée : ce montage est joué par tools/parite-relecture-sw.cjs, qui compare la relecture à celle d'une
   * autre version ; la garde est couverte par ses essais dédiés (tests/garde-apres-differe-*-sw.test.cjs). */
  lot:{...S.lot,profil:'actuel',gardeApresDiffere:{...S.lot.gardeApresDiffere,actif:false}}};
 if(reglagesProposes)b.ctx.fetch=async url=>/relecture-reglages-proposes\.json$/.test(url)?{ok:true,json:async()=>structuredClone(reglagesProposes)}:{ok:false};
 /* L'écriture que l'observateur passif de la page relaierait après une validation. */
 let seq=0;adapter.surValidation=async(cut,e)=>{if(e===null)return;const t=Date.now();
  b.raw({kind:'esv-observation',observer:'obs-relecture',entries:[{kind:'write',seq:++seq,method:'PUT',status:e==='valid'||e==='autre'?204:e,outcome:e==='valid'||e==='autre'?'ok':'error',attempt:1,
   rowIndex:e==='valid'||e==='autre'?cut:null,railPairId:'ligne-'+cut,bodyKeys:12,body:{ExtractionStatus:e==='autre'?'invalid':'valid',TreatedByOperator:true},startedEpochMs:t,endedEpochMs:t+50,durationMs:50}]});};
 /* Le « vu » qu'ESV écrit lui-même au premier affichage d'un cut (corps d'un seul champ, 204). */
 adapter.surVu=cut=>{const t=Date.now();b.raw({kind:'esv-observation',observer:'obs-relecture',entries:[{kind:'write',seq:++seq,method:'PUT',status:204,outcome:'ok',attempt:1,
   rowIndex:cut,railPairId:'ligne-'+cut,bodyKeys:1,body:{SeenByOperator:true},startedEpochMs:t,endedEpochMs:t+30,durationMs:30}]});};
 /* Liste d'ESV en mémoire de la page (lecture B1 `b1-voisins`) : après le lot seulement (le lot reste celui de la base). */
 {const envoyer=b.ctx.chrome.tabs.sendMessage;b.ctx.chrome.tabs.sendMessage=async(id,m)=>m?.kind==='b1-voisins'&&adapter.apresLot?JSON.parse(JSON.stringify(adapter.voisins(m)))
  :m?.kind==='liste-instantane'&&adapter.apresLot?JSON.parse(JSON.stringify(adapter.tableListe())):envoyer(id,m);}
 const L=b.ctx.BananeLotDecision,Sh=b.ctx.BananeGCV1Shadow,dansLot=cut=>cut>=111&&cut<=113;
 if(!calculReel){b.ctx.BananeGCV1Shadow={...Sh,scientificProposeBoth(capture){if(dansLot(capture?.identity?.cut))return Sh.scientificProposeBoth(capture);
  return K.clone(scienceFixture||(scienceFixture=Sh.scientificProposeBoth(base)));}};}
 b.ctx.BananeLotDecision={...L,decideCut(args){const cut=args?.capture?.identity?.cut,d=decisions[cut];
  if(d===undefined||dansLot(cut))return calculReel||dansLot(cut)?L.decideCut(args):{version:L.DEFAULTS.version,stage:'deferred',reason:'essai-sans-calcul',anchorsUsed:[],anchor:false};
  const [g,dr]=Array.isArray(d)?d:[d,d],r=args.capture.rails,pos={left:decaleDe(r,g).left.positionSceneRelative,right:decaleDe(r,dr).right.positionSceneRelative};
  return {version:L.DEFAULTS.version,stage:'window',fromPredictionMm:Math.max(Math.abs(g),Math.abs(dr)),anchorsUsed:[],positions:pos,anchor:false};}};
 /* Médiane de l'écartement de la partie (liste d'ESV) : la fixture n'a pas de liste ; celle des verts justes de l'essai (la pose validée
  * au cut 111), donnée comme la référence de la liste « À contrôler ». `ecartementPartie:null` : aucune référence. */
 const vraisVerts=b.ctx.vertsAControler;
 b.ctx.vertsAControler=async a=>{const v=await vraisVerts(a),j=adapter.poses.get(111);
  const g=ecartementPartie!==undefined?ecartementPartie:j?L.gaugeOf({left:j.left.positionSceneRelative,right:j.right.positionSceneRelative}):null;
  return {...v,actif:true,verts:Array.isArray(v?.verts)?v.verts:[],reference:{ecartementMm:g,lignes:g===null?0:100}};};
 if(esv)esv(adapter,b);
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.ajuster();
 const n0=b.commands.length;
 await b.api('start',{part:23,start:111,end:113,...SCOPE});await b.settle();
 const lot=b.commands.slice(n0);adapter.apresLot=true;
 return {b,adapter,lot,local};
}
/* Attend la fin de la passe (planifiée à la fin du lot) : ni en préparation, ni en cours. */
const active=p=>p?.etat==='preparation'||p?.etat==='en-cours';
async function finPasse(b,ms=120000){const fin=Date.now()+ms;
 for(;;){const r=b.get('relecture');if(r.passe&&!active(r.passe)){if(r.tache)await r.tache;if(!active(b.get('relecture').passe))return b.get('relecture').passe;}
  if(r.tache&&r.passe?.etat==='en-cours')await r.tache;else await attendre(10);if(Date.now()>fin)throw Error('passe non finie');}}
const evenements=(b,type)=>b.store.events.filter(e=>e.type===type);
const neutre=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='capturedAt'?'<clock>':v).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>'));
/* Commandes qui posent, valident, passent ou écrivent : jamais en ombre. */
const ECRITURES=['apply','restore','validateAndNext','validateInPlace','validerMajEspace','skipAndNext','next','nextWithoutDecision','decisionAndNext'];
module.exports={lotRelecture,finPasse,evenements,neutre,decale,decaleDe,ECRITURES,CLE,SCOPE,S,K,attendre,EsvRelecture};
