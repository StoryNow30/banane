'use strict';
/* Consigne de la séance « test 12 » (UX Orbite variante A ; retour à un cut en lecture seule) : installer par-dessus, version et lignes de
 * réglage (dont la nouvelle ligne B1), ce que l'opérateur regarde en plus, retour vers la 4.9.0.11 avec sa seule empreinte,
 * aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-test-12-2026-10-14.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const S=require('../src/settings.js');
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version et réglages vérifiés (dont la ligne B1, inchangée)',()=>{
 const s=section('1. Installer et vérifier').replace(/\s+/g,' ');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la test 12'));
 for(const m of ['Get-FileHash','ariane-4.9.0-test.12.zip','Ne désinstalle rien','Recharger','4.9.0 test 12'])assert.ok(s.includes(m),m);
 for(const nom of ['Mode rapide (V3)','Allègement des nuages','Voisins de la liste d’ESV (B1)']){const l=S.describe().find(x=>x.nom===nom);assert.ok(l,nom);
  assert.ok(s.includes(`« ${l.nom} » dit toujours « ${l.valeur} »`)||s.includes(`« ${l.nom} », qui doit dire « ${l.valeur} »`),nom);}
});
test('ce qui change : nouveau panneau Orbite (politique dans « Détails du lot ») et retour à un cut sans bouton, rien d’autre',()=>{
 const debut=texte.slice(0,texte.indexOf('## Le paquet')).replace(/\s+/g,' ');
 for(const m of ['Rien ne change dans ce qu\'Ariane décide','variante A « Accueil »','« Détails du lot »','aucun bouton','la pose ne l\'appelle jamais','B1 en ombre'])assert.ok(debut.includes(m),m);
 assert.equal(S.appuisListe,'ombre');assert.ok(fs.readFileSync(path.resolve(__dirname,'..','panel.html'),'utf8').includes('lot-politique-pastille'),'la pastille existe dans le panneau');
});
test('retour arrière vers la 4.9.0.11 ; aucune autre empreinte ; aucun identifiant de projet ESV',()=>{
 const r=section('4. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));assert.match(r,/4\.9\.0\.11/);assert.match(r,/ariane-4\.9\.0-test\.11\.zip/);
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
 assert.deepEqual(hex,['a9675f286a14fcdba2e1acf8521241ccc5dc8a734d29a1d88bd2f7f1b36c1a1c']);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
