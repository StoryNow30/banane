/* CH-111 (D-345) — TÉLÉCOMMANDE D'ARIANE SUR IPHONE, partie service worker.
 * Ariane reste sur Chrome : seule elle lit ESV et y écrit. Le téléphone affiche son état et envoie les ordres des boutons du panneau, par un
 * relais (Cloudflare Worker de l'opérateur, `telecommande/worker.js`) qui ne voit qu'un identifiant de canal et du chiffré.
 *  - Appairage : clé K de 256 bits tirée ici (WebCrypto), donnée au téléphone par un QR code ou un code à taper (jamais par le relais).
 *    HKDF-SHA256(K) donne la clé AES-GCM et l'identifiant du canal. Tout ce qui passe (état, ordres, accusés) est chiffré et authentifié ;
 *    données associées = canal + sens (« a>t » Ariane vers téléphone, « t>a » l'inverse) : un message renvoyé dans l'autre sens est refusé.
 *  - Anti-rejeu : chaque ordre porte un numéro strictement croissant (le dernier reçu est gardé) et son heure ; plus de 30 s d'écart : refusé.
 *  - Ce qui sort : `vueReduite`, liste blanche d'entiers et de mots d'une liste fermée (`MOTS`). Aucun texte du service worker ni d'ESV.
 *  - Ordres : `ORDRES`, liste fermée ; chacun devient l'action du bouton du panneau, exécutée par le même chemin (`executer`, fourni par
 *    background.js : le traitement du message `panel`). Jamais SKIP, jamais une validation, une pose ni une écriture demandée par le téléphone.
 *  - Éteinte tant qu'aucun appairage n'est gardé : aucune socket, aucun minuteur, aucune écriture. */
