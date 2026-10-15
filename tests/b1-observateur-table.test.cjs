'use strict';
/* B1 (D-095) : table des coupes tenue EN MÉMOIRE DE LA PAGE par l'observateur passif
 * (src/esv-observer.js, monde principal). Fausse page (tests/helpers/fake-page.cjs),
 * données SYNTHÉTIQUES. Garanties : la page ne voit aucune différence (mêmes appels,
 * même réseau) ; jamais une ligne dans les observations ; fenêtre bornée sur demande ;
 * indice de ligne = ordre de réception ; fraîcheur par les écritures ; mémoire bornée. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {world,tick,ORIGIN}=require('./helpers/fake-page.cjs'),O=require('../src/esv-observer.js');
const TABLE='traj__00+0012345.678',LISTE=ORIGIN+'/api/u3d/projects/p-key/rails/'+TABLE,W=[700000,6600000,150];
/* Ligne i : voie droite le long de x (1 m par cut), écartement 1,435 m, monde = scène + W. */
const ligne=(i,o={})=>({PartitionKey:'secret-partition:'+TABLE,RowKey:'RK-'+String(i).padStart(8,'0'),ExtractionStatus:i%7===3?'invalid':i%11===5?'skipped':'valid',
  TreatedByOperator:i%13===0,SeenByOperator:i%2===0,XLeftEdge:W[0]+i,YLeftEdge:W[1],ZLeftEdge:W[2],XRightEdge:W[0]+i,YRightEdge:W[1]+1.435,ZRightEdge:W[2],TrajAzimuth:90,Free:'texte libre '+i,...o});
