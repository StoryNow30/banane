'use strict';
/* CH-071 : ÉCRITURES EN PLACE de la façade (ariane-rs/coquille/facade-file.js), demandé par l'intégrateur le 06/11.
 *   node --test tools/ch071-essais-ecritures.cjs   (construit le cœur ; branchement de chantiers/CH-071/branchement-coeur.patch requis)
 * Une même séance est jouée deux fois, sur deux objets d'origine identiques : par le JS du tronc, et par la façade (journal
 * d'écritures du cœur appliqué sur l'objet). Après chaque appel : les deux objets d'origine sont égaux au sens strict
 * (tools/ch064-comparer.cjs : ordre des clés, −0, trous) ; les sous-objets que le JS modifie en place (collante, series,
 * reglage) sont les MÊMES références qu'avant l'appel des deux côtés ; la série poussée est l'objet rendu (finir, appuyer.ferme) ;
 * la raison posée est l'objet rendu ; l'état ignoré est l'objet reçu. Un contrôle négatif (journal non appliqué) doit être vu. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {comparer}=require('./ch064-comparer.cjs'),{construire}=require('./ch064-construire.cjs'),Coeur=require('../ariane-rs/coquille/coeur.js'),Facade=require('../ariane-rs/coquille/facade-file.js');
const M={parties:require('../src/file-parties.js'),prioritaire:require('../src/file-prioritaire.js'),serie:require('../src/serie-captures-vides.js'),raison:require('../src/raison-correction.js')};
const coeur=Coeur.creer(fs.readFileSync(construire({silencieux:true})));
const egal=(a,b,m)=>assert.deepEqual(comparer(a,b),[],m);

/* Joue la séance de raisons sur un jeu de modules ; rend les constats d'identité de chaque pas. */
function seance(R){
 const etat=R.nouvelEtat('chiffres'),constats=[],series=etat.series;
 const f=(code,cut,at)=>({code,cutKey:'13:'+cut,at,part:13,cut,poseeA:'t'+at,eventSeq:at});
 const pas=(nom,g)=>{const c0=etat.collante,r=g();constats.push({nom,r,series:etat.series===series,collante:etat.collante===c0,
  dernier:etat.series[etat.series.length-1],copie:structuredClone(etat)});return r;};
 pas('appui',()=>R.appuyer(etat,f('pn',4,0)));
 pas('double appui',()=>R.appuyer(etat,f('pn',4,100)));
 for(const cut of [5,6,6,9])pas('hériter '+cut,()=>R.heriter(etat,{part:13,cut}));
 pas('autre raison',()=>R.appuyer(etat,f('adv',9,1000)));
 const r1=pas('double autre',()=>R.appuyer(etat,f('adv',9,1100)));
 pas('saut',()=>R.heriter(etat,{part:13,cut:200}));
 pas('appui',()=>R.appuyer(etat,f('hauteur',200,2000)));
 pas('double',()=>R.appuyer(etat,f('hauteur',200,2100)));
 const r2=pas('finir',()=>R.finir(etat,'pause'));
 pas('efface',()=>R.appuyer(etat,{efface:true}));
 return {etat,constats,r1,r2};
}

test('raison : état d’origine identique au JS après chaque écriture, alias compris',()=>{
 const F=Facade.creer(coeur,M),a=seance(M.raison),b=seance(F.raison);
 assert.equal(a.constats.length,b.constats.length);
 for(let i=0;i<a.constats.length;i++){const x=a.constats[i],y=b.constats[i];
  egal(x.copie,y.copie,'état après « '+x.nom+' »');egal(x.r,y.r,'rendu de « '+x.nom+' »');
  assert.equal(y.series,x.series,'series gardé en place : '+x.nom);assert.equal(y.collante,x.collante,'identité de la collante : '+x.nom);}
 egal(a.etat,b.etat,'état final');
 assert.equal(b.r1.ferme,b.etat.series[0],'appuyer.ferme EST la série poussée (façade)');assert.equal(a.r1.ferme,a.etat.series[0],'(JS)');
 assert.equal(b.r2,b.etat.series[b.etat.series.length-1],'finir rend la série poussée (façade)');assert.equal(a.r2,a.etat.series[a.etat.series.length-1],'(JS)');
 assert.ok(F.compteurs().coeur>10&&F.compteurs().repliHorsDomaine===0,'tout est passé par le cœur : '+JSON.stringify(F.compteurs()));
});

test('raison : appliquer et effacer posent l’objet rendu sur la visite',()=>{
 const F=Facade.creer(coeur,M);
 for(const R of [M.raison,F.raison]){const v={identity:{part:1,cut:2}};
  const r=R.appliquer(v,{code:'pn',source:'touche',poseeA:'t'});assert.equal(v.raisonCorrection,r);
  const e=R.effacer(v,{poseeA:'u'});assert.equal(v.raisonCorrection,e);assert.equal(e.historique.length,1);}
 const v1={},v2={};M.raison.appliquer(v1,{code:'adv',source:'collante',serie:2});F.raison.appliquer(v2,{code:'adv',source:'collante',serie:2});egal(v1,v2);
});

test('série de captures vides : écritures en place, réglage gelé et gardé',()=>{
 const F=Facade.creer(coeur,M),S={actif:true,seuil:2,reessaiApresCuts:2};
 const a=M.serie.creer(S),b=F.serie.creer(S),ga=a.reglage,gb=b.reglage;assert.ok(Object.isFrozen(gb));
 const suite=[0,0,0,{apresAttente:true},0,0,5,0,0,{apresRechargement:true},0];
 for(const x of suite){const [cap,ctx]=typeof x==='number'?[{points:x},undefined]:[{points:0},x];
  egal(M.serie.observer(a,cap,ctx),F.serie.observer(b,cap,ctx));egal(a,b,'état après '+JSON.stringify(x));}
 assert.equal(a.reglage,ga);assert.equal(b.reglage,gb);
});

test('file de parties : l’état ignoré est l’objet reçu, l’état neuf égal au JS',()=>{
 const F=Facade.creer(coeur,M),sel={status:'ok',parts:[{part:3},{part:4}]};
 const ev={type:'demarrer',selecteur:sel,courante:3,n:2,id:'f',at:'t0'};
 const a=M.parties.transition(null,ev),b=F.parties.transition(null,ev);egal(a,b);
 const ia=M.parties.transition(a.etat,{type:'inconnu'}),ib=F.parties.transition(b.etat,{type:'inconnu'});
 egal(ia,ib);assert.equal(ib.etat,b.etat,'ignore : même objet');assert.equal(ia.etat,a.etat);
});

test('contrôle négatif : un journal non appliqué est vu',()=>{
 const sourd={appeler:(f,e)=>{const v=coeur.appeler(f,e);if(v&&Array.isArray(v.ops))v.ops=[];return v;}};
 const F=Facade.creer(sourd,M),a=M.raison.nouvelEtat(),b=F.raison.nouvelEtat();
 M.raison.appuyer(a,{code:'pn',cutKey:'k',at:0});F.raison.appuyer(b,{code:'pn',cutKey:'k',at:0});
 assert.notDeepEqual(comparer(a,b),[],'le banc doit voir l’écart');
});
