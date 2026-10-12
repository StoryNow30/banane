'use strict';
/* A3 (relecture du test 3) : désinstaller Ariane efface tout son cache (mesuré au banc : 3/3/3 → 0/0/0). La consigne
 * de séance ne doit jamais faire désinstaller avant un export VÉRIFIÉ ; le retour arrière DÉSACTIVE la version en cause
 * sans la supprimer. Contrôle du texte de la consigne versionnée. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes','seance-terrain-test-3-2026-10-11.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
test('retour arrière : export vérifié et envoyé, puis désactivation sans suppression',()=>{
 const s=section("Si quelque chose d'anormal arrive"),r=s.slice(s.indexOf('Retour arrière'));
 assert.ok(r.length>0,'paragraphe « Retour arrière » absent');
 for(const mot of ['Téléchargements','taille','Export incomplet','DÉSACTIVE','sans la supprimer'])assert.ok(r.includes(mot),'retour arrière sans « '+mot+' »');
 assert.ok(r.indexOf('Export incomplet')<r.indexOf('DÉSACTIVE'),'la vérification de l’export vient avant la désactivation');
 assert.doesNotMatch(r,/désinstalle la 4\.9\.0 test 3/,'le retour arrière ne fait plus désinstaller la test 3');
});
test('avant de commencer et export échoué : ne pas désinstaller sans export complet',()=>{
 const avant=section('Avant de commencer'),echec=section('Si un export échoue');
 assert.match(avant,/ne désinstalle pas l'ancienne Ariane/);assert.match(avant,/désactive-la/);
 assert.match(echec,/ne désinstalle pas Ariane/);assert.match(echec,/désactive-la/);
});
