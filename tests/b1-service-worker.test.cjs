'use strict';
/* B1 (D-095) : voisins de la liste d'ESV, SERVICE WORKER RÉEL en VM (background.js et
 * tous ses scripts, moteur et GCV1 réels), ESV simulé, observateur RÉEL de la page
 * (src/esv-observer.js sur la fausse page). Le pont (src/bridge.js) est essayé à part
 * (tests/b1-pont.test.cjs) ; ici la demande du service worker est remise telle quelle
 * à l'observateur. Données synthétiques.
 *
 * Le simulateur pose tous les cuts au même endroit de la scène : la liste est donc
 * relue, à chaque capture, avec la voie CENTRÉE sur le cut capturé (ligne N = pose de
 * départ d'ESV + T ; voisines à ±1 m par cut le long de la voie, sur la pose posée
 * par Ariane au premier lot, éventuellement décalées latéralement). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const {production,normalize}=require('./helpers/perf-production.cjs'),{world,tick,ORIGIN}=require('./helpers/fake-page.cjs'),{SimulatedESV,base}=require('./fixtures.cjs');
const C=require('../vendor/capture-core.js');
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

test('ombre : repère calibré par la première écriture de validation, indice et géométrie d’accord, voisins comptés ; rien d’absolu consigné',{timeout:60000},async()=>{
  const s=montage();await lot(s,100,102);const e=evts(s.b);
  assert.equal(e.length,3,'un événement par décision');
  assert.equal(e[0].etat,'sans-repere','premier cut : aucune validation encore, aucun voisin');assert.equal(s.demandes.length>=1,true);
  const c=e.filter(x=>x.etat==='calcule');assert.ok(c.length>=2,'les cuts suivants : calculés ('+e.map(x=>x.etat).join(',')+')');
  for(const x of c){deq([x.appariement.ok,x.appariement.indiceGeo,x.appariement.ecartIndice],[true,x.identity.cut,0]);assert.ok(x.appariement.geoMm<1,'pose de départ + T = ligne N');
    assert.ok(Math.round(x.appariement.secondMm)>=990,'ligne suivante à 1 m');deq(x.candidats,[-5,-4,-3,-2,-1,1,2,3,4,5].map(k=>x.identity.cut+k));
    assert.equal(x.gardes.length,10);assert.equal(x.regle,'inchange','premier passage déjà gardé par la voie du lot');assert.equal(x.changement,'aucun');
    const pairs=[-5,-4,-3,-2,-1,1,2,3,4,5].filter(k=>(x.identity.cut+k)%2===0).length;
    deq([x.repere.etat,x.repere.ecartMaxMm,x.table.debut,x.fenetre.valid,x.fenetre.operateur],['calibre',0,true,10,pairs]);assert.equal(x.mode,'ombre');}
  assert.ok(c.at(-1).repere.paires>=2,'les écritures suivantes contrôlent T : '+c.at(-1).repere.paires);
  const texte=JSON.stringify(e);assert.ok(!/\b(912345|6612345|512\.125)/.test(texte),'ni T ni position absolue');assert.ok(!texte.includes('RK-')&&!texte.includes(TABLE),'ni clé de ligne ni table');
  assert.ok(e.every(x=>x.batchId===s.b.get('engine').s.batch.id&&x.schema===1));
  const w=s.b.store.events.filter(x=>x.type==='esv-observation'&&x.kind==='write');assert.ok(w.length>=2&&w.every(x=>x.rowIndex>=100&&x.rowIndex<=102),'indice de ligne rangé avec l’écriture');
});

test('ombre : mêmes commandes, mêmes poses, mêmes enregistrements qu’avec le réglage coupé ; premier passage sans voie gardé en hypothèse seulement',{timeout:60000},async()=>{
  async function deroule(mode){const s=montage({mode,decalageMm:100});await lot(s,100,101);await lot(s,110,110,{vider:false});return s;}
  const a=await deroule('off'),c=await deroule('ombre');
  deq(normalize(c.b.commands),normalize(a.b.commands),'mêmes commandes ESV, même ordre');deq(normalize(c.adapter.rails),normalize(a.adapter.rails));deq(c.adapter.calls,a.adapter.calls);
  const rec=b=>b.store.records.map(r=>[r.identity?.cut,r.status,r.validationProof??null,r.commandSent??null]);deq(rec(c.b),rec(a.b));
  const metier=b=>b.store.events.filter(e=>!['b1-ombre','esv-observation','phase-timing'].includes(e.type)).map(e=>e.type);deq(metier(c.b),metier(a.b),'mêmes événements métier');
  assert.equal(evts(a.b).length,0,'réglage coupé : aucun calcul, aucune demande');assert.equal(a.demandes.length,0);
  const lo=c.b.store.events.filter(e=>e.type==='gcv1-shadow-observed'&&e.identity?.cut===110).at(-1).lotObservation;
  deq([lo.stage,lo.anchorsUsed,lo.appuisListe],['first-pass',[],undefined],'décision réelle : premier passage sans appui, inchangée');
  /* L'hypothèse lourde (reprise depuis la voie) attend que la page travaille : capture suivante, ou 4 s. */
  assert.equal(evts(c.b).find(x=>x.identity.cut===110),undefined,'pas encore conclue');assert.equal(c.b.get('b1File').length,1);
  c.b.get('b1Vider')();await new Promise(r=>setTimeout(r,10));
  const h=evts(c.b).find(x=>x.identity.cut===110);
  deq([h.etat,h.regle,h.hypothese.stage,h.hypothese.guardMm>=95,h.changement],['calcule','garde-premier-passage','deferred',true,'pose-retiree'],'hypothèse : voisins à 100 mm, la garde retire la paire');
  assert.ok(c.adapter.calls.includes('validate')&&!c.adapter.calls.includes('nextWithoutDecision'),'le cut est validé comme aujourd’hui');
});

