'use strict';
/* Consigne de la séance « test 13 » (tuile du lot en grand, départs des parties en cartes, couleurs) : installer par-dessus, version et lignes de
 * réglage inchangées, ce que l'opérateur regarde en plus, retour vers la 4.9.0.12 avec sa seule empreinte, aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-test-13-2026-10-14.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const S=require('../src/settings.js');
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version et réglages vérifiés (inchangés)',()=>{
 const s=section('1. Installer et vérifier').replace(/\s+/g,' ');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la test 13'));
 for(const m of ['Get-FileHash','ariane-4.9.0-test.13.zip','Ne désinstalle rien','Recharger','4.9.0 test 13'])assert.ok(s.includes(m),m);
 for(const nom of ['Mode rapide (V3)','Allègement des nuages','Voisins de la liste d’ESV (B1)']){const l=S.describe().find(x=>x.nom===nom);assert.ok(l,nom);
  assert.ok(s.includes(`« ${l.nom} » dit toujours « ${l.valeur} »`)||s.includes(`« ${l.nom} », qui doit dire « ${l.valeur} »`),nom);}
});
test('ce qui change : la tuile du lot, les départs en cartes, les couleurs ; rien dans ce qu\'Ariane décide',()=>{
 const debut=texte.slice(0,texte.indexOf('## Le paquet')).replace(/\s+/g,' ');
 for(const m of ['Rien ne change dans ce qu\'Ariane décide','La tuile du lot','jusqu\'à la fin de partie','sans pourcentage','une carte par partie','« Détails du lot »','B1 en ombre'])assert.ok(debut.includes(m),m);
 const html=fs.readFileSync(path.resolve(__dirname,'..','panel.html'),'utf8');
 assert.ok(html.includes('id="lot-traites"'),'la tuile porte les cuts traités');assert.match(html,/<div id="departs-liste" class="departs/,'les départs sont sur la vue');
});
test('retour arrière vers la 4.9.0.12 ; aucune autre empreinte ; aucun identifiant de projet ESV',()=>{
 const r=section('4. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));assert.match(r,/4\.9\.0\.12/);assert.match(r,/ariane-4\.9\.0-test\.12\.zip/);
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
 assert.deepEqual(hex,['949afdb108bf2911a0b2d8fab2935e92719488efbbda4f7549ff69d4e9c38e1e']);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
