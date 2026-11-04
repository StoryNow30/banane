#!/usr/bin/env node
/* CH-049-E : où part le temps de chargement des points ? Lecture hors ligne d'un journal Orbite (v4).
 * Usage : node mesure-points.cjs JOURNAL.json
 * Ne sort que des agrégats (aucune adresse, aucun identifiant). Données : banane-data. */
const fs=require('fs');
const j=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const ev=j.events;
const q=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
const st=a=>({n:a.length,p50:q(a,.5),p90:q(a,.9),p99:q(a,.99),max:q(a,1),moy:a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):null});
const R=ev.filter(e=>e.type==='esv-observation'&&e.kind==='resource'&&e.class==='point-resource');
const rep={};
/* 1. par fenêtre de 250 ms */
const ept=R.filter(e=>e.ept>0);
rep.fenetres={total:R.length,avecEptData:ept.length,
 nParFenetre:st(R.map(e=>e.n)),octetsParFenetre:st(R.map(e=>e.bytes)),
 echecs:R.reduce((a,e)=>a+(e.echecs||0),0),
 statuts:R.reduce((a,e)=>{for(const[k,v]of Object.entries(e.statuts||{}))a[k]=(a[k]||0)+v;return a;},{}),
 hierarchieOuJson:R.reduce((a,e)=>a+(e.n-(e.ept||0)),0)};
/* durée moyenne par ressource ept-data dans la fenêtre = dureeTot/ept ; max = dureeMax */
rep.dureeParRessourceMs=st(ept.map(e=>e.dureeTotMs/e.ept));
rep.dureeMaxParFenetreMs=st(ept.map(e=>e.dureeMaxMs));
rep.octetsParRessource=st(ept.map(e=>e.bytes/e.n));
/* débit apparent (Mo/s) = octets / durée de la fenêtre */
rep.empanFenetreMs=st(R.map(e=>e.endedEpochMs-e.startedEpochMs));
/* parallélisme = somme des durées / empan (borne basse : une fenêtre à une seule ressource vaut 1) */
rep.parallelismeParFenetre=st(ept.filter(e=>e.ept>1&&e.endedEpochMs>e.startedEpochMs).map(e=>e.dureeTotMs/(e.endedEpochMs-e.startedEpochMs)));
/* 2. grappes : regrouper les fenêtres séparées de moins de 1 s = « un chargement » */
R.sort((a,b)=>a.startedEpochMs-b.startedEpochMs);
const grappes=[];let g=null;
for(const e of R){if(g&&e.startedEpochMs-g.fin<1000){g.fin=Math.max(g.fin,e.endedEpochMs);g.n+=e.n;g.octets+=e.bytes;g.fen++;g.dur+=e.dureeTotMs||0;}
 else{g={deb:e.startedEpochMs,fin:e.endedEpochMs,n:e.n,octets:e.bytes,fen:1,dur:e.dureeTotMs||0};grappes.push(g);}}
rep.grappes={total:grappes.length,dureeMs:st(grappes.map(x=>x.fin-x.deb)),ressources:st(grappes.map(x=>x.n)),octets:st(grappes.map(x=>x.octets)),
 parallelisme:st(grappes.filter(x=>x.fin>x.deb).map(x=>x.dur/(x.fin-x.deb)))};
/* 3. liaison aux changements de cut : premier chargement de points après chaque cut-target-changed */
const T=ev.filter(e=>e.type==='cut-target-changed').map(e=>({t:Date.parse(e.timestamp),de:e.identity?.cut,vers:e.nextIdentity?.cut,part:e.nextIdentity?.part})).sort((a,b)=>a.t-b.t);
const dec=[];let sans=0;
for(let i=0;i<T.length;i++){const a=T[i].t,b=i+1<T.length?T[i+1].t:a+60000;
 const w=R.filter(e=>e.startedEpochMs>=a-500&&e.startedEpochMs<b);
 if(!w.length){sans++;continue;}
 dec.push({decal:w[0].startedEpochMs-a,fin:Math.max(...w.map(e=>e.endedEpochMs))-a,n:w.reduce((s,e)=>s+e.n,0),inter:b-a});}
rep.parChangementDeCut={changements:T.length,sansPoints:sans,
 debutApresChangementMs:st(dec.map(x=>x.decal)),finDesPointsApresChangementMs:st(dec.map(x=>x.fin)),ressourcesParCut:st(dec.map(x=>x.n)),intervalleEntreChangementsMs:st(dec.map(x=>x.inter))};
