'use strict';
/* CH-058 — index du journal en mémoire (src/journal-index.js) : une lecture bornée rend EXACTEMENT ce que rendait
 * « tout lire puis filtrer » (mêmes objets, même ordre), et les étapes qui relisaient tout IndexedDB passent par lui.
 *   node --test tests/ch058-journal-index.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const JI0=require('../src/journal-index.js'),{typesIndexes}=require('../tools/ch058-parite-index.cjs');
const TYPES_IX=typesIndexes(),JI={...JI0,TYPES:TYPES_IX,equiper:(b,o)=>JI0.equiper(b,o??{types:TYPES_IX})};
const lire=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

/* Un magasin factice de la forme de BananeStorage3 : trois magasins clé → objet, `getAll` dans l'ordre des clés
 * (chaînes, unités de code, comme IndexedDB), transactions asynchrones. Compte les lectures complètes. */
function magasin(){const m={clouds:new Map(),events:new Map(),records:new Map()},lus={events:0,records:0};
  const tri=n=>[...m[n].keys()].sort(),pause=()=>new Promise(r=>setImmediate(r));
  const db={transaction:nom=>{const tx={oncomplete:null,onerror:null,onabort:null};let attente=0;
    const req=f=>{const q={onsuccess:null};attente++;setImmediate(()=>{q.result=f();q.onsuccess&&q.onsuccess();
      if(--attente===0)setImmediate(()=>tx.oncomplete&&tx.oncomplete());});return q;};
    tx.objectStore=()=>({get:k=>req(()=>structuredClone(m[nom].get(k))),count:()=>req(()=>m[nom].size),
      getAll:()=>{lus.parGetAll=(lus.parGetAll||0)+1;return req(()=>tri(nom).map(k=>structuredClone(m[nom].get(k))));},getAllKeys:()=>req(()=>tri(nom))});
    setImmediate(()=>{if(attente===0)tx.oncomplete&&tx.oncomplete();});return tx;}};
  return {m,lus,open:async()=>db,
    putEvent:async e=>{await pause();m.events.set(e.eventId,structuredClone(e));},putRecord:async r=>{await pause();m.records.set(r.recordId||r.id,structuredClone(r));},
    deleteEvent:async id=>{m.events.delete(id);},deleteRecord:async id=>{m.records.delete(id);},
    deleteMany:async(n,ids)=>{let k=0;for(const id of ids)if(m[n].delete(id))k++;return k;},
    deleteIfUnchanged:async(n,ids)=>{const s=[];for(const id of ids)if(m[n].delete(id))s.push(id);return {supprimes:s,gardes:[]};},
    clearAll:async()=>{for(const x of Object.values(m))x.clear();},
    all:async n=>{if(n in lus)lus[n]++;await pause();return tri(n).map(k=>structuredClone(m[n].get(k)));},
    keys:async n=>tri(n),getRecord:async id=>structuredClone(m.records.get(id))};}
/* Générateur déterministe. */
function alea(g){let x=g>>>0||1;return ()=>{x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};}
const TYPES=[...JI.TYPES,'adapter-progress','phase-timing','native-operator-event','autre'];

test('lecture bornée = tout lire puis filtrer, après écritures, réécritures et suppressions aléatoires',async()=>{
  for(const graine of [1,7,42]){const r=alea(graine),s=JI.equiper(magasin());const id=()=>'e'+Math.floor(r()*400).toString(36).padStart(3,'0');
    const ev=()=>{const t=TYPES[Math.floor(r()*TYPES.length)];return {eventId:id(),type:t,batchId:'L'+Math.floor(r()*3),...(r()<0.3?{nativeSessionId:'S'+Math.floor(r()*2)}:{}),n:Math.floor(r()*1000)};};
    for(let i=0;i<300;i++)await s.putEvent(ev());
    await s.indexJournal.construire();
    for(let i=0;i<600;i++){const x=r();
      if(x<0.6)await s.putEvent(ev());else if(x<0.7)await s.deleteEvent(id());else if(x<0.75)await s.deleteMany('events',[id(),id(),id()]);
      else if(x<0.78)await s.deleteIfUnchanged('events',[id()]);else if(x<0.9)await s.putRecord({recordId:'r'+Math.floor(r()*80),nativeSessionId:'S'+Math.floor(r()*2),v:i});
      else if(x<0.92)await s.deleteRecord('r'+Math.floor(r()*80));
      if(i%50===0){const tous=await s.all('events');
        for(const t of [['validation-accepted'],['relecture-ombre','esv-observation'],JI.TYPES]){
          assert.deepEqual((await s.lireParType(t)).filter(e=>t.includes(e.type)),tous.filter(e=>t.includes(e.type)),`graine ${graine}, pas ${i}, types ${t}`);}
        for(const sid of ['S0','S1','S9']){
          assert.deepEqual((await s.lireEvenementsNatif(sid)).filter(e=>e.nativeSessionId===sid),tous.filter(e=>e.nativeSessionId===sid));
          assert.deepEqual((await s.lireVisitesNatif(sid)).filter(v=>v.nativeSessionId===sid),(await s.all('records')).filter(v=>v.nativeSessionId===sid));}}}
    await s.clearAll();assert.deepEqual(await s.lireParType(['validation-accepted']),[]);}
});

