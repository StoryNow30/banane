'use strict';
/* CH-135 (D-368) : l'interface alternative « Cadran » (prototype Figma « Direction A — Cadran »), partie pure (src/cadran-rendu.js).
 * Ce qui est prouvé ici, sans navigateur :
 *  - Cadran dessine les MÊMES commandes que l'instrument (Signal) : mêmes `data-act`, dans le même ordre, mêmes boutons grisés, sur chaque état
 *    d'Orbite et d'Écho et dans chaque couche (menu, Réglages, palette, onglets ESV, Ce qui reste) : seule la présentation change ;
 *  - la tuile d'état porte la voie en élévation (rails, une traverse par cut, plan de coupe au cut en cours, fanion par cut à poser, heurtoir à
 *    l'arrêt, bornes au repos et à la fin), tirée de l'instantané sans rien recalculer ; jamais un total inventé ;
 *  - les Réglages offrent « Interface : Instrument / Cadran » ;
 *  - aucun message au service worker, aucune ressource venue d'un serveur, les fichiers sont chargés par panel.html.
 * Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=path.join(__dirname,'..'),lire=f=>fs.readFileSync(path.join(R,f),'utf8');
const S=require('../src/signal-rendu.js');
const C=require('../src/cadran-rendu.js');

const b=(id,texte,role='link',actif=true)=>({id,texte,role,actif});
const ar=(etat,x={})=>({etat,etatTexte:'',horsLigne:false,partie:13,cutEsv:4812,cibles:40,poses:18,differes:2,traites:21,restants:19,cours:4812,dernier:4811,
 bornes:{debut:4790,fin:4829},differesListe:[{cut:4809,motif:'Rail non résolu',precision:'rail droit',heure:'15 h 33'},{cut:4801,motif:'À poser',precision:'',heure:'15 h 10'}],
 verts:[],vertsNombre:0,vertsLigne:'',aExaminer:2,lotOuvert:['cours','dem','pause','alerte','p2','rel'].includes(etat),passe2:null,cache:{actif:false},connexionBloquee:false,
 echoEtat:'Aucune séance en cours',alerte:'',esv:'ok',pause:{actif:true},reprendre:null,...x});
const ST=['pose','pose','pose','pose','pose','pose','pose','pose','pose','pose','pose','differe','pose','pose','pose','pose','pose','pose','pose','differe','pose'];
const sig=(x={})=>({activite:'orbite',statuts:ST,allure:{mediane:6.6,parMinute:9,debutCut:1000,debutPause:null,depuisS:4.2,pauseS:null},
 echo:{mediane:null,marques:[]},connexion:{statut:'ready',tabId:'12',nomme:true,reconnect:null},onglet:'ESV · onglet 2',historique:null,goto:{present:true,actif:true,raison:'',etat:'',texte:''},
 examines:[],theme:'sombre',palette:'glacier',f5:null,taille:'normal',fil:[],...x});
const snap=(x={})=>({variante:'signal',mode:'automatic',notice:{texte:'',erreur:false},boutonsOrbite:[b('pause','Pause','primary'),b('stop','Arrêter le lot','danger')],boutonsEcho:[],
 onglets:[{valeur:'12',texte:'ESV · onglet 2'}],ongletChoisi:'12',reglages:{relecture:'corriger',clic:'tel-quel',grappe:false,passe2:true,raison:false,bandeau:false,ajustement:true},
 relectureModifiable:true,echo:{visites:'0',corriges:0},echoRows:[],ar:ar('cours'),sig:sig(),...x});
const ui=(x={})=>({tiroir:false,couche:null,sel:null,q:'',pi:0,note:'',...x});
const acts=h=>[...h.matchAll(/data-act="([^"]+)"/g)].map(m=>m[1]);
const grises=h=>[...h.matchAll(/<button\b[^>]*>/g)].map(m=>m[0]).filter(t=>/\sdisabled\b/.test(t)).map(t=>(t.match(/data-act="([^"]+)"/)||[])[1]||'?');
const champs=h=>[...h.matchAll(/data-(?:borne|sel)="([^"]+)"/g)].map(m=>m[1]);

/* Les scènes : chaque état d'Orbite (repos, en cours, pause demandée, pause, à toi, incident, rattrapage, relecture, relecture en pause, arrêté,
 * terminé, hors ligne) et d'Écho, avec leurs boutons d'origine. */
