'use strict';
/* CH-025 — LA FILE DE PARTIES DANS SIGNAL (src/ui5.js, src/signal-rendu.js), contre la page minimale (tests/helpers/ui5-page.cjs) : la carte
 * `#file-parties` du panneau d'avant (CH-017, panel.js `afficherFile`) est lue comme Signal lit les autres cartes, et chaque clic de Signal est un clic
 * sur son bouton d'origine (`#file-principal`, `#file-secondaire`, `#file-n button`). Rien n'apparaît sans `fileParties` dans la vue ; aucun message
 * nouveau. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {monter}=require('./helpers/ui5-page.cjs');
const js=x=>JSON.parse(JSON.stringify(x));
const ORDRE=['start-batch','resume','retry','manual-takeover','manual-completion','close-uncertain','pause','export-tout','new-batch','relecture-acquitter','relecture-arreter','relecture-lancer','passe-differes-lancer','explicit-skip','stop'];
const LOT={id:'L1',scope:{part:13,start:4800,end:999999},state:'RUNNING',processed:[],deferred:[],activeIdentity:{part:13,cut:4812}};
const etat=(batch,extra={})=>({batch,current:{identity:{part:13,cut:4812}},connection:{status:'ready',tabId:12},native:{status:'IDLE',visits:[]},...extra});

/* La carte telle que panel.js `afficherFile` la laisse : `carte` dit ce qui est écrit dans chaque élément. */
function poser(p,{etatTexte='prête',phrase='',reglage=true,choisi=2,alerte='',bilan=[],principal=null,secondaire=null}={}){
 const E=p.els;E['file-parties'].hidden=false;
 E['file-etat'].textContent=etatTexte;E['file-phrase'].textContent=phrase;E['file-reglage'].hidden=!reglage;
 E['file-n'].children=[1,2,3,4,5,8].map(n=>({dataset:{n:String(n)},disabled:false,clics:0,click(){this.clics++;},getAttribute:a=>a==='aria-pressed'?String(n===choisi):null}));
 E['file-alerte'].hidden=!alerte;E['file-alerte'].textContent=alerte;
 E['file-bilan'].hidden=!bilan.length;E['file-bilan'].querySelectorAll=s=>s==='li'?bilan.map(t=>({textContent:t})):[];
 for(const [id,t] of [['file-principal',principal],['file-secondaire',secondaire]]){E[id].hidden=t===null;E[id].textContent=t||'';E[id].disabled=false;}
}
/* Orbite prête : l'onglet 12 listé et nommé, « Démarrer le lot » seul visible parmi les boutons du lot. */
async function pret(extra){
 const p=await monter({etat:etat(null,extra)});
 for(const id of ORDRE)p.els[id].hidden=id!=='start-batch';
 Object.assign(p.els['start-batch'],{className:'primary',textContent:'Démarrer le lot'});
 p.els.tabs.options=[{value:'12',textContent:'ESV · partie 13'}];p.els.tabs.value='12';
 p.els['lot-bornes'].hidden=true;
 return p;
}
const html=p=>{p.ui.maj(true);return p.hote.innerHTML;};

test('sans `fileParties` dans la vue (file éteinte), Signal ne montre rien de la file',async()=>{
 const p=await pret({});p.els['file-parties'].hidden=true;
 const h=html(p);
 assert.match(h,/Démarrer le lot/);assert.doesNotMatch(h,/File de parties|file-principal|sg:file/);
 assert.equal(p.ui.instantane(etat(null)).file,null);
});

test('au repos, écran « Prêt » : une entrée « File de parties · prête » ouvre la boîte ; le nombre et « Préparer » cliquent la carte d’origine',async()=>{
 const p=await pret({fileParties:null});poser(p,{principal:'Préparer la file'});
 let h=html(p);
 assert.match(h,/data-act="sg:file"[^>]*>File de parties · prête</);
 assert.match(h,/class="sg-principal"[^>]*data-act="legacy:start-batch"/,'« Démarrer le lot » reste l’action principale');
 assert.doesNotMatch(h,/sg-boite/,'la boîte est fermée');
 p.ui.agir('sg:file');h=p.hote.innerHTML;
 assert.match(h,/class="sg-boite"[^>]*role="dialog"/);
 for(const n of [1,2,3,4,5,8])assert.match(h,new RegExp(`aria-pressed="${n===2}" data-act="sg:file-n:${n}"`),'nombre '+n);
 assert.match(h,/data-act="legacy:file-principal"[^>]*><span>Préparer la file</);
 p.ui.agir('sg:file-n:3');
 assert.equal(p.els['file-n'].children.find(b=>b.dataset.n==='3').clics,1,'le bouton 3 de la carte est cliqué');
 assert.equal(p.ui.ui.couche,'file','la boîte reste ouverte');
 p.ui.agir('legacy:file-principal');assert.equal(p.els['file-principal'].clics,1);
 assert.deepEqual(js(p.envoyes),[],'aucun message nouveau');
});