(function(root,factory){const m=factory(root);if(typeof module==='object'&&module.exports)module.exports=m;root.BananeTelecommande=m;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const CLE_APPAIRAGE='arianeTelecommande',CLE_NUMEROS='arianeTelecommandeN',VERSION_ENV=1,FENETRE_MS=30000,HORS_LIGNE_MS=30000;
const ORDRES=Object.freeze(Object.assign(Object.create(null),{'lot-pause':'pause','lot-reprendre':'resume','lot-arreter':'stop',
 'relecture-pause':'relecture-pause','relecture-reprendre':'relecture-reprendre','relecture-arreter':'relecture-arreter','constellation-arreter':'file-arreter'}));
const NOMS_ORDRES=Object.freeze(Object.keys(ORDRES));
/* Mots permis dans la vue, par champ. Tout autre mot devient « autre » ; une valeur absente, null. */
const L={
 connexion:['prete','absente','muette','reconnexion','autre'],
 activite:['repos','orbite','echo'],
 lot:['aucun','cours','pause','arrete','fini','alerte'],
 alerte:['esv-muet','rail-non-resolu','faible-confiance','repris-main','incertain','erreur','autre'],
 relecture:['aucune','preparation','en-cours','en-pause','finie','arretee','erreur','non-lancee','autre'],
 pauseRaison:['esv','redemarrage','points','operateur','autre'],
 constellation:['aucune','lot','passe','relecture','changement','fin','arret','autre'],
 passe2:['aucune','ecriture','calcul','ombre','finie','arretee','erreur','autre'],
 type:['etat','accuse'],resultat:['accepte','refuse'],
 motif:['rejeu','perime','forme','ordre-inconnu','refus-ariane']};
const MOTS=new Set([...Object.values(L).flat(),...NOMS_ORDRES,'inconnu']);
const ent=(x,max=1e9)=>Number.isInteger(x)&&x>=0&&x<=max?x:null;
const mot=(x,liste)=>x==null?null:liste.includes(x)?x:'autre';
const FIN_PARTIE=999999,CLOS=['STOPPED','COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','ERROR'];
const CONNEXION={ready:'prete','no-tab':'absente',unavailable:'muette',reconnecting:'reconnexion'};

/* ——— Vue réduite (liste blanche). `src` : {s: état du moteur, relecture: vue de la passe, file: vue de la file, passe: vue de la deuxième passe, echo: booléen}. */
function vueLot(s){const b=s?.batch;
 const v={etat:'aucun',alerte:null,partie:null,debut:null,fin:null,cut:null,traites:0,poses:0,differes:0,sautes:0};
 if(!b||typeof b!=='object')return v;const st=b.state,sc=b.scope||{};
 const al=a=>{v.etat='alerte';v.alerte=a;};
 if(s.reconcileRequired)al('incertain');
 else if(st==='RUNNING')v.etat='cours';
 else if(st==='PAUSED')b.pauseReason==='low-confidence'?al('faible-confiance'):b.pauseReason==='unresolved-rail'?al('rail-non-resolu'):v.etat='pause';
 else if(st==='COMPLETED'||st==='FINISHED_WITH_UNCONFIRMED_ACTIONS')v.etat='fini';
 else if(st==='STOPPED')v.etat=b.stoppedAtEnd?'fini':'arrete';
 else if(st==='ERROR')al('erreur');
 else if(st==='PAUSED_ADAPTER_UNRESPONSIVE')al('esv-muet');
 else if(st==='PAUSED_UNRESOLVED_RAIL')al('rail-non-resolu');
 else if(st==='MANUAL_TAKEOVER')al('repris-main');
 else al('autre');
 v.partie=ent(sc.part);v.debut=ent(sc.start);v.fin=ent(sc.end)!==null&&sc.end<FIN_PARTIE&&sc.endMode!=='partie'?sc.end:null;
 v.cut=st==='RUNNING'?ent(b.activeIdentity?.cut):ent(b.lastCompletedIdentity?.cut)??ent(b.activeIdentity?.cut);
 const n=x=>Array.isArray(x)?x.length:0;
 v.traites=n(b.processed);v.poses=Array.isArray(b.lotPosed)?b.lotPosed.length:ent(b.lotPosedCount)??0;v.differes=n(b.deferred);v.sautes=n(b.skipped);
 return v;}
function vueReduite(src={}){const s=src.s||{},b=s.batch,r=src.relecture,f=src.file,p=src.passe;
 const lot=vueLot(s);
 const relecture={etat:r?mot(r.etat,L.relecture):'aucune',faits:ent(r?.faits),total:ent(r?.total),corriges:ent(r?.corriges),cut:ent(r?.cut),pauseRaison:mot(r?.pauseRaison,L.pauseRaison)};
 const constellation={etat:f?mot(f.etat,L.constellation):'aucune',rang:ent(f?.rang),n:ent(f?.n),partie:ent(f?.enCours?.part)};
 const passe2={etat:p?mot(p.etat,L.passe2):'aucune',ecrites:ent(p?.ecrites),demandees:ent(p?.demandees)};
 const ouvert=!!b&&typeof b==='object'&&!CLOS.includes(b.state),ecrit=passe2.etat==='ecriture';
 const relVivante=['preparation','en-cours','en-pause'].includes(relecture.etat),fileActive=['lot','passe','relecture','changement'].includes(constellation.etat);
 /* Les boutons OFFERTS au téléphone (ce que montre le panneau) ; le service worker garde ses refus de toute façon. */
 const boutons={
  'lot-pause':b?.state==='RUNNING'&&!relVivante&&!ecrit,
  'lot-reprendre':!!b&&!relVivante&&!ecrit&&(['PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(b.state)||b.state==='STOPPED'&&!b.stoppedAtEnd),
  'lot-arreter':ouvert||ecrit,
  'relecture-pause':relecture.etat==='en-cours'&&r?.reprise===true&&r?.pauseDemandee!==true,
  'relecture-reprendre':relecture.etat==='en-pause',
  'relecture-arreter':relVivante,
  'constellation-arreter':fileActive};
 const activite=src.echo===true?'echo':ouvert||fileActive||relVivante||ecrit?'orbite':'repos';
 return {connexion:mot(CONNEXION[s.connection?.status]??s.connection?.status,L.connexion),activite,lot,relecture,constellation,passe2,boutons,
  version:MOTS.has(src.version)?src.version:null};}

/* ——— Motif de refus d'Ariane, nettoyé pour le téléphone : la phrase d'Ariane, sans ce qu'elle cite (parenthèses), sans adresse, uuid, code projet. */
function nettoyerMotif(t){if(typeof t!=='string')return null;
 let x=t.replace(/\([^)]*\)?/g,' ').replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi,' ').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,' ')
  .replace(/Project__\d+|[Pp]rojet[_ ]?\d{6}_\d{6}/g,' ').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,' ').replace(/\S*\.(?:xyz|com|fr|net|org|dev|test|io)\S*/gi,' ')
  .replace(/\s+/g,' ').replace(/\s+([.,])/g,'$1').trim();
 if(x.length>160)x=x.slice(0,159).trimEnd()+'…';return x||null;}

