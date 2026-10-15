'use strict';
/* Consigne de la séance « test 16 » : installer par-dessus, version et lignes de réglage (dont la nouvelle ligne du volume zip),
 * les essais (sélecteur, historique des départs, tuile, Arrêter puis Reprendre, « Lot déjà terminé », erreur dans l'avis, lot à
 * plage fixe jusqu'à sa fin), export découpé sans script, retour vers la 4.9.0.15 avec sa seule empreinte, aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-test-16-2026-10-15.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const S=require('../src/settings.js');
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version et réglages vérifiés',()=>{
 const s=section('1. Installer et vérifier').replace(/\s+/g,' ');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la test 16'));
 for(const m of ['Get-FileHash','ariane-4.9.0-test.16.zip','Ne désinstalle rien','Recharger','4.9.0 test 16'])assert.ok(s.includes(m),m);
 for(const nom of ['Mode rapide (V3)','Allègement des nuages','Voisins de la liste d’ESV (B1)']){const l=S.describe().find(x=>x.nom===nom);assert.ok(l,nom);
  assert.ok(s.includes(`« ${l.nom} » dit toujours « ${l.valeur} »`),nom);}
 const v=S.describe().find(x=>x.nom==='Taille d’un volume zip');assert.ok(s.includes(`« ${v.nom} », dit « ${v.valeur} »`),'ligne du volume zip');
});
test('ce qui change, et les essais demandés (dont ceux non faits au test 15)',()=>{
 const debut=texte.slice(0,texte.indexOf('## Le paquet')).replace(/\s+/g,' ');
 for(const m of ['Rien ne change dans ce qu\'Ariane décide','Lot déjà terminé','Le moteur n\'est pas modifié'])assert.ok(debut.includes(m),m);
 const e=section('2. Ce que tu regardes et ce que tu essaies').replace(/\s+/g,' ');
 for(const m of ['**Le sélecteur « Onglet ESV »**','**L\'historique des départs**','**La tuile « Lot »**','**jusqu\'à sa fin**','**Arrêter puis Reprendre**',
   'Rails modifiés depuis la capture du cut','**Reprendre après la fin**','**jusqu\'à la fin de partie**','« Lot déjà terminé »','**Une erreur affichée dans l\'avis**','(essai non fait au test 15)','« 1 cut »'])assert.ok(e.includes(m),m);
 const f=section('3. À la fin').replace(/\s+/g,' ');
 for(const m of ['**Plus besoin du script de découpe**','17 Mo au plus','volume01-sur03.zip','Volume n sur N','dépasse seul','**tous les volumes**','après ma confirmation de réception'])assert.ok(f.includes(m),m);
 assert.equal(S.export.zipMaxBytes,17*S.Mo,'la consigne et le réglage disent la même limite');
});
test('retour arrière vers la 4.9.0.15 ; aucune autre empreinte ; aucun identifiant de projet ESV',()=>{
 const r=section('4. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));assert.match(r,/4\.9\.0\.15/);assert.match(r,/ariane-4\.9\.0-test\.15\.zip/);
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
 assert.deepEqual(hex,['cdbb6fe9f7d9aa41963499fdfc49485da5a61d74dad5ae000f043f89bcc896ce']);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
