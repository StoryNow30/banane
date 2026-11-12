'use strict';
/* CH-111 — le relais (telecommande/worker.js) essayé dans Node : routes, enveloppe stricte, logique du canal (dernier état rendu au téléphone,
 * relais dans les deux sens, une seule Ariane, présence, taille et débit plafonnés, écritures en base bornées). Le relais ne déchiffre rien :
 * il n'a pas la clé, et l'essai vérifie qu'il ne transmet que l'enveloppe réécrite. Sans Cloudflare (le vrai Worker : SUPPOSÉ). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chargerWorker}=require('./helpers/ch111-relais-local.cjs');
const T=require('../src/telecommande.js');
const H=['https:/','/relais-essai','.exemple','.test'].join(''),CANAL='0123456789abcdef0123456789abcdef';
function ctxCanal(){const tags=new Map(),stock=new Map(),ecritures=[];
 return {tags,stock,ecritures,acceptWebSocket(ws,t){tags.set(ws,t);},getWebSockets(t){return [...tags].filter(([w,x])=>w.ouverte&&x.includes(t)).map(([w])=>w);},getTags(ws){return tags.get(ws)||[];},
  storage:{get:async k=>stock.get(k),put:async(k,v)=>{ecritures.push(k);stock.set(k,v);}}};}
const sock=()=>({ouverte:true,recus:[],send(t){this.recus.push(t);},close(){this.ouverte=false;}});

test('routes : page, canal (32 hex, rôle connu), le reste refusé',async()=>{const W=await chargerWorker();
 assert.deepEqual(W.route(H+'/'),{page:true});assert.deepEqual(W.route(H+'/canal/'+CANAL+'?role=tel'),{canal:CANAL,role:'tel'});
 assert.deepEqual(W.route(H+'/canal/'+CANAL+'?role=ariane'),{canal:CANAL,role:'ariane'});
 assert.deepEqual(W.route(H+'/canal/'+CANAL+'?role=autre'),{erreur:400});
 for(const p of ['/canal/'+CANAL.toUpperCase()+'?role=tel','/canal/123?role=tel','/canal/'+CANAL+'/x?role=tel','/admin','/telephone.html'])assert.deepEqual(W.route(H+p),{erreur:404},p);
 const page=await W.default.fetch(new Request(H+'/'),{});assert.equal(page.status,200);assert.match(page.headers.get('content-type'),/text\/html/);
 assert.match(page.headers.get('content-security-policy'),/connect-src 'self'/);assert.equal(page.headers.get('referrer-policy'),'no-referrer');
 const html=await page.text();assert.match(html,/<title>Ariane<\/title>/);assert.ok(!/<link[^>]+manifest/.test(html),'pas de manifeste : l’écran d’accueil garde le #k=');
 assert.equal((await W.default.fetch(new Request(H+'/',{method:'POST'}),{})).status,405);
 assert.equal((await W.default.fetch(new Request(H+'/canal/'+CANAL+'?role=tel'),{})).status,426,'sans en-tête Upgrade');
 assert.equal((await W.default.fetch(new Request(H+'/x'),{})).status,404);});

test('enveloppe : exactement {v:1, iv(16), d}, 16 Ko au plus ; réécrite',async()=>{const W=await chargerWorker(),iv='A'.repeat(16);
 assert.equal(W.enveloppe(JSON.stringify({d:'xyz',iv,v:1})),JSON.stringify({v:1,iv,d:'xyz'}));
 for(const m of [JSON.stringify({v:1,iv,d:'x',plus:1}),JSON.stringify({v:2,iv,d:'x'}),JSON.stringify({v:1,iv:'A',d:'x'}),JSON.stringify({v:1,iv,d:'<script>'}),
  JSON.stringify({v:1,type:'presence',ariane:true}),'[1,2,3]','pas du json',null,JSON.stringify({v:1,iv,d:'A'.repeat(16400)})])assert.equal(W.enveloppe(m),null,String(m).slice(0,40));});

test('canal : dernier état rendu au téléphone qui arrive, relais dans les deux sens, une seule Ariane, présence',async()=>{const W=await chargerWorker(),ctx=ctxCanal(),L=new W.CanalLogique(ctx);
 const D=await T.deriver(T.tirerCle()),env=async(sens,o)=>JSON.stringify(await T.chiffrer(D,sens,o));
 const a1=sock();await L.accepter(a1,'ariane');
 const etat=await env('a>t',{type:'etat',n:1,h:Date.now(),lot:{etat:'cours'}});await L.message(a1,etat);
 const t1=sock();await L.accepter(t1,'tel');assert.deepEqual(t1.recus.map(x=>JSON.parse(x).type??'chiffre'),['presence','chiffre']);
 assert.equal(JSON.parse(t1.recus[0]).ariane,true);assert.equal(t1.recus[1],etat);
 const ordre=await env('t>a',{type:'ordre',n:2,h:Date.now(),ordre:'lot-pause'});await L.message(t1,ordre);assert.deepEqual(a1.recus,[ordre]);
 /* une deuxième Ariane remplace la première */
 const a2=sock();await L.accepter(a2,'ariane');assert.equal(a1.ouverte,false);ctx.tags.delete(a1);
 await L.message(t1,ordre);assert.deepEqual(a2.recus,[ordre]);assert.equal(a1.recus.length,1);
 /* départ d'Ariane : présence « false » aux téléphones */
 a2.ouverte=false;L.fermeture(a2);assert.equal(JSON.parse(t1.recus.at(-1)).ariane,false);
 /* un message d'un téléphone n'est jamais renvoyé aux téléphones */
 const t2=sock();await L.accepter(t2,'tel');const n=t2.recus.length;await L.message(t1,ordre);assert.equal(t2.recus.length,n);});

test('canal : débit plafonné, taille plafonnée, écriture en base au plus une fois par minute',async()=>{const W=await chargerWorker(),ctx=ctxCanal(),L=new W.CanalLogique(ctx);
 const a=sock(),t=sock();await L.accepter(a,'ariane');await L.accepter(t,'tel');const e=JSON.stringify({v:1,iv:'A'.repeat(16),d:'BBBB'});
 for(let i=0;i<30;i++)await L.message(t,e,1000);assert.equal(a.recus.length,20,'20 ordres par 10 s');
 await L.message(t,e,12000);assert.equal(a.recus.length,21,'fenêtre suivante');
 const base=t.recus.length;for(let i=0;i<5;i++)await L.message(a,e,1000+i*1000);assert.equal(t.recus.length,base+5);assert.equal(ctx.ecritures.length,1,'une écriture pour 5 états en 5 s');
 await L.message(a,e,70000);assert.equal(ctx.ecritures.length,2);
 await L.message(a,JSON.stringify({v:1,iv:'A'.repeat(16),d:'A'.repeat(17000)}),71000);assert.equal(t.recus.length,base+6,'trop gros : jeté');});
