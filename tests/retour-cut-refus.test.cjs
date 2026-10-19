'use strict';
/* Retour à un cut (4.9) : refus de l'action `goToCut` dans la page — mauvaise partie, bornes,
 * pendant une pose, une validation ou un déplacement d'Ariane, cible invalide, identité de départ
 * illisible, cut déjà affiché. Chaque refus part AVANT toute émission : aucun événement, aucun clic. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {esv,INTACTS,simple}=require('./helpers/retour-cut.cjs');
const rien=s=>({evenements:s.compte.evenements.length,precedent:s.compte.precedent,suivant:s.compte.suivant});

test('mauvaise partie : seule la partie chargée est accessible',async()=>{
  const s=esv({total:200}),e=await s.aller({part:24,cut:97});
  assert.equal(e.resultat,'refuse');assert.equal(e.refusal.code,'WRONG_PART');assert.match(e.refusal.message,/Partie 24 demandée, partie 23 chargée/);
  assert.deepEqual(rien(s),{evenements:0,precedent:0,suivant:0});assert.deepEqual(s.intacts(),INTACTS);
});
test('bornes : négatif, au-delà du compteur, au-delà du plus grand cut connu sans compteur',async()=>{
  let s=esv({total:120});
  for(const cut of [-1,120,500]){const e=await s.aller({part:23,cut});assert.equal(e.refusal?.code,'OUT_OF_BOUNDS',String(cut));}
  let e=await s.aller({part:23,cut:119});assert.equal(e.resultat,'confirme','dernier cut de la partie (M−1)');
  s=esv();e=await s.aller({part:23,cut:105});
  assert.equal(e.refusal.code,'OUT_OF_BOUNDS');assert.deepEqual(e.bornes,{total:null,max:100,source:'cut-connu'});assert.match(e.refusal.message,/compteur illisible/);
  e=await s.aller({part:23,cut:105},{borneConnue:110});assert.equal(e.resultat,'confirme','cut connu du lot : borne donnée par le service worker');
  assert.deepEqual(rien(s),{evenements:1,precedent:0,suivant:0});assert.deepEqual(s.intacts(),INTACTS);
});
test('pendant une validation, une pose ou un déplacement d’Ariane : refus, rien n’est émis',async()=>{
  /* Validation : le bouton « valider » ne change pas de cut, l'action attend la navigation. */
  let s=esv();const v=s.f.nodes.get('O2N3DCutValidate3DRail');v.click=()=>{s.compte.valider++;};
  const etat=await s.f.call('state');let enCours=s.f.raw('validateAndNext',[etat.identity,{}]);
  let e=simple(await s.f.call('goToCut',{part:23,cut:97}));
  assert.equal(e.refusal.code,'ADAPTER_BUSY');assert.match(e.refusal.message,/validateAndNext/);assert.equal(e.emissions,0);
  await enCours.promise.catch(()=>{});assert.equal(s.compte.valider,1,'la seule validation est celle de l’essai');assert.deepEqual(rien(s),{evenements:0,precedent:0,suivant:0});
  /* Pose : l'application de l'essai est en cours. */
  s=esv();const avant=await s.f.call('state');enCours=s.f.raw('apply',[avant,{left:{delta:[0,.012,.003]},right:{delta:[0,-.01,.004]}}]);
  e=simple(await s.f.call('goToCut',{part:23,cut:97}));assert.equal(e.refusal.code,'ADAPTER_BUSY');assert.match(e.refusal.message,/apply/);
  await enCours.promise;assert.deepEqual(rien(s),{evenements:0,precedent:0,suivant:0});
  /* Déplacement : « suivant sans décision » attend un changement de cut qui ne vient pas. */
  s=esv();const nv=s.f.nodes.get('O2N3DCutNextInvalid3DRail');nv.click=()=>{};
  enCours=s.f.raw('nextWithoutDecision',[(await s.f.call('state')).identity,{},'op-n']);
  e=simple(await s.f.call('goToCut',{part:23,cut:97}));assert.equal(e.refusal.code,'ADAPTER_BUSY');
  await enCours.promise;e=await s.aller({part:23,cut:97});assert.equal(e.resultat,'confirme','libre une fois l’action finie');
});
test('cible invalide, identité de départ illisible, cut déjà affiché',async()=>{
  let s=esv();
  for(const c of [{part:'23',cut:97},{part:23,cut:9.5},{part:23},null]){const e=await s.aller(c);assert.equal(e.refusal?.code,'INVALID_TARGET',JSON.stringify(c));}
  s.etat.illisible=true;s.afficher();let e=await s.aller({part:23,cut:97});assert.equal(e.refusal.code,'IDENTITY_UNAVAILABLE_BEFORE');
  s=esv();e=await s.aller({part:23,cut:100});
  assert.deepEqual([e.resultat,e.chemin,e.emissions,e.identiteApres],['confirme','aucun',0,{part:23,cut:100}]);
  assert.deepEqual(rien(s),{evenements:0,precedent:0,suivant:0});assert.deepEqual(s.intacts(),INTACTS);
});
test('le pont laisse passer goToCut ; une commande d’une autre Ariane est refusée, rien n’est émis',async()=>{
  const pont=fs.readFileSync(path.join(__dirname,'..','src','bridge.js'),'utf8');assert.match(pont,/allowed=new Set\(\[[^\]]*'goToCut'/);
  const s=esv(),r=s.f.raw('goToCut',[{part:23,cut:97}],{proprietaire:'autre-ariane'});
  await assert.rejects(r.promise,/Une autre Ariane/);
  /* Puis l'adaptateur se met en sécurité : même son propriétaire n'obtient plus de retour. */
  await assert.rejects(s.aller({part:23,cut:97}),/en sécurité/);
  assert.deepEqual(rien(s),{evenements:0,precedent:0,suivant:0});assert.deepEqual(s.intacts(),INTACTS);
});
