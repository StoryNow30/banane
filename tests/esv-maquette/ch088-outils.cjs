'use strict';
/* CH-088 — outils de maquette de l'opération lointaine : copie de l'adaptateur patchée par chantiers/CH-088/adapter-page.patch (sur celle de CH-080, ou
 * sur le tronc qui la porte), et une séance « grand saut » : `grappe` coupes à faire d'affilée (+1), puis un saut de `saut − grappe + 1` coupes.
 * Chaque transition (capture, pose, temps mort, validation) est celle de tests/esv-maquette/ch083-outils.cjs ; la dernière est le grand saut. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const N=require('./navigateur.cjs'),O77=require('./ch077-outils.cjs'),O80=require('./ch080-outils.cjs');
let copie=null;
function adaptateurCH088(){if(copie!==null)return copie;const base=O80.adaptateurCH080();if(base===null)return null;if(base.includes('CH-088 : loin'))return copie=base;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch088-m-'));fs.mkdirSync(path.join(dir,'src'));fs.writeFileSync(path.join(dir,'src/adapter-page.js'),base);
 const r=spawnSync('patch',['-s','-p1','-d',dir,'-i',path.join(N.racine,'chantiers/CH-088/adapter-page.patch')],{encoding:'utf8'});
 if(r.error?.code==='ENOENT')return null;if(r.status!==0)throw Error('le patch CH-088 ne s’applique plus : '+(r.stderr||r.stdout));
 return copie=fs.readFileSync(path.join(dir,'src/adapter-page.js'),'utf8');}
/* Une séance : page neuve, `grappe` − 1 transitions proches, puis le grand saut. Rend le grand saut et les événements du préchauffage. */
async function grandSaut({loin=true,saut=250,grappe=4,pas=0.2,latence=60,decode=40,mortMs=900}={}){   /* `pas` 0,2 m : 255 cuts sur 51 m, dans le cube EPT de 128 m */
 const O=require('./ch083-outils.cjs');
 const s=await O.ouvrir({voie:'potree',memoire:true,saut,grappe,pas,cuts:saut+grappe+1,decode,loin,adaptateur:adaptateurCH088()});
 try{s.env.serveur.pannes({eptLatenceMs:latence});const proches=[],evts=[];
  for(let i=0;i<grappe-1;i++){const t=await s.transition({mortMs});if(t.suivant-t.cut!==1)throw Error(`transition proche inattendue : ${t.cut} → ${t.suivant}`);proches.push(t);evts.push(...t.evts);}
  const t=await s.transition({mortMs});if(t.suivant-t.cut!==saut-grappe+1)throw Error(`grand saut inattendu : ${t.cut} → ${t.suivant}`);
  /* bilan de l'arrivée : il part au début de la capture suivante (instantané au début de celle du grand saut) */
  await O77.attendre(()=>s.page.evaluate(()=>window.__maquette.etat().railsPrets));
  const st=(await s.env.appel('state')).result,t0=Date.now(),c=await s.env.appel('capture',[st]);if(c.error)throw Error('capture : '+c.error);const captureArriveeMs=Date.now()-t0;
  await new Promise(r=>setTimeout(r,200));evts.push(...t.evts,...await s.page.evaluate(()=>window.__evts.splice(0)));
  return {t,proches,captureArriveeMs,evts,loin:evts.filter(e=>e.kind==='prechauffage-loin'),bilans:evts.filter(e=>e.kind==='prechauffage-bilan')};}
 finally{await s.fermer().catch(()=>{});}}
module.exports={adaptateurCH088,grandSaut};
