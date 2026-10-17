'use strict';
/* 4.9.5 test 6 (D-157, D-164) — LE CLIC DU MODE RAPIDE CHOISI POUR LE LOT, CÔTÉ PAGE. Le service worker envoie le mode du lot avec
 * chaque `apply` (`options.clicHumain`), seulement s'il est corrigé. Dans la page (src/adapter-page.js, ESV simulé de
 * tests/helpers/esv-clic.cjs) :
 *  - sans option, ou avec 'tel-quel' : la trace de la base, octet pour octet (tests/fixtures/rapide-humain-50-base.json) ;
 *  - avec 'gauche-recentre' ou 'tout-recentre' : exactement la trace du même mode posé par le réglage de la page ;
 *  - valeur inconnue : le réglage de la page (tel-quel) ;
 *  - le relevé `clic-hors-vue` porte le mode qui a servi ; la restauration garde le réglage de la page. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('./helpers/esv-clic.cjs'),GOLDEN=require('./fixtures/rapide-humain-50-base.json');
const MODES=['gauche-recentre','tout-recentre'];
const sansHorsVue=({horsVue,vue,fenetre,...r})=>r;
const sansId=x=>JSON.stringify(x).replace(/frameId=[0-9a-f-]{36}/g,'frameId=<id>');
const parReglage=(nom,clicHumain)=>H.jouer(nom,{pilote:{rapide:{clicHumain}}});
const parOption=(nom,options)=>H.jouer(nom,{options});

test('sans option, option vide ou « tel-quel » : la trace de la base, octet pour octet, dans les neuf scénarios',async()=>{
 for(const options of [undefined,{},{clicHumain:'tel-quel'},{clicHumain:'autre-chose'},{clicHumain:null}])for(const nom of Object.keys(H.SCENARIOS)){
  const r=sansHorsVue(await parOption(nom,options));
  assert.equal(JSON.stringify(r),JSON.stringify(GOLDEN.scenarios[nom]),`${nom} (${JSON.stringify(options)})`);
 }
});

test('mode corrigé transmis par le lot : la même trace que ce mode posé par le réglage de la page, dans les neuf scénarios',async()=>{
 for(const mode of MODES)for(const nom of Object.keys(H.SCENARIOS)){
  const a=await parOption(nom,{clicHumain:mode}),b=await parReglage(nom,mode);
  assert.equal(sansId(a),sansId(b),`${mode} / ${nom}`);
  for(const c of a.journal.filter(j=>j.quoi==='canevas'))assert.ok(H.clicVisible(c,a.vue,a.fenetre),`${mode} / ${nom} : clic hors de la partie visible`);
 }
 /* Chaque mode change bien la trace du cut rapide : il est reçu. */
 const tq=JSON.stringify((await parOption('rapide-vue-droite')).journal);
 const g=await parOption('rapide-vue-droite',{clicHumain:'gauche-recentre'}),t=await parOption('rapide-vue-droite',{clicHumain:'tout-recentre'});
 assert.notEqual(JSON.stringify(g.journal),tq);assert.notEqual(JSON.stringify(t.journal),tq);assert.notEqual(JSON.stringify(g.journal),JSON.stringify(t.journal));
 assert.deepEqual(g.journal.filter(j=>j.quoi==='bouton').map(j=>j.id),['O2N3DCutRRClick','O2N3DCutLRClick'],'variante : droit d\'abord');
});

test('le lot prime sur le réglage de la page ; le relevé clic-hors-vue dit le mode qui a servi',async()=>{
 /* Réglage de page corrigé, lot « tel-quel » transmis : tel-quel, relevé compris. */
 const r=await H.jouer('rapide-vue-droite',{pilote:{rapide:{clicHumain:'tout-recentre'}},options:{clicHumain:'tel-quel'}});
 assert.equal(JSON.stringify(sansHorsVue(r)),JSON.stringify(GOLDEN.scenarios['rapide-vue-droite']));
 assert.equal(r.horsVue.length,1);assert.equal(r.horsVue[0].releve.mode,'tel-quel');
 /* Mode du lot corrigé, clic au bord (cas où la base relève un clic hors vue) : refus sans clic hors vue, aucun relevé. */
 for(const mode of MODES){const x=await parOption('reference-cible-gauche-au-bord',{clicHumain:mode});
  assert.match(x.erreur,/^Position proposée hors de la vue : left /,mode);assert.equal(x.horsVue.length,0,mode);}
});
