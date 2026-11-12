'use strict';
/* CH-084 (D-313) — fin de la fenêtre de la validation sur place (Maj+Espace) par un ÉTAT OBSERVÉ. Aujourd'hui `validerMajEspace` attend
 * toujours 1 500 ms un changement de cut qui n'arrive pas (147 appels sur 147, lots du 09/11). Réglage `validationSurPlace.actif` : la
 * fenêtre se ferme dès que l'écriture « valid » de CE cut, envoyée après la frappe, est vue par l'observateur passif ET que le libellé
 * reste celui du cut pendant 300 ms et 3 images ; sinon, comme avant (navigation vue, ou 1 500 ms). Navigation tardive d'ESV simulée à
 * 400, 800 et 1 400 ms : la page la rend telle quelle si elle la voit ; sinon le service worker la voit au libellé et arrête la passe.
 * Données synthétiques (tests/helpers/page.cjs, tests/helpers/relecture-essais.cjs). */
const {test}=require('node:test'),assert=require('node:assert/strict');
/* Le patch (chantiers/CH-084/adapter-page.patch) est appliqué à une COPIE temporaire de src/adapter-page.js tant que le tronc ne le porte
 * pas (même méthode que tests/ch084-attentes-capture.test.cjs) ; la page simulée lit cette copie. Un patch qui ne s'applique plus échoue. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const SRC=path.resolve(__dirname,'../src/adapter-page.js'),PATCH=path.resolve(__dirname,'../chantiers/CH-084/adapter-page.patch');
const ORIGINAL=fs.readFileSync(SRC,'utf8'),DEJA=ORIGINAL.includes('attendreSurPlace');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch084v-'));fs.mkdirSync(path.join(dir,'src'));fs.writeFileSync(path.join(dir,'src/adapter-page.js'),ORIGINAL);
const r=DEJA?{status:0}:spawnSync('patch',['-s','-p1','-d',dir,'-i',PATCH],{encoding:'utf8'});
const PATCHE=DEJA?ORIGINAL:(r.status===0?fs.readFileSync(path.join(dir,'src/adapter-page.js'),'utf8'):null);
const lire=fs.readFileSync;fs.readFileSync=function(f,...a){if(path.resolve(String(f))===SRC&&PATCHE!==null)return PATCHE;return lire.call(fs,f,...a);};
test('le patch s’applique au tronc (ou le tronc le porte)',()=>{assert.equal(r.status,0,'patch : '+(r.stderr||r.stdout||r.error?.message));assert.ok(PATCHE.includes('attendreSurPlace'));});
const {page}=require('./helpers/page.cjs');
const S=require('../src/settings.js');

/* Page ESV synthétique : une image = 100 ms (pas de requestAnimationFrame), l'horloge avance avec les minuteries. `ecriture` : à cet
 * instant après la frappe, l'observateur poste l'écriture « valid » de la ligne `ligne` ; `nav` : à cet instant, ESV affiche le cut 101. */
