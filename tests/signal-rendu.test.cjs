'use strict';
/* UI 5.0 « Signal » (D-250) — LE DESSIN (src/signal-rendu.js, partie pure) à partir d'instantanés fabriqués comme src/ui5.js les fait :
 *  - chaque état du lot et d'Écho a son glyphe, son mot, sa phrase, son objet et une seule action principale, celle que le panneau a désignée ;
 *  - l'allure vient de `batch.processed[].durationMs` (médiane des 20 derniers, au moins 3), rien n'est inventé quand elle manque ;
 *  - Revue V2 : « Ouvrir » n'est actif que si le bouton caché `#goto-cut` du panneau existe et l'est ; « Examiner » se lit dans l'instantané ;
 *  - chaque `legacy:<id>` désigne un élément de panel.html ; aucun « ancien panneau » ;
 *  - tout texte venu du panneau est échappé.
 * Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../src/signal-rendu.js');
const html=fs.readFileSync(path.join(__dirname,'..','panel.html'),'utf8'),IDS=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
/* T20a : les éléments du panneau que Signal lit pour la connexion et « Ouvrir dans ESV » existent dans panel.html. */
const A_VENIR=new Set();
test('T20a : #reconnect, #goto-cut, #goto-cut-cible et #goto-cut-etat sont dans panel.html',()=>{for(const id of ['reconnect','goto-cut','goto-cut-cible','goto-cut-etat'])assert.ok(IDS.has(id),id);});
const b=(id,texte,role='link',actif=true)=>({id,texte,role,actif});
const ar=(etat,x={})=>({etat,etatTexte:'',horsLigne:false,partie:13,cutEsv:4812,cibles:120,poses:27,differes:4,traites:31,restants:89,cours:4812,dernier:4811,
 bornes:{debut:4790,fin:null},differesListe:[{cut:4809,motif:'Rail non résolu',precision:'rail droit',heure:'15 h 33'},{cut:4803,motif:'Différé',precision:'',heure:'15 h 10'}],
 verts:[],vertsNombre:0,vertsLigne:'',aExaminer:4,lotOuvert:['cours','dem','pause','alerte','p2','rel'].includes(etat),passe2:null,cache:{actif:false},connexionBloquee:false,
 echoEtat:'Aucune séance en cours',alerte:'',esv:'ok',pause:{actif:true},reprendre:null,...x});
const sig=(x={})=>({activite:'orbite',statuts:['pose','pose','differe','voie','pose'],allure:{mediane:8.4,parMinute:60/8.4,debutCut:1000,debutPause:null,depuisS:4.2,pauseS:null},
 echo:{mediane:null,marques:[]},connexion:{statut:'ready',tabId:'12',nomme:true,reconnect:null},onglet:'ESV · partie 13',historique:null,goto:{present:false,actif:false,raison:'',etat:'',texte:''},
 examines:[],theme:'sombre',f5:null,taille:'normal',...x});
const snap=(x={})=>({variante:'signal',mode:'automatic',notice:{texte:'',erreur:false},boutonsOrbite:[b('pause','Pause','primary'),b('stop','Arrêter le lot','danger')],boutonsEcho:[],
 onglets:[{valeur:'12',texte:'ESV · partie 13'}],ongletChoisi:'12',reglages:{relecture:'corriger',clic:'tel-quel',grappe:false,passe2:true,raison:false,bandeau:false},
 echo:{visites:'0',corriges:0},echoRows:[],ar:ar('cours'),sig:sig(),...x});
const ui=(x={})=>({tiroir:false,couche:null,sel:null,q:'',pi:0,note:'',...x});
const legacy=h=>[...h.matchAll(/data-act="legacy:([a-z0-9-]+)"/g)].map(m=>m[1]);