const SCENES={
 pret:snap({ar:ar('pret',{traites:0,poses:0,differes:0,restants:null,cours:null,dernier:null,differesListe:[],lotOuvert:false,bornesProchain:{debut:'1',fin:null,note:''}}),sig:sig({statuts:[]}),
  boutonsOrbite:[b('start-batch','Démarrer le lot','primary')]}),
 cours:snap(),
 dem:snap({ar:ar('dem')}),
 pause:snap({ar:ar('pause',{cours:null}),boutonsOrbite:[b('resume','Reprendre','primary'),b('new-batch','Nouveau lot'),b('stop','Arrêter le lot','danger')],sig:sig({allure:{mediane:6.6,parMinute:9,debutPause:500,pauseS:42}})}),
 toi:snap({ar:ar('alerte',{etatTexte:'À toi',alerte:'Le cut 4812 a un rail qu’Ariane ne sait pas poser.'}),boutonsOrbite:[b('retry','Réessayer','primary'),b('manual-takeover','Reprendre à la main'),b('explicit-skip','Passer ce cut','danger'),b('stop','Arrêter le lot','danger')]}),
 incertain:snap({ar:ar('alerte',{etatTexte:'Résultat incertain',alerte:'L’opération sur le cut 4812 n’a pas été confirmée.'}),boutonsOrbite:[b('close-uncertain','Archiver le résultat interrompu','primary'),b('stop','Arrêter le lot','danger')]}),
 p2:snap({ar:ar('p2',{passe2:{cut:4809,ecrites:1,demandees:2}}),boutonsOrbite:[]}),
 rel:snap({ar:ar('rel'),relPause:{ligne:'Relecture : 5 relus sur 18',pause:{texte:'Mettre en pause',actif:true},arreter:true},relChiffres:{faits:5,total:18,corriges:1,lot:true,etat:'en-cours'},boutonsOrbite:[b('relecture-arreter','Arrêter la relecture','danger')]}),
 relpause:snap({ar:ar('rel'),relPause:{ligne:'Relecture en pause',reprendre:{texte:'Reprendre la relecture',actif:true},arreter:true,bornes:{action:'reprendre',texte:'Reprendre du cut 4800 au cut 4829',actif:true,debut:4800,fin:4829}},
  boutonsOrbite:[b('relecture-acquitter','J’ai contrôlé le cut 4805','primary'),b('stop','Arrêter le lot','danger')],relecture:{ligne:'',actif:false,interrompue:'Correction interrompue au cut 4805.'}}),
 arrete:snap({ar:ar('arrete',{lotOuvert:false,cours:null}),boutonsOrbite:[b('resume','Continuer ce lot','primary'),b('new-batch','Préparer un autre lot'),b('export-tout','Exporter le dossier')]}),
 fini:snap({ar:ar('fini',{traites:40,poses:38,restants:0,cours:null,dernier:4829,lotOuvert:false}),sig:sig({statuts:[...ST,...Array(19).fill('pose')]}),exportTexte:'prêt',
  boutonsOrbite:[b('new-batch','Nouveau lot','primary'),b('export-tout','Exporter le dossier')]}),
 sansTotal:snap({ar:ar('cours',{cibles:null,restants:null})}),
 hors:snap({ar:ar('pret',{horsLigne:true,traites:0,poses:0,differes:0,differesListe:[],lotOuvert:false}),sig:sig({statuts:[],connexion:{statut:'no-tab',tabId:null,nomme:false,reconnect:null},onglet:''}),onglets:[],boutonsOrbite:[b('start-batch','Démarrer le lot','primary')]}),
 echo:snap({mode:'native',ar:ar('pret',{lotOuvert:false,echoEtat:'Collecte en cours'}),sig:sig({activite:'echo',echo:{mediane:12,marques:[false,true,false,false,true]}}),
  boutonsEcho:[b('native-pause','Pause','primary'),b('native-end','Terminer la séance','danger')],echo:{visites:'5',corriges:2,valides:3}}),
};

