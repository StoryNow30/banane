'use strict';
/* CH-069 : parité des modules d'export (native-export, phase-pli, gcv1-export, export-cache, crc32 de zip-writer) contre la
 * façade WASM (ariane-export, fonctions 200 à 249). Trois sources de cas, dans cet ordre :
 *  1. le relevé des appels faits par TOUS les essais du tronc qui chargent ces modules (tools/ch069-releve.cjs) ;
 *  2. les données réelles de banane-data (tools/ch064-corpus.cjs : journaux, bilans, segments Écho) ;
 *  3. des variantes à graine fixe (formes rares : trous, −0, NaN, undefined, clés d'indice, UUID, marques réservées…).
 * Un cas porte ses arguments en octets VBA enveloppés (Map, Set, Uint8Array compris) : chaque côté les relit à neuf.
 * La sortie comparée passe par `comparable` (Map et Set en listes marquées). `buildDiagnostic` reçoit un `exportedAt` fixe
 * quand le cas n'en a pas (sinon l'heure courante diffère d'un appel à l'autre). */
const fs=require('node:fs'),v8=require('node:v8');
const C=require('./ch069-commun.cjs'),F=require('../ariane-rs/coquille/facade-export.js');
const FIXE='2026-11-06T12:00:00.000Z';
let M=null,facade=null;
const mods=()=>M||(M=C.modules());
const fac=coeur=>facade&&facade.coeur===coeur?facade.f:(facade={coeur,f:F.creer(coeur,mods())}).f;
/* Une fonction : « Module.nom » ; `signatures` (lot) n'existe que dans la façade : son équivalent JS est map(signature). */
function jouerSource(){return `function jouer(cible,f,a){
 const [m,n]=f.split('.');
 if(n==='buildDiagnostic'&&(a[0]===undefined||(a[0]&&typeof a[0]==='object'&&a[0].exportedAt===undefined)))a[0]={...(a[0]||{}),exportedAt:'${FIXE}'};
 if(m==='ExportCache'&&n==='signatures'&&!cible.exportCache.signatures)return a[0].map(o=>cible.exportCache.signature(o));
 const t={NativeExport:cible.nativeExport,PhasePli:cible.phasePli,GCV1Export:cible.gcv1Export,ExportCache:cible.exportCache,Zip:cible.zip}[m];
 return t[n](...a);}`;}
const jouer=(0,eval)('('+jouerSource()+')');
const enJs=()=>{const m=mods();return {nativeExport:m.NativeExport,phasePli:m.PhasePli,gcv1Export:m.GCV1Export,exportCache:m.ExportCache,zip:m.Zip};};
const cas=(id,f,args)=>({id,entree:{f,octets:C.versOctets(args)}});

/* ------------------------------------------------------------------------------------------- 1. relevé du tronc */
function*releve(){
 const {FICHIER,releve:relever}=require('./ch069-releve.cjs');
 if(!fs.existsSync(FICHIER))relever({silencieux:true});
 let i=0;for(const c of v8.deserialize(fs.readFileSync(FICHIER)))yield cas('releve-'+(i++)+'-'+c.f,c.m+'.'+c.f,v8.deserialize(c.a));
}

