'use strict';
/* CH-071 : parité des quatre modules du lot 300–349 (file-parties, file-prioritaire, serie-captures-vides, raison-correction)
 * contre leur façade WASM (ariane-rs/coquille/facade-file.js). Trois sources de cas, dans l'ordre :
 *  1. RELEVÉ : chaque appel distinct fait par les essais du tronc qui chargent ces modules (tools/ch071-relever.cjs) ;
 *  2. RÉEL : banane-data (journaux : états de file rejoués sur les vraies suites d'événements, registres, fins de lot, points des
 *     captures d'un lot ; exports Écho : vrais événements de l'opérateur, intentions, identités des visites) ;
 *  3. VARIANTES : chaque cas relevé, une feuille remplacée par une valeur limite, à graine fixe (mulberry32).
 * Un cas porte sa trame VBA (base64) : les deux côtés décodent leur propre copie. La valeur comparée est {r, args, id} : le
 * rendu, les arguments APRÈS l'appel (écritures en place) et les identités que le JS garantit (état rendu tel quel, série
 * poussée = série rendue, raison posée = raison rendue, taux reçus, réglage gelé, collante et series modifiées en place). */
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8');
const Vba=require('../coquille/vba.js'),Facade=require('../coquille/facade-file.js');
const RACINE=path.resolve(__dirname,'..','..');
const SRC={parties:'src/file-parties.js',prioritaire:'src/file-prioritaire.js',serie:'src/serie-captures-vides.js',raison:'src/raison-correction.js'};
const M=Object.fromEntries(Object.entries(SRC).map(([k,f])=>[k,require(path.join(RACINE,f))]));
const NOMS={'file-parties':'parties','file-prioritaire':'prioritaire','serie-captures-vides':'serie','raison-correction':'raison'};
const RELEVE=path.join(RACINE,'ariane-rs','target','ch071-releve','releve.bin');

/* Joue un cas sur un jeu de modules (JS d'origine ou façade). Autonome : sérialisé tel quel dans la page Chromium. */
function jouer(Mod,e,V){
 const o=typeof Buffer!=='undefined'?Buffer.from(e.vba,'base64'):Uint8Array.from(atob(e.vba),c=>c.charCodeAt(0));
 const x=V.decoder(o),[m,f]=x.f.split('.'),args=x.args;
 if(x.juges)args[1]={...args[1],jugesDeja:new Set(x.juges)};
 const a0=args[0],c0=a0&&typeof a0==='object'?a0.collante:undefined,s0=a0&&typeof a0==='object'?a0.series:undefined,g0=a0&&typeof a0==='object'?a0.reglage:undefined;
 const r=Mod[m][f](...args),id={};
 if(m==='parties'&&(f==='transition'||f==='reprise'))id.meme=!!r&&r.etat===a0;
 if(m==='prioritaire'&&f==='ordonner')id.taux=r.taux===((args[1]&&args[1].taux)||Mod.prioritaire.TAUX_DEFAUT);
 if(m==='serie'&&f==='reglage')id.gele=Object.isFrozen(r);
 if(m==='serie'&&f==='creer')id.gele=Object.isFrozen(r.reglage);
 if(m==='serie'&&f==='observer')id.reglage=a0.reglage===g0;
 if(m==='raison'&&['finir','appuyer','heriter'].includes(f)&&a0&&typeof a0==='object'){id.collante=a0.collante===c0;id.series=a0.series===s0;
  const der=Array.isArray(a0.series)?a0.series[a0.series.length-1]:undefined;
  if(f==='finir')id.alias=r!==null&&r===der;if(f==='appuyer')id.alias=!!(r&&r.ferme)&&r.ferme===der;}
 if(m==='raison'&&(f==='appliquer'||f==='effacer')&&a0&&typeof a0==='object')id.pose=r===a0.raisonCorrection;
 if(x.juges)args[1]={...args[1],jugesDeja:[...args[1].jugesDeja]};
 return {r,args,id};
}

/* ---------------------------------------------------------------- fabrication des cas */
const b64=v=>Buffer.from(Vba.encoder(v)).toString('base64');
const compte={releve:0,releveNonEncodable:0,reel:0,variantes:0,variantesNonEncodables:0};
function cas(id,f,args,juges){try{return {id,entree:{vba:b64(juges?{f,args,juges}:{f,args})}};}catch{return null;}}
/* Copie JS fidèle pour avancer un rejeu (structuredClone garde −0, undefined et trous). */
const cl=v=>structuredClone(v);

