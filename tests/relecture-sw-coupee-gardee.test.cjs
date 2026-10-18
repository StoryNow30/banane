'use strict';
/* 5.0 (D-170 à D-173) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : « coupée » gardée : commandes du lot identiques à la base, aucune passe. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinte,j,sansRelecture,PERMISSIF,apresLot,LECTURES,coupee}=require('./helpers/relecture-essais.cjs');

test('coupée gardée : commandes de la base, octet pour octet ; aucune passe',()=>coupee('coupée gardée','coupee'));
