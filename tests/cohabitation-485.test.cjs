'use strict';
/* D1 (4.8.6) : numérotation de la version de test et cohabitation avec la
 * 4.8.0 dans le même onglet ESV (D-060, D-061 ; contre-regard d'Astra :
 * vérifier AVANT d'injecter ; adaptateur à propriétaire unique). */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {background,shadowHarness}=require('./helpers/background-harness.cjs');
const {page}=require('./helpers/page.cjs');
const K=require('../src/core.js');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const AUTRE=/Une autre Ariane \(4\.8\.0\) est active dans cet onglet : désactive-la dans edge:\/\/extensions, puis F5 sur ESV/;

function versionAffichee(m){
  assert.match(m.version,/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/);
  const parts=m.version.split('.');assert.ok(parts.every(n=>Number(n)<=65535),'numéros MV3 bornés');
  if(parts.length===3){assert.equal(m.version_name,undefined,'une stable ne porte pas de nom de test');return m.version;}
  const nom=`${parts.slice(0,3).join('.')} test ${parts[3]}`;assert.equal(m.version_name,nom,'le nom doit correspondre au quatrième numéro');return nom;
}
test('numérotation stable/test : format MV3, nom exact et identités courantes cohérentes',()=>{
  for(const version of ['4.8.0','4.8.6'])assert.equal(versionAffichee({version}),version,'stable historique conservée');
  assert.equal(versionAffichee({version:'4.9.0.7',version_name:'4.9.0 test 7'}),'4.9.0 test 7');
  for(const m of [{version:'4.9.0.2'},{version:'4.9.0.2',version_name:'4.9.0 test 1'},
    {version:'4.9.0',version_name:'4.9.0 test 1'},{version:'4.9.0.2',version_name:'4.8.6 test 1'},
    {version:'4.9.x.1',version_name:'4.9.0 test 1'},{version:'4.9.0.65536',version_name:'4.9.0 test 65536'}])assert.throws(()=>versionAffichee(m));
  const nom=versionAffichee(manifest);assert.equal(manifest.name,'Ariane');
  assert.equal(K.VERSION,manifest.version);assert.equal(K.VERSION_NAME,nom);
  const titre=`Ouvrir Ariane ${nom}`;assert.ok(manifest.action.default_title===titre||manifest.action.default_title.startsWith(titre+' — '));
  const html=fs.readFileSync(path.join(root,'panel.html'),'utf8');
  for(const text of [`<title>Ariane ${nom}</title>`,`<span>${nom}</span>`,`<footer>Ariane ${nom} ·`])assert.ok(html.includes(text),text);
  assert.ok(fs.readFileSync(path.join(root,'panel.js'),'utf8').includes(`home:'${nom}'`));
  assert.ok(fs.readFileSync(path.join(root,'src/bridge.js'),'utf8').includes(`'Ariane ${nom} · ouvrir'`));
  assert.ok(fs.readFileSync(path.join(root,'background.js'),'utf8').includes(`BananeCore3?.VERSION||'${manifest.version}',VERSION_NAME=globalThis.BananeCore3?.VERSION_NAME||'${nom}'`),'repli du service worker');
});
test('paquet : nom stable/test tiré du manifeste ; couples de version incohérents refusés',()=>{
  const parts=manifest.version.split('.'),nomAttendu=parts.length===4?`ariane-${parts.slice(0,3).join('.')}-test.${parts[3]}.zip`:`ariane-v${manifest.version}.zip`;
  versionAffichee(manifest);
  const py=`import importlib.util,json,sys
s=importlib.util.spec_from_file_location('p',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
print(m.nom_paquet(json.loads(sys.argv[2])))
for version in ['4.8.0','4.8.6']:
  print(m.nom_paquet({'version':version}))
print(m.nom_paquet({'version':'4.9.0.7','version_name':'4.9.0 test 7'}))
for version,nom in [('4.8.6.3','4.8.6 test 2'),('4.9.0.2','4.9.0 test 1'),('4.9.0.2','4.8.6 test 1'),('4.9.0.2','test libre')]:
  try:
    m.nom_paquet({'version':version,'version_name':nom});print('accepté')
  except ValueError:
    print('refusé')`;
  const r=spawnSync('python3',['-c',py,path.join(root,'tools/package.py'),JSON.stringify(manifest)],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.deepEqual(r.stdout.trim().split('\n'),[nomAttendu,'ariane-v4.8.0.zip','ariane-v4.8.6.zip','ariane-4.9.0-test.7.zip','refusé','refusé','refusé','refusé']);
});

/* Onglet ESV simulé pour chrome.scripting : le marqueur de l'adaptateur déjà
 * présent dans le monde principal, et ce qui y est injecté. */
const vm=require('node:vm');
function onglet(marqueur){const injecte=[],fenetre=marqueur?{__BANANE_V3_PAGE:marqueur}:{};
  return {injecte,fenetre,executeScript:async o=>{injecte.push(o);
    if(o.func)return [{frameId:0,result:vm.runInNewContext(`(${o.func})(...args)`,{window:fenetre,args:o.args||[]})}];
    /* Les fichiers de la page : l'adaptateur prend le tampon, s'il n'y en a pas déjà un. */
    if(o.files?.includes('src/adapter-page.js')&&!fenetre.__BANANE_V3_PAGE){
      fenetre.__BANANE_V3_PAGE={version:fenetre.__ARIANE_PROPRIETAIRE?.version,proprietaire:fenetre.__ARIANE_PROPRIETAIRE?.id??null};delete fenetre.__ARIANE_PROPRIETAIRE;}
    return [{frameId:0,result:undefined}];}};}
test('4.8.0 connectée puis TEST : refus avant toute injection, message clair',async()=>{
  const t=onglet({version:'4.8.0'}),b=background({shadow:shadowHarness(),executeScript:t.executeScript});
  await assert.rejects(b.api('connect',{tabId:1}),AUTRE);
  assert.equal(t.injecte.filter(o=>o.files).length,0,'aucun fichier injecté');
  assert.equal('__ARIANE_PROPRIETAIRE' in t.fenetre,false,'aucun tampon posé');
});
test('adaptateur de la même extension mais d’une autre version : recharger ESV, rien d’injecté',async()=>{
  const t=onglet({version:'4.8.6.0',proprietaire:'test'}),b=background({shadow:shadowHarness(),executeScript:t.executeScript});
  await assert.rejects(b.api('connect',{tabId:1}),new RegExp(`Recharge la page ESV \\(F5\\) pour activer Ariane ${K.VERSION_NAME.replaceAll('.', '\\.')}\\.`));
  assert.equal(t.injecte.filter(o=>o.files).length,0);
});
test('même version, même extension : connexion, sans réinjecter les modules de la page',async()=>{
  const t=onglet({version:K.VERSION,proprietaire:'test'}),b=background({shadow:shadowHarness(),executeScript:t.executeScript});
  await b.api('connect',{tabId:1});
  assert.deepEqual(JSON.parse(JSON.stringify(t.injecte.filter(o=>o.files).map(o=>[o.world,o.files]))),[['ISOLATED',['src/bridge.js']]]);
});
test('onglet vierge : tampon du propriétaire, puis modules et adaptateur, puis bridge',async()=>{
  const t=onglet(null),b=background({shadow:shadowHarness(),executeScript:t.executeScript});
  await b.api('connect',{tabId:1});
  /* Sonde et tampon en un seul passage dans la page : rien ne peut s'intercaler. */
  const ordre=t.injecte.map(o=>o.files?o.files.at(-1):'sonde-et-tampon');
  assert.deepEqual(ordre,['sonde-et-tampon','src/adapter-page.js','src/bridge.js']);
  const sonde=t.injecte[0];assert.equal(sonde.world,'MAIN');assert.deepEqual(JSON.parse(JSON.stringify(sonde.args)),['test',K.VERSION,K.VERSION_NAME]);
  assert.deepEqual({...t.fenetre.__BANANE_V3_PAGE},{version:K.VERSION,proprietaire:'test'});
});
test('ping d’un adaptateur sans le bon propriétaire après injection : refus',async()=>{
  const t=onglet(null),b=background({shadow:shadowHarness(),executeScript:t.executeScript});
  b.adapter.ping=async()=>({version:K.VERSION,pageId:'x',proprietaire:'autre-extension'});
  await assert.rejects(b.api('connect',{tabId:1}),/Une autre Ariane/);
});

/* Adaptateur de la page : propriétaire unique, modules gardés. */
test('TEST installée, puis commande d’un canal étranger (4.8.0) : aucune action ESV, refus dit, mise en sécurité',async()=>{
  const p=page();
  assert.equal(p.ctx.__BANANE_V3_PAGE.proprietaire,'test');assert.equal(p.ctx.__BANANE_V3_PAGE.version,K.VERSION);
  assert.equal(Object.isFrozen(p.ctx.__BANANE_V3_PAGE),true);
  const avant=p.nodes.get('O2N3DCutDescription').textContent;
  await assert.rejects(p.raw('next',[],{proprietaire:undefined}).promise,new RegExp(`Une autre Ariane \\(${K.VERSION_NAME.replaceAll('.', '\\.')}\\) est active dans cet onglet`));
  assert.equal(p.nodes.get('O2N3DCutDescription').textContent,avant,'aucune navigation');
  await assert.rejects(p.call('next'),/en sécurité : une autre Ariane a tenté de commander cet onglet \(« next »\)/);
  assert.equal(p.nodes.get('O2N3DCutDescription').textContent,avant,'le propriétaire lui-même ne commande plus ESV');
  const ping=await p.call('ping');assert.equal(ping.proprietaire,'test');assert.equal(ping.intrusion?.action,'next');
});
test('un ping étranger reçoit le refus, sans mettre l’adaptateur en sécurité',async()=>{
  const p=page();
  await assert.rejects(p.raw('ping',[],{proprietaire:'autre'}).promise,new RegExp(`Une autre Ariane \\(${K.VERSION_NAME.replaceAll('.', '\\.')}\\)`));
  assert.equal((await p.call('ping')).intrusion,null);
});
test('l’adaptateur garde ses modules : une réinjection d’une autre version ne les remplace pas',async()=>{
  const d0={start:async()=>({module:'test'})},p=page({globals:{BananeNativePage4:{Observer:class{start(){return d0.start();}}}}});
  p.ctx.BananeNativePage4={Observer:class{start(){return {module:'4.8.0'};}}};
  assert.deepEqual(await p.call('nativeStart',{}),{module:'test'});
});
test('adaptateur installé sans tampon de propriétaire : il n’obéit à personne',async()=>{
  const p=page({proprietaire:null});
  await assert.rejects(p.call('next'),/Une autre Ariane|sans propriétaire/);
});

/* Revue de code de D1 (29/09). */
test('revue : une commande étrangère sans effet sur ESV (annulation, arrêt d’Écho) est refusée sans mettre en sécurité',async()=>{
  const p=page();
  for(const action of ['cancel','nativePause','nativeFinish','state'])
    await assert.rejects(p.raw(action,[],{proprietaire:undefined}).promise,/Une autre Ariane/);
  assert.equal((await p.call('ping')).intrusion,null);
});
test('revue : en sécurité, les arrêts restent permis (Écho et session manuelle)',async()=>{
  const p=page();await assert.rejects(p.raw('next',[],{proprietaire:undefined}).promise,/Une autre Ariane/);
  for(const action of ['nativePause','nativeFinish','manualPause','manualFinish','cancel']){
    const r=await p.call(action).then(()=>null,e=>e.message);assert.doesNotMatch(String(r),/en sécurité/,action);}
});
test('revue : connexion à un adaptateur en sécurité → refus, avec la cause',async()=>{
  const t=onglet({version:K.VERSION,proprietaire:'test'}),b=background({shadow:shadowHarness(),executeScript:t.executeScript});
  b.adapter.ping=async()=>({version:K.VERSION,pageId:'x',proprietaire:'test',intrusion:{action:'capture',at:'t'}});
  await assert.rejects(b.api('connect',{tabId:1}),/en sécurité : une autre Ariane a tenté de commander cet onglet \(« capture »\)/);
});
test('revue : adaptateur sans propriétaire (4.8.0, ou ancienne version de cette Ariane) : F5 suffit si c’est une mise à jour',async()=>{
  const t=onglet({version:'4.8.0'}),b=background({shadow:shadowHarness(),executeScript:t.executeScript});
  await assert.rejects(b.api('connect',{tabId:1}),/Une autre Ariane \(4\.8\.0\)[^]*F5 sur ESV[^]*mise à jour de cette Ariane, F5 suffit/);
});
test('revue : la reconnexion après F5 abandonne tout de suite devant une autre Ariane',async()=>{
  const t=onglet({version:'4.8.0'}),b=background({shadow:shadowHarness(),executeScript:t.executeScript});
  const debut=Date.now();
  await assert.rejects(b.fonction('reconnecterESV')(60000),AUTRE);
  assert.ok(Date.now()-debut<2000,'pas d’attente de toute la durée');
  assert.equal(t.injecte.filter(o=>o.func).length,1,'une seule sonde');
});
