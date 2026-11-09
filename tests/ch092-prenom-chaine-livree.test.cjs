'use strict';
/* CH-092 (relecture en adversaire de CH-087 et de « Vision 9 ») — DÉFAUT 3 : le prénom de l'opérateur reste dans une CHAÎNE du code livré
 * (background.js, raison d'une décision sur le lot des règles métier), pas dans un commentaire. CH-087 et Vision 9 ne retiraient que des
 * commentaires. Cette chaîne part dans le journal du lot (raison du différé) dès que les règles métier sont activées (coupées aujourd'hui).
 * Le prénom n'est pas écrit ici : le motif est construit par codes. Essai rouge marqué `todo` ; background.js n'est pas modifié ici. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const RACINE=path.join(__dirname,'..'),PRENOM=new RegExp('\\b'+String.fromCharCode(77,105,99)+'\\b');
const livres=['background.js','panel.js','panel.html',...fs.readdirSync(path.join(RACINE,'src')).filter(f=>f.endsWith('.js')).map(f=>'src/'+f)];

test('défaut 3 : aucun fichier livré de l’extension ne porte le prénom de l’opérateur (commentaire ou chaîne)',
 {todo:'CH-092 défaut 3 : une chaîne de background.js (raison « règle métier de … ») porte encore le prénom'},()=>{
 const trouves=[];for(const f of livres){const lignes=fs.readFileSync(path.join(RACINE,f),'utf8').split('\n');
  lignes.forEach((l,i)=>{if(PRENOM.test(l))trouves.push(f+':'+(i+1));});}
 assert.deepEqual(trouves,[]);
});
