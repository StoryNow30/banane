'use strict';
/* V1 (test 2) : de bout en bout, vrai observateur (fausse page), vrai pont, vrai service worker en VM.
 * Avant le lot : les listes sont vues, mais rien n'est journalisé. Au début de la séance : la marque
 * « observateur présent » et un résumé compact par chargement de liste (comptes seulement), jamais les
 * lignes, jamais les écritures ni les fichiers de points d'avant la séance. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {bridge}=require('./helpers/bridge.cjs'),{world,tick,ORIGIN}=require('./helpers/fake-page.cjs'),{production}=require('./helpers/perf-production.cjs');
const rows=(n,seed)=>JSON.stringify({value:Array.from({length:n},(_,i)=>({Id:'secret-row-'+i,S:['valid','invalid','skipped'][(i+seed)%7===0?1:(i+seed)%11===0?2:0]}))});
test('listes chargées avant le lot : résumé et marque au début de séance, rien d’autre d’avant la séance',async()=>{
 const sw=production();await sw.api('connect',{tabId:1});await sw.api('settings',{mode:'automatic-test'});const eng=sw.get('engine');
 const f=bridge({observationReply:m=>sw.raw({kind:'esv-observation',observer:m.observer,entries:m.entries}).out,launcherStatus:()=>sw.raw({kind:'launcher-status'}).out});
 let page=0;const w=world({document:{readyState:'loading',scripts:{length:0}},routes:(mm,u)=>/\/rails\?/.test(u)?{status:200,text:rows(page++<2?1000:269,page)}:{status:204,text:''}});
 let nSent=0,nPost=0;const pump=()=>{for(;nPost<w.posts.length;)f.emit(w.posts[nPost++].m);for(;nSent<f.sent.length;){const m=f.sent[nSent++];if(String(m.kind).startsWith('banane5:'))w.deliver(m);}};
 const flush=async()=>{pump();const t=[...f.timers.entries()].at(-1);if(t&&t[1].ms===250){f.timers.delete(t[0]);await t[1].fn();}pump();};
 const refresh=async()=>{f.uiMessage({kind:'launcher-visibility',visible:true});await tick();pump();};
 const xhr=async(m,u,b)=>{const x=new w.win.XMLHttpRequest();x.open(m,ORIGIN+u);x.send(b);await tick();await tick();w.runTimers();pump();};
 const stored=()=>sw.store.events.filter(e=>e.type==='esv-observation');
 pump();
 // AVANT le lot : trois pages de liste, une écriture, des fichiers de points.
 for(let i=0;i<3;i++)await xhr('GET','/api/u3d/projects/p-key/rails?top=1000&sig=SECRETSIG');await xhr('PUT','/api/u3d/projects/p-key/rails/old/1','{"a":1}');
 w.po().emit([{name:ORIGIN+'/d/ept.json',startTime:1,responseEnd:2,transferSize:5,initiatorType:'xmlhttprequest'}]);w.runTimers();pump();
 await flush();await refresh();assert.equal(stored().length,0,'avant le lot : rien journalisé');
 // DÉBUT DE SÉANCE : un lot est ouvert ; le battement l'apprend.
 eng.s.batch={id:'lot-be',state:'RUNNING',scope:{part:23,start:100,end:101}};await refresh();await flush();await flush();
 const e=stored();assert.deepEqual(e.map(x=>x.kind).sort(),['list-summary','observer'],'marque et résumé, rien d’autre');
 const o=e.find(x=>x.kind==='observer'),s=e.find(x=>x.kind==='list-summary');
 assert.deepEqual([o.installedBeforePageScripts,o.afterDenial,o.world,o.version],[true,true,'MAIN',1]);
 assert.deepEqual([s.listKey,s.pages,s.rows,s.beforeSession],['p-key',3,2269,true]);assert.equal(s.counts.valid+s.counts.invalid+s.counts.skipped,2269);
 // PENDANT la séance : l'écriture est journalisée comme avant, une seule marque.
 await xhr('PUT','/api/u3d/projects/p-key/rails/new/2','{"a":2}');await flush();
 const w2=stored().filter(x=>x.kind==='write');assert.deepEqual(w2.map(x=>x.railPairId),['new/2'],'seule l’écriture de la séance est rangée (pas celle d’avant)');
 assert.equal(stored().filter(x=>x.kind==='observer').length,1);assert.equal(stored().filter(x=>x.kind==='resource').length,0,'pas de fichiers de points d’avant la séance');
 const texte=JSON.stringify(stored());for(const secret of ['secret-row','SECRETSIG','esv.test','p-key/rails/old'])assert.ok(!texte.includes(secret),'jamais '+secret);
 assert.ok(sw.commands.length>=0);
});
/* Mission F (banc ESV local) : l'onglet est chargé AVANT d'être choisi dans Ariane ; le service worker ne répond pas à un onglet non
 * choisi ; la séance démarre tout de suite après le choix, avant le premier battement de 15 s. Les listes d'avant doivent être résumées. */
