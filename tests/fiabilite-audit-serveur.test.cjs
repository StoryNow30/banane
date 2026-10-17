'use strict';
/* H15 (audit P-5 des lots de la test 6, C4) — UN AUDIT SERVEUR NE PORTE QUE SUR UNE LECTURE COMPLÈTE DE LA LISTE, ET SUR LA PARTIE DE LA
 * LISTE RÉELLEMENT LUE.
 *
 * Constat (test 6, 10 h 04) : le lot de la partie 8 était en pause (page ESV partie sur la partie 9). Une lecture de la liste de la partie 9
 * réduite à 5 pages sur 10 a donné un audit « partie 8, source lot » à −4 877 (10 h 04 min 01 s), puis la lecture suivante, complète, +4 877
 * (10 h 04 min 18 s). Deux causes : la lecture était déclarée complète après 4 s de silence, même s'il manquait des pages ; la partie venait du
 * lot ouvert, même en pause pendant qu'ESV affichait une autre partie.
 * Règle : (1) deux lectures ne se comparent que si elles couvrent la même liste entière (même nombre de lignes) ; une lecture plus courte que
 * la référence n'est ni auditée ni gardée, sauf si elle se dit complète (dernière page plus courte que les autres, ou une seule page ; pour un
 * résumé d'avant séance, toutes ses pages lues). (2) Une liste apprend sa partie au début d'un lot (résumé d'avant séance, lot en cours) ; un lot
 * en pause, Écho ou la capture ne donnent leur partie qu'à une liste qui n'est pas connue pour être celle d'une autre partie ; une liste connue
 * garde la sienne (source `liste`).
 * Données FABRIQUÉES (parties 31 et 32, tables synthétiques), même enchaînement que le terrain. Lecture seule. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,memoire}=require('./helpers/perf-production.cjs');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x));
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const stored=(b,t)=>b.store.events.filter(e=>e.type===t);
const send=(b,entries,observer)=>b.raw({kind:'esv-observation',observer,entries});
const iso=t=>new Date(t).toISOString();

/* Pages d'une lecture : 1000 lignes, la dernière plus courte. `valides` : par page. */
const pages=(cle,lignes,valides,fin)=>lignes.map((n,i)=>({seq:10+i,kind:'list-page',listKey:cle,status:200,outcome:'done',rows:n,
 counts:{valid:valides[i],invalid:n-valides[i],skipped:0},startedEpochMs:fin-(lignes.length-i)*600,endedEpochMs:fin-(lignes.length-i-1)*600,durationMs:400,chars:5}));
const resume=(cle,lignes,valides,fin,pagesLues=3)=>({seq:2,kind:'list-summary',listKey:cle,pages:3,okPages:pagesLues,rows:lignes,chars:1,counts:{valid:valides,invalid:lignes-valides,skipped:0},
 firstStartedEpochMs:fin-2000,lastEndedEpochMs:fin,durationMs:2000,beforeSession:true});

/* L1 (partie 31) puis L2 (partie 31) mis en pause : ESV est passé sur la partie 32. L3 part sur la partie 32. `hier` : lecture de la liste de
 * la partie 32 gardée d'une séance précédente (avec la partie apprise ou non). */
async function scenario({hier=null}={}){
 const local=memoire(),b=production({local});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 b.ctx.BananeSettings={...b.ctx.BananeSettings,releves:{...b.ctx.BananeSettings.releves,auditSilenceMs:5}};
 const e=b.get('engine'),t0=Date.now()-600000;
 if(hier)await local.set({banane53Lectures:{'table-p32':{atMs:t0-86400000,valid:2860,invalid:48,rows:2908,...hier}}});
 const lot=(id,part,state)=>{e.s.batch={id,state,startedAt:iso(t0),scope:{part,start:0,end:999999}};};
 lot('lot-1',31,'RUNNING');send(b,[resume('table-p31',2911,2880,t0)],'obs-A');await attendre(25);
 for(let i=0;i<5;i++)await b.store.putEvent({eventId:'v'+i,timestamp:iso(t0+10000+i*1000),type:'validation-accepted',identity:{part:31,cut:100+i}});
 lot('lot-2',31,'RUNNING');send(b,[resume('table-p31',2911,2880,t0)],'obs-A');await attendre(25);
 await b.store.putEvent({eventId:'v-l2',timestamp:iso(t0+90000),type:'validation-accepted',identity:{part:31,cut:2910}});
 lot('lot-2',31,'PAUSED_ADAPTER_UNRESPONSIVE');
 /* La page passe sur la partie 32 : lecture COMPLÈTE de sa liste (3 pages, la dernière courte). */
 send(b,pages('table-p32',[1000,1000,908],[999,991,877],t0+100000),'obs-B');await attendre(40);
 /* Retour sur la partie 31 (F5) : lecture complète de sa liste, lot toujours en pause sur la partie 31. */
 send(b,pages('table-p31',[1000,1000,911],[1000,975,911],t0+130000),'obs-C');await attendre(40);
 /* De nouveau la partie 32 : lecture PARTIELLE, 2 pages pleines sur 3, puis silence. */
 send(b,pages('table-p32',[1000,1000],[999,991],t0+200000),'obs-D');await attendre(40);
 /* L3 part sur la partie 32 : résumé d'avant séance de la même page, complet (3 pages). */
 lot('lot-3',32,'RUNNING');send(b,[resume('table-p32',2908,2867,t0+203000)],'obs-D');await attendre(40);
 const audits=stored(b,'audit-serveur').map(a=>plat(a)).map(a=>({listKey:a.listKey,partie:a.partie,source:a.partieSource,constates:a.constates,attendus:a.attendus,ecart:a.ecart,pages:a.pages,avantSeance:a.avantSeance}));
 return {b,local,audits,t0};
}

