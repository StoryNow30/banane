'use strict';
/* RM-11 (test 9, fiches/RM11_RAISON_CORRECTION.md, essai 6) — le bloc « Raison de la correction » du panneau d'Écho : identifiants, états, étiquettes
 * d'accessibilité, pastilles et touches du panneau, bandeau d'ESV, choix gardé par le service worker. `panel.js` est chargé tel quel dans un contexte
 * `vm` (comme tests/panel-h.test.cjs), DOM et API Chrome simulés, avec les écouteurs gardés pour pouvoir cliquer. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../src/raison-correction.js'),S=require('../src/settings.js');
const lire=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const HTML=lire('panel.html'),CSS=lire('panel.css'),SOURCE=lire('panel.js');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',style:{},onclick:null,
  classList:{toggle(){}},dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(){},replaceChildren(){},append(){},addEventListener(){},focus(){}});
async function panneau(state,{hash='#native',choix={actif:false,touches:'chiffres'},sansModule=false,bandeau=false}={}){
  const elements=new Map(),appels=[],touches=[];
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:()=>element(),addEventListener:(type,fn)=>{if(type==='keydown')touches.push(fn);},
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async({action,args})=>{appels.push({action,args});
      const result=action==='view'?state:action==='list-tabs'?[]:action==='bandeau-etat'?{on:bandeau}:action==='raison-choix-etat'?choix:action==='raison-choix'?{...choix,...args}:{};
      return {result};}}};
  const context={document,chrome,location:{hash},addEventListener:()=>{},setInterval:()=>{},setTimeout:()=>{},clearTimeout:()=>{},console,Date,
    ...(sansModule?{}:{BananeRaisonCorrection:R})};
  vm.createContext(context);vm.runInContext(SOURCE,context);
  for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));
  return {$:id=>document.getElementById(id),appels,touches,document,attendre:async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));}};
}
const t0=Date.parse('2026-10-19T09:00:00Z'),iso=s=>new Date(t0+s*1000).toISOString();
function natif({raison=null,codes=[],status='RUNNING',encours=true}={}){
 const visits=codes.map((c,i)=>({visitId:'v'+i,visitIndex:i,identity:{part:7,cut:100+i},startedAt:iso(i*10),...(c?{raison:c}:{}),...(i<codes.length-1||!encours?{endedAt:iso(i*10+5)}:{})}));
 return {native:{status,visits,incomplete:[],...(raison?{raison}:{})},current:{identity:{part:7,cut:100+codes.length-1}}};}
/* Les objets du contexte `vm` n'ont pas le prototype de ce fichier : on compare des copies. */
const plat=x=>JSON.parse(JSON.stringify(x));
const envois=(p,action)=>p.appels.filter(a=>a.action===action).map(a=>plat(a.args));
const etat=(extra={})=>({...R.nouvelEtat(),...extra});

