'use strict';
/* RM-11 (test 9, fiches/RM11_RAISON_CORRECTION.md, essai 1) — le module pur `src/raison-correction.js` : catalogue, lecture d'une frappe, états
 * (posée, collante, effacée), délai de grâce, fin de série par chaque cause. Sans DOM, sans session. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../src/raison-correction.js');
const touche=(code,extra={})=>({type:'keydown',code,shiftKey:false,ctrlKey:false,altKey:false,metaKey:false,repeat:false,editable:false,...extra});
const REGLAGE=R.REGLAGE_DEFAUT;

test('catalogue : six raisons, codes stables, touches 1 à 6 ; 0 efface',()=>{
 assert.deepEqual(R.CATALOGUE.map(c=>[c.touche,c.code]),[['1','rail-voisin'],['2','adv'],['3','pn'],['4','nuage-pauvre'],['5','hauteur'],['6','autre']]);
 assert.deepEqual(R.CODES,['rail-voisin','adv','pn','nuage-pauvre','hauteur','autre']);
 for(const c of R.CATALOGUE)assert.ok(c.libelle&&c.libelle.length>=2,c.code);
 assert.equal(R.FORMAT,'ariane-raison-v1');
});
test('réglage par défaut : coupé, rangée du haut, 500 ms de grâce, 600 ms de double appui, 30 cuts de saut, rappel à 40',()=>{
 assert.deepEqual({...REGLAGE},{actif:false,touches:'chiffres',graceMs:500,doubleAppuiMs:600,sautCuts:30,rappelCollanteCuts:40});
 assert.ok(Object.isFrozen(REGLAGE));
});

test('lecture des touches : rangée du haut (code physique) et pavé numérique ; Maj toléré',()=>{
 for(let i=1;i<=6;i++){
  assert.deepEqual(R.lireFrappe(touche('Digit'+i)),{code:R.CODES[i-1]},'Digit'+i);
  assert.deepEqual(R.lireFrappe(touche('Numpad'+i)),{code:R.CODES[i-1]},'Numpad'+i);
  assert.deepEqual(R.lireFrappe(touche('Digit'+i,{shiftKey:true})),{code:R.CODES[i-1]},'Maj+Digit'+i);
 }
 assert.deepEqual(R.lireFrappe(touche('Digit0')),{efface:true});assert.deepEqual(R.lireFrappe(touche('Numpad0')),{efface:true});
 assert.deepEqual(R.lireFrappe(touche('Digit0',{shiftKey:true})),{efface:true});
 /* Le clavier français : la touche porte '&' sans Maj, '1' avec Maj ; seul le code physique compte. */
 assert.deepEqual(R.lireFrappe({...touche('Digit1'),key:'&'}),{code:'rail-voisin'});
});
test('lecture des touches : 7, 8, 9, lettres, Ctrl, Alt, Meta, touche tenue, champ de texte, relâchement : rien',()=>{
 for(const c of ['Digit7','Digit8','Digit9','Numpad7','KeyD','KeyW','Space','Enter','Backspace','ArrowLeft','F5','Minus',''])assert.equal(R.lireFrappe(touche(c)),null,c);
 for(const m of ['ctrlKey','altKey','metaKey'])assert.equal(R.lireFrappe(touche('Digit2',{[m]:true})),null,m);
 assert.equal(R.lireFrappe(touche('Digit2',{repeat:true})),null,'tenue');
 assert.equal(R.lireFrappe(touche('Digit2',{editable:true})),null,'champ de texte');
 assert.equal(R.lireFrappe({...touche('Digit2'),code:null}),null,'code masqué (champ de texte)');
 assert.equal(R.lireFrappe(touche('Digit2',{type:'keyup'})),null);assert.equal(R.lireFrappe(touche('Digit2',{type:'pointerdown'})),null);
 assert.equal(R.lireFrappe(null),null);assert.equal(R.lireFrappe({}),null);assert.equal(R.lireFrappe(undefined),null);
});
test('replis : Alt+chiffre seul, ou pavé numérique seul (réglage « touches »)',()=>{
 assert.deepEqual(R.lireFrappe(touche('Digit3',{altKey:true}),'alt-chiffres'),{code:'pn'});
 assert.deepEqual(R.lireFrappe(touche('Numpad3',{altKey:true}),'alt-chiffres'),{code:'pn'});
 assert.deepEqual(R.lireFrappe(touche('Digit0',{altKey:true}),'alt-chiffres'),{efface:true});
 assert.equal(R.lireFrappe(touche('Digit3'),'alt-chiffres'),null,'le chiffre seul ne compte plus');
 assert.equal(R.lireFrappe(touche('Digit3',{altKey:true,ctrlKey:true}),'alt-chiffres'),null);
 assert.deepEqual(R.lireFrappe(touche('Numpad4'),'pave'),{code:'nuage-pauvre'});assert.deepEqual(R.lireFrappe(touche('Numpad0'),'pave'),{efface:true});
 assert.equal(R.lireFrappe(touche('Digit4'),'pave'),null,'la rangée du haut ne compte plus');assert.equal(R.lireFrappe(touche('Numpad4',{altKey:true}),'pave'),null);
 assert.equal(R.lireFrappe(touche('Digit1'),'inconnue'),null,'table inconnue : rien lu');
 assert.deepEqual(R.TABLES,['chiffres','alt-chiffres','pave']);
});
test('chiffre de raison, quelle que soit la table : la frappe ne compte pas comme « autre geste » (autreGeste)',()=>{
 assert.equal(R.estTouchePossible('Digit4'),true);assert.equal(R.estTouchePossible('Numpad0'),true);assert.equal(R.estTouchePossible('Digit7'),false);assert.equal(R.estTouchePossible('KeyD'),false);
 const ev=(type,code,extra={})=>({type,code,editable:false,...extra});
 assert.equal(R.autreGeste([]),false);
 assert.equal(R.autreGeste([ev('keydown','Digit3'),ev('keyup','Digit3'),ev('keydown','Digit3')]),false,'les chiffres de raison et leurs relâchements');
 assert.equal(R.autreGeste([ev('keyup','Space'),ev('keyup','ShiftLeft')]),false,'relâchements de la validation');
 assert.equal(R.autreGeste([ev('keydown','ShiftLeft',{shiftKey:true})]),false,'modificateur seul');
 assert.equal(R.autreGeste([ev('keydown','KeyD')]),true);assert.equal(R.autreGeste([ev('pointerdown',null)]),true);assert.equal(R.autreGeste([ev('click',null)]),true);
 assert.equal(R.autreGeste([ev('keydown','Digit7')]),true,'un chiffre qui n\'est pas une raison est un geste');
 assert.equal(R.autreGeste([ev('keydown',null,{editable:true})]),false,'champ de texte');
});