/* 4. cycle d'un cut (phase-timing-pli, jalons relatifs à l'ouverture de la visite) */
const P=ev.filter(e=>e.type==='phase-timing-pli'&&e.r&&e.r.j);
const jal={};for(const e of P)for(const[k,v]of Object.entries(e.r.j))if(typeof v==='number')(jal[k]||(jal[k]=[])).push(v);
rep.jalonsCycleMs=Object.fromEntries(Object.entries(jal).map(([k,v])=>[k,st(v)]));
const cap=P.map(e=>e.r.s?.['command:capture']?.[1]).filter(x=>typeof x==='number');rep.commandeCaptureMs=st(cap);
/* 5. captures : tentatives et durée */
const AR=ev.filter(e=>e.type==='adapter-result'&&e.action==='capture');
rep.captures={total:AR.length,dureeMs:st(AR.map(e=>e.elapsedMs)),tentatives:AR.reduce((a,e)=>{const k=e.lastDetail?.attempts;a[k]=(a[k]||0)+1;return a;},{}),
 erreurs:AR.reduce((a,e)=>{const k=e.error?.code||e.error?.message||(e.error?'erreur':null);if(k)a[String(k).slice(0,40)]=(a[String(k).slice(0,40)]||0)+1;return a;},{})};
/* 6. changements de partie */
const FP=ev.filter(e=>e.type==='file-parties-changement');
rep.changementsDePartie={ok:st(FP.filter(e=>e.issue==='ok').map(e=>e.dureeMs)),refus:st(FP.filter(e=>e.issue!=='ok').map(e=>e.dureeMs))};
console.log(JSON.stringify(rep,null,1));
/* 7. Temps de capture passé AVEC / SANS requête de points en vol (borne : l'empan d'une fenêtre de 250 ms
 *    est compté en vol d'un bout à l'autre, donc « avec » est surestimé, « sans » est une borne basse). */
{
 const W=R.map(e=>[e.startedEpochMs,e.endedEpochMs]).sort((a,b)=>a[0]-b[0]);
 const U=[];for(const w of W){const l=U[U.length-1];if(l&&w[0]<=l[1])l[1]=Math.max(l[1],w[1]);else U.push([...w]);}
 const couv=(a,b)=>{let s=0;for(const u of U){if(u[1]<=a)continue;if(u[0]>=b)break;s+=Math.min(b,u[1])-Math.max(a,u[0]);}return s;};
 const agg={tot:0,vol:0,n:0},reg={};
 const prog={};for(const e of ev)if(e.type==='adapter-progress'&&e.action==='capture')(prog[e.requestId]||(prog[e.requestId]=[])).push(e);
 for(const e of AR){const a=Date.parse(e.demandeA),b=a+e.elapsedMs;if(!Number.isFinite(a))continue;
  agg.n++;agg.tot+=e.elapsedMs;agg.vol+=couv(a,b);
  const p=(prog[e.requestId]||[]).sort((x,y)=>x.elapsedMs-y.elapsedMs),w=p.filter(x=>x.lastStage==='capture-wait'),r=p.filter(x=>x.lastStage==='capture-read');
  for(let i=0;i<Math.min(2,w.length,r.length);i++){const k=(r[i].lastDetail?.regle||'?')+(r[i].lastDetail?.diag?.m?'/'+r[i].lastDetail.diag.m:'');
   const x=reg[k]||(reg[k]={attentes:0,msTot:0,msAvecRequete:0});x.attentes++;const d=r[i].elapsedMs-w[i].elapsedMs;x.msTot+=d;x.msAvecRequete+=couv(a+w[i].elapsedMs,a+r[i].elapsedMs);}}
 rep.captureAvecSansRequetes={captures:agg.n,msTotal:Math.round(agg.tot),partAvecRequeteEnVol:+(agg.vol/agg.tot).toFixed(3),
  attentesParRegle:Object.fromEntries(Object.entries(reg).map(([k,x])=>[k,{...x,partAvecRequete:+(x.msAvecRequete/x.msTot).toFixed(3)}]))};
 console.log(JSON.stringify(rep.captureAvecSansRequetes,null,1));
}
/* 8. Changement de partie : requêtes de points et de liste pendant l'attente (fenêtre = [horodatage − durée, horodatage]). */
{
 const L=ev.filter(e=>e.type==='esv-observation'&&e.kind==='list-page');
 rep.changementDePartieDetail=ev.filter(e=>e.type==='file-parties-changement'&&e.issue==='ok').map(f=>{const b=Date.parse(f.timestamp),a=b-f.dureeMs;
  const r=R.filter(e=>e.endedEpochMs>a&&e.startedEpochMs<b),l=L.filter(e=>e.endedEpochMs>a&&e.startedEpochMs<b);
  return {dureeMs:f.dureeMs,fenetresPoints:r.length,debutPointsMs:r.length?Math.round(Math.min(...r.map(e=>e.startedEpochMs))-a):null,
   listes:l.length,dureeListesMs:l.map(e=>Math.round(e.durationMs))};});
 console.log(JSON.stringify(rep.changementDePartieDetail));
}
