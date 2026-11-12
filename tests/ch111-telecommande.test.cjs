'use strict';
/* CH-111 (D-345) — télécommande d'Ariane : module du service worker `src/telecommande.js`, essayé seul (sans navigateur).
 * Chiffrement (un relais simulé ne lit rien ; un message trafiqué, renvoyé dans l'autre sens ou rejoué est refusé), liste blanche de la vue,
 * liste fermée des ordres (chacun appelle la même action que le bouton du panneau, jamais `skip`), « hors ligne », coupure. Adresses fabriquées
 * à l'exécution (le scan d'identité refuse les adresses en clair). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../src/telecommande.js');
const RELAIS=['https:/','/relais-essai','.exemple','.test'].join('');
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const UUID=['0f1e2d3c','4b5a','6978','8796','a5b4c3d2e1f0'].join('-'),PROJET='Project'+'__123456',ADR=['https:/','/esv.exemple','/rails_validation/x'].join('');/* fabriqués à l'exécution (scan d'identité) */

/* Faux WebSocket : le « relais » garde tout ce qui passe (il ne doit rien pouvoir lire). */
function fauxReseau(){const sockets=[],vus=[];
 class FauxWS{constructor(url){this.url=url;this.readyState=0;this.envoyes=[];sockets.push(this);setTimeout(()=>{if(this.readyState===0){this.readyState=1;this.onopen?.();}},0);}
  send(t){if(this.readyState!==1)throw Error('fermée');this.envoyes.push(t);vus.push(t);}
  close(){if(this.readyState===3)return;this.readyState=3;this.onclose?.({code:1000});}
  recevoir(t){this.onmessage?.({data:t});}}
 return {FauxWS,sockets,vus};}
function memoire(){const m={};return {m,get:async k=>Object.fromEntries([].concat(k).filter(x=>x in m).map(x=>[x,structuredClone(m[x])])),
 set:async o=>{for(const k of Object.keys(o))m[k]=structuredClone(o[k]);},remove:async k=>{for(const x of [].concat(k))delete m[x];}};}

test('code d’appairage : 256 bits, somme de contrôle, lecture tolérante (espaces, tirets, minuscules, O et I)',async()=>{
 const k=T.tirerCle();assert.equal(k.length,32);
 const code=await T.coder(k);assert.match(code,/^[0-9A-HJKMNP-TV-Z]{53}$/);
 assert.deepEqual([...await T.decoder(code)],[...k]);
 const tape=code.toLowerCase().replace(/(.{4})/g,'$1 - ').replace(/0/g,'o').replace(/1/g,'i');
 assert.deepEqual([...await T.decoder(tape)],[...k]);
 const faux=code.slice(0,10)+(code[10]==='A'?'B':'A')+code.slice(11);
 await assert.rejects(()=>T.decoder(faux),/contrôle/);
 await assert.rejects(()=>T.decoder(code.slice(0,40)),/longueur/);});

test('chiffrement : le relais ne voit que le canal et du chiffré ; trafiqué, autre sens ou autre clé : refusé',async()=>{
 const k=T.tirerCle(),D=await T.deriver(k),D2=await T.deriver(T.tirerCle());
 assert.match(D.canal,/^[0-9a-f]{32}$/);assert.notEqual(D.canal,D2.canal);
 const clair={type:'etat',n:1,h:Date.now(),lot:{etat:'cours',partie:12,cut:345}};
 const env=await T.chiffrer(D,'a>t',clair),texte=JSON.stringify(env);
 assert.deepEqual(Object.keys(env).sort(),['d','iv','v']);
 assert.ok(!/etat|cours|345|partie/.test(texte),'rien de lisible : '+texte);
 assert.deepEqual(await T.dechiffrer(D,'a>t',env),clair);
 await assert.rejects(()=>T.dechiffrer(D,'t>a',env),'renvoyé dans l’autre sens');
 await assert.rejects(()=>T.dechiffrer(D2,'a>t',env),'autre clé');
 const d=T.b64d(env.d);d[3]^=1;await assert.rejects(()=>T.dechiffrer(D,'a>t',{...env,d:T.b64e(d)}),'trafiqué');
 const iv=T.b64d(env.iv);iv[0]^=1;await assert.rejects(()=>T.dechiffrer(D,'a>t',{...env,iv:T.b64e(iv)}),'iv trafiqué');
 await assert.rejects(()=>T.dechiffrer(D,'a>t',{v:2,iv:env.iv,d:env.d}),'version');});

