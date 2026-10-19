'use strict';
/* Consigne de la séance « 4.9.5 test 7 » (panneau rangé, départ de lot sur un cut vert sans écriture, relecture après le lot coupée par défaut,
 * ombre et corriger) : installer par-dessus la test 6, empreinte SHA-256 contrôlée avant la pose, version et choix par défaut vérifiés ; ce qui
 * change est dit en français simple, avec les libellés du panneau ; un lot en « Ombre » puis un lot en « Corriger » sur des parties neuves, sans
 * toucher à ESV pendant la relecture, une Écho complète ensuite ; retour arrière avec la phrase de consignes/README.md (désactive, décompresse,
 * réactive, Recharger, F5) ; aucune empreinte (la consigne est dans le paquet) ; aucune donnée de projet ESV ; aucune adresse ; aucun nom de
 * modèle d'IA ; une page. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const FICHIER='consignes/seance-terrain-4.9.5-test-7-2026-10-18.md';
const texte=fs.readFileSync(path.resolve(__dirname,'..',FICHIER),'utf8');
const html=fs.readFileSync(path.resolve(__dirname,'..','panel.html'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const plat=t=>t.replace(/\s+/g,' ');

test('installation : empreinte avant la pose, par-dessus la test 6 sans désinstaller, version et choix par défaut vérifiés',()=>{
 const s=plat(section('1. Installer et vérifier'));
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la 4.9.5 test 7'));
 for(const m of ['Get-FileHash','ariane-4.9.5-test.7.zip','-Algorithm SHA256','par-dessus la test 6','Ne désinstalle rien','Recharger','« 4.9.5 test 7 »','ARIANE 4.9.5 test 7',
  'Ariane 4.9.5 test 7 · ouvrir','« Relecture après le lot »','« Coupée » est cochée','Tes choix d\'Orbite de la test 6 sont gardés'])assert.ok(s.includes(m),m);
 /* Revue finale : après une mise à jour par-dessus la test 6, « Tout recentré » et la case de la règle sont GARDÉS (D-166, D-167). La consigne ne doit
  * pas annoncer un état « Comme avant » / règle vide, que Mic ne verrait pas, ni lui faire croire qu'il faut s'arrêter. */
 assert.doesNotMatch(s,/Comme avant|règle est vide/);
});

test('ce qui ne change pas : la pose, le moteur ; la mémoire des différés de l\'Écho et déplacer la vue restent coupés',()=>{
 const debut=plat(texte.slice(0,texte.indexOf('## Ce qui change pour toi')));
 for(const m of ['**La pose ne change pas : Orbite pose les rails au même endroit qu\'avant.**','Le moteur n\'est pas modifié','coupée tant que tu ne la choisis pas'])assert.ok(debut.includes(m),m);
 const s=plat(section('Ce qui change pour toi'));
 for(const m of ['**Toujours coupés**','la mémoire des différés de l\'Écho','**déplacer la vue**'])assert.ok(s.includes(m),m);
});

test('ce qui change : les groupes du panneau, le départ sur un cut vert, la règle renommée, les trois choix de la relecture avec les libellés du panneau',()=>{
 const s=plat(section('Ce qui change pour toi'));
 for(const g of ['Lot','Règles et choix du prochain lot','Résultats du dernier lot','Relecture'])
  assert.ok(s.includes(`« ${g} »`),g),assert.ok(html.includes(`class="groupe-titre rise d`)&&html.includes(`>${g}</h2>`),'groupe du panneau : '+g);
 assert.ok(s.includes('« Export, archive et réglages avancés »'));assert.ok(html.includes('Export, archive et réglages avancés'));
 for(const m of ['« Dernier lot » et « Prochain lot »','n\'écrit rien sur ce cut','Maj+Z','le panneau les nomme','Une partie complète ne reçoit plus d\'écriture inutile'])assert.ok(s.includes(m),m);
 assert.ok(s.includes('« Mettre en attente les cuts voisins d’une série de différés »'));
 assert.ok(html.includes('> Mettre en attente les cuts voisins d’une série de différés</label>'),'libellé du panneau : la règle');
 assert.ok(s.includes('« Relecture après le lot »'));assert.match(html,/<legend class="lbl">Relecture après le lot<\/legend>/);
 for(const l of ['Coupée','Ombre','Corriger'])assert.ok(s.includes(`« ${l} »`),l);
 assert.ok(html.includes('name="relecture" id="relecture-coupee" value="coupee"> Coupée</label>'));
 assert.ok(html.includes('id="relecture-ombre" value="ombre"> Ombre ('));assert.ok(html.includes('id="relecture-corriger" value="corriger"> Corriger ('));
 for(const m of ['(par défaut)','sans compte à rebours','« Arrêter la relecture »','ESV marque « vu »','**Maj+Espace**','Jamais un cut posé ou différé par le lot','jamais un SKIP'])assert.ok(s.includes(m),m);
 assert.ok(html.includes('Arrêter la relecture</button>'));
});

