'use strict';
/* Test 17 (D-232 à D-234) — PAUSE ET CORRECTIONS, suite (un fichier à part : chaque fichier d'essai tient en moins de 20 s) :
 *  1. une pause demandée PENDANT la pose d'une correction n'interrompt rien : la correction va jusqu'à sa validation (jamais entre la pose et la validation), puis la passe s'arrête ;
 *     à la reprise, le cut corrigé n'est pas corrigé une seconde fois ;
 *  2. un F5 PENDANT la validation d'une correction reste une erreur (jamais une pause) : la correction interrompue est notée et bloque tout, la reprise n'existe pas. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause,attendreEtat}=require('./helpers/relecture-pause.cjs');
const {PERMISSIF}=require('./helpers/relecture-essais.cjs');
const OPTIONS={mode:'corriger',decisions:{109:14,110:14},reglagesProposes:PERMISSIF};

test('F5 pendant la validation de la correction du cut 109 : erreur (pas une pause), correction interrompue notée, aucune reprise',async()=>{
 const {b}=await lotPause({...OPTIONS,esv:a=>{a.validerMajEspace=async()=>{throw Error('Adaptateur ESV sans réponse (simulé).');};}});
 const p=await H.finPasse(b);
 assert.equal(p.etat,'erreur');assert.match(p.message,/validation incertaine/);
 assert.equal(H.evenements(b,'relecture-pause').length,0,'jamais une pause : la validation est incertaine');
 const etat=await b.api('relecture-etat');assert.equal(etat.correctionInterrompue.cut,109,'la correction interrompue bloque tout jusqu’à « J’ai contrôlé le cut 109 »');
 assert.equal('banane51RelectureReprise' in b.local.m,false,'aucun point gardé');
 await assert.rejects(b.api('relecture-reprendre'),/Aucune relecture en pause/);
 await assert.rejects(b.api('relecture-lancer'),/J’ai contrôlé le cut 109/);
});
