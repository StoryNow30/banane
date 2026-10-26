'use strict';
/* Connexion T21 (fiches/CONNEXION_T21.md) — L'EXTENSION RÉELLE dans Chromium, l'hôte d'ESV routé vers la maquette (comme tools/banc-esv.cjs), le panneau
 * ouvert comme le service worker l'ouvre (`panel.html#home`) avec un onglet ESV déjà ouvert : Signal ne doit pas rester « Hors ligne », un seul choix
 * d'onglet doit suffire, et on mesure la durée choix → prêt. Ne prouve rien sur le vrai ESV (vitesse d'injection, chargement d'ESV). Hors du banc `verify` :
 *   node --test --test-timeout=120000 tests/esv-maquette/connexion-t21.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
const dormir=ms=>new Promise(r=>setTimeout(r,ms));

async function monter(nbOnglets){
 const man=JSON.parse(fs.readFileSync(path.join(N.racine,'manifest.json'),'utf8')),hp=new URL(man.host_permissions[0].replace(/\*$/,''));
 const {demarrer}=require('./serveur.cjs'),serveur=await demarrer({});
 const ctx=await N.playwright().chromium.launchPersistentContext('',{executablePath:N.executable(),headless:true,viewport:{width:1200,height:800},
  args:['--headless=new',`--disable-extensions-except=${N.racine}`,`--load-extension=${N.racine}`]});
 const erreurs=[];
 await ctx.route(hp.origin+'/**',async route=>{const u=new URL(route.request().url());let c=u.pathname;
  if(c.startsWith(hp.pathname)){const r=c.slice(hp.pathname.length);c='/tests/esv-maquette/'+(r===''||r==='maquette'?'esv.html':r);}
  try{await route.fulfill({response:await route.fetch({url:serveur.url+c+u.search})});}catch(e){erreurs.push('route '+c+' : '+e.message);await route.abort();}});
 for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await dormir(250);
 const sw=ctx.serviceWorkers()[0];if(!sw)throw Error('extension non chargée');const id=sw.url().split('/')[2];
 sw.on('console',m=>{if(m.type()==='error')erreurs.push('sw: '+m.text());});
 const esv=[];for(let k=0;k<nbOnglets;k++){const p=await ctx.newPage();p.on('pageerror',e=>erreurs.push('esv: '+e.message));
  await p.goto(`${hp.origin}${hp.pathname}maquette?cuts=6&debut=${100+100*k}&cut=${100+100*k}&latence=20`);await p.evaluate(()=>window.__maquette.pret);
  await p.waitForFunction(()=>window.__maquette.etat().railsPrets);esv.push(p);}
 const panneau=await ctx.newPage({viewport:{width:600,height:760}});panneau.on('pageerror',e=>erreurs.push('panneau: '+e.message));
 const lire=()=>panneau.evaluate(()=>({mot:document.querySelector('#ui5 .sg-mot')?.textContent||'',phrase:document.querySelector('#ui5 .sg-phrase')?.textContent||''}));
 const statut=()=>panneau.evaluate(()=>chrome.runtime.sendMessage({kind:'panel',action:'view'})).then(r=>r?.result?.connection?.status??null);
 const pret=async(ms)=>{const t0=Date.now();while(Date.now()-t0<ms){const [l,s]=await Promise.all([lire(),statut()]);if(l.mot==='Prêt'&&s==='ready')return Date.now()-t0;await dormir(50);}return null;};
 const fermer=async()=>{await ctx.close().catch(()=>{});await serveur.fermer();};
 return {ctx,id,esv,panneau,erreurs,lire,statut,pret,fermer};
}

test('Connexion T21 · un onglet ESV ouvert, panneau ouvert sur l’accueil : pas « Hors ligne », prêt sans aucun clic en moins de 5 s',opts,async()=>{
 const m=await monter(1);
 try{const t0=Date.now();await m.panneau.goto(`chrome-extension://${m.id}/panel.html#home`);
  const ms=await m.pret(5000);
  assert.notEqual(ms,null,`toujours ${JSON.stringify(await m.lire())} (statut ${await m.statut()}) 5 s après l’ouverture`);
  console.log(`# prêt ${Date.now()-t0} ms après l’ouverture du panneau, aucun clic`);
  assert.deepEqual(m.erreurs,[]);
 }finally{await m.fermer();}
});

test('Connexion T21 · deux onglets ESV : la puce les liste, un seul choix suffit, prêt en moins de 3 s',opts,async()=>{
 const m=await monter(2);
 try{await m.panneau.goto(`chrome-extension://${m.id}/panel.html#home`);await dormir(1500);
  const avant=await m.lire();assert.equal(avant.mot,'Hors ligne','deux onglets, aucun choisi : rien ne se connecte seul (comme avant)');
  assert.doesNotMatch(avant.phrase,/Aucun onglet ESV ouvert/);
  await m.panneau.click('#ui5 .sg-puce');await dormir(300);
  const boutons=await m.panneau.$$('#ui5 .sg-popover [data-act^="conn:"]');assert.equal(boutons.length,2,'les deux onglets ESV, chacun avec « Connecter »');
  const t=Date.now();await boutons[0].click();
  const ms=await m.pret(3000);assert.notEqual(ms,null,`un seul choix : toujours ${JSON.stringify(await m.lire())} (statut ${await m.statut()})`);
  console.log(`# prêt ${Date.now()-t} ms après le choix de l’onglet`);
  assert.deepEqual(m.erreurs,[]);
 }finally{await m.fermer();}
});

test('Connexion T21 · page ESV gardant l’adaptateur d’une autre version : le refus se lit dans Signal ; après F5, un choix suffit',opts,async()=>{
 const m=await monter(1);
 try{/* Ce que laisse une version d'avant dans la page (tampon de l'adaptateur), comme après « Recharger » l'extension sans F5 sur ESV. */
  await m.esv[0].evaluate(id=>{window.__BANANE_V3_PAGE={version:'4.9.5.20',versionName:'4.9.5 test 20 (L1-e6)',proprietaire:id};},m.id);
  await m.panneau.goto(`chrome-extension://${m.id}/panel.html#home`);
  let vu=null;for(let i=0;i<50&&!vu;i++){await dormir(100);const t=await m.panneau.evaluate(()=>document.getElementById('ui5')?.textContent||'');if(/Recharge la page ESV \(F5\)/.test(t))vu=t;}
  assert.ok(vu,'le refus « Recharge la page ESV (F5) » est dit dans Signal');
  await m.esv[0].reload();await m.esv[0].evaluate(()=>window.__maquette.pret);await m.esv[0].waitForFunction(()=>window.__maquette.etat().railsPrets);
  await m.panneau.click('#ui5 .sg-puce');await dormir(300);
  const b=await m.panneau.$('#ui5 .sg-popover [data-act^="conn:"]');assert.ok(b,'l’onglet garde son bouton « Connecter »');
  const t=Date.now();await b.click();
  const ms=await m.pret(3000);assert.notEqual(ms,null,`après F5, un choix : toujours ${JSON.stringify(await m.lire())} (statut ${await m.statut()})`);
  console.log(`# après F5 : prêt ${Date.now()-t} ms après le choix`);
  assert.deepEqual(m.erreurs,[]);
 }finally{await m.fermer();}
});

