'use strict';
/* CH-077 (D-305, piste 3) — PRÉCHAUFFAGE DU CACHE DU NAVIGATEUR POUR LA COUPE SUIVANTE, module de page `src/prechauffage.js`.
 * Essais purs (Node, sans navigateur) avec un arbre EPT synthétique comme celui de Potree 1.8 et un `fetch` simulé. Ils prouvent :
 *  - identité de coupe et d'opération : une opération remplacée ou annulée ne compte plus rien et ne lance plus rien ;
 *  - annulation au premier chargement de Potree qui repart, et au changement de coupe ;
 *  - plafonds de nœuds et d'octets ;
 *  - aucune adresse, aucune clé de nœud dans un seul des événements émis ;
 *  - choix des nœuds : connus, ni chargés ni en cours, dans la zone des rails prédits, niveau borné, du moins profond au plus profond ;
 *  - classement des en-têtes de cache (seuls Cache-Control, Expires, Last-Modified, Pragma, ETag sont lus) ;
 *  - arrêt automatique quand la coupe suivante n'a aucun nœud servi par le cache. Adresses relatives fictives. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/prechauffage.js');

/* Arbre EPT synthétique : cube de 64 m, nœud D-X-Y-Z, boîte en repère du nuage (matrice identité), enfants connus jusqu'à `connu`. */
function arbre({profondeur=6,connu=6,charges=()=>false,taille=64,points=1000}={}){
 const faire=(d,x,y,z)=>{const s=taille/2**d,nom=`${d}-${x}-${y}-${z}`,n={key:{d,x,y,z},level:d,numPoints:d===connu&&connu<profondeur?-1:points,
   boundingBox:{min:{x:x*s,y:y*s,z:z*s},max:{x:(x+1)*s,y:(y+1)*s,z:(z+1)*s}},children:{},loaded:charges(nom,d,{min:{x:x*s,y:y*s,z:z*s},max:{x:(x+1)*s,y:(y+1)*s,z:(z+1)*s}}),loading:false,
   filename:()=>nom,url:()=>'/nuage/ept-data/'+nom};
  if(d<Math.min(profondeur,connu)){let i=0;for(const a of [0,1])for(const b of [0,1])for(const c of [0,1])n.children[i++]=faire(d+1,2*x+a,2*y+b,2*z+c);}
  return n;};
 return {pcoGeometry:{root:faire(0,0,0,0),loader:{extension:()=>'.bin'}},matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}};}

/* Nœuds chargés par Potree pour le cut courant (x = cx, toutes profondeurs) et niveaux 0-1 partout. */
const pres=(cx=20)=>(nom,d,b)=>d<=1||(b.min.x<=cx+.5&&b.max.x>=cx-.5&&b.min.y<=11.935&&b.max.y>=9.5&&b.min.z<=10.5&&b.max.z>=9.5);
/* Réponse « voisins » de l'observateur (table B1) : cut N en x = N mètres, rails à y = 10 et 11,435, z = 10. */
const ligne=(i,s='invalid')=>({i,s,t:false,v:false,f:false,e:[i,10,10,i,11.435,10]});
const reponse=(cut,statuts={})=>({ok:true,table:{lignes:200,tables:1},geo:{index:cut,mm:0,secondMm:null},rows:Array.from({length:21},(_,k)=>cut-10+k).filter(i=>i>=0).map(i=>ligne(i,statuts[i]||'invalid'))});

/* Environnement simulé : horloge, images, compteur de Potree, étiquette, fetch avec réponses à la demande, journal d'événements. */
function environnement({reglage={},compteur=0,etiquette={part:23,cut:20},rep=null,entetes={'cache-control':'public, max-age=3600'},octets=100000,auto=true}={}){
 const e={evts:[],demandes:[],compteur,etiquette,images:0,ressourcesEnAttente:[]};
 let fileImages=[];
 e.env={reglage:{actif:true,...reglage},chargements:()=>e.compteur,etiquette:()=>e.etiquette,poster:x=>e.evts.push(JSON.parse(JSON.stringify(x))),
  image:()=>new Promise(r=>fileImages.push(r)),maintenant:()=>e.images*16,
  voisins:async(cut)=>rep||reponse(cut),
  AbortController,
  fetch:(url,init)=>new Promise((res,rej)=>{const d={url,init,res:()=>res({ok:true,status:200,headers:{get:k=>entetes[k.toLowerCase()]??null},arrayBuffer:async()=>new ArrayBuffer(octets)}),rej};
   e.demandes.push(d);init.signal.addEventListener('abort',()=>rej(Object.assign(Error('abandon'),{name:'AbortError'})));if(auto)queueMicrotask(d.res);}),
  relever:()=>e.ressourcesEnAttente.splice(0)};
 /* Une image : avance l'horloge et réveille les attentes d'image. */
 e.image=async(n=1)=>{for(let i=0;i<n;i++){e.images++;const f=fileImages;fileImages=[];for(const r of f)r();await new Promise(r=>setImmediate(r));}};
 e.tourner=async(n=30)=>{for(let i=0;i<n;i++)await e.image();};
 return e;}