test('actif : la même hypothèse devient la décision (différé), et seulement sur la règle d’emploi',{timeout:60000},async()=>{
  const s=montage({mode:'actif',decalageMm:100});await lot(s,100,101);await lot(s,110,111);
  const lo=s.b.store.events.filter(e=>e.type==='gcv1-shadow-observed'&&e.identity?.cut===110).at(-1).lotObservation;
  deq([lo.stage,lo.guardDeferred,lo.appuisListe.regle,lo.command.action],['deferred',true,'garde-premier-passage','defer']);
  assert.ok(s.adapter.calls.includes('nextWithoutDecision'),'cut différé par Orbite');
  const l101=s.b.store.events.filter(e=>e.type==='gcv1-shadow-observed'&&e.identity?.cut===101).at(-1).lotObservation;
  deq([l101.stage,l101.anchorsUsed,l101.appuisListe],['first-pass',[100],undefined],'premier passage déjà gardé par la voie du lot : décision inchangée');
});
test('actif, voisins sur la voie : le premier passage sans appui est confirmé et posé comme aujourd’hui',{timeout:60000},async()=>{
  const sans=montage({mode:'actif',decalageMm:0});await lot(sans,100,101);await lot(sans,110,110);
  const l2=sans.b.store.events.filter(e=>e.type==='gcv1-shadow-observed'&&e.identity?.cut===110).at(-1).lotObservation;
  deq([l2.stage,l2.command.action,l2.validatedAnchors.length>=3],['first-pass','engine',true],'voisins sur la voie : premier passage confirmé, posé');
});

test('page muette, repère instable, réponse non fiable : aucun voisin, décision réelle intacte',{timeout:60000},async()=>{
  const s=montage();await lot(s,100,101);
  const envoyer=s.b.ctx.chrome.tabs.sendMessage;
  s.b.ctx.chrome.tabs.sendMessage=async(id,m)=>m.kind==='b1-voisins'?new Promise(()=>{}):envoyer(id,m);await lot(s,103,103);await new Promise(r=>setTimeout(r,700));s.b.get('b1Vider')();
  assert.equal(evts(s.b).filter(x=>x.identity.cut>=103).every(x=>x.etat==='page'&&x.raison==='delai'),true,'délai de 600 ms, sans attendre plus');
  s.b.ctx.chrome.tabs.sendMessage=async(id,m)=>m.kind==='b1-voisins'?{ok:true,geo:{index:'x'},rows:[{i:1e9,s:'valid',e:[1,2,3,4,5,6]}],table:{debut:true}}:envoyer(id,m);await lot(s,105,105);
  deq(evts(s.b).filter(x=>x.identity.cut===105).map(x=>[x.etat,x.appariement.raison,x.candidats]),[['desaccord','sans-geometrie',[]]]);
  s.b.get('b1').repere.etat='instable';await lot(s,106,106);assert.equal(evts(s.b).find(x=>x.identity.cut===106).etat,'repere-instable');
  const l=s.b.store.events.filter(e=>e.type==='gcv1-shadow-observed'&&e.identity?.cut>=103).map(e=>e.lotObservation.stage);assert.ok(l.length===3&&l.every(x=>x==='first-pass'),'décisions réelles : '+l);
});
