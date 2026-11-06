#!/usr/bin/env node
'use strict';
/* CH-072 : parité au bit près (VBA) des fonctions portées, Node ou Chromium.
 *   node tools/ch072-parite.cjs              → Node, écrit chantiers/CH-072/parite-node.json
 *   node tools/ch072-parite.cjs --chromium   → page servie, binaire CHROMIUM ou /opt/pw-browsers/chromium
 *   node tools/ch072-parite.cjs --temps      → 15 répétitions, médiane, dans Chromium (machine au repos)
 * Ne copie aucune donnée réelle. Le clone banane-data, s'il est là, n'est lu qu'en mémoire. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const RACINE=path.resolve(__dirname,'..');
const DV=require(path.join(RACINE,'src/deplacement-vue.js'));
const GV=require(path.join(RACINE,'src/gestes-vue.js'));
const Vba=require(path.join(RACINE,'ariane-rs/coquille/vba.js'));
const Coeur=require(path.join(RACINE,'ariane-rs/coquille/coeur.js'));
const Facade=require(path.join(RACINE,'ariane-rs/coquille/facade-vue.js'));
const WASM=path.join(RACINE,'ariane-rs/target/wasm32-unknown-unknown/release/ariane_vue.wasm');

function identique(a,b){
 try{const x=Vba.encoder(a),y=Vba.encoder(b);if(x.length!==y.length)return false;for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;return true;}
 catch{return false;}
}
function echantillon(a){try{return JSON.stringify(a);}catch{return String(a);}}

function cam(x,s){return {cameraToSceneRelative:[0,1,0,0, 0,0,1,0, 1,0,0,0, 10,x,0,1],projection:[s,0,0,0, 0,s,0,0, 0,0,-1e-4,0, 0,0,0,1],viewport:{width:800,height:600}};}
function graine(n){let x=n>>>0;return ()=>{x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);x^=x>>>16;return (x>>>0)/4294967296;};}
function casFixes(){
 const out=[];
 const push=(nom,js,wasm)=>out.push({nom,js,wasm});
 push('reglages-defaut',DV.reglages(),null);
 push('reglages-clic',DV.reglages({actif:true,geste:'clic-droit',tentativesMax:2}),null);
 push('reglages-inconnu',DV.reglages({actif:true,geste:'telepathie'}),null);
 push('reglages-plafond',DV.reglages({actif:true,tentativesMax:99}),null);
 push('reglages-plancher',DV.reglages({actif:true,tentativesMax:0}),null);
 push('reglages-extra',DV.reglages({actif:true,geste:'molette',note:'x',tentativesMax:2.9}),null);
 const j=new DV.Journal();
 j.noter('molette',{resultat:'mouvement',deplacementMm:40.2,zoom:1.1});
 j.noter('molette',{resultat:'immobile',deplacementMm:0.1,zoom:1});
 j.noter('molette',{resultat:'illisible'});
 j.noter('clic-droit',{resultat:'sens-inverse',deplacementMm:12,zoom:1});
 j.noter('absent',{resultat:'mouvement'});
 push('journal',j.resume(),null);
 push('besoin',GV.besoin([1.15,0.2],{width:800,height:600}),null);
 push('besoin-dans',GV.besoin([.5,-.98],{width:800,height:600}),null);
 push('pixel',GV.pixelMm(cam(0,5)),null);
 push('resume-cam',GV.resumeCamera(cam(0,5)),null);
 push('ecart',GV.ecartCamera(cam(0,5),cam(.05,5/1.2)),null);
 push('ecart-nul',GV.ecartCamera(null,cam(0,5)),null);
 push('meme',GV.memeCamera(cam(0,5),cam(0,5)),null);
 push('meme-non',GV.memeCamera(cam(0,5),cam(1,5)),null);
 push('approche',GV.approche(10,20),null);
 push('approche-dernier',GV.approche(12,20,1,[10,18]),null);
 const cote={cote:'left',ok:true,raison:null,ndcAvant:[1.34,0.1],ndcApres:[0.9,0.1],pixelMm:{avant:.5,apres:.7},dureeMs:812,
  gestes:[{type:'molette',crans:3,zoom:1.352,camera:null,ndcAvant:[1.34,0.1],ndcApres:[0.9,0.1],dureeMs:790,deplacement:{geste:'clic-droit',ok:true,tentatives:2,raison:null}}]};
 push('detail',DV.detailDeplacement(cote,{phase:'pose',geste:'molette'}),null);
 push('detail-nul',DV.detailDeplacement(null),null);
 push('remise-faite',DV.detailRemise({ok:true,crans:3,recentre:false,ecartEchelle:0.000002,dureeMs:410},null,{phase:'pose',dureeApplyMs:5200,cransMax:5}),null);
 push('remise-echec',DV.detailRemise({ok:false,crans:2,ecartEchelle:0.05},null,{phase:'pose'}),null);
 push('remise-message',DV.detailRemise(null,'Vue ESV non restituée après le déplacement de vue (échelle à 2,5 % de la vue habituelle) : les deux rails sont posés.',{phase:'pose'}),null);
 push('remise-recentre',DV.detailRemise(null,'Vue ESV non recentrée sur le rail right.',{phase:'pose'}),null);
 push('remise-inconnu',DV.detailRemise(null,'Action interrompue.',{phase:'pose'}),null);
 const b=new DV.Bilan();
 b.noterDeplacement(DV.detailDeplacement(cote,{phase:'pose'}));
 b.noterRemise(DV.detailRemise({ok:true,crans:3,ecartEchelle:0,dureeMs:100},null,{phase:'pose'}));
 b.noterDeplacement(DV.detailDeplacement({...cote,ok:false,raison:'camera-immobile'},{phase:'pose'}));
 b.noterRemise(DV.detailRemise(null,'Vue ESV non restituée après le déplacement de vue (échelle à 4,0 % de la vue habituelle)',{phase:'pose'}));
 push('bilan',b.resume(),null);
 push('bilan-vide',new DV.Bilan().vide(),null);
 const plan={x:400,y:300,crans:3,sens:1,x0:300,y0:300,x1:380,y1:300};
 const r=DV.reglages({actif:true,geste:'molette'});
 push('juger-molette',DV.juger('molette',plan,cam(0,5),cam(0,5/1.1),r),null);
 push('juger-immobile',DV.juger('molette',plan,cam(0,5),cam(0,5),r),null);
 push('juger-glisser',DV.juger('clic-droit',plan,cam(0,5),cam(0,5).cameraToSceneRelative?{...cam(0,5),cameraToSceneRelative:cam(-0.04,5).cameraToSceneRelative,projection:cam(0,5).projection,viewport:cam(0,5).viewport}:null,DV.reglages({actif:true,geste:'clic-droit'})),null);
 return out;
}
function variantes(n){
 const rnd=graine(0x072072);
 const out=[];
 for(let i=0;i<n;i++){
  const x=(rnd()*2-1)*50,s=0.2+rnd()*20,y=x+(rnd()-0.5);
  out.push({nom:'var-ecart-'+i,js:GV.ecartCamera(cam(x,s),cam(y,s*(0.5+rnd()))),wasm:null});
  out.push({nom:'var-besoin-'+i,js:GV.besoin([rnd()*3-1.5,rnd()*3-1.5],{width:100+rnd()*2000,height:100+rnd()*1200},0.5+rnd()*0.49),wasm:null});
  const j=new DV.Journal();
  for(let k=0;k<4;k++)j.noter(['molette','clic-droit','glisse-synthetique'][k%3],{resultat:['mouvement','immobile','sens-inverse','illisible'][Math.floor(rnd()*4)],deplacementMm:rnd()*80,zoom:0.5+rnd()});
  out.push({nom:'var-journal-'+i,js:j.resume(),wasm:null});
  const txt='Vue ESV non restituée après le déplacement (échelle à '+(rnd()*9).toFixed(1).replace('.',',')+' % de la vue).';
  out.push({nom:'var-remise-'+i,js:DV.detailRemise(null,txt,{phase:rnd()<0.5?'pose':'pre-vol',dureeApplyMs:rnd()*5000}),wasm:null});
 }
 return out;
}
function jouerReleve(Cible){
 const scripts=[
  function glisser(){
   const r=monde(Cible);r.at(1000);r.ev('pointerdown',{button:0,buttons:1,clientX:400,clientY:300});
   for(let i=1;i<=10;i++){r.avancer(16);r.ev('pointermove',{buttons:1,clientX:400+6*i,clientY:300+2*i});}
   r.bouger(.03);r.avancer(20);r.ev('pointerup',{button:0,buttons:0,clientX:460,clientY:320});r.ev('click',{button:0});r.avancer(2000);
   return r.resumes;
  },
  function molette(){
   const r=monde(Cible);r.at(5000);
   for(let i=0;i<3;i++){if(i)r.avancer(90);r.ev('wheel',{deltaY:100,deltaMode:0,wheelDeltaY:-120,clientX:400,clientY:300});}
   r.bouger(0,5/1.331);r.avancer(3000);
   r.ev('pointerdown',{button:0,buttons:1,clientX:10,clientY:10});r.ev('pointerup',{button:0,clientX:10,clientY:10});r.ev('click');r.avancer(500);
   r.R.evenement({type:'wheel',isTrusted:false,target:r.vue,deltaY:100});r.avancer(1000);
   return r.resumes;
  },
  function droit(){
   const r=monde(Cible);r.ev('pointerdown',{button:2,buttons:2,clientX:100,clientY:100});r.ev('contextmenu');r.ev('pointermove',{buttons:2,clientX:140,clientY:100});
   r.ev('pointerup',{button:2,clientX:140,clientY:100});r.ev('auxclick',{button:2});r.avancer(2000);
   r.ev('wheel',{deltaY:100});r.avancer(1000);r.ev('wheel',{deltaY:-100});r.avancer(2000);
   return r.resumes;
  },
  function hors(){
   const r=monde(Cible),ailleurs={id:'bouton'};
   r.R.evenement({type:'pointerdown',isTrusted:true,target:ailleurs,button:0,clientX:0,clientY:0});
   r.R.evenement({type:'pointerup',isTrusted:true,target:ailleurs,clientX:50,clientY:0});
   r.R.evenement({type:'wheel',isTrusted:true,target:ailleurs,deltaY:100});r.avancer(3000);
   return r.resumes;
  },
 ];
 return scripts.map(s=>({nom:s.name,valeur:s()}));
}
function monde(Cible){
 let t=0,c=cam(0,5);
 const taches=[],resumes=[],vue={id:'vue'};
 const R=new Cible({lireCamera:()=>JSON.parse(JSON.stringify(c)),emettre:r=>resumes.push(r),planifier:(fn,ms)=>taches.push({at:t+ms,fn}),maintenant:()=>t,estVue:x=>x===vue});
 const avancer=ms=>{const fin=t+ms;for(;;){taches.sort((a,b)=>a.at-b.at);const k=taches[0];if(!k||k.at>fin)break;taches.shift();t=k.at;k.fn();}t=fin;};
 const ev=(type,o={})=>R.evenement({type,isTrusted:true,target:vue,pointerId:1,pointerType:'mouse',clientX:0,clientY:0,...o});
 return {R,ev,avancer,resumes,vue,bouger:(dx,s)=>{c.cameraToSceneRelative[13]+=dx;if(s)c.projection[0]=s;},at:ms=>{t=ms;}};
}
function appliquer(F,cas){
 const f=F;
 for(const c of cas){
  if(c.nom.startsWith('reglages'))c.wasm=f.reglages(c.nom==='reglages-defaut'?undefined:entreeReglage(c.nom));
  else if(c.nom==='journal')c.wasm=journalWasm(f);
  else if(c.nom==='besoin')c.wasm=f.gestes.besoin([1.15,0.2],{width:800,height:600});
  else if(c.nom==='besoin-dans')c.wasm=f.gestes.besoin([.5,-.98],{width:800,height:600});
  else if(c.nom==='pixel')c.wasm=f.gestes.pixelMm(cam(0,5));
  else if(c.nom==='resume-cam')c.wasm=f.gestes.resumeCamera(cam(0,5));
  else if(c.nom==='ecart')c.wasm=f.gestes.ecartCamera(cam(0,5),cam(.05,5/1.2));
  else if(c.nom==='ecart-nul')c.wasm=f.gestes.ecartCamera(null,cam(0,5));
  else if(c.nom==='meme')c.wasm=f.gestes.memeCamera(cam(0,5),cam(0,5));
  else if(c.nom==='meme-non')c.wasm=f.gestes.memeCamera(cam(0,5),cam(1,5));
  else if(c.nom==='approche')c.wasm=f.gestes.approche(10,20);
  else if(c.nom==='approche-dernier')c.wasm=f.gestes.approche(12,20,1,[10,18]);
  else if(c.nom==='detail'||c.nom==='detail-nul'||c.nom.startsWith('remise')||c.nom==='bilan'||c.nom==='bilan-vide'||c.nom.startsWith('juger')||c.nom.startsWith('var-'))c.wasm=rejouer(f,c);
 }
 return cas;
}
function entreeReglage(nom){
 if(nom==='reglages-clic')return {actif:true,geste:'clic-droit',tentativesMax:2};
 if(nom==='reglages-inconnu')return {actif:true,geste:'telepathie'};
 if(nom==='reglages-plafond')return {actif:true,tentativesMax:99};
 if(nom==='reglages-plancher')return {actif:true,tentativesMax:0};
 if(nom==='reglages-extra')return {actif:true,geste:'molette',note:'x',tentativesMax:2.9};
 return undefined;
}
function journalWasm(f){
 const j=new f.Journal();
 j.noter('molette',{resultat:'mouvement',deplacementMm:40.2,zoom:1.1});
 j.noter('molette',{resultat:'immobile',deplacementMm:0.1,zoom:1});
 j.noter('molette',{resultat:'illisible'});
 j.noter('clic-droit',{resultat:'sens-inverse',deplacementMm:12,zoom:1});
 j.noter('absent',{resultat:'mouvement'});
 return j.resume();
}
function rejouer(f,c){
 if(c.nom==='detail')return f.detailDeplacement(c._cote||coteFixe(),{phase:'pose',geste:'molette'});
 if(c.nom==='detail-nul')return f.detailDeplacement(null);
 if(c.nom==='remise-faite')return f.detailRemise({ok:true,crans:3,recentre:false,ecartEchelle:0.000002,dureeMs:410},null,{phase:'pose',dureeApplyMs:5200,cransMax:5});
 if(c.nom==='remise-echec')return f.detailRemise({ok:false,crans:2,ecartEchelle:0.05},null,{phase:'pose'});
 if(c.nom==='remise-message')return f.detailRemise(null,'Vue ESV non restituée après le déplacement de vue (échelle à 2,5 % de la vue habituelle) : les deux rails sont posés.',{phase:'pose'});
 if(c.nom==='remise-recentre')return f.detailRemise(null,'Vue ESV non recentrée sur le rail right.',{phase:'pose'});
 if(c.nom==='remise-inconnu')return f.detailRemise(null,'Action interrompue.',{phase:'pose'});
 if(c.nom==='bilan')return bilanWasm(f);
 if(c.nom==='bilan-vide')return new f.Bilan().vide();
 if(c.nom==='juger-molette')return f.juger('molette',{x:400,y:300,crans:3,sens:1,x0:300,y0:300,x1:380,y1:300},cam(0,5),cam(0,5/1.1),DV.reglages({actif:true,geste:'molette'}));
 if(c.nom==='juger-immobile')return f.juger('molette',{x:400,y:300,crans:3,sens:1,x0:300,y0:300,x1:380,y1:300},cam(0,5),cam(0,5),DV.reglages({actif:true,geste:'molette'}));
 if(c.nom==='juger-glisser'){const apres=cam(0,5);apres.cameraToSceneRelative=cam(-0.04,5).cameraToSceneRelative;return f.juger('clic-droit',{x:400,y:300,crans:3,sens:1,x0:300,y0:300,x1:380,y1:300},cam(0,5),apres,DV.reglages({actif:true,geste:'clic-droit'}));}
 if(c.nom.startsWith('var-ecart'))return c._wasmEcart?c._wasmEcart:f.gestes.ecartCamera(c._a,c._b);
 if(c.nom.startsWith('var-besoin'))return f.gestes.besoin(c._ndc,c._vp,c._marge);
 if(c.nom.startsWith('var-journal'))return c._replayJournal(f);
 if(c.nom.startsWith('var-remise'))return f.detailRemise(null,c._txt,c._ctx);
 return c.js;
}
function coteFixe(){return {cote:'left',ok:true,raison:null,ndcAvant:[1.34,0.1],ndcApres:[0.9,0.1],pixelMm:{avant:.5,apres:.7},dureeMs:812,gestes:[{type:'molette',crans:3,zoom:1.352,camera:null,ndcAvant:[1.34,0.1],ndcApres:[0.9,0.1],dureeMs:790,deplacement:{geste:'clic-droit',ok:true,tentatives:2,raison:null}}]};}
function bilanWasm(f){
 const cote=coteFixe();const b=new f.Bilan();
 b.noterDeplacement(f.detailDeplacement(cote,{phase:'pose'}));
 b.noterRemise(f.detailRemise({ok:true,crans:3,ecartEchelle:0,dureeMs:100},null,{phase:'pose'}));
 b.noterDeplacement(f.detailDeplacement({...cote,ok:false,raison:'camera-immobile'},{phase:'pose'}));
 b.noterRemise(f.detailRemise(null,'Vue ESV non restituée après le déplacement de vue (échelle à 4,0 % de la vue habituelle)',{phase:'pose'}));
 return b.resume();
}
function preparerVariantes(n){
 const rnd=graine(0x072072);const out=[];
 for(let i=0;i<n;i++){
  const x=(rnd()*2-1)*50,s=0.2+rnd()*20,y=x+(rnd()-0.5),s2=s*(0.5+rnd());
  const a=cam(x,s),b=cam(y,s2);
  out.push({nom:'var-ecart-'+i,js:GV.ecartCamera(a,b),_a:a,_b:b});
  const ndc=[rnd()*3-1.5,rnd()*3-1.5],vp={width:100+rnd()*2000,height:100+rnd()*1200},marge=0.5+rnd()*0.49;
  out.push({nom:'var-besoin-'+i,js:GV.besoin(ndc,vp,marge),_ndc:ndc,_vp:vp,_marge:marge});
  const notes=[];
  for(let k=0;k<4;k++)notes.push({geste:['molette','clic-droit','glisse-synthetique'][k%3],e:{resultat:['mouvement','immobile','sens-inverse','illisible'][Math.floor(rnd()*4)],deplacementMm:rnd()*80,zoom:0.5+rnd()}});
  const j=new DV.Journal();for(const note of notes)j.noter(note.geste,note.e);
  out.push({nom:'var-journal-'+i,js:j.resume(),_replayJournal(f){const w=new f.Journal();for(const note of notes)w.noter(note.geste,note.e);return w.resume();}});
  const txt='Vue ESV non restituée après le déplacement (échelle à '+(rnd()*9).toFixed(1).replace('.',',')+' % de la vue).';
  const ctx={phase:rnd()<0.5?'pose':'pre-vol',dureeApplyMs:rnd()*5000};
  out.push({nom:'var-remise-'+i,js:DV.detailRemise(null,txt,ctx),_txt:txt,_ctx:ctx});
 }
 return out;
}
function comparer(cas){
 const ecarts=[];
 for(const c of cas)if(!identique(c.js,c.wasm))ecarts.push({nom:c.nom,js:echantillon(c.js),wasm:echantillon(c.wasm)});
 return ecarts;
}
function releve(F){
 const js=jouerReleve(GV.Releveur),wasm=jouerReleve(F.gestes.Releveur);
 const ecarts=[];
 for(let i=0;i<js.length;i++)if(!identique(js[i].valeur,wasm[i].valeur))ecarts.push({nom:'releve-'+js[i].nom,js:echantillon(js[i].valeur),wasm:echantillon(wasm[i].valeur)});
 return {cas:js.length,ecarts};
}
function charger(){
 if(!fs.existsSync(WASM))throw new Error('module wasm absent');
 const coeur=Coeur.creer(fs.readFileSync(WASM));
 return Facade.creer(coeur,DV,GV,{forcerWasm:true});
}
function executer(){
 const F=charger();
 const cas=casFixes();
 appliquer(F,cas);
 const vars=preparerVariantes(40);
 appliquer(F,vars);
 const ecarts=comparer(cas).concat(comparer(vars));
 const rel=releve(F);
 return {cas:cas.length+vars.length+rel.cas,ecarts:ecarts.concat(rel.ecarts),releve:rel.cas};
}
function ecrire(resultat,fichier){
 fs.mkdirSync(path.dirname(fichier),{recursive:true});
 const propre={cas:resultat.cas,ecarts:resultat.ecarts.length,noms:resultat.ecarts.map(e=>e.nom)};
 fs.writeFileSync(fichier,JSON.stringify(propre,null,2)+'\n');
 if(resultat.ecarts.length){for(const e of resultat.ecarts.slice(0,8))console.error(e.nom,'\n JS',e.js,'\n WASM',e.wasm);}
 console.log(JSON.stringify(propre));
 return resultat.ecarts.length?1:0;
}

if(require.main===module&&!process.argv.includes('--chromium')&&!process.argv.includes('--temps')){
 const code=ecrire(executer(),path.join(RACINE,'chantiers/CH-072/parite-node.json'));
 process.exit(code);
}

function corpsNavigateur(){
 const src=fs.readFileSync(__filename,'utf8');
 const a=src.indexOf('function identique'),b=src.indexOf('function charger');
 if(a<0||b<0)throw new Error('corps du banc introuvable');
 return src.slice(a,b);
}
function pageHtml(){
 return `<!doctype html><meta charset="utf-8"><pre id="out">vide</pre><script>
${fs.readFileSync(path.join(RACINE,'ariane-rs/coquille/vba.js'),'utf8')}
${fs.readFileSync(path.join(RACINE,'ariane-rs/coquille/coeur.js'),'utf8')}
${fs.readFileSync(path.join(RACINE,'src/gestes-vue.js'),'utf8')}
${fs.readFileSync(path.join(RACINE,'src/deplacement-vue.js'),'utf8')}
${fs.readFileSync(path.join(RACINE,'ariane-rs/coquille/facade-vue.js'),'utf8')}
</script><script>
const DV=BananeDeplacementVue,GV=BananeGestesVue,Vba=ArianeVba;
const WASM_B64=${JSON.stringify(fs.readFileSync(WASM).toString('base64'))};
function b64(s){const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o;}
${corpsNavigateur()}
try{
const F=ArianeFacadeVue.creer(ArianeCoeur.creer(b64(WASM_B64)),DV,GV,{forcerWasm:true});
const cas=casFixes();appliquer(F,cas);const vars=preparerVariantes(40);appliquer(F,vars);
const ecarts=comparer(cas).concat(comparer(vars));const rel=releve(F);
const tous=ecarts.concat(rel.ecarts);
document.getElementById('out').textContent='CH072 '+JSON.stringify({cas:cas.length+vars.length+rel.cas,ecarts:tous.length,noms:tous.map(e=>e.nom)});
}catch(e){document.getElementById('out').textContent='CH072 '+JSON.stringify({erreur:String(e&&e.stack||e)}); }
</script>`;
}
function pageTemps(){
 return `<!doctype html><pre id="out">calcul</pre><script>
${fs.readFileSync(path.join(RACINE,'ariane-rs/coquille/vba.js'),'utf8')}
${fs.readFileSync(path.join(RACINE,'ariane-rs/coquille/coeur.js'),'utf8')}
${fs.readFileSync(path.join(RACINE,'src/gestes-vue.js'),'utf8')}
${fs.readFileSync(path.join(RACINE,'src/deplacement-vue.js'),'utf8')}
${fs.readFileSync(path.join(RACINE,'ariane-rs/coquille/facade-vue.js'),'utf8')}
const WASM_B64=${JSON.stringify(fs.readFileSync(WASM).toString('base64'))};
function b64(s){const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o;}
try{
const DV=BananeDeplacementVue,GV=BananeGestesVue;
const coeur=ArianeCoeur.creer(b64(WASM_B64));
const F=ArianeFacadeVue.creer(coeur,DV,GV,{forcerWasm:true});
const cote={cote:'left',ok:true,ndcAvant:[1.34,0.1],ndcApres:[0.2,0.1],pixelMm:{avant:.5,apres:.7},dureeMs:812,gestes:[{type:'molette',zoom:1.2,deplacement:{geste:'molette',ok:true,tentatives:1}}]};
const avant={cameraToSceneRelative:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],projection:[5,0,0,0,0,5,0,0,0,0,-1,0,0,0,0,1],viewport:{width:800,height:600}};
const apres={cameraToSceneRelative:[1,0,0,0,0,1,0,0,0,0,1,0,0.01,0,0,1],projection:[4,0,0,0,0,4,0,0,0,0,-1,0,0,0,0,1],viewport:{width:800,height:600}};
const msg='Vue ESV non restituée (échelle à 2,5 % ).';
const ops=[
 ['reglages',()=>DV.reglages({actif:true,geste:'molette',tentativesMax:2}),()=>F.reglages({actif:true,geste:'molette',tentativesMax:2})],
 ['detailDeplacement',()=>DV.detailDeplacement(cote,{phase:'pose'}),()=>F.detailDeplacement(cote,{phase:'pose'})],
 ['detailRemise',()=>DV.detailRemise(null,msg,{phase:'pose'}),()=>F.detailRemise(null,msg,{phase:'pose'})],
 ['juger',()=>DV.juger('molette',{sens:1,x0:0,y0:0,x1:10,y1:0},avant,apres,DV.reglages()),()=>F.juger('molette',{sens:1,x0:0,y0:0,x1:10,y1:0},avant,apres,DV.reglages())],
 ['besoin',()=>GV.besoin([1.2,-0.4],{width:800,height:600}),()=>F.gestes.besoin([1.2,-0.4],{width:800,height:600})],
 ['ecartCamera',()=>GV.ecartCamera(avant,apres),()=>F.gestes.ecartCamera(avant,apres)],
 ['pixelMm',()=>GV.pixelMm(avant),()=>F.gestes.pixelMm(avant)],
 ['journal',()=>{const j=new DV.Journal();j.noter('molette',{resultat:'mouvement',deplacementMm:3,zoom:1.1});return j.resume();},()=>{const j=new F.Journal();j.noter('molette',{resultat:'mouvement',deplacementMm:3,zoom:1.1});return j.resume();}],
 ['releve',()=>releveCourt(GV.Releveur),()=>releveCourt(F.gestes.Releveur)],
];
function releveCourt(Cible){
 let t=0;const taches=[],vue={id:'v'},cam={cameraToSceneRelative:avant.cameraToSceneRelative,projection:avant.projection,viewport:avant.viewport};
 const R=new Cible({lireCamera:()=>cam,emettre(){},planifier:(fn,ms)=>taches.push({at:t+ms,fn}),maintenant:()=>t,estVue:x=>x===vue});
 R.evenement({type:'pointerdown',isTrusted:true,target:vue,pointerId:1,button:0,buttons:1,clientX:0,clientY:0});
 R.evenement({type:'pointerup',isTrusted:true,target:vue,pointerId:1,button:0,clientX:8,clientY:0});
 const fin=t+500;for(;;){taches.sort((a,b)=>a.at-b.at);const k=taches[0];if(!k||k.at>fin)break;taches.shift();t=k.at;k.fn();}
}
function mediane(a){const b=a.slice().sort((x,y)=>x-y);return b[b.length>>1];}
const N=400,R=15,mesures=[];
for(const [nom,js,wasm] of ops){
 const a=[],b=[];
 for(let i=0;i<R;i++){const t=performance.now();for(let k=0;k<N;k++)js();a.push(performance.now()-t);}
 for(let i=0;i<R;i++){const t=performance.now();for(let k=0;k<N;k++)wasm();b.push(performance.now()-t);}
 const jsMs=mediane(a),wasmMs=mediane(b);
 mesures.push({nom,jsMs,wasmMs,jsUs:jsMs/N*1000,wasmUs:wasmMs/N*1000,lent:wasmMs>jsMs});
}
document.getElementById('out').textContent='CH072 '+JSON.stringify({repetitions:R,lot:N,mesures});
}catch(e){document.getElementById('out').textContent='CH072 '+JSON.stringify({erreur:String(e&&e.stack||e)});}
</script>`;
}

/* lancerChromium est asynchrone : le bloc du haut ne peut pas process.exit sur une promesse.
 * On réécrit l'entrée Chromium ici, après les déclarations. */
