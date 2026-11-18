'use strict';
/* CH-136 — le réglage aj5 perdu le 17/11 (ÉTABLI : autre ordinateur, chrome.storage.local neuf). Le panneau doit le dire quand le stockage est neuf,
 * se taire sur un poste déjà utilisé (mise à jour sans marque), et l'avis s'acquitte par « Compris ». Aucun réglage n'est changé. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const RACINE=path.join(__dirname,'..');
const SN=require('../src/stockage-neuf.js');

function faux(){ /* DOM minimal : getElementById, createElement, insertBefore */
 const els={};const mk=t=>{const cl=new Set();const e={tag:t,children:[],attrs:{},ecouteurs:{},textContent:'',parentNode:null,offsetHeight:58,classList:{add:c=>cl.add(c),remove:c=>cl.delete(c),contains:c=>cl.has(c)},
  setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){this.ecouteurs[k]=f;},append(...c){for(const x of c){x.parentNode=this;this.children.push(x);if(x.id)els[x.id]=x;}},
  insertBefore(n,a){n.parentNode=this;this.children.splice(this.children.indexOf(a),0,n);if(n.id)els[n.id]=n;for(const c of n.children)if(c.id)els[c.id]=c;},
  remove(){const p=this.parentNode;if(p){p.children.splice(p.children.indexOf(this),1);}delete els[this.id];}};return e;};
 const body=mk('body'),main=mk('main'),notice=mk('div');notice.id='notice';main.append(notice);body.append(main);
 const vars={};
 return {D:{getElementById:id=>els[id]||null,createElement:mk,body,head:mk('head'),documentElement:{style:{setProperty:(k,v)=>{vars[k]=v;},removeProperty:k=>{delete vars[k];}}}},els,body,main,vars};
}
function stock(init={}){const s={...init};return {s,L:{get:async k=>k===null?{...s}:Object.fromEntries((Array.isArray(k)?k:[k]).filter(x=>x in s).map(x=>[x,s[x]])),set:async o=>{Object.assign(s,o);}}};}

test('stockage vide : avis et marque « neuf »',()=>{
 const r=SN.evaluer({},'2026-11-17T14:00:00Z');
 assert.equal(r.avis,true);assert.deepEqual(r.ecrire,{banane5Poste:{vu:'2026-11-17T14:00:00Z',neuf:true,acquitte:false}});
});
test('poste déjà utilisé (choix présents, pas de marque) : marque posée en silence',()=>{
 const r=SN.evaluer({banane58AjustementHauteur:true,banane3State:{}});
 assert.equal(r.avis,false);assert.equal(r.ecrire.banane5Poste.neuf,false);
});
test('le seul état du service worker ne fait pas un poste « déjà utilisé »',()=>{
 assert.equal(SN.evaluer({banane3State:{},banane54Contrats:{},banane50ContratDernier:{}}).avis,true);
});
test('marque neuve non acquittée : l’avis reste ; acquittée : il part',()=>{
 assert.equal(SN.evaluer({banane5Poste:{neuf:true,acquitte:false}}).avis,true);
 assert.equal(SN.evaluer({banane5Poste:{neuf:true,acquitte:true}}).avis,false);
 assert.equal(SN.evaluer({banane5Poste:{neuf:false}}).avis,false);
});
test('le texte nomme les réglages par défaut et ne dit rien de faux',()=>{
 assert.match(SN.TEXTE,/hauteur des poses allumée/);assert.match(SN.TEXTE,/télécommande à appairer/);assert.match(SN.TEXTE,/Comme avant/);
});
test('brancher : avis posé dans <body>, hors de <main> (caché sous Signal), « Compris » l’acquitte et le retire',async()=>{
 const {D,els,body}=faux(),{s,L}=stock();
 assert.deepEqual(await SN.brancher({L,D}),{avis:true});
 assert.ok(els['avis-stockage-neuf']);assert.equal(els['avis-stockage-neuf'].parentNode,body,'panel-ui5.css : body.ui5>main{display:none}');assert.equal(els['avis-stockage-neuf'].attrs.role,'alert');
 assert.equal(s.banane5Poste.neuf,true);
 await els['avis-stockage-neuf-ok'].ecouteurs.click();
 assert.equal(s.banane5Poste.acquitte,true);assert.equal(els['avis-stockage-neuf'],undefined);
 assert.deepEqual(await SN.brancher({L,D}),{avis:false});
});
test('brancher : la hauteur du bandeau est réservée en bas (#ui5 ne passe pas dessous), rendue après « Compris »',async()=>{
 const {D,els,body,vars}=faux(),{L}=stock();
 await SN.brancher({L,D});
 assert.ok(body.classList.contains('avis-sn'),'classe posée sur <body>');assert.equal(vars['--avis-sn-h'],'82px','58 px de bandeau + 24 px de marge');
 assert.match(SN.STYLE,/body\.avis-sn #ui5\{bottom:var\(--avis-sn-h/);
 await els['avis-stockage-neuf-ok'].ecouteurs.click();
 assert.ok(!body.classList.contains('avis-sn'));assert.equal(vars['--avis-sn-h'],undefined);
});
test('une couche de Signal ouverte (tiroir, boîte, détails techniques) rend le bandeau inatteignable au clavier (inert), refermée il revient',async()=>{
 const {D,els}=faux(),{L}=stock();let ouverte=true;
 D.querySelector=sel=>ouverte&&/sg-tiroir\[data-ouvert="1"\]/.test(sel)&&/#ui5-tech/.test(sel)?{}:null;
 await SN.brancher({L,D});
 assert.equal(els['avis-stockage-neuf'].inert,true,'couche ouverte : inert');
 ouverte=false;SN.suivreCouches(els['avis-stockage-neuf'],D);
 assert.equal(els['avis-stockage-neuf'].inert,false,'couche fermée : atteignable');
});
test('brancher : poste déjà utilisé, rien n’apparaît',async()=>{
 const {D,els}=faux(),{L}=stock({banane51Palette:'signal'});
 assert.deepEqual(await SN.brancher({L,D}),{avis:false});assert.equal(els['avis-stockage-neuf'],undefined);
});
test('le panneau charge le module (sinon l’avis n’existe pas)',()=>{
 const h=fs.readFileSync(path.join(RACINE,'panel.html'),'utf8');
 assert.match(h,/<script src="src\/stockage-neuf\.js"><\/script>/);
});
test('aucun réglage n’est écrit par le module hors de sa marque',()=>{
 const src=fs.readFileSync(path.join(RACINE,'src/stockage-neuf.js'),'utf8');
 const ecrits=[...src.matchAll(/L\.set\(([a-z.]+(?:\(s\))?)\)/g)].map(m=>m[1]);
 assert.deepEqual(ecrits,['r.ecrire','acquitter(s)']);
});
