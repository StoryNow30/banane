'use strict';
/* Consigne de la séance « 4.9.5 test 9 » (RM-11, la raison de la correction dans Écho : touches 1 à 6, 0 efface, facultative, coupée par défaut, jamais bloquante) :
 * installer par-dessus la test 8, empreinte SHA-256 contrôlée avant la pose, version vérifiée ; l'ÉTAPE 0 (taper les chiffres dans ESV, vérifier qu'il ne réagit
 * pas, sinon choisir le repli) ; comment taper une raison, la rendre collante et l'effacer, avec les libellés du panneau et les chiffres du réglage ; ce qui ne change
 * pas ; le retour arrière vers la test 8 avec la phrase de consignes/README.md (désactive, décompresse, réactive, Recharger, F5) ; aucune empreinte ; aucune donnée
 * de projet ESV ; aucune adresse ; aucun nom de modèle d'IA ; une page. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../src/raison-correction.js'),S=require('../src/settings.js');
const FICHIER='consignes/seance-terrain-4.9.5-test-9-2026-10-19.md';
const texte=fs.readFileSync(path.resolve(__dirname,'..',FICHIER),'utf8');
const html=fs.readFileSync(path.resolve(__dirname,'..','panel.html'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const plat=t=>t.replace(/\s+/g,' ');

test('installation : empreinte avant la pose, par-dessus la test 8 sans désinstaller, version vérifiée, la carte est là case décochée',()=>{
 const s=plat(section('1. Installer et vérifier'));
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la 4.9.5 test 9'));
 for(const m of ['Get-FileHash','ariane-4.9.5-test.9.zip','-Algorithm SHA256','par-dessus la test 8','Ne désinstalle rien','Recharger','« 4.9.5 test 9 »','ARIANE 4.9.5 test 9',
  'Ariane 4.9.5 test 9 · ouvrir','« Raison de la correction »','case décochée'])assert.ok(s.includes(m),m);
 assert.match(html,/id="raison-titre" class="lbl">Raison de la correction</);
});

test('ce qui ne change pas : la pose, le moteur, le lot ; coupée par défaut ; l\'Écho sans touche est celui de la test 8',()=>{
 const debut=plat(texte.slice(0,texte.indexOf('## Ce qui change pour toi')));
 for(const m of ['**La pose ne change pas : Orbite pose les rails au même endroit qu\'avant.**','Le lot et le moteur ne sont pas modifiés','**facultatif**','**coupé par défaut**','ne bloque jamais rien'])assert.ok(debut.includes(m),m);
 const s=plat(section('6. Ce qui ne change pas'));
 for(const m of ['Orbite, la pose, le lot, la relecture après le lot, le moteur','comme à la test 8','Case décochée, ou aucune touche tapée','octet pour octet','Maj+Espace, `D`','passent à ESV comme avant'])assert.ok(s.includes(m),m);
 const c=plat(section('Ce qui change pour toi'));
 for(const m of ['Ariane ne retient aucune touche et n\'envoie rien à ESV','inconnu','ni « bon » ni « autre »'])assert.ok(c.includes(m),m);
 for(const m of ['D-211','« Cuts d\'Ariane mémorisés »','dernier cut validé juste après la fin du lot','relecture « Corriger »','La pose ne change pas'])assert.ok(c.includes(m),m);
});

test('les touches dites sont celles du catalogue : 1 à 6 dans l\'ordre, 0 efface',()=>{
 const s=plat(section('Ce qui change pour toi'));
 const dites=[...s.matchAll(/\*\*(\d)\*\* ([^,*.]+?)(?=,|\.| \*\*)/g)].map(m=>[m[1],m[2].trim().toLowerCase()]);
 const attendues=[...R.CATALOGUE.map(c=>[c.touche,c.libelle.toLowerCase()]),['0','efface']];
 assert.deepEqual(dites,attendues);
});

test('étape 0 : taper 1 à 6 et 0 dans ESV, avec et sans Maj, regarder ce qui bouge ; sinon le repli Alt + chiffre puis le pavé, avec les libellés du panneau',()=>{
 const s=plat(section('0. Étape 0 : vérifie qu\'ESV ne réagit pas aux chiffres (2 minutes)'));
 for(const m of ['un cut que tu ne valides pas','**1, 2, 3, 4, 5, 6, 0**','rangée du haut','avec et sans **Maj**','la caméra, un rail, la liste, le cut affiché','**Rien ne bouge**','**ESV réagit**',
  '**« Alt + chiffre »**','tenant **Alt**','**« Pavé numérique seul »**','Dis-moi la rangée qui marche','séance Écho courte','case décochée','L\'export gardera la trace'])assert.ok(s.includes(m),m);
 assert.ok(s.indexOf('Alt + chiffre')<s.indexOf('Pavé numérique seul'),'dans l\'ordre de la fiche');
 /* les libellés cités existent dans le panneau */
 for(const l of ['Alt + chiffre','Pavé numérique seul'])assert.ok(html.includes(l),l);
 assert.ok(texte.indexOf('## 0.')<texte.indexOf('## 1.'),'avant l\'installation des essais de séance');
});

