'use strict';
/* Consigne de la séance « 4.9.5 test 1 » : installer par-dessus, version vérifiée ; séance Orbite d'au moins 30 min SANS F5
 * volontaire (pour voir le signal s'éteindre, D-109), puis un F5 et 10 min de plus, heures notées ; l'avis de l'écriture
 * refusée (D3) cité tel qu'Ariane l'écrit ; export en volumes, tous envoyés ; retour vers la 4.9.0 stable avec sa seule
 * empreinte ; aucune donnée de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-4.9.5-test-1-2026-10-15.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version vérifiée',()=>{
 const s=section('1. Installer et vérifier').replace(/\s+/g,' ');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la 4.9.5 test 1'));
 for(const m of ['Get-FileHash','ariane-4.9.5-test.1.zip','Ne désinstalle rien','Recharger','« 4.9.5 test 1 »','ARIANE 4.9.5 test 1','Ariane 4.9.5 test 1 · ouvrir'])assert.ok(s.includes(m),m);
});
test('séance : 30 min sans F5 volontaire, puis un F5 et 10 min de plus, heures notées ; avis D3 tel qu’Ariane l’écrit',()=>{
 const debut=texte.slice(0,texte.indexOf('## Le paquet')).replace(/\s+/g,' ');
 for(const m of ['Rien ne change dans ce qu\'Ariane décide, lit, pose ou valide','Le moteur n\'est pas modifié'])assert.ok(debut.includes(m),m);
 const avis=/« ESV a refusé d'enregistrer la validation du cut N \(erreur serveur\)\. Vérifie ce cut dans ESV, puis Reprendre\. »/;assert.match(debut,avis);
 const code=fs.readFileSync(path.resolve(__dirname,'..','background.js'),'utf8');
 assert.ok(code.includes('ESV a refusé d’enregistrer la validation du cut ${cut} (${e.statut===0?\'pas de réponse du serveur\':\'erreur serveur\'}). Vérifie ce cut dans ESV, puis Reprendre.'),'même avis que le code');
 const s=section('2. La séance').replace(/\s+/g,' ');
 for(const m of ['**Une séance Orbite normale d\'au moins 30 minutes, SANS F5 volontaire.**','n\'appuie pas sur F5','**Puis un F5**','**Note l\'heure de ce F5.**','**Encore 10 minutes**'])assert.ok(s.includes(m),m);
 const f=section('3. À la fin').replace(/\s+/g,' ');
 for(const m of ['**sort tout seul en volumes**','**tous les volumes**','SHA-256','les deux heures de F5','après ma confirmation de réception'])assert.ok(f.includes(m),m);
});
test('retour arrière vers la 4.9.0 stable ; aucune autre empreinte ; aucun identifiant de projet ESV',()=>{
 const r=section('4. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));assert.match(r,/4\.9\.0 stable/);assert.match(r,/ariane-v4\.9\.0\.zip/);
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
 assert.deepEqual(hex,['341a0d0bf4957face8fa072d772ee5e2b72c3af2648c71c6e20fd7a5db75b3ac']);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