test('une écriture en cours est vue par une lecture lancée après elle ; une clé non textuelle rend la main à la lecture complète',async()=>{
  const s=JI.equiper(magasin());await s.indexJournal.construire();
  void s.putEvent({eventId:'a',type:'validation-accepted'});
  assert.equal((await s.lireParType(['validation-accepted'])).length,1);
  const t=JI.equiper(magasin());await t.putEvent({eventId:7,type:'validation-accepted'});t.m.events.set('b',{eventId:'b',type:'autre'});
  await t.indexJournal.construire();assert.equal(t.indexJournal.etat().invalide,true);
  assert.equal((await t.lireParType(['validation-accepted'])).length,2,'repli : tout lire (l’appelant filtre)');
  await assert.rejects(()=>s.lireParType(['adapter-progress']),/non indexé/);
});

test('index construit une fois : les lectures suivantes ne relisent plus tout le magasin',async()=>{
  const s=JI.equiper(magasin());for(let i=0;i<50;i++)await s.putEvent({eventId:'e'+i,type:i%2?'relecture-ombre':'adapter-progress',nativeSessionId:i%5?null:'S'});
  await s.lireParType(['relecture-ombre']);const apres=s.lus.events;
  await s.lireParType(['relecture-ombre']);await s.lireEvenementsNatif('S');await s.clesNatif('S');
  assert.equal(s.lus.events,apres,'aucune lecture complète de plus');assert.equal(s.indexJournal.etat().mesures.constructions,1);
});

test('export Écho : dataset() lit la session par l’index et rend le même objet que la lecture complète',async()=>{
  const {Sessions}=require('../src/native-session.js');
  const fabriquer=equipe=>{const st=magasin();const s=equipe?JI.equiper(st):st;
    const n={id:'S',status:'FINISHED',startedAt:'2026-01-01T08:00:00Z',finishedAt:'2026-01-01T09:00:00Z',observationPeriods:[],cloudIds:['c1'],metrics:{dropped:0,degradationLevels:[]},visits:[]};
    return {s,se:new Sessions({s:{native:n},save:async()=>{}},{},s)};};
  const remplir=async s=>{for(let i=0;i<40;i++){await s.putEvent({eventId:'e'+String(i).padStart(2,'0'),type:'native-x',nativeSessionId:i%3?'S':'T',eventSeq:40-i});
      await s.putRecord({recordId:'r'+i,nativeSessionId:i%4?'S':'T',visitIndex:40-i,identity:{part:8,cut:i},status:'complete'});}};
  const a=fabriquer(false),b=fabriquer(true);await remplir(a.s);await remplir(b.s);await b.s.indexJournal.construire();
  const avant=b.s.lus.events;
  const x=await a.se.dataset(),y=await b.se.dataset();delete x.exportedAt;delete y.exportedAt;
  assert.deepEqual(y,x,'même export');
  assert.equal(b.s.lus.events,avant,'dataset() ne relit plus tout le magasin events');
});

test('les étapes qui relisaient tout le journal passent par l’index (lecture du code)',()=>{
  const bg=lire('background.js'),corps=nom=>{const i=bg.indexOf(nom);assert.ok(i>=0,nom);return bg.slice(i,bg.indexOf('\n}',i)>0?bg.indexOf('\nasync function',i+10):i+4000);};
  assert.ok(bg.includes('const store=globalThis.BananeJournalIndex?.equiper?BananeJournalIndex.equiper(new BananeStorage3(),{types:TYPES_INDEXES}):new BananeStorage3();'),'le store du service worker est équipé');
  assert.match(bg,/importScripts\([^)]*src\/journal-index\.js/,'module chargé par le service worker');
  for(const f of ['async function validationsAriane','async function vertsAControler','async function fileRegistreNoter'])
    assert.doesNotMatch(corps(f),/store\.all\('events'\)/,f+' ne relit plus tout le journal');
  const panel=lire('panel.js');assert.match(panel,/native-export-cles/,'le panneau demande les clés de la session');
  assert.match(lire('panel.html'),/src\/journal-index\.js/);
});

