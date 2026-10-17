'use strict';
/* Consigne de la séance « 4.9.5 test 6 » (le clic du mode rapide au choix, la règle « grappe de différés », les zones d'ADV dans la liste
 * « À contrôler ») : installer par-dessus la test 5, empreinte SHA-256 contrôlée avant la pose, version vérifiée ; ce qui change est dit en
 * français simple, avec les libellés du panneau ; l'essai des deux méthodes (un lot « Variante », un lot « Tout recentré », si possible un lot
 * « Comme avant », heures de début et de fin, différence de vitesse ou de comportement) ; la carte « À contrôler » relue d'abord, puis toute la
 * partie ; des parties neuves, lot et Écho complète ; une ligne pour la règle ; la pose ne change pas ; la mémoire des différés et déplacer la
 * vue restent coupés ; retour arrière avec la phrase de consignes/README.md (désactive, décompresse, réactive, Recharger, F5) ; aucune
 * empreinte (la consigne est dans le paquet) ; aucune donnée de projet ESV ; aucune adresse ; aucun nom de modèle d'IA ; une page. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const FICHIER='consignes/seance-terrain-4.9.5-test-6-2026-10-17.md';
const texte=fs.readFileSync(path.resolve(__dirname,'..',FICHIER),'utf8');
const html=fs.readFileSync(path.resolve(__dirname,'..','panel.html'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const plat=t=>t.replace(/\s+/g,' ');

test('installation : empreinte avant la pose, par-dessus la test 5 sans désinstaller, version et choix par défaut vérifiés',()=>{
 const s=plat(section('1. Installer et vérifier'));
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la 4.9.5 test 6'));
 for(const m of ['Get-FileHash','ariane-4.9.5-test.6.zip','-Algorithm SHA256','par-dessus la test 5','Ne désinstalle rien','Recharger','« 4.9.5 test 6 »','ARIANE 4.9.5 test 6',
  'Ariane 4.9.5 test 6 · ouvrir','« Comme avant » est coché','la case de la règle est vide'])assert.ok(s.includes(m),m);
});

test('ce qui ne change pas : la pose, le moteur ; la mémoire des différés de l\'Écho et déplacer la vue restent coupés',()=>{
 const debut=plat(texte.slice(0,texte.indexOf('## Ce qui change pour toi')));
 for(const m of ['**La pose ne change pas : Orbite pose les rails au même endroit qu\'avant.**','Le moteur n\'est pas modifié','si tu le choisis'])assert.ok(debut.includes(m),m);
 const s=plat(section('Ce qui change pour toi'));
 for(const m of ['**Toujours coupés**','la mémoire des différés de l\'Écho','**déplacer la vue**'])assert.ok(s.includes(m),m);
});

test('ce qui change : les trois choix du clic avec les libellés du panneau et leur coût, la règle, les ADV, le relevé hors vue, la liste corrigée',()=>{
 const s=plat(section('Ce qui change pour toi'));
 for(const l of ['Comme avant','Variante : rail gauche recentré','Tout recentré, comme un humain']){
  assert.ok(s.includes(`« ${l} »`),l);assert.ok(html.includes(`> ${l}</label>`),'libellé du panneau : '+l);}
 assert.ok(s.includes('« Clic du mode rapide »'));assert.match(html,/<legend class="lbl">Clic du mode rapide<\/legend>/);
 for(const m of ['6 à 9 %','12 à 18 %','lu au démarrage de chaque lot','un changement pendant un lot sert au lot suivant','le panneau le dit'])assert.ok(s.includes(m),m);
 const regle='Règle métier : mettre en attente les cuts d’une grappe (aiguille, série de rouges)';
 assert.ok(s.includes(`« ${regle} »`));
 /* Test 7 (Mic) : le libellé du panneau a été corrigé (la règle part d'une série de DIFFÉRÉS, pas d'aiguilles ni de rouges) ;
  * la consigne de la test 6 garde le libellé de sa version. */
 assert.ok(html.includes('> Mettre en attente les cuts voisins d’une série de différés</label>'),'libellé du panneau : la règle');
 for(const m of ['**Une règle métier, coupée par défaut.**','elle ne pose jamais ailleurs','Lue au démarrage du lot',
  '**La carte « À contrôler » montre aussi les aiguillages**','« ADV ','**Ariane note chaque clic parti hors de la vue**','sans rien changer',
  'le dernier lot fait foi','l\'export sans zip'])assert.ok(s.includes(m),m);
 /* Les plages d'ADV ont bien ce libellé dans la liste. */
 assert.ok(fs.readFileSync(path.resolve(__dirname,'..','src/verts-a-controler.js'),'utf8').includes('libelle=`ADV ${adv.debut}–${adv.fin}`'));
});

