#!/usr/bin/env node
/* CH-088 (a) : pour chaque saut de 11 coupes ou plus du lot (ordre des before-captured), les opérations de préchauffage qui visaient la cible (k+1 :
 * `predite` ; k+2 : opération de la coupe d avant, 2 cibles), le départ le plus tôt avant le début de la capture d arrivée, load() lancés et finis.
 *   node chantiers/CH-088/mesure-sauts.cjs <ariane-journal-v4-*.json>   (journal extrait de l export ; aucune donnée dans le dépôt) */
const j=require(process.argv[2]);const ev=j.events.map(e=>({...e,_ms:Date.parse(e.timestamp)})).sort((a,b)=>a._ms-b._ms);
const prets=new Map();let prec=null;const arr=[];const bc=[];
for(const e of ev){ if(e.type==='adapter-progress'&&e.action==='capture'&&e.lastStage==='capture-ready')prets.set(e.identity.cut,{ms:e._ms,el:e.elapsedMs});
 else if(e.type==='before-captured'){const c=e.identity.cut,p=prets.get(c);bc.push(c);if(prec!==null&&p&&Math.abs(c-prec)>=11)arr.push({de:prec,a:c,saut:c-prec,el:p.el,debut:p.ms-p.el,idx:bc.length-1});prec=c;}}
const pre=ev.filter(e=>e.kind==='prechauffage');
const rows=[];
for(const a of arr){ // toutes les ops qui ont pu viser a.a : predite===a.a (k+1) ou coupe = bc[idx-2] avec cibles 2 (k+2)
 const ops=pre.filter(e=>e._ms<a.debut+50&&(e.predite===a.a||(bc[a.idx-2]!==undefined&&e.coupe===bc[a.idx-2]&&e.cibles>=2)));
 const premier=ops.length?Math.min(...ops.map(e=>e._ms-e.dureeMs)):null;
 const k1=ops.find(e=>e.predite===a.a);
 rows.push({de:a.de,a:a.a,saut:a.saut,captureMs:a.el,coupesAvant:ops.length?(ops.some(e=>e.predite!==a.a)?2:1):0,msAvant:premier===null?null:Math.round(a.debut-premier),
  k1:k1?{lances:k1.memLances,charges:k1.memCharges,enVolFin:k1.memEnVolFin,dureeMs:k1.dureeMs,motif:k1.motif,dansBoite:k1.intersectants,dejaCharges:k1.charges}:null,
  k2:ops.filter(e=>e!==k1).map(e=>({lances:e.memLances,charges:e.memCharges,motif:e.motif,dureeMs:e.dureeMs}))});}
for(const r of rows)console.log(JSON.stringify(r));
