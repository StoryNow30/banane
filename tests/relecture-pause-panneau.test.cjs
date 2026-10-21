'use strict';
/* Test 17 (D-232 à D-234) — PAUSE ET REPRISE DE LA RELECTURE, PARTIE PANNEAU (src/relecture-pause.js, bloc #relecture-pause-zone de panel.html), contre une page minimale :
 *  - ce que le panneau montre pour chaque état de la passe (Pause, « Pause demandée… », Reprendre, Arrêter, la ligne et sa raison) ; réglage éteint : rien de plus qu'avant ;
 *  - « Reprendre » est grisée tant qu'ESV ne répond pas, avec sa raison ;
 *  - chaque bouton envoie au service worker l'action prévue, rien d'autre ; une erreur du service worker est dite ;
 *  - le réglage ne se change pas pendant la passe ; l'arrêt sur F5 n'a de sens que réglage allumé. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {element,IDS}=require('./helpers/ui5-page.cjs');
const source=fs.readFileSync(path.join(__dirname,'..','src/relecture-pause.js'),'utf8');
const js=x=>JSON.parse(JSON.stringify(x));   /* les objets de la vm viennent d'un autre contexte : on compare leur contenu */
const passe=(o={})=>({lotId:'L1',etat:'en-cours',faits:12,total:85,cut:110,reprise:true,pauseDemandee:false,pauseRaison:null,expire:null,...o});