/* ——— Codage : base64url (sans btoa : la VM des essais n'en a pas) et base32 de Crockford pour le code à taper. */
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function b64e(u){u=u instanceof Uint8Array?u:new Uint8Array(u);let s='';for(let i=0;i<u.length;i+=3){const n=u[i]<<16|(u[i+1]??0)<<8|(u[i+2]??0);
 s+=B64[n>>18&63]+B64[n>>12&63]+(i+1<u.length?B64[n>>6&63]:'')+(i+2<u.length?B64[n&63]:'');}return s;}
function b64d(s){if(typeof s!=='string'||!/^[A-Za-z0-9_-]*$/.test(s)||s.length%4===1)throw Error('base64 invalide');const o=[];let n=0,b=0;
 for(const c of s){n=n<<6|B64.indexOf(c);b+=6;if(b>=8){b-=8;o.push(n>>b&255);}}return new Uint8Array(o);}
const B32='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function b32e(u){let s='',n=0,b=0;for(const x of u){n=n<<8|x;b+=8;while(b>=5){b-=5;s+=B32[n>>b&31];}n&=255;}if(b)s+=B32[n<<(5-b)&31];return s;}
function b32d(s){const o=[];let n=0,b=0;for(const c of s){const v=B32.indexOf(c);if(v<0)throw Error('caractère hors code');n=(n<<5|v)&0xffff;b+=5;if(b>=8){b-=8;o.push(n>>b&255);}}return new Uint8Array(o);}
const sub=()=>{const c=root.crypto?.subtle;if(!c)throw Error('WebCrypto absent');return c;};
const enc=new TextEncoder(),dec={decode:u=>new root.TextDecoder().decode(u)};/* créé à l'usage */
function tirerCle(){const k=new Uint8Array(32);root.crypto.getRandomValues(k);return k;}
/* Code : 32 octets de clé + 1 octet de contrôle (premier octet de SHA-256(K)) = 53 caractères. */
async function coder(k){const h=new Uint8Array(await sub().digest('SHA-256',k));const u=new Uint8Array(33);u.set(k);u[32]=h[0];return b32e(u);}
async function decoder(code){const s=String(code||'').toUpperCase().replace(/[\s-]/g,'').replace(/O/g,'0').replace(/[IL]/g,'1');
 if(s.length!==53)throw Error('Code de longueur inattendue');const u=b32d(s).slice(0,33),k=u.slice(0,32);
 const h=new Uint8Array(await sub().digest('SHA-256',k));if(h[0]!==u[32])throw Error('Code faux (somme de contrôle)');return k;}
async function deriver(k){const S=sub(),base=await S.importKey('raw',k,'HKDF',false,['deriveKey','deriveBits']);
 const sel=enc.encode('ariane-telecommande-v1');
 const bits=new Uint8Array(await S.deriveBits({name:'HKDF',hash:'SHA-256',salt:sel,info:enc.encode('canal')},base,128));
 const cle=await S.deriveKey({name:'HKDF',hash:'SHA-256',salt:sel,info:enc.encode('aes-gcm')},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 return {cle,canal:[...bits].map(x=>x.toString(16).padStart(2,'0')).join('')};}
async function chiffrer(D,sens,objet){const iv=new Uint8Array(12);root.crypto.getRandomValues(iv);
 const d=await sub().encrypt({name:'AES-GCM',iv,additionalData:enc.encode(D.canal+'|'+sens)},D.cle,enc.encode(JSON.stringify(objet)));
 return {v:VERSION_ENV,iv:b64e(iv),d:b64e(new Uint8Array(d))};}
async function dechiffrer(D,sens,env){if(!env||env.v!==VERSION_ENV||typeof env.iv!=='string'||typeof env.d!=='string')throw Error('enveloppe inconnue');
 const iv=b64d(env.iv);if(iv.length!==12)throw Error('iv invalide');
 const c=await sub().decrypt({name:'AES-GCM',iv,additionalData:enc.encode(D.canal+'|'+sens)},D.cle,b64d(env.d));return JSON.parse(dec.decode(c));}

/* ——— Contrôle d'un ordre déchiffré : {ok:true, action} ou {ok:false, motif}. */
function controlerOrdre(o,{dernierN=0,maintenant=Date.now()}={}){
 if(!o||o.type!=='ordre'||!Number.isSafeInteger(o.n)||!Number.isSafeInteger(o.h))return {ok:false,motif:'forme'};
 if(o.n<=dernierN)return {ok:false,motif:'rejeu'};
 if(Math.abs(maintenant-o.h)>FENETRE_MS)return {ok:false,motif:'perime'};
 if(typeof o.ordre!=='string'||!Object.hasOwn(ORDRES,o.ordre))return {ok:false,motif:'ordre-inconnu'};
 return {ok:true,action:ORDRES[o.ordre]};}

/* ——— « Ariane hors ligne » (page du téléphone) : plus de 30 s sans état, ou le relais dit qu'Ariane n'est pas connectée. Heure de Paris. */
const heure=h=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(h));
function horsLigne({dernierEtatH=null,maintenant=Date.now(),arianePresente=true}={}){
 const hors=!Number.isFinite(dernierEtatH)||!arianePresente||maintenant-dernierEtatH>HORS_LIGNE_MS;
 return {horsLigne:hors,depuis:hors&&Number.isFinite(dernierEtatH)?heure(dernierEtatH):null};}