test('CH-135 : Cadran garde les commandes de l’instrument, dans le même ordre, avec les mêmes boutons grisés et les mêmes champs',()=>{
 for(const [nom,s] of Object.entries(SCENES)){
  for(const u of [ui(),ui({details:true}),ui({tiroir:true}),ui({couche:'menu'}),ui({couche:'reglages'}),ui({couche:'palette'}),ui({couche:'esv'})]){
   const hs=S.rendre(s,u),hc=C.rendre(s,u),k=`${nom} ${JSON.stringify(u.couche||u.details||u.tiroir||'')}`;
   assert.deepEqual(acts(hc),acts(hs),k+' : mêmes data-act dans le même ordre');
   assert.deepEqual(grises(hc),grises(hs),k+' : mêmes boutons grisés');
   assert.deepEqual(champs(hc),champs(hs),k+' : mêmes champs');
   assert.match(hc,/^<div class="sg-fen" data-activite="[^"]*" data-etat="[^"]*" data-teinte="[^"]*"/,k+' : même fenêtre (ui5.js en lit la clé)');
  }
 }
});

const voie=h=>(h.match(/<div class="cd-voie"[\s\S]*?<\/svg><\/div>/)||[''])[0];
const n=(h,re)=>(h.match(re)||[]).length;
test('CH-135 : la voie en élévation remplace l’anneau, tirée de l’instantané',()=>{
 for(const [nom,s] of Object.entries(SCENES)){
  const h=C.rendre(s,ui());
  assert.doesNotMatch(h,/class="sg-anneau/,nom+' : plus d’anneau');
  assert.match(h,/<i class="sg-glyphe cd-glyphe" data-g="[^"]+" data-ton="[^"]+" aria-hidden="true"><svg/,nom+' : le glyphe est la voie vue de côté');
 }
 const c=voie(C.rendre(SCENES.cours,ui()));
 assert.ok(c,'en cours : une voie');
 assert.equal(n(c,/class="cd-tr cd-pose"/g),19,'19 traverses posées (statuts « pose »)');
 assert.equal(n(c,/class="cd-fanion"/g),2,'un fanion par cut à poser');
 assert.equal(n(c,/class="cd-tr cd-vide"/g),19,'40 ciblés − 21 traités : 19 traverses à venir');
 assert.equal(n(c,/class="cd-coupe"/g),1,'le plan de coupe au cut en cours');
 assert.match(c,/role="img" aria-label="21 traités sur 40 ciblés, 2 à poser"/);
 const a=voie(C.rendre(SCENES.arrete,ui()));
 assert.equal(n(a,/class="cd-heurtoir"/g),1,'arrêté : un heurtoir');assert.equal(n(a,/class="cd-coupe"/g),0);
 const p=voie(C.rendre(SCENES.pause,ui()));
 assert.equal(n(p,/class="cd-coupe cd-pause"/g),1,'en pause : le plan de coupe doublé');
 const f=voie(C.rendre(SCENES.fini,ui()));
 assert.equal(n(f,/class="cd-borne"/g),2,'terminé : deux bornes');assert.equal(n(f,/class="cd-tr cd-vide"/g),0);
 const r=voie(C.rendre(SCENES.pret,ui()));
 assert.equal(n(r,/class="cd-borne"/g),2,'prêt : deux bornes');assert.equal(n(r,/class="cd-tr cd-pose"/g),0);
 /* Sans total connu : la voie ne prolonge rien au-delà des cuts traités (aucun total inventé) ; elle s'ouvre en pointillé. */
 const t=voie(C.rendre(SCENES.sansTotal,ui()));
 assert.equal(n(t,/class="cd-tr cd-vide"/g),0,'total inconnu : aucune traverse à venir inventée');assert.equal(n(t,/class="cd-ouvert"/g),1);
 assert.match(t,/total inconnu/);
 /* Un long lot : une traverse par groupe de cuts (au plus 60), un fanion par groupe qui contient un cut à poser. */
 const L=Array.from({length:600},(_,i)=>i%97===5?'differe':'pose');
 const g=voie(C.rendre(snap({ar:ar('cours',{cibles:900,traites:600,differes:7}),sig:sig({statuts:L})}),ui()));
 assert.ok(n(g,/class="cd-tr /g)<=60,'au plus 60 traverses');assert.equal(n(g,/class="cd-fanion"/g),7);
});

test('CH-135 : l’en-tête dit le cut n sur N quand le total est connu (le cut en cours : traités + 1, maquette ; terminé : N sur N)',()=>{
 assert.match(C.rendre(SCENES.cours,ui()),/<span class="cd-cut sg-mono">cut 22\/40<\/span>/);
 assert.match(C.rendre(SCENES.fini,ui()),/<span class="cd-cut sg-mono">cut 40\/40<\/span>/);
 assert.doesNotMatch(C.rendre(SCENES.sansTotal,ui()),/cd-cut/);
});

test('CH-135 : Réglages, « Interface : Instrument / Cadran » ; l’instrument reste celui d’avant',()=>{
 for(const v of ['signal','cadran']){
  const h=S.rendre(snap({variante:v}),ui({couche:'reglages'}));
  assert.match(h,/data-act="sg:choix:variante:signal">Instrument</);assert.match(h,/data-act="sg:choix:variante:cadran">Cadran</);
  assert.match(h,new RegExp(`aria-pressed="true" data-act="sg:choix:variante:${v}"`),v+' : le choix courant est marqué');
 }
 assert.doesNotMatch(S.rendre(SCENES.cours,ui()),/cd-voie|cd-glyphe/,'l’instrument ne change pas');
});

test('CH-135 : aucun message au service worker, rien d’un serveur, fichiers chargés par panel.html',()=>{
 const src=lire('src/cadran-rendu.js'),css=lire('panel-cadran.css'),html=lire('panel.html'),u5=lire('src/ui5.js');
 assert.doesNotMatch(src,/chrome\.|sendMessage|fetch\(|document\.|window\./,'cadran-rendu est pur');
 assert.doesNotMatch(css,/url\((?!fonts\/)/,'aucune ressource hors du paquet');assert.doesNotMatch(css,/https?:/);
 for(const f of css.matchAll(/url\((fonts\/[^)]+)\)/g))assert.ok(fs.existsSync(path.join(R,f[1])),f[1]);
 assert.match(css,/IBM Plex Mono/);assert.match(css,/IBM Plex Sans/);
 const sels=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@font-face\{[^}]*\}/g,'').replace(/@media[^{]*\{/g,'').replace(/@keyframes [a-z-]+\{/g,'').match(/[^{}]+(?=\{)/g)||[];
 const haut=s=>{const o=[];let d=0,c='';for(const x of s){if(x==='('||x==='[')d++;if(x===')'||x===']')d--;if(x===','&&!d){o.push(c);c='';}else c+=x;}o.push(c);return o;};
 for(const s of sels)for(const p of haut(s))assert.match(p.trim(),/^(#ui5\.u-cadran|body\.ui5:has\(#ui5\.u-cadran|\.sg-tech\[data-variante="cadran"\]|from|to|\d+%)/,'tout est sous #ui5.u-cadran : '+p.trim());
 const iC=html.indexOf('src/cadran-rendu.js'),iU=html.indexOf('src/ui5.js'),iS=html.indexOf('src/signal-rendu.js');
 assert.ok(iS>0&&iC>iS&&iU>iC,'signal-rendu, puis cadran-rendu, puis ui5');
 assert.ok(html.indexOf('panel-cadran.css')>html.indexOf('panel-signal.css'),'la feuille Cadran après celle de Signal');
 assert.match(u5,/VARIANTES = \['signal', 'cadran'\]/);
});
