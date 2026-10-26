'use strict';
/* Test 17 (D-232 à D-234) — PAUSE ET CORRECTIONS, mode « corriger », service worker réel :
 *  1. une pause demandée PENDANT la pose d'une correction n'interrompt rien : la correction va jusqu'à sa validation (jamais entre la pose et la validation), puis la passe s'arrête ;
 *     à la reprise, le cut corrigé n'est pas corrigé une seconde fois ;
 *  2. un F5 PENDANT la validation d'une correction reste une erreur (jamais une pause) : la correction interrompue est notée et bloque tout, la reprise n'existe pas. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause,attendreEtat}=require('./helpers/relecture-pause.cjs');
const {PERMISSIF}=require('./helpers/relecture-essais.cjs');
const OPTIONS={mode:'corriger',decisions:{109:14,110:14},reglagesProposes:PERMISSIF};

test('pause demandée pendant la pose de la correction du cut 109 : la correction est finie et validée, puis pause ; à la reprise, 109 n’est pas corrigé deux fois',async()=>{
 let demande=null;
 const {b,adapter}=await lotPause({...OPTIONS,esv:(a,bb)=>{const pose=a.apply.bind(a);a.apply=async(...x)=>{if(a.identity.cut===109&&!demande)demande=await bb.api('relecture-pause');return pose(...x);};}});
 const p=await attendreEtat(b,'en-pause'),faitsPause=p.faits,cutPause=p.cut;
 assert.equal(demande.pauseDemandee,true);
 assert.deepEqual(adapter.majEspace.map(m=>m.cut),[109],'la correction de 109 est allée jusqu’à sa validation (Maj+Espace) avant la pause');
 assert.equal(H.evenements(b,'relecture-ombre').find(e=>e.identity.cut===109).action,'corrige');
 assert.equal(cutPause,110);assert.equal(faitsPause,2);assert.equal(p.corriges,1);
 assert.equal((await b.api('relecture-etat')).correctionInterrompue,null,'aucune correction interrompue');
 await b.api('relecture-reprendre');const fin=await H.finPasse(b);
 assert.equal(fin.etat,'finie');assert.deepEqual(adapter.majEspace.map(m=>m.cut),[109,110],'109 corrigé une fois, puis 110 ; jamais 109 deux fois');
 assert.equal(fin.corriges,2);
});
