'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin}=require('./helpers/esv-lent.cjs');
/* Texte de Chrome quand la page se recharge pendant qu'une réponse est attendue. */
const CANAL='A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received';
const finMoteur=async r=>{let v;for(let i=0;i<400&&(v=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));return v;};
/* 4.8.0 — septième revue : F5 pendant une lecture LiDAR. Chrome rejette la
 * commande (« message channel closed ») : pause reprenable, jamais ERROR. */
test('F5 pendant la lecture : « sans réponse » (reprenable), puis « Reprendre » finit le lot',async()=>{
  const r=await pilote(espion,{start:100,end:102,settings:reglages(),esv:esv=>{esvLent(esv,{lecturesInstables:false});const c=esv.capture.bind(esv);
    esv.capture=async(...a)=>{if(esv.identity.cut===102&&!esv.recharges){esv.onReload();throw Error(CANAL);}return c(...a);};}});
  await r.b.settle();let view=await finMoteur(r);
  assert.equal(view.batch.state,'PAUSED_ADAPTER_UNRESPONSIVE');assert.match(view.batch.error?.message||view.notice||'',/rechargée ou fermée|F5/);
  await r.b.api('resume');view=await attendreFin(r);
  assert.equal(view.batch.stoppedAtEnd?.cut,102);assert.notEqual(view.batch.state,'ERROR');
});
test('onglet fermé pendant la pose : « sans réponse », jamais ERROR',async()=>{
  const r=await pilote(espion,{start:100,end:102,settings:reglages(),esv:esv=>{esvLent(esv,{lecturesInstables:false});const a0=esv.apply.bind(esv);let fait=false;
    esv.apply=async(...a)=>{if(esv.identity.cut===100&&!fait){fait=true;throw Error('No tab with id: 1.');}return a0(...a);};}});
  await r.b.settle();const view=await finMoteur(r);assert.equal(view.batch.state,'PAUSED_ADAPTER_UNRESPONSIVE');
});
/* « Arrêter » pendant que « Reprendre » attend une page ESV qui ne revient pas. */
test('« Arrêter » pendant l\'attente de la page rafraîchie : la reprise s\'interrompt, le lot est arrêté',async()=>{
  const r=await pilote(espion,{start:100,end:102,settings:reglages({rafraichirAttenteMs:60000}),esv:esv=>{esvLent(esv,{lecturesInstables:false});const c=esv.capture.bind(esv);
    esv.capture=async(...a)=>{if(esv.identity.cut===102&&!esv.recharges){esv.onReload();throw Error(CANAL);}return c(...a);};
    esv.onInject=()=>{};/* la page ne se réinstalle jamais */const ping=esv.ping.bind(esv);
    esv.ping=async(...a)=>{if(esv.recharges)throw Error('Could not establish connection. Receiving end does not exist.');return ping(...a);};}});
  await r.b.settle();await finMoteur(r);
  const t0=Date.now(),reprise=r.b.api('resume').then(()=>null,e=>e);await new Promise(x=>setTimeout(x,1500));
  await r.b.api('stop');const e=await reprise;const view=await r.b.api('view');
  assert.ok(Date.now()-t0<10000,'la reprise ne va pas au bout des 60 s');assert.ok(e,'la reprise signale l\'arrêt');assert.equal(view.batch.state,'STOPPED');
});
/* F5 pendant la pose : résultat incertain (réconciliation), « Archiver le
 * résultat interrompu », puis « Reprendre » : le lot revient au cut, le repose
 * et finit comme sans F5 (dernier cut posé, non validé). */
test('F5 pendant la pose, archivage puis « Reprendre » : le lot finit comme sans F5',async()=>{
  const r=await pilote(espion,{start:100,end:102,settings:reglages(),esv:esv=>{esvLent(esv,{lecturesInstables:false});const a0=esv.apply.bind(esv);
    esv.apply=async(...a)=>{if(esv.identity.cut===100&&!esv.recharges){esv.onReload();esv.identity.cut=99;throw Error(CANAL);}return a0(...a);};}});
  await r.b.settle();let view=await finMoteur(r);
  assert.equal(view.batch.state,'PAUSED_ADAPTER_UNRESPONSIVE');assert.equal(view.reconcileRequired,true,'pose incertaine : à contrôler');
  await r.b.api('close-uncertain');await r.b.api('resume');view=await attendreFin(r);
  assert.deepEqual(view.batch.processed.map(x=>x.cut),[100]);assert.deepEqual(view.batch.deferred.map(x=>x.identity?.cut),[101]);
  assert.deepEqual(view.batch.stoppedAtEnd&&{cut:view.batch.stoppedAtEnd.cut,applied:view.batch.stoppedAtEnd.applied},{cut:102,applied:true});
});
/* Écho : F5 pendant l'observation. La consigne dit « Connecter puis Reprendre »,
 * et c'est bien ce qui la relance. */
test('Écho, page rechargée : « sans réponse » avec la consigne Connecter puis Reprendre, qui la relance',async()=>{
  const {background}=require('./helpers/fond-relecture.cjs'),b=background();let absent=false;
  for(const nom of ['nativeSnapshot','nativePause','nativeResume','state','ping']){const f=b.adapter[nom].bind(b.adapter);b.adapter[nom]=async(...a)=>{if(absent)throw Error(CANAL);return f(...a);};}
  b.adapter.onInject=()=>{absent=false;};
  await b.api('connect',{tabId:1});await b.api('native-start');absent=true;
  await assert.rejects(()=>b.api('native-pause'),/rechargée ou fermée.*Écho, clique sur Connecter puis Reprendre/);
  assert.equal((await b.api('view')).native.status,'PAUSED_ADAPTER_UNRESPONSIVE');
  await b.api('connect',{tabId:1});await b.api('native-resume');assert.equal((await b.api('view')).native.status,'RUNNING');
});
