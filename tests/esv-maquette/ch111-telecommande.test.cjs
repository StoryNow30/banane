'use strict';
/* CH-111 (D-345) — BOUT EN BOUT DANS CHROMIUM : l'extension RÉELLE (copie avec chantiers/CH-111/manifest.patch appliqué, plus l'hôte local du relais
 * dans `optional_host_permissions` pour l'essai), le relais simulé local (vrai code de telecommande/worker.js, HTTPS + WebSocket, Node) et la page
 * du téléphone servie par ce relais, ouverte à la taille d'un iPhone. Appairage par la feuille du panneau (Réglages › Télécommande), état en direct,
 * ordres « Pause » et « Arrêter le lot » (avec confirmation), « Ariane hors ligne », reconnexion après une coupure du relais, « Couper la télécommande ».
 * Le relais ne voit jamais un mot en clair. Ne prouve rien sur le vrai Cloudflare ni sur Safari d'iOS (SUPPOSÉ). Lancer seul :
 *   node --test --test-timeout=180000 tests/esv-maquette/ch111-telecommande.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{spawnSync}=require('node:child_process');
const N=require('./navigateur.cjs');
const raison=N.indisponible()||(spawnSync('openssl',['version']).status===0?null:'openssl absent')||(spawnSync('patch',['--version']).status===0?null:'patch absent'),opts=raison?{skip:raison}:{};
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const attendreQue=async(f,ms=10000,quoi='')=>{const t0=Date.now();let v;while(Date.now()-t0<ms){v=await f();if(v)return v;await dormir(100);}throw Error('délai dépassé : '+quoi+' '+JSON.stringify(v));};

/* Copie de l'extension : liens vers le dépôt, sauf manifest.json (patché). */
function extensionPatchee(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch111-ext-'));
 for(const f of fs.readdirSync(N.racine))if(f!=='manifest.json'&&f!=='.git'&&f!=='node_modules')fs.symlinkSync(path.join(N.racine,f),path.join(dir,f));
 fs.copyFileSync(path.join(N.racine,'manifest.json'),path.join(dir,'manifest.json'));
 const r=spawnSync('patch',['-s','-p1','-d',dir,'-i',path.join(N.racine,'chantiers/CH-111/manifest.patch')],{encoding:'utf8'});
 if(r.status!==0)throw Error('manifest.patch : '+(r.stderr||r.stdout));
 const m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 assert.deepEqual(m.optional_host_permissions,['https://*.workers.dev/*'],'le patch ne pose que optional_host_permissions');
 m.optional_host_permissions.push('https://127.0.0.1/*');/* l'hôte du relais local, pour l'essai seulement */
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(m,null,2));return dir;}

