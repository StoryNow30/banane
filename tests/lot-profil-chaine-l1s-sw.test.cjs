'use strict';
/* 4.9.5.13 (test 13, D-217, D-219, D-220, D-221, fiches/L1_DIFFERES.md) — LE PROFIL DU LOT : sous L1-s, un lot que la chaîne pose en entier envoie les commandes de la 4.9.5.9.
 * Montage commun : tests/helpers/lot-profil.cjs (un essai lourd par fichier). Données synthétiques. La décision de la GCV2 est forcée quand il le
 * faut (le modèle réel est essayé dans tests/gcv2-l1.test.cjs et au banc) : ces essais portent sur le CHEMIN du lot, pas sur le modèle. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {lot,neutre,decisions,metier,SCOPE,EsvVue,production,memoire,base,K,S,GOLDEN,h,versionGolden,ev,scopeDe,attendre,EsvTrou,lotDiffere,d112}=require('./helpers/lot-profil.cjs');

for(const profil of ['L1-s','L1-se'])test(`profil « ${profil} »${profil==='L1-se'?' (défaut, test 14)':''} : sur un lot que la chaîne pose en entier, mêmes commandes que la 4.9.5.9 (hors le profil dans le scope)`, async()=>{
 const {lotClic,neutre:neutreClic}=require('./helpers/choix-lot.cjs'),E=require('./helpers/choix-lot-essais.cjs');
 const x=await lotClic({profil:profil==='L1-se'?null:profil});
 assert.equal(scopeDe(x.b).lotProfil,profil);
 const sansProfil=v=>JSON.parse(JSON.stringify(v,(k,y)=>y&&typeof y==='object'&&!Array.isArray(y)&&'lotProfil' in y?Object.fromEntries(Object.entries(y).filter(([c])=>c!=='lotProfil')):y));
 assert.equal(E.h(E.versionGolden(neutreClic(sansProfil(x.commandes)))),E.GOLDEN.clic.empreinteCommandes,'commandes de la base, octet pour octet, hors lotProfil');
});
