'use strict';
/* V2 (D-079) — poids des exports Orbite : une seule copie des nuages, en-tête
 * écrit une fois, « Tout télécharger » en UN zip, mode d'export « complet ».
 * Données synthétiques seulement. Le zip est relu par un décodeur INDÉPENDANT
 * (Python `zipfile`) ; les exports d'avant restent lisibles par les outils. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const Z=require('../src/zip-writer.js'),X=require('../src/native-export.js'),K=require('../src/core.js');
const Settings=require('../src/settings.js'),GCV1=require('../src/gcv1-export.js');
const {panneau}=require('../tools/audit-qualite-480.cjs');
const {mergeFiles}=require('../tools/merge-segments.cjs');
const A=require('../tools/acceptance-report.cjs'),R=require('../tools/reducteur-exports-core.js');
const {base}=require('./fixtures.cjs');

const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'ariane-v2-'));
const py=spawnSync('python3',['-I','-c','import zipfile'],{encoding:'utf8'});
const PYTHON=py.status===0;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
/* Décodeur indépendant : CRC et contenu relus par zipfile (testzip), puis rapport JSON. */
function lirePython(fichier,dossier){
  const code=`
import zipfile,sys,json,zlib,hashlib
z=zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
out=[]
for i in z.infolist():
    d=z.read(i.filename)
    assert zlib.crc32(d)&0xffffffff==i.CRC,i.filename
    assert len(d)==i.file_size,i.filename
    out.append({'nom':i.filename,'taille':i.file_size,'zip':i.compress_size,'methode':i.compress_type,'crc':i.CRC,'sha':hashlib.sha256(d).hexdigest(),'utf8':bool(i.flag_bits&0x800)})
if len(sys.argv)>2: z.extractall(sys.argv[2])
print(json.dumps(out))`;
  const r=spawnSync('python3',['-I','-c',code,fichier,...(dossier?[dossier]:[])],{encoding:'utf8',maxBuffer:64*1024*1024});
  assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
const octets=async blob=>Buffer.from(await blob.arrayBuffer());

test('CRC-32 : valeurs de référence, calcul incrémental identique',()=>{
  assert.equal(Z.crc32(Buffer.from('123456789')),0xCBF43926);
  assert.equal(Z.crc32(Buffer.from('The quick brown fox jumps over the lazy dog')),0x414FA339);
  assert.equal(Z.crc32(Buffer.alloc(0)),0);
  const b=crypto.randomBytes(100000);
  assert.equal(Z.crc32(b.subarray(50000),Z.crc32(b.subarray(0,50000))),Z.crc32(b));
});

test('zip écrit à la main : relu par Python zipfile, CRC et tailles exacts (deflate et stored)',{skip:!PYTHON&&'python3 absent'},async()=>{
  const gros=Buffer.from(Array.from({length:60000},(_,i)=>`{"p":[${i/7},${i/13},${i%5}]}`).join(',')); // ~2 Mo, compressible
  const hasard=crypto.randomBytes(300000);                                                          // incompressible
  const contenus=[['a/journal.json',Buffer.from('{"x":1}')],['gros.json',gros],['vide.json',Buffer.alloc(0)],['hasard.bin',hasard],['accentué-é.json',Buffer.from('{"é":"ü"}')]];
  for(const methode of ['deflate','stored']){
    const zip=Z.createZip({methode,date:new Date(Date.UTC(2026,9,7,12,34,56))});
    for(const [nom,c] of contenus)await zip.ajouter(nom,new Blob([c]));
    const blob=zip.terminer(),f=path.join(tmp(),'t.zip');fs.writeFileSync(f,await octets(blob));
    const lu=lirePython(f);
    assert.deepEqual(lu.map(e=>e.nom),contenus.map(c=>c[0]));
    for(const [i,[nom,c]] of contenus.entries()){
      assert.equal(lu[i].taille,c.length,nom);assert.equal(lu[i].sha,sha(c),nom);assert.equal(lu[i].crc,Z.crc32(c),nom);assert.equal(lu[i].utf8,true);}
    if(methode==='deflate'){
      assert.equal(zip.methode,'deflate');assert.equal(lu[1].methode,8);assert.ok(lu[1].zip<lu[1].taille/2,'le JSON se compresse : '+lu[1].zip+' / '+lu[1].taille);
      assert.equal(lu[3].methode,0,'données incompressibles : stored, jamais plus gros');
    }else assert.ok(lu.every(e=>e.methode===0&&e.zip===e.taille));
  }
});

test('zip : noms dangereux, doublons et archive terminée sont refusés',async()=>{
  const zip=Z.createZip({methode:'stored'});
  for(const mauvais of ['../x.json','/abs.json','a\\b.json','C:/x.json','','a//b.json'])await assert.rejects(zip.ajouter(mauvais,new Blob(['x'])),/refusé/,mauvais);
  await zip.ajouter('ok.json',new Blob(['{}']));await assert.rejects(zip.ajouter('ok.json',new Blob(['{}'])),/double/);
  zip.terminer();await assert.rejects(zip.ajouter('autre.json',new Blob(['{}'])),/terminée/);
});

/* ---------- le panneau réel, avec un faux stockage ---------- */
const N_POINTS=300;
function nuage(i){
  const id='cap-'+i,pts=Array.from({length:N_POINTS},(_,j)=>[i+j*0.12345678901234,2.5+j/7,1.000000000001*j]);
  return {format:'banane-native-lidar-capture-v2',version:'4.9.0.2',captureId:id,sessionId:'s1',visitId:'v'+i,
    identity:{pageId:'p',part:7,cut:100+i,shape:'U50',frameId:'f',projectId:null,viewEpochId:'view-'+i},part:7,cut:100+i,shape:'U50',
    coordinateSystem:{name:'scene-relative',matrixLayout:'column-major; column vectors',units:'u',frameId:'f'},
    rails:{left:K.clone(base.rails.left),right:K.clone(base.rails.right)},camera:{type:'OrthographicCamera',fov:i},
    nodes:[{id:'n0',probes:Array.from({length:6},(_,k)=>[k,i,k*2])},{id:'n1',nearestToRailOrigin:[1,2,3]}],
    pointsSceneRelative:pts,pointSources:pts.map((_,j)=>[i%3,j]),visibleByClipBoxes:pts.map((_,j)=>j%3!==0),
    attributes:{intensity:pts.map((_,j)=>j*3+i),classification:pts.map((_,j)=>j%5)},
    trace:{pointsSaved:N_POINTS,perRail:{left:{pointsSaved:N_POINTS/2},right:{pointsSaved:N_POINTS/2}}},quality:{status:'ok'},warnings:[]};
}
function jeu(n=6){
  const clouds=new Map(Array.from({length:n},(_,i)=>[`cap-${i}`,nuage(i)]));
  const events=Array.from({length:300},(_,i)=>({eventId:'e'+i,eventSeq:i+1,type:i%7?'proposed':'gcv1-shadow-observed',timestamp:'2026-10-07T07:00:00.000Z',
    identity:{pageId:'p',part:7,cut:100+(i%n),shape:'U50',frameId:'f'},detail:'x'.repeat(40)}));
  const records=Array.from({length:n},(_,i)=>({recordId:'r'+i,visitIndex:i,visitId:'v'+i,identity:{part:7,cut:100+i},captureId:'cap-'+i}));
  return {clouds,events,records};
}
const SEGMENT_PETIT={segmentBytes:6000,segmentReserveBytes:500,minObjectsPerSegment:2};
/* Panneau + stockage simulé. `zip:false` : sans l'écrivain zip, donc l'ancien chemin fichier par fichier. */
async function exporter({zip=true,data=jeu(),reglages={},lectureCapricieuse=null,bouton='export-tout'}={}){
  const lectures=new Map();
  const store={all:async n=>structuredClone(n==='events'?data.events:n==='records'?data.records:[]),keys:async n=>n==='clouds'?[...data.clouds.keys()]:[],
    getCloud:async id=>{lectures.set(id,(lectures.get(id)||0)+1);if(lectureCapricieuse?.(id,lectures.get(id)))throw Error('lecture refusée');return structuredClone(data.clouds.get(id));}};
  const diagnostic={format:'banane-gcv1-diagnostic-v1',version:'4.9.0.2',exportedAt:'2026-10-07T07:59:00.000Z',scope:'current-engine-session',sessionId:'s1',
    observationCount:data.clouds.size,observations:[...data.clouds.keys()].map((id,i)=>({observationEventId:'o'+i,lidar:{captureId:id,association:'x'},identity:{part:7,cut:100+i}}))};
  const reglagesPanneau={...Settings,export:{...Settings.export,...reglages}};
  const globals={BananeStorage3:class{constructor(){return store;}},BananeSettings:reglagesPanneau,BananeNativeExport:X,
    BananeGCV1Export:{buildDiagnostic:()=>structuredClone(diagnostic),buildCorpusPlan:GCV1.buildCorpusPlan},...(zip?{BananeZip:Z}:{})};
  const state={current:{identity:{part:7,cut:100}},batch:{state:'STOPPED',scope:{part:7,start:100,end:105},processed:[],deferred:[],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:[],activeIdentity:null}};
  const meta={format:'banane-test-dataset-v4',version:'4.9.0.2',exportedAt:'2026-10-07T07:58:00.000Z',state:{batch:{id:'lot-7',state:'STOPPED'},sessionId:'s1'},stateOmits:['records','incomplete'],
    closureSummary:{visits:data.records.length},cloudIds:[...data.clouds.keys()]};
  const p=await panneau(state,{globals,reponses:{'dataset-meta':meta,'journal-meta':{...meta,format:'banane-test-journal-v4',cloudIds:undefined},'gcv1-export-meta':{version:'4.9.0.2',sessionId:'s1'},cloud:null}});
  await p.$(bouton).onclick();await p.attendre();
  return {p,data,diagnostic,lectures,statut:p.$('export-status').textContent,blobs:p.downloads};
}
async function textes(blobs){return Promise.all(blobs.map(async b=>b.text()));}
/* Les documents JSON d'un export : fichiers directs, ou contenu des zip (extraits par Python). */
async function documents(r){
  const out=[];
  for(const b of r.blobs){
    if(b.type!=='application/zip'){out.push(JSON.parse(await b.text()));continue;}
    const f=path.join(tmp(),'x.zip'),d=tmp();fs.writeFileSync(f,await octets(b));lirePython(f,d);
    for(const n of fs.readdirSync(d).filter(n=>n.endsWith('.json')).sort())out.push(JSON.parse(fs.readFileSync(path.join(d,n))));
  }
  return out;
}
/* Clés d'un nuage, relu depuis n'importe quel fichier d'export. */
const nuagesDe=doc=>(doc.format===X.FORMAT?X.expand(doc):doc).clouds||[];

test('Tout télécharger : UN zip, JSON séparés dedans, relu par Python, CRC et tailles exacts',{skip:!PYTHON&&'python3 absent'},async()=>{
  const r=await exporter({reglages:SEGMENT_PETIT});
  assert.equal(r.blobs.length,1,'un seul fichier demandé au navigateur : '+r.statut);
  assert.match(r.statut,/1 archive\(s\) zip/);assert.doesNotMatch(r.statut,/incomplet/);
  const f=path.join(tmp(),'lot.zip');fs.writeFileSync(f,await octets(r.blobs[0]));
  const dossier=tmp(),lu=lirePython(f,dossier);
  const noms=lu.map(e=>e.nom);
  assert.ok(noms.some(n=>/^ariane-journal-v4-\d+\.json$/.test(n)));assert.ok(noms.some(n=>/^ariane-gcv1-diagnostic-\d+\.json$/.test(n)));
  assert.ok(noms.filter(n=>/^ariane-gcv1-corpus-.*-seg\d\d\.json$/.test(n)).length>=2,'corpus en segments conservés : '+noms);
  assert.ok(noms.some(n=>/^ariane-bilan-v4-.*-seg01\.json$/.test(n)));assert.ok(noms.includes('CONTENU.txt'));
  assert.equal(new Set(noms).size,noms.length);
  for(const e of lu)assert.equal(sha(fs.readFileSync(path.join(dossier,e.nom))),e.sha);
  assert.ok(lu.every(e=>e.methode===8||e.methode===0));
});

test('aucune perte : les nuages du zip sont ceux de l’ancien export (bilan et corpus), à l’identique',{skip:!PYTHON&&'python3 absent'},async()=>{
  const avant=await exporter({zip:false,reglages:SEGMENT_PETIT}),apres=await exporter({zip:true,reglages:SEGMENT_PETIT});
  const A0=await documents(avant),A1=await documents(apres);
  const kind=d=>(d.format===X.FORMAT?d.compactedFrom:d.format);
  const par=(liste,k)=>liste.filter(d=>kind(d)===k);
  // Avant : le bilan ET le corpus portent les 6 nuages.
  const bilanAvant=par(A0,'banane-test-dataset-v4').flatMap(nuagesDe),corpusAvant=par(A0,'banane-gcv1-lidar-corpus-v1').flatMap(nuagesDe);
  assert.equal(bilanAvant.length,6);assert.equal(corpusAvant.length,6);
  // Après : le bilan n'en recopie aucun, le corpus les porte tous.
  const bilanApres=par(A1,'banane-test-dataset-v4'),corpusApres=par(A1,'banane-gcv1-lidar-corpus-v1').flatMap(nuagesDe);
  assert.equal(bilanApres.flatMap(nuagesDe).length,0,'le bilan ne recopie plus les nuages');
  assert.equal(corpusApres.length,6);
  const id=c=>c.captureId,tri=l=>[...l].sort((a,b)=>id(a)<id(b)?-1:1);
  assert.deepEqual(tri(corpusApres),tri(corpusAvant),'corpus : identique champ par champ (intensité, classe, probes, pointSources compris)');
  assert.deepEqual(tri(corpusApres),tri(bilanAvant),'et identique aux nuages que le bilan portait avant');
  // De quoi retrouver chaque nuage par captureId.
  const ou=bilanApres[0].cloudsInCorpus;assert.deepEqual([...ou.captureIds].sort(),[...corpusApres.map(id)].sort());
  // Tout le reste du bilan est conservé : état, événements, enregistrements, clôture.
  const bil=bilanApres.map(d=>X.expand(d))[0];
  assert.equal(bil.events.length,300);assert.equal(bil.records.length,6);assert.equal(bil.state.batch.id,'lot-7');assert.equal(bil.closureSummary.visits,6);
  assert.equal(bil.exportMode,'complet');
  // Le diagnostic n'est écrit qu'une fois : fichier seul ; le corpus y renvoie.
  const diagnostics=A1.filter(d=>d.format==='banane-gcv1-diagnostic-v1');assert.equal(diagnostics.length,1);assert.equal(diagnostics[0].observationCount,6);
  for(const d of par(A1,'banane-gcv1-lidar-corpus-v1'))assert.equal(d.diagnostic,undefined);
  assert.equal(par(A1,'banane-gcv1-lidar-corpus-v1')[0].diagnosticRef.file.startsWith('ariane-gcv1-diagnostic-'),true);
  // Corpus seul (sans zip) : le diagnostic n'est que dans son premier segment, plus recopié dans chacun.
  const corpusSeuls=par(A0,'banane-gcv1-lidar-corpus-v1');assert.ok(corpusSeuls.length>=2);
  assert.equal(corpusSeuls[0].diagnostic.observationCount,6);for(const d of corpusSeuls.slice(1))assert.equal(d.diagnostic,undefined);
});

test('taille : l’export sans doublon est nettement plus petit que l’ancien (jeu synthétique)',async()=>{
  const avant=await exporter({zip:false,reglages:SEGMENT_PETIT}),apres=await exporter({zip:true,reglages:SEGMENT_PETIT});
  const somme=async r=>(await textes(r.blobs)).reduce((n,t)=>n+Buffer.byteLength(t),0);
  const a=await somme(avant);
  // Le zip contient ces JSON : on en relit la taille décompressée par l'index.
  const zipBlob=apres.blobs[0],buf=await octets(zipBlob);
  const fin=buf.length-22,nb=buf.readUInt16LE(fin+10),dep=buf.readUInt32LE(fin+16);let p=dep,json=0;
  for(let i=0;i<nb;i++){const nom=buf.toString('utf8',p+46,p+46+buf.readUInt16LE(p+28)),taille=buf.readUInt32LE(p+24);if(nom.endsWith('.json'))json+=taille;p+=46+buf.readUInt16LE(p+28)+buf.readUInt16LE(p+30)+buf.readUInt16LE(p+32);}
  console.log(`# taille synthétique : avant ${a} octets en ${avant.blobs.length} fichiers ; après ${json} octets JSON en 1 zip de ${buf.length} octets`);
  assert.ok(json<a*0.75,`JSON après (${json}) doit être sous 75 % d'avant (${a})`);
  assert.ok(buf.length<json,'le zip est plus petit que son contenu');
});

test('en-tête unique : seul le premier segment porte events/records/state ; la fusion rend la même session',async()=>{
  const r=await exporter({zip:false,reglages:SEGMENT_PETIT,bouton:'dataset'});
  const docs=(await textes(r.blobs)).map(t=>JSON.parse(t));
  assert.ok(docs.length>=3,'plusieurs segments : '+docs.length);
  assert.equal(docs[0].events.length,300);assert.ok(docs[0].state);assert.equal(docs[0].segment.headerIn,undefined);
  for(const d of docs.slice(1)){assert.equal(d.events.length,0);assert.equal(d.records.length,0);assert.equal(d.state,undefined);assert.equal(d.closureSummary,undefined);
    assert.equal(d.segment.headerIn,1);assert.equal(d.format,X.FORMAT);assert.ok(d.dictionaries);}
  const dir=tmp(),fichiers=docs.map((d,i)=>{const f=path.join(dir,`bilan-seg${String(i+1).padStart(2,'0')}.json`);fs.writeFileSync(f,JSON.stringify(d));return f;});
  const {merged}=mergeFiles(fichiers);
  assert.equal(merged.clouds.length,6);assert.equal(merged.events.length,300);assert.equal(merged.records.length,6);
  assert.equal(merged.state.batch.id,'lot-7');assert.equal(merged.closureSummary.visits,6,'état et clôture du premier segment gardés');
  assert.equal(merged.mergeTrace.missingCloudIds,0);
  assert.deepEqual(merged.clouds.map(c=>c.captureId).sort(),[...r.data.clouds.keys()].sort());
  for(const c of merged.clouds)assert.deepEqual(c.pointsSceneRelative,r.data.clouds.get(c.captureId).pointsSceneRelative);
});

test('lecteurs : acceptation et réducteur lisent le zip extrait ; le journal reste le même',{skip:!PYTHON&&'python3 absent'},async()=>{
  const r=await exporter({reglages:SEGMENT_PETIT});
  const f=path.join(tmp(),'lot.zip');fs.writeFileSync(f,await octets(r.blobs[0]));const dossier=tmp();lirePython(f,dossier);
  const lot=A.loadLot(dossier,'zip');
  assert.equal(lot.corpus.clouds.length,6);assert.equal(lot.diagnostic.observationCount,6);assert.ok(lot.journal);
  assert.equal(lot.corpusSegments.allRequestedObjectsPresent,true);
  assert.equal(lot.inputs.filter(i=>i.kind==='bilan').length>=1,true);
  // Réducteur : chaque fichier est classé par son en-tête.
  const genres={};for(const n of fs.readdirSync(dossier).filter(n=>n.endsWith('.json')))genres[n.replace(/-\d.*$/,'')]=R.classer(fs.readFileSync(path.join(dossier,n),'utf8').slice(0,600));
  assert.deepEqual(genres,{'ariane-journal-v4':'journal','ariane-gcv1-diagnostic':'diagnostic','ariane-gcv1-corpus':'corpus','ariane-bilan-v4':'bilan'});
});

test('si le corpus échoue, le bilan garde ses nuages (rien ne manque parce qu’un autre fichier a raté)',async()=>{
  const r=await exporter({reglages:SEGMENT_PETIT,lectureCapricieuse:(id,n)=>id==='cap-2'&&n===1});
  assert.match(r.statut,/Export incomplet.*corpus : Un LiDAR manque/);
  const buf=await octets(r.blobs[0]),texte=buf.toString('latin1');
  assert.ok(/ariane-bilan-v4-/.test(texte));
  const dossier=tmp(),f=path.join(dossier,'x.zip');fs.writeFileSync(f,buf);if(PYTHON){const sortie=tmp();lirePython(f,sortie);
    const bilans=fs.readdirSync(sortie).filter(n=>n.startsWith('ariane-bilan')).map(n=>JSON.parse(fs.readFileSync(path.join(sortie,n))));
    assert.equal(bilans.flatMap(nuagesDe).length,6,'le bilan porte les 6 nuages');assert.equal(bilans[0].cloudsInCorpus,undefined);}
});

test('archives multiples : au-delà du volume maximal, une archive suivante s’ouvre, chacune valide',{skip:!PYTHON&&'python3 absent'},async()=>{
  const r=await exporter({reglages:{...SEGMENT_PETIT,zipMaxBytes:12000}});
  assert.ok(r.blobs.length>=2,'plusieurs archives : '+r.blobs.length);assert.match(r.statut,/\d+ archive\(s\) zip/);
  const noms=new Set(),dossier=tmp();
  for(const [i,b] of r.blobs.entries()){const f=path.join(tmp(),`v${i}.zip`);fs.writeFileSync(f,await octets(b));for(const e of lirePython(f,dossier)){assert.ok(!noms.has(e.nom)||e.nom==='CONTENU.txt',e.nom);noms.add(e.nom);}}
  // Les volumes réunis se lisent comme l'export entier.
  const dossierJson=tmp();for(const n of fs.readdirSync(dossier).filter(n=>n.endsWith('.json')))fs.copyFileSync(path.join(dossier,n),path.join(dossierJson,n));
  assert.equal(A.loadLot(dossierJson,'volumes').corpus.clouds.length,6);
});

test('fichier par fichier : les boutons séparés existent toujours et exportent leur fichier',async()=>{
  for(const [bouton,format] of [['journal','banane-test-journal-v4'],['gcv1-diagnostic-export','banane-gcv1-diagnostic-v1'],['gcv1-corpus-export','banane-gcv1-lidar-corpus-v1'],['dataset',X.FORMAT]]){
    const r=await exporter({reglages:SEGMENT_PETIT,bouton});
    assert.ok(r.blobs.length>=1,bouton);const d=JSON.parse((await textes(r.blobs))[0]);assert.equal(d.format,format,bouton);
    assert.ok(!r.blobs.some(b=>b.type==='application/zip'),bouton+' : pas de zip');
  }
  const corpus=JSON.parse((await textes((await exporter({reglages:SEGMENT_PETIT,bouton:'gcv1-corpus-export'})).blobs))[0]);
  assert.equal(corpus.diagnostic.observationCount,6,'corpus seul : il garde son diagnostic (premier segment)');
  const seul=await exporter({reglages:SEGMENT_PETIT,bouton:'dataset'});assert.equal((await textes(seul.blobs)).map(t=>JSON.parse(t)).flatMap(nuagesDe).length,6,'bilan seul : il garde ses nuages');
});

test('ancien export (avant V2) : segments à en-tête complet et corpus à diagnostic recopié restent lisibles par tous les outils',()=>{
  const {clouds,events,records}=jeu(5),dir=tmp(),w=(f,o)=>fs.writeFileSync(path.join(dir,f),JSON.stringify(o));
  const ids=[...clouds.keys()],lots=[ids.slice(0,3),ids.slice(3)];
  const diagnostic={format:'banane-gcv1-diagnostic-v1',version:'4.9.0.1',observationCount:5,observations:ids.map(id=>({lidar:{captureId:id}}))};
  const stateBilan={batch:{id:'lot-ancien',state:'STOPPED'}};
  lots.forEach((l,i)=>{
    const interner=X.createInterner(),cl=l.map(id=>X.compactCloud(clouds.get(id),interner,{}));
    w(`bilan-seg0${i+1}.json`,{format:X.FORMAT,compactedFrom:'banane-test-dataset-v4',version:'4.9.0.1',state:stateBilan,events,records,closureSummary:{visits:5},
      segment:{index:i+1,stamp:'2026-10-06T10-00-00',objects:l.length,format:'banane-native-export-segment-v1',selfContained:true},clouds:cl,dictionaries:interner.dictionaries});
    w(`corpus-seg0${i+1}.json`,{format:'banane-gcv1-lidar-corpus-v1',version:'4.9.0.1',sessionId:'s1',diagnostic,captureReferences:ids.map(captureId=>({captureId,status:'available'})),
      exportTrace:{cloudObjects:ids.length,allRequestedObjectsPresent:i===1},segment:{index:i+1,stamp:'2026-10-06T10-00-05',objects:l.length,format:'banane-native-export-segment-v1'},clouds:l.map(id=>clouds.get(id))});
  });
  w('diag.json',diagnostic);w('journal.json',{format:'banane-test-journal-v4',version:'4.9.0.1',state:{batch:{id:'lot-ancien'}},events,records});
  const lot=A.loadLot(dir,'ancien');
  assert.equal(lot.corpus.clouds.length,5);assert.equal(lot.diagnostic.observationCount,5);assert.equal(lot.journal.events.length,300);
  const bilans=fs.readdirSync(dir).filter(f=>f.startsWith('bilan')).map(f=>path.join(dir,f)),{merged}=mergeFiles(bilans);
  assert.equal(merged.clouds.length,5);assert.equal(merged.events.length,300);assert.equal(merged.state.batch.id,'lot-ancien');assert.equal(merged.closureSummary.visits,5);
  for(const c of merged.clouds)assert.deepEqual(c,clouds.get(c.captureId),'nuage de l’ancien bilan relu sans perte : '+c.captureId);
  // Corpus sans diagnostic ni dossier de diagnostic (nouveau corpus d'un zip) : relu avec le diagnostic du dossier.
  for(const f of ['corpus-seg01.json','corpus-seg02.json']){const d=JSON.parse(fs.readFileSync(path.join(dir,f)));delete d.diagnostic;d.diagnosticRef={file:'diag.json'};fs.writeFileSync(path.join(dir,f),JSON.stringify(d));}
  const lot2=A.loadLot(dir,'nouveau-corpus');assert.equal(lot2.diagnostic.observationCount,5);assert.equal(lot2.corpus.clouds.length,5);
});

test('mode d’export : « complet » par défaut et conservé tel quel ; un nom inconnu est refusé',()=>{
  assert.equal(X.MODE_DEFAUT,'complet');assert.equal(Settings.export.mode,'complet');
  const c=nuage(1);assert.equal(X.exportMode().nuage(c),c,'complet : le nuage n’est ni copié ni modifié');assert.equal(X.exportMode('complet').nom,'complet');
  assert.throws(()=>X.exportMode('leger'),/Mode d’export inconnu : leger/);assert.throws(()=>X.exportMode('arrondi'),/inconnu/);
  assert.deepEqual(Object.keys(X.MODES),['complet'],'aucun autre mode dans cette version');
});

test('mode inconnu dans un réglage : l’export échoue au lieu de passer en silence en « complet »',async()=>{
  const r=await exporter({reglages:{mode:'leger'},bouton:'dataset'});
  assert.equal(r.blobs.length,0);assert.match(r.p.$('notice').textContent,/Mode d’export inconnu : leger/);
});
