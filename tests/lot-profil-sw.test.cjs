'use strict';
/* 4.9.5.13 (test 13, D-217, D-219, D-220, D-221, fiches/L1_DIFFERES.md) — LE PROFIL DU LOT : réglage livré, profil « actuel » (commandes de la 4.9.5.9), paramètres figés.
 * Montage commun : tests/helpers/lot-profil.cjs (un essai lourd par fichier). Données synthétiques. La décision de la GCV2 est forcée quand il le
 * faut (le modèle réel est essayé dans tests/gcv2-l1.test.cjs et au banc) : ces essais portent sur le CHEMIN du lot, pas sur le modèle. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {lot,neutre,decisions,metier,SCOPE,EsvVue,production,memoire,base,K,S,GOLDEN,h,versionGolden,ev,scopeDe,attendre,EsvTrou,lotDiffere,d112}=require('./helpers/lot-profil.cjs');

test('réglage livré : profil du lot « L1-s » (D-221) ; le choix du panneau est gardé et lu', async()=>{
 assert.equal(S.lot.profil,'L1-s');
 const local=memoire(),b=production({local});
 const j=x=>JSON.parse(JSON.stringify(x));
 assert.deepEqual(j(await b.api('lot-profil-etat')),{profil:'L1-s'});
 await b.api('lot-profil',{profil:'actuel'});assert.equal(local.m.banane50LotProfil,'actuel');
 assert.deepEqual(j(await b.api('lot-profil-etat')),{profil:'actuel'});
 await assert.rejects(b.api('lot-profil',{profil:'L9'}),/Profil du lot inconnu/);
});

test('profil « actuel » gardé au panneau : exactement les commandes de la 4.9.5.9 (empreinte de la base), scope sans profil', async()=>{
 const local=memoire();local.m.banane50LotProfil='actuel';
 const x=await lot({profil:null,local});
 assert.deepEqual(x.b.commands.map(c=>c.action??null),GOLDEN.actions);
 assert.equal(h(versionGolden(neutre(x.b.commands))),GOLDEN.empreinteCommandes,'commandes identiques octet pour octet');
 assert.deepEqual(x.adapter.calls,GOLDEN.appels);assert.deepEqual(x.adapter.applyArgs,GOLDEN.applyArgs);
 assert.deepEqual(metier(x.b),GOLDEN.metier);assert.equal(h(neutre(decisions(x.b))),GOLDEN.empreinteDecisions);
 assert.equal('lotProfil' in scopeDe(x.b),false);
 assert.ok(!decisions(x.b).some(([,d])=>'l1' in d),'aucune décision L1 consignée');
});

test('paramètres du service worker : copie conforme de datasets/gcv2-parametres-h6.json (empreinte de la fiche), module L1 de la décision des différés', ()=>{
 const fs=require('node:fs'),path=require('node:path');
 const brut=fs.readFileSync(path.join(__dirname,'..','datasets','gcv2-parametres-h6.json'));
 assert.equal(crypto.createHash('sha256').update(brut).digest('hex'),'679015ef515547287fdb0fbdde4cdf5a015c8644ef6a170005d67a2ab6eee5f8','fichier figé de la fiche (§ 2.1)');
 assert.deepEqual(require('../src/gcv2-parametres-l1.js'),JSON.parse(brut.toString('utf8')));
 const G=require('../src/gcv2-l1.js');assert.deepEqual(G.REGLE.lotOptions,{pairGuard:false,gap:10});assert.equal(G.REGLE.sansValiderMaxMm,150);
});
