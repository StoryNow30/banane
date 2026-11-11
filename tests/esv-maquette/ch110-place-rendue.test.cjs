'use strict';
/* CH-110 (D-342, D-343) — RENDRE À POTREE LES PLACES DE CHARGEMENT PERDUES SUR UNE ERREUR D'ESV. Vrai Chromium, maquette en forme relevée d'ESV et modèle
 * mémoire de Potree 1.8.2 (tests/esv-maquette/esv-maquette.js : un nœud en échec garde `loading` et +1 au compteur, comme le vrai, CH-062), séance de
 * tests/esv-maquette/ch095-outils.cjs. Le patch de la page (chantiers/CH-110/adapter-page.patch) est appliqué à une copie temporaire de
 * src/adapter-page.js (déjà appliqué au tronc : lu tel quel) ; patch absent ou qui ne s'applique plus : ÉCHEC (essai rouge), jamais un saut. Sans l'outil `patch`, l'essai se saute.
 *  1. fidélité de la maquette, tronc tel quel : 4 échecs → compteur à 4 (= maxNodesLoading), plus AUCUNE requête de nœud ensuite ;
 *  2. patch, réparation allumée : après 4 échecs, chaque nœud est redemandé par Potree, chargé, le compteur redescend à 0, les coupes suivantes
 *     s'affichent sans nœud bloqué, un événement `potree-place-rendue` par remise ; captures au signal ;
 *  3. patch, 8 échecs (deux par nœud) : deux remises par nœud (essai 1 puis 2), tout finit chargé ;
 *  4. patch, réparation éteinte : comme le tronc (bloqué, aucun événement de remise).
 * Ce que la maquette NE prouve PAS : le vrai Potree d'ESV (le modèle est celui de CH-062/CH-083, lu dans le code de Potree, pas mesuré ici) ; les points
 * de la capture de la maquette viennent du scénario, pas de l'arbre EPT : « la coupe s'affiche » est lu au journal `ept-affiche` de la maquette. */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const N=require('./navigateur.cjs');
const racine=path.resolve(__dirname,'../..'),PATCH=path.join(racine,'chantiers/CH-110/adapter-page.patch');
function adaptateurPatche(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch110-'));fs.mkdirSync(path.join(dir,'src'));
 fs.copyFileSync(path.join(racine,'src/adapter-page.js'),path.join(dir,'src/adapter-page.js'));
 const src=fs.readFileSync(path.join(racine,'src/adapter-page.js'),'utf8');if(src.includes('function planifierRemise('))return {contenu:src};   /* déjà appliqué au tronc : lu tel quel */
 if(!fs.existsSync(PATCH))return {erreur:'patch absent : '+path.relative(racine,PATCH)};
 const r=spawnSync('patch',['-s','-p1','-d',dir,'-i',PATCH],{encoding:'utf8'});if(r.error?.code==='ENOENT')return {saut:'outil patch absent'};
 if(r.status!==0)return {erreur:'le patch ne s’applique pas : '+(r.stderr||r.stdout)};return {contenu:fs.readFileSync(path.join(dir,'src/adapter-page.js'),'utf8')};}