test('panel.html : le bloc est dans la vue Écho, avec ses identifiants, ses étiquettes et ses rôles',()=>{
 const natifHtml=HTML.slice(HTML.indexOf('data-vue="native"'),HTML.indexOf('data-vue="automatic"'));
 assert.equal((HTML.match(/id="carte-raison"/g)||[]).length,1);assert.ok(natifHtml.includes('id="carte-raison"'),'dans la vue Écho');
 const ids=[...HTML.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'identifiants uniques');
 for(const id of ['raison-titre','raison-actif','raison-touches-choix','raison-touches-chiffres','raison-touches-alt-chiffres','raison-touches-pave','raison-note','raison-suivi','raison-pastilles',
  'raison-1','raison-2','raison-3','raison-4','raison-5','raison-6','raison-0','raison-ligne','raison-rappel','raison-bande','raison-couverture','raison-aide'])assert.ok(ids.includes(id),id);
 const bloc=natifHtml.slice(natifHtml.indexOf('id="carte-raison"'),natifHtml.indexOf('</section>',natifHtml.indexOf('id="carte-raison"')));
 assert.match(bloc,/aria-labelledby="raison-titre"/);assert.match(bloc,/<legend class="lbl">Touches lues<\/legend>/);
 assert.match(bloc,/id="raison-pastilles" class="pastilles" role="group" aria-label="Raison de ce cut"/);
 /* Six pastilles dans l'ordre du catalogue, leur étiquette parlée dit la touche et la raison ; le 0 dit qu'il efface et finit la collante. */
 R.CATALOGUE.forEach((c,i)=>{const b=bloc.match(new RegExp(`<button type="button" id="raison-${i+1}" class="pastille" data-code="${c.code}" aria-pressed="false" aria-label="${i+1}, ([^"]+)"><b>${i+1}</b> ([^<]+)</button>`));
  assert.ok(b,'pastille '+(i+1));assert.equal(b[1].toLowerCase(),c.libelle.toLowerCase(),'étiquette parlée');assert.equal(b[2],c.libelle,'libellé affiché');});
 assert.match(bloc,/<button type="button" id="raison-0" class="pastille efface" aria-label="0, effacer la raison et finir la collante"><b>0<\/b> Effacer<\/button>/);
 assert.match(bloc,/id="raison-ligne"[^>]*role="status" aria-live="polite"/);assert.match(bloc,/id="raison-bande"[^>]*role="img" aria-label="Raisons posées sur les 24 derniers cuts"/);
 assert.match(bloc,/<input type="checkbox" id="raison-actif">/);assert.equal((bloc.match(/type="radio" name="raison-touches"/g)||[]).length,3);
 for(const t of R.TABLES)assert.match(bloc,new RegExp(`id="raison-touches-${t}" value="${t}"`));
 assert.ok(!/checked/.test(bloc),'rien de coché dans le HTML : le service worker dit le choix');
 assert.ok(/id="raison-suivi" hidden/.test(bloc)&&/id="raison-rappel" class="warning" role="status" hidden/.test(bloc),'le suivi et le rappel sont cachés tant que rien ne les appelle');
 assert.ok(bloc.includes(`depuis ${S.echo.raison.rappelCollanteCuts} cuts`),'le rappel dit le seuil du réglage');
 assert.match(bloc,/Comment taper une raison/);assert.match(bloc,/Deux appuis/);assert.match(bloc,/une demi-seconde/);assert.match(bloc,/sans touche, la raison reste inconnue/);
 assert.ok(HTML.indexOf('src/raison-correction.js')>0&&HTML.indexOf('src/raison-correction.js')<HTML.indexOf('src="panel.js"'),'le module est chargé avant panel.js');
 assert.match(CSS,/\.raison \.pastille\[aria-pressed=true\]/);assert.match(CSS,/\.raison \.pastille:focus-visible/);assert.match(CSS,/\.bande-raison i\.r-adv/);
});

test('l\'état du panneau : coupé par défaut, rien de coché, le suivi caché ; l\'ancienne session (sans raison) ne change rien',async()=>{
 const {$,appels}=await panneau(natif({codes:[null,null]}));
 assert.equal($('raison-actif').checked,false);assert.equal($('raison-suivi').hidden,true);
 assert.match($('raison-note').textContent,/Coupée par défaut\. Lue au démarrage d’Écho, gardée jusqu’à la fin de la séance/);
 assert.ok(appels.some(a=>a.action==='raison-choix-etat'),'le choix est relu au service worker');
 assert.ok(!appels.some(a=>a.action==='native-raison'),'aucune raison envoyée');
 const sans=await panneau(natif({codes:[null]}),{sansModule:true});assert.equal(sans.$('native-count').textContent,'1','sans le module (page ancienne), le panneau tourne comme avant');
});
test('le choix gardé : la case et la rangée de touches reflètent le service worker ; un clic le change pour la prochaine séance',async()=>{
 const p=await panneau(natif({codes:[]}),{choix:{actif:true,touches:'alt-chiffres'}});
 assert.equal(p.$('raison-actif').checked,true);assert.equal(p.$('raison-touches-alt-chiffres').checked,true);assert.equal(p.$('raison-touches-chiffres').checked,false);assert.equal(p.$('raison-touches-pave').checked,false);
 p.$('raison-actif').checked=false;await p.$('raison-actif').onclick();await p.attendre();
 assert.deepEqual(envois(p,'raison-choix'),[{actif:false}]);
 p.$('raison-touches-pave').checked=true;await p.$('raison-touches-pave').onclick();assert.deepEqual(envois(p,'raison-choix').at(-1),{touches:'pave'});
 p.$('raison-touches-chiffres').checked=false;await p.$('raison-touches-chiffres').onclick();assert.equal(p.appels.filter(a=>a.action==='raison-choix').length,2,'une case décochée n\'envoie rien');
});
test('séance ouverte : le panneau dit qu\'elle garde son choix ; avec la lecture allumée, il dit qu\'elle l\'est',async()=>{
 const garde=await panneau(natif({codes:[null]}),{choix:{actif:true,touches:'chiffres'}});
 assert.match(garde.$('raison-note').textContent,/^La séance en cours garde son choix jusqu’à sa fin ; le choix coché servira à la prochaine séance\.$/);
 const allumee=await panneau(natif({raison:etat(),codes:[null]}),{choix:{actif:true,touches:'chiffres'}});
 assert.match(allumee.$('raison-note').textContent,/^Lecture allumée pour cette séance\./);assert.equal(allumee.$('raison-suivi').hidden,false);
});

