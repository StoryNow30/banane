'use strict';
/* 5.0, revue de la relecture (D-175, corrections 4 et 6) et D-179 — l'action de page `validerMajEspace` : le geste de l'opérateur pour valider
 * (Maj+Espace, 1 377 validations sur 1 377 dans les Échos). Sur un vert valide, ESV valide SUR PLACE et reste sur le même cut (l'opérateur, deux
 * fois, D-179) ; sur un cut rouge, il passe à un autre cut. L'action relaie la touche comme l'opérateur la frappe (Maj enfoncée, Espace enfoncée
 * puis relâchée, Maj relâchée) sur le canevas d'ESV, une seule fois, attend un court instant un changement de cut (jamais les 15 s d'une
 * navigation : en place, il n'y en a pas) et rend ce qu'elle a vu. Elle ne prouve pas la validation : c'est l'écriture vue par
 * l'observateur passif, côté service worker. Tout refus AVANT l'envoi dit « rien n'a été envoyé à ESV » ; après l'envoi, jamais.
 * Données synthétiques (tests/helpers/page.cjs). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs');
/* Page ESV synthétique : le canevas relaie la frappe au document (comme le DOM la fait remonter) ; sur Maj+Espace, ESV valide sur place
 * (cut inchangé, `vers:null`, comme sur un vert), ou passe à un autre cut (`vers`), ou ne bouge pas (`effet:false`). */
function esv({effet=true,vers=null}={}){const f=page(),cles=[];let clics=0;
 const v=f.nodes.get('O2N3DCutValidate3DRail'),c=v.click;v.click=()=>{clics++;c();};
 const doc=f.ctx.document.dispatchEvent;
 f.ctx.document.dispatchEvent=e=>{const r=doc(e);if(effet&&vers!==null&&e.type==='keydown'&&(e.key===' '||e.code==='Space')&&e.shiftKey&&!e.ctrlKey)f.nodes.get('O2N3DCutDescription').textContent=`Cut ${vers} of part 23`;return r;};
 f.ctx.viewer.renderer.domElement.dispatchEvent=e=>{cles.push(e);return f.ctx.document.dispatchEvent(e);};
 return {f,cles,clics:()=>clics};}
const forme=k=>({type:k.type,key:k.key,code:k.code,keyCode:k.keyCode,which:k.which,shift:k.shiftKey,ctrl:k.ctrlKey,alt:k.altKey,meta:k.metaKey,b:k.bubbles,c:k.cancelable,co:k.composed});

test('Maj+Espace relayé une fois, sur le canevas, comme l\'opérateur le frappe ; bouton « valider » jamais cliqué ; validation sur place : cut inchangé, rendu vite',async()=>{
 const {f,cles,clics}=esv(),s=await f.call('state'),t0=f.ctx.Date.now();
 const e=await f.call('validerMajEspace',s.identity,{part:23,pageId:s.identity.pageId});
 const attendu=f.ctx.Date.now()-t0;assert.ok(attendu<5000,`en place, pas d’attente de navigation de 15 s (horloge de la page : ${attendu} ms)`);
 assert.equal(clics(),0,'aucun clic du bouton « valider et suivant »');
 assert.deepEqual(cles.map(forme),[
  {type:'keydown',key:'Shift',code:'ShiftLeft',keyCode:16,which:16,shift:true,ctrl:false,alt:false,meta:false,b:true,c:true,co:true},
  {type:'keydown',key:' ',code:'Space',keyCode:32,which:32,shift:true,ctrl:false,alt:false,meta:false,b:true,c:true,co:true},
  {type:'keyup',key:' ',code:'Space',keyCode:32,which:32,shift:true,ctrl:false,alt:false,meta:false,b:true,c:true,co:true},
  {type:'keyup',key:'Shift',code:'ShiftLeft',keyCode:16,which:16,shift:false,ctrl:false,alt:false,meta:false,b:true,c:true,co:true}]);
 assert.equal(cles.filter(k=>k.type==='keydown'&&k.code==='Space').length,1,'une seule frappe d’Espace');
 assert.equal(f.keyboard.some(k=>k.key==='Enter'||k.key==='Backspace'),false,'ni Ctrl+Entrée ni Maj+Retour');
 assert.equal(e.format,'banane-maj-espace-v1');assert.equal(e.command,'maj-espace');assert.equal(e.operatorDecision,'VALIDATE');
 assert.equal(e.commandSent,true);assert.equal(e.navigationObserved,false,'ESV reste sur le cut');assert.equal(e.beforeNavigationIdentity.cut,100);
 assert.equal(e.nextIdentity,null);assert.equal(e.serverConfirmed,false,'la preuve est l’écriture, côté service worker');
 assert.match(e.meaning,/sur place/);assert.equal(f.nodes.get('O2N3DCutDescription').textContent,'Cut 100 of part 23');
 assert.doesNotMatch(JSON.stringify(e),/rien n.a été envoyé/);
});