test('lot en « Ombre » : une partie neuve, avant de démarrer, ne rien toucher dans ESV pendant la relecture, les heures, puis une Écho complète',()=>{
 const s=plat(section('2. Un lot en « Ombre »'));
 for(const m of ['**Une partie neuve**','**« Ombre »** **avant** de démarrer le lot','**Ne touche à rien dans ESV pendant qu\'elle travaille.**','l\'heure de début et l\'heure de fin de la relecture','**une Écho complète**','jusqu\'à la fin de la partie','Sinon la carte dit pourquoi','« Lancer la relecture »','« Relecture finie »'])assert.ok(s.includes(m),m);
 /* Revue finale : la passe ne part seule que pour un lot jusqu'à la fin de la partie ; ces libellés existent dans le panneau et le service worker. */
 assert.ok(html.includes('>Lancer la relecture</button>'));assert.ok(fs.readFileSync(path.resolve(__dirname,'..','background.js'),'utf8').includes('Relecture finie :'));
 /* La consigne de la test 7 est un document livré le 17/10 : elle nomme les parties d'apprentissage du manifeste de ce jour-là
  * (1:12, 1:13, 1:17, 1:24, 1:29 et 2:1), toutes encore en apprentissage. Le manifeste a grandi depuis (rotation, D-192, D-193). */
 const M=require('../tools/manifeste-parties.cjs'),m=M.lire(),p1=[12,13,17,24,29];
 assert.ok(s.includes(`pas les parties ${p1.slice(0,-1).join(', ')} et ${p1.at(-1)} du premier projet, ni la partie 1 du second`),'parties d\'apprentissage exclues');
 for(const n of p1)assert.equal(M.statut(m,1,n),'apprentissage',`1:${n} toujours en apprentissage`);
 assert.equal(M.statut(m,2,1),'apprentissage');
});

test('lot en « Corriger » : une autre partie neuve, PN et ADV notés, Écho complète, les cuts repris notés, un arrêt ou « J’ai contrôlé le cut » expliqué',()=>{
 const s=plat(section('3. Un lot en « Corriger »'));
 for(const m of ['**Une autre partie neuve**','PN et des ADV','**« Corriger »** **avant** de démarrer le lot','ne touche à rien pendant la relecture','**une Écho complète**',
  '**note combien de cuts tu as dû reprendre parmi ceux qu\'Ariane a corrigés**','« J’ai contrôlé le cut »','contrôle ce cut dans ESV'])assert.ok(s.includes(m),m);
 assert.ok(html.includes('J’ai contrôlé le cut</button>'));
});

test('exports : tous les volumes, SHA-256, les heures ; le choix de la relecture noté ; cache vidé après confirmation',()=>{
 const f=plat(section('4. À la fin : les exports'));
 for(const m of ['Tout télécharger pour l\'analyse','après chaque lot','Le choix de la relecture y est noté (Ombre ou Corriger)','Exporte après « Relecture finie »','**tous les volumes**','SHA-256','tes heures','Terminer et télécharger',
  'Vide le cache seulement après ma confirmation de réception','remets « Coupée »'])assert.ok(f.includes(m),m);
});

test('retour arrière : la phrase de consignes/README.md (désactive, décompresse la test 6, réactive, Recharger, F5)',()=>{
 const r=plat(section('5. Si quelque chose ne va pas'));
 assert.match(r,/Ne désinstalle pas Ariane/);
 const readme=plat(fs.readFileSync(path.resolve(__dirname,'..','consignes/README.md'),'utf8'));
 const modele=readme.match(/« (Retour arrière : exporte[^»]*) »/)[1].replace(/test N-1/g,'test 6').replace(/test N\b/g,'test 7');
 assert.ok(r.includes(modele),'phrase du README');
 for(const m of ['Recharger','réactive','désactive'])assert.ok(r.includes(m),m);
 assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));
});

test('aucune empreinte ; aucun identifiant de projet ESV ; aucune adresse ; aucun nom de modèle d\'IA ; aucun autre opérateur nommé',()=>{
 assert.deepEqual([...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)],[]);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
 assert.doesNotMatch(texte,/https?:\/\//);
 assert.doesNotMatch(texte,new RegExp(['cla'+'ude','anth'+'ropic','op'+'us','son'+'net','hai'+'ku','fa'+'ble','g'+'pt','gem'+'ini'].join('|'),'i'));
});

test('ce qui n\'est pas vérifié est dit ; la consigne tient sur une page',()=>{
 const s=plat(section('6. Ce qui n\'est pas vérifié'));
 for(const m of ['**Maj+Espace envoyé par Ariane n\'a jamais été essayé dans le vrai ESV.**','valide sur place','nomme le cut','pas démontré pour l\'ADV et les abords','14 à 18 %',
  '3 à 9 minutes par partie en Ombre','12 au plus en Corriger','×4,5 à ×9','pas au fil du lot','Edge n\'a pas été vu'])assert.ok(s.includes(m),m);
 assert.ok(texte.split(/\s+/).length<1000,'une page : moins de 1 000 mots');
});
