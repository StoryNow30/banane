/* Chantier UX 4.9 (variante A retenue par Mic, 13–14/10). La politique
 * effective quitte la vue principale pour « Détails du lot » : elle y reste
 * écrite (D-045) ; si elle n'est pas celle par défaut, une pastille le dit sur
 * la vue. `panel.js` réel dans un contexte `vm`, comme panel-ligne.test.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',
  classList:{toggle(){}},dataset:{},setAttribute(){},removeAttribute(){},replaceChildren(){},append(){},
  addEventListener(){},set onchange(_){},set oninput(_){},set onclick(_){}});
async function panneau(state){
  const elements=new Map();
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:()=>element(),
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async({action})=>({result:action==='view'?state:action==='list-tabs'?[]:{}})}};
  const context={document,chrome,location:{hash:'#automatic'},addEventListener:()=>{},setInterval:()=>{},setTimeout:()=>{},console};
  vm.createContext(context);vm.runInContext(SOURCE,context);
  for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
  return id=>document.getElementById(id);
}
const lot=scope=>({batch:{state:'RUNNING',scope:{part:23,start:100,end:120,...scope},processed:[{cut:100}],skipped:[],paused:[],interrupted:[],
  manuallyCompleted:[],deferred:[],sequence:[{sequenceIndex:0,cutId:'p|23|100',identity:{part:23,cut:100}}],activeIdentity:{part:23,cut:101},lotCommands:{}}});

test('politique par défaut : aucune pastille ; la politique effective reste écrite dans « Détails du lot »',async()=>{
  const $=await panneau(lot({unresolvedPolicy:'defer',lotDecision:'apply',lowConfidence:'attempt'}));
  assert.equal($('lot-politique-pastille').hidden,true);
  assert.equal($('unresolved-policy-effective').hidden,false);assert.match($('unresolved-policy-effective').textContent,/continuer et différer/);
  assert.match($('lot-decision-effective').textContent,/appliquée/);assert.match($('policy-effective').textContent,/tenter la proposition expérimentale/);
});

test('politique hors défaut : une pastille courte la nomme, sans rien retirer du détail',async()=>{
  const $=await panneau(lot({unresolvedPolicy:'pause',lotDecision:'observe',lowConfidence:'attempt'}));
  assert.equal($('lot-politique-pastille').hidden,false);
  assert.equal($('lot-politique-pastille').textContent,'Politique : rail non résolu : pause · décision sur le lot : observée');
  assert.match($('unresolved-policy-effective').textContent,/mettre le lot en pause/);assert.match($('lot-decision-effective').textContent,/observée seulement/);
});

test('sans lot : pas de pastille',async()=>{
  const $=await panneau({});assert.equal($('lot-politique-pastille').hidden,true);
});

test('panel.html : la politique effective est dans « Détails du lot », fermé par défaut ; la pastille existe',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../panel.html'),'utf8');
  const tiroir=html.match(/<div id="lot-details" class="tiroir" hidden>[\s\S]*?<input type="hidden" id="policy" value="attempt">\s*<\/div>/)?.[0];
  assert.ok(tiroir,'tiroir « Détails du lot » fermé dans le HTML');
  for(const id of ['lot-decision-effective','unresolved-policy-effective','policy-effective','lot-reglages','journal','dataset'])assert.match(tiroir,new RegExp(`id="${id}"`),id);
  assert.doesNotMatch(tiroir,/id="departs-liste"/,'les départs sont sur la vue, plus dans les détails');assert.match(html,/<div id="departs-liste" class="departs/);
  assert.match(html,/<p id="lot-politique-pastille" class="pastille" hidden><\/p>/);
  assert.match(html,/id="lot-details-toggle" class="pill details-toggle" aria-expanded="false"[^>]*>Détails du lot</);
});

/* Départs des parties (D-092). 4.9.0.16 (test 15, Mic : voir aussi les parties précédentes) : la
 * partie en cours en grand (sa fiche la plus récente), puis l'historique des autres parties, de la
 * plus récente à la plus ancienne, chacune dépliable sur ses départs. Texte seulement. */
test('départs : partie en cours en grand, puis historique des parties précédentes (plus récente d’abord) ; texte seulement',async()=>{
  const elements=new Map(),cree=tag=>({tag,className:'',textContent:'',children:[],append(...c){this.children.push(...c);},replaceChildren(...c){this.children=c;},
    hidden:false,disabled:false,innerHTML:'',value:'',checked:false,open:false,classList:{toggle(){}},dataset:{},setAttribute(){},removeAttribute(){},addEventListener(){},set onchange(_){},set oninput(_){},set onclick(_){}});
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:cree,getElementById(id){if(!elements.has(id))elements.set(id,cree('div'));return elements.get(id);}};
  const fiches=[{at:'2026-10-12T16:04:40Z',partie:33,valides:2015,invalides:12,total:2310},{at:'2026-10-13T09:00:00Z',partie:34,valides:1200,invalides:30,total:2140},
    {at:'2026-10-13T12:58:02Z',partie:34,valides:1284,invalides:37,ignores:5,total:2140},{at:'2026-10-13T14:00:00Z',partie:35,valides:'<img>',invalides:0,total:900}];
  const state=lot({unresolvedPolicy:'defer',lotDecision:'apply',lowConfidence:'attempt'});state.batch.scope.part=34;
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async({action})=>({result:action==='view'?state:action==='fiches-depart'?{fiches}:action==='list-tabs'?[]:{}})}};
  const context={document,chrome,location:{hash:'#automatic'},addEventListener:()=>{},setInterval:()=>{},setTimeout:()=>{},console,BananeExportCache:{}};
  vm.createContext(context);vm.runInContext(SOURCE,context);
  for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));
  const blocs=document.getElementById('departs-liste').children,txt=e=>e.textContent+e.children.map(txt).join(' ');
  assert.equal(blocs.length,3,'la carte en cours, le titre de l’historique, l’historique');
  const [carte,titre,hist]=blocs;
  assert.equal(carte.className,'depart en-cours');assert.match(txt(carte),/Partie 34/);assert.match(txt(carte),/en cours · 13\/10 12:58 UTC · 2 départs/);
  assert.match(txt(carte),/1\u202f284.*validés.*37.*invalides.*2\u202f140.*total/s);assert.match(txt(carte),/dont 5 ignorés/);
  /* Le détail des deux départs de la partie en cours, du plus récent au plus ancien. */
  const detail=carte.children.find(c=>c.className==='d-detail');assert.ok(detail,'détail dépliable');assert.equal(detail.tag,'details');
  assert.match(txt(detail),/Voir les 2 départs/);assert.match(txt(detail),/13\/10 12:58 UTC 1\u202f284 37 2\u202f140.*13\/10 09:00 UTC 1\u202f200 30 2\u202f140/s);
  assert.equal(titre.textContent,'Parties précédentes (2)');
  assert.equal(hist.className,'d-hist');assert.equal(hist.children.length,2,'une ligne par partie précédente');
  assert.ok(hist.children.every(l=>l.tag==='details'&&l.className==='d-partie'),'chaque partie se déplie');
  assert.match(txt(hist.children[0]),/Partie 35.*13\/10 14:00 UTC.*\? validés.*0 invalides.*900 total.*1 départ\b/s,'la plus récente d’abord ; une valeur illisible s’écrit « ? », jamais en HTML');
  assert.match(txt(hist.children[1]),/Partie 33.*12\/10 16:04 UTC.*2\u202f015 validés.*12 invalides.*2\u202f310 total.*1 départ\b/s);
  assert.ok(!JSON.stringify(blocs.map(txt)).includes('<img>'),'jamais de HTML');
});
