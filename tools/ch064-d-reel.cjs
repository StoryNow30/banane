'use strict';
/* CH-064-D : entrées RÉELLES des modules de décision, reconstruites des exports de banane-data (collections des 04, 05, 06/11).
 *   cas(modules, {max}) : itérable de {id, module, f, args} (id sans donnée identifiante : rang, partie, cut).
 * Sources lues dans les zips, jamais copiées dans le dépôt (extrait réduit mis en cache dans ariane-rs/dist/, non versionné) :
 *   - journaux (`ariane-journal-*.json`) : événements relecture-ombre (entrée et sortie du critère de la relecture),
 *     garde-apres-differe(-suivant), passe-differes-ombre / -ecriture (décalages de la passe), relecture-debut (zones),
 *     proposed / defer-finalized (cuts posés et différés du lot, par partie) ;
 *   - listes d'ESV (`ariane-liste-partie*.json`) : nombre de cuts de la partie ;
 *   - verts à contrôler (`ariane-verts-a-controler-*.json`) : zones PN et ADV, verts de la liste ;
 *   - nuages (`gcv1-corpus-*.json`, tools/ch064-nuages.cjs) : rails, relevé de lecture (`readStrategy`), qualité.
 * Pour le jugement de la relecture, la décision est rebâtie sur les rails RÉELS d'un nuage et l'écart RÉEL d'un événement
 * relecture-ombre (écart local du repère profil, hauteur apprise, étage, appuis, confiance) : c'est une entrée du module
 * (positions de la décision), pas une sortie comparée. */
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),{execFileSync}=require('node:child_process');
const {zips,entrees}=require('./ch064-corpus.cjs');
const RACINE=path.resolve(__dirname,'..'),CACHE=path.join(RACINE,'ariane-rs','dist','ch064-d-reel.v8');
const MOTIF=/^2026-11-0[456]_/;
const C=require('../vendor/capture-core.js'),Critere=require('../src/relecture-critere.js'),Signal=require('../src/relecture-signal.js');
const lireJson=(z,e)=>JSON.parse(execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1}).toString('utf8'));
const TYPES=new Set(['relecture-ombre','relecture-debut','garde-apres-differe','garde-apres-differe-suivant','passe-differes-ombre','passe-differes-ecriture','regles-metier-ombre','b1-ombre']);
/* Extrait réduit (une fois, mis en cache). */
function extrait(){
 if(fs.existsSync(CACHE))return v8.deserialize(fs.readFileSync(CACHE));
 const X={journaux:[],listes:[],verts:[],nuages:[]};const vusN=new Set();
 for(const z of zips(MOTIF))for(const e of entrees(z)){
  if(/journal/.test(e)){const j=lireJson(z,e),ev=[],lot={};
   for(const x of j.events||[]){if(TYPES.has(x.type))ev.push(x);
    if((x.type==='proposed'||x.type==='defer-finalized')&&Number.isInteger(x.identity?.part)){const p=x.identity.part,L=lot[p]||(lot[p]={poses:new Set(),differes:new Set()});
     (x.type==='proposed'?L.poses:L.differes).add(x.identity.cut);}}
   X.journaux.push({ev,lot:Object.fromEntries(Object.entries(lot).map(([p,L])=>[p,{poses:[...L.poses],differes:[...L.differes]}]))});}
  else if(/liste-partie/.test(e)){const l=lireJson(z,e);X.listes.push({partie:l.partie,lignes:l.lignes});}
  else if(/verts-a-controler/.test(e)){const v=lireJson(z,e);X.verts.push({partie:v.partie,zonesPN:v.zonesPN,zonesADV:v.zonesADV,verts:(v.verts||[]).map(x=>({i:x.i,raisons:x.raisons}))});}
  else if(/gcv1-corpus/.test(e)){const j=lireJson(z,e);
   for(const c of j.clouds||[]){if(c.format!=='banane-lidar-capture-v1'||vusN.has(c.captureId))continue;vusN.add(c.captureId);
    X.nuages.push({session:c.sessionId,at:c.capturedAt,identity:{part:c.identity?.part,cut:c.identity?.cut},rails:c.rails,readStrategy:c.readStrategy,
     quality:c.quality?{perRail:c.quality.perRail}:undefined,points:Array.isArray(c.pointsSceneRelative)?c.pointsSceneRelative.length:null});}}}
 fs.mkdirSync(path.dirname(CACHE),{recursive:true});fs.writeFileSync(CACHE,v8.serialize(X));return X;}
