'use strict';
/* CH-041 — FIL DE CALCUL de la recherche large (chantiers/CH-041/JOURNAL.md § 0.6, H3). Un `Worker` du document hors écran (src/recherche-large-offscreen.js) :
 * il charge le moteur gelé et le module pur, puis, pour chaque graine reçue, fait la relance (`BananeRechercheLarge.relance`, fonction pure de la capture et de la
 * graine : les cellules sont celles que le service worker aurait trouvées lui-même) et rend les cellules fortes (millimètres, pertes, comptes). Aucun accès à ESV,
 * au stockage ni aux réglages ; le moteur reçoit la configuration du service worker (flanc partiel, calage de convention) pour calculer à l'identique. */
importScripts('../vendor/capture-core.js','core.js','settings.js','gauge.js','geometry.js','brain.js','geometry-brain.js','gcv1-shadow-bootstrap.js',
 'geometry-candidate-v1.js','placement-convention.js','faux-vert-ombre.js','hauteur-apprise.js','continuity-observer.js','level-crossing.js','lot-decision.js','gcv1-shadow.js','recherche-large.js');
self.onmessage=e=>{
 const m=e.data;if(!m||m.type!=='relances')return;
 try{
  const Sh=self.BananeGCV1Shadow,RL=self.BananeRechercheLarge,opts={};
  if(m.moteur&&typeof m.moteur==='object')for(const k of ['partialFlank','convention'])if(typeof m.moteur[k]==='boolean')opts[k]=m.moteur[k];
  if(Object.keys(opts).length)Sh.configure(opts);
  const t0=performance.now(),relances=[];
  for(const g of Array.isArray(m.graines)?m.graines:[]){const r=RL.relance(m.capture,g,null);if(r)relances.push({graine:g,left:r.left,right:r.right});}
  self.postMessage({type:'resultat',id:m.id,relances,ms:Math.round(performance.now()-t0)});
 }catch(err){self.postMessage({type:'erreur',id:m.id,message:String(err&&err.message||err).slice(0,160)});}
};
