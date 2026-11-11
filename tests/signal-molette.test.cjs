'use strict';
/* CH-105 — LA MOLETTE DU NOMBRE DE PARTIES (rendu, sans navigateur) : src/signal-rendu.js dessine une molette (rôle « slider », valeur, bornes, nom
 * « Nombre de parties ») là où il y avait six boutons ; la borne haute du panneau (panel.js `FILE_N_MAX`, panel.html `#file-n`) est celle de la file
 * (src/file-parties.js `MAX_PARTIES`) ; la chaîne des parties tient jusqu'à 20 (au-delà de 8 : points serrés, numéros du premier, du courant et du dernier). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const R=path.resolve(__dirname,'..');
const FP=require(R+'/src/file-parties.js');
const S5=require(R+'/src/signal-rendu.js');

test('la borne haute du panneau est le MAX_PARTIES de la file (panel.js et panel.html)',()=>{
 const pj=fs.readFileSync(R+'/panel.js','utf8'),ph=fs.readFileSync(R+'/panel.html','utf8');
 const m=pj.match(/FILE_N_MAX\s*=\s*(\d+)/);assert.ok(m,'panel.js déclare FILE_N_MAX');
 assert.equal(Number(m[1]),FP.MAX_PARTIES);
 const champ=ph.match(/<input[^>]*id="file-n"[^>]*>/);assert.ok(champ,'panel.html : #file-n est un champ');
 assert.match(champ[0],/type="number"/);assert.match(champ[0],/min="1"/);assert.match(champ[0],new RegExp(`max="${FP.MAX_PARTIES}"`));
 assert.ok(!/\[1,\s*2,\s*3,\s*4,\s*5,\s*8\]/.test(pj),'plus de liste fixe de nombres dans panel.js');
});

const mol=(n,max=20)=>S5.moletteHtml({n,min:1,max});
test('la molette : rôle, valeur, bornes, nom, 1 à 20 dans la bande, « − » et « + » éteints aux bornes',()=>{
 const h=mol(7);
 assert.match(h,/role="slider"/);assert.match(h,/aria-label="Nombre de parties"/);
 assert.match(h,/aria-valuenow="7"/);assert.match(h,/aria-valuemin="1"/);assert.match(h,/aria-valuemax="20"/);assert.match(h,/aria-valuetext="7 parties"/);
 for(let k=1;k<=20;k++)assert.match(h,new RegExp(`data-act="sg:file-n:${k}"`),'nombre '+k);
 assert.doesNotMatch(h,/sg:file-n:(0|21)"/);
 assert.match(h,/style="--i:6"/,'la bande est placée par son rang (transform)');
 assert.match(h,/class="sg-mol-moins"[^>]*data-act="sg:file-n:6"/);assert.match(h,/class="sg-mol-plus"[^>]*data-act="sg:file-n:8"/);
 assert.doesNotMatch(h,/disabled/);
 assert.match(mol(1),/class="sg-mol-moins"[^>]*disabled/);assert.doesNotMatch(mol(1),/class="sg-mol-plus"[^>]*disabled/);
 assert.match(mol(20),/class="sg-mol-plus"[^>]*disabled/);assert.doesNotMatch(mol(20),/class="sg-mol-moins"[^>]*disabled/);
 assert.match(mol(1),/aria-valuetext="1 partie"/);
 /* une valeur hors bornes est ramenée dedans */
 assert.match(mol(0),/aria-valuenow="1"/);assert.match(mol(99),/aria-valuenow="20"/);
});

/* L'onglet Constellation, rendu sur un instantané minimal. */
const base=(file)=>({sig:{theme:'sombre',taille:'large',activite:'orbite',connexion:{statut:'ready'}},file:{etat:'repos',actif:false,n:null,plan:[],parties:[],bilan:[],departs:[],
 lancer:{texte:'Lancer la file · 2 parties',actif:true},reprendre:null,secondaire:null,principal:null,nombreTous:{n:2,min:1,max:20},nombre:{n:2,min:1,max:20},partieAffichee:13,...file},boutonsOrbite:[]});
const chaine=h=>{const ol=h.match(/<ol class="sg-chaine[^"]*"[^>]*>([\s\S]*?)<\/ol>/);assert.ok(ol,'chaîne');return {cls:h.match(/<ol class="(sg-chaine[^"]*)"/)[1],li:[...ol[1].matchAll(/<li([^>]*)>.*?<\/li>/g)].map(m=>m[0])};};
test('la chaîne : 12 et 20 parties prêtes, 12 en cours ; au-delà de 8 seuls le premier, le courant et le dernier gardent leur numéro',()=>{
 for(const n of [9,12,20]){
  const s=base({nombreTous:{n,min:1,max:20},nombre:{n,min:1,max:20}}),h=S5.ongletFileHtml(s,{}).corps,c=chaine(h);
  assert.equal(c.li.length,n,n+' points');assert.match(c.cls,/sg-chaine-dense/);
  const num=c.li.map(l=>/data-num="1"/.test(l));
  assert.deepEqual(num.map((v,i)=>v?i:-1).filter(i=>i>=0),[0,n-1],n+' prête : premier (courant) et dernier numérotés');
 }
 const plan=[...Array(12)].map((_,i)=>100+i);
 const s=base({etat:'lot',actif:true,n:12,plan,rang:5,part:105}),c=chaine(S5.ongletFileHtml(s,{}).corps);
 assert.equal(c.li.length,12);assert.match(c.li[5],/data-etat="en-cours"/);
 assert.deepEqual(c.li.map((l,i)=>/data-num="1"/.test(l)?i:-1).filter(i=>i>=0),[0,5,11]);
 const c8=chaine(S5.ongletFileHtml(base({nombreTous:{n:8,min:1,max:20},nombre:{n:8,min:1,max:20}}),{}).corps);
 assert.equal(c8.li.length,8);assert.doesNotMatch(c8.cls,/dense/,'jusqu’à 8 : la chaîne d’avant');
});
test('l’onglet Constellation prête porte la molette ; le titre suit le nombre choisi',()=>{
 const h=S5.ongletFileHtml(base({nombreTous:{n:12,min:1,max:20},nombre:{n:12,min:1,max:20}}),{}).corps;
 assert.match(h,/role="slider"[^>]*aria-valuenow="12"/);assert.doesNotMatch(h,/sg-seg/);assert.match(h,/12 parties/);
});
