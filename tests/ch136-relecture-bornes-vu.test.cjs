'use strict';
/* CH-136 (relecture adverse de CH-133) : la phrase « hors des bornes » a été insérée devant le `else if` qui ajoute « ESV a marqué N cuts « vu » » au message
 * d'une relecture non finie ; avec des bornes, une relecture arrêtée perdait cette mention. Montage de tests/ch133-relecture-bornes.test.cjs. Synthétique. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotVide,attendreEtat,evenement}=require('./helpers/relecture-points-vides.cjs');
test('reprise bornée puis « Arrêter » : le message garde « vu » et dit les cuts hors des bornes',async()=>{
 const {b}=await lotVide({vides:[109,110,113],persiste:true});
 await evenement(b,'relecture-points-vides',e=>e.etape==='repris');
 await evenement(b,'relecture-pause',e=>e.raison==='points'&&H.evenements(b,'relecture-pause').length===2,20000);
 await attendreEtat(b,'en-pause');
 assert.ok(b.get('relecture').passe.vus>0,'des cuts marqués « vu » avant la pause');
 await b.api('relecture-reprendre',{debut:114,fin:116});await b.api('relecture-arreter');
 const f=await H.finPasse(b,60000);
 assert.equal(f.etat,'arretee',f.message);assert.equal(f.horsBornes,3);
 assert.match(f.message,/« vu »/,f.message);
 assert.match(f.message,/3 cuts non relus \(hors des bornes\)/,f.message);
});
