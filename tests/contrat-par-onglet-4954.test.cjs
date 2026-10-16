'use strict';
/* 4.9.5.4 (D-139) — EMPREINTE DU CONTRAT ESV RANGÉE PAR ONGLET, ET SANS CE QUI DÉPEND DE L'ÉTAT DE LA PAGE.
 *
 * Constat (second projet, 16/10) : deux fenêtres ESV ouvertes dans des états différents se disputaient une seule empreinte, gardée pour tout le
 * navigateur, d'où cinq avis « ESV n'a plus le même contrat » en alternance. Deux corrections :
 *   1. l'empreinte précédente est rangée PAR ONGLET (chrome.storage.session : les numéros d'onglet n'ont de sens que dans la session du
 *      navigateur) ; un onglet n'est comparé qu'à lui-même ;
 *   2. l'empreinte ne contient plus les libellés (`title`) des boutons, qui changent selon l'état, ni le NOMBRE d'écouteurs jQuery : seule leur
 *      PRÉSENCE compte. Ces deux relevés restent consignés à part (`etat`), sans être comparés.
 * Lecture seule : aucune commande, aucune requête à ESV. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs'),F=require('./v242/fixtures.cjs'),S=require('../src/settings.js');
const {production,memoire}=require('./helpers/perf-production.cjs'),{SimulatedESV}=require('./fixtures.cjs');
const plat=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const stored=(b,t)=>b.store.events.filter(e=>e.type===t);

/* ---------- adaptateur : l'empreinte ne dépend plus de l'état de la page ---------- */
function faussejQuery(el){const events={};
 const $=()=>({on(types,fn){for(const t of types.split(/\s+/)){const [type,...ns]=t.split('.');(events[type]=events[type]||[]).push({handler:fn,namespace:ns.sort().join('.')});}return this;}});
 $._data=(t,k)=>t===el?(k==='events'?events:undefined):undefined;$.fn={jquery:'3.6.0'};
 return {$,events};}
/* Une page ESV simulée dans un « état » : libellés des boutons, nombre d'écouteurs par événement (0 = absent), boutons présents, classes. */
function monter({titres={},n={},sansBouton=null,classe='leftRailSClass',jq,potree={major:1,minor:8,suffix:''}}={}){
 const f=page(),el={},{$,events}=faussejQuery(el);f.ctx.$=$;if(jq)$.fn.jquery=jq;
 const ids=['O2N3DCutPreviousInvalid3DRail','O2N3DCutPrevious3DRail','O2N3DCutValidate3DRail','O2N3DCutSkip3DRail','O2N3DCutNext3DRail','O2N3DCutNextInvalid3DRail'];
 const boutons=ids.filter(id=>id!==sansBouton).map(id=>({id,title:titres[id]??id.replace(/^O2N3DCut|3DRail$/g,'')}));
 f.ctx.document.querySelectorAll=()=>[...boutons,{id:'O2N3DCutLRClick',title:''}];
 f.nodes.get('O2N3DCutLRClick').classList=['btn',classe];f.nodes.get('O2N3DCutRRClick').classList=['btn','rightRailSClass'];
 f.ctx.document.getElementById=(old=>id=>id==='globalcontainer'?el:old(id))(f.ctx.document.getElementById);
 for(const t of S.esvEvents.noms)for(let i=0;i<(n[t]??1);i++)$(el).on(t,()=>{});
 f.ctx.Potree={...F.enums,version:potree};return f;}
const lire=async f=>plat((await f.call('ping',{contrat:true})).contrat);

test('empreinte : deux onglets dans deux ÉTATS (libellés de boutons, nombre d\'écouteurs) donnent la même empreinte',async()=>{
 const repos=await lire(monter());
 const occupe=await lire(monter({
  titres:{O2N3DCutSkip3DRail:'Skip (3 left)',O2N3DCutValidate3DRail:'Validate and next',O2N3DCutNext3DRail:'Next (disabled)'},
  n:{loading:4,newPart:3,railPairSelected:2,railPairUpdated:5,railPairSeen:2}}));
 assert.equal(occupe.hash,repos.hash,'même contrat, même empreinte, quel que soit l\'état de la page');
 assert.deepEqual(occupe.detail,repos.detail,'le détail comparé est identique lui aussi');
});

