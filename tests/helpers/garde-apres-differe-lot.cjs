'use strict';
/* CH-019 — montage des essais de la GARDE « APRÈS UN DIFFÉRÉ » côté service worker (tests/garde-apres-differe-*-sw.test.cjs) : service worker
 * réel en VM, moteur et GCV1 réels, ESV simulé (tests/helpers/lot-profil.cjs). Lot des cuts 111 à 116, le 112 capturé sans point (le moteur
 * s'abstient, le lot le diffère) : les cuts qui suivent n'ont que le 111 pour appui. Profil du lot « actuel » par défaut (la GCV2 ne pose pas le
 * 112). `garde` : valeur de `lot.gardeApresDiffere` (absente : la valeur livrée) ; `sansModule` : le module retiré du service worker (le lot
 * d'avant CH-019). Un essai lourd par fichier (délai de 20 s par fichier de tools/verify.cjs). Données synthétiques. */
const {SCOPE,production,base,K,S,EsvTrou,attendre,ev,decisions}=require('./lot-profil.cjs');
async function lotGarde({garde,sansModule=false,profil='actuel',debut=111,fin=116}={}){
 const adapter=new EsvTrou([]),b=production({adapter});
 const lot={...S.lot,...(profil?{profil}:{})};if(garde!==undefined)lot.gardeApresDiffere=garde;
 b.ctx.BananeSettings={...b.ctx.BananeSettings,voiePrediteOmbre:{...S.voiePrediteOmbre,actif:false},lot};
 if(sansModule)b.ctx.BananeGardeApresDiffere=undefined;
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=debut;adapter.rails=K.clone(base.rails);adapter.ajuster();
 await b.api('start',{part:23,start:debut,end:fin,...SCOPE});await b.settle();await attendre(30);
 const batch=b.get('engine').s.batch;
 const j=v=>JSON.parse(JSON.stringify(v));
 return {b,adapter,batch,commandes:b.commands.slice(),gardes:j(ev(b,'garde-apres-differe')),
  differes:j((batch.deferred||[]).map(d=>d.cut)),valides:j((batch.processed||[]).map(p=>p.cut??p.identity?.cut))};
}
module.exports={lotGarde,decisions,ev};