const page=(a,b)=>JSON.stringify({value:Array.from({length:b-a},(_,k)=>ligne(a+k))});
async function get(w,url){const x=new w.win.XMLHttpRequest();x.open('GET',url);x.send();await tick();await tick();w.runTimers();}
async function put(w,i,body){const x=new w.win.XMLHttpRequest();x.open('PUT',LISTE+'/RK-'+String(i).padStart(8,'0')+'?merge=true');x.send(JSON.stringify(body));await tick();await tick();w.runTimers();}
function servir(n=2500,par=1000,{erreur=-1}={}){let k=0;return (m,u)=>{if(m==='PUT')return {status:204,text:''};
  if(!/\/rails\//.test(u))return {status:200,text:'{}'};const p=k++;if(p===erreur)return {status:503,text:''};const a=(p%Math.ceil(n/par))*par;return {status:200,text:page(a,Math.min(n,a+par))};};}
async function charger(w,n=2500,par=1000){for(let p=0;p*par<n;p++)await get(w,LISTE+(p?'?npk=k'+p+'&nrk=r'+p:''));}
function demander(w,req){w.posts.length=0;w.deliver({kind:'banane5:voisins',id:'q1',...req});return w.posts.map(p=>p.m).find(m=>m?.kind==='banane5:voisins-reponse');}
const point=i=>({left:[W[0]+i,W[1],W[2]],right:[W[0]+i,W[1]+1.435,W[2]]});

test('table tenue dans la page : une ligne par élément, dans l’ordre reçu ; la ligne la plus proche d’un point ; fenêtre de ±5',async()=>{
  const w=world({routes:servir()});await charger(w);
  assert.deepEqual(w.ctl.tables(),[{lignes:2500,pages:3,fraiches:0,debut:true,rompue:false,tronquee:false}]);
  const r=demander(w,{cut:1234,fenetre:5,world:point(1234)});
  assert.equal(r.ok,true);assert.deepEqual([r.geo.index,r.geo.mm<1e-3,Math.round(r.geo.secondMm)],[1234,true,1000],'géométrie : la ligne 1234, la suivante à 1 m');
  assert.deepEqual(r.rows.map(x=>x.i),[1229,1230,1231,1232,1233,1234,1235,1236,1237,1238,1239]);
  const x=r.rows.find(x=>x.i===1233);assert.deepEqual([x.s,x.t,x.v,x.f],['valid',false,false,false]);assert.deepEqual(x.e,[W[0]+1233,W[1],W[2],W[0]+1233,W[1]+1.435,W[2]]);
  assert.equal(r.rows.find(x=>x.i===1237).s,'skipped');assert.equal(r.rows.find(x=>x.i===1235).s,'invalid');
  /* Décalage de 30 cm (repère faux) : la ligne trouvée reste la bonne, l'écart est dit. */
  const d=demander(w,{cut:1234,fenetre:5,world:point(1234.3)});assert.deepEqual([d.geo.index,Math.round(d.geo.mm)],[1234,300]);
  const z=demander(w,{cut:2498,fenetre:5,world:point(2498)});assert.deepEqual(z.rows.map(x=>x.i),[2493,2494,2495,2496,2497,2498,2499],'fin de partie : fenêtre tronquée');
  assert.ok(JSON.stringify(r).length<3000,'réponse bornée : '+JSON.stringify(r).length);
});
test('jamais une ligne dans les observations : comptes seulement, aucune clé de ligne, aucun bord, aucune partition',async()=>{
  const w=world({routes:servir()});await charger(w);await put(w,1300,{ExtractionStatus:'valid',SeenByOperator:true,TreatedByOperator:true,RailType:'U50',XLeftEdge:W[0]+1300.01,YLeftEdge:W[1],ZLeftEdge:W[2],XRightEdge:W[0]+1300.01,YRightEdge:W[1]+1.435,ZRightEdge:W[2]});
  w.deliver({kind:'banane5:snapshot',afterDenial:true});
  /* L'écriture garde, comme avant, l'identifiant de SA coupe (`railPairId`) ; aucune autre ligne n'apparaît. */
  const texte=JSON.stringify(w.observed());for(const s of ['RK-00000005','RK-00001299','secret-partition','texte libre',String(W[0]+5),String(W[0]+1299)])assert.ok(!texte.includes(s),'jamais '+s);
  assert.deepEqual(w.observed().filter(e=>e.kind==='list-page').map(e=>e.rows),[1000,1000,500]);
});
test('écriture réussie : la ligne est mise à jour (fraîcheur) et son indice noté ; échec ou « vu » seul : statut inchangé',async()=>{
  let statut=204;const base=servir(),w=world({routes:(m,u)=>m==='PUT'?{status:statut,text:''}:base(m,u)});await charger(w);
  const corps={ExtractionStatus:'valid',SeenByOperator:true,TreatedByOperator:true,RailType:'U50',RailOrientationLeft:2.86,RailOrientationRight:-2.86,
    XLeftEdge:W[0]+3.02,YLeftEdge:W[1]+0.05,ZLeftEdge:W[2],XRightEdge:W[0]+3.02,YRightEdge:W[1]+1.485,ZRightEdge:W[2]};
  await put(w,3,corps);
  let e=w.observed().filter(x=>x.kind==='write').at(-1);assert.deepEqual([e.status,e.rowIndex],[204,3],'indice de la ligne écrite, un nombre');
  let r=demander(w,{cut:3,fenetre:1,world:point(3)}),x=r.rows.find(x=>x.i===3);
  assert.deepEqual([x.s,x.t,x.v,x.f,x.e[1]],['valid',true,true,true,W[1]+0.05]);assert.equal(r.table.fraiches,1);
  statut=503;await put(w,10,{...corps,XLeftEdge:W[0]+99});e=w.observed().filter(x=>x.kind==='write').at(-1);assert.equal(e.rowIndex,null,'échec : rien appliqué');
  statut=204;await put(w,24,{SeenByOperator:true});r=demander(w,{cut:24,fenetre:1,world:point(24)});
  assert.deepEqual([r.rows.find(x=>x.i===24).s,r.rows.find(x=>x.i===24).v,r.rows.find(x=>x.i===24).f],['invalid',true,false],'« vu » seul : statut et bords inchangés');
  await put(w,999999,corps);assert.equal(w.observed().filter(x=>x.kind==='write').at(-1).rowIndex,null,'clé inconnue : rien');
});
test('relecture de la liste : nouvelle table ; suite sans début : jamais d’indice ; page en erreur : table rompue',async()=>{
  const w=world({routes:servir()});await charger(w);await charger(w);
  assert.deepEqual(w.ctl.tables().map(t=>[t.lignes,t.pages,t.debut]),[[2500,3,true]],'une première page ouvre une table neuve');
  const s=world({routes:servir()});await get(s,LISTE+'?npk=k1&nrk=r1');assert.deepEqual(s.ctl.tables().map(t=>[t.lignes,t.debut]),[[1000,false]]);
  const e=world({routes:servir(2500,1000,{erreur:1})});await charger(e);assert.deepEqual(e.ctl.tables().map(t=>[t.lignes,t.rompue]),[[1500,true]],'la page 2 manque : la suite n’est plus à son indice');
  const q=world({routes:servir()});await get(q,ORIGIN+'/api/u3d/projects/undefined/rails?&status=invalid&top=1');assert.deepEqual(q.ctl.tables(),[],'la question « invalides » n’est pas une table');
});
test('demandes refusées : invalide, sans table, observateur ou table coupés ; « table:false » oublie la table',async()=>{
  const w=world({routes:servir()});
  assert.equal(demander(w,{cut:3,fenetre:5,world:point(3)}).reason,'sans-table');await charger(w);
  for(const bad of [{cut:-1,fenetre:5,world:point(1)},{cut:1.5,fenetre:5,world:point(1)},{cut:3,fenetre:11,world:point(1)},{cut:3,fenetre:5,world:{left:[1,2],right:[1,2,3]}},{cut:3,fenetre:5}])
    assert.equal(demander(w,bad).reason,'demande-invalide');
  w.posts.length=0;w.deliver({kind:'banane5:voisins',id:'x'.repeat(81),cut:3,fenetre:5,world:point(3)});assert.equal(w.posts.length,0,'identifiant trop long : aucune réponse');
  w.deliver({kind:'banane5:voisins',id:'q',cut:3,fenetre:5,world:point(3)},{origin:'https://autre.test'});assert.equal(w.posts.length,0,'autre origine : ignoré');
  w.deliver({kind:'banane5:config',enabled:false});assert.equal(demander(w,{cut:3,fenetre:5,world:point(3)}).reason,'coupe');
  w.deliver({kind:'banane5:config',enabled:true});assert.equal(demander(w,{cut:3,fenetre:5,world:point(3)}).ok,true);
  w.deliver({kind:'banane5:config',table:false});assert.equal(w.ctl.stats().enabled,true,'« table:false » ne coupe pas l’observateur');
  assert.deepEqual(w.ctl.tables(),[]);assert.equal(demander(w,{cut:3,fenetre:5,world:point(3)}).reason,'coupe');
  await charger(w);assert.deepEqual(w.ctl.tables(),[],'plus tenue ensuite');
});
test('la page ne voit rien : mêmes appels, même réseau, avec et sans observateur, demandes de voisins comprises',async()=>{
  async function scenario(observe){const w=world({observe,routes:servir()});await charger(w);await put(w,7,{ExtractionStatus:'valid',XLeftEdge:1,YLeftEdge:2,ZLeftEdge:3,XRightEdge:4,YRightEdge:5,ZRightEdge:6});
    if(observe)demander(w,{cut:7,fenetre:5,world:point(7)});return w;}
  const a=await scenario(false),b=await scenario(true);
  assert.deepEqual(b.log,a.log);assert.deepEqual(b.network,a.network,'aucune requête de plus');
});
test('mémoire bornée : au plus 40 000 lignes par table (tronquée, dite), 4 tables',async()=>{
  assert.equal(O.LIMITS.tableRows,40000);assert.equal(O.LIMITS.tables,4);
  const big=JSON.stringify({value:Array.from({length:8000},(_,i)=>({RowKey:'r'+i,ExtractionStatus:'valid'}))});
  const w=world({routes:()=>({status:200,text:big})});for(let p=0;p<6;p++)await get(w,LISTE+(p?'?npk=k'+p:''));
  assert.deepEqual(w.ctl.tables().map(t=>[t.lignes,t.tronquee]),[[40000,true]]);
  const v=world({routes:()=>({status:200,text:page(0,3)})});for(let k=0;k<6;k++)await get(v,ORIGIN+'/api/rails/table'+k);
  assert.equal(v.ctl.tables().length,4,'la plus ancienne table oubliée');
  assert.equal(O.tableKey(LISTE+'?npk=a'),TABLE);assert.equal(O.tableKey(ORIGIN+'/api/u3d/projects/p/rails'),null);assert.equal(O.firstPage(LISTE+'?npk=a&nrk=b'),false);assert.equal(O.firstPage(LISTE),true);
});