function*releves(){
 if(!fs.existsSync(RELEVE))throw Error('relevé absent : lancer node tools/ch071-relever.cjs');
 const {lireReleve}=require('../../tools/ch071-relever.cjs');let n=0;
 for(const b of lireReleve(RELEVE)){const x=v8.deserialize(b);if(x.nonSerialisable||!NOMS[x.m]){compte.releveNonEncodable++;continue;}
  const f=NOMS[x.m]+'.'+x.f,args=x.args;let juges;
  if(x.f==='ordonner'&&args[1]&&args[1].jugesDeja instanceof Set){juges=[...args[1].jugesDeja].filter(s=>typeof s==='string');const {jugesDeja,...o}=args[1];args[1]=o;}
  const c=cas('releve-'+(++n)+'-'+f,f,args,juges);if(!c){compte.releveNonEncodable++;continue;}compte.releve++;yield {c,f,args,juges};}
}

/* Générateur pseudo-aléatoire à graine fixe. */
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const LIMITES=[undefined,null,true,false,0,-0,1,-1,1.5,2,20,1e7,1e8,NaN,Infinity,-Infinity,'','x','0','arret','lot','changement','fin-normale','toString','constructor','__proto__',
 'Digit1','Numpad0','keydown','VALIDATE','differe','vert','😀'.repeat(3),'é'.repeat(250),[],[1,,2],[3,1,3],{},{a:1},{toString:'x'}];
function feuilles(v,chemin=[],out=[]){if(v&&typeof v==='object'&&!(v instanceof Set)){const ks=Array.isArray(v)?[...v.keys()]:Object.keys(v);for(const k of ks)feuilles(v[k],[...chemin,k],out);if(chemin.length)out.push(chemin);}else if(chemin.length)out.push(chemin);return out;}
function*variantes(base,{par=3,graine=71}={}){const h=mulberry32(graine);let n=0;
 for(const {f,args,juges} of base){const fs_=feuilles(args);if(!fs_.length)continue;
  for(let k=0;k<par;k++){const a=cl(args),ch=fs_[Math.floor(h()*fs_.length)];let o=a;for(const p of ch.slice(0,-1))o=o[p];
   o[ch[ch.length-1]]=cl(LIMITES[Math.floor(h()*LIMITES.length)]);
   const c=cas('variante-'+(++n)+'-'+f,f,a,juges);if(!c){compte.variantesNonEncodables++;continue;}compte.variantes++;yield c;}}}

