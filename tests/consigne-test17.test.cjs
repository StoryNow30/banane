'use strict';
/* Consigne de la séance « test 17 » : installer par-dessus, version vérifiée ; ce qu'on regarde (pourcentage des invalides
 * « N / M invalides » sur toute la partie, position ailleurs, heure de Paris, bornes alignées) ; les essais de la test 16 pas
 * encore faits sur le terrain (B3) ; export en volumes, tous envoyés ; retour vers la test 16 avec sa seule empreinte ;
 * aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-test-17-2026-10-15.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version vérifiée',()=>{
 const s=section('1. Installer et vérifier').replace(/\s+/g,' ');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la test 17'));
 for(const m of ['Get-FileHash','ariane-4.9.0-test.17.zip','Ne désinstalle rien','Recharger','4.9.0 test 17','Ariane 4.9.0 test 17 · ouvrir'])assert.ok(s.includes(m),m);
});
test('ce qu’on regarde : %, « N / M invalides », position ailleurs, heure de Paris, bornes ; puis les essais B3 restants',()=>{
 const debut=texte.slice(0,texte.indexOf('## Le paquet')).replace(/\s+/g,' ');
 for(const m of ['Rien ne change dans ce qu\'Ariane décide','Le moteur n\'est pas modifié','« 39 / 514 invalides »','heure de Paris'])assert.ok(debut.includes(m),m);
 const e=section('2. Ce que tu regardes et ce que tu essaies').replace(/\s+/g,' ');
 for(const m of ['**Le pourcentage sur toute la partie**','« N / M invalides »','« 7,5 % »','ne recule jamais','100 %','**Les autres lots**','« N cuts »',
   '**L\'heure de Paris**','Nulle part « UTC »','`CONTENU.txt`','**Les bornes**','« Premier cut » et « Dernier cut »',
   '**Pause puis Reprendre**','**F5 pendant la pause**','**Arrêter en plein cut, puis Reprendre**','Rails modifiés depuis la capture du cut',
   '**Reprendre après la fin**','« Lot déjà terminé »','**Un lot à plage fixe jusqu\'à sa fin**','**Une erreur dans l\'avis**'])assert.ok(e.includes(m),m);
 const f=section('3. À la fin').replace(/\s+/g,' ');
 for(const m of ['**sort tout seul en volumes**','**tous les volumes**','SHA-256','après ma confirmation de réception'])assert.ok(f.includes(m),m);
});
test('retour arrière vers la test 16 ; aucune autre empreinte ; aucun identifiant de projet ESV',()=>{
 const r=section('4. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));assert.match(r,/4\.9\.0\.16/);assert.match(r,/ariane-4\.9\.0-test\.16\.zip/);
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
 assert.deepEqual(hex,['1d69dff2c58eb337e2a579c01eb44266e64296fc90d4c388f8875627d2c79926']);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
