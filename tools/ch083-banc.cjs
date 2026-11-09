#!/usr/bin/env node
'use strict';
/* CH-083 (D-314) — BANC DE LA PHASE MÉMOIRE (maquette ESV, forme relevée, modèle mémoire de Potree 1.8.2, vrai Chromium ; tests/esv-maquette/ch083-outils.cjs).
 *   CHROMIUM=/opt/pw-browsers/chromium node tools/ch083-banc.cjs [--repetitions 15] [--saut 50] [--latence 60] [--mort 900] [--decode 40] [--sortie chantiers/CH-083/banc.json]
 * Machine au repos. Par répétition et par mode, une page neuve (cache vide), UNE transition : capture, pose, temps mort, validation, saut de `saut`
 * coupes. Modes (ordre alterné) : « sans » (réglage livré, `memoire.actif:false` : préchauffage HTTP seul, celui de CH-081) et « avec » (phase mémoire
 * allumée). Mesures : de la validation à « points affichés » (`ept-affiche` : tous les nœuds de la boîte de la coupe suivante montés), nœuds de cette
 * boîte déjà chargés à l'arrivée, load() lancés et chargés, octets décodés, tas JS avant et après (Ko), capture du cut en cours, nœuds de la coupe en
 * cours perdus pendant le temps mort (doit être 0). Médiane et P90. Aucune adresse dans la sortie. */
const os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const N=require('../tests/esv-maquette/navigateur.cjs'),O80=require('../tests/esv-maquette/ch080-outils.cjs');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:d;};
const REP=Number(arg('repetitions',15)),SAUT=Number(arg('saut',50)),LAT=Number(arg('latence',60)),MORT=Number(arg('mort',900)),DEC=Number(arg('decode',40)),SORTIE=arg('sortie',null);
const MODES=[{nom:'sans',memoire:false},{nom:'avec',memoire:true}];
const q=(xs,p)=>{const v=xs.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return null;return v[Math.min(v.length-1,Math.ceil(p*v.length)-1)];};
const stats=xs=>({mediane:q(xs,.5),p90:q(xs,.9),n:xs.filter(Number.isFinite).length});
(async()=>{
 const r=N.indisponible()||(O80.adaptateurCH080()===null?'outil patch absent':null);if(r){console.error('banc impossible : '+r);process.exit(2);}
 const O=require('../tests/esv-maquette/ch083-outils.cjs');
 const charge=os.loadavg()[0];console.log(`banc CH-083 : ${REP} répétitions, saut ${SAUT}, latence ${LAT} ms, décompression ${DEC} ms par nœud, temps mort ${MORT} ms, charge au départ ${charge.toFixed(2)}`);
 const mesures=Object.fromEntries(MODES.map(m=>[m.nom,[]]));
 for(let i=0;i<REP;i++){const ordre=i%2?[...MODES].reverse():MODES;
  for(const m of ordre){const s=await O.ouvrir({memoire:m.memoire,saut:SAUT,decode:DEC});
   try{s.env.serveur.pannes({eptLatenceMs:LAT});const t=await s.transition({mortMs:MORT});
    if(t.suivant-t.cut!==SAUT)throw Error(`saut inattendu : ${t.cut} → ${t.suivant}`);
    const p=t.evts.find(e=>e.kind==='prechauffage')||{};
    mesures[m.nom].push({afficheMs:t.afficheMs,chaineMs:t.chaineMs,connus:t.arrivee?.connus??null,chargesArrivee:t.arrivee?.charges??null,captureMs:t.captureMs,
     perdusCoupeEnCours:(t.avant.arbre-t.apres.arbre)+(t.avant.charges-t.apres.charges),liberes:t.liberes,prechauffes:p.noeuds??0,memLances:p.memLances??0,memCharges:p.memCharges??0,
     memOctets:p.memOctets??0,tasAvantKo:p.tasAvantKo??null,tasApresKo:p.tasApresKo??null,motif:p.motif??null});}
   finally{await s.fermer();}}
  process.stdout.write(`.${i+1}`);}
 console.log('');
 const C=['afficheMs','chaineMs','connus','chargesArrivee','captureMs','perdusCoupeEnCours','liberes','prechauffes','memLances','memCharges','memOctets','tasAvantKo','tasApresKo'];
 const resume=Object.fromEntries(Object.entries(mesures).map(([k,l])=>[k,Object.fromEntries(C.map(c=>[c,stats(l.map(x=>x[c]))]))]));
 for(const [k,s] of Object.entries(resume))console.log(k.padEnd(5),Object.entries(s).map(([c,v])=>`${c} ${v.mediane}/${v.p90}`).join(' · '));
 const motifs=Object.fromEntries(Object.entries(mesures).map(([k,l])=>[k,l.reduce((a,x)=>(a[x.motif??'aucun']=(a[x.motif??'aucun']||0)+1,a),{})]));
 console.log('motifs :',JSON.stringify(motifs));
 const sortie={banc:'ch083',date:new Date().toISOString().slice(0,10),repetitions:REP,saut:SAUT,latenceMs:LAT,decodeMs:DEC,mortMs:MORT,chargeDepart:Math.round(charge*100)/100,coeurs:os.cpus().length,resume,motifs,mesures};
 if(SORTIE){fs.writeFileSync(path.resolve(SORTIE),JSON.stringify(sortie,null,1)+'\n');console.log('écrit : '+SORTIE);}
})().catch(e=>{console.error(e);process.exit(1);});
