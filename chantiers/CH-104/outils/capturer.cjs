'use strict';
/* CH-104 : photographie du VRAI panneau dans les treize états de la maquette Graphite (huit d'Orbite, cinq de Constellation), aux deux tailles
 * et aux deux thèmes. Repris de l'outil de CH-101 (capturer2.cjs), étendu à la Constellation. Données fabriquées, API Chrome simulée, rien n'est envoyé à ESV.
 * Usage : CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-104/outils/capturer.cjs DOSSIER_HORS_DEPOT [filtre]
 * Les images ne vont JAMAIS dans le dépôt (interdit de CLAUDE.md). Écrit aussi DOSSIER/mesures.json : débordements, troncatures, contrastes. */
const path=require('node:path'),fs=require('node:fs');
const R=path.resolve(__dirname,'../../..');
const navigateur=require(R+'/tests/esv-maquette/navigateur.cjs'),{ouvrirPanneau}=require(R+'/tests/helpers/panneau-local.cjs');
const N=require(R+'/tools/ui5-navigateur.cjs');
const SORTIE=process.argv[2],FILTRE=process.argv[3]||'';
if(!SORTIE){console.error('Dossier de sortie (hors dépôt) attendu.');process.exit(2);}
fs.mkdirSync(SORTIE,{recursive:true});
const VERTS=new Set([4793,4799,4800,4806,4815,4816,4824,4833,4841,4842,4850,4858,4866,4871,4880,4888,4889,4895]),DIF=[4796,4803,4809,4838,4861,4877];
const id=(c,p=13)=>({part:p,cut:c});
const listes=(jusqua,p=13,de=4790)=>{const P=[],d=[];for(let n=de;n<=jusqua;n++){if(VERTS.has(n))continue;if(DIF.includes(n))d.push({identity:id(n,p),cut:n,deferredAt:'2026-11-10T09:0'+(n%10)+':00Z',unresolvedRails:n%2?['left']:['left','right']});else P.push({identity:id(n,p),cut:n,durationMs:6200+((n*37)%23)*100});}return {processed:P,deferred:d};};
const lot=(etat,jusqua,extra={})=>{const L=listes(jusqua);const seq=[...L.processed,...L.deferred].map(x=>({identity:x.identity,cut:x.cut})).sort((a,b)=>a.cut-b.cut);if(jusqua<4900)seq.push({identity:id(jusqua+1),cut:jusqua+1});return N.lot(etat,{...L,sequence:seq,...extra});};
const fin=()=>lot('COMPLETED',4900,{activeIdentity:null});
const finRel=fin();finRel.batch.scope={...finRel.batch.scope,relecture:'corriger'};
const repos={current:{identity:id(4790)},busy:false,manual:{status:'IDLE'},native:{status:'IDLE',visits:[],incomplete:[]},batch:null};
/* Constellation : cinq parties (13 à 17), comme la maquette. Le lot de la partie 14 part du début et va à la fin de la partie : son total est connu (fiche de départ). */
const partie=(part,rang,poses,differes,corriges,motifs=['fin-normale'])=>({part,rang,issueLot:'fin',motifs,resume:{poses,differes},passe:null,relecture:{issue:'finie',corriges},alertes:[]});
const BILAN=[partie(13,0,87,6,3),partie(14,1,92,4,2),partie(15,2,78,9,5),partie(16,3,101,3,1),partie(17,4,64,5,3,['nombre-atteint'])];
const vue=(etat,o={})=>({id:'file-1',etat,n:5,plan:[13,14,15,16,17],rang:0,enCours:null,changement:null,bilan:[],motifFin:null,alerte:null,reprises:0,...o});
const lot14=(()=>{const P=[];for(let n=0;n<41;n++)P.push({identity:id(n*2,14),cut:n*2,durationMs:6400+((n*31)%19)*100});
 return {current:{identity:id(82,14)},busy:false,manual:{status:'IDLE'},native:{status:'IDLE',visits:[],incomplete:[]},
  batch:{id:'lot-14',state:'RUNNING',step:'apply',scope:{part:14,start:0,end:999999,endMode:'partie',geometryEngine:'geometry-candidate-v1',unresolvedPolicy:'defer',lowConfidence:'attempt',lotDecision:'apply'},
   processed:P,deferred:[],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:[...P.map(x=>({identity:x.identity,cut:x.cut})),{identity:id(82,14),cut:82}],activeIdentity:id(82,14),lotCommands:{},cutStartedAt:'MAINTENANT-3'}};})();
