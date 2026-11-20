'use strict';
/* CH-130 (D-361) — CE QUE LE PANNEAU COMPLET DEMANDE EN PLUS À LA VUE DU TÉLÉPHONE (`vueReduite(...).detail`, src/telecommande.js).
 * Toujours la même règle que CH-111 : des entiers, des booléens, null, ou des mots de la liste fermée `MOTS` ; rien de l'état chargé ne fuit.
 * Les listes sont bornées (parties, plan, lignes de l'Aurore) et la vue la plus chargée tient dans l'enveloppe du relais (16 Ko). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../src/telecommande.js');
globalThis.ArianeCorrectionListe=require('../src/correction-liste.js');/* le service worker la charge (background.js) : statut de chaque cut de l'Aurore */
const UUID=['0f1e2d3c','4b5a','6978','8796','a5b4c3d2e1f0'].join('-'),PROJET='Project'+'__123456',ADR=['https:/','/esv.exemple','/rails_validation/x'].join('');
const SECRETS=[PROJET,UUID,'esv.exemple','rails_validation','Jean Dupont','texte libre d’ESV'];
function feuilles(o,chemin='',out=[]){if(o&&typeof o==='object'){for(const [k,v] of Object.entries(o))feuilles(v,chemin+'.'+k,out);}else out.push([chemin,o]);return out;}
const propre=v=>{const t=JSON.stringify(v);for(const s of SECRETS)assert.ok(!t.includes(s),'fuite : '+s);assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}|https?:|Project__/i.test(t),t);
 for(const [c,x] of feuilles(v))assert.ok(x===null||typeof x==='boolean'||Number.isInteger(x)||T.MOTS.has(x),`${c} = ${JSON.stringify(x)}`);};

function etat({lignes=6,parties=3}={}){const id={part:12,cut:345,frameId:UUID,projet:PROJET,url:ADR};
 const entrees=Array.from({length:lignes},(_,i)=>({part:12+Math.floor(i/50),cut:400+i,groupe:i%3?'corriger':'poser',batchId:UUID,details:{motif:'Jean Dupont',url:ADR}}));
 const listes=[...new Set(entrees.map(e=>e.part))].map(p=>({partie:p,batchId:UUID,entrees:entrees.filter(e=>e.part===p),comptes:{note:'texte libre d’ESV'}}));
 return {s:{sessionId:UUID,connection:{status:'ready',message:'onglet '+ADR},current:{identity:id},
   batch:{id:UUID,state:'RUNNING',scope:{part:12,start:300,end:999999,endMode:'partie',projet:PROJET},activeIdentity:id,lastCompletedIdentity:{...id,cut:344},
    processed:[{identity:id,cut:340},{identity:{...id,cut:341},cut:341}],deferred:[],skipped:[]},
   native:{status:'RUNNING',correction:{id:'corr-'+UUID},visits:[{identity:{part:12,cut:400},label:'VALIDATE_CORRECTED_LEFT',endedAt:'x',visitId:'v1',note:'Jean Dupont'},
    {identity:{part:12,cut:401},label:'VALIDATE_NO_MOVEMENT',endedAt:'x',visitId:'v2'},{identity:{part:12,cut:402},label:null,visitId:'v3'}]},
   correction:{id:'corr-'+UUID,etat:'ouverte',listes,courant:{part:12,cut:402},issues:null,texte:'Jean Dupont'}},
  relecture:null,passe:null,echo:false,version:'5.0.15',
  file:{id:UUID,etat:'lot',n:Math.max(parties,1),plan:Array.from({length:parties},(_,i)=>12+i),rang:1,enCours:{part:13,rang:1},changement:{vers:14,texte:'Jean Dupont'},
   reprise:{part:13,rang:1,reste:2,note:PROJET},
   bilan:Array.from({length:parties},(_,i)=>({part:12+i,rang:i,motifs:i?['fin-normale',PROJET]:['esv-muet'],resume:{poses:10+i,differes:i},passe:{issue:'finie',ecrits:i},relecture:{issue:'arretee',corriges:1},alertes:i===1?[{texte:'texte libre d’ESV'}]:[],...(i===2?{interrompue:true}:{})}))}};}