test('démarrage immédiat après le choix de l’onglet : le résumé des listes d’avant la séance est rangé sans attendre le battement',async()=>{
 const sw=production(),autre={id:'test',tab:{id:99},url:'https://esv.lidar.altametris.xyz/rails_validation/x'};let sender=autre;
 const f=bridge({observationReply:m=>sw.raw({kind:'esv-observation',observer:m.observer,entries:m.entries},sender).out,launcherStatus:()=>sw.raw({kind:'launcher-status'},sender).out});
 let page=0;const w=world({document:{readyState:'loading',scripts:{length:0}},routes:(mm,u)=>/\/rails\//.test(u)&&mm==='GET'?{status:200,text:rows(page++<2?1000:269,page)}:{status:204,text:''}});
 let nSent=0,nPost=0;const pump=()=>{for(;nPost<w.posts.length;)f.emit(w.posts[nPost++].m);for(;nSent<f.sent.length;){const m=f.sent[nSent++];if(String(m.kind).startsWith('banane5:'))w.deliver(m);}};
 const flush=async()=>{pump();const t=[...f.timers.entries()].at(-1);if(t&&t[1].ms===250){f.timers.delete(t[0]);await t[1].fn();}pump();};
 const refresh=async()=>{f.uiMessage({kind:'launcher-visibility',visible:true});await tick();pump();};
 const xhr=async(m,u,b)=>{const x=new w.win.XMLHttpRequest();x.open(m,ORIGIN+u);x.send(b);await tick();await tick();w.runTimers();pump();};
 const stored=()=>sw.store.events.filter(e=>e.type==='esv-observation');
 pump();
 // Page chargée, onglet pas encore choisi : trois pages de la liste d'une partie (…/rails/<table>), la question « invalides », puis le premier envoi au service worker.
 await xhr('GET','/api/u3d/projects/undefined/rails?&status=invalid&top=1');for(let i=0;i<3;i++)await xhr('GET','/api/u3d/projects/p-key/rails/traj__00+X?npk='+i);
 await flush();await refresh();assert.equal(stored().length,0,'onglet non choisi : rien rangé');
 // L'onglet est choisi et la séance démarre aussitôt : un seul battement, qui apprend la séance.
 await sw.api('connect',{tabId:1});await sw.api('settings',{mode:'automatic-test'});sender=undefined;
 sw.get('engine').s.batch={id:'lot-imm',state:'RUNNING',scope:{part:23,start:100,end:101}};
 await refresh();await flush();await flush();
 const e=stored(),o=e.find(x=>x.kind==='observer'),s=e.filter(x=>x.kind==='list-summary'),by=Object.fromEntries(s.map(x=>[x.listKey,x]));
 assert.ok(o,'la marque est rangée');assert.equal(o.afterDenial,true);
 assert.deepEqual([by['traj__00+X']?.pages,by['traj__00+X']?.rows,by['traj__00+X']?.beforeSession,by.undefined?.pages],[3,2269,true,1],'résumé de la partie (clé = la table) et « invalides » à part');
 assert.equal(s.length,2,'un résumé par clé, une seule fois');assert.equal(e.filter(x=>x.kind==='list-page').length,0,'aucune page d’avant la séance rejouée');
});
