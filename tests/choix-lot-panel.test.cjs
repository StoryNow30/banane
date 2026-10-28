'use strict';
/* 4.9.5 test 6 (D-157, D-164) — LES CHOIX POUR LE LOT DANS LE PANNEAU. Panneau réel (panel.js) dans un contexte `vm`, DOM et API Chrome
 * simulés (tools/audit-qualite-480.cjs).
 *  - Trois choix du clic du mode rapide, aux libellés simples, et la phrase du coût ; l'interrupteur « grappe de différés » et sa phrase.
 *  - À l'ouverture, le panneau relit les choix gardés (`choix-lot-etat`) et coche ce qui l'est ; un clic les garde (`choix-lot`).
 *  - Test 7 : chaque choix dit « Dernier lot » (« Lot en cours » pendant un lot), lu dans le scope du lot, et « Prochain lot », le
 *    choix gardé. Après un lot, plus de « Activée pour le prochain lot » quand le lot venait de l'utiliser.
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
 /* Test 7 : le libellé dit ce que fait la règle (`grappe-differes`, src/regles-metier.js) : une série de DIFFÉRÉS du lot, pas de rouges ni d'aiguille. */
 assert.match(HTML,/<input id="grappe-differes" type="checkbox"> Mettre en attente les cuts voisins d’une série de différés<\/label>/);
 assert.match(HTML,/Ne pose rien, ne détecte pas les aiguilles\. Un cut qu’Ariane allait valider est mis en attente si le lot vient de différer au moins 2 cuts parmi les 6 d’avant, dont un à 2 cuts au plus\./);
 assert.doesNotMatch(HTML,/aiguille, série de rouges/);
 const R=require('../src/regles-metier.js');assert.deepEqual({...R.DEFAULTS.grappe},{fenetreCuts:6,differesMin:2,procheCuts:2},'les chiffres du libellé sont ceux de la règle');
 /* Les deux choix dans UNE carte, sous le titre du groupe. */
 assert.match(HTML,/<h2 id="groupe-choix-titre"[^>]*>Règles et choix du prochain lot<\/h2>\s*<div id="carte-choix" class="carte[^"]*">\s*<fieldset id="clic-humain"[\s\S]*<div id="grappe-row"/);
 assert.match(HTML,/id="grappe-note">Coupée par défaut\./);
 assert.doesNotMatch(HTML,/name="clic-humain"[^>]*checked/,'rien n\'est coché dans le HTML : le panneau coche ce qui est gardé');
});

test('à l\'ouverture : les choix gardés sont relus et cochés ; un clic les garde, la note le dit',async()=>{
 const enr=[];const p=await ouvrir(null,{choix:{clicHumain:'gauche-recentre',regleGrappeDifferes:true},enregistre:enr});
 assert.equal(p.appels.filter(a=>a.action==='choix-lot-etat').length,1);
 assert.deepEqual(coches(p),['clic-gauche-recentre']);assert.equal(p.$('grappe-differes').checked,true);
 assert.equal(p.$('clic-humain-note').textContent,'Lu au démarrage de chaque lot, gardé jusqu’à sa fin.');
 assert.equal(p.$('clic-dernier').textContent,'aucun lot');assert.equal(p.$('clic-prochain').textContent,'« Variante : rail gauche recentré »');
 assert.equal(p.$('grappe-dernier').textContent,'aucun lot');assert.equal(p.$('grappe-prochain').textContent,'règle activée');
 /* Clic sur « Tout recentré » : le service worker le garde. */
 p.$('clic-gauche-recentre').checked=false;p.$('clic-tout-recentre').checked=true;await p.$('clic-tout-recentre').onclick();await p.attendre();
 assert.deepEqual(JSON.parse(JSON.stringify(enr)),[{clicHumain:'tout-recentre'}]);assert.deepEqual(coches(p),['clic-tout-recentre']);
 assert.equal(p.$('clic-prochain').textContent,'« Tout recentré, comme un humain »');
 assert.equal(p.$('notice').textContent,'Choix gardé pour le prochain lot.');
 /* Interrupteur décoché : gardé coupé. */
 p.$('grappe-differes').checked=false;await p.$('grappe-differes').onclick();await p.attendre();
 assert.deepEqual(JSON.parse(JSON.stringify(enr.at(-1))),{regleGrappeDifferes:false});assert.equal(p.$('grappe-differes').checked,false);
});

