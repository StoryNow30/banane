'use strict';
/* CH-158 — Relecture : garder toute l'ADV et reboucher les trous de 1 à 3 (et cuts isolés) après filtrerSelection,
 * en ne réintégrant que des cuts présents dans la sélection initiale (sel0). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../src/relecture-filtre-liste.js');
const O=require('../src/relecture-ombre.js');

const GAUGE=14350;
function table(n=100){
 const t={n,st:Array(n).fill(0),fl:Array(n).fill(0),ed:Array(6*n).fill(null)};
 for(let i=0;i<n;i++)t.ed.splice(6*i,6,i*10000,0,0,i*10000,GAUGE,0);
 return t;
}
function bosse(t,i,mm=5,rail='left'){t.ed[6*i+(rail==='left'?1:4)]+=Math.round(mm*10);}
const cutsDe=s=>s.cuts.map(c=>c.cut);

test('CH-158 : un vert lisse d’ADV n’est plus écarté ; un vert lisse d’abords peut l’être',()=>{
 const t=table(50);
 assert.deepEqual(F.DEFAULTS.zonesExclues,['pn','adv']);
 const entree={
  partie:20,
  total:50,
  zonesADV:[[5,10]],
  /* Grappe d'abords autour de 25, 27, 29 : plage 22..32 ; tous les verts 22, 23, 24, 26, 28, 30, 31, 32 sont lisses */
  lot:[{cut:25},{cut:27},{cut:29}]
 };
 const s=O.selection({...entree,tableListe:t});
 const gardes=cutsDe(s);
 for(let c=5;c<=10;c++)assert.ok(gardes.includes(c),`cut ADV ${c} conservé`);
 assert.ok(!s.filtresListe.some(x=>x.zone==='adv'),'aucun cut d’ADV dans filtresListe');
 assert.ok(s.filtresListe.length>0,'les verts lisses d’abords non retenus restent filtrables');
 assert.ok(s.filtresListe.every(x=>x.zone==='abords'));
});

test('CH-158 : régression — rebouchage D-284 après filtrerSelection (trous de 1 à 3 et cut isolé, uniquement depuis sel0)',()=>{
 const t=table(80);
 /* Avec voisinsFenetre=1 : evaluerCut(c) n'utilise que c-1 et c+1.
  * Grappe de poses du lot en 30, 31, 32 avec marge=10 -> plage d'abords 20..42 dans sel0 (verts 20..29 et 33..42).
  * 1) Bosses en 20 et 24 :
  *    - pour 20 (19..21 non lisse), 21 est non lisse aussi (voisin 20 décalé) ; 22 et 23 ont des voisins à 0 -> 22 et 23 sont lisses (trou de 2 entre 21 et 23) ;
  *    - avec bosse en 20 seul ? Non, avec bosse en 20 et 25 :
  *      * 20 et 21 non lisses
  *      * 22 (voisins 21, 23 : 0), 23 (22, 24 : 0) sont lisses -> trou de 2 cuts (22, 23) entre 21 et 24 (voisin de 25 non lisse) !
  * 2) Cut isolé : pour avoir un seul cut gardé par filtrerSelection au milieu de verts lisses (ex: 37 gardé par aControler ou alerteGardeVoie,
  *    avec la table toute lisse sur 33..42) : filtrerSelection ne garde que 37 sur 33..42 (isolé !), puis reboucherSelection réintègre 36 et 38 ! */
 bosse(t,20,10);
 bosse(t,25,10);
 const entree={
  partie:20,
  total:80,
  zonesADV:[[5,8]],
  lot:[{cut:30},{cut:31},{cut:32}],
  alertesGardeVoie:[{identity:{cut:37}}]
 };
 const opts={grappe:{min:3,trouCuts:5,marge:10},filtreListe:{voisinsFenetre:1}};
 const sel0=O.selection(entree,opts);
 const sel0Set=new Set(cutsDe(sel0));
 /* Vérifions d'abord ce que filtrerSelection seul produirait sans rebouchage : */
 const brutFiltre=F.filtrerSelection(sel0,{table:t,alertesGardeVoie:entree.alertesGardeVoie,options:{voisinsFenetre:1}});
 const brutSet=new Set(cutsDe(brutFiltre));
 assert.ok(!brutSet.has(22)&&!brutSet.has(23),'sans rebouchage, 22 et 23 creusent un trou de 2 entre 21 et 24');
 assert.ok(brutSet.has(37)&&!brutSet.has(36)&&!brutSet.has(38),'sans rebouchage, 37 est un cut isolé');

 const s=O.selection({...entree,tableListe:t},opts);
 const gardes=new Set(cutsDe(s));

 /* 1. Toute l'ADV 5..8 est présente */
 for(const c of [5,6,7,8])assert.ok(gardes.has(c),`ADV ${c} présent`);

 /* 2. Le trou (22, 23) entre 21 et 24 est rebouché */
 for(const c of [20,21,22,23,24,25,26])assert.ok(gardes.has(c),`cut ${c} présent après rebouchage du trou`);

 /* 3. Le cut isolé 37 récupère ses voisins immédiats 36 et 38 (présents dans sel0) */
 for(const c of [36,37,38])assert.ok(gardes.has(c),`cut ${c} (voisin du cut isolé 37) présent`);

 /* 4. Aucun cut hors de sel0 n'est réintégré (ex: 19 est hors de sel0 même s'il est voisin de 20) */
 assert.ok(!sel0Set.has(19),'19 n’est pas dans sel0');
 assert.ok(!gardes.has(19),'19 n’est pas réintégré car absent de sel0');
 for(const c of gardes)assert.ok(sel0Set.has(c),`cut ${c} appartenait à sel0`);

 /* 5. filtresListe ne contient que les cuts définitivement écartés (et aucun cut gardé) */
 const filtres=new Set(s.filtresListe.map(x=>x.cut));
 for(const c of gardes)assert.ok(!filtres.has(c),`cut gardé ${c} absent de filtresListe`);
 for(const c of [28,29,33,34,35,39,40,41,42])assert.ok(filtres.has(c),`cut ${c} définitivement écarté dans filtresListe`);

 /* 6. Cohérence des compteurs et plages */
 assert.equal(s.total,s.cuts.length);
 assert.equal(s.parZone.adv+s.parZone.abords,s.total);
 assert.equal(s.plages.reduce((n,p)=>n+p.relus,0),s.total);
});

test('CH-158 : selection() sans tableListe ou filtre actif:false — sortie strictement identique (octets JSON)',()=>{
 const t=table(40);
 const entree={partie:21,total:40,zonesPN:[[1,3]],zonesADV:[[10,15]],lot:[{cut:25},{cut:29,differe:true}],aControler:[35]};
 const ref=O.selection(entree);
 const sansNull=O.selection({...entree,tableListe:null});
 const coupe1=O.selection({...entree,tableListe:t},{filtreListe:false});
 const coupe2=O.selection({...entree,tableListe:t},{filtreListe:{actif:false}});
 assert.equal(JSON.stringify(sansNull),JSON.stringify(ref));
 assert.equal(JSON.stringify(coupe1),JSON.stringify(ref));
 assert.equal(JSON.stringify(coupe2),JSON.stringify(ref));
});
