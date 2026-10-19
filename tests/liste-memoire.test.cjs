'use strict';
/* E1 (5.0) : mémoire de la liste d'ESV (src/liste-memoire.js). Fixtures SYNTHÉTIQUES (voie droite inventée) ; aucune donnée réelle.
 * Garanties : instantané compact et réversible au dixième de mm ; mémoire alimentée par les seules validations 2xx d'un lot ;
 * `ecart-liste` au-delà de 1 mm seulement ; compteur « depuis le dernier passage » ; réglage coupé = rien ; vidage = effacé. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const LM=require('../src/liste-memoire.js'),{world,tick,ORIGIN}=require('./helpers/fake-page.cjs'),O=require('../src/esv-observer.js');
const TABLE='traj__synthetique',W=[700000,6600000,150],ID=i=>TABLE+'/RK-'+String(i).padStart(8,'0');
const EDGES=['XLeftEdge','YLeftEdge','ZLeftEdge','XRightEdge','YRightEdge','ZRightEdge'];
const ligneMonde=i=>[W[0]+i,W[1]+0.01*i,W[2],W[0]+i,W[1]+1.435+0.01*i,W[2]];
const corps=(i,dx=0)=>({ExtractionStatus:'valid',TreatedByOperator:true,...Object.fromEntries(EDGES.map((k,j)=>[k,ligneMonde(i)[j]+(j===0?dx:0)]))});
/* Table telle que l'observateur la rend : bords entiers au dixième de mm. */
function table(n,{modif={},statuts={}}={}){const st=[],fl=[],ed=[];
  for(let i=0;i<n;i++){st.push(statuts[i]??0);fl.push(i%2?2:1);const e=ligneMonde(i).map(LM.dm);if(modif[i])e[modif[i].j]+=Math.round(modif[i].mm*10);ed.push(...e);}
  return {key:TABLE,debut:true,rompue:false,tronquee:false,st,fl,ed};}
const fauxStockage=()=>{const d={};return {d,async get(k){return typeof k==='string'?(k in d?{[k]:structuredClone(d[k])}:{}):{}},async set(o){Object.assign(d,structuredClone(o));},async remove(ks){for(const k of [].concat(ks))delete d[k];}};};
const ECRITURE=(i,o={})=>({kind:'write',status:204,rowIndex:i,railPairId:ID(i),body:corps(i),...o});
const LOT={partie:7,enLot:true,version:'5.0.test'};

test('instantané : aller-retour exact au dixième de mm, valeurs absentes gardées, 9000 lignes ≈ 0,5 Mo au plus',()=>{
  const t=table(9000,{statuts:{3:1,5:2}});t.ed[6*4+2]=null;
  const s=LM.compacter(t,{partie:7,at:'2026-10-15T10:00:00.000Z',version:'5.0.test',cle:'abc'});
  assert.equal(s.format,LM.FORMAT);assert.equal(s.lignes,9000);
  const d=LM.decompacter(JSON.parse(JSON.stringify(s)));
  assert.deepEqual([d.st[3],d.st[5],d.fl[1],d.fl[2],d.ed[6*4+2]],[1,2,2,1,null]);
  assert.deepEqual(d.ed.slice(0,6*3),t.ed.slice(0,6*3));assert.deepEqual(d.ed.slice(-6),t.ed.slice(-6));
  const octets=JSON.stringify(s).length;assert.ok(octets<600000,'taille '+octets);
  assert.equal(LM.nomFichier(7,'2026-10-15T10:00:00.000Z'),'ariane-liste-partie7-20261015-100000Z.json');
});