test('préparée : « Lancer la file » devient l’action principale, « Démarrer le lot » passe à côté ; rien n’est lancé sans clic',async()=>{
 const p=await pret({fileParties:null});
 poser(p,{etatTexte:'préparée',phrase:'Préparée · 2 parties à partir de la partie affichée · rien n’est lancé.',principal:'Lancer la file · 2 parties'});
 const h=html(p);
 assert.match(h,/class="sg-principal"[^>]*data-act="legacy:file-principal"[^>]*>.*Lancer la file · 2 parties/);
 assert.match(h,/class="sg-secondaire"[^>]*data-act="legacy:start-batch"/);
 assert.match(h,/File de parties · préparée/);assert.match(h,/Rien n’est lancé/);
 assert.equal(p.els['file-principal'].clics,0);
});

test('l’entrée n’existe que dans l’écran « Prêt » : pas pendant un lot hors file',async()=>{
 const p=await pret({fileParties:null});poser(p,{principal:'Préparer la file'});
 p.els.pause.hidden=false;p.els.pause.textContent='Pause';
 p.rendu(etat(LOT,{fileParties:null}));
 assert.doesNotMatch(p.hote.innerHTML,/File de parties/);
});

test('pendant la file : bandeau « partie 1 sur 2 · lot en cours » et « Arrêter la file » (clic de `#file-secondaire`) ; ni « Démarrer » ni « Nouveau lot »',async()=>{
 const F={etat:'lot',n:2,rang:0,enCours:{part:13,rang:0,lot:true},changement:null,bilan:[],alerte:null,motifFin:null};
 const p=await pret({fileParties:F});poser(p,{etatTexte:'partie 1 sur 2',phrase:'Partie 13 · lot en cours.',reglage:false,secondaire:'Arrêter la file'});
 p.els.pause.hidden=false;p.els.pause.textContent='Pause';p.els['new-batch'].hidden=false;p.els['new-batch'].textContent='Nouveau lot';
 p.els.stop.hidden=false;p.els.stop.textContent='Arrêter le lot';
 p.rendu(etat(LOT,{fileParties:F}));const h=p.hote.innerHTML;
 assert.match(h,/class="sg-file"/);
 /* CH-026 : « Arrêter le lot » (`stop`) arrête toute la file : retiré pendant la file (arrêt du test 26). */
 assert.doesNotMatch(h,/data-act="legacy:stop"/);assert.match(h,/partie 1 sur 2/);assert.match(h,/Partie 13 · lot en cours/);
 assert.match(h,/class="sg-secondaire sg-danger" data-act="legacy:file-secondaire"[^>]*>Arrêter la file</);
 assert.doesNotMatch(h,/legacy:new-batch|legacy:start-batch/);
 assert.match(h,/relecture et correction<\/b>, toujours/);
 p.ui.agir('legacy:file-secondaire');assert.equal(p.els['file-secondaire'].clics,1);
 assert.deepEqual(js(p.envoyes),[]);
});

test('pendant la deuxième passe et la relecture de la file : le bandeau et « Arrêter la file » restent',async()=>{
 for(const [phase,ph] of [['passe','deuxième passe'],['relecture','relecture et correction']]){
  const F={etat:phase,n:2,rang:0,enCours:{part:13,rang:0,lot:true},changement:null,bilan:[],alerte:null};
  const p=await pret({fileParties:F});poser(p,{etatTexte:'partie 1 sur 2',phrase:`Partie 13 · ${ph}.`,reglage:false,secondaire:'Arrêter la file'});
  const b={...LOT,state:'COMPLETED',activeIdentity:null};
  p.rendu(etat(b,{fileParties:F,passeDifferes:phase==='passe'?{etat:'ecriture',lotId:'L1',cut:4813,ecrites:1,demandees:3}:null}));
  const h=p.hote.innerHTML;
  assert.match(h,new RegExp(`Partie 13 · ${ph}`),phase);assert.match(h,/data-act="legacy:file-secondaire"/,phase);
 }
});

