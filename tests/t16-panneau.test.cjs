'use strict';
/* 4.9.0.16 (retours de l'opérateur au test 15) — panneau réel (`panel.js` en vm) :
 *  - sélecteur « Onglet ESV » : deux onglets au même titre se distinguent ; l'invite n'est pas
 *    choisissable ; l'onglet qu'Ariane utilise, ou le seul onglet prêt, est choisi d'avance ; rien
 *    ne se connecte sans « Reconnecter ESV » (sauf un onglet unique, comme avant) ;
 *  - tuile du lot : le pourcentage défile image par image (sans requestAnimationFrame ou avec
 *    « réduire les animations » : posé d'un coup) ; état en cours / pause / fini ; impulsion à
 *    chaque cut terminé ; célébration une seule fois, quand le lot finit sous les yeux ;
 *  - « 1 cut », jamais « 1 cuts ». */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const element=(tag='div')=>{const e={tag,hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',style:{},children:[],animations:[],
  classList:{toggle(){},add(){},remove(){}},dataset:{},setAttribute(){},removeAttribute(){},replaceChildren(...c){this.children=c;},append(...c){this.children.push(...c);},
  addEventListener(){},animate(frames,opts){this.animations.push({frames,opts});return {};},set onchange(_){},set oninput(_){},set onclick(_){}};
  Object.defineProperty(e,'firstElementChild',{get(){return this.children[0]??null;}});return e;};
async function panneau(etat,{tabs=[],raf=null,reduit=false}={}){
  const elements=new Map(),minuteries=[],appels=[];let state=etat;
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:t=>element(t),
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  /* La tuile : le bord porte son onde. */
  document.getElementById('lot-bord').append(element('span'));
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async({action,args})=>{appels.push({action,args});return {result:action==='view'?state:action==='list-tabs'?tabs:action==='bornes-partie'?{last:null,source:null}:{}};}}};
  const context={document,chrome,location:{hash:'#automatic'},addEventListener:()=>{},setInterval:(f,ms)=>minuteries.push([f,ms]),setTimeout:()=>{},console,
    matchMedia:q=>({matches:reduit&&/reduce/.test(q)}),...(raf?{requestAnimationFrame:raf}:{})};
  vm.createContext(context);vm.runInContext(SOURCE,context);
  const attendre=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};await attendre();
  const $=id=>document.getElementById(id);
  $.etat=async e=>{state=e;for(const [f,ms] of minuteries)if(ms===1000)f();await attendre();};
  $.appels=appels;return $;
}
const lot=(active,extra={})=>({current:{identity:{part:23,cut:active}},batch:{id:'lot-1',state:'RUNNING',step:'apply',scope:{part:23,start:100,end:120,unresolvedPolicy:'defer',lotDecision:'apply',lowConfidence:'attempt'},
  processed:Array.from({length:active-100},(_,i)=>({cut:100+i})),skipped:[],paused:[],interrupted:[],manuallyCompleted:[],deferred:[],sequence:[{sequenceIndex:0,cutId:'p|23|100',identity:{part:23,cut:100}}],
  activeIdentity:{part:23,cut:active},lotCommands:{},...extra}});
const options=$=>$('tabs').children.map(o=>({value:String(o.value),texte:o.textContent,disabled:o.disabled,hidden:o.hidden}));

test('onglets ESV au même titre : fenêtre, rang et premier plan les distinguent ; l’invite ne se choisit pas',async()=>{
  const titre='Project 260911 view';
  const $=await panneau({},{tabs:[{id:11,title:titre,windowId:5,index:2,active:true,pret:true},{id:12,title:titre,windowId:5,index:4,active:false,pret:true},{id:13,title:titre,windowId:9,index:0,active:true,pret:false}]});
  const o=options($);
  assert.deepEqual(o[0],{value:'',texte:'Choisir l’onglet ESV à utiliser…',disabled:true,hidden:false});
  assert.deepEqual(o.slice(1).map(x=>x.texte),[`Onglet 3 · fenêtre 1 · au premier plan — ${titre}`,`Onglet 5 · fenêtre 1 — ${titre}`,`Onglet 1 · fenêtre 2 · au premier plan · pas prêt — ${titre}`]);
  assert.equal(new Set(o.map(x=>x.texte)).size,o.length,'aucun libellé en double');
  assert.equal($('tabs').value,'','deux onglets prêts : rien n’est choisi d’avance');
  assert.ok(!$.appels.some(a=>a.action==='connect'),'rien ne se connecte tout seul');
});

test('un seul onglet ESV prêt parmi plusieurs : choisi d’avance, sans connexion automatique ; l’onglet utilisé par Ariane passe avant',async()=>{
  const t=[{id:21,title:'ESV A',windowId:1,index:0,pret:false},{id:22,title:'ESV B',windowId:1,index:1,pret:true}];
  const $=await panneau({},{tabs:t});
  assert.equal($('tabs').value,'22');assert.equal(options($)[0].hidden,true,'l’invite est masquée quand un onglet est choisi');
  assert.match($('tabs-note').textContent,/Un seul onglet ESV est prêt : il est choisi/);assert.ok(!$.appels.some(a=>a.action==='connect'));
  const $2=await panneau({},{tabs:[{...t[0],pret:true,utilise:true},t[1]]});
  assert.equal($2('tabs').value,'21');assert.equal(options($2)[1].texte,'Utilisé par Ariane — ESV A');
  /* Titres différents : pas de précision superflue. */
  assert.equal(options($2)[2].texte,'ESV B');
});