test('detail : schéma 3, ESV, dernier cut, Écho, Constellation, Aurore ; mots fermés et entiers seulement',()=>{
 const v=T.vueReduite(etat());propre(v);
 assert.equal(v.schema,3);
 const d=v.detail;
 assert.equal(d.dernier,341);assert.deepEqual(d.esv,{partie:12,cut:345});
 assert.deepEqual(d.echo,{etat:'cours',vus:3,corriges:1,valides:1});
 assert.deepEqual(d.file.plan,[12,13,14]);assert.equal(d.file.vers,14);assert.deepEqual(d.file.reprise,{part:13,rang:1,reste:2});
 assert.deepEqual(d.file.parties[0],{part:12,rang:0,interrompue:false,alerte:false,poses:10,differes:0,ecrits:0,passe:'finie',corriges:1,relecture:'arretee',motifs:['esv-muet']});
 assert.deepEqual(d.file.parties[1].motifs,['fin-normale','autre'],'un motif hors liste devient « autre »');assert.equal(d.file.parties[1].alerte,true);
 assert.equal(d.file.parties[2].interrompue,true);
 const A=d.aurore;assert.equal(A.etat,'ouverte');assert.equal(A.echoOuverte,true);assert.deepEqual(A.courant,{part:12,cut:402});
 assert.deepEqual(A.lignes.slice(0,3),[[12,400,'corrige','poser',1],[12,401,'valide','corriger',0],[12,402,'en-cours','corriger',0]]);
 assert.deepEqual(A.comptes,{total:6,aCorriger:4,aPoser:2,corrige:1,valide:1,vu:0,enCours:1});assert.equal(A.tronque,0);
});

test('detail : sans Écho, sans Aurore, sans Constellation : des valeurs vides, pas d’erreur',()=>{
 const v=T.vueReduite({s:{batch:null,connection:{status:'no-tab'}},relecture:null,file:null,passe:null,echo:false});propre(v);
 assert.deepEqual(v.detail,{dernier:null,esv:{partie:null,cut:null},echo:{etat:'aucune',vus:0,corriges:0,valides:0},file:{plan:[],vers:null,parties:[],reprise:null},
  aurore:{etat:'aucune',echoOuverte:false,courant:null,comptes:null,lignes:[],tronque:0}});
 const e=etat();e.s.native={status:'FINISHED',visits:[]};assert.equal(T.vueReduite(e).detail.echo.etat,'terminee');
 e.s.native={status:null,visits:[{identity:{part:1,cut:2}}]};assert.equal(T.vueReduite(e).detail.echo.etat,'a-terminer');
 e.s.native={status:'STATUT INVENTÉ '+PROJET};assert.equal(T.vueReduite(e).detail.echo.etat,'autre');
});

test('detail : listes bornées (20 parties, 150 lignes d’Aurore) ; la vue la plus chargée tient dans l’enveloppe du relais',async()=>{
 const v=T.vueReduite(etat({lignes:900,parties:40}));propre(v);
 assert.equal(v.detail.file.parties.length,20);assert.equal(v.detail.file.plan.length,20);
 assert.equal(v.detail.aurore.lignes.length,150);assert.equal(v.detail.aurore.tronque,750);assert.equal(v.detail.aurore.comptes.total,900,'les comptes portent sur toute la liste');
 const D=await T.deriver(T.tirerCle()),env=JSON.stringify(await T.chiffrer(D,'a>t',{type:'etat',...v,n:Date.now(),h:Date.now()}));
 console.log(`# vue la plus chargée : ${JSON.stringify(v).length} caractères en clair, ${env.length} chiffrée (limite du relais : 16384)`);
 assert.ok(env.length<14000,env.length);
});
