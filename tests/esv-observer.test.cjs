'use strict';
/* V1 (test 2) : observateur passif de la page ESV (D-077, D-078), module de
 * page seul. Fausse page (tests/helpers/fake-page.cjs), données synthétiques.
 * Garanties : originaux appelés à l'identique ; aucun en-tête lu ; aucune
 * requête ajoutée ; panne de l'observateur avalée ; tampon borné avec jalon
 * `gap` ; jamais l'URL complète ; corps réduit ; réglage d'arrêt. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {world,pageScript,tick,ORIGIN}=require('./helpers/fake-page.cjs'),{install,classify,railPairId,writeBody,listSummary,LIMITS}=require('../src/esv-observer.js');
const SOURCE=fs.readFileSync(path.join(__dirname,'../src/esv-observer.js'),'utf8');
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
const routes=w=>(m,u)=>/\/rails\?/.test(u)?{status:200,text:w.rows(1000)}:/\/rails\//.test(u)?{status:204,text:''}:{status:200,text:'{}'};
async function run(observe,opt={}){const w=world({observe,...opt});w.routes=null;
 const holder={};const w2=world({observe,routes:(m,u,b)=>holder.r?holder.r(m,u,b):{status:200,text:'{}'},...opt});holder.r=routes(w2);
 const out=await pageScript(w2);w2.runTimers();return {w:w2,out};}

test('originaux identiques avec et sans observateur : journal de la page, valeurs, exceptions, requêtes envoyées',async()=>{
 const a=await run(false),b=await run(true);
 assert.deepEqual(b.w.log,a.w.log,'tout ce que fait le code de la page, dans le même ordre');
 assert.deepEqual(b.out.map(x=>x.slice(0,2)),a.out.map(x=>x.slice(0,2)));
 assert.deepEqual(b.out.filter(x=>x[1]==='throw'),a.out.filter(x=>x[1]==='throw'),'mêmes exceptions, mêmes messages');
 assert.equal(b.out.filter(x=>x[1]==='throw').length,2);
 assert.deepEqual(b.w.network,a.w.network,'aucune requête de plus, mêmes arguments, même corps');
 assert.equal(b.w.network.length,a.w.network.length);
 assert.ok(b.w.log.filter(x=>x[0]==='page-loadend').length>=3,'les écouteurs de la page tournent');
 // Identité des objets : fetch non touché, méthodes enveloppées gardent nom et longueur.
 assert.equal(b.w.win.fetch,b.w.originalFetch,'fetch n’est pas enveloppé');
 const P=b.w.XHR.prototype,Q=a.w.XHR.prototype;
 for(const n of ['open','send'])assert.deepEqual([P[n].name,P[n].length],[Q[n].name,Q[n].length],n);
 for(const n of ['setRequestHeader','getResponseHeader','getAllResponseHeaders','addEventListener'])assert.equal(typeof P[n],'function',n+' non remplacé');
});
test('aucun en-tête lu ni écrit par l’observateur ; le jeton n’apparaît nulle part',async()=>{
 const {w}=await run(true),a=await run(false);
 for(const n of ['getResponseHeader','getAllResponseHeaders'])assert.equal(w.log.filter(x=>x[0]===n).length,0,n);
 assert.equal(w.log.filter(x=>x[0]==='setRequestHeader').length,a.w.log.filter(x=>x[0]==='setRequestHeader').length,'seuls les appels de la page');
 const all=JSON.stringify([w.observed(),w.posts]);assert.ok(!/SECRET|Bearer|Authorization/i.test(all.replace(/"Authorization"/g,'')),'jeton absent des messages');
 const code=strip(SOURCE);for(const interdit of ['getResponseHeader','getAllResponseHeaders','setRequestHeader','Authorization','stopPropagation','preventDefault','.trigger(','.open(','fetch=','eval(','new Function'])assert.ok(!code.includes(interdit),'code : '+interdit);
 assert.ok(!/\bchrome\.(storage|tabs|scripting|downloads|runtime\.(sendMessage|connect|getURL|onMessage))/.test(code),'monde principal : aucun appel de chrome.* (seule la lecture de chrome.runtime.id, pour s’abstenir en monde isolé)');
});
test('classes : seule la classe est notée ; connexion, jeton et autres comptés sans trace ; jamais l’URL',async()=>{
 const {w}=await run(true),e=w.observed(),kinds=e.map(x=>x.kind);
 assert.deepEqual(kinds,['write','list-page'],'écriture et page de liste seulement');
 const texte=JSON.stringify(e);for(const secret of ['skiptoken','login.microsoftonline','oauth2','client_id','secret-client','/other/','esv.test','merge=true','status=invalid'])assert.ok(!texte.includes(secret),'jamais '+secret);
 assert.ok(w.ctl.stats().ignored>=2,'connexion et autre : comptées, pas notées');
 assert.equal(e.find(x=>x.kind==='list-page').listKey,'p-key','la liste porte sa clé (segment avant /rails), et elle seule');
 assert.ok(!JSON.stringify(e.filter(x=>x.kind==='write')).includes('p-key'),'le segment de projet ne fuit pas dans les écritures (identifiant de coupe seulement)');
 assert.deepEqual(['write','list-page','point-resource','auth','other','other'],[
  classify('PUT',ORIGIN+'/api/u3d/projects/x/rails/a/b'),classify('GET',ORIGIN+'/api/u3d/projects/x/rails?top=1'),classify('GET',ORIGIN+'/data/ept.json'),
  classify('GET','https://login.microsoftonline.com/t/oauth2/token'),classify('GET',ORIGIN+'/api/u3d/projects/x/rails/a/b'),classify('GET','::pas-une-url')]);
});
test('écriture : tentative, durée, identifiant de coupe, corps réduit aux nombres, booléens et courtes chaînes',async()=>{
 const {w}=await run(true),x=w.observed()[0];
 assert.deepEqual([x.kind,x.via,x.method,x.status,x.outcome,x.attempt,x.railPairId,x.urlClass],['write','xhr','PUT',204,'done',1,'traj__00+0071551.725/00071552.685','rail-pair-write']);
 assert.deepEqual(x.body,{a:1.5,b:-2.25,c:0,RailType:'U50',SeenByOperator:true},'objet, tableau, longue chaîne, clé douteuse : écartés');
 assert.equal(x.bodyKeys,9);assert.ok(x.durationMs>0&&x.endedEpochMs>x.startedEpochMs&&x.startedEpochMs>1e12);
 assert.deepEqual(writeBody('pas du json'),{keys:null,values:null});assert.deepEqual(writeBody(JSON.stringify([1,2])),{keys:null,values:null});assert.deepEqual(writeBody(null),{keys:null,values:null});
 assert.equal(railPairId(ORIGIN+'/x/rails/ok_1.2/3?y=1'),'ok_1.2/3');assert.equal(railPairId(ORIGIN+'/x/rails/'+'a'.repeat(200)),null);assert.equal(railPairId(ORIGIN+'/x/rails/a b'),null);assert.equal(railPairId(ORIGIN+'/x/rails/..%2F..%2Fetc'),null);assert.equal(railPairId(ORIGIN+'/x/rails/%2Fabs'),null);
});
test('tentatives successives : 1, 2, 3 après deux échecs ; une autre coupe repart à 1 ; la 204 clôt',async()=>{
 const seq=[503,500,204,204];let i=0;const w=world({routes:()=>({status:seq[i++],text:''})});
 const put=id=>{const x=new w.win.XMLHttpRequest();x.open('PUT',ORIGIN+'/api/rails/'+id,true);x.send('{"a":1}');};
 for(const id of ['p/1','p/1','p/1']){put(id);await tick();await tick();w.runTimers();}
 put('p/2');await tick();await tick();w.runTimers();
 assert.deepEqual(w.observed().map(x=>[x.railPairId,x.status,x.attempt]),[['p/1',503,1],['p/1',500,2],['p/1',204,3],['p/2',204,1]]);
});
test('page de liste : lignes, comptes par valeur de statut, taille ; les lignes ne sont pas conservées',async()=>{
 const {w}=await run(true),l=w.observed()[1];
 assert.deepEqual([l.kind,l.status,l.rows,l.basis],['list-page',200,1000,'row-string-values']);
 assert.equal(l.counts.valid+l.counts.invalid+l.counts.skipped,1000);assert.ok(l.counts.invalid>0&&l.counts.skipped>0&&l.counts.valid>0);assert.equal(l.chars,w.rows(1000).length);
 assert.ok(JSON.stringify(l).length<600,'pas de lignes dans l’entrée');
 assert.deepEqual(listSummary('{"value":[{"s":"valid"},{"s":"invalid","t":"valid"},3,null]}'),{rows:4,counts:{valid:1,invalid:1,skipped:0}});
 assert.deepEqual(listSummary('pas du json'),{rows:null,counts:null,skipped:'unreadable'});
 assert.equal(listSummary('x'.repeat(LIMITS.listChars+1)).skipped,'oversize');assert.deepEqual(listSummary(undefined),{rows:null,counts:null});
 // Réponse en erreur : pas de lecture du corps.
 const e=world({routes:()=>({status:500,text:'{"value":[]}'})}),x=new e.win.XMLHttpRequest();x.open('GET',ORIGIN+'/api/rails?top=1');x.send();await tick();e.runTimers();
 assert.deepEqual([e.observed()[0].status,e.observed()[0].rows],[500,null]);
});
test('panne de l’observateur avalée : message, horloge ou minuterie en panne ne changent rien pour la page',async()=>{
 const ref=await run(false);
 for(const opt of [{failPost:true},{failTimers:true},{failPost:true,failTimers:true}]){const b=await run(true,opt);
  assert.deepEqual(b.w.log,ref.w.log,JSON.stringify(opt));assert.deepEqual(b.w.network,ref.w.network);assert.deepEqual(b.out.map(x=>x.slice(0,2)),ref.out.map(x=>x.slice(0,2)));}
 // Enregistrement impossible à sérialiser : jalon gap, pas d'exception.
 const w=world();const c={};c.c=c;assert.doesNotThrow(()=>w.ctl.record({kind:'write',c}));assert.deepEqual([w.observed()[0].kind,w.observed()[0].reason],['gap','unserializable']);
});
test('tampon borné : 256 entrées au plus, le plus ancien perdu en premier, perte dite ; trop gros = gap',()=>{
 const w=world();for(let i=0;i<300;i++)w.ctl.record({kind:'resource',n:i});
 const s=w.ctl.stats();assert.deepEqual([s.seq,s.dropped,s.ringEntries],[300,44,256]);assert.ok(s.ringChars<=LIMITS.ringChars);
 w.posts.length=0;w.deliver({kind:'banane5:hello',afterSeq:0});const seqs=w.observed().map(x=>x.seq);assert.deepEqual([seqs[0],seqs.at(-1),seqs.length],[45,300,256],'la tête est perdue, le reste rejoué dans l’ordre');
 w.posts.length=0;w.deliver({kind:'banane5:hello',afterSeq:290});assert.deepEqual(w.observed().map(x=>x.seq),[291,292,293,294,295,296,297,298,299,300]);
 w.posts.length=0;w.ctl.record({kind:'write',body:{k:'x'.repeat(5000)}});assert.deepEqual([w.observed()[0].kind,w.observed()[0].reason,w.observed()[0].of],['gap','oversize','write']);
 const big=world();for(let i=0;i<300;i++)big.ctl.record({kind:'resource',pad:'y'.repeat(4000)});const bs=big.ctl.stats();assert.ok(bs.ringChars<=LIMITS.ringChars&&bs.ringEntries===256&&bs.dropped===44,'entrées de taille maximale : borne en octets tenue (256 × 4 096 = 1 Mo)');
});
test('fichiers de points : fenêtres de 250 ms, nombre et octets, rien d’autre ; le reste de la liste est ignoré',async()=>{
 const w=world(),mk=(name,t,r,b)=>({name:ORIGIN+name,startTime:t,responseEnd:r,transferSize:b,encodedBodySize:0});
 w.po().emit([mk('/d/ept.json',10,30,500),mk('/d/ept-hierarchy/0-0-0-0.json',12,40,700),mk('/d/ept-data/0-0-0-0.laz',20,90,10000),mk('/js/app.js',1,2,99),mk('/api/rails?top=1',3,4,99)]);
 assert.equal(w.observed().length,0,'rien avant la fin de la fenêtre');w.runTimers();
 assert.deepEqual(w.observed().map(x=>[x.kind,x.class,x.n,x.bytes,x.windowMs]),[['resource','point-resource',3,11200,250]]);
 const r=w.observed()[0];assert.ok(r.startedEpochMs===1e12+10&&r.endedEpochMs===1e12+90);
 w.po().emit([mk('/d/ept-data/1-0-0-0.laz',100,120,2000)]);w.runTimers();assert.deepEqual(w.observed().map(x=>x.n),[3,1],'seconde fenêtre distincte');
 assert.equal(w.po().options.type,'resource');assert.equal(w.po().options.buffered,true);
});
test('réglage : arrêt demandé = enveloppes inertes ; messages d’une autre source ou origine ignorés ; installation unique',async()=>{
 const off=world();off.deliver({kind:'banane5:config',enabled:false});const a=await run(false);
 const holder={};const w=world({routes:(m,u,b)=>holder.r(m,u,b)});holder.r=routes(w);w.deliver({kind:'banane5:config',enabled:false});
 const out=await pageScript(w);w.runTimers();assert.equal(w.observed().length,0,'rien noté');assert.deepEqual(w.log,a.w.log,'page identique');assert.deepEqual(w.network,a.w.network);
 w.deliver({kind:'banane5:config',enabled:true});const x=new w.win.XMLHttpRequest();x.open('PUT',ORIGIN+'/api/rails/z/1');x.send('{"a":1}');await tick();w.runTimers();assert.equal(w.observed().length,1,'réactivé');
 // Usurpation : source ou origine étrangère.
 w.deliver({kind:'banane5:config',enabled:false},{origin:'https://autre.test'});w.deliver({kind:'banane5:config',enabled:false},{source:{}});
 const y=new w.win.XMLHttpRequest();y.open('PUT',ORIGIN+'/api/rails/z/2');y.send('{"a":2}');await tick();w.runTimers();assert.equal(w.observed().length,2,'toujours actif');
 // Installation unique : pas de double enveloppe, pas de double entrée.
 assert.equal(install(w.win),null);const z=new w.win.XMLHttpRequest();z.open('PUT',ORIGIN+'/api/rails/z/3');z.send('{"a":3}');await tick();w.runTimers();assert.equal(w.observed().length,3);
 assert.equal(install(null),null);
});
test('mémoire de la page : pas de fuite de requêtes terminées (WeakMap), tentatives bornées',async()=>{
 const w=world({routes:()=>({status:503,text:''})});for(let i=0;i<200;i++){const x=new w.win.XMLHttpRequest();x.open('PUT',ORIGIN+'/api/rails/id'+i+'/1');x.send('{"a":1}');await tick();w.runTimers();}
 assert.equal(w.ctl.stats().ringEntries,200);assert.ok(w.ctl.stats().ringChars<=LIMITS.ringChars);
});
test('XHR réutilisé ou envoi relancé : une note par requête, jamais de doublon (relecture M2)',async()=>{
 const w=world({routes:()=>({status:204,text:''})}),x=new w.win.XMLHttpRequest();
 x.open('PUT',ORIGIN+'/api/rails/a/1');x.send('{"a":1}');await tick();w.runTimers();
 x.open('PUT',ORIGIN+'/api/rails/b/2');x.send('{"a":2}');await tick();w.runTimers();
 assert.deepEqual(w.observed().map(e=>[e.railPairId,e.status]),[['a/1',204],['b/2',204]],'deux requêtes, deux notes (et non trois)');
 const y=new w.win.XMLHttpRequest();y.open('PUT',ORIGIN+'/api/rails/c/3');y.throwOnce=true;assert.throws(()=>y.send('{"a":3}'),/une-fois/);y.send('{"a":3}');await tick();w.runTimers();
 assert.deepEqual(w.observed().slice(2).map(e=>e.railPairId),['c/3'],'envoi qui lève puis réussit : une seule note');
 const z=new w.win.XMLHttpRequest();z.open('PUT',ORIGIN+'/api/rails/d/4');z.send('{"a":4}');z.send('{"a":4}');await tick();w.runTimers();
 assert.equal(w.observed().filter(e=>e.railPairId==='d/4').length,1,'deux send sans open : une note');
});
test('filet pour fetch (relecture b) : compte les ressources fetch sur les chemins rails, par fenêtre, sans aucune URL',async()=>{
 const w=world(),mk=(name,t,r,type)=>({name:ORIGIN+name,startTime:t,responseEnd:r,transferSize:100,encodedBodySize:0,initiatorType:type});
 w.po().emit([mk('/api/u3d/projects/secret-p/rails/traj__1/2?merge=true',10,40,'fetch'),mk('/api/u3d/projects/secret-p/rails?top=1&sig=SECRETSIG',20,50,'fetch'),
  mk('/api/u3d/projects/secret-p/rails/x/1',5,9,'xmlhttprequest'),mk('/api/other/thing',5,9,'fetch'),mk('/d/ept.json',1,2,'fetch'),
  {name:'https://login.microsoftonline.com/t/oauth2/rails/token',startTime:1,responseEnd:2,initiatorType:'fetch'}]);
 w.runTimers();const e=w.observed(),f=e.filter(x=>x.kind==='fetch-rails');
 assert.deepEqual(f.map(x=>[x.n,x.windowMs,x.startedEpochMs,x.endedEpochMs]),[[2,250,1e12+10,1e12+50]],'deux fetch sur rails ; XHR, autre chemin et connexion ignorés');
 assert.equal(e.filter(x=>x.kind==='resource').length,1,'ept.json reste un fichier de points');
 const texte=JSON.stringify(e);for(const secret of ['secret-p','SECRETSIG','traj__1','oauth2','merge='])assert.ok(!texte.includes(secret),'jamais '+secret);
 w.po().emit([mk('/api/u3d/projects/p/rails/a/b',100,120,'fetch')]);w.runTimers();assert.deepEqual(w.observed().filter(x=>x.kind==='fetch-rails').map(x=>x.n),[2,1],'seconde fenêtre distincte');
 // observateur coupé : rien
 const off=world();off.deliver({kind:'banane5:config',enabled:false});off.po().emit([mk('/api/p/rails/a/b',1,2,'fetch')]);off.runTimers();assert.equal(off.observed().length,0);
});
test('marque « observateur présent » (M6) : version, installé avant les scripts de la page oui/non/inconnu, posée à la demande de l’instantané',()=>{
 const mark=(doc,data={})=>{const w=world({document:doc});assert.equal(w.observed().length,0,'rien posé à l’installation');w.deliver({kind:'banane5:snapshot',afterDenial:false,...data});return {w,m:w.observed().filter(e=>e.kind==='observer')};};
 let {m}=mark({readyState:'loading',scripts:{length:0}});
 assert.deepEqual([m.length,m[0].version,m[0].world,m[0].installedBeforePageScripts,m[0].readyState,m[0].scriptsAtInstall,m[0].afterDenial,m[0].enabled],[1,1,'MAIN',true,'loading',0,false,true]);
 assert.deepEqual(['dropped','ignored','seq'].map(k=>typeof m[0][k]),['number','number','number']);
 ({m}=mark({readyState:'complete',scripts:{length:12}}));assert.deepEqual([m[0].installedBeforePageScripts,m[0].readyState,m[0].scriptsAtInstall],[false,'complete',12]);
 ({m}=mark({readyState:'loading',scripts:{length:3}}));assert.equal(m[0].installedBeforePageScripts,false,'des scripts de la page ont déjà été analysés');
 ({m}=mark(undefined));assert.deepEqual([m[0].installedBeforePageScripts,m[0].readyState,m[0].scriptsAtInstall],[null,null,null],'inconnu : jamais deviné');
 ({m}=mark({readyState:'loading',scripts:{length:0}},{afterDenial:true}));assert.equal(m[0].afterDenial,true);
 const {w}=mark({readyState:'loading',scripts:{length:0}});w.deliver({kind:'banane5:snapshot'});w.deliver({kind:'banane5:config',enabled:false});w.deliver({kind:'banane5:snapshot'});
 const all=w.observed().filter(e=>e.kind==='observer');assert.deepEqual(all.map(e=>e.enabled),[true,true,false],'chaque demande pose une marque neuve (nouveau numéro) ; coupé = dit');
 assert.ok(all[1].seq>all[0].seq&&!JSON.stringify(all).includes('esv.test'));
});
const rowsJson=(n,seed=0)=>JSON.stringify({value:Array.from({length:n},(_,i)=>({Id:'secret-row-'+i,Status:['valid','invalid','skipped'][(i+seed)%3===0?1:(i+seed)%5===0?2:0],Free:'texte libre '+i}))});
async function listes(w,keys,n=1000){for(const k of keys){const x=new w.win.XMLHttpRequest();x.open('GET',ORIGIN+'/api/u3d/projects/'+k+'/rails?status=invalid&top=1000&sig=SECRETSIG');x.send();await tick();await tick();w.runTimers();}}
test('résumé des listes avant la séance : un résumé compact par page chargée, posé seulement après un refus (afterDenial), jamais les lignes ni les écritures',async()=>{
 let page=0;const w=world({routes:(m,u)=>/\/rails\?/.test(u)?{status:200,text:rowsJson(page++<2?1000:269,page)}:{status:204,text:''}});
 await listes(w,['p-key','p-key','p-key']);
 const wr=new w.win.XMLHttpRequest();wr.open('PUT',ORIGIN+'/api/u3d/projects/p-key/rails/id/1');wr.send('{"a":1}');await tick();w.runTimers();
 w.po().emit([{name:ORIGIN+'/d/ept.json',startTime:1,responseEnd:2,transferSize:5,initiatorType:'fetch'}]);w.runTimers();
 assert.deepEqual(w.observed().filter(e=>e.kind==='list-page').map(e=>e.listKey),['p-key','p-key','p-key'],'les pages portent la clé de liste (segment avant /rails)');
 w.posts.length=0;w.deliver({kind:'banane5:snapshot',afterDenial:false});assert.deepEqual(w.observed().map(e=>e.kind),['observer'],'séance déjà ouverte : pas de résumé (les pages ont été vues en direct)');
 w.posts.length=0;w.deliver({kind:'banane5:snapshot',afterDenial:true});const e=w.observed(),s=e.filter(x=>x.kind==='list-summary');
 assert.deepEqual(e.map(x=>x.kind),['observer','list-summary'],'ni écriture, ni fichier de points, ni page seule rejoués avant la séance');
 assert.deepEqual([s[0].listKey,s[0].pages,s[0].okPages,s[0].rows,s[0].beforeSession],['p-key',3,3,2269,true]);
 assert.equal(s[0].counts.valid+s[0].counts.invalid+s[0].counts.skipped,2269);assert.ok(s[0].chars>100000&&s[0].durationMs>=0&&s[0].lastEndedEpochMs>=s[0].firstStartedEpochMs&&s[0].firstStartedEpochMs>1e12);
 const texte=JSON.stringify(e);for(const secret of ['secret-row','texte libre','SECRETSIG','esv.test','status=invalid'])assert.ok(!texte.includes(secret),'jamais '+secret);assert.ok(texte.length<1200,'compact : '+texte.length);
});
test('résumé des listes : une clé par chargement ; clé douteuse = aucune ; comptes ou lignes inconnus = non mesuré ; 16 clés au plus',async()=>{
 const w=world({routes:(m,u)=>/bad/.test(u)?{status:200,text:'pas du json'}:{status:200,text:rowsJson(10)}});
 await listes(w,['k1','a%20b','k2-bad','k3']);w.posts.length=0;w.deliver({kind:'banane5:snapshot',afterDenial:true});
 const s=w.observed().filter(x=>x.kind==='list-summary'),by=Object.fromEntries(s.map(x=>[String(x.listKey),x]));
 assert.deepEqual(Object.keys(by).sort(),['k1','k2-bad','k3','null'],'« a%20b » : caractère non sûr, clé nulle');assert.deepEqual([by.k1.rows,by.k1.counts!==null],[10,true]);
 assert.deepEqual([by['k2-bad'].rows,by['k2-bad'].counts,by['k2-bad'].pages,by['k2-bad'].okPages],[null,null,1,1],'illisible : non mesuré, jamais zéro');
 const g=world({routes:()=>({status:200,text:rowsJson(2)})});await listes(g,Array.from({length:20},(_,i)=>'key'+i));g.posts.length=0;g.deliver({kind:'banane5:snapshot',afterDenial:true});
 assert.equal(g.observed().filter(x=>x.kind==='list-summary').length,16,'au plus 16 clés');
 const e=world({routes:()=>({status:503,text:''})});await listes(e,['k']);e.posts.length=0;e.deliver({kind:'banane5:snapshot',afterDenial:true});
 const r=e.observed().find(x=>x.kind==='list-summary');assert.deepEqual([r.pages,r.okPages,r.rows,r.counts],[1,0,null,null],'page en erreur : comptée, non lue');
});
test('listKey, ses limites : segment avant /rails, caractères sûrs seulement',()=>{
 const {listKey}=require('../src/esv-observer.js');
 assert.equal(listKey(ORIGIN+'/api/u3d/projects/abc_1.2-x/rails?top=1'),'abc_1.2-x');assert.equal(listKey(ORIGIN+'/rails'),null);assert.equal(listKey(ORIGIN+'/a/b%2Fc/rails'),null);
 assert.equal(listKey(ORIGIN+'/api/'+'a'.repeat(81)+'/rails'),null);assert.equal(listKey('::'),null);assert.equal(listKey(ORIGIN+'/api/u3d/projects/p/rails/x/1'),null,'écriture : pas une liste');
});
