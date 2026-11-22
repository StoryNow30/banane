'use strict';
/* CH-071 : PLAFOND MÉMOIRE du cœur (256 Mio, ariane-rs/.cargo/config.toml) sur le lot 300–349.
 *   [CH071_WASM=<cœur avec le bras 300..=349>] node --max-old-space-size=8000 --test tools/ch071-essais-plafond.cjs
 * 1. Haute eau ordinaire : une séance relevée type (transition, vue, raison, série) laisse la mémoire linéaire sous 16 Mio.
 * 2. Au plafond : un état de file portant 150 millions de caractères (trame VBA de 150 Mo, plus sa chaîne décodée, plus la
 *    copie JSON : plus de 256 Mio) fait trapper le cœur ; la coquille le rend en HorsDomaine, la façade rejoue le JS : même
 *    résultat que le JS ; l'appel suivant est servi par le cœur (instance neuve) et reste identique. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {comparer}=require('./ch064-comparer.cjs'),{construire}=require('./ch064-construire.cjs'),Coeur=require('../ariane-rs/coquille/coeur.js'),Facade=require('../ariane-rs/coquille/facade-file.js');
const M={parties:require('../src/file-parties.js'),prioritaire:require('../src/file-prioritaire.js'),serie:require('../src/serie-captures-vides.js'),raison:require('../src/raison-correction.js')};
const octets=fs.readFileSync(process.env.CH071_WASM||construire({silencieux:true}));
const MIO=1024*1024;
const demarrer=at=>({type:'demarrer',selecteur:{status:'ok',parts:[{part:3},{part:4}]},courante:3,n:2,id:'f',at});

test('haute eau ordinaire sous 16 Mio',()=>{
 const coeur=Coeur.creer(octets),F=Facade.creer(coeur,M);
 let e=F.parties.transition(null,demarrer('t0')).etat;
 for(let i=0;i<200;i++){e=F.parties.transition(e,{type:'arreter',at:'t'+i}).etat;e=F.parties.transition(e,demarrer('u'+i)).etat;F.parties.vue(e);}
 const r=F.raison.nouvelEtat();for(let i=0;i<500;i++)F.raison.appuyer(r,{code:'pn',cutKey:'k'+(i>>1),at:i*10,cut:i>>1,part:1});
 const s=F.serie.creer({actif:true});for(let i=0;i<500;i++)F.serie.observer(s,{points:i%7?0:5});
 const m=coeur.etat();assert.equal(F.compteurs().repliHorsDomaine,0);
 assert.ok(m.hauteEau<16*MIO,'haute eau '+m.hauteEau);console.log('# haute eau ordinaire : '+m.hauteEau+' octets');
});

test('au plafond de 256 Mio : trappe, repli JS identique, puis appel servi',()=>{
 const coeur=Coeur.creer(octets),F=Facade.creer(coeur,M);
 const e=M.parties.transition(null,{...demarrer('t0'),lotArgs:{gros:'a'.repeat(150e6)}}).etat;
 const a=M.parties.transition(e,{type:'arreter',at:'t1'}),b=F.parties.transition(e,{type:'arreter',at:'t1'});
 assert.deepEqual(comparer(a,b),[],'repli identique au JS');
 const c=F.compteurs(),m=coeur.etat();
 assert.equal(c.repliHorsDomaine,1,'le cœur a refusé proprement : '+JSON.stringify(c));assert.ok(m.reinstanciations>=1,'instance neuve après la trappe');
 console.log('# au plafond : '+JSON.stringify({compteurs:c,coeur:m}));
 const x=M.parties.transition(null,demarrer('t2')),y=F.parties.transition(null,demarrer('t2'));
 assert.deepEqual(comparer(x,y),[],'appel suivant identique');assert.equal(F.compteurs().coeur,c.coeur+1,'appel suivant servi par le cœur');
});
