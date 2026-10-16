'use strict';
/* 4.9.5.3 (S6) — relevés en LECTURE SEULE de l'adaptateur de la page ESV : profondeur des nœuds et budget de points dans le `diag` de
 * `capture-read`, compteur Potree bloqué, empreinte du contrat, écouteurs jQuery en ombre. Page simulée (tests/helpers/page.cjs), données
 * synthétiques. Garanties : les gestionnaires d'ESV passent comme avant (mêmes arguments, mêmes retours, même ordre, aucune exception) ;
 * le chemin `goToCut` ne prend pas notre écouteur pour un écouteur d'ESV ; aucun relevé n'envoie de commande. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs'),F=require('./v242/fixtures.cjs'),L=require('../vendor/lidar.js'),S=require('../src/settings.js');

function lidarPage(cut,{globals={},niveaux=[[0,0,0],[3,3]]}={}){
 const f=page({globals}),pc=F.object([0,0,0],'PointCloudOctree'),n=F.object([0,0,0],'Points'),n2=F.object([0,0,0],'Points');
 n.geometry={attributes:{position:F.buffer([[0,.01,.01],[0,1.425,.01]])}};n2.geometry={attributes:{position:F.buffer([[0,.02,.01],[0,1.426,.01]])}};
 pc.material={clipBoxes:[],clipTask:0,clipMethod:0};
 pc.visibleNodes=[{sceneNode:n,geometryNode:{level:2,name:'r04'}},{sceneNode:n2,geometryNode:{name:'r012'}}];
 f.ctx.viewer.scene.pointclouds=[pc];f.ctx.Potree=F.enums;f.nodes.get('O2N3DCutDescription').textContent=`Cut ${cut} of part 23`;f.ctx.BananeLidar.capture=opts=>L.capture(opts);
 return f;}
/* Les objets venus du contexte simulé (vm) n'ont pas les prototypes de ce fichier : comparés après copie JSON. */
const plat=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const evenements=f=>{const evts=[],orig=f.ctx.postMessage;f.ctx.postMessage=m=>{if(m&&m.kind==='banane5:evt')evts.push(plat(m.event));else orig(m);};return evts;};

test('diag de capture-read : niveau des nœuds [min, médiane, max, connus, total] et budget de points du lecteur (null si absent)', async () => {
 const f=lidarPage(100);f.ctx.viewer.getPointBudget=()=>2000000;
 await f.call('capture',await f.call('state'));
 const d=plat(f.progress.find(p=>p.stage==='capture-read').detail.diag);
 assert.deepEqual(d.niv,[2,2,3,2,2],'niveau 2 (geometryNode.level) et 3 (nom r012 : longueur − 1)');assert.equal(d.bud,2000000);
 const g=lidarPage(100);await g.call('capture',await g.call('state'));
 assert.equal(g.progress.find(p=>p.stage==='capture-read').detail.diag.bud,null,'budget absent : null, jamais zéro ni deviné');
 /* Budget lu par la propriété du lecteur si la fonction manque ; valeur illisible : null. */
 const h=lidarPage(100);h.ctx.viewer.pointBudget=1500000;await h.call('capture',await h.call('state'));assert.equal(h.progress.find(p=>p.stage==='capture-read').detail.diag.bud,1500000);
 const i=lidarPage(100);i.ctx.viewer.getPointBudget=()=>{throw Error('absent');};await i.call('capture',await i.call('state'));assert.equal(i.progress.find(p=>p.stage==='capture-read').detail.diag.bud,null);
});

test('diag : niveau illisible = null ; relevé coupé (releves.diagCapture) : ni niv ni bud ; la lecture est la même', async () => {
 const f=lidarPage(100);f.ctx.viewer.scene.pointclouds[0].visibleNodes.forEach(v=>{v.geometryNode={};});
 await f.call('capture',await f.call('state'));
 assert.deepEqual(plat(f.progress.find(p=>p.stage==='capture-read').detail.diag.niv),[null,null,null,0,2]);
 const sans=lidarPage(100,{globals:{BananeSettings:{...S,releves:{...S.releves,diagCapture:false}}}});const a=await sans.call('capture',await sans.call('state'));
 const d=sans.progress.find(p=>p.stage==='capture-read').detail.diag;assert.ok(!('niv' in d)&&!('bud' in d));
 const avec=lidarPage(100);const b=await avec.call('capture',await avec.call('state'));
 assert.deepEqual(a.pointsSceneRelative,b.pointsSceneRelative,'mêmes points lus avec et sans le relevé');
});

