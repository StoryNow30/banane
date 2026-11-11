'use strict';
/* CH-104 : contrôle de solidité du panneau Graphite avant livraison (demande de l'intégrateur, 11/11). Huit points, chacun montré par le navigateur :
 *  1. chaque bouton affiché est cliquable pour de vrai (`elementFromPoint` au centre rend le bouton) et un bouton d'origine (`legacy:<id>`) envoie au
 *     service worker exactement ce qu'envoie le bouton d'origine `#<id>` cliqué directement ;
 *  2. changements d'état rapides : à la fin, le dernier état, une seule zone, rien à moitié sorti ;
 *  3. aucune erreur ni avertissement de console sur tout le parcours ;
 *  4. « réduire les animations » : rien ne reste invisible ;
 *  5. tailles 320 à 800 et textes longs : ni débordement ni troncature ;
 *  6. la police embarquée est chargée, aucune requête vers l'extérieur ;
 *  7. cent mises à jour de suite : le nombre de nœuds ne grossit pas ;
 *  8. mouvement : les animations vues sur quatre changements, et aucune propriété animée hors transform, opacity, color et le tracé de l'anneau.
 * Usage : CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-104/outils/controle.cjs [points, ex. 1,2]
 * Données fabriquées, API Chrome simulée, rien n'est envoyé à ESV. Sortie : une ligne par point, code de sortie 1 si un point échoue. */
const path=require('node:path');
const R=path.resolve(__dirname,'../../..');
const navigateur=require(R+'/tests/esv-maquette/navigateur.cjs'),{ouvrirPanneau}=require(R+'/tests/helpers/panneau-local.cjs');
const {E,MESURE,FICHES,lot,id}=require('./capturer.cjs');
const POINTS=(process.argv[2]||'1,2,3,4,5,6,7,8').split(',').map(Number);
const dater=s=>JSON.parse(JSON.stringify(s).replace(/"MAINTENANT-(\d+)"/g,(_,x)=>JSON.stringify(new Date(Date.now()-x*1000).toISOString())));
const etatDe=e=>dater({connection:e.connexion||{status:'ready',observedAt:'t',message:null,tabId:1},...e.state});
const console_=[];
/* Une page du panneau : `rapide` ramène la relecture de la vue de 1 s à 40 ms (pour enchaîner les états) ; tout message non périodique est noté. */
async function page_(nav,e,vp,{rapide=false,calme=false,requetes=null}={}){
 const ctx=await nav.newContext({viewport:vp,deviceScaleFactor:1,reducedMotion:calme?'reduce':'no-preference'});const page=await ctx.newPage();
 page.on('pageerror',x=>console_.push('ERREUR '+x.message));
 page.on('console',m=>{if(['error','warning'].includes(m.type())&&!/Failed to load resource|net::ERR_FILE_NOT_FOUND/.test(m.text()))console_.push(m.type()+' : '+m.text());});
 if(requetes)page.on('request',r=>requetes.push(r.url()));
 await page.addInitScript(({state,rel,fiches,rapide,onglets})=>{
  if(rapide){const si=window.setInterval;window.setInterval=(f,t,...a)=>si(f,t===1000?40:t,...a);}
  const reponses={view:state,'list-tabs':onglets||[{id:1,title:'ESV',pret:true,utilise:true,index:0,windowId:1,active:true}],'choix-lot-etat':{clicHumain:'tel-quel',regleGrappeDifferes:false},'raison-choix-etat':{actif:false,touches:'chiffres'},
   'relecture-choix-etat':{mode:'corriger'},'relecture-etat':rel,'bandeau-etat':{on:false},'fiches-depart':{fiches}};
  const stockage={};window.__m=[];window.__note=false;
  window.fetch=async()=>({json:async()=>({totaux:{tous:{corriges:2731}},creeLe:'2026-10-20T08:00:00Z'})});
  window.chrome={runtime:{id:'essai',getURL:p=>new URL(p,location.href).href,connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
   sendMessage:async m=>{if(window.__note)window.__m.push(JSON.stringify({action:m.action,args:m.args||{}}));if(m.action==='view'&&window.__etat)return {result:window.__etat};return {result:m.action in reponses?reponses[m.action]:{}};}},
   storage:{local:{get:async()=>({...stockage}),set:async o=>{Object.assign(stockage,o);}}},windows:{getCurrent:async()=>({id:1,type:'normal',width:600,height:760}),update:async()=>({})}};
 },{state:etatDe(e),rel:e.rel||{choix:'corriger',lot:null,passe:null},fiches:e.fiches||[],rapide,onglets:e.onglets||null});
 await ouvrirPanneau(page,e.hash||'#automatic');await page.waitForTimeout(rapide?500:1300);
 if(e.file){await page.evaluate(()=>window.ArianeUi5.agir('sg:onglet-file'));await page.waitForTimeout(200);if(typeof e.file==='number'){await page.evaluate(n=>window.ArianeUi5.agir('sg:file-n:'+n),e.file);await page.waitForTimeout(rapide?300:1200);}}
 for(const a of e.actions||[]){await page.evaluate(a=>window.ArianeUi5.agir(a),a);await page.waitForTimeout(300);}
 if(e.origine)await page.evaluate(()=>{document.body.classList.remove('ui5');document.getElementById('ui5').hidden=true;});
 await page.waitForTimeout(700);
 return {page,ctx};
}
/* Les boutons affichés et actifs, avec ce que rend `elementFromPoint` au centre de chacun (après l'avoir amené dans sa zone de défilement). */
const BOUTONS=()=>[...document.querySelectorAll('#ui5 [data-act]')].filter(b=>b.getClientRects().length&&!b.disabled&&b.getAttribute('aria-disabled')!=='true'&&!b.closest('[inert]')&&!b.classList.contains('sg-voile')).map(b=>{
 b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,t=document.elementFromPoint(x,y);
 const COUCHE='.sg-voile,.sg-feuille,.sg-popover,.sg-palette,.sg-boite,.sg-tiroir,.sg-tech',c=t&&t.closest?t.closest(COUCHE):null;
 /* sous une couche ouverte (menu, palette, réglages, feuille) : recouvert exprès, la couche se ferme d'abord */
 return {sousCouche:!!c&&!c.contains(b),x,y,act:b.dataset.act,texte:(b.textContent||b.getAttribute('aria-label')||'').trim().slice(0,40),ok:!!t&&(t===b||b.contains(t)),dessus:t?(t.className&&t.className.baseVal!==undefined?t.className.baseVal:t.className)||t.tagName:'rien',dansFenetre:r.width>0&&r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1};});