const garder=(o,ks)=>Object.fromEntries(ks.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const PROPOSES=JSON.parse(fs.readFileSync(path.join(RACINE,'datasets','relecture-reglages-proposes.json'),'utf8'));
const DEFAUT_F=JSON.parse(fs.readFileSync(path.join(RACINE,'datasets','relecture-reglages-defaut.json'),'utf8'));
/* Position scène d'un écart local (mm, repère profil du rail) depuis la pose du rail. */
function depuisEcart(rail,mm){const M=rail.sceneRelativeToProfileLocal,P=rail.profileLocalToSceneRelative,o=C.point(M,rail.positionSceneRelative);
 return C.point(P,[o[0]+(mm.long||0)/1000,o[1]+mm.lat/1000,o[2]+mm.vert/1000]);}
const verif={critere:{compares:0,identiquesAuJournal:0}};
function*cas(modules,{max=Infinity}={}){
 const X=extrait(),veut=m=>modules.includes(m);let n=0;
 const evs=t=>X.journaux.flatMap(j=>j.ev.filter(e=>e.type===t));
 const RO=evs('relecture-ombre');
 if(veut('critere')){
  const Rp=Critere.reglages(PROPOSES,'propose'),Rd=Critere.reglages(DEFAUT_F,'fichier');
  yield {id:'reel-critere-reglages-proposes',module:'critere',f:'reglages',args:[PROPOSES,'propose']};
  yield {id:'reel-critere-reglages-defaut',module:'critere',f:'reglages',args:[DEFAUT_F]};
  for(const d of evs('relecture-debut'))if(d.reglages)yield {id:'reel-critere-permise-'+(n++),module:'critere',f:'correctionPermise',args:[d.reglages]};
  for(const ev of RO){if(n++>=max)break;
   const jugement=garder({...ev,appuis:ev.appuis},['poseCalculee','ecartMm','ecartBrutMm','etage','appuis','confiance']);
   const entree={jugement,...garder(ev,['zone','role','skipOmbre','ecartementMm','ecartementRefMm','ecartementBrutMm']),...(ev.ecritMm?{ecrit:ev.ecritMm}:{}),...(ev.ecritBrutMm?{ecritBrut:ev.ecritBrutMm}:{})};
   const id='reel-critere-p'+ev.identity?.part+'-c'+ev.identity?.cut+'-'+n;
   if(ev.critere){verif.critere.compares++;if(Critere.juger(entree,Rp).raison===ev.critere.raison)verif.critere.identiquesAuJournal++;}
   yield {id,module:'critere',f:'juger',args:[entree,Rp]};
   if(n%4===0)yield {id:id+'-defaut',module:'critere',f:'juger',args:[entree,Rd]};}}
 if(veut('gardeApresDiffere')){
  for(const ev of evs('garde-apres-differe')){const R={regle:ev.regle,coupures:ev.coupures,appuisMin:ev.appuisMin};
   yield {id:'reel-gad-reglage-'+(n++),module:'gardeApresDiffere',f:'reglage',args:[R]};
   yield {id:'reel-gad-p'+ev.identity?.part+'-c'+ev.identity?.cut,module:'gardeApresDiffere',f:'juger',args:[{cut:ev.identity?.cut,differesLot:ev.voisinsDifferes,appuis:ev.appuis},{ok:true,actif:true,ombre:false,...R}]};}
  for(const ev of evs('garde-apres-differe-suivant')){const c=ev.identity?.cut;
   yield {id:'reel-gad-suivant-p'+ev.identity?.part+'-c'+c,module:'gardeApresDiffere',f:'juger',args:[{cut:c,differesLot:[...(ev.cutsGarde||[]),c-1,c-3],appuis:ev.appuis}]};
   yield {id:'reel-gad-voisins-'+(n++),module:'gardeApresDiffere',f:'voisinsDifferes',args:[c,ev.cutsGarde,ev.fenetre]};}}
 if(veut('gardePasseAppuis')){
  for(const j of X.journaux){const normaux=p=>j.lot[p]?.poses||[];
   for(const ev of j.ev.filter(e=>e.type==='passe-differes-ecriture'||e.type==='passe-differes-ombre')){const p=ev.identity?.part,c=ev.identity?.cut;
    for(const decal of [ev.decal,ev.l1?.paire?.decal??ev.l1?.paire,ev.l1?.test13?.paire].filter(Boolean)){
     yield {id:'reel-gpa-p'+p+'-c'+c+'-'+(n++),module:'gardePasseAppuis',f:'juger',args:[{cut:c,decal,cutsNormaux:normaux(p)}]};
     yield {id:'reel-gpa-depl-'+(n++),module:'gardePasseAppuis',f:'deplacementMm',args:[decal]};}
    yield {id:'reel-gpa-appui-'+(n++),module:'gardePasseAppuis',f:'appuiNormalCuts',args:[c,normaux(p)]};}}}
 if(veut('signal')||veut('relectureOmbre')){
  const parSession=new Map();for(const c of X.nuages){if(!parSession.has(c.session))parSession.set(c.session,[]);parSession.get(c.session).push(c);}
  if(veut('signal'))for(const [,cs] of parSession){cs.sort((a,b)=>String(a.at).localeCompare(String(b.at)));
   for(const lectures of [2,3,8]){const e=Signal.creer({actif:lectures!==8,lectures,rechargementsMax:lectures===2?2:1});
    for(let i=0;i<cs.length;i++){const cap={readStrategy:cs[i].readStrategy},opts=i%7===0?{peutRecharger:false}:undefined;
     if(lectures===2)yield {id:'reel-signal-lecture-'+(n++),module:'signal',f:'lectureDe',args:[cap]};
     yield {id:'reel-signal-observer-'+lectures+'-'+(n++),module:'signal',f:'observer',args:opts?[structuredClone(e),cap,opts]:[structuredClone(e),cap]};
     const r=Signal.observer(e,cap,opts);
     if(r.action==='recharger'){yield {id:'reel-signal-recharge-'+(n++),module:'signal',f:'recharge',args:[structuredClone(e)]};Signal.recharge(e);}}
    yield {id:'reel-signal-bilan-'+(n++),module:'signal',f:'bilan',args:[structuredClone(e)]};}}
  if(veut('relectureOmbre')){
   const vides=X.nuages.map(c=>({quality:c.quality}));
   for(let i=0;i<vides.length;i++){yield {id:'reel-skip-'+i,module:'relectureOmbre',f:'skipOmbre',args:[i%3?vides[i]:[vides[i],vides[(i+1)%vides.length]]]};
    if(i%5===0)yield {id:'reel-vide-'+i,module:'relectureOmbre',f:'captureVide',args:[vides[i]]};}
   /* Jugement : rails réels d'un nuage, écart réel d'un événement relecture-ombre (pris dans l'ordre, en boucle). */
   const avecEcart=RO.filter(e=>e.ecartMm&&e.ecartMm.left&&e.ecartMm.right);let k=0;
   for(const c of X.nuages){if(n++>=max)break;if(!avecEcart.length||!c.rails?.left||!c.rails?.right)continue;const ev=avecEcart[k++%avecEcart.length];
    let positions;try{positions={left:depuisEcart(c.rails.left,ev.ecartMm.left),right:depuisEcart(c.rails.right,ev.ecartMm.right)};}catch{continue;}
    const decision={stage:ev.etage,reason:ev.motifDecision??null,anchorsUsed:ev.appuis,positions,
     ...(ev.hauteurMm?{hauteurApprise:{version:'hauteur-apprise',rails:{left:{correctionMm:ev.hauteurMm.left},right:{correctionMm:ev.hauteurMm.right}}}}:{})};
    const science=ev.confiance?{rails:Object.fromEntries(['left','right'].map(s=>[s,{astar:{confidence:ev.confiance[s]},s1Changed:ev.s1?.[s]===true}]))}:null;
    const capture={rails:c.rails};
    yield {id:'reel-ombre-juger-p'+c.identity.part+'-c'+c.identity.cut,module:'relectureOmbre',f:'juger',args:[{capture,decision,science},k%9===0?{seuilCorrigerMm:3}:undefined]};
    if(k%6===0)yield {id:'reel-ombre-juger-sans-h-'+k,module:'relectureOmbre',f:'juger',args:[{capture,decision,science,hauteur:false}]};
    if(k%10===0)yield {id:'reel-ombre-ecart-'+k,module:'relectureOmbre',f:'ecartRail',args:[c.rails.left,positions.left,{brut:k%20===0}]};}
   /* Sélection : zones et verts des fichiers « verts à contrôler », lot (cuts posés et différés) des journaux, total des listes. */
   const lots={};for(const j of X.journaux)for(const [p,L] of Object.entries(j.lot)){const o=lots[p]||(lots[p]={poses:new Set(),differes:new Set()});L.poses.forEach(x=>o.poses.add(x));L.differes.forEach(x=>o.differes.add(x));}
   const totaux={};for(const l of X.listes)totaux[l.partie]=Math.max(totaux[l.partie]||0,l.lignes);
   const optSel=require('../src/relecture-ombre.js').optionsSelection(PROPOSES.selection);
   const OPTIONS=[undefined,optSel,{plafondParZone:{adv:40,abords:30}},{plafondCuts:60,priorites:['pn','adv','isole','grappe','differe','a-controler','ecartement','trou']},{trouMaxCuts:0,fusionTrouCuts:2},{relireCutsDuLot:true,aControler:{marge:0}}];
   let r=0;
   for(const v of X.verts){const L=lots[v.partie]||{poses:new Set(),differes:new Set()};
    const lot=[...[...L.poses].map(cut=>({cut,differe:false})),...[...L.differes].map(cut=>({cut,differe:true}))].sort((a,b)=>a.cut-b.cut);
    const entree={partie:v.partie,total:totaux[v.partie]??null,lot,zonesPN:v.zonesPN,zonesADV:v.zonesADV,aControler:v.verts.map(x=>x.i),
     ecartement:v.verts.filter(x=>(x.raisons||[]).includes('ecartement')).map(x=>x.i).slice(0,30)};
    for(const o of OPTIONS)yield {id:'reel-selection-p'+v.partie+'-'+(r++),module:'relectureOmbre',f:'selection',args:o===undefined?[entree]:[entree,o]};}
   for(const d of evs('relecture-debut')){const p=RO.find(e=>e.batchId===d.batchId)?.identity?.part;if(p===undefined||!d.zones)continue;
    const L=lots[p]||{poses:new Set(),differes:new Set()};
    const lot=[...[...L.poses].map(cut=>({cut,differe:false})),...[...L.differes].map(cut=>({cut,differe:true}))];
    yield {id:'reel-selection-debut-p'+p+'-'+(r++),module:'relectureOmbre',f:'selection',args:[{partie:p,total:totaux[p]??null,lot,zonesPN:d.zones.pn||[],zonesADV:d.zones.adv||[]},optSel]};}}}
 if(veut('reglesMetier')){
  /* Événements regles-metier-ombre (portée « cut ») : l'évaluation consignée, rejouée en entrée d'evenement et de doitDifferer. */
  let k=0;
  for(const ev of evs('regles-metier-ombre').filter(e=>e.portee!=='verts')){const e={part:ev.identity?.part,cut:ev.identity?.cut,zone:ev.zone,surface:ev.surface,reel:ev.reel,regles:ev.regles,aurait:ev.aurait};
   yield {id:'reel-rm-evenement-'+(k++),module:'reglesMetier',f:'evenement',args:[e,{premier:k%40===1,portee:ev.portee,actif:ev.actif??null}]};
   yield {id:'reel-rm-doit-'+(k++),module:'reglesMetier',f:'doitDifferer',args:[{...e,aurait:k%3?'differer':e.aurait},{actif:true,regles:{'pn-chaque-cut':true,'grappe-differes':k%2===0,'zone-validation-en-place':true}}]};
   const c=X.nuages[k%X.nuages.length];
   if(c?.rails?.left&&c?.rails?.right&&ev.reel){const ini={left:c.rails.left.positionSceneRelative,right:c.rails.right.positionSceneRelative};
    let fin;try{fin={left:depuisEcart(c.rails.left,{lat:(ev.reel.deplacementMm??0.4),vert:0.3}),right:depuisEcart(c.rails.right,{lat:-(ev.reel.deplacementMm??0.4)/2,vert:-0.2})};}catch{fin=null;}
    yield {id:'reel-rm-resumer-'+(k++),module:'reglesMetier',f:'resumer',args:[{identity:ev.identity,decision:{stage:ev.reel.stage,reason:k%5?null:'no-anchor'},action:ev.reel.action,valide:ev.aurait==='valider'?true:ev.aurait==='deja-differe'?false:undefined,surface:ev.surface,initiale:ini,finale:fin}]};}}}
 if(veut('shadow')){
  /* Science GCV1 sur les nuages réels complets ; un sur cinq avec réservoir (H1, H2 de la GCV2). */
  const {nuages}=require('./ch064-nuages.cjs');let k=0;
  for(const c of nuages(max)){k++;yield {id:'reel-gcv1-p'+c.identity?.part+'-c'+c.identity?.cut,module:'shadow',f:k%5?'scientificProposeBoth':'scientificProposeBothAvecReservoir',args:[c]};}}
 if(veut('reglesMetier')||veut('crossing')){
  /* Nuages réels complets (points compris) : surface au ras, rails de plus, lecture de l'ornière. */
  const {nuages}=require('./ch064-nuages.cjs');let k=0;
  for(const c of nuages(max)){k++;const capture={rails:c.rails,pointsSceneRelative:c.pointsSceneRelative,visibleByClipBoxes:c.visibleByClipBoxes},id='p'+c.identity?.part+'-c'+c.identity?.cut;
   if(veut('reglesMetier')){yield {id:'reel-rm-surface-'+id,module:'reglesMetier',f:'surface',args:[capture]};
    if(k%9===0)yield {id:'reel-rm-adv-'+id,module:'reglesMetier',f:'railsDePlus',args:[capture,{adv:{hautM:-0.05,platMax:0.7}}]};}
   if(veut('crossing')){const vis=c.visibleByClipBoxes,pts=Array.isArray(vis)?c.pointsSceneRelative.filter((_,i)=>vis[i]===true):c.pointsSceneRelative;
    yield {id:'reel-pn-read-'+id,module:'crossing',f:'read',args:[{rails:c.rails,pointsSceneRelative:pts}]};
    if(k%6===0)yield {id:'reel-pn-read-tous-'+id,module:'crossing',f:'read',args:[{rails:c.rails,pointsSceneRelative:c.pointsSceneRelative},{flushMinPct:50,sideInM:0.09,sideOutM:0.45,alongM:0.6,flushBelowM:0.08,binMm:3,maxGapBins:2,searchMm:200,dropMm:20,grooveMinMm:25,grooveMaxMm:110,headMm:50,lateralOffsetMm:-3,verticalOffsetMm:4}]};
    if(k%10===0){yield {id:'reel-pn-edge-'+id,module:'crossing',f:'edgeOf',args:[{rails:c.rails,pointsSceneRelative:pts},k%20?'left':'right']};
     yield {id:'reel-pn-pos-'+id,module:'crossing',f:'positionAt',args:[{rails:c.rails},'right',-12.5,k%7]};}}}}
}
module.exports={cas,extrait,verif,CACHE};
