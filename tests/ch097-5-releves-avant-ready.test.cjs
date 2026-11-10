'use strict';
/* CH-097, défaut 5 — RELEVÉS REÇUS AVANT `ready`. Le message qui RÉVEILLE le service worker arrive avant que l'onglet choisi soit relu
 * (`selectedTab` encore nul) : `esv-releve` et `clic-hors-vue` étaient ignorés sans trace (le défaut OBS-3, corrigé jusqu'ici pour
 * `esv-observation` seulement). Ils sont maintenant rangés une fois `ready` résolu, et seulement s'ils viennent de l'onglet choisi.
 * Service worker RÉEL en VM, onglet choisi gardé dans le stockage (comme après un réveil). Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {production,memoire}=require('./helpers/perf-production.cjs');
const ORIGINE=fs.readFileSync(path.join(__dirname,'..','background.js'),'utf8').match(/u\.origin==='([^']+)'/)[1];
const ESV=tab=>({id:'test',tab:{id:tab},url:ORIGINE+'/rails_validation/test'});
const tick=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));};
const clic={cote:'left',chemin:'directe',raison:'hors-canevas',ndc:[-7.12,.21],client:[-2300.4,500.2],essai:1,lecture:'rapide'};
const RELEVE={kind:'esv-releve',releve:{at:'2026-11-10T10:00:00.000Z',requestId:'r1',identity:{part:23,cut:100}}};
const CLIC={kind:'clic-hors-vue',releve:{requestId:'r1',action:'apply',mode:'tel-quel',identity:{part:23,cut:100},clics:[clic]}};
function reveil(){const local=memoire();local.m.banane3Tab=1;return production({local});}
const types=b=>b.store.events.filter(e=>e.type==='esv-releve'||e.type==='clic-hors-vue').map(e=>e.type).sort();

test('message de réveil venu de l’onglet choisi : le relevé du compteur et le clic hors vue sont rangés après `ready`',async()=>{
 const b=reveil();
 assert.equal(b.get('selectedTab'),null,'avant ready : onglet choisi pas encore relu');
 b.raw(RELEVE,ESV(1));b.raw(CLIC,ESV(1));
 await b.api('view');await tick();
 assert.equal(b.get('selectedTab'),1);
 assert.deepEqual(types(b),['clic-hors-vue','esv-releve']);});

test('message de réveil venu d’un AUTRE onglet : toujours ignoré',async()=>{
 const b=reveil();b.raw(RELEVE,ESV(2));b.raw(CLIC,ESV(2));
 await b.api('view');await tick();assert.deepEqual(types(b),[]);});

test('service worker déjà prêt : comme avant (rangé pour l’onglet choisi, ignoré sinon), sans réponse',async()=>{
 const b=reveil();await b.api('view');
 const r=b.raw(RELEVE,ESV(1));b.raw(CLIC,ESV(1));b.raw(RELEVE,ESV(2));await tick();
 assert.equal(r.returned,undefined);assert.equal(r.out,undefined);
 assert.deepEqual(types(b),['clic-hors-vue','esv-releve']);});