test('empreinte : le détail comparé ne porte ni libellé de bouton ni nombre d\'écouteurs',async()=>{
 const c=await lire(monter({titres:{O2N3DCutSkip3DRail:'Passer'},n:{loading:4}}));
 assert.deepEqual(c.detail.boutons,['O2N3DCutPreviousInvalid3DRail','O2N3DCutPrevious3DRail','O2N3DCutValidate3DRail','O2N3DCutSkip3DRail','O2N3DCutNext3DRail','O2N3DCutNextInvalid3DRail'],'les six boutons, par leur identifiant seulement');
 assert.deepEqual(c.detail.ecouteurs,{railPairSelected:true,railPairUpdated:true,railPairSeen:true,loading:true,newPart:true},'présence seulement');
 assert.ok(!JSON.stringify(c.detail).includes('Passer'),'aucun libellé dans le détail comparé');
 /* Les deux relevés écartés restent consignés, à part, pour l'analyse : ils ne sont pas dans l'empreinte. */
 assert.deepEqual(c.etat.titres.find(x=>x[0]==='O2N3DCutSkip3DRail'),['O2N3DCutSkip3DRail','Passer']);
 assert.equal(c.etat.ecouteurs.loading,4);
});

test('empreinte : ce qui compte reste comparé — bouton absent, écouteur absent, classe de rail, jQuery, Potree',async()=>{
 const base=await lire(monter());
 for(const [nom,o] of [['bouton absent',{sansBouton:'O2N3DCutSkip3DRail'}],['écouteur absent',{n:{newPart:0}}],['classe de rail',{classe:'leftRailXClass'}],['jquery',{jq:'3.7.1'}],['potree',{potree:{major:1,minor:9,suffix:''}}]])
  assert.notEqual((await lire(monter(o))).hash,base.hash,nom);
 /* Un écouteur qui passe de 1 à 0 est une absence (changement), de 1 à 2 n'en est pas un. */
 assert.equal((await lire(monter({n:{loading:2}}))).hash,base.hash);
 /* Nos écouteurs en ombre ne comptent pas, ni pour la présence ni pour le nombre. */
 const m=monter({n:{loading:0}}),sans=await lire(m);await m.call('ping');assert.equal((await lire(m)).hash,sans.hash,'notre écouteur en ombre n\'est pas pris pour celui d\'ESV');
 assert.equal(sans.detail.ecouteurs.loading,false);
});

/* ---------- service worker : une empreinte précédente par onglet ---------- */
const DETAIL=(extra={})=>({boutons:['a','b'],ecouteurs:{loading:true,newPart:true},jquery:'3.6.0',potree:'1.8',rails:['btn','btn'],...extra});
function deuxOnglets(opts={}){
 const session=memoire(),local=opts.local||memoire(),adapter=new SimulatedESV(),etat={1:{hash:'aaaaaaaa',detail:DETAIL()},2:{hash:'bbbbbbbb',detail:DETAIL({jquery:'3.6.1'})}};
 let courant=null;const ping=adapter.ping.bind(adapter);
 adapter.ping=async o=>({...await ping(),...(o&&o.contrat===true?{contrat:etat[courant]}:{})});
 const b=production({adapter,local,session});
 const envoi=b.ctx.chrome.tabs.sendMessage;b.ctx.chrome.tabs.sendMessage=async(id,m)=>{courant=id;return envoi(id,m);};
 const connecter=async id=>{await b.api('connect',{tabId:id});await attendre(25);};
 return {b,etat,session,local,connecter};
}

