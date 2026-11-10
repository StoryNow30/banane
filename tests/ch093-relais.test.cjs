'use strict';
/* CH-093 — RELAIS DU SERVICE WORKER : la première coupe relue va au préchauffage de la page.
 * La liste des coupes à relire (`relectureEntree` puis `BananeRelectureOmbre.selection`, triée par coupe croissante) n'existe que dans le service
 * worker, et seulement à la clôture du lot. Trois moments :
 *  - clôture du lot avec la passe des différés en écriture : sélection PROVISOIRE (la relecture attend la passe), envoyée par la commande `prechauffer` ;
 *  - pendant la passe : `loin` des captures de la passe étendu à la première coupe relue (`mode:true`), dernière capture comprise (indice sans `cut`) ;
 *  - sélection de la relecture connue (`relectureLancer`, lancement automatique ou à la main) : la vraie première coupe, par la même commande.
 * Les fonctions sont extraites de background.js et jouées dans un bac (vm) avec de faux appels à la page. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SRC=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),R=require('../src/relecture-ombre.js'),O=require('../src/esv-observer.js'),{world}=require('./helpers/fake-page.cjs');
const J=x=>JSON.parse(JSON.stringify(x??null));
function bac({prechauffer={actif:true,voie:'potree',loin:{actif:true,sautMin:11,coupesMax:40},relecture:{actif:true,sautMin:11}},capacites=['changerPartie','prechauffer'],label={part:23,cut:120},
  passe='ecriture',entree=null,reponse={lance:true}}={}){
 const a=SRC.indexOf('function avecPrechauffage('),b=SRC.indexOf('\nasync function passeDiffPoser(');assert.ok(a>0&&b>a);
 const appels=[],journal=[];
 const ctx={globalThis:{BananeCore3:{uid:()=>'u'},BananeSettings:{lot:{chargement:{prechauffer}}},BananeRelectureOmbre:R},selectedTab:7,appels,journal,
  call:async(action,...args)=>{appels.push([action,...J(args)]);if(action==='ping')return {label,capacites};if(action==='prechauffer')return reponse;throw Error('commande inattendue : '+action);},
  journalerSimple:(type,champs)=>journal.push({type,...J(champs)}),
  relectureEntree:async()=>{ctx.entrees++;return entree;},entrees:0,relectureReglages:async()=>({selection:undefined}),reglageRelecture:()=>({plafondCuts:null,plafondParZone:null}),
  passeDiffReglage:()=>({mode:passe}),relecture:{passe:null},engine:{s:{batch:null}}};
 vm.createContext(ctx);
 vm.runInContext(SRC.slice(a,b)+';this.f={avecPrechauffage,cibleLoinListe,relecturePremiere,relectureAnticiperEnvoyer,relectureAnticiperProvisoire,relectureOptionsSelection,relectureAnticipee};',ctx);
 return ctx;}
const LOT={id:'lot-1',scope:{part:23}};

test('cible lointaine de la passe : la première coupe relue ferme la chaîne, marquée `mode`',()=>{
 const c=bac().f.cibleLoinListe;
 assert.deepEqual(J(c(120,[121,122],20)),{cut:20,avant:2,saut:-102,mode:true},'après les cuts proches de la passe');
 assert.deepEqual(J(c(120,[],20)),{cut:20,avant:0,saut:-100,mode:true},'dernier cut de la passe');
 assert.deepEqual(J(c(120,[121,300],20)),{cut:300,avant:1,saut:179},'un saut lointain de la passe passe avant');
 assert.equal(c(120,[121],125),null,'première coupe relue proche : rien');
 assert.equal(c(120,[121],undefined),null,'sans première coupe connue : comme CH-088');
 assert.deepEqual(J(c(20,[21,22,90,91])),{cut:90,avant:2,saut:68},'CH-088 inchangé');
});
test('réglages : `relecture` éteint, la chaîne s\'arrête à la passe ; `loin` éteint, seule la première coupe relue est jointe',()=>{
 const sansRel=bac({prechauffer:{actif:true,voie:'potree',loin:{actif:true,sautMin:11,coupesMax:40},relecture:{actif:false}}}).f.cibleLoinListe;
 assert.equal(sansRel(120,[121],20),null);assert.deepEqual(J(sansRel(120,[300],20)),{cut:300,avant:0,saut:180});
 const sansLoin=bac({prechauffer:{actif:true,voie:'potree',loin:{actif:false},relecture:{actif:true,sautMin:11}}}).f.cibleLoinListe;
 assert.deepEqual(J(sansLoin(120,[121,300],20)),{cut:20,avant:2,saut:-280,mode:true},'le saut de la passe n\'est pas joint, la première coupe relue oui');
 assert.equal(sansLoin(120,[121]),undefined,'rien à joindre');
 const eteint=bac({prechauffer:{actif:false,voie:'potree',loin:{actif:true},relecture:{actif:true}}}).f.cibleLoinListe;assert.equal(eteint(120,[121],20),undefined);
});
test('dernière capture de la passe : l\'indice part sans `cut` s\'il porte la première coupe relue, jamais autrement',()=>{
 const f=bac().f.avecPrechauffage,e={identity:{part:23,cut:120}};
 assert.deepEqual(J(f(e,undefined,'passe-differes',undefined,{cut:20,avant:0,saut:-100,mode:true}).prechauffage),{part:23,de:120,source:'passe-differes',op:'u',loin:{cut:20,avant:0,saut:-100,mode:true}});
 assert.equal(f(e,undefined,'passe-differes',undefined,{cut:300,avant:0,saut:180}),e,'sans `mode` : état inchangé');
 assert.equal(f(e,undefined,'passe-differes',undefined,null),e);assert.equal(f(e,undefined,'relu',undefined,undefined),e);
 assert.deepEqual(J(f(e,121,'passe-differes',122,{cut:20,avant:2,saut:-102,mode:true}).prechauffage),{part:23,de:120,cut:121,source:'passe-differes',op:'u',apres:122,loin:{cut:20,avant:2,saut:-102,mode:true}});
});
test('commande `prechauffer` : ping (capacité, partie), envoi, une seule fois par coupe, journal `relecture-anticipee`',async()=>{
 const b=bac(),f=b.f;
 assert.equal(await f.relectureAnticiperEnvoyer(LOT,20,'selection'),'envoyee');
 assert.deepEqual(b.appels,[['ping'],['prechauffer',{part:23,cut:20,source:'changement-mode'}]]);
 assert.deepEqual(b.journal,[{type:'relecture-anticipee',lotId:'lot-1',quand:'selection',issue:'envoyee',cut:20,de:120}]);
 assert.equal(f.relecturePremiere(LOT),20);assert.equal(f.relecturePremiere({id:'autre'}),undefined);
 assert.equal(await f.relectureAnticiperEnvoyer(LOT,20,'selection'),'deja-envoyee');assert.equal(b.appels.length,2,'pas de second envoi');
 assert.equal(await f.relectureAnticiperEnvoyer(LOT,31,'selection'),'envoyee','la vraie sélection corrige la provisoire');assert.equal(f.relecturePremiere(LOT),31);
 for(const cut of [undefined,null,-1,1.5])assert.equal(await f.relectureAnticiperEnvoyer(LOT,cut,'selection'),null);
});
test('page sans la commande (adaptateur sans le patch), autre partie, refus de la page, réglage éteint : rien n\'est commandé',async()=>{
 let b=bac({capacites:['changerPartie']});assert.equal(await b.f.relectureAnticiperEnvoyer(LOT,20,'cloture'),'page-sans-commande');assert.deepEqual(b.appels,[['ping']]);assert.deepEqual(b.journal,[],'rien au journal : le journal du lot reste celui d\'avant');
 assert.equal(b.f.relecturePremiere(LOT),20,'la passe la joindra quand même à ses captures');
 b=bac({label:{part:24,cut:3}});assert.equal(await b.f.relectureAnticiperEnvoyer(LOT,20,'cloture'),'autre-partie');assert.deepEqual(b.appels,[['ping']]);
 b=bac({reponse:{lance:false,motif:'eteint'}});assert.equal(await b.f.relectureAnticiperEnvoyer(LOT,20,'cloture'),'refusee');
 assert.equal(await b.f.relectureAnticiperEnvoyer(LOT,20,'selection'),'refusee','un refus n\'empêche pas de redemander');
 for(const prechauffer of [{actif:true,voie:'potree',relecture:{actif:false}},{actif:false,voie:'potree',relecture:{actif:true}},{actif:true,voie:'fetch',relecture:{actif:true}},null]){
  b=bac({prechauffer});assert.equal(await b.f.relectureAnticiperEnvoyer(LOT,20,'cloture'),null);assert.deepEqual(b.appels,[],'pas même un ping');assert.deepEqual(b.journal,[]);assert.equal(b.f.relecturePremiere(LOT),undefined);}
 b=bac();b.selectedTab=null;assert.equal(await b.f.relectureAnticiperEnvoyer(LOT,20,'cloture'),null);
});
test('clôture du lot : sélection provisoire seulement si la passe des différés écrit ; mêmes options que la relecture',async()=>{
 const entree={partie:23,total:300,lot:[{cut:50,differe:false},{cut:51,differe:false},{cut:52,differe:true},{cut:119,differe:false},{cut:120,differe:true}],zonesPN:[],zonesADV:[],aControler:[],ecartement:[]};
 const attendu=R.selection(entree,R.optionsSelection(undefined)).cuts[0]?.cut;assert.ok(Number.isInteger(attendu)&&attendu<109,'la sélection commence loin derrière la fin du lot : '+attendu);
 let b=bac({entree});const p={etat:'preparation'};b.relecture.passe=p;b.engine.s.batch=LOT;
 assert.equal(await b.f.relectureAnticiperProvisoire(LOT,p),'envoyee');
 assert.deepEqual(b.appels.at(-1),['prechauffer',{part:23,cut:attendu,source:'changement-mode'}]);assert.equal(b.journal[0].quand,'cloture');
 /* passe en ombre ou coupée : la relecture part tout de suite et calcule elle-même sa sélection : aucun double calcul */
 b=bac({entree,passe:'ombre'});b.relecture.passe=p;b.engine.s.batch=LOT;assert.equal(await b.f.relectureAnticiperProvisoire(LOT,p),null);assert.equal(b.entrees,0);assert.deepEqual(b.appels,[]);
 /* passe de relecture remplacée, lot changé, sélection vide : rien */
 b=bac({entree});b.relecture.passe={etat:'preparation'};b.engine.s.batch=LOT;assert.equal(await b.f.relectureAnticiperProvisoire(LOT,p),null);assert.deepEqual(b.appels,[]);
 b=bac({entree});b.relecture.passe=p;b.engine.s.batch={id:'autre'};assert.equal(await b.f.relectureAnticiperProvisoire(LOT,p),null);
 b=bac({entree:{partie:23,total:300,lot:[],zonesPN:[],zonesADV:[],aControler:[],ecartement:[]}});b.relecture.passe=p;b.engine.s.batch=LOT;assert.equal(await b.f.relectureAnticiperProvisoire(LOT,p),null);assert.deepEqual(b.appels,[]);
 /* une erreur de préparation ne sort jamais */
 b=bac({entree});b.relecture.passe=p;b.engine.s.batch=LOT;b.relectureEntree=async()=>{throw Error('journal illisible');};assert.equal(await b.f.relectureAnticiperProvisoire(LOT,p),null);
});
test('branchements : clôture du lot, sélection de la relecture, boucle de la passe ; le pont laisse passer `prechauffer`',()=>{
 const planifier=SRC.slice(SRC.indexOf('function relecturePlanifier('),SRC.indexOf('async function relectureReglages('));
 assert.ok(/const p=relectureNouvelle\(b,true\);void relectureAnticiperProvisoire\(b,p\);/.test(planifier),'à la clôture, sans rien attendre');
 const lancer=SRC.slice(SRC.indexOf('async function relectureLancer('),SRC.indexOf('async function relectureOublierPasse('));
 assert.ok(/const sel=R\.selection\(entree,relectureOptionsSelection\(R,reglages,cfg\)\);\n\s*void relectureAnticiperEnvoyer\(engine\.s\.batch,sel\.cuts\[0\]\?\.cut,'selection'\);/.test(lancer),'dès la sélection connue, sans attendre');
 assert.ok(SRC.includes("EC.loin=cibleLoinListe(p.cut,aEcrire.slice(ip+1).map(x=>x.cut),relecturePremiere(b));"),'la passe joint la première coupe relue');
 assert.ok(/avecPrechauffage\(etat,E\?\.suivante,'passe-differes',E\?\.apres,E\?\.loin\)/.test(SRC),'la capture de la passe est inchangée');
 const pont=fs.readFileSync(path.join(__dirname,'../src/bridge.js'),'utf8');assert.ok(/allowed=new Set\(\[[^\]]*'prechauffer'[^\]]*\]\)/.test(pont));
 /* `relecture-anticipee` n'est lu par aucune étape : il n'entre pas dans l'index du journal */
 assert.equal(/TYPES_INDEXES=Object\.freeze\(\[[^\]]*relecture-anticipee/.test(SRC),false);
});
test('observateur puis service worker : un refus posté par `anticiper` garde source et motif, aucune adresse',()=>{
 const w=world();w.deliver({kind:'banane5:evt',event:{kind:'prechauffage',coupe:120,predite:20,op:null,saut:-100,source:'changement-mode',noeuds:0,termines:0,octets:0,annule:false,motif:'saut-court',url:'/nuage/ept-data/3-1-2-0.bin'}});
 w.deliver({kind:'banane5:evt',event:{kind:'prechauffage-loin',coupe:120,cible:20,saut:-100,avant:0,source:'changement-mode',captures:0,msAvant:900,lances:9,charges:8,motif:'arrivee'}});
 const ring=w.observed().filter(x=>/^prechauffage/.test(x.kind));assert.equal(ring.length,2);
 assert.deepEqual([ring[0].coupe,ring[0].predite,ring[0].saut,ring[0].source,ring[0].motif,ring[0].op],[120,20,-100,'changement-mode','saut-court',null]);
 assert.deepEqual([ring[1].cible,ring[1].saut,ring[1].source,ring[1].motif,ring[1].charges],[20,-100,'changement-mode','arrivee',8]);
 const debut=SRC.indexOf('const obsInt='),fin=SRC.indexOf('}return null;}',SRC.indexOf('function obsFields('))+'}return null;}'.length;
 const ctx={OBS_REASONS:new Set()};vm.createContext(ctx);vm.runInContext(SRC.slice(debut,fin)+';this.obsFields=obsFields;',ctx);
 const lus=ring.map(x=>ctx.obsFields(J(x)));assert.ok(lus.every(Boolean));
 assert.deepEqual(J(lus),J(ring.map(({seq,...x})=>x)));for(const x of [...ring,...lus])assert.equal('url' in x,false);
});
test('bilan de lot : passage à la relecture (envois du service worker, opérations de source changement-mode, part chargée à l\'arrivée)',()=>{
 const B=require('../tools/bilan-lot.cjs'),t=s=>`2026-11-09T17:50:${String(s).padStart(2,'0')}.000Z`,o=(s,x)=>({eventId:'e'+s,timestamp:t(s),type:'esv-observation',...x});
 const evs=[{eventId:'a1',timestamp:t(1),type:'relecture-anticipee',issue:'envoyee',quand:'cloture',cut:20,de:120},{eventId:'a2',timestamp:t(2),type:'relecture-anticipee',issue:'deja-envoyee',quand:'selection',cut:20,de:118},
  o(3,{kind:'prechauffage-loin',motif:'arrivee',source:'liste-esv',captures:3,msAvant:2400,lances:14,charges:12,echecs:0,boite:17,prets:14,nousPrets:12,nousEnVol:2,boiteFin:18,potreeLui:3,nousApres:2}),
  o(4,{kind:'prechauffage-loin',motif:'arrivee',source:'changement-mode',captures:2,msAvant:9000,lances:32,charges:30,echecs:0,boite:60,prets:40,nousPrets:30,nousEnVol:0,boiteFin:62,potreeLui:20,nousApres:0})].map(e=>({...e,_ms:Date.parse(e.timestamp)}));
 const b=B.bilan(evs).prechauffage;
 assert.deepEqual([b.relecture.n,b.relecture.lances,b.relecture.charges,b.relecture.arrivee.prets,b.relecture.arrivee.boite,b.relecture.arrivee.partPrete],[1,32,30,40,60,0.667]);
 assert.deepEqual({...b.relecture.envois},{envoyee:1,'deja-envoyee':1});assert.equal(b.loin.n,2,'les opérations lointaines comptent toujours toutes');
 assert.ok(/Passage à la relecture : envois du service worker .*envoyee.* ; opérations 1 /.test(B.markdown(B.bilan(evs)))&&/première coupe relue \(1\) : chargés 40 sur 60/.test(B.markdown(B.bilan(evs))));
 assert.equal(/Passage à la relecture/.test(B.markdown(B.bilan(evs.slice(2,3)))),false,'rien à dire sans passage');
});
