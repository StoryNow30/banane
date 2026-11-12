'use strict';
/* CH-111 (D-345) — la télécommande dans le VRAI service worker (VM, tests/helpers/perf-production.cjs), relais simulé par un faux WebSocket.
 * Sans appairage : rien (ni socket, ni écriture). Appairée : l'état réel envoyé est chiffré et réduit à la liste blanche ; un ordre du téléphone
 * prend le même chemin que le bouton du panneau (même effet, même refus mot pour mot) ; « Couper » oublie tout. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,memoire}=require('./helpers/perf-production.cjs');
const T=require('../src/telecommande.js');
const RELAIS=['https:/','/relais-essai','.exemple','.test'].join('');
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
function monter(){const sockets=[];
 class FauxWS{constructor(url){this.url=url;this.readyState=0;this.envoyes=[];sockets.push(this);setTimeout(()=>{this.readyState=1;this.onopen?.();},0);}
  send(t){this.envoyes.push(t);}close(){this.readyState=3;this.onclose?.({});}recevoir(t){this.onmessage?.({data:t});}}
 const local=memoire(),b=production({local});b.ctx.WebSocket=FauxWS;b.ctx.TextDecoder=TextDecoder;/* la VM des essais n'en a pas ; le service worker, si */return {b,sockets,local};}
const clairs=async(D,s)=>Promise.all(s.envoyes.map(x=>T.dechiffrer(D,'a>t',JSON.parse(x))));
function feuilles(o,c='',out=[]){if(o&&typeof o==='object'){for(const [k,v] of Object.entries(o))feuilles(v,c+'.'+k,out);}else out.push([c,o]);return out;}
const UUID='0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0';

test('service worker sans appairage : aucune socket, rien de gardé, état « non appairée »',async()=>{
 const {b,sockets,local}=monter();await b.api('connect',{tabId:1});await attendre(50);
 assert.equal(sockets.length,0);assert.ok(!Object.keys(local.m).some(k=>/telecommande/i.test(k)),Object.keys(local.m).join());
 assert.deepEqual(JSON.parse(JSON.stringify(await b.api('telecommande-etat'))),{appairee:false,relais:null,connectee:false,dernierEnvoi:null});
 assert.equal(await b.api('telecommande-code'),null);});

test('service worker appairé : état réel chiffré, liste blanche, ordres par le chemin du panneau, journal, coupure',async()=>{
 const {b,sockets,local}=monter();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const r=await b.api('telecommande-appairer',{relais:RELAIS});const D=await T.deriver(await T.decoder(r.code));
 await attendre(50);const s=sockets.at(-1);assert.match(s.url,new RegExp('/canal/'+D.canal+'\\?role=ariane$'));
 const e=b.get('engine');
 e.s.batch={id:UUID,state:'RUNNING',scope:{part:23,start:100,end:120},activeIdentity:{part:23,cut:104,frameId:UUID},processed:[{cut:100,identity:{part:23,cut:100,frameId:UUID}}],deferred:[],skipped:[],paused:[],interrupted:[],sequence:[]};
 e.s.notice='Projet Project__123456 '+UUID;
 await attendre(1300);/* boucle d'une seconde du service worker */
 const etats=(await clairs(D,s)).filter(c=>c.type==='etat'),v=etats.at(-1);
 assert.equal(v.lot.etat,'cours');assert.equal(v.lot.cut,104);assert.equal(v.lot.partie,23);assert.equal(v.lot.fin,120);assert.equal(v.lot.traites,1);
 for(const [c,x] of feuilles(v))assert.ok(x===null||typeof x==='boolean'||Number.isInteger(x)||T.MOTS.has(x),`${c} = ${JSON.stringify(x)}`);
 assert.ok(!s.envoyes.join('').includes('Project__')&&!JSON.stringify(etats).match(/Project__|0f1e2d3c|https?:/));
 /* ordre « Pause du lot » : même effet que le bouton (engine.pause) */
 const envoyerOrdre=async(ordre,n)=>{s.recevoir(JSON.stringify(await T.chiffrer(D,'t>a',{type:'ordre',n,h:Date.now(),ordre})));await attendre(150);};
 const n0=Date.now();await envoyerOrdre('lot-pause',n0+1);assert.equal(e.s.batch.state,'PAUSED');
 /* ordre refusé : même refus que le bouton du panneau, mot pour mot (nettoyé) */
 e.s.batch=null;let refusPanneau=null;try{await b.api('relecture-reprendre');}catch(x){refusPanneau=x.message;}
 assert.ok(refusPanneau,'le panneau refuse « Reprendre la relecture » sans relecture en pause');await envoyerOrdre('relecture-reprendre',n0+2);
 const acc=(await clairs(D,s)).filter(c=>c.type==='accuse');
 assert.deepEqual(acc.map(a=>[a.ordre,a.resultat]),[['lot-pause','accepte'],['relecture-reprendre',refusPanneau?'refuse':'accepte']]);
 if(refusPanneau)assert.equal(acc[1].motif,T.nettoyerMotif(refusPanneau));
 /* hors liste : jamais exécuté */
 await envoyerOrdre('explicit-skip',n0+3);assert.equal((await clairs(D,s)).filter(c=>c.type==='accuse').at(-1).motif,'ordre-inconnu');
 const j=b.store.events.filter(x=>x.type==='telecommande-ordre');
 assert.deepEqual(j.map(x=>[x.ordre,x.resultat,x.motif]),[['lot-pause','accepte',null],['relecture-reprendre',refusPanneau?'refuse':'accepte',refusPanneau?'refus-ariane':null],['inconnu','refuse','ordre-inconnu']]);
 assert.ok(!JSON.stringify(b.store.events.filter(x=>/^telecommande/.test(x.type))).includes(r.code),'jamais la clé au journal');
 /* couper */
 const c=await b.api('telecommande-couper');assert.equal(c.appairee,false);assert.equal(s.readyState,3);
 assert.ok(!Object.keys(local.m).some(k=>/telecommande/i.test(k)));});