const raison=N.indisponible(),AP=raison?null:adaptateurPatche(),opts=raison||AP?.saut?{skip:raison||AP.saut}:{};
const O=raison?null:require('./ch095-outils.cjs'),O77=raison?null:require('./ch077-outils.cjs');
const ouverts=[];after(async()=>{for(const s of ouverts)await s.fermer().catch(()=>{});});
const REGLAGE={actif:true,essaisParNoeud:2,attenteMs:1000};
const rendues=evts=>evts.filter(e=>e.kind==='potree-place-rendue');
/* D-343, intégrateur : ni clé ni adresse dans les événements (même garde que ch095-noeud-bloque). */
const sansAdresse=evts=>assert.ok(!/\/|ept-data|\.laz|\d+-\d+-\d+-\d+/.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse ni clé dans les événements');
const prof=c=>Number(c.split('-')[0]);
const requetes=srv=>Object.values(srv.journal.ept||{}).reduce((a,b)=>a+b,0);
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
/* Séance : préchauffage coupé (seul Potree charge : l'échec tombe sur ses load()), une transition saine, puis la panne `fois` et des transitions
 * jusqu'à ce que le serveur ait refusé `fois` requêtes (8 transitions au plus). */
/* `reparation` absent : réparation COUPÉE (fidélité : la panne telle quelle, même une fois le patch au tronc et le réglage livré allumé). */
async function seance({fois,adaptateur=null,reparation={...REGLAGE,actif:false}}){
 const s=await O.ouvrir({prechauffer:false,adaptateur,reparation});ouverts.push(s);const srv=s.env.serveur,evts=[];
 const t1=await s.transition();evts.push(...t1.evts);assert.deepEqual(t1.regles,['signal','signal'],'capture saine : règle du signal');
 await O77.attendre(async()=>await s.compteur()===0);
 s.pannes({eptEchec:{http:502,fois}});const ts=[];
 /* Sans réparation, une capture peut échouer une fois Potree bloqué (« niveau de détail non stabilisé ») : relevé, la séance s'arrête là. */
 let erreur=null;for(let i=0;i<8&&(srv.journal.echecsEpt||[]).length<fois;i++){try{const t=await s.transition({mortMs:600});ts.push(t);evts.push(...t.evts);}catch(e){erreur=String(e.message);break;}}
 await O77.attendre(async()=>(srv.journal.echecsEpt||[]).length>=fois,10000).catch(()=>{});
 assert.equal((srv.journal.echecsEpt||[]).length,fois,`${fois} requêtes refusées par le serveur`);
 return {s,srv,evts,ts,erreur,cles:[...new Set(srv.journal.echecsEpt)]};}
/* Coupe suivante affichée en entier (journal `ept-affiche` sans nœud bloqué). */
const affichee=async(s,cut)=>(await s.journal('ept-affiche')).some(a=>a.cut===cut&&!a.bloques);

test('fidélité de la maquette (tronc tel quel) : 4 échecs → compteur à 4, Potree ne charge plus rien',opts,async()=>{
 const {s,srv,cles}=await seance({fois:4});
 await O77.attendre(async()=>await s.compteur()===4,15000);
 /* Une capture peut échouer ici (« niveau de détail non stabilisé ») : c'est le symptôme ; on le relève sans arrêter l'essai. */
 const avant=requetes(srv),ts=[],erreurs=[];for(let i=0;i<2;i++){try{ts.push(await s.transition({mortMs:600}));}catch(e){erreurs.push(String(e.message).slice(0,80));}}await dormir(1500);
 assert.equal(await s.compteur(),4,'compteur bloqué à maxNodesLoading');
 assert.equal(requetes(srv),avant,'plus aucune requête de nœud après le 4e échec');
 for(const c of cles)assert.equal(srv.journal.ept[c],1,'aucun nœud en échec redemandé');
 const aff=await Promise.all(ts.map(t=>affichee(s,t.suivant)));
 console.log(`# tronc : ${cles.length} nœuds en échec, compteur 4, ${avant} requêtes figées ; coupes suivantes affichées : ${aff.join('/')||'—'} ; captures en échec : ${erreurs.length} (${erreurs[0]??''})`);
});

test('patch, réparation allumée : 4 échecs → places rendues, nœuds redemandés et chargés, compteur à 0',opts,async()=>{
 assert.ok(AP?.contenu,AP?.erreur);
 const {s,srv,evts,cles}=await seance({fois:4,adaptateur:AP.contenu,reparation:REGLAGE});
 await O77.attendre(async()=>cles.every(c=>srv.journal.ept[c]>=2),15000);
 await O77.attendre(async()=>await s.compteur()===0,15000);
 const t=await s.transition({mortMs:600});evts.push(...t.evts);evts.push(...await s.evenements());
 assert.deepEqual(t.regles,['signal','signal'],'capture au signal après la réparation');
 await O77.attendre(()=>affichee(s,t.suivant),15000);
 const r=rendues(evts).filter(e=>e.motif==='rendue');
 assert.equal(r.length,4,'une remise par échec');
 for(const e of r){assert.equal(e.statut,502);assert.equal(e.essai,1);assert.equal(e.apres,e.avant-1,'1 rendu au compteur');assert.ok(e.avant>=1);}
 assert.deepEqual(r.map(e=>e.profondeur).sort(),cles.map(prof).sort(),'la profondeur des nœuds en échec');sansAdresse(r);
 assert.equal(rendues(evts).filter(e=>e.motif!=='rendue').length,0,'aucun refus');
 assert.equal(evts.filter(e=>e.kind==='ligne-base-repli').length,0,'la ligne de base ne tombe jamais « sous » après une remise');
 console.log(`# réparation : ${r.length} remises, compteurs ${r.map(e=>e.avant+'→'+e.apres).join(', ')} ; nœuds redemandés ${cles.map(c=>srv.journal.ept[c]).join('/')}`);
});

test('patch, 8 échecs (deux par nœud) : deux remises par nœud, puis tout est chargé ; jamais une troisième',opts,async()=>{
 assert.ok(AP?.contenu,AP?.erreur);
 const {s,srv,evts,cles}=await seance({fois:8,adaptateur:AP.contenu,reparation:REGLAGE});
 await O77.attendre(async()=>cles.every(c=>srv.journal.ept[c]>=2)&&await s.compteur()===0,20000);await dormir(1500);
 evts.push(...await s.evenements());const r=rendues(evts);
 assert.equal(r.filter(e=>e.motif==='rendue').length,(srv.journal.echecsEpt||[]).length,'une remise par échec (plafond 2 par nœud non atteint au-delà)');
 const e1=r.filter(e=>e.essai===1).length,e2=r.filter(e=>e.essai===2).length;assert.equal(e1,cles.length,'un essai 1 par nœud');assert.ok(e2<=cles.length,'un essai 2 par nœud au plus');
 assert.equal(r.filter(e=>e.essai>2||e.motif!=='rendue').length,0,'jamais une troisième remise');sansAdresse(r);
 assert.equal(await s.compteur(),0);
 console.log(`# 8 échecs sur ${cles.length} nœuds : ${r.length} événements, essais ${r.map(e=>e.essai).join('')} ; requêtes par nœud ${cles.map(c=>srv.journal.ept[c]).join('/')}`);
});

test('patch, réparation éteinte : identique au tronc (bloqué, aucune remise)',opts,async()=>{
 assert.ok(AP?.contenu,AP?.erreur);
 const {s,srv,evts,cles}=await seance({fois:4,adaptateur:AP.contenu,reparation:{...REGLAGE,actif:false}});
 await O77.attendre(async()=>await s.compteur()===4,15000);const avant=requetes(srv);
 let erreurs=0;for(let i=0;i<2;i++){try{evts.push(...(await s.transition({mortMs:600})).evts);}catch{erreurs++;}}await dormir(1500);evts.push(...await s.evenements());   /* captures en échec : le symptôme, comme le tronc */
 assert.equal(await s.compteur(),4);assert.equal(requetes(srv),avant);for(const c of cles)assert.equal(srv.journal.ept[c],1);
 assert.equal(rendues(evts).length,0,'aucun événement de remise');
});

/* Interaction avec le préchauffage (CH-083, CH-095) : un de NOS load() reçoit le 502 (Potree au repos, préchauffage allumé, réglage livré). Réparation allumée :
 * la place est rendue, le nœud est rechargé, le compteur redescend à 0, la ligne de base ne tombe jamais « sous », et après la pause du préchauffage
 * (10 s) il repart et charge, sans « réseau occupé ». */
test('patch, préchauffage allumé : un de nos load() en échec → place rendue, compteur à 0, le préchauffage repart après sa pause',opts,async()=>{
 assert.ok(AP?.contenu,AP?.erreur);
 const s=await O.ouvrir({adaptateur:AP.contenu,reparation:REGLAGE});ouverts.push(s);const srv=s.env.serveur,evts=[];
 const t1=await s.transition();evts.push(...t1.evts);assert.ok(t1.evts.some(e=>e.kind==='prechauffage'&&e.memLances>0),'préchauffage sain : des load() à nous');
 await O77.attendre(async()=>await s.compteur()===0);
 s.pannes({eptEchec:{http:502,fois:1}});const tEchec=Date.now();
 const t2=await s.transition();evts.push(...t2.evts);
 assert.equal((srv.journal.echecsEpt||[]).length,1);const cle=srv.journal.echecsEpt[0];
 await O77.attendre(async()=>srv.journal.ept[cle]>=2,15000);
 for(let i=0;i<2;i++){const t=await s.transition({mortMs:600});evts.push(...t.evts);assert.deepEqual(t.regles,['signal','signal'],'capture au signal');}
 await O77.attendre(async()=>await s.compteur()===0,15000);
 const reste=O.LIVRE.pauseMs+500-(Date.now()-tEchec);if(reste>0)await dormir(reste);
 const ops=[];for(let i=0;i<3;i++){const t=await s.transition();evts.push(...t.evts);ops.push(...t.evts.filter(e=>e.kind==='prechauffage'));}
 evts.push(...await s.evenements());
 const r=rendues(evts);assert.equal(r.length,1,'une remise');assert.equal(r[0].motif,'rendue');assert.equal(r[0].profondeur,prof(cle));sansAdresse(r);
 assert.equal(evts.filter(e=>e.kind==='ligne-base-repli').length,0,'ligne de base jamais « sous »');
 assert.equal(ops.filter(p=>p.motif==='reseau-occupe').length,0,'aucune opération « réseau occupé »');
 assert.ok(ops.some(p=>p.memLances>0&&p.memCharges>0),'des load() à nous, chargés, après la pause');
 console.log(`# préchauffage : remise ${r[0].avant}→${r[0].apres}, nœud demandé ${srv.journal.ept[cle]} fois ; après la pause : ${ops.map(p=>p.motif+' ('+(p.memLances??0)+')').join(', ')}`);
});
