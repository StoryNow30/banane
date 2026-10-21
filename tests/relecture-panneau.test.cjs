'use strict';
/* 5.0 (D-171, D-173) — carte « Relecture après le lot » du panneau (src/carte-relecture.js, bloc #carte-relecture de panel.html).
 * Bloc autonome : ses trois choix, l'avancement pendant la passe, le bouton d'arrêt, la ligne de CONTENU.txt (rien quand la
 * relecture du lot est coupée). Le panneau charge la carte avant panel.js et ajoute sa ligne au corps de CONTENU.txt. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const racine=path.join(__dirname,'..'),lire=f=>fs.readFileSync(path.join(racine,f),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(lire('src/carte-relecture.js'),ctx);
const C=ctx.ArianeCarteRelecture;

test('panel.html : carte #carte-relecture dans l’emplacement (d) « Relecture », entre les résultats et l’export ; trois choix, Dernier lot / Prochain lot, avancement, arrêt ; script chargé avant panel.js',()=>{
 const h=lire('panel.html'),debut=h.indexOf('<section id="carte-relecture"'),bloc=h.slice(debut,h.indexOf('</section>',debut));
 assert.ok(debut>0&&bloc.length>100);assert.match(h.slice(debut,debut+60),/class="carte/);
 assert.ok(h.indexOf('id="groupe-resultats"')<debut&&debut<h.indexOf('id="groupe-avance"'),'entre (c) et (e)');
 assert.ok(h.indexOf('id="groupe-relecture"')<debut&&h.indexOf('id="groupe-relecture"')>h.indexOf('id="groupe-resultats"'));
 assert.equal((h.match(/id="carte-relecture"/g)||[]).length,1,'une seule carte');
 /* Revue (correction 9) : l'ombre dit qu'ESV marque « vu » les cuts neufs ; « corriger » dit son geste (Maj+Espace, correction 4). */
 for(const [id,txt] of [['relecture-coupee','Coupée'],['relecture-ombre','Ombre (Ariane visite et ne modifie rien ; ESV marque « vu » chaque cut neuf affiché)'],['relecture-corriger','Corriger (verts sûrs du PN, de l’ADV, des abords et des écartements hors norme, validés par Maj+Espace)']])
  assert.match(bloc,new RegExp(`id="${id}"[^>]*> ${txt.replace(/[()+]/g,'\\$&')}`));
 assert.doesNotMatch(bloc,/ne modifie rien\)/,'plus de « ne modifie rien » sans le « vu »');
 for(const id of ['relecture-dernier-l','relecture-dernier','relecture-prochain','relecture-ligne','relecture-arreter','relecture-lancer','relecture-note','relecture-reglages','relecture-acquitter'])assert.ok(bloc.includes(`id="${id}"`),id);
 assert.match(bloc,/part seule juste après un lot jusqu’à la fin de la partie/,'D-176 : départ automatique, sans compte à rebours');assert.doesNotMatch(bloc,/compte à rebours|au clic/);
 assert.match(bloc,/<dl class="choix-etat"><dt id="relecture-dernier-l">Dernier lot<\/dt><dd id="relecture-dernier">aucun lot<\/dd><dt>Prochain lot<\/dt><dd id="relecture-prochain">—<\/dd><\/dl>/);
 assert.ok(h.indexOf('src/carte-relecture.js')<h.indexOf('src="panel.js"'));
 assert.match(lire('panel.js'),/ArianeCarteRelecture\?\.texteContenu\(state\?\.batch\)/);
});

/* Une page minimale : les éléments de la carte, rien d'autre. */
function page(){const el={};const ids=['carte-relecture','relecture-coupee','relecture-ombre','relecture-corriger','relecture-dernier-l','relecture-dernier','relecture-prochain','relecture-note','relecture-ligne','relecture-interrompue','relecture-arreter','relecture-lancer','relecture-reglages','relecture-acquitter'];
 for(const id of ids)el[id]={id,textContent:'',hidden:false,checked:false,disabled:false};
 const c={setTimeout:()=>0,clearTimeout:()=>{},document:{readyState:'complete',activeElement:null,getElementById:id=>el[id]||null}};vm.createContext(c);vm.runInContext(lire('src/carte-relecture.js'),c);
 return {el,C:c.ArianeCarteRelecture};}

