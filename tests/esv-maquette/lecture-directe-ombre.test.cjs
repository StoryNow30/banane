'use strict';
/* CH-063, piste 1 — prototype de LECTURE DIRECTE EN OMBRE, sur la maquette seulement. Le patch `chantiers/CH-063/lecture-directe-ombre.patch`
 * (pour src/adapter-page.js, src/esv-observer.js, src/settings.js, background.js : fichiers non modifiés par le chantier) est appliqué à une
 * COPIE en mémoire, injectée comme le fait background.js. Ce que l'essai PROUVE sur la maquette :
 *   (1) allumée avec le décodeur de la maquette : après la capture, les nœuds relus sont, au bit près, ceux qu'ESV affiche ; la capture est
 *       celle d'avant (mêmes points) ; Ariane ne demande pas plus de ressources de points qu'ESV n'en a demandé pour le cut ;
 *   (2) première erreur du serveur : arrêt, plus aucune requête d'Ariane aux cuts suivants ;
 *   (3) coupée (défaut du patch) : aucune requête, aucun événement ;
 *   (4) allumée sans l'option réseau (cache seulement, défaut) : aucune requête d'Ariane au serveur (la maquette répond `no-store`).
 * Ne prouve RIEN sur le vrai ESV (format des nœuds non décodé, cache HTTP inconnu).
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=120000 tests/esv-maquette/lecture-directe-ombre.test.cjs */
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),cp=require('node:child_process');
const N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
const PATCH=path.join(N.racine,'chantiers/CH-063/lecture-directe-ombre.patch');
/* Les fichiers du dépôt, patchés dans un dossier temporaire (le dépôt n'est jamais modifié). */
function fichiersPatches(){const d=fs.mkdtempSync(path.join(os.tmpdir(),'ch063-'));
  for(const f of ['src/adapter-page.js','src/esv-observer.js','src/settings.js','background.js']){fs.mkdirSync(path.join(d,path.dirname(f)),{recursive:true});fs.copyFileSync(path.join(N.racine,f),path.join(d,f));}
  cp.execFileSync('git',['apply','--unsafe-paths','--directory=.',PATCH],{cwd:d});
  const lire=f=>fs.readFileSync(path.join(d,f),'utf8');const out={adapter:lire('src/adapter-page.js'),settings:lire('src/settings.js')};fs.rmSync(d,{recursive:true,force:true});return out;}
async function ouvrir(reglage,route){
  const env=await N.ouvrir({maquette:{cuts:6,latence:20}}),P=fichiersPatches();
  const ept=[];/* requêtes de points vues par le navigateur, dans l'ordre : { ariane } = émise après une capture */
  /* `route:false` : pas d'interception (elle fausserait `only-if-cached`) ; les requêtes se comptent alors au journal du serveur de la maquette. */
  if(route!==false)await env.page.route('**/maquette/ept-data/**',async r=>{ept.push(r.request().url());const k=route?route(ept.length):null;if(k)return r.fulfill(k);return r.continue();});
  await env.page.addScriptTag({content:`window.__ombre=[];addEventListener('message',e=>{if(e.data?.kind==='banane5:evt'&&e.data.event?.kind==='lecture-directe-ombre')window.__ombre.push(e.data.event);});`});
  await env.page.addScriptTag({content:`window.__ARIANE_PROPRIETAIRE={id:'essai',version:'0',versionName:'essai'};window.__messages=[];`});
  for(const f of N.PAGE_FILES){let c=f==='src/adapter-page.js'?P.adapter:f==='src/settings.js'?P.settings:N.lire(f);
    if(f==='src/adapter-page.js'){await env.page.addScriptTag({content:N.lire('src/lecture-directe.js')});
      await env.page.evaluate(r=>{window.BananeSettings={...window.BananeSettings,lectureDirecte:{...window.BananeSettings.lectureDirecte,...r}};},reglage);}
    await env.page.addScriptTag({content:c});}
  return {env,ept};}
