'use strict';
/* Consigne de la séance « 4.9.5 test 10, 11 et 12 » (le panneau habillé en trois présentations) : un tableau des trois zips, l'installation une version à la fois avec l'empreinte
 * contrôlée avant la pose, ce qu'il y a à essayer, ce qui ne change pas, le retour arrière vers la test 9, ce qui n'est pas vérifié ; aucune empreinte, aucune donnée de projet ESV,
 * aucune adresse, aucun nom de modèle d'IA ; une page. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
/* Consigne historique des 4.9.5.10 à 4.9.5.12 : l'outil de paquets ne fabrique plus que la 4.9.6 test 1 ; les trois versions de cette consigne restent celles-ci. */
const VERSIONS={'4.9.5.10':'linear','4.9.5.11':'raycast','4.9.5.12':'figma'};
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-4.9.5-test-10-ui-2026-10-19.md'),'utf8');
const plat=t=>t.replace(/\s+/g,' ');
test('les trois zips et leurs présentations sont ceux de l’outil de paquets',()=>{
 for(const [v,def] of Object.entries(VERSIONS)){const n=v.split('.')[3];assert.ok(texte.includes(`ariane-4.9.5-test.${n}-${def}.zip`),def);assert.ok(texte.includes(`**4.9.5 test ${n}**`),n);}
});
test('installation : empreinte avant la pose, par-dessus la test 9, une seule Ariane active, version vérifiée',()=>{
 const p=plat(texte);assert.ok(p.indexOf('Contrôle l\'empreinte')<p.indexOf('Décompresse le zip'));
 for(const m of ['Get-FileHash','-Algorithm SHA256','Ne désinstalle rien','Une seule Ariane active à la fois','Recharger','F5','Ariane 4.9.5 test N · ouvrir'])assert.ok(p.includes(m),m);
});
test('ce qui ne change pas, le retour arrière et ce qui n’est pas vérifié sont dits',()=>{
 const p=plat(texte);
 for(const m of ['La pose ne change pas','clique le bouton d\'origine','mêmes exports','Ancien panneau','désactive','test 9','Ce qui n\'est pas vérifié'.replace('Ce qui','## 5. Ce qui'),'Chrome réel','Pas dans ces versions'])assert.ok(p.includes(m),m);
});
test('règles du dépôt : aucune adresse, aucun nom de modèle d’IA, aucune donnée de projet, une page',()=>{
 assert.ok(!/https?:\/\/|www\./.test(texte));const mots=[['op','us'],['son','net'],['hai','ku'],['fa','ble']].map(f=>f.join(''));assert.ok(!new RegExp('\\b(?:'+mots.join('|')+')\\b','i').test(texte));
 assert.ok(texte.split('\n').length<=60,'une page');
});
