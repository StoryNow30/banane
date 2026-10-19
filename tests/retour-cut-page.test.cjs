'use strict';
/* Retour à un cut (4.9, cadrage « Revenir à un cut », D-067, D-077 point 3) : action `goToCut`
 * de l'adaptateur réel, sur ESV simulé (tests/helpers/retour-cut.cjs, données fictives).
 * Les sept familles du cadrage : précédent normal, commande absente, commande désactivée,
 * mauvaise cible atteinte, cible déjà validée, double appel, annulation. Chaque essai vérifie
 * aussi l'invariant : zéro validation, zéro SKIP, zéro bouton de rail, zéro touche, rails intacts. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {esv,INTACTS,simple}=require('./helpers/retour-cut.cjs');

test('1. précédent normal, par l’événement interne : une seule émission, partie en texte, identité confirmée',async()=>{
  const s=esv({total:200});const e=await s.aller({part:23,cut:97});
  assert.equal(e.resultat,'confirme');assert.equal(e.confirme,true);assert.equal(e.chemin,'evenement');assert.equal(e.commande,'evenement');assert.equal(e.emissions,1);
  assert.deepEqual(s.compte.evenements,[{nom:'railPairSelected',args:['23',97],cible:'globalcontainer'}]);
  assert.deepEqual([e.identiteAvant,e.identiteApres],[{part:23,cut:100},{part:23,cut:97}]);assert.equal(e.pret,true);
  assert.deepEqual([s.compte.precedent,s.compte.suivant],[0,0],'aucun pas à pas quand l’événement suffit');
  assert.deepEqual({bornes:e.bornes,lectureSeule:e.lectureSeule,validation:e.validationCommandSent,skip:e.skipCommandSent,pose:e.applyCommandSent},
    {bornes:{total:200,max:199,source:'compteur'},lectureSeule:true,validation:false,skip:false,pose:false});
  assert.deepEqual(s.intacts(),INTACTS);
});
test('1 bis. précédent normal, pas à pas (réglage « pas ») : un clic par pas, chaque pas relu',async()=>{
  const s=esv();const e=await s.aller({part:23,cut:97},{chemin:'pas'});
  assert.equal(e.resultat,'confirme');assert.equal(e.chemin,'pas-a-pas');assert.equal(e.emissions,3);assert.deepEqual(e.pas,{sens:-1,demandes:3,faits:3,bouton:'O2N3DCutPrevious3DRail'});
  assert.equal(s.compte.precedent,3);assert.equal(s.compte.evenements.length,0);
  const etapes=s.f.progress.filter(p=>p.stage==='goto-step').map(p=>p.detail.identity.cut);assert.deepEqual(simple(etapes),[99,98,97]);
  assert.deepEqual(s.intacts(),INTACTS);
});
test('2. commande absente : sans écouteur, repli pas à pas ; sans écouteur ni bouton, refus avant toute émission',async()=>{
  let s=esv({evenement:false});let e=await s.aller({part:23,cut:98});
  assert.equal(e.chemin,'pas-a-pas');assert.equal(e.cheminEvenement.raison,'sans-ecouteur');assert.equal(e.resultat,'confirme');assert.equal(s.compte.precedent,2);
  s=esv({evenement:false,boutons:false});e=await s.aller({part:23,cut:98});
  assert.equal(e.resultat,'refuse');assert.equal(e.refusal.code,'NAVIGATION_COMMAND_UNAVAILABLE');assert.equal(e.emissions,0);assert.equal(e.commandInvoked,false);
  assert.match(e.refusal.message,/sans-ecouteur.*bouton-absent.*Rien n’a été envoyé/);assert.equal(s.etat.cut,100);
  s=esv({boutons:false});delete s.f.ctx.$;e=await s.aller({part:23,cut:98});
  assert.equal(e.cheminEvenement.raison,'jquery-absent');assert.equal(e.refusal.code,'NAVIGATION_COMMAND_UNAVAILABLE');
  s=esv({boutons:false});s.f.ctx.$._data=undefined;e=await s.aller({part:23,cut:98});
  assert.equal(e.cheminEvenement.raison,'ecouteurs-illisibles','écouteur invisible : le chemin n’est pas pris à l’aveugle');assert.equal(s.compte.evenements.length,0);
  s=esv({evenement:true});e=await s.aller({part:23,cut:98},{chemin:'evenement'});assert.equal(e.chemin,'evenement');
  s=esv({evenement:false});e=await s.aller({part:23,cut:98},{chemin:'evenement'});assert.equal(e.refusal.code,'NAVIGATION_PATH_UNAVAILABLE');assert.equal(s.compte.precedent,0,'« evenement » seul : pas de repli');
  assert.deepEqual(s.intacts(),INTACTS);
});
test('3. commande désactivée : refus avant émission ; désactivée en cours de route, arrêt sans pas de plus',async()=>{
  let s=esv({evenement:false});s.boutons.precedent.disabled=true;let e=await s.aller({part:23,cut:97});
  assert.equal(e.resultat,'refuse');assert.equal(e.refusal.code,'NAVIGATION_COMMAND_DISABLED');assert.equal(s.compte.precedent,0);assert.equal(e.emissions,0);
  s=esv({evenement:false});const c=s.boutons.precedent.click;s.boutons.precedent.click=function(){c.call(this);this.disabled=true;};
  e=await s.aller({part:23,cut:97});
  assert.equal(e.resultat,'interrompu');assert.equal(e.refusal.code,'NAVIGATION_COMMAND_DISABLED');assert.equal(e.emissions,1);assert.deepEqual(e.identiteApres,{part:23,cut:99});
  assert.equal(e.confirme,false);assert.equal(s.compte.precedent,1);
  s=esv({evenement:false});e=await s.aller({part:23,cut:50},{},null);
  assert.equal(e.refusal.code,'TOO_MANY_STEPS');assert.equal(s.compte.precedent,0,'au-delà de pasMax (40) : refus');
  s=esv();e=await s.aller({part:23,cut:97},{chemin:'off'});assert.equal(e.refusal.code,'PATH_DISABLED');assert.equal(s.compte.evenements.length,0);
  assert.deepEqual(s.intacts(),INTACTS);
});
test('4. mauvaise cible atteinte : incertain, pause explicite, aucune réémission',async()=>{
  let s=esv();s.carte.effet=(etat,p,i,afficher)=>{etat.cut=i-1;afficher();};let e=await s.aller({part:23,cut:97});
  assert.equal(e.resultat,'incertain');assert.equal(e.refusal.code,'WRONG_TARGET_REACHED');assert.equal(e.pauseExplicite,true);assert.equal(e.confirme,false);
  assert.deepEqual(e.identiteApres,{part:23,cut:96});assert.equal(s.compte.evenements.length,1);assert.deepEqual([s.compte.precedent,s.compte.suivant],[0,0],'pas de repli après une émission');
  s=esv();s.carte.effet=()=>{};e=await s.aller({part:23,cut:97});
  assert.equal(e.refusal.code,'NO_NAVIGATION_OBSERVED');assert.equal(e.resultat,'incertain');assert.equal(s.compte.evenements.length,1);
  s=esv();s.carte.effet=()=>{throw Error('panne simulée');};e=await s.aller({part:23,cut:97});
  assert.equal(e.refusal.code,'NAVIGATION_COMMAND_THREW');assert.equal(e.emissions,1);assert.equal(s.compte.precedent,0);
  s=esv();s.carte.effet=(etat,p,i,afficher)=>{etat.illisible=true;afficher();};e=await s.aller({part:23,cut:97});
  assert.equal(e.refusal.code,'IDENTITY_UNAVAILABLE_AFTER');assert.equal(e.identiteApres,null);assert.equal(e.pauseExplicite,true);
  s=esv({evenement:false});let n=0;s.boutons.precedent.click=()=>{n++;s.etat.cut-=2;s.afficher();};e=await s.aller({part:23,cut:96});
  assert.equal(e.refusal.code,'WRONG_TARGET_REACHED');assert.equal(n,1,'un pas raté n’est jamais recliqué');assert.deepEqual(e.identiteApres,{part:23,cut:98});
  assert.deepEqual(s.intacts(),INTACTS);
});
test('5. cible déjà validée : consultation permise, rien n’est décidé ni posé, retour au cut de départ',async()=>{
  const s=esv({total:200,valides:[95,96,97]});const e=await s.aller({part:23,cut:96});
  assert.equal(e.resultat,'confirme');assert.ok(s.etat.valides.has(96));assert.deepEqual(s.intacts(),INTACTS);
  const r=await s.aller({part:23,cut:100});assert.equal(r.resultat,'confirme');assert.deepEqual(r.identiteApres,{part:23,cut:100});
  assert.deepEqual(s.compte.evenements.map(x=>x.args),[['23',96],['23',100]]);assert.deepEqual(s.intacts(),INTACTS);
});
test('6. double appel : une seule émission ; une opération rejouée n’émet pas une seconde fois',async()=>{
  const s=esv();s.carte.effet=(etat,p,i,afficher)=>{s.f.ctx.setTimeout(()=>{etat.cut=i;afficher();},300);};
  const a=s.f.raw('goToCut',[{part:23,cut:97},{},'op-1']),b=s.f.raw('goToCut',[{part:23,cut:98},{},'op-2']);
  const [ea,eb]=(await Promise.all([a.promise,b.promise])).map(simple);
  assert.equal(ea.resultat,'confirme');assert.equal(eb.resultat,'refuse');assert.equal(eb.refusal.code,'ALREADY_RUNNING');assert.equal(eb.emissions,0);
  assert.equal(s.compte.evenements.length,1);
  const c=await s.aller({part:23,cut:99},{},'op-1');
  assert.equal(c.refusal.code,'OPERATION_ALREADY_INVOKED');assert.equal(c.commandInvoked,'unknown');assert.equal(s.compte.evenements.length,1);assert.equal(s.etat.cut,97);
  assert.deepEqual(s.intacts(),INTACTS);
});
test('7. annulation : avant l’émission rien ne part ; entre deux pas, le pas suivant ne part pas',async()=>{
  let s=esv();await s.f.call('cancel',{operationId:'op-a'});let e=await s.aller({part:23,cut:97},{},'op-a');
  assert.equal(e.refusal.code,'CANCELLED_BEFORE_COMMAND');assert.equal(e.emissions,0);assert.equal(s.compte.evenements.length,0);assert.equal(s.etat.cut,100);
  s=esv({evenement:false});const c=s.boutons.precedent.click;
  s.boutons.precedent.click=function(){c.call(this);if(s.compte.precedent===2)s.f.raw('cancel',[{operationId:'op-b'}]);};
  e=await s.aller({part:23,cut:95},{},'op-b');
  assert.equal(e.resultat,'interrompu');assert.equal(e.refusal.code,'CANCELLED_BETWEEN_STEPS');assert.equal(e.emissions,2);assert.equal(s.compte.precedent,2);
  assert.deepEqual(e.identiteApres,{part:23,cut:98});assert.equal(e.confirme,false);
  /* Événement déjà émis : il ne se rattrape pas ; le cut atteint est relu et dit. */
  s=esv();s.carte.effet=(etat,p,i,afficher)=>{s.f.raw('cancel',[{operationId:'op-c'}]);etat.cut=i;afficher();};
  e=await s.aller({part:23,cut:97},{},'op-c');assert.equal(e.resultat,'confirme');assert.equal(s.compte.evenements.length,1);
  assert.deepEqual(s.intacts(),INTACTS);
});