test('télécommande · panneau ↔ relais local ↔ page du téléphone : appairage, état en direct, ordres, hors ligne, reconnexion, coupure',opts,async()=>{
 const relais=await require('../helpers/ch111-relais-local.cjs').demarrer(),ext=extensionPatchee(),erreurs=[];
 const ctx=await N.playwright().chromium.launchPersistentContext('',{executablePath:N.executable(),headless:true,ignoreHTTPSErrors:true,
  args:['--headless=new','--ignore-certificate-errors',`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
 try{
  for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await dormir(250);
  const sw=ctx.serviceWorkers()[0];assert.ok(sw,'extension chargée');const id=sw.url().split('/')[2];
  sw.on('console',m=>{if(m.type()==='error')erreurs.push('sw: '+m.text());});
  /* Panneau : Réglages › Télécommande › adresse › Appairer (la permission de l'hôte est demandée sur ce clic). */
  const panneau=await ctx.newPage({viewport:{width:600,height:760}});panneau.on('pageerror',e=>erreurs.push('panneau: '+e.message));
  panneau.on('dialog',d=>d.accept());
  await panneau.goto(`chrome-extension://${id}/panel.html#home`);
  await attendreQue(()=>panneau.evaluate(()=>!!document.querySelector('#ui5 [data-act="sg:menu"]')),15000,'panneau Épure');
  await panneau.click('#ui5 [data-act="sg:menu"]');await panneau.click('#ui5 [data-act="sg:reglages"]');
  await panneau.click('#ui5 [data-act="sg:telecommande"]');
  await panneau.waitForSelector('#tc-relais');await panneau.fill('#tc-relais',relais.adresse);
  /* La demande de permission : en navigateur sans tête, Chromium n'affiche pas d'invite ; on mesure ce qu'elle rend. */
  await panneau.evaluate(()=>{const o=chrome.permissions.request;chrome.permissions.request=async x=>{window.__permission={demande:x,rendu:'en attente'};
   const v=await o.call(chrome.permissions,x).catch(e=>'erreur: '+e.message);window.__permission.rendu=v;return v===true;};});
  await panneau.click('#tc-f button.tc-p');await dormir(3000);
  const p=await panneau.evaluate(()=>window.__permission??null);
  console.log('# permission demandée sur le clic :',JSON.stringify(p));
  assert.deepEqual(p?.demande,{origins:[relais.adresse+'/*']},'chrome.permissions.request appelé avec l’hôte du relais');
  let code;
  if(p.rendu===true){code=await attendreQue(()=>panneau.evaluate(()=>document.querySelector('#tc-f .tc-code')?.textContent?.replace(/\s/g,'')||null),8000,'code affiché');
   assert.ok(await panneau.evaluate(()=>!!document.querySelector('#tc-f .tc-qr svg path')),'QR code dessiné');}
  else{/* Sans invite (navigateur sans tête) : l'appairage est demandé au service worker par la même action que la feuille, après l'accord. */
   console.log('# permission non accordée sans invite ('+p.rendu+') : appairage par l’action du panneau');
   code=(await panneau.evaluate(a=>chrome.runtime.sendMessage({kind:'panel',action:'telecommande-appairer',args:{relais:a}}),relais.adresse)).result.code;}
  assert.match(code,/^[0-9A-Z]{53}$/);
  const etatSW=()=>panneau.evaluate(()=>chrome.runtime.sendMessage({kind:'panel',action:'telecommande-etat'}).then(r=>r.result));
  await attendreQue(async()=>(await etatSW()).connectee,10000,'extension connectée au relais');
  /* Téléphone */
  const tel=await ctx.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});tel.on('pageerror',e=>erreurs.push('tel: '+e.message));
  tel.on('dialog',d=>d.accept());
  const t0=Date.now();await tel.goto(relais.adresse+'/#k='+code);
  const lire=()=>tel.evaluate(()=>({puce:document.getElementById('puce-texte').textContent,mot:document.getElementById('mot').textContent,phrase:document.getElementById('phrase').textContent,
   hors:document.getElementById('hors').hidden?null:document.getElementById('hors').textContent,boutons:[...document.querySelectorAll('#boutons button')].map(b=>b.textContent+(b.disabled?' (grisé)':'')),
   avis:document.getElementById('avis').classList.contains('vu')?document.getElementById('avis').textContent:null,traites:document.getElementById('c-traites').firstChild.textContent}));
  await attendreQue(async()=>(await lire()).puce==='En direct',10000,'téléphone en direct');
  console.log(`# téléphone « En direct » ${Date.now()-t0} ms après l’ouverture du lien`);
  let v=await lire();assert.equal(v.mot,'Au repos');assert.deepEqual(v.boutons,[]);
  /* Un lot qui tourne (état posé dans le moteur du service worker) : le téléphone suit en moins de 2 s. */
  const t1=Date.now();
  await sw.evaluate(()=>{engine.s.batch={id:'lot-essai',state:'RUNNING',scope:{part:23,start:100,end:120},activeIdentity:{part:23,cut:104},processed:[{cut:100},{cut:101},{cut:102}],deferred:[{cut:103}],skipped:[],paused:[],interrupted:[],sequence:[]};});
  await attendreQue(async()=>(await lire()).mot==='En cours',5000,'état « En cours »');const dt=Date.now()-t1;
  v=await lire();assert.match(v.phrase,/Partie 23 · cut 104/);assert.equal(v.traites,'3');assert.deepEqual(v.boutons,['Pause','Arrêter le lot']);
  console.log(`# changement d’état vu sur le téléphone en ${dt} ms`);
  /* Ordre « Pause » : même action que le bouton du panneau ; accusé affiché. */
  const t2=Date.now();await tel.click('#boutons button[data-ordre="lot-pause"]');
  await attendreQue(async()=>(await sw.evaluate(()=>engine.s.batch.state))==='PAUSED',5000,'lot en pause');
  await attendreQue(async()=>(await lire()).mot==='En pause',5000,'téléphone « En pause »');console.log(`# ordre Pause : lot en pause et téléphone à jour en ${Date.now()-t2} ms`);
  v=await lire();assert.match(v.avis||'',/« Pause » : fait/);assert.deepEqual(v.boutons,['Reprendre','Arrêter le lot']);
  /* « Arrêter le lot » : la feuille de confirmation d'abord ; « Annuler » n'envoie rien. */
  await tel.click('#boutons button[data-ordre="lot-arreter"]');assert.equal(await tel.evaluate(()=>document.getElementById('confirmer').hidden),false);
  await tel.click('#conf-non');await dormir(500);assert.equal(await sw.evaluate(()=>engine.s.batch.state),'PAUSED');
  await tel.click('#boutons button[data-ordre="lot-arreter"]');await tel.click('#conf-oui');
  await attendreQue(async()=>(await sw.evaluate(()=>engine.s.batch?.state))==='STOPPED',5000,'lot arrêté');
  await attendreQue(async()=>(await lire()).mot==='Arrêté',5000,'téléphone « Arrêté »');
  /* Sans onglet ESV, l'arrêt finit par un refus (« Sélectionne un onglet ESV. ») : le téléphone affiche LE refus du bouton du panneau, mot pour mot. */
  const avisTel=(await attendreQue(async()=>(await lire()).avis,3000,'accusé'));console.log('# avis après Arrêter :',avisTel);
  await sw.evaluate(()=>{engine.s.batch={...engine.s.batch,state:'RUNNING'};});
  const refusPanneau=await panneau.evaluate(()=>chrome.runtime.sendMessage({kind:'panel',action:'stop'}).then(r=>r.error??'accepté'));
  assert.equal(avisTel,refusPanneau==='accepté'?'« Arrêter le lot » : fait.':'« Arrêter le lot » refusé : '+refusPanneau);
  const j=await sw.evaluate(async()=>(await store.all('events')).filter(e=>e.type==='telecommande-ordre').map(e=>[e.ordre,e.resultat]).sort((a,b)=>a[0]<b[0]?1:-1));/* le magasin ne rend pas dans l'ordre */
  assert.deepEqual(j,[['lot-pause','accepte'],['lot-arreter',refusPanneau==='accepté'?'accepte':'refuse']],JSON.stringify(j));
  /* Coupure du relais : les deux côtés se reconnectent seuls. */
  relais.couperTout();await attendreQue(async()=>(await lire()).puce!=='En direct',5000,'coupure vue');
  const t3=Date.now();await attendreQue(async()=>(await lire()).puce==='En direct',20000,'reconnexion');console.log(`# reconnexion après coupure du relais : ${Date.now()-t3} ms`);
  /* Ariane se tait (télécommande arrêtée côté extension sans oublier la clé) : « Ariane hors ligne » avec l'heure du dernier état. */
  await sw.evaluate(()=>telecommande.arreter());
  await attendreQue(async()=>(await lire()).hors,5000,'hors ligne');v=await lire();
  assert.match(v.hors,/^Ariane hors ligne · dernier état à \d\d:\d\d/);assert.ok(v.boutons.every(b=>/\(grisé\)$/.test(b)),'aucun ordre possible hors ligne : '+v.boutons);
  await sw.evaluate(()=>telecommande.demarrer());await attendreQue(async()=>!(await lire()).hors,10000,'de retour en ligne');
  /* « Couper la télécommande » depuis la feuille : la clé est oubliée, le téléphone voit Ariane partir. */
  await panneau.evaluate(()=>ArianeTelecommandePanneau.ouvrir());/* la feuille relit l'état (appairée) */
  assert.match(await panneau.textContent('#tc-f'),/Liaison\s*connectée/);
  await panneau.click('#tc-f button.tc-s');await panneau.waitForSelector('#tc-f .tc-qr svg');/* « Afficher le QR code » */
  assert.equal((await panneau.textContent('#tc-f .tc-code')).replace(/\s/g,''),code);
  await panneau.click('#tc-f button.tc-d');
  await attendreQue(async()=>!(await etatSW()).appairee,5000,'coupée');
  assert.deepEqual(await sw.evaluate(async()=>Object.keys(await chrome.storage.local.get(null)).filter(k=>/telecommande/i.test(k))),[]);
  await attendreQue(async()=>(await lire()).hors,5000,'hors ligne après coupure');
  /* Le relais n'a vu que du chiffré. */
  const tout=relais.vus.map(x=>x.texte).join('\n');
  assert.ok(relais.vus.length>5);assert.ok(!/cours|pause|lot-|PAUSED|RUNNING|"partie"|"cut"|ordre/.test(tout),'clair vu par le relais');
  assert.deepEqual(erreurs.filter(e=>!/WebSocket|ERR_CONNECTION|net::/.test(e)),[]);
 }finally{await ctx.close().catch(()=>{});await relais.fermer();}
});