test('ordres : liste fermée, chacun vers l’action du bouton du panneau ; jamais skip, start, retry, goto-cut, écriture',()=>{
 assert.deepEqual({...T.ORDRES},{'lot-pause':'pause','lot-reprendre':'resume','lot-arreter':'stop','relecture-pause':'relecture-pause',
  'relecture-reprendre':'relecture-reprendre','relecture-arreter':'relecture-arreter','constellation-arreter':'file-arreter'});
 assert.ok(Object.isFrozen(T.ORDRES));
 for(const a of Object.values(T.ORDRES))assert.ok(!/skip|start|retry|goto|ecrire|apply|valid|demarrer|manual|close|cancel/.test(a),a);});

test('contrôle d’un ordre : numéro croissant, 30 s au plus, nom dans la liste',()=>{
 const now=1_800_000_000_000,c=(o,dernier=10)=>T.controlerOrdre(o,{dernierN:dernier,maintenant:now});
 assert.deepEqual(c({type:'ordre',n:11,h:now-29_000,ordre:'lot-pause'}),{ok:true,action:'pause'});
 assert.equal(c({type:'ordre',n:10,h:now,ordre:'lot-pause'}).motif,'rejeu');
 assert.equal(c({type:'ordre',n:9,h:now,ordre:'lot-pause'}).motif,'rejeu');
 assert.equal(c({type:'ordre',n:11,h:now-31_000,ordre:'lot-pause'}).motif,'perime');
 assert.equal(c({type:'ordre',n:11,h:now+31_000,ordre:'lot-pause'}).motif,'perime');
 assert.equal(c({type:'ordre',n:11.5,h:now,ordre:'lot-pause'}).motif,'forme');
 assert.equal(c({type:'ordre',n:11,ordre:'lot-pause'}).motif,'forme');
 for(const o of ['skip','explicit-skip','start','retry','goto-cut','passe-differes-ecrire','file-demarrer','native-pause','native-resume','manual-takeover','pause','__proto__','constructor','toString'])
  assert.equal(c({type:'ordre',n:11,h:now,ordre:o}).motif,'ordre-inconnu',o);
 assert.equal(c({type:'etat',n:11,h:now}).motif,'forme');});

/* États fabriqués comme ceux du service worker (champs réels du moteur, de la relecture, de la file), CHARGÉS de ce qui ne doit pas sortir. */
const SECRETS=[PROJET,UUID,'esv.exemple','rails_validation','Jean Dupont','texte libre d’ESV'];
function etatCharge(){const id={part:12,cut:345,frameId:UUID,projet:PROJET,url:ADR};
 return {s:{sessionId:UUID,lidarId:PROJET,notice:'Jean Dupont texte libre d’ESV',reconcileRequired:false,
   connection:{status:'ready',message:'onglet '+ADR},current:{identity:id},
   batch:{id:UUID,state:'RUNNING',pauseReason:null,scope:{part:12,start:300,end:999999,endMode:'partie',projet:PROJET},
    activeIdentity:id,lastCompletedIdentity:{...id,cut:344},processed:[{identity:id,cut:340,evidence:'Jean Dupont'},{identity:id,cut:341}],deferred:[{identity:id,unresolvedRails:['left']}],skipped:[],
    lotPosed:[{identity:id},{identity:id}],error:{message:'texte libre d’ESV '+PROJET}}},
  relecture:{etat:'en-pause',mode:'corriger',faits:7,total:20,corriges:2,vus:7,cut:351,message:'Jean Dupont texte libre d’ESV',pauseDemandee:false,pauseRaison:'esv',lotId:UUID},
  file:{id:UUID,etat:'lot',n:5,plan:[12,13,14],rang:1,enCours:{part:12,rang:1,lot:true},alerte:'texte libre d’ESV',motifFin:'Jean Dupont',bilan:[{part:11,motifs:[PROJET]}]},
  passe:{etat:'ecriture',ecrites:3,demandees:9,lotId:UUID,message:'Jean Dupont'},
  echo:false,version:'5.0.15'};}
