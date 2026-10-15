'use strict';
/* Consigne de la séance « 4.9.5 test 3 » (relevés en lecture seule et export allégé) : installer par-dessus, version vérifiée ; Orbite 30 min
 * sans F5 volontaire puis un F5 et 10 min de plus ; une courte séance Écho ; exports à envoyer ; ce qui est nouveau = rien de visible sauf
 * l'avis de contrat ESV, cité tel qu'Ariane l'écrit ; aucune empreinte (la consigne est dans le paquet) ; aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-4.9.5-test-3-2026-10-16.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version vérifiée',()=>{
 const s=section('1. Installer et vérifier').replace(/\s+/g,' ');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la 4.9.5 test 3'));
 for(const m of ['Get-FileHash','ariane-4.9.5-test.3.zip','Ne désinstalle rien','Recharger','« 4.9.5 test 3 »','ARIANE 4.9.5 test 3','Ariane 4.9.5 test 3 · ouvrir'])assert.ok(s.includes(m),m);
});
test('ce qui est nouveau : le logo, puis rien de visible sauf l\'avis de contrat ESV, cité tel qu\'Ariane l\'écrit ; rien ne change dans la pose',()=>{
 const debut=texte.slice(0,texte.indexOf('## Le paquet')).replace(/\s+/g,' ');
 for(const m of ['Rien ne change dans ce qu\'Orbite décide, lit, pose ou valide','Le moteur n\'est pas modifié','Le nouveau logo','rien de nouveau à l\'écran, sauf un avis possible','lecture seule','plus léger'])assert.ok(debut.includes(m),m);
 const bg=fs.readFileSync(path.resolve(__dirname,'..','background.js'),'utf8').replace(/\s+/g,' ');
 /* Les deux avis sont ceux que le service worker écrit (début de phrase identique). */
 assert.ok(debut.includes('ESV n’a plus le même contrat qu’à la dernière connexion (empreinte …, puis …). Rien ne s’arrête ; préviens-moi avant de lancer un lot.'));
 assert.ok(bg.includes('ESV n’a plus le même contrat qu’à la dernière connexion (empreinte ${prev.hash}, puis ${c.hash}'));
 assert.ok(debut.includes('ESV a changé : des requêtes de rails passent par « fetch » (N vues), qu’Ariane ne voit pas. Les validations ne sont plus contrôlées : préviens-moi avant de lancer un lot.'));
 assert.ok(bg.includes('ESV a changé : des requêtes de rails passent par « fetch » (${f.n} vue${f.n>1?\'s\':\'\'}), qu’Ariane ne voit pas. Les validations ne sont plus contrôlées : préviens-moi avant de lancer un lot.'));
});
test('Orbite : 30 min sans F5 volontaire, puis un F5 et 10 min de plus, heures notées',()=>{
 const s=section('2. Ce que tu essaies en Orbite (30 minutes sans F5, puis F5 et 10 minutes)').replace(/\s+/g,' ');
 for(const m of ['**Une séance Orbite normale d\'au moins 30 minutes, SANS F5 volontaire.**','**N\'appuie pas sur F5**','**Puis un F5**','**Note l\'heure de ce F5.**','**Encore 10 minutes**'])assert.ok(s.includes(m),m);
});
test('Écho : une courte séance, export en volumes',()=>{
 const s=section('3. Une courte séance Écho (environ 10 minutes, une dizaine de cuts)').replace(/\s+/g,' ');
 for(const m of ['**Démarre Écho**','**Valide une dizaine de cuts**','Maj+Espace','Ctrl+Entrée','**Terminer et télécharger**','volumes zip','CONTENU.txt'])assert.ok(s.includes(m),m);
});
test('exports à envoyer : tous les volumes, SHA-256 ; cache vidé après confirmation',()=>{
 const f=section('4. À la fin : les exports').replace(/\s+/g,' ');
 for(const m of ['**tous les volumes**','SHA-256','Vide le cache seulement après ma confirmation de réception','Tout télécharger pour l\'analyse'])assert.ok(f.includes(m),m);
});
test('retour arrière vers la 4.9.5 test 2 ; aucune empreinte dans la consigne ; aucun identifiant de projet ESV',()=>{
 const r=section('5. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));assert.match(r,/pose la 4\.9\.5 test 2/);
 assert.deepEqual([...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)],[]);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
