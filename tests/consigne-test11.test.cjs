'use strict';
/* Consigne de la séance « test 11 » (D-095 : B1 en ombre ; KI-070 : sauvegarde de secours) : installer par-dessus, version et lignes de
 * réglage (dont la nouvelle ligne B1), ce que l'opérateur n'a pas à faire de plus, retour vers la 4.9.0.10 avec sa seule empreinte,
 * aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-test-11-2026-10-13.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const S=require('../src/settings.js');
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version et réglages vérifiés (dont la ligne B1)',()=>{
 const s=section('1. Installer et vérifier').replace(/\s+/g,' ');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la test 11'));
 for(const m of ['Get-FileHash','ariane-4.9.0-test.11.zip','Ne désinstalle rien','Recharger','4.9.0 test 11'])assert.ok(s.includes(m),m);
 for(const nom of ['Mode rapide (V3)','Allègement des nuages','Voisins de la liste d’ESV (B1)']){const l=S.describe().find(x=>x.nom===nom);assert.ok(l,nom);
  assert.ok(s.includes(`« ${l.nom} » dit toujours « ${l.valeur} »`)||s.includes(`« ${l.nom} », qui doit dire « ${l.valeur} »`),nom);}
});
test('ce qui change : B1 en ombre (calculé à côté, noté, jamais appliqué, aucune requête) et sauvegarde corrigée, rien d’autre',()=>{
 const debut=texte.slice(0,texte.indexOf('## Le paquet')).replace(/\s+/g,' ');
 for(const m of ['Rien ne change dans ce qu\'Ariane décide','`b1-ombre`','Elle ne l\'applique pas','aucune requête de plus','sauvegarde de secours'])assert.ok(debut.includes(m),m);
 assert.equal(S.appuisListe,'ombre');
});
test('retour arrière vers la 4.9.0.10 ; aucune autre empreinte ; aucun identifiant de projet ESV',()=>{
 const r=section('4. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));assert.match(r,/4\.9\.0\.10/);assert.match(r,/ariane-4\.9\.0-test\.10\.zip/);
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
 assert.deepEqual(hex,['09c32aaf551b4a8b3102e85693150546985196469841707fd61595f494503949']);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
