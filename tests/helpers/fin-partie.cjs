'use strict';
/* Auxiliaires des essais D3 (4.8.5, KI-067) : lot « jusqu'à la fin de la
 * partie » dont le dernier cut est différé et où ESV quitte la page ; panneau
 * réel en vm. */
const L=require('../../src/lot-decision.js');
const {pilote}=require('./pilote-lot.cjs');
const BFCACHE='The page keeping the extension port is moved into back/forward cache, so the message channel is closed.';
/* Décision factice : le cut est refusé (différé), comme un cut sans point LiDAR. */
const differe={...L,decideCut:()=>({version:'lot-decision-v7',stage:'deferred',reason:'first-pass-low-gauge',gaugeMm:1405,lowGaugeGuardMm:1420,guardMm:null,anchorsUsed:[],anchor:false})};
/* ESV quitte la page au « suivant sans décision ». */
const quitte=esv=>{esv.nextWithoutDecision=async function(){this.calls.push('nextWithoutDecision');throw Error(BFCACHE);};};
const navs=r=>r.b.adapter.calls.filter(c=>c==='nextWithoutDecision').length;
/* Relevé passif d'ESV (D4) tel que l'adaptateur l'envoie après une capture :
 * `total` → compteur « N on M treated » ; `cuts` → texte « M cuts ». */
const ESV_SENDER={id:'test',url:'https://esv.lidar.altametris.xyz/rails_validation/test',tab:{id:1}};
function releve(b,identity,{total,cuts,traites=0}={}){const r={at:new Date().toISOString(),requestId:'r-'+identity.cut,identity:{pageId:identity.pageId,part:identity.part,cut:identity.cut}};
  if(Number.isInteger(total))r.compteur={traites,total};if(Number.isInteger(cuts))r.cutsAffiches=cuts;
  return b.message({kind:'esv-releve',releve:r},ESV_SENDER);}
/* ESV quitte la page au « suivant sans décision » ; après chaque capture, le relevé part. */
const quitteAvecReleve=(mesure={})=>(esv,b)=>{quitte(esv);if(!mesure||(!('total' in mesure)&&!('cuts' in mesure)))return;const c=esv.capture.bind(esv);
  esv.capture=async(...a)=>{const out=await c(...a);await releve(b,{...esv.identity},mesure);return out;};};
/* `mesure` : ce que D4 relève d'ESV ({total}, {cuts}, ou rien). */
async function dernierDiffere(options={},mesure={}){const r=await pilote(differe,{start:100,end:0,endMode:'partie',esv:quitteAvecReleve(mesure),...options});return {r,view:await r.b.settle()};}

/* Panneau : « Reprendre » est proposé dans ce cas (seulement), avec la marche à suivre. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',onclick:null,oninput:null,
  attrs:{},style:{},classList:{toggle(){},add(){}},dataset:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},
  replaceChildren(){},append(el){this.enfants=(this.enfants||[]).concat(el);},addEventListener(){},querySelectorAll:()=>[],set onchange(_){}});
async function panneau(state){const elements=new Map(),crees=[];
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:()=>{const e=element();crees.push(e);return e;},
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),sendMessage:async({action})=>({result:action==='view'?state:action==='list-tabs'?[]:{}})}};
  const context={document,chrome,location:{hash:'#automatic'},addEventListener:()=>{},setInterval:()=>{},setTimeout:()=>{},clearTimeout:()=>{},console,Date,
    matchMedia:()=>({matches:true,addEventListener(){}}),requestAnimationFrame:()=>{}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../../panel.js'),'utf8'),context);
  for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));return {$:id=>document.getElementById(id),textes:()=>crees.map(e=>e.textContent).join(' | ')};}
const vueLot=(extra,autre={})=>({finDePartieProbable:!!extra?.departApresDiffere&&extra.departApresDiffere.operationId==='op-9056',current:{identity:{pageId:'p',part:15,cut:9056,shape:'U50',frameId:'f'}},deferIntent:{identity:{part:15,cut:9056},operationId:'op-9056',phase:'COMMAND_MAY_HAVE_BEEN_SENT',commandInvoked:'unknown'},...autre,
  batch:{state:'PAUSED_DEFER_NAVIGATION_UNCERTAIN',scope:{part:15,start:106,end:999999,endMode:'partie',geometryEngine:'geometry-candidate-v1'},
    processed:[],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],deferred:[],sequence:[],activeIdentity:{part:15,cut:9056},...extra}});
module.exports={L,pilote,BFCACHE,differe,quitte,quitteAvecReleve,releve,navs,dernierDiffere,panneau,vueLot};
