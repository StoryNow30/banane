/* CH-111 (D-345) — APPAIRAGE DE LA TÉLÉCOMMANDE, partie panneau. Ouvert depuis Réglages (ligne « Télécommande (iPhone) », src/signal-rendu.js),
 * une feuille à part, posée sur le panneau (elle survit à ses rendus). Ne parle au service worker que par ses actions : `telecommande-etat`,
 * `telecommande-appairer`, `telecommande-code`, `telecommande-couper`. La permission de l'hôte du relais est demandée ICI, sur le clic de l'opérateur
 * (`chrome.permissions.request`, hôtes de `optional_host_permissions`), avant l'appairage ; « Couper » la rend. Le QR code (src/qr.js) et le code à
 * taper portent la clé : ils ne s'affichent que dans cette feuille, sur demande, et ne sont gardés nulle part ici. */
(function(root){'use strict';
 const D=typeof document!=='undefined'?document:null;
 const api=async(action,args={})=>{const r=await chrome.runtime.sendMessage({kind:'panel',action,args});if(!r)throw Error('Ariane ne répond pas. Rouvre la fenêtre.');if(r.error)throw Error(r.error);return r.result;};
 const CLE_ADRESSE='ariane-telecommande-relais';/* l'adresse du relais (pas un secret), pour ne pas la retaper */
 const heure=iso=>{try{return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(iso));}catch{return '';}};
 const groupes=c=>String(c).replace(/(.{4})(?=.)/g,'$1 ');
 let boite=null,minuterie=null,montre=null;
 const STYLE=`#tc-voile{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;font:400 14px/1.45 "Inter",system-ui,sans-serif;color:#F1F2F4}
#tc-voile[data-theme="clair"]{background:rgba(20,22,26,.32);color:#14161A}
#tc-f{width:min(440px,100%);max-height:100%;overflow:auto;background:#131417;border-radius:18px;padding:20px 20px 16px;box-shadow:0 24px 48px -24px #000,inset 0 0 0 1px rgba(255,255,255,.13)}
#tc-voile[data-theme="clair"] #tc-f{background:#fff;box-shadow:0 24px 48px -24px rgba(20,22,26,.45),inset 0 0 0 1px rgba(10,14,25,.16)}
#tc-f h3{font:500 15px/1.3 inherit;margin:0 0 4px;display:flex;align-items:center;gap:8px}#tc-f h3 span{flex:1}
#tc-f .tc-x{background:none;border:0;color:inherit;font-size:18px;cursor:pointer;opacity:.7}
#tc-f p,#tc-f small{margin:0 0 10px;color:#8B909B;font-size:12.5px;display:block}#tc-voile[data-theme="clair"] #tc-f p,#tc-voile[data-theme="clair"] #tc-f small{color:#565B66}
#tc-f label{display:block;font:500 10px/1.3 inherit;letter-spacing:.12em;text-transform:uppercase;color:#8B909B;margin:14px 0 6px}
#tc-f input{width:100%;box-sizing:border-box;height:40px;border-radius:10px;border:0;padding:0 12px;background:rgba(127,127,127,.12);color:inherit;font:inherit;box-shadow:inset 0 0 0 1px rgba(127,127,127,.3)}
#tc-f .tc-b{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
#tc-f button.tc-p{height:38px;border-radius:19px;padding:0 16px;border:0;cursor:pointer;font:500 13.5px/1 inherit;background:#F1F2F4;color:#0A0B10}
#tc-voile[data-theme="clair"] #tc-f button.tc-p{background:#14161A;color:#fff}
#tc-f button.tc-s{background:none;color:inherit;box-shadow:inset 0 0 0 1px rgba(127,127,127,.4)}
#tc-f button.tc-d{background:none;color:#F2706B;box-shadow:inset 0 0 0 1px rgba(242,112,107,.5)}
#tc-f button:disabled{opacity:.45;cursor:default}
#tc-f .tc-l{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px solid rgba(127,127,127,.15)}#tc-f .tc-l b{font-weight:540}
#tc-f .tc-qr{display:flex;justify-content:center;margin:12px 0 8px;color:#000}#tc-f .tc-qr svg{width:220px;height:220px;border-radius:8px}
#tc-f .tc-code{font:500 13px/1.6 ui-monospace,monospace;letter-spacing:.04em;text-align:center;word-spacing:.2em;user-select:all;margin:0 0 6px}
#tc-f .tc-err{color:#F2706B}`;
 function el(tag,attrs={},...enfants){const e=D.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='on')e.onclick=v;else if(k==='text')e.textContent=v;else e.setAttribute(k,v);}for(const c of enfants)if(c)e.append(c);return e;}
 function fermer(){clearTimeout(minuterie);minuterie=null;montre=null;boite?.remove();boite=null;D.removeEventListener('keydown',echap,true);}
 function echap(e){if(e.key==='Escape'){e.stopPropagation();fermer();}}
 function theme(){return D.getElementById('ui5')?.dataset?.theme==='clair'?'clair':'sombre';}
 async function ouvrir(){if(!D)return;if(!D.getElementById('tc-style'))D.head.append(el('style',{id:'tc-style',text:STYLE}));
  if(!boite){boite=el('div',{id:'tc-voile','data-theme':theme(),role:'dialog','aria-modal':'true','aria-label':'Télécommande'});
   boite.addEventListener('click',e=>{if(e.target===boite)fermer();});D.body.append(boite);D.addEventListener('keydown',echap,true);}
  await rendre();}
 async function rendre(erreur){if(!boite)return;clearTimeout(minuterie);
  let e=null;try{e=await api('telecommande-etat');}catch(x){erreur=erreur||x.message;}
  const f=el('div',{id:'tc-f'});
  f.append(el('h3',{},el('span',{text:'Télécommande (iPhone)'}),el('button',{class:'tc-x','aria-label':'Fermer',text:'×',on:fermer})));
  f.append(el('p',{text:'Suivre Ariane et envoyer les ordres des boutons (pause, reprise, arrêt) depuis le téléphone. Tout passe chiffré par ton relais Cloudflare ; le relais ne lit rien. Fiche : telecommande/INSTALLATION.md.'}));
  if(!e?.appairee){
   const champ=el('input',{id:'tc-relais',type:'url',placeholder:'ariane-telecommande.<ton-sous-domaine>.workers.dev (en https)',autocomplete:'off',spellcheck:'false'});
   try{champ.value=localStorage.getItem(CLE_ADRESSE)||'';}catch{/* stockage du panneau indisponible */}
   const bouton=el('button',{class:'tc-p',text:'Appairer un téléphone'});
   bouton.onclick=()=>appairer(champ.value,bouton);
   f.append(el('label',{for:'tc-relais',text:'Adresse de ton relais'}),champ,el('div',{class:'tc-b'},bouton));}
  else{
   f.append(el('div',{class:'tc-l'},el('span',{text:'Relais'}),el('b',{text:e.relais.replace(/^https:\/\//,'')})));
   f.append(el('div',{class:'tc-l'},el('span',{text:'Liaison'}),el('b',{text:e.connectee?'connectée':'en attente du relais'})));
   f.append(el('div',{class:'tc-l'},el('span',{text:'Dernier état envoyé'}),el('b',{text:e.dernierEnvoi?heure(e.dernierEnvoi):'—'})));
   if(montre){const qr=el('div',{class:'tc-qr'});qr.innerHTML=root.ArianeQR.svg(montre.lien,{marge:4,module:4});/* SVG fabriqué par src/qr.js : chemins et nombres seulement */
    f.append(qr,el('div',{class:'tc-code',text:groupes(montre.code)}),el('small',{text:'Scanne avec l’appareil photo de l’iPhone, ouvre le lien dans Safari, puis Partager › Sur l’écran d’accueil. Ou ouvre l’adresse du relais et tape le code. Ce code donne la main sur Ariane : ne le montre à personne.'}));}
   const voir=el('button',{class:'tc-p tc-s',text:montre?'Cacher le QR code':'Afficher le QR code'});
   voir.onclick=async()=>{try{montre=montre?null:await api('telecommande-code');}catch(x){return rendre(x.message);}rendre();};
   const couper=el('button',{class:'tc-p tc-d',text:'Couper la télécommande'});
   couper.onclick=()=>couperTelecommande(couper);
   f.append(el('div',{class:'tc-b'},voir,couper));}
  if(erreur)f.append(el('p',{class:'tc-err',role:'alert',text:erreur}));
  boite.replaceChildren(f);boite.dataset.theme=theme();
  if(e?.appairee)minuterie=setTimeout(()=>rendre(),2000);}
 const origine=a=>{let u;try{u=new URL(String(a||'').trim());}catch{return null;}return u.protocol==='https:'?'https://'+u.host:null;};
 async function appairer(adresse,bouton){const o=origine(adresse);if(!o)return rendre('Adresse du relais : colle l’adresse https de ton Worker (en https, finissant par workers.dev).');
  bouton.disabled=true;
  /* La permission de l'hôte, sur ce clic (geste de l'opérateur). Refusée : rien n'est appairé. */
  let accord=false;try{accord=await chrome.permissions.request({origins:[o+'/*']});}catch(x){return rendre('Permission du relais non obtenue : '+x.message);}
  if(!accord)return rendre('Permission refusée : Ariane ne parlera pas à ce relais.');
  try{localStorage.setItem(CLE_ADRESSE,o);}catch{/* rien */}
  try{montre=await api('telecommande-appairer',{relais:o});}catch(x){return rendre(x.message);}
  rendre();}
 async function couperTelecommande(bouton){if(!root.confirm?.('Couper la télécommande ? Le téléphone ne recevra plus rien et ses ordres seront ignorés. Il faudra appairer à nouveau.'))return;
  bouton.disabled=true;let e=null;try{e=await api('telecommande-etat');await api('telecommande-couper');}catch(x){return rendre(x.message);}
  montre=null;if(e?.relais)try{await chrome.permissions.remove({origins:[e.relais+'/*']});}catch{/* déjà rendue */}
  rendre();}
 root.ArianeTelecommandePanneau={ouvrir,fermer};
})(typeof globalThis!=='undefined'?globalThis:this);