const cible=(cut,extra={})=>({cutKey:`p|7|${cut}`,part:7,cut,...extra});
const frappe=(code,at,c,extra={})=>({code,at,poseeA:new Date(1e12+at).toISOString(),eventSeq:at,...cible(c),...extra});
const efface=(at,c)=>({efface:true,at,poseeA:new Date(1e12+at).toISOString(),eventSeq:at,...cible(c)});

test('un appui : raison pour ce cut seul, pas de collante',()=>{
 const e=R.nouvelEtat();const f=R.appuyer(e,frappe('adv',1000,100),REGLAGE);
 assert.deepEqual({...f},{type:'pose',code:'adv',source:'touche',serie:null,ouvre:false,ferme:null});
 assert.equal(e.collante,null);assert.equal(R.heriter(e,{part:7,cut:101},REGLAGE),null,'rien à hériter');
});
test('deux appuis sur la même touche en 600 ms sur le même cut : la raison devient collante et s\'applique aux cuts suivants',()=>{
 const e=R.nouvelEtat();R.appuyer(e,frappe('adv',1000,100),REGLAGE);
 const f=R.appuyer(e,frappe('adv',1450,100),REGLAGE);
 assert.deepEqual({...f},{type:'pose',code:'adv',source:'touche',serie:1,ouvre:true,ferme:null});
 assert.equal(e.collante.code,'adv');assert.equal(e.collante.serie,1);assert.equal(e.collante.cutDebut,100);assert.equal(e.collante.partie,7);
 for(const cut of [101,102,103]){const r=R.heriter(e,{part:7,cut},REGLAGE);assert.deepEqual({...r},{code:'adv',source:'collante',serie:1,eventSeq:1450},String(cut));}
 assert.equal(e.collante.cutFin,103);assert.equal(e.collante.nCuts,4,'le cut d\'ouverture et trois cuts hérités');
});
test('double appui trop lent (plus de 600 ms), ou sur un autre cut, ou touches différentes : pas de collante',()=>{
 let e=R.nouvelEtat();R.appuyer(e,frappe('adv',1000,100),REGLAGE);R.appuyer(e,frappe('adv',1601,100),REGLAGE);assert.equal(e.collante,null,'601 ms');
 e=R.nouvelEtat();R.appuyer(e,frappe('adv',1000,100),REGLAGE);R.appuyer(e,frappe('adv',1100,101),REGLAGE);assert.equal(e.collante,null,'autre cut');
 e=R.nouvelEtat();R.appuyer(e,frappe('adv',1000,100),REGLAGE);R.appuyer(e,frappe('pn',1100,100),REGLAGE);assert.equal(e.collante,null,'autre touche');
 e=R.nouvelEtat();R.appuyer(e,frappe('adv',1000,100),REGLAGE);R.appuyer(e,frappe('adv',1600,100),REGLAGE);assert.ok(e.collante,'600 ms pile : collante');
});
test('un troisième appui ne rouvre rien : la collante est déjà ouverte, il ne fait que poser la raison sur ce cut',()=>{
 const e=R.nouvelEtat();R.appuyer(e,frappe('adv',1000,100),REGLAGE);R.appuyer(e,frappe('adv',1200,100),REGLAGE);
 const f=R.appuyer(e,frappe('adv',1400,100),REGLAGE);assert.equal(f.ouvre,false);assert.equal(e.collante.serie,1);assert.equal(e.serieSuivante,2);
 /* Double appui de la même raison que la collante en cours, plus tard : la série continue, pas de nouvelle série. */
 R.appuyer(e,frappe('adv',9000,104),REGLAGE);const g=R.appuyer(e,frappe('adv',9200,104),REGLAGE);assert.equal(g.ouvre,false);assert.equal(e.series.length,0);assert.equal(e.collante.serie,1);
});
test('priorité : une raison tapée seule sur un cut passe avant la collante pour ce cut ; la collante reprend ensuite',()=>{
 const e=R.nouvelEtat();R.appuyer(e,frappe('adv',1000,100),REGLAGE);R.appuyer(e,frappe('adv',1200,100),REGLAGE);
 assert.equal(R.heriter(e,{part:7,cut:101},REGLAGE).code,'adv');
 const f=R.appuyer(e,frappe('nuage-pauvre',5000,101),REGLAGE);assert.deepEqual({...f},{type:'pose',code:'nuage-pauvre',source:'touche',serie:null,ouvre:false,ferme:null});
 assert.equal(e.collante.code,'adv','la collante n\'est pas finie');
 const r=R.heriter(e,{part:7,cut:102},REGLAGE);assert.deepEqual({code:r.code,source:r.source,serie:r.serie},{code:'adv',source:'collante',serie:1});
});
test('0 : efface la raison du cut et finit la collante (touche-0) ; sans collante, il n\'y a rien à finir',()=>{
 const e=R.nouvelEtat();R.appuyer(e,frappe('adv',1000,100),REGLAGE);R.appuyer(e,frappe('adv',1200,100),REGLAGE);R.heriter(e,{part:7,cut:101},REGLAGE);
 const f=R.appuyer(e,efface(3000,101),REGLAGE);assert.equal(f.type,'efface');assert.deepEqual({...f.ferme},{serie:1,code:'adv',partie:7,cutDebut:100,cutFin:101,nCuts:2,finPar:'touche-0'});
 assert.equal(e.collante,null);assert.equal(R.heriter(e,{part:7,cut:102},REGLAGE),null);assert.deepEqual(R.resumeSeries(e),[{serie:1,code:'adv',partie:7,cutDebut:100,cutFin:101,nCuts:2,finPar:'touche-0'}]);
 const g=R.appuyer(R.nouvelEtat(),efface(10,5),REGLAGE);assert.deepEqual({...g},{type:'efface',ferme:null});
});
test('fin de série par chaque cause : touche-0, autre-raison, changement-partie, saut, pause, fin-seance',()=>{
 const ouvrir=(e,code='adv',cut=100)=>{R.appuyer(e,frappe(code,1000,cut),REGLAGE);R.appuyer(e,frappe(code,1100,cut),REGLAGE);};
 const dernier=e=>R.resumeSeries(e).at(-1);
 /* autre-raison : un double appui d'une autre raison ferme l'ancienne série et en ouvre une seconde. */
 let e=R.nouvelEtat();ouvrir(e);R.heriter(e,{part:7,cut:101},REGLAGE);
 const f=R.appuyer(e,frappe('pn',5000,102),REGLAGE);const g=R.appuyer(e,frappe('pn',5200,102),REGLAGE);
 assert.equal(f.ouvre,false);assert.equal(g.ouvre,true);assert.deepEqual({...g.ferme},{serie:1,code:'adv',partie:7,cutDebut:100,cutFin:101,nCuts:2,finPar:'autre-raison'});
 assert.equal(e.collante.serie,2);assert.equal(e.collante.code,'pn');assert.equal(R.resumeSeries(e).length,2);
 /* changement-partie */
 e=R.nouvelEtat();ouvrir(e);R.heriter(e,{part:7,cut:101},REGLAGE);assert.equal(R.heriter(e,{part:8,cut:1},REGLAGE),null);assert.equal(dernier(e).finPar,'changement-partie');assert.equal(e.collante,null);
 /* saut : plus de 30 cuts du précédent (30 pile : la série continue) */
 e=R.nouvelEtat();ouvrir(e);assert.equal(R.heriter(e,{part:7,cut:130},REGLAGE).code,'adv','30 cuts : la série continue');
 assert.equal(R.heriter(e,{part:7,cut:161},REGLAGE),null,'31 cuts');assert.equal(dernier(e).finPar,'saut');assert.deepEqual([dernier(e).cutDebut,dernier(e).cutFin],[100,130]);
 e=R.nouvelEtat();ouvrir(e,'adv',200);assert.equal(R.heriter(e,{part:7,cut:150},REGLAGE),null,'saut en arrière');assert.equal(dernier(e).finPar,'saut');
 /* pause et fin de séance */
 e=R.nouvelEtat();ouvrir(e);R.finir(e,'pause');assert.equal(dernier(e).finPar,'pause');assert.equal(e.collante,null);
 e=R.nouvelEtat();ouvrir(e);R.heriter(e,{part:7,cut:101},REGLAGE);R.finir(e,'fin-seance');assert.equal(dernier(e).finPar,'fin-seance');assert.equal(dernier(e).nCuts,2);
 R.finir(e,'fin-seance');assert.equal(e.series.length,1,'finir deux fois : une seule fois consigné');
});
test('résumé des séries : une série encore ouverte est listée sans cause de fin',()=>{
 const e=R.nouvelEtat();R.appuyer(e,frappe('pn',1000,100),REGLAGE);R.appuyer(e,frappe('pn',1100,100),REGLAGE);R.heriter(e,{part:7,cut:101},REGLAGE);
 assert.deepEqual(R.resumeSeries(e),[{serie:1,code:'pn',partie:7,cutDebut:100,cutFin:101,nCuts:2,finPar:null}]);
 assert.deepEqual(R.resumeSeries(R.nouvelEtat()),[]);assert.deepEqual(R.resumeSeries(null),[]);
});
test('un cut revisité de suite (reprise après F5) n\'ajoute pas un cut à la série',()=>{
 const e=R.nouvelEtat();R.appuyer(e,frappe('adv',1000,100),REGLAGE);R.appuyer(e,frappe('adv',1100,100),REGLAGE);
 R.heriter(e,{part:7,cut:101},REGLAGE);R.heriter(e,{part:7,cut:101},REGLAGE);assert.equal(e.collante.nCuts,2);
});

