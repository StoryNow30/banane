'use strict';
/* 4.9.0.16 (test 15, l'opérateur : envoyer l'export sans script, limite d'environ 18 Mo par fichier) —
 * « Tout télécharger » découpe tout seul : chaque volume est un zip autonome dont la taille RÉELLE
 * (compressée, CONTENU.txt compris) reste sous `zipMaxBytes` ; un fichier JSON n'est jamais coupé
 * (seul, il fait un volume à lui et le statut le dit) ; CONTENU.txt dit « Volume n sur N » et porte
 * les départs ; le vidage automatique n'a lieu que si TOUS les volumes sont confirmés. Panneau réel,
 * stockage simulé, archives relues par Python (zipfile). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const Z=require('../src/zip-writer.js'),X=require('../src/native-export.js'),K=require('../src/core.js'),EC=require('../src/export-cache.js');
const Settings=require('../src/settings.js'),GCV1=require('../src/gcv1-export.js');
const {panneau}=require('../tools/audit-qualite-480.cjs');
const A=require('../tools/acceptance-report.cjs');
const {base}=require('./fixtures.cjs');
const PYTHON=spawnSync('python3',['-I','-c','import zipfile'],{encoding:'utf8'}).status===0;
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'ariane-t16-'));
function lirePython(fichier,dossier){
  const code=`
import zipfile,sys,json
z=zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
print(json.dumps([{'nom':i.filename,'taille':i.file_size} for i in z.infolist()]))
z.extractall(sys.argv[2])`;
  const r=spawnSync('python3',['-I','-c',code,fichier,dossier],{encoding:'utf8',maxBuffer:64*1024*1024});
  assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
function nuage(i){
  const pts=Array.from({length:300},(_,j)=>[i+j*0.12345678901234,2.5+j/7,1.000000000001*j]);
  return {format:'banane-native-lidar-capture-v2',version:'4.9.0.16',captureId:'cap-'+i,sessionId:'s1',visitId:'v'+i,
    identity:{pageId:'p',part:7,cut:100+i,shape:'U50',frameId:'f',projectId:null},part:7,cut:100+i,shape:'U50',
    coordinateSystem:{name:'scene-relative',matrixLayout:'column-major; column vectors',units:'u',frameId:'f'},
    rails:{left:K.clone(base.rails.left),right:K.clone(base.rails.right)},camera:{type:'OrthographicCamera',fov:i},
    nodes:[{id:'n1',nearestToRailOrigin:[1,2,3]}],pointsSceneRelative:pts,pointSources:pts.map((_,j)=>[i%3,j]),visibleByClipBoxes:pts.map((_,j)=>j%3!==0),
    attributes:{intensity:pts.map((_,j)=>j*3+i),classification:pts.map((_,j)=>j%5)},trace:{pointsSaved:300},quality:{status:'ok'},warnings:[]};
}
const FICHES=[{at:'2026-10-14T12:01:00.000Z',batchId:'lot-a',partie:23,valides:8599,invalides:661,total:9260},
  {at:'2026-10-15T07:35:00.000Z',batchId:'lot-b',partie:24,valides:9169,invalides:106,total:9275}];
async function exporter({zipMaxBytes,etats=()=>'complete',vider=false,n=6}={}){
  const clouds=new Map(Array.from({length:n},(_,i)=>['cap-'+i,nuage(i)]));
  const events=Array.from({length:300},(_,i)=>({eventId:'e'+i,eventSeq:i+1,type:'proposed',timestamp:'2026-10-15T07:00:00.000Z',identity:{part:7,cut:100+(i%n)},detail:'x'.repeat(40)}));
  const records=Array.from({length:n},(_,i)=>({recordId:'r'+i,visitIndex:i,identity:{part:7,cut:100+i},captureId:'cap-'+i}));
  const store={all:async t=>structuredClone(t==='events'?events:t==='records'?records:[]),
    keys:async t=>t==='clouds'?[...clouds.keys()]:t==='events'?events.map(e=>e.eventId):records.map(r=>r.recordId),getCloud:async id=>structuredClone(clouds.get(id))};
  const diagnostic={format:'banane-gcv1-diagnostic-v1',version:'4.9.0.16',sessionId:'s1',observationCount:n,observations:[...clouds.keys()].map((id,i)=>({observationEventId:'o'+i,lidar:{captureId:id},identity:{part:7,cut:100+i}}))};
  const meta={format:'banane-test-dataset-v4',version:'4.9.0.16',exportedAt:'2026-10-15T07:58:00.000Z',state:{batch:{id:'lot-b',state:'STOPPED'},sessionId:'s1'},stateOmits:['records','incomplete'],closureSummary:{visits:n},cloudIds:[...clouds.keys()]};
  const globals={BananeStorage3:class{constructor(){return store;}},BananeExportCache:EC,BananeNativeExport:X,BananeZip:Z,
    BananeSettings:{...Settings,export:{...Settings.export,mode:'complet',segmentBytes:6000,segmentReserveBytes:500,minObjectsPerSegment:1,viderApresExport:vider,...(zipMaxBytes?{zipMaxBytes}:{})}},
    BananeGCV1Export:{buildDiagnostic:()=>structuredClone(diagnostic),buildCorpusPlan:GCV1.buildCorpusPlan}};
  let id=0;const noms=new Map(),vidages=[];
  const chromeExtra={downloads:{download:async o=>{id++;noms.set(id,o.filename);return id;},search:async({id:i})=>[{state:etats(noms.get(i))}],onChanged:{addListener(){},removeListener(){}}}};
  const state={current:{identity:{part:7,cut:100}},batch:{state:'STOPPED',scope:{part:7,start:100,end:105},processed:[],deferred:[],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:[],activeIdentity:null}};
  const p=await panneau(state,{globals,chromeExtra,reponses:{'dataset-meta':meta,'journal-meta':{...meta,format:'banane-test-journal-v4',cloudIds:undefined},'gcv1-export-meta':{version:'4.9.0.16',sessionId:'s1'},cloud:null,
    'fiches-depart':{fiches:FICHES},'export-cache-info':()=>({refus:null,marqueur:null}),
    'export-cache-clear':a=>{vidages.push(a);return {cleared:true,events:a.ids.events.length,records:a.ids.records.length,clouds:a.ids.clouds.length};}}});
  await p.$('export-tout').onclick();await p.attendre();
  return {p,statut:p.$('export-status').textContent,blobs:p.downloads,noms:[...noms.values()],vidages};
}
async function ouvrirVolumes(r){
  const dossier=tmp(),vols=[];
  for(const [i,b] of r.blobs.entries()){const f=path.join(tmp(),`v${i}.zip`);fs.writeFileSync(f,Buffer.from(await b.arrayBuffer()));
    const d=path.join(dossier,'v'+i);fs.mkdirSync(d);vols.push({octets:b.size,entrees:lirePython(f,d),contenu:fs.readFileSync(path.join(d,'CONTENU.txt'),'utf8'),dossier:d});}
  return vols;
}

test('réglage par défaut : 17 Mo par volume (sous 18 Mo, quelle que soit la façon de compter), lisible dans les réglages',()=>{
  assert.equal(Settings.export.zipMaxBytes,17*1048576);assert.ok(Settings.export.zipMaxBytes<18e6);
  const l=Settings.describe().find(x=>x.nom==='Taille d’un volume zip');assert.ok(l);assert.match(l.valeur,/17 Mo au plus \(compressé\)/);
});

test('zip : préparer puis écrire donne la même archive qu’ajouter ; taille finale annoncée exacte',async()=>{
  const d=new Date(Date.UTC(2026,9,15,7,0,0)),a=Z.createZip({date:d}),b=Z.createZip({date:d});
  const contenus=[['a.json','{"x":1}'],['b.json','{"p":['+Array.from({length:4000},(_,i)=>i/7).join(',')+']}']];
  for(const [n,c] of contenus){await a.ajouter(n,new Blob([c]));const p=await Z.preparer(n,new Blob([c]),{methode:b.methode});
    const avant=b.octetsTermines;b.ajouterPrepare(p);assert.equal(b.octetsTermines-avant,Z.coutEntree(p),'coût annoncé = octets ajoutés');}
  const fin=b.octetsTermines,ba=Buffer.from(await a.terminer().arrayBuffer()),bb=Buffer.from(await b.terminer().arrayBuffer());
  assert.equal(bb.length,fin,'octetsTermines = taille du zip terminé');assert.ok(ba.equals(bb),'même archive, octet pour octet');
});

test('plusieurs volumes : chacun est un zip complet SOUS la limite réelle ; « Volume n sur N » ; départs dans chacun ; rien ne manque',{skip:!PYTHON&&'python3 absent'},async()=>{
  const max=120000,r=await exporter({zipMaxBytes:max});
  const N=r.blobs.length;assert.ok(N>=3,'plusieurs volumes : '+N+' — '+r.statut);
  assert.doesNotMatch(r.statut,/incomplet|dépasse seul/,r.statut);assert.match(r.statut,new RegExp(`${N} archive\\(s\\) zip, ${N} volumes de`));assert.match(r.statut,/Envoie-les \d+, tels quels/);
  r.noms.forEach((nom,i)=>assert.match(nom,new RegExp(`^ariane-lot-[0-9T-]+-volume${String(i+1).padStart(2,'0')}-sur${String(N).padStart(2,'0')}\\.zip$`),nom));
  const vols=await ouvrirVolumes(r),vus=new Set(),json=tmp();
  for(const [i,v] of vols.entries()){
    assert.ok(v.octets<=max,`volume ${i+1} : ${v.octets} octets pour ${max} au plus`);
    assert.match(v.contenu,new RegExp(`^Volume ${i+1} sur ${N} : `,'m'));assert.match(v.contenu,/il faut les \d+ pour l'export entier/);
    assert.match(v.contenu,/Départs des parties \(2\)/);assert.match(v.contenu,/partie 24 · validés 9 169 · invalides 106 · total 9 275/);
    for(const e of v.entrees.filter(e=>e.nom!=='CONTENU.txt')){assert.ok(!vus.has(e.nom),'fichier en double : '+e.nom);vus.add(e.nom);fs.copyFileSync(path.join(v.dossier,e.nom),path.join(json,e.nom));}}
  assert.equal(A.loadLot(json,'volumes').corpus.clouds.length,6,'les volumes réunis donnent l’export entier');
});

test('un fichier JSON plus gros que la limite n’est pas coupé : seul dans son volume, et le statut le dit',{skip:!PYTHON&&'python3 absent'},async()=>{
  const max=40000,r=await exporter({zipMaxBytes:max});
  assert.match(r.statut,/dépasse seul .* ; il est seul dans le volume \d+/,r.statut);assert.match(r.statut,/plus gros que la limite d’envoi/);
  const vols=await ouvrirVolumes(r),gros=vols.filter(v=>v.octets>max);assert.ok(gros.length>=1,'au moins un volume au-delà de la limite');
  for(const v of gros){assert.equal(v.entrees.filter(e=>e.nom!=='CONTENU.txt').length,1,'un seul fichier JSON dans un volume trop gros');assert.match(v.contenu,/dépasse seul la limite/);}
  for(const v of vols)for(const e of v.entrees.filter(e=>e.nom.endsWith('.json')))JSON.parse(fs.readFileSync(path.join(v.dossier,e.nom),'utf8'));
});

test('un seul volume : nom sans numéro, CONTENU « Archive unique »',{skip:!PYTHON&&'python3 absent'},async()=>{
  const r=await exporter({});assert.equal(r.blobs.length,1);assert.match(r.noms[0],/^ariane-lot-[0-9T-]+\.zip$/);assert.match(r.statut,/1 archive\(s\) zip/);
  const [v]=await ouvrirVolumes(r);assert.match(v.contenu,/^Archive unique : /m);assert.doesNotMatch(v.contenu,/Volume \d+ sur/);
});

test('vidage automatique : seulement si TOUS les volumes sont confirmés ; un seul volume interrompu => rien n’est vidé',async()=>{
  const ok=await exporter({zipMaxBytes:120000,vider:true});
  assert.ok(ok.blobs.length>=3);assert.equal(ok.vidages.length,1,ok.statut);assert.match(ok.statut,/Cache d’export vidé/);
  const ko=await exporter({zipMaxBytes:120000,vider:true,etats:nom=>/volume02/.test(nom)?'interrupted':'complete'});
  assert.ok(ko.blobs.length>=3);assert.equal(ko.vidages.length,0,'aucun vidage');assert.match(ko.statut,/volume02-sur\d+\.zip non enregistré/);assert.match(ko.statut,/NON vidé/);
});

/* 4.9.0.17 (l'opérateur : « l'heure de Paris partout ») : CONTENU.txt, que l'opérateur lit, écrit l'heure de l'export
 * et les départs en heure de Paris, et le dit ; les JSON gardent leurs horodatages ISO en UTC. */
test('CONTENU.txt en heure de Paris (« heure de Paris », plus « UTC ») ; les JSON gardent l’ISO UTC',{skip:!PYTHON&&'python3 absent'},async()=>{
  const r=await exporter({});const [v]=await ouvrirVolumes(r);
  assert.match(v.contenu,/^Export Ariane — mode .+ — \d\d\/\d\d\/\d{4} \d\d:\d\d:\d\d heure de Paris$/m);
  assert.match(v.contenu,/Départs des parties \(2\), heure de Paris :/);
  assert.match(v.contenu,/14\/10\/2026 14:01:00 · partie 23/,'12:01 UTC le 14/10 = 14:01 à Paris (CEST)');
  assert.match(v.contenu,/15\/10\/2026 09:35:00 · partie 24/,'07:35 UTC le 15/10 = 09:35 à Paris');
  assert.doesNotMatch(v.contenu,/UTC/);
  const bilan=fs.readdirSync(v.dossier).filter(n=>n.endsWith('.json')).map(n=>fs.readFileSync(path.join(v.dossier,n),'utf8')).join('\n');
  assert.ok(bilan.includes('"timestamp":"2026-10-15T07:00:00.000Z"'),'les événements gardent leur horodatage ISO UTC dans le JSON');
});
