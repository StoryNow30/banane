/* CH-061, postes « état et sauvegarde », « export Écho et zip », « traversée JS ↔ WASM », dans Chromium.
 * Entrée : un vrai journal de lot du 05/11 (JSON, ~75 Mo) lu dans le zip de banane-data, jamais copié dans le dépôt.
 * Mesures : JSON.parse/stringify de V8 contre serde_json en WASM (traversée UTF-8 comprise) ; zip-writer.js d'origine de bout
 * en bout ; CRC-32 JS contre Rust ; CompressionStream('deflate-raw') contre miniz_oxide en WASM ; état réel (champ `state`) :
 * JSON.stringify et structuredClone ; appel vide et copie mémoire. Résultat : resultats/banc-export.json. */
'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {RACINE}=require('./charger-sw.cjs'),{zips}=require('./nuages.cjs'),{navigateur,page}=require('./chromium.cjs');
const WASM=path.join(__dirname,'../rust/target/wasm32-unknown-unknown/release/ariane_noyau.wasm');
(async()=>{
  const z=zips().find(f=>/volume01-sur09/.test(f));const nom=execFileSync('unzip',['-Z1',z],{encoding:'utf8'}).split('\n').find(n=>/journal-v4-.*\.json$/.test(n));
  const texte=execFileSync('unzip',['-p',z,nom],{maxBuffer:1<<30});
  const nav=await navigateur();const p=await page(nav,[fs.readFileSync(path.join(RACINE,'src/zip-writer.js'),'utf8')]);
  await p.evaluate(b=>WebAssembly.instantiate(new Uint8Array(b)).then(({instance})=>{globalThis.X=instance.exports;}),[...fs.readFileSync(WASM)]);
  /* Le journal passe en morceaux de 8 Mo (limite des messages du protocole). */
  await p.evaluate(()=>{globalThis.__morceaux=[];});
  for(let i=0;i<texte.length;i+=8<<20)await p.evaluate(b64=>{const s=atob(b64),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);__morceaux.push(u);},texte.subarray(i,i+(8<<20)).toString('base64'));
  const r=await p.evaluate(async()=>{
    const med=async (f,n=5)=>{const t=[];for(let i=0;i<n;i++){const a=performance.now();await f();t.push(performance.now()-a);}t.sort((x,y)=>x-y);return +t[t.length>>1].toFixed(1);};
    const octets=new Uint8Array(__morceaux.reduce((s,m)=>s+m.length,0));{let o=0;for(const m of __morceaux){octets.set(m,o);o+=m.length;}}
    const txt=new TextDecoder().decode(octets);let obj;
    const out={journalOctets:octets.length};
    out.v8={jsonParseMs:await med(()=>{obj=JSON.parse(txt);},3),jsonStringifyMs:await med(()=>JSON.stringify(obj),3),
      encodeUtf8Ms:await med(()=>new TextEncoder().encode(txt),3)};
    /* serde_json : texte UTF-8 copié dans la mémoire WASM, analysé, réécrit, relu en chaîne JS. */
    const n=octets.length,pe=X.reserver(n),ps=X.reserver(n+(n>>2));
    let lg=0;
    out.wasm={copieEntreeMs:await med(()=>{new Uint8Array(X.memory.buffer,pe,n).set(octets);},3),
      serdeAllerRetourMs:await med(()=>{lg=X.json_aller_retour(pe,n,ps,n+(n>>2))>>>0;},3),
      decodeSortieMs:await med(()=>new TextDecoder().decode(new Uint8Array(X.memory.buffer,ps,lg)),3),
      memoireLineaireOctets:X.memory.buffer.byteLength};
    out.wasm.totalAvecTraverseeMs=+(out.v8.encodeUtf8Ms*0+out.wasm.copieEntreeMs+out.wasm.serdeAllerRetourMs+out.wasm.decodeSortieMs).toFixed(1);
    out.wasm.sortieIdentiqueAuStringifyV8=lg>0?new TextDecoder().decode(new Uint8Array(X.memory.buffer,ps,lg))===JSON.stringify(JSON.parse(txt)):null;
    X.liberer(ps,n+(n>>2));
    /* CRC-32 */
    const jsCrc=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[i]=c>>>0;}
      return u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=t[(c^u[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};})();
    let c1,c2;out.crc32={jsMs:await med(()=>{c1=jsCrc(octets);},3),wasmMs:await med(()=>{c2=X.crc32(pe,n,0)>>>0;},3)};out.crc32.identique=c1===c2;
    /* Deflate */
    const flux=async()=>{const s=new Blob([octets]).stream().pipeThrough(new CompressionStream('deflate-raw'));return (await new Response(s).arrayBuffer()).byteLength;};
    let tz=0;out.deflate={compressionStreamMs:await med(async()=>{tz=await flux();},3)};out.deflate.compressionStreamOctets=tz;
    const cap=n+(n>>3)+1024,pz=X.reserver(cap);let lz=0;
    for(const niv of [1,6]){out.deflate['minizNiveau'+niv+'Ms']=await med(()=>{lz=X.deflate_brut(pe,n,niv,pz,cap)>>>0;},3);out.deflate['minizNiveau'+niv+'Octets']=lz;}
    X.liberer(pz,cap);X.liberer(pe,n);
    /* zip-writer.js de bout en bout (journal seul, deflate) */
    out.zipWriterMs=await med(async()=>{const zz=BananeZip.createZip();await zz.ajouter('journal.json',new Blob([octets]));zz.terminer();},3);
    out.zipWriterApi=Object.keys(BananeZip);
    /* État réel du journal (champ state) : ce que save() sérialise */
    const st=obj.state;const sj=JSON.stringify(st);
    out.etat={octetsJson:sj.length,stringifyMs:await med(()=>JSON.stringify(st),9),structuredCloneMs:await med(()=>structuredClone(st),9),parseMs:await med(()=>JSON.parse(sj),9)};
    /* Traversée */
    let a=0;const t0=performance.now();for(let i=0;i<1e6;i++)a+=X.vide(i);const vide=(performance.now()-t0)/1e6*1e6;
    const f=(x)=>x;let b=0;const t1=performance.now();for(let i=0;i<1e6;i++)b+=f(i);const vjs=(performance.now()-t1)/1e6*1e6;
    const M=new Float64Array(1<<20).map((_,i)=>i),pm=X.reserver(8<<20);
    const cp=await med(()=>{new Float64Array(X.memory.buffer,pm,1<<20).set(M);},9);
    const pts=Array.from({length:3500},(_,i)=>[i*1e-3,i*2e-3,i*3e-3]);
    const conv=await med(()=>{const D=new Float64Array(X.memory.buffer,pm,3*3500);let o=0;for(const q of pts){D[o++]=q[0];D[o++]=q[1];D[o++]=q[2];}},51);
    X.liberer(pm,8<<20);
    out.traversee={appelVideNs:+vide.toFixed(1),appelJsVideNs:+vjs.toFixed(1),copie8MoMs:cp,conversion3500PointsTableauxVersWasmMs:conv,controle:a===b};
    return out;});
  console.log(JSON.stringify(r,null,1));await nav.close();
  fs.writeFileSync(path.join(__dirname,'../resultats/banc-export.json'),JSON.stringify({date:new Date().toISOString(),...r},null,1));
})();
