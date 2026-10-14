'use strict';
/* Consigne de la séance « test 15 » (B3, transitions du lot) : installer par-dessus, version et lignes de réglage inchangées,
 * les sept essais de comportement, retour vers la 4.9.0.14 avec sa seule empreinte, aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-test-15-2026-10-14.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const S=require('../src/settings.js');
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version et réglages vérifiés (inchangés)',()=>{
 const s=section('1. Installer et vérifier').replace(/\s+/g,' ');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la test 15'));
 for(const m of ['Get-FileHash','ariane-4.9.0-test.15.zip','Ne désinstalle rien','Recharger','4.9.0 test 15'])assert.ok(s.includes(m),m);
 for(const nom of ['Mode rapide (V3)','Allègement des nuages','Voisins de la liste d’ESV (B1)']){const l=S.describe().find(x=>x.nom===nom);assert.ok(l,nom);
  assert.ok(s.includes(`« ${l.nom} » dit toujours « ${l.valeur} »`)||s.includes(`« ${l.nom} », qui doit dire « ${l.valeur} »`),nom);}
});
test('ce qui change : B3 seulement, interne ; aucun comportement ne doit changer ; les sept essais',()=>{
 const debut=texte.slice(0,texte.indexOf('## Le paquet')).replace(/\s+/g,' ');
 for(const m of ['Rien ne devrait changer','B3','Le moteur n\'est pas modifié','aucun comportement ne change','reviens à la test 14'])assert.ok(debut.includes(m),m);
 const e=section('2. Ce que tu essaies').replace(/\s+/g,' ');
 for(const m of ['**Démarrer**','**Pause**','**Reprendre**','**F5**','**Arrêter** le lot en plein cut','**jusqu\'à sa fin**','**jusqu\'à la fin de partie**','**Une erreur affichée dans l\'avis**'])assert.ok(e.includes(m),m);
 assert.ok(fs.existsSync(path.resolve(__dirname,'..','fiches/B3_RAPPORT.md')),'le rapport de B3 est dans le dépôt');
 assert.match(fs.readFileSync(path.resolve(__dirname,'..','background.js'),'utf8'),/TRANSITIONS_LOT/,'B3 est dans le service worker');
});
test('retour arrière vers la 4.9.0.14 ; aucune autre empreinte ; aucun identifiant de projet ESV',()=>{
 const r=section('4. Si quelque chose ne va pas, ou si un comportement change');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));assert.match(r,/4\.9\.0\.14/);assert.match(r,/ariane-4\.9\.0-test\.14\.zip/);
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
 assert.deepEqual(hex,['8e36e2326cefe5c8c9bc40d617b05aaf8a9ca27feca8bd7fb4a0af3ed98abf72']);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