/* Toute valeur de la vue : un entier, un booléen, null, ou un mot de la liste fermée (`T.MOTS`). */
function feuilles(o,chemin='',out=[]){if(o&&typeof o==='object'){for(const [k,v] of Object.entries(o))feuilles(v,chemin+'.'+k,out);}else out.push([chemin,o]);return out;}

test('liste blanche : la vue ne porte que des entiers et des mots fermés, rien de l’état chargé ne fuit',()=>{
 const v=T.vueReduite(etatCharge()),texte=JSON.stringify(v);
 for(const s of SECRETS)assert.ok(!texte.includes(s),'fuite : '+s);
 assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}|https?:|Project__/i.test(texte),texte);
 for(const [c,x] of feuilles(v))assert.ok(x===null||typeof x==='boolean'||Number.isInteger(x)||T.MOTS.has(x),`${c} = ${JSON.stringify(x)}`);
 assert.deepEqual(v.lot,{etat:'cours',alerte:null,partie:12,debut:300,fin:null,cut:345,traites:2,poses:2,differes:1,sautes:0});
 assert.deepEqual(v.relecture,{etat:'en-pause',faits:7,total:20,corriges:2,cut:351,pauseRaison:'esv'});
 assert.deepEqual(v.constellation,{etat:'lot',rang:1,n:5,partie:12});
 assert.deepEqual(v.passe2,{etat:'ecriture',ecrites:3,demandees:9});
 assert.equal(v.activite,'orbite');assert.equal(v.connexion,'prete');assert.equal(v.version,null,'version : mot hors liste fermée, non envoyée');
 assert.deepEqual(v.boutons,{'lot-pause':false/* relecture et deuxième passe vivantes : le panneau ne l'offre pas */,'lot-reprendre':false,'lot-arreter':true,'relecture-pause':false,'relecture-reprendre':true,'relecture-arreter':true,'constellation-arreter':true});});

test('liste blanche : états d’alerte (mots fermés), valeurs inconnues ramenées à « autre », entiers hors bornes à null',()=>{
 const base=etatCharge(),cas=[['PAUSED_ADAPTER_UNRESPONSIVE',null,'esv-muet'],['PAUSED_UNRESOLVED_RAIL',null,'rail-non-resolu'],['PAUSED','low-confidence','faible-confiance'],
  ['MANUAL_TAKEOVER',null,'repris-main'],['ERROR',null,'erreur'],['ETAT_INVENTE '+PROJET,null,'autre']];
 for(const [state,pauseReason,alerte] of cas){const e=etatCharge();e.s.batch={...e.s.batch,state,pauseReason};const v=T.vueReduite(e);
  assert.equal(v.lot.etat,'alerte',state);assert.equal(v.lot.alerte,alerte,state);assert.ok(!JSON.stringify(v).includes('Project__'));}
 const e=etatCharge();e.s.reconcileRequired=true;assert.equal(T.vueReduite(e).lot.alerte,'incertain');
 const p=etatCharge();p.s.batch.state='PAUSED';p.relecture=null;p.passe=null;const vp=T.vueReduite(p);assert.equal(vp.lot.etat,'pause');assert.equal(vp.boutons['lot-reprendre'],true);assert.equal(vp.boutons['lot-pause'],false);
 const f=etatCharge();f.s.batch.state='STOPPED';f.s.batch.stoppedAtEnd=true;assert.equal(T.vueReduite(f).lot.etat,'fini');
 const z=etatCharge();z.s.batch.scope.part=-3;z.s.batch.scope.start=1.5;z.relecture.etat='inventé';z.relecture.pauseRaison='Jean Dupont';z.file.etat=PROJET;z.s.connection.status='bizarre';
 const vz=T.vueReduite(z);assert.equal(vz.lot.partie,null);assert.equal(vz.lot.debut,null);assert.equal(vz.relecture.etat,'autre');assert.equal(vz.relecture.pauseRaison,'autre');
 assert.equal(vz.constellation.etat,'autre');assert.equal(vz.connexion,'autre');
 const rien=T.vueReduite({s:{batch:null,connection:{status:'no-tab'}},relecture:null,file:null,passe:null,echo:true});
 assert.deepEqual(rien.lot,{etat:'aucun',alerte:null,partie:null,debut:null,fin:null,cut:null,traites:0,poses:0,differes:0,sautes:0});
 assert.equal(rien.activite,'echo');assert.equal(rien.relecture.etat,'aucune');assert.equal(rien.constellation.etat,'aucune');
 assert.ok(Object.values(rien.boutons).every(x=>x===false));});

