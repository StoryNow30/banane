'use strict';
/* 5.0 — VERTS À CONTRÔLER DANS LE PANNEAU ET DANS L'EXPORT. Panneau réel (panel.js) dans un contexte `vm`, DOM et API Chrome simulés
 * (tools/audit-qualite-480.cjs). En fin de lot, le panneau demande la liste au service worker (`verts-a-controler`), une fois par
 * lot, et l'affiche : nombre de cuts, temps estimé, plages dans l'ordre des cuts. « Recalculer » la redemande. Réglage coupé : rien
 * n'est demandé ni affiché. « Tout télécharger » joint la liste en petit fichier JSON, avec une ligne dans CONTENU.txt. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {panneau}=require('../tools/audit-qualite-480.cjs');
const Settings=require('../src/settings.js'),Z=require('../src/zip-writer.js'),X=require('../src/native-export.js'),EC=require('../src/export-cache.js'),GCV1=require('../src/gcv1-export.js');
const PYTHON=spawnSync('python3',['-I','-c','import zipfile'],{encoding:'utf8'}).status===0;

const LISTE={actif:true,format:'ariane-verts-a-controler-1',version:'verts-a-controler-v1',partie:23,candidats:60,aControler:38,tempsEstimeS:141,tempsParVertS:3.7,seuil:1,
 source:'instantane',cutsDuLot:30,differes:6,
 plages:[{debut:401,fin:414,nombre:6,libelle:'PN 405–409',motif:'pn'},{debut:509,fin:515,nombre:4,libelle:'autour du différé 512',motif:'differe',cutsTexte:'509–511, 515'},
  {debut:1712,fin:1712,nombre:1,libelle:'écartement, cut 1712',motif:'ecartement'},{debut:2000,fin:2001,nombre:2,libelle:'<img src=x onerror=alert(1)>',motif:'voisin'}],
 verts:[]};
const lot=(etat='COMPLETED',id='lot-1')=>({current:{identity:{part:23,cut:120}},batch:{id,state:etat,scope:{part:23,start:100,end:120},processed:[{cut:100}],deferred:[],skipped:[],
 manuallyCompleted:[],paused:[],interrupted:[],sequence:[{identity:{part:23,cut:100}}],activeIdentity:{part:23,cut:120}}});

test('fin de lot : la liste est demandée une fois, puis affichée (nombre, temps, plages dans l\'ordre, texte échappé)',async()=>{
 const p=await panneau(lot(),{globals:{BananeSettings:Settings},reponses:{'verts-a-controler':LISTE}});
 const appels=()=>p.appels.filter(a=>a.action==='verts-a-controler');
 assert.equal(appels().length,1);assert.equal(JSON.stringify(appels()[0].args),'{"partie":23}');
 assert.equal(p.$('verts-controle').hidden,false);
 assert.equal(p.$('verts-ligne').textContent,'38 cuts à contrôler · environ 2 min 21 s');
 const h=p.$('verts-plages').innerHTML;
 assert.match(h,/PN 405–409<\/b> <span>401–414 · 6 cuts<\/span>/);assert.match(h,/autour du différé 512<\/b> <span>509–511, 515 · 4 cuts<\/span>/);
 assert.match(h,/écartement, cut 1712<\/b> <span>1712 · 1 cut<\/span>/);
 assert.ok(h.indexOf('PN 405')<h.indexOf('différé 512')&&h.indexOf('différé 512')<h.indexOf('1712'),'ordre des cuts');
 assert.doesNotMatch(h,/<img/);assert.match(h,/&lt;img/);
 assert.match(p.$('verts-note').textContent,/aucune action dans ESV/i);
 /* Rafraîchissements : pas de nouvelle demande pour le même lot. « Recalculer » redemande. */
 p.intervals[0]?.();await p.attendre();assert.equal(appels().length,1);
 await p.$('verts-maj').onclick();await p.attendre();assert.equal(appels().length,2);
});

