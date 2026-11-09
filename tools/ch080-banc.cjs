#!/usr/bin/env node
'use strict';
/* CH-080 (D-309) — BANC DU PRÉCHAUFFAGE D'UNE COUPE ÉLOIGNÉE (maquette ESV en mode EPT et `saut`, vrai Chromium ; tests/esv-maquette/ch080-outils.cjs).
 *   CHROMIUM=/opt/pw-browsers/chromium node tools/ch080-banc.cjs [--repetitions 15] [--saut 50] [--latence 60] [--mort 900] [--sortie chantiers/CH-080/banc.json]
 * Machine au repos. Par répétition et par mode, une page neuve (cache vide), UNE transition : capture du cut affiché (le préchauffage part à la fin),
 * pose, temps mort, validation, et ESV ouvre la coupe non validée suivante, `saut` coupes plus loin. Modes : « sans » (adaptateur du tronc : fenêtre
 * B1 de ±10 lignes, la coupe n'est pas trouvée) et « avec » (adaptateur patché par CH-080 : coupe prise dans la liste d'ESV). Les deux avec le réglage
 * livré ; « avecSansHier » : patché, hiérarchie EPT non lue (`hierarchie:false`). La maquette lit sa hiérarchie dans des fichiers `ept-hierarchy`
 * (pas de 2 niveaux), comme Potree 1.8. Ordre des modes alterné. Mesures : temps de la validation à « aucun chargement » (`reposMs`), chaîne d'étages de la coupe suivante, nœuds servis
 * par le cache, requêtes reçues par le serveur, nœuds et octets demandés par le préchauffage, et capture du cut en cours (retard : doit être nul).
 * Médiane et P90. Aucune adresse dans la sortie. */
const os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const O=require('../tests/esv-maquette/ch080-outils.cjs'),N=require('../tests/esv-maquette/navigateur.cjs');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:d;};
const FORME=arg('forme',null),PAS=arg('pas',null)?Number(arg('pas')):null;   /* CH-080c : --forme commun --pas 7 : forme relevée dans ESV, hiérarchie lue d'avance */
const REP=Number(arg('repetitions',15)),SAUT=Number(arg('saut',50)),LAT=Number(arg('latence',60)),MORT=Number(arg('mort',900)),SORTIE=arg('sortie',null);
const MODES=FORME?[{nom:'eteint',correctif:true,prechauffer:false},{nom:'avecSansHier',correctif:true,reglage:{hierarchie:false}},{nom:'avec',correctif:true}]:[{nom:'sans',correctif:false},{nom:'avecSansHier',correctif:true,reglage:{hierarchie:false}},{nom:'avec',correctif:true}];
const q=(xs,p)=>{const v=xs.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return null;return v[Math.min(v.length-1,Math.ceil(p*v.length)-1)];};
const stats=xs=>({mediane:q(xs,.5),p90:q(xs,.9),n:xs.filter(Number.isFinite).length});
(async()=>{
 const r=N.indisponible()||(O.adaptateurCH080()===null?'outil patch absent':null);if(r){console.error('banc impossible : '+r);process.exit(2);}
 const charge=os.loadavg()[0];console.log(`banc CH-080${FORME?' (forme '+FORME+(PAS?', pas '+PAS:'')+')':''} : ${REP} répétitions, saut ${SAUT} coupes, latence serveur ${LAT} ms par nœud, temps mort ${MORT} ms, charge au départ ${charge.toFixed(2)}`);
 const mesures=Object.fromEntries(MODES.map(m=>[m.nom,[]]));
 for(let i=0;i<REP;i++){const ordre=i%2?[...MODES].reverse():MODES;
  for(const m of ordre){const s=await O.ouvrir({correctif:m.correctif,prechauffer:m.prechauffer!==false,saut:SAUT,reglage:m.reglage||{},...(FORME?{forme:FORME}:{}),...(PAS?{pas:PAS}:{})});
   try{s.env.serveur.pannes({eptLatenceMs:LAT});const t=await s.transition({mortMs:MORT});
    if(t.suivant-t.cut!==SAUT)throw Error(`saut inattendu : ${t.cut} → ${t.suivant}`);
    const p=t.evts.filter(e=>e.kind==='prechauffage').at(0)||null;
    mesures[m.nom].push({reposMs:t.reposMs,hierPotree:t.hierarchies,hierCache:t.hierCache,hierarchies:p?p.hierarchies:0,deduits:p?p.deduits:0,chaineMs:t.chaineMs,captureMs:t.captureMs,poseMs:t.poseMs,validationMs:t.validationMs,noeuds:t.noeuds,cache:t.cache,requetes:t.requetes,
     prechauffes:p?p.noeuds:0,octets:p?p.octets:0,frontiere:p?p.frontiere:null,candidats:p?p.candidats:null,motif:p?p.motif:null,source:p?p.source:null,saut:p?p.saut:null,juste:p?p.predite===t.suivant:null});}
   finally{await s.fermer();}}
  process.stdout.write(`.${i+1}`);}
 console.log('');
 const C=['reposMs','chaineMs','hierPotree','hierCache','hierarchies','deduits','captureMs','poseMs','validationMs','noeuds','cache','requetes','prechauffes','octets','frontiere','candidats'];
 const resume=Object.fromEntries(Object.entries(mesures).map(([k,l])=>[k,Object.fromEntries(C.map(c=>[c,stats(l.map(x=>x[c]))]))]));
 for(const [k,s] of Object.entries(resume))console.log(k.padEnd(5),Object.entries(s).map(([c,v])=>`${c} ${v.mediane}/${v.p90}`).join(' · '));
 const motifs=Object.fromEntries(Object.entries(mesures).map(([k,l])=>[k,l.reduce((a,x)=>(a[`${x.motif??'aucun'}|${x.source??'-'}`]=(a[`${x.motif??'aucun'}|${x.source??'-'}`]||0)+1,a),{})]));
 console.log('motifs | sources :',JSON.stringify(motifs));
 const sortie={banc:'ch080',forme:FORME,pas:PAS,date:new Date().toISOString().slice(0,10),repetitions:REP,saut:SAUT,latenceMs:LAT,mortMs:MORT,chargeDepart:Math.round(charge*100)/100,coeurs:os.cpus().length,resume,motifs,mesures};
 if(SORTIE){fs.writeFileSync(path.resolve(SORTIE),JSON.stringify(sortie,null,1)+'\n');console.log('écrit : '+SORTIE);}
})().catch(e=>{console.error(e.stack||e.message);process.exit(1);});