test('refus d’Ariane : un code de la liste fermée et au plus un numéro de cut ; rien du texte (fausse adresse, faux uuid, faux code projet)',()=>{
 const cas=[['Sélectionne un onglet ESV.','pas-d-onglet-esv'],['Connecte ESV avant de lancer la file.','pas-d-onglet-esv'],['File de parties non lancée : ESV ne répond pas (erreur '+ADR+' '+UUID+'). '+PROJET,'esv-muet'],
  ['Aucune relecture en pause.','pas-en-pause'],['Aucun lot à reprendre.','rien-a-reprendre'],['Reprise interrompue : le lot a été arrêté.','deja-arrete'],
  ['Pause de la relecture éteinte dans les réglages : elle ne peut que s’arrêter.','reglage-eteint'],
  ['Une correction de la relecture a été interrompue au cut 452 (partie 3) : contrôle ce cut dans ESV, puis clique sur « J’ai contrôlé le cut 452 ».','a-controler',452],
  ['Reprise déjà en cours : patiente.','occupe'],['Relecture après le lot en cours (3 sur 9) : clique sur « Arrêter la relecture ».','occupe'],
  ['Réponse inattendue '+ADR+' '+UUID+' '+PROJET,'autre'],[null,'autre'],[42,'autre']];
 for(const [t,code,cut=null] of cas){const r=T.codeRefus(t);assert.deepEqual(r,{code,cut},String(t));assert.ok(T.REFUS.includes(r.code));
  assert.deepEqual(Object.keys(r).sort(),['code','cut']);assert.ok(!/esv\.exemple|0f1e2d3c|Project|https?:/.test(JSON.stringify(r)));}});

/* Bout à bout dans Node : instance de l'extension ↔ faux relais ↔ « téléphone » (les fonctions de la page, réécrites ici avec le module). */
async function monter({executer,maintenant=()=>Date.now()}={}){
 const R=fauxReseau(),stock=memoire(),journal=[],etat={v:etatCharge()};
 const t=T.creer({stockage:stock,WS:R.FauxWS,executer:executer||(async a=>({fait:a})),journal:(type,d)=>journal.push({type,...d}),
  sources:()=>etat.v,maintenant,periodeMs:20,battementMs:200,reconnexionMs:[10,20]});
 return {t,R,stock,journal,etat};}
const dernierClair=async(D,sock,type)=>{for(let i=sock.envoyes.length-1;i>=0;i--){const c=await T.dechiffrer(D,'a>t',JSON.parse(sock.envoyes[i]));if(!type||c.type===type)return c;}return null;};

test('extension : rien sans appairage (ni socket, ni minuteur, ni écriture)',async()=>{
 const {t,R,stock}=await monter();await t.demarrer();await attendre(60);
 assert.equal(R.sockets.length,0);assert.deepEqual(stock.m,{});assert.deepEqual(t.etat(),{appairee:false,relais:null,connectee:false,dernierEnvoi:null});t.arreter();});

test('extension : appairer refuse une adresse qui n’est pas https ou qui porte un chemin',async()=>{
 const {t}=await monter();
 for(const a of ['http:/'+'/relais.exemple.test','https:/'+'/relais.exemple.test/x/y','ftp:/'+'/a.b','pas une adresse',''])await assert.rejects(()=>t.appairer(a),/adresse/i,a);
 t.arreter();});