const contexte=(pc,cut=20)=>({partie:23,coupe:cut,rails:{left:[0,0,0],right:[0,1.435,0]},origine:[cut,10,10],pointclouds:[pc]});
const ADRESSE=/\/|https?:|ept-data|\.bin|\d+-\d+-\d+-\d+/;
function sansAdresse(evts){for(const x of evts)for(const [k,v] of Object.entries(x))assert.ok(!(typeof v==='string'&&ADRESSE.test(v)),`événement ${x.kind}, champ ${k} : « ${v} » ressemble à une adresse ou une clé de nœud`);
 assert.ok(!ADRESSE.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse ni clé dans le texte des événements');}

test('réglage : éteint par défaut, seul `actif:true` allume, valeurs bornées',()=>{
 assert.equal(P.DEFAUT.actif,false);assert.equal(P.reglage(undefined),null);assert.equal(P.reglage({actif:'oui'}),null);assert.equal(P.reglage({...P.DEFAUT}),null);
 const r=P.reglage({actif:true,noeudsMax:1e9,octetsMax:-3,enVolMax:9});assert.equal(r.noeudsMax,P.DEFAUT.noeudsMax,'valeur hors bornes : défaut');assert.equal(r.octetsMax,P.DEFAUT.octetsMax);assert.equal(r.enVolMax,P.DEFAUT.enVolMax);
 assert.deepEqual([P.DEFAUT.noeudsMax,P.DEFAUT.octetsMax,P.DEFAUT.enVolMax],[24,8*1048576,2]);
});

test('coupe suivante : prochaine ligne non validée de la table, repère pris sur la coupe courante, rigidité vérifiée',()=>{
 const c=P.centresSuivante(reponse(20,{21:'valid'}),20,{left:[0,0,0],right:[0,1.435,0]},[20,10,10]);
 assert.equal(c.predite,22,'la ligne 21 est validée : ESV charge la prochaine non validée');
 assert.deepEqual(c.left.map(v=>Math.round(v*1e6)/1e6),[22,10,10]);assert.deepEqual(c.right.map(v=>Math.round(v*1e6)/1e6),[22,11.435,10]);
 assert.equal(P.centresSuivante(reponse(20),20,{left:[0,0,0],right:[0,1.5,0]},[20,10,10]).motif,'repere','écart des rails différent de la table : repère non rigide');
 assert.equal(P.centresSuivante({ok:false,reason:'sans-table'},20,{left:[0,0,0],right:[0,1.435,0]},[20,10,10]).motif,'sans-table');
 const fin=reponse(20,Object.fromEntries(Array.from({length:10},(_,k)=>[21+k,'valid'])));assert.equal(P.centresSuivante(fin,20,{left:[0,0,0],right:[0,1.435,0]},[20,10,10]).motif,'sans-suivante');
});

test('choix des nœuds : connus, non chargés, dans la zone, niveau borné, du moins profond au plus profond ; frontière comptée',()=>{
 const pc=arbre({profondeur:6,connu:4,charges:(n,d)=>d<=1});
 const s=P.candidats([pc],{left:[22,10,10],right:[22,11.435,10]},{niveauMax:6,rayonM:1.5});
 assert.ok(s.candidats.length>0);
 const niv=s.candidats.map(c=>c.niveau);assert.deepEqual(niv,[...niv].sort((a,b)=>a-b),'ordre de Potree : étage par étage');
 assert.ok(niv.every(v=>v>=2&&v<=4),'niveaux 0-1 déjà chargés ; rien au-delà de la hiérarchie connue (4)');
 assert.ok(s.charges>=2,'nœuds chargés comptés, jamais demandés');assert.ok(s.frontiere>0,'sous-arbres dont la hiérarchie n’est pas lue : comptés');
 assert.equal(s.intersectants,s.charges+s.enCours+s.candidats.length);
 const b=P.candidats([pc],{left:[22,10,10],right:[22,11.435,10]},{niveauMax:3,rayonM:1.5});assert.ok(b.candidats.every(c=>c.niveau<=3),'profondeur bornée');
 for(const c of s.candidats){const m=c.noeud.boundingBox;assert.ok(m.min.x<=23.5&&m.max.x>=20.5,'boîte dans la zone de la coupe suivante');}
});

test('niveau local : le plus profond chargé autour de la coupe courante',()=>{
 const pc=arbre({profondeur:6,connu:6,charges:(n,d)=>d<=3});assert.equal(P.niveauLocal([pc],{left:[20,10,10],right:[20,11.435,10]},1.5),3);
});

test('en-têtes : seuls Cache-Control, Expires, Last-Modified, Pragma et ETag sont lus, classés sans valeur',()=>{
 const lus=[],g=h=>k=>{lus.push(k.toLowerCase());return h[k.toLowerCase()]??null;};
 assert.deepEqual(P.classerEntetes(g({'cache-control':'public, max-age=3600'})),{classe:'max-age',maxAgeS:3600,etag:false,lastModified:false,expires:false,pragma:false});
 assert.equal(P.classerEntetes(g({'cache-control':'no-store'})).classe,'no-store');
 assert.equal(P.classerEntetes(g({'cache-control':'no-cache',etag:'"x"'})).classe,'revalidation');
 assert.equal(P.classerEntetes(g({'cache-control':'no-cache'})).classe,'no-cache');
 assert.equal(P.classerEntetes(g({pragma:'no-cache'})).classe,'no-cache');
 assert.equal(P.classerEntetes(g({'last-modified':'Mon, 02 Nov 2026 10:00:00 GMT'})).classe,'heuristique');
 assert.equal(P.classerEntetes(g({expires:'Mon, 02 Nov 2026 10:00:00 GMT'})).classe,'expires');
 assert.equal(P.classerEntetes(g({})).classe,'aucun');
 assert.deepEqual([...new Set(lus)].sort(),['cache-control','etag','expires','last-modified','pragma']);
});

test('préchauffage : demandes à la même adresse que Potree (extension du chargeur), mode cache par défaut, priorité basse, deux en vol, événement sans adresse',async()=>{
 const pc=arbre({profondeur:6,connu:6,charges:pres(20)}),e=environnement({auto:false,reglage:{rayonM:.3}}),p=P.creer(e.env);
 const fin=p.apresCapture(contexte(pc));await e.image(2);
 assert.equal(e.demandes.length,2,'deux demandes en vol au plus');
 for(const d of e.demandes){assert.match(d.url,/^\/nuage\/ept-data\/\d+-\d+-\d+-\d+\.bin$/);assert.equal(d.init.cache,'default');assert.equal(d.init.credentials,'same-origin');assert.equal(d.init.priority,'low');assert.equal(d.init.method,'GET');}
 for(let i=0;i<200&&p.etat().enCours;i++){for(const d of e.demandes.splice(0))d.res();await e.image();}
 const r=await fin;assert.equal(r.motif,'fini');assert.ok(r.noeuds>2&&r.noeuds<=24);
 const ev=e.evts.filter(x=>x.kind==='prechauffage');assert.equal(ev.length,1);assert.equal(ev[0].coupe,20);assert.equal(ev[0].predite,21);assert.equal(ev[0].annule,false);
 assert.equal(e.evts.filter(x=>x.kind==='prechauffage-entetes').length,1,'en-têtes classés une fois');
 sansAdresse(e.evts);
});

test('annulation : au premier chargement de Potree qui repart, et au changement de coupe ; rien ne repart ensuite',async()=>{
 const pc=arbre({charges:pres(20)});
 let e=environnement({auto:false}),p=P.creer(e.env),fin=p.apresCapture(contexte(pc));await e.image(2);
 const enVol=e.demandes.length;assert.ok(enVol>0);e.compteur=1;await e.image(2);
 let r=await fin;assert.equal(r.annule,true);assert.equal(r.motif,'chargement');
 for(const d of e.demandes)d.res();await e.tourner(5);assert.equal(e.demandes.length,enVol,'aucune demande après l’annulation');
 e=environnement({auto:false});p=P.creer(e.env);fin=p.apresCapture(contexte(pc));await e.image(2);e.etiquette={part:23,cut:21};await e.image(2);
 r=await fin;assert.equal(r.motif,'coupe');assert.equal(r.annule,true);
 e=environnement({auto:false});p=P.creer(e.env);fin=p.apresCapture(contexte(pc));await e.image(2);p.annuler('capture');r=await fin;assert.equal(r.motif,'capture');
});

test('réseau occupé au départ : rien n’est demandé',async()=>{
 const e=environnement({compteur:2}),p=P.creer(e.env),r=await p.apresCapture(contexte(arbre()));
 assert.equal(r.motif,'reseau-occupe');assert.equal(e.demandes.length,0);
});

test('identité : une opération remplacée ne compte plus rien et ne lance plus rien',async()=>{
 const pc=arbre({charges:pres(20)}),e=environnement({auto:false}),p=P.creer(e.env);
 const f1=p.apresCapture(contexte(pc,20));await e.image(2);const vieilles=e.demandes.splice(0);
 const f2=p.apresCapture(contexte(pc,21));await e.image(2);
 const r1=await f1;assert.equal(r1.annule,true);assert.equal(r1.motif,'remplace');
 for(const d of vieilles)d.res();await e.image(3);
 assert.equal(p.etat().op,2);assert.equal(p.etat().octets,0,'la fin d’une demande de l’opération 1 ne compte pas pour l’opération 2');
 p.annuler('capture');await f2;
});

test('plafonds : nœuds puis octets',async()=>{
 const pc=arbre({profondeur:6,connu:6,charges:pres(20)});
 let e=environnement({reglage:{noeudsMax:3}}),p=P.creer(e.env),r=p.apresCapture(contexte(pc));await e.tourner(20);r=await r;
 assert.equal(r.noeuds,3);assert.equal(e.demandes.length,3);assert.equal(r.motif,'plafond-noeuds');
 e=environnement({reglage:{octetsMax:250000},octets:100000});p=P.creer(e.env);r=p.apresCapture(contexte(pc));await e.tourner(20);r=await r;
 assert.ok(r.octets<=250000+2*100000,'pas plus que le plafond et les demandes déjà en vol');assert.equal(r.motif,'plafond-octets');
});

test('bilan à la capture suivante et arrêt automatique « cache-inutile » après 5 coupes sans aucun nœud servi par le cache',async()=>{
 const pc=arbre({charges:pres(20)}),e=environnement(),p=P.creer({...e.env,reglage:{actif:true,coupesSansCache:5}});
 for(let k=0;k<5;k++){e.etiquette={part:23,cut:20+k};
  /* Ressources de Potree à la coupe précédente préchauffée : les mêmes nœuds, téléchargés (transferSize > 0) : le cache n'a rien servi. */
  if(k>0)e.ressourcesEnAttente.push(...p._clesPourEssai().map(c=>({name:'/nuage/ept-data/'+c+'.bin',initiatorType:'xmlhttprequest',transferSize:5000,decodedBodySize:4000})));
  const r=p.apresCapture(contexte(pc,20+k));await e.tourner(20);await r;}
 e.etiquette={part:23,cut:25};e.ressourcesEnAttente.push(...p._clesPourEssai().map(c=>({name:'/nuage/ept-data/'+c+'.bin',initiatorType:'xmlhttprequest',transferSize:5000,decodedBodySize:4000})));
 const r=await p.apresCapture(contexte(pc,25));
 const bilans=e.evts.filter(x=>x.kind==='prechauffage-bilan');assert.equal(bilans.length,5);assert.ok(bilans.every(b=>b.juste===true&&b.couverts>0&&b.servisCache===0));
 assert.equal(r.motif,'cache-inutile');assert.equal(p.actif(),false,'éteint pour la page');
 const avant=e.demandes.length;await p.apresCapture(contexte(pc,26));assert.equal(e.demandes.length,avant,'plus rien n’est demandé');
 sansAdresse(e.evts);
});

test('bilan : nœuds servis par le cache comptés ; une ressource de préchauffage (fetch) n’est jamais prise pour une de Potree',async()=>{
 const pc=arbre({charges:pres(20)}),e=environnement(),p=P.creer(e.env);
 let r=p.apresCapture(contexte(pc,20));await e.tourner(20);await r;const cles=p._clesPourEssai();assert.ok(cles.length>1);
 e.ressourcesEnAttente.push(...cles.map(c=>({name:'/nuage/ept-data/'+c+'.bin',initiatorType:'fetch',transferSize:5000,decodedBodySize:4000})),
  ...cles.map(c=>({name:'/nuage/ept-data/'+c+'.bin',initiatorType:'xmlhttprequest',transferSize:0,decodedBodySize:4000})),
  {name:'/nuage/ept-data/9-9-9-9.bin',initiatorType:'xmlhttprequest',transferSize:7000,decodedBodySize:4000});
 e.etiquette={part:23,cut:21};r=p.apresCapture(contexte(pc,21));await e.tourner(20);await r;
 const b=e.evts.find(x=>x.kind==='prechauffage-bilan');
 assert.deepEqual([b.coupe,b.predite,b.juste,b.potree,b.couverts,b.servisCache,b.cacheTotal],[21,21,true,cles.length+1,cles.length,cles.length,cles.length]);
 sansAdresse(e.evts);
});
