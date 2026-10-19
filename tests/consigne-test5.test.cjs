'use strict';
/* Consigne de la séance « test 5 » (A/A) : installer par-dessus, vérifier, vider, deux lots, ne jamais désinstaller avant un export envoyé, aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-test-5-2026-10-12.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version « 4.9.0 test 5 » vérifiée, vidage',()=>{
 const s=section('1. Installer et vérifier');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la test 5'),'le contrôle vient avant la pose');
 for(const m of ['Get-FileHash','ariane-4.9.0-test.5.zip','Ne désinstalle rien','Recharger','4.9.0 test 5','Vider le cache des exports','1 nuage gardé'])assert.ok(s.includes(m),m);
});
test('A/A : mêmes conditions, deux parties neuves, Orbite seulement, 600 pixels, découpage en 20 Mo',()=>{
 const a=section('2. Le test A/A : deux lots'),f=section('3. À la fin de chaque lot');
 for(const m of ['même version','Deux parties neuves','600 pixels','Orbite seulement','Ne touche à rien','extension Claude'])assert.ok(a.includes(m),m);
 for(const m of ['20 Mo','Export incomplet','Attends 5 secondes'])assert.ok(f.includes(m),m);
 assert.ok(f.indexOf('Vérifie le zip')<f.indexOf('Vider le cache'),'vérifier avant de vider');
});
test('retour arrière : ne désinstalle pas, désactive, vers la 4.9.0.4 ; aucune empreinte hors celle de la 4.9.0.4 ; aucun identifiant de projet ESV',()=>{
 const r=section('4. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.match(r,/désactive/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
 assert.deepEqual(hex,['ddf94276db49c2a0f22890f9a025e7f6fff334887a6238ecd867d3c4089be8dd']);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
