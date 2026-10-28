'use strict';
/* H14 (audit P-5 des lots de la test 6, C3) — L'EMPREINTE DU CONTRAT ESV NE DÉPEND PLUS DU RAIL SÉLECTIONNÉ.
 *
 * Constat : l'empreinte hachait les classes des deux boutons de rail. Or ces classes disent quel rail est sélectionné (`leftRailSClass`
 * sélectionné, `leftRailUSClass` non, idem à droite). Sélectionner l'autre rail changeait donc l'empreinte, et « Connecter » donnait un
 * faux avis « ESV n'a plus le même contrat » : test 3, `c4960ec5` puis `8ff6ba83` (forme 4.9.5.3) ; en 4.9.5.6, `cf09b21f` (rail gauche
 * sélectionné) contre `f05ddf81` (rail droit).
 * Règle : la classe de sélection est ramenée à `leftRail(S|US)Class` / `rightRail(S|US)Class` avant le hachage. Sa PRÉSENCE reste comparée
 * (Ariane la lit pour savoir quel rail est courant), son ÉTAT non ; les classes brutes vont dans `etat`, consigné sans être comparé (comme
 * les libellés de boutons depuis D-139). L'empreinte change de forme (`forme: 2`) : une empreinte gardée sous l'ancienne forme n'est jamais
 * comparée à la nouvelle (ni avis, ni « différente de la dernière connue » à l'installation).
 * Lecture seule : aucune commande, aucune requête à ESV. Page simulée ; le contrat de la test 6 (identifiants des six boutons, jQuery 3.1.1,
 * Potree 1.8.0, cinq écouteurs présents) sert à épingler l'empreinte connue. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs'),F=require('./v242/fixtures.cjs'),S=require('../src/settings.js');
const {production,memoire}=require('./helpers/perf-production.cjs'),{SimulatedESV}=require('./fixtures.cjs');
const plat=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const stored=(b,t)=>b.store.events.filter(e=>e.type===t);

/* Empreinte connue du contrat d'ESV de la test 6 sous la nouvelle forme, quel que soit le rail sélectionné (elle remplace `cf09b21f`,
 * rail gauche, et `f05ddf81`, rail droit, de la 4.9.5.6). */
const EMPREINTE_T6='ea8b250e';
const BOUTONS=['O2N3DCutPreviousInvalid3DRail','O2N3DCutPrevious3DRail','O2N3DCutValidate3DRail','O2N3DCutSkip3DRail','O2N3DCutNext3DRail','O2N3DCutNextInvalid3DRail'];

function faussejQuery(el,version){const events={};
 const $=()=>({on(types,fn){for(const t of types.split(/\s+/)){const [type,...ns]=t.split('.');(events[type]=events[type]||[]).push({handler:fn,namespace:ns.sort().join('.')});}return this;}});
 $._data=(t,k)=>t===el?(k==='events'?events:undefined):undefined;$.fn={jquery:version};return $;}
/* Une page ESV simulée comme celle de la test 6. `gauche` / `droite` : suffixe de sélection (« S » ou « US ») de chaque bouton de rail ;
 * un clic sur un bouton de rail le sélectionne et désélectionne l'autre, comme ESV. Les autres options changent la STRUCTURE. */
function monter({gauche='S',droite='US',sansBouton=null,sansRail=null,classesRail=['btn','btn-outline-secondary'],prefixeGauche='leftRail',n={},jq='3.1.1',potree={major:1,minor:8,suffix:'.0'}}={}){
 const f=page(),el={},$=faussejQuery(el,jq);f.ctx.$=$;
 f.ctx.document.querySelectorAll=()=>[...BOUTONS.filter(id=>id!==sansBouton).map(id=>({id,title:id})),{id:'O2N3DCutLRClick',title:''}];
 const L=f.nodes.get('O2N3DCutLRClick'),R=f.nodes.get('O2N3DCutRRClick');
 const selection=(g,d)=>{L.classList=[...classesRail,prefixeGauche+g+'Class'];R.classList=[...classesRail,'rightRail'+d+'Class'];};
 selection(gauche,droite);
 for(const [noeud,g,d] of [[L,'S','US'],[R,'US','S']]){const clic=noeud.click;noeud.click=function(){selection(g,d);return clic.call(this);};}
 if(sansRail)f.nodes.delete(sansRail);
 f.ctx.document.getElementById=(old=>id=>id==='globalcontainer'?el:old(id))(f.ctx.document.getElementById);
 for(const t of S.esvEvents.noms)for(let i=0;i<(n[t]??1);i++)$(el).on(t,()=>{});
 f.ctx.Potree={...F.enums,version:potree};return f;}
const lire=async f=>plat((await f.call('ping',{contrat:true})).contrat);
const ETATS=[['S','US'],['US','S'],['S','S'],['US','US']];

test('les 4 états de sélection des boutons de rail donnent la même empreinte (celle de la test 6, épinglée)',async()=>{
 const lus=[];for(const [g,d] of ETATS)lus.push(await lire(monter({gauche:g,droite:d})));
 assert.deepEqual(lus.map(c=>c.hash),ETATS.map(()=>EMPREINTE_T6),'rail gauche, rail droit, les deux, aucun : une seule empreinte');
 for(const c of lus.slice(1))assert.deepEqual(c.detail,lus[0].detail,'le détail comparé est identique lui aussi');
 assert.deepEqual(lus[0].detail.rails,['btn btn-outline-secondary leftRail(S|US)Class','btn btn-outline-secondary rightRail(S|US)Class'],'classe de sélection ramenée à sa présence');
 /* La sélection reste consignée, à part, pour l'analyse : elle n'est pas dans l'empreinte. */
 assert.deepEqual(lus.map(c=>c.etat.rails),ETATS.map(([g,d])=>['btn btn-outline-secondary leftRail'+g+'Class','btn btn-outline-secondary rightRail'+d+'Class']));
 assert.ok(lus.every(c=>c.forme===2),'empreinte de forme 2');
});