test('lot en cours : rien n\'est demandé ; réglage coupé : rien n\'est demandé ni affiché ; aucune liste : message court',async()=>{
 let p=await panneau(lot('RUNNING'),{globals:{BananeSettings:Settings},reponses:{'verts-a-controler':LISTE}});
 assert.equal(p.appels.filter(a=>a.action==='verts-a-controler').length,0);assert.equal(p.$('verts-controle').hidden,true);
 p=await panneau(lot(),{globals:{BananeSettings:{...Settings,vertsAControler:{actif:false}}},reponses:{'verts-a-controler':LISTE}});
 assert.equal(p.appels.filter(a=>a.action==='verts-a-controler').length,0);assert.equal(p.$('verts-controle').hidden,true);
 p=await panneau(lot(),{globals:{BananeSettings:Settings},reponses:{'verts-a-controler':{...LISTE,aControler:0,tempsEstimeS:0,plages:[]}}});
 assert.equal(p.$('verts-ligne').textContent,'Aucun vert à contrôler autour de ce lot.');
 p=await panneau(lot(),{globals:{BananeSettings:Settings},reponses:{'verts-a-controler':{actif:false}}});assert.equal(p.$('verts-controle').hidden,true);
});

test('réglage décrit dans la liste des réglages ; livré actif',()=>{
 assert.equal(Settings.vertsAControler.actif,true);
 const l=Settings.describe().find(x=>/Verts à contrôler/.test(x.nom));assert.ok(l);assert.match(l.valeur,/actif/);assert.match(l.pourquoi,/ESV/);
});

test('panneau : section sobre, identifiants attendus, chargée sans module de calcul',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../panel.html'),'utf8');
 for(const id of ['verts-controle','verts-ligne','verts-plages','verts-note','verts-maj'])assert.match(html,new RegExp(`id="${id}"`),id);
 assert.doesNotMatch(html,/verts-a-controler\.js/,'le calcul vit dans le service worker');
});