/* ---------------------------------------------------------------- données réelles */
function*reels({max=Infinity}={}){
 let corpus;try{corpus=require('../../tools/ch064-corpus.cjs');corpus.zips();}catch{return;}
 const P=M.parties,Q=M.prioritaire,S=M.serie,R=M.raison;let n=0,nj=0,ne=0;
 const un=(f,args,juges)=>{const c=cas('reel-'+(++n)+'-'+f,f,args,juges);if(c){compte.reel++;}return c;};
 for(const d of corpus.documents()){
  if(/journal-v4/.test(d.entree)){nj++;const j=JSON.parse(d.texte);
   /* registre réel : entrées une à une, puis ajouts successifs ; plages des cuts posés, validés, corrigés */
   const reg=j.fileParties?.registre||[];let acc=[];
   for(const x of reg){yield un('parties.entreeRegistre',[x]);yield un('parties.registreAjouter',[acc,x]);acc=P.registreAjouter(acc,x);
    for(const l of [x.poses,x.valides,x.passe,(x.corriges||[]).map(c=>c.cut)])yield un('prioritaire.plages',[l]);}
   /* vue réelle de la file (forme du panneau) passée aux lecteurs d'état ; bilan réel aux alertes */
   const vue=j.fileParties?.etat;
   if(vue){for(const f of ['vue','relire','repriseDe','actif','terminal'])yield un('parties.'+f,[vue]);
    const b=vue.bilan||[];for(let i=0;i<b.length;i++){yield un('parties.alertes',[b[i],b.slice(0,i)]);yield un('parties.alertes',[b[i],b.slice(0,i),{differesFoisMediane:0.5,corrigesPart:0,refus:0}]);}}
   /* fins de lot réelles, sous chaque état de clôture */
   for(const l of j.finsLot||[]){for(const etat of [l.etat,'STOPPED','COMPLETED','ERROR','FINISHED_WITH_UNCONFIRMED_ACTIONS','RUNNING'])
    for(const s of [null,{issue:l.motif},{reason:l.motif},{issue:'partie-sans-rouge'}])yield un('parties.classerLot',[{etat,stoppedAtEnd:s,arretOperateur:l.fin==='operateur',ecritureEnSuspens:false}]);}
   /* rejeu : la machine suit les vraies suites d'événements de la file (types, parties, motifs), le reste fabriqué de façon stable */
   const evs=(j.events||[]).filter(e=>e.type==='file-parties'),fins=j.finsLot||[];let etat=null,k=0,ifin=0;
   for(const e of evs){const t=e.evenement,at=e.timestamp;let ev;
    const lot='lot-'+nj+'-'+k,part=etat?.partie?.part;
    if(t==='demarrer'){const parts=[...new Set(evs.filter(x=>x.fileId===e.fileId&&Number.isInteger(x.part)).map(x=>x.part))];const plan=parts.length?parts:[1,2];
     ev={type:t,at,id:'file-'+nj+'-'+k,n:Math.min(plan.length,20),courante:plan[0],selecteur:{status:'ok',parts:plan.map(p=>({part:p}))},lotArgs:{endMode:'partie'}};}
    else if(t==='lot-demarre')ev={type:t,at,lotId:lot,part};
    else if(t==='lot-fin'){const fl=fins[ifin++]||{};ev={type:t,at,lotId:etat?.partie?.lotId,issue:fl.fin||'fin',motif:e.vers==='arret'?(e.motif||'refus-lot'):'fin-normale',
     resume:{traites:(fl.poses||0)+(fl.differes||0)+(fl.main||0),differes:fl.differes??null,ecritsPasse:fl.ecritsPasse??0,refus:0},detail:fl.motif||null};}
    else if(t==='passe-fin')ev={type:t,at,lotId:etat?.partie?.lotId,issue:'finie',ecrits:k%3};
    else if(t==='relecture-fin')ev={type:t,at,lotId:etat?.partie?.lotId,issue:'finie',corriges:k%7,faits:20+k,mode:'corriger'};
    else if(t==='changement-envoye')ev={type:t,at,vers:etat?.changement?.vers};
    else if(t==='changement-ok')ev={type:t,at,part:etat?.changement?.vers};
    else if(t==='changement-echec')ev={type:t,at,motif:e.motif,detail:'échec'};
    else ev={type:t,at};
    yield un('parties.transition',[etat,ev]);
    for(const c of [undefined,{at,ongletPresent:true,partieAffichee:etat?.changement?.vers},{at,ecritureEnSuspens:true},{at,ongletPresent:false},{at,lotFile:{id:'lot-r',rang:etat?.k,part}}])
     yield un('parties.reprise',c===undefined?[etat]:[etat,c]);
    const r=P.transition(etat,ev);etat=r.etat;k++;
    for(const f of ['vue','relire','repriseDe'])yield un('parties.'+f,[etat]);
    if(etat?.etat==='arret')yield un('parties.completerBilan',[etat,{lotId:etat.bilan.at(-1)?.lotId,passe:{issue:'finie',ecrits:2},relecture:{issue:'arretee',corriges:1,faits:4,mode:'corriger'}}]);}
   /* série de captures vides : points réels des captures d'un lot, dans l'ordre, sous trois réglages */
   const caps=(j.events||[]).filter(e=>e.type==='adapter-progress'&&e.lastDetail&&'points' in e.lastDetail).slice(0,6000);
   for(const reg of [{actif:true},{actif:true,seuil:1,reessaiApresCuts:2,attentesParEssai:2},{actif:true,rechargement:false,seuil:2}]){
    let s=S.creer(reg);yield un('serie.creer',[reg]);yield un('serie.reglage',[reg]);
    for(let i=0;i<caps.length;i++){const p=caps[i].lastDetail.points,cap=Number.isFinite(p)?{points:p}:null,ctx=i%5===1?{apresAttente:true}:i%11===3?{apresRechargement:true}:i%13===5?{apresAttente:true,rechargementPossible:false}:undefined;
     yield un('serie.observer',ctx===undefined?[cl(s),cap]:[cl(s),cap,ctx]);S.observer(s,cap,ctx);if(i%97===0)yield un('serie.bilan',[cl(s)]);}}
   /* file prioritaire : candidats bâtis sur les vrais cuts du registre (posés, validés, corrigés) */
   for(const x of reg){const cands=[...(x.poses||[]).map(c=>({part:x.part,cut:c,source:'posee'})),...(x.valides||[]).map((c,i)=>({part:x.part,cut:c,source:'vert',score:i%4===0?undefined:(i%7)/2})),
     ...(x.corriges||[]).map((c,i)=>({part:x.part,cut:c.cut,source:'differe',motif:i%3===0?'gauge-out-of-contract/gauge-out-of-contract':i%3===1?'input/input':'candidate/candidate'}))];
    const obs=(x.corriges||[]).map((c,i)=>({classe:Q.classe(cands[i%cands.length]||{}),informatif:Math.abs(c.ecartMm||0)>10,avecTraits:i%2===0,coutS:5+i%13}));
    yield un('prioritaire.apprendreTaux',[obs]);const T=Q.apprendreTaux(obs);
    for(const o of [undefined,{ordre:'balayage'},{critere:'avec-traits',plancherParMin:0},{taux:T,plancherParMin:1}])yield un('prioritaire.ordonner',o===undefined?[cands]:[cands,o]);
    yield un('prioritaire.ordonner',[cands,{}],cands.slice(0,10).map(c=>c.part+':'+c.cut));
    for(const c of cands.slice(0,50))yield un('prioritaire.classe',[c]);}
   if(n>=max)return;
  }
  if(/echo/.test(d.entree)){ne++;const j=JSON.parse(d.texte),ids=j.dictionaries?.identities||[];
   const ident=r=>{const x=r?.identity?.__ref;const i=x?Number(String(x).split(':')[1]):NaN;const v=ids[i];return v&&typeof v==='object'?{part:v.part,cut:v.cut}:{part:0,cut:r?.visitIndex??0};};
   let etat=R.nouvelEtat(ne%2?'chiffres':'pave');const visites=[];let seq=0;
   for(const r of j.records||[]){const evs=r.operatorEvents||[],id=ident(r);
    yield un('raison.autreGeste',[evs]);yield un('raison.heriter',[cl(etat),id]);R.heriter(etat,id);
    for(const ev of evs){for(const t of [undefined,'chiffres','alt-chiffres','pave'])yield un('raison.lireFrappe',t===undefined?[ev]:[ev,t]);
     if(ev.type!=='keydown')continue;yield un('raison.estTouchePossible',[ev.code]);
     const at=Date.parse(ev.observedAt||'');yield un('raison.derniereValidation',[r,at]);
     const v=R.derniereValidation(r,at);yield un('raison.delaiDeGrace',[v,at,500]);
     /* une frappe de raison fabriquée sur une vraie touche : chiffre tiré du code, cut et instant réels */
     const chiffre=(String(ev.code).charCodeAt(3)||0)%7,frappe=chiffre===0?{efface:true}:{code:['rail-voisin','adv','pn','nuage-pauvre','hauteur','autre'][chiffre-1],cutKey:id.part+':'+id.cut,at,part:id.part,cut:id.cut,poseeA:ev.observedAt,eventSeq:++seq};
     yield un('raison.appuyer',[cl(etat),frappe]);R.appuyer(etat,frappe);
     if(seq%3===0){yield un('raison.appuyer',[cl(etat),frappe]);R.appuyer(etat,frappe);}
     const vis={raisonCorrection:r.raisonCorrection||undefined};yield un('raison.appliquer',[vis,{code:frappe.code||null,source:'touche',serie:null,poseeA:ev.observedAt,eventSeq:seq,apresValidationMs:Number.isFinite(v)?at-v:null}]);}
    visites.push({identity:id,raison:etat.collante?.code??null});
    if(visites.length%17===0){yield un('raison.vue',[cl(etat),visites.slice()]);yield un('raison.resumeSeries',[cl(etat)]);}
    if(visites.length%53===0){yield un('raison.finir',[cl(etat),'pause']);R.finir(etat,'pause');}}
   yield un('raison.vue',[cl(etat),visites]);yield un('raison.resumeSeries',[cl(etat)]);yield un('raison.finir',[cl(etat),'fin-seance']);
   if(n>=max)return;
  }}
}

