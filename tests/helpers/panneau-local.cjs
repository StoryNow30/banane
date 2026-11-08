'use strict';
/* Panneau réel servi localement ; API Chrome simulée par chaque essai, aucun accès à ESV. */
const {demarrer}=require('../esv-maquette/serveur.cjs');
async function ouvrirPanneau(page,fragment=''){
 const serveur=await demarrer();
 page.once('close',()=>{void serveur.fermer();});
 await page.goto(serveur.url+'/panel.html'+fragment);
}
module.exports={ouvrirPanneau};
