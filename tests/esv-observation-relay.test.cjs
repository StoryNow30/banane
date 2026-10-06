'use strict';
/* V1 (test 2) : relais de l'observateur passif par le pont isolé (src/bridge.js).
 * Le message vient de la PAGE : source non authentifiée, donc copie, schéma et
 * tailles bornés ; trous et file pleine dits par un jalon « gap » ; hors séance
 * (réponse accept:false) rien n'est gardé ; les commandes d'ESV ne changent pas. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);   // objets de VM différentes : comparés à plat
const {bridge}=require('./helpers/bridge.cjs');
const entry=(seq,extra={})=>({seq,kind:'resource',n:1,bytes:10,...extra});
const msg=(seq,observer='obs-1',extra)=>({kind:'banane5:esv-observation',v:1,observer,entry:entry(seq,extra)});
const flush=async f=>{const t=[...f.timers.entries()].at(-1);f.timers.delete(t[0]);await t[1].fn();};
const out=f=>f.traces.filter(m=>m&&m.kind==='esv-observation');
const seqs=m=>m.entries.map(e=>e.seq);

test('le pont se signale à l’observateur au démarrage',()=>{
 const f=bridge();deq(f.sent[0],{kind:'banane5:hello',afterSeq:0});
});
test('entrées valides : copiées, dans l’ordre, un seul message ; aucune authentification de canal requise',async()=>{
 const f=bridge(),a=msg(1);f.emit(a);f.emit(msg(2));f.emit(msg(3));a.entry.n=999;
 await flush(f);const [m]=out(f);assert.equal(out(f).length,1);deq([m.kind,m.observer,seqs(m)],['esv-observation','obs-1',[1,2,3]]);
 assert.equal(m.entries[0].n,1,'copie profonde : la page ne change plus ce qui est parti');
});
test('refusés sans trace : autre origine ou source, schéma, observateur, entrée, numéro, taille',()=>{
 const f=bridge(),w=f.sent.length,t=f.timers.size,win=undefined;
 const bad=[{...msg(1),v:2},{...msg(1),observer:'x'.repeat(81)},{...msg(1),observer:7},{...msg(1),entry:null},{...msg(1),entry:'texte'},msg(0),msg(-3),msg(1.5),msg('1'),
  msg(1,'obs',{kind:'k'.repeat(25)}),msg(1,'obs',{pad:'y'.repeat(5000)}),{kind:'banane5:esv-observation',v:1}];
 for(const d of bad)f.emit(d);
 f.rawEmit({source:{},origin:'https://esv.lidar.altametris.xyz',data:msg(1)});f.rawEmit({source:undefined,origin:'https://autre.test',data:msg(1)});
 assert.equal(f.timers.size,t,'aucune file, aucune minuterie');assert.equal(out(f).length,0);assert.equal(f.sent.length,w);
});
test('doublons et retours en arrière ignorés ; autre page (autre identifiant) repart de 1',async()=>{
 const f=bridge();for(const s of [1,2,2,1,3])f.emit(msg(s));await flush(f);deq(seqs(out(f)[0]),[1,2,3]);
 f.emit(msg(1,'obs-2'));f.emit(msg(2,'obs-2'));await flush(f);deq([out(f)[1].observer,seqs(out(f)[1])],['obs-2',[1,2]]);
});
test('trou de numérotation : jalon gap « ring-overflow », jamais de trou muet',async()=>{
 const f=bridge();f.emit(msg(5));f.emit(msg(6));f.emit(msg(10));await flush(f);
 deq(out(f)[0].entries.map(e=>[e.kind,e.seq,e.lost,e.reason]),[['gap',0,4,'ring-overflow'],['resource',5,undefined,undefined],['resource',6,undefined,undefined],['gap',0,3,'ring-overflow'],['resource',10,undefined,undefined]]);
});
test('file bornée à 100 : le plus ancien perdu, perte dite en tête du message suivant ; messages de 50 entrées au plus',async()=>{
 const f=bridge();for(let s=1;s<=120;s++)f.emit(msg(s));
 await flush(f);await flush(f);await flush(f);const m=out(f);assert.equal(m.length,3);assert.ok(m.every(x=>x.entries.length<=50));
 deq(m[0].entries[0],{seq:0,kind:'gap',lost:20,reason:'bridge-queue'});
 deq(m.flatMap(x=>seqs(x)).filter(s=>s>0),Array.from({length:100},(_,i)=>i+21));
 assert.equal(f.timers.size>=0,true);
});
test('taille d’un message bornée (64 Ko) : les grosses entrées partent en plusieurs messages',async()=>{
 const f=bridge();for(let s=1;s<=30;s++)f.emit(msg(s,'obs-1',{pad:'z'.repeat(3000)}));
 let n=0;while(out(f).reduce((a,x)=>a+x.entries.length,0)<30&&n++<10)await flush(f);
 const m=out(f);assert.ok(m.length>=2);for(const x of m)assert.ok(JSON.stringify(x.entries).length<=65536+4100,'≤ 64 Ko (+ une entrée)');
 deq(m.flatMap(seqs),Array.from({length:30},(_,i)=>i+1));
});
test('hors séance (accept:false) : file vidée, rien gardé, aucun faux trou ensuite',async()=>{
 const f=bridge({observationReply:()=>({accept:false,reason:'no-session'})});for(let s=1;s<=10;s++)f.emit(msg(s));
 await flush(f);assert.equal(f.timers.size>=0,true);f.emit(msg(11));await flush(f);
 deq([seqs(out(f)[0]).length,seqs(out(f)[1])],[10,[11]],'la suite repart sans jalon gap');
});
test('réglage coupé par le service worker : l’observateur est prévenu ; panne du service worker avalée',async()=>{
 const f=bridge({observationReply:()=>({accept:false,enabled:false})});f.emit(msg(1));await flush(f);
 deq(f.sent.at(-1),{kind:'banane5:config',enabled:false});
 const g=bridge({observationReply:()=>{throw Error('service worker absent');}});g.emit(msg(1));await assert.doesNotReject(flush(g));
});
test('les commandes d’ESV gardent leur contrôle de canal ; l’observation n’y touche pas',()=>{
 const f=bridge(),c=f.command('state'),before=f.sent.length;
 f.emit({kind:'banane3:result',id:c.request.id,result:{}});assert.equal(c.replies.length,0,'sans canal : ignoré');f.deliver(c,{kind:'banane3:result',result:{ok:1}});assert.equal(c.replies.length,1);
 assert.equal(f.sent.length,before);
});
test('hors séance avec plus de 50 entrées en attente : le reste de la file est vidé, plus rien ne part',async()=>{
 const f=bridge({observationReply:()=>({accept:false,reason:'no-session'})});for(let s=1;s<=80;s++)f.emit(msg(s));
 await flush(f);assert.equal(out(f)[0].entries.length,50);const reste=[...f.timers.entries()].at(-1);f.timers.delete(reste[0]);await reste[1].fn();
 assert.equal(out(f).length,1,'la suite de la file n’est pas envoyée : hors séance, rien n’est gardé');
});
const snaps=f=>f.sent.filter(x=>x.kind==='banane5:snapshot');
test('début de séance (M6) : la première réponse accept:true demande l’instantané ; après une absence de séance, afterDenial:true ; jamais de répétition',async()=>{
 let accept=true;const f=bridge({observationReply:()=>({accept})});
 f.emit(msg(1));await flush(f);deq(snaps(f),[{kind:'banane5:snapshot',afterDenial:false}]);
 f.emit(msg(2));await flush(f);assert.equal(snaps(f).length,1,'pas de répétition tant que la séance dure');
 accept=false;f.emit(msg(3));await flush(f);assert.equal(snaps(f).length,1);
 accept=true;f.emit(msg(4));await flush(f);deq(snaps(f).at(-1),{kind:'banane5:snapshot',afterDenial:true});assert.equal(snaps(f).length,2);
});
test('début de séance appris par le battement (launcher-status) : même demande, sans message d’observation',async()=>{
 let seance=false;const f=bridge({launcherStatus:()=>({visible:true,observation:{seance}})}),tick=()=>new Promise(r=>setImmediate(r));
 f.uiMessage({kind:'launcher-visibility',visible:true});await tick();assert.equal(snaps(f).length,0);
 seance=true;f.uiMessage({kind:'launcher-visibility',visible:true});await tick();deq(snaps(f),[{kind:'banane5:snapshot',afterDenial:true}]);
 f.uiMessage({kind:'launcher-visibility',visible:true});await tick();assert.equal(snaps(f).length,1,'une seule demande par début de séance');
 seance=false;f.uiMessage({kind:'launcher-visibility',visible:true});await tick();seance=true;f.uiMessage({kind:'launcher-visibility',visible:true});await tick();assert.equal(snaps(f).length,2,'nouvelle séance : nouvelle demande');
 assert.equal(out(f).length,0,'aucun message d’observation envoyé');
 const g=bridge({launcherStatus:()=>({visible:true})});g.uiMessage({kind:'launcher-visibility',visible:true});await tick();assert.equal(snaps(g).length,0,'réponse sans état de séance : rien');
});
/* ---- Test 2 final (mission F) : démarrage immédiat, avant le premier battement de 15 s ---- */
test('démarrage immédiat : entrées d’avant la séance restées sans réponse (onglet pas encore choisi) ou refusées ; la séance apprise sans « pas de séance » vu avant → résumés demandés, une seule fois',async()=>{
 const tk=()=>new Promise(r=>setImmediate(r));
 // Le service worker ne répond pas aux messages d'un onglet non choisi (réponse indéfinie) ; le battement n'y ajoute pas d'état de séance.
 let seance=false,reply;const f=bridge({observationReply:()=>reply,launcherStatus:()=>({visible:true,...(seance?{observation:{seance:true}}:{})})});
 f.emit(msg(1));await flush(f);f.emit(msg(2));await flush(f);assert.equal(snaps(f).length,0,'aucun état de séance appris : pas de marque');
 seance=true;f.uiMessage({kind:'launcher-visibility',visible:true});await tk();
 deq(snaps(f),[{kind:'banane5:snapshot',afterDenial:true}],'les entrées d’avant n’ont pas été rangées : le résumé doit partir');
 f.uiMessage({kind:'launcher-visibility',visible:true});await tk();assert.equal(snaps(f).length,1,'une seule fois par séance, aucun message continu');
 // Même chose quand c'est une réponse accept:true (et non le battement) qui apprend la séance.
 let accept;const g=bridge({observationReply:()=>accept});g.emit(msg(1));await flush(g);accept={accept:true};g.emit(msg(2));await flush(g);
 deq(snaps(g),[{kind:'banane5:snapshot',afterDenial:true}],'réponse indéfinie puis accept:true');g.emit(msg(3));await flush(g);assert.equal(snaps(g).length,1);
 // Service worker absent (échec d'envoi) : même chose.
 let marche=false;const h=bridge({observationReply:()=>{if(!marche)throw Error('service worker absent');return {accept:true};}});
 h.emit(msg(1));await flush(h);marche=true;h.emit(msg(2));await flush(h);deq(snaps(h),[{kind:'banane5:snapshot',afterDenial:true}]);
});
test('séance déjà ouverte au chargement de la page (changement de partie en plein lot) : tout a été rangé en direct, aucun résumé demandé',async()=>{
 const f=bridge({observationReply:()=>({accept:true})});f.emit(msg(1));await flush(f);f.emit(msg(2));await flush(f);
 deq(snaps(f),[{kind:'banane5:snapshot',afterDenial:false}],'première réponse accept:true : rien de perdu avant');
 const tk=()=>new Promise(r=>setImmediate(r)),g=bridge({launcherStatus:()=>({visible:true,observation:{seance:true}})});g.uiMessage({kind:'launcher-visibility',visible:true});
 return tk().then(()=>deq(snaps(g),[{kind:'banane5:snapshot',afterDenial:false}],'séance connue d’emblée, rien envoyé avant : rien de perdu'));
});