test('extension : appairage, état chiffré envoyé au changement, ordre accepté et accusé, rejeu et ordre inconnu refusés, journal sans secret',async()=>{
 const appels=[];const {t,R,stock,journal,etat}=await monter({executer:async a=>{appels.push(a);if(a==='resume')throw Error('Reprise refusée ('+ADR+' '+PROJET+')');return {ok:true};}});
 const r=await t.appairer(RELAIS+'/');assert.match(r.code,/^[0-9A-Z]{53}$/);assert.equal(r.lien,RELAIS+'/#k='+r.code);
 const D=await T.deriver(await T.decoder(r.code));
 await attendre(60);const s=R.sockets.at(-1);assert.equal(s.url,RELAIS.replace('https','wss')+'/canal/'+D.canal+'?role=ariane');
 assert.ok(s.envoyes.length>=1);for(const x of R.vus)assert.ok(!/cours|partie|345|Project|esv/.test(x),'relais : '+x);
 const e1=await dernierClair(D,s,'etat');assert.equal(e1.lot.cut,345);assert.ok(Number.isInteger(e1.n)&&Number.isInteger(e1.h));
 /* changement d'état : envoyé au tour suivant */
 etat.v=etatCharge();etat.v.s.batch.activeIdentity={...etat.v.s.batch.activeIdentity,cut:346};await attendre(60);assert.equal((await dernierClair(D,s,'etat')).lot.cut,346);
 const n0=Date.now();
 const ordre=async(o,n,h=Date.now(),sens='t>a')=>{s.recevoir(JSON.stringify(await T.chiffrer(D,sens,{type:'ordre',n,h,ordre:o})));await attendre(30);};
 await ordre('lot-pause',n0+1);deq(appels,['pause']);
 let acc=await dernierClair(D,s,'accuse');assert.deepEqual([acc.pour,acc.ordre,acc.resultat,acc.motif],[n0+1,'lot-pause','accepte',null]);
 await ordre('lot-pause',n0+1);deq(appels,['pause'],'rejeu');acc=await dernierClair(D,s,'accuse');assert.equal(acc.motif,'rejeu');
 await ordre('skip',n0+2);deq(appels,['pause']);acc=await dernierClair(D,s,'accuse');assert.deepEqual([acc.resultat,acc.motif],['refuse','ordre-inconnu']);
 await ordre('lot-reprendre',n0+3,Date.now()-31_000);deq(appels,['pause']);acc=await dernierClair(D,s,'accuse');assert.equal(acc.motif,'perime');
 await ordre('lot-reprendre',n0+4);deq(appels,['pause','resume']);acc=await dernierClair(D,s,'accuse');
 assert.equal(acc.resultat,'refuse');assert.equal(acc.motif,'autre');assert.equal(acc.cut,null);
 /* l'accusé (ce qui sort) ne porte rien du texte du refus */
 assert.deepEqual(Object.keys(acc).sort(),['cut','h','motif','n','ordre','pour','resultat','type']);
 /* ordre renvoyé dans l'autre sens (reflet d'un état) ou illisible : aucune action, aucun accusé de plus */
 const avant=s.envoyes.length;await ordre('lot-pause',n0+5,Date.now(),'a>t');s.recevoir('{"v":1,"iv":"AAAA","d":"AAAA"}');s.recevoir('pas du json');await attendre(30);
 deq(appels,['pause','resume']);assert.equal((await Promise.all(s.envoyes.slice(avant).map(x=>T.dechiffrer(D,'a>t',JSON.parse(x))))).filter(c=>c.type==='accuse').length,0);
 /* journal : un par ordre, mots fermés seulement */
 const jo=journal.filter(j=>j.type==='telecommande-ordre');assert.deepEqual(jo.map(j=>[j.ordre,j.resultat,j.motif]),
  [['lot-pause','accepte',null],['lot-pause','refuse','rejeu'],['inconnu','refuse','ordre-inconnu'],['lot-reprendre','refuse','perime'],['lot-reprendre','refuse','refus-ariane']]);
 const tj=JSON.stringify(journal);assert.ok(!tj.includes(r.code),'jamais la clé au journal');
 /* le journal LOCAL garde le code et la phrase d'Ariane (bornée) ; rien de cela n'est sorti vers le relais */
 assert.deepEqual([jo[4].refus,jo[4].cut],['autre',null]);assert.match(jo[4].texte,/^Reprise refusée/);
 for(const x of R.vus)assert.ok(!/Reprise|Project|esv\.exemple/.test(x));
 /* le dernier numéro reçu est gardé : une nouvelle vie du service worker refuse le rejeu */
 assert.equal(stock.m.arianeTelecommandeN.recu,n0+4);
 t.arreter();
 const t2=T.creer({stockage:stock,WS:R.FauxWS,executer:async a=>{appels.push(a);},journal:()=>{},sources:()=>etat.v,periodeMs:20,battementMs:200,reconnexionMs:[10]});
 await t2.demarrer();await attendre(40);const s2=R.sockets.at(-1);
 s2.recevoir(JSON.stringify(await T.chiffrer(D,'t>a',{type:'ordre',n:n0+4,h:Date.now(),ordre:'lot-pause'})));await attendre(30);
 deq(appels,['pause','resume'],'rejeu après redémarrage refusé');t2.arreter();});