test('sélectionner l\'autre rail par son bouton, comme l\'opérateur, ne change pas l\'empreinte',async()=>{
 const f=monter(),avant=await lire(f);
 f.nodes.get('O2N3DCutRRClick').click();assert.deepEqual(f.nodes.get('O2N3DCutRRClick').classList.at(-1),'rightRailSClass','le rail droit est sélectionné');
 const apres=await lire(f);
 assert.equal(apres.hash,avant.hash);assert.equal(apres.hash,EMPREINTE_T6);
 assert.notDeepEqual(apres.etat.rails,avant.etat.rails,'la sélection a bien changé, et c\'est consigné dans `etat`');
});

test('un vrai changement de structure change toujours l\'empreinte, dans tous les états de sélection',async()=>{
 const changements=[['bouton de navigation absent',{sansBouton:'O2N3DCutSkip3DRail'}],['écouteur d\'ESV absent',{n:{newPart:0}}],
  ['bouton de rail absent',{sansRail:'O2N3DCutRRClick'}],['classe de sélection renommée',{prefixeGauche:'leftRailX'}],
  ['autre classe du bouton de rail',{classesRail:['btn','btn-primary']}],['jQuery',{jq:'3.7.1'}],['Potree',{potree:{major:1,minor:9,suffix:''}}]];
 for(const [g,d] of ETATS){
  const base=await lire(monter({gauche:g,droite:d}));
  for(const [nom,o] of changements){const c=await lire(monter({gauche:g,droite:d,...o}));assert.notEqual(c.hash,base.hash,nom+' (sélection '+g+'/'+d+')');}}
 /* Ce qui dépend de l'état de la page reste hors de l'empreinte (D-139) : nombre d'écouteurs. */
 assert.equal((await lire(monter({n:{loading:3}}))).hash,EMPREINTE_T6);
});

/* ---------- service worker : « Connecter » avec le rail droit sélectionné ne donne aucun avis ---------- */
/* L'adaptateur réel calcule l'empreinte sur la page simulée ; le service worker réel la range. */
function chaine(f,opts={}){const local=opts.local||memoire(),session=opts.session||memoire(),adapter=new SimulatedESV();
 const ping=adapter.ping.bind(adapter);adapter.ping=async o=>({...await ping(),...(o&&o.contrat===true?{contrat:await lire(f)}:{})});
 const b=production({adapter,local,session});const connecter=async()=>{await b.api('connect',{tabId:1});await attendre(25);};return {b,connecter,local,session};}

test('« Connecter » rail gauche sélectionné, puis rail droit sélectionné : même empreinte, aucun avis de contrat',async()=>{
 const f=monter(),{b,connecter}=chaine(f);
 await connecter();f.nodes.get('O2N3DCutRRClick').click();await connecter();f.nodes.get('O2N3DCutLRClick').click();await connecter();
 const c=stored(b,'contrat-esv');
 assert.deepEqual(c.map(x=>[x.hash,x.change]),[[EMPREINTE_T6,false],[EMPREINTE_T6,false],[EMPREINTE_T6,false]]);
 assert.deepEqual(c.map(x=>x.etat.rails[1]),['btn btn-outline-secondary rightRailUSClass','btn btn-outline-secondary rightRailSClass','btn btn-outline-secondary rightRailUSClass'],'la sélection est consignée');
 assert.equal(stored(b,'avis-contrat-esv').length,0,'aucun avis');
 assert.equal(plat(await b.api('view')).avisContrat,undefined,'rien au panneau');
});

test('à l\'installation : une empreinte gardée sous l\'ancienne forme (rail dans le hachage) n\'est jamais comparée',async()=>{
 /* Ce que la 4.9.5.6 a laissé : empreinte de l'onglet (repli storage.local) et dernière connue, rail droit sélectionné. */
 const ancien={hash:'f05ddf81',at:'2026-10-17T08:04:06.270Z',version:'4.9.5.6',detail:{boutons:BOUTONS,rails:['btn btn-outline-secondary leftRailUSClass','btn btn-outline-secondary rightRailSClass'],jquery:'3.1.1'}};
 const local=memoire(),session=memoire();await session.set({banane54Contrats:{1:ancien}});await local.set({banane50ContratDernier:ancien});
 const {b,connecter}=chaine(monter(),{local,session});await connecter();
 const c=stored(b,'contrat-esv').at(-1);
 assert.deepEqual([c.hash,c.precedent,c.change,c.dernierConnu],[EMPREINTE_T6,null,false,null],'ancienne forme : rien de comparable');
 assert.equal(stored(b,'avis-contrat-esv').length,0);
 /* La nouvelle empreinte est rangée avec sa forme ; le « Connecter » suivant la compare normalement. */
 assert.deepEqual([session.m.banane54Contrats['1'].forme,local.m.banane50ContratDernier.forme],[2,2]);
 await connecter();assert.deepEqual([stored(b,'contrat-esv').at(-1).precedent,stored(b,'contrat-esv').at(-1).change],[EMPREINTE_T6,false]);
});

test('lecture seule : l\'empreinte n\'envoie aucune commande à ESV',async()=>{
 const f=monter(),{b,connecter}=chaine(f);await connecter();f.nodes.get('O2N3DCutRRClick').click();await connecter();
 assert.deepEqual(b.commands.filter(x=>!['ping','state','nativeSnapshot'].includes(x.action)),[]);
});