test('rappel doux : la ligne de la collante le dit après 40 cuts (rien ne s\'arrête)',()=>{
 const e=R.nouvelEtat();R.appuyer(e,frappe('adv',1000,100),REGLAGE);R.appuyer(e,frappe('adv',1100,100),REGLAGE);
 for(let c=101;c<=138;c++)R.heriter(e,{part:7,cut:c},REGLAGE);assert.equal(e.collante.nCuts,39);assert.equal(R.vue(e,[]).rappel,false);
 R.heriter(e,{part:7,cut:139},REGLAGE);assert.equal(e.collante.nCuts,40);assert.equal(R.vue(e,[]).rappel,true);
 assert.equal(R.heriter(e,{part:7,cut:140},REGLAGE).code,'adv','le rappel n\'arrête rien');
});

test('raison de la visite : forme figée, historique de six changements au plus, effacement = code nul',()=>{
 const rec={};
 R.appliquer(rec,{code:'adv',source:'touche',serie:null,poseeA:'2026-10-19T09:00:00.000Z',eventSeq:7,apresValidationMs:null});
 assert.deepEqual(Object.keys(rec.raisonCorrection),['format','code','source','serie','poseeA','eventSeq','apresValidationMs','historique']);
 assert.deepEqual(rec.raisonCorrection,{format:'ariane-raison-v1',code:'adv',source:'touche',serie:null,poseeA:'2026-10-19T09:00:00.000Z',eventSeq:7,apresValidationMs:null,historique:[]});
 for(let i=0;i<9;i++)R.appliquer(rec,{code:R.CODES[i%6],source:'touche',serie:null,poseeA:'2026-10-19T09:00:0'+i+'.000Z',eventSeq:8+i,apresValidationMs:null});
 assert.equal(rec.raisonCorrection.historique.length,6);assert.equal(rec.raisonCorrection.historique.at(-1).code,R.CODES[7%6]);
 assert.deepEqual(Object.keys(rec.raisonCorrection.historique[0]),['code','source','poseeA']);
 R.effacer(rec,{poseeA:'2026-10-19T09:01:00.000Z',eventSeq:99,apresValidationMs:120});
 assert.equal(rec.raisonCorrection.code,null);assert.equal(rec.raisonCorrection.source,'touche');assert.equal(rec.raisonCorrection.apresValidationMs,120);assert.equal(rec.raisonCorrection.historique.length,6);
 const vide={};R.effacer(vide,{poseeA:'x',eventSeq:1,apresValidationMs:null});assert.equal('raisonCorrection' in vide,false,'rien à effacer : aucun champ');
});