const PERIODIQUE=/^(view|list-tabs|fiches-depart|relecture-etat|relecture-choix-etat|choix-lot-etat|raison-choix-etat|bandeau-etat|export-cache-etat|parts-history|.*-etat)$/;
async function messagesApres(page,geste){
 await page.evaluate(()=>{window.__m=[];window.__note=true;});await geste();await page.waitForTimeout(900);
 return (await page.evaluate(()=>{window.__note=false;return window.__m;})).filter(m=>!PERIODIQUE.test(JSON.parse(m).action||''));
}
const res={};const dire=(n,ok,t)=>{res[n]=ok;console.log(`Point ${n} : ${ok?'BON':'DÉFAUT'} · ${t}`);};
(async()=>{
 const {chromium}=require(navigateur.modulePlaywright());const nav=await chromium.launch({executablePath:navigateur.executable()});
 const ETATS=Object.entries(E).filter(([,e])=>!e.origine);
 const T600={width:600,height:760},T360={width:360,height:480};

 if(POINTS.includes(1)){
  let n=0,legacy=0,sous=0;const defauts=[];
  for(const [nom,e] of ETATS){
   for(const vp of [T600,T360]){
    const {page,ctx}=await page_(nav,e,vp);const B=(await page.evaluate(BOUTONS)).filter(b=>{if(b.sousCouche)sous++;return !b.sousCouche;});
    for(const b of B){n++;if(!b.ok)defauts.push(`${nom} ${vp.width} « ${b.texte} » (${b.act}) recouvert par ${b.dessus}`);else if(!b.dansFenetre)defauts.push(`${nom} ${vp.width} « ${b.texte} » hors de la fenêtre`);}
    if(vp===T600){
     /* même message que le bouton d'origine : un clic réel sur le bouton de Signal, puis, sur une page neuve, un clic sur `#<id>` */
     const L=[...new Set(B.filter(b=>/^legacy:/.test(b.act)).map(b=>b.act))];
     for(const act of L){
      const p1=await page_(nav,e,vp);const sel=`#ui5 [data-act="${act}"]`;
      const viser=async P=>{const c=(await P.evaluate(BOUTONS)).find(b=>b.act===act&&b.ok&&!b.sousCouche);if(c)await P.mouse.click(c.x,c.y);else defauts.push(nom+' '+act+' : introuvable au second passage');};
      const m1=await messagesApres(p1.page,()=>viser(p1.page));
      /* « Arrêter la Constellation » se confirme : le premier clic n'envoie rien, le second (après 400 ms) envoie */
      let m1b=m1;if(act==='legacy:file-secondaire'){await p1.page.waitForTimeout(500);m1b=await messagesApres(p1.page,()=>viser(p1.page));if(m1.length)defauts.push(`${nom} ${act} : le premier clic a envoyé ${m1.join(' ')}`);}
      await p1.ctx.close();
      const p2=await page_(nav,e,vp);const m2=await messagesApres(p2.page,()=>p2.page.evaluate(i=>document.getElementById(i).click(),act.slice(7)));await p2.ctx.close();
      legacy++;if(JSON.stringify(m1b)!==JSON.stringify(m2))defauts.push(`${nom} ${act} : Signal envoie ${JSON.stringify(m1b)}, le bouton d'origine ${JSON.stringify(m2)}`);
     }
    }
    await ctx.close();
   }
  }
  dire(1,!defauts.length,`${n} boutons contrôlés au centre (${ETATS.length} écrans × 2 tailles), ${legacy} clics réels (souris au centre) comparés au bouton d'origine, ${sous} boutons sous une couche ouverte laissés de côté${defauts.length?'\n   '+defauts.join('\n   '):''}`);
 }

 if(POINTS.includes(2)){
  const defauts=[];
  for(const vp of [T600,T360]){
   const {page,ctx}=await page_(nav,E.cours,vp,{rapide:true});
   const poser=async(nom,ms)=>{await page.evaluate(s=>{window.__etat=s;},etatDe(E[nom]));await page.waitForTimeout(ms);};
   const suite=['pause','cours','toi','cours','pause','cours','panne','cours','rattrapage','relecture','fin','cours','toi','cours','pause','toi'];
   for(const [i,nom] of suite.entries()){await poser(nom,i%3===0?45:90);
    if(i===5)await page.evaluate(()=>window.ArianeUi5.agir('sg:onglet-correction'));if(i===6)await page.evaluate(()=>window.ArianeUi5.agir('mode:native'));if(i===7)await page.evaluate(()=>window.ArianeUi5.agir('mode:automatic'));
    if(i===9)await page.evaluate(()=>{window.ArianeUi5.agir('sg:menu');window.ArianeUi5.agir('sg:fermer');window.ArianeUi5.agir('sg:tiroir');window.ArianeUi5.agir('sg:tiroir');});}
   await page.waitForTimeout(700);
   const r=await page.evaluate(()=>{const h=document.getElementById('ui5'),f=h.querySelector('.sg-fen');const cles=[...h.querySelectorAll('.sg-fil li')].map(x=>x.dataset.k);
    const pales=[...h.querySelectorAll('.sg-page *,.sg-actions *')].filter(x=>x.getClientRects().length&&Number(getComputedStyle(x).opacity)<1&&!x.disabled&&!x.closest('[disabled]')&&!x.matches('.sg-temps li,.sg-glyphe')).map(x=>x.className||x.tagName);
    return {enfants:h.children.length,fenetres:h.querySelectorAll('.sg-fen').length,zones:h.querySelectorAll('.sg-zone').length,sort:h.querySelectorAll('.sg-sort').length,etat:f.dataset.etat,teinte:f.dataset.teinte,mot:h.querySelector('.sg-mot').textContent,
     instruments:h.querySelectorAll('.sg-instrument').length,pieds:h.querySelectorAll('.sg-actions').length,doublons:cles.length-new Set(cles).size,pales,principal:h.querySelector('.sg-principal')?.textContent.trim(),anims:document.getAnimations().filter(a=>a.playState==='running'&&!/sg-pouls|sg-tourne|sg-tour/.test(a.animationName||'')&&document.getElementById('ui5').contains(a.effect?.target)).map(a=>(a.animationName||a.transitionProperty||'?')+' sur '+(a.effect.target.className||a.effect.target.tagName))};});
   const attendu={enfants:1,fenetres:1,zones:1,sort:0,etat:'alerte',teinte:'toi',mot:'À toi',instruments:1,pieds:1,doublons:0,pales:[],principal:'Réessayer ce cut',anims:[]};
   if(JSON.stringify(r)!==JSON.stringify(attendu))defauts.push(`${vp.width} : ${JSON.stringify(r)}`);
   await ctx.close();
  }
  dire(2,!defauts.length,`16 états enchaînés toutes les 45 à 90 ms avec changements d'onglet, menu et tiroir, aux deux tailles ; état final « À toi », une seule zone, rien de pâle ni en double${defauts.length?'\n   '+defauts.join('\n   '):''}`);
 }

 if(POINTS.includes(4)){
  const defauts=[];let n=0;
  for(const [nom,e] of ETATS){const {page,ctx}=await page_(nav,e,T360,{calme:true});n++;
   const r=await page.evaluate(()=>({invisibles:[...document.querySelectorAll('#ui5 *')].filter(x=>x.getClientRects().length&&Number(getComputedStyle(x).opacity)===0).map(x=>x.className||x.tagName),anims:document.getAnimations().filter(a=>a.playState==='running').length,texte:(document.querySelector('#ui5 .sg-fen')?.innerText||'').length}));
   if(r.invisibles.length||r.anims||r.texte<20)defauts.push(`${nom} : ${JSON.stringify(r)}`);await ctx.close();}
  dire(4,!defauts.length,`« réduire les animations » actif sur ${n} écrans : aucun élément à opacité 0, aucune animation en cours${defauts.length?'\n   '+defauts.join('\n   '):''}`);
 }

 if(POINTS.includes(5)){
  const defauts=[];let n=0;
  /* textes longs : cuts à cinq chiffres, compteur à quatre chiffres, 8 parties, phrases longues (alerte, incident) */
  const cinq=s=>JSON.parse(JSON.stringify(s).replace(/"(cut|start|end)":(\d{4})\b/g,(_,k,v)=>`"${k}":${Number(v)+44000}`));
  const gros=(()=>{const P=[];for(let i=0;i<1234;i++)P.push({identity:id(10000+i*2),cut:10000+i*2,durationMs:6000+(i%20)*100});const s=lot('RUNNING',4811,{cutStartedAt:'MAINTENANT-3'});
   s.batch={...s.batch,processed:P,deferred:[],sequence:[...P.map(x=>({identity:x.identity,cut:x.cut})),{identity:id(12468),cut:12468}],activeIdentity:id(12468),scope:{...s.batch.scope,start:10000,end:99000}};s.current={identity:id(12468)};return {state:s};})();
  const LONGS={...Object.fromEntries(['cours','toi','panne','rattrapage','relecture','fin','tiroir'].map(k=>[k+'-5chiffres',{...E[k],state:cinq(E[k].state)}])),'cours-1234':gros,
   'file-8':E['file-8'],'file-arret':E['file-arret'],'file-cours':E['file-cours'],'file-fin':E['file-fin'],'file-repos':E['file-repos'],'sans-onglet':E['sans-onglet'],'deux-onglets':E['deux-onglets'],'onglet-long':E['onglet-long'],'relecture-pause':E['relecture-pause'],'lot-arrete':E['lot-arrete'],panne:E.panne,echo:E.echo,aurore:E.aurore,reglages:E.reglages,menu:E.menu,palette:E.palette,esv:E.esv,pret:E.pret};
  for(const w of [320,360,480,560,600,800])for(const [nom,e] of Object.entries(LONGS)){const {page,ctx}=await page_(nav,e,{width:w,height:w<480?480:760});n++;
   const m=(await page.evaluate(MESURE)).filter(x=>!/^CONTRASTE/.test(x));if(m.length)defauts.push(`${nom} ${w} : ${m.join(' ; ')}`);await ctx.close();}
  dire(5,!defauts.length,`${n} écrans mesurés (largeurs 320, 360, 480, 560, 600, 800 ; cuts à cinq chiffres, 1 234 cuts traités, 8 parties) : ni débordement ni troncature${defauts.length?'\n   '+defauts.join('\n   '):''}`);
 }

 if(POINTS.includes(6)){
  const requetes=[];const {page,ctx}=await page_(nav,E.cours,T600,{requetes});
  await page.evaluate(()=>window.ArianeUi5.agir('sg:onglet-correction'));await page.waitForTimeout(300);await page.evaluate(()=>window.ArianeUi5.agir('sg:reglages'));await page.waitForTimeout(600);
  const origine=new URL(page.url()).origin,dehors=requetes.filter(u=>!u.startsWith(origine)&&!/^(data|blob|about):/.test(u));
  const f=await page.evaluate(async()=>{await document.fonts.ready;const faces=[...document.fonts].filter(x=>/Inter/.test(x.family)).map(x=>x.status);
   const mesure=fam=>{const c=document.createElement('canvas').getContext('2d');c.font='600 40px '+fam;return c.measureText('Constellation 4812 Arrêtée').width;};
   return {faces,famille:getComputedStyle(document.querySelector('#ui5 .sg-mot')).fontFamily,inter:mesure('"Inter"'),repli:mesure('system-ui'),sans:mesure('"Police-absente-xyz"')};});
  const police=requetes.filter(u=>/fonts\/Inter-latin-opsz-wght\.woff2/.test(u)).length;
  const ok=!dehors.length&&f.faces.includes('loaded')&&/^"?Inter/.test(f.famille)&&police>=1&&Math.abs(f.inter-f.sans)>0.5;
  dire(6,ok,`police Inter : fichier demandé ${police} fois au panneau lui-même, état ${f.faces.join('/')}, largeur d'un texte témoin ${f.inter.toFixed(1)} px contre ${f.sans.toFixed(1)} px pour la police de repli ; ${requetes.length} requêtes, ${dehors.length} vers l'extérieur${dehors.length?' : '+dehors.join(', '):''}`);
  await ctx.close();
 }

 if(POINTS.includes(7)){
  const {page,ctx}=await page_(nav,E.cours,T600,{rapide:true});const compte=()=>page.evaluate(()=>({ui5:document.querySelectorAll('#ui5 *').length,page:document.querySelectorAll('body *').length,fil:document.querySelectorAll('#ui5 .sg-fil li').length,anims:document.getAnimations().length,traites:document.querySelector('#ui5 .sg-trio dd')?.textContent}));
  const etape=async k=>{const s=etatDe(E.cours);const b=s.batch;for(let i=0;i<k;i++){const c=4812+i;b.processed.push({identity:id(c),cut:c,durationMs:6500+(i%9)*100});b.sequence.push({identity:id(c+1),cut:c+1});}b.activeIdentity=id(4812+k);s.current={identity:id(4812+k)};await page.evaluate(s=>{window.__etat=s;},s);await page.waitForTimeout(70);};
  for(let k=1;k<=10;k++)await etape(k);await page.waitForTimeout(500);const a=await compte();
  for(let k=11;k<=110;k++)await etape(k);await page.waitForTimeout(700);const b=await compte();
  const ok=b.ui5===a.ui5&&b.fil===a.fil&&b.fil<=8&&b.anims<=a.anims+1&&Number(b.traites)===Number(a.traites)+100;
  dire(7,ok,`cent mises à jour de suite (un cut de plus à chacune) : ${a.ui5} nœuds dans le panneau avant, ${b.ui5} après ; ${a.fil} lignes du fil avant, ${b.fil} après ; page entière (panneau d'origine caché compris, qui garde une case par cut) ${a.page} puis ${b.page} ; ${a.anims} puis ${b.anims} animations ; compteur de ${a.traites} à ${b.traites}`);
  await ctx.close();
 }

 if(POINTS.includes(8)){
  /* mouvement : pour quatre changements, les animations vues (élément, nom ou propriété, durée, propriétés animées) ; seules sont permises
   * transform, opacity, color et le tracé (`stroke-dasharray`) de l'anneau */
  const PERMIS=['offset','easing','composite','computedOffset','transform','opacity','color','strokeDasharray'];
  const VOIR=()=>document.getAnimations().filter(a=>document.getElementById('ui5').contains(a.effect?.target)).map(a=>{const t=a.effect.target,cles=[...new Set(a.effect.getKeyframes().flatMap(k=>Object.keys(k)))];
   return {sur:(t.getAttribute('class')||t.tagName.toLowerCase()).split(' ').slice(-1)[0]+(a.effect.pseudoElement||''),nom:a.animationName||('transition '+a.transitionProperty),duree:Math.round(a.effect.getTiming().duration),props:cles};});
  const suivre=async(page,etat,apres=120)=>{await page.evaluate(s=>{window.__etat=s;},etat);await page.waitForTimeout(apres);return page.evaluate(VOIR);};
  const plusUn=()=>{const s=etatDe(E.cours),b=s.batch;b.processed.push({identity:id(4812),cut:4812,durationMs:7000});b.sequence.push({identity:id(4813),cut:4813});b.activeIdentity=id(4813);s.current={identity:id(4813)};return s;};
  const p2=n=>{const s=etatDe(E.rattrapage);s.passeDifferes.ecrites=n;return s;};
  const suite=()=>{const s=etatDe(E['file-passage']);s.fileParties={...s.fileParties,etat:'lot',rang:2,enCours:{part:15,rang:2,lot:true},changement:null};return s;};
  const CAS=[['cours → à toi',E.cours,()=>etatDe(E.toi),null],['cours → cut suivant',E.cours,plusUn,null],['pourcentage qui avance (rattrapage 1 → 2 sur 3)',E.rattrapage,()=>p2(2),null],['Constellation, partie suivante',E['file-cours'],suite,'file']];
  const defauts=[],lignes=[];
  for(const [nom,depart,vers] of CAS){const {page,ctx}=await page_(nav,depart,T600,{rapide:true});const A=await suivre(page,vers());
   const vus=[...new Set(A.map(a=>`${a.sur} ${a.nom} ${a.duree} ms [${a.props.filter(p=>!['offset','easing','composite','computedOffset'].includes(p)).join(',')}]`))];
   lignes.push(`${nom} : ${vus.length?vus.join(' ; '):'aucune animation'}`);
   for(const a of A){const x=a.props.filter(p=>!PERMIS.includes(p));if(x.length)defauts.push(`${nom} : ${a.sur} anime ${x.join(',')}`);if(a.props.includes('strokeDasharray')&&!/sg-arc/.test(a.sur))defauts.push(`${nom} : stroke-dasharray animé hors de l'anneau (${a.sur})`);}
   if(!A.length)defauts.push(`${nom} : aucune animation vue`);await ctx.close();}
  dire(8,!defauts.length,`mouvement, quatre changements ; seules transform, opacity, color et le tracé de l'anneau sont animées\n   ${lignes.join('\n   ')}${defauts.length?'\n   DÉFAUTS : '+defauts.join(' ; '):''}`);
 }

 if(POINTS.includes(3)){
  /* le parcours complet : chaque écran, deux thèmes, deux tailles, plus les confirmations (arrêt de la Constellation, commande dangereuse de la palette) */
  let n=0;
  for(const theme of ['sombre','clair'])for(const vp of [T600,T360])for(const [nom,e] of Object.entries(E)){const {page,ctx}=await page_(nav,e,vp);n++;
   if(theme==='clair'&&!e.origine){await page.evaluate(()=>window.ArianeUi5.agir('sg:choix:theme:clair'));await page.waitForTimeout(400);}
   if(nom==='file-cours'){const b=await page.$('#ui5 [data-act="legacy:file-secondaire"]');if(b){await b.click();await page.waitForTimeout(500);await b.click().catch(()=>{});await page.waitForTimeout(300);}}
   if(nom==='palette'){await page.keyboard.type('arr');await page.keyboard.press('Enter');await page.waitForTimeout(200);await page.keyboard.press('Enter');await page.waitForTimeout(300);}
   if(nom==='cours'){await page.keyboard.press('Control+k');await page.waitForTimeout(200);await page.keyboard.press('Escape');for(const a of ['sg:menu','sg:reglages','sg:fermer','sg:esv','sg:fermer','sg:tiroir','sg:tiroir','mode:native','mode:automatic','sg:onglet-correction','mode:automatic']){await page.evaluate(a=>window.ArianeUi5.agir(a),a);await page.waitForTimeout(120);}}
   await ctx.close();}
  const C=[...new Set(console_)];
  dire(3,!C.length,`${n} parcours d'écran (tous les écrans, deux thèmes, deux tailles, onglets, menu, réglages, palette, confirmations) et les autres points : ${C.length} erreur ou avertissement de console${C.length?'\n   '+C.slice(0,12).join('\n   '):''}`);
 }
 await nav.close();
 process.exit(Object.values(res).every(Boolean)?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