test('l\'essai des deux méthodes : parties neuves, Variante, Tout recentré, Comme avant si possible, heures de début et de fin, différences',()=>{
 const s=plat(section('2. L\'essai des deux méthodes'));
 for(const m of ['**Des parties neuves**','**Un lot en « Variante »**','**avant** de démarrer le lot','**Un lot en « Tout recentré »**','**Si tu le peux, un lot « Comme avant »**',
  'partie semblable','pour comparer','**note l\'heure de début et l\'heure de fin du lot**','**différence de vitesse ou de comportement**'])assert.ok(s.includes(m),m);
 assert.ok(s.indexOf('« Variante »')<s.indexOf('« Tout recentré »')&&s.indexOf('« Tout recentré »')<s.indexOf('« Comme avant »'));
 /* Les parties qui ont déjà servi (datasets/manifeste-parties.json) sont exclues, nommées par leur rang. */
 const M=require('../datasets/manifeste-parties.json'),p1=M.apprentissage.filter(a=>a.projet===1).flatMap(a=>a.parties).sort((a,b)=>a-b);
 assert.ok(s.includes(`pas les parties ${p1.slice(0,-1).join(', ')} et ${p1.at(-1)} du premier projet, ni la partie 1 du second`),'parties d\'apprentissage exclues');
 assert.deepEqual(M.apprentissage.filter(a=>a.projet===2).flatMap(a=>a.parties),[1]);
});

test('chaque partie : lot et Écho complète ; la carte « À contrôler », zones d\'ADV comprises, relue d\'abord, puis toute la partie ; un F5 en fin de partie',()=>{
 const s=plat(section('3. Pour chaque partie : la liste, puis une Écho complète'));
 for(const m of ['**lot Orbite**','**une Écho complète**','**À la fin du lot, lis la carte « À contrôler »**','zones d\'ADV comprises','**relis d\'abord ces plages**',
  '**relis toute la partie comme d\'habitude**','on juge la liste','Un seul F5 en Écho, en fin de partie'])assert.ok(s.includes(m),m);
 assert.ok(s.indexOf('relis d\'abord ces plages')<s.indexOf('relis toute la partie comme d\'habitude'));
 assert.match(html,/id="verts-titre" class="lbl">À contrôler</);
});

test('la règle « grappe de différés » : une ligne, un lot au choix, de préférence avec des aiguillages, les mises en attente inutiles notées',()=>{
 const s=plat(section('4. La règle « grappe de différés »'));
 for(const m of ['**Active-la sur un lot de ton choix**','si possible sur une partie avec des aiguillages','**note les cuts mis en attente que tu trouves inutiles**'])assert.ok(s.includes(m),m);
 assert.equal(section('4. La règle « grappe de différés »').split('\n').slice(1).filter(l=>l.trim()).length,1,'une ligne');
});

test('exports : tous les volumes, SHA-256, les heures ; le choix noté dans l\'export ; cache vidé après confirmation',()=>{
 const f=plat(section('5. À la fin : les exports'));
 for(const m of ['Tout télécharger pour l\'analyse','après chaque lot','Le choix du clic et de la règle y est noté','**tous les volumes**','SHA-256','tes heures','Terminer et télécharger',
  'Vide le cache seulement après ma confirmation de réception'])assert.ok(f.includes(m),m);
});

test('retour arrière : la phrase de consignes/README.md (désactive, décompresse la test 5, réactive, Recharger, F5)',()=>{
 const r=plat(section('6. Si quelque chose ne va pas'));
 assert.match(r,/Ne désinstalle pas Ariane/);
 assert.ok(r.includes('Retour arrière : exporte, vérifie et envoie les zips, puis **désactive** la 4.9.5 test 6 (interrupteur dans `chrome://extensions`, sans la supprimer). Décompresse le zip de la 4.9.5 test 5 dans le même dossier, en remplaçant les fichiers, puis **réactive** la carte Ariane et clique sur **Recharger**, puis F5 sur ESV.'));
 /* La phrase est bien celle que consignes/README.md demande pour la test 6, N = 6. */
 const readme=plat(fs.readFileSync(path.resolve(__dirname,'..','consignes/README.md'),'utf8'));
 const modele=readme.match(/« (Retour arrière : exporte[^»]*) »/)[1].replace(/test N-1/g,'test 5').replace(/test N\b/g,'test 6');
 assert.ok(r.includes(modele),'phrase du README');
 for(const m of ['Recharger','réactive'])assert.ok(r.includes(m),m);
 assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));
});

test('aucune empreinte ; aucun identifiant de projet ESV ; aucune adresse ; aucun nom de modèle d\'IA ; aucun autre opérateur nommé',()=>{
 assert.deepEqual([...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)],[]);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
 assert.doesNotMatch(texte,/https?:\/\//);
 assert.doesNotMatch(texte,new RegExp(['cla'+'ude','anth'+'ropic','op'+'us','son'+'net','hai'+'ku','fa'+'ble','g'+'pt','gem'+'ini'].join('|'),'i'));
});

test('ce qui n\'est pas vérifié est dit ; la consigne tient sur une page',()=>{
 const s=plat(section('7. Ce qui n\'est pas vérifié'));
 for(const m of ['mesurées au banc, jamais dans le vrai ESV','vus dans Chromium, pas sur un vrai lot','jamais été activée sur le terrain','8 sur 8',
  'ont toutes servi à régler','Instantané de la liste absent','Liste d’ESV non lue','Edge n\'a pas été vu'])assert.ok(s.includes(m),m);
 const panel=fs.readFileSync(path.resolve(__dirname,'..','panel.js'),'utf8');
 assert.ok(panel.includes('Instantané de la liste absent : écartement seul.'));assert.ok(panel.includes('Liste d’ESV non lue : la liste est vide.'));
 assert.ok(texte.split(/\s+/).length<1000,'une page : moins de 1 000 mots');
});
