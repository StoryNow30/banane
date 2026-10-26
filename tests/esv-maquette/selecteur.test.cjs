'use strict';
/* T20a — RELEVÉ EN LECTURE SEULE DU SÉLECTEUR DE PARTIES, avec le VRAI code de page d'Ariane (src/adapter-page.js) dans un vrai Chromium, sur la
 * maquette ESV. Le sélecteur de la maquette est SUPPOSÉ (README : liens `?…&p=N`, entrée courante `active`) : cet essai prouve que le relevé lit ce
 * qui est supposé, sans rien cliquer ni écrire ; il ne prouve rien sur le vrai ESV. Hors du banc `verify` :
 *   node --test --test-timeout=120000 tests/esv-maquette/selecteur.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};

test('sélecteur présent : status ok, parties et entrée courante ; sans entrée marquée : la partie de l’adresse, sinon aucune ; liens sans numéro : illisible ; rien d’écrit',opts,async()=>{
  const env=await N.ouvrir({maquette:{cuts:4,latence:10}});
  try{await env.injecter();
    const ecrituresAvant=env.serveur.journal.ecritures.length,cutAvant=(await env.etat()).cut;
    let r=await env.appel('ping',[{contrat:true}]);assert.equal(r.error,undefined,r.error);
    const s=r.result.selecteurParties;
    /* Parties du scénario de la maquette (23 et 24) et leurs voisines ; la partie servie (23) est l'entrée courante. */
    assert.deepEqual(JSON.parse(JSON.stringify(s)),{status:'ok',current:23,parts:[22,23,24,25].map(n=>({part:n,label:'Part '+n,current:n===23}))});
    assert.equal((await env.appel('ping',[])).result.selecteurParties,undefined,'seulement au ping de contrat (équipement)');
    await env.page.evaluate(()=>{for(const e of document.querySelectorAll('#maquette-parties .active'))e.classList.remove('active');});
    r=await env.appel('ping',[{contrat:true}]);assert.equal(r.result.selecteurParties.status,'ok');assert.equal(r.result.selecteurParties.current,null,'aucune entrée marquée, pas de « p » dans l’adresse : courante inconnue');
    await env.page.evaluate(()=>{for(const a of document.querySelectorAll('#maquette-parties a'))a.setAttribute('href','?p=partie');});
    r=await env.appel('ping',[{contrat:true}]);assert.deepEqual(JSON.parse(JSON.stringify(r.result.selecteurParties)),{status:'illisible',current:null,parts:[]});
    assert.equal(env.serveur.journal.ecritures.length,ecrituresAvant,'aucune écriture');assert.equal((await env.etat()).cut,cutAvant,'aucune navigation');
    assert.deepEqual(env.erreurs,[]);
  }finally{await env.fermer();}
});

test('sans sélecteur (selecteur=0) : status absent',opts,async()=>{
  const env=await N.ouvrir({maquette:{cuts:4,latence:10,selecteur:0}});
  try{await env.injecter();const r=await env.appel('ping',[{contrat:true}]);assert.deepEqual(r.result.selecteurParties,{status:'absent',current:null,parts:[]});}
  finally{await env.fermer();}
});