/* ——— Adresse du relais : https, un nom d'hôte, aucun chemin. */
function relaisNormal(a){let u;try{u=new URL(String(a||'').trim());}catch{throw Error('Adresse du relais illisible : colle l’adresse https de ton Worker.');}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!(u.pathname==='/'||u.pathname===''))throw Error('Adresse du relais : https://nom-du-worker…, sans chemin.');
 return 'https://'+u.host;}

/* ——— L'instance du service worker. Dépendances fournies par background.js (ou par les essais) :
 *   stockage (chrome.storage.local), WS (WebSocket), executer(action) -> promesse (le chemin du message `panel`), journal(type, champs),
 *   sources() -> {s, relecture, file, passe, echo, version}, maintenant(). */
function creer({stockage,WS,executer,journal=()=>{},sources,maintenant=()=>Date.now(),periodeMs=1000,battementMs=15000,reconnexionMs=[1000,2000,5000,10000,30000],
  setT=root.setTimeout.bind(root),clearT=root.clearTimeout.bind(root)}){
 let A=null;/* appairage vivant : {relais, code, D} */
 let ws=null,ouverte=false,tour=null,reco=null,essais=0,dernierTexte=null,dernierEnvoi=null,envoiN=0,recuN=0,file=Promise.resolve(),vie=0;
 const refusDits=new Map();
 const noter=(type,champs)=>{try{journal(type,champs);}catch{/* journal indisponible : l'ordre reste traité */}};
 const fermer=()=>{clearT(tour);clearT(reco);tour=reco=null;ouverte=false;const w=ws;ws=null;if(w){w.onopen=w.onmessage=w.onclose=w.onerror=null;try{w.close();}catch{/* déjà fermée */}}};
 const numero=()=>(envoiN=Math.max(envoiN+1,maintenant()));
 async function envoyer(clair){if(!A||!ws||!ouverte)return false;const env=await chiffrer(A.D,'a>t',{...clair,n:numero(),h:maintenant()});
  if(!ws||!ouverte)return false;try{ws.send(JSON.stringify(env));}catch{return false;}return true;}
 async function envoyerEtat(force){let v;try{v=vueReduite(sources());}catch{return;}const t=JSON.stringify(v);
  if(!force&&t===dernierTexte&&maintenant()-(dernierEnvoi??0)<battementMs)return;
  if(await envoyer({type:'etat',...v})){dernierTexte=t;dernierEnvoi=maintenant();}}
 function boucle(v){if(v!==vie)return;tour=setT(async()=>{if(v!==vie)return;await envoyerEtat(false).catch(()=>{});boucle(v);},periodeMs);}
 function connecter(v){if(v!==vie||!A)return;
  let w;try{w=new WS(A.relais.replace(/^https:/,'wss:')+'/canal/'+A.D.canal+'?role=ariane');}catch{return planifier(v);}
  ws=w;
  w.onopen=()=>{if(v!==vie)return;ouverte=true;essais=0;dernierTexte=null;void envoyerEtat(true);clearT(tour);boucle(v);};
  w.onmessage=ev=>{if(v===vie)void recevoir(ev.data);};
  w.onclose=()=>{if(v!==vie||ws!==w)return;ouverte=false;ws=null;clearT(tour);planifier(v);};
  w.onerror=()=>{};}
 function planifier(v){if(v!==vie||!A)return;const d=reconnexionMs[Math.min(essais++,reconnexionMs.length-1)];clearT(reco);reco=setT(()=>connecter(v),d);}
 /* Illisible (pas de la clé, mauvais sens, trafiqué) : rien n'est fait, rien n'est accusé ; noté au plus une fois par minute. */
 function refusMuet(motif){const t=maintenant();if(t-(refusDits.get(motif)??-Infinity)<60000)return;refusDits.set(motif,t);noter('telecommande-refus',{motif});}
 async function recevoir(texte){if(!A||typeof texte!=='string'||texte.length>16384)return refusMuet('taille');
  let env;try{env=JSON.parse(texte);}catch{return refusMuet('illisible');}
  if(env&&env.v===VERSION_ENV&&env.type==='presence')return;/* message du relais lui-même (téléphones connectés) : sans effet ici */
  let o;try{o=await dechiffrer(A.D,'t>a',env);}catch{return refusMuet('illisible');}
  file=file.then(()=>traiter(o)).catch(()=>{});return file;}
 async function traiter(o){const c=controlerOrdre(o,{dernierN:recuN,maintenant:maintenant()});
  const nom=typeof o?.ordre==='string'&&Object.hasOwn(ORDRES,o.ordre)?o.ordre:'inconnu';
  if(c.ok||c.motif==='perime'||c.motif==='ordre-inconnu'){recuN=o.n;await stockage.set({[CLE_NUMEROS]:{recu:recuN}}).catch(()=>{});}
  if(!c.ok){noter('telecommande-ordre',{ordre:nom,resultat:'refuse',motif:c.motif});
   if(Number.isSafeInteger(o?.n))await envoyer({type:'accuse',pour:o.n,ordre:nom,resultat:'refuse',motif:c.motif});return;}
  let resultat='accepte',motif=null,code=null;
  try{await executer(c.action);}catch(e){resultat='refuse';code='refus-ariane';motif=nettoyerMotif(String(e?.message||e))||'Refusé par Ariane';}
  noter('telecommande-ordre',{ordre:nom,resultat,motif:code});
  await envoyer({type:'accuse',pour:o.n,ordre:nom,resultat,motif});
  await envoyerEtat(true).catch(()=>{});}
 async function charger(){const r=await stockage.get([CLE_APPAIRAGE,CLE_NUMEROS]);const a=r?.[CLE_APPAIRAGE];
  if(!a||typeof a.relais!=='string'||typeof a.code!=='string')return null;
  recuN=Number.isSafeInteger(r?.[CLE_NUMEROS]?.recu)?r[CLE_NUMEROS].recu:0;
  return {relais:a.relais,code:a.code,D:await deriver(await decoder(a.code))};}
 return {
  async demarrer(){const v=++vie;fermer();let a=null;try{a=await charger();}catch{a=null;}if(v!==vie||!a)return false;A=a;connecter(v);return true;},
  async appairer(adresse){const relais=relaisNormal(adresse),k=tirerCle(),code=await coder(k),D=await deriver(k);
   const v=++vie;fermer();A={relais,code,D};recuN=0;envoiN=0;
   await stockage.set({[CLE_APPAIRAGE]:{relais,code,depuis:new Date(maintenant()).toISOString()},[CLE_NUMEROS]:{recu:0}});
   noter('telecommande-appairee',{});connecter(v);return {code,lien:relais+'/#k='+code};},
  async couper(){vie++;fermer();A=null;recuN=0;dernierTexte=dernierEnvoi=null;await stockage.remove([CLE_APPAIRAGE,CLE_NUMEROS]);noter('telecommande-coupee',{});return this.etat();},
  arreter(){vie++;fermer();},
  /* Pour le panneau : jamais la clé, sauf `code()` demandé pour réafficher le QR. */
  etat(){return {appairee:!!A,relais:A?A.relais:null,connectee:!!A&&ouverte,dernierEnvoi:dernierEnvoi?new Date(dernierEnvoi).toISOString():null};},
  code(){return A?{code:A.code,lien:A.relais+'/#k='+A.code}:null;},
  pousser(){if(A&&ouverte)void envoyerEtat(false).catch(()=>{});}};}

return Object.freeze({CLE_APPAIRAGE,CLE_NUMEROS,ORDRES,NOMS_ORDRES,MOTS,FENETRE_MS,HORS_LIGNE_MS,vueReduite,nettoyerMotif,controlerOrdre,horsLigne,
 tirerCle,coder,decoder,deriver,chiffrer,dechiffrer,b64e,b64d,relaisNormal,creer});
});
