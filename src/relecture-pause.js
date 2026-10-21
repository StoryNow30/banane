/* 4.9.6 (D-232, D-233 ; fiches/PLAN_RELECTURE_PAUSE.md) — PAUSE ET REPRISE DE LA RELECTURE, partie panneau. Module à part : `src/carte-relecture.js` (carte « Relecture après le lot »)
 * reste tel quel ; celui-ci tient ses propres éléments dans la même carte (`#relecture-pause-*`) et ne parle au service worker que par ses actions
 * (`relecture-etat`, `relecture-pause`, `relecture-reprendre`, `relecture-arreter`, `relecture-pause-reglage-etat`, `relecture-pause-reglage`).
 *  - « Pause » : visible pendant la passe quand le réglage est allumé ; « Pause demandée… » tant que la passe finit son étape ;
 *  - « Reprendre la relecture » et « Arrêter la relecture » : pendant la pause ; la reprise est grisée tant qu'ESV ne répond pas (raison écrite) ;
 *  - réglage : « Pause et reprise de la relecture » (éteint par défaut) et « Si ESV est rechargé pendant la relecture » (mettre en pause, ou arrêter).
 * Aucune commande vers ESV, aucun export : tout passe par le service worker. `etat()` rend le dernier état lu, pour la nouvelle présentation (src/ui5.js). */
(function(root){'use strict';
 const $=id=>typeof document!=='undefined'?document.getElementById(id):null;
 const api=async(action,args={})=>{const r=await chrome.runtime.sendMessage({kind:'panel',action,args});if(!r)throw Error('Ariane ne répond pas. Rouvre la fenêtre.');if(r.error)throw Error(r.error);return r.result;};
 let etat=null,minuterie=null;
 const pluriel=(n,mot)=>`${n} ${mot}${n>1?'s':''}`;
 const muet=()=>{try{return root.ArianePanel?.state?.()?.connection?.status==='unavailable';}catch{return false;}};
 const dire=t=>{const l=$('relecture-pause-note');if(l){l.hidden=!t;l.textContent=t||'';}};
 /* Ce que le panneau montre pour une passe donnée : {pause, reprendre, arreter, texte}. Pure : essayée sans navigateur. */
 function vue(e,{esvMuet=false}={}){const p=e?.passe,actif=e?.repriseReglage?.actif===true;
  const sortie={pause:null,reprendre:null,arreter:false,ligne:''};
  if(!p)return sortie;
  if(p.etat==='en-cours'&&p.reprise===true&&actif)sortie.pause=p.pauseDemandee?{texte:'Pause demandée…',actif:false}:{texte:'Pause',actif:true};
  if(p.etat==='en-pause'){
   sortie.reprendre=esvMuet?{texte:'Reprendre la relecture',actif:false,raison:'Disponible quand ESV répond.'}:{texte:`Reprendre la relecture${p.cut!=null?' au cut '+p.cut:''}`,actif:true,raison:''};
   sortie.arreter=true;
   sortie.ligne=`${p.pauseRaison==='esv'?'ESV ne répond plus : relecture gardée en pause':p.pauseRaison==='redemarrage'?'Relecture gardée en pause (Ariane a redémarré)':'Relecture en pause'} au cut ${p.cut??'?'} · ${pluriel(p.faits,'cut')} relu${p.faits>1?'s':''} sur ${p.total}${p.expire?' · gardée jusqu’à '+new Date(p.expire).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''}.`;}
  return sortie;}
 function afficher(){
  const v=vue(etat,{esvMuet:muet()}),p=etat?.passe;
  const pause=$('relecture-pause');if(pause){pause.hidden=!v.pause;if(v.pause){pause.textContent=v.pause.texte;pause.disabled=!v.pause.actif;}}
  const rep=$('relecture-reprendre');if(rep){rep.hidden=!v.reprendre;if(v.reprendre){rep.textContent=v.reprendre.texte;rep.disabled=!v.reprendre.actif;rep.title=v.reprendre.raison;}}
  const arr=$('relecture-arreter-pause');if(arr)arr.hidden=!v.arreter;
  const l=$('relecture-pause-ligne');if(l){l.hidden=!v.ligne;l.textContent=v.ligne;}
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
  const reg=()=>agir('relecture-pause-reglage',{actif:$('relecture-pause-actif')?.checked===true,f5:$('relecture-f5')?.value==='arret'?'arret':'pause'});
  const act=$('relecture-pause-actif');if(act)act.onchange=reg;const f5=$('relecture-f5');if(f5)f5.onchange=reg;
  void rafraichir();}
 root.ArianeRelecturePause={brancher,rafraichir,vue,etat:()=>etat};
 if(typeof document!=='undefined'&&typeof chrome!=='undefined'&&chrome.runtime?.sendMessage){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',brancher);else brancher();}
})(typeof globalThis!=='undefined'?globalThis:this);