test('compteur Potree bloqué : même valeur > 0 au début de 3 cuts de suite = un événement par épisode', async () => {
 const f=page({globals:{performance:{now:()=>4321.06}}}),evts=evenements(f);f.ctx.Potree={numNodesLoading:2};
 const debut=async(cut,nl)=>{f.ctx.Potree.numNodesLoading=nl;f.nodes.get('O2N3DCutDescription').textContent=`Cut ${cut} of part 23`;await f.call('capture',{}).catch(()=>{});};
 await debut(10,2);await debut(10,2);await debut(11,2);assert.equal(evts.length,0,'deux cuts, et un cut relu une seconde fois : pas trois cuts');
 await debut(12,2);assert.equal(evts.length,1);assert.deepEqual(evts[0],{kind:'diag-compteur-bloque',valeur:2,cuts:3,cut:12,pageMs:4321.06});
 await debut(13,2);await debut(14,2);assert.equal(evts.length,1,'un seul événement par épisode');
 await debut(15,0);await debut(16,3);await debut(17,3);assert.equal(evts.length,1,'retombé à 0 : épisode fini, la série repart');
 await debut(18,3);assert.equal(evts.length,2);assert.equal(evts[1].valeur,3);
 await debut(19,4);await debut(20,3);await debut(21,3);assert.equal(evts.length,2,'valeurs différentes : pas bloqué');
 const sans=page({globals:{BananeSettings:{...S,releves:{...S.releves,compteurBloque:{actif:false,cuts:3}}}}}),e2=evenements(sans);sans.ctx.Potree={numNodesLoading:2};
 for(const c of [1,2,3,4]){sans.nodes.get('O2N3DCutDescription').textContent=`Cut ${c} of part 23`;await sans.call('capture',{}).catch(()=>{});}
 assert.equal(e2.length,0,'relevé coupé');
});

/* jQuery simulé : `on` (types et espaces de noms), `_data(el,'events')`, `trigger` qui appelle les gestionnaires dans l'ordre, retour `false` = propagation arrêtée. */
function faussejQuery(el){const events={};
 const $=target=>({on(types,fn){for(const t of types.split(/\s+/)){const [type,...ns]=t.split('.');(events[type]=events[type]||[]).push({handler:fn,namespace:ns.sort().join('.')});}return this;}});
 $._data=(t,k)=>t===el?(k==='events'?events:undefined):undefined;$.fn={jquery:'3.6.0'};
 $.trigger=(type,...args)=>{const rets=[];let arret=false;for(const h of events[type]||[]){const r=h.handler.call(el,{type},...args);rets.push(r);if(r===false){arret=true;break;}}return {rets,arret};};
 return {$,events};}

test('écouteurs jQuery en ombre : les gestionnaires d\'ESV passent comme avant ; l\'événement est consigné avec des arguments réduits', async () => {
 const f=page({globals:{performance:{now:()=>77.77}}}),evts=evenements(f),el={},{$,events}=faussejQuery(el);
 f.ctx.$=$;f.ctx.document.getElementById=(old=>id=>id==='globalcontainer'?el:old(id))(f.ctx.document.getElementById);
 const vus=[];for(const t of S.esvEvents.noms)$(el).on(t,(ev,...a)=>{vus.push([ev.type,a]);return t==='railPairSeen'?'valeur-ESV':undefined;});
 const avant=JSON.stringify(Object.fromEntries(Object.entries(events).map(([k,v])=>[k,v.length])));
 await f.call('ping');
 assert.equal(JSON.stringify(Object.fromEntries(Object.entries(events).map(([k,v])=>[k,v.length-1]))),avant,'un écouteur de plus par événement, après ceux d\'ESV');
 assert.ok(S.esvEvents.noms.every(n=>events[n].at(-1).namespace==='banane53'&&events[n].slice(0,-1).every(h=>h.namespace==='')));
 const r=$.trigger('railPairSelected','23',1234,{x:1},[2]);
 assert.deepEqual(plat(vus),[['railPairSelected',['23',1234,{x:1},[2]]]],'ESV reçoit les arguments tels quels');
 assert.deepEqual(plat(r.rets.map(x=>x===undefined?'u':x)),['u','u'],'rien n\'est retourné par notre écouteur');assert.equal(r.arret,false);
 assert.deepEqual($.trigger('railPairSeen',1,2).rets,['valeur-ESV',undefined]);
 assert.deepEqual(evts.map(e=>[e.kind,e.nom,e.args,e.pageMs]),[['esv-event','railPairSelected',['23',1234,null,null],77.77],['esv-event','railPairSeen',[1,2],77.77]]);
 await f.call('ping');await f.call('ping');assert.equal(events.railPairSelected.length,2,'posé une seule fois');
});

