'use strict';
/* CH-080b — préchauffage d'une coupe éloignée quand les nœuds ont la forme SUPPOSÉE d'ESV (maquette `eptForme=r` : filename() rend le nom de Potree « r… »,
 * l'adresse reste celle d'EPT), hiérarchie en fichiers, saut de 50 coupes. Forme SUPPOSÉE en attendant le relevé de console (chantiers/CH-080/releve-console.js).
 * Ce que l'essai PROUVE sur la maquette : nœuds nommés par leur clé, hiérarchie de la zone lue, nœuds et hiérarchies servis par le cache ; la forme est
 * dite par l'événement (`formeNoeud`, bits) ; aucune adresse dans les événements. Avec le module d'avant CH-080b, rien n'était demandé (essai rouge). */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs'),O=require('./ch080-outils.cjs');
const raison=N.indisponible()||(O.adaptateurCH080()===null?'outil patch absent':null),opts=raison?{skip:raison}:{};
const ouverts=[];after(async()=>{for(const s of ouverts)await s.fermer().catch(()=>{});});

test('forme SUPPOSÉE « r » : hiérarchie lue, nœuds de la coupe lointaine servis par le cache',opts,async()=>{
 const s=await O.ouvrir({correctif:true,forme:'r'});ouverts.push(s);
 const t=await s.transition();const p=t.evts.find(e=>e.kind==='prechauffage');
 assert.equal(p.saut,50);assert.equal(p.sansNom,0,'tous les nœuds nommés');assert.ok(p.hierarchies>=1,'hiérarchies lues : '+p.hierarchies);assert.ok(p.noeuds>0);
 assert.ok((p.formeNoeud&1)&&!(p.formeNoeud&2)&&(p.formeNoeud&16),'forme dite par l’événement : '+p.formeNoeud);
 assert.ok(t.cache>=5,`nœuds servis par le cache : ${t.cache} sur ${t.noeuds}`);assert.ok(t.hierCache>=1);
 assert.ok(!/\/|ept-data|\.bin|\d+-\d+-\d+-\d+/.test(JSON.stringify(t.evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse');
 console.log(`# forme r, saut 50 : ${p.hierarchies} hiérarchies, ${p.noeuds} nœuds demandés ; ${t.cache}/${t.noeuds} nœuds et ${t.hierCache}/${t.hierarchies} hiérarchies servis par le cache ; repos ${t.reposMs} ms`);
 await s.fermer();
});
