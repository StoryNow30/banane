'use strict';
/* CH-110 — le service worker range l'événement `potree-place-rendue` de l'observateur (liste blanche), avec le patch chantiers/CH-110/background.patch
 * appliqué à une copie temporaire de background.js (fichier de CH-109 : l'intégrateur l'applique). Déjà appliqué : background.js lu tel quel. Patch absent
 * ou qui ne s'applique plus : ÉCHEC ; outil `patch` absent : saut. SW réel en VM (tests/helpers/perf-production.cjs), données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'..'),BG=path.join(racine,'background.js'),PATCH=path.join(racine,'chantiers/CH-110/background.patch');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch110-sw-')),copie=path.join(dir,'background.js');fs.copyFileSync(BG,copie);
const DEJA=fs.readFileSync(BG,'utf8').includes("case 'potree-place-rendue':");
const r=DEJA?{status:0}:!fs.existsSync(PATCH)?{status:1,stderr:'patch absent'}:spawnSync('patch',['-s','-p1','-d',dir,'-i',PATCH],{encoding:'utf8'});
const raison=r.error?.code==='ENOENT'?'outil patch absent':null,opts=raison?{skip:raison}:{};
const lire=fs.readFileSync;fs.readFileSync=function(f,...a){if(!raison&&path.resolve(String(f))===BG)return lire.call(fs,copie,...a);return lire.call(fs,f,...a);};
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const {production}=require('./helpers/perf-production.cjs');
const send=(b,entries)=>b.raw({kind:'esv-observation',observer:'obs-1',entries});
const stored=b=>b.store.events.filter(e=>e.type==='esv-observation');

test('le patch du service worker s’applique (ou y est déjà)',opts,()=>{assert.equal(r.status,0,'patch : '+(r.stderr||r.stdout));});

test('service worker : `potree-place-rendue` rangé, champs réduits, ni clé ni adresse',opts,async()=>{
 const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),t=b.get('timing');e.s.batch={id:'lot-r',state:'RUNNING',scope:{part:23,start:100,end:101}};t.syncBatch(true);t.ensureVisit(b.adapter.identity);
 const out=send(b,[{seq:1,kind:'potree-place-rendue',motif:'rendue',profondeur:5,statut:502,essai:1,avant:4,apres:3,rendues:1,episode:1,cut:77,pageMs:9,cle:'5-1-2-3',url:'https://esv.test/ept-data/5-1-2-3.laz'},
  {seq:2,kind:'potree-place-rendue',motif:'inconnu',profondeur:-1,statut:'x',essai:1.5}]).out;
 deq(out,{accept:true,stored:2});const s=stored(b).filter(x=>x.kind==='potree-place-rendue');assert.equal(s.length,2);
 deq([s[0].motif,s[0].profondeur,s[0].statut,s[0].essai,s[0].avant,s[0].apres,s[0].rendues,s[0].episode,s[0].cut,s[0].pageMs],['rendue',5,502,1,4,3,1,1,77,9]);
 deq([s[1].motif,s[1].profondeur,s[1].statut,s[1].essai],[null,null,null,null]);
 /* La clé envoyée, pas tout motif « n-n-n-n » : un identifiant aléatoire de l'événement peut en contenir un (échec intermittent au verify du 11/11). */
 assert.ok(!/ept-data|esv\.test|5-1-2-3/.test(JSON.stringify(s)),'ni clé ni adresse: '+JSON.stringify(s).match(/\d+-\d+-\d+-\d+/));
});
