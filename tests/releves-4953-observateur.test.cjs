'use strict';
/* 4.9.5.3 (S6) — relevés en LECTURE SEULE de l'observateur passif de la page : statut et durée des nœuds ept-data, champs de liste gardés et
 * inventaire des noms de champs, événements relayés depuis l'adaptateur. Fausse page (tests/helpers/fake-page.cjs), données synthétiques.
 * Garanties : rien n'est émis vers ESV ; les comptes de la liste et B1 sont ceux d'avant ; jamais une valeur de ligne dans le journal. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {world,tick,ORIGIN}=require('./helpers/fake-page.cjs'),O=require('../src/esv-observer.js');
const TABLE='traj__00+0012345.678',LISTE=ORIGIN+'/api/u3d/projects/p-key/rails/'+TABLE;
const ept=(n,o={})=>({name:ORIGIN+'/data/ept-data/'+n+'.bin',startTime:100,responseEnd:140,duration:40,transferSize:1000,initiatorType:'xmlhttprequest',...o});
const fenetre=async w=>{w.runTimers();await tick();};

test('ressources ept-data : statuts, échecs (≥ 400 ou 0), absents distingués, durée totale et maximale, compteur cumulé', async () => {
 const w=world();
 w.po().emit([ept('0-0-0-0',{responseStatus:200,duration:30}),ept('1-0-0-0',{responseStatus:404,duration:80}),ept('1-1-0-0',{responseStatus:0,duration:10}),ept('2-0-0-0',{duration:5})]);
 await fenetre(w);
 let r=w.observed().filter(x=>x.kind==='resource').at(-1);
 assert.deepEqual([r.n,r.ept,r.statuts,r.sansStatut,r.echecs,r.echecsCumules,r.dureeTotMs,r.dureeMaxMs],[4,4,{200:1,404:1,0:1},1,2,2,125,80]);
 w.po().emit([ept('3-0-0-0',{responseStatus:503,duration:12.34})]);await fenetre(w);
 r=w.observed().filter(x=>x.kind==='resource').at(-1);assert.deepEqual([r.ept,r.echecs,r.echecsCumules,r.dureeMaxMs],[1,1,3,12.3],'le cumul court d\'une fenêtre à l\'autre');
 /* Un fichier de hiérarchie n'est pas un nœud de données : compté dans `n`, pas dans les relevés ept-data. */
 w.po().emit([{name:ORIGIN+'/data/ept-hierarchy/0-0-0-0.json',startTime:1,responseEnd:2,duration:1,responseStatus:500}]);await fenetre(w);
 r=w.observed().filter(x=>x.kind==='resource').at(-1);assert.equal(r.n,1);assert.ok(!('ept' in r),'aucun nœud ept-data dans la fenêtre : pas de champ');
});

test('ressources : relevé coupé par le réglage (relevesOff) : la fenêtre garde ses anciens champs seulement', async () => {
 const w=world();w.deliver({kind:'banane5:config',relevesOff:['ressources']});
 w.po().emit([ept('0-0-0-0',{responseStatus:404})]);await fenetre(w);
 const r=w.observed().filter(x=>x.kind==='resource').at(-1);assert.deepEqual(Object.keys(r).filter(k=>/ept|statuts|echecs|duree/.test(k)),[]);
 assert.equal(r.n,1);assert.equal(w.ctl.stats().enabled,true,'la coupure d\'un relevé ne coupe pas l\'observateur');
});

const ligne=(i,o={})=>({PartitionKey:'secret-partition',RowKey:'RK-'+String(i).padStart(6,'0'),ExtractionStatus:i%3?'valid':'invalid',TreatedByOperator:false,SeenByOperator:i%2===0,
 XLeftEdge:10+i,YLeftEdge:20,ZLeftEdge:30,XRightEdge:10+i,YRightEdge:21.435,ZRightEdge:30,RailSpacing:1.435+i*1e-3,TrajAzimuth:90+i,RailType:i%2?'U50':'U33',
 SuccessLeft:i%4!==0,SuccessRight:true,SuccessPoints:987000+i,PK:100.5+i,Free:'texte libre '+i,...o});
const page=(a,b,f=ligne)=>JSON.stringify({value:Array.from({length:b-a},(_,k)=>f(a+k))});
async function get(w,url){const x=new w.win.XMLHttpRequest();x.open('GET',url);x.send();await tick();await tick();w.runTimers();}

