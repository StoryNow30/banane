'use strict';
/* Consigne de la séance « 4.9.5 test 2 » (fusion de celles de la test 20 et de la 4.9.5 test 1) : installer par-dessus, version
 * vérifiée ; Écho (toutes les touches dont Ctrl+Entrée et Ctrl+flèche, correction, F5, pause, dernier cut, export en volumes) ;
 * Orbite (30 min sans F5 volontaire, puis un F5 et 10 min de plus, D3) ; exports à envoyer ; aucune empreinte (la consigne est
 * dans le paquet) ; aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-4.9.5-test-2-2026-10-15.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version vérifiée',()=>{
 const s=section('1. Installer et vérifier').replace(/\s+/g,' ');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la 4.9.5 test 2'));
 for(const m of ['Get-FileHash','ariane-4.9.5-test.2.zip','Ne désinstalle rien','Recharger','« 4.9.5 test 2 »','ARIANE 4.9.5 test 2','Ariane 4.9.5 test 2 · ouvrir'])assert.ok(s.includes(m),m);
});
test('Écho : toutes les touches, correction, F5, pause, dernier cut, export en volumes',()=>{
 const s=section('2. Ce que tu essaies en Écho').replace(/\s+/g,' ');
 for(const m of ['Maj+Espace','**Ctrl+Entrée**','**Entrée**','**Ctrl+flèche**','**Corrige un cut**','**F5 sur ESV en plein Écho**','**Pause de dix minutes**','**Le dernier cut de la partie**','volumes zip','CONTENU.txt'])assert.ok(s.includes(m),m);
});
test('Orbite : 30 min sans F5 volontaire, puis un F5 et 10 min de plus, heures notées ; avis D3 tel qu’Ariane l’écrit',()=>{
 const debut=texte.slice(0,texte.indexOf('## Le paquet')).replace(/\s+/g,' ');
 for(const m of ['Rien ne change dans ce qu\'Orbite décide, lit, pose ou valide','Le moteur n\'est pas modifié'])assert.ok(debut.includes(m),m);
 assert.match(debut,/« ESV a refusé d'enregistrer la validation du cut N \(erreur serveur\)\. Vérifie ce cut dans ESV, puis Reprendre\. »/);
 const s=section('3. Ce que tu essaies en Orbite').replace(/\s+/g,' ');
 for(const m of ['**Une séance Orbite normale d\'au moins 30 minutes, SANS F5 volontaire.**','n\'appuie pas sur F5','**Puis un F5**','**Note l\'heure de ce F5.**','**Encore 10 minutes**'])assert.ok(s.includes(m),m);
 const f=section('4. À la fin').replace(/\s+/g,' ');
 for(const m of ['**tous les volumes**','SHA-256','Vide le cache seulement après ma confirmation de réception'])assert.ok(f.includes(m),m);
});
test('retour arrière ; aucune empreinte dans la consigne ; aucun identifiant de projet ESV',()=>{
 const r=section('5. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));
 assert.deepEqual([...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)],[]);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
