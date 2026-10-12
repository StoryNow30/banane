'use strict';
/* Consigne de la séance « test 6 » (V3, I1) : installer par-dessus, vérifier la version et le réglage, vider, un lot long, ne jamais désinstaller
 * avant un export envoyé, retour vers la 4.9.0.5 avec sa seule empreinte, aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-test-6-2026-10-13.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const S=require('../src/settings.js');
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version et réglage vérifiés, vidage',()=>{
 const s=section('1. Installer et vérifier');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la test 6'),'le contrôle vient avant la pose');
 for(const m of ['Get-FileHash','ariane-4.9.0-test.6.zip','Ne désinstalle rien','Recharger','4.9.0 test 6','Vider le cache des exports'])assert.ok(s.includes(m),m);
 // Le libellé et la valeur annoncés sont ceux que le panneau affiche réellement.
 const ligne=S.describe().find(l=>l.nom==='Lecture rapide (V3, I1)');assert.ok(s.includes(`« ${ligne.nom} » dit « ${ligne.valeur} »`));
});
test('le lot : partie neuve, 300 coupes, 600 pixels, Orbite seulement, surveiller ESV ; fin : vérifier avant de vider',()=>{
 const a=section('2. Le lot'),f=section('3. À la fin du lot');
 for(const m of ['partie neuve','300 coupes','600 pixels','Orbite seulement','Ne touche à rien','extension Claude','saccade','Lecture LiDAR instable'])assert.ok(a.includes(m),m);
 for(const m of ['20 Mo','Export incomplet','Attends 5 secondes','tools/perf-v3.cjs'])assert.ok(f.includes(m),m);
 assert.ok(f.indexOf('Vérifie le zip')<f.indexOf('Vider le cache'),'vérifier avant de vider');
 assert.ok(fs.existsSync(path.resolve(__dirname,'..','tools/perf-v3.cjs')));
});
test('retour arrière vers la 4.9.0.5 ; aucune autre empreinte ; aucun identifiant de projet ESV',()=>{
 const r=section('4. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.match(r,/désactive/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));
 assert.match(r,/4\.9\.0\.5/);assert.match(r,/ariane-4\.9\.0-test\.5\.zip/);
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
 assert.deepEqual(hex,['77dfb592323f02f8c9dcd2897c344750b488db1c43c41a39721059627630d3fc']);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