test('écouteur en ombre : panne de la page ou du relevé jamais propagée ; au plus 30 événements par seconde, le reste compté', async () => {
 const f=page(),el={},{$,events}=faussejQuery(el);f.ctx.$=$;f.ctx.document.getElementById=(old=>id=>id==='globalcontainer'?el:old(id))(f.ctx.document.getElementById);
 const evts=evenements(f);await f.call('ping');
 for(let i=0;i<45;i++)$.trigger('loading',i);
 assert.equal(evts.length,30,'plafond par seconde');
 f.advance(1100);$.trigger('loading',99);assert.equal(evts.length,31);assert.equal(evts.at(-1).perdus,15,'les événements perdus sont comptés');
 f.ctx.postMessage=()=>{throw Error('page en panne');};
 assert.doesNotThrow(()=>$.trigger('loading',100));
 assert.equal(events.loading.length,1,'toujours un seul écouteur');
 /* Réglage coupé : aucun écouteur posé. */
 const g=page({globals:{BananeSettings:{...S,esvEvents:{...S.esvEvents,ombre:false}}}}),e2={},j2=faussejQuery(e2);g.ctx.$=j2.$;g.ctx.document.getElementById=(old=>id=>id==='globalcontainer'?e2:old(id))(g.ctx.document.getElementById);
 await g.call('ping');assert.deepEqual(Object.keys(j2.events),[]);
 /* jQuery absent, conteneur absent, jQuery sans `on` : aucune exception. */
 const h=page();await h.call('ping');const k=page(),e3={};k.ctx.$=()=>({});k.ctx.$._data=()=>({});k.ctx.document.getElementById=(old=>id=>id==='globalcontainer'?e3:old(id))(k.ctx.document.getElementById);await k.call('ping');
});

test('goToCut : notre écouteur en ombre n\'est pas pris pour un écouteur d\'ESV (le chemin « événement » reste indisponible sans écouteur d\'ESV)', async () => {
 const chemin=async(avecESV)=>{const f=page(),el={},{$,events}=faussejQuery(el);f.ctx.$=$;f.ctx.document.getElementById=(old=>id=>id==='globalcontainer'?el:old(id))(f.ctx.document.getElementById);
  if(avecESV)$(el).on('railPairSelected',()=>{});
  await f.call('ping');
  assert.ok(events.railPairSelected.some(h=>h.namespace==='banane53'),'l\'écouteur en ombre est posé');
  const e=await f.call('goToCut',{part:23,cut:105},{chemin:'evenement',borneConnue:200});
  return plat(e.cheminEvenement);};
 assert.deepEqual(await chemin(false),{disponible:false,raison:'sans-ecouteur'});
 assert.equal((await chemin(true)).disponible,true);
});

