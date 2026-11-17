/* Test 17 (D-232 à D-234) — PAUSE ET REPRISE DE LA RELECTURE, partie panneau. Module à part : `src/carte-relecture.js` (carte « Relecture après le lot »)
 * reste tel quel ; celui-ci tient ses propres éléments dans la même carte (`#relecture-pause-*`) et ne parle au service worker que par ses actions
 * (`relecture-etat`, `relecture-pause`, `relecture-reprendre`, `relecture-arreter`, `relecture-pause-reglage`).
 *  - « Pause » : visible pendant la passe quand le réglage est allumé ; « Pause demandée… » tant que la passe finit son étape ;
 *  - « Reprendre la relecture » et « Arrêter la relecture » : pendant la pause ; la reprise est grisée tant qu'ESV ne répond pas (raison écrite) ;
 *  - réglage : « Pause et reprise de la relecture » (éteint par défaut) et « Si ESV est rechargé pendant la relecture » (mettre en pause, ou arrêter).
 * Aucune commande vers ESV, aucun export : tout passe par le service worker. `etat()` rend le dernier état lu, pour la nouvelle présentation (src/ui5.js). */
(function(root){'use strict';
 const $=id=>typeof document!=='undefined'?document.getElementById(id):null;
 const api=async(action,args={})=>{const r=await chrome.runtime.sendMessage({kind:'panel',action,args});if(!r)throw Error('Ariane ne répond pas. Rouvre la fenêtre.');if(r.error)throw Error(r.error);return r.result;};
 let etat=null,minuterie=null;
 /* CH-133 : ce que l'opérateur a écrit dans « Du cut » / « Au cut » (`saisie`), rempli des bornes proposées à chaque nouvel arrêt ou nouvelle pause (`cleSaisie`). */
 let saisie={du:'',au:''},cleSaisie='',refusBornes='';   /* refusBornes : le dernier refus du service worker, dit sous les champs */
 const pluriel=(n,mot)=>`${n} ${mot}${n>1?'s':''}`;
 const muet=()=>{try{return root.ArianePanel?.state?.()?.connection?.status==='unavailable';}catch{return false;}};
 const dire=t=>{const l=$('relecture-pause-note');if(l){l.hidden=!t;l.textContent=t||'';}};
 /* CH-133 (D-366, D-367) — BORNES DE LA RELECTURE : en pause, et après un arrêt (défaut, arrêt demandé) ou une fin, sur le lot affiché et clos,
  * deux champs « Du cut » / « Au cut » et « Reprendre du cut A au cut B » (action `relecture-reprendre`) ou « Relancer du cut A au cut B »
  * (`relecture-lancer`), avec {debut, fin}. Jamais tant qu'une correction interrompue attend « J'ai contrôlé le cut N », ni relecture coupée.
  * Le service worker refait tous les contrôles et dit son refus en clair. */
 const CLOS=['STOPPED','COMPLETED'];
 const NOTE_BORNES='Les cuts hors des bornes ne sont ni relus ni corrigés : ils sont comptés « non relus ».';
 function bornesVue(e,{esvMuet,saisie:sa,refus}){const p=e?.passe,B=p?.bornesProposees;if(!p||!B)return null;
  let action=null;
  if(p.etat==='en-pause')action='reprendre';
  else if(['arretee','erreur','finie'].includes(p.etat)&&e?.lot?.id===p.lotId&&e.lot.mode!=='coupee'&&CLOS.includes(e.lot.etat)&&!e.correctionInterrompue)action='relancer';
  if(!action)return null;
  const lire=(x,d)=>x==null?String(d):String(x).trim(),du=lire(sa?.du,B.debut),au=lire(sa?.au,B.fin),d=Number(du),f=Number(au);
  const ok=du!==''&&au!==''&&Number.isInteger(d)&&Number.isInteger(f)&&d>=0&&f>=0,T=Number.isInteger(p.totalPartie)?p.totalPartie:null;
  /* Une saisie hors de la partie ou non entière n'est pas une erreur : une ligne sobre sous les champs le dit, le bouton attend. */
  const hors=ok&&T!==null?[d,f].find(x=>x>T-1):undefined;
  const raison=du===''||au===''?'Écris le cut de départ et le cut de fin.':!Number.isFinite(d)||!Number.isFinite(f)||d<0||f<0||!ok?'Les cuts s’écrivent en nombres entiers.'
   :d>f?'Le cut de départ doit être avant le cut de fin.':hors!==undefined?`Le cut ${hors} est hors de la partie (cuts 0 à ${T-1}).`:esvMuet&&action==='reprendre'?'Disponible quand ESV répond.':'';
  const texte=`${action==='reprendre'?'Reprendre':'Relancer'} du cut ${ok?d:'…'} au cut ${ok?f:'…'}`;
  return {action,debut:ok?d:null,fin:ok?f:null,texte,actif:!raison,raison:raison||String(refus||''),note:NOTE_BORNES,...(action==='relancer'?{ligne:String(p.message||''),etat:p.etat}:{})};}
 /* Ce que le panneau montre pour une passe donnée : {pause, reprendre, arreter, texte, bornes}. Pure : essayée sans navigateur. */
 function vue(e,{esvMuet=false,saisie:sa=null,refus=''}={}){const p=e?.passe,actif=e?.repriseReglage?.actif===true;
  const sortie={pause:null,reprendre:null,arreter:false,ligne:'',bornes:null,raisonPause:null};
  if(!p)return sortie;
  sortie.bornes=bornesVue(e,{esvMuet,saisie:sa,refus});
  if(p.etat==='en-cours'&&p.reprise===true&&actif)sortie.pause=p.pauseDemandee?{texte:'Pause demandée…',actif:false}:{texte:'Pause',actif:true};
  if(p.etat==='en-pause'){
   sortie.reprendre=esvMuet?{texte:'Reprendre la relecture',actif:false,raison:'Disponible quand ESV répond.'}:{texte:`Reprendre la relecture${p.cut!=null?' au cut '+p.cut:''}`,actif:true,raison:''};
   sortie.arreter=true;sortie.raisonPause=p.pauseRaison??null;
   /* CH-107 : « points » : ESV n'affiche plus les points (série de cuts vides) ; la relecture est gardée au premier cut vide de la série. */
  sortie.ligne=`${p.pauseRaison==='esv'?'ESV ne répond plus : relecture gardée en pause':p.pauseRaison==='redemarrage'?'Relecture gardée en pause (Ariane a redémarré)':p.pauseRaison==='points'?'ESV n’affiche plus les points : relecture gardée en pause':'Relecture en pause'} au cut ${p.cut??'?'} · ${pluriel(p.faits,'cut')} relu${p.faits>1?'s':''} sur ${p.total}${p.expire?' · gardée jusqu’à '+new Date(p.expire).toLocaleString('fr-FR',{timeZone:'Europe/Paris'/* CH-097 : l'heure de Paris partout, jamais celle de la machine */,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''}.`;}
  return sortie;}
 /* CH-133 : nouvel arrêt ou nouvelle pause : les champs reprennent les bornes proposées. */
 function saisieSuivre(){const p=etat?.passe,B=p?.bornesProposees,cle=p&&B?`${p.lotId}|${p.etat}|${p.debut}|${p.cut}|${B.debut}|${B.fin}`:'';
  if(cle===cleSaisie)return;cleSaisie=cle;refusBornes='';saisie={du:B?String(B.debut):'',au:B?String(B.fin):''};
  for(const [id,v] of [['relecture-du',saisie.du],['relecture-au',saisie.au]]){const el=$(id);if(el)el.value=v;}}
 function afficher(){
  saisieSuivre();
  const v=vue(etat,{esvMuet:muet(),saisie,refus:refusBornes}),p=etat?.passe;
  const pause=$('relecture-pause');if(pause){pause.hidden=!v.pause;if(v.pause){pause.textContent=v.pause.texte;pause.disabled=!v.pause.actif;}}
  const rep=$('relecture-reprendre');if(rep){rep.hidden=!v.reprendre;if(v.reprendre){rep.textContent=v.reprendre.texte;rep.disabled=!v.reprendre.actif;rep.title=v.reprendre.raison;}}
  const arr=$('relecture-arreter-pause');if(arr)arr.hidden=!v.arreter;
  const l=$('relecture-pause-ligne');if(l){l.hidden=!v.ligne;l.textContent=v.ligne;}
  const zb=$('relecture-bornes-zone');if(zb)zb.hidden=!v.bornes;
  const gb=$('relecture-bornes');if(gb&&v.bornes){gb.textContent=v.bornes.texte;gb.disabled=!v.bornes.actif;gb.title=v.bornes.raison;}
  const note=$('relecture-pause-raison');if(note){note.hidden=!(v.reprendre&&!v.reprendre.actif);note.textContent=v.reprendre?.raison||'';}
  const g=etat?.repriseReglage,act=$('relecture-pause-actif'),f5=$('relecture-f5');
  const vivante=p&&['preparation','en-cours','en-pause'].includes(p.etat);
  if(act&&document.activeElement!==act){act.checked=g?.actif===true;act.disabled=!!vivante;}
  if(f5&&document.activeElement!==f5){f5.value=g?.f5==='arret'?'arret':'pause';f5.disabled=!!vivante||g?.actif!==true;}
  clearTimeout(minuterie);minuterie=setTimeout(rafraichir,p&&(p.etat==='en-cours'||p.etat==='en-pause')?1500:5000);}
 async function rafraichir(){try{etat=await api('relecture-etat');}catch{/* panneau fermé ou service worker en veille */}afficher();}
 async function agir(action,args,bouton){if(bouton)bouton.disabled=true;dire('');try{await api(action,args);}catch(e){dire(e.message);}await rafraichir();}
 function brancher(){if(!$('relecture-pause-zone'))return;
  const pause=$('relecture-pause');if(pause)pause.onclick=()=>agir('relecture-pause',{},pause);
  const rep=$('relecture-reprendre');if(rep)rep.onclick=()=>agir('relecture-reprendre',{},rep);
  const arr=$('relecture-arreter-pause');if(arr)arr.onclick=()=>agir('relecture-arreter',{},arr);
  /* CH-133 : la saisie des bornes (tapée ici, ou recopiée par Signal) ; le bouton envoie {debut, fin} à l'action de l'état affiché. */
  for(const [id,k] of [['relecture-du','du'],['relecture-au','au']]){const el=$(id);if(el)el.oninput=()=>{saisie={...saisie,[k]:el.value};refusBornes='';afficher();};}
  const gb=$('relecture-bornes');if(gb)gb.onclick=()=>{const B=vue(etat,{esvMuet:muet(),saisie}).bornes;if(!B||!B.actif){dire(B?.raison||'');return;}
   /* Un refus du service worker sur les bornes est dit sous les champs, sobrement ; les autres refus restent dans la note d'erreur. */
   gb.disabled=true;dire('');refusBornes='';
   void api(B.action==='reprendre'?'relecture-reprendre':'relecture-lancer',{debut:B.debut,fin:B.fin})
    .catch(e=>{const m=String(e?.message||e);if(/^Bornes de la relecture refusées : |^Relecture non lancée : bornes refusées : /.test(m))refusBornes=m.replace(/^.*?refusées : /,'');else dire(m);})
    .then(rafraichir);};
  const reg=()=>agir('relecture-pause-reglage',{actif:$('relecture-pause-actif')?.checked===true,f5:$('relecture-f5')?.value==='arret'?'arret':'pause'});
  const act=$('relecture-pause-actif');if(act)act.onchange=reg;const f5=$('relecture-f5');if(f5)f5.onchange=reg;
  void rafraichir();}
 root.ArianeRelecturePause={brancher,rafraichir,vue,etat:()=>etat,saisie:()=>({...saisie}),refus:()=>refusBornes};
 if(typeof document!=='undefined'&&typeof chrome!=='undefined'&&chrome.runtime?.sendMessage){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',brancher);else brancher();}
})(typeof globalThis!=='undefined'?globalThis:this);
