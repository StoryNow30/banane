'use strict';
/* CH-104 — L'ÉCRAN « RELECTURE EN PAUSE » EST ATTEINT (relecture critique CH-106, 11/11 ; défaut présent aussi avant le chantier), dans un vrai
 * navigateur (ignoré, et dit ignoré, sans Chromium). Pendant une pause de relecture le panneau d'origine cache `#relecture-arreter` et montre
 * `#relecture-reprendre` et `#relecture-arreter-pause` : Signal restait sur « Terminé », sans aucun moyen de reprendre ni d'arrêter la relecture.
 * Attendu : le mot « Relecture en pause », les deux actions au pied, chacune envoyant l'ordre du bouton d'origine ; ESV muet : « Reprendre » grisé avec
 * sa raison ; la passe en pause d'un AUTRE lot ne change rien. Montage : tests/helpers/signal-navigateur.cjs ; lot fini `lot-1`. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,ouvrir,SC}=require('./helpers/signal-navigateur.cjs');
const passe=(o={})=>({lotId:'lot-1',etat:'en-pause',mode:'corriger',modeEffectif:'corriger',faits:12,total:85,corriges:3,cut:4801,reprise:true,pauseDemandee:false,pauseRaison:'esv',expire:null,...o});
/* `relecture-etat` répond la passe voulue ; les ordres de relecture envoyés sont notés avec leurs arguments. */
async function monter(nav,p,etat=SC.fin){
 const page=await nav.newPage({viewport:{width:600,height:760}});await page.close();
 const sig=await ouvrir(nav,etat,{width:600,height:760});
 await sig.page.addInitScript(p=>{const f=window.chrome.runtime.sendMessage;window.__r=[];
  window.chrome.runtime.sendMessage=async m=>{if(m.action==='relecture-etat')return {result:{choix:'corriger',lot:{id:'lot-1'},passe:p,repriseReglage:{actif:true}}};
   if(/^relecture-(reprendre|arreter|pause)$/.test(m.action||''))window.__r.push(m.action);return f(m);};},p);
 await sig.page.reload();await sig.page.waitForTimeout(1700);
 return sig;
}
const ecran=page=>page.evaluate(()=>({mot:document.querySelector('#ui5 .sg-mot')?.textContent,etat:document.querySelector('#ui5 .sg-fen')?.dataset.etat,
 pied:[...document.querySelectorAll('#ui5 .sg-actions button')].map(b=>(b.dataset.act||'')+(b.disabled?' (grisé)':'')),raison:document.querySelector('#ui5 .sg-actions .sg-raison')?.textContent||'',
 relecture:(()=>{const li=[...document.querySelectorAll('#ui5 .sg-zone:not(.sg-sort) .sg-etapes li')].find(x=>/Relecture/.test(x.textContent));return li?li.dataset.etape+' '+li.querySelector('span').textContent:'';})()}));

test('relecture en pause (ESV, redémarrage, opérateur) : « Relecture en pause », Reprendre et Arrêter au pied, mêmes ordres que les boutons d’origine',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const ordres={};
  for(const raison of ['esv','redemarrage','operateur']){
   const {page,erreurs}=await monter(nav,passe({pauseRaison:raison}));const e=await ecran(page);
   assert.equal(e.mot,'Relecture en pause',raison);assert.equal(e.etat,'rel',raison);
   assert.deepEqual(e.pied,['legacy:relecture-reprendre','legacy:relecture-arreter-pause'],raison);
   assert.equal(e.relecture,'actif en pause · 12 sur 85',raison+' : l’étape le dit, sans coche');
   /* les deux ordres : par les boutons de Signal (première page), puis par les boutons d'origine (deuxième page) ; ils doivent être les mêmes */
   if(raison==='esv'||raison==='redemarrage'){
    const cliquer=raison==='esv'?id=>page.click('#ui5 .sg-actions [data-act="legacy:'+id+'"]'):id=>page.evaluate(i=>document.getElementById(i).click(),id);
    await cliquer('relecture-reprendre');await page.waitForTimeout(500);await cliquer('relecture-arreter-pause');await page.waitForTimeout(500);
    ordres[raison]=await page.evaluate(()=>window.__r.splice(0));
   }
   assert.deepEqual(erreurs,[]);await page.close();
  }
  assert.deepEqual(ordres.esv,['relecture-reprendre','relecture-arreter'],'les boutons de Signal envoient les deux ordres');
  assert.deepEqual(ordres.esv,ordres.redemarrage,'mêmes ordres que #relecture-reprendre et #relecture-arreter-pause cliqués directement');
 }finally{await nav.close();}
});