function esv({actif=true,ecriture=null,ligne=100,nav=null,corps={ExtractionStatus:'valid',TreatedByOperator:true},statut=200}={}){
 const reglages={...S,validationSurPlace:{...S.validationSurPlace,actif}};
 const f=page({globals:{BananeSettings:reglages}});let t0=null,poste=false;
 const doc=f.ctx.document.dispatchEvent;
 f.ctx.document.dispatchEvent=e=>{if(e.type==='keydown'&&e.code==='Space'&&e.shiftKey)t0=f.clock();return doc(e);};
 f.ctx.viewer.renderer.domElement.dispatchEvent=e=>f.ctx.document.dispatchEvent(e);
 f.ctx.onTick=()=>{if(t0===null)return;const t=f.clock()-t0;
  if(ecriture!==null&&!poste&&t>=ecriture){poste=true;
   f.raw('ignore',[],{kind:'banane5:esv-observation',entry:{kind:'write',status:statut,rowIndex:ligne,startedEpochMs:null,body:corps}});}
  if(nav!==null&&t>=nav)f.nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';};
 return {f,duree:()=>f.clock()-t0};}
const majEspace=async o=>{const x=esv(o),s=await x.f.call('state');const e=await x.f.call('validerMajEspace',s.identity,{part:23});return {e,ms:x.duree(),x};};

test('réglage allumé par défaut pour le lot d’essai ; valeurs planchers 300 ms et 3 images',()=>{
 assert.deepEqual({...S.validationSurPlace},{actif:true,libelleStableMs:300,imagesMin:3});
});

test('écriture « valid » de ce cut vue à 300 ms, libellé inchangé : fenêtre close avant 1 500 ms, même sens qu’aujourd’hui',async()=>{
 const {e,ms}=await majEspace({ecriture:300});
 assert.ok(ms<1000,`fenêtre close tôt (${ms} ms)`);assert.ok(ms>=600,`au moins 300 ms et 3 images après l’écriture (${ms} ms)`);
 assert.equal(e.navigationObserved,false);assert.equal(e.nextIdentity,null);assert.equal(e.commandSent,true);assert.equal(e.serverConfirmed,false);
 assert.equal(e.finFenetre.sortie,'ecriture-vue');assert.match(e.meaning,/sur place|cut inchangé/);
});

test('sans écriture, écriture d’un autre cut, refusée ou non « valid » : 1 500 ms comme aujourd’hui',async()=>{
 for(const [nom,o] of [['aucune',{}],['autre cut',{ecriture:300,ligne:99}],['statut 500',{ecriture:300,statut:500}],
  ['pas valid',{ecriture:300,corps:{ExtractionStatus:'invalid',TreatedByOperator:true}}],['pas opérateur',{ecriture:300,corps:{ExtractionStatus:'valid',TreatedByOperator:false}}]]){
  const {e,ms}=await majEspace(o);assert.ok(ms>=1500,`${nom} : ${ms} ms`);assert.equal(e.finFenetre.sortie,'delai',nom);
  assert.equal(e.navigationObserved,false,nom);assert.match(e.meaning,/cut inchangé après le délai/,nom);}
});

test('réglage éteint : comportement d’avant (1 500 ms même avec l’écriture vue), aucun champ nouveau',async()=>{
 const {e,ms}=await majEspace({actif:false,ecriture:300});
 assert.ok(ms>=1500,`${ms} ms`);assert.equal('finFenetre' in e,false);assert.equal(e.navigationObserved,false);
});

test('navigation tardive d’ESV à 400 ms (avant la fin de la fenêtre) : rendue telle quelle, jamais « sur place »',async()=>{
 const {e}=await majEspace({ecriture:300,nav:400});
 assert.equal(e.navigationObserved,true);assert.equal(e.nextIdentity.cut,101);assert.equal(e.finFenetre.sortie,'navigation');
});

test('navigation tardive à 800 et 1 400 ms (après la fin de la fenêtre) : la page rend « sur place », le libellé dit ensuite un autre cut',async()=>{
 for(const nav of [800,1400]){const {e,ms,x}=await majEspace({ecriture:300,nav});
  assert.ok(ms<nav,`fenêtre close (${ms} ms) avant la navigation (${nav} ms)`);assert.equal(e.navigationObserved,false);
  /* La suite revérifie l'identité : la lecture suivante voit le cut 101 (le service worker arrête alors la passe, essai suivant). */
  x.f.advance(nav);x.f.ctx.onTick();const s=await x.f.call('state');assert.equal(s.identity.cut,101,`à ${nav} ms`);}
});

const {H,PERMISSIF,apresLot}=require('./helpers/relecture-essais.cjs');
/* Le simulateur du service worker rend `navigationObserved:false` (la page a fermé sa fenêtre sur l'écriture) ; ESV affiche ensuite le
 * cut 100, soit tout de suite (avant la relecture du libellé par le service worker), soit plus tard (après elle, avant l'étape suivante). */
async function passeNavTardive(retardMs){
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',decisions:{109:14},reglagesProposes:PERMISSIF,ecartementPartie:null,
  esv:a=>{a.total=116;a.bordsListe=true;
   /* Le montage a déjà posé son relais de l'écriture « valid » : il est gardé, et ESV change de cut APRÈS l'écriture. */
   let relais=a.surValidation;Object.defineProperty(a,'surValidation',{configurable:true,get:()=>async(cut,e)=>{if(relais)await relais(cut,e);
    if(cut===109){const go=()=>{a.afficher(100);a.identity.cut=100;a.ajuster();};if(retardMs<0)go();else setTimeout(go,retardMs);}},set:f=>{relais=f;}});}});
 return {p:await H.finPasse(b),b,adapter,lot};}
test('service worker : navigation tardive AVANT la relecture du libellé → passe arrêtée après la validation prouvée, rien d’autre',async()=>{
 const {p,b,adapter,lot}=await passeNavTardive(-1);
 assert.equal(p.etat,'erreur',p.message);assert.equal(p.corriges,1);
 assert.match(p.message,/arrêtée après la correction du cut 109 \(validation vue\) : après Maj\+Espace, ESV affiche le cut 100 de la partie 23, pas le cut 109/);
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109],'aucune autre validation');
 assert.equal(H.evenements(b,'relecture-ombre').at(-1).identity.cut,109,'rien d’autre après');
 assert.equal(apresLot(b,lot).filter(c=>c.action==='apply').length,1,'une seule pose');
});
