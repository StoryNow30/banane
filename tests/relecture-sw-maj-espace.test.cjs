'use strict';
/* 5.0, revue de la relecture (D-175, correction 4) et D-179 — MAJ+ESPACE, LE GESTE DE MIC, ET LA COHÉRENCE DE LA PASSE. Sur un vert
 * valide, Maj+Espace valide SUR PLACE : ESV reste sur le même cut (l'opérateur, deux fois). Preuve de la passe : la ligne du cut est écrite
 * « valid » ET ce même cut est toujours affiché. Si ESV va ailleurs, la passe s'arrête après la validation prouvée (rien d'autre n'est
 * fait) ; le dernier cut de la partie n'est jamais validé par Maj+Espace (ESV chargerait la partie suivante) ; un cut que la passe vient
 * de corriger est validé par un opérateur dans la liste d'ESV : une seconde passe ne le réécrit pas. Données synthétiques : la partie a
 * 116 cuts. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,PERMISSIF,apresLot}=require('./helpers/relecture-essais.cjs');

test('Maj+Espace : ESV affiche un autre cut après la validation → arrêt après la validation prouvée ; dernier cut de la partie jamais validé ; cut déjà corrigé jamais réécrit',async()=>{
 /* Sans référence de la liste « À contrôler » : la médiane de l'écartement vient de la table de la liste tenue par la page. */
 const {b,adapter,lot,local}=await H.lotRelecture({mode:'corriger',decisions:{109:14,115:20},reglagesProposes:PERMISSIF,ecartementPartie:null,
  esv:a=>{a.total=116;a.majEspaceVers=cut=>cut===109?100:cut;a.bordsListe=true;}});
 const p=await H.finPasse(b);
 const g=H.evenements(b,'relecture-debut')[0].ecartementPartieMm;assert.ok(Number.isFinite(g)&&Math.abs(g-1435)<20,`médiane de la table de la page : ${g}`);
 assert.equal(p.etat,'erreur');assert.equal(p.corriges,1);
 assert.match(p.message,/arrêtée après la correction du cut 109 \(validation vue\) : après Maj\+Espace, ESV affiche le cut 100 de la partie 23, pas le cut 109/);
 assert.equal('banane50RelectureIntention' in local.m,false,'validation prouvée par l’écriture : aucune intention');
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109]);assert.equal(H.evenements(b,'relecture-ombre').at(-1).identity.cut,109,'rien d’autre après');
 /* L'opérateur relance : 109 est maintenant validé par un opérateur dans la liste d'ESV ; 115 est le dernier cut de la partie (116 cuts). */
 adapter.majEspaceVers=null;await b.api('relecture-lancer');const q=await H.finPasse(b);
 assert.equal(q.etat,'finie',q.message);assert.equal(q.corriges,0);
 const ev=H.evenements(b,'relecture-ombre'),dernier=c=>ev.filter(e=>e.identity.cut===c).at(-1);
 assert.equal(dernier(109).action,'visite');assert.match(dernier(109).raisonAction,/traité par un opérateur/);
 assert.equal(dernier(115).action,'visite');assert.match(dernier(115).raisonAction,/dernier cut de la partie/);
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109],'aucune autre validation');
 assert.equal(apresLot(b,lot).filter(c=>c.action==='apply').length,1);
});