/* Cut suivant par le bouton d'ESV, rails prêts, capture par l'adaptateur réel, puis attente de l'événement d'ombre (ou d'un délai). */
async function cutSuivantEtCapture(env,attendreOmbre=true){
  const avant=await env.page.evaluate(()=>window.__ombre.length);
  await env.page.click('#O2N3DCutNext3DRail');await env.page.waitForFunction(()=>window.__maquette.etat().railsPrets);
  await env.page.waitForFunction(()=>window.Potree.numNodesLoading===0&&window.viewer.scene.pointclouds[0].visibleNodes.length>0);
  const s=(await env.appel('state')).result,c=await env.appel('capture',[s]);assert.equal(c.error,undefined,c.error);
  if(attendreOmbre)await env.page.waitForFunction(n=>window.__ombre.length>n,avant,{timeout:5000});else await env.page.waitForTimeout(300);
  return {capture:c.result,ombre:await env.page.evaluate(n=>window.__ombre.slice(n),avant)};}

let A=null,B=null,C=null,D=null,premiereA=null;
before(async()=>{if(raison)return;
  A=await ouvrir({actif:true,reseau:true,decodeur:'maquette'});
  B=await ouvrir({actif:true,reseau:true,decodeur:'maquette'},n=>n===2?{status:502,body:'{}',contentType:'application/json'}:null);
  C=await ouvrir({});D=await ouvrir({actif:true,decodeur:'maquette'},false);});
after(async()=>{for(const x of [A,B,C,D])if(x)await x.env.fermer();});

test('(1) allumée : nœuds relus identiques au bit près à ceux affichés, capture inchangée, pas plus de requêtes qu\'ESV',opts,async()=>{
  for(let i=0;i<2;i++){const avant=A.ept.length,{capture,ombre}=await cutSuivantEtCapture(A.env);
    if(i===0)premiereA=capture.pointsSceneRelative;
    assert.equal(ombre.length,1);const o=ombre[0];
    assert.equal(o.etat,'fini');assert.equal(o.identite,true,JSON.stringify(o));assert.ok(o.noeudsRelus>0);
    assert.equal(o.identiques,o.noeudsVisibles);assert.equal(o.manquants,0);assert.equal(o.surplus,0);
    assert.equal(o.ressourcesEsv,1,'une ressource de points par cut dans la maquette');
    assert.ok(o.requetes<=o.requetesEsv,'jamais plus de requêtes qu\'ESV');
    assert.equal(A.ept.length-avant,2,'la requête d\'ESV et une seule relecture');
    assert.equal(capture.status,'complete-loaded-roi');assert.ok(capture.pointsSceneRelative.length>0);
    assert.ok(!JSON.stringify(o).includes('ept-data'),'aucune adresse dans l\'événement');}
});
test('(2) première erreur : arrêt, plus aucune requête d\'Ariane ensuite',opts,async()=>{
  const r1=await cutSuivantEtCapture(B.env);assert.equal(r1.ombre[0].etat,'arrete');assert.equal(r1.ombre[0].motif,'erreur-http');
  const n=B.ept.length,r2=await cutSuivantEtCapture(B.env);
  assert.equal(r2.ombre[0].etat,'arrete');assert.equal(B.ept.length-n,1,'seule la requête d\'ESV');
});
test('(3) coupée : aucune requête d\'Ariane, aucun événement, capture faite',opts,async()=>{
  const n=C.ept.length,{capture,ombre}=await cutSuivantEtCapture(C.env,false);
  assert.equal(ombre.length,0);assert.equal(C.ept.length-n,1,'seule la requête d\'ESV');
  assert.deepEqual(capture.pointsSceneRelative,premiereA,'même cut, mêmes points, allumée ou coupée');
});
test('(4) cache seulement (défaut) : rien dans le cache, aucune requête d\'Ariane au serveur',opts,async()=>{
  const serveur=async()=>(await (await fetch(D.env.serveur.url+'/maquette/journal')).json()).requetes.filter(r=>r.chemin.includes('/ept-data/')).length;
  const n=await serveur(),{ombre}=await cutSuivantEtCapture(D.env);
  assert.equal(await serveur()-n,1,'le serveur ne reçoit que la requête d\'ESV');
  const o=ombre[0];assert.deepEqual([o.etat,o.mode,o.requetesReseau,o.dansLeCache,o.horsCache,o.identite],['fini','cache',0,0,1,false]);
});
test('aucune erreur de page (hors le 502 voulu du cas 2 et le défaut de cache voulu du cas 4)',opts,()=>{for(const x of [A,B,C,D])assert.deepEqual(x.env.erreurs.filter(e=>!(x===B&&/status of 502/.test(e))&&!(x===D&&/ERR_CACHE_MISS/.test(e))),[]);});
