/* 5.0 (D-170 à D-173) — CARTE « RELECTURE APRÈS LE LOT » du panneau (bloc `#carte-relecture` de panel.html), autonome : elle ne lit
 * que ses propres éléments et ne parle au service worker que par ses actions (`relecture-choix-etat`, `relecture-choix`,
 * `relecture-etat`, `relecture-lancer`, `relecture-arreter`). Le choix est gardé par le service worker, lu au DÉMARRAGE du lot et figé
 * pour lui ; un changement pendant un lot sert au lot suivant. Pendant la passe : « relecture 12 sur 85, 3 corrigés » et un bouton
 * d'arrêt. `texteContenu(batch)` donne la ligne de CONTENU.txt (rien quand le lot a la relecture coupée). */
(function(root){'use strict';
 const NOMS={coupee:'coupée',ombre:'ombre (visite, ne modifie rien)',corriger:'corriger (corrige seulement les cuts sûrs)'};
 const IDS={coupee:'relecture-coupee',ombre:'relecture-ombre',corriger:'relecture-corriger'};
 const $=id=>typeof document!=='undefined'?document.getElementById(id):null;
 const api=async(action,args={})=>{const r=await chrome.runtime.sendMessage({kind:'panel',action,args});if(!r)throw Error('Ariane ne répond pas. Rouvre la fenêtre.');if(r.error)throw Error(r.error);return r.result;};
 let choix=null,etat=null,minuterie=null;
 const pluriel=(n,mot)=>`${n} ${mot}${n>1?'s':''}`;
 /* Ligne d'avancement ou de bilan de la passe. */
 function ligne(p){if(!p)return '';
  const corr=(p.modeEffectif||p.mode)==='corriger'?`, ${pluriel(p.corriges,'corrigé')}`:'';
  if(p.etat==='en-cours')return `Relecture ${p.faits} sur ${p.total}${corr}${p.cut!=null?` · cut ${p.cut}`:''}${p.plage?` · ${p.plage}`:''}${p.arretDemande?' · arrêt demandé':''}`;
  return p.message||'';}
 function afficher(){const carte=$('carte-relecture');if(!carte)return;
  if(choix)for(const [m,id] of Object.entries(IDS)){const el=$(id);if(el&&document.activeElement!==el)el.checked=choix===m;}
  const p=etat?.passe,lot=etat?.lot,enCours=p?.etat==='en-cours';
  const note=$('relecture-note');
  if(note){const ouvert=lot&&['RUNNING','PAUSED','PAUSED_ADAPTER_UNRESPONSIVE','MANUAL_TAKEOVER'].includes(lot.etat);
   note.textContent=ouvert&&lot.mode!==choix?`Ce lot garde la relecture ${NOMS[lot.mode]||lot.mode} jusqu’à sa fin ; « ${NOMS[choix]} » servira au prochain lot.`
    :ouvert?`Ce lot utilise la relecture ${NOMS[lot.mode]||lot.mode}.`:'Lue au démarrage de chaque lot, gardée jusqu’à sa fin. Coupée par défaut.';}
  const l=$('relecture-ligne');if(l){l.textContent=ligne(p);l.hidden=!p;}
  const ci=$('relecture-interrompue');if(ci){const c=etat?.correctionInterrompue;ci.hidden=!c;ci.textContent=c?`Une correction de la relecture a été interrompue au cut ${c.cut} (partie ${c.part}) : contrôle ce cut dans ESV.`:'';}
  const stop=$('relecture-arreter');if(stop){stop.hidden=!enCours;stop.disabled=p?.arretDemande===true;}
  const go=$('relecture-lancer');if(go){go.hidden=enCours||!lot||lot.mode==='coupee'||!['STOPPED','COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS'].includes(lot.etat)||p?.etat==='finie'&&p.lotId===lot.id;}
  for(const id of Object.values(IDS)){const el=$(id);if(el)el.disabled=enCours;}
  /* Rythme de la mise à jour : chaque seconde pendant la passe, sinon toutes les 4 s (la passe part seule en fin de lot). */
  clearTimeout(minuterie);minuterie=setTimeout(rafraichir,enCours?1000:4000);}
 async function rafraichir(){try{etat=await api('relecture-etat');choix=etat.choix;}catch{/* panneau fermé ou service worker en veille */}afficher();}
 async function choisir(mode){const note=$('relecture-note');try{choix=(await api('relecture-choix',{mode})).mode;}catch(e){if(note)note.textContent=e.message;}await rafraichir();}
 function brancher(){if(!$('carte-relecture'))return;
  for(const [m,id] of Object.entries(IDS)){const el=$(id);if(el)el.onclick=()=>{if(el.checked)void choisir(m);};}
  const stop=$('relecture-arreter');if(stop)stop.onclick=async()=>{stop.disabled=true;try{await api('relecture-arreter');}catch{}await rafraichir();};
  const go=$('relecture-lancer');if(go)go.onclick=async()=>{go.disabled=true;try{await api('relecture-lancer');}catch(e){const l=$('relecture-ligne');if(l){l.hidden=false;l.textContent=e.message;}}go.disabled=false;await rafraichir();};
  void rafraichir();}
 /* Ligne de CONTENU.txt : le choix figé dans le lot, et le bilan de sa passe s'il y en a une. */
 function texteContenu(b,passe=etat?.passe){const m=b?.scope?.relecture;if(m!=='ombre'&&m!=='corriger')return '';
  const p=passe&&passe.lotId===b.id?` ; passe : ${passe.etat}, ${passe.faits} sur ${passe.total} relus${(passe.modeEffectif||passe.mode)==='corriger'?`, ${passe.corriges} corrigés`:''} (événements relecture-ombre dans le journal)`:'';
  return `Relecture après le lot ${b.id||'?'} : ${NOMS[m]} (${m})${p}.\n`;}
 root.ArianeCarteRelecture={brancher,rafraichir,texteContenu,ligne,NOMS};
 if(typeof document!=='undefined'&&typeof chrome!=='undefined'&&chrome.runtime?.sendMessage){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',brancher);else brancher();}
})(typeof globalThis!=='undefined'?globalThis:this);