test('un seul onglet ESV : comme avant, pas d’invite, choisi et connecté',async()=>{
  const $=await panneau({},{tabs:[{id:31,title:'ESV',windowId:1,index:0,active:true,pret:true}]});
  assert.deepEqual(options($).map(o=>o.texte),['ESV']);assert.equal($('tabs').value,'31');assert.ok($.appels.some(a=>a.action==='connect'&&a.args.tabId===31));
});

test('« 1 cut », « 2 cuts » : la tuile, la ligne d’état et la couverture s’accordent',async()=>{
  const $=await panneau(lot(101));
  assert.equal($('lot-traites-u').textContent,'cut');assert.match($('batch').textContent,/ · 1 cut traité · 0 ignoré/);
  await $.etat(lot(102));assert.equal($('lot-traites-u').textContent,'cuts');assert.match($('batch').textContent,/ · 2 cuts traités · 0 ignoré/);
  const html=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');assert.doesNotMatch(html,/\$\{[^}]+\} cuts traités/,'plus de pluriel forcé');
});

test('le pourcentage défile de l’ancienne à la nouvelle valeur, image par image, puis s’arrête',async()=>{
  const files=[];const raf=f=>files.push(f);
  const $=await panneau(lot(105),{raf});
  assert.equal($('lot-pct').textContent,'25','première valeur : posée d’un coup');
  await $.etat(lot(110));
  assert.equal($('lot-pct').dataset.v,'50');const vus=[];
  for(let t=0;files.length&&t<=2000;t+=100){const f=files.splice(0);for(const x of f)x(1000+t);vus.push(Number($('lot-pct').textContent));}
  assert.ok(vus.length>=8,'plusieurs images : '+vus);assert.equal(vus.at(-1),50);
  assert.ok(vus.some(v=>v>25&&v<50),'des valeurs intermédiaires : '+vus);
  assert.ok(vus.every((v,i)=>i===0||v>=vus[i-1]),'monte sans jamais redescendre : '+vus);
  assert.equal(files.length,0,'plus aucune image demandée une fois arrivé');
});

test('« réduire les animations » : valeur posée d’un coup, aucune image, aucune impulsion',async()=>{
  const files=[];const $=await panneau(lot(105),{raf:f=>files.push(f),reduit:true});
  await $.etat(lot(110));assert.equal($('lot-pct').textContent,'50');assert.equal(files.length,0);
  assert.equal($('lot-bord').firstElementChild.animations.length,0);
});

test('états de la tuile : en cours, pause, fini ; impulsion à chaque cut ; célébration une seule fois quand le lot finit',async()=>{
  const $=await panneau(lot(105));
  assert.equal($('lot-tuile').dataset.etat,'live');
  assert.equal($('lot-fete').animations.length,0,'ouvrir le panneau ne célèbre rien');
  await $.etat(lot(106));assert.equal($('lot-bord').firstElementChild.animations.length,1,'un cut terminé : une onde au bord du vert');
  await $.etat(lot(106));assert.equal($('lot-bord').firstElementChild.animations.length,1,'rien de neuf : rien ne bouge');
  await $.etat(lot(106,{state:'PAUSED'}));assert.equal($('lot-tuile').dataset.etat,'pause');
  await $.etat(lot(120,{state:'STOPPED',stoppedAtEnd:{cut:120,at:'2026-10-15T08:00:00Z',applied:true}}));
  assert.equal($('lot-tuile').dataset.etat,'fini');assert.equal($('lot-pct').textContent,'100');assert.equal($('lot-fete').animations.length,1,'la fin se célèbre');
  await $.etat(lot(120,{state:'STOPPED',stoppedAtEnd:{cut:120,at:'2026-10-15T08:00:00Z',applied:true}}));assert.equal($('lot-fete').animations.length,1,'une seule fois');
  /* Un lot déjà fini à l'ouverture du panneau : pas de célébration. */
  const $2=await panneau(lot(120,{state:'COMPLETED'}));assert.equal($2('lot-tuile').dataset.etat,'fini');assert.equal($2('lot-fete').animations.length,0);
  /* « Arrêter » n'est pas une fin : calme, sans célébration. */
  const $3=await panneau(lot(105));await $3.etat(lot(106,{state:'STOPPED'}));assert.equal($3('lot-tuile').dataset.etat,'pause');assert.equal($3('lot-fete').animations.length,0);
});

test('mouvement en CSS : lueur du bord seulement pendant le lot, figée si le système réduit les animations ; pas de boucle permanente en JS',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../panel.css'),'utf8'),js=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
  assert.match(css,/@media \(prefers-reduced-motion:no-preference\)\{[^@]*\.tuile-lot\[data-etat=live\] \.bord::before\{animation:lueur/);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important\}\}/);
  assert.match(css,/\.tuile-lot\[data-etat=pause\] \.bord\{opacity:\.35;box-shadow:none\}/);
  assert.match(css,/@keyframes lueur\{[^}]*transform/);assert.doesNotMatch(css.match(/@keyframes lueur\{.*?\}\}/s)[0],/width|height|left|top/,'lueur : transformation et opacité seulement');
  assert.doesNotMatch(js,/setInterval\([^)]*requestAnimationFrame/);
  const html=fs.readFileSync(path.join(__dirname,'../panel.html'),'utf8');
  for(const id of ['lot-tuile','lot-bord','lot-fete','lot-traites-u','tabs-note'])assert.match(html,new RegExp(`id="${id}"`),id);
});

test('liste déroulante : options lisibles dans les deux thèmes (fond opaque du thème, texte du thème)',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../panel.css'),'utf8');
  assert.match(css,/select option\{background-color:var\(--menu\);color:var\(--text\)\}/);
  assert.equal((css.match(/--menu:#16201a;--menu-on:#1f4a31/g)||[]).length,2,'sombre : système et bascule');assert.match(css,/--menu:#ffffff;--menu-on:#dcefe3/);
});