/* `repondre(action, args)` : réponse du service worker (une valeur, ou {error}) ; `esvMuet` : état du panneau d'origine. */
async function monter({etat,repondre=()=>({}),esvMuet=false}={}){
 const els=Object.fromEntries(IDS.map(id=>[id,element(id)])),envoyes=[];
 const ctx={console,setTimeout:()=>0,clearTimeout:()=>{},document:{readyState:'complete',activeElement:null,getElementById:id=>els[id]||null},
  chrome:{runtime:{sendMessage:async m=>{envoyes.push(js(m));if(m.action==='relecture-pause-reglage')etat={...etat,repriseReglage:m.args};   /* le service worker garde le réglage */
   const r=m.action==='relecture-etat'?etat:repondre(m.action,m.args);return r&&r.error?{error:r.error}:{result:r};}}},
  ArianePanel:{state:()=>({connection:{status:esvMuet?'unavailable':'ok'}})}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 await new Promise(r=>setTimeout(r,10));
 return {els,envoyes,P:ctx.ArianeRelecturePause,attendre:()=>new Promise(r=>setTimeout(r,10)),pousser:e=>{etat=e;return ctx.ArianeRelecturePause.rafraichir();}};
}
const ETAT=(p,actif=true,f5='pause')=>({choix:'ombre',lot:null,passe:p,repriseReglage:{actif,f5}});

test('ce que le panneau montre : Pause pendant la passe (réglage allumé seulement), « Pause demandée… » grisée, Reprendre et Arrêter pendant la pause',async()=>{
 const m=await monter({etat:ETAT(passe())}),{P}=m;
 assert.deepEqual(js(P.vue(ETAT(null))),{pause:null,reprendre:null,arreter:false,ligne:''});
 assert.deepEqual(js(P.vue(ETAT(passe()))).pause,{texte:'Pause',actif:true});
 assert.deepEqual(js(P.vue(ETAT(passe({pauseDemandee:true})))).pause,{texte:'Pause demandée…',actif:false});
 assert.equal(P.vue(ETAT(passe(),false)).pause,null,'réglage éteint : pas de Pause');
 assert.equal(P.vue(ETAT(passe({reprise:false}))).pause,null,'passe partie réglage éteint : pas de Pause');
 assert.equal(P.vue(ETAT(passe({etat:'preparation'}))).pause,null);assert.equal(P.vue(ETAT(passe({etat:'finie'}))).arreter,false);
 const v=js(P.vue(ETAT(passe({etat:'en-pause',pauseRaison:'mic',expire:Date.UTC(2026,9,22,12,0)}))));
 assert.deepEqual(v.reprendre,{texte:'Reprendre la relecture au cut 110',actif:true,raison:''});assert.equal(v.arreter,true);assert.equal(v.pause,null);
 assert.match(v.ligne,/^Relecture en pause au cut 110 · 12 cuts relus sur 85 · gardée jusqu’à \d\d\/\d\d/);
 assert.equal(P.vue(ETAT(passe({etat:'en-pause',faits:1,total:7,pauseRaison:'mic'}))).ligne,'Relecture en pause au cut 110 · 1 cut relu sur 7.');
 assert.match(P.vue(ETAT(passe({etat:'en-pause',pauseRaison:'esv'}))).ligne,/^ESV ne répond plus : relecture gardée en pause au cut 110/);
 assert.match(P.vue(ETAT(passe({etat:'en-pause',pauseRaison:'redemarrage'}))).ligne,/^Relecture gardée en pause \(Ariane a redémarré\) au cut 110/);
 const muet=js(P.vue(ETAT(passe({etat:'en-pause',pauseRaison:'esv'})),{esvMuet:true}));
 assert.deepEqual(muet.reprendre,{texte:'Reprendre la relecture',actif:false,raison:'Disponible quand ESV répond.'});assert.equal(muet.arreter,true,'on peut toujours arrêter');
});

test('à l’écran : boutons visibles selon l’état, Reprendre grisée et expliquée si ESV est muet, réglage figé pendant la passe',async()=>{
 const m=await monter({etat:ETAT(passe())});
 assert.equal(m.els['relecture-pause'].hidden,false);assert.equal(m.els['relecture-pause'].disabled,false);assert.equal(m.els['relecture-reprendre'].hidden,true);assert.equal(m.els['relecture-arreter-pause'].hidden,true);
 assert.equal(m.els['relecture-pause-actif'].checked,true);assert.equal(m.els['relecture-pause-actif'].disabled,true,'réglage figé pendant la passe');assert.equal(m.els['relecture-f5'].disabled,true);
 await m.pousser(ETAT(passe({pauseDemandee:true})));assert.equal(m.els['relecture-pause'].textContent,'Pause demandée…');assert.equal(m.els['relecture-pause'].disabled,true);
 await m.pousser(ETAT(passe({etat:'en-pause',pauseRaison:'mic'})));
 assert.equal(m.els['relecture-pause'].hidden,true);assert.equal(m.els['relecture-reprendre'].hidden,false);assert.equal(m.els['relecture-reprendre'].textContent,'Reprendre la relecture au cut 110');
 assert.equal(m.els['relecture-arreter-pause'].hidden,false);assert.equal(m.els['relecture-pause-ligne'].hidden,false);assert.equal(m.els['relecture-pause-raison'].hidden,true);
 assert.equal(m.els['relecture-pause-actif'].disabled,true,'figé aussi pendant la pause');
 await m.pousser(ETAT(null,true,'arret'));
 assert.equal(m.els['relecture-pause-actif'].disabled,false);assert.equal(m.els['relecture-f5'].disabled,false);assert.equal(m.els['relecture-f5'].value,'arret');
 await m.pousser(ETAT(null,false));assert.equal(m.els['relecture-pause-actif'].checked,false);assert.equal(m.els['relecture-f5'].disabled,true,'l’arrêt sur F5 n’a de sens que réglage allumé');
 for(const id of ['relecture-pause','relecture-reprendre','relecture-arreter-pause'])assert.equal(m.els[id].hidden,true,id+' : rien de plus qu’avant réglage éteint, hors pause');
 const muet=await monter({etat:ETAT(passe({etat:'en-pause',pauseRaison:'esv'})),esvMuet:true});
 assert.equal(muet.els['relecture-reprendre'].disabled,true);assert.equal(muet.els['relecture-reprendre'].title,'Disponible quand ESV répond.');
 assert.equal(muet.els['relecture-pause-raison'].hidden,false);assert.equal(muet.els['relecture-pause-raison'].textContent,'Disponible quand ESV répond.');
});

test('chaque bouton envoie au service worker l’action prévue et rien d’autre ; une erreur est dite',async()=>{
 const m=await monter({etat:ETAT(passe({etat:'en-pause',pauseRaison:'mic'}),false),repondre:a=>a==='relecture-reprendre'?{error:'Relecture non reprise : ESV ne répond pas.'}:{}});
 const actions=()=>m.envoyes.map(e=>e.action).filter(a=>a!=='relecture-etat');
 m.els['relecture-reprendre'].click();await m.attendre();
 assert.deepEqual(actions(),['relecture-reprendre']);assert.equal(m.els['relecture-pause-note'].hidden,false);assert.equal(m.els['relecture-pause-note'].textContent,'Relecture non reprise : ESV ne répond pas.');
 m.els['relecture-arreter-pause'].click();await m.attendre();assert.deepEqual(actions(),['relecture-reprendre','relecture-arreter']);assert.equal(m.els['relecture-pause-note'].hidden,true,'la note disparaît à l’action suivante');
 await m.pousser(ETAT(passe()));m.els['relecture-pause'].click();await m.attendre();assert.deepEqual(actions().slice(2),['relecture-pause']);
 await m.pousser(ETAT(null,false));
 m.els['relecture-pause-actif'].checked=true;m.els['relecture-pause-actif'].onchange();await m.attendre();
 m.els['relecture-f5'].value='arret';m.els['relecture-f5'].onchange();await m.attendre();
 const reglages=m.envoyes.filter(e=>e.action==='relecture-pause-reglage');
 assert.deepEqual(js(reglages.map(e=>e.args)),[{actif:true,f5:'pause'},{actif:true,f5:'arret'}]);
 assert.ok(m.envoyes.every(e=>e.kind==='panel'),'tout passe par le service worker, aucun envoi à ESV');
});