test('équiper ne modifie pas le magasin : deux vies du service worker sur la même base gardent chacune leur index',async()=>{
  const base=magasin();base.setState=async function(x){this.state=x;};const propres=Object.keys(base).sort();
  const a=JI.equiper(base),b=JI.equiper(base);
  assert.deepEqual(Object.keys(base).sort(),propres,'magasin d’origine intact');assert.notEqual(a,b);assert.equal(JI.equiper(a),a,'déjà équipé : rendu tel quel');
  await b.putEvent({eventId:'x',type:'validation-accepted'});
  /* Une méthode du magasin qui écrit sur `this` écrit sur le magasin d'origine, pas sur l'objet équipé. */
  await a.setState({v:1});assert.deepEqual(base.state,{v:1});
  a.putRecord=async()=>'moteur';assert.equal(await a.putRecord({}),'moteur');assert.notEqual(base.putRecord,a.putRecord,'affectation gardée sur l’objet équipé');
  assert.equal((await a.lireParType(['validation-accepted'])).length,1,'l’autre vie construit son index sur la base');
});

test('lecture par clés : par get quand peu de clés, par getAll filtré quand beaucoup ; même résultat',async()=>{
  const s=JI.equiper(magasin());for(let i=0;i<100;i++)await s.putEvent({eventId:'e'+String(i).padStart(3,'0'),type:i<10?'validation-accepted':'relecture-ombre',nativeSessionId:i<80?'S':'T'});
  const tous=await s.all('events');
  assert.deepEqual(await s.lireParType(['validation-accepted']),tous.filter(e=>e.type==='validation-accepted'));assert.equal(s.lus.parGetAll||0,0,'10 % : get');
  assert.deepEqual(await s.lireEvenementsNatif('S'),tous.filter(e=>e.nativeSessionId==='S'));assert.equal(s.lus.parGetAll,1,'80 % : getAll filtré');
});

test('incohérence (clé de l’index absente de la base) : jamais de résultat partiel, repli complet, événement au journal, index reconstruit',async()=>{
  const s=JI.equiper(magasin());for(let i=0;i<20;i++)await s.putEvent({eventId:'e'+String(i).padStart(2,'0'),type:'validation-accepted'});
  await s.indexJournal.construire();
  s.m.events.delete('e05');   // écrit hors de l'instance : l'index ne le sait pas
  const r=await s.lireParType(['validation-accepted']);
  assert.equal(r.filter(e=>e.type==='validation-accepted').length,19,'lecture complète : tout ce qui est en base, rien de moins');
  const ev=[...s.m.events.values()].filter(e=>e.type==='journal-index-repli');
  assert.equal(ev.length,1,'un événement au journal');assert.equal(ev[0].raison,'cle-absente');assert.equal(ev[0].manquants,1);
  assert.equal(s.indexJournal.etat().mesures.replis,1);
  const avant=s.indexJournal.etat().mesures.constructions;await s.lireParType(['validation-accepted']);
  assert.equal(s.indexJournal.etat().mesures.constructions,avant+1,'index reconstruit au besoin suivant');
});

test('seul le service worker écrit dans events et records : ni le panneau ni ses modules n’écrivent (lecture du code)',()=>{
  const html=lire('panel.html'),scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f!=='src/storage.js');
  const ECRITURES=/\b(putEvent|putRecord|deleteEvent|deleteRecord|deleteMany|deleteIfUnchanged|clearAll|archiverVisites)\s*\(|'readwrite'/;
  for(const f of scripts){const t=lire(f).replace(/\/\*[\s\S]*?\*\//g,'');
    /* export-cache.js ne fait que recevoir le store qu'on lui passe ; seul le service worker l'appelle pour supprimer (viderCacheExport). */
    /* journal-index.js : le panneau n'en utilise que `lireCles` (transaction en lecture seule) ; il n'équipe aucun store. */
    if(f==='src/journal-index.js'){assert.doesNotMatch(lire('panel.js'),/\.equiper\(/,'le panneau n’équipe pas de store');continue;}
    if(f==='src/export-cache.js'){assert.doesNotMatch(lire('panel.js'),/EC\(\)\.supprimer|ExportCache\.supprimer|\.supprimer\(\s*s\b/,'le panneau n’appelle pas la suppression');continue;}
    assert.doesNotMatch(t,ECRITURES,f+' n’écrit pas dans IndexedDB');}
  assert.ok(!/content_scripts[\s\S]*storage\.js/.test(lire('manifest.json')),'aucun script de page ne charge le stockage');
});
