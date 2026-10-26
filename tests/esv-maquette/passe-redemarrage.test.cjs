'use strict';
/* T21d (D-250, priorité 2) — LA DEUXIÈME PASSE SURVIT À L'ARRÊT DU SERVICE WORKER, extension réelle dans Chromium, ESV = maquette rejouant un VRAI
 * lot (tests/esv-maquette/lecteur-export.cjs). La maquette synthétique ne produit aucun différé sous L1-se (la GCV2 pose tout) : il faut un export
 * réel, gardé HORS dépôt, dont la fenêtre de cuts donne des différés à la passe.
 *   BANANE_MAQUETTE_PASSE_EXPORT=DOSSIER [BANANE_MAQUETTE_PASSE_LOT=775-800] [BANANE_MAQUETTE_PASSE_PARTIE=0] node --test --test-timeout=900000 tests/esv-maquette/passe-redemarrage.test.cjs
 * Sans export : essais sautés, avec leur raison. Le service worker est arrêté par Chromium (CDP `ServiceWorker.stopAllWorkers`) dès que l'état gardé
 * de la passe atteint le point voulu (guetteur `chrome.storage.onChanged` dans le panneau : aucun message au service worker), puis réveillé par
 * l'appel suivant du panneau, comme Chrome le fait. (1) arrêt au 2e reste décidé du premier tour ; (2) passe relancée après le lot (le lot s'arrête
 * sur une pose d'Ariane en attente), arrêt dès la première validation prouvée. Contrôles : reprise journalisée, passe close, chaque reste tracé
 * (événement ou trace de la reprise), au plus une écriture « valid » reçue par le serveur et une validation par cut écrit. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const N=require('./navigateur.cjs');
const EXPORT=process.env.BANANE_MAQUETTE_PASSE_EXPORT,[DEBUT,FIN]=(process.env.BANANE_MAQUETTE_PASSE_LOT||'775-800').split('-').map(Number),PARTIE=Number(process.env.BANANE_MAQUETTE_PASSE_PARTIE||0);
const raison=N.indisponible()||(!EXPORT?'export réel absent (BANANE_MAQUETTE_PASSE_EXPORT, hors dépôt)':!fs.existsSync(EXPORT)?'export introuvable : '+EXPORT:null),opts=raison?{skip:raison}:{};
const dormir=ms=>new Promise(r=>setTimeout(r,ms));

async function scenario({arret,relance=false}){
  const pw=N.playwright(),man=JSON.parse(fs.readFileSync(path.join(N.racine,'manifest.json'),'utf8')),hote=new URL(man.host_permissions[0].replace(/\*$/,''));
  const {demarrer}=require('./serveur.cjs'),serveur=await demarrer({exportation:EXPORT});
  const ctx=await pw.chromium.launchPersistentContext('',{executablePath:N.executable(),headless:true,viewport:{width:1200,height:800},args:['--headless=new',`--disable-extensions-except=${N.racine}`,`--load-extension=${N.racine}`]});
  const erreurs=[];
  try{
    await ctx.route(hote.origin+'/**',async route=>{const u=new URL(route.request().url());let c=u.pathname;
      if(c.startsWith(hote.pathname)){const reste=c.slice(hote.pathname.length);c='/tests/esv-maquette/'+(reste===''||reste==='maquette'?'esv.html':reste);}
      try{await route.fulfill({response:await route.fetch({url:serveur.url+c+u.search})});}catch(e){erreurs.push('route '+c);await route.abort();}});
    for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await dormir(250);const id=ctx.serviceWorkers()[0].url().split('/')[2];
    const esv=await ctx.newPage();esv.on('pageerror',e=>erreurs.push('esv: '+e.message));
    await esv.goto(`${hote.origin}${hote.pathname}maquette?source=export&part=${PARTIE}&latence=30`);await esv.evaluate(()=>window.__maquette.pret);
    const aller=async c=>{await esv.evaluate(c=>window.__maquette.allerA(c),c);await esv.waitForFunction(()=>window.__maquette.etat().railsPrets);};await aller(DEBUT);
    const pan=await ctx.newPage();await pan.goto(`chrome-extension://${id}/panel.html#automatic`);await dormir(600);
    const api=async(action,a={})=>{const r=await pan.evaluate(([action,a])=>chrome.runtime.sendMessage({kind:'panel',action,args:a}),[action,a]);if(r?.error)throw Error(action+' : '+r.error);return r?.result;};
    const onglets=await api('list-tabs');await api('connect',{tabId:(onglets.find(t=>/aquette/i.test(t.title))||onglets[0]).id});await api('settings',{mode:'automatic-test'});
    await pan.evaluate(arret=>{window.__arret=new Promise(res=>chrome.storage.onChanged.addListener(ch=>{const E=ch.banane56PasseDiff?.newValue;if(!E)return;
      const ok=arret.ombre!==undefined?E.phase==='ombre'&&E.index>=arret.ombre:(E.ecriture?.prouves||[]).length>=arret.prouves;
      if(ok)res(JSON.parse(JSON.stringify({phase:E.phase,passe:E.passe,index:E.index,ecriture:E.ecriture})));}));},arret);
    const passeFinie=async()=>{let v;for(let i=0;i<600;i++){await dormir(500);v=await api('view');if(!['calcul','ecriture'].includes(v.passeDifferes?.etat))break;}return v;};
    await api('start',{part:PARTIE,start:DEBUT,end:FIN,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',unresolvedPolicy:'defer',lotDecision:'apply',geometryEngine:'geometry-candidate-v1'});
    let v;for(let i=0;i<1200;i++){await dormir(500);v=await api('view');if(v?.batch?.state!=='RUNNING')break;}
    if(relance){await passeFinie();await aller(FIN+1);await dormir(800);await api('passe-differes-ecrire');}
    const vu=await Promise.race([pan.evaluate(()=>window.__arret),dormir(180000).then(()=>null)]);
    if(vu){const cdp=await ctx.newCDPSession(pan);await cdp.send('ServiceWorker.enable').catch(()=>{});await cdp.send('ServiceWorker.stopAllWorkers');}
    await dormir(1000);v=await passeFinie();
    const journal=await api('journal'),ev=(journal.events||[]).slice().sort((a,b)=>a.timestamp<b.timestamp?-1:1);
    return {vu,v,ev,serveur:serveur.journal.ecritures.map(e=>({ligne:e.rowKey,statut:e.body?.ExtractionStatus})),erreurs};
  }finally{await ctx.close().catch(()=>{});await serveur.fermer();}
}
const de=(r,t)=>r.ev.filter(e=>e.type===t);
function controler(r){
  assert.ok(r.vu,'l’arrêt a eu lieu pendant la passe');assert.deepEqual(r.erreurs,[]);
  const rep=de(r,'passe-differes-reprise');assert.equal(rep.length,1,'une reprise après l’arrêt');assert.equal(rep[0].motif,'sw-redemarre');
  assert.ok(r.ev.some(e=>e.type==='phase-timing'&&e.point==='restored'),'service worker redémarré (point « restored »)');
  assert.ok(!['calcul','ecriture'].includes(r.v.passeDifferes?.etat),'passe close');assert.equal(r.v.passeDifferes.reprise,'sw-redemarre');
  const traces=new Set([...de(r,'passe-differes-ombre').map(e=>e.identity.cut),...rep[0].restes.filter(x=>x.etat!=='differe'||x.motif).map(x=>x.cut)]);
  for(const x of rep[0].restes)assert.ok(traces.has(x.cut),'reste '+x.cut+' sans trace');
  const valides=r.serveur.filter(e=>e.statut==='valid').map(e=>e.ligne);assert.equal(new Set(valides).size,valides.length,'au plus une écriture « valid » par ligne');
  const acc=de(r,'validation-accepted').filter(e=>e.passeDifferes).map(e=>e.identity.cut);assert.equal(new Set(acc).size,acc.length,'au plus une validation de la passe par cut');
  return rep[0];
}
test('arrêt du service worker au 2e reste décidé : reprise au point gardé, passe close, chaque reste tracé, aucune double écriture',opts,async()=>{
  const r=await scenario({arret:{ombre:2}});const rep=controler(r);assert.equal(rep.phase,'ombre');
  assert.equal(de(r,'passe-differes-ombre-fin').filter(e=>e.reprise==='sw-redemarre').length,1);
  console.log('# arrêt',JSON.stringify(r.vu),'| reprise',JSON.stringify({phase:rep.phase,passe:rep.passe,index:rep.index,decidees:rep.decidees,posees:rep.posees}),'| fin',JSON.stringify(de(r,'passe-differes-ecriture-fin').map(e=>e.issue)));
});
test('passe relancée, arrêt après la première validation prouvée : compté écrit ou refait, jamais réécrit ; passe close',opts,async()=>{
  const r=await scenario({arret:{prouves:1},relance:true});const rep=controler(r);assert.equal(rep.phase,'ecriture');
  const fin=de(r,'passe-differes-ecriture-fin').at(-1);assert.equal(fin.reprise,'sw-redemarre');
  console.log('# arrêt',JSON.stringify(r.vu),'| reprise',JSON.stringify({phase:rep.phase,ecrites:rep.ecrites,cutEnVol:rep.cutEnVol,enVol:rep.enVol}),'| fin',JSON.stringify({issue:fin.issue,ecrites:fin.ecrites,raison:fin.raison}),
    '| écritures serveur de la passe',JSON.stringify(r.serveur.filter(e=>de(r,'passe-differes-ecriture').some(x=>e.ligne.endsWith('-'+x.identity.cut)))));
});
