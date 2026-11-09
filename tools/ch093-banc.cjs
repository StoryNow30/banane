#!/usr/bin/env node
'use strict';
/* CH-093 — BANC DU PASSAGE À LA RELECTURE (maquette ESV, forme relevée, modèle mémoire de Potree 1.8.2, voie potree, vrai Chromium ;
 * tests/esv-maquette/ch093-outils.cjs).
 *   CHROMIUM=/opt/pw-browsers/chromium node tools/ch093-banc.cjs [--repetitions 10] [--latence 60] [--decode 40] [--mort 400] [--sortie chantiers/CH-093/banc.json]
 * Machine au repos. Par répétition, cas et mode, une page neuve (cache vide) : fin du lot au cut 350, première coupe relue au cut 225. Cas : sans
 * passe des différés, avec 300 ms puis 1 000 ms entre la clôture du lot et le départ de la relecture (durée de préparation, NON mesurée sur le
 * terrain) ; avec une passe de 3 cuts. Modes (ordre alterné) : « avant » (le tronc : aucune commande, indices de la passe sans la première coupe
 * relue) et « apres » (ce chantier). Mesures : nœuds de la boîte de la première coupe relue connus et déjà chargés à son affichage (`ept-arrivee`),
 * leur part, de la demande de passage à « points affichés » (`ept-affiche`), opération lointaine (load() lancés, chargés). Médiane et P90.
 * Aucune adresse dans la sortie. */
const os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const N=require('../tests/esv-maquette/navigateur.cjs'),O93=require('../tests/esv-maquette/ch093-outils.cjs');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:d;};
const REP=Number(arg('repetitions',10)),LAT=Number(arg('latence',60)),DEC=Number(arg('decode',40)),MORT=Number(arg('mort',400)),SORTIE=arg('sortie',null);
const CAS=[{nom:'sans-passe-300ms',passe:0,avanceMs:300},{nom:'sans-passe-1000ms',passe:0,avanceMs:1000},{nom:'passe-3-cuts',passe:3}];
const MODES=[{nom:'avant',anticiper:false},{nom:'apres',anticiper:true}];
const q=(xs,p)=>{const v=xs.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return null;return v[Math.min(v.length-1,Math.ceil(p*v.length)-1)];};
const stats=xs=>({mediane:q(xs,.5),p90:q(xs,.9),n:xs.filter(Number.isFinite).length});
(async()=>{
 const r=N.indisponible()||(O93.adaptateurCH093()===null?'outil patch absent':null);if(r){console.error('banc impossible : '+r);process.exit(2);}
 const charge=os.loadavg()[0];console.log(`banc CH-093 : ${REP} répétitions, fin du lot 350, première coupe relue 225, latence ${LAT} ms, décompression ${DEC} ms, temps mort ${MORT} ms, charge au départ ${charge.toFixed(2)}`);
 const mesures=Object.fromEntries(CAS.map(c=>[c.nom,Object.fromEntries(MODES.map(m=>[m.nom,[]]))]));
 for(let i=0;i<REP;i++){for(const c of CAS){const ordre=i%2?[...MODES].reverse():MODES;
   for(const m of ordre){const g=await O93.seance({anticiper:m.anticiper,passe:c.passe,avanceMs:c.avanceMs??0,mortMs:MORT,latence:LAT,decode:DEC}),l=g.loin.at(-1)||{};
    mesures[c.nom][m.nom].push({connus:g.arrivee?.connus??null,chargesArrivee:g.arrivee?.charges??null,partArrivee:g.partArrivee,afficheMs:g.afficheMs,avanceMs:g.avanceReelleMs,liberes:g.liberes,refus:g.refus,
     loinLances:l.lances??null,loinCharges:l.charges??null,loinCaptures:l.captures??null,motif:l.motif??null,source:l.source??null});}}
  process.stdout.write(`.${i+1}`);}
 console.log('');
 const C=['connus','chargesArrivee','partArrivee','afficheMs','avanceMs','liberes','refus','loinLances','loinCharges','loinCaptures'];
 const resume=Object.fromEntries(Object.entries(mesures).map(([cas,parMode])=>[cas,Object.fromEntries(Object.entries(parMode).map(([k,l])=>[k,Object.fromEntries(C.map(c=>[c,stats(l.map(x=>x[c]))]))]))]));
 for(const [cas,parMode] of Object.entries(resume))for(const [k,s] of Object.entries(parMode))console.log((cas+' '+k).padEnd(26),Object.entries(s).filter(([,v])=>v.n).map(([c,v])=>`${c} ${v.mediane}/${v.p90}`).join(' · '));
 const sortie={banc:'ch093',date:new Date().toISOString().slice(0,10),repetitions:REP,finDuLot:350,premiereCoupeRelue:225,latenceMs:LAT,decodeMs:DEC,mortMs:MORT,chargeDepart:Math.round(charge*100)/100,coeurs:os.cpus().length,resume,mesures};
 if(SORTIE){fs.writeFileSync(path.resolve(SORTIE),JSON.stringify(sortie,null,1)+'\n');console.log('écrit : '+SORTIE);}
})().catch(e=>{console.error(e);process.exit(1);});