test('délai de grâce : une touche tapée jusqu\'à 500 ms après la validation va au cut validé ; au-delà, au cut affiché',()=>{
 const valide=Date.parse('2026-10-19T09:00:00.000Z');
 assert.equal(R.delaiDeGrace(valide,valide+0,REGLAGE.graceMs),0);assert.equal(R.delaiDeGrace(valide,valide+320,REGLAGE.graceMs),320);
 assert.equal(R.delaiDeGrace(valide,valide+500,REGLAGE.graceMs),500);assert.equal(R.delaiDeGrace(valide,valide+501,REGLAGE.graceMs),null);
 assert.equal(R.delaiDeGrace(valide,valide-1,REGLAGE.graceMs),null,'avant la validation');assert.equal(R.delaiDeGrace(NaN,valide,500),null);assert.equal(R.delaiDeGrace(null,valide,500),null);
 const rec={operatorIntents:[{intent:'VALIDATE',observedAt:'2026-10-19T09:00:00.000Z'},{intent:'VALIDATE',observedAt:'2026-10-19T09:00:01.000Z'}]};
 assert.equal(R.derniereValidation(rec,valide+1500),valide+1000,'la dernière validation avant la frappe');assert.equal(R.derniereValidation(rec,valide+500),valide);
 assert.equal(R.derniereValidation(rec,valide-10),NaN);assert.equal(R.derniereValidation({operatorIntents:[{intent:'SKIP',observedAt:'2026-10-19T09:00:00.000Z'}]},valide+5),NaN);assert.equal(R.derniereValidation({},valide),NaN);
});

test('vue du panneau : raison du dernier cut, collante, bande des 24 derniers cuts, couverture',()=>{
 const e=R.nouvelEtat();R.appuyer(e,frappe('adv',1000,100),REGLAGE);R.appuyer(e,frappe('adv',1100,100),REGLAGE);
 const visites=Array.from({length:30},(_,i)=>({visitId:'v'+i,identity:{part:7,cut:100+i},...(i%3===0?{raison:'adv'}:{})}));
 const v=R.vue(e,visites);
 assert.equal(v.actif,true);assert.deepEqual({...v.collante},{code:'adv',libelle:'ADV',serie:1,nCuts:1,depuis:100});
 assert.equal(v.bande.length,24);assert.deepEqual(v.bande.at(-1),{cut:129,code:null});assert.deepEqual(v.bande[0],{cut:106,code:'adv'});
 assert.deepEqual({...v.couverture},{visites:24,avecRaison:8});
 assert.equal(R.vue(null,[]).actif,false);
});