test('ESV passe à un autre cut : rendu tel quel (le service worker arrête la passe) ; ESV immobile : rendu, jamais « rien n’a été envoyé »',async()=>{
 {const {f}=esv({vers:101}),s=await f.call('state'),e=await f.call('validerMajEspace',s.identity,{part:23});
  assert.equal(e.navigationObserved,true);assert.equal(e.nextIdentity.cut,101);assert.equal(e.nextIdentity.part,23);}
 {const {f}=esv({vers:140}),s=await f.call('state'),e=await f.call('validerMajEspace',s.identity,{part:23});
  assert.equal(e.navigationObserved,true);assert.equal(e.nextIdentity.cut,140);}
 {const {f,cles}=esv({effet:false}),s=await f.call('state'),e=await f.call('validerMajEspace',s.identity,{part:23});
  assert.equal(e.commandSent,true);assert.equal(e.navigationObserved,false);assert.equal(e.nextIdentity,null);
  assert.equal(cles.filter(k=>k.code==='Space').length,2,'keydown et keyup, une seule fois');
  assert.match(e.meaning,/cut inchangé/);assert.doesNotMatch(JSON.stringify(e),/rien n.a été envoyé/);}
});

test('refus AVANT l’envoi, sans aucune touche : cut affiché différent, partie hors du lot, page rechargée, option inconnue',async()=>{
 for(const [nom,prep,args,motif] of [
  ['cut différé',(f,s)=>({...s.identity,cut:99}),s=>[{part:23}],/rien n.a été envoyé à ESV/],
  ['partie',(f,s)=>s.identity,s=>[{part:24}],/partie.*rien n.a été envoyé à ESV/],
  ['page',(f,s)=>s.identity,s=>[{part:23,pageId:'autre-page'}],/page.*rien n.a été envoyé à ESV/],
  ['option',(f,s)=>s.identity,s=>[{part:23},{preuve:'ecriture'}],/option.*rien n.a été envoyé à ESV/],
  ['bouton',(f,s)=>s.identity,s=>[{part:23},{commande:'bouton'}],/option.*rien n.a été envoyé à ESV/]]){
  const {f,cles}=esv(),s=await f.call('state');
  await assert.rejects(f.call('validerMajEspace',prep(f,s),...args(s)),motif,nom);
  assert.equal(cles.length,0,nom+' : aucune touche');assert.equal(f.keyboard.length,0,nom);assert.equal(f.nodes.get('O2N3DCutDescription').textContent,'Cut 100 of part 23',nom);}
});

test('libellé « Cut N of part P » illisible avant l’envoi : refus, rien n’est émis',async()=>{
 const {f,cles}=esv(),s=await f.call('state');f.nodes.get('O2N3DCutDescription').textContent='';
 await assert.rejects(f.call('validerMajEspace',s.identity,{part:23}),/rien n.a été envoyé à ESV/);assert.equal(cles.length,0);
});
