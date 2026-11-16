'use strict';
/* CH-130 (D-361) — BOUT EN BOUT DANS CHROMIUM : l'extension RÉELLE (copie, manifeste patché comme CH-111, plus un `telecommande-relais.json`
 * fabriqué comme le ferait tools/relais_paquet.py), le relais local (vrai telecommande/worker.js, qui sert le rendu du panneau) et la page du
 * téléphone à 390 × 844.
 *  - L'adresse du paquet est proposée dans la feuille du panneau quand rien n'a été saisi.
 *  - Le téléphone dessine le PANNEAU COMPLET avec le rendu du panneau : quatre onglets visités (Orbite, Écho, Constellation, Aurore), états réels
 *    posés dans le moteur du service worker.
 *  - Seuls les ordres offerts restent ; « Pause » passe par le même chemin que le bouton du panneau ; « Arrêter » demande confirmation.
 *  - Le relais ne voit aucun mot en clair. Captures (CH130_CAPTURES=<dossier>, hors dépôt) pour les montrer.
 * Ne prouve rien sur le vrai Cloudflare ni sur Safari d'iOS (SUPPOSÉ). Lancer seul :
 *   node --test --test-timeout=180000 tests/esv-maquette/ch130-telephone.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{spawnSync}=require('node:child_process');
const N=require('./navigateur.cjs');
const raison=N.indisponible()||(spawnSync('openssl',['version']).status===0?null:'openssl absent')||(spawnSync('patch',['--version']).status===0?null:'patch absent'),opts=raison?{skip:raison}:{};
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const attendreQue=async(f,ms=10000,quoi='')=>{const t0=Date.now();let v;while(Date.now()-t0<ms){v=await f();if(v)return v;await dormir(100);}throw Error('délai dépassé : '+quoi+' '+JSON.stringify(v));};
const FABRIQUEE=['https:/','/ariane-telecommande.exemple.','workers','.dev'].join('');
const CAPTURES=process.env.CH130_CAPTURES||null;

function extensionPatchee(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch130-ext-'));
 for(const f of fs.readdirSync(N.racine))if(!['manifest.json','.git','node_modules','telecommande-relais.json'].includes(f))fs.symlinkSync(path.join(N.racine,f),path.join(dir,f));
 fs.copyFileSync(path.join(N.racine,'manifest.json'),path.join(dir,'manifest.json'));
 if(!JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')).optional_host_permissions){
  const r=spawnSync('patch',['-s','-p1','-d',dir,'-i',path.join(N.racine,'chantiers/CH-111/manifest.patch')],{encoding:'utf8'});if(r.status!==0)throw Error('manifest.patch : '+(r.stderr||r.stdout));}
 const m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));m.optional_host_permissions.push('https://127.0.0.1/*');
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(m,null,2));
 /* Ce que tools/relais_paquet.py écrit dans le zip (adresse fabriquée). */
 fs.writeFileSync(path.join(dir,'telecommande-relais.json'),JSON.stringify({relais:FABRIQUEE}));return dir;}

