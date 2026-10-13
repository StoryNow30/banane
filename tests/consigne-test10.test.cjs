'use strict';
/* Consigne de la séance « test 10 » (D-092 : fiche de départ des parties, raccourcis écrits) : installer par-dessus, version et lignes de
 * réglage inchangées, ce que l'opérateur vérifie (ligne de fiche, validés + invalides = total, export, vidage), retour vers la 4.9.0.9
 * avec sa seule empreinte, aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-test-10-2026-10-13.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const S=require('../src/settings.js'),EC=require('../src/export-cache.js');
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version et réglages vérifiés',()=>{
 const s=section('1. Installer et vérifier').replace(/\s+/g,' ');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la test 10'));
 for(const m of ['Get-FileHash','ariane-4.9.0-test.10.zip','Ne désinstalle rien','Recharger','4.9.0 test 10'])assert.ok(s.includes(m),m);
 for(const nom of ['Mode rapide (V3)','Allègement des nuages']){const l=S.describe().find(x=>x.nom===nom);assert.ok(l,nom);assert.ok(s.includes(`« ${l.nom} » dit toujours « ${l.valeur} »`)||s.includes(`${l.nom} » dit toujours « ${l.valeur} »`),nom);}
});
test('ce qui change : fiche de départ (panneau, exports, vidage) et raccourcis écrits, rien d’autre',()=>{
 const debut=texte.slice(0,texte.indexOf('## Le paquet'));
 for(const m of ['Départs des parties','validés','invalides','CONTENU.txt','fichesDepart','reste même si tu vides le cache','`D` = passer au cut de droite','`Maj + Espace` = valider un cut','une seule fois','Rien ne change dans ce qu\'Ariane décide'])assert.ok(debut.includes(m),m);
 assert.ok(fs.readFileSync(path.resolve(__dirname,'..','panel.html'),'utf8').includes('Départs des parties'),'le bloc existe dans le panneau');
 assert.ok(EC.CLE_DEPARTS==='banane3FichesDepart');
});
test('vérifications de terrain : ligne dans les cinq secondes, chiffres comparés à ESV, total, export, vidage',()=>{
 const s=section('2. Le lot, et ce que tu vérifies en plus');
 for(const m of ['cinq secondes','que **tu vois dans ESV**','égal aux deux additionnés','Départs des parties (N)','Vider le cache des exports'])assert.ok(s.includes(m),m);
});
test('retour arrière vers la 4.9.0.9 ; aucune autre empreinte ; aucun identifiant de projet ESV',()=>{
 const r=section('4. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));assert.match(r,/4\.9\.0\.9/);assert.match(r,/ariane-4\.9\.0-test\.9\.zip/);
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
 assert.deepEqual(hex,['0d9637b055942a3bca54c20cb8fd337112f4476352380a2d136349715d65fba7']);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
