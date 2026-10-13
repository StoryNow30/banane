'use strict';
/* B1 (D-095) — montage partagé des essais du SERVICE WORKER RÉEL en VM (background.js et
 * tous ses scripts, moteur et GCV1 réels), ESV simulé, observateur RÉEL de la page
 * (src/esv-observer.js sur la fausse page). Le pont (src/bridge.js) est essayé à part
 * (tests/b1-pont.test.cjs) ; ici la demande du service worker est remise telle quelle
 * à l'observateur. Données synthétiques. Chaque cut coûte environ 1,3 s (GCV1 réel) :
 * les essais sont répartis en trois fichiers, chacun bien sous les 20 s de verify.
 *
 * Le simulateur pose tous les cuts au même endroit de la scène : la liste est donc
 * relue, à chaque capture, avec la voie CENTRÉE sur le cut capturé (ligne N = pose de
 * départ d'ESV + T ; voisines à ±1 m par cut le long de la voie, sur la pose posée
 * par Ariane au premier lot, éventuellement décalées latéralement). */
const assert=require('node:assert/strict');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const {production,normalize}=require('./perf-production.cjs'),{world,tick,ORIGIN}=require('./fake-page.cjs'),{SimulatedESV,base}=require('../fixtures.cjs');
const C=require('../../vendor/capture-core.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const T=[912345.5,6612345.25,512.125],TABLE='traj__00+0000100.000',LISTE=ORIGIN+'/api/u3d/projects/p-key/rails/'+TABLE;
const P=base.rails.left.profileLocalToSceneRelative,o=C.point(P,[0,0,0]),axe=k=>C.point(P,k).map((v,i)=>v-o[i]);
const LONG=axe([1,0,0]),LAT=axe([0,1,0]),plus=(...v)=>v.reduce((a,b)=>a.map((x,i)=>x+b[i]));
const rk=i=>'RK-'+String(i).padStart(8,'0');

function montage({mode='ombre',decalageMm=0}={}){
  const adapter=new SimulatedESV(),b=production({adapter});b.ctx.BananeSettings={...b.ctx.BananeSettings,appuisListe:mode};
  const page=world({routes:(m,u)=>m==='PUT'?{status:204,text:''}:{status:200,text:page.liste}});
  const s={b,adapter,page,valide:null,attente:[],demandes:[]};
  /* Liste relue autour du cut N : ligne N = pose de départ d'ESV (+T) ; les autres, la voie validée (+T), à (i−N) m. */
  s.relire=async N=>{const ligne=i=>{const p=side=>i===N?plus(base.rails[side].positionSceneRelative,T)
      :plus((s.valide||{left:base.rails.left.positionSceneRelative,right:base.rails.right.positionSceneRelative})[side],T,LONG.map(v=>v*(i-N)),LAT.map(v=>v*decalageMm/1000));const l=p('left'),r=p('right');
      return {RowKey:rk(i),ExtractionStatus:i===N?'invalid':'valid',TreatedByOperator:i%2===0,SeenByOperator:true,XLeftEdge:l[0],YLeftEdge:l[1],ZLeftEdge:l[2],XRightEdge:r[0],YRightEdge:r[1],ZRightEdge:r[2]};};
    page.liste=JSON.stringify({value:Array.from({length:N+30},(_,i)=>ligne(i))});const x=new page.win.XMLHttpRequest();x.open('GET',LISTE);x.send();await tick();await tick();page.runTimers();};
  /* Écriture de validation d'ESV : corps = pose appliquée (monde) ; l'observateur en note l'indice de ligne. */
  const valider=adapter.validateAndNext.bind(adapter);
  adapter.validateAndNext=async function(...a){const r=this.rails,w=side=>plus(r[side].positionSceneRelative,T),l=w('left'),d=w('right');
    const x=new page.win.XMLHttpRequest();x.open('PUT',LISTE+'/'+rk(this.identity.cut)+'?merge=true');
    x.send(JSON.stringify({ExtractionStatus:'valid',SeenByOperator:true,TreatedByOperator:true,RailType:'U50',RailOrientationLeft:2.87,RailOrientationRight:-2.87,
      XLeftEdge:l[0],YLeftEdge:l[1],ZLeftEdge:l[2],XRightEdge:d[0],YRightEdge:d[1],ZRightEdge:d[2]}));
    await tick();await tick();page.runTimers();s.attente.push(...page.observed().filter(e=>e.kind==='write'&&!s.attente.includes(e)&&!s.remis?.has(e.seq)));return valider(...a);};
  /* Pose validée par Ariane (tous les cuts du simulateur ont la même) : la voie des voisines. */
  s.prendreValide=()=>{if(s.valide)return;const r=b.get('engine').s.records.find(r=>r.rails?.left?.corrected);
    if(r)s.valide={left:r.rails.left.corrected.positionSceneRelative,right:r.rails.right.corrected.positionSceneRelative};};
  /* Le pont relaie les observations (lot d'entrées) au service worker avant la capture suivante ; la liste est relue
   * autour du cut capturé. */
  s.remis=new Set();const capturer=adapter.capture.bind(adapter);
  adapter.capture=async function(...a){const e=s.attente.splice(0);for(const x of e)s.remis.add(x.seq);if(e.length)b.raw({kind:'esv-observation',observer:'obs-b1',entries:plat(e)});
    s.prendreValide();await s.relire(this.identity.cut);return capturer(...a);};
  /* Demande du service worker → observateur de la page (ce que fait le pont). */
  const envoyer=b.ctx.chrome.tabs.sendMessage;
  b.ctx.chrome.tabs.sendMessage=async(id,m)=>{if(m.kind!=='b1-voisins')return envoyer(id,m);s.demandes.push(plat(m));
    page.posts.length=0;page.deliver({kind:'banane5:voisins',id:'q'+s.demandes.length,cut:m.cut,fenetre:m.fenetre,world:m.world});
    return plat(page.posts.map(p=>p.m).find(x=>x?.kind==='banane5:voisins-reponse'));};
  return s;
}
const evts=b=>b.store.events.filter(e=>e.type==='b1-ombre');
const attendre=async(b,vider=true)=>{await new Promise(r=>setTimeout(r,30));if(vider)b.get('b1Vider')();await new Promise(r=>setTimeout(r,10));};
async function lot(s,start,end,{vider=true}={}){const {b}=s;if(!s.connecte){await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});s.connecte=true;}
  s.adapter.identity.cut=start;s.adapter.rails=JSON.parse(JSON.stringify(base.rails));await b.api('start',{part:23,start,end,...SCOPE});const v=await b.settle();await attendre(b,vider);
  return v;}

/* Pose qu'Ariane donne au cut du simulateur (premier passage, réglage coupé) : la voie des voisines. */
async function voieAriane(){const s=montage({mode:'off'});await lot(s,100,100);
  const p=s.b.store.events.filter(e=>e.type==='gcv1-shadow-observed').at(-1).lotObservation.positions;return {left:[...p.left],right:[...p.right]};}
/* Repère déjà calibré (la calibration elle-même est essayée dans tests/b1-sw-repere.test.cjs). */
function prerégler(s,voie){s.valide=voie;s.b.get('b1').repere={frameId:'fixture-frame',T:[...T],paires:1,ecartMaxMm:0,refusees:0,etat:'calibre'};}
module.exports={montage,lot,evts,attendre,voieAriane,prerégler,plat,deq,normalize,T,TABLE};
