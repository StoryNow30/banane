'use strict';
/* Audit P-5 (H14, H15, H16 ; fiches/FIABILITE_LOT.md) — LES COMMANDES À ESV SONT IDENTIQUES, OCTET POUR OCTET, À CELLES DE LA BASE.
 * Les trois corrections ne touchent que le journal, les avis et les audits. Ici, le service worker réel conduit trois scénarios (ESV simulé) :
 *   A. lot 100–103 sans incident, précédé de « Connecter » (empreinte du contrat) ;
 *   B. lot 100–103 où la page disparaît pendant une capture (erreur de lot), puis « Reprendre » après F5 ;
 *   C. observations de liste pendant un lot (audit serveur : lectures complète et partielle).
 * Chaque message envoyé à la page (`page-command` : action, arguments) est relevé dans l'ordre. Les identifiants aléatoires, les heures et la version de l'extension sont
 * neutralisés (ils changent à chaque exécution ; 4.9.6 test 1 : le numéro 4.9.6 aussi) ; tout le reste est comparé à l'empreinte relevée sur la base (`claude/50-base`, 97dfca7),
 * avant les corrections. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pilote,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const COUPE='Could not establish connection. Receiving end does not exist.';
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const neutre=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='capturedAt'?'<clock>':v).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>').replace(/4\.9\.[5-9]\.\d+|4\.9\.[5-9] test \d+/g,'<version>'));
const empreinte=messages=>crypto.createHash('sha256').update(JSON.stringify(neutre(messages))).digest('hex');
/* Relevé de chaque message à la page, posé avant « Connecter ». */
const releve=messages=>(esv,b)=>{const envoi=b.ctx.chrome.tabs.sendMessage;
 b.ctx.chrome.tabs.sendMessage=async(id,m)=>{if(m?.kind==='page-command')messages.push({tab:id,...JSON.parse(JSON.stringify(m))});return envoi(id,m);};};
const fin=async b=>{let v;for(let i=0;i<600&&((v=await b.api('view')).busy||v.batch?.state==='RUNNING');i++)await attendre(5);return v;};

/* Empreintes relevées sur la base, avant les corrections (même scénario, même neutralisation). Refaites avec la version neutralisée à la test 7 :
 * mêmes messages à 803fb76 (4.9.5.6) et à 4.9.5.7, le numéro de version était le seul écart. */
const BASE={A:{n:42,sha:'722bbee48b43e7b37512a63dfddc7aa8bd98ce61674091d567a58581675cec19'},
 B:{n:52,sha:'f25ce0a84742f4669f75e44b14d8bd3ef156d3aaf41555f4fed53f2ff05389c0'},
 /* C : les observations de liste ne changent aucune commande (même suite que A). */
 C:{n:42,sha:'722bbee48b43e7b37512a63dfddc7aa8bd98ce61674091d567a58581675cec19'}};

async function scenarioA(){const messages=[];const r=await pilote(L,{start:100,end:103,esv:releve(messages)});await fin(r.b);return messages;}
async function scenarioB(){const messages=[];
 const r=await pilote(L,{start:100,end:103,settings:reglages(),esv:(esv,b)=>{releve(messages)(esv,b);esvLent(esv,{lecturesInstables:false});const capture=esv.capture.bind(esv);let fait=false;
  esv.capture=async(...a)=>{if(esv.identity.cut===102&&!fait){fait=true;throw Error(COUPE);}return capture(...a);};}});
 let v=await fin(r.b);assert.equal(v.batch.state,'PAUSED_ADAPTER_UNRESPONSIVE');
 r.b.adapter.onReload();r.b.adapter.identity.cut=102;await r.b.api('resume');v=await attendreFin(r);assert.ok(v.batch.stoppedAtEnd,'le lot finit après la reprise');
 return messages;}
async function scenarioC(){const messages=[];const r=await pilote(L,{start:100,end:103,esv:releve(messages)});const b=r.b;
 const S=b.fonction('BananeSettings');b.ctx.BananeSettings={...S,releves:{...S.releves,auditSilenceMs:5}};
 const t0=Date.now()-60000,page=(seq,rows,valid,fin)=>({seq,kind:'list-page',listKey:'table-essai',status:200,outcome:'done',rows,counts:{valid,invalid:rows-valid,skipped:0},startedEpochMs:fin-300,endedEpochMs:fin,durationMs:300,chars:5});
 const onglet=await b.ctx.chrome.tabs.get(1),envoyer=(entries,observer)=>b.message({kind:'esv-observation',observer,entries},{id:'test',tab:{id:1},url:onglet.url});
 await envoyer([{seq:1,kind:'list-summary',listKey:'table-essai',pages:3,okPages:3,rows:2500,chars:1,counts:{valid:2400,invalid:100,skipped:0},firstStartedEpochMs:t0-500,lastEndedEpochMs:t0,durationMs:500,beforeSession:true}],'obs-1');
 await attendre(20);await envoyer([page(2,1000,950,t0+20000),page(3,1000,990,t0+20600),page(4,500,470,t0+21200)],'obs-2');await attendre(30);
 await envoyer([page(5,1000,990,t0+40000),page(6,1000,995,t0+40600)],'obs-3');await attendre(30);
 assert.ok(b.store.events.some(e=>e.type==='audit-serveur'),'le scénario passe bien par l\'audit serveur');
 await fin(b);return messages;}

for(const [nom,scenario] of [['A',scenarioA],['B',scenarioB],['C',scenarioC]])
 test(`scénario ${nom} : messages à la page identiques à la base (nombre et empreinte)`,async()=>{
  const m=await scenario();const sha=empreinte(m);
  console.log(`# scénario ${nom} : ${m.length} messages, ${sha}, actions ${[...new Set(m.map(x=>x.action))].join(',')}`);
  assert.deepEqual({n:m.length,sha},BASE[nom]);
 });