const deq=(a,b,m)=>assert.deepEqual(a,b,m);

test('extension : battement (état renvoyé sans changement) et reconnexion seule après une coupure du relais',async()=>{
 const {t,R}=await monter();const r=await t.appairer(RELAIS);const D=await T.deriver(await T.decoder(r.code));
 await attendre(50);const s=R.sockets.at(-1),n1=s.envoyes.length;await attendre(260);assert.ok(s.envoyes.length>n1,'battement');
 s.close();await attendre(80);assert.ok(R.sockets.length>=2,'reconnectée');const s2=R.sockets.at(-1);assert.equal(s2.readyState,1);
 assert.equal((await dernierClair(D,s2,'etat')).type,'etat','état renvoyé à la reconnexion');t.arreter();});

test('extension : « Couper la télécommande » oublie la clé, ferme la socket, ne se reconnecte plus',async()=>{
 const {t,R,stock,journal}=await monter();await t.appairer(RELAIS);await attendre(40);const s=R.sockets.at(-1);
 await t.couper();assert.equal(s.readyState,3);assert.deepEqual(stock.m,{});assert.equal(t.etat().appairee,false);
 const n=R.sockets.length;await attendre(80);assert.equal(R.sockets.length,n,'aucune reconnexion');
 assert.ok(journal.some(j=>j.type==='telecommande-coupee'));t.arreter();});

test('téléphone : « Ariane hors ligne » après 30 s sans état, avec l’heure du dernier état',()=>{
 const h=Date.UTC(2026,10,12,13,5,0);
 assert.deepEqual(T.horsLigne({dernierEtatH:h,maintenant:h+29_000,arianePresente:true}),{horsLigne:false,depuis:null});
 assert.deepEqual(T.horsLigne({dernierEtatH:h,maintenant:h+31_000,arianePresente:true}),{horsLigne:true,depuis:'14:05'});
 assert.deepEqual(T.horsLigne({dernierEtatH:h,maintenant:h+1000,arianePresente:false}),{horsLigne:true,depuis:'14:05'});
 assert.deepEqual(T.horsLigne({dernierEtatH:null,maintenant:h,arianePresente:false}),{horsLigne:true,depuis:null});});

test('Chrome sous 116 : la télécommande s’éteint avec un message clair (ni appairage, ni connexion) ; version lue dans l’agent',async()=>{
 assert.equal(T.CHROME_MIN,116);assert.equal(T.versionChrome('Mozilla/5.0 (X11) AppleWebKit/537.36 Chrome/115.0.0.0 Safari/537.36'),115);assert.equal(T.versionChrome('rien'),null);
 const R=fauxReseau(),stock=memoire();stock.m.arianeTelecommande={relais:RELAIS,code:await T.coder(T.tirerCle())};
 const t=T.creer({stockage:stock,WS:R.FauxWS,executer:async()=>{},sources:()=>({}),chrome:115});
 assert.equal(await t.demarrer(),false);await attendre(30);assert.equal(R.sockets.length,0,'aucune connexion');
 assert.match(t.etat().indisponible,/Chrome 116 ou plus récent \(celui-ci : 115\)/);
 await assert.rejects(()=>t.appairer(RELAIS),/Chrome 116/);t.arreter();
 const t2=T.creer({stockage:stock,WS:R.FauxWS,executer:async()=>{},sources:()=>({}),chrome:116,periodeMs:20,battementMs:200});
 assert.equal(await t2.demarrer(),true);await attendre(30);assert.equal(R.sockets.length,1);assert.equal(t2.etat().indisponible,undefined);t2.arreter();});