test('export : un petit fichier JSON de la liste dans les volumes, et sa ligne dans CONTENU.txt',{skip:!PYTHON&&'python3 absent'},async()=>{
 const store={all:async()=>[],keys:async()=>[],getCloud:async()=>null};
 const diagnostic={format:'banane-gcv1-diagnostic-v1',version:'5.0',sessionId:'s1',observationCount:0,observations:[]};
 const meta={format:'banane-test-dataset-v4',version:'5.0',exportedAt:'2026-10-17T07:58:00.000Z',state:{batch:{id:'lot-1',state:'COMPLETED'},sessionId:'s1'},stateOmits:['records','incomplete'],closureSummary:{visits:0},cloudIds:[]};
 const globals={BananeStorage3:class{constructor(){return store;}},BananeExportCache:EC,BananeNativeExport:X,BananeZip:Z,
  BananeSettings:{...Settings,export:{...Settings.export,mode:'complet',viderApresExport:false}},BananeGCV1Export:{buildDiagnostic:()=>structuredClone(diagnostic),buildCorpusPlan:GCV1.buildCorpusPlan}};
 let id=0;const noms=new Map();
 const chromeExtra={downloads:{download:async o=>{id++;noms.set(id,o.filename);return id;},search:async()=>[{state:'complete'}],onChanged:{addListener(){},removeListener(){}}}};
 const p=await panneau(lot(),{globals,chromeExtra,reponses:{'verts-a-controler':LISTE,'dataset-meta':meta,'journal-meta':{...meta,format:'banane-test-journal-v4'},
  'gcv1-export-meta':{version:'5.0',sessionId:'s1'},'fiches-depart':{fiches:[]},'export-cache-info':()=>({refus:null,marqueur:null})}});
 await p.$('export-tout').onclick();await p.attendre();
 const dossier=fs.mkdtempSync(path.join(os.tmpdir(),'ariane-verts-')),trouves=[];let contenu='';
 for(const [i,b] of p.downloads.entries()){const f=path.join(dossier,`v${i}.zip`),d=path.join(dossier,'x'+i);fs.writeFileSync(f,Buffer.from(await b.arrayBuffer()));fs.mkdirSync(d);
  const r=spawnSync('python3',['-I','-c','import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',f,d],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  for(const n of fs.readdirSync(d)){if(/^ariane-verts-a-controler-partie23-.*\.json$/.test(n))trouves.push(JSON.parse(fs.readFileSync(path.join(d,n),'utf8')));if(n==='CONTENU.txt')contenu+=fs.readFileSync(path.join(d,n),'utf8');}}
 assert.equal(trouves.length,1,'un fichier de la liste');assert.equal(trouves[0].format,'ariane-verts-a-controler-1');assert.equal(trouves[0].aControler,38);
 assert.ok(JSON.stringify(trouves[0]).length<20000,'petit fichier');
 assert.match(contenu,/Verts à contrôler, partie 23 : 38 cuts en 4 plages, environ 2 min 21 s/);
});

test('export sans zip (repli de « Tout télécharger ») : la liste des verts est jointe aussi, en fichier JSON',async()=>{
 const store={all:async()=>[],keys:async()=>[],getCloud:async()=>null};
 const diagnostic={format:'banane-gcv1-diagnostic-v1',version:'5.0',sessionId:'s1',observationCount:0,observations:[]};
 const meta={format:'banane-test-dataset-v4',version:'5.0',exportedAt:'2026-10-17T07:58:00.000Z',state:{batch:{id:'lot-1',state:'COMPLETED'},sessionId:'s1'},stateOmits:['records','incomplete'],closureSummary:{visits:0},cloudIds:[]};
 const base={BananeStorage3:class{constructor(){return store;}},BananeExportCache:EC,BananeNativeExport:X,BananeZip:undefined,
  BananeSettings:{...Settings,export:{...Settings.export,mode:'complet',viderApresExport:false}},BananeGCV1Export:{buildDiagnostic:()=>structuredClone(diagnostic),buildCorpusPlan:GCV1.buildCorpusPlan}};
 const reponses={'verts-a-controler':LISTE,'dataset-meta':meta,'journal-meta':{...meta,format:'banane-test-journal-v4'},'gcv1-export-meta':{version:'5.0',sessionId:'s1'},
  'fiches-depart':{fiches:[]},'export-cache-info':()=>({refus:null,marqueur:null})};
 const lance=async globals=>{let id=0;const noms=[];
  const chromeExtra={downloads:{download:async o=>{id++;noms.push(o.filename);return id;},search:async()=>[{state:'complete'}],onChanged:{addListener(){},removeListener(){}}}};
  const p=await panneau(lot(),{globals,chromeExtra,reponses});await p.$('export-tout').onclick();await p.attendre();return {p,noms};};
 const vs=n=>n.filter(x=>/^ariane-verts-a-controler-partie23-.*\.json$/.test(x));
 /* Sans BananeZip ni Blob-zip : le repli joint le fichier des verts. */
 const r=await lance({...base});
 assert.equal(vs(r.noms).length,1,'un fichier de la liste : '+r.noms.join(' | '));
 assert.ok(r.noms.some(x=>/^ariane-journal-v4-/.test(x))&&!r.noms.some(x=>/\.zip$/.test(x)),'le repli sans zip a bien servi : '+r.noms.join(' | '));
 assert.equal(r.p.appels.filter(a=>a.action==='verts-a-controler').length>=1,true);
 /* Réglage coupé : pas de fichier, pas de demande. */
 const c=await lance({...base,BananeSettings:{...base.BananeSettings,vertsAControler:{actif:false}}});
 assert.equal(vs(c.noms).length,0);assert.equal(c.p.appels.filter(a=>a.action==='verts-a-controler').length,0);
});
