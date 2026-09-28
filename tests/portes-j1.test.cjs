'use strict';
/* D5 : tools/portes-j1.cjs, portes de J1 (PLAN_SUITE §0) : 633 cuts de
 * validation inchangés ; 8 jeux : seuls 707, 711 (refusés) et 718 (ricochet)
 * changent, 0 juste perdu. Logique pure, sur des relevés minuscules. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../tools/portes-j1.cjs');
const lignesValidation=n=>Array.from({length:n},(_,i)=>({part:9,cut:i+1,stage:i%3?'anchored':'deferred',wouldApply:!!(i%3),reason:null,anchors:i%3,guardMm:null}));
const validation=n=>({lots:[{label:'p9',parity:{compared:n,identical:n},rows:lignesValidation(n)}]});
const ligne=(cut,o={})=>({cut,stage:'first-pass',applied:true,judged:true,wrong:false,worstMm:2,...o});
const jeux=(g)=>({sessions:[{jeu:'e',label:'pilote-p9-4.7.18',rows:[ligne(10),ligne(11,{applied:false,stage:'deferred',judged:false,wrong:null,worstMm:null})]},
  {jeu:'g',label:'natif-p11',rows:g}]});
const gBase=[ligne(707,{wrong:true,worstMm:14}),ligne(711,{wrong:true,worstMm:12}),ligne(718,{applied:false,stage:'deferred',judged:false,wrong:null,worstMm:null}),ligne(720)];
const gApresD2=[ligne(707,{applied:false,stage:'deferred',judged:false,wrong:null,worstMm:null}),ligne(711,{applied:false,stage:'deferred',judged:false,wrong:null,worstMm:null}),
  ligne(718,{stage:'anchored',wrong:true,worstMm:11}),ligne(720)];
const ref=()=>({validation:validation(633),jeux:jeux(gBase)});

test('portes vertes : 633 cuts inchangés, seuls 707 et 711 refusés et 718 posé, 0 juste perdu',()=>{
  const r=P.evaluer(ref(),{validation:validation(633),jeux:jeux(gApresD2)});
  assert.deepEqual(r.portes.map(p=>[p.id,p.vert]),[['validation-633',true],['jeux-8',true]]);
  assert.equal(r.vert,true);
  assert.match(P.texte(r),/VERT +633 cuts de validation/);
});
test('code de la 4.8.0 inchangé : la porte des 8 jeux est rouge (707, 711 et 718 ne changent pas)',()=>{
  const r=P.evaluer(ref(),ref());
  assert.deepEqual(r.portes.map(p=>p.vert),[true,false]);assert.equal(r.vert,false);
  assert.match(P.texte(r),/ROUGE +8 jeux[^\n]*natif-p11:707 attendu refusé, inchangé/);
});
test('une décision de validation changée rend la porte rouge et la nomme',()=>{
  const cur=validation(633);cur.lots[0].rows[4].stage='deferred';cur.lots[0].rows[4].wouldApply=false;
  const r=P.evaluer(ref(),{validation:cur,jeux:jeux(gApresD2)});
  assert.equal(r.portes[0].vert,false);assert.deepEqual(r.portes[0].changes.map(c=>c.cle),['p9:9:5']);
  assert.match(P.texte(r),/ROUGE +633 cuts de validation : 1 décision changée[^\n]*p9:9:5 anchored→deferred/);
});
test('un cut de validation en moins ou en trop est un changement, et le compte doit rester 633',()=>{
  const r=P.evaluer(ref(),{validation:validation(632),jeux:jeux(gApresD2)});
  assert.equal(r.portes[0].vert,false);assert.equal(r.portes[0].cuts,632);assert.deepEqual(r.portes[0].changes.map(c=>c.cle),['p9:9:633']);
});
test('un juste perdu ou un changement hors des trois attendus rend la porte des jeux rouge',()=>{
  const perdu=gApresD2.map(x=>x.cut===720?ligne(720,{applied:false,stage:'deferred',judged:false,wrong:null,worstMm:null}):x);
  const r=P.evaluer(ref(),{validation:validation(633),jeux:jeux(perdu)});
  assert.equal(r.portes[1].vert,false);assert.deepEqual(r.portes[1].justesPerdus,['natif-p11:720']);
  assert.match(P.texte(r),/juste perdu : natif-p11:720/);
  const autre=jeux(gApresD2);autre.sessions[0].rows[0]=ligne(10,{worstMm:3});
  const r2=P.evaluer(ref(),{validation:validation(633),jeux:autre});
  assert.equal(r2.portes[1].vert,false);assert.deepEqual(r2.portes[1].inattendus,['pilote-p9-4.7.18:10']);
});
test('parité observation/rejeu dégradée : porte de validation rouge',()=>{
  const cur=validation(633);cur.lots[0].parity={compared:633,identical:632};
  const r=P.evaluer(ref(),{validation:cur,jeux:jeux(gApresD2)});
  assert.equal(r.portes[0].vert,false);assert.match(P.texte(r),/parité p9 632\/633 \(référence 633\/633\)/);
});
test('--verify : troisième porte, verte seulement si verify sort à 0',()=>{
  const cur={validation:validation(633),jeux:jeux(gApresD2)};
  assert.deepEqual(P.evaluer(ref(),cur,{verify:{code:0}}).portes.map(p=>[p.id,p.vert]).at(-1),['verify',true]);
  const r=P.evaluer(ref(),cur,{verify:{code:1}});assert.equal(r.vert,false);assert.match(P.texte(r),/ROUGE node tools\/verify\.cjs : code 1/);
});
/* Revue de code du 28/09 (D5). */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'portes-j1-'));
function entrees(dir,lignes){const f=path.join(dir,'entrees.env');fs.writeFileSync(f,lignes.join('\n')+'\n');return f;}
const cinq=d=>['DONNEES_C5','KIT_EXTRAIT','P9_4718R','ECHO_P11','SORTIE'].map(k=>`${k}=${d}/${k.toLowerCase()}`);
test('revue : référence absente → refus immédiat, avant tout rejeu',()=>{
  const d=tmp(),f=entrees(d,cinq(d));
  assert.throws(()=>P.run(['--entrees',f,'--reference',path.join(d,'absente.json')]),/référence absente/);
  assert.equal(fs.existsSync(path.join(d,'sortie')),false,'aucun rejeu lancé');
});
test('revue : entrées avec export et guillemets acceptées ; chemin avec = ou @ refusé',()=>{
  const d=tmp(),e=P.lireEntrees(entrees(d,cinq(d).map((l,i)=>i%2?'export '+l.replace('=','="')+'"':l)));
  assert.equal(e.KIT_EXTRAIT,`${d}/kit_extrait`);assert.equal(e.DONNEES_C5,`${d}/donnees_c5`);
  assert.throws(()=>P.lireEntrees(entrees(d,cinq(d).map(l=>l.startsWith('ECHO')?l+'@v2':l))),/ECHO_P11.*= ou @/);
});
test('revue : --reprendre ne garde une sortie que si l’empreinte du code et les arguments sont les mêmes',()=>{
  const d=tmp(),f=path.join(d,'jeu-a.json');fs.writeFileSync(f,'{}');
  assert.equal(P.reutilisable(f,'E1'),false,'sans empreinte consignée');
  fs.writeFileSync(f+'.empreinte','E1');assert.equal(P.reutilisable(f,'E1'),true);assert.equal(P.reutilisable(f,'E2'),false);
});
test('revue : --figer refuse un relevé fait sur un code modifié (non commité)',()=>{
  const d=tmp(),r=path.join(d,'releve.json');
  fs.writeFileSync(r,JSON.stringify({code:{commit:'abc1234',modifie:true},validation:validation(633),jeux:jeux(gBase)}));
  assert.throws(()=>P.run(['--releve',r,'--figer',path.join(d,'ref.json')]),/code modifié/);
  assert.equal(fs.existsSync(path.join(d,'ref.json')),false);
});
/* Seconde revue du 28/09 (D5). */
test('revue 2 : --figer refuse un relevé sans commit connu (git absent) et exige un chemin',()=>{
  const d=tmp(),r=path.join(d,'releve.json');
  fs.writeFileSync(r,JSON.stringify({code:{commit:null,modifie:false},validation:validation(633),jeux:jeux(gBase)}));
  assert.throws(()=>P.run(['--releve',r,'--figer',path.join(d,'ref.json')]),/code modifié ou inconnu/);
  assert.throws(()=>P.run(['--releve',r,'--figer']),/--figer : chemin/);
});
test('revue 2 : chemins relatifs des entrées résolus depuis le dossier du fichier',()=>{
  const d=tmp(),f=entrees(d,['DONNEES_C5=c5','KIT_EXTRAIT=kit','P9_4718R=/abs/p9r','ECHO_P11=./echo','SORTIE=sortie']);
  const e=P.lireEntrees(f);assert.equal(e.DONNEES_C5,path.join(d,'c5'));assert.equal(e.ECHO_P11,path.join(d,'echo'));assert.equal(e.P9_4718R,'/abs/p9r');
});
test('revue 2 : l’empreinte des entrées change quand un fichier d’entrée change',()=>{
  const d=tmp();fs.mkdirSync(path.join(d,'lot'));fs.writeFileSync(path.join(d,'lot','a.json'),'{}');
  const e1=P.empreinteEntrees([path.join(d,'lot')]);
  assert.equal(P.empreinteEntrees([path.join(d,'lot')]),e1);
  fs.writeFileSync(path.join(d,'lot','a.json'),'{"x":1}');assert.notEqual(P.empreinteEntrees([path.join(d,'lot')]),e1);
});
