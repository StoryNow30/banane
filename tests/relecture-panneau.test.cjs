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
 for(const [id,txt] of [['relecture-coupee','Coupée'],['relecture-ombre','Ombre (visite, ne modifie rien)'],['relecture-corriger','Corriger (corrige seulement les cuts sûrs)']])
  assert.match(bloc,new RegExp(`id="${id}"[^>]*> ${txt.replace(/[()]/g,'\\$&')}`));
 for(const id of ['relecture-dernier-l','relecture-dernier','relecture-prochain','relecture-ligne','relecture-arreter','relecture-lancer','relecture-note'])assert.ok(bloc.includes(`id="${id}"`),id);
 assert.match(bloc,/<dl class="choix-etat"><dt id="relecture-dernier-l">Dernier lot<\/dt><dd id="relecture-dernier">aucun lot<\/dd><dt>Prochain lot<\/dt><dd id="relecture-prochain">—<\/dd><\/dl>/);
 assert.ok(h.indexOf('src/carte-relecture.js')<h.indexOf('src="panel.js"'));
 assert.match(lire('panel.js'),/ArianeCarteRelecture\?\.texteContenu\(state\?\.batch\)/);
});

/* Une page minimale : les éléments de la carte, rien d'autre. */
function page(){const el={};const ids=['carte-relecture','relecture-coupee','relecture-ombre','relecture-corriger','relecture-dernier-l','relecture-dernier','relecture-prochain','relecture-note','relecture-ligne','relecture-interrompue','relecture-arreter','relecture-lancer'];
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

test('avancement : « Relecture 12 sur 85, 3 corrigés », arrêt demandé, bilan de fin',()=>{
 assert.equal(C.ligne({etat:'en-cours',mode:'corriger',modeEffectif:'corriger',faits:12,total:85,corriges:3,cut:456,plage:'grappe 453–471'}),'Relecture 12 sur 85, 3 corrigés · cut 456 · grappe 453–471');
 assert.equal(C.ligne({etat:'en-cours',mode:'ombre',faits:1,total:7,corriges:0,cut:null,arretDemande:true}),'Relecture 1 sur 7 · arrêt demandé');
 assert.equal(C.ligne({etat:'en-cours',mode:'corriger',modeEffectif:'ombre',faits:2,total:7,corriges:0,cut:109}),'Relecture 2 sur 7 · cut 109','ramenée à l’ombre : pas de compte de corrections');
 assert.equal(C.ligne({etat:'finie',message:'Relecture finie : 7 cuts relus, rien de modifié.'}),'Relecture finie : 7 cuts relus, rien de modifié.');
 assert.equal(C.ligne(null),'');
});

test('CONTENU.txt : le choix figé dans le lot et le bilan de sa passe ; rien quand la relecture est coupée',()=>{
 assert.equal(C.texteContenu({id:'L1',scope:{part:8}}),'');assert.equal(C.texteContenu(null),'');
 assert.equal(C.texteContenu({id:'L1',scope:{relecture:'ombre'}},null),'Relecture après le lot L1 : ombre (visite, ne modifie rien) (ombre).\n');
 assert.equal(C.texteContenu({id:'L1',scope:{relecture:'corriger'}},{lotId:'L1',etat:'finie',faits:85,total:85,corriges:3,mode:'corriger',modeEffectif:'corriger'}),
  'Relecture après le lot L1 : corriger (corrige seulement les cuts sûrs) (corriger) ; passe : finie, 85 sur 85 relus, 3 corrigés (événements relecture-ombre dans le journal).\n');
 assert.equal(C.texteContenu({id:'L2',scope:{relecture:'ombre'}},{lotId:'L1',etat:'finie',faits:1,total:1}),'Relecture après le lot L2 : ombre (visite, ne modifie rien) (ombre).\n','passe d’un autre lot : pas de bilan');
});
