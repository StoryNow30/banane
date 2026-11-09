'use strict';
/* CH-093 — outils de maquette du passage à la relecture : copie de l'adaptateur patchée par chantiers/CH-093/adapter-page.patch (sur celle de CH-088,
 * ou sur le tronc qui la porte), et une séance « fin de lot → première coupe relue » (forme relevée d'ESV, modèle mémoire de Potree 1.8.2, voie
 * potree, réglage livré). Déroulé : la page va à la coupe de fin de lot (`fin`), dernière capture du lot, temps mort ; puis
 *  - `passe` = 0 : attente `avanceMs` (la préparation de la relecture), passage à la première coupe relue (`premiere`, loin derrière) ;
 *  - `passe` = n : n cuts de la passe des différés, proches de la fin du lot (passage, capture avec l'indice du service worker, temps mort), puis
 *    passage à la première coupe relue.
 * `anticiper` : vrai = ce chantier (commande `prechauffer` à la clôture du lot, `loin.mode` joint aux captures de la passe) ; faux = le tronc (aucune
 * commande, indices de la passe sans la première coupe relue). Les indices sont fabriqués par les VRAIES fonctions de background.js
 * (`avecPrechauffage`, `cibleLoinListe`), extraites comme dans tests/ch093-relais.test.cjs. Mesure : `ept-arrivee` de la maquette pour la première
 * coupe relue (nœuds connus de sa boîte, déjà chargés à l'affichage) et `ept-affiche` (« points affichés »). */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const N=require('./navigateur.cjs'),O77=require('./ch077-outils.cjs'),O88=require('./ch088-outils.cjs');
const LIVRE=require('../../src/settings.js').lot.chargement.prechauffer;
let copie=null;
function adaptateurCH093(){if(copie!==null)return copie;const base=O88.adaptateurCH088();if(base===null)return null;if(base.includes('PRECH_ANTICIPE'))return copie=base;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch093-m-'));fs.mkdirSync(path.join(dir,'src'));fs.writeFileSync(path.join(dir,'src/adapter-page.js'),base);
 const r=spawnSync('patch',['-s','-p1','-d',dir,'-i',path.join(N.racine,'chantiers/CH-093/adapter-page.patch')],{encoding:'utf8'});
 if(r.error?.code==='ENOENT')return null;if(r.status!==0)throw Error('le patch CH-093 ne s’applique plus : '+(r.stderr||r.stdout));
 return copie=fs.readFileSync(path.join(dir,'src/adapter-page.js'),'utf8');}
/* Fonctions du relais du service worker, telles qu'elles sont dans background.js, avec le réglage livré. */
function relais(){const SRC=N.lire('background.js'),a=SRC.indexOf('function avecPrechauffage('),b=SRC.indexOf('\n return null;}',SRC.indexOf('function cibleLoinListe('))+'\n return null;}'.length;
 const ctx={globalThis:{BananeCore3:{uid:()=>'op'},BananeSettings:{lot:{chargement:{prechauffer:LIVRE}}}}};vm.createContext(ctx);
 vm.runInContext(SRC.slice(a,b)+';this.f={avecPrechauffage,cibleLoinListe};',ctx);return ctx.f;}
const J=x=>JSON.parse(JSON.stringify(x));
async function seance({anticiper=true,passe=0,avanceMs=300,mortMs=400,latence=60,decode=40,cuts=255,pas=0.2,fin=350,premiere=225,part=23}={}){
 const O=require('./ch083-outils.cjs'),F=relais();
 const s=await O.ouvrir({voie:'potree',memoire:true,loin:true,saut:50,cuts,pas,decode,adaptateur:adaptateurCH093()});
 const env=s.env,page=s.page,journal=(type,cut)=>page.evaluate(([t,c])=>window.__maquette.journal.filter(e=>e.type===t&&e.cut===c),[type,cut]);
 const aller=async cut=>{const n0=(await journal('ept-affiche',cut)).length,t=Date.now(),r=await env.appel('goToCut',[{part,cut}]);if(r.error||r.result?.resultat!=='confirme')throw Error(`passage au cut ${cut} : ${r.error||JSON.stringify(r.result?.refusal||r.result?.resultat)}`);return {t,n0};};
 const affiche=async(cut,{t,n0})=>{const a=await O77.attendre(async()=>{const l=await journal('ept-affiche',cut);return l.length>n0?l.at(-1):null;},20000);return {afficheMs:Date.parse(a.at)-t,noeuds:a.noeuds};};
 const capturer=async(plus=x=>x)=>{await O77.attendre(()=>page.evaluate(()=>window.__maquette.etat().railsPrets));const st=(await env.appel('state')).result,c=await env.appel('capture',[plus(st)]);if(c.error)throw Error('capture : '+c.error);return st;};
 try{env.serveur.pannes({eptLatenceMs:latence});
  /* fin du lot : la page y va, charge sa boîte, dernière capture du lot (sans indice), temps mort (calcul, pose, validation) */
  await affiche(fin,await aller(fin));await capturer();await new Promise(r=>setTimeout(r,mortMs));
  /* clôture du lot : le service worker connaît la première coupe relue */
  let commande=null;const t0=Date.now();
  if(anticiper){const ping=(await env.appel('ping')).result;if(!ping.capacites.includes('prechauffer'))throw Error('la page n’annonce pas `prechauffer`');
   commande=(await env.appel('prechauffer',[{part,cut:premiere,source:'changement-mode'}])).result;}
  if(passe>0){const liste=Array.from({length:passe},(_,i)=>fin-2*(i+1));
   for(const [i,cut] of liste.entries()){await affiche(cut,await aller(cut));
    const loin=F.cibleLoinListe(cut,liste.slice(i+1),anticiper?premiere:undefined);
    await capturer(st=>J(F.avecPrechauffage(st,liste[i+1],'passe-differes',liste[i+2],loin)));await new Promise(r=>setTimeout(r,mortMs));}}
  else await new Promise(r=>setTimeout(r,avanceMs));
  const avanceReelleMs=Date.now()-t0;
  /* la relecture arrive sur sa première coupe : `ept-arrivee` est pris par la maquette à l'affichage du cut */
  const nav=await aller(premiere),aff=await affiche(premiere,nav),arrivee=(await journal('ept-arrivee',premiere)).at(-1)||null;
  await capturer();await new Promise(r=>setTimeout(r,200));
  const evts=await page.evaluate(()=>window.__evts.splice(0)),liberes=await page.evaluate(()=>window.__maquette.journal.filter(e=>e.type==='ept-libere').length);
  return {commande,avanceReelleMs,afficheMs:aff.afficheMs,arrivee,partArrivee:arrivee?.connus?Math.round(1000*arrivee.charges/arrivee.connus)/1000:null,liberes,
   evts,loin:evts.filter(e=>e.kind==='prechauffage-loin'),refus:env.serveur.journal.refusEpt||0,erreurs:env.erreurs.slice()};}
 finally{await s.fermer().catch(()=>{});}}
module.exports={adaptateurCH093,relais,seance};