test('téléphone · panneau complet : quatre onglets, ordres offerts seulement, même chemin que le panneau ; adresse du paquet proposée',opts,async()=>{
 const relais=await require('../helpers/ch111-relais-local.cjs').demarrer(),ext=extensionPatchee(),erreurs=[];
 const ctx=await N.playwright().chromium.launchPersistentContext('',{executablePath:N.executable(),headless:true,ignoreHTTPSErrors:true,
  args:['--headless=new','--ignore-certificate-errors',`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
 try{
  for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await dormir(250);
  const sw=ctx.serviceWorkers()[0];assert.ok(sw,'extension chargée');const id=sw.url().split('/')[2];
  sw.on('console',m=>{if(m.type()==='error')erreurs.push('sw: '+m.text());});
  const panneau=await ctx.newPage({viewport:{width:600,height:760}});panneau.on('pageerror',e=>erreurs.push('panneau: '+e.message));panneau.on('dialog',d=>d.accept());
  await panneau.goto(`chrome-extension://${id}/panel.html#home`);
  await attendreQue(()=>panneau.evaluate(()=>!!document.querySelector('#ui5 [data-act="sg:menu"]')),15000,'panneau');
  /* 1. L'adresse du paquet, proposée (rien n'a été saisi dans ce panneau). */
  await panneau.click('#ui5 [data-act="sg:menu"]');await panneau.click('#ui5 [data-act="sg:reglages"]');await panneau.click('#ui5 [data-act="sg:telecommande"]');
  await panneau.waitForSelector('#tc-relais');
  assert.equal(await attendreQue(()=>panneau.inputValue('#tc-relais'),3000,'champ prérempli'),FABRIQUEE,'adresse du paquet proposée');
  await panneau.evaluate(()=>ArianeTelecommandePanneau.fermer());
  /* Appairage avec le relais local (même action que la feuille ; sans invite de permission en navigateur sans tête, voir CH-111). */
  const code=(await panneau.evaluate(a=>chrome.runtime.sendMessage({kind:'panel',action:'telecommande-appairer',args:{relais:a}}),relais.adresse)).result.code;
  await attendreQue(()=>panneau.evaluate(()=>chrome.runtime.sendMessage({kind:'panel',action:'telecommande-etat'}).then(r=>r.result.connectee)),10000,'extension connectée');
  /* 2. Un lot qui tourne dans une Constellation : posés dans le moteur du service worker (l'Aurore et Écho viennent après : Ariane refuse un lot pendant Écho). */
  await sw.evaluate(()=>{const id={part:23,cut:104};
   engine.s.current={identity:id};
   engine.s.batch={id:'lot-essai',state:'RUNNING',scope:{part:23,start:100,end:120},activeIdentity:id,processed:[{cut:100},{cut:101},{cut:102}],deferred:[{cut:103}],skipped:[],paused:[],interrupted:[],sequence:[]};
   fileP.etat={id:'f',etat:'lot',n:3,plan:[22,23,24],k:1,partie:{part:23,rang:1,lotId:'lot-essai'},changement:null,motifFin:null,alerte:null,reprises:0,
    bilan:[{part:22,rang:0,issueLot:'fin',motifs:[{code:'fin-normale'}],resume:{poses:41,differes:2},passe:{issue:'finie',ecrits:1},relecture:{issue:'finie',corriges:3},alertes:[]}]};});
  const tel=await ctx.newPage({viewport:{width:390,height:844},deviceScaleFactor:CAPTURES?2:1,isMobile:true,hasTouch:true});
  tel.on('pageerror',e=>erreurs.push('tel: '+e.message));tel.on('dialog',d=>d.accept());
  /* Contexte persistant : la taille donnée à newPage est ignorée ; on la fixe (CH-111 la croyait prise). */
  await tel.setViewportSize({width:390,height:844});if(process.env.CH130_SOMBRE)await tel.emulateMedia({colorScheme:'dark'});
  await tel.goto(relais.adresse+'/#k='+code);
  const lire=()=>tel.evaluate(()=>{const h=document.getElementById('ui5');return {liaison:document.body.dataset.liaison,mot:h.querySelector('.sg-tu-etat .sg-mot')?.textContent??null,
   onglets:[...h.querySelectorAll('[role="tablist"] button')].map(b=>b.textContent+(b.getAttribute('aria-selected')==='true'?'*':'')),actes:[...h.querySelectorAll('[data-act]')].map(b=>b.dataset.act),
   ordres:[...h.querySelectorAll('button[data-ordre]')].map(b=>b.dataset.ordre+(b.disabled?' (grisé)':'')),activite:h.querySelector('.sg-fen')?.dataset.activite,
   avis:document.getElementById('avis').classList.contains('vu')?document.getElementById('avis').textContent:null,note:h.querySelector('.sg-barre-note')?.textContent??null,
   largeur:document.documentElement.scrollWidth};});
  await attendreQue(async()=>{const v=await lire();return v.liaison==='direct'&&v.mot==='En cours';},10000,'téléphone en direct, lot en cours');
  const capture=async nom=>{if(CAPTURES){fs.mkdirSync(CAPTURES,{recursive:true});await dormir(1200);/* fin des animations d'entrée */await tel.screenshot({path:path.join(CAPTURES,nom+'.png')});}};
  let v=await lire();
  assert.deepEqual(v.onglets,['Orbite*','Écho','Constellation','Aurore']);assert.equal(v.largeur,390,'aucun défilement horizontal à 390 px');
  assert.deepEqual(v.ordres.sort(),['constellation-arreter','lot-pause'].sort(),'pendant la Constellation, « Arrêter le lot » est retiré (comme au panneau) : '+v.ordres);
  const NAV=['mode:automatic','mode:native','sg:onglet-file','sg:onglet-correction','sg:tiroir','sg:details','sg:fermer','sg:menu'];
  const propres=async quoi=>{const x=await lire();for(const a of x.actes)assert.ok(NAV.includes(a)||['pause','legacy:resume','legacy:stop','legacy:relecture-pause','legacy:relecture-reprendre','legacy:relecture-arreter','legacy:relecture-arreter-pause','legacy:file-secondaire'].includes(a),quoi+' : '+a);return x;};
  await propres('Orbite');
  await capture('1-orbite');
  /* 3. L'onglet Constellation : navigation locale, rien ne part vers Ariane. */
  const avant=relais.vus.filter(x=>x.role==='tel').length;
  await tel.click('#ui5 [role="tablist"] button:has-text("Constellation")');v=await propres('Constellation');assert.equal(v.activite,'file');
  assert.ok(await tel.evaluate(()=>!!document.querySelector('#ui5 .sg-chaine li[data-partie="23"][data-etat="en-cours"]')),'chaîne de la Constellation, partie 23 en cours');
  assert.ok(await tel.evaluate(()=>/fin normale/.test(document.querySelector('#ui5 .sg-registre')?.textContent||'')),'bilan par partie');
  assert.deepEqual((await lire()).ordres,['constellation-arreter'],'l’arrêt de la Constellation, dans son onglet');
  await capture('2-constellation');
  assert.equal(relais.vus.filter(x=>x.role==='tel').length,avant,'les onglets ne parlent pas au relais');
  /* 4. « Pause » : même chemin que le bouton du panneau. */
  await tel.click('#ui5 [role="tablist"] button:has-text("Orbite")');
  await tel.click('#ui5 button[data-ordre="lot-pause"]');
  await attendreQue(async()=>(await sw.evaluate(()=>engine.s.batch.state))==='PAUSED',5000,'lot en pause');
  await attendreQue(async()=>(await lire()).mot==='En pause',5000,'téléphone « En pause »');
  v=await lire();assert.match(v.avis||'',/« Pause » : fait/);assert.ok(v.ordres.includes('lot-reprendre'),v.ordres);
  /* 5. « Arrêter la Constellation » : confirmation d'abord ; « Annuler » n'envoie rien. */
  await tel.click('#ui5 button[data-ordre="constellation-arreter"]');assert.equal(await tel.evaluate(()=>document.getElementById('confirmer').hidden),false);
  await capture('3-confirmation');
  const n0=relais.vus.filter(x=>x.role==='tel').length;await tel.click('#conf-non');await dormir(400);assert.equal(relais.vus.filter(x=>x.role==='tel').length,n0);
  /* 6. Le menu « ··· » : la feuille du téléphone (pas les réglages d'Ariane). */
  await tel.click('#ui5 [data-act="sg:menu"]');assert.equal(await tel.textContent('#m-liaison'),'en direct');await tel.click('#menu-fermer');
  /* 7. Hors ligne : la note de la barre, les ordres grisés, les onglets restent. */
  await sw.evaluate(()=>telecommande.arreter());
  await attendreQue(async()=>(await lire()).liaison==='hors',5000,'hors ligne');v=await lire();
  assert.match(v.note||'',/^Ariane hors ligne · dernier état à \d\d:\d\d/);assert.ok(v.ordres.length&&v.ordres.every(o=>/\(grisé\)$/.test(o)),v.ordres);
  await capture('6-hors-ligne');
  await sw.evaluate(()=>telecommande.demarrer());await attendreQue(async()=>(await lire()).liaison==='direct',10000,'de retour en ligne');
  /* 6 bis. Lot fini, Constellation close, Aurore ouverte avec sa séance Écho : les onglets Écho et Aurore. */
  await sw.evaluate(()=>{engine.s.batch={...engine.s.batch,state:'COMPLETED'};fileP.etat=null;
   engine.s.correction={id:'aur-essai',etat:'ouverte',courant:{part:22,cut:51},listes:[{partie:22,batchId:'l0',entrees:[{part:22,cut:50,groupe:'corriger'},{part:22,cut:51,groupe:'corriger'},{part:22,cut:57,groupe:'poser'}]}]};
   engine.s.native={status:'RUNNING',correction:{id:'aur-essai'},visits:[{identity:{part:22,cut:50},label:'VALIDATE_CORRECTED_LEFT',endedAt:'x',visitId:'v1'},{identity:{part:22,cut:51},label:null,visitId:'v2'}]};});
  const avant2=relais.vus.filter(x=>x.role==='tel').length;
  await tel.click('#ui5 [role="tablist"] button:has-text("Écho")');
  /* Sans onglet ESV, le service worker passe la séance en « ESV ne répond plus » (son comportement réel) : les deux se disent. */
  await attendreQue(async()=>['En observation','ESV ne répond plus'].includes((await lire()).mot),5000,'écran Écho');v=await propres('Écho');assert.equal(v.activite,'echo');assert.deepEqual(v.onglets,['Orbite','Écho*','Constellation','Aurore']);
  await capture('4-echo');
  await tel.click('#ui5 [role="tablist"] button:has-text("Aurore")');
  await attendreQue(()=>tel.evaluate(()=>!!document.querySelector('#ui5 [data-k="c:22:50"]')),5000,'lignes de l’Aurore');v=await propres('Aurore');assert.equal(v.activite,'correction');
  assert.ok(await tel.evaluate(()=>/corrigé · 1 rail/.test(document.getElementById('ui5').textContent)),'statut des lignes de l’Aurore');
  assert.ok(!v.actes.some(a=>/corr-ouvrir|correction-/.test(a)),'aucune ouverture de cut ni bouton de l’Aurore');assert.deepEqual(v.ordres,[]);
  await capture('5-aurore');
  assert.equal(relais.vus.filter(x=>x.role==='tel').length,avant2,'les onglets ne parlent pas au relais');
  /* 8. Le relais n'a vu que du chiffré ; le journal a l'ordre Pause. */
  const tout=relais.vus.map(x=>x.texte).join('\n');
  assert.ok(!/cours|pause|lot-|PAUSED|RUNNING|"partie"|"cut"|ordre|aurore|corrige/i.test(tout.replace(/"(iv|d)":"[^"]*"/g,'')),'clair vu par le relais');
  const j=await sw.evaluate(async()=>(await store.all('events')).filter(e=>e.type==='telecommande-ordre').map(e=>[e.ordre,e.resultat]));
  assert.deepEqual(j,[['lot-pause','accepte']]);
  assert.deepEqual(erreurs.filter(e=>!/WebSocket|ERR_CONNECTION|net::|ERR_FILE_NOT_FOUND/.test(e)),[]);
 }finally{await ctx.close().catch(()=>{});await relais.fermer();}
});
