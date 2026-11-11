'use strict';
/* CH-107 — outil de lecture d'export (chantiers/CH-107/outils/relecture-cuts-vides.cjs) sur un journal FABRIQUÉ : une partie avec une série de 4 cuts
 * vides relus en 0,3 s chacun, un cut à première capture vide, deux corrections ; une partie sans série. Vérifie les séries, leur durée, les comptes,
 * et qu'aucun identifiant ni adresse ne sort. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const OUTIL=path.join(__dirname,'..','chantiers/CH-107/outils/relecture-cuts-vides.cjs'),T=require(OUTIL);
const iso=ms=>new Date(Date.UTC(2026,10,11,9,0,0)+ms).toISOString();
const ID='0b1c2d3e-0000-4000-8000-123456789abc';
const cut=(t,part,c,{vide=false,premiere=false,points=null,action='visite',corriger=false,totalMs=300,raisonAction=null}={})=>({type:'relecture-ombre',lotId:ID,timestamp:iso(t),identity:{part,cut:c},role:'vert',zone:'pn',
 skipOmbre:vide?{raison:'aucun-point',points:{left:0,right:0},captures:2,capturesVides:2}:premiere?{raison:null,points:{left:0,right:0},captures:2,capturesVides:1}:{raison:null,points:points||{left:900,right:800},captures:1,capturesVides:0},
 critere:{corriger,regle:corriger?'ok':'commande',raison:'https://exemple.invalide/x '+ID},action,raisonAction,durees:{navigationMs:50,captureMs:200,calculMs:50,totalMs}});
function journal(){const ev=[];let t=0;const pousser=(...a)=>{t+=a[3]?.totalMs??300;ev.push(cut(t,...a));};
 pousser(15,100,{action:'corrige',corriger:true,totalMs:4000});pousser(15,101);
 for(const c of [102,103,104,105])pousser(15,c,{vide:true});
 pousser(15,106,{premiere:true,corriger:true,raisonAction:'correction écartée : capture sans point'});pousser(15,107,{vide:true});pousser(15,108,{action:'corrige',corriger:true});
 ev.push({type:'relecture-pause',timestamp:iso(t+1),raison:'points',cut:102,faits:3,total:9});
 pousser(16,10);pousser(16,11,{vide:true});pousser(16,12);pousser(16,13,{points:{left:30,right:20},action:'corrige',corriger:true});pousser(16,14,{points:{left:99,right:0}});
 return {events:ev};}

test('séries, durée, comptes par partie ; corrections sur un cut vide comptées',()=>{
 const r=T.analyser(journal().events.map(e=>({...e,_ms:Date.parse(e.timestamp)})),{min:3});
 assert.deepEqual(r.parties.map(p=>p.partie),[15,16]);
 const [a,b]=r.parties;
 assert.equal(a.cutsRelus,9);assert.equal(a.cutsVides,5);assert.equal(a.premiereVide,6);assert.equal(a.corriges,2);assert.equal(a.corrigesSurVide,0);
 assert.equal(a.regleAuraitSurVide,1,'la règle aurait corrigé 106 (première capture vide)');assert.equal(a.pointsMinCorrige,1700);
 assert.equal(a.series.length,1,'102–105 ; 107 seul ne fait pas une série');
 assert.deepEqual({...a.series[0],listeCuts:undefined},{premier:102,dernier:105,cuts:4,dureeMs:1200,msParCut:300,corriges:0,listeCuts:undefined});
 assert.deepEqual(a.pauses,[{raison:'points',cut:102,faits:3,total:9}]);
 assert.equal(b.cutsVides,1);assert.equal(b.series.length,0);
 /* Cuts peu denses (1 à 99 points) : à part, avec les points par rail et l'action ; un corrigé. */
 assert.equal(a.peuDenses,0);assert.equal(b.peuDenses,2);assert.equal(b.corrigesPeuDenses,1);assert.equal(b.pointsMinCorrige,50);
 assert.deepEqual(b.listePeuDenses.map(c=>[c.cut,c.points,c.gauche,c.droit,c.action]),[[13,50,30,20,'corrige'],[14,99,99,0,'visite']]);
 assert.equal(T.analyser(journal().events.map(e=>({...e,_ms:Date.parse(e.timestamp)})),{peu:50}).parties[1].peuDenses,0,'--peu 50 : 50 et 99 ne sont pas sous le seuil');
});
test('ligne de commande : Markdown sur un journal d’export, sans identifiant ni adresse ; --json',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'ch107-essai-'));
 try{fs.writeFileSync(path.join(d,'ariane-journal-v4-essai.json'),JSON.stringify(journal()));
  const md=spawnSync(process.execPath,[OUTIL,d,'--cuts'],{encoding:'utf8'});assert.equal(md.status,0,md.stderr);
  assert.match(md.stdout,/\| 15 \| 9 \| 5 \| 6 \| 0 \| 2 \| 0 \| 0 \| 1700 \| 0 \| 1 \|/);
  assert.match(md.stdout,/\| 16 \| 5 \| 1 \| 1 \| 2 \| 1 \| 0 \| 1 \| 50 \| 0 \| 0 \|/);assert.match(md.stdout,/\| 13 \| 50 \| 30 \| 20 \| corrige \|/);assert.match(md.stdout,/\| 102 → 105 \| 4 \| 1,2 s \| 0,3 s \| 0 \|/);
  assert.match(md.stdout,/\| 106 \| 1re \| 0 \(0 \/ 0\) \| 2 \(1\) \|/);
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-|https?:/.test(md.stdout),false,'aucun identifiant, aucune adresse');
  const js=spawnSync(process.execPath,[OUTIL,d,'--json'],{encoding:'utf8'});assert.equal(js.status,0,js.stderr);
  assert.equal(JSON.parse(js.stdout).parties[0].series[0].cuts,4);assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-|https?:/.test(js.stdout),false);
 }finally{fs.rmSync(d,{recursive:true,force:true});}
});
