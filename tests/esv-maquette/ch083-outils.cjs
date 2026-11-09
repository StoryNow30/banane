'use strict';
/* CH-083 (D-314) — séance de maquette pour l'essai navigateur (tests/esv-maquette/ch083-memoire.test.cjs) et le banc (tools/ch083-banc.cjs).
 * Maquette en forme RELEVÉE d'ESV (nœud commun, EPT laszip, hiérarchie lue d'avance), avec le MODÈLE MÉMOIRE de Potree 1.8.2 (`eptMemoire=1` : load(),
 * maxNodesLoading 4, montée de 2 nœuds par image, LRU, pointLoadLimit), saut de 50 coupes, réglage livré (boîte, horizon 2) avec ou sans la phase mémoire.
 * Une transition : capture du cut affiché (le préchauffage part à la fin), pose, temps mort, relevé de la mémoire de la coupe EN COURS (avant et après le
 * préchauffage), validation, puis « points affichés » de la coupe suivante (`ept-affiche` : tous les nœuds de sa boîte montés). */
const N=require('./navigateur.cjs'),O77=require('./ch077-outils.cjs'),O80=require('./ch080-outils.cjs');
const LIVRE=require('../../src/settings.js').lot.chargement.prechauffer;
async function ouvrir({memoire=true,prechauffer=true,saut=50,limite=null,decode=40,voie='fetch',auth=false,grappe=1,loin=false,adaptateur=null,cuts=null,pas=null}={}){   /* CH-088 : `grappe` (coupes d'affilée avant le saut), `loin` (opération lointaine), `adaptateur` (copie patchée) */   /* CH-085 : `voie` ('fetch' ou 'potree'), `auth` : le serveur exige l'en-tête du Potree simulé */
 const reglage={...LIVRE,voie/* CH-083 : phase mémoire de la voie fetch ; CH-085 : voie potree */,memoire:{...LIVRE.memoire,actif:memoire},loin:{...LIVRE.loin,actif:loin}};
 const s=await O77.ouvrir({prechauffer,reglage,maquette:{cuts:cuts??2*saut+1,saut,...(grappe>1?{grappe}:{}),...(pas?{pas}:{}),eptHier:1,eptForme:'commun',eptPas:7,eptMemoire:1,eptDecode:decode,...(auth?{eptAuth:1}:{})},adaptateur:adaptateur??O80.adaptateurCH080()});
 const page=s.env.page;if(auth)s.env.serveur.pannes({eptAuth:true});
 if(limite!==null)await page.evaluate(l=>{window.Potree.pointLoadLimit=l;},limite);
 const journal=(type,cut)=>page.evaluate(([t,c])=>window.__maquette.journal.filter(e=>e.type===t&&(c===undefined||e.cut===c)),[type,cut]);
 const memoireEpt=()=>page.evaluate(()=>window.__memoireEpt());
 async function transition({mortMs=900}={}){
  const env=s.env,st=(await env.appel('state')).result,cut=st.identity.cut,refus0=env.serveur.journal.refusEpt||0;
  const t0=Date.now(),c=await env.appel('capture',[st]);if(c.error)throw Error('capture : '+c.error);const captureMs=Date.now()-t0;
  const avant=await memoireEpt(),finCapture=Date.now();
  const a=await env.appel('apply',[st,{left:{delta:[0,-.002,.001]},right:{delta:[0,.002,-.001]}}]);if(a.error)throw Error('pose : '+a.error);
  const reste=mortMs-(Date.now()-finCapture);if(reste>0)await new Promise(r=>setTimeout(r,reste));
  const apres=await memoireEpt();
  const s2=(await env.appel('state')).result,t=Date.now();
  const v=await env.appel('validateAndNext',[s2.identity,{part:st.identity.part,end:st.identity.cut+100}]);if(v.error)throw Error('validation : '+v.error);
  const suivant=v.result.nextIdentity?.cut;
  const aff=await O77.attendre(async()=>(await journal('ept-affiche',suivant)).at(-1)||null,20000);
  const arrivee=(await journal('ept-arrivee',suivant)).at(-1)||null,liberes=await journal('ept-libere');
  const evts=await page.evaluate(()=>window.__evts.splice(0));
  return {cut,suivant,afficheMs:Date.parse(aff.at)-t,chaineMs:aff.ms,noeudsAffiches:aff.noeuds,arrivee,avant,apres,liberes:liberes.length,liberesCourant:liberes.filter(x=>x.courant).length,captureMs,refus:(env.serveur.journal.refusEpt||0)-refus0,evts};}
 return {...s,transition,memoireEpt,page};}
module.exports={ouvrir};
