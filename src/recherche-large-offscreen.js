'use strict';
/* CH-041 — DOCUMENT HORS ÉCRAN de la recherche large (chantiers/CH-041/JOURNAL.md § 0.6, H3 ; offscreen-recherche-large.html, permission `offscreen`).
 * Le service worker n'a pas de `Worker` : ce document en ouvre quelques-uns (src/recherche-large-worker.js), se connecte au service worker par un port
 * `banane-recherche-large`, reçoit une capture et des graines (`calculer`), répartit les graines sur les fils, et rend l'union des relances (`resultat`) ou
 * une erreur (`erreur`). Il ne décide rien : la décision reste dans le service worker (`rechercheLargeCommande`). Pas de DOM, pas d'ESV, pas de stockage. */
(()=>{
 /* Nombre de fils : `?fils=N` de l'adresse du document (réglage `lot.rechercheLarge.fils`), 0 ou absent = cœurs moins un, plafonné à FILS_MAX. */
 const FILS_MAX=6,demande=Number(new URLSearchParams(location.search).get('fils'))||0,K=Math.max(1,Math.min(FILS_MAX,demande>0?demande:(navigator.hardwareConcurrency||2)-1));
 const fils=[];for(let i=0;i<K;i++)fils.push(new Worker('src/recherche-large-worker.js'));
 let seq=0;const attentes=new Map();
 for(const w of fils){w.onmessage=e=>{const m=e.data,a=m&&attentes.get(m.id);if(!a)return;attentes.delete(m.id);if(m.type==='erreur')a.reject(Error(m.message));else a.resolve(m);};
  w.onerror=e=>{for(const [id,a] of attentes)if(a.fil===w){attentes.delete(id);a.reject(Error('fil en erreur : '+(e&&e.message||'?')));}};}
 const demander=(w,msg)=>new Promise((resolve,reject)=>{const id=++seq;attentes.set(id,{resolve,reject,fil:w});w.postMessage({...msg,id});});
 const port=chrome.runtime.connect({name:'banane-recherche-large'});
 port.onMessage.addListener(async m=>{
  if(!m||m.type!=='calculer')return;
  const t0=performance.now();
  try{
   const g=Array.isArray(m.graines)?m.graines:[],lots=fils.map(()=>[]);g.forEach((x,i)=>lots[i%fils.length].push(x));
   const parts=await Promise.all(fils.map((w,i)=>lots[i].length?demander(w,{type:'relances',capture:m.capture,graines:lots[i],moteur:m.moteur||null}):{relances:[],ms:0}));
   port.postMessage({type:'resultat',id:m.id,relances:parts.flatMap(p=>p.relances),ms:Math.round(performance.now()-t0),filsMs:parts.map(p=>p.ms),fils:fils.length});
  }catch(e){port.postMessage({type:'erreur',id:m.id,message:String(e&&e.message||e).slice(0,160)});}
 });
})();
