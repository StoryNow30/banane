'use strict';
/* 5.0 (D-171, D-173) — carte « Relecture après le lot » du panneau (src/carte-relecture.js, bloc #carte-relecture de panel.html).
 * Bloc autonome : ses trois choix, l'avancement pendant la passe, le bouton d'arrêt, la ligne de CONTENU.txt (rien quand la
 * relecture du lot est coupée). Le panneau charge la carte avant panel.js et ajoute sa ligne au corps de CONTENU.txt. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const racine=path.join(__dirname,'..'),lire=f=>fs.readFileSync(path.join(racine,f),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(lire('src/carte-relecture.js'),ctx);
const C=ctx.ArianeCarteRelecture;

test('panel.html : bloc #carte-relecture autonome, trois choix, ligne d’avancement, arrêt ; script chargé avant panel.js',()=>{
 const h=lire('panel.html'),bloc=h.slice(h.indexOf('<fieldset id="carte-relecture"'),h.indexOf('</fieldset>',h.indexOf('<fieldset id="carte-relecture"')));
 assert.ok(bloc.length>100);
 for(const [id,txt] of [['relecture-coupee','Coupée'],['relecture-ombre','Ombre (visite, ne modifie rien)'],['relecture-corriger','Corriger (corrige seulement les cuts sûrs)']])
  assert.match(bloc,new RegExp(`id="${id}"[^>]*> ${txt.replace(/[()]/g,'\\$&')}`));
 for(const id of ['relecture-ligne','relecture-arreter','relecture-lancer','relecture-note'])assert.ok(bloc.includes(`id="${id}"`),id);
 assert.ok(h.indexOf('src/carte-relecture.js')<h.indexOf('src="panel.js"'));
 assert.match(lire('panel.js'),/ArianeCarteRelecture\?\.texteContenu\(state\?\.batch\)/);
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
