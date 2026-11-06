'use strict';
/* CH-060 — outils communs des essais du signal d'ESV éteint pendant la relecture (tests/relecture-signal-eteint*.test.cjs). */
const {H}=require('./relecture-pause.cjs');
/* ESV simulé : captures marquées « repli » tant que la page n'a pas été rechargée par Ariane ; « signal » ensuite. Le rechargement de l'onglet
 * est imité : la page commence à se recharger (chargementEsvReset, comme chrome.tabs.onUpdated « loading »), ESV reste muet `muetMs`, puis répond. */
function esvSignal({muetMs=60,jamaisPret=false}={}){return (a,b)=>{a.rechargee=false;a.rechargements=0;
 const capture=a.capture.bind(a);a.capture=async e=>{const d=await capture(e);
  d.readStrategy={lecture:'rapide',attempts:['left','right'].map(side=>({side,attempt:1,status:'captured',regle:a.rechargee?'signal':'stabilite'}))};return d;};
 const ping=a.ping.bind(a);a.ping=async()=>{if(a.muet)throw Error('Adaptateur ESV sans réponse (simulé).');return ping();};
 b.ctx.chrome.tabs.reload=async id=>{a.rechargements++;a.muet=true;b.get('chargementEsvReset')();
  if(!jamaisPret)setTimeout(()=>{a.muet=false;a.rechargee=true;},muetMs);};};}
const REGLAGE=o=>b=>{b.ctx.BananeSettings={...b.ctx.BananeSettings,relectureSignalEteint:{lectures:3,delaiAvantMs:0,sondageMs:20,attenteRepriseMs:3000,silenceListeMs:0,attenteSansListeMs:0,...o}};};
const avec=(...f)=>(a,b)=>{for(const x of f)x(a,b);};
/* Attend une étape de `relecture-signal-eteint` (la reprise se fait hors de la passe en pause : finPasse rend la main dès la pause). */
async function etape(b,nom,ms=10000){const t=Date.now();for(;;){const e=H.evenements(b,'relecture-signal-eteint').find(x=>x.etape===nom);if(e)return e;
 if(Date.now()-t>ms)throw Error(`étape « ${nom} » absente : ${JSON.stringify(H.evenements(b,'relecture-signal-eteint').map(x=>[x.etape,x.motif]))} ; ${b.get('relecture').passe?.message}`);await H.attendre(20);}}

module.exports={esvSignal,REGLAGE,avec,etape};
