'use strict';
/* 5.0 (D-170 à D-173) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : coupée (défaut), rien de gardé : commandes du lot identiques à la base (tests/fixtures/relecture-lot-50-base.json, prise sur claude/50-base 2d60d04), aucune passe. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinte,j,sansRelecture,PERMISSIF,apresLot,LECTURES,coupee}=require('./helpers/relecture-essais.cjs');

test('coupée, rien de gardé : commandes de la base, octet pour octet ; aucune passe',()=>coupee('rien de gardé',null));