test('suivi : les pastilles, la raison de ce cut, la collante, la bande des 24 derniers cuts, la couverture',async()=>{
 const e=etat();R.appuyer(e,{code:'adv',cutKey:'k',part:7,cut:100,at:1000,poseeA:iso(0),eventSeq:5},R.REGLAGE_DEFAUT);R.appuyer(e,{code:'adv',cutKey:'k',part:7,cut:100,at:1200,poseeA:iso(0),eventSeq:6},R.REGLAGE_DEFAUT);
 const codes=Array.from({length:30},(_,i)=>i%5===0?'adv':i===29?'hauteur':null);
 const {$}=await panneau(natif({raison:e,codes}));
 assert.equal($('raison-suivi').hidden,false);
 R.CATALOGUE.forEach((c,i)=>{assert.equal($('raison-'+(i+1)).disabled,false);assert.equal($('raison-'+(i+1)).attrs['aria-pressed'],String(c.code==='hauteur'),c.code);});
 assert.equal($('raison-0').disabled,false);
 assert.equal($('raison-ligne').textContent,'Ce cut : Hauteur seulement. Collante : ADV, depuis le cut 100 (1 cut). Tape 0 pour la finir.');
 const bande=$('raison-bande').innerHTML;assert.equal((bande.match(/<i /g)||[]).length,24);assert.match(bande,/<i class="r r-adv" title="cut 110 · ADV"><\/i>/);assert.match(bande,/<i class="r r-hauteur" title="cut 129 · Hauteur seulement"><\/i>/);
 assert.match(bande,/<i class="" title="cut 106 · aucune raison"><\/i>/);
 assert.equal($('raison-couverture').textContent,'Raison posée sur 5 des 24 derniers cuts. Les autres restent inconnues.');
 assert.equal($('raison-rappel').hidden,true);
});
test('suivi : sans collante la ligne le dit ; la collante de 40 cuts affiche le rappel doux ; hors cut en cours les pastilles sont grisées',async()=>{
 let p=await panneau(natif({raison:etat(),codes:[null]}));
 assert.equal(p.$('raison-ligne').textContent,'Ce cut : aucune raison. Aucune raison collante : deux appuis sur la même touche la rendent collante.');
 const e=etat();R.appuyer(e,{code:'pn',cutKey:'k',part:7,cut:100,at:1000,poseeA:iso(0),eventSeq:5},R.REGLAGE_DEFAUT);R.appuyer(e,{code:'pn',cutKey:'k',part:7,cut:100,at:1200,poseeA:iso(0),eventSeq:6},R.REGLAGE_DEFAUT);
 for(let c=101;c<=139;c++)R.heriter(e,{part:7,cut:c},R.REGLAGE_DEFAUT);
 p=await panneau(natif({raison:e,codes:[null]}));assert.equal(p.$('raison-rappel').hidden,false);assert.match(p.$('raison-ligne').textContent,/Collante : PN, depuis le cut 100 \(40 cuts\)/);
 p=await panneau(natif({raison:etat(),codes:[null],status:'PAUSED'}));
 for(const id of ['raison-1','raison-6','raison-0'])assert.equal(p.$(id).disabled,true,id+' en pause');assert.match(p.$('raison-ligne').textContent,/^Pas de cut en cours\./);
});

