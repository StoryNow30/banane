'use strict';
/* Consigne de la séance « 4.9.5 test 5 » (liste des verts à contrôler, relevé des gestes en Écho, ombres de la base 5.0) : installer par-dessus la test 4,
 * empreinte SHA-256 contrôlée avant la pose, version vérifiée ; ce qui change est dit en français simple (la carte « À contrôler », le relevé des gestes) ;
 * ce qu'on demande : des parties neuves réservées au jugement, lot Orbite et Écho complète, au moins une partie à voie décalée, la carte lue puis ses plages
 * relues d'abord, puis toute la partie relue comme d'habitude, quelques cuts hors de la vue déplacés au glisser gauche ou au dézoom, un seul F5 en Écho en fin
 * de partie, tout ralentissement noté ; RIEN ne change dans la pose ; retour arrière vers la test 4 ; aucune empreinte (la consigne est dans le paquet) ;
 * aucune donnée de projet ESV ; aucun nom de modèle d'IA ; une page. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const FICHIER='consignes/seance-terrain-4.9.5-test-5-2026-10-17.md';
const texte=fs.readFileSync(path.resolve(__dirname,'..',FICHIER),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const plat=t=>t.replace(/\s+/g,' ');
test('installation : empreinte avant la pose, par-dessus la test 4 sans désinstaller, version vérifiée',()=>{
 const s=plat(section('1. Installer et vérifier'));
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la 4.9.5 test 5'));
 for(const m of ['Get-FileHash','ariane-4.9.5-test.5.zip','-Algorithm SHA256','par-dessus la test 4','Ne désinstalle rien','Recharger','« 4.9.5 test 5 »','ARIANE 4.9.5 test 5','Ariane 4.9.5 test 5 · ouvrir'])assert.ok(s.includes(m),m);
});
test('ce qui ne change pas : la pose, le moteur, le mode rapide, aucune commande de plus',()=>{
 const debut=plat(texte.slice(0,texte.indexOf('## Ce qui change pour toi')));
 for(const m of ['Rien ne change dans ce qu\'Orbite décide, lit, pose ou valide','Le moteur n\'est pas modifié','le mode rapide non plus','Ariane n\'envoie aucune commande de plus à ESV'])assert.ok(debut.includes(m),m);
});
test('ce qui change : la carte « À contrôler » en fin de lot, le relevé des gestes en Écho, les ombres jamais appliquées, déplacer la vue coupé',()=>{
 const s=plat(section('Ce qui change pour toi'));
 for(const m of ['**La carte « À contrôler », en fin de lot.**','temps estimé','plages','Ariane ne fait rien dans ESV','Pendant un lot, la carte est cachée',
  '**Écho note tes gestes sur la vue.**','clic gauche','molette','Rien n\'est empêché ni commandé','jamais appliquées','P8','**Déplacer la vue**','**coupé**'])assert.ok(s.includes(m),m);
 /* Les libellés cités sont ceux du panneau. */
 const html=fs.readFileSync(path.resolve(__dirname,'..','panel.html'),'utf8');
 assert.match(html,/id="verts-titre" class="lbl">À contrôler</);assert.match(html,/class="sec[^"]*">Ce lot</);
});
test('ce qu\'on demande : parties neuves réservées au jugement, lot Orbite et Écho complète, voie décalée, carte lue puis plages relues d\'abord, puis relecture habituelle',()=>{
 const s=plat(section('2. Ce qu\'on te demande'));
 for(const m of ['**Des parties neuves.**','**réservées au jugement**','**un lot Orbite**','**une Écho complète**','**Au moins une partie à voie décalée**','si tu en as une',
  '**À la fin du lot, lis la carte « À contrôler »**','**relis d\'abord ces plages**','**cette fois, relis toute la partie comme d\'habitude**','on juge la liste'])assert.ok(s.includes(m),m);
 assert.ok(s.indexOf('relis d\'abord ces plages')<s.indexOf('relis toute la partie comme d\'habitude'));
 /* Les parties qui ont déjà servi (datasets/manifeste-parties.json) sont exclues, nommées par leur rang. */
 const M=require('../datasets/manifeste-parties.json'),p1=M.apprentissage.filter(a=>a.projet===1).flatMap(a=>a.parties).sort((a,b)=>a-b);
 assert.ok(s.includes(`pas les parties ${p1.slice(0,-1).join(', ')} et ${p1.at(-1)} du premier projet, ni la partie 1 du second`),'parties d\'apprentissage exclues');
 assert.deepEqual(M.apprentissage.filter(a=>a.projet===2).flatMap(a=>a.parties),[1]);
});
test('Écho : cuts hors de la vue déplacés au glisser gauche ou au dézoom ; un seul F5, en fin de partie, permis, heure notée ; ralentissements notés',()=>{
 const s=plat(section('2. Ce qu\'on te demande'));
 for(const m of ['**En Écho, quelques cuts dont le rail est hors de la vue**','**glisser gauche**','**dézoom**','comme d\'habitude','**Un seul F5 en Écho, en fin de partie**','il reste permis','**Note l\'heure.**',
  '**Note tout ralentissement du lot**'])assert.ok(s.includes(m),m);
 assert.doesNotMatch(s,/clic droit/,'D-147 : Mic glisse au clic gauche');
});
test('exports à envoyer : tous les volumes, SHA-256, la liste dans l\'export ; cache vidé après confirmation',()=>{
 const f=plat(section('3. À la fin : les exports'));
 for(const m of ['Tout télécharger pour l\'analyse','La liste « À contrôler » est dedans','**tous les volumes**','SHA-256','Terminer et télécharger','Vide le cache seulement après ma confirmation de réception'])assert.ok(f.includes(m),m);
});
test('retour arrière vers la 4.9.5 test 4 ; aucune empreinte ; aucun identifiant de projet ESV ; aucune adresse ; aucun nom de modèle d\'IA',()=>{
 const r=section('4. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));assert.match(r,/pose la 4\.9\.5 test 4/);
 assert.deepEqual([...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)],[]);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
 assert.doesNotMatch(texte,/https?:\/\//);
 assert.doesNotMatch(texte,new RegExp(['cla'+'ude','anth'+'ropic','op'+'us','son'+'net','hai'+'ku','fa'+'ble','g'+'pt','gem'+'ini'].join('|'),'i'));
});
test('ce qui n\'est pas vérifié est dit ; la consigne tient sur une page',()=>{
 const s=plat(section('5. Ce qui n\'est pas vérifié'));
 for(const m of ['lot simulé','jamais sur un vrai lot','Instantané de la liste absent','3,7 secondes','jamais été vu sur le vrai ESV','Edge n\'a pas été vu'])assert.ok(s.includes(m),m);
 /* Le message du panneau cité est celui que le panneau écrit. */
 assert.ok(fs.readFileSync(path.resolve(__dirname,'..','panel.js'),'utf8').includes('Instantané de la liste absent : écartement seul.'));
 assert.ok(texte.split(/\s+/).length<1000,'une page : moins de 1 000 mots');
});