let facade=null;
const fac=coeur=>facade&&facade.coeur===coeur?facade.f:(facade={coeur,f:Facade.creer(coeur,M)}).f;
module.exports={nom:'file',description:'lot 300–349 : file-parties, file-prioritaire, serie-captures-vides, raison-correction',sources:Object.values(SRC),
 *cas({max=Infinity}={}){const base=[];
  for(const x of releves()){base.push(x);yield x.c;}
  for(const c of reels({max}))if(c)yield c;
  yield*variantes(base);},
 compte:()=>({...compte}),
 js(e){return jouer(M,e,Vba);},
 rs(e,coeur){return jouer(fac(coeur),e,Vba);},
 bilan:()=>({...(facade?facade.f.compteurs():{}),...compte}),
 navigateur:{scripts:[...Object.values(SRC),'ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-file.js'],
  preparer:'coeur=>{const M={parties:BananeFileParties,prioritaire:ArianeFilePrioritaire,serie:BananeSerieCapturesVides,raison:BananeRaisonCorrection};return {M,f:ArianeFacadeFile.creer(coeur,M),jouer:('+jouer.toString()+')};}',
  js:'(e,t)=>t.jouer(t.M,e,ArianeVba)',rs:'(e,t)=>t.jouer(t.f,e,ArianeVba)',bilan:'t=>t.f.compteurs()'}};
