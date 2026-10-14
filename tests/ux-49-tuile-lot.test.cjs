/* 4.9.0.14 — la tuile du lot (retour de Mic sur la test 13 : « le vert ne se remplit pas »).
 * Le vert dit la part de la plage parcourue ; il ne reste jamais vide et muet :
 * - plage fixe : (cut courant − premier) / (dernier − premier) ;
 * - « jusqu'à la fin de partie » : le dernier cut est M−1, M lu au compteur d'ESV « cut N sur M »
 *   pendant le lot (b.totalReleve, même partie, source « compteur ») : la règle de D-062 ;
 * - fin inconnue : bande indéterminée et « fin de partie inconnue », jamais un faux pourcentage ;
 * - il avance quand le cut change et ne recule pas sur un retour à un cut. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',style:{},
  classList:{toggle(){}},dataset:{},setAttribute(){},removeAttribute(){},replaceChildren(){},append(){},
  addEventListener(){},set onchange(_){},set oninput(_){},set onclick(_){}});
async function panneau(etat){
  const elements=new Map(),minuteries=[];let state=etat;
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:()=>element(),
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async({action})=>({result:action==='view'?state:action==='list-tabs'?[]:action==='bornes-partie'?{last:null,source:null}:{}})}};
  const context={document,chrome,location:{hash:'#automatic'},addEventListener:()=>{},setInterval:(f,ms)=>minuteries.push([f,ms]),setTimeout:()=>{},console};
  vm.createContext(context);vm.runInContext(SOURCE,context);
  const attendre=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};await attendre();
  const $=id=>document.getElementById(id);
  /* Le rafraîchissement de chaque seconde : un nouvel état, puis un rendu. */
  $.etat=async e=>{state=e;for(const [f,ms] of minuteries)if(ms===1000)f();await attendre();};
  return $;
}
const lot=(scope,active,extra={})=>({current:{identity:{part:23,cut:active}},batch:{state:'RUNNING',step:'apply',scope:{part:23,start:100,unresolvedPolicy:'defer',lotDecision:'apply',lowConfidence:'attempt',...scope},
  processed:[{cut:100}],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],deferred:[],sequence:[{sequenceIndex:0,cutId:'p|23|100',identity:{part:23,cut:100}}],
  activeIdentity:{part:23,cut:active},lotCommands:{},...extra}});
const finDePartie={end:999999,endMode:'partie'};
const releve=(cut,total,x={})=>({totalReleve:{part:23,cut,total,totalSource:'compteur',at:'2026-10-14T12:00:00Z',...x}});
const vert=$=>({cache:$('lot-progres').hidden,largeur:$('lot-progres-fill').style.width,pct:$('lot-pct').textContent,note:$('lot-progres-note').textContent,inconnu:/indetermine/.test($('lot-progres').className)});

test('plage fixe : le vert vaut la part de la plage parcourue',async()=>{
  const $=await panneau(lot({end:120},105));
  assert.deepEqual(vert($),{cache:false,largeur:'25%',pct:'25',note:'',inconnu:false});
});
test('jusqu’à la fin de partie, compteur d’ESV lu (cut N sur M) : dernier cut = M−1',async()=>{
  const $=await panneau(lot(finDePartie,105,releve(105,121)));
  assert.deepEqual(vert($),{cache:false,largeur:'25%',pct:'25',note:'',inconnu:false});
});
test('jusqu’à la fin de partie, fin inconnue : bande indéterminée et texte, jamais un faux pourcentage',async()=>{
  for(const extra of [{},releve(105,121,{part:22}),releve(105,121,{totalSource:'illisible',total:null}),releve(130,121),releve(105,121,{totalSource:'plusieurs'})]){
    const $=await panneau(lot(finDePartie,105,extra));const v=vert($);
    assert.equal(v.cache,false,'le vert ne disparaît pas');assert.equal(v.inconnu,true,JSON.stringify(extra));
    assert.equal(v.pct,'');assert.equal(v.note,'fin de partie inconnue');}
});
test('le vert avance quand le cut change, et ne recule pas sur un retour à un cut',async()=>{
  const $=await panneau(lot({end:120},105));assert.equal(vert($).largeur,'25%');
  await $.etat(lot({end:120},110));assert.equal(vert($).largeur,'50%','avance avec le cut courant');assert.equal(vert($).pct,'50');
  await $.etat(lot({end:120},102));assert.equal(vert($).largeur,'50%','un retour en arrière ne vide pas le vert');assert.equal(vert($).pct,'50');
  await $.etat(lot({end:120},116));assert.equal(vert($).largeur,'80%');
  /* Un autre lot repart de zéro. */
  await $.etat({...lot({end:220,start:200},205),batch:{...lot({end:220,start:200},205).batch,id:'autre'}});assert.equal(vert($).largeur,'25%');
});

/* Cas réel (export de la test 13, partie 23) : lot parti du cut 1, « fin de partie »
 * (fin factice 999999, jamais prise pour une fin) ; un seul relevé du compteur, tardif :
 * {cut:7591, total:9260}. Jusqu'au relevé, la bande « fin de partie inconnue » ; ensuite,
 * le vert sur 1 → 9259 (M−1, D-062). */
test('relevé du compteur tardif : bande « fin de partie inconnue » jusque-là, puis le vert ; 999999 n’est jamais une fin',async()=>{
  const reel=(cut,extra={})=>({...lot({start:1,end:999999,endMode:'partie'},cut,extra),current:{identity:{part:23,cut}}});
  const $=await panneau(reel(7000));
  assert.deepEqual(vert($),{cache:false,largeur:'100%',pct:'',note:'fin de partie inconnue',inconnu:true});
  await $.etat(reel(7400));assert.equal(vert($).inconnu,true,'toujours aucun relevé : toujours la bande');
  await $.etat(reel(7591,releve(7591,9260)));
  assert.deepEqual(vert($),{cache:false,largeur:'82%',pct:'82',note:'',inconnu:false},'(7591 − 1) / (9259 − 1)');
  await $.etat(reel(7721,releve(7591,9260)));assert.equal(vert($).largeur,'83%','le relevé reste valable pour les cuts suivants du lot');
});