test('lot en cours : anneau proportionnel, allure honnête, Pause principale, Arrêter en second',()=>{
 const h=S.rendre(snap(),ui());
 assert.match(h,/class="sg-mot">En cours</);assert.match(h,/Pose du cut <span class="sg-mono">4812</);
 assert.match(h,/class="sg-arc"[^>]*data-debut="1000" data-med="8400"/,'l’anneau sait se remettre à jour entre deux rendus');
 assert.match(h,/<b>7,1<\/b> cuts par minute/);assert.match(h,/médiane <b>8,4 s<\/b> par cut/);assert.match(h,/environ <b>12 min<\/b> restantes/,'89 restants × 8,4 s');
 assert.match(h,/class="sg-principal" data-act="pause"/);assert.match(h,/class="sg-secondaire sg-danger" data-act="legacy:stop"/);
 assert.match(h,/class="sg-rail-dif"/);assert.match(h,/class="sg-rail-cur"/);assert.match(h,/>120<\/div>/);
 const sans=S.rendre(snap({sig:sig({allure:{mediane:null,parMinute:null,debutCut:null,depuisS:null,pauseS:null}})}),ui());
 assert.doesNotMatch(sans,/cuts par minute|restantes/,'sans médiane, pas d’allure');
});

test('allure : médiane des 20 derniers cuts posés (au moins 3 durées), depuis le début du cut et depuis la pause',()=>{
 const p=d=>({durationMs:d});
 assert.equal(S.allureLot({processed:[p(5000),p(7000)]},0).mediane,null,'deux durées : rien');
 const a=S.allureLot({processed:[p(99000),...Array.from({length:20},(_,i)=>p(4000+i*200)),p(null),p(0)],cutStartedAt:'2026-10-25T10:00:00.000Z',pausedAt:'2026-10-25T10:00:30.000Z'},Date.parse('2026-10-25T10:01:00.000Z'));
 assert.equal(Math.round(a.mediane*100)/100,5.9,'la durée de 99 s est hors des 20 derniers ; null et 0 ignorés');
 assert.equal(a.depuisS,60);assert.equal(a.pauseS,30);assert.equal(Math.round(a.parMinute*10)/10,10.2);
 assert.equal(S.allureLot(null,0),null);assert.equal(S.allureLot({processed:[]},0).depuisS,null,'sans heure de début : rien');
});

