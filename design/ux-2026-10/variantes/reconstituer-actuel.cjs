// Reconstitue la vue Orbite ACTUELLE (panel.html + panel.css du dépôt, sans panel.js)
// avec les mêmes données fictives que les maquettes, et la rend en PNG 480 px ×2.
// La ligne et l'écart à la voie sont dessinés par le code même de panel.js (dessinerVoie).
const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('/opt/node22/lib/node_modules/playwright');}
const root=path.resolve(__dirname,'../../..'),dir=__dirname;
const src=fs.readFileSync(path.join(root,'panel.js'),'utf8');
const voieCode=src.slice(src.indexOf(' function dessinerVoie'),src.indexOf(' /* Tuiles',src.indexOf(' function dessinerVoie')));
const remplir=`(()=>{const D=globalThis.D;const $=id=>document.getElementById(id);
 const r1=x=>Math.round(x*10)/10,entier=x=>String(Math.trunc(x)),fr1=x=>String(r1(x)).replace('.',','),quantile=(a,p)=>a[Math.floor((a.length-1)*p)];
 ${voieCode}
 document.body.dataset.window='automatic';document.querySelectorAll('.vue').forEach(s=>s.hidden=s.dataset.vue!=='automatic');
 $('tab-automatic').classList.add('actif');$('tab-automatic').dataset.etat='vert';$('sous-titre').textContent='Orbite';
 $('context').textContent='ESV · partie 34 · cut 8455';$('notice').textContent='Lot en cours : Orbite pose le cut 8455.';
 $('lot-etat').className='eyebrow live rise d0';$('lot-etat').textContent='En cours · pose des rails';$('lot-cut').textContent='8455';
 $('lot-etapes').hidden=false;const e=$('lot-etapes').children;e[0].className='fait';e[1].className='actif';
 $('lot-progres').hidden=false;$('lot-progres-fill').style.width='20%';$('lot-debut').textContent='8410';$('lot-pct').textContent='20 % de la plage';$('lot-fin').textContent='8640';
 $('lot-plage').textContent='Partie 34 · 8410 → 8640';
 $('lot-commande').hidden=false;$('lot-cmd-nom').textContent='Valider et passer au suivant';$('lot-cmd-cut').textContent='cut 8454';
 $('lot-cmd-etapes').innerHTML='<span class="step done"><i></i>émise</span><span class="bar-sep"></span><span class="step seen"><i></i>navigation observée</span><span class="bar-sep"></span><span class="step na"><i></i>serveur : non disponible</span>';
 $('lot-compteurs').hidden=false;$('lot-compteurs').innerHTML=[['Posés','42','','dont 9 par la voie'],['Différés','3','amber','à reprendre'],['Couverture','93 %','','42 sur 45 cuts du lot']].map(([l,v,t,s])=>'<div class="tuile"><span class="lbl">'+l+'</span><b class="'+t+'">'+v+'</b><small>'+s+'</small></div>').join('');
 const cls={moteur:'moteur',voie:'voie-l',differe:'differe',actuel:'actuel'};
 const v={cuts:D.cuts,classe:c=>cls[D.classe(c)],ouvert:true,ecart:D.ecart};
 $('voie').hidden=false;$('voie-legende').hidden=false;$('voie').innerHTML=dessinerVoie(v);
 $('lot-activite-bloc').hidden=false;$('lot-activite').innerHTML=D.activite.map(x=>'<div class="l"><span class="h">'+x.h+'</span><span class="c">'+x.c+'</span><span class="quoi '+(x.k==='voie'?'voie-l':x.k)+'">'+x.q+'</span><span class="v">'+x.v+'</span></div>').join('');
 $('part-summary').hidden=false;$('part-summary-title').textContent='Résumé de la partie 34';$('part-summary-line').textContent='Coupes traitées 214 · Posées 208 · Différés restants 4';
 $('batch').textContent='En cours · 45 cuts traités · 0 ignorés · Différés : 3';
 $('lot-bornes').hidden=true;
 for(const id of ['start-batch','export-tout'])$(id).hidden=id==='start-batch';$('pause').hidden=false;$('stop').hidden=false;$('stop').className='link danger';$('pause').className='primary';
 for(const id of ['lot-decision-effective','unresolved-policy-effective','policy-effective'])$(id).hidden=false;
 $('lot-decision-effective').textContent='Décision sur le lot dans ce lot : appliquée.';$('unresolved-policy-effective').textContent='Politique effective de ce lot : continuer et différer.';$('policy-effective').textContent='Politique effective de ce lot : mettre le lot en pause.';
 $('departs-liste').innerHTML='2026-10-13 12:58:02 UTC · partie 34 · validés 1 284 · invalides 37 · total 2 140<br>2026-10-12 16:04:40 UTC · partie 33 · validés 2 015 · invalides 12 · total 2 310';
 $('tabs').innerHTML='<option>Ouvre ESV dans Edge</option>';
})();`;
(async()=>{
 const b=await pw.chromium.launch(),ctx=await b.newContext({viewport:{width:480,height:200},deviceScaleFactor:2});
 for(const theme of ['sombre','clair']){
  const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
  await p.route('**/*.js',r=>r.request().url().endsWith('/commun.js')?r.continue():r.abort());
  await p.goto('file://'+path.join(root,'panel.html'));
  await p.addScriptTag({path:path.join(dir,'commun.js')});
  await p.addScriptTag({content:remplir});
  await p.evaluate(t=>document.documentElement.dataset.theme=t==='sombre'?'dark':'light',theme);
  await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(700);
  // La barre d'action est collante : en pleine page, on la remet dans le flux.
  await p.addStyleTag({content:'.actions{position:static!important}'});
  await p.screenshot({path:path.join(dir,`0-actuel-${theme}.png`),fullPage:true});console.log(`0-actuel-${theme}.png`);await p.close();
 }
 await b.close();
})();
