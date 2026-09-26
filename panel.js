(()=>{'use strict';
 const $=id=>document.getElementById(id),edited=new Set();let state=null,working=false,refreshing=false,uiError=null;
 /* 4.7.20 — piste H. Un bloc n'est réécrit que s'il change : le rafraîchissement
  * de chaque seconde ne relance ni les animations ni le clignotement. */
 function poser(el,html){if(el&&el.innerHTML!==html){el.innerHTML=html;return true;}return false;}
 /* 4.7.21 — LE MOUVEMENT (direction, 26/09 : « plus poussé », sans clignotement).
  * Rien ne tourne en boucle sauf le reflet de l'étape en cours et le point « en
  * direct ». Chaque autre mouvement suit un événement réel — un cut qui avance,
  * un chiffre qui change, une ligne d'activité qui arrive — et ne joue qu'une
  * fois, par l'API Web Animations, sur les seuls éléments neufs : un
  * rafraîchissement sans changement ne rejoue rien. Figé si le système réduit
  * les animations. */
 const bouger=()=>{try{return !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;}catch{return true;}};
 const COURBE='cubic-bezier(.2,0,0,1)',REBOND='cubic-bezier(.34,1.56,.64,1)';
 function animer(el,frames,opts={}){if(!el||typeof el.animate!=='function'||!bouger())return;
   try{el.animate(frames,{duration:420,easing:COURBE,fill:'backwards',...opts});}catch{/* animation refusée : l'état final est déjà affiché */}}
 const tous=(el,sel)=>typeof el?.querySelectorAll==='function'?[...el.querySelectorAll(sel)]:[];
 /* Le grand chiffre roule : seuls les chiffres qui changent montent, en cascade de droite à gauche. */
 function rouler(el,texte){if(!el)return;texte=String(texte);const d=el.dataset||{},avant=d.v;
   if(avant===texte)return;el.textContent=texte;d.v=texte;
   if(avant===undefined||avant==='—'||texte==='—'||typeof el.animate!=='function'||!bouger()||typeof document.createElement!=='function')return;
   el.textContent='';const n=texte.length;
   [...texte].forEach((ch,i)=>{const sp=document.createElement('span');sp.className='ch';sp.textContent=ch;el.append(sp);
     if(avant[avant.length-(n-i)]!==ch)animer(sp,[{transform:'translateY(.55em)',opacity:0,filter:'blur(3px)'},{transform:'none',opacity:1,filter:'none'}],{duration:520,delay:(n-1-i)*55,easing:REBOND});});}
 /* Tuiles : un chiffre qui change monte et se pose. */
 let tuilesAvant={};
 function animerTuiles(el,cle){const b=tous(el,'.tuile b'),avant=tuilesAvant[cle]||[],now=b.map(x=>x.textContent);tuilesAvant[cle]=now;
   b.forEach((x,i)=>{if(avant[i]!==undefined&&avant[i]!==now[i])animer(x,[{transform:'translateY(10px)',opacity:0},{transform:'none',opacity:1}],{duration:480,easing:REBOND});});}
 /* Activité : les lignes neuves glissent depuis le haut, les autres descendent d'un cran. */
 let activiteAvant={};
 function animerActivite(el,cle){const l=tous(el,'.l[data-k]'),avant=activiteAvant[cle],now=l.map(x=>x.dataset.k);activiteAvant[cle]=new Set(now);
   if(!avant)return;let rang=0;
   for(const x of l){if(!avant.has(x.dataset.k))animer(x,[{transform:'translateY(-14px)',opacity:0,backgroundColor:'var(--flash)'},{transform:'none',opacity:1,backgroundColor:'transparent'}],{duration:620,delay:rang++*70});
     else if(rang)animer(x,[{transform:'translateY(-10px)'},{transform:'none'}],{duration:420});}}
 /* LA LIGNE : la piste glisse quand un cut arrive, le cut posé se dresse puis
  * prend sa couleur, le curseur file jusqu'au cut affiché, le nouvel écart à
  * la voie éclôt sur la courbe. */
 let voieAvant=null;
 function animerVoie(el,v){const vis=v.cuts.slice(-44),cls=new Map(vis.map(c=>[c,v.classe(c)])),ecarts=new Set(vis.filter(c=>v.ecart(c)!==null));
   const avant=voieAvant,ia=vis.findIndex(c=>['actuel','incertain'].includes(cls.get(c)));voieAvant={vis,cls,ecarts,ia};
   if(!avant||!bouger())return;
   const n=vis.length+(v.ouvert?4:0),pas=372/Math.max(n,1),sortis=avant.vis.filter(c=>!cls.has(c)).length;
   if(sortis>0)for(const g of tous(el,'g.piste'))animer(g,[{transform:`translateX(${r1(sortis*pas)}px)`},{transform:'none'}],{duration:560});
   for(const r of tous(el,'rect.t[data-c]')){const c=Number(r.dataset.c),k=cls.get(c);
     if(avant.cls.get(c)!==k&&k!=='avenir')animer(r,[{transform:'scaleY(.1)',opacity:.3},{transform:'scaleY(1.25)',opacity:1,offset:.6},{transform:'none',opacity:1}],{duration:640,easing:COURBE});}
   if(ia>=0&&avant.ia>=0){const dx=r1((avant.ia-sortis-ia)*pas);if(dx)for(const g of tous(el,'g.curseur'))animer(g,[{transform:`translateX(${dx}px)`},{transform:'none'}],{duration:600,easing:REBOND});}
   for(const p of tous(el,'circle.p[data-c]'))if(!avant.ecarts.has(Number(p.dataset.c)))
     animer(p,[{transform:'scale(0)',opacity:0},{transform:'scale(2.2)',opacity:1,offset:.55},{transform:'none',opacity:1}],{duration:700,delay:200});}
 /* Les trois étapes du cut courant : faites, en cours (reflet continu), à venir. */
 const ORDRE_ETAPES=['capture','apply','validate'];
 function etapes(b,s){const el=$('lot-etapes');if(!el)return;const on=b?.state==='RUNNING'&&!s.reconcileRequired&&ORDRE_ETAPES.includes(b.step);
   el.hidden=!on;if(!on)return;const k=ORDRE_ETAPES.indexOf(b.step);
   for(const i of tous(el,'i[data-e]')){const j=ORDRE_ETAPES.indexOf(i.dataset.e);i.className=j<k?'fait':j===k?'actif':'';}}
 /* Onglets : un trait unique glisse sous l'onglet actif. */
 function placerIndicateur(){const ind=$('nav-ind'),t=typeof document.querySelector==='function'?document.querySelector('.nav-tab.actif'):null;
   if(!ind?.style)return;if(!t||!Number.isFinite(t.offsetLeft)){ind.style.opacity='0';return;}
   ind.style.opacity='1';ind.style.width=t.offsetWidth+'px';ind.style.transform=`translateX(${t.offsetLeft}px)`;$('nav')?.classList?.add?.('ind-pret');}
 const r1=v=>Math.round(v*10)/10,fr1=v=>Number.isFinite(v)?v.toFixed(1).replace('.',','):'—';
 const sg=v=>(v>=0?'+':'−')+fr1(Math.abs(v));
 /* Quantile d'une liste triée, interpolé (médiane : 0,5 ; p90 : 0,9). */
 const quantile=(t,f)=>{if(!t.length)return null;const p=f*(t.length-1),a=Math.floor(p),b=Math.ceil(p);return t[a]+(t[b]-t[a])*(p-a);};
 const heure=t=>{const d=new Date(t);return t&&Number.isFinite(d.getTime())?d.toTimeString().slice(0,8):'—';};
 const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 /* Entrée d'une vue : les blocs montent en cascade, une seule fois (panel.css). */
 let entreeMinuteur=null;
 function entree(){const b=document.body;if(!b?.classList)return;b.classList.remove('entree');void b.offsetWidth;b.classList.add('entree');
   if(entreeMinuteur)clearTimeout(entreeMinuteur);entreeMinuteur=setTimeout(()=>b.classList.remove('entree'),2600);}
 /* V4.5.4 — une seule fenêtre, navigation interne.
  *
  * Avant : cinq pages HTML, cinq fenêtres popup. Ouvrir le Natif depuis
  * l'accueil laissait deux fenêtres empilées, et la reprise manuelle en ouvrait
  * une troisième. La vue est maintenant un état de CETTE page, porté par le
  * fragment d'URL pour qu'un rechargement la retrouve. */
 /* 4.7.21 : le mode Assisté est retiré de l'interface (direction, 26/09) ;
  * un ancien lien « #assisted » ramène à l'accueil. */
 const VUES=['home','native','automatic'];
 const TITRES={
   home:{titre:'Une tâche, une fenêtre.',intro:'Choisis ce que tu veux faire dans ESV.'},
   native:{titre:'Mode Natif',intro:'Banane observe. Tu gardes entièrement la main dans ESV.'},
   automatic:{titre:'Pilotage automatique',intro:'Choisis une plage, puis suis le lot.'},
 };
 const SOUS={home:'V4.7.21 · TEST',native:'Natif',automatic:'Agent pilote'};
 const routeDemandee=()=>{const v=(location.hash||'').replace(/^#/,'');return VUES.includes(v)?v:'home';};
 let which=routeDemandee();
 function appliquerVue(){
   document.body.dataset.window=which;
   for(const s of document.querySelectorAll('.vue'))s.hidden=s.dataset.vue!==which;
   for(const t of document.querySelectorAll('.nav-tab')){
     const actif=t.dataset.view===which;
     t.classList.toggle('actif',actif);
     if(actif)t.setAttribute('aria-current','page');else t.removeAttribute('aria-current');
   }
   const t=TITRES[which]||TITRES.home;
   if($('vue-titre'))$('vue-titre').textContent=t.titre;
   if($('vue-intro'))$('vue-intro').textContent=t.intro;
   if($('connection'))$('connection').hidden=which==='home';
   placerIndicateur();
 }
 function naviguer(vue,pousser=true){
   if(!VUES.includes(vue)||vue===which)return;
   which=vue;uiError=null;
   if(pousser&&location.hash!=='#'+vue)location.hash='#'+vue;
   addEventListener('resize',placerIndicateur);
 appliquerVue();entree();
   if(state)render(state);
   void discover().catch(()=>{});
   if(which==='native'){renderReglages();void renderHealth();}
 }
 addEventListener('hashchange',()=>naviguer(routeDemandee(),false));
 // Live port is the source of truth for window presence, including after a service-worker restart.
 let presencePort=null;
 function reportPresence(){try{const port=chrome.runtime.connect({name:'banane-panel-presence'});presencePort=port;
   // Le service worker demande un changement de vue plutôt que d'ouvrir une
   // seconde fenêtre quand on clique sur la pastille d'une autre vue.
   port.onMessage.addListener(m=>{if(m?.kind==='navigate')naviguer(m.view);});
   port.onDisconnect.addListener(()=>{if(presencePort===port){presencePort=null;setTimeout(reportPresence,500);}});
  }catch{setTimeout(reportPresence,1000);}}
 reportPresence();
 async function api(action,args={}){const r=await chrome.runtime.sendMessage({kind:'panel',action,args});if(!r)throw Error('Banane ne répond pas. Rouvre la fenêtre.');if(r.error)throw Error(r.error);return r.result;}
 /* Le moteur est gelé : ses messages renvoient encore vers « Mes corrections »,
  * mode retiré en 4.5.4. On ne peut pas les corriger à la source, donc on les
  * traduit ici vers ce que l'interface offre réellement. Afficher un message
  * qui désigne un mode inexistant est pire qu'un message imparfait. */
 const NOTICES=[[/Ouvre Mes corrections\.?/g,'Reprends ce cut directement dans ESV.']];
 function note(message,error=false){
   let texte=String(message??'');
   for(const [motif,remplacement] of NOTICES)texte=texte.replace(motif,remplacement);
   $('notice').textContent=texte;$('notice').classList.toggle('error',error);}
 function button(id,{hidden=false,disabled=false}={}){if($(id)){$(id).hidden=hidden;$(id).disabled=disabled;}}
 const openStatus=status=>['STARTING','RUNNING','PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(status);
 const manualActive=s=>openStatus(s.manual?.status),nativeActive=s=>openStatus(s.native?.status),active=s=>manualActive(s)||nativeActive(s);
 const recording=s=>['STARTING','RUNNING'].includes(s.manual?.status)||['STARTING','RUNNING'].includes(s.native?.status);
 /* « LA LIGNE » (chantier B, D-045). Un bouton plein par écran : le premier
  * bouton VISIBLE de la liste, dans l'ordre où l'état les rend utiles ; les
  * autres sont des liens. Noir (ink) pour s'arrêter ou constater, rouge pour
  * ce qui ne se défait pas. Aucun bouton n'est caché ou montré ici : la
  * visibilité reste décidée par `button()`, comme avant. */
 function hierarchie(ordre,{ink=[],danger=[]}={}){
   let premier=true;
   for(const id of new Set(ordre)){const el=$(id);if(!el)continue;
     if(!el.hidden&&premier){el.className='primary'+(ink.includes(id)?' ink':'');premier=false;}
     else el.className=danger.includes(id)?'link danger':'link';}
 }
 const OUVERT=['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','PAUSED_DEFER_NAVIGATION_UNCERTAIN','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE','MANUAL_TAKEOVER'];
 const INCERTAIN=['PAUSED_DEFER_NAVIGATION_UNCERTAIN','PAUSED_AFTER_STATE_MISSING','ERROR'];
 const entier=v=>Number.isFinite(Number(v))?String(Math.trunc(Number(v))):'—';
 /* La voie : une traverse par cut du lot, dans l'ordre où le Pilote les a
  * ouverts (ESV saute les cuts déjà validés). La forme porte l'état : pleine,
  * posé par le moteur ; creuse, posé par la voie (décision sur le lot) ;
  * pointillée, différé ; fine et pâle, à venir ; haute et noire avec son
  * numéro, le cut affiché — rouge et « ? » si le résultat est incertain.
  * Les nombres viennent de l'état du lot et sont réécrits en entiers. */
 function voieDuLot(s){
   const b=s.batch,num=x=>Number(x?.cut??x?.identity?.cut),ens=l=>new Set((l||[]).map(num).filter(Number.isFinite));
   const fait=ens(b.processed),differe=ens(b.deferred),saute=ens(b.skipped),main=ens(b.manuallyCompleted);
   const parVoie=new Set(Object.values(b.lotCommands||{}).filter(c=>c?.action==='lot').map(c=>Number(c.cut)).filter(c=>fait.has(c)));
   const actif=Number(b.activeIdentity?.cut),ouvert=OUVERT.includes(b.state),incertain=INCERTAIN.includes(b.state)||!!s.reconcileRequired;
   const cuts=[...new Set((b.sequence||[]).map(num).filter(Number.isFinite))];
   const classe=c=>fait.has(c)?(parVoie.has(c)?'voie-l':'moteur'):differe.has(c)?'differe':saute.has(c)?'skip':main.has(c)?'main'
     :c===actif?(incertain?'incertain':'actuel'):'avenir';
   /* Un écart non consigné (null) n'est pas un écart nul : Number(null) vaut 0 (corrigé en 4.7.20). */
   const ecart=c=>{const e=b.lotCommands?.[c]?.ecartMm,v=e===null||e===undefined||e===''?NaN:Number(e);return Number.isFinite(v)?v:null;};
   return {fait,differe,saute,main,parVoie,cuts,classe,ouvert,incertain,actif,ecart};
 }
 /* 4.7.20 (piste H) — LA LIGNE : un segment par cut, dans l'ordre où le Pilote
  * les a ouverts ; sa couleur porte l'état (moteur, voie, différé, SKIP, à
  * venir) ; le cut affiché est plus haut, clignote doucement et porte son
  * numéro, « ? » si le résultat est incertain. Puis l'ÉCART À LA VOIE : la
  * courbe de l'écart de chaque cut à la voie de ses voisins, la garde de
  * continuité à 30 mm, en rouge au-delà. Rien de l'état n'est écrit tel quel :
  * seulement des entiers et des nombres réécrits. */
 function dessinerVoie(v){
   const W=372,visibles=v.cuts.slice(-44),avenir=v.ouvert?4:0,n=visibles.length+avenir,pas=W/Math.max(n,1);
   const X=i=>r1(i*pas+.5),L=r1(Math.max(pas-1,1));
   let svg=`<svg viewBox="0 0 ${W} 46" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g class="piste">`;
   /* 4.7.21 : chaque traverse porte son cut (entier) pour le mouvement ; à l'ouverture de la vue, elles se dressent en vague. */
   visibles.forEach((c,i)=>{const k=v.classe(c),haut=k==='actuel'||k==='incertain';
     svg+=`<rect class="t ${k}" data-c="${entier(c)}" style="--i:${i}" x="${X(i)}" y="${haut?6:14}" width="${L}" height="${haut?24:10}"/>`;});
   for(let i=0;i<avenir;i++)svg+=`<rect class="t avenir" style="--i:${visibles.length+i}" x="${X(visibles.length+i)}" y="14" width="${L}" height="10"/>`;
   svg+='</g>';
   const ia=visibles.findIndex(c=>['actuel','incertain'].includes(v.classe(c)));
   /* Le curseur : un repère au-dessus du cut affiché, qui file d'un cut à l'autre. */
   if(ia>=0){const cx=r1(ia*pas+pas/2);svg+=`<g class="curseur ${v.classe(visibles[ia])}"><path d="M${r1(cx-4)},0 L${r1(cx+4)},0 L${cx},4.5 Z"/></g>`;}
   if(visibles.length&&ia!==0)svg+=`<text class="axt" x="0" y="43">${entier(visibles[0])}</text>`;
   if(ia>=0){const k=v.classe(visibles[ia]);
     svg+=`<text class="axt ${k}" x="${r1(ia*pas+pas/2)}" y="43" text-anchor="${ia>=n-3?'end':'middle'}">${entier(visibles[ia])}${k==='incertain'?' ?':''}</text>`;}
   else if(visibles.length>1)svg+=`<text class="axt" x="${W}" y="43" text-anchor="end">${entier(visibles.at(-1))}</text>`;
   return svg+'</svg>'+profilVoie(v,visibles,pas,W);
 }
 function profilVoie(v,visibles,pas,W){
   const pts=visibles.map((c,i)=>({c,i,e:v.ecart(c),k:v.classe(c)}));
   if(!pts.some(p=>p.e!==null))return '';
   const H=100,top=12,bot=H-22,Y=mm=>r1(bot-Math.min(mm,40)/40*(bot-top)),Xc=i=>r1(i*pas+pas/2);
   const vals=pts.filter(p=>p.e!==null).map(p=>p.e).sort((a,b)=>a-b),med=quantile(vals,.5);
   let s=`<p class="sous-tete"><span class="lbl">Écart à la voie</span><span class="legend">médiane <b>${fr1(med)} mm</b></span></p>`
     +`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><line class="ax" x1="0" y1="${bot}" x2="${W}" y2="${bot}"/>`
     +`<line class="garde" x1="0" y1="${Y(30)}" x2="${W}" y2="${Y(30)}"/><text class="axt rouge" x="0" y="${r1(Y(30)-4)}">garde 30 mm</text>`;
   /* Courbe continue entre deux cuts sans écart consigné. */
   const segs=[];let cur=[];for(const p of pts){if(p.e===null){if(cur.length)segs.push(cur);cur=[];}else cur.push(p);}if(cur.length)segs.push(cur);
   for(const g of segs)if(g.length>1){const xy=g.map(p=>`${Xc(p.i)},${Y(p.e)}`);
     s+=`<polygon class="aire" points="${Xc(g[0].i)},${bot} ${xy.join(' ')} ${Xc(g.at(-1).i)},${bot}"/><path class="courbe" pathLength="1" d="M${xy.join(' L')}"/>`;}
   for(const p of pts){
     if(p.e===null){if(p.k==='differe')s+=`<rect class="d" x="${r1(Xc(p.i)-1.5)}" y="${bot-6}" width="3" height="6"/>`;continue;}
     s+=`<circle class="p ${p.e>30?'hors':p.k}" data-c="${entier(p.c)}" cx="${Xc(p.i)}" cy="${Y(p.e)}" r="${p.e>30?3.5:1.8}"/>`;}
   const pire=pts.filter(p=>p.e!==null&&p.e>30).at(-1);
   if(pire)s+=`<text class="axt rouge" x="${r1(Math.min(Xc(pire.i)+7,W-110))}" y="${r1(Y(pire.e)+3.5)}">${entier(pire.c)} · ${fr1(pire.e)} mm</text>`;
   if(visibles.length)s+=`<text class="axt" x="0" y="${H-4}">${entier(visibles[0])}</text>`;
   if(visibles.length>1)s+=`<text class="axt fort" x="${W}" y="${H-4}" text-anchor="end">${entier(visibles.at(-1))}</text>`;
   return s+'</svg>';
 }
 /* Tuiles : un libellé, un grand chiffre léger, une précision. */
 const tuiles=l=>l.map(([lbl,val,ton,sous])=>`<div class="tuile"><span class="lbl">${esc(lbl)}</span><b${ton?` class="${ton}"`:''}>${esc(val)}</b><small>${esc(sous)}</small></div>`).join('');
 /* Activité : heure, cut, ce qui s'est passé, valeur. */
 const lignes=l=>l.map(x=>`<div class="l" data-k="${entier(x.c)}-${x.k||'x'}-${entier(Date.parse(x.t))}"><span class="h">${heure(x.t)}</span><span class="c">${entier(x.c)}</span><span class="quoi${x.k?' '+x.k:''}">${esc(x.quoi)}</span><span class="v">${esc(x.val)}</span></div>`).join('');
 const QUOI={'first-pass':['posé · moteur',''],window:['posé · par la voie','voie-l'],choice:['posé · choix par la voie','voie-l'],crossing:['posé · ornière','voie-l']};
 const COTES={left:'rail gauche',right:'rail droit'};
 function activiteLot(b){
   const out=[],num=x=>Number(x?.cut??x?.identity?.cut),ecart=c=>{const e=b.lotCommands?.[c]?.ecartMm,v=e===null||e===undefined?NaN:Number(e);return Number.isFinite(v)?fr1(v)+' mm':'—';};
   for(const p of b.processed||[]){const c=num(p);if(!Number.isFinite(c))continue;const cmd=b.lotCommands?.[c];
     const [quoi,k]=cmd?.action==='lot'&&QUOI[cmd.stage]?QUOI[cmd.stage]:QUOI['first-pass'];
     out.push({t:p.evidence?.startedAt||p.evidence?.navigationAfter?.observedAt,c,quoi,k,val:ecart(c)});}
   for(const d of b.deferred||[]){const c=num(d);if(!Number.isFinite(c))continue;const r=(d.unresolvedRails||[]).filter(x=>COTES[x]);
     out.push({t:d.deferredAt,c,quoi:'différé'+(r.length===2?' · deux rails':r.length?' · '+COTES[r[0]]:''),k:'differe',val:'—'});}
   for(const x of b.skipped||[]){const c=num(x);if(Number.isFinite(c))out.push({t:x.evidence?.startedAt||x.skippedAt,c,quoi:'SKIP',k:'refuse',val:'—'});}
   return out.filter(x=>x.t).sort((a,b)=>String(b.t).localeCompare(String(a.t))).slice(0,3);
 }
 /* La dernière commande en trois étapes — émise, effet, serveur (toujours
  * « non disponible » : ESV n'en fournit aucune). Seul un effet observé passe
  * au vert ; une émission incertaine reste rouge, avec son cut. Lecture de
  * l'état seulement : rien n'est décidé ici. */
 const NOMS_COMMANDE={apply:'Appliquer les deux rails',validate:'Valider et passer au suivant',skip:'SKIP explicite',
   restore:'Revenir aux positions initiales',VALIDATE:'Valider et passer au suivant',SKIP:'SKIP explicite'};
 function commandeDerniere(s,vue){
   const na=['na','Serveur : non disponible'],emise=v=>v===true?['done','Émise']:v===false?['','Non émise']:['unk','Émise ?'];
   const encours=i=>({nom:NOMS_COMMANDE[i.kind]||'Commande',cut:i.identity?.cut,
     etapes:s.reconcileRequired?[['unk','Émise ?'],['unk','Effet non observé'],na]:[['','Émission en cours'],['','Effet attendu'],na]});
   const vu=e=>({effet:e.afterObserved===true?['seen','Effet observé']:e.navigationObserved===true?['done','Navigation observée','État final non relu : ESV a changé de cut avant la relecture.']:['unk','Effet non observé'],
     serveur:e.serverConfirmed===true?['seen','Serveur : confirmé']:na});
   const d=s.deferIntent&&s.deferIntent.phase!=='FINALIZED'?s.deferIntent:null;
   if(d)return {nom:'Suivant sans décision',cut:d.identity?.cut,etapes:[emise(d.commandInvoked),['unk','Effet non observé'],na]};
   if(s.intent)return encours(s.intent);
   const e=s.lastActionEvidence;if(!e||e.commandSent===undefined)return null;const v=vu(e);
   return {nom:NOMS_COMMANDE[e.operatorDecision]||'Dernière commande',cut:e.beforeNavigationIdentity?.cut??e.identity?.cut,
     etapes:[emise(e.commandSent),v.effet,v.serveur]};
 }
 function afficherCommande(prefixe,c){const boite=$(prefixe+'-commande');if(!boite)return;boite.hidden=!c;if(!c)return;
   $(prefixe+'-cmd-nom').textContent=c.nom;
   $(prefixe+'-cmd-cut').textContent=Number.isFinite(Number(c.cut))?'cut '+entier(c.cut):'';
   /* Libellés fixes, classes fixes : rien de l'état n'est écrit tel quel en HTML. */
   $(prefixe+'-cmd-etapes').innerHTML=c.etapes.map(([k,t,titre],i)=>(i?'<span class="bar-sep"></span>':'')+`<span class="step${k?' '+k:''}"${titre?` title="${titre}"`:''}><i></i>${t}</span>`).join('');
 }
 /* Pastilles d'état sur les onglets : ce qui tourne ou attend ailleurs se voit
  * sans changer de vue. Couleur doublée d'un titre, jamais seule. */
 function etatOnglets(s){
   const b=s.batch,n=s.native,out={native:null,automatic:null};
   if(['STARTING','RUNNING'].includes(n?.status))out.native=['vert','Collecte en cours'];
   else if(['PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(n?.status))out.native=['ambre','Collecte en pause'];
   if(INCERTAIN.includes(b?.state)||s.reconcileRequired)out.automatic=['rouge','Résultat à contrôler'];
   else if(b?.state==='RUNNING')out.automatic=['vert','Lot en cours'];
   else if(OUVERT.includes(b?.state))out.automatic=['ambre','Lot en pause'];
   return out;
 }
 const NOMS_ETAT={RUNNING:'En cours',PAUSED:'En pause',PAUSED_UNRESOLVED_RAIL:'Rail non résolu',PAUSED_AFTER_STATE_MISSING:'État final manquant',
   PAUSED_DEFER_NAVIGATION_UNCERTAIN:'Navigation différée incertaine',
   PAUSED_ADAPTER_UNRESPONSIVE:'Adaptateur sans réponse',MANUAL_TAKEOVER:'Reprise manuelle',STOPPED:'Arrêté',COMPLETED:'Terminé confirmé',
   FINISHED_WITH_UNCONFIRMED_ACTIONS:'Terminé avec actions non confirmées',ERROR:'Interrompu'};
 const ETAPES={capture:'capture du LiDAR',apply:'pose des rails',validate:'validation'};
 /* Bandeau dans ESV (piste H) : une ligne d'état en bas de la page ESV, qui ne
  * capte aucun clic. Il suit cette fenêtre : fermée, il disparaît. */
 let bandeau=false,bandeauEnvoye='';
 function texteBandeau(s){const b=s.batch,n=s.native;
   if(b&&OUVERT.includes(b.state)){const v=voieDuLot(s);
     return {texte:`BANANE · PILOTE · ${NOMS_ETAT[b.state]||'lot'} · cut ${entier(b.activeIdentity?.cut)} · ${v.fait.size} posés · ${v.differe.size} différés`,
       ton:INCERTAIN.includes(b.state)||s.reconcileRequired?'rouge':b.state==='RUNNING'?'vert':'ambre'};}
   if(n&&nativeActive(s))return {texte:`BANANE · NATIF · ${n.status==='RUNNING'?'collecte en cours':'collecte en pause'} · ${n.visits?.length||0} visites`,ton:n.status==='RUNNING'?'vert':'ambre'};
   if(b)return {texte:`BANANE · PILOTE · ${NOMS_ETAT[b.state]||'lot'} · ${b.processed?.length||0} traités · ${b.deferred?.length||0} différés`,ton:''};
   return {texte:'BANANE · prêt',ton:''};}
 let bandeauA=0;
 function envoyerBandeau(s){if(!bandeau)return;const t=texteBandeau(s),cle=t.texte+'|'+t.ton;
   // Renvoyé aussi toutes les 20 s : un service worker redémarré a perdu le texte.
   if(cle===bandeauEnvoye&&Date.now()-bandeauA<20000)return;bandeauEnvoye=cle;bandeauA=Date.now();
   void api('bandeau',{on:true,text:t.texte,ton:t.ton}).catch(()=>{bandeauEnvoye='';});}
 /* Natif : durée de chaque visite (jusqu'au début de la suivante), et ce qui s'y est passé. */
 const ISSUE={VALIDATE_NO_MOVEMENT:['validé',''],VALIDATE_CORRECTED_BOTH:['corrigé · 2 rails','voie-l'],VALIDATE_CORRECTED_LEFT_ONLY:['corrigé · rail gauche','voie-l'],
   VALIDATE_CORRECTED_RIGHT_ONLY:['corrigé · rail droit','voie-l'],SKIP:['SKIP','refuse']};
 function visitesNatif(n){const v=(n?.visits||[]).filter(x=>x&&x.startedAt),ms=t=>Date.parse(t);
   return v.map((x,i)=>{const fin=v[i+1]?.startedAt||x.endedAt||null,d=fin?(ms(fin)-ms(x.startedAt))/1000:(Date.now()-ms(x.startedAt))/1000;
     return {t:x.startedAt,c:x.identity?.cut,encours:!fin,d:Number.isFinite(d)&&d>=0?d:null,label:x.label||null};});}
 function tempsParCut(vis){const der=vis.slice(-40);if(der.length<2)return '';
   const W=372,H=110,PW=W-104,pas=PW/40,top=14,bot=H-20,fin=der.filter(x=>!x.encours&&x.d!==null).map(x=>x.d).sort((a,b)=>a-b);
   if(!fin.length)return '';const med=quantile(fin,.5),p90=quantile(fin,.9),max=Math.max(30,Math.ceil(p90*1.4));
   const Y=v=>r1(bot-Math.min(v,max)/max*(bot-top));
   let g=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><line class="ax" x1="0" y1="${bot}" x2="${PW}" y2="${bot}"/>`;
   der.forEach((x,i)=>{if(x.d===null)return;const xx=r1(i*pas+pas/2-1.5),y=Y(x.d),h=r1(bot-y);
     g+=x.encours?`<rect class="b encours" x="${xx}" y="${y}" width="3" height="${h}"/>`
       :`<rect class="b${x.d>p90?' lent':''} grow" style="animation-delay:${250+i*18}ms" x="${xx}" y="${y}" width="3" height="${h}"/>`;});
   g+=`<line class="med" x1="0" y1="${Y(med)}" x2="${PW+6}" y2="${Y(med)}"/><line class="p90" x1="0" y1="${Y(p90)}" x2="${PW+6}" y2="${Y(p90)}"/>`
     +`<text class="axt fort" x="${W}" y="${r1(Y(med)+3.5)}" text-anchor="end">médiane ${fr1(med)} s</text><text class="axt ambre" x="${W}" y="${r1(Y(p90)+3.5)}" text-anchor="end">p90 ${fr1(p90)} s</text>`
     +`<text class="axt" x="0" y="${H-4}">${entier(der[0].c)}</text><text class="axt fort" x="${r1((der.length-.5)*pas)}" y="${H-4}" text-anchor="middle">${entier(der.at(-1).c)}</text></svg>`;
   return g;}
 const ilya=t=>{const s=Math.max(0,Math.round((Date.now()-Date.parse(t))/1000));return !Number.isFinite(s)?'':s<60?`il y a ${s} s`:s<3600?`il y a ${Math.round(s/60)} min`:`il y a ${Math.round(s/3600)} h`;};
 /* 4.7.21 — bornes remplies par Banane : le premier cut est celui qu'ESV
  * affiche ; le dernier, la fin retenue pour la partie par le service worker
  * (saisie d'un lot précédent, ou fin constatée quand ESV a quitté la partie),
  * sinon « fin de partie » (champ vide) : le lot va jusqu'à ce qu'ESV quitte la
  * partie et se clôt seul. Tout reste modifiable. */
 const FIN_PARTIE=999999,finDePartie=sc=>sc?.endMode==='partie'||Number(sc?.end)>=FIN_PARTIE;
 let bornesPartie={part:null,last:null,source:null},bornesDemandees=null;
 function bornesDe(part){if(!Number.isInteger(part)||bornesDemandees===part)return;bornesDemandees=part;
   void api('bornes-partie',{part}).then(r=>{bornesPartie={part,last:Number.isInteger(r?.last)?r.last:null,source:r?.source??null};if(state)render(state);}).catch(()=>{bornesDemandees=null;});}
 /* 4.7.21 : détails ouverts par défaut (exports GCV1, journal, réglages). */
 let nouveauLot=false;const tiroirs={lot:true,native:true};
 function tiroir(nom){const t=$(nom+'-details'),bouton=$(nom+'-details-toggle');if(!t||!bouton)return;
   t.hidden=!tiroirs[nom];bouton.setAttribute('aria-expanded',String(!!tiroirs[nom]));bouton.textContent=tiroirs[nom]?'Masquer':'Détails ›';}
 function render(s){state=s;const id=s.current?.identity,b=s.batch,m=s.manual,n=s.native,busy=working||s.busy;
   const onglets=etatOnglets(s);
   for(const [vue,e] of Object.entries(onglets)){const t=$('tab-'+vue);if(!t)continue;
     if(e){t.dataset.etat=e[0];t.setAttribute('title',e[1]);}else{delete t.dataset.etat;t.removeAttribute('title');}}
   tiroir('lot');tiroir('native');
   $('context').textContent=id?`ESV · part ${id.part} · cut ${id.cut}`:'';
   const partie=which==='automatic'?b?.scope?.part??id?.part:id?.part;
   if($('sous-titre'))$('sous-titre').textContent=which==='home'?SOUS.home:`${SOUS[which]}${Number.isFinite(Number(partie))?' · Partie '+entier(partie):''}`;
   envoyerBandeau(s);
   if(which==='native'){
     const running=['STARTING','RUNNING'].includes(n?.status),paused=['PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(n?.status),open=nativeActive(s);
     note(n?.message||(running?'Collecte en cours : travaille normalement dans ESV.':'Ouvre le premier cut à observer, puis démarre le mode Natif.'),n?.status==='PAUSED_ADAPTER_UNRESPONSIVE');
     if(manualActive(s))note('Une session Mes corrections est active. Termine-la avant de démarrer le mode Natif.');
     if(['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','PAUSED_DEFER_NAVIGATION_UNCERTAIN','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE'].includes(b?.state))note('Un lot automatique est actif. Termine-le avant de démarrer le mode Natif.');
     rouler($('native-count'),String(n?.visits.length||0));const count=n?.incomplete.length||0;$('native-incomplete').hidden=!count;
     /* Piste H : l'état, la dernière visite, le temps par cut, l'activité. */
     if($('native-etat')){const e=!n?['Aucune collecte','ink']:n.status==='RUNNING'?['Collecte en cours · observation',' live']:n.status==='STARTING'?['Démarrage de la collecte','']
       :n.status==='PAUSED'?['Collecte en pause','amber']:n.status==='PAUSED_ADAPTER_UNRESPONSIVE'?['Adaptateur sans réponse','red']:n.status==='FINISHED'?['Session terminée','ink']:[String(n.status||'—'),'ink'];
       $('native-etat').textContent=e[0];$('native-etat').className='eyebrow'+(e[1]?(e[1].startsWith(' ')?e[1]:' '+e[1]):'');}
     const vis=visitesNatif(n),der=vis.at(-1);
     if($('native-derniere')){$('native-derniere').hidden=!der;$('native-derniere').textContent=der?`Dernière · ${entier(der.c)} · ${der.encours?'en cours':ilya(der.t)}`:'';}
     const tpc=tempsParCut(vis);if($('native-temps-bloc'))$('native-temps-bloc').hidden=!tpc;poser($('native-temps'),tpc);
     const act=vis.slice(-5).reverse().map(x=>({t:x.t,c:x.c,quoi:x.encours?'visite en cours':(ISSUE[x.label]||['visité',''])[0],k:x.encours?'encours':(ISSUE[x.label]||['',''])[1],
       val:x.d===null?'—':x.encours?`${String(Math.floor(x.d/60)).padStart(2,'0')}:${String(Math.floor(x.d%60)).padStart(2,'0')}`:fr1(x.d)+' s'}));
     if($('native-activite-bloc'))$('native-activite-bloc').hidden=!act.length;if(poser($('native-activite'),lignes(act)))animerActivite($('native-activite'),'native');
     $('native-incomplete').textContent=`${count} visite(s) partielle(s), conservée(s) avec leur motif.`;
     button('native-start',{hidden:open,disabled:busy||manualActive(s)||['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','PAUSED_DEFER_NAVIGATION_UNCERTAIN','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE'].includes(b?.state)});
     $('native-start').textContent=n?.status==='FINISHED'?'Démarrer une nouvelle session':'Démarrer l’observation';
     button('native-pause',{hidden:!running,disabled:working});button('native-resume',{hidden:!paused,disabled:working});
     button('native-end',{hidden:!n||n.status==='FINISHED',disabled:working});
     button('native-download',{hidden:!(n?.status==='FINISHED'||n?.status==='PAUSED_ADAPTER_UNRESPONSIVE'),disabled:working});
     /* L'abandon reste offert tant qu'une session existe, y compris terminée :
      * c'est après l'avoir regardée qu'on décide de la jeter. */
     button('native-discard',{hidden:!n,disabled:working});
     if($('native-discard-note'))$('native-discard-note').hidden=!n;
     hierarchie(['native-resume','native-end','native-download','native-start','native-pause']);
   }else if(which==='automatic'){
     /* 4.7.21 : pendant un lot, l'invite « Choisis les bornes » n'a pas de sens. */
     note(active(s)?'Une collecte manuelle est active. Termine-la avant de lancer un lot.':s.notice||(b?.state==='RUNNING'?'Le Pilote enchaîne les cuts : tu peux suivre ici ou dans ESV.'
       :'Choisis les bornes de ton lot TEST : le premier cut est celui qu’ESV affiche.'));
     const running=['RUNNING','PAUSED','STOPPED','PAUSED_UNRESOLVED_RAIL','PAUSED_DEFER_NAVIGATION_UNCERTAIN','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE'].includes(b?.state);
     /* 4.7.21 — terrain du 26/09 : après un lot « Arrêté », « Nouveau lot »
      * gardait les bornes de l'ancien (premier cut 556 quand ESV montrait 715)
      * et le moteur refusait : « Ouvre le premier cut du lot dans ESV ». Il
      * fallait réinstaller l'extension. Un nouveau lot part du cut affiché ; il
      * garde la fin de l'ancien lot dans la même partie si elle est plus loin. */
     const bornesNeuves=!running||b?.state==='STOPPED'&&nouveauLot,range=bornesNeuves?null:b.scope;
     bornesDe(id?.part);
     const memo=bornesPartie.part===id?.part&&bornesPartie.last>=Number(id?.cut)?bornesPartie.last:undefined;
     const finPrecedente=b?.scope&&b.scope.part===id?.part&&!finDePartie(b.scope)&&Number(b.scope.end)>Number(id?.cut)?b.scope.end:undefined;
     const finProposee=range?(finDePartie(range)?'':range.end):memo??finPrecedente??'';
     for(const [f,v] of [['start',range?.start??id?.cut],['end',finProposee]])if(v!==undefined&&!edited.has(f)&&document.activeElement!==$(f))$(f).value=v;
     if($('bornes-note'))$('bornes-note').textContent=edited.has('end')||edited.has('start')?'Bornes saisies à la main.'
       :memo!==undefined?`Dernier cut retenu pour la partie ${entier(id?.part)} (${bornesPartie.source==='saisie'?'saisi pour un lot précédent':'ESV a quitté la partie après ce cut'}). Modifiable.`
       :finPrecedente!==undefined?'Dernier cut du lot précédent. Modifiable.'
       :'Dernier cut vide : le lot va jusqu’à la fin de la partie, puis se clôt seul. Modifiable.';
     /* La politique du lot est FIGÉE à sa création : tant qu'il vit, le réglage
      * affiché est le sien, pas celui du prochain lot. Un lot antérieur à 4.7
      * n'a pas ce champ et garde la pause historique. */
     /* 4.7.21 : réglages du lot fixes (différer, appliquer, tenter) ; les
      * sélecteurs sont retirés. Pendant un lot, ses politiques EFFECTIVES,
      * figées à sa création, restent dites (cahier 4.7 §10, KI-033) : un lot
      * créé par une version antérieure peut porter d'autres choix. */
     if($('lot-reglages'))$('lot-reglages').hidden=!!running;
     const nomPolitique=v=>v==='attempt'?'tenter la proposition expérimentale':'mettre le lot en pause';
     if($('unresolved-policy-effective')){$('unresolved-policy-effective').hidden=!running;
       $('unresolved-policy-effective').textContent=running?`Politique effective de ce lot : ${(b.scope?.unresolvedPolicy||'pause')==='defer'?'continuer et différer':'mettre le lot en pause'}.`:'';}
     /* Un lot Pilote GCV1 NEUTRALISE la question de faible confiance :
      * background.js force « tenter » et garde le choix demandé à part. */
     if($('policy-effective')){const demande=running?b.scope?.requestedLowConfidence:null,applique=running?(b.scope?.lowConfidence||'pause'):null;
       $('policy-effective').hidden=!running;
       $('policy-effective').textContent=!running?'':demande&&demande!==applique
         ?`Politique effective de ce lot : ${nomPolitique(applique)}. Le lot Pilote GCV1 ne repasse pas ses candidates dans le seuil de confiance V4.6 : le choix « ${nomPolitique(demande)} » ne s’y applique pas.`
         :`Politique effective de ce lot : ${nomPolitique(applique)}.`;}
     if($('policy')&&running&&b.scope?.lowConfidence)$('policy').value=b.scope.lowConfidence;
     if($('lot-decision-effective')){$('lot-decision-effective').hidden=!running;
       $('lot-decision-effective').textContent=running?`Décision sur le lot dans ce lot : ${b.scope?.lotDecision==='apply'?'appliquée':'observée seulement'}.`:'';}
     const names=NOMS_ETAT;
     // Les cuts repris à la main sont comptés à part : Banane ne les a pas validés.
     const repris=b?.manuallyCompleted?.length?` · ${b.manuallyCompleted.length} repris à la main`:'';
     /* Le compteur suit la FINALISATION durable, jamais le début d'une
      * tentative : une intention en attente ne s'y ajoute pas. */
     const differes=b?` · Différés : ${b.deferred?.length||0}`:'';
     /* 4.7.19 : arrêt au dernier cut du lot, sans validation ni navigation. */
     const fin=b?.stoppedAtEnd?` — dernier cut ${b.stoppedAtEnd.cut} ${b.stoppedAtEnd.applied?'posé, non validé : valide-le dans ESV':'non résolu, laissé sans commande'}`:'';
     $('batch').textContent=b?`${names[b.state]||b.state} · ${b.processed.length} cuts traités · ${b.skipped.length} ignorés${differes}${repris}${fin}${b.error?' — '+b.error.message:''}`:'Aucun lot en cours.';
     /* « La ligne » : l'état en capitales, le cut en grand, les compteurs, la voie. */
     const ton=!b?'ink':INCERTAIN.includes(b.state)||s.reconcileRequired?'red':b.state==='RUNNING'?'':OUVERT.includes(b.state)?'amber':'ink';
     if($('lot-etat')){$('lot-etat').textContent=b?(names[b.state]||b.state)+(b.state==='RUNNING'&&ETAPES[b.step]?' · '+ETAPES[b.step]:''):'Aucun lot';
       $('lot-etat').className='eyebrow'+(ton?' '+ton:'')+(b?.state==='RUNNING'&&!s.reconcileRequired?' live':'');}
     if($('lot-cut'))rouler($('lot-cut'),entier(b?.activeIdentity?.cut??id?.cut));
     etapes(b,s);
     if($('lot-plage'))$('lot-plage').textContent=b?.scope?`part ${entier(b.scope.part)} · ${entier(b.scope.start)} → ${finDePartie(b.scope)?'fin de partie':entier(b.scope.end)}`:'';
     /* Progression dans la plage du lot : du premier au dernier cut. */
     if($('lot-progres')){const sc=b?.scope,a=Number(sc?.start),c=Number(b?.activeIdentity?.cut??b?.lastCompletedIdentity?.cut);
       /* « Fin de partie » : la progression se mesure sur la fin retenue pour la partie, si elle est connue. */
       const z=finDePartie(sc)?(bornesPartie.part===sc?.part&&bornesPartie.last>a?bornesPartie.last:NaN):Number(sc?.end);
       const ok=Number.isFinite(a)&&Number.isFinite(z)&&z>a&&Number.isFinite(c);$('lot-progres').hidden=!ok;
       if(ok){const pct=Math.round(Math.min(1,Math.max(0,(c-a)/(z-a)))*100);if($('lot-progres-fill')?.style)$('lot-progres-fill').style.width=pct+'%';
         $('lot-debut').textContent=entier(a);$('lot-fin').textContent=entier(z)+(finDePartie(sc)?' ?':'');$('lot-pct').textContent=`${pct} % de la plage`;}}
     const v=b?voieDuLot(s):null;
     /* Tuiles : posés, différés, couverture sur les cuts terminés du lot (D-038). */
     if($('lot-compteurs')){$('lot-compteurs').hidden=!v;
       const finis=v?v.fait.size+v.differe.size+v.saute.size+v.main.size:0;
       const ecrit=poser($('lot-compteurs'),!v?'':tuiles([['Posés',String(v.fait.size),'',v.parVoie.size?`dont ${v.parVoie.size} par la voie`:'par le moteur'],
         ['Différés',String(v.differe.size),v.differe.size?'amber':'',[v.saute.size?`${v.saute.size} SKIP`:'',v.main.size?`${v.main.size} repris à la main`:''].filter(Boolean).join(' · ')||'à reprendre'],
         ['Couverture',finis?`${Math.round(v.fait.size/finis*100)} %`:'—','',`${v.fait.size} sur ${finis}`]]));
       if(ecrit)animerTuiles($('lot-compteurs'),'lot');}
     if($('voie')){const montrer=!!v&&v.cuts.length>0;$('voie').hidden=!montrer;if(poser($('voie'),montrer?dessinerVoie(v):'')&&montrer)animerVoie($('voie'),v);
       if($('voie-legende'))$('voie-legende').hidden=!montrer;}
     afficherCommande('lot',b?commandeDerniere(s,'automatic'):null);
     const actLot=b?activiteLot(b):[];if($('lot-activite-bloc'))$('lot-activite-bloc').hidden=!actLot.length;if(poser($('lot-activite'),lignes(actLot)))animerActivite($('lot-activite'),'lot');
     /* PAUSED_AFTER_STATE_MISSING n'offre aucun bouton d'action : ni Réessayer,
      * ni SKIP, ni Reprise manuelle. L'opérateur voyait un message sans savoir
      * quoi faire. Ce n'est pourtant pas une panne : la commande est partie, ESV
      * a avancé, et le pilote refuse de compter une réussite qu'il n'a pas
      * observée. Il faut le dire, et dire quoi faire. */
     if(b?.state==='PAUSED_AFTER_STATE_MISSING')
       note('La commande est partie et ESV a changé de cut avant que Banane puisse relire l’état final. '
         +'Le placement a probablement été appliqué, mais Banane ne compte jamais une réussite qu’il n’a pas vue. '
         +'Vérifie le cut dans ESV, puis clique sur Arrêter pour clore le lot.');
     /* Un échec ou une incertitude de navigation reste visible AVEC le cut
      * concerné : aucun bouton n'est présenté comme réussi sur un simple accusé. */
     const differe=s.deferIntent&&s.deferIntent.phase!=='FINALIZED'?s.deferIntent:null;
     if(b?.state==='PAUSED_DEFER_NAVIGATION_UNCERTAIN'||differe)
       note(`Cut ${differe?.identity?.cut??b?.activeIdentity?.cut??'?'} : la navigation sans décision `
         +(differe?.commandInvoked===false?'n’a pas été émise.':'a peut-être été transmise, sans progression acceptée.')
         +' Elle ne sera pas renvoyée. Aucun cut n’est compté comme différé tant que la progression n’est pas acceptée. '
         +'Contrôle ce cut dans ESV, puis clôture ce résultat incertain.');
     /* « La ligne », règle 3 : pas de bouton grisé pour une action sans objet.
      * Pendant un lot ouvert ou un résultat à réconcilier, « Démarrer » et les
      * bornes disparaissent ; ils reviennent dès qu'un lot peut repartir. */
     const lotOuvert=OUVERT.includes(b?.state)||!!s.reconcileRequired;
     /* Fin de lot : télécharger d'abord ; « Nouveau lot » (lien) rouvre les
      * bornes et « Démarrer ». Aucun lot ne part sans que tu aies revu ses bornes. */
     const fini=['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','STOPPED','ERROR'].includes(b?.state)&&!s.reconcileRequired;
     if(lotOuvert)nouveauLot=false;
     const attendNouveau=fini&&!nouveauLot;
     button('new-batch',{hidden:!attendNouveau,disabled:busy});
     button('start-batch',{hidden:lotOuvert||attendNouveau,disabled:busy||active(s)||['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','PAUSED_DEFER_NAVIGATION_UNCERTAIN','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE'].includes(b?.state)});
     if($('lot-bornes'))$('lot-bornes').hidden=lotOuvert||attendNouveau;
     /* 4.7.19 — reprise : offerte après un lot Pilote fini qui a des différés et des cuts posés. */
     const differesLot=(b?.deferred||[]).map(d=>d.identity?.cut).filter(Number.isInteger).sort((x,y)=>x-y);
     const reprenable=fini&&b?.scope?.geometryEngine==='geometry-candidate-v1'&&differesLot.length>0&&(b.lotPosedCount||0)+(b.lotObservation?.anchors?.length||0)>0
       &&(!id||id.part===b.scope.part);
     if($('lot-reprise-row')){$('lot-reprise-row').hidden=!reprenable||lotOuvert||attendNouveau;if(!reprenable&&$('lot-reprise').checked)$('lot-reprise').checked=false;
       $('lot-reprise-note').textContent=reprenable?`${differesLot.length} différé(s) dans le lot précédent, du cut ${differesLot[0]} au cut ${differesLot.at(-1)}. Coché : bornes ${differesLot[0]} → ${finDePartie(b.scope)?'fin de partie':b.scope.end} ; ouvre le cut ${differesLot[0]} dans ESV. Seuls les cuts posés et validés par le Pilote servent d'appui.`:'';}
     button('pause',{hidden:b?.state!=='RUNNING',disabled:working});/* V4.6.0 : Arrêter reste offert pendant la reprise manuelle — c'est la seule
 * sortie du lot avec « Repris manuellement ». Le masquer enfermait l'opérateur
 * dans un état dont rien ne le faisait sortir. */
button('stop',{hidden:!b||['STOPPED','COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','ERROR'].includes(b.state),disabled:working});
     button('resume',{hidden:!['PAUSED','STOPPED'].includes(b?.state),disabled:busy||active(s)});
     const actionable=b?.step==='apply'&&['unresolved-rail','low-confidence'].includes(b?.pauseReason);
     button('retry',{hidden:!actionable,disabled:busy||active(s)});
     /* « Reprise manuelle » est un ÉTAT DU PILOTE, pas une session de
      * correction : il archive le cut et te le rend sans commande. Le bouton
      * avait été retiré par erreur avec le mode Correction en 4.5.4, alors que
      * `src/engine.js` — gelé — continue de l'annoncer dans son message.
      * L'opérateur lisait donc « Choisis Réessayer, Reprise manuelle, SKIP
      * explicite ou Arrêter » devant trois boutons sur quatre. */
     button('manual-takeover',{hidden:!actionable,disabled:busy||active(s)});
     /* V4.6.0 : la reprise manuelle n'est plus une impasse. Le bouton de
      * déclaration n'existe que dans cet état ; le moteur refuse la déclaration
      * tant qu'ESV n'affiche pas le cut suivant. */
     button('manual-completion',{hidden:b?.state!=='MANUAL_TAKEOVER',disabled:busy||active(s)});
     if(b?.state==='MANUAL_TAKEOVER')
       note('Ce cut t’est rendu : Banane n’a envoyé aucune commande dessus. Corrige-le dans ESV, ouvre le cut suivant, '
         +'puis clique sur « Repris manuellement » — le lot repartira, et ce cut sera journalisé comme repris à la main, jamais comme validé par Banane.');
     button('explicit-skip',{hidden:!actionable,disabled:busy||active(s)});
     button('close-uncertain',{hidden:!s.reconcileRequired&&!differe,disabled:busy});
     /* Règle 4 : un verbe, son objet, et le cut quand l'action le vise. */
     const cutIncertain=differe?.identity?.cut??s.intent?.identity?.cut??b?.activeIdentity?.cut;
     if($('close-uncertain'))$('close-uncertain').textContent='Archiver le résultat interrompu'+(Number.isFinite(Number(cutIncertain))?' · cut '+entier(cutIncertain):'');
     /* 4.7.21 : « Nouveau lot » choisi, « Démarrer » devient le bouton plein, avant « Reprendre ». */
     const demarrer=fini&&nouveauLot?['start-batch']:[];
     hierarchie(['close-uncertain','manual-completion',...demarrer,'retry','resume','pause',...(fini&&!nouveauLot?['dataset','new-batch','start-batch']:['start-batch','dataset','new-batch']),'manual-takeover','explicit-skip','stop'],
       {ink:['close-uncertain','manual-completion','pause'],danger:['explicit-skip','stop']});
   }
   if(s.connection?.status==='unavailable'&&!active(s)&&!s.busy){$('connection')?.setAttribute('open','');note(s.connection.message,true);}
   button('connect',{disabled:busy||recording(s)});button('dataset',{disabled:busy||active(s)});button('journal',{disabled:working});if(uiError)note(uiError,true);
 }
 async function refresh(){if(refreshing)return;refreshing=true;try{render(await api('view'));}catch(e){note(e.message,true);}finally{refreshing=false;}}
 async function connect(){const value=$('tabs')?.value;if(!value)throw Error('Choisis ton onglet ESV dans Connexion à ESV.');await api('connect',{tabId:Number(value)});$('connection').open=false;}
 async function discover(){if(which==='home')return;const tabs=await api('list-tabs');$('tabs').replaceChildren();
   if(tabs.length!==1){const o=document.createElement('option');o.value='';o.textContent=tabs.length?'Choisir l’onglet à utiliser…':'Ouvre ESV dans Edge';$('tabs').append(o);}
   for(const t of tabs){const o=document.createElement('option');o.value=t.id;o.textContent=t.title||'ESV';$('tabs').append(o);}
   const s=await api('view');if(tabs.length===1&&!active(s)&&!s.busy&&!['RUNNING','PAUSED'].includes(s.batch?.state))await connect();
   else if(!tabs.length||tabs.length>1&&!s.current)$('connection').open=true;
 }
 function saveBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
 /* V4.5-R — export en flux, compacté et segmenté.
  *
  * L'ancienne version construisait `serialized.join(',')`, soit UNE chaîne JS de
  * plusieurs dizaines de Mo, en plus des objets déjà chargés et du Blob final.
  * Au-delà d'environ 64 Mo la fenêtre n'y survivait pas et la session entière
  * devenait intéléchargeable : toute la collecte était perdue.
  *
  * Trois changements : on ne concatène plus jamais (le Blob reçoit les morceaux
  * séparément), on relâche chaque nuage aussitôt sérialisé, et on coupe en
  * segments autonomes sous un budget d'octets. */
 /* Budget appliqué au FICHIER produit, métadonnées et dictionnaires compris.
  * Mesure sur un export réel du 15/09 : 27,3 Mo de nuages donnaient un fichier
  * de 40,7 Mo une fois ajoutés 7,2 Mo de dictionnaires et 6,2 Mo de
  * métadonnées. Le budget ne portait que sur les nuages, d'où le dépassement.
  * 48 Mo laisse une marge nette sous la limite de téléchargement observée. */
 const SET=()=>globalThis.BananeSettings;
 /* Lecture directe du stockage partagé avec le service worker.
  * Le panneau est de la même origine que lui, donc c'est la même base. Cela
  * évite le message géant qui échouait au-delà de 64 MiB — la vraie limite
  * rencontrée sur le terrain, celle de chrome.runtime.sendMessage. */
 let magasin=null;
 function store(){
   if(magasin!==null)return magasin;
   try{magasin=typeof BananeStorage3==='function'?new BananeStorage3():false;}catch{magasin=false;}
   return magasin;
 }
 async function lireDirect(nom,sessionId){
   const s=store();if(!s)return null;
   try{
     const tout=await s.all(nom);
     return tout.filter(x=>x.nativeSessionId===sessionId);
   }catch{return null;}
 }
 async function lireNuage(id){
   const s=store();
   if(s){try{const c=await s.getCloud(id);if(c)return c;}catch{/* repli message */}}
   return api('cloud',{id});
 }
 const EXPORT_SEGMENT_BYTES=SET()?.export.segmentBytes??48*1024*1024;
 const MIN_OBJECTS_PER_SEGMENT=SET()?.export.minObjectsPerSegment??48;
 // Réserve : le dernier nuage peut introduire un repère neuf (jusqu'à ~40 Ko)
 // et l'en-tête est replié à nouveau à la fermeture. Mesuré sans réserve :
 // 50,3 Mo pour un budget de 48. On vise donc un fichier réellement sous budget.
 const SEGMENT_RESERVE_BYTES=SET()?.export.segmentReserveBytes??4*1024*1024;
 const compactor=()=>globalThis.BananeNativeExport||null;
 async function writeSegments(data,prefix,{segmentBytes=EXPORT_SEGMENT_BYTES,compact=SET()?.export.compact!==false,label='',startIndex=0}={}){
   const {cloudIds,...metadata}=data,X=compact?compactor():null;
   const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
   const exportTrace={cloudObjects:0,chunks:0,captureSummaries:0,pointsExported:0};
   const written=[],acked=[];
   let interner=null,head='',parts=[],bytes=0,inSegment=0,segment=0;
   // Taille réelle du fichier en cours : en-tête REPLIÉ + nuages + dictionnaires.
   // Mesurer les métadonnées non repliées serait très pessimiste (50 Mo contre
   // 6 Mo repliés sur une session de 58 visites) et découperait à l'infini.
   const foldMeta=()=>JSON.stringify(X?X.foldRefs(metadata,interner):metadata).slice(0,-1);
   const fileBytes=()=>bytes+(interner?interner.bytes:0);
   // L'en-tête est sérialisé à la FERMETURE du segment : sinon `exportTrace`,
     // calculé au fil de la boucle, n'atterrissait jamais dans le fichier.
     const openSegment=()=>{interner=X?X.createInterner():null;head=foldMeta();parts=[];bytes=head.length;inSegment=0;};
   const closeSegment=()=>{if(!inSegment)return;segment++;
     // Terrain 15/09 : la trace n'était posée qu'après la boucle, donc seul le
     // DERNIER segment la portait. On la fige à chaque fermeture, avec l'état
     // cumulé à cet instant et ce que ce segment contient en propre.
     metadata.exportTrace={...exportTrace,
       completedAt:new Date().toISOString(),
       segmentIndex:startIndex+segment,segmentObjects:inSegment,
       cumulative:true,allRequestedObjectsPresent:exportTrace.cloudObjects===cloudIds.length};
     head=foldMeta();
     const info=`,"segment":${JSON.stringify({index:startIndex+segment,stamp,objects:inSegment,format:'banane-native-export-segment-v1',...(X?{selfContained:true}:{})})}`;
     const dict=X?`,"dictionaries":${JSON.stringify(interner.dictionaries)}`:'';
     const fmt=X?`,"format":"${X.FORMAT}","compactedFrom":"${metadata.format||'banane-native-session-v2'}"`:'';
     const blob=new Blob([head,info,fmt,',"clouds":[',...parts,']',dict,'}'],{type:'application/json'});
     const name=`${prefix}-${stamp}${label}-seg${String(startIndex+segment).padStart(2,'0')}.json`;
     saveBlob(blob,name);written.push({name,objects:inSegment,approxBytes:bytes});parts=[];};
   openSegment();
   for(let i=0;i<cloudIds.length;i++){
     if(i%25===0||i===cloudIds.length-1)
       note(`Préparation du fichier : ${i+1} / ${cloudIds.length} objets LiDAR${segment?` · ${segment} segment(s) écrit(s)`:''}…`);
     let cloud=await lireNuage(cloudIds[i]);
     if(!cloud)throw Error('Un LiDAR manque dans le stockage. Les autres données restent conservées.');
     if(cloud.format==='banane-native-lidar-chunk-v1'){const points=cloud.pointsSceneRelative?.length||0;
       cloud.storageTrace={...(cloud.storageTrace||{}),pointsSaved:points,pointsExported:points};exportTrace.chunks++;exportTrace.pointsExported+=points;}
     if(cloud.format==='banane-native-lidar-capture-v2'){cloud.trace={...(cloud.trace||{}),pointsExported:cloud.trace?.pointsSaved||0};
       for(const side of ['left','right'])if(cloud.trace.perRail?.[side])cloud.trace.perRail[side].pointsExported=cloud.trace.perRail[side].pointsSaved||0;exportTrace.captureSummaries++;}
     let text=JSON.stringify(X?X.compactCloud(cloud,interner,{}):cloud);
     /* Deux planchers, pour la même raison : chaque segment répète les
      * métadonnées et reconstruit son dictionnaire. Terrain du 15/09 : un
      * segment de queue isolait 1,8 Mo de nuages au prix de 13,4 Mo de surcoût.
      * On ne coupe donc que si le segment courant est déjà substantiel ET si ce
      * qui reste justifie son propre surcoût. Le dépassement éventuel est borné
      * par la queue non coupée, très en dessous de la limite de téléchargement. */
     const restant=cloudIds.length-i;
     if(inSegment>=MIN_OBJECTS_PER_SEGMENT&&restant>=MIN_OBJECTS_PER_SEGMENT&&
        fileBytes()+text.length+SEGMENT_RESERVE_BYTES>segmentBytes){closeSegment();openSegment();
       /* KI-060 (4.7.20) : ce nuage ouvre le segment suivant ; il est compacté à
        * nouveau avec le dictionnaire de ce segment, sinon ses références visent
        * celui du segment qu'on vient de fermer. */
       if(X)text=JSON.stringify(X.compactCloud(cloud,interner,{}));}
     cloud=null; // relâché : seul le texte reste en mémoire
     if(inSegment)parts.push(',');
     parts.push(text);bytes+=text.length+1;inSegment++;exportTrace.cloudObjects++;acked.push(cloudIds[i]);
   }
   closeSegment();
   return {written,acked,exportTrace,segments:segment};
 }
 /* Assemble le jeu d'export : manifeste léger par message, records et
  * événements lus directement dans le stockage. */
 async function assembler(manifeste){
   const id=manifeste.sessionId;
   const records=await lireDirect('records',id);
   const events=await lireDirect('events',id);
   if(records&&events){
     records.sort((a,b)=>(a.visitIndex??0)-(b.visitIndex??0));
     events.sort((a,b)=>(a.eventSeq||a.event_seq||0)-(b.eventSeq||b.event_seq||0));
     const {sessionId,recordCount,eventCount,alreadyExported,exportAdvice,...reste}=manifeste;
     return {...reste,records,events};
   }
   // Repli : ancien chemin par message, qui peut échouer sur une grosse session.
   note('Lecture directe indisponible, repli sur le transfert par message…');
   return api('native-export-plan');
 }
 async function dataset(data,prefix,options={}){
   const {written,acked,exportTrace,segments}=await writeSegments(data,prefix,options);
   const many=segments>1?` en ${segments} segments (à fusionner avec tools/merge-segments.cjs)`:'';
   if($('export-status'))$('export-status').textContent=
     `Fichier préparé${many} : ${data.records?.length??0} enregistrements et ${exportTrace.cloudObjects} LiDAR, ${exportTrace.pointsExported} points. Envoie ce JSON pour l’analyse.`;
   note(`Export terminé : ${written.map(w=>w.name).join(', ')}`);
   return {written,acked,segments};
 }
 /* Vidage automatique déclenché par le conseil du service worker : un segment
  * part sur le disque avant d'atteindre la limite, donc rien n'est perdu même
  * si la session est interrompue ensuite. */
 /* Santé de la collecte, visible pendant le travail dans ESV. Avant, une
  * dégradation du collecteur ou des captures perdues ne se voyaient qu'après
  * analyse hors ligne de l'export — donc trop tard pour réagir. */
 const LEVEL_TEXT={FULL:'complet',DEGRADED:'réduit',METADATA_ONLY:'métadonnées seules'};
 const mo=n=>(n/1048576).toFixed(n>=10485760?0:1)+' Mo';
 async function renderHealth(){
   if(!$('native-health'))return;
   let h=null;
   try{h=await api('native-health');}catch{return;}
   if(!h||!h.cloudsStored&&!h.visits){$('native-health').hidden=true;if($('native-tuiles'))$('native-tuiles').hidden=true;return;}
   $('native-health').hidden=false;
   const set=(id,v)=>{if($(id))$(id).textContent=v;};
   set('h-bytes',mo(h.bytesStored));
   set('h-pending',h.bytesPending?`dont ${mo(h.bytesPending)} pas encore écrits (seuil ${mo(h.watermark)})`:'tout est écrit sur disque');
   set('h-seg',String(h.segments));
   set('h-clouds',`${h.cloudsExported} / ${h.cloudsStored} objets LiDAR à l’abri`);
   /* Budget et refus ne sont PAS des pannes. Terrain du 15/09 : 530 budgets +
    * 86 refus de cut = 616 « échecs » affichés en rouge, dont zéro panne. */
   set('h-cap',`${h.captureCompleted} réussies · ${h.captureFailed} en panne`);
   const aPart=[];
   if(h.captureBudgeted)aPart.push(`${h.captureBudgeted} au budget par visite`);
   if(h.captureRefused)aPart.push(`${h.captureRefused} refus de cut`);
   set('h-caprate',aPart.length?`${aPart.join(' · ')} — normales, pas des pannes`
     :h.captureFailureRate?`${h.captureFailureRate} % d’échec`:'');
   set('h-queue',h.queueDepth===null?'—':`${h.queueDepth} en attente`);
   set('h-dropped',h.dropped?`${h.dropped} événements jetés`:'aucun événement jeté');
   set('h-level',LEVEL_TEXT[h.degradationLevel]||h.degradationLevel);
   set('h-peak',h.degradationPeak!==h.degradationLevel
     ? `pire niveau atteint : ${LEVEL_TEXT[h.degradationPeak]||h.degradationPeak}${h.recoveries?` · ${h.recoveries} rétablissement(s)`:''}`
     : '');
   const ecartes=(h.setAside||0)+(h.refused||0);
   if($('h-aside-box')){$('h-aside-box').hidden=!ecartes;set('h-aside',String(ecartes));}
   renderQualite(h.quality);
   /* Piste H : trois tuiles en tête de la vue Natif. */
   if($('native-tuiles')){const q=h.quality;$('native-tuiles').hidden=false;
     poser($('native-tuiles'),tuiles([['Captures',String(h.captureCompleted??0),'',`${h.captureFailed??0} en panne`],
       ['Volume',fr1((h.bytesStored||0)/1048576),'','Mo conservés'],
       ['Qualité',q&&q.railQualifiedRate!==null&&q.railQualifiedRate!==undefined?`${q.railQualifiedRate} %`:'—','',q?.railsObserved?`${q.railsQualified} sur ${q.railsObserved}`:'repères qualifiés']]));}
   /* La note doit NOMMER la cause. La capture du 15/09 montrait « niveau :
    * complet » au-dessus de « la collecte est gênée » : deux affirmations
    * contradictoires, dont aucune n'indiquait que l'alerte venait en réalité du
    * taux d'échec de capture. */
   const causes=[];
   if(h.degradationLevel!=='FULL')causes.push(`niveau réduit à « ${LEVEL_TEXT[h.degradationLevel]||h.degradationLevel} »`);
   if(h.captureFailureRate>=25)causes.push(`${h.captureFailureRate} % des captures LiDAR échouent (${h.captureFailed} sur ${h.captureCompleted+h.captureFailed})`);
   if(h.dropped>0)causes.push(`${h.dropped} événement(s) jeté(s)`);
   if(h.setAside>0)causes.push(`${h.setAside} élément(s) écarté(s)`);
   const alerte=causes.length>0;
   $('native-health').classList.toggle('health-alert',alerte);
   $('native-health').classList.toggle('health-ok',!alerte);
   const detail=ecartes&&h.setAsideItems.length
     ? ` Causes conservées : ${h.setAsideItems.map(i=>i.reason).slice(0,2).join(' ; ')}.`:'';
   set('h-note',alerte
     ? `Collecte gênée : ${causes.join(' · ')}.${h.refused?` ${h.refused} refus définitif(s), normaux, non comptés comme pannes.`:''}${detail}`
     : `Collecte au niveau complet. ${h.visits} visite(s) observée(s).${h.refused?` ${h.refused} refus définitif(s), normaux.`:''}`);
 }
 /* Réglages consultables : la collecte ne doit pas être une boîte noire.
  * Rendu une seule fois, depuis la source unique src/settings.js. */
 let reglagesRendus=false;
 function renderReglages(){
   const hote=$('reglages-liste'),S=SET();
   if(!hote||reglagesRendus||!S)return;
   reglagesRendus=true;
   let groupe=null;
   for(const r of S.describe()){
     if(r.groupe!==groupe){groupe=r.groupe;
       const t=document.createElement('p');t.className='settings-group';t.textContent=groupe;hote.append(t);}
     const dl=document.createElement('dl');dl.className='setting';
     const dt=document.createElement('dt');dt.textContent=r.nom;
     const dd=document.createElement('dd');dd.textContent=r.valeur;
     const p=document.createElement('p');p.textContent=r.pourquoi;
     dl.append(dt,dd,p);hote.append(dl);
   }
 }
 /* Qualité de capture : ce qui conditionne réellement le rendement du moteur.
  * Le flanc interne du champignon est le verrou — il lui en faut 6, la capture
  * en fournit 0 à 1 — et le filtre de visibilité en retire les deux tiers.
  * Autant le voir pendant la collecte plutôt que de le découvrir après coup. */
 /* Motifs d'exclusion en clair : le panneau ne doit pas afficher des étiquettes
  * de code à un opérateur en cabine. */
 const MOTIF={
   'roi-point-count-below-minimum':'trop peu de points dans la zone',
   'engine-useful-point-count-below-minimum':'trop peu de points utiles au moteur',
   'longitudinal-coverage-insufficient':'balayage longitudinal trop court',
   'longitudinal-span-insufficient':'étendue longitudinale trop faible',
   'transform-invalid':'repère non inversible',
   'capture-reference-association-unverified':'association au repère non vérifiée',
   'capture-interrupted-before-stable-boundary':'capture interrompue avant frontière stable'};
 function renderQualite(q){
   const boite=$('native-quality');
   if(!boite)return;
   if(!q||!q.snapshotsTotal&&!q.railsObserved){boite.hidden=true;return;}
   boite.hidden=false;
   const set=(id,v)=>{if($(id))$(id).textContent=v;};
   /* Chiffre de tête : les repères ayant obtenu au moins une fois un instantané
    * qualifié. C'est lui qui conditionne une proposition du moteur. Le taux par
    * instant de capture était trompeur — il comptait en échec toute capture
    * arrêtée par un changement de cible ou de vue, ce qui n'est pas un défaut
    * de couverture. Terrain du 15/09 : 8 % par instant, 100 % par repère sur
    * exactement les mêmes données. */
   set('q-rails',q.railsObserved?`${q.railsQualified} / ${q.railsObserved}`:'—');
   set('q-rails-note',q.railQualifiedRate===null?''
     :`${q.railQualifiedRate} % des repères observés${q.railsTruncated?' (suivi borné)':''}`);
   set('q-snap',`${q.snapshotsQualified} / ${q.snapshotsTotal}`);
   set('q-snap-rate',q.interruptedOnly
     ? `dont ${q.interruptedOnly} écarté(s) pour interruption seule, pas pour manque de points`
     : q.qualifiedRate===null?'':`${q.qualifiedRate} % qualifiés à l’instant de la capture`);
   set('q-clip',q.clipDropRate===null?'—':`${q.clipDropRate} %`);
   const face=q.faceKept+q.faceDropped;
   set('q-face',face?`${q.faceKept} / ${face}`:'—');
   set('q-face-note',q.faceDropRate===null?'':`${q.faceDropRate} % retirés par le clipping`);
   const rendement=q.railQualifiedRate!==null&&q.railQualifiedRate<60;
   const serre=q.faceDropRate!==null&&q.faceDropRate>=50;
   boite.classList.toggle('health-alert',rendement||serre);
   const causes=Object.entries(q.exclusionReasons||{})
     .filter(([r])=>r!=='capture-interrupted-before-stable-boundary')
     .sort((a,b)=>b[1]-a[1]).slice(0,2).map(([r,n])=>`${MOTIF[r]||r} (${n})`);
   set('q-note',rendement
     ? `Moins de 60 % des repères observés obtiennent un instantané qualifié.${causes.length?' Causes dominantes : '+causes.join(' ; ')+'.':''}`
     : serre
     ? 'Le moteur exige au moins 6 points de flanc interne pour proposer un placement. Le filtre de visibilité en retire la majorité : c’est le premier frein au rendement, à vérifier côté réglage des boîtes de découpe ESV.'
     : `Chaque repère observé a obtenu un instantané qualifié.${q.coverageShort?` ${q.coverageShort} instant(s) de capture écarté(s) pour couverture réellement insuffisante.`:''}`);
 }
 let autoExporting=false;
 async function autoExportIfAdvised(){
   if(autoExporting||working)return;
   try{
     const advice=await api('native-export-advice');
     if(!advice?.due)return;
     autoExporting=true;
     note(`Vidage automatique : ${(advice.bytesPending/1048576).toFixed(0)} Mo en attente, écriture d’un segment…`);
     const manifeste=await api('native-export-manifest');
     if(!manifeste?.cloudIds?.length){autoExporting=false;return;}
     const plan=await assembler(manifeste);
     const {acked}=await writeSegments(plan,'banane-native-v4',{label:'-auto',startIndex:advice.segments||0});
     await api('native-export-ack',{ids:acked});
     note(`Segment écrit automatiquement : ${acked.length} objets LiDAR mis à l’abri.`);
   }catch(e){note('Vidage automatique impossible : '+e.message,true);}
   finally{autoExporting=false;}
 }
 async function action(id,fn){if(working)return;uiError=null;working=true;if(state)render(state);try{await fn();}catch(e){uiError=e.message;working=false;if(state)render(state);note(e.message,true);return;}working=false;await refresh();}
 function on(id,fn){if($(id))$(id).onclick=()=>action(id,fn);}
 /* Navigation interne : plus aucune fenetre n'est ouverte depuis l'interface. */
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>naviguer(b.dataset.view));
 on('connect',connect);on('native-start',()=>api('native-start'));on('native-pause',()=>api('native-pause'));on('native-resume',()=>api('native-resume'));
 /* Fin de session et re-téléchargement passent aussi par le manifeste léger :
  * l'ancien chemin renvoyait toute la session en un message et échouait
  * au-delà de 64 MiB. */
 async function exportComplet(prefix){
   const manifeste=await api('native-export-manifest',{all:true});
   return dataset(await assembler(manifeste),prefix);
 }
 on('native-end',async()=>{await api('native-end');return exportComplet('banane-native-v4');});
 on('native-download',()=>exportComplet('banane-native-v4'));
/* Abandon : irréversible, donc une confirmation qui dit ce qui disparaît et
 * combien. Le compte rendu du service worker est affiché tel quel — un
 * effacement muet ne serait pas vérifiable. */
on('native-discard',async()=>{
  const h=await api('native-health').catch(()=>null);
  const quoi=h?`${h.cloudsStored} objet(s) LiDAR et ${h.visits} visite(s)`:'toutes les données de cette session';
  if(!confirm(`Supprimer définitivement ${quoi} ?\n\nAucun export ne sera produit. Les segments déjà téléchargés sur ton disque ne sont pas touchés.\n\nCette action est irréversible.`))
    throw Error('Abandon annulé : rien n’a été supprimé.');
  const r=await api('native-discard');
  note(`Session abandonnée : ${r.clouds} objet(s) LiDAR, ${r.records} visite(s) et ${r.events} événement(s) supprimés.`);
});
    on('start-batch',async()=>{if(!state?.current)throw Error('Connecte ESV avant de lancer le lot.');
   await api('settings',{mode:'automatic-test'});
   /* 4.7.21 : réglages fixes — rail non résolu différé, décision sur le lot
    * appliquée, proposition expérimentale tentée (le lot GCV1 la force déjà).
    * Premier cut : celui qu'ESV affiche, sauf s'il a été saisi à la main. */
   const cut=Number(state.current.identity.cut),debut=edited.has('start')?Number($('start').value):cut;
   const finTexte=String($('end').value??'').trim(),fin=finTexte===''?null:Number(finTexte);
   if(fin!==null&&(!Number.isInteger(fin)||fin<debut))throw Error('Dernier cut : un numéro égal ou après le premier cut, ou vide pour aller jusqu’à la fin de la partie.');
   return api('start',{part:state.current.identity.part,start:debut,...(fin===null?{end:FIN_PARTIE,endMode:'partie'}:{end:fin}),testConfirmed:true,allowNavigationEvidence:true,
     lowConfidence:'attempt',unresolvedPolicy:'defer',lotDecision:'apply',geometryEngine:'geometry-candidate-v1',
     ...($('lot-reprise')?.checked&&!$('lot-reprise-row')?.hidden?{lotReprise:true}:{})});});
 /* Reprise cochée : bornes du premier différé à la fin du lot précédent. */
 if($('lot-reprise'))$('lot-reprise').onchange=()=>{const b=state?.batch,d=(b?.deferred||[]).map(x=>x.identity?.cut).filter(Number.isInteger).sort((x,y)=>x-y);
   if($('lot-reprise').checked&&d.length){$('start').value=d[0];$('end').value=finDePartie(b.scope)?'':b.scope.end;edited.add('start');edited.add('end');}};
 for(const id of ['pause','resume','stop','close-uncertain'])on(id,()=>api(id));
 on('retry',()=>api('retry'));
 /* « Nouveau lot » ne lance rien : il rouvre les bornes et « Démarrer ». */
 if($('new-batch'))$('new-batch').onclick=()=>{nouveauLot=true;edited.delete('start');edited.delete('end');if(state)render(state);};
 for(const nom of ['lot','native'])if($(nom+'-details-toggle'))$(nom+'-details-toggle').onclick=()=>{tiroirs[nom]=!tiroirs[nom];tiroir(nom);};
 /* SKIP explicite : décision envoyée à ESV, qui ne se défait pas depuis Banane —
  * jamais le bouton plein, toujours confirmée (« La ligne », règle 2). */
 on('explicit-skip',()=>{if(typeof confirm==='function'&&!confirm('Passer ce cut en SKIP dans ESV ?\n\nLa décision est envoyée à ESV et ne se défait pas depuis Banane.'))
   throw Error('SKIP annulé : rien n’a été envoyé.');return api('explicit-skip');});
 // Reprise manuelle : le pilote rend la main, sans ouvrir aucune fenêtre.
 on('manual-takeover',()=>api('manual-takeover'));
 /* V4.6.0 : l'opérateur déclare avoir traité le cut dans ESV. Banane journalise
  * la reprise sans prétendre l'avoir validée, puis repart au cut suivant. */
 on('manual-completion',()=>api('manual-completion'));
 on('dataset',async()=>dataset(await bilanPilote(),'banane-bilan-v4'));
 /* 4.7.19 (KI-059) — EXPORTS DU PILOTE SANS MESSAGE GÉANT.
  * Journal, bilan, diagnostic et corpus passaient en UN message du service
  * worker, limité à 64 Mio : un long lot (65 Ko de journal par cut) l'aurait
  * dépassé. Comme le Natif depuis la 4.5.3, le panneau lit événements et
  * enregistrements directement dans IndexedDB (même origine, même base) ; le
  * message ne porte plus que l'état. Le fichier est assemblé par morceaux,
  * sans chaîne géante. Stockage illisible d'ici : ancien chemin par message. */
 async function lireStore(nom){const s=store();if(!s)return null;try{return await s.all(nom);}catch{return null;}}
 function blobJson(meta,arrays){const head=JSON.stringify(meta),parts=[head.slice(0,-1)];let first=head==='{}';
   for(const [name,items] of Object.entries(arrays)){parts.push(`${first?'':','}${JSON.stringify(name)}:[`);first=false;
     items.forEach((x,i)=>parts.push((i?',':'')+JSON.stringify(x)));parts.push(']');}
   parts.push('}');return new Blob(parts,{type:'application/json'});}
 async function bilanPilote(){const [meta,events,records]=await Promise.all([api('dataset-meta'),lireStore('events'),lireStore('records')]);
   return events&&records?{...meta,events,records}:api('dataset');}
 async function diagnosticPilote(){const X=globalThis.BananeGCV1Export,events=X?await lireStore('events'):null;
   if(!events)return api('gcv1-diagnostic-export');
   return X.buildDiagnostic({...await api('gcv1-export-meta'),events});}
 async function planCorpusPilote(){const X=globalThis.BananeGCV1Export,s=store();
   if(!X||!s)return api('gcv1-corpus-export-plan');
   let presents;try{presents=new Set(await s.keys('clouds'));}catch{return api('gcv1-corpus-export-plan');}
   return X.buildCorpusPlan({diagnostic:await diagnosticPilote(),getCloud:async id=>presents.has(id)?{}:null});}
 on('gcv1-diagnostic-export',async()=>{
   const diagnostic=await diagnosticPilote();
   saveBlob(new Blob([JSON.stringify(diagnostic)],{type:'application/json'}),`banane-gcv1-diagnostic-${Date.now()}.json`);
   note(`Diagnostic GCV1 exporté : ${diagnostic.observationCount} observation(s).`);
 });
 on('gcv1-corpus-export',async()=>{
   const plan=await planCorpusPilote();
   if(plan.cloudIds.length)await dataset(plan,'banane-gcv1-corpus',{compact:false});
   else saveBlob(new Blob([JSON.stringify({...plan,clouds:[]})],{type:'application/json'}),`banane-gcv1-corpus-${Date.now()}.json`);
   if(plan.missingCaptureIds.length)note(`Corpus GCV1 exporté ; ${plan.missingCaptureIds.length} capture(s) LiDAR référencée(s) sont absentes du store.`,true);
   else note(`Corpus GCV1 exporté : ${plan.cloudIds.length} capture(s) LiDAR.`);
 });
 on('journal',async()=>{const name=`banane-journal-v4-${Date.now()}.json`;
   const [meta,events,records]=await Promise.all([api('journal-meta'),lireStore('events'),lireStore('records')]);
   if(events&&records){saveBlob(blobJson(meta,{events,records}),name);note(`Journal exporté : ${events.length} événements, ${records.length} enregistrements.`);return;}
   saveBlob(new Blob([JSON.stringify(await api('journal'))],{type:'application/json'}),name);});
 for(const id of ['start','end'])if($(id))$(id).oninput=()=>edited.add(id);
 /* Thème : celui du système par défaut ; la bascule, instantanée, est gardée pour cette fenêtre. */
 const CLE_THEME='banane.theme',sysSombre=()=>!!globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
 function appliquerTheme(t){const r=document.documentElement;if(r?.dataset){if(t==='light'||t==='dark')r.dataset.theme=t;else delete r.dataset.theme;}
   const sombre=t==='dark'||t!=='light'&&sysSombre();$('theme-toggle')?.setAttribute('aria-label',sombre?'Passer au thème clair':'Passer au thème sombre');}
 try{appliquerTheme(globalThis.localStorage?.getItem(CLE_THEME));}catch{appliquerTheme(null);}
 if($('theme-toggle'))$('theme-toggle').onclick=()=>{const actuel=document.documentElement?.dataset?.theme||(sysSombre()?'dark':'light'),suivant=actuel==='dark'?'light':'dark';
   try{globalThis.localStorage?.setItem(CLE_THEME,suivant);}catch{/* fenêtre sans stockage : bascule le temps de la fenêtre */}appliquerTheme(suivant);};
 /* Bandeau dans ESV : préférence gardée par le service worker. */
 const marquerBandeau=()=>$('bandeau-toggle')?.setAttribute('aria-pressed',String(bandeau));
 api('bandeau-etat').then(r=>{bandeau=r?.on===true;marquerBandeau();if(state)envoyerBandeau(state);}).catch(()=>{});
 if($('bandeau-toggle'))$('bandeau-toggle').onclick=()=>action('bandeau-toggle',async()=>{bandeau=!bandeau;bandeauEnvoye='';marquerBandeau();
   const t=state?texteBandeau(state):{texte:'BANANE',ton:''};await api('bandeau',{on:bandeau,text:t.texte,ton:t.ton});if(bandeau)bandeauEnvoye=t.texte+'|'+t.ton;
   note(bandeau?'Bandeau affiché en bas de la page ESV : il suit cette fenêtre et ne capte aucun clic.':'Bandeau retiré de la page ESV.');});
 appliquerVue();entree();
 discover().then(refresh).catch(e=>{uiError=e.message;note(e.message,true);$('connection')?.setAttribute('open','');});
 setInterval(()=>{if(!working)void refresh();},1000);
 // Contrôle du volume pendant la collecte : peu fréquent, jamais bloquant.
 // Le suivi continue quelle que soit la vue affichée : quitter l'onglet Natif
 // ne doit pas interrompre le vidage automatique d'une session en cours.
 setInterval(()=>{if(state&&nativeActive(state)){void autoExportIfAdvised();if(which==='native')void renderHealth();}},SET()?.export.advicePollMs??5000);
 if(which==='native'){renderReglages();void renderHealth();}
})();