const clos=p=>({current:{identity:id(0,p)},busy:false,manual:{status:'IDLE'},native:{status:'IDLE',visits:[],incomplete:[]},batch:null});
const FICHES=[[13,'2026-11-10T08:12:00Z',96],[14,'2026-11-10T08:41:00Z',96],[15,'2026-11-10T09:08:00Z',87],[16,'2026-11-10T09:37:00Z',104],[17,'2026-11-10T10:02:00Z',69]]
 .map(([p,at,inv])=>({batchId:'lot-'+p,partie:p,at,valides:1200+p*7,invalides:inv,ignores:p%3,total:1200+p*7+inv+p%3}));
const E={
 pret:{state:repos},
 cours:{state:lot('RUNNING',4811,{cutStartedAt:'MAINTENANT-3'})},
 pause:{state:lot('PAUSED',4811,{pausedAt:'MAINTENANT-104'})},
 toi:{state:lot('PAUSED_UNRESOLVED_RAIL',4811,{pauseReason:'unresolved-rail',step:'apply'})},
 panne:{state:lot('PAUSED_ADAPTER_UNRESPONSIVE',4811,{pauseReason:'adapter-unresponsive'})},
 rattrapage:{state:{...fin(),passeDifferes:{etat:'ecriture',mode:'ecriture',lotId:'lot-1',cut:4803,ecrites:1,demandees:3}}},
 relecture:{state:finRel,rel:{choix:'corriger',lot:{id:'lot-1'},passe:{lotId:'lot-1',etat:'en-cours',mode:'corriger',modeEffectif:'corriger',faits:12,total:85,corriges:3,cut:4801,reprise:true,pauseDemandee:false,pauseRaison:null,expire:null}}},
 fin:{state:fin()},
 'file-repos':{file:5,state:{...repos,fileParties:null}},
 'file-cours':{file:true,fiches:FICHES.slice(0,2),state:{...lot14,fileParties:vue('lot',{rang:1,enCours:{part:14,rang:1,lot:true},bilan:BILAN.slice(0,1)})}},
 'file-passage':{file:true,fiches:FICHES.slice(0,2),state:{...clos(14),fileParties:vue('changement',{rang:1,changement:{vers:15,tentatives:1},bilan:BILAN.slice(0,2)})}},
 'file-arret':{file:true,fiches:FICHES.slice(0,3),state:{...clos(15),fileParties:vue('arret',{rang:2,bilan:[...BILAN.slice(0,2),{...partie(15,2,31,2,null,['operateur']),interrompue:true,relecture:null}],motifFin:{code:'operateur',texte:'arrêtée par l’opérateur'},reprise:{rang:2,part:15,reste:3}})}},
 'file-fin':{file:true,fiches:FICHES,state:{...clos(17),fileParties:vue('fin',{rang:5,bilan:BILAN})}},
 /* la chaîne doit tenir de 1 à 8 parties */
 'file-1':{file:1,state:{...repos,fileParties:null}},
 'file-8':{file:true,fiches:FICHES,state:{...clos(17),fileParties:vue('lot',{n:8,plan:[113,114,115,116,117,118,119,120],rang:5,enCours:{part:118,rang:5,lot:true},bilan:BILAN.map((b,i)=>({...b,part:113+i}))})}},
};
/* Les autres écrans (la maquette ne les montre pas : ils reçoivent le même système). `actions` : les gestes de Signal joués avant la photo. */
const CL=require(R+'/src/correction-liste.js'),{journal}=require(R+'/tests/helpers/correction-journal.cjs');
const LC=CL.construire(journal({partie:13}),{partie:13});
const visite=(cut,label,fini=true)=>({visitId:'v'+cut,identity:id(cut),startedAt:'2026-10-31T10:10:00Z',...(fini?{endedAt:'2026-10-31T10:10:09Z'}:{}),label});
const corr=(etat,extra={})=>({id:'C1',etat,creeA:'2026-10-31T10:05:00Z',listes:[{batchId:'B1',partie:13,entrees:LC.entrees,comptes:LC.comptes}],...extra});
const cours=()=>lot('RUNNING',4811,{cutStartedAt:'MAINTENANT-3'});
const AUTRES={
 'cours-total':{fiches:FICHES.slice(1,2),state:lot14},
 echo:{hash:'#native',state:N.SCENARIOS.echo.state},
 aurore:{actions:['sg:onglet-correction'],state:{...fin(),current:{identity:id(15)},correction:corr('ouverte',{courant:{part:13,cut:15}}),native:{id:'n1',status:'RUNNING',correction:{id:'C1'},visits:[visite(14,'VALIDATE_NO_MOVEMENT'),visite(15,null,false)]}}},
 'aurore-vide':{actions:['sg:onglet-correction'],state:repos},
 menu:{actions:['sg:menu'],state:cours()},
 palette:{actions:['sg:palette'],state:cours()},
 reglages:{actions:['sg:reglages'],state:repos},
 esv:{actions:['sg:esv'],state:repos},
 tiroir:{actions:['sg:tiroir'],state:fin()},
 'boite-file':{actions:['sg:file'],state:{...repos,fileParties:null}},
 tech:{actions:['sg:tech'],state:fin()},
 origine:{origine:true,state:cours()},
 'origine-echo':{origine:true,hash:'#native',state:N.SCENARIOS.echo.state},
};
if(process.env.AUTRES!=='0')Object.assign(E,AUTRES);
const MESURE=()=>{
 const rgb=c=>{const s=String(c).match(/color\(srgb ([^)]+)\)/);if(s){const v=s[1].split(/[ \/]+/).filter(Boolean).map(Number);return {r:v[0]*255,g:v[1]*255,b:v[2]*255,a:v.length>3?v[3]:1};}const m=String(c).match(/rgba?\(([^)]+)\)/);if(!m)return null;const v=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return {r:v[0],g:v[1],b:v[2],a:v.length>3?v[3]:1};};
 const lum=({r,g,b})=>{const t=x=>{x/=255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4;};return .2126*t(r)+.7152*t(g)+.0722*t(b);};
 const fond=e=>{const pile=[];for(let x=e;x;x=x.parentElement){const c=rgb(getComputedStyle(x).backgroundColor);if(c&&c.a>0){pile.push(c);if(c.a>=1)break;}}
  let r=pile.pop()||{r:255,g:255,b:255,a:1};while(pile.length){const c=pile.pop();r={r:c.r*c.a+r.r*(1-c.a),g:c.g*c.a+r.g*(1-c.a),b:c.b*c.a+r.b*(1-c.a),a:1};}return r;};
 const P=document.querySelector('#ui5 .sg-fen'),out=[];if(!P)return ['PAS DE PANNEAU'];
 const W=document.documentElement.clientWidth,H=document.documentElement.clientHeight,nom=e=>(e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)||e.tagName;
 const defile=e=>{for(let x=e.parentElement;x&&x!==P;x=x.parentElement){const o=getComputedStyle(x).overflowY;if(o==='auto'||o==='scroll')return true;}return false;};
 const coupe=e=>{for(let x=e.parentElement;x&&x!==P;x=x.parentElement){const s=getComputedStyle(x);if(s.overflowY==='hidden'&&(s.maskImage&&s.maskImage!=='none'||s.webkitMaskImage&&s.webkitMaskImage!=='none'))return true;}return false;};
 if(document.documentElement.scrollWidth>W+1)out.push('PAGE DEFILE EN LARGEUR');
 for(const e of P.querySelectorAll('*')){if(!e.getClientRects().length)continue;const r=e.getBoundingClientRect();if(r.width<=1||r.height<=1)continue;if(e.closest('svg')||e.closest('[data-tourne]'))continue;
  if(r.right>W+.5||r.left<-.5)out.push('SORT '+nom(e)+' '+Math.round(r.right-W));
  if(r.bottom>H+.5&&!defile(e)&&!coupe(e))out.push('SORT EN BAS '+nom(e)+' '+Math.round(r.bottom-H));
  const s=getComputedStyle(e);
  if(e.scrollWidth>e.clientWidth+1&&s.overflowX!=='visible'&&s.textOverflow!=='ellipsis'&&!e.matches('.sg-registre,.sg-corps'))out.push('TRONQUE '+nom(e)+' « '+e.textContent.trim().slice(0,30)+' »');
  if(s.textOverflow==='ellipsis'&&e.scrollWidth>e.clientWidth+1)out.push('ELLIPSE '+nom(e)+' « '+e.textContent.trim().slice(0,30)+' »');
  if(e.disabled||e.closest('[disabled]')||e.closest('[inert]')||e.getAttribute('aria-hidden')==='true')continue;
  if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;if(Number(s.opacity)===0)continue;
  const c=rgb(s.color),f=fond(e);if(!c)continue;const k0={r:c.r*c.a+f.r*(1-c.a),g:c.g*c.a+f.g*(1-c.a),b:c.b*c.a+f.b*(1-c.a)};const [a,b2]=[lum(k0),lum(f)].sort((x,y)=>y-x);const k=(a+.05)/(b2+.05);
  if(k<4.5)out.push('CONTRASTE '+nom(e)+' « '+e.textContent.trim().slice(0,24)+' » '+k.toFixed(2));}
 return [...new Set(out)];};
