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
/* Aides de l'essai de la navigation tardive, reprises du premier fichier (découpage du 12/11 : limite de 20 s par fichier du verify). */
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
test('service worker : navigation tardive APRÈS la relecture du libellé (0 et 150 ms) → l’étape suivante revérifie l’identité : bonnes coupes, aucune pose ni validation de plus',async()=>{
 for(const retard of [0,150]){const {p,b,adapter,lot}=await passeNavTardive(retard);
  assert.notEqual(p.etat,'en-cours',`${retard} ms`);assert.equal(p.corriges,1,`${retard} ms : ${p.message}`);
  assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109],`${retard} ms : aucune autre validation`);
  assert.equal(apresLot(b,lot).filter(c=>c.action==='apply').length,1,`${retard} ms : une seule pose, sur 109`);
  const ev=H.evenements(b,'relecture-ombre');assert.deepEqual(ev.filter(e=>e.action==='corrige').map(e=>e.identity.cut),[109],`${retard} ms`);
  for(const e of ev)assert.ok(e.identity.cut>=108,`${retard} ms : aucune visite du cut 100 où ESV s’est égaré (${e.identity.cut})`);}
});