/* ------------------------------------------------------------------------------------------- 2. données réelles */
function*reels(max){
 const {documents}=require('./ch064-corpus.cjs');const N=mods().NativeExport,P=mods().PhasePli;
 let d=0,nCrc=0;const precedents=new Map(),jalons=new Map(),series=new Map();
 for(const doc of documents()){if(d>=max)return;d++;const id='reel-'+d;
  if(nCrc<40&&doc.octets<40e6){nCrc++;const o=new Uint8Array(Buffer.from(doc.texte));yield cas(id+'-crc',"Zip.crc32",[o]);
   const m=o.length>>1;yield cas(id+'-crc-suite','Zip.crc32',[o.subarray(m),mods().Zip.crc32(o.subarray(0,m))]);}
  let j;try{j=JSON.parse(doc.texte);}catch{continue;}
  const serie=doc.zip.replace(/-volume\d+-sur\d+\.zip$/,'');
  if(j.format===N.FORMAT){
   yield cas(id+'-misfiled','NativeExport.misfiledHead',[j]);
   const s=j.segment,cle=s&&s.stamp,prec=cle&&precedents.get(cle);
   const opt=prec&&prec.index===(s.index||0)-1?{previousDictionaries:prec.dictionaries}:undefined;
   yield cas(id+'-expand','NativeExport.expand',[j,opt]);
   if(cle)precedents.set(cle,{index:s.index||0,dictionaries:j.dictionaries});
   const clouds=j.clouds||[];
   if(clouds.length){yield cas(id+'-unfold','NativeExport.unfoldRefs',[clouds[0],j.dictionaries]);
    for(let k=0;k<clouds.length;k+=50)yield cas(id+'-expandCloud-'+k,'NativeExport.expandCloud',[clouds[k],j.dictionaries]);}
   let x=null;try{x=N.expand(j,opt);}catch{}
   if(x){const {clouds:cx,...meta}=x;
    yield cas(id+'-entete','NativeExport.enteteMince',[meta]);
    for(let k=0;k<(cx||[]).length;k+=20)yield cas(id+'-alleger-'+k,'NativeExport.alleger',[cx[k]]);
    yield cas(id+'-compact','NativeExport.compact',[{...meta,clouds:(cx||[]).filter((_,k)=>k%10===0)}]);
    yield cas(id+'-compact-complet','NativeExport.compact',[{...meta,clouds:(cx||[]).slice(0,30)},{dropPointSources:false}]);}
   if(Array.isArray(j.events)&&j.session){const sid=j.session.id,jal=jalons.get(sid)||null;
    yield cas(id+'-delta','NativeExport.deltaMetadonnees',[{session:j.session,events:j.events,records:j.records},jal]);
    try{const r=N.deltaMetadonnees({session:j.session,events:j.events,records:j.records},jal);jalons.set(sid,N.confirmerJalon(r,true));}catch{}}
  }
  if(Array.isArray(j.events)&&j.events.length){
   const ev=j.events;
   if(Array.isArray(j.records)&&j.records.length)yield cas(id+'-sig-records','ExportCache.signatures',[j.records]);
   yield cas(id+'-sig-events','ExportCache.signatures',[ev.slice(0,20000)]);
   if(j.format==='banane-test-journal-v4'||P.estPlie(ev)){
    yield cas(id+'-estPlie','PhasePli.estPlie',[ev]);
    yield cas(id+'-deplier','PhasePli.deplier',[ev]);
    let dep=null;try{dep=P.deplier(ev);}catch{}
    if(dep)yield cas(id+'-plier','PhasePli.plier',[dep]);
   }
   if(j.format==='banane-test-journal-v4'){
    yield cas(id+'-gcv1','GCV1Export.buildDiagnostic',[{version:j.version,sessionId:j.state&&j.state.sessionId,state:j.state,events:ev,exportedAt:FIXE}]);
    const st=j.state||{};
    yield cas(id+'-refus','ExportCache.refus',[{state:st,busy:false,task:null}]);
    yield cas(id+'-refus-auto','ExportCache.refus',[{state:st},{auto:true}]);
    yield cas(id+'-reprenable','ExportCache.reprenable',[{state:st}]);
    yield cas(id+'-fini','ExportCache.finiPourDeBon',[st.batch]);
    const avant=ev.find(e=>e&&e.type==='before-captured'&&e.lidarId),prop=ev.find(e=>e&&e.type==='proposed'&&e.proposalId);
    if(avant)for(const col of ['STALE','READY_FOR_AFTER','IDLE'])yield cas(id+'-garder-'+col,'ExportCache.capturesAGarder',[{collection:col,lidarId:avant.lidarId,proposal:prop?{id:prop.proposalId}:null},ev,j.records]);
    let liste=Array.isArray(j.fichesDepart)?j.fichesDepart:[];let k=0;
    for(const e of ev)if(e&&e.kind==='list-summary'){const ctx={batchId:e.batchId,partie:k%30,version:'5.0.'+k};
     yield cas(id+'-fiche-'+k,'ExportCache.ficheDepart',[e,ctx]);const f=mods().ExportCache.ficheDepart(e,ctx);
     yield cas(id+'-ajout-'+k,'ExportCache.ajouterDepart',[liste,f]);liste=mods().ExportCache.ajouterDepart(liste,f);k++;}
   }
   /* Bilan et journal d'un même export (même série de volumes) : le bilan est le journal plus des insertions. */
   const sr=series.get(serie)||{};series.set(serie,sr);
   if(j.format==='banane-test-journal-v4')sr.journal=ev;else if(/bilan/.test(doc.entree)&&ev.length>1000)sr.bilan=ev;
   if(sr.journal&&sr.bilan){
    yield cas(id+'-parref','NativeExport.evenementsParReference',[sr.bilan,sr.journal]);
    let r=null;try{r=N.evenementsParReference(sr.bilan,sr.journal);}catch{}
    if(r){yield cas(id+'-rehydrater','NativeExport.rehydraterEvenements',[r,sr.journal]);
     yield cas(id+'-rehydrater-autre','NativeExport.rehydraterEvenements',[r,sr.journal.slice(1)]);}
    series.delete(serie);}
  }
 }
}

