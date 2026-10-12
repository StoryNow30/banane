'use strict';
/* Consigne de la séance « test 4 » (consignes/seance-terrain-test-4-2026-10-12.md) : mêmes garanties que celle du test 3
 * (tests/consigne-test3.test.cjs) — jamais de désinstallation avant un export VÉRIFIÉ et envoyé, retour arrière = DÉSACTIVER sans
 * supprimer — plus ce qui change au 4.9.0.4 : le vidage après un dernier cut différé, le nuage de la capture du dernier cut
 * volontairement gardé (mots de la consigne = mots de l'interface), l'astuce du découpage en morceaux de 20 Mo. Aucune
 * empreinte du paquet 4.9.0.4 dans le fichier (il est dans le paquet), aucun identifiant de projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const racine=path.resolve(__dirname,'..'),lire=f=>fs.readFileSync(path.join(racine,f),'utf8');
const texte=lire(process.env.CONSIGNE_TEST4||'consignes/seance-terrain-test-4-2026-10-12.md');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const SHA_TEST3='3612bd3886e86777aad5c4923021bf93ef131edb94db472a9f1143d18c2fabba',SHA_TEST2='06b1f2f728f584e7b05322a99301441e80712bcfa195f1cb39e05c55000f5ab2';

test('retour arrière : export vérifié et envoyé, puis désactivation sans suppression, vers la test 3 puis la test 2',()=>{
 const s=section("Si quelque chose d'anormal arrive"),r=s.slice(s.indexOf('Retour arrière'));
 assert.ok(r.length>0,'paragraphe « Retour arrière » absent');
 for(const mot of ['Téléchargements','taille','Export incomplet','DÉSACTIVE','sans la supprimer','4.9.0 test 4','4.9.0 test 3','4.9.0 test 2'])assert.ok(r.includes(mot),'retour arrière sans « '+mot+' »');
 assert.ok(r.indexOf('Export incomplet')<r.indexOf('DÉSACTIVE'),'la vérification de l’export vient avant la désactivation');
 assert.ok(r.indexOf('envoie-le-moi')<r.indexOf('DÉSACTIVE'),'l’envoi vient avant la désactivation');
 assert.doesNotMatch(r,/désinstalle la 4\.9\.0 test/,'le retour arrière ne fait jamais désinstaller');
 const compact=r.replace(/\s+/g,'');assert.ok(compact.includes(SHA_TEST3),'empreinte de la test 3');assert.ok(compact.includes(SHA_TEST2),'empreinte de la test 2');
});
test('avant de commencer et export échoué : ne pas désinstaller sans export complet',()=>{
 const avant=section('Avant de commencer'),echec=section('Si un export échoue');
 assert.match(avant,/ne désinstalle pas l'ancienne Ariane/);assert.match(avant,/désactive-la/);assert.match(avant,/4\.9\.0 test 3/);
 assert.match(echec,/ne désinstalle pas Ariane/);assert.match(echec,/désactive-la/);
});
test('le paquet : 4.9.0.4, numéro neuf, empreinte hors du fichier (elle est dans le paquet), aucun identifiant de projet ESV',()=>{
 const p=section('Le paquet');
 assert.match(p,/ariane-4\.9\.0-test\.4\.zip/);assert.match(p,/4\.9\.0\.4/);assert.match(p,/4\.9\.0 test 4/);assert.match(p,/numéro neuf/);assert.match(p,/ne peut pas porter sa propre empreinte/);
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]).sort();
 assert.deepEqual(hex,[SHA_TEST3,SHA_TEST2].sort(),'seules les empreintes des paquets 4.9.0.3 et 4.9.0.2 (retour arrière) figurent dans le fichier');
 assert.doesNotMatch(texte,/[0-9]{6}_[0-9]{6}_[A-Za-z]_/,'aucun identifiant de projet ESV');
 assert.doesNotMatch(texte,/[0-9]{6}_[0-9]{6}_/);
});
test('ce qui change : vidage après un dernier cut différé, nuage de la capture du dernier cut gardé — avec les mots de l’interface',()=>{
 const nouveau=section('Ce qui est nouveau à essayer'),entete=section('Le paquet');
 for(const mot of ['dernier cut différé','1 nuage gardé : capture du dernier cut','Sera GARDÉ','prochain export',"Rien d'autre à vider",'arrêté à la main','Reprendre'])assert.ok((nouveau+entete).includes(mot),'sans « '+mot+' »');
 assert.match(nouveau+entete,/Ce n'est pas une perte/);assert.match(nouveau,/C'est voulu/);
 // Les mots de la consigne sont ceux de l'interface et du refus.
 const panel=lire('panel.js'),cache=lire('src/export-cache.js');
 assert.ok(panel.includes('Sera GARDÉ : la capture ouverte du dernier cut'));assert.ok(panel.includes('nuage gardé'));assert.ok(panel.includes('capture du dernier cut'));assert.ok(panel.includes('Rien d’autre à vider'));
 assert.ok(cache.includes('arrêté à la main')&&cache.includes('« Reprendre »'));
});
test('astuce du découpage en morceaux de 20 Mo rappelée, sans détail ; vidage automatique toujours désactivé',()=>{
 assert.match(section('Ce qui est nouveau à essayer'),/astuce du\s+découpage en morceaux de 20 Mo/);
 assert.match(texte,/vidage automatique est DÉSACTIVÉ/);
});
test('limites dites : pas essayé sur le vrai ESV ; STALE posé à la main dans l’essai',()=>{
 const l=section('Ce qui n\'est pas vérifié (à savoir avant de partir)');
 assert.match(l,/Pas essayé sur le vrai ESV/);assert.match(l,/STALE/);assert.match(l,/posé à la main/);assert.match(l,/Edge : non essayé/);
});