test('chaque état a son glyphe et son mot ; une seule action principale, celle du panneau',()=>{
 const cas=[['pret',{},/Prêt/,'pret'],['dem',{},/Pause demandée/,'dem'],['pause',{},/En pause/,'pause'],['alerte',{etatTexte:'À toi',alerte:'Le cut 4812 a un rail qu’Ariane ne sait pas poser.'},/À toi/,'toi'],
  ['alerte',{etatTexte:'Résultat incertain',alerte:'L’opération sur le cut 4812 n’a pas été confirmée.'},/Interrompu/,'interrompu'],['p2',{passe2:{cut:4787,ecrites:1,demandees:3}},/Deuxième passe/,'verrou'],
  ['fini',{lotOuvert:false},/Terminé/,'fini'],['arrete',{lotOuvert:false},/Arrêté/,'arrete']];
 for(const [etat,x,mot,glyphe] of cas){
  const h=S.rendre(snap({ar:ar(etat,x),boutonsOrbite:[b('resume','Reprendre au cut 4812','primary'),b('stop','Arrêter le lot','danger')]}),ui());
  assert.match(h,new RegExp('class="sg-mot">'+mot.source),etat);assert.equal(S.modele(snap({ar:ar(etat,x)}),ui()).glyphe,glyphe,etat);
  assert.ok((h.match(/class="sg-principal/g)||[]).length<=1,etat+' : une seule action principale');
 }
 const d=S.rendre(snap({ar:ar('dem')}),ui());assert.match(d,/class="sg-principal" disabled><span class="sg-tourne"/);assert.doesNotMatch(d,/data-act="pause"/);
 const t=S.rendre(snap({ar:ar('alerte',{etatTexte:'À toi',alerte:'Le cut 4812 a un rail qu’Ariane ne sait pas poser.'}),boutonsOrbite:[b('retry','Réessayer la pose','primary'),b('manual-takeover','Reprendre à la main'),b('explicit-skip','Passer ce cut','danger')]}),ui());
 assert.match(t,/class="sg-incident" role="alert"><p>Le cut 4812 a un rail/);assert.match(t,/data-act="legacy:retry"/);assert.match(t,/sg-danger" data-act="legacy:explicit-skip"/);
 const p2=S.rendre(snap({ar:ar('p2',{passe2:{cut:4787,ecrites:1,demandees:3}})}),ui());
 assert.match(p2,/sg-verrou-ligne/);assert.doesNotMatch(p2,/class="sg-principal/);assert.match(p2,/cut <span class="sg-mono">4787<\/span> · 1 posé sur 3/);
});

test('fin de lot : trois lignes, « Voir ce qui reste » ouvre le tiroir, l’export vient en second ; rien à examiner : le bouton du panneau',()=>{
 const f=S.rendre(snap({ar:ar('fini',{lotOuvert:false,vertsNombre:9,aExaminer:13}),boutonsOrbite:[b('export-tout','Tout télécharger pour l’analyse','primary'),b('new-batch','Nouveau lot')],exportTexte:''}),ui());
 assert.match(f,/<dt>Lot<\/dt><dd><b>31<\/b> cuts traités sur <b>120<\/b> ciblés/);assert.match(f,/<b class="sg-dif">2<\/b> différés, <b>9<\/b> verts à contrôler/,"les différés de la liste du tiroir");
 assert.match(f,/class="sg-principal" data-act="sg:tiroir"/);assert.ok(f.indexOf('sg:tiroir')<f.indexOf('legacy:export-tout'),'Voir ce qui reste avant l’export');
 const r=S.rendre(snap({ar:ar('fini',{lotOuvert:false,differes:0,differesListe:[],aExaminer:0}),boutonsOrbite:[b('export-tout','Tout télécharger pour l’analyse','primary')]}),ui());
 assert.match(r,/class="sg-principal" data-act="legacy:export-tout"/);assert.match(r,/rien à examiner/);
});

test('Revue V2 : différés puis verts (par plage), « Ouvrir » seulement par le bouton caché du panneau, « Examiner » barré et décompté',()=>{
 const a=ar('fini',{lotOuvert:false,verts:[{libelle:'Abords de PN',detail:'4861–4875 · 4 cuts'}],vertsNombre:4,aExaminer:6});
 const sans=S.rendre(snap({ar:a}),ui({tiroir:true}));
 assert.match(sans,/<div id="sg-tiroir-corps">/,'ouvert : pas inert');assert.match(sans,/<span>Différés<\/span><span class="sg-n">2<\/span>/);
 assert.match(sans,/<button type="button" disabled title="Disponible avec la prochaine mise à jour du moteur">/,'sans #goto-cut : Ouvrir grisé, avec sa raison');
 assert.doesNotMatch(sans,/sg:ouvrir/);assert.match(sans,/<span class="sg-cut">4861<\/span><span class="sg-motif">Abords de PN <small>· 4861–4875 · 4 cuts<\/small>/);
 const avec=S.rendre(snap({ar:a,sig:sig({goto:{present:true,actif:true,raison:'',etat:'',texte:''},examines:['d:4809']})}),ui({tiroir:true}));
 assert.match(avec,/data-act="sg:ouvrir:4809"/);assert.match(avec,/data-act="sg:ouvrir:4861"/,'une plage s’ouvre à son premier cut');
 assert.match(avec,/class="sg-ligne sg-examine"[^>]*><span class="sg-cut">4809/);assert.match(avec,/data-act="sg:examiner:d:4809" aria-pressed="true"/);
 assert.match(avec,/reste à examiner <span class="sg-n">1<\/span>/);assert.match(avec,/reste à examiner 2 sur 3/,'la poignée compte les lignes non examinées');
 const bloque=S.rendre(snap({ar:a,sig:sig({goto:{present:true,actif:false,raison:'Pendant un lot, Ariane ne change pas de cut.',etat:'refuse',texte:'cible invalide'}})}),ui({tiroir:true}));
 assert.match(bloque,/disabled title="Pendant un lot, Ariane ne change pas de cut\.">/);assert.match(bloque,/sg-refus" role="status">cible invalide/);
 const ferme=S.rendre(snap({ar:a}),ui());assert.match(ferme,/<div id="sg-tiroir-corps" inert>/);
});

test('Écho : marques, allure de la séance ; la bascule est verrouillée pendant un lot ou une séance, avec sa raison',()=>{
 const e=S.rendre(snap({ar:ar('pret',{lotOuvert:false,echoEtat:'Collecte en cours',cours:null}),sig:sig({activite:'echo',echo:{mediane:10.2,marques:[true,false,true]}}),echo:{visites:'148',corriges:65},
  boutonsEcho:[b('native-end','Terminer et télécharger','primary'),b('native-pause','Pause')],echoRows:[{cut:'5317',texte:'Corrigé · 1 rail',corrige:true,duree:'9 s'}]}),ui({tiroir:true}));
 assert.match(e,/class="sg-mot">En observation</);assert.match(e,/<i class="sg-c"><\/i><i class=""><\/i><i class="sg-c"><\/i><i class="sg-en"><\/i>/);
 assert.match(e,/<b>5,9<\/b> cuts par minute/);assert.match(e,/<b>65<\/b> corrigés · <b>83<\/b> validés tels quels/);
 assert.match(e,/data-act="legacy:native-end"/);assert.match(e,/aria-disabled="true" data-raison="Orbite est disponible après la séance Écho"/);
 assert.match(e,/<span class="sg-cut">5317<\/span><span class="sg-motif">Corrigé · 1 rail/);
 const lot=S.rendre(snap(),ui());assert.match(lot,/aria-disabled="true" data-raison="Écho est disponible après le lot"/);
 const vide=S.rendre(snap({ar:ar('pret',{lotOuvert:false}),sig:sig({activite:'echo'}),boutonsEcho:[b('native-start','Démarrer l’observation','primary')]}),ui());
 assert.match(vide,/class="sg-mot">Aucune séance</);assert.match(vide,/aucune visite/);assert.match(vide,/data-act="mode:automatic"/);
});

test('connexion : hors ligne → « Choisir un onglet » ; ESV perdu → incident et puce brique ; « Reconnecter » seulement si le panneau a le bouton',()=>{
 const h=S.rendre(snap({ar:ar('pret',{horsLigne:true,lotOuvert:false}),sig:sig({onglet:'',connexion:{statut:'no-tab',reconnect:null}}),onglets:[],ongletChoisi:''}),ui());
 assert.match(h,/class="sg-mot">Hors ligne</);assert.match(h,/data-act="sg:esv"><span>Choisir un onglet/);assert.match(h,/class="sg-puce" data-etat="aucun"/);
 const ko=S.rendre(snap({ar:ar('pret',{lotOuvert:false}),sig:sig({connexion:{statut:'unavailable',reconnect:{visible:true,actif:true}}})}),ui({couche:'esv'}));
 assert.match(ko,/data-etat="ko"/);assert.match(ko,/ESV n’est pas connecté/);assert.match(ko,/data-act="legacy:reconnect"/);
 const sans=S.rendre(snap({ar:ar('pret',{lotOuvert:false})}),ui({couche:'esv'}));assert.doesNotMatch(sans,/legacy:reconnect/);assert.match(sans,/class="sg-conn"><i><\/i>connecté/);
 const enLot=S.rendre(snap(),ui({couche:'esv'}));assert.match(enLot,/gardée jusqu’à la fin du lot/);
});

test('palette : quatre commandes à l’ouverture, le reste en tapant ; une commande grisée n’a pas d’action',()=>{
 const L=S.paletteListe(snap(),ui({q:''}));assert.equal(L.length,4);assert.equal(L[0].act,'pause');
 const exp=S.paletteListe(snap(),ui({q:'export'}));assert.equal(exp[0].act,'legacy:export-tout');assert.equal(exp[0].off,'après le lot');
 const h=S.rendre(snap(),ui({couche:'palette',q:'export'}));assert.match(h,/class="sg-cmd" role="option" aria-selected="true" aria-disabled="true" data-fermer="1">/);
 assert.match(S.rendre(snap(),ui({couche:'palette',q:'tech'})),/data-act="sg:tech"/);assert.deepEqual(S.paletteListe(snap(),ui({q:'ancien panneau'})),[]);
 assert.match(S.rendre(snap(),ui({couche:'palette'})),/<input id="ui5-q"/);
});

test('réglages : les choix du panneau, thème sombre par défaut, détails techniques dans Signal, historique des parties ; aucun « ancien panneau »',()=>{
 const h=S.rendre(snap({gcv2:{total:2731,date:'20/10/2026'},sig:sig({historique:[{part:13,fin:'complete',cibles:120,poses:109,differes:11,depart:{ignores:2},startedAt:'2026-10-25T13:05:00Z'},{part:12,fin:'en-cours',cibles:null,poses:null,differes:null,depart:{ignores:0}}]})}),ui({couche:'reglages'}));
 assert.match(h,/<select data-sel="relecture"[^>]*>.*<option value="corriger" selected>/);assert.match(h,/aria-pressed="true" data-act="sg:choix:theme:sombre"/);
 assert.match(h,/data-act="sg:tech"/);assert.match(h,/<span class="sg-mono">2731<\/span>/);
 assert.match(h,/<span class="sg-mono">13<\/span><span>terminée · 120 ciblés · 109 posés · 11 différés · 2 ignorés<\/span>/);assert.match(h,/<span class="sg-mono">12<\/span><span>en cours<\/span>/);
 assert.match(h,/<option value="signal" selected>/);assert.doesNotMatch(h,/ancienne|Ancien panneau|ancien panneau/);
 assert.doesNotMatch(S.rendre(snap(),ui({couche:'reglages'})),/Parties traitées/,'sans historique du moteur : rien');
 const f5=S.rendre(snap({sig:sig({f5:'arret'})}),ui({couche:'reglages'}));assert.match(f5,/<select data-sel="f5"[^>]*>.*<option value="arret" selected>/);
});

test('chaque action désigne un élément de panel.html (ou annoncé par le moteur) ; aucune autre sorte d’action',()=>{
 const ETATS=['pret','cours','dem','pause','alerte','p2','rel','fini','arrete'],COUCHES=[null,'palette','reglages','esv'];
 const tous=[b('start-batch','Démarrer','primary'),b('resume','Reprendre','primary'),b('retry','Réessayer'),b('stop','Arrêter','danger'),b('export-tout','Exporter'),b('relecture-arreter','Arrêter la relecture','danger')];
 const rel={pause:{texte:'Pause',actif:true},reprendre:{texte:'Reprendre',actif:true,raison:''},arreter:true,ligne:''};
 for(const e of ETATS)for(const c of COUCHES)for(const act of ['orbite','echo']){
  const h=S.rendre(snap({ar:ar(e,{verts:[{libelle:'PN',detail:'4861–4875 · 4 cuts'}]}),relPause:e==='rel'?rel:null,boutonsOrbite:tous,boutonsEcho:[b('native-start','Démarrer','primary'),b('native-discard','Abandonner','danger')],
   sig:sig({activite:act,goto:{present:true,actif:true},connexion:{statut:'ready',reconnect:{visible:true,actif:true}}})}),ui({couche:c,tiroir:true}));
  for(const id of legacy(h))assert.ok(IDS.has(id)||A_VENIR.has(id),`${e}/${c}/${act} : ${id}`);
  for(const m of h.matchAll(/data-act="([a-z0-9]+)(?::[^"]*)?"/g))assert.ok(['legacy','sg','pause','mode','conn'].includes(m[1]),`${e}/${c} : ${m[1]}`);
 }
});

test('tout texte venu du panneau est échappé',()=>{
 const x='<img src=x onerror=alert(1)>';
 const h=S.rendre(snap({ar:ar('alerte',{etatTexte:x,alerte:x,differesListe:[{cut:1,motif:x,precision:x,heure:x}]}),boutonsOrbite:[b('retry',x,'primary')],onglets:[{valeur:'1',texte:x}],ongletChoisi:'1',
  sig:sig({onglet:x,goto:{present:true,actif:false,raison:x,etat:'refuse',texte:x}})}),ui({tiroir:true,couche:'esv',note:x}));
 assert.doesNotMatch(h,/<img/);assert.match(h,/&lt;img src=x onerror=alert\(1\)&gt;/);
});
