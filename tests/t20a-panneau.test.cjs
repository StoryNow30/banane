'use strict';
/* T20a (D-250, contrat promis à l'interface Signal) — CE QUE L'ANCIEN PANNEAU OFFRE COMME MOTEUR CACHÉ. Panneau réel (panel.js) dans un contexte `vm`,
 * DOM et API Chrome simulés (tools/audit-qualite-480.cjs) ; habillage (src/ui5.js) contre une page minimale (tests/helpers/ui5-page.cjs) :
 *  - bouton `#reconnect` à côté de `#tabs` / `#connect` : caché sans onglet, grisé pendant `reconnecting`, action `reconnect` ;
 *  - déclencheur caché d'« aller au cut » (`#goto-cut-cible` « partie:cut », `#goto-cut`, `#goto-cut-etat`) : grisé pendant un lot (en cours ou en pause),
 *    une relecture, la deuxième passe, Écho, ou hors `ready`, la raison dans `title` ; cible invalide : « refuse », rien n'est envoyé ; jamais rien dans
 *    `#notice` ; il envoie l'action existante `goto-cut` (aucune commande ESV nouvelle) ;
 *  - aucun identifiant existant du panneau n'est renommé. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {panneau}=require('../tools/audit-qualite-480.cjs');
const {monter}=require('./helpers/ui5-page.cjs');
const Settings=require('../src/settings.js');
const racine=path.resolve(__dirname,'..'),lire=f=>fs.readFileSync(path.join(racine,f),'utf8');
const HTML=lire('panel.html');
const pret={status:'ready',observedAt:'2026-10-25T10:00:00.000Z',message:null,tabId:1};
const vue=(extra={})=>({current:{identity:{part:23,cut:120}},batch:null,connection:pret,native:{status:'IDLE',visits:[]},...extra});
const lot=etat=>({id:'L',state:etat,scope:{part:23,start:100,end:130},processed:[],deferred:[],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:[],activeIdentity:{part:23,cut:120}});
const ouvrir=(etat,reponses={})=>panneau(etat,{globals:{BananeSettings:Settings},reponses});

test('panel.html : les éléments du contrat, cachés, à côté de la connexion ; aucun identifiant d’avant retiré',()=>{
 assert.match(HTML,/<input id="goto-cut-cible" hidden>/);
 assert.match(HTML,/<button id="goto-cut" type="button" hidden>/);
 assert.match(HTML,/<span id="goto-cut-etat" hidden data-etat=""><\/span>/);
 assert.match(HTML,/<select id="tabs">[\s\S]*?<button id="connect" class="secondary">Reconnecter ESV<\/button><button id="reconnect" class="secondary" type="button" data-act="legacy:reconnect" hidden>Reconnecter<\/button>/,
  '« Reconnecter » à côté de « Reconnecter ESV » (choix de l’onglet) dans « Connexion à ESV »');
 for(const id of ['tabs','connect','connection','notice','tabs-note','export-tout','stop','pause','resume'])assert.match(HTML,new RegExp(`id="${id}"`),id);
});

test('« Reconnecter » : caché sans onglet, grisé pendant la reconnexion, envoie `reconnect`',async()=>{
 let p=await ouvrir(vue());assert.equal(p.$('reconnect').hidden,false);assert.equal(p.$('reconnect').disabled,false);
 await p.$('reconnect').onclick();await p.attendre();assert.ok(p.appels.some(a=>a.action==='reconnect'),'action reconnect envoyée');
 p=await ouvrir(vue({connection:{...pret,status:'reconnecting'}}));assert.equal(p.$('reconnect').hidden,false);assert.equal(p.$('reconnect').disabled,true);
 p=await ouvrir(vue({connection:{status:'no-tab',observedAt:'t',message:'Aucun onglet ESV.',tabId:null}}));assert.equal(p.$('reconnect').hidden,true);
 p=await ouvrir(vue({connection:undefined}));assert.equal(p.$('reconnect').hidden,true,'jamais connecté : caché');
 p=await ouvrir(vue({connection:{...pret,status:'unavailable',message:'page perdue'}}));assert.equal(p.$('reconnect').hidden,false);assert.equal(p.$('reconnect').disabled,false);
});

test('aller au cut : grisé avec sa raison (lot en cours, en pause, relecture, deuxième passe, Écho, ESV pas prêt) ; toujours caché',async()=>{
 const cas=[[vue({batch:lot('RUNNING')}),/lot/i],[vue({batch:lot('PAUSED')}),/pause/i],[vue({batch:lot('PAUSED_ADAPTER_UNRESPONSIVE')}),/pause/i],[vue({batch:lot('MANUAL_TAKEOVER')}),/pause/i],
  [vue({relecture:{etat:'en-cours',faits:1,total:9}}),/relecture/i],[vue({relecture:{etat:'en-pause',faits:1,total:9}}),/relecture/i],[vue({relecture:{etat:'preparation',faits:0,total:0}}),/relecture/i],
  [vue({passeDifferes:{etat:'ecriture',ecrites:0,demandees:2}}),/deuxième passe/i],[vue({passeDifferes:{etat:'calcul'}}),/deuxième passe/i],
  [vue({native:{status:'RUNNING',visits:[]}}),/Écho/],[vue({native:{status:'PAUSED_ADAPTER_UNRESPONSIVE',visits:[]}}),/Écho/],
  [vue({connection:{...pret,status:'unavailable',message:'x'}}),/ESV/],[vue({connection:{...pret,status:'reconnecting'}}),/ESV/],[vue({connection:{status:'no-tab',tabId:null}}),/ESV/]];
 for(const [etat,raison] of cas){const p=await ouvrir(etat);const g=p.$('goto-cut');
  assert.equal(g.disabled,true,JSON.stringify(etat).slice(0,120));assert.match(String(g.title),raison);assert.equal(g.hidden,true);assert.equal(p.$('goto-cut-cible').hidden,true);assert.equal(p.$('goto-cut-etat').hidden,true);
  /* Un clic malgré tout (le DOM caché reste cliquable par programme) : refusé avec la raison, rien n'est envoyé. */
  p.$('goto-cut-cible').value='23:97';const n=p.notes.length;await p.$('goto-cut').onclick();await p.attendre();
  assert.ok(!p.appels.some(a=>a.action==='goto-cut'),'rien n’est envoyé');assert.equal(p.$('goto-cut-etat').attrs['data-etat'],'refuse');assert.match(p.$('goto-cut-etat').textContent,raison);
  assert.equal(p.notes.length,n,'rien dans #notice');}
 const libre=await ouvrir(vue({batch:lot('COMPLETED')}));assert.equal(libre.$('goto-cut').disabled,false,'lot terminé : permis');assert.equal(libre.$('goto-cut').title,'');
 const fini=await ouvrir(vue({relecture:{etat:'finie',faits:9,total:9},passeDifferes:{etat:'finie'}}));assert.equal(fini.$('goto-cut').disabled,false,'relecture et passe finies : permis');
});