test('changement de partie : « Changement de partie », vers la partie suivante, aucune action du lot fini ; « Arrêter la file » reste',async()=>{
 const F={etat:'changement',n:2,rang:1,enCours:null,changement:{vers:14,tentatives:1},bilan:[{part:13}],alerte:null};
 const p=await pret({fileParties:F});poser(p,{etatTexte:'partie 2 sur 2',phrase:'Partie 14 · changement de partie vers la partie 14.',reglage:false,secondaire:'Arrêter la file'});
 p.els['export-tout'].hidden=false;p.els['export-tout'].textContent='Exporter';p.els['new-batch'].hidden=false;p.els['new-batch'].textContent='Nouveau lot';
 p.rendu(etat({...LOT,state:'COMPLETED',activeIdentity:null},{fileParties:F}));const h=p.hote.innerHTML;
 assert.match(h,/class="sg-mot">Changement de partie</);assert.match(h,/partie <span class="sg-mono">14<\/span>/);
 assert.doesNotMatch(h,/legacy:new-batch|legacy:start-batch/);assert.match(h,/data-act="legacy:file-secondaire"/);
});

test('file arrêtée sur une alerte, lot clos : « File arrêtée », l’alerte, le bilan par partie, « Préparer la reprise » (clic de `#file-principal`)',async()=>{
 const F={etat:'arret',n:2,rang:1,enCours:null,changement:null,bilan:[{part:13}],alerte:{texte:'la page d’ESV ne change pas de partie'},motifFin:{code:'changement-impossible',texte:'la page d’ESV ne change pas de partie'}};
 const p=await pret({fileParties:F});
 poser(p,{etatTexte:'arrêtée',phrase:'la page d’ESV ne change pas de partie · 1 partie faite sur 2 · rien exporté.',reglage:false,alerte:'la page d’ESV ne change pas de partie.',
  bilan:['Partie 13 · 120 posés, 6 différés · relecture finie, 3 corrigés'],principal:'Préparer la reprise · 1 partie restante'});
 p.els['export-tout'].hidden=false;p.els['export-tout'].textContent='Exporter';
 p.rendu(etat({...LOT,state:'COMPLETED',activeIdentity:null},{fileParties:F}));const h=p.hote.innerHTML;
 assert.match(h,/class="sg-mot">File arrêtée</);assert.match(h,/role="alert"[^>]*>.*la page d’ESV ne change pas de partie/s);
 assert.match(h,/1 partie faite sur 2/);assert.match(h,/<li>Partie 13 · 120 posés, 6 différés · relecture finie, 3 corrigés<\/li>/);
 assert.match(h,/class="sg-principal"[^>]*data-act="legacy:file-principal"[^>]*>.*Préparer la reprise · 1 partie restante/);
 p.ui.agir('legacy:file-principal');assert.equal(p.els['file-principal'].clics,1);
});

test('file finie : « File terminée », le bilan, « Fermer le bilan » ; l’export reste un bouton, jamais automatique',async()=>{
 const F={etat:'fin',n:2,rang:2,enCours:null,changement:null,bilan:[{part:13},{part:14}],alerte:null,motifFin:null};
 const p=await pret({fileParties:F});
 poser(p,{etatTexte:'terminée',phrase:'2 parties faites · la file s’est éteinte. Export : prêt, jamais automatique.',reglage:false,bilan:['Partie 13 · …','Partie 14 · …'],principal:'Fermer le bilan'});
 p.els['export-tout'].hidden=false;p.els['export-tout'].textContent='Exporter';
 p.rendu(etat({...LOT,state:'COMPLETED',activeIdentity:null},{fileParties:F}));const h=p.hote.innerHTML;
 assert.match(h,/class="sg-mot">File terminée</);assert.match(h,/la file s’est éteinte/);assert.equal((h.match(/<li>Partie 1[34]/g)||[]).length,2);
 assert.match(h,/data-act="legacy:file-principal"[^>]*>.*Fermer le bilan/);assert.match(h,/data-act="legacy:export-tout"/);
 assert.equal(p.els['export-tout'].clics,0);assert.deepEqual(js(p.envoyes),[]);
});

test('palette : « File de parties » au repos, « Arrêter la file » pendant la file (commande dangereuse : seconde Entrée)',async()=>{
 const S5=require('../src/signal-rendu.js');
 const p=await pret({fileParties:null});poser(p,{principal:'Préparer la file'});
 let L=S5.paletteListe(p.ui.instantane(etat(null,{fileParties:null})),{q:'file'});
 assert.ok(L.some(c=>c.act==='sg:file'&&/^File de parties/.test(c.nom)));
 const F={etat:'lot',n:2,rang:0,enCours:{part:13,rang:0,lot:true},changement:null,bilan:[],alerte:null};
 poser(p,{etatTexte:'partie 1 sur 2',phrase:'Partie 13 · lot en cours.',reglage:false,secondaire:'Arrêter la file'});
 L=S5.paletteListe(p.ui.instantane(etat(LOT,{fileParties:F})),{q:'file'});
 const a=L.find(c=>c.act==='legacy:file-secondaire');assert.ok(a);assert.equal(a.danger,true);assert.equal(a.off,'');
});