test('Dernier lot / Prochain lot, comme les autres choix : mode figé du dernier lot, choix gardé ; « Lot en cours » pendant un lot',()=>{
 const {el,C:K}=page();
 K.etat({choix:'ombre',lot:null,passe:null});K.afficher();
 assert.equal(el['relecture-dernier-l'].textContent,'Dernier lot');assert.equal(el['relecture-dernier'].textContent,'aucun lot');
 assert.equal(el['relecture-prochain'].textContent,'« Ombre »');assert.equal(el['relecture-ombre'].checked,true);assert.equal(el['relecture-coupee'].checked,false);
 K.etat({choix:'corriger',lot:{id:'L1',mode:'ombre',etat:'RUNNING'},passe:null});K.afficher();
 assert.equal(el['relecture-dernier-l'].textContent,'Lot en cours');assert.equal(el['relecture-dernier'].textContent,'« Ombre »');
 assert.equal(el['relecture-prochain'].textContent,'« Corriger »');assert.match(el['relecture-note'].textContent,/garde la sienne jusqu’à sa fin/);
 K.etat({choix:'coupee',lot:{id:'L1',mode:'corriger',etat:'STOPPED'},passe:{lotId:'L1',etat:'en-cours',mode:'corriger',modeEffectif:'corriger',faits:12,total:85,corriges:3,cut:456,plage:'grappe 453–471'}});K.afficher();
 assert.equal(el['relecture-dernier-l'].textContent,'Dernier lot');assert.equal(el['relecture-dernier'].textContent,'« Corriger »');assert.equal(el['relecture-prochain'].textContent,'« Coupée »');
 assert.equal(el['relecture-ligne'].textContent,'Relecture 12 sur 85, 3 corrigés · cut 456 · grappe 453–471');assert.equal(el['relecture-ligne'].hidden,false);
 assert.equal(el['relecture-arreter'].hidden,false,'bouton d’arrêt pendant la passe');assert.equal(el['relecture-lancer'].hidden,true);
 for(const id of ['relecture-coupee','relecture-ombre','relecture-corriger'])assert.equal(el[id].disabled,true,'choix figés pendant la passe');
 K.etat({choix:'ombre',lot:{id:'L2',mode:'coupee',etat:'COMPLETED'},passe:null});K.afficher();
 assert.equal(el['relecture-dernier'].textContent,'« Coupée »');assert.equal(el['relecture-arreter'].hidden,true);assert.equal(el['relecture-lancer'].hidden,true,'rien à lancer : lot sans relecture');
 K.arreter();
});

test('avancement : « Relecture 12 sur 85, 3 corrigés », « vu » sur les cuts neufs annoncés, arrêt demandé, bilan de fin',()=>{
 assert.equal(C.ligne({etat:'en-cours',mode:'ombre',faits:12,total:85,corriges:0,vus:9,cutsNeufsAnnonces:60,cut:456}),'Relecture 12 sur 85 · « vu » : 9 sur 60 cuts neufs · cut 456');
 assert.equal(C.ligne({etat:'en-cours',mode:'ombre',faits:2,total:85,corriges:0,vus:2,cutsNeufsAnnonces:null,cut:3}),'Relecture 2 sur 85 · 2 « vu » · cut 3');
 assert.equal(C.ligne({etat:'preparation',mode:'ombre',faits:0,total:0,message:'Relecture en préparation : elle part dans un instant.'}),'Relecture en préparation : elle part dans un instant.');
 assert.equal(C.ligne({etat:'en-cours',mode:'corriger',modeEffectif:'corriger',faits:12,total:85,corriges:3,cut:456,plage:'grappe 453–471'}),'Relecture 12 sur 85, 3 corrigés · cut 456 · grappe 453–471');
 assert.equal(C.ligne({etat:'en-cours',mode:'ombre',faits:1,total:7,corriges:0,cut:null,arretDemande:true}),'Relecture 1 sur 7 · arrêt demandé');
 assert.equal(C.ligne({etat:'en-cours',mode:'corriger',modeEffectif:'ombre',faits:2,total:7,corriges:0,cut:109}),'Relecture 2 sur 7 · cut 109','ramenée à l’ombre : pas de compte de corrections');
 assert.equal(C.ligne({etat:'finie',message:'Relecture finie : 7 cuts relus, rien de modifié.'}),'Relecture finie : 7 cuts relus, rien de modifié.');
 assert.equal(C.ligne(null),'');
});

