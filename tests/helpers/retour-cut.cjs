'use strict';
/* Retour à un cut (4.9) : ESV SIMULÉ autour de l'adaptateur réel en VM (helpers/page.cjs).
 * Données fictives ; aucun code ni contenu d'ESV. Le simulateur tient le cut affiché
 * (« Cut N of part P »), un jQuery minimal (`$`, `trigger`, `_data`) qui porte, sur
 * `#globalcontainer`, un écouteur simulé de l'événement interne de la carte, et les
 * boutons « cut précédent » / « cut suivant ». Il compte tout ce qui pourrait décider ou
 * déplacer un rail : validation, « suivant non validé », boutons de rail, touches, poses. */
const {page}=require('./page.cjs');
const simple=x=>x===undefined?x:JSON.parse(JSON.stringify(x));
function esv({part=23,cut=100,total=null,evenement=true,boutons=true,valides=[]}={}){
  const f=page(),label=f.nodes.get('O2N3DCutDescription'),etat={part,cut,valides:new Set(valides),illisible:false};
  const afficher=()=>{label.textContent=etat.illisible?'':`Cut ${etat.cut} of part ${etat.part}`;};afficher();
  const compte={evenements:[],precedent:0,suivant:0,valider:0,suivantNonValide:0,boutonsRail:0};
  /* Ce qui décide ou pose : compté, jamais attendu d'un retour à un cut. */
  const v=f.nodes.get('O2N3DCutValidate3DRail'),vc=v.click;v.click=()=>{compte.valider++;vc();};
  const n=f.nodes.get('O2N3DCutNextInvalid3DRail'),nc=n.click;n.click=()=>{compte.suivantNonValide++;nc();};
  for(const id of ['O2N3DCutLRClick','O2N3DCutRRClick']){const b=f.nodes.get(id),c=b.click;b.click=()=>{compte.boutonsRail++;c();};}
  /* Compteur « N on M treated » lisible seulement si `total` est donné (comme ki069-page-486). */
  if(Number.isInteger(total)){const txt={nodeValue:`${etat.valides.size} on ${total} treated`};txt.parentElement={textContent:txt.nodeValue,parentElement:null,checkVisibility:()=>true};
    f.ctx.NodeFilter={SHOW_TEXT:4};f.ctx.document.body={};f.ctx.document.createTreeWalker=()=>{let i=0;return {nextNode:()=>i++===0?txt:null};};}
  /* jQuery minimal : écouteurs par élément, `trigger` synchrone (un écouteur qui lève fait lever `trigger`). */
  const conteneur={id:'globalcontainer'};f.nodes.set('globalcontainer',conteneur);
  const ecouteurs=new Map([[conteneur,{}]]);
  const $=el=>({trigger(nom,args=[]){compte.evenements.push({nom,args:[...args],cible:el===conteneur?'globalcontainer':'autre'});
    for(const h of ecouteurs.get(el)?.[nom]||[])h({type:nom},...args);return this;}});
  $._data=(el,k)=>k==='events'?ecouteurs.get(el):undefined;$.fn={jquery:'3.x simulé'};f.ctx.$=$;
  /* Écouteur simulé de la carte : partie en TEXTE (sinon refus simulé), index = numéro du cut, hors partie : lève. */
  const carte={effet:null};
  const ecouteCarte=(e,p,i)=>{if(carte.effet)return carte.effet(etat,p,i,afficher);
    if(typeof p!=='string'||p!==String(etat.part))throw Error('clé de partie inconnue (simulé)');
    if(Number.isInteger(total)&&(i<0||i>=total))throw Error('index hors partie (simulé)');etat.cut=i;afficher();};
  if(evenement)ecouteurs.get(conteneur).railPairSelected=[ecouteCarte];
  const boutonsNav={precedent:{disabled:false,click(){compte.precedent++;etat.cut--;afficher();}},suivant:{disabled:false,click(){compte.suivant++;etat.cut++;afficher();}}};
  if(boutons){f.nodes.set('O2N3DCutPrevious3DRail',boutonsNav.precedent);f.nodes.set('O2N3DCutNext3DRail',boutonsNav.suivant);}
  const poses=()=>JSON.stringify([f.left.position,f.right.position,f.left.quaternion,f.right.quaternion]),posesAvant=poses();
  return {f,etat,compte,carte,afficher,boutons:boutonsNav,ecouteurs,conteneur,
    /* Copie hors du contexte VM : les comparaisons profondes ignorent alors le domaine d'origine. */
    aller:async(cible,options={},operationId=null)=>simple(await f.call('goToCut',cible,options,operationId)),
    /* Rien de décidé, rien de posé, aucune touche : l'invariant du retour à un cut. */
    intacts:()=>({valider:compte.valider,suivantNonValide:compte.suivantNonValide,boutonsRail:compte.boutonsRail,touches:f.keyboard.length,rails:poses()===posesAvant})};
}
const INTACTS={valider:0,suivantNonValide:0,boutonsRail:0,touches:0,rails:true};
module.exports={esv,INTACTS,simple};