(async()=>{
 const {chromium}=require(navigateur.modulePlaywright());const nav=await chromium.launch({executablePath:navigateur.executable()});const bilan={},mesures={};
 for(const theme of ['sombre','clair'])for(const [taille,vp] of [['600',{width:600,height:760}],['360',{width:360,height:480}]])for(const [nom,e] of Object.entries(E)){
  const cle=`${theme}-${taille}-${nom}`;if(FILTRE&&!cle.includes(FILTRE))continue;
  const ctx=await nav.newContext({viewport:vp,deviceScaleFactor:2});const page=await ctx.newPage();const erreurs=[];page.on('pageerror',x=>erreurs.push(x.message));
  const state=JSON.parse(JSON.stringify({connection:{status:'ready',observedAt:'t',message:null,tabId:1},...e.state}).replace(/"MAINTENANT-(\d+)"/g,(_,s)=>JSON.stringify(new Date(Date.now()-s*1000).toISOString())));
  await page.addInitScript(({state,rel,fiches})=>{
   const reponses={view:state,'list-tabs':[{id:1,title:'ESV',pret:true,utilise:true,index:0,windowId:1,active:true}],'choix-lot-etat':{clicHumain:'tel-quel',regleGrappeDifferes:false},'raison-choix-etat':{actif:false,touches:'chiffres'},
    'relecture-choix-etat':{mode:'corriger'},'relecture-etat':rel,'bandeau-etat':{on:false},'fiches-depart':{fiches}};
   const stockage={};
   window.fetch=async()=>({json:async()=>({totaux:{tous:{corriges:2731}},creeLe:'2026-10-20T08:00:00Z'})});
   window.chrome={runtime:{id:'essai',getURL:p=>new URL(p,location.href).href,connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async m=>({result:m.action in reponses?reponses[m.action]:{}})},
    storage:{local:{get:async()=>({...stockage}),set:async o=>{Object.assign(stockage,o);}}},windows:{getCurrent:async()=>({id:1,type:'normal',width:600,height:760}),update:async()=>({})}};
  },{state,rel:e.rel||{choix:'corriger',lot:null,passe:null},fiches:e.fiches||[]});
  await ouvrirPanneau(page,e.hash||'#automatic');await page.waitForTimeout(1300);
  for(const a of e.actions||[]){await page.evaluate(a=>window.ArianeUi5.agir(a),a);await page.waitForTimeout(300);}
  if(e.file){await page.evaluate(()=>window.ArianeUi5.agir('sg:onglet-file'));await page.waitForTimeout(300);
   if(typeof e.file==='number'){await page.evaluate(n=>window.ArianeUi5.agir('sg:file-n:'+n),e.file);await page.waitForTimeout(1200);}}
  /* le panneau d'origine, tel qu'il revient en secours : Signal caché */
  if(e.origine&&theme==='clair'){await page.evaluate(()=>window.ArianeUi5.agir('sg:choix:theme:clair'));await page.waitForTimeout(500);}
  if(e.origine){await page.evaluate(()=>{document.body.classList.remove('ui5');document.getElementById('ui5').hidden=true;});await page.waitForTimeout(300);}
  if(theme==='clair'&&!e.origine){await page.evaluate(()=>window.ArianeUi5.agir('sg:choix:theme:clair'));await page.waitForFunction(()=>document.getElementById('ui5').dataset.theme==='clair',null,{timeout:4000});}
  await page.waitForTimeout(900);
  await page.screenshot({path:path.join(SORTIE,`${cle}.png`)});
  mesures[cle]=[...erreurs.map(x=>'ERREUR '+x),...(e.origine?[]:await page.evaluate(MESURE))];
  if(theme==='sombre')bilan[`${taille}/${nom}`]=await page.evaluate(()=>(document.querySelector('#ui5 .sg-fen')?.innerText||'').replace(/\n+/g,' | ').slice(0,600));
  await ctx.close();
 }
 await nav.close();
 fs.writeFileSync(path.join(SORTIE,'mesures.json'),JSON.stringify(mesures,null,1));
 for(const [k,v] of Object.entries(bilan))console.log(k,'\n  ',v);
 let n=0;for(const [k,v] of Object.entries(mesures))if(v.length){n+=v.length;console.log('== '+k+'\n  '+v.join('\n  '));}
 console.log(n?`${n} défaut(s) mesuré(s)`:'Mesures : aucun débordement, aucune troncature, aucun contraste sous 4,5:1');
})().catch(e=>{console.error(e);process.exit(1);});