test('liste : inventaire des noms de champs une fois par chargement, jamais une valeur ; champs gardés résumés', async () => {
 const w=world({routes:(m,u)=>/\/rails\//.test(u)?{status:200,text:page(0,60)}:{status:200,text:'{}'}});
 await get(w,LISTE);await get(w,LISTE+'?npk=k1&nrk=r1');
 const lf=w.observed().filter(x=>x.kind==='list-fields');
 assert.equal(lf.length,1,'une seule fois, à la première page');
 const x=lf[0];assert.equal(x.listKey,TABLE);assert.equal(x.rows,60);
 assert.deepEqual(x.noms,[...x.noms].sort());for(const n of ['RailSpacing','TrajAzimuth','RailType','SuccessLeft','SuccessRight','SuccessPoints','PK','RowKey','ExtractionStatus','Free'])assert.ok(x.noms.includes(n),n);
 assert.equal(x.champs,x.noms.length);
 assert.equal(x.gardes.RailSpacing.n,60);assert.ok(Math.abs(x.gardes.RailSpacing.min-1.435)<1e-9&&Math.abs(x.gardes.RailSpacing.max-1.494)<1e-9);
 assert.deepEqual(x.gardes.RailType,{n:60,valeurs:{U50:30,U33:30}});assert.equal(x.gardes.PK.n,60);
 assert.deepEqual(x.gardes.Success.SuccessLeft,{n:60,vrai:45});assert.deepEqual(Object.keys(x.gardes.Success).sort(),['SuccessLeft','SuccessPoints','SuccessRight']);
 const texte=JSON.stringify(w.observed());for(const s of ['secret-partition','RK-000005','texte libre','987000','987010'])assert.ok(!texte.includes(s),'jamais la valeur '+s);
});

test('liste : les comptes et la table de B1 sont ceux d\'avant (champs gardés en plus, rien de cassé)', async () => {
 const sans=world({routes:(m,u)=>/\/rails\//.test(u)?{status:200,text:page(0,60,i=>{const l=ligne(i);for(const k of ['RailSpacing','TrajAzimuth','RailType','SuccessLeft','SuccessRight','SuccessPoints','PK'])delete l[k];return l;})}:{status:200,text:'{}'}});
 const avec=world({routes:(m,u)=>/\/rails\//.test(u)?{status:200,text:page(0,60)}:{status:200,text:'{}'}});
 for(const w of [sans,avec])await get(w,LISTE);
 const sel=w=>w.observed().filter(x=>x.kind==='list-page').map(({listKey,rows,counts,chars,status})=>({listKey,rows,counts,status}));
 assert.deepEqual(sel(avec),sel(sans));
 assert.deepEqual(avec.ctl.tables(),sans.ctl.tables());
 const req={kind:'banane5:voisins',id:'q',cut:30,fenetre:2,world:{left:[40,20,30],right:[40,21.435,30]}};
 for(const w of [sans,avec]){w.posts.length=0;w.deliver(req);}
 const rep=w=>w.posts.map(p=>p.m).find(m=>m?.kind==='banane5:voisins-reponse');
 assert.deepEqual(rep(avec),rep(sans),'la réponse à B1 est identique, champ pour champ');
});

test('liste : relevé coupé (champsListe) : ni inventaire ni champs gardés', async () => {
 const w=world({routes:(m,u)=>/\/rails\//.test(u)?{status:200,text:page(0,10)}:{status:200,text:'{}'}});
 w.deliver({kind:'banane5:config',relevesOff:['champsListe']});await get(w,LISTE);
 assert.equal(w.observed().filter(x=>x.kind==='list-fields').length,0);assert.equal(w.observed().filter(x=>x.kind==='list-page').length,1);
});

test('événements de l\'adaptateur : réduits aux nombres, booléens et courtes chaînes ; noms inconnus et relevé coupé écartés', async () => {
 const w=world();
 w.deliver({kind:'banane5:evt',event:{kind:'esv-event',nom:'railPairSelected',args:['23',1234,{x:1},[1],'x'.repeat(40),true,9,9],pageMs:12.3456,perdus:3}});
 w.deliver({kind:'banane5:evt',event:{kind:'esv-event',nom:'inconnu',args:[]}});
 w.deliver({kind:'banane5:evt',event:{kind:'autre',nom:'loading'}});
 w.deliver({kind:'banane5:evt',event:{kind:'diag-compteur-bloque',valeur:4,cuts:3,cut:77,pageMs:5.55}});
 w.deliver({kind:'banane5:evt',event:{kind:'diag-compteur-bloque',valeur:-1,cuts:'x'}},{source:{} });
 const e=w.observed();assert.equal(e.length,2);
 assert.deepEqual(e[0],{seq:e[0].seq,kind:'esv-event',nom:'railPairSelected',args:['23',1234,null,null,null,true],pageMs:12.3,perdus:3});
 assert.deepEqual([e[1].kind,e[1].valeur,e[1].cuts,e[1].cut,e[1].pageMs],['diag-compteur-bloque',4,3,77,5.6]);
 w.deliver({kind:'banane5:config',relevesOff:['esvEvents','compteurBloque']});
 w.deliver({kind:'banane5:evt',event:{kind:'esv-event',nom:'loading',args:[]}});w.deliver({kind:'banane5:evt',event:{kind:'diag-compteur-bloque',valeur:2,cuts:3}});
 assert.equal(w.observed().length,2,'coupés par les réglages');
});

test('le message d\'un autre expéditeur ou d\'une autre origine n\'est jamais pris', async () => {
 const w=world();
 w.deliver({kind:'banane5:evt',event:{kind:'esv-event',nom:'loading',args:[]}},{origin:'https://autre.test'});
 w.deliver({kind:'banane5:evt',event:{kind:'esv-event',nom:'loading',args:[]}},{source:{}});
 assert.equal(w.observed().length,0);
});

test('fonctions pures : argsReduits', () => {
 assert.deepEqual(O.argsReduits('pas un tableau'),[]);assert.deepEqual(O.argsReduits([NaN,Infinity,'a',false,undefined]),[null,null,'a',false,null]);
});