/* Revue (corrections 2, 5, W5) : « Lancer » caché pendant la préparation ; source des réglages ; « J'ai contrôlé le cut N ». */
test('préparation : « Lancer » caché, « Arrêter » visible ; réglages : source et verrou dits ; correction interrompue : « J’ai contrôlé le cut N »',()=>{
 const {el,C:K}=page();
 K.etat({choix:'corriger',lot:{id:'L1',mode:'corriger',etat:'STOPPED'},passe:{lotId:'L1',etat:'preparation',mode:'corriger',faits:0,total:0,message:'Relecture en préparation : elle part dans un instant.'},
  reglages:{source:'propose',statut:'propose',correctionPermise:true,raison:null}});K.afficher();
 assert.equal(el['relecture-lancer'].hidden,true,'pas de second lancement pendant la préparation');assert.equal(el['relecture-arreter'].hidden,false);
 assert.equal(el['relecture-ligne'].textContent,'Relecture en préparation : elle part dans un instant.');
 assert.equal(el['relecture-reglages'].textContent,'Réglages de la correction : fichier proposé.');
 for(const id of ['relecture-coupee','relecture-ombre','relecture-corriger'])assert.equal(el[id].disabled,true);
 /* D-180 : la carte dit quelles zones corrigent (un interrupteur par zone). */
 K.etat({choix:'corriger',lot:{id:'L1',mode:'corriger',etat:'STOPPED'},passe:null,reglages:{source:'propose',statut:'propose',correctionPermise:true,raison:null,zones:{pn:true,adv:true,abords:true,'vert-hors-zone':false}}});K.afficher();
 assert.equal(el['relecture-reglages'].textContent,'Réglages de la correction : fichier proposé. Zones qui corrigent : PN, ADV, abords ; les autres restent en ombre.');
 K.etat({choix:'corriger',lot:{id:'L1',mode:'corriger',etat:'STOPPED'},passe:null,reglages:{source:'propose',statut:'propose',correctionPermise:true,raison:null,zones:{pn:true,adv:false,abords:false,'vert-hors-zone':false}}});K.afficher();
 assert.match(el['relecture-reglages'].textContent,/Zones qui corrigent : PN ; les autres restent en ombre\./);
 K.etat({choix:'corriger',lot:{id:'L1',mode:'corriger',etat:'STOPPED'},passe:null,reglages:{source:'propose',statut:'propose',correctionPermise:true,raison:null,zones:{pn:false,adv:false,abords:false,'vert-hors-zone':false}}});K.afficher();
 assert.match(el['relecture-reglages'].textContent,/Aucune zone ne corrige : tout reste en ombre\./);
 K.etat({choix:'corriger',lot:{id:'L1',mode:'corriger',etat:'STOPPED'},passe:{lotId:'L1',etat:'preparation',mode:'corriger',faits:0,total:0,message:'Relecture en préparation : elle part dans un instant.'},reglages:{source:'propose',statut:'propose',correctionPermise:true,raison:null}});K.afficher();
 K.etat({choix:'corriger',lot:{id:'L1',mode:'corriger',etat:'STOPPED'},passe:null,reglages:{source:'defaut',statut:'provisoire',correctionPermise:false,raison:'fichier proposé absent ou illisible (défaut provisoire)'},
  correctionInterrompue:{lotId:'L1',part:23,cut:109}});K.afficher();
 assert.equal(el['relecture-reglages'].textContent,'Réglages de la correction : défaut provisoire. « Corriger » restera en ombre : fichier proposé absent ou illisible (défaut provisoire).');
 assert.match(el['relecture-interrompue'].textContent,/interrompue au cut 109 \(partie 23\)/);assert.equal(el['relecture-interrompue'].hidden,false);
 assert.equal(el['relecture-acquitter'].hidden,false);assert.equal(el['relecture-acquitter'].textContent,'J’ai contrôlé le cut 109');
 assert.equal(el['relecture-lancer'].hidden,true,'rien ne se relance tant que le cut n’est pas contrôlé');
 K.etat({choix:'corriger',lot:{id:'L1',mode:'corriger',etat:'STOPPED'},passe:null,reglages:null,correctionInterrompue:null});K.afficher();
 assert.equal(el['relecture-acquitter'].hidden,true);assert.equal(el['relecture-lancer'].hidden,false);assert.equal(el['relecture-reglages'].textContent,'');
 K.arreter();
});

