'use strict';
/* CH-019 — GARDE « APRÈS UN DIFFÉRÉ » (src/garde-apres-differe.js). Fonction pure : un cut que le lot allait valider est différé quand un des
 * `coupures` cuts qui le précèdent est un différé du lot ET (règle R3) qu'il a moins de `appuisMin` appuis. Règles R1 et R3 de CH-015
 * (rapport de banane-data, § 7 à § 11) ; définitions prises dans le ticket chantiers/CH-019.md (le script de CH-015 n'a pas été relu, voir le rapport). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../src/garde-apres-differe.js');

test('valeurs livrées : active, règle R3, 2 cuts précédents, moins de 2 appuis',()=>{
 assert.deepEqual({...G.DEFAUT},{actif:true,regle:'R3',coupures:2,appuisMin:2});
 assert.ok(Object.isFrozen(G.DEFAUT));
});

test('réglage : absent = valeurs livrées ; false = coupée ; clé par clé ; illisible = {ok:false}',()=>{
 assert.deepEqual(G.reglage(undefined),{ok:true,actif:true,regle:'R3',coupures:2,appuisMin:2});
 assert.deepEqual(G.reglage(false),{ok:true,actif:false,regle:'R3',coupures:2,appuisMin:2});
 assert.deepEqual(G.reglage({actif:false}),{ok:true,actif:false,regle:'R3',coupures:2,appuisMin:2});
 assert.deepEqual(G.reglage({regle:'R1',coupures:3}),{ok:true,actif:true,regle:'R1',coupures:3,appuisMin:2});
 for(const v of [true,null,7,'R3',[],{actif:'oui'},{regle:'R2'},{coupures:0},{coupures:1.5},{appuisMin:-1},{appuisMin:'2'}])
  assert.equal(G.reglage(v).ok,false,JSON.stringify(v));
});

test('R3 : un des 2 cuts précédents différé ET moins de 2 appuis : différé',()=>{
 for(const [differes,appuis] of [[[99],0],[[99],1],[[98],1],[[98,99],0]]){
  const r=G.juger({cut:100,differesLot:differes,appuis});
  assert.equal(r.differer,true,JSON.stringify({differes,appuis}));assert.equal(r.motif,'garde-apres-differe');
  assert.deepEqual(r.voisinsDifferes,differes.slice().sort((a,b)=>a-b));assert.equal(r.appuis,appuis);assert.equal(r.regle,'R3');}
});

test('R3 : 2 appuis ou plus, ou aucun différé dans les 2 cuts précédents : le cut suit son sort',()=>{
 assert.deepEqual(G.juger({cut:100,differesLot:[99],appuis:2}),{differer:false,motif:'appuis',regle:'R3',appuis:2,voisinsDifferes:[99]});
 assert.equal(G.juger({cut:100,differesLot:[97],appuis:0}).motif,'pas-de-differe');
 assert.equal(G.juger({cut:100,differesLot:[100,101],appuis:0}).motif,'pas-de-differe','le cut lui-même et les cuts suivants ne comptent pas');
 assert.equal(G.juger({cut:100,differesLot:[],appuis:0}).differer,false);
});

test('R1 : sans la condition d\'appuis',()=>{
 const R=G.reglage({regle:'R1'});
 assert.equal(G.juger({cut:100,differesLot:[99],appuis:5},R).differer,true);
 assert.equal(G.juger({cut:100,differesLot:[97],appuis:0},R).differer,false);
});

test('coupures : fenêtre réglable',()=>{
 assert.equal(G.juger({cut:100,differesLot:[97],appuis:0},G.reglage({coupures:3})).differer,true);
 assert.equal(G.juger({cut:100,differesLot:[98],appuis:0},G.reglage({coupures:1})).differer,false);
});

test('garde coupée : jamais de différé ; réglage illisible : les valeurs livrées s\'appliquent (la garde ne peut que différer)',()=>{
 assert.deepEqual(G.juger({cut:100,differesLot:[99],appuis:0},G.reglage(false)),{differer:false,motif:'garde-coupee',regle:'R3',appuis:0,voisinsDifferes:[99]});
 const r=G.juger({cut:100,differesLot:[99],appuis:0},G.reglage('illisible'));assert.equal(r.differer,true);assert.equal(r.reglageIllisible,true);
});

test('appuis illisibles : comptés 0 (la garde ne laisse passer que ce qu\'elle a mesuré) ; cut illisible : rien',()=>{
 assert.equal(G.juger({cut:100,differesLot:[99],appuis:null}).differer,true);
 assert.equal(G.juger({cut:100,differesLot:[99],appuis:null}).appuis,null);
 assert.equal(G.juger({cut:null,differesLot:[99],appuis:0}).differer,false);
 assert.equal(G.juger({cut:100,differesLot:null,appuis:0}).differer,false);
 assert.equal(G.juger({cut:100,differesLot:[99.5,'99',null],appuis:0}).differer,false,'seuls les cuts entiers comptent');
});

test('module pur : il ne lit ni chrome, ni ESV, ni le moteur',()=>{
 const src=require('node:fs').readFileSync(require.resolve('../src/garde-apres-differe.js'),'utf8');
 assert.ok(!/chrome\.|importScripts|BananeEngine|fetch\(|Date\.now|Math\.random/.test(src));
});