test('l’observateur rend la table entière aux dixièmes de mm sur demande du pont (aucune requête de plus)',async()=>{
  const LISTE=ORIGIN+'/api/u3d/projects/p/rails/'+TABLE;
  const w=world({routes:(m,u)=>({status:200,text:JSON.stringify({value:[0,1,2].map(i=>({RowKey:'RK'+i,ExtractionStatus:'valid',TreatedByOperator:i===1,SeenByOperator:false,...Object.fromEntries(EDGES.map((k,j)=>[k,ligneMonde(i)[j]]))}))})})});
  const x=new w.win.XMLHttpRequest();x.open('GET',LISTE);x.send();await tick();await tick();w.runTimers();
  const avant=w.requests?.length;w.posts.length=0;w.deliver({kind:'banane5:liste',id:'q'});
  const r=w.posts.map(p=>p.m).find(m=>m?.kind==='banane5:liste-reponse');
  assert.equal(r.ok,true);assert.equal(r.tables.length,1);assert.deepEqual(r.tables[0].ed.slice(0,6),ligneMonde(0).map(LM.dm));
  assert.deepEqual([r.tables[0].st,r.tables[0].fl.map(f=>f&3)],[[0,0,0],[0,1,0]]);assert.equal(w.requests?.length,avant);
  const s=LM.compacter(LM.choisirTable(r.tables,{rows:3,listKey:TABLE})??r.tables[0],{partie:1});assert.equal(s.lignes,3);
});

test('mémoire : seules les validations 2xx d’un lot sont gardées ; réglage coupé, Écho, refus et corps incomplet : rien',async()=>{
  const st=fauxStockage();
  assert.equal(await LM.noterEcriture(st,ECRITURE(5),LOT),true);
  assert.equal(await LM.noterEcriture(st,ECRITURE(6,{status:502}),LOT),false);
  assert.equal(await LM.noterEcriture(st,ECRITURE(7,{body:{SeenByOperator:true}}),LOT),false);
  assert.equal(await LM.noterEcriture(st,ECRITURE(8),{...LOT,enLot:false}),false);
  assert.equal(await LM.noterEcriture(st,ECRITURE(9),{...LOT,partie:null}),false);
  assert.equal(await LM.noterEcriture(st,ECRITURE(10),{...LOT,reglage:{listeMemoire:{actif:false}}}),false);
  const m=st.d[LM.CLE_MEM][7];assert.deepEqual(Object.keys(m.cuts),['5']);
  assert.deepEqual(m.cuts[5].slice(0,6),ligneMonde(5).map(LM.dm));assert.equal(m.cuts[5][7],'5.0.test');assert.ok(Number.isInteger(m.cuts[5][6]));
  assert.ok(JSON.stringify(st.d[LM.CLE_MEM]).length<400,'quelques centaines d’octets pour un cut');
});

test('écarts : au-delà de 1 mm seulement, par rail, événement ecart-liste ; compteur depuis le dernier passage ; liste identique ignorée',async()=>{
  const st=fauxStockage(),evs=[],tab=t=>({ok:true,tables:[t]}),obs={rows:20,listKey:TABLE};
  for(const i of [2,4,6,8])await LM.noterEcriture(st,ECRITURE(i),LOT);
  const lancer=(t,at)=>LM.apresChargement({storage:st,demander:async()=>tab(t),obs,fiche:{partie:7,at},version:'5.0.test',emettre:async e=>{evs.push(e);}});
  /* 1er chargement : cut 2 corrigé de 5 mm à gauche, cut 4 de 0,6 mm (sous le seuil), cut 8 de 12 mm à droite. */
  let r=await lancer(table(20,{modif:{2:{j:0,mm:5},4:{j:1,mm:0.6},8:{j:3,mm:12}}}),'2026-10-15T10:00:00Z');
  assert.deepEqual([r.ok,r.comparees,r.constatees,r.nouvelles],[true,4,2,2]);
  assert.deepEqual(evs.map(e=>[e.type,e.cut,e.gaucheMm,e.droiteMm,e.statut]),[['ecart-liste',2,5,0,'valid'],['ecart-liste',8,0,12,'valid']]);
  assert.ok(!JSON.stringify(evs).includes('700'),'aucune coordonnée dans les événements');
  /* même contenu : rien de refait */
  evs.length=0;assert.equal((await lancer(table(20,{modif:{2:{j:0,mm:5},4:{j:1,mm:0.6},8:{j:3,mm:12}}}),'2026-10-15T10:05:00Z')).saute,'identique');assert.equal(evs.length,0);
  /* deuxième relecture : le cut 6 est corrigé en plus, le cut 8 est resté tel quel (2 écarts reportés, 1 nouveau) */
  r=await lancer(table(20,{modif:{2:{j:0,mm:5},6:{j:2,mm:3},8:{j:3,mm:12}},statuts:{6:1}}),'2026-10-15T11:00:00Z');
  assert.deepEqual([r.constatees,r.nouvelles],[3,1]);assert.equal(evs.find(e=>e.cut===6).statut,'invalid');assert.deepEqual(evs.map(e=>[e.cut,e.nouveau]),[[2,false],[6,true],[8,false]]);
  const res=await LM.resume(st,7);assert.deepEqual([res.memorises,res.passage.constatees,res.passage.nouvelles,res.passage.comparees],[4,3,1,4]);
  assert.match(LM.texteResume(res,{lignes:20,at:'2026-10-15T11:00:00Z'}),/corrections constatées 3 \(dont 1 depuis le dernier passage\)/);
  assert.equal(Object.keys(st.d).filter(k=>k.startsWith(LM.PRE_INST)).length,1,'un seul instantané par partie');
});

