/* 5.0 (D-170 à D-176) — CARTE « RELECTURE APRÈS LE LOT » du panneau (bloc `#carte-relecture` de panel.html), autonome : elle ne lit
 * que ses propres éléments et ne parle au service worker que par ses actions (`relecture-choix-etat`, `relecture-choix`,
 * `relecture-etat`, `relecture-lancer`, `relecture-arreter`, `relecture-acquitter`). Le choix est gardé par le service worker, lu au
 * DÉMARRAGE du lot et figé pour lui ; un changement pendant un lot sert au lot suivant. La passe part seule juste après le lot, sans
 * compte à rebours (D-176). Pendant sa préparation et pendant la passe : « relecture 12 sur 85, 3 corrigés », les « vu » qu'ESV écrit
 * sur les cuts neufs (revue, correction 9), et un bouton d'arrêt ; « Lancer la relecture » est caché (une seule passe à la fois,
 * correction 2). Les réglages de la correction et leur source sont dits (correction 5) ; une correction interrompue se signale jusqu'à
 * « J'ai contrôlé le cut N » (W5). Comme les autres choix : « Dernier lot » (« Lot en cours ») et « Prochain lot ».
 * `texteContenu(batch)` donne la ligne de CONTENU.txt (rien quand le lot a la relecture coupée). */