test('Connexion T21 · constat de l’opérateur : plusieurs onglets ESV, onglet utilisé connecté, panneau rouvert : la puce le nomme et la couche les liste tous',opts,async()=>{
 const m=await monter(2);
 try{/* Un panneau d'avant a connecté le premier onglet, puis a été fermé ; le service worker garde l'onglet utilisé. */
  const p0=await m.ctx.newPage();await p0.goto(`chrome-extension://${m.id}/panel.html#automatic`);await dormir(800);
  const t=await p0.evaluate(()=>chrome.runtime.sendMessage({kind:'panel',action:'list-tabs'}));
  await p0.evaluate(i=>chrome.runtime.sendMessage({kind:'panel',action:'connect',args:{tabId:i}}),t.result[0].id);await p0.close();
  await m.panneau.goto(`chrome-extension://${m.id}/panel.html#home`);await dormir(1500);
  assert.notEqual(await m.panneau.$eval('#ui5 .sg-puce .sg-long',e=>e.textContent),'Aucun onglet');
  await m.panneau.click('#ui5 .sg-puce');await dormir(300);
  const couche=await m.panneau.$eval('#ui5 .sg-popover',e=>e.textContent);
  assert.doesNotMatch(couche,/Aucun onglet ESV ouvert/,couche);
  assert.equal(await m.panneau.$$eval('#ui5 .sg-popover .sg-conn',l=>l.length),1,'l’onglet utilisé est « connecté »');
  assert.equal(await m.panneau.$$eval('#ui5 .sg-popover [data-act^="conn:"]',l=>l.length),1,'l’autre onglet se choisit');
  assert.deepEqual(m.erreurs,[]);
 }finally{await m.fermer();}
});

test('Connexion T21 · constat de l’opérateur : « Démarrer le lot » ne part que sur l’onglet nommé dans la puce',opts,async()=>{
 const m=await monter(2);
 try{/* Le second onglet a été connecté par un panneau fermé ensuite : c'est lui que le service worker cible. */
  const p0=await m.ctx.newPage();await p0.goto(`chrome-extension://${m.id}/panel.html#automatic`);await dormir(800);
  const t=await p0.evaluate(()=>chrome.runtime.sendMessage({kind:'panel',action:'list-tabs'}));
  await p0.evaluate(i=>chrome.runtime.sendMessage({kind:'panel',action:'connect',args:{tabId:i}}),t.result[1].id);await p0.close();
  await m.panneau.goto(`chrome-extension://${m.id}/panel.html#home`);await dormir(1500);
  const puce=await m.panneau.$eval('#ui5 .sg-puce .sg-long',e=>e.textContent);
  assert.match(puce,/utilisé par Ariane/,'la puce nomme l’onglet ciblé : '+puce);
  const nom=t.result[1].title;assert.ok(puce.includes(nom),'c’est bien le second onglet');
  const b=await m.panneau.$('#ui5 .sg-actions button[data-act="legacy:start-batch"]:not([disabled])');assert.ok(b,'onglet listé, nommé, prêt : « Démarrer le lot » actif');
  const avant=await Promise.all(m.esv.map(e=>e.evaluate(()=>window.__maquette.etat().chargements)));
  await b.click();await dormir(3000);
  const apres=await Promise.all(m.esv.map(e=>e.evaluate(()=>window.__maquette.etat().chargements)));
  assert.equal(apres[0],avant[0],'le premier onglet, non nommé, n’est pas touché');assert.ok(apres[1]>avant[1],'le lot travaille dans l’onglet nommé');
  assert.deepEqual(m.erreurs,[]);
 }finally{await m.fermer();}
});
