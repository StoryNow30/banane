'use strict';
/* 5.0, D-179 — MAJ+ESPACE SUR PLACE : la preuve de la validation est la ligne écrite « valid » ET le même cut toujours affiché. Ici ESV
 * reste bien sur le cut, mais la ligne est écrite avec un autre statut que « valid » : rien n'est prouvé, la passe s'arrête sur ce cut
 * en le disant, note l'intention de contrôle de ce cut, et n'écrit plus rien (ni deuxième Maj+Espace, ni pose, ni pas vers le suivant).
 * Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,PERMISSIF,apresLot}=require('./helpers/relecture-essais.cjs');

test('Maj+Espace sur place, ligne écrite avec un autre statut que « valid » → arrêt sur ce cut, rien d’autre n’est écrit ni avancé',async()=>{
 const {b,adapter,lot,local}=await H.lotRelecture({mode:'corriger',decisions:{109:14,115:20},reglagesProposes:PERMISSIF,esv:a=>{a.ecriture='autre';}});
 const p=await H.finPasse(b);
 assert.equal(p.etat,'erreur');assert.match(p.message,/cut 109 : Maj\+Espace envoyé, aucune écriture de validation vue/);
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109],'une seule frappe, sur le seul cut corrigé');
 assert.equal(adapter.identity.cut,109,'ESV est resté sur le cut : la passe n’a pas avancé');
 const ev=H.evenements(b,'relecture-ombre');assert.equal(ev.at(-1).identity.cut,109);assert.equal(ev.at(-1).action,'correction-incertaine');
 assert.deepEqual(local.m.banane50RelectureIntention.map(x=>x.cut),[109],'cut à contrôler noté');
 const apres=apresLot(b,lot);assert.equal(apres.filter(c=>c.action==='apply').length,1);
 const i=apres.findIndex(c=>c.action==='validerMajEspace');
 assert.equal(apres.slice(i+1).some(c=>['goToCut','apply','validerMajEspace','restore'].includes(c.action)),false,'après la frappe, ni pas, ni pose, ni autre validation');
});
