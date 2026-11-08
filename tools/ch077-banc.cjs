#!/usr/bin/env node
'use strict';
/* CH-077 — BANC DU PRÉCHAUFFAGE (maquette ESV en mode EPT, vrai Chromium, copie patchée de l'adaptateur ; tests/esv-maquette/ch077-outils.cjs).
 *   CHROMIUM=/opt/pw-browsers/chromium node tools/ch077-banc.cjs [--repetitions 15] [--latence 60] [--sortie chantiers/CH-077/banc.json]
 * Machine au repos. Par répétition et par mode (sans, avec, avec « finir », avec un rayon de 0,75 m), une page neuve (cache vide), deux transitions ; la seconde est mesurée
 * (la première chauffe la page). Ordre des modes alterné d'une répétition à l'autre. Mesures : capture, pose et validation du cut en cours (retard du
 * préchauffage : doit être nul), durée de la chaîne d'étages du cut suivant (jusqu'au dernier nœud EPT chargé), nœuds servis par le cache, requêtes
 * reçues par le serveur pendant la transition, nœuds et octets demandés par le préchauffage. Médiane et P90. Aucune adresse dans la sortie. */
const os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const O=require('../tests/esv-maquette/ch077-outils.cjs'),N=require('../tests/esv-maquette/navigateur.cjs');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:d;};
const REP=Number(arg('repetitions',15)),LAT=Number(arg('latence',60)),MORT=Number(arg('mort',900)),SORTIE=arg('sortie',null);
const MODES=[{nom:'sans',prechauffer:false},{nom:'avec',prechauffer:true},{nom:'finir',prechauffer:true,reglage:{apresNavigation:'finir'}},{nom:'r075',prechauffer:true,reglage:{rayonM:.75}}];
const q=(xs,p)=>{const v=xs.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return null;return v[Math.min(v.length-1,Math.ceil(p*v.length)-1)];};
const stats=xs=>({mediane:q(xs,.5),p90:q(xs,.9),n:xs.filter(Number.isFinite).length});
(async()=>{
 const r=N.indisponible();if(r){console.error('banc impossible : '+r);process.exit(2);}
 const charge=os.loadavg()[0];console.log(`banc CH-077 : ${REP} répétitions, latence serveur ${LAT} ms par nœud, temps mort ${MORT} ms, charge au départ ${charge.toFixed(2)}`);
 const mesures=Object.fromEntries(MODES.map(m=>[m.nom,[]]));
 for(let i=0;i<REP;i++){const ordre=i%2?[...MODES].reverse():MODES;
  for(const m of ordre){const s=await O.ouvrir({prechauffer:m.prechauffer,reglage:m.reglage||{}});
   try{s.env.serveur.pannes({eptLatenceMs:LAT});await s.transition({mortMs:MORT});const t=await s.transition({mortMs:MORT});
    const p=t.evts.filter(e=>e.kind==='prechauffage').at(0)||null;
    mesures[m.nom].push({captureMs:t.captureMs,poseMs:t.poseMs,validationMs:t.validationMs,chaineMs:t.chaineMs,noeuds:t.noeuds,cache:t.cache,requetes:t.requetes,
     prechauffes:p?p.noeuds:0,octets:p?p.octets:0,frontiere:p?p.frontiere:null,candidats:p?p.candidats:null,motif:p?p.motif:null,juste:p?p.predite===t.suivant:null});}
   finally{await s.fermer();}}
  process.stdout.write(`.${i+1}`);}
 console.log('');
 const resume=Object.fromEntries(Object.entries(mesures).map(([k,l])=>[k,Object.fromEntries(['captureMs','poseMs','validationMs','chaineMs','noeuds','cache','requetes','prechauffes','octets','frontiere','candidats'].map(c=>[c,stats(l.map(x=>x[c]))]))]));
 for(const [k,s] of Object.entries(resume))console.log(k.padEnd(6),Object.entries(s).map(([c,v])=>`${c} ${v.mediane}/${v.p90}`).join(' · '));
 const motifs=Object.fromEntries(Object.entries(mesures).map(([k,l])=>[k,l.reduce((a,x)=>(a[x.motif??'aucun']=(a[x.motif??'aucun']||0)+1,a),{})]));
 console.log('motifs de fin du préchauffage :',JSON.stringify(motifs));
 const sortie={banc:'ch077',date:new Date().toISOString().slice(0,10),repetitions:REP,latenceMs:LAT,mortMs:MORT,chargeDepart:Math.round(charge*100)/100,coeurs:os.cpus().length,resume,motifs,mesures};
 if(SORTIE){fs.writeFileSync(path.resolve(SORTIE),JSON.stringify(sortie,null,1)+'\n');console.log('écrit : '+SORTIE);}
})().catch(e=>{console.error(e.stack||e.message);process.exit(1);});
