/* 4.7.20 — panneau en piste H : bandeau dans ESV, vue Natif (temps par cut,
 * activité), et un écart non consigné n'est jamais dessiné comme un écart nul.
 * `panel.js` est chargé tel quel dans un contexte `vm`, comme dans
 * `panel-ligne.test.cjs` : DOM et API Chrome simulés, code du panneau réel. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',style:{},
  classList:{toggle(){}},dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(){},replaceChildren(){},append(){},
  addEventListener(){},set onchange(_){},set oninput(_){},set onclick(_){}});
async function panneau(state,hash,{bandeau=false}={}){
  const elements=new Map(),appels=[];
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:()=>element(),
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async({action,args})=>{appels.push({action,args});
      return {result:action==='view'?state:action==='list-tabs'?[]:action==='bandeau-etat'?{on:bandeau}:{}};}}};
  const context={document,chrome,location:{hash},addEventListener:()=>{},setInterval:()=>{},setTimeout:()=>{},clearTimeout:()=>{},console,Date};
  vm.createContext(context);vm.runInContext(SOURCE,context);
  for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
  return {$:id=>document.getElementById(id),appels};
}
const seq=cuts=>cuts.map((cut,i)=>({sequenceIndex:i,cutId:'p|23|'+cut,identity:{part:23,cut}}));
const lot=(extra={})=>({batch:{state:'RUNNING',step:'capture',scope:{part:23,start:100,end:120,unresolvedPolicy:'defer',lotDecision:'apply'},
  processed:[{cut:100,evidence:{startedAt:'2026-09-25T10:00:00Z'}},{cut:101,evidence:{startedAt:'2026-09-25T10:00:20Z'}}],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],
  deferred:[{cut:102,deferredAt:'2026-09-25T10:00:40Z',unresolvedRails:['left']}],sequence:seq([100,101,102,103]),activeIdentity:{part:23,cut:103},
  lotCommands:{100:{cut:100,stage:'first-pass',action:'engine',ecartMm:null},101:{cut:101,action:'lot',stage:'window',ecartMm:4.2},102:{cut:102,action:'engine',stage:'deferred',ecartMm:null}},...extra}});

test('bandeau : activé, il reçoit l\'état du lot en une ligne ; éteint, rien n\'est envoyé',async()=>{
  let {appels}=await panneau(lot(),'#automatic',{bandeau:true});
  const envoi=appels.find(a=>a.action==='bandeau');assert.ok(envoi,'texte envoyé au service worker');
  assert.equal(envoi.args.on,true);assert.match(envoi.args.text,/^BANANE · PILOTE · En cours · cut 103 · 2 posés · 1 différés$/);assert.equal(envoi.args.ton,'vert');
  ({appels}=await panneau(lot(),'#automatic',{bandeau:false}));assert.equal(appels.some(a=>a.action==='bandeau'),false);
});

test('Pilote : l\'état dit l\'étape, la plage avance, l\'activité liste les derniers cuts',async()=>{
  const {$}=await panneau(lot(),'#automatic');
  assert.equal($('lot-etat').textContent,'En cours · capture du LiDAR');assert.equal($('lot-etat').className,'eyebrow live');
  assert.equal($('lot-progres').hidden,false);assert.equal($('lot-pct').textContent,'15 % de la plage');assert.equal($('lot-progres-fill').style.width,'15%');
  const a=$('lot-activite').innerHTML;assert.equal($('lot-activite-bloc').hidden,false);
  assert.match(a,/<span class="c">102<\/span><span class="quoi differe">différé · rail gauche<\/span>/);
  assert.match(a,/<span class="c">101<\/span><span class="quoi voie-l">posé · par la voie<\/span><span class="v">4,2 mm<\/span>/);
  assert.ok(a.indexOf('>102<')<a.indexOf('>101<'),'le plus récent en premier');
});

test('un écart non consigné n\'est pas un écart nul : ni point, ni médiane à 0',async()=>{
  const {$}=await panneau(lot(),'#automatic');const svg=$('voie').innerHTML;
  assert.equal((svg.match(/<circle /g)||[]).length,1,'seul 101 a un écart consigné');assert.match(svg,/médiane <b>4,2 mm<\/b>/);
});

test('Natif : temps par cut sur les visites terminées, médiane et p90, activité avec l\'issue de chaque visite',async()=>{
  const t0=Date.parse('2026-09-25T10:00:00Z'),iso=s=>new Date(t0+s*1000).toISOString();
  const visits=[0,10,18,30,37].map((s,i)=>({visitId:'v'+i,visitIndex:i,identity:{part:34,cut:8450+i},startedAt:iso(s),
    label:['VALIDATE_NO_MOVEMENT','VALIDATE_CORRECTED_BOTH','SKIP','VALIDATE_NO_MOVEMENT',null][i],...(i<4?{endedAt:iso(s+5)}:{})}));
  const {$}=await panneau({native:{status:'RUNNING',visits,incomplete:[]},current:{identity:{part:34,cut:8454}}},'#native');
  assert.equal($('native-etat').textContent,'Collecte en cours · observation');assert.equal($('native-etat').className,'eyebrow live');
  assert.equal($('native-count').textContent,5);assert.match($('native-derniere').textContent,/^Dernière · 8454 · en cours$/);
  const g=$('native-temps').innerHTML;assert.equal($('native-temps-bloc').hidden,false);
  assert.equal((g.match(/class="b[ "]/g)||[]).length,5,'quatre visites terminées et la visite en cours');
  assert.equal((g.match(/class="b lent/g)||[]).length,1,'au-delà du p90 : 12 s');assert.match(g,/médiane 9,0 s/);assert.match(g,/p90 11,4 s/);
  const a=$('native-activite').innerHTML;
  assert.match(a,/8454<\/span><span class="quoi encours">visite en cours/);assert.match(a,/8452<\/span><span class="quoi refuse">SKIP<\/span><span class="v">12,0 s/);
  assert.match(a,/8451<\/span><span class="quoi voie-l">corrigé · 2 rails<\/span><span class="v">8,0 s/);
});