test('taper une raison : choix avant de démarrer, un appui, après la validation, collante, effacer, fins de la collante, rappel, bandeau, objectif ; les chiffres sont ceux du réglage',()=>{
 const s=plat(section('2. Taper une raison'));
 for(const m of ['**Avant de démarrer Écho**','**« Noter ma raison »**','lu au démarrage et gardé jusqu\'à la fin de la séance','tape la touche une fois','**demi-seconde**','après **Maj+Espace**','au cut que tu viens de valider',
  '**même touche deux fois**','**0,6 seconde**','aux cuts suivants','vaut pour ce cut seul','la collante reprend','tape **0**','efface la raison du cut et finit la collante','si tu changes de partie','plus de 30 cuts','en pause',
  'Après 40 cuts collants','rien ne s\'arrête','les 24 derniers cuts','« raison : ADV (collante) »','Un clic sur une pastille vaut une touche','corrections de plus de 10 mm','au moins 8 sur 10','décoche la case'])assert.ok(s.includes(m),m);
 assert.ok(html.includes('Noter ma raison'));
 assert.equal(S.echo.raison.graceMs,500);assert.equal(S.echo.raison.doubleAppuiMs,600);assert.equal(S.echo.raison.sautCuts,30);assert.equal(S.echo.raison.rappelCollanteCuts,40);
 assert.ok(R.LIBELLES.adv==='ADV');
});

test('séance complète et exports : 150 cuts au moins, tous les volumes, SHA-256, heures ; cache vidé après confirmation',()=>{
 const s=plat(section('3. Une séance d\'Écho complète')),f=plat(section('4. À la fin : les exports'));
 for(const m of ['Au moins **150 cuts**','zone d\'ADV','**les touches tapées par erreur**','**si tu as été ralenti**'])assert.ok(s.includes(m),m);
 for(const m of ['Terminer et télécharger','**tous les volumes**','SHA-256','`Get-FileHash`','l\'heure du F5','Vide le cache seulement après ma confirmation de réception'])assert.ok(f.includes(m),m);
 assert.ok(html.includes('Terminer et télécharger'));
});

test('retour arrière : la phrase de consignes/README.md (désactive, décompresse la test 8, réactive, Recharger, F5)',()=>{
 const r=plat(section('5. Si quelque chose ne va pas'));
 assert.match(r,/Ne désinstalle pas Ariane/);
 const readme=plat(fs.readFileSync(path.resolve(__dirname,'..','consignes/README.md'),'utf8'));
 const modele=readme.match(/« (Retour arrière : exporte[^»]*) »/)[1].replace(/test N-1/g,'test 8').replace(/test N\b/g,'test 9');
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
 const s=plat(section('7. Ce qui n\'est pas vérifié'));
 for(const m of ['**ESV et les chiffres**','L\'étape 0 le dit','**La demi-seconde après la validation**','vrai délai de tes frappes','**Le coût d\'une raison**','estimé à 0,6 s, pas mesuré','la fonction est retirée','Edge n\'a pas été vu'])assert.ok(s.includes(m),m);
 assert.ok(texte.split(/\s+/).length<1000,'une page : moins de 1 000 mots');
});