if(require.main===module&&(process.argv.includes('--chromium')||process.argv.includes('--temps'))){
 const temps=process.argv.includes('--temps');
 const html=temps?pageTemps():pageHtml();
 const fichierHtml=temps?'/tmp/ch072-temps.html':'/tmp/ch072-parite.html';
 fs.writeFileSync(fichierHtml,html);
 const bin=process.env.CHROMIUM||'/opt/pw-browsers/chromium';
 const budget=temps?'120000':'15000';
 const r=spawnSync(bin,['--headless=new','--disable-gpu','--no-sandbox','--dump-dom','--virtual-time-budget='+budget,'--user-data-dir=/tmp/ch072-chrome',`file://${fichierHtml}`],{encoding:'utf8',timeout:180000});
 const m=(r.stdout||'').match(/<pre id="out">([^<]*)<\/pre>/);
 if(!m){console.error('chromium muet',r.status,(r.stderr||'').slice(-400),(r.stdout||'').slice(0,300));process.exit(1);}
 const brut=m[1].replace(/^CH072 /,'').trim();
 let j;try{j=JSON.parse(brut);}catch(e){console.error('réponse illisible',brut.slice(0,500));process.exit(1);}
 if(j.erreur){console.error(j.erreur);process.exit(1);}
 const fichier=path.join(RACINE,temps?'chantiers/CH-072/temps-chromium.json':'chantiers/CH-072/parite-chromium.json');
 fs.mkdirSync(path.dirname(fichier),{recursive:true});
 fs.writeFileSync(fichier,JSON.stringify(j,null,2)+'\n');
 console.log(JSON.stringify(j));
 process.exit(temps?0:(j.ecarts?1:0));
}
module.exports={executer,identique};