test('incident de 10 h 04 : aucun audit sur une lecture partielle, l\'audit suivant est cohérent, ceux de la partie du lot sont inchangés',async()=>{
 const {audits,local}=await scenario();
 assert.deepEqual(audits,[
  /* La lecture complète de la partie 32 pendant la pause n'a pas de référence : rien à auditer (comme avant). */
  {listKey:'table-p31',partie:31,source:'lot',constates:6,attendus:6,ecart:0,pages:3,avantSeance:false},
  {listKey:'table-p32',partie:32,source:'lot',constates:0,attendus:0,ecart:0,pages:3,avantSeance:true}],
  'la lecture partielle ne donne aucun audit, et le départ de L3 se compare à la dernière lecture COMPLÈTE');
 assert.ok(audits.every(a=>Math.abs(a.constates)<=6),'aucun saut de liste entière (−877 puis +877 avant la correction)');
 /* Mémoire : la lecture partielle n'a pas été gardée ; chaque liste a appris sa partie au départ d'un lot. */
 const m=local.m.banane53Lectures;
 assert.deepEqual([m['table-p32'].rows,m['table-p32'].valid,m['table-p32'].partie,m['table-p31'].partie],[2908,2867,32,31]);
});

test('lecture complète de la liste d\'une AUTRE partie pendant la pause du lot : jamais la partie du lot en pause',async()=>{
 /* Lecture d'hier sans partie connue (gardée par une version précédente) : la liste n'est pas celle de la partie 31 (dont la liste est connue),
  * et sa partie est inconnue : partie nulle, aucune validation attendue. */
 const sans=(await scenario({hier:{}})).audits.find(a=>a.listKey==='table-p32'&&a.avantSeance===false);
 assert.deepEqual(sans,{listKey:'table-p32',partie:null,source:null,constates:7,attendus:null,ecart:null,pages:3,avantSeance:false});
 /* Lecture d'hier, partie 32 apprise : la liste garde sa partie (source « liste »), comparée aux validations de la partie 32. */
 const avec=(await scenario({hier:{partie:32}})).audits.find(a=>a.listKey==='table-p32'&&a.avantSeance===false);
 assert.deepEqual(avec,{listKey:'table-p32',partie:32,source:'liste',constates:7,attendus:0,ecart:7,pages:3,avantSeance:false});
});

test('une lecture d\'une autre étendue (référence partielle gardée par une version précédente) n\'est pas comparée, puis devient la référence',async()=>{
 const {audits,local}=await scenario({hier:{rows:2000,valid:1990,invalid:10,partie:32}});
 assert.equal(audits.filter(a=>a.listKey==='table-p32'&&a.avantSeance===false).length,0,'2908 lignes contre 2000 : pas comparable, aucun audit');
 assert.equal(local.m.banane53Lectures['table-p32'].rows,2908,'la lecture complète remplace la référence');
});

test('un résumé d\'avant séance dont une page manque n\'est ni audité ni gardé',async()=>{
 const local=memoire(),b=production({local});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),t0=Date.now()-60000;e.s.batch={id:'lot-r',state:'RUNNING',startedAt:iso(t0),scope:{part:31,start:0,end:999999}};
 send(b,[resume('table-p31',2911,2880,t0)],'obs-A');await attendre(25);
 send(b,[resume('table-p31',1911,1900,t0+30000,2)],'obs-B');await attendre(25);
 assert.equal(stored(b,'audit-serveur').length,0);assert.equal(local.m.banane53Lectures['table-p31'].rows,2911);
});

test('lecture seule : l\'audit n\'envoie aucune commande à ESV',async()=>{
 const {b}=await scenario({hier:{partie:32}});
 assert.deepEqual(b.commands.filter(x=>!['ping','state','nativeSnapshot'].includes(x.action)),[]);
});