test('autre liste (empreinte différente), réglage coupé, table rompue : rien n’est comparé ni gardé',async()=>{
  const st=fauxStockage();await LM.noterEcriture(st,ECRITURE(2),LOT);
  const evs=[],base={storage:st,obs:{rows:10,listKey:TABLE},fiche:{partie:7,at:'2026-10-15T10:00:00Z'},emettre:async e=>{evs.push(e);}};
  assert.equal((await LM.apresChargement({...base,reglage:{listeMemoire:{actif:false}},demander:async()=>({ok:true,tables:[table(10)]})})).saute,'inactif-ou-sans-partie');
  assert.equal((await LM.apresChargement({...base,demander:async()=>({ok:true,tables:[{...table(10),rompue:true}]})})).saute,'sans-table');
  assert.equal((await LM.apresChargement({...base,demander:async()=>({ok:false,reason:'delai'})})).saute,'delai');
  const autre={...table(10,{modif:{2:{j:0,mm:50}}}),key:'autre-liste'};
  const r=await LM.apresChargement({...base,demander:async()=>({ok:true,tables:[autre]})});assert.equal(r.comparees,0);assert.equal(evs.length,0);
});

test('vidage manuel : mémoire, index et instantanés effacés',async()=>{
  const st=fauxStockage();await LM.noterEcriture(st,ECRITURE(2),LOT);
  await LM.apresChargement({storage:st,demander:async()=>({ok:true,tables:[table(10)]}),obs:{rows:10,listKey:TABLE},fiche:{partie:7,at:'2026-10-15T10:00:00Z'}});
  assert.ok(Object.keys(st.d).length>=3);await LM.effacer(st);assert.deepEqual(Object.keys(st.d),[]);
});

test('export du panneau : texte de CONTENU.txt et fichiers rangés dans le volume sous le nom attendu',async()=>{
  const st=fauxStockage();await LM.noterEcriture(st,ECRITURE(2),LOT);
  await LM.apresChargement({storage:st,demander:async()=>({ok:true,tables:[table(10,{modif:{2:{j:0,mm:9}}})]}),obs:{rows:10,listKey:TABLE},fiche:{partie:7,at:'2026-10-15T10:00:00Z'}});
  const api=async(a,args)=>({instantanes:await LM.instantanes(st,args.parties)});
  const e=await LM.exportPanneau(api,[7],iso=>'H:'+iso),noms=[];
  assert.equal(e.fichiers,1);assert.match(e.texte,/partie 7 · instantané du H:2026-10-15T10:00:00Z \(10 lignes\) · cuts d’Ariane mémorisés 1 · comparés 1 · corrections constatées 1/);
  globalThis.Blob=globalThis.Blob||require('node:buffer').Blob;
  await e.sauver(async(b,n)=>{noms.push(n);assert.ok(b.size>10);});assert.deepEqual(noms,['ariane-liste-partie7-20261015-100000Z.json']);
  assert.equal((await LM.exportPanneau(api,[9])).fichiers,0);
});
