'use strict';
/* 4.9.5 test 6 (D-157, D-164) — LES CHOIX POUR LE LOT DANS LE PANNEAU. Panneau réel (panel.js) dans un contexte `vm`, DOM et API Chrome
 * simulés (tools/audit-qualite-480.cjs).
 *  - Trois choix du clic du mode rapide, aux libellés simples, et la phrase du coût ; l'interrupteur « grappe de différés » et sa phrase.
 *  - À l'ouverture, le panneau relit les choix gardés (`choix-lot-etat`) et coche ce qui l'est ; un clic les garde (`choix-lot`).
 *  - Pendant un lot, le panneau dit le mode du lot ; s'il diffère du choix, il dit que le choix servira au prochain lot.
 *  - Export : une ligne de CONTENU.txt dit les choix du lot. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {panneau}=require('../tools/audit-qualite-480.cjs');
const Settings=require('../src/settings.js');
const HTML=fs.readFileSync(path.join(__dirname,'../panel.html'),'utf8');
const lot=(etat,scope={})=>({current:{identity:{part:23,cut:120}},batch:{id:'lot-1',state:etat,scope:{part:23,start:100,end:120,...scope},processed:[],deferred:[],skipped:[],
 manuallyCompleted:[],paused:[],interrupted:[],sequence:[],activeIdentity:{part:23,cut:120}}});
const ouvrir=(etat,{scope={},choix={clicHumain:'tel-quel',regleGrappeDifferes:false},enregistre=null}={})=>panneau(etat?lot(etat,scope):{current:{identity:{part:23,cut:120}},batch:null},
 {globals:{BananeSettings:Settings},reponses:{'choix-lot-etat':choix,'choix-lot':args=>{const r={...choix,...args};if(enregistre)enregistre.push(args);return r;}}});
const coches=p=>['clic-tel-quel','clic-gauche-recentre','clic-tout-recentre'].filter(id=>p.$(id).checked);

test('panneau : trois choix aux libellés simples, la phrase du coût, l\'interrupteur et sa phrase ; aucun choix par défaut caché',()=>{
 for(const [id,v,l] of [['clic-tel-quel','tel-quel','Comme avant'],['clic-gauche-recentre','gauche-recentre','Variante : rail gauche recentré'],['clic-tout-recentre','tout-recentre','Tout recentré, comme un humain']])
  assert.match(HTML,new RegExp(`<input type="radio" name="clic-humain" id="${id}" value="${v}"> ${l}</label>`),l);
 assert.match(HTML,/<legend class="lbl">Clic du mode rapide<\/legend>/);
 assert.match(HTML,/id="clic-humain-cout">Durée d’un lot : \+6 à 9 % pour la variante, \+12 à 18 % pour « tout recentré »\.</);
 assert.match(HTML,/<input id="grappe-differes" type="checkbox"> Règle métier : mettre en attente les cuts d’une grappe \(aiguille, série de rouges\)<\/label>/);
 assert.match(HTML,/Ne pose jamais ailleurs : met en attente un cut qu’Ariane aurait validé\./);
 assert.match(HTML,/id="grappe-note">Coupée par défaut\./);
 assert.doesNotMatch(HTML,/name="clic-humain"[^>]*checked/,'rien n\'est coché dans le HTML : le panneau coche ce qui est gardé');
});

test('à l\'ouverture : les choix gardés sont relus et cochés ; un clic les garde, la note le dit',async()=>{
 const enr=[];const p=await ouvrir(null,{choix:{clicHumain:'gauche-recentre',regleGrappeDifferes:true},enregistre:enr});
 assert.equal(p.appels.filter(a=>a.action==='choix-lot-etat').length,1);
 assert.deepEqual(coches(p),['clic-gauche-recentre']);assert.equal(p.$('grappe-differes').checked,true);
 assert.equal(p.$('clic-humain-note').textContent,'Lu au démarrage de chaque lot, gardé jusqu’à sa fin.');
 assert.match(p.$('grappe-note').textContent,/^Activée pour le prochain lot\./);
 /* Clic sur « Tout recentré » : le service worker le garde. */
 p.$('clic-gauche-recentre').checked=false;p.$('clic-tout-recentre').checked=true;await p.$('clic-tout-recentre').onclick();await p.attendre();
 assert.deepEqual(JSON.parse(JSON.stringify(enr)),[{clicHumain:'tout-recentre'}]);assert.deepEqual(coches(p),['clic-tout-recentre']);
 assert.equal(p.$('notice').textContent,'Choix gardé pour le prochain lot.');
 /* Interrupteur décoché : gardé coupé. */
 p.$('grappe-differes').checked=false;await p.$('grappe-differes').onclick();await p.attendre();
 assert.deepEqual(JSON.parse(JSON.stringify(enr.at(-1))),{regleGrappeDifferes:false});assert.equal(p.$('grappe-differes').checked,false);
});

