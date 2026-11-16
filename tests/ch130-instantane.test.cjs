'use strict';
/* CH-130 (D-361) — LE PANNEAU COMPLET SUR LE TÉLÉPHONE : la vue réduite d'Ariane -> l'instantané (src/telecommande-instantane.js) -> le RENDU DU PANNEAU
 * (src/signal-rendu.js, sans copie) -> le filtre des actions. Sur des états fabriqués comme ceux du service worker, dans les quatre onglets :
 *  - le rendu ne lève jamais ; la barre porte les quatre onglets (Orbite, Écho, Constellation, Aurore) ;
 *  - il ne reste que des navigations locales et les ordres OFFERTS par Ariane à cet instant ; chacun devient un des 7 ordres de CH-111 ;
 *  - aucun bouton d'écriture, de départ, de SKIP, de validation ni d'ouverture de cut ne survit, même si le rendu en dessine un. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../src/telecommande.js'),S5=require('../src/signal-rendu.js'),I=require('../src/telecommande-instantane.js');
globalThis.ArianeCorrectionListe=require('../src/correction-liste.js');

const id={part:12,cut:345};
function src(o={}){return {s:{connection:{status:'ready'},current:{identity:id},batch:null,...o.s},relecture:o.relecture??null,file:o.file??null,passe:o.passe??null,echo:!!o.echo,version:'x'};}
const lot=(state,extra={})=>({id:'l',state,scope:{part:12,start:300,end:999999,endMode:'partie'},activeIdentity:id,lastCompletedIdentity:{part:12,cut:344},processed:[{cut:340},{cut:341}],deferred:[{cut:342}],skipped:[],...extra});
const correction={id:'c',etat:'ouverte',courant:{part:12,cut:401},listes:[{partie:12,batchId:'l',entrees:[{part:12,cut:400,groupe:'corriger'},{part:12,cut:401,groupe:'corriger'},{part:12,cut:402,groupe:'poser'}]}]};
const native={status:'RUNNING',correction:{id:'c'},visits:[{identity:{part:12,cut:400},label:'VALIDATE_CORRECTED_LEFT',endedAt:'x'},{identity:{part:12,cut:401},label:null}]};
const file={etat:'lot',n:3,plan:[12,13,14],rang:0,enCours:{part:12,rang:0},bilan:[]};
const ETATS={
 'repos':src(),
 'sans onglet ESV':src({s:{connection:{status:'no-tab'},current:null}}),
 'lot en cours':src({s:{batch:lot('RUNNING')}}),
 'lot en pause':src({s:{batch:lot('PAUSED')}}),
 'ESV muet':src({s:{batch:lot('PAUSED_ADAPTER_UNRESPONSIVE'),connection:{status:'unavailable'}}}),
 'rail non résolu':src({s:{batch:lot('PAUSED',{pauseReason:'unresolved-rail'})}}),
 'incertain':src({s:{batch:lot('RUNNING'),reconcileRequired:true}}),
 'lot fini':src({s:{batch:lot('COMPLETED')}}),
 'lot arrêté':src({s:{batch:lot('STOPPED')}}),
 'relecture en cours':src({s:{batch:lot('COMPLETED')},relecture:{etat:'en-cours',faits:3,total:9,corriges:1,cut:350,reprise:true}}),
 'relecture en pause':src({s:{batch:lot('COMPLETED')},relecture:{etat:'en-pause',faits:3,total:9,corriges:1,cut:350,pauseRaison:'esv'}}),
 'rattrapage':src({s:{batch:lot('COMPLETED')},passe:{etat:'ecriture',ecrites:2,demandees:5}}),
 'Constellation en cours':src({s:{batch:lot('RUNNING')},file}),
 'Constellation arrêtée':src({file:{...file,etat:'arret',reprise:{part:13,rang:1,reste:2},bilan:[{part:12,rang:0,motifs:['operateur'],resume:{poses:4,differes:1}}]}}),
 'Constellation finie':src({file:{...file,etat:'fin',bilan:[0,1,2].map(i=>({part:12+i,rang:i,motifs:['fin-normale'],resume:{poses:3,differes:0}}))}}),
 'Écho en cours':src({s:{native:{status:'RUNNING',visits:[{identity:id,label:'VALIDATE_NO_MOVEMENT',endedAt:'x'}]}},echo:true}),
 'Aurore ouverte':src({s:{correction,native},echo:true}),
 'Aurore proposée':src({s:{correction:{...correction,etat:'proposee'}}}),
 'Aurore terminée':src({s:{correction:{...correction,etat:'terminee'},native}}),
};
const ONGLETS=[['Orbite',{onglet:null},'orbite'],['Écho',{onglet:null},'echo'],['Constellation',{onglet:'file'},null],['Aurore',{onglet:'correction'},null]];
function ecran(v,onglet,vue){const snap=I.instantane(v,{vue});return I.filtrer(S5.rendre(snap,{couche:null,tiroir:false,details:false,...onglet}),v);}

test('quatre onglets, dans chaque état : rendu sans erreur, seules les navigations et les ordres offerts restent',()=>{
 let n=0;
 for(const [nom,e] of Object.entries(ETATS)){const v=T.vueReduite(e);
  for(const [o,ui,vue] of ONGLETS){const h=ecran(v,ui,vue);n++;
   assert.match(h,/role="tablist"/,`${nom} · ${o}`);
   for(const t of ['Orbite','Écho','Constellation','Aurore'])assert.ok(h.includes(`>${t}</button>`),`${nom} · ${o} : onglet ${t}`);
   for(const a of I.actions(h))assert.ok(I.NAVIGATION.includes(a)||I.ordreDe(a,v),`${nom} · ${o} : action restée ${a}`);
   assert.doesNotMatch(h,/legacy:(start|explicit-skip|skip|retry|new-batch|export|correction-|native-|file-lancer|file-reprendre|file-principal|manual|relecture-acquitter)|sg:corr-ouvrir|sg:esv|sg:reglages|sg:palette|sg:telecommande/,`${nom} · ${o}`);}}
 console.log(`# ${n} écrans dessinés (${Object.keys(ETATS).length} états × 4 onglets)`);
});

test('les ordres offerts par Ariane sont là, au même endroit que dans le panneau, et deviennent les ordres de CH-111',()=>{
 const ordres=(nom,ui={onglet:null},vue='orbite')=>{const v=T.vueReduite(ETATS[nom]);return [...new Set(I.actions(ecran(v,ui,vue)).map(a=>I.ordreDe(a,v)).filter(Boolean))].sort();};
 assert.deepEqual(ordres('lot en cours'),['lot-arreter','lot-pause']);
 assert.deepEqual(ordres('lot en pause'),['lot-arreter','lot-reprendre']);
 assert.deepEqual(ordres('relecture en cours'),['relecture-arreter','relecture-pause']);
 assert.deepEqual(ordres('relecture en pause'),['relecture-arreter','relecture-reprendre']);
 assert.deepEqual(ordres('Constellation en cours',{onglet:'file'},null),['constellation-arreter']);
 assert.deepEqual(ordres('repos'),[]);assert.deepEqual(ordres('Aurore ouverte',{onglet:'correction'},null),[]);assert.deepEqual(ordres('Écho en cours',{onglet:null},'echo'),[]);
 for(const o of new Set(Object.values(I.ACTES)))assert.ok(Object.hasOwn(T.ORDRES,o),o);
});

test('ce que le rendu dit vient de la vue : mot d’état, numéros, Aurore, Constellation',()=>{
 const h=nom=>ecran(T.vueReduite(ETATS[nom]),{onglet:null},'orbite');
 assert.match(h('lot en cours'),/En cours/);assert.match(h('lot en cours'),/Pose du cut <span class="sg-mono">345<\/span>/);
 assert.match(h('lot en pause'),/En pause/);assert.match(h('ESV muet'),/ESV ne répond plus/);assert.match(h('incertain'),/Interrompu/);
 assert.match(h('relecture en pause'),/Relecture en pause/);assert.match(h('rattrapage'),/Rattrapage/);
 const a=ecran(T.vueReduite(ETATS['Aurore ouverte']),{onglet:'correction'},null);
 assert.match(a,/data-k="c:12:400"/);assert.match(a,/corrigé · 1 rail/);assert.match(a,/ouvert dans ESV/);
 const vf=T.vueReduite(ETATS['Constellation arrêtée']),f=ecran(vf,{onglet:'file'},null);assert.match(f,/data-partie="13"/);
 /* D-362 (CH-129) : le bilan par partie est derrière l'icône d'en-tête « Bilan et départs » (sg:stats), permise au téléphone (navigation locale). */
 assert.ok(I.actions(f).includes('sg:stats'),'icône du bilan présente sur le téléphone');assert.equal(I.ordreDe('sg:stats',vf),null,'navigation, pas un ordre');
 const fb=ecran(vf,{onglet:'file',stats:true},null);assert.match(fb,/arrêtée par l’opérateur/);assert.ok(I.actions(fb).includes('sg:stats'),'retour à la Constellation');
});

