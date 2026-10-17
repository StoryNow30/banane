'use strict';
/* 5.0 — VERTS À CONTRÔLER DANS LE SERVICE WORKER (action de panneau `verts-a-controler`). Service worker réel en VM, moteur et GCV1
 * réels, ESV simulé (montage tests/helpers/regles-metier-lot.cjs : lot 112–115, 112 et 113 différés), instantané E1 de la liste
 * SYNTHÉTIQUE rangé dans chrome.storage.local. La liste est calculée à la demande, en lecture seule :
 *  - AUCUNE action dans ESV : ni commande à l'adaptateur, ni message à l'onglet, ni requête ;
 *  - la décision et la pose du lot sont les mêmes, octet pour octet, avec la liste active ou coupée ;
 *  - aucune position dans ce qui sort. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {lot,neutre,decisions,metier,deq,rec,S}=require('./helpers/regles-metier-lot.cjs');
const {memoire}=require('./helpers/perf-production.cjs');
const LM=require('../src/liste-memoire.js');

/* Instantané de la partie 23 : 140 lignes sur une voie droite inventée (dixièmes de mm) ; le lot 112–115 y est « invalid » ; le vert
 * 111 a un écartement de 30 mm de trop, le vert 116 un rail gauche 35 mm trop haut, le vert 130 (loin du lot) 40 mm de trop. */
function instantane({lotValide=false}={}){const n=140,st=[],fl=[],ed=[];
 for(let i=0;i<n;i++){const auLot=i>=112&&i<=115,dg=i===111?300:i===130?400:0,dz=i===116?350:0;
  st.push(auLot&&!lotValide?1:0);fl.push(0);ed.push(10000*i,-7175-dg/2,dz,10000*i,7175+dg/2,0);}
 return LM.compacter({st,fl,ed},{partie:23,at:'2026-10-17T00:00:00.000Z',version:'essai',cle:'cle-essai'});}
async function ranger(b,snap){const m=memoire();await m.set({[LM.CLE_INDEX]:[{partie:23,at:snap.at}],[LM.PRE_INST+23]:snap});b.ctx.chrome.storage.local=m;return m;}
function compteurOnglet(b){const t=b.ctx.chrome.tabs,orig=t.sendMessage,o={n:0};t.sendMessage=async(...a)=>{o.n++;return orig(...a);};return o;}

let livre,coupe;
before(async()=>{livre=await lot(undefined,{fin:115});coupe=await lot(undefined,{fin:115});coupe.b.ctx.BananeSettings={...coupe.b.ctx.BananeSettings,vertsAControler:{actif:false}};});

test('liste calculée sur l\'instantané E1 et l\'ombre des règles métier ; aucune commande ni message à ESV',async()=>{
 await ranger(livre.b,instantane());
 const avant=livre.b.commands.length,appels=livre.adapter.calls.slice(),onglet=compteurOnglet(livre.b);
 const r=await livre.b.api('verts-a-controler',{partie:23});
 assert.equal(livre.b.commands.length,avant,'aucune commande à ESV');deq(livre.adapter.calls,appels,'adaptateur non appelé');assert.equal(onglet.n,0,'aucun message à l\'onglet');
 assert.equal(r.actif,true);assert.equal(r.format,'ariane-verts-a-controler-1');assert.equal(r.partie,23);assert.equal(r.source,'instantane');
 assert.equal(r.cutsDuLot,4);assert.equal(r.differes,2);
 const ids=r.verts.map(v=>v.i);assert.ok(ids.includes(111)&&ids.includes(116),JSON.stringify(ids));assert.ok(!ids.includes(130),'loin du lot');
 assert.ok(r.plages.some(p=>/^autour des? différés? 11[23]/.test(p.libelle)),r.plages.map(p=>p.libelle).join(' | '));
 assert.equal(r.tempsEstimeS,Math.round(r.aControler*3.7));
 assert.ok(!/bords|left|right|7175/.test(JSON.stringify(r)),'aucune position');
});

test('instantané incohérent avec le lot (autre liste) : écarté ; sans instantané, repli sur les fenêtres de B1',async()=>{
 await ranger(livre.b,instantane({lotValide:true}));
 const r=await livre.b.api('verts-a-controler',{partie:23});assert.notEqual(r.source,'instantane');assert.ok(!r.verts.some(v=>v.i===111));
 livre.b.ctx.chrome.storage.local=memoire();const s=await livre.b.api('verts-a-controler',{partie:23});assert.notEqual(s.source,'instantane');assert.equal(s.cutsDuLot,4);
});

test('réglage coupé : rien n\'est calculé',async()=>{
 await ranger(coupe.b,instantane());deq(await coupe.b.api('verts-a-controler',{partie:23}),{actif:false});
});

test('LA DÉCISION ET LA POSE NE CHANGENT PAS : mêmes commandes, rails, enregistrements, événements et décisions, liste active ou coupée',async()=>{
 const off=await lot(undefined,{fin:115,avant:b=>{b.ctx.BananeSettings={...b.ctx.BananeSettings,vertsAControler:{actif:false}};}});
 const on=await lot(undefined,{fin:115,avant:async b=>{await ranger(b,instantane());}});
 /* Pendant le lot, le panneau demande la liste : rien ne change non plus. */
 await on.b.api('verts-a-controler',{partie:23});
 deq(neutre(on.b.commands),neutre(off.b.commands),'mêmes commandes ESV, même ordre');
 deq(neutre(on.adapter.rails),neutre(off.adapter.rails));deq(on.adapter.calls,off.adapter.calls);
 deq(rec(on.b),rec(off.b));deq(metier(on.b),metier(off.b),'mêmes événements métier');
 assert.equal(JSON.stringify(neutre(decisions(on.b))),JSON.stringify(neutre(decisions(off.b))),'décisions identiques, octet pour octet');
 deq(decisions(off.b).map(([c,x])=>[c,x.stage]),[[112,'deferred'],[113,'deferred'],[114,'first-pass'],[115,'first-pass']]);
});

test('le moteur et la décision ne lisent pas le module ; le service worker le charge',()=>{
 const fs=require('node:fs'),path=require('node:path'),racine=path.resolve(__dirname,'..');
 assert.match(fs.readFileSync(path.join(racine,'background.js'),'utf8'),/'src\/verts-a-controler\.js'/);
 for(const f of fs.readdirSync(path.join(racine,'src')).filter(x=>x.endsWith('.js')&&!['verts-a-controler.js','settings.js'].includes(x))){
  const t=fs.readFileSync(path.join(racine,'src',f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/BananeVertsAControler|verts-a-controler|vertsAControler/.test(t),f+' ne lit pas le module');}
 assert.equal(S.vertsAControler.actif,true,'livré actif : il n\'agit pas sur ESV');
});
