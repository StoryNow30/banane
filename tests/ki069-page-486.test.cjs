'use strict';
/* KI-069 (4.8.6) : l'action de la page `validateInPlace` relaie Ctrl+Entrée
 * (keydown puis keyup sur document) et prouve la validation par le compteur. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs');
/* Page ESV synthétique avec compteur « N on M treated » lisible. */
function avecCompteur(f,{traites=100,total=101,effet=true,cut=null}={}){
  const txt={nodeValue:`${traites} on ${total} treated`};txt.parentElement={textContent:txt.nodeValue,parentElement:null,checkVisibility:()=>true};
  f.ctx.NodeFilter={SHOW_TEXT:4};f.ctx.document.body={};f.ctx.document.createTreeWalker=()=>{let i=0;return {nextNode:()=>i++===0?txt:null};};
  const d=f.ctx.document.dispatchEvent;
  f.ctx.document.dispatchEvent=e=>{const r=d(e);if(effet&&e.type==='keydown'&&e.key==='Enter'&&e.ctrlKey){txt.nodeValue=`${traites+1} on ${total} treated`;txt.parentElement.textContent=txt.nodeValue;
    if(cut!==null)f.nodes.get('O2N3DCutDescription').textContent=`Cut ${cut} of part 23`;}return r;};
  return txt;}
test('Ctrl+Entrée relayé : keydown puis keyup, champs exacts, bouton « valider » non cliqué',async()=>{
  const f=page();avecCompteur(f);let clics=0;const v=f.nodes.get('O2N3DCutValidate3DRail'),c=v.click;v.click=()=>{clics++;c();};
  const s=await f.call('state'),e=await f.call('validateInPlace',s.identity,{},{commande:'ctrl-entree'});
  assert.equal(clics,0);assert.deepEqual(f.keyboard.map(k=>k.type),['keydown','keyup']);
  for(const k of f.keyboard)assert.deepEqual({key:k.key,code:k.code,keyCode:k.keyCode,which:k.which,ctrl:k.ctrlKey,shift:k.shiftKey,alt:k.altKey,meta:k.metaKey,b:k.bubbles,c:k.cancelable,co:k.composed},
    {key:'Enter',code:'Enter',keyCode:13,which:13,ctrl:true,shift:false,alt:false,meta:false,b:true,c:true,co:true});
  assert.equal(e.serverConfirmed,true);assert.equal(e.navigationObserved,false);assert.equal(e.command,'ctrl-entrée');
  assert.equal(JSON.stringify(e.compteurAvant),'{"traites":100,"total":101}');assert.equal(JSON.stringify(e.compteurApres),'{"traites":101,"total":101}');
  assert.equal(e.afterState.identity.cut,100,'identité inchangée');
});
test('sans effet : erreur claire, rien d\'autre n\'est envoyé',async()=>{
  const f=page();avecCompteur(f,{effet:false});const s=await f.call('state');
  await assert.rejects(f.call('validateInPlace',s.identity,{},{commande:'ctrl-entree'}),/Ctrl\+Entrée sans effet/);
  assert.deepEqual(f.keyboard.map(k=>k.type),['keydown','keyup']);assert.equal(f.nodes.get('O2N3DCutDescription').textContent,'Cut 100 of part 23');
});
test('le cut change : erreur (jamais de navigation affirmée)',async()=>{
  const f=page();avecCompteur(f,{cut:101});const s=await f.call('state');
  await assert.rejects(f.call('validateInPlace',s.identity,{},{commande:'ctrl-entree'}),/a fait changer le cut/);
});
test('compteur illisible avant : refus AVANT toute émission',async()=>{
  const f=page(),s=await f.call('state');
  await assert.rejects(f.call('validateInPlace',s.identity,{},{commande:'ctrl-entree'}),/compteur/);assert.equal(f.keyboard.length,0);
});
test('repli « bouton » : refusé tant que l\'identifiant du bouton n\'est pas réglé ; clique le bouton réglé sinon, sans Ctrl+Entrée',async()=>{
  const f=page();avecCompteur(f);const s=await f.call('state');
  await assert.rejects(f.call('validateInPlace',s.identity,{},{commande:'bouton'}),/buttonValidateRail/);assert.equal(f.keyboard.length,0);
  let clics=0;f.nodes.set('BTN_VALIDER_SEUL',{click(){clics++;}});
  await assert.rejects(f.call('validateInPlace',s.identity,{},{commande:'bouton',boutonId:'BTN_VALIDER_SEUL'}),/sans effet/);
  assert.equal(clics,1);assert.equal(f.keyboard.length,0);
});
