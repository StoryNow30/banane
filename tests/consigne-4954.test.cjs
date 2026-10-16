'use strict';
/* Consigne de la séance « 4.9.5 test 4 » (mémoire de la liste, reprise de l'Écho après un F5, deux fenêtres ESV sans fausse alerte, correction verticale en
 * ombre) : installer par-dessus, version vérifiée ; Orbite 30 min sans F5 volontaire puis un F5 et 10 min de plus ; une séance Écho avec UN F5 en fin de partie,
 * l'heure notée ; exports à envoyer ; ce qui est nouveau est dit en français simple ; RIEN ne change dans la pose ; retour arrière vers la test 3 ; aucune
 * empreinte (la consigne est dans le paquet) ; aucune donnée de projet ESV ; aucun nom de modèle d'IA. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const FICHIER='consignes/seance-terrain-4.9.5-test-4-2026-10-16.md';
const texte=fs.readFileSync(path.resolve(__dirname,'..',FICHIER),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const plat=t=>t.replace(/\s+/g,' ');
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version vérifiée',()=>{
 const s=plat(section('1. Installer et vérifier'));
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la 4.9.5 test 4'));
 for(const m of ['Get-FileHash','ariane-4.9.5-test.4.zip','Ne désinstalle rien','Recharger','« 4.9.5 test 4 »','ARIANE 4.9.5 test 4','Ariane 4.9.5 test 4 · ouvrir'])assert.ok(s.includes(m),m);
});
test('ce qui change : les cinq nouveautés, en français simple, et rien dans la pose',()=>{
 const debut=plat(texte.slice(0,texte.indexOf('## Le paquet')));
 for(const m of ['Rien ne change dans ce qu\'Orbite décide, lit, pose ou valide','Le moteur n\'est pas modifié','Ariane n\'envoie aucune commande de plus à ESV',
  'mémoire de la liste','le F5 en Écho est de nouveau permis','Deux fenêtres ESV ouvertes ne donnent plus de fausse alerte','référence humaine','plafond de convention','reste coupé','logo',
  'correction verticale','jamais appliquée'])assert.ok(debut.includes(m),m);
});
test('les avis possibles sont cités tels qu\'Ariane les écrit',()=>{
 const debut=plat(texte.slice(0,texte.indexOf('## Le paquet')));
 const bg=plat(fs.readFileSync(path.resolve(__dirname,'..','background.js'),'utf8'));
 assert.ok(debut.includes('ESV n’a plus le même contrat qu’à la dernière connexion (empreinte …, puis …). Rien ne s’arrête ; préviens-moi avant de lancer un lot.'));
 assert.ok(bg.includes('ESV n’a plus le même contrat qu’à la dernière connexion (empreinte ${prev.hash}, puis ${c.hash}'));
 assert.ok(debut.includes('ESV a changé : des requêtes de rails passent par « fetch » (N vues), qu’Ariane ne voit pas. Les validations ne sont plus contrôlées : préviens-moi avant de lancer un lot.'));
 assert.ok(bg.includes('ESV a changé : des requêtes de rails passent par « fetch » (${f.n} vue${f.n>1?\'s\':\'\'}), qu’Ariane ne voit pas. Les validations ne sont plus contrôlées : préviens-moi avant de lancer un lot.'));
});
test('Orbite : 30 min sans F5 volontaire, puis un F5 et 10 min de plus, heures notées',()=>{
 const s=plat(section('2. Ce que tu essaies en Orbite (30 minutes sans F5, puis F5 et 10 minutes)'));
 for(const m of ['**Une séance Orbite normale d\'au moins 30 minutes, SANS F5 volontaire.**','**N\'appuie pas sur F5**','**Puis un F5**','**Note l\'heure de ce F5.**','**Encore 10 minutes**'])assert.ok(s.includes(m),m);
});
test('Écho : le F5 est permis, UN seul, en fin de partie, l\'heure notée ; ce qu\'on doit voir et ce qui ferait signe',()=>{
 const s=plat(section('3. Une séance Écho avec un F5 en fin de partie (environ 15 minutes)'));
 for(const m of ['**Démarre Écho**','**Valide une dizaine de cuts**','Maj+Espace','Ctrl+Entrée','**Un seul F5**','**en fin de partie**','**Note l\'heure de ce F5**','bandeau rouge','la même séance continue','**Terminer et télécharger**','volumes zip','CONTENU.txt'])assert.ok(s.includes(m),m);
 assert.ok(s.indexOf('Valide une dizaine de cuts')<s.indexOf('Un seul F5'));
 assert.ok(s.indexOf('Un seul F5')<s.indexOf('Terminer et télécharger'));
 /* Les délais attendus viennent du relevé de la test 3 : 60 s au plus, puis « Connecter puis Reprendre ». */
 assert.ok(s.includes('60 secondes'));assert.ok(s.includes('Connecter'));
});
test('deux fenêtres ESV : le contrôle à faire, sans fausse alerte attendue',()=>{
 const s=plat(section('4. Deux fenêtres ESV (si tu en as deux ouvertes)'));
 for(const m of ['Ouvre la partie dans deux fenêtres','Connecter','plus de fausse alerte','note l\'heure et le texte exact'])assert.ok(s.includes(m),m);
});
test('exports à envoyer : tous les volumes, SHA-256 ; cache vidé après confirmation',()=>{
 const f=plat(section('5. À la fin : les exports'));
 for(const m of ['**tous les volumes**','SHA-256','Vide le cache seulement après ma confirmation de réception','Tout télécharger pour l\'analyse'])assert.ok(f.includes(m),m);
});
test('retour arrière vers la 4.9.5 test 3 ; aucune empreinte dans la consigne ; aucun identifiant de projet ESV ; aucun nom de modèle d\'IA',()=>{
 const r=section('6. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));assert.match(r,/pose la 4\.9\.5 test 3/);
 assert.deepEqual([...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)],[]);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
 assert.doesNotMatch(texte,new RegExp(['cla'+'ude','anth'+'ropic','op'+'us','son'+'net','hai'+'ku','fa'+'ble','g'+'pt','gem'+'ini'].join('|'),'i'));
});
test('ce qui n\'est pas vérifié est dit',()=>{
 const s=plat(section('7. Ce qui n\'est pas vérifié'));
 for(const m of ['ESV simulé','Edge n\'a pas été vu','F5 en Écho','fausse alerte'])assert.ok(s.includes(m),m);
});
