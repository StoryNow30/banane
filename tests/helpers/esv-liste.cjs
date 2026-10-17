'use strict';
/* Test 7, suite 2 — ESV SIMULÉ AVEC SA LISTE DE COUPES, pour les essais « départ sur un cut vert » et le banc qui les compare
 * à la base. Service worker réel en VM, moteur et GCV1 réels (tests/helpers/pilote-lot.cjs). Données synthétiques.
 * La liste est un tableau de statuts indexé par numéro de cut (une partie de M cuts). Comme la maquette d'ESV
 * (branche `claude/esv-locale-audit`, `esv-maquette.js`) :
 *  - « valider et suivant » écrit `valid` puis charge le cut non validé suivant (statut ≠ valid) APRÈS le cut, sinon la
 *    partie suivante ;
 *  - « cut non validé suivant » (`nextWithoutDecision`, Maj+Z) charge le cut non validé suivant, sans écrire ; s'il n'y en
 *    a pas, le bouton est désactivé : refus, rien ne part ;
 *  - Ctrl+Entrée (valider sur place) écrit `valid` sans changer de cut ;
 *  - le compteur « N on M treated » (N = cuts non `invalid`) est relevé après chaque capture ;
 *  - la page rend sa table (`liste-instantane`, statuts 0 valid, 1 invalid, 2 skipped, 3 autre) et la fenêtre de voisins
 *    (`b1-voisins`) en mémoire, sans requête.
 * `ecritures` : chaque commande reçue par ESV (nom, cut, arguments neutralisés), lectures exclues. */
const K=require('../../src/core.js'),L=require('../../src/lot-decision.js'),B=require('../../src/appuis-liste.js');
const {pilote,releveBrut}=require('./dernier-cut.cjs');
const CODE={valid:0,invalid:1,skipped:2,autre:3},LECTURES=new Set(['capture']);
const neutre=x=>JSON.parse(JSON.stringify(x??null).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>')
 .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g,'<heure>'));
/* Statuts d'une partie de `m` cuts : `rouges` invalid, `passes` skipped, le reste valid. */
const partie=(m,{rouges=[],passes=[]}={})=>Array.from({length:m},(_,i)=>rouges.includes(i)?'invalid':passes.includes(i)?'skipped':'valid');
/* `liste` : statuts ; `depart` : cut affiché au démarrage ; `fin` : dernier cut du lot (null : fin de partie) ;
 * `table` : la page rend sa table (false : pas de réponse) ; `releve` : compteur relevé après chaque capture. */
async function lotListe({liste,depart,fin=null,part=23,table=true,releve=true,pageTables=null}={}){
 const st=[...liste],M=st.length,trace=[],lectures=[];let esv=null;
 const prochain=c=>{for(let i=c+1;i<M;i++)if(st[i]!=='valid')return i;return -1;};
 const r=await pilote(L,{start:depart,end:fin===null?0:fin,...(fin===null?{endMode:'partie'}:{}),globals:{BananeAppuisListe:B},esv:(e,b)=>{esv=e;e.identity.cut=depart;e.identity.part=part;
  const aller=(p,c)=>{e.identity={...e.identity,part:p,cut:c};e.rails=JSON.parse(JSON.stringify(require('../fixtures.cjs').base.rails));};
  const suivantApresEcriture=()=>{const i=prochain(e.identity.cut);if(i>=0)aller(part,i);else aller(part+1,0);};
  const preuve=(avant,nav)=>({commandSent:true,afterObserved:true,afterStateStatus:'OBSERVED_SAME_TARGET',afterState:avant,navigationObserved:nav,serverConfirmed:false,
   nextIdentity:nav?K.clone(e.identity):null,navigationAfter:nav?{identity:K.clone(e.identity)}:null});
  e.validateAndNext=async function(){this.calls.push('validate');const avant=await this.state();st[this.identity.cut]='valid';suivantApresEcriture();return preuve(avant,true);};
  e.skipAndNext=async function(){this.calls.push('skip');const avant=await this.state();st[this.identity.cut]='skipped';suivantApresEcriture();return preuve(avant,true);};
  e.next=async function(){this.calls.push('next');aller(this.identity.part,this.identity.cut+1);return this.state();};
  const sansDecision=e.nextWithoutDecision.bind(e);
  e.nextWithoutDecision=async function(identity,scope,op){const i=prochain(this.identity.cut);
   if(i<0){this.deferOutcome='unavailable';const r=await sansDecision(identity,scope,op);this.deferOutcome='navigate';return r;}
   this.deferIdentity={...this.identity,cut:i};const r=await sansDecision(identity,scope,op);this.deferIdentity=null;return r;};
  e.validateInPlace=async function(identity){this.calls.push('validateInPlace');const avant=await this.state(),c={traites:st.filter(x=>x!=='invalid').length,total:M};
   st[this.identity.cut]='valid';
   return {format:'banane-validate-in-place-v1',operatorDecision:'VALIDATE',command:'ctrl-entrée',commandSent:true,decisionCommand:{id:'Ctrl+Enter',exists:true,disabled:false},
    afterObserved:true,afterState:avant,afterStateStatus:'OBSERVED_SAME_TARGET',beforeNavigationIdentity:K.completeIdentity(identity),navigationObserved:false,serverConfirmed:true,
    nextIdentity:null,compteurAvant:c,compteurApres:{traites:c.traites+1,total:M}};};
  if(releve){const capturer=e.capture.bind(e);
   e.capture=async function(...a){const out=await capturer(...a);
    await releveBrut(b,{requestId:'r-'+this.identity.cut,at:new Date().toISOString(),identity:{pageId:this.identity.pageId,part:this.identity.part,cut:this.identity.cut},
     compteur:{traites:st.filter(x=>x!=='invalid').length,total:M}});return out;};}
  for(const a of ['apply','restore','validateAndNext','validateInPlace','next','nextWithoutDecision','skipAndNext']){const f=e[a].bind(e);
   e[a]=async(...x)=>{trace.push(neutre({a,cut:e.identity.cut,x}));return f(...x);};}
  const envoyer=b.ctx.chrome.tabs.sendMessage;
  b.ctx.chrome.tabs.sendMessage=async(id,m)=>{
   if(m?.kind==='liste-instantane'){lectures.push('liste');if(!table)throw Error('page sans réponse');
    return JSON.parse(JSON.stringify(pageTables?pageTables(st):{ok:true,tables:[{key:'traj',debut:true,rompue:false,tronquee:false,st:st.map(x=>CODE[x]),fl:st.map(()=>0),ed:[]}]}));}
   if(m?.kind==='b1-voisins'){lectures.push('voisins');if(!table)throw Error('page sans réponse');const c=m.cut;
    return {ok:true,table:{lignes:M,pages:1,fraiches:0,debut:true,rompue:false,tronquee:false,tables:1},geo:{index:c,mm:0,secondMm:null},
     rows:[c-1,c,c+1].filter(i=>i>=0&&i<M).map(i=>({i,s:st[i],t:false,v:false,f:false,e:null}))};}
   return envoyer(id,m);};}});
 let view=await r.b.settle();
 /* Le passage au premier rouge se fait après la boucle du moteur : on attend que le lot reparte puis se termine. */
 for(let k=0;k<200&&(view.batch?.departSurVert?.phase==='navigation'||view.batch?.state==='RUNNING');k++){await new Promise(x=>setTimeout(x,5));view=await r.b.settle();}
 const calls=[...r.b.adapter.calls];
 return {view,trace,lectures,calls,ecritures:calls.filter(c=>!LECTURES.has(c)),statuts:st,b:r.b,esv};}
module.exports={lotListe,partie,neutre};