test('service worker sans réponse aux choix (ancienne version) : rien n\'est coché ni demandé de plus',async()=>{
 const p=await panneau(lot('RUNNING'),{globals:{BananeSettings:Settings}});
 assert.deepEqual(coches(p),[]);assert.equal(p.appels.filter(a=>a.action==='choix-lot').length,0);
});

test('pendant un lot : le panneau dit le mode du lot ; un choix différent servira au prochain lot',async()=>{
 let p=await ouvrir('RUNNING',{scope:{clicHumain:'gauche-recentre'},choix:{clicHumain:'gauche-recentre',regleGrappeDifferes:false}});
 assert.equal(p.$('clic-humain-note').textContent,'Ce lot utilise « Variante : rail gauche recentré ».');
 assert.equal(p.$('grappe-note').textContent,'Règle coupée dans ce lot.');
 /* Lot créé sans champ (défaut, ou par la test 5) : « Comme avant » ; le choix gardé, différent, attend le prochain lot. */
 p=await ouvrir('PAUSED',{choix:{clicHumain:'tout-recentre',regleGrappeDifferes:true}});
 assert.equal(p.$('clic-humain-note').textContent,'Ce lot garde « Comme avant » jusqu’à sa fin. « Tout recentré, comme un humain » servira au prochain lot.');
 assert.equal(p.$('grappe-note').textContent,'Règle coupée dans ce lot jusqu’à sa fin. Elle sera activée au prochain lot.');
 /* Changé pendant le lot : la note du panneau le dit. */
 p.$('clic-tel-quel').checked=true;await p.$('clic-tel-quel').onclick();await p.attendre();
 assert.equal(p.$('notice').textContent,'Choix gardé. Le lot en cours garde le sien jusqu’à sa fin ; ce choix servira au prochain lot.');
 /* Lot fini : plus de « ce lot ». */
 p=await ouvrir('COMPLETED',{scope:{clicHumain:'tout-recentre',regleGrappeDifferes:true}});
 assert.equal(p.$('clic-humain-note').textContent,'Lu au démarrage de chaque lot, gardé jusqu’à sa fin.');
});

test('export : la ligne de CONTENU.txt dit les choix du lot',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
 const debut=src.indexOf(' const NOMS_CLIC='),fin=src.indexOf(' function render(s){');
 const ctx={$:()=>null,document:{activeElement:null},OUVERT:['RUNNING'],state:null};vm.createContext(ctx);
 vm.runInContext(src.slice(debut,fin)+';this.texteChoixLot=texteChoixLot;',ctx);
 assert.equal(ctx.texteChoixLot(null),'');
 assert.equal(ctx.texteChoixLot({id:'lot-1',scope:{part:23}}),'Choix du lot lot-1 : clic du mode rapide « Comme avant » (tel-quel) ; règle métier « grappe de différés » coupée.\n');
 assert.equal(ctx.texteChoixLot({id:'lot-2',scope:{clicHumain:'gauche-recentre',regleGrappeDifferes:true}}),
  'Choix du lot lot-2 : clic du mode rapide « Variante : rail gauche recentré » (gauche-recentre) ; règle métier « grappe de différés » activée (chaque cut mis en attente : événement regles-metier-ombre, actif.applique, dans le journal).\n');
 assert.match(src,/corps:periode\+departs\+L\.texte\+VC\.texte\+texteChoixLot\(state\?\.batch\)/,'la ligne est dans CONTENU.txt');
});
