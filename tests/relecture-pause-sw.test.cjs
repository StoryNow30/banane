'use strict';
/* Test 17 (D-232 à D-234) — PAUSE ET REPRISE DE LA RELECTURE, service worker réel (tests/helpers/relecture-pause.cjs), réglage allumé :
 *  1. « Pause » demandée pendant la passe : la passe finit l'étape en cours, passe « en pause », garde son point, ne journalise pas de fin ;
 *  2. pendant la pause : ni lot, ni Écho, ni retour à un cut, ni seconde passe, ni relance à zéro ; la connexion reste permise (après un F5) ;
 *  3. « Reprendre » repart au cut gardé, sans repasser sur les cuts relus ; le cut en cours à la pause est refait ; un seul « relecture-fin ».
 * Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause,attendreEtat,cutsAllees}=require('./helpers/relecture-pause.cjs');

test('pause demandée à l’arrivée au cut 109 : en pause, point gardé ; ni lot ni relance pendant la pause ; reprise sans repasser sur les cuts relus',async()=>{
 const refus=[];let demande=null,reprendreEnCours=null;
 const {b,adapter}=await lotPause({esv:(a,bb)=>{a.surAller=async t=>{if(t.cut!==109||demande)return;demande=await bb.api('relecture-pause');reprendreEnCours=await bb.api('relecture-reprendre').then(()=>'accepté',e=>e.message);}}});
 const p=await attendreEtat(b,'en-pause'),cutPause=p.cut,faitsPause=p.faits;   /* la passe est un objet vivant : valeurs prises avant la reprise */
 assert.equal(demande.pauseDemandee,true);assert.match(reprendreEnCours,/Relecture après le lot en cours/,'« Reprendre » est refusée tant que la passe travaille (elle fait partie des actions que la relecture vivante interdit)');
 assert.equal(p.pauseRaison,'mic');assert.equal(p.pauseDemandee,false);assert.equal(p.fin,null,'la passe n’est pas finie');
 assert.equal(H.evenements(b,'relecture-fin').length,0,'pas de relecture-fin : elle n’est pas finie');
 const ev=H.evenements(b,'relecture-pause');assert.equal(ev.length,1);assert.equal(ev[0].raison,'mic');assert.equal(ev[0].stocke,true);
 const point=b.local.m.banane51RelectureReprise;assert.ok(point,'point de reprise gardé');assert.equal(point.v,1);assert.equal(point.faits,faitsPause);
 assert.deepEqual(JSON.parse(JSON.stringify(point)),point,'le point survit à une sérialisation JSON (celle du stockage de Chrome)');
 assert.equal(point.sel.cuts[point.index].cut,cutPause,'le point désigne le prochain cut à relire');
 assert.equal(faitsPause,2,'108 et 109 sont relus : la pause demandée pendant l’arrivée au cut 109 attend la fin de ce cut');
 const relus=point.sel.cuts.slice(0,point.index).map(c=>c.cut);
 /* Pendant la pause : rien d'autre ne part. */
 for(const [act,args] of [['start',{part:23,start:1,end:2}],['goto-cut',{part:23,cut:5}],['relecture-lancer',{}],['native-start',{}],['resume',{}],['retry',{}]])
  await b.api(act,args).then(()=>refus.push(act+' accepté'),e=>refus.push(e.message));
 assert.equal(refus.length,6);for(const m of refus)assert.match(m,/Relecture en pause/,m);
 assert.match(refus[2],/Reprendre la relecture/,'la relance à zéro renvoie à la reprise');
 await b.api('connect',{tabId:1});   /* la connexion reste permise : c'est ce qu'on fait après un F5 */
 const avant=cutsAllees(adapter).length;
 /* Reprise. */
 await b.api('relecture-reprendre');
 const fin=await H.finPasse(b);
 assert.equal(fin.etat,'finie');assert.equal(fin.faits,7,'les 7 cuts de la sélection, une seule fois chacun');
 const apres=cutsAllees(adapter).slice(avant);
 for(const c of relus)assert.equal(apres.includes(c),false,`le cut ${c}, relu avant la pause, n’est pas revisité`);
 assert.equal(apres[0],cutPause,'la reprise repart au cut gardé');
 assert.equal(H.evenements(b,'relecture-fin').length,1);assert.equal(H.evenements(b,'relecture-fin')[0].issue,'fin');assert.equal(H.evenements(b,'relecture-fin')[0].faits,7);
 assert.equal(H.evenements(b,'relecture-reprise').length,1);
 assert.equal('banane51RelectureReprise' in b.local.m,false,'le point est effacé à la fin');
 const vus=H.evenements(b,'relecture-ombre').map(e=>e.identity.cut);assert.equal(new Set(vus).size,vus.length,'chaque cut relu une seule fois dans le journal');
});