test('filtre : un bouton hors liste dessiné par le rendu disparaît, une navigation reste ; un ordre non offert est refusé',()=>{
 const v={boutons:{'lot-pause':true,'lot-arreter':false}};
 const h='<button type="button" data-act="legacy:explicit-skip">Passer</button><button data-act="legacy:start-batch"><svg></svg>Démarrer</button><button data-act="pause">Pause</button>'
  +'<button data-act="legacy:stop">Arrêter</button><button data-act="sg:onglet-file">Constellation</button><div class="sg-voile" data-act="sg:corr-ouvrir:1:2"></div>';
 const f=I.filtrer(h,v);
 assert.deepEqual(I.actions(f),['pause','sg:onglet-file']);assert.match(f,/<div class="sg-voile"><\/div>/);assert.doesNotMatch(f,/Passer|Démarrer|Arrêter/);
 assert.equal(I.ordreDe('pause',v),'lot-pause');assert.equal(I.ordreDe('legacy:stop',v),null);assert.equal(I.ordreDe('legacy:explicit-skip',{boutons:{'explicit-skip':true}}),null);
 assert.equal(I.ordreDe('toString',v),null);assert.equal(I.ordreDe('__proto__',v),null);
});

test('page périmée : une vue d’un schéma plus récent que la page le dit (relais à redéployer)',()=>{
 assert.equal(I.pagePerimee({schema:I.SCHEMA}),false);assert.equal(I.pagePerimee({schema:I.SCHEMA+1}),true);assert.equal(I.pagePerimee({}),false);
 assert.equal(I.SCHEMA,T.SCHEMA);
});