test('aller au cut : cible invalide → « refuse », « cible invalide », rien d’envoyé ; succès → « ok » ; refus d’Ariane → « refuse » et sa raison ; jamais #notice',async()=>{
 const envois=[];let reponse={ok:true,resultat:'confirme',code:null,message:null,cible:{part:23,cut:97},identiteApres:{part:23,cut:97}};
 const p=await ouvrir(vue(),{'goto-cut':args=>{envois.push(args);return reponse;}});
 const etat=()=>[p.$('goto-cut-etat').attrs['data-etat'],p.$('goto-cut-etat').textContent];
 for(const v of ['','abc','23','23:','23:-1','23:1.5','-1:4','23:4:5',' 23 : 4x','1e3:2']){const n=p.notes.length;p.$('goto-cut-cible').value=v;await p.$('goto-cut').onclick();await p.attendre();
  assert.deepEqual(etat(),['refuse','cible invalide'],JSON.stringify(v));assert.equal(p.notes.length,n,'rien dans #notice');}
 assert.equal(envois.length,0,'rien n’est envoyé pour une cible invalide');
 let n=p.notes.length;p.$('goto-cut-cible').value='23:97';const enCours=p.$('goto-cut').onclick();
 assert.equal(p.$('goto-cut-etat').attrs['data-etat'],'en-cours','en cours pendant la demande');await enCours;await p.attendre();
 assert.deepEqual(JSON.parse(JSON.stringify(envois)),[{part:23,cut:97}],'l’action existante goto-cut, avec { part, cut }');
 assert.equal(etat()[0],'ok');assert.match(etat()[1],/97/);assert.equal(p.notes.length,n,'rien dans #notice');
 reponse={ok:false,resultat:'refuse',code:'WRONG_PART',message:'Partie demandée hors de la partie chargée. Rien n’a été envoyé à ESV.'};
 n=p.notes.length;p.$('goto-cut-cible').value='24:3';await p.$('goto-cut').onclick();await p.attendre();
 assert.deepEqual(etat(),['refuse','Partie demandée hors de la partie chargée. Rien n’a été envoyé à ESV.']);assert.equal(p.notes.length,n);
 const q=await ouvrir(vue(),{'goto-cut':()=>{throw Error('Ariane occupée');}});
 n=q.notes.length;q.$('goto-cut-cible').value='23:0';await q.$('goto-cut').onclick();await q.attendre();
 assert.equal(q.$('goto-cut-etat').attrs['data-etat'],'refuse');assert.equal(q.notes.length,n,'même une erreur ne va pas dans #notice');
});

test('nouveau panneau : le statut de connexion vient de l’état (plus du volet ouvert) ; « Reconnecter » dans la rangée des onglets ESV clique le bouton d’origine',async()=>{
 const p=await monter({stockage:{banane51Interface:'ariane2'},etat:vue()});
 p.els.connection.open=true;
 assert.equal(p.ui.instantane(vue()).connexionStatut,'ready');
 assert.equal(p.ui.instantane(vue({connection:{status:'unavailable',message:'x',tabId:1}})).connexionStatut,'unavailable');
 p.els.reconnect.hidden=false;p.els.reconnect.disabled=false;p.rendu(vue());
 assert.doesNotMatch(p.hote.innerHTML,/ESV n’est pas connecté/,'volet ouvert mais statut prêt : aucun message');
 assert.match(p.hote.innerHTML,/data-act="legacy:reconnect"/);
 p.ui.agir('legacy:reconnect');assert.equal(p.els.reconnect.clics,1);
 p.els.reconnect.disabled=true;p.rendu(vue({connection:{...pret,status:'reconnecting'}}));assert.match(p.hote.innerHTML,/data-act="legacy:reconnect"[^>]*disabled/);
 p.els.reconnect.hidden=true;p.rendu(vue({connection:{status:'no-tab',tabId:null}}));assert.doesNotMatch(p.hote.innerHTML,/legacy:reconnect/);
 p.ui.agir('aller:orbite');p.rendu(vue({connection:{status:'no-tab',tabId:null}}));assert.match(p.hote.innerHTML,/ESV n’est pas connecté/,'sans onglet : le message');
});
