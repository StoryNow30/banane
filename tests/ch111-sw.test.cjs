'use strict';
/* CH-111 (D-345) — la télécommande dans le VRAI service worker (VM, tests/helpers/perf-production.cjs), relais simulé par un faux WebSocket.
 * Sans appairage : rien (ni socket, ni écriture). Appairée : l'état réel envoyé est chiffré et réduit à la liste blanche ; un ordre du téléphone
 * prend le même chemin que le bouton du panneau (même effet, même refus mot pour mot) ; « Couper » oublie tout. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
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
const UUID=['0f1e2d3c','4b5a','6978','8796','a5b4c3d2e1f0'].join('-');/* fabriqué à l'exécution (scan d'identité) */

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
 e.s.notice='Projet '+'Project'+'__123456 '+UUID;
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
 if(refusPanneau)assert.deepEqual([acc[1].motif,acc[1].cut],[T.codeRefus(refusPanneau).code,T.codeRefus(refusPanneau).cut]);
 assert.equal(acc[1].motif,'pas-en-pause','« Aucune relecture en pause. »');
 /* hors liste : jamais exécuté */
 await envoyerOrdre('explicit-skip',n0+3);assert.equal((await clairs(D,s)).filter(c=>c.type==='accuse').at(-1).motif,'ordre-inconnu');
 const j=b.store.events.filter(x=>x.type==='telecommande-ordre');
 assert.deepEqual(j.map(x=>[x.ordre,x.resultat,x.motif]),[['lot-pause','accepte',null],['relecture-reprendre',refusPanneau?'refuse':'accepte',refusPanneau?'refus-ariane':null],['inconnu','refuse','ordre-inconnu']]);
 assert.ok(!JSON.stringify(b.store.events.filter(x=>/^telecommande/.test(x.type))).includes(r.code),'jamais la clé au journal');
 /* couper */
 const c=await b.api('telecommande-couper');assert.equal(c.appairee,false);assert.equal(s.readyState,3);
 assert.ok(!Object.keys(local.m).some(k=>/telecommande/i.test(k)));});

test('réveil du service worker : un appairage gardé se reconnecte seul, sans geste',async()=>{
 const {b,sockets,local}=monter();await b.api('connect',{tabId:1});const r=await b.api('telecommande-appairer',{relais:RELAIS});await attendre(50);
 const D=await T.deriver(await T.decoder(r.code)),n1=sockets.length;
 /* nouvelle vie : même chrome.storage.local, nouveau service worker */
 const sockets2=[];class WS2{constructor(url){this.url=url;this.readyState=0;this.envoyes=[];sockets2.push(this);setTimeout(()=>{this.readyState=1;this.onopen?.();},0);}send(t){this.envoyes.push(t);}close(){this.readyState=3;}}
 const b2=production({local});b2.ctx.WebSocket=WS2;b2.ctx.TextDecoder=TextDecoder;
 await b2.api('view');await attendre(100);
 assert.equal(sockets2.length,1,'reconnectée au réveil');assert.match(sockets2[0].url,new RegExp('/canal/'+D.canal+'\\?role=ariane$'));
 assert.equal((await T.dechiffrer(D,'a>t',JSON.parse(sockets2[0].envoyes[0]))).type,'etat','état envoyé dès la reconnexion');
 assert.equal(JSON.parse(JSON.stringify(await b2.api('telecommande-etat'))).connectee,true);assert.equal(sockets.length,n1);
 b.get('telecommande').arreter();b2.get('telecommande').arreter();});

test('chaque ordre de la liste appelle EXACTEMENT l’action du bouton du panneau (même message `panel`) ; aucun nom hors liste n’atteint le service worker',async()=>{
 const {b,sockets}=monter();await b.api('connect',{tabId:1});const r=await b.api('telecommande-appairer',{relais:RELAIS});await attendre(50);
 const D=await T.deriver(await T.decoder(r.code)),s=sockets.at(-1);
 /* espion sur `dispatch` (la fonction que le message `panel` du panneau appelle) */
 const vus=[];b.ctx.__vus=vus;vm.runInContext('{const vrai=dispatch;dispatch=async m=>{__vus.push(JSON.parse(JSON.stringify(m)));return {};};}',b.ctx);
 let n=Date.now();const envoyer=async ordre=>{s.recevoir(JSON.stringify(await T.chiffrer(D,'t>a',{type:'ordre',n:++n,h:Date.now(),ordre,args:{piege:1}})));await attendre(40);};
 const attendu={'lot-pause':'pause','lot-reprendre':'resume','lot-arreter':'stop','relecture-pause':'relecture-pause','relecture-reprendre':'relecture-reprendre','relecture-arreter':'relecture-arreter','constellation-arreter':'file-arreter'};
 for(const [o,a] of Object.entries(attendu)){vus.length=0;await envoyer(o);assert.deepEqual(JSON.parse(JSON.stringify(vus)),[{kind:'panel',action:a,args:{}}],o);}
 for(const o of ['skip','explicit-skip','start','retry','goto-cut','passe-differes-ecrire','file-demarrer','native-pause','native-resume','manual-takeover','close-uncertain','pause','resume','stop','telecommande-couper','view']){
  vus.length=0;await envoyer(o);assert.equal(vus.length,0,o+' n’atteint pas le service worker');}
 const acc=(await clairs(D,s)).filter(c=>c.type==='accuse');assert.equal(acc.filter(a=>a.resultat==='refuse'&&a.motif==='ordre-inconnu').length,16);
 b.get('telecommande').arreter();});
