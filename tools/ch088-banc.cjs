#!/usr/bin/env node
'use strict';
/* CH-088 — BANC DU GRAND SAUT (maquette ESV, forme relevée, modèle mémoire de Potree 1.8.2, voie potree, vrai Chromium ; tests/esv-maquette/ch088-outils.cjs).
 *   CHROMIUM=/opt/pw-browsers/chromium node tools/ch088-banc.cjs [--repetitions 15] [--saut 250] [--grappe 4] [--latence 60] [--mort 400] [--decode 40] [--sortie chantiers/CH-088/banc.json]
 * Machine au repos. Par répétition et par mode, une page neuve (cache vide) : `grappe` − 1 transitions proches (+1), puis le grand saut de
 * `saut − grappe + 1` coupes, puis la capture de la coupe d'arrivée. Modes (ordre alterné) : « vision8 » (réglage livré, opération lointaine éteinte)
 * et « loin » (opération lointaine allumée). Mesures : de la validation à « points affichés » (`ept-affiche` de la maquette), nœuds de la boîte
 * chargés à l'arrivée (`ept-arrivee` : à l'affichage de la coupe), capture de la coupe d'arrivée, opération lointaine (captures avant, load() lancés et
 * chargés, chargés et connus au début de la capture d'arrivée, chargés ensuite par Potree seul). Médiane et P90. Aucune adresse dans la sortie.
 * `mort` 400 ms : durée médiane d'une opération sur le terrain avant le changement de coupe (lot « Vision 8 », 250 à 720 ms, ÉTABLI). */
const os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const N=require('../tests/esv-maquette/navigateur.cjs'),O88=require('../tests/esv-maquette/ch088-outils.cjs');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:d;};
const REP=Number(arg('repetitions',15)),SAUT=Number(arg('saut',250)),GRAPPE=Number(arg('grappe',4)),LAT=Number(arg('latence',60)),MORT=Number(arg('mort',400)),DEC=Number(arg('decode',40)),SORTIE=arg('sortie',null);
const MODES=[{nom:'vision8',loin:false},{nom:'loin',loin:true}];
const q=(xs,p)=>{const v=xs.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return null;return v[Math.min(v.length-1,Math.ceil(p*v.length)-1)];};
const stats=xs=>({mediane:q(xs,.5),p90:q(xs,.9),n:xs.filter(Number.isFinite).length});
(async()=>{
 const r=N.indisponible()||(O88.adaptateurCH088()===null?'outil patch absent':null);if(r){console.error('banc impossible : '+r);process.exit(2);}
 const charge=os.loadavg()[0];console.log(`banc CH-088 : ${REP} répétitions, saut ${SAUT - GRAPPE + 1} après ${GRAPPE - 1} coupes voisines, latence ${LAT} ms, décompression ${DEC} ms, temps mort ${MORT} ms, charge au départ ${charge.toFixed(2)}`);
 const mesures=Object.fromEntries(MODES.map(m=>[m.nom,[]]));
 for(let i=0;i<REP;i++){const ordre=i%2?[...MODES].reverse():MODES;
  for(const m of ordre){const g=await O88.grandSaut({loin:m.loin,saut:SAUT,grappe:GRAPPE,latence:LAT,decode:DEC,mortMs:MORT});
   const l=g.loin.at(-1)||{},t=g.t;
   mesures[m.nom].push({afficheMs:t.afficheMs,connus:t.arrivee?.connus??null,chargesArrivee:t.arrivee?.charges??null,partArrivee:t.arrivee?.connus?Math.round(1000*t.arrivee.charges/t.arrivee.connus)/1000:null,
    captureArriveeMs:g.captureArriveeMs,perdusCoupeEnCours:(t.avant.arbre-t.apres.arbre)+(t.avant.charges-t.apres.charges),liberes:t.liberes,
    loinCaptures:l.captures??null,loinLances:l.lances??null,loinCharges:l.charges??null,loinPrets:l.prets??null,loinBoite:l.boite??null,loinPotreeLui:l.potreeLui??null,loinMsAvant:l.msAvant??null,motif:l.motif??null});}
  process.stdout.write(`.${i+1}`);}
 console.log('');
 const C=['afficheMs','connus','chargesArrivee','partArrivee','captureArriveeMs','perdusCoupeEnCours','liberes','loinCaptures','loinLances','loinCharges','loinPrets','loinBoite','loinPotreeLui','loinMsAvant'];
 const resume=Object.fromEntries(Object.entries(mesures).map(([k,l])=>[k,Object.fromEntries(C.map(c=>[c,stats(l.map(x=>x[c]))]))]));
 for(const [k,s] of Object.entries(resume))console.log(k.padEnd(8),Object.entries(s).filter(([,v])=>v.n).map(([c,v])=>`${c} ${v.mediane}/${v.p90}`).join(' · '));
 const sortie={banc:'ch088',date:new Date().toISOString().slice(0,10),repetitions:REP,saut:SAUT-GRAPPE+1,voisinesAvant:GRAPPE-1,latenceMs:LAT,decodeMs:DEC,mortMs:MORT,chargeDepart:Math.round(charge*100)/100,coeurs:os.cpus().length,resume,mesures};
 if(SORTIE){fs.writeFileSync(path.resolve(SORTIE),JSON.stringify(sortie,null,1)+'\n');console.log('écrit : '+SORTIE);}
})().catch(e=>{console.error(e);process.exit(1);});
