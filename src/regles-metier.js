(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./level-crossing.js'));
  else root.BananeReglesMetier=factory(root.BananeCaptureCore,root.BananeLevelCrossing);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,Crossing){
 'use strict';
 /* 5.0 — RÈGLES MÉTIER DE MIC, EN OMBRE (fiches/REGLES_METIER.md ; méthode : relecture de la partie 29 et réponses du 16/10).
  *
  * Module PUR, commun au service worker (événement `regles-metier-ombre` d'Orbite) et à l'outil de rejeu
  * (tools/regles-metier.cjs), pour que l'ombre de terrain et le rejeu ne puissent pas diverger. Il ne commande rien, ne lit
  * aucune pose humaine et ne rend jamais de position : des numéros de cut, des millimètres, des pourcentages.
  *
  * Ce qu'il traduit de la méthode de Mic :
  *   - PN avec ses marges, « contrôler chaque cut » : un cut du lot dont la chaussée affleure sur les QUATRE quarts autour des
  *     rails (intérieur et extérieur de chaque rail) est un cœur de PN. Deux cœurs CONSÉCUTIFS parmi les cuts vus (aucun cut vu
  *     non-cœur entre eux) et à 3 cuts au plus confirment le PN ; la plage à contrôler va de 4 cuts avant le premier cœur à 6 après
  *     le dernier (marges de Mic, 4 PN de la partie 29). « Consécutifs » (`pn.consecutifs`, fiches/PN_ROBUSTE.md, H6) : dès qu'on
  *     capture des verts, deux faux cœurs isolés finissent à 3 cuts l'un de l'autre (partie 1 du second projet : 447 au lot, 450 à
  *     l'Écho, 448 et 449 vus sans chaussée entre eux) ; une vraie chaussée, elle, ne s'interrompt pas. Règle
  *     `pn-chaque-cut` : un cut que le lot validerait dans un PN confirmé ou sa marge d'après est un cut que Mic contrôle de
  *     toute façon ; Ariane le lui laisse. Les 4 cuts d'avant sont déjà passés quand le PN est reconnu : ils ne sont que
  *     signalés (plage à contrôler).
  *     Pourquoi les quarts et pas `flushPct` seul : sur le second projet, la part globale « au ras » monte à côté d'un quai ou
  *     d'une autre voie au ras d'un SEUL côté (51 alertes sans PN à 30 %) ; le plus faible des quarts reste bas.
  *   - Grappe et ADV : un cut que le lot validerait alors qu'au moins 2 cuts différés PAR LE LOT tombent dans les 6 cuts
  *     d'avant, dont un à 2 cuts au plus (`grappe-differes`). C'est la forme que prend, dans un lot qui avance, la grappe
  *     d'invalides et le noyau d'une aiguille (différés « flanc », « pente », « ambiguïté »). Les cuts différés par la règle
  *     elle-même ne comptent pas : pas d'avalanche.
  *   - ADV avec ses marges (zone `adv`, EN OMBRE, aucune règle : fiches/DETECTION_ADV.md) : un cut du lot dont la capture montre
  *     un rail de plus autour des deux rails posés (aiguille, contre-rail, cœur, voie qui diverge ; `railsDePlus`) est une alerte ;
  *     deux alertes à 3 cuts au plus ouvrent la zone ; plage à contrôler de 30 cuts avant la première alerte à 30 après la dernière.
  *     Elle ne change aucun verdict ; ses verts sont signalés (`adv`) et la liste des verts à contrôler la reprend.
  *   - « Ne pas valider en place une pose d'extraction » : dans une zone (PN ou grappe), une validation dont aucun rail ne
  *     bouge de plus de 1 mm depuis la pose de départ d'ESV (`zone-validation-en-place`).
  *   - Verts à contrôler (lignes de la liste d'ESV autour du cut, statut valide, jamais traitées par un opérateur ni passées
  *     par le lot) : écartement à plus de 15 mm de la médiane des lignes valides de la partie vues jusque-là (« seuil par
  *     partie » ; 54 mauvais objets sur 54 en parties 12 et 13), intérieur et 3 cuts de marge d'une grappe de rouges (trois
  *     rouges au moins, trous de 5 cuts au plus), voisins d'un rouge isolé, verts de la plage d'un PN confirmé.
  *     Orbite ne visite pas les verts : ils sont SIGNALÉS, jamais posés ni validés.
  *
  * Activation (`src/settings.js`, `reglesMetier`) : coupée. Une règle activée ne peut que transformer en DIFFÉRÉ un cut que le
  * lot allait valider (`doitDifferer`) ; elle ne pose jamais, ne choisit jamais une position, ne touche ni un différé ni un
  * appui (l'appui d'un cut différé n'existe pas). Seul Mic active. */
 const DEFAULTS=Object.freeze({version:'regles-metier-v1',
  surface:Object.freeze({sidePointsMin:200,quadPointsMin:30,quadNombreMin:3,quadMinPct:50,flushMinPct:50}),
  pn:Object.freeze({confirmation:2,confirmationEcartCuts:3,consecutifs:true,margeAvant:4,margeApres:6}),
  grappe:Object.freeze({fenetreCuts:6,differesMin:2,procheCuts:2}),
  enPlace:Object.freeze({mm:1}),
  ecartement:Object.freeze({seuilMm:15,lignesMin:20}),
  /* ADV (fiches/DETECTION_ADV.md) : profil en travers de chaque rail, pas de 1 cm, ±40 cm, ±50 cm le long de la voie ; un pas est
   * « haut » si 90 % de ses points sont sous le dessus du rail moins 3 cm et qu'il l'est sur au moins la moitié des tranches de 10 cm. */
  adv:Object.freeze({version:'adv-rail-de-plus-v1',pasM:0.01,lateralM:0.4,longM:0.5,trancheM:0.1,zMinM:-0.4,zMaxM:0.2,pointsPas:3,
   hautM:-0.03,continuite:0.5,basM:-0.08,creuxM:-0.15,tete:Object.freeze([-0.09,0.03]),largeurMinPas:3,largeurMaxPas:16,
   contreRail:Object.freeze({debutMaxM:0.065,finMaxM:0.125}),platMax:0.5,sautPas:3,chutePas:5,
   confirmation:2,confirmationEcartCuts:3,trouCuts:10,margeAvant:30,margeApres:30}),
  verts:Object.freeze({trouCuts:5,grappeMin:3,margeGrappe:3}),
  memoireCuts:80});
 const REGLES=Object.freeze(['zone-validation-en-place','pn-chaque-cut','grappe-differes']);
 const SIDES=['left','right'],QUARTS=['leftIn','leftOut','rightIn','rightOut'];
 const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
 const fusion=(a,b)=>{const o={...a};for(const [k,v] of Object.entries(b||{}))o[k]=v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'?{...a[k],...v}:v;return o;};
 const cfgDe=options=>options?fusion(DEFAULTS,options):DEFAULTS;
 const med=v=>{const s=v.filter(Number.isFinite).sort((a,b)=>a-b);if(!s.length)return null;const m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};

 /* SURFACE AU RAS, par quart : mêmes points que le lecteur du passage à niveau de la décision du lot (points visibles, bande de 9
  * à 45 cm de chaque rail, ±60 cm le long de la voie, de −45 à +15 cm de la pose de départ ; « au ras » : moins de 5 cm sous elle).
  * `flushPct` est celui de `src/level-crossing.js` ; `quadMin` est le plus faible des quarts assez peuplés. */
 function surface(capture,options){const cfg=cfgDe(options).surface;
  const vis=capture?.visibleByClipBoxes,tous=Array.isArray(capture?.pointsSceneRelative)?capture.pointsSceneRelative:[];
  const pts=Array.isArray(vis)?tous.filter((_,i)=>vis[i]===true):tous,cap={rails:capture.rails,pointsSceneRelative:pts};
  const q=Object.fromEntries(QUARTS.map(k=>[k,{n:0,f:0}]));let n=0,f=0;
  for(const side of SIDES){const fr=Crossing.frameOf(cap,side);
   for(const p of pts){const {along,lat,z}=fr.local(p),a=Math.abs(lat);
    if(Math.abs(along)>0.6||a<0.09||a>0.45||z<-0.45||z>0.15)continue;
    const k=q[side+(lat>0?'In':'Out')];k.n++;n++;if(z>-0.05){k.f++;f++;}}}
  const flushPct=n?Math.round(100*f/n):null,peuples=QUARTS.filter(k=>q[k].n>=cfg.quadPointsMin);
  const quadMin=peuples.length>=cfg.quadNombreMin?Math.min(...peuples.map(k=>Math.round(100*q[k].f/q[k].n))):null;
  const adv=railsDePlus(capture,options);
  return {flushPct,sidePoints:n,quadMin,quarts:Object.fromEntries(QUARTS.map(k=>[k,q[k].n?Math.round(100*q[k].f/q[k].n):null])),
   coeurPN:n>=cfg.sidePointsMin&&flushPct!=null&&flushPct>=cfg.flushMinPct&&quadMin!=null&&quadMin>=cfg.quadMinPct,
   advRails:adv.rails,advCotes:adv.cotes};}

 /* RAIL DE PLUS (ADV) : un troisième ou quatrième rail dans le nuage autour des deux rails posés — aiguille, contre-rail ou cœur
  * d'un appareil de voie, rail de la voie qui diverge. TOUS les points de la capture (pas seulement les visibles : la fenêtre d'ESV
  * coupe souvent les rails voisins). Pour chaque rail, profil en travers : pas de 1 cm de −40 à +40 cm (latéral positif vers l'autre
  * rail), points à ±50 cm le long de la voie, hauteur relative à la pose de départ. Classe d'un pas : « haut » (90e centile au-dessus
  * de −3 cm, et sur au moins la moitié des tranches de 10 cm : continu le long de la voie), « mi-haut » (haut mais discontinu), bas,
  * creux, vide. Un rail de plus est une suite de pas hauts, hors de la tête du rail posé (−9 à +3 cm) :
  *   - large de 3 à 16 cm, sans toucher le bord de la fenêtre ni la tête (on ne saurait pas l'en séparer) ;
  *   - pas le contre-rail d'une courbe (début à 6,5 cm au plus, fin à 12,5 cm au plus, côté voie : il court sur des centaines de cuts) ;
  *   - bordée des deux côtés par un pas bas, creux ou vide, après au plus 3 pas mi-hauts ; un creux (sous −8 cm) à 5 pas au plus :
  *     c'est ce qui sépare un champignon d'une rampe, d'un quai ou d'un remblai ;
  *   - côté « plat » exclu : plus de la moitié des pas hors de la tête sont hauts (chaussée d'un PN, quai au ras).
  * Rend le nombre de rails de plus et, par côté, leurs bornes en centimètres (jamais une position). */
 function railsDePlus(capture,options){const A=cfgDe(options).adv,out={rails:0,cotes:{}};
  const tous=Array.isArray(capture?.pointsSceneRelative)?capture.pointsSceneRelative:[];
  if(!capture?.rails?.left||!capture?.rails?.right||!tous.length)return {rails:null,cotes:null};
  const N=Math.round(A.lateralM/A.pasM),T=Math.round(2*A.longM/A.trancheM),EPS=1e-9;
  for(const side of SIDES){const fr=Crossing.frameOf({rails:capture.rails},side),bins=new Map();
   for(const p of tous){if(!Array.isArray(p))continue;const {along,lat,z}=fr.local(p);
    if(!(Math.abs(along)<=A.longM)||!(Math.abs(lat)<A.lateralM)||z<A.zMinM||z>A.zMaxM)continue;
    const b=Math.floor(lat/A.pasM);let e=bins.get(b);if(!e){e={z:[],t:new Map()};bins.set(b,e);}
    e.z.push(z);const t=Math.floor((along+A.longM)/A.trancheM);e.t.set(t,Math.max(e.t.get(t)??-Infinity,z));}
   /* Classe par pas : '#' haut et continu, '^' haut discontinu, '+' bas, '-' et '.' creux, ' ' vide. */
   const cl=[];for(let b=-N;b<N;b++){const e=bins.get(b);if(!e||e.z.length<A.pointsPas){cl.push(' ');continue;}
    const z=e.z.slice().sort((x,y)=>x-y),p90=z[Math.min(z.length-1,Math.floor(0.9*z.length))];
    const cont=[...e.t.values()].filter(v=>v>A.hautM).length/T;
    cl.push(p90>A.hautM?(cont>=A.continuite?'#':'^'):p90>A.basM?'+':p90>A.creuxM?'-':'.');}
   const lat=i=>(i-N+0.5)*A.pasM,tete=i=>lat(i)>=A.tete[0]-EPS&&lat(i)<=A.tete[1]+EPS;
   let hauts=0,dehors=0;for(let i=0;i<cl.length;i++)if(!tete(i)&&cl[i]!==' '){dehors++;if(cl[i]==='#'||cl[i]==='^')hauts++;}
   const rails=[];
   if(!(dehors>0&&hauts/dehors>A.platMax)){
    const bas=c=>c==='+'||c==='-'||c==='.'||c===' ',creux=c=>c==='-'||c==='.';
    const voisin=(i,d)=>{let k=0;while(i>=0&&i<cl.length&&cl[i]==='^'&&k<A.sautPas){i+=d;k++;}return i>=0&&i<cl.length?cl[i]:' ';};
    let a=-1;
    for(let i=0;i<=cl.length;i++){const h=i<cl.length&&cl[i]==='#'&&!tete(i);if(h&&a<0)a=i;if(h||a<0)continue;
     const x=a,y=i-1,w=y-x+1;a=-1;
     if(w<A.largeurMinPas||w>A.largeurMaxPas||x===0||y===cl.length-1)continue;
     if(tete(x-1)||tete(y+1))continue;
     if(lat(x)>A.tete[1]+EPS&&lat(x)<=A.contreRail.debutMaxM+EPS&&lat(y)<=A.contreRail.finMaxM+EPS)continue;
     if(!bas(voisin(x-1,-1))||!bas(voisin(y+1,1)))continue;
     let ch=false;for(let k=1;k<=A.chutePas&&!ch;k++)ch=creux(cl[x-k]??'')||creux(cl[y+k]??'');
     if(!ch)continue;
     rails.push([Math.round(lat(x)*100-0.5),Math.round(lat(y)*100+0.5)]);}}
   out.cotes[side]=rails;out.rails+=rails.length;}
  return out;}

 /* Résumé d'un cut, le même pour l'extension et pour le rejeu. `initiale`/`finale` : positions {left,right} (scène) de la pose
  * de départ d'ESV et de la pose que le lot validerait ; elles ne sortent jamais du résumé (seuls des millimètres en sortent). */
 function resumer({identity,decision,action,valide,surface:s,initiale,finale}){
  const v3=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite),ok=p=>p&&SIDES.every(x=>v3(p[x]));
  const deplacementMm=ok(initiale)&&ok(finale)?r1(Math.max(...SIDES.map(x=>C.distance(initiale[x],finale[x])*1000))):null;
  const ecartementMm=ok(finale)?r1(C.distance(finale.left,finale.right)*1000):null;
  return {cut:identity?.cut??null,part:identity?.part??null,stage:decision?.stage??null,reason:decision?.reason??null,action:action??null,
   valide:valide===true?true:valide===false?false:null,deplacementMm,ecartementMm,
   flushPct:s?.flushPct??null,quadMin:s?.quadMin??null,coeurPN:s?.coeurPN===true,advRails:Number.isInteger(s?.advRails)?s.advRails:null};}

 function creerMemoire(lotId){return {lotId:lotId??null,cuts:[],coeurs:[],nonCoeurs:new Set(),zones:[],advAlertes:[],zonesADV:[],lignes:new Map(),signales:new Map()};}
 /* Zone PN du cut : cœur (confirmé ou non) et marge d'après d'un PN confirmé. `pn.consecutifs` : un cœur antérieur ne confirme que si
  * aucun cut VU sans chaussée (surface lue, pas un cœur : `mem.nonCoeurs`) ne tombe entre les deux ; un cut sans capture n'est pas vu.
  * L'extension d'une zone déjà confirmée (cœur dans la zone ou sa marge d'après) est inchangée. `nonCoeurs` garde TOUS les cuts vus du
  * lot (des numéros seulement, comme `lignes`) : une relecture qui capture un vert des centaines de cuts plus tard doit encore savoir
  * que ses voisins ont été vus sans chaussée. */
 const vusSansChaussee=mem=>mem.nonCoeurs instanceof Set?mem.nonCoeurs:(mem.nonCoeurs=new Set(Array.isArray(mem.nonCoeurs)?mem.nonCoeurs:[]));
 function zonePN(mem,r,cfg){const c=r.cut,P=cfg.pn;
  const derniere=mem.zones.at(-1),dansMarge=derniere&&c>derniere.fin&&c-derniere.fin<=P.margeApres;
  if(r.coeurPN){
   if(derniere&&c>=derniere.debut&&(c<=derniere.fin||dansMarge))return {etat:'coeur',zone:{...derniere,fin:Math.max(derniere.fin,c)}};
   const sep=P.consecutifs===true?vusSansChaussee(mem):null,separes=x=>{if(!sep)return false;for(let y=x+1;y<c;y++)if(sep.has(y))return true;return false;};
   const avant=mem.coeurs.filter(x=>x<c&&c-x<=P.confirmationEcartCuts&&!separes(x));
   if(avant.length+1>=P.confirmation)return {etat:'coeur',zone:{debut:Math.min(c,...avant),fin:c,nouvelle:true}};
   return {etat:'coeur-non-confirme',zone:null};}
  if(dansMarge)return {etat:'marge-apres',zone:derniere};
  return {etat:null,zone:null};}
 /* Zone d'ADV du cut : un cut du lot où la capture montre un rail de plus est une ALERTE ; deux alertes à 3 cuts au plus ouvrent la
  * zone, qui s'étend tant que les alertes se suivent à 10 cuts au plus. Plage à contrôler : 30 cuts avant la première alerte, 30
  * après la dernière (marges de Mic : « environ 20 à 40 cuts autour » de l'aiguille). En ombre : une zone, aucune règle. */
 function zoneADV(mem,r,cfg){const c=r.cut,A=cfg.adv,derniere=(mem.zonesADV||[]).at(-1);
  const alerte=Number.isInteger(r.advRails)&&r.advRails>0,dansMarge=derniere&&c>derniere.fin&&c-derniere.fin<=A.margeApres;
  if(alerte){
   if(derniere&&c>=derniere.debut&&c-derniere.fin<=A.trouCuts)return {etat:'alerte',zone:{...derniere,fin:Math.max(derniere.fin,c)}};
   const avant=(mem.advAlertes||[]).filter(x=>x<c&&c-x<=A.confirmationEcartCuts&&!(derniere&&x<=derniere.fin));
   if(avant.length+1>=A.confirmation)return {etat:'alerte',zone:{debut:Math.min(c,...avant),fin:c,nouvelle:true}};
   return {etat:'alerte-non-confirmee',zone:dansMarge?derniere:null};}
  if(dansMarge)return {etat:'marge-apres',zone:derniere};
  if(derniere&&c>=derniere.debut&&c<=derniere.fin)return {etat:'dans-la-zone',zone:derniere};
  return {etat:null,zone:null};}
 function grappeDe(mem,c,cfg){const G=cfg.grappe;
  const d=mem.cuts.filter(x=>x.differe&&!x.parRegle&&x.cut<c&&c-x.cut<=G.fenetreCuts).map(x=>c-x.cut);
  return {differes:d.length,plusProche:d.length?Math.min(...d):null,active:d.length>=G.differesMin&&Math.min(...d)<=G.procheCuts};}
 /* Ce qu'Ariane aurait fait du cut, règle par règle. N'écrit rien dans la mémoire (voir `noter`). */
 function evaluer(mem,r,options){const cfg=cfgDe(options);
  const pn=zonePN(mem,r,cfg),g=grappeDe(mem,r.cut,cfg),zone={pn:pn.etat,grappe:{differes:g.differes,plusProche:g.plusProche,active:g.active}};
  if(pn.zone)zone.pnControle=[pn.zone.debut-cfg.pn.margeAvant,pn.zone.fin+cfg.pn.margeApres];
  const adv=zoneADV(mem,r,cfg);zone.adv=adv.etat;
  if(adv.zone)zone.advControle=[Math.max(0,adv.zone.debut-cfg.adv.margeAvant),adv.zone.fin+cfg.adv.margeApres];
  const enPN=pn.etat==='coeur'||pn.etat==='marge-apres',regles=[];
  let aurait=r.valide===true?'valider':r.valide===false?'deja-differe':'sans-pose';
  if(r.valide===true){
   if((enPN||g.active)&&Number.isFinite(r.deplacementMm)&&r.deplacementMm<cfg.enPlace.mm)regles.push('zone-validation-en-place');
   if(enPN)regles.push('pn-chaque-cut');
   if(g.active)regles.push('grappe-differes');
   if(regles.length)aurait='differer';}
  return {version:cfg.version,cut:r.cut,part:r.part,zone,surface:{flushPct:r.flushPct,quadMin:r.quadMin,coeurPN:r.coeurPN,advRails:r.advRails??null},
   reel:{stage:r.stage,action:r.action,deplacementMm:r.deplacementMm,ecartementMm:r.ecartementMm},regles,aurait};}
 /* Le cut est passé : on garde son issue RÉELLE (différé ou non ; `parRegle` : différé par une règle activée). */
 function noter(mem,r,{differe=false,parRegle=false}={},options){const cfg=cfgDe(options);
  const pn=zonePN(mem,r,cfg);
  if(r.coeurPN){mem.coeurs.push(r.cut);while(mem.coeurs.length>cfg.memoireCuts)mem.coeurs.shift();}
  /* Cuts vus sans chaussée (le dernier regard sur un cut fait foi) : ce qui sépare deux cœurs (`pn.consecutifs`). */
  if(Number.isInteger(r.cut)){const v=vusSansChaussee(mem);if(!r.coeurPN&&r.flushPct!=null)v.add(r.cut);else if(r.coeurPN)v.delete(r.cut);}
  if(pn.etat==='coeur'){if(pn.zone.nouvelle)mem.zones.push({debut:pn.zone.debut,fin:pn.zone.fin});else mem.zones[mem.zones.length-1].fin=pn.zone.fin;
   while(mem.zones.length>8)mem.zones.shift();}
  if(!mem.zonesADV)mem.zonesADV=[];if(!mem.advAlertes)mem.advAlertes=[];
  const adv=zoneADV(mem,r,cfg);
  if(adv.etat==='alerte'||adv.etat==='alerte-non-confirmee'){mem.advAlertes.push(r.cut);while(mem.advAlertes.length>cfg.memoireCuts)mem.advAlertes.shift();}
  if(adv.etat==='alerte'){if(adv.zone.nouvelle)mem.zonesADV.push({debut:adv.zone.debut,fin:adv.zone.fin});else mem.zonesADV[mem.zonesADV.length-1].fin=adv.zone.fin;
   while(mem.zonesADV.length>8)mem.zonesADV.shift();}
  const i=mem.cuts.findIndex(x=>x.cut===r.cut);if(i>=0)mem.cuts.splice(i,1);
  mem.cuts.push({cut:r.cut,differe:!!differe,parRegle:!!parRegle});while(mem.cuts.length>cfg.memoireCuts)mem.cuts.shift();
  return mem;}

 /* VERTS À CONTRÔLER, sur les lignes de la liste d'ESV autour du cut (fenêtre de B1 : statut, traité ou vu par un opérateur,
  * écartement des bords). Rouges connus : cuts passés par le lot et lignes « invalid » de la fenêtre. Un vert n'est signalé
  * qu'une fois par raison et par lot. */
 function lignes(mem,rows,{cut}={},options){const cfg=cfgDe(options),E=cfg.ecartement,V=cfg.verts;
  for(const x of rows||[])if(Number.isInteger(x?.i)&&Number.isFinite(x.ecartementMm))mem.lignes.set(x.i,{statut:x.statut,g:x.ecartementMm});
  const valides=[...mem.lignes.values()].filter(x=>x.statut==='valid').map(x=>x.g);
  const reference={mm:valides.length>=E.lignesMin?r1(med(valides)):null,lignes:valides.length};
  const lot=new Set(mem.cuts.map(x=>x.cut));
  const rouges=[...new Set([...lot,...(rows||[]).filter(x=>x?.statut==='invalid'&&Number.isInteger(x.i)).map(x=>x.i)])].sort((a,b)=>a-b);
  const groupes=[];for(const c of rouges){const g=groupes.at(-1);if(g&&c-g.fin<=V.trouCuts){g.fin=c;g.n++;}else groupes.push({debut:c,fin:c,n:1});}
  const zones=mem.zones.map(z=>[z.debut-cfg.pn.margeAvant,z.fin+cfg.pn.margeApres]);
  const zonesADV=(mem.zonesADV||[]).map(z=>[Math.max(0,z.debut-cfg.adv.margeAvant),z.fin+cfg.adv.margeApres]);
  const verts=[];
  for(const x of rows||[]){
   if(!Number.isInteger(x?.i)||x.statut!=='valid'||x.operateur===true||x.fraiche===true||lot.has(x.i))continue;
   const raisons=[],ecart=reference.mm!=null&&Number.isFinite(x.ecartementMm)?Math.abs(x.ecartementMm-reference.mm):null;
   if(ecart!=null&&ecart>E.seuilMm)raisons.push('ecartement');
   if(zones.some(([a,b])=>x.i>=a&&x.i<=b))raisons.push('pn');
   if(zonesADV.some(([a,b])=>x.i>=a&&x.i<=b))raisons.push('adv');
   for(const g of groupes){
    if(g.n>=V.grappeMin&&x.i>g.debut&&x.i<g.fin){raisons.push('grappe');break;}
    if(g.n>=V.grappeMin&&(x.i<g.debut&&g.debut-x.i<=V.margeGrappe||x.i>g.fin&&x.i-g.fin<=V.margeGrappe)){raisons.push('grappe-marge');break;}
    if(g.n===1&&Math.abs(x.i-g.debut)===1){raisons.push('isole');break;}}
   const deja=mem.signales.get(x.i)||new Set(),neuves=raisons.filter(k=>!deja.has(k));if(!neuves.length)continue;
   for(const k of neuves)deja.add(k);mem.signales.set(x.i,deja);verts.push({i:x.i,raisons:neuves,ecartMm:ecart==null?null:r1(ecart),vu:x.vu===true});}
  return {cut:cut??null,reference,verts};}

 /* Activation : seule une règle déclenchée ET activée par Mic transforme une validation en différé. */
 function doitDifferer(e,reglage){
  if(!e||e.aurait!=='differer'||!reglage||reglage.actif!==true||!reglage.regles)return false;
  return (e.regles||[]).some(id=>REGLES.includes(id)&&reglage.regles[id]===true);}
 /* Événement consigné : la zone, les règles déclenchées, ce qu'Ariane aurait fait ; seuils au premier événement du lot. */
 function evenement(e,{premier=false,portee='cut',actif=null,options}={}){const cfg=cfgDe(options);
  const o={version:cfg.version,portee,identity:{part:e?.part??null,cut:e?.cut??null},zone:e?.zone??null,surface:e?.surface??null,reel:e?.reel??null,
   regles:e?.regles||[],aurait:e?.aurait??null,...(actif?{actif}:{})};
  if(premier)o.seuils=JSON.parse(JSON.stringify(cfg));
  return o;}
 return {DEFAULTS,REGLES,surface,railsDePlus,resumer,creerMemoire,evaluer,noter,lignes,doitDifferer,evenement};
});
