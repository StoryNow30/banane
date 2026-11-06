#!/usr/bin/env node
'use strict';
/* CH-059 — RETOUR ARRIÈRE vers un paquet antérieur (par défaut l'arbre de `ariane-v5-2bc1f56`), puis remise à jour.
 * 1. Branche : journée Écho (visites, vidages), état écrit en morceaux.
 * 2. Ancien arbre : le service worker redémarre sur cet état (moteur, session Écho, stockage de l'ancien arbre), reprend la
 *    session, ajoute des visites, sauvegarde. Il ne doit pas planter.
 * 3. Branche : relit l'état ; les visites et nuages d'avant le retour arrière (morceaux) puis ceux de l'ancien arbre (à la suite)
 *    sont tous là, dans l'ordre ; la session reprend et l'export se fait.
 * Usage : node tools/ch059-retour-arriere.cjs <racine-ancienne> [racine-branche]. L'ancien arbre reçoit une copie de
 * tests/helpers/journee-etat.cjs (le banc de la journée), rien d'autre. */
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const etape=process.argv[2];
if(etape==='--etape'){
 const [,,,quoi,racine,fichier]=process.argv,J=require(path.join(path.resolve(racine),'tests/helpers/journee-etat.cjs'));
 const lireDisque=()=>{const d=JSON.parse(fs.readFileSync(fichier,'utf8')),fc=J.fauxChrome();for(const [k,v] of Object.entries(d.disque))fc.disque.set(k,v);
  const tables=Object.fromEntries(Object.entries(d.tables).map(([n,l])=>[n,new Map(l)]));return {fc,tables};};
 const ecrire=(fc,tables)=>fs.writeFileSync(fichier,JSON.stringify({disque:Object.fromEntries(fc.disque),tables:Object.fromEntries(Object.entries(tables).map(([n,m])=>[n,[...m]]))}));
 (async()=>{
  if(quoi==='1'){const fc=J.fauxChrome(),a=await J.ouvrir(fc);await a.sessions.start();for(let i=0;i<90;i++){await J.visite(a,i,8);if((i+1)%30===0)await J.vidage(a);}
   for(let i=90;i<100;i++)await J.visite(a,i,8);await a.engine.save();ecrire(fc,a.store.tables);
   const m=await a.sessions.exportManifest(),p=await a.sessions.exportPlan(),f=await a.sessions.exportManifest(true);
   console.log(JSON.stringify({visites:a.engine.s.native.visits.length,nuages:a.engine.s.native.cloudIds.length,cles:fc.disque.size,
    export:{planNuages:p.cloudIds.length,manifesteNuages:m.cloudIds.length,declares:m.declaredCloudIds.length,finalNuages:f.cloudIds.length,visitesSession:m.session.visits.length,enregistrements:m.recordCount}}));}
  if(quoi==='2'){const {fc,tables}=lireDisque(),a=await J.ouvrir(fc,tables),n=a.engine.s.native;const lu={statut:n.status,visitesLues:n.visits.length,nuagesLus:n.cloudIds.length};
   /* Ce que l'ancien paquet exporterait à cet instant : vidage automatique (plan), manifeste, export final (tous). */
   {const m=await a.sessions.exportManifest(),p=await a.sessions.exportPlan(),f=await a.sessions.exportManifest(true);
    lu.export={planNuages:p.cloudIds.length,manifesteNuages:m.cloudIds.length,declares:m.declaredCloudIds.length,finalNuages:f.cloudIds.length,visitesSession:m.session.visits.length,enregistrements:m.recordCount};}
   await a.sessions.resume();for(let i=0;i<5;i++)await J.visite(a,i,9);await a.engine.save();ecrire(fc,a.store.tables);
   console.log(JSON.stringify({...lu,visitesApres:a.engine.s.native.visits.length,conseil:!!a.sessions.exportAdvice()}));}
  if(quoi==='3'){const {fc,tables}=lireDisque(),a=await J.ouvrir(fc,tables),n=a.engine.s.native;
   const ids=n.visits.map(v=>v.visitId),attendu=[...Array.from({length:100},(_,i)=>`v-8-${i}`),...Array.from({length:5},(_,i)=>`v-9-${i}`)];
   await a.sessions.resume();await J.visite(a,0,10);const ds=await a.sessions.dataset();
   console.log(JSON.stringify({visites:ids.length,ordreExact:JSON.stringify(ids)===JSON.stringify(attendu),nuages:n.cloudIds.length,nuagesUniques:new Set(n.cloudIds).size,
    visitesExportees:ds.records.length,manquants:n.etatMorceauxManquants??a.engine.s.etatMorceauxManquants??null}));}
 })().catch(e=>{console.error('ÉCHEC',e?.stack||e);process.exit(1);});
}else{
 const ancien=path.resolve(process.argv[2]||''),branche=path.resolve(process.argv[3]||path.join(__dirname,'..'));
 if(!process.argv[2]||!fs.existsSync(path.join(ancien,'src/engine.js'))){console.error('usage : ch059-retour-arriere.cjs <racine-ancienne> [racine-branche]');process.exit(2);}
 fs.mkdirSync(path.join(ancien,'tests/helpers'),{recursive:true});fs.copyFileSync(path.join(branche,'tests/helpers/journee-etat.cjs'),path.join(ancien,'tests/helpers/journee-etat.cjs'));
 const fichier=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'ch059-')),'disque.json');
 const run=(q,r)=>JSON.parse(execFileSync(process.execPath,[__filename,'--etape',q,r,fichier],{encoding:'utf8',maxBuffer:1<<28}).trim().split('\n').at(-1));
 const r={branche:run('1',branche),ancien:run('2',ancien),remiseAJour:run('3',branche)};console.log(JSON.stringify(r,null,1));
 const ok=r.remiseAJour.ordreExact&&r.remiseAJour.visites===105&&r.remiseAJour.nuages===r.remiseAJour.nuagesUniques&&r.remiseAJour.visitesExportees===106;process.exit(ok?0:1);}
