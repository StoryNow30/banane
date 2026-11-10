'use strict';
/* CH-097, défaut 7 — « GARDÉE JUSQU'À … » À L'HEURE DE PARIS. La ligne de la relecture en pause (src/relecture-pause.js, reprise par Signal) donnait
 * l'échéance à l'heure de la MACHINE, contre la règle du panneau (« l'heure de Paris partout », panel.js). Sans effet sur une machine à l'heure de
 * Paris. Module réel, fuseau de la machine forcé par `TZ` avant toute date. */
process.env.TZ='Asia/Tokyo';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../src/relecture-pause.js');const {vue}=globalThis.ArianeRelecturePause;
const pause=expire=>({repriseReglage:{actif:true},passe:{etat:'en-pause',cut:120,faits:3,total:9,pauseRaison:'operateur',expire}});

test('machine à Tokyo, échéance le 10/11 à 22 h 30 UTC : la ligne dit 10/11 23:30 (Paris, hiver), pas 11/11 07:30',()=>{
 assert.equal(new Date('2026-11-10T22:30:00.000Z').getHours(),7,'la monture est bien à l’heure de Tokyo');
 const l=vue(pause('2026-11-10T22:30:00.000Z')).ligne;
 assert.match(l,/gardée jusqu’à 10\/11 23:30\.$/,l);});

test('heure d’été : 15/07 à 21 h 05 UTC → 15/07 23:05 à Paris',()=>{
 assert.match(vue(pause('2026-07-15T21:05:00.000Z')).ligne,/gardée jusqu’à 15\/07 23:05\.$/);});

test('sans échéance : la ligne ne change pas',()=>{
 assert.equal(vue(pause(null)).ligne,'Relecture en pause au cut 120 · 3 cuts relus sur 9.');});