test('un clic sur une pastille envoie la raison au service worker, sans rien bloquer ; le 0 efface',async()=>{
 const p=await panneau(natif({raison:etat(),codes:[null]}));
 await p.$('raison-3').onclick();await p.$('raison-3').onclick();await p.$('raison-0').onclick();await p.attendre();
 assert.deepEqual(envois(p,'native-raison'),[{code:'pn'},{code:'pn'},{efface:true}]);
 assert.ok(!p.appels.some(a=>/^(?:start|resume|stop|native-start|native-end|native-pause)$/.test(a.action)),'aucune autre action');
});
test('quand le panneau a le focus : les mêmes touches sont lues par le module, hors champ de saisie ; rien n\'est retenu',async()=>{
 const p=await panneau(natif({raison:etat(),codes:[null]}));assert.equal(p.touches.length,1,'un seul écouteur de clavier');
 let empeche=0;const frappe=(code,extra={})=>p.touches[0]({code,shiftKey:false,ctrlKey:false,altKey:false,metaKey:false,repeat:false,target:{tagName:'BODY'},preventDefault(){empeche++;},...extra});
 frappe('Digit2');frappe('Numpad5');frappe('Digit0');frappe('Digit7');frappe('KeyD');frappe('Digit3',{ctrlKey:true});frappe('Digit3',{repeat:true});frappe('Digit3',{target:{tagName:'INPUT'}});
 await p.attendre();assert.deepEqual(envois(p,'native-raison'),[{code:'adv'},{code:'hauteur'},{efface:true}]);assert.equal(empeche,0,'aucun preventDefault');
 /* collecte en pause ou lecture coupée : rien n'est envoyé */
 const q=await panneau(natif({raison:etat(),codes:[null],status:'PAUSED'}));q.touches[0]({code:'Digit2',target:{tagName:'BODY'}});
 const c=await panneau(natif({codes:[null]}));c.touches[0]({code:'Digit2',target:{tagName:'BODY'}});await q.attendre();
 assert.equal(q.appels.some(a=>a.action==='native-raison'),false);assert.equal(c.appels.some(a=>a.action==='native-raison'),false);
 /* le repli choisi change les touches lues */
 const alt=await panneau(natif({raison:etat({touches:'alt-chiffres'}),codes:[null]}));alt.touches[0]({code:'Digit2',target:{tagName:'BODY'}});alt.touches[0]({code:'Digit2',altKey:true,target:{tagName:'BODY'}});await alt.attendre();
 assert.deepEqual(envois(alt,'native-raison'),[{code:'adv'}]);
});

test('bandeau d\'ESV : la raison est dite en bout de ligne Écho, seulement quand la lecture est allumée et qu\'il y en a une',async()=>{
 const texte=async s=>{const p=await panneau(s,{bandeau:true});return p.appels.find(a=>a.action==='bandeau')?.args.text;};
 assert.equal(await texte(natif({codes:[null,null]})),'ARIANE · ÉCHO · collecte en cours · 2 visites','sans la fonction : comme avant');
 assert.equal(await texte(natif({raison:etat(),codes:[null,null]})),'ARIANE · ÉCHO · collecte en cours · 2 visites','allumée, sans raison : rien de plus');
 assert.equal(await texte(natif({raison:etat(),codes:[null,'nuage-pauvre']})),'ARIANE · ÉCHO · collecte en cours · 2 visites · raison : Nuage diffus ou pauvre');
 const e=etat();R.appuyer(e,{code:'adv',cutKey:'k',part:7,cut:100,at:1000,poseeA:iso(0),eventSeq:5},R.REGLAGE_DEFAUT);R.appuyer(e,{code:'adv',cutKey:'k',part:7,cut:100,at:1100,poseeA:iso(0),eventSeq:6},R.REGLAGE_DEFAUT);
 assert.equal(await texte(natif({raison:e,codes:['adv']})),'ARIANE · ÉCHO · collecte en cours · 1 visites · raison : ADV (collante)');
});

test('le panneau n\'écrit jamais l\'état tel quel en HTML : les codes inconnus ne passent pas, les libellés viennent du catalogue',async()=>{
 const sale=natif({raison:etat(),codes:['<img src=x onerror=alert(1)>','adv']});
 const {$}=await panneau(sale);const bande=$('raison-bande').innerHTML;
 assert.ok(!/<img|onerror|alert/.test(bande+$('raison-ligne').textContent+$('raison-couverture').textContent),bande);
 assert.match(bande,/<i class="" title="cut 100 · aucune raison"><\/i>/);
});
test('le panneau ne lit que le module : aucune table de touches, aucun code de raison écrits en double dans panel.js',()=>{
 assert.ok(!/rail-voisin|nuage-pauvre/.test(SOURCE.replace(/\/\*[\s\S]*?\*\//g,'')),'les codes viennent du catalogue du module');
});