test('relecture en pause (test 17) : « Lancer la relecture » n’est pas proposé (elle repartirait de zéro), la ligne de la passe est dite, les choix restent libres pour le lot suivant',()=>{
 const {el,C:K}=page();
 const lot={id:'L1',mode:'ombre',etat:'STOPPED'},pause={lotId:'L1',etat:'en-pause',mode:'ombre',faits:12,total:85,cut:110,message:'Relecture en pause au cut 110 : 12 cuts relus sur 85. Tu peux la reprendre, même après un F5.'};
 K.etat({choix:'ombre',lot,passe:null});K.afficher();assert.equal(el['relecture-lancer'].hidden,false,'sans passe, un lot clos se relance');
 K.etat({choix:'ombre',lot,passe:pause});K.afficher();
 assert.equal(el['relecture-lancer'].hidden,true);assert.equal(el['relecture-arreter'].hidden,true,'l’arrêt de la pause est celui de src/relecture-pause.js');
 assert.match(el['relecture-ligne'].textContent,/Relecture en pause au cut 110/);assert.equal(el['relecture-ombre'].disabled,false);
 K.arreter();
});

test('CONTENU.txt : le choix figé dans le lot et le bilan de sa passe ; rien quand la relecture est coupée',()=>{
 assert.equal(C.texteContenu({id:'L1',scope:{part:8}}),'');assert.equal(C.texteContenu(null),'');
 assert.equal(C.texteContenu({id:'L1',scope:{relecture:'ombre'}},null),'Relecture après le lot L1 : ombre (Ariane visite et ne modifie rien ; ESV marque « vu » chaque cut neuf affiché) (ombre).\n');
 assert.equal(C.texteContenu({id:'L1',scope:{relecture:'corriger'}},{lotId:'L1',etat:'finie',faits:85,total:85,corriges:3,vus:40,mode:'corriger',modeEffectif:'corriger'}),
  'Relecture après le lot L1 : corriger (verts sûrs du PN, de l’ADV, des abords et des écartements hors norme, validés par Maj+Espace) (corriger) ; passe : finie, 85 sur 85 relus, 3 corrigés, 40 cuts marqués « vu » par ESV (événements relecture-ombre dans le journal).\n');
 assert.equal(C.texteContenu({id:'L2',scope:{relecture:'ombre'}},{lotId:'L1',etat:'finie',faits:1,total:1}),'Relecture après le lot L2 : ombre (Ariane visite et ne modifie rien ; ESV marque « vu » chaque cut neuf affiché) (ombre).\n','passe d’un autre lot : pas de bilan');
});