test('empreinte du contrat : demandée au « Connecter » seulement ; stable ; change avec un bouton absent, une classe, un écouteur d\'ESV absent, jQuery ou Potree ; nos écouteurs exclus (4.9.5.4 : ni libellés ni nombres, voir contrat-par-onglet-4954)', async () => {
 const monter=(opt={})=>{const f=page({globals:opt.globals}),el={},{$,events}=faussejQuery(el);f.ctx.$=$;if(opt.jq)$.fn.jquery=opt.jq;
  const boutons=[['O2N3DCutPreviousInvalid3DRail','Previous invalid'],['O2N3DCutPrevious3DRail','Previous'],['O2N3DCutValidate3DRail','Validate'],['O2N3DCutSkip3DRail','Skip'],['O2N3DCutNext3DRail','Next'],['O2N3DCutNextInvalid3DRail','Next invalid']]
   .map(([id,title])=>({id,title:opt.titre&&id==='O2N3DCutSkip3DRail'?opt.titre:title}));
  f.ctx.document.querySelectorAll=()=>[...boutons,{id:'O2N3DCutLRClick',title:''}];
  f.nodes.get('O2N3DCutLRClick').classList=['btn',opt.classe||'leftRailSClass'];f.nodes.get('O2N3DCutRRClick').classList=['btn','rightRailSClass'];
  f.ctx.document.getElementById=(old=>id=>id==='globalcontainer'?el:old(id))(f.ctx.document.getElementById);
  for(const t of S.esvEvents.noms)for(let i=0;i<(opt.n?.[t]??1);i++)$(el).on(t,()=>{});
  f.ctx.Potree={...F.enums,version:opt.potree||{major:1,minor:8,suffix:''}};return {f,events};};
 const lire=async(o)=>plat((await o.f.call('ping',{contrat:true})).contrat);
 const a=await lire(monter()),b=await lire(monter());
 assert.match(a.hash,/^[0-9a-f]{8}$/);assert.equal(a.hash,b.hash,'même contrat, même empreinte');
 assert.deepEqual(a.detail.boutons,['O2N3DCutPreviousInvalid3DRail','O2N3DCutPrevious3DRail','O2N3DCutValidate3DRail','O2N3DCutSkip3DRail','O2N3DCutNext3DRail','O2N3DCutNextInvalid3DRail'],'six boutons, par leur id');
 assert.deepEqual(a.detail.ecouteurs,{railPairSelected:true,railPairUpdated:true,railPairSeen:true,loading:true,newPart:true});assert.equal(a.detail.jquery,'3.6.0');assert.equal(a.detail.potree,'1.8');
 assert.deepEqual(a.detail.rails,['btn leftRailSClass','btn rightRailSClass']);
 for(const [nom,o] of [['classe',{classe:'leftRailXClass'}],['écouteur absent',{n:{loading:0}}],['jquery',{jq:'3.7.1'}],['potree',{potree:{major:1,minor:9,suffix:''}}]])
  assert.notEqual((await lire(monter(o))).hash,a.hash,nom);
 /* 4.9.5.4 (D-139) : un libellé de bouton qui change, ou un écouteur de plus, dépendent de l'état de la page : même empreinte. */
 for(const [nom,o] of [['titre',{titre:'Passer'}],['écouteur de plus',{n:{loading:2}}]])assert.equal((await lire(monter(o))).hash,a.hash,nom);
 /* Nos écouteurs en ombre ne comptent pas : l'empreinte est la même avant et après leur pose. */
 const m=monter(),avant=await lire(m);await m.f.call('ping');assert.ok(m.events.loading.some(h=>h.namespace==='banane53'));assert.equal((await lire(m)).hash,avant.hash);
 /* Ping ordinaire : pas d'empreinte ; relevé coupé : pas d'empreinte. */
 assert.ok(!('contrat' in await monter().f.call('ping')));
 const off=monter({globals:{BananeSettings:{...S,releves:{...S.releves,empreinte:false}}}});assert.ok(!('contrat' in await off.f.call('ping',{contrat:true})));
 /* Page sans jQuery ni boutons : une empreinte quand même, détail à null, aucune exception. */
 const nu=page();const c=plat((await nu.call('ping',{contrat:true})).contrat);assert.match(c.hash,/^[0-9a-f]{8}$/);assert.equal(c.detail.jquery,null);
});

test('aucun relevé n\'envoie de commande à ESV : ni clic, ni touche, ni déclenchement d\'événement', async () => {
 const f=page(),el={},{$,events}=faussejQuery(el);f.ctx.$=$;f.ctx.document.getElementById=(old=>id=>id==='globalcontainer'?el:old(id))(f.ctx.document.getElementById);
 let clics=0;for(const [id,n] of f.nodes)if(n.click){const c=n.click;n.click=function(...a){clics++;return c.apply(this,a);};}
 const declenche=[];$.trigger=(...a)=>declenche.push(a);   // l'adaptateur ne doit jamais appeler trigger
 await f.call('ping',{contrat:true});await f.call('capture',{}).catch(()=>{});
 assert.equal(clics,0);assert.equal(f.keyboard.length,0);assert.deepEqual(declenche,[]);
});
