'use strict';
/* Consigne de la séance « test 14 » (le vert de la tuile du lot) : installer par-dessus, version et lignes de réglage inchangées,
 * ce que l'opérateur regarde en plus, retour vers la 4.9.0.13 avec sa seule empreinte, aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-test-14-2026-10-14.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const S=require('../src/settings.js');
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version et réglages vérifiés (inchangés)',()=>{
 const s=section('1. Installer et vérifier').replace(/\s+/g,' ');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la test 14'));
 for(const m of ['Get-FileHash','ariane-4.9.0-test.14.zip','Ne désinstalle rien','Recharger','4.9.0 test 14'])assert.ok(s.includes(m),m);
 for(const nom of ['Mode rapide (V3)','Allègement des nuages','Voisins de la liste d’ESV (B1)']){const l=S.describe().find(x=>x.nom===nom);assert.ok(l,nom);
  assert.ok(s.includes(`« ${l.nom} » dit toujours « ${l.valeur} »`)||s.includes(`« ${l.nom} », qui doit dire « ${l.valeur} »`),nom);}
});
test('ce qui change : le vert de la tuile du lot, et rien d\'autre ; rien dans ce qu\'Ariane décide',()=>{
 const debut=texte.slice(0,texte.indexOf('## Le paquet')).replace(/\s+/g,' ');
 for(const m of ['Rien ne change dans ce qu\'Ariane décide','le vert de la tuile du lot','jusqu\'à la fin de partie','« cut N sur M »','M−1','fin de partie inconnue','Jamais de faux pourcentage','ne recule pas'])assert.ok(debut.includes(m),m);
 assert.ok(fs.readFileSync(path.resolve(__dirname,'..','panel.html'),'utf8').includes('id="lot-progres-note"'),'la note de fin inconnue existe dans le panneau');
});
test('retour arrière vers la 4.9.0.13 ; aucune autre empreinte ; aucun identifiant de projet ESV',()=>{
 const r=section('4. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));assert.match(r,/4\.9\.0\.13/);assert.match(r,/ariane-4\.9\.0-test\.13\.zip/);
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
 assert.deepEqual(hex,['a55f60bb6eb5e23424c45aa31ef4189b42b349c8e68895aee1549f5c0bfbf201']);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
