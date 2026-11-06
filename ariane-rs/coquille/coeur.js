/* CH-064 : coquille du cœur WASM. Charge le module (octets ou base64), appelle une fonction du cœur avec une valeur JS
 * et rend une valeur JS, par le format VBA. Synchrone (utilisable dans un service worker après importScripts).
 *   const coeur=ArianeCoeur.creer(octets,{seuilReinstanciation}) ; coeur.appeler(n°, valeur) ; coeur.memoireOctets()
 * Mémoire (plan § D) : le Module compilé est gardé ; l'Instance est recréée dès que sa mémoire linéaire dépasse le seuil
 * après un appel (l'ancienne mémoire n'est plus référencée). Une erreur rendue par le cœur est relevée à l'identique. */
(function(root,factory){const api=factory(typeof module==='object'?require('./vba.js'):root.ArianeVba);if(typeof module==='object')module.exports=api;else root.ArianeCoeur=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Vba){
 'use strict';
 const CONSTRUCTEURS={Error,TypeError,RangeError};
 /* Le cœur ne sait pas reproduire cette entrée à l'identique : la façade doit rappeler le JS d'origine. */
 class HorsDomaine extends Error{constructor(m){super(m);this.name='HorsDomaine';}}
 /* Transcendantes : importées du moteur qui exécute (plan § 1), jamais calculées en Rust. */
 const IMPORTS={env:{js_sin:Math.sin,js_cos:Math.cos,js_tan:Math.tan,js_atan2:Math.atan2,js_exp:Math.exp,js_log:Math.log,js_log10:Math.log10,js_log1p:Math.log1p,js_pow:Math.pow}};
 function octetsDe(source){if(typeof source==='string'){const b=typeof atob==='function'?atob(source):Buffer.from(source,'base64').toString('binary');const o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o;}return source;}
 function creer(source,{seuilReinstanciation=64*1024*1024}={}){
  const module=source instanceof WebAssembly.Module?source:new WebAssembly.Module(octetsDe(source));
  let inst=null,ex=null,reinstanciations=0,hauteEau=0;
  const instancier=()=>{inst=new WebAssembly.Instance(module,IMPORTS);ex=inst.exports;};
  instancier();
  function appelerOctets(fonction,trame){
   const n=trame.length,p=ex.vba_reserver(n);
   new Uint8Array(ex.memory.buffer,p,n).set(trame);
   let m;
   try{m=ex.vba_appel(fonction,p,n);}catch(e){instancier();reinstanciations++;throw e;} // trappe (panique) : instance neuve
   const q=ex.vba_resultat();return {octets:new Uint8Array(ex.memory.buffer,q,m),liberer:()=>ex.vba_liberer_resultat()};
  }
  function apresAppel(){const t=ex.memory.buffer.byteLength;if(t>hauteEau)hauteEau=t;if(t>seuilReinstanciation){instancier();reinstanciations++;}}
  function appeler(fonction,valeur){
   const r=appelerOctets(fonction,Vba.encoder(valeur));let v;
   try{v=Vba.decoder(r.octets);}finally{r.liberer();}
   apresAppel();
   if(v&&v.__erreurVba===true){if(v.nom==='HorsDomaine')throw new HorsDomaine(v.message);const C=CONSTRUCTEURS[v.nom]||Error;throw new C(v.message);}
   return v;
  }
  return {appeler,appelerOctets,apresAppel,module,memoireOctets:()=>ex.memory.buffer.byteLength,etat:()=>({reinstanciations,hauteEau,memoire:ex.memory.buffer.byteLength})};
 }
 return {creer,IMPORTS,HorsDomaine};
});