/* ------------------------------------------------------------------------------------------- 3. variantes à graine fixe */
function alea(graine){let a=graine>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function*variantes(n=150){
 const r=alea(69);const choix=a=>a[Math.floor(r()*a.length)];const ent=k=>Math.floor(r()*k);
 const hex=k=>Array.from({length:k},()=>'0123456789abcdefABCDEF'[ent(r()<0.9?16:22)]).join('');
 const uuid=()=>`${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;
 const TEXTES=['','a','é','💥','x"y\\z','ligne\nsuite','\u0001\u001f','§0','=','12','007','constructor','toString','__proto__x','Z-a:b.c','  ','𝔘𝔫𝔦'];
 const nombre=()=>choix([0,-0,1,-1,0.1,1e21,1e-7,123.456,NaN,Infinity,-Infinity,2**53,5e-324,ent(1000),ent(100)/10,Math.round(r()*1e6)/1e3]);
 const prim=()=>choix([undefined,null,true,false,nombre(),choix(TEXTES),uuid()]);
 function valeur(p=0){const t=ent(p>3?2:7);
  if(t<2)return prim();
  if(t===2){const a=[];const l=ent(5);for(let i=0;i<l;i++)if(r()>0.15)a[i]=valeur(p+1);a.length=l;return a;}
  if(t===3)return Array.from({length:ent(4)+1},()=>nombre());
  if(t===4)return Array.from({length:ent(3)+1},()=>[nombre(),nombre(),nombre()]);
  const o={};const l=ent(5);for(let i=0;i<l;i++)o[choix(['a','b','10','2','eventId','id','recordId','type','x',choix(TEXTES)])]=valeur(p+1);return o;}
 const N=mods().NativeExport;
 for(let i=0;i<n;i++){const id='variante-'+i;
  /* export-cache */
  yield cas(id+'-sig','ExportCache.signature',[valeur()]);
  yield cas(id+'-sigs','ExportCache.signatures',[Array.from({length:ent(6)},()=>valeur())]);
  const lot=choix([undefined,null,{state:choix(['RUNNING','STOPPED','COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS',undefined,1,'']),stoppedAtEnd:choix([true,false,1,undefined])}]);
  const st=choix([null,undefined,'x',{batch:lot,collection:choix([undefined,null,'IDLE','AFTER_CAPTURED','STALE','BEFORE_CAPTURED','READY_FOR_AFTER','AUTRE',3,true]),
   intent:choix([null,{a:1}]),reconcileRequired:choix([false,true]),deferIntent:choix([null,{phase:'FINALIZED'},{phase:'X'},'y']),lidarId:choix([null,'L1','L2',0]),proposal:choix([null,{id:'P1'},{id:''},'P'])}]);
  const pend=choix([undefined,null,new Set(),new Set([1]),new Map([[1,2]]),{size:2},{size:'2'},{size:true}]);
  const c={state:st,busy:choix([false,true,undefined]),task:choix([null,'t']),nativeActive:r()<0.1,manualActive:r()<0.1,
   timing:choix([undefined,null,{batch:{closed:choix([true,false])},pending:pend},{pending:pend}]),graceObservations:choix([undefined,'en-cours','depuis-instantane','x'])};
  yield cas(id+'-refus','ExportCache.refus',[c,choix([undefined,{auto:true},{auto:false},null])]);
  yield cas(id+'-reprenable','ExportCache.reprenable',[c]);
  yield cas(id+'-fini','ExportCache.finiPourDeBon',[lot]);
  const evs=Array.from({length:ent(8)},()=>choix([null,{eventId:'e'+ent(5),lidarId:choix(['L1','L2',undefined]),visitId:choix(['V1','V2',undefined,'',0]),proposalId:choix(['P1',undefined])},
   {eventId:choix([undefined,'f'+ent(3)]),paused:choix([{lidarCaptureId:'L1'},{proposal:{id:'P1'}},null]),visitId:'V1'},{captureId:'L1',eventId:1},'chaine',3]));
  const rec=Array.from({length:ent(4)},()=>choix([null,{recordId:'r'+ent(3),lidarCaptureId:choix(['L1','L3'])},{id:'i'+ent(3),proposal:{id:'P1'}},{recordId:0,id:'z',lidarId:'L1'}]));
  yield cas(id+'-garder','ExportCache.capturesAGarder',[st,choix([evs,undefined,'x']),choix([rec,null])]);
  const obs=choix([null,{kind:'list-summary',counts:choix([{valid:ent(9),invalid:ent(3),skipped:choix([0,-0,1.5,undefined])},{valid:-1,invalid:0},[1],null]),rows:choix([0,-0,1,2,9,1e8,2.5]),
   listKey:choix(['k','undefined','',undefined,3]),timestamp:choix(['2026-11-06T10:00:00.000Z',undefined,5]),batchId:choix(['B',undefined])},{kind:'autre'}]);
  const ctx=choix([undefined,null,{batchId:choix(['C',2]),partie:choix([1,-0,1.5,1e8]),version:choix(['5','x'.repeat(30),'1234567890123456789💥',3])}]);
  yield cas(id+'-fiche','ExportCache.ficheDepart',[obs,ctx]);
  const fiche=()=>choix([null,{batchId:'B'+ent(3),valides:ent(3),invalides:ent(2),total:ent(3)}]);
  yield cas(id+'-ajout','ExportCache.ajouterDepart',[choix([undefined,'x',Array.from({length:ent(205)},()=>choix([fiche(),fiche(),3,[1]]))]),fiche()]);
  /* crc32 */
  const oct=Uint8Array.from({length:ent(300)},()=>ent(256));
  yield cas(id+'-crc','Zip.crc32',[oct,choix([undefined,0,ent(2**32),-1,1.5])]);
  yield cas(id+'-crc-tableau','Zip.crc32',[Array.from({length:ent(20)},()=>choix([ent(256),-3,300.7,NaN])),choix([undefined,7])]);
  /* native-export */
  const mat=()=>Array.from({length:16},(_,k)=>k%5===0?1:choix([0,0,0.5,-2,1e-3]));
  const rail=()=>({railLocalToSceneRelative:mat(),profileLocalToSceneRelative:mat(),sceneRelativeToProfileLocal:choix([mat(),mat(),[1,2],null])});
  const rails=[rail(),rail()],vue={viewEpochId:ent(3),camera:{p:[ent(3),1,2]}},coords={name:'scene-relative',matrixLayout:'col'},ident={pageId:'p',part:ent(3),cut:ent(4),frameId:'f'};
  const chunk=()=>({format:choix(['banane-native-lidar-chunk-v1','banane-native-lidar-chunk-v1','autre']),rail:choix(rails),identity:{...ident},view:choix([vue,{...vue,viewEpochId:9}]),coordinateSystem:coords,
   pointsSceneRelative:Array.from({length:ent(5)},()=>[nombre(),ent(5),ent(5)]),pointsProfileLocal:[[1,2,3]],pointSources:choix([[1],null]),droppedDerivedFields:choix([undefined,['x']]),
   nodes:Array.from({length:ent(4)},()=>choix([{retained:choix([0,-0,1]),probes:choix([[{roiHit:choix([false,true,{a:true},[false,true]])},null,{hierarchyRoiHit:{x:false}}],[],'p'])},{retained:0},null,5]))});
  const doc={format:'banane-native-session-v2',version:'5',2:'deux',rails:[rails[0],rails[0]],identity:ident,segment:choix([undefined,{index:ent(4),stamp:'s',selfContained:choix([true,undefined])}]),
   exportTrace:choix([undefined,{cloudObjects:ent(9),segmentObjects:ent(9)},{cloudObjects:'x'}]),clouds:Array.from({length:ent(5)},chunk)};
  const opt=choix([undefined,null,{dropProfileLocal:false},{dropPointSources:false},{dropProfileLocal:false,dropPointSources:false},3]);
  yield cas(id+'-compact','NativeExport.compact',[doc,opt]);
  let cp=null;try{cp=N.compact(doc,opt);}catch{}
  if(cp){yield cas(id+'-expand','NativeExport.expand',[cp,choix([undefined,{previousDictionaries:cp.dictionaries},{previousDictionaries:{}}])]);
   const casse={...cp,segment:{index:2,stamp:'s'},exportTrace:choix([undefined,{cloudObjects:5,segmentObjects:2}])};
   yield cas(id+'-misfiled','NativeExport.misfiledHead',[casse]);
   yield cas(id+'-expand-ki060','NativeExport.expand',[casse,choix([undefined,{previousDictionaries:cp.dictionaries}])]);
   if(cp.clouds.length)yield cas(id+'-expandCloud','NativeExport.expandCloud',[cp.clouds[0],choix([cp.dictionaries,{rails:[]},undefined])]);
   yield cas(id+'-unfold','NativeExport.unfoldRefs',[{a:{__ref:choix(['rails:0','rails:9','views:','rails','x:1','identities:00',5])},b:[1,[2]]},cp.dictionaries]);}
  yield cas(id+'-alleger','NativeExport.alleger',[choix(doc.clouds.length?doc.clouds:[null])]);
  yield cas(id+'-entete','NativeExport.enteteMince',[{a:1,events:choix([[1],{}]),state:{},records:[],diagnostic:valeur(),10:3}]);
  const lev=Array.from({length:ent(10)},(_,k)=>choix([{eventId:'e'+k,v:valeur()},{eventSeq:choix([k,null,'s']),v:k},{v:k},null,0,'',{eventId:'e1'}]));
  const sess=choix([{id:'S'},{id:undefined},null,{id:0}]);
  yield cas(id+'-delta','NativeExport.deltaMetadonnees',[{session:sess,events:lev,records:choix([undefined,[{recordId:'r'},{id:'i'},{x:1},null]])},null]);
  let jal=null;try{jal=N.deltaMetadonnees({session:sess,events:lev},null).jalon;}catch{}
  if(jal)yield cas(id+'-delta-jalon','NativeExport.deltaMetadonnees',[{session:sess,events:lev.map(e=>r()<0.3&&e&&typeof e==='object'?{...e,w:1}:e)},jal]);
  const ref=Array.from({length:ent(30)},(_,k)=>({k,v:choix(['a','b'])}));const ins=ref.slice();
  for(let k=0;k<ent(4);k++)ins.splice(ent(ins.length+1),0,{insere:k});
  if(r()<0.2&&ins.length)ins.splice(ent(ins.length),1);
  yield cas(id+'-parref','NativeExport.evenementsParReference',[ins,ref,choix([undefined,{partMaxAjouts:0.5},{partMaxAjouts:NaN},null])]);
  let pr=null;try{pr=N.evenementsParReference(ins,ref);}catch{}
  if(pr)yield cas(id+'-rehydrater','NativeExport.rehydraterEvenements',[choix([pr,{...pr,total:pr.total+2},{...pr,signature:'x'}]),choix([ref,ref,ref.slice(1)])]);
  /* phase-pli */
  const groupes=Array.from({length:ent(3)+1},()=>({visitId:choix(['v1','v2','']),timeOrigin:choix([1762430400000.5,1762430400000,-0,0])}));
  const jalonsPli=Array.from({length:ent(14)},()=>{const g=choix(groupes);const seq=ent(40);
   const e={eventId:uuid(),timestamp:'t',type:choix(['phase-timing','phase-timing','phase-timing','autre']),schema:choix([1,1,1,2]),clockId:'c',timeOrigin:g.timeOrigin,sessionId:'s',batchId:'b',visitId:g.visitId,
    seq:choix([seq,seq,1.5]),batchSeq:seq,ms:choix([seq*7.25,seq*7.25,NaN]),kind:choix(['point','span','visit','request','health','10','toString']),
    identity:choix([null,{part:1},{part:2}]),captureId:choix([null,uuid(),'c1']),analysisId:null,proposalId:choix([null,'P']),selector:choix([undefined,null,'s'])};
   if(r()<0.5)e.point=choix(['ouvert','fin','10',choix(TEXTES)]);if(r()<0.4){e.label=choix(['l1','l2']);e.fromMs=ent(9);e.toMs=choix([ent(20),NaN]);}
   if(r()<0.3)e.extra=choix([valeur(),e.ms,'§1','=',uuid()]);if(r()<0.1)delete e.selector;return e;});
  yield cas(id+'-plier','PhasePli.plier',[choix([jalonsPli,jalonsPli,undefined,{}])]);
  let pl=null;try{pl=mods().PhasePli.plier(jalonsPli).events;}catch{}
  if(pl){yield cas(id+'-deplier','PhasePli.deplier',[pl]);
   const abime=JSON.parse(JSON.stringify(pl));for(const e of abime)if(e&&e.type==='phase-timing-pli'&&r()<0.5){if(e.rows&&e.rows[0])e.rows[0][3]=choix([99,'0',-1,null]);if(r()<0.3)e.timeOrigin=9e15;}
   yield cas(id+'-deplier-abime','PhasePli.deplier',[abime]);
   yield cas(id+'-estPlie','PhasePli.estPlie',[pl]);}
  yield cas(id+'-eligible','PhasePli.eligible',[choix(jalonsPli.length?jalonsPli:[null])]);
  /* gcv1-export */
  const P=['P1','P2',null],B=['B1','B2'],O=['o1','o2','o-3'],TS=['2026-11-06T10:00:00.000Z','2026-11-06T10:00:00.100Z','2026-11-06t10:00:00Z',undefined,'',3];
  const idn=()=>choix([{...ident},{...ident,cut:9},{pageId:'p',part:1},null]);
  const TYPES=['gcv1-shadow-observed','proposed','before-captured','batch-started','applied-verified','validation-intent','validation-observation','validation-accepted',
   'batch-paused-unresolved-rail','batch-error','defer-intent','defer-finalized','defer-navigation-observation','defer-navigation-accepted','defer-intent-closed','defer-navigation-uncertain','autre'];
  const gev=Array.from({length:ent(25)},()=>{const t=choix(TYPES),e={type:t,eventId:choix([uuid(),uuid(),undefined]),timestamp:choix(TS)};
   if(r()<0.7)e.proposalId=choix(P);if(r()<0.5)e.batchId=choix(B);if(r()<0.3)e.batch={id:choix(B)};if(r()<0.2)e.paused={status:choix(['S',undefined]),proposal:{id:choix(P)},batchId:choix(B),lidarCaptureId:'Lp'};
   e.identity=idn();if(t==='before-captured')e.lidarId=choix(['L1','L2',null]);if(r()<0.3)e.lidarCaptureId=choix(['Lc',null]);
   if(t.startsWith('defer'))e.operationId=choix([...O,undefined,'']);if(t==='proposed')e.proposal={id:e.proposalId,identity:idn(),rails:{left:{status:'ok',source:choix(['geometry-candidate-v1-s1','geometry-candidate-v1-astar','x']),delta:[1,2],gcv1:{confidenceStatus:'c'}}}};
   if(t==='gcv1-shadow-observed')e.shadow=choix([undefined,{observedAt:choix(TS),format:'f',rails:choix([{left:{next:{status:choix(['candidate','unresolved']),motif:'m'},astar:{confidence:0.5},error:choix([null,'e'])},right:{next:null}},['a',{next:{status:'x'}}],'z'])}]);
   if(r()<0.3)e.evidence=choix([{afterObserved:true,nextIdentity:{a:1},shortcutEquivalence:{s:1}},null,'e']);
   if(r()<0.2){e.rails=[1];e.policy=choix(['p',undefined]);e.eligibility='el';e.navigationObserved=choix([false,undefined]);}
   return e;});
  const gst=choix([null,undefined,{sessionId:'S',deferIntent:{operationId:choix(O)}},{deferIntent:{operationId:5}}]);
  yield cas(id+'-gcv1','GCV1Export.buildDiagnostic',[choix([{events:gev,state:gst,version:'5'},{events:gev,sessionId:'X',exportedAt:'E'},{events:[...gev,null]},undefined,null,{events:'x'}])]);
 }
}

function*tousLesCas({max=Infinity}={}){
 yield* releve();
 yield* reels(max);
 yield* variantes();
}

module.exports={nom:'export',description:'native-export, phase-pli, gcv1-export (buildDiagnostic), export-cache (pures), crc32 : relevé du tronc, données réelles, variantes',
 sources:C.SOURCES,cas:tousLesCas,variantes,reels,releve,
 js(e){return C.comparable(jouer(enJs(),e.f,C.depuisOctets(e.octets)));},
 rs(e,coeur){return C.comparable(jouer(fac(coeur),e.f,C.depuisOctets(e.octets)));},
 bilan:()=>facade?{...facade.f.compteurs(),raisons:facade.f.raisonsDesReplis()}:null,jouerSource};