(function(root){'use strict';
 const NOMS={coupee:'coupée',ombre:'ombre (Ariane visite et ne modifie rien ; ESV marque « vu » chaque cut neuf affiché)',corriger:'corriger (verts sûrs du PN, de l’ADV et des abords, validés par Maj+Espace)'};
 const IDS={coupee:'relecture-coupee',ombre:'relecture-ombre',corriger:'relecture-corriger'};
 const COURTS={coupee:'Coupée',ombre:'Ombre',corriger:'Corriger'},OUVERTS=['RUNNING','PAUSED','PAUSED_ADAPTER_UNRESPONSIVE','MANUAL_TAKEOVER','PAUSED_DEFER_NAVIGATION_UNCERTAIN','PAUSED_AFTER_STATE_MISSING'];
 const $=id=>typeof document!=='undefined'?document.getElementById(id):null;
 const api=async(action,args={})=>{const r=await chrome.runtime.sendMessage({kind:'panel',action,args});if(!r)throw Error('Ariane ne répond pas. Rouvre la fenêtre.');if(r.error)throw Error(r.error);return r.result;};
 let choix=null,etat=null,minuterie=null;
 const pluriel=(n,mot)=>`${n} ${mot}${n>1?'s':''}`;
 const active=p=>p?.etat==='preparation'||p?.etat==='en-cours';
 /* Ligne d'avancement ou de bilan de la passe. */
 function ligne(p){if(!p)return '';
  if(p.etat==='preparation')return p.message||'Relecture en préparation.';
  const corr=(p.modeEffectif||p.mode)==='corriger'?`, ${pluriel(p.corriges,'corrigé')}`:'';
  const vus=Number.isInteger(p.cutsNeufsAnnonces)?` · « vu » : ${p.vus||0} sur ${pluriel(p.cutsNeufsAnnonces,'cut')} neuf${p.cutsNeufsAnnonces>1?'s':''}`:p.vus?` · ${p.vus} « vu »`:'';
  if(p.etat==='en-cours')return `Relecture ${p.faits} sur ${p.total}${corr}${vus}${p.cut!=null?` · cut ${p.cut}`:''}${p.plage?` · ${p.plage}`:''}${p.arretDemande?' · arrêt demandé':''}`;
  return p.message||'';}
 const SOURCES={propose:'fichier proposé',defaut:'défaut provisoire'},ZONES={pn:'PN',adv:'ADV',abords:'abords',ecartement:'écartement','vert-hors-zone':'verts hors zone'};
 function texteReglages(r){if(!r)return '';
  const t=`Réglages de la correction : ${SOURCES[r.source]||r.source}${r.source==='propose'&&r.statut&&r.statut!=='propose'?` (« ${r.statut} »)`:''}.`;
  if(!r.correctionPermise)return `${t} « Corriger » restera en ombre : ${r.raison||'réglages non sûrs'}.`;
  /* Un interrupteur par zone (D-180) : la carte dit lesquelles corrigent. */
  const ouvertes=r.zones&&typeof r.zones==='object'?Object.entries(r.zones).filter(([,v])=>v===true).map(([z])=>ZONES[z]||z):null;
  return ouvertes?`${t} ${ouvertes.length?`Zones qui corrigent : ${ouvertes.join(', ')} ; les autres restent en ombre.`:'Aucune zone ne corrige : tout reste en ombre.'}`:t;}
 function afficher(){const carte=$('carte-relecture');if(!carte)return;
  if(choix)for(const [m,id] of Object.entries(IDS)){const el=$(id);if(el&&document.activeElement!==el)el.checked=choix===m;}
  const p=etat?.passe,lot=etat?.lot,enCours=active(p);
  /* Comme les autres choix du lot (test 7) : ce que le dernier lot a utilisé (« Lot en cours » pendant un lot), lu dans son scope,
   * et ce que le prochain lot utilisera (le choix gardé). Sans lot : « aucun lot » ; sans réponse : « — ». */
  const ecrire=(id,t)=>{const el=$(id);if(el)el.textContent=t;};
  const ouvert=!!lot&&OUVERTS.includes(lot.etat);
  ecrire('relecture-dernier-l',ouvert?'Lot en cours':'Dernier lot');
  ecrire('relecture-dernier',lot?`« ${COURTS[lot.mode]||COURTS.coupee} »`:'aucun lot');
  ecrire('relecture-prochain',choix?`« ${COURTS[choix]} »`:'—');
  ecrire('relecture-note',ouvert&&choix&&lot.mode!==choix?'Le lot en cours garde la sienne jusqu’à sa fin ; le choix coché servira au prochain lot.'
   :'Lue au démarrage de chaque lot, gardée jusqu’à sa fin. Coupée par défaut.');
  ecrire('relecture-reglages',texteReglages(p?.reglages&&p.etat!=='preparation'?p.reglages:etat?.reglages));
  const l=$('relecture-ligne');if(l){l.textContent=ligne(p);l.hidden=!p;}
  const c=etat?.correctionInterrompue;
  const ci=$('relecture-interrompue');if(ci){ci.hidden=!c;ci.textContent=c?`Une correction de la relecture a été interrompue au cut ${c.cut} (partie ${c.part}) : contrôle ce cut dans ESV, puis clique sur « J’ai contrôlé le cut ${c.cut} ».`:'';}
  const ok=$('relecture-acquitter');if(ok){ok.hidden=!c;ok.textContent=c?`J’ai contrôlé le cut ${c.cut}`:'J’ai contrôlé le cut';ok.dataset&&(ok.dataset.cut=c?String(c.cut):'');}
  const stop=$('relecture-arreter');if(stop){stop.hidden=!enCours;stop.disabled=p?.arretDemande===true;}
  const go=$('relecture-lancer');if(go){go.hidden=enCours||!!c||!lot||lot.mode==='coupee'||!['STOPPED','COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS'].includes(lot.etat)||p?.etat==='finie'&&p.lotId===lot.id;}
  for(const id of Object.values(IDS)){const el=$(id);if(el)el.disabled=enCours;}
  /* Rythme de la mise à jour : chaque seconde pendant la passe, sinon toutes les 4 s (la passe part seule en fin de lot). */
  clearTimeout(minuterie);minuterie=setTimeout(rafraichir,enCours?1000:4000);}
 async function rafraichir(){try{etat=await api('relecture-etat');choix=etat.choix;}catch{/* panneau fermé ou service worker en veille */}afficher();}
 async function choisir(mode){const note=$('relecture-note');try{choix=(await api('relecture-choix',{mode})).mode;}catch(e){if(note)note.textContent=e.message;}await rafraichir();}
 function brancher(){if(!$('carte-relecture'))return;
  for(const [m,id] of Object.entries(IDS)){const el=$(id);if(el)el.onclick=()=>{if(el.checked)void choisir(m);};}
  const stop=$('relecture-arreter');if(stop)stop.onclick=async()=>{stop.disabled=true;try{await api('relecture-arreter');}catch{}await rafraichir();};
  const go=$('relecture-lancer');if(go)go.onclick=async()=>{go.disabled=true;try{await api('relecture-lancer');}catch(e){const l=$('relecture-ligne');if(l){l.hidden=false;l.textContent=e.message;}}go.disabled=false;await rafraichir();};
  const ok=$('relecture-acquitter');if(ok)ok.onclick=async()=>{const cut=etat?.correctionInterrompue?.cut;if(!Number.isInteger(cut))return;ok.disabled=true;
   try{await api('relecture-acquitter',{cut});}catch(e){const l=$('relecture-ligne');if(l){l.hidden=false;l.textContent=e.message;}}ok.disabled=false;await rafraichir();};
  void rafraichir();}
 /* Ligne de CONTENU.txt : le choix figé dans le lot, et le bilan de sa passe s'il y en a une. */
 function texteContenu(b,passe=etat?.passe){const m=b?.scope?.relecture;if(m!=='ombre'&&m!=='corriger')return '';
  const p=passe&&passe.lotId===b.id?` ; passe : ${passe.etat}, ${passe.faits} sur ${passe.total} relus${(passe.modeEffectif||passe.mode)==='corriger'?`, ${passe.corriges} corrigés`:''}${passe.vus?`, ${passe.vus} cuts marqués « vu » par ESV`:''} (événements relecture-ombre dans le journal)`:'';
  return `Relecture après le lot ${b.id||'?'} : ${NOMS[m]} (${m})${p}.\n`;}
 root.ArianeCarteRelecture={brancher,rafraichir,texteContenu,ligne,texteReglages,NOMS,COURTS,afficher,arreter:()=>clearTimeout(minuterie),etat:x=>{if(x!==undefined){etat=x;choix=x?.choix??null;}return etat;}};
 if(typeof document!=='undefined'&&typeof chrome!=='undefined'&&chrome.runtime?.sendMessage){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',brancher);else brancher();}
})(typeof globalThis!=='undefined'?globalThis:this);