test('service worker sans réponse aux choix (ancienne version) : rien n\'est coché ni demandé de plus',async()=>{
 const p=await panneau(lot('RUNNING'),{globals:{BananeSettings:Settings}});
 assert.deepEqual(coches(p),[]);assert.equal(p.appels.filter(a=>a.action==='choix-lot').length,0);
 /* Le lot en cours se lit quand même dans son scope ; le prochain reste inconnu. */
 assert.equal(p.$('clic-dernier-l').textContent,'Lot en cours');assert.equal(p.$('clic-dernier').textContent,'« Comme avant »');assert.notEqual(p.$('clic-prochain').textContent,'« Comme avant »','rien n’est écrit pour le prochain lot');assert.match(HTML,/<dd id="clic-prochain">—<\/dd>/);
});

test('pendant un lot : « Lot en cours » (son scope) et « Prochain lot » (le choix gardé) ; un choix différent attend le prochain lot',async()=>{
 let p=await ouvrir('RUNNING',{scope:{clicHumain:'gauche-recentre'},choix:{clicHumain:'gauche-recentre',regleGrappeDifferes:false}});
 assert.equal(p.$('clic-dernier-l').textContent,'Lot en cours');assert.equal(p.$('clic-dernier').textContent,'« Variante : rail gauche recentré »');
 assert.equal(p.$('clic-prochain').textContent,'« Variante : rail gauche recentré »');
 assert.equal(p.$('clic-humain-note').textContent,'Lu au démarrage de chaque lot, gardé jusqu’à sa fin.');
 assert.equal(p.$('grappe-dernier-l').textContent,'Lot en cours');assert.equal(p.$('grappe-dernier').textContent,'règle coupée');assert.equal(p.$('grappe-prochain').textContent,'règle coupée');
 /* Lot créé sans champ (défaut, ou par la test 5) : « Comme avant » ; le choix gardé, différent, attend le prochain lot. */
 p=await ouvrir('PAUSED',{choix:{clicHumain:'tout-recentre',regleGrappeDifferes:true}});
 assert.equal(p.$('clic-dernier').textContent,'« Comme avant »');assert.equal(p.$('clic-prochain').textContent,'« Tout recentré, comme un humain »');
 assert.equal(p.$('clic-humain-note').textContent,'Le lot en cours garde le sien jusqu’à sa fin ; le choix coché servira au prochain lot.');
 assert.equal(p.$('grappe-dernier').textContent,'règle coupée');assert.equal(p.$('grappe-prochain').textContent,'règle activée');
 assert.equal(p.$('grappe-note').textContent,'Le lot en cours garde la sienne jusqu’à sa fin ; la case servira au prochain lot.');
 /* Changé pendant le lot : la note du panneau le dit. */
 p.$('clic-tel-quel').checked=true;await p.$('clic-tel-quel').onclick();await p.attendre();
 assert.equal(p.$('notice').textContent,'Choix gardé. Le lot en cours garde le sien jusqu’à sa fin ; ce choix servira au prochain lot.');
});

test('après un lot (retour de l\'opérateur) : « Dernier lot » dit ce que le lot a UTILISÉ, jamais « activée pour le prochain lot »',async()=>{
 for(const etat of ['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','STOPPED']){
  const p=await ouvrir(etat,{scope:{clicHumain:'tout-recentre',regleGrappeDifferes:true},choix:{clicHumain:'tout-recentre',regleGrappeDifferes:true}});
  assert.equal(p.$('clic-dernier-l').textContent,'Dernier lot',etat);assert.equal(p.$('clic-dernier').textContent,'« Tout recentré, comme un humain »');
  assert.equal(p.$('grappe-dernier-l').textContent,'Dernier lot');assert.equal(p.$('grappe-dernier').textContent,'règle activée');
  assert.equal(p.$('grappe-prochain').textContent,'règle activée');
  assert.doesNotMatch(p.$('grappe-note').textContent+p.$('clic-humain-note').textContent,/prochain lot/,'les notes ne prêtent plus au prochain lot ce que le dernier a utilisé');
  assert.equal(p.$('resultats-titre').textContent,'Résultats du dernier lot');}
 /* Le choix gardé a changé depuis : les deux lignes diffèrent, chacune exacte. */
 const p=await ouvrir('COMPLETED',{scope:{regleGrappeDifferes:true},choix:{clicHumain:'gauche-recentre',regleGrappeDifferes:false}});
 assert.equal(p.$('clic-dernier').textContent,'« Comme avant »');assert.equal(p.$('clic-prochain').textContent,'« Variante : rail gauche recentré »');
 assert.equal(p.$('grappe-dernier').textContent,'règle activée');assert.equal(p.$('grappe-prochain').textContent,'règle coupée');
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