test('deux onglets ESV dans deux états : chacun est comparé à LUI-MÊME, aucune fausse alerte quand on passe de l\'un à l\'autre',async()=>{
 const {b,connecter,session}=deuxOnglets();
 for(const id of [1,2,1,2,1,2]) await connecter(id);
 const c=stored(b,'contrat-esv');
 assert.equal(c.length,6);
 assert.deepEqual(c.map(x=>x.change),[false,false,false,false,false,false],'aucun changement : chaque onglet retrouve sa propre empreinte');
 assert.deepEqual(c.map(x=>x.precedent),[null,null,'aaaaaaaa','bbbbbbbb','aaaaaaaa','bbbbbbbb']);
 assert.equal(stored(b,'avis-contrat-esv').length,0,'pas d\'avis');
 assert.equal(JSON.parse(JSON.stringify(await b.api('view'))).avisContrat,undefined);
 /* Rangée par onglet. */
 const rangee=Object.values(session.m)[0];assert.deepEqual(Object.keys(rangee).sort(),['1','2']);assert.equal(rangee['1'].hash,'aaaaaaaa');assert.equal(rangee['2'].hash,'bbbbbbbb');
});

test('un vrai changement du contrat dans UN onglet est signalé pour cet onglet seulement, puis l\'avis tombe quand on revient à l\'autre',async()=>{
 const {b,etat,connecter}=deuxOnglets();
 for(const id of [1,2]) await connecter(id);
 etat[2]={hash:'cccccccc',detail:DETAIL({jquery:'3.7.1'})};
 await connecter(2);
 const dernier=stored(b,'contrat-esv').at(-1);
 assert.deepEqual([dernier.hash,dernier.precedent,dernier.change],['cccccccc','bbbbbbbb',true]);assert.deepEqual(dernier.changements,['jquery']);
 const a=stored(b,'avis-contrat-esv');assert.equal(a.length,1);assert.equal(a[0].motif,'empreinte:cccccccc');assert.match(a[0].texte,/bbbbbbbb.*cccccccc/);
 assert.match(JSON.parse(JSON.stringify(await b.api('view'))).avisContrat[0],/n’a plus le même contrat/);
 await connecter(1);
 assert.equal(stored(b,'contrat-esv').at(-1).change,false,'l\'autre onglet n\'a pas bougé');
 assert.equal(JSON.parse(JSON.stringify(await b.api('view'))).avisContrat,undefined,'réévalué à la nouvelle connexion');
 /* Revenir sur l'onglet 2 : son empreinte (cccccccc) est maintenant la sienne, plus de changement. */
 await connecter(2);assert.equal(stored(b,'contrat-esv').at(-1).change,false);
});

test('une empreinte d\'une version précédente (clé de la test 3) n\'est jamais comparée : la forme de l\'empreinte a changé',async()=>{
 const local=memoire();await local.set({banane53Contrat:{hash:'deadbeef',at:'2026-10-16T08:00:00.000Z',version:'4.9.5.3',detail:{boutons:[['a','Titre']],ecouteurs:{loading:3}}}});
 const {b,connecter}=deuxOnglets({local});
 await connecter(1);
 const c=stored(b,'contrat-esv');assert.equal(c.length,1);assert.deepEqual([c[0].precedent,c[0].change],[null,false]);
 assert.equal(stored(b,'avis-contrat-esv').length,0);
});

test('l\'état de la page (libellés, nombres d\'écouteurs) est consigné à part, sans jamais déclencher d\'avis',async()=>{
 const {b,etat,connecter}=deuxOnglets();
 etat[1]={hash:'aaaaaaaa',detail:DETAIL(),etat:{titres:[['a','Skip']],ecouteurs:{loading:1,newPart:2}}};
 await connecter(1);
 etat[1]={hash:'aaaaaaaa',detail:DETAIL(),etat:{titres:[['a','Skipping…']],ecouteurs:{loading:5,newPart:0}}};
 await connecter(1);
 const c=stored(b,'contrat-esv');assert.equal(c.length,2);assert.equal(c[1].change,false);assert.equal(stored(b,'avis-contrat-esv').length,0);
 assert.deepEqual(c.map(x=>x.etat.ecouteurs),[{loading:1,newPart:2},{loading:5,newPart:0}],'consigné tel quel');
 assert.deepEqual(c.map(x=>x.changements),[[],[]]);
});

test('l\'empreinte reste en lecture seule : aucune commande à ESV autre que les lectures de l\'adaptateur',async()=>{
 const {b,connecter}=deuxOnglets();
 for(const id of [1,2,1]) await connecter(id);
 assert.deepEqual(b.commands.filter(x=>!['ping','state','nativeSnapshot'].includes(x.action)),[]);
});
