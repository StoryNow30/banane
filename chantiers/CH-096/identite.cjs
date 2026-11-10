'use strict';
/* CH-096 — relevé d'un lot SANS panne (3 cuts) joué par le service worker en vm (tests/helpers/fond-relecture.cjs) : commandes vers l'ESV
 * simulé dans l'ordre, cuts traités, types d'événements du journal, état final. Écrit le JSON sur la sortie. `CH096_SANS_PATCH=1` : la remise
 * d'étape du défaut 1 est neutralisée dans la copie de background.js chargée. Lancé dans le dépôt tel quel puis dans un arbre où les patchs
 * (adapter-page.patch, core.patch) sont appliqués : les sorties doivent être identiques à l'octet. */
const fs=require('node:fs'),path=require('node:path');
const MARQUE="/*CH-096-1*/['apply','validate'].includes(engine.s.batch?.step)";
if(process.env.CH096_SANS_PATCH==='1'){const reel=fs.readFileSync.bind(fs),cible=path.resolve(__dirname,'../../background.js');
 fs.readFileSync=(f,...a)=>{const t=reel(f,...a);return typeof t==='string'&&path.resolve(String(f))===cible?t.split(MARQUE).join("engine.s.batch?.step==='apply'"):t;};}
const {background}=require('../../tests/helpers/fond-relecture.cjs');
(async()=>{const sortie={};
 for(const arret of [false,true]){const b=background({globals:{BananeCore3:require('../../src/core.js')}});
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  await b.api('start',{part:23,start:100,end:102,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});
  /* Variante : « Arrêter » puis « Reprendre » (le chemin où passe la remise d'étape), sans aucune panne. */
  if(arret){await b.api('stop');await b.settle();
   for(let i=0;;i++){try{await b.api('resume');break;}catch(e){if(i>2000||!/Attends la fin/.test(e.message)){sortie.refus=e.message;break;}await new Promise(r=>setImmediate(r));}}}
  const vue=await b.settle();
  sortie[arret?'arret-reprise':'direct']={commandes:b.adapter.calls,etat:vue.batch.state,etape:vue.batch.step,traites:vue.batch.processed.map(x=>x.cut),
   evenements:b.store.state?.events?.map(e=>e.type)??null,rails:b.adapter.rails};}
 process.stdout.write(JSON.stringify(sortie));})().catch(e=>{console.error(e);process.exit(1);});
